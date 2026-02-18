// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const content = fs.readFileSync('content.js', 'utf8');
const background = fs.readFileSync('background.js', 'utf8');
const loop = fs.readFileSync('agent/agent_loop.js', 'utf8');

test('Content sends redacted DOM snapshot and extraction goals to agent payload', () => {
  assert.match(content, /buildRedactedDomSnapshot\(40000\)/);
  assert.match(content, /extractionGoals: \{ includeMessages: true, includeImages: true, includeFiles: true \}/);
});

test('Background exposes user-initiated MEDIA_FETCH_PROXY route', () => {
  assert.match(background, /MEDIA_FETCH_PROXY/);
  assert.match(background, /user_initiation_required/);
});

test('Agent loop trace includes plan confidence/why and goal hints', () => {
  assert.match(loop, /goalHints/);
  assert.match(loop, /confidence: plan\.confidence/);
  assert.match(loop, /domSnapshotChars/);
});
