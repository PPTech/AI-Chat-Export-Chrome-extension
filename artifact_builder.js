// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// artifact_builder.js - AEGIS Universal Container v0.12.4

(() => {
  if (window.ArtifactBuilder) return;

  function stripScriptsAndHandlers(html = '') {
    const noScripts = String(html).replace(/<script[\s\S]*?<\/script>/gi, '');
    return noScripts
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, 'blocked:');
  }

  function buildSingleFileHtml({ title = 'AEGIS Export', bodyHtml = '', inlineCss = '' }) {
    const safeBody = stripScriptsAndHandlers(bodyHtml);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${inlineCss}</style></head><body>${safeBody}</body></html>`;
  }

  function buildMhtml({ html, resources = [] }) {
    const boundary = `----=_NextPart_AEGIS_${Date.now()}`;
    const lines = [
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: 8bit',
      'Content-Location: file:///index.html',
      '',
      html,
      ''
    ];

    resources.forEach((res, idx) => {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${res.mime || 'application/octet-stream'}`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-ID: <image${String(idx + 1).padStart(3, '0')}>`);
      lines.push('');
      lines.push(res.base64 || '');
      lines.push('');
    });
    lines.push(`--${boundary}--`);
    return lines.join('\r\n');
  }

  function buildDebugLog({ scanMetrics = {}, heuristicConfidence = '', warnings = [] }) {
    return {
      generatedAt: new Date().toISOString(),
      scanMetrics,
      heuristicConfidence,
      warnings
    };
  }

  window.ArtifactBuilder = {
    buildSingleFileHtml,
    buildMhtml,
    buildDebugLog,
    stripScriptsAndHandlers
  };
})();
