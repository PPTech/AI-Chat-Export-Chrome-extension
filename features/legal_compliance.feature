Feature: Legal and license compliance packaging
  Scenario: AGPLv3 license and legal notice are present
    Given the repository root
    When release validation runs
    Then LICENSE contains AGPLv3 legal terms
    And LEGAL_NOTICE.md exists with dual-license warning language

  Scenario: Runtime files carry legal header
    Given critical runtime scripts are distributed with the extension
    When compliance checks inspect file headers
    Then content.js, background.js, smart_vision.js, and export_core.js include the legal protection header block
