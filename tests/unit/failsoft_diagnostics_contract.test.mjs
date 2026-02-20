// License: AGPL-3.0
// Contract tests for: A) fail-soft, B) always-on diagnostics, C) smart logger, D) gesture, E) version SSOT.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

// A) FAIL-SOFT EXPORT
test('A) export handler catches per-format errors (fail-soft)', () => {
  // The export handler must try/catch each format independently
  assert.ok(
    scriptContent.includes('export.format.fail'),
    'Must record per-format failure events'
  );
  assert.ok(
    scriptContent.includes('formatErrors'),
    'Must track format errors array'
  );
  assert.ok(
    scriptContent.includes('export_bundle_manifest.json'),
    'Must always emit export_bundle_manifest.json'
  );
  assert.ok(
    scriptContent.includes('export-bundle-manifest.v1'),
    'Manifest must have schema version'
  );
});

test('A) fail-soft: partial export shows info, not fatal error', () => {
  assert.ok(
    scriptContent.includes('Partial Export'),
    'Must show Partial Export info on format failures'
  );
});

// B) DIAGNOSTICS MUST ALWAYS EXIST
test('B) flight recorder is ALWAYS created (not gated by debug)', () => {
  // The recorder creation must not be conditional on debug mode
  assert.ok(
    scriptContent.includes('createPopupFlightRecorder(runId, currentChatData.platform, debug)'),
    'Recorder must always be created with verbose flag, not conditionally null'
  );
  // Must NOT have "debug ? createPopupFlightRecorder... : null"
  assert.ok(
    !scriptContent.includes('debug ? createPopupFlightRecorder'),
    'Recorder must NOT be conditionally null based on debug mode'
  );
});

test('B) diagnostics_summary.json always included in ZIP', () => {
  assert.ok(
    scriptContent.includes('diagnostics_summary.json'),
    'Must always include diagnostics_summary.json in ZIP'
  );
});

test('B) lastDiagnostics always set after export', () => {
  // The finish() call must be outside any debug conditional
  assert.ok(
    scriptContent.includes('lastDiagnostics = recorder.finish('),
    'lastDiagnostics must always be set from recorder.finish()'
  );
});

test('B) diagnostics button always visible', () => {
  assert.ok(
    scriptContent.includes("btnDownloadDiagnostics) btnDownloadDiagnostics.style.display = 'block'"),
    'Diagnostics button must always be visible'
  );
});

// C) DEBUG MODE = SMART LOGGER
test('C) recorder tracks event tree with parentEventId', () => {
  assert.ok(
    scriptContent.includes('parentEventId: exportStartEvent.eventId'),
    'Child events must link to parent via parentEventId'
  );
});

test('C) invariant checks run inline during export', () => {
  assert.ok(
    scriptContent.includes('export.invariants'),
    'Must record invariant check results as an event'
  );
});

test('C) anomalyScore 0..100 computed in finish()', () => {
  assert.ok(
    scriptContent.includes('anomalyScore'),
    'Must compute anomalyScore in diagnostics'
  );
  assert.ok(
    scriptContent.includes('Math.min(100,'),
    'anomalyScore must be capped at 100'
  );
});

test('C) verbose flag controls detail level', () => {
  assert.ok(
    scriptContent.includes("details: verbose ?"),
    'Verbose flag must control whether details are included'
  );
});

// D) USER GESTURE GUARANTEE
test('D) gestureToken uses time-based TTL', () => {
  assert.ok(
    scriptContent.includes('GESTURE_TTL_MS'),
    'Must define gesture token TTL'
  );
  assert.ok(
    scriptContent.includes('_gestureTokenTs'),
    'Must track gesture token timestamp'
  );
});

test('D) assertGesture checks time elapsed', () => {
  assert.ok(
    scriptContent.includes('elapsed > GESTURE_TTL_MS'),
    'assertGesture must check elapsed time against TTL'
  );
});

test('D) gestureValid recorded in diagnostics', () => {
  assert.ok(
    scriptContent.includes('gestureValid'),
    'Diagnostics must record gesture validity'
  );
});

// E) VERSION SSOT
test('E) version.mjs exists with VERSION export', () => {
  const versionContent = readFileSync(join(ROOT, 'lib', 'version.mjs'), 'utf8');
  assert.ok(
    versionContent.includes("export const VERSION"),
    'version.mjs must export VERSION'
  );
  const versionMatch = versionContent.match(/VERSION\s*=\s*'([^']+)'/);
  assert.ok(versionMatch, 'VERSION must be parseable');
  const ssotVersion = versionMatch[1];

  // Check manifest matches
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, ssotVersion, 'manifest.json version must match SSOT');

  // Check script.js header matches
  assert.ok(
    scriptContent.includes(`Main Controller v${ssotVersion}`),
    'script.js header must match SSOT version'
  );
});

test('E) verify_version.cjs CI gate exists', () => {
  const verifyScript = readFileSync(join(ROOT, 'scripts', 'verify_version.cjs'), 'utf8');
  assert.ok(
    verifyScript.includes('lib/version.mjs') || verifyScript.includes("lib', 'version.mjs"),
    'verify_version.cjs must read from SSOT'
  );
  assert.ok(
    verifyScript.includes('process.exit(1)'),
    'verify_version.cjs must exit 1 on mismatch'
  );
});

// Schema version bump
test('diagnostics schema is v6', () => {
  assert.ok(
    scriptContent.includes("'diagnostics.v6'"),
    'Diagnostics schema must be v6 with always-on + anomaly scoring'
  );
});
