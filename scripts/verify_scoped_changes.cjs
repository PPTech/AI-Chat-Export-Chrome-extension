#!/usr/bin/env node
// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const { execSync } = require('node:child_process');

const UI_PATH = /^(ui\/|popup\/|options\/|styles\/|popup\.html$|popup\.js$|options\.html$|options\.js$|styles\.css$|index\.html$)/i;
const SUBJECT_ALLOWED = /^(fix\(ui\):|feat\(ui\):)/;

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function getRange() {
  return process.env.VERIFY_SCOPED_RANGE || '';
}

const range = getRange();
const violations = [];

if (!range) {
  const files = run('git diff --name-only HEAD').split('\n').filter(Boolean);
  const touchedUi = files.filter((f) => UI_PATH.test(f));
  if (touchedUi.length > 0) {
    console.error('[verify_scoped_changes] UI files changed in working tree. Commit with fix(ui): or feat(ui): and run again with VERIFY_SCOPED_RANGE.');
    for (const f of touchedUi) console.error(`    * ${f}`);
    process.exit(1);
  }
  console.log('[verify_scoped_changes] No UI file changes detected in working tree.');
  process.exit(0);
}

const commits = run(`git rev-list ${range}`).split('\n').filter(Boolean);
for (const sha of commits) {
  const subject = run(`git log -1 --pretty=%s ${sha}`);
  const files = run(`git diff-tree --no-commit-id --name-only -r ${sha}`).split('\n').filter(Boolean);
  const touchedUi = files.some((f) => UI_PATH.test(f));
  if (touchedUi && !SUBJECT_ALLOWED.test(subject)) {
    violations.push({ sha, subject, files: files.filter((f) => UI_PATH.test(f)) });
  }
}

if (violations.length > 0) {
  console.error('[verify_scoped_changes] UI files changed outside fix(ui)/feat(ui) commit scope.');
  for (const v of violations) {
    console.error(`- ${v.sha.slice(0, 7)} ${v.subject}`);
    for (const f of v.files) console.error(`    * ${f}`);
  }
  process.exit(1);
}

console.log(`[verify_scoped_changes] OK for range ${range}`);
