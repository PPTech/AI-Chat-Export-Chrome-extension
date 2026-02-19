Feature: Attachment classification safety

  Scenario: Block external raw GitHub links by default
    Given a chat message contains "https://raw.githubusercontent.com/org/repo/file.bin"
    When export runs with advanced external links disabled
    Then the URL is classified as ignored external link
    And no network fetch is attempted for that URL

  Scenario: Resolve data and blob sources without unsupported scheme denial
    Given a chat message contains data and blob attachment sources
    When attachment resolution runs
    Then data URLs are decoded locally
    And blob URLs are resolved in page context
    And unsupportedScheme denials are not emitted for data/blob
