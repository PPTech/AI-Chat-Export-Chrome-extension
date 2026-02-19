// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// script.js - Main Controller v0.10.11

document.addEventListener('DOMContentLoaded', () => {
  let currentChatData = null;
  let activeTabId = null;
  let lastDiagnostics = null; // stores last export's flight recorder data
  let lastAssetFailures = []; // stores last export's asset resolution failures

  const btnExport = document.getElementById('btn-export-main');
  const btnLoadFull = document.getElementById('btn-load-full');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnPreview = document.getElementById('btn-preview');
  const btnExportImages = document.getElementById('btn-export-images');
  const btnExportFiles = document.getElementById('btn-export-files');
  const btnLogs = document.getElementById('btn-download-logs');
  const btnExportConfig = document.getElementById('btn-export-config');
  const checkImages = document.getElementById('check-images');
  const checkCode = document.getElementById('check-code');
  const checkRawHtml = document.getElementById('check-raw-html');
  const checkZip = document.getElementById('check-zip');
  const checkPhotoZip = document.getElementById('check-photo-zip');
  const checkExportFiles = document.getElementById('check-export-files');
  const checkAdvancedLinks = document.getElementById('check-advanced-links');
  const checkDebugMode = document.getElementById('check-debug-mode');
  const btnDownloadDiagnostics = document.getElementById('btn-download-diagnostics');

  const settingsModal = document.getElementById('settings-modal');
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const infoModal = document.getElementById('info-modal');
  const errorMsg = document.getElementById('error-msg');
  const errorFix = document.getElementById('error-fix');

  const SETTINGS_KEY = 'ai_exporter_settings_v1';

  function getDefaultSettings() {
    return {
      convertImages: true,
      highlightCode: true,
      rawHtml: false,
      zip: false,
      photoZip: true,
      exportFiles: true,
      advancedLinks: false,
      debugMode: false
    };
  }

  function collectSettings() {
    return {
      convertImages: !!checkImages.checked,
      highlightCode: !!checkCode.checked,
      rawHtml: !!checkRawHtml.checked,
      zip: !!checkZip.checked,
      photoZip: !!checkPhotoZip.checked,
      exportFiles: !!checkExportFiles.checked,
      advancedLinks: !!checkAdvancedLinks.checked,
      debugMode: !!checkDebugMode.checked,
      updatedAt: new Date().toISOString()
    };
  }

  function isDebugMode() {
    return !!checkDebugMode.checked;
  }

  function applySettings(settings) {
    const s = { ...getDefaultSettings(), ...(settings || {}) };
    checkImages.checked = !!s.convertImages;
    checkCode.checked = !!s.highlightCode;
    checkRawHtml.checked = !!s.rawHtml;
    checkZip.checked = !!s.zip;
    checkPhotoZip.checked = !!s.photoZip;
    checkExportFiles.checked = !!s.exportFiles;
    checkAdvancedLinks.checked = !!s.advancedLinks;
    checkDebugMode.checked = !!s.debugMode;
    if (btnDownloadDiagnostics) btnDownloadDiagnostics.style.display = s.debugMode ? 'block' : 'none';
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
    const cfg = `# AI Chat Exporter Settings\n# version=0.10.8\n${lines.join('\n')}\n`;
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([cfg], { type: 'text/plain' }), `ai_chat_exporter_settings_${date}.cfg`);
  }

  function safeInit() {
    try {
      init();
    } catch (error) {
      document.getElementById('platform-badge').textContent = 'Initialization Failed';
      setAnalyzeProgress(0, 'Initialization failed');
      console.error('Init error:', error);
    }
  }

  function init() {
    loadSettingsFromStorage();
    setAnalyzeProgress(5, 'Initializing');
    updateDetectedSummary([]);
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
    const options = { convertImages: checkImages.checked, rawHtml: checkRawHtml.checked, highlightCode: checkCode.checked, extractFiles: checkExportFiles.checked };
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
    if (!res) {
      document.getElementById('platform-badge').textContent = 'No Data (Retrying)';
      setAnalyzeProgress(0, 'Retrying');
      return;
    }
    if (res?.success) {
      currentChatData = res;
      document.getElementById('platform-badge').textContent = res.platform;
      document.getElementById('msg-count').textContent = res.messages.length;
      document.getElementById('empty-view').style.display = 'none';
      document.getElementById('stats-view').style.display = 'block';
      updateDetectedSummary(res.messages || []);
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

  function computeDetectedCounts(messages = []) {
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

  function updateDetectedSummary(messages = []) {
    const el = document.getElementById('detected-summary');
    if (!el) return;
    const c = computeDetectedCounts(messages);
    el.textContent = `Detected: ${c.messages} messages • ${c.photos} photos • ${c.files} files • ${c.others} others`;
  }

  // --- Inline flight recorder (popup context, no ES modules) ---
  function createPopupFlightRecorder(runId, platform) {
    const entries = [];
    const startedAt = new Date().toISOString();
    let counter = 0;
    function makeId() { counter++; return `${runId}-${counter}-${Date.now()}`; }
    function record(opts = {}) {
      const entry = {
        ts: Date.now(), lvl: opts.lvl || 'INFO', event: opts.event || 'unknown',
        runId, eventId: makeId(), parentEventId: opts.parentEventId || null,
        tabScope: activeTabId != null ? `tab:${activeTabId}` : 'global',
        platform: platform || 'unknown', module: opts.module || 'popup',
        phase: opts.phase || 'unknown', result: opts.result || null,
        details: opts.details || null,
      };
      entries.push(entry);
      if (entries.length > 2000) entries.shift();
      return entry;
    }
    function finish(counts = {}, failures = []) {
      const endedAt = new Date().toISOString();
      return {
        schema_version: 'diagnostics.v4',
        run: { run_id: runId, started_at_utc: startedAt, ended_at_utc: endedAt, tool_version: '0.10.11', platform },
        tabScope: activeTabId != null ? `tab:${activeTabId}` : 'global',
        entries, counts, failures,
        scorecard: buildDiagScorecard(counts),
      };
    }
    function toJsonl() { return entries.map((e) => JSON.stringify(e)).join('\n'); }
    return { record, finish, toJsonl, entries };
  }

  function buildDiagScorecard(counts) {
    const total = counts.messages_total || 0;
    const unknown = counts.messages_unknown || 0;
    const ratio = total > 0 ? unknown / total : 0;
    return { messages_total: total, unknown_role_ratio: Number(ratio.toFixed(4)), unknown_role_pass: ratio <= 0.05, has_messages: total > 0 };
  }

  btnExport.onclick = withGesture(async () => {
    const formats = Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    if (!formats.length || !currentChatData) return;
    btnExport.disabled = true;
    setProcessingProgress(2);

    const debug = isDebugMode();
    const runId = `export-${Date.now()}`;
    const recorder = debug ? createPopupFlightRecorder(runId, currentChatData.platform) : null;
    lastAssetFailures = [];

    try {
      if (recorder) recorder.record({ event: 'export.start', module: 'popup', phase: 'assemble', result: 'ok', details: { formats, messageCount: (currentChatData.messages || []).length } });

      const date = new Date().toISOString().slice(0, 10);
      const baseName = `${(currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;
      const files = [];

      for (let i = 0; i < formats.length; i += 1) {
        const fmt = formats[i];
        if (recorder) recorder.record({ event: `export.format.${fmt}`, module: 'export', phase: 'assemble', result: 'ok' });
        const generated = await generateContent(fmt, currentChatData);
        const fileExt = generated.ext || fmt;
        files.push({ name: `${baseName}.${fileExt}`, content: generated.content, mime: generated.mime });
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

      if (recorder) {
        recorder.record({ event: 'export.end', module: 'popup', phase: 'finalize', result: 'ok', details: { fileCount: files.length } });
        const msgs = currentChatData.messages || [];
        const unknownCount = msgs.filter((m) => /unknown/i.test(m.role)).length;
        lastDiagnostics = recorder.finish({ messages_total: msgs.length, messages_unknown: unknownCount }, lastAssetFailures);
      }

      setProcessingProgress(100, 'Done');
    } catch (error) {
      if (recorder) recorder.record({ lvl: 'ERROR', event: 'export.error', module: 'popup', phase: 'finalize', result: 'fail', details: { error: (error?.message || '').slice(0, 200) } });
      if (recorder) {
        const msgs = currentChatData?.messages || [];
        const unknownCount = msgs.filter((m) => /unknown/i.test(m.role)).length;
        lastDiagnostics = recorder.finish({ messages_total: msgs.length, messages_unknown: unknownCount }, lastAssetFailures);
      }
      showError(error);
    } finally {
      updateExportBtn();
    }
  });

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
    updateDetectedSummary([]);
    if (activeTabId) chrome.runtime.sendMessage({ action: 'CLEAR_DATA', tabId: activeTabId });
    updateExportBtn();
  };

  btnPreview.onclick = () => {
    if (!currentChatData) return;
    const previewText = currentChatData.messages.slice(0, 6).map((m) => `[${m.role}]\n${replaceImageTokensForText(m.content).slice(0, 240)}...`).join('\n\n');
    document.getElementById('preview-content').textContent = `--- PREVIEW ---\n${previewText}`;
    openModal(document.getElementById('preview-modal'));
  };

  btnExportConfig.onclick = withGesture(() => {
    const settings = collectSettings();
    saveSettingsToStorage(settings);
    exportSettingsCfg(settings);
  });

  btnLogs.onclick = withGesture(() => {
    chrome.runtime.sendMessage({ action: 'GET_LOGS' }, (logs) => {
      downloadBlob(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }), 'ai_exporter_logs.json');
    });
  });

  btnExportImages.onclick = withGesture(async () => {
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
  });

  btnExportFiles.onclick = withGesture(async () => {
    if (!currentChatData) return;
    if (!checkExportFiles.checked) return showInfo('Files Export Disabled', 'Enable "Extract and ZIP Chat Files" in Settings first.');
    const filesFound = extractAllFileSources(currentChatData.messages);
    if (!filesFound.length) return showError(new Error('No chat-generated file links were detected.'));

    const packed = [];
    let i = 1;
    for (const file of filesFound) {
      try {
        const blob = await fetch(file.url).then((r) => r.blob());
        const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
        const name = file.name.includes('.') ? file.name : `${file.name}.${ext}`;
        const data = new Uint8Array(await blob.arrayBuffer());
        packed.push({ name: `${String(i).padStart(3, '0')}_${name}`, content: data, mime: blob.type || 'application/octet-stream' });
        i += 1;
      } catch {
        // skip failed file
      }
    }
    if (!packed.length) return showError(new Error('Detected files could not be downloaded from current session.'));
    const zip = await createRobustZip(packed);
    const date = new Date().toISOString().slice(0, 10);
    const platformPrefix = (currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '');
    downloadBlob(zip, `${platformPrefix}_${date}_chat_files.zip`);
  });

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

  function extractAllFileSources(messages) {
    const files = [];
    const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
    for (const m of messages || []) {
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

  async function generateContent(fmt, data) {
    const msgs = data.messages || [];
    const title = data.title || 'Export';
    const platform = data.platform || 'Unknown';
    const exportDate = new Date().toISOString();

    if (fmt === 'pdf') {
      const pdf = buildTextPdf(title, msgs);
      return { content: pdf, mime: 'application/pdf' };
    }

    if (fmt === 'doc') {
      // Word-compatible HTML document (.doc extension opens in Word/LibreOffice)
      // No fake MHTML wrapper — this is honest HTML that Word renders correctly.
      const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
      const body = msgs.map((m) => {
        return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderRichMessageHtml(m.content)}</div></div>`;
      }).join('');
      const html = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
      return { content: html, mime: 'application/msword', ext: 'doc' };
    }

    if (fmt === 'html') {
      const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
      const body = msgs.map((m) => {
        return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderRichMessageHtml(m.content)}</div></div>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
      return { content: html, mime: 'text/html' };
    }

    if (fmt === 'json') return { content: JSON.stringify({ schema: 'chat-export.v1', platform, exported_at: exportDate, title, messages: msgs.map((m, i) => ({ index: i, role: m.role, content: stripImageTokens(m.content) })) }, null, 2), mime: 'application/json' };
    if (fmt === 'csv') {
      const header = '\uFEFFIndex,Role,Platform,Content,ExportedAt';
      const rows = msgs.map((m, i) => `${i},"${m.role.replace(/"/g, '""')}","${platform.replace(/"/g, '""')}","${stripImageTokens(m.content).replace(/"/g, '""').replace(/\n/g, ' ')}","${exportDate}"`);
      return { content: `${header}\n${rows.join('\n')}`, mime: 'text/csv' };
    }
    if (fmt === 'sql') return { content: `CREATE TABLE chat_export (id SERIAL PRIMARY KEY, msg_index INT, role VARCHAR(50), platform VARCHAR(100), content TEXT, exported_at TIMESTAMP);\n` + msgs.map((m, i) => `INSERT INTO chat_export (msg_index, role, platform, content, exported_at) VALUES (${i}, '${m.role.replace(/'/g, "''")}', '${platform.replace(/'/g, "''")}', '${stripImageTokens(m.content).replace(/'/g, "''")}', '${exportDate}');`).join('\n'), mime: 'application/sql' };
    if (fmt === 'txt') return { content: msgs.map((m, i) => `[${i}] [${m.role}] ${stripImageTokens(m.content)}`).join('\n\n'), mime: 'text/plain' };
    return { content: msgs.map((m) => `### ${m.role}\n${m.content}\n`).join('\n'), mime: 'text/markdown' };
  }

  function buildTextPdf(title, messages) {
    // Text-based PDF with extractable text (not raster/canvas).
    // Uses PDF text objects (BT/ET) with Helvetica (Type1, built-in).
    const PAGE_W = 595; // A4 points
    const PAGE_H = 842;
    const MARGIN = 50;
    const FONT_SIZE = 10;
    const TITLE_SIZE = 16;
    const ROLE_SIZE = 12;
    const LINE_HEIGHT = 14;
    const MAX_CHARS = 85;

    const pages = []; // each page = array of text operations
    let currentPage = [];
    let cursorY = PAGE_H - MARGIN;

    function ensureSpace(needed) {
      if (cursorY - needed < MARGIN) {
        pages.push(currentPage);
        currentPage = [];
        cursorY = PAGE_H - MARGIN;
      }
    }

    function addLine(text, fontSize = FONT_SIZE, bold = false) {
      const cleaned = pdfEscapeText(text);
      if (!cleaned) return;
      ensureSpace(fontSize + 4);
      const fontName = bold ? '/F2' : '/F1';
      currentPage.push(`BT ${fontName} ${fontSize} Tf ${MARGIN} ${cursorY.toFixed(1)} Td (${cleaned}) Tj ET`);
      cursorY -= (fontSize + 4);
    }

    function addWrappedText(text, fontSize = FONT_SIZE, bold = false) {
      // Strip HTML tags and image tokens before PDF rendering
      const clean = stripHtmlTags(stripImageTokens(text));
      const lines = wrapLineSmart(clean, MAX_CHARS);
      for (const line of lines) {
        addLine(line, fontSize, bold);
      }
    }

    // Title
    addLine(title || 'Chat Export', TITLE_SIZE, true);
    cursorY -= 10;

    // Check for non-Latin content and add warning
    const allText = messages.map((m) => m.content || '').join(' ');
    if (hasNonLatinChars(allText)) {
      addLine('Note: Non-Latin characters (Arabic, Persian, CJK, etc.) are shown as "?" in this PDF.', 8, false);
      addLine('For full Unicode support, use HTML or Markdown export instead.', 8, false);
      cursorY -= 6;
    }

    // Messages
    for (const m of messages) {
      ensureSpace(LINE_HEIGHT * 3);
      addLine(`[${m.role}]`, ROLE_SIZE, true);
      addWrappedText(m.content || '', FONT_SIZE, false);
      cursorY -= 8;
    }

    pages.push(currentPage);

    // Build PDF structure
    return assemblePdfDocument(pages, PAGE_W, PAGE_H);
  }

  /**
   * Strip HTML tags from text, preserving content.
   */
  function stripHtmlTags(text) {
    return String(text || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Detect if text contains non-Latin characters (Arabic, Persian, CJK, etc.)
   */
  function hasNonLatinChars(text) {
    // eslint-disable-next-line no-control-regex
    return /[^\x00-\x7F\xA0-\xFF]/.test(text);
  }

  function pdfEscapeText(text) {
    return String(text || '')
      // Strip any HTML tags that leaked through
      .replace(/<[^>]+>/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      // Keep printable ASCII + common Latin-1 supplement (accented chars)
      // Replace non-Latin chars with ? (Type1 Helvetica limitation)
      .replace(/[^\x20-\x7E\xA0-\xFF\\()]/g, '?')
      .trim();
  }

  function assemblePdfDocument(pages, pageW, pageH) {
    const objects = [];

    // obj 1: catalog
    objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

    // obj 3: Helvetica font
    objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;

    // obj 4: Helvetica-Bold font
    objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`;

    // Resources shared by all pages
    const resourcesRef = '<< /Font << /F1 3 0 R /F2 4 0 R >> >>';

    // Build page objects
    const kids = [];
    let objNum = 5;
    const pageDefs = [];

    for (const ops of pages) {
      const pageObj = objNum;
      const contentObj = objNum + 1;
      kids.push(`${pageObj} 0 R`);

      const stream = ops.join('\n');
      objects[contentObj] = `${contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
      objects[pageObj] = `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${resourcesRef} /Contents ${contentObj} 0 R >>\nendobj\n`;

      pageDefs.push({ pageObj, contentObj });
      objNum += 2;
    }

    // obj 2: pages
    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>\nendobj\n`;

    // Serialize
    const enc = new TextEncoder();
    const header = enc.encode('%PDF-1.4\n');
    const chunks = [header];
    const offsets = [0];
    let offset = header.length;

    for (let i = 1; i < objects.length; i++) {
      if (!objects[i]) continue;
      offsets[i] = offset;
      const bytes = enc.encode(objects[i]);
      chunks.push(bytes);
      offset += bytes.length;
    }

    const maxObj = objects.length - 1;
    const xrefStart = offset;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxObj; i++) {
      xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    }
    chunks.push(enc.encode(xref));
    chunks.push(enc.encode(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));

    // Concatenate
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }

  // detectScriptProfile removed: was only used by the old canvas PDF builder.

  function _unused_detectScriptProfile(text) {
    const s = String(text || '');
    const isRtl = /[֐-ࣿיִ-﷽ﹰ-ﻼ]/.test(s);
    const isCjk = /[぀-ヿ㐀-鿿豈-﫿]/.test(s);
    return { isRtl, isCjk };
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

  function wrapLineSmart(text, max, profile = { isRtl: false, isCjk: false }) {
    const normalized = String(text || '').replace(/\r/g, '').trim();
    if (!normalized) return [''];

    if (profile.isCjk) {
      const chars = Array.from(normalized.replace(/\s+/g, ''));
      const out = [];
      let line = '';
      for (const ch of chars) {
        if ((line + ch).length > max) {
          out.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
      if (line) out.push(line);
      return out;
    }

    if (profile.isRtl) {
      const tokens = normalized.split(/\s+/).filter(Boolean);
      const out = [];
      let line = '';
      for (const tok of tokens) {
        const candidate = line ? `${tok} ${line}` : tok;
        if (candidate.length > max && line) {
          out.push(line);
          line = tok;
        } else {
          line = candidate;
        }
      }
      if (line) out.push(line);
      return out;
    }

    const words = normalized.replace(/\s+/g, ' ').split(' ');
    const linesOut = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > max) {
        if (line.trim()) linesOut.push(line.trim());
        line = w;
      } else {
        line += ` ${w}`;
      }
    }
    if (line.trim()) linesOut.push(line.trim());
    return linesOut.length ? linesOut : [''];
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

  // --- GestureToken enforcement ---
  // Tracks whether we're inside a user-gesture call stack.
  // Downloads and permission requests MUST only happen within gesture scope.
  let _gestureActive = false;

  function withGesture(fn) {
    return async function (...args) {
      _gestureActive = true;
      try { return await fn.apply(this, args); }
      finally { _gestureActive = false; }
    };
  }

  function assertGesture(action) {
    if (!_gestureActive) {
      console.warn(`[GestureToken] Blocked ${action} outside user gesture.`);
      return false;
    }
    return true;
  }

  function downloadBlob(blob, name) {
    if (!assertGesture('downloadBlob')) return;
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
    closeModal(settingsModal);
  };
  document.getElementById('btn-open-about').onclick = () => openModal(aboutModal);
  document.getElementById('btn-open-login').onclick = () => showInfo('Login (Draft)', 'Draft login page is reserved for future account features. Current version works locally with your active browser session only.');
  document.getElementById('btn-open-contact').onclick = () => showInfo('Contact (Draft)', 'Draft contact page is reserved for support and compliance requests.');
  document.getElementById('btn-close-about').onclick = document.getElementById('btn-ack-about').onclick = () => closeModal(aboutModal);
  document.getElementById('btn-close-error').onclick = () => closeModal(errorModal);
  document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));

  // debugMode toggle: show/hide diagnostics download button
  if (checkDebugMode) {
    checkDebugMode.addEventListener('change', () => {
      if (btnDownloadDiagnostics) btnDownloadDiagnostics.style.display = checkDebugMode.checked ? 'block' : 'none';
    });
  }

  // Forensic bundle export: 3-file download (diagnostics.jsonl, run_summary.json, asset_failures.json)
  if (btnDownloadDiagnostics) {
    btnDownloadDiagnostics.onclick = withGesture(async () => {
      if (!lastDiagnostics) {
        showInfo('No Diagnostics', 'Run an export with Debug Mode enabled first.');
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const prefix = `${(currentChatData?.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;

      // File 1: diagnostics.jsonl (all flight recorder entries)
      const jsonlContent = lastDiagnostics.entries.map((e) => JSON.stringify(e)).join('\n');
      // File 2: run_summary.json (run metadata + scorecard)
      const runSummary = {
        schema_version: lastDiagnostics.schema_version,
        run: lastDiagnostics.run,
        tabScope: lastDiagnostics.tabScope,
        counts: lastDiagnostics.counts,
        scorecard: lastDiagnostics.scorecard,
        entryCount: lastDiagnostics.entries.length,
      };
      // File 3: asset_failures.json
      const assetFailures = {
        failures: lastDiagnostics.failures || [],
        failureCount: (lastDiagnostics.failures || []).length,
      };

      const bundleFiles = [
        { name: `${prefix}.diagnostics.jsonl`, content: jsonlContent, mime: 'application/x-ndjson' },
        { name: `${prefix}.run_summary.json`, content: JSON.stringify(runSummary, null, 2), mime: 'application/json' },
        { name: `${prefix}.asset_failures.json`, content: JSON.stringify(assetFailures, null, 2), mime: 'application/json' },
      ];

      const zip = await createRobustZip(bundleFiles);
      downloadBlob(zip, `${prefix}_diagnostics_bundle.zip`);
    });
  }

  safeInit();
});
