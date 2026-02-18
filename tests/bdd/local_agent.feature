Feature: Local smart agent extraction, verification and self-healing

  Scenario: Extract chat turns from repeating bubbles
    Given a page has repeating visual chat blocks
    When local scan runs
    Then at least one message candidate is found

  Scenario: Detect code blocks via monospace evidence
    Given a page has code-like monospace regions
    When local extract runs
    Then code candidates include monospace evidence

  Scenario: Detect images from cards
    Given a page has visible media cards
    When local extract runs
    Then at least one image candidate is found

  Scenario: Detect file cards and clickability
    Given a page has downloadable file links
    When local extract runs
    Then file candidates include clickable evidence

  Scenario: Download capture path is available
    Given a page has at least one file candidate
    When resolve and download runs
    Then capture status is PASS or WARN with evidence

  Scenario: Verifier loop triggers healer
    Given extraction result is empty or role-unbalanced
    When verifier executes
    Then self-healing fallback is attempted

  Scenario: Self-heal learns recipe and reuses it
    Given a fallback selector set succeeds
    When recipe is saved by domain fingerprint
    Then next run can load recipe before full scan

  Scenario: VisualDOMWalker selector-agnostic extraction
    Given a page has visible text divs
    When VisualDOMWalker scans the viewport
    Then USER MODEL and CODE heuristics are produced without class selectors

  Scenario: Offline exporter embeds images
    Given extracted messages include image references
    When DataProcessor and ExportManager run
    Then output html and doc include offline-safe embedded images or fallback placeholders
