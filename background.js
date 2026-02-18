// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// background.js - State & Log Manager v0.10.16

const tabStates = {};
const appLogs = [];
const pendingCaptures = new Map();
let captureSeq = 0;

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
}, { urls: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] });

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

function log(level, message, details = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ? JSON.stringify(details) : ''
  };
  appLogs.push(entry);
  if (appLogs.length > 1000) appLogs.shift();
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
