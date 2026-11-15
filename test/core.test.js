import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS, levelLanes, HAT, CRASH, buildNotes, noteCount, maxScore, gradeFor, scoreBounds, pointsFor, isGated, parseMelody, parseChord, chordAt, noteToMidi, starsFor, accuracy } from '../public/js/charts.js';
import { sign, unsign } from '../server/session.js';

test('채보: 모든 마디가 16칸, 허용 문자만', () => {
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.id, i + 1);
    for (const bar of lv.bars) assert.match(bar, /^[KSHCBJX.]{16}$/, `Lv.${lv.id} ${bar}`);
    for (const k of ['hat', 'bass', 'chord']) assert.equal(lv.song[k].length, 16, `Lv.${lv.id} song.${k}`);
    assert.ok(lv.name && lv.composer && lv.difficulty >= 1 && lv.difficulty <= 5, `Lv.${lv.id} 정보`);
  });
});

test('곡: 멜로디 마디 길이 16칸, 코드 이름 해석', () => {
  for (const lv of LEVELS) {
    const notes = parseMelody(lv.song.melody);
    assert.ok(notes.length > 0);
    for (const n of notes) assert.ok(n.midi >= 55 && n.midi <= 90, `Lv.${lv.id} 음역 ${n.midi}`);
    for (let b = 0; b < lv.bars.length; b++) for (const s of [0, 8, 15]) assert.ok(chordAt(lv.song, b, s).notes.length >= 3);
  }
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('F#5'), 78);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.deepEqual(parseChord('F#m').notes, [66, 69, 73]);
  assert.equal(parseChord('G7').notes.length, 4);
  assert.throws(() => parseMelody(['C5 D5 E5']), /16칸/);
});

test('악기: 1~8단계 킥·스네어, 9단계 +하이햇, 12단계 +크래시', () => {
  for (let i = 0; i < 8; i++) assert.deepEqual(levelLanes(LEVELS[i]), [0, 1], `Lv.${i + 1}`);
  for (const i of [8, 9, 10]) assert.deepEqual(levelLanes(LEVELS[i]), [0, 1, HAT], `Lv.${i + 1}`);
  assert.deepEqual(levelLanes(LEVELS[11]), [CRASH, 0, 1, HAT]);
  assert.equal(LEVELS[8].newInstrument, HAT);
  assert.equal(LEVELS[11].newInstrument, CRASH);
  // 난이도는 단계가 올라갈수록 같거나 높아짐
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].difficulty >= LEVELS[i - 1].difficulty, `Lv.${i + 1} 난이도`);
  // 같은 엄지 레인(킥/크래시, 스네어/하이햇)에 동시 노트가 없어야 함
  for (const lv of LEVELS) {
    const byTime = new Map();
    for (const n of buildNotes(lv)) byTime.set(n.time, [...(byTime.get(n.time) || []), n.lane]);
    for (const lanes of byTime.values()) {
      assert.ok(!(lanes.includes(0) && lanes.includes(CRASH)), `Lv.${lv.id} 왼손 겹침`);
      assert.ok(!(lanes.includes(1) && lanes.includes(HAT)), `Lv.${lv.id} 오른손 겹침`);
    }
  }
});

test('Lv.1~3 공개, Lv.4+ 잠금 대상 (기준 단계 바꾸기 가능)', () => {
  assert.deepEqual(LEVELS.filter((l) => !isGated(l)).map((l) => l.id), [1, 2, 3]);
  assert.ok(isGated(LEVELS.find((l) => l.id === 4)));
  assert.equal(LEVELS.filter((l) => !isGated(l, 1)).length, 0);
});

test('별: 3개는 미스·헛침 없이 90%+, 헛침은 정확도 깎음', () => {
  assert.equal(starsFor({ perfect: 10, great: 0, good: 0, miss: 0, wrong: 0 }), 3);
  assert.equal(starsFor({ perfect: 10, great: 0, good: 0, miss: 0, wrong: 1 }), 2); // 헛침 1번이면 별 3개 불가
  assert.equal(starsFor({ perfect: 9, great: 0, good: 0, miss: 1 }), 2);
  assert.equal(starsFor({ perfect: 5, great: 2, good: 0, miss: 3 }), 1);
  assert.equal(starsFor({ perfect: 2, great: 0, good: 3, miss: 5 }), 0);
  assert.ok(accuracy({ perfect: 10, wrong: 10 }) === 0.5);
  assert.notEqual(gradeFor({ perfect: 10, great: 0, good: 0, miss: 0, wrong: 2 }), 'SS');
});

test('노트 생성: 동시치기는 두 레인 같은 시각', () => {
  for (const lv of LEVELS) {
    const notes = buildNotes(lv);
    assert.equal(notes.length, noteCount(lv));
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].time >= notes[i - 1].time);
  }
  const both = buildNotes(LEVELS[8]).filter((n) => n.pair === 0);
  assert.equal(both.length, 2);
  assert.equal(both[0].time, both[1].time);
});

test('점수: 만점, 등급, 범위', () => {
  const lv = LEVELS[0];
  const n = noteCount(lv);
  let s = 0;
  for (let c = 1; c <= n; c++) s += pointsFor('perfect', c);
  assert.equal(maxScore(lv), s);
  assert.equal(gradeFor({ perfect: n, great: 0, good: 0, miss: 0 }), 'SS');
  assert.equal(gradeFor({ perfect: 0, great: 0, good: 0, miss: n }), 'D');
  const b = scoreBounds({ perfect: n, great: 0, good: 0, miss: 0 });
  assert.ok(b.min <= s && s <= b.max);
});

test('서명 토큰', () => {
  const t = sign({ igsid: '1' }, 'k');
  assert.deepEqual(unsign(t, 'k'), { igsid: '1' });
  assert.equal(unsign(t, 'x'), null);
  assert.equal(unsign(t.slice(0, -2) + 'aa', 'k'), null);
});

test('1:1 도전장: 링크로 주고받기 + 위조/깨진 값 거부', async () => {
  const { encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome, todayLevel, kstDateKey, cleanName } = await import('../public/js/versus.js');
  const lv = LEVELS[11];
  const timeline = lv.bars.map((_, i) => (i + 1) * 1000);
  const r = { name: '쿵짝왕<script>', levelId: lv.id, score: timeline.at(-1), stars: 2, grade: 'A', accuracy: 0.912, timeline };
  const code = encodeChallenge(r);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = decodeChallenge(code);
  assert.equal(back.name, '쿵짝왕script');
  assert.equal(back.levelId, lv.id);
  assert.equal(back.score, r.score);
  assert.deepEqual(back.timeline, timeline);
  assert.equal(back.accuracy, 0.912);
  // 만점보다 큰 점수, 마디 수 다름, 깨진 문자열은 거부
  assert.equal(decodeChallenge(encodeChallenge({ ...r, score: maxScore(lv) + 1, timeline: [...timeline.slice(0, -1), maxScore(lv) + 1] })), null);
  assert.equal(decodeChallenge(encodeChallenge({ ...r, timeline: timeline.slice(1) })), null);
  assert.equal(decodeChallenge('%%%'), null);
  assert.equal(decodeChallenge(''), null);
  // 실시간 상대 점수: 마디 사이는 보간
  assert.equal(opponentScoreAt(timeline, -1), 0);
  assert.equal(opponentScoreAt(timeline, 0.5), 500);
  assert.equal(opponentScoreAt(timeline, 1), 1000);
  assert.equal(opponentScoreAt(timeline, 99), timeline.at(-1));
  assert.equal(versusOutcome(10, 5), 'win');
  assert.equal(versusOutcome(5, 10), 'lose');
  assert.equal(versusOutcome(5, 5), 'draw');
  assert.equal(cleanName('  가나다라마바사아자차카  '), '가나다라마바사아자차');
  // 오늘의 노래: 한국 시간 자정에 바뀌고 이틀 연속 같은 곡 없음
  assert.equal(kstDateKey(new Date('2026-11-14T15:30:00Z')), '2026-11-15');
  for (let d = 0; d < 14; d++) {
    const a = todayLevel(new Date(Date.UTC(2026, 10, 1 + d, 3)));
    const b = todayLevel(new Date(Date.UTC(2026, 10, 2 + d, 3)));
    assert.ok(a && b && a.id !== b.id);
  }
});

test('12단계 터키 행진곡: 같은 엄지로 16분음표 연타 없음 (사람이 깰 수 있게)', () => {
  const lv = LEVELS[11];
  const last = { L: -9, R: -9 };
  for (const n of buildNotes(lv)) {
    const h = n.lane === 0 || n.lane === CRASH ? 'L' : 'R';
    if (n.step !== last[h]) assert.ok(n.step - last[h] >= 2, `${h} 엄지 ${n.step}칸`);
    last[h] = n.step;
  }
});

test('목숨: MISS 5번이면 멈추고 이어하기 1번, 동시치기 둘 다 놓쳐도 1개, 콤보로 회복', async () => {
  const { Game, MAX_LIVES, LIFE_REGEN_COMBO, MAX_CONTINUES } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => 0, crash: noop };
  const deaths = [];
  let ended = null;
  const g = new Game({ audio, renderer, level: LEVELS[8], settings: {}, onDeath: (d) => deaths.push(d), onEnd: (r) => (ended = r) });
  g.startTime = 0;
  g.state = 'playing';
  g.player = { stop: noop };
  assert.equal(g.lives, MAX_LIVES);
  // 동시치기 한 쌍을 둘 다 놓침 → 목숨 1개만
  const pair = g.notes.filter((n) => n.pair === 0);
  pair.forEach((n) => g._miss(n, 0));
  assert.equal(g.lives, MAX_LIVES - 1);
  // 콤보 회복
  const singles = g.notes.filter((n) => n.pair < 0 && !n.judged);
  for (let i = 0; i < LIFE_REGEN_COMBO; i++) g._judge(singles[i], 0, 0);
  assert.equal(g.lives, MAX_LIVES);
  // 5번 MISS → 멈춤
  for (let i = 0; i < MAX_LIVES; i++) g._miss(singles[LIFE_REGEN_COMBO + i], 0);
  assert.equal(g.state, 'dead');
  assert.equal(deaths.length, 1);
  assert.equal(deaths[0].canContinue, MAX_CONTINUES > 0);
  // 이어하기 → 목숨 꽉 + 다음엔 이어하기 없음
  assert.ok(g.revive());
  assert.equal(g.lives, MAX_LIVES);
  assert.equal(g.state, 'paused');
  g.state = 'playing';
  g.graceUntil = -Infinity;
  const rest = g.notes.filter((n) => !n.judged && n.pair < 0);
  for (let i = 0; i < MAX_LIVES; i++) g._miss(rest[i], 0);
  assert.equal(deaths.length, 2);
  assert.equal(deaths[1].canContinue, false);
  g.giveUp();
  assert.equal(ended.failed, true);
  assert.equal(ended.stars, 0);
  assert.equal(ended.fullCombo, false);
  // 자동 연주(영상 찍기)엔 목숨 없음
  const auto = new Game({ audio, renderer, level: LEVELS[0], settings: {}, auto: true, onDeath: noop });
  assert.equal(auto.livesOn, false);
});
