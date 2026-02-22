// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/export.mjs - Export Processing and Output Formats

export function escapeHtml(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function normalizeImageSrc(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    return '';
}

// Like normalizeImageSrc but also accepts local ZIP asset paths (e.g. assets/img_001.png).
// Used in renderRich* functions so embedded images aren't silently dropped.
function normalizeImageSrcForOutput(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;          // inline base64
    if (/^https?:\/\//i.test(src)) return src;           // remote URL
    if (/^assets\//.test(src)) return src;               // local ZIP path — allow as-is
    return '';
}

export function stripImageTokens(content) {
    return (content || '')
        .replace(/\[\[IMG:[\s\S]*?\]\]/g, '')
        .replace(/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function replaceImageTokensForText(content) {
    return stripImageTokens(content);
}

export function renderImgTag(rawSrc) {
    const src = normalizeImageSrc((rawSrc || '').trim());
    if (!src) return '';
    return `<img src="${src}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
}

export function splitContentAndImages(content) {
    const parts = [];
    const regex = /\[\[IMG:([\s\S]*?)\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content || '')) !== null) {
        const start = match.index;
        if (start > lastIndex) parts.push({ type: 'text', value: (content || '').slice(lastIndex, start) });
        parts.push({ type: 'image', value: match[1] || match[2] || '' });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < (content || '').length) parts.push({ type: 'text', value: (content || '').slice(lastIndex) });
    if (!parts.length) parts.push({ type: 'text', value: content || '' });
    return parts;
}

export function renderRichMessageHtml(content) {
    const parts = splitContentAndImages(content || '');
    return parts.map((part) => {
        if (part.type === 'image') return renderImgTag(part.value);
        let text = escapeHtml(part.value || '').replace(/\n/g, '<br>');
        text = text.replace(/\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g, (_, url, name) => {
            return `<a href="${url}" download="${name}" target="_blank" style="display:inline-block; margin:4px 0; padding:6px 12px; background:#f3f4f6; border:1px solid #d1d5db; border-radius:4px; text-decoration:none; color:#111827; font-weight:500; font-size:14px;">📎 ${name}</a>`;
        });
        return text;
    }).join('');
}

export function extractAllImageSources(messages) {
    const set = new Set();
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
    const mdRegex = /!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    for (const m of messages || []) {
        let match;
        while ((match = tokenRegex.exec(m.content || '')) !== null) {
            const src = normalizeImageSrc((match[1] || '').trim());
            if (src) set.add(src);
        }
        while ((match = mdRegex.exec(m.content || '')) !== null) {
            const src = normalizeImageSrc((match[1] || '').trim());
            if (src) set.add(src);
        }
    }
    return Array.from(set);
}

export function extractAllFileSources(messages) {
    const files = [];
    for (const m of messages || []) {
        const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
        let match;
        while ((match = fileRegex.exec(m.content || '')) !== null) {
            const rawUrl = (match[1] || '').trim();
            const fileName = (match[2] || 'file.bin').trim();
            if (!rawUrl) continue;
            const safeName = fileName.replace(/[\/:*?"<>|]+/g, '_') || 'file.bin';
            files.push({ url: rawUrl, name: safeName });
        }
    }
    const uniq = new Map();
    files.forEach((f) => { if (!uniq.has(f.url)) uniq.set(f.url, f); });
    return Array.from(uniq.values());
}

export function rewriteContentWithLocalAssets(content, urlMap) {
    if (!urlMap || urlMap.size === 0) return content;
    let result = content;
    for (const [originalUrl, localPath] of urlMap) {
        result = result.split(originalUrl).join(localPath);
    }
    return result;
}

export function renderRichMessageHtmlWithAssets(content, urlMap) {
    const rewritten = urlMap ? rewriteContentWithLocalAssets(content, urlMap) : content;
    const parts = splitContentAndImages(rewritten || '');
    return parts.map((part) => {
        if (part.type === 'image') {
            const src = (part.value || '').trim();
            if (!src) return '';
            // Bug 1 fix: use normalizeImageSrcForOutput so local ZIP paths (assets/img_001.png) are accepted
            const safeSrc = normalizeImageSrcForOutput(src);
            if (!safeSrc) return '';
            return `<img src="${safeSrc}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
        }
        let text = escapeHtml(part.value || '').replace(/\n/g, '<br>');
        text = text.replace(/\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g, (_, url, name) => {
            return `<a href="${url}" download="${name}" target="_blank" style="display:inline-block; margin:4px 0; padding:6px 12px; background:#f3f4f6; border:1px solid #d1d5db; border-radius:4px; text-decoration:none; color:#111827; font-weight:500; font-size:14px;">📎 ${name}</a>`;
        });
        return text;
    }).join('');
}

/**
 * Robust ZIP generation (CRC32 and headers)
 */
const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
}
function crc32(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i += 1) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ (-1)) >>> 0;
}
export async function createRobustZip(files) {
    const parts = [];
    const cd = [];
    let offset = 0;
    const enc = new TextEncoder();
    for (const f of files) {
        let data = f.content;
        if (typeof data === 'string') data = enc.encode(data);
        const name = enc.encode(f.name);
        const size = data.length;
        const crc = crc32(data);
        const local = new Uint8Array(30 + name.length + size);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(26, name.length, true);
        lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
        local.set(name, 30); local.set(data, 30 + name.length); parts.push(local);

        const central = new Uint8Array(46 + name.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(28, name.length, true);
        cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint32(42, offset, true);
        central.set(name, 46); cd.push(central); offset += local.length;
    }
    const cdSize = cd.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    return new Blob([...parts, ...cd, end], { type: 'application/zip' });
}

export function computeDetectedCounts(messages = []) {
    let photos = 0;
    let files = 0;
    let others = 0;
    const imgRegex = /\[\[IMG:[\s\S]*?\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
    for (const m of messages) {
        const content = m.content || '';
        photos += (content.match(imgRegex) || []).length;
        files += (content.match(fileRegex) || []).length;
        others += (content.match(/```/g) || []).length / 2;
    }
    return { messages: messages.length, photos: Math.round(photos), files: Math.round(files), others: Math.round(others) };
}

// Generate files for varying formats
export async function generateContent(fmt, data, urlMap, checkers) {
    const msgs = data.messages || [];
    const title = data.title || 'Export';
    const platform = data.platform || 'Unknown';
    const exportDate = new Date().toISOString();

    if (fmt === 'pdf') {
        const useRaster = checkers.useRaster || false;
        if (useRaster) {
            const allText = msgs.map((m) => m.content || '').join(' ');
            const needsCanvasPdf = checkers.hasNonLatinChars(allText) || extractAllImageSources(msgs).length > 0;
            const pdf = needsCanvasPdf ? await checkers.buildCanvasPdf(title, msgs) : checkers.buildTextPdf(title, msgs);
            return { content: pdf, mime: 'application/pdf' };
        }

        try {
            const pdf = await checkers.buildSearchablePdf(title, msgs, platform, urlMap);
            return { content: pdf, mime: 'application/pdf' };
        } catch (cdpErr) {
            console.warn('[PDF] chrome.debugger failed, falling back to raster:', cdpErr.message);
            const allText = msgs.map((m) => m.content || '').join(' ');
            const needsCanvasPdf = checkers.hasNonLatinChars(allText) || extractAllImageSources(msgs).length > 0;
            const pdf = needsCanvasPdf ? await checkers.buildCanvasPdf(title, msgs) : checkers.buildTextPdf(title, msgs);
            return { content: pdf, mime: 'application/pdf' };
        }
    }

    if (fmt === 'doc') {
        const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
        const renderFn = urlMap ? (c) => renderRichMessageHtmlWithAssets(c, urlMap) : renderRichMessageHtml;
        const body = msgs.map((m) => {
            return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderFn(m.content)}</div></div>`;
        }).join('');
        const html = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
        return { content: html, mime: 'application/msword', ext: 'doc' };
    }

    if (fmt === 'html') {
        const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
        const renderFn = urlMap ? (c) => renderRichMessageHtmlWithAssets(c, urlMap) : renderRichMessageHtml;
        const body = msgs.map((m) => {
            return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderFn(m.content)}</div></div>`;
        }).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
        return { content: html, mime: 'text/html' };
    }

    const safeCsvCell = (str) => {
        let s = String(str || '').replace(/"/g, '""').replace(/\n/g, ' ');
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return `"${s}"`;
    };
    const safeSqlString = (str) => {
        return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
    };

    if (fmt === 'json') return { content: JSON.stringify({ schema: 'chat-export.v1', platform, exported_at: exportDate, title, messages: msgs.map((m, i) => ({ index: i, role: m.role, content: stripImageTokens(m.content) })) }, null, 2), mime: 'application/json' };
    if (fmt === 'csv') {
        const header = '\uFEFFIndex,Role,Platform,Content,ExportedAt';
        const rows = msgs.map((m, i) => `${i},${safeCsvCell(m.role)},${safeCsvCell(platform)},${safeCsvCell(stripImageTokens(m.content))},${safeCsvCell(exportDate)}`);
        return { content: `${header}\n${rows.join('\n')}`, mime: 'text/csv' };
    }
    if (fmt === 'sql') return { content: `CREATE TABLE chat_export (id SERIAL PRIMARY KEY, msg_index INT, role VARCHAR(50), platform VARCHAR(100), content TEXT, exported_at TIMESTAMP);\n` + msgs.map((m, i) => `INSERT INTO chat_export (msg_index, role, platform, content, exported_at) VALUES (${i}, '${safeSqlString(m.role)}', '${safeSqlString(platform)}', '${safeSqlString(stripImageTokens(m.content))}', '${safeSqlString(exportDate)}');`).join('\n'), mime: 'application/sql' };
    if (fmt === 'txt') return { content: msgs.map((m, i) => `[${i}] [${m.role}] ${stripImageTokens(m.content)}`).join('\n\n'), mime: 'text/plain' };

    const mdContent = msgs.map((m) => {
        let content = urlMap ? rewriteContentWithLocalAssets(m.content, urlMap) : m.content;
        // Bug 3 fix: convert [[IMG:...]] tokens to markdown image syntax so they render in ZIP
        content = (content || '').replace(/\[\[IMG:([\s\S]*?)\]\]/g, (_, src) => {
            const s = src.trim();
            if (!s) return '';
            const displaySrc = urlMap ? (normalizeImageSrcForOutput(s) || s) : s;
            return `\n![Image](${displaySrc})\n`;
        });

        // Convert [[FILE:...]] tokens to markdown links
        content = content.replace(/\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g, (_, url, name) => {
            return `[📎 ${name.trim()}](${url.trim()})`;
        });

        return `**${m.role}**\n\n${content}`;
    }).join('\n');
    return { content: mdContent, mime: 'text/markdown' };
}
