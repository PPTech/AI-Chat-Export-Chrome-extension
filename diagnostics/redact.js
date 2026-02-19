// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// diagnostics/redact.js - Redaction Toolkit v0.12.20

(function initRedaction(globalObj) {
  const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g;
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g;
  const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
  const LONG_HEX_RE = /\b[a-f0-9]{32,}\b/gi;

  async function sha256Hex(input = '') {
    const data = new TextEncoder().encode(String(input || ''));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function scrubString(input = '') {
    let out = String(input || '')
      .replace(BEARER_RE, '[REDACTED_BEARER]')
      .replace(JWT_RE, '[REDACTED_JWT]')
      .replace(EMAIL_RE, '[REDACTED_EMAIL]')
      .replace(PHONE_RE, '[REDACTED_PHONE]')
      .replace(LONG_HEX_RE, '[REDACTED_HEX]');
    if (out.length > 200) {
      return `{len:${out.length},sha256_pending}`;
    }
    return out;
  }

  async function redactValue(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
      const s = scrubString(value);
      if (s.endsWith('sha256_pending}')) {
        const hash = await sha256Hex(value);
        return `{len:${value.length},sha256:${hash}}`;
      }
      return s;
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const row of value) out.push(await redactValue(row));
      return out;
    }
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = await redactValue(v);
      return out;
    }
    return value;
  }

  globalObj.RedactionToolkit = { redactValue, scrubString, sha256Hex };
})(typeof globalThis !== 'undefined' ? globalThis : window);
