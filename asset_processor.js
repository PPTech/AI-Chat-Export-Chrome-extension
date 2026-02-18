// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// asset_processor.js - DataProcessor v0.10.25

(() => {
  if (window.DataProcessor) return;

  class DataProcessor {
    constructor(options = {}) {
      this.options = options;
    }

    async blobToDataUri(blob, fallback = '[Image Load Failed]') {
      if (!blob) return fallback;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || fallback));
        reader.onerror = () => resolve(fallback);
        reader.readAsDataURL(blob);
      });
    }

    sanitizeUrl(url = '') {
      return String(url).trim().replace(/[\]\)>'"\s]+$/g, '');
    }

    extractDownloadMetadata(text = '') {
      const links = [];
      const regex = /(blob:https?:\/\/[^\s"')]+|sandbox:\/\/[^\s"')]+|sandbox:\/[^\s"')]+|https?:\/\/[^\s"')]+\.(?:csv|pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|md|txt|json))/gi;
      let m;
      while ((m = regex.exec(String(text || ''))) !== null) {
        const u = this.sanitizeUrl(m[1]);
        links.push({ download_url: u, kind: /^blob:|^sandbox:/i.test(u) ? 'dynamic' : 'direct' });
      }
      return links;
    }

    async embedImages(messages = [], resolver) {
      const out = [];
      for (const msg of messages) {
        const content = String(msg.content || '');
        const imgRegex = /\[\[IMG:([\s\S]*?)\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
        let updated = content;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          const src = this.sanitizeUrl(match[1] || match[2] || '');
          if (!src || /^data:image\//i.test(src)) continue;
          try {
            const blob = resolver ? await resolver(src) : await fetch(src).then((r) => (r.ok ? r.blob() : null));
            const dataUri = await this.blobToDataUri(blob);
            updated = updated.split(src).join(dataUri);
          } catch {
            updated = updated.split(src).join('[Image Load Failed]');
          }
        }
        out.push({
          ...msg,
          content: updated,
          downloads: this.extractDownloadMetadata(updated)
        });
      }
      return out;
    }
  }

  window.DataProcessor = DataProcessor;
})();
