// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('background LOG_EVENT enforces tabId or tabScope in details', () => {
  const src = fs.readFileSync('background.js', 'utf8');
  assert.match(src, /function withEventScope\(/);
  assert.match(src, /base\.tabScope = 'global'/);
  assert.match(src, /const scopedDetails = withEventScope\(message\.details, tabId\)/);
});
