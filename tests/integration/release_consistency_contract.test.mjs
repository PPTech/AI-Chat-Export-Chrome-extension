// License: MIT
// Author: Dr. Babak Sorkhpour (with help of AI)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const versionSrc = fs.readFileSync('lib/version.mjs', 'utf8');
const versionMatch = versionSrc.match(/VERSION\s*=\s*'([^']+)'/);

test('SSOT version exists in lib/version.mjs', () => {
  assert.ok(versionMatch, 'VERSION constant must exist in lib/version.mjs');
});

test('manifest.json version matches SSOT', () => {
  assert.equal(manifest.version, versionMatch[1]);
});

test('Manifest includes Gemini + ChatGPT CDN hosts as optional permissions', () => {
  const optional = manifest.optional_host_permissions || [];
  assert.ok(optional.some((h) => h.includes('lh3.googleusercontent.com')), 'missing lh3.googleusercontent.com');
  assert.ok(optional.some((h) => h.includes('oaiusercontent.com')), 'missing oaiusercontent.com');
  assert.ok(optional.some((h) => h.includes('lh3.google.com')), 'missing lh3.google.com (Gemini redirect)');
});

test('Manifest does NOT duplicate optional hosts in required host_permissions', () => {
  const hosts = manifest.host_permissions || [];
  assert.ok(!hosts.includes('*://*.oaiusercontent.com/*'), 'oaiusercontent should be optional only');
  assert.ok(!hosts.includes('*://*.oaistatic.com/*'), 'oaistatic should be optional only');
});

test('Content scripts match all 4 supported platforms', () => {
  const matches = manifest.content_scripts?.[0]?.matches || [];
  assert.ok(matches.some((m) => m.includes('chatgpt.com')), 'missing chatgpt.com');
  assert.ok(matches.some((m) => m.includes('gemini.google.com')), 'missing gemini.google.com');
  assert.ok(matches.some((m) => m.includes('claude.ai')), 'missing claude.ai');
  assert.ok(matches.some((m) => m.includes('aistudio.google.com')), 'missing aistudio.google.com');
});
