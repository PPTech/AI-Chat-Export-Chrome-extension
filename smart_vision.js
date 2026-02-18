// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// smart_vision.js - AEGIS Visual Cortex v0.11.1

(() => {
  const VISION_VERSION = '0.11.1';

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function roleByGeometry(el, containerBg = '') {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const bg = style.backgroundColor || '';
    const rightAligned = rect.right > window.innerWidth * 0.7;
    const leftAligned = rect.left < window.innerWidth * 0.35;
    const bgDifferent = containerBg && bg && bg !== containerBg;
    const iconHint = !!el.querySelector('svg, [role="img"]');

    // 2026 AI Standard: geometry/style reasoning is used instead of brittle selector classes.
    if (rightAligned || bgDifferent) return { role: 'USER', confidence: 0.72, why: ['right_or_bg_delta'] };
    if (leftAligned || iconHint) return { role: 'MODEL', confidence: 0.68, why: ['left_or_icon_hint'] };
    return { role: 'UNKNOWN', confidence: 0.35, why: ['ambiguous'] };
  }

  function scanTree(root, mode = 'normal') {
    const nodes = [];
    const source = root.querySelectorAll('*');
    const containerBg = getComputedStyle(document.body).backgroundColor || '';

    for (const el of source) {
      if (!isVisible(el)) continue;
      const text = (el.innerText || '').trim();
      if (text.length <= 10) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 200 || rect.height < 24) continue;
      const role = roleByGeometry(el, containerBg);
      nodes.push({
        mode,
        role: role.role,
        confidence: role.confidence,
        why: role.why,
        text,
        bbox: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        nodeRef: el
      });
    }

    // keep top-level likely bubbles
    return nodes.filter((n) => !nodes.some((m) => m !== n && m.nodeRef.contains(n.nodeRef) && m.text.length > n.text.length));
  }

  function deepScanWithShadowDom() {
    const out = [];
    const shadowHosts = document.querySelectorAll('*');
    let breaches = 0;
    for (const host of shadowHosts) {
      if (!host.shadowRoot) continue;
      breaches += 1;
      out.push(...scanTree(host.shadowRoot, 'deep-shadow'));
    }
    return { out, breaches };
  }

  function runVisualCortex() {
    const started = performance.now();
    let detections = scanTree(document, 'normal');
    let shadowDomBreaches = 0;

    // 2026 AI Standard: self-correction auto-escalates to DeepScan when zero extraction occurs.
    if (!detections.length) {
      const deep = deepScanWithShadowDom();
      detections = deep.out;
      shadowDomBreaches = deep.breaches;
    }

    return {
      version: VISION_VERSION,
      durationMs: Math.round(performance.now() - started),
      nodesDetected: detections.length,
      shadowDomBreaches,
      messages: detections.map((d) => ({
        role: d.role,
        confidence: d.confidence,
        text: d.text,
        bbox: d.bbox,
        why: d.why
      }))
    };
  }

  const api = { runVisualCortex, deepScanWithShadowDom, scanTree, roleByGeometry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SmartVision = api;
})();
