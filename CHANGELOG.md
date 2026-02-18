# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.12 - 2026-02-18
- Fixed rich HTML/Word export image embedding by converting remote image links to Base64 for all platforms before rendering export documents.
- Fixed Word generation for Gemini exports by producing a valid full HTML-as-Word payload instead of nesting a Blob object in Word markup.
- Improved file export reliability by broadening file token detection (including markdown links and URL-like data attributes) and adding credential-aware file fetch fallbacks.
- Added `AIStudioScraper` to extract system instructions, visible model parameters, and prompt turns from AI Studio editor-like DOM structures.
- Improved full-history fetch by ranking scroll containers and using the highest-confidence chat scroller.
- Kept safe initialization guardrails in popup extraction flow to avoid startup regressions when content script reinjection is unavailable.
- Synced runtime/docs metadata to `0.10.12`.

## 0.10.10 - 2026-02-18
- Fixed popup startup flow so top menus remain usable while active tab analysis is running.
- Improved analysis progress lifecycle to start at 5% and update through initialization/extraction/completion.
- Added detected summary counters in popup: messages, photos, files, and others.
- Updated About section text with requested Author & Engineering wording, supported platforms list, and AI-generated-code disclosure.
- Improved Claude file/artifact detection heuristics for downloadable files and artifact-like nodes.
- Synced runtime/docs metadata to `0.10.10`.
