import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const scriptPath = path.resolve('chatgpt_backend_utils.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const ctx = { window: {}, console, module: { exports: {} }, URL };
vm.createContext(ctx);
vm.runInContext(source, ctx);
const utils = ctx.window.ChatGPTBackendUtils || ctx.module.exports;

const fixturePath = path.resolve('test/fixtures/chatgpt_mapping_fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('detectChatGPTConversationIdFromUrl resolves chat and share modes', () => {
  const chat = utils.detectChatGPTConversationIdFromUrl('https://chatgpt.com/c/123e4567-e89b-12d3-a456-426614174000');
  const share = utils.detectChatGPTConversationIdFromUrl('https://chatgpt.com/share/123e4567-e89b-12d3-a456-426614174001');
  assert.equal(chat.mode, 'chat');
  assert.equal(share.mode, 'share');
  assert.ok(chat.id);
  assert.ok(share.id);
});

test('orderedNodesFromCurrent returns full current path for mapping fixture', () => {
  const nodes = utils.orderedNodesFromCurrent(fixture);
  assert.equal(nodes.length, 55);
  assert.equal(nodes[0].id, 'node-1');
  assert.equal(nodes.at(-1).id, 'node-55');
});

test('collectUrlsDeep collects URLs and classifier rejects js assets', () => {
  const sample = {
    a: 'https://files.example.com/image.png',
    b: ['https://cdn.example.com/react.production.min.js', 'https://files.example.com/report.pdf']
  };
  const urls = utils.collectUrlsDeep(sample);
  assert.ok(urls.includes('https://files.example.com/image.png'));
  assert.ok(urls.includes('https://files.example.com/report.pdf'));
  const jsClass = utils.classifyChatGptAssetUrl('https://cdn.example.com/react.production.min.js');
  const imgClass = utils.classifyChatGptAssetUrl('https://files.example.com/image.png');
  assert.equal(jsClass.accepted, false);
  assert.equal(imgClass.accepted, true);
  assert.equal(imgClass.kind, 'image');
});
