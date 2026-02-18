// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';

function update(weights, vector, y, lr = 0.1) {
  let score = weights.bias;
  for (let i = 0; i < vector.length; i += 1) score += weights.w[i] * vector[i];
  const p = 1 / (1 + Math.exp(-score));
  const err = y - p;
  weights.bias += lr * err;
  for (let i = 0; i < vector.length; i += 1) weights.w[i] += lr * err * vector[i];
  return weights;
}

test('Online learner update changes decision boundary', () => {
  const w = { bias: 0, w: [0, 0, 0] };
  const before = { ...w, w: [...w.w] };
  update(w, [1, 0.5, 0.2], 1);
  assert.notDeepEqual(w, before);
});
