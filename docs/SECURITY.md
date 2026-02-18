# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Security Notes (v0.11.2)

## CSP
- Extension pages use strict local CSP: no remote scripts, no remote connect-src.

## Allowlist Policy
- Asset hosts are allowlisted and must be linked to supported chat providers/CDNs.
- Same-origin mode can be enforced operationally for high-assurance environments.

## Attack Surface
- Content scripts (DOM ingestion)
- Asset resolution in page context (credentialed fetch)
- Export rendering pipeline

## Controls
- Network kill-switch for non-local schemes in guarded contexts.
- Filename/path sanitization and zip-slip prevention guidance.
- HTML escaping for exported user content.
- Local-only model/runtime asset verification gate in CI.
