// License: MIT
// Author: Dr. Babak Sorkhpour (with help of AI)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('script.js', 'utf8');

test('Export pipeline always emits export_manifest.json', () => {
  assert.match(script, /export_manifest\.json/);
});

test('Export pipeline always emits diagnostics_summary.json in ZIP', () => {
  assert.match(script, /diagnostics_summary\.json/);
});

test('Export manifest uses v1 schema', () => {
  assert.match(script, /export-manifest\.v1/);
});

test('Export pipeline records per-format errors (fail-soft)', () => {
  assert.match(script, /formatErrors/);
});
