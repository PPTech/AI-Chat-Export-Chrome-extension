document.addEventListener('DOMContentLoaded', () => {
  let currentChatData = null;
  let activeTabId = null;

  // UI Refs
  const btnExport = document.getElementById('btn-export-main');
  const checkImages = document.getElementById('check-images');
  const checkZip = document.getElementById('check-zip');
  const btnLogs = document.getElementById('btn-download-logs');
  
  // Initialize
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith("chrome://")) return;
    activeTabId = tabs[0].id;
    
    // Check background for existing data (Tab Isolation)
    chrome.runtime.sendMessage({ action: "GET_DATA", tabId: activeTabId }, (res) => {
        if (res && res.data) {
            processData(res.data);
        } else {
            // Start fresh extraction
            requestExtraction();
        }
    });
  });

  // Request Extraction (with Base64 Image option)
  function requestExtraction() {
     const options = { 
         convertImages: checkImages.checked, // Important for Word
         rawHtml: false 
     };
     chrome.tabs.sendMessage(activeTabId, { action: "extract_chat", options }, (res) => {
        if (chrome.runtime.lastError) {
             // Inject if needed
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
          // Update background state
          chrome.runtime.sendMessage({ action: "SET_DATA", tabId: activeTabId, data: res });
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
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'ai_exporter_logs.json'; a.click();
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
          const baseName = `${(currentChatData.platform || "Export").replace(/\s/g, '')}_${date}`;

          for (const fmt of formats) {
              const res = generateContent(fmt, currentChatData);
              files.push({ name: `${baseName}.${fmt}`, content: res.content, mime: res.mime });
          }

          if (files.length === 1 && !checkZip.checked) {
              downloadBlob(new Blob([files[0].content], {type: files[0].mime}), files[0].name);
          } else {
              const zip = await createRobustZip(files);
              downloadBlob(zip, `${baseName}.zip`);
          }
      } catch (e) {
          alert("Export Error: " + e.message);
      } finally {
          updateExportBtn();
      }
  };

  function generateContent(fmt, data) {
      const msgs = data.messages;
      let content = "", mime = "text/plain";
      
      if (fmt === 'doc' || fmt === 'html') {
          // Embed Base64 images directly
          const style = "body{font-family:Arial;max-width:800px;margin:auto;padding:20px} img{max-width:100%;height:auto}";
          content = `<html><head><meta charset='utf-8'><style>${style}</style></head><body><h1>${data.title}</h1>`;
          content += msgs.map(m => `<div><h3>${m.role}</h3><div>${m.content.replace(/\n/g, '<br>')}</div></div>`).join('');
          content += "</body></html>";
          mime = fmt === 'doc' ? 'application/msword' : 'text/html';
      } else if (fmt === 'json') {
          content = JSON.stringify(data, null, 2);
          mime = 'application/json';
      } else if (fmt === 'csv') {
          content = "\uFEFFRole,Content\n" + msgs.map(m => `"${m.role}","${m.content.replace(/"/g, '""')}"`).join('\n');
          mime = 'text/csv';
      } else {
          content = msgs.map(m => `[${m.role}]\n${m.content}\n`).join('\n');
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
          
          view.setUint32(0, 0x04034b50, true); // Sig
          view.setUint16(4, 10, true); // Ver
          view.setUint16(6, 0, true); // Flags
          view.setUint16(8, 0, true); // Method (Store)
          view.setUint32(14, crc, true); // CRC
          view.setUint32(18, size, true); // Comp Size
          view.setUint32(22, size, true); // Uncomp Size
          view.setUint16(26, name.length, true); // Name Len
          view.setUint16(28, 0, true); // Extra
          
          lh.set(name, 30);
          lh.set(data, 30 + name.length);
          parts.push(lh);

          // Central Dir
          const cdh = new Uint8Array(46 + name.length);
          const cdView = new DataView(cdh.buffer);
          cdView.setUint32(0, 0x02014b50, true);
          cdView.setUint16(4, 10, true);
          cdView.setUint16(6, 10, true);
          cdView.setUint16(10, 0, true); // Method
          cdView.setUint32(16, crc, true);
          cdView.setUint32(20, size, true);
          cdView.setUint32(24, size, true);
          cdView.setUint16(28, name.length, true);
          cdView.setUint32(42, offset, true);
          
          cdh.set(name, 46);
          cd.push(cdh);
          
          offset += lh.length;
      }

      // End of Central Dir
      const cdTotalLen = cd.reduce((a, b) => a + b.length, 0);
      const eocd = new Uint8Array(22);
      const eView = new DataView(eocd.buffer);
      eView.setUint32(0, 0x06054b50, true);
      eView.setUint16(8, files.length, true);
      eView.setUint16(10, files.length, true);
      eView.setUint32(12, cdTotalLen, true);
      eView.setUint32(16, offset, true);

      return new Blob([...parts, ...cd, eocd], { type: 'application/zip' });
  }

  function downloadBlob(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
  }

  // Modals helper
  document.getElementById('btn-close-settings').onclick = () => document.getElementById('settings-modal').style.display = 'none';
  document.getElementById('btn-open-settings').onclick = () => document.getElementById('settings-modal').style.display = 'flex';
});