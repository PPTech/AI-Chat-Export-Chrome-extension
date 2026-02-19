// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('export flow blocks example.com placeholders before asset fetch', () => {
  const src = fs.readFileSync('script.js', 'utf8');
  assert.match(src, /function isPlaceholderUrl\(/);
  assert.match(src, /placeholder_url_detected/);
  assert.match(src, /if \(isPlaceholderUrl\(clean\)\) \{[\s\S]*?return null;[\s\S]*?\}/);
});
