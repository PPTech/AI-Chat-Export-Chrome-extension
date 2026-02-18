Feature: AEGIS-2026 local autonomous extraction and export
  Scenario: Geometry-first extraction runs with deep scan fallback
    Given a dynamic SPA chat layout with unstable class names
    When SmartVision scans visible DOM nodes
    Then message candidates are detected using geometry and style heuristics
    And if zero messages are found, DeepScan traverses Shadow DOM roots

  Scenario: Security guard blocks outbound network exfiltration
    Given SecurityGuard kill-switch is installed in page context
    When a script calls fetch on a non-local HTTPS URL
    Then the request is blocked with an AEGIS Protocol error
    And security block metrics are incremented

  Scenario: Export core generates offline Word-compatible artifact
    Given extracted content includes inline and remote images
    When ExportCore embeds media and builds MHTML output
    Then output includes Office XML namespaces for Word compatibility
    And each session log contains an integrity hash and data-loss warning flag if variance exceeds threshold
