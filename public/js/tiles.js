// 🎹 시즌 2 피아노 타일 — 브라우저와 서버가 같이 씀
//   2026-11-26 밤 다시 만듦 (사용자 '디테일은 전부 피아노 타일을 따라 해'):
//   · 줄(row) 단위: 화면 높이의 1/4 = 한 줄. **보통 타일 크기는 모든 곡·유저 맵에서 똑같고 바뀌지 않음** (TILE_ROWS)
//     곡마다 '한 줄 = 몇 16분 칸'(u)을 정하고(가장 흔한 음 간격), 빠르기는 '초당 줄 수'로 정함 → 곡이 달라도 타일 크기·느낌이 같음
//   · 한 바퀴 = 곡 하나 처음부터 끝까지. 조각만 있던 곡은 TILE_MEL 에 곡 전체(절·후렴 등)를 따로 적음
//   · 첫 바퀴: 별 3개가 1/3·2/3·끝에 차오름 → 🪙 코인 파티 → 둘째 바퀴(빨라짐): 빈 다이아 3개 → 그 뒤로도 바퀴마다 빨라짐
//   🎵 2026-11-26 밤 사용자 '노래를 그냥 틀고 타일 눌러도 노래 안 나오고 박자만 맞춰 타일이 나오게':
//     노래(멜로디 + 왼손 반주)는 판 내내 흐르고, 타일은 그 박자에 맞춰 내려옴. 누르면 소리 없음(코인 타일만 '띵')
//   📱 아이폰: 다른 손가락 터치가 0.2초 안에 붙으면 뒤 터치가 통째로 빠짐(tasks/채보-만들때-주의.md) →
//     이웃 타일은 늘 MIN_TAP_SEC(0.2초) 이상 떨어지게 노래 음에서 고름 (바퀴마다 빨라지면 더 듬성듬성), 동시 타일 없음,
//     긴 타일은 끝난 뒤 다음 타일까지 0.2초 이상 비움 (손 떼는 순간과 다른 손 누르는 순간이 안 겹치게)
//   · 점수 = 친 타일 + 긴 타일 덤. 코인 = 친 타일 하나에 1개 + 코인 파티 타일. 랭킹 = 곡마다(scores 칸 3000+곡 번호) + 시즌 총합(명예의 전당 'tiles')
//   ⚠ 서버는 tileTimes 로 '그 시간 안에 칠 수 있는 점수'를 넘는 기록을 막음

import { parseMelody, parseChord, noteToMidi, STEPS_PER_BAR, getLevel, TempoMap, pointsFor } from './charts.js';

/** 화면에 보이는 줄 수 (보통 타일 높이 = 화면 높이 / TILE_ROWS). 바꾸지 말 것 (11-26 사용자) */
// 2026-11-27 사용자 '타일 세로 크기 조금만 더' → 4 → 3.5 (그래도 모든 곡·유저 맵이 같은 크기)
export const TILE_ROWS = 3.5;
/** 난이도별 첫 바퀴 빠르기 (초당 줄 수) */
//   2026-11-27: 마지막 바퀴(×1.3)에서도 한 줄 = 0.2초 이상이 되게 첫 바퀴를 3.8 까지로 (그래야 바퀴마다 똑같은 타일)
//   2026-11-27 저녁 사용자 '전체적으로 너무 느려 — 지옥+ = 지금 다이아 2번째 속도, 지옥 = 지옥+ 다이아 1, 어려움 = 지옥 기본':
//     지옥+ 4.55×1.06 = 4.82 · 지옥 4.55×1.03 = 4.69 · 어려움 4.15 · 보통 3.8(예전 어려움) · 쉬움 3.0
export const TILE_RPS = [0, 3.0, 3.8, 4.15, 4.69, 4.82];
/** 🎹 2026-11-27 사용자 '빠르기 고정, 곡 끝날 때마다 다이아 하나, 더 빠르게 → 다이아 3개' : 바퀴마다 빠르기 (바퀴 안에선 고정) */
export const LAP_SPEEDS = [1, 1.1, 1.2, 1.3];
/**
 * 🏎 난이도별 바퀴 빠르기 (2026-11-27 사용자 '난이도가 쉬워, 지옥+ 인데 느려 · 쉬움 빼고 전체적으로 더 빠르게'):
 *   이웃 타일 0.2초 규칙은 '제일 빠른 바퀴' 기준이라, 첫 바퀴를 빠르게 하려면 바퀴마다 빨라지는 폭을 줄여야 함
 *   (첫 바퀴 초당 줄 × 마지막 배수 ≤ 5). 쉬움은 예전 그대로.
 */
//   2026-11-27 저녁: 첫 바퀴가 빨라진 만큼 바퀴 배수를 줄임 (마지막 바퀴 초당 줄 ≤ 5 = 이웃 타일 0.2초 규칙)
export const DIFF_SPEEDS = [null, LAP_SPEEDS, [1, 1.06, 1.12, 1.18], [1, 1.05, 1.1, 1.15], [1, 1.022, 1.044, 1.066], [1, 1.012, 1.024, 1.036]];
/** 긴 타일 덤 (줄 하나 더 누를 때마다) */
export const HOLD_PTS = 500;

/** 곡 목록 (쉬운 것부터) */
export const TILE_SONGS = [
  { id: 1, diff: 1 },
  { id: 2, diff: 1 },
  { id: 3, diff: 1 },
  { id: 4, diff: 1 },
  { id: 5, diff: 2 },
  { id: 6, diff: 2 },
  { id: 11, diff: 2 },
  { id: 12, diff: 2 },
  { id: 7, diff: 3 },
  { id: 17, diff: 3 },
  { id: 9, diff: 3 },
  { id: 8, diff: 3 },
  { id: 16, diff: 4 },
  { id: 10, diff: 4 },
  { id: 13, diff: 4 },
  { id: 18, diff: 4 },
  { id: 14, diff: 5 },
  { id: 15, diff: 5 },
];
export const TILE_DIFF = ['', '쉬움', '보통', '어려움', '지옥', '지옥+'];
/** 처음 몇 곡은 누구나 (나머지는 드럼 4단계부터처럼 팔로워 인증) */
export const TILE_FREE = 3;
/** 랭킹 저장 칸: scores.level = 3000 + 곡 번호 */
export const TILE_SLOT0 = 3000;
export const TILE_SLOT_MAX = 3999;
/** 이 바퀴까지 돌면 끝 (그 전에 사람은 못 버팀) */
/** 첫 바퀴(별 3개) + 다이아 3바퀴 = 4바퀴에서 끝 (2026-11-27) */
export const MAX_LAPS = 4;
/** 2026-11-27 사용자: 한 번 틀리면 끝 (광고 보고 한 번 이어하기만) */
export const TILE_HEARTS = 1;
/** 이만큼(줄) 화면 아래로 지나가면 놓침 */
export const GONE_ROWS = 0.35;
/** 📱 이웃한 두 타일 사이는 늘(빨라져도) 적어도 이만큼(초) — 아이폰 터치 빠짐 (tasks/채보-만들때-주의.md) */
export const MIN_TAP_SEC = 0.2;
/** 예전 이름 (첫 바퀴 간격) */
export const MIN_GAP = MIN_TAP_SEC;
/** 🪙 코인 파티: 첫 바퀴(별 3개)를 끝내고 빨라지기 전에 한 번 (마디 수, 사용자 11-26)
 *   앞뒤로 PARTY_GAP 마디씩 비워 둠 (2026-11-27 사용자 '보너스 코인 시작할 때 처음이랑 끝 텀 좀 둬줘') → 코인은 가운데 4마디 */
export const PARTY_BARS = 2; // 2026-11-27 사용자 '보너스 코인 타임 없애고 몇 초 뒤 다이아' → 코인 없이 2마디 쉼
export const PARTY_GAP = 1;

// ---------------------------------------------------------------
// 곡 전체 (드럼 단계 멜로디가 조각뿐인 곡). 퍼블릭 도메인 곡만. bars = 드럼 단계 마디 번호 또는 새 마디 문자열
// ---------------------------------------------------------------
const JINGLE_VERSE = [
  'G4 E5 D5 C5',
  'G4:12 G4:2 G4:2',
  'G4 E5 D5 C5',
  'A4:16',
  'A4 F5 E5 D5',
  'B4:16',
  'G5 G5 F5 D5',
  'E5:16',
  'G4 E5 D5 C5',
  'G4:16',
  'G4 E5 D5 C5',
  'A4:12 A4:4',
  'A4 F5 E5 D5',
  'G5 G5 G5 G5',
  'A5 G5 F5 D5',
  'C5:8 G5:8',
];
const JINGLE_VERSE_PROG = ['C', 'C', 'C', 'F', 'F', 'G', 'G7', 'C', 'C', 'C', 'C', 'F', 'F', 'G', 'G7', 'C G7'];
const r = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const TILE_MEL = {
  // 징글벨: 절(달리는 썰매) + 후렴
  3: { bars: [...JINGLE_VERSE, ...r(0, 15)], prog: [...JINGLE_VERSE_PROG, ...r(0, 15)] },
  // 오 수재너: 절 + 후렴, 두 번 (2절)
  7: { bars: [...r(0, 7), ...r(0, 7)] },
  // 코로부시카: 앞 가락 두 번 + 뒤 가락 두 번 (민요 그대로)
  12: { bars: [...r(0, 3), ...r(0, 3), ...r(4, 7), ...r(4, 7)] },
  // 엔터테이너: A 가락 (두 번째는 끝맺음)
  11: {
    bars: [0, 1, 2, 3, 0, 1, 'C5:1 D5:1 E5:1 C5:1 D5:1 E5:2 C5:1 D5:1 C5:1 E5:1 C5:1 D5:1 E5:2 C5:1', 'D5:1 C5:1 E5:1 C5:1 D5:1 E5:2 B4:1 D5:2 C5:4 _:2'],
    prog: [0, 1, 2, 3, 0, 1, 'C G7', 'G7 C'],
  },
  // 터키 행진곡: 주제 + 끝맺는 주제
  13: { bars: [0, 1, 2, 3, 0, 1, 2, 'B5:2 A5:2 G#5:2 B5:2 A5:8'], prog: [0, 1, 2, 3, 0, 1, 2, 'E Am'] },
  // 캉캉: 주제 + 끝맺는 주제
  10: { bars: [0, 1, 2, 3, 0, 1, 2, 'D5:2 D5:2 D5:1 F5:1 E5:1 D5:1 C5:2 G5:2 C6:4'], prog: [0, 1, 2, 3, 0, 1, 2, 'G7 C'] },
  // 윌리엄 텔: 달리는 가락 두 번
  15: { bars: [...r(0, 3), ...r(0, 3)] },
  // 캐논: 긴 음 → 4분음표 → 8분음표 가락 → 끝
  4: {
    bars: [
      ...r(0, 11),
      'D5:2 C#5:2 D5:2 D4:2 C#4:2 A4:2 E4:2 F#4:2',
      'D4:2 D5:2 C#5:2 B4:2 C#5:2 F#5:2 A5:2 B5:2',
      'G5:2 F#5:2 E5:2 G5:2 F#5:2 E5:2 D5:2 C#5:2',
      'B4:2 A4:2 G4:2 F#4:2 E4:2 G4:2 F#4:2 E4:2',
      'D4:16',
    ],
    prog: [...r(0, 11), 'D A', 'Bm F#m', 'G D', 'G A', 'D'],
  },
};

/** 곡의 멜로디·코드 (TILE_MEL 이 있으면 곡 전체) */
export function tileSource(songId) {
  const level = getLevel(songId);
  if (!level || !level.song || !level.song.melody) return null;
  const base = level.song;
  const prog0 = base.prog || ['C'];
  const progAt = (i) => prog0[i % prog0.length];
  const f = TILE_MEL[songId];
  if (!f) return { melody: base.melody, prog: base.melody.map((_, i) => progAt(i)) };
  const melody = f.bars.map((b) => (typeof b === 'number' ? base.melody[b] : b));
  const pl = f.prog || f.bars;
  const prog = melody.map((_, i) => {
    const p = pl[i];
    return typeof p === 'number' ? progAt(p) : typeof p === 'string' && !/[_:]/.test(p) && /^[A-G]/.test(p) ? p : progAt(i);
  });
  return { melody, prog };
}

/** 한 줄 = 몇 16분 칸: 가장 흔한 음 간격 (1~8) */
export function rowUnit(notes) {
  const cnt = new Map();
  for (let i = 0; i < notes.length; i++) {
    const g = i + 1 < notes.length ? notes[i + 1].at - notes[i].at : notes[i].len;
    if (g >= 1 && g <= 8) cnt.set(g, (cnt.get(g) || 0) + 1);
  }
  let best = 4;
  let bc = -1;
  for (const [g, c] of [...cnt.entries()].sort((a, b) => a[0] - b[0])) if (c > bc) (best = g), (bc = c);
  // 16분 한 칸을 한 줄로 하면 8분음표마다 빈 줄이 생기고 4분음표가 4줄 긴 타일이 됨 → 적어도 8분 = 한 줄
  return Math.max(2, best);
}

/**
 * 한 바퀴(곡 하나) 만들기: melody(마디 문자열) · prog(마디 코드) · rps(첫 바퀴 초당 줄)
 *   → { u, bpm, bars, steps, notes, prog, first, pattern, tiles, points }
 *   notes = 노래(반주가 치는 멜로디 전부), pattern = 한 바퀴 타일 (모든 바퀴가 똑같음 — 2026-11-27 사용자 '띄엄띄엄 이상해')
 */
export function buildLap(melody, prog, rps, speeds = LAP_SPEEDS, tl = null) {
  const parsed = parseMelody(melody).map((n) => ({ ...n, at: n.bar * STEPS_PER_BAR + n.step }));
  const uniq = [];
  for (const n of parsed) {
    const last = uniq[uniq.length - 1];
    if (last && last.at === n.at) {
      if (n.midi > last.midi) uniq[uniq.length - 1] = n;
    } else uniq.push(n);
  }
  // ✍ 유저가 직접 놓은 타일(tl, 마디마다 16칸 '.'/'0'~'3' = 줄) — 있으면 멜로디 대신 이 자리·줄 (2026-11-27 사용자 '타일도 자유롭게')
  const free = Array.isArray(tl) ? freeTiles(tl, uniq) : null;
  const src = free || uniq;
  if (!src.length) return null;
  const u = rowUnit(src);
  const bars = melody.length;
  const steps = bars * STEPS_PER_BAR;
  // 📱 제일 빠른 바퀴(×1.3)에서도 한 줄이 0.2초 이상이 되게 빠르기 상한
  const maxSp = speeds[speeds.length - 1];
  rps = Math.min(rps, 1 / (MIN_TAP_SEC * maxSp) - 1e-6);
  const bpm = 15 * u * rps;
  const fastStep = 15 / (bpm * maxSp); // 제일 빠른 바퀴의 16분 한 칸(초)
  const minSteps = Math.max(u, Math.ceil(MIN_TAP_SEC / fastStep - 1e-9));
  // 타일 고르기: 한 줄 + 0.2초(제일 빠른 바퀴 기준) 이상 떨어진 음만 → 모든 바퀴에서 같은 타일
  const pat = [];
  for (const n of src) {
    const last = pat[pat.length - 1];
    if (last && n.at - last.at < minSteps) continue;
    pat.push({ at: n.at, bar: n.bar, len: n.len, midi: n.midi, fixed: n.lane });
  }
  // 바퀴 이음새(마지막 타일 → 다음 바퀴 첫 타일)도 같은 간격
  while (pat.length > 2 && steps - pat[pat.length - 1].at + pat[0].at < minSteps) pat.pop();
  // 긴 타일: 쉼 없이 두 줄 이상 끄는 음, 끝난 뒤 다음 타일까지 0.2초(제일 빠른 바퀴) 이상 비움
  pat.forEach((t, i) => {
    const nx = i + 1 < pat.length ? pat[i + 1].at : steps + pat[0].at;
    const gap = nx - t.at;
    let rows = Math.floor(Math.min(t.len, gap) / u + 1e-9);
    while (rows >= 2 && gap - rows * u < minSteps) rows--;
    t.rows = Math.max(1, Math.min(rows, 6));
    t.hold = t.rows >= 2;
  });
  if (free) pat.forEach((t) => Object.assign(t, { abs: t.at, lane: t.fixed }));
  else assignLanes(pat.map((t) => Object.assign(t, { abs: t.at })), u);
  pat.forEach((t) => delete t.fixed);
  // 이음새에서 같은 줄 연속 안 되게
  if (!free && pat.length > 2 && pat[pat.length - 1].lane === pat[0].lane) {
    const last = pat[pat.length - 1];
    const prev = pat[pat.length - 2].lane;
    last.lane = [0, 1, 2, 3].find((x) => x !== prev && x !== pat[0].lane && Math.abs(x - last.lane) <= 2) ?? last.lane;
  }
  const lap = { speeds, u, bpm, bars, steps, notes: uniq.map((n) => ({ at: n.at, bar: n.bar, len: n.len, midi: n.midi })), prog: melody.map((_, i) => String(prog[i] || 'C')), first: pat[0].at, pattern: pat };
  const two = buildCourse(lap, { laps: 2, party: true });
  lap.tiles = two.tiles.filter((t) => t.k === 0);
  lap.points = two.lapPts[0];
  return lap;
}

/** 직접 놓은 타일 → [{ at, bar, len, midi, lane }] (음 높이는 그때 울리는 멜로디 음, 없으면 72) — 긴 타일 없음 */
export function freeTiles(tl, notes = []) {
  const out = [];
  tl.forEach((row, bar) => {
    for (let e = 0; e < STEPS_PER_BAR; e++) {
      const c = String(row || '')[e];
      if (c >= '0' && c <= '3') out.push({ at: bar * STEPS_PER_BAR + e, bar, lane: Number(c) });
    }
  });
  out.forEach((t, i) => {
    const nx = out[i + 1] ? out[i + 1].at : t.at + 4;
    t.len = Math.max(1, Math.min(4, nx - t.at));
    let m = 72;
    for (const n of notes) if (n.at <= t.at) m = n.midi;
    t.midi = m;
  });
  return out;
}

/** 판정에 따른 점수 (드럼처럼: PERFECT 1000·GREAT 700·GOOD 400 × 콤보 배수, 콤보는 PERFECT 만 쌓임) */
export const tilePoints = (word, combo) => pointsFor(word, combo);

/**
 * 판 전체(코스): 바퀴 0(별 3개) → 🪙 코인 파티 → 바퀴 1·2·3(점점 빠르게, 다이아 하나씩) — 바퀴마다 같은 타일·같은 줄
 *   → { tempo, t0, B, P, laps, segs, tiles, points(만점), lapEnd, lapPts, u }
 *     tiles[i] = { abs, step, row, rows, hold, pts(만점), lane, k(바퀴, 파티는 -1), coin, t(초, 첫 타일 = 0), midi, len }
 */
export function buildCourse(lap, { laps = MAX_LAPS, party = true } = {}) {
  const B = lap.bars;
  const u = lap.u;
  const P = party && laps >= 2 ? PARTY_BARS : 0;
  const segs = [{ kind: 'lap', k: 0, bar0: 0, bars: B }];
  if (P) segs.push({ kind: 'party', k: -1, bar0: B, bars: P });
  for (let k = 1; k < laps; k++) segs.push({ kind: 'lap', k, bar0: B + P + (k - 1) * B, bars: B });
  const sp = lap.speeds || LAP_SPEEDS;
  const speedAt = (bar) => {
    if (bar < B) return lapSpeed(0, sp);
    if (bar < B + P) return lapSpeed(1, sp);
    return lapSpeed(1 + Math.floor((bar - B - P) / B), sp);
  };
  const tempo = new TempoMap((bar) => lap.bpm * speedAt(bar));
  const t0 = tempo.stepTime(lap.first);
  const timeOf = (abs) => tempo.stepTime(abs) - t0;
  const tiles = [];
  for (const sg of segs) {
    const a0 = sg.bar0 * STEPS_PER_BAR;
    if (sg.kind === 'party') {
      // 쉬는 마디 (코인 없음)
      continue;
    }
    for (const p of lap.pattern) tiles.push({ abs: a0 + p.at, k: sg.k, coin: false, len: p.len, midi: p.midi, rows: p.rows, hold: p.hold, lane: p.lane });
  }
  tiles.sort((x, y) => x.abs - y.abs || x.lane - y.lane);
  // 만점: PERFECT 로 계속 쳤을 때 (콤보 배수) + 긴 타일 덤
  let combo = 0;
  let pts = 0;
  let n = 0;
  const lapEnd = [];
  const lapPts = [];
  for (const c of tiles) {
    c.t = timeOf(c.abs);
    c.step = c.abs;
    c.row = c.abs / u;
    if (c.coin) {
      c.pts = 0;
      continue;
    }
    while (lapEnd.length < c.k) lapEnd.push(n), lapPts.push(pts);
    combo++;
    c.pts = tilePoints('perfect', combo) + (c.rows - 1) * HOLD_PTS;
    pts += c.pts;
    n++;
  }
  while (lapEnd.length < laps) lapEnd.push(n), lapPts.push(pts);
  return { tempo, t0, B, P, laps, segs, tiles, points: pts, lapEnd, lapPts, u };
}

/**
 * 4줄 고르기: 올라가면 오른쪽, 내려가면 왼쪽(크게 뛰면 두 칸), 같은 음은 옆 줄 · 코인 파티는 계단.
 *   같은 줄 연속 없음 + 그 줄에 아직 앞 타일(긴 타일)이 남아 있으면 다른 줄
 */
export function assignLanes(tiles, u = 4) {
  if (!tiles.length) return;
  const song = tiles.filter((t) => !t.coin);
  const avg = song.length ? song.reduce((a, t) => a + t.midi, 0) / song.length : 60;
  const endAt = [-1e9, -1e9, -1e9, -1e9];
  let prev = -1;
  let prevMidi = null;
  let stair = 0;
  tiles.forEach((t, i) => {
    let L;
    if (t.coin) {
      L = [0, 1, 2, 3, 2, 1][stair++ % 6];
    } else if (prev < 0 || prevMidi == null) L = t.midi >= avg ? 2 : 1;
    else {
      const d = t.midi - prevMidi;
      const st = Math.abs(d) >= 5 ? 2 : 1;
      if (d > 0) L = prev + st <= 3 ? prev + st : prev - 1 - (i % 2);
      else if (d < 0) L = prev - st >= 0 ? prev - st : prev + 1 + (i % 2);
      else L = prev === 0 ? 1 : prev === 3 ? 2 : prev + (i % 2 ? 1 : -1);
      L = Math.max(0, Math.min(3, L));
    }
    const free = (x) => x !== prev && endAt[x] <= t.abs + 0.01;
    if (!free(L)) {
      const order = [1, -1, 2, -2, 3, -3].map((k) => L + k).filter((x) => x >= 0 && x <= 3);
      L = order.find(free) ?? order.find((x) => x !== prev) ?? (prev === 0 ? 1 : 0);
    }
    t.lane = L;
    endAt[L] = t.abs + t.rows * u;
    prev = L;
    if (!t.coin) prevMidi = t.midi;
  });
}

/** 한 바퀴가 이보다 짧은 곡(초): 한 옥타브 바꾼 변주를 뒤에 붙임 (같은 높이로 되풀이하지 않게) */
export const LAP_MIN_SEC = 28;
const PCN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** 멜로디 한 마디를 semis 반음 옮김 */
export function transposeBar(line, semis) {
  return line
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [name, l] = tok.split(':');
      if (name === '_') return tok;
      const m = noteToMidi(name) + semis;
      return `${PCN[m % 12]}${Math.floor(m / 12) - 1}${l === undefined ? '' : ':' + l}`;
    })
    .join(' ');
}
const lapSec = (lap) => (lap.steps * 15) / lap.bpm;

const _laps = new Map();
/** 곡 번호 → 한 바퀴 (곡마다 기억) */
export function tileLap(songId) {
  if (_laps.has(songId)) return _laps.get(songId);
  const s = TILE_SONGS.find((x) => x.id === songId);
  const src = s && tileSource(songId);
  let lap = src ? buildLap(src.melody, src.prog, TILE_RPS[s.diff], DIFF_SPEEDS[s.diff]) : null;
  if (lap && lapSec(lap) < LAP_MIN_SEC) {
    // 짧은 곡: 두 번째는 한 옥타브 위(너무 높으면 아래)로 — 반짝이는 변주처럼
    const ns = parseMelody(src.melody);
    const hi = Math.max(...ns.map((n) => n.midi));
    const sh = hi + 12 <= 88 ? 12 : -12;
    lap = buildLap([...src.melody, ...src.melody.map((b) => transposeBar(b, sh))], [...src.prog, ...src.prog], TILE_RPS[s.diff], DIFF_SPEEDS[s.diff]);
  }
  if (lap) lap.songId = songId;
  _laps.set(songId, lap);
  return lap;
}

/** 🎹 유저 맵(타일) → 한 바퀴. 빠르기는 맵 BPM 을 초당 줄로 바꿔 2.6~5 사이로 */
export function mapTileLap(map) {
  if (!map || !Array.isArray(map.melody)) return null;
  try {
    const prog = map.prog || map.melody.map(() => 'C');
    const tl = Array.isArray(map.tl) ? map.tl : null;
    // 올릴 때 고른 난이도(tdiff 1~5)가 있으면 곡 타일과 같은 빠르기
    const d = Number(map.tdiff);
    if (d >= 1 && d <= 5) return buildLap(map.melody, prog, TILE_RPS[d], DIFF_SPEEDS[d], tl);
    const probe = buildLap(map.melody, prog, 1, LAP_SPEEDS, tl);
    if (!probe) return null;
    const rps = Math.max(2.6, Math.min(3.8, map.bpm / (15 * probe.u)));
    return buildLap(map.melody, prog, rps, LAP_SPEEDS, tl);
  } catch {
    return null;
  }
}
/** 유저 맵 타일은 2바퀴(별 3개 → 코인 파티 → 다이아 3개)에서 끝 */
export const MAP_TILE_LAPS = 2;
export const mapTileMax = (map) => {
  const lap = mapTileLap(map);
  return lap ? buildCourse(lap, { laps: MAP_TILE_LAPS }).points : 0;
};

/** 바퀴 k(0부터)의 빠르기 배수: 첫 곡은 그대로, 그 뒤 바퀴마다 +0.12 */
export function lapSpeed(k, sp = LAP_SPEEDS) {
  return sp[Math.max(0, Math.min(sp.length - 1, k))];
}
/**
 * 별 · 다이아: 첫 바퀴에서 별 3개가 차오름 (frac = 그 바퀴 진행 0~1, 1/3·2/3·끝), 둘째 바퀴에서 다이아 3개가 똑같이
 *   laps = 다 돈 바퀴 수
 */
export function lapStars(laps, frac = 0) {
  const k = Math.max(0, Math.min(2, Math.floor(frac * 3 + 1e-9)));
  if (laps <= 0) return { stars: k, gems: 0 };
  // 2026-11-27: 다이아는 빨라진 바퀴(곡 하나)를 끝낼 때마다 하나씩
  return { stars: 3, gems: Math.max(0, Math.min(3, laps - 1)) };
}

export const tileId = (songId) => `t${songId}`;
/** 't3' → 곡 정보 { id, diff, order(1부터), level } (아니면 null) */
export function tileSong(id) {
  const m = /^t(\d{1,3})$/.exec(String(id || ''));
  if (!m) return null;
  const i = TILE_SONGS.findIndex((s) => s.id === Number(m[1]));
  if (i < 0) return null;
  const level = getLevel(TILE_SONGS[i].id);
  if (!level) return null;
  return { ...TILE_SONGS[i], order: i + 1, level, key: tileId(TILE_SONGS[i].id) };
}
export const tileSlot = (songId) => TILE_SLOT0 + Number(songId);
export const isTileSlot = (slot) => slot > TILE_SLOT0 && slot <= TILE_SLOT_MAX;
export const tileClosed = (song) => !!song && song.order > TILE_FREE;

const _courses = new Map();
/** 곡 번호 → 혼자 치는 판 전체 코스 (코인 파티 포함, MAX_LAPS 바퀴) — 서버 검사도 이걸로 */
export function tileCourse(songId) {
  if (_courses.has(songId)) return _courses.get(songId);
  const lap = tileLap(songId);
  const c = lap ? buildCourse(lap, { laps: MAX_LAPS, party: true }) : null;
  _courses.set(songId, c);
  return c;
}

const _times = new Map();
/** 점수 타일(코인 빼고) 시각(초, 정렬)과 그때까지 쌓인 점수 — 서버가 '이 시간 안에 칠 수 있는 점수'를 셈 */
export function tileTimes(songId) {
  if (_times.has(songId)) return _times.get(songId);
  const c = tileCourse(songId);
  if (!c) return null;
  const t = [];
  const cum = [];
  let sum = 0;
  for (const tl of c.tiles) {
    if (tl.coin) continue;
    t.push(tl.t);
    sum += tl.pts;
    cum.push(sum);
  }
  const out = { t, cum };
  _times.set(songId, out);
  return out;
}

/** 판 시작부터 sec 초 안에 화면에 들어온(칠 수 있었던) 타일들의 점수 — 여유 slack 초 */
export function tilesWithin(songId, sec, slack = 4) {
  const tt = tileTimes(songId);
  if (!tt) return 0;
  let lo = 0;
  let hi = tt.t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tt.t[mid] <= sec + slack) lo = mid + 1;
    else hi = mid;
  }
  return lo ? tt.cum[lo - 1] : 0;
}

/**
 * 점수 검증 (서버): body { tiles(=점수, 2026-11-27 부터 드럼처럼 판정 점수 × 콤보 배수), laps, maxCombo }, 판 토큰 시작부터 지난 초 elapsed
 *   → { ok, tiles, laps, maxCombo } | { ok:false, error }
 */
export function checkTileRun(songId, body, elapsedSec) {
  const c = tileCourse(songId);
  if (!c) return { ok: false, error: 'bad_level' };
  const tiles = body.tiles;
  const laps = body.laps;
  if (!Number.isInteger(tiles) || tiles < 0 || tiles > c.points) return { ok: false, error: 'bad_score' };
  if (!Number.isInteger(laps) || laps < 0 || laps > MAX_LAPS) return { ok: false, error: 'bad_score' };
  if (elapsedSec > 3 * 3600) return { ok: false, error: 'run_expired' };
  // 그 시간 안에 화면에 들어올 수 있는 타일 점수보다 많이 칠 순 없음
  if (tiles > tilesWithin(songId, elapsedSec)) return { ok: false, error: 'too_fast' };
  // 바퀴 수: 다 돈 바퀴의 타일(놓친 건 하트 3개 + 바퀴마다 회복분까지만)을 가장 낮은 판정(GOOD 400)으로 쳤을 때보다 적을 순 없음
  if (laps > 0 && tiles < (c.lapEnd[laps - 1] - 3 * (laps + 1)) * 400) return { ok: false, error: 'bad_score' };
  // 지금 치던 바퀴까지의 점수보다 많이 칠 순 없음
  if (tiles > c.lapPts[Math.min(laps, MAX_LAPS - 1)]) return { ok: false, error: 'bad_score' };
  const maxCombo = Number.isInteger(body.maxCombo) ? Math.max(0, Math.min(body.maxCombo, c.lapEnd[MAX_LAPS - 1])) : 0;
  return { ok: true, tiles, laps, maxCombo };
}

/** 랭킹 표의 grade 칸에 바퀴 수를 적음 ('L5') */
export const lapGrade = (laps) => `L${Math.max(0, Math.min(MAX_LAPS, laps | 0))}`;
export const gradeLaps = (g) => {
  const m = /^L(\d+)$/.exec(String(g || ''));
  return m ? Number(m[1]) : 0;
};
