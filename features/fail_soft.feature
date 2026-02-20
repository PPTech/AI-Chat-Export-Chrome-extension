Feature: Fail-soft export pipeline
  All exports complete even when individual components fail.
  Diagnostics and manifests are always included.

  Scenario: Single format failure does not abort export
    Given a chat with 10 messages
    And the PDF generator throws an error
    When the user exports as PDF and HTML
    Then the HTML file is still generated
    And the bundle manifest lists PDF in formatErrors
    And export_bundle_manifest.json contains the failure reason

  Scenario: All exports always produce diagnostics summary
    Given any completed export run
    When the ZIP is assembled
    Then diagnostics_summary.json is always included
    And export_bundle_manifest.json is always included
    And both files appear before the single-file download check

  Scenario: Asset fetch failure records reason in manifest
    Given the export pipeline fetches images
    And one image URL returns HTTP 403
    When the export completes
    Then assetFailureReasons includes the failed URL
    And assetFailureReasons includes reason "HTTP 403"
    And the other images are still embedded

  Scenario: Partial file downloads include failure manifest
    Given the user clicks Export Files
    And 3 of 5 detected files cannot be fetched
    When the download completes
    Then the ZIP contains 2 successfully fetched files
    And the ZIP contains file_failures.json
    And file_failures.json lists the 3 failed files with error messages
    And an info toast shows "2 of 5 file(s) downloaded"

  Scenario: Complete file download failure shows actionable error
    Given the user clicks Export Files
    And all detected files fail to download
    When the download is attempted
    Then an error modal is displayed
    And the error message includes "Could not download"
    And the error includes up to 3 failure details
