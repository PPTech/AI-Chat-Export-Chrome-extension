// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// self_heal/loop.mjs - Evidence-gated self-heal loop v0.12.6

import fs from 'node:fs';
import path from 'node:path';

export function runSelfHeal({ baselineScore, candidateScores, maxAttempts = 3 }) {
  let best = baselineScore;
  let improved = false;
  const attempts = [];

  for (let i = 0; i < Math.min(maxAttempts, candidateScores.length); i += 1) {
    const score = candidateScores[i];
    const delta = score - best;
    attempts.push({ attempt: i + 1, score, delta });
    if (score > best) {
      best = score;
      improved = true;
    }
  }

  persistLearning({ best, improved, attempts });
  return { improved, best, attempts };
}

function persistLearning(payload) {
  const dir = path.join(process.cwd(), '.local');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'learning_state.json'), `${JSON.stringify(payload, null, 2)}\n`);
}
