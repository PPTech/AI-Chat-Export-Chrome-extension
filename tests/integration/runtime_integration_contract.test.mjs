// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contentSource = fs.readFileSync('content.js', 'utf8');

test('Content runtime integrates SecurityGuard kill switch and logger session diagnostics', () => {
  assert.match(contentSource, /SECURITY_GUARD\?\.installNetworkKillSwitch/);
  assert.match(contentSource, /AEGIS_LOGGER\?\.buildSessionLog/);
  assert.match(contentSource, /emitSessionDiagnostics\(items\)/);
  assert.match(contentSource, /function detectAllFileLinks\(\)/);
});


test('Self-test reconciles media counts using item and DOM evidence', () => {
  assert.match(contentSource, /function countMediaEvidenceFromItems\(/);
  assert.match(contentSource, /function collectDomMediaEvidence\(/);
  assert.match(contentSource, /const derivedImages = Math\.max\(/);
  assert.match(contentSource, /const derivedFiles = Math\.max\(/);
  assert.match(contentSource, /evidence: \{ summary: s, itemEvidence, domEvidence \}/);
});


test('Claude extractor avoids invalid closest selector usage and uses safe UI chrome detection', () => {
  assert.match(contentSource, /safeClosestAny\(/);
  assert.match(contentSource, /isClaudeUiChromeNode\(/);
  assert.doesNotMatch(contentSource, /\.group\/status/);
});


test('Network policy + gesture proof routes asset fetch through broker', () => {
  const backgroundSource = fs.readFileSync('background.js', 'utf8');
  const manifestSource = fs.readFileSync('manifest.json', 'utf8');
  const scriptSource = fs.readFileSync('script.js', 'utf8');
  assert.match(backgroundSource, /REGISTER_GESTURE_PROOF/);
  assert.match(backgroundSource, /ASSET_FETCH/);
  assert.match(backgroundSource, /NetworkPolicyToolkit/);
  assert.match(scriptSource, /REGISTER_GESTURE_PROOF/);
  assert.match(scriptSource, /action: "ASSET_FETCH"/);
  assert.match(manifestSource, /lh3\.google\.com/);
});
