// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/asset_broker.js - Controlled asset retrieval broker v0.11.0

(function () {
  const DEFAULT_ALLOWLIST = [
    'chatgpt.com',
    'chat.openai.com',
    'oaistatic.com',
    'openai.com',
    'claude.ai',
    'anthropic.com',
    'google.com',
    'gstatic.com',
    'googleusercontent.com'
  ];

  function allowHost(url, extraHosts = []) {
    try {
      const host = new URL(url).hostname;
      const allowed = [...DEFAULT_ALLOWLIST, ...(extraHosts || [])];
      return allowed.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  function decodeDataUrl(dataUrl) {
    const [meta, b64] = String(dataUrl || '').split(',');
    const mime = meta.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream';
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return { ok: true, mime, bytes, sourceUrl: dataUrl, method: 'data_url_decode' };
  }

  self.AgentAssetBroker = { allowHost, decodeDataUrl, DEFAULT_ALLOWLIST };
})();
