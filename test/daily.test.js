import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayMission, missionDone, streakView, markDone } from '../public/js/daily.js';

test('미션은 날마다 바뀌고 같은 날엔 같음', () => {
  const a = todayMission(200, new Date('2026-11-22T03:00:00Z'));
  const b = todayMission(200, new Date('2026-11-22T14:00:00Z')); // 한국 23시 → 같은 날
  const c = todayMission(200, new Date('2026-11-22T15:30:00Z')); // 한국 다음 날 00:30
  assert.equal(a.key, '2026-11-22');
  assert.deepEqual(a, b);
  assert.equal(c.key, '2026-11-23');
  assert.notEqual(a.kind, c.kind);
});

test('미션 판정', () => {
  const base = { counts: { perfect: 150, great: 30, good: 10, miss: 2, wrong: 0 }, maxCombo: 120, accuracy: 0.91, stars: 3, fullCombo: false };
  assert.equal(missionDone({ kind: 'combo', target: 100 }, base), true);
  assert.equal(missionDone({ kind: 'combo', target: 130 }, base), false);
  assert.equal(missionDone({ kind: 'acc', target: 85 }, base), true);
  assert.equal(missionDone({ kind: 'miss', target: 3 }, base), true);
  assert.equal(missionDone({ kind: 'miss', target: 3 }, { ...base, continued: 1 }), false);
  assert.equal(missionDone({ kind: 'fc', target: 0 }, base), false);
  assert.equal(missionDone({ kind: 'stars', target: 3 }, { ...base, auto: true }), false);
  assert.equal(missionDone({ kind: 'stars', target: 3 }, { ...base, failed: true }), false);
});

test('연속 일수', () => {
  let r = markDone(null, '2026-11-20').rec;
  assert.equal(r.streak, 1);
  r = markDone(r, '2026-11-21').rec;
  assert.equal(r.streak, 2);
  const again = markDone(r, '2026-11-21');
  assert.equal(again.isNew, false);
  assert.deepEqual(streakView(r, '2026-11-22'), { doneToday: false, streak: 2, best: 2 });
  assert.equal(streakView(r, '2026-11-23').streak, 0); // 하루 빠지면 끊김
  r = markDone(r, '2026-11-24').rec;
  assert.equal(r.streak, 1);
  assert.equal(r.best, 2);
});
