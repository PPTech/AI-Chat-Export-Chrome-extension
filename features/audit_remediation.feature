Feature: Audit-driven remediation and governance hardening
  Scenario: Release consistency is enforced
    Given manifest, VERSION, and metadata files
    When release checks run in CI
    Then all version values must be identical

  Scenario: Asset host permissions are hardened
    Given modern chat file/image CDNs are used
    When extraction and export preflight executes
    Then required host permissions are present in manifest
    And optional host permissions are requested with user interaction

  Scenario: Diagnostic logs are privacy aware
    Given background logging stores runtime diagnostics
    When details include URLs or token-like values
    Then sensitive fragments are redacted before persistence
