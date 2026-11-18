import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS, getLevel, levelLanes, buildNotes, parseMelody, stepDur, tempoOf, TempoMap, CRASH, HAT, KICK, SNARE,
  makeEndless, shiftOldLevelKey, roundBpm, roundInfo, roundBars, diamondsFor, ROUND_BARS, COUNT_IN_BARS,
  isUnlocked, nextChallenge, ENDLESS_ID, LAST_LEVEL_ID, STEPS_PER_BAR, TOM, isLeftThumb, tierOf, unlockHint,
  ENDLESS_FROM, makeLevelEndless, levelEndlessBase, levelEndlessId, LEVEL_ENDLESS_STEP,
  STUDIO_LEVELS, getStudioLevel,
} from '../public/js/charts.js';

/** 같은 엄지(왼쪽: 킥·크래시·탐탐 / 오른쪽: 스네어·하이햇)로 2칸보다 촘촘한 연타가 없는지 */
function assertNoSameThumb16th(notes, label) {
  const last = { L: -9, R: -9 };
  for (const n of notes) {
    const h = isLeftThumb(n.lane) ? 'L' : 'R';
    if (n.step !== last[h]) assert.ok(n.step - last[h] >= 2, `${label} ${h} 엄지 ${n.step}칸`);
    last[h] = n.step;
  }
}

/** 같은 엄지로 2칸보다 촘촘하게 친 노트의 칸 번호들 */
function sameThumb16th(notes) {
  const last = { L: -9, R: -9 };
  const out = [];
  for (const n of notes) {
    const h = isLeftThumb(n.lane) ? 'L' : 'R';
    if (n.step !== last[h] && n.step - last[h] < 2) out.push(n.step);
    last[h] = n.step;
  }
  return out;
}

test('14단계 왕벌의 비행: 보스, 4악기, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(14);
  assert.equal(lv.name, '왕벌의 비행');
  assert.equal(lv.difficulty, 5);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, SNARE, HAT]);
  assertNoSameThumb16th(buildNotes(lv), 'Lv.14');
});

test('15단계 윌리엄 텔 서곡: 14단계보다 빠르고 촘촘한 진짜 최종 보스, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(15);
  const prev = getLevel(14);
  assert.equal(lv.name, '윌리엄 텔 서곡');
  assert.ok(LEVELS.every((l) => l.bpm <= lv.bpm), '제일 빠른 곡');
  assert.ok(lv.bpm > prev.bpm);
  // 1초에 치는 노트 수도 14단계보다 많음
  const density = (l) => buildNotes(l).length / (l.bars.length * (240 / l.bpm));
  assert.ok(density(lv) > density(prev), `15단계 ${density(lv).toFixed(2)} vs 14단계 ${density(prev).toFixed(2)}`);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, SNARE, HAT]);
  assertNoSameThumb16th(buildNotes(lv), 'Lv.15');
});

test('16단계 교향곡 40번: 탐탐이 더해진 5악기, 15단계보다 살짝 느림, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(16);
  assert.equal(lv.composer, '모차르트');
  assert.equal(lv.newInstrument, TOM);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, TOM, SNARE, HAT]);
  assert.ok(isLeftThumb(TOM) && isLeftThumb(KICK) && !isLeftThumb(SNARE));
  assert.ok(lv.bpm < getLevel(15).bpm && lv.bpm >= 112, `${lv.bpm} BPM`);
  for (let b = 0; b < lv.bars.length; b++) assert.equal(lv.bars[b].length, STEPS_PER_BAR, `마디 ${b}`);
  assert.equal(lv.song.melody.length, lv.bars.length);
  assert.doesNotThrow(() => parseMelody(lv.song.melody)); // 마디마다 16칸
  assertNoSameThumb16th(buildNotes(lv), 'Lv.16');
  // 단계별 무제한도 5악기 그대로
  assert.deepEqual(levelLanes(makeLevelEndless(lv)), levelLanes(lv));
});

test('17단계 라 쿠카라차: 클래식 아닌 전통 민요, 5악기 지옥, 킥 연타, 같은 엄지 16분음표 연타 없음', () => {
  const lv = getLevel(17);
  assert.equal(LAST_LEVEL_ID, 17);
  assert.match(lv.composer, /민요/);
  assert.equal(lv.difficulty, 5);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, TOM, SNARE, HAT]);
  for (let b = 0; b < lv.bars.length; b++) assert.equal(lv.bars[b].length, STEPS_PER_BAR, `마디 ${b}`);
  assert.equal(lv.song.melody.length, lv.bars.length);
  assert.doesNotThrow(() => parseMelody(lv.song.melody));
  assert.equal(lv.rolls[0].lane, KICK);
  assert.equal(lv.bars[lv.rolls[0].bar].replace(/\./g, '').length <= 1, true, '연타 마디엔 노트가 거의 없음');
  assertNoSameThumb16th(buildNotes(lv), 'Lv.17');
  // 단계별 무제한도 5악기 그대로
  assert.deepEqual(levelLanes(makeLevelEndless(lv)), levelLanes(lv));
});

test('8단계 운명 교향곡: 킥·스네어만, 14단계와 달리 느긋함(그리그보다 성김), 첫 소절은 빠바바밤, 웅장한 오케스트라', () => {
  const lv = getLevel(8);
  const next = getLevel(9);
  assert.equal(lv.name, '운명 교향곡');
  assert.equal(lv.composer, '베토벤');
  assert.ok(!lv.boss);
  assert.deepEqual(levelLanes(lv), [KICK, SNARE]);
  const density = (l) => buildNotes(l).length / (l.bars.length * (240 / l.bpm));
  assert.ok(density(lv) < density(next), `8단계 ${density(lv).toFixed(2)} vs 9단계 ${density(next).toFixed(2)}`);
  assert.ok(lv.difficulty <= next.difficulty);
  assertNoSameThumb16th(buildNotes(lv), 'Lv.8');
  // 웅장한 오케스트라 곡 표시 + 멜로디·코드가 마디 수와 맞음 (parseMelody 가 16칸 아니면 던짐)
  assert.ok(lv.song.epic);
  assert.equal(lv.song.melody.length, lv.bars.length);
  assert.equal(lv.song.prog.length, lv.bars.length);
  const mel = parseMelody(lv.song.melody);
  // 처음 네 음: G G G E♭ (빠바바밤)
  assert.deepEqual(mel.slice(0, 4).map((n) => n.midi), [79, 79, 79, 75]);
  // 8단계가 끼면서 예전 8~14단계는 9~15단계로: 기록 키 옮기기
  assert.equal(getLevel(9).name, '산왕의 궁전에서');
  assert.deepEqual(['7', '8', '14', '15', 'e8', 'e14', 'e7', '-8', '-14', '-7', '0', 'endless'].map(shiftOldLevelKey), ['7', '9', '15', '15', 'e9', 'e15', 'e7', '-9', '-15', '-7', '0', 'endless']);
  assert.equal(levelEndlessBase('e8').id, 8);
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
  assert.ok(isUnlocked(2, bests) && isUnlocked(3, bests), '1~3단계는 앞 단계 안 깨도 열림');
  assert.ok(!isUnlocked(4, bests));
  assert.ok(!isUnlocked(ENDLESS_ID, bests));
  assert.equal(nextChallenge(bests), 1);
  bests[3] = { stars: 0, score: 100 };
  assert.ok(!isUnlocked(4, bests), '별 0개는 못 깬 것');
  bests[3].stars = 1;
  assert.ok(isUnlocked(4, bests));
  assert.ok(!isUnlocked(5, bests));
  assert.equal(nextChallenge(bests), 1);
  for (const l of LEVELS) bests[l.id] = { stars: 2 };
  assert.ok(isUnlocked(ENDLESS_ID, bests));
  assert.equal(nextChallenge(bests), ENDLESS_ID);
  // 건너뛰는 단계 없음: 1→2→…→15 차례로, 그리그 무제한은 13단계를 깨면 열림
  assert.equal(ENDLESS_FROM, 13);
  const b2 = {};
  for (let i = 1; i <= 8; i++) b2[i] = { stars: 1 };
  assert.ok(isUnlocked(9, b2));
  assert.ok(!isUnlocked(10, b2), '9단계를 깨야 10단계');
  assert.equal(nextChallenge(b2), 9);
  for (let i = 9; i <= 12; i++) b2[i] = { stars: 1 };
  assert.ok(isUnlocked(13, b2));
  assert.ok(!isUnlocked(ENDLESS_ID, b2));
  b2[13] = { stars: 1 };
  assert.ok(isUnlocked(ENDLESS_ID, b2), '14·15단계 없이 13단계만 깨도 그리그 무제한');
  assert.equal(nextChallenge(b2), 14);
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
    // (5~11단계의 더블 킥처럼 원래 채보에 있는 건 그대로 둠. 13단계부터는 원래도 없음)
    const len = base.bars.length * STEPS_PER_BAR;
    const pre = COUNT_IN_BARS * STEPS_PER_BAR; // 노트 칸 번호는 카운트인 마디부터 셈
    const own = new Set(sameThumb16th(buildNotes(base)));
    for (const st of sameThumb16th(buildNotes(run))) assert.ok(own.has(((st - pre) % len) + pre), `e${base.id} 이음새 ${st}칸`);
    if (base.id >= 13) assertNoSameThumb16th(buildNotes(run), `e${base.id}`);
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

test('🎬 영상 전용 릴스 4드럼: 4악기, 10단계보다 느리고 그 정도 난이도, 단계 목록엔 없음', () => {
  const lv = getStudioLevel('r4');
  assert.ok(lv && lv.studioOnly);
  assert.ok(!LEVELS.includes(lv) && getLevel('r4') === null);
  assert.deepEqual(levelLanes(lv), [CRASH, KICK, SNARE, HAT]);
  const ten = getLevel(10);
  assert.ok(lv.bpm < ten.bpm);
  const density = (l) => buildNotes(l).length / (l.bars.length * (240 / l.bpm));
  assert.ok(density(lv) <= density(ten) * 1.05, `${density(lv).toFixed(2)} vs 10단계 ${density(ten).toFixed(2)}`);
  for (const b of lv.bars) assert.match(b, /^[KSHCBJX.]{16}$/);
  assertNoSameThumb16th(buildNotes(lv), 'r4');
  assert.equal(STUDIO_LEVELS.length >= 1, true);
});

test('같은 난이도 하나를 깨면 그 난이도 단계가 전부 열림 (지옥 하나 깨면 지옥 전부)', () => {
  assert.deepEqual(tierOf(13), [13, 14, 15, 16, 17]);
  assert.deepEqual(tierOf(9), [9, 10, 11, 12]);
  const b = {};
  for (let i = 1; i <= 12; i++) b[i] = { stars: 1 };
  // 12단계까지 깼으면 13(지옥 첫 곡)만 열림
  assert.ok(isUnlocked(13, b));
  assert.ok(!isUnlocked(14, b) && !isUnlocked(16, b));
  assert.equal(unlockHint(14, b).tier, true, '같은 난이도에 열린 단계가 있으면 그 난이도 하나만 깨면');
  assert.equal(unlockHint(14, b).short, '지옥 단계 하나만 깨면 열림');
  // 13단계를 깨면 지옥(13~16) 전부
  b[13] = { stars: 1 };
  for (const id of [14, 15, 16, 17]) assert.ok(isUnlocked(id, b), `${id}단계`);
  // 별 0개는 못 깬 것
  const c = { 1: { stars: 1 }, 2: { stars: 1 }, 3: { stars: 1 }, 4: { stars: 1 }, 5: { stars: 0 } };
  assert.ok(isUnlocked(5, c) && !isUnlocked(6, c) && !isUnlocked(8, c));
  c[5].stars = 2;
  for (const id of [6, 7, 8]) assert.ok(isUnlocked(id, c), `보통 ${id}단계`);
  assert.ok(!isUnlocked(9, c), '다음 난이도는 그대로 앞 단계(8)를 깨야');
  // 다른 난이도는 안 열림
  const d = { 16: { stars: 3 } };
  assert.ok(isUnlocked(13, d) && !isUnlocked(12, d));
  assert.equal(unlockHint(10, {}).short, '9단계 깨면 열림');
});

test('⚔️ 멀티 서바이벌: 곡 전체를 원래 빠르기로 한 번 → 그 뒤 4마디마다 빨라지며 끝없이, 상대가 지면 내 판도 바로 끝', async () => {
  const { levelSurvivalId, levelSurvivalBase, LEVEL_ENDLESS_STEP } = await import('../public/js/charts.js');
  const { survivalOutcome } = await import('../public/js/room.js');
  const base = getLevel(5);
  assert.equal(levelSurvivalId(5), 'v5');
  assert.equal(levelSurvivalBase('v5'), base);
  assert.equal(levelSurvivalBase('e5'), null);
  const lv = makeLevelEndless(base, { intro: true });
  assert.equal(lv.id, 'v5');
  assert.equal(lv.survival, true);
  const n = base.bars.length;
  assert.deepEqual(lv.bars.slice(0, n), base.bars, '1단계 = 곡 전체 그대로');
  assert.deepEqual(lv.bars.slice(n, n + ROUND_BARS), base.bars.slice(0, ROUND_BARS), '그다음은 곡 처음부터 4마디씩');
  assert.equal(lv.roundOfBar(n - 1), 1);
  assert.equal(lv.roundOfBar(n), 2);
  assert.equal(lv.roundOfBar(n + ROUND_BARS), 3);
  assert.equal(lv.tempo.bpm(COUNT_IN_BARS + n - 1), base.bpm, '곡 끝까지는 원래 빠르기');
  assert.equal(lv.tempo.bpm(COUNT_IN_BARS + n), base.bpm + LEVEL_ENDLESS_STEP);
  assert.equal(lv.tempo.bpm(COUNT_IN_BARS + n + ROUND_BARS), base.bpm + LEVEL_ENDLESS_STEP * 2);
  assert.equal(lv.roundProgress(n / 2), 0.5);
  assert.deepEqual(levelLanes(lv), levelLanes(base));

  const { Game } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const rounds = [];
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop, onRound: (i) => rounds.push(i.round) };
  const audio = { ctx: { state: 'running', suspend: async () => {}, resume: async () => {} }, heardTime: () => 0, crash: noop };
  let ended = null;
  const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: (r) => (ended = r) });
  assert.equal(g.endTime, Infinity, '둘 다 살아 있으면 끝없음');
  g.startTime = 0;
  g.state = 'playing';
  g.player = { stop: noop };
  // 곡이 끝나고 두 번째 4마디(Lv.3) 중간까지 버팀
  const t = lv.tempo.barStart(COUNT_IN_BARS + n + ROUND_BARS + 2);
  g._extend(t);
  g._checkRound(t, 0);
  assert.equal(g.round, 3);
  // 상대가 먼저 목숨을 다 씀 → 내 판도 지금 끝 (죽은 게 아님)
  g.songTime = () => t;
  assert.equal(g.endNow(), true);
  assert.equal(g.state, 'finished');
  assert.equal(ended.died, false);
  assert.equal(ended.roundsCleared, 2);
  assert.equal(ended.roundReached, 3);
  assert.ok(Math.abs(ended.survived - t) < 1e-9);
  assert.equal(g.endNow(), false, '두 번은 안 끝남');

  // 승패: 먼저 목숨 다 쓴 사람이 짐, 둘 다 졌으면 더 오래 버틴 쪽, 같으면 점수
  assert.equal(survivalOutcome({ died: false, survived: 10, score: 1 }, { died: true, survived: 10, score: 999 }), 'win');
  assert.equal(survivalOutcome({ died: true, survived: 50, score: 999 }, { died: false, survived: 50, score: 1 }), 'lose');
  assert.equal(survivalOutcome({ died: true, survived: 30, score: 1 }, { died: true, survived: 20, score: 999 }), 'win');
  assert.equal(survivalOutcome({ died: true, survived: 20, score: 5 }, { died: true, survived: 20.01, score: 3 }), 'win');
  assert.equal(survivalOutcome({ died: true, survived: 20, score: 3 }, { died: true, survived: 20, score: 3 }), 'draw');
});

test('🎵 릴스 박자 맞추기: BPM 고정, 단계 수만큼만, 노래 없이 드럼만', async () => {
  const { makeBeatReel, beatOpts, beatSeconds, BEAT_ID, ROUND_BARS, COUNT_IN_BARS, tempoOf, buildNotes, levelLanes, KICK, SNARE } = await import('../public/js/charts.js');
  const lv = makeBeatReel({ bpm: 128, rounds: 4, seed: 7, title: '하이라이트' });
  assert.equal(lv.id, BEAT_ID);
  assert.equal(lv.beat, true);
  assert.equal(lv.endless, false);
  lv.ensureBars(999);
  assert.equal(lv.bars.length, 4 * ROUND_BARS, '단계 수만큼만');
  const t = tempoOf(lv);
  for (let b = 0; b < COUNT_IN_BARS + lv.bars.length; b++) assert.ok(Math.abs(t.barLen(b) - (4 * 60) / 128) < 1e-9, '빠르기 고정');
  assert.deepEqual(levelLanes(lv), [KICK, SNARE]);
  assert.equal(lv.roundInfo(1).name, '기본 쿵짝');
  assert.equal(lv.roundInfo(3).bpm, 128);
  // 같은 시드면 같은 채보 (다시 찍기)
  const again = makeBeatReel({ bpm: 128, rounds: 4, seed: 7 });
  again.ensureBars(999);
  assert.deepEqual(again.bars, lv.bars);
  assert.ok(buildNotes(lv).length > 20);
  // 빠른 곡은 16분음표 없음 (엄지 하나로 못 침)
  const fast = makeBeatReel({ bpm: 170, rounds: 6, seed: 3 });
  fast.ensureBars(999);
  for (const bar of fast.bars) assert.ok(![...bar].some((c, i) => c !== '.' && bar[i + 1] && bar[i + 1] !== '.'), bar);
  // 이상한 값 정리
  assert.equal(beatOpts({ bpm: 999 }).bpm, 200);
  assert.equal(beatOpts({ bpm: 'x', rounds: 0 }).bpm, 120);
  assert.equal(beatOpts({ rounds: 99 }).rounds, 6);
  assert.ok(Math.abs(beatSeconds({ bpm: 120, rounds: 4 }) - (COUNT_IN_BARS + 16) * 2) < 1e-9);
});
