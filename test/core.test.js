import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS, levelLanes, HAT, CRASH, buildNotes, noteCount, maxScore, gradeFor, scoreBounds, pointsFor, needsVerify, VERIFY_LEVELS, CLOSED_LEVELS, FREE_UPTO, isClosed, parseMelody, parseChord, chordAt, noteToMidi, starsFor, accuracy } from '../public/js/charts.js';
import { sign, unsign } from '../server/session.js';

test('채보: 모든 마디가 16칸, 허용 문자만', () => {
  // 본편은 1번부터 빈틈없이. 🎄 이벤트 곡은 본편 뒤 번호 (18·20 은 뺀 찬송가 자리라 안 씀)
  // 🎭 장거리 곡도 본편 밖 (본편 뒤 번호)
  LEVELS.filter((l) => !l.xmas && !l.long).forEach((lv, i) => assert.equal(lv.id, i + 1));
  for (const ev of LEVELS.filter((l) => l.xmas || l.long)) assert.ok(ev.id > LEVELS.filter((l) => !l.xmas && !l.long).length && ![18, 20].includes(ev.id), `이벤트 곡 번호 ${ev.id}`);
  LEVELS.forEach((lv) => {
    for (const bar of lv.bars) assert.match(bar, /^[KSHCTBJXY.]{16}$/, `Lv.${lv.id} ${bar}`);
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

test('악기: 1~9단계 킥·스네어, 10단계 +하이햇, 13단계 +크래시', () => {
  for (let i = 0; i < 9; i++) assert.deepEqual(levelLanes(LEVELS[i]), [0, 1], `Lv.${i + 1}`);
  for (const i of [9, 10, 11]) assert.deepEqual(levelLanes(LEVELS[i]), [0, 1, HAT], `Lv.${i + 1}`);
  assert.deepEqual(levelLanes(LEVELS[12]), [CRASH, 0, 1, HAT]);
  assert.equal(LEVELS[9].newInstrument, HAT);
  assert.equal(LEVELS[12].newInstrument, CRASH);
  // 난이도는 단계가 올라갈수록 같거나 높아짐
  // (🎄 캐롤 단계는 본편 순서 밖이라 뺌)
  const main = LEVELS.filter((l) => !l.xmas && !l.long);
  for (let i = 1; i < main.length; i++) assert.ok(main[i].difficulty >= main[i - 1].difficulty, `Lv.${i + 1} 난이도`);
  // 같은 엄지 레인(킥/크래시, 스네어/하이햇)에 동시 노트가 없어야 함
  for (const lv of LEVELS) {
    const byTime = new Map();
    for (const n of buildNotes(lv)) byTime.set(n.time, [...(byTime.get(n.time) || []), n.lane]);
    for (const lanes of byTime.values()) {
      assert.ok(lanes.filter((l) => l === 0 || l === CRASH || l === 4).length <= 1, `Lv.${lv.id} 왼손 겹침`);
      assert.ok(!(lanes.includes(1) && lanes.includes(HAT)), `Lv.${lv.id} 오른손 겹침`);
    }
  }
});

test('🎄 이벤트 곡: 깨도 같은 난이도 본편 단계가 열리지 않음', async () => {
  const { isUnlocked, tierOf } = await import('../public/js/charts.js');
  const ev = LEVELS.filter((l) => l.xmas);
  assert.ok(ev.length >= 3);
  for (const lv of ev) {
    assert.ok(isUnlocked(lv.id, {}), `이벤트 ${lv.id} 바로 열림`);
    const bests = { [lv.id]: { stars: 3 } };
    for (const m of LEVELS.filter((l) => !l.xmas && !l.long && l.id > 3 && l.difficulty === lv.difficulty)) assert.ok(!isUnlocked(m.id, bests), `이벤트 ${lv.id} → ${m.id}단계`);
    assert.ok(!tierOf(lv.id).some((id) => getLevelXmas(id)), '난이도 묶음에 이벤트 곡 없음');
  }
  function getLevelXmas(id) {
    return LEVELS.find((l) => l.id === id)?.xmas;
  }
});

test('1~3단계는 누구나, 4단계부터와 무제한 모드는 전부 팔로워 인증', () => {
  assert.equal(FREE_UPTO, 3);
  assert.deepEqual(VERIFY_LEVELS, []);
  assert.deepEqual(CLOSED_LEVELS, LEVELS.filter((l) => l.id >= 4).map((l) => l.id));
  for (const id of [1, 2, 3]) assert.ok(!isClosed(id) && !needsVerify(id), String(id));
  for (const id of [4, 9, 12, 14, 15, 'endless', 'e1', 'e5', 'e13', 'e15']) assert.ok(isClosed(id), String(id));
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
  const both = buildNotes(LEVELS[9]).filter((n) => n.pair === 0);
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
  const lv = LEVELS[12];
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

test('13단계 터키 행진곡: 같은 엄지로 16분음표 연타 없음 (사람이 깰 수 있게)', () => {
  const lv = LEVELS[12];
  const last = { L: -9, R: -9 };
  for (const n of buildNotes(lv)) {
    const h = n.lane === 0 || n.lane === CRASH ? 'L' : 'R';
    if (n.step !== last[h]) assert.ok(n.step - last[h] >= 2, `${h} 엄지 ${n.step}칸`);
    last[h] = n.step;
  }
});

test('목숨: MISS 5번이면 멈추고 이어하기 1번, 동시치기 둘 다 놓쳐도 1개, 콤보로 회복', async () => {
  const { Game, MAX_LIVES, LIFE_REGEN_COMBO, MAX_CONTINUES, REVIVE_LIVES } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => 0, crash: noop };
  const deaths = [];
  let ended = null;
  const g = new Game({ audio, renderer, level: LEVELS[9], settings: {}, onDeath: (d) => deaths.push(d), onEnd: (r) => (ended = r) });
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
  // 이어하기 → 목숨 2개로 다시 + 다음엔 이어하기 없음
  assert.equal(REVIVE_LIVES, 2);
  assert.ok(g.revive());
  assert.equal(g.lives, REVIVE_LIVES);
  assert.equal(g.state, 'paused');
  g.state = 'playing';
  g.graceUntil = -Infinity;
  const rest = g.notes.filter((n) => !n.judged && n.pair < 0);
  g._miss(rest[0], 0); // 하트 2개 → 두 번 놓치면 끝
  assert.equal(deaths.length, 1);
  g._miss(rest[1], 0);
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

test('💥 연타 구간 · ✨ 황금 콩: 점수는 그대로, 하트만 돌려받음', async () => {
  const { Game, MAX_LIVES } = await import('../public/js/game.js');
  const { getLevel, ROLL_HEART_HITS, ROLL_MAX_HEARTS, buildRolls, markGoldNotes, TOM, noteCount: nc } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop, onRoll: noop, onGold: noop };
  let clock = 0;
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock, crash: noop, playLane: noop };
  const lv = getLevel(16);
  const rolls = buildRolls(lv);
  assert.equal(rolls.length, 2);
  assert.equal(rolls[0].lane, TOM);
  // 연타 구간엔 노트가 없음
  const notes = buildNotes(lv);
  for (const r of rolls) assert.ok(!notes.some((n) => n.time >= r.t0 - 0.01 && n.time <= r.t1), '구간 안에 노트 없음');
  const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
  g.startTime = 0;
  g.state = 'playing';
  g.lives = 1;
  const roll = g.rolls[0];
  clock = (roll.t0 + roll.t1) / 2;
  // 다른 줄은 헛침이 아님 + 연타 안 셈
  g.input(1, 0);
  assert.equal(g.counts.wrong, 0);
  assert.equal(roll.hits, 0);
  for (let i = 0; i < ROLL_HEART_HITS * 4; i++) g.input(TOM, 0);
  assert.equal(roll.hits, ROLL_HEART_HITS * 4);
  assert.equal(g.lives, 1 + ROLL_MAX_HEARTS, '한 구간 최대 하트');
  assert.equal(g.score, 0, '연타는 점수 없음');
  assert.equal(g.counts.perfect + g.counts.great + g.counts.good + g.counts.miss, 0);
  // 황금 콩: 3개, 혼자 치는 노트, GREAT 이상이면 하트 +1 (점수는 보통 노트와 같음)
  assert.equal(g.goldTotal, 3);
  const golds = g.notes.filter((n) => n.gold);
  assert.ok(golds.every((n) => n.pair < 0));
  g.lives = 2;
  g._judge(golds[0], 0, 0);
  assert.equal(g.lives, 3);
  assert.equal(g.goldHits, 1);
  g._judge(golds[1], 0.12, 0); // GOOD → 하트 없음
  assert.equal(g.lives, 3);
  // 다른 단계도 황금 콩은 3개, 노트 수는 그대로
  for (const l of LEVELS) {
    const ns = buildNotes(l);
    assert.equal(markGoldNotes(ns), 3, `Lv.${l.id}`);
    assert.equal(ns.length, nc(l));
  }
  assert.ok(MAX_LIVES >= 3);
});

test('빠른 대결 묶음: 쉬움·보통 = 1~8단계, 어려움·극악 = 9~18단계, 인증 안 했으면 1~3단계만', async () => {
  const { BRACKETS, pickQuickLevel } = await import('../server/rooms.js');
  assert.deepEqual(BRACKETS.easy, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(BRACKETS.hard, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  for (let i = 0; i < 30; i++) assert.ok(pickQuickLevel('easy', false) <= 3);
  assert.equal(pickQuickLevel('easy', true, () => 0.99), 8);
  assert.equal(pickQuickLevel('hard', true, () => 0), 9);
});

test('👍 경계 근처 터치·엄지가 넘어온 터치는 노트 있는 옆 줄로 봐줌', async () => {
  const { Game } = await import('../public/js/game.js');
  const { KICK, SNARE, getLevel } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  let clock = 0;
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock, crash: noop, playLane: noop, sfxFile: noop };
  const make = () => {
    const g = new Game({ audio, renderer, level: LEVELS[0], settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    return g;
  };
  // 킥 혼자 나오는 곳 (스네어 노트 없음)
  let g = make();
  const kick = g.lanes[KICK].find((n) => !g.lanes[SNARE].some((m) => Math.abs(m.time - n.time) < 0.3));
  clock = kick.time;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.1 }]); // 가운데 경계 바로 옆 → 킥으로
  assert.equal(kick.judged, true);
  assert.equal(g.counts.wrong, 0);

  g = make();
  const kick2 = g.lanes[KICK].find((n) => !g.lanes[SNARE].some((m) => Math.abs(m.time - n.time) < 0.3));
  clock = kick2.time;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.8 }]); // 경계에서 멀면 그대로 헛침
  assert.equal(kick2.judged, false);
  assert.equal(g.counts.wrong, 1);

  // 키보드(옆 줄 정보 없음)는 예전 그대로
  g = make();
  const kick3 = g.lanes[KICK].find((n) => !g.lanes[SNARE].some((m) => Math.abs(m.time - n.time) < 0.3));
  clock = kick3.time;
  g.input(SNARE, 0);
  assert.equal(kick3.judged, false);

  // 동시치기: 두 엄지가 둘 다 스네어 쪽을 누름 → 두 번째는 넘어온 엄지로 보고 킥
  const lv = LEVELS.find((l) => {
    const ns = buildNotes(l);
    return ns.some((n) => n.lane === SNARE && ns.some((m) => m.lane === KICK && Math.abs(m.time - n.time) < 0.001));
  });
  assert.ok(lv, '킥+스네어 동시치기 있는 단계');
  g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
  g.startTime = 0;
  g.state = 'playing';
  const sn = g.lanes[SNARE].find((n) => g.lanes[KICK].some((m) => Math.abs(m.time - n.time) < 0.001));
  const kk = g.lanes[KICK].find((m) => Math.abs(m.time - sn.time) < 0.001);
  clock = sn.time;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.9 }]);
  g.input(SNARE, 0, [{ lane: KICK, d: 0.9 }]);
  assert.equal(sn.judged, true);
  assert.equal(kk.judged, true);
  assert.equal(g.counts.wrong, 0);

  // 🥁 산왕의 궁전: 킥 연타 남는 터치가 바로 뒤 스네어를 가져가도, 진짜 스네어 터치는 헛침이 아님 → 스네어는 제 터치 시간으로,
  //   헛침은 남는 킥 터치 몫 (벌은 그대로 한 번, 2026-11-24 '벌점 없으면 랭킹 의미 없다')
  const lv9 = getLevel(9);
  g = new Game({ audio, renderer, level: lv9, settings: {}, onDeath: noop, onEnd: noop });
  g.startTime = 0;
  g.state = 'playing';
  const s9 = g.lanes[SNARE].find((n) => g.lanes[KICK].some((m) => Math.abs(n.time - 0.15 - m.time) < 0.001));
  const k9 = g.lanes[KICK].find((m) => Math.abs(s9.time - 0.15 - m.time) < 0.001);
  for (const n of g.notes) if (n.time < k9.time - 0.01) {
    clock = n.time;
    g.input(n.lane, 0); // 앞 콩들은 제때 침
  }
  clock = k9.time;
  g.input(KICK, 0, [{ lane: SNARE, d: 0.2 }], 0.8); // 킥 제때
  clock = k9.time + 0.07;
  g.input(KICK, 0, [{ lane: SNARE, d: 0.22 }], 0.78); // 같은 엄지 연타 → 같은 자리라 '넘어온 엄지' 아님
  clock = s9.time;
  const wrong0 = g.counts.wrong;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.7 }], 1.7); // 진짜 스네어
  assert.equal(s9.result, 'perfect', '스네어는 진짜 스네어 터치 시간으로');
  assert.equal(g.counts.wrong, wrong0 + 1, '헛침은 남는 킥 터치 하나');
  assert.equal(g.counts.miss, 0);
});

test('🖐 터치 씹힘(2026-11-22): 조금 늦은 터치는 하트 하나만, 쿵짝쿵 경계 터치는 시간 맞는 줄로', async () => {
  const { Game } = await import('../public/js/game.js');
  const { KICK, JUDGE } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  let clock = 0;
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock, crash: noop, playLane: noop, sfxFile: noop };
  const make = (lv = LEVELS[0]) => {
    const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    return g;
  };
  let g;
  // 3) 조금 늦은 터치(GOOD 밖, 아직 MISS 전): 그 콩만 MISS, 헛침 없음, 다음 콩은 그대로
  g = make();
  const k = g.lanes[KICK];
  const before = g.lives;
  clock = k[0].time + JUDGE.good + 0.05;
  g.input(KICK, 0, [], 0.5);
  assert.equal(k[0].result, 'miss');
  assert.equal(g.counts.wrong, 0);
  assert.equal(k[1].judged, false);
  assert.equal(g.lives, before - 1, '하트는 하나만');

  // 4) 윌리엄 텔 '쿵짝쿵'(0.104초 간격): 쿵 엄지가 가운데 선을 살짝 넘어 짝 줄을 눌러도 쿵, 그다음 진짜 짝은 짝
  const { SNARE, getLevel } = await import('../public/js/charts.js');
  g = make(getLevel(15));
  const K = g.lanes[KICK];
  const S = g.lanes[SNARE];
  const kk = K.find((n) => S.some((s) => Math.abs(s.time - n.time - 0.104) < 0.01) && K.some((m) => Math.abs(m.time - n.time - 0.208) < 0.01));
  assert.ok(kk, '쿵짝쿵 자리');
  const ss = S.find((s) => Math.abs(s.time - kk.time - 0.104) < 0.01);
  clock = kk.time + 0.01;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.2 }], 2.2); // 쿵 엄지가 짝 줄 경계 바로 안쪽
  assert.equal(kk.judged, true, '쿵이 쳐져야 함');
  assert.equal(ss.judged, false, '짝 콩을 일찍 가져가면 안 됨');
  clock = ss.time - 0.01;
  g.input(SNARE, 0, [{ lane: KICK, d: 0.6 }], 2.6); // 진짜 짝
  assert.equal(ss.result, 'perfect');
  // 짝 엄지가 쿵 줄 경계 안쪽을 눌러도 (다음 쿵이 0.1초 뒤에 있어도) 짝
  const k2 = K.find((m) => Math.abs(m.time - kk.time - 0.208) < 0.01);
  const ss2 = S.find((s) => s.time > k2.time && Math.abs(s.time - k2.time - 0.104) < 0.01) || null;
  clock = k2.time;
  g.input(KICK, 0, [{ lane: SNARE, d: 0.6 }], 1.4);
  assert.equal(k2.result, 'perfect');
  if (ss2) {
    clock = ss2.time + 0.015;
    g.input(KICK, 0, [{ lane: SNARE, d: 0.15 }], 1.85);
    assert.equal(ss2.judged, true, '짝이 쳐져야 함');
  }
  assert.equal(g.counts.wrong, 0);
  assert.equal(g.counts.miss, 0);
});

test('🖐 터치 씹힘(2026-11-23): 엇박 늦은 쿵·선을 넘은 엄지·옆 줄 깊이 넘어간 엄지·늦은 터치 → 제 콩으로, 일찍 누름 MISS 는 안 되돌림', async () => {
  const { Game } = await import('../public/js/game.js');
  const { KICK, SNARE, JUDGE } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = new Proxy({}, { get: () => noop });
  let clock = 0;
  const audio = new Proxy({ ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock }, { get: (o, k) => (k in o ? o[k] : noop) });
  // 채보를 직접: 1마디 쉼 뒤 (100 BPM → 16분 0.15초, 144 BPM → 0.104초)
  const make = (bars, bpm = 100) => {
    const lv = { ...LEVELS[0], id: 999, bpm, bars: ['................', ...bars], song: LEVELS[0].song };
    const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    return g;
  };
  // 왼쪽 엄지(쿵) = 줄 0, 오른쪽(짝) = 줄 1. near·u 는 render.laneHit 와 같은 모양
  const tap = (g, u, at) => {
    clock = at;
    const i = u < 1 ? 0 : 1;
    const f = u - i;
    g.input(i === 0 ? KICK : SNARE, 0, [{ lane: i === 0 ? SNARE : KICK, d: i === 0 ? 1 - f : f }], u);
  };
  const sweep = (g, now) => {
    for (const lane of g.laneOrder) {
      const list = g.lanes[lane];
      while (g.ptr[lane] < list.length) {
        const n = list[g.ptr[lane]];
        if (n.judged) { g.ptr[lane]++; continue; }
        if (now - Math.max(n.time, n.hold || 0) > JUDGE.good + 0.12) { g._miss(n, 0); g.ptr[lane]++; continue; }
        break;
      }
    }
  };

  // 1) 엇박: 쿵을 0.1초 늦게, 가운데 선 근처에서 → 0.15초 뒤 짝 콩이 더 가까워 짝으로 옮겨짐 → 진짜 짝 터치가 오면 쿵은 쿵으로
  let g = make(['KS..............']);
  let k = g.lanes[KICK][0];
  let s = g.lanes[SNARE][0];
  tap(g, 0.85, k.time + 0.1);
  tap(g, 1.5, s.time + 0.11); // 짝도 조금 늦게 (쿵이 MISS 로 넘어가기 직전)
  sweep(g, s.time + 0.5);
  assert.equal(k.result, 'great', '쿵이 MISS 가 되면 안 됨');
  assert.equal(s.result, 'good', '짝은 진짜 짝 터치 시간으로');
  assert.equal(g.counts.miss + g.counts.wrong, 0);

  // 2) 윌리엄 텔 쿵짝: 쿵 엄지가 선을 살짝 넘어(짝 줄) 0.05초 늦게 → 짝 콩(0.104초 뒤)을 먼저 가져가도, 진짜 짝 터치가 오면 서로 바꿈
  g = make(['KS..............'], 144);
  k = g.lanes[KICK][0];
  s = g.lanes[SNARE][0];
  tap(g, 1.08, k.time + 0.05);
  tap(g, 1.6, s.time);
  sweep(g, s.time + 0.5);
  assert.equal(k.result, 'perfect', '쿵은 쿵 엄지 시간(0.05초)으로');
  assert.equal(s.result, 'perfect', '짝은 진짜 짝 터치로');
  assert.equal(g.counts.miss + g.counts.wrong, 0);

  // 3) 쿵 엄지가 짝 줄 안쪽까지(경계에서 0.4) 넘어가 제때 침, 짝 콩은 0.25초 뒤 → 짝을 '일찍 누름' MISS 로 만들지 않고 쿵으로
  //   (예전엔 짝 MISS → 진짜 짝 터치가 다음 짝을 일찍 누른 게 되는 연쇄의 시작)
  g = make(['KS..............'], 60);
  k = g.lanes[KICK][0];
  s = g.lanes[SNARE][0];
  tap(g, 1.4, k.time + 0.01);
  tap(g, 1.6, s.time);
  sweep(g, s.time + 0.5);
  assert.equal(k.result, 'perfect');
  assert.equal(s.result, 'perfect');
  assert.equal(g.counts.miss + g.counts.wrong, 0);

  // 4) 같은 줄 연타: GOOD 보다 조금 늦게 친 터치(0.17초)가 다음 콩(0.13초 뒤)을 '일찍' 가져가거나 MISS 로 만들지 않음
  g = make(['K.K.............']);
  const [k1, k2] = g.lanes[KICK];
  tap(g, 0.5, k1.time + 0.17);
  tap(g, 0.5, k2.time + 0.01);
  sweep(g, k2.time + 0.5);
  assert.equal(k1.result, 'miss');
  assert.equal(k2.result, 'perfect', '다음 콩은 제 터치로');
  assert.equal(g.counts.miss, 1);
  assert.equal(g.counts.wrong, 0);

  // 5) 너무 일찍 누름(2026-11-24 바뀜): 그 터치는 헛침, 콩은 그대로 → 제때 친 진짜 터치로 맞음 (한 터치가 다음 콩을 MISS 로 만들지 않음).
  //   그 콩을 끝내 못 치면 그 헛침이 그 콩 MISS 로 바뀜 → 벌은 한 번
  g = make(['K...............']);
  k = g.lanes[KICK][0];
  tap(g, 0.5, k.time - 0.2);
  assert.equal(g.counts.wrong, 1);
  tap(g, 0.5, k.time);
  assert.equal(k.result, 'perfect');
  assert.equal(g.counts.wrong, 1);
  g = make(['K...............']);
  k = g.lanes[KICK][0];
  tap(g, 0.5, k.time - 0.2);
  sweep(g, k.time + 0.5);
  g._sweep(k.time + 0.5, 0);
  g._sweep(k.time + 0.6, 0);
  assert.equal(k.result, 'miss');
  assert.equal(g.counts.miss + g.counts.wrong, 1, '일찍 누른 한 번 = 벌 한 번');

  // 6) 경계 근처 남는 터치(같은 엄지 한 번 더)가 옆 줄 콩을 가져가도 진짜 그 줄 터치가 더 잘 맞으면 되찾음 (진짜 터치는 헛침 아님).
  //   헛침은 남는 터치 몫으로 하나 (2026-11-24: 벌 없는 터치 없음)
  g = make(['KS..............']);
  k = g.lanes[KICK][0];
  s = g.lanes[SNARE][0];
  tap(g, 0.75, k.time);
  tap(g, 0.8, k.time + 0.08); // 남는 쿵 터치 → 짝 콩으로
  tap(g, 1.5, s.time); // 진짜 짝
  assert.equal(k.result, 'perfect');
  assert.equal(s.result, 'perfect', '짝은 진짜 짝 터치 시간으로');
  assert.equal(g.counts.miss, 0);
  assert.equal(g.counts.wrong, 1);
  // 반대로 정확히 친 콩을 같은 줄 다음 콩을 일찍 친 터치가 뺏어 가면 안 됨
  g = make(['KK..............']);
  const [a1, a2] = g.lanes[KICK];
  tap(g, 1.01, a1.time - 0.02); // 쿵 엄지가 선을 살짝 넘어 침 (짝 줄엔 콩 없음) → 쿵
  tap(g, 0.4, a2.time - 0.08); // 다음 쿵을 조금 일찍 (앞 콩에 더 가까움)
  sweep(g, a2.time + 0.5);
  assert.equal(a1.result, 'perfect');
  assert.ok(a2.judged && a2.result !== 'miss', '다음 쿵이 씹히면 안 됨');
});

test('🖐 폰 버벅임(2026-11-23): 화면 갱신이 밀린 터치보다 먼저 돌아도 제때 친 콩은 안 씹힘, 일찍 누름 벌은 그대로', async () => {
  const { Game, MAX_LIVES } = await import('../public/js/game.js');
  const { KICK, SNARE } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = new Proxy({}, { get: () => noop });
  let clock = 0;
  const audio = new Proxy({ ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock }, { get: (o, k) => (k in o ? o[k] : noop) });
  const make = (bars, bpm = 100) => {
    const lv = { ...LEVELS[0], id: 999, bpm, bars: ['................', ...bars], song: LEVELS[0].song };
    const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    for (const n of g.notes) n.gold = false; // 황금 콩은 하트를 줘서 목숨 셈이 헷갈림
    return g;
  };
  const tap = (g, lane, at) => {
    clock = at;
    g.input(lane, 0, [], lane === KICK ? 0.5 : 1.5);
  };

  // 1) 쿵 5개(0.3초 간격). 앞 둘은 제때, 그다음 0.9초 버벅임 → 화면 갱신(MISS 처리)이 두 번 먼저 돌고 나서 밀린 터치 셋이 도착
  let g = make(['K.K.K.K.K.......']);
  let ks = g.lanes[KICK];
  tap(g, KICK, ks[0].time);
  g._sweep(ks[0].time + 0.05, 0);
  tap(g, KICK, ks[1].time + 0.01);
  g._sweep(ks[1].time + 0.05, 0);
  g._sweep(ks[4].time + 0.2, 0); // 버벅인 뒤 첫 화면: '바로 전 화면' 기준이라 아직 안 넘김
  assert.equal(ks[2].judged, false, '버벅인 뒤 첫 화면 갱신은 버벅이는 동안 누른 터치를 기다림');
  g._sweep(ks[4].time + 0.6, 0); // 그래도 터치가 안 오면 MISS 로 넘김 (한 프레임 늦게)
  g._sweep(ks[4].time + 0.62, 0);
  assert.equal(ks[2].result, 'miss');
  assert.equal(ks[4].result, 'miss');
  assert.ok(g.lives < MAX_LIVES);
  tap(g, KICK, ks[2].time);
  tap(g, KICK, ks[3].time + 0.02);
  tap(g, KICK, ks[4].time - 0.01);
  for (const k of ks) assert.equal(k.result, 'perfect', '제때 친 콩은 늦게 도착해도 PERFECT');
  assert.equal(g.counts.miss, 0);
  assert.equal(g.lives, MAX_LIVES, '목숨 돌려받음');
  assert.equal(g.combo, 5, '콤보도 이어짐');
  assert.equal(g._check().rv, 3);

  // 2) 늦게 도착한 '너무 일찍 누름'은 헛침, 같이 늦게 도착한 제때 터치는 그 콩을 되살림 (누른 순간 기준 — 늦게 와도 똑같이)
  g = make(['K...............']);
  const k = g.lanes[KICK][0];
  g._sweep(k.time + 0.5, 0);
  g._sweep(k.time + 0.6, 0);
  tap(g, KICK, k.time - 0.2);
  tap(g, KICK, k.time);
  assert.equal(k.result, 'perfect');
  assert.equal(g.counts.miss, 0);
  assert.equal(g.counts.wrong, 1);

  // 3) 늦게 도착한 'GOOD 보다 조금 늦은' 터치도 그 콩은 MISS 그대로, 다음 콩은 제 터치로
  g = make(['K.K.............']);
  ks = g.lanes[KICK];
  g._sweep(ks[1].time + 0.5, 0);
  g._sweep(ks[1].time + 0.6, 0);
  tap(g, KICK, ks[0].time + 0.2);
  tap(g, KICK, ks[1].time);
  assert.equal(ks[0].result, 'miss');
  assert.equal(ks[1].result, 'perfect');
  assert.equal(g.counts.miss, 1);
  assert.equal(g.counts.wrong, 0);

  // 4) 동시치기 둘 다 MISS 로 넘어간 뒤 하나만 되살리면 목숨은 여전히 하나 깎인 채
  g = (() => {
    const gg = make(['K...............']);
    // 짝 줄에 같은 시각 콩을 직접 넣음 (동시치기)
    const kk = gg.lanes[KICK][0];
    const sn = { ...kk, lane: SNARE, judged: false, result: undefined };
    gg.lanes[SNARE].push(sn);
    gg.notes.push(sn);
    return gg;
  })();
  const kk = g.lanes[KICK][0];
  const sn = g.lanes[SNARE][0];
  g._sweep(kk.time + 0.5, 0);
  g._sweep(kk.time + 0.6, 0);
  assert.equal(g.lives, MAX_LIVES - 1, '동시치기 둘 다 놓쳐도 하나만');
  tap(g, KICK, kk.time);
  assert.equal(g.lives, MAX_LIVES - 1, '짝은 아직 MISS → 목숨은 짝 몫');
  tap(g, SNARE, sn.time);
  assert.equal(g.lives, MAX_LIVES);
  assert.equal(g.counts.miss, 0);
});

test('📦 랭킹 기록 → 깬 단계(별) 어림: 무제한은 다이아·깬 단계', async () => {
  const { bestsFromScores, endlessKey } = await import('../server/handler.js');
  const { isUnlocked, noteCount: nc, getLevel } = await import('../public/js/charts.js');
  const b = bestsFromScores([
    { level: 1, score: 100, grade: 'SS', maxCombo: 1 },
    { level: 2, score: 90, grade: 'S', maxCombo: nc(getLevel(2)) },
    { level: 3, score: 80, grade: 'B', maxCombo: 3 },
    { level: 4, score: 10, grade: 'D', maxCombo: 1 },
    { level: 0, score: endlessKey(7, 5000), grade: null, maxCombo: 0 },
    { level: -3, score: endlessKey(2, 100), grade: null, maxCombo: 0 },
    { level: 999, score: 1, grade: 'A', maxCombo: 1 },
  ]);
  assert.deepEqual([b[1].stars, b[2].stars, b[3].stars, b[4].stars], [3, 3, 2, 1]);
  assert.equal(b[999], undefined);
  assert.equal(b.endless.roundsCleared, 7);
  assert.equal(b.endless.diamonds, 2);
  assert.equal(b.e3.roundsCleared, 2);
  assert.ok(isUnlocked(5, b), '4단계까지 깼으면 5단계 열림');
});

test('📦 인스타 아이디 거의 같음: 점·밑줄·대소문자·오타 1~2개는 봐줌, 전혀 다르면 아님', async () => {
  const { igSimilar } = await import('../server/handler.js');
  for (const [a, b] of [['jiminnn_12', 'jimin_12'], ['My.Insta', 'my_insta'], ['drummer_kim', 'drumer_kim'], ['kongkong', 'kongkong.drum'], ['abc', 'abc']]) assert.ok(igSimilar(a, b), `${a} ~ ${b}`);
  for (const [a, b] of [['jiminnn_12', 'totally.other'], ['abc', 'abd1x'], ['', 'abc'], ['ab', 'ac']]) assert.ok(!igSimilar(a, b), `${a} ≠ ${b}`);
});

test('🔇 소리 시계가 멈춰도(아이폰) 곡은 화면 시계로 계속 흐르고, 새 엔진·다시 흐르는 시계에 그 자리부터 맞춰 붙음', async () => {
  const { Game } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= noop;
  const node = () => ({ connect: (x) => x || node(), disconnect: noop, gain: { value: 1, cancelScheduledValues: noop, setValueAtTime: noop, linearRampToValueAtTime: noop } });
  const mkCtx = (t) => ({ currentTime: t, state: 'running', createGain: node, resume: async () => {}, suspend: async () => {} });
  const fake = { ctx: mkCtx(100), resetClock: noop, heardTime() { return this.ctx.currentTime; } };
  const audio = new Proxy(fake, { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => ((o[k] = v), true) });
  const renderer = new Proxy({}, { get: () => noop });
  const g = new Game({ audio, renderer, level: LEVELS[0], settings: {}, onEnd: noop });
  let now = 1000;
  const realNow = performance.now;
  performance.now = () => now;
  try {
    g.start();
    // 시계가 흐르다가 (곡 시각 2초쯤)
    for (let i = 0; i < 20; i++) { fake.ctx.currentTime += 0.12; now += 120; g._loop(); }
    const at = g._goodNow;
    assert.ok(at > 1.5 && at < 2.5, `곡 시각 ${at}`);
    assert.equal(audio.frozen, false);
    // 'running' 인데 시계가 멈춤 → 0.3초 넘으면 멈춤으로 봄. 그래도 곡 시각은 화면 시계로 흐름 ('1' 에서 서 있지 않음)
    for (let i = 0; i < 8; i++) { now += 120; g._loop(); }
    assert.equal(audio.frozen, true);
    assert.ok(Math.abs(g._goodNow - (at + 0.96)) < 0.15, `멈춘 동안에도 곡 시각이 흐름 ${g._goodNow} vs ${at + 0.96}`);
    // 터치 → 새 엔진(시계가 0부터) → 지금 자리 그대로 이어 감 (뒤로 안 감)
    const before = g.songTime();
    fake.ctx = mkCtx(0);
    g.reanchor();
    assert.ok(Math.abs(g.songTime() - before) < 0.01, `이어 가는 곡 시각 ${g.songTime()} vs ${before}`);
    // 새 시계가 흐르기 시작 → 소리 시계에 맞춰 붙음 (곡 시각 이어짐)
    for (let i = 0; i < 3; i++) { now += 120; fake.ctx.currentTime += 0.12; g._loop(); }
    assert.equal(audio.frozen, false);
    assert.equal(g._virt, null, '소리 시계로 돌아옴');
    assert.ok(Math.abs(g.songTime() - (before + 0.36)) < 0.01, `맞춰 붙은 곡 시각 ${g.songTime()} vs ${before + 0.36}`);
    now += 120; fake.ctx.currentTime += 0.12;
    assert.ok(Math.abs(g.songTime() - (before + 0.48)) < 0.01, '소리 시계 따라 흐름');
  } finally {
    performance.now = realNow;
    g.stop();
  }
});

test('광고·일시정지 중에 소리 시계가 흘러 버려도 이어하면 멈췄던 자리부터 (이어하자마자 죽지 않음)', async () => {
  const { Game } = await import('../public/js/game.js');
  const noop = () => {};
  globalThis.requestAnimationFrame ??= () => 0;
  globalThis.cancelAnimationFrame ??= noop;
  const node = () => ({ connect: (x) => x || node(), disconnect: noop, gain: { value: 1, cancelScheduledValues: noop, setValueAtTime: noop, linearRampToValueAtTime: noop } });
  const ctx = { currentTime: 50, state: 'running', createGain: node, resume: async () => {}, suspend: async () => {} };
  const fake = { ctx, resetClock: noop, heardTime() { return this.ctx.currentTime; } };
  const audio = new Proxy(fake, { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, v) => ((o[k] = v), true) });
  const renderer = new Proxy({}, { get: () => noop });
  let deaths = 0;
  const g = new Game({ audio, renderer, level: LEVELS[21] || LEVELS[0], settings: {}, onEnd: noop, onDeath: () => deaths++ });
  try {
    g.start();
    ctx.currentTime += 6;
    g._loop();
    g._die();
    const at = g.diedAt;
    // 광고 보는 동안 소리가 다시 켜져서 시계가 20초 흘러감
    ctx.currentTime += 20;
    assert.ok(g.revive());
    await g.resume();
    ctx.currentTime += 0.3;
    assert.ok(Math.abs(g.songTime() - at) < 0.05, `이어 가는 곡 시각 ${g.songTime()} vs ${at}`);
    // 일시정지도 같음
    g.pause();
    const p = g._heldAt;
    ctx.currentTime += 10;
    await g.resume();
    ctx.currentTime += 0.3;
    assert.ok(Math.abs(g.songTime() - p) < 0.05, `일시정지 뒤 곡 시각 ${g.songTime()} vs ${p}`);
    assert.equal(deaths, 1);
  } finally {
    g.stop();
  }
});

test('🎭 장거리(tapMelody): 오른쪽 멜로디 콩 = 악보 음 하나하나, 왼쪽은 쿵만 · 본편·총 등수 밖', async () => {
  const { tapBars, MAIN_LEVELS, LAST_LEVEL_ID, COUNT_IN_BARS, STEPS_PER_BAR, KICK, SNARE } = await import('../public/js/charts.js');
  const longs = LEVELS.filter((l) => l.long);
  assert.ok(longs.length >= 1);
  for (const lv of longs) {
    assert.ok(!MAIN_LEVELS.includes(lv) && lv.id > LAST_LEVEL_ID);
    assert.deepEqual(levelLanes(lv), [KICK, SNARE]);
    assert.deepEqual(lv.bars, tapBars(lv.song.melody, lv.kick));
    const onsets = new Set(parseMelody(lv.song.melody).map((m) => (COUNT_IN_BARS + m.bar) * STEPS_PER_BAR + m.step));
    const right = buildNotes(lv).filter((n) => n.lane === SNARE);
    assert.equal(right.length, onsets.size);
    for (const n of right) assert.ok(onsets.has(n.step), `멜로디 없는 자리 ${n.step}`);
  }
  // 네순 도르마: 마지막은 높은 라(A5) 온음표, 그 앞 '빈-체-' 는 레(D5)·높은 시(B5)
  const nd = longs.find((l) => l.name === '네순 도르마');
  assert.equal(nd.song.melody.at(-1), 'A5:16');
  assert.equal(nd.song.melody.at(-2), 'A5:12 D5:3 B5:1');
});

test('👍 같은 엄지 줄: 4줄 맵에서 챙 줄을 눌러도 그때 쿵 노트가 있으면 쿵으로 (챙 노트 없을 때만)', async () => {
  const { Game } = await import('../public/js/game.js');
  const { KICK, SNARE, HAT, CRASH } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = { onJudge: noop, onLife: noop, onCombo: noop, onTap: noop, draw: noop, reset: noop };
  let clock = 0;
  const audio = { ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock, crash: noop, playLane: noop };
  const level = { id: 'um', custom: true, bpm: 175, bars: ["X.S.S.J.J.S.SHH.", "J...S...K...S...", "J.S.S.J.J.S.SHH."], song: { prog: ['C', 'C', 'C'] } };
  const g = new Game({ audio, renderer, level, settings: {}, onDeath: noop, onEnd: noop });
  g.startTime = 0;
  g.state = 'playing';
  g.player = { stop: noop };
  const kick = g.lanes[KICK][0];
  clock = kick.time;
  g.input(CRASH, 0, [{ lane: KICK, d: 0.9 }], 0.2); // 챙 줄 깊숙이 → 그래도 쿵
  assert.equal(kick.judged, true);
  assert.equal(g.counts.wrong, 0);
  // 오른손: 츠 줄을 눌렀는데 짝 노트만 있으면 짝 (츠 줄은 짝 바로 옆이 아니어도)
  // (츠 줄에 조금 전 지나간 콩이 있으면 그 콩에 늦은 터치로 봄 → 츠 콩이 0.3초 안에 없는 짝)
  const sn = g.lanes[SNARE].find((n) => !g.lanes[HAT].some((m) => Math.abs(m.time - n.time) < 0.3) && n.time > kick.time + 0.3);
  clock = sn.time;
  g.input(HAT, 0, [{ lane: SNARE, d: 0.9 }], 3.8);
  assert.equal(sn.judged, true);
  // 다른 엄지 줄로는 안 넘김: 쿵 노트 때 짝을 누르면 헛침
  const k2 = g.lanes[KICK].find((n) => !n.judged && !g.lanes[SNARE].some((m) => Math.abs(m.time - n.time) < 0.2) && !g.lanes[HAT].some((m) => Math.abs(m.time - n.time) < 0.2));
  if (k2) {
    clock = k2.time;
    const w = g.counts.wrong;
    g.input(SNARE, 0, [{ lane: KICK, d: 0.9 }], 2.5);
    assert.equal(k2.judged, false);
    assert.equal(g.counts.wrong, w + 1);
  }
});

test('방 대기실: 변화 없으면 천천히 주고받기 (자리 비움 1분보다 짧게) · ago 만 바뀐 건 변화 아님', async () => {
  const { lobbyPollMs, roomSig, ROOM_POLL_LOBBY_MS } = await import('../public/js/room.js');
  assert.equal(lobbyPollMs(0), ROOM_POLL_LOBBY_MS);
  assert.ok(lobbyPollMs(5 * 60_000) > ROOM_POLL_LOBBY_MS);
  assert.ok(lobbyPollMs(60 * 60_000) < 60_000);
  const a = { status: 'lobby', players: { a: { name: 'x', ready: false, ago: 10 } } };
  assert.equal(roomSig(a), roomSig({ ...a, players: { a: { ...a.players.a, ago: 3000 } } }));
  assert.notEqual(roomSig(a), roomSig({ ...a, players: { a: { ...a.players.a, ready: true } } }));
});

test('🖐 터치 판정 단순하게(2026-11-24 \'아직 인식이 제대로 안 돼요\'): 한 터치는 콩 하나만, 남는 터치가 제대로 친 콩을 MISS 로 만들지 않음', async () => {
  const { Game } = await import('../public/js/game.js');
  const { KICK, SNARE } = await import('../public/js/charts.js');
  const noop = () => {};
  globalThis.cancelAnimationFrame ??= noop;
  const renderer = new Proxy({}, { get: () => noop });
  let clock = 0;
  const audio = new Proxy({ ctx: { suspend: async () => {}, resume: async () => {} }, heardTime: () => clock }, { get: (o, k) => (k in o ? o[k] : noop) });
  const make = (bars, bpm = 144) => {
    const lv = { ...LEVELS[0], id: 999, bpm, bars: ['................', ...bars], song: LEVELS[0].song };
    const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    for (const n of g.notes) n.gold = false;
    return g;
  };
  // 2줄: 쿵 = 0~1, 짝 = 1~2 (render.laneHit 와 같은 모양)
  const tap = (g, u, at) => {
    clock = at;
    const i = u < 1 ? 0 : 1;
    const f = u - i;
    return g.input(i === 0 ? KICK : SNARE, 0, [{ lane: i === 0 ? SNARE : KICK, d: i === 0 ? 1 - f : f }]);
  };
  const end = (g, at) => {
    g._sweep(at, 0);
    g._sweep(at + 0.02, 0);
  };
  // 1) 기본: 누른 줄에 콩 있으면 맞음, 없으면 헛침
  let g = make(['K...S...........']);
  let [k] = g.lanes[KICK];
  let [s] = g.lanes[SNARE];
  assert.equal(tap(g, 0.5, k.time).res, 'perfect');
  assert.equal(tap(g, 0.3, k.time + 0.3).res, 'wrong', '쿵 줄에 콩 없음 → 헛침 (짝 콩이 0.1초 뒤에 있어도 선에서 멀면 안 가져감)');
  assert.equal(s.judged, false);
  assert.equal(tap(g, 1.5, s.time).res, 'perfect');

  // 2) 윌리엄 텔 쿵짝쿵짝(0.104초): 쿵 엄지가 떼며 굴려 생긴 남는 터치가 짝 줄에 들어와도 → 짝은 진짜 짝 터치 시간으로, 헛침은 남는 터치 하나.
  //    예전엔 남는 터치가 짝을 가져간 뒤 진짜 짝 터치가 다음 쿵·다음 짝을 '일찍 누름' MISS 로 만드는 연쇄가 났음
  g = make(['KSKSKSKS........']);
  const K = g.lanes[KICK];
  const S = g.lanes[SNARE];
  tap(g, 0.8, K[0].time);
  tap(g, 1.25, K[0].time + 0.05); // 남는 터치 (쿵 엄지가 선을 넘어 짝 줄)
  tap(g, 1.6, S[0].time);
  for (let i = 1; i < 4; i++) {
    tap(g, 0.8, K[i].time + 0.01);
    tap(g, 1.6, S[i].time - 0.01);
  }
  end(g, S[3].time + 0.5);
  for (const n of [...K, ...S]) assert.notEqual(n.result, 'miss', '제대로 친 콩은 MISS 가 되면 안 됨');
  assert.equal(S[0].result, 'perfect', '짝은 진짜 짝 터치 시간으로');
  assert.equal(g.counts.wrong, 1, '벌은 남는 터치 하나');

  // 3) 쿵짝쿵에서 짝 엄지가 가운데 선을 살짝 넘어 쿵 줄을 눌러도 (다음 쿵이 0.104초 뒤) → 짝
  g = make(['KSK.............']);
  [k] = g.lanes[KICK];
  [s] = g.lanes[SNARE];
  const k2 = g.lanes[KICK][1];
  tap(g, 0.5, k.time);
  tap(g, 0.85, s.time); // 짝 엄지가 쿵 줄 선 옆
  tap(g, 0.5, k2.time);
  assert.equal(s.result, 'perfect');
  assert.equal(k2.result, 'perfect');
  assert.equal(g.counts.wrong + g.counts.miss, 0);

  // 4) 쿵을 조금 늦게(0.07초) 선 근처에서 쳐도 쿵 (예전엔 0.03초 뒤 짝이 더 가깝다고 짝으로 옮김)
  g = make(['KS..............']);
  [k] = g.lanes[KICK];
  [s] = g.lanes[SNARE];
  assert.equal(tap(g, 0.9, k.time + 0.07).lane, KICK);
  tap(g, 1.5, s.time);
  assert.equal(k.result, 'great');
  assert.equal(s.result, 'perfect');

  // 4-2) DM 영상(11-24): 쿵 → 0.1초 뒤 짝. 짝 엄지가 쿵 줄 안쪽(선에서 0.4)을 조금 일찍 눌러도 → 쿵 줄이 방금 눌렸으니 다른 엄지 → 짝.
  //   쿵 엄지가 늦게 와 쿵 줄 가운데를 눌러도 → 쿵
  g = make(['KSK.............']);
  [k] = g.lanes[KICK];
  [s] = g.lanes[SNARE];
  const kk2 = g.lanes[KICK][1];
  tap(g, 0.7, k.time + 0.03);
  assert.equal(tap(g, 0.6, s.time + 0.01).lane, SNARE, '짝 엄지가 쿵 줄 안쪽 (다음 쿵이 0.1초 뒤라 판정 시간 안이어도)');
  tap(g, 0.5, kk2.time + 0.06);
  end(g, kk2.time + 0.5);
  assert.notEqual(s.result, 'miss');
  assert.notEqual(kk2.result, 'miss');
  assert.equal(g.counts.wrong + g.counts.miss, 0);
  // 선 건너편 늦은 쿵을 짝 줄 콩이 가져가도, 진짜 짝 터치가 오면 서로 바꿔 둘 다 맞음 (지나간 쿵 MISS 로 끝내지 않음)
  g = make(['K.S.............']);
  [k] = g.lanes[KICK];
  [s] = g.lanes[SNARE];
  tap(g, 1.13, k.time + 0.09); // 쿵 엄지가 늦게, 짝 줄 선 옆
  tap(g, 1.18, s.time + 0.05); // 진짜 짝
  end(g, s.time + 0.5);
  assert.notEqual(k.result, 'miss');
  assert.notEqual(s.result, 'miss');
  assert.equal(g.counts.wrong + g.counts.miss, 0);

  // 5) 동시치기(쿵+짝 같이): 두 엄지가 둘 다 짝 줄을 눌러도 둘 다 맞음
  g = make(['B...............']);
  [k] = g.lanes[KICK];
  [s] = g.lanes[SNARE];
  assert.ok(k && s && k.time === s.time, '동시치기');
  tap(g, 1.1, k.time);
  tap(g, 1.6, k.time + 0.01);
  assert.ok(k.judged && s.judged);
  assert.equal(g.counts.wrong, 0);
});
