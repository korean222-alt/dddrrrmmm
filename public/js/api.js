// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 랭킹: guest(닉네임) → startRun() 으로 판 토큰 → submitScore() (끝까지 친 판은 알아서 올림)

import { load, save } from './storage.js';
import { gradeFor } from './charts.js';

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

function serverApi() {
  return {
    mode: 'server',
    config: () => http('GET', '/api/config'),
    me: () => http('GET', '/api/me'),
    guest: (name, ig) => http('POST', '/api/guest', { name, ig }),
    startRun: (level) => http('POST', '/api/runs', { level }),
    submitScore: (payload) => http('POST', '/api/scores', payload),
    leaderboard: (level) => http('GET', `/api/leaderboard?level=${level}`),
    logout: () => http('POST', '/api/logout'),
  };
}

// ---------------- 서버 없는 모드 (정적 호스팅) ----------------
// 랭킹·DM 인증은 서버가 있어야 진짜로 동작. 이 모드에선 화면에 '곧 오픈'으로 나오고,
// 아래 흐름은 내 컴퓨터(localhost)에서 개발할 때만 씀.
function mockApi(cfg) {
  const getPlayer = () => load('mockPlayer', null);
  return {
    mode: 'mock',
    async config() {
      return { gateMode: cfg.gateMode, gateFromLevel: cfg.gateFromLevel, instagramHandle: cfg.instagramHandle, };
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
      if (level === 'endless') {
        const prev = board.endless;
        const improved = !prev || rounds > prev.rounds || (rounds === prev.rounds && score > prev.score);
        if (improved) board.endless = { username: p.username, rounds, score, at: Date.now() };
        save('mockBoard', board);
        return { improved, best: board.endless.score, rounds: board.endless.rounds, rank: 1 };
      }
      const prev = board[level];
      const improved = !prev || score > prev.score;
      if (improved) board[level] = { username: p.username, score, grade: gradeFor(counts), at: Date.now() };
      save('mockBoard', board);
      const lb = await this.leaderboard(level);
      return { best: improved ? score : prev.score, improved, rank: lb.me ? lb.me.rank : null };
    },
    async leaderboard(level) {
      if (level === 'endless') {
        const mine = load('mockBoard', {}).endless;
        const entries = mine ? [{ rank: 1, username: mine.username, rounds: mine.rounds, score: mine.score, me: true }] : [];
        return { level: 'endless', entries, me: mine ? { rank: 1, rounds: mine.rounds, score: mine.score } : null, sample: true };
      }
      if (level === 'total') {
        const p = getPlayer();
        const bs = Object.entries(load('mockBoard', {})).filter(([k]) => k !== 'endless').map(([, v]) => v);
        const me = p && bs.length ? { rank: 1, score: bs.reduce((a, b) => a + b.score, 0), levels: bs.length } : null;
        const entries = me ? [{ rank: 1, username: p.username, score: me.score, levels: me.levels, me: true }] : [];
        return { level: 'total', levels: 13, entries, me, sample: true };
      }
      const entries = [];
      const mine = load('mockBoard', {})[level];
      if (mine && level !== 'endless') entries.push({ ...mine, me: true });
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((e, i) => (e.rank = i + 1));
      const me = entries.find((e) => e.me) || null;
      return { level: Number(level), entries, me, sample: true };
    },
    async logout() {
      save('mockPlayer', null);
      return { ok: true };
    },
  };
}

export async function createApi(cfg) {
  if (cfg.apiMode === 'mock') return mockApi(cfg);
  if (cfg.apiMode === 'server') return serverApi();
  // auto: /api/health 가 응답하면 서버 사용
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health', { signal: ctrl.signal, credentials: 'same-origin' });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.app === 'okaystra') return serverApi();
    }
  } catch {}
  return mockApi(cfg);
}
