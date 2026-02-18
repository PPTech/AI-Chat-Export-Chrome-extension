// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// content_miner/extract.mjs - Selector fallback extractor v0.12.7

export const SELECTORS = [
  { v: 'v4', q: 'main [data-testid*="conversation-turn"], main [data-message-id], main [data-turn-id]' },
  { v: 'v3', q: 'main [data-message-id]' },
  { v: 'v2', q: 'main article' },
  { v: 'v1', q: 'main .group, main .text-base' }
];

export function extractRawMessages(doc) {
  for (const s of SELECTORS) {
    const nodes = Array.from(doc.querySelectorAll(s.q));
    if (!nodes.length) continue;

    const messages = nodes
      .map((n) => parseNode(n, s.v))
      .filter((m) => m.text.trim().length > 0 || (m.attachments || []).length > 0);
    if (messages.length) return { messages, used_selector: s.v };
  }
  return { messages: [], used_selector: 'none' };
}

function parseNode(node, selectorVersion) {
  return {
    role: inferRole(node),
    text: extractText(node),
    html: node.innerHTML || '',
    attachments: discoverAttachments(node),
    selector_version: selectorVersion
  };
}

function extractText(node) {
  const byInnerText = typeof node.innerText === 'string' ? node.innerText : '';
  if (byInnerText.trim().length > 0) return byInnerText;
  return String(node.textContent || '');
}

function inferRole(node) {
  const roleHints = [
    node.getAttribute?.('data-message-author-role'),
    node.getAttribute?.('data-role'),
    node.getAttribute?.('aria-label'),
    node.getAttribute?.('data-testid')
  ].map((v) => String(v || '').toLowerCase());

  const subtreeRole = node.querySelector?.('[data-message-author-role],[data-testid],[aria-label]');
  if (subtreeRole) {
    roleHints.push(
      String(subtreeRole.getAttribute('data-message-author-role') || '').toLowerCase(),
      String(subtreeRole.getAttribute('data-testid') || '').toLowerCase(),
      String(subtreeRole.getAttribute('aria-label') || '').toLowerCase()
    );
  }

  const joined = roleHints.join(' ');
  if (/assistant|model|chatgpt/.test(joined)) return 'assistant';
  if (/user|you|prompt/.test(joined)) return 'user';
  if (/system/.test(joined)) return 'system';
  return 'unknown';
}

function discoverAttachments(node) {
  const out = [];
  node.querySelectorAll('img').forEach((img) => {
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
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
