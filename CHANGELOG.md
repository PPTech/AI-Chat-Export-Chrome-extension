# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.10 - 2026-02-18
- Fixed popup startup flow so top menus remain usable while active tab analysis is running.
- Improved analysis progress lifecycle to start at 5% and update through initialization/extraction/completion.
- Added detected summary counters in popup: messages, photos, files, and others.
- Updated About section text with requested Author & Engineering wording, supported platforms list, and AI-generated-code disclosure.
- Improved Claude file/artifact detection heuristics for downloadable files and artifact-like nodes.
- Synced runtime/docs metadata to `0.10.10`.

## 0.10.9 - 2026-02-18
- Stabilized popup initialization by moving startup execution to a safe end-of-script `safeInit()` call so menu buttons remain usable during active-tab analysis.
- Restored simpler background tab-state manager (no runtime AES layer) to remove extraction-state compatibility regressions.
- Kept chat-generated file export feature (`Extract and ZIP Chat Files` + `Export Files` ZIP action).
- Retained ChatGPT fallback extraction path when analyzer returns zero messages.
- Synced runtime/docs metadata to `0.10.9`.
