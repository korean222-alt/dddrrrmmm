// 📴 서버 없을 때 친 판의 최고 기록 (2026-11-22, D1 하루 한도가 차서 랭킹이 안 올라가던 날)
//   서버 없는 모드에선 판 토큰을 못 받아 점수를 못 올림 → 단계마다 최고 기록 하나만 폰에 모아 둠
//   서버가 돌아오면 다음 판 시작(/api/runs)·점수 등록(/api/scores)에 얹어 보냄 (코인처럼, 요청 안 늘림)
//   서버는 콩 수·점수 상한·친 시각(36시간 안)만 보고 받음. 한 번에 5개씩, 받은 것(done)만 지움
import { load, save } from './storage.js';

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
  for (const k of o.done) delete m[String(k)];
  save('offRecs', m);
  try {
    window.dispatchEvent(new CustomEvent('okaystra:offline-sent', { detail: { n: o.done.length, improved: o.improved || 0 } }));
  } catch {}
}
