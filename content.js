/**
 * AI Chat Export & Local Agent (Project Aegis)
 * Copyright (C) 2026 [YOUR_COMPANY_NAME_HERE]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/.
 *
 * -------------------------------------------------------------------------
 * COMMERCIAL LICENSE / PROPRIETARY USE:
 * If you wish to use this code in a proprietary software product,
 * enterprise environment, or commercial project where you do not wish to
 * open-source your own code, you MUST purchase a Commercial License from:
 * [INSERT_CONTACT_EMAIL_OR_WEBSITE]
 * -------------------------------------------------------------------------
 */
// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// content.js - Platform Engine Orchestrator v0.12.11

(() => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;
  console.log(`[INJECT] content script active on ${location.href}`);

  const AEGIS_LOGGER = window.AegisLogger || null;
  const SECURITY_GUARD = window.SecurityGuard || null;
  if (SECURITY_GUARD?.installNetworkKillSwitch) {
    try { SECURITY_GUARD.installNetworkKillSwitch(window); } catch (error) { console.warn('[SECURITY] kill-switch setup failed', error?.message || error); }
  }

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

  class AIStudioExtractor {
    constructor(utilsRef, options = {}) {
      this.utils = utilsRef;
      this.options = options;
      this.turnSelectors = [
        'ms-chat-turn',
        'user-query-item',
        'model-response-item',
        '[data-turn-id]',
        '[class*="turn" i]',
        '[class*="chat" i] > article'
      ];
    }

    findAllElements(root, selector) {
      if (!root || !selector) return [];
      let results = [];
      if (root.querySelectorAll) {
        results.push(...Array.from(root.querySelectorAll(selector)));
      }
      const doc = root.ownerDocument || document;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node && node.shadowRoot) {
          results.push(...this.findAllElements(node.shadowRoot, selector));
        }
      }
      return results;
    }

    queryDeep(selector, root = document) {
      return this.findAllElements(root, selector);
    }

    async waitForDom(timeoutMs = 7000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const hasHydration = this.queryDeep('main, ms-chat-turn, [class*="turn" i], [contenteditable="true"], textarea, img').length > 0;
        if (hasHydration) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return false;
    }

    detectRootContainer() {
      const candidates = this.queryDeep('main,section,div,[role="main"]');
      const scored = candidates.map((el) => {
        const cs = getComputedStyle(el);
        const scroll = ['auto', 'scroll', 'overlay'].includes(cs.overflowY) ? 1 : 0;
        const ratio = el.scrollHeight / Math.max(1, el.clientHeight);
        const turnHints = el.querySelectorAll(this.turnSelectors.join(',')).length;
        const text = (el.innerText || '').trim().length;
        const score = (scroll * 2) + Math.min(2.5, ratio) + Math.min(2.5, turnHints / 6) + Math.min(2, text / 5000);
        return { el, score };
      }).sort((a, b) => b.score - a.score);
      return scored[0]?.el || document.querySelector('main') || document.body;
    }

    async blobToBase64(url) {
      try {
        if (!url || !/^blob:|^https?:\/\//i.test(url)) return '';
        const blob = await fetch(url, { credentials: 'include' }).then((r) => r.blob());
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
      } catch {
        return '';
      }
    }

    findSystemInstruction() {
      const labels = this.queryDeep('h1,h2,h3,label,span,div').filter((el) => /system instructions?/i.test((el.textContent || '').trim()));
      for (const label of labels) {
        const host = label.closest('section,div,article') || label.parentElement;
        if (!host) continue;
        const editor = host.querySelector('textarea,.ProseMirror,.cm-content,[contenteditable="true"],div[role="textbox"],pre,code,div');
        const text = (editor?.tagName === 'TEXTAREA' ? editor.value : (editor?.innerText || editor?.textContent || '')).trim();
        if (text && !/system instructions?/i.test(text)) return text;
      }
      return '';
    }

    extractParameters() {
      const params = {};
      const aside = this.queryDeep('aside,[role="complementary"],section[aria-label*="settings" i]')[0] || document.body;
      const labels = Array.from(aside.querySelectorAll('label,span,div')).map((el) => (el.textContent || '').trim()).filter(Boolean);
      const pickValue = (key) => {
        const row = Array.from(aside.querySelectorAll('label,div,li')).find((el) => new RegExp(`^${key}`, 'i').test((el.textContent || '').trim()));
        if (!row) return null;
        const text = (row.textContent || '').replace(/\s+/g, ' ').trim();
        const m = text.match(/(-?\d+(?:\.\d+)?)/);
        return m ? Number(m[1]) : text;
      };
      if (labels.some((t) => /temperature/i.test(t))) params.temperature = pickValue('Temperature');
      if (labels.some((t) => /top\s*k/i.test(t))) params.topK = pickValue('Top K');
      if (labels.some((t) => /top\s*p/i.test(t))) params.topP = pickValue('Top P');
      if (labels.some((t) => /max output tokens/i.test(t))) params.maxOutputTokens = pickValue('Max output tokens');
      return params;
    }

    extractTurnText(turnNode) {
      const textarea = turnNode.querySelector('textarea');
      if (textarea?.value?.trim()) return textarea.value.trim();

      const cmLines = this.queryDeep('.cm-content .cm-line, .cm-line', turnNode)
        .map((line) => (line.textContent || '').replace(/\u00a0/g, ' ').trimEnd());
      const cmText = cmLines.join('\n').trim();
      if (cmText) return cmText;

      const editor = turnNode.querySelector('.ProseMirror,.cm-content,div[role="textbox"],[contenteditable="true"]');
      if (editor) {
        const lines = this.queryDeep('p,div', editor).map((n) => (n.textContent || '').trimEnd()).filter((v) => v.length > 0);
        const joined = lines.join('\n').trim();
        if (joined) return joined;
        const raw = (editor.innerText || editor.textContent || '').trim();
        if (raw) return raw;
      }

      if (turnNode.shadowRoot) {
        const shadowSlots = this.queryDeep('slot,div,p,span', turnNode.shadowRoot)
          .map((n) => (n.textContent || '').trim())
          .filter(Boolean)
          .join('\n')
          .trim();
        if (shadowSlots) return shadowSlots;
      }

      const dataValue = turnNode.getAttribute('data-value') || turnNode.dataset?.value || '';
      if (String(dataValue).trim()) return String(dataValue).trim();

      const staticRender = turnNode.querySelector('[class*="markdown" i],article,section') || turnNode;
      return (staticRender.innerText || staticRender.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    }

    inferTurnRole(turnNode) {
      const header = (turnNode.querySelector('h1,h2,h3,strong,[class*="role" i],[class*="author" i]')?.textContent || turnNode.getAttribute('aria-label') || '').toLowerCase();
      if (/^user|\buser\b|prompt|query/.test(header)) return 'user';
      if (/^model|\bmodel\b|assistant|gemini/.test(header)) return 'model';
      const marker = `${turnNode.className || ''} ${turnNode.tagName}`.toLowerCase();
      if (/user|query/.test(marker)) return 'user';
      if (/model|response|assistant/.test(marker)) return 'model';
      if (turnNode.querySelector('svg[aria-label*="sparkle" i], [aria-label*="model" i]')) return 'model';
      return 'model';
    }

    async extractTurnAttachments(turnNode, role) {
      const attachments = [];
      const images = Array.from(turnNode.querySelectorAll('img')).filter((img) => (img.naturalWidth || img.width || 0) >= 50 || (img.naturalHeight || img.height || 0) >= 50);
      for (const img of images) {
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (!src) continue;
        const data = await this.blobToBase64(src);
        attachments.push({ type: 'image', mime: data.startsWith('data:') ? data.slice(5, data.indexOf(';')) : 'image/*', data: data || src, role });
      }
      const fileChips = Array.from(turnNode.querySelectorAll('a[download], [data-file-name], [class*="chip" i], [class*="attachment" i]'));
      fileChips.forEach((chip) => {
        const name = chip.getAttribute('download') || chip.getAttribute('data-file-name') || (chip.textContent || '').trim();
        if (!name || attachments.some((a) => a.type === 'file' && a.name === name)) return;
        attachments.push({ type: 'file', name });
      });
      return attachments;
    }

    async scrape() {
      await this.waitForDom();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const root = this.detectRootContainer();
      let turnNodes = [];
      for (const selector of this.turnSelectors) {
        const nodes = this.queryDeep(selector, root).filter((n) => this.utils.hasMeaningfulContent(n));
        if (nodes.length > 1) {
          turnNodes = nodes;
          break;
        }
      }
      if (!turnNodes.length) {
        turnNodes = Array.from(root.children || []).filter((n) => this.utils.hasMeaningfulContent(n));
      }

      const turns = [];
      for (const node of turnNodes) {
        try {
          const role = this.inferTurnRole(node);
          const text = this.extractTurnText(node);
          const attachments = await this.extractTurnAttachments(node, role);
          if (text || attachments.length) turns.push({ role, text, attachments });
        } catch (error) {
          console.warn('[AIStudioExtractor] turn parse failed, skipping node', error);
        }
      }

      return {
        metadata: {
          title: document.title || 'AI Studio',
          url: location.href,
          timestamp: new Date().toISOString()
        },
        system_instruction: this.findSystemInstruction(),
        parameters: this.extractParameters(),
        turns
      };
    }
  }

  const PlatformEngines = {
    chatgpt: {
      name: 'ChatGPT',
      matches: () => location.hostname.includes('chatgpt.com') || location.hostname.includes('chat.openai.com'),
      async extract(options, utils) {
        const analysis = await runChatGptDomAnalysis(options.fullLoad ? 'full' : 'visible', options, utils);
        let messages = analysis.messages.map((m) => ({
          role: m.inferredRole.role === 'assistant' ? (location.hostname.includes('chatgpt.com') && /chatgpt\.com\/codex/i.test(location.href) ? 'ChatGPT Codex' : 'ChatGPT') : (m.inferredRole.role === 'user' ? 'User' : 'Unknown'),
          content: composeContentFromBlocks(m.parsed.blocks, options),
          meta: {
            platform: this.name,
            sourceSelector: m.signature,
            confidence: m.inferredRole.confidence,
            evidence: m.inferredRole.evidence
          }
        }));

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
        return { platform: platformName, title: document.title, messages };
      }
    },

    claude: {
      name: 'Claude',
      matches: () => location.hostname.includes('claude.ai'),
      selectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '[data-testid*="message"]', '.font-user-message', '.font-claude-response', '.font-claude-message', '[data-is-streaming-or-done]', 'main article', 'main section'],
      async extract(options, utils) {
        const seed = utils.adaptiveQuery(this.selectors.join(','), 1).filter((n) => !n.closest('nav,aside,header') && utils.hasMeaningfulContent(n));
        const scoped = utils.findClaudeContentNodes(seed);
        const nodes = scoped.length ? scoped : seed;
        const messages = [];
        for (const node of nodes) {
          const marker = `${node.getAttribute('data-testid') || ''} ${node.className || ''} ${node.getAttribute('data-message-author') || ''}`.toLowerCase();
          const isUser = /\buser\b|human/.test(marker);
          const content = await utils.extractNodeContent(node, options, isUser, this.name, 'claude-node');
          if (content) messages.push({ role: isUser ? 'User' : 'Claude', content, meta: { platform: this.name, sourceSelector: 'claude-node' } });
        }
        return { platform: this.name, title: document.title, messages: utils.dedupe(messages) };
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
          const content = composeContentFromBlocks(m.parsed.blocks, options);
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
      async extract(options, utils) {
        const scraper = new AIStudioExtractor(utils, options);
        const scraped = await scraper.scrape();
        const messages = scraped.turns.map((turn, idx) => ({
          role: turn.role === 'user' ? 'User' : 'Model',
          content: [turn.text, ...(turn.attachments || []).map((a) => (a.type === 'image' ? `[[IMG:${a.data}]]` : `[[FILE:${a.name}|${a.name}]]`))].filter(Boolean).join('\n'),
          meta: { platform: this.name, sourceSelector: 'aistudio-extractor', turnIndex: idx, attachmentCount: (turn.attachments || []).length }
        }));
        if (scraped.system_instruction) {
          messages.unshift({
            role: 'System',
            content: scraped.system_instruction,
            meta: { platform: this.name, sourceSelector: 'aistudio-system-instruction' }
          });
        }
        if (Object.keys(scraped.parameters || {}).length) {
          messages.unshift({
            role: 'System',
            content: `AI Studio Parameters:\n${JSON.stringify(scraped.parameters, null, 2)}`,
            meta: { platform: this.name, sourceSelector: 'aistudio-parameters' }
          });
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

    isClaudeUiNoiseText(text = '') {
      const t = String(text || '').trim();
      if (!t) return true;
      if (/grid-rows|transition-colors|group\/status|Nothing to see here|class=|style=/i.test(t)) return true;
      if (t.length < 3) return true;
      return false;
    },

    cleanExtractedText(text = '') {
      return String(text || '')
        .replace(/[\t\u00A0]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !this.isClaudeUiNoiseText(line))
        .join('\n')
        .trim();
    },

    findClaudeContentNodes(seedNodes = []) {
      const hits = [];
      const seen = new Set();
      const selectors = [
        '.prose',
        '[class*="prose"]',
        '[class*="markdown"]',
        '[class*="message-content"]',
        '[class*="whitespace-pre-wrap"]',
        '.font-claude-response',
        '.font-claude-message'
      ];

      for (const seed of seedNodes || []) {
        for (const sel of selectors) {
          const found = Array.from(seed.querySelectorAll(sel));
          found.forEach((el) => {
            if (seen.has(el)) return;
            const textLen = (el.textContent || '').trim().length;
            if (textLen < 20 && !el.querySelector('pre,code,a[href],img')) return;
            if (el.closest('button,[role="button"],nav,aside,header,.group\/status,[class*="transition"], [class*="grid-rows"]')) return;
            seen.add(el);
            hits.push(el);
          });
        }
      }

      return hits.sort((a, b) => (b.textContent || '').trim().length - (a.textContent || '').trim().length);
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
        const attrs = link.getAttributeNames ? link.getAttributeNames() : [];
        const urlHints = attrs
          .filter((name) => /url|href|src|download|file/i.test(name))
          .map((name) => link.getAttribute(name))
          .filter(Boolean);
        const href = link.getAttribute('href') || link.href || link.getAttribute('data-file-url') || link.getAttribute('src') || urlHints[0] || '';
        const srcdoc = link.getAttribute('srcdoc') || '';
        const abs = href ? (() => {
          if (/^sandbox:\/\//i.test(href) || /^sandbox:\//i.test(href)) return href;
          try { return new URL(href, location.href).toString(); } catch { return href || ''; }
        })() : '';
        const inlineDocUrl = srcdoc ? `data:text/html;base64,${btoa(unescape(encodeURIComponent(srcdoc)))}` : '';
        const finalUrl = abs || inlineDocUrl;
        if (!finalUrl) continue;
        const isFileLike = /download|attachment|file|uploads|backend-api\/(files|estuary\/content)|blob:|data:|\/artifact\//i.test(finalUrl)
          || !!link.getAttribute('download')
          || /artifact|download|file/i.test(`${link.getAttribute('aria-label') || ''} ${link.textContent || ''}`);
        if (!isFileLike) continue;
        const nameRaw = link.getAttribute('download') || link.getAttribute('data-artifact-id') || link.getAttribute('data-file-name') || link.textContent || abs.split('/').pop() || (srcdoc ? 'artifact.html' : 'file.bin');
        const safeName = nameRaw.replace(/[\/:*?"<>|]+/g, '_').trim() || 'file.bin';
        tokens.push(`[[FILE:${finalUrl}|${safeName}]]`);
      }

      const markdownLinks = (node.innerText || '').match(/\[[^\]]+\]\((sandbox:\/\/[^)]+|https?:\/\/[^)]+)\)/g) || [];
      markdownLinks.forEach((chunk, idx) => {
        const m = chunk.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (!m) return;
        const safeName = (m[1] || `file_${idx + 1}`).replace(/[\/:*?"<>|]+/g, '_').trim() || `file_${idx + 1}`;
        tokens.push(`[[FILE:${m[2]}|${safeName}]]`);
      });

      return [...new Set(tokens)];
    },

    async extractNodeContent(node, options, isUser, platformName = '', sourceSelector = '') {
      if (!node) return '';
      if (options.rawHtml) return node.innerHTML || '';

      const isClaude = /claude/i.test(String(platformName || '')) || location.hostname.includes('claude.ai');
      const imageTokens = await this.extractImageTokensFromNode(node, options, isUser);
      const fileTokens = options.extractFiles ? await this.extractFileTokensFromNode(node) : [];

      const clone = node.cloneNode(true);
      clone.querySelectorAll('script,style,svg,[role="tooltip"],.sr-only').forEach((n) => n.remove());
      if (isClaude) {
        clone.querySelectorAll('button,[role="button"],[class*="group/status"],[class*="transition"],[class*="grid-rows"],nav,aside,header').forEach((n) => n.remove());
      }
      clone.querySelectorAll('img').forEach((img) => img.remove());

      clone.querySelectorAll('pre').forEach((pre) => {
        const lang = (pre.className.match(/language-([\w-]+)/)?.[1] || '').trim();
        const code = pre.textContent || '';
        pre.replaceWith(`\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
      });

      let text = '';
      if (isClaude) {
        const proseCandidates = this.findClaudeContentNodes([clone]);
        if (proseCandidates.length) {
          text = proseCandidates
            .map((el) => this.cleanExtractedText(el.innerText || el.textContent || ''))
            .filter(Boolean)
            .join('\n\n');
        }
        if (!text) {
          const paras = Array.from(clone.querySelectorAll('p,li,h1,h2,h3,h4,blockquote'))
            .map((el) => this.cleanExtractedText(el.innerText || el.textContent || ''))
            .filter(Boolean);
          text = paras.join('\n');
        }
      }

      if (!text) text = this.cleanExtractedText(clone.innerText || clone.textContent || '');
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

    const rect = messageEl.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();
    const centerMsg = rect.left + rect.width / 2;
    const centerRoot = rootRect.left + rootRect.width / 2;
    const alignmentDelta = centerMsg - centerRoot;
    if (alignmentDelta > rootRect.width * 0.15) {
      evidence.push('layout_alignment:right');
      role = 'user';
      confidence += 0.2;
    } else if (alignmentDelta < -rootRect.width * 0.1) {
      evidence.push('layout_alignment:left');
      role = 'assistant';
      confidence += 0.2;
    } else {
      evidence.push('layout_alignment:center-ish');
    }

    const txt = (messageEl.innerText || '').toLowerCase();
    if (/regenerate|continue generating|thumbs up|thumbs down/.test(txt)) {
      evidence.push('assistant-control-hints');
      role = 'assistant';
      confidence += 0.25;
    }

    if (/you said|you uploaded|you sent/.test(txt) || (messageEl.getAttribute('data-message-author-role') || '').toLowerCase() === 'user') {
      evidence.push('user-hint-text-or-attribute');
      role = 'user';
      confidence += 0.25;
    }

    if (/assistant/.test((messageEl.getAttribute('data-message-author-role') || '').toLowerCase())) {
      evidence.push('assistant-author-attribute');
      role = 'assistant';
      confidence += 0.3;
    }

    confidence = Math.min(0.99, confidence);
    if (confidence < 0.5) role = 'unknown';

    return { role, confidence: Number(confidence.toFixed(2)), evidence };
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

    report.finalMessageCount = collectMessageNodes(rootEl).length;
    report.finalScrollHeight = rootEl.scrollHeight;
    report.stabilized = stable >= stableThreshold;
    report.timingsMs = Math.round(performance.now() - start);
    return report;
  }

  function composeContentFromBlocks(blocks, options) {
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
        const src = options.convertImages ? b.src : b.src;
        out.push(`[[IMG:${src}]]`);
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
    let messages = utils.dedupe(extracted.messages || []);

    if (!messages.length && window.VisualCortexEngine) {
      try {
        const cortex = new window.VisualCortexEngine();
        messages = cortex.extractMessages(document).map((v) => ({
          role: v.role === 'Assistant' ? engine.name : v.role,
          content: v.content,
          meta: { platform: engine.name, sourceSelector: 'visual-cortex-engine', evidence: v.evidence, bbox: v.bbox }
        }));
      } catch {
        // keep empty if visual cortex fails
      }
    } else if (!messages.length && window.VisualDOMWalker) {
      try {
        const walker = new window.VisualDOMWalker();
        const visual = walker.walk(document);
        messages = visual
          .filter((v) => v.tag === 'USER' || v.tag === 'MODEL' || v.tag === 'CODE')
          .map((v) => ({
            role: v.tag === 'USER' ? 'User' : (v.tag === 'MODEL' ? engine.name : `${engine.name} Code`),
            content: v.text,
            meta: { platform: engine.name, sourceSelector: 'visual-dom-walker', evidence: v.evidence }
          }));
      } catch {
        // keep empty if visual fallback fails
      }
    }

    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Extraction Result', details: `${engine.name} found ${messages.length} messages.` });
    chrome.runtime.sendMessage({ action: 'LOG_ERROR', message: 'Adaptive Analyzer', details: `Engine=${engine.name}; normalized=${messages.length}` });

    return { success: messages.length > 0, platform: extracted.platform, title: extracted.title, messages };
  }

  function findScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('main,section,div,[role="main"],[role="log"]')).filter((el) => el.scrollHeight > el.clientHeight + 120);
    if (!candidates.length) return document.scrollingElement || document.documentElement;
    const scored = candidates.map((el) => {
      const rect = el.getBoundingClientRect();
      const area = Math.max(1, rect.width * rect.height);
      const score = (el.scrollHeight / Math.max(1, el.clientHeight)) + Math.min(2, area / (window.innerWidth * window.innerHeight));
      return { el, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0].el;
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

  function discoverClaudeFilePresentation() {
    const findings = {
      timestamp: new Date().toISOString(),
      url: location.href,
      selectorsHit: [],
      foundElements: [],
      summary: { total: 0, linkLike: 0, buttonLike: 0 }
    };

    const add = (source, el, extra = {}) => {
      findings.foundElements.push({
        source,
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 140),
        href: el.getAttribute('href') || '',
        download: el.getAttribute('download') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        className: String(el.className || '').slice(0, 240),
        domPath: buildDomPath(el),
        ...extra
      });
    };

    const selectors = [
      'a[download]',
      'a[href^="blob:"]',
      'a[href*="outputs"]',
      'button[aria-label*="download" i]',
      '[data-download]',
      '[data-file]',
      '[class*="file" i]',
      '[class*="download" i]'
    ];

    selectors.forEach((sel) => {
      const nodes = Array.from(document.querySelectorAll(sel));
      if (!nodes.length) return;
      findings.selectorsHit.push({ selector: sel, count: nodes.length });
      nodes.slice(0, 40).forEach((el) => add('selector-scan', el));
    });

    const root = document.querySelector('main,[role="main"]') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const regex = /sandbox:(?:\/\/)?\/mnt\/data\/[^\s)\]>"']+/gi;
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const txt = textNode.textContent || '';
      const matches = txt.match(regex) || [];
      matches.forEach((match) => {
        add('text-regex', textNode.parentElement || root, { matchedSandboxPath: match });
      });
    }

    findings.summary.total = findings.foundElements.length;
    findings.summary.linkLike = findings.foundElements.filter((e) => !!e.href).length;
    findings.summary.buttonLike = findings.foundElements.filter((e) => e.tag === 'BUTTON').length;
    window.CLAUDE_FILE_DISCOVERY = findings;
    return findings;
  }

  function hashString(input) {
    const str = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return `f${(h >>> 0).toString(16)}`;
  }

  function buildDomPath(el, depth = 5) {
    if (!el || !(el instanceof Element)) return '';
    const parts = [];
    let node = el;
    let steps = 0;
    while (node && steps < depth && node !== document.body) {
      const parent = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((n) => n.tagName === node.tagName);
      const idx = Math.max(1, siblings.indexOf(node) + 1);
      parts.unshift(`${tag}:nth-of-type(${idx})`);
      node = parent;
      steps += 1;
    }
    return parts.join(' > ');
  }

  function canonicalSandboxPath(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    const fixed = raw.replace(/^sandbox:\/\//i, 'sandbox:/');
    if (/^sandbox:\/mnt\/data\//i.test(fixed)) return fixed;
    const m = fixed.match(/\/mnt\/data\/[^\s)\]>"']+/i);
    if (m) return `sandbox:${m[0]}`;
    return '';
  }

  function guessFilename(rawHref, displayText, fallbackId) {
    const path = canonicalSandboxPath(rawHref);
    const fromPath = path ? decodeURIComponent(path.split('/').pop() || '') : '';
    if (fromPath) return fromPath;
    const text = String(displayText || '').trim();
    const textMatch = text.match(/([\w.-]+\.[A-Za-z0-9]{1,8})/);
    if (textMatch) return textMatch[1];
    return `file_${fallbackId}`;
  }

  function createFileRef({ source, rawHref, displayText, sandboxPath, element, pageUrl }) {
    const canonical = canonicalSandboxPath(sandboxPath || rawHref || displayText || '');
    const domPath = element ? buildDomPath(element) : '';
    const idSeed = `${source}|${canonical || rawHref || ''}|${displayText || ''}|${domPath}`;
    const id = hashString(idSeed);
    const filename = guessFilename(rawHref || canonical, displayText, id.slice(-6));
    const extMatch = filename.match(/\.([A-Za-z0-9]{1,8})$/);
    return {
      id,
      source,
      rawHref: rawHref || null,
      displayText: (displayText || '').trim().slice(0, 240),
      sandboxPath: canonical || null,
      filename,
      ext: extMatch ? extMatch[1].toLowerCase() : null,
      foundAt: {
        pageUrl,
        messageIndex: null,
        domPath
      },
      resolved: {
        status: 'unresolved',
        finalUrl: null,
        method: null,
        evidence: []
      },
      download: {
        status: 'pending',
        downloadId: null,
        error: null
      }
    };
  }

  function getRootsDeep(startRoot) {
    const roots = [];
    const stack = [startRoot];
    while (stack.length) {
      const root = stack.pop();
      if (!root) continue;
      roots.push(root);
      const elements = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
      elements.forEach((el) => {
        if (el.shadowRoot) stack.push(el.shadowRoot);
      });
    }
    return roots;
  }

  function queryAllDeep(startRoot, selector) {
    const out = [];
    const roots = getRootsDeep(startRoot);
    roots.forEach((root) => {
      if (!root.querySelectorAll) return;
      out.push(...Array.from(root.querySelectorAll(selector)));
    });
    return out;
  }

  function detectConversationRootForFiles() {
    const candidates = queryAllDeep(document, 'main,section,div,[role="main"],[role="log"],article');
    const scored = candidates.map((el) => {
      const cs = getComputedStyle(el);
      const scroll = ['auto', 'scroll', 'overlay'].includes(cs.overflowY) ? 1 : 0;
      const ratio = el.scrollHeight / Math.max(1, el.clientHeight);
      const textLength = (el.innerText || '').trim().length;
      const descCount = Math.max(1, el.querySelectorAll('*').length);
      const density = textLength / descCount;
      const links = el.querySelectorAll('a[href]').length;
      const code = el.querySelectorAll('pre code').length;
      const imgs = el.querySelectorAll('img').length;
      const score = (scroll * 2) + Math.min(3, ratio) + Math.min(2, density / 35) + Math.min(1.5, links / 12) + Math.min(1.2, code / 5) + Math.min(1.2, imgs / 6);
      return {
        el,
        score,
        evidence: [`scroll:${scroll}`, `ratio:${ratio.toFixed(2)}`, `density:${density.toFixed(2)}`, `links:${links}`, `code:${code}`, `imgs:${imgs}`]
      };
    }).sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < 3.5) {
      return { rootEl: document.body, confidence: 0.3, method: 'fallback-body', evidence: ['no_candidate_confident_enough'] };
    }
    return { rootEl: top.el, confidence: Math.min(0.99, top.score / 8), method: 'score-ranked-root', evidence: top.evidence };
  }

  function discoverSandboxFileRefs(rootEl) {
    const pageUrl = location.href;
    const refs = [];
    const diagnostics = {
      href: location.href,
      rootSignature: rootEl ? buildDomPath(rootEl, 3) : 'body',
      sourceCounts: { anchor: 0, text: 0, button: 0 },
      warnings: []
    };
    const sandboxRegex = /sandbox:(?:\/\/)?\/mnt\/data\/[^\s)\]>"']+/gi;

    const anchors = queryAllDeep(rootEl, 'a');
    anchors.forEach((a) => {
      const rawAttr = a.getAttribute('href') || '';
      const absHref = a.href || '';
      const text = (a.textContent || '').trim();
      const hit = rawAttr.startsWith('sandbox:') || absHref.startsWith('sandbox:')
        || /\/mnt\/data\//i.test(rawAttr) || /\/mnt\/data\//i.test(absHref)
        || /sandbox:(?:\/\/)?\/mnt\/data\//i.test(text);
      if (!hit) return;
      const sandboxPath = canonicalSandboxPath(rawAttr) || canonicalSandboxPath(text) || canonicalSandboxPath(absHref);
      const ref = createFileRef({ source: 'anchor', rawHref: rawAttr || absHref, displayText: text, sandboxPath, element: a, pageUrl });
      ref.rawAttr = rawAttr || null;
      ref.absHref = absHref || null;
      ref.hasClickEl = true;
      ref.resolved.evidence.push('anchor_match');
      if (/^https?:\/\//i.test(rawAttr || absHref)) {
        ref.resolved.status = 'direct';
        ref.resolved.finalUrl = rawAttr || absHref;
        ref.resolved.method = 'direct_href';
        ref.resolved.evidence.push('href_is_http(s)');
      }
      refs.push(ref);
      diagnostics.sourceCounts.anchor += 1;
    });

    const roots = getRootsDeep(rootEl);
    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent || '';
        const matches = text.match(sandboxRegex) || [];
        matches.forEach((match) => {
          const parent = node.parentElement || rootEl;
          const mappedAnchor = parent?.querySelector?.('a[href]') || null;
          const ref = createFileRef({ source: 'text', rawHref: match, displayText: match, sandboxPath: match, element: mappedAnchor || parent, pageUrl });
          ref.hasClickEl = !!mappedAnchor;
          ref.resolved.evidence.push(mappedAnchor ? 'text_mapped_to_anchor' : 'text_regex_match');
          refs.push(ref);
          diagnostics.sourceCounts.text += 1;
        });
      }
    });

    const clickable = queryAllDeep(rootEl, 'button,[role="button"],div[tabindex],a[role="button"]');
    clickable.forEach((el) => {
      const txt = (el.textContent || '').trim();
      const style = getComputedStyle(el);
      const fileish = /\/mnt\/data\/|sandbox:|\.(pdf|xlsx|pptx|zip|png|jpe?g|webp|md|txt|csv|json|py)\b/i.test(txt);
      const maybeClickable = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || style.cursor === 'pointer';
      if (!fileish || !maybeClickable) return;
      const nestedAnchor = el.querySelector('a[href]');
      const rawHref = nestedAnchor?.getAttribute('href') || '';
      const absHref = nestedAnchor?.href || '';
      const sandboxPath = canonicalSandboxPath(txt) || canonicalSandboxPath(rawHref) || canonicalSandboxPath(absHref);
      if (!sandboxPath && !rawHref && !absHref) return;
      const ref = createFileRef({ source: 'button', rawHref: rawHref || absHref, displayText: txt, sandboxPath: sandboxPath || rawHref || absHref, element: nestedAnchor || el, pageUrl });
      ref.rawAttr = rawHref || null;
      ref.absHref = absHref || null;
      ref.hasClickEl = true;
      ref.resolved.evidence.push('button_widget_match');
      refs.push(ref);
      diagnostics.sourceCounts.button += 1;
    });

    const dedupe = new Map();
    refs.forEach((ref) => {
      const key = ref.sandboxPath || `${ref.rawAttr || ref.rawHref || ''}|${ref.absHref || ''}|${ref.displayText || ''}`;
      if (!dedupe.has(key)) dedupe.set(key, ref);
    });

    const normalized = Array.from(dedupe.values());
    if (!normalized.length) diagnostics.warnings.push('no_sandbox_refs_detected');
    window.__SANDBOX_FILE_REFS__ = {
      ts: Date.now(),
      href: location.href,
      refs: normalized,
      diagnostics
    };
    return { refs: normalized, diagnostics };
  }

  function findElementForRef(ref, rootEl) {
    if (ref?.foundAt?.domPath) {
      const path = ref.foundAt.domPath;
      try {
        const byPath = rootEl.querySelector(path);
        if (byPath) return byPath;
      } catch {
        // ignore invalid selector path
      }
    }
    const text = `${ref.sandboxPath || ''} ${ref.filename || ''}`.trim();
    if (!text) return null;
    return queryAllDeep(rootEl, 'a,button,[role="button"],div[tabindex]').find((el) => {
      const t = (el.textContent || '').trim();
      const href = el.getAttribute('href') || '';
      return t.includes(ref.filename) || href.includes(ref.filename) || href.includes(ref.sandboxPath || '');
    }) || null;
  }

  async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sendRuntime(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: chrome.runtime.lastError?.message || 'No response' });
      });
    });
  }

  async function resolveFileRef(fileRef, tabId, rootEl) {
    const ref = JSON.parse(JSON.stringify(fileRef));
    const href = String(ref.rawHref || '').trim();
    if (/^https?:\/\//i.test(href)) {
      ref.resolved.status = 'direct';
      ref.resolved.finalUrl = href;
      ref.resolved.method = 'direct_href';
      ref.resolved.evidence.push('href_is_http(s)');
      return ref;
    }

    const element = findElementForRef(ref, rootEl);
    if (!element) {
      ref.resolved.status = 'failed';
      ref.resolved.method = 'ui_click_only';
      ref.resolved.evidence.push('click_target_not_found');
      return ref;
    }

    const armed = await sendRuntime({ action: 'START_DOWNLOAD_CAPTURE', tabId, expectedFilename: ref.filename, timeoutMs: 10000 });
    ref.resolved.evidence.push('capture_armed');
    const beforeHref = location.href;
    let dispatchResult = false;
    try {
      dispatchResult = element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      if (typeof element.click === 'function') element.click();
    } catch {
      // continue to capture attempt
    }
    ref.resolved.evidence.push(`dispatch_result:${dispatchResult}`);
    await wait(180);
    const captured = await sendRuntime({ action: 'WAIT_DOWNLOAD_CAPTURE', captureId: armed.captureId });
    if (captured?.success && captured.finalUrl) {
      ref.resolved.status = 'dynamic';
      ref.resolved.finalUrl = captured.finalUrl;
      ref.resolved.method = captured.method || 'downloads_api';
      ref.resolved.evidence.push(captured.method === 'webrequest' ? 'webrequest_captured' : 'downloads_api_captured');
      return ref;
    }

    if (location.href !== beforeHref) {
      ref.resolved.evidence.push('tab_navigation_detected');
    }

    ref.resolved.status = 'failed';
    ref.resolved.method = 'ui_click_only';
    ref.resolved.evidence.push('dynamic_resolution_failed');
    return ref;
  }

  async function downloadResolvedFile(fileRef) {
    const ref = JSON.parse(JSON.stringify(fileRef));
    if (!ref.resolved?.finalUrl) {
      ref.download.status = 'failed';
      ref.download.error = 'No resolved finalUrl';
      return ref;
    }
    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: ref.resolved.finalUrl,
          filename: `ai_chat_exporter/${(ref.filename || 'file').replace(/[\/:*?"<>|]+/g, '_')}`,
          saveAs: false
        }, (id) => {
          if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message || 'downloads_api_failed'));
          else resolve(id);
        });
      });
      ref.download.status = 'ok';
      ref.download.downloadId = downloadId;
      return ref;
    } catch (error) {
      try {
        const blob = await fetch(ref.resolved.finalUrl, { credentials: 'include' }).then((r) => r.blob());
        const objectUrl = URL.createObjectURL(blob);
        const downloadId = await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: objectUrl,
            filename: `ai_chat_exporter/${(ref.filename || 'file').replace(/[\/:*?"<>|]+/g, '_')}`,
            saveAs: false
          }, (id) => {
            if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message || 'fetch_blob_failed'));
            else resolve(id);
          });
        });
        ref.download.status = 'ok';
        ref.download.downloadId = downloadId;
        ref.resolved.evidence.push('fetch_blob_fallback');
      } catch (err2) {
        ref.download.status = 'failed';
        ref.download.error = err2.message || error.message;
      }
      return ref;
    }
  }

  async function scanChatGptFileLinks() {
    const supported = /(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|aistudio\.google\.com)$/i.test(location.hostname);
    if (!supported) {
      return { success: false, error: 'Link scanner supports ChatGPT, Claude, Gemini and AI Studio domains only.' };
    }
    const root = detectConversationRootForFiles();
    const scanned = discoverSandboxFileRefs(root.rootEl);
    const refs = scanned.refs;
    window.__CHATGPT_FILE_LINKS__ = refs;
    const summary = {
      total: refs.length,
      sandbox: refs.filter((r) => !!r.sandboxPath).length,
      direct: refs.filter((r) => /^https?:\/\//i.test(r.rawHref || '')).length,
      clickable: refs.filter((r) => !!r.hasClickEl).length,
      anchor: refs.filter((r) => r.source === 'anchor').length,
      text: refs.filter((r) => r.source === 'text').length,
      button: refs.filter((r) => r.source === 'button').length
    };
    console.log(`[SCAN] total=${summary.total} clickable=${summary.clickable} sourceBreakdown anchor=${summary.anchor},text=${summary.text},button=${summary.button}`);
    console.log('[FileScan] root:', root.method, root.confidence, root.evidence, scanned.diagnostics);
    console.table(refs.map((r) => ({ filename: r.filename, sandboxPath: r.sandboxPath, source: r.source, hasClickEl: !!r.hasClickEl, rawAttr: r.rawAttr || '', absHref: r.absHref || '' })));
    return { success: true, root, refs, summary, diagnostics: scanned.diagnostics };
  }

  async function resolveAndDownloadChatGptFileLinks(tabId) {
    const scan = await scanChatGptFileLinks();
    if (!scan.success) return scan;
    const rootEl = scan.root.rootEl || document.body;
    const out = [];
    for (const ref of scan.refs) {
      const resolved = await resolveFileRef(ref, tabId, rootEl);
      const downloaded = await downloadResolvedFile(resolved);
      out.push(downloaded);
      console.log(`[FileJob] ${downloaded.filename} | ${downloaded.resolved.status} | ${downloaded.resolved.method || 'n/a'} | ${downloaded.download.status}`);
      await wait(1200);
    }
    const stats = {
      total: out.length,
      downloaded: out.filter((r) => r.download.status === 'ok').length,
      failed: out.filter((r) => r.download.status === 'failed').length
    };
    const tag = stats.downloaded === stats.total ? 'PASS' : (stats.downloaded > 0 ? 'WARN' : 'FAIL');
    console.log(`[${tag}] downloaded ${stats.downloaded}/${stats.total}`);
    window.__CHATGPT_FILE_LINKS__ = out;
    return { success: true, refs: out, stats };
  }

  function setDebugOverlay(items = [], enabled = false) {
    const id = '__local_agent_overlay__';
    const prev = document.getElementById(id);
    if (prev) prev.remove();
    if (!enabled) return;
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;background:#111;color:#fff;padding:8px 10px;border-radius:8px;max-width:320px;font:12px/1.4 monospace;box-shadow:0 6px 20px rgba(0,0,0,.4)';
    wrap.textContent = `Local Agent Debug\nitems=${items.length}`;
    document.body.appendChild(wrap);
  }


  function computeDomainFingerprint() {
    const root = document.body;
    if (!root) return `${location.hostname}:empty`;
    const sample = Array.from(root.querySelectorAll('main, article, section, div')).slice(0, 120);
    const sig = sample.map((el) => `${el.tagName}:${el.childElementCount}`).join('|');
    let hash = 0;
    for (let i = 0; i < sig.length; i += 1) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
    return `${location.hostname}:${Math.abs(hash)}`;
  }

  function cssPathFor(el) {
    if (!el || !(el instanceof Element)) return '';
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += `#${cur.id}`;
        parts.unshift(part);
        break;
      }
      const idx = cur.parentElement ? Array.from(cur.parentElement.children).indexOf(cur) + 1 : 1;
      part += `:nth-child(${idx})`;
      parts.unshift(part);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function runTextDensityFallback() {
    const scored = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node instanceof Element) {
        const text = (node.innerText || '').trim();
        if (text.length > 40) {
          const rect = node.getBoundingClientRect();
          const area = Math.max(1, rect.width * rect.height);
          const density = text.length / area;
          if (density > 0.003 && rect.width > 200 && rect.height > 20) {
            scored.push({ node, text, density, rect });
          }
        }
      }
      node = walker.nextNode();
    }
    return scored.sort((a, b) => b.density - a.density).slice(0, 25).map((x) => ({
      type: x.rect.left > window.innerWidth * 0.45 ? 'USER_TURN' : 'MODEL_TURN',
      roleGuess: x.rect.left > window.innerWidth * 0.45 ? 'user' : 'model',
      confidence: 0.58,
      bbox: { top: Math.round(x.rect.top), left: Math.round(x.rect.left), width: Math.round(x.rect.width), height: Math.round(x.rect.height) },
      text: x.text.slice(0, 1500),
      href: null,
      src: null,
      evidence: ['text_density_fallback'],
      selector: cssPathFor(x.node)
    }));
  }

  class ExtractionVerifier {
    static verify(items = []) {
      const user = items.filter((i) => i.type === 'USER_TURN').length;
      const model = items.filter((i) => i.type === 'MODEL_TURN').length;
      if (items.length === 0 || (user + model) === 0) {
        return { status: 'FAIL', reason: 'zero_messages', shouldHeal: true };
      }
      if (user === 0 || model === 0) {
        return { status: 'WARN', reason: 'unbalanced_roles', shouldHeal: true };
      }
      return { status: 'PASS', reason: 'balanced', shouldHeal: false };
    }
  }


  function buildRedactedDomSnapshot(limit = 40000) {
    const txt = String(document.body?.innerText || '').replace(/https?:\/\/\S+/g, '[REDACTED_URL]').replace(/[A-Za-z0-9_\-]{24,}/g, '[REDACTED_TOKEN]');
    return txt.slice(0, limit);
  }

  async function runLocalAgentExtract(options = {}) {
    let items = [];
    let root = { method: 'miner_fallback', evidence: [] };
    let candidates = [];
    let clusters = [];
    const domainFingerprint = computeDomainFingerprint();

    try {
      const learned = await sendRuntime({ action: 'LOCAL_GET_RECIPE', payload: { host: location.hostname, domainFingerprint } });
      const selectors = learned?.recipe?.selectors || [];
      if (selectors.length) {
        const recipeItems = [];
        selectors.forEach((sel) => {
          try {
            const nodes = Array.from(document.querySelectorAll(sel)).slice(0, 10);
            nodes.forEach((node) => {
              const rect = node.getBoundingClientRect();
              recipeItems.push({
                type: rect.left > window.innerWidth * 0.45 ? 'USER_TURN' : 'MODEL_TURN',
                roleGuess: rect.left > window.innerWidth * 0.45 ? 'user' : 'model',
                confidence: 0.72,
                bbox: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
                text: (node.innerText || '').trim().slice(0, 1500),
                href: null,
                src: null,
                evidence: ['learned_recipe']
              });
            });
          } catch {
            // ignore malformed selectors
          }
        });
        if (recipeItems.length) {
          items = recipeItems;
          root = { method: 'learned_recipe', evidence: [`selectors=${selectors.length}`] };
        }
      }
    } catch {
      // continue with standard flow
    }

    if (!items.length && window.VisualCortexEngine) {
      try {
        const cortex = new window.VisualCortexEngine();
        const visualMessages = cortex.extractMessages(document).slice(0, 600);
        items = visualMessages.map((entry) => ({
          type: entry.role === 'User' ? 'USER_TURN' : (entry.role === 'Assistant' ? 'MODEL_TURN' : 'CODE_BLOCK'),
          roleGuess: entry.role.toLowerCase(),
          confidence: 0.78,
          bbox: entry.bbox,
          text: entry.content,
          href: null,
          src: null,
          evidence: ['visual_cortex_engine', ...(entry.evidence || [])]
        }));
        if (items.length) root = { method: 'visual_cortex', evidence: [`total=${items.length}`] };
      } catch {
        // continue with existing fallbacks
      }
    }

    if (!items.length && window.SmartAgent) {
      root = window.SmartAgent.detectMainScrollableRoot();
      candidates = window.SmartAgent.getVisualCandidates(root.rootEl, { maxScan: 8000 });
      clusters = window.SmartAgent.clusterCandidatesVertically(candidates);
      items = window.SmartAgent.extractFromCandidates(candidates);
    } else if (!items.length && window.SmartMiner) {
      const snap = window.SmartMiner.scanVisiblePage();
      items = (snap.snapshot || []).map((entry) => ({
        type: entry.role_guess === 'user' ? 'USER_TURN' : (entry.role_guess === 'model' ? 'MODEL_TURN' : (entry.role_guess === 'code' ? 'CODE_BLOCK' : 'NOISE')),
        roleGuess: entry.role_guess,
        confidence: entry.confidence,
        bbox: entry.geometry,
        text: entry.text,
        href: null,
        src: null,
        evidence: ['smart_miner_fallback']
      })).filter((i) => i.type !== 'NOISE');
      root = { method: 'smart_miner_scan', evidence: [`total=${snap.returned}`] };
    } else if (!items.length) {
      return { success: false, error: 'SmartAgent not loaded and SmartMiner fallback unavailable.' };
    }

    const verify = ExtractionVerifier.verify(items);

    try {
      const agentRun = await sendRuntime({
        action: 'RUN_LOCAL_AGENT_ENGINE',
        payload: {
          task: 'extract_messages',
          hostname: location.hostname,
          domainFingerprint,
          pageUrl: location.href,
          candidatesFeatures: items,
          domSnapshot: buildRedactedDomSnapshot(40000),
          extractionGoals: { includeMessages: true, includeImages: true, includeFiles: true },
          requireModel: options?.requireModel !== false
        }
      });
      const learnedItems = agentRun?.bestExtraction?.items || [];
      if (learnedItems.length) {
        items = learnedItems;
        root = { method: 'agent_loop', evidence: [`attempts=${(agentRun?.trace?.attempts || []).length}`, `score=${agentRun?.bestExtraction?.metrics?.score || 0}`] };
      }
      window.__LOCAL_AGENT_TRACE__ = agentRun?.trace || null;
    } catch (error) {
      console.warn('[LOCAL_AGENT] agent loop unavailable', error?.message || error);
    }
    if (verify.shouldHeal) {
      const fallbackItems = runTextDensityFallback();
      const fallbackVerify = ExtractionVerifier.verify(fallbackItems);
      if (fallbackItems.length && fallbackVerify.status !== 'FAIL') {
        items = fallbackItems;
        root = { method: 'text_density_healer', evidence: [verify.reason, 'fallback_success'] };
        const selectors = fallbackItems.map((i) => i.selector).filter(Boolean).slice(0, 10);
        if (selectors.length) {
          sendRuntime({
            action: 'LOCAL_SAVE_RECIPE',
            payload: { host: location.hostname, domainFingerprint, selectors, quality: fallbackVerify.status, notes: 'auto-healed text density fallback' }
          }).catch(() => null);
        }
      }
    }

    const messages = items.filter((i) => i.type === 'USER_TURN' || i.type === 'MODEL_TURN');
    const images = items.filter((i) => i.type === 'IMAGE_BLOCK');
    const files = items.filter((i) => i.type === 'FILE_CARD');
    const result = {
      ts: Date.now(),
      task: 'extract',
      usedMode: 'visual+semantic',
      plan: { root: root.method, candidateCap: 8000 },
      metrics: { candidates: candidates.length, clusters: clusters.length },
      items,
      evidence: root.evidence
    };

    window.__LOCAL_AGENT_STATE__ = {
      ts: Date.now(),
      pageUrl: location.href,
      rootSig: root.method,
      candidatesCount: candidates.length,
      mode: 'visual+semantic',
      diagnostics: root.evidence
    };
    window.__LOCAL_AGENT_RESULT__ = result;

    const diag = {
      url: location.href,
      method: root.method,
      candidates: candidates.length,
      clusters: clusters.length,
      items: items.length,
      messages: messages.length,
      images: images.length,
      files: files.length
    };

    const aiTags = [];
    for (const sample of items.slice(0, 8)) {
      try {
        const cls = await sendRuntime({ action: 'LOCAL_CLASSIFY_TEXT', payload: { text: String(sample.text || '') } });
        aiTags.push({ type: sample.type, text: String(sample.text || '').slice(0, 60), tags: cls?.tags || [], artifacts: cls?.artifacts || [] });
      } catch {
        aiTags.push({ type: sample.type, text: String(sample.text || '').slice(0, 60), tags: ['classifier_unavailable'], artifacts: [] });
      }
    }

    console.log('[LOCAL_AGENT][EXTRACT]', { ...diag, aiTagsCount: aiTags.length });
    console.table(items.slice(0, 80).map((i) => ({ type: i.type, role: i.roleGuess, confidence: i.confidence, text: String(i.text || '').slice(0, 80) })));
    console.table(aiTags);

    setDebugOverlay(items, !!options.debug);
    sendRuntime({ action: 'LOCAL_SAVE_CHAT', payload: { host: location.hostname, title: document.title, payload: { summary: diag, items: items.slice(0, 200) } } }).catch(() => null);
    emitSessionDiagnostics(items).catch(() => null);
    return {
      success: true,
      summary: { messages: messages.length, images: images.length, files: files.length },
      result
    };
  }



  function countMediaEvidenceFromItems(items = []) {
    const imageTypeSet = new Set(['IMAGE_BLOCK', 'IMAGE', 'PHOTO', 'IMG']);
    const fileTypeSet = new Set(['FILE_CARD', 'FILE', 'ATTACHMENT']);
    let imageSignals = 0;
    let fileSignals = 0;

    for (const item of items) {
      const t = String(item?.type || '').toUpperCase();
      const txt = String(item?.text || item?.content || '');
      const href = String(item?.href || item?.url || item?.src || '');

      if (imageTypeSet.has(t)) imageSignals += 1;
      if (fileTypeSet.has(t)) fileSignals += 1;

      if (/\[\[IMG:/i.test(txt) || /!\[[^\]]*\]\((data:image\/|https?:\/\/[^)]+\.(png|jpe?g|webp|gif))/i.test(txt)) imageSignals += 1;
      if (/\[\[FILE:/i.test(txt) || /https?:\/\/[^\s"')]+\.(pdf|docx|xlsx|pptx|zip|csv|txt|json|py|js|md)/i.test(txt)) fileSignals += 1;

      if (/^data:image\//i.test(href) || /^blob:/i.test(href) || /\.(png|jpe?g|webp|gif)$/i.test(href)) imageSignals += 1;
      if (/\.(pdf|docx|xlsx|pptx|zip|csv|txt|json|py|js|md)$/i.test(href) || /^sandbox:\/mnt\/data\//i.test(href)) fileSignals += 1;
    }

    return { imageSignals, fileSignals };
  }

  function collectDomMediaEvidence() {
    const imageDomCount = document.querySelectorAll('img[src], [style*="background-image"]').length;
    const fileDomCount = detectAllFileLinks().length;
    return { imageDomCount, fileDomCount };
  }

  async function runLocalAgentSelfTest(options = {}) {
    const ext = await runLocalAgentExtract(options);
    if (!ext.success) return ext;
    let healed = false;
    let localOnly = false;
    let classifierModel = 'uninitialized';
    try {
      const planner = await sendRuntime({ action: 'RUN_LOCAL_AGENT_ENGINE', payload: { task: 'extract_messages', hostname: location.hostname, pageUrl: location.href, candidatesFeatures: (ext.result?.items || []).slice(0, 30) } });
      healed = !!planner?.recipe;
      const initCls = await sendRuntime({ action: 'LOCAL_INIT_CLASSIFIER', payload: {} });
      localOnly = !!initCls?.ready;
      classifierModel = initCls?.model || 'keyword-fallback';
    } catch {
      healed = false;
    }
    const s = ext.summary;
    const itemEvidence = countMediaEvidenceFromItems(ext.result?.items || []);
    const domEvidence = collectDomMediaEvidence();
    const derivedImages = Math.max(s.images || 0, itemEvidence.imageSignals, domEvidence.imageDomCount > 0 ? 1 : 0);
    const derivedFiles = Math.max(s.files || 0, itemEvidence.fileSignals, domEvidence.fileDomCount > 0 ? 1 : 0);

    const pass = s.messages > 0 && (derivedImages > 0 || derivedFiles > 0);
    const warn = s.messages > 0 && derivedImages === 0 && derivedFiles === 0;

    if (pass) {
      return {
        success: true,
        status: 'PASS',
        details: `Extracted messages=${s.messages}, images=${derivedImages}, files=${derivedFiles}, self-heal=${healed ? 'yes' : 'fallback-only'}, localOnly=${localOnly}, classifier=${classifierModel}`,
        evidence: { summary: s, itemEvidence, domEvidence }
      };
    }
    if (warn) {
      return {
        success: true,
        status: 'WARN',
        details: `Messages detected but no media/files. messages=${s.messages}, images=${derivedImages}, files=${derivedFiles}, self-heal=${healed ? 'yes' : 'fallback-only'}, localOnly=${localOnly}, classifier=${classifierModel}`,
        evidence: { summary: s, itemEvidence, domEvidence }
      };
    }
    return { success: true, status: 'FAIL', details: `No viable candidates found. localOnly=${localOnly}, classifier=${classifierModel}`, evidence: { summary: s, itemEvidence, domEvidence } };
  }

  const ASSET_ALLOWLIST = ['chatgpt.com', 'chat.openai.com', 'oaistatic.com', 'openai.com',
    'oaiusercontent.com', 'claude.ai', 'anthropic.com', 'google.com', 'gstatic.com', 'googleusercontent.com'];

  function isAllowlistedAssetUrl(url) {
    try {
      const u = new URL(url);
      return ASSET_ALLOWLIST.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  async function fetchBlobFromPage(url, gestureToken = "") {
    const clean = String(url || '').trim().replace(/[\]\)>'"\s]+$/g, '');
    let effectiveUrl = clean;

    if (/^sandbox:\/\//i.test(effectiveUrl)) effectiveUrl = effectiveUrl.replace(/^sandbox:\/\//i, 'sandbox:/');

    if (/^sandbox:\//i.test(effectiveUrl)) {
      const refName = (effectiveUrl.split('/').pop() || '').trim();
      const anchors = Array.from(document.querySelectorAll('a[href], [role="link"], button, [role="button"]'));
      for (const a of anchors) {
        const rawHref = a.getAttribute?.('href') || '';
        const absHref = a.href || '';
        const txt = (a.textContent || '').trim();
        if (rawHref.includes(effectiveUrl) || absHref.includes(effectiveUrl) || txt.includes(refName) || rawHref.includes('/mnt/data/') || txt.includes('/mnt/data/')) {
          const candidate = absHref || rawHref;
          if (/^https?:\/\//i.test(candidate) || /^blob:|^data:/i.test(candidate)) {
            effectiveUrl = candidate;
            break;
          }
        }
      }
    }

    if (!gestureToken) return { success: false, error: "missing_gesture_token" };
    if (/^https?:\/\//i.test(effectiveUrl) && !isAllowlistedAssetUrl(effectiveUrl)) {
      return { success: false, error: `host_not_allowlisted:${effectiveUrl}` };
    }
    if (!/^https?:\/\//i.test(effectiveUrl) && !/^blob:|^data:/i.test(effectiveUrl)) {
      return { success: false, error: `Unsupported URL scheme for page fetch: ${effectiveUrl.slice(0, 60)}` };
    }
    try {
      if (/^data:/i.test(effectiveUrl)) {
        return { success: true, dataUrl: effectiveUrl, mime: effectiveUrl.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream', size: effectiveUrl.length };
      }
      const resp = await fetch(effectiveUrl, { credentials: 'include' });
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(blob);
      });
      return { success: true, dataUrl, mime: blob.type || 'application/octet-stream', size: blob.size, sourceUrl: effectiveUrl };
    } catch (error) {
      return { success: false, error: error.message || 'page_fetch_failed' };
    }
  }

  async function emitSessionDiagnostics(items = []) {
    if (!AEGIS_LOGGER?.buildSessionLog) return null;
    try {
      const exportedContent = (items || []).slice(0, 120).map((i) => i?.content || '').join('\n').slice(0, 5000);
      const sessionLog = await AEGIS_LOGGER.buildSessionLog({
        nodesDetected: (items || []).length,
        securityBlocks: SECURITY_GUARD?.metrics?.securityBlocks || 0,
        exportedContent,
        visualElementsCount: (items || []).length
      });
      sendRuntime({ action: 'LOG_ERROR', message: 'AEGIS Session Log', details: JSON.stringify(sessionLog) }).catch(() => null);
      return sessionLog;
    } catch (error) {
      console.warn('[LOGGER] failed to emit session diagnostics', error?.message || error);
      return null;
    }
  }

  function detectAllFileLinks() {
    if (!window.DataProcessor) return [];
    const processor = new window.DataProcessor();
    return processor.detectAllFileReferences(document.body);
  }

  async function runImageExtractionDiagnostic() {
    if (!window.DataProcessor) return { success: false, error: 'DataProcessor unavailable' };
    const processor = new window.DataProcessor();
    const images = processor.extractAllImages(document.body);
    return { success: true, count: images.length, images };
  }

  async function runFileDetectionDiagnostic() {
    if (!window.DataProcessor) return { success: false, error: 'DataProcessor unavailable' };
    const processor = new window.DataProcessor();
    const files = detectAllFileLinks();
    return { success: true, count: files.length, files };
  }

  async function extract_chat_agentic(options = {}) {
    return runLocalAgentExtract({ ...options, mode: 'agentic' });
  }


  function queryDeepPrometheus(root, selector) {
    if (!root || !selector) return [];
    const out = [];
    const seen = new Set();
    const pushAll = (ctx) => {
      if (!ctx?.querySelectorAll) return;
      for (const node of Array.from(ctx.querySelectorAll(selector))) {
        if (seen.has(node)) continue;
        seen.add(node);
        out.push(node);
      }
    };

    pushAll(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node?.shadowRoot) {
        pushAll(node.shadowRoot);
      }
    }
    return out;
  }

  function predictRolePrometheus(element) {
    const rect = element.getBoundingClientRect();
    const right = rect.left > (window.innerWidth * 0.4);
    if (right) return 'USER';
    const hasModelIcon = queryDeepPrometheus(element, 'svg, img[alt*="Gemini" i], [aria-label*="Gemini" i]').length > 0;
    if (!right && hasModelIcon) return 'MODEL';
    return 'UNKNOWN';
  }

  function fallbackTextDensityScan() {
    const candidates = Array.from(document.querySelectorAll('main div, main article, [role="main"] div'))
      .map((el) => ({ el, len: (el.textContent || '').trim().length }))
      .filter((x) => x.len > 60)
      .sort((a, b) => b.len - a.len)
      .slice(0, 12);
    return candidates.map((entry, index) => ({
      role: index % 2 === 0 ? 'MODEL' : 'USER',
      content: (entry.el.textContent || '').replace(/\s+/g, ' ').trim(),
      images: []
    }));
  }

  async function toDataUrlPrometheus(url) {
    if (!url || /^data:/i.test(url)) return String(url || '');
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return '';
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(fr.error || new Error('read_failed'));
        fr.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  }

  async function extractPrometheusVisual() {
    const turnSelectors = [
      'main [data-test-id*="user" i]',
      'main [data-test-id*="model" i]',
      'main article',
      'ms-chat-turn',
      '[data-turn-id]'
    ];

    let turns = [];
    for (const selector of turnSelectors) {
      turns = queryDeepPrometheus(document, selector).filter((el) => (el.textContent || '').trim().length > 0);
      if (turns.length > 0) break;
    }

    const messages = [];
    for (const turn of turns.slice(0, 400)) {
      const role = predictRolePrometheus(turn);
      const cmLines = queryDeepPrometheus(turn, '.cm-content .cm-line, .cm-line').map((n) => (n.textContent || '').trimEnd()).filter(Boolean);
      const proseLines = queryDeepPrometheus(turn, 'p,div,span').map((n) => (n.textContent || '').trim()).filter(Boolean);
      const content = (cmLines.length ? cmLines : proseLines).join('\n').replace(/\n{3,}/g, '\n\n').trim();
      if (!content) continue;
      const imageNodes = queryDeepPrometheus(turn, 'img[src]');
      const images = [];
      for (const img of imageNodes.slice(0, 6)) {
        const src = img.currentSrc || img.getAttribute('src') || '';
        const dataUrl = await toDataUrlPrometheus(src);
        if (dataUrl) images.push(dataUrl);
      }
      messages.push({ role, content, images });
    }

    const finalMessages = messages.length > 0 ? messages : fallbackTextDensityScan();
    return {
      success: true,
      source: location.hostname,
      fallback_used: messages.length === 0,
      messages: finalMessages
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping_content') {
      sendResponse({ injected: true, href: location.href, domain: location.hostname });
      return true;
    }
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
    if (request.action === 'discover_claude_files') {
      const findings = discoverClaudeFilePresentation();
      sendResponse({ success: true, findings });
      return true;
    }
    if (request.action === 'scan_chatgpt_file_links') {
      scanChatGptFileLinks().then(sendResponse);
      return true;
    }
    if (request.action === 'resolve_download_chatgpt_file_links') {
      const tabId = sender?.tab?.id || null;
      resolveAndDownloadChatGptFileLinks(tabId).then(sendResponse);
      return true;
    }
    if (request.action === 'extract_local_agent') {
      runLocalAgentExtract(request.options || {}).then(sendResponse);
      return true;
    }
    if (request.action === 'extract_prometheus_visual') {
      extractPrometheusVisual().then(sendResponse);
      return true;
    }
    if (request.action === 'extract_chat_agentic') {
      extract_chat_agentic(request.options || {}).then(sendResponse);
      return true;
    }
    if (request.action === 'self_test_local_agent') {
      runLocalAgentSelfTest(request.options || {}).then(sendResponse);
      return true;
    }
    if (request.action === 'extract_visual_cortex') {
      if (!window.VisualCortexEngine) {
        sendResponse({ success: false, error: 'VisualCortexEngine unavailable' });
      } else {
        const cortex = new window.VisualCortexEngine();
        const messages = cortex.extractMessages(document);
        const debugLog = cortex.buildDebugLog(messages);
        sendResponse({ success: true, messages, debugLog });
      }
      return true;
    }
    if (request.action === 'build_artifacts_preview') {
      if (!window.ArtifactBuilder) {
        sendResponse({ success: false, error: 'ArtifactBuilder unavailable' });
      } else {
        const html = window.ArtifactBuilder.buildSingleFileHtml({ title: document.title || 'AEGIS Export', bodyHtml: document.body?.innerHTML || '', inlineCss: 'img{max-width:100%;height:auto} body{font-family:Arial,sans-serif;padding:16px}' });
        const mhtml = window.ArtifactBuilder.buildMhtml({ html, resources: [] });
        sendResponse({ success: true, htmlLength: html.length, mhtmlLength: mhtml.length });
      }
      return true;
    }
    if (request.action === 'extract_visual_snapshot') {
      if (!window.extractVisualSnapshot) {
        sendResponse({ success: false, error: 'SmartMiner not loaded.' });
      } else {
        const snapshot = window.extractVisualSnapshot();
        sendResponse({ success: true, count: snapshot.length, snapshot });
      }
      return true;
    }
    if (request.action === 'fetch_blob_page') {
      fetchBlobFromPage(request.url, request.gestureToken || '').then(sendResponse);
      return true;
    }
    if (request.action === 'test_image_extraction') {
      runImageExtractionDiagnostic().then(sendResponse);
      return true;
    }
    if (request.action === 'test_file_detection') {
      runFileDetectionDiagnostic().then(sendResponse);
      return true;
    }
    return false;
  });
})();
