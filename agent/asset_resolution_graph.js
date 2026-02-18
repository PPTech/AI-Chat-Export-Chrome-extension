// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/asset_resolution_graph.js - Deterministic asset resolution strategies v0.11.5

(function () {
  function sanitizeFileName(name = 'artifact.bin') {
    return String(name || 'artifact.bin').replace(/\.\.+/g, '.').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  }

  async function resolve(url, fetchBlobFn) {
    const sourceUrl = String(url || '');
    if (!sourceUrl) return { ok: false, strategy: 'none', error: 'empty_url' };
    if (/^data:/i.test(sourceUrl)) return { ok: true, strategy: 'S1_data', sourceUrl };
    if (/^blob:/i.test(sourceUrl)) return { ok: true, strategy: 'S2_blob_page_fetch', sourceUrl };
    if (/^https?:\/\//i.test(sourceUrl)) {
      const blob = await fetchBlobFn(sourceUrl).catch(() => null);
      if (!blob) return { ok: false, strategy: 'S3_https_fetch', sourceUrl, error: 'fetch_failed' };
      return { ok: true, strategy: 'S3_https_fetch', sourceUrl, mime: blob.type || 'application/octet-stream', byteLength: blob.size };
    }
    return { ok: false, strategy: 'unsupported', sourceUrl, error: 'unsupported_scheme' };
  }

  self.AssetResolutionGraph = { resolve, sanitizeFileName };
})();
