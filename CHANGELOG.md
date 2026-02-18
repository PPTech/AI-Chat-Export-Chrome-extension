# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.13 - 2026-02-18
- Added dedicated ChatGPT sandbox file workflow with popup actions: **Scan File Links** and **Resolve + Download All**.
- Implemented explainable `FileRef` discovery in content script across anchor/text/button sources with canonical `sandbox:/mnt/data/...` normalization, deduplication, and `window.__CHATGPT_FILE_LINKS__` diagnostics.
- Implemented dynamic sandbox link resolution pipeline using service-worker download capture and webRequest fallback capture windows.
- Added sequential resolve/download execution with per-file logs and final PASS/WARN/FAIL summary for ChatGPT file extraction jobs.
- Added webRequest permission in manifest for non-blocking request-capture fallback during dynamic link resolution.
- Synced runtime/docs metadata to `0.10.13`.

## 0.10.10 - 2026-02-18
- Fixed popup startup flow so top menus remain usable while active tab analysis is running.
- Improved analysis progress lifecycle to start at 5% and update through initialization/extraction/completion.
- Added detected summary counters in popup: messages, photos, files, and others.
- Updated About section text with requested Author & Engineering wording, supported platforms list, and AI-generated-code disclosure.
- Improved Claude file/artifact detection heuristics for downloadable files and artifact-like nodes.
- Synced runtime/docs metadata to `0.10.10`.
