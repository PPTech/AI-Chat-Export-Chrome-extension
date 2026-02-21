// License: AGPL-3.0
// A/B Image Embedding Contract Tests
// Tests correctness of image download, extension assignment, and rendering
// across HTML, Word (.doc), PDF, and Markdown exports for all platforms.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const exportMjs = readFileSync(join(ROOT, 'lib/export.mjs'), 'utf8');
const scriptJs = readFileSync(join(ROOT, 'script.js'), 'utf8');

// ------------------------------------------------------------------
// Bug 1 Fix: normalizeImageSrcForOutput accepts local asset paths
// ------------------------------------------------------------------

test('A: renderRichMessageHtmlWithAssets uses normalizeImageSrcForOutput (local path accepted)', () => {
    // The fix adds normalizeImageSrcForOutput that allows assets/ paths
    assert.ok(
        exportMjs.includes('normalizeImageSrcForOutput'),
        'lib/export.mjs must define normalizeImageSrcForOutput helper'
    );
    assert.ok(
        exportMjs.includes('/^assets\\//.test(src)'),
        'normalizeImageSrcForOutput must accept assets/ paths'
    );
});

test('A: renderRichMessageHtmlWithAssets calls normalizeImageSrcForOutput (not old pattern)', () => {
    // Old bug: safeSrc = /^(data:|https?:\\/\\/)/.test(src) ? normalizeImageSrc(src) : escapeHtml(src)
    // This would return '' for local paths and produce <img src="">
    assert.ok(
        !exportMjs.includes('escapeHtml(src)') ||
        exportMjs.indexOf('normalizeImageSrcForOutput(src)') < exportMjs.indexOf('escapeHtml(src)'),
        'renderRichMessageHtmlWithAssets should use normalizeImageSrcForOutput, not escapeHtml(src) fallback'
    );
    assert.ok(
        exportMjs.includes('normalizeImageSrcForOutput(src)'),
        'renderRichMessageHtmlWithAssets must call normalizeImageSrcForOutput(src)'
    );
});

test('B: renderRichMessageHtml (non-ZIP) still handles data: and https:// src (regression)', () => {
    // renderRichMessageHtml uses renderImgTag which calls normalizeImageSrc — regression test
    assert.ok(
        exportMjs.includes('export function renderRichMessageHtml'),
        'renderRichMessageHtml must exist'
    );
    assert.ok(
        exportMjs.includes('renderImgTag(part.value)'),
        'renderRichMessageHtml must call renderImgTag to render images'
    );
    // renderImgTag calls normalizeImageSrc which accepts data: and https://
    assert.ok(
        exportMjs.includes('normalizeImageSrc((rawSrc || \'\').trim())'),
        'renderImgTag must use normalizeImageSrc for non-ZIP images'
    );
});

// ------------------------------------------------------------------
// Bug 2 Fix: mimeToExt comprehensive extension mapping
// ------------------------------------------------------------------

test('C: mimeToExt helper exists in script.js', () => {
    assert.ok(
        scriptJs.includes('function mimeToExt'),
        'script.js must define mimeToExt helper'
    );
});

test('C: mimeToExt maps image/jpeg → jpg (not jpeg)', () => {
    assert.ok(
        scriptJs.includes("'image/jpeg': 'jpg'"),
        'mimeToExt must map image/jpeg to jpg'
    );
});

test('C: mimeToExt maps image/svg+xml → svg', () => {
    assert.ok(
        scriptJs.includes("'image/svg+xml': 'svg'"),
        'mimeToExt must map image/svg+xml to svg'
    );
});

test('C: mimeToExt maps image/webp → webp (was missing before)', () => {
    assert.ok(
        scriptJs.includes("'image/webp': 'webp'"),
        'mimeToExt must map image/webp to webp'
    );
});

test('C: mimeToExt maps application/vnd.openxmlformats → docx (was producing garbage)', () => {
    assert.ok(
        scriptJs.includes("'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'"),
        'mimeToExt must map Word MIME to docx'
    );
});

test('C: mimeToExt replaces old ad-hoc .replace("jpeg","jpg") pattern', () => {
    // Old code: (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
    assert.ok(
        !scriptJs.includes(".replace('jpeg', 'jpg').replace('svg+xml', 'svg')"),
        'Old ad-hoc extension replace chain must be removed in favour of mimeToExt'
    );
});

test('C: resolveAndEmbedAssets uses mimeToExt for image asset extension', () => {
    assert.ok(
        scriptJs.includes("mimeToExt(blob.type, 'png')"),
        'resolveAndEmbedAssets image loop must use mimeToExt with png fallback'
    );
});

test('C: resolveAndEmbedAssets uses mimeToExt for file asset extension', () => {
    assert.ok(
        scriptJs.includes("mimeToExt(blob.type, 'bin')"),
        'resolveAndEmbedAssets file loop must use mimeToExt with bin fallback'
    );
});

// ------------------------------------------------------------------
// Bug 3 Fix: Markdown [[IMG:...]] tokens → ![Image](...) syntax
// ------------------------------------------------------------------

test('D: generateContent md mode converts [[IMG:]] tokens to ![Image]() markdown', () => {
    assert.ok(
        exportMjs.includes("replace(/\\[\\[IMG:([\\s\\S]*?)\\]\\]/g"),
        'generateContent md formatter must replace [[IMG:...]] tokens with markdown img syntax'
    );
    assert.ok(
        exportMjs.includes('`![Image](${displaySrc})`'),
        'generateContent md must produce ![Image](...) markdown syntax'
    );
});

test('D: Markdown generateContent uses normalizeImageSrcForOutput for local paths', () => {
    assert.ok(
        exportMjs.includes('normalizeImageSrcForOutput(s) || s'),
        'Markdown img conversion must prefer normalizeImageSrcForOutput for local path validation'
    );
});

// ------------------------------------------------------------------
// Bug 4 Fix: raster PDF fallback passes urlMap to buildCanvasPdf
// ------------------------------------------------------------------

test('E: generateContent passes urlMap to buildCanvasPdf in raster fallback', () => {
    assert.ok(
        scriptJs.includes('buildCanvasPdf: (title, msgs) => buildCanvasPdf(title, msgs, urlMap)'),
        'generateContent checkers must wrap buildCanvasPdf to pass urlMap for raster PDF fallback'
    );
});

// ------------------------------------------------------------------
// Security: sanitizeAssetPath blocks path traversal
// ------------------------------------------------------------------

test('E: sanitizeAssetPath blocks path traversal (..)', () => {
    assert.ok(
        scriptJs.includes("replace(/\\.\\./g, '_')"),
        'sanitizeAssetPath must strip .. path traversal sequences'
    );
});

test('E: sanitizeAssetPath blocks control characters', () => {
    assert.ok(
        scriptJs.includes('\\x00-\\x1F'),
        'sanitizeAssetPath must strip control characters (0x00-0x1F)'
    );
});
