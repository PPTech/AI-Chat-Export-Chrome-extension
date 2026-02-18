// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTests } from '../../tools/pts.mjs';

test('PTS selects expected tests for changed module groups', () => {
  const selected = selectTests(['content_miner/extract.mjs', 'attachment_resolver/local_only_resolver.mjs', 'self_heal/loop.mjs']);
  assert.equal(selected.includes('tests/integration/neural_eye_export_contract.test.mjs'), true);
  assert.equal(selected.includes('tests/unit/local_only_resolver_contract.test.mjs'), true);
  assert.equal(selected.includes('tests/unit/self_heal_contract.test.mjs'), true);
});
