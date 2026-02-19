#!/usr/bin/env node
// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const fs = require('node:fs');

const targets = [
  'tests/fixtures/diagnostics_v3_sample.jsonl'
].filter((p) => fs.existsSync(p));

const badPatterns = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
];

const fails = [];
for (const path of targets) {
  const txt = fs.readFileSync(path, 'utf8');
  for (const re of badPatterns) {
    if (re.test(txt)) fails.push(`${path} matched ${re}`);
  }
}

if (fails.length) {
  console.error('Secret leak patterns detected:\n' + fails.join('\n'));
  process.exit(1);
}

console.log('No secret patterns detected in diagnostics fixtures.');
