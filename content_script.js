// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// content_script.js - ChatGPT DOM Discovery Analyzer v0.12.14

(() => {
  if (window.ChatGptDomAnalyzer) return;

  const VERSION = '0.12.14';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function safeText(text = '') {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function getTagPath(el) {
    if (!el || !el.tagName) return 'unknown';
    const out = [];
    let cur = el;
    let hop = 0;
    while (cur && cur.tagName && hop < 4) {
      const id = cur.id ? `#${cur.id}` : '';
      out.unshift(`${cur.tagName.toLowerCase()}${id}`);
      cur = cur.parentElement;
      hop += 1;
    }
    return out.join('>');
  }

  function collectNodeStats(root) {
    const stats = { textNodes: 0, textChars: 0, codeNodes: 0, imgNodes: 0, links: 0, descendants: 0 };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = safeText(node.textContent || '');
        if (t.length > 0) {
          stats.textNodes += 1;
          stats.textChars += t.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        stats.descendants += 1;
        const tn = node.tagName?.toLowerCase?.() || '';
        if (tn === 'code' || tn === 'pre') stats.codeNodes += 1;
        if (tn === 'img') stats.imgNodes += 1;
        if (tn === 'a') stats.links += 1;
      }
      node = walker.nextNode();
    }
    return stats;
  }

  function candidateFromEl(el, method) {
    if (!el) return null;
    const stats = collectNodeStats(el);
    const rect = el.getBoundingClientRect();
    const overflowY = getComputedStyle(el).overflowY;
    const scrollable = /(auto|scroll|overlay)/i.test(overflowY) || el.scrollHeight > (el.clientHeight + 80);

    const messageLikeChildren = Array.from(el.children || []).filter((ch) => {
      const t = safeText(ch.textContent || '');
      return t.length > 30 || ch.querySelector('pre code,img,a[href]');
    }).length;

    const repeatRatio = el.children?.length ? (messageLikeChildren / el.children.length) : 0;
    const areaWeight = Math.min(1, ((rect.width * rect.height) / (window.innerWidth * window.innerHeight)) || 0);
    const scrollWeight = scrollable ? 1 : 0;
    const textWeight = Math.min(1, stats.textChars / 4000);
    const mediaWeight = Math.min(1, (stats.codeNodes + stats.imgNodes + stats.links) / 20);
    const confidence = Number((0.35 * scrollWeight + 0.25 * textWeight + 0.2 * repeatRatio + 0.1 * areaWeight + 0.1 * mediaWeight).toFixed(3));

    return {
      el,
      method,
      confidence,
      stats,
      repeatRatio,
      scrollHeight: el.scrollHeight || 0,
      clientHeight: el.clientHeight || 0,
      ariaRole: el.getAttribute('role') || ''
    };
  }

  function detectConversationRoot() {
    const candidates = [];
    const seeded = new Set();

    const ariaSeeds = Array.from(document.querySelectorAll('main,[role="main"],[role="region"],[role="log"]'));
    for (const el of ariaSeeds) {
      const c = candidateFromEl(el, 'aria-root-seed');
      if (c) {
        candidates.push(c);
        seeded.add(el);
      }
    }

    const allEls = Array.from(document.body.querySelectorAll('main,div,section,article'));
    for (const el of allEls) {
      if (seeded.has(el)) continue;
      if ((el.scrollHeight || 0) < 500) continue;
      const c = candidateFromEl(el, 'scroll-container-rank');
      if (c && (c.stats.textChars > 400 || c.stats.codeNodes > 0 || c.stats.imgNodes > 0)) {
        candidates.push(c);
      }
    }

    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.stats.textChars !== a.stats.textChars) return b.stats.textChars - a.stats.textChars;
      return b.scrollHeight - a.scrollHeight;
    });

    const best = candidates[0] || null;
    return {
      rootEl: best?.el || null,
      method: best?.method || 'none',
      confidence: best?.confidence || 0,
      candidates: candidates.slice(0, 10).map((c) => ({
        method: c.method,
        confidence: c.confidence,
        textChars: c.stats.textChars,
        textNodes: c.stats.textNodes,
        codeNodes: c.stats.codeNodes,
        imgNodes: c.stats.imgNodes,
        repeatRatio: c.repeatRatio,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        ariaRole: c.ariaRole,
        signature: getTagPath(c.el)
      }))
    };
  }

  function gatherMessageSignals(el) {
    const signals = [];
    const plainLen = safeText(el.textContent || '').length;
    if (plainLen > 30) signals.push(`text:${plainLen}`);
    if (el.querySelector('pre code')) signals.push('has_code');
    if (el.querySelector('img')) signals.push('has_img');
    if (el.querySelector('button[aria-label*="Copy" i],button[data-testid*="copy" i]')) signals.push('has_copy_button');
    if (el.querySelector('a[href]')) signals.push('has_link');
    if (el.children.length > 1) signals.push(`children:${el.children.length}`);
    return signals;
  }

  function messageScore(el) {
    const t = safeText(el.textContent || '').length;
    const code = el.querySelectorAll('pre code').length;
    const img = el.querySelectorAll('img').length;
    const links = el.querySelectorAll('a[href]').length;
    return Math.min(100, Math.floor(t / 8) + code * 10 + img * 6 + links * 2);
  }

  function dedupeNested(candidates) {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const kept = [];
    for (const cand of sorted) {
      const nested = kept.find((k) => k.el.contains(cand.el) || cand.el.contains(k.el));
      if (!nested) {
        kept.push(cand);
        continue;
      }
      if (cand.score > nested.score && cand.el.contains(nested.el)) {
        const idx = kept.indexOf(nested);
        kept[idx] = cand;
      }
    }
    return kept.sort((a, b) => a.indexInDom - b.indexInDom);
  }

  function collectMessageNodes(rootEl) {
    if (!rootEl) return [];
    const base = [];
    const all = Array.from(rootEl.querySelectorAll('article,div,section,li'));
    all.forEach((el, idx) => {
      const textLen = safeText(el.textContent || '').length;
      const hasCode = !!el.querySelector('pre code');
      const hasImg = !!el.querySelector('img');
      if (textLen < 25 && !hasCode && !hasImg) return;

      const siblingCount = el.parentElement ? el.parentElement.children.length : 0;
      if (siblingCount < 2 && textLen < 120 && !hasCode && !hasImg) return;

      const score = messageScore(el);
      const signals = gatherMessageSignals(el);
      base.push({
        el,
        indexInDom: idx,
        score,
        signals,
        signature: `${getTagPath(el)}|kids:${el.children.length}`
      });
    });

    return dedupeNested(base);
  }

  function inferRole(messageEl) {
    const evidence = [];
    if (!messageEl) return { role: 'unknown', confidence: 0, evidence };

    const rect = messageEl.getBoundingClientRect();
    const center = rect.left + (rect.width / 2);
    const screenCenter = window.innerWidth / 2;
    const delta = center - screenCenter;
    if (delta > 80) evidence.push('layout_alignment:right');
    else if (delta < -80) evidence.push('layout_alignment:left');
    else evidence.push('layout_alignment:center');

    const aria = `${messageEl.getAttribute('aria-label') || ''} ${messageEl.closest('[aria-label]')?.getAttribute('aria-label') || ''}`;
    if (/user|you/i.test(aria)) evidence.push('aria_label_contains_user');
    if (/assistant|chatgpt|model/i.test(aria)) evidence.push('aria_label_contains_assistant');
    if (messageEl.querySelector('button[aria-label*="Regenerate" i],button[data-testid*="regenerate" i]')) evidence.push('has_regenerate_button');
    if (messageEl.querySelector('button[aria-label*="Copy" i],button[data-testid*="copy" i]')) evidence.push('has_copy_button');
    if (messageEl.querySelector('img[alt*="user" i],[data-testid*="user-avatar" i]')) evidence.push('has_user_avatar');

    let userScore = 0;
    let assistantScore = 0;

    evidence.forEach((e) => {
      if (e === 'layout_alignment:right') userScore += 0.35;
      if (e === 'layout_alignment:left') assistantScore += 0.2;
      if (e === 'aria_label_contains_user') userScore += 0.45;
      if (e === 'aria_label_contains_assistant') assistantScore += 0.45;
      if (e === 'has_regenerate_button') assistantScore += 0.35;
      if (e === 'has_copy_button') assistantScore += 0.15;
      if (e === 'has_user_avatar') userScore += 0.35;
    });

    const role = userScore > assistantScore ? 'user' : assistantScore > userScore ? 'assistant' : 'unknown';
    const confidence = Number(Math.max(userScore, assistantScore).toFixed(3));

    if (confidence < 0.35) return { role: 'unknown', confidence, evidence };
    return { role, confidence, evidence };
  }

  function parseMessageContent(messageEl) {
    const blocks = [];
    const diagnostics = { signature: `${getTagPath(messageEl)}|children:${messageEl?.children?.length || 0}`, nodeCount: 0 };
    if (!messageEl) return { blocks, textPlain: '', diagnostics };

    const walker = document.createTreeWalker(messageEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.currentNode;
    const consumedTextParent = new WeakSet();

    while (node) {
      diagnostics.nodeCount += 1;
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        const t = node.textContent || '';
        const normalized = t.replace(/[\t\u00A0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        if (normalized && parent && !consumedTextParent.has(parent) && !parent.closest('pre,code,ul,ol,blockquote,a')) {
          blocks.push({ type: 'text', text: normalized });
          consumedTextParent.add(parent);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toLowerCase();
        if (tag === 'pre') {
          const codeEl = el.querySelector('code') || el;
          blocks.push({ type: 'code', language: (codeEl.className.match(/language-([\w-]+)/)?.[1] || 'plaintext'), text: codeEl.textContent || '' });
        } else if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => safeText(li.textContent || '')).filter(Boolean);
          if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
        } else if (tag === 'blockquote') {
          const quote = safeText(el.textContent || '');
          if (quote) blocks.push({ type: 'quote', text: quote });
        } else if (tag === 'img') {
          blocks.push({ type: 'image', src: el.currentSrc || el.src || '', alt: el.alt || '', width: el.naturalWidth || el.width || 0, height: el.naturalHeight || el.height || 0 });
        } else if (tag === 'a') {
          const href = el.href || '';
          const text = safeText(el.textContent || '');
          if (href) blocks.push({ type: 'link', href, text });
        }
      }
      node = walker.nextNode();
    }

    const textPlain = blocks.filter((b) => b.type === 'text' || b.type === 'quote' || b.type === 'code').map((b) => b.text || '').join('\n\n').trim();
    return { blocks, textPlain, diagnostics };
  }

  async function ensureChatFullyLoaded(rootEl, mode = 'visible') {
    const report = {
      mode,
      iterations: 0,
      initialCount: rootEl ? collectMessageNodes(rootEl).length : 0,
      finalCount: 0,
      stabilized: mode === 'visible',
      timingsMs: []
    };

    if (!rootEl || mode !== 'full') {
      report.finalCount = report.initialCount;
      return report;
    }

    let stableRounds = 0;
    let prevHeight = rootEl.scrollHeight;
    let prevCount = report.initialCount;

    for (let i = 0; i < 3; i += 1) {
      const t0 = performance.now();
      rootEl.scrollTop = 0;
      await sleep(700);
      const nowCount = collectMessageNodes(rootEl).length;
      const nowHeight = rootEl.scrollHeight;
      report.timingsMs.push(Math.round(performance.now() - t0));
      report.iterations += 1;

      if (nowCount <= prevCount && nowHeight <= prevHeight) stableRounds += 1;
      else stableRounds = 0;

      prevCount = nowCount;
      prevHeight = nowHeight;
      if (stableRounds >= 2) break;
    }

    rootEl.scrollTop = rootEl.scrollHeight;
    await sleep(500);
    report.finalCount = collectMessageNodes(rootEl).length;
    report.stabilized = stableRounds >= 2;
    return report;
  }

  function summarizeStatus(report) {
    const unknownRatio = report.messageCount > 0 ? report.roleCounts.unknown / report.messageCount : 1;
    const warnings = [];
    const failures = [];

    if (!report.root.found) failures.push('rootEl null');
    if (report.messageCount === 0) failures.push('messageCount == 0');

    if (unknownRatio > 0.3) warnings.push('unknown role > 30%');
    if (report.loadReport?.mode === 'full' && report.loadReport?.finalCount === report.loadReport?.initialCount && report.root.scrollHeight > 5000) {
      warnings.push('full-load no growth but scrollHeight is large');
    }

    const passCriteria = report.root.confidence >= 0.6 && report.messageCount > 0 && report.roleCounts.user > 0 && report.roleCounts.assistant > 0;
    const status = failures.length ? 'FAIL' : passCriteria ? 'PASS' : 'WARN';
    return { status, warnings, failures };
  }

  function printSummary(report) {
    const { status, warnings, failures } = summarizeStatus(report);
    console.log(`[Analyze] root: method=${report.root.method} conf=${report.root.confidence}`);
    console.log(`[Analyze] messages: ${report.messageCount} (user=${report.roleCounts.user} assistant=${report.roleCounts.assistant} unknown=${report.roleCounts.unknown})`);
    console.log(`[Analyze] blocks: code=${report.blockCounts.code} images=${report.blockCounts.image} links=${report.blockCounts.link}`);
    if (failures.length) console.log(`[FAIL] ${failures.join(' | ')}`);
    else if (warnings.length) console.log(`[WARN] ${warnings.join(' | ')}`);
    else console.log('[PASS] DOM analysis looks consistent');

    const excerpts = [...report.messages.slice(0, 3), ...report.messages.slice(-3)];
    excerpts.forEach((m, idx) => {
      const snippet = (m.textPlain || '').slice(0, 120).replace(/\n/g, ' ');
      console.log(`[Analyze][Excerpt ${idx + 1}] role=${m.role} blocks=${m.blocks.length} :: ${snippet}`);
    });

    return status;
  }

  async function analyze(mode = 'visible') {
    const startedAt = new Date().toISOString();
    const detected = detectConversationRoot();
    const loadReport = await ensureChatFullyLoaded(detected.rootEl, mode);
    const messageNodes = collectMessageNodes(detected.rootEl);

    const messages = messageNodes.map((m, i) => {
      const role = inferRole(m.el);
      const parsed = parseMessageContent(m.el);
      return {
        index: i,
        domIndex: m.indexInDom,
        score: m.score,
        role: role.role,
        roleConfidence: role.confidence,
        roleEvidence: role.evidence,
        signals: m.signals,
        signature: m.signature,
        blocks: parsed.blocks,
        textPlain: parsed.textPlain,
        diagnostics: parsed.diagnostics
      };
    });

    const roleCounts = messages.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, { user: 0, assistant: 0, system: 0, tool: 0, unknown: 0 });

    const blockCounts = messages.flatMap((m) => m.blocks).reduce((acc, b) => {
      acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    }, { text: 0, code: 0, list: 0, quote: 0, image: 0, link: 0 });

    const report = {
      version: VERSION,
      mode,
      startedAt,
      root: {
        found: !!detected.rootEl,
        method: detected.method,
        confidence: detected.confidence,
        candidateCount: detected.candidates.length,
        candidates: detected.candidates,
        scrollHeight: detected.rootEl?.scrollHeight || 0,
        clientHeight: detected.rootEl?.clientHeight || 0
      },
      loadReport,
      messageCount: messages.length,
      roleCounts,
      blockCounts,
      messages
    };

    window.__CHATGPT_DOM_ANALYSIS__ = report;
    const status = printSummary(report);
    return { success: status !== 'FAIL', status, report };
  }

  window.ChatGptDomAnalyzer = {
    VERSION,
    detectConversationRoot,
    collectMessageNodes,
    inferRole,
    parseMessageContent,
    ensureChatFullyLoaded,
    analyze
  };

  chrome.runtime?.onMessage?.addListener((request, _sender, sendResponse) => {
    if (request?.action === 'ANALYZE_CHATGPT_DOM') {
      analyze(request.mode || 'visible')
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, status: 'FAIL', error: err.message || String(err) }));
      return true;
    }
    return false;
  });
})();
