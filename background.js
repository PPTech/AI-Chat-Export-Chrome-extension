// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// background.js - State & Log Manager v0.10.10

const tabStates = {};
const appLogs = [];

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
