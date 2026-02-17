# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Technical Algorithms

## Extraction pipeline (`content.js`)
1. Detect platform by hostname.
2. Use platform-specific selectors to collect message candidates.
3. For each message node:
   - remove UI noise elements,
   - convert code blocks to fenced markdown,
   - convert assistant/model images to `[[IMG:...]]` tokens (optionally base64),
   - normalize text.
4. Deduplicate messages by `(role, content)` pair.
5. Return `success`, `platform`, `title`, `messages`.

## Export pipeline (`script.js`)
1. User selects one/multiple target formats.
2. For each format:
   - `pdf`: build standalone PDF bytes with UTF-16 text objects.
   - `html/doc`: escape HTML, then convert `[[IMG:...]]` tokens to `<img src=...>`.
   - `json/csv/txt/sql/md`: convert tokens to textual image references.
3. If one file and ZIP is disabled: direct download.
4. Else: bundle with local ZIP writer (CRC32).

## ZIP algorithm
- Writes local file headers + central directory + EOCD.
- Uses CRC32 checksum per entry.

## Security controls
- HTML export uses output escaping before rich rendering steps.
- Script/style tags are removed from extraction content clones.
- No dynamic `eval` / no external runtime injection.


## Platform Engine Orchestrator (v0.10.3)
- Dedicated engine per platform for selectors and role mapping.
- Standardized message contract for export compatibility.
- Image tokens captured before node cleanup to preserve media in rich exports.
