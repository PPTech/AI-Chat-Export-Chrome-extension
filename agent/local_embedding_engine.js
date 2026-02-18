// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// agent/local_embedding_engine.js - Local embedding wrapper v0.11.5

(function () {
  class LocalEmbeddingEngine {
    constructor() {
      this.model = null;
      this.modelInfo = { name: 'keyword-fallback', hash: 'fallback-v1', loaded: false, fallbackReason: 'model_not_initialized', dim: 16 };
      this.cache = new Map();
      this.cacheOrder = [];
      this.maxCache = 128;
    }


    async verifyIntegrity() {
      try {
        const checksumsUrl = chrome.runtime.getURL('models/minilm-l3-quantized/checksums.json');
        const checksums = await fetch(checksumsUrl).then((r) => r.json());
        const files = checksums?.files || {};
        const enc = new TextEncoder();
        for (const [file, expected] of Object.entries(files)) {
          const url = chrome.runtime.getURL(file);
          const text = await fetch(url).then((r) => r.text());
          const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(text));
          const actual = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
          if (actual !== expected) throw new Error(`checksum_mismatch:${file}`);
        }
        return { ok: true };
      } catch (error) {
        this.modelInfo = { ...this.modelInfo, loaded: false, fallbackReason: error.message || 'integrity_check_failed' };
        return { ok: false, error: error.message || 'integrity_check_failed' };
      }
    }

    async init() {
      if (this.model || !self.transformers?.pipeline) return this.modelInfo;
      const integrity = await this.verifyIntegrity();
      if (!integrity.ok) return this.modelInfo;
      self.transformers.env.allowRemoteModels = false;
      self.transformers.env.allowLocalModels = true;
      self.transformers.env.localModelPath = chrome.runtime.getURL('models/');
      this.model = await self.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
        local_files_only: true
      });
      this.modelInfo = { name: 'MiniLM-local', hash: 'Xenova/all-MiniLM-L6-v2@local', loaded: true, fallbackReason: '', dim: 384 };
      return this.modelInfo;
    }

    getCached(text) {
      const key = String(text || '').slice(0, 1024);
      return this.cache.get(key) || null;
    }

    setCached(text, vector) {
      const key = String(text || '').slice(0, 1024);
      if (this.cache.has(key)) return;
      this.cache.set(key, vector);
      this.cacheOrder.push(key);
      if (this.cacheOrder.length > this.maxCache) {
        const old = this.cacheOrder.shift();
        this.cache.delete(old);
      }
    }

    async embed(texts = []) {
      await this.init().catch(() => null);
      const vectors = [];
      for (const text of texts) {
        const norm = String(text || '').trim();
        if (!norm) {
          vectors.push(new Float32Array(16));
          continue;
        }
        const cached = this.getCached(norm);
        if (cached) {
          vectors.push(cached);
          continue;
        }
        let vector;
        if (this.model) {
          const out = await this.model(norm.slice(0, 1500), { pooling: 'mean', normalize: true });
          vector = Float32Array.from(out?.data || out || []);
        } else {
          const fallback = new Float32Array(16);
          const lower = norm.toLowerCase();
          fallback[0] = /\?/.test(lower) ? 1 : 0;
          fallback[1] = /```|function|const|import|class/.test(lower) ? 1 : 0;
          fallback[2] = /https?:\/\//.test(lower) ? 1 : 0;
          fallback[3] = /file|download|attachment|sandbox:\//.test(lower) ? 1 : 0;
          fallback[4] = Math.min(1, norm.length / 500);
          this.modelInfo = { ...this.modelInfo, loaded: false, fallbackReason: this.modelInfo.fallbackReason || 'local_transformer_unavailable', dim: 16 };
          vector = fallback;
        }
        this.setCached(norm, vector);
        vectors.push(vector);
      }
      return { vectors, modelInfo: this.modelInfo };
    }
  }

  self.LocalEmbeddingEngine = new LocalEmbeddingEngine();
})();
