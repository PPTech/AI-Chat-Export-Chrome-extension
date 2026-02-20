#!/usr/bin/env node
// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// sync_version.cjs — Reads VERSION from lib/version.mjs (SSOT) and updates
// manifest.json, package.json, and all runtime JS file headers.
//
// Usage: node scripts/sync_version.cjs
// Verify: node scripts/verify_version.cjs

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Read SSOT version from lib/version.mjs
const versionSrc = fs.readFileSync(path.join(root, 'lib', 'version.mjs'), 'utf8');
const match = versionSrc.match(/VERSION\s*=\s*'([^']+)'/);
if (!match) {
  console.error('FAIL: VERSION not found in lib/version.mjs');
  process.exit(1);
}
const v = match[1];

// Update JSON files
for (const p of ['manifest.json', 'package.json']) {
  const fp = path.join(root, p);
  if (!fs.existsSync(fp)) continue;
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  j.version = v;
  fs.writeFileSync(fp, `${JSON.stringify(j, null, 2)}\n`);
  console.log(`  Updated ${p} -> ${v}`);
}

// Update version in JS file headers (// ... vX.Y.Z pattern)
const headerFiles = ['script.js', 'background.js', 'content.js'];
const versionLineRegex = /(\/\/\s*[^\n]*?\bv)(\d+\.\d+\.\d+)(\b[^\n]*)/;
for (const file of headerFiles) {
  const fp = path.join(root, file);
  if (!fs.existsSync(fp)) continue;
  const src = fs.readFileSync(fp, 'utf8');
  const next = src.replace(versionLineRegex, `$1${v}$3`);
  if (next !== src) {
    fs.writeFileSync(fp, next);
    console.log(`  Updated ${file} header -> v${v}`);
  }
}

// Update version in index.html (footer version span + about modal version row)
const htmlPath = path.join(root, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  // Footer: <span class="version">v0.x.y</span>
  html = html.replace(/(class="version">v)\d+\.\d+\.\d+/, `$1${v}`);
  // About modal: <span class="about-label">Version</span>0.x.y
  html = html.replace(/(about-label">Version<\/span>)\d+\.\d+\.\d+/, `$1${v}`);
  fs.writeFileSync(htmlPath, html);
  console.log(`  Updated index.html -> v${v}`);
}

console.log(`Synchronized release version: ${v}`);
