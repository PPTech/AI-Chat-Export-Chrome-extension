// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runSelfHeal } from '../../self_heal/loop.mjs';

test('self-heal loop records improvement and persists state', () => {
  const out = runSelfHeal({ baselineScore: 0.4, candidateScores: [0.39, 0.45, 0.47], maxAttempts: 3 });
  assert.equal(out.improved, true);
  assert.equal(out.best > 0.4, true);
  assert.equal(fs.existsSync('.local/learning_state.json'), true);
});
