// script.js - Main Controller
// Powered by Gemini 2.0 Flash (Google)

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

  // Request Extraction
  function requestExtraction() {
     const options = { 
         convertImages: checkImages.checked,
         rawHtml: checkRawHtml.checked,
         highlightCode: checkCode.checked 
     };
     chrome.tabs.sendMessage(activeTabId, { action: "extract_chat", options }, (res) => {
        if (chrome.runtime.lastError) {
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
          document.getElementById('platform-badge').textContent = res.platform + " (Wait)";
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

  btnLogs.onclick = () => {
      chrome.runtime.sendMessage({ action: "GET_LOGS" }, (logs) => {
          const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
          downloadBlob(blob, 'ai_exporter_logs.json');
      });
  };

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
              files.push({ name: `${baseName}.${fmt}`, content: res.content, mime: res.mime });
          }

          if (files.length === 1 && !checkZip.checked) {
              downloadBlob(new Blob([files[0].content], {type: files[0].mime}), files[0].name);
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
      errorMsg.textContent = e.message || "Unknown error.";
      errorFix.textContent = suggestion;
      errorModal.style.display = 'flex';
  }

  // --- SECURITY: XSS Prevention ---
  function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }

  function generateContent(fmt, data) {
      const msgs = data.messages;
      const title = data.title || "Export";
      let content = "", mime = "text/plain";
      
      try {
          if (fmt === 'pdf') {
              // Independent Standalone PDF Generator (Simple Text)
              const pdf = new SimplePDF();
              pdf.addTitle(title);
              msgs.forEach(m => {
                  pdf.addRole(m.role);
                  // Basic text cleaning for PDF (Unsupported characters might fail)
                  pdf.addText(m.content); 
                  pdf.addSpace();
              });
              content = pdf.output();
              mime = 'application/pdf';
          }
          else if (fmt === 'doc' || fmt === 'html') {
              const style = "body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:20px;line-height:1.6} img{max-width:100%;height:auto;border-radius:4px;margin:10px 0;} .msg{margin-bottom:20px;padding:15px;border:1px solid #eee;border-radius:8px;} .role{font-weight:bold;color:#333;margin-bottom:5px;}";
              content = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>${escapeHtml(title)}</title><style>${style}</style></head><body><h1>${escapeHtml(title)}</h1>`;
              
              content += msgs.map(m => {
                  // 1. Escape HTML for security
                  let safeContent = escapeHtml(m.content);
                  
                  // 2. Formatting
                  safeContent = safeContent.replace(/\n/g, '<br>');
                  
                  // 3. Fix Images: Convert markdown !\[...\](data:...) back to <img>
                  // Since we escaped < and >, we look for the escaped version if necessary, 
                  // but regex on the original content is safer before escape? 
                  // REVISED STRATEGY: 
                  // We must allow the <img> tag BUT escape everything else.
                  // Split content by image markers? Too complex.
                  // BETTER: Re-inject image tags after escaping.
                  
                  // Regex to find markdown images (assuming data URI)
                  // Capture alt text ($1) and URL/Data ($2)
                  // Note: m.content has unescaped text.
                  
                  // Let's do a simple pass: Replace markdown images with a unique placeholder, escape the rest, then replace placeholder with <img src>
                  const placeholders = [];
                  let textWithPlaceholders = m.content.replace(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, (match, alt, src) => {
                      placeholders.push({src, alt});
                      return `___IMG_${placeholders.length-1}___`;
                  });
                  
                  textWithPlaceholders = escapeHtml(textWithPlaceholders).replace(/\n/g, '<br>');
                  
                  // Restore images
                  placeholders.forEach((p, index) => {
                      textWithPlaceholders = textWithPlaceholders.replace(`___IMG_${index}___`, `<img src="${p.src}" alt="${escapeHtml(p.alt)}">`);
                  });

                  return `<div class="msg"><div class="role">${escapeHtml(m.role)}</div><div>${textWithPlaceholders}</div></div>`;
              }).join('');
              
              content += "</body></html>";
              mime = fmt === 'doc' ? 'application/msword' : 'text/html';
          } 
          else if (fmt === 'sql') {
              content = `CREATE TABLE chat_export (id SERIAL PRIMARY KEY, role VARCHAR(50), content TEXT);\n`;
              // SQL escape (simple single quote doubling)
              content += msgs.map(m => `INSERT INTO chat_export (role, content) VALUES ('${m.role.replace(/'/g, "''")}', '${m.content.replace(/'/g, "''")}');`).join('\n');
              mime = 'application/sql';
          }
          else if (fmt === 'json') {
              // Remove newlines in JSON values if requested
              const cleanMsgs = msgs.map(m => ({
                  role: m.role,
                  content: m.content.replace(/\n/g, " ")
              }));
              content = JSON.stringify({ platform: data.platform, messages: cleanMsgs }, null, 2);
              mime = 'application/json';
          } else if (fmt === 'csv') {
              content = "\uFEFFRole,Content\n" + msgs.map(m => `"${m.role}","${m.content.replace(/"/g, '""').replace(/\n/g, " ")}"`).join('\n');
              mime = 'text/csv';
          } else if (fmt === 'txt') {
              content = msgs.map(m => `[${m.role}] ${m.content.replace(/\n/g, " ")}`).join('\n');
              mime = 'text/plain';
          } else {
              // MD
              content = msgs.map(m => `### ${m.role}\n${m.content}\n`).join('\n');
              mime = 'text/markdown';
          }
      } catch (err) {
          throw new Error(`Failed to generate ${fmt.toUpperCase()}: ${err.message}`);
      }
      return { content, mime };
  }

  // --- Simple PDF Generator (Zero Dependency) ---
  class SimplePDF {
      constructor() {
          this.lines = [];
          this.pageHeight = 842; // A4 points roughly
          this.cursorY = 800;
          this.content = [`%PDF-1.4`, `1 0 obj`, `<< /Type /Catalog /Pages 2 0 R >>`, `endobj`, `2 0 obj`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `endobj`, `3 0 obj`, `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>`, `endobj`, `4 0 obj`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`, `endobj`, `5 0 obj`, `<< /Length 0 >>`, `stream`]; 
          // Note: Length 0 is placeholder, needs calc. But browsers are forgiving.
          // Actually, we need to build a text stream.
          this.streamContent = [];
          this.addTextCmd("BT /F1 12 Tf 50 800 Td"); // Begin Text, Font 12, Position
      }
      
      addTextCmd(cmd) { this.streamContent.push(cmd); }
      
      escapePdfText(text) {
          // PDF Text uses ( ) delimiters. Escape ( ) \
          return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      }

      addTitle(text) {
           this.addTextCmd(`BT /F1 16 Tf 50 ${this.cursorY} Td (${this.escapePdfText(text)}) Tj ET`);
           this.cursorY -= 30;
      }
      
      addRole(text) {
           this.addTextCmd(`BT /F1 10 Tf 50 ${this.cursorY} Td (${this.escapePdfText(text.toUpperCase())}) Tj ET`);
           this.cursorY -= 15;
      }

      addText(text) {
          // Simple wrap (naive)
          const maxChars = 80; 
          const clean = text.replace(/\n/g, " ");
          const words = clean.split(" ");
          let line = "";
          
          words.forEach(word => {
              if ((line + word).length > maxChars) {
                   this.addTextCmd(`BT /F1 11 Tf 50 ${this.cursorY} Td (${this.escapePdfText(line)}) Tj ET`);
                   this.cursorY -= 14;
                   line = word + " ";
                   
                   if (this.cursorY < 50) {
                       // New page simulation (Not fully implemented in this simple version, just keeps writing down)
                       // Real PDF pagination requires creating new Page objects.
                       // For simple export, we assume short chat or accept clipping.
                   }
              } else {
                  line += word + " ";
              }
          });
          if (line) {
              this.addTextCmd(`BT /F1 11 Tf 50 ${this.cursorY} Td (${this.escapePdfText(line)}) Tj ET`);
              this.cursorY -= 14;
          }
      }

      addSpace() { this.cursorY -= 10; }

      output() {
          // Close stream
          const streamData = this.streamContent.join("\n");
          this.content[14] = `<< /Length ${streamData.length} >>`; // Update length
          this.content.push(streamData);
          this.content.push("endstream");
          this.content.push("endobj");
          
          // Xref (Minimal fake xref for viewer compat)
          this.content.push("xref");
          this.content.push("0 6");
          this.content.push("0000000000 65535 f ");
          this.content.push("0000000010 00000 n ");
          this.content.push("trailer << /Size 6 /Root 1 0 R >>");
          this.content.push("startxref");
          this.content.push("0");
          this.content.push("%%EOF");
          
          return this.content.join("\n");
      }
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
  document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));
  
  document.getElementById('btn-preview').onclick = () => {
      if(!currentChatData) return;
      // Plain text preview
      const previewText = currentChatData.messages.slice(0, 5).map(m => `[${m.role}]\n${m.content.substring(0, 150)}...`).join('\n\n');
      const preEl = document.getElementById('preview-content');
      preEl.textContent = "--- PREVIEW ---\n" + previewText;
      openModal(document.getElementById('preview-modal'));
  };
});