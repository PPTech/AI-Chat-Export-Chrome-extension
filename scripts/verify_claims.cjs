// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const pkg = readJson('package.json');
const requiredScripts = [
  'sync:version',
  'verify:local-assets',
  'verify:model',
  'verify:release',
  'verify:claims',
  'test',
  'gherkin:generate',
  'build'
];

const missingScripts = requiredScripts.filter((name) => !pkg.scripts || !pkg.scripts[name]);

const versionFile = fs.readFileSync('version.js', 'utf8');
const versionMatch = versionFile.match(/APP_VERSION\s*=\s*'([^']+)'/);
const markerMatch = versionFile.match(/version v(\d+\.\d+\.\d+)/i);
const manifest = readJson('manifest.json');
const versionJson = readJson('VERSION.json');
const metadata = readJson('metadata.json');
const packageJson = readJson('package.json');

const claims = [];
if (!versionMatch) claims.push('APP_VERSION missing from version.js');
const appVersion = versionMatch ? versionMatch[1] : '';
if (markerMatch && markerMatch[1] !== appVersion) {
  claims.push(`version.js header marker mismatch: v${markerMatch[1]} != ${appVersion}`);
}
if (manifest.version !== appVersion) claims.push(`manifest version mismatch: ${manifest.version} != ${appVersion}`);
if (versionJson.version !== appVersion) claims.push(`VERSION.json mismatch: ${versionJson.version} != ${appVersion}`);
if (metadata.version !== appVersion) claims.push(`metadata.json mismatch: ${metadata.version} != ${appVersion}`);
if (packageJson.version !== appVersion) claims.push(`package.json mismatch: ${packageJson.version} != ${appVersion}`);

const scriptSource = fs.readFileSync('script.js', 'utf8');
for (const token of ['.diagnostics.json', '.export_bundle_manifest.json', 'bundleManifest']) {
  if (!scriptSource.includes(token)) claims.push(`export forensic artifact hook missing token: ${token}`);
}

if (!fs.existsSync('FORENSICS/HEAD.txt')) {
  claims.push('FORENSICS/HEAD.txt missing');
}

if (missingScripts.length || claims.length) {
  if (missingScripts.length) {
    console.error('Missing package scripts:\n' + missingScripts.join('\n'));
  }
  if (claims.length) {
    console.error('Claim verification failures:\n' + claims.join('\n'));
  }
  process.exit(1);
}

console.log(`Claim verification passed for version ${appVersion}.`);
