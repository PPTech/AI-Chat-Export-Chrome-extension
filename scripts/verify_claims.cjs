#!/usr/bin/env node
// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// verify_claims.cjs — Verify that the codebase actually delivers what it claims.
//
// Checks:
// 1. Version SSOT exists and is consistent
// 2. Export pipeline includes diagnostics + manifest artifacts
// 3. FORENSICS/HEAD.txt exists
// 4. No dead-code AI agent files remain

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const claims = [];

// 1. Version SSOT
const versionSrc = fs.readFileSync(path.join(root, 'lib', 'version.mjs'), 'utf8');
const versionMatch = versionSrc.match(/VERSION\s*=\s*'([^']+)'/);
if (!versionMatch) {
  claims.push('VERSION constant missing from lib/version.mjs');
} else {
  const v = versionMatch[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== v) claims.push(`manifest.json version ${manifest.version} != SSOT ${v}`);
}

// 2. Export pipeline forensic artifacts
const scriptSrc = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
for (const token of ['export_bundle_manifest.json', 'diagnostics_summary.json', 'createPopupFlightRecorder']) {
  if (!scriptSrc.includes(token)) claims.push(`script.js missing forensic artifact: ${token}`);
}

// 3. Always-on diagnostics (not gated by debug)
if (scriptSrc.includes('debug ? createPopupFlightRecorder') || scriptSrc.includes('debug ? new')) {
  claims.push('Diagnostics must not be gated by debug flag (always-on requirement)');
}

// 4. Gesture enforcement
if (!scriptSrc.includes('withGesture')) claims.push('withGesture() wrapper missing');
if (!scriptSrc.includes('assertGesture')) claims.push('assertGesture() check missing');
if (!scriptSrc.includes('GESTURE_TTL_MS')) claims.push('GESTURE_TTL_MS constant missing');

// 5. FORENSICS directory
if (!fs.existsSync(path.join(root, 'FORENSICS', 'HEAD.txt'))) {
  claims.push('FORENSICS/HEAD.txt missing');
}

// 6. Dead code check — these directories/files should NOT exist
const deadPaths = [
  'agent/', 'models/', 'ai_engine.js', 'smart_agent.js', 'smart_miner.js',
  'smart_vision.js', 'visual_engine.js', 'visual_walker.js', 'offline_brain.js',
  'offscreen.js', 'offscreen.html'
];
for (const dp of deadPaths) {
  if (fs.existsSync(path.join(root, dp))) {
    claims.push(`Dead code still present: ${dp} (should be removed)`);
  }
}

// 7. Background.js message handler coverage
const bgSrc = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
for (const handler of ['GET_DIAGNOSTICS_JSONL', 'STORE_DIAGNOSTICS', 'VALIDATE_GESTURE']) {
  if (!bgSrc.includes(handler)) claims.push(`background.js missing handler: ${handler}`);
}

if (claims.length) {
  console.error('[verify_claims] FAIL: Claim verification failures:');
  claims.forEach((c) => console.error(`  - ${c}`));
  process.exit(1);
}

console.log(`[verify_claims] PASS: All claims verified for version ${versionMatch[1]}.`);
