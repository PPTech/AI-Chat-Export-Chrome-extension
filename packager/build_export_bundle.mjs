// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// packager/build_export_bundle.mjs - Forensic bundle builder v0.12.7

import { createHash } from 'node:crypto';

export function buildDiagnostics({ runId, startedAt, endedAt, counts, failures, reasonCodes, scorecard, deterministicMode, version, usedSelector, stages = [] }) {
  return {
    schema_version: 'diagnostics.v1',
    run: {
      run_id: runId,
      started_at_utc: startedAt,
      ended_at_utc: endedAt,
      deterministic_mode: deterministicMode,
      tool_version: version,
      environment: { runtime: 'node', node: process.version, browser: null }
    },
    stages,
    counts,
    reason_codes: reasonCodes,
    failures,
    selector_version: usedSelector,
    scorecard
  };
}

export function buildManifest(files, options = {}) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const inventory = sorted.map((f) => ({ path: f.path, bytes: f.bytes.length, sha256: sha(f.bytes) }));
  const zipHash = sha(Buffer.from(JSON.stringify(inventory)));
  const createdAt = options.createdAtUtc || new Date().toISOString();
  return {
    schema_version: 'export_bundle_manifest.v1',
    bundle: { zip_sha256: zipHash, created_at_utc: createdAt },
    inventory
  };
}

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
