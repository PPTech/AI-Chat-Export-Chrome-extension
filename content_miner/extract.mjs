// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// content_miner/extract.mjs - Selector fallback extractor v0.12.6

export const SELECTORS = [
  { v: 'v3', q: 'main [data-message-id]' },
  { v: 'v2', q: 'main article' },
  { v: 'v1', q: 'main .group, main .text-base' }
];

export function extractRawMessages(doc) {
  for (const s of SELECTORS) {
    const nodes = Array.from(doc.querySelectorAll(s.q));
    if (!nodes.length) continue;

    const messages = nodes.map((n) => parseNode(n, s.v)).filter((m) => m.text.trim().length > 0);
    if (messages.length) return { messages, used_selector: s.v };
  }
  return { messages: [], used_selector: 'none' };
}

function parseNode(node, selectorVersion) {
  return {
    role: inferRole(node),
    text: node.innerText || '',
    html: node.innerHTML || '',
    attachments: discoverAttachments(node),
    selector_version: selectorVersion
  };
}

function inferRole(node) {
  const roleAttr = String(node.getAttribute?.('data-message-author-role') || '').toLowerCase();
  if (roleAttr.includes('assistant')) return 'assistant';
  if (roleAttr.includes('user')) return 'user';

  const aria = String(node.getAttribute?.('aria-label') || '').toLowerCase();
  if (aria.includes('assistant')) return 'assistant';
  if (aria.includes('user') || aria.includes('you')) return 'user';
  return 'unknown';
}

function discoverAttachments(node) {
  const out = [];
  node.querySelectorAll('img').forEach((img) => {
    const src = img.src || img.getAttribute('src') || '';
    if (src) out.push({ source_url: src, kind: 'image' });
  });
  node.querySelectorAll('a').forEach((a) => {
    const href = a.href || a.getAttribute('href') || '';
    if (href) out.push({ source_url: href, kind: 'file' });
  });

  const raw = node.innerHTML || '';
  for (const m of raw.matchAll(/(blob:|data:|chrome-extension:)[^"'\s<>]+/g)) {
    out.push({ source_url: m[0], kind: 'unknown' });
  }

  const seen = new Set();
  return out.filter((it) => {
    if (!it.source_url || seen.has(it.source_url)) return false;
    seen.add(it.source_url);
    return true;
  });
}
