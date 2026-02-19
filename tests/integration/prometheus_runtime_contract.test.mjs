// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// prometheus_runtime_contract.test.mjs - Prometheus runtime contracts v0.12.8

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
const content = fs.readFileSync(new URL('../../content.js', import.meta.url), 'utf8');
const background = fs.readFileSync(new URL('../../background.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('Prometheus manifest retains Gemini and AI Studio host access', () => {
  assert.equal(manifest.host_permissions.includes('https://gemini.google.com/*'), true);
  assert.equal(manifest.host_permissions.includes('https://aistudio.google.com/*'), true);
});

test('Content script exposes visual extraction and shadow traversal contract', () => {
  assert.match(content, /function queryDeepPrometheus\(/);
  assert.match(content, /function extractPrometheusVisual\(/);
  assert.match(content, /request\.action === 'extract_prometheus_visual'/);
});

test('Background script exposes Prometheus export route with MHTML generation', () => {
  assert.match(background, /function buildPrometheusMhtml\(/);
  assert.match(background, /case 'RUN_PROMETHEUS_EXPORT'/);
});

test('Popup runtime loads Prometheus bridge and MHTML generator', () => {
  assert.match(indexHtml, /<script src="mhtml_generator\.js"><\/script>/);
  assert.match(indexHtml, /<script src="popup\.js"><\/script>/);
});
