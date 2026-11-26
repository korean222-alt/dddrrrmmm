// 🎹 시즌 2 피아노 타일 — 브라우저와 서버가 같이 씀
//   2026-11-26 밤 다시 만듦 (사용자 '디테일은 전부 피아노 타일을 따라 해'):
//   · 줄(row) 단위: 화면 높이의 1/4 = 한 줄. **보통 타일 크기는 모든 곡·유저 맵에서 똑같고 바뀌지 않음** (TILE_ROWS)
//     곡마다 '한 줄 = 몇 16분 칸'(u)을 정하고(가장 흔한 음 간격), 빠르기는 '초당 줄 수'로 정함 → 곡이 달라도 타일 크기·느낌이 같음
//   · 타일 하나 = 음 하나. 두 줄 이상 길게 끄는 음(쉼 없이)은 꾹 누르는 긴 타일 (끝까지 누르면 줄 수만큼 점수)
//   · 한 바퀴 = 곡 하나 처음부터 끝까지 (짧은 멜로디를 되풀이하지 않음 — '노래가 계속 반복돼서 재미없다' 11-26)
//     조각만 있던 곡은 TILE_MEL 에 곡 전체(절·후렴 등)를 따로 적음
//   · 첫 바퀴: 별 3개가 1/3·2/3·끝에 차오름 → 둘째 바퀴(빨라짐): 빈 다이아 3개가 똑같이 차오름 → 그 뒤로도 바퀴마다 빨라지며 계속
//   · 반주는 따로 안 흐름: 타일을 누르면 그 음이 남 (반 마디 첫 타일엔 왼손 낮은 음도) — 피아노 타일처럼
//   · 점수 = 친 타일 + 긴 타일 덤. 랭킹 = 곡마다(scores 칸 3000+곡 번호) + 시즌 총합(명예의 전당 'tiles')
//   ⚠ 서버는 tileTimes 로 '그 시간 안에 칠 수 있는 점수'를 넘는 기록을 막음

import { parseMelody, parseChord, noteToMidi, STEPS_PER_BAR, getLevel, TempoMap } from './charts.js';

/** 화면에 보이는 줄 수 (보통 타일 높이 = 화면 높이 / TILE_ROWS). 바꾸지 말 것 (11-26 사용자) */
export const TILE_ROWS = 4;
/** 난이도별 첫 바퀴 빠르기 (초당 줄 수) */
export const TILE_RPS = [0, 3.0, 3.4, 3.8, 4.3, 4.8];

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
export const MAX_LAPS = 16;
export const TILE_HEARTS = 3;
/** 이만큼(줄) 화면 아래로 지나가면 놓침 */
export const GONE_ROWS = 0.35;
/** 이웃한 두 타일 사이는 첫 바퀴에서 적어도 이만큼(초) */
export const MIN_GAP = 0.13;

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
 * 한 바퀴 만들기: melody(마디 문자열) · prog(마디 코드) · rps(초당 줄)
 *   → { u, bpm, bars, steps, tiles: [{ step, len, gap, rows, hold, pts, midi, lane, acc }], points, first }
 *   rows = 타일 높이(줄), hold = 꾹 누르는 긴 타일, pts = 끝까지 치면 얻는 점수, acc = 같이 울릴 왼손 음
 */
export function buildLap(melody, prog, rps) {
  const notes = parseMelody(melody).map((n) => ({ ...n, at: n.bar * STEPS_PER_BAR + n.step }));
  // 같은 칸에 음이 둘이면 위 음 하나만
  const uniq = [];
  for (const n of notes) {
    const last = uniq[uniq.length - 1];
    if (last && last.at === n.at) {
      if (n.midi > last.midi) uniq[uniq.length - 1] = n;
    } else uniq.push(n);
  }
  if (!uniq.length) return null;
  const u = rowUnit(uniq);
  // 가장 붙은 두 타일 사이가 MIN_GAP 초보다 짧아지지 않게 빠르기를 낮춤
  let mg = Infinity;
  for (let i = 1; i < uniq.length; i++) mg = Math.min(mg, uniq[i].at - uniq[i - 1].at);
  if (isFinite(mg)) rps = Math.min(rps, mg / (MIN_GAP * u));
  const bars = melody.length;
  const steps = bars * STEPS_PER_BAR;
  const tiles = uniq.map((n, i) => {
    const gap = (i + 1 < uniq.length ? uniq[i + 1].at : steps + uniq[0].at) - n.at;
    const span = Math.min(n.len, gap);
    const rows = span >= 2 * u ? Math.floor(span / u) : 1;
    return { step: n.at, bar: n.bar, len: n.len, gap, rows, hold: rows >= 2, pts: rows, midi: n.midi, lane: 0, acc: null };
  });
  // 왼손: 반 마디마다 그 반 마디의 첫 타일에 코드 밑음 (낮게)
  let half = -1;
  for (const t of tiles) {
    const h = Math.floor(t.step / 8);
    if (h === half) continue;
    half = h;
    try {
      const parts = String(prog[t.bar] || 'C').trim().split(/\s+/);
      const ch = parseChord(parts[Math.min(parts.length - 1, (h % 2) * (parts.length > 1 ? 1 : 0))]);
      t.acc = [ch.root - 12, ch.root - 5];
    } catch {}
  }
  assignLanes(tiles, u);
  const bpm = 15 * u * rps;
  return { u, bpm, bars, steps, tiles, points: tiles.reduce((a, t) => a + t.pts, 0), first: tiles[0].step };
}

/**
 * 4줄 고르기: 올라가면 오른쪽, 내려가면 왼쪽(크게 뛰면 두 칸), 같은 음은 옆 줄.
 *   같은 줄 연속 없음 + 그 줄에 아직 앞 타일(긴 타일)이 남아 있으면 다른 줄
 */
export function assignLanes(tiles, u = 4) {
  if (!tiles.length) return;
  const avg = tiles.reduce((a, t) => a + t.midi, 0) / tiles.length;
  const endAt = [-1e9, -1e9, -1e9, -1e9];
  let prev = -1;
  tiles.forEach((t, i) => {
    let L;
    if (prev < 0) L = t.midi >= avg ? 2 : 1;
    else {
      const d = t.midi - tiles[i - 1].midi;
      const st = Math.abs(d) >= 5 ? 2 : 1;
      if (d > 0) L = prev + st <= 3 ? prev + st : prev - 1 - (i % 2);
      else if (d < 0) L = prev - st >= 0 ? prev - st : prev + 1 + (i % 2);
      else L = prev === 0 ? 1 : prev === 3 ? 2 : prev + (i % 2 ? 1 : -1);
      L = Math.max(0, Math.min(3, L));
    }
    const free = (x) => x !== prev && endAt[x] <= t.step + 0.01;
    if (!free(L)) {
      const order = [1, -1, 2, -2, 3, -3].map((k) => L + k).filter((x) => x >= 0 && x <= 3);
      L = order.find(free) ?? order.find((x) => x !== prev) ?? (prev === 0 ? 1 : 0);
    }
    t.lane = L;
    endAt[L] = t.step + t.rows * u;
    prev = L;
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
  let lap = src ? buildLap(src.melody, src.prog, TILE_RPS[s.diff]) : null;
  if (lap && lapSec(lap) < LAP_MIN_SEC) {
    // 짧은 곡: 두 번째는 한 옥타브 위(너무 높으면 아래)로 — 반짝이는 변주처럼
    const ns = parseMelody(src.melody);
    const hi = Math.max(...ns.map((n) => n.midi));
    const sh = hi + 12 <= 88 ? 12 : -12;
    lap = buildLap([...src.melody, ...src.melody.map((b) => transposeBar(b, sh))], [...src.prog, ...src.prog], TILE_RPS[s.diff]);
  }
  if (lap) lap.songId = songId;
  _laps.set(songId, lap);
  return lap;
}

/** 🎹 유저 맵(타일) → 한 바퀴. 빠르기는 맵 BPM 을 초당 줄로 바꿔 2.6~5 사이로 */
export function mapTileLap(map) {
  if (!map || !Array.isArray(map.melody)) return null;
  try {
    const probe = buildLap(map.melody, map.prog || map.melody.map(() => 'C'), 1);
    if (!probe) return null;
    const rps = Math.max(2.6, Math.min(5, map.bpm / (15 * probe.u)));
    return buildLap(map.melody, map.prog || map.melody.map(() => 'C'), rps);
  } catch {
    return null;
  }
}
/** 유저 맵 타일은 2바퀴(별 3개 → 다이아 3개)에서 끝 */
export const MAP_TILE_LAPS = 2;
export const mapTileMax = (map) => {
  const lap = mapTileLap(map);
  return lap ? lap.points * MAP_TILE_LAPS : 0;
};

/** 바퀴 k(0부터)의 빠르기 배수: 첫 곡은 그대로, 그 뒤 바퀴마다 +0.12 */
export function lapSpeed(k) {
  return k <= 0 ? 1 : 1 + 0.12 * k;
}
/**
 * 별 · 다이아: 첫 바퀴에서 별 3개가 차오름 (frac = 그 바퀴 진행 0~1, 1/3·2/3·끝), 둘째 바퀴에서 다이아 3개가 똑같이
 *   laps = 다 돈 바퀴 수
 */
export function lapStars(laps, frac = 0) {
  const k = Math.max(0, Math.min(2, Math.floor(frac * 3 + 1e-9)));
  if (laps <= 0) return { stars: k, gems: 0 };
  if (laps === 1) return { stars: 3, gems: k };
  return { stars: 3, gems: 3 };
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

/** 시계: 바퀴 k 마디 = 타일 빠르기 × lapSpeed(k). 곡 시각 0 = 첫 타일이 시작 자리에 있을 때 */
export function lapTempo(lap) {
  return new TempoMap((bar) => lap.bpm * lapSpeed(Math.floor(Math.max(0, bar) / lap.bars)));
}
export function tileTempo(songId) {
  const lap = tileLap(songId);
  return lap ? lapTempo(lap) : null;
}

const _times = new Map();
/** 모든 바퀴 타일 시각(초, 정렬)과 그때까지 쌓인 점수 — 서버가 '이 시간 안에 칠 수 있는 점수'를 셈 */
export function tileTimes(songId) {
  if (_times.has(songId)) return _times.get(songId);
  const lap = tileLap(songId);
  if (!lap) return null;
  const tempo = lapTempo(lap);
  const t0 = tempo.stepTime(lap.first);
  const t = [];
  const cum = [];
  let sum = 0;
  for (let k = 0; k < MAX_LAPS; k++)
    for (const tl of lap.tiles) {
      t.push(tempo.stepTime(k * lap.steps + tl.step) - t0);
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
 * 점수 검증 (서버): body { tiles(=점수), laps, maxCombo }, 판 토큰 시작부터 지난 초 elapsed
 *   → { ok, tiles, laps, maxCombo } | { ok:false, error }
 */
export function checkTileRun(songId, body, elapsedSec) {
  const lap = tileLap(songId);
  if (!lap) return { ok: false, error: 'bad_level' };
  const tiles = body.tiles;
  const laps = body.laps;
  if (!Number.isInteger(tiles) || tiles < 0 || tiles > lap.points * MAX_LAPS) return { ok: false, error: 'bad_score' };
  if (!Number.isInteger(laps) || laps < 0 || laps > MAX_LAPS) return { ok: false, error: 'bad_score' };
  if (elapsedSec > 3 * 3600) return { ok: false, error: 'run_expired' };
  // 그 시간 안에 화면에 들어올 수 있는 타일 점수보다 많이 칠 순 없음
  if (tiles > tilesWithin(songId, elapsedSec)) return { ok: false, error: 'too_fast' };
  // 바퀴 수: 다 돈 바퀴의 타일 수(놓친 건 하트 3개 + 바퀴마다 회복분까지만)보다 적게 칠 순 없음
  const per = lap.tiles.length;
  if (laps > 0 && tiles < laps * per - TILE_HEARTS * (laps + 1)) return { ok: false, error: 'bad_score' };
  if (tiles > (laps + 1) * lap.points) return { ok: false, error: 'bad_score' };
  const maxCombo = Number.isInteger(body.maxCombo) ? Math.max(0, Math.min(body.maxCombo, tiles)) : 0;
  return { ok: true, tiles, laps, maxCombo };
}

/** 랭킹 표의 grade 칸에 바퀴 수를 적음 ('L5') */
export const lapGrade = (laps) => `L${Math.max(0, Math.min(MAX_LAPS, laps | 0))}`;
export const gradeLaps = (g) => {
  const m = /^L(\d+)$/.exec(String(g || ''));
  return m ? Number(m[1]) : 0;
};
