// License: MIT
// Contract test for diagnostics v3 flight recorder.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightRecorder, redactUrl, scanForLeaks, redactSecrets } from '../../lib/diagnostics.mjs';

test('flight recorder emits required fields', () => {
  const recorder = createFlightRecorder({ runId: 'test-run-1', tabId: 42, toolVersion: '0.11.0' });
  recorder.record('extraction_start', { strategy: 'ssot' });
  recorder.record('extraction_end', { messages_found: 10 });

  const diag = recorder.finish({ messages_total: 10, messages_unknown: 0 });

  assert.equal(diag.schema_version, 'diagnostics.v3');
  assert.equal(diag.run.run_id, 'test-run-1');
  assert.ok(diag.run.started_at_utc);
  assert.ok(diag.run.ended_at_utc);
  assert.equal(diag.tabScope, 'tab:42');
  assert.equal(diag.entries.length, 2);
  assert.ok(diag.scorecard);
  assert.equal(diag.scorecard.messages_total, 10);
  assert.equal(diag.scorecard.unknown_role_pass, true);
});

test('flight recorder entry contains runId and tabScope', () => {
  const recorder = createFlightRecorder({ runId: 'r2', tabId: 7 });
  const entry = recorder.record('test_stage', { detail: 'info' });

  assert.equal(entry.runId, 'r2');
  assert.equal(entry.tabScope, 'tab:7');
  assert.equal(entry.stage, 'test_stage');
  assert.ok(entry.ts);
});

test('redactUrl produces scheme/host/pathHash (no full URL)', () => {
  const result = redactUrl('https://chatgpt.com/c/abc-123?token=secret');
  assert.equal(result.scheme, 'https:');
  assert.equal(result.host, 'chatgpt.com');
  assert.ok(result.pathHash);
  assert.equal(result.pathHash.length, 12);
  // Must not contain the full path
  assert.ok(!result.pathHash.includes('abc-123'));
});

test('redactUrl handles data: URLs', () => {
  const result = redactUrl('data:image/png;base64,abc');
  assert.equal(result.scheme, 'data:');
});

test('redactUrl handles blob: URLs', () => {
  const result = redactUrl('blob:https://chatgpt.com/abc');
  assert.equal(result.scheme, 'blob:');
  assert.equal(result.host, 'chatgpt.com');
});

test('redactUrl handles invalid URLs', () => {
  const result = redactUrl('not-a-url');
  assert.equal(result.host, '(invalid)');
  assert.ok(result.pathHash);
});

test('scanForLeaks detects Bearer tokens', () => {
  const leaks = scanForLeaks('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');
  assert.ok(leaks.length > 0, 'should detect JWT/Bearer');
});

test('scanForLeaks detects API keys', () => {
  const leaks = scanForLeaks('api_key="sk-proj-1234567890abcdef1234567890"');
  assert.ok(leaks.length > 0, 'should detect API key');
});

test('scanForLeaks returns empty for clean text', () => {
  const leaks = scanForLeaks('Hello world, this is a normal message');
  assert.equal(leaks.length, 0);
});

test('redactSecrets removes Bearer tokens from text', () => {
  const input = 'Token: Bearer sk-1234567890abcdefghijklmnop';
  const result = redactSecrets(input);
  assert.ok(!result.includes('sk-1234567890'));
  assert.ok(result.includes('[REDACTED]'));
});

test('scorecard fails when unknown_role_ratio > 5%', () => {
  const recorder = createFlightRecorder({ runId: 'r3', tabId: 1 });
  const diag = recorder.finish({ messages_total: 10, messages_unknown: 2 });
  assert.equal(diag.scorecard.unknown_role_pass, false);
  assert.equal(diag.scorecard.unknown_role_ratio, 0.2);
});

test('scorecard passes when unknown_role_ratio <= 5%', () => {
  const recorder = createFlightRecorder({ runId: 'r4', tabId: 1 });
  const diag = recorder.finish({ messages_total: 100, messages_unknown: 5 });
  assert.equal(diag.scorecard.unknown_role_pass, true);
});

test('recordUrlEvent emits redacted URL info', () => {
  const recorder = createFlightRecorder({ runId: 'r5', tabId: 1 });
  recorder.recordUrlEvent('fetch_attempt', 'https://cdn.example.com/path/to/file.png', { status: 'blocked' });

  const entry = recorder.entries[0];
  assert.equal(entry.scheme, 'https:');
  assert.equal(entry.host, 'cdn.example.com');
  assert.ok(entry.pathHash);
  assert.equal(entry.status, 'blocked');
  // Full URL must not appear in the entry
  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes('/path/to/file.png'));
});
