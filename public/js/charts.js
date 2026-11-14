// 콩콩 드럼 — 레벨/채보 정의 (브라우저와 서버가 같이 씁니다)
//
// 채보 표기: 한 마디 = 16칸(16분음표)
//   K = 킥 (왼쪽 엄지)        S = 스네어 (오른쪽 엄지)
//   H = 하이햇 (오른쪽 엄지, 5단계부터)   C = 크래시 (왼쪽 엄지, 6단계부터)
//   B = 킥+스네어 동시   J = 킥+하이햇 동시   X = 크래시+스네어 동시   . = 쉼
//   같은 엄지끼리(킥+크래시, 스네어+하이햇)는 동시에 못 누르니 그런 조합은 없음
// 새 레벨을 추가하려면 LEVELS 배열에 객체를 하나 더 넣으면 됩니다.

export const STEPS_PER_BAR = 16;

// 악기(레인) 번호. 화면에는 왼쪽부터 크래시 · 킥 · 스네어 · 하이햇 순서로 나옵니다.
export const KICK = 0;
export const SNARE = 1;
export const HAT = 2;
export const CRASH = 3;
export const INSTRUMENTS = [
  { id: KICK, name: '킥', hand: 'left' },
  { id: SNARE, name: '스네어', hand: 'right' },
  { id: HAT, name: '하이햇', hand: 'right' },
  { id: CRASH, name: '크래시', hand: 'left' },
];
const SCREEN_ORDER = [CRASH, KICK, SNARE, HAT];
/** 채보 글자 → 누를 레인들 */
export const CHAR_LANES = { K: [KICK], S: [SNARE], H: [HAT], C: [CRASH], B: [KICK, SNARE], J: [KICK, HAT], X: [CRASH, SNARE] };
export const COUNT_IN_BARS = 1; // 시작 전 "3, 2, 1" 한 마디
export const OUTRO_BARS = 1; // 끝난 뒤 여운 한 마디

// 판정 범위(초). 인스타 인앱 브라우저 지연을 고려해 살짝 넉넉하게.
//   early: 노트보다 이만큼 먼저 누르면(GOOD 범위 밖) 그 노트는 MISS 처리 → 마구 연타 방지
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15, early: 0.26 };
export const POINTS = { perfect: 1000, great: 700, good: 400 };
export const ACC_WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

// 별 3개 기준 (정확도 = 판정 점수 / (노트 수 + 헛침 수))
export const STAR_RULES = [
  { stars: 3, acc: 0.9, clean: true, text: '미스·헛침 없이 정확도 90% 이상' },
  { stars: 2, acc: 0.75, text: '정확도 75% 이상' },
  { stars: 1, acc: 0.5, text: '정확도 50% 이상' },
];

// 몇 단계부터 인스타 팔로우가 필요한지 (1로 바꾸면 처음부터 팔로우)
export const GATE_FROM_LEVEL = 4;

export const DIFFICULTY_WORDS = ['', '입문', '쉬움', '보통', '어려움', '지옥'];

// ---------------------------------------------------------------
// 반주 곡: 전부 작곡가 사후 70년이 지난 클래식(퍼블릭 도메인)을 직접 편곡·합성.
//   melody: 마디별 문자열. "음이름:길이(16분음표 칸 수)" — 길이 생략하면 4(4분음표). "_" = 쉼
//           예) 'E5 E5 F5 G5', 'E5:6 D5:2 D5:8'. 마디마다 길이 합이 16이어야 함.
//   prog:   마디별 코드. 'D A' 처럼 두 개 쓰면 반 마디씩. 마디 수보다 짧으면 반복.
//   melody 도 채보보다 짧으면 반복합니다.
// ---------------------------------------------------------------
export const LEVELS = [
  {
    id: 1,
    name: '환희의 송가',
    composer: '베토벤',
    tagline: '킥 · 스네어 기본기',
    difficulty: 1,
    bpm: 84,
    song: {
      prog: ['C', 'G', 'C', 'G', 'C', 'G', 'C', 'G C', 'G C', 'G C', 'G', 'C G', 'C', 'G', 'C', 'G C'],
      hat: 'x...x...x...x...',
      bass: 'x.......x.......',
      chord: 'x.......x.......',
      melody: [
        'E5 E5 F5 G5', 'G5 F5 E5 D5', 'C5 C5 D5 E5', 'E5:6 D5:2 D5:8',
        'E5 E5 F5 G5', 'G5 F5 E5 D5', 'C5 C5 D5 E5', 'D5:6 C5:2 C5:8',
        'D5 D5 E5 C5', 'D5 E5:2 F5:2 E5 C5', 'D5 E5:2 F5:2 E5 D5', 'C5 D5 G4:8',
        'E5 E5 F5 G5', 'G5 F5 E5 D5', 'C5 C5 D5 E5', 'D5:6 C5:2 C5:8',
      ],
    },
    bars: [
      'K.......S.......',
      'K.......S.......',
      'K...S...K...S...',
      'K...S...K.......',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...K...S...S...',
      'K...S...K.......',
      'K...S...K...S...',
      'K...K...S.......',
      'K...S...K...S...',
      'K...K...S...S...',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...K...S...S...',
      'K...S...K.......',
    ],
  },
  {
    id: 2,
    name: '캐논',
    composer: '파헬벨',
    tagline: '8비트 그루브',
    difficulty: 2,
    bpm: 92,
    song: {
      prog: ['D A', 'Bm F#m', 'G D', 'G A'],
      hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x...x...x...x...',
      chord: 'x.....x.x.....x.',
      melody: [
        'F#5:8 E5:8', 'D5:8 C#5:8', 'B4:8 A4:8', 'B4:8 C#5:8',
        'D5:8 C#5:8', 'B4:8 A4:8', 'G4:8 F#4:8', 'G4:8 E4:8',
        'D5 F#5 A5 G5', 'F#5 D5 F#5 E5', 'D5 B4 D5 A4', 'G4 B4 A4 G4',
      ],
    },
    bars: [
      'K...S...K...S...',
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...K.K.S...',
      'K.K.S...K.K.S...',
      'K...S.S.K...S...',
      'K.K.S...K.K.S...',
      'K...S...K.K.S.S.',
      'K.K.S...K...S...',
      'K...S.K.K...S...',
      'K.K.S.K.K.K.S...',
      'K...S...K.K.S.S.',
      'K.K.S...K.K.S...',
      'K...S.K.K...S...',
      'K.K.S.K.K.K.S.S.',
      'K...S...K.......',
    ],
  },
  {
    id: 3,
    name: '아이네 클라이네',
    composer: '모차르트',
    tagline: '엇박 펑크 · 박자 사이를 노려라',
    difficulty: 3,
    bpm: 98,
    song: {
      prog: ['G', 'G', 'D7', 'D7'],
      hat: 'x.x.x.xox.x.x.xo',
      bass: 'x..x..x.x..x..x.',
      chord: '..x...x...x...x.',
      melody: [
        'G4:4 _:2 D4:2 G4:4 _:2 D4:2', 'G4:2 D4:2 G4:2 B4:2 D5:4 _:4',
        'C5:4 _:2 A4:2 C5:4 _:2 A4:2', 'C5:2 A4:2 F#4:2 A4:2 D4:4 _:4',
        'G5:4 _:2 D5:2 G5:4 _:2 D5:2', 'G5:2 D5:2 G5:2 B5:2 D6:4 _:4',
        'C6:4 _:2 A5:2 C6:4 _:2 A5:2', 'C6:2 A5:2 F#5:2 A5:2 D5:4 _:4',
      ],
    },
    bars: [
      'K...S...K...S...',
      'K..K..S.K...S...',
      'K...S..KK...S...',
      'K..K..S.K...S...',
      'K...S..K..K.S...',
      'K..KS...K..KS...',
      'K...S..KK..KS...',
      'K..K..S...K.S...',
      'K...S...K..K..S.',
      'K..K..S.K..K..S.',
      'K...S..K..K.S..S',
      'K..KS..KK...S...',
      'K..K..S.K..K..S.',
      'K...S..KK..KS...',
      'K..KS..K..K.S..S',
      'K.......S.......',
    ],
  },
  {
    id: 4,
    name: '산왕의 궁전에서',
    composer: '그리그',
    tagline: '더블 킥 · 왼쪽 엄지 연타',
    difficulty: 4,
    bpm: 100,
    song: {
      prog: [
        'Bm', 'C# C', 'Bm', 'D', 'Bm', 'C# C', 'Bm', 'D',
        'F#m', 'G# G', 'F#m', 'A', 'Bm', 'C# C', 'Bm', 'D',
      ],
      hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: 'x.......x.......',
      melody: [
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:4', 'F5:2 C#5:2 F5:4 E5:2 C5:2 E5:4',
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:2 B5:2', 'A5:2 F#5:2 D5:2 F#5:2 A5:8',
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:4', 'F5:2 C#5:2 F5:4 E5:2 C5:2 E5:4',
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:2 B5:2', 'A5:2 F#5:2 D5:2 F#5:2 A5:8',
        'F#4:2 G#4:2 A4:2 B4:2 C#5:2 A4:2 C#5:4', 'C5:2 G#4:2 C5:4 B4:2 G4:2 B4:4',
        'F#4:2 G#4:2 A4:2 B4:2 C#5:2 A4:2 C#5:2 F#5:2', 'E5:2 C#5:2 A4:2 C#5:2 E5:8',
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:4', 'F5:2 C#5:2 F5:4 E5:2 C5:2 E5:4',
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:2 B5:2', 'A5:2 F#5:2 D5:2 F#5:2 A5:8',
      ],
    },
    bars: [
      'K.K.S...K.K.S...',
      'K.K.S...K.K.S...',
      'KKK.S...KKK.S...',
      'KKK.S...K.KKS...',
      'K.KKS...K.KKS...',
      'KKKKS...KKKKS...',
      'K.KKS.K.K.KKS...',
      'KKKKS...KKKKS.S.',
      'KKK.S..KKKK.S...',
      'K.KKS.KKK.KKS...',
      'KKKKS.KKKKKKS...',
      'KKKKS...KKKKS.S.',
      'KKKKKKKKS...S...',
      'K.KKS.KKKKKKS...',
      'KKKKS.KKKKKKS.SS',
      'KKKKKKKKKKKKS...',
    ],
  },
  {
    id: 5,
    name: '캉캉',
    composer: '오펜바흐',
    tagline: '하이햇 등장! · 펀치 비트',
    newInstrument: HAT,
    difficulty: 4,
    bpm: 108,
    song: {
      prog: ['C', 'G7', 'C', 'G7 C'],
      hat: '................',
      bass: 'x...x...x...x...',
      chord: '..x...x...x...x.',
      melody: [
        'C5:4 D5:1 F5:1 E5:1 D5:1 G5:2 G5:2 G5:1 A5:1 E5:1 F5:1',
        'D5:2 D5:2 D5:1 F5:1 E5:1 D5:1 C5:1 C6:1 B5:1 A5:1 G5:1 F5:1 E5:1 D5:1',
        'C5:4 D5:1 F5:1 E5:1 D5:1 G5:2 G5:2 G5:1 A5:1 E5:1 F5:1',
        'D5:2 D5:2 D5:1 F5:1 E5:1 D5:1 C5:2 G4:2 C5:4',
      ],
    },
    bars: [
      'B.......B.......',
      'B...S...B...S...',
      'K.H.S...K.H.S...',
      'K.H.S...K.H.S.H.',
      'K.H.S.H.K.H.S.H.',
      'K.H.S.H.K.K.S...',
      'J...S...J...S...',
      'B.B.S...B.B.S...',
      'K.H.S.H.K.H.S.H.',
      'J.H.S.H.J.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'B...S.H.B...S.H.',
      'J.H.S.H.J.H.S.H.',
      'K.HKS.H.KKH.S.H.',
      'B.H.B.H.B.H.B.H.',
      'B.B.B.B.B.......',
    ],
  },
  {
    id: 6,
    name: '터키 행진곡',
    composer: '모차르트',
    tagline: '크래시 등장! · 드럼 솔로 끝판왕',
    newInstrument: CRASH,
    difficulty: 5,
    bpm: 120,
    song: {
      prog: ['Am', 'Am', 'E Am', 'E'],
      hat: '................',
      bass: 'x...x...x...x...',
      chord: '..x...x...x...x.',
      melody: [
        'C5:2 _:2 D5:1 C5:1 B4:1 C5:1 E5:2 _:2 F5:1 E5:1 D#5:1 E5:1',
        'B5:1 A5:1 G#5:1 A5:1 B5:1 A5:1 G#5:1 A5:1 C6:4 A5:2 C6:2',
        'B5:2 A5:2 G#5:2 A5:2 B5:2 A5:2 G#5:2 A5:2',
        'B5:2 A5:2 G#5:2 F#5:2 E5:4 B4:1 A4:1 G#4:1 A4:1',
      ],
    },
    bars: [
      'C...S...K...S...',
      'K.K.S.H.K.KKS.H.',
      'K..KS.H.K..KS.H.',
      'KKKKS.H.KKKKS...',
      'X...H.K.B.K.S.H.',
      'K.S.K.S.KSKSH...',
      'KSKSKSKSX...X...',
      'K..KS.HSK..KS.HS',
      'C...S.H.KKK.S.HS',
      'J.KKS.K.J.KKS.H.',
      'KSKSKSKSKSKSX...',
      'K.KKS.HKK.KKS.S.',
      'C..KS.K.B..KS.H.',
      'KKKKS.H.KKKKS.H.',
      'K.S.K.S.KSKSKSKS',
      'X.KKS.KKJ.KKS.HS',
      'C..KS..KB..KS.HS',
      'KKKKSSSSKKKKS.H.',
      'X.B.KSKSX.B.KSKS',
      'X.......B.......',
    ],
  },
];

/** 이 단계가 팔로우 잠금 대상인지 */
export function isGated(level, from = GATE_FROM_LEVEL) {
  return !!level && level.id >= from;
}

// ---------- 음이름 / 코드 해석 ----------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' → 73 (C4 = 60) */
export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`음이름 오류: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** 'F#m' → { root, notes } 뿌리음은 G3~F#4 근처 */
export function parseChord(name) {
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(name);
  if (!m) throw new Error(`코드 오류: ${name}`);
  let pc = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  pc = (pc + 12) % 12;
  const root = 60 + (pc > 6 ? pc - 12 : pc);
  const notes = [root, root + (m[3] ? 3 : 4), root + 7];
  if (m[4]) notes.push(root + 10);
  return { root, notes };
}

/** 본편 mb 번째 마디, s 번째 칸의 코드 */
export function chordAt(song, mb, s) {
  const entry = song.prog[((mb % song.prog.length) + song.prog.length) % song.prog.length];
  const parts = entry.trim().split(/\s+/);
  const idx = Math.min(parts.length - 1, Math.floor((s * parts.length) / STEPS_PER_BAR));
  return parseChord(parts[idx]);
}

/** melody 문자열 → [{ bar, step, midi, len }] (bar 는 melody 안에서의 마디 번호) */
export function parseMelody(melody) {
  const out = [];
  melody.forEach((line, bar) => {
    let step = 0;
    for (const tok of line.trim().split(/\s+/)) {
      const [name, l] = tok.split(':');
      const len = l === undefined ? 4 : Number(l);
      if (!(len > 0)) throw new Error(`길이 오류: ${tok}`);
      if (name !== '_') out.push({ bar, step, midi: noteToMidi(name), len });
      step += len;
    }
    if (step !== STEPS_PER_BAR) throw new Error(`melody ${bar + 1}마디 길이 ${step}칸 (16칸이어야 함): ${line}`);
  });
  return out;
}

export function getLevel(id) {
  return LEVELS.find((l) => l.id === Number(id)) || null;
}

export function beatDur(level) {
  return 60 / level.bpm;
}
export function stepDur(level) {
  return beatDur(level) / 4;
}
export function barDur(level) {
  return beatDur(level) * 4;
}

/** 곡 전체 길이(초): 카운트인 + 본편 + 아웃트로 */
export function levelDuration(level) {
  return (COUNT_IN_BARS + level.bars.length + OUTRO_BARS) * barDur(level);
}

/** 이 단계에서 쓰는 악기들 (화면 왼쪽부터 순서) */
export function levelLanes(level) {
  const used = new Set([KICK, SNARE]);
  for (const bar of level.bars) for (const c of bar) for (const l of CHAR_LANES[c] || []) used.add(l);
  return SCREEN_ORDER.filter((l) => used.has(l));
}

/**
 * 채보 → 노트 목록. time 은 곡 시작(카운트인 첫 박) 기준 초.
 * 동시치기(B/J/X)는 레인마다 같은 시각의 노트 + 같은 pair 번호.
 */
export function buildNotes(level) {
  const notes = [];
  const sd = stepDur(level);
  let pair = 0;
  level.bars.forEach((bar, b) => {
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const lanes = CHAR_LANES[bar[s]];
      if (!lanes) continue;
      const step = (COUNT_IN_BARS + b) * STEPS_PER_BAR + s;
      const time = step * sd;
      const p = lanes.length > 1 ? pair++ : -1;
      for (const lane of lanes) notes.push({ time, lane, step, pair: p });
    }
  });
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  notes.forEach((n, i) => (n.id = i));
  return notes;
}

export function noteCount(level) {
  let n = 0;
  for (const bar of level.bars) for (const c of bar) n += (CHAR_LANES[c] || []).length;
  return n;
}

/** 콤보 보너스: 50콤보까지 서서히 올라 최대 1.5배 */
export function comboMultiplier(combo) {
  return 1 + Math.min(combo, 50) / 100;
}

export function pointsFor(judge, comboAfter) {
  if (!POINTS[judge]) return 0;
  return Math.round(POINTS[judge] * comboMultiplier(comboAfter));
}

/** 전부 PERFECT 일 때 점수 */
export function maxScore(level) {
  const n = noteCount(level);
  let s = 0;
  for (let c = 1; c <= n; c++) s += pointsFor('perfect', c);
  return s;
}

function judgedTotal(counts) {
  return (counts.perfect || 0) + (counts.great || 0) + (counts.good || 0) + (counts.miss || 0);
}

/** 정확도. 헛침(노트 없는데 누름)도 분모에 들어가서 마구 누르면 떨어짐 */
export function accuracy(counts) {
  const total = judgedTotal(counts) + (counts.wrong || 0);
  if (!total) return 0;
  const w =
    (counts.perfect || 0) * ACC_WEIGHT.perfect +
    (counts.great || 0) * ACC_WEIGHT.great +
    (counts.good || 0) * ACC_WEIGHT.good;
  return w / total;
}

export function gradeFor(counts) {
  const total = judgedTotal(counts);
  if (total && counts.perfect === total && !counts.wrong) return 'SS';
  const a = accuracy(counts);
  if (a >= 0.95) return 'S';
  if (a >= 0.88) return 'A';
  if (a >= 0.75) return 'B';
  if (a >= 0.6) return 'C';
  return 'D';
}

/** 별 0~3개. 3개 = 미스·헛침 없이 정확도 90% 이상 */
export function starsFor(counts) {
  const a = accuracy(counts);
  const clean = !counts.miss && !counts.wrong && judgedTotal(counts) > 0;
  for (const r of STAR_RULES) if (a >= r.acc - 1e-9 && (!r.clean || clean)) return r.stars;
  return 0;
}

/** 판정 개수로 가능한 점수 범위 (서버의 점수 검증용) */
export function scoreBounds(counts) {
  // 헛침은 점수를 주지도 깎지도 않음 (콤보만 끊김)
  const base =
    (counts.perfect || 0) * POINTS.perfect + (counts.great || 0) * POINTS.great + (counts.good || 0) * POINTS.good;
  return { min: Math.floor(base * 0.999), max: Math.ceil(base * comboMultiplier(Infinity)) };
}
