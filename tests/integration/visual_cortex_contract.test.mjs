// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const contentSource = fs.readFileSync('content.js', 'utf8');
const visualEngine = fs.readFileSync('visual_engine.js', 'utf8');

test('Manifest ships Visual Cortex and Artifact Builder runtime modules', () => {
  const scripts = manifest.content_scripts?.[0]?.js || [];
  assert.ok(scripts.includes('visual_engine.js'));
  assert.ok(scripts.includes('artifact_builder.js'));
});

test('Content runtime routes visual cortex and artifact preview actions', () => {
  assert.match(contentSource, /extract_visual_cortex/);
  assert.match(contentSource, /build_artifacts_preview/);
  assert.match(contentSource, /window\.VisualCortexEngine/);
});

test('Visual engine uses TreeWalker and shadow-root recursion', () => {
  assert.match(visualEngine, /createTreeWalker/);
  assert.match(visualEngine, /if \(node\.shadowRoot\) stack\.push\(node\.shadowRoot\)/);
  assert.match(visualEngine, /right_alignment_bg_delta/);
});
