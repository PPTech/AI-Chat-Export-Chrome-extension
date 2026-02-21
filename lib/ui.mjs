// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// lib/ui.mjs - UI Management

export const UI = {
    btnExport: null,
    btnLoadFull: null,
    btnClearAll: null,
    btnPreview: null,
    btnExportImages: null,
    btnExportFiles: null,
    btnLogs: null,
    btnExportConfig: null,
    checkImages: null,
    checkCode: null,
    checkRawHtml: null,
    checkZip: null,
    checkPhotoZip: null,
    checkExportFiles: null,
    checkAdvancedLinks: null,
    checkDebugMode: null,
    checkRasterPdf: null,
    btnDownloadDiagnostics: null,
    settingsModal: null,
    errorModal: null,
    aboutModal: null,
    infoModal: null,
    errorMsg: null,
    errorFix: null,

    init() {
        this.btnExport = document.getElementById('btn-export-main');
        this.btnLoadFull = document.getElementById('btn-load-full');
        this.btnClearAll = document.getElementById('btn-clear-all');
        this.btnPreview = document.getElementById('btn-preview');
        this.btnExportImages = document.getElementById('btn-export-images');
        this.btnExportFiles = document.getElementById('btn-export-files');
        this.btnLogs = document.getElementById('btn-download-logs');
        this.btnExportConfig = document.getElementById('btn-export-config');
        this.checkImages = document.getElementById('check-images');
        this.checkCode = document.getElementById('check-code');
        this.checkRawHtml = document.getElementById('check-raw-html');
        this.checkZip = document.getElementById('check-zip');
        this.checkPhotoZip = document.getElementById('check-photo-zip');
        this.checkExportFiles = document.getElementById('check-export-files');
        this.checkAdvancedLinks = document.getElementById('check-advanced-links');
        this.checkDebugMode = document.getElementById('check-debug-mode');
        this.checkRasterPdf = document.getElementById('check-raster-pdf');
        this.btnDownloadDiagnostics = document.getElementById('btn-download-diagnostics');
        this.settingsModal = document.getElementById('settings-modal');
        this.errorModal = document.getElementById('error-modal');
        this.aboutModal = document.getElementById('about-modal');
        this.infoModal = document.getElementById('info-modal');
        this.errorMsg = document.getElementById('error-msg');
        this.errorFix = document.getElementById('error-fix');
    },

    updateExportBtn(hasData) {
        const count = document.querySelectorAll('.format-item.selected').length;
        this.btnExport.disabled = count === 0 || !hasData;
        this.btnExport.textContent = count > 1 ? `Generate Bundle (${count})` : 'Generate File';
    },

    setProcessingProgress(percent, label = 'Processing') {
        const bounded = Math.max(0, Math.min(100, Math.round(percent)));
        this.btnExport.textContent = `${label} ${bounded}%`;
    },

    setAnalyzeProgress(percent, label = 'Analyzing') {
        const el = document.getElementById('analyze-progress');
        const bar = document.getElementById('analyze-progress-bar');
        if (!el) return;
        const bounded = Math.max(0, Math.min(100, Math.round(percent)));
        el.textContent = `Analysis: ${bounded}% — ${label}`;
        if (bar) {
            bar.style.width = `${bounded}%`;
            bar.style.background = bounded >= 100 ? 'var(--success, #10b981)' : 'var(--primary, #2563eb)';
        }
    },

    updateDetectedSummary(c) {
        const el = document.getElementById('detected-summary');
        if (!el) return;
        el.textContent = `Detected: ${c.messages} messages • ${c.photos} photos • ${c.files} files • ${c.others} others`;
    },

    showInfo(title, body) {
        document.getElementById('info-title').textContent = title;
        document.getElementById('info-body').textContent = body;
        this.openModal(this.infoModal);
    },

    showError(error) {
        this.errorMsg.textContent = error?.message || 'Unknown export error.';
        this.errorFix.textContent = 'Use Fetch Full first. If images still missing, enable Include Images and retry.';
        this.openModal(this.errorModal);
    },

    openModal(m) { if (m) m.style.display = 'flex'; },
    closeModal(m) { if (m) m.style.display = 'none'; },

    getSelectedFormats() {
        return Array.from(document.querySelectorAll('.format-item.selected')).map((i) => i.dataset.ext);
    },

    setupListeners(handlers) {
        document.querySelectorAll('.format-item').forEach((item) => {
            item.onclick = () => {
                item.classList.toggle('selected');
                handlers.onFormatChanged();
            };
        });

        document.getElementById('btn-open-settings').onclick = () => this.openModal(this.settingsModal);
        document.getElementById('btn-close-settings').onclick = () => this.closeModal(this.settingsModal);
        document.getElementById('btn-save-settings').onclick = () => handlers.onSaveSettings();
        document.getElementById('btn-open-about').onclick = () => this.openModal(this.aboutModal);
        document.getElementById('btn-open-login').onclick = () => this.showInfo('Login (Draft)', 'Draft login page is reserved for future account features. Current version works locally with your active browser session only.');
        document.getElementById('btn-open-contact').onclick = () => this.showInfo('Contact (Draft)', 'Draft contact page is reserved for support and compliance requests.');
        document.getElementById('btn-close-about').onclick = document.getElementById('btn-ack-about').onclick = () => this.closeModal(this.aboutModal);
        document.getElementById('btn-close-error').onclick = () => this.closeModal(this.errorModal);
        document.getElementById('btn-close-preview').onclick = () => this.closeModal(document.getElementById('preview-modal'));
        document.getElementById('link-legal').onclick = () => this.showInfo('Legal', 'This is a local-processing developer version. Users remain responsible for lawful and compliant use in their jurisdiction.');
        document.getElementById('link-security').onclick = () => this.showInfo('Security', 'Security baseline: local-only processing, sanitized exports, no eval, and optional risky Raw HTML mode.');

        if (this.checkDebugMode) {
            this.checkDebugMode.addEventListener('change', () => {
                console.log(`[DebugMode] ${this.checkDebugMode.checked ? 'ON (verbose JSONL)' : 'OFF (minimal summary)'}`);
            });
        }

        if (this.btnExport) this.btnExport.onclick = handlers.onExport;
        if (this.btnLoadFull) this.btnLoadFull.onclick = handlers.onLoadFull;
        if (this.btnClearAll) this.btnClearAll.onclick = handlers.onClearAll;
        if (this.btnPreview) this.btnPreview.onclick = handlers.onPreview;
        if (this.btnExportImages) this.btnExportImages.onclick = handlers.onExportImages;
        if (this.btnExportFiles) this.btnExportFiles.onclick = handlers.onExportFiles;
        if (this.btnLogs) this.btnLogs.onclick = handlers.onLogs;
        if (this.btnExportConfig) this.btnExportConfig.onclick = handlers.onExportConfig;
        if (this.btnDownloadDiagnostics) this.btnDownloadDiagnostics.onclick = handlers.onDownloadDiagnostics;
    }
};
