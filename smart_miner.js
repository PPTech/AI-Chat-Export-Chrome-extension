// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// smart_miner.js - Visual Mining Engine v0.10.20

(() => {
  if (window.SmartMiner) return;

  class VisualCandidate {
    constructor(el, id) {
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const text = (el.innerText || '').trim();
      const area = Math.max(1, rect.width * rect.height);
      this.id = id;
      this.el = el;
      this.rect = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      };
      this.styles = {
        backgroundColor: styles.backgroundColor,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
        fontFamily: styles.fontFamily
      };
      this.text = text;
      this.textDensity = text.length / area;
      this.isMonospace = /courier|mono|console/i.test(styles.fontFamily || '');
      this.hasIconLikeSvg = !!el.querySelector('svg');
      this.hasImage = !!el.querySelector('img');
      this.hasLink = !!el.querySelector('a[href]');
      this.hasCode = !!el.querySelector('pre,code');
    }
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || '1') <= 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    return r.width >= 200 && r.height >= 20;
  }

  function collectElementsTreeWalker(root = document.body, maxNodes = 9000) {
    const out = [];
    const rootQueue = [root];
    while (rootQueue.length && out.length < maxNodes) {
      const scanRoot = rootQueue.shift();
      if (!scanRoot) continue;
      const walker = document.createTreeWalker(scanRoot, NodeFilter.SHOW_ELEMENT);
      let current = walker.currentNode;
      while (current && out.length < maxNodes) {
        if (current instanceof Element) {
          out.push(current);
          if (current.shadowRoot) rootQueue.push(current.shadowRoot);
        }
        current = walker.nextNode();
      }
    }
    return out;
  }

  function detectMainColumn(candidates) {
    if (!candidates.length) return { left: 0, right: window.innerWidth };
    const bins = new Map();
    for (const c of candidates) {
      const centerX = Math.round(c.rect.left + c.rect.width / 2);
      const bucket = Math.floor(centerX / 80) * 80;
      const current = bins.get(bucket) || 0;
      bins.set(bucket, current + c.text.length);
    }
    let bestBucket = 0;
    let bestScore = -1;
    for (const [bucket, score] of bins.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestBucket = bucket;
      }
    }
    return { left: Math.max(0, bestBucket - 360), right: Math.min(window.innerWidth, bestBucket + 360) };
  }

  function isDarkColor(rgb) {
    const m = String(rgb || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return false;
    const r = Number(m[1]); const g = Number(m[2]); const b = Number(m[3]);
    return (r + g + b) / 3 < 90;
  }

  function scoreCandidate(c, mainBg = '') {
    const center = c.rect.left + c.rect.width / 2;
    const rightAligned = c.rect.right > window.innerWidth * 0.8 || center > window.innerWidth * 0.7;
    const leftAligned = c.rect.left < window.innerWidth * 0.25 || center < window.innerWidth * 0.45;
    const bgDiff = c.styles.backgroundColor !== mainBg;
    let role = 'other';
    let confidence = 0.5;

    if (c.isMonospace || c.hasCode) {
      role = 'code';
      confidence = 0.88 + (isDarkColor(c.styles.backgroundColor) ? 0.07 : 0);
    } else if (rightAligned && bgDiff) {
      role = 'user';
      confidence = 0.78;
    } else if (leftAligned && (c.hasIconLikeSvg || c.text.length > 60)) {
      role = 'model';
      confidence = 0.76;
    } else if (c.textDensity > 0.03) {
      role = leftAligned ? 'model' : (rightAligned ? 'user' : 'other');
      confidence = 0.6;
    }

    return { role, confidence: Math.min(0.99, Math.max(0.05, confidence)) };
  }

  function extractSegments(el) {
    const segments = [];
    const codes = Array.from(el.querySelectorAll('pre code, code'));
    if (codes.length) {
      const firstText = (el.innerText || '').split('\n').slice(0, 2).join('\n').trim();
      if (firstText) segments.push({ type: 'text', content: firstText });
      codes.slice(0, 3).forEach((code) => {
        segments.push({ type: 'code', lang: code.getAttribute('data-language') || 'plain', content: (code.innerText || '').trim() });
      });
      return segments;
    }
    const text = (el.innerText || '').trim();
    if (text) segments.push({ type: 'text', content: text });
    return segments;
  }

  function scanVisiblePage() {
    const elements = collectElementsTreeWalker(document.body, 9000);
    const base = [];
    for (let i = 0; i < elements.length; i += 1) {
      const el = elements[i];
      if (!isVisible(el)) continue;
      base.push(new VisualCandidate(el, `node_${base.length + 1}`));
    }

    const mainColumn = detectMainColumn(base);
    const filtered = base.filter((c) => c.rect.right >= mainColumn.left && c.rect.left <= mainColumn.right);
    const mainBg = getComputedStyle(document.body).backgroundColor;

    const snapshot = filtered
      .sort((a, b) => a.rect.top - b.rect.top)
      .map((c) => {
        const scored = scoreCandidate(c, mainBg);
        const segments = extractSegments(c.el);
        return {
          id: c.id,
          role_guess: scored.role,
          confidence: Number(scored.confidence.toFixed(2)),
          text: c.text.slice(0, 1500),
          content_type: c.hasCode ? 'mixed' : 'text',
          segments,
          geometry: { top: c.rect.top, left: c.rect.left, width: c.rect.width, height: c.rect.height }
        };
      });

    return {
      ts: Date.now(),
      url: location.href,
      mainColumn,
      totalScanned: base.length,
      returned: snapshot.length,
      snapshot
    };
  }

  window.SmartMiner = { VisualCandidate, scanVisiblePage };
  window.extractVisualSnapshot = () => {
    const out = scanVisiblePage();
    console.log('[SmartMiner] Snapshot', { total: out.returned, scanned: out.totalScanned, mainColumn: out.mainColumn });
    console.table(out.snapshot.slice(0, 50).map((x) => ({
      id: x.id,
      role_guess: x.role_guess,
      confidence: x.confidence,
      top: x.geometry.top,
      left: x.geometry.left,
      text: (x.text || '').slice(0, 80)
    })));
    return out.snapshot;
  };
})();
