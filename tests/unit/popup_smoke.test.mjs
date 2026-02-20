// License: AGPL-3.0
// Smoke test: popup HTML structure is valid and self-contained.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('popup HTML has no broken stylesheet links', () => {
  // All CSS should be inline or from files that actually exist in the repo
  const linkTags = html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || [];
  for (const tag of linkTags) {
    const href = tag.match(/href=["']([^"']+)["']/);
    if (href) {
      // Absolute paths like /index.css are broken in extension context
      assert.ok(
        !href[1].startsWith('/'),
        `Broken absolute stylesheet path: ${href[1]}`
      );
    }
  }
});

test('popup HTML includes all required UI elements', () => {
  const requiredIds = [
    'btn-export-main',
    'btn-load-full',
    'btn-clear-all',
    'btn-preview',
    'btn-export-images',
    'btn-export-files',
    'platform-badge',
    'msg-count',
    'stats-view',
    'empty-view',
    'settings-modal',
    'error-modal',
    'about-modal',
    'preview-modal',
    'check-images',
    'check-code',
    'check-raw-html',
    'check-zip',
    'check-photo-zip',
    'check-export-files',
  ];

  for (const id of requiredIds) {
    assert.ok(
      html.includes(`id="${id}"`),
      `Missing required element: #${id}`
    );
  }
});

test('popup HTML format grid has correct data-ext attributes', () => {
  const expectedFormats = ['md', 'html', 'json', 'doc', 'csv', 'sql', 'txt', 'pdf'];
  for (const fmt of expectedFormats) {
    assert.ok(
      html.includes(`data-ext="${fmt}"`),
      `Missing format option: data-ext="${fmt}"`
    );
  }
});

test('popup body has a fixed width suitable for Chrome extension popup', () => {
  const widthMatch = html.match(/body\s*\{[^}]*width:\s*(\d+)px/);
  assert.ok(widthMatch, 'body should have a fixed pixel width');
  const width = parseInt(widthMatch[1], 10);
  assert.ok(width >= 300 && width <= 500, `popup width ${width}px should be between 300-500px`);
});

test('popup references script.js', () => {
  assert.ok(
    html.includes('src="script.js"'),
    'popup must reference script.js'
  );
});
