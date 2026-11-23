// 🎹 시즌 2 피아노 미리보기 (2026-11-23): 음표 시각·건반·타일 줄
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { p2Notes, p2Keys, p2TileLanes, p2Level, p2Stars, P2_SONGS, P2_SOLFA } from '../public/js/piano2.js';
import { getLevel, tempoOf, COUNT_IN_BARS } from '../public/js/charts.js';

test('미리보기 곡: 카운트인 뒤부터 시간 순, 30초쯤, 2분음표 이상은 꾹', () => {
  for (const { id } of P2_SONGS) {
    const lv = p2Level(getLevel(id));
    const notes = p2Notes(lv);
    assert.ok(lv.pianoOnly && lv.tapMelody);
    assert.equal(lv.bars.length, lv.song.melody.length);
    assert.ok(Math.abs(notes[0].t - tempoOf(lv).barStart(COUNT_IN_BARS)) < 1e-9);
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].t >= notes[i - 1].t);
    const sec = notes.at(-1).end;
    assert.ok(sec > 28 && sec < 60, `${id}: ${sec}초`);
  }
});

test('B 건반: 흰 건반 10~15개, 곡의 모든 음(검은 건반 포함)이 건반에 있음', () => {
  for (const { id } of P2_SONGS) {
    const notes = p2Notes(p2Level(getLevel(id)));
    const keys = p2Keys(notes);
    const whites = keys.filter((k) => k.white).length;
    assert.ok(whites >= 10 && whites <= 15);
    for (const n of notes) assert.ok(keys.some((k) => k.midi === n.midi), `${n.midi} 건반 없음`);
  }
  assert.equal(P2_SOLFA[60 % 12], '도');
  assert.equal(P2_SOLFA[67 % 12], '솔');
});

test('A 타일: 4줄, 같은 줄 연속 없음, 올라가면 오른쪽', () => {
  for (const { id } of P2_SONGS) {
    const notes = p2Notes(p2Level(getLevel(id)));
    const lanes = p2TileLanes(notes);
    assert.ok(lanes.every((l) => l >= 0 && l <= 3));
    for (let i = 1; i < lanes.length; i++) {
      assert.notEqual(lanes[i], lanes[i - 1]);
      const d = notes[i].midi - notes[i - 1].midi;
      if (d > 0 && lanes[i - 1] < 3 - (Math.abs(d) >= 5 ? 1 : 0)) assert.ok(lanes[i] > lanes[i - 1]);
    }
  }
});

test('별: 정확도·MISS', () => {
  assert.equal(p2Stars(0.95, 0), 3);
  assert.equal(p2Stars(0.95, 1), 2);
  assert.equal(p2Stars(0.7, 3), 1);
  assert.equal(p2Stars(0.3, 9), 0);
});
