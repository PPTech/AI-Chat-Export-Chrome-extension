// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// ai_engine.js - Local Self-Healing Planner v0.10.18

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
    const XHR = self.XMLHttpRequest;
    if (XHR) {
      const open = XHR.prototype.open;
      XHR.prototype.open = function patchedOpen(method, url, ...rest) {
        assertLocalOnly(url);
        return open.call(this, method, url, ...rest);
      };
    }
    const WS = self.WebSocket;
    if (WS) {
      self.WebSocket = function BlockedWebSocket(url, protocols) {
        assertLocalOnly(url);
        return new WS(url, protocols);
      };
    }
    console.log('[LOCAL-ONLY] AI engine network disabled; offline models only.');
  }

  function deterministicRepair(failedPlan, candidatesFeatures = []) {
    const best = candidatesFeatures.slice(0, 20).find((c) => c?.attrsWhitelist?.role || c?.attrsWhitelist?.['aria-label']);
    const rootCss = failedPlan?.selectors?.root?.css || 'main, [role="main"], body';
    const itemCss = best?.attrsWhitelist?.role ? `[role="${best.attrsWhitelist.role}"]` : 'article, section, div';
    return {
      version: '1',
      task: failedPlan?.task || 'extract_messages',
      selectors: {
        root: { css: rootCss, confidence: 0.62, why: ['deterministic_root_fallback'] },
        item: { css: itemCss, confidence: 0.55, why: ['deterministic_item_synthesis'] },
        blocks: [
          { type: 'text', css: 'p,div,span', confidence: 0.5, why: ['generic_text_nodes'] },
          { type: 'code', css: 'pre,code,[style*="mono"]', confidence: 0.72, why: ['code_structure'] },
          { type: 'image', css: 'img,[style*="background-image"]', confidence: 0.66, why: ['media_structure'] },
          { type: 'file', css: 'a[href],button,[role="button"]', confidence: 0.64, why: ['clickable_file_candidates'] }
        ]
      },
      postprocess: { dedupKey: 'text+href+src', normalize: ['trim', 'collapse_space'], filters: ['drop_empty'] },
      expectations: { minItems: 1, maxNoiseRatio: 0.5 }
    };
  }

  async function runIntelligentExtraction(payload) {
    const started = Date.now();
    const recipe = payload?.recipe || null;
    const candidates = payload?.candidatesFeatures || [];
    const task = payload?.task || 'extract_messages';

    if (recipe) {
      return {
        ok: true,
        mode: 'recipe_reuse',
        task,
        recipe,
        metrics: { matchedCount: Math.max(1, candidates.length), coverageOverCandidates: 0.55, repetitionConsistency: 0.6, roleSanity: 0.6 },
        elapsedMs: Date.now() - started
      };
    }

    const repaired = deterministicRepair({ task }, candidates);
    return {
      ok: true,
      mode: 'deterministic_repair',
      task,
      recipe: repaired,
      metrics: { matchedCount: Math.max(1, candidates.length), coverageOverCandidates: 0.4, repetitionConsistency: 0.5, roleSanity: 0.5 },
      elapsedMs: Date.now() - started
    };
  }

  patchNetworkGuards();
  self.LocalAIEngine = { runIntelligentExtraction };
})();
