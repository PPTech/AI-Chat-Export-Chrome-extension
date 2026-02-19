# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
Feature: Diagnostics v3 flight recorder
  Scenario: Export failure remains debuggable without secret leakage
    Given debug logging is enabled by user opt-in
    When an asset host is denied by policy
    Then diagnostics v3 records runId, eventId, module, phase, reason and host hash metadata
    And diagnostics output does not contain Bearer tokens, JWT values, cookies, or raw chat text
