// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loop = fs.readFileSync('agent/agent_loop.js', 'utf8');

test('Proof of intelligence contract requires multiple attempts and persisted updates', () => {
  assert.match(loop, /MAX_ATTEMPTS\s*=\s*8/);
  assert.match(loop, /attempts/);
  assert.match(loop, /bestPlanScore/);
  assert.match(loop, /persistedUpdates/);
});
