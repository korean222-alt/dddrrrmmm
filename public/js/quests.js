// 🎁 시즌 2 출석 · 퀘스트 (2026-11-26) — 브라우저와 서버가 같이 씀
//   출석: 그날 한 판 이상 치면 (드럼이든 타일이든). 연속 일수마다 50·60·70·80·90·100·150, 8일째부터 150
//   오늘의 퀘스트: 날마다 3개 (날짜로 정해짐, 모두 같음) + 다 깨면 보너스. 진행은 폰이 세고, 받기는 서버가 하루 한 번씩만
//   커뮤니티 퀘스트: 운영자가 admin 에서 숫자(예: 인스타 팔로워 수)를 적고 달성 처리 → 모두가 한 번 받음
//   ⚠ 새 요청 없음: 폰이 받기 누른 걸 모아 두었다가 다음 판 시작·점수 요청(코인과 같이)에 얹어 보냄. 지갑 s2 칸(JSON)에 받은 것 적음

export const ATT_REWARD = [50, 60, 70, 80, 90, 100, 150];
export const attReward = (streak) => ATT_REWARD[Math.min(ATT_REWARD.length, Math.max(1, streak)) - 1];

/** 퀘스트 종류: kind = 폰이 세는 것 */
export const QUEST_POOL = [
  { id: 'tplay3', icon: '🎹', text: '타일 3판 치기', kind: 'tplays', goal: 3, reward: 50, easy: true },
  { id: 'drum1', icon: '🥁', text: '드럼 한 곡 끝까지', kind: 'dclear', goal: 1, reward: 50, easy: true },
  { id: 'ttile200', icon: '🎵', text: '타일 200개 치기', kind: 'ttiles', goal: 200, reward: 80 },
  { id: 'ttile500', icon: '🎵', text: '타일 500개 치기', kind: 'ttiles', goal: 500, reward: 120 },
  { id: 'tstar2', icon: '⭐', text: '타일 곡에서 별 2개', kind: 'tstar', goal: 2, reward: 100 },
  { id: 'tcombo60', icon: '🔥', text: '타일 60연속', kind: 'tcombo', goal: 60, reward: 80 },
  { id: 'tsongs3', icon: '🎶', text: '서로 다른 타일 곡 3개', kind: 'tsongs', goal: 3, reward: 80 },
  { id: 'dchal', icon: '🔥', text: '오늘의 드럼 챌린지 성공', kind: 'dchal', goal: 1, reward: 100 },
];
/** 오늘 퀘스트 3개 다 깨면 */
export const QUEST_ALL = { id: 'all', icon: '🎁', text: '오늘 퀘스트 모두 완료', reward: 100 };

/** 한국 날짜 'YYYY-MM-DD' */
export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const prevDay = (day) => new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);

function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** 그날 퀘스트 3개 (쉬운 것 1개 + 나머지 2개, 같은 종류 겹치지 않게) */
export function todayQuests(day) {
  const h = hash('q:' + day);
  const easy = QUEST_POOL.filter((q) => q.easy);
  const rest = QUEST_POOL.filter((q) => !q.easy);
  const out = [easy[h % easy.length]];
  let k = h >>> 3;
  while (out.length < 3) {
    const q = rest[k % rest.length];
    k = Math.imul(k, 1103515245) + 12345 >>> 0;
    if (!out.some((x) => x.kind === q.kind)) out.push(q);
  }
  return out;
}

/** 커뮤니티 퀘스트 기본값 (운영자가 admin 에서 숫자·달성을 바꿈) */
//   2026-11-26 사용자: 팔로워 2천 명이 되면 모두에게 2천 코인
export const COMMUNITY_DEFAULT = [{ id: 'f2000', icon: '📸', title: '오케이스트라 인스타 팔로워 2,000명', goal: 2000, now: 0, reward: 2000, done: false }];

/** admin 이 보낸 커뮤니티 퀘스트 목록 검사 */
export function cleanCommunity(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const q of list.slice(0, 6)) {
    if (!q || typeof q !== 'object') continue;
    const id = String(q.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
    const title = String(q.title || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40);
    if (!id || !title) continue;
    const num = (v, max) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.floor(Number(v)))) : 0);
    out.push({ id, icon: String(q.icon || '🎯').slice(0, 4), title, goal: Math.max(1, num(q.goal, 1e9)), now: num(q.now, 1e9), reward: num(q.reward, 50000), done: !!q.done });
  }
  return out;
}

/** 지갑 s2 칸 기본값 */
export const s2Of = (w) => ({ ad: '', as: 0, qd: '', qc: [], cq: [], ...((w && w.s2) || {}) });

/**
 * 받기 요청 처리 (서버): w = 지갑, req = { att: 'YYYY-MM-DD', q: [퀘스트 id], cq: [커뮤니티 id] }
 *   → { wallet, changed, out: { att?: { day, streak, reward }, q: [받은 id], cq: [받은 id], gave } }
 *   폰이 보낸 날짜는 오늘·어제만 받음 (자정 넘어 보낸 어제 것), 같은 날 두 번은 안 줌
 */
export function applyS2(w0, req, community = [], now = Date.now()) {
  const w = { coins: 0, ...(w0 || {}) };
  const s = s2Of(w);
  const today = kstDay(now);
  const yday = prevDay(today);
  const out = { q: [], cq: [], gave: 0 };
  let changed = false;
  const give = (n) => {
    w.coins = (w.coins || 0) + n;
    out.gave += n;
    changed = true;
  };
  if (req && (req.att === today || req.att === yday) && s.ad < req.att) {
    const streak = s.ad === prevDay(req.att) ? (s.as || 0) + 1 : 1;
    const reward = attReward(streak);
    s.ad = req.att;
    s.as = streak;
    give(reward);
    out.att = { day: req.att, streak, reward };
  }
  if (req && Array.isArray(req.q) && req.q.length) {
    const day = typeof req.qd === 'string' && (req.qd === today || req.qd === yday) ? req.qd : today;
    if (s.qd !== day) {
      if (s.qd > day) return finish();
      s.qd = day;
      s.qc = [];
    }
    const list = todayQuests(day);
    for (const id of req.q.slice(0, 6)) {
      if (s.qc.includes(id)) continue;
      const q = list.find((x) => x.id === id);
      if (q) {
        s.qc.push(id);
        give(q.reward);
        out.q.push(id);
      } else if (id === QUEST_ALL.id && list.every((x) => s.qc.includes(x.id))) {
        s.qc.push(id);
        give(QUEST_ALL.reward);
        out.q.push(id);
      }
    }
  }
  if (req && Array.isArray(req.cq)) {
    for (const id of req.cq.slice(0, 6)) {
      const c = community.find((x) => x.id === id);
      if (!c || !c.done || s.cq.includes(id)) continue;
      s.cq.push(id);
      give(c.reward);
      out.cq.push(id);
    }
  }
  return finish();
  function finish() {
    w.s2 = s;
    return { wallet: w, changed, out };
  }
}
