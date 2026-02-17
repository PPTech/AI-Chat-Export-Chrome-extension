document.addEventListener('DOMContentLoaded', () => {
    let currentChatData = null;
    let activeTabId = null;

    // UI Refs
    const btnExport = document.getElementById('btn-export-main');
    const checkImages = document.getElementById('check-images');
    const checkCode = document.getElementById('check-code');
    const checkRawHtml = document.getElementById('check-raw-html');
    const checkZip = document.getElementById('check-zip');

    const btnLogs = document.getElementById('btn-download-logs');

    // Modals
    const settingsModal = document.getElementById('settings-modal');
    const errorModal = document.getElementById('error-modal');
    const aboutModal = document.getElementById('about-modal');
    const errorMsg = document.getElementById('error-msg');
    const errorFix = document.getElementById('error-fix');

    // Encryption toggle


    // Initialize
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || tabs[0].url.startsWith("chrome://")) return;
        activeTabId = tabs[0].id;

        // Check background for existing data (Tab Isolation)
        chrome.runtime.sendMessage({ action: "GET_DATA", tabId: activeTabId }, (res) => {
            if (res && res.data) {
                processData(res.data);
            } else {
                requestExtraction();
            }
        });
    });

    // Request Extraction (with all options)
    function requestExtraction() {
        const options = {
            convertImages: checkImages.checked,
            rawHtml: checkRawHtml.checked,
            highlightCode: checkCode.checked // Pass to content script
        };
        chrome.tabs.sendMessage(activeTabId, { action: "extract_chat", options }, (res) => {
            if (chrome.runtime.lastError) {
                // Inject content script if missing
                chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ["content.js"] }, () => {
                    setTimeout(() => chrome.tabs.sendMessage(activeTabId, { action: "extract_chat", options }, processData), 500);
                });
            } else {
                processData(res);
            }
        });
    }

    function processData(res) {
        if (res && res.success) {
            currentChatData = res;
            document.getElementById('platform-badge').textContent = res.platform;
            document.getElementById('msg-count').textContent = res.messages.length;
            document.getElementById('empty-view').style.display = 'none';
            document.getElementById('stats-view').style.display = 'block';
            updateExportBtn();
            chrome.runtime.sendMessage({ action: "SET_DATA", tabId: activeTabId, data: res });
        } else if (res && !res.success && res.platform) {
            document.getElementById('platform-badge').textContent = res.platform;
        }
    }

    // Format Selection
    document.querySelectorAll('.format-item').forEach(item => {
        item.onclick = () => {
            item.classList.toggle('selected');
            updateExportBtn();
        };
    });

    function updateExportBtn() {
        const count = document.querySelectorAll('.format-item.selected').length;
        btnExport.disabled = count === 0 || !currentChatData;
        btnExport.textContent = count > 1 ? `Generate Bundle (${count})` : "Generate File";
    }

    // Logs
    btnLogs.onclick = () => {
        chrome.runtime.sendMessage({ action: "GET_LOGS" }, (logs) => {
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            downloadBlob(blob, 'ai_exporter_logs.json');
        });
    };

    // Export Logic
    btnExport.onclick = async () => {
        const formats = Array.from(document.querySelectorAll('.format-item.selected')).map(i => i.dataset.ext);
        btnExport.textContent = "Processing...";
        btnExport.disabled = true;

        try {
            const files = [];
            const date = new Date().toISOString().slice(0, 10);
            const baseName = `${(currentChatData.platform || "Export").replace(/[^a-zA-Z0-9]/g, '')}_${date}`;

            for (const fmt of formats) {
                const res = generateContent(fmt, currentChatData);
                if (res) { // PDF returns null because it prints directly
                    files.push({ name: `${baseName}.${fmt}`, content: res.content, mime: res.mime });
                }
            }

            // If only PDF was selected, files might be empty
            if (files.length === 0) {
                btnExport.textContent = "Done";
                btnExport.disabled = false;
                return;
            }

            if (files.length === 1 && !checkZip.checked) {
                downloadBlob(new Blob([files[0].content], { type: files[0].mime }), files[0].name);
            } else {
                const zip = await createRobustZip(files);
                downloadBlob(zip, `${baseName}.zip`);
            }
        } catch (e) {
            showError(e);
        } finally {
            updateExportBtn();
        }
    };

    function showError(e) {
        let suggestion = "Try refreshing the page or selecting a different format.";
        if (e.message.includes("CRC")) suggestion = "ZIP generation failed. Try exporting files individually.";
        if (e.message.includes("Popups")) suggestion = "Please allow popups for this extension to generate PDF previews.";

        errorMsg.textContent = e.message || "An unknown error occurred during export.";
        errorFix.textContent = suggestion;
        errorModal.style.display = 'flex';
    }

    function generateContent(fmt, data) {
        const msgs = data.messages;
        const title = data.title || "Export";
        let content = "", mime = "text/plain";

        const escapeHtml = (text) => {
            if (!text) return text;
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        try {
            if (fmt === 'pdf') {
                // PDF Strategy: Open print dialog
                const printContent = `
                <html><head><title>${escapeHtml(title)}</title>
                <style>
                    body{font-family:sans-serif;padding:40px;max-width:800px;margin:auto;}
                    .msg{margin-bottom:20px;page-break-inside:avoid;}
                    .role{font-weight:bold;margin-bottom:5px;text-transform:uppercase;font-size:10px;color:#555;}
                    img{max-width:100%;}
                    pre{background:#f0f0f0;padding:10px;border-radius:5px;white-space:pre-wrap;}
                </style></head><body><h1>${escapeHtml(title)}</h1>
                ${msgs.map(m => `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${escapeHtml(m.content).replace(/\n/g, '<br>')}</div></div>`).join('')}
                </body></html>`;
                const win = window.open('', '_blank');
                if (!win) throw new Error("Popups blocked. Allow popups for PDF.");
                win.document.write(printContent);
                win.document.close();
                setTimeout(() => { win.print(); win.close(); }, 500);
                return null; // No file to download, just print
            }
            else if (fmt === 'doc' || fmt === 'html') {
                const style = "body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:20px;line-height:1.6} img{max-width:100%;height:auto;border-radius:4px;margin:10px 0;} .msg{margin-bottom:20px;padding:15px;border:1px solid #eee;border-radius:8px;} .role{font-weight:bold;color:#333;margin-bottom:5px;}";
                content = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>`;
                content += msgs.map(m => `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${escapeHtml(m.content).replace(/\n/g, '<br>')}</div></div>`).join('');
                content += "</body></html>";
                mime = fmt === 'doc' ? 'application/msword' : 'text/html';
            }
            else if (fmt === 'sql') {
                content = `CREATE TABLE chat_export (id SERIAL PRIMARY KEY, role VARCHAR(50), content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);\n`;
                content += msgs.map(m => `INSERT INTO chat_export (role, content) VALUES ('${m.role.replace(/'/g, "''")}', '${m.content.replace(/'/g, "''")}');`).join('\n');
                mime = 'application/sql';
            }
            else if (fmt === 'json') {
                content = JSON.stringify(data, null, 2);
                mime = 'application/json';
            } else if (fmt === 'csv') {
                content = "\uFEFFRole,Content\n" + msgs.map(m => `"${m.role}","${m.content.replace(/"/g, '""')}"`).join('\n');
                mime = 'text/csv';
            } else {
                content = msgs.map(m => `[${m.role}]\n${m.content}\n`).join('\n');
            }
        } catch (err) {
            throw new Error(`Failed to generate ${fmt.toUpperCase()} format: ${err.message}`);
        }
        return { content, mime };
    }

    // --- Robust ZIP (CRC32) ---
    const crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[i] = c;
    }
    function crc32(bytes) {
        let crc = -1;
        for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
        return (crc ^ (-1)) >>> 0;
    }

    async function createRobustZip(files) {
        try {
            const parts = [];
            const cd = [];
            let offset = 0;
            const encoder = new TextEncoder();

            for (const f of files) {
                let data = f.content;
                if (typeof data === 'string') data = encoder.encode(data);

                const name = encoder.encode(f.name);
                const crc = crc32(data);
                const size = data.length;

                // Local Header
                const lh = new Uint8Array(30 + name.length + size);
                const view = new DataView(lh.buffer);

                view.setUint32(0, 0x04034b50, true);
                view.setUint16(4, 10, true);
                view.setUint16(6, 0, true);
                view.setUint16(8, 0, true);
                view.setUint32(14, crc, true);
                view.setUint32(18, size, true);
                view.setUint32(22, size, true);
                view.setUint16(26, name.length, true);
                view.setUint16(28, 0, true);

                lh.set(name, 30);
                lh.set(data, 30 + name.length);
                parts.push(lh);

                // Central Dir
                const cdh = new Uint8Array(46 + name.length);
                const cdView = new DataView(cdh.buffer);
                cdView.setUint32(0, 0x02014b50, true);
                cdView.setUint16(4, 10, true);
                cdView.setUint16(6, 10, true);
                cdView.setUint16(10, 0, true);
                cdView.setUint32(16, crc, true);
                cdView.setUint32(20, size, true);
                cdView.setUint32(24, size, true);
                cdView.setUint16(28, name.length, true);
                cdView.setUint32(42, offset, true);

                cdh.set(name, 46);
                cd.push(cdh);

                offset += lh.length;
            }

            const cdTotalLen = cd.reduce((a, b) => a + b.length, 0);
            const eocd = new Uint8Array(22);
            const eView = new DataView(eocd.buffer);
            eView.setUint32(0, 0x06054b50, true);
            eView.setUint16(8, files.length, true);
            eView.setUint16(10, files.length, true);
            eView.setUint32(12, cdTotalLen, true);
            eView.setUint32(16, offset, true);

            return new Blob([...parts, ...cd, eocd], { type: 'application/zip' });
        } catch (err) {
            throw new Error("Critical ZIP Creation Failure. " + err.message);
        }
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // Modals helper
    const openModal = (m) => m.style.display = 'flex';
    const closeModal = (m) => m.style.display = 'none';

    document.getElementById('btn-open-settings').onclick = () => openModal(settingsModal);
    document.getElementById('btn-close-settings').onclick = document.getElementById('btn-save-settings').onclick = () => closeModal(settingsModal);

    document.getElementById('btn-open-about').onclick = () => openModal(aboutModal);
    document.getElementById('btn-close-about').onclick = document.getElementById('btn-ack-about').onclick = () => closeModal(aboutModal);

    document.getElementById('btn-close-error').onclick = () => closeModal(errorModal);

    // Info modal (Legal/Security)
    const infoModal = document.getElementById('info-modal');
    document.getElementById('link-legal').onclick = () => {
        document.getElementById('info-title').textContent = "Legal";
        document.getElementById('info-body').textContent = "This software acts as a local data processor. The user assumes the role of Data Controller. No data is transmitted to external servers.";
        openModal(infoModal);
    }
    document.getElementById('link-security').onclick = () => {
        document.getElementById('info-title').textContent = "Security";
        document.getElementById('info-body').textContent = "Verified strict Content Security Policy. No remote code execution. Local processing ensures privacy.";
        openModal(infoModal);
    }
    document.getElementById('btn-close-info').onclick = () => closeModal(infoModal);
    document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));

    document.getElementById('btn-preview').onclick = () => {
        if (!currentChatData) return;
        const previewText = currentChatData.messages.slice(0, 5).map(m => `[${m.role}]\n${m.content.substring(0, 150)}...`).join('\n\n');
        const preEl = document.getElementById('preview-content');
        preEl.textContent = "--- PREVIEW (First 5 Msgs) ---\n" + previewText;
        openModal(document.getElementById('preview-modal'));
    };
});