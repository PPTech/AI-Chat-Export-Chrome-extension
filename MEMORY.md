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
- v0.10.23: Optimized SmartMiner with TreeWalker and added offscreen local classifier routing for richer extraction diagnostics.
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
