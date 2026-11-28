// /api 처리 (fetch 방식: Request → Response)
// Node 서버(server/app.js)와 Vercel 함수(api/server.js)가 같이 씁니다.
// 저장소(store)는 메서드가 값이나 Promise 를 돌려줘도 되게 전부 await 로 부름
//   - Node: JsonStore (파일 하나) / Vercel: PgStore (Neon Postgres)

import { cleanAvatar, cleanIntro } from '../public/js/avatars.js';
import crypto from 'node:crypto';
import { sign, unsign, parseCookies, cookie, newId } from './session.js';
import { buildStats } from './stats.js';
import { cleanAds, foldAds, makeAdDedupe, buildAdStats } from './adstats.js';
import { findSuspects, suspectReport } from './suspect.js';
import { createRoomHandler } from './rooms.js';
import { createRankedHandler } from './ranked.js';
import { kakaoAuthUrl, kakaoUserId, kakaoHash, KAKAO_STATE_MS } from './kakao.js';
import { googleAuthUrl, googleUserId, googleHash } from './google.js';
import { cleanMap, mapDifficulty, mapLevel } from '../public/js/usermap.js';
import { buyItem, cleanOwned, legacyRefund, seasonRewards } from '../public/js/shop.js';
import { seasonAt, endedSeasons, HALL_BOARDS, hallBoardsOf, cleanHallImage, SEASONS } from '../public/js/season.js';
import { tileSong, tileSlot, tileClosed, checkTileRun, lapGrade, gradeLaps, TILE_SONGS, mapTileMax, isTileSlot, TILE_SLOT0, tileLap, lapStars } from '../public/js/tiles.js';
import { applyS2, cleanCommunity, COMMUNITY_DEFAULT, s2Of } from '../public/js/quests.js';
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
// ---------------- 🪙 코인 (2026-11-22) ----------------
//   PERFECT 2개 · GREAT·GOOD·연타 1개. 폰이 번 코인을 모아 두었다가 다음 판 시작(/api/runs)·점수 등록(/api/scores)
//   요청에 얹어 보냄 → 요청 수 그대로. 판 도중(앱을 닫음·그만둠)에도 그때까지 번 만큼 보냄.
//   runs: [{ tok: 판 토큰, n }] — 토큰 서명 확인, 한 판 최대 = 그 곡 콩 수×2 + 연타 여유 & 초당 30개.
//         같은 판 토큰으로 나눠 와도 합쳐서 최대까지만(tn), 지난 판(t < 지갑 t)은 안 받음
//   free: 토큰 없이 번 것(연습·멀티·유저 맵·내 노래 등) 하루 COIN_FREE_DAY 까지
//   init: 서버 지갑 생기기 전 폰에 모은 코인, 계정마다 한 번 COIN_INIT_MAX 까지
//   쓰기는 지갑 한 줄(바뀐 게 있을 때만) → D1 하루 쓰기에 판당 1줄 정도
export const COIN_FREE_DAY = 5000;
/** 🗳 열린 투표 → 고를 수 있는 것 (2026-11-23 시즌 2 피아노: a = 라이브 스타일, b = 건반 스타일) */
export const POLLS = { piano2: ['a', 'b'] };
/** 🗳 처음 투표하면 코인 (계정마다 한 번, 표를 바꿔도 다시 안 줌) — 2026-11-23 사용자 */
export const POLL_BONUS = 500;
export const COIN_INIT_MAX = 20000;
/** 💎 한 판에 다이아 최대 3개(폰이 보낼 때) · 판 토큰 하나(기록 못 넘은 판은 토큰을 30분 다시 씀)로 받는 최대
 *   · 다이아 하나 = 바퀴 하나 끝까지(이 시간보다 빨리는 못 침, 첫 바퀴 몫 하나 뺌) · 계정 전 폰 다이아 한 번 */
export const GEM_RUN_MAX = 3;
/** 💎 곡 하나에서 받을 수 있는 다이아 (평생, 2026-11-27 사용자 '한곡당 최대3개') */
export const GEM_SONG_MAX = 3;
export const GEM_TOKEN_MAX = 60;
export const GEM_LAP_MS = 20 * 1000;
export const GEM_INIT_MAX = GEM_SONG_MAX * TILE_SONGS.length;
/**
 * 💎 다이아 재화 생기기 전에 얻은 다이아 (2026-11-27 사용자 '지금까지 얻은 것도 쳐 줘'): 랭킹 기록(scores 타일 칸)의 바퀴 수로
 *   곡마다 다이아(lapStars) → 이미 받은 곡별 수(gs)보다 많으면 그 차이만 더함. 계정마다 한 번(gb)
 */
export function gemBackfill(w0, rows) {
  const w = { coins: 0, ...(w0 || {}) };
  const s2 = s2Of(w);
  if (s2.gb) return { wallet: w, added: 0 };
  const gs = { ...(s2.gs && typeof s2.gs === 'object' ? s2.gs : {}) };
  let added = 0;
  for (const [id, b] of Object.entries(tileBestsFromScores(rows))) {
    const key = 't' + id;
    const n = Math.min(GEM_SONG_MAX, b.gems || 0) - (gs[key] || 0);
    if (n > 0) {
      gs[key] = (gs[key] || 0) + n;
      added += n;
    }
  }
  w.s2 = { ...s2, gs, gm: (s2.gm || 0) + added, gb: 1 };
  return { wallet: w, added };
}
// 폰이 코인을 10분에 한 번 모아 보내고 한동안 안 들어올 수도 있어서 넉넉히 (판 순서 t 로 같은 판 두 번은 안 받음)
const COIN_TOKEN_AGE = 14 * 24 * 3600 * 1000;
const coinInt = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const kstDay = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
/** 한 판 토큰으로 받을 수 있는 최대 코인 */
export function coinCap(l, ageMs) {
  const byTime = Math.floor(Math.max(0, ageMs) / 1000) * 30 + 60; // PERFECT 2개 × 초당 15타 넘게는 못 침
  if (endlessMode(l) || tileSong(l)) return byTime; // 무제한·🎹 타일(바퀴마다 계속)은 시간으로만
  const level = getLevel(l);
  if (!level) return 0;
  let notes = 0;
  try {
    notes = noteCount(level);
  } catch {}
  return Math.min(byTime, notes * 2 + 300);
}
/** 지갑에 더할 것 계산 → { wallet(새 값), changed } */
export function applyCoins(w0, c, secret, now = Date.now()) {
  const w = { coins: 0, t: 0, tn: 0, fday: '', fn: 0, init: 0, ...(w0 || {}) };
  let changed = false;
  let rest = 0;
  // 같은 판 토큰은 합쳐서
  const byT = new Map();
  for (const r of Array.isArray(c.runs) ? c.runs.slice(0, 40) : []) {
    const run = r && unsign(r.tok, secret);
    if (!run || !Number.isFinite(run.t) || run.t < w.t || run.t > now || now - run.t >= COIN_TOKEN_AGE) continue;
    const e = byT.get(run.t) || { run, n: 0, g: 0 };
    e.n += coinInt(r.n, 1e6);
    e.g += coinInt(r.g, GEM_TOKEN_MAX);
    byT.set(run.t, e);
  }
  // 💎 다이아 (2026-11-27): 🎹 타일 곡 판 토큰만, 그만큼 친 시간 안에서 — 지갑 s2 칸(gm 잔액, gt·gn 이 토큰에 준 것)
  const s2 = s2Of(w);
  let gemsChanged = false;
  for (const { run, g } of [...byT.values()].sort((a, b) => a.run.t - b.run.t)) {
    const song = tileSong(run.l);
    if (!g || !song || run.t < (s2.gt || 0)) continue;
    if (run.t > (s2.gt || 0)) {
      s2.gt = run.t;
      s2.gn = 0;
    }
    const byTime = Math.max(0, Math.floor((now - run.t) / GEM_LAP_MS) - 1);
    // 2026-11-27 사용자 '한 곡당 최대 3개' → 곡마다 받은 수(gs)를 기억, 평생 3개까지
    const gs = s2.gs && typeof s2.gs === 'object' ? s2.gs : {};
    const give = Math.max(0, Math.min(g, GEM_SONG_MAX - (gs[song.key] || 0), GEM_TOKEN_MAX - (s2.gn || 0), byTime - (s2.gn || 0)));
    if (give > 0) {
      s2.gs = { ...gs, [song.key]: (gs[song.key] || 0) + give };
      s2.gm = (s2.gm || 0) + give;
      s2.gn = (s2.gn || 0) + give;
      gemsChanged = true;
    }
  }
  if (Number.isFinite(c.ginit) && !s2.gi) {
    s2.gm = (s2.gm || 0) + coinInt(c.ginit, GEM_INIT_MAX);
    s2.gi = 1;
    gemsChanged = true;
  }
  if (gemsChanged) {
    w.s2 = s2;
    changed = true;
  }
  for (const { run, n } of [...byT.values()].sort((a, b) => a.run.t - b.run.t)) {
    if (run.t > w.t) {
      w.t = run.t;
      w.tn = 0;
    }
    const give = Math.max(0, Math.min(n, coinCap(run.l, now - run.t) - w.tn));
    w.coins += give;
    w.tn += give;
    changed = true;
  }
  const free = coinInt(c.free, 1e6);
  if (free > 0) {
    const day = kstDay(now);
    if (w.fday !== day) {
      w.fday = day;
      w.fn = 0;
    }
    const ok = Math.max(0, Math.min(free, COIN_FREE_DAY - w.fn));
    if (ok > 0) {
      w.coins += ok;
      w.fn += ok;
      changed = true;
    }
    // 오늘 한도를 넘은 만큼은 버리지 않고 폰에 돌려줌 → 다음 날 다시 보냄 (2026-11-23: 서버 쉴 때 번 코인이 5000 넘게 사라지던 것)
    rest = free - ok;
  }
  if (Number.isFinite(c.init) && !w.init) {
    w.coins += coinInt(c.init, COIN_INIT_MAX);
    w.init = 1;
    changed = true;
  }
  return { wallet: w, changed, rest };
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
// 🔑 같은 아이디·닉네임 예전 계정이 있으면 '암호로 이어가기' 묻기 (2026-11-25 만들고 같은 날 꺼 둠 — 암호 DM 을 못 줘서)
export let OLD_ASK = false;
export const setOldAsk = (on) => (OLD_ASK = !!on);
// 🔓 팔로워 암호 없앰 (2026-11-26 사용자 '암호 들어간 건 다 없애자 — 팔로우 받고 DM 으로 사이트 링크만 줌')
//   → 링크로 들어온 사람은 전부 이용 가능(4단계부터·무제한·멀티·건의하기·타일 곡). 랭킹은 닉네임·인스타 아이디 '이용 등록'만
//   임시 인증(checked_at 음수)도 풀지 않음. 예전 계정 되찾기는 암호 대신 '되찾기 요청'(운영자 승인)·되찾기 코드로만
export let NO_PASSWORD = true;
/** 시험에서 예전(암호) 동작을 볼 때만 끔 */
export const setNoPassword = (on) => (NO_PASSWORD = !!on);
/** 예전 폰(옛 app.js)이 '임시 이용 기간'으로 읽게 보내는 아주 먼 날 */
const FREE_FOREVER = Date.UTC(2099, 11, 31, 14, 59, 59);
const playerSeen = new WeakMap(); // 요청마다 알아본 로그인 열쇠 (X-Player 돌려줄지)
const TRANSFER_TTL_MS = 10 * 60 * 1000;
/**
 * 🎹 랭킹 기록(scores 3000+곡) → 폰의 타일 '내 기록'(tileBest) 모양. 브라우저를 바꾸고 로그인했을 때 곡 목록 결과를 되살리려고 (2026-11-27)
 *   별·다이아는 DB 에 없어서 바퀴 수(grade 'L바퀴')로 어림, 첫 바퀴도 못 끝낸 판은 친 타일 수 / 한 바퀴 타일 수로 별
 */
export function tileBestsFromScores(rows) {
  const out = {};
  for (const r of rows || []) {
    if (!isTileSlot(r.level) || !(r.score > 0)) continue;
    const id = r.level - TILE_SLOT0;
    const lap = tileLap(id);
    if (!lap) continue;
    const laps = gradeLaps(r.grade);
    const per = lap.tiles ? lap.tiles.length : 0;
    const { stars, gems } = lapStars(laps, laps > 0 || !per ? 0 : Math.min(1, r.score / per));
    out[id] = { tiles: r.score, laps, stars, gems, at: 0 };
  }
  return out;
}

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
  // 🪙 코인·산 꾸미기 (폰에만 있는 값이라 옮길 때 같이)
  if (Number.isFinite(d.coins)) out.coins = Math.max(0, Math.min(1e9, Math.floor(d.coins)));
  if (Array.isArray(d.decoOwned)) out.decoOwned = d.decoOwned.filter((v) => typeof v === 'string' && /^(bg|kit|notes|ui):[a-z]{1,12}$/.test(v)).slice(0, 60);
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
// ---------------- 🧯 한도 브레이크 (2026-11-22, 사용자 요청 '다음부터는 한도 차는 일 없게, 보수적으로') ----------------
//   Worker 가 D1 이 알려 주는 읽은·쓴 줄 수와 요청 수를 세서(meter) 몇 분마다 usage_day 한 줄에 더하고, 오늘 합계로 단계를 정함
//   한도: D1 읽기 하루 500만 줄 · 쓰기 10만 줄 · Worker 요청 10만 건 (무료, UTC 0시 = 한국 오전 9시 초기화)
//   1단계(40%): 무거운 건 덜 — 랭킹 창 '내 등수'(50등 밖)·단계별 판 수 세기 끔, 명예의 전당 캐시 6시간, admin 캐시 30분
//   2단계(60%): + 점수 올릴 때 등수 안 셈, 새 멀티 방·랜덤 대결 막음 (혼자 치기·기록은 그대로)
//   3단계(80%): 일부러 db_down → 폰은 서버 없는 모드(기록은 폰 + Neon 서버 보관함, 오전 9시에 랭킹으로) — 진짜 한도까지 안 감
//   세는 건 인스턴스마다 하다가 몇 분·요청 몇 번마다 합침 → 덜 세질 수 있어서 단계를 낮게 잡음. Actions 스크립트가 읽는 건 안 셈
export const USAGE_LIMITS = { r: 5_000_000, w: 100_000, q: 100_000 };
export const BRAKE_AT = [0.4, 0.6, 0.8];
// 2026-11-27 무료 한도 점검: 3분·요청 50번 → 5분·요청 100번 (usage_day 쓰기가 하루 2천 줄 넘던 것 줄임)
const USAGE_FLUSH_MS = 5 * 60 * 1000;
const TRACK_REST_MS = 60 * 60 * 1000;
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);

export function createHandler(cfg, { store, meter = null }) {
  const limitGuest = rateLimiter(15, 10 * 60 * 1000);
  // 🔑 카카오·구글 로그인 — 같은 흐름, 공급자별 함수만 다름
  const OAUTH = {
    kakao: { authUrl: kakaoAuthUrl, userId: kakaoUserId, hash: kakaoHash, byId: (k) => store.playerByKakao(k), of: (i) => store.kakaoOf(i), set: (i, k) => store.setKakao(i, k) },
    google: { authUrl: googleAuthUrl, userId: googleUserId, hash: googleHash, byId: (k) => store.playerByGoogle(k), of: (i) => store.googleOf(i), set: (i, k) => store.setGoogle(i, k) },
  };
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
  /** 🆓 임시 이용 기간(freePassUntil)엔 4단계부터·무제한·멀티·건의하기를 인증 없이 바로 (2026-11-22 사용자 요청: 인증 창 때문에 릴스에 「쿵」 댓글·DM 이 쏟아짐) */
  const openNow = async () => NO_PASSWORD || Date.now() < (await freePassUntil());
  async function freePassUntil(fresh = false) {
    if (NO_PASSWORD) return FREE_FOREVER;
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
    if (NO_PASSWORD) return;
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
  // 🏛 끝난 시즌 '내 순위' (2026-11-27 사용자 '100등 밑에 난 몇 등인지 한 칸 더'):
  //   끝난 시즌 전체 순위를 settings 한 줄(hallfinalall:N:board = { igsid: [등수, 점수, 단계 수, Lv] })에 한 번만 만들어 둠
  //   위 100명은 hallfinal 그대로, 그 밑은 지금 시즌 총합 순서로 101등부터 (표 통째 읽기는 시즌·판마다 한 번)
  async function buildFinalAll(n, bd, top) {
    const key = `hallfinalall:${n}:${bd}`;
    const out = {};
    for (const r of top) if (r.igsid) out[r.igsid] = [r.rank, r.score, r.n ?? null, r.rounds ?? null];
    let k = top.reduce((m, r) => Math.max(m, r.rank || 0), 0);
    const all = await store.seasonBoard(n, bd, 50000);
    for (const r of all.rows) if (!(r.igsid in out)) out[r.igsid] = [++k, r.score, r.n ?? null, r.rounds ?? null];
    const raw = JSON.stringify(out);
    await store.setSetting(key, raw);
    return raw;
  }
  async function finalMine(n, bd, pl) {
    if (!pl) return null;
    const key = `hallfinalall:${n}:${bd}`;
    const raw = await cached(
      key,
      30 * 60 * 1000,
      async () => {
        const have = await store.getSetting(key);
        if (have) return have;
        if (brake() >= 1) return '';
        let top = [];
        try {
          top = JSON.parse((await store.getSetting(`hallfinal:${n}:${bd}`)) || '[]');
        } catch {}
        return buildFinalAll(n, bd, top);
      },
      { shared: false }
    );
    if (!raw) return null;
    let map;
    try {
      map = JSON.parse(raw);
    } catch {
      return null;
    }
    const r = map[pl.igsid];
    return r ? { rank: r[0], username: pl.username, score: r[1], n: r[2], rounds: r[3] } : { rank: null, username: pl.username };
  }
  async function ensureHall(now = Date.now()) {
    for (const n of endedSeasons(now)) {
      if (hallDone.has(n)) continue;
      const flag = `hall:done:${n}`;
      if (!(await store.getSetting(flag))) {
        const boards = {};
        for (const board of hallBoardsOf(n)) {
          const top = await store.seasonBoard(n, board, 100);
          boards[board] = top.rows;
          // 🏛 끝난 시즌 최종 순위 100등까지 (전시관 「4~100등」, 2026-11-27) — 끝난 뒤 기록이 올라도 안 바뀜
          await store.setSetting(`hallfinal:${n}:${board}`, JSON.stringify(top.rows.map((r) => ({ rank: r.rank, igsid: r.igsid, username: r.username, score: r.score, n: r.n, rounds: r.rounds }))));
          await store.hallInsert(top.rows.filter((r) => r.rank <= 3).map((r) => ({ ...r, season: n, board })));
          try {
            await buildFinalAll(n, board, top.rows);
          } catch (e) {
            console.error('[hallfinalall]', e);
          }
        }
        // 🏆 시즌 보상 (2026-11-22): 위 100명에게 코인 + 다음 접속 때 팝업(1·2·3등은 한마디·사진 칸). 다른 인스턴스와 겹쳐도 한 번만(claimSetting)
        if (await store.claimSetting(`reward:done:${n}`, String(now))) {
          const BN = { stage: '🎵 단계 총합', endless: '💎 무제한 총합', tiles: '🎹 타일 총합' };
          const list = seasonRewards(boards).map((r) => ({
            igsid: r.igsid,
            coins: r.coins,
            gift: { coins: r.coins, note: `🏆 시즌 ${n} ${[{ board: r.board, rank: r.rank }, ...(r.also || [])].map((x) => `${BN[x.board]} ${x.rank}등`).join(' + ')} 보상이에요!`, hall: r.rank <= 3 ? { season: n, board: r.board, rank: r.rank } : null, reward: n, at: now },
          }));
          await store.giveCoinsMany(list);
        }
        await store.setSetting(flag, String(now));
        memo.delete('hall:list');
      }
      hallDone.add(n);
    }
  }
  // ---------------- 📉 D1 읽는 줄 아끼기 (2026-11-22: 하루 500만 줄 한도의 77%를 오전에 씀) ----------------
  //   무거운 결과(명예의 전당 전체 순위·admin 참여자 목록)는 settings 한 줄에 담아 두고 TTL 동안 같이 씀
  //   (읽기 1줄). 인스턴스 메모리에도 1분. 'set:cache:*' 키는 d1-sync 에서 뺌
  const memo = new Map();
  const FRIEND_MAX = 30; // 👥 친구 최대 (2026-11-28)
  // 📣 광고 통계의 '날' = 통계와 같은 시간대(한국)의 YYYY-MM-DD, 같은 이벤트 중복 막기
  //   ⚠ handle 을 돌려준 뒤에 있는 코드(api 쪽)에서 쓰는 const 는 초기화가 안 됨 → 반드시 return 앞에 둘 것
  const adDedupe = makeAdDedupe();
  const adDay = (ms) => new Date(ms + cfg.statsTzMin * 60000).toISOString().slice(0, 10);
  async function cached(key, ttlOrFn, fn, { shared = true } = {}) {
    const now = Date.now();
    // ttl 이 함수면 담긴 값을 보고 정함 (예: 명예의 전당은 계산할 때 읽은 줄 수에 맞춰 길게)
    const ttlFor = (v) => (typeof ttlOrFn === 'function' ? ttlOrFn(v) : ttlOrFn);
    let ttl = typeof ttlOrFn === 'function' ? 0 : ttlOrFn;
    if (memo.size > 3000) for (const [k, v] of memo) if (v.exp <= now) memo.delete(k);
    if (memo.size > 3000) memo.clear();
    const m = memo.get(key);
    if (m && m.exp > now) return m.v;
    if (shared) {
      try {
        const raw = await store.getSetting('cache:' + key);
        const c = raw ? JSON.parse(raw) : null;
        if (c && c.v !== undefined) ttl = ttlFor(c.v);
        // 만든 때(at)가 있으면 지금 ttl 로 판단 (브레이크 때 ttl 이 길어지면 예전 것도 그대로 씀)
        if (c && c.v !== undefined && (c.at ? c.at + ttl > now : c.exp > now)) {
          memo.set(key, { v: c.v, exp: Math.min(c.at ? c.at + ttl : c.exp, now + 60_000) });
          return c.v;
        }
      } catch {}
    }
    const v = await fn();
    ttl = ttlFor(v);
    memo.set(key, { v, exp: now + (shared ? Math.min(ttl, 60_000) : ttl) });
    if (shared) await Promise.resolve().then(() => store.setSetting('cache:' + key, JSON.stringify({ exp: now + ttl, at: now, v }))).catch(() => {});
    return v;
  }
  /** 같이 쓰는 기억 버리기 (메모리 + settings 한 줄 — 쓰기 1) */
  async function forget(key) {
    memo.delete(key);
    try {
      await store.setSetting('cache:' + key, '');
    } catch {}
  }
  // 참여자가 바뀌면(이름·인증·숨김·삭제·합치기) 이 인스턴스의 랭킹 기억만 버림 (메모리, D1 안 씀)
  for (const fn of ['upsertPlayer', 'setChecked', 'setHidden', 'deletePlayer', 'expireTempChecks', 'moveScores']) {
    const orig = store[fn];
    if (typeof orig !== 'function' || orig._forgets) continue;
    store[fn] = async function (...a) {
      const r = await orig.apply(this, a);
      for (const k of memo.keys()) if (k.startsWith('lb:') || k.startsWith('rank:')) memo.delete(k);
      // admin 참여자 목록 기억도 버림 (settings 한 줄 쓰기 — 가입·인증 때만이라 하루 백여 줄)
      await forget('admin:plist');
      return r;
    };
    store[fn]._forgets = true;
  }
  // 🏛 명예의 전당 (2026-11-22 다시 만듦, '사람이 많아져도 한도 안 차게'): 총합 순위는 기록 전체를 모아야 해서 무거움(지금 한 번에 3만 줄, 사람 따라 늘어남)
  //   → 6시간마다 한 번만 계산해 settings 한 줄에 '위 60명 + 위 1000명 점수 사다리'만 담음 (예전엔 전체 순위를 담아 사람이 늘면 한 줄 크기 한도 2MB 를 넘을 뻔)
  //   기록이 오르면(hallBump) 그 사람 총합만 새로 세서(18줄) 위 60명에 들 때만 그 줄을 고침 → 1~3등 바뀌는 건 바로 보임
  //   내 줄은 늘 새로 계산, 내 등수는 사다리로 (1000위 밖이면 '1000위 밖'). 쓰기는 위 60명이 바뀔 때만
  const HALL_TTL_BASE = 6 * 60 * 60 * 1000; // 브레이크 1단계부터 36시간
  const HALL_TOP = 60;
  const HALL_LADDER = 1000;
  const ttlOf = (base) => (brake() >= 1 ? base * 6 : base);
  const sortHall = (a, b) => b.score - a.score || a.at - b.at;
  const slimHall = (r) => ({ igsid: r.igsid, username: r.username, score: r.score, n: r.n, rounds: r.rounds, at: r.at });
  const hallKey = (n, board) => `hall2:${n}:${board}`;
  /** 시즌 총합: { top: 위 60명, ladder: 위 1000명 [점수, 시각], full: 1000명이 안 되면 true } — 6시간 캐시 */
  //   다시 계산은 기록 표 전체를 읽음 → 사람이 늘어 한 번에 읽는 줄(cost)이 커지면 그만큼 드물게: 두 판 합쳐 하루 25만 줄(읽기 한도 5%) 안
  const HALL_DAY_READS = 125_000;
  const hallTtl = (v) => ttlOf(Math.max(HALL_TTL_BASE, Math.min(7 * 86400_000, ((v && v.cost) || 0) * 86400_000 / HALL_DAY_READS)));
  const hallData = (n, board) =>
    cached(hallKey(n, board), hallTtl, async () => {
      const r0 = meter ? meter.r : 0;
      const rows = (await store.seasonBoard(n, board, HALL_LADDER)).rows;
      return { top: rows.slice(0, HALL_TOP).map(slimHall), ladder: rows.map((r) => [r.score, r.at]), full: rows.length < HALL_LADDER, cost: meter ? meter.r - r0 : 0 };
    });
  /** 내 줄(mineNow)을 끼운 위 순위 + 내 등수 { list, mine } */
  function hallMerge(data, mineNow, pl) {
    const list = (pl ? data.top.filter((r) => r.igsid !== pl.igsid) : data.top.slice()).slice();
    if (mineNow) list.push(mineNow);
    list.sort(sortHall);
    let mine = null;
    if (mineNow) {
      const i = list.indexOf(mineNow);
      if (i < HALL_TOP - 1 || list.length <= HALL_TOP) mine = { ...mineNow, rank: i + 1 };
      else {
        // 위 60명 밖: 사다리(마지막 계산 때 위 1000명 점수)에서 나보다 앞선 사람 수
        const ahead = data.ladder.filter(([sc, at]) => sc > mineNow.score || (sc === mineNow.score && at < mineNow.at)).length;
        mine = !data.full && ahead >= data.ladder.length ? { ...mineNow, rank: null, cap: HALL_LADDER } : { ...mineNow, rank: Math.max(ahead + 1, HALL_TOP) };
      }
    }
    return { list: list.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 })), mine };
  }
  /** 기록이 올랐을 때: 그 사람 시즌 총합만 새로 세서 위 60명에 들면 캐시 줄을 고침 (계산 주기는 그대로) */
  async function hallBump(igsid, board) {
    if (brake() >= 1) return;
    try {
      const n = seasonAt().n;
      const key = hallKey(n, board);
      const raw = await store.getSetting('cache:' + key);
      const c = raw ? JSON.parse(raw) : null;
      if (!c || !c.v || !Array.isArray(c.v.top)) return; // 아직 계산 전 → 다음 계산에 들어감
      const mine = await store.seasonMine(n, board, igsid);
      if (!mine) return;
      const top = c.v.top;
      const i = top.findIndex((r) => r.igsid === igsid);
      if (i >= 0 && top[i].score === mine.score) return;
      if (i < 0 && top.length >= HALL_TOP && sortHall(mine, top[top.length - 1]) >= 0) return; // 위 60명에 못 듦
      const next = top.filter((r) => r.igsid !== igsid).concat([slimHall(mine)]).sort(sortHall).slice(0, HALL_TOP);
      c.v = { ...c.v, top: next };
      memo.delete(key);
      await store.setSetting('cache:' + key, JSON.stringify(c));
    } catch (e) {
      console.error('[hall]', e);
    }
  }
  // 📋 단계별 랭킹 위 50명: 인스턴스마다 20초 (사람이 많아질수록 같은 랭킹을 계속 읽음, 한 번에 100줄쯤)
  //   (Cloudflare 캐시(caches.default)는 workers.dev 주소에선 아무 일도 안 해서 못 씀 — 11-22 확인)
  const boardOf = (level) => cached('lb:' + level, ttlOf(20_000), () => store.leaderboard(level, 50), { shared: false });
  /** 내 등수(50등 밖): 인스턴스마다 2분 (위 200명까지 세는 쿼리, 한 번에 수백 줄) */
  const myRank = (level, igsid) => cached(`rank:${level}:${igsid}`, 2 * 60_000, () => store.rankOf(level, igsid), { shared: false });
  /** 기록이 올랐으면 이 인스턴스의 그 랭킹·내 등수 기억은 버림 (다른 인스턴스는 20초·2분 안에 새로) */
  function boardChanged(level, igsid) {
    memo.delete('lb:' + level);
    memo.delete(`rank:${level}:${igsid}`);
  }
  /**
   * admin 참여자 목록 (2026-11-22): 참여자 표는 매번 새로(D1 수천 줄 — 인증·숨김이 바로 보임),
   *   점수 합계(점수 표 전체를 훑음)만 30분 기억. D1 이 아닌 저장소는 예전처럼 한 번에
   */
  async function adminPlayers() {
    if (typeof store.playerTotals !== 'function') return store.listPlayers();
    // 점수 합계는 기록 표 전체를 훑음 → 브레이크 1단계부터는 기억해 둔 것만 (없으면 0 으로)
    //   2026-11-27: 서버(인스턴스)마다 따로 기억해서 admin 을 열 때마다 기록 표 전체(2.7만 줄)를 또 읽었음 → settings 한 줄에 3시간 같이 씀
    const totalsOf = () => (brake() >= 1 && !memo.has('admin:totals') ? Promise.resolve({}) : cached('admin:totals', ttlOf(3 * 3600_000), () => store.playerTotals()));
    //   참여자 표도 10분 같이 씀 (2026-11-27: admin 을 열 때마다 6~7천 줄) — admin 에서 뭘 바꾸면 바로 버림
    const [list, totals] = await Promise.all([cached('admin:plist', 10 * 60_000, () => store.listPlayers(1_000_000, { totals: false })), totalsOf()]);
    return list.map((p) => ({ ...p, ...(totals[p.igsid] || { total: 0, levels: 0, top: 0, endless: null }) }));
  }

  const hallEntry = (r, pl) => ({ rank: r.rank, username: r.username, score: r.score, n: r.n, rounds: r.rounds, me: pl ? r.igsid === pl.igsid : false });
  const hallListCached = () => cached('hall:list', ttlOf(10 * 60 * 1000), async () => store.hallList(), { shared: false });

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
  // 🔑 랭킹은 카카오(·구글) 로그인한 계정만 (2026-11-27 사용자). 카카오 키가 없는 서버(시험·로컬)는 예전처럼
  const loginOn = () => !!(cfg.kakaoKey && cfg.kakaoSecret);
  const rankOk = (pl) => !loginOn() || !!(pl && (pl.kakao || pl.google));
  // 카카오로 처음 들어온 사람: 닉네임 정하기 전까지 카카오 회원번호 해시를 서명한 쿠키(kk_nw)에 잠깐 들고 있음
  const NEW_LOGIN_MS = 30 * 60 * 1000;
  const newLoginOf = (request) => {
    const v = unsign(cookiesOf(request).kk_nw || '', cfg.sessionSecret);
    return v && v.kid && OAUTH[v.pv] && Date.now() - v.t < NEW_LOGIN_MS ? v : null;
  };
  const meOf = (pl) => ({
    verified: false, guest: true, needsIg: !pl.ig && !pl.kakao && !pl.google, checked: isVerified(pl), confirmed: isConfirmed(pl), temp: !NO_PASSWORD && isConfirmed(pl) && pl.checkedAt < 0,
    hidden: pl.hiddenAt ? { deleteAt: pl.hiddenAt + HIDE_KEEP_MS } : null,
    player: { username: pl.username, ig: pl.ig, av: pl.av || null, intro: pl.intro || null },
    kakao: !!pl.kakao,
    google: !!pl.google,
    rank: rankOk(pl),
  });

  /** 🪙 요청에 얹혀 온 코인 받기 → 잔액(계정 없거나 인증 전이면 null = 폰이 다시 보냄) */
  async function takeCoins(pl, c) {
    if (!pl || !c || typeof c !== 'object' || !isConfirmed(pl)) return null;
    const w0 = await store.getWallet(pl.igsid);
    let { wallet, changed, rest } = applyCoins(w0, c, cfg.sessionSecret);
    // 🎁 시즌 2 출석·퀘스트 받기 (폰이 코인과 같이 얹어 보냄, 하루 한 번씩만) — 지갑 쓰기는 같은 한 줄
    let s2out = null;
    if (c.s2 && typeof c.s2 === 'object') {
      const r = applyS2(wallet, c.s2, (await s2Load()).community);
      wallet = r.wallet;
      changed = changed || r.changed;
      s2out = r.out;
    }
    if (changed) await store.putWallet(pl.igsid, wallet);
    const out = { coins: wallet.coins, gems: s2Of(wallet).gm || 0 };
    if (s2out) out.s2 = s2out;
    if (rest > 0) out.coinRest = rest;
    // 🧯 D1 쓰기가 많은 날(브레이크 1단계~)엔 폰이 다시 10분에 한 번 모아 보내게 (2026-11-23)
    if (brake() >= 1) out.coinSlow = 1;
    return out;
  }
  /**
   * 📴 서버 없을 때(DB 한도 초과 등) 친 판의 최고 기록 (2026-11-22): 폰이 모았다가 다음 판 시작·점수 등록에 얹어 보냄
   *   판 토큰이 없으니 콩 수·점수 상한·친 시각(36시간 안)만 봄. chk.off = 1 로 표시(핵 의심 화면에 보임)
   *   한 번에 OFFLINE_MAX 개까지 (쿼리 수 제한) → 받은 것·버린 것 키를 돌려줌, 나머지는 폰이 다음에
   */
  async function takeOffline(pl, list) {
    if (!pl || !isConfirmed(pl) || !rankOk(pl) || !Array.isArray(list)) return null;
    // 🗄 시즌 2 를 연 뒤엔 드럼 기록은 시즌 1 보관(scores_s1)으로 굳힘 → 받은 것으로만 치고 안 적음 (폰이 계속 안 보내게)
    if ((await s2Load()).open) return { done: list.slice(0, OFFLINE_MAX).map((e) => validateOffline(e, cfg, Date.now()).key).filter((k) => k != null), improved: 0 };
    const done = [];
    let up = 0;
    let bumpS = false;
    let bumpE = false;
    const now = Date.now();
    for (const e of list.slice(0, OFFLINE_MAX)) {
      const v = validateOffline(e, cfg, now);
      done.push(v.key);
      if (!v.ok) continue;
      if (!up) await ensureHall();
      const out = await store.recordScore(pl.igsid, v.slot, { score: v.score, grade: v.grade, maxCombo: v.maxCombo, chk: v.chk, at: v.at });
      if (!out) continue;
      if (out.improved) up++;
      const sn = seasonAt(v.at).n;
      if (sn > 1 && sn === seasonAt(now).n && (v.endless || (v.slot > 0 && v.slot <= LAST_LEVEL_ID))) await store.recordSeasonScore(sn, pl.igsid, v.slot, v.score);
      if (out.improved && v.endless) bumpE = true;
      else if (out.improved && v.slot > 0 && v.slot <= LAST_LEVEL_ID) bumpS = true;
    }
    if (bumpS) await hallBump(pl.igsid, 'stage');
    if (bumpE) await hallBump(pl.igsid, 'endless');
    return { done: done.filter((k) => k != null), improved: up };
  }
  /**
   * 🩹 11-22 13시~11-23 9시(KST) 서버가 쉬는 동안 친 기록 되살리기 (2026-11-23, 사용자 요청: 자동으로, 표시 없이)
   *   그때 폰이 기록을 저장도 안 하고 버렸음(main.js submitRank 버그) → 폰 '내 최고 기록'에 남은 그 시간 것을 얹어 보냄
   *   판 토큰·판정 개수가 없어서 단계·점수 상한·콤보 상한·친 시각만 봄. 한 번에 OFFLINE_MAX 개, 받은 키를 돌려줌
   */
  async function takeLost(pl, list) {
    if (!pl || !isConfirmed(pl) || !rankOk(pl) || !Array.isArray(list) || Date.now() > LOST_UNTIL) return null;
    const done = [];
    let bump = false;
    let hallReady = false;
    for (const e of list.slice(0, OFFLINE_MAX)) {
      const v = validateLost(e);
      done.push(v.key);
      if (!v.ok) continue;
      if (!hallReady) {
        await ensureHall();
        hallReady = true;
      }
      const out = await store.recordScore(pl.igsid, v.slot, { score: v.score, grade: v.grade, maxCombo: v.maxCombo, chk: null, at: v.at });
      if (!out || !out.improved) continue;
      boardChanged(v.slot, pl.igsid);
      if (v.slot > 0 && v.slot <= LAST_LEVEL_ID) bump = true;
    }
    if (bump) await hallBump(pl.igsid, 'stage');
    return { done: done.filter((k) => k != null) };
  }
  /** 내 지갑 { coins, owned } (인증 전이면 null) — 🛒 산 것도 같이 (폰을 바꿔도 그대로) */
  const walletOf = async (pl) => {
    if (!pl || !isConfirmed(pl)) return { coins: null, owned: undefined };
    let w = (await store.getWallet(pl.igsid)) || { coins: 0 };
    // 🛒 상점 개편(11-22 밤): 예전에 산 맵 배경·맵 드럼·색 콩은 이제 무료 → 값 돌려주고 알림 (한 번, 쓰기 2줄)
    const { refund, keep } = legacyRefund(w.owned);
    if (refund > 0) {
      const g0 = w.gift || null;
      const rn = '상점이 새로 바뀌어서, 예전에 산 꾸미기 값을 돌려드려요 (그건 이제 무료!)';
      const gift = { coins: refund + ((g0 && Number(g0.coins)) || 0), note: g0 && g0.note ? `${g0.note} + ${rn}` : rn, hall: (g0 && g0.hall) || null, at: Date.now() };
      await store.putWallet(pl.igsid, { ...w, owned: keep });
      await store.giveCoins(pl.igsid, refund, gift);
      w = { ...w, coins: (w.coins || 0) + refund, owned: keep, gift };
    }
    // 💎 예전에 얻은 다이아 한 번 넣기 (계정마다 읽기 1번·쓰기 1줄, 한도 브레이크 1단계부터는 미룸)
    if (!s2Of(w).gb && brake() < 1) {
      const r = gemBackfill(w, await store.scoresOf(pl.igsid));
      await store.putWallet(pl.igsid, { coins: 0, t: 0, tn: 0, fday: '', fn: 0, init: 0, owned: [], ...r.wallet });
      w = r.wallet;
    }
    const s2 = s2Of(w);
    return { coins: w.coins, gems: s2.gm || 0, gemSongs: s2.gs || {}, owned: cleanOwned(w.owned), ...(w.gift ? { gift: giftOut(w.gift) } : {}), ...(s2.ad ? { att: { day: s2.ad, streak: s2.as } } : {}) };
  };
  // 🎹 시즌 2 (2026-11-26): 운영자가 admin 에서 열기 전엔 미리보기(?s2=okay 기기)만 — 그동안 타일 기록은 랭킹에 안 올림
  //   커뮤니티 퀘스트(팔로워 2천 등)는 admin 에서 숫자·달성 처리. 인스턴스마다 1분 기억
  let s2Cache = { at: 0, open: false, community: COMMUNITY_DEFAULT };
  async function s2Load(fresh = false) {
    const now = Date.now();
    if (fresh || now - s2Cache.at > 60 * 1000) {
      let community = COMMUNITY_DEFAULT;
      try {
        const raw = await store.getSetting('s2Community');
        if (raw) community = cleanCommunity(JSON.parse(raw)) || COMMUNITY_DEFAULT;
      } catch {}
      s2Cache = { at: now, open: (await store.getSetting('s2Open')) === 'open', community };
    }
    return s2Cache;
  }
  const s2Public = async () => {
    const c = await s2Load();
    return { s2Open: c.open, s2Community: c.community };
  };
  /** 🛒 상점 열림 (2026-11-24 사용자 '상점 오픈' → 기본 열림, admin 에서 닫으면 'closed'). 인스턴스마다 1분 기억 */
  let shopCache = { at: 0, open: true, only: [] };
  async function shopLoad(fresh) {
    const now = Date.now();
    if (fresh || now - shopCache.at > 60 * 1000) {
      // shopOpenFor = 쉼표로 나눈 igsid — 상점이 닫혀 있어도 그 계정만 삼 (운영자 시험용, 2026-11-23)
      const only = String((await store.getSetting('shopOpenFor')) || '').split(',').map((x) => x.trim()).filter(Boolean);
      shopCache = { at: now, open: (await store.getSetting('shopOpen')) !== 'closed', only };
    }
    return shopCache;
  }
  async function shopOpen(fresh = false, pl = null) {
    const c = await shopLoad(fresh);
    return c.open || !!(pl && c.only.includes(pl.igsid));
  }
  /** 🎁 폰에 보낼 선물 알림 (명예의 전당 칸이면 한마디 칸 정보도) */
  const giftOut = (g) => ({ coins: Number(g.coins) || 0, note: g.note || '', hall: g.hall || null });

  // 대결 방: 4단계부터는 혼자 칠 때와 같은 잠금 (팔로워 인증 완료한 사람만)
  const ranked = createRankedHandler({ store, getPlayer: (request) => getPlayer(request), isConfirmed: (pl) => !!pl && (cfg.gateMode === 'open' || isConfirmed(pl)) });
  const handleRoom = createRoomHandler({
    store,
    ranked,
    getPlayer: (request) => getPlayer(request),
    isConfirmed: (pl) => cfg.gateMode === 'open' || isConfirmed(pl),
    canPlay: async (levelId, pl) => (cfg.gateMode !== 'open' && (tileSong(levelId) ? tileClosed(tileSong(levelId)) : isClosed(levelId)) && !isConfirmed(pl) && !(await openNow()) ? (isVerified(pl) ? 'confirm_pending' : 'confirm_required') : null),
  });

  // 🧯 DB 가 막혔을 때(D1 하루 한도 초과 등, 2026-11-22): 5분 동안 DB 를 안 건드리고 바로 503 db_down
  //   → 폰은 서버 없는 모드로 바뀌고(인증했던 폰은 4단계부터 그대로, 기록·코인은 폰에), 몇 분마다 다시 붙어 봄
  let dbDownUntil = 0;
  const DB_DOWN_MS = 5 * 60 * 1000;
  // 🧯 한도 브레이크: usage = 마지막으로 합친 오늘 합계, meter = 이 인스턴스가 아직 안 보낸 몫
  let usage = { day: '', r: 0, w: 0, q: 0 };
  let usageAt = 0;
  // 🕵 판 수 세기(level_tries)는 판마다 쓰지 않고 인스턴스에 모았다가 몇 분마다 한 번에 (같은 사람·단계를 여러 판 = 1줄)
  //   (예전엔 4단계부터 판 시작·깸마다 D1 쓰기 1줄 → 하루 1만 줄 넘게. 인스턴스가 사라지면 몇 판 덜 셀 수 있음 — 대략 보는 값)
  const tryBuf = new Map();
  let tryAt = 0;
  function noteTry(igsid, level, starts, clears) {
    const k = igsid + '|' + level;
    const t = tryBuf.get(k) || { igsid, level, starts: 0, clears: 0, at: 0 };
    t.starts += starts;
    t.clears += clears;
    t.at = Date.now();
    tryBuf.set(k, t);
  }
  /**
   * 🎟 다음 판 토큰 (2026-11-22 저녁): 점수를 올린 응답에 '같은 단계·다음 단계' 판 토큰을 미리 실어 줌
   *   → 깬 뒤 바로 다시·다음 판은 폰이 /api/runs 를 안 부름 (Worker 요청의 3할이 /api/runs). 폰은 10분 안에 하나만 씀
   *   그 판 시작은 폰이 다음 요청에 pre:[단계] 로 알려 줌 → 판 수 세기
   */
  function nextTokens(levels) {
    const out = {};
    let i = 0;
    for (const id of levels) {
      if (id == null || out[id]) continue;
      // 시각을 1ms 씩 달리 (코인은 판 토큰 시각으로 판을 구분함)
      out[id] = sign({ l: id, t: Date.now() - i++, n: newId() }, cfg.sessionSecret);
    }
    return out;
  }
  const preList = (body) => (Array.isArray(body && body.pre) ? body.pre.slice(0, 20) : []);
  function notePre(pl, body) {
    if (!pl || brake() >= 1) return;
    for (const k of preList(body)) {
      const id = Number(k);
      if (Number.isInteger(id) && id > 0 && getLevel(id)) noteTry(pl.igsid, id, 1, 0);
    }
  }
  async function flushTries() {
    if (!tryBuf.size) return;
    const list = [...tryBuf.values()].slice(0, 200);
    for (const t of list) tryBuf.delete(t.igsid + '|' + t.level);
    tryAt = Date.now();
    try {
      if (typeof store.addTries === 'function') await store.addTries(list);
      else for (const t of list) await store.addTry(t.igsid, t.level, t.starts, t.clears, t.at);
    } catch (e) {
      console.error('[tries]', e);
    }
  }
  async function flushUsage(now) {
    if (tryBuf.size && (now - tryAt >= USAGE_FLUSH_MS || tryBuf.size >= 100 || !meter)) await flushTries();
    if (!meter || typeof store.usageAdd !== 'function') return;
    const day = utcDay(now);
    const big = meter.q >= 100 || meter.r >= 20000 || meter.w >= 300;
    if (usage.day === day && !big && now - usageAt < USAGE_FLUSH_MS) return;
    usageAt = now;
    const add = { r: meter.r, w: meter.w, q: meter.q };
    meter.r -= add.r;
    meter.w -= add.w;
    meter.q -= add.q;
    try {
      usage = { day, ...(await store.usageAdd(day, add)) };
    } catch {
      meter.r += add.r;
      meter.w += add.w;
      meter.q += add.q;
    }
  }
  /** 지금 브레이크 단계 0~3 */
  function brake(now = Date.now()) {
    const same = usage.day === utcDay(now);
    const m = meter || { r: 0, w: 0, q: 0 };
    const f = Math.max(
      ((same ? usage.r : 0) + m.r) / USAGE_LIMITS.r,
      ((same ? usage.w : 0) + m.w) / USAGE_LIMITS.w,
      ((same ? usage.q : 0) + m.q) / USAGE_LIMITS.q
    );
    return f >= BRAKE_AT[2] ? 3 : f >= BRAKE_AT[1] ? 2 : f >= BRAKE_AT[0] ? 1 : 0;
  }
  // 폰이 다시 물어볼 때까지 기다릴 시각 (api.js noteServerDown 이 최대 30분으로 자름). 하루 한도면 다음 UTC 0시(한국 오전 9시)
  const nextUtcDay = () => Math.ceil((Date.now() + 1) / 86400000) * 86400000 + 60 * 1000;
  const isLimitError = (e) => /exceed|limit|quota/i.test(String((e && e.message) || e));
  let downUntilHint = 0;
  const isDbError = (e) => !e.status && /D1_|SQLITE|exceed|limit|quota|too many|database|neon|fetch failed|network/i.test(String((e && e.message) || e));

  return async function handle(request, { ip = '?' } = {}) {
    const url = new URL(request.url);
    const setCookies = [];
    try {
      request._setCookies = setCookies;
    } catch {}
    if (meter) meter.q++;
    const adminUsage = url.pathname === '/api/admin/usage';
    if (url.pathname.startsWith('/api/') && !(adminUsage && Date.now() < dbDownUntil)) await flushUsage(Date.now());
    // 🧯 3단계: 한도 직전 → 일부러 db_down (운영자 화면은 그대로)
    if (brake() >= 3 && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/')) {
      return new Response(JSON.stringify({ error: 'db_down', brake: 3, until: nextUtcDay() }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    // DB 가 쉬는 동안: admin 사용량만 받아서 '쉬는 중' 표시 (관리자 화면 로그인이 되게)
    if (Date.now() < dbDownUntil && adminUsage && isAdmin(request)) {
      return new Response(JSON.stringify({ dbDown: true, retryAfter: Math.ceil((dbDownUntil - Date.now()) / 1000), metered: !!meter }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    if (Date.now() < dbDownUntil && url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'db_down', retryAfter: Math.ceil((dbDownUntil - Date.now()) / 1000), until: Math.max(dbDownUntil, downUntilHint) }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const json = (status, data, extra = {}) => {
      const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
      for (const c of setCookies) h.append('Set-Cookie', c);
      // 🔑 로그인 열쇠를 폰 저장소에도 (쿠키가 날아가는 폰용, 2026-11-25): 새로 준 쿠키 · 쿠키↔헤더 한쪽만 있던 열쇠를 X-Player 로 돌려줌
      const tok = playerTokOut(request, setCookies);
      if (tok !== null) h.set('X-Player', tok);
      return new Response(JSON.stringify(data), { status, headers: h });
    };
    const text = (status, body = '') => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, url, ip, json, setCookies);
      return text(404, 'not found');
    } catch (e) {
      if (!e.status) console.error(e);
      if (isDbError(e)) {
        dbDownUntil = Date.now() + DB_DOWN_MS;
        downUntilHint = isLimitError(e) ? nextUtcDay() : 0;
        return json(503, { error: 'db_down', until: Math.max(dbDownUntil, downUntilHint) });
      }
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

  // 🔑 로그인 열쇠: 쿠키가 먼저, 없으면 폰 저장소에 둔 것(X-Player 헤더). 2026-11-25 들어올 때마다 쿠키가 날아가
  //   새 계정이 생기던 폰(빨대 ncgjsi, 계정 5개) → 폰 저장소(localStorage)는 남아 있어서 거기에도 둠
  function playerRaw(request) {
    const c = cookiesOf(request)[PLAYER_COOKIE] || '';
    const hd = String(request.headers.get('x-player') || '');
    const raw = c && unsign(c, cfg.sessionSecret) ? c : hd && hd.length < 400 && unsign(hd, cfg.sessionSecret) ? hd : '';
    return { raw, c, hd };
  }
  function playerTokOut(request, setCookies) {
    // 이번 응답에서 새 쿠키를 줬으면 그 값(지울 땐 '-')
    for (let i = setCookies.length - 1; i >= 0; i--) {
      const m = setCookies[i].match(new RegExp('^' + PLAYER_COOKIE + '=([^;]*)'));
      if (m) return m[1] ? decodeURIComponent(m[1]) : '-';
    }
    const seen = playerSeen.get(request);
    if (!seen) return null;
    // 폰 저장소에 없거나 다르면 알려 줌 (쿠키만 있던 폰도 저장소에 하나 갖게)
    return seen.hd !== seen.raw ? seen.raw : null;
  }
  // 🔑 같은 인스타 아이디 + 같은 닉네임(대소문자·띄어쓰기 무시) + 랭킹 기록이 있는 예전 계정 (색인 players_ig)
  async function sameOldAccount(ig, name) {
    if (!ig || !name) return null;
    const key = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();
    return (await store.playersByIg(ig)).find((o) => o.scores > 0 && key(o.username) === key(name)) || null;
  }
  // 🪙 계정 합칠 때 지갑도 (2026-11-25: 예전엔 점수만 옮기고 새 계정 코인은 버려졌음) — 코인 더하고 산 것 합침
  async function moveWallet(from, to) {
    if (from === to || !store.getWallet) return;
    const a = await store.getWallet(from);
    const ag = (a && s2Of(a).gm) || 0; // 💎 다이아도 같이
    if (!a || (!a.coins && !ag && !(a.owned && a.owned.length))) return;
    const b = (await store.getWallet(to)) || { coins: 0, t: 0, tn: 0, fday: '', fn: 0, init: 0, owned: [] };
    const owned = [...new Set([...(b.owned || []), ...(a.owned || [])])];
    const later = (a.t || 0) > (b.t || 0);
    const bs2 = s2Of(b);
    await store.putWallet(to, { ...b, coins: (b.coins || 0) + (a.coins || 0), t: later ? a.t : b.t, tn: later ? a.tn : b.tn, init: Math.max(a.init || 0, b.init || 0), owned, ...(ag ? { s2: { ...bs2, gm: (bs2.gm || 0) + ag } } : {}) });
    await store.putWallet(from, { coins: 0, t: a.t || 0, tn: a.tn || 0, fday: a.fday || '', fn: a.fn || 0, init: a.init || 0, owned: [], ...(ag ? { s2: { ...s2Of(a), gm: 0 } } : {}) });
  }
  async function getPlayer(request) {
    const { raw, c, hd } = playerRaw(request);
    const p = raw ? unsign(raw, cfg.sessionSecret) : null;
    if (!p || !p.igsid) return null;
    let rec = await store.getPlayer(p.igsid);
    // 🔗 합쳐서 지운 계정(2026-11-25 중복 계정 합치기) → 남긴 계정으로 이어 주고 새 열쇠를 줌. 없는 계정일 때만 읽기 1번
    if (!rec && store.getSetting) {
      const to = await store.getSetting('alias:' + p.igsid);
      const rec2 = to ? await store.getPlayer(to) : null;
      if (rec2 && rec2.username) {
        rec = rec2;
        if (request._setCookies) request._setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid: rec2.igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
        return { igsid: rec.igsid, username: rec.username, ig: rec.ig || null, hiddenAt: rec.hiddenAt || null, checkedAt: rec.checkedAt || null, kakao: !!rec.kakao, google: !!rec.google, av: rec.av || null, intro: rec.intro || null };
      }
    }
    if (rec && rec.username) {
      playerSeen.set(request, { raw, hd });
      // 쿠키가 날아간 폰: 헤더로 왔으면 쿠키를 다시 줌
      if (c !== raw && request._setCookies) request._setCookies.push(cookie(PLAYER_COOKIE, raw, { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
    }
    return rec && rec.username ? { igsid: rec.igsid, username: rec.username, ig: rec.ig || null, hiddenAt: rec.hiddenAt || null, checkedAt: rec.checkedAt || null, kakao: !!rec.kakao, google: !!rec.google, av: rec.av || null, intro: rec.intro || null } : null;
  }

  // ------------------- API -------------------
  /** 이용 통계 저장 (/api/track, 또는 /api/runs·/api/scores 에 얹혀 온 것). 형식이 틀리면 false */
  /**
   * 📊 통계 표본 (2026-11-22 저녁, '사람이 많아져도 무료 안에서'): 통계(접속·판)는 판마다 D1 쓰기 1~2줄로 쓰기 한도의 큰 몫
   *   → 오늘 쓴 양이 많을수록 방문자 일부만 적고 그 줄을 배로 셈 (방문자 번호로 고르니 한 사람의 접속·판은 같이 들어가거나 같이 빠짐)
   *   쓰기 15% 전 = 다, 25% 전 = 1/2, 브레이크 1단계(40%) 전 = 1/4, 그 뒤 = 안 적음. D1 이 아닌 저장소(Neon·JSON)는 늘 다
   */
  function statsRate() {
    if (!store.statsSampled || !meter) return 1;
    if (brake() >= 1) return 0;
    const same = usage.day === utcDay(Date.now());
    const f = ((same ? usage.w : 0) + meter.w) / USAGE_LIMITS.w;
    return f < 0.15 ? 1 : f < 0.25 ? 2 : 4;
  }
  function vidBucket(vid) {
    let h = 0;
    for (let i = 0; i < vid.length; i++) h = (Math.imul(h, 31) + vid.charCodeAt(i)) >>> 0;
    return h;
  }
  async function saveTrack(request, raw, setCookies) {
    const t = cleanTrack(raw);
    if (!t) return false;
    let vid = cookiesOf(request)[VID_COOKIE];
    let fresh = false; // 처음 온 방문자 (방문자 쿠키가 없음) → 통계 '새 방문자'
    if (!/^[A-Za-z0-9_-]{16,32}$/.test(vid || '')) {
      fresh = true;
      vid = newId();
      setCookies.push(cookie(VID_COOKIE, vid, { maxAge: VID_MAX_AGE, secure: cfg.cookieSecure }));
    }
    const now = Date.now();
    // 📣 광고 노출 (광고주에게 줄 숫자라 통계 표본과 상관없이 다 적음. 한도 브레이크 2단계부터만 쉼)
    if (t.ads.length && brake() < 2) {
      const rows = foldAds(adDedupe(vid, t.ads));
      if (rows.length) await Promise.resolve().then(() => store.trackAds({ vid, day: adDay(now), rows, now })).catch(() => {});
    }
    const w = statsRate();
    if (!w || (w > 1 && vidBucket(vid) % w !== 0)) return 'skip'; // 표본 밖 (쿠키는 그대로 줌)
    // 접속 + 판들을 동시에 (판은 한 문장으로 묶음)
    const plays = t.plays.map((e) =>
      e.ev === 'start'
        ? { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now, w }
        : { id: e.id, sid: t.sid, vid, level: e.level, mode: e.mode, startedAt: now - e.sec * 1000, endedAt: now, result: e.result, score: e.score, stars: e.stars, sec: e.sec, w }
    );
    await Promise.all([
      store.trackSession({ sid: t.sid, vid, now, activeSec: t.activeSec, ref: t.ref, device: t.device, st: t.st, fresh, w }),
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
        config: { gateMode: cfg.gateMode, instagramHandle: cfg.instagramHandle, siteUrl: cfg.siteUrl, freePassUntil: (await freePassOn()) ? await freePassUntil() : 0, shopOpen: await shopOpen(false, pl), ...(await s2Public()), kakao: !!(cfg.kakaoKey && cfg.kakaoSecret), google: !!(cfg.googleKey && cfg.googleSecret) },
        me: pl ? { ...meOf(pl), ...(await walletOf(pl)) } : { verified: false },
      });
    }

    if (p === '/api/config' && m === 'GET') {
      return json(200, {
        gateMode: cfg.gateMode,
        instagramHandle: cfg.instagramHandle,
        siteUrl: cfg.siteUrl,
        freePassUntil: (await freePassOn()) ? await freePassUntil() : 0,
        shopOpen: await shopOpen(),
        ...(await s2Public()),
        kakao: !!(cfg.kakaoKey && cfg.kakaoSecret),
        google: !!(cfg.googleKey && cfg.googleSecret),
      });
    }

    // 랭킹 닉네임이 있으면 guest:true (인스타 아이디 인증은 없어짐)
    // 📦 내 기록 되받기 (2026-11-27): 브라우저를 바꾸고 로그인하면 곡 목록 결과(단계·무제한·타일)가 비어 보이던 것
    //   폰이 계정마다·브라우저마다 한 번만 부름 (scores 한 사람 줄만 읽음)
    if (p === '/api/my-bests' && m === 'GET') {
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const rows = await store.scoresOf(pl.igsid);
      return json(200, { bests: bestsFromScores(rows.filter((r) => !isTileSlot(r.level))), tiles: tileBestsFromScores(rows) });
    }

    if (p === '/api/me' && m === 'GET') {
      await expireTempMaybe();
      const pl = await getPlayer(request);
      if (!pl) return json(200, { verified: false });
      await purgeMaybe();
      const wal = await walletOf(pl);
      // hidden: 운영자가 팔로우 확인이 안 돼서 랭킹에서 내림 → 화면에 알리고 아이디를 다시 받음. deleteAt 에 지워짐
      // checked: 인증 신청함(아이디 적음) → 9·12단계 · 그리그 무제한이 열림
      // confirmed: 운영자가 팔로우를 확인함(인증 완료) → 13·14단계 · 단계별 무제한까지 열림
      return json(200, { ...meOf(pl), ...wal });
    }

    // 🔑 카카오·구글 로그인 (2026-11-26): 폰이 POST 로 주소를 받아 그리로 이동 (지금 계정은 쿠키·폰 저장소 열쇠로 알아봄)
    //   kk_ks 쿠키 = 서명한 { n, igsid(연결할 계정), mode, pv } → 돌아왔을 때 state 의 n 과 맞아야 함 (같은 브라우저에서 시작한 것만)
    const oa = /^\/api\/auth\/(kakao|google)\/(start|callback)$/.exec(p);
    if (oa) {
      const pv = oa[1];
      const P = OAUTH[pv];
      const key = cfg[pv + 'Key'];
      const secret = cfg[pv + 'Secret'];
      const redirectUri = `${url.origin}/api/auth/${pv}/callback`;
      if (oa[2] === 'start' && m === 'POST') {
        if (!key || !secret) return json(404, { error: pv + '_off' });
        if (!limitGuest(ip)) return json(429, { error: 'rate_limited' });
        const b = await readJson(request);
        const mode = b.mode === 'link' ? 'link' : 'login';
        const pl = await getPlayer(request);
        if (mode === 'link' && !pl) return json(401, { error: 'verify_required' });
        const n = newId();
        const now = Date.now();
        setCookies.push(cookie('kk_ks', sign({ n, igsid: pl ? pl.igsid : null, mode, pv, t: now }, cfg.sessionSecret), { maxAge: Math.floor(KAKAO_STATE_MS / 1000), secure: cfg.cookieSecure }));
        const state = sign({ n, t: now }, cfg.sessionSecret);
        return json(200, { url: P.authUrl({ key, redirectUri, state }) });
      }
      if (oa[2] === 'callback' && m === 'GET') {
        const back = (r) => {
          setCookies.push(cookie('kk_ks', '', { maxAge: 0, secure: cfg.cookieSecure }));
          const h = new Headers({ Location: `/?${pv}=${r}`, 'Cache-Control': 'no-store' });
          for (const c of setCookies) h.append('Set-Cookie', c);
          return new Response(null, { status: 302, headers: h });
        };
        if (!key || !secret) return back('off');
        if (url.searchParams.get('error')) return back('cancel');
        const st = unsign(url.searchParams.get('state') || '', cfg.sessionSecret);
        const ks = unsign(cookiesOf(request).kk_ks || '', cfg.sessionSecret);
        if (!st || !ks || !st.n || st.n !== ks.n || (ks.pv || 'kakao') !== pv || Date.now() - st.t > KAKAO_STATE_MS) return back('expired');
        let kid;
        try {
          kid = P.hash(await P.userId({ key, secret, redirectUri, code: url.searchParams.get('code') || '' }), cfg.sessionSecret);
        } catch (e) {
          console.error('[' + pv + ']', e && e.message);
          return back('fail');
        }
        let owner = await P.byId(kid);
        // 🔗 (11-27) 이 폰의 예전 계정(이 로그인 없음)으로 왔는데 이 카카오가 다른 계정에 붙어 있음
        //   = 다른 브라우저·앱에서 먼저 카카오로 새로 시작한 같은 사람 → 하나로 합침 (지금 폰 계정을 남기고, 그쪽 기록·코인을 옮김)
        //   두 계정 열쇠(이 폰 쿠키 + 카카오)를 다 가진 사람만 여기 옴. 남기는 건 먼저 만든 계정(닉네임·명예의 전당·유저 맵 그대로)
        const cur = owner && ks.igsid && owner !== ks.igsid ? await store.getPlayer(ks.igsid) : null;
        if (cur && cur.username && !(await P.of(ks.igsid))) {
          const own = await store.getPlayer(owner);
          const keepCur = !own || (cur.createdAt || 0) <= (own.createdAt || 0);
          const keep = keepCur ? ks.igsid : owner;
          const drop = keepCur ? owner : ks.igsid;
          await store.moveScores(drop, keep);
          await moveWallet(drop, keep);
          await store.deletePlayer(drop);
          if (store.setSetting) await store.setSetting('alias:' + drop, keep);
          if (keepCur) await P.set(keep, kid);
          setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid: keep, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
          return back('merged');
        }
        const loginAs = (igsid) => setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
        if (ks.mode === 'link') {
          if (owner && owner !== ks.igsid) return back('taken');
          if (!owner) await P.set(ks.igsid, kid);
          return back('linked');
        }
        if (owner) {
          loginAs(owner);
          return back('login');
        }
        // 연결된 계정이 없음: 지금 이 폰 계정에 이 로그인이 없으면 연결해 줌
        if (ks.igsid && !(await P.of(ks.igsid))) {
          await P.set(ks.igsid, kid);
          return back('linked');
        }
        // 🔑 처음 온 사람 (2026-11-27): 닉네임만 정하면 이 카카오로 새 계정 → 폰이 닉네임 창을 엶 (/api/guest 가 kk_nw 를 보고 연결)
        setCookies.push(cookie('kk_nw', sign({ kid, pv, t: Date.now() }, cfg.sessionSecret), { maxAge: Math.floor(NEW_LOGIN_MS / 1000), secure: cfg.cookieSecure }));
        return back('new');
      }
    }
    if (p === '/api/logout' && m === 'POST') {
      setCookies.push(cookie(PLAYER_COOKIE, '', { maxAge: 0, secure: cfg.cookieSecure }));
      return json(200, { ok: true });
    }

    // 랭킹용 닉네임 + 인스타 아이디. 이미 있으면 새 이름/아이디로 바꿈 (기록은 그대로)
    //   인스타 아이디는 운영자가 팔로우했는지 직접 확인하는 데만 쓰고, 랭킹에는 안 보임.
    //   (처음 만드는 사람은 꼭 필요. 예전에 아이디 없이 참여한 사람은 한 번 채워 넣으면 됨)
    // 🙂 프로필 이미지 바꾸기 (2026-11-27): { av } → 내 정보. 쓰기 1줄
    if (p === '/api/avatar' && m === 'POST') {
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'no_player' });
      const body = await readJson(request);
      const av = cleanAvatar(body.av);
      if (!av) return json(400, { error: 'bad_avatar' });
      const rec = (await store.upsertPlayer(pl.igsid, { av })) || { ...pl, av };
      return json(200, meOf({ ...pl, av: rec.av || av }));
    }

    // 📝 자기소개 저장 (2026-11-27, 내 프로필 「소개」 탭) — intro: null 이면 지움
    if (p === '/api/intro' && m === 'POST') {
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'no_player' });
      const body = await readJson(request);
      const intro = cleanIntro(body.intro);
      await store.setIntro(pl.igsid, intro);
      return json(200, meOf({ ...pl, intro }));
    }

    // 🙂👥 남의 프로필 보기 · 친구 (2026-11-28 사용자 '프로필 누르면 그 사람 프로필 · 친구 추가, 무료 용량 많이 먹으면 하지 마')
    //   igsid 는 폰에 안 보냄 → 랭킹 화면에서 본 판(b = tiles 또는 곡 t3)과 닉네임(u)으로, 그 판 위 50명(이미 기억해 둔 것)에서 찾음
    //   친구 목록 = settings 한 줄 `fr:<igsid>` (JSON igsid 배열, 최대 30명) — 새 표 없음, 추가·끊기 때만 쓰기 1줄
    //   읽기: 프로필 = 그 사람 타일 기록 줄(곡 수만큼)·5분 기억 / 친구 탭 = 친구들 타일 기록 줄을 쿼리 1번·3분 기억
    if ((p === '/api/profile' && m === 'GET') || (p === '/api/friends' && (m === 'GET' || m === 'POST'))) {
      const pl = await getPlayer(request);
      const season = seasonAt();
      const frKey = (id) => 'fr:' + id;
      const frList = async (id) => {
        const mm = memo.get(frKey(id));
        if (mm && mm.exp > Date.now()) return mm.v;
        let v = [];
        try {
          const raw = await store.getSetting(frKey(id));
          const a = raw ? JSON.parse(raw) : [];
          v = Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, FRIEND_MAX) : [];
        } catch {}
        memo.set(frKey(id), { v, exp: Date.now() + 60_000 });
        return v;
      };
      /** 랭킹 판에서 닉네임으로 그 사람 igsid 찾기 */
      const findOn = async (b, u) => {
        u = String(u || '').slice(0, 40);
        if (!u) return null;
        if (pl && pl.username === u) return pl.igsid;
        if (b === 'tiles') {
          const d = await hallData(season.n, 'tiles');
          const r = d.top.find((x) => x.username === u);
          return r ? r.igsid : null;
        }
        const t = tileSong(b);
        if (!t) return null;
        const lb = await boardOf(tileSlot(t.id));
        const r = lb.rows.find((x) => x.username === u);
        return r ? r.igsid : null;
      };
      /** 시즌 2 타일 총합 등수 (위 60명 + 1000명 사다리, 이미 기억해 둔 것) */
      const rankOfCard = async (c) => {
        if (!c || !c.score) return null;
        const { mine } = hallMerge(await hallData(season.n, 'tiles'), { igsid: c.igsid, username: c.username, score: c.score, n: c.n, rounds: 0, at: c.at }, { igsid: c.igsid });
        return mine ? mine.rank || (mine.cap ? `${mine.cap}+` : null) : null;
      };
      const cardOut = async (c, mine) => ({ username: c.username, av: c.av || null, intro: c.intro || null, score: c.score, n: c.n, rank: await rankOfCard(c), friend: mine ? mine.includes(c.igsid) : false, me: pl ? c.igsid === pl.igsid : false });
      const cardOf = (id) => cached('prof:' + id, ttlOf(5 * 60_000), async () => (await store.friendCards(season.n, [id]))[0] || null, { shared: false });

      if (p === '/api/profile') {
        const id = await findOn(url.searchParams.get('b'), url.searchParams.get('u'));
        const c = id ? await cardOf(id) : null;
        if (!c) return json(404, { error: 'not_found' });
        return json(200, { p: await cardOut(c, pl ? await frList(pl.igsid) : null) });
      }
      if (!pl) return json(401, { error: 'no_player' });
      let mine = await frList(pl.igsid);
      if (m === 'POST') {
        const body = await readJson(request);
        let next = mine;
        if (body.add) {
          const id = await findOn(body.add.b, body.add.u);
          if (!id) return json(404, { error: 'not_found' });
          if (id === pl.igsid) return json(400, { error: 'self' });
          if (!mine.includes(id)) {
            if (mine.length >= FRIEND_MAX) return json(400, { error: 'full', max: FRIEND_MAX });
            next = mine.concat([id]);
          }
        } else if (body.del != null) {
          // 끊기는 내 친구 목록 자리(i) + 닉네임으로 (igsid 를 폰에 안 보내서)
          const i = Number(body.del);
          const cards = await cached('frc:' + pl.igsid, ttlOf(3 * 60_000), () => store.friendCards(season.n, mine), { shared: false });
          const hit = cards.find((c) => c.username === String(body.u || '')) || (Number.isInteger(i) ? cards[i] : null);
          if (hit) next = mine.filter((x) => x !== hit.igsid);
        } else return json(400, { error: 'bad' });
        if (next !== mine) {
          await store.setSetting(frKey(pl.igsid), JSON.stringify(next));
          memo.set(frKey(pl.igsid), { v: next, exp: Date.now() + 60_000 });
          memo.delete('frc:' + pl.igsid);
          mine = next;
        }
        if (!body.list) return json(200, { ok: true, friend: !!body.add, count: mine.length });
      }
      // 친구 목록 (+ 나) — 점수 순
      const cards = await cached('frc:' + pl.igsid, ttlOf(3 * 60_000), () => store.friendCards(season.n, mine.concat([pl.igsid])), { shared: false });
      const list = [];
      for (const c of cards.filter((c) => c.igsid === pl.igsid || mine.includes(c.igsid))) list.push(await cardOut(c, mine));
      list.sort((a, b) => b.score - a.score);
      return json(200, { list, max: FRIEND_MAX });
    }

    if (p === '/api/guest' && m === 'POST') {
      if (!limitGuest(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const name = cleanNickname(body.name);
      if (!name) return json(400, { error: 'bad_name' });
      const pl0 = await getPlayer(request);
      const nw = newLoginOf(request);
      // 카카오로 처음 온 사람: 지금 폰 계정에 이미 이 로그인이 있으면(다른 카카오) 새 계정으로
      const pl = nw && pl0 && pl0[nw.pv] ? null : pl0;
      const ig = cleanInstagram(body.ig);
      // 🔑 카카오 로그인을 켠 뒤(11-27): 새 계정은 카카오(·구글) 로그인으로만 · 인스타 아이디는 안 받아도 됨
      if (!pl && !nw && loginOn()) return json(403, { error: 'login_required' });
      if (!ig && !(pl && pl.ig) && !nw) return json(400, { error: 'bad_ig' });
      // 🔑 같은 아이디·닉네임의 예전 계정이 있으면 새로 만들지 않고 알려 줌 → 폰이 '팔로워 암호로 이어가기 / 새로 시작' (2026-11-25)
      if (OLD_ASK && !pl && body.fresh !== true) {
        const o = await sameOldAccount(ig, name);
        if (o) return json(409, { error: 'old_account', username: o.username });
      }
      const igsid = pl ? pl.igsid : 'g_' + newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
      let rec = await store.upsertPlayer(igsid, { username: name, ig, av: cleanAvatar(body.av) });
      // 🔓 암호를 없앤 뒤(11-26): 이용 등록·아이디 바꾸기 = 바로 인증 완료 (예전엔 아이디를 바꾸면 암호로 다시 인증)
      if (NO_PASSWORD && rec && !rec.checkedAt && (await store.setChecked(igsid, true))) rec = await store.getPlayer(igsid);
      if (nw) {
        const P = OAUTH[nw.pv];
        // 그 사이 다른 계정에 붙었으면(다른 창에서 먼저) 안 붙임
        if (!(await P.byId(nw.kid)) && !(await P.of(igsid))) await P.set(igsid, nw.kid);
        setCookies.push(cookie('kk_nw', '', { maxAge: 0, secure: cfg.cookieSecure }));
        rec = await store.getPlayer(igsid);
      }
      if (!pl) setCookies.push(cookie(PLAYER_COOKIE, sign({ igsid, v: Date.now() }, cfg.sessionSecret), { maxAge: PLAYER_MAX_AGE, secure: cfg.cookieSecure }));
      return json(200, meOf({ username: name, ig: (rec && rec.ig) || ig, av: rec && rec.av, checkedAt: rec && rec.checkedAt, hiddenAt: rec && rec.hiddenAt, kakao: !!(rec && rec.kakao), google: !!(rec && rec.google) }));
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
      // 🔓 암호를 없앤 뒤(11-26)엔 예전 암호(DM 으로 많이 퍼짐)로 남의 예전 계정을 못 가져가게 암호를 안 봄
      const okPw = !NO_PASSWORD && !!pw && samePassword(body.password, pw);
      // 🆓 임시 인증 기간: 암호가 없거나 틀려도 통과(임시). 단 예전 계정 되찾기는 남의 계정을 가져갈 수 있어서 진짜 암호가 있어야 함
      if (!okPw && (!free || restoreOnly)) {
        if (body.password) passFail(ip);
        // 🔓 암호를 없앤 뒤(11-26): 예전 계정 되찾기는 '되찾기 요청'으로 (폰이 그 창을 엶)
        return json(403, { error: NO_PASSWORD ? 'need_request' : free ? 'need_password' : 'wrong_password' });
      }
      // 🔑 암호 없이(임시 이용) 새로 시작하는데 같은 아이디·닉네임의 예전 계정이 있으면 → 폰이 '암호로 이어가기 / 새로 시작' (2026-11-25)
      // ⏸ 11-25 사용자: DM 이 막혀 암호 받을 길이 없어 '암호 요청 DM' 만 늘어남 → 끔(OLD_ASK). 임시 이용이 끝나면 암호 인증이 알아서 예전 계정에 붙음
      if (OLD_ASK && !okPw && !pl && name && ig && body.fresh !== true) {
        const o = await sameOldAccount(ig, name);
        if (o) return json(409, { error: 'old_account', username: o.username });
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
          await moveWallet(pl.igsid, igsid);
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
      //   🔓 암호를 없앤 뒤(11-26)엔 이용 등록 = 바로 완료 (임시 아님)
      if (okPw || NO_PASSWORD) {
        if (!(pl && pl.igsid === igsid && pl.checkedAt > 0)) await store.setChecked(igsid, true);
      } else if (!(pl && pl.igsid === igsid && pl.checkedAt > 0)) await store.setChecked(igsid, 'temp');
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
      // 표본 밖이면 폰은 1시간 동안 통계만 따로 보내는 요청을 안 함 (Worker 요청 하루 10만 건 아끼기, 판 요청에 얹는 건 그대로)
      return json(200, ok === 'skip' ? { ok: true, rest: TRACK_REST_MS } : { ok: true });
    }

    // 건의함: 누구나 (닉네임이 있으면 같이 저장). 같은 브라우저는 1시간에 5개까지
    if (p === '/api/suggestions' && m === 'POST') {
      if (!limitSuggest(ip)) return json(429, { error: 'rate_limited' });
      // 건의하기는 팔로워 인증(인증 완료)한 사람만
      if (cfg.gateMode !== 'open') {
        const who = await getPlayer(request);
        if (!isConfirmed(who) && !(await openNow())) return json(403, { error: isVerified(who) ? 'confirm_pending' : 'confirm_required' });
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
      // 🎹 타일 맵은 diff 칸에 100 을 더해 적음 (표에 열을 안 늘리려고, 2026-11-26)
      const pub = (m) => ({ id: m.id, nick: m.nick, name: m.name, bpm: m.bpm, bars: m.bars, diff: m.diff % 100, kind: m.diff >= 100 ? 'tiles' : 'drum', at: m.at, plays: m.plays, likes: m.likes, mine: !!pl && m.igsid === pl.igsid });
      if (p === '/api/maps' && m === 'GET') {
        const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
        // 목록은 인스턴스마다 1분 (사람 많아지면 같은 목록을 계속 읽음). 'top' 은 맵 표 전체를 정렬해서 더
        const list = await cached('maps:' + sort, sort === 'top' ? 3 * 60_000 : 60_000, () => store.listMaps(sort, 60), { shared: false });
        return json(200, { maps: list.map(pub) });
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
          if (await store.addMap({ id: tryId, igsid: pl.igsid, nick: pl.username, name: map.name, bpm: map.bpm, bars: map.bars.length, diff: (map.kind === 'tiles' && map.tdiff ? map.tdiff : mapDifficulty(map)) + (map.kind === 'tiles' ? 100 : 0), data: map, at: now })) id = tryId;
        }
        if (!id) return json(500, { error: 'server_error' });
        memo.delete('maps:new');
        return json(200, { ok: true, id });
      }
      const mm = /^\/api\/maps\/([A-Za-z0-9]{7})(?:\/(like|report|delete|score))?$/.exec(p);
      if (!mm) return json(404, { error: 'not_found' });
      const [, id, act] = mm;
      if (!act && m === 'GET') {
        const play = url.searchParams.get('play') === '1';
        // 친 횟수 올리기는 쓰기 1줄 → 한도 브레이크 1단계부터는 안 셈
        const r = await store.getMap(id, { play: play && brake() < 1 });
        if (!r) return json(404, { error: 'not_found' });
        // 🏆 치러 들어갈 때 같은 요청에 모드별 1~3등을 같이 실어 보냄 (따로 요청 안 늘림)
        return json(200, { map: { ...pub(r), data: r.data }, top: play || url.searchParams.get('top') === '1' ? await cached('maptop:' + id, 60_000, () => store.topMapScores(id, 3), { shared: false }) : undefined });
      }
      if (act && m === 'POST') {
        if (!canWrite) return writeErr();
        if (act === 'delete') {
          memo.delete('maps:new');
          memo.delete('maps:top');
          return json(200, { ok: await store.deleteMap(id, pl.igsid) });
        }
        if (act === 'score') {
          if (!rankOk(pl)) return json(403, { error: 'login_required' });
          // 🏆 판이 끝날 때 한 번: mode 'free'(무적) / 'hearts'(하트 5개, 끝까지 살아남은 판만) / 'tiles'(🎹 타일 맵)
          const b = await readJson(request);
          const mode = ['hearts', 'free', 'tiles', 'tfree'].includes(b.mode) ? b.mode : null;
          const score = Math.floor(Number(b.score));
          if (!mode || !Number.isFinite(score) || score < 0) return json(400, { error: 'bad_score' });
          const r = await store.getMap(id);
          if (!r) return json(404, { error: 'not_found' });
          const map = cleanMap(r.data);
          if (!map || (mode === 'tiles' || mode === 'tfree') !== (map.kind === 'tiles')) return json(400, { error: 'bad_score' });
          if (score > (mode === 'tiles' || mode === 'tfree' ? mapTileMax(map) : maxScore(mapLevel(map)))) return json(400, { error: 'bad_score' });
          const s = await store.addMapScore(id, pl.igsid, pl.username, mode, score);
          if (!s) return json(404, { error: 'not_found' });
          memo.delete('maptop:' + id);
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
      // 🧯 2단계: 새 방·랜덤 대결은 막음 (방이 2~5초마다 주고받아서 요청·읽기·쓰기를 많이 씀). 이미 하는 판은 그대로
      if (['create', 'join', 'quick'].includes(b.action) && brake() >= 2) return json(503, { error: 'busy' });
      // 멀티(방 만들기·들어가기·빠른 대결)는 팔로워 인증한 사람만. 이미 들어온 방의 주고받기·나가기는 방 열쇠로
      if (cfg.gateMode !== 'open' && ['create', 'join', 'quick'].includes(b.action)) {
        const who = await getPlayer(request);
        if (!isConfirmed(who) && !(await openNow())) return json(403, { error: isVerified(who) ? 'confirm_pending' : 'confirm_required' });
      }
      const [status, data] = await handleRoom(request, b);
      return json(status, data);
    }

    // 관리자 (비밀번호 필요)
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(request) && !limitAdmin(ip)) return json(429, { error: 'rate_limited' });
      if (!isAdmin(request)) return json(401, { error: 'admin_required' });
      // 바꾸는 요청이면 캐시해 둔 참여자 목록·기록은 버림
      if (m !== 'GET') {
        await forget('admin:totals');
        await forget('admin:plist');
        memo.delete('admin:scores');
        // 참여자를 내리거나 지우면 명예의 전당 캐시도 다시 계산 (안 그러면 6시간 동안 그대로 보임)
        if (p.startsWith('/api/admin/players/'))
          for (const board of HALL_BOARDS) {
            memo.delete(hallKey(seasonAt().n, board));
            await Promise.resolve().then(() => store.setSetting('cache:' + hallKey(seasonAt().n, board), '{}')).catch(() => {});
          }
      }
      // 이용 통계: ?days=7 (1~90). 오늘 포함 최근 N일
      if (p === '/api/admin/stats' && m === 'GET') {
        const days = Math.min(90, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 7));
        const tzMin = cfg.statsTzMin;
        const now = Date.now();
        // 시간대 기준 오늘 0시부터 (days-1)일 전 ~ 지금
        const dayMs = 24 * 3600 * 1000;
        const todayStart = Math.floor((now + tzMin * 60000) / dayMs) * dayMs - tzMin * 60000;
        const from = todayStart - (days - 1) * dayMs;
        // 10분 기억 (통계 표는 크고 계속 늘어남). D1 은 시간 순 표라 기간만 읽고, 그 전 기간(예전 표 전체)은 한도 여유 있을 때만
        //   2026-11-27 무료 한도 점검: 예전 표(시간 순 표 전, 5만 줄+ 통째로 읽음)는 ?legacy=1 일 때만 · 결과는 여러 서버가 30분 같이 씀
        const fresh = url.searchParams.get('fresh') === '1';
        const legacy = url.searchParams.get('legacy') !== '0' && brake() < 1; // 2026-11-27 다시 기본 켬: 안 읽었더니 통계가 텅 비어 보임 → 대신 6시간 같이 씀
        const key = `admin:stats:${days}${legacy ? ':l' : ''}`;
        if (fresh) await forget(key);
        const out = await cached(key, legacy ? 6 * 3600_000 : 30 * 60_000, async () => {
          const raw = await store.statsRaw(from, now + 1, { legacy });
          return { days, ...buildStats(raw, { from, to: now, tzMin }), legacySkipped: !!raw.legacySkipped, at: now };
        });
        return json(200, out);
      }
      // 📣 광고 노출 통계: ?days=7 (1~365, 오늘 포함 최근 N일). 10분 같이 씀(?fresh=1 이면 바로 다시)
      if (p === '/api/admin/ads' && m === 'GET') {
        const days = Math.min(365, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 7));
        const now = Date.now();
        const toDay = adDay(now);
        const fromDay = adDay(now - (days - 1) * 24 * 3600 * 1000);
        const key = `admin:ads:${days}`;
        if (url.searchParams.get('fresh') === '1') await forget(key);
        const out = await cached(key, () => (brake() >= 1 ? 30 * 60_000 : 10 * 60_000), async () => ({ days, at: now, ...buildAdStats(await store.adStats(fromDay, toDay), { from: fromDay, to: toDay }) }));
        return json(200, out);
      }
      // 🏛 명예의 전당 사진 보기·지우기 (이상한 사진이면)
      if (p === '/api/admin/hall' && m === 'GET') return json(200, { hall: await store.hallList() });
      if (p === '/api/admin/hall/photo' && m === 'POST') {
        const b = await readJson(request);
        memo.delete('hall:list');
        return json(200, { ok: await store.hallSetImage(Number(b.season), String(b.board), Number(b.rank), null) });
      }
      if (p === '/api/admin/hall/msg' && m === 'POST') {
        const b = await readJson(request);
        memo.delete('hall:list');
        return json(200, { ok: await store.hallSetMsg(Number(b.season), String(b.board), Number(b.rank), null) });
      }
      // 🎁 코인 주기 (2026-11-22, 시즌 1등 보상 등): 지갑에 바로 더하고, 그 사람이 다음에 들어올 때 팝업
      //   hall = { season, board, rank } 를 주면 팝업에서 명예의 전당 한마디도 받음
      if (p === '/api/admin/gift' && m === 'POST') {
        const b = await readJson(request);
        const igsid = String(b.igsid || '');
        const coins = Math.floor(Number(b.coins) || 0);
        if (!igsid || coins < 0 || coins > 10000000) return json(400, { error: 'bad_request' });
        const pl = await store.getPlayer(igsid);
        if (!pl) return json(404, { error: 'no_player' });
        let hall = null;
        if (b.hall) {
          const h = (await store.hallList()).find((x) => x.season === Number(b.hall.season) && x.board === String(b.hall.board) && x.rank === Number(b.hall.rank));
          if (!h || h.igsid !== igsid) return json(400, { error: 'not_in_hall' });
          hall = { season: h.season, board: h.board, rank: h.rank };
        }
        if (!coins && !hall) return json(400, { error: 'bad_request' });
        const w0 = await store.getWallet(igsid);
        const prev = (w0 && w0.gift) || null;
        const gift = { coins: coins + ((prev && Number(prev.coins)) || 0), note: String(b.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80) || (prev && prev.note) || '', hall: hall || (prev && prev.hall) || null, at: Date.now() };
        await store.giveCoins(igsid, coins, gift);
        const w1 = await store.getWallet(igsid);
        return json(200, { ok: true, username: pl.username, coins: w1 ? w1.coins : coins, gift });
      }
      // 랭킹 참여자 (인스타 아이디로 팔로우 확인 → 안 했으면 삭제)
      if (p === '/api/admin/players' && m === 'GET') {
        // 5분 캐시 (참여자 목록은 기록 전체를 읽어서 무거움). admin 에서 뭘 바꾸면 비움
        if (url.searchParams.get('fresh') === '1') await Promise.all([forget('admin:totals'), forget('admin:plist')]);
        await store.purgeHidden();
        if (store.cleanup) await store.cleanup();
        const players = await adminPlayers();
        return json(200, { players, keepDays: HIDE_KEEP_MS / 86400000 });
      }
      // 랭킹에서 내리기 (5일 뒤 자동 삭제, 그 사이 다시 들어와 아이디를 넣으면 돌아옴) / 되돌리기
      // 🕵 핵 의심 지표 (쿼리 2번: 참여자 목록 + 전체 기록)
      if (p === '/api/admin/suspects' && m === 'GET') {
        // ?igsid= 이면 그 사람 자세히, 없으면 강한 신호만 목록 (쿼리 2번)
        const players = await adminPlayers();
        // 기록 표 전체를 읽음 → 브레이크 1단계부터는 기억해 둔 게 없으면 나중에
        if (brake() >= 1 && !memo.has('admin:scores')) return json(503, { error: 'busy' });
        const rows = await cached('admin:scores', ttlOf(15 * 60_000), () => store.allScores(), { shared: false }); // 점수 표 전체(수만 줄) → 15분 기억, settings 엔 안 넣음
        const id = url.searchParams.get('igsid');
        if (id) {
          const pl = players.find((x) => x.igsid === id);
          await flushTries();
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
        const players = await adminPlayers();
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
      // 🎹 시즌 2 열기 (열기 전엔 미리보기 기기만) · 커뮤니티 퀘스트(팔로워 수 등)
      if (p === '/api/admin/s2' && m === 'GET') {
        const c = await s2Load(true);
        return json(200, { open: c.open, community: c.community });
      }
      if (p === '/api/admin/s2' && m === 'POST') {
        const b = await readJson(request);
        if (typeof b.open === 'boolean') await store.setSetting('s2Open', b.open ? 'open' : 'closed');
        if (b.community !== undefined) {
          const list = cleanCommunity(b.community);
          if (!list) return json(400, { error: 'bad_community' });
          await store.setSetting('s2Community', JSON.stringify(list));
        }
        const c = await s2Load(true);
        return json(200, { open: c.open, community: c.community });
      }
      // 🛒 상점 열기·닫기 (닫혀 있으면 구경만)
      if (p === '/api/admin/shop' && m === 'GET') return json(200, { open: await shopOpen(true) });
      if (p === '/api/admin/shop' && m === 'POST') {
        const b = await readJson(request);
        await store.setSetting('shopOpen', b.open ? '1' : 'closed');
        return json(200, { open: await shopOpen(true) });
      }
      // 🧯 오늘 쓴 양·브레이크 단계
      if (p === '/api/admin/usage' && m === 'GET') {
        usageAt = 0;
        await flushUsage(Date.now());
        const same = usage.day === utcDay(Date.now());
        return json(200, { day: utcDay(Date.now()), r: same ? usage.r : 0, w: same ? usage.w : 0, q: same ? usage.q : 0, limits: USAGE_LIMITS, at: BRAKE_AT, level: brake(), metered: !!meter });
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
      // 🎹 시즌 2 피아노 타일: 처음 TILE_FREE 곡은 누구나, 나머지는 드럼 4단계부터처럼 팔로워 인증
      const tile = tileSong(body.level);
      if (tile) {
        const tpl = await getPlayer(request);
        if (cfg.gateMode !== 'open' && tileClosed(tile) && !isConfirmed(tpl) && !(await openNow())) return json(403, { error: isVerified(tpl) ? 'confirm_pending' : 'confirm_required' });
        const runToken = sign({ l: tile.key, t: Date.now(), n: newId() }, cfg.sessionSecret);
        notePre(tpl, body);
        const coins = body.coins ? await takeCoins(tpl, body.coins) : null;
        return json(200, { runToken, ...(coins || {}) });
      }
      const level = endlessMode(body.level) || getLevel(body.level);
      if (!level) return json(400, { error: 'bad_level' });
      // 4단계부터와 무제한(그리그·단계별)은 팔로워 인증(암호 또는 운영자 확인)한 사람만
      // (GATE_MODE=open 이면 잠금 없음, 개발용)
      let runPl = null;
      if (cfg.gateMode !== 'open' && (isClosed(level.id) || needsVerify(level.id))) {
        const pl = (runPl = await getPlayer(request));
        if (isClosed(level.id) && !isConfirmed(pl) && !(await openNow())) return json(403, { error: isVerified(pl) ? 'confirm_pending' : 'confirm_required' });
        if (needsVerify(level.id) && !isVerified(pl)) return json(403, { error: 'verify_required' });
      }
      // 🕵 단계마다 몇 판 시작했나 (누군지 이미 아는 판만 = 4단계부터. 1~3단계는 쿼리 늘리지 않으려고 안 셈)
      if (runPl && runPl.igsid && level.id > 0 && brake() < 1) noteTry(runPl.igsid, level.id, 1, 0);
      const runToken = sign({ l: level.id, t: Date.now(), n: newId() }, cfg.sessionSecret);
      const anyPl = body.coins || body.offline || body.lost || preList(body).length ? runPl || (await getPlayer(request)) : null;
      notePre(anyPl, body);
      const coins = body.coins ? await takeCoins(anyPl, body.coins) : null;
      const offline = body.offline ? await takeOffline(anyPl, body.offline) : null;
      const lost = body.lost && !offline ? await takeLost(anyPl, body.lost) : null; // 한 요청 D1 쿼리 수 제한: offline 과 같이 오면 다음 요청에
      const out = { runToken };
      if (lost) out.lost = lost;
      if (coins != null) Object.assign(out, coins);
      if (offline) out.offline = offline;
      return json(200, out);
    }

    // 🛒 상점에서 사기 (2026-11-22): 폰이 모아 둔 코인(force)을 같이 보냄 → 먼저 더하고 같은 요청에서 차감. 지갑 쓰기 1줄
    if (p === '/api/shop/buy' && m === 'POST') {
      if (!limitScores(ip)) return json(429, { error: 'rate_limited' });
      const body = await readJson(request);
      const pl = await getPlayer(request);
      if (!pl || !isConfirmed(pl)) return json(403, { error: 'verify_required' });
      const w0 = (await store.getWallet(pl.igsid)) || null;
      const { wallet: w1, changed, rest = 0 } = body.coins && typeof body.coins === 'object' ? applyCoins(w0, body.coins, cfg.sessionSecret) : { wallet: { coins: 0, t: 0, tn: 0, fday: '', fn: 0, init: 0, ...(w0 || {}) }, changed: false };
      const cr = rest > 0 ? { coinRest: rest } : {};
      // 상점이 닫혀 있으면 못 삼 (보낸 코인은 받아 둠)
      if (!(await shopOpen(false, pl))) {
        if (changed) await store.putWallet(pl.igsid, w1);
        return json(403, { error: 'shop_closed', coins: w1.coins, gems: s2Of(w1).gm || 0, owned: cleanOwned(w1.owned), ...cr });
      }
      const r = buyItem(w1, String(body.item || ''));
      if (r.ok && !r.already) await store.putWallet(pl.igsid, r.wallet);
      else if (changed) await store.putWallet(pl.igsid, { ...w1, owned: r.wallet.owned });
      const out = { coins: r.wallet.coins, gems: s2Of(r.wallet).gm || 0, owned: r.wallet.owned, ...cr };
      if (!r.ok) return json(r.error === 'not_enough' ? 402 : 400, { error: r.error, ...out });
      return json(200, { ok: true, ...out });
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
      notePre(pl, body);
      const coins = body.coins ? await takeCoins(pl, body.coins) : null;
      // 🔑 랭킹은 카카오 로그인한 계정만 (11-27) — 코인은 받아 둠
      if (!rankOk(pl)) return json(403, { error: 'login_required', ...(coins || {}) });
      const offline = body.offline ? await takeOffline(pl, body.offline) : null;
      const lost = body.lost && !offline ? await takeLost(pl, body.lost) : null;
      // 코인·서버 없을 때 기록을 받았으면 오류 응답에도 실음 (폰이 두 번 안 보내게)
      const wc = (o) => ({ ...o, ...(coins || {}), ...(offline ? { offline } : {}), ...(lost ? { lost } : {}) });
      const tile = tileSong(body.level);
      if (tile) {
        const run = unsign(body.runToken, cfg.sessionSecret);
        if (!run || run.l !== tile.key) return json(400, wc({ error: 'bad_run' }));
        const v = checkTileRun(tile.id, body, (Date.now() - run.t) / 1000);
        if (!v.ok) return json(400, wc({ error: v.error }));
        // 시즌 2 를 열기 전(운영자 미리보기)엔 랭킹에 안 올림
        if (!(await s2Load()).open) return json(200, wc({ preview: true, next: nextTokens([tile.key]) }));
        if (await store.runUsed(run.n)) return json(409, wc({ error: 'run_used' }));
        await ensureHall();
        const slot = tileSlot(tile.id);
        // 핵 의심 확인용: 실제 걸린 시간 · 빈 줄 누름 · 놓침 (JSON 글자로 — D1 은 객체를 못 받음)
        const chk = JSON.stringify({ ms: Math.max(0, Date.now() - run.t), tile: 1, w: Number.isInteger(body.wrong) ? Math.max(0, Math.min(9999, body.wrong)) : undefined, mi: Number.isInteger(body.missed) ? Math.max(0, Math.min(9999, body.missed)) : undefined });
        const out = await store.recordScore(pl.igsid, slot, { score: v.tiles, grade: lapGrade(v.laps), maxCombo: v.maxCombo, chk });
        if (out && out.improved) await store.useRun(run.n, Date.now() + 2 * 24 * 3600 * 1000);
        const sn = seasonAt().n;
        if (sn > 1) await store.recordSeasonScore(sn, pl.igsid, slot, v.tiles);
        if (out && out.improved) {
          await hallBump(pl.igsid, 'tiles');
          boardChanged(slot, pl.igsid);
        }
        const mine = out && out.improved && brake() < 2 ? await store.rankOf(slot, pl.igsid) : null;
        return json(200, wc({ improved: !!(out && out.improved), best: out ? out.best : v.tiles, rank: mine ? mine.rank : null, over: !!(mine && mine.over), busy: !!(out && out.improved) && !mine, kept: !(out && out.improved), next: nextTokens([tile.key]) }));
      }
      // 🗄 시즌 2 를 연 뒤(11-27): 드럼·무제한 랭킹은 시즌 1 로 끝 (기록은 scores_s1 에 보관, 명예의 전당에서만) — 코인만 받음
      if ((await s2Load()).open) return json(200, wc({ closed: true }));
      const em = endlessMode(body.level);
      if (em) {
        const e = validateEndless(body, cfg);
        if (!e.ok) return json(400, wc({ error: e.error }));
        if (await store.runUsed(e.nonce)) return json(409, wc({ error: 'run_used' }));
        await ensureHall();
        const out = await store.recordScore(pl.igsid, em.slot, { score: endlessKey(e.rounds, e.score), grade: null, maxCombo: 0 });
        // 판 토큰은 기록이 올랐을 때만 '썼음'으로 적음: 안 오른 판은 다시 보내도 바뀌는 게 없음 (D1 쓰기 판마다 1줄 아끼기, 2026-11-22)
        if (out && out.improved) await store.useRun(e.nonce, Date.now() + 2 * 24 * 3600 * 1000);
        if (seasonAt().n > 1) await store.recordSeasonScore(seasonAt().n, pl.igsid, em.slot, endlessKey(e.rounds, e.score));
        if (out && out.improved) await hallBump(pl.igsid, 'endless');
        // 등수는 기록이 올랐을 때만 셈 (D1 읽기 아끼기)
        if (out && out.improved) boardChanged(em.slot, pl.igsid);
        const mine = out.improved && brake() < 2 ? await store.rankOf(em.slot, pl.igsid) : null;
        const best = endlessParts(out.best);
        return json(200, wc({ improved: out.improved, best: best.score, rounds: best.rounds, rank: mine ? mine.rank : null, over: !!(mine && mine.over), busy: out.improved && !mine, kept: !out.improved, next: nextTokens([em.id]) }));
      }
      const v = validateScore(body, cfg);
      if (!v.ok) return json(400, wc({ error: v.error }));
      if (await store.runUsed(v.nonce)) return json(409, wc({ error: 'run_used' }));
      await ensureHall();
      const out = await store.recordScore(pl.igsid, v.level.id, { score: v.score, grade: v.grade, maxCombo: v.maxCombo, chk: v.chk });
      if (out && out.improved) await store.useRun(v.nonce, Date.now() + 2 * 24 * 3600 * 1000);
      if (v.level.id > 0 && brake() < 1) noteTry(pl.igsid, v.level.id, 0, 1);
      if (seasonAt().n > 1 && v.level.id > 0 && v.level.id <= LAST_LEVEL_ID) await store.recordSeasonScore(seasonAt().n, pl.igsid, v.level.id, v.score);
      if (out && out.improved && v.level.id > 0 && v.level.id <= LAST_LEVEL_ID) await hallBump(pl.igsid, 'stage');
      if (out && out.improved) boardChanged(v.level.id, pl.igsid);
      const mine = out.improved && brake() < 2 ? await store.rankOf(v.level.id, pl.igsid) : null;
      const nextLv = getLevel(v.level.id + 1);
      return json(200, wc({ ...out, rank: mine ? mine.rank : null, over: !!(mine && mine.over), busy: !!out.improved && !mine, kept: !out.improved, next: nextTokens([v.level.id, nextLv && !nextLv.long ? nextLv.id : null]) }));
    }

    // 🏛 명예의 전당: 이번 시즌 총합 랭킹(단계·무제한) + 끝난 시즌 1·2·3등(사진 포함)
    if (p === '/api/hall' && m === 'GET') {
      const bq = url.searchParams.get('board');
      const board = bq === 'endless' ? 'endless' : bq === 'tiles' ? 'tiles' : 'stage';
      await ensureHall();
      const pl = await getPlayer(request);
      const season = seasonAt();
      // 위 순위는 6시간 캐시(+ 기록 오르면 고침), 내 줄만 새로 계산해서 끼워 넣음 (내 점수는 바로 보이게)
      const mineNow = pl ? await store.seasonMine(season.n, board, pl.igsid) : null;
      const { list: top, mine } = hallMerge(await hallData(season.n, board), mineNow, pl);
      const hall = (await hallListCached()).map((h) => ({ ...hallEntry(h, pl), season: h.season, board: h.board, image: h.image, msg: h.msg || null }));
      // ?final=1 (전시관만): 끝난 시즌 최종 순위 100등까지 — settings 한 줄씩, 인스턴스 10분 기억
      let finals;
      let finalsMe;
      if (url.searchParams.get('final')) {
        finals = {};
        for (const n of endedSeasons())
          for (const bd of hallBoardsOf(n)) {
            const raw = await cached(`hallfinal:${n}:${bd}`, 10 * 60 * 1000, async () => (await store.getSetting(`hallfinal:${n}:${bd}`)) || '', { shared: false });
            let rows = [];
            try {
              rows = raw ? JSON.parse(raw) : [];
            } catch {}
            if (rows.length) finals[`${n}:${bd}`] = rows.map((r) => ({ rank: r.rank, username: r.username, score: r.score, n: r.n, rounds: r.rounds, me: pl ? r.igsid === pl.igsid : false }));
            if (rows.length && pl) {
              try {
                const fm = await finalMine(n, bd, pl);
                if (fm) (finalsMe || (finalsMe = {}))[`${n}:${bd}`] = fm;
              } catch (e) {
                console.error('[finalMine]', e);
              }
            }
          }
      }
      // 🙂 타일 총합 1·2·3등 프로필 이미지 + 한 줄 소개 (시상대, 2026-11-27) — 3명만, 인스턴스 10분 기억
      let avOf = {};
      if (board === 'tiles') {
        const ids = top.slice(0, 3).map((r) => r.igsid).filter(Boolean);
        if (ids.length)
          avOf = await cached(`hall:av2:${ids.join(',')}`, 10 * 60 * 1000, async () => {
            const o = {};
            for (const id of ids) {
              const r = await Promise.resolve().then(() => store.getPlayer(id)).catch(() => null);
              if (r && (r.av || (r.intro && r.intro.t))) o[id] = { av: r.av || null, t: (r.intro && r.intro.t) || '' };
            }
            return o;
          }, { shared: false });
      }
      return json(200, { season: { n: season.n, end: season.end }, board, levels: LAST_LEVEL_ID, entries: top.map((r) => (avOf[r.igsid] ? { ...hallEntry(r, pl), av: avOf[r.igsid].av, intro: avOf[r.igsid].t || undefined } : hallEntry(r, pl))), me: mine ? { ...hallEntry(mine, pl), cap: mine.cap || null } : null, hall, finals, finalsMe });
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
      memo.delete('hall:list');
      return ok ? json(200, { ok: true }) : json(403, { error: 'not_yours' });
    }

    // 💬 명예의 전당 한마디 (본인 칸만, 2026-11-22) — msg: '' 또는 null = 지우기
    if (p === '/api/hall/msg' && m === 'POST') {
      if (!limitHallPhoto(ip)) return json(429, { error: 'rate_limited' });
      const b = await readJson(request);
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const board = HALL_BOARDS.includes(b.board) ? b.board : null;
      if (!board || !Number.isInteger(b.season) || !Number.isInteger(b.rank)) return json(400, { error: 'bad_request' });
      const ok = await store.hallSetMsg(b.season, board, b.rank, cleanHallMsg(b.msg), pl.igsid);
      memo.delete('hall:list');
      return ok ? json(200, { ok: true }) : json(403, { error: 'not_yours' });
    }
    // 🗳 투표 (2026-11-23 시즌 2 피아노 미리보기): 한 사람(이용 등록한 계정) 한 표, 넣으면 바로 결과, 다른 쪽을 보내면 표를 바꿈
    //   표 수는 인스턴스 메모리에 1분(브레이크 땐 5분) — 표를 넣으면 그 자리에서 +1
    if (p === '/api/poll' && (m === 'GET' || m === 'POST')) {
      const b = m === 'POST' ? await readJson(request) : {};
      const id = m === 'POST' ? b.id : url.searchParams.get('id');
      const opts = POLLS[id];
      if (!opts) return json(404, { error: 'no_poll' });
      const key = 'poll:' + id;
      const counts = () => cached(key, brake() >= 1 ? 5 * 60_000 : 60_000, () => store.pollCounts(id), { shared: false });
      if (m === 'GET') return json(200, { counts: await counts() });
      if (!limitHallPhoto(ip)) return json(429, { error: 'rate_limited' });
      if (!opts.includes(b.choice)) return json(400, { error: 'bad_choice' });
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const c = { ...(await counts()) }; // 표 넣기 전 수 (넣은 뒤 +1)
      const r = await store.pollVote(id, pl.igsid, b.choice);
      let bonus = 0;
      if (r.added) {
        bonus = POLL_BONUS;
        await store.giveCoins(pl.igsid, bonus, null);
      }
      if (r.added || r.changed) {
        c[b.choice] = (c[b.choice] || 0) + 1;
        if (r.changed && r.prev) c[r.prev] = Math.max(0, (c[r.prev] || 0) - 1);
        const hit = memo.get(key);
        if (hit) hit.v = c;
      }
      return json(200, { ok: true, already: !r.added && !r.changed, changed: !!r.changed, mine: r.choice, counts: c, bonus });
    }
    // 🎁 운영자가 준 코인 알림을 봤음 (+ 명예의 전당 한마디를 같이 적을 수 있음). 코인은 줄 때 이미 지갑에 들어가 있음
    if (p === '/api/gift/ack' && m === 'POST') {
      if (!limitHallPhoto(ip)) return json(429, { error: 'rate_limited' });
      const b = await readJson(request);
      const pl = await getPlayer(request);
      if (!pl) return json(401, { error: 'verify_required' });
      const w = await store.getWallet(pl.igsid);
      const g = w && w.gift;
      if (!g) return json(200, { ok: true });
      const msg = cleanHallMsg(b.msg);
      if (g.hall && msg) {
        await store.hallSetMsg(g.hall.season, g.hall.board, g.hall.rank, msg, pl.igsid);
        memo.delete('hall:list');
      }
      await store.clearGift(pl.igsid);
      return json(200, { ok: true, saved: !!(g.hall && msg) });
    }

    if (p === '/api/leaderboard' && m === 'GET' && url.searchParams.get('level') === 'total') {
      // 예전 '총 등수' (화면에선 명예의 전당으로 바뀜): 기록 전체를 모으는 쿼리라 매번 돌리면 위험 → 시즌 1 총합 캐시로 (전체 기간 = scores)
      const pl = await getPlayer(request);
      const mineNow = pl ? await store.seasonMine(1, 'stage', pl.igsid) : null;
      const { list, mine } = hallMerge(await hallData(1, 'stage'), mineNow, pl);
      const entries = list.map((r) => ({ rank: r.rank, username: r.username, score: r.score, levels: r.n, me: pl ? r.igsid === pl.igsid : false }));
      return json(200, { level: 'total', levels: LAST_LEVEL_ID, entries, me: mine ? { rank: mine.rank, score: mine.score, levels: mine.n, cap: mine.cap || null } : null });
    }

    // 🎹 타일 곡 랭킹 (?level=t3): 친 타일 수 + 돈 바퀴(별·왕관)
    const lbTile = p === '/api/leaderboard' && m === 'GET' ? tileSong(url.searchParams.get('level')) : null;
    if (lbTile) {
      const slot = tileSlot(lbTile.id);
      const pl = await getPlayer(request);
      const lb = await boardOf(slot);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, av: r.av || null, score: r.score, laps: gradeLaps(r.grade), me: pl ? r.igsid === pl.igsid : false }));
      const inTop = pl && lb.rows.find((r) => r.igsid === pl.igsid);
      const mine = inTop ? { rank: inTop.rank, score: inTop.score } : pl && brake() < 1 ? await myRank(slot, pl.igsid) : null;
      return json(200, { level: lbTile.key, entries, me: mine ? { rank: mine.rank, over: !!mine.over, score: mine.score } : null });
    }
    const lbEndless = p === '/api/leaderboard' && m === 'GET' ? endlessMode(url.searchParams.get('level')) : null;
    if (lbEndless) {
      const pl = await getPlayer(request);
      const lb = await boardOf(lbEndless.slot);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, ...endlessParts(r.score), me: pl ? r.igsid === pl.igsid : false }));
      const inTop = pl && lb.rows.find((r) => r.igsid === pl.igsid);
      const mine = inTop ? { rank: inTop.rank, score: inTop.score } : pl && brake() < 1 ? await myRank(lbEndless.slot, pl.igsid) : null;
      return json(200, { level: lbEndless.id, entries, me: mine ? { rank: mine.rank, over: !!mine.over, ...endlessParts(mine.score) } : null });
    }

    if (p === '/api/leaderboard' && m === 'GET') {
      const level = getLevel(url.searchParams.get('level') || 4);
      if (!level) return json(400, { error: 'bad_level' });
      const pl = await getPlayer(request);
      const lb = await boardOf(level.id);
      const entries = lb.rows.map((r) => ({ rank: r.rank, username: r.username, av: r.av || null, score: r.score, grade: r.grade, me: pl ? r.igsid === pl.igsid : false }));
      const inTop = pl && lb.rows.find((r) => r.igsid === pl.igsid);
      const mine = inTop ? { rank: inTop.rank, score: inTop.score } : pl && brake() < 1 ? await myRank(level.id, pl.igsid) : null;
      return json(200, { level: level.id, entries, me: mine ? { rank: mine.rank, over: !!mine.over, score: mine.score } : null });
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
  // st: 세션 시작 시각(폰 시계). 이상하면 null → 서버가 예전 방식으로 (D1 시간 순 표에 못 넣음)
  const st = Number.isFinite(b.st) && b.st > Date.now() - 2 * 86400000 && b.st < Date.now() + 60000 ? Math.floor(b.st) : null;
  return {
    sid,
    st,
    activeSec: int(b.active, 24 * 3600),
    // 어디서 왔나 (utm_source 나 이전 페이지의 도메인). 개인 정보가 섞이지 않게 글자 종류·길이 제한
    ref: typeof b.ref === 'string' ? b.ref.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) : '',
    device: ['mobile', 'desktop', 'inapp'].includes(b.device) ? b.device : 'unknown',
    plays,
    ads: cleanAds(b.ads),
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
/** 💬 명예의 전당 한마디: 줄바꿈·제어 글자 빼고 40자까지 (없으면 null) */
export function cleanHallMsg(v) {
  if (typeof v !== 'string') return null;
  const t = [...v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, 40).join('');
  return t || null;
}

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

export const OFFLINE_MAX = 5;
const OFFLINE_KEEP_MS = 36 * 3600 * 1000;

/**
 * 📴 서버 없을 때 친 판 하나 검사 (판 토큰 없음): { level, score, at, (counts, maxCombo, check) | rounds }
 *   key = 폰이 줄에서 지울 이름(단계). 형식이 틀려도 key 는 돌려줌(다시 안 보내게)
 */
export function validateOffline(e, cfg, now = Date.now()) {
  if (!e || typeof e !== 'object') return { ok: false, key: null };
  const key = String(e.level);
  const bad = (error) => ({ ok: false, key, error });
  const at = e.at;
  if (!Number.isInteger(at) || at < now - OFFLINE_KEEP_MS || at > now + 60000) return bad('bad_at');
  const em = endlessMode(e.level);
  if (em) {
    // 판 토큰 검사만 빼고 무제한 검사 그대로 (점수 상한)
    const r = validateEndless({ ...e, runToken: sign({ l: em.id, t: now - 3600 * 1000, n: '' }, cfg.sessionSecret) }, { ...cfg, minRunRatio: 0 }, now);
    if (!r.ok) return bad(r.error);
    return { ok: true, key, endless: true, slot: em.slot, score: endlessKey(r.rounds, r.score), grade: null, maxCombo: 0, chk: JSON.stringify({ off: 1 }), at };
  }
  const level = getLevel(e.level);
  if (!level) return bad('bad_level');
  // 걸린 시간 검사는 빼고 나머지(콩 수·점수·판정 개수) 그대로
  const v = validateScore({ ...e, runToken: sign({ l: level.id, t: now - 3600 * 1000, n: '' }, cfg.sessionSecret) }, { ...cfg, minRunRatio: 0 }, now);
  if (!v.ok) return bad(v.error);
  const chk = JSON.parse(runCheck(e.check, null));
  chk.off = 1;
  return { ok: true, key, slot: level.id, score: v.score, grade: v.grade, maxCombo: v.maxCombo, chk: JSON.stringify(chk), at };
}

// 🩹 11-22 13:00 ~ 11-23 09:00 KST (D1 한도 초과로 서버가 쉬던 때). 받는 건 시즌 1 끝(11-26 23:59:59 KST)까지 — 시즌 보상 계산 뒤엔 안 바뀌게
export const LOST_FROM = Date.parse('2026-11-22T04:00:00Z');
export const LOST_TO = Date.parse('2026-11-23T00:00:00Z');
export const LOST_UNTIL = SEASONS[0].end;
const LOST_GRADES = new Set(['SS', 'S', 'A', 'B', 'C', 'D']);
/** 서버 쉬던 때 친 기록 하나 검사: { level, score, maxCombo, grade, at } (무제한은 안 받음) */
export function validateLost(e) {
  if (!e || typeof e !== 'object') return { ok: false, key: null };
  const key = String(e.level);
  const bad = (error) => ({ ok: false, key, error });
  if (!Number.isInteger(e.at) || e.at < LOST_FROM || e.at >= LOST_TO) return bad('bad_at');
  if (!Number.isInteger(e.level) || e.level <= 0 || endlessMode(e.level)) return bad('bad_level');
  const level = getLevel(e.level);
  if (!level) return bad('bad_level');
  if (!Number.isInteger(e.score) || e.score <= 0 || e.score > maxScore(level)) return bad('bad_score');
  const n = noteCount(level);
  const maxCombo = Number.isInteger(e.maxCombo) ? Math.min(Math.max(0, e.maxCombo), n) : 0;
  return { ok: true, key, slot: level.id, score: e.score, maxCombo, grade: LOST_GRADES.has(e.grade) ? e.grade : null, at: e.at };
}

/**
 * 🕵 핵 의심 확인용 (2026-11-21): 실제로 친 시간(판 토큰 받은 때 → 점수 올린 때) + 폰이 잰 박자 오차 퍼짐·평균, 가짜 입력 수
 *   점수 올릴 때 얹어 와서 scores.chk 에 JSON 으로 (요청·줄 추가 없음). 예전 앱은 check 가 없어 ms 만
 */
export function runCheck(c, elapsedMs) {
  const out = elapsedMs == null ? {} : { ms: Math.max(0, Math.round(elapsedMs)) };
  if (c && typeof c === 'object') {
    const int = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
    const sd = int(c.sd, 0, 1000), mean = int(c.mean, -1000, 1000), n = int(c.n, 0, 100000), fake = int(c.fake, 0, 100000);
    if (sd != null) out.sd = sd;
    if (mean != null) out.mean = mean;
    if (n != null) out.n = n;
    if (fake != null) out.fake = fake;
    // 폰 버벅임 (2026-11-23): 늦게 도착한 터치로 되살린 MISS 수 · 터치가 가장 늦게 처리된 시간(ms). 0 이면 안 적음
    const rv = int(c.rv, 0, 100000), lag = int(c.lag, 0, 10000);
    if (rv) out.rv = rv;
    if (lag) out.lag = lag;
    // 🖐 쌍 봐주기로 GOOD 받은 콩 수 (2026-11-24, 아이폰이 터치를 빠뜨린 걸로 보는 것). 0 이면 안 적음
    const ps = int(c.ps, 0, 100000);
    if (ps) out.ps = ps;
  }
  return JSON.stringify(out);
}
