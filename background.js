/**
 * AI Chat Export & Local Agent (Project Aegis)
 * Copyright (C) 2026 [YOUR_COMPANY_NAME_HERE]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/.
 *
 * -------------------------------------------------------------------------
 * COMMERCIAL LICENSE / PROPRIETARY USE:
 * If you wish to use this code in a proprietary software product,
 * enterprise environment, or commercial project where you do not wish to
 * open-source your own code, you MUST purchase a Commercial License from:
 * [INSERT_CONTACT_EMAIL_OR_WEBSITE]
 * -------------------------------------------------------------------------
 */
// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// background.js - State & Log Manager v0.12.4

console.log('[LOCAL-ONLY] AI engine network disabled; offline models only.');
const nativeBackgroundFetch = globalThis.fetch?.bind(globalThis);


function isAllowedMediaHost(url) {
  try {
    const host = new URL(url).hostname;
    const allow = ['chatgpt.com','chat.openai.com','oaiusercontent.com','oaistatic.com','openai.com','claude.ai','anthropic.com','googleusercontent.com','gstatic.com','google.com'];
    return allow.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

async function mediaFetchProxy(payload = {}) {
  const url = String(payload.url || '');
  const userInitiated = !!payload.userInitiated;
  if (!userInitiated) return { success: false, error: 'user_initiation_required' };
  if (!/^https?:\/\//i.test(url)) return { success: false, error: 'unsupported_scheme' };
  if (!isAllowedMediaHost(url)) return { success: false, error: 'host_not_allowlisted' };
  if (!nativeBackgroundFetch) return { success: false, error: 'fetch_unavailable' };
  try {
    const res = await nativeBackgroundFetch(url, { credentials: 'include' });
    if (!res.ok) return { success: false, error: `HTTP_${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const b64 = Buffer.from(bytes).toString('base64');
    return { success: true, mime: res.headers.get('content-type') || 'application/octet-stream', dataUrl: `data:${res.headers.get('content-type') || 'application/octet-stream'};base64,${b64}`, byteLength: bytes.length };
  } catch (e) {
    return { success: false, error: e.message || 'media_fetch_failed' };
  }
}

function patchLocalOnlyNetworkGuards() {
  const allow = ['chrome-extension://', 'data:', 'blob:'];
  const check = (url) => {
    const u = String(url || '');
    if (allow.some((p) => u.startsWith(p))) return;
    throw new Error(`[LOCAL-ONLY] blocked outbound request: ${u}`);
  };
  const originalFetch = globalThis.fetch?.bind(globalThis);
  if (originalFetch) {
    globalThis.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      check(url);
      return originalFetch(input, init);
    };
  }
}

patchLocalOnlyNetworkGuards();

const tabStates = {};

async function downloadMhtmlArtifact(payload = {}) {
  const fileName = payload.fileName || `aegis_export_${new Date().toISOString().slice(0, 10)}.mhtml`;
  const content = String(payload.content || '');
  if (!content) return { success: false, error: 'empty_mhtml' };
  const blob = new Blob([content], { type: 'multipart/related' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    chrome.downloads.download({ url, filename: fileName, saveAs: false }, (downloadId) => {
      setTimeout(() => URL.revokeObjectURL(url), 12_000);
      if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
      else resolve({ success: true, downloadId });
    });
  });
}

const appLogs = [];
const runtimeJsonlLogs = [];
const pendingCaptures = new Map();
let captureSeq = 0;

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) return false;
  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) return true;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Run local-only AI planning and recipe memory in hidden context.'
  });
  return true;
}


function routeToTabAction(tabId, action, payload, sendResponse) {
  if (!tabId) { sendResponse({ success: false, error: 'missing_tab_id' }); return; }
  chrome.tabs.sendMessage(tabId, { action, ...(payload || {}) }, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message || 'tab_route_failed' });
      return;
    }
    sendResponse(response || { success: false, error: 'empty_tab_response' });
  });
}

function routeToOffscreen(action, payload, sendResponse) {
  ensureOffscreenDocument().then((ok) => {
    if (!ok) {
      sendResponse({ ok: false, error: 'offscreen_unavailable' });
      return;
    }
    chrome.runtime.sendMessage({ action, payload: payload || {} }, (res) => {
      sendResponse(res || { ok: false, error: chrome.runtime.lastError?.message || 'offscreen_no_response' });
    });
  }).catch((error) => {
    sendResponse({ ok: false, error: error.message || 'offscreen_route_error' });
  });
}

function createCapture(tabId, expectedFilename, timeoutMs = 9000) {
  const captureId = `cap_${Date.now()}_${captureSeq += 1}`;
  const state = {
    captureId,
    tabId,
    expectedFilename: String(expectedFilename || '').toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + timeoutMs,
    done: false,
    result: null
  };
  pendingCaptures.set(captureId, state);
  setTimeout(() => {
    const cur = pendingCaptures.get(captureId);
    if (!cur || cur.done) return;
    cur.done = true;
    cur.result = { success: false, error: 'capture_timeout', method: null, finalUrl: null };
  }, timeoutMs + 20);
  return state;
}

function matchCapture(state, tabId, url, filename) {
  if (state.done) return false;
  if (Date.now() > state.expiresAt) return false;
  if (state.tabId && tabId && state.tabId !== tabId) return false;
  const nUrl = String(url || '').toLowerCase();
  const nFile = String(filename || '').toLowerCase();
  if (state.expectedFilename && (nUrl.includes(state.expectedFilename) || nFile.includes(state.expectedFilename))) return true;
  return !state.expectedFilename;
}

function completeCapture(captureId, payload) {
  const state = pendingCaptures.get(captureId);
  if (!state || state.done) return;
  state.done = true;
  state.result = payload;
}

chrome.downloads.onCreated.addListener((item) => {
  for (const [captureId, state] of pendingCaptures.entries()) {
    if (!matchCapture(state, item.tabId, item.finalUrl || item.url, item.filename)) continue;
    completeCapture(captureId, {
      success: true,
      method: 'downloads_api',
      finalUrl: item.finalUrl || item.url || null,
      downloadId: item.id
    });
  }
});

chrome.webRequest.onBeforeRequest.addListener((details) => {
  const url = details.url || '';
  for (const [captureId, state] of pendingCaptures.entries()) {
    if (!matchCapture(state, details.tabId, url, '')) continue;
    if (!/(download|files|backend-api|mnt\/data|blob|artifact)/i.test(url)) continue;
    completeCapture(captureId, {
      success: true,
      method: 'webrequest',
      finalUrl: url,
      downloadId: null
    });
  }
}, { urls: ['https://chatgpt.com/*', 'https://chat.openai.com/*', 'https://*.oaistatic.com/*', 'https://*.openai.com/*', 'https://*.oaiusercontent.com/*', 'https://claude.ai/*', 'https://*.anthropic.com/*', 'https://gemini.google.com/*', 'https://aistudio.google.com/*', 'https://*.googleusercontent.com/*'] });

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo?.url) return;
  for (const [captureId, state] of pendingCaptures.entries()) {
    if (!matchCapture(state, tabId, changeInfo.url, '')) continue;
    if (!/(download|files|mnt\/data|artifact|blob:)/i.test(changeInfo.url)) continue;
    completeCapture(captureId, {
      success: true,
      method: 'tabs_update',
      finalUrl: changeInfo.url,
      downloadId: null
    });
  }
});

function redactDetails(details) {
  if (details == null) return '';
  const txt = typeof details === 'string' ? details : JSON.stringify(details);
  return String(txt)
    .replace(/https?:\/\/[^\s"']+/g, '[REDACTED_URL]')
    .replace(/[A-Za-z0-9_\-]{24,}/g, '[REDACTED_TOKEN]')
    .slice(0, 1200);
}

function log(level, message, details = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details: redactDetails(details)
  };
  appLogs.push(entry);
  runtimeJsonlLogs.push(JSON.stringify({ ts: entry.timestamp, level: entry.level, message: entry.message, details: entry.details }));
  if (appLogs.length > 1000) appLogs.shift();
  if (runtimeJsonlLogs.length > 2000) runtimeJsonlLogs.shift();
  console.log(`[${level}] ${message}`, details || '');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = message.tabId || (sender.tab ? sender.tab.id : null);

  try {
    switch (message.action) {
      case 'SET_DATA':
        tabStates[tabId] = {
          data: message.data,
          loading: message.loading || false,
          timestamp: Date.now()
        };
        log('STATE_CHANGE', `SET_DATA for Tab ${tabId}`, {
          platform: message.data?.platform,
          msgCount: message.data?.messages?.length
        });
        sendResponse({ success: true });
        break;

      case 'GET_DATA': {
        const state = tabStates[tabId];
        log('STATE_ACCESS', `GET_DATA for Tab ${tabId}`, { found: !!state });
        sendResponse(state || { data: null, loading: false });
        break;
      }

      case 'CLEAR_DATA':
        delete tabStates[tabId];
        log('STATE_CHANGE', `CLEAR_DATA for Tab ${tabId}`);
        sendResponse({ success: true });
        break;

      case 'LOG_ERROR':
        log('ERROR', message.message, message.details);
        sendResponse({ success: true });
        break;

      case 'GET_LOGS':
        sendResponse(appLogs);
        break;

      case 'GET_DIAGNOSTICS_JSONL':
        sendResponse({ success: true, lines: runtimeJsonlLogs.slice(-1000) });
        break;

      case 'START_DOWNLOAD_CAPTURE': {
        const capture = createCapture(tabId, message.expectedFilename, Number(message.timeoutMs) || 9000);
        sendResponse({ success: true, captureId: capture.captureId });
        break;
      }

      case 'WAIT_DOWNLOAD_CAPTURE': {
        const capture = pendingCaptures.get(message.captureId);
        if (!capture) {
          sendResponse({ success: false, error: 'capture_not_found' });
          break;
        }
        const checkUntil = Date.now() + 10000;
        const poll = () => {
          const cur = pendingCaptures.get(message.captureId);
          if (!cur) {
            sendResponse({ success: false, error: 'capture_removed' });
            return;
          }
          if (cur.done) {
            sendResponse(cur.result || { success: false, error: 'capture_failed' });
            pendingCaptures.delete(message.captureId);
            return;
          }
          if (Date.now() > checkUntil) {
            sendResponse({ success: false, error: 'capture_wait_timeout' });
            pendingCaptures.delete(message.captureId);
            return;
          }
          setTimeout(poll, 160);
        };
        poll();
        return true;
      }



      case 'EXTRACT_VISUAL_CORTEX': {
        routeToTabAction(tabId, 'extract_visual_cortex', message.payload || {}, sendResponse);
        return true;
      }

      case 'BUILD_ARTIFACTS_PREVIEW': {
        routeToTabAction(tabId, 'build_artifacts_preview', message.payload || {}, sendResponse);
        return true;
      }

      case 'MEDIA_FETCH_PROXY': {
        mediaFetchProxy(message.payload || {}).then(sendResponse);
        return true;
      }

      case 'DOWNLOAD_MHTML_ARTIFACT': {
        downloadMhtmlArtifact(message.payload || {}).then(sendResponse);
        return true;
      }

      case 'RUN_LOCAL_AGENT_ENGINE': {
        routeToOffscreen('OFFSCREEN_RUN_AGENT', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_CLASSIFY_TEXT': {
        routeToOffscreen('OFFSCREEN_CLASSIFY_TEXT', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_DETECT_ARTIFACTS': {
        routeToOffscreen('OFFSCREEN_DETECT_ARTIFACTS', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_VERIFY_MODEL': {
        routeToOffscreen('OFFSCREEN_VERIFY_MODEL', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_INIT_CLASSIFIER': {
        routeToOffscreen('OFFSCREEN_INIT_CLASSIFIER', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_GET_RECIPE': {
        routeToOffscreen('OFFSCREEN_GET_RECIPE', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_SAVE_RECIPE': {
        routeToOffscreen('OFFSCREEN_SAVE_RECIPE', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_SAVE_CHAT': {
        routeToOffscreen('OFFSCREEN_SAVE_CHAT', message.payload || {}, sendResponse);
        return true;
      }

      case 'LOCAL_SAVE_IMAGE': {
        routeToOffscreen('OFFSCREEN_SAVE_IMAGE', message.payload || {}, sendResponse);
        return true;
      }


      case 'LOCAL_PURGE_LEARNING': {
        routeToOffscreen('OFFSCREEN_PURGE_LEARNING', message.payload || {}, sendResponse);
        return true;
      }
      default:
        sendResponse({ success: false, error: 'Unknown action' });
        break;
    }
  } catch (e) {
    console.error('Background error:', e);
    log('CRITICAL', 'Background Script Error', e.message);
    sendResponse({ success: false, error: e.message });
  }

  return true;
});
