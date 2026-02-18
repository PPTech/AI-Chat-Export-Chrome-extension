// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const manifest = readJson('manifest.json');
const version = readJson('VERSION.json');
const metadata = readJson('metadata.json');
const pkg = readJson('package.json');
const versionFile = fs.readFileSync('version.js', 'utf8');
const versionMatch = versionFile.match(/APP_VERSION\s*=\s*'([^']+)'/);
const ssot = versionMatch ? versionMatch[1] : null;

const v = manifest.version;
const problems = [];
if (!ssot) problems.push('APP_VERSION missing in version.js');
if (ssot && ssot !== v) problems.push(`version.js mismatch: ${ssot} != ${v}`);
if (version.version !== v) problems.push(`VERSION.json mismatch: ${version.version} != ${v}`);
if (metadata.version !== v) problems.push(`metadata.json mismatch: ${metadata.version} != ${v}`);
if (pkg.version !== v) problems.push(`package.json mismatch: ${pkg.version} != ${v}`);

const requiredOptionalHosts = ['https://*.oaiusercontent.com/*', 'https://*.oaistatic.com/*'];
for (const h of requiredOptionalHosts) {
  if (!(manifest.optional_host_permissions || []).includes(h)) problems.push(`missing optional host permission ${h}`);
  if ((manifest.host_permissions || []).includes(h)) problems.push(`redundant host permission duplicated in required+optional: ${h}`);
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
for (const file of headerFiles) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/\/\/\s*[^\n]*?\bv(\d+\.\d+\.\d+)\b/);
  if (!m) {
    problems.push(`${file} missing version header marker`);
    continue;
  }
  if (m[1] !== v) problems.push(`${file} header mismatch: ${m[1]} != ${v}`);
}

if (problems.length) {
  console.error('Release consistency check failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`Release consistency check passed for version ${v}.`);
