// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../../security_guard.js');
await import('../../offline_brain.js');

test('SecurityGuard allowlist blocks https and allows data URL', () => {
  assert.equal(globalThis.SecurityGuard.isAllowed('data:text/plain;base64,SGVsbG8='), true);
  assert.equal(globalThis.SecurityGuard.isAllowed('https://example.com/file.png'), false);
});

test('OfflineBrain classifies and wraps code outside pre', () => {
  const cls = globalThis.OfflineBrain.classifyText('const a = 1; return a;');
  assert.equal(cls.label, 'Code');
  const fixed = globalThis.OfflineBrain.sanitizeCodeBlock({ label: 'Code', text: 'const a=1;', inPreTag: false });
  assert.equal(fixed.autoWrapped, true);
  assert.match(fixed.text, /```/);
});
