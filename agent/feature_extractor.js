// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/feature_extractor.js - Candidate vectorizer v0.11.0

(function () {
  function safeNum(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  async function toVectors(candidates = []) {
    const texts = candidates.map((c) => `${c.text || ''} ${(c.evidence || []).join(' ')}`);
    const started = performance.now();
    const emb = await self.LocalEmbeddingEngine.embed(texts);
    const vectors = candidates.map((c, idx) => {
      const base = [
        safeNum(c.confidence, 0),
        safeNum(c.bbox?.top, 0) / 4000,
        safeNum(c.bbox?.left, 0) / 4000,
        safeNum(c.bbox?.width, 0) / 2000,
        safeNum(c.bbox?.height, 0) / 2000,
        (c.type === 'USER_TURN') ? 1 : 0,
        (c.type === 'MODEL_TURN') ? 1 : 0,
        (c.type === 'CODE_BLOCK') ? 1 : 0,
        (c.type === 'IMAGE_BLOCK') ? 1 : 0,
        (c.type === 'FILE_CARD') ? 1 : 0,
        Math.min(1, String(c.text || '').length / 4000),
        /```|function|const|class|import/.test(String(c.text || '').toLowerCase()) ? 1 : 0,
        /(sandbox:\/|\/mnt\/data\/|\.pdf|\.zip|\.docx)/i.test(String(c.text || '')) ? 1 : 0
      ];
      const e = Array.from(emb.vectors[idx] || []);
      return Float32Array.from([...base, ...e]);
    });
    return {
      vectors,
      embeddingMeta: {
        model: emb.modelInfo,
        embeddingsCount: vectors.length,
        embeddingMs: Math.round(performance.now() - started)
      }
    };
  }

  self.AgentFeatureExtractor = { toVectors };
})();
