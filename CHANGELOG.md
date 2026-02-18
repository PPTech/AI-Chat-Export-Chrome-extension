# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.11 - 2026-02-18
- Added `GeminiArtifactGenerator` class with image-to-Base64 processing, file link scanning, static HTML generation, and Word generation helpers.
- Integrated Gemini HTML/Word export path to pre-process expiring image URLs into offline-safe Base64 content.
- Fixed startup flow issue causing `SETTINGS_KEY` access-before-initialization regressions by preserving safe init ordering.
- Extended Claude file extraction for artifact/iframe content and srcdoc-based artifact capture.
- Added detection summary counters in UI and updated About text with supported platforms and requested Author/Engineering wording.
- Synced runtime/docs metadata to `0.10.11`.

## 0.10.10 - 2026-02-18
- Fixed popup startup flow so top menus remain usable while active tab analysis is running.
- Improved analysis progress lifecycle to start at 5% and update through initialization/extraction/completion.
- Added detected summary counters in popup: messages, photos, files, and others.
- Updated About section text with requested Author & Engineering wording, supported platforms list, and AI-generated-code disclosure.
- Improved Claude file/artifact detection heuristics for downloadable files and artifact-like nodes.
- Synced runtime/docs metadata to `0.10.10`.
