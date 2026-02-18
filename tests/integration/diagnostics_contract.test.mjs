// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = JSON.parse(fs.readFileSync('docs/diagnostics_schema.json', 'utf8'));

test('Diagnostics schema includes mandatory top-level fields', () => {
  const required = schema.required || [];
  const expected = ['runId', 'version', 'host', 'pageUrl', 'timestamp', 'ai', 'extraction', 'assets', 'security', 'learning', 'perf'];
  for (const k of expected) assert.ok(required.includes(k), `missing ${k}`);
});
