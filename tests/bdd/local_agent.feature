Feature: Local agent extraction and self-healing

  Scenario: Extract repeating chat bubbles
    Given a page has repeating visual chat blocks
    When local scan runs
    Then at least one message candidate is found

  Scenario: Detect images from cards
    Given a page has visible media cards
    When local extract runs
    Then at least one image candidate is found

  Scenario: Detect files and clickability
    Given a page has downloadable file links
    When local extract runs
    Then file candidates include clickable evidence

  Scenario: Self-heal fallback
    Given no reusable recipe exists
    When planner fallback runs
    Then a repaired extraction plan is produced
