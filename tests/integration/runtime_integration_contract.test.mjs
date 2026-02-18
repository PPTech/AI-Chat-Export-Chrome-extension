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
