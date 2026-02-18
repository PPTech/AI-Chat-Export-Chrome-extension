# 🚀 AI Chat Exporter Ultimate

**Version**: 0.10.26  
**License**: MIT (Ultimate Edition)  
**Code Source**: Generated with support from CODEX and CODEX CLI.  
**Owner / Management**: Dr. Babak Sorkhpour ([@Drbabakskr](https://x.com/Drbabakskr))  
**Author**: Dr. Babak Sorkhpour with support from Gemini, Google AI Studio, ChatGPT, OpenAI Codex and Claude.ai.

---

## 📋 Status & Support

| Format | Status | Notes |
|:---|:---|:---|
| **Markdown** | 🟢 **Stable** | Standard text formatting supported. |
| **HTML** | 🟢 **Stable** | Full layout, embedded images, responsive. |
| **JSON** | 🟢 **Stable** | Minified (no newlines) for data analysis. |
| **DOCX** | 🟢 **Stable** | Offline embedded images (Word ready). |
| **CSV** | 🟢 **Stable** | Excel compatible (UTF-8, single line rows). |
| **SQL** | 🟢 **Stable** | PostgreSQL compatible dumps. |
| **PDF** | 🟢 **Stable** | Standalone file generation with embedded page rendering for multilingual reliability and image inclusion. |

## 🛠 Features

*   **Secure Isolation**: Each extraction process runs independently within its own tab context.
*   **Zero-Dependency**: Operates entirely locally without external API calls.
*   **Industrial Archiving**: CRC32 validated ZIP archives.
*   **Embedded Media**: Automatically converts remote images to Base64 for fully offline Word and HTML documents.
*   **CORS/CSP-safe media embedding**: Popup routes media fetch through page-context proxy to avoid extension-page CORS/connect-src failures.
*   **Claude content-noise filter**: Extractor prioritizes prose/markdown content containers and removes UI-status noise before parsing text/files.
*   **Temporary Media Cache Hygiene**: Downloads media to temporary in-memory cache during export, embeds output, then clears cache at begin/finish/close.
*   **Security Hardened**: Input sanitization prevents XSS in exported files.
*   **Local Agent (Air-Gapped Ready)**: Visual + semantic local extraction with self-test and recipe fallback; no external AI API required.

## 🧠 Prompt & Extraction Strategy by Service (Summary)

This section documents **what prompt strategy/heuristics** are used for each provider and **why**. It avoids exposing proprietary internal scoring constants while giving technical transparency.

### ChatGPT / OpenAI Codex
- **Goal:** detect robust message turns and downloadable assets (including `sandbox:/mnt/data/...`).
- **How:** DOM analyzer + sandbox link scanner (anchor/text/button + shadow traversal).
- **Why:** ChatGPT often renders downloads as UI actions rather than stable direct URLs.
- **Short code sample:**

```js
const refs = discoverSandboxFileRefs(rootEl);
for (const ref of refs) {
  const resolved = await resolveFileRef(ref, tabId, rootEl);
  await downloadResolvedFile(resolved);
}
```

### Claude.ai
- **Goal:** discover and extract user/assistant turns plus file/link presentation diagnostics.
- **How:** adaptive turn selectors + `discover_claude_files` runtime diagnostics.
- **Why:** Claude UI variants can change quickly and discovery visibility is required before hardening selectors.
- **Short code sample:**

```js
chrome.tabs.sendMessage(tabId, { action: 'discover_claude_files' }, (res) => {
  console.log(res.findings);
});
```

### Gemini
- **Goal:** parse role, blocks, code, images, and artifact links with explainable evidence.
- **How:** probe-style extractor and block parser with confidence metadata.
- **Why:** dynamic Gemini layouts use mixed semantics and require scoring + evidence.

### Google AI Studio
- **Goal:** capture system instruction + user/model turns + attachments from editor-based UI.
- **How:** `AIStudioExtractor` with deep shadow traversal, textarea/contenteditable/CodeMirror/ProseMirror heuristics, blob-to-base64 for image attachments.
- **Why:** user prompts are frequently stored in editor layers, not plain paragraph nodes.
- **Short code sample:**

```js
const extractor = new AIStudioExtractor(utils, options);
const result = await extractor.scrape();
console.log(result.system_instruction, result.turns.length);
```

## 🧩 Local Agent Runtime (Offline)

- `visual_walker.js`: strict heuristic `VisualDOMWalker` for selector-agnostic viewport extraction (USER/MODEL/CODE).
- `asset_processor.js`: `DataProcessor` for robust Base64 embedding and file metadata extraction.
- `export_manager.js`: single-file HTML/Word export generator with inline styles and offline images.
- `smart_miner.js`: DOM-agnostic visual mining (TreeWalker traversal + geometry/style/alignment heuristics) and `extractVisualSnapshot()` diagnostics.
- `smart_agent.js`: visual candidate mining + semantic scoring + clustering.
- `ai_engine.js` + `offscreen.js`: hidden local planner bridge.
- `recipes_store.js`: `RecipeManager` IndexedDB wrapper for learned recipes, chat history JSON, and image blobs.
- `options.html`: local planner/debug toggles.

### VerifierLoop & Self-Healing
- `ExtractionVerifier` marks extraction as `FAIL` (no messages) or `WARN` (role imbalance), then triggers text-density self-healing.
- Successful healing stores learned selectors by `domainFingerprint` for faster, more stable future extraction runs.

### Local classifier service
- Offscreen local classifier supports `Question`, `Code`, and `File Attachment` tagging with regex+embedding fallback.
- Artifact detector flags `sandbox:/...`, `/mnt/data/...`, and file-like links for debug evidence.

### Privacy / Network Guard
- Extension pages enforce strict CSP with local script/connect policy.
- LocalOnlyGuard blocks outbound network in extension contexts for fetch/XHR/WebSocket except local extension/data/blob schemes.
- Startup log: `[LOCAL-ONLY] AI engine network disabled; offline models only.`

### How to Verify Local-Only
1. Open extension popup and run `Self-Test`.
2. In extension DevTools, verify startup log includes `[LOCAL-ONLY] ...`.
3. Confirm no external requests are emitted from extension pages.

## 🚀 One-Click Installation

To install the developer preview directly from GitHub:

1.  **Download** the source code (ZIP) from the Releases page.
2.  **Unzip** the folder to your preferred location.
3.  Open Chrome and navigate to `chrome://extensions`.
4.  Enable **Developer Mode** in the top right corner.
5.  Click **Load Unpacked** and select the unzipped folder.

## ⚖️ Legal & Privacy

*   **Data Control**: The user acts as the sole Data Controller. This software is a local processing tool.
*   **Security**: Enforced Content Security Policy (CSP).
*   **Copyright**: Dr. Babak Sorkhpour © 2026. All rights reserved.

---
*Generated by AI Chat Exporter Engineering Team.*
## 🧩 GitHub Files Guide (What each file is for)

- `manifest.json`: Chrome extension runtime config (permissions, content script mapping, popup entry).
- `content.js`: Platform extraction orchestrator and per-platform engines (ChatGPT/Claude/Gemini/AI Studio).
- `script.js`: Popup application controller and export generation pipeline (HTML/DOC/PDF/etc).
- `index.html`: Popup UI layout, controls, tooltips, and modal sections.
- `VERSION.json`: Single source-of-truth version metadata for release automation.
- `CHANGELOG.md`: Release history and user-visible change summaries.
- `MEMORY.md`: Project memory (current constraints, priorities, and focus points).
- `TECHNICAL_ALGORITHMS.md`: High-level algorithm documentation for extraction/export logic.
- `PLATFORM_ENGINE_ARCHITECTURE.md`: Engine separation strategy + normalized extraction model.
- `RELEASE_PROCESS.md`: Manual/operational release flow and tag policy.
- `LICENSES_THIRD_PARTY.md`: Third-party licensing inventory and review notes.
- `features/exporter.feature`: Hand-written BDD scenarios for core flows.
- `features/auto_generated.feature`: Auto-generated BDD scenarios from parser/export signatures.
- `scripts/generate_gherkin_from_code.cjs`: Script that generates Gherkin feature coverage from source code.
- `.github/workflows/ci.yml`: CI validation for push/PR.
- `.github/workflows/release.yml`: Tag-driven release validation pipeline.

## 🛠 Manual Usage (Step-by-step)

1. Open a supported chat tab (`chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `aistudio.google.com`).
2. Open extension popup.
3. If chat is long, click **Fetch Full** and confirm loading from beginning.
4. Check message count and preview with **Preview**.
5. Select format(s): Markdown/HTML/Word/JSON/CSV/SQL/TXT/PDF.
6. Configure options in **Settings**:
   - Include Images
   - Code formatting
   - Raw HTML mode (advanced)
   - ZIP bundling
7. Click **Generate Package**.
8. To export only images, click **Export Photos**.
9. To export chat-generated files, click **Export Files** (ZIP output).
10. For ChatGPT sandbox files (`sandbox:/mnt/data/...`):
   - Click **Ping** first to verify extension injection state for the active tab.
   - Click **Scan File Links** to detect file references and print diagnostic tables in page console.
   - Click **Resolve + Download All** to dynamically resolve sandbox URLs and download each file sequentially.
   - Inspect `window.__SANDBOX_FILE_REFS__` and `window.__CHATGPT_FILE_LINKS__` in page DevTools for full explainable diagnostics.
11. If needed, download logs from Settings for troubleshooting.
12. For Claude live diagnostics, run the extension message action `discover_claude_files` to inspect detected file/download elements in `window.CLAUDE_FILE_DISCOVERY`.

## 🔬 Manual Engineering Commands

- Build: `npm run build`
- Generate BDD features from code: `npm run gherkin:generate`
- Syntax check content script: `node -c content.js`
- Syntax check popup script: `node -c script.js`


## 🔐 Local AI Engine & Privacy Answer

- The "adaptive analyzer" is a **local heuristic engine** inside `content.js`.
- It does **not** send message contents to external AI services.
- DOM scoring/extraction is performed on-device in the current tab context.
- Export files are generated and downloaded locally.

If an online AI-assistant mode is ever added in the future, it must be opt-in, disabled by default, and documented clearly in this repository.

## 📁 Detailed GitHub File Roles

| File/Path | Purpose | Manual Usage |
|---|---|---|
| `manifest.json` | Extension permissions and entrypoints | Must match Chrome extension capabilities before release. |
| `index.html` | Popup layout and controls | Open popup to access extraction + export actions. |
| `content.js` | Platform extraction engines + orchestrator | Injected into supported chat pages to read text/image/code. |
| `script.js` | Popup controller + export pipeline | Handles Fetch Full, Preview, export formats, photo export. |
| `background.js` | Tab-isolated state and logs | Keeps per-tab extraction cache and debug logs. |
| `VERSION.json` | Canonical release version metadata | Update on each release; keep synchronized with manifest/readme. |
| `CHANGELOG.md` | Release notes | Add new release section every version bump. |
| `MEMORY.md` | Team memory and constraints | Update when priorities/known constraints change. |
| `TECHNICAL_ALGORITHMS.md` | Technical algorithm summary | Keep updated when extraction/export logic changes. |
| `PLATFORM_ENGINE_ARCHITECTURE.md` | Engine-level architecture | Update when selectors/engine strategy changes. |
| `SECURITY_PRIVACY_MODEL.md` | Local-processing and security model | Update with each security/privacy policy change. |
| `RELEASE_PROCESS.md` | Release operations runbook | Follow step-by-step for manual and tagged releases. |
| `features/exporter.feature` | Manual BDD scenarios | Add high-value behavior scenarios by hand. |
| `features/auto_generated.feature` | Auto BDD coverage from code | Regenerate via `npm run gherkin:generate`. |
| `.github/workflows/ci.yml` | PR/push CI checks | Runs baseline validation on code updates. |
| `.github/workflows/release.yml` | Tag-based release validation | Runs release checks on `v*` tags. |
| `scripts/generate_gherkin_from_code.cjs` | BDD generator from source signatures | Run manually before release. |

## 🧭 Manual Use (Operator Procedure)

### End-user usage
1. Open a supported chat page.
2. Open popup and wait for initial analysis.
3. Click **Fetch Full** to load from beginning for long chats.
4. Click **Preview** to validate content.
5. Select export formats.
6. Configure settings (images/code/raw HTML/zip).
7. Click **Generate Package**.
8. For image-only archive, click **Export Photos**.

### Maintainer usage (manual release)
1. Update version values (`VERSION.json`, `manifest.json`, `metadata.json`, UI + README).
2. Update `CHANGELOG.md`.
3. Run:
   - `npm run gherkin:generate`
   - `node -c content.js`
   - `node -c script.js`
   - `npm run build`
4. Commit with semantic message and version suffix.
5. Create Git tag `vX.Y.Z` and push.


## 🧪 ChatGPT DOM Self-Test (Debug Mode)

For deep ChatGPT DOM diagnostics (local only):

1. Open ChatGPT tab and popup.
2. In DevTools console run:
   - `chrome.runtime.sendMessage({ action: "analyze_dom", mode: "visible" })`
   - `chrome.runtime.sendMessage({ action: "analyze_dom", mode: "full" })`
3. Inspect `window.CHATGPT_DOM_ANALYSIS` for root candidates, message evidence, and parsed blocks.

Console ends with `[PASS]`, `[WARN]`, or `[FAIL]` diagnostics.


## 🔎 Claude DOM Discovery (Manual)

For claude.ai reverse-engineering in a logged-in session, the extension now exposes a local discovery action:

- In DevTools console on a Claude chat page:
  - `chrome.runtime.sendMessage({ action: "discover_claude_structure" }, console.log)`
- Output is also stored on-page in:
  - `window.CLAUDE_DOM_DISCOVERY`

This discovery reports root candidates, message selector candidates, role hints, and content signal counts from the *actual live DOM*.

## 📈 Progress & Photo Export Modes

- During **Generate Package**, the export button now shows live progress percentages.
- **Export Photos** asks whether to:
  - pack all photos into one ZIP, or
  - export photos as batch files directly.


## 🧠 Engine Details by Platform

- **ChatGPT / ChatGPT Codex**
  - Uses explainable analyzer stages for root detection, message scoring, role evidence, and semantic block parsing.
  - URL rule: `https://chatgpt.com/codex` is labeled as **ChatGPT Codex**.
- **Claude**
  - Uses adaptive extraction and local structure discovery (`discover_claude_structure`) to inspect live DOM candidates.
- **Gemini**
  - Uses `GeminiExtractor` probe model (deep traversal, scoring, role evidence, block parsing).
- **AI Studio**
  - Uses adaptive selectors with fallback role hints and normalization.

All engines normalize output into the same shared contract for exporters.

## 🔒 Security & Compliance (Implementation Summary)

- Chat content never leaves the local browser by design.
- Per-tab runtime cache is encrypted in memory (`AES-GCM`) in `background.js`.
- Settings are stored locally and can be exported as `.cfg`.
- No hidden telemetry or remote inference pipeline is used.
- Regulatory design targets documented for GDPR/DSGVO and US privacy expectations are in `SECURITY_PRIVACY_MODEL.md`.

## ⚙️ New Settings and Menu Drafts

- New menu drafts in popup header:
  - **About** (existing)
  - **Login (Draft)**
  - **Contact (Draft)**
- New settings:
  - **Pack Photos as ZIP** checkbox
  - **Export Settings Config (.cfg)** button
- Save Settings now persists local config and exports a `.cfg` file for user backup.

## ❓ Why photos now render in HTML/Word

The export renderer now uses `renderRichMessageHtml()` to split text and image tokens before escaping text.
This prevents image token corruption and ensures valid `<img>` tags are emitted in full standalone HTML/Word output.


## 🌍 Multilingual PDF Strategy (Current)

- PDF export uses a browser-canvas rendering path that preserves image embedding and avoids missing glyph errors from basic PDF fonts.
- The renderer now applies script-aware wrapping:
  - RTL-aware line composition for Arabic/Persian/Hebrew blocks.
  - CJK character-based wrapping for Chinese/Japanese/Korean blocks.
- Text direction is switched per block (`rtl`/`ltr`) before drawing on canvas.

### Limitations
- PDF remains image-backed pages for robust multilingual glyph rendering.
- Text selection in PDF is limited compared to pure text-PDF output.



## 📦 Chat-Generated File Export

- Enable **Extract and ZIP Chat Files** in Settings.
- Extraction records file references as `[[FILE:url|name]]` tokens.
- Click **Export Files** to download all detected files as a single ZIP package.

## Local AI Proof (v0.11.0)
- Runs a local-only agent loop: observe -> plan -> act -> verify -> learn.
- Embeddings and learner weights are persisted locally per `{host, domainFingerprint}`.
- No chat text is sent to external AI APIs; network for assets is allowlisted and user-gesture gated.

## AEGIS-2026 Architecture (Detailed)
### 1) Visual Cortex (`smart_vision.js`)
- Geometry-first chat bubble detection (visibility, width, alignment, role signals).
- Zero-dependency fallback to Shadow DOM DeepScan for resilience against SPA rendering changes.
- Selector-agnostic extraction by design (no fragile class-name dependency).

### 2) Iron Dome (`security_guard.js`)
- Runtime network kill-switch for content-context fetch/XHR.
- Strict allowlist (`blob:`, `data:`, `chrome-extension://`) with block metrics.
- Anti-tamper freeze utility for extracted payloads before export.

### 3) Local AI Engine (`offline_brain.js`)
- Local text labeling (`Code`, `Table`, `Prose`, `SystemInstruction`) without external APIs.
- Auto markdown code wrapping when code-like text appears outside `<pre>`.

### 4) Artifact Factory (`export_core.js`)
- In-place image base64 embedding for offline portability.
- Word-compatible MHTML generation with required Office namespaces.

### 5) Black Box Logger (`logger.js`)
- Session JSON log contract with integrity hash (SHA-256).
- Data-loss warning heuristic: mismatch between node-detection and visual-element counts.

## Version-Control & Documentation Standard
- Every release must update: `CHANGELOG.md`, `README.md`, `TECHNICAL_ALGORITHMS.md`, and `MEMORY.md`.
- Every algorithmic module must document version + rationale + test path.
- BDD artifacts are maintained in `features/` and regenerated via `npm run gherkin:generate`.

## Agentic Default Execution (v0.11.2)
- Default analysis now runs `self_test_local_agent` and then `extract_local_agent`.
- Classic `extract_chat` path is retained only as a controlled fallback for resiliency.
- Candidate selectors are now persisted to improve cross-run recipe quality.

## Continuity & Non-sensitive Commercial Handover
- See `docs/PROJECT_CONTINUITY_BRIEF.md` for non-confidential revenue stream summary and safe sample snippets.
- See `docs/AGENTIC_ARCHITECTURE.md` + `docs/SECURITY.md` + `docs/RELEASE_CHECKLIST.md` for engineer handover runbook.

## Licensing Strategy (v0.11.3)
- Community usage is governed by AGPLv3 (`LICENSE`).
- Commercial/proprietary deployment requires separate commercial licensing as documented in `LEGAL_NOTICE.md`.
- Reusable legal source header template is provided in `COPYRIGHT_HEADER.js`.

## Audit-Driven Improvements (v0.11.4)
- Version synchronization enforced across runtime metadata files.
- CI now validates release consistency and required CDN host permissions.
- Diagnostic logs redact long tokens and URLs to reduce accidental sensitive retention.
- Optional host permission request is triggered before heavy asset extraction flows.

## Agentic Contract & Governance Gates (v0.11.5)
- Version source-of-truth is now `version.js`, synchronized by `npm run sync:version`.
- CI gates enforce local assets, model checksums, release consistency, and tests.
- Dataset contract includes attachments as canonical export source (token output remains backward-compatible).

## Local Intelligence Signal Integrity (v0.11.6)
- Trace now distinguishes real local model load from fallback mode with explicit reason fields.
- Agent diagnostics include prior score and score delta to verify whether extraction quality improved between runs.
- Export diagnostics bundle now conforms to the required top-level diagnostics contract.

## AEGIS 2026 Validation & Intelligence Score (v0.12.0)
- Agent payload now includes redacted DOM context + explicit extraction goals for measurable planning.
- Background now supports user-initiated media proxy fetch with strict allowlist enforcement.
- See `docs/INTELLIGENCE_SCORECARD.md` for quantified intelligence readiness and brutal self-critique.
