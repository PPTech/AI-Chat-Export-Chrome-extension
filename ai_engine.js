// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// ai_engine.js - Agent Loop Bridge v0.12.5

(function () {
  const STRICT_ALLOWLIST = ['chrome-extension:', 'data:', 'blob:'];

  function assertLocalOnly(url) {
    const u = String(url || '');
    if (STRICT_ALLOWLIST.some((p) => u.startsWith(p))) return;
    throw new Error(`[LOCAL-ONLY] Blocked outbound URL: ${u}`);
  }

  function patchNetworkGuards() {
    const originalFetch = self.fetch?.bind(self);
    if (originalFetch) {
      self.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        assertLocalOnly(url);
        return originalFetch(input, init);
      };
    }
  }

  async function runIntelligentExtraction(payload = {}) {
    if (!self.LocalAgentLoop) {
      return {
        ok: false,
        mode: 'disabled',
        error: 'LocalAgentLoop unavailable'
      };
    }
    return self.LocalAgentLoop.run(payload);
  }

  patchNetworkGuards();
  self.LocalAIEngine = { runIntelligentExtraction };
})();
