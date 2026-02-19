// License: MIT
// diagnostics.mjs - Flight recorder v3 with redacted diagnostics
// Emits JSONL entries for every significant pipeline event.
// MUST contain: runId, tabId/tabScope, scheme/host/pathHash (no full URL),
// denial reasons, strategy.
// MUST NOT contain: tokens, JWT, Bearer, API keys, full URLs.

import { createHash } from 'node:crypto';

const LEAK_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /sk-[A-Za-z0-9]{20,}/g,  // OpenAI API key
  /token[=:]\s*["']?[A-Za-z0-9._~+/=-]{20,}/gi,
  /api[_-]?key[=:]\s*["']?[A-Za-z0-9._~+/=-]{16,}/gi,
  /Authorization:\s*\S{20,}/gi,
];

/**
 * Create a new diagnostics flight recorder session.
 */
export function createFlightRecorder({ runId, tabId, toolVersion }) {
  const entries = [];
  const startedAt = new Date().toISOString();

  function record(stage, data = {}) {
    const entry = {
      ts: new Date().toISOString(),
      runId,
      tabScope: tabId != null ? `tab:${tabId}` : 'global',
      stage,
      ...redactEntry(data),
    };
    entries.push(entry);
    return entry;
  }

  function recordUrlEvent(stage, url, extra = {}) {
    const redacted = redactUrl(url);
    record(stage, { ...redacted, ...extra });
  }

  function finish(counts = {}, failures = []) {
    const endedAt = new Date().toISOString();
    const diagnostics = {
      schema_version: 'diagnostics.v3',
      run: {
        run_id: runId,
        started_at_utc: startedAt,
        ended_at_utc: endedAt,
        tool_version: toolVersion || 'unknown',
      },
      tabScope: tabId != null ? `tab:${tabId}` : 'global',
      entries,
      counts,
      failures: failures.map((f) => redactEntry(f)),
      scorecard: buildScorecard(counts),
    };

    // Final leak scan on the entire output
    const serialized = JSON.stringify(diagnostics);
    const leaks = scanForLeaks(serialized);
    if (leaks.length > 0) {
      diagnostics._leak_warning = `${leaks.length} potential secret(s) detected and redacted`;
      // Re-serialize with redacted values
      return JSON.parse(redactSecrets(serialized));
    }

    return diagnostics;
  }

  return { record, recordUrlEvent, finish, entries };
}

/**
 * Redact a URL to scheme + host + path hash (no full URL in logs).
 */
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

/**
 * Scan a string for potential secret leaks.
 * Returns array of { pattern, sample } for each match found.
 */
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

/**
 * Remove secrets from serialized diagnostics output.
 */
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
