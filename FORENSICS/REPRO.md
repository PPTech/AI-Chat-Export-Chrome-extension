# Forensic Reproduction Pack

## Environment
- **Chrome version**: _(fill in, e.g. 124.0.6367.91)_
- **Extension version**: 0.12.1
- **OS**: _(fill in, e.g. Windows 11 23H2, macOS 14.4)_
- **Node version** (for tests): 20.x

## Hosts tested
| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | https://chatgpt.com | |
| Gemini | https://gemini.google.com | |
| Claude | https://claude.ai | |
| AI Studio | https://aistudio.google.com | |

## Steps to reproduce
1. Load unpacked extension from repo root in `chrome://extensions` (Developer mode ON).
2. Navigate to a chat with >= 10 messages on the target platform.
3. Click the extension popup icon.
4. Select a format (e.g. Markdown) and click "Generate Package".
5. Check export output for completeness.

## Expected vs Actual
| Check | Expected | Actual |
|-------|----------|--------|
| Message count matches chat | All messages exported | |
| Images embedded (HTML/MHTML) | Base64 inline or asset folder | |
| PDF text is selectable | Copy-paste works | |
| Word Doc opens in Word/LibreOffice | Formatted with images | |
| CSV has all columns | Index,Role,Platform,Content,ExportedAt | |
| No script assets in export | .js/.css files excluded | |
| Diagnostics (debugMode ON) | JSONL bundle downloadable | |

## Diagnostics
Enable **Debug Mode** in Settings to get the flight recorder + invariant checks.
After export, click "Download Diagnostics" to get:
- `<export>.diagnostics.jsonl`
- `<export>.run_summary.json`
- `<export>.asset_failures.json`
