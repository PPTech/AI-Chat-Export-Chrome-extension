// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// script.js - Main Controller v0.10.18

document.addEventListener('DOMContentLoaded', () => {
  let currentChatData = null;
  let activeTabId = null;

  const btnExport = document.getElementById('btn-export-main');
  const btnLoadFull = document.getElementById('btn-load-full');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnPreview = document.getElementById('btn-preview');
  const btnExportImages = document.getElementById('btn-export-images');
  const btnExportFiles = document.getElementById('btn-export-files');
  const btnScanFiles = document.getElementById('btn-scan-files');
  const btnResolveDownload = document.getElementById('btn-resolve-download');
  const btnPingContent = document.getElementById('btn-ping-content');
  const btnExtractLocal = document.getElementById('btn-extract-local');
  const btnSelfTest = document.getElementById('btn-self-test');
  const btnLogs = document.getElementById('btn-download-logs');
  const btnExportConfig = document.getElementById('btn-export-config');
  const checkImages = document.getElementById('check-images');
  const checkCode = document.getElementById('check-code');
  const checkRawHtml = document.getElementById('check-raw-html');
  const checkZip = document.getElementById('check-zip');
  const checkPhotoZip = document.getElementById('check-photo-zip');
  const checkExportFiles = document.getElementById('check-export-files');
  const checkDebugOverlay = document.getElementById('check-debug-overlay');

  const settingsModal = document.getElementById('settings-modal');
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const infoModal = document.getElementById('info-modal');
  const errorMsg = document.getElementById('error-msg');
  const errorFix = document.getElementById('error-fix');

  const SETTINGS_KEY = 'ai_exporter_settings_v1';
  const tempMediaCache = createTempMediaCache();

  function installLocalOnlyGuard() {
    const allow = ['chrome-extension://', 'data:', 'blob:'];
    const check = (url) => {
      const u = String(url || '');
      if (allow.some((p) => u.startsWith(p))) return;
      throw new Error(`[LOCAL-ONLY] blocked outbound request: ${u}`);
    };
    const originalFetch = window.fetch?.bind(window);
    if (originalFetch) {
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        check(url);
        return originalFetch(input, init);
      };
    }
    const XHR = window.XMLHttpRequest;
    if (XHR) {
      const open = XHR.prototype.open;
      XHR.prototype.open = function patchedOpen(method, url, ...rest) {
        check(url);
        return open.call(this, method, url, ...rest);
      };
    }
    const WS = window.WebSocket;
    if (WS) {
      window.WebSocket = function blockedWS(url, protocols) {
        check(url);
        return new WS(url, protocols);
      };
    }
  }

  installLocalOnlyGuard();

  function getDefaultSettings() {
    return {
      convertImages: true,
      highlightCode: true,
      rawHtml: false,
      zip: false,
      photoZip: true,
      exportFiles: true,
      debugOverlay: false
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
      debugOverlay: !!checkDebugOverlay?.checked,
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
    checkExportFiles.checked = !!s.exportFiles;
    if (checkDebugOverlay) checkDebugOverlay.checked = !!s.debugOverlay;
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
    const cfg = `# AI Chat Exporter Settings\n# version=0.10.18\n${lines.join('\n')}\n`;
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
    tempMediaCache.clear('popup-init');
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
        if (chrome.scripting?.executeScript) {
          chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] }, () => {
            setTimeout(() => chrome.tabs.sendMessage(activeTabId, { action: 'extract_chat', options }, processData), 600);
          });
        } else {
          setAnalyzeProgress(0, 'Content script unavailable');
        }
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
    let otherCodeBlocks = 0;
    let otherLinks = 0;
    let otherQuotes = 0;
    const imgRegex = /\[\[IMG:[\s\S]*?\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    const fileRegex = /\[\[FILE:([^|\]]+)\|([^\]]+)\]\]/g;
    const linkRegex = /https?:\/\/[^\s)]+/g;
    for (const m of messages) {
      const content = m.content || '';
      photos += (content.match(imgRegex) || []).length;
      files += (content.match(fileRegex) || []).length;
      otherCodeBlocks += (content.match(/```/g) || []).length / 2;
      otherLinks += Math.max(0, (content.match(linkRegex) || []).length - (content.match(fileRegex) || []).length);
      otherQuotes += (content.match(/^>\s+/gm) || []).length;
    }
    others = Math.round(otherCodeBlocks + otherLinks + otherQuotes);
    return {
      messages: messages.length,
      photos: Math.round(photos),
      files: Math.round(files),
      others,
      otherCodeBlocks: Math.round(otherCodeBlocks),
      otherLinks: Math.round(otherLinks),
      otherQuotes: Math.round(otherQuotes)
    };
  }

  function updateDetectedSummary(messages = []) {
    const el = document.getElementById('detected-summary');
    if (!el) return;
    const c = computeDetectedCounts(messages);
    el.textContent = `Detected: ${c.messages} messages • ${c.photos} photos • ${c.files} files • ${c.others} others (code:${c.otherCodeBlocks}, links:${c.otherLinks}, quotes:${c.otherQuotes})`;
  }

  btnExport.onclick = async () => {
    const formats = Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    if (!formats.length || !currentChatData) return;
    btnExport.disabled = true;
    setProcessingProgress(2);

    try {
      tempMediaCache.clear('export-begin');
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
      tempMediaCache.clear('export-finish');
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
        const blob = await fetchFileBlob(src);
        const extGuess = blob ? sniffImageExtension(blob) : 'jpg';
        const ok = await downloadByUrlOrBlob(src, `ai_chat_exporter/${platformPrefix}_${date}_photo_${String(idx).padStart(3, '0')}.${extGuess}`);
        if (!ok) {
          // continue remaining images even when one image fails
        }
        idx += 1;
      }
      return;
    }

    const files = [];
    let idx = 1;
    for (const src of imageList) {
      try {
        const b = await fetch(src).then((r) => r.blob());
        const ext = sniffImageExtension(b);
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

  btnExportFiles.onclick = async () => {
    if (!currentChatData) return;
    if (!checkExportFiles.checked) return showInfo('Files Export Disabled', 'Enable "Extract and ZIP Chat Files" in Settings first.');
    const filesFound = extractAllFileSources(currentChatData.messages);
    if (!filesFound.length) return showError(new Error('No chat-generated file links were detected.'));

    const packed = [];
    let i = 1;
    for (const file of filesFound) {
      try {
        const blob = await fetchFileBlob(file.url);
        if (!blob) continue;
        const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
        const name = file.name.includes('.') ? file.name : `${file.name}.${ext}`;
        const data = new Uint8Array(await blob.arrayBuffer());
        packed.push({ name: `${String(i).padStart(3, '0')}_${name}`, content: data, mime: blob.type || 'application/octet-stream' });
        i += 1;
      } catch {
        // skip failed file
      }
    }
    if (!packed.length) {
      let fallbackDownloads = 0;
      for (const file of filesFound) {
        if (!/^https?:\/\//i.test(file.url)) continue;
        try {
          await new Promise((resolve, reject) => {
            chrome.downloads.download({ url: sanitizeTokenUrl(file.url), filename: `ai_chat_exporter/${file.name}`, saveAs: false }, (id) => {
              if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message || 'download_failed'));
              else resolve(id);
            });
          });
          fallbackDownloads += 1;
        } catch {
          // keep trying others
        }
      }
      if (fallbackDownloads > 0) {
        showInfo('Fallback Download', `Downloaded ${fallbackDownloads} file(s) via direct browser download fallback.`);
        return;
      }
      return showError(new Error('Detected files could not be downloaded from current session.'));
    }
    const zip = await createRobustZip(packed);
    const date = new Date().toISOString().slice(0, 10);
    const platformPrefix = (currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '');
    downloadBlob(zip, `${platformPrefix}_${date}_chat_files.zip`);
  };

  btnScanFiles.onclick = async () => {
    if (!activeTabId) return;
    setAnalyzeProgress(35, 'Scanning file links');
    const response = await sendToActiveTab({ action: 'scan_chatgpt_file_links' });
    if (!response?.success) {
      showError(new Error(response?.error || 'Scan failed for current page.'));
      setAnalyzeProgress(100, 'Completed');
      return;
    }
    const summary = response.summary || { total: 0, sandbox: 0, direct: 0 };
    showInfo('Scan Complete', `Detected ${summary.total} file link(s). sandbox=${summary.sandbox}, direct=${summary.direct}. Open page DevTools console for detailed table.`);
    setAnalyzeProgress(100, 'Completed');
  };

  btnResolveDownload.onclick = async () => {
    if (!activeTabId) return;
    setAnalyzeProgress(40, 'Resolving file links');
    const response = await sendToActiveTab({ action: 'resolve_download_chatgpt_file_links' });
    if (!response?.success) {
      showError(new Error(response?.error || 'Resolve + Download failed.'));
      setAnalyzeProgress(100, 'Completed');
      return;
    }
    const stats = response.stats || { total: 0, downloaded: 0, failed: 0 };
    showInfo('Resolve + Download Finished', `[${stats.downloaded === stats.total ? 'PASS' : (stats.downloaded > 0 ? 'WARN' : 'FAIL')}] downloaded ${stats.downloaded}/${stats.total}, failed ${stats.failed}.`);
    setAnalyzeProgress(100, 'Completed');
  };

  btnPingContent.onclick = async () => {
    if (!activeTabId) return;
    const response = await sendToActiveTab({ action: 'ping_content' });
    if (!response?.injected) {
      showError(new Error(response?.error || 'Ping failed: content script unavailable on current tab.'));
      return;
    }
    showInfo('Ping OK', `injected=${response.injected}, domain=${response.domain}, href=${response.href}`);
  };

  btnExtractLocal.onclick = async () => {
    if (!activeTabId) return;
    const response = await sendToActiveTab({ action: 'extract_local_agent', options: { debug: !!checkDebugOverlay?.checked } });
    if (!response?.success) {
      showError(new Error(response?.error || 'Local extract failed.'));
      return;
    }
    const summary = response.summary || { messages: 0, images: 0, files: 0 };
    showInfo('Local Extract', `messages=${summary.messages}, images=${summary.images}, files=${summary.files}`);
  };

  btnSelfTest.onclick = async () => {
    if (!activeTabId) return;
    const response = await sendToActiveTab({ action: 'self_test_local_agent', options: { debug: !!checkDebugOverlay?.checked } });
    if (!response?.success) {
      showError(new Error(response?.error || 'Self-test failed.'));
      return;
    }
    showInfo('Self-Test', `${response.status}: ${response.details}`);
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
    const normalized = sanitizeTokenUrl(src);
    if (/^data:image\//i.test(normalized)) return normalized;
    if (/^https?:\/\//i.test(normalized) && isLikelyImageUrl(normalized)) return normalized;
    return '';
  }

  function sanitizeTokenUrl(url) {
    return String(url || '').trim().replace(/[\]\)>'"\s]+$/g, '');
  }

  function isLikelyImageUrl(url) {
    try {
      const u = new URL(url);
      const path = (u.pathname || '').toLowerCase();
      if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(path)) return true;
      if (/image|img|photo|picture|googleusercontent|gstatic|ggpht/.test(url.toLowerCase())) return true;
      return false;
    } catch {
      return false;
    }
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


  class GeminiArtifactGenerator {
    constructor(chatData) {
      this.data = JSON.parse(JSON.stringify(chatData || { messages: [] }));
      this.fileLinks = [];
    }

    async toBase64(url) {
      try {
        if (!url) return '';
        if (/^data:/i.test(url)) return url;
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || url);
          reader.readAsDataURL(blob);
        });
      } catch {
        return url;
      }
    }

    async processImages() {
      const imgUrlRegex = /https?:\/\/[^\s)"']*(googleusercontent\.com|gstatic\.com|ggpht\.com|lh3\.googleusercontent\.com)[^\s)"']*/gi;
      for (const message of this.data.messages || []) {
        const found = (message.content || '').match(imgUrlRegex) || [];
        let content = message.content || '';
        for (const url of [...new Set(found)]) {
          const base64 = await this.toBase64(url);
          content = content.split(url).join(base64);
        }
        content = replaceImageTokensForHtml(content);
        message.content = content;
      }
      return this.data;
    }

    scanAndDownloadFiles() {
      const linkRegex = /(sandbox:\/\/[^\s"')]+|https?:\/\/[^\s"')]+\.(?:csv|pdf|docx|xlsx|pptx|py|js|ts|json|xml|txt|zip))/gi;
      const found = [];
      for (const message of this.data.messages || []) {
        const hits = (message.content || '').match(linkRegex) || [];
        for (const hit of hits) found.push(hit);
      }
      const uniq = [...new Set(found)];
      this.fileLinks = uniq;
      uniq.forEach((url, index) => {
        try {
          chrome.downloads.download({ url, filename: `ai_chat_exporter/gemini_file_${String(index + 1).padStart(3, '0')}`, saveAs: false });
        } catch {
          // no-op
        }
      });
      return uniq;
    }

    markdownToHtml(input) {
      return String(input || '')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }

    generateStaticHTMLString() {
      const style = `
        body{background:#1f1f1f;color:#ececec;font-family:Arial,sans-serif;padding:20px}
        .wrap{max-width:980px;margin:auto}
        .msg{padding:12px;border-radius:12px;margin:10px 0;background:#2a2a2a;border:1px solid #3a3a3a}
        .role{font-weight:700;color:#8ab4f8;margin-bottom:8px}
        pre,code{font-family:monospace}
        pre{background:#111;padding:10px;border-radius:8px;overflow:auto}
        img{max-width:100%;height:auto;border-radius:8px}
      `;
      const body = (this.data.messages || []).map((m) => `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${this.markdownToHtml(m.content)}</div></div>`).join('');
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><div class="wrap">${body}</div></body></html>`;
    }

    generateStaticHTML() {
      return new Blob([this.generateStaticHTMLString()], { type: 'text/html' });
    }

    generateHTML() {
      return this.generateStaticHTML();
    }

    generateWord() {
      const inner = this.generateStaticHTMLString();
      const body = inner.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
      const doc = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>img{max-width:100%;height:auto} pre{background:#111;color:#fff;padding:8px} .msg{page-break-inside:avoid}</style></head><body>${body}</body></html>`;
      return new Blob([doc], { type: 'application/msword' });
    }
  }

  async function embedImagesAsDataUris(messages = []) {
    const cache = new Map();
    const tokenRegex = /\[\[IMG:([\s\S]*?)\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
    return Promise.all((messages || []).map(async (message) => {
      const msg = { ...message };
      let content = String(msg.content || '');
      const found = [];
      let match;
      while ((match = tokenRegex.exec(content)) !== null) {
        const src = (match[1] || match[2] || '').trim();
        if (src && /^https?:\/\//i.test(src)) found.push(src);
      }
      for (const src of [...new Set(found)]) {
        if (!cache.has(src)) {
          try {
            const dataUrl = await tempMediaCache.fetchDataUrl(sanitizeTokenUrl(src));
            cache.set(src, dataUrl);
          } catch {
            cache.set(src, src);
          }
        }
        content = content.split(src).join(cache.get(src));
      }
      msg.content = content;
      return msg;
    }));
  }

  async function generateContent(fmt, data) {
    const msgs = data.messages || [];
    const title = data.title || 'Export';

    if (fmt === 'pdf') {
      const pdf = await buildRichPdf(title, msgs);
      return { content: pdf, mime: 'application/pdf' };
    }

    if (fmt === 'doc' || fmt === 'html') {
      if ((data.platform || '').toLowerCase().includes('gemini')) {
        const generator = new GeminiArtifactGenerator({ messages: msgs });
        await generator.processImages();
        if (fmt === 'doc') return { content: generator.generateWord(), mime: 'application/msword' };
        return { content: generator.generateHTML(), mime: 'text/html' };
      }
      const richMsgs = await embedImagesAsDataUris(msgs);
      const style = 'body{font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;line-height:1.6}img{max-width:100%;height:auto}.msg{margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:8px}.role{font-weight:700;margin-bottom:8px}';
      const body = richMsgs.map((m) => {
        return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${renderRichMessageHtml(m.content)}</div></div>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
      if (fmt === 'doc') {
        const docHtml = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
        return { content: docHtml, mime: 'application/msword' };
      }
      return { content: html, mime: 'text/html' };
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
    const normalized = String(text || '').replace(/\r/g, '').trim();
      if (!normalized) return;
      const profile = detectScriptProfile(normalized);
      const lines = wrapLineSmart(normalized, maxChars, profile);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.direction = profile.isRtl ? 'rtl' : 'ltr';
      ctx.textAlign = profile.isRtl ? 'right' : 'left';
      const x = profile.isRtl ? pageWidth - margin : margin;
      for (const line of lines) {
        ensureSpace(lineHeight + 4);
        ctx.fillText(line, x, y);
        y += lineHeight;
      }
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
    };

    resetPage();
    drawTextBlock(title, 'bold 36px "Noto Sans", "Segoe UI", "Arial Unicode MS", Tahoma, Arial, sans-serif', '#111827', 40, 64);
    y += 8;

    for (const message of messages) {
      drawTextBlock(`[${message.role}]`, 'bold 26px "Noto Sans", "Segoe UI", Arial, sans-serif', '#1D4ED8', 32, 64);
      const parts = splitContentAndImages(message.content);
      for (const part of parts) {
        if (part.type === 'text') {
          drawTextBlock(stripImageTokens(part.value), '24px "Noto Sans Arabic", "Noto Sans CJK SC", "Noto Sans", "Arial Unicode MS", Tahoma, Arial, sans-serif', '#111111', 30, 88);
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

  function detectScriptProfile(text) {
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

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  function createTempMediaCache() {
    const blobCache = new Map();
    const objectUrls = new Set();
    return {
      async fetchBlob(url) {
        if (!url) return null;
        if (blobCache.has(url)) return blobCache.get(url);
        try {
          const blob = await fetch(url, { credentials: 'include' }).then((r) => (r.ok ? r.blob() : null));
          if (blob) blobCache.set(url, blob);
          return blob;
        } catch {
          return null;
        }
      },
      async fetchDataUrl(url) {
        if (!url) return '';
        if (/^data:/i.test(url)) return url;
        const blob = await this.fetchBlob(url);
        if (!blob) return url;
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || url));
          reader.readAsDataURL(blob);
        });
      },
      async fetchObjectUrl(url) {
        const blob = await this.fetchBlob(url);
        if (!blob) return url;
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.add(objectUrl);
        return objectUrl;
      },
      clear(reason = 'cleanup') {
        blobCache.clear();
        objectUrls.forEach((u) => URL.revokeObjectURL(u));
        objectUrls.clear();
        console.log(`[TempMediaCache] cleared (${reason})`);
      }
    };
  }

  function sendToActiveTab(payload) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTabId, payload, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { success: false, error: 'No response from content script.' });
      });
    });
  }

  async function fetchFileBlob(url) {
    if (!url) return null;
    if (!activeTabId) return null;
    const clean = sanitizeTokenUrl(url);
    if (/^data:/i.test(clean)) return dataUrlToBlob(clean);
    if (/^blob:/i.test(clean)) {
      const pageBlob = await sendToActiveTab({ action: 'fetch_blob_page', url: clean });
      if (!pageBlob?.success) return null;
      return dataUrlToBlob(pageBlob.dataUrl);
    }
    const pageBlob = await sendToActiveTab({ action: 'fetch_blob_page', url: clean });
    if (!pageBlob?.success) return null;
    return dataUrlToBlob(pageBlob.dataUrl);
  }

  function dataUrlToBlob(dataUrl) {
    try {
      const [meta, b64] = String(dataUrl || '').split(',');
      if (!meta || !b64) return null;
      const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }

  function sniffImageExtension(blob) {
    const mime = (blob?.type || '').toLowerCase();
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('bmp')) return 'bmp';
    if (mime.includes('svg')) return 'svg';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    return 'jpg';
  }

  async function downloadByUrlOrBlob(url, filename) {
    try {
      if (/^data:|^blob:/i.test(url)) {
        chrome.downloads.download({ url, filename, saveAs: false });
        return true;
      }
      const blob = await fetchFileBlob(url);
      if (!blob) {
        chrome.downloads.download({ url, filename, saveAs: false });
        return true;
      }
      downloadBlob(blob, filename.split('/').pop() || 'file.bin');
      return true;
    } catch {
      return false;
    }
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
  window.addEventListener('beforeunload', () => tempMediaCache.clear('popup-close'));

  safeInit();
});
