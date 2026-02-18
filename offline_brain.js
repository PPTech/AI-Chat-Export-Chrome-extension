// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// offline_brain.js - AEGIS Local AI Engine v0.11.1

(() => {
  const VERSION = '0.11.1';

  function classifyText(text = '') {
    const t = String(text || '');
    const lower = t.toLowerCase();
    if (/^\s*(system|instruction|policy)\b/i.test(t)) return { label: 'SystemInstruction', score: 0.86 };
    if (/\|.+\|.+\|/.test(t) || /<table|\t/.test(lower)) return { label: 'Table', score: 0.78 };
    if (/```|\b(function|class|def|import|return|const|let|var)\b/.test(t)) return { label: 'Code', score: 0.84 };
    return { label: 'Prose', score: 0.7 };
  }

  function sanitizeCodeBlock(block = {}) {
    if (block.label !== 'Code') return block;
    const text = String(block.text || '');
    if (/```/.test(text) || block.inPreTag) return block;
    return {
      ...block,
      text: `\n\`\`\`\n${text}\n\`\`\`\n`,
      autoWrapped: true
    };
  }

  function analyzeBlocks(blocks = []) {
    return blocks.map((b) => {
      const cls = classifyText(b.text || '');
      return sanitizeCodeBlock({ ...b, ...cls });
    });
  }

  const api = { VERSION, classifyText, analyzeBlocks, sanitizeCodeBlock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.OfflineBrain = api;
})();
