// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// logger.js - AEGIS Black Box Logger v0.11.1

(() => {
  async function sha256Hex(text) {
    const data = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildSessionLog(payload = {}) {
    const {
      timestamp = new Date().toISOString(),
      scanDurationMs = 0,
      nodesDetected = 0,
      shadowDomBreaches = 0,
      securityBlocks = 0,
      exportedContent = '',
      visualElementsCount = 0
    } = payload;

    const integrityHash = await sha256Hex(exportedContent);
    const variance = Math.abs(nodesDetected - visualElementsCount) / Math.max(1, visualElementsCount);

    return {
      timestamp,
      scan_duration_ms: scanDurationMs,
      nodes_detected: nodesDetected,
      shadow_dom_breaches: shadowDomBreaches,
      security_blocks: securityBlocks,
      integrity_hash: integrityHash,
      visual_elements_count: visualElementsCount,
      warning: variance > 0.1 ? 'WARNING: Data Loss Possible' : ''
    };
  }

  const api = { buildSessionLog };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AegisLogger = api;
})();
