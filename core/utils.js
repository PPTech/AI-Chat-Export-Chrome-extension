// License: AGPL-3.0
// core/utils.js - Shared utilities for formatting and extraction

export function escapeHtml(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function normalizeImageSrc(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    return '';
}

export function stripImageTokens(content) {
    return (content || '')
        .replace(/\[\[IMG:[\s\S]*?\]\]/g, '')
        .replace(/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function replaceImageTokensForText(content) {
    return stripImageTokens(content);
}

export function replaceImageTokensForHtml(content) {
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
    const markdownRegex = /!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    return content
        .replace(tokenRegex, (_, src) => renderImgTag(src))
        .replace(markdownRegex, (_, src) => renderImgTag(src));
}

export function renderImgTag(rawSrc) {
    const src = normalizeImageSrc((rawSrc || '').trim());
    if (!src) return '';
    return `<img src="${src}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
}

export function splitContentAndImages(content) {
    const parts = [];
    const regex = /\[\[IMG:([\s\S]*?)\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content || '')) !== null) {
        const start = match.index;
        if (start > lastIndex) parts.push({ type: 'text', value: (content || '').slice(lastIndex, start) });
        parts.push({ type: 'image', value: match[1] || match[2] || '' });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < (content || '').length) parts.push({ type: 'text', value: (content || '').slice(lastIndex) });
    if (!parts.length) parts.push({ type: 'text', value: content || '' });
    return parts;
}

export function renderRichMessageHtml(content) {
    const parts = splitContentAndImages(content || '');
    return parts.map((part) => {
        if (part.type === 'image') return renderImgTag(part.value);
        return escapeHtml(part.value || '').replace(/\n/g, '<br>');
    }).join('');
}

export function extractAllImageSources(messages) {
    const set = new Set();
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
    const mdRegex = /!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    for (const m of messages || []) {
        let match;
        while ((match = tokenRegex.exec(m.content || '')) !== null) {
            const src = normalizeImageSrc((match[1] || '').trim());
            if (src) set.add(src);
        }
        while ((match = mdRegex.exec(m.content || '')) !== null) {
            const src = normalizeImageSrc((match[1] || '').trim());
            if (src) set.add(src);
        }
    }
    return Array.from(set);
}

export function extractAllFileSources(messages) {
    const files = [];
    for (const m of messages || []) {
        const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
        let match;
        while ((match = fileRegex.exec(m.content || '')) !== null) {
            const rawUrl = (match[1] || '').trim();
            const fileName = (match[2] || 'file.bin').trim();
            if (!rawUrl) continue;
            const safeName = fileName.replace(/[\/:*?"<>|]+/g, '_') || 'file.bin';
            files.push({ url: rawUrl, name: safeName });
        }
    }
    const uniq = new Map();
    files.forEach((f) => { if (!uniq.has(f.url)) uniq.set(f.url, f); });
    return Array.from(uniq.values());
}

export function rewriteContentWithLocalAssets(content, urlMap) {
    if (!urlMap || urlMap.size === 0) return content;
    let result = content;
    for (const [originalUrl, localPath] of urlMap) {
        result = result.split(originalUrl).join(localPath);
    }
    return result;
}

export function renderRichMessageHtmlWithAssets(content, urlMap) {
    const rewritten = urlMap ? rewriteContentWithLocalAssets(content, urlMap) : content;
    const parts = splitContentAndImages(rewritten || '');
    return parts.map((part) => {
        if (part.type === 'image') {
            const src = (part.value || '').trim();
            if (!src) return '';
            const safeSrc = /^(data:|https?:\/\/)/.test(src) ? normalizeImageSrc(src) : escapeHtml(src);
            if (!safeSrc) return '';
            return `<img src="${safeSrc}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
        }
        return escapeHtml(part.value || '').replace(/\n/g, '<br>');
    }).join('');
}

export function stripHtmlTags(text) {
    return String(text || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

export function hasNonLatinChars(text) {
    // eslint-disable-next-line no-control-regex
    return /[^\x00-\x7F\xA0-\xFF]/.test(text);
}

export function pdfEscapeText(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E\xA0-\xFF\\()]/g, '?')
        .trim();
}

export function wrapLineSmart(text, max, profile = { isRtl: false, isCjk: false }) {
    const normalized = String(text || '').replace(/\r/g, '').trim();
    if (!normalized) return [''];

    if (profile.isCjk) {
        const chars = Array.from(normalized.replace(/\s+/g, ''));
        const out = [];
        let line = '';
        for (const ch of chars) {
            if ((line + ch).length > max) {
                out.push(line);
                line = ch;
            } else {
                line += ch;
            }
        }
        if (line) out.push(line);
        return out;
    }

    if (profile.isRtl) {
        const tokens = normalized.split(/\s+/).filter(Boolean);
        const out = [];
        let line = '';
        for (const tok of tokens) {
            const candidate = line ? `${tok} ${line}` : tok;
            if (candidate.length > max && line) {
                out.push(line);
                line = tok;
            } else {
                line = candidate;
            }
        }
        if (line) out.push(line);
        return out;
    }

    const words = normalized.replace(/\s+/g, ' ').split(' ');
    const linesOut = [];
    let line = '';
    for (const w of words) {
        if ((line + ' ' + w).trim().length > max) {
            if (line.trim()) linesOut.push(line.trim());
            line = w;
        } else {
            line += ` ${w}`;
        }
    }
    if (line.trim()) linesOut.push(line.trim());
    return linesOut.length ? linesOut : [''];
}
