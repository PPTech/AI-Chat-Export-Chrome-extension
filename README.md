# AI Chat Exporter (Ultimate)

**Version**: 0.11.0
**License**: MIT
**Author**: Dr. Babak Sorkhpour ([@Drbabakskr](https://x.com/Drbabakskr))

Local-only Chrome extension for exporting AI chat conversations. No external APIs, no telemetry, no runtime model downloads. All processing happens in your browser.

---

## Supported Platforms

| Platform | Extraction | Full History | Role Accuracy |
|---|---|---|---|
| **ChatGPT** | API fetch + DOM fallback | Yes (backend-api) | > 95% |
| **Claude** | DOM extraction | DOM scroll | > 90% |
| **Gemini** | DOM + transcript splitting | DOM scroll | > 90% |
| **AI Studio** | Shadow DOM + geometry | 4-strategy ladder | Varies |

## Export Formats

| Format | Images | Unicode | Notes |
|---|---|---|---|
| HTML | Embedded | Full | Standalone file with inline assets |
| DOC | Embedded | Full | Word-compatible HTML |
| PDF | Embedded | Full | Canvas-rendered (RTL, CJK supported) |
| Markdown | References | Full | Local asset paths in ZIP |
| JSON | Stripped | Full | Canonical schema `chat-export.v1` |
| CSV | Stripped | UTF-8 BOM | Excel compatible |
| SQL | Stripped | Full | PostgreSQL INSERT statements |
| TXT | Stripped | Full | Plain text with role labels |

## Features

- **Full History Fetch**: ChatGPT backend-api extraction gets all messages without scrolling
- **Asset Embedding**: Images and files resolved and embedded in export ZIP (`assets/` folder)
- **Fail-Soft Export**: Individual format failures don't abort the entire export
- **Always-On Diagnostics**: Every extraction attempt produces a downloadable diagnostic bundle
- **Multilingual PDF**: Canvas-based rendering supports Arabic, Persian, CJK, and all Unicode
- **Debug Mode**: Verbose flight recorder with structured events and run correlation
- **Zero Dependencies**: No external libraries, no network calls (except asset fetching with user consent)

## Privacy & Security

- Chat content never leaves your browser
- No external AI services, no telemetry
- Asset fetching only from allowlisted hosts (AI platform domains)
- All network requests require user gesture + explicit permission
- Export files generated and downloaded locally
- Settings stored in `chrome.storage.local` only

## Quick Start

### User Installation

1. Download the source code (ZIP) from Releases
2. Unzip to a folder
3. Open `chrome://extensions` in Chrome
4. Enable **Developer Mode** (top right)
5. Click **Load Unpacked** and select the folder

### Usage

1. Open a supported chat page (chatgpt.com, claude.ai, gemini.google.com, aistudio.google.com)
2. Click the extension icon to open the popup
3. Wait for extraction to complete (progress bar shows status)
4. For long chats, click **Fetch Full** to load from beginning
5. Select export format(s) and click **Generate Package**
6. Use **Export Photos** or **Export Files** for media-only exports

### Developer Commands

```bash
node -c content.js    # Syntax check content script
node -c script.js     # Syntax check popup script
node -c background.js # Syntax check service worker
```

## Architecture

```
popup (index.html + script.js)
  |
  |-- chrome.tabs.sendMessage --> content.js (extraction engines)
  |-- chrome.runtime.sendMessage --> background.js (state + diagnostics)
  |
  v
Export Pipeline (script.js)
  |-- generateContent() --> format generators (HTML/PDF/DOC/etc.)
  |-- resolveAndEmbedAssets() --> asset fetcher (images/files)
  |-- createRobustZip() --> ZIP packager
  |-- downloadBlob() --> chrome.downloads (gesture-gated)
```

| File | Role |
|---|---|
| `manifest.json` | MV3 config: permissions, content script matching, popup entry |
| `content.js` | Platform extraction engines (ChatGPT, Claude, Gemini, AI Studio) |
| `script.js` | Popup controller, export pipeline, PDF builders, ZIP creation |
| `background.js` | Service worker: tab state, diagnostics store, gesture validation |
| `index.html` | Popup UI: controls, settings, modals |
| `lib/version.mjs` | Single source of truth for version string |

## Diagnostics

Every extraction and export attempt creates a diagnostic bundle (even on failure):

- **run_summary.json**: Run metadata, scorecard, anomaly score
- **diagnostics.jsonl**: Structured event log (verbose mode only)
- **asset_failures.json**: Failed asset resolution details
- **export_manifest.json**: What was requested vs what succeeded

Click **Download Diagnostics** in the popup to get the latest bundle.

### Debug Mode

Enable in Settings to get verbose diagnostics with full event details. When off, diagnostics use redacted mode (content lengths + hashes, no raw text).

## Troubleshooting

| Problem | Fix |
|---|---|
| "0 messages" on ChatGPT | Refresh the chat page, then reopen the popup |
| "0 messages" on AI Studio | Wait 3 seconds for lazy rendering; try Fetch Full |
| Gemini roles all "Unknown" | Update extension (v0.11.0 adds transcript splitting) |
| "No Diagnostics" | Update extension (v0.11.0 captures diagnostics on every attempt) |
| PDF missing characters | Ensure system has Unicode fonts installed (Noto Sans recommended) |
| Images not in export | Enable "Include Images" in Settings before exporting |
| CSP errors in console | Normal for some platforms; extraction still works via fallback |

## Version History

See [CHANGELOG.md](CHANGELOG.md) for full release notes.

---

Copyright Dr. Babak Sorkhpour 2026. All rights reserved. MIT License.
