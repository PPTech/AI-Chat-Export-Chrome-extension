# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Security, Privacy & Compliance Model (v0.10.10)

> Important: This document is a technical implementation guide, not legal advice.

## 1) Core Privacy Rule
- Chat content (text/code/images) is processed locally in-browser.
- The extension does not use remote AI APIs for extraction.
- No telemetry endpoint is configured for chat payload transfer.

## 2) Data Classification
- **Sensitive user data**: prompts, model responses, uploaded images.
- **Operational data**: error logs and counts.
- **Configuration data**: export preferences.

## 3) Storage and Encryption
- Chat extraction cache (per-tab) is encrypted in extension runtime memory using AES-GCM (`background.js`).
- Settings are saved in `chrome.storage.local` and can be exported by user as `.cfg`.
- Exported files are user-triggered and saved locally.

## 4) Security Controls (Algorithmic)
1. Sanitization: remove `script/style/button/svg` noise in extraction clone.
2. Output escaping: HTML text escaped before rich rendering.
3. No dynamic execution: no `eval`, no remote code loading.
4. Least privilege: extension permissions limited to required browser capabilities.
5. Local-only engine: role inference and DOM analysis execute on user machine.

## 5) Regulatory Mapping (EU/US)

### GDPR / DSGVO (EU + Germany)
- Lawfulness/transparency: local processing design documented in README.
- Data minimization: only active-tab chat data processed.
- Purpose limitation: extraction/export only.
- Integrity/confidentiality: encrypted runtime cache and local-only processing.
- User rights support: user can clear data, export, and control local files.

### CCPA/CPRA (US)
- No sale or sharing of chat content by runtime design.
- No ad-targeting data pipeline exists in extension runtime.

## 6) Security Standards Alignment Notes
- **BSI/CISA/NSA principles** applied:
  - secure-by-default,
  - minimal attack surface,
  - explicit user actions for data export,
  - no hidden data exfiltration channels.

## 7) Incident and Audit Guidance
- Keep `AUDIT_FINDINGS.md`, `CHANGELOG.md`, and workflow logs updated each release.
- Re-run checks (`node -c`, build, BDD generation) before publishing.
