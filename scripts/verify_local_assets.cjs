// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const fs = require('fs');
const required = ['lib/transformers.min.js', 'models/minilm-l3-quantized/model.json'];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('Missing required local AI assets:', missing.join(', '));
  process.exit(1);
}
console.log('Local AI assets verified.');
