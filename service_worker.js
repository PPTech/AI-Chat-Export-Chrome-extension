// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// service_worker.js - ChatGPT DOM Discovery Bridge v0.12.14

const CHATGPT_MATCH = [/^https:\/\/chat\.openai\.com\//i, /^https:\/\/chatgpt\.com\//i];

function isSupportedChatGptUrl(url = '') {
  return CHATGPT_MATCH.some((re) => re.test(String(url || '')));
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
}

async function sendAnalyze(tabId, mode) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'ANALYZE_CHATGPT_DOM', mode }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, status: 'FAIL', error: chrome.runtime.lastError.message || 'runtime_error' });
        return;
      }
      resolve(response || { success: false, status: 'FAIL', error: 'empty_response' });
    });
  });
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'RUN_CHATGPT_DOM_ANALYSIS') return false;

  (async () => {
    const tab = await getActiveTab();
    if (!tab?.id || !isSupportedChatGptUrl(tab.url || '')) {
      sendResponse({ success: false, status: 'FAIL', error: 'Open ChatGPT (chatgpt.com/chat.openai.com) first.' });
      return;
    }

    const mode = request.mode === 'full' ? 'full' : 'visible';
    const result = await sendAnalyze(tab.id, mode);
    sendResponse(result);
  })().catch((error) => {
    sendResponse({ success: false, status: 'FAIL', error: error.message || String(error) });
  });

  return true;
});
