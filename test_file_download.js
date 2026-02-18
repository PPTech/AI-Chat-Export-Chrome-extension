// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// test_file_download.js - Runtime file download smoke test v0.12.9

import fs from 'node:fs';
import vm from 'node:vm';

class FakeFileReader {
  readAsDataURL() {}
}

async function main() {
  console.log('=== TEST: File Download ===');

  const context = vm.createContext({
    window: {},
    Blob,
    FileReader: FakeFileReader,
    fetch: async () => ({ ok: true, blob: async () => new Blob(['hello-world'], { type: 'text/plain' }) })
  });

  const source = fs.readFileSync(new URL('./asset_processor.js', import.meta.url), 'utf8');
  vm.runInContext(source, context);

  const DataProcessor = context.window.DataProcessor;
  if (!DataProcessor) throw new Error('DataProcessor not available');

  const processor = new DataProcessor();
  const results = await processor.downloadAllFiles([
    { type: 'blob_url', url: 'blob:https://example.com/1', fileName: 'test.txt' }
  ], async () => new Blob(['downloaded-content'], { type: 'text/plain' }));

  console.assert(results.succeeded.length === 1, 'FAIL: expected 1 succeeded download');
  console.assert(results.failed.length === 0, 'FAIL: expected 0 failed downloads');

  console.log('PASS: downloadAllFiles returns successful result set');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
