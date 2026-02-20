// License: MIT
// chat_export_dataset.mjs - Single Source of Truth (SSOT) for all export pipelines
// Every exporter (Markdown, HTML, JSON, CSV, SQL, TXT, PDF, DOCX/MHTML) MUST
// consume a ChatExportDataset. The content script builds it; exporters read it.

/**
 * @typedef {Object} Attachment
 * @property {string} ref_id       - Unique reference e.g. "att-0-0-abc123"
 * @property {'image'|'file'|'unknown'} kind
 * @property {string} source_url   - Original URL (data:, blob:, https:, etc.)
 * @property {string|null} filename_hint
 * @property {string|null} mime_hint
 * @property {{status:string, zip_path?:string, bytes?:number, sha256?:string}} resolved
 */

/**
 * @typedef {Object} MessageBlock
 * @property {'text'|'code'|'image'|'link'|'list'|'quote'} type
 * @property {string} [text]
 * @property {string} [code]
 * @property {string} [language]
 * @property {string} [src]
 * @property {string} [alt]
 * @property {string} [href]
 * @property {boolean} [ordered]
 * @property {string[]} [items]
 */

/**
 * @typedef {Object} Message
 * @property {number} index
 * @property {string} role        - 'User' | 'Assistant' | 'Gemini' | 'Claude' | 'Model' | 'Unknown'
 * @property {string} text        - Plain text content
 * @property {string} content     - Decorated content with [[IMG:]] and [[FILE:]] tokens
 * @property {MessageBlock[]} blocks
 * @property {Attachment[]} attachments
 * @property {{platform:string, confidence?:number, evidence?:string[], sourceSelector?:string}} meta
 */

/**
 * @typedef {Object} ChatExportDataset
 * @property {string} schema_version - 'chat-export-dataset.v1'
 * @property {{product:string, host:string, url:string, captured_at_utc:string, capture_method:string}} source
 * @property {{id:string|null, title:string|null}} conversation
 * @property {Message[]} messages
 * @property {Attachment[]} attachments
 * @property {{messages_total:number, messages_user:number, messages_assistant:number, messages_unknown:number, images:number, files:number, unknown_role_ratio:number}} counts
 */

const SCHEMA_VERSION = 'chat-export-dataset.v1';

/**
 * Build a ChatExportDataset from raw extraction results.
 * This is the ONLY way to produce a dataset for exporters.
 *
 * @param {Object} params
 * @param {string} params.platform
 * @param {string} params.title
 * @param {string} params.url
 * @param {Array<{role:string, content:string, meta?:Object}>} params.messages
 * @returns {ChatExportDataset}
 */
export function buildChatExportDataset({ platform, title, url, messages }) {
  const allAttachments = [];
  const normalizedMessages = (messages || []).map((m, index) => {
    const role = normalizeRole(m.role);
    const content = m.content || '';
    const text = stripTokens(content);
    const blocks = parseContentBlocks(content);
    const attachments = extractAttachmentsFromContent(content, index);

    for (const att of attachments) {
      allAttachments.push(att);
    }

    return {
      index,
      role,
      text,
      content,
      blocks,
      attachments: attachments.map((a) => a.ref_id),
      meta: {
        platform: platform || 'Unknown',
        confidence: m.meta?.confidence ?? null,
        evidence: m.meta?.evidence ?? [],
        sourceSelector: m.meta?.sourceSelector ?? null,
      },
    };
  });

  const counts = computeCounts(normalizedMessages);

  return {
    schema_version: SCHEMA_VERSION,
    source: {
      product: platform || 'Unknown',
      host: extractHost(url),
      url: url || '',
      captured_at_utc: new Date().toISOString(),
      capture_method: 'dom_snapshot',
    },
    conversation: {
      id: null,
      title: title || null,
    },
    messages: normalizedMessages,
    attachments: allAttachments,
    counts,
  };
}

/**
 * Validate a dataset meets SSOT contract requirements.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateDataset(dataset) {
  const errors = [];

  if (!dataset) {
    errors.push('dataset is null/undefined');
    return { valid: false, errors };
  }

  if (dataset.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be "${SCHEMA_VERSION}", got "${dataset.schema_version}"`);
  }

  if (!dataset.source?.product) errors.push('source.product is required');
  if (!dataset.source?.captured_at_utc) errors.push('source.captured_at_utc is required');
  if (!Array.isArray(dataset.messages)) errors.push('messages must be an array');

  if (Array.isArray(dataset.messages)) {
    for (let i = 0; i < dataset.messages.length; i++) {
      const msg = dataset.messages[i];
      if (!msg.role) errors.push(`messages[${i}].role is required`);
      if (typeof msg.content !== 'string') errors.push(`messages[${i}].content must be a string`);
    }
  }

  if (dataset.counts) {
    if (dataset.counts.unknown_role_ratio > 0.05) {
      errors.push(`unknown_role_ratio ${dataset.counts.unknown_role_ratio.toFixed(3)} exceeds 5% threshold`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- Helpers ---

function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase();
  if (r === 'user' || r === 'human') return 'User';
  if (r === 'assistant' || r === 'ai' || r === 'bot') return 'Assistant';
  if (r === 'claude') return 'Claude';
  if (r === 'gemini') return 'Gemini';
  if (r === 'model') return 'Model';
  if (r === 'chatgpt codex') return 'Assistant';
  return raw || 'Unknown';
}

function stripTokens(content) {
  return (content || '')
    .replace(/\[\[IMG:[\s\S]*?\]\]/g, '')
    .replace(/\[\[FILE:[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseContentBlocks(content) {
  const blocks = [];
  const imgRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
  const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
  let remaining = content || '';

  // Extract image tokens
  let match;
  while ((match = imgRegex.exec(remaining)) !== null) {
    blocks.push({ type: 'image', src: match[1].trim() });
  }

  // Extract file tokens
  while ((match = fileRegex.exec(remaining)) !== null) {
    blocks.push({ type: 'file', href: match[1].trim(), text: match[2].trim() });
  }

  // The rest is text
  const textOnly = stripTokens(remaining);
  if (textOnly) {
    blocks.unshift({ type: 'text', text: textOnly });
  }

  return blocks;
}

function extractAttachmentsFromContent(content, messageIndex) {
  const attachments = [];
  const imgRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
  const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
  let match;
  let idx = 0;

  while ((match = imgRegex.exec(content || '')) !== null) {
    const src = match[1].trim();
    if (!src) continue;
    attachments.push({
      ref_id: `att-${messageIndex}-${idx}`,
      kind: 'image',
      source_url: src,
      filename_hint: null,
      mime_hint: guessMime(src),
      resolved: { status: 'pending' },
    });
    idx++;
  }

  while ((match = fileRegex.exec(content || '')) !== null) {
    const url = match[1].trim();
    const name = match[2].trim();
    if (!url) continue;
    attachments.push({
      ref_id: `att-${messageIndex}-${idx}`,
      kind: 'file',
      source_url: url,
      filename_hint: name,
      mime_hint: null,
      resolved: { status: 'pending' },
    });
    idx++;
  }

  return attachments;
}

function computeCounts(messages) {
  let user = 0, assistant = 0, unknown = 0, images = 0, files = 0;

  for (const m of messages) {
    const role = (m.role || '').toLowerCase();
    if (role === 'user') user++;
    else if (['assistant', 'claude', 'gemini', 'model'].includes(role)) assistant++;
    else unknown++;

    for (const b of m.blocks || []) {
      if (b.type === 'image') images++;
      if (b.type === 'file') files++;
    }
  }

  const total = messages.length;
  return {
    messages_total: total,
    messages_user: user,
    messages_assistant: assistant,
    messages_unknown: unknown,
    images,
    files,
    unknown_role_ratio: total > 0 ? unknown / total : 0,
  };
}

function extractHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function guessMime(src) {
  if (/^data:([^;,]+)/.test(src)) return RegExp.$1;
  if (/\.png/i.test(src)) return 'image/png';
  if (/\.jpe?g/i.test(src)) return 'image/jpeg';
  if (/\.webp/i.test(src)) return 'image/webp';
  if (/\.gif/i.test(src)) return 'image/gif';
  if (/\.svg/i.test(src)) return 'image/svg+xml';
  return null;
}
