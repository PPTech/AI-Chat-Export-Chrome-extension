// License: MIT
// Contract test for attachment classifier.

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttachment, filterAttachments } from '../../lib/attachment_classifier.mjs';

test('data: URLs are always allowed', () => {
  const r = classifyAttachment({ url: 'data:image/png;base64,abc', source: 'metadata' });
  assert.equal(r.allowed, true);
  assert.equal(r.kind, 'image');
});

test('blob: URLs are always allowed', () => {
  const r = classifyAttachment({ url: 'blob:https://chatgpt.com/abc-123', source: 'metadata' });
  assert.equal(r.allowed, true);
  assert.equal(r.kind, 'file');
});

test('chrome-extension: URLs are always allowed', () => {
  const r = classifyAttachment({ url: 'chrome-extension://abc/file.bin', source: 'metadata' });
  assert.equal(r.allowed, true);
});

test('scripts are hard-ignored regardless of source', () => {
  for (const ext of ['.js', '.mjs', '.ts', '.jsx', '.css', '.exe', '.sh']) {
    const r = classifyAttachment({ url: `https://cdn.example.com/file${ext}`, source: 'metadata' });
    assert.equal(r.allowed, false, `${ext} should be hard-ignored`);
    assert.equal(r.kind, 'ignored');
    assert.ok(r.reason.includes('hard_ignore'));
  }
});

test('image extensions are classified as images', () => {
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']) {
    const r = classifyAttachment({ url: `https://cdn.example.com/photo${ext}`, source: 'img-element' });
    assert.equal(r.allowed, true, `${ext} should be allowed`);
    assert.equal(r.kind, 'image');
  }
});

test('file extensions are classified as files', () => {
  for (const ext of ['.pdf', '.docx', '.xlsx', '.csv', '.zip']) {
    const r = classifyAttachment({ url: `https://cdn.example.com/doc${ext}`, source: 'file-card' });
    assert.equal(r.allowed, true, `${ext} should be allowed`);
    assert.equal(r.kind, 'file');
  }
});

test('links in text are ignored without advanced toggle', () => {
  const r = classifyAttachment({ url: 'https://example.com/page', source: 'link-in-text', advancedLinksEnabled: false });
  assert.equal(r.allowed, false);
  assert.ok(r.reason.includes('toggle'));
});

test('links in text are allowed with advanced toggle', () => {
  const r = classifyAttachment({ url: 'https://example.com/page', source: 'link-in-text', advancedLinksEnabled: true });
  assert.equal(r.allowed, true);
  assert.equal(r.kind, 'link');
});

test('metadata source allows unknown extensions', () => {
  const r = classifyAttachment({ url: 'https://api.example.com/download/12345', source: 'metadata' });
  assert.equal(r.allowed, true);
  assert.equal(r.kind, 'file');
});

test('MIME hint overrides extension for classification', () => {
  const r = classifyAttachment({ url: 'https://cdn.example.com/blob', source: 'metadata', mimeHint: 'image/png' });
  assert.equal(r.kind, 'image');
  assert.equal(r.allowed, true);
});

test('empty URL is ignored', () => {
  const r = classifyAttachment({ url: '', source: 'metadata' });
  assert.equal(r.allowed, false);
  assert.equal(r.kind, 'ignored');
});

test('filterAttachments returns only allowed items', () => {
  const candidates = [
    { source_url: 'data:image/png;base64,abc', source: 'img-element' },
    { source_url: 'https://cdn.example.com/script.js', source: 'link-in-text' },
    { source_url: 'blob:https://chatgpt.com/file', source: 'file-card' },
    { source_url: 'https://example.com/random-link', source: 'link-in-text' },
  ];

  const { allowed, denied } = filterAttachments(candidates, false);
  assert.equal(allowed.length, 2); // data: and blob:
  assert.equal(denied.length, 2); // .js and link-in-text without toggle
});
