// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/state.mjs - App State and Settings Management

export const SETTINGS_KEY = 'ai_exporter_settings_v1';

export const State = {
    activeTabId: null,
    currentChatData: null,
    lastDiagnostics: null,
    lastAssetFailures: []
};

export function getDefaultSettings() {
    return {
        convertImages: true,
        highlightCode: true,
        rawHtml: false,
        zip: false,
        photoZip: true,
        exportFiles: true,
        advancedLinks: false,
        debugMode: false,
        rasterPdf: false
    };
}

export function collectSettings(uiEls) {
    return {
        convertImages: !!uiEls.checkImages.checked,
        highlightCode: !!uiEls.checkCode.checked,
        rawHtml: !!uiEls.checkRawHtml.checked,
        zip: !!uiEls.checkZip.checked,
        photoZip: !!uiEls.checkPhotoZip.checked,
        exportFiles: !!uiEls.checkExportFiles.checked,
        advancedLinks: !!uiEls.checkAdvancedLinks.checked,
        debugMode: !!uiEls.checkDebugMode.checked,
        rasterPdf: !!uiEls.checkRasterPdf?.checked,
        updatedAt: new Date().toISOString()
    };
}

export function applySettings(settings, uiEls) {
    const s = { ...getDefaultSettings(), ...(settings || {}) };
    uiEls.checkImages.checked = !!s.convertImages;
    uiEls.checkCode.checked = !!s.highlightCode;
    uiEls.checkRawHtml.checked = !!s.rawHtml;
    uiEls.checkZip.checked = !!s.zip;
    uiEls.checkPhotoZip.checked = !!s.photoZip;
    uiEls.checkExportFiles.checked = !!s.exportFiles;
    uiEls.checkAdvancedLinks.checked = !!s.advancedLinks;
    uiEls.checkDebugMode.checked = !!s.debugMode;
    if (uiEls.checkRasterPdf) uiEls.checkRasterPdf.checked = !!s.rasterPdf;
    if (uiEls.btnDownloadDiagnostics) uiEls.btnDownloadDiagnostics.style.display = 'block';
}

export function isDebugMode(uiEls) {
    return !!uiEls.checkDebugMode.checked;
}

export function saveSettingsToStorage(settings) {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function loadSettingsFromStorage(uiEls, callback) {
    chrome.storage.local.get([SETTINGS_KEY], (res) => {
        applySettings(res?.[SETTINGS_KEY] || getDefaultSettings(), uiEls);
        if (callback) callback();
    });
}
