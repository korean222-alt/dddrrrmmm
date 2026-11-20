// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 랭킹: guest(닉네임) → startRun() 으로 판 토큰 → submitScore() (끝까지 친 판은 알아서 올림)

import { load, save } from './storage.js';
import { gradeFor } from './charts.js';
import { takeTrack } from './track.js';

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const LB_CACHE_MS = 60 * 1000;
const lbCache = new Map();

function serverApi(boot = null) {
  // 첫 접속 때 /api/health?boot=1 로 받은 설정·내 정보는 한 번만 그대로 씀 (요청 아끼기)
  let bootConfig = boot && boot.config;
  let bootMe = boot && boot.me;
  return {
    mode: 'server',
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
    guest: (name, ig) => http('POST', '/api/guest', { name, ig }),
    verifyPassword: (body) => http('POST', '/api/verify/password', body),
    // 이용 통계는 따로 안 보내고 이 요청들에 얹어 보냄 (요청 수 아끼기)
    startRun: (level) => http('POST', '/api/runs', { level, track: takeTrack() }),
    submitScore: (payload) => {
      lbCache.clear();
      return http('POST', '/api/scores', { ...payload, track: takeTrack() });
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
    logout: () => http('POST', '/api/logout'),
    suggest: (kind, text, contact) => http('POST', '/api/suggestions', { kind, text, contact }),
    room: (body) => http('POST', '/api/rooms', body),
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

function mockApi(cfg) {
  const getPlayer = () => load('mockPlayer', null);
  return {
    mode: 'mock',
    async config() {
      return { gateMode: cfg.gateMode, instagramHandle: cfg.instagramHandle };
    },
    async me() {
      const p = getPlayer();
      return p ? { verified: !p.guest, guest: !!p.guest, player: p } : { verified: false };
    },
    async guest(name, ig) {
      const p = { username: String(name).trim(), ig, guest: true };
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
  };
}

export async function createApi(cfg) {
  if (cfg.apiMode === 'mock') return mockApi(cfg);
  if (cfg.apiMode === 'server') return serverApi();
  // auto: /api/health 가 응답하면 서버 사용
  try {
    const ctrl = new AbortController();
    // Cloudflare 서버가 막 새로 떴을 땐 1~2초 걸릴 수 있음 → 넉넉히 (서버가 꺼져 있으면 바로 실패가 와서 오래 안 기다림)
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/health?boot=1', { signal: ctrl.signal, credentials: 'same-origin' });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.app === 'okaystra') return serverApi(j);
    }
  } catch {}
  return mockApi(cfg);
}
