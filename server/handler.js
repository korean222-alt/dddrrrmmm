// /api 처리 (fetch 방식: Request → Response)
// Node 서버(server/app.js)와 Vercel 함수(api/server.js)가 같이 씁니다.
// 저장소(store)는 메서드가 값이나 Promise 를 돌려줘도 되게 전부 await 로 부름
//   - Node: JsonStore (파일 하나) / Vercel: PgStore (Neon Postgres)

import crypto from 'node:crypto';
import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { buildStats } from './stats.js';
import { findSuspects, suspectReport } from './suspect.js';
import { createRoomHandler } from './rooms.js';
import { createRankedHandler } from './ranked.js';
import { cleanMap, mapDifficulty, mapLevel } from '../public/js/usermap.js';
import { seasonAt, endedSeasons, HALL_BOARDS, cleanHallImage } from '../public/js/season.js';
import { LEVELS, LAST_LEVEL_ID, getLevel, levelDuration, noteCount, maxScore, scoreBounds, gradeFor, COUNT_IN_BARS, barDur, ENDLESS_ID, ROUND_BARS, roundBpm, pointsFor, levelEndlessBase, LEVEL_ENDLESS_STEP, needsVerify, isClosed, diamondsFor } from '../public/js/charts.js';

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

/**
 * 랭킹 기록(scores) → 화면의 '내 기록'(bests) 모양. 기록 되찾기 때 깬 단계를 다시 열어 주려고.
 *   별은 DB 에 없어서 등급으로 어림: SS·풀콤보 S → 3개, S·A·B → 2개, 그 밑 → 1개 (끝까지 친 판만 랭킹에 오름)
 */
export function bestsFromScores(rows) {
  const out = {};
  for (const r of rows || []) {
    if (r.level > 0) {
      const lv = getLevel(r.level);
      if (!lv) continue;
      const full = r.maxCombo > 0 && r.maxCombo >= noteCount(lv);
      const stars = r.grade === 'SS' || (r.grade === 'S' && full) ? 3 : ['S', 'A', 'B'].includes(r.grade) ? 2 : 1;
      out[r.level] = { score: r.score, grade: r.grade || 'C', stars, maxCombo: r.maxCombo, fullCombo: full, at: 0 };
    } else {
      const { rounds, score } = endlessParts(r.score);
      const id = r.level === 0 ? ENDLESS_ID : `e${-r.level}`;
      out[id] = { score, grade: 'C', stars: 0, diamonds: diamondsFor(rounds), roundsCleared: rounds, at: 0 };
    }
  }
  return out;
}

/**
 * 인스타 아이디가 '거의 같은지' (기록 되찾기에서 예전에 대충 적은 아이디 봐주기).
 *   영문·숫자만 남기고 소문자로 비교 → 같거나, 한쪽이 다른 쪽을 품거나(4자 이상), 오타 1개(5자 이상)·2개(8자 이상)까지
 */
export function igSimilar(a, b) {
  const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = n(a);
  const y = n(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))) return true;
  // 짧은 아이디(5자 미만)는 똑같아야 함
  const max = Math.min(x.length, y.length) < 5 ? 0 : Math.max(x.length, y.length) >= 8 ? 2 : 1;
  if (Math.abs(x.length - y.length) > max) return false;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length] <= max;
}

const PLAYER_COOKIE = 'kk_player';
const TRANSFER_TTL_MS = 10 * 60 * 1000;
/**
 * 기기 옮기기로 넘길 것만 골라 정리: 단계별 기록(bests) + 닉네임들 + 설정 일부.
 *   싱크 보정(offsetMs)은 폰마다 달라서 안 넘김. 이상하거나 너무 크면 null
 */
export function cleanTransferData(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  if (d.bests && typeof d.bests === 'object' && !Array.isArray(d.bests)) {
    const bests = {};
    for (const [k, v] of Object.entries(d.bests).slice(0, 200)) {
      if (!/^[A-Za-z0-9_-]{1,12}$/.test(k) || !v || typeof v !== 'object') continue;
      const e = {};
      for (const f of ['score', 'stars', 'accuracy', 'maxCombo', 'diamonds', 'roundsCleared', 'at']) if (Number.isFinite(v[f])) e[f] = v[f];
      if (typeof v.grade === 'string') e.grade = v.grade.slice(0, 3);
      if (typeof v.fullCombo === 'boolean') e.fullCombo = v.fullCombo;
      bests[k] = e;
    }
    out.bests = bests;
  }
  for (const f of ['nick', 'lastNick', 'lastIg']) if (typeof d[f] === 'string') out[f] = d[f].slice(0, 40);
  if (d.settings && typeof d.settings === 'object') {
    const s = {};
    for (const f of ['music', 'sfx']) if (Number.isFinite(d.settings[f])) s[f] = Math.min(1, Math.max(0, d.settings[f]));
    for (const f of ['vibrate', 'lite']) if (typeof d.settings[f] === 'boolean') s[f] = d.settings[f];
    if (d.settings.band === 'orch' || d.settings.band === 'piano') s.band = d.settings.band;
    out.settings = s;
  }
  // 같은 폰이 주소만 옮길 때(옛 주소 → 새 주소 다리)만 싱크 보정도 같이 (다른 폰이면 안 맞아서 안 보냄)
  if (d.calib && typeof d.calib === 'object' && Number.isFinite(d.calib.offsetMs)) {
    out.calib = { offsetMs: Math.max(-300, Math.min(300, Math.round(d.calib.offsetMs))), calibrated: !!d.calib.calibrated };
  }
  return JSON.stringify(out).length <= 32 * 1024 ? out : null;
}
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
  const limitSuggest = rateLimiter(6, 10 * 60 * 1000);
  // 대결 방: 2초마다 주고받으니 넉넉히 (방 만들기는 따로 적게)
  const limitRoom = rateLimiter(900, 10 * 60 * 1000);
  const limitRoomCreate = rateLimiter(15, 10 * 60 * 1000);
  // 기기 옮기기: 코드 만들기는 넉넉히, 코드 넣기(맞히기)는 적게
  const limitTransferMake = rateLimiter(10, 10 * 60 * 1000);
  const limitTransferTake = rateLimiter(10, 10 * 60 * 1000);
  const limitRecoverReq = rateLimiter(5, 10 * 60 * 1000);
  const limitRecoverCheck = rateLimiter(60, 10 * 60 * 1000);
  // 🌍 유저 맵: 목록·받기·좋아요 (올리기는 하루 개수로 따로 막음)
  const limitMaps = rateLimiter(150, 10 * 60 * 1000);
  const limitHallPhoto = rateLimiter(10, 10 * 60 * 1000);
  // 팔로워 암호: 틀린 시도만 셈. IP 당 10분에 10번 틀리면 잠깐 막음
  const passFails = new Map();
  const passBlocked = (ip) => {
    const h = passFails.get(ip);
    return !!h && Date.now() < h.reset && h.n >= 10;
  };
  const passFail = (ip) => {
    const now = Date.now();
    let h = passFails.get(ip);
    if (!h || now > h.reset) h = { n: 0, reset: now + 10 * 60 * 1000 };
    h.n++;
    passFails.set(ip, h);
    if (passFails.size > 5000) for (const [k, v] of passFails) if (now > v.reset) passFails.delete(k);
  };

  /** 지금 팔로워 암호: 관리자 화면에서 정한 값 → 없으면 환경변수 FOLLOW_PASSWORD. 둘 다 없으면 '' (암호 인증 꺼짐) */
  async function followPassword() {
    const s = await store.getSetting('followPassword');
    return s || cfg.followPassword || '';
  }

  // 🆓 암호 없이 '임시 인증' (2026-11-19 인스타 DM 7일 금지 → 팔로워 암호를 못 보냄)
  //   기간(freePassUntil) 안에는 닉네임 + 인스타 아이디만으로 인증. 임시 인증은 checked_at 을 음수(-시각)로 저장
  //   기간이 끝나면 접속 때 음수인 사람만 인증이 풀림 → 팔로워 암호로 다시 인증. 관리자 화면에서 끝을 바꿀 수 있음
  //   설정은 인스턴스마다 1분 캐시 (DB 왕복 줄이기)
  let fpCache = { at: 0, until: 0 };
  async function freePassUntil(fresh = false) {
    const now = Date.now();
    if (fresh || now - fpCache.at > 60 * 1000) {
      const s = await store.getSetting('freePassUntil');
      fpCache = { at: now, until: s === null ? cfg.freePassUntil : Number(s) || 0 };
    }
    return fpCache.until;
  }
  const freePassOn = async () => Date.now() < (await freePassUntil());
  /** 기간이 끝났으면 임시 인증 풀기 (한 번 풀고 나면 설정을 0 으로 → 다음부턴 안 돎) */
  async function expireTempMaybe() {
    const until = await freePassUntil();
    if (!until || Date.now() < until) return;
    try {
      await store.expireTempChecks();
      await store.setSetting('freePassUntil', '0');
      fpCache = { at: Date.now(), until: 0 };
    } catch (e) {
      console.error('[free-pass]', e);
    }
  }

  // 🏛 끝난 시즌의 1·2·3등을 명예의 전당에 넣기: 시즌이 끝난 뒤 처음 오는 점수 등록·명예의 전당 요청 때 한 번
  //   (점수 등록보다 먼저 해야 끝난 시즌 기록이 새 점수로 덮이지 않음). 인스턴스마다 한 번 확인하면 기억
  const hallDone = new Set();
  async function ensureHall(now = Date.now()) {
    for (const n of endedSeasons(now)) {
      if (hallDone.has(n)) continue;
      const flag = `hall:done:${n}`;
      if (!(await store.getSetting(flag))) {
        for (const board of HALL_BOARDS) {
          const top = await store.seasonBoard(n, board, 3);
          await store.hallInsert(top.rows.map((r) => ({ ...r, season: n, board })));
        }
        await store.setSetting(flag, String(now));
      }
      hallDone.add(n);
    }
  }
  const hallEntry = (r, pl) => ({ rank: r.rank, username: r.username, score: r.score, n: r.n, rounds: r.rounds, me: pl ? r.igsid === pl.igsid : false });

  /** 관리자 비밀번호 확인 (길이 같을 때만 한 글자씩 비교) */
  function isAdmin(request) {
    return sameToken(request.headers.get('x-admin-token') || '', cfg.adminToken);
  }
  function sameToken(t, a) {
    if (!a || t.length !== a.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ t.charCodeAt(i);
    return d === 0;
  }

  // 랭킹에서 내린 지 5일 지난 참여자 지우기: 접속(/api/me) 때 인스턴스마다 10분에 한 번만
  let lastPurge = 0;
  async function purgeMaybe() {
    const now = Date.now();
    // Cloudflare 는 인스턴스가 자주 새로 떠서 거의 매번 돌게 됨 → 접속 20번 중 1번꼴로만 (급하지 않음, admin 에서도 지움)
    if (now - lastPurge < 10 * 60 * 1000 || Math.random() > 0.05) return;
    lastPurge = now;
    try {
      await store.purgeHidden(now);
      if (store.cleanup) await store.cleanup(now);
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
    verified: false, guest: true, needsIg: !pl.ig, checked: isVerified(pl), confirmed: isConfirmed(pl), temp: isConfirmed(pl) && pl.checkedAt < 0,
    hidden: pl.hiddenAt ? { deleteAt: pl.hiddenAt + HIDE_KEEP_MS } : null,
    player: { username: pl.username, ig: pl.ig },
  });

  // 대결 방: 4단계부터는 혼자 칠 때와 같은 잠금 (팔로워 인증 완료한 사람만)
  const ranked = createRankedHandler({ store, getPlayer: (request) => getPlayer(request), isConfirmed: (pl) => !!pl && (cfg.gateMode === 'open' || isConfirmed(pl)) });
  const handleRoom = createRoomHandler({
    store,
    ranked,
    getPlayer: (request) => getPlayer(request),
    isConfirmed: (pl) => cfg.gateMode === 'open' || isConfirmed(pl),
    canPlay: async (levelId, pl) => (cfg.gateMode !== 'open' && isClosed(levelId) && !isConfirmed(pl) ? (isVerified(pl) ? 'confirm_pending' : 'confirm_required') : null),
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
  /** 이용 통계 저장 (/api/track, 또는 /api/runs·/api/scores 에 얹혀 온 것). 형식이 틀리면 false */
  async function saveTrack(request, raw, setCookies) {
    const t = cleanTrack(raw);
    if (!t) return false;
    let vid = cookiesOf(request)[VID_COOKIE];
    if (!/^[A-Za-z0-9_-]{16,32}$/.test(vid || '')) {
      vid = newId();
      setCookies.push(cookie(VID_COOKIE, vid, { maxAge: VID_MAX_AGE, secure: cfg.cookieSecure }));
    }
    const now = Date.now();
    // 접속 + 판들을 동시에 (판은 한 문장으로 묶음)
    const plays = t.plays.map((e) =>
      e.ev === 'start'
        ? { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now }
        : { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now - e.sec * 1000, endedAt: now, result: e.result, score: e.score, stars: e.stars, sec: e.sec }
    );
    await Promise.all([
      store.trackSession({ sid: t.sid, vid, now, activeSec: t.activeSec, ref: t.ref, device: t.device }),
      plays.length ? store.trackPlays(plays) : null,
    ]);
    return true;
  }

  async function api(request, url, ip, json, setCookies) {
    const p = url.pathname;
    const m = request.method;

    // ?boot=1: 첫 화면에 필요한 것(설정 + 내 정보)을 한 번에 → 접속 한 번에 요청 3개 → 1개 (Vercel 요청 수 아끼기)
    if (p === '/api/health') {
      if (url.searchParams.get('boot') !== '1') return json(200, { ok: true, app: 'okaystra' });
      await expireTempMaybe();
      const pl = await getPlayer(request);
      if (pl) await purgeMaybe();
      return json(200, {
        ok: true,
        app: 'okaystra',
        config: { gateMode: cfg.gateMode, instagramHandle: cfg.instagramHandle, siteUrl: cfg.siteUrl, freePassUntil: (await freePassOn()) ? await freePassUntil() : 0 },
        me: pl ? meOf(pl) : { verified: false },
      });
    }

    if (p === '/api/config' && m === 'GET') {
      return json(200, {
        gateMode: cfg.gateMode,
        instagramHandle: cfg.instagramHandle,
        siteUrl: cfg.siteUrl,
        freePassUntil: (await freePassOn()) ? await freePassUntil() : 0,
      });
    }

    // 랭킹 닉네임이 있으면 guest:true (인스타 아이디 인증은 없어짐)
    if (p === '/api/me' && m === 'GET') {
      await expireTempMaybe();
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
      if (passBlocked(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const pw = await followPassword();
      const free = await freePassOn();
      if (!pw && !free) return json(503, { error: 'password_off' });
      const pl = await getPlayer(request);
      const name = body.name === undefined || body.name === '' ? null : cleanNickname(body.name);
      if (body.name && !name) return json(400, { error: 'bad_name' });
      const restoreOnly = body.restore === true;
      if (!pl && !name && !body.ig) return json(400, { error: 'bad_name' });
      const ig = body.ig ? cleanInstagram(body.ig) : null;
      if (body.ig && !ig) return json(400, { error: 'bad_ig' });
      if (!ig && !(pl && pl.ig)) return json(400, { error: 'bad_ig' });
      const okPw = !!pw && samePassword(body.password, pw);
      // 🆓 임시 인증 기간: 암호가 없거나 틀려도 통과(임시). 단 예전 계정 되찾기는 남의 계정을 가져갈 수 있어서 진짜 암호가 있어야 함
      if (!okPw && (!free || restoreOnly)) {
        if (body.password) passFail(ip);
        return json(403, { error: free ? 'need_password' : 'wrong_password' });
      }
      // 기록 되찾기: 이 인스타 아이디로 된 예전 계정(랭킹 기록이 가장 많은 것)이 있으면 그 계정으로 다시 붙음.
      //   새 주소로 옮기며 쿠키가 끊겨 새로 인증한 사람 → 새 계정 점수는 예전 계정으로 합치고 새 계정은 지움
      const wantIg = ig || pl.ig;
      const olds = okPw ? (await store.playersByIg(wantIg)).filter((o) => !pl || o.igsid !== pl.igsid) : [];
      let old = olds[0] && (!pl || olds[0].scores > 0) ? olds[0] : null;
      // 아이디로 못 찾으면: 닉네임이 같고 예전 아이디가 '거의 같은' 계정 (예전에 아이디를 대충 적은 사람). 랭킹 기록이 있는 것만
      if (!old && name && okPw) {
        const near = (await store.playersByName(name)).filter((o) => o.scores > 0 && (!pl || o.igsid !== pl.igsid) && igSimilar(o.ig, wantIg));
        if (near.length) old = near[0];
      }
      // 되찾기 창: 예전 계정을 못 찾으면 새로 만들지 않고 알려 줌
      if (!old && restoreOnly) return json(404, { error: 'no_old' });
      if (!old && !pl && !name) return json(400, { error: 'bad_name' });
      let igsid;
      let restored = null;
      if (old) {
        igsid = old.igsid;
        if (pl && pl.ig === wantIg) {
          await store.moveScores(pl.igsid, igsid);
          await store.deletePlayer(pl.igsid);
        }
        await store.upsertPlayer(igsid, { ig: wantIg });
        setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
        restored = { username: old.username };
      } else {
        igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
        await store.upsertPlayer(igsid, { username: name || pl.username, ig });
        if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      }
      // 암호로 인증 = 완료. 임시 인증이면 이미 완료된 사람은 그대로 둠 (임시로 내려가지 않게)
      if (okPw) await store.setChecked(igsid, true);
      else if (!(pl && pl.igsid === igsid && pl.checkedAt > 0)) await store.setChecked(igsid, 'temp');
      const rec = await store.getPlayer(igsid);
      // 랭킹에 올렸던 기록으로 깬 단계·별·다이아를 다시 채워 줌 (화면이 자기 기록과 합침)
      const bests = bestsFromScores(await store.scoresOf(igsid));
      if (restored) restored.levels = Object.keys(bests).filter((k) => /^\d+$/.test(k)).length;
      return json(200, { ...meOf({ username: rec.username, ig: rec.ig, checkedAt: rec.checkedAt, hiddenAt: rec.hiddenAt }), restored, bests });
    }

    // 📱 기기 옮기기 (계정 연동): 옛 폰이 기록을 올리고 6자리 코드를 받음 → 새 폰이 코드를 넣으면 기록 + 랭킹 계정(인증 포함)을 가져감
    //   코드는 10분, 한 번만. 서버엔 그 10분 동안만 남음 (가져가면 바로 지움)
    if (p === '/api/transfer' && m === 'POST') {
      const b = await readJson(request);
      const now = Date.now();
      if (b.op === 'make') {
        if (!limitTransferMake(ip)) return json(429, { error: 'rate_limited' });
        const data = cleanTransferData(b.data);
        if (!data) return json(400, { error: 'bad_data' });
        const pl = await getPlayer(request);
        const expiresAt = now + TRANSFER_TTL_MS;
        for (let i = 0; i < 8; i++) {
          const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
          if (await store.putTransfer(code, { data, igsid: pl ? pl.igsid : null }, now, expiresAt)) return json(200, { code, expiresAt });
        }
        return json(503, { error: 'busy' });
      }
      if (b.op === 'take') {
        if (!limitTransferTake(ip)) return json(429, { error: 'rate_limited' });
        const code = String(b.code ?? '').replace(/\D/g, '');
        if (code.length !== 6) return json(400, { error: 'bad_code' });
        const t = await store.takeTransfer(code, now);
        if (!t) return json(404, { error: 'bad_code' });
        let me = null;
        const rec = t.igsid ? await store.getPlayer(t.igsid) : null;
        if (rec && rec.username) {
          setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid: rec.igsid, v: now }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
          me = meOf({ username: rec.username, ig: rec.ig || null, checkedAt: rec.checkedAt || null, hiddenAt: rec.hiddenAt || null });
        }
        return json(200, { data: t.data, me });
      }
      return json(400, { error: 'bad_op' });
    }

    // 📮 기록 되찾기 요청: 아이디가 기억 안 나 자동으로 못 찾은 사람 → 운영자가 admin 에서 계정을 골라 승인
    //   팔로워 암호가 있어야 보냄(장난 방지). token 은 보낸 폰만 알고, 승인되면 그 폰이 status 를 물을 때 계정으로 붙음
    if (p === '/api/recover-request' && m === 'POST') {
      if (passBlocked(ip)) return json(429, { error: 'rate_limited' });
      const b = await readJson(request);
      const pw = await followPassword();
      const free = await freePassOn();
      if (!pw && !free) return json(503, { error: 'password_off' });
      const nick = String(b.nick ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
      const oldIg = String(b.oldIg ?? '').trim().replace(/^@+/, '').slice(0, 40);
      const nowIg = cleanInstagram(b.nowIg);
      const memo = String(b.memo ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 300);
      if (!nick && !oldIg) return json(400, { error: 'need_nick' });
      if (!nowIg) return json(400, { error: 'bad_ig' });
      // 🆓 임시 인증 기간엔 암호 없이도 보냄 (운영자가 admin 에서 보고 승인)
      if (!free && !samePassword(b.password, pw)) {
        passFail(ip);
        return json(403, { error: 'wrong_password' });
      }
      if (!limitRecoverReq(ip)) return json(429, { error: 'rate_limited' });
      const token = newId() + newId();
      // 이 폰이 지금 쓰는 계정 (새 주소에서 새로 만든 계정일 때가 많음) → admin 후보에서 '지금 이 폰 계정'으로 따로 표시
      const cur = await getPlayer(request);
      const id = await store.addRecoverRequest({ token, at: Date.now(), nick: nick || null, oldIg: oldIg || null, nowIg, memo: memo || null, fromIgsid: cur ? cur.igsid : null });
      return json(200, { ok: true, id, token });
    }
    if (p === '/api/recover-request/status' && m === 'POST') {
      if (!limitRecoverCheck(ip)) return json(429, { error: 'rate_limited' });
      const b = await readJson(request);
      if (typeof b.token !== 'string' || b.token.length < 20 || b.token.length > 80) return json(400, { error: 'bad_token' });
      const r = await store.recoverRequestByToken(b.token);
      if (!r) return json(404, { error: 'not_found' });
      if (r.status !== 'done') return json(200, { status: r.status });
      const rec = r.igsid ? await store.getPlayer(r.igsid) : null;
      if (!rec || !rec.username) return json(200, { status: 'rejected' });
      // 운영자가 이 계정이 맞다고 승인함 → 이 폰을 그 계정으로 (인증 완료 상태로)
      await store.setChecked(rec.igsid, true);
      const now = await store.getPlayer(rec.igsid);
      setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid: rec.igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      const bests = bestsFromScores(await store.scoresOf(rec.igsid));
      return json(200, { status: 'done', me: meOf({ username: now.username, ig: now.ig, checkedAt: now.checkedAt, hiddenAt: now.hiddenAt }), bests, levels: Object.keys(bests).filter((k) => /^\d+$/.test(k)).length });
    }

    // 이용 통계 (익명): 접속 시간 + 곡 시작/끝. 이름·아이디·IP 는 저장하지 않음
    if (p === '/api/track' && m === 'POST') {
      if (!limitTrack(ip)) return json(429, { error: 'rate_limited' });
      const ok = await saveTrack(request, await readJson(request), setCookies);
      if (!ok) return json(400, { error: 'bad_track' });
      return json(200, { ok: true });
    }

    // 건의함: 누구나 (닉네임이 있으면 같이 저장). 같은 브라우저는 1시간에 5개까지
    if (p === '/api/suggestions' && m === 'POST') {
      if (!limitSuggest(ip)) return json(429, { error: 'rate_limited' });
      // 건의하기는 팔로워 인증(인증 완료)한 사람만
      if (cfg.gateMode !== 'open') {
        const who = await getPlayer(request);
        if (!isConfirmed(who)) return json(403, { error: isVerified(who) ? 'confirm_pending' : 'confirm_required' });
      }
      const b = await readJson(request);
      const body = String(b.text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 500);
      if ([...body].length < 2) return json(400, { error: 'too_short' });
      const kind = ['song', 'idea', 'bug', 'etc'].includes(b.kind) ? b.kind : 'etc';
      let vid = cookiesOf(request)[VID_COOKIE];
      if (!/^[A-Za-z0-9_-]{16,32}$/.test(vid || '')) {
        vid = newId();
        setCookies.push(cookie(VID_COOKIE, vid, { maxAge: VID_MAX_AGE, secure: cfg.cookieSecure }));
      }
      const now = Date.now();
      if ((await store.countSuggestions(vid, now - 3600 * 1000)) >= 5) return json(429, { error: 'rate_limited' });
      const pl = await getPlayer(request);
      const contact = String(b.contact ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
      const id = await store.addSuggestion({ at: now, kind, body, nick: pl ? pl.username : null, vid, contact });
      return json(200, { ok: true, id });
    }

    // 🌍 유저 맵: 누구나 올리고(팔로워 인증한 사람), 누구나 침. 운영자 개입 없음 — 신고 3개면 자동으로 숨김
    if (p === '/api/maps' || p.startsWith('/api/maps/')) {
      if (!limitMaps(ip)) return json(429, { error: 'rate_limited' });
      const pl = await getPlayer(request);
      const canWrite = cfg.gateMode === 'open' ? !!pl : isConfirmed(pl);
      const writeErr = () => json(403, { error: !pl ? 'confirm_required' : isVerified(pl) ? 'confirm_pending' : 'confirm_required' });
      const pub = (m) => ({ id: m.id, nick: m.nick, name: m.name, bpm: m.bpm, bars: m.bars, diff: m.diff, at: m.at, plays: m.plays, likes: m.likes, mine: !!pl && m.igsid === pl.igsid });
      if (p === '/api/maps' && m === 'GET') {
        const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
        return json(200, { maps: (await store.listMaps(sort, 60)).map(pub) });
      }
      if (p === '/api/maps' && m === 'POST') {
        if (!canWrite) return writeErr();
        const b = await readJson(request);
        const map = cleanMap(b.map);
        if (!map) return json(400, { error: 'bad_map' });
        const now = Date.now();
        if ((await store.countMapsBy(pl.igsid, now - 24 * 3600 * 1000)) >= 10) return json(429, { error: 'too_many_maps' });
        let id = null;
        for (let i = 0; i < 5 && !id; i++) {
          const tryId = crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7);
          if (await store.addMap({ id: tryId, igsid: pl.igsid, nick: pl.username, name: map.name, bpm: map.bpm, bars: map.bars.length, diff: mapDifficulty(map), data: map, at: now })) id = tryId;
        }
        if (!id) return json(500, { error: 'server_error' });
        return json(200, { ok: true, id });
      }
      const mm = /^\/api\/maps\/([A-Za-z0-9]{7})(?:\/(like|report|delete|score))?$/.exec(p);
      if (!mm) return json(404, { error: 'not_found' });
      const [, id, act] = mm;
      if (!act && m === 'GET') {
        const play = url.searchParams.get('play') === '1';
        const r = await store.getMap(id, { play });
        if (!r) return json(404, { error: 'not_found' });
        // 🏆 치러 들어갈 때 같은 요청에 모드별 1~3등을 같이 실어 보냄 (따로 요청 안 늘림)
        return json(200, { map: { ...pub(r), data: r.data }, top: play ? await store.topMapScores(id, 3) : undefined });
      }
      if (act && m === 'POST') {
        if (!canWrite) return writeErr();
        if (act === 'delete') return json(200, { ok: await store.deleteMap(id, pl.igsid) });
        if (act === 'score') {
          // 🏆 판이 끝날 때 한 번: mode 'free'(무적) / 'hearts'(하트 5개, 끝까지 살아남은 판만)
          const b = await readJson(request);
          const mode = b.mode === 'hearts' ? 'hearts' : b.mode === 'free' ? 'free' : null;
          const score = Math.floor(Number(b.score));
          if (!mode || !Number.isFinite(score) || score < 0) return json(400, { error: 'bad_score' });
          const r = await store.getMap(id);
          if (!r) return json(404, { error: 'not_found' });
          const map = cleanMap(r.data);
          if (!map || score > maxScore(mapLevel(map))) return json(400, { error: 'bad_score' });
          const s = await store.addMapScore(id, pl.igsid, pl.username, mode, score);
          if (!s) return json(404, { error: 'not_found' });
          return json(200, { ok: true, best: s.best, top: await store.topMapScores(id, 3) });
        }
        const b = await readJson(request);
        const r = await store.voteMap(id, pl.igsid, act, act === 'report' ? true : b.on !== false);
        if (!r) return json(404, { error: 'not_found' });
        return json(200, { ok: true, ...r });
      }
      return json(405, { error: 'method_not_allowed' });
    }

    // 건의함을 매일 읽는 봇 (읽기 전용 토큰). ?days=1 (1~30) 최근 N일
    if (p === '/api/bot/suggestions' && m === 'GET') {
      if (!cfg.botToken) return json(404, { error: 'not_found' });
      if (!sameToken(url.searchParams.get('token') || request.headers.get('x-bot-token') || '', cfg.botToken)) {
        if (!limitAdmin(ip)) return json(429, { error: 'rate_limited' });
        return json(401, { error: 'bad_token' });
      }
      const days = Math.min(30, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 1));
      const now = Date.now();
      const rows = await store.listSuggestions(now - days * 24 * 3600 * 1000, 500);
      const kst = (t) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
      return json(200, {
        days,
        count: rows.length,
        suggestions: rows.map((r) => ({ id: r.id, at: kst(r.at) + ' KST', kind: r.kind, text: r.body, nick: r.nick, contact: r.contact || null, done: !!r.doneAt })),
      });
    }

    // 🏆 랭킹전: info(내 점수·순위) · ghost(실시간 상대가 없을 때 고스트 받기) · result(판 결과)
    if (p === '/api/ranked' && m === 'POST') {
      const b = await readJson(request);
      if (!limitRoom(ip)) return json(429, { error: 'rate_limited' });
      const [status, data] = await ranked.handle(request, b);
      return json(status, data);
    }

    // 친구 대결 방 (만들기·들어가기·주고받기·나가기)
    if (p === '/api/rooms' && m === 'POST') {
      const b = await readJson(request);
      if (!limitRoom(ip)) return json(429, { error: 'rate_limited' });
      if ((b.action === 'create' || b.action === 'quick') && !limitRoomCreate(ip)) return json(429, { error: 'rate_limited' });
      // 멀티(방 만들기·들어가기·빠른 대결)는 팔로워 인증한 사람만. 이미 들어온 방의 주고받기·나가기는 방 열쇠로
      if (cfg.gateMode !== 'open' && ['create', 'join', 'quick'].includes(b.action)) {
        const who = await getPlayer(request);
        if (!isConfirmed(who)) return json(403, { error: isVerified(who) ? 'confirm_pending' : 'confirm_required' });
      }
      const [status, data] = await handleRoom(request, b);
      return json(status, data);
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
      // 🏛 명예의 전당 사진 보기·지우기 (이상한 사진이면)
      if (p === '/api/admin/hall' && m === 'GET') return json(200, { hall: await store.hallList() });
      if (p === '/api/admin/hall/photo' && m === 'POST') {
        const b = await readJson(request);
        return json(200, { ok: await store.hallSetImage(Number(b.season), String(b.board), Number(b.rank), null) });
      }
      // 랭킹 참여자 (인스타 아이디로 팔로우 확인 → 안 했으면 삭제)
      if (p === '/api/admin/players' && m === 'GET') {
        await store.purgeHidden();
        if (store.cleanup) await store.cleanup();
        return json(200, { players: await store.listPlayers(), keepDays: HIDE_KEEP_MS / 86400000 });
      }
      // 랭킹에서 내리기 (5일 뒤 자동 삭제, 그 사이 다시 들어와 아이디를 넣으면 돌아옴) / 되돌리기
      // 🕵 핵 의심 지표 (쿼리 2번: 참여자 목록 + 전체 기록)
      if (p === '/api/admin/suspects' && m === 'GET') {
        // ?igsid= 이면 그 사람 자세히, 없으면 강한 신호만 목록 (쿼리 2번)
        const players = await store.listPlayers();
        const rows = await store.allScores();
        const id = url.searchParams.get('igsid');
        if (id) {
          const pl = players.find((x) => x.igsid === id);
          return pl ? json(200, { report: suspectReport(pl, rows, await store.triesOf(id)) }) : json(404, { error: 'not_found' });
        }
        return json(200, { checked: players.length, suspects: findSuspects(players, rows) });
      }
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
      // 📮 되찾기 요청 목록 + 요청마다 맞을 만한 계정 후보 (닉네임 같음 · 예전/지금 아이디 비슷)
      if (p === '/api/admin/recover-requests' && m === 'GET') {
        const reqs = await store.listRecoverRequests(300);
        // 전부 봄: 예전 계정(인스타 아이디 없음)은 참여자 목록 맨 뒤라 1000명에서 자르면 못 찾음
        const players = await store.listPlayers(1_000_000);
        const byId = new Map(players.map((x) => [x.igsid, x]));
        const norm = (s) => String(s || '').trim().toLowerCase();
        const squash = (s) => norm(s).replace(/[\s._\-·~!?]+/g, '');
        const out = reqs.map((r) => {
          const { fromIgsid, ...rest } = r;
          const from = fromIgsid ? byId.get(fromIgsid) : null;
          if (r.status === 'done') {
            const t = byId.get(r.igsid);
            return { ...rest, target: t ? { igsid: t.igsid, username: t.username, ig: t.ig } : null, candidates: [] };
          }
          const nick = squash(r.nick);
          const candidates = players
            .filter((x) => x.igsid !== fromIgsid)
            .map((x) => {
              const why = [];
              const name = squash(x.username);
              if (nick && name === nick) why.push('닉네임 같음');
              else if (nick && name && Math.min(nick.length, name.length) >= 2 && (name.includes(nick) || nick.includes(name))) why.push('닉네임 비슷');
              if (r.oldIg && igSimilar(x.ig, r.oldIg)) why.push(norm(x.ig) === norm(r.oldIg) ? '예전 아이디 같음' : '예전 아이디 비슷');
              if (r.nowIg && igSimilar(x.ig, r.nowIg)) why.push(norm(x.ig) === norm(r.nowIg) ? '지금 아이디 같음' : '지금 아이디 비슷');
              // 아이디 칸에 닉네임을 적었거나 그 반대
              if (!why.length && r.oldIg && squash(x.username) === squash(r.oldIg)) why.push('닉네임이 예전 아이디와 같음');
              return { igsid: x.igsid, username: x.username, ig: x.ig, total: x.total, levels: x.levels, top: x.top || 0, endless: x.endless ? endlessParts(x.endless).rounds : 0, checked: !!x.checkedAt, why };
            })
            .filter((x) => x.why.length)
            // 점수가 있는 계정 먼저 (점수 0 = 새로 만든 계정일 가능성이 큼)
            .sort((a, b) => (b.total > 0) - (a.total > 0) || b.why.length - a.why.length || b.top - a.top || b.total - a.total)
            .slice(0, 6);
          const fromAcc = from ? { igsid: from.igsid, username: from.username, ig: from.ig, total: from.total, levels: from.levels, top: from.top || 0, endless: from.endless ? endlessParts(from.endless).rounds : 0 } : null;
          return { ...rest, from: fromAcc, candidates };
        });
        return json(200, { requests: out });
      }
      if (p === '/api/admin/recover-requests/approve' && m === 'POST') {
        const b = await readJson(request);
        if (!Number.isInteger(b.id) || typeof b.igsid !== 'string') return json(400, { error: 'bad_request' });
        if (!(await store.getPlayer(b.igsid))) return json(404, { error: 'not_found' });
        return json(200, { ok: await store.setRecoverRequest(b.id, { status: 'done', igsid: b.igsid }) });
      }
      if (p === '/api/admin/recover-requests/reject' && m === 'POST') {
        const b = await readJson(request);
        if (!Number.isInteger(b.id)) return json(400, { error: 'bad_request' });
        return json(200, { ok: await store.setRecoverRequest(b.id, { status: b.undo ? 'wait' : 'rejected' }) });
      }
      if (p === '/api/admin/recover-requests/delete' && m === 'POST') {
        const b = await readJson(request);
        if (!Number.isInteger(b.id)) return json(400, { error: 'bad_request' });
        return json(200, { ok: await store.deleteRecoverRequest(b.id) });
      }
      // 기록 되찾기 코드: 아이디가 기억 안 나는 사람을 운영자가 인스타 DM 으로 확인한 뒤 발급 → 그 사람이 설정 → 기록 옮기기에 넣음
      if (p === '/api/admin/players/recover' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.igsid !== 'string' || !b.igsid) return json(400, { error: 'bad_igsid' });
        const rec = await store.getPlayer(b.igsid);
        if (!rec) return json(404, { error: 'not_found' });
        const now = Date.now();
        const expiresAt = now + 24 * 3600 * 1000;
        const data = { bests: bestsFromScores(await store.scoresOf(b.igsid)) };
        for (let i = 0; i < 8; i++) {
          const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
          if (await store.putTransfer(code, { data, igsid: b.igsid }, now, expiresAt)) return json(200, { code, expiresAt, username: rec.username });
        }
        return json(503, { error: 'busy' });
      }
      if (p === '/api/admin/players/check' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.igsid !== 'string' || !b.igsid) return json(400, { error: 'bad_igsid' });
        return json(200, { ok: await store.setChecked(b.igsid, b.checked !== false) });
      }
      // 건의함: ?days=30 (1~365)
      if (p === '/api/admin/suggestions' && m === 'GET') {
        const days = Math.min(365, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 30));
        return json(200, { suggestions: await store.listSuggestions(Date.now() - days * 24 * 3600 * 1000, 1000) });
      }
      if (p === '/api/admin/suggestions/done' && m === 'POST') {
        const b = await readJson(request);
        if (!Number.isInteger(b.id)) return json(400, { error: 'bad_id' });
        return json(200, { ok: await store.setSuggestionDone(b.id, b.done !== false) });
      }
      if (p === '/api/admin/suggestions/delete' && m === 'POST') {
        const b = await readJson(request);
        if (!Number.isInteger(b.id)) return json(400, { error: 'bad_id' });
        return json(200, { ok: await store.deleteSuggestion(b.id) });
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
      // 🆓 암호 없이 임시 인증 기간: until(ms) 보기 / 바꾸기. 0 이면 끔 → 바로 임시 인증한 사람들 풀림
      if (p === '/api/admin/free-pass' && m === 'GET') {
        const until = await freePassUntil(true);
        return json(200, { until, on: Date.now() < until });
      }
      if (p === '/api/admin/free-pass' && m === 'POST') {
        const b = await readJson(request);
        const until = Number(b.until) || 0;
        if (until < 0 || until > Date.now() + 60 * 86400000) return json(400, { error: 'bad_until' });
        await store.setSetting('freePassUntil', String(until));
        fpCache = { at: Date.now(), until };
        let expired = 0;
        if (Date.now() >= until) {
          expired = await store.expireTempChecks();
          await store.setSetting('freePassUntil', '0');
          fpCache = { at: Date.now(), until: 0 };
        }
        return json(200, { ok: true, until: fpCache.until, on: Date.now() < fpCache.until, expired });
      }
      return json(404, { error: 'not_found' });
    }

    // 3) 판 시작 토큰 (점수 위조 방지용 최소 장치)
    if (p === '/api/runs' && m === 'POST') {
      const body = await readJson(request);
      // 이용 통계가 얹혀 왔으면 같이 저장 (따로 /api/track 요청 안 해도 되게)
      if (body.track && limitTrack(ip)) await saveTrack(request, body.track, setCookies).catch(() => {});
      const level = endlessMode(body.level) || getLevel(body.level);
      if (!level) return json(400, { error: 'bad_level' });
      // 4단계부터와 무제한(그리그·단계별)은 팔로워 인증(암호 또는 운영자 확인)한 사람만
      // (GATE_MODE=open 이면 잠금 없음, 개발용)
      let runPl = null;
      if (cfg.gateMode !== 'open' && (isClosed(level.id) || needsVerify(level.id))) {
        const pl = (runPl = await getPlayer(request));
        if (isClosed(level.id) && !isConfirmed(pl)) return json(403, { error: isVerified(pl) ? 'confirm_pending' : 'confirm_required' });
        if (needsVerify(level.id) && !isVerified(pl)) return json(403, { error: 'verify_required' });
      }
      // 🕵 단계마다 몇 판 시작했나 (누군지 이미 아는 판만 = 4단계부터. 1~3단계는 쿼리 늘리지 않으려고 안 셈)
      if (runPl && runPl.igsid && level.id > 0) await Promise.resolve().then(() => store.addTry(runPl.igsid, level.id, 1, 0)).catch(() => {});
      const runToken = sign({ l: level.id, t: Date.now(), n: newId() }, cfg.sessionSecret);
      return json(200, { runToken });
    }

    // 4) 점수 등록 (닉네임 또는 인스타 인증 필요)
    if (p === '/api/scores' && m === 'POST') {
      if (!limitScores(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      if (body.track && limitTrack(ip)) await saveTrack(request, body.track, setCookies).catch(() => {});
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      // 랭킹은 팔로워 인증(인증 완료)한 사람만 (GATE_MODE=open 이면 닉네임만 있어도)
      if (cfg.gateMode !== 'open' && !isConfirmed(pl)) return json(403, { error: 'verify_required' });
      const em = endlessMode(body.level);
      if (em) {
        const e = validateEndless(body, cfg);
        if (!e.ok) return json(400, { error: e.error });
        if (!(await store.useRun(e.nonce, Date.now() + 2 * 24 * 3600 * 1000))) return json(409, { error: 'run_used' });
        await ensureHall();
        const out = await store.recordScore(pl.igsid, em.slot, { score: endlessKey(e.rounds, e.score), grade: null, maxCombo: 0 });
        if (seasonAt().n > 1) await store.recordSeasonScore(seasonAt().n, pl.igsid, em.slot, endlessKey(e.rounds, e.score));
        const mine = await store.rankOf(em.slot, pl.igsid);
        const best = endlessParts(out.best);
        return json(200, { improved: out.improved, best: best.score, rounds: best.rounds, rank: mine ? mine.rank : null });
      }
      const v = validateScore(body, cfg);
      if (!v.ok) return json(400, { error: v.error });
      if (!(await store.useRun(v.nonce, Date.now() + 2 * 24 * 3600 * 1000))) return json(409, { error: 'run_used' });
      await ensureHall();
      const out = await store.recordScore(pl.igsid, v.level.id, { score: v.score, grade: v.grade, maxCombo: v.maxCombo, chk: v.chk });
      if (v.level.id > 0) await Promise.resolve().then(() => store.addTry(pl.igsid, v.level.id, 0, 1)).catch(() => {});
      if (seasonAt().n > 1 && v.level.id > 0 && v.level.id <= LAST_LEVEL_ID) await store.recordSeasonScore(seasonAt().n, pl.igsid, v.level.id, v.score);
      const mine = await store.rankOf(v.level.id, pl.igsid);
      return json(200, { ...out, rank: mine ? mine.rank : null });
    }

    // 🏛 명예의 전당: 이번 시즌 총합 랭킹(단계·무제한) + 끝난 시즌 1·2·3등(사진 포함)
    if (p === '/api/hall' && m === 'GET') {
      const board = url.searchParams.get('board') === 'endless' ? 'endless' : 'stage';
      await ensureHall();
      const pl = await getPlayer(request);
      const season = seasonAt();
      const lb = await store.seasonBoard(season.n, board, 50);
      const mine = pl ? await store.seasonRankOf(season.n, board, pl.igsid) : null;
      const hall = (await store.hallList()).map((h) => ({ ...hallEntry(h, pl), season: h.season, board: h.board, image: h.image }));
      return json(200, { season: { n: season.n, end: season.end }, board, levels: LAST_LEVEL_ID, entries: lb.rows.map((r) => hallEntry(r, pl)), me: mine ? hallEntry(mine, pl) : null, hall });
    }
    // 명예의 전당에 오른 사람만 자기 칸에 프로필 사진 올리기 / 지우기 (image: null)
    if (p === '/api/hall/photo' && m === 'POST') {
      if (!limitHallPhoto(ip)) return json(429, { error: 'rate_limited' });
      const b = await readJson(request);
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const image = b.image === null ? null : cleanHallImage(b.image);
      if (b.image !== null && !image) return json(400, { error: 'bad_image' });
      const board = HALL_BOARDS.includes(b.board) ? b.board : null;
      if (!board || !Number.isInteger(b.season) || !Number.isInteger(b.rank)) return json(400, { error: 'bad_request' });
      const ok = await store.hallSetImage(b.season, board, b.rank, image, pl.igsid);
      return ok ? json(200, { ok: true }) : json(403, { error: 'not_yours' });
    }

    if (p === '/api/leaderboard' && m === 'GET' && url.searchParams.get('level') === 'total') {
      const pl = await getPlayer(request);
      const lb = await store.totalLeaderboard(50);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, score: r.score, levels: r.levels, me: pl ? r.igsid === pl.igsid : false }));
      const mine = pl ? await store.totalRankOf(pl.igsid) : null;
      return json(200, { level: 'total', levels: LAST_LEVEL_ID, entries, me: mine });
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
  return { ok: true, level, score, counts, grade: gradeFor(counts), maxCombo, nonce: run.n, chk: runCheck(body.check, now - run.t) };
}

/**
 * 🕵 핵 의심 확인용 (2026-11-21): 실제로 친 시간(판 토큰 받은 때 → 점수 올린 때) + 폰이 잰 박자 오차 퍼짐·평균, 가짜 입력 수
 *   점수 올릴 때 얹어 와서 scores.chk 에 JSON 으로 (요청·줄 추가 없음). 예전 앱은 check 가 없어 ms 만
 */
export function runCheck(c, elapsedMs) {
  const out = { ms: Math.max(0, Math.round(elapsedMs)) };
  if (c && typeof c === 'object') {
    const int = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
    const sd = int(c.sd, 0, 1000), mean = int(c.mean, -1000, 1000), n = int(c.n, 0, 100000), fake = int(c.fake, 0, 100000);
    if (sd != null) out.sd = sd;
    if (mean != null) out.mean = mean;
    if (n != null) out.n = n;
    if (fake != null) out.fake = fake;
  }
  return JSON.stringify(out);
}
