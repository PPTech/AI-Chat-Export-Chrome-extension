// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const fs = require('fs');
const crypto = require('crypto');

const checksums = JSON.parse(fs.readFileSync('models/minilm-l3-quantized/checksums.json', 'utf8'));
const failures = [];
for (const [file, expected] of Object.entries(checksums.files || {})) {
  if (!fs.existsSync(file)) { failures.push(`missing: ${file}`); continue; }
  const data = fs.readFileSync(file);
  const actual = crypto.createHash('sha256').update(data).digest('hex');
  if (actual !== expected) failures.push(`checksum mismatch: ${file}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Model checksum validation passed.');
