// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('flight recorder v3 defines required fields and ring buffer', () => {
  const src = fs.readFileSync('diagnostics/flight_recorder.js', 'utf8');
  for (const token of ['ts:', 'lvl:', 'event:', 'runId:', 'eventId:', 'tabScope:', 'platform:', 'module:', 'phase:', 'result:', 'reason:', 'MAX_EVENTS = 5000']) {
    assert.match(src, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('safe key telemetry is gated and does not log raw key value', () => {
  const src = fs.readFileSync('script.js', 'utf8');
  assert.match(src, /check-safe-key-telemetry/);
  assert.match(src, /keyClassForEvent/);
  assert.doesNotMatch(src, /\bkey:\s*e\.key\b/);
});

test('redaction module removes bearer and jwt patterns', () => {
  const src = fs.readFileSync('diagnostics/redact.js', 'utf8');
  assert.match(src, /REDACTED_BEARER/);
  assert.match(src, /REDACTED_JWT/);
});
