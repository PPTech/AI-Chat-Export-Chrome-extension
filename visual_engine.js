// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// visual_engine.js - AEGIS Visual Cortex v0.12.4

(() => {
  if (window.VisualCortexEngine) return;

  class VisualCortexEngine {
    constructor(options = {}) {
      this.options = {
        minTextLength: 6,
        maxNodes: 15000,
        rightThreshold: 0.4,
        iconQuadrantPx: 50,
        ...options
      };
    }

    static isVisible(node) {
      if (!(node instanceof Element)) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    }

    // Geometry heuristic is robust when CSS classes are obfuscated by providers.
    classifyNode(node, bodyBackground) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const text = String(node.innerText || '').trim();
      const evidence = [];
      const rightAligned = rect.left > window.innerWidth * this.options.rightThreshold;
      const leftAligned = rect.left <= window.innerWidth * this.options.rightThreshold;
      const bgDiff = (style.backgroundColor || '') !== bodyBackground;
      const mono = /mono|courier|consolas/i.test(style.fontFamily || '');

      let tag = 'NOISE';
      if (mono && text.length >= this.options.minTextLength) {
        tag = 'CODE_BLOCK';
        evidence.push('mono_font_detected');
      }

      const hasModelIcon = this.hasTopLeftSvg(node, rect);
      if (rightAligned && bgDiff && text.length >= this.options.minTextLength) {
        tag = 'ROLE_USER';
        evidence.push('right_alignment_bg_delta');
      } else if (leftAligned && hasModelIcon && text.length >= this.options.minTextLength) {
        tag = 'ROLE_MODEL';
        evidence.push('left_alignment_svg_icon');
      }

      return {
        tag,
        text,
        bbox: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        evidence
      };
    }

    hasTopLeftSvg(node, nodeRect) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        const el = walker.currentNode;
        if (!(el instanceof SVGElement)) continue;
        const rect = el.getBoundingClientRect();
        const inLeft = rect.left <= nodeRect.left + this.options.iconQuadrantPx;
        const inTop = rect.top <= nodeRect.top + this.options.iconQuadrantPx;
        if (inLeft && inTop) return true;
      }
      return false;
    }

    walkVisibleTree(root = document) {
      const out = [];
      const bodyBackground = getComputedStyle(document.body).backgroundColor;
      const stack = [root];

      while (stack.length && out.length < this.options.maxNodes) {
        const currentRoot = stack.pop();
        const walker = document.createTreeWalker(currentRoot, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode() && out.length < this.options.maxNodes) {
          const node = walker.currentNode;
          if (!(node instanceof Element)) continue;
          if (!VisualCortexEngine.isVisible(node)) continue;

          const entry = this.classifyNode(node, bodyBackground);
          if (entry.tag !== 'NOISE') out.push(entry);

          // Open shadow traversal is required for AI Studio and other web-components.
          if (node.shadowRoot) stack.push(node.shadowRoot);
        }
      }

      out.sort((a, b) => a.bbox.top - b.bbox.top);
      return out;
    }

    extractMessages(root = document) {
      const nodes = this.walkVisibleTree(root);
      return nodes.map((n) => {
        if (n.tag === 'CODE_BLOCK') {
          return { role: 'Code', content: `\n\`\`\`\n${n.text}\n\`\`\``, evidence: n.evidence, bbox: n.bbox };
        }
        const role = n.tag === 'ROLE_USER' ? 'User' : 'Assistant';
        return { role, content: n.text, evidence: n.evidence, bbox: n.bbox };
      });
    }

    buildDebugLog(messages = []) {
      const userTurns = messages.filter((m) => m.role === 'User').length;
      const modelTurns = messages.filter((m) => m.role === 'Assistant').length;
      const warning = userTurns > 0 && modelTurns === 0 ? 'Possible Extraction Failure' : '';
      return {
        generatedAt: new Date().toISOString(),
        scanMetrics: {
          totalHeightScanned: document.documentElement.scrollHeight || 0,
          totalNodesProcessed: messages.length
        },
        heuristicConfidence: `Detected ${userTurns} User blocks based on Right-Alignment`,
        sanityCheck: {
          userTurns,
          modelTurns,
          warning
        }
      };
    }
  }

  window.VisualCortexEngine = VisualCortexEngine;
})();
