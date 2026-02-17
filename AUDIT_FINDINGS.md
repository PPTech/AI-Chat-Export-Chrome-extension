# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Repository Audit Findings

## Scope
- Repository: `AI-Chat-Export-Chrome-extension`
- Requested external source: Google AI Studio prompt link (access attempt failed with HTTP 403 from this environment).
- Method: static review of repository code and metadata.

## Access limitation
- The provided AI Studio URL could not be read from this runtime due to a `curl: (56) CONNECT tunnel failed, response 403` error.

## Gherkin BDD Findings

```gherkin
Feature: Secure and standards-compliant chat export extension

  Scenario: Extension asks for excessive host permissions
    Given the manifest requests "<all_urls>" host permissions
    When the extension is installed
    Then it has broader site access than required for supported chat platforms
    And this increases security and privacy risk surface

  Scenario: Raw HTML export can include unsanitized page HTML
    Given rawHtml mode returns element.innerHTML directly
    When exported output is opened as HTML/DOC
    Then untrusted markup can be preserved and later rendered
    And this may reintroduce scriptable content depending on viewer behavior

  Scenario: Internal logs may store message details without redaction
    Given background logging stringifies arbitrary details
    When extraction errors include user content fragments
    Then sensitive data can be written into downloadable logs

  Scenario: PDF generator builds non-compliant structure
    Given the simple PDF writer uses placeholder/fake cross-reference data
    When the file is opened by stricter PDF parsers
    Then rendering or compatibility can fail

  Scenario: Project governance files are incomplete for release process
    Given repository-level controls require CHANGELOG.md, MEMORY.md and CI workflows
    When checking the current tree
    Then those files are missing
    And release traceability is reduced
```

## Non-Gherkin technical notes
1. `manifest.json` uses broad `<all_urls>` host permission instead of explicit host allowlist for supported targets.
2. `content.js` returns `element.innerHTML` when `rawHtml` is enabled, bypassing later sanitization safeguards.
3. `background.js` stores and exposes logs through `GET_LOGS` without masking/scrubbing.
4. `script.js` PDF output contains intentionally simplified xref/startxref handling, which is fragile for strict readers.
5. Repository currently lacks `CHANGELOG.md`, `MEMORY.md`, and `.github/workflows/*` despite stated process goals.

## Recommended next actions
- Replace `<all_urls>` with exact domains in host permissions.
- Add strict HTML sanitization pipeline or disable raw HTML export by default.
- Add log redaction for content payloads, tokens, and PII-like strings.
- Replace custom PDF builder with a standards-compliant library or produce HTML/DOC only.
- Add release governance files (`CHANGELOG.md`, `MEMORY.md`) and CI workflow for build/security checks.
