// License: AGPL-3.0
// Contract tests: searchable PDF via chrome.debugger, raster PDF opt-in toggle

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');
const manifestContent = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');

// 1) chrome.debugger permission
test('manifest.json includes debugger permission', () => {
    assert.ok(
        manifestContent.permissions.includes('debugger'),
        'Must have debugger permission for Page.printToPDF'
    );
});

// 2) pdf_render.html exists
test('pdf_render.html template exists', () => {
    assert.ok(
        existsSync(join(ROOT, 'pdf_render.html')),
        'pdf_render.html must exist for searchable PDF rendering'
    );
});

test('pdf_render.html has Google Fonts for Unicode support', () => {
    const pdfHtml = readFileSync(join(ROOT, 'pdf_render.html'), 'utf8');
    assert.ok(pdfHtml.includes('Noto Sans Arabic'), 'Must include Noto Sans Arabic for RTL');
    assert.ok(pdfHtml.includes('Noto Sans SC') || pdfHtml.includes('Noto Sans JP'), 'Must include CJK font');
    assert.ok(pdfHtml.includes('Inter'), 'Must include Inter font');
});

test('pdf_render.html signals ready via document.title', () => {
    const pdfHtml = readFileSync(join(ROOT, 'pdf_render.html'), 'utf8');
    assert.ok(
        pdfHtml.includes('PDF_RENDER_READY'),
        'Must set document.title to PDF_RENDER_READY when rendering is complete'
    );
});

// 3) buildSearchablePdf function
test('buildSearchablePdf function exists', () => {
    assert.ok(
        scriptContent.includes('async function buildSearchablePdf'),
        'Must have buildSearchablePdf function'
    );
});

test('buildSearchablePdf uses Page.printToPDF', () => {
    assert.ok(
        scriptContent.includes("'Page.printToPDF'"),
        'Must use Page.printToPDF via chrome.debugger'
    );
});

test('buildSearchablePdf cleans up tab and storage', () => {
    assert.ok(
        scriptContent.includes("chrome.tabs.remove(pdfTabId)"),
        'Must clean up render tab'
    );
    assert.ok(
        scriptContent.includes("chrome.storage.local.remove('pdf_render_data')"),
        'Must clean up render data from storage'
    );
});

// 4) Raster PDF toggle
test('raster PDF toggle exists in settings HTML', () => {
    assert.ok(
        indexHtml.includes('check-raster-pdf'),
        'Settings must include raster PDF toggle'
    );
});

test('raster PDF toggle defaults to OFF', () => {
    // The checkbox must not have "checked" attribute
    const rasterIdx = indexHtml.indexOf('check-raster-pdf');
    const contextBefore = indexHtml.slice(Math.max(0, rasterIdx - 200), rasterIdx);
    // The label/input before the id should not have "checked"
    assert.ok(
        !contextBefore.includes('checked'),
        'Raster PDF toggle must default to OFF (no checked attribute)'
    );
});

// 5) Graceful fallback
test('PDF branch falls back to raster when debugger fails', () => {
    assert.ok(
        scriptContent.includes('chrome.debugger failed, falling back to raster'),
        'Must gracefully fall back to raster PDF when chrome.debugger fails'
    );
});
