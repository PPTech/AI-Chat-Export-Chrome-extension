// License: AGPL-3.0
// Contract test: searchable PDF requirements

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const scriptContent = readFileSync(join(ROOT, 'script.js'), 'utf8');
const manifestContent = readFileSync(join(ROOT, 'manifest.json'), 'utf8');

test('buildSearchablePdf function exists and uses CDP printToPDF', () => {
    assert.ok(
        scriptContent.includes('buildSearchablePdf'),
        'buildSearchablePdf function must exist in script.js'
    );
    assert.ok(
        scriptContent.includes('Page.printToPDF'),
        'buildSearchablePdf must use Page.printToPDF via chrome.debugger'
    );
});

test('pdf_render.html exists and is registered in manifest', () => {
    assert.ok(
        existsSync(join(ROOT, 'pdf_render.html')),
        'pdf_render.html must exist in the root directory'
    );

    const manifest = JSON.parse(manifestContent);
    const webAccessible = manifest.web_accessible_resources || [];

    let found = false;
    for (const entry of webAccessible) {
        if (entry.resources && entry.resources.includes('pdf_render.html')) {
            found = true;
            break;
        }
    }

    assert.ok(
        found,
        'pdf_render.html must be registered in manifest.json under web_accessible_resources'
    );
});

test('pdf_render.html includes the PDF_RENDER_READY signal', () => {
    const pdfRenderContent = readFileSync(join(ROOT, 'pdf_render.html'), 'utf8');
    assert.ok(
        pdfRenderContent.includes('PDF_RENDER_READY'),
        'pdf_render.html must set document.title to PDF_RENDER_READY to signal completion'
    );
});

test('Raster PDF fallback toggle is available and used', () => {
    assert.ok(
        scriptContent.includes('checkRasterPdf'),
        'script.js must extract toggle state via checkRasterPdf'
    );

    const indexContent = readFileSync(join(ROOT, 'index.html'), 'utf8');
    assert.ok(
        indexContent.includes('id="check-raster-pdf"'),
        'index.html must include check-raster-pdf toggle'
    );

    assert.ok(
        scriptContent.includes('const useRaster = document.getElementById(\'check-raster-pdf\')?.checked') ||
        (scriptContent.includes('const useRaster') && scriptContent.includes('check-raster-pdf')),
        'Export pipeline must check the raster PDF toggle'
    );
});
