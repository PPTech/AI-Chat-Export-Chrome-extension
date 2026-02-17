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


## Platform Engine Orchestrator (v0.10.3)
- Dedicated engine per platform for selectors and role mapping.
- Standardized message contract for export compatibility.
- Image tokens captured before node cleanup to preserve media in rich exports.
