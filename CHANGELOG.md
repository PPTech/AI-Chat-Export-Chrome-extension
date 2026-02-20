# Changelog
# Author: Dr. Babak Sorkhpour (with help of AI)

## 0.12.0 - 2026-02-20

### Diagnostics pipeline
- **Always-on diagnostics**: `persistExtractionDiagnostics` now always overwrites `lastDiagnostics` with latest extraction data (was only set once).
- **GET_DIAGNOSTICS alias**: Added backwards-compatible `GET_DIAGNOSTICS` handler in service worker (routes to `GET_DIAGNOSTICS_JSONL`).
- **Schema v6 unified**: Both extraction and export diagnostics now use `diagnostics.v6` consistently.
- **COMMAND_IN/COMMAND_OUT invariant**: Documented and tested contract that every background message gets a response.

### Fail-soft export
- **Bundle manifest renamed**: `export_manifest.json` → `export_bundle_manifest.json` with schema `export-bundle-manifest.v1`.
- **Asset failure reasons**: Manifest now includes `assetFailureReasons` array with truncated URLs and reason codes.
- **Always-bundled**: Diagnostics summary and bundle manifest now included in every export (not just multi-file ZIP mode).

### Attachment classifier
- **Favicon filtering**: `.ico` moved from IMAGE_EXTENSIONS to HARD_IGNORE_EXTENSIONS — favicons blocked by default.
- **Allowlist cleanup**: Removed `githubusercontent.com` from ASSET_ALLOWLIST (was a placeholder host).

### Tests
- New: `failsoft_bundle_contract.test.mjs` — validates bundle manifest, diagnostics, and asset failure reasons always present.
- New: `background_invariants.test.mjs` — validates every background.js handler calls `sendResponse()`.
- Updated: `failsoft_diagnostics_contract.test.mjs` — refs updated for renamed manifest and v6 schema.

### Cleanup
- Removed dead `_unused_detectScriptProfile()` function from `script.js`.
- Updated `verify_claims.cjs` to check renamed manifest.

### Docs
- Updated `README.md` and `CHANGELOG.md` for v0.12.0.
- Version bumped via SSOT (`lib/version.mjs` → all files).

## 0.11.0 - 2026-02-20

### New features
- **ChatGPT full history**: API-based extraction via `/backend-api/conversation/{id}` gets all messages without scrolling. DOM fallback when API unavailable.
- **Canvas PDF**: Browser-canvas rendering for full Unicode support (Arabic, Persian, CJK) with inline image embedding.
- **Asset embedding in ZIP** (D6): Images and files resolved during export, stored in `assets/` folder inside ZIP. HTML/DOC/Markdown references rewritten to local paths. Allowlisted hosts only.
- **Always-on diagnostics** (D2): Every extraction attempt (success or fail) produces a downloadable diagnostic bundle. "Download Diagnostics" falls back to service worker storage.
- **AI Studio multi-strategy extractor** (D4): 4-strategy ladder (shadow DOM, expanded flat DOM, geometry-based, MutationObserver wait-then-retry).
- **Flight Recorder v3** (D7): Structured event types, run correlation IDs, content redaction in non-verbose mode, asset resolution rate scorecard, failure reason aggregation. Schema v6.

### Bug fixes
- **Protocol fix** (D1): `EXTRACTION_PROGRESS` handler added to service worker. Extraction result messages downgraded from ERROR to INFO. Zero `UNKNOWN_ACTION` spam.
- **Gemini role splitting** (D3): Combined transcript blocks ("You said ... Gemini said ...") split into separate user/assistant turns. UI noise ("Show thinking", button labels) stripped. `unknown_role_ratio` target < 5%.
- Real-time extraction progress bar in popup UI.

### How to verify
1. Export any chat → ZIP contains `assets/` folder with resolved images + `asset_manifest.json`.
2. Click "Download Diagnostics" after a failed extraction → bundle is available.
3. Export a Gemini chat → roles should be User/Gemini (not Unknown); no "Show thinking" in content.
4. Export from AI Studio → nonzero message count with strategy info in diagnostics.
5. Check logs → zero `UNKNOWN_ACTION` entries.

## 0.10.11 - 2026-02-19

### What broke
- Diagnostics download showed "No Diagnostics" even after export (debug OFF = no data).
- Export failed entirely if any single attachment/format couldn't download.
- ChatGPT roles were ~62% unknown; Gemini almost all unknown.
- Word .doc output was mislabeled HTML; PDF had encoding issues.
- AI Studio export hung at "Analyzing active tab...".
- Scripts/docs/icons were misclassified as attachments.
- Repo contained 60+ dead files from prior AI agent iterations.

### What fixed
- **Phase 1 — Diagnostics**: Always-on flight recorder (v5 schema). Service worker stores diagnostics (STORE_DIAGNOSTICS / GET_DIAGNOSTICS_JSONL handlers). Ring buffer, invariant checks, anomaly scoring 0..100.
- **Phase 2 — Gesture**: Time-windowed gestureToken (30s TTL). assertGesture() blocks expired tokens. verify_gesture_path.cjs CI gate.
- **Phase 3 — Attachment classifier**: Deterministic rules in lib/attachment_classifier.mjs. Hard-ignore scripts/exe/DLL. Favicon and small icon filtering.
- **Phase 4 — Asset fetch**: Redirect-tracing resolver. data:/blob: local handling. Optional host permissions for Gemini (lh3.google.com redirect) and ChatGPT (oaiusercontent.com).
- **Phase 5 — Full history**: ChatGPT SSOT extraction via __NEXT_DATA__ / __remixContext__. ensureChatFullyLoaded() scroll stabilization. warmupLazyMedia() for IntersectionObserver.
- **Phase 6 — Role inference**: 7-layer cascade (data-message-author-role → data-testid → ARIA → avatar → class → layout → content). Confidence threshold 0.35.
- **Phase 7 — AI Studio**: Platform engine with Web Component selectors. Content scripts match aistudio.google.com.
- **Phase 8 — Output quality**: Honest HTML .doc (no fake MHTML). Text-based PDF with Helvetica Type1. Canonical ChatExportDataset SSOT.
- **Phase 9 — Cleanup**: Removed 60+ dead files (agent/, models/, smart_*.js, ai_engine.js, offscreen, options, visual_*, etc.). Pruned dead docs, features, tests, CI scripts.
- **Phase 10 — Version SSOT**: lib/version.mjs single source. verify_version.cjs + verify_claims.cjs CI gates.
- **Fail-soft export**: Per-format try/catch. Always emits export_manifest.json + diagnostics_summary.json in ZIP.

### How to verify
1. Export any chat with Debug Mode OFF → ZIP must contain export_manifest.json + diagnostics_summary.json.
2. Click "Download Diagnostics" after export → always works (not gated by debug).
3. Export a ChatGPT chat → unknown_role_ratio should be < 5%.
4. Try exporting with a broken image URL → export succeeds with text formats; check manifest for failure details.
5. Run: `node scripts/verify_version.cjs && node scripts/verify_claims.cjs && node scripts/verify_gesture_path.cjs`

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
