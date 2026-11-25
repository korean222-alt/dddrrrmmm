// 📴 서버 없을 때 친 판의 최고 기록 (2026-11-22, D1 하루 한도가 차서 랭킹이 안 올라가던 날)
//   서버 없는 모드에선 판 토큰을 못 받아 점수를 못 올림 → 단계마다 최고 기록 하나만 폰에 모아 둠
//   서버가 돌아오면 다음 판 시작(/api/runs)·점수 등록(/api/scores)에 얹어 보냄 (코인처럼, 요청 안 늘림)
//   서버는 콩 수·점수 상한·친 시각(36시간 안)만 보고 받음. 한 번에 5개씩, 받은 것(done)만 지움
import { load, save, playerHeaders } from './storage.js';
import { SEASONS } from './season.js';

const KEEP_MS = 34 * 3600 * 1000; // 서버는 36시간까지 받음 → 조금 일찍 버림
const pending = () => {
  const m = load('offRecs', {});
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
};
const better = (a, b) => (a.rounds != null ? a.rounds > b.rounds || (a.rounds === b.rounds && a.score > b.score) : a.score > b.score);

/** 결과 하나 담기 (같은 단계는 더 좋은 것만). 담았으면 true */
export function queueOffline(r, endless) {
  const e = endless
    ? { level: r.levelId, rounds: r.roundsCleared, score: r.score, at: Date.now() }
    : { level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts, check: r.check, at: Date.now() };
  if (!Number.isInteger(e.score) || (endless ? !(r.roundsCleared >= 1) : !r.counts)) return false;
  const m = pending();
  const key = String(r.levelId);
  if (m[key] && Date.now() - m[key].at < KEEP_MS && !better(e, m[key])) return true;
  m[key] = e;
  save('offRecs', m);
  return true;
}

export const offlineCount = () => Object.keys(pending()).length;

/** 요청에 얹을 것 (없으면 undefined). 오래된 건 버림 */
export function takeOffline() {
  const m = pending();
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(m)) {
    if (!m[k] || !(now - m[k].at < KEEP_MS)) {
      delete m[k];
      changed = true;
    }
  }
  if (changed) save('offRecs', m);
  const list = Object.values(m);
  return list.length ? list.slice(0, 5) : undefined;
}

/** 응답: offline.done 에 든 단계는 지움 (서버가 받았거나 형식이 틀려 버림) */
export function offlineResult(data) {
  const o = data && data.offline;
  if (!o || !Array.isArray(o.done) || !o.done.length) return;
  const m = pending();
  const bk = load('offBk', {}) || {};
  for (const k of o.done) {
    delete m[String(k)];
    delete bk[String(k)];
  }
  save('offRecs', m);
  save('offBk', bk);
  try {
    window.dispatchEvent(new CustomEvent('okaystra:offline-sent', { detail: { n: o.done.length, improved: o.improved || 0 } }));
  } catch {}
}

/**
 * 📴 서버 보관함(Neon)에도 맡김 — D1 이 막혀도 받는 따로 된 길 (/api/offline-save). 폰 것도 그대로 둠
 *   맡긴 단계는 offBk 에 그 점수로 기억 → 화면에 '서버 보관함에도 저장됨'
 * @returns {Promise<boolean>} 이 기록이 서버 보관함에 들어갔나
 */
export async function backupOffline(levelId) {
  const m = pending();
  const list = Object.values(m);
  if (!list.length) return false;
  try {
    const res = await fetch('/api/offline-save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: playerHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ records: list }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    const bk = load('offBk', {}) || {};
    for (const k of d.saved || []) if (m[k]) bk[k] = m[k].score;
    save('offBk', bk);
    return levelId != null && isBackedUp(levelId);
  } catch {
    return false;
  }
}
export function isBackedUp(levelId) {
  const k = String(levelId);
  const m = pending();
  const bk = load('offBk', {}) || {};
  return !!m[k] && bk[k] === m[k].score;
}

// 🩹 11-22 13시~11-23 9시(KST) 서버가 쉬는 동안 친 기록은 이 폰이 저장도 안 하고 버렸음(submitRank 버그, 11-23 고침)
//   → '내 최고 기록'(bests)에 남은 그 시간 것을 다음 판 시작·점수 등록에 얹어 한 번 올림 (서버 validateLost, 시즌 1 끝까지)
const LOST_FROM = Date.parse('2026-11-22T04:00:00Z');
const LOST_TO = Date.parse('2026-11-23T00:00:00Z');
const LOST_UNTIL = SEASONS[0].end; // 시즌 1 끝까지만
export function takeLost() {
  if (load('lostSent', 0) || Date.now() > LOST_UNTIL) return undefined;
  let m = load('lostRecs', null);
  if (!m || typeof m !== 'object') {
    m = {};
    const bests = load('bests', {}) || {};
    for (const [k, b] of Object.entries(bests)) {
      if (!/^[1-9][0-9]*$/.test(k) || !b || !Number.isInteger(b.score) || !(b.at >= LOST_FROM && b.at < LOST_TO)) continue;
      m[k] = { level: Number(k), score: b.score, maxCombo: b.maxCombo, grade: b.grade, at: b.at };
    }
    save('lostRecs', m);
  }
  const list = Object.values(m);
  if (!list.length) {
    save('lostSent', 1);
    return undefined;
  }
  return list.slice(0, 5);
}
/** 응답 lost.done 에 든 단계는 지움 → 다 보냈으면 다시 안 봄 */
export function lostResult(data) {
  const o = data && data.lost;
  if (!o || !Array.isArray(o.done)) return;
  const m = load('lostRecs', {}) || {};
  for (const k of o.done) delete m[String(k)];
  save('lostRecs', m);
  if (!Object.keys(m).length) save('lostSent', 1);
}
