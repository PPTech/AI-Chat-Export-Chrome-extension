// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// normalizer/build_dataset.mjs - Dataset normalizer v0.12.6

import { createHash } from 'node:crypto';

export function buildDataset({ source, usedSelector, rawMessages }) {
  const attachmentsMap = new Map();
  const messages = rawMessages.map((m, index) => {
    const text = normalizeText(m.text);
    const blocks = [{ type: 'text', text }];
    const atts = (m.attachments || []).map((a, i) => {
      const ref_id = `att-${index}-${i}-${simpleHash(a.source_url).slice(0, 8)}`;
      attachmentsMap.set(ref_id, {
        ref_id,
        kind: a.kind || 'unknown',
        source_url: a.source_url,
        resolved: { status: 'failed' }
      });
      return {
        ref_id,
        kind: a.kind || 'unknown',
        source_url: a.source_url,
        filename_hint: a.filename_hint || null,
        mime_hint: a.mime_hint || null
      };
    });

    return {
      id: null,
      index,
      role: m.role || 'unknown',
      created_at_utc: null,
      text,
      blocks,
      attachments: atts,
      hash: `sha256:${simpleHash(`${m.role}|${text}`)}`
    };
  });

  return {
    schema_version: 'chat-export.v1',
    source: {
      product: source.product,
      host: source.host,
      url: source.url,
      captured_at_utc: source.captured_at_utc,
      capture_method: 'dom_snapshot',
      selector_version: usedSelector
    },
    conversation: { id: null, title: null, language_hint: null },
    messages,
    attachments: Array.from(attachmentsMap.values())
  };
}

function normalizeText(input) {
  return String(input || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function simpleHash(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}
