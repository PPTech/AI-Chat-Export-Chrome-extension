// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

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
