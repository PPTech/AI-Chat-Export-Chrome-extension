// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// mhtml_generator.js - Prometheus MHTML Generator v0.12.8

(() => {
  if (window.MhtmlGenerator) return;

  function escapeHtml(text = '') {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMessage(message = {}) {
    const role = escapeHtml(message.role || 'UNKNOWN');
    const body = escapeHtml(message.content || '').replace(/\n/g, '<br>');
    const images = Array.isArray(message.images)
      ? message.images
          .filter((src) => /^data:image\//i.test(String(src || '')))
          .map((src) => `<img src="${src}" alt="embedded" style="max-width:100%;height:auto;display:block;margin-top:8px;"/>`)
          .join('')
      : '';
    return `<section style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;"><h3 style="margin:0 0 8px 0;font-size:13px;">${role}</h3><div style="font-size:12px;line-height:1.5;">${body}</div>${images}</section>`;
  }

  function buildHtml(conversation = [], title = 'Prometheus Export') {
    const sections = conversation.map((m) => renderMessage(m)).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,sans-serif;padding:16px;"><h1 style="font-size:18px;">${escapeHtml(title)}</h1>${sections}</body></html>`;
  }

  function buildMhtml({ html, boundary }) {
    const b = boundary || `----=_Prometheus_${Date.now()}`;
    return [
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${b}"; type="text/html"`,
      '',
      `--${b}`,
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      'Content-Location: file:///index.html',
      '',
      html,
      '',
      `--${b}--`,
      ''
    ].join('\r\n');
  }

  function generateFromConversation(conversation = [], options = {}) {
    const html = buildHtml(conversation, options.title || 'Prometheus Export');
    return buildMhtml({ html, boundary: options.boundary });
  }

  window.MhtmlGenerator = { escapeHtml, buildHtml, buildMhtml, generateFromConversation };
})();
