/**
 * AI Chat Export & Local Agent (Project Aegis)
 * Copyright (C) 2026 [YOUR_COMPANY_NAME_HERE]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/.
 *
 * -------------------------------------------------------------------------
 * COMMERCIAL LICENSE / PROPRIETARY USE:
 * If you wish to use this code in a proprietary software product,
 * enterprise environment, or commercial project where you do not wish to
 * open-source your own code, you MUST purchase a Commercial License from:
 * [INSERT_CONTACT_EMAIL_OR_WEBSITE]
 * -------------------------------------------------------------------------
 */
// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// export_core.js - AEGIS Artifact Factory v0.11.1

(() => {
  async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('read_error'));
      fr.readAsDataURL(blob);
    });
  }

  async function embedImagesAsBase64(rootEl = document) {
    const imgs = Array.from(rootEl.querySelectorAll('img[src]'));
    let embedded = 0;
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      if (!src || /^data:/i.test(src)) continue;
      try {
        const res = await fetch(src, { credentials: 'include' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute('src', dataUrl);
        embedded += 1;
      } catch {
        // ignore and keep original src
      }
    }
    return { total: imgs.length, embedded };
  }

  function buildMhtml({ html, resources = [] }) {
    const boundary = `----=_NextPart_AEGIS_${Date.now()}`;
    const header = [
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      'Content-Location: file:///index.html',
      '',
      html,
      ''
    ];

    const parts = resources.map((r) => [
      `--${boundary}`,
      `Content-Type: ${r.mime || 'application/octet-stream'}`,
      'Content-Transfer-Encoding: base64',
      `Content-Location: ${r.location || 'file:///resource.bin'}`,
      '',
      r.base64 || '',
      ''
    ].join('\r\n'));

    const footer = `--${boundary}--`;
    return `${header.join('\r\n')}${parts.length ? '\r\n' : ''}${parts.join('\r\n')}${parts.length ? '\r\n' : ''}${footer}`;
  }

  async function generateWordMhtmlFromNode(node = document.documentElement) {
    const cloned = node.cloneNode(true);
    const wrapper = document.implementation.createHTMLDocument('AEGIS Export');
    wrapper.documentElement.replaceWith(cloned);

    await embedImagesAsBase64(wrapper);

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>${wrapper.documentElement.innerHTML}</html>`;
    const mhtml = buildMhtml({ html, resources: [] });
    return {
      mime: 'multipart/related',
      content: mhtml,
      filename: `aegis_export_${new Date().toISOString().slice(0, 10)}.mhtml`
    };
  }

  const api = { embedImagesAsBase64, buildMhtml, generateWordMhtmlFromNode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ExportCore = api;
})();
