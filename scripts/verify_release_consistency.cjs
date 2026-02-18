// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const fs = require('fs');

function readJson(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }

const manifest = readJson('manifest.json');
const version = readJson('VERSION.json');
const metadata = readJson('metadata.json');

const v = manifest.version;
const problems = [];
if (version.version !== v) problems.push(`VERSION.json mismatch: ${version.version} != ${v}`);
if (metadata.version !== v) problems.push(`metadata.json mismatch: ${metadata.version} != ${v}`);

const requiredHosts = ['https://*.oaiusercontent.com/*', 'https://*.oaistatic.com/*'];
for (const h of requiredHosts) {
  if (!(manifest.host_permissions || []).includes(h)) problems.push(`missing host permission ${h}`);
}

if (problems.length) {
  console.error('Release consistency check failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`Release consistency check passed for version ${v}.`);
