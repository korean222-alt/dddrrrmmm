// 🥁 쿵짝 패드 미리보기: 주사위 만들기 · 한 번 누르면 한 칸 (박자 판정 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { padChart, padStars, padBetter, PAD_SONGS, PAD_DIFFS, PadGame } from '../public/js/padgame.js';
import { getLevel } from '../public/js/charts.js';

test('주사위: 멜로디 음 하나 = 하나, 대부분 같은 주사위, 어려울수록 바뀌는 게 많음', () => {
  for (const id of PAD_SONGS) {
    const lv = getLevel(id);
    let prev = -1;
    for (const d of PAD_DIFFS) {
      const { cells } = padChart(lv, d.id);
      assert.ok(cells.length >= 30, `${lv.name} ${d.id} ${cells.length}개`);
      for (const c of cells) assert.ok(c.pad >= 0 && c.pad <= 2);
      const odd = cells.filter((c) => c.odd).length / cells.length;
      assert.ok(odd < 0.45, `${lv.name} ${d.id} 바뀜 ${odd}`);
      assert.ok(odd >= prev, `${lv.name} ${d.id} 어려울수록 더 바뀜`);
      prev = odd;
    }
  }
});

function fakeGame(id = 1, diff = 'normal') {
  const g = new PadGame({ audio: { playLane() {} }, canvas: { getContext: () => ({}) }, level: getLevel(id), diff, onEnd: (r) => (g.res = r) });
  return g;
}

test('맞는 패드 = 한 칸 채움, 틀린 패드 = 실수(칸 그대로), 시간은 첫 터치부터', () => {
  const g = fakeGame();
  const [a, b] = g.cells;
  assert.equal(g.tap(a.pad, 1000), 'ok');
  assert.equal(g.idx, 1);
  assert.equal(g.tap((b.pad + 1) % 3, 1200), 'miss');
  assert.equal(g.idx, 1);
  assert.equal(g.combo, 0);
  assert.equal(g.tap(b.pad, 1500), 'ok');
  assert.equal(g.elapsed(3000), 2);
});

test('다 채우면 끝 · 실수 없으면 별 3개', () => {
  const g = fakeGame(12, 'hard');
  let t = 0;
  for (const c of g.cells) g.tap(c.pad, (t += 250));
  assert.ok(g.res);
  assert.equal(g.res.stars, 3);
  assert.equal(g.res.miss, 0);
  assert.equal(g.res.maxCombo, g.cells.length);
  assert.equal(g.tap(0, t + 100), null);
});

test('별·기록 비교', () => {
  assert.equal(padStars(0), 3);
  assert.equal(padStars(3), 2);
  assert.equal(padStars(10), 1);
  assert.equal(padStars(11), 0);
  assert.ok(padBetter({ stars: 3, time: 30 }, { stars: 2, time: 10 }));
  assert.ok(padBetter({ stars: 2, time: 10 }, { stars: 2, time: 12 }));
  assert.ok(!padBetter({ stars: 2, time: 13 }, { stars: 2, time: 12 }));
  assert.ok(padBetter({ stars: 0, time: 99 }, { score: 5000, stars: 3 })); // 예전 기록(시간 없음)
});
