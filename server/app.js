// Node HTTP 서버 (외부 의존성 없음): 정적 파일 + /api
// /api 는 server/handler.js (Vercel 함수와 같은 코드)로 넘김

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { JsonStore } from './store.js';
import { createHandler, validateScore } from './handler.js';

export { validateScore };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function createApp(cfg, { store } = {}) {
  store = store || new JsonStore(cfg.dataFile).init();
  const handle = createHandler(cfg, { store });
  const pruneTimer = setInterval(() => store.prune(), 30 * 60 * 1000);
  pruneTimer.unref?.();

  const readBody = (req, max = 1024 * 1024) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > max) {
          reject(Object.assign(new Error('too_large'), { status: 413 }));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

  const clientIp = (req) =>
    (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  /** Node 요청 → fetch Request → handler → Node 응답 */
  async function bridge(req, res, url) {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const out = await handle(new Request(url, { method: req.method, headers, body }), { ip: clientIp(req) });
    const h = {};
    out.headers.forEach((v, k) => k !== 'set-cookie' && (h[k] = v));
    const cookies = out.headers.getSetCookie();
    if (cookies.length) h['set-cookie'] = cookies;
    res.writeHead(out.status, h);
    res.end(Buffer.from(await out.arrayBuffer()));
  }

  // ------------------- 정적 파일 -------------------
  const publicDir = cfg.publicDir;
  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(publicDir, rel));
    if (!file.startsWith(publicDir + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('없는 페이지예요');
      }
      const ext = path.extname(file).toLowerCase();
      const etag = `W/"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': st.size,
        ETag: etag,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      res.writeHead(400);
      return res.end();
    }
    try {
      if (url.pathname.startsWith('/api/')) return await bridge(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return res.end();
      }
      return serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(e.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.status ? e.message : 'server_error' }));
      }
      if (!e.status) console.error(e);
    }
  });
  server.on('close', () => {
    clearInterval(pruneTimer);
    store.flush();
  });
  return { server, store };
}
