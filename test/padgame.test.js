// 🥁 쿵짝 패드 미리보기: 칸 만들기 · 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { padChart, padUnit, padJudge, PAD_SONGS, PAD_DIFFS, PAD_MIN_GAP, PadGame } from '../public/js/padgame.js';
import { getLevel } from '../public/js/charts.js';

test('칸: 이웃 칸 0.2초↑, 난이도 올라가면 칸이 같거나 많음, 패드는 0~2', () => {
  for (const id of PAD_SONGS) {
    const lv = getLevel(id);
    let prev = 0;
    for (const d of PAD_DIFFS) {
      const ch = padChart(lv, d.id);
      assert.ok(ch.gap >= PAD_MIN_GAP - 1e-9, `${lv.name} ${d.id} gap ${ch.gap}`);
      assert.ok(ch.cells.length >= prev);
      prev = ch.cells.length;
      for (const c of ch.cells) assert.ok(c.pad >= 0 && c.pad <= 2);
      for (let i = 1; i < ch.cells.length; i++) assert.ok(ch.cells[i].t - ch.cells[i - 1].t >= PAD_MIN_GAP - 1e-9);
      assert.ok(new Set(ch.cells.map((c) => c.pad)).size >= 2, `${lv.name} ${d.id} 패드 둘 이상`);
    }
  }
});

test('칸 간격: 느린 곡 보통 = 8분, 빠른 곡은 0.2초 규칙', () => {
  assert.equal(padUnit(88, 2.8), 2);
  assert.equal(padUnit(160, 3.6), 4); // 8분이면 0.19초 → 4분
  assert.equal(padUnit(88, 1.6), 4);
});

test('판정 창', () => {
  assert.equal(padJudge(0), 'perfect');
  assert.equal(padJudge(0.09), 'great');
  assert.equal(padJudge(-0.14), 'good');
  assert.equal(padJudge(0.3), null);
});

function fakeGame(id = 1, diff = 'normal') {
  const g = new PadGame({ audio: { playLane() {} }, canvas: { getContext: () => ({}) }, level: getLevel(id), diff, onEnd() {} });
  return g;
}

test('제때 맞는 패드 = 맞힘, 다른 패드 = 헛침, 지나가면 MISS', () => {
  const g = fakeGame();
  const [a, b, c] = g.cells;
  assert.equal(g.tap(a.pad, a.t + 0.01), 'perfect');
  assert.equal(g.tap((b.pad + 1) % 3, b.t), 'wrong');
  assert.equal(g.combo, 0);
  g.sweep(c.t - 0.05);
  assert.equal(b.judged, 'miss');
  assert.equal(g.tap(c.pad, c.t - 0.12), 'good');
});

test('모두 제때 치면 3별 풀콤보, 세 패드 마구 누르면 별 없음', () => {
  const g = fakeGame(7, 'hard');
  for (const c of g.cells) g.tap(c.pad, c.t);
  g.sweep(1e9);
  const r = g.result();
  assert.equal(r.stars, 3);
  assert.ok(r.full);
  const m = fakeGame(7, 'hard');
  for (const c of m.cells) for (const p of [0, 1, 2]) m.tap(p, c.t);
  m.sweep(1e9);
  assert.equal(m.result().stars, 0);
});
