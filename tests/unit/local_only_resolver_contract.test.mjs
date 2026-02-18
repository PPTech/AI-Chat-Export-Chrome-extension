// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOne } from '../../attachment_resolver/local_only_resolver.mjs';

test('resolveOne blocks external urls in local-only mode', async () => {
  const res = await resolveOne('https://example.com/a.png', async () => new Uint8Array());
  assert.equal(res.status, 'external_ref');
  assert.equal(res.reason_code, 'LOCAL_ONLY_BLOCK');
});
