// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/online_learner.js - Incremental linear learner v0.11.0

(function () {
  const LABELS = ['MESSAGE_CONTAINER', 'USER_TURN', 'MODEL_TURN', 'CODE_BLOCK', 'IMAGE_BLOCK', 'FILE_CARD', 'NOISE'];

  function score(weights, vector) {
    let s = weights.bias || 0;
    const w = weights.w || [];
    for (let i = 0; i < Math.min(w.length, vector.length); i += 1) s += w[i] * vector[i];
    return s;
  }

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x))));
  }

  class OnlineLearner {
    constructor() {
      this.lr = 0.08;
    }

    async load(domainKey) {
      const saved = await self.RecipeManager.getLearnerState(domainKey).catch(() => null);
      return saved || { domainKey, version: 1, labels: LABELS, weights: {} };
    }

    ensureWeights(state, label, dim) {
      if (!state.weights[label]) state.weights[label] = { bias: 0, w: Array(dim).fill(0) };
      if (state.weights[label].w.length !== dim) state.weights[label].w = Array(dim).fill(0);
      return state.weights[label];
    }

    classify(state, vector) {
      let bestLabel = 'NOISE';
      let best = -Infinity;
      for (const label of LABELS) {
        const w = this.ensureWeights(state, label, vector.length);
        const s = score(w, vector);
        if (s > best) {
          best = s;
          bestLabel = label;
        }
      }
      return { label: bestLabel, score: best };
    }

    train(state, examples = []) {
      let updates = 0;
      for (const ex of examples) {
        const vector = ex.vector;
        const dim = vector.length;
        for (const label of LABELS) {
          const y = label === ex.label ? 1 : 0;
          const w = this.ensureWeights(state, label, dim);
          const p = sigmoid(score(w, vector));
          const err = y - p;
          w.bias += this.lr * err;
          for (let i = 0; i < dim; i += 1) w.w[i] += this.lr * err * vector[i];
          updates += 1;
        }
      }
      return { state, updates };
    }

    async persist(state) {
      await self.RecipeManager.saveLearnerState(state);
    }
  }

  self.AgentOnlineLearner = new OnlineLearner();
})();
