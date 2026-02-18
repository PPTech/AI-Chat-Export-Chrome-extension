// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// smart_agent.js - Local Visual + Semantic Agent v0.10.22

(() => {
  if (window.SmartAgent) return;

  const SmartAgentRuntime = {
    visibleSet: new Set(),
    initialized: false,
    io: null,
    mo: null,
    scanCap: 8000
  };

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || '1') <= 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function normalizeColor(v) {
    return String(v || '').replace(/\s+/g, '').toLowerCase();
  }

  function ensureObservers(rootEl = document.body) {
    if (SmartAgentRuntime.initialized || !rootEl) return;

    SmartAgentRuntime.io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (!(el instanceof Element)) continue;
        if (entry.isIntersecting) SmartAgentRuntime.visibleSet.add(el);
        else SmartAgentRuntime.visibleSet.delete(el);
      }
    }, { root: null, threshold: 0.01 });

    const seed = Array.from(rootEl.querySelectorAll('main,article,section,div,[role="article"],[role="listitem"]')).slice(0, 2000);
    seed.forEach((el) => SmartAgentRuntime.io.observe(el));

    SmartAgentRuntime.mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) {
              SmartAgentRuntime.io.observe(n);
              SmartAgentRuntime.visibleSet.add(n);
            }
          });
        }
      }
    });
    SmartAgentRuntime.mo.observe(rootEl, { childList: true, subtree: true });
    SmartAgentRuntime.initialized = true;
  }

  class NodeScorer {
    static calculateProbability(candidate) {
      const text = candidate.textSnippet || '';
      const mono = candidate.signals.monospaceProb > 0.7;
      const codeTokens = (text.match(/[{};]|=>|\b(def|function|class|import|return|const|let|var)\b/g) || []).length;
      const align = candidate.bbox.x + candidate.bbox.w / 2;
      const viewportMid = (window.innerWidth || 1) / 2;
      const rightScore = Math.min(1, Math.max(0, (align - viewportMid) / Math.max(1, viewportMid)));
      const leftScore = Math.min(1, Math.max(0, (viewportMid - align) / Math.max(1, viewportMid)));
      const fileTokenScore = (text.match(/\.(pdf|xlsx|pptx|zip|png|jpe?g|webp|md|txt|csv|json)\b/ig) || []).length;
      const fileish = fileTokenScore > 0 || /(download|attachment|file)/i.test(text) || candidate.signals.hasLink;

      let type = 'NOISE';
      let role = 'unknown';
      let confidence = 0.3;
      const evidence = [];

      if (candidate.signals.hasImg) {
        type = 'IMAGE_BLOCK';
        confidence += 0.35;
        evidence.push('contains_image');
      }
      if (fileish && candidate.signals.clickable) {
        type = 'FILE_CARD';
        confidence += 0.35;
        evidence.push(`file_extension_ratio=${Math.min(1, fileTokenScore / 2).toFixed(2)}`);
      }
      if (mono || codeTokens >= 2 || candidate.signals.hasCode) {
        type = 'CODE_BLOCK';
        confidence = 0.9;
        evidence.push('monospace_font_detected');
      }
      if ((candidate.signals.textDensity > 0.06 || text.length > 40) && type === 'NOISE') {
        type = 'MODEL_TURN';
        confidence += 0.25;
        evidence.push('text_density_or_length');
      }

      if (rightScore > leftScore) {
        role = 'user';
        evidence.push(`right_alignment_score=${rightScore.toFixed(2)}`);
      } else if (leftScore > 0) {
        role = 'model';
        evidence.push(`left_alignment_score=${leftScore.toFixed(2)}`);
      }

      if (type === 'MODEL_TURN' && role === 'user') type = 'USER_TURN';

      return { type, role, confidence: Math.min(0.99, confidence), evidence };
    }

    static scoreNode(candidate) {
      const p = NodeScorer.calculateProbability(candidate);
      return { label: p.type, confidence: p.confidence, features: candidate.signals, evidence: p.evidence, role: p.role };
    }
  }

  class SmartAgent {
    static detectMainScrollableRoot() {
      const all = Array.from(document.querySelectorAll('main,section,article,div,[role="main"],[role="log"]'));
      const scored = all.map((el) => {
        const cs = getComputedStyle(el);
        const scrollable = ['auto', 'scroll', 'overlay'].includes(cs.overflowY) ? 1 : 0;
        const ratio = el.scrollHeight / Math.max(1, el.clientHeight);
        const text = (el.innerText || '').trim().length;
        const rep = el.children.length > 2 ? el.children.length / Math.max(1, new Set(Array.from(el.children).map((c) => c.tagName)).size) : 0;
        const score = (scrollable * 2.5) + Math.min(3, ratio) + Math.min(2.5, text / 4000) + Math.min(2, rep / 2);
        return { el, score };
      }).sort((a, b) => b.score - a.score);
      const top = scored[0];
      if (!top) return { rootEl: document.body, confidence: 0.3, method: 'fallback', evidence: ['no_candidates'] };
      ensureObservers(top.el);
      return { rootEl: top.el, confidence: Math.min(0.99, top.score / 8), method: 'score_ranked', evidence: [`score:${top.score.toFixed(2)}`] };
    }

    static getVisualCandidates(rootEl, options = {}) {
      ensureObservers(rootEl);
      const minW = options.minWidth || 220;
      const minH = options.minHeight || 18;
      const out = [];
      const bodyBg = normalizeColor(getComputedStyle(document.body).backgroundColor);

      const harvest = () => {
        const base = SmartAgentRuntime.visibleSet.size
          ? Array.from(SmartAgentRuntime.visibleSet)
          : Array.from(rootEl.querySelectorAll('*')).slice(0, options.maxScan || SmartAgentRuntime.scanCap);

        const prioritized = base
          .filter((el) => el instanceof Element)
          .sort((a, b) => {
            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            const ac = Math.abs((ar.top + ar.height / 2) - window.innerHeight / 2);
            const bc = Math.abs((br.top + br.height / 2) - window.innerHeight / 2);
            return ac - bc;
          })
          .slice(0, options.maxScan || SmartAgentRuntime.scanCap);

        for (const el of prioritized) {
          if (!isVisible(el)) continue;
          const r = el.getBoundingClientRect();
          const hasMedia = !!el.querySelector('img,video,canvas');
          if (!hasMedia && (r.width < minW || r.height < minH)) continue;
          if (r.bottom < -200 || r.top > window.innerHeight * 2) continue;

          const cs = getComputedStyle(el);
          const text = (el.innerText || '').trim();
          const bg = normalizeColor(cs.backgroundColor);
          const signal = {
            visible: true,
            clickable: cs.cursor === 'pointer' || /button/i.test(el.getAttribute('role') || '') || typeof el.onclick === 'function' || el.tagName === 'A' || el.tagName === 'BUTTON',
            hasImg: !!el.querySelector('img'),
            hasLink: !!el.querySelector('a[href]'),
            hasCode: !!el.querySelector('pre,code'),
            monospaceProb: /mono|consolas|courier/i.test(cs.fontFamily || '') ? 0.9 : 0.1,
            textDensity: text.length / Math.max(1, r.width * r.height),
            repetitionGroupId: `${el.tagName}:${el.classList.length}`,
            repetitionScore: Math.min(1, (el.parentElement?.children?.length || 1) / 10)
          };

          out.push({
            id: `${el.tagName.toLowerCase()}_${out.length}`,
            tag: el.tagName,
            attrsWhitelist: {
              id: el.id || '',
              role: el.getAttribute('role') || '',
              'aria-label': el.getAttribute('aria-label') || '',
              href: el.getAttribute('href') || '',
              src: el.getAttribute('src') || '',
              alt: el.getAttribute('alt') || ''
            },
            textSnippet: text.slice(0, 120),
            domSignature: `${el.tagName.toLowerCase()}:${(el.className || '').toString().split(' ').slice(0, 2).join('.')}`,
            bbox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            style: {
              bg: cs.backgroundColor,
              color: cs.color,
              fontFamily: cs.fontFamily,
              fontSize: cs.fontSize,
              borderRadius: cs.borderRadius,
              boxShadow: cs.boxShadow,
              cursor: cs.cursor,
              display: cs.display
            },
            signals: signal,
            evidence: [bg !== bodyBg ? 'bg_diff_from_body' : 'bg_similar_body', signal.clickable ? 'clickable' : 'not_clickable']
          });
        }
      };

      if (window.requestIdleCallback) {
        requestIdleCallback(harvest, { timeout: 80 });
      } else {
        harvest();
      }
      return out;
    }

    static clusterCandidatesVertically(candidates = []) {
      const sorted = [...candidates].sort((a, b) => a.bbox.y - b.bbox.y);
      const clusters = [];
      for (const c of sorted) {
        const last = clusters[clusters.length - 1];
        if (!last) {
          clusters.push({ items: [c], y: c.bbox.y });
          continue;
        }
        if (Math.abs(c.bbox.y - last.y) <= 36) {
          last.items.push(c);
          last.y = Math.round((last.y + c.bbox.y) / 2);
        } else {
          clusters.push({ items: [c], y: c.bbox.y });
        }
      }
      return clusters;
    }

    static extractFromCandidates(candidates = []) {
      const items = [];
      for (const candidate of candidates) {
        const scored = NodeScorer.scoreNode(candidate);
        if (scored.label === 'NOISE') continue;
        items.push({
          type: scored.label,
          roleGuess: scored.role,
          confidence: scored.confidence,
          bbox: candidate.bbox,
          text: candidate.textSnippet,
          href: candidate.attrsWhitelist.href || null,
          src: candidate.attrsWhitelist.src || null,
          evidence: scored.evidence
        });
      }
      return items;
    }
  }

  window.SmartAgent = SmartAgent;
  window.NodeScorer = NodeScorer;
})();
