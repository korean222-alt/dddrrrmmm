// 콩콩 드럼 — 레벨/채보 정의 (브라우저와 서버가 같이 씁니다)
//
// 채보 표기: 한 마디 = 16칸(16분음표)
//   K = 쿵 (킥, 왼쪽 엄지)   S = 짝 (스네어, 오른쪽 엄지)
//   B = 동시 (쿵+짝 한 번에)  . = 쉼
// 새 레벨을 추가하려면 LEVELS 배열에 객체를 하나 더 넣으면 됩니다.

export const STEPS_PER_BAR = 16;
export const COUNT_IN_BARS = 1; // 시작 전 "3, 2, 1" 한 마디
export const OUTRO_BARS = 1; // 끝난 뒤 여운 한 마디

// 판정 범위(초). 인스타 인앱 브라우저 지연을 고려해 살짝 넉넉하게.
export const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15 };
export const POINTS = { perfect: 1000, great: 700, good: 400 };
export const ACC_WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

export const LEVELS = [
  {
    id: 1,
    name: '새싹 박자',
    tagline: '쿵 · 짝 기본기',
    bpm: 84,
    gated: false,
    song: {
      root: 60,
      prog: ['I', 'V', 'vi', 'IV'],
      hat: 'x...x...x...x...',
      bass: 'x.......x.......',
      chord: 'x.......x.......',
      lead: 'x...x...x.x.....',
    },
    bars: [
      'K.......S.......',
      'K.......S.......',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...K...S.......',
      'K...S...K...S...',
      'K...K...S...S...',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...K...S...K...',
      'S...S...K.......',
    ],
  },
  {
    id: 2,
    name: '떡잎 리듬',
    tagline: '8비트 맛보기',
    bpm: 92,
    gated: false,
    song: {
      root: 62,
      prog: ['I', 'vi', 'IV', 'V'],
      hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x...x...x...x...',
      chord: 'x.....x.....x...',
      lead: 'x..x..x...x.x...',
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
      'K.K.S.K.K.K.S.S.',
      'K...S...K.......',
    ],
  },
  {
    id: 3,
    name: '엇박 덩굴',
    tagline: '박자 사이를 노려라',
    bpm: 98,
    gated: false,
    song: {
      root: 57,
      prog: ['vi', 'IV', 'I', 'V'],
      hat: 'x.x.x.xox.x.x.xo',
      bass: 'x..x..x.x..x..x.',
      chord: '..x...x...x...x.',
      lead: 'x..x..x.x..x....',
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
    name: '콩 소나기',
    tagline: '왼쪽 엄지 연타 구간',
    bpm: 100,
    gated: true,
    hot: true,
    song: {
      root: 64,
      prog: ['I', 'V', 'vi', 'IV'],
      hat: 'xxxxxxxxxxxxxxxx',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: 'x..x..x...x..x..',
      lead: 'x.xx..x.x.x.x...',
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
    name: '쌍둥이 콩',
    tagline: '양손 동시에 콩!',
    bpm: 108,
    gated: true,
    song: {
      root: 65,
      prog: ['IV', 'V', 'iii', 'vi'],
      hat: 'x.x.xox.x.x.xox.',
      bass: 'x..x..x.x.x..x..',
      chord: 'x...x...x...x...',
      lead: 'x.x.x..xx...x...',
    },
    bars: [
      'B.......B.......',
      'B...S...B...S...',
      'B...S...K.K.B...',
      'K.S.B...K.S.B...',
      'B...S.K.B...S...',
      'B.K.S.K.B.K.S...',
      'K.S.K.S.B...B...',
      'B.B.S...B.B.S...',
      'B...S..KB...S...',
      'K.K.B...K.K.B...',
      'B.KKS...B.KKS...',
      'K.S.K.S.B.B.B...',
      'B...S.K.B.K.S...',
      'KKS.B...KKS.B...',
      'B.K.S.K.B.K.S.S.',
      'B.B.B.B.B.......',
    ],
  },
  {
    id: 6,
    name: '콩나무 꼭대기',
    tagline: '끝판왕. 여기까지 오면 인정',
    bpm: 120,
    gated: true,
    song: {
      root: 62,
      prog: ['vi', 'IV', 'I', 'V'],
      hat: 'xxxxxxxxxxxxxxxx',
      bass: 'x.xox.xox.xox.xo',
      chord: 'x..x..x...x..x..',
      lead: 'x.x.xx.x..x.x.x.',
    },
    bars: [
      'K...S...K...S...',
      'K.K.S...K.KKS...',
      'K..KS..KK..KS...',
      'KKKKS...KKKKS...',
      'B...S.K.B.K.S...',
      'K.S.K.S.KSKS....',
      'KSKSKSKSB...B...',
      'K..KS.SSK..KS.SS',
      'KKK.S.SSKKK.S.SS',
      'B.KKS.K.B.KKS...',
      'KSKSKSKSKSKSB...',
      'K.KKS..KK.KKS.S.',
      'B..KS.K.B..KS.S.',
      'KKKKSSSSKKKKSSSS',
      'K.S.K.S.KSKSKSKS',
      'B.KKS.KKB.KKS.SS',
      'KKK.S..KB..KS.SS',
      'KSKSKSKSKKKKSSSS',
      'B.B.KSKSB.B.KSKS',
      'B.......B.......',
    ],
  },
];

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

/**
 * 채보 → 노트 목록. time 은 곡 시작(카운트인 첫 박) 기준 초.
 * B(동시)는 두 레인에 같은 시각의 노트 두 개 + 같은 pair 번호.
 */
export function buildNotes(level) {
  const notes = [];
  const sd = stepDur(level);
  let pair = 0;
  level.bars.forEach((bar, b) => {
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const c = bar[s];
      if (c === '.' || c === undefined) continue;
      const step = (COUNT_IN_BARS + b) * STEPS_PER_BAR + s;
      const time = step * sd;
      if (c === 'K' || c === 'B') notes.push({ time, lane: 0, step, pair: c === 'B' ? pair : -1 });
      if (c === 'S' || c === 'B') notes.push({ time, lane: 1, step, pair: c === 'B' ? pair : -1 });
      if (c === 'B') pair++;
    }
  });
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  notes.forEach((n, i) => (n.id = i));
  return notes;
}

export function noteCount(level) {
  let n = 0;
  for (const bar of level.bars) for (const c of bar) n += c === 'B' ? 2 : c === 'K' || c === 'S' ? 1 : 0;
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

export function accuracy(counts) {
  const total = (counts.perfect || 0) + (counts.great || 0) + (counts.good || 0) + (counts.miss || 0);
  if (!total) return 0;
  const w =
    (counts.perfect || 0) * ACC_WEIGHT.perfect +
    (counts.great || 0) * ACC_WEIGHT.great +
    (counts.good || 0) * ACC_WEIGHT.good;
  return w / total;
}

export function gradeFor(counts) {
  const total = (counts.perfect || 0) + (counts.great || 0) + (counts.good || 0) + (counts.miss || 0);
  if (total && counts.perfect === total) return 'SS';
  const a = accuracy(counts);
  if (a >= 0.95) return 'S';
  if (a >= 0.88) return 'A';
  if (a >= 0.75) return 'B';
  if (a >= 0.6) return 'C';
  return 'D';
}

/** 판정 개수로 가능한 점수 범위 (서버의 점수 검증용) */
export function scoreBounds(counts) {
  const base =
    (counts.perfect || 0) * POINTS.perfect + (counts.great || 0) * POINTS.great + (counts.good || 0) * POINTS.good;
  return { min: Math.floor(base * 0.999), max: Math.ceil(base * comboMultiplier(Infinity)) };
}
