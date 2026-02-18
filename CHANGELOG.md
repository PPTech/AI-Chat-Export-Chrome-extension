# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.8 - 2026-02-18
- Added chat file extraction tokens (`[[FILE:url|name]]`) in content parsing and a new popup action to download detected chat-generated files as ZIP.
- Added new settings option `Extract and ZIP Chat Files` and integrated it into extraction options.
- Added `Export Files` action button in popup.
- Improved extraction resilience by adding ChatGPT fallback node scan when analyzer result is empty.
- Hardened popup data flow with null-response handling so menu actions remain usable while analysis is in progress.
- Synced runtime/docs metadata to `0.10.8`.

## 0.10.7 - 2026-02-17
- Improved multilingual PDF rendering by adding script-aware line wrapping (`wrapLineSmart`) with dedicated RTL and CJK handling.
- Updated canvas text drawing to apply language direction (`rtl/ltr`) dynamically per text block.
- Kept image embedding in PDF while improving mixed-language message readability.
- Preserved complete standalone HTML/Word export rendering path with image token to `<img>` conversion.
- Synced runtime/docs metadata to `0.10.7`.
