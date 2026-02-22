Feature: Image and File Extraction and Embedding
  As a user exporting a ChatGPT conversation
  I want all generated images and file attachments to be properly detected, downloaded, and embedded in my export
  So that my exported document (HTML, DOCX, Markdown, or PDF) contains all the rich media and downloadable assets

  Background:
    Given the user has an active chat session with an AI model
    And the chat contains both generated images and downloadable files
    And the user initiates an export

  Scenario: Extracting image URLs from chat elements
    When the system scans the chat DOM for images
    Then it should detect standard `<img>` tags and background images
    And it should prioritize the highest quality source from `srcset` or `currentSrc`
    And it should ignore small icons, avatars, and UI elements (e.g., width/height <= 64px)
    And it should generate a `[[IMG:url]]` token for each valid image

  Scenario: Extracting file URLs from chat elements
    When the system scans the chat DOM for file attachments
    Then it should detect links with `download` attributes
    And it should detect buttons or elements with `data-file-url` attributes
    And it should detect binary file links pointing to `/backend-api/files/`, `blob:`, or OAI domains
    And it should generate a `[[FILE:url|filename]]` token for each valid file

  Scenario: Resolving and downloading assets (ZIP Mode)
    Given the user selects an export format that supports asset bundling (e.g., HTML+ZIP, Word+ZIP, Markdown)
    When the system processes the generated tokens
    Then it should fetch the binary data for all unique `[[IMG:...]]` and `[[FILE:...]]` tokens
    And it should determine the correct file extension using MIME type fallback logic (e.g., `image/jpeg` -> `.jpg`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` -> `.docx`)
    And it should sanitize the file names to prevent path traversal and ZIP slip attacks
    And it should add the downloaded files to an `urlMap` pointing to local `assets/` paths
    And it should package these assets into the final ZIP archive

  Scenario: Rendering file links in HTML and Word (DOCX)
    Given the system has generated an `urlMap` mapping token URLs to local ZIP paths
    When the HTML or DOCX renderer processes a `[[FILE:url|filename]]` token
    Then it should replace the token with an Interactive Anchor tag `<a href="localPath" download="filename">📎 filename</a>`
    And the styles applied to the anchor should make it appear as a distinct clickable attachment button

  Scenario: Rendering links in Markdown
    Given the system has generated an `urlMap` mapping token URLs to local ZIP paths
    When the Markdown renderer processes a `[[FILE:url|filename]]` token
    Then it should replace the token with standard markdown link syntax `[📎 filename](localPath)`
    And an `[[IMG:url]]` token should be replaced with `![Image](localPath)`

  Scenario: Rendering fallback PDF (Raster Mode)
    Given the PDF export requires fallback canvas rendering due to complex content or specific languages
    When the fallback PDF renderer processes the chat messages
    Then it should receive the `urlMap` context
    And it should correctly resolve `assets/` paths into usable image data for the PDF canvas
