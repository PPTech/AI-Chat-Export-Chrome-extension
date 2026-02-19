// License: MIT
// Contract test: production source files must never reference placeholder hosts.
// This prevents accidental fetches to example.com or other test-only domains.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const PRODUCTION_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'tests', 'features', 'fixtures', '.github', '.claude']);

const FORBIDDEN_HOSTS = [
  /https?:\/\/example\.com/gi,
  /https?:\/\/raw\.githubusercontent\.com/gi,
  /https?:\/\/placeholder\./gi,
];

function collectProductionFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectProductionFiles(full));
    } else if (PRODUCTION_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

test('no production source files reference example.com or other placeholder hosts', () => {
  const productionFiles = collectProductionFiles(ROOT);
  const violations = [];

  for (const file of productionFiles) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_HOSTS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        const relPath = file.replace(ROOT, '');
        violations.push(`${relPath}: found "${match[0]}"`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Placeholder host references found in production code:\n${violations.join('\n')}`
  );
});

test('test fixtures do not link to external placeholder hosts as valid sources', () => {
  const fixtureDir = join(ROOT, 'fixtures');
  let violations = [];

  try {
    for (const entry of readdirSync(fixtureDir)) {
      if (!entry.endsWith('.html')) continue;
      const content = readFileSync(join(fixtureDir, entry), 'utf8');
      // Check for href/src attributes pointing to example.com
      const hrefMatches = content.matchAll(/(?:href|src)=["']https?:\/\/example\.com[^"']*["']/gi);
      for (const m of hrefMatches) {
        violations.push(`fixtures/${entry}: ${m[0]}`);
      }
    }
  } catch {
    // fixtures dir may not exist in all environments
  }

  assert.equal(
    violations.length,
    0,
    `Fixture files reference example.com as valid source:\n${violations.join('\n')}`
  );
});
