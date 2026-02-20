// License: AGPL-3.0
// Contract test: every action case in background.js calls sendResponse().

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const bgContent = readFileSync(join(ROOT, 'background.js'), 'utf8');

test('INVARIANT: every case in background.js calls sendResponse', () => {
    // Extract all case labels from the switch statement
    const caseLabels = [...bgContent.matchAll(/case\s+'([^']+)'/g)].map(m => m[1]);
    assert.ok(caseLabels.length > 0, 'Must have case labels');

    // Each case block must contain sendResponse
    for (const label of caseLabels) {
        // Find the content between this case and the next case/default
        const caseIdx = bgContent.indexOf(`case '${label}'`);
        const restAfterCase = bgContent.slice(caseIdx);
        const nextCaseIdx = restAfterCase.search(/\n\s+(case |default:)/);
        const caseBlock = nextCaseIdx > 0
            ? restAfterCase.slice(0, nextCaseIdx)
            : restAfterCase.slice(0, 300);

        // Skip fall-through cases (e.g., GET_DIAGNOSTICS falls through to GET_DIAGNOSTICS_JSONL)
        if (caseBlock.trim().endsWith(':') || /case '[^']+':$/.test(caseBlock.trim())) {
            continue; // fall-through case, next case handles it
        }
        assert.ok(
            caseBlock.includes('sendResponse'),
            `Case '${label}' must call sendResponse()`
        );
    }
});

test('default case calls sendResponse for unknown actions', () => {
    const defaultIdx = bgContent.indexOf('default:');
    assert.ok(defaultIdx > 0, 'Must have default case');
    const afterDefault = bgContent.slice(defaultIdx, defaultIdx + 300);
    assert.ok(
        afterDefault.includes('sendResponse'),
        'Default case must call sendResponse for unknown actions'
    );
});

test('INVARIANT comment documents the contract', () => {
    assert.ok(
        bgContent.includes('INVARIANT: every COMMAND_IN must produce exactly one COMMAND_OUT'),
        'background.js must document the COMMAND_IN/COMMAND_OUT invariant'
    );
});

test('GET_DIAGNOSTICS alias exists for backwards compatibility', () => {
    assert.ok(
        bgContent.includes("case 'GET_DIAGNOSTICS':"),
        'Must have GET_DIAGNOSTICS alias case'
    );
});
