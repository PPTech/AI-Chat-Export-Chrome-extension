$lines = Get-Content -ReadCount 0 -Path script.js

# We keep lines that are NOT in the deletion blocks.
# Index ranges to KEEP (0-indexed, inclusive)
# Deletions: 792..872, 1066..1093, 1096..1178, 1249..1756
$newLines = @()
if ($lines.Count -gt 0) {
    $newLines += $lines[0..791]
    $newLines += $lines[873..1065]
    $newLines += $lines[1094..1095]
    $newLines += $lines[1179..1248]
    $newLines += $lines[1757..($lines.Count - 1)]
}

$imports = @"
import {
  escapeHtml, normalizeImageSrc, stripImageTokens, replaceImageTokensForText,
  replaceImageTokensForHtml, renderImgTag, splitContentAndImages, renderRichMessageHtml,
  extractAllImageSources, extractAllFileSources, rewriteContentWithLocalAssets,
  renderRichMessageHtmlWithAssets, stripHtmlTags, hasNonLatinChars, pdfEscapeText, wrapLineSmart
} from './core/utils.js';

import { buildSearchablePdf, buildCanvasPdf, buildTextPdf } from './export/pdf.js';
"@

$domLoadedIdx = -1
for ($i=0; $i -lt $newLines.Count; $i++) {
    if ($newLines[$i] -match "document.addEventListener\('DOMContentLoaded'") {
        $domLoadedIdx = $i
        break
    }
}

if ($domLoadedIdx -ge 0) {
    $finalLines = @()
    if ($domLoadedIdx -gt 0) { $finalLines += $newLines[0..($domLoadedIdx-1)] }
    
    # Needs purely \n split or maybe cross-platform split
    $importLines = $imports -split "`r?`n"
    $finalLines += $importLines
    
    $finalLines += $newLines[$domLoadedIdx..($newLines.Count - 1)]
    $finalLines | Set-Content script.js -Encoding UTF8
    Write-Host "Successfully spliced script.js using PowerShell."
} else {
    Write-Host "Failed to find DOMContentLoaded"
}
