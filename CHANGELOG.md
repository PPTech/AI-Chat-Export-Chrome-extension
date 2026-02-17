# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.5 - 2026-02-17
- Added Claude structure discovery endpoint in `content.js` (`discover_claude_structure`) that inspects real DOM candidates and saves results to `window.CLAUDE_DOM_DISCOVERY`.
- Updated ChatGPT platform naming: URLs under `https://chatgpt.com/codex` are now labeled as `ChatGPT Codex`.
- Improved HTML/Word rendering to generate complete web-page output and embed image tokens without escaping image URLs.
- Added photo export mode choice: users can choose ZIP pack or batch file export.
- Added visible progress percentages during package generation in popup processing state.
- Synced runtime/docs version metadata to `0.10.5`.

## 0.10.4 - 2026-02-17
- Added a dedicated `GeminiExtractor` probe engine with explainable scope detection, turn discovery, role inference evidence, and ordered semantic block parsing without brittle CSS dependencies.
- Integrated Gemini extraction through analyzer output (`window.GEMINI_DOM_ANALYSIS`) and normalized message conversion for export compatibility.
- Synced runtime and documentation version metadata to `0.10.4`.
