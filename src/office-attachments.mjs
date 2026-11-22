import { createHash } from 'node:crypto';
import { attachmentFileBytes, attachmentImageBytes, attachmentLimit, attachmentTotalBytes, attachmentType } from '../office/attachment-types.js';

export const attachmentRequestBytes = Math.ceil(attachmentTotalBytes / 3) * 4 + 48000;
const excerptLimit = 18000;
const maxPdfPages = 30;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const pdfRoot = new URL('./', import.meta.resolve('pdfjs-dist/package.json'));

function rejectAttachment(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function matchSignature(mime, bytes) {
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mime === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (mime === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'application/pdf') return bytes.toString('ascii', 0, 5) === '%PDF-';
  return true;
}

async function describePdf(bytes, maxVisuals) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({
    data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, enableXfa: false,
    useWorkerFetch: false, maxImageSize: 16000000,
    standardFontDataUrl: new URL('standard_fonts/', pdfRoot).href,
    cMapUrl: new URL('cmaps/', pdfRoot).href, cMapPacked: true,
    wasmUrl: new URL('wasm/', pdfRoot).href,
  });
  try {
    const document = await loading.promise;
    let text = '', missed = 0, pageNumber = 1;
    const visuals = [];
    for (; pageNumber <= Math.min(maxPdfPages, document.numPages) && text.length < excerptLimit; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const value = content.items.map(item => typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (value) {
          text += `[第 ${pageNumber} 頁]\n${value}\n`;
        } else if (visuals.length < maxVisuals) {
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2, 1500 / Math.max(base.width, base.height)) });
          const drawing = document.canvasFactory.create(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
          try {
            await page.render({ canvasContext: drawing.context, viewport }).promise;
            visuals.push({ page: pageNumber, data: drawing.canvas.toBuffer('image/jpeg', 85).toString('base64') });
          } finally {
            document.canvasFactory.destroy(drawing);
          }
        } else {
          missed++;
        }
      } finally { page.cleanup(); }
    }
    const partial = missed > 0 || pageNumber <= document.numPages || text.length > excerptLimit;
    return {
      text: text.slice(0, excerptLimit) + (partial ? '\n[檔案僅提供部分頁面或文字，請勿假設其餘內容。]' : ''),
      visuals
    };
  } finally {
    await loading.destroy();
  }
}

export async function readOfficeAttachments(input) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > attachmentLimit) throw rejectAttachment('一次最多附加 5 個檔案。');
  let total = 0, visualPages = 4;
  const result = [];
  for (const file of input) {
    const name = typeof file?.name === 'string' ? file.name.trim() : '';
    const mime = attachmentType(name);
    if (!mime || name.length > 180 || !name.isWellFormed() || /[\x00-\x1f\x7f\\/:*?"<>|]/.test(name)) {
      throw rejectAttachment('附件格式或檔名不受支援。');
    }
    const encoded = file.data;
    if (typeof encoded !== 'string' || !encoded || encoded.length % 4 !== 0) throw rejectAttachment('附件內容格式錯誤。');
    if (encoded.length > Math.ceil(attachmentFileBytes / 3) * 4) throw rejectAttachment('單一附件最多 10 MB。', 413);
    if (/[^A-Za-z0-9+/=]/.test(encoded)) throw rejectAttachment('附件內容格式錯誤。');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.toString('base64') !== encoded || !matchSignature(mime, bytes)) {
      throw rejectAttachment(`無法讀取「${name}」，請確認檔案內容與格式相符。`);
    }
    total += bytes.length;
    if (bytes.length > attachmentFileBytes || total > attachmentTotalBytes) throw rejectAttachment('單一附件最多 10 MB，總大小最多 20 MB。', 413);
    if (mime.startsWith('image/') && bytes.length > attachmentImageBytes) throw rejectAttachment('單張圖片最多 7 MB。', 413);
    let text = '', visuals = [];
    if (mime === 'application/pdf') {
      try {
        ({ text, visuals } = await describePdf(bytes, Math.min(3, visualPages)));
        visualPages -= visuals.length;
      } catch (error) {
        const reason = error?.name === 'PasswordException' ? '需要密碼，請先解鎖再上傳。' : '無法讀取，請檢查檔案或將需要的頁面貼成截圖。';
        throw rejectAttachment(`「${name}」${reason}`);
      }
    } else if (!mime.startsWith('image/')) {
      try {
        const content = utf8.decode(bytes);
        if (content.includes('\0')) throw new Error('binary');
        text = content.slice(0, excerptLimit) + (content.length > excerptLimit ? '\n[附件文字已截斷。]' : '');
      } catch {
        throw rejectAttachment(`「${name}」請使用 UTF-8 文字格式。`);
      }
    }
    result.push({ name, mime, data: bytes, text, visuals, hash: createHash('sha256').update(bytes).digest('hex') });
  }
  return result;
}

export function serveOfficeAttachment(req, res, file, download) {
  const inline = file.mime.startsWith('image/') && !download;
  const name = encodeURIComponent(file.name).replace(/['()*]/g, ch => '%' + ch.charCodeAt(0).toString(16));
  res.writeHead(200, {
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Type': inline ? file.mime : 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
    'Content-Length': file.data.byteLength,
  });
  res.end(req.method === 'HEAD' ? undefined : file.data);
}
