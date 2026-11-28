// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 랭킹: guest(닉네임) → startRun() 으로 판 토큰 → submitScore() (끝까지 친 판은 알아서 올림)

import { load, save, playerHeaders, notePlayer } from './storage.js';
import { gradeFor } from './charts.js';
import { takeTrack } from './track.js';
import { takeCoins, coinsResult } from './coins.js';
import { takeOffline, offlineResult, takeLost, lostResult } from './offrec.js';
import { takeS2, s2Result } from './s2claims.js';
import { seasonAt } from './season.js';

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: playerHeaders(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  notePlayer(res);
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    // 🧯 서버 DB 가 막힘(하루 한도 등) → main.js 가 서버 없는 모드로 바꿈
    if (res.status === 503 && data && data.error === 'db_down') {
      noteServerDown(data);
      try {
        window.dispatchEvent(new CustomEvent('okaystra:db-down'));
      } catch {}
    }
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// 📴 서버 없을 때 친 최고 기록(offrec.js)도 같이 얹음
// 🎁 시즌 2 출석·퀘스트 받기(s2claims.js)도 코인처럼 얹음 (서버가 지갑에 같이 적음)
function withCoins(send) {
  const coins = takeCoins();
  const offline = takeOffline();
  const lost = takeLost();
  const s2 = takeS2();
  const c = s2 ? { ...(coins || {}), s2 } : coins;
  return send(c, offline, lost).then(
    (r) => {
      if (coins || s2) coinsResult(r);
      if (s2) s2Result(r);
      if (offline) offlineResult(r);
      if (lost) lostResult(r);
      return r;
    },
    (e) => {
      if (coins || s2) coinsResult(e && e.data);
      if (s2) s2Result(e && e.data);
      if (offline) offlineResult(e && e.data);
      if (lost) lostResult(e && e.data);
      throw e;
    }
  );
}

const LB_CACHE_MS = 60 * 1000;
const NEXT_TOKEN_MS = 10 * 60 * 1000;
let nextTok = {}; // 단계 → { tok, at }
const usedPre = []; // 미리 받은 토큰으로 시작한 단계 (서버 판 수 세기용, 다음 요청에 얹음)
const lbCache = new Map();

function serverApi(boot = null) {
  // 첫 접속 때 /api/health?boot=1 로 받은 설정·내 정보는 한 번만 그대로 씀 (요청 아끼기)
  let bootConfig = boot && boot.config;
  let bootMe = boot && boot.me;
  return {
    mode: 'server',
    /** 🛒 상점에서 사기: 모아 둔 코인을 지금 다 얹어 보냄(서버가 먼저 더하고 차감) */
    async buy(item) {
      const coins = takeCoins({ force: true });
      try {
        const r = await http('POST', '/api/shop/buy', { item, coins });
        coinsResult(r);
        return r;
      } catch (e) {
        if (coins) coinsResult(e && e.data);
        throw e;
      }
    },
    config: () => {
      if (bootConfig) {
        const c = bootConfig;
        bootConfig = null;
        return Promise.resolve(c);
      }
      return http('GET', '/api/config');
    },
    me: () => {
      if (bootMe) {
        const m = bootMe;
        bootMe = null;
        return Promise.resolve(m);
      }
      return http('GET', '/api/me');
    },
    guest: (name, ig, av) => http('POST', '/api/guest', { name, ig, av }),
    avatar: (av) => http('POST', '/api/avatar', { av }),
    intro: (intro) => http('POST', '/api/intro', { intro }),
    // 🙂👥 남의 프로필 · 친구 (2026-11-28) — 누를 때만 요청
    profile: (b, u) => http('GET', `/api/profile?b=${encodeURIComponent(b)}&u=${encodeURIComponent(u)}`),
    friends: () => http('GET', '/api/friends'),
    friendEdit: (body) => http('POST', '/api/friends', body),
    verifyPassword: (body) => http('POST', '/api/verify/password', body),
    // 📦 내 기록 되받기 (브라우저 바꾸고 로그인했을 때 한 번)
    myBests: () => http('GET', '/api/my-bests'),
    // 이용 통계는 따로 안 보내고 이 요청들에 얹어 보냄 (요청 수 아끼기)
    // 🪙 코인도 얹어 보냄 (coins.js). 응답에 잔액이 오면 받은 것, 아니면 다음에 다시
    // 🎟 점수를 올리면 서버가 '같은 단계·다음 단계' 판 토큰을 미리 줌 → 깬 뒤 바로 다시·다음 판은 /api/runs 요청 없이 (Worker 요청 아끼기)
    // 판 토큰을 받을 때마다 +1 (타일이 지난 토큰을 다시 쓸 때 '그 뒤 다른 토큰을 안 받았나' 확인용 — 코인은 토큰 시각 순서로만 받음)
    runSeq: 0,
    startRun(level) {
      this.runSeq++;
      const k = String(level);
      const pre = nextTok[k];
      nextTok = {}; // 하나 쓰면 나머지는 버림 (코인은 판 순서대로만 받음)
      if (pre && Date.now() - pre.at < NEXT_TOKEN_MS) {
        usedPre.push(k);
        return Promise.resolve({ runToken: pre.tok });
      }
      return withCoins((coins, offline, lost) => http('POST', '/api/runs', { level, track: takeTrack(), coins, offline, lost, pre: usedPre.splice(0) }));
    },
    submitScore: (payload) => {
      lbCache.clear();
      nextTok = {};
      return withCoins((coins, offline, lost) => http('POST', '/api/scores', { ...payload, track: takeTrack(), coins, offline, lost, pre: usedPre.splice(0) })).then((r) => {
        if (r && r.next && typeof r.next === 'object') for (const [k, tok] of Object.entries(r.next)) if (typeof tok === 'string') nextTok[k] = { tok, at: Date.now() };
        return r;
      });
    },
    // 랭킹은 1분 동안 같은 걸 다시 씀 (탭을 왔다 갔다 해도 요청 안 함). 점수 올리면 비움
    leaderboard: (level) => {
      const hit = lbCache.get(String(level));
      if (hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/leaderboard?level=${level}`);
      lbCache.set(String(level), { at: Date.now(), p });
      p.catch(() => lbCache.delete(String(level)));
      return p;
    },
    // 🏛 명예의 전당: 랭킹처럼 1분 동안 같은 걸 다시 씀
    hall: (board, final = false) => {
      const key = 'hall:' + board + (final ? ':f' : '');
      const hit = lbCache.get(key);
      if (hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/hall?board=${board === 'endless' ? 'endless' : board === 'tiles' ? 'tiles' : 'stage'}${final ? '&final=1' : ''}`);
      lbCache.set(key, { at: Date.now(), p });
      p.catch(() => lbCache.delete(key));
      return p;
    },
    hallPhoto: (body) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/hall/photo', body);
    },
    // 💬 명예의 전당 한마디 / 🎁 운영자 선물 봤음(+ 한마디) (2026-11-22)
    hallMsg: (body) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/hall/msg', body);
    },
    giftAck: (msg) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/gift/ack', { msg: msg || null });
    },
    // 🗳 투표 (2026-11-23 시즌 2 피아노 미리보기)
    poll: (id) => http('GET', `/api/poll?id=${encodeURIComponent(id)}`),
    vote: (id, choice) => http('POST', '/api/poll', { id, choice }),
    logout: () => http('POST', '/api/logout'),
    // 🔑 카카오 로그인 (2026-11-26): 서버가 카카오 동의 화면 주소를 줌 → 그리로 이동
    kakaoStart: (mode) => http('POST', '/api/auth/kakao/start', { mode }),
    googleStart: (mode) => http('POST', '/api/auth/google/start', { mode }),
    suggest: (kind, text, contact) => http('POST', '/api/suggestions', { kind, text, contact }),
    room: (body) => http('POST', '/api/rooms', body),
    ranked: (body) => http('POST', '/api/ranked', body),
    transfer: (body) => http('POST', '/api/transfer', body),
    recoverRequest: (body) => http('POST', '/api/recover-request', body),
    recoverStatus: (token) => http('POST', '/api/recover-request/status', { token }),
    // 🎹 유저 맵: 목록은 1분 동안 같은 걸 다시 씀 (fresh 면 새로)
    maps: (sort, fresh) => {
      const key = 'maps:' + sort;
      const hit = lbCache.get(key);
      if (!fresh && hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/maps?sort=${sort === 'top' ? 'top' : 'new'}`);
      lbCache.set(key, { at: Date.now(), p });
      p.catch(() => lbCache.delete(key));
      return p;
    },
    mapGet: (id) => http('GET', `/api/maps/${encodeURIComponent(id)}?play=1`),
    mapUpload: (map) => {
      lbCache.delete('maps:new');
      return http('POST', '/api/maps', { map });
    },
    mapScore: (id, mode, score) => http('POST', `/api/maps/${encodeURIComponent(id)}/score`, { mode, score }),
    mapVote: (id, kind, on) => http('POST', `/api/maps/${encodeURIComponent(id)}/${kind === 'report' ? 'report' : 'like'}`, { on }),
    mapDelete: (id) => {
      lbCache.delete('maps:new');
      lbCache.delete('maps:top');
      return http('POST', `/api/maps/${encodeURIComponent(id)}/delete`);
    },
  };
}

// ---------------- 서버 없는 모드 (정적 호스팅) ----------------
// 랭킹·DM 인증은 서버가 있어야 진짜로 동작. 이 모드에선 화면에 '곧 오픈'으로 나오고,
// 아래 흐름은 내 컴퓨터(localhost)에서 개발할 때만 씀.
const isEndless = (level) => level === 'endless' || /^e\d+$/.test(String(level));

// 📴 서버(DB)가 쉬는 동안: 진짜 사이트면 Neon 에 남은 예전 랭킹(/api/snap/*)을 보여 줌 (5분 동안 같은 걸 다시 씀)
const isLocal = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const snapCache = new Map();
function snapGet(path) {
  const hit = snapCache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.p;
  const p = fetch(path, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  snapCache.set(path, { at: Date.now(), p });
  return p;
}

function mockApi(cfg) {
  const getPlayer = () => load('mockPlayer', null);
  const real = cfg.apiMode !== 'mock' && !isLocal();
  return {
    mode: 'mock',
    async buy() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async hallMsg() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async poll() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async vote() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async giftAck() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async config() {
      return { gateMode: cfg.gateMode, instagramHandle: cfg.instagramHandle };
    },
    async me() {
      const p = getPlayer();
      return p ? { verified: !p.guest, guest: !!p.guest, player: p } : { verified: false };
    },
    async intro(intro) {
      const p = { ...(getPlayer() || {}), intro };
      save('mockPlayer', p);
      return { verified: false, guest: true, player: p };
    },
    async avatar(av) {
      const p = { ...(getPlayer() || {}), av };
      save('mockPlayer', p);
      return { verified: false, guest: true, player: p };
    },
    async guest(name, ig, av) {
      const p = { username: String(name).trim(), ig, av, guest: true };
      save('mockPlayer', p);
      return { verified: false, guest: true, player: p };
    },
    async startRun(level) {
      return { runToken: `mock.${level}.${Date.now()}` };
    },
    async submitScore({ level, score, counts, rounds }) {
      const p = getPlayer();
      if (!p) {
        const e = new Error('verify_required');
        e.status = 401;
        throw e;
      }
      const board = load('mockBoard', {});
      if (isEndless(level)) {
        const prev = board[level];
        const improved = !prev || rounds > prev.rounds || (rounds === prev.rounds && score > prev.score);
        if (improved) board[level] = { username: p.username, rounds, score, at: Date.now() };
        save('mockBoard', board);
        return { improved, best: board[level].score, rounds: board[level].rounds, rank: 1 };
      }
      const prev = board[level];
      const improved = !prev || score > prev.score;
      if (improved) board[level] = { username: p.username, score, grade: gradeFor(counts), at: Date.now() };
      save('mockBoard', board);
      const lb = await this.leaderboard(level);
      return { best: improved ? score : prev.score, improved, rank: lb.me ? lb.me.rank : null };
    },
    async leaderboard(level) {
      if (real && level !== 'total') {
        const d = await snapGet(`/api/snap/leaderboard?level=${encodeURIComponent(level)}`);
        if (d && Array.isArray(d.entries)) return d;
        return { level, entries: [], me: null, snapFail: true };
      }
      if (isEndless(level)) {
        const mine = load('mockBoard', {})[level];
        const entries = mine ? [{ rank: 1, username: mine.username, rounds: mine.rounds, score: mine.score, me: true }] : [];
        return { level, entries, me: mine ? { rank: 1, rounds: mine.rounds, score: mine.score } : null, sample: true };
      }
      if (level === 'total') {
        const p = getPlayer();
        const bs = Object.entries(load('mockBoard', {})).filter(([k]) => /^\d+$/.test(k)).map(([, v]) => v);
        const me = p && bs.length ? { rank: 1, score: bs.reduce((a, b) => a + b.score, 0), levels: bs.length } : null;
        const entries = me ? [{ rank: 1, username: p.username, score: me.score, levels: me.levels, me: true }] : [];
        return { level: 'total', levels: 15, entries, me, sample: true };
      }
      const entries = [];
      const mine = load('mockBoard', {})[level];
      if (mine && !isEndless(level)) entries.push({ ...mine, me: true });
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((e, i) => (e.rank = i + 1));
      const me = entries.find((e) => e.me) || null;
      return { level: Number(level), entries, me, sample: true };
    },
    // 🎹 유저 맵: 서버가 쉬는 동안 예전 목록·맵 (치기만, 기록·좋아요·올리기는 안 됨)
    ...(real
      ? {
          async maps(sort) {
            const d = await snapGet(`/api/snap/maps?sort=${sort === 'top' ? 'top' : 'new'}`);
            if (!d || !Array.isArray(d.maps)) throw Object.assign(new Error('no_server'), { status: 503 });
            return d;
          },
          async mapGet(id) {
            const d = await snapGet(`/api/snap/maps/${encodeURIComponent(id)}`);
            if (!d || !d.map) throw Object.assign(new Error('no_server'), { status: 503 });
            return d;
          },
          async mapVote() {
            throw Object.assign(new Error('no_server'), { status: 503 });
          },
        }
      : {}),
    async hall(board) {
      if (real) {
        const d = await snapGet(`/api/snap/hall?board=${board === 'endless' ? 'endless' : 'stage'}`);
        if (d && Array.isArray(d.entries)) return d;
      }
      const s = seasonAt();
      return { season: { n: s.n, end: s.end }, board, levels: 15, entries: [], me: null, hall: [], sample: true };
    },
    async logout() {
      save('mockPlayer', null);
      return { ok: true };
    },
    async suggest() {
      return { ok: true, mock: true };
    },
    async room() {
      const e = new Error('no_server');
      e.status = 503;
      throw e;
    },
    async ranked() {
      const e = new Error('no_server');
      e.status = 503;
      throw e;
    },
  };
}

// 🧯 서버가 쉬는 중(db_down)이면 다음에 붙어 볼 시각을 폰에 적어 둠 (2026-11-22 밤).
//   서버가 쉬는 동안 폰마다 새로고침·판 시작 때마다 /api/health 를 불러 한 시간에 9천 건 → Worker 하루 한도(10만)를 위협.
//   서버가 알려 준 until(하루 한도면 오전 9시)까지, 단 최대 30분(+몇 분 흩뿌림) 동안은 묻지 않고 바로 서버 없는 모드.
//   새로고침해도 이어짐(폰 저장). 사람이 누른 인증·되찾기(force)는 바로 물어봄.
const DOWN_MAX_MS = 30 * 60 * 1000;
export function noteServerDown(data) {
  const now = Date.now();
  const hint = data && Number(data.until) > now ? Number(data.until) - now : 5 * 60 * 1000;
  const wait = Math.min(DOWN_MAX_MS, Math.max(2 * 60 * 1000, hint)) + Math.floor(Math.random() * 5 * 60 * 1000);
  try {
    save('srvNextTry', now + wait);
  } catch {}
}
export function serverResting() {
  const t = Number(load('srvNextTry', 0)) || 0;
  return t > Date.now() && t - Date.now() < DOWN_MAX_MS + 6 * 60 * 1000;
}

export async function createApi(cfg) {
  if (cfg.apiMode === 'mock') return mockApi(cfg);
  if (cfg.apiMode === 'server') return serverApi();
  // 서버가 쉬는 중이라고 적어 둔 동안은 묻지 않음 (force 면 물어봄)
  if (!cfg.force && serverResting()) return mockApi(cfg);
  // auto: /api/health 가 응답하면 서버 사용
  try {
    const ctrl = new AbortController();
    // Cloudflare 서버가 막 새로 떴을 땐 1~2초 걸릴 수 있음 → 넉넉히 (서버가 꺼져 있으면 바로 실패가 와서 오래 안 기다림)
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/health?boot=1', { signal: ctrl.signal, credentials: 'same-origin', headers: playerHeaders() });
    clearTimeout(timer);
    notePlayer(res);
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.app === 'okaystra') {
        save('srvNextTry', 0);
        return serverApi(j);
      }
    } else if (res.status === 503) {
      const j = await res.json().catch(() => null);
      if (j && j.error === 'db_down') noteServerDown(j);
    }
  } catch {}
  return mockApi(cfg);
}
