// License: AGPL-3.0
// Contract test for diagnostics v4 flight recorder (full JSONL schema).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightRecorder, redactUrl, scanForLeaks, redactSecrets } from '../../lib/diagnostics.mjs';

test('flight recorder emits required v4 fields', () => {
  const recorder = createFlightRecorder({ runId: 'test-run-1', tabId: 42, toolVersion: '0.12.1', platform: 'chatgpt' });
  recorder.record({ lvl: 'INFO', event: 'extraction.start', module: 'content', phase: 'detect', result: 'ok', details: { strategy: 'ssot' } });
  recorder.record({ lvl: 'INFO', event: 'extraction.end', module: 'content', phase: 'collect', result: 'ok', details: { messages_found: 10 } });

  const diag = recorder.finish({ messages_total: 10, messages_unknown: 0 });

  assert.equal(diag.schema_version, 'diagnostics.v4');
  assert.equal(diag.run.run_id, 'test-run-1');
  assert.equal(diag.run.platform, 'chatgpt');
  assert.ok(diag.run.started_at_utc);
  assert.ok(diag.run.ended_at_utc);
  assert.equal(diag.tabScope, 'tab:42');
  assert.equal(diag.entries.length, 2);
  assert.ok(diag.scorecard);
  assert.equal(diag.scorecard.messages_total, 10);
  assert.equal(diag.scorecard.unknown_role_pass, true);
});

test('flight recorder entry has full JSONL schema fields', () => {
  const recorder = createFlightRecorder({ runId: 'r2', tabId: 7, platform: 'gemini' });
  const entry = recorder.record({ lvl: 'DEBUG', event: 'test.stage', module: 'export', phase: 'assemble', result: 'ok', details: { detail: 'info' } });

  assert.equal(entry.runId, 'r2');
  assert.equal(entry.tabScope, 'tab:7');
  assert.equal(entry.lvl, 'DEBUG');
  assert.equal(entry.event, 'test.stage');
  assert.ok(entry.eventId, 'must have eventId');
  assert.equal(entry.parentEventId, null);
  assert.equal(entry.platform, 'gemini');
  assert.equal(entry.module, 'export');
  assert.equal(entry.phase, 'assemble');
  assert.equal(entry.result, 'ok');
  assert.ok(entry.ts);
});

test('record with parentEventId links events', () => {
  const recorder = createFlightRecorder({ runId: 'r3', tabId: 1 });
  const parent = recorder.record({ event: 'parent.event', module: 'content' });
  const child = recorder.record({ event: 'child.event', parentEventId: parent.eventId, module: 'content' });

  assert.equal(child.parentEventId, parent.eventId);
});

test('toJsonl produces one JSON object per line', () => {
  const recorder = createFlightRecorder({ runId: 'r4', tabId: 1 });
  recorder.record({ event: 'a' });
  recorder.record({ event: 'b' });

  const jsonl = recorder.toJsonl();
  const lines = jsonl.split('\n');
  assert.equal(lines.length, 2);
  // Each line must be valid JSON
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.ok(parsed.eventId);
    assert.ok(parsed.runId);
  }
});

test('ring buffer limits entries to MAX_RING_BUFFER', () => {
  const recorder = createFlightRecorder({ runId: 'r5', tabId: 1 });
  for (let i = 0; i < 2100; i++) {
    recorder.record({ event: `event.${i}` });
  }
  assert.ok(recorder.entries.length <= 2000);
});

test('redactUrl produces scheme/host/pathHash (no full URL)', () => {
  const result = redactUrl('https://chatgpt.com/c/abc-123?token=secret');
  assert.equal(result.scheme, 'https:');
  assert.equal(result.host, 'chatgpt.com');
  assert.ok(result.pathHash);
  assert.equal(result.pathHash.length, 12);
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
  const recorder = createFlightRecorder({ runId: 'r6', tabId: 1 });
  const diag = recorder.finish({ messages_total: 10, messages_unknown: 2 });
  assert.equal(diag.scorecard.unknown_role_pass, false);
  assert.equal(diag.scorecard.unknown_role_ratio, 0.2);
});

test('scorecard passes when unknown_role_ratio <= 5%', () => {
  const recorder = createFlightRecorder({ runId: 'r7', tabId: 1 });
  const diag = recorder.finish({ messages_total: 100, messages_unknown: 5 });
  assert.equal(diag.scorecard.unknown_role_pass, true);
});

test('recordUrlEvent emits redacted URL info with module/phase', () => {
  const recorder = createFlightRecorder({ runId: 'r8', tabId: 1 });
  recorder.recordUrlEvent('asset.fetch', 'https://cdn.example.com/path/to/file.png', { result: 'deny', module: 'assets', phase: 'resolve' });

  const entry = recorder.entries[0];
  assert.equal(entry.module, 'assets');
  assert.equal(entry.phase, 'resolve');
  assert.equal(entry.result, 'deny');
  assert.ok(entry.details.scheme);
  assert.ok(entry.details.host);
  assert.ok(entry.details.pathHash);
  // Full URL must not appear
  const serialized = JSON.stringify(entry);
  assert.ok(!serialized.includes('/path/to/file.png'));
});
