// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// attachment_classifier.js - Attachment classifier v0.12.19
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

(() => {
  if (window.AttachmentClassifier) return;

  const SCRIPT_EXT = /\.(?:m?js|cjs|map|css)(?:$|[?#])/i;
  const DOC_EXT = /\.md(?:$|[?#])/i;

  function classifyAttachmentUrl(url = '', opts = {}) {
    const clean = String(url || '').trim();
    const lower = clean.toLowerCase();
    const includeExternalLinks = !!opts.includeExternalLinks;

    if (!clean) return { accepted: false, kind: 'noise', reason: 'empty' };
    if (lower.startsWith('chrome-extension://')) return { accepted: false, kind: 'noise', reason: 'extension_resource' };
    if (SCRIPT_EXT.test(lower)) return { accepted: false, kind: 'noise', reason: 'script_asset' };
    if (DOC_EXT.test(lower) && !includeExternalLinks) return { accepted: false, kind: 'noise', reason: 'docs_link' };
    if (/raw\.githubusercontent\.com/i.test(lower) && !includeExternalLinks) return { accepted: false, kind: 'noise', reason: 'external_link_blocked' };

    if (/^data:image\//i.test(lower) || /\.(png|jpe?g|webp|gif|bmp|svg)(?:$|[?#])/i.test(lower)) {
      return { accepted: true, kind: 'image', reason: 'image_like' };
    }
    if (/^blob:/i.test(lower) || /^sandbox:/i.test(lower) || /\.(pdf|docx|xlsx|pptx|zip|csv|txt|json|py|md)(?:$|[?#])/i.test(lower)) {
      return { accepted: true, kind: 'file', reason: 'file_like' };
    }
    if (!includeExternalLinks) return { accepted: false, kind: 'noise', reason: 'plain_hyperlink' };
    return { accepted: true, kind: 'file', reason: 'advanced_external_link' };
  }

  window.AttachmentClassifier = { classifyAttachmentUrl };
})();
