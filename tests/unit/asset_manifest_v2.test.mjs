// License: AGPL-3.0
// Contract tests: asset_manifest.v2 with per-asset entries, mandatory ZIP artifacts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

// 1) Asset manifest schema is v2
test('asset manifest schema is v2', () => {
    assert.ok(
        scriptContent.includes("'asset-manifest.v2'"),
        'Asset manifest must use schema v2'
    );
    assert.ok(
        !scriptContent.includes("'asset-manifest.v1'"),
        'Must not have stale v1 schema references'
    );
});

// 2) Per-asset entries
test('asset manifest has entries[] array with per-asset fields', () => {
    assert.ok(
        scriptContent.includes('assetEntries'),
        'Must build assetEntries array'
    );
    assert.ok(
        scriptContent.includes('entries: assetEntries'),
        'Asset manifest must include entries field'
    );
});

test('per-asset entry includes required fields', () => {
    assert.ok(scriptContent.includes('assetId:'), 'entry must have assetId');
    assert.ok(scriptContent.includes('fileName:'), 'entry must have fileName');
    assert.ok(scriptContent.includes('byteLength:'), 'entry must have byteLength');
    assert.ok(scriptContent.includes('originHost'), 'entry must have originHost');
    assert.ok(scriptContent.includes('scheme:'), 'entry must have scheme');
    assert.ok(scriptContent.includes("status: 'resolved'"), 'entry must have resolved status');
    assert.ok(scriptContent.includes("status: 'failed'"), 'entry must have failed status');
    assert.ok(scriptContent.includes('failureReason'), 'entry must have failureReason');
});

// 3) Mandatory ZIP artifacts
test('export_bundle_manifest.json always in ZIP', () => {
    assert.ok(
        scriptContent.includes('export_bundle_manifest.json'),
        'Must always include export_bundle_manifest.json in ZIP'
    );
});

test('diagnostics_summary.json always in ZIP', () => {
    assert.ok(
        scriptContent.includes('diagnostics_summary.json'),
        'Must always include diagnostics_summary.json in ZIP'
    );
});

test('min_forensics.json always in ZIP', () => {
    assert.ok(
        scriptContent.includes('.min_forensics.json'),
        'Must always include min_forensics.json in ZIP'
    );
});

test('asset_manifest.json in assets/ folder', () => {
    assert.ok(
        scriptContent.includes("'assets/asset_manifest.json'"),
        'Must include asset_manifest.json in assets/ folder'
    );
});

// 4) Failed assets tracked in entries
test('failed assets are included in manifest entries', () => {
    // The code should add failure entries to assetEntries
    const manifestBlock = scriptContent.slice(
        scriptContent.indexOf('// Add failed assets to entries'),
        scriptContent.indexOf('// Add failed assets to entries') + 600
    );
    assert.ok(
        manifestBlock.includes("status: 'failed'"),
        'Failed assets must be tracked with status: failed'
    );
    assert.ok(
        manifestBlock.includes("failureReason: f.reason"),
        'Failed assets must include failure reason'
    );
});
