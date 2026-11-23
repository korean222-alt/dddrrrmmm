// 🎹 시즌 2 피아노 미리보기 (2026-11-23): 음표 시각·건반·줄 나누기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { p2Notes, p2Keys, p2LiveLanes, P2_SOLFA } from '../public/js/piano2.js';
import { getLevel, tempoOf, COUNT_IN_BARS } from '../public/js/charts.js';

test('미리보기 곡: 음표는 카운트인 뒤부터 시간 순, 2분음표 이상은 꾹 누르기', () => {
  for (const id of [1, 2]) {
    const lv = getLevel(id);
    const notes = p2Notes(lv);
    assert.ok(notes.length > 20);
    assert.ok(Math.abs(notes[0].t - tempoOf(lv).barStart(COUNT_IN_BARS)) < 1e-9);
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t);
    assert.ok(notes.some((n) => n.hold) && notes.some((n) => !n.hold));
  }
});

test('B 건반: 흰 건반 8~10개, 곡의 모든 음이 건반에 있음', () => {
  for (const id of [1, 2]) {
    const notes = p2Notes(getLevel(id));
    const keys = p2Keys(notes);
    assert.ok(keys.length >= 8 && keys.length <= 10);
    for (const n of notes) assert.ok(keys.includes(n.midi), `${n.midi} 건반 없음`);
  }
  assert.equal(P2_SOLFA[60 % 12], '도');
  assert.equal(P2_SOLFA[67 % 12], '솔');
});

test('A 라이브: 4줄, 같은 음은 같은 줄, 높은 음일수록 오른쪽', () => {
  const notes = p2Notes(getLevel(1));
  const lanes = p2LiveLanes(notes);
  assert.ok(lanes.every((l) => l >= 0 && l <= 3));
  assert.equal(new Set(lanes).size, 4);
  const byMidi = new Map();
  notes.forEach((n, i) => {
    if (byMidi.has(n.midi)) assert.equal(byMidi.get(n.midi), lanes[i]);
    byMidi.set(n.midi, lanes[i]);
  });
  const sorted = [...byMidi.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] >= sorted[i - 1]);
});
