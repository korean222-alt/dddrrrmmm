// /api + /webhook 처리 (fetch 방식: Request → Response)
// Node 서버(server/app.js)와 Cloudflare Worker(worker/index.js)가 같이 씁니다.
// 저장소(store)는 메서드가 값이나 Promise 를 돌려줘도 되게 전부 await 로 부름
//   - Node: JsonStore (파일 하나) / Cloudflare: D1Store (SQLite)

import { generateCode, displayCode, isCode } from './codes.js';
import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { messagesFromWebhook, processDm } from './verify.js';
import { verifySignature } from './instagram.js';
import { getLevel, isGated, levelDuration, noteCount, maxScore, scoreBounds, gradeFor, COUNT_IN_BARS, barDur } from '../public/js/charts.js';

const PLAYER_COOKIE = 'kk_player';
const SID_COOKIE = 'kk_sid';
const PLAYER_MAX_AGE = 180 * 24 * 3600;

/** 아주 단순한 IP별 요청 제한 (서버/워커 인스턴스 안에서만) */
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

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {object} cfg  makeConfig() 결과 (sessionSecret 필수)
 * @param {{store, ig}} deps
 * @returns {(request: Request, opts?: {ip?: string, waitUntil?: (p: Promise<any>) => void}) => Promise<Response>}
 */
export function createHandler(cfg, { store, ig }) {
  const limitCodes = rateLimiter(15, 10 * 60 * 1000);
  const limitScores = rateLimiter(60, 10 * 60 * 1000);
  const limitAdmin = rateLimiter(30, 10 * 60 * 1000);

  /** 관리자 비밀번호 확인 (길이 같을 때만 한 글자씩 비교) */
  function isAdmin(request) {
    const t = request.headers.get('x-admin-token') || '';
    const a = cfg.adminToken;
    if (!a || t.length !== a.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ t.charCodeAt(i);
    return d === 0;
  }

  return async function handle(request, { ip = '?', waitUntil } = {}) {
    const url = new URL(request.url);
    const setCookies = [];
    const json = (status, data, extra = {}) => {
      const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
      for (const c of setCookies) h.append('Set-Cookie', c);
      return new Response(JSON.stringify(data), { status, headers: h });
    };
    const text = (status, body = '') => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, url, ip, json, setCookies);
      if (url.pathname === '/webhook' || url.pathname === '/webhook/instagram') return await webhook(request, url, text, waitUntil);
      return text(404, 'not found');
    } catch (e) {
      if (!e.status) console.error(e);
      return json(e.status || 500, { error: e.status ? e.message : 'server_error' });
    }
  };

  async function readJson(request) {
    const raw = await request.text();
    if (raw.length > 64 * 1024) throw new HttpError(413, 'too_large');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'bad_json');
    }
  }

  function cookiesOf(request) {
    return parseCookies(request.headers.get('cookie'));
  }

  async function getPlayer(request) {
    const p = unsign(cookiesOf(request)[PLAYER_COOKIE], cfg.sessionSecret);
    if (!p || !p.igsid) return null;
    const rec = await store.getPlayer(p.igsid);
    return rec ? { igsid: rec.igsid, username: rec.username, followVerifiedAt: rec.followVerifiedAt, guest: !rec.followVerifiedAt } : null;
  }

  function getSid(request, setCookies) {
    let sid = unsign(cookiesOf(request)[SID_COOKIE], cfg.sessionSecret)?.sid;
    if (!sid) {
      sid = newId();
      setCookies.push(cookie(SID_COOKIE, sign({ sid }, cfg.sessionSecret), { secure: cfg.cookieSecure, maxAge: 7 * 24 * 3600 }));
    }
    return sid;
  }

  // ------------------- API -------------------
  async function api(request, url, ip, json, setCookies) {
    const p = url.pathname;
    const m = request.method;

    if (p === '/api/health') return json(200, { ok: true, app: 'okaystra' });

    if (p === '/api/config' && m === 'GET') {
      return json(200, {
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
      const pl = await getPlayer(request);
      if (!pl) return json(200, { verified: false });
      return json(200, { verified: !pl.guest, guest: pl.guest, player: { username: pl.username } });
    }

    if (p === '/api/logout' && m === 'POST') {
      setCookies.push(cookie(PLAYER_COOKIE, '', { maxAge: 0, secure: cfg.cookieSecure }));
      return json(200, { ok: true });
    }

    // 1) 일회용 코드 발급
    if (p === '/api/codes' && m === 'POST') {
      if (!limitCodes(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const purpose = body.purpose === 'ranking' ? 'ranking' : 'unlock';
      const sid = getSid(request, setCookies);
      let code;
      for (let i = 0; i < 20; i++) {
        code = generateCode();
        const ex = await store.getCode(code);
        if (!ex || ex.expiresAt < Date.now()) break;
      }
      const now = Date.now();
      await store.createCode({ code, purpose, sessionId: sid, status: 'pending', createdAt: now, expiresAt: now + cfg.codeTtlMs });
      return json(200, { code, display: displayCode(code, cfg.codePrefix), purpose, expiresAt: now + cfg.codeTtlMs });
    }

    // 랭킹용 닉네임 (인스타 인증 없이 랭킹 참여). 인증된 사람은 그대로
    if (p === '/api/guest' && m === 'POST') {
      if (!limitCodes(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const name = cleanNickname(body.name);
      if (!name) return json(400, { error: 'bad_name' });
      const pl = await getPlayer(request);
      if (pl && !pl.guest) return json(409, { error: 'already_verified' });
      const igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      await store.upsertPlayer(igsid, { username: name });
      if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      return json(200, { verified: false, guest: true, player: { username: name } });
    }

    // 관리자: 승인 기다리는 코드 목록 / 코드 승인 (인스타 앱에서 DM·팔로우를 직접 보고 승인)
    if (p.startsWith('/api/admin/')) {
      if (!limitAdmin(ip) && !isAdmin(request)) return json(429, { error: 'rate_limited' });
      if (!isAdmin(request)) return json(401, { error: 'admin_required' });
      if (p === '/api/admin/codes' && m === 'GET') {
        const rows = await store.listPendingCodes(Date.now(), 100);
        return json(200, { codes: rows.map((r) => ({ code: r.code, display: displayCode(r.code, cfg.codePrefix), purpose: r.purpose, createdAt: r.createdAt, expiresAt: r.expiresAt })) });
      }
      if (p === '/api/admin/approve' && m === 'POST') {
        const body = await readJson(request);
        const code = String(body.code || '').toUpperCase().replace(/[\s]/g, '').replace(/^.*-/, '');
        const username = String(body.username || '').trim().replace(/^@/, '').toLowerCase();
        if (!/^[a-z0-9._]{1,30}$/.test(username)) return json(400, { error: 'bad_username' });
        const rec = isCode(code) ? await store.getCode(code) : null;
        if (!rec) return json(404, { error: 'code_not_found' });
        if (rec.status === 'verified') return json(409, { error: 'already_verified', username: rec.username });
        const now = Date.now();
        if (now > rec.expiresAt) return json(410, { error: 'expired' });
        const igsid = 'm_' + username;
        await store.upsertPlayer(igsid, { username, followVerifiedAt: now });
        await store.updateCode(code, { status: 'verified', igsid, username, verifiedAt: now });
        return json(200, { ok: true, code, username });
      }
      return json(404, { error: 'not_found' });
    }

    // 2) 코드 상태 확인 (발급받은 브라우저만)
    const cm = p.match(/^\/api\/codes\/([^/]+)$/);
    if (cm && m === 'GET') {
      const code = decodeURIComponent(cm[1]).toUpperCase().replace(/^.*-/, '');
      const rec = isCode(code) ? await store.getCode(code) : null;
      const sid = unsign(cookiesOf(request)[SID_COOKIE], cfg.sessionSecret)?.sid;
      if (!rec || rec.sessionId !== sid) return json(404, { status: 'expired' });
      if ((rec.status === 'pending' || rec.status === 'not_following') && Date.now() > rec.expiresAt) {
        await store.updateCode(code, { status: 'expired' });
        rec.status = 'expired';
      }
      if (rec.status === 'verified') {
        // 닉네임(게스트)으로 쌓은 기록은 인증된 아이디로 옮김
        const prev = await getPlayer(request);
        if (prev && prev.guest && prev.igsid !== rec.igsid) await store.moveScores(prev.igsid, rec.igsid);
        const player = await store.getPlayer(rec.igsid);
        const token = sign({ igsid: rec.igsid, v: rec.verifiedAt }, cfg.sessionSecret);
        setCookies.push(cookie(PLAYER_COOKIE, token, { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
        return json(200, { status: 'verified', player: { username: player?.username || rec.username } });
      }
      return json(200, { status: rec.status });
    }

    // 개발용: DM 보낸 척 (FAKE 테스트)
    if (p === '/api/dev/simulate-dm' && m === 'POST') {
      if (!cfg.devSimulate) return json(404, { error: 'not_found' });
      const body = await readJson(request);
      const code = String(body.code || '').toUpperCase().replace(/^.*-/, '');
      const rec = await store.getCode(code);
      const sid = unsign(cookiesOf(request)[SID_COOKIE], cfg.sessionSecret)?.sid;
      if (!rec || rec.sessionId !== sid) return json(404, { error: 'code_not_found' });
      const igsid = String(body.igsid || 'dev_' + sid.replace(/[^A-Za-z0-9]/g, '').slice(0, 10));
      const checkFollow = body.notFollowing
        ? async () => ({ following: false, username: 'dev_tester' })
        : async (id) => {
            const r = await ig.checkFollow(id);
            return { ...r, username: body.username || (r.username?.startsWith('player_') ? 'dev_tester' : r.username) };
          };
      const out = await processDm({ igsid, text: `${cfg.codePrefix}-${code}` }, { store, ig: { ...ig, sendDm: async () => ({}) }, cfg, checkFollow });
      return json(200, { ok: true, ...out });
    }

    // 3) 판 시작 토큰 (점수 위조 방지용 최소 장치)
    if (p === '/api/runs' && m === 'POST') {
      const body = await readJson(request);
      const level = getLevel(body.level);
      if (!level) return json(400, { error: 'bad_level' });
      if (isGated(level, cfg.gateFromLevel) && cfg.gateMode === 'follow' && !(await getPlayer(request))?.followVerifiedAt) return json(403, { error: 'follow_required' });
      const runToken = sign({ l: level.id, t: Date.now(), n: newId() }, cfg.sessionSecret);
      return json(200, { runToken });
    }

    // 4) 점수 등록 (닉네임 또는 인스타 인증 필요)
    if (p === '/api/scores' && m === 'POST') {
      if (!limitScores(ip)) return json(429, { error: 'rate_limited' });
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const body = await readJson(request);
      const v = validateScore(body, cfg);
      if (!v.ok) return json(400, { error: v.error });
      if (!(await store.useRun(v.nonce, Date.now() + 2 * 24 * 3600 * 1000))) return json(409, { error: 'run_used' });
      const out = await store.recordScore(pl.igsid, v.level.id, { score: v.score, grade: v.grade, maxCombo: v.maxCombo });
      const mine = await store.rankOf(v.level.id, pl.igsid);
      return json(200, { ...out, rank: mine ? mine.rank : null });
    }

    if (p === '/api/leaderboard' && m === 'GET') {
      const level = getLevel(url.searchParams.get('level') || 4);
      if (!level) return json(400, { error: 'bad_level' });
      const pl = await getPlayer(request);
      const lb = await store.leaderboard(level.id, 50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, verified: !!r.verified, score: r.score, grade: r.grade, me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? await store.rankOf(level.id, pl.igsid) : null;
      return json(200, { level: level.id, entries, me: mine ? { rank: mine.rank, score: mine.score } : null });
    }

    return json(404, { error: 'not_found' });
  }

  // ------------------- 인스타 웹훅 -------------------
  async function webhook(request, url, text, waitUntil) {
    if (request.method === 'GET') {
      // Meta 웹훅 등록 시 확인 요청
      const q = url.searchParams;
      if (q.get('hub.mode') === 'subscribe' && cfg.ig.verifyToken && q.get('hub.verify_token') === cfg.ig.verifyToken) {
        return text(200, q.get('hub.challenge') || '');
      }
      return text(403);
    }
    if (request.method !== 'POST') return text(405);
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.length > 1024 * 1024) return text(413);
    if (cfg.ig.appSecret) {
      if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), cfg.ig.appSecret)) {
        console.warn('[webhook] 서명 불일치 — 무시');
        return text(401);
      }
    } else if (cfg.prod) {
      console.error('[webhook] IG_APP_SECRET 이 없어 웹훅을 거부합니다');
      return text(500);
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return text(200, 'EVENT_RECEIVED');
    }
    if (cfg.ig.debug) console.log('[webhook]', JSON.stringify(body));
    // 수동 승인 모드: DM 은 운영자가 직접 보고 승인하므로 자동 처리 안 함
    if (cfg.followCheckMode === 'manual') return text(200, 'EVENT_RECEIVED');
    // Meta 는 빠른 200 을 원함 → 응답은 바로, 처리는 뒤에서
    const work = (async () => {
      for (const dm of messagesFromWebhook(body)) {
        try {
          const out = await processDm(dm, { store, ig, cfg });
          if (out.result !== 'no_code') console.log('[webhook] DM', dm.igsid, out.result, out.code || '');
        } catch (e) {
          console.error('[webhook] 처리 실패', e);
        }
      }
    })();
    // 응답 뒤 처리를 맡길 곳이 없으면(Vercel 함수는 응답하면 멈출 수 있음) 끝까지 처리하고 응답 (보통 1~2초)
    if (waitUntil) waitUntil(work);
    else await work;
    return text(200, 'EVENT_RECEIVED');
  }
}

/** 랭킹 닉네임: 앞뒤 공백 빼고 2~12자, 글자·숫자·_ . 공백만 */
export function cleanNickname(v) {
  const s = String(v || '').trim().replace(/\s+/g, ' ');
  if ([...s].length < 2 || [...s].length > 12) return null;
  if (!/^[\p{L}\p{N}_. ]+$/u.test(s)) return null;
  return s;
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
