import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBeat, songChart } from '../public/js/beatsync.js';
import { makeBeatReel, CHAR_LANES, isLeftThumb, ROUND_BARS } from '../public/js/charts.js';

const sr = 22050;
/** 가짜 노래: 쿵(55Hz)·짝(잡음)·가끔 아주 센 크래시 */
function fakeSong(bpm, first, bars, kicks = 'K.......K.K.....', snares = '....S.......S...') {
  const step = 60 / bpm / 4;
  const x = new Float32Array(Math.ceil(sr * (first + bars * 16 * step + 1)));
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < x.length; i++) x[i] = rnd() * 0.01;
  const add = (t, kind) => {
    const s0 = Math.floor(t * sr);
    for (let i = 0; i < sr * 0.2 && s0 + i < x.length; i++) {
      const e = Math.exp(-i / (sr * (kind === 'C' ? 0.15 : 0.04)));
      x[s0 + i] += kind === 'K' ? Math.sin((2 * Math.PI * 55 * i) / sr) * e * 0.8 : kind === 'S' ? rnd() * 0.8 * e : rnd() * 2.5 * e + Math.sin((2 * Math.PI * 55 * i) / sr) * e;
    }
  };
  for (let b = 0; b < bars; b++)
    for (let s = 0; s < 16; s++) {
      const t = first + (b * 16 + s) * step;
      if (kicks[s] === 'K') add(t, b % 4 === 0 && s === 0 ? 'C' : 'K');
      if (snares[s] === 'S') add(t, 'S');
    }
  return x;
}

test('🎧 화면 녹화 박자 찾기: BPM·첫 박(쿵)', () => {
  const x = fakeSong(128, 1.0, 10);
  const r = detectBeat(x, sr, { start: 0.5 });
  assert.ok(Math.abs(r.bpm - 128) < 0.1, String(r.bpm));
  assert.ok(Math.abs(r.firstBeat - 1.0) < 0.02, String(r.firstBeat));
});

test('🥁 노래 따라 채보: 노래의 쿵·짝·센 순간을 따라감 + 엄지 규칙', () => {
  const x = fakeSong(128, 1.0, 8);
  const n = songChart(x, sr, { firstBeat: 1.0, bpm: 128, bars: 8, diff: 'normal' });
  assert.equal(n.bars.length, 8);
  assert.equal(n.bars[0], 'X...S...K.K.S...', '센 순간은 크래시+스네어 동시에');
  assert.equal(n.bars[1], 'K...S...K.K.S...');
  const e = songChart(x, sr, { firstBeat: 1.0, bpm: 128, bars: 8, diff: 'easy' });
  assert.equal(e.bars[1], 'K...S...K...S...', '쉬움은 정박만');
  assert.ok(e.bars[0].startsWith('B'), '쉬움의 센 순간은 쿵+짝 동시에');
  // 소리가 끝난 뒤엔 기본 쿵짝
  const long = songChart(x, sr, { firstBeat: 1.0, bpm: 128, bars: 16, diff: 'normal' });
  assert.ok(long.covered < 16);
  assert.equal(long.bars[15], 'K...S...K...S...');
  // 엄지 규칙: 여러 빠르기·난이도에서
  const th = (c) => new Set((CHAR_LANES[c] || []).map((l) => (isLeftThumb(l) ? 'L' : 'R')));
  for (const bpm of [96, 128, 150, 170])
    for (const diff of ['easy', 'normal', 'hard']) {
      const song = fakeSong(bpm, 0.5, 8, 'K..K..K.K.K..K..', '....S..S....S.SS');
      const flat = songChart(song, sr, { firstBeat: 0.5, bpm, bars: 8, diff }).bars.join('');
      for (let i = 1; i < flat.length; i++) {
        const a = th(flat[i - 1]);
        assert.ok(![...th(flat[i])].some((h) => a.has(h)), `${bpm} ${diff} 같은 엄지 연타 @${i} ${flat}`);
        if (bpm > 140) assert.ok(flat[i - 1] === '.' || flat[i] === '.', `${bpm} ${diff} 16분 @${i}`);
      }
    }
  // 판에 얹기
  const lv = makeBeatReel({ bpm: 128, rounds: 2, style: 'song', diff: 'normal', bars: n.bars.slice(0, 2 * ROUND_BARS) });
  assert.equal(lv.beatStyle, 'song');
  assert.equal(lv.bars[0], 'X...S...K.K.S...');
  const fb = makeBeatReel({ bpm: 128, rounds: 2, style: 'song' });
  assert.equal(fb.beatStyle, 'steady', '화면 녹화가 없으면 비트로');
});
