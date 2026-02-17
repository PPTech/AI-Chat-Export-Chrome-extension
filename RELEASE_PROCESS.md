# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Release Process (v0.10.0)

## Steps
1. Update `VERSION.json`, `manifest.json`, `metadata.json`, and UI version text.
2. Update `CHANGELOG.md` with release notes.
3. Run checks:
   - `node -c content.js`
   - `node -c script.js`
   - `npm run build`
   - `npm run gherkin:generate`
4. Commit with semantic message: `fix|feat|docs: ... (vX.Y.Z)`.
5. Tag release in GitHub as `vX.Y.Z`.

## Tag metadata (recommended)
- Title: `vX.Y.Z`.
- Notes: summary, breaking changes, platform-specific extraction updates.
