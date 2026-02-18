# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Project Memory

- Product: AI Chat Exporter Chrome extension (developer preview, pre-1.0).
- Core objective: extract complete conversations (text, code, images) from supported AI chat apps and export multi-format files.
- Current known constraint: high-fidelity multilingual PDF rendering (complex scripts) in pure browser JS is limited without embedded Unicode fonts.
- Priority reliability targets:
  1. Full-history extraction across lazy-loaded chat UIs.
  2. Correct media embedding in HTML/DOC/PDF.
  3. Stable multi-tab isolation with clear logs.


## Platform Engine Orchestrator
- v0.10.19: Added SmartMiner fallback path to avoid extraction hard-failure when SmartAgent injection is missing.
- v0.10.26: Optimized SmartMiner with TreeWalker and added offscreen local classifier routing for richer extraction diagnostics.
 (v0.10.18)
- Dedicated engine per platform for selectors and role mapping.
- Standardized message contract for export compatibility.
- Image tokens captured before node cleanup to preserve media in rich exports.

- Runtime state is isolated per-tab in service-worker memory with explicit clear paths and short-lived capture windows.
- Settings persist locally and are exportable as `.cfg` backup.
- Popup now includes draft menu entries for Login/Contact and analysis progress percentage.
- Added file token export flow for chat-generated artifacts with ZIP packaging.
- Added cross-service link scan actions and ChatGPT sandbox download diagnostics (`Ping`, scan table, PASS/WARN/FAIL logs).
- Added local-agent layer (`smart_agent`, `ai_engine`, `offscreen`, `recipes_store`) for offline visual+semantic extraction and self-healing fallback.


## AEGIS-2026 Memory Snapshot (v0.11.1)
- Added architecture-level modules for visual extraction, offline text classification, secure network interception, MHTML generation, and forensic logging.
- Manifest pipeline now injects security + vision + brain modules before content orchestration.
- Release quality gate now includes targeted A/B checks for security allowlist and code auto-wrap normalization.
- Documentation maturity objective: each release produces operator-ready details enabling full handover to a new engineer.

- v0.11.2: Agentic extraction promoted to default runtime path with legacy fallback retained for resilience.
- v0.11.2: SmartAgent now emits selector data, unlocking better recipe reuse and online learning convergence.
- v0.11.2: Continuity docs and PTS mapping added for faster onboarding and safer release governance.

- v0.11.3: Legal compliance layer added (AGPLv3 license file, copyright header template, legal notice, and header injection on key runtime files).

- v0.11.4: Implemented critique-driven remediation: release version sync, CDN permission hardening, optional permission request flow, and log redaction safeguards.
- v0.11.4: Added explicit regression tests and CI gate for release consistency to prevent drift between manifest/version metadata.
