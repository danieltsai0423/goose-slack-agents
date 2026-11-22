import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { taskAccess } from './office-runtime.mjs';

const previews = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};

export async function serveOfficeFile(req, res, root, taskId, encodedName, task) {
  if (!root || !task || taskAccess(task) === 'chat') return false;
  let name, file, size;
  try {
    name = decodeURIComponent(encodedName);
    if (!name || name.startsWith('.') || /[\x00-\x1f\\/:*?"<>|]/.test(name)) return false;
    const base = await realpath(root);
    const folder = join(base, taskId);
    if (await realpath(folder) !== folder) return false;
    file = await realpath(join(folder, name));
    if (dirname(file) !== folder) return false;
    const info = await stat(file);
    if (!info.isFile()) return false;
    size = info.size;
  } catch { return false; }

  const preview = req.url.endsWith('?download=1') ? undefined : previews[extname(file).toLowerCase()];
  const nameAttribute = encodeURIComponent(name).replace(/['()*]/g, ch => '%' + ch.charCodeAt(0).toString(16));
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': preview || 'application/octet-stream',
    'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${nameAttribute}`,
    'Content-Length': size
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let start = 0, end = size - 1, status = 200;
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    if (range[1] && range[2]) end = Math.min(end, Number(range[2]));
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return true;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = end - start + 1;
  }
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || !size) res.end();
  else await pipeline(createReadStream(file, { start, end }), res);
  return true;
}
