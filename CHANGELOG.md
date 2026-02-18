# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Changelog

## 0.10.7 - 2026-02-17
- Improved multilingual PDF rendering by adding script-aware line wrapping (`wrapLineSmart`) with dedicated RTL and CJK handling.
- Updated canvas text drawing to apply language direction (`rtl/ltr`) dynamically per text block.
- Kept image embedding in PDF while improving mixed-language message readability.
- Preserved complete standalone HTML/Word export rendering path with image token to `<img>` conversion.
- Synced runtime/docs metadata to `0.10.7`.

## 0.10.6 - 2026-02-17
- Added per-tab encrypted runtime cache in `background.js` (AES-GCM) for extracted state handling.
- Added draft popup menu entries for `Login` and `Contact` and preserved `About` entry.
- Added `Analysis Progress` percentage indicator in popup status area.
- Replaced photo export confirmation prompt with persistent settings checkbox (`Pack Photos as ZIP`).
- Added settings config backup flow: save settings locally and export `.cfg` file.
- Kept rich HTML/Word rendering in complete standalone page mode via token-aware rendering.
- Added/expanded architecture, algorithm, compliance, and license documentation (`PLATFORM_ENGINE_ARCHITECTURE.md`, `TECHNICAL_ALGORITHMS.md`, `SECURITY_PRIVACY_MODEL.md`, `RELEASE_PROCESS.md`, `LICENSES_THIRD_PARTY.md`, `README.md`).
- Synced runtime/docs version metadata to `0.10.6`.
