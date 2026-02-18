# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Technical Algorithms (v0.10.21)

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
