// background.js - State & Log Manager
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
      case "SET_DATA":
        tabStates[tabId] = {
          data: message.data,
          loading: message.loading || false,
          timestamp: Date.now()
        };
        log("SUCCESS", `Extracted Data from Tab ${tabId}`, { 
            platform: message.data?.platform, 
            count: message.data?.messages?.length 
        });
        sendResponse({ success: true });
        break;

      case "GET_DATA":
        const state = tabStates[tabId];
        sendResponse(state || { data: null, loading: false });
        break;

      case "CLEAR_DATA":
        delete tabStates[tabId];
        sendResponse({ success: true });
        break;

      case "LOG_ERROR":
        log("ERROR", message.message, message.details);
        sendResponse({ success: true });
        break;
        
      case "LOG_INFO":
        log("INFO", message.message, message.details);
        sendResponse({ success: true });
        break;
        
      case "GET_LOGS":
        sendResponse(appLogs);
        break;

      default:
        break;
    }
  } catch (e) {
    console.error("Background error:", e);
    log("CRITICAL", "Background Script Error", e.message);
  }
  return true;
});