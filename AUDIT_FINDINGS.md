# License: AGPL-3.0
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Repository Audit Findings

## Scope
- Repository: `AI-Chat-Export-Chrome-extension`
- Audit date: 2026-02-18
- Method: static code review + fixture/integration test run (`npm test`)

## Confirmed Bottlenecks (Root Causes)

1. **Content injection coverage mismatch**
   - `manifest.json` did not include wildcard ChatGPT rollout hosts (`*.chatgpt.com`) across all relevant sections.
   - Result: content script could fail to inject on valid ChatGPT pages.

2. **Selector and text extraction fragility**
   - `content_miner/extract.mjs` relied mainly on older selector patterns and `innerText`.
   - Result: some DOM snapshots produced empty message payloads even when message nodes existed.

3. **Role inference underfit**
   - Role detection did not consistently consume subtree metadata (`data-testid`, nested role hints).
   - Result: too many `unknown` roles and lower downstream quality.

4. **Diagnostics explainability gaps**
   - Diagnostics builder did not always include stage records in a single contract call.
   - Result: difficult triage when extraction/resolution latency or failures occurred.

5. **Documentation drift**
   - README version and audit statements were stale relative to current architecture.
   - Result: misleading operational expectations and weaker incident response.

## Remediation Applied

- Added `https://*.chatgpt.com/*` coverage to host permissions, content script matches, and web-accessible resource matches.
- Added selector tier `v4` and robust text fallback (`innerText` to `textContent`) in extractor.
- Hardened role inference via combined direct + subtree metadata hints.
- Extended diagnostics contract to accept `stages` and manifest contract to accept deterministic `createdAtUtc` override.
- Removed non-English comment text from repository files (English-only source policy).
- Updated documentation (`README.md`, `CHANGELOG.md`) to reflect 0.12.7 fixes.

## Residual Risks / Next Work

- Add runtime telemetry sampling to compare selector hit-rates by host variant.
- Add deterministic bundle integration tests that assert fixed timestamps in manifest output.
- Add browser-level smoke test for ChatGPT subdomain rollout hosts in CI.
