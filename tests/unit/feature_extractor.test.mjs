// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';

function stableVector(candidate) {
  const text = String(candidate.text || '');
  return [candidate.confidence || 0, text.length, /```/.test(text) ? 1 : 0, /sandbox:\//.test(text) ? 1 : 0];
}

test('Feature extraction stable vectors for identical fixture', () => {
  const fixture = { confidence: 0.73, text: 'Hello ```js\nconst x=1;\n``` sandbox:/mnt/data/file.csv' };
  const a = stableVector(fixture);
  const b = stableVector(fixture);
  assert.deepEqual(a, b);
});
