// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// Author: Dr. Babak Sorkhpour with support from ChatGPT tools.
// asset_processor.js - DataProcessor v0.12.19

(() => {
  if (window.DataProcessor) return;

  class DataProcessor {
    constructor(options = {}) {
      this.options = { minImageSize: 50, maxRetries: 2, ...options };
    }

    sanitizeUrl(url = '') {
      return String(url).trim().replace(/[\]\)>'"\s]+$/g, '');
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

    deduplicateFiles(files = []) {
      const seen = new Set();
      return files.filter((file) => {
        const key = `${file.fileName || ''}|${file.url || file.path || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    extractFileName(element, fallback = 'file') {
      const text = (element?.textContent || '').trim();
      const aria = element?.getAttribute?.('aria-label') || '';
      const href = element?.getAttribute?.('href') || element?.href || '';
      const direct = element?.download || text.match(/[\w\-.]+\.(pdf|docx|xlsx|pptx|py|js|json|csv|txt|md|zip|png|jpe?g|webp)/i)?.[0]
        || aria.match(/[\w\-.]+\.\w+/)?.[0]
        || href.split('/').pop();
      return (direct || fallback).replace(/[\/:*?"<>|]+/g, '_').trim();
    }


    isIgnoredAttachmentUrl(url = '') {
      const clean = String(url || '').toLowerCase();
      if (!clean) return true;
      if (clean.startsWith('chrome-extension://')) return true;
      if (/\.(?:m?js|cjs|map)(?:$|\?)/i.test(clean)) return true;
      if (/\.(?:css|ico)(?:$|\?)/i.test(clean)) return true;
      if (/react(?:-dom)?\.production\.min\.js/i.test(clean)) return true;
      return false;
    }

    isLikelyUserDownload(url = '', fileName = '') {
      const probe = `${url} ${fileName}`.toLowerCase();
      if (/sandbox:\/mnt\/data\//i.test(probe) || /blob:/i.test(probe)) return true;
      return /\.(pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|txt|csv|json|py|md)(?:$|\?)/i.test(probe);
    }

    extractDownloadMetadata(text = '') {
      const links = [];
      const regex = /(blob:https?:\/\/[^\s"')]+|sandbox:\/\/[^\s"')]+|sandbox:\/[^\s"')]+|https?:\/\/[^\s"')]+\.(?:csv|pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|txt|json|py|md))/gi;
      let m;
      while ((m = regex.exec(String(text || ''))) !== null) {
        const u = this.sanitizeUrl(m[1]);
        const fileName = decodeURIComponent(u.split('/').pop() || 'file.bin');
        if (!this.isLikelyUserDownload(u, fileName) || this.isIgnoredAttachmentUrl(u)) continue;
        links.push({
          type: /^sandbox:/i.test(u) ? 'sandbox' : (/^blob:/i.test(u) ? 'blob_url' : 'text_reference'),
          fileName,
          url: u,
          download_url: u,
          needsResolution: /^sandbox:/i.test(u)
        });
      }
      return this.deduplicateFiles(links);
    }

    extractAllImages(messageElement) {
      const images = [];
      if (!messageElement) return images;

      const minSize = this.options.minImageSize;

      const imgTags = messageElement.querySelectorAll('img');
      imgTags.forEach((img) => {
        const src = this.sanitizeUrl(img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '');
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (!src) return;
        if (/icon|avatar/i.test(src) && w < minSize && h < minSize) return;
        if (w && h && (w < minSize || h < minSize)) return;
        images.push({ src, alt: img.alt || '', width: w, height: h, source: 'img' });
      });

      const all = messageElement.querySelectorAll('*');
      all.forEach((el) => {
        const bg = window.getComputedStyle(el).backgroundImage || '';
        if (!bg || bg === 'none') return;
        const m = bg.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (!m?.[1]) return;
        const src = this.sanitizeUrl(m[1]);
        images.push({ src, alt: '', type: 'background', element: el.tagName, source: 'background' });
      });

      const traverseShadow = (root) => {
        if (!root) return;
        if (root.shadowRoot) {
          root.shadowRoot.querySelectorAll('img').forEach((img) => {
            const src = this.sanitizeUrl(img.currentSrc || img.src || img.getAttribute('src') || '');
            if (src) images.push({ src, alt: img.alt || '', source: 'shadow' });
          });
          root.shadowRoot.querySelectorAll('*').forEach((el) => traverseShadow(el));
        }
      };
      traverseShadow(messageElement);

      return this.deduplicateFiles(images.map((i) => ({ ...i, fileName: i.src }))).map(({ fileName, ...rest }) => rest)
        .map((img) => ({
          ...img,
          isEmbedded: /^data:/i.test(img.src),
          embeddedData: /^data:/i.test(img.src) ? img.src : undefined,
          isBlob: /^blob:/i.test(img.src),
          needsFetch: /^blob:/i.test(img.src)
        }));
    }

    detectAllFileReferences(container) {
      const files = [];
      if (!container) return files;

      container.querySelectorAll('a[download], button[download]').forEach((el) => {
        files.push({
          type: 'download_attr',
          element: el,
          fileName: this.extractFileName(el),
          url: this.sanitizeUrl(el.href || el.dataset.href || '')
        });
      });

      container.querySelectorAll('a[href^="blob:"]').forEach((el) => {
        files.push({
          type: 'blob_url',
          element: el,
          fileName: this.extractFileName(el),
          url: this.sanitizeUrl(el.href || el.getAttribute('href') || '')
        });
      });

      const bodyText = container.textContent || '';
      const sandboxMatches = bodyText.match(/sandbox:\/mnt\/data\/[\w\-.]+/g) || [];
      sandboxMatches.forEach((path) => {
        files.push({
          type: 'sandbox',
          path,
          fileName: path.split('/').pop(),
          needsResolution: true,
          url: path
        });
      });

      const fileExtRegex = /([\w\-.]+\.(pdf|docx|xlsx|pptx|py|json|csv|txt|md|zip))/gi;
      const fileMatches = bodyText.match(fileExtRegex) || [];
      fileMatches.forEach((fileName) => {
        const link = Array.from(container.querySelectorAll('a, button')).find((el) => (el.textContent || '').includes(fileName));
        if (link) {
          files.push({
            type: 'text_reference',
            fileName,
            element: link,
            url: this.sanitizeUrl(link.href || link.dataset.href || link.getAttribute('href') || '')
          });
        }
      });

      container.querySelectorAll('[data-file], [class*="file-"]').forEach((el) => {
        const fileName = this.extractFileName(el, el.dataset.fileName || 'file.bin');
        const url = this.sanitizeUrl(el.href || el.dataset.url || el.getAttribute('data-file-url') || '');
        if (fileName && url) files.push({ type: 'present_files', fileName, url, element: el });
      });

      return this.deduplicateFiles(files).filter((f) => {
        const u = this.sanitizeUrl(f.url || f.path || "");
        const n = String(f.fileName || "");
        return !!u && !this.isIgnoredAttachmentUrl(u) && this.isLikelyUserDownload(u, n);
      });
    }

    async resolveSandboxFile(path, clickResolver) {
      if (!path) return null;
      if (typeof clickResolver === 'function') {
        try { return await clickResolver(path); } catch { return null; }
      }
      return null;
    }

    async fetchWithRetry(url, resolver) {
      const clean = this.sanitizeUrl(url);
      let attempt = 0;
      while (attempt <= this.options.maxRetries) {
        try {
          const blob = resolver ? await resolver(clean) : await fetch(clean).then((r) => (r.ok ? r.blob() : null));
          if (blob) return blob;
        } catch {
          // continue retries
        }
        attempt += 1;
      }
      return null;
    }



    async embedImageAsBase64(imageUrl, resolver) {
      const clean = this.sanitizeUrl(imageUrl);
      if (!clean) return { success: false, originalUrl: imageUrl, error: 'missing_image_url' };
      if (/^data:image\//i.test(clean)) {
        return { success: true, originalUrl: imageUrl, base64: clean, size: clean.length, type: clean.match(/^data:([^;]+)/i)?.[1] || 'image/*' };
      }
      try {
        const blob = await this.fetchWithRetry(clean, resolver);
        if (!blob) throw new Error('fetch_failed');
        const base64 = await this.blobToDataUri(blob, '');
        if (!/^data:/i.test(base64)) throw new Error('invalid_base64_result');
        return { success: true, originalUrl: imageUrl, base64, size: blob.size || 0, type: blob.type || 'application/octet-stream' };
      } catch (error) {
        return { success: false, originalUrl: imageUrl, error: error.message || 'embed_failed' };
      }
    }

    async embedImages(messages = [], resolver, onProgress) {
      const out = [];
      let processed = 0;
      for (const msg of messages) {
        const content = String(msg.content || '');
        const imgRegex = /\[\[IMG:([\s\S]*?)\]\]|!\[[^\]]*\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
        let updated = content;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          const src = this.sanitizeUrl(match[1] || match[2] || '');
          if (!src || /^data:image\//i.test(src)) continue;
          const embedded = await this.embedImageAsBase64(src, resolver);
          if (!embedded.success) {
            updated = updated.split(src).join('[Image Load Failed]');
          } else {
            updated = updated.split(src).join(embedded.base64);
          }
          processed += 1;
          if (onProgress) onProgress({ processed, src });
        }
        out.push({ ...msg, content: updated, downloads: this.extractDownloadMetadata(updated) });
      }
      return out;
    }

    async downloadAllFiles(files = [], resolver, sandboxResolver, onProgress) {
      const results = { succeeded: [], failed: [], total: files.length };
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        try {
          let target = file.url || file.download_url || file.path || '';
          if (file.type === 'sandbox' || /^sandbox:/i.test(target)) {
            const resolved = await this.resolveSandboxFile(target, sandboxResolver);
            if (resolved) target = resolved;
          }
          const blob = await this.fetchWithRetry(target, resolver);
          if (!blob) throw new Error('fetch_failed');
          results.succeeded.push({ fileName: file.fileName || 'file.bin', blob, size: blob.size, type: blob.type, source: target });
          if (onProgress) onProgress({ index: i + 1, total: files.length, status: 'ok', fileName: file.fileName || 'file.bin' });
        } catch (error) {
          results.failed.push({ fileName: file.fileName || 'file.bin', error: error.message || 'download_failed', url: file.url || file.path || '' });
          if (onProgress) onProgress({ index: i + 1, total: files.length, status: 'failed', fileName: file.fileName || 'file.bin', error: error.message });
        }
      }
      return results;
    }
  }

  window.DataProcessor = DataProcessor;
})();
