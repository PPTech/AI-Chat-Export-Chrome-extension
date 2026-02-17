// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// content.js - Platform Engine Orchestrator v0.10.0

(() => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;

  /**
   * Standard normalized message model:
   * {
   *   role: 'User' | 'Assistant' | 'Model' | 'Claude' | 'Gemini',
   *   content: string, // text + code fences + [[IMG:...]] tokens
   *   meta: { platform: string, sourceSelector?: string }
   * }
   */

  const PlatformEngines = {
    chatgpt: {
      name: 'ChatGPT',
      matches: () => location.hostname.includes('chatgpt.com'),
      selectors: [
        '[data-testid^="conversation-turn-"]',
        '[data-testid*="conversation-turn"]',
        'article[data-testid]',
        'article',
        '[role="article"]',
        'div[data-message-author-role]',
        'main article'
      ],
      async extract(options, utils) {
        const nodes = utils.queryOrdered(this.selectors.join(','))
          .filter((n) => utils.hasMeaningfulContent(n));

        const messages = [];
        for (const node of nodes) {
          const roleAttr = node.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') ||
            node.getAttribute('data-message-author-role') || '';
          const isAssistant = /assistant|tool/i.test(roleAttr) || !!node.querySelector('[data-message-author-role="assistant"]');
          const content = await utils.extractNodeContent(node, options, !isAssistant, this.name, 'chatgpt-node');
          if (content) messages.push({ role: isAssistant ? 'Assistant' : 'User', content, meta: { platform: this.name, sourceSelector: 'chatgpt-node' } });
        }

        return { platform: this.name, title: document.title, messages };
      }
    },

    claude: {
      name: 'Claude',
      matches: () => location.hostname.includes('claude.ai'),
      selectors: [
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '[data-testid*="message"]',
        '.font-user-message',
        '.font-claude-response',
        '.font-claude-message',
        '[data-is-streaming-or-done]',
        'main article',
        'main section'
      ],
      async extract(options, utils) {
        const nodes = utils.queryOrdered(this.selectors.join(','))
          .filter((n) => !n.closest('nav,aside,header') && utils.hasMeaningfulContent(n));

        const messages = [];
        for (const node of nodes) {
          const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''}`.toLowerCase();
          const isUser = marker.includes('user');
          const content = await utils.extractNodeContent(node, options, isUser, this.name, 'claude-node');
          if (content) messages.push({ role: isUser ? 'User' : 'Claude', content, meta: { platform: this.name, sourceSelector: 'claude-node' } });
        }

        return { platform: this.name, title: document.title, messages };
      }
    },

    gemini: {
      name: 'Gemini',
      matches: () => location.hostname.includes('gemini.google.com'),
      selectors: [
        'user-query-item',
        'model-response-item',
        '.user-query-container',
        '.model-response-container',
        '.query-container',
        '.response-container',
        '[data-test-id*="message"]',
        '[data-test-id="uploaded-img"]',
        'img.preview-image',
        'img.image.animate.loaded'
      ],
      async extract(options, utils) {
        const nodes = utils.queryOrdered(this.selectors.join(','))
          .filter((n) => utils.hasMeaningfulContent(n));

        const messages = [];
        for (const node of nodes) {
          const marker = `${node.tagName} ${node.className}`.toLowerCase();
          const isUser = marker.includes('user') || marker.includes('query') || marker.includes('uploaded-img');
          const content = await utils.extractNodeContent(node, options, isUser, this.name, 'gemini-node');
          if (content) messages.push({ role: isUser ? 'User' : 'Gemini', content, meta: { platform: this.name, sourceSelector: 'gemini-node' } });
        }

        return { platform: this.name, title: document.title, messages };
      }
    },

    aistudio: {
      name: 'AI Studio',
      matches: () => location.hostname.includes('aistudio.google.com'),
      selectors: [
        'ms-chat-turn',
        'ms-chat-bubble',
        'user-query-item',
        'model-response-item',
        '.chat-turn',
        '.query-container',
        '.response-container',
        '.chat-bubble'
      ],
      async extract(options, utils) {
        const nodes = utils.queryOrdered(this.selectors.join(','))
          .filter((n) => utils.hasMeaningfulContent(n));

        const messages = [];
        for (const node of nodes) {
          const marker = `${node.tagName} ${node.className} ${node.getAttribute('is-user') || ''}`.toLowerCase();
          const isUser = marker.includes('true') || marker.includes('user') || marker.includes('query');
          const content = await utils.extractNodeContent(node, options, isUser, this.name, 'aistudio-node');
          if (content) messages.push({ role: isUser ? 'User' : 'Model', content, meta: { platform: this.name, sourceSelector: 'aistudio-node' } });
        }

        return { platform: this.name, title: document.title || 'AI Studio Export', messages };
      }
    }
  };

  const utils = {
    isVisible(el) {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    },

    hasMeaningfulContent(node) {
      return !!node && ((node.innerText || '').trim().length > 0 || !!node.querySelector('img,pre,code'));
    },

    queryOrdered(selector) {
      return Array.from(document.querySelectorAll(selector))
        .filter((n) => this.isVisible(n))
        .sort((a, b) => {
          if (a === b) return 0;
          const pos = a.compareDocumentPosition(b);
          return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
    },

    dedupe(messages) {
      const seen = new Set();
      return messages.filter((m) => {
        const key = `${m.role}|${m.content}`;
        if (!m.content || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    pickBestImageSource(img) {
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
    },

    async urlToBase64(url) {
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
    },

    async extractImageTokensFromNode(node, options, isUser) {
      const images = Array.from(node.querySelectorAll('img'));
      const tokens = [];

      for (const img of images) {
        const src = this.pickBestImageSource(img);
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        const cls = (img.className || '').toLowerCase();

        if (!src) continue;
        if (isUser && alt.includes('avatar')) continue;
        if (alt.includes('avatar') || cls.includes('avatar') || cls.includes('icon')) continue;

        const normalized = options.convertImages ? await this.urlToBase64(src) : src;
        if (normalized) tokens.push(`[[IMG:${normalized}]]`);
      }

      return [...new Set(tokens)];
    },

    async extractNodeContent(node, options, isUser, platform, sourceSelector) {
      if (!node) return '';
      if (options.rawHtml) return node.innerHTML || '';

      const imageTokens = await this.extractImageTokensFromNode(node, options, isUser);

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
      const out = `${text}${images}`.trim();
      return out;
    }
  };

  async function extractChatData(options) {
    const engine = Object.values(PlatformEngines).find((e) => e.matches());
    if (!engine) return { success: false, platform: 'Unsupported', messages: [] };

    const extracted = await engine.extract(options, utils);
    const messages = utils.dedupe(extracted.messages || []);

    chrome.runtime.sendMessage({
      action: 'LOG_ERROR',
      message: 'Extraction Result',
      details: `${engine.name} found ${messages.length} messages.`
    });

    return {
      success: messages.length > 0,
      platform: extracted.platform,
      title: extracted.title,
      messages
    };
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
})();
