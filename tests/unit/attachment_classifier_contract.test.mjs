// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('attachment_classifier.js', 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(source, ctx);
const classifier = ctx.window.AttachmentClassifier;

test('raw.githubusercontent.com is blocked by default', () => {
  const out = classifier.classifyAttachmentUrl('https://raw.githubusercontent.com/org/repo/file.bin', { includeExternalLinks: false });
  assert.equal(out.accepted, false);
  assert.equal(out.reason, 'external_link_blocked');
});

test('raw.githubusercontent.com can be enabled with advanced toggle', () => {
  const out = classifier.classifyAttachmentUrl('https://raw.githubusercontent.com/org/repo/file.bin', { includeExternalLinks: true });
  assert.equal(out.accepted, true);
});
