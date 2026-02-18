// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// visual_walker.js - VisualDOMWalker v0.10.26

(() => {
  if (window.VisualDOMWalker) return;

  class VisualDOMWalker {
    constructor(options = {}) {
      this.options = {
        minTextLength: 5,
        rightThreshold: 0.82,
        leftThreshold: 0.18,
        maxNodes: 12000,
        ...options
      };
    }

    static isVisible(node) {
      if (!node || !(node instanceof Element)) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    classifyNode(node, bodyBackground) {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const text = (node.innerText || '').trim();
      const hasSvg = !!node.querySelector('svg');
      const mono = /mono|courier|consolas/i.test(style.fontFamily || '');

      let tag = 'TEXT';
      const evidence = [];

      if (mono) {
        tag = 'CODE';
        evidence.push('font_monospace');
      }

      const rightAligned = rect.right >= window.innerWidth * this.options.rightThreshold;
      const leftAligned = rect.left <= window.innerWidth * this.options.leftThreshold;
      const bgDiff = (style.backgroundColor || '') !== bodyBackground;

      if (rightAligned && bgDiff) {
        tag = 'USER';
        evidence.push('right_aligned_bg_diff');
      } else if (leftAligned && hasSvg) {
        tag = 'MODEL';
        evidence.push('left_aligned_with_svg');
      }

      return {
        id: `vw_${Math.abs((rect.top * 1000 + rect.left) | 0)}_${text.length}`,
        tag,
        text,
        rect: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        style: {
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          display: style.display
        },
        evidence
      };
    }

    walk(root = document) {
      const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
      const nodes = Array.from(root.querySelectorAll('div')).slice(0, this.options.maxNodes);
      const out = [];

      for (const node of nodes) {
        const text = (node.innerText || '').trim();
        if (text.length <= this.options.minTextLength) continue;
        if (!VisualDOMWalker.isVisible(node)) continue;
        out.push(this.classifyNode(node, bodyBackground));
      }

      out.sort((a, b) => a.rect.top - b.rect.top);
      return out;
    }
  }

  window.VisualDOMWalker = VisualDOMWalker;
})();
