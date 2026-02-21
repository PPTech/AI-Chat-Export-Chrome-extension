// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// script.js - Main Controller v0.12.1

import {
  escapeHtml, normalizeImageSrc, stripImageTokens, replaceImageTokensForText,
  replaceImageTokensForHtml, renderImgTag, splitContentAndImages, renderRichMessageHtml,
  extractAllImageSources, extractAllFileSources, rewriteContentWithLocalAssets,
  renderRichMessageHtmlWithAssets, stripHtmlTags, hasNonLatinChars, pdfEscapeText, wrapLineSmart
} from './core/utils.js';

import { buildSearchablePdf, buildCanvasPdf, buildTextPdf } from './export/pdf.js';

import {
  getDefaultSettings, collectSettings as collectSettingsFromLib,
  applySettings as applySettingsFromLib, saveSettingsToStorage as saveSettingsToStorageLib,
  loadSettingsFromStorage as loadSettingsFromStorageLib, isDebugMode as isDebugModeLib
} from './lib/state.mjs';

import {
  generateContent as generateContentFromLib, createRobustZip as createRobustZipLib,
  computeDetectedCounts as computeDetectedCountsLib
} from './lib/export.mjs';
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
  const checkRasterPdf = document.getElementById('check-raster-pdf');
  const btnDownloadDiagnostics = document.getElementById('btn-download-diagnostics');

  const settingsModal = document.getElementById('settings-modal');
  const errorModal = document.getElementById('error-modal');
  const aboutModal = document.getElementById('about-modal');
  const infoModal = document.getElementById('info-modal');
  const errorMsg = document.getElementById('error-msg');
  const errorFix = document.getElementById('error-fix');

  const SETTINGS_KEY = 'ai_exporter_settings_v1';

  // --- Delegate settings functions to lib/state.mjs ---
  function uiEls() {
    return { checkImages, checkCode, checkRawHtml, checkZip, checkPhotoZip, checkExportFiles, checkAdvancedLinks, checkDebugMode, checkRasterPdf, btnDownloadDiagnostics };
  }
  // getDefaultSettings imported directly from lib/state.mjs (top-level import)
  function collectSettings() { return collectSettingsFromLib(uiEls()); }
  function isDebugMode() { return isDebugModeLib(uiEls()); }
  function applySettings(settings) { applySettingsFromLib(settings, uiEls()); }
  function saveSettingsToStorage(settings) { saveSettingsToStorageLib(settings); }
  function loadSettingsFromStorage() { loadSettingsFromStorageLib(uiEls()); }

  function exportSettingsCfg(settings) {
    const lines = Object.entries(settings).map(([k, v]) => `${k}=${String(v)}`);
    const cfg = `# AI Chat Exporter Settings\n# version=0.12.1\n${lines.join('\n')}\n`;
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
      persistExtractionDiagnostics(null, 'no-response');
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
      persistExtractionDiagnostics(res, 'ok');
      updateExportBtn();
      return;
    }
    document.getElementById('platform-badge').textContent = `${res?.platform || 'Unknown'} (Waiting)`;
    setAnalyzeProgress(0, 'Waiting');
    persistExtractionDiagnostics(res, 'fail');
  }

  /**
   * D2: Persist extraction diagnostics after EVERY extraction attempt (success or fail).
   * This ensures "Download Diagnostics" always has data, even when export never runs.
   */
  function persistExtractionDiagnostics(res, status) {
    const runId = `extraction-${Date.now()}`;
    const msgs = res?.messages || [];
    const unknownCount = msgs.filter((m) => /unknown/i.test(m.role)).length;
    const total = msgs.length;
    const diag = {
      schema_version: 'diagnostics.v6',
      run: { run_id: runId, started_at_utc: new Date().toISOString(), ended_at_utc: new Date().toISOString(), tool_version: '0.12.1', platform: res?.platform || 'unknown' },
      tabScope: activeTabId != null ? `tab:${activeTabId}` : 'global',
      phase: 'extraction',
      status,
      entries: [],
      counts: { messages_total: total, messages_unknown: unknownCount, assets_failed: 0 },
      failures: [],
      scorecard: {
        messages_total: total,
        unknown_role_ratio: total > 0 ? Number((unknownCount / total).toFixed(4)) : 0,
        unknown_role_pass: total > 0 ? unknownCount / total <= 0.05 : false,
        has_messages: total > 0,
        anomalyScore: total === 0 ? 40 : (unknownCount / Math.max(1, total) > 0.05 ? 30 : 0),
      },
      invariants: null,
      verbose: false,
    };
    // Store as lastDiagnostics so Download Diagnostics works immediately
    // INVARIANT: always overwrite with latest extraction diagnostics
    lastDiagnostics = diag;
    // Persist to SW
    try {
      chrome.runtime.sendMessage({ action: 'STORE_DIAGNOSTICS', runId, payload: diag }, () => {
        if (chrome.runtime.lastError) console.warn('[Diagnostics] SW store failed:', chrome.runtime.lastError.message);
      });
    } catch (_) { /* SW may be inactive */ }
    // Persist to chrome.storage.local as durable fallback (SW can die)
    try {
      chrome.storage.local.set({ last_min_forensics: diag });
    } catch (_) { /* storage unavailable */ }
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
    const bar = document.getElementById('analyze-progress-bar');
    if (!el) return;
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    el.textContent = `Analysis: ${bounded}% â€” ${label}`;
    if (bar) {
      bar.style.width = `${bounded}%`;
      bar.style.background = bounded >= 100 ? 'var(--success, #10b981)' : 'var(--primary, #2563eb)';
    }
  }

  function computeDetectedCounts(messages = []) {
    return computeDetectedCountsLib(messages);
  }

  function updateDetectedSummary(messages = []) {
    const el = document.getElementById('detected-summary');
    if (!el) return;
    const c = computeDetectedCounts(messages);
    el.textContent = `Detected: ${c.messages} messages â€¢ ${c.photos} photos â€¢ ${c.files} files â€¢ ${c.others} others`;
  }

  // --- D7: Flight Recorder v3 â€” structured events + run correlation + redaction ---
  // Always-on minimal recording. Debug ON = verbose with raw details.
  // Redaction: in non-verbose mode, content is hashed (length + first 8 chars of SHA-256).

  async function hashForRedaction(text) {
    if (!text) return { len: 0, hash: 'empty' };
    try {
      const data = new TextEncoder().encode(String(text));
      const buf = await crypto.subtle.digest('SHA-256', data);
      const arr = Array.from(new Uint8Array(buf));
      return { len: text.length, hash: arr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16) };
    } catch { return { len: text.length, hash: 'unavailable' }; }
  }

  function redactDetails(details, verbose) {
    if (!details || verbose) return details;
    // In minimal mode: keep structure but redact any 'content', 'text', 'data' fields
    const redacted = {};
    for (const [k, v] of Object.entries(details)) {
      if (/^(content|text|data|raw|body)$/i.test(k) && typeof v === 'string' && v.length > 50) {
        redacted[k] = `[redacted: ${v.length} chars]`;
      } else if (typeof v === 'object' && v !== null) {
        redacted[k] = Array.isArray(v) ? `[array: ${v.length} items]` : '[object]';
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  // Structured event types for D7
  const EVENT_TYPES = {
    // UI events
    UI_CLICK_EXPORT: 'ui.click.export',
    UI_TOGGLE_DEBUG: 'ui.toggle.debug',
    UI_SELECT_FORMAT: 'ui.select.format',
    // Bus events (popup <-> SW <-> content)
    BUS_SEND: 'bus.send',
    BUS_RECV: 'bus.recv',
    // Extraction events
    EXTRACT_START: 'extract.start',
    EXTRACT_END: 'extract.end',
    EXTRACT_STRATEGY: 'extract.strategy_selected',
    EXTRACT_SCORECARD: 'extract.scorecard',
    // Asset events
    ASSET_DISCOVER: 'asset.discover',
    ASSET_FETCH_START: 'asset.fetch.start',
    ASSET_FETCH_END: 'asset.fetch.end',
    ASSET_REDIRECT: 'asset.redirect_chain',
    ASSET_FAIL: 'asset.fail',
    // Export events
    EXPORT_START: 'export.start',
    EXPORT_END: 'export.end',
    EXPORT_FORMAT_START: 'export.format.start',
    EXPORT_FORMAT_DONE: 'export.format.done',
    EXPORT_FORMAT_FAIL: 'export.format.fail',
    EXPORT_FILE_WRITTEN: 'export.file_written',
    EXPORT_INVARIANTS: 'export.invariants',
    EXPORT_DOWNLOAD_FAIL: 'export.download.fail',
    // Asset resolution
    ASSET_RESOLVE_START: 'asset.resolve.start',
    ASSET_RESOLVE_DONE: 'asset.resolve.done',
    ASSET_RESOLVE_FAIL: 'asset.resolve.fail',
    ASSET_RESOLVED: 'asset.resolved',
    ASSET_SKIP: 'asset.skip.not_allowed',
  };

  function createPopupFlightRecorder(runId, platform, verbose) {
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
        details: redactDetails(opts.details || null, verbose),
      };
      entries.push(entry);
      if (entries.length > 5000) entries.shift();
      return entry;
    }
    function finish(counts = {}, failures = [], invariantResult = null) {
      const endedAt = new Date().toISOString();
      const total = counts.messages_total || 0;
      const unknown = counts.messages_unknown || 0;
      const failedAssets = counts.assets_failed || 0;
      const resolvedAssets = counts.assets_resolved || 0;
      const unknownRatio = total > 0 ? unknown / total : 0;
      const assetRate = (resolvedAssets + failedAssets) > 0 ? resolvedAssets / (resolvedAssets + failedAssets) : 1;
      const anomalyScore = Math.min(100, Math.round(
        (unknownRatio > 0.05 ? 30 : 0) +
        (total === 0 ? 40 : 0) +
        (failedAssets > 0 ? Math.min(20, failedAssets * 5) : 0) +
        (invariantResult && !invariantResult.pass ? 10 : 0)
      ));
      // D7: Top failure reasons summary
      const failureReasons = {};
      for (const f of failures) {
        const reason = f.reason || 'unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
      return {
        schema_version: 'diagnostics.v6',
        run: { run_id: runId, started_at_utc: startedAt, ended_at_utc: endedAt, tool_version: '0.12.1', platform },
        tabScope: activeTabId != null ? `tab:${activeTabId}` : 'global',
        entries: verbose ? entries : entries.filter((e) => e.lvl === 'ERROR' || e.lvl === 'WARN'),
        entryCount: entries.length,
        counts: { ...counts, assets_resolved: resolvedAssets },
        failures: verbose ? failures : failures.slice(0, 5), // minimal: top 5 only
        scorecard: {
          messages_total: total,
          unknown_role_ratio: Number(unknownRatio.toFixed(4)),
          unknown_role_pass: unknownRatio <= 0.05,
          has_messages: total > 0,
          asset_resolution_rate: Number(assetRate.toFixed(4)),
          anomalyScore,
        },
        failureReasons,
        invariants: invariantResult || null,
        gestureValid: _gestureTokenValid,
        verbose,
      };
    }
    function toJsonl() { return entries.map((e) => JSON.stringify(e)).join('\n'); }
    return { record, finish, toJsonl, entries };
  }

  // A) FAIL-SOFT EXPORT + B) ALWAYS-ON DIAGNOSTICS + C) SMART LOGGER + D) GESTURE GUARANTEE
  btnExport.onclick = withGesture(async () => {
    const formats = Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    if (!formats.length || !currentChatData) return;
    btnExport.disabled = true;
    setProcessingProgress(2);

    const debug = isDebugMode();
    const runId = `export-${Date.now()}`;
    // B) ALWAYS create a recorder â€” minimal (debug OFF) or verbose (debug ON)
    const recorder = createPopupFlightRecorder(runId, currentChatData.platform, debug);
    lastAssetFailures = [];

    const exportStartEvent = recorder.record({ event: 'export.start', module: 'popup', phase: 'assemble', result: 'ok', details: { formats, messageCount: (currentChatData.messages || []).length, debugMode: debug, gestureValid: _gestureTokenValid } });

    const date = new Date().toISOString().slice(0, 10);
    const baseName = `${(currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;
    const files = [];
    const formatErrors = [];

    // D6: Resolve and embed assets (images/files) before generating formats
    let assetResult = { assetFiles: [], urlMap: new Map(), failures: [] };
    const hasImageFormats = formats.some((f) => ['html', 'doc', 'md', 'pdf'].includes(f));
    if (hasImageFormats && checkImages.checked) {
      try {
        setProcessingProgress(5, 'Resolving assets');
        recorder.record({ event: 'asset.resolve.start', module: 'export', phase: 'assets', result: 'ok', parentEventId: exportStartEvent.eventId });
        assetResult = await resolveAndEmbedAssets(currentChatData.messages, recorder, exportStartEvent.eventId);
        lastAssetFailures = assetResult.failures;
        recorder.record({ event: 'asset.resolve.done', module: 'export', phase: 'assets', result: 'ok', parentEventId: exportStartEvent.eventId, details: { resolved: assetResult.urlMap.size, failed: assetResult.failures.length } });
      } catch (assetErr) {
        recorder.record({ lvl: 'WARN', event: 'asset.resolve.fail', module: 'export', phase: 'assets', result: 'fail', parentEventId: exportStartEvent.eventId, details: { error: (assetErr?.message || '').slice(0, 200) } });
        // Asset failure is not fatal â€” continue without local assets
      }
    }
    const urlMap = assetResult.urlMap;

    // A) FAIL-SOFT: try each format independently; never abort entire export
    for (let i = 0; i < formats.length; i += 1) {
      const fmt = formats[i];
      try {
        recorder.record({ event: `export.format.start`, module: 'export', phase: 'assemble', result: 'ok', parentEventId: exportStartEvent.eventId, details: { format: fmt } });
        const generated = await generateContent(fmt, currentChatData, urlMap);
        const fileExt = generated.ext || fmt;
        files.push({ name: `${baseName}.${fileExt}`, content: generated.content, mime: generated.mime });
        recorder.record({ event: `export.format.done`, module: 'export', phase: 'assemble', result: 'ok', parentEventId: exportStartEvent.eventId, details: { format: fmt } });
      } catch (fmtErr) {
        // A) Format failure is not fatal â€” record and continue
        formatErrors.push({ format: fmt, error: (fmtErr?.message || '').slice(0, 200) });
        recorder.record({ lvl: 'ERROR', event: `export.format.fail`, module: 'export', phase: 'assemble', result: 'fail', parentEventId: exportStartEvent.eventId, details: { format: fmt, error: (fmtErr?.message || '').slice(0, 200) } });
      }
      const percent = 15 + ((i + 1) / Math.max(1, formats.length)) * 70;
      setProcessingProgress(percent, `Processing ${fmt.toUpperCase()}`);
    }

    // D6: Add resolved asset files to the export ZIP
    if (assetResult.assetFiles.length > 0) {
      files.push(...assetResult.assetFiles);
    }

    // A) Always include a canonical JSON manifest of what was exported
    const exportManifest = {
      schema: 'export-bundle-manifest.v1',
      runId,
      platform: currentChatData.platform,
      title: currentChatData.title,
      messageCount: (currentChatData.messages || []).length,
      formatsRequested: formats,
      formatsSucceeded: files.map((f) => f.name),
      formatErrors,
      assetsResolved: assetResult.urlMap.size,
      assetFailures: lastAssetFailures.length,
      assetFailureReasons: lastAssetFailures.map((f) => ({ url: (f.url || '').slice(0, 80), reason: f.reason || f.reason_code || 'unknown' })),
      assetsEmbedded: assetResult.assetFiles.length > 0,
      exportedAt: new Date().toISOString(),
      debugMode: debug,
    };
    files.push({ name: `${baseName}.export_bundle_manifest.json`, content: JSON.stringify(exportManifest, null, 2), mime: 'application/json' });

    // C) Run inline invariant checks
    const msgs = currentChatData.messages || [];
    const unknownCount = msgs.filter((m) => /unknown/i.test(m.role)).length;
    const emptyContent = msgs.filter((m) => !(m.content || '').trim()).length;
    const invariantResult = {
      pass: msgs.length > 0 && unknownCount / Math.max(1, msgs.length) <= 0.05 && formatErrors.length === 0,
      messages_total: msgs.length,
      unknown_ratio: msgs.length > 0 ? Number((unknownCount / msgs.length).toFixed(4)) : 0,
      empty_content: emptyContent,
      format_errors: formatErrors.length,
      asset_failures: lastAssetFailures.length,
    };
    recorder.record({ event: 'export.invariants', module: 'popup', phase: 'finalize', result: invariantResult.pass ? 'ok' : 'fail', parentEventId: exportStartEvent.eventId, details: invariantResult });

    try {
      // A) Even if some formats failed, emit what we have (fail-soft)
      // INVARIANT: always force bundle mode to include manifest + diagnostics
      setProcessingProgress(90, 'Packaging');
      // B) Include minimal diagnostics summary in ZIP (always, not just multi-file)
      const diagSummary = {
        runId, platform: currentChatData.platform,
        counts: { messages_total: msgs.length, messages_unknown: unknownCount, assets_failed: lastAssetFailures.length, assets_resolved: assetResult.urlMap.size },
        invariants: invariantResult,
        formatErrors,
        gestureValid: _gestureTokenValid,
      };
      files.push({ name: `${baseName}.diagnostics_summary.json`, content: JSON.stringify(diagSummary, null, 2), mime: 'application/json' });

      // B2) min_forensics.json â€” always present in every ZIP
      const minForensics = {
        schema: 'min-forensics.v1',
        runId,
        platform: currentChatData.platform,
        toolVersion: '0.12.1',
        exportedAt: new Date().toISOString(),
        messageCount: msgs.length,
        anomalyScore: invariantResult.pass ? 0 : 30,
        triageCategory: invariantResult.pass ? 'ok' : (formatErrors.length > 0 ? 'partial_fail' : 'warnings'),
      };
      files.push({ name: `${baseName}.min_forensics.json`, content: JSON.stringify(minForensics, null, 2), mime: 'application/json' });

      // B3) diagnostics.jsonl â€” included when debug mode is ON
      if (debug) {
        const jsonlLines = recorder.toJsonl();
        if (jsonlLines) {
          files.push({ name: `${baseName}.diagnostics.jsonl`, content: jsonlLines, mime: 'application/x-ndjson' });
        }
      }

      if (files.length === 1 && !checkZip.checked) {
        // edge case: no content files generated, only manifest â€” single-file download
        setProcessingProgress(95, 'Finalizing');
        downloadBlob(new Blob([files[0].content], { type: files[0].mime }), files[0].name);
      } else {
        const zip = await createRobustZip(files);
        setProcessingProgress(98, 'Downloading');
        downloadBlob(zip, `${baseName}.zip`);
      }

      recorder.record({ event: 'export.end', module: 'popup', phase: 'finalize', result: 'ok', parentEventId: exportStartEvent.eventId, details: { fileCount: files.length, formatErrors: formatErrors.length } });
      setProcessingProgress(100, 'Done');
    } catch (downloadErr) {
      recorder.record({ lvl: 'ERROR', event: 'export.download.fail', module: 'popup', phase: 'finalize', result: 'fail', details: { error: (downloadErr?.message || '').slice(0, 200) } });
      showError(downloadErr);
    }

    // B) ALWAYS persist diagnostics (regardless of debug mode)
    lastDiagnostics = recorder.finish(
      { messages_total: msgs.length, messages_unknown: unknownCount, assets_failed: lastAssetFailures.length, assets_resolved: assetResult.urlMap.size },
      lastAssetFailures,
      invariantResult
    );

    // Phase 1: Persist diagnostics to service worker (always, not just debug)
    try {
      chrome.runtime.sendMessage({ action: 'STORE_DIAGNOSTICS', runId, payload: lastDiagnostics }, () => {
        if (chrome.runtime.lastError) console.warn('[Diagnostics] SW store failed:', chrome.runtime.lastError.message);
      });
    } catch (_swErr) { /* SW may be inactive; popup still has lastDiagnostics */ }
    // Phase 2: Persist to chrome.storage.local as durable fallback
    try {
      chrome.storage.local.set({ last_min_forensics: lastDiagnostics });
    } catch (_stErr) { /* storage unavailable */ }

    // Show warning if formats failed but export continued
    if (formatErrors.length > 0) {
      showInfo('Partial Export', `${formatErrors.length} format(s) failed: ${formatErrors.map((e) => e.format).join(', ')}. Other formats exported successfully. Check export_bundle_manifest.json for details.`);
    }

    updateExportBtn();
  });

  btnLoadFull.onclick = () => {
    if (!activeTabId) return;
    const ok = window.confirm('Load full chat from the beginning? This may take longer for long chats.');
    if (!ok) return;
    btnLoadFull.disabled = true;
    btnLoadFull.textContent = 'Loading...';
    setAnalyzeProgress(5, 'Preparing full-load scan');
    chrome.tabs.sendMessage(activeTabId, { action: 'scroll_chat' }, (res) => {
      setAnalyzeProgress(90, 'Scroll complete, re-extracting');
      setTimeout(() => {
        requestExtraction();
        btnLoadFull.disabled = false;
        btnLoadFull.textContent = 'Fetch Full';
      }, 800);
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

  btnLogs.onclick = withGesture(async () => {
    // Use promise-based sendMessage so download happens within gesture TTL
    const logs = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_LOGS' }, (resp) => resolve(resp));
    });
    // Build comprehensive log report
    const report = {
      schema: 'log-report.v2',
      exportedAt: new Date().toISOString(),
      toolVersion: '0.12.1',
      platform: currentChatData?.platform || 'N/A',
      messageCount: currentChatData?.messages?.length || 0,
      title: currentChatData?.title || 'N/A',
      debugMode: isDebugMode(),
      lastDiagnosticsAvailable: !!lastDiagnostics,
      lastDiagnosticsSummary: lastDiagnostics ? {
        runId: lastDiagnostics.run?.run_id,
        anomalyScore: lastDiagnostics.scorecard?.anomalyScore,
        unknownRoleRatio: lastDiagnostics.scorecard?.unknown_role_ratio,
        entryCount: (lastDiagnostics.entries || []).length,
      } : null,
      activityLog: logs || [],
      logCount: Array.isArray(logs) ? logs.length : 0,
    };
    if (!logs || (Array.isArray(logs) && logs.length === 0)) {
      showInfo('No Logs', 'No activity logs recorded yet. Logs are created during extraction and export operations.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `ai_exporter_logs_${date}.json`);
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

    setProcessingProgress(5, 'Fetching files...');
    const packed = [];
    const fileFailures = [];
    let i = 1;

    // Ensure content script is injected (may have been unloaded if user navigated)
    let contentScriptReady = true;
    try {
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(activeTabId, { action: 'ping' }, (r) => {
          if (chrome.runtime.lastError) reject(new Error('not injected'));
          else resolve(r);
        });
      });
    } catch {
      // Re-inject content script
      try {
        await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });
        await new Promise((r) => setTimeout(r, 500)); // wait for script init
      } catch {
        contentScriptReady = false;
      }
    }

    for (const file of filesFound) {
      try {
        setProcessingProgress(5 + (i / filesFound.length) * 80, `Fetching file ${i}/${filesFound.length}`);
        let blob;
        let fetchedVia = 'none';
        // Try fetching via content script (page context) first
        if (contentScriptReady) {
          try {
            const resp = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(activeTabId, { action: 'FETCH_FILE', url: file.url }, (r) => {
                if (chrome.runtime.lastError || !r?.ok) reject(new Error(r?.error || chrome.runtime.lastError?.message || 'content-script fetch failed'));
                else resolve(r);
              });
            });
            const bin = atob(resp.data);
            const arr = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
            blob = new Blob([arr], { type: resp.mime || 'application/octet-stream' });
            fetchedVia = 'content-script';
          } catch (csErr) {
            // Content script failed â€” try direct fetch
            try {
              const directResp = await fetch(file.url);
              if (!directResp.ok) throw new Error(`HTTP ${directResp.status}`);
              blob = await directResp.blob();
              fetchedVia = 'popup-direct';
            } catch (popupErr) {
              throw new Error(`Content-script: ${csErr.message}; Popup: ${popupErr.message}`);
            }
          }
        } else {
          // No content script â€” try direct fetch only
          try {
            const directResp = await fetch(file.url);
            if (!directResp.ok) throw new Error(`HTTP ${directResp.status}`);
            blob = await directResp.blob();
            fetchedVia = 'popup-direct';
          } catch (popupErr) {
            throw new Error(`No content script + popup failed: ${popupErr.message}`);
          }
        }
        const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
        const name = file.name.includes('.') ? file.name : `${file.name}.${ext}`;
        const data = new Uint8Array(await blob.arrayBuffer());
        packed.push({ name: `${String(i).padStart(3, '0')}_${name}`, content: data, mime: blob.type || 'application/octet-stream' });
        i += 1;
      } catch (err) {
        fileFailures.push({ name: file.name, url: file.url.slice(0, 100), error: (err?.message || 'unknown').slice(0, 150) });
        i += 1;
      }
    }
    if (!packed.length) {
      const reasons = fileFailures.slice(0, 3).map((f) => `${f.name}: ${f.error}`).join('\n');
      return showError(new Error(`Could not download ${filesFound.length} file(s). Make sure the chat page is still open and you are logged in.\n\nDetails:\n${reasons}`));
    }
    if (fileFailures.length > 0) {
      // Partial success â€” pack what we got + include failure manifest
      packed.push({ name: 'file_failures.json', content: JSON.stringify({ failures: fileFailures, total: filesFound.length, succeeded: packed.length }, null, 2), mime: 'application/json' });
    }
    setProcessingProgress(90, 'Packing ZIP...');
    const zip = await createRobustZip(packed);
    const date = new Date().toISOString().slice(0, 10);
    const platformPrefix = (currentChatData.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '');
    downloadBlob(zip, `${platformPrefix}_${date}_chat_files.zip`);
    setProcessingProgress(100, 'Done');
    if (fileFailures.length > 0) {
      showInfo('Partial Download', `${packed.length - 1} of ${filesFound.length} file(s) downloaded. ${fileFailures.length} failed. See file_failures.json in the ZIP for details.`);
    }
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


  // --- D6: Asset resolution + embedding in export ZIP ---
  // Resolves images/files to binary data, stores in assets/ folder.
  // Returns { assetFiles: [{name, content, mime}], urlMap: Map<originalUrl, localPath>, failures: [] }

  const ASSET_ALLOWLIST = [
    /^data:/i,
    /^blob:/i,
    /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|pdf|csv|json|txt|md|docx|xlsx|zip)(\?|$)/i,
    /googleusercontent\.com/i,
    /oaiusercontent\.com/i,
    /oaistatic\.com/i,
    /chatgpt\.com/i,
    /claude\.ai/i,
    /gemini\.google\.com/i,
    /aistudio\.google\.com/i,
    /anthropic\.com/i,
  ];

  function isAllowedAssetUrl(url) {
    if (!url) return false;
    if (/^data:/i.test(url)) return true;
    if (/^blob:/i.test(url)) return true;
    if (!/^https?:\/\//i.test(url)) return false;
    return ASSET_ALLOWLIST.some((re) => re.test(url));
  }

  function sanitizeAssetPath(name) {
    // Zip-slip prevention: strip path traversal, control chars, keep only safe chars
    return String(name || 'asset')
      .replace(/\.\./g, '_')
      .replace(/[\/\\:*?"<>|\x00-\x1F]/g, '_')
      .replace(/^_+/, '')
      .slice(0, 120) || 'asset';
  }

  // Bug 2 fix: comprehensive MIME type → file extension lookup
  function mimeToExt(mimeType, fallback = 'bin') {
    const MAP = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/jfif': 'jpg', 'image/pjpeg': 'jpg',
      'image/png': 'png', 'image/x-png': 'png',
      'image/gif': 'gif', 'image/webp': 'webp',
      'image/svg+xml': 'svg', 'image/bmp': 'bmp',
      'image/ico': 'ico', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
      'application/pdf': 'pdf', 'text/csv': 'csv',
      'application/json': 'json', 'text/plain': 'txt', 'text/markdown': 'md',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/zip': 'zip', 'application/octet-stream': fallback,
    };
    const normalized = (mimeType || '').toLowerCase().split(';')[0].trim();
    return MAP[normalized] || (normalized.split('/')[1] || fallback).replace(/[^a-z0-9]/gi, '').slice(0, 10) || fallback;
  }

  async function resolveAndEmbedAssets(messages, recorder, parentEventId) {
    const assetFiles = [];
    const urlMap = new Map();
    const failures = [];

    // Discover all image sources
    const imageSources = extractAllImageSources(messages);
    // Discover all file sources
    const fileSources = extractAllFileSources(messages);

    let idx = 1;
    for (const src of imageSources) {
      if (urlMap.has(src)) continue;
      const assetName = `assets/img_${String(idx).padStart(3, '0')}`;
      try {
        if (!isAllowedAssetUrl(src)) {
          failures.push({ url: src.slice(0, 200), reason: 'not-allowlisted' });
          if (recorder) recorder.record({ lvl: 'WARN', event: 'asset.skip.not_allowed', module: 'export', phase: 'assets', parentEventId, details: { url: src.slice(0, 100) } });
          continue;
        }
        let blob;
        if (/^data:image\//i.test(src)) {
          // Data URL â€” decode directly
          const parts = src.split(',');
          const mimeMatch = src.match(/^data:(image\/[^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/png';
          const bin = atob(parts[1] || '');
          const arr = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
          blob = new Blob([arr], { type: mime });
        } else {
          // Try content-script fetch (page context with session cookies)
          try {
            const resp = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(activeTabId, { action: 'FETCH_FILE', url: src }, (r) => {
                if (chrome.runtime.lastError || !r?.ok) reject(new Error(r?.error || 'content-script fetch failed'));
                else resolve(r);
              });
            });
            const bin = atob(resp.data);
            const arr = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
            blob = new Blob([arr], { type: resp.mime || 'application/octet-stream' });
          } catch {
            // Fallback: direct fetch from popup
            blob = await fetch(src).then((r) => r.blob());
          }
        }
        // Bug 2 fix: use mimeToExt for correct extension from MIME type
        const ext = mimeToExt(blob.type, 'png');
        const fullName = `${assetName}.${sanitizeAssetPath(ext)}`;
        const data = new Uint8Array(await blob.arrayBuffer());
        assetFiles.push({ name: fullName, content: data, mime: blob.type || 'application/octet-stream' });
        urlMap.set(src, fullName);
        if (recorder) recorder.record({ event: 'asset.resolved', module: 'export', phase: 'assets', result: 'ok', parentEventId, details: { index: idx, size: data.length } });
        idx++;
      } catch (err) {
        failures.push({ url: src.slice(0, 200), reason: (err?.message || 'fetch-failed').slice(0, 100) });
        if (recorder) recorder.record({ lvl: 'WARN', event: 'asset.fetch.fail', module: 'export', phase: 'assets', result: 'fail', parentEventId, details: { url: src.slice(0, 100), error: (err?.message || '').slice(0, 100) } });
      }
    }

    // Resolve chat files
    for (const file of fileSources) {
      if (urlMap.has(file.url)) continue;
      const safeName = sanitizeAssetPath(file.name);
      const assetName = `assets/${String(idx).padStart(3, '0')}_${safeName}`;
      try {
        if (!isAllowedAssetUrl(file.url)) {
          failures.push({ url: file.url.slice(0, 200), reason: 'not-allowlisted' });
          continue;
        }
        let blob;
        try {
          const resp = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(activeTabId, { action: 'FETCH_FILE', url: file.url }, (r) => {
              if (chrome.runtime.lastError || !r?.ok) reject(new Error(r?.error || 'content-script fetch failed'));
              else resolve(r);
            });
          });
          const bin = atob(resp.data);
          const arr = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
          blob = new Blob([arr], { type: resp.mime || 'application/octet-stream' });
        } catch {
          blob = await fetch(file.url).then((r) => r.blob());
        }
        // Bug 2 fix: use mimeToExt for correct extension (e.g. docx, xlsx, pdf)
        const ext = (assetName.includes('.') ? '' : `.${mimeToExt(blob.type, 'bin')}`);
        const fullName = assetName.includes('.') ? assetName : `${assetName}${ext}`;
        const data = new Uint8Array(await blob.arrayBuffer());
        assetFiles.push({ name: fullName, content: data, mime: blob.type || 'application/octet-stream' });
        urlMap.set(file.url, fullName);
        idx++;
      } catch (err) {
        failures.push({ url: file.url.slice(0, 200), reason: (err?.message || 'fetch-failed').slice(0, 100) });
      }
    }

    // Build per-asset entries for the manifest
    const assetEntries = [];
    for (const [originalUrl, localPath] of urlMap) {
      const matchingFile = assetFiles.find((f) => f.name === localPath);
      let originHost = '';
      let scheme = '';
      try {
        if (/^https?:\/\//i.test(originalUrl)) {
          const u = new URL(originalUrl);
          originHost = u.hostname;
          scheme = u.protocol;
        } else if (/^data:/i.test(originalUrl)) {
          scheme = 'data:';
          originHost = '(inline)';
        }
      } catch { /* invalid URL */ }
      assetEntries.push({
        assetId: localPath.replace('assets/', '').replace(/\.[^.]+$/, ''),
        fileName: localPath,
        byteLength: matchingFile ? matchingFile.content.length || 0 : 0,
        mime: matchingFile ? matchingFile.mime : 'unknown',
        originHost,
        scheme,
        status: 'resolved',
        failureReason: null,
      });
    }
    // Add failed assets to entries
    for (const f of failures) {
      let originHost = '';
      let scheme = '';
      try {
        if (/^https?:\/\//i.test(f.url)) {
          const u = new URL(f.url);
          originHost = u.hostname;
          scheme = u.protocol;
        }
      } catch { /* invalid URL */ }
      assetEntries.push({
        assetId: null,
        fileName: null,
        byteLength: 0,
        mime: null,
        originHost,
        scheme,
        status: 'failed',
        failureReason: f.reason || 'unknown',
      });
    }

    // Asset manifest v2 with per-asset entries
    const assetManifest = {
      schema: 'asset-manifest.v2',
      resolved: urlMap.size,
      failed: failures.length,
      total: imageSources.length + fileSources.length,
      entries: assetEntries,
    };
    assetFiles.push({ name: 'assets/asset_manifest.json', content: JSON.stringify(assetManifest, null, 2), mime: 'application/json' });

    return { assetFiles, urlMap, failures };
  }


  async function generateContent(fmt, data, urlMap) {
    // Delegate to lib/export.mjs with checkers for PDF functions
    const checkers = {
      useRaster: document.getElementById('check-raster-pdf')?.checked || false,
      hasNonLatinChars,
      buildSearchablePdf,
      // Bug 4 fix: pass urlMap to buildCanvasPdf so local asset paths work in raster PDF
      buildCanvasPdf: (title, msgs) => buildCanvasPdf(title, msgs, urlMap),
      buildTextPdf,
    };
    return generateContentFromLib(fmt, data, urlMap, checkers);
  }

  // --- createRobustZip delegated to lib/export.mjs ---
  async function createRobustZip(files) { return createRobustZipLib(files); }

  // --- D) GestureToken enforcement ---
  // Chrome loses user gesture context after first await. We use a time-windowed
  // token: gesture is valid for 30s after user click (covers async export).
  // permissions.request and chrome.downloads.download must be called
  // synchronously in the click handler BEFORE any await.
  let _gestureTokenTs = 0;
  let _gestureTokenValid = false;
  const GESTURE_TTL_MS = 30_000; // 30 seconds

  function withGesture(fn) {
    return async function (...args) {
      // D) Issue gesture token synchronously in the click handler
      _gestureTokenTs = Date.now();
      _gestureTokenValid = true;
      try { return await fn.apply(this, args); }
      finally {
        _gestureTokenValid = false;
        _gestureTokenTs = 0;
      }
    };
  }

  function assertGesture(action) {
    const elapsed = Date.now() - _gestureTokenTs;
    if (!_gestureTokenValid || elapsed > GESTURE_TTL_MS) {
      console.warn(`[GestureToken] Blocked ${action}: token expired (${elapsed}ms elapsed, TTL=${GESTURE_TTL_MS}ms).`);
      _gestureTokenValid = false;
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

  // debugMode toggle: debug mode controls verbose JSONL vs minimal diagnostics
  // B) Diagnostics button is always visible (minimal diagnostics always captured)
  if (checkDebugMode) {
    checkDebugMode.addEventListener('change', () => {
      console.log(`[DebugMode] ${checkDebugMode.checked ? 'ON (verbose JSONL)' : 'OFF (minimal summary)'}`);
    });
  }

  // Forensic bundle export: 3-file download (diagnostics.jsonl, run_summary.json, asset_failures.json)
  if (btnDownloadDiagnostics) {
    btnDownloadDiagnostics.onclick = withGesture(async () => {
      // D2: 3-tier fallback: (1) local cache â†’ (2) SW storage â†’ (3) chrome.storage.local
      if (!lastDiagnostics) {
        try {
          const swResp = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'GET_DIAGNOSTICS_JSONL' }, (r) => resolve(r));
          });
          if (swResp?.ok && swResp.diagnostics) lastDiagnostics = swResp.diagnostics;
        } catch (_) { /* SW unavailable */ }
      }
      if (!lastDiagnostics) {
        // Tier 3: chrome.storage.local
        try {
          const stored = await new Promise((resolve) => {
            chrome.storage.local.get('last_min_forensics', (r) => resolve(r));
          });
          if (stored?.last_min_forensics) lastDiagnostics = stored.last_min_forensics;
        } catch (_) { /* storage unavailable */ }
      }
      const date = new Date().toISOString().slice(0, 10);
      const prefix = `${(currentChatData?.platform || 'Export').replace(/[^a-zA-Z0-9]/g, '')}_${date}`;

      // INVARIANT: always produce a downloadable bundle â€” never "No Diagnostics"
      if (!lastDiagnostics) {
        // Produce minimal empty-state diagnostics file
        lastDiagnostics = {
          schema_version: 'diagnostics.v6',
          run: { run_id: 'none', started_at_utc: null, ended_at_utc: null, tool_version: '0.12.1', platform: currentChatData?.platform || 'unknown' },
          tabScope: activeTabId != null ? `tab:${activeTabId}` : 'global',
          entries: [],
          counts: { messages_total: 0, messages_unknown: 0, assets_failed: 0 },
          failures: [],
          scorecard: { messages_total: 0, unknown_role_ratio: 0, unknown_role_pass: false, has_messages: false, anomalyScore: 100 },
          invariants: null,
          verbose: false,
          _empty_reason: 'no_export_has_run_yet',
        };
      }

      // File 1: diagnostics.jsonl (all flight recorder entries)
      const jsonlContent = (lastDiagnostics.entries || []).map((e) => JSON.stringify(e)).join('\n');
      // File 2: run_summary.json (run metadata + scorecard)
      const runSummary = {
        schema_version: lastDiagnostics.schema_version,
        run: lastDiagnostics.run,
        tabScope: lastDiagnostics.tabScope,
        counts: lastDiagnostics.counts,
        scorecard: lastDiagnostics.scorecard,
        entryCount: (lastDiagnostics.entries || []).length,
      };
      // File 3: asset_failures.json
      const assetFailures = {
        failures: lastDiagnostics.failures || [],
        failureCount: (lastDiagnostics.failures || []).length,
      };
      // File 4: min_forensics.json (always present)
      const minForensics = {
        schema: 'min-forensics.v1',
        runId: lastDiagnostics.run?.run_id || 'none',
        platform: lastDiagnostics.run?.platform || 'unknown',
        toolVersion: lastDiagnostics.run?.tool_version || '0.12.1',
        exportedAt: new Date().toISOString(),
        messageCount: lastDiagnostics.counts?.messages_total || 0,
        anomalyScore: lastDiagnostics.scorecard?.anomalyScore ?? -1,
        triageCategory: lastDiagnostics._empty_reason ? 'empty' : (lastDiagnostics.scorecard?.anomalyScore > 30 ? 'warnings' : 'ok'),
      };

      const bundleFiles = [
        { name: `${prefix}.diagnostics.jsonl`, content: jsonlContent || '', mime: 'application/x-ndjson' },
        { name: `${prefix}.run_summary.json`, content: JSON.stringify(runSummary, null, 2), mime: 'application/json' },
        { name: `${prefix}.asset_failures.json`, content: JSON.stringify(assetFailures, null, 2), mime: 'application/json' },
        { name: `${prefix}.min_forensics.json`, content: JSON.stringify(minForensics, null, 2), mime: 'application/json' },
      ];

      const zip = await createRobustZip(bundleFiles);
      downloadBlob(zip, `${prefix}_diagnostics_bundle.zip`);
    });
  }

  // Listen for extraction progress messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'EXTRACTION_PROGRESS') {
      setAnalyzeProgress(msg.percent, msg.label || 'Processing');
    }
  });

  safeInit();
});
