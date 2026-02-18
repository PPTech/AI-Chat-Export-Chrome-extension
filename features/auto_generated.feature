Feature: Auto-generated platform and export coverage

  Scenario: ChatGPT engine extracts normalized messages
    Given the active tab is ChatGPT
    When extraction runs
    Then standardized messages are produced

  Scenario: Claude engine extracts normalized messages
    Given the active tab is Claude
    When extraction runs
    Then standardized messages are produced

  Scenario: Gemini engine extracts normalized messages
    Given the active tab is Gemini
    When extraction runs
    Then standardized messages are produced

  Scenario: AI Studio engine extracts normalized messages
    Given the active tab is AI Studio
    When extraction runs
    Then standardized messages are produced

  Scenario: PDF export is generated
    Given extracted normalized messages exist
    When user exports pdf
    Then output file content is generated without runtime errors

  Scenario: DOC export is generated
    Given extracted normalized messages exist
    When user exports doc
    Then output file content is generated without runtime errors

  Scenario: JSON export is generated
    Given extracted normalized messages exist
    When user exports json
    Then output file content is generated without runtime errors

  Scenario: CSV export is generated
    Given extracted normalized messages exist
    When user exports csv
    Then output file content is generated without runtime errors

  Scenario: SQL export is generated
    Given extracted normalized messages exist
    When user exports sql
    Then output file content is generated without runtime errors

  Scenario: TXT export is generated
    Given extracted normalized messages exist
    When user exports txt
    Then output file content is generated without runtime errors
