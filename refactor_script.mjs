import fs from 'node:fs';
import path from 'node:path';

const scriptPath = path.resolve('script.js');
const content = fs.readFileSync(scriptPath, 'utf8');
const lines = content.split('\n');

const toDelete = [
    { start: 792, end: 873 }, // Note: 0-indexed values for splicing (line 793 is index 792)
    { start: 1066, end: 1094 },
    { start: 1096, end: 1179 },
    { start: 1249, end: 1757 }
];

// Delete in reverse order so indices don't shift!
for (let i = toDelete.length - 1; i >= 0; i--) {
    const { start, end } = toDelete[i];
    lines.splice(start, end - start);
}

const imports = `import {
  escapeHtml, normalizeImageSrc, stripImageTokens, replaceImageTokensForText,
  replaceImageTokensForHtml, renderImgTag, splitContentAndImages, renderRichMessageHtml,
  extractAllImageSources, extractAllFileSources, rewriteContentWithLocalAssets,
  renderRichMessageHtmlWithAssets, stripHtmlTags, hasNonLatinChars, pdfEscapeText, wrapLineSmart
} from './core/utils.js';

import { buildSearchablePdf, buildCanvasPdf, buildTextPdf } from './export/pdf.js';
`;

// Insert imports where `document.addEventListener('DOMContentLoaded', () => {` is
const domLoadedIndex = lines.findIndex(l => l.includes("document.addEventListener('DOMContentLoaded'"));
if (domLoadedIndex !== -1) {
    lines.splice(domLoadedIndex, 0, imports);
}

fs.writeFileSync(scriptPath, lines.join('\n'));
console.log('Successfully spliced script.js');
