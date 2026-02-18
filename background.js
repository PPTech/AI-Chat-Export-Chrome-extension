// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// background.js - State & Log Manager v0.10.6

const tabStates = {};
const appLogs = [];
let runtimeKeyPromise = null;

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

async function getRuntimeKey() {
  if (!runtimeKeyPromise) {
    runtimeKeyPromise = crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  return runtimeKeyPromise;
}

function toBase64(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptPayload(payload) {
  const key = await getRuntimeKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload || {}));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: toBase64(iv), cipher: toBase64(encrypted) };
}

async function decryptPayload(record) {
  if (!record?.cipher || !record?.iv) return null;
  const key = await getRuntimeKey();
  const iv = fromBase64(record.iv);
  const cipher = fromBase64(record.cipher);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = message.tabId || (sender.tab ? sender.tab.id : null);

  (async () => {
    try {
      switch (message.action) {
        case 'SET_DATA': {
          const encryptedData = await encryptPayload(message.data);
          tabStates[tabId] = {
            encryptedData,
            loading: message.loading || false,
            timestamp: Date.now()
          };
          log('STATE_CHANGE', `SET_DATA for Tab ${tabId}`, {
            platform: message.data?.platform,
            msgCount: message.data?.messages?.length,
            encrypted: true
          });
          sendResponse({ success: true });
          break;
        }

        case 'GET_DATA': {
          const state = tabStates[tabId];
          if (!state) {
            log('STATE_ACCESS', `GET_DATA for Tab ${tabId}`, { found: false });
            sendResponse({ data: null, loading: false });
            break;
          }
          const data = await decryptPayload(state.encryptedData);
          log('STATE_ACCESS', `GET_DATA for Tab ${tabId}`, { found: true, encrypted: true });
          sendResponse({ data, loading: state.loading, timestamp: state.timestamp });
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
  })();

  return true;
});
