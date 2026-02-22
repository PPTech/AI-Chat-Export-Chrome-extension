# Architecture Guidelines for AI Agents
Version: 0.13.0

## 1. Export Pipeline Architecture
The AI Chat Exporter relies on a structured extraction and export pipeline. If you need to debug or extend this feature, understand the following file purposes:

### `script.js` (Main Controller)
- Orchestrates the UI logic in the popup.
- Manages `resolveAndEmbedAssets()` which discovers `[[IMG:...]]` and `[[FILE:...]]` tokens in the DOM-extracted messages.
- Downloads assets passing the `ASSET_ALLOWLIST` regex.
- Applies the newly centralized `mimeToExt(mimeType, fallback)` mapping to handle extension generation gracefully (e.g., .docx, .xlsx, .pdf).

### `lib/export.mjs` (Formatting & Generation Engine)
- Contains pure format generators: `generateContent`.
- **Image handling:** Uses `normalizeImageSrcForOutput()` to ensure both remote URLs (`https://`) and local ZIP assets (`assets/img_...`) render in `<img>` tags.
- **File handling:** `renderRichMessageHtmlWithAssets` now regex-replaces `[[FILE:url|filename]]` securely into styled HTML anchor tags (`<a href="..." download="...">📎 filename</a>`).
- **Markdown Handling:** Converts `[[FILE:...]]` into `[📎 filename](url)` standard syntax.

### `lib/extractors/chatgpt.mjs` (Extraction Strategies)
- Implements two primary bulk extractions:
  - **API Strategy:** Iterates over modern `backend-api` structures and supports `multimodal_text` file assets. Removes `file-service://` prefixes.
  - **SSOT Strategy:** Uses `ssotPartsToContent()` to correctly handle object arrays, circumventing earlier `[object Object]` bugs when joining parts.

## 2. Security Philosophy
Any agent modifying data extraction or file bundling MUST read `docs/security_audit_v0.13.0.md` first.
1. NEVER append un-sanitized variables directly into DOM attributes.
2. ALWAYS process downloaded file names through `sanitizeAssetPath()`.
3. NEVER assume `content_type` is exclusively `string` in third-party API payloads.

---
_End of Report. Please leave this file intact for future context bounds._
