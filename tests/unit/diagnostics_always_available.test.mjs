// License: AGPL-3.0
// Contract tests: diagnostics always available via 3-tier fallback, min_forensics.json, diagnostics.jsonl

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');

// 1) Diagnostics schema is v6 everywhere (no stale v5 references)
test('persistExtractionDiagnostics uses diagnostics.v6 schema', () => {
    // Check there's at least one v6 reference
    assert.ok(
        scriptContent.includes("'diagnostics.v6'"),
        'Must use diagnostics.v6 schema'
    );
});

test('persistExtractionDiagnostics uses 0.12.1 tool version', () => {
    // The extraction diagnostics must not hardcode old versions
    const extractionDiagBlock = scriptContent.match(/function persistExtractionDiagnostics[\s\S]*?^\s*\}/m);
    assert.ok(extractionDiagBlock, 'persistExtractionDiagnostics function must exist');
    assert.ok(
        extractionDiagBlock[0].includes("0.12.1"),
        'persistExtractionDiagnostics must use 0.12.1 tool version'
    );
    assert.ok(
        !extractionDiagBlock[0].includes("0.11.0"),
        'persistExtractionDiagnostics must NOT hardcode stale 0.11.0'
    );
});

// 2) chrome.storage.local persistence (durable fallback)
test('extraction diagnostics persisted to chrome.storage.local', () => {
    assert.ok(
        scriptContent.includes("chrome.storage.local.set({ last_min_forensics: diag })"),
        'Extraction diagnostics must persist to chrome.storage.local'
    );
});

test('export diagnostics persisted to chrome.storage.local', () => {
    assert.ok(
        scriptContent.includes("chrome.storage.local.set({ last_min_forensics: lastDiagnostics })"),
        'Export diagnostics must persist to chrome.storage.local'
    );
});

// 3) 3-tier fallback in download handler
test('diagnostics download handler has chrome.storage.local fallback (tier 3)', () => {
    assert.ok(
        scriptContent.includes("chrome.storage.local.get('last_min_forensics'"),
        'Download handler must try chrome.storage.local as tier 3 fallback'
    );
});

test('diagnostics download handler never shows "No Diagnostics" info', () => {
    // The old pattern displayed showInfo('No Diagnostics', ...) — this must be gone
    assert.ok(
        !scriptContent.includes("showInfo('No Diagnostics'"),
        'Must NEVER show "No Diagnostics" info — always produce a downloadable file'
    );
});

test('diagnostics download handler produces empty-state file when no data exists', () => {
    assert.ok(
        scriptContent.includes("no_export_has_run_yet"),
        'Must produce an empty-state diagnostics bundle with reason field'
    );
});

// 4) min_forensics.json always in export ZIP
test('min_forensics.json included in export ZIP', () => {
    assert.ok(
        scriptContent.includes('.min_forensics.json'),
        'Export ZIP must include min_forensics.json'
    );
    assert.ok(
        scriptContent.includes("'min-forensics.v1'"),
        'min_forensics must have schema version'
    );
});

test('min_forensics.json has triageCategory field', () => {
    assert.ok(
        scriptContent.includes('triageCategory'),
        'min_forensics must include triageCategory'
    );
});

// 5) diagnostics.jsonl in export ZIP when debug ON
test('diagnostics.jsonl included in ZIP when debug mode is ON', () => {
    assert.ok(
        scriptContent.includes('.diagnostics.jsonl'),
        'Export ZIP must include diagnostics.jsonl when debug ON'
    );
});

// 6) min_forensics.json in diagnostics download bundle
test('min_forensics.json included in diagnostics download bundle', () => {
    const downloadHandler = scriptContent.slice(scriptContent.indexOf('btnDownloadDiagnostics'));
    assert.ok(
        downloadHandler.includes('min_forensics.json'),
        'Diagnostics download bundle must include min_forensics.json'
    );
});

// 7) Flight recorder ring buffer size
test('flight recorder ring buffer is 5000', () => {
    assert.ok(
        scriptContent.includes('> 5000'),
        'Popup flight recorder ring buffer must be 5000'
    );
    const diagContent = readFileSync(join(ROOT, 'lib', 'diagnostics.mjs'), 'utf8');
    assert.ok(
        diagContent.includes('MAX_RING_BUFFER = 5000'),
        'diagnostics.mjs ring buffer must be 5000'
    );
});
