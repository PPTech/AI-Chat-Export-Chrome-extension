// License: AGPL-3.0
// Contract test: export output format truthfulness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

test('Word Doc format outputs as honest HTML .doc (no fake MHTML)', () => {
  // The doc format handler must produce honest HTML with .doc ext
  assert.ok(
    scriptContent.includes("ext: 'doc'"),
    'doc format must set ext to doc'
  );
  assert.ok(
    scriptContent.includes("application/msword"),
    'doc format must use application/msword MIME type'
  );
  // Must NOT have fake MHTML multipart wrapper
  assert.ok(
    !scriptContent.includes("multipart/related"),
    'doc format must NOT use fake MHTML multipart/related'
  );
});

test('PDF builder uses text objects not canvas', () => {
  assert.ok(
    scriptContent.includes('buildTextPdf'),
    'PDF must use buildTextPdf (text-based)'
  );
  // Text PDF must use BT/ET text objects for extractable text
  assert.ok(
    scriptContent.includes('BT') && scriptContent.includes('ET'),
    'PDF must use BT/ET PDF text objects'
  );
  assert.ok(
    scriptContent.includes('/Type1'),
    'PDF must use Type1 fonts (built-in, no download)'
  );
});

test('CSV has pro schema with index, platform, timestamp columns', () => {
  assert.ok(
    scriptContent.includes('Index,Role,Platform,Content,ExportedAt'),
    'CSV must include Index, Role, Platform, Content, ExportedAt columns'
  );
});

test('JSON export includes schema version', () => {
  assert.ok(
    scriptContent.includes("schema: 'chat-export.v1'"),
    'JSON export must include schema version'
  );
});

test('SQL export includes platform and timestamp columns', () => {
  assert.ok(
    scriptContent.includes('msg_index INT'),
    'SQL must include msg_index column'
  );
  assert.ok(
    scriptContent.includes('platform VARCHAR'),
    'SQL must include platform column'
  );
  assert.ok(
    scriptContent.includes('exported_at TIMESTAMP'),
    'SQL must include exported_at column'
  );
});

test('PDF builder strips HTML tags from content', () => {
  assert.ok(
    scriptContent.includes('stripHtmlTags'),
    'PDF must strip HTML tags via stripHtmlTags before rendering'
  );
});

test('PDF builder warns about non-Latin characters', () => {
  assert.ok(
    scriptContent.includes('hasNonLatinChars'),
    'PDF must detect non-Latin characters and add warning'
  );
  assert.ok(
    scriptContent.includes('For full Unicode support'),
    'PDF must suggest HTML/MD for Unicode content'
  );
});

test('No external favicon service calls in codebase', () => {
  assert.ok(
    !scriptContent.includes('google.com/s2/favicons'),
    'Must not reference external favicon services'
  );
});

test('popup format grid labels match supported formats', () => {
  const htmlContent = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const expectedFormats = ['md', 'html', 'json', 'doc', 'csv', 'sql', 'txt', 'pdf'];
  for (const fmt of expectedFormats) {
    assert.ok(
      htmlContent.includes(`data-ext="${fmt}"`),
      `Missing format option: ${fmt}`
    );
  }
});
