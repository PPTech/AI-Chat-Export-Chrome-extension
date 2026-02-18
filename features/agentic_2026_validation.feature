Feature: AEGIS 2026 measurable intelligence validation
  Scenario: Agent receives redacted context and goal directives
    Given a chat page is analyzed in agentic mode
    When OFFSCREEN_RUN_AGENT is called
    Then payload includes redacted dom snapshot capped to 40k chars
    And payload includes extraction goals for messages, images, and files

  Scenario: Learning signal is quantified across runs
    Given verifier metrics exist for a host fingerprint
    When the next extraction run completes
    Then trace includes priorBestScore and learned.scoreDelta

  Scenario: User-initiated media proxy enforces local-only policy
    Given media fetch is requested without user initiation
    When background proxy validates the request
    Then the request is denied with user_initiation_required

  Scenario: Export bundle includes forensic manifests
    Given export completes with one or more formats
    When ZIP artifact is assembled
    Then export bundle includes diagnostics JSON and export bundle manifest JSON

  Scenario: Visual cortex extraction is routed without selector dependency
    Given a supported chat page is open
    When EXTRACT_VISUAL_CORTEX is requested
    Then extraction returns geometry-driven messages and debug log metrics

  Scenario: Optional host permissions are not duplicated in required hosts
    Given manifest host permissions are validated
    When release consistency checks run
    Then CDN domains exist in optional_host_permissions without required duplication
