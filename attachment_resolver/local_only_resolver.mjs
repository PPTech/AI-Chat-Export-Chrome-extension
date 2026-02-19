// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// attachment_resolver/local_only_resolver.mjs - Local-only resolver v0.12.6

import { createHash } from 'node:crypto';

export async function resolveAttachments(dataset, fetcher) {
  const failures = [];
  let resolved = 0;
  let externalRefs = 0;

  for (const att of dataset.attachments || []) {
    const res = await resolveOne(att.source_url, fetcher);
    att.resolved = {
      status: res.status,
      zip_path: res.zip_path || null,
      bytes: res.bytes || 0,
      sha256: res.sha256 || null
    };
    if (res.status === 'saved') resolved += 1;
    if (res.status === 'external_ref') externalRefs += 1;
    if (res.status !== 'saved') {
      failures.push({ stage: 'resolve_attachments', code: res.reason_code || 'ATTACHMENT_RESOLVE_FAILED', detail: res.reason_code || 'resolve_failed', url: res.url });
    }
  }

  return { resolved, externalRefs, failures };
}

export async function resolveOne(url, fetcher) {
  if (String(url).startsWith('data:')) {
    const bytes = dataUrlToBytes(url);
    const sha = sha256Hex(bytes);
    return { status: 'saved', zip_path: `attachments/${sha.slice(0, 16)}.bin`, bytes: bytes.byteLength, sha256: sha, url };
  }

  if (String(url).startsWith('blob:') || String(url).startsWith('chrome-extension:')) {
    try {
      const bytes = await fetcher(url);
      const sha = sha256Hex(bytes);
      return { status: 'saved', zip_path: `attachments/${sha.slice(0, 16)}.bin`, bytes: bytes.byteLength, sha256: sha, url };
    } catch {
      return { status: 'failed', reason_code: 'LOCAL_FETCH_FAILED', url };
    }
  }

  return { status: 'external_ref', reason_code: 'LOCAL_ONLY_BLOCK', url };
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl).split(',');
  if (parts.length < 2) return new Uint8Array();
  return Uint8Array.from(Buffer.from(parts[1], 'base64'));
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
