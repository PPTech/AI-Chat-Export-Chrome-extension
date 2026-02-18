// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// offscreen.js - Hidden Local Agent Bridge v0.10.20

(() => {
  const allowPrefixes = ['chrome-extension://', 'blob:', 'data:'];

  function assertLocal(url) {
    const u = String(url || '');
    if (allowPrefixes.some((p) => u.startsWith(p))) return;
    console.warn(`Blocked outbound attempt to ${u} - Local Mode Enforced.`);
    throw new Error(`Blocked outbound attempt to ${u} - Local Mode Enforced.`);
  }

  function patchLocalOnlyGuards() {
    const nativeFetch = self.fetch?.bind(self);
    if (nativeFetch) {
      self.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        assertLocal(url);
        return nativeFetch(input, init);
      };
    }
    const XHR = self.XMLHttpRequest;
    if (XHR) {
      const open = XHR.prototype.open;
      XHR.prototype.open = function patchedOpen(method, url, ...rest) {
        assertLocal(url);
        return open.call(this, method, url, ...rest);
      };
    }
  }

  patchLocalOnlyGuards();

  let classifierReady = false;
  let featureExtractor = null;

  async function initLocalClassifier() {
    if (classifierReady) return { ready: true, model: featureExtractor ? 'MiniLM-local' : 'keyword-fallback' };
    classifierReady = true;
    try {
      if (self.transformers?.pipeline) {
        self.transformers.env.allowRemoteModels = false;
        self.transformers.env.allowLocalModels = true;
        self.transformers.env.localModelPath = chrome.runtime.getURL('models/');
        featureExtractor = await self.transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          quantized: true,
          local_files_only: true
        });
      }
    } catch (error) {
      console.warn('[OFFSCREEN] Local transformer unavailable, fallback active:', error?.message || error);
      featureExtractor = null;
    }
    return { ready: true, model: featureExtractor ? 'MiniLM-local' : 'keyword-fallback' };
  }

  function classifyByRules(text = '') {
    const t = String(text || '');
    const lower = t.toLowerCase();
    const tags = [];
    if (/\?|\b(why|how|what|when|where|can you|could you|please explain)\b/i.test(t)) tags.push('Question');
    if (/```|\b(function|class|def|import|return|const|let|var|=>|SELECT\s+.+\s+FROM)\b/i.test(t)) tags.push('Code');
    if (/sandbox:\/|sandbox:\/\/|\/mnt\/data\/|\.(csv|pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|md|txt|json)\b/i.test(lower)) tags.push('File Attachment');
    return tags.length ? tags : ['General'];
  }

  function detectArtifacts(text = '') {
    const refs = new Set();
    const regex = /(sandbox:\/\/[\w./%-]+|sandbox:\/[\w./%-]+|\/mnt\/data\/[\w./%-]+|https?:\/\/[^\s"')]+\.(?:csv|pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|md|txt|json))/gi;
    let m;
    while ((m = regex.exec(String(text || ''))) !== null) refs.add(m[1]);
    return Array.from(refs);
  }

  async function classifyTextPayload(payload = {}) {
    const text = String(payload.text || '');
    const artifacts = detectArtifacts(text);
    const tags = classifyByRules(text);
    let embeddingPreview = null;

    if (featureExtractor && text.trim()) {
      try {
        const vec = await featureExtractor(text.slice(0, 1500), { pooling: 'mean', normalize: true });
        const arr = Array.isArray(vec?.data) ? vec.data : (Array.isArray(vec) ? vec : []);
        embeddingPreview = arr.slice(0, 8);
      } catch (error) {
        console.warn('[OFFSCREEN] Embedding failed, continuing fallback:', error?.message || error);
      }
    }

    return {
      ok: true,
      tags,
      artifacts,
      model: featureExtractor ? 'MiniLM-local' : 'keyword-fallback',
      embeddingPreview
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === 'OFFSCREEN_INIT_CLASSIFIER') {
      initLocalClassifier().then(sendResponse).catch((e) => sendResponse({ ready: false, error: e.message }));
      return true;
    }
    if (msg?.action === 'OFFSCREEN_CLASSIFY_TEXT') {
      classifyTextPayload(msg.payload || {}).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === 'OFFSCREEN_DETECT_ARTIFACTS') {
      try {
        const artifacts = detectArtifacts(msg?.payload?.text || '');
        sendResponse({ ok: true, artifacts });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
    if (msg?.action === 'OFFSCREEN_RUN_AGENT') {
      LocalAIEngine.runIntelligentExtraction(msg.payload || {}).then(sendResponse);
      return true;
    }
    if (msg?.action === 'OFFSCREEN_PUT_RECIPE') {
      RecipesStore.putRecipe(msg.recipe).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.action === 'OFFSCREEN_GET_RECIPES') {
      RecipesStore.getRecipesByHost(msg.host).then((recipes) => sendResponse({ ok: true, recipes })).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    return false;
  });
})();
