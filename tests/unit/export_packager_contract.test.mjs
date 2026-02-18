// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnostics } from '../../packager/build_export_bundle.mjs';

test('buildDiagnostics emits diagnostics.v1 schema with scorecard', () => {
  const d = buildDiagnostics({ runId: 'r', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z', counts: { messages_found: 0, messages_emitted: 0, attachments_discovered: 0, attachments_resolved: 0, attachments_external_refs: 0, failures: 1 }, failures: [{ stage: 'extract_dom', code: 'NO_MESSAGES_FOUND', detail: 'none', url: '' }], reasonCodes: ['NO_MESSAGES_FOUND'], scorecard: { message_recall: 0, attachment_recall: 0, determinism: 1, bdd_pass_rate: 1, robustness_fallbacks_used: 0, explainability: 1 }, deterministicMode: true, version: '0.12.6', usedSelector: 'none' });
  assert.equal(d.schema_version, 'diagnostics.v1');
  assert.equal(Array.isArray(d.failures), true);
  assert.equal(typeof d.scorecard.message_recall, 'number');
});
