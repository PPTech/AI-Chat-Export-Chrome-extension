// License: MIT
// Author: Dr. Babak Sorkhpour (with help of AI)
// background.js - Service Worker: State Manager + Diagnostics Broker v0.11.0
//
// MV3 message rule: every handler MUST call sendResponse() and the listener
// MUST return true so Chrome keeps the message channel open for async replies.

const tabStates = {};
const appLogs = [];

// --- Diagnostics ring buffer (Phase 1: always captured, even debug OFF) ---
const diagnosticsStore = {}; // keyed by runId

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

      case 'LOG_INFO':
        log('INFO', message.message, message.details);
        sendResponse({ success: true });
        break;

      case 'GET_LOGS':
        sendResponse(appLogs);
        break;

      // --- Extraction progress from content script ---
      case 'EXTRACTION_PROGRESS': {
        const pct = message.percent || 0;
        const lbl = message.label || 'Processing';
        log('INFO', `Extraction progress: ${pct}% — ${lbl}`, { tabId, details: message.details });
        sendResponse({ ok: true });
        break;
      }

      // --- Phase 1: Diagnostics message handlers (MUST always respond) ---

      case 'STORE_DIAGNOSTICS': {
        // Popup stores diagnostics after every export (debug ON or OFF).
        const runId = message.runId;
        if (!runId || !message.payload) {
          sendResponse({ ok: false, reason: 'missing runId or payload' });
          break;
        }
        diagnosticsStore[runId] = {
          payload: message.payload,
          storedAt: Date.now()
        };
        // Keep max 20 runs to avoid memory bloat in SW
        const keys = Object.keys(diagnosticsStore);
        if (keys.length > 20) {
          delete diagnosticsStore[keys[0]];
        }
        log('DIAG_STORE', `Stored diagnostics for run ${runId}`);
        sendResponse({ ok: true });
        break;
      }

      case 'GET_DIAGNOSTICS_JSONL': {
        // Returns diagnostics for latest run (or specific runId).
        const targetId = message.runId || Object.keys(diagnosticsStore).pop();
        if (!targetId || !diagnosticsStore[targetId]) {
          sendResponse({ ok: false, reason: 'no diagnostics available' });
          break;
        }
        const diag = diagnosticsStore[targetId].payload;
        log('DIAG_FETCH', `Serving diagnostics for run ${targetId}`);
        sendResponse({ ok: true, runId: targetId, diagnostics: diag });
        break;
      }

      case 'GET_DIAGNOSTICS_LIST': {
        // List all stored diagnostics runs
        const list = Object.entries(diagnosticsStore).map(([id, v]) => ({
          runId: id, storedAt: v.storedAt
        }));
        sendResponse({ ok: true, runs: list });
        break;
      }

      // --- Gesture token validation (Phase 2: SW denies without fresh token) ---
      case 'VALIDATE_GESTURE': {
        const ts = message.gestureTokenTs;
        const ttl = 30000; // 30 seconds
        const elapsed = Date.now() - (ts || 0);
        const valid = ts > 0 && elapsed <= ttl;
        if (!valid) {
          log('GESTURE_DENY', `Gesture token expired (${elapsed}ms elapsed, TTL=${ttl}ms)`);
        }
        sendResponse({ ok: true, valid, elapsed });
        break;
      }

      default:
        log('UNKNOWN_ACTION', `Unhandled action: ${message.action}`);
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        break;
    }
  } catch (e) {
    console.error('Background error:', e);
    log('CRITICAL', 'Background Script Error', e.message);
    sendResponse({ success: false, error: e.message });
  }

  // MV3: MUST return true so sendResponse works for async cases
  return true;
});
