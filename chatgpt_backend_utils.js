// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// chatgpt_backend_utils.js - ChatGPT full conversation helpers v0.12.19
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

(() => {
  const UUIDISH_RE = /^[0-9a-fA-F-]{16,}$/;
  const URL_RE = /https?:\/\/[^\s)"'<>]+/g;
  const BLOCKED_ASSET_EXT_RE = /\.(?:js|mjs|cjs|map|css)(?:$|[?#])/i;
  const FILE_EXT_RE = /\.(?:pdf|docx|xlsx|pptx|zip|csv|txt|json|md|py|js)$/i;
  const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|bmp|svg)(?:$|[?#])/i;

  function detectChatGPTConversationIdFromUrl(href = '') {
    let url;
    try {
      url = new URL(String(href || ''));
    } catch {
      return { id: null, mode: 'unknown' };
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const shareIdx = parts.indexOf('share');
    if (shareIdx >= 0 && parts[shareIdx + 1] && UUIDISH_RE.test(parts[shareIdx + 1])) {
      return { id: parts[shareIdx + 1], mode: 'share' };
    }

    const chatIdx = parts.indexOf('c');
    if (chatIdx >= 0 && parts[chatIdx + 1] && UUIDISH_RE.test(parts[chatIdx + 1])) {
      return { id: parts[chatIdx + 1], mode: 'chat' };
    }

    const last = parts[parts.length - 1];
    if (last && UUIDISH_RE.test(last)) {
      return { id: last, mode: 'chat' };
    }

    return { id: null, mode: 'unknown' };
  }

  function orderedNodesFromCurrent(convo = {}) {
    const mapping = convo?.mapping || {};
    const current = convo?.current_node;
    if (!current || !mapping[current]) throw new Error('missing_current_node');

    const path = [];
    const seen = new Set();
    let nodeId = current;

    while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
      seen.add(nodeId);
      const node = mapping[nodeId];
      if (node?.message) path.push(node);
      nodeId = node?.parent || null;
    }

    return path.reverse();
  }

  function collectUrlsDeep(obj) {
    const urls = [];
    const seen = new Set();

    const walk = (value) => {
      if (value == null) return;
      if (typeof value === 'string') {
        const matches = value.match(URL_RE) || [];
        for (const url of matches) {
          if (seen.has(url)) continue;
          seen.add(url);
          urls.push(url);
        }
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (typeof value === 'object') {
        for (const key of Object.keys(value)) walk(value[key]);
      }
    };

    walk(obj);
    return urls;
  }

  function classifyChatGptAssetUrl(rawUrl = '') {
    if (!rawUrl) return { accepted: false, kind: 'noise', reason: 'empty' };
    const lower = String(rawUrl).toLowerCase();

    if (lower.startsWith('chrome-extension://')) return { accepted: false, kind: 'noise', reason: 'extension_resource' };
    if (BLOCKED_ASSET_EXT_RE.test(lower)) return { accepted: false, kind: 'noise', reason: 'script_or_style_asset' };

    if (IMAGE_EXT_RE.test(lower)) return { accepted: true, kind: 'image', reason: 'image_extension' };
    if (FILE_EXT_RE.test(lower)) return { accepted: true, kind: 'file', reason: 'file_extension' };

    if (/oaiusercontent|oaistatic|openaicdn|files\.openai|chatgpt\.com\/.+\/files/i.test(lower)) {
      return { accepted: true, kind: 'file', reason: 'chatgpt_asset_host' };
    }

    if (/googleusercontent|lh3\.google\.com|gstatic/i.test(lower)) {
      return { accepted: true, kind: 'image', reason: 'image_cdn_host' };
    }

    return { accepted: false, kind: 'noise', reason: 'not_attachment_like' };
  }

  const api = {
    detectChatGPTConversationIdFromUrl,
    orderedNodesFromCurrent,
    collectUrlsDeep,
    classifyChatGptAssetUrl
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ChatGPTBackendUtils = api;
})();
