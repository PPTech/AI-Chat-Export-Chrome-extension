// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/extractors/aistudio.mjs - AI Studio extraction strategy

import { reportProgress, computeCoverageMetrics } from './utils.mjs';

export const AIStudio = {
    name: 'AI Studio',
    matches: () => location.hostname.includes('aistudio.google.com'),
    async extract(options, utils) {
        let messages = [];
        let strategy = 'none';

        messages = await this._extractViaShadowDom(options, utils);
        if (messages.length > 0) { strategy = 'shadow-dom'; }

        if (messages.length === 0) {
            messages = await this._extractViaFlatDom(options, utils);
            if (messages.length > 0) strategy = 'flat-dom';
        }

        if (messages.length === 0) {
            messages = await this._extractViaGeometry(options, utils);
            if (messages.length > 0) strategy = 'geometry';
        }

        if (messages.length === 0) {
            await this._waitForContent();
            messages = await this._extractViaShadowDom(options, utils);
            if (messages.length === 0) messages = await this._extractViaFlatDom(options, utils);
            if (messages.length > 0) strategy = 'wait-then-retry';
        }

        reportProgress(85, `AI Studio: ${messages.length} messages via ${strategy}`);
        const coverage = computeCoverageMetrics(messages, messages.length);
        return { platform: this.name, title: document.title || 'AI Studio Export', messages, _extraction: { strategy, coverage } };
    },

    async _extractViaShadowDom(options, utils) {
        const messages = [];
        const customTags = ['ms-chat-turn', 'ms-chat-turn-container', 'ms-prompt-chunk', 'ms-response-chunk', 'ms-chat-bubble', 'ms-autosize-textarea'];
        const allEls = document.querySelectorAll('*');
        const shadowHosts = [];
        for (const el of allEls) {
            if (el.shadowRoot) shadowHosts.push(el);
        }
        const candidates = [];
        for (const tag of customTags) {
            document.querySelectorAll(tag).forEach((el) => candidates.push(el));
        }
        for (const host of shadowHosts) {
            const tag = (host.tagName || '').toLowerCase();
            if (/chat|turn|prompt|response|message|bubble/i.test(tag) || /chat|turn|prompt|response|message/i.test(host.className || '')) {
                candidates.push(host);
            }
        }

        const seen = new Set();
        for (const el of candidates) {
            if (seen.has(el)) continue;
            seen.add(el);
            const root = el.shadowRoot || el;
            const text = (root.textContent || '').trim();
            if (text.length < 3) continue;

            const marker = `${el.tagName} ${el.className || ''} ${el.getAttribute('is-user') || ''} ${el.getAttribute('role') || ''} ${el.getAttribute('data-turn-role') || ''}`.toLowerCase();
            const isUser = /user|query|prompt|human/.test(marker) || el.getAttribute('is-user') === 'true';
            const isModel = /model|response|assistant|gemini/.test(marker);

            let content;
            try {
                content = await utils.extractNodeContent(root === el ? el : el, options, isUser, 'AI Studio', 'aistudio-shadow');
            } catch {
                content = text;
            }
            if (!content || content.length < 2) continue;

            const role = isUser ? 'User' : (isModel ? 'Model' : 'Unknown');
            messages.push({ role, content, meta: { platform: 'AI Studio', sourceSelector: `shadow:${el.tagName.toLowerCase()}`, confidence: isUser || isModel ? 0.85 : 0.4, evidence: isUser ? ['shadow-dom-user'] : isModel ? ['shadow-dom-model'] : ['shadow-dom-unknown'] } });
        }
        return messages;
    },

    async _extractViaFlatDom(options, utils) {
        const selectors = [
            'ms-chat-turn', 'ms-chat-bubble', 'ms-prompt-chunk', 'ms-response-chunk',
            'user-query-item', 'model-response-item',
            '.chat-turn', '.query-container', '.response-container', '.chat-bubble',
            '[data-turn-role]', '[data-message-role]',
            '[role="article"]', '[role="listitem"]',
            '.conversation-turn', '.prompt-container', '.response-text',
            'div[class*="chat-turn"]', 'div[class*="message"]', 'div[class*="response"]', 'div[class*="query"]',
        ];
        const nodes = utils.adaptiveQuery(selectors.join(','), 1).filter((n) => utils.hasMeaningfulContent(n));
        const messages = [];
        for (const node of nodes) {
            const marker = `${node.tagName} ${node.className || ''} ${node.getAttribute('is-user') || ''} ${node.getAttribute('data-turn-role') || ''} ${node.getAttribute('role') || ''}`.toLowerCase();
            const isUser = /user|query|prompt|human/.test(marker) || node.getAttribute('is-user') === 'true';
            const isModel = /model|response|assistant/.test(marker);
            const content = await utils.extractNodeContent(node, options, isUser, 'AI Studio', 'aistudio-flat');
            if (content) {
                const role = isUser ? 'User' : (isModel ? 'Model' : 'Unknown');
                messages.push({ role, content, meta: { platform: 'AI Studio', sourceSelector: 'aistudio-flat' } });
            }
        }
        return messages;
    },

    async _extractViaGeometry(options, utils) {
        const messages = [];
        const viewH = window.innerHeight;
        const mainEl = document.querySelector('main, [role="main"]') || document.body;
        const allDivs = Array.from(mainEl.querySelectorAll('div, section, article')).filter((el) => {
            const rect = el.getBoundingClientRect();
            const text = (el.innerText || '').trim();
            return text.length > 10 && rect.height > 30 && rect.height < viewH * 0.8 && rect.width > 200;
        });

        const scored = allDivs.map((el) => {
            const text = (el.innerText || '').trim();
            const children = el.querySelectorAll('*').length;
            const codeBlocks = el.querySelectorAll('pre, code').length;
            const hasImg = el.querySelectorAll('img').length;
            const textScore = Math.min(5, text.length / 200);
            const penaltyForTooManyChildren = children > 50 ? -3 : 0;
            const score = textScore + codeBlocks + hasImg + penaltyForTooManyChildren;
            return { el, score, text };
        }).filter((s) => s.score > 1).sort((a, b) => b.score - a.score);

        const kept = [];
        for (const item of scored) {
            const overlap = kept.some((k) => k.el.contains(item.el) || item.el.contains(k.el));
            if (!overlap) kept.push(item);
        }

        kept.sort((a, b) => a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

        for (let i = 0; i < kept.length; i++) {
            const content = await utils.extractNodeContent(kept[i].el, options, i % 2 === 0, 'AI Studio', 'aistudio-geometry');
            if (content) {
                messages.push({
                    role: i % 2 === 0 ? 'User' : 'Model',
                    content,
                    meta: { platform: 'AI Studio', sourceSelector: 'aistudio-geometry', confidence: 0.55, evidence: ['geometry-alternate'] }
                });
            }
        }
        return messages;
    },

    _waitForContent() {
        return new Promise((resolve) => {
            const target = document.querySelector('main, [role="main"]') || document.body;
            let resolved = false;
            const observer = new MutationObserver(() => {
                const hasContent = target.querySelectorAll('ms-chat-turn, [data-turn-role], .chat-turn, [role="article"]').length > 0;
                if (hasContent && !resolved) {
                    resolved = true;
                    observer.disconnect();
                    setTimeout(resolve, 500);
                }
            });
            observer.observe(target, { childList: true, subtree: true });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    observer.disconnect();
                    resolve();
                }
            }, 3000);
        });
    }
};
