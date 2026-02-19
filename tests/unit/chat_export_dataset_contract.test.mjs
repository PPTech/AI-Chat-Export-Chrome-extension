// License: MIT
// Contract test for ChatExportDataset SSOT schema.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatExportDataset, validateDataset } from '../../lib/chat_export_dataset.mjs';

test('buildChatExportDataset produces valid schema', () => {
  const dataset = buildChatExportDataset({
    platform: 'ChatGPT',
    title: 'Test Chat',
    url: 'https://chatgpt.com/c/123',
    messages: [
      { role: 'User', content: 'Hello world', meta: { platform: 'ChatGPT', confidence: 0.95 } },
      { role: 'Assistant', content: 'Hi there!\n[[IMG:data:image/png;base64,abc123]]', meta: { platform: 'ChatGPT' } },
    ],
  });

  assert.equal(dataset.schema_version, 'chat-export-dataset.v1');
  assert.equal(dataset.source.product, 'ChatGPT');
  assert.equal(dataset.source.host, 'chatgpt.com');
  assert.equal(dataset.messages.length, 2);
  assert.equal(dataset.counts.messages_total, 2);
  assert.equal(dataset.counts.messages_user, 1);
  assert.equal(dataset.counts.messages_assistant, 1);
  assert.equal(dataset.counts.messages_unknown, 0);
  assert.equal(dataset.counts.unknown_role_ratio, 0);
  assert.equal(dataset.counts.images, 1);
  assert.equal(dataset.attachments.length, 1);
  assert.equal(dataset.attachments[0].kind, 'image');
  assert.ok(dataset.attachments[0].source_url.startsWith('data:image/png'));
});

test('validateDataset passes for valid dataset', () => {
  const dataset = buildChatExportDataset({
    platform: 'Claude',
    title: 'Test',
    url: 'https://claude.ai/chat/1',
    messages: [
      { role: 'User', content: 'test' },
      { role: 'Claude', content: 'response' },
    ],
  });

  const result = validateDataset(dataset);
  assert.equal(result.valid, true, `Validation errors: ${result.errors.join(', ')}`);
});

test('validateDataset fails for null dataset', () => {
  const result = validateDataset(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateDataset flags high unknown role ratio', () => {
  const dataset = buildChatExportDataset({
    platform: 'ChatGPT',
    title: 'Test',
    url: 'https://chatgpt.com/c/1',
    messages: [
      { role: 'Unknown', content: 'a' },
      { role: 'Unknown', content: 'b' },
      { role: 'Unknown', content: 'c' },
      { role: 'User', content: 'd' },
    ],
  });

  const result = validateDataset(dataset);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('unknown_role_ratio')));
});

test('normalizeRole maps common variants', () => {
  const dataset = buildChatExportDataset({
    platform: 'ChatGPT',
    title: 'Test',
    url: 'https://chatgpt.com/c/1',
    messages: [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'Claude', content: 'c' },
      { role: 'Gemini', content: 'd' },
      { role: 'Model', content: 'e' },
    ],
  });

  assert.equal(dataset.messages[0].role, 'User');
  assert.equal(dataset.messages[1].role, 'Assistant');
  assert.equal(dataset.messages[2].role, 'Claude');
  assert.equal(dataset.messages[3].role, 'Gemini');
  assert.equal(dataset.messages[4].role, 'Model');
  assert.equal(dataset.counts.messages_unknown, 0);
});

test('file attachments are extracted from FILE tokens', () => {
  const dataset = buildChatExportDataset({
    platform: 'ChatGPT',
    title: 'Test',
    url: 'https://chatgpt.com/c/1',
    messages: [
      { role: 'Assistant', content: 'Here is the file\n[[FILE:blob:https://chatgpt.com/abc|report.pdf]]' },
    ],
  });

  assert.equal(dataset.attachments.length, 1);
  assert.equal(dataset.attachments[0].kind, 'file');
  assert.equal(dataset.attachments[0].filename_hint, 'report.pdf');
  assert.ok(dataset.attachments[0].source_url.startsWith('blob:'));
  assert.equal(dataset.counts.files, 1);
});

test('text field strips image and file tokens', () => {
  const dataset = buildChatExportDataset({
    platform: 'ChatGPT',
    title: 'Test',
    url: 'https://chatgpt.com/c/1',
    messages: [
      { role: 'Assistant', content: 'Hello\n[[IMG:data:image/png;base64,x]]\n[[FILE:blob:x|f.pdf]]\nWorld' },
    ],
  });

  assert.equal(dataset.messages[0].text, 'Hello\n\nWorld');
});
