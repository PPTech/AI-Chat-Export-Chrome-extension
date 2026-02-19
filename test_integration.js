// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// test_integration.js - Content integration contract test v0.12.9

import fs from 'node:fs';

function assertCond(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('=== TEST: Component Integration ===');

  const contentJs = fs.readFileSync(new URL('./content.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));

  assertCond(/window\.AegisLogger/.test(contentJs), 'FAIL: AegisLogger reference missing in content.js');
  assertCond(/window\.SecurityGuard/.test(contentJs), 'FAIL: SecurityGuard reference missing in content.js');
  assertCond(/installNetworkKillSwitch\(/.test(contentJs), 'FAIL: security kill-switch not invoked');
  assertCond(/detectAllFileLinks\(\)/.test(contentJs), 'FAIL: detectAllFileLinks contract missing');

  const contentScriptEntry = (manifest.content_scripts || [])[0]?.js || [];
  assertCond(contentScriptEntry.includes('logger.js'), 'FAIL: logger.js missing from manifest content script list');
  assertCond(contentScriptEntry.includes('security_guard.js'), 'FAIL: security_guard.js missing from manifest content script list');

  console.log('PASS: Logger/Security integration contract is present and wired');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
