// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['content.js', 'background.js', 'smart_vision.js', 'export_core.js'];

test('Legal header exists in required runtime files', () => {
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    assert.match(txt, /AI Chat Export & Local Agent \(Project Aegis\)/, `missing legal header in ${f}`);
    assert.match(txt, /License: MIT/, `missing project MIT ownership header in ${f}`);
  }
});
