Feature: Multi-platform chat export reliability
  Scenario: Export from ChatGPT/Codex contains full chat messages
    Given the active tab is a supported ChatGPT conversation page
    When extraction runs
    Then user and assistant messages are returned in chronological order

  Scenario: Codex route uses explicit platform label
    Given the active URL is https://chatgpt.com/codex
    When extraction runs
    Then platform name is ChatGPT Codex

  Scenario: Exported HTML and Word files include assistant images
    Given extracted content contains image tokens in assistant messages
    When the user exports as html or doc
    Then image tokens are converted to rendered <img> tags

  Scenario: Claude extraction avoids sidebar content
    Given a Claude conversation page with side navigation
    When extraction runs
    Then only conversation messages are included
    And navigation/sidebar text is excluded

  Scenario: Claude discovery reports live DOM findings
    Given a logged-in Claude chat page is open
    When discover_claude_structure is executed
    Then a discovery result is saved in window.CLAUDE_DOM_DISCOVERY

  Scenario: Export photos honors settings checkbox mode
    Given extracted messages contain image URLs or image tokens
    And Pack Photos as ZIP is disabled
    When the user clicks Export Photos
    Then photos are exported as batch files

  Scenario: Popup analysis progress displays percentage
    Given extraction is running for the active tab
    When data processing advances
    Then Analysis Progress displays percentage updates


  Scenario: Multilingual PDF wraps RTL and CJK text
    Given extracted messages contain Arabic and CJK content
    When the user exports as pdf
    Then PDF text blocks are rendered with script-aware wrapping and direction


  Scenario: Export chat-generated files as ZIP
    Given extracted messages contain file tokens
    And Extract and ZIP Chat Files is enabled
    When the user clicks Export Files
    Then detected files are downloaded as one ZIP package
