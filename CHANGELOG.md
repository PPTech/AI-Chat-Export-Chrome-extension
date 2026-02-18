# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.12.12 - Claude Selector Hotfix + Version Surface Alignment
- Fixed invalid selector crash in Claude extraction path by properly escaping class name selector `.group\/status` in `content.js`.
- Synchronized in-app visible version labels in popup (`index.html`) with release metadata.
- Updated settings export/version diagnostics markers to current release value.
- Restored project header markers to `License: MIT` per project instruction.

## 0.12.11 - CSP Fetch Fix + User-Only Export Artifacts + AGPL Headers
- Fixed extension CSP fetch violations for user-initiated media proxy by expanding allowed `connect-src` hosts in `manifest.json`.
- Stopped appending internal diagnostics/manifest JSON files to user export bundles.
- Updated repository license headers from MIT markers to AGPL-3.0 markers in source and tests.

## 0.12.10 - Self-Test Media Count Reconciliation
- Fixed `self_test_local_agent` mismatch where WARN could appear despite visible media in header summary.
- Added media reconciliation in `content.js` using extraction item evidence + DOM evidence before deciding PASS/WARN.
- Added integration contract assertions for self-test media evidence logic.

## 0.12.9 - Runtime Enforcement: Image/File/Integration Smoke Tests
- Added executable runtime smoke tests: `test_image_embed.js`, `test_file_download.js`, and `test_integration.js`.
- Added `npm run test:runtime` script and CI enforcement workflow `.github/workflows/enforce.yml`.
- Hardened delivery gate so image embed/file download/integration contracts are validated before release checks.

## 0.12.8 - Prometheus Visual Inference Rescue Layer
- Added Prometheus visual extraction path in `content.js` (`extract_prometheus_visual`) with recursive shadow traversal, geometry/icon role inference, CodeMirror-aware text extraction, Base64 image freezing, and text-density fallback.
- Added background orchestration route `RUN_PROMETHEUS_EXPORT` to request tab extraction, generate MHTML, and trigger deterministic local download.
- Added dedicated runtime modules `mhtml_generator.js` and `popup.js` and wired popup page loading in `index.html`.
- Added Prometheus integration contracts in `tests/integration/prometheus_runtime_contract.test.mjs`.

## 0.12.7 - Injection/Extraction Hardening + English-Only Source Policy
- Added wildcard ChatGPT host coverage (`*.chatgpt.com`) to manifest host permissions, content script matches, and web-accessible resource matches.
- Upgraded `content_miner/extract.mjs` with a `v4` selector tier, resilient text extraction fallback (`innerText` -> `textContent`), and stronger role inference using subtree metadata hints.
- Extended `packager/build_export_bundle.mjs` contracts with stage-aware diagnostics input and deterministic manifest timestamp override.
- Removed non-English source comments across the repository and refreshed root-cause analysis documentation.

## 0.12.6 - Evidence-Gated Neural-Eye Export Contracts
- Added canonical local-only export modules (`content_miner`, `normalizer`, `attachment_resolver`, `packager`, `self_heal`, `tools/pts`) with deterministic diagnostics and reason-code contracts.
- Added BDD contract feature `features/export.feature` and fixture-based contract tests for extraction, local-only blocking, self-heal persistence, and PTS routing.
- Synchronized release metadata/version headers and kept CI verification gates green.

## 0.12.5 - Permission De-duplication + Integration Map
- Removed redundant CDN domains from required `host_permissions` while keeping them in `optional_host_permissions` to satisfy MV3 validation.
- Updated release verification and integration tests to enforce no duplication between required/optional host permissions.
- Added a detailed inter-file integration map in architecture docs for AI tools and contributor onboarding.

## 0.12.4 - AEGIS Visual Cortex + Universal Artifact Builder
- Added `visual_engine.js` with TreeWalker + ShadowRoot traversal and geometry-based role/code heuristics (no class-selector dependency in cortex path).
- Added `artifact_builder.js` with script-stripping single-file HTML and standards-aligned multipart MHTML primitives.
- Added orchestrator routes for `EXTRACT_VISUAL_CORTEX` and `BUILD_ARTIFACTS_PREVIEW`, plus new contract tests for visual-cortex/artifact modules.

## 0.12.3 - Real Integration & Version Discipline
- Added real image embedding helper (`embedImageAsBase64`) in DataProcessor and routed embedding pipeline through it.
- Integrated security guard/network kill-switch and structured session logging usage into content extraction flow.
- Added release contract tests for real integration markers and synchronized all versions to 0.12.3.

## 0.12.2 - Unified Version Governance Hardening
- Extended sync/verify gates to include `package.json` and runtime file version headers.
- Upgraded release consistency rules so `verify:release` fails on header mismatches in core runtime modules.
- Kept all release metadata synchronized from `version.js` SSOT and documented stricter verification expectations.


## 0.12.1 - Evidence-Gated Version Governance
- Added `FORENSICS/HEAD.txt` capture workflow and `FORENSICS/CLAIMS.md` claim ledger for anti-hallucination release evidence.
- Added `scripts/verify_claims.cjs` and `npm run verify:claims` to enforce script presence, version sync, and forensic export hook checks.
- Updated CI to run claim verification gate and synchronized version markers to `0.12.1`.

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

## 0.11.3 - Legal Shielding (AGPLv3 + Commercial Exception Notices)
- Added root `LICENSE` with GNU AGPLv3 full text.
- Added `COPYRIGHT_HEADER.js` template for AGPLv3 + commercial-license exception notice.
- Added `LEGAL_NOTICE.md` with dual-license and IP warning language.
- Applied legal header block to `content.js`, `background.js`, `smart_vision.js`, and `export_core.js` while preserving project ownership headers.

## 0.11.4 - Audit-Driven Hardening & Release Consistency
- Added CDN host permissions/optional permissions for modern chat asset domains and updated extension CSP for local WASM-capable runtime (`wasm-unsafe-eval`) while keeping `connect-src 'self'`.
- Added popup-side optional permission request flow before extraction/export asset resolution.
- Added release consistency gate (`scripts/verify_release_consistency.cjs`) and CI enforcement.
- Synchronized versions across `manifest.json`, `VERSION.json`, and `metadata.json`.
- Added redaction in background logs to reduce sensitive URL/token leakage in diagnostic entries.
- Added regression tests for release consistency and host-permission coverage.
- Incorporated lessons-learned documentation from deep review feedback.

## 0.11.5 - Agentic Contract + Governance Gates
- Added canonical version source (`version.js`) with sync script and CI enforcement.
- Added model checksum validation gate and release consistency gate in CI.
- Strengthened agent loop to fixed 6-attempt contract and richer plan score trace.
- Added canonical ChatExportDataset builder in popup pipeline and derived legacy tokens for compatibility.
- Added AssetResolutionGraph scaffold and zip-safe filename sanitization.
- Added diagnostics JSONL redacted ring buffer route from service worker.
- Added BDD/PTS updates and fixture scaffolding for e2e agentic testing.

## 0.11.6 - Local Intelligence Signal Integrity
- Improved embedding engine telemetry to explicitly report `loaded`, `fallbackReason`, and embedding dimension for trace reliability.
- Extended recipe memory load path to include prior verifier score and compute per-run score delta in agent learning trace.
- Added canonical diagnostics bundle generation in popup pipeline with required top-level fields.
- Added verifier metrics read API in IndexedDB layer for measurable run-over-run comparisons.

## 0.12.0 - AEGIS 2026 Agentic Upgrade
- Added user-initiated background Media Fetch Proxy with strict host allowlist and denial for non-user-initiated requests.
- Enriched agent payload with redacted DOM snapshot (<=40k chars) and explicit extraction goals.
- Extended plan metadata (`confidence`, `why`) and trace fields (`goalHints`, `domSnapshotChars`).
- Exposed purge-learning action in options UI.
- Added 2026 validation tests and BDD scenarios plus an explicit Intelligence Scorecard document.
- Synchronized release version to 0.12.0 across manifest/version metadata.

- Added `docs/THREAT_MODEL.md` and `docs/PREMIUM_AGENT_CONSOLE_DESIGN.md` plus export bundle manifest emission (`*.diagnostics.json`, `*.export_bundle_manifest.json`).
