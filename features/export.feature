Feature: Export Chat conversation (local-only)

  Scenario: Fail loudly when no messages are extracted
    Given a DOM snapshot fixture "dom_empty.html"
    When I run export
    Then diagnostics.reason_codes includes "NO_MESSAGES_FOUND"
    And diagnostics.counts.messages_emitted equals 0
    And export is marked invalid

  Scenario: Extract messages from a valid DOM snapshot
    Given a DOM snapshot fixture "dom_ok.html"
    When I run export
    Then diagnostics.counts.messages_emitted is greater than 0
    And dataset.messages[0].role is not "unknown"

  Scenario: Local-only enforcement blocks external URLs
    Given a dataset with attachment URL "https://example.com/a.png"
    When resolver runs
    Then it does not fetch externally
    And diagnostics.failures includes code "LOCAL_ONLY_BLOCK"

  Scenario: ZIP assembly waits for attachment resolution
    Given a fixture with 2 local attachments
    When I run export
    Then export_bundle_manifest.inventory includes at least 3 files
    And attachments_resolved equals 2
