# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.22 - 2026-02-18
- Upgraded `smart_agent.js` with incremental candidate mining runtime (`IntersectionObserver`, `MutationObserver`, `requestIdleCallback`) and capped prioritized sweeps for large DOM responsiveness.
- Strengthened semantic evidence in `NodeScorer.calculateProbability()` with alignment and file-signal ratios for auditable decisions.
- Hardened `offscreen.js` LocalOnlyGuard by patching `WebSocket` and `EventSource` in addition to `fetch`/`XMLHttpRequest`, with explicit local-only startup log.
- Improved Self-Test in `content.js` to validate local classifier initialization (`LOCAL_INIT_CLASSIFIER`) and report local-only/classifier status in PASS/WARN/FAIL details.
- Synced runtime/docs metadata to `0.10.22`.

## 0.10.21 - 2026-02-18
- Added `VerifierLoop` (`ExtractionVerifier`) to validate extraction quality (`FAIL` for zero messages, `WARN` for role imbalance) before finalizing output.
- Added `SelfHealer` text-density fallback flow in `content.js` that auto-recovers when verifier returns FAIL/WARN.
- Added robust `RecipeManager` IndexedDB wrapper (`recipes_store.js`) for recipes, chat history JSON, and image blobs with `domainFingerprint` keys.
- Added learned-recipe first pass in extraction flow and auto-save of successful fallback selectors for future runs.
- Extended offscreen/background message routing for recipe/chat/image storage and retrieval (`LOCAL_GET_RECIPE`, `LOCAL_SAVE_RECIPE`, `LOCAL_SAVE_CHAT`, `LOCAL_SAVE_IMAGE`).
- Synced runtime/docs metadata to `0.10.21`.

## 0.10.20 - 2026-02-18
- Optimized `smart_miner.js` traversal using `TreeWalker` with ShadowRoot queue to reduce scan overhead and avoid broad `querySelectorAll` sweeps.
- Added offscreen local classifier service in `offscreen.js` with local-only network kill-switch and regex+AI hybrid artifact detection (`sandbox:/`, `/mnt/data/`, file extensions).
- Added background routing actions to offscreen (`LOCAL_INIT_CLASSIFIER`, `LOCAL_CLASSIFY_TEXT`, `LOCAL_DETECT_ARTIFACTS`) for content-script/offscreen traffic.
- Upgraded extraction diagnostics in `content.js` with AI tag samples to improve debug usefulness for photo/file extraction issues.
- Synced runtime metadata to `0.10.20`.

## 0.10.19 - 2026-02-18
- Fixed `SmartAgent not loaded` runtime failure by injecting `smart_miner.js` + `smart_agent.js` together with `content.js` in fallback reinjection path.
- Added new DOM-agnostic visual mining engine `smart_miner.js` with `VisualCandidate`, geometry scan, main-column filtering, role heuristics, and `window.extractVisualSnapshot()` diagnostics.
- Integrated SmartMiner fallback into local extraction when SmartAgent is unavailable, so Extract/Self-Test still produce useful outputs.
- Improved extraction diagnostics using structured console logs/tables for candidate and result debugging.
- Synced runtime metadata and popup version to `0.10.19`.

## 0.10.18 - 2026-02-18
- Added an offline-first local agent foundation:
  - `smart_agent.js` (visual candidate miner + semantic scorer + clustering),
  - `ai_engine.js` (deterministic self-heal planner),
  - `recipes_store.js` (IndexedDB recipe memory),
  - `offscreen.html/offscreen.js` (hidden local engine bridge),
  - `options.html/options.js` (local planner/debug options),
  - `tests/bdd/local_agent.feature`, `tests/runner.js`, `pts.config.json`.
- Added LocalOnlyGuard protections in extension contexts and strict extension-page CSP (`connect-src 'self'`) plus startup local-only log.
- Added popup controls for local agent workflow: `Extract`, `Self-Test`, `Debug Overlay`, and retained deterministic `Ping` validation.
- Added content-script local agent actions: `extract_local_agent`, `self_test_local_agent`, page-side blob fetch proxy (`fetch_blob_page`), and debug globals (`window.__LOCAL_AGENT_STATE__`, `window.__LOCAL_AGENT_RESULT__`).
- Fixed CORS/malformed URL issues by sanitizing token tails before any media fetch and moving blob retrieval to page context where required.
- Improved image naming/format behavior by MIME-based extension sniffing with normalized output.
- Improved file download fallback path when ZIP packaging fails by direct browser download attempts.
- Strengthened AI Studio deep extraction (Shadow DOM + CodeMirror/ProseMirror + fallback value/slot paths + delayed hydration handling).
- Improved detected `others` summary to transparently show code/link/quote counts.
- Synced runtime/docs metadata to `0.10.18`.

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
