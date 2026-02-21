// License: AGPL-3.0
// Contract tests for ChatGPT file extraction fixes in chatgpt.mjs
// Covers: ssotPartsToContent, fileParts detection, file-service:// stripping

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const chatgptMjs = readFileSync(join(ROOT, 'lib/extractors/chatgpt.mjs'), 'utf8');

// ------------------------------------------------------------------
// A: SSOT path uses ssotPartsToContent, not parts.join()
// ------------------------------------------------------------------

test('A: chatgpt.mjs no longer calls parts.join on mixed arrays (SSOT path)', () => {
    // Old bug: content: n.message.content.parts.join('\n')
    // This turned object parts into '[object Object]'
    assert.ok(
        !chatgptMjs.includes('.parts.join('),
        'SSOT extraction must NOT call .parts.join() — use ssotPartsToContent() instead'
    );
});

test('A: ssotPartsToContent function is defined', () => {
    assert.ok(
        chatgptMjs.includes('function ssotPartsToContent'),
        'ssotPartsToContent must be defined in chatgpt.mjs'
    );
});

test('A: ssotPartsToContent handles image_asset_pointer parts → [[IMG:...]] token', () => {
    assert.ok(
        chatgptMjs.includes("ct === 'image_asset_pointer'"),
        'ssotPartsToContent must detect image_asset_pointer content_type'
    );
    assert.ok(
        chatgptMjs.includes('`[[IMG:${assetUrl}]]`'),
        'ssotPartsToContent must produce [[IMG:...]] tokens for image parts'
    );
});

test('A: ssotPartsToContent handles tether_id / attachment / multimodal_text → [[FILE:...]] token', () => {
    assert.ok(
        chatgptMjs.includes("ct === 'tether_id'") && chatgptMjs.includes("ct === 'attachment'") && chatgptMjs.includes("ct === 'multimodal_text'"),
        'ssotPartsToContent must detect tether_id, attachment, and multimodal_text content types'
    );
    assert.ok(
        chatgptMjs.includes('`[[FILE:${fileUrl}|${fileName}]]`'),
        'ssotPartsToContent must produce [[FILE:...]] tokens for file parts'
    );
});

// ------------------------------------------------------------------
// B: API path — multimodal_text and asset_pointer detection
// ------------------------------------------------------------------

test('B: API path detects multimodal_text content_type for file parts', () => {
    assert.ok(
        chatgptMjs.includes("p?.content_type === 'multimodal_text'"),
        'tryChatGptApiFetch fileParts filter must include multimodal_text content_type'
    );
});

test('B: API path detects non-image asset_pointer parts as files', () => {
    assert.ok(
        chatgptMjs.includes("typeof p?.asset_pointer === 'string' && !p?.content_type?.startsWith('image')"),
        'fileParts filter must catch asset_pointer parts that are not images'
    );
});

// ------------------------------------------------------------------
// C: file-service:// prefix stripping
// ------------------------------------------------------------------

test('C: SSOT path strips file-service:// from tether IDs', () => {
    assert.ok(
        chatgptMjs.includes(".replace('file-service://', '')"),
        'ssotPartsToContent must strip file-service:// prefix from file IDs'
    );
});

test('C: API path strips file-service:// from tether IDs', () => {
    // The API path fix adds the same stripping to tryChatGptApiFetch fileParts loop
    const apiFetchFn = chatgptMjs.slice(chatgptMjs.indexOf('async function tryChatGptApiFetch'));
    assert.ok(
        apiFetchFn.includes(".replace('file-service://', '')"),
        'tryChatGptApiFetch must strip file-service:// from file tether IDs'
    );
});

// ------------------------------------------------------------------
// D: File URL structure — backend-api/files endpoint
// ------------------------------------------------------------------

test('D: File URLs use chatgpt.com/backend-api/files/ endpoint', () => {
    assert.ok(
        chatgptMjs.includes('chatgpt.com/backend-api/files/'),
        'File URLs must use the correct backend-api/files/ endpoint'
    );
});

test('D: Image URLs also use chatgpt.com/backend-api/files/ endpoint', () => {
    // Both image and file pointers use the same endpoint after stripping file-service://
    const imgUrlPattern = 'chatgpt.com/backend-api/files/${ptr.replace(';
    assert.ok(
        chatgptMjs.includes(imgUrlPattern),
        'Image asset URLs must strip file-service:// and use backend-api/files endpoint'
    );
});

// ------------------------------------------------------------------
// E: File types targeted (.md, .xls, .doc, .docx, .png, .txt)
// ------------------------------------------------------------------

test('E: extractFileTokensFromNode handles download attribute for standard file types', () => {
    const utilsMjs = readFileSync(join(ROOT, 'lib/extractors/utils.mjs'), 'utf8');
    assert.ok(
        utilsMjs.includes('a[download]'),
        'extractFileTokensFromNode must query a[download] elements'
    );
    assert.ok(
        utilsMjs.includes('backend-api'),
        'extractFileTokensFromNode must detect backend-api file URLs'
    );
    assert.ok(
        utilsMjs.includes('blob:'),
        'extractFileTokensFromNode must detect blob: URLs (for .docx, .xlsx binary downloads)'
    );
});

test('E: ASSET_ALLOWLIST in script.js covers chatgpt.com file domains', () => {
    const scriptJs = readFileSync(join(ROOT, 'script.js'), 'utf8');
    assert.ok(
        scriptJs.includes('chatgpt.com'),
        'ASSET_ALLOWLIST must include chatgpt.com for file downloads'
    );
    assert.ok(
        scriptJs.includes('oaiusercontent.com'),
        'ASSET_ALLOWLIST must include oaiusercontent.com for images'
    );
});
