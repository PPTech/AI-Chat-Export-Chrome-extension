// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('background diagnostics v2 includes actionable redacted fields', () => {
  const src = fs.readFileSync('background.js', 'utf8');
  assert.match(src, /schema: 'diagnostics_v2'/);
  assert.match(src, /urlHost:/);
  assert.match(src, /urlPathHash:/);
  assert.match(src, /scheme:/);
  assert.match(src, /tabId:/);
  assert.match(src, /strategy:/);
});

test('content extraction analyzer logs are not emitted as ERROR', () => {
  const src = fs.readFileSync('content.js', 'utf8');
  assert.doesNotMatch(src, /LOG_ERROR', message: 'Extraction Result'/);
  assert.doesNotMatch(src, /LOG_ERROR', message: 'Adaptive Analyzer'/);
  assert.match(src, /LOG_EVENT', level: 'INFO', message: 'Extraction Result'/);
  assert.match(src, /LOG_EVENT', level: 'INFO', message: 'Adaptive Analyzer'/);
});

test('blob and data attachment paths resolve before ASSET_FETCH broker', () => {
  const src = fs.readFileSync('script.js', 'utf8');
  assert.match(src, /if \(\/\^data:\/i\.test\(clean\)\)/);
  assert.match(src, /if \(\/\^blob:\/i\.test\(clean\)\)/);
  assert.match(src, /if \(!\/\^https\?:\/i\.test\(clean\)\) return null;/);
});
