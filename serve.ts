// Mosslight Courier — minimal loopback static server for game/.
// Node 22, node:http / node:fs / node:path only, no dependency.
// Serves on 127.0.0.1 at process.env.PORT ?? 8080.

import { createServer } from 'node:http';
import { statSync, createReadStream } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';

const root = normalize(join(import.meta.dirname, 'game'));
const port = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

/** Resolves a URL path to a file inside game/, or null when unsafe. */
function safeFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const parts = clean.split(/[\\/]/).filter((s) => s.length > 0);
  if (parts.some((s) => s === '..' || s.startsWith('.'))) return null;
  const abs = normalize(join(root, ...parts));
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  return abs;
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('method not allowed');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let target = safeFile(url.pathname);
  if (!target) {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  try {
    const st = statSync(target);
    if (st.isDirectory()) target = join(target, 'index.html');
    statSync(target);
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const type = TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mosslight Courier: http://127.0.0.1:${port}/ (serving ${root})`);
});
