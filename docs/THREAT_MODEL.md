# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Threat Model (v0.12.0)

## Scope
- Chrome MV3 extension processing chat content locally for export.

## Primary Threats
1. Data exfiltration through unauthorized outbound requests.
2. DOM-hosted malicious payloads causing XSS in exported files.
3. Attachment/file path traversal and zip-slip risks.
4. Model tampering through altered local artifacts.
5. Deceptive UI flows causing unsafe click automation.

## Defenses
- Local-only guards in extension/offscreen contexts.
- Allowlisted + user-initiated media proxy only.
- Filename sanitization and zip-safe packaging.
- Redacted diagnostics logs by default.
- Model checksum validation gates and startup integrity checks.

## Residual Risks
- Provider-side UI changes can reduce extraction fidelity until new recipes are learned.
- Optional host permission denial by user may reduce image/file completeness.
