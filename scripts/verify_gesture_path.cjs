#!/usr/bin/env node
// License: MIT
// Author: Dr. Babak Sorkhpour (with help of AI)
// verify_gesture_path.cjs — CI gate: ensures no await before permissions.request
// or downloads.download inside gesture handlers in the popup script.
//
// Repro: Chrome MV3 requires chrome.permissions.request and chrome.downloads.download
//        to be called synchronously in the user gesture (click) stack. If there's an
//        await before either call, Chrome throws:
//        "This function must be called during a user gesture"
//
// Fix:   This script scans script.js for gesture handler blocks and flags violations.
// Verify: node scripts/verify_gesture_path.cjs

'use strict';

const fs = require('fs');
const path = require('path');

const POPUP_SCRIPT = path.join(__dirname, '..', 'script.js');

if (!fs.existsSync(POPUP_SCRIPT)) {
  console.error('[verify_gesture_path] FAIL: script.js not found');
  process.exit(1);
}

const src = fs.readFileSync(POPUP_SCRIPT, 'utf-8');
const lines = src.split('\n');

const violations = [];

// Strategy: find all onclick/addEventListener('click' assignments that use withGesture,
// then inside those handler bodies, check if there's an `await` before any
// chrome.permissions.request or chrome.downloads.download call.
//
// Simplified heuristic: scan for patterns like:
//   withGesture(async () => { ... })
// and within those blocks, verify that permissions.request/downloads.download
// appear BEFORE or AT SAME LEVEL as the first await (if any).

// Pattern 1: Check that permissions.request is NOT preceded by await in the same function scope
const permReqPattern = /chrome\.permissions\.request/g;
const dlPattern = /chrome\.downloads\.download/g;

let match;

// Find all chrome.permissions.request calls
while ((match = permReqPattern.exec(src)) !== null) {
  const pos = match.index;
  // Look backwards up to 500 chars for an `await` that's in the same scope
  const lookback = src.slice(Math.max(0, pos - 500), pos);
  // Check if there's a withGesture context
  const hasGestureContext = lookback.includes('withGesture');

  if (hasGestureContext) {
    // Count awaits in the lookback (same gesture handler scope)
    const awaitsBefore = (lookback.match(/\bawait\b/g) || []).length;
    if (awaitsBefore > 0) {
      const lineNum = src.slice(0, pos).split('\n').length;
      violations.push({
        line: lineNum,
        type: 'permissions.request',
        message: `chrome.permissions.request at line ${lineNum} has ${awaitsBefore} await(s) before it in gesture handler`
      });
    }
  }
}

// Find all chrome.downloads.download calls
while ((match = dlPattern.exec(src)) !== null) {
  const pos = match.index;
  const lookback = src.slice(Math.max(0, pos - 200), pos);

  // Check if the download call is inside downloadBlob or similar wrapper
  // These are OK as long as they are called from gesture context
  const inDownloadBlob = lookback.includes('function downloadBlob');

  if (!inDownloadBlob) {
    // If directly in a gesture handler, check for preceding awaits
    const gestureIdx = lookback.lastIndexOf('withGesture');
    if (gestureIdx >= 0) {
      const afterGesture = lookback.slice(gestureIdx);
      const awaitsBefore = (afterGesture.match(/\bawait\b/g) || []).length;
      if (awaitsBefore > 0) {
        const lineNum = src.slice(0, pos).split('\n').length;
        violations.push({
          line: lineNum,
          type: 'downloads.download',
          message: `chrome.downloads.download at line ${lineNum} has ${awaitsBefore} await(s) before it in gesture handler`
        });
      }
    }
  }
}

// Pattern 2: Verify that withGesture wrapper exists
if (!src.includes('withGesture')) {
  violations.push({
    line: 0,
    type: 'missing_gesture_wrapper',
    message: 'No withGesture() wrapper found in script.js — gesture enforcement missing'
  });
}

// Pattern 3: Verify that assertGesture exists
if (!src.includes('assertGesture')) {
  violations.push({
    line: 0,
    type: 'missing_assert_gesture',
    message: 'No assertGesture() function found — gesture validation missing'
  });
}

// Pattern 4: Verify gestureToken TTL mechanism exists
if (!src.includes('GESTURE_TTL_MS')) {
  violations.push({
    line: 0,
    type: 'missing_gesture_ttl',
    message: 'No GESTURE_TTL_MS constant found — time-windowed gesture token missing'
  });
}

if (violations.length > 0) {
  console.error('[verify_gesture_path] FAIL: Found gesture path violations:');
  violations.forEach((v) => {
    console.error(`  Line ${v.line}: [${v.type}] ${v.message}`);
  });
  process.exit(1);
} else {
  console.log('[verify_gesture_path] PASS: No gesture path violations found.');
  console.log('  - withGesture() wrapper: present');
  console.log('  - assertGesture() check: present');
  console.log('  - GESTURE_TTL_MS: present');
  console.log('  - No await before permissions.request in gesture handlers');
  process.exit(0);
}
