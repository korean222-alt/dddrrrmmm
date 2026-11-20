import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barToMelody, melodyToBars, toggleDrum, cellChar, harmonize, autoDrums, cleanMap, mapLevel, transcribe, mapDifficulty } from '../public/js/usermap.js';
import { parseMelody, levelLanes } from '../public/js/charts.js';

test('멜로디 마디 ↔ 문자열', () => {
  const bar = [{ step: 2, midi: 72, len: 2 }, { step: 4, midi: 76, len: 4 }, { step: 12, midi: 79, len: 8 }];
  const s = barToMelody(bar);
  assert.equal(s, '_:2 C5:2 E5:4 _:4 G5:4');
  assert.equal(parseMelody([s]).length, 3);
  assert.deepEqual(melodyToBars([s])[0], [{ step: 2, midi: 72, len: 2 }, { step: 4, midi: 76, len: 4 }, { step: 12, midi: 79, len: 4 }]);
  assert.equal(barToMelody([]), '_:16');
});

test('드럼 칸: 같은 엄지는 하나만', () => {
  assert.equal(toggleDrum('.', 'K'), 'K');
  assert.equal(toggleDrum('K', 'S'), 'B');
  assert.equal(toggleDrum('B', 'H'), 'J');
  assert.equal(toggleDrum('J', 'C'), 'C');
  assert.equal(toggleDrum('X', 'S'), 'C');
  assert.equal(toggleDrum('K', 'K'), '.');
  assert.equal(cellChar({ C: true, H: true }), 'C');
});

test('화음·드럼 자동, 검사 통과, 단계로', () => {
  const bars = melodyToBars(['C5 E5 G5 E5', 'F5 A5 C6 A5', 'G5 B5 D6 B5', 'C6:16']);
  const prog = harmonize(bars);
  assert.equal(prog.length, 4);
  assert.equal(prog[0], 'C');
  assert.match(prog[1], /^F/);
  assert.match(prog[2], /^G/);
  for (const diff of ['easy', 'normal', 'hard']) {
    const drums = autoDrums(bars, diff);
    const map = cleanMap({ name: '시험', bpm: 120, bars: drums, melody: bars.map(barToMelody), prog });
    assert.ok(map, diff);
    const lv = mapLevel(map, { by: '나', mapId: 'abcdefg' });
    assert.ok(levelLanes(lv).length >= 2);
    assert.ok(mapDifficulty(map) >= 1 && mapDifficulty(map) <= 5);
  }
  assert.equal(cleanMap({ name: '', bpm: 120, bars: ['K...S...K...S...', 'K...S...K...S...'], melody: ['_:16', '_:16'], prog: ['C', 'C'] }), null);
  assert.equal(cleanMap({ name: 'x', bpm: 300, bars: ['K...S...K...S...', 'K...S...K...S...'], melody: ['_:16', '_:16'], prog: ['C', 'C'] }), null);
  assert.equal(cleanMap({ name: 'x', bpm: 120, bars: ['K...S...K...S...', 'K...S...K...S...'], melody: ['_:16', '_:16'], prog: ['C', 'Q'] }), null);
  assert.ok(cleanMap({ name: '<b>x</b>', bpm: 120, bars: ['K...S...K...S...', 'K...S...K...S...'], melody: ['_:16', '_:16'], prog: ['C', 'C'] }).name === 'bx/b');
});

test('음 따기: 사인파 멜로디를 거의 그대로 땀', () => {
  const sr = 22050;
  const bpm = 120;
  const step = 60 / bpm / 4;
  const want = [72, 72, 76, 77, 79, 79, 76, 74]; // 4분음표씩 2마디 (같은 음 두 번 = 따로)
  const mono = new Float32Array(Math.ceil(sr * (0.5 + want.length * step * 4 + 1)));
  want.forEach((m, i) => {
    const f = 440 * Math.pow(2, (m - 69) / 12);
    const a = Math.round((0.5 + i * step * 4) * sr);
    const n = Math.round(step * 4 * sr * 0.95);
    for (let k = 0; k < n; k++) mono[a + k] += 0.5 * (Math.sin((2 * Math.PI * f * k) / sr) + 0.4 * Math.sin((4 * Math.PI * f * k) / sr)) * Math.min(1, (n - k) / 200);
  });
  const r = transcribe(mono, sr, { firstBeat: 0.5, bpm, bars: 2 });
  const got = r.bars.flat().map((n) => n.midi);
  assert.deepEqual(got, want);
  assert.equal(r.bars.flat()[0].len, 4);
});
