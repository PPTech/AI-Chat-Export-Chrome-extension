#!/usr/bin/env node
// License: AGPL-3.0
// verify_version.cjs - CI gate that enforces version SSOT.
// Checks: lib/version.mjs, manifest.json, script.js all agree.
// Exit 1 on mismatch.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 1. Read SSOT version from lib/version.mjs
const versionFile = fs.readFileSync(path.join(ROOT, 'lib', 'version.mjs'), 'utf-8');
const versionMatch = versionFile.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error('[FAIL] Cannot parse VERSION from lib/version.mjs');
  process.exit(1);
}
const ssotVersion = versionMatch[1];
console.log(`[version] SSOT version: ${ssotVersion}`);

let ok = true;

// 2. Check manifest.json
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8'));
if (manifest.version !== ssotVersion) {
  console.error(`[FAIL] manifest.json version "${manifest.version}" !== SSOT "${ssotVersion}"`);
  ok = false;
} else {
  console.log(`[PASS] manifest.json version matches`);
}

// 3. Check script.js header comment
const scriptContent = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf-8');
const scriptVersionMatch = scriptContent.match(/Main Controller v([0-9.]+)/);
if (!scriptVersionMatch || scriptVersionMatch[1] !== ssotVersion) {
  const found = scriptVersionMatch ? scriptVersionMatch[1] : '(not found)';
  console.error(`[FAIL] script.js version "${found}" !== SSOT "${ssotVersion}"`);
  ok = false;
} else {
  console.log(`[PASS] script.js version matches`);
}

// 4. Check content.js header comment
const contentContent = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf-8');
const contentVersionMatch = contentContent.match(/Orchestrator v([0-9.]+)/);
if (!contentVersionMatch || contentVersionMatch[1] !== ssotVersion) {
  const found = contentVersionMatch ? contentVersionMatch[1] : '(not found)';
  console.error(`[FAIL] content.js version "${found}" !== SSOT "${ssotVersion}"`);
  ok = false;
} else {
  console.log(`[PASS] content.js version matches`);
}

// 5. Check background.js header comment
const bgContent = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf-8');
const bgVersionMatch = bgContent.match(/Manager v([0-9.]+)/);
if (!bgVersionMatch || bgVersionMatch[1] !== ssotVersion) {
  const found = bgVersionMatch ? bgVersionMatch[1] : '(not found)';
  console.error(`[FAIL] background.js version "${found}" !== SSOT "${ssotVersion}"`);
  ok = false;
} else {
  console.log(`[PASS] background.js version matches`);
}

if (!ok) {
  console.error('\n[FAIL] Version mismatch detected. Update all files to match lib/version.mjs.');
  process.exit(1);
}

console.log('\n[PASS] All version references match SSOT.');
