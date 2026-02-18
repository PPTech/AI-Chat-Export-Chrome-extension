// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('script.js', 'utf8');

test('A/B gate: requestExtraction executes self-test and local path before fallback invocation', () => {
  const start = script.indexOf('async function requestExtraction()');
  const end = script.indexOf('function processData', start);
  const chunk = script.slice(start, end);
  assert.match(chunk, /self_test_local_agent/);
  assert.match(chunk, /extract_local_agent/);
  assert.match(chunk, /if \(!selfTest\?\.success \|\| selfTest\?\.status === 'FAIL'\) \{\s*runLegacyFallback\(\)/s);
  assert.match(chunk, /if \(!local\?\.success\) \{\s*runLegacyFallback\(\)/s);
});
