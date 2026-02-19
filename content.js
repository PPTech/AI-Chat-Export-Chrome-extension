// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// content.js - Platform Engine Orchestrator v0.10.11

(() => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;

  const CHATGPT_ANALYSIS_KEY = 'CHATGPT_DOM_ANALYSIS';


  class GeminiExtractor {
    constructor(options = {}) {
      this.options = options;
      this.maxProbeNodes = 1200;
    }

    getAllElementsDeep(root = document) {
      const out = [];
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        const children = current instanceof ShadowRoot ? Array.from(current.children) : Array.from((current.children || []));
        for (let i = children.length - 1; i >= 0; i -= 1) {
          const child = children[i];
          out.push(child);
          if (child.shadowRoot) stack.push(child.shadowRoot);
          stack.push(child);
          if (out.length > this.maxProbeNodes) return out;
        }
      }
      return out;
    }

    countTextNodes(el) {
      let count = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if ((walker.currentNode.textContent || '').trim().length > 2) count += 1;
      }
      return count;
    }

    isScrollable(el) {
      if (!el || !(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      return ['auto', 'scroll', 'overlay'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 80;
    }

    detectScope() {
      const viewportH = window.innerHeight || 1;
      const candidates = [];
      const seen = new Set();

      const addCandidate = (el, method) => {
        if (!el || seen.has(el)) return;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        const heightRatio = rect.height / viewportH;
        const scrollable = this.isScrollable(el) ? 1 : 0;
        const textNodes = this.countTextNodes(el);
        const turnHints = el.querySelectorAll('[data-test-id*="user"], [data-test-id*="model"], article, [role="listitem"], pre, img').length;
        const score = (heightRatio * 3) + (scrollable * 3) + Math.min(3, textNodes / 80) + Math.min(2, turnHints / 15);
        candidates.push({
          el,
          method,
          score,
          diagnostics: { heightRatio: Number(heightRatio.toFixed(2)), scrollable, textNodes, turnHints }
        });
      };

      document.querySelectorAll('[role="main"], main').forEach((el) => addCandidate(el, 'aria-main'));
      this.getAllElementsDeep(document).forEach((el) => {
        if (!(el instanceof Element)) return;
        if (this.isScrollable(el) && el.getBoundingClientRect().height > viewportH * 0.7) addCandidate(el, 'scroll-probe');
      });

      if (!candidates.length) addCandidate(document.scrollingElement || document.documentElement, 'document-fallback');
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates[0];
      return {
        rootEl: top ? top.el : null,
        method: top ? top.method : 'none',
        confidence: top ? Math.min(0.98, top.score / 8.5) : 0,
        candidates: candidates.slice(0, 10)
      };
    }

    collectTurnCandidates(rootEl) {
      if (!rootEl) return [];
      const nodes = [];
      const seen = new Set();
      const probe = this.getAllElementsDeep(rootEl);

      probe.forEach((el, idx) => {
        if (!(el instanceof Element) || seen.has(el)) return;
        const textLen = (el.innerText || '').trim().length;
        const hasCode = !!el.querySelector('pre,code');
        const hasImg = !!el.querySelector('img');
        const marker = `${el.getAttribute('data-test-id') || ''} ${el.getAttribute('aria-label') || ''} ${el.tagName}`.toLowerCase();
        const hintScore = /(user|query|model|response|prompt|gemini)/.test(marker) ? 2 : 0;
        let score = Math.min(5, textLen / 160) + (hasCode ? 2 : 0) + (hasImg ? 1.5 : 0) + hintScore;
        if (textLen < 4 && !hasImg && !hasCode) score -= 2;
        if (el.children.length > 15 && !hasCode && !hasImg) score -= 1;
        if (score < 1.6) return;
        seen.add(el);
        nodes.push({
          el,
          indexInDom: idx,
          score: Number(score.toFixed(2)),
          signals: [
            textLen > 0 ? `text:${textLen}` : null,
            hasCode ? 'has-code' : null,
            hasImg ? 'has-image' : null,
            hintScore ? 'attribute-role-hint' : null
          ].filter(Boolean)
        });
      });

      nodes.sort((a, b) => b.score - a.score);
      const selected = [];
      for (const node of nodes) {
        const nestedBetter = nodes.some((other) => other !== node && node.el.contains(other.el) && other.score >= node.score);
        if (nestedBetter) continue;
        const overlap = selected.some((kept) => kept.el.contains(node.el) || node.el.contains(kept.el));
        if (!overlap) selected.push(node);
      }
      return selected.sort((a, b) => a.indexInDom - b.indexInDom);
    }

    inferRole(el, scopeEl) {
      const evidence = [];
      let role = 'unknown';
      let confidence = 0.35;
      const txt = (el.innerText || '').toLowerCase();
      const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-test-id') || ''}`.toLowerCase();

      const avatarUser = !!el.querySelector('img[src*="googleusercontent"], img[alt*="profile" i], img[alt*="avatar" i]');
      if (avatarUser || /user-query|user/.test(aria)) {
        role = 'user';
        confidence += 0.3;
        evidence.push('user-avatar-or-aria-hint');
      }

      const modelHint = /gemini|model/.test(aria) || /regenerate|draft response|thought/i.test(txt);
      const geminiIcon = !!el.querySelector('svg[aria-label*="Gemini" i], [aria-label*="Gemini" i], [aria-label*="Model" i]');
      if (modelHint || geminiIcon) {
        role = 'assistant';
        confidence += 0.3;
        evidence.push('model-aria-or-control-hint');
      }

      if (scopeEl) {
        const rect = el.getBoundingClientRect();
        const sRect = scopeEl.getBoundingClientRect();
        const delta = (rect.left + rect.width / 2) - (sRect.left + sRect.width / 2);
        if (delta > sRect.width * 0.12) {
          evidence.push('layout:right');
          if (role === 'unknown') role = 'user';
          confidence += 0.1;
        } else if (delta < -sRect.width * 0.12) {
          evidence.push('layout:left');
          if (role === 'unknown') role = 'assistant';
          confidence += 0.1;
        }
      }

      confidence = Math.min(0.98, confidence);
      if (confidence < 0.5) role = 'unknown';
      return { role, confidence: Number(confidence.toFixed(2)), evidence };
    }

    parseBlocks(el) {
      const blocks = [];
      const diagnostics = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.TEXT_NODE) {
          const cleaned = (node.textContent || '').replace(/\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim();
          if (cleaned) blocks.push({ type: 'text', text: cleaned });
          continue;
        }
        const tag = node.tagName ? node.tagName.toLowerCase() : '';
        if (tag === 'pre' || tag === 'code') {
          const code = node.textContent || '';
          if (code.trim()) {
            const langHint = (node.previousElementSibling?.textContent || '').trim().slice(0, 24);
            blocks.push({ type: 'code', code, language: /[a-z]{2,}/i.test(langHint) ? langHint : '' });
          }
        } else if (tag === 'img') {
          const src = node.currentSrc || node.getAttribute('src') || node.getAttribute('data-src') || '';
          if (src) blocks.push({ type: 'image', src, alt: node.getAttribute('alt') || '' });
        } else if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          if (href) blocks.push({ type: 'link', href, text: (node.textContent || '').trim() });
        } else if (tag === 'blockquote') {
          const text = (node.textContent || '').trim();
          if (text) blocks.push({ type: 'quote', text });
        } else if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(node.querySelectorAll(':scope > li')).map((li) => (li.textContent || '').trim()).filter(Boolean);
          if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
        }
      }
      const textPlain = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').replace(/\n{3,}/g, '\n\n').trim();
      diagnostics.push(`block-count:${blocks.length}`);
      return { blocks, textPlain, diagnostics };
    }

    async run() {
      const scope = this.detectScope();
      const turns = this.collectTurnCandidates(scope.rootEl);
      const messages = turns.map((turn) => {
        const inferredRole = this.inferRole(turn.el, scope.rootEl);
        const parsed = this.parseBlocks(turn.el);
        return {
          ...turn,
          inferredRole,
          parsed,
          signature: `${turn.el.tagName.toLowerCase()}#${turn.el.childElementCount}`
        };
      });

      return {
        platform: 'Gemini',
        timestamp: new Date().toISOString(),
        root: scope,
        messageCount: messages.length,
        messages
      };
    }
  }

  function tryChatGptSsotExtraction() {
    // Attempt 1: __NEXT_DATA__ (older ChatGPT builds)
    try {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        const payload = JSON.parse(nextDataEl.textContent || '{}');
        const serverResp = payload?.props?.pageProps?.serverResponse;
        if (serverResp?.body?.mapping) {
          const mapping = serverResp.body.mapping;
          const ordered = Object.values(mapping)
            .filter((n) => n.message?.content?.parts?.length)
            .sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
          if (ordered.length > 0) {
            return {
              strategy: 'ssot:__NEXT_DATA__',
              messages: ordered.map((n) => ({
                role: n.message.author?.role === 'user' ? 'User' : 'Assistant',
                content: n.message.content.parts.join('\n'),
                meta: { platform: 'ChatGPT', sourceSelector: 'ssot:__NEXT_DATA__', confidence: 0.99, evidence: ['ssot-server-data'] }
              }))
            };
          }
        }
      }
    } catch { /* SSOT path unavailable */ }

    // Attempt 2: Remix route data (newer ChatGPT builds)
    try {
      const remixCtx = window.__remixContext;
      if (remixCtx?.state?.loaderData) {
        for (const [, loaderData] of Object.entries(remixCtx.state.loaderData)) {
          const mapping = loaderData?.serverResponse?.body?.mapping;
          if (!mapping) continue;
          const ordered = Object.values(mapping)
            .filter((n) => n.message?.content?.parts?.length)
            .sort((a, b) => (a.message?.create_time || 0) - (b.message?.create_time || 0));
          if (ordered.length > 0) {
            return {
              strategy: 'ssot:__remixContext',
              messages: ordered.map((n) => ({
                role: n.message.author?.role === 'user' ? 'User' : 'Assistant',
                content: n.message.content.parts.join('\n'),
                meta: { platform: 'ChatGPT', sourceSelector: 'ssot:__remixContext', confidence: 0.99, evidence: ['ssot-remix-data'] }
              }))
            };
          }
        }
      }
    } catch { /* Remix data unavailable */ }

    return null;
  }

  function computeCoverageMetrics(messages, domNodeCount) {
    const user = messages.filter((m) => m.role === 'User').length;
    const assistant = messages.filter((m) => m.role === 'Assistant' || m.role === 'Claude' || m.role === 'Gemini' || m.role === 'Model').length;
    const unknown = messages.filter((m) => m.role === 'Unknown').length;
    const total = messages.length;
    return {
      messages_total: total,
      messages_user: user,
      messages_assistant: assistant,
      messages_unknown: unknown,
      unknown_role_ratio: total > 0 ? (unknown / total).toFixed(3) : '0.000',
      dom_candidates: domNodeCount,
      coverage_ratio: domNodeCount > 0 ? (total / domNodeCount).toFixed(3) : '0.000'
    };
  }

  const PlatformEngines = {
    chatgpt: {
      name: 'ChatGPT',
      matches: () => location.hostname.includes('chatgpt.com') || location.hostname.includes('chat.openai.com'),
      async extract(options, utils) {
        // Strategy 1: SSOT extraction from embedded JSON data
        const ssot = tryChatGptSsotExtraction();
        if (ssot && ssot.messages.length > 0) {
          const isCodex = /chatgpt\.com\/codex/i.test(location.href);
          const platformName = isCodex ? 'ChatGPT Codex' : this.name;
          const coverage = computeCoverageMetrics(ssot.messages, ssot.messages.length);
          console.log(`[ChatGPT] SSOT extraction via ${ssot.strategy}: ${ssot.messages.length} messages`, coverage);
          return { platform: platformName, title: document.title, messages: ssot.messages, _extraction: { strategy: ssot.strategy, coverage } };
        }

        // Strategy 2: DOM analysis (controlled scroll if fullLoad)
        const analysis = await runChatGptDomAnalysis(options.fullLoad ? 'full' : 'visible', options, utils);
        let messages = [];
        for (const m of analysis.messages) {
          messages.push({
            role: m.inferredRole.role === 'assistant' ? 'Assistant' : (m.inferredRole.role === 'user' ? 'User' : 'Unknown'),
            content: await composeContentFromBlocks(m.parsed.blocks, options),
            meta: {
              platform: this.name,
              sourceSelector: m.signature,
              confidence: m.inferredRole.confidence,
              evidence: m.inferredRole.evidence
            }
          });
        }

        // Strategy 3: Fallback selectors
        if (!messages.length) {
          const fallbackNodes = utils.adaptiveQuery('main [data-message-author-role], main article, main [data-testid*="message"], main section', 1)
            .filter((n) => utils.hasMeaningfulContent(n));
          messages = [];
          for (const node of fallbackNodes) {
            const marker = `${node.getAttribute('data-message-author-role') || ''} ${node.getAttribute('data-testid') || ''}`.toLowerCase();
            const isUser = marker.includes('user');
            const content = await utils.extractNodeContent(node, options, isUser, this.name, 'chatgpt-fallback');
            if (content) messages.push({ role: isUser ? 'User' : 'Assistant', content, meta: { platform: this.name, sourceSelector: 'chatgpt-fallback' } });
          }
        }

        const isCodex = /chatgpt\.com\/codex/i.test(location.href);
        const platformName = isCodex ? 'ChatGPT Codex' : this.name;
        const domCandidateCount = analysis.messages?.length || 0;
        const strategy = messages.length ? 'dom-analysis' : 'fallback-selectors';
        const coverage = computeCoverageMetrics(messages, domCandidateCount);
        console.log(`[ChatGPT] ${strategy}: ${messages.length} messages`, coverage);
        return { platform: platformName, title: document.title, messages, _extraction: { strategy, coverage, loadReport: analysis.loadReport } };
      }
    },

    claude: {
      name: 'Claude',
      matches: () => location.hostname.includes('claude.ai'),
      selectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '[data-testid*="message"]', '.font-user-message', '.font-claude-response', '.font-claude-message', '[data-is-streaming-or-done]', 'main article', 'main section'],
      async extract(options, utils) {
        const nodes = utils.adaptiveQuery(this.selectors.join(','), 1).filter((n) => !n.closest('nav,aside,header') && utils.hasMeaningfulContent(n));
        const messages = [];
        for (const node of nodes) {
          const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''}`.toLowerCase();
          const isUser = marker.includes('user');
          let content = await utils.extractNodeContent(node, options, isUser, this.name, 'claude-node');
          // Strip UI HTML contamination unless rawHtml mode
          if (content && !options.rawHtml) content = normalizeContent(content);
          if (content) messages.push({ role: isUser ? 'User' : 'Claude', content, meta: { platform: this.name, sourceSelector: 'claude-node' } });
        }
        return { platform: this.name, title: document.title, messages };
      }
    },

    gemini: {
      name: 'Gemini',
      matches: () => location.hostname.includes('gemini.google.com'),
      async extract(options, utils) {
        const extractor = new GeminiExtractor(options);
        const analysis = await extractor.run();
        window.GEMINI_DOM_ANALYSIS = analysis;

        const messages = [];
        for (const m of analysis.messages) {
          const role = m.inferredRole.role === 'assistant' ? 'Gemini' : (m.inferredRole.role === 'user' ? 'User' : 'Unknown');
          const content = await composeContentFromBlocks(m.parsed.blocks, options);
          if (content) {
            messages.push({ role, content, meta: { platform: this.name, sourceSelector: m.signature, confidence: m.inferredRole.confidence, evidence: m.inferredRole.evidence } });
          }
        }

        return { platform: this.name, title: document.title, messages };
      }
    },

    aistudio: {
      name: 'AI Studio',
      matches: () => location.hostname.includes('aistudio.google.com'),
      selectors: ['ms-chat-turn', 'ms-chat-bubble', 'user-query-item', 'model-response-item', '.chat-turn', '.query-container', '.response-container', '.chat-bubble'],
      async extract(options, utils) {
        const nodes = utils.adaptiveQuery(this.selectors.join(','), 1).filter((n) => utils.hasMeaningfulContent(n));
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

    scoreNodeForExtraction(node) {
      if (!node) return 0;
      const textLen = (node.innerText || '').trim().length;
      const imgCount = node.querySelectorAll('img').length;
      const codeCount = node.querySelectorAll('pre,code').length;
      const roleHints = /assistant|user|message|response|query/i.test(`${node.className || ''} ${node.getAttribute('data-testid') || ''}`) ? 1 : 0;
      return Math.min(5, Math.floor(textLen / 80)) + (imgCount * 2) + codeCount + roleHints;
    },

    adaptiveQuery(selector, minScore = 1) {
      return this.queryOrdered(selector).filter((n) => this.scoreNodeForExtraction(n) >= minScore);
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
        // Block external favicon services and tiny UI icons
        if (/favicon|google\.com\/s2\/favicons|gstatic\.com.*icon/i.test(src)) continue;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w > 0 && h > 0 && w <= 24 && h <= 24) continue; // skip tiny icons

        const normalized = options.convertImages ? await this.urlToBase64(src) : src;
        if (normalized) tokens.push(`[[IMG:${normalized}]]`);
      }

      return [...new Set(tokens)];
    },

    async extractFileTokensFromNode(node) {
      const links = Array.from(node.querySelectorAll('a[href], a[download], button[data-file-url], [data-file-url], iframe[src], iframe[srcdoc]'));
      const artifactSelectors = Array.from(node.querySelectorAll('[data-artifact-id], [data-testid*="artifact"], [class*="Artifact" i], [class*="artifact" i], iframe[title*="Artifact" i], [role="region"][aria-label*="Artifact" i]'));
      const tokens = [];
      for (const link of [...links, ...artifactSelectors]) {
        const href = link.getAttribute('href') || link.getAttribute('data-file-url') || link.getAttribute('src') || '';
        const srcdoc = link.getAttribute('srcdoc') || '';
        if (!href) continue;
        const abs = (() => {
          try { return new URL(href, location.href).toString(); } catch { return ''; }
        })();
        if (!abs) continue;
        const isFileLike = /download|attachment|file|uploads|backend-api\/(files|estuary\/content)|blob:|data:|\/artifact\//i.test(abs)
          || !!link.getAttribute('download')
          || /artifact|download|file/i.test(`${link.getAttribute('aria-label') || ''} ${link.textContent || ''}`);
        if (!isFileLike) continue;
        const nameRaw = link.getAttribute('download') || link.getAttribute('data-artifact-id') || link.textContent || abs.split('/').pop() || (srcdoc ? 'artifact.html' : 'file.bin');
        const safeName = nameRaw.replace(/[\/:*?"<>|]+/g, '_').trim() || 'file.bin';
        tokens.push(`[[FILE:${abs}|${safeName}]]`);
      }
      return [...new Set(tokens)];
    },

    async extractNodeContent(node, options, isUser) {
      if (!node) return '';
      if (options.rawHtml) return node.innerHTML || '';

      const imageTokens = await this.extractImageTokensFromNode(node, options, isUser);
      const fileTokens = options.extractFiles ? await this.extractFileTokensFromNode(node) : [];

      const clone = node.cloneNode(true);
      // Remove UI scaffolding elements
      clone.querySelectorAll('script,style,button,svg,nav,aside,header,footer,[role="toolbar"],[role="tooltip"],[aria-hidden="true"],.sr-only').forEach((n) => n.remove());
      // Remove "Copy", "Show more", etc. leaf buttons/labels
      clone.querySelectorAll('*').forEach((el) => {
        const t = (el.textContent || '').trim().toLowerCase();
        if (/^(copy|copied|show more|show less|share|thumbs up|thumbs down|edit)$/i.test(t) && el.children.length === 0) {
          el.remove();
        }
      });
      clone.querySelectorAll('img').forEach((img) => img.remove());

      clone.querySelectorAll('pre').forEach((pre) => {
        const lang = (pre.className.match(/language-([\w-]+)/)?.[1] || '').trim();
        const code = pre.textContent || '';
        pre.replaceWith(`\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
      });

      const text = (clone.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      const images = imageTokens.length ? `\n${imageTokens.join('\n')}\n` : '';
      const files = fileTokens.length ? `\n${fileTokens.join('\n')}\n` : '';
      return `${text}${images}${files}`.trim();
    },
  };

  function domSignature(el) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.');
    return `${tag}${cls ? '.' + cls : ''}#${el.childElementCount}`;
  }

  function repetitionScore(root) {
    const children = Array.from(root.children || []);
    if (!children.length) return 0;
    const map = new Map();
    children.forEach((c) => {
      const sig = domSignature(c);
      map.set(sig, (map.get(sig) || 0) + 1);
    });
    const max = Math.max(...map.values());
    return max / Math.max(1, children.length);
  }

  function detectConversationRoot() {
    const candidates = [];
    const all = Array.from(document.querySelectorAll('main,section,article,div,[role="main"],[role="region"],[role="log"]'));

    all.forEach((el) => {
      const cs = getComputedStyle(el);
      const scrollLike = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') ? 1 : 0;
      const scrollRatio = el.clientHeight > 0 ? (el.scrollHeight / el.clientHeight) : 0;
      const textLen = (el.innerText || '').trim().length;
      const textDensity = textLen / Math.max(1, el.querySelectorAll('*').length);
      const codeCount = el.querySelectorAll('pre code').length;
      const imgCount = el.querySelectorAll('img').length;
      const rep = repetitionScore(el);
      const ariaHint = /main|region|log/i.test(`${el.getAttribute('role') || ''}`) ? 0.5 : 0;

      const score = (scrollLike * 2) + Math.min(3, scrollRatio) + Math.min(3, textDensity / 50) + Math.min(2, codeCount) + Math.min(2, imgCount / 2) + (rep * 3) + ariaHint;
      if (score < 2) return;

      candidates.push({
        el,
        score,
        reason: {
          scrollLike,
          scrollRatio: Number(scrollRatio.toFixed(2)),
          textDensity: Number(textDensity.toFixed(2)),
          codeCount,
          imgCount,
          repetition: Number(rep.toFixed(2)),
          ariaHint
        }
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0] || null;
    return {
      rootEl: top ? top.el : null,
      method: top ? 'scroll-container-rank' : 'none',
      confidence: top ? Math.min(1, top.score / 10) : 0,
      candidates: candidates.slice(0, 10).map((c) => ({ score: c.score, reason: c.reason, signature: domSignature(c.el) }))
    };
  }

  function collectMessageNodes(rootEl) {
    if (!rootEl) return [];
    const raw = Array.from(rootEl.querySelectorAll('article,section,div,li')).filter((el) => {
      const text = (el.textContent || '').trim();
      return text.length > 0 || el.querySelector('pre code,img');
    });

    const candidates = raw.map((el, idx) => {
      const signals = [];
      const textLen = (el.innerText || '').trim().length;
      const hasCode = !!el.querySelector('pre code');
      const hasImg = !!el.querySelector('img');
      const hasCopy = /(copy|clipboard)/i.test(el.innerText || '') || !!el.querySelector('button[aria-label*="Copy"],button[title*="Copy"]');
      const scoreBase = Math.min(5, Math.floor(textLen / 100));
      if (hasCode) signals.push('contains-code');
      if (hasImg) signals.push('contains-image');
      if (hasCopy) signals.push('contains-copy-control');
      if (/assistant|user|message|response|query/i.test(`${el.className || ''} ${el.getAttribute('data-testid') || ''}`)) signals.push('role-hint-class');

      let score = scoreBase + (hasCode ? 2 : 0) + (hasImg ? 2 : 0) + (hasCopy ? 1 : 0) + (signals.includes('role-hint-class') ? 1 : 0);
      const nestedCount = raw.filter((r) => r !== el && el.contains(r)).length;
      if (nestedCount > 4) {
        score -= 2;
        signals.push('penalized-wrapper-container');
      }

      return { el, indexInDom: idx, score, signals };
    }).filter((c) => c.score > 0);

    candidates.sort((a, b) => b.score - a.score);

    const kept = [];
    for (const cand of candidates) {
      const hasBetterChild = candidates.some((other) => other !== cand && cand.el.contains(other.el) && other.score >= cand.score - 1);
      if (hasBetterChild) continue;
      const alreadyCovered = kept.some((k) => k.el.contains(cand.el) || cand.el.contains(k.el));
      if (!alreadyCovered) kept.push(cand);
    }

    kept.sort((a, b) => a.indexInDom - b.indexInDom);
    return kept;
  }

  function inferRole(messageEl, rootEl) {
    const evidence = [];
    let role = 'unknown';
    let confidence = 0.3;

    // 1. Check data-message-author-role on element AND ancestors (ChatGPT primary signal)
    const authorRole = findAttrUp(messageEl, 'data-message-author-role', 3);
    if (authorRole === 'user') {
      evidence.push('attr:data-message-author-role=user');
      role = 'user';
      confidence += 0.5;
    } else if (authorRole === 'assistant') {
      evidence.push('attr:data-message-author-role=assistant');
      role = 'assistant';
      confidence += 0.5;
    }

    // 2. Check data-testid attributes (ChatGPT uses conversation-turn-N patterns)
    const testId = findAttrUp(messageEl, 'data-testid', 3) || '';
    if (/user/i.test(testId)) {
      evidence.push(`testid:${testId}`);
      if (role === 'unknown') role = 'user';
      confidence += 0.3;
    } else if (/assistant|model|response/i.test(testId)) {
      evidence.push(`testid:${testId}`);
      if (role === 'unknown') role = 'assistant';
      confidence += 0.3;
    }

    // 3. Check ARIA labels and accessible names
    const ariaLabel = (messageEl.getAttribute('aria-label') || '').toLowerCase();
    const ariaRoledesc = (messageEl.getAttribute('aria-roledescription') || '').toLowerCase();
    const ariaCombo = `${ariaLabel} ${ariaRoledesc}`;
    if (/\buser\b|human|you said/i.test(ariaCombo)) {
      evidence.push('aria:user-hint');
      if (role === 'unknown') role = 'user';
      confidence += 0.2;
    } else if (/\bassistant\b|chatgpt|gpt|model|response/i.test(ariaCombo)) {
      evidence.push('aria:assistant-hint');
      if (role === 'unknown') role = 'assistant';
      confidence += 0.2;
    }

    // 4. Check for avatar/icon patterns indicating role
    const hasUserAvatar = !!messageEl.querySelector('img[alt*="User" i], img[alt*="avatar" i]:not([alt*="ChatGPT"]):not([alt*="GPT"])');
    const hasAssistantIcon = !!messageEl.querySelector('img[alt*="ChatGPT" i], img[alt*="GPT" i], svg[class*="gizmo"], [data-testid="bot-avatar"]');
    if (hasUserAvatar && !hasAssistantIcon) {
      evidence.push('avatar:user');
      if (role === 'unknown') role = 'user';
      confidence += 0.15;
    } else if (hasAssistantIcon) {
      evidence.push('avatar:assistant');
      if (role === 'unknown') role = 'assistant';
      confidence += 0.15;
    }

    // 5. Container class/attribute semantics
    const classAndAttrs = `${messageEl.className || ''} ${messageEl.getAttribute('data-role') || ''}`.toLowerCase();
    if (/\buser\b/.test(classAndAttrs)) {
      evidence.push('class:user');
      if (role === 'unknown') role = 'user';
      confidence += 0.15;
    } else if (/\bassistant\b|\bbot\b|\bai\b|\bmodel\b/.test(classAndAttrs)) {
      evidence.push('class:assistant');
      if (role === 'unknown') role = 'assistant';
      confidence += 0.15;
    }

    // 6. Layout alignment (weakest signal, never overrides stronger signals)
    if (role === 'unknown') {
      const rect = messageEl.getBoundingClientRect();
      const rootRect = rootEl.getBoundingClientRect();
      const centerMsg = rect.left + rect.width / 2;
      const centerRoot = rootRect.left + rootRect.width / 2;
      const alignmentDelta = centerMsg - centerRoot;
      if (alignmentDelta > rootRect.width * 0.15) {
        evidence.push('layout:right');
        role = 'user';
        confidence += 0.1;
      } else if (alignmentDelta < -rootRect.width * 0.1) {
        evidence.push('layout:left');
        role = 'assistant';
        confidence += 0.1;
      }
    }

    // 7. Content-based hints (assistant controls)
    const txt = (messageEl.innerText || '').toLowerCase();
    if (role === 'unknown' && /regenerate|continue generating|thumbs up|thumbs down|copy code/.test(txt)) {
      evidence.push('content:assistant-controls');
      role = 'assistant';
      confidence += 0.15;
    }

    confidence = Math.min(0.99, confidence);
    // Lower threshold: 0.35 instead of 0.5 to reduce unknowns
    if (confidence < 0.35) role = 'unknown';

    return { role, confidence: Number(confidence.toFixed(2)), evidence };
  }

  // Walk up to `maxDepth` ancestors to find an attribute value
  function findAttrUp(el, attr, maxDepth = 3) {
    let current = el;
    for (let i = 0; i <= maxDepth && current; i++) {
      const val = current.getAttribute?.(attr);
      if (val) return val.toLowerCase();
      current = current.parentElement;
    }
    return null;
  }

  function parseMessageContent(messageEl) {
    const blocks = [];
    const diagnostics = [];

    const walker = document.createTreeWalker(messageEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const seenCode = new Set();
    const seenLinks = new Set();
    const seenImgs = new Set();

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) blocks.push({ type: 'text', text });
        continue;
      }

      const el = node;
      const tag = el.tagName.toLowerCase();
      if (tag === 'pre') {
        const codeEl = el.querySelector('code') || el;
        const code = codeEl.textContent || '';
        if (!seenCode.has(code)) {
          blocks.push({ type: 'code', code });
          seenCode.add(code);
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => (li.textContent || '').trim()).filter(Boolean);
        if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      } else if (tag === 'blockquote') {
        const quote = (el.textContent || '').trim();
        if (quote) blocks.push({ type: 'quote', text: quote });
      } else if (tag === 'img') {
        const src = utils.pickBestImageSource(el);
        if (src && !seenImgs.has(src)) {
          blocks.push({ type: 'image', src, alt: el.getAttribute('alt') || '', width: el.naturalWidth || null, height: el.naturalHeight || null });
          seenImgs.add(src);
        }
      } else if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        const text = (el.textContent || '').trim();
        const key = `${href}|${text}`;
        if (href && !seenLinks.has(key)) {
          blocks.push({ type: 'link', href, text });
          seenLinks.add(key);
        }
      }
    }

    diagnostics.push({ signature: domSignature(messageEl), blockCount: blocks.length });
    const textPlain = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { blocks, textPlain, diagnostics };
  }

  async function ensureChatFullyLoaded(rootEl, mode) {
    const start = performance.now();
    const report = {
      mode,
      iterations: 0,
      initialMessageCount: 0,
      finalMessageCount: 0,
      initialScrollHeight: 0,
      finalScrollHeight: 0,
      stabilized: false,
      timingsMs: 0
    };

    if (!rootEl || mode === 'visible') {
      report.timingsMs = Math.round(performance.now() - start);
      return report;
    }

    const initialNodes = collectMessageNodes(rootEl);
    report.initialMessageCount = initialNodes.length;
    report.initialScrollHeight = rootEl.scrollHeight;

    const maxIterations = 30;
    const stableThreshold = 3;
    let stable = 0;
    let previousCount = initialNodes.length;
    let previousHeight = rootEl.scrollHeight;

    for (let i = 0; i < maxIterations; i += 1) {
      report.iterations = i + 1;
      rootEl.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 700));
      const nowCount = collectMessageNodes(rootEl).length;
      const nowHeight = rootEl.scrollHeight;
      if (nowCount > previousCount || nowHeight > previousHeight) {
        stable = 0;
      } else {
        stable += 1;
      }
      previousCount = nowCount;
      previousHeight = nowHeight;
      if (stable >= stableThreshold) break;
    }

    rootEl.scrollTop = rootEl.scrollHeight;
    await new Promise((r) => setTimeout(r, 500));

    // Media lazy-load warmup: scroll through to trigger IntersectionObserver-based lazy loading
    await warmupLazyMedia(rootEl);

    report.finalMessageCount = collectMessageNodes(rootEl).length;
    report.finalScrollHeight = rootEl.scrollHeight;
    report.stabilized = stable >= stableThreshold;
    report.timingsMs = Math.round(performance.now() - start);
    return report;
  }

  /**
   * Slowly scroll through the chat container to trigger lazy-loaded images/media.
   * Many platforms use IntersectionObserver to lazy-load images — this ensures
   * all images are loaded into the DOM before extraction.
   */
  async function warmupLazyMedia(rootEl) {
    if (!rootEl || rootEl.scrollHeight <= rootEl.clientHeight) return;
    const step = Math.max(200, Math.floor(rootEl.clientHeight * 0.8));
    const maxSteps = Math.min(60, Math.ceil(rootEl.scrollHeight / step));

    // Scroll top-to-bottom in steps
    for (let i = 0; i < maxSteps; i++) {
      rootEl.scrollTop = i * step;
      await new Promise((r) => setTimeout(r, 150));
    }
    // Final: scroll to bottom and wait for any pending loads
    rootEl.scrollTop = rootEl.scrollHeight;
    await new Promise((r) => setTimeout(r, 400));

    // Force any lazy images with data-src to load
    rootEl.querySelectorAll('img[data-src]:not([src]), img[loading="lazy"]').forEach((img) => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc && !img.src) img.src = dataSrc;
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  /**
   * normalizeContent: strip UI HTML scaffolding from extracted content.
   * If the string contains HTML tags, parse it and extract semantic text,
   * code blocks, and links. Drop buttons, SVGs, UI-only elements.
   */
  function normalizeContent(content) {
    if (!content || typeof content !== 'string') return content || '';
    // Quick check: does it look like it contains HTML?
    if (!/<[a-z][^>]*>/i.test(content)) return content;
    // Preserve [[IMG:...]] and [[FILE:...]] tokens before parsing
    const imgTokens = [];
    const fileTokens = [];
    let cleaned = content.replace(/\[\[IMG:([^\]]*)\]\]/g, (m) => { imgTokens.push(m); return `__IMG_TOKEN_${imgTokens.length - 1}__`; });
    cleaned = cleaned.replace(/\[\[FILE:([^\]]*)\]\]/g, (m) => { fileTokens.push(m); return `__FILE_TOKEN_${fileTokens.length - 1}__`; });
    // Preserve markdown code blocks
    const codeBlocks = [];
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (m) => { codeBlocks.push(m); return `__CODE_BLOCK_${codeBlocks.length - 1}__`; });

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${cleaned}</div>`, 'text/html');
      const root = doc.body.querySelector('div') || doc.body;

      // Remove UI-only elements
      root.querySelectorAll('button, svg, nav, aside, header, footer, [role="toolbar"], [role="tooltip"], .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
      // Remove "Show more", "Copy", etc. buttons/links
      root.querySelectorAll('*').forEach((el) => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (/^(show more|show less|copy|copied|share|thumbs up|thumbs down)$/i.test(text) && el.children.length === 0) {
          el.remove();
        }
      });

      const parts = [];
      // Extract semantic content
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      const seenCode = new Set();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
          if (text) parts.push(text);
          continue;
        }
        const tag = node.tagName?.toLowerCase();
        if (tag === 'pre' || tag === 'code') {
          const code = (node.textContent || '').trim();
          if (code && !seenCode.has(code)) {
            const langHint = (node.className || '').match(/language-(\w+)/)?.[1] || '';
            parts.push(`\n\`\`\`${langHint}\n${code}\n\`\`\`\n`);
            seenCode.add(code);
          }
        } else if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          const linkText = (node.textContent || '').trim();
          if (href && linkText) parts.push(`[${linkText}](${href})`);
        }
      }

      let result = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();

      // Restore tokens
      result = result.replace(/__IMG_TOKEN_(\d+)__/g, (_, i) => imgTokens[parseInt(i)] || '');
      result = result.replace(/__FILE_TOKEN_(\d+)__/g, (_, i) => fileTokens[parseInt(i)] || '');
      result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)] || '');

      return result;
    } catch {
      // If parsing fails, do a basic regex strip
      let result = content
        .replace(/<(button|svg|nav|aside|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      result = result.replace(/__IMG_TOKEN_(\d+)__/g, (_, i) => imgTokens[parseInt(i)] || '');
      result = result.replace(/__FILE_TOKEN_(\d+)__/g, (_, i) => fileTokens[parseInt(i)] || '');
      result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)] || '');
      return result;
    }
  }

  async function composeContentFromBlocks(blocks, options) {
    const out = [];
    for (const b of blocks) {
      if (b.type === 'text') out.push(b.text);
      else if (b.type === 'code') out.push(`\n\`\`\`\n${b.code}\n\`\`\`\n`);
      else if (b.type === 'list') {
        const lines = b.items.map((it, i) => b.ordered ? `${i + 1}. ${it}` : `- ${it}`);
        out.push(lines.join('\n'));
      }
      else if (b.type === 'quote') out.push(`> ${b.text}`);
      else if (b.type === 'image') {
        // Embed image as base64 when convertImages is enabled
        const src = (options.convertImages && b.src && !b.src.startsWith('data:')) ? await utils.urlToBase64(b.src) : b.src;
        if (src) out.push(`[[IMG:${src}]]`);
      }
      else if (b.type === 'link') out.push(`[${b.text || b.href}](${b.href})`);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function printAnalyzeSummary(analysis) {
    const roleCounts = analysis.messages.reduce((acc, m) => {
      acc[m.inferredRole.role] = (acc[m.inferredRole.role] || 0) + 1;
      return acc;
    }, {});

    const blockStats = analysis.messages.reduce((acc, m) => {
      m.parsed.blocks.forEach((b) => {
        if (b.type === 'code') acc.code += 1;
        if (b.type === 'image') acc.image += 1;
        if (b.type === 'link') acc.link += 1;
      });
      return acc;
    }, { code: 0, image: 0, link: 0 });

    const unknownCount = roleCounts.unknown || 0;
    const unknownRatio = analysis.messages.length ? unknownCount / analysis.messages.length : 1;

    let status = 'PASS';
    let details = 'DOM analysis looks consistent';
    if (!analysis.root.rootEl || analysis.messages.length === 0) {
      status = 'FAIL';
      details = 'No root/message nodes detected';
    } else if (unknownRatio > 0.3) {
      status = 'WARN';
      details = 'Unknown role ratio is high';
    }

    console.log(`[Analyze] root: method=${analysis.root.method} conf=${analysis.root.confidence.toFixed(2)}`);
    console.log(`[Analyze] messages: ${analysis.messages.length} (user=${roleCounts.user || 0} assistant=${roleCounts.assistant || 0} unknown=${roleCounts.unknown || 0})`);
    console.log(`[Analyze] blocks: code=${blockStats.code} images=${blockStats.image} links=${blockStats.link}`);

    const sampled = [...analysis.messages.slice(0, 3), ...analysis.messages.slice(-3)];
    sampled.forEach((m, i) => {
      console.log(`[Analyze] sample#${i + 1}: role=${m.inferredRole.role}/${m.inferredRole.confidence} blocks=${m.parsed.blocks.length} text="${(m.parsed.textPlain || '').slice(0, 120)}"`);
    });

    console.log(`[${status}] ${details}`);
  }

  async function runChatGptDomAnalysis(mode, options, utilsLocal = utils) {
    const root = detectConversationRoot();
    let loadReport = null;
    if (root.rootEl && mode === 'full') {
      loadReport = await ensureChatFullyLoaded(root.rootEl, 'full');
    } else if (root.rootEl) {
      loadReport = await ensureChatFullyLoaded(root.rootEl, 'visible');
    }

    const candidates = root.rootEl ? collectMessageNodes(root.rootEl) : [];
    const messages = [];

    for (const cand of candidates) {
      const inferredRole = inferRole(cand.el, root.rootEl || document.body);
      const parsed = parseMessageContent(cand.el);
      messages.push({
        indexInDom: cand.indexInDom,
        score: cand.score,
        signals: cand.signals,
        inferredRole,
        parsed,
        signature: domSignature(cand.el)
      });
    }

    const analysis = {
      timestamp: new Date().toISOString(),
      mode,
      root,
      loadReport,
      messageCount: messages.length,
      messages
    };

    window[CHATGPT_ANALYSIS_KEY] = analysis;
    printAnalyzeSummary(analysis);
    return analysis;
  }

  async function extractChatData(options) {
    const engine = Object.values(PlatformEngines).find((e) => e.matches());
    if (!engine) return { success: false, platform: 'Unsupported', messages: [] };

    const extracted = await engine.extract(options, utils);
    const messages = utils.dedupe(extracted.messages || []);

    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction Result', details: `${engine.name} found ${messages.length} messages.` });
    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Adaptive Analyzer', details: `Engine=${engine.name}; normalized=${messages.length}` });

    return { success: messages.length > 0, platform: extracted.platform, title: extracted.title, messages };
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

  function discoverClaudeStructure() {
    const findings = {
      timestamp: new Date().toISOString(),
      url: location.href,
      hostname: location.hostname,
      rootCandidates: [],
      messageCandidates: [],
      rolePatterns: [],
      contentSignals: {}
    };

    const roots = Array.from(document.querySelectorAll('main,[role="main"],section,article,div'));
    roots.forEach((el) => {
      const cs = getComputedStyle(el);
      const score = (['auto', 'scroll', 'overlay'].includes(cs.overflowY) ? 2 : 0)
        + Math.min(3, (el.scrollHeight / Math.max(1, el.clientHeight)))
        + Math.min(3, ((el.innerText || '').trim().length / 2000));
      if (score >= 2.5) {
        findings.rootCandidates.push({
          signature: domSignature(el),
          score: Number(score.toFixed(2)),
          childCount: el.childElementCount,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        });
      }
    });

    const selectors = ['[data-testid*="message"]', '[role="article"]', 'main article', 'main section', 'main div'];
    selectors.forEach((selector) => {
      const nodes = Array.from(document.querySelectorAll(selector)).filter((n) => (n.innerText || '').trim().length > 0 || n.querySelector('img,pre,code'));
      if (nodes.length > 1) {
        findings.messageCandidates.push({ selector, count: nodes.length, sample: domSignature(nodes[0]) });
      }
    });

    const sampleNodes = Array.from(document.querySelectorAll('[data-testid*="message"],main article,main section')).slice(0, 30);
    sampleNodes.forEach((node, index) => {
      const marker = `${node.getAttribute('data-testid') || ''} ${node.getAttribute('aria-label') || ''} ${node.className || ''}`.toLowerCase();
      let role = 'unknown';
      const evidence = [];
      if (/user|human/.test(marker)) {
        role = 'user';
        evidence.push('user-marker');
      }
      if (/assistant|claude|model/.test(marker)) {
        role = 'assistant';
        evidence.push('assistant-marker');
      }
      if (node.querySelector('img[alt*="avatar" i], img[alt*="profile" i]')) {
        evidence.push('avatar-image');
      }
      findings.rolePatterns.push({ index, role, evidence, signature: domSignature(node) });
    });

    const container = document.querySelector('main,[role="main"]') || document.body;
    findings.contentSignals = {
      paragraphs: container.querySelectorAll('p').length,
      codeBlocks: container.querySelectorAll('pre,code').length,
      images: container.querySelectorAll('img').length,
      links: container.querySelectorAll('a[href]').length
    };

    window.CLAUDE_DOM_DISCOVERY = findings;
    return findings;
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
    if (request.action === 'analyze_dom') {
      runChatGptDomAnalysis(request.mode === 'full' ? 'full' : 'visible', request.options || {}, utils).then((analysis) => {
        sendResponse({ success: true, messageCount: analysis.messageCount, mode: analysis.mode, key: CHATGPT_ANALYSIS_KEY });
      });
      return true;
    }
    if (request.action === 'discover_claude_structure') {
      const findings = discoverClaudeStructure();
      sendResponse({ success: true, findings });
      return true;
    }
    return false;
  });
})();
