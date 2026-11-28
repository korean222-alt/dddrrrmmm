// 🎵 노래 파일 → 피아노 타일 (최신곡으로 치기·영상 찍기 타일, 2026-11-28)
import test from 'node:test';
import assert from 'node:assert/strict';
import { songTiles } from '../public/js/beatsync.js';
import { songTileLap, MIN_TAP_SEC } from '../public/js/tiles.js';

function synth(bpm, sec, sr = 22050) {
  const x = new Float32Array(sec * sr);
  const beat = 60 / bpm;
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  for (let t = 0.5; t < sec - 1; t += beat / 2) {
    const i0 = Math.floor(t * sr);
    const k = Math.round((t - 0.5) / (beat / 2));
    for (let i = 0; i < sr * 0.25 && i0 + i < x.length; i++) {
      const tt = i / sr;
      if (k % 4 === 0) x[i0 + i] += Math.sin(2 * Math.PI * (60 + 80 * Math.exp(-tt * 30)) * tt) * Math.exp(-tt * 12) * 0.8;
      if (k % 4 === 2) x[i0 + i] += rnd() * Math.exp(-tt * 20) * 0.5;
      x[i0 + i] += rnd() * Math.exp(-tt * 60) * 0.12;
    }
  }
  return x;
}

test('노래 소리 → 박자 자리에 타일, 이웃 타일 0.2초 이상·같은 줄 연속 없음', () => {
  const sr = 22050;
  for (const bpm of [80, 120, 170]) {
    const x = synth(bpm, 30, sr);
    const bars = Math.floor((28 * bpm) / 240);
    let prev = 0;
    for (const diff of ['easy', 'normal', 'hard']) {
      const st = songTiles(x, sr, { firstBeat: 0.5, bpm, bars, diff });
      assert.ok([1, 2, 4].includes(st.u));
      assert.ok(bpm / (15 * st.u) <= 5, '한 줄 0.2초 이상');
      const lap = songTileLap({ bpm, bars, u: st.u, tiles: st.tiles });
      assert.ok(lap && lap.tiles.length >= 8, `${bpm} ${diff} 타일 ${lap && lap.tiles.length}`);
      assert.ok(lap.tiles.length >= prev, '어려울수록 같거나 많게');
      prev = lap.tiles.length;
      for (let i = 1; i < lap.tiles.length; i++) {
        assert.ok(lap.tiles[i].t - lap.tiles[i - 1].t >= MIN_TAP_SEC - 1e-6);
        assert.notEqual(lap.tiles[i].lane, lap.tiles[i - 1].lane);
      }
      // 타일은 노래 박(8분) 자리에: 첫 박 0.5초 기준 8분 격자
      const step = 15 / bpm;
      for (const t of lap.tiles) assert.equal(t.abs % 2, 0, '8분 자리');
      assert.ok(lap.tiles.every((t) => t.k === 0 && !t.coin));
      assert.ok(Math.abs(lap.tiles[1].t - (lap.tiles[1].abs - lap.tiles[0].abs) * step) < 1e-6);
    }
  }
});

test('조용한 노래는 타일 없음 → null', () => {
  const x = new Float32Array(22050 * 20);
  const st = songTiles(x, 22050, { firstBeat: 0, bpm: 120, bars: 8, diff: 'normal' });
  assert.equal(songTileLap({ bpm: 120, bars: 8, u: st.u, tiles: st.tiles }), null);
});
