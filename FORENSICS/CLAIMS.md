# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Claims Ledger (v0.11.0)

## Guarantees enforced by repository checks
- Version synchronization across `version.js`, `manifest.json`, `VERSION.json`, and `metadata.json`.
- Required release scripts exist and are executable through `package.json`.
- Export pipeline emits forensic files: `*.diagnostics.json` and `*.export_bundle_manifest.json`.
- Head forensics snapshot is captured in `FORENSICS/HEAD.txt`.

## Verification commands
- `npm run verify:release`
- `npm run verify:claims`
- `npm test`
