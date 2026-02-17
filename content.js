// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// content.js - Industrial Extraction Engine v0.9.31

(() => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract_chat') {
      extractChatData(request.options || {}).then(sendResponse);
      return true;
    }
    if (request.action === 'scroll_chat') {
      loadFullHistory(sendResponse);
      return true;
    }
    return false;
  });

  async function extractChatData(options) {
    const hostname = window.location.hostname;
    try {
      if (hostname.includes('chatgpt.com')) return await parseChatGPT(options);
      if (hostname.includes('gemini.google.com')) return await parseGemini(options);
      if (hostname.includes('claude.ai')) return await parseClaude(options);
      if (hostname.includes('aistudio.google.com')) return await parseAIStudio(options);
      return { success: false, platform: 'Unsupported', messages: [] };
    } catch (error) {
      chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction JS Error', details: error.message });
      return { success: false, platform: 'Unknown', messages: [], error: error.message };
    }
  }

  function isLikelyContent(node) {
    if (!node) return false;
    if (node.closest('nav,aside,header,footer,[role="navigation"]')) return false;
    const text = node.innerText?.trim() || '';
    return text.length > 0 || node.querySelector('img,pre,code');
  }

  async function urlToBase64(url) {
    try {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      const absoluteUrl = new URL(url, location.href).toString();
      const res = await fetch(absoluteUrl);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || absoluteUrl);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }

  async function processNodeContent(element, options, isUser) {
    if (!element) return '';
    if (options.rawHtml) return element.innerHTML;

    const clone = element.cloneNode(true);
    clone.querySelectorAll('button,.sr-only,[role="tooltip"],svg,script,style').forEach((n) => n.remove());

    clone.querySelectorAll('pre').forEach((pre) => {
      const lang = (pre.getAttribute('data-language') || pre.className.match(/language-([\w-]+)/)?.[1] || '').trim();
      const code = pre.innerText || '';
      pre.replaceWith(`\n\
\
\`\`\`${lang}\n${code}\n\`\`\`\n`);
    });

    const images = clone.querySelectorAll('img');
    for (const img of images) {
      const src = img.getAttribute('src') || img.currentSrc || '';
      const width = Number(img.getAttribute('width')) || img.clientWidth || img.naturalWidth || 0;
      if (isUser) {
        img.remove();
        continue;
      }
      if (!src || (width && width < 36 && !src.startsWith('data:'))) {
        img.remove();
        continue;
      }
      const finalSrc = options.convertImages ? await urlToBase64(src) : src;
      img.replaceWith(`\n[[IMG:${finalSrc}]]\n`);
    }

    return (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function dedupeMessages(messages) {
    const seen = new Set();
    return messages.filter((m) => {
      const key = `${m.role}|${m.content}`;
      if (!m.content || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function parseChatGPT(options) {
    const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"], main article, article[data-testid*="turn"], [data-message-author-role]'))
      .filter(isLikelyContent);

    const messages = [];
    for (const node of turns) {
      const roleAttr = node.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || node.getAttribute('data-message-author-role') || '';
      const isAI = /assistant|tool/i.test(roleAttr) || node.innerHTML.includes('assistant');
      const contentNode = node.querySelector('.markdown,.whitespace-pre-wrap,[data-message-id]') || node;
      const content = await processNodeContent(contentNode, options, !isAI);
      if (content) messages.push({ role: isAI ? 'Assistant' : 'User', content });
    }

    return { success: messages.length > 0, platform: 'ChatGPT', title: document.title, messages: dedupeMessages(messages) };
  }

  async function parseGemini(options) {
    const nodes = Array.from(document.querySelectorAll('user-query-item,model-response-item,.user-query-container,.model-response-container,.query-container,.response-container,[data-test-id*="message"]'))
      .filter(isLikelyContent);

    const messages = [];
    for (const node of nodes) {
      const className = String(node.className || '').toLowerCase();
      const tag = node.tagName.toLowerCase();
      const isUser = tag.includes('user') || className.includes('user') || className.includes('query');
      const content = await processNodeContent(node, options, isUser);
      if (content) messages.push({ role: isUser ? 'User' : 'Gemini', content });
    }

    return { success: messages.length > 0, platform: 'Gemini', title: document.title, messages: dedupeMessages(messages) };
  }

  async function parseClaude(options) {
    const nodes = Array.from(document.querySelectorAll('[data-testid="user-message"],[data-testid="assistant-message"],.font-user-message,.font-claude-response,.font-claude-message,[data-is-streaming-or-done]'))
      .filter((n) => isLikelyContent(n) && !n.closest('nav,aside'));

    const messages = [];
    for (const node of nodes) {
      const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''}`.toLowerCase();
      const isUser = marker.includes('user-message') || marker.includes('font-user');
      const contentNode = node.querySelector('.font-claude-response-body,[data-testid="message-content"],.prose,.markdown') || node;
      const content = await processNodeContent(contentNode, options, isUser);
      if (content) messages.push({ role: isUser ? 'User' : 'Claude', content });
    }

    return { success: messages.length > 0, platform: 'Claude', title: document.title, messages: dedupeMessages(messages) };
  }

  async function parseAIStudio(options) {
    const nodes = Array.from(document.querySelectorAll('ms-chat-turn,ms-chat-bubble,user-query-item,model-response-item,.chat-turn,.query-container,.response-container,.chat-bubble'))
      .filter(isLikelyContent);

    const messages = [];
    for (const node of nodes) {
      const marker = `${node.getAttribute('is-user') || ''} ${node.className || ''} ${node.tagName}`.toLowerCase();
      const isUser = marker.includes('true') || marker.includes('user') || marker.includes('query');
      const content = await processNodeContent(node, options, isUser);
      if (content) messages.push({ role: isUser ? 'User' : 'Model', content });
    }

    return { success: messages.length > 0, platform: 'AI Studio', title: document.title || 'AI Studio Export', messages: dedupeMessages(messages) };
  }

  function findScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('main,section,div'));
    return candidates.find((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'visible') || document.scrollingElement || document.documentElement;
  }

  function loadFullHistory(sendResponse) {
    const scroller = findScrollContainer();
    let stableCount = 0;
    let previousHeight = scroller.scrollHeight;
    const timer = setInterval(() => {
      scroller.scrollTop = 0;
      if (Math.abs(scroller.scrollHeight - previousHeight) < 20) stableCount += 1;
      else stableCount = 0;
      previousHeight = scroller.scrollHeight;
      if (stableCount >= 6) {
        clearInterval(timer);
        sendResponse({ status: 'done' });
      }
    }, 1200);
  }
})();
