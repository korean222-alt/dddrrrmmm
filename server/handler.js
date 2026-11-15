// /api 처리 (fetch 방식: Request → Response)
// Node 서버(server/app.js)와 Vercel 함수(api/server.js)가 같이 씁니다.
// 저장소(store)는 메서드가 값이나 Promise 를 돌려줘도 되게 전부 await 로 부름
//   - Node: JsonStore (파일 하나) / Vercel: PgStore (Neon Postgres)

import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { buildStats } from './stats.js';
import { LEVELS, getLevel, levelDuration, noteCount, maxScore, scoreBounds, gradeFor, COUNT_IN_BARS, barDur } from '../public/js/charts.js';

const PLAYER_COOKIE = 'kk_player';
const VID_COOKIE = 'kk_vid'; // 익명 방문자 번호 (이용 통계용, 1년)
const VID_MAX_AGE = 365 * 24 * 3600;
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
 * @param {{store}} deps
 * @returns {(request: Request, opts?: {ip?: string}) => Promise<Response>}
 */
export function createHandler(cfg, { store }) {
  const limitGuest = rateLimiter(15, 10 * 60 * 1000);
  const limitScores = rateLimiter(60, 10 * 60 * 1000);
  const limitAdmin = rateLimiter(30, 10 * 60 * 1000);
  const limitTrack = rateLimiter(200, 10 * 60 * 1000);

  /** 관리자 비밀번호 확인 (길이 같을 때만 한 글자씩 비교) */
  function isAdmin(request) {
    const t = request.headers.get('x-admin-token') || '';
    const a = cfg.adminToken;
    if (!a || t.length !== a.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ t.charCodeAt(i);
    return d === 0;
  }

  return async function handle(request, { ip = '?' } = {}) {
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
    return rec && rec.username ? { igsid: rec.igsid, username: rec.username } : null;
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
        siteUrl: cfg.siteUrl,
      });
    }

    // 랭킹 닉네임이 있으면 guest:true (인스타 아이디 인증은 없어짐)
    if (p === '/api/me' && m === 'GET') {
      const pl = await getPlayer(request);
      if (!pl) return json(200, { verified: false });
      return json(200, { verified: false, guest: true, player: { username: pl.username } });
    }

    if (p === '/api/logout' && m === 'POST') {
      setCookies.push(cookie(PLAYER_COOKIE, '', { maxAge: 0, secure: cfg.cookieSecure }));
      return json(200, { ok: true });
    }

    // 랭킹용 닉네임. 이미 있으면 새 이름으로 바꿈 (기록은 그대로)
    if (p === '/api/guest' && m === 'POST') {
      if (!limitGuest(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const name = cleanNickname(body.name);
      if (!name) return json(400, { error: 'bad_name' });
      const pl = await getPlayer(request);
      const igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      await store.upsertPlayer(igsid, { username: name });
      if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      return json(200, { verified: false, guest: true, player: { username: name } });
    }

    // 이용 통계 (익명): 접속 시간 + 곡 시작/끝. 이름·아이디·IP 는 저장하지 않음
    if (p === '/api/track' && m === 'POST') {
      if (!limitTrack(ip)) return json(429, { error: 'rate_limited' });
      const t = cleanTrack(await readJson(request));
      if (!t) return json(400, { error: 'bad_track' });
      let vid = cookiesOf(request)[VID_COOKIE];
      if (!/^[A-Za-z0-9_-]{16,32}$/.test(vid || '')) {
        vid = newId();
        setCookies.push(cookie(VID_COOKIE, vid, { maxAge: VID_MAX_AGE, secure: cfg.cookieSecure }));
      }
      const now = Date.now();
      await store.trackSession({ sid: t.sid, vid, now, activeSec: t.activeSec, ref: t.ref, device: t.device });
      for (const e of t.plays) {
        await store.trackPlay(
          e.ev === 'start'
            ? { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now }
            : { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now - e.sec * 1000, endedAt: now, result: e.result, score: e.score, stars: e.stars, sec: e.sec }
        );
      }
      return json(200, { ok: true });
    }

    // 관리자 (비밀번호 필요)
    if (p.startsWith('/api/admin/')) {
      if (!limitAdmin(ip) && !isAdmin(request)) return json(429, { error: 'rate_limited' });
      if (!isAdmin(request)) return json(401, { error: 'admin_required' });
      // 이용 통계: ?days=7 (1~90). 오늘 포함 최근 N일
      if (p === '/api/admin/stats' && m === 'GET') {
        const days = Math.min(90, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 7));
        const tzMin = cfg.statsTzMin;
        const now = Date.now();
        // 시간대 기준 오늘 0시부터 (days-1)일 전 ~ 지금
        const dayMs = 24 * 3600 * 1000;
        const todayStart = Math.floor((now + tzMin * 60000) / dayMs) * dayMs - tzMin * 60000;
        const from = todayStart - (days - 1) * dayMs;
        return json(200, { days, ...buildStats(await store.statsRaw(from, now + 1), { from, to: now, tzMin }) });
      }
      return json(404, { error: 'not_found' });
    }

    // 3) 판 시작 토큰 (점수 위조 방지용 최소 장치)
    if (p === '/api/runs' && m === 'POST') {
      const body = await readJson(request);
      const level = getLevel(body.level);
      if (!level) return json(400, { error: 'bad_level' });
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

    if (p === '/api/leaderboard' && m === 'GET' && url.searchParams.get('level') === 'total') {
      const pl = await getPlayer(request);
      const lb = await store.totalLeaderboard(50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, score: r.score, levels: r.levels, me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? await store.totalRankOf(pl.igsid) : null;
      return json(200, { level: 'total', levels: LEVELS.length, entries, me: mine });
    }

    if (p === '/api/leaderboard' && m === 'GET') {
      const level = getLevel(url.searchParams.get('level') || 4);
      if (!level) return json(400, { error: 'bad_level' });
      const pl = await getPlayer(request);
      const lb = await store.leaderboard(level.id, 50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, score: r.score, grade: r.grade, me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? await store.rankOf(level.id, pl.igsid) : null;
      return json(200, { level: level.id, entries, me: mine ? { rank: mine.rank, score: mine.score } : null });
    }

    return json(404, { error: 'not_found' });
  }
}

/** 통계 전송 내용 검증: 이상한 값은 버리고 크기를 제한 */
export function cleanTrack(b) {
  if (!b || typeof b !== 'object') return null;
  const idOf = (v, max = 40) => (typeof v === 'string' && v.length >= 8 && v.length <= max && /^[\w-]+$/.test(v) ? v : null);
  const int = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
  const sid = idOf(b.sid);
  if (!sid) return null;
  const plays = [];
  for (const e of (Array.isArray(b.plays) ? b.plays : []).slice(0, 10)) {
    if (!e || typeof e !== 'object') continue;
    const id = idOf(e.id);
    const level = typeof e.level === 'number' || typeof e.level === 'string' ? String(e.level) : '';
    if (!id || !/^[\w-]{1,20}$/.test(level)) continue;
    const out = { id, level, mode: e.mode === 'vs' ? 'vs' : 'normal', ev: e.ev === 'end' ? 'end' : 'start' };
    if (out.ev === 'end') {
      out.result = ['clear', 'fail', 'quit'].includes(e.result) ? e.result : 'quit';
      out.score = Number.isFinite(e.score) ? int(e.score, 10_000_000) : null;
      out.stars = Number.isFinite(e.stars) ? int(e.stars, 3) : null;
      out.sec = int(e.sec, 6 * 3600);
    }
    plays.push(out);
  }
  return {
    sid,
    activeSec: int(b.active, 24 * 3600),
    // 어디서 왔나 (utm_source 나 이전 페이지의 도메인). 개인 정보가 섞이지 않게 글자 종류·길이 제한
    ref: typeof b.ref === 'string' ? b.ref.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) : '',
    device: ['mobile', 'desktop', 'inapp'].includes(b.device) ? b.device : 'unknown',
    plays,
  };
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
