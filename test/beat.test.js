import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBeatReel, ROUND_BARS } from '../public/js/charts.js';
import { barEnergy } from '../public/js/beatsync.js';

const notes = (bars) => bars.join('').replace(/\./g, '').length;

test('비트 어려움: 느린 곡(100 BPM 이하)은 16분이 들어가 더 빽빽 · 하이라이트 마디는 더 어렵게', () => {
  const slow = makeBeatReel({ style: 'steady', diff: 'hard', bpm: 75, rounds: 4, seed: 7 });
  const mid = makeBeatReel({ style: 'steady', diff: 'hard', bpm: 120, rounds: 4, seed: 7 });
  assert.ok(notes(slow.bars) / slow.bars.length >= 11, '느린 곡 어려움 마디당 11개 넘게');
  assert.ok(notes(slow.bars) > notes(mid.bars));
  // 앞 두 묶음 조용, 뒤 두 묶음 하이라이트
  const energy = Array.from({ length: 4 * ROUND_BARS }, (_, i) => (i < 2 * ROUND_BARS ? 0.1 : 0.9));
  const hl = makeBeatReel({ style: 'steady', diff: 'hard', bpm: 75, rounds: 4, seed: 7, energy });
  const calm = notes(hl.bars.slice(0, 2 * ROUND_BARS));
  const peak = notes(hl.bars.slice(2 * ROUND_BARS));
  assert.ok(peak > calm * 1.2, `하이라이트 ${peak} > 조용 ${calm}`);
});

test('barEnergy: 조용한 앞부분은 낮고 큰 소리 뒷부분은 높음', () => {
  const sr = 8000;
  const bpm = 120;
  const barSec = 2;
  const bars = 8;
  const s = new Float32Array(sr * barSec * bars);
  for (let i = 0; i < s.length; i++) {
    const t = i / sr;
    const beat = t % 0.5 < 0.05 ? 1 : 0.2;
    const amp = t < barSec * 4 ? 0.05 : 0.6;
    s[i] = amp * beat * Math.sin(2 * Math.PI * 220 * t);
  }
  const e = barEnergy(s, sr, { firstBeat: 0, bpm, bars });
  assert.ok(e[1] < 0.3 && e[6] > 0.7, JSON.stringify(e));
});
