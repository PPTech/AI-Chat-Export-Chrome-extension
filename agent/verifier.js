// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/verifier.js - Extraction quality verifier v0.11.0

(function () {
  function verify(items = []) {
    const messages = items.filter((i) => i.type === 'USER_TURN' || i.type === 'MODEL_TURN');
    const userCount = items.filter((i) => i.type === 'USER_TURN').length;
    const modelCount = items.filter((i) => i.type === 'MODEL_TURN').length;
    const attachmentCoverage = items.filter((i) => i.type === 'IMAGE_BLOCK' || i.type === 'FILE_CARD').length / Math.max(1, items.length);
    const dupRate = 1 - (new Set(messages.map((m) => (m.text || '').trim())).size / Math.max(1, messages.length));
    let monotonicOk = 1;
    for (let i = 1; i < messages.length; i += 1) {
      if ((messages[i - 1].bbox?.top || 0) > (messages[i].bbox?.top || 0)) monotonicOk = 0;
    }
    const roleSanity = (userCount > 0 && modelCount > 0) ? 1 : 0;
    const score = (Math.min(1, messages.length / 20) * 0.35)
      + (roleSanity * 0.2)
      + (monotonicOk * 0.15)
      + ((1 - Math.min(1, dupRate)) * 0.15)
      + (Math.min(1, attachmentCoverage * 4) * 0.15);

    return {
      score: Number(score.toFixed(4)),
      messageCount: messages.length,
      roleSanity,
      monotonicOk,
      duplicationRate: Number(dupRate.toFixed(4)),
      attachmentCoverage: Number(attachmentCoverage.toFixed(4)),
      status: score >= 0.6 ? 'PASS' : (score >= 0.45 ? 'WARN' : 'FAIL')
    };
  }

  self.AgentVerifier = { verify };
})();
