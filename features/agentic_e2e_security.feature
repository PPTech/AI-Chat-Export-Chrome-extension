Feature: Agentic export e2e and security invariants
  Scenario: Agentic path resolves visible media into dataset attachments
    Given a chat fixture with image and file-like blocks
    When extraction runs in local agentic mode
    Then canonical dataset messages include attachments metadata

  Scenario: Security invariant blocks non-allowlisted asset hosts
    Given credentialed asset fetch is requested for a non-allowlisted URL
    When content fetch preflight executes
    Then resolution is denied and logged in diagnostics security fields
