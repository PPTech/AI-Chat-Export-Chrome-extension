// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// options.js - Extension Options v0.12.10

const KEY = 'local_agent_options_v1';
const plannerEnabled = document.getElementById('planner-enabled');
const debugOverlay = document.getElementById('debug-overlay');

chrome.storage.local.get([KEY], (res) => {
  const opts = res?.[KEY] || {};
  plannerEnabled.checked = !!opts.plannerEnabled;
  debugOverlay.checked = !!opts.debugOverlay;
});

document.getElementById('save').addEventListener('click', () => {
  chrome.storage.local.set({
    [KEY]: {
      plannerEnabled: plannerEnabled.checked,
      debugOverlay: debugOverlay.checked,
      updatedAt: new Date().toISOString()
    }
  });
});


document.getElementById('btn-purge-learning').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'LOCAL_PURGE_LEARNING', payload: {} }, () => {
    alert('Local learning artifacts purged.');
  });
});
