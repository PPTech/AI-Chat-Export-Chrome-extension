// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/extractors/chatgpt.mjs - ChatGPT extraction strategy

import { reportProgress, computeCoverageMetrics } from './utils.mjs';

function tryChatGptSsotExtraction() {
    // Attempt 1: __NEXT_DATA__
    try {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
            const payload = JSON.parse(nextDataEl.textContent || '{}');
            const serverResp = payload?.props?.pageProps?.serverResponse;
            if (serverResp?.body?.mapping) {
                const mapping = serverResp.body.mapping;
                const ordered = Object.values(mapping)
                    .filter((n) => n.message?.content?.parts?.length)
                    .sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
                if (ordered.length > 0) {
                    return {
                        strategy: 'ssot:__NEXT_DATA__',
                        messages: ordered.map((n) => ({
                            role: n.message.author?.role === 'user' ? 'User' : 'Assistant',
                            content: n.message.content.parts.join('\n'),
                            timestamp: n.message.create_time ? new Date(n.message.create_time * 1000).toISOString() : null,
                            meta: { platform: 'ChatGPT', sourceSelector: 'ssot:__NEXT_DATA__', confidence: 0.99, evidence: ['ssot-server-data'] }
                        }))
                    };
                }
            }
        }
    } catch { /* SSOT path unavailable */ }

    // Attempt 2: Remix route data
    try {
        const remixCtx = window.__remixContext;
        if (remixCtx?.state?.loaderData) {
            for (const [, loaderData] of Object.entries(remixCtx.state.loaderData)) {
                const mapping = loaderData?.serverResponse?.body?.mapping;
                if (!mapping) continue;
                const ordered = Object.values(mapping)
                    .filter((n) => n.message?.content?.parts?.length)
                    .sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
                if (ordered.length > 0) {
                    return {
                        strategy: 'ssot:__remixContext',
                        messages: ordered.map((n) => ({
                            role: n.message.author?.role === 'user' ? 'User' : 'Assistant',
                            content: n.message.content.parts.join('\n'),
                            timestamp: n.message.create_time ? new Date(n.message.create_time * 1000).toISOString() : null,
                            meta: { platform: 'ChatGPT', sourceSelector: 'ssot:__remixContext', confidence: 0.99, evidence: ['ssot-remix-data'] }
                        }))
                    };
                }
            }
        }
    } catch { /* Remix data unavailable */ }

    return null;
}

async function tryChatGptApiFetch() {
    try {
        const match = location.pathname.match(/\/c\/([a-f0-9-]+)/i) || location.pathname.match(/\/([a-f0-9-]{36})/);
        if (!match) return null;
        const conversationId = match[1];
        reportProgress(25, 'Fetching full conversation via API');
        const resp = await fetch(`/backend-api/conversation/${conversationId}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data?.mapping) return null;
        const ordered = Object.values(data.mapping)
            .filter((n) => n.message?.content?.parts?.length && n.message?.author?.role !== 'system')
            .sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
        if (ordered.length === 0) return null;
        reportProgress(50, `API returned ${ordered.length} messages`);
        return {
            strategy: 'api:backend-api',
            title: data.title || document.title,
            messages: ordered.map((n) => {
                const parts = n.message.content.parts || [];
                const textParts = parts.filter((p) => typeof p === 'string');
                const imageParts = parts.filter((p) => typeof p === 'object' && p?.content_type?.startsWith('image'));
                // tether_id = user-uploaded file (PDF, CSV, DOCX, etc.)
                const fileParts = parts.filter((p) => typeof p === 'object' && (
                    p?.content_type === 'tether_id' ||
                    p?.content_type === 'attachment' ||
                    (typeof p?.tether_id === 'string')
                ));
                let content = textParts.join('\n');
                for (const img of imageParts) {
                    const assetUrl = img.asset_pointer
                        ? `https://chatgpt.com/backend-api/files/${img.asset_pointer.replace('file-service://', '')}`
                        : '';
                    if (assetUrl) content += `\n[[IMG:${assetUrl}]]`;
                }
                for (const file of fileParts) {
                    const fileId = file.tether_id || file.id || '';
                    const fileName = file.name || file.filename || (fileId ? `file_${fileId.slice(0, 8)}.bin` : 'attachment.bin');
                    const fileUrl = fileId
                        ? `https://chatgpt.com/backend-api/files/${fileId}`
                        : (file.url || '');
                    if (fileUrl) content += `\n[[FILE:${fileUrl}|${fileName}]]`;
                }
                return {
                    role: n.message.author?.role === 'user' ? 'User' : 'Assistant',
                    content,
                    timestamp: n.message.create_time ? new Date(n.message.create_time * 1000).toISOString() : null,
                    meta: { platform: 'ChatGPT', sourceSelector: 'api:backend-api', confidence: 0.99, evidence: ['api-full-conversation'] }
                };
            })
        };
    } catch (e) {
        console.log('[ChatGPT] API fetch failed:', e.message);
        return null;
    }
}

export const ChatGPT = {
    name: 'ChatGPT',
    matches: () => location.hostname.includes('chatgpt.com') || location.hostname.includes('chat.openai.com'),
    async extract(options, utils, runChatGptDomAnalysis, composeContentFromBlocks) {
        reportProgress(15, 'Trying bulk data sources');

        const apiFetch = await tryChatGptApiFetch();
        if (apiFetch && apiFetch.messages.length > 0) {
            const isCodex = /chatgpt\.com\/codex/i.test(location.href);
            const platformName = isCodex ? 'ChatGPT Codex' : this.name;
            const coverage = computeCoverageMetrics(apiFetch.messages, apiFetch.messages.length);
            return { platform: platformName, title: apiFetch.title || document.title, messages: apiFetch.messages, _extraction: { strategy: apiFetch.strategy, coverage } };
        }

        reportProgress(25, 'Trying embedded data');
        const ssot = tryChatGptSsotExtraction();
        if (ssot && ssot.messages.length > 0) {
            const isCodex = /chatgpt\.com\/codex/i.test(location.href);
            const platformName = isCodex ? 'ChatGPT Codex' : this.name;
            const coverage = computeCoverageMetrics(ssot.messages, ssot.messages.length);
            return { platform: platformName, title: document.title, messages: ssot.messages, _extraction: { strategy: ssot.strategy, coverage } };
        }

        reportProgress(35, 'Analyzing DOM');
        const analysis = await runChatGptDomAnalysis(options.fullLoad ? 'full' : 'visible', options, utils);
        let messages = [];
        for (const m of analysis.messages) {
            messages.push({
                role: m.inferredRole.role === 'assistant' ? 'Assistant' : (m.inferredRole.role === 'user' ? 'User' : 'Unknown'),
                content: await composeContentFromBlocks(m.parsed.blocks, options),
                meta: { platform: this.name, sourceSelector: m.signature, confidence: m.inferredRole.confidence, evidence: m.inferredRole.evidence }
            });
        }

        if (!messages.length) {
            const fallbackNodes = utils.adaptiveQuery('main [data-message-author-role], main article, main [data-testid*="message"], main section', 1)
                .filter((n) => utils.hasMeaningfulContent(n));
            for (const node of fallbackNodes) {
                const marker = `${node.getAttribute('data-message-author-role') || ''} ${node.getAttribute('data-testid') || ''}`.toLowerCase();
                const isUser = marker.includes('user');
                const content = await utils.extractNodeContent(node, options, isUser, this.name, 'chatgpt-fallback');
                if (content) messages.push({ role: isUser ? 'User' : 'Assistant', content, meta: { platform: this.name, sourceSelector: 'chatgpt-fallback' } });
            }
        }

        const isCodex = /chatgpt\.com\/codex/i.test(location.href);
        const platformName = isCodex ? 'ChatGPT Codex' : this.name;
        const domCandidateCount = analysis.messages?.length || 0;
        const strategy = messages.length ? 'dom-analysis' : 'fallback-selectors';
        const coverage = computeCoverageMetrics(messages, domCandidateCount);
        return { platform: platformName, title: document.title, messages, _extraction: { strategy, coverage, loadReport: analysis.loadReport } };
    }
};
