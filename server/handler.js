// /api 처리 (fetch 방식: Request → Response)
// Node 서버(server/app.js)와 Vercel 함수(api/server.js)가 같이 씁니다.
// 저장소(store)는 메서드가 값이나 Promise 를 돌려줘도 되게 전부 await 로 부름
//   - Node: JsonStore (파일 하나) / Vercel: PgStore (Neon Postgres)

import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { buildStats } from './stats.js';
import { LEVELS, getLevel, levelDuration, noteCount, maxScore, scoreBounds, gradeFor, COUNT_IN_BARS, barDur, ENDLESS_ID, ROUND_BARS, roundBpm, pointsFor, levelEndlessBase, LEVEL_ENDLESS_STEP, needsVerify, isClosed } from '../public/js/charts.js';

// 무제한 모드 랭킹은 저장소의 level 칸에 '깬 단계 × 1,000,000,000 + 점수' 한 숫자로 저장 (단계가 먼저, 같으면 점수)
//   (예전엔 × 1,000,000 이라 점수가 999,999 에서 잘렸음 → 저장소 init 때 새 방식으로 옮김)
//   그리그 무제한('endless') = level 0, 단계별 무제한('e5') = level -5. 총 등수는 level > 0 만 더함
export const ENDLESS_LEVEL = 0;
/**
 * 무제한 판 id → { id, slot(저장소 level 칸), bpmOf(단계), notes(단계당 최대 노트 수) } (무제한이 아니면 null)
 */
export function endlessMode(id) {
  if (id === ENDLESS_ID) return { id, slot: ENDLESS_LEVEL, bpmOf: roundBpm, notes: 100 };
  const base = levelEndlessBase(id);
  if (!base) return null;
  // 단계별 무제한: 원래 곡 4마디(최대 4×16칸 × 동시치기 2개)를 되풀이, 4마디마다 BPM +LEVEL_ENDLESS_STEP
  return { id: `e${base.id}`, slot: -base.id, bpmOf: (r) => base.bpm + LEVEL_ENDLESS_STEP * (r - 1), notes: 130 };
}
export const ENDLESS_MULT = 1_000_000_000;
export const endlessKey = (rounds, score) => rounds * ENDLESS_MULT + Math.min(score, ENDLESS_MULT - 1);
export const endlessParts = (v) => ({ rounds: Math.floor(v / ENDLESS_MULT), score: v % ENDLESS_MULT });

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

export const HIDE_KEEP_MS = 5 * 24 * 3600 * 1000;

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
  const limitPass = rateLimiter(10, 10 * 60 * 1000); // 팔로워 암호 시도: IP 당 10분에 10번

  /** 지금 팔로워 암호: 관리자 화면에서 정한 값 → 없으면 환경변수 FOLLOW_PASSWORD. 둘 다 없으면 '' (암호 인증 꺼짐) */
  async function followPassword() {
    const s = await store.getSetting('followPassword');
    return s || cfg.followPassword || '';
  }

  /** 관리자 비밀번호 확인 (길이 같을 때만 한 글자씩 비교) */
  function isAdmin(request) {
    const t = request.headers.get('x-admin-token') || '';
    const a = cfg.adminToken;
    if (!a || t.length !== a.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ t.charCodeAt(i);
    return d === 0;
  }

  // 랭킹에서 내린 지 5일 지난 참여자 지우기: 접속(/api/me) 때 인스턴스마다 10분에 한 번만
  let lastPurge = 0;
  async function purgeMaybe() {
    const now = Date.now();
    if (now - lastPurge < 10 * 60 * 1000) return;
    lastPurge = now;
    try {
      await store.purgeHidden(now);
    } catch (e) {
      console.error('[purge]', e);
    }
  }

  /** 팔로워 인증 = 인스타 아이디를 적어 신청했고(운영자 확인 전이어도 바로 열림), 랭킹에서 내려가 있지 않음 */
  const isVerified = (pl) => !!(pl && pl.ig && !pl.hiddenAt);
  /** 운영자가 팔로우를 직접 확인함('확인함') → 13·14단계 · 단계별 무제한까지 열림 */
  const isConfirmed = (pl) => isVerified(pl) && !!pl.checkedAt;
  /** /api/me · /api/guest 응답 */
  const meOf = (pl) => ({
    verified: false, guest: true, needsIg: !pl.ig, checked: isVerified(pl), confirmed: isConfirmed(pl),
    hidden: pl.hiddenAt ? { deleteAt: pl.hiddenAt + HIDE_KEEP_MS } : null,
    player: { username: pl.username, ig: pl.ig },
  });

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
    return rec && rec.username ? { igsid: rec.igsid, username: rec.username, ig: rec.ig || null, hiddenAt: rec.hiddenAt || null, checkedAt: rec.checkedAt || null } : null;
  }

  // ------------------- API -------------------
  async function api(request, url, ip, json, setCookies) {
    const p = url.pathname;
    const m = request.method;

    if (p === '/api/health') return json(200, { ok: true, app: 'okaystra' });

    if (p === '/api/config' && m === 'GET') {
      return json(200, {
        gateMode: cfg.gateMode,
        instagramHandle: cfg.instagramHandle,
        siteUrl: cfg.siteUrl,
      });
    }

    // 랭킹 닉네임이 있으면 guest:true (인스타 아이디 인증은 없어짐)
    if (p === '/api/me' && m === 'GET') {
      const pl = await getPlayer(request);
      if (!pl) return json(200, { verified: false });
      await purgeMaybe();
      // hidden: 운영자가 팔로우 확인이 안 돼서 랭킹에서 내림 → 화면에 알리고 아이디를 다시 받음. deleteAt 에 지워짐
      // checked: 인증 신청함(아이디 적음) → 9·12단계 · 그리그 무제한이 열림
      // confirmed: 운영자가 팔로우를 확인함(인증 완료) → 13·14단계 · 단계별 무제한까지 열림
      return json(200, meOf(pl));
    }

    if (p === '/api/logout' && m === 'POST') {
      setCookies.push(cookie(PLAYER_COOKIE, '', { maxAge: 0, secure: cfg.cookieSecure }));
      return json(200, { ok: true });
    }

    // 랭킹용 닉네임 + 인스타 아이디. 이미 있으면 새 이름/아이디로 바꿈 (기록은 그대로)
    //   인스타 아이디는 운영자가 팔로우했는지 직접 확인하는 데만 쓰고, 랭킹에는 안 보임.
    //   (처음 만드는 사람은 꼭 필요. 예전에 아이디 없이 참여한 사람은 한 번 채워 넣으면 됨)
    if (p === '/api/guest' && m === 'POST') {
      if (!limitGuest(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const name = cleanNickname(body.name);
      if (!name) return json(400, { error: 'bad_name' });
      const pl = await getPlayer(request);
      const ig = cleanInstagram(body.ig);
      if (!ig && !(pl && pl.ig)) return json(400, { error: 'bad_ig' });
      const igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      const rec = await store.upsertPlayer(igsid, { username: name, ig });
      if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      return json(200, meOf({ username: name, ig: (rec && rec.ig) || ig, checkedAt: rec && rec.checkedAt, hiddenAt: rec && rec.hiddenAt }));
    }

    // 팔로워 암호로 인증: 키티챗이 팔로워에게만 DM 으로 준 암호를 적으면 바로 '인증 완료'(운영자 확인과 같음)
    //   처음 온 사람은 닉네임 + 인스타 아이디도 같이. 암호가 틀리면 아무것도 저장 안 함
    if (p === '/api/verify/password' && m === 'POST') {
      if (!limitPass(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const pw = await followPassword();
      if (!pw) return json(503, { error: 'password_off' });
      const pl = await getPlayer(request);
      const name = body.name === undefined || body.name === '' ? null : cleanNickname(body.name);
      if (body.name && !name) return json(400, { error: 'bad_name' });
      if (!pl && !name) return json(400, { error: 'bad_name' });
      const ig = body.ig ? cleanInstagram(body.ig) : null;
      if (body.ig && !ig) return json(400, { error: 'bad_ig' });
      if (!ig && !(pl && pl.ig)) return json(400, { error: 'bad_ig' });
      if (!samePassword(body.password, pw)) return json(403, { error: 'wrong_password' });
      const igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      await store.upsertPlayer(igsid, { username: name || pl.username, ig });
      if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      await store.setChecked(igsid, true);
      const rec = await store.getPlayer(igsid);
      return json(200, meOf({ username: rec.username, ig: rec.ig, checkedAt: rec.checkedAt, hiddenAt: rec.hiddenAt }));
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
      if (!isAdmin(request) && !limitAdmin(ip)) return json(429, { error: 'rate_limited' });
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
      // 랭킹 참여자 (인스타 아이디로 팔로우 확인 → 안 했으면 삭제)
      if (p === '/api/admin/players' && m === 'GET') {
        await store.purgeHidden();
        return json(200, { players: await store.listPlayers(), keepDays: HIDE_KEEP_MS / 86400000 });
      }
      // 랭킹에서 내리기 (5일 뒤 자동 삭제, 그 사이 다시 들어와 아이디를 넣으면 돌아옴) / 되돌리기
      if (p === '/api/admin/players/hide' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.igsid !== 'string' || !b.igsid) return json(400, { error: 'bad_igsid' });
        return json(200, { ok: await store.setHidden(b.igsid, b.hidden !== false) });
      }
      if (p === '/api/admin/players/delete' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.igsid !== 'string' || !b.igsid) return json(400, { error: 'bad_igsid' });
        return json(200, { ok: await store.deletePlayer(b.igsid) });
      }
      if (p === '/api/admin/players/check' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.igsid !== 'string' || !b.igsid) return json(400, { error: 'bad_igsid' });
        return json(200, { ok: await store.setChecked(b.igsid, b.checked !== false) });
      }
      // 팔로워 암호 보기 / 바꾸기 (주 1회 교체 → 키티챗 DM 문구도 같이 바꾸기). 빈 값이면 환경변수 값으로 돌아감
      if (p === '/api/admin/follow-password' && m === 'GET') {
        const s = await store.getSetting('followPassword');
        return json(200, { password: s || cfg.followPassword || '', source: s ? 'admin' : cfg.followPassword ? 'env' : 'none' });
      }
      if (p === '/api/admin/follow-password' && m === 'POST') {
        const b = await readJson(request);
        const v = String(b.password ?? '').trim();
        if (v && ([...v].length < 2 || [...v].length > 40)) return json(400, { error: 'bad_password' });
        await store.setSetting('followPassword', v);
        return json(200, { ok: true, password: v || cfg.followPassword || '' });
      }
      return json(404, { error: 'not_found' });
    }

    // 3) 판 시작 토큰 (점수 위조 방지용 최소 장치)
    if (p === '/api/runs' && m === 'POST') {
      const body = await readJson(request);
      const level = endlessMode(body.level) || getLevel(body.level);
      if (!level) return json(400, { error: 'bad_level' });
      // 9·12단계 · 그리그 무제한은 인증 신청한 사람 / 13·14단계 · 단계별 무제한은 운영자가 팔로우를 확인한(인증 완료) 사람만
      // (GATE_MODE=open 이면 잠금 없음, 개발용)
      if (cfg.gateMode !== 'open' && (isClosed(level.id) || needsVerify(level.id))) {
        const pl = await getPlayer(request);
        if (isClosed(level.id) && !isConfirmed(pl)) return json(403, { error: isVerified(pl) ? 'confirm_pending' : 'confirm_required' });
        if (needsVerify(level.id) && !isVerified(pl)) return json(403, { error: 'verify_required' });
      }
      const runToken = sign({ l: level.id, t: Date.now(), n: newId() }, cfg.sessionSecret);
      return json(200, { runToken });
    }

    // 4) 점수 등록 (닉네임 또는 인스타 인증 필요)
    if (p === '/api/scores' && m === 'POST') {
      if (!limitScores(ip)) return json(429, { error: 'rate_limited' });
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const body = await readJson(request);
      const em = endlessMode(body.level);
      if (em) {
        const e = validateEndless(body, cfg);
        if (!e.ok) return json(400, { error: e.error });
        if (!(await store.useRun(e.nonce, Date.now() + 2 * 24 * 3600 * 1000))) return json(409, { error: 'run_used' });
        const out = await store.recordScore(pl.igsid, em.slot, { score: endlessKey(e.rounds, e.score), grade: null, maxCombo: 0 });
        const mine = await store.rankOf(em.slot, pl.igsid);
        const best = endlessParts(out.best);
        return json(200, { improved: out.improved, best: best.score, rounds: best.rounds, rank: mine ? mine.rank : null });
      }
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

    const lbEndless = p === '/api/leaderboard' && m === 'GET' ? endlessMode(url.searchParams.get('level')) : null;
    if (lbEndless) {
      const pl = await getPlayer(request);
      const lb = await store.leaderboard(lbEndless.slot, 50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, ...endlessParts(r.score), me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? await store.rankOf(lbEndless.slot, pl.igsid) : null;
      return json(200, { level: lbEndless.id, entries, me: mine ? { rank: mine.rank, ...endlessParts(mine.score) } : null });
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

/** 팔로워 암호 비교: 띄어쓰기·대소문자 무시 (한글 자모 조합 차이도 맞춤) */
export function samePassword(input, pw) {
  const n = (v) => String(v ?? '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
  const a = n(input);
  const b = n(pw);
  if (!b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < b.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * 인스타 아이디: @ 나 주소(instagram.com/아이디)로 써도 아이디만 뽑아냄. 영문·숫자·_ . 30자까지. 이상하면 null
 */
export function cleanInstagram(v) {
  let s = String(v || '').trim().toLowerCase();
  const m = s.match(/instagram\.com\/([^/?#\s]+)/);
  if (m) s = m[1];
  s = s.replace(/^@+/, '');
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/** 무제한 모드 점수 검증: 서명된 판 토큰 + 그 단계까지 치려면 걸리는 최소 시간 + 점수 상한 */
export function validateEndless(body, cfg, now = Date.now()) {
  const run = unsign(body.runToken, cfg.sessionSecret);
  const em = endlessMode(body.level);
  // 판 토큰은 같은 무제한(그리그 / 같은 단계)용이어야 함
  if (!run || !em || run.l !== em.id) return { ok: false, error: 'bad_run' };
  const rounds = body.rounds;
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 200) return { ok: false, error: 'bad_rounds' };
  const elapsed = (now - run.t) / 1000;
  if (elapsed > 6 * 3600) return { ok: false, error: 'run_expired' };
  // 단계 하나 = ROUND_BARS 마디 × 4박. 깬 단계 전부를 치는 데 걸리는 최소 시간
  let minSec = 0;
  for (let r = 1; r <= rounds; r++) minSec += (ROUND_BARS * 4 * 60) / em.bpmOf(r);
  if (elapsed < minSec * cfg.minRunRatio) return { ok: false, error: 'too_fast' };
  // 점수 상한: 단계마다 노트 em.notes 개를 전부 PERFECT + 최대 콤보, 빠른 단계 점수 배율(1 + 0.1 × (단계-1))까지
  const score = body.score;
  let max = 0;
  for (let r = 1; r <= rounds + 1; r++) max += em.notes * pointsFor('perfect', 100) * (1 + 0.1 * (r - 1));
  if (!Number.isInteger(score) || score < 0 || score > max) return { ok: false, error: 'bad_score' };
  return { ok: true, rounds, score, nonce: run.n };
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
