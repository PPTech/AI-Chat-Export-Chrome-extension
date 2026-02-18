Feature: Agentic local extraction with self-healing learning
  Scenario: Extractor runs observe-plan-act-verify-learn loop
    Given a chat page with at least 20 turns and randomized CSS classes
    When the user clicks export with a valid gesture proof token
    Then the extension computes local embeddings for candidate nodes
    And it attempts at least 2 plans when first verifier score is low
    And it stores recipe, learner weights, and verifier metrics in IndexedDB

  Scenario: Asset broker handles image and file references
    Given extracted message tokens include [[IMG:...]] and [[FILE:...|name]]
    When export generation resolves assets via AssetBroker allowlist
    Then images are embedded into HTML or DOCX when available
    And failed assets produce explicit stub blocks with error details
