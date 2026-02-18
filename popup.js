// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// popup.js - Prometheus Popup Bridge v0.12.8

(() => {
  if (window.PrometheusPopupBridge) return;

  async function sendRuntime(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message || 'runtime_error' });
          return;
        }
        resolve(res || { success: false, error: 'empty_response' });
      });
    });
  }

  async function exportPrometheusMhtml(tabId) {
    const extraction = await sendRuntime({ action: 'RUN_PROMETHEUS_EXPORT', tabId });
    if (!extraction?.success) return extraction;
    return extraction;
  }

  window.PrometheusPopupBridge = { exportPrometheusMhtml };
})();
