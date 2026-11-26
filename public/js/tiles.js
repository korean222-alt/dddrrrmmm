// 🎹 시즌 2 피아노 타일 (2026-11-26, 투표에서 'A 타일'이 이김) — 브라우저와 서버가 같이 씀
//   곡 = 드럼 단계 곡(퍼블릭 도메인)의 멜로디. 타일 하나 = 8분음표 칸 하나(더 빠른 음은 그 타일을 누르면 같이 울림)
//   한 바퀴(lap) 돌 때마다 빨라짐: ★ → ★★ → ★★★ → 👑(그 뒤 바퀴마다) — 하트 3개(놓침·빈 줄 누름에 하나씩), 바퀴를 돌면 하나 회복
//   점수 = 친 타일 수. 랭킹 = 곡마다(scores 칸 3000+곡 번호) + 시즌 타일 총합(명예의 전당 'tiles')
//   판정 글자 없음: 아래쪽에 온 타일을 누르기만 하면 됨 (빠를수록 그 시간이 짧아짐)
//   ⚠ 서버는 tileTimes 로 '그 시간 안에 칠 수 있는 타일 수'를 넘는 점수를 막음 → 이 파일을 바꾸면 이미 올라간 기록과 기준이 달라짐

import { parseMelody, STEPS_PER_BAR, COUNT_IN_BARS, getLevel, TempoMap, CRASH } from './charts.js';

/** 곡 목록 (쉬운 것부터). bpm = 타일용 빠르기 (느린 곡은 조금 빠르게: 첫 바퀴 초당 타일 1.5~2개쯤) */
export const TILE_SONGS = [
  { id: 1, bpm: 128, diff: 1 },
  { id: 2, bpm: 118, diff: 1 },
  { id: 3, bpm: 128, diff: 1 },
  { id: 4, bpm: 138, diff: 1 },
  { id: 5, bpm: 146, diff: 2 },
  { id: 6, bpm: 113, diff: 2 },
  { id: 11, bpm: 108, diff: 2 },
  { id: 12, bpm: 128, diff: 2 },
  { id: 7, bpm: 112, diff: 3 },
  { id: 17, bpm: 132, diff: 3 },
  { id: 9, bpm: 110, diff: 3 },
  { id: 8, bpm: 108, diff: 3 },
  { id: 16, bpm: 120, diff: 4 },
  { id: 10, bpm: 108, diff: 4 },
  { id: 13, bpm: 112, diff: 4 },
  { id: 18, bpm: 144, diff: 4 },
  { id: 14, bpm: 132, diff: 5 },
  { id: 15, bpm: 144, diff: 5 },
];
export const TILE_DIFF = ['', '쉬움', '보통', '어려움', '지옥', '지옥+'];
/** 처음 몇 곡은 누구나 (나머지는 드럼 4단계부터처럼 팔로워 인증) */
export const TILE_FREE = 3;
/** 랭킹 저장 칸: scores.level = 3000 + 곡 번호 */
export const TILE_SLOT0 = 3000;
export const TILE_SLOT_MAX = 3999;
/** 한 바퀴는 적어도 이만큼 (짧은 멜로디는 되풀이) */
export const LAP_MIN_SEC = 22;
/** 타일 사이 최소 칸 (16분 칸, 2 = 8분음표) */
export const TILE_MIN_GAP = 2;
/** 이 바퀴까지 돌면 끝 (그 전에 사람은 못 버팀) */
export const MAX_LAPS = 16;
export const TILE_HEARTS = 3;
/** 박 단위 창: 이만큼 앞이면 누를 수 있음 / 가장 먼저 와야 할 타일은 이만큼 앞부터 / 이만큼 지나면 놓침 */
export const READY_B = 1.25;
export const NEXT_B = 3;
export const GONE_B = 0.5;
export const GONE_MIN_SEC = 0.15;

/** 바퀴 k(0부터)의 빠르기 배수: 1 → 1.2 → 1.4 → 바퀴마다 +0.12 */
export function lapSpeed(k) {
  return k <= 0 ? 1 : k === 1 ? 1.2 : 1.4 + 0.12 * (k - 2);
}
/** 바퀴 수 → 별(1~3) · 왕관(4바퀴부터 1개씩) */
export function lapStars(laps) {
  return { stars: Math.min(3, Math.max(0, laps)), crowns: Math.max(0, laps - 3) };
}

export const tileId = (songId) => `t${songId}`;
/** 't3' → 곡 정보 { id, bpm, diff, order(1부터), level } (아니면 null) */
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

const _laps = new Map();
/**
 * 한 바퀴 타일 [{ step, beat, notes:[{ d, midi, len }], midi, bar }] + 바퀴 정보 (곡마다 기억)
 *   step = 바퀴 안 16분 칸, d = 타일 첫 음에서 몇 칸 뒤에 울리는지
 */
export function tileLap(songId) {
  if (_laps.has(songId)) return _laps.get(songId);
  const s = TILE_SONGS.find((x) => x.id === songId);
  const level = getLevel(songId);
  if (!s || !level || !level.song || !level.song.melody) return null;
  const bars = level.song.melody.length;
  const reps = Math.max(1, Math.ceil(LAP_MIN_SEC / ((bars * 240) / s.bpm)));
  const notes = parseMelody(level.song.melody);
  const tiles = [];
  for (let r = 0; r < reps; r++) {
    let last = -99;
    for (const n of notes) {
      const step = (r * bars + n.bar) * STEPS_PER_BAR + n.step;
      const cur = tiles[tiles.length - 1];
      if (cur && step - last < TILE_MIN_GAP) cur.notes.push({ d: step - cur.step, midi: n.midi, len: n.len });
      else {
        tiles.push({ step, beat: step / 4, bar: r * bars + n.bar, s: n.step, midi: n.midi, len: n.len, notes: [{ d: 0, midi: n.midi, len: n.len }] });
        last = step;
      }
    }
  }
  const lanes = tileLanes(tiles.map((t) => t.midi));
  tiles.forEach((t, i) => (t.lane = lanes[i]));
  const lap = { songId, bpm: s.bpm, bars: bars * reps, reps, beats: bars * reps * 4, tiles };
  _laps.set(songId, lap);
  return lap;
}

/** 4줄: 올라가면 오른쪽, 내려가면 왼쪽(크게 뛰면 두 칸), 같은 음은 옆 줄. 같은 줄 연속 없음 */
export function tileLanes(midis) {
  const out = [];
  if (!midis.length) return out;
  const avg = midis.reduce((a, x) => a + x, 0) / midis.length;
  let prev = -1;
  midis.forEach((m, i) => {
    let L;
    if (prev < 0) L = m >= avg ? 2 : 1;
    else {
      const d = m - midis[i - 1];
      const step = Math.abs(d) >= 5 ? 2 : 1;
      if (d > 0) L = prev + step <= 3 ? prev + step : prev - 1 - (i % 2);
      else if (d < 0) L = prev - step >= 0 ? prev - step : prev + 1 + (i % 2);
      else L = prev === 0 ? 1 : prev === 3 ? 2 : prev + (i % 2 ? 1 : -1);
      L = Math.max(0, Math.min(3, L));
      if (L === prev) L = prev === 0 ? 1 : prev - 1;
    }
    out.push(L);
    prev = L;
  });
  return out;
}

/** 바퀴 k 의 줄 뒤집기: 홀수 바퀴는 좌우 반대 (지루하지 않게) — 바퀴 경계에서 같은 줄이 이어지면 반대로 */
export function lapMirrors(lap, n = MAX_LAPS) {
  const out = [];
  const first = lap.tiles[0].lane;
  const last = lap.tiles[lap.tiles.length - 1].lane;
  for (let k = 0; k < n; k++) {
    let m = k % 2 === 1;
    if (k > 0) {
      const prevLast = out[k - 1] ? 3 - last : last;
      if ((m ? 3 - first : first) === prevLast) m = !m;
    }
    out.push(m);
  }
  return out;
}

/** 곡 시각 (카운트인 첫 박 = 0): 카운트인 한 마디는 첫 바퀴 빠르기. 바퀴 k 마디 = 타일 빠르기 × lapSpeed(k) */
export function tileTempo(songId) {
  const lap = tileLap(songId);
  if (!lap) return null;
  return new TempoMap((bar) => lap.bpm * lapSpeed(Math.floor(Math.max(0, bar - COUNT_IN_BARS) / lap.bars)));
}

const _times = new Map();
/** 모든 바퀴 타일 시각(초, 정렬) — 서버가 '이 시간 안에 칠 수 있는 타일 수'를 셈 */
export function tileTimes(songId) {
  if (_times.has(songId)) return _times.get(songId);
  const lap = tileLap(songId);
  if (!lap) return null;
  const tempo = tileTempo(songId);
  const out = [];
  for (let k = 0; k < MAX_LAPS; k++) for (const t of lap.tiles) out.push(tempo.stepTime(COUNT_IN_BARS * STEPS_PER_BAR + k * lap.bars * STEPS_PER_BAR + t.step));
  _times.set(songId, out);
  return out;
}

/** 판 시작부터 sec 초 안에 지나간(칠 수 있었던) 타일 수 — 여유 slack 초 */
export function tilesWithin(songId, sec, slack = 4) {
  const times = tileTimes(songId);
  if (!times) return 0;
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= sec + slack) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 소리 엔진용 단계 (멜로디는 내가 침, 반주는 피아노 왼손만, 바퀴마다 빨라짐) */
export function tileLevel(songId) {
  const lap = tileLap(songId);
  const base = getLevel(songId);
  if (!lap || !base) return null;
  const dots = '.'.repeat(STEPS_PER_BAR);
  const one = Array.from({ length: lap.reps }, () => base.song.melody).flat();
  const melody = Array.from({ length: MAX_LAPS }, () => one).flat();
  const prog0 = base.song.prog || ['C'];
  const prog = Array.from({ length: base.song.melody.length }, (_, i) => prog0[i % prog0.length]);
  const song = { ...base.song, melody, prog, pianoLH: true, bass: dots, chord: dots, hat: dots, bells: undefined, glock: undefined, choir: undefined, audio: undefined, epic: false, low: undefined };
  return { ...base, bpm: lap.bpm, song, tapMelody: true, pianoOnly: true, lanes: [CRASH], bars: melody.map(() => dots), tempo: tileTempo(songId), tiles: true };
}

/**
 * 점수 검증 (서버): body { tiles, laps, maxCombo }, 판 토큰 시작부터 지난 초 elapsed
 *   → { ok, tiles, laps, maxCombo } | { ok:false, error }
 */
export function checkTileRun(songId, body, elapsedSec) {
  const lap = tileLap(songId);
  if (!lap) return { ok: false, error: 'bad_level' };
  const tiles = body.tiles;
  const laps = body.laps;
  if (!Number.isInteger(tiles) || tiles < 0 || tiles > lap.tiles.length * MAX_LAPS) return { ok: false, error: 'bad_score' };
  if (!Number.isInteger(laps) || laps < 0 || laps > MAX_LAPS) return { ok: false, error: 'bad_score' };
  if (elapsedSec > 3 * 3600) return { ok: false, error: 'run_expired' };
  // 그 시간 안에 지나갈 수 있는 타일보다 많이 칠 순 없음
  if (tiles > tilesWithin(songId, elapsedSec)) return { ok: false, error: 'too_fast' };
  // 바퀴 수: 다 돈 바퀴의 타일 수(놓친 건 하트 3개 + 바퀴마다 회복분까지만)보다 적게 칠 순 없음
  const per = lap.tiles.length;
  if (laps > 0 && tiles < laps * per - TILE_HEARTS * (laps + 1)) return { ok: false, error: 'bad_score' };
  if (tiles > (laps + 1) * per) return { ok: false, error: 'bad_score' };
  const maxCombo = Number.isInteger(body.maxCombo) ? Math.max(0, Math.min(body.maxCombo, tiles)) : 0;
  return { ok: true, tiles, laps, maxCombo };
}

/** 랭킹 표의 grade 칸에 바퀴 수를 적음 ('L5') */
export const lapGrade = (laps) => `L${Math.max(0, Math.min(MAX_LAPS, laps | 0))}`;
export const gradeLaps = (g) => {
  const m = /^L(\d+)$/.exec(String(g || ''));
  return m ? Number(m[1]) : 0;
};
