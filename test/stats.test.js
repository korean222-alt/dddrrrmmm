// 통계 집계 계산 (저장소와 무관한 순수 계산)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStats } from '../server/stats.js';

const D = 24 * 3600 * 1000;
// 2026-11-10 00:00 KST = 2026-11-09 15:00 UTC
const from = Date.UTC(2026, 10, 9, 15);

test('날짜는 한국시간으로 나누고, 새/재방문·완주율을 계산', () => {
  const raw = {
    sessions: [
      { sid: 's1', vid: 'v1', startedAt: from + 1000, activeSec: 100, ref: 'a', device: 'mobile' },
      { sid: 's2', vid: 'v1', startedAt: from + D + 1000, activeSec: 50, ref: 'a', device: 'mobile' },
      { sid: 's3', vid: 'v2', startedAt: from + D + 2000, activeSec: 0, ref: '', device: 'desktop' },
    ],
    plays: [
      { id: 'p1', vid: 'v1', level: '1', startedAt: from + 5000, result: 'clear', score: 100, stars: 3, sec: 60 },
      { id: 'p2', vid: 'v1', level: '1', startedAt: from + D + 5000, result: null, score: null, stars: null, sec: null },
      { id: 'p3', vid: 'v1', level: 'endless', startedAt: from + D + 6000, result: 'fail', score: 9, stars: 0, sec: 30 },
    ],
    newVids: ['v1'],
  };
  const s = buildStats(raw, { from, to: from + 2 * D - 1, tzMin: 540 });
  assert.deepEqual(s.perDay.map((d) => d.date), ['2026-11-10', '2026-11-11']);
  assert.equal(s.perDay[0].plays, 1);
  assert.equal(s.perDay[1].plays, 2);
  assert.equal(s.perDay[1].visitors, 2);
  assert.equal(s.totals.visitors, 2);
  assert.equal(s.totals.newVisitors, 1);
  assert.equal(s.totals.returningVisitors, 1);
  assert.equal(s.totals.quits, 1); // 결과 없는 판 = 중간에 나감
  assert.equal(s.totals.clearRate, 33.3);
  assert.equal(s.totals.avgSessionSec, 75); // 활동 0초 접속은 평균에서 제외
  assert.equal(s.playsPerVisitor['0'], 1); // v2 는 구경만
  assert.equal(s.playsPerVisitor['2-3'], 1);
  assert.equal(s.byHour[0], 3); // 한국시간 0시대
  assert.equal(s.byLevel[0].level, '1');
  assert.equal(s.byLevel[0].avgScore, 100);
  assert.equal(s.byLevel.at(-1).level, 'endless');
});

test('데이터가 없어도 0 으로', () => {
  const s = buildStats({ sessions: [], plays: [], newVids: [] }, { from, to: from + D - 1 });
  assert.equal(s.totals.visitors, 0);
  assert.equal(s.totals.clearRate, 0);
  assert.equal(s.perDay.length, 1);
});
