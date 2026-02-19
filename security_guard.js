// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// security_guard.js - AEGIS Iron Dome v0.11.1

(() => {
  const ALLOW_PREFIXES = ['blob:', 'data:', 'chrome-extension://'];
  const metrics = { securityBlocks: 0 };

  function isAllowed(url) {
    const u = String(url || '');
    return ALLOW_PREFIXES.some((prefix) => u.startsWith(prefix));
  }

  function block(url) {
    metrics.securityBlocks += 1;
    const msg = `Blocked outbound attempt to ${String(url || '')} - AEGIS Protocol Active.`;
    console.warn(msg);
    throw new Error(msg);
  }

  function installNetworkKillSwitch(scope = window) {
    const nativeFetch = scope.fetch?.bind(scope);
    if (nativeFetch) {
      scope.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        if (!isAllowed(url)) return block(url);
        return nativeFetch(input, init);
      };
    }

    const XHR = scope.XMLHttpRequest;
    if (XHR?.prototype?.open) {
      const open = XHR.prototype.open;
      XHR.prototype.open = function patchedOpen(method, url, ...rest) {
        if (!isAllowed(url)) return block(url);
        return open.call(this, method, url, ...rest);
      };
    }
  }

  function freezeExtractionObject(extracted) {
    // 2026 AI Standard: anti-tamper freeze prevents injected scripts from mutating extraction post-processing.
    return Object.freeze(extracted);
  }

  const api = { installNetworkKillSwitch, freezeExtractionObject, metrics, isAllowed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SecurityGuard = api;
})();
