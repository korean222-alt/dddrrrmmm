// HTTP 서버 (외부 의존성 없음): 정적 파일 + /api + /webhook

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { JsonStore } from './store.js';
import { createInstagram, verifySignature } from './instagram.js';
import { generateCode, displayCode, isCode } from './codes.js';
import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { messagesFromWebhook, processDm } from './verify.js';
import { getLevel, isGated, levelDuration, noteCount, maxScore, scoreBounds, gradeFor, COUNT_IN_BARS, barDur } from '../public/js/charts.js';

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

const PLAYER_COOKIE = 'kk_player';
const SID_COOKIE = 'kk_sid';
const PLAYER_MAX_AGE = 180 * 24 * 3600;

/** 아주 단순한 IP별 요청 제한 */
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const h = hits.get(key) || { n: 0, reset: now + windowMs };
    if (now > h.reset) {
      h.n = 0;
      h.reset = now + windowMs;
    }
    h.n++;
    hits.set(key, h);
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    return h.n <= limit;
  };
}

export function createApp(cfg, { store, ig } = {}) {
  store = store || new JsonStore(cfg.dataFile).init();
  ig = ig || createInstagram(cfg);
  const limitCodes = rateLimiter(15, 10 * 60 * 1000);
  const limitScores = rateLimiter(60, 10 * 60 * 1000);
  const pruneTimer = setInterval(() => store.prune(), 30 * 60 * 1000);
  pruneTimer.unref?.();

  const send = (res, status, data, headers = {}) => {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  };

  const readBody = (req, max = 64 * 1024) =>
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

  const readJson = async (req) => {
    const raw = await readBody(req);
    if (!raw.length) return {};
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      throw Object.assign(new Error('bad_json'), { status: 400 });
    }
  };

  const clientIp = (req) =>
    (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  function getPlayer(req) {
    const c = parseCookies(req.headers.cookie);
    const p = unsign(c[PLAYER_COOKIE], cfg.sessionSecret);
    if (!p || !p.igsid) return null;
    const rec = store.getPlayer(p.igsid);
    return rec ? { igsid: rec.igsid, username: rec.username, followVerifiedAt: rec.followVerifiedAt } : null;
  }

  function getSid(req, res) {
    const c = parseCookies(req.headers.cookie);
    let sid = unsign(c[SID_COOKIE], cfg.sessionSecret)?.sid;
    if (!sid) {
      sid = newId();
      res.setHeader('Set-Cookie', cookie(SID_COOKIE, sign({ sid }, cfg.sessionSecret), { secure: cfg.cookieSecure, maxAge: 7 * 24 * 3600 }));
    }
    return sid;
  }

  // ------------------- API -------------------
  async function api(req, res, url) {
    const p = url.pathname;
    const m = req.method;

    if (p === '/api/health') return send(res, 200, { ok: true, app: 'kongkong-drum' });

    if (p === '/api/config' && m === 'GET') {
      return send(res, 200, {
        gateMode: cfg.gateMode,
        gateFromLevel: cfg.gateFromLevel,
        instagramHandle: cfg.instagramHandle,
        followCheckMode: cfg.followCheckMode,
        devSimulate: cfg.devSimulate,
        codePrefix: cfg.codePrefix,
        siteUrl: cfg.siteUrl,
      });
    }

    if (p === '/api/me' && m === 'GET') {
      const pl = getPlayer(req);
      return send(res, 200, pl ? { verified: true, player: { username: pl.username } } : { verified: false });
    }

    if (p === '/api/logout' && m === 'POST') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(PLAYER_COOKIE, '', { maxAge: 0, secure: cfg.cookieSecure }) });
    }

    // 1) 일회용 코드 발급
    if (p === '/api/codes' && m === 'POST') {
      if (!limitCodes(clientIp(req))) return send(res, 429, { error: 'rate_limited' });
      const body = await readJson(req);
      const purpose = body.purpose === 'ranking' ? 'ranking' : 'unlock';
      const sid = getSid(req, res);
      let code;
      for (let i = 0; i < 20; i++) {
        code = generateCode();
        const ex = store.getCode(code);
        if (!ex || ex.expiresAt < Date.now()) break;
      }
      const now = Date.now();
      store.createCode({ code, purpose, sessionId: sid, status: 'pending', createdAt: now, expiresAt: now + cfg.codeTtlMs });
      return send(res, 200, { code, display: displayCode(code, cfg.codePrefix), purpose, expiresAt: now + cfg.codeTtlMs });
    }

    // 2) 코드 상태 확인 (발급받은 브라우저만)
    const cm = p.match(/^\/api\/codes\/([^/]+)$/);
    if (cm && m === 'GET') {
      const code = decodeURIComponent(cm[1]).toUpperCase().replace(/^.*-/, '');
      const rec = isCode(code) ? store.getCode(code) : null;
      const c = parseCookies(req.headers.cookie);
      const sid = unsign(c[SID_COOKIE], cfg.sessionSecret)?.sid;
      if (!rec || rec.sessionId !== sid) return send(res, 404, { status: 'expired' });
      if ((rec.status === 'pending' || rec.status === 'not_following') && Date.now() > rec.expiresAt) {
        store.updateCode(code, { status: 'expired' });
      }
      if (rec.status === 'verified') {
        const player = store.getPlayer(rec.igsid);
        const token = sign({ igsid: rec.igsid, v: rec.verifiedAt }, cfg.sessionSecret);
        return send(
          res,
          200,
          { status: 'verified', player: { username: player?.username || rec.username } },
          { 'Set-Cookie': cookie(PLAYER_COOKIE, token, { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }) }
        );
      }
      return send(res, 200, { status: rec.status });
    }

    // 개발용: DM 보낸 척 (FAKE 테스트)
    if (p === '/api/dev/simulate-dm' && m === 'POST') {
      if (!cfg.devSimulate) return send(res, 404, { error: 'not_found' });
      const body = await readJson(req);
      const code = String(body.code || '').toUpperCase().replace(/^.*-/, '');
      const rec = store.getCode(code);
      const c = parseCookies(req.headers.cookie);
      const sid = unsign(c[SID_COOKIE], cfg.sessionSecret)?.sid;
      if (!rec || rec.sessionId !== sid) return send(res, 404, { error: 'code_not_found' });
      const igsid = String(body.igsid || 'dev_' + crypto.createHash('sha1').update(sid).digest('hex').slice(0, 10));
      const checkFollow = body.notFollowing
        ? async () => ({ following: false, username: 'dev_tester' })
        : async (id) => {
            const r = await ig.checkFollow(id);
            return { ...r, username: body.username || (r.username?.startsWith('player_') ? 'dev_tester' : r.username) };
          };
      const out = await processDm({ igsid, text: `${cfg.codePrefix}-${code}` }, { store, ig: { ...ig, sendDm: async () => ({}) }, cfg, checkFollow });
      return send(res, 200, { ok: true, ...out });
    }

    // 3) 판 시작 토큰 (점수 위조 방지용 최소 장치)
    if (p === '/api/runs' && m === 'POST') {
      const body = await readJson(req);
      const level = getLevel(body.level);
      if (!level) return send(res, 400, { error: 'bad_level' });
      if (isGated(level, cfg.gateFromLevel) && cfg.gateMode === 'follow' && !getPlayer(req)) return send(res, 403, { error: 'follow_required' });
      const runToken = sign({ l: level.id, t: Date.now(), n: newId() }, cfg.sessionSecret);
      return send(res, 200, { runToken });
    }

    // 4) 점수 등록 (팔로우 인증 필수)
    if (p === '/api/scores' && m === 'POST') {
      if (!limitScores(clientIp(req))) return send(res, 429, { error: 'rate_limited' });
      const pl = getPlayer(req);
      if (!pl) return send(res, 401, { error: 'verify_required' });
      const body = await readJson(req);
      const v = validateScore(body, cfg);
      if (!v.ok) return send(res, 400, { error: v.error });
      if (!store.useRun(v.nonce, Date.now() + 2 * 24 * 3600 * 1000)) return send(res, 409, { error: 'run_used' });
      const out = store.recordScore(pl.igsid, v.level.id, { score: v.score, grade: v.grade, maxCombo: v.maxCombo });
      const lb = store.leaderboard(v.level.id, 1);
      const rank = lb.all.find((r) => r.igsid === pl.igsid)?.rank || null;
      return send(res, 200, { ...out, rank });
    }

    if (p === '/api/leaderboard' && m === 'GET') {
      const level = getLevel(url.searchParams.get('level') || 4);
      if (!level) return send(res, 400, { error: 'bad_level' });
      const pl = getPlayer(req);
      const lb = store.leaderboard(level.id, 50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, score: r.score, grade: r.grade, me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? lb.all.find((r) => r.igsid === pl.igsid) : null;
      return send(res, 200, { level: level.id, entries, me: mine ? { rank: mine.rank, score: mine.score } : null });
    }

    return send(res, 404, { error: 'not_found' });
  }

  // ------------------- 인스타 웹훅 -------------------
  async function webhook(req, res, url) {
    if (req.method === 'GET') {
      // Meta 웹훅 등록 시 확인 요청
      const q = url.searchParams;
      if (q.get('hub.mode') === 'subscribe' && cfg.ig.verifyToken && q.get('hub.verify_token') === cfg.ig.verifyToken) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(q.get('hub.challenge') || '');
      }
      res.writeHead(403);
      return res.end();
    }
    if (req.method !== 'POST') {
      res.writeHead(405);
      return res.end();
    }
    const raw = await readBody(req, 1024 * 1024);
    if (cfg.ig.appSecret) {
      if (!verifySignature(raw, req.headers['x-hub-signature-256'], cfg.ig.appSecret)) {
        console.warn('[webhook] 서명 불일치 — 무시');
        res.writeHead(401);
        return res.end();
      }
    } else if (cfg.prod) {
      console.error('[webhook] IG_APP_SECRET 이 없어 웹훅을 거부합니다');
      res.writeHead(500);
      return res.end();
    }
    // Meta 는 빠른 200 을 원함 → 먼저 응답하고 처리
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EVENT_RECEIVED');
    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    if (cfg.ig.debug) console.log('[webhook]', JSON.stringify(body));
    for (const dm of messagesFromWebhook(body)) {
      try {
        const out = await processDm(dm, { store, ig, cfg });
        if (out.result !== 'no_code') console.log('[webhook] DM', dm.igsid, out.result, out.code || '');
      } catch (e) {
        console.error('[webhook] 처리 실패', e);
      }
    }
  }

  // ------------------- 정적 파일 -------------------
  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(cfg.publicDir, rel));
    if (!file.startsWith(cfg.publicDir + path.sep)) {
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

  const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'",
  };

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
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname === '/webhook' || url.pathname === '/webhook/instagram') return await webhook(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return res.end();
      }
      return serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'server_error' });
      if (!e.status) console.error(e);
    }
  });
  server.on('close', () => {
    clearInterval(pruneTimer);
    store.flush();
  });
  return { server, store, ig };
}

/** 점수 검증: 서명된 판 토큰 + 걸린 시간 + 판정 개수와 점수의 일관성 */
export function validateScore(body, cfg, now = Date.now()) {
  const run = unsign(body.runToken, cfg.sessionSecret);
  if (!run) return { ok: false, error: 'bad_run' };
  const level = getLevel(body.level);
  if (!level || run.l !== level.id) return { ok: false, error: 'bad_level' };
  const elapsed = (now - run.t) / 1000;
  const playable = levelDuration(level) - COUNT_IN_BARS * barDur(level);
  if (elapsed < playable * cfg.minRunRatio) return { ok: false, error: 'too_fast' };
  if (elapsed > 3 * 3600) return { ok: false, error: 'run_expired' };
  const c = body.counts || {};
  const counts = {};
  for (const k of ['perfect', 'great', 'good', 'miss']) {
    const n = c[k];
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'bad_counts' };
    counts[k] = n;
  }
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total !== noteCount(level)) return { ok: false, error: 'bad_counts' };
  // 헛침(노트 없는 곳 누름): 예전 클라이언트는 안 보내므로 없으면 0
  const w = c.wrong === undefined ? 0 : c.wrong;
  if (!Number.isInteger(w) || w < 0 || w > 10000) return { ok: false, error: 'bad_counts' };
  counts.wrong = w;
  const score = body.score;
  if (!Number.isInteger(score) || score < 0 || score > maxScore(level)) return { ok: false, error: 'bad_score' };
  const b = scoreBounds(counts);
  if (score < b.min || score > b.max) return { ok: false, error: 'bad_score' };
  const hits = total - counts.miss;
  const maxCombo = Number.isInteger(body.maxCombo) ? Math.min(Math.max(0, body.maxCombo), hits) : 0;
  return { ok: true, level, score, counts, grade: gradeFor(counts), maxCombo, nonce: run.n };
}
