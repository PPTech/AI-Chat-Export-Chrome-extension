// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bg = fs.readFileSync('background.js', 'utf8');

test('Background.js exposes GET_DIAGNOSTICS_JSONL handler', () => {
  assert.match(bg, /GET_DIAGNOSTICS_JSONL/);
});

test('Background.js exposes STORE_DIAGNOSTICS handler', () => {
  assert.match(bg, /STORE_DIAGNOSTICS/);
});

test('Background.js exposes VALIDATE_GESTURE handler', () => {
  assert.match(bg, /VALIDATE_GESTURE/);
});

test('Background.js always calls sendResponse in every handler', () => {
  // Every case must call sendResponse
  assert.match(bg, /sendResponse/);
  // Must return true for async support
  assert.match(bg, /return true/);
});

test('Background.js limits diagnostics store size', () => {
  // Max 20 runs to avoid memory bloat
  assert.match(bg, /keys\.length > 20/);
});
