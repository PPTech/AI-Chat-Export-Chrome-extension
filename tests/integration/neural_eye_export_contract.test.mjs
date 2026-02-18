// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRawMessages } from '../../content_miner/extract.mjs';
import { buildDataset } from '../../normalizer/build_dataset.mjs';
import { resolveAttachments } from '../../attachment_resolver/local_only_resolver.mjs';
import { buildManifest } from '../../packager/build_export_bundle.mjs';

function nodeStub({ role, text, html = '', atts = [] }) {
  return {
    innerText: text,
    innerHTML: html,
    getAttribute: (k) => (k === 'data-message-author-role' ? role : ''),
    querySelectorAll: (q) => {
      if (q === 'img') return atts.filter((a) => a.kind === 'image').map((a) => ({ src: a.url, getAttribute: () => a.url }));
      if (q === 'a') return atts.filter((a) => a.kind === 'file').map((a) => ({ href: a.url, getAttribute: () => a.url }));
      return [];
    }
  };
}

function docStub(nodesBySelector) {
  return {
    querySelectorAll: (q) => nodesBySelector[q] || []
  };
}

test('extracts messages and emits LOCAL_ONLY_BLOCK for external attachment', async () => {
  const doc = docStub({
    'main [data-message-id]': [
      nodeStub({ role: 'user', text: 'Hello', atts: [{ kind: 'image', url: 'data:image/png;base64,aGVsbG8=' }] }),
      nodeStub({ role: 'assistant', text: 'Hi', atts: [{ kind: 'file', url: 'https://example.com/a.png' }] })
    ]
  });

  const { messages, used_selector } = extractRawMessages(doc);
  assert.equal(used_selector, 'v3');
  const dataset = buildDataset({ source: { product: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com/c/x', captured_at_utc: new Date(0).toISOString() }, usedSelector: used_selector, rawMessages: messages });
  const result = await resolveAttachments(dataset, async () => new Uint8Array([1, 2]));
  assert.equal(dataset.messages.length >= 2, true);
  assert.equal(result.failures.some((f) => f.code === 'LOCAL_ONLY_BLOCK'), true);
});

test('fails loud semantics when no selectors match', () => {
  const doc = docStub({});
  const { messages, used_selector } = extractRawMessages(doc);
  assert.equal(used_selector, 'none');
  assert.equal(messages.length, 0);
});

test('bundle manifest includes forensic inventory', () => {
  const m = buildManifest([
    { path: 'dataset.json', bytes: Buffer.from('{}') },
    { path: 'diagnostics.json', bytes: Buffer.from('{}') },
    { path: 'attachments/a.bin', bytes: Buffer.from([1]) }
  ]);
  assert.equal(m.inventory.length, 3);
});
