# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.26 - 2026-02-18
- Implemented comprehensive image extraction in `DataProcessor.extractAllImages()` including regular `<img>`, background images, and Shadow DOM traversal.
- Implemented comprehensive file detection in `DataProcessor.detectAllFileReferences()` covering download attributes, blob links, sandbox paths, extension patterns, and present-file markers.
- Added robust `downloadAllFiles()` with retry/error summary and sandbox resolution hook, integrated into popup `Export Files` flow with detailed progress logs.
- Added content-script diagnostics actions: `test_image_extraction` and `test_file_detection` for direct runtime validation.
- Updated export flows to preserve Base64 embedding fallback (`[Image Load Failed]`) and synced metadata/docs to `0.10.26`.

## 0.10.25 - 2026-02-18
- Added `visual_walker.js` with DOM-agnostic `VisualDOMWalker` (viewport-visible div scan + alignment/mono heuristics for USER/MODEL/CODE tagging).
- Added `asset_processor.js` (`DataProcessor`) for Base64 embedding with resilient fallback (`[Image Load Failed]`) and download metadata extraction.
- Added `export_manager.js` single-file HTML/Word generator with inline CSS and offline Base64 image rendering support.
- Updated `script.js` export flow to use `DataProcessor` + `ExportManager` where available and preserve page-context blob resolver usage.
- Updated `content.js` extraction flow to apply `VisualDOMWalker` fallback when platform engine yields zero messages.
- Synced runtime/docs metadata to `0.10.25`.

## 0.10.24 - 2026-02-18
- Fixed Claude extraction quality by prioritizing real content containers (`prose/markdown/message-content`) and filtering UI noise blocks (status/grid/transition/button wrappers).
- Improved Claude text cleaning pipeline to skip UI-only lines and preserve meaningful paragraphs/code/file links.
- Improved file token capture by reading `link.href` in addition to attributes for blob/normalized URLs.
- Kept popup CORS/CSP-safe media flow from page-context proxy and synced runtime/docs metadata to `0.10.24`.

## 0.10.23 - 2026-02-18
- Fixed popup-side CORS/CSP media failures by removing remote `fetch(...)` usage from popup cache/image conversion paths and forcing page-context blob retrieval.
- Updated `GeminiArtifactGenerator.toBase64()` and temp media cache to use `fetchFileBlob()` (content-script proxy) instead of direct extension-page fetch.
- Extended `fetch_blob_page` in `content.js` to resolve `sandbox:/mnt/data/...` references to real downloadable DOM hrefs when available.
- Improved data-url handling in page fetch proxy to avoid `connect-src` violations for `data:` resources.
- Synced runtime/docs metadata to `0.10.23`.

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

## 0.11.0 - True Local AI Agent
- Added agent loop modules (`/agent`) with local embeddings, multi-plan search, verifier scoring, and online learner persistence.
- Wired `OFFSCREEN_RUN_AGENT` into extraction critical path and persisted learning artifacts in IndexedDB.
- Added AssetBroker allowlist controls, gesture proof token flow, and docs/test scaffolding for proof-of-intelligence.

## 0.11.1 - AEGIS-2026 Documentation + Security/Export Hardening
- Added production modules: `smart_vision.js`, `security_guard.js`, `offline_brain.js`, `export_core.js`, and `logger.js` with explicit local-only and anti-tamper controls.
- Updated `manifest.json` to include AEGIS modules in content-script pipeline, strict extension CSP, and web-accessible resource declarations.
- Extended `background.js` with `DOWNLOAD_MHTML_ARTIFACT` action for service-worker download management of generated MHTML artifacts.
- Added unit tests validating AEGIS security allowlist and local offline classifier code-wrapping behavior.
- Expanded project documentation and memory baselines for version-control traceability, module responsibilities, and release-readiness handoff.

## 0.11.2 - Agentic Default Path + Continuity Governance
- Set extraction default flow to `self_test_local_agent` + `extract_local_agent` first, with legacy `extract_chat` fallback only on failure.
- Added selector emission in `smart_agent.js` candidates/items to improve recipe persistence and iterative learning quality.
- Added local asset verification gate (`scripts/verify_local_assets.cjs`) and bundled local runtime fallback asset (`lib/transformers.min.js`) with model metadata.
- Expanded asset allowlists for modern ChatGPT/CDN host patterns including `*.oaiusercontent.com`.
- Added continuity/security docs: `AGENTIC_ARCHITECTURE.md`, `SECURITY.md`, `RELEASE_CHECKLIST.md`, `PROJECT_CONTINUITY_BRIEF.md`, `diagnostics_schema.json`, and `pts_map.json`.
- Added A/B and diagnostics contract integration tests.
