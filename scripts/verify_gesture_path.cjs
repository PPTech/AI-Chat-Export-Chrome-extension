// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// verify_gesture_path.cjs - Gesture Path Guard v0.12.18

const fs = require('fs');

const src = fs.readFileSync('script.js', 'utf8');

function assertGestureBeforeAwait(handlerAnchor) {
  const start = src.indexOf(handlerAnchor);
  if (start < 0) throw new Error(`handler_missing:${handlerAnchor}`);
  const end = src.indexOf('};', start);
  const chunk = src.slice(start, end > start ? end : start + 1200);
  const gestureIdx = chunk.indexOf('requestAssetPermissionsFromGesture()');
  const awaitIdx = chunk.indexOf('await ');
  if (gestureIdx < 0) throw new Error(`gesture_call_missing:${handlerAnchor}`);
  if (awaitIdx >= 0 && gestureIdx > awaitIdx) throw new Error(`gesture_after_await:${handlerAnchor}`);
}

assertGestureBeforeAwait('btnExportImages.onclick = async () =>');
assertGestureBeforeAwait('btnExportFiles.onclick = async () =>');
console.log('Gesture path verification passed.');
