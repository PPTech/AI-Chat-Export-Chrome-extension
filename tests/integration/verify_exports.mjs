import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the pure functions we fixed
import { generateContent, computeDetectedCounts } from '../../lib/export.mjs';

// We need to mock some things for resolveAndEmbedAssets because it's inside script.js
// But we can just use the pure export functions directly to see if the renderers work.

async function runTest() {
    console.log('--- Starting Integration Test ---');
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const mockMessages = [
        {
            role: 'User',
            content: 'Please give me a report and some data.'
        },
        {
            role: 'Assistant',
            content: 'Here is your report and data.\n\n[[FILE:https://chatgpt.com/backend-api/files/file-abc|report.md]]\n[[FILE:https://chatgpt.com/backend-api/files/file-def|financials.xlsx]]\n[[FILE:https://chatgpt.com/backend-api/files/file-ghi|contract.docx]]\n[[FILE:https://chatgpt.com/backend-api/files/file-jkl|notes.txt]]\n\nAnd here is an image:\n[[IMG:https://chatgpt.com/backend-api/files/img-123]]'
        }
    ];

    const data = {
        title: 'ChatGPT Test Export',
        platform: 'ChatGPT',
        messages: mockMessages
    };

    // Simulate urlMap after resolveAndEmbedAssets
    const urlMap = new Map();
    urlMap.set('https://chatgpt.com/backend-api/files/file-abc', 'assets/001_report.md');
    urlMap.set('https://chatgpt.com/backend-api/files/file-def', 'assets/002_financials.xlsx');
    urlMap.set('https://chatgpt.com/backend-api/files/file-ghi', 'assets/003_contract.docx');
    urlMap.set('https://chatgpt.com/backend-api/files/file-jkl', 'assets/004_notes.txt');
    urlMap.set('https://chatgpt.com/backend-api/files/img-123', 'assets/005_image.png');

    const checkers = {
        useRaster: false,
        hasNonLatinChars: () => false,
        buildSearchablePdf: async () => new Uint8Array([1, 2, 3]), // dummy
        buildCanvasPdf: async () => new Uint8Array([1, 2, 3]), // dummy
        buildTextPdf: () => new Uint8Array([1, 2, 3]), // dummy
    };

    // 1. Generate HTML
    console.log('Generating HTML...');
    const htmlRes = await generateContent('html', data, urlMap, checkers);
    fs.writeFileSync(path.join(outDir, 'export.html'), htmlRes.content);

    // 2. Generate Word (doc)
    console.log('Generating DOC...');
    const docRes = await generateContent('doc', data, urlMap, checkers);
    fs.writeFileSync(path.join(outDir, 'export.doc'), docRes.content);

    // 3. Generate Markdown
    console.log('Generating MD...');
    const mdRes = await generateContent('md', data, urlMap, checkers);
    fs.writeFileSync(path.join(outDir, 'export.md'), mdRes.content);

    console.log('--- Test Complete. Outputs written to tests/integration/output/ ---');
}

runTest().catch(console.error);
