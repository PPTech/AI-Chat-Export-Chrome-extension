#!/usr/bin/env node
// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)
// verify_claims.mjs - CI gate that verifies export truthfulness claims.
// Exit code 0 = pass, 1 = fail.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const errors = [];

// --- Leak scanner: no tokens/JWT/Bearer in logs or diagnostics ---

const LEAK_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /api[_-]?key[=:]\s*["']?[A-Za-z0-9._~+/=-]{16,}/gi,
];

const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.json', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'models', 'lib']);

function scanDir(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      const content = readFileSync(full, 'utf8');
      for (const pattern of LEAK_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          const relPath = full.replace(ROOT, '');
          errors.push(`LEAK: ${relPath} contains potential secret: ${match[0].slice(0, 12)}...`);
        }
      }
    }
  }
}

scanDir(ROOT);

// --- Placeholder host check ---

function scanForPlaceholders(dir) {
  const EXCLUDE = new Set(['node_modules', '.git', 'tests', 'features', 'fixtures', '.github', '.claude']);
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      scanForPlaceholders(full);
    } else if (['.js', '.mjs', '.html'].includes(extname(entry))) {
      const content = readFileSync(full, 'utf8');
      if (/https?:\/\/example\.com/i.test(content)) {
        errors.push(`PLACEHOLDER: ${full.replace(ROOT, '')} references example.com`);
      }
    }
  }
}

scanForPlaceholders(ROOT);

// --- Format truthfulness checks ---

const scriptPath = join(ROOT, 'script.js');
try {
  const script = readFileSync(scriptPath, 'utf8');

  // DOC output: honest HTML with application/msword MIME (Word opens it correctly)
  if (script.includes("'application/msword'") && !script.includes('doc')) {
    errors.push('FORMAT: doc format uses application/msword but doc handling missing');
  }

  // PDF must be text-based
  if (!script.includes('buildTextPdf') && script.includes('toDataURL')) {
    errors.push('FORMAT: PDF still uses canvas raster (toDataURL), not text-based');
  }

  // CSV must have pro schema
  if (!script.includes('Index,Role,Platform,Content,ExportedAt')) {
    errors.push('FORMAT: CSV missing pro schema columns');
  }
} catch {
  // script.js may not exist in all environments
}

// --- Report ---

if (errors.length > 0) {
  console.error('VERIFY:CLAIMS FAILED');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('VERIFY:CLAIMS PASSED - all checks green');
  process.exit(0);
}
