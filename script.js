// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// script.js - Main Controller v0.10.6

document.addEventListener('DOMContentLoaded', () => {
  let currentChatData = null;
  let activeTabId = null;

  const btnExport = document.getElementById('btn-export-main');
  const btnLoadFull = document.getElementById('btn-load-full');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnPreview = document.getElementById('btn-preview');
  const btnExportImages = document.getElementById('btn-export-images');
  const btnLogs = document.getElementById('btn-download-logs');
  const btnExportConfig = document.getElementById('btn-export-config');
  const checkImages = document.getElementById('check-images');
  const checkCode = document.getElementById('check-code');
  const checkRawHtml = document.getElementById('check-raw-html');
  const checkZip = document.getElementById('check-zip');
  const checkPhotoZip = document.getElementById('check-photo-zip');

  const settingsModal = document.getElementById('settings-modal');
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const infoModal = document.getElementById('info-modal');
  const errorMsg = document.getElementById('error-msg');
  const errorFix = document.getElementById('error-fix');

  init();


  const SETTINGS_KEY = 'ai_exporter_settings_v1';

  function getDefaultSettings() {
    return {
      convertImages: true,
      highlightCode: true,
      rawHtml: false,
      zip: false,
      photoZip: true
    };
  }

  function collectSettings() {
    return {
      convertImages: !!checkImages.checked,
      highlightCode: !!checkCode.checked,
      rawHtml: !!checkRawHtml.checked,
      zip: !!checkZip.checked,
      photoZip: !!checkPhotoZip.checked,
      updatedAt: new Date().toISOString()
    };
  }

  function applySettings(settings) {
    const s = { ...getDefaultSettings(), ...(settings || {}) };
    checkImages.checked = !!s.convertImages;
    checkCode.checked = !!s.highlightCode;
    checkRawHtml.checked = !!s.rawHtml;
    checkZip.checked = !!s.zip;
    checkPhotoZip.checked = !!s.photoZip;
  }

  function saveSettingsToStorage(settings) {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  function loadSettingsFromStorage() {
    chrome.storage.local.get([SETTINGS_KEY], (res) => {
      applySettings(res?.[SETTINGS_KEY] || getDefaultSettings());
    });
  }

  function exportSettingsCfg(settings) {
    const lines = Object.entries(settings).map(([k, v]) => `${k}=${String(v)}`);
    const cfg = `# AI Chat Exporter Settings\n# version=0.10.6\n${lines.join('\n')}\n`;
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([cfg], { type: 'text/plain' }), `ai_chat_exporter_settings_${date}.cfg`);
  }

  function init() {
    loadSettingsFromStorage();
    setAnalyzeProgress(10, 'Initializing');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
      activeTabId = tabs[0].id;
      chrome.runtime.sendMessage({ action: 'GET_DATA', tabId: activeTabId }, (res) => {
        if (res?.data) processData(res.data);
        else requestExtraction();
      });
    });
  }

  function requestExtraction() {
    const options = { convertImages: checkImages.checked, rawHtml: checkRawHtml.checked, highlightCode: checkCode.checked };
    setAnalyzeProgress(30, 'Extracting');
    chrome.tabs.sendMessage(activeTabId, { action: 'extract_chat', options }, (res) => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] }, () => {
          setTimeout(() => chrome.tabs.sendMessage(activeTabId, { action: 'extract_chat', options }, processData), 600);
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
      setAnalyzeProgress(100, 'Completed');
      chrome.runtime.sendMessage({ action: 'SET_DATA', tabId: activeTabId, data: res });
      updateExportBtn();
      return;
    }
    document.getElementById('platform-badge').textContent = `${res?.platform || 'Unknown'} (Waiting)`;
    setAnalyzeProgress(0, 'Waiting');
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

  function setProcessingProgress(percent, label = 'Processing') {
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    btnExport.textContent = `${label} ${bounded}%`;
  }

  function setAnalyzeProgress(percent, label = 'Analyzing') {
    const el = document.getElementById('analyze-progress');
    if (!el) return;
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    el.textContent = `Analysis Progress: ${bounded}% (${label})`;
  }

  btnExport.onclick = async () => {
    const formats = Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    if (!formats.length || !currentChatData) return;
    btnExport.disabled = true;
    setProcessingProgress(2);

    try {
      const date = new Date().toISOString().slice(0, 10);
      const baseName = `${(currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;
      const files = [];

      for (let i = 0; i < formats.length; i += 1) {
        const fmt = formats[i];
        const generated = await generateContent(fmt, currentChatData);
        files.push({ name: `${baseName}.${fmt}`, content: generated.content, mime: generated.mime });
        const percent = 10 + ((i + 1) / Math.max(1, formats.length)) * 75;
        setProcessingProgress(percent, `Processing ${fmt.toUpperCase()}`);
      }

      if (files.length === 1 && !checkZip.checked) {
        setProcessingProgress(95, 'Finalizing');
        downloadBlob(new Blob([files[0].content], { type: files[0].mime }), files[0].name);
      } else {
        setProcessingProgress(90, 'Packaging');
        const zip = await createRobustZip(files);
        setProcessingProgress(98, 'Downloading');
        downloadBlob(zip, `${baseName}.zip`);
      }
      setProcessingProgress(100, 'Done');
    } catch (error) {
      showError(error);
    } finally {
      updateExportBtn();
    }
  };

  btnLoadFull.onclick = () => {
    if (!activeTabId) return;
    const ok = window.confirm('Load full chat from the beginning? This may take longer for long chats.');
    if (!ok) return;
    setAnalyzeProgress(5, 'Preparing full-load scan');
    chrome.tabs.sendMessage(activeTabId, { action: 'scroll_chat' }, () => {
      setAnalyzeProgress(80, 'Finalizing full-load scan');
      setTimeout(requestExtraction, 800);
    });
  };

  btnClearAll.onclick = () => {
    currentChatData = null;
    document.getElementById('platform-badge').textContent = 'Cleared';
    document.getElementById('msg-count').textContent = '0';
    document.getElementById('empty-view').style.display = 'block';
    document.getElementById('stats-view').style.display = 'none';
    if (activeTabId) chrome.runtime.sendMessage({ action: 'CLEAR_DATA', tabId: activeTabId });
    updateExportBtn();
  };

  btnPreview.onclick = () => {
    if (!currentChatData) return;
    const previewText = currentChatData.messages.slice(0, 6).map((m) => `[${m.role}]\n${replaceImageTokensForText(m.content).slice(0, 240)}...`).join('\n\n');
    document.getElementById('preview-content').textContent = `--- PREVIEW ---\n${previewText}`;
    openModal(document.getElementById('preview-modal'));
  };

  btnExportConfig.onclick = () => {
    const settings = collectSettings();
    saveSettingsToStorage(settings);
    exportSettingsCfg(settings);
  };

  btnLogs.onclick = () => {
    chrome.runtime.sendMessage({ action: 'GET_LOGS' }, (logs) => {
      downloadBlob(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }), 'ai_exporter_logs.json');
    });
  };

  btnExportImages.onclick = async () => {
    if (!currentChatData) return;
    const imageList = extractAllImageSources(currentChatData.messages);
    if (!imageList.length) return showError(new Error('No images found in extracted chat data.'));

    const packMode = !!checkPhotoZip.checked;
    const date = new Date().toISOString().slice(0, 10);
    const platformPrefix = (currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '');

    if (!packMode) {
      let idx = 1;
      for (const src of imageList) {
        const extGuess = src.includes('png') ? 'png' : (src.includes('webp') ? 'webp' : 'jpg');
        chrome.downloads.download({ url: src, filename: `ai_chat_exporter/${platformPrefix}_${date}_photo_${String(idx).padStart(3, '0')}.${extGuess}`, saveAs: false });
        idx += 1;
      }
      return;
    }

    const files = [];
    let idx = 1;
    for (const src of imageList) {
      try {
        const b = await fetch(src).then((r) => r.blob());
        const ext = (b.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const data = new Uint8Array(await b.arrayBuffer());
        files.push({ name: `photo_${String(idx).padStart(3, '0')}.${ext}`, content: data, mime: b.type || 'application/octet-stream' });
        idx += 1;
      } catch {
        // skip failed image
      }
    }

    if (files.length) {
      const zip = await createRobustZip(files);
      downloadBlob(zip, `${platformPrefix}_${date}_photos.zip`);
    }
  };

  document.getElementById('link-legal').onclick = () => showInfo('Legal', 'This is a local-processing developer version. Users remain responsible for lawful and compliant use in their jurisdiction.');
  document.getElementById('link-security').onclick = () => showInfo('Security', 'Security baseline: local-only processing, sanitized exports, no eval, and optional risky Raw HTML mode.');
  document.getElementById('btn-close-info').onclick = () => closeModal(infoModal);

  function showInfo(title, body) {
    document.getElementById('info-title').textContent = title;
    document.getElementById('info-body').textContent = body;
    openModal(infoModal);
  }

  function showError(error) {
    errorMsg.textContent = error?.message || 'Unknown export error.';
    errorFix.textContent = 'Use Fetch Full first. If images still missing, enable Include Images and retry.';
    errorModal.style.display = 'flex';
  }

  function escapeHtml(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function normalizeImageSrc(src) {
    if (!src) return '';
    if (/^data:image\//i.test(src)) return src;
    if (/^https?:\/\//i.test(src)) return src;
    return '';
  }

  function stripImageTokens(content) {
    return (content || '')
      .replace(/\[\[IMG:[\s\S]*?\]\]/g, '')
      .replace(/!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function replaceImageTokensForText(content) {
    return stripImageTokens(content);
  }

  function replaceImageTokensForHtml(content) {
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]/g;
    const markdownRegex = /!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    return content
      .replace(tokenRegex, (_, src) => renderImgTag(src))
      .replace(markdownRegex, (_, src) => renderImgTag(src));
  }

  function renderImgTag(rawSrc) {
    const src = normalizeImageSrc((rawSrc || '').trim());
    if (!src) return '';
    return `<img src="${src}" alt="Image" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:6px;">`;
  }

  function renderRichMessageHtml(content) {
    const parts = splitContentAndImages(content || '');
    return parts.map((part) => {
      if (part.type === 'image') return renderImgTag(part.value);
      return escapeHtml(part.value || '').replace(/\n/g, '<br>');
    }).join('');
  }

  function extractAllImageSources(messages) {
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

  async function generateContent(fmt, data) {
    const msgs = data.messages || [];
    const title = data.title || 'Export';

    if (fmt === 'pdf') {
      const pdf = await buildRichPdf(title, msgs);
      return { content: pdf, mime: 'application/pdf' };
    }

    if (fmt === 'doc' || fmt === 'html') {
      const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
      const body = msgs.map((m) => {
        return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderRichMessageHtml(m.content)}</div></div>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
      return { content: html, mime: fmt === 'doc' ? 'application/msword' : 'text/html' };
    }

    if (fmt === 'json') return { content: JSON.stringify({ platform: data.platform, messages: msgs.map((m) => ({ role: m.role, content: stripImageTokens(m.content).replace(/\n/g, ' ') })) }, null, 2), mime: 'application/json' };
    if (fmt === 'csv') return { content: '\uFEFFRole,Content\n' + msgs.map((m) => `"${m.role.replace(/"/g, '""')}","${stripImageTokens(m.content).replace(/"/g, '""').replace(/\n/g, ' ')}"`).join('\n'), mime: 'text/csv' };
    if (fmt === 'sql') return { content: 'CREATE TABLE chat_export (id SERIAL PRIMARY KEY, role VARCHAR(50), content TEXT);\n' + msgs.map((m) => `INSERT INTO chat_export (role, content) VALUES ('${m.role.replace(/'/g, "''")}', '${stripImageTokens(m.content).replace(/'/g, "''")}');`).join('\n'), mime: 'application/sql' };
    if (fmt === 'txt') return { content: msgs.map((m) => `[${m.role}] ${stripImageTokens(m.content).replace(/\n/g, ' ')}`).join('\n'), mime: 'text/plain' };
    return { content: msgs.map((m) => `### ${m.role}\n${m.content}\n`).join('\n'), mime: 'text/markdown' };
  }

  async function buildRichPdf(title, messages) {
    const pageWidth = 1240;
    const pageHeight = 1754;
    const margin = 56;
    const pageDataUrls = [];

    let canvas = document.createElement('canvas');
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    let ctx = canvas.getContext('2d');
    let y = margin;

    const resetPage = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pageWidth, pageHeight);
      ctx.textBaseline = 'top';
      y = margin;
    };

    const pushPage = () => {
      pageDataUrls.push(canvas.toDataURL('image/jpeg', 0.92));
      canvas = document.createElement('canvas');
      canvas.width = pageWidth;
      canvas.height = pageHeight;
      ctx = canvas.getContext('2d');
      resetPage();
    };

    const ensureSpace = (need) => {
      if (y + need <= pageHeight - margin) return;
      pushPage();
    };

    const drawTextBlock = (text, font, color = '#111111', lineHeight = 28, maxChars = 90) => {
      ctx.font = font;
      ctx.fillStyle = color;
      const lines = wrapLine(text, maxChars);
      for (const line of lines) {
        ensureSpace(lineHeight + 4);
        ctx.fillText(line, margin, y);
        y += lineHeight;
      }
    };

    resetPage();
    drawTextBlock(title, 'bold 36px Arial, Tahoma, sans-serif', '#111827', 40, 64);
    y += 8;

    for (const message of messages) {
      drawTextBlock(`[${message.role}]`, 'bold 26px Arial, Tahoma, sans-serif', '#1D4ED8', 32, 64);
      const parts = splitContentAndImages(message.content);
      for (const part of parts) {
        if (part.type === 'text') {
          drawTextBlock(stripImageTokens(part.value), '24px Arial, Tahoma, sans-serif', '#111111', 30, 88);
          continue;
        }
        const src = normalizeImageSrc((part.value || '').trim());
        if (!src) continue;
        const img = await loadImage(src);
        if (!img) continue;
        const maxW = pageWidth - margin * 2;
        const w = Math.min(maxW, img.width || maxW);
        const h = Math.max(36, Math.round((img.height / Math.max(img.width, 1)) * w));
        ensureSpace(h + 14);
        ctx.drawImage(img, margin, y, w, h);
        y += h + 12;
      }
      y += 10;
    }

    pageDataUrls.push(canvas.toDataURL('image/jpeg', 0.92));
    return buildPdfFromJpegPages(pageDataUrls, pageWidth, pageHeight);
  }

  function splitContentAndImages(content) {
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

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function buildPdfFromJpegPages(pageDataUrls, widthPx, heightPx) {
    const pointsPerPx = 0.75;
    const w = Math.round(widthPx * pointsPerPx);
    const h = Math.round(heightPx * pointsPerPx);
    const objects = [];

    objects[1] = toBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    const kids = [];
    let objNum = 3;
    const pageDefs = [];
    for (let i = 0; i < pageDataUrls.length; i += 1) {
      const pageObj = objNum;
      const contentObj = objNum + 1;
      const imageObj = objNum + 2;
      kids.push(`${pageObj} 0 R`);
      pageDefs.push({ pageObj, contentObj, imageObj, dataUrl: pageDataUrls[i], index: i + 1 });
      objNum += 3;
    }
    objects[2] = toBytes(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageDefs.length} >>\nendobj\n`);

    for (const def of pageDefs) {
      const stream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im${def.index} Do\nQ`;
      const jpgBytes = dataUrlToBytes(def.dataUrl);
      objects[def.pageObj] = toBytes(
        `${def.pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${def.index} ${def.imageObj} 0 R >> >> /Contents ${def.contentObj} 0 R >>\nendobj\n`
      );
      objects[def.contentObj] = toBytes(`${def.contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
      objects[def.imageObj] = concatBytes(
        toBytes(`${def.imageObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`),
        jpgBytes,
        toBytes('\nendstream\nendobj\n')
      );
    }

    const valid = [];
    for (let i = 1; i < objects.length; i += 1) if (objects[i]) valid.push({ idx: i, bytes: objects[i] });

    const chunks = [toBytes('%PDF-1.4\n')];
    const offsets = [0];
    let offset = chunks[0].length;
    for (const obj of valid) {
      offsets[obj.idx] = offset;
      chunks.push(obj.bytes);
      offset += obj.bytes.length;
    }
    const xrefStart = offset;
    const maxObj = valid[valid.length - 1].idx;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxObj; i += 1) xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    chunks.push(toBytes(xref));
    chunks.push(toBytes(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
    return concatBytes(...chunks);
  }

  function toBytes(text) {
    return new TextEncoder().encode(text);
  }

  function dataUrlToBytes(dataUrl) {
    const b64 = (dataUrl.split(',')[1] || '');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  function concatBytes(...arrays) {
    const total = arrays.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const arr of arrays) {
      out.set(arr, pos);
      pos += arr.length;
    }
    return out;
  }

  function wrapLine(text, max) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > max) {
        if (line.trim()) lines.push(line.trim());
        line = w;
      } else {
        line += ` ${w}`;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.length ? lines : [''];
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
  document.getElementById('btn-close-settings').onclick = () => closeModal(settingsModal);
  document.getElementById('btn-save-settings').onclick = () => {
    const settings = collectSettings();
    saveSettingsToStorage(settings);
    exportSettingsCfg(settings);
    closeModal(settingsModal);
  };
  document.getElementById('btn-open-about').onclick = () => openModal(aboutModal);
  document.getElementById('btn-open-login').onclick = () => showInfo('Login (Draft)', 'Draft login page is reserved for future account features. Current version works locally with your active browser session only.');
  document.getElementById('btn-open-contact').onclick = () => showInfo('Contact (Draft)', 'Draft contact page is reserved for support and compliance requests.');
  document.getElementById('btn-close-about').onclick = document.getElementById('btn-ack-about').onclick = () => closeModal(aboutModal);
  document.getElementById('btn-close-error').onclick = () => closeModal(errorModal);
  document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));
});
