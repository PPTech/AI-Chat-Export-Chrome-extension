Feature: Multi-platform chat export reliability
  Scenario: Export from ChatGPT/Codex contains full chat messages
    Given the active tab is a supported ChatGPT conversation page
    When extraction runs
    Then user and assistant messages are returned in chronological order

  Scenario: Exported HTML and Word files include assistant images
    Given extracted content contains image tokens in assistant messages
    When the user exports as html or doc
    Then image tokens are converted to rendered <img> tags

  Scenario: Claude extraction avoids sidebar content
    Given a Claude conversation page with side navigation
    When extraction runs
    Then only conversation messages are included
    And navigation/sidebar text is excluded
