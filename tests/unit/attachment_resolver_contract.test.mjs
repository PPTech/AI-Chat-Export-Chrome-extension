// License: MIT
// Contract test for attachment resolver.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAttachmentSource, resolveAllAttachments } from '../../lib/attachment_resolver.mjs';

const DUMMY_FETCHER = async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: 'application/octet-stream' });

test('data: URL is decoded without fetcher', async () => {
  const r = await resolveAttachmentSource('data:image/png;base64,aGVsbG8=', DUMMY_FETCHER);
  assert.equal(r.status, 'resolved');
  assert.equal(r.scheme, 'data:');
  assert.equal(r.reason_code, 'DATA_URL_DECODED');
  assert.equal(r.mime, 'image/png');
  assert.ok(r.bytes > 0);
  assert.ok(r.sha256);
  assert.ok(r.zip_path.startsWith('attachments/'));
});

test('blob: URL is fetched locally', async () => {
  const r = await resolveAttachmentSource('blob:https://chatgpt.com/abc', DUMMY_FETCHER);
  assert.equal(r.status, 'resolved');
  assert.equal(r.reason_code, 'LOCAL_FETCH_OK');
  assert.ok(r.bytes > 0);
});

test('chrome-extension: URL is fetched locally', async () => {
  const r = await resolveAttachmentSource('chrome-extension://ext/file.bin', DUMMY_FETCHER);
  assert.equal(r.status, 'resolved');
  assert.equal(r.reason_code, 'LOCAL_FETCH_OK');
});

test('HTTP URL is blocked by default', async () => {
  const r = await resolveAttachmentSource('https://cdn.example.com/file.png', DUMMY_FETCHER);
  assert.equal(r.status, 'blocked');
  assert.equal(r.reason_code, 'HTTP_NOT_ALLOWED');
});

test('HTTP URL is resolved when allowHttp is true', async () => {
  const r = await resolveAttachmentSource(
    'https://cdn.example.com/file.png',
    DUMMY_FETCHER,
    { allowHttp: true }
  );
  assert.equal(r.status, 'resolved');
  assert.equal(r.reason_code, 'HTTP_RESOLVED');
});

test('HTTP URL is blocked when host not in allowlist', async () => {
  const r = await resolveAttachmentSource(
    'https://evil.com/file.png',
    DUMMY_FETCHER,
    { allowHttp: true, allowedHosts: new Set(['cdn.example.com']) }
  );
  assert.equal(r.status, 'blocked');
  assert.equal(r.reason_code, 'HOST_NOT_ALLOWLISTED');
});

test('redirect chain is tracked', async () => {
  let callCount = 0;
  const redirectFetcher = async (url) => {
    callCount++;
    if (callCount === 1) {
      return { bytes: new Uint8Array(), mime: null, redirectUrl: 'https://cdn.example.com/final.png' };
    }
    return { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' };
  };

  const r = await resolveAttachmentSource(
    'https://cdn.example.com/redirect',
    redirectFetcher,
    { allowHttp: true }
  );
  assert.equal(r.status, 'resolved');
  assert.equal(r.reason_code, 'HTTP_RESOLVED_VIA_REDIRECT');
  assert.equal(r.redirect_chain.length, 2);
});

test('fetcher failure produces failed status', async () => {
  const failFetcher = async () => { throw new Error('network error'); };
  const r = await resolveAttachmentSource('blob:https://chatgpt.com/abc', failFetcher);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason_code, 'LOCAL_FETCH_FAILED');
});

test('resolveAllAttachments processes dataset attachments', async () => {
  const attachments = [
    { ref_id: 'att-0-0', source_url: 'data:text/plain;base64,dGVzdA==', kind: 'file', resolved: {} },
    { ref_id: 'att-0-1', source_url: 'https://example.com/blocked.png', kind: 'image', resolved: {} },
  ];

  const { resolved, blocked, failed } = await resolveAllAttachments(attachments, DUMMY_FETCHER);
  assert.equal(resolved, 1);
  assert.equal(blocked, 1);
  assert.equal(failed, 0);
  assert.equal(attachments[0].resolved.status, 'resolved');
  assert.equal(attachments[1].resolved.status, 'blocked');
});

test('unsupported scheme is rejected', async () => {
  const r = await resolveAttachmentSource('ftp://server.com/file.bin', DUMMY_FETCHER);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason_code, 'UNSUPPORTED_SCHEME');
});
