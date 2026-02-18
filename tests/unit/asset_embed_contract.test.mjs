// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('asset_processor.js', 'utf8');

test('DataProcessor exposes real embedImageAsBase64 helper and embedImages uses it', () => {
  assert.match(source, /async embedImageAsBase64\(imageUrl, resolver\)/);
  assert.match(source, /const embedded = await this\.embedImageAsBase64\(src, resolver\)/);
  assert.match(source, /updated = updated\.split\(src\)\.join\(embedded\.base64\)/);
});
