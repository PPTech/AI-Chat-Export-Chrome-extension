// License: MIT
// Contract test: export output format truthfulness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

test('Word Doc format outputs as MHTML not fake .doc', () => {
  // The doc format handler should produce MHTML with correct ext
  assert.ok(
    scriptContent.includes("ext: 'mhtml'"),
    'doc format must set ext to mhtml for truthful output'
  );
  assert.ok(
    scriptContent.includes("multipart/related"),
    'doc format must use multipart/related MIME type'
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
