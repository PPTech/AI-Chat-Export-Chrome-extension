// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// tools/pts.mjs - Predictive test selection mapper v0.12.6

export function selectTests(changedFiles = []) {
  const selected = new Set();
  for (const file of changedFiles) {
    if (file.startsWith('content_miner/')) selected.add('tests/integration/neural_eye_export_contract.test.mjs');
    if (file.startsWith('attachment_resolver/')) selected.add('tests/unit/local_only_resolver_contract.test.mjs');
    if (file.startsWith('packager/')) selected.add('tests/unit/export_packager_contract.test.mjs');
    if (file.startsWith('self_heal/')) selected.add('tests/unit/self_heal_contract.test.mjs');
  }
  return Array.from(selected);
}
