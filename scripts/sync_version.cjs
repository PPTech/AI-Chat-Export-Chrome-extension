// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

const fs = require('fs');
const path = require('path');

const versionFile = fs.readFileSync(path.join(process.cwd(), 'version.js'), 'utf8');
const match = versionFile.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!match) throw new Error('APP_VERSION not found in version.js');
const v = match[1];

for (const p of ['manifest.json', 'VERSION.json', 'metadata.json']) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = v;
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}
console.log(`Synchronized release version: ${v}`);
