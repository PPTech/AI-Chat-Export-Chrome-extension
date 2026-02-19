// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('script.js', 'utf8');

test('Export pipeline does not append internal diagnostics/manifest JSON files to user bundle', () => {
  assert.doesNotMatch(script, /files\.push\(\{ name: `\$\{baseName\}\.diagnostics\.json`/);
  assert.doesNotMatch(script, /files\.push\(\{ name: `\$\{baseName\}\.export_bundle_manifest\.json`/);
});
