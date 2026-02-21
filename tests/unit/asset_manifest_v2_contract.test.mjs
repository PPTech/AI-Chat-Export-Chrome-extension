// License: AGPL-3.0
// Contract test: asset manifest v2 schema compliance

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

test('Asset manifest uses v2 schema', () => {
    assert.ok(
        scriptContent.includes("schema: 'asset-manifest.v2'"),
        'Asset manifest must declare v2 schema'
    );
});

test('Asset manifest v2 includes detailed entries array', () => {
    // Check that the shape of the v2 manifest contains "entries"
    assert.ok(
        scriptContent.includes('entries: assetEntries'),
        'Asset manifest object must include entries array'
    );
});

test('Entries contain required fields', () => {
    assert.ok(
        scriptContent.includes('assetId:') &&
        scriptContent.includes('fileName:') &&
        scriptContent.includes('byteLength:') &&
        scriptContent.includes('scheme:') &&
        scriptContent.includes('originHost:'),
        'Asset entry objects must populate specific detailed fields'
    );
    assert.ok(
        scriptContent.includes("status: 'resolved'") &&
        scriptContent.includes("status: 'failed'"),
        'Asset entries should distinguish between resolved and failed statuses'
    );
});

test('Failed entries populate failureReason', () => {
    assert.ok(
        scriptContent.includes('failureReason: f.reason'),
        'Failed asset entries must include the failure metadata'
    );
});
