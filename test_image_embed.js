// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// test_image_embed.js - Runtime image embedding smoke test v0.12.9

import fs from 'node:fs';
import vm from 'node:vm';

class FakeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onerror = null;
  }

  async readAsDataURL(blob) {
    try {
      const buf = Buffer.from(await blob.arrayBuffer());
      const mime = blob.type || 'application/octet-stream';
      this.result = `data:${mime};base64,${buf.toString('base64')}`;
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

async function main() {
  console.log('=== TEST: Image Embedding ===');

  const context = vm.createContext({
    window: {},
    Blob,
    FileReader: FakeFileReader,
    fetch: async () => ({
      ok: true,
      blob: async () => new Blob([Buffer.from('fake-image-bytes')], { type: 'image/png' })
    })
  });

  const source = fs.readFileSync(new URL('./asset_processor.js', import.meta.url), 'utf8');
  vm.runInContext(source, context);

  const DataProcessor = context.window.DataProcessor;
  if (!DataProcessor) throw new Error('DataProcessor not available');

  const processor = new DataProcessor();
  const result = await processor.embedImageAsBase64('https://example.com/test.png');

  console.assert(result.success === true, 'FAIL: embedding returned success=false');
  console.assert(String(result.base64 || '').startsWith('data:image/png;base64,'), 'FAIL: base64 prefix invalid');
  console.assert((result.base64 || '').length > 30, 'FAIL: base64 too short');

  console.log('PASS: embedImageAsBase64 produced valid base64 payload');
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
