// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

const fs = require('fs');
const path = require('path');

const versionFile = fs.readFileSync(path.join(process.cwd(), 'version.js'), 'utf8');
const match = versionFile.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!match) throw new Error('APP_VERSION not found in version.js');
const v = match[1];

for (const p of ['manifest.json', 'VERSION.json', 'metadata.json', 'package.json']) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = v;
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}

const headerFiles = [
  'script.js',
  'background.js',
  'content.js',
  'offscreen.js',
  'options.js',
  'ai_engine.js',
  'asset_processor.js',
  'export_manager.js'
];
const versionLineRegex = /(\/\/\s*[^\n]*?\bv)(\d+\.\d+\.\d+)(\b[^\n]*)/;
for (const file of headerFiles) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const next = src.replace(versionLineRegex, `$1${v}$3`);
  if (next !== src) fs.writeFileSync(file, next);
}

console.log(`Synchronized release version: ${v}`);
