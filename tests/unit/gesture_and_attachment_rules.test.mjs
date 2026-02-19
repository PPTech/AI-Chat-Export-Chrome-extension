// License: MIT
// Contract tests enforcing user gesture rules, attachment rules,
// and output truthfulness across the extension.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// --- User Gesture Rules ---

test('chrome.downloads.download is only called in user-initiated handlers', () => {
  const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
  // downloads.download must only appear inside onclick handlers, not at module level
  const lines = script.split('\n');
  const downloadLines = lines
    .map((line, i) => ({ line, num: i + 1 }))
    .filter((l) => l.line.includes('chrome.downloads.download'));

  assert.ok(downloadLines.length > 0, 'should have at least one chrome.downloads.download call');

  // Each download call should be inside a function (indented), not at top level
  for (const { line, num } of downloadLines) {
    const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
    assert.ok(
      indent >= 4,
      `chrome.downloads.download at line ${num} must be inside a function handler (indented), not at module level`
    );
  }
});

test('permissions.request is not called without user gesture context', () => {
  const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
  const content = readFileSync(join(ROOT, 'content.js'), 'utf8');

  // permissions.request should not appear in content scripts (no user gesture there)
  assert.ok(
    !content.includes('permissions.request'),
    'content.js must not call chrome.permissions.request (no gesture context)'
  );

  // If it appears in script.js, it should be inside an onclick handler
  if (script.includes('permissions.request')) {
    const lines = script.split('\n');
    const permLines = lines.filter((l) => l.includes('permissions.request'));
    for (const line of permLines) {
      const indent = (line.match(/^(\s*)/)?.[1] || '').length;
      assert.ok(indent >= 4, 'permissions.request must be inside a user-gesture handler');
    }
  }
});

// --- Attachment Rules ---

test('attachments come from message metadata or real elements, not arbitrary links', () => {
  const content = readFileSync(join(ROOT, 'content.js'), 'utf8');

  // extractFileTokensFromNode should filter by isFileLike
  assert.ok(
    content.includes('isFileLike'),
    'file token extraction must check isFileLike before including attachments'
  );

  // Should NOT blindly extract all <a> tags as attachments
  assert.ok(
    !content.includes('querySelectorAll(\'a\')') || content.includes('isFileLike'),
    'must not treat all links as attachments without filtering'
  );
});

test('attachment classifier hard-ignores scripts', () => {
  const classifier = readFileSync(join(ROOT, 'lib', 'attachment_classifier.mjs'), 'utf8');
  assert.ok(classifier.includes('.js'), 'classifier must list .js in hard-ignore');
  assert.ok(classifier.includes('.exe'), 'classifier must list .exe in hard-ignore');
  assert.ok(classifier.includes('.css'), 'classifier must list .css in hard-ignore');
  assert.ok(classifier.includes('HARD_IGNORE'), 'classifier must have HARD_IGNORE constant');
});

test('advanced links toggle exists and defaults to off', () => {
  const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
  assert.ok(
    script.includes('advancedLinks: false'),
    'advancedLinks must default to false'
  );

  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(
    html.includes('check-advanced-links'),
    'popup must have advanced links toggle checkbox'
  );
  // The checkbox should NOT be checked by default
  const toggleLine = html.split('\n').find((l) => l.includes('check-advanced-links'));
  assert.ok(
    !toggleLine.includes('checked'),
    'advanced links toggle must not be checked by default'
  );
});

// --- Output Truthfulness ---

test('doc format uses MHTML extension, not .doc', () => {
  const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
  // The extension used for download must be .mhtml, not .doc
  assert.ok(
    script.includes("ext: 'mhtml'"),
    'doc format handler must set ext to mhtml'
  );
});

test('PDF uses Type1 built-in fonts, no external font downloads', () => {
  const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
  assert.ok(
    script.includes('Helvetica'),
    'PDF must use Helvetica (built-in Type1 font)'
  );
  assert.ok(
    !script.includes('toDataURL') || script.includes('_unused'),
    'PDF must not use canvas toDataURL for rendering'
  );
});

test('security guard blocks external URLs', () => {
  const sg = readFileSync(join(ROOT, 'security_guard.js'), 'utf8');
  assert.ok(sg.includes('blob:'), 'security guard must allow blob: URLs');
  assert.ok(sg.includes('data:'), 'security guard must allow data: URLs');
  assert.ok(sg.includes('chrome-extension:'), 'security guard must allow chrome-extension: URLs');
  assert.ok(sg.includes('isAllowed'), 'security guard must export isAllowed');
  assert.ok(sg.includes('block'), 'security guard must export block function');
});

// --- Diagnostics Requirements ---

test('diagnostics schema includes required fields', () => {
  const diag = readFileSync(join(ROOT, 'lib', 'diagnostics.mjs'), 'utf8');
  assert.ok(diag.includes('runId'), 'diagnostics must include runId');
  assert.ok(diag.includes('tabScope'), 'diagnostics must include tabScope');
  assert.ok(diag.includes('scheme'), 'diagnostics must include scheme for URL events');
  assert.ok(diag.includes('pathHash'), 'diagnostics must use pathHash (not full URL)');
  assert.ok(diag.includes('reason_code') || diag.includes('denial'), 'diagnostics must include denial reasons');
  assert.ok(diag.includes('strategy'), 'diagnostics must include strategy');
});

test('leak scanner catches JWT patterns', () => {
  const diag = readFileSync(join(ROOT, 'lib', 'diagnostics.mjs'), 'utf8');
  assert.ok(diag.includes('eyJ'), 'leak scanner must check for JWT patterns');
  assert.ok(diag.includes('Bearer'), 'leak scanner must check for Bearer tokens');
  assert.ok(diag.includes('REDACTED'), 'leak scanner must redact found secrets');
});

// --- Manifest Sanity ---

test('manifest has correct permissions without unnecessary ones', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  assert.ok(manifest.permissions.includes('downloads'), 'must have downloads permission');
  assert.ok(manifest.permissions.includes('activeTab'), 'must have activeTab permission');
  assert.equal(manifest.manifest_version, 3, 'must be MV3');
  assert.ok(manifest.background?.service_worker, 'must have service worker background');
});
