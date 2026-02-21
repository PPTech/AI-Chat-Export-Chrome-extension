// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/extractors/utils.mjs - Extraction utilities

export function reportProgress(percent, label, details = null) {
    try {
        chrome.runtime.sendMessage({
            action: 'EXTRACTION_PROGRESS',
            percent: Math.max(0, Math.min(100, Math.round(percent))),
            label: label || 'Processing',
            details: details || null,
            timestamp: Date.now()
        });
    } catch (_) { /* popup may be closed */ }
}

export function computeCoverageMetrics(messages, domNodeCount) {
    const user = messages.filter((m) => m.role === 'User').length;
    const assistant = messages.filter((m) => m.role === 'Assistant' || m.role === 'Claude' || m.role === 'Gemini' || m.role === 'Model').length;
    const unknown = messages.filter((m) => m.role === 'Unknown').length;
    const total = messages.length;
    return {
        messages_total: total,
        messages_user: user,
        messages_assistant: assistant,
        messages_unknown: unknown,
        unknown_role_ratio: total > 0 ? (unknown / total).toFixed(3) : '0.000',
        dom_candidates: domNodeCount,
        coverage_ratio: domNodeCount > 0 ? (total / domNodeCount).toFixed(3) : '0.000'
    };
}

export const utils = {
    isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    },

    hasMeaningfulContent(node) {
        return !!node && ((node.innerText || '').trim().length > 0 || !!node.querySelector('img,pre,code'));
    },

    queryOrdered(selector) {
        return Array.from(document.querySelectorAll(selector))
            .filter((n) => this.isVisible(n))
            .sort((a, b) => {
                if (a === b) return 0;
                const pos = a.compareDocumentPosition(b);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });
    },

    scoreNodeForExtraction(node) {
        if (!node) return 0;
        const textLen = (node.innerText || '').trim().length;
        const imgCount = node.querySelectorAll('img').length;
        const codeCount = node.querySelectorAll('pre,code').length;
        const roleHints = /assistant|user|message|response|query/i.test(`${node.className || ''} ${node.getAttribute('data-testid') || ''}`) ? 1 : 0;
        return Math.min(5, Math.floor(textLen / 80)) + (imgCount * 2) + codeCount + roleHints;
    },

    adaptiveQuery(selector, minScore = 1) {
        return this.queryOrdered(selector).filter((n) => this.scoreNodeForExtraction(n) >= minScore);
    },

    dedupe(messages) {
        const seen = new Set();
        return messages.filter((m) => {
            const key = `${m.role}|${m.content}`;
            if (!m.content || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    pickBestImageSource(img) {
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (src) return src;
        const lazy = img.getAttribute('data-src') || img.getAttribute('data-original') || '';
        if (lazy) return lazy;
        const picture = img.closest('picture');
        if (picture) {
            const sources = picture.querySelectorAll('source[srcset]');
            for (const source of sources) {
                const srcset = source.getAttribute('srcset') || '';
                const best = srcset.split(',').map((x) => x.trim().split(' ')[0]).filter(Boolean).pop();
                if (best) return best;
            }
        }
        const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
        if (srcset) {
            const best = srcset.split(',').map((x) => x.trim().split(' ')[0]).filter(Boolean).pop();
            if (best) return best;
        }
        return '';
    },

    async urlToBase64(url) {
        try {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            const abs = new URL(url, location.href).toString();
            const res = await fetch(abs);
            const blob = await res.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result || abs);
                reader.readAsDataURL(blob);
            });
        } catch {
            return url;
        }
    },

    async extractImageTokensFromNode(node, options, isUser) {
        const images = Array.from(node.querySelectorAll('img'));
        const tokens = [];

        for (const img of images) {
            const src = this.pickBestImageSource(img);
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const cls = (img.className || '').toLowerCase();

            if (!src) continue;
            if (isUser && alt.includes('avatar')) continue;
            if (alt.includes('avatar') || cls.includes('avatar') || cls.includes('icon')) continue;
            if (/favicon|google\.com\/s2\/favicons|gstatic\.com.*icon/i.test(src)) continue;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 0 && h > 0 && w <= 64 && h <= 64) continue;

            const normalized = options.convertImages ? await this.urlToBase64(src) : src;
            if (normalized) tokens.push(`[[IMG:${normalized}]]`);
        }

        const fileCards = node.querySelectorAll('.file-thumbnail img, [data-testid="file-thumbnail"] img, [class*="file-card"] img, [class*="upload"] img');
        for (const fcImg of fileCards) {
            const src = this.pickBestImageSource(fcImg);
            if (!src) continue;
            if (tokens.some((t) => t.includes(src))) continue;
            const normalized = options.convertImages ? await this.urlToBase64(src) : src;
            if (normalized) tokens.push(`[[IMG:${normalized}]]`);
        }

        const allEls = node.querySelectorAll('*');
        for (const el of allEls) {
            const style = el.style?.backgroundImage || '';
            const computed = style ? style : (typeof getComputedStyle === 'function' ? getComputedStyle(el).backgroundImage : '');
            if (!computed || computed === 'none') continue;
            const bgMatch = computed.match(/url\(["']?(.*?)["']?\)/);
            if (!bgMatch || !bgMatch[1]) continue;
            const bgUrl = bgMatch[1];
            if (/^(data:image\/|https?:\/\/)/.test(bgUrl) && !tokens.some((t) => t.includes(bgUrl))) {
                const normalized = options.convertImages ? await this.urlToBase64(bgUrl) : bgUrl;
                if (normalized) tokens.push(`[[IMG:${normalized}]]`);
            }
        }

        return [...new Set(tokens)];
    },

    async extractFileTokensFromNode(node) {
        const links = Array.from(node.querySelectorAll('a[href], a[download], button[data-file-url], [data-file-url], iframe[src], iframe[srcdoc]'));
        const artifactSelectors = Array.from(node.querySelectorAll('[data-artifact-id], [data-testid*="artifact"], [class*="Artifact" i], [class*="artifact" i], iframe[title*="Artifact" i], [role="region"][aria-label*="Artifact" i]'));
        const tokens = [];
        for (const link of [...links, ...artifactSelectors]) {
            const href = link.getAttribute('href') || link.getAttribute('data-file-url') || link.getAttribute('src') || '';
            const srcdoc = link.getAttribute('srcdoc') || '';
            if (!href) continue;
            const abs = (() => {
                try { return new URL(href, location.href).toString(); } catch { return ''; }
            })();
            if (!abs) continue;
            const isFileLike = /download|attachment|file|uploads|backend-api\/(files|estuary\/content)|blob:|data:|\/artifact\//i.test(abs)
                || !!link.getAttribute('download')
                || /artifact|download|file/i.test(`${link.getAttribute('aria-label') || ''} ${link.textContent || ''}`);
            if (!isFileLike) continue;
            const nameRaw = link.getAttribute('download') || link.getAttribute('data-artifact-id') || link.textContent || abs.split('/').pop() || (srcdoc ? 'artifact.html' : 'file.bin');
            const safeName = nameRaw.replace(/[\/:*?"<>|]+/g, '_').trim() || 'file.bin';
            tokens.push(`[[FILE:${abs}|${safeName}]]`);
        }
        return [...new Set(tokens)];
    },

    async extractNodeContent(node, options, isUser) {
        if (!node) return '';
        if (options.rawHtml) return node.innerHTML || '';

        const imageTokens = await this.extractImageTokensFromNode(node, options, isUser);
        const fileTokens = options.extractFiles ? await this.extractFileTokensFromNode(node) : [];

        const clone = node.cloneNode(true);
        clone.querySelectorAll('script,style,button,svg,nav,aside,header,footer,[role="toolbar"],[role="tooltip"],[aria-hidden="true"],.sr-only').forEach((n) => n.remove());
        clone.querySelectorAll('*').forEach((el) => {
            const t = (el.textContent || '').trim().toLowerCase();
            if (/^(copy|copied|show more|show less|share|thumbs up|thumbs down|edit)$/i.test(t) && el.children.length === 0) {
                el.remove();
            }
        });
        clone.querySelectorAll('img').forEach((img) => img.remove());

        clone.querySelectorAll('pre').forEach((pre) => {
            const lang = (pre.className.match(/language-([\w-]+)/)?.[1] || '').trim();
            const code = pre.textContent || '';
            pre.replaceWith(`\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
        });

        const text = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
        const images = imageTokens.length ? `\n${imageTokens.join('\n')}\n` : '';
        const files = fileTokens.length ? `\n${fileTokens.join('\n')}\n` : '';
        return `${text}${images}${files}`.trim();
    }
};

export function domSignature(el) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.');
    return `${tag}${cls ? '.' + cls : ''}#${el.childElementCount}`;
}

export function normalizeContent(content) {
    if (!content || typeof content !== 'string') return content || '';
    if (!/<[a-z][^>]*>/i.test(content)) return content;
    const imgTokens = [];
    const fileTokens = [];
    let cleaned = content.replace(/\[\[IMG:([^\]]*)\]\]/g, (m) => { imgTokens.push(m); return `__IMG_TOKEN_${imgTokens.length - 1}__`; });
    cleaned = cleaned.replace(/\[\[FILE:([^\]]*)\]\]/g, (m) => { fileTokens.push(m); return `__FILE_TOKEN_${fileTokens.length - 1}__`; });
    const codeBlocks = [];
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (m) => { codeBlocks.push(m); return `__CODE_BLOCK_${codeBlocks.length - 1}__`; });

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${cleaned}</div>`, 'text/html');
        const root = doc.body.querySelector('div') || doc.body;

        root.querySelectorAll('button, svg, nav, aside, header, footer, [role="toolbar"], [role="tooltip"], .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
        root.querySelectorAll('*').forEach((el) => {
            const text = (el.textContent || '').trim().toLowerCase();
            if (/^(show more|show less|copy|copied|share|thumbs up|thumbs down)$/i.test(text) && el.children.length === 0) {
                el.remove();
            }
        });

        const parts = [];
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        const seenCode = new Set();
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.nodeType === Node.TEXT_NODE) {
                const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (text) parts.push(text);
                continue;
            }
            const tag = node.tagName?.toLowerCase();
            if (tag === 'pre' || tag === 'code') {
                const code = (node.textContent || '').trim();
                if (code && !seenCode.has(code)) {
                    const langHint = (node.className || '').match(/language-(\w+)/)?.[1] || '';
                    parts.push(`\n\`\`\`${langHint}\n${code}\n\`\`\`\n`);
                    seenCode.add(code);
                }
            } else if (tag === 'a') {
                const href = node.getAttribute('href') || '';
                const linkText = (node.textContent || '').trim();
                if (href && linkText) parts.push(`[${linkText}](${href})`);
            }
        }

        let result = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        result = result.replace(/__IMG_TOKEN_(\d+)__/g, (_, i) => imgTokens[parseInt(i)] || '');
        result = result.replace(/__FILE_TOKEN_(\d+)__/g, (_, i) => fileTokens[parseInt(i)] || '');
        result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)] || '');

        return result;
    } catch {
        let result = content
            .replace(/<(button|svg|nav|aside|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        result = result.replace(/__IMG_TOKEN_(\d+)__/g, (_, i) => imgTokens[parseInt(i)] || '');
        result = result.replace(/__FILE_TOKEN_(\d+)__/g, (_, i) => fileTokens[parseInt(i)] || '');
        result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)] || '');
        return result;
    }
}

export async function composeContentFromBlocks(blocks, options) {
    const out = [];
    for (const b of blocks) {
        if (b.type === 'text') out.push(b.text);
        else if (b.type === 'code') out.push(`\n\`\`\`\n${b.code}\n\`\`\`\n`);
        else if (b.type === 'list') {
            const lines = b.items.map((it, i) => b.ordered ? `${i + 1}. ${it}` : `- ${it}`);
            out.push(lines.join('\n'));
        }
        else if (b.type === 'quote') out.push(`> ${b.text}`);
        else if (b.type === 'image') {
            const src = (options.convertImages && b.src && !b.src.startsWith('data:')) ? await utils.urlToBase64(b.src) : b.src;
            if (src) out.push(`[[IMG:${src}]]`);
        }
        else if (b.type === 'link') out.push(`[${b.text || b.href}](${b.href})`);
        else if (b.type === 'file_token') out.push(b.token);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
