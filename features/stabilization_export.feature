# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
Feature: Stabilized export host filtering
  Scenario: Placeholder links are skipped in production exports
    Given a chat contains an attachment candidate "https://example.com/file.png"
    When the exporter resolves attachment sources in production mode
    Then the exporter logs "placeholder_url_detected"
    And the exporter does not trigger an ASSET_FETCH request for host "example.com"
