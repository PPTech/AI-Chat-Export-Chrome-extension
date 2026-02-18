// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// network_policy.js - Unified Network Policy & Gesture Proof v0.12.16

(() => {
  const CATEGORIES = Object.freeze({
    AI_INFERENCE: 'AI_INFERENCE',
    ASSET_FETCH: 'ASSET_FETCH',
    LEGACY_FALLBACK: 'LEGACY_FALLBACK'
  });

  const HOST_ALLOWLIST = [
    'chatgpt.com', 'chat.openai.com', 'oaiusercontent.com', 'oaistatic.com', 'openai.com',
    'claude.ai', 'anthropic.com', 'googleusercontent.com', 'gstatic.com', 'google.com', 'lh3.google.com'
  ];

  const gestureStore = new Map();
  const GESTURE_TTL_MS = 10_000;

  function now() { return Date.now(); }

  function registerGesture(token, sender = 'unknown') {
    if (!token) return { ok: false, reason: 'missing_token' };
    gestureStore.set(String(token), { ts: now(), sender: String(sender || 'unknown') });
    return { ok: true, ts: gestureStore.get(String(token)).ts };
  }

  function validateGesture(token) {
    const row = gestureStore.get(String(token || ''));
    if (!row) return { ok: false, reason: 'missingGesture' };
    if ((now() - row.ts) > GESTURE_TTL_MS) {
      gestureStore.delete(String(token));
      return { ok: false, reason: 'gestureExpired' };
    }
    return { ok: true, ageMs: now() - row.ts, sender: row.sender };
  }

  function isAllowedHost(url) {
    try {
      const host = new URL(url).hostname;
      return HOST_ALLOWLIST.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  async function hasHostPermission(url) {
    try {
      const u = new URL(url);
      const origin = `${u.protocol}//${u.hostname}/*`;
      return await new Promise((resolve) => {
        chrome.permissions.contains({ origins: [origin] }, (ok) => resolve(!!ok));
      });
    } catch {
      return false;
    }
  }

  async function validateAssetRequest({ url, category, gestureToken }) {
    if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, reason: 'unsupportedScheme' };
    if (category === CATEGORIES.AI_INFERENCE) return { ok: false, reason: 'aiNetworkForbidden' };
    const gesture = validateGesture(gestureToken);
    if (!gesture.ok) return { ok: false, reason: gesture.reason };
    if (!isAllowedHost(url)) return { ok: false, reason: 'hostNotAllowlisted' };
    const permitted = await hasHostPermission(url);
    if (!permitted) return { ok: false, reason: 'permissionsMissing' };
    return { ok: true, gesture };
  }

  globalThis.NetworkPolicyToolkit = {
    CATEGORIES,
    HOST_ALLOWLIST,
    registerGesture,
    validateGesture,
    validateAssetRequest,
    isAllowedHost
  };
})();
