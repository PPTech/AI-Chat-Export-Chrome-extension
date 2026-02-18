# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Release Process (v0.10.9)

## Mandatory Artifacts Per Release
- `VERSION.json`
- `manifest.json`
- `metadata.json`
- `CHANGELOG.md`
- `MEMORY.md`
- `README.md`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## Manual Release Steps
1. Update versions in runtime + docs.
2. Update changelog and technical/security docs.
3. Run validations:
   - `node -c content.js`
   - `node -c script.js`
   - `node -c background.js`
   - `npm run gherkin:generate`
   - `npm run build`
4. Run A/B test checklist manually:
   - A: standard extraction + export.
   - B: Fetch Full + long-thread export + image export mode.
5. Commit with semantic message and version suffix.
6. Tag in GitHub: `vX.Y.Z`.

## License and Dependency Review
- Verify any new package/library license compatibility with MIT distribution.
- Record third-party license notes in `LICENSES_THIRD_PARTY.md`.
