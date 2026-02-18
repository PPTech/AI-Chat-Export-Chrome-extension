# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Technical Algorithms (v0.10.14)

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
- Per-tab extracted data is encrypted in memory with AES-GCM.
- Runtime key generated via WebCrypto API.
- Data decrypted only when popup requests per-tab state.

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
