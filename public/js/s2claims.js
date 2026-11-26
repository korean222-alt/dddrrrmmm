// 🎁 시즌 2 출석·퀘스트 — 폰 쪽 (진행 세기 · 받기 모아 두기)
//   계정(서버 지갑)이면: 받기 누른 것을 모아 두었다가 다음 판 시작·점수 요청에 얹어 보냄(api.js withCoins) → 서버가 하루 한 번씩만 줌
//     화면 잔액엔 보내기 전부터 더해서 보여 줌(s2Bonus, coins.js coinTotal 이 더함) → 서버 답이 오면 서버 잔액으로
//   계정이 없으면: 폰 코인(coins)에 바로 (인증하면 그때 한 번 올라감)
import { load, save } from './storage.js';
import { kstDay, todayQuests, QUEST_ALL, attReward } from './quests.js';

const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** 오늘 진행 (날짜가 바뀌면 새로) */
function prog(now = Date.now()) {
  const day = kstDay(now);
  let p = load('s2q', null);
  if (!p || p.day !== day) p = { day, tplays: 0, dclear: 0, ttiles: 0, tstar: 0, tcombo: 0, tsongs: [], dchal: 0, claimed: [] };
  return p;
}
const saveProg = (p) => save('s2q', p);

/** 타일 한 판 끝 */
export function noteTilePlay(r, now = Date.now()) {
  const p = prog(now);
  p.tplays++;
  p.ttiles += int(r.hits ?? r.tiles); // 2026-11-27 부터 r.tiles 는 점수 → 친 타일 수는 hits
  p.tstar = Math.max(p.tstar, int(r.stars));
  p.tcombo = Math.max(p.tcombo, int(r.maxCombo));
  if (!p.tsongs.includes(r.songId)) p.tsongs.push(r.songId);
  saveProg(p);
}
/** 드럼 한 곡 끝까지 · 오늘의 챌린지 성공 */
export function noteDrum({ cleared = false, challenge = false } = {}, now = Date.now()) {
  const p = prog(now);
  if (cleared) p.dclear++;
  if (challenge) p.dchal = 1;
  saveProg(p);
}

/** 화면에 보일 오늘 퀘스트 [{ ...q, now, done, claimed }] + 모두 완료 칸 */
export function questView(now = Date.now()) {
  const p = prog(now);
  const val = (q) => (q.kind === 'tsongs' ? p.tsongs.length : int(p[q.kind]));
  const list = todayQuests(p.day).map((q) => {
    const v = Math.min(q.goal, val(q));
    return { ...q, now: v, done: v >= q.goal, claimed: p.claimed.includes(q.id) };
  });
  const all = { ...QUEST_ALL, now: list.filter((q) => q.claimed).length, goal: list.length, done: list.every((q) => q.claimed), claimed: p.claimed.includes(QUEST_ALL.id) };
  return { day: p.day, list, all, left: list.filter((q) => q.done && !q.claimed).length + (all.done && !all.claimed ? 1 : 0) };
}

function pend() {
  const x = load('s2Pend', null);
  return x && typeof x === 'object' ? { att: x.att || null, qd: x.qd || null, q: Array.isArray(x.q) ? x.q : [], cq: Array.isArray(x.cq) ? x.cq : [] } : { att: null, qd: null, q: [], cq: [] };
}
function addBonus(n) {
  save('s2Bonus', int(load('s2Bonus', 0)) + int(n));
}

/** 퀘스트 받기 → 받은 코인 (못 받으면 0) */
export function claimQuest(id, account, now = Date.now()) {
  const v = questView(now);
  const q = id === QUEST_ALL.id ? v.all : v.list.find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return 0;
  const p = prog(now);
  p.claimed.push(id);
  saveProg(p);
  if (account) {
    const x = pend();
    if (x.qd && x.qd !== v.day) x.q = [];
    x.qd = v.day;
    x.q.push(id);
    save('s2Pend', x);
    addBonus(q.reward);
  } else save('coins', int(load('coins', 0)) + q.reward);
  return q.reward;
}

/** 커뮤니티 퀘스트 받기 */
export function claimCommunity(c, account) {
  const got = load('s2Comm', []) || [];
  if (!c || !c.done || got.includes(c.id)) return 0;
  got.push(c.id);
  save('s2Comm', got);
  if (account) {
    const x = pend();
    x.cq.push(c.id);
    save('s2Pend', x);
    addBonus(c.reward);
  } else save('coins', int(load('coins', 0)) + c.reward);
  return c.reward;
}
export const communityClaimed = (id) => (load('s2Comm', []) || []).includes(id);

/** 출석 보기: { today(출석했나), streak(오늘까지 이어진 일수), next(오늘 받을/받은 코인), week[7] } */
export function attView(now = Date.now()) {
  const a = load('s2Att', null) || { day: '', streak: 0 };
  const today = kstDay(now);
  const yday = kstDay(now - 86400000);
  const done = a.day === today;
  const alive = done || a.day === yday;
  const streak = done ? a.streak : alive ? a.streak : 0;
  const nextStreak = done ? a.streak : streak + 1;
  const pos = ((nextStreak - 1) % 7) + 1; // 7칸 중 오늘 자리
  return { done, streak, todayReward: attReward(nextStreak), pos, week: Array.from({ length: 7 }, (_, i) => ({ n: i + 1, coins: attReward(nextStreak - pos + i + 1), on: i + 1 < pos || (done && i + 1 === pos), today: i + 1 === pos })) };
}

/** 한 판을 쳤음 → 오늘 첫 판이면 출석 (돌려줌: { streak, reward } 또는 null) */
export function noteAttendance(account, now = Date.now()) {
  const v = attView(now);
  if (v.done) return null;
  const today = kstDay(now);
  const streak = v.streak + 1;
  const reward = attReward(streak);
  save('s2Att', { day: today, streak });
  if (account) {
    const x = pend();
    x.att = today;
    save('s2Pend', x);
    addBonus(reward);
  } else save('coins', int(load('coins', 0)) + reward);
  return { streak, reward };
}

/** 요청에 얹을 것 (없으면 undefined) */
export function takeS2() {
  if (load('s2Sending', null)) return undefined;
  const x = pend();
  if (!x.att && !x.q.length && !x.cq.length) return undefined;
  save('s2Sending', { ...x, bonus: int(load('s2Bonus', 0)) });
  save('s2Pend', null);
  return x;
}

/** 응답: data.s2 가 있으면 서버가 처리함 (준 것만 잔액에 들어감 → 미리 보여 준 것은 뺌). 없으면 다시 줄에 */
export function s2Result(data) {
  const s = load('s2Sending', null);
  if (!s) return;
  save('s2Sending', null);
  if (data && data.s2 && typeof data.s2 === 'object') {
    save('s2Bonus', Math.max(0, int(load('s2Bonus', 0)) - int(s.bonus)));
    // 서버가 센 연속 출석일 (다른 폰에서도 쳤을 수 있음)
    if (data.s2.att && data.s2.att.streak) save('s2Att', { day: data.s2.att.day, streak: data.s2.att.streak });
    return;
  }
  const x = pend();
  save('s2Pend', { att: x.att || s.att, qd: x.qd || s.qd, q: [...new Set([...(s.q || []), ...x.q])], cq: [...new Set([...(s.cq || []), ...x.cq])] });
}
