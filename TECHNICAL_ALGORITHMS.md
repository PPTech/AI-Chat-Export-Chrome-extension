# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Technical Algorithms (v0.10.26)

## 0) Local Agent Core (Air-Gapped)

### 0.1 Visual + Semantic Pipeline (`smart_agent.js`)
- `detectMainScrollableRoot()` scores likely content roots.
- `getVisualCandidates()` extracts visible candidate blocks by geometry/style/signals.
- `NodeScorer.scoreNode()` classifies USER/MODEL/CODE/IMAGE/FILE/NOISE with confidence/evidence.
- `clusterCandidatesVertically()` groups candidates into message-like stacks.

### 0.2 Self-Healing Planner (`ai_engine.js`)
- Offline deterministic repair synthesizes fallback extraction plans when no recipe exists.
- Returns strict structured plan JSON with metrics and evidence.

### 0.3 Recipe Memory (`recipes_store.js`)
- IndexedDB-based local recipe persistence keyed by host/fingerprint.

### 0.4 Hidden Runtime (`offscreen.js`)
- Offscreen document keeps local planner and recipe memory reachable without user-facing UI.

## A) Extraction Algorithms (`content.js`)

### A1. Root Discovery (Explainable)
- Candidate roots are scored using:
  - scrollability,
  - viewport occupancy,
  - text density,
  - structured-content hints (`pre`, `img`, links),
  - repetition signatures.
- Top candidate selected with confidence score.

### A2. Message Candidate Collection
- Pull candidate blocks with text/code/image presence.
- Score each candidate with role/control hints.
- Deterministic nested dedupe keeps the strongest message container.

### A3. Role Inference
- Inputs:
  - alignment delta,
  - aria/data attributes,
  - control hints,
  - avatar/profile markers,
  - text patterns (localized-safe where possible).
- Output:
  - `role`, `confidence`, `evidence[]`.

### A4. Ordered Block Parsing
- TreeWalker traverses DOM order.
- Emits semantic blocks:
  - `text`, `code`, `list`, `quote`, `image`, `link`.
- Preserves code text exactly.
- Converts image nodes to stable `[[IMG:...]]` references.

### A5. Claude Discovery Algorithm
- Local inspection utility (`discover_claude_structure`) collects:
  - root candidates + score,
  - selector hit counts,
  - role marker evidence,
  - content signal counts.
- Stores findings in `window.CLAUDE_DOM_DISCOVERY`.

### A6. ChatGPT Sandbox Link Discovery + Download Algorithm
- Discovery path (`discoverSandboxFileRefs`):
  1. Detect best conversation root with explainable scoring.
  2. Scan anchors using both `a.getAttribute('href')` and `a.href`.
  3. Scan text nodes for `sandbox:/mnt/data/...` regex.
  4. Scan button/card widgets for file-like text and nested links.
  5. Traverse open shadow roots to avoid missing encapsulated nodes.
- Resolution path (`resolveFileRef`):
  1. Direct HTTP links → `direct_href`.
  2. Sandbox link → arm background capture window.
  3. Dispatch synthetic click + native click.
  4. Resolve through downloads/webRequest/tabs-update evidence.
- Diagnostics:
  - `window.__SANDBOX_FILE_REFS__` stores refs + evidence + source counts.
  - Console table includes `filename`, `sandboxPath`, `source`, `hasClickEl`.

### A7. AI Studio Extractor Algorithm
- `AIStudioExtractor` uses deep traversal (`queryDeep`) across open shadow roots.
- Waits for hydration before extraction.
- Extracts:
  - `system_instruction` from labeled editor blocks,
  - turn text via prioritized strategy:
    - textarea value,
    - ProseMirror / CodeMirror / contenteditable lines,
    - static markdown render fallback,
  - attachments (images/files) with blob-to-base64 conversion for images.
- Fails gracefully per-turn: logs warning and continues.

## B) Export Algorithms (`script.js`)

### B1. Multi-format Export Orchestration
1. Collect selected formats.
2. Generate each format sequentially.
3. Update visible progress percentage in popup.
4. Download single file or bundle ZIP.

### B2. HTML/Word Rich Rendering
- Uses `renderRichMessageHtml(content)`:
  - split message into text/image parts,
  - escape text,
  - render image tokens as `<img>`.
- Produces standalone complete HTML document.

### B3. PDF Generation
- Builds page canvas, draws role/text/images.
- Encodes pages to JPEG.
- Builds valid PDF object graph + xref table.


### B3.1 Multilingual Text Strategy
- Detect script profile per block (`RTL`, `CJK`, default Latin).
- Wrap logic:
  - RTL: prepend-token line composition for right-to-left readability.
  - CJK: character-level wrapping without whitespace dependency.
  - Latin: word-level wrapping.
- Draw logic:
  - Set `ctx.direction` and `ctx.textAlign` per block.
- Keep image rendering in same page flow.

### B4. Photo Export Mode
- Controlled by settings checkbox (`Pack Photos as ZIP`).
- Mode 1: ZIP all photos.
- Mode 2: batch download each photo file.

### B5. ZIP Writer
- Local ZIP writer with:
  - local file headers,
  - central directory,
  - EOCD,
  - CRC32 checksum.

## C) Security and Data-Safety Algorithms

### C1. Runtime Cache Protection (`background.js`)
- Per-tab extracted data is isolated in service-worker memory and cleared on demand.
- Capture windows for downloads are short-lived and removed after completion/timeout.
- No remote telemetry endpoint is used for extracted payload transfer.

### C2. Sanitization
- HTML text is escaped before rendering.
- Script/style elements are removed from parsed clones.
- No `eval`/dynamic script execution.

### C3. Local-only Constraint
- No endpoint in runtime sends chat text, image, or code to external servers.
- Downloads are browser-local, user-triggered actions.

### B6. File Token and ZIP Export Strategy
- Extract file links from message nodes (`a[href]`, `download`, `data-file-url`).
- Normalize to `[[FILE:url|name]]` tokens.
- On Export Files action, fetch each file in current session and pack with ZIP writer.

## Agent Loop v0.11.0
1. Observe: collect candidate blocks from SmartAgent/SmartMiner.
2. Plan: generate up to 8 plan hypotheses ranked by online learner logits.
3. Act: apply selectors + predicted labels to construct extraction sets.
4. Verify: compute score from message count, role sanity, monotonic order, duplication, attachment coverage.
5. Learn: update linear classifier weights and persist recipe/failure diagnostics in IndexedDB.

## AEGIS-2026 Module Algorithms (v0.11.1)
### D1. Visual Cortex (`smart_vision.js`)
- Iterate all visible nodes and score likely message bubbles using text-length + geometry constraints.
- Role classifier uses right/left alignment and style/icon evidence.
- Self-healing branch enters Shadow DOM DeepScan when primary scan returns zero messages.

### D2. Security Guard (`security_guard.js`)
- Monkey-patches `fetch` + `XMLHttpRequest.open` in content context.
- Blocks any non-local scheme and increments security block metrics.
- Freezes extraction object for anti-tamper integrity.

### D3. Offline Brain (`offline_brain.js`)
- Deterministic lightweight local classifier for Code/Table/Prose/SystemInstruction.
- Applies markdown auto-wrap when code-like text is outside `<pre>` boundaries.

### D4. Export Core (`export_core.js`)
- Resolves image blobs to DataURL then injects inline base64 sources.
- Builds RFC-compliant MHTML multipart payload for Word-compatible offline artifacts.

### D5. Black Box Logger (`logger.js`)
- Computes SHA-256 integrity hash for exported payload.
- Emits warning when node-detection variance exceeds 10%.


## v0.11.2 Incremental Algorithms
### E1. Agentic-First Request Routing (`script.js`)
- Order: self-test -> local-agent extraction -> legacy fallback.
- A/B check ensures agentic path is prioritized in regression tests.

### E2. Selector Emission for Learning (`smart_agent.js`)
- CSS-path generation for each visual candidate and extracted item.
- Enables recipe memory to persist reusable selectors per domain fingerprint.

### E3. Local Asset Gate (`scripts/verify_local_assets.cjs`)
- CI pre-test gate verifies required on-device model runtime artifacts exist.
- Prevents silent downgrade due to missing local assets.


## v0.11.3 Legal/Compliance Implementation
### F1. License Governance
- Root AGPLv3 license file added to establish copyleft network-use obligations.
- Commercial exception notice externalized in legal notice and reusable header template.

### F2. Header Enforcement on Critical Runtime Files
- Legal header prepended to content/background/vision/export modules to ensure runtime-distributed sources carry licensing terms.


## v0.11.4 Audit-Remediation Algorithms
### G1. Release Consistency Gate
- Validate semantic version parity across `manifest.json`, `VERSION.json`, and `metadata.json`.
- Fail CI when drift is detected.

### G2. Permission Hardening Flow
- Preflight optional host permission request before asset-heavy extraction/export operations.
- Keep baseline permissions minimal and elevate only via user-granted optional origins.

### G3. Sensitive Log Redaction
- Background logger redacts URL-like strings and long token-like fragments before persistence.
- Bounded log detail length limits accidental high-entropy data retention.


## v0.11.5 Delivery Algorithms
### H1. Version Synchronization Pipeline
- `version.js` is parsed and propagated to manifest/VERSION/metadata via sync script.

### H2. Export Contract Normalization
- Build `ChatExportDataset` from extracted items with structured attachments.
- Emit legacy tokenized content only as compatibility layer.

### H3. Diagnostics Ring Buffer
- Persist redacted JSONL diagnostics entries in service worker for forensic replay without raw sensitive payload retention.


## v0.11.6 Signal-Integrity Algorithms
### I1. Embedding Telemetry Integrity
- Model metadata now includes explicit `loaded` boolean and `fallbackReason` for trustworthy AI-state reporting.

### I2. Learning Delta Metric
- Agent loop loads prior verifier score and emits `scoreDelta` per run to quantify improvement/regression.

### I3. Diagnostics Contract Builder
- Export pipeline constructs schema-aligned diagnostics object with required top-level sections.
