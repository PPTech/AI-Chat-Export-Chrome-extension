// License: AGPL-3.0
// attachment_resolver.mjs - Scheme-aware attachment resolution with redirect tracing
// Handles data:, blob:, and http(s): URLs with full diagnostic chain.

import { createHash } from 'node:crypto';

/**
 * @typedef {Object} ResolveResult
 * @property {'resolved'|'blocked'|'failed'} status
 * @property {string} scheme         - Original URL scheme
 * @property {string} reason_code    - Machine-readable reason
 * @property {string|null} zip_path  - Path inside export ZIP
 * @property {number} bytes          - Byte count of resolved content
 * @property {string|null} sha256    - Hash of resolved content
 * @property {string|null} mime      - Detected MIME type
 * @property {string[]} redirect_chain - URLs followed during resolution
 */

const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'chrome-extension:']);
const MAX_REDIRECTS = 5;

/**
 * Resolve a single attachment URL to local bytes.
 *
 * @param {string} url - The attachment URL
 * @param {function} fetcher - async (url) => { bytes: Uint8Array, mime: string, redirectUrl?: string }
 * @param {Object} [options]
 * @param {boolean} [options.allowHttp=false] - Whether HTTP URLs are permitted
 * @param {Set<string>} [options.allowedHosts] - Hosts permitted for HTTP fetch
 * @returns {Promise<ResolveResult>}
 */
export async function resolveAttachmentSource(url, fetcher, options = {}) {
  const u = String(url || '');
  const scheme = detectScheme(u);
  const chain = [u];

  // Data URLs: decode inline
  if (u.startsWith('data:')) {
    try {
      const bytes = dataUrlToBytes(u);
      const sha = sha256Hex(bytes);
      const mime = extractDataUrlMime(u);
      return {
        status: 'resolved',
        scheme: 'data:',
        reason_code: 'DATA_URL_DECODED',
        zip_path: `attachments/${sha.slice(0, 16)}.bin`,
        bytes: bytes.byteLength,
        sha256: sha,
        mime,
        redirect_chain: chain,
      };
    } catch (e) {
      return failure('data:', 'DATA_URL_DECODE_FAILED', chain, e.message);
    }
  }

  // Blob URLs: fetch locally
  if (u.startsWith('blob:') || u.startsWith('chrome-extension:')) {
    try {
      const result = await fetcher(u);
      const bytes = result.bytes || result;
      const sha = sha256Hex(bytes);
      return {
        status: 'resolved',
        scheme,
        reason_code: 'LOCAL_FETCH_OK',
        zip_path: `attachments/${sha.slice(0, 16)}.bin`,
        bytes: bytes.byteLength,
        sha256: sha,
        mime: result.mime || null,
        redirect_chain: chain,
      };
    } catch (e) {
      return failure(scheme, 'LOCAL_FETCH_FAILED', chain, e.message);
    }
  }

  // HTTP(S) URLs: only if explicitly allowed
  if (/^https?:\/\//i.test(u)) {
    if (!options.allowHttp) {
      return {
        status: 'blocked',
        scheme: 'https:',
        reason_code: 'HTTP_NOT_ALLOWED',
        zip_path: null,
        bytes: 0,
        sha256: null,
        mime: null,
        redirect_chain: chain,
      };
    }

    // Host allowlist check
    if (options.allowedHosts) {
      const host = extractHost(u);
      if (!options.allowedHosts.has(host)) {
        return {
          status: 'blocked',
          scheme: 'https:',
          reason_code: 'HOST_NOT_ALLOWLISTED',
          zip_path: null,
          bytes: 0,
          sha256: null,
          mime: null,
          redirect_chain: chain,
        };
      }
    }

    // Follow redirects
    let currentUrl = u;
    for (let i = 0; i < MAX_REDIRECTS; i++) {
      try {
        const result = await fetcher(currentUrl);
        const bytes = result.bytes || result;

        if (result.redirectUrl && result.redirectUrl !== currentUrl) {
          chain.push(result.redirectUrl);
          currentUrl = result.redirectUrl;
          continue;
        }

        const sha = sha256Hex(bytes);
        return {
          status: 'resolved',
          scheme: 'https:',
          reason_code: chain.length > 1 ? 'HTTP_RESOLVED_VIA_REDIRECT' : 'HTTP_RESOLVED',
          zip_path: `attachments/${sha.slice(0, 16)}.bin`,
          bytes: bytes.byteLength,
          sha256: sha,
          mime: result.mime || null,
          redirect_chain: chain,
        };
      } catch (e) {
        return failure('https:', 'HTTP_FETCH_FAILED', chain, e.message);
      }
    }

    return failure('https:', 'TOO_MANY_REDIRECTS', chain);
  }

  return failure(scheme || 'unknown:', 'UNSUPPORTED_SCHEME', chain);
}

/**
 * Resolve all attachments in a dataset.
 */
export async function resolveAllAttachments(attachments, fetcher, options = {}) {
  const results = [];
  for (const att of attachments || []) {
    const result = await resolveAttachmentSource(att.source_url, fetcher, options);
    att.resolved = {
      status: result.status,
      zip_path: result.zip_path,
      bytes: result.bytes,
      sha256: result.sha256,
      mime: result.mime,
    };
    results.push({ ref_id: att.ref_id, ...result });
  }

  const resolved = results.filter((r) => r.status === 'resolved').length;
  const blocked = results.filter((r) => r.status === 'blocked').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return { results, resolved, blocked, failed };
}

// --- Helpers ---

function failure(scheme, code, chain, detail) {
  return {
    status: 'failed',
    scheme,
    reason_code: code,
    zip_path: null,
    bytes: 0,
    sha256: null,
    mime: null,
    redirect_chain: chain,
    detail: detail || null,
  };
}

function detectScheme(url) {
  const match = url.match(/^([a-z][a-z0-9+.-]*:)/i);
  return match ? match[1].toLowerCase() : null;
}

function extractHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl).split(',');
  if (parts.length < 2) return new Uint8Array();
  const isBase64 = /;base64$/i.test(parts[0]);
  if (isBase64) {
    return Uint8Array.from(Buffer.from(parts[1], 'base64'));
  }
  return new TextEncoder().encode(decodeURIComponent(parts[1]));
}

function extractDataUrlMime(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match ? match[1] : null;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
