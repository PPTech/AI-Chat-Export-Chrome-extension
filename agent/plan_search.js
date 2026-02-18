// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/plan_search.js - Multi-attempt plan synthesis v0.12.0

(function () {
  function planFromSelection(nodes, idx) {
    const selectors = nodes.map((n) => n.selector).filter(Boolean).slice(0, 12);
    return {
      confidence: Number((0.9 - idx * 0.08).toFixed(2)),
      why: ['ranked_by_model_scores', 'selector_window_plan'],
      id: `plan_${idx + 1}`,
      selectors,
      attempt: idx + 1,
      extractionHints: {
        preferRoles: ['USER_TURN', 'MODEL_TURN'],
        includeAssets: true
      }
    };
  }

  function generate(candidates = [], classScores = [], maxAttempts = 8) {
    const ranked = candidates.map((c, idx) => ({ ...c, predicted: classScores[idx]?.label || c.type, modelScore: classScores[idx]?.score || 0 }))
      .sort((a, b) => b.modelScore - a.modelScore);
    const plans = [];
    const windowSize = Math.max(6, Math.ceil(ranked.length / 3));
    for (let i = 0; i < maxAttempts; i += 1) {
      const slice = ranked.slice(i, i + windowSize);
      if (!slice.length) break;
      plans.push(planFromSelection(slice, i));
    }
    return plans;
  }

  self.AgentPlanSearch = { generate };
})();
