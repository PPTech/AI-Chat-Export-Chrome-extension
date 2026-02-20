// License: AGPL-3.0
// diagnostics.mjs - Flight recorder v4 with full JSONL schema
// Every JSONL line: ts, lvl, event, runId, eventId, parentEventId,
// tabScope, platform, module, phase, result, details (redacted).
// MUST NOT contain: tokens, JWT, Bearer, API keys, full URLs, raw chat text.

import { createHash, randomUUID } from 'node:crypto';

const LEAK_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /sk-[A-Za-z0-9]{20,}/g,  // OpenAI API key
  /token[=:]\s*["']?[A-Za-z0-9._~+/=-]{20,}/gi,
  /api[_-]?key[=:]\s*["']?[A-Za-z0-9._~+/=-]{16,}/gi,
  /Authorization:\s*\S{20,}/gi,
];

const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const MAX_RING_BUFFER = 2000;

/**
 * Create a new diagnostics flight recorder session.
 * @param {Object} opts
 * @param {string} opts.runId
 * @param {number|null} opts.tabId
 * @param {string} [opts.toolVersion]
 * @param {string} [opts.platform]
 */
export function createFlightRecorder({ runId, tabId, toolVersion, platform }) {
  const entries = [];
  const startedAt = new Date().toISOString();
  let eventCounter = 0;

  function makeEventId() {
    eventCounter++;
    try { return randomUUID(); } catch { return `${runId}-${eventCounter}`; }
  }

  /**
   * Record a flight recorder entry with full JSONL schema.
   * @param {Object} opts
   * @param {string} opts.lvl - TRACE|DEBUG|INFO|WARN|ERROR|CRITICAL
   * @param {string} opts.event - Taxonomy string (e.g. 'extraction.start')
   * @param {string} [opts.parentEventId]
   * @param {string} [opts.module] - popup|sw|content|export|assets|ui
   * @param {string} [opts.phase] - detect|collect|resolve|embed|assemble|finalize
   * @param {string} [opts.result] - ok|fail|deny|skip
   * @param {Object} [opts.details] - Additional redacted data
   * @returns {Object} The recorded entry (with eventId)
   */
  function record({ lvl = 'INFO', event, parentEventId, module, phase, result, details } = {}) {
    const eventId = makeEventId();
    const entry = {
      ts: Date.now(),
      lvl: LEVELS.includes(lvl) ? lvl : 'INFO',
      event: event || 'unknown',
      runId,
      eventId,
      parentEventId: parentEventId || null,
      tabScope: tabId != null ? `tab:${tabId}` : 'global',
      platform: platform || 'unknown',
      module: module || 'unknown',
      phase: phase || 'unknown',
      result: result || null,
      details: details ? redactEntry(details) : null,
    };
    entries.push(entry);
    // Ring buffer: drop oldest if exceeding max
    if (entries.length > MAX_RING_BUFFER) entries.shift();
    return entry;
  }

  /**
   * Convenience: record with stage name (backwards-compatible).
   */
  function recordStage(stage, data = {}) {
    return record({
      lvl: 'INFO',
      event: stage,
      module: data.module,
      phase: data.phase,
      result: data.result,
      details: data,
    });
  }

  /**
   * Record a URL event with redacted URL info.
   */
  function recordUrlEvent(event, url, extra = {}) {
    const redacted = redactUrl(url);
    return record({
      lvl: extra.lvl || 'DEBUG',
      event,
      module: extra.module || 'assets',
      phase: extra.phase || 'resolve',
      result: extra.result || null,
      details: { ...redacted, ...extra },
    });
  }

  /**
   * Finalize the flight recorder session.
   * Returns the full diagnostics object.
   */
  function finish(counts = {}, failures = []) {
    const endedAt = new Date().toISOString();
    const diagnostics = {
      schema_version: 'diagnostics.v4',
      run: {
        run_id: runId,
        started_at_utc: startedAt,
        ended_at_utc: endedAt,
        tool_version: toolVersion || 'unknown',
        platform: platform || 'unknown',
      },
      tabScope: tabId != null ? `tab:${tabId}` : 'global',
      entries,
      counts,
      failures: failures.map((f) => redactEntry(f)),
      scorecard: buildScorecard(counts),
    };

    // Final leak scan
    const serialized = JSON.stringify(diagnostics);
    const leaks = scanForLeaks(serialized);
    if (leaks.length > 0) {
      diagnostics._leak_warning = `${leaks.length} potential secret(s) detected and redacted`;
      return JSON.parse(redactSecrets(serialized));
    }

    return diagnostics;
  }

  /**
   * Export entries as JSONL string (one JSON object per line).
   */
  function toJsonl() {
    return entries.map((e) => JSON.stringify(e)).join('\n');
  }

  return { record, recordStage, recordUrlEvent, finish, toJsonl, entries };
}

// --- Public utilities ---

export function redactUrl(url) {
  try {
    const u = new URL(url);
    return {
      scheme: u.protocol,
      host: u.hostname,
      pathHash: hashString(u.pathname + u.search).slice(0, 12),
    };
  } catch {
    const scheme = url?.match?.(/^([a-z][a-z0-9+.-]*:)/i)?.[1] || 'unknown:';
    return {
      scheme,
      host: '(invalid)',
      pathHash: hashString(String(url)).slice(0, 12),
    };
  }
}

export function scanForLeaks(text) {
  const leaks = [];
  for (const pattern of LEAK_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      leaks.push({
        pattern: pattern.source.slice(0, 30),
        sample: match[0].slice(0, 8) + '...[REDACTED]',
      });
    }
  }
  return leaks;
}

export function redactSecrets(text) {
  let result = text;
  for (const pattern of LEAK_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// --- Internal helpers ---

function redactEntry(data) {
  if (!data || typeof data !== 'object') return data;
  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 200) {
      redacted[key] = value.slice(0, 100) + '...[truncated]';
    } else if (typeof value === 'string') {
      redacted[key] = redactSecrets(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function buildScorecard(counts) {
  const total = counts.messages_total || 0;
  const unknown = counts.messages_unknown || 0;
  const unknownRatio = total > 0 ? unknown / total : 0;
  return {
    messages_total: total,
    unknown_role_ratio: Number(unknownRatio.toFixed(4)),
    unknown_role_pass: unknownRatio <= 0.05,
    has_messages: total > 0,
  };
}

function hashString(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}
