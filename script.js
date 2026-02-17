// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// script.js - Main Controller v0.9.31

document.addEventListener('DOMContentLoaded', () => {
  let currentChatData = null;
  let activeTabId = null;

  const btnExport = document.getElementById('btn-export-main');
  const checkImages = document.getElementById('check-images');
  const checkCode = document.getElementById('check-code');
  const checkRawHtml = document.getElementById('check-raw-html');
  const checkZip = document.getElementById('check-zip');
  const btnLogs = document.getElementById('btn-download-logs');

  const settingsModal = document.getElementById('settings-modal');
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const errorMsg = document.getElementById('error-msg');
  const errorFix = document.getElementById('error-fix');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
    activeTabId = tabs[0].id;
    chrome.runtime.sendMessage({ action: 'GET_DATA', tabId: activeTabId }, (res) => {
      if (res?.data) processData(res.data);
      else requestExtraction();
    });
  });

  function requestExtraction() {
    const options = {
      convertImages: checkImages.checked,
      rawHtml: checkRawHtml.checked,
      highlightCode: checkCode.checked
    };

    chrome.tabs.sendMessage(activeTabId, { action: 'extract_chat', options }, (res) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(activeTabId, { action: 'extract_chat', options }, processData);
          }, 500);
        });
        return;
      }
      processData(res);
    });
  }

  function processData(res) {
    if (res?.success) {
      currentChatData = res;
      document.getElementById('platform-badge').textContent = res.platform;
      document.getElementById('msg-count').textContent = res.messages.length;
      document.getElementById('empty-view').style.display = 'none';
      document.getElementById('stats-view').style.display = 'block';
      chrome.runtime.sendMessage({ action: 'SET_DATA', tabId: activeTabId, data: res });
      updateExportBtn();
      return;
    }

    if (res?.platform) {
      document.getElementById('platform-badge').textContent = `${res.platform} (Wait)`;
    }
  }

  document.querySelectorAll('.format-item').forEach((item) => {
    item.onclick = () => {
      item.classList.toggle('selected');
      updateExportBtn();
    };
  });

  function updateExportBtn() {
    const count = document.querySelectorAll('.format-item.selected').length;
    btnExport.disabled = count === 0 || !currentChatData;
    btnExport.textContent = count > 1 ? `Generate Bundle (${count})` : 'Generate File';
  }

  btnLogs.onclick = () => {
    chrome.runtime.sendMessage({ action: 'GET_LOGS' }, (logs) => {
      downloadBlob(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }), 'ai_exporter_logs.json');
    });
  };

  btnExport.onclick = async () => {
    const formats = Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    if (!formats.length || !currentChatData) return;

    btnExport.disabled = true;
    btnExport.textContent = 'Processing...';
    try {
      const date = new Date().toISOString().slice(0, 10);
      const baseName = `${(currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;
      const files = [];

      for (const fmt of formats) {
        const generated = await generateContent(fmt, currentChatData);
        files.push({ name: `${baseName}.${fmt}`, content: generated.content, mime: generated.mime });
      }

      if (files.length === 1 && !checkZip.checked) {
        const data = files[0].content instanceof Uint8Array ? files[0].content : String(files[0].content);
        downloadBlob(new Blob([data], { type: files[0].mime }), files[0].name);
      } else {
        const zip = await createRobustZip(files);
        downloadBlob(zip, `${baseName}.zip`);
      }
    } catch (error) {
      showError(error);
    } finally {
      updateExportBtn();
    }
  };

  function showError(error) {
    errorMsg.textContent = error?.message || 'Unknown export error';
    errorFix.textContent = 'Try "Load Full Chat" first, then retry export. If PDF fails, test HTML/DOC to verify extracted images.';
    errorModal.style.display = 'flex';
  }

  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeImageSrc(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    return '';
  }

  function replaceImageTokensForHtml(content) {
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
    return content.replace(tokenRegex, (_, rawSrc) => {
      const src = normalizeImageSrc(rawSrc.trim());
      if (!src) return '';
      return `<img src="${src}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
    });
  }

  function replaceImageTokensForText(content) {
    return content.replace(/\[\[IMG:([\s\S]*?)\]\]/g, (_, rawSrc) => {
      const src = normalizeImageSrc(rawSrc.trim());
      return src ? `[Image: ${src}]` : '';
    });
  }

  async function generateContent(fmt, data) {
    const msgs = data.messages || [];
    const title = data.title || 'Export';

    if (fmt === 'pdf') {
      const pdfBytes = buildTextPdf(title, msgs);
      return { content: pdfBytes, mime: 'application/pdf' };
    }

    if (fmt === 'doc' || fmt === 'html') {
      const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto} .msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}pre{background:#111827;color:#f3f4f6;padding:10px;border-radius:6px;overflow:auto}';
      const body = msgs.map((m) => {
        const safe = escapeHtml(m.content).replace(/\n/g, '<br>');
        const withImages = replaceImageTokensForHtml(safe);
        return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${withImages}</div></div>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
      return { content: html, mime: fmt === 'doc' ? 'application/msword' : 'text/html' };
    }

    if (fmt === 'sql') {
      const sql = 'CREATE TABLE chat_export (id SERIAL PRIMARY KEY, role VARCHAR(50), content TEXT);\n' +
        msgs.map((m) => `INSERT INTO chat_export (role, content) VALUES ('${m.role.replace(/'/g, "''")}', '${replaceImageTokensForText(m.content).replace(/'/g, "''")}');`).join('\n');
      return { content: sql, mime: 'application/sql' };
    }

    if (fmt === 'json') {
      const payload = {
        platform: data.platform,
        messages: msgs.map((m) => ({ role: m.role, content: replaceImageTokensForText(m.content).replace(/\n/g, ' ') }))
      };
      return { content: JSON.stringify(payload, null, 2), mime: 'application/json' };
    }

    if (fmt === 'csv') {
      const csv = '\uFEFFRole,Content\n' + msgs
        .map((m) => `"${m.role.replace(/"/g, '""')}","${replaceImageTokensForText(m.content).replace(/"/g, '""').replace(/\n/g, ' ')}"`)
        .join('\n');
      return { content: csv, mime: 'text/csv' };
    }

    if (fmt === 'txt') {
      const txt = msgs.map((m) => `[${m.role}] ${replaceImageTokensForText(m.content).replace(/\n/g, ' ')}`).join('\n');
      return { content: txt, mime: 'text/plain' };
    }

    const md = msgs.map((m) => `### ${m.role}\n${m.content}\n`).join('\n');
    return { content: md, mime: 'text/markdown' };
  }

  function utf16beHex(text) {
    let hex = 'FEFF';
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code <= 0xffff) hex += code.toString(16).padStart(4, '0');
    }
    return `<${hex}>`;
  }

  function buildTextPdf(title, messages) {
    const lines = [title, ''];
    messages.forEach((m) => {
      lines.push(`[${m.role}]`);
      lines.push(replaceImageTokensForText(m.content));
      lines.push('');
    });

    const contentOps = [];
    let y = 800;
    for (const line of lines) {
      const chunks = wrapLine(line, 90);
      for (const chunk of chunks) {
        contentOps.push(`BT /F1 11 Tf 40 ${y} Td ${utf16beHex(chunk)} Tj ET`);
        y -= 14;
        if (y < 40) break;
      }
      if (y < 40) break;
    }

    const stream = contentOps.join('\n');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /Helvetica /Encoding /Identity-H /DescendantFonts [6 0 R] >>\nendobj\n',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
      '6 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /Helvetica /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>\nendobj\n'
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(pdf.length);
      pdf += obj;
    }
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }

  function wrapLine(text, maxLen) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [''];
    const words = clean.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxLen) {
        lines.push(line.trim());
        line = word;
      } else {
        line += ` ${word}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

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

  async function createRobustZip(files) {
    const parts = [];
    const cd = [];
    let offset = 0;
    const encoder = new TextEncoder();

    for (const file of files) {
      let data = file.content;
      if (typeof data === 'string') data = encoder.encode(data);
      const name = encoder.encode(file.name);
      const size = data.length;
      const crc = crc32(data);

      const local = new Uint8Array(30 + name.length + size);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(26, name.length, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, size, true);
      localView.setUint32(22, size, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      parts.push(local);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, size, true);
      centralView.setUint32(24, size, true);
      centralView.setUint32(42, offset, true);
      central.set(name, 46);
      cd.push(central);

      offset += local.length;
    }

    const cdSize = cd.reduce((acc, cur) => acc + cur.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, cdSize, true);
    endView.setUint32(16, offset, true);

    return new Blob([...parts, ...cd, end], { type: 'application/zip' });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const openModal = (m) => { if (m) m.style.display = 'flex'; };
  const closeModal = (m) => { if (m) m.style.display = 'none'; };

  document.getElementById('btn-open-settings').onclick = () => openModal(settingsModal);
  document.getElementById('btn-close-settings').onclick = document.getElementById('btn-save-settings').onclick = () => closeModal(settingsModal);
  document.getElementById('btn-open-about').onclick = () => openModal(aboutModal);
  document.getElementById('btn-close-about').onclick = document.getElementById('btn-ack-about').onclick = () => closeModal(aboutModal);
  document.getElementById('btn-close-error').onclick = () => closeModal(errorModal);
  document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));

  document.getElementById('btn-preview').onclick = () => {
    if (!currentChatData) return;
    const previewText = currentChatData.messages.slice(0, 5)
      .map((m) => `[${m.role}]\n${replaceImageTokensForText(m.content).slice(0, 250)}...`)
      .join('\n\n');
    document.getElementById('preview-content').textContent = `--- PREVIEW ---\n${previewText}`;
    openModal(document.getElementById('preview-modal'));
  };
});
