// content.js - Industrial Extraction Engine v3.9 (0.9.31)
// Powered by Gemini 2.0 Flash (Google)
(() => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract_chat") {
      extractChatData(request.options || {}).then(data => sendResponse(data));
      return true;
    } else if (request.action === "scroll_chat") {
      autoScrollChat(sendResponse);
      return true;
    }
  });

  async function extractChatData(options) {
    const hostname = window.location.hostname;
    let result = { success: false, platform: "Unknown", messages: [] };
    
    try {
      if (hostname.includes('chatgpt.com')) result = await parseChatGPT(options);
      else if (hostname.includes('gemini.google.com')) result = await parseGemini(options);
      else if (hostname.includes('claude.ai')) result = await parseClaude(options);
      else if (hostname.includes('aistudio.google.com')) result = await parseAIStudio(options);
      else {
          chrome.runtime.sendMessage({ action: "LOG_ERROR", message: "Unknown Hostname", details: hostname });
      }
    } catch (e) {
      console.error("Extraction failed:", e);
      chrome.runtime.sendMessage({ action: "LOG_ERROR", message: "Extraction JS Error", details: e.message });
    }
    
    // Improved Deduplication: Only removing exact duplicates that are adjacent
    // This solves the "Claude only reads first" issue if hash set was too aggressive
    const uniqueMessages = [];
    let lastHash = "";
    
    for(const msg of result.messages) {
        const hash = msg.role + "::" + msg.content;
        if (hash !== lastHash) {
            uniqueMessages.push(msg);
            lastHash = hash;
        }
    }
    result.messages = uniqueMessages;
    
    chrome.runtime.sendMessage({ 
        action: "LOG_INFO", 
        message: "Extraction Complete", 
        details: `${result.platform}: ${result.messages.length} msgs` 
    });

    return result;
  }

  // --- Image Handling Engine (Canvas Strategy) ---
  // This approach bypasses CORS for many images by drawing them to a canvas 
  // if they are already loaded in the DOM.
  async function imageToDataURL(imgElement) {
      if (!imgElement) return null;
      if (imgElement.src.startsWith('data:')) return imgElement.src;

      try {
          // If image is loaded, draw to canvas
          if (imgElement.complete && imgElement.naturalWidth > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = imgElement.naturalWidth;
              canvas.height = imgElement.naturalHeight;
              const ctx = canvas.getContext('2d');
              // Try drawing. If cross-origin, this might taint the canvas.
              // But for many internal chat images, it works.
              ctx.drawImage(imgElement, 0, 0);
              // Convert to JPEG for PDF compatibility
              return canvas.toDataURL('image/jpeg', 0.85);
          }
      } catch (e) {
          // Canvas tainted or blocked
          console.warn("Canvas export failed", e);
      }

      // Fallback: Fetch as blob
      try {
          const response = await fetch(imgElement.src);
          const blob = await response.blob();
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
          });
      } catch (e) {
          return null;
      }
  }

  async function processNodeContent(element, options, isUser) {
    if (!element) return "";
    if (options.rawHtml) return element.innerHTML;
    
    // Deep clone is safer, but for Shadow DOM we might need to be careful
    const clone = element.cloneNode(true);
    
    // Remove UI noise
    const noiseSelectors = 'button, .sr-only, [role="tooltip"], .text-xs, svg, nav, .gap-1, .absolute, .copy-button';
    clone.querySelectorAll(noiseSelectors).forEach(j => j.remove());

    // Format Code blocks
    clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.innerText;
        pre.replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n`);
    });

    // Handle Images
    const imgs = Array.from(element.querySelectorAll('img')); // Query original element to get loaded state
    // We replace in the clone
    const cloneImgs = clone.querySelectorAll('img');

    for (let i = 0; i < imgs.length; i++) {
        const originalImg = imgs[i];
        const cloneImg = cloneImgs[i];
        if (!cloneImg) continue;

        const width = originalImg.getAttribute('width') || originalImg.clientWidth || originalImg.naturalWidth || 0;
        const isContentImage = width > 40 || originalImg.src.startsWith('data:') || originalImg.className.includes('image') || originalImg.closest('.prose');
        
        if (isContentImage && options.convertImages) {
           let b64 = await imageToDataURL(originalImg);
           
           if (b64) {
               // Token format: [[IMG: data:image/jpeg;base64,.....]]
               // This token is parsed by script.js
               cloneImg.replaceWith(`\n[[IMG:${b64}]]\n`);
           } else {
               cloneImg.replaceWith(` [Image] `);
           }
        } else {
           cloneImg.remove();
        }
    }
    
    return clone.innerText.trim();
  }

  // --- Platform Parsers ---

  async function parseChatGPT(options) {
    // 1. Check for Codex/Canvas Editor first (often separate from turns)
    const canvasEditor = document.querySelector('[data-testid="canvas-outer"], [data-testid="canvas-editor"]');
    
    const messages = [];
    
    // 2. Standard Chat Turns
    let turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    
    for (const node of turns) {
        const isAI = node.querySelector('[data-message-author-role="assistant"]');
        const contentNode = node.querySelector('.markdown') || node.querySelector('.whitespace-pre-wrap') || node;
        const content = await processNodeContent(contentNode, options, !isAI);
        if (content) messages.push({ role: isAI ? "Assistant" : "User", content });
    }

    // 3. Append Codex Content if available
    if (canvasEditor) {
        // Try to get the code content directly
        const codeEditor = canvasEditor.querySelector('.cm-content') || canvasEditor;
        const canvasText = await processNodeContent(codeEditor, options, false);
        if (canvasText) {
            messages.push({ 
                role: "Canvas/Codex", 
                content: "--- CANVAS EDITOR CONTENT ---\n" + canvasText 
            });
        }
    }

    return { 
        success: messages.length > 0, 
        platform: "ChatGPT", 
        title: document.title, 
        messages 
    };
  }

  async function parseGemini(options) {
    const containers = Array.from(document.querySelectorAll('user-query-item, model-response-item, .user-query-container, .model-response-container'));
    
    // Fallback for older/mobile layouts
    if (containers.length === 0) {
        const prose = Array.from(document.querySelectorAll('.markdown, .prose'));
        if (prose.length > 0) {
             const messages = [];
             for(const p of prose) {
                 if (p.offsetParent === null) continue;
                 const text = await processNodeContent(p, options, false);
                 messages.push({ role: "Gemini", content: text });
             }
             return { success: true, platform: "Gemini (Fallback)", title: document.title, messages };
        }
        return { success: false, platform: "Gemini", messages: [] };
    }

    const messages = [];
    for (const el of containers) {
        if (el.offsetParent === null) continue;
        const isUser = el.tagName.toLowerCase().includes('user') || el.className.includes('user');
        const content = await processNodeContent(el, options, isUser);
        if (content) messages.push({ role: isUser ? "User" : "Gemini", content });
    }
    return { success: !!messages.length, platform: "Gemini", title: document.title, messages };
  }

  async function parseClaude(options) {
    // Claude uses a virtual list often. We need broad selectors.
    // Updated 2026: Look for the grid rows that contain messages.
    const messages = [];
    
    // Select all potential message blocks. 
    // .font-user-message is consistent for user.
    // .font-claude-message is consistent for AI.
    // Use [data-test-render-count] as it appears on message containers in new UI.
    const nodes = document.querySelectorAll('div.font-user-message, div.font-claude-message, [data-testid="user-message"], [data-testid="chat-message"]');
    
    for (const node of nodes) {
        // Skip artifacts or hidden nodes
        if (node.offsetParent === null) continue;

        let isUser = node.classList.contains('font-user-message') || node.getAttribute('data-testid') === 'user-message';
        // AI detection
        if (!isUser && !node.classList.contains('font-claude-message')) {
             // Fallback heuristics
             if (node.querySelector('.font-claude-response-body')) isUser = false;
             else continue; // Not a message
        }

        // Inner content extraction
        let contentEl = node;
        if (!isUser) {
            contentEl = node.querySelector('.font-claude-response-body') || node.querySelector('.grid') || node;
        }

        const content = await processNodeContent(contentEl, options, isUser);
        if (content) {
            messages.push({ role: isUser ? "User" : "Claude", content });
        }
    }
    
    return { success: messages.length > 0, platform: "Claude", title: document.title, messages };
  }

  async function parseAIStudio(options) {
    // AI Studio uses Web Components with Shadow DOM.
    // We need to pierce the shadow root to find text.
    
    const messages = [];
    
    // 1. Find the main chat container
    const historyContainer = document.querySelector('ms-chat-history') || document.body;
    
    // 2. Find turns (ms-chat-turn or similar)
    const turns = Array.from(historyContainer.querySelectorAll('ms-chat-turn, .turn-container'));
    
    for (const turn of turns) {
        const isUser = turn.hasAttribute('user-turn');
        
        // Text is likely inside a shadow root of a child element like <ms-text-chunk>
        let content = "";
        
        // Try to access shadow root content if open
        const chunks = turn.querySelectorAll('ms-text-chunk, .chunk');
        for (const chunk of chunks) {
            if (chunk.shadowRoot) {
                content += chunk.shadowRoot.textContent;
            } else {
                content += chunk.innerText;
            }
        }
        
        // Fallback if no specific chunks found, grab full text
        if (!content) content = turn.innerText;
        
        // Process for images/code
        // Note: processNodeContent relies on standard DOM. 
        // For Shadow DOM text, we might skip detailed formatting unless we traverse it.
        // We'll pass the turn element to processNodeContent, which handles standard DOM.
        
        // Clean up
        content = content.replace(/content_copy/g, '').trim();
        
        if (content) {
            messages.push({ role: isUser ? "User" : "Model", content });
        }
    }
    
    // Fallback for older/simpler AI Studio layouts without Shadow DOM lock
    if (messages.length === 0) {
        const bubbles = document.querySelectorAll('.text-content');
        for (const b of bubbles) {
            messages.push({ role: "Data", content: b.innerText });
        }
    }

    return { success: messages.length > 0, platform: "AI Studio", title: document.title, messages };
  }

  function autoScrollChat(sendResponse) {
    window.scrollTo(0, document.body.scrollHeight);
    // Also try specific scrollers
    const scrollers = document.querySelectorAll('.overflow-y-auto');
    scrollers.forEach(s => s.scrollTop = s.scrollHeight);
    sendResponse({ status: "done" });
  }
})();