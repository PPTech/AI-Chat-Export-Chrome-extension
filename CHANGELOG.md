# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.9.31 - 2026-02-17
- Improved extractor selectors for ChatGPT (including Codex-like layouts), Claude, Gemini, and AI Studio.
- Reworked image transport from content script using stable `[[IMG:...]]` tokens.
- Reworked HTML/DOC export rendering to convert image tokens into real `<img>` elements.
- Reworked standalone PDF writer to generate a valid xref table and better UTF-16 text handling.
- Synced version metadata across `manifest.json`, popup UI, and docs.
