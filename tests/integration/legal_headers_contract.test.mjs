// License: AGPL-3.0
// Author: Dr. Babak Sorkhpour (with help of AI)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = ['content.js', 'background.js', 'script.js'];

test('Legal header exists in all runtime files', () => {
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    assert.match(txt, /License: MIT/, `missing MIT license header in ${f}`);
    assert.match(txt, /Dr\. Babak Sorkhpour/, `missing author attribution in ${f}`);
  }
});
