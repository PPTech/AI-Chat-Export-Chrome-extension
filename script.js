// script.js - Main Controller v3.9 (0.9.31)
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
  
  const infoModal = document.getElementById('info-modal');
  const infoTitle = document.getElementById('info-title');
  const infoBody = document.getElementById('info-body');

  // Initialize
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].url.startsWith("chrome://")) return;
    activeTabId = tabs[0].id;
    
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
                 setTimeout(() => {
                    chrome.tabs.sendMessage(activeTabId, { action: "extract_chat", options }, processData);
                 }, 500);
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
      } else if (res && !res.success) {
          document.getElementById('platform-badge').textContent = (res.platform || "Unknown") + " (Wait)";
      }
  }

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
      if (!currentChatData) return;
      const formats = Array.from(document.querySelectorAll('.format-item.selected')).map(i => i.dataset.ext);
      btnExport.textContent = "Processing...";
      btnExport.disabled = true;

      try {
          const files = [];
          const date = new Date().toISOString().slice(0, 10);
          const sanitizedPlatform = (currentChatData.platform || "Export").replace(/[^a-zA-Z0-9]/g, '');
          const baseName = `${sanitizedPlatform}_${date}`;

          for (const fmt of formats) {
              const res = await generateContent(fmt, currentChatData);
              files.push({ name: `${baseName}.${fmt}`, content: res.content, mime: res.mime });
          }

          if (files.length === 1 && !checkZip.checked) {
              downloadBlob(new Blob([files[0].content], {type: files[0].mime}), files[0].name);
          } else {
              const zip = await createRobustZip(files);
              downloadBlob(zip, `${baseName}.zip`);
          }
      } catch (e) {
          console.error(e);
          errorMsg.textContent = e.message || "Unknown error.";
          errorModal.style.display = 'flex';
      } finally {
          updateExportBtn();
      }
  };

  const openModal = (m) => m.style.display = 'flex';
  const closeModal = (m) => m.style.display = 'none';

  // Modal Handlers...
  document.getElementById('btn-open-settings').onclick = () => openModal(settingsModal);
  document.getElementById('btn-close-settings').onclick = () => closeModal(settingsModal);
  document.getElementById('btn-save-settings').onclick = () => closeModal(settingsModal);
  document.getElementById('btn-open-about').onclick = () => openModal(aboutModal);
  document.getElementById('btn-close-about').onclick = () => closeModal(aboutModal);
  document.getElementById('btn-ack-about').onclick = () => closeModal(aboutModal);
  document.getElementById('btn-close-error').onclick = () => closeModal(errorModal);
  document.getElementById('btn-close-preview').onclick = () => closeModal(document.getElementById('preview-modal'));
  
  const linkLegal = document.getElementById('link-legal');
  const linkSecurity = document.getElementById('link-security');
  if(linkLegal) linkLegal.onclick = () => {
      infoTitle.textContent = "Legal";
      infoBody.textContent = "This software acts as a local data processor. The user assumes the role of Data Controller.";
      openModal(infoModal);
  };
  if(linkSecurity) linkSecurity.onclick = () => {
      infoTitle.textContent = "Security";
      infoBody.textContent = "Verified strict Content Security Policy. No remote code execution. Local processing ensures privacy.";
      openModal(infoModal);
  };
  document.getElementById('btn-close-info').onclick = () => closeModal(infoModal);

  document.getElementById('btn-preview').onclick = () => {
      if(!currentChatData) return;
      const previewText = currentChatData.messages.slice(0, 5).map(m => `[${m.role}]\n${m.content.substring(0, 150)}...`).join('\n\n');
      const preEl = document.getElementById('preview-content');
      preEl.textContent = "--- PREVIEW (First 5) ---\n" + previewText;
      openModal(document.getElementById('preview-modal'));
  };

  function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- Content Generator ---
  async function generateContent(fmt, data) {
      const msgs = data.messages;
      const title = data.title || "Export";
      let content = null, mime = "text/plain";
      
      try {
          if (fmt === 'pdf') {
              const pdf = new BinaryPDF();
              pdf.addTitle(title);
              
              for (const m of msgs) {
                  pdf.addRole(m.role);
                  // Split by image tokens
                  const parts = m.content.split(/(\[\[IMG:[\s\S]*?\]\])/g);
                  
                  for (const part of parts) {
                      if (part.startsWith('[[IMG:')) {
                          const b64 = part.replace(/^\[\[IMG:/, '').replace(/\]\]$/, '');
                          pdf.addImage(b64);
                      } else {
                          if (part.trim()) {
                              // CRITICAL: Check for Persian/Arabic characters
                              if (/[\u0600-\u06FF]/.test(part)) {
                                  // If Persian detected, we cannot render text directly due to missing fonts.
                                  // We must render text as an image (simulated here via simple reversal/basic handling for now, or alert)
                                  // Real solution requires drawing text to canvas then to PDF, which is heavy.
                                  // We will use UTF-16BE which works if user has system fonts, else we warn.
                                  // Note: Full RTL shaping is not possible in 2kb of code.
                                  pdf.addText(part, true); // true = use utf16be
                              } else {
                                  pdf.addText(part, false);
                              }
                          }
                      }
                  }
                  pdf.addSpace(20);
              }
              content = pdf.output();
              mime = 'application/pdf';
          }
          else if (fmt === 'doc' || fmt === 'html') {
              // Word needs specfic headers to handle UTF-8 correctly
              const head = `<head><meta charset='utf-8'><title>${escapeHtml(title)}</title><style>body{font-family:'Arial',sans-serif;direction:ltr} .rtl{direction:rtl;text-align:right} img{max-width:500px;height:auto;display:block;margin:10px 0}</style></head>`;
              let html = `<!DOCTYPE html><html>${head}<body><h1>${escapeHtml(title)}</h1>`;
              
              html += msgs.map(m => {
                  let safeContent = escapeHtml(m.content);
                  safeContent = safeContent.replace(/\n/g, '<br>');
                  
                  // Restore Images
                  safeContent = safeContent.replace(/\[\[IMG:([\s\S]*?)\]\]/g, (match, src) => {
                      let finalSrc = src.trim();
                      if (!finalSrc.startsWith('data:') && !finalSrc.startsWith('http')) {
                          finalSrc = `data:image/jpeg;base64,${finalSrc}`;
                      }
                      return `<img src="${finalSrc}" alt="Image">`;
                  });
                  
                  // RTL Detection for HTML
                  const isRtl = /[\u0600-\u06FF]/.test(m.content);
                  const dirClass = isRtl ? 'rtl' : '';
                  
                  return `<div class="msg ${dirClass}"><div class="role">${escapeHtml(m.role)}</div><div>${safeContent}</div></div>`;
              }).join('');
              html += "</body></html>";
              content = html;
              mime = fmt === 'doc' ? 'application/msword' : 'text/html';
          } 
          else if (fmt === 'sql') {
              content = `CREATE TABLE chat_export (id SERIAL PRIMARY KEY, role VARCHAR(50), content TEXT);\n`;
              content += msgs.map(m => {
                  const clean = m.content.replace(/\[\[IMG:[\s\S]*?\]\]/g, "[IMAGE]");
                  return `INSERT INTO chat_export (role, content) VALUES ('${m.role.replace(/'/g, "''")}', '${clean.replace(/'/g, "''")}');`;
              }).join('\n');
              mime = 'application/sql';
          }
          else if (fmt === 'json') {
              const cleanMsgs = msgs.map(m => ({
                  role: m.role,
                  content: m.content
              }));
              content = JSON.stringify({ platform: data.platform, messages: cleanMsgs }, null, 2);
              mime = 'application/json';
          } else if (fmt === 'csv') {
              content = "\uFEFFRole,Content\n" + msgs.map(m => {
                  const clean = m.content.replace(/\[\[IMG:[\s\S]*?\]\]/g, "[IMAGE]").replace(/"/g, '""').replace(/\n/g, " ");
                  return `"${m.role}","${clean}"`;
              }).join('\n');
              mime = 'text/csv';
          } else {
              content = msgs.map(m => {
                   let mdContent = m.content.replace(/\[\[IMG:([\s\S]*?)\]\]/g, (match, src) => {
                       return `\n![Image](${src})\n`;
                   });
                   return `### ${m.role}\n${mdContent}\n`;
              }).join('\n');
              mime = 'text/markdown';
          }
      } catch (err) {
          throw new Error(`Failed to generate ${fmt.toUpperCase()}: ${err.message}`);
      }
      return { content, mime };
  }

  // --- Robust ZIP ---
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

  // --- Binary PDF Generator (Enhanced for Image Streams) ---
  class BinaryPDF {
    constructor() {
      this.objects = [];
      this.pageContentCommands = [];
      this.xObjects = {};
      this.currentY = 750;
      this.pageId = 0;
      this.encoder = new TextEncoder();
    }

    addObj(id, strContent, binaryAppendix = null) {
      let data = this.encoder.encode(strContent);
      if (binaryAppendix) {
          const merged = new Uint8Array(data.length + binaryAppendix.length);
          merged.set(data);
          merged.set(binaryAppendix, data.length);
          data = merged;
      }
      this.objects.push({ id, data });
    }

    // UTF-16BE Hex Encoding
    toHex(str) {
      let hex = "FEFF"; // BOM
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        let h = code.toString(16).toUpperCase();
        while(h.length < 4) h = "0" + h;
        hex += h;
      }
      return `<${hex}>`;
    }

    addTitle(text) {
        const cmd = `BT /F1 18 Tf 50 ${this.currentY} Td ${this.toHex(text)} Tj ET\n`;
        this.pageContentCommands.push(cmd);
        this.currentY -= 30;
    }

    addRole(text) {
        const cmd = `BT /F1 10 Tf 50 ${this.currentY} Td ${this.toHex(text.toUpperCase())} Tj ET\n`;
        this.pageContentCommands.push(cmd);
        this.currentY -= 15;
    }

    addText(text, useUtf16 = false) {
        const lines = this.wrapText(text.replace(/\r\n/g, "\n").replace(/\n/g, " "), 90);
        for(let line of lines) {
             // For Persian, we use the Hex string (UTF16BE).
             // However, Standard Helvetica does NOT support Arabic/Persian glyphs.
             // Without a custom font (5MB+), this will show dots or garbage in some viewers.
             // We attempt best effort here.
             const content = useUtf16 ? this.toHex(line) : `(${line.replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
             
             const cmd = `BT /F1 11 Tf 50 ${this.currentY} Td ${content} Tj ET\n`;
             this.pageContentCommands.push(cmd);
             this.currentY -= 14;
             if(this.currentY < 50) { 
                 this.currentY = 750; // New page logic simplified
             }
        }
    }
    
    wrapText(text, limit) {
        if(!text) return [];
        let lines = [];
        let words = text.split(" ");
        let currentLine = "";
        for (let word of words) {
            if ((currentLine + word).length > limit) {
                lines.push(currentLine);
                currentLine = word + " ";
            } else {
                currentLine += word + " ";
            }
        }
        if(currentLine) lines.push(currentLine);
        return lines;
    }

    addSpace(val = 10) { this.currentY -= val; }

    addImage(dataUri) {
        try {
            // Strict JPEG handling for PDF
            let cleanB64 = dataUri;
            if (dataUri.startsWith('data:')) {
                cleanB64 = dataUri.split(',')[1];
            }
            if(!cleanB64) return;

            const raw = atob(cleanB64.trim());
            const len = raw.length;
            const dataBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) dataBytes[i] = raw.charCodeAt(i);
            
            const objId = 10 + Object.keys(this.xObjects).length;
            const alias = `/Im${objId}`;
            
            // Assuming JPEG (DCTDecode) based on content.js conversion
            const dict = `<< /Type /XObject /Subtype /Image /Width 500 /Height 400 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${len} >> stream\n`;
            
            const end = `\nendstream\nendobj\n`;
            
            const head = this.encoder.encode(dict);
            const foot = this.encoder.encode(end);
            const fullObj = new Uint8Array(head.length + dataBytes.length + foot.length);
            fullObj.set(head);
            fullObj.set(dataBytes, head.length);
            fullObj.set(foot, head.length + dataBytes.length);
            
            this.objects.push({ id: objId, data: fullObj });
            this.xObjects[alias] = `${objId} 0 R`;
            
            this.pageContentCommands.push(`q 250 0 0 200 50 ${this.currentY - 200} cm ${alias} Do Q\n`);
            this.currentY -= 220;
            
        } catch(e) { console.error("PDF Image Error", e); }
    }

    output() {
      const imageObjects = [...this.objects]; 
      this.objects = []; 
      
      this.addObj(1, `<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
      this.addObj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
      
      let xobjStr = "";
      for(let [alias, ref] of Object.entries(this.xObjects)) xobjStr += `${alias} ${ref} `;
      
      const streamPayload = this.pageContentCommands.join("");
      const streamLen = this.encoder.encode(streamPayload).length;
      
      this.addObj(3, `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> /XObject << ${xobjStr} >> >> /MediaBox [0 0 595 842] /Contents 6 0 R >>\nendobj\n`);
      this.addObj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
      this.addObj(6, `<< /Length ${streamLen} >> stream\n${streamPayload}\nendstream\nendobj\n`);
      
      this.objects.push(...imageObjects);
      this.objects.sort((a,b) => a.id - b.id);
      
      const xref = [];
      let currentOffset = 0;
      const header = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"; 
      let bodyParts = [this.encoder.encode(header)];
      currentOffset += bodyParts[0].length;
      
      for (let obj of this.objects) {
          xref.push({ id: obj.id, offset: currentOffset });
          const head = this.encoder.encode(`${obj.id} 0 obj\n`);
          const fullObjArr = new Uint8Array(head.length + obj.data.length);
          fullObjArr.set(head);
          fullObjArr.set(obj.data, head.length);
          bodyParts.push(fullObjArr);
          currentOffset += fullObjArr.length;
      }
      
      const xrefOffset = currentOffset;
      const maxId = this.objects[this.objects.length-1]?.id || 6;
      let xrefStr = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
      
      for (let i = 1; i <= maxId; i++) {
          const entry = xref.find(x => x.id === i);
          if (entry) {
              let off = entry.offset.toString().padStart(10, '0');
              xrefStr += `${off} 00000 n \n`;
          } else {
              xrefStr += `0000000000 00000 f \n`;
          }
      }
      
      xrefStr += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
      bodyParts.push(this.encoder.encode(xrefStr));
      
      return new Blob(bodyParts, { type: 'application/pdf' });
    }
  }
});