// License: AGPL-3.0
// Contract test: fail-soft bundle always includes manifest + diagnostics.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

test('export_bundle_manifest.json is always included in ZIP', () => {
    assert.ok(
        scriptContent.includes('export_bundle_manifest.json'),
        'Must always emit export_bundle_manifest.json'
    );
    assert.ok(
        scriptContent.includes('export-bundle-manifest.v1'),
        'Bundle manifest must have v1 schema'
    );
});

test('diagnostics_summary.json is always included in ZIP', () => {
    assert.ok(
        scriptContent.includes('diagnostics_summary.json'),
        'Must always include diagnostics_summary.json in ZIP'
    );
});

test('fail-soft: format failures do not abort export', () => {
    assert.ok(
        scriptContent.includes('export.format.fail'),
        'Must record per-format failure events'
    );
    assert.ok(
        scriptContent.includes('formatErrors'),
        'Must track formatErrors array'
    );
});

test('assetFailureReasons included in export manifest', () => {
    assert.ok(
        scriptContent.includes('assetFailureReasons'),
        'Export manifest must include assetFailureReasons array'
    );
});

test('diagnostics_summary is created before single-file check (always bundled)', () => {
    // diagnostics_summary.json must be pushed to files BEFORE the single-file check
    const diagIdx = scriptContent.indexOf('diagnostics_summary.json');
    const singleFileIdx = scriptContent.indexOf("files.length === 1 && !checkZip.checked");
    assert.ok(diagIdx < singleFileIdx,
        'diagnostics_summary must be added before single-file download check'
    );
});
