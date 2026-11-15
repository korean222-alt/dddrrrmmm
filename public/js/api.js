// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 흐름: createCode() → 사용자가 코드를 인스타 DM 으로 보냄 → 서버 웹훅이 받아서
//       checkFollow(igsid) → pollCode() 가 'verified' 를 받으면 쿠키로 기억

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
    createCode: (purpose) => http('POST', '/api/codes', { purpose }),
    guest: (name) => http('POST', '/api/guest', { name }),
    pollCode: (code) => http('GET', `/api/codes/${encodeURIComponent(code)}`),
    simulateDm: (code, opts = {}) => http('POST', '/api/dev/simulate-dm', { code, ...opts }),
    startRun: (level) => http('POST', '/api/runs', { level }),
    submitScore: (payload) => http('POST', '/api/scores', payload),
    leaderboard: (level) => http('GET', `/api/leaderboard?level=${level}`),
    logout: () => http('POST', '/api/logout'),
  };
}

// ---------------- 서버 없는 모드 (정적 호스팅) ----------------
// 랭킹·DM 인증은 서버가 있어야 진짜로 동작. 이 모드에선 화면에 '곧 오픈'으로 나오고,
// 아래 흐름은 내 컴퓨터(localhost)에서 개발할 때만 씀.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 서버의 checkFollow 와 같은 모양. 지금은 항상 "팔로우 확인됨" */
export async function mockCheckFollow(igsid) {
  return { following: true, username: 'tester', igsid };
}

function mockApi(cfg) {
  const codes = new Map();
  const getPlayer = () => load('mockPlayer', null);
  return {
    mode: 'mock',
    async config() {
      return { gateMode: cfg.gateMode, gateFromLevel: cfg.gateFromLevel, instagramHandle: cfg.instagramHandle, followCheckMode: 'fake', devSimulate: true, codePrefix: cfg.codePrefix };
    },
    async me() {
      const p = getPlayer();
      return p ? { verified: !p.guest, guest: !!p.guest, player: p } : { verified: false };
    },
    async guest(name) {
      const p = { username: String(name).trim(), guest: true };
      save('mockPlayer', p);
      return { verified: false, guest: true, player: p };
    },
    async createCode(purpose) {
      let c = '';
      for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      const rec = { code: c, display: `${cfg.codePrefix}-${c}`, purpose, status: 'pending', expiresAt: Date.now() + 10 * 60 * 1000 };
      codes.set(c, rec);
      return rec;
    },
    async pollCode(code) {
      const rec = codes.get(code);
      if (!rec) return { status: 'expired' };
      if (rec.status === 'pending' && Date.now() > rec.expiresAt) rec.status = 'expired';
      return { status: rec.status, player: rec.player };
    },
    async simulateDm(code, opts = {}) {
      const rec = codes.get(code);
      if (!rec) throw new Error('코드 없음');
      const r = opts.notFollowing ? { following: false, username: 'tester' } : await mockCheckFollow('mock-igsid');
      if (r.following) {
        rec.status = 'verified';
        rec.player = { username: r.username };
        save('mockPlayer', rec.player);
      } else rec.status = 'not_following';
      return { ok: true, status: rec.status };
    },
    async startRun(level) {
      return { runToken: `mock.${level}.${Date.now()}` };
    },
    async submitScore({ level, score, counts }) {
      const p = getPlayer();
      if (!p) {
        const e = new Error('verify_required');
        e.status = 401;
        throw e;
      }
      const board = load('mockBoard', {});
      const prev = board[level];
      const improved = !prev || score > prev.score;
      if (improved) board[level] = { username: p.username, score, grade: gradeFor(counts), at: Date.now() };
      save('mockBoard', board);
      const lb = await this.leaderboard(level);
      return { best: improved ? score : prev.score, improved, rank: lb.me ? lb.me.rank : null };
    },
    async leaderboard(level) {
      const entries = [];
      const mine = load('mockBoard', {})[level];
      if (mine) entries.push({ ...mine, me: true });
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
