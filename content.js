// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// content.js - Industrial Extraction Engine v0.9.36

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
    const host = location.hostname;
    try {
      if (host.includes('chatgpt.com')) return await parseChatGPT(options);
      if (host.includes('claude.ai')) return await parseClaude(options);
      if (host.includes('gemini.google.com')) return await parseGemini(options);
      if (host.includes('aistudio.google.com')) return await parseAIStudio(options);
      return { success: false, platform: 'Unsupported', messages: [] };
    } catch (error) {
      chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction JS Error', details: error.message });
      return { success: false, platform: 'Unknown', messages: [], error: error.message };
    }
  }

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function pickBestImageSource(img) {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (src) return src;
    const lazy = img.getAttribute('data-src') || img.getAttribute('data-original') || '';
    if (lazy) return lazy;
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    if (srcset) {
      const best = srcset.split(',').map((x) => x.trim().split(' ')[0]).filter(Boolean).pop();
      if (best) return best;
    }
    return '';
  }

  async function urlToBase64(url) {
    try {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      const abs = new URL(url, location.href).toString();
      const res = await fetch(abs);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || abs);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }

  async function extractImageTokensFromNode(node, options, isUser) {
    const images = Array.from(node.querySelectorAll('img'));
    const tokens = [];

    for (const img of images) {
      const src = pickBestImageSource(img);
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      const cls = (img.className || '').toLowerCase();

      if (!src) continue;
      if (isUser && alt.includes('avatar')) continue;
      if (alt.includes('avatar') || cls.includes('avatar') || cls.includes('icon')) continue;

      const normalized = options.convertImages ? await urlToBase64(src) : src;
      if (normalized) tokens.push(`[[IMG:${normalized}]]`);
    }

    return [...new Set(tokens)];
  }

  async function processNodeContent(node, options, isUser) {
    if (!node) return '';
    if (options.rawHtml) return node.innerHTML || '';

    const imageTokens = await extractImageTokensFromNode(node, options, isUser);

    const clone = node.cloneNode(true);
    clone.querySelectorAll('script,style,button,svg,[role="tooltip"],.sr-only').forEach((n) => n.remove());
    clone.querySelectorAll('img').forEach((img) => img.remove());

    clone.querySelectorAll('pre').forEach((pre) => {
      const lang = (pre.className.match(/language-([\w-]+)/)?.[1] || '').trim();
      const code = pre.innerText || '';
      pre.replaceWith(`\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
    });

    const text = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    const images = imageTokens.length ? `\n${imageTokens.join('\n')}\n` : '';
    return `${text}${images}`.trim();
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((m) => {
      const key = `${m.role}|${m.content}`;
      if (!m.content || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function ordered(nodes) {
    return Array.from(nodes || []).filter((n) => isVisible(n)).sort((a, b) => {
      if (a === b) return 0;
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  async function parseChatGPT(options) {
    const nodes = ordered(document.querySelectorAll('[data-testid^="conversation-turn-"],[data-testid*="conversation-turn"],article[data-testid],article,[role="article"],div[data-message-author-role],main article'))
      .filter((n) => (n.innerText || '').trim().length > 0 || n.querySelector('img'));

    const messages = [];
    for (const node of nodes) {
      const roleAttr = node.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || node.getAttribute('data-message-author-role') || '';
      const isAssistant = /assistant|tool/i.test(roleAttr) || !!node.querySelector('[data-message-author-role="assistant"]');
      const content = await processNodeContent(node, options, !isAssistant);
      if (content.length > 0) messages.push({ role: isAssistant ? 'Assistant' : 'User', content });
    }

    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction Result', details: `ChatGPT found ${messages.length} messages.` });
    return { success: messages.length > 0, platform: 'ChatGPT', title: document.title, messages: dedupe(messages) };
  }

  async function parseClaude(options) {
    const nodes = ordered(document.querySelectorAll('[data-testid="user-message"],[data-testid="assistant-message"],[data-testid*="message"],.font-user-message,.font-claude-response,.font-claude-message,[data-is-streaming-or-done],main article,main section'))
      .filter((n) => !n.closest('nav,aside,header') && ((n.innerText || '').trim().length > 0 || n.querySelector('img')));

    const messages = [];
    for (const node of nodes) {
      const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''}`.toLowerCase();
      const isUser = marker.includes('user');
      const content = await processNodeContent(node, options, isUser);
      if (content.length > 0) messages.push({ role: isUser ? 'User' : 'Claude', content });
    }

    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction Result', details: `Claude found ${messages.length} messages.` });
    return { success: messages.length > 0, platform: 'Claude', title: document.title, messages: dedupe(messages) };
  }

  async function parseGemini(options) {
    const nodes = ordered(document.querySelectorAll('user-query-item,model-response-item,.user-query-container,.model-response-container,.query-container,.response-container,[data-test-id*="message"],[data-test-id="uploaded-img"],img.preview-image,img.image.animate.loaded'));
    const messages = [];
    for (const n of nodes) {
      const mark = `${n.tagName} ${n.className}`.toLowerCase();
      const isUser = mark.includes('user') || mark.includes('query') || mark.includes('uploaded-img');
      const content = await processNodeContent(n, options, isUser);
      if (content) messages.push({ role: isUser ? 'User' : 'Gemini', content });
    }
    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction Result', details: `Gemini found ${messages.length} messages.` });
    return { success: messages.length > 0, platform: 'Gemini', title: document.title, messages: dedupe(messages) };
  }

  async function parseAIStudio(options) {
    const nodes = ordered(document.querySelectorAll('ms-chat-turn,ms-chat-bubble,user-query-item,model-response-item,.chat-turn,.query-container,.response-container,.chat-bubble'));
    const messages = [];
    for (const n of nodes) {
      const mark = `${n.tagName} ${n.className} ${n.getAttribute('is-user') || ''}`.toLowerCase();
      const isUser = mark.includes('true') || mark.includes('user') || mark.includes('query');
      const content = await processNodeContent(n, options, isUser);
      if (content) messages.push({ role: isUser ? 'User' : 'Model', content });
    }
    return { success: messages.length > 0, platform: 'AI Studio', title: document.title || 'AI Studio Export', messages: dedupe(messages) };
  }

  function findScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('main,section,div')).filter((el) => el.scrollHeight > el.clientHeight + 120);
    return candidates[0] || document.scrollingElement || document.documentElement;
  }

  function loadFullHistory(sendResponse) {
    const scroller = findScrollContainer();
    let stable = 0;
    let prev = scroller.scrollHeight;
    let rounds = 0;
    const timer = setInterval(() => {
      rounds += 1;
      scroller.scrollTop = 0;
      if (Math.abs(scroller.scrollHeight - prev) < 24) stable += 1;
      else stable = 0;
      prev = scroller.scrollHeight;
      if (stable >= 10 || rounds >= 45) {
        clearInterval(timer);
        sendResponse({ status: 'done' });
      }
    }, 1200);
  }
})();
