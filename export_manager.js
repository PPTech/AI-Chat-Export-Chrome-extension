// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// export_manager.js - ExportManager v0.12.13

(() => {
  if (window.ExportManager) return;

  class ExportManager {
    constructor() {
      this.inlineStyle = `
        body{font-family:Arial,sans-serif;max-width:980px;margin:auto;padding:18px;line-height:1.6}
        .message{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin:10px 0}
        .role{font-weight:700;margin-bottom:6px}
        img{max-width:100%;height:auto}
        pre{background:#111;color:#fff;padding:10px;border-radius:8px;overflow:auto}
        code{font-family:Consolas,Monaco,monospace}
      `;
    }

    escapeHtml(text = '') {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    renderMessageContent(content = '') {
      return String(content)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\[\[IMG:([\s\S]*?)\]\]/g, (m, src) => /^data:image\//i.test(src) ? `<img src="${src}" alt="embedded image"/>` : '<div>[Image Load Failed]</div>')
        .replace(/\n/g, '<br>');
    }

    buildSelfContainedHtml(title = 'Export', messages = []) {
      const body = messages.map((m) => `<div class="message"><div class="role">${this.escapeHtml(m.role || 'Unknown')}</div><div>${this.renderMessageContent(m.content || '')}</div></div>`).join('');
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${this.escapeHtml(title)}</title><style>${this.inlineStyle}</style></head><body><h1>${this.escapeHtml(title)}</h1>${body}</body></html>`;
    }

    buildWordDocument(title = 'Export', messages = []) {
      const cleanHtmlContent = this.buildSelfContainedHtml(title, messages)
        .replace(/^.*?<body>/is, '')
        .replace(/<\/body>[\s\S]*$/is, '');
      return `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><style>${this.inlineStyle}</style></head><body>${cleanHtmlContent}</body></html>`;
    }
  }

  window.ExportManager = ExportManager;
})();
