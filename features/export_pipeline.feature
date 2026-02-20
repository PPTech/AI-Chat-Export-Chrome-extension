Feature: Export pipeline contract enforcement

  Scenario: User gesture required for downloads
    Given the popup script handles export
    When chrome.downloads.download is called
    Then it must be inside a user-initiated handler (onclick)
    And it must not be called at module initialization

  Scenario: Attachment classifier blocks scripts and executables
    Given an attachment candidate URL "https://cdn.example.com/malware.exe"
    When the classifier evaluates the URL
    Then it returns kind "ignored" with reason "hard_ignore:.exe"
    And allowed is false

  Scenario: Links in text are NOT attachments by default
    Given a message containing "See https://example.com/report"
    When attachments are extracted with advancedLinks disabled
    Then the URL is not treated as an attachment
    And classification reason is "link_in_text_requires_toggle"

  Scenario: Links in text ARE attachments with advanced toggle
    Given a message containing "See https://example.com/report"
    When attachments are extracted with advancedLinks enabled
    Then the URL is treated as a link attachment
    And classification reason is "advanced_toggle_enabled"

  Scenario: Data and blob URLs are always resolved locally
    Given an attachment with source_url "data:image/png;base64,abc123"
    When the resolver processes it
    Then status is "resolved" and reason_code is "DATA_URL_DECODED"
    And no network request is made

  Scenario: HTTP URLs are blocked by default
    Given an attachment with source_url "https://cdn.example.com/file.png"
    When the resolver processes it without allowHttp
    Then status is "blocked" and reason_code is "HTTP_NOT_ALLOWED"

  Scenario: Word Doc exports honest MHTML format
    Given the user selects "Word Doc" export
    When the export runs
    Then the output file has .mhtml extension (not .doc)
    And the content is valid multipart/related MHTML

  Scenario: PDF has extractable text
    Given a chat with 5 messages
    When PDF export runs
    Then the output starts with %PDF-1.4
    And contains BT/ET text objects with Helvetica font
    And text is extractable (not raster images)

  Scenario: CSV has pro schema
    Given a chat export to CSV
    When the CSV is generated
    Then the header row contains Index,Role,Platform,Content,ExportedAt
    And each row has the correct number of columns

  Scenario: Diagnostics contain required fields
    Given a completed export run
    When diagnostics are generated
    Then they contain runId, tabScope, strategy
    And URL events use scheme/host/pathHash (no full URLs)
    And no Bearer/JWT/API key patterns appear in output

  Scenario: Diagnostics leak scanner catches secrets
    Given diagnostics text containing "Bearer sk-proj-1234567890abcdef"
    When the leak scanner runs
    Then it detects the secret pattern
    And replaces it with [REDACTED]

  Scenario: Unknown role ratio gate
    Given extracted messages with 30% unknown roles
    When the scorecard is computed
    Then unknown_role_pass is false
    And unknown_role_ratio exceeds 0.05 threshold
