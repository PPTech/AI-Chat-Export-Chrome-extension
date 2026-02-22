// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// content.js - Platform Engine Orchestrator v0.12.1

import('./lib/extractors/index.mjs').catch(() => { }); // Hint for IDE

(async () => {
  if (window.hasRunContent) return;
  window.hasRunContent = true;

  // Dynamically load ES modules since content scripts execute as classic scripts
  const modUrl = chrome.runtime.getURL('lib/extractors/index.mjs');
  const extractors = await import(modUrl);
  const { ChatGPT, Claude, Gemini, AIStudio, utils, reportProgress, domSignature, normalizeContent, composeContentFromBlocks } = extractors;

  const CHATGPT_ANALYSIS_KEY = 'CHATGPT_DOM_ANALYSIS';

  const PlatformEngines = {
    chatgpt: ChatGPT,
    claude: Claude,
    gemini: Gemini,
    aistudio: AIStudio
  };

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
        reason: { scrollLike, scrollRatio: Number(scrollRatio.toFixed(2)), textDensity: Number(textDensity.toFixed(2)), codeCount, imgCount, repetition: Number(rep.toFixed(2)), ariaHint }
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

    const chatgptTurns = Array.from(rootEl.querySelectorAll(
      '[data-message-author-role], article[data-testid*="conversation-turn"], [data-testid*="conversation-turn"]'
    )).filter((el) => (el.textContent || '').trim().length > 0);

    if (chatgptTurns.length >= 2) {
      const deduped = [];
      for (const el of chatgptTurns) {
        const alreadyCovered = deduped.some((k) => k.contains(el) || el.contains(k));
        if (alreadyCovered) {
          const parentIdx = deduped.findIndex((k) => k.contains(el));
          if (parentIdx >= 0 && el.hasAttribute('data-message-author-role')) {
            deduped[parentIdx] = el;
          }
          continue;
        }
        deduped.push(el);
      }
      return deduped.map((el, idx) => ({ el, indexInDom: idx, score: 10, signals: ['chatgpt-turn-container'] }));
    }

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

    const authorRole = findAttrUp(messageEl, 'data-message-author-role', 10);
    if (authorRole === 'user') { evidence.push('attr:data-message-author-role=user'); role = 'user'; confidence += 0.5; }
    else if (authorRole === 'assistant') { evidence.push('attr:data-message-author-role=assistant'); role = 'assistant'; confidence += 0.5; }

    const testId = findAttrUp(messageEl, 'data-testid', 10) || '';
    if (/user/i.test(testId)) {
      evidence.push(`testid:${testId}`);
      if (role === 'unknown') role = 'user';
      confidence += 0.3;
    } else if (/assistant|model|response/i.test(testId)) {
      evidence.push(`testid:${testId}`);
      if (role === 'unknown') role = 'assistant';
      confidence += 0.3;
    }

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

    const txt = (messageEl.innerText || '').toLowerCase();
    if (role === 'unknown' && /regenerate|continue generating|thumbs up|thumbs down|copy code/.test(txt)) {
      evidence.push('content:assistant-controls');
      role = 'assistant';
      confidence += 0.15;
    }

    confidence = Math.min(0.99, confidence);
    if (confidence < 0.35) role = 'unknown';

    return { role, confidence: Number(confidence.toFixed(2)), evidence };
  }

  function findAttrUp(el, attr, maxDepth = 3) {
    let current = el;
    for (let i = 0; i <= maxDepth && current; i++) {
      const val = current.getAttribute?.(attr);
      if (val) return val.toLowerCase();
      current = current.parentElement;
    }
    return null;
  }

  async function parseMessageContent(messageEl) {
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

    const fileTokens = await utils.extractFileTokensFromNode(messageEl);
    for (const token of fileTokens) {
      blocks.push({ type: 'file_token', token });
    }

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

    await warmupLazyMedia(rootEl);

    report.finalMessageCount = collectMessageNodes(rootEl).length;
    report.finalScrollHeight = rootEl.scrollHeight;
    report.stabilized = stable >= stableThreshold;
    report.timingsMs = Math.round(performance.now() - start);
    return report;
  }

  async function warmupLazyMedia(rootEl) {
    if (!rootEl || rootEl.scrollHeight <= rootEl.clientHeight) return;
    const step = Math.max(200, Math.floor(rootEl.clientHeight * 0.8));
    const maxSteps = Math.min(60, Math.ceil(rootEl.scrollHeight / step));

    for (let i = 0; i < maxSteps; i++) {
      rootEl.scrollTop = i * step;
      await new Promise((r) => setTimeout(r, 150));
    }
    rootEl.scrollTop = rootEl.scrollHeight;
    await new Promise((r) => setTimeout(r, 400));

    rootEl.querySelectorAll('img[data-src]:not([src]), img[loading="lazy"]').forEach((img) => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc && !img.src) img.src = dataSrc;
    });
    await new Promise((r) => setTimeout(r, 300));
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
      const parsed = await parseMessageContent(cand.el);
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
    reportProgress(10, 'Detecting platform');
    const engine = Object.values(PlatformEngines).find((e) => e.matches());
    if (!engine) {
      reportProgress(100, 'Unsupported platform');
      return { success: false, platform: 'Unsupported', messages: [] };
    }

    reportProgress(20, `Extracting from ${engine.name}`);

    // Pass everything the extractors might need
    const extracted = await engine.extract(options, utils, runChatGptDomAnalysis, composeContentFromBlocks);

    reportProgress(70, 'Normalizing messages');
    const messages = utils.dedupe(extracted.messages || []);

    reportProgress(85, `Found ${messages.length} messages`);
    chrome.runtime.sendMessage({ action: 'LOG_INFO', message: 'Extraction Result', details: `${engine.name} found ${messages.length} messages.` });
    chrome.runtime.sendMessage({ action: 'LOG_INFO', message: 'Adaptive Analyzer', details: `Engine=${engine.name}; normalized=${messages.length}` });

    reportProgress(100, 'Extraction complete');
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
    const maxRounds = 50;
    const stableTarget = 5;
    reportProgress(5, 'Loading full history');
    const timer = setInterval(() => {
      rounds += 1;
      scroller.scrollTop = 0;
      if (Math.abs(scroller.scrollHeight - prev) < 24) stable += 1;
      else stable = 0;
      prev = scroller.scrollHeight;
      const pct = 5 + Math.round((rounds / maxRounds) * 85);
      reportProgress(Math.min(90, pct), `Scrolling (${rounds}/${maxRounds})`, {
        scrollHeight: scroller.scrollHeight,
        stableCount: stable,
        round: rounds
      });
      if (stable >= stableTarget || rounds >= maxRounds) {
        clearInterval(timer);
        reportProgress(95, 'Scroll complete, extracting');
        sendResponse({ status: 'done', rounds, scrollHeight: scroller.scrollHeight });
      }
    }, 1000);
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
    if (request.action === 'ping') {
      sendResponse({ ok: true, ts: Date.now() });
      return true;
    }
    if (request.action === 'FETCH_FILE') {
      (async () => {
        try {
          const resp = await fetch(request.url, { credentials: 'include' });
          if (!resp.ok) { sendResponse({ ok: false, error: `HTTP ${resp.status}` }); return; }
          const blob = await resp.blob();
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1] || '';
            sendResponse({ ok: true, data: base64, mime: blob.type, size: blob.size });
          };
          reader.onerror = () => sendResponse({ ok: false, error: 'FileReader failed' });
          reader.readAsDataURL(blob);
        } catch (e) {
          sendResponse({ ok: false, error: e.message || 'fetch failed' });
        }
      })();
      return true;
    }
    return false;
  });
})();
