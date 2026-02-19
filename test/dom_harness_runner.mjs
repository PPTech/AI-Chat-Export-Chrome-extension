// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// dom_harness_runner.mjs - ChatGPT DOM Harness (jsdom) v0.12.14

import fs from 'node:fs';
import path from 'node:path';

function safeText(text = '') { return String(text || '').replace(/\s+/g, ' ').trim(); }

async function getJsdom() {
  try {
    const pkg = await import('jsdom');
    return pkg.JSDOM;
  } catch {
    throw new Error('jsdom_missing');
  }
}

function detectConversationRoot(document) {
  const cands = Array.from(document.querySelectorAll('main,[role="main"],[role="log"],div,section'))
    .map((el) => ({
      el,
      score: (safeText(el.textContent).length / 100) + el.querySelectorAll('article,pre code,img').length
    }))
    .filter((c) => c.score > 2)
    .sort((a, b) => b.score - a.score);
  return cands[0]?.el || null;
}

function collectMessageNodes(rootEl) {
  return Array.from(rootEl.querySelectorAll('article,div,section'))
    .filter((el) => safeText(el.textContent).length > 10 || el.querySelector('pre code,img'));
}

function parseMessageContent(messageEl) {
  const blocks = [];
  messageEl.querySelectorAll('p').forEach((p) => blocks.push({ type: 'text', text: safeText(p.textContent) }));
  messageEl.querySelectorAll('pre code').forEach((c) => blocks.push({ type: 'code', text: c.textContent || '' }));
  messageEl.querySelectorAll('a[href]').forEach((a) => blocks.push({ type: 'link', href: a.href, text: safeText(a.textContent) }));
  return blocks;
}

export async function runSnapshotHarness(snapshotPath) {
  const JSDOM = await getJsdom();
  const html = fs.readFileSync(snapshotPath, 'utf8');
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const root = detectConversationRoot(document);
  if (!root) throw new Error('root_not_found');
  const messages = collectMessageNodes(root);
  if (!messages.length) throw new Error('messages_not_found');

  const parsed = messages.map((m) => parseMessageContent(m));
  const blockCount = parsed.flat().length;
  if (!blockCount) throw new Error('blocks_not_found');

  return { messageCount: messages.length, blockCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixture = process.argv[2] || path.resolve('test/fixtures/chatgpt_sample_snapshot.html');
  runSnapshotHarness(fixture)
    .then((result) => console.log('[dom_harness_runner] PASS', result))
    .catch((err) => {
      if (err.message === 'jsdom_missing') {
        console.log('[dom_harness_runner] WARN jsdom is not installed; install dev dependency to run fixture tests.');
        process.exit(0);
        return;
      }
      console.error('[dom_harness_runner] FAIL', err.message);
      process.exit(1);
    });
}
