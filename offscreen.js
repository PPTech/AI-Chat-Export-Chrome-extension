// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// offscreen.js - Hidden Local Agent Bridge v0.10.18

(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
