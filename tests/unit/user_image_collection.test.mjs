// License: AGPL-3.0
// Contract tests: user-uploaded image collection, icon threshold, background-image, file-card thumbnails

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const contentContent = readFileSync(join(ROOT, 'content.js'), 'utf8');

// 1) Icon threshold is 64x64 (not 24x24)
test('icon filter threshold is 64x64', () => {
    assert.ok(
        contentContent.includes('<= 64'),
        'Icon threshold must be 64x64 (was 24x24)'
    );
    assert.ok(
        !contentContent.includes('<= 24') || contentContent.indexOf('<= 24') > contentContent.indexOf('<= 64'),
        'Must not have old 24x24 threshold before the 64x64 one'
    );
});

// 2) User message images are captured (no isUser gate on image collection)
test('extractImageTokensFromNode collects images from all messages', () => {
    // isUser flag must only be used for avatar filtering, not blocking all image capture
    const fnBlock = contentContent.slice(
        contentContent.indexOf('async extractImageTokensFromNode'),
        contentContent.indexOf('async extractImageTokensFromNode') + 2000
    );
    assert.ok(fnBlock.includes('[[IMG:'), 'Must produce [[IMG:...]] tokens');
    // The isUser check must only skip avatars, not all images
    assert.ok(
        fnBlock.includes("isUser && alt.includes('avatar')"),
        'isUser flag should only gate avatar filtering'
    );
});

// 3) Background-image URL extraction
test('extractImageTokensFromNode detects background-image URLs', () => {
    assert.ok(
        contentContent.includes('backgroundImage'),
        'Must check background-image CSS property'
    );
    assert.ok(
        contentContent.includes("url("),
        'Must parse url() from background-image'
    );
});

// 4) File-card thumbnail detection
test('extractImageTokensFromNode detects file-card thumbnails', () => {
    assert.ok(
        contentContent.includes('file-thumbnail'),
        'Must detect .file-thumbnail img elements'
    );
    assert.ok(
        contentContent.includes('file-card'),
        'Must detect file-card class elements'
    );
});

// 5) <picture><source> srcset handling
test('pickBestImageSource checks <picture><source> srcset', () => {
    const fnBlock = contentContent.slice(
        contentContent.indexOf('pickBestImageSource'),
        contentContent.indexOf('pickBestImageSource') + 800
    );
    assert.ok(
        fnBlock.includes("closest('picture')"),
        'Must check parent <picture> element'
    );
    assert.ok(
        fnBlock.includes("source[srcset]"),
        'Must query <source srcset> within <picture>'
    );
});

// 6) IMG token format
test('image tokens use [[IMG:...]] format', () => {
    assert.ok(
        contentContent.includes('[[IMG:${normalized}]]'),
        'Must produce [[IMG:BASE64_OR_URL]] tokens'
    );
});
