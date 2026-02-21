// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/extractors/gemini.mjs - Gemini extraction strategy

const GEMINI_NOISE_PATTERNS = [
    /^Show thinking$/im, /^Show thinking\s*…?$/im, /^Hide thinking$/im,
    /^Thought for \d+ seconds?$/im, /^Thinking…?$/im,
    /^Edit$/im, /^Copy$/im, /^Copied$/im, /^Share$/im, /^More$/im,
    /^Retry$/im, /^Good response$/im, /^Bad response$/im, /^Modify response$/im,
    /^Report legal issue$/im, /^Google it$/im, /^Double-check response$/im,
];

function splitGeminiTranscriptBlock(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    let cleaned = rawText;
    for (const pattern of GEMINI_NOISE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    if (!cleaned) return [];

    const markerRegex = /(?:^|\n)\s*(You said|Gemini said|Model said)\s*\n/gi;
    const splits = [];
    let lastIndex = 0;
    let lastRole = null;
    let match;

    while ((match = markerRegex.exec(cleaned)) !== null) {
        if (lastIndex < match.index && lastRole !== null) {
            const text = cleaned.slice(lastIndex, match.index).trim();
            if (text) splits.push({ role: lastRole, text });
        } else if (lastIndex < match.index && lastRole === null) {
            const text = cleaned.slice(lastIndex, match.index).trim();
            if (text) splits.push({ role: 'unknown', text });
        }
        const markerLower = (match[1] || '').toLowerCase();
        lastRole = markerLower.includes('you') ? 'user' : 'assistant';
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < cleaned.length) {
        const text = cleaned.slice(lastIndex).trim();
        if (text) splits.push({ role: lastRole || 'unknown', text });
    }

    if (splits.length === 0 && cleaned) {
        splits.push({ role: 'unknown', text: cleaned });
    }

    return splits;
}

function stripGeminiNoise(text) {
    if (!text) return '';
    let cleaned = text;
    for (const pattern of GEMINI_NOISE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleaned.replace(/(?:^|\n)\s*(You said|Gemini said|Model said)\s*(?:\n|$)/gi, '\n');
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

class GeminiExtractor {
    constructor(options = {}, utils) {
        this.options = options;
        this.utils = utils;
        this.maxProbeNodes = 1200;
    }

    getAllElementsDeep(root = document) {
        const out = [];
        const stack = [root];
        while (stack.length) {
            const current = stack.pop();
            if (!current) continue;
            const children = current instanceof ShadowRoot ? Array.from(current.children) : Array.from((current.children || []));
            for (let i = children.length - 1; i >= 0; i -= 1) {
                const child = children[i];
                out.push(child);
                if (child.shadowRoot) stack.push(child.shadowRoot);
                stack.push(child);
                if (out.length > this.maxProbeNodes) return out;
            }
        }
        return out;
    }

    countTextNodes(el) {
        let count = 0;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if ((walker.currentNode.textContent || '').trim().length > 2) count += 1;
        }
        return count;
    }

    isScrollable(el) {
        if (!el || !(el instanceof Element)) return false;
        const cs = getComputedStyle(el);
        return ['auto', 'scroll', 'overlay'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 80;
    }

    detectScope() {
        const viewportH = window.innerHeight || 1;
        const candidates = [];
        const seen = new Set();
        const addCandidate = (el, method) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            const rect = el.getBoundingClientRect();
            const heightRatio = rect.height / viewportH;
            const scrollable = this.isScrollable(el) ? 1 : 0;
            const textNodes = this.countTextNodes(el);
            const turnHints = el.querySelectorAll('[data-test-id*="user"], [data-test-id*="model"], article, [role="listitem"], pre, img').length;
            const score = (heightRatio * 3) + (scrollable * 3) + Math.min(3, textNodes / 80) + Math.min(2, turnHints / 15);
            candidates.push({ el, method, score, diagnostics: { heightRatio: Number(heightRatio.toFixed(2)), scrollable, textNodes, turnHints } });
        };

        document.querySelectorAll('[role="main"], main').forEach((el) => addCandidate(el, 'aria-main'));
        this.getAllElementsDeep(document).forEach((el) => {
            if (!(el instanceof Element)) return;
            if (this.isScrollable(el) && el.getBoundingClientRect().height > viewportH * 0.7) addCandidate(el, 'scroll-probe');
        });

        if (!candidates.length) addCandidate(document.scrollingElement || document.documentElement, 'document-fallback');
        candidates.sort((a, b) => b.score - a.score);
        const top = candidates[0];
        return { rootEl: top ? top.el : null, method: top ? top.method : 'none', confidence: top ? Math.min(0.98, top.score / 8.5) : 0, candidates: candidates.slice(0, 10) };
    }

    collectTurnCandidates(rootEl) {
        if (!rootEl) return [];
        const nodes = [];
        const seen = new Set();
        const probe = this.getAllElementsDeep(rootEl);

        probe.forEach((el, idx) => {
            if (!(el instanceof Element) || seen.has(el)) return;
            const textLen = (el.innerText || '').trim().length;
            const hasCode = !!el.querySelector('pre,code');
            const hasImg = !!el.querySelector('img');
            const marker = `${el.getAttribute('data-test-id') || ''} ${el.getAttribute('aria-label') || ''} ${el.tagName}`.toLowerCase();
            const hintScore = /(user|query|model|response|prompt|gemini)/.test(marker) ? 2 : 0;
            let score = Math.min(5, textLen / 160) + (hasCode ? 2 : 0) + (hasImg ? 1.5 : 0) + hintScore;
            if (textLen < 4 && !hasImg && !hasCode) score -= 2;
            if (el.children.length > 15 && !hasCode && !hasImg) score -= 1;
            if (score < 1.6) return;
            seen.add(el);
            nodes.push({ el, indexInDom: idx, score: Number(score.toFixed(2)), signals: [textLen > 0 ? `text:${textLen}` : null, hasCode ? 'has-code' : null, hasImg ? 'has-image' : null, hintScore ? 'attribute-role-hint' : null].filter(Boolean) });
        });

        nodes.sort((a, b) => b.score - a.score);
        const selected = [];
        for (const node of nodes) {
            const nestedBetter = nodes.some((other) => other !== node && node.el.contains(other.el) && other.score >= node.score);
            if (nestedBetter) continue;
            const overlap = selected.some((kept) => kept.el.contains(node.el) || node.el.contains(kept.el));
            if (!overlap) selected.push(node);
        }
        return selected.sort((a, b) => a.indexInDom - b.indexInDom);
    }

    inferRole(el, scopeEl) {
        const evidence = [];
        let role = 'unknown';
        let confidence = 0.35;
        const txt = (el.innerText || '').toLowerCase();
        const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-test-id') || ''} ${el.getAttribute('data-content-type') || ''}`.toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();

        const startsWithYouSaid = /^you said\b/i.test(txt.trim());
        const startsWithGeminiSaid = /^(gemini said|model said)\b/i.test(txt.trim());
        if (startsWithYouSaid) {
            role = 'user';
            confidence += 0.45;
            evidence.push('text-marker:you-said');
        } else if (startsWithGeminiSaid) {
            role = 'assistant';
            confidence += 0.45;
            evidence.push('text-marker:gemini-said');
        }

        if (/query|user-turn|user-message|user-query/i.test(cls) || /query|user/i.test(aria)) {
            if (role === 'unknown') role = 'user';
            confidence += 0.3;
            evidence.push('class-or-aria:user-hint');
        }
        if (/response|model-turn|model-message|model-response/i.test(cls) || /response|model|gemini/i.test(aria)) {
            if (role === 'unknown') role = 'assistant';
            confidence += 0.3;
            evidence.push('class-or-aria:model-hint');
        }

        const avatarUser = !!el.querySelector('img[src*="googleusercontent"], img[alt*="profile" i], img[alt*="avatar" i]');
        if (avatarUser || /user-query|user/.test(aria)) {
            if (role === 'unknown') role = 'user';
            confidence += 0.2;
            evidence.push('user-avatar-or-aria-hint');
        }

        const modelHint = /gemini|model/.test(aria) || /regenerate|draft response|thought/i.test(txt);
        const geminiIcon = !!el.querySelector('svg[aria-label*="Gemini" i], [aria-label*="Gemini" i], [aria-label*="Model" i]');
        if (modelHint || geminiIcon) {
            if (role === 'unknown') role = 'assistant';
            confidence += 0.2;
            evidence.push('model-aria-or-control-hint');
        }

        if (scopeEl && role === 'unknown') {
            const rect = el.getBoundingClientRect();
            const sRect = scopeEl.getBoundingClientRect();
            const delta = (rect.left + rect.width / 2) - (sRect.left + sRect.width / 2);
            if (delta > sRect.width * 0.12) {
                evidence.push('layout:right');
                role = 'user';
                confidence += 0.1;
            } else if (delta < -sRect.width * 0.12) {
                evidence.push('layout:left');
                role = 'assistant';
                confidence += 0.1;
            }
        }

        confidence = Math.min(0.98, confidence);
        if (confidence < 0.42) role = 'unknown';
        return { role, confidence: Number(confidence.toFixed(2)), evidence };
    }

    async parseBlocks(el) {
        const blocks = [];
        const diagnostics = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.nodeType === Node.TEXT_NODE) {
                const cleaned = (node.textContent || '').replace(/\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim();
                if (cleaned) blocks.push({ type: 'text', text: cleaned });
                continue;
            }
            const tag = node.tagName ? node.tagName.toLowerCase() : '';
            if (tag === 'pre' || tag === 'code') {
                const code = node.textContent || '';
                if (code.trim()) {
                    const langHint = (node.previousElementSibling?.textContent || '').trim().slice(0, 24);
                    blocks.push({ type: 'code', code, language: /[a-z]{2,}/i.test(langHint) ? langHint : '' });
                }
            } else if (tag === 'img') {
                const src = node.currentSrc || node.getAttribute('src') || node.getAttribute('data-src') || '';
                if (src) blocks.push({ type: 'image', src, alt: node.getAttribute('alt') || '' });
            } else if (tag === 'a') {
                const href = node.getAttribute('href') || '';
                if (href) blocks.push({ type: 'link', href, text: (node.textContent || '').trim() });
            } else if (tag === 'blockquote') {
                const text = (node.textContent || '').trim();
                if (text) blocks.push({ type: 'quote', text });
            } else if (tag === 'ul' || tag === 'ol') {
                const items = Array.from(node.querySelectorAll(':scope > li')).map((li) => (li.textContent || '').trim()).filter(Boolean);
                if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
            }
        }
        const fileTokens = await this.utils.extractFileTokensFromNode(el);
        for (const ft of fileTokens) {
            blocks.push({ type: 'file_token', token: ft });
        }
        const textPlain = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        diagnostics.push(`block-count:${blocks.length}`);
        return { blocks, textPlain, diagnostics };
    }

    async run() {
        const scope = this.detectScope();
        const turns = this.collectTurnCandidates(scope.rootEl);
        const messages = [];
        for (const turn of turns) {
            const inferredRole = this.inferRole(turn.el, scope.rootEl);
            const parsed = await this.parseBlocks(turn.el);
            messages.push({ ...turn, inferredRole, parsed, signature: `${turn.el.tagName.toLowerCase()}#${turn.el.childElementCount}` });
        }

        return { platform: 'Gemini', timestamp: new Date().toISOString(), root: scope, messageCount: messages.length, messages };
    }
}

export const Gemini = {
    name: 'Gemini',
    matches: () => location.hostname.includes('gemini.google.com'),
    async extract(options, utils, _, composeContentFromBlocks) {
        const extractor = new GeminiExtractor(options, utils);
        const analysis = await extractor.run();
        window.GEMINI_DOM_ANALYSIS = analysis;

        const messages = [];
        for (const m of analysis.messages) {
            const rawContent = await composeContentFromBlocks(m.parsed.blocks, options);
            if (!rawContent) continue;

            const inferredRole = m.inferredRole.role;
            const fullText = m.parsed.textPlain || rawContent;
            const hasBothMarkers = /You said/i.test(fullText) && /(Gemini said|Model said)/i.test(fullText);

            if (hasBothMarkers) {
                const splits = splitGeminiTranscriptBlock(fullText);
                for (const split of splits) {
                    const cleanedContent = stripGeminiNoise(split.text);
                    if (!cleanedContent) continue;
                    const role = split.role === 'user' ? 'User' : (split.role === 'assistant' ? 'Gemini' : 'Unknown');
                    messages.push({ role, content: cleanedContent, meta: { platform: this.name, sourceSelector: m.signature, confidence: 0.85, evidence: ['transcript-marker-split', `original-role:${inferredRole}`] } });
                }
            } else {
                const cleanedContent = stripGeminiNoise(rawContent);
                if (!cleanedContent) continue;
                const role = inferredRole === 'assistant' ? 'Gemini' : (inferredRole === 'user' ? 'User' : 'Unknown');
                messages.push({ role, content: cleanedContent, meta: { platform: this.name, sourceSelector: m.signature, confidence: m.inferredRole.confidence, evidence: [...m.inferredRole.evidence, 'noise-stripped'] } });
            }
        }

        return { platform: this.name, title: document.title, messages };
    }
};
