// License: AGPL-3.0
// export/pdf.js - PDF generation module

import {
    stripHtmlTags,
    hasNonLatinChars,
    pdfEscapeText,
    splitContentAndImages,
    wrapLineSmart,
    normalizeImageSrc,
    rewriteContentWithLocalAssets,
    extractAllImageSources
} from '../core/utils.js';

export async function buildSearchablePdf(title, messages, platform, urlMap) {
    const renderData = {
        title,
        messages: (messages || []).map((m) => ({
            role: m.role,
            content: urlMap ? rewriteContentWithLocalAssets(m.content, urlMap) : m.content,
        })),
        platform: platform || 'Unknown',
        exportDate: new Date().toISOString(),
    };
    await new Promise((resolve) => chrome.storage.local.set({ pdf_render_data: renderData }, resolve));

    let pdfTabId = null;
    try {
        const tab = await new Promise((resolve) => {
            chrome.tabs.create({ url: chrome.runtime.getURL('pdf_render.html'), active: false }, resolve);
        });
        pdfTabId = tab.id;

        await new Promise((resolve, reject) => {
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                if (attempts > 60) { clearInterval(poll); reject(new Error('PDF render timeout')); return; }
                try {
                    const t = await new Promise((r) => {
                        chrome.tabs.get(pdfTabId, (info) => r(info?.title || ''));
                    });
                    if (t === 'PDF_RENDER_READY') { clearInterval(poll); resolve(); }
                } catch { clearInterval(poll); reject(new Error('PDF tab closed')); }
            }, 250);
        });

        await new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId: pdfTabId }, '1.3', () => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve();
            });
        });

        const result = await new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId: pdfTabId }, 'Page.printToPDF', {
                printBackground: true,
                preferCSSPageSize: true,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
            }, (res) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(res);
            });
        });

        try {
            await new Promise((resolve) => chrome.debugger.detach({ tabId: pdfTabId }, resolve));
        } catch (_) { /* already detached */ }

        const binaryStr = atob(result.data);
        const pdfBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) pdfBytes[i] = binaryStr.charCodeAt(i);

        return pdfBytes;
    } finally {
        if (pdfTabId) {
            try { chrome.tabs.remove(pdfTabId); } catch (_) { /* tab may be gone */ }
        }
        try { chrome.storage.local.remove('pdf_render_data'); } catch (_) { /* ignore */ }
    }
}

export async function buildCanvasPdf(title, messages) {
    const PAGE_W = 595; // A4 points
    const PAGE_H = 842;
    const SCALE = 2; // retina-quality rendering
    const MARGIN = 40;
    const FONT_SIZE = 11;
    const TITLE_SIZE = 18;
    const ROLE_SIZE = 13;
    const LINE_HEIGHT = FONT_SIZE * 1.5;
    const CONTENT_W = PAGE_W - (MARGIN * 2);
    const CONTENT_H = PAGE_H - (MARGIN * 2);
    const MAX_IMG_H = 200; // max image height per page in points

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W * SCALE;
    canvas.height = PAGE_H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    const pageImages = [];
    let cursorY = MARGIN;

    function detectTextDir(text) {
        if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(text)) return 'rtl';
        return 'ltr';
    }

    function newPage() {
        if (cursorY > MARGIN) {
            pageImages.push(canvas.toDataURL('image/png'));
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);
        cursorY = MARGIN;
    }

    function ensureSpace(needed) {
        if (cursorY + needed > PAGE_H - MARGIN) {
            newPage();
        }
    }

    function wrapTextForCanvas(text, maxWidth, font) {
        ctx.font = font;
        const words = text.split(/\s+/);
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    }

    function drawText(text, fontSize, bold, color) {
        if (!text) return;
        const dir = detectTextDir(text);
        const font = `${bold ? 'bold ' : ''}${fontSize}px -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "Noto Sans CJK SC", Arial, sans-serif`;
        ctx.font = font;
        ctx.fillStyle = color || '#111827';
        ctx.textAlign = dir === 'rtl' ? 'right' : 'left';
        const xPos = dir === 'rtl' ? PAGE_W - MARGIN : MARGIN;

        const rawLines = text.split('\n');
        for (const rawLine of rawLines) {
            const wrapped = wrapTextForCanvas(rawLine, CONTENT_W, font);
            for (const wl of wrapped) {
                ensureSpace(fontSize + 4);
                ctx.fillText(wl, xPos, cursorY + fontSize);
                cursorY += fontSize + 4;
            }
        }
        ctx.textAlign = 'left'; // reset
    }

    async function drawImage(src) {
        if (!src) return;
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = src;
                setTimeout(reject, 5000); // 5s timeout
            });
            const aspect = img.width / Math.max(1, img.height);
            let drawW = Math.min(CONTENT_W, img.width);
            let drawH = drawW / aspect;
            if (drawH > MAX_IMG_H) {
                drawH = MAX_IMG_H;
                drawW = drawH * aspect;
            }
            ensureSpace(drawH + 10);
            ctx.drawImage(img, MARGIN, cursorY, drawW, drawH);
            cursorY += drawH + 10;
        } catch {
            ensureSpace(20);
            ctx.fillStyle = '#9ca3af';
            ctx.font = `italic 9px Arial, sans-serif`;
            ctx.fillText('[Image could not be embedded]', MARGIN, cursorY + 10);
            cursorY += 20;
            ctx.fillStyle = '#111827';
        }
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    drawText(title || 'Chat Export', TITLE_SIZE, true, '#1e3a5f');
    cursorY += 8;

    for (const m of messages) {
        ensureSpace(LINE_HEIGHT * 2);

        const roleColor = /user/i.test(m.role) ? '#2563eb' : '#059669';
        ctx.fillStyle = roleColor + '15';
        ctx.fillRect(MARGIN - 4, cursorY - 2, CONTENT_W + 8, ROLE_SIZE + 8);
        drawText(`[${m.role}]`, ROLE_SIZE, true, roleColor);
        cursorY += 4;

        const parts = splitContentAndImages(m.content || '');
        for (const part of parts) {
            if (part.type === 'image') {
                await drawImage(normalizeImageSrc(part.value));
            } else {
                const clean = stripHtmlTags(part.value || '');
                if (clean.trim()) drawText(clean, FONT_SIZE, false, '#111827');
            }
        }
        cursorY += 12;
    }

    if (cursorY > MARGIN) {
        pageImages.push(canvas.toDataURL('image/png'));
    }

    return assemblePdfFromImages(pageImages, PAGE_W, PAGE_H);
}

export function assemblePdfFromImages(pageDataUrls, pageW, pageH) {
    const objects = [];
    objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

    const kids = [];
    let objNum = 3;

    for (const dataUrl of pageDataUrls) {
        const base64 = dataUrl.split(',')[1] || '';
        const binaryStr = atob(base64);
        const imgBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) imgBytes[i] = binaryStr.charCodeAt(i);

        const pngInfo = parsePngInfo(imgBytes);
        const imgObjNum = objNum;
        const pageObjNum = objNum + 1;
        const contentObjNum = objNum + 2;

        const imgStream = imgBytes;
        objects[imgObjNum] = buildPdfImageObject(imgObjNum, imgStream, pngInfo.width, pngInfo.height);

        const contentStr = `q ${pageW} 0 0 ${pageH} 0 0 cm /Img${imgObjNum} Do Q`;
        objects[contentObjNum] = `${contentObjNum} 0 obj\n<< /Length ${contentStr.length} >>\nstream\n${contentStr}\nendstream\nendobj\n`;

        objects[pageObjNum] = `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Img${imgObjNum} ${imgObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`;

        kids.push(`${pageObjNum} 0 R`);
        objNum += 3;
    }

    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageDataUrls.length} >>\nendobj\n`;

    const enc = new TextEncoder();
    const header = enc.encode('%PDF-1.4\n');
    const chunks = [header];
    const offsets = [0];
    let offset = header.length;

    for (let i = 1; i < objects.length; i++) {
        if (!objects[i]) continue;
        offsets[i] = offset;
        if (typeof objects[i] === 'string') {
            const bytes = enc.encode(objects[i]);
            chunks.push(bytes);
            offset += bytes.length;
        } else {
            chunks.push(objects[i]);
            offset += objects[i].length;
        }
    }

    const maxObj = objects.length - 1;
    const xrefStart = offset;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxObj; i++) {
        xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    }
    chunks.push(enc.encode(xref));
    chunks.push(enc.encode(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));

    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
        out.set(chunk, pos);
        pos += chunk.length;
    }
    return out;
}

export function parsePngInfo(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
    }
    return { width: 595, height: 842 }; // fallback A4
}

export function buildPdfImageObject(objNum, pngBytes, width, height) {
    const hexStream = Array.from(pngBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const header = `${objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${hexStream.length + 1} >>\nstream\n`;
    const footer = `>\nendstream\nendobj\n`;

    const enc = new TextEncoder();
    const headerBytes = enc.encode(header);
    const hexBytes = enc.encode(hexStream);
    const footerBytes = enc.encode(footer);

    const total = headerBytes.length + hexBytes.length + footerBytes.length;
    const result = new Uint8Array(total);
    result.set(headerBytes, 0);
    result.set(hexBytes, headerBytes.length);
    result.set(footerBytes, headerBytes.length + hexBytes.length);
    return result;
}

export function buildTextPdf(title, messages) {
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 50;
    const FONT_SIZE = 10;
    const TITLE_SIZE = 16;
    const ROLE_SIZE = 12;
    const LINE_HEIGHT = 14;
    const MAX_CHARS = 85;

    const pages = [];
    let currentPage = [];
    let cursorY = PAGE_H - MARGIN;

    function ensureSpace(needed) {
        if (cursorY - needed < MARGIN) {
            pages.push(currentPage);
            currentPage = [];
            cursorY = PAGE_H - MARGIN;
        }
    }

    function addLine(text, fontSize = FONT_SIZE, bold = false) {
        const cleaned = pdfEscapeText(text);
        if (!cleaned) return;
        ensureSpace(fontSize + 4);
        const fontName = bold ? '/F2' : '/F1';
        currentPage.push(`BT ${fontName} ${fontSize} Tf ${MARGIN} ${cursorY.toFixed(1)} Td (${cleaned}) Tj ET`);
        cursorY -= (fontSize + 4);
    }

    function addWrappedText(text, fontSize = FONT_SIZE, bold = false) {
        const clean = stripHtmlTags(stripImageTokens(text));
        const lines = wrapLineSmart(clean, MAX_CHARS);
        for (const line of lines) {
            addLine(line, fontSize, bold);
        }
    }

    addLine(title || 'Chat Export', TITLE_SIZE, true);
    cursorY -= 10;

    for (const m of messages) {
        ensureSpace(LINE_HEIGHT * 3);
        addLine(`[${m.role}]`, ROLE_SIZE, true);
        addWrappedText(m.content || '', FONT_SIZE, false);
        cursorY -= 8;
    }

    pages.push(currentPage);
    return assemblePdfDocument(pages, PAGE_W, PAGE_H);
}

export function assemblePdfDocument(pages, pageW, pageH) {
    const objects = [];

    objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;
    objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`;

    const resourcesRef = '<< /Font << /F1 3 0 R /F2 4 0 R >> >>';

    const kids = [];
    let objNum = 5;
    const pageDefs = [];

    for (const ops of pages) {
        const pageObj = objNum;
        const contentObj = objNum + 1;
        kids.push(`${pageObj} 0 R`);

        const stream = ops.join('\n');
        objects[contentObj] = `${contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
        objects[pageObj] = `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources ${resourcesRef} /Contents ${contentObj} 0 R >>\nendobj\n`;

        pageDefs.push({ pageObj, contentObj });
        objNum += 2;
    }

    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>\nendobj\n`;

    const enc = new TextEncoder();
    const header = enc.encode('%PDF-1.4\n');
    const chunks = [header];
    const offsets = [0];
    let offset = header.length;

    for (let i = 1; i < objects.length; i++) {
        if (!objects[i]) continue;
        offsets[i] = offset;
        const bytes = enc.encode(objects[i]);
        chunks.push(bytes);
        offset += bytes.length;
    }

    const maxObj = objects.length - 1;
    const xrefStart = offset;
    let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= maxObj; i++) {
        xref += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
    }
    chunks.push(enc.encode(xref));
    chunks.push(enc.encode(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));

    const total = chunks.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
        out.set(chunk, pos);
        pos += chunk.length;
    }
    return out;
}
