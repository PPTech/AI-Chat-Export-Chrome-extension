// content.js - Industrial Extraction Engine v3.1
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
    } catch (e) {
      console.error("Extraction failed:", e);
    }
    return result;
  }

  // --- Helpers ---
  async function urlToBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url; 
    }
  }

  async function processNodeContent(element, options, isUser) {
    if (!element) return "";
    if (options.rawHtml) return element.innerHTML;
    
    const clone = element.cloneNode(true);
    // Cleanup noise
    clone.querySelectorAll('button, .sr-only, [role="tooltip"], [class*="copy-btn"], .text-xs, svg').forEach(j => j.remove());

    // Format Code
    clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.innerText;
        pre.replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n`);
    });

    // Handle Images
    const imgs = clone.querySelectorAll('img');
    for (const img of imgs) {
        if (isUser) {
            img.remove(); 
        } else {
            const width = img.getAttribute('width') || img.clientWidth || img.naturalWidth;
            if (width > 50) {
                if (options.convertImages) {
                   const b64 = await urlToBase64(img.src);
                   img.replaceWith(`\n![Image](${b64})\n`);
                } else {
                   img.replaceWith(`\n![Image](${img.src})\n`);
                }
            } else {
                img.remove();
            }
        }
    }
    return clone.innerText.trim();
  }

  // --- Platform Parsers ---

  async function parseChatGPT(options) {
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    if (!turns.length) return { success: false, platform: "ChatGPT" };
    
    const messages = [];
    for (const node of turns) {
        const isAI = node.querySelector('[data-message-author-role="assistant"]');
        const contentNode = node.querySelector('.markdown') || node.querySelector('.whitespace-pre-wrap') || node;
        const content = await processNodeContent(contentNode, options, !isAI);
        messages.push({ role: isAI ? "Assistant" : "User", content });
    }
    return { success: true, platform: "ChatGPT", title: document.title, messages };
  }

  async function parseGemini(options) {
    // Extended selectors for Gemini 2026 updates
    const containers = document.querySelectorAll('user-query-item, model-response-item, .user-query-container, .model-response-container, .query-container, .response-container');
    
    // Fallback: Check for raw text chunks if structured items fail
    if (containers.length === 0) {
        const prose = document.querySelectorAll('.markdown');
        if (prose.length > 0) {
             const messages = [];
             for(const p of prose) {
                 messages.push({ role: "Gemini/User", content: await processNodeContent(p, options, false) });
             }
             return { success: true, platform: "Gemini (Fallback)", title: document.title, messages };
        }
        return { success: false, platform: "Gemini", messages: [] };
    }

    const messages = [];
    for (const el of containers) {
        const isUser = el.tagName.toLowerCase().includes('user') || el.className.includes('user') || el.className.includes('query');
        const content = await processNodeContent(el, options, isUser);
        if (content) messages.push({ role: isUser ? "User" : "Gemini", content });
    }
    return { success: !!messages.length, platform: "Gemini", title: document.title, messages };
  }

  async function parseClaude(options) {
    const chat = document.querySelector('.flex-1.overflow-y-auto') || document.body;
    const items = Array.from(chat.querySelectorAll('.grid, .group, [class*="chat-item"]')).filter(el => el.innerText.length > 5);
    const messages = [];
    for (const el of items) {
        const isAI = el.innerHTML.includes('claude-avatar');
        const content = await processNodeContent(el, options, !isAI);
        if (content) messages.push({ role: isAI ? "Claude" : "User", content });
    }
    return { success: !!messages.length, platform: "Claude", title: document.title, messages };
  }

  async function parseAIStudio(options) {
    const bubbles = document.querySelectorAll('ms-chat-bubble');
    const messages = [];
    for (const el of bubbles) {
        const isUser = el.getAttribute('is-user') === 'true';
        const content = await processNodeContent(el, options, isUser);
        messages.push({ role: isUser ? "User" : "Model", content });
    }
    return { success: !!messages.length, platform: "AI Studio", title: "AI Studio Export", messages };
  }

  function autoScrollChat(sendResponse) {
    const scroller = document.querySelector('[class*="react-scroll-to-bottom"] > div > div') || 
                     document.querySelector('.flex-1.overflow-y-auto') || 
                     document.querySelector('infinite-scroller') || 
                     document.body;

    let previousHeight = 0, attempts = 0;
    const interval = setInterval(() => {
        scroller.scrollTop = scroller.scrollHeight;
        if (Math.abs(scroller.scrollHeight - previousHeight) < 50) attempts++;
        else attempts = 0;
        previousHeight = scroller.scrollHeight;
        
        if (attempts >= 5) {
            clearInterval(interval);
            sendResponse({ status: "done" });
        }
    }, 1500);
  }
})();