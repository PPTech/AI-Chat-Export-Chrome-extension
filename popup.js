// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// popup.js - Prometheus Popup Bridge + DOM Analyzer UI v0.12.14

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

  function updateStatus(text) {
    const pre = document.getElementById('status');
    if (pre) pre.textContent = text;
  }

  async function runDomAnalysis(mode = 'visible') {
    updateStatus(`Running analyze (${mode}) ...`);
    const res = await sendRuntime({ action: 'RUN_CHATGPT_DOM_ANALYSIS', mode });
    if (!res?.success) {
      updateStatus(`FAIL: ${res?.error || 'analysis failed'}`);
      return;
    }
    const report = res.report || {};
    const role = report.roleCounts || {};
    updateStatus([
      `Status: ${res.status}`,
      `Root confidence: ${report.root?.confidence ?? 0}`,
      `Messages: ${report.messageCount ?? 0}`,
      `Roles: user=${role.user || 0} assistant=${role.assistant || 0} unknown=${role.unknown || 0}`
    ].join('\n'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnVisible = document.getElementById('btn-analyze-visible');
    const btnFull = document.getElementById('btn-analyze-full');
    if (btnVisible) btnVisible.addEventListener('click', () => runDomAnalysis('visible'));
    if (btnFull) btnFull.addEventListener('click', () => runDomAnalysis('full'));
  });
})();
