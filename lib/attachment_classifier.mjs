// License: AGPL-3.0
// attachment_classifier.mjs - Strict attachment classification pipeline
// Attachments MUST come from message metadata or real file-card/img inside
// message bubbles. Links in text are NOT attachments unless advanced toggle
// is enabled.

/**
 * Classification result for a URL candidate.
 * @typedef {Object} ClassificationResult
 * @property {'image'|'file'|'link'|'ignored'} kind
 * @property {string} reason
 * @property {boolean} allowed
 */

// Extensions that are ALWAYS ignored (scripts, stylesheets, executable content)
const HARD_IGNORE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.css', '.scss', '.less', '.sass',
  '.sh', '.bash', '.bat', '.cmd', '.ps1', '.exe', '.msi', '.dmg',
  '.dll', '.so', '.dylib', '.wasm',
  '.php', '.asp', '.aspx', '.jsp',
  '.map', '.min.js',
  '.ico',  // favicons — not user attachments
]);

// Extensions recognized as legitimate file attachments
const FILE_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.pptx', '.ppt',
  '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.toml',
  '.txt', '.md', '.rtf', '.odt', '.ods',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.ogg',
]);

// Extensions recognized as images
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif',
]);

// MIME type prefixes for images
const IMAGE_MIME_PREFIXES = ['image/'];

/**
 * Classify a URL candidate as an attachment.
 *
 * @param {Object} params
 * @param {string} params.url - The URL to classify
 * @param {'metadata'|'file-card'|'img-element'|'link-in-text'} params.source
 *   Where in the DOM this URL came from
 * @param {boolean} [params.advancedLinksEnabled=false]
 *   Whether the "treat links as attachments" toggle is on
 * @param {string} [params.mimeHint] - MIME type if known
 * @returns {ClassificationResult}
 */
export function classifyAttachment({ url, source, advancedLinksEnabled = false, mimeHint }) {
  const u = String(url || '');
  if (!u) return { kind: 'ignored', reason: 'empty_url', allowed: false };

  // Data URLs are always allowed (already local)
  if (u.startsWith('data:')) {
    const isImage = /^data:image\//i.test(u);
    return { kind: isImage ? 'image' : 'file', reason: 'data_url', allowed: true };
  }

  // Blob URLs are always allowed (already local)
  if (u.startsWith('blob:')) {
    return { kind: 'file', reason: 'blob_url', allowed: true };
  }

  // Chrome extension URLs are always allowed
  if (u.startsWith('chrome-extension:')) {
    return { kind: 'file', reason: 'extension_url', allowed: true };
  }

  // Extract extension from URL
  const ext = extractExtension(u);

  // Hard-ignore scripts, stylesheets, executables
  if (ext && HARD_IGNORE_EXTENSIONS.has(ext)) {
    return { kind: 'ignored', reason: `hard_ignore:${ext}`, allowed: false };
  }

  // Classify by MIME hint
  if (mimeHint) {
    if (IMAGE_MIME_PREFIXES.some((p) => mimeHint.startsWith(p))) {
      return { kind: 'image', reason: 'mime_image', allowed: true };
    }
  }

  // Classify by extension
  if (ext && IMAGE_EXTENSIONS.has(ext)) {
    return { kind: 'image', reason: `ext:${ext}`, allowed: true };
  }

  if (ext && FILE_EXTENSIONS.has(ext)) {
    return { kind: 'file', reason: `ext:${ext}`, allowed: true };
  }

  // Source-based rules
  if (source === 'metadata' || source === 'file-card') {
    // Attachments from metadata or file cards are always allowed
    return { kind: 'file', reason: `source:${source}`, allowed: true };
  }

  if (source === 'img-element') {
    return { kind: 'image', reason: 'source:img-element', allowed: true };
  }

  // Links in text require advanced toggle
  if (source === 'link-in-text') {
    if (advancedLinksEnabled) {
      return { kind: 'link', reason: 'advanced_toggle_enabled', allowed: true };
    }
    return { kind: 'ignored', reason: 'link_in_text_requires_toggle', allowed: false };
  }

  // Unknown source with HTTP URL
  if (/^https?:\/\//i.test(u)) {
    if (advancedLinksEnabled) {
      return { kind: 'link', reason: 'http_url_advanced_toggle', allowed: true };
    }
    return { kind: 'ignored', reason: 'http_url_no_toggle', allowed: false };
  }

  return { kind: 'ignored', reason: 'unclassifiable', allowed: false };
}

/**
 * Batch-classify a list of attachment candidates.
 * Returns only allowed attachments with their classification.
 */
export function filterAttachments(candidates, advancedLinksEnabled = false) {
  const results = [];
  const denied = [];

  for (const c of candidates) {
    const result = classifyAttachment({
      url: c.source_url || c.url,
      source: c.source || 'metadata',
      advancedLinksEnabled,
      mimeHint: c.mime_hint || c.mimeHint,
    });

    if (result.allowed) {
      results.push({ ...c, classification: result });
    } else {
      denied.push({ url: c.source_url || c.url, reason: result.reason });
    }
  }

  return { allowed: results, denied };
}

function extractExtension(url) {
  try {
    const pathname = new URL(url, 'https://placeholder.local').pathname;
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot === -1) return null;
    const ext = pathname.slice(lastDot).toLowerCase().split('?')[0].split('#')[0];
    return ext.length > 1 && ext.length <= 6 ? ext : null;
  } catch {
    return null;
  }
}
