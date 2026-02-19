// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('artifact_builder.js', 'utf8');

test('ArtifactBuilder exposes MHTML and single-file HTML primitives', () => {
  assert.match(source, /function buildSingleFileHtml\(/);
  assert.match(source, /function buildMhtml\(/);
  assert.match(source, /multipart\/related/);
  assert.match(source, /stripScriptsAndHandlers/);
});
