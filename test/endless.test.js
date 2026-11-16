import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS, getLevel, levelLanes, buildNotes, stepDur, tempoOf, TempoMap, CRASH, HAT, KICK, SNARE,
  makeEndless, roundBpm, roundInfo, roundBars, diamondsFor, ROUND_BARS, COUNT_IN_BARS,
  isUnlocked, nextChallenge, ENDLESS_ID, LAST_LEVEL_ID, STEPS_PER_BAR,
  ENDLESS_FROM, makeLevelEndless, levelEndlessBase, levelEndlessId, LEVEL_ENDLESS_STEP,
} from '../public/js/charts.js';

/** 같은 엄지(왼쪽: 킥·크래시 / 오른쪽: 스네어·하이햇)로 2칸보다 촘촘한 연타가 없는지 */
function assertNoSameThumb16th(notes, label) {
  const last = { L: -9, R: -9 };
  for (const n of notes) {
    const h = n.lane === KICK || n.lane === CRASH ? 'L' : 'R';
    if (n.step !== last[h]) assert.ok(n.step - last[h] >= 2, `${label} ${h} 엄지 ${n.step}칸`);
    last[h] = n.step;
  }
}

/** 같은 엄지로 2칸보다 촘촘하게 친 노트의 칸 번호들 */
function sameThumb16th(notes) {
  const last = { L: -9, R: -9 };
  const out = [];
  for (const n of notes) {
    const h = n.lane === KICK || n.lane === CRASH ? 'L' : 'R';
    if (n.step !== last[h] && n.step - last[h] < 2) out.push(n.step);
    last[h] = n.step;
  }
  return out;
}

test('13단계 왕벌의 비행: 보스, 4악기, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(13);
  assert.equal(lv.name, '왕벌의 비행');
  assert.equal(lv.difficulty, 5);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, SNARE, HAT]);
  assertNoSameThumb16th(buildNotes(lv), 'Lv.13');
});

test('14단계 윌리엄 텔 서곡: 13단계보다 빠르고 촘촘한 진짜 최종 보스, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(14);
  const prev = getLevel(13);
  assert.equal(lv.name, '윌리엄 텔 서곡');
  assert.equal(LAST_LEVEL_ID, 14);
  assert.ok(LEVELS.every((l) => l.bpm <= lv.bpm), '제일 빠른 곡');
  assert.ok(lv.bpm > prev.bpm);
  // 1초에 치는 노트 수도 13단계보다 많음
  const density = (l) => buildNotes(l).length / (l.bars.length * (240 / l.bpm));
  assert.ok(density(lv) > density(prev), `14단계 ${density(lv).toFixed(2)} vs 13단계 ${density(prev).toFixed(2)}`);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, SNARE, HAT]);
  assertNoSameThumb16th(buildNotes(lv), 'Lv.14');
});

test('박자 시계: 고정 BPM 은 예전 계산과 똑같고, 바뀌는 BPM 도 앞뒤가 맞음', () => {
  for (const lv of LEVELS) {
    const t = tempoOf(lv);
    for (const step of [0, 7, 16, 100, 333]) assert.ok(Math.abs(t.stepTime(step) - step * stepDur(lv)) < 1e-9);
  }
  const tm = new TempoMap((bar) => 100 + bar * 20);
  assert.equal(tm.barStart(1), 2.4); // 100 BPM 한 마디
  assert.ok(Math.abs(tm.barStart(2) - (2.4 + 2)) < 1e-9); // 다음 마디는 120 BPM
  for (const t of [0.1, 2.5, 7.77, 30]) assert.ok(Math.abs(tm.beatTime(tm.beatAt(t)) - t) < 1e-9);
  assert.equal(Math.floor(tm.barAt(tm.barStart(5) + 1e-6)), 5);
});

test('무제한 모드: 단계마다 BPM +10, 한도 없이 계속, 채보가 치는 동안 늘어남', () => {
  assert.equal(roundBpm(1), 90);
  assert.equal(roundBpm(2), 100);
  assert.equal(roundBpm(4), 120); // 릴스처럼 Lv.4 = 120 BPM
  assert.equal(roundBpm(50), 580);
  assert.equal(roundInfo(4).warn, '손가락 꼬임 주의!');
  assert.ok(roundInfo(99).name);
  const e = makeEndless({ seed: 7 });
  assert.equal(e.endless, true);
  assert.deepEqual(levelLanes(e), [KICK, SNARE]);
  e.ensureBars(ROUND_BARS * 30);
  assert.equal(e.bars.length, ROUND_BARS * 30);
  const t = e.tempo;
  assert.equal(t.bpm(0), 90); // 카운트인
  assert.equal(t.bpm(COUNT_IN_BARS), 90);
  assert.equal(t.bpm(COUNT_IN_BARS + ROUND_BARS), 100);
  assert.equal(t.bpm(COUNT_IN_BARS + ROUND_BARS * 29), roundBpm(30));
  const notes = buildNotes(e);
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].time >= notes[i - 1].time);
  assertNoSameThumb16th(notes, '무제한');
  // 같은 시드 = 같은 채보 / 단계별 점수 배율
  const e2 = makeEndless({ seed: 7 });
  e2.ensureBars(ROUND_BARS * 30);
  assert.deepEqual(e2.bars, e.bars);
  assert.ok(e.barMult[ROUND_BARS * 10] > e.barMult[0]);
  // 140 BPM 넘으면 16분음표(붙은 두 칸)는 안 나옴
  for (let r = 7; r <= 40; r++)
    for (const bar of roundBars(r)) assert.ok(![...bar].some((c, i) => c !== '.' && bar[i + 1] && bar[i + 1] !== '.'), `Lv.${r} ${bar}`);
  // 영상용 챌린지는 정해진 단계까지만
  const ch = makeEndless({ rounds: 4 });
  ch.ensureBars(999);
  assert.equal(ch.bars.length, ROUND_BARS * 4);
  assert.equal(ch.endless, false);
  for (const bar of ch.bars) assert.equal(bar.length, STEPS_PER_BAR);
});

test('다이아몬드: Lv.4 / Lv.7 / Lv.10 클리어', () => {
  assert.equal(diamondsFor(0), 0);
  assert.equal(diamondsFor(3), 0);
  assert.equal(diamondsFor(4), 1);
  assert.equal(diamondsFor(7), 2);
  assert.equal(diamondsFor(10), 3);
  assert.equal(diamondsFor(42), 3);
});

test('진행 잠금: 앞 단계를 별 1개 이상으로 깨야 열림, 마지막 단계를 깨면 무제한 모드', () => {
  const bests = {};
  assert.ok(isUnlocked(1, bests));
  assert.ok(!isUnlocked(2, bests));
  assert.ok(!isUnlocked(ENDLESS_ID, bests));
  assert.equal(nextChallenge(bests), 1);
  bests[1] = { stars: 0, score: 100 };
  assert.ok(!isUnlocked(2, bests), '별 0개는 못 깬 것');
  bests[1].stars = 1;
  assert.ok(isUnlocked(2, bests));
  assert.ok(!isUnlocked(3, bests));
  assert.equal(nextChallenge(bests), 2);
  for (const l of LEVELS) bests[l.id] = { stars: 2 };
  assert.ok(isUnlocked(ENDLESS_ID, bests));
  assert.equal(nextChallenge(bests), ENDLESS_ID);
  // 잠긴 단계(9·13·14)는 건너뜀: 10단계는 8단계를, 그리그 무제한은 12단계를 깨면 열림
  assert.equal(ENDLESS_FROM, 12);
  const b2 = { 1: { stars: 1 }, 2: { stars: 1 }, 3: { stars: 1 }, 4: { stars: 1 }, 5: { stars: 1 }, 6: { stars: 1 }, 7: { stars: 1 } };
  assert.ok(!isUnlocked(10, b2));
  assert.equal(nextChallenge(b2), 8);
  b2[8] = { stars: 1 };
  assert.ok(isUnlocked(10, b2), '9단계가 잠겨 있어도 8단계를 깨면 10단계');
  assert.equal(nextChallenge(b2), 10);
  b2[10] = { stars: 1 };
  b2[11] = { stars: 1 };
  assert.ok(isUnlocked(12, b2));
  assert.ok(!isUnlocked(ENDLESS_ID, b2));
  assert.equal(nextChallenge(b2), 12);
  b2[12] = { stars: 1 };
  assert.ok(isUnlocked(ENDLESS_ID, b2), '13·14단계 없이 12단계만 깨도 그리그 무제한');
  assert.equal(nextChallenge(b2), ENDLESS_ID);
});

test('단계별 무제한: 그 단계를 깨면 열림, 그 곡 채보를 4마디씩 끝없이, 4마디마다 빨라짐', () => {
  assert.equal(levelEndlessId(5), 'e5');
  assert.equal(levelEndlessBase('e5').id, 5);
  assert.equal(levelEndlessBase('endless'), null);
  assert.equal(levelEndlessBase(5), null);
  assert.ok(!isUnlocked('e5', {}));
  assert.ok(!isUnlocked('e5', { 5: { stars: 0 } }));
  assert.ok(isUnlocked('e5', { 5: { stars: 1 } }));
  assert.ok(!isUnlocked('e1', { 3: { stars: 2 } }), '그 단계를 깨야 열림');
  for (const base of LEVELS) {
    const run = makeLevelEndless(base);
    assert.equal(run.endless, true);
    assert.equal(run.id, `e${base.id}`);
    // 악기는 원래 단계 그대로 (채보가 늘어나도)
    assert.deepEqual(levelLanes(run), levelLanes(base));
    run.ensureBars(base.bars.length * 2 + ROUND_BARS);
    // 채보는 원래 단계 마디를 순서대로 되풀이
    for (let i = 0; i < run.bars.length; i++) assert.equal(run.bars[i], base.bars[i % base.bars.length]);
    // 빠르기: 원래 BPM 부터 4마디마다 +LEVEL_ENDLESS_STEP
    assert.equal(run.tempo.bpm(COUNT_IN_BARS), base.bpm);
    assert.equal(run.tempo.bpm(COUNT_IN_BARS + ROUND_BARS), base.bpm + LEVEL_ENDLESS_STEP);
    assert.equal(run.roundInfo(3).bpm, base.bpm + 2 * LEVEL_ENDLESS_STEP);
    // 곡이 처음으로 돌아가는 이음새에서 새로 생기는 같은 엄지 16분음표 연타는 없음
    // (5~11단계의 더블 킥처럼 원래 채보에 있는 건 그대로 둠. 12단계부터는 원래도 없음)
    const len = base.bars.length * STEPS_PER_BAR;
    const pre = COUNT_IN_BARS * STEPS_PER_BAR; // 노트 칸 번호는 카운트인 마디부터 셈
    const own = new Set(sameThumb16th(buildNotes(base)));
    for (const st of sameThumb16th(buildNotes(run))) assert.ok(own.has(((st - pre) % len) + pre), `e${base.id} 이음새 ${st}칸`);
    if (base.id >= 12) assertNoSameThumb16th(buildNotes(run), `e${base.id}`);
  }
});

test('무제한 모드 게임: 노트가 계속 추가되고, 목숨이 다 떨어지면 깬 단계·다이아로 결과', async () => {
  const { Game } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const rounds = [];
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop, onRound: (i) => rounds.push(i.round) };
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => 0, crash: noop };
  let ended = null;
  const lv = makeEndless({ seed: 3 });
  const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: (r) => (ended = r) });
  assert.equal(g.endTime, Infinity);
  g.startTime = 0;
  g.state = 'playing';
  g.player = { stop: noop };
  const before = g.notes.length;
  // Lv.6 한가운데까지 왔다고 치면 앞으로 2단계치 채보가 생김
  const t = lv.tempo.barStart(COUNT_IN_BARS + ROUND_BARS * 5 + 2);
  g._extend(t);
  g._checkRound(t, 0);
  assert.ok(g.notes.length > before);
  assert.ok(lv.bars.length >= ROUND_BARS * 7);
  assert.equal(g.round, 6);
  assert.deepEqual(rounds, [6]);
  assert.ok(g.notes.every((n, i) => n.id === i));
  // 점수: 빠른 단계일수록 배율
  const late = g.notes.find((n) => n.mult > 1.4);
  g._judge(late, 0, 0);
  assert.ok(g.score > 1000);
  // 거기서 목숨 다 씀 → 5단계 깸 → 다이아 1개
  g.diedAt = t;
  g.state = 'dead';
  g.giveUp();
  assert.equal(ended.challenge, true);
  assert.equal(ended.endless, true);
  assert.equal(ended.roundsCleared, 5);
  assert.equal(ended.diamonds, 1);
  assert.equal(ended.bpmReached, 140);
  assert.equal(ended.failed, false);
});

test('헛침(노트 없는 곳 누름)도 목숨 1개, 두 엄지 동시 헛침은 1개만', async () => {
  const { Game, MAX_LIVES } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  let t = 0;
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => t, crash: noop, playLane: noop };
  const g = new Game({ audio, renderer, level: getLevel(1), settings: {}, onDeath: noop, onEnd: noop });
  g.startTime = 0;
  g.state = 'playing';
  g.player = { stop: noop };
  // 1단계 첫 노트는 카운트인 뒤. 노트 사이 빈 곳을 누름
  const n0 = g.notes[0];
  t = n0.time + 0.5;
  g.input(KICK, 0);
  assert.equal(g.counts.wrong, 1);
  assert.equal(g.lives, MAX_LIVES - 1);
  // 거의 같은 순간 다른 엄지도 헛침 → 목숨은 그대로
  t += 0.05;
  g.input(SNARE, 0);
  assert.equal(g.counts.wrong, 2);
  assert.equal(g.lives, MAX_LIVES - 1);
  // 조금 뒤 또 헛침 → 하나 더
  t += 0.3;
  g.input(KICK, 0);
  assert.equal(g.lives, MAX_LIVES - 2);
  assert.equal(g.combo, 0);
});
