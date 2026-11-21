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

test('음 정리: 16분 부스러기 → 8분, 옥타브 실수 고침', async () => {
  const { cleanMelody } = await import('../public/js/usermap.js');
  // 데크 더 홀즈 첫 마디를 지저분하게 딴 것 (실제 합창 녹음에서 나온 모양)
  const messy = [[
    { step: 0, midi: 74, len: 3 }, { step: 3, midi: 72, len: 1 }, { step: 4, midi: 71, len: 2 }, { step: 6, midi: 69, len: 1 }, { step: 7, midi: 81, len: 1 },
    { step: 8, midi: 67, len: 1 }, { step: 9, midi: 67, len: 1 }, { step: 10, midi: 69, len: 1 }, { step: 11, midi: 67, len: 1 }, { step: 12, midi: 71, len: 2 }, { step: 14, midi: 67, len: 2 },
  ]];
  const got = cleanMelody(messy)[0];
  assert.deepEqual(got.map((n) => n.midi), [74, 72, 71, 69, 67, 69, 71, 67]);
  assert.ok(got.every((n) => n.len === 2 && n.step % 2 === 0));
  // 앞뒤보다 한 옥타브 튄 음
  const oct = cleanMelody([[{ step: 0, midi: 67, len: 4 }, { step: 4, midi: 78, len: 4 }, { step: 8, midi: 67, len: 4 }]], { key: false })[0];
  assert.equal(oct[1].midi, 66);
});

test('음 따기: 스테레오면 가운데(보컬)만 — 좌우로 퍼진 반주 음에 안 속음', () => {
  const sr = 22050;
  const bpm = 120;
  const st = 60 / bpm / 4;
  const want = [72, 74, 76, 77, 79, 77, 76, 74];
  const len = Math.ceil((0.5 + 16 * 2 * st + 1) * sr);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  want.forEach((m, i) => {
    const a = Math.round((0.5 + i * 4 * st) * sr);
    const n = Math.round(4 * st * sr);
    for (let k = 0; k < n; k++) {
      const e = Math.min(1, k / 100, (n - k) / 200) * 0.3;
      const v = e * (Math.sin((2 * Math.PI * hz(m) * k) / sr) + 0.5 * Math.sin((4 * Math.PI * hz(m) * k) / sr));
      L[a + k] += v;
      R[a + k] += v;
    }
  });
  // 더 센 반주 음(A5)이 왼쪽에만, 다른 음(A4)이 오른쪽에만 계속
  for (let k = 0; k < len; k++) {
    L[k] += 0.6 * Math.sin((2 * Math.PI * hz(81) * k) / sr);
    R[k] += 0.6 * Math.sin((2 * Math.PI * hz(69) * k) / sr);
  }
  const r = transcribe([L, R], sr, { firstBeat: 0.5, bpm, bars: 2 });
  assert.deepEqual(r.bars.flat().map((n) => n.midi), want);
});

test('🥁 드럼만 맵: 멜로디가 다 쉼이어도 올라가고, 반주 없이 드럼만', () => {
  const bars = ['K...S...K.K.S...', 'K...S...K...S.S.', 'C...S...K...S...'];
  const map = cleanMap({ name: '드럼 곡', bpm: 110, bars, melody: bars.map(() => '_:16'), prog: harmonize(bars.map(() => [])) });
  assert.ok(map);
  const lv = mapLevel(map, { mapId: 'drum1' });
  assert.equal(lv.song.bass, '................');
  assert.equal(lv.song.chord, '................');
  const withMel = mapLevel({ ...map, melody: ['C5:16', '_:16', '_:16'] }, { mapId: 'x' });
  assert.equal(withMel.song.bass, 'x.......x.......');
});
