// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/extractors/claude.mjs - Claude.ai extraction strategy

import { normalizeContent } from './utils.mjs';

export const Claude = {
    name: 'Claude',
    matches: () => location.hostname.includes('claude.ai'),
    selectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '[data-testid*="message"]', '.font-user-message', '.font-claude-response', '.font-claude-message', '[data-is-streaming-or-done]', 'main article', 'main section'],
    async extract(options, utils) {
        const nodes = utils.adaptiveQuery(this.selectors.join(','), 1).filter((n) => !n.closest('nav,aside,header') && utils.hasMeaningfulContent(n));
        const messages = [];
        for (const node of nodes) {
            const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''}`.toLowerCase();
            const isUser = marker.includes('user');
            let content = await utils.extractNodeContent(node, options, isUser, this.name, 'claude-node');
            if (content && !options.rawHtml) content = normalizeContent(content);
            if (content) messages.push({ role: isUser ? 'User' : 'Claude', content, meta: { platform: this.name, sourceSelector: 'claude-node' } });
        }
        return { platform: this.name, title: document.title, messages };
    }
};
