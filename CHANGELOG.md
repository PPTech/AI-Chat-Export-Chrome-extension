# Changelog

## [0.13.0] - 2026-02-22
### Added
- **A/B Testing Harness**: Internal testing harness for HTML, Word, and Markdown export rendering accuracy (`tests/integration/test_harness.html`).
- **Comprehensive MIME Mapping**: Added `mimeToExt()` supporting extraction of over 20+ filetypes directly from blob types (.docx, .xlsx, .pdf, .txt, etc.).
- **BDD Gherkin Documentation**: Documented exact behaviors for all supported Image & File extraction scenarios in `docs/features/extract_assets.feature`.
- **AGPL-3.0 License**: Project is now explicitly strictly licensed under AGPL-3.0 to comply with user's global security constraints.
- **File Attachment UI**: Exported HTML and Word (DOC) formats now render `[[FILE:...]]` tokens as visually styled, interactive 📎 buttons holding local assets.
- **Markdown standard links**: Replaced raw tokens in MD export with standardized markdown attachments (`[📎 filename](assets/...)`).

### Fixed
- **ChatGPT `multimodal_text` missing**: Fixed file extraction by handling modern multimodal APIs, preserving user-uploaded doc extraction.
- **ChatGPT SSOT array casting**: Fixed critical bug where `parts.join('\n')` evaluated Image/File objects into literal `[object Object]` text.
- **Local Asset Rendering in ZIP Mode**: Fixed `normalizeImageSrc` silently dropping local paths (e.g. `assets/img_001.png`), ensuring images render seamlessly in packaged ZIP exports.
- **PDF Raster Pass-through**: Fixed `buildCanvasPdf` missing `urlMap` arguments, thereby resolving missing images in generated complex PDFs.
- **Broken file-service URLs**: Automated stripping of `file-service://` prefixes out of API references.

## [0.12.1] - 2026-02-21
### Added
- Phase 7 refactoring completed: split `script.js` into modular `lib/state.mjs` and `lib/export.mjs`.

... (Earlier versions omitted for brevity)
