// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('VERSION.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));

test('Release versions are synchronized', () => {
  assert.equal(manifest.version, version.version);
  assert.equal(manifest.version, metadata.version);
});

test('Manifest includes critical CDN hosts only as optional permissions (no duplication)', () => {
  const hosts = manifest.host_permissions || [];
  const optional = manifest.optional_host_permissions || [];
  assert.ok(optional.includes('https://*.oaiusercontent.com/*'));
  assert.ok(optional.includes('https://*.oaistatic.com/*'));
  assert.ok(!hosts.includes('https://*.oaiusercontent.com/*'));
  assert.ok(!hosts.includes('https://*.oaistatic.com/*'));
});
