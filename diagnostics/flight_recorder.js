// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// diagnostics/flight_recorder.js - Flight Recorder v0.12.20

(function initFlightRecorder(globalObj) {
  const MAX_EVENTS = 5000;
  const ring = [];

  const defaults = {
    debugLogging: false,
    includeRedactedPreviews: false,
    persistLogs: false,
    safeKeyTelemetry: false
  };

  let cfg = { ...defaults };
  let activeRunId = null;

  function now() { return Date.now(); }
  function uuid() {
    if (globalObj.crypto?.randomUUID) return globalObj.crypto.randomUUID();
    return `evt_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  async function hashText(input = '') {
    if (globalObj.RedactionToolkit?.sha256Hex) return globalObj.RedactionToolkit.sha256Hex(String(input || ''));
    const data = new TextEncoder().encode(String(input || ''));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function redactPayload(payload) {
    if (!payload) return payload;
    if (globalObj.RedactionToolkit?.redactValue) return globalObj.RedactionToolkit.redactValue(payload);
    return payload;
  }

  function startRun() {
    activeRunId = uuid();
    return activeRunId;
  }

  function getRunId() {
    return activeRunId || startRun();
  }

  async function push(evt) {
    if (!cfg.debugLogging) return null;
    const safe = await redactPayload(evt);
    ring.push(safe);
    if (ring.length > MAX_EVENTS) ring.shift();
    if (cfg.persistLogs && globalObj.chrome?.storage?.local) {
      try { globalObj.chrome.storage.local.set({ diagnostics_v3_ring: ring.slice(-MAX_EVENTS) }); } catch {}
    }
    return safe;
  }

  async function record(input = {}) {
    const rec = {
      ts: now(),
      lvl: input.lvl || 'INFO',
      event: input.event || 'unknown',
      runId: input.runId || getRunId(),
      eventId: input.eventId || uuid(),
      parentEventId: input.parentEventId || null,
      tabId: input.tabId ?? null,
      tabScope: input.tabId == null ? (input.tabScope || 'global') : (input.tabScope || 'tab'),
      platform: input.platform || 'unknown',
      module: input.module || 'unknown',
      phase: input.phase || 'detect',
      durationMs: input.durationMs ?? null,
      result: input.result || 'ok',
      reason: input.reason || 'none'
    };
    if (rec.tabId == null) delete rec.tabId;
    return push(rec);
  }

  function exportJsonl() {
    return ring.map((r) => JSON.stringify(r)).join('\n');
  }

  function getRing() { return ring.slice(); }
  function clear() { ring.length = 0; }
  function configure(next = {}) { cfg = { ...cfg, ...next }; return { ...cfg }; }
  function config() { return { ...cfg }; }

  async function sanitizeNetworkUrl(url = '') {
    try {
      const u = new URL(String(url || ''));
      return {
        scheme: u.protocol.replace(':', ''),
        host: u.hostname,
        pathHash: await hashText(`${u.pathname}?${u.searchParams.toString()}`),
        hasQuery: !!u.search,
      };
    } catch {
      return { scheme: 'unknown', host: 'unknown', pathHash: await hashText(String(url || '')), hasQuery: false };
    }
  }

  globalObj.FlightRecorderToolkit = {
    startRun,
    getRunId,
    record,
    getRing,
    exportJsonl,
    clear,
    configure,
    config,
    sanitizeNetworkUrl,
    hashText
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
