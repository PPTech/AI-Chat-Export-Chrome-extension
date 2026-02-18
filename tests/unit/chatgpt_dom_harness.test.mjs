// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// chatgpt_dom_harness.test.mjs - Snapshot Harness Test v0.12.14

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runSnapshotHarness } from '../../test/dom_harness_runner.mjs';

test('Snapshot harness finds messages and blocks in ChatGPT-like fixture', async (t) => {
  const fixture = path.resolve('test/fixtures/chatgpt_sample_snapshot.html');
  try {
    const result = await runSnapshotHarness(fixture);
    assert.ok(result.messageCount > 0);
    assert.ok(result.blockCount > 0);
  } catch (error) {
    if (error.message === 'jsdom_missing') {
      t.skip('jsdom is unavailable in this environment');
      return;
    }
    throw error;
  }
});
