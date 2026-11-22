// 🔥 오늘의 챌린지 (2026-11-22): 오늘의 노래 + 날마다 바뀌는 미션 하나 + 연속 성공 일수.
// 전부 폰에서 계산·저장 (서버 요청 없음). 날짜는 한국 시간 자정에 바뀜.

import { kstDateKey } from './versus.js';

const DAY_MS = 86400000;

/** 미션 종류. need(곡 콩 수) → 목표 숫자 */
const KINDS = [
  { k: 'combo', text: (n) => `콤보 ${n} 넘기기`, need: (total) => Math.max(20, Math.round((total * 0.5) / 10) * 10) },
  { k: 'acc', text: (n) => `정확도 ${n}% 넘기기`, need: () => 85 },
  { k: 'stars', text: () => '별 3개 받기', need: () => 3 },
  { k: 'perfect', text: (n) => `PERFECT ${n}개`, need: (total) => Math.max(10, Math.round((total * 0.6) / 10) * 10) },
  { k: 'miss', text: (n) => `MISS ${n}개 이하로 끝까지`, need: () => 3 },
  { k: 'fc', text: () => '풀콤보', need: () => 0 },
];

const dayNo = (d = new Date()) => Math.floor((d.getTime() + 9 * 3600000) / DAY_MS);

/** 오늘의 미션 { key, kind, target, text } (곡 콩 수에 맞춰 목표를 정함) */
export function todayMission(total, d = new Date()) {
  const n = dayNo(d);
  // 같은 미션이 연달아 안 나오게 7 을 곱해 섞음
  const m = KINDS[(((n * 7) % KINDS.length) + KINDS.length) % KINDS.length];
  const target = m.need(total || 0);
  return { key: kstDateKey(d), kind: m.k, target, text: m.text(target) };
}

/** 이 판이 미션을 해냈나 (자동 연주·연습·실패 판은 안 됨) */
export function missionDone(mission, res) {
  if (!mission || !res || res.auto || res.practice || res.failed || res.stopped) return false;
  const t = mission.target;
  switch (mission.kind) {
    case 'combo': return (res.maxCombo || 0) >= t;
    case 'acc': return (res.accuracy || 0) * 100 >= t;
    case 'stars': return (res.stars || 0) >= t;
    case 'perfect': return ((res.counts && res.counts.perfect) || 0) >= t;
    case 'miss': return !res.continued && ((res.counts && res.counts.miss) || 0) <= t;
    case 'fc': return !!res.fullCombo;
    default: return false;
  }
}

/** 어제 날짜 키 */
function prevKey(key) {
  return new Date(Date.parse(key + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);
}

/**
 * 저장된 기록 { last, streak, best } 을 오늘 기준으로 읽기.
 * 오늘이나 어제 성공했으면 연속이 이어지고, 그 전이면 0 으로 보여 줌.
 */
export function streakView(rec, today = kstDateKey()) {
  const r = rec && typeof rec === 'object' ? rec : {};
  const doneToday = r.last === today;
  const alive = doneToday || r.last === prevKey(today);
  return { doneToday, streak: alive ? r.streak || 0 : 0, best: r.best || 0 };
}

/** 오늘 성공 기록하기 → 새 기록 (이미 오늘 했으면 그대로) */
export function markDone(rec, today = kstDateKey()) {
  const r = rec && typeof rec === 'object' ? rec : {};
  if (r.last === today) return { rec: r, isNew: false };
  const streak = r.last === prevKey(today) ? (r.streak || 0) + 1 : 1;
  const next = { last: today, streak, best: Math.max(r.best || 0, streak) };
  return { rec: next, isNew: true };
}
