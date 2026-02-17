# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Security & Privacy Model (v0.10.3)

## Core Principle
All extraction, normalization, and export processing is executed locally in the user's browser extension context.

## Data Handling Rules
1. No chat payload is sent to external AI APIs by this extension runtime.
2. No background telemetry endpoint is configured for message content.
3. Adaptive analyzer is local-only heuristic scoring on page DOM.
4. Export artifacts are created on-device and downloaded by the browser.

## Encryption and Storage
- No remote storage is used for extracted messages.
- Temporary runtime state is tab-scoped in extension background memory.
- Optional local file downloads are user-triggered.

## Threat Surface Controls
- Script/style nodes are removed from extracted clones.
- HTML export sanitizes content before reconstruction.
- No `eval` or dynamic script execution in extraction/export flow.

## Compliance Mapping (operational)
- GDPR/DSGVO: local processing, data minimization, no external transfer by default.
- CCPA-style expectation: no sale/share of data by extension runtime.
- BSI/NSA/CISA baseline alignment: least privilege, local processing, explicit user action for export.
