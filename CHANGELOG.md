# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.9 - 2026-02-18
- Stabilized popup initialization by moving startup execution to a safe end-of-script `safeInit()` call so menu buttons remain usable during active-tab analysis.
- Restored simpler background tab-state manager (no runtime AES layer) to remove extraction-state compatibility regressions.
- Kept chat-generated file export feature (`Extract and ZIP Chat Files` + `Export Files` ZIP action).
- Retained ChatGPT fallback extraction path when analyzer returns zero messages.
- Synced runtime/docs metadata to `0.10.9`.

## 0.10.8 - 2026-02-18
- Added chat file extraction tokens (`[[FILE:url|name]]`) in content parsing and a new popup action to download detected chat-generated files as ZIP.
- Added new settings option `Extract and ZIP Chat Files` and integrated it into extraction options.
- Added `Export Files` action button in popup.
- Improved extraction resilience by adding ChatGPT fallback node scan when analyzer result is empty.
- Hardened popup data flow with null-response handling so menu actions remain usable while analysis is in progress.
- Synced runtime/docs metadata to `0.10.8`.
