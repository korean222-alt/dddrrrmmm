// 오케이스트라 — 레벨/채보 정의 (브라우저와 서버가 같이 씁니다)
//
// 채보 표기: 한 마디 = 16칸(16분음표)
//   K = 킥 (왼쪽 엄지)        S = 스네어 (오른쪽 엄지)
//   H = 하이햇 (오른쪽 엄지, 5단계부터)   C = 크래시 (왼쪽 엄지, 6단계부터)
//   T = 탐탐 (왼쪽 엄지, 16단계부터)
//   B = 킥+스네어 동시   J = 킥+하이햇 동시   X = 크래시+스네어 동시   Y = 탐탐+스네어 동시   . = 쉼
//   같은 엄지끼리(킥·크래시·탐탐 / 스네어·하이햇)는 동시에 못 누르니 그런 조합은 없음
// 새 레벨을 추가하려면 LEVELS 배열에 객체를 하나 더 넣으면 됩니다.

export const STEPS_PER_BAR = 16;

// 악기(레인) 번호. 화면에는 왼쪽부터 크래시 · 킥 · 스네어 · 하이햇 순서로 나옵니다.
export const KICK = 0;
export const SNARE = 1;
export const HAT = 2;
export const CRASH = 3;
export const TOM = 4;
export const INSTRUMENTS = [
  { id: KICK, name: '킥', hand: 'left' },
  { id: SNARE, name: '스네어', hand: 'right' },
  { id: HAT, name: '하이햇', hand: 'right' },
  { id: CRASH, name: '크래시', hand: 'left' },
  { id: TOM, name: '탐탐', hand: 'left' },
];
// 화면 왼쪽부터: 크래시 · 킥 · 탐탐 | 스네어 · 하이햇 (왼쪽 엄지 셋, 오른쪽 엄지 둘)
const SCREEN_ORDER = [CRASH, KICK, TOM, SNARE, HAT];
/** 채보 글자 → 누를 레인들 */
export const CHAR_LANES = { K: [KICK], S: [SNARE], H: [HAT], C: [CRASH], T: [TOM], B: [KICK, SNARE], J: [KICK, HAT], X: [CRASH, SNARE], Y: [TOM, SNARE] };
/** 왼쪽 엄지 악기인지 (같은 엄지 연타 검사·안내에 씀) */
export const isLeftThumb = (lane) => INSTRUMENTS[lane] && INSTRUMENTS[lane].hand === 'left';
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

export const DIFFICULTY_WORDS = ['', '입문', '쉬움', '보통', '어려움', '지옥'];

// ---------------------------------------------------------------
// 반주 곡: 전부 퍼블릭 도메인 — 작곡가 사후 70년이 지난 곡 또는 작곡가 미상의 전통 민요.
//   (최신 가요·팝, 저작권이 남은 동요는 멜로디만 다시 연주해도 안 됨) 직접 편곡·합성.
//   melody: 마디별 문자열. "음이름:길이(16분음표 칸 수)" — 길이 생략하면 4(4분음표). "_" = 쉼
//           예) 'E5 E5 F5 G5', 'E5:6 D5:2 D5:8'. 마디마다 길이 합이 16이어야 함.
//   prog:   마디별 코드. 'D A' 처럼 두 개 쓰면 반 마디씩. 마디 수보다 짧으면 반복.
//   melody 도 채보보다 짧으면 반복합니다.
// ---------------------------------------------------------------
export const LEVELS = [
  {
    id: 1,
    name: '반짝반짝 작은 별',
    composer: '프랑스 민요',
    tagline: '첫 곡 · 쿵 하고 짝!',
    difficulty: 1,
    bpm: 88,
    song: {
      prog: ['C', 'F C', 'F C', 'G C', 'C F', 'C G', 'C F', 'C G', 'C', 'F C', 'F C', 'G C'],
      hat: 'x...x...x...x...',
      bass: 'x.......x.......',
      chord: 'x.......x.......',
      melody: [
        'C5 C5 G5 G5', 'A5 A5 G5:8', 'F5 F5 E5 E5', 'D5 D5 C5:8',
        'G5 G5 F5 F5', 'E5 E5 D5:8', 'G5 G5 F5 F5', 'E5 E5 D5:8',
        'C5 C5 G5 G5', 'A5 A5 G5:8', 'F5 F5 E5 E5', 'D5 D5 C5:8',
      ],
    },
    bars: [
      'K.......S.......',
      'K.......S.......',
      'K...K...S.......',
      'K.......S.......',
      'K...S...K...S...',
      'K...S...K.......',
      'K...S...K...S...',
      'K...S...K.......',
      'K.......S.......',
      'K...K...S.......',
      'K...S...K...S...',
      'K...S...K.......',
      'K...S...K...S...',
      'K...K...S...S...',
      'K...S...K...S...',
      'K...S...K.......',
    ],
  },
  {
    id: 2,
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
    id: 3,
    name: '징글벨',
    composer: '피어폰트',
    tagline: '쿵짝 폴카 · 크리스마스',
    difficulty: 2,
    bpm: 100,
    song: {
      prog: ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G7', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'],
      hat: 'x.x.x.x.x.x.x.x.',
      bells: 'x.x.x.x.x.x.x.x.',
      bass: 'x...5...x...5...',
      chord: '..x...x...x...x.',
      melody: [
        'E5 E5 E5:8', 'E5 E5 E5:8', 'E5 G5 C5:6 D5:2', 'E5:16',
        'F5 F5 F5:6 F5:2', 'F5 E5 E5 E5:2 E5:2', 'E5 D5 D5 E5', 'D5:8 G5:8',
        'E5 E5 E5:8', 'E5 E5 E5:8', 'E5 G5 C5:6 D5:2', 'E5:16',
        'F5 F5 F5:6 F5:2', 'F5 E5 E5 E5:2 E5:2', 'G5 G5 F5 D5', 'C5:16',
      ],
    },
    bars: [
      'K...S...K...S...',
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...S.S.S...',
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...K...S...',
      'K...S...B...B...',
      'K.K.S...K.K.S...',
      'K.K.S...K.K.S...',
      'K.K.S...K.K.S.S.',
      'K...S...S.S.S.S.',
      'K.K.S...K.K.S...',
      'K.K.S.K.K.K.S...',
      'K...S...K...S...',
      'B.......B.......',
    ],
  },
  {
    id: 4,
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
    id: 5,
    name: '성자들의 행진',
    composer: '미국 민요',
    tagline: '행진 비트 · 엇박 킥 맛보기',
    difficulty: 3,
    bpm: 104,
    song: {
      prog: ['C', 'C', 'C', 'G7', 'C', 'C', 'C', 'G7', 'G7', 'C', 'C7', 'F', 'C', 'C G7', 'C', 'C'],
      hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x...5...x...5...',
      chord: '....x.......x...',
      melody: [
        '_ C5 E5 F5', 'G5:16', '_ C5 E5 F5', 'G5:16',
        '_ C5 E5 F5', 'G5:8 E5:8', 'C5:8 E5:8', 'D5:16',
        '_ E5 E5 D5', 'C5:12 C5', 'E5:8 G5:8', 'G5 F5:8 E5:2 F5:2',
        'G5:8 E5:8', 'C5:8 D5:8', 'C5:16', '_ C5 E5 F5',
      ],
    },
    bars: [
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...K...S...',
      'K...S.S.K.K.S...',
      'K...S...K..KS...',
      'K..KS...K..KS...',
      'K...S..KK...S...',
      'K..KS...S.S.S.S.',
      'K...S..KK...S...',
      'K..KS...K.K.S...',
      'K...S..KK..KS...',
      'K..KS.S.K.K.S...',
      'K...S..KK..KS...',
      'K..KS..KK.K.S...',
      'K...S...K..KS.S.',
      'B.......B...B...',
    ],
  },
  {
    id: 6,
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
    id: 7,
    name: '오 수재너',
    composer: '포스터',
    tagline: '컨트리 투스텝 · 엄지 번갈아',
    difficulty: 3,
    bpm: 112,
    song: {
      prog: ['C', 'C G', 'C', 'G C', 'F', 'C G', 'C', 'G C'],
      hat: 'x.x.x.x.x.x.x.x.',
      bass: 'x...5...x...5...',
      chord: '..x...x...x...x.',
      melody: [
        'E5:2 G5:2 G5:3 A5:1 G5:2 E5:2 C5:3 D5:1', 'E5:2 E5:2 D5:2 C5:2 D5:4 C5:2 D5:2',
        'E5:2 G5:2 G5:3 A5:1 G5:2 E5:2 C5:3 D5:1', 'E5:2 E5:2 D5:2 D5:2 C5:8',
        'F5:4 F5:4 A5:2 A5:6', 'G5:2 G5:2 E5:2 C5:2 D5:4 C5:2 D5:2',
        'E5:2 G5:2 G5:3 A5:1 G5:2 E5:2 C5:3 D5:1', 'E5:2 E5:2 D5:2 D5:2 C5:8',
      ],
    },
    bars: [
      'K...S...K...S...',
      'K.S.K.S.K...S...',
      'K...S...K.K.S...',
      'K.S.K.S.K...S.S.',
      'K.S.K.S.K.S.K.S.',
      'K.S.K.S.KK..S...',
      'K.S.K.S.K.S.K.S.',
      'K.S.K.S.B...B...',
      'K.S.K.SKK.S.K.S.',
      'K.S.K.S.KK.SK.S.',
      'K.S.KKS.K.S.KKS.',
      'K.S.K.S.B...B...',
      'B.S.K.S.B.S.K.S.',
      'K.S.KKS.K.SKK.S.',
      'K.S.K.S.K.S.S.S.',
      'B...B...B.......',
    ],
  },
  {
    id: 8,
    name: '운명 교향곡',
    composer: '베토벤',
    tagline: '빠바바밤! · 웅장한 오케스트라',
    difficulty: 3,
    bpm: 108,
    song: {
      // 교향곡 5번 1악장 '운명' 동기(빠바바밤 · 빠바바밤)를 높이를 바꿔가며 쌓아 올림. 우리 한 마디 = 원곡 2/4 두 마디.
      // epic: 처음부터 금관·팀파니·튜바가 총출동 (다른 곡은 뒤로 갈수록 악기가 늘어남)
      epic: true,
      prog: [
        'Cm', 'G', 'Cm', 'G', 'Cm G', 'Fm Cm', 'Eb Fm', 'Ab Eb',
        'Cm G', 'Eb Fm', 'Cm G', 'Cm G', 'Cm G', 'Cm G', 'Cm', 'Cm',
      ],
      hat: '................',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: 'x...x...x...x...',
      melody: [
        '_:2 G5:2 G5:2 G5:2 Eb5:8',
        '_:2 F5:2 F5:2 F5:2 D5:8',
        '_:2 G5:2 G5:2 G5:2 Eb5:4 _:4',
        '_:2 F5:2 F5:2 F5:2 D5:4 _:4',
        'G5:2 G5:2 G5:2 Eb5:2 F5:2 F5:2 F5:2 D5:2',
        'Ab5:2 Ab5:2 Ab5:2 F5:2 G5:2 G5:2 G5:2 Eb5:2',
        'Bb5:2 Bb5:2 Bb5:2 G5:2 Ab5:2 Ab5:2 Ab5:2 F5:2',
        'C6:2 C6:2 C6:2 Ab5:2 Bb5:2 Bb5:2 Bb5:2 G5:2',
        'C6:2 C6:2 C6:2 G5:2 C6:2 C6:2 C6:2 G5:2',
        'Bb5:2 Bb5:2 Bb5:2 G5:2 Ab5:2 Ab5:2 Ab5:2 F5:2',
        'G5:2 G5:2 G5:2 Eb5:2 F5:2 F5:2 F5:2 D5:2',
        'Eb5:2 Eb5:2 Eb5:2 C5:2 D5:2 D5:2 D5:2 B4:2',
        'G5:2 G5:2 G5:2 Eb5:2 F5:2 F5:2 F5:2 D5:2',
        'C6:2 C6:2 C6:2 G5:2 C6:2 C6:2 C6:2 G5:2',
        '_:2 G5:2 G5:2 G5:2 Eb5:8',
        'C6:2 C6:2 C6:2 G5:2 C6:8',
      ],
    },
    bars: [
      // 킥·스네어만, 느긋하게. '빠바바밤' = 킥 세 번 + 스네어 한 방
      '..K.K.K.S.......',
      '..S.S.S.B.......',
      '..K.K.K.S...K...',
      '..S.S.S.B...S...',
      'K.K.K.S.S.S.S.B.',
      'K.K.K.S.K.K.K.S.',
      'K.S.K.S.K.S.K.B.',
      'K.K.K.S.S.K.K.B.',
      'K.K.B.S.K.K.B.S.',
      'K.S.K.S.K.S.K.S.',
      'K.K.K.S.S.S.S.B.',
      'K.S.K.S.K.S.K.B.',
      'K.K.K.S.K.K.K.S.',
      'K.K.B.S.K.K.B.S.',
      '..K.K.K.S.......',
      'K.K.K.B.B.......',
    ],
  },
  {
    id: 9,
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
    id: 10,
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
    id: 11,
    name: '엔터테이너',
    composer: '스콧 조플린',
    tagline: '래그타임 · 하이햇 그루브',
    difficulty: 4,
    bpm: 90,
    song: {
      prog: ['C', 'G7 C', 'C D7', 'D7 G7'],
      hat: '................',
      bass: 'x.......x.......',
      chord: '....x.......x...',
      melody: [
        'E4:1 C5:2 E4:1 C5:2 E4:1 C5:5 C5:1 D5:1 D#5:1 E5:1',
        'C5:1 D5:1 E5:2 B4:1 D5:2 C5:5 _:2 D4:1 D#4:1',
        'E4:1 C5:2 E4:1 C5:2 E4:1 C5:5 A4:1 G4:1 F#4:1 A4:1',
        'C5:1 E5:2 D5:1 C5:1 A4:2 D5:5 _:2 D4:1 D#4:1',
      ],
    },
    bars: [
      'K.H.S.H.K.H.S.H.',
      'K.H.S.H.K.HKS.H.',
      'K.H.S.H.K.H.S.H.',
      'K.H.S.HKK.H.S...',
      'J.H.S.H.K.H.S.H.',
      'K.H.S.H.K.HKS.H.',
      'K.HKS.H.K.H.S.H.',
      'K.H.S.H.K.K.S.S.',
      'K.H.S.H.K.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'J.H.S.H.J.H.S.H.',
      'K.H.S.HKK.H.S.S.',
      'K.HKS.H.K.HKS.H.',
      'J.H.S.HKK.HKS.H.',
      'K.H.S.H.K.K.S.S.',
      'B.......B.......',
    ],
  },
  {
    id: 12,
    name: '코로부시카',
    composer: '러시아 민요',
    tagline: '질주 비트 · 킥 연타 + 하이햇',
    difficulty: 4,
    bpm: 116,
    song: {
      prog: ['Am E', 'Am', 'E', 'Am', 'Dm', 'C', 'E', 'Am'],
      hat: '................',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: '..x...x...x...x.',
      melody: [
        'E5:4 B4:2 C5:2 D5:4 C5:2 B4:2', 'A4:4 A4:2 C5:2 E5:4 D5:2 C5:2',
        'B4:6 C5:2 D5:4 E5:4', 'C5:4 A4:4 A4:8',
        '_:2 D5:4 F5:2 A5:4 G5:2 F5:2', 'E5:6 C5:2 E5:4 D5:2 C5:2',
        'B4:4 B4:2 C5:2 D5:4 E5:4', 'C5:4 A4:4 A4:8',
      ],
    },
    bars: [
      'K.H.S.H.K.H.S.H.',
      'K.H.S.H.K.K.S.H.',
      'K.H.S.H.K.H.S.H.',
      'K.H.S.H.K.K.S...',
      'J.H.S.H.K.HKS.H.',
      'K.H.S.HKK.H.S.H.',
      'J.H.S.H.K.HKS.H.',
      'K.K.S.H.K.K.S...',
      'J.H.S.H.J.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'J.H.S.HKJ.H.S.H.',
      'K.K.S.H.K.K.S.S.',
      'J.H.S.H.K.HKS.H.',
      'K.HKS.HKK.HKS.H.',
      'J.H.S.H.J.H.S.S.',
      'B.B.B.B.B.......',
    ],
  },
  {
    id: 13,
    name: '터키 행진곡',
    composer: '모차르트',
    tagline: '크래시 등장! · 네 악기 총출동',
    newInstrument: CRASH,
    difficulty: 5,
    bpm: 112,
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
      // 같은 엄지로 16분음표 연타는 없음 (사람이 깰 수 있게). 엄지 번갈아 치는 KSK 만 빠르게
      'C...S...K...S...',
      'K.H.S.H.K.H.S.H.',
      'K.H.S.H.K.K.S.H.',
      'K.H.S.H.K.K.S...',
      'X...K...B...K.H.',
      'K.H.S.H.K.H.S.H.',
      'K.K.S...K.K.S...',
      'K.H.S.H.KSK.S...',
      'C...S.H.K.H.S.H.',
      'J...S.H.J...S.H.',
      'K.H.S.H.K.KSK.S.',
      'K.H.S.H.K.K.S...',
      'C...S.H.B...S.H.',
      'K.H.S.H.K.H.S.H.',
      'K.S.K.S.KSK.S...',
      'X...S.H.J...S.H.',
      'K.H.S.H.K.K.S.H.',
      'K.K.S.S.K.K.S...',
      'X.B.K.S.X.B.K.S.',
      'X.......B.......',
    ],
  },
  {
    id: 14,
    name: '왕벌의 비행',
    composer: '림스키코르사코프',
    tagline: '보스 · 미친 속도 16분음표',
    difficulty: 5,
    bpm: 132,
    boss: true,
    song: {
      // 원곡은 2/4 박자 16분음표 질주. 우리 한 마디(16칸)에 원곡 두 마디
      prog: ['E', 'Am', 'Am E', 'Am E', 'Am E', 'Am', 'Dm Am', 'E Am'],
      hat: '................',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: '..x...x...x...x.',
      melody: [
        'E6:1 D#6:1 D6:1 C#6:1 D6:1 C#6:1 C6:1 B5:1 C6:1 B5:1 A#5:1 A5:1 G#5:1 G5:1 F#5:1 F5:1',
        'E5:1 D#5:1 D5:1 C#5:1 C5:1 F5:1 E5:1 D#5:1 E5:1 D#5:1 D5:1 C#5:1 C5:1 F5:1 E5:1 D#5:1',
        'E5:1 D#5:1 D5:1 C#5:1 D5:1 C#5:1 C5:1 B4:1 C5:1 C#5:1 D5:1 D#5:1 E5:1 F5:1 E5:1 D#5:1',
        'E5:1 D#5:1 D5:1 C#5:1 C5:1 F5:1 E5:1 D#5:1 E5:1 D#5:1 D5:1 C#5:1 D5:1 C#5:1 C5:1 B4:1',
        'A5:1 G#5:1 G5:1 F#5:1 F5:1 A#5:1 A5:1 G#5:1 A5:1 G#5:1 G5:1 F#5:1 F5:1 A#5:1 A5:1 G#5:1',
        'A5:1 G#5:1 G5:1 F#5:1 G5:1 F#5:1 F5:1 E5:1 F5:1 F#5:1 G5:1 G#5:1 A5:1 A#5:1 A5:1 G#5:1',
        'A5:1 G#5:1 G5:1 F#5:1 F5:1 A#5:1 A5:1 G#5:1 A5:1 G#5:1 G5:1 F#5:1 G5:1 F#5:1 F5:1 E5:1',
        'F5:1 F#5:1 G5:1 G#5:1 A5:1 A#5:1 B5:1 C6:1 B5:2 G#5:2 A5:4',
      ],
    },
    bars: [
      // 같은 엄지는 8분음표(2칸) 간격 이상. 엄지 번갈아 치는 16분음표(KSKS)로 '날갯짓'
      'C...S...K...S...',
      'K.S.K.S.K.S.K.S.',
      'K.H.S.H.K.H.S.H.',
      'K.S.K.S.KSK.S...',
      'X...K.H.S.H.K.H.',
      'K.HKS.H.K.HKS.H.',
      'K.S.K.S.K.S.KSK.',
      'B...B...B.B.B...',
      'C.H.S.H.K.H.S.H.',
      'J.H.S.H.J.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'K.S.KSK.S.K.KSK.',
      'X.H.S.H.X.H.S.H.',
      'K.HKS.HKS.H.S.H.',
      'K.S.K.S.KSKSKSK.',
      'X...B...B.B.X...',
    ],
  },
  {
    id: 15,
    name: '윌리엄 텔 서곡',
    composer: '로시니',
    tagline: '진짜 최종 보스 · 질주하는 말발굽',
    difficulty: 5,
    bpm: 144,
    boss: true,
    song: {
      // 피날레 '스위스 군대의 행진' 갤럽. 따다닥 따다닥 말발굽 리듬 (우리 한 마디에 원곡 2/4 두 마디)
      prog: ['E A', 'A E', 'E A', 'B E'],
      hat: '................',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: '..x...x...x...x.',
      melody: [
        'E5:1 E5:1 E5:2 E5:1 E5:1 E5:2 E5:1 E5:1 A5:2 B5:2 C#6:2',
        'E5:1 E5:1 E5:2 E5:1 E5:1 A5:2 C#6:1 C#6:1 B5:2 G#5:2 E5:2',
        'E5:1 E5:1 E5:2 E5:1 E5:1 E5:2 E5:1 E5:1 A5:2 B5:2 C#6:2',
        'E5:1 E5:1 E5:2 E5:1 E5:1 A5:2 C#6:2 B5:2 A5:4',
      ],
    },
    bars: [
      // 13단계보다 빠르고 촘촘하게. 그래도 같은 엄지 16분음표 연타는 없음 (엄지를 번갈아 치는 KSK 말발굽)
      'X...K.S.K.S.KSK.',
      'KSK.KSK.KSK.S.S.',
      'KHK.S.K.KHK.S.H.',
      'KSK.KSK.B.B.X...',
      'C.H.KHK.S.H.KHK.',
      'S.H.KHK.S.HKS.H.',
      'KSK.KSK.KSKSKSK.',
      'X...B...B.B.X...',
      'J.H.KSK.J.H.KSK.',
      'X.H.KSK.S.H.KSK.',
      'KHKSKHKSKHKSK...',
      'X.S.KSK.X.S.KSK.',
      'J.H.S.H.J.H.S.H.',
      'KSKSKSKSKSKSKSK.',
      'X.B.K.S.X.B.K.S.',
      'X...B...X.......',
    ],
  },
  {
    id: 16,
    name: '교향곡 40번',
    composer: '모차르트',
    tagline: '탐탐 등장! · 다섯 악기 · 15단계보다 살짝 느리게',
    newInstrument: TOM,
    difficulty: 5,
    bpm: 120,
    song: {
      // 1악장 몰토 알레그로 첫 주제 '따다단 따다단 따다단 딴!' (사단조). 우리 한 마디에 원곡 2/2 두 마디
      prog: ['Gm', 'Gm', 'Gm Cm', 'D', 'D Gm', 'Gm', 'Gm Cm', 'D', 'D Gm', 'Gm D', 'Gm', 'Gm', 'Gm Cm', 'D', 'D Gm', 'Gm'],
      hat: '................',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: '..x...x...x...x.',
      melody: [
        '_:14 Eb5:1 D5:1',
        'D5:2 Eb5:1 D5:1 D5:2 Eb5:1 D5:1 D5:2 Bb5:4 Bb5:1 A5:1',
        'G5:2 G5:1 F5:1 Eb5:2 Eb5:1 D5:1 C5:2 C5:2 _:2 D5:1 C5:1',
        'C5:2 D5:1 C5:1 C5:2 D5:1 C5:1 C5:2 A5:4 A5:1 G5:1',
        'F#5:2 F#5:1 Eb5:1 D5:2 D5:1 C5:1 Bb4:2 Bb4:2 _:2 Eb5:1 D5:1',
        'D5:2 Eb5:1 D5:1 D5:2 Eb5:1 D5:1 D5:2 Bb5:4 Bb5:1 A5:1',
        'G5:2 G5:1 F5:1 Eb5:2 Eb5:1 D5:1 C5:2 C5:2 _:2 D5:1 C5:1',
        'C5:2 D5:1 C5:1 C5:2 D5:1 C5:1 C5:2 A5:4 A5:1 G5:1',
        'F#5:2 F#5:1 Eb5:1 D5:2 D5:1 C5:1 Bb4:2 A4:2 G4:4',
        'D6:4 C6:2 Bb5:2 A5:4 G5:2 F#5:2',
        'G5:4 Bb5:4 D6:4 _:2 Eb5:1 D5:1',
        'D5:2 Eb5:1 D5:1 D5:2 Eb5:1 D5:1 D5:2 Bb5:4 Bb5:1 A5:1',
        'G5:2 G5:1 F5:1 Eb5:2 Eb5:1 D5:1 C5:2 C5:2 _:2 D5:1 C5:1',
        'C5:2 D5:1 C5:1 C5:2 D5:1 C5:1 C5:2 A5:4 A5:1 G5:1',
        'F#5:2 F#5:1 Eb5:1 D5:2 D5:1 C5:1 Bb4:2 A4:2 G4:4',
        'G5:4 D5:4 G4:8',
      ],
    },
    // 💥 연타 구간: 그 칸 동안 그 줄을 마구 두드리기 (점수 없음, 8번마다 하트 +1, 한 구간 최대 2개)
    rolls: [
      { bar: 9, from: 4, len: 10, lane: TOM },
      { bar: 14, from: 4, len: 10, lane: SNARE },
    ],
    bars: [
      // 탐탐(T)은 왼쪽 엄지. 같은 엄지 16분음표 연타 없음 — 탐탐·스네어를 엄지 번갈아 '두구두구'
      'C...K...S...K.TS',
      'K.SKS.SKS.X...TS',
      'T.TS..K.B...KSKS',
      'K.SKH.SKS.X...TS',
      'T.TSK.K.B.B...TS',
      'K.SKH.SKS.X.H.TS',
      'T.TS.HK.B.H.KSKS',
      'K.SKH.SKS.X.H.TS',
      'T.TSK.K.B.B.C...',
      'C...............', // 💥 탐탐 연타 (rolls)
      'K.H.Y.H.K.K.Y.H.',
      'K.SKH.SKS.X.H.TS',
      'T.TS.HK.B.H.KSKS',
      'K.SKH.SKS.X.H.TS',
      'C...............', // 💥 스네어 연타 (rolls)
      'X...B...X.......',
    ],
  },
  {
    id: 17,
    name: '라 쿠카라차',
    composer: '멕시코 민요',
    tagline: '클래식 말고 축제! · 다섯 악기 · 킥 연타',
    difficulty: 5,
    bpm: 132,
    song: {
      // 작곡가 미상 멕시코 전통 민요 (퍼블릭 도메인). '라 쿠카라차, 라 쿠카라차' — 따따따 딴~ 따!
      prog: ['F', 'F', 'C7', 'C7', 'C7', 'C7', 'C7 F', 'F'],
      hat: '................',
      bass: 'x...x.x.x...x.x.',
      chord: '..x...x...x...x.',
      melody: [
        'C5:2 C5:2 C5:2 F5:6 A5:4',
        'C5:2 C5:2 C5:2 F5:6 A5:4',
        'F5:2 F5:2 E5:2 E5:2 D5:2 D5:2 C5:4',
        'C5:8 _:4 E5:2 G5:2',
        'C5:2 C5:2 C5:2 E5:6 G5:4',
        'C5:2 C5:2 C5:2 E5:6 G5:4',
        'C6:2 D6:2 C6:2 Bb5:2 A5:2 G5:2 F5:4',
        'F5:4 A5:2 C6:2 F5:4 _:4',
        'C5:2 C5:2 C5:2 F5:6 A5:4',
        'C5:2 C5:2 C5:2 F5:6 A5:4',
        'F5:2 F5:2 E5:2 E5:2 D5:2 D5:2 C5:4',
        'C5:8 _:4 E5:2 G5:2',
        'C5:2 C5:2 C5:2 E5:6 G5:4',
        'C5:2 C5:2 C5:2 E5:6 G5:4',
        'C6:2 D6:2 C6:2 Bb5:2 A5:2 G5:2 F5:4',
        'F5:4 C5:4 F4:8',
      ],
    },
    // 💥 연타 구간: 이번엔 킥
    rolls: [{ bar: 11, from: 4, len: 10, lane: KICK }],
    bars: [
      // 멜로디 '따따따 딴~ 따!' 를 그대로 두드림. 같은 엄지 16분음표 연타 없음 (엄지 번갈아 KSK·TS)
      'X...K.S.KSK.S.H.',
      'K.SKS.SKH.SKS.X.',
      'T.TSK.KSK.TSK.H.',
      'C...S.H.KSKSKSK.',
      'J.H.S.HKS.HKS.H.',
      'X.H.KSK.X.H.KSK.',
      'K.S.KSK.TSK.T.B.',
      'X...B...C.T.K.S.',
      'X.HKS.HKS.HKS.H.',
      'KSK.KSK.KSK.X...',
      'T.TSTSK.B.TSK.H.',
      'C...............', // 💥 킥 연타 (rolls)
      'J.H.S.HKS.HKS.HK',
      'S.H.KSK.X.H.KSK.',
      'KSKSKSK.TSTSKSK.',
      'X...B...X.......',
    ],
  },
  {
    id: 18,
    name: '엘리제를 위하여',
    composer: '베토벤',
    tagline: '진짜 최종 보스 · 미레미레미시레도 질주 · 하이햇 트릴 연타',
    difficulty: 5,
    bpm: 144,
    song: {
      // 원곡은 3/8박자 → 원곡 한 마디를 우리 반 마디(8칸)로 옮김. A(미레#미레#…) · B(도·솔·파·미) · A 로 끝
      //   (18번은 하루 들어갔다 뺀 찬송가 번호였음 — 그때 점수는 pgstore 'reset-level-18-v1' 로 지움)
      prog: ['Am', 'E Am', 'Am', 'E Am', 'Am', 'E Am', 'Am', 'E Am', 'C G', 'Am E', 'E', 'Am', 'E Am', 'Am', 'E Am', 'Am'],
      hat: '................',
      bass: 'x.....x.x.....x.',
      chord: '..x.x.....x.x...',
      melody: [
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 G#4:1 B4:3 C5:3 E4:1 E5:2 D#5:2',
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 C5:1 B4:3 A4:8',
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 G#4:1 B4:3 C5:3 E4:1 E5:2 D#5:2',
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 C5:1 B4:3 A4:2 B4:2 C5:2 D5:2',
        'E5:5 G4:1 F5:1 E5:1 D5:5 F4:1 E5:1 D5:1',
        'C5:5 E4:1 D5:1 C5:1 B4:3 E4:1 E5:2 E5:1 E6:1',
        'D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1 D#5:1 E5:1',
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 G#4:1 B4:3 C5:3 E4:1 E5:2 D#5:2',
        'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:3 C4:1 E4:1 A4:3',
        'B4:3 E4:1 C5:1 B4:3 A4:8',
        'A4:4 C5:2 E5:2 A5:8',
      ],
    },
    // 💥 연타 구간: 미레#미레# 트릴 동안 하이햇
    rolls: [{ bar: 10, from: 4, len: 10, lane: HAT }],
    bars: [
      // 진짜 최종 보스: 엄지 번갈아 거의 16분음표 내내 + 겹치기·탐탐. 같은 엄지 16분음표 연타 없음 (마디 넘어갈 때도)
      'X.KSKSK.B.TSKSKS',
      'C.S.J.KSK.Y.KSKS',
      'T.KSKSK.B.TSKSTS',
      'C.J.J.B.X.TST.B.',
      'X.KSKSK.B.TSKSKS',
      'C.S.J.KSK.Y.KSKS',
      'T.KSKSK.B.TSKSTS',
      'C.J.J.B.B.B.B.B.',
      'X.H.HKSKS.H.HKSK',
      'S.H.HKSKS.TSKSK.',
      'X...............', // 💥 하이햇 연타 (rolls)
      'X.KSKSK.B.TSKSKS',
      'C.S.J.KSK.Y.KSKS',
      'T.KSKSK.B.TSKSTS',
      'C.J.J.B.X.TSKSK.',
      'X.B.Y.B.X.......',
    ],
  },
  // ---------------------------------------------------------------
  // 🎄 크리스마스 이벤트 곡 (번호 단계가 아님. 화면엔 '크리스마스 이벤트'로, 크리스마스 마을 맵).
  //   id 19·21·22 는 내부 번호 (랭킹·점수 저장용. 20 은 빼 버린 찬송가 자리라 비워 둠 — 다시 쓰지 말 것. 18 은 2026-11-21 엘리제를 위하여 본편 단계로)
  //   xmas: 앞 단계를 안 깼어도 바로 칠 수 있음 (잠금은 4단계부터와 같음: 팔로워 인증). 본편 순서·총 등수·무제한엔 안 들어감
  //   song.bells = 썰매 방울 박자, song.glock = 멜로디 위에 글로켄슈필, song.choir = 합창 목소리(합성)
  //   song.audio = { src, offset } 녹음된 노래 파일을 틂 (offset = 채보 첫 마디가 시작하는 파일 시각, 초)
  //   난이도(difficulty)는 표시용: 이벤트 곡을 깨도 같은 난이도 본편 단계가 열리진 않음
  // ---------------------------------------------------------------
  {
    // 🎤 일레븐랩스로 만든 합창 녹음 (가사·멜로디는 퍼블릭 도메인 전통 캐럴). 120 BPM, 파일 1.02초가 첫 마디 첫 박
    //   (노래 한 줄 = 2마디: 'Deck the halls with boughs of holly' 1마디 + 'Fa la la la la …' 1마디). 킥·스네어만 (보통)
    id: 19,
    xmas: true,
    name: '데크 더 홀즈',
    composer: '웨일스 민요',
    tagline: '크리스마스 이벤트 · 합창 노래와 함께 · 팔라라라라 신나게',
    difficulty: 3,
    bpm: 120,
    song: {
      audio: { src: '/audio/xmas/deck-v1.mp3', offset: 1.02 },
      prog: ['C'],
      hat: '................',
      bass: '................',
      chord: '................',
      melody: ['C5:16'],
    },
    bars: [
      'K...S...K...S...',
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...K.K.S.S.',
      // Deck the halls … / Fa la la la la …
      'K..SK.S.K.S.K.S.',
      'KSKSK..SK.S.B...',
      'K..SK.S.K.S.K.S.',
      'KSKSK..SK.S.B...',
      'K..SK.S.K.S.K.S.',
      'K..SK.S.K..SK.S.',
      'K..SK.S.K.S.K.S.',
      'KSKSK..SK.S.B...',
      // See the blazing Yule … (조금 더 빽빽하게)
      'K.KSK.S.K.KSK.S.',
      'KSKSK.KSK.S.B.S.',
      'K.KSK.S.K.KSK.S.',
      'KSKSK.KSK.S.B.S.',
      'K.KSK.S.K.KSK.S.',
      'KSKSK.S.K.KSK.S.',
      'K.KSK.S.K.KSK.S.',
      'KSKSK.KSK.S.B.S.',
      // 간주
      'K.K.S.K.K.K.S.S.',
      'K.KSK.S.K.KSKSKS',
      'K.K.S.K.K.K.S.S.',
      'KSKSKSKSKSK.B...',
      // 마지막 Deck the halls … (가장 빽빽하게)
      'KSKSK.S.KSKSK.S.',
      'KSKSK.KSK.S.B.S.',
      'KSKSK.S.KSKSK.S.',
      'KSKSK.KSK.S.B.S.',
      'KSKSK.S.KSKSK.S.',
      'KSKSK.S.K.KSK.S.',
      'KSKSK.S.KSKSK.S.',
      'KSKSK..SK.S.B...',
    ],
  },
  {
    // 🎤 일레븐랩스로 만든 합창 녹음 (가사·멜로디는 퍼블릭 도메인 전통 캐럴). 132 BPM, 파일 0.025초가 첫 마디 첫 박
    //   채보는 노래 박자(스네어 2·4박)와 가사 음절에 맞춤. 받지 못하면 시작 안 함 (main)
    id: 21,
    xmas: true,
    name: '위 위시 유 어 메리 크리스마스',
    composer: '영국 민요',
    tagline: '크리스마스 이벤트 · 합창 노래와 함께 · 하이햇·크래시 총출동',
    difficulty: 4,
    bpm: 132,
    song: {
      audio: { src: '/audio/xmas/wewish-v1.mp3', offset: 0.025 },
      // 아래는 형식용 (녹음 곡은 반주를 만들지 않음)
      prog: ['C'],
      hat: '................',
      bass: '................',
      chord: '................',
      melody: ['C5:16'],
    },
    bars: [
      'C.......K.......',
      'K...S...K...S...',
      'K...S...K...S...',
      'K...S...K.S.S.S.',
      // We wish you a / merry Christmas ×3
      'X.H.S.H.K.H.S.S.',
      'B.H.S.H.K.HKS.H.',
      'X.H.S.H.K.H.S.S.',
      'B.H.S.H.K.HKS.H.',
      'X.HKS.H.K.H.S.S.',
      'B.H.S.HKS.HKS.H.',
      'X..KS.H.K.HKS.H.',
      'B...X...KSKSKSKS',
      // 간주
      'C.H.S.H.K.HKS.H.',
      'K.HKS.H.K.HKS.H.',
      'C.H.S.H.K.HKS.H.',
      'K.HKS.HKS.HKS.S.',
      // Good tidings we bring …
      'X...S.H.K.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'X.H.S.H.K.HKS.H.',
      'K.HKS.H.KSKSKSK.',
      'X...S.H.K.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'X..KS.H.K.HKS.H.',
      'B...X...KSKSKSKS',
      'C.H.S.H.K.HKS.H.',
      // 마지막 We wish … (가장 빽빽하게)
      'X.HKS.H.KSK.S.S.',
      'B.HKS.HKS.HKS.H.',
      'X.HKS.H.KSK.S.S.',
      'B.HKS.HKS.HKS.H.',
      'X.HKS.H.KSK.S.S.',
      'B.HKS.HKS.HKSKS.',
      'X..KS.HKS.HKS.H.',
      'B...X...KSKSKSK.',
      'X.......B...S...',
      'X...B...X.......',
    ],
  },
  {
    // 🎤 일레븐랩스로 만든 합창 녹음 (1일째 → 2일째 → 5일째 → 12일째로 줄인 편곡). 126 BPM, 파일 0.035초가 첫 마디 첫 박
    //   채보는 가사 음절('On the first day …', 'FIVE GOL-DEN RINGS')에 맞춤
    id: 22,
    xmas: true,
    name: '크리스마스의 12일',
    composer: '영국 민요',
    tagline: '크리스마스 이벤트 · 합창 노래와 함께 · 탐탐까지 전부',
    difficulty: 5,
    bpm: 126,
    song: {
      audio: { src: '/audio/xmas/12days-v1.mp3', offset: 0.035 },
      prog: ['C'],
      hat: '................',
      bass: '................',
      chord: '................',
      melody: ['C5:16'],
    },
    bars: [
      'X.......K...S...',
      'K...S...K...S...',
      'K...S...K.K.S...',
      'K...S...K.H.T.T.',
      // 첫째 날: first day of Christmas my true love sent to me / a partridge in a pear tree
      'X...K.S.K.H.K.SK',
      'S.K.S.K.B...K.S.',
      'X..KS.HKS.K.Y..T',
      // 간주
      'S.HKS.HKS.HKS.HK',
      'S.HKS.H.T.TST.T.',
      'X.H.KSK.X.H.KSK.',
      'X.HKS.HKS.HKS.HK',
      'S.H.K.H.S.H.T.T.',
      // 둘째 날: two turtle doves
      'X...K.SKS.H.K.SK',
      'S.K.S.K.B...K.S.',
      'X...Y...X...K..T',
      'S..KS.HKS.K.Y.T.',
      'X...S.H.KSKSKSK.',
      'J.H.S.H.K.H.T.T.',
      // 다섯째 날: FIVE GOL-DEN RINGS
      'X...K.S.K.H.K.S.',
      'K.S.K.S.B...T.T.',
      'X.T.T.T.X.T.T.T.',
      'X...S.HKS.H.K.S.',
      'K.S.K.S.K.S.KSK.',
      'Y.T.Y.T.Y...K.S.',
      'X..KS.HKS.K.Y.T.',
      // 열두째 날
      'X...S.H.KSKSK..T',
      'S...K.S.K.H.K.S.',
      'K.S.K.S.B...T.T.',
      'X.T.T.T.X.T.T.T.',
      'X...S.HKS.H.K.S.',
      'K.S.K.S.K.S.KSK.',
      'Y.T.Y.T.Y...K..T',
      'S..KS.HKS.K.Y..T',
      // 마무리
      'S...X...B...X...',
      'X.H.S.H.X.H.S.H.',
      'X.......B.......',
    ],
  },
  {
    // 🎭 장거리 (2026-11-21): 곡 하나를 처음부터 끝까지. 왼쪽 엄지 = 쿵(킥), 오른쪽 엄지 = 멜로디 (누르면 그 음이 피아노로 남)
    //   tapMelody: 반주가 멜로디를 대신 쳐 주지 않음 → 놓친 음은 안 들림
    //   멜로디: 1926년 리코르디 보컬 스코어(IMSLP #869125, 퍼블릭 도메인)의 테너 줄을 그대로 옮김 (악보 표기 = 테너가 부르는 소리보다 한 옥타브 위)
    //   2/4 마디(me, sa-prà)는 16칸 마디에 맞추느라 뒤에 반 마디 쉼을 붙임 · 셋잇단음은 2+1+1칸으로
    id: 23,
    long: true,
    tapMelody: true,
    theme: 'hall',
    name: '네순 도르마',
    composer: '푸치니',
    sub: '공주는 잠 못 이루고 · 오페라 투란도트',
    tagline: '곡 전체 · 왼손 쿵 + 오른손 피아노 멜로디',
    difficulty: 3,
    bpm: 66,
    lanes: [KICK, SNARE],
    song: {
      prog: [
        'G Gm', 'G Gm', 'G', 'G Gm', 'G Gm', 'G Em', 'Em A', 'G Gm', 'G',
        'D A', 'G', 'D', 'A D', 'D', 'Bm', 'A7', 'D', 'G', 'G Bm', 'G Gm', 'G',
        'D A', 'G', 'A7', 'A D', 'D', 'D', 'Bm', 'A7', 'D A', 'G', 'D',
      ],
      hat: '................',
      // 🎹 반주 피아노는 왼손(베이스 + 펼친 화음)으로만 (pianoLH) — 기본 베이스·화음 찍기는 끔
      bass: '................',
      chord: '................',
      pianoLH: true,
      melody: [
        '_:12 D5:3 D5:1', // Nes-sun
        'D5 D5 _ D4:3 D4:1', // dor-ma! nes-sun
        'D4 D4 _:8', // dor-ma!
        '_:6 D5:2 D5:2 D5:2 D5:3 C5:1', // Tu pu-re, o Prin-ci-
        'B4 B4 B4:2 B4:1 B4:1 Bb4:3 F#4:1', // pes-sa, nel-la tua fred-da
        'G4 G4 F#5 G5:3 E5:1', // stan-za guar-di le
        'E5 E5:2 E5:2 E5:2 E5:2 E5:3 D5:1', // stel-le che tre-ma-no d'a-
        'B4 B4:6 B4:2 Bb4:3 F#4:1', // mo-re e di spe-
        'G4 G4:6 _:6', // ran-za!
        '_:2 D5:2 E5:2 F#5:2 E5:2 D5:2 E5:3 C#5:1', // Ma il mio mi-ste-ro è chiu-so in
        'B4:8 _:8', // me, (2/4)
        '_:2 E5:2 F#5:2 G5:2 F#5:2 E5:2 F#5:3 D5:1', // il no-me mio nes-sun sa-
        'C#5 D5 E5:2 E5:2 F#5:2 G5:2', // prà! No, no, sul-la tua
        'A5:8 A5 A5:3 F#5:1', // boc-ca lo di-
        'F#5:10 F#5:2 F#5:3 D5:1', // rò, quan-do la
        'A4:8 G4 E5:3 C#5:1', // lu-ce splen-de-
        'D5:6 _:10', // rà!
        '_:10 D5:2 D5:3 C5:1', // Ed il mio
        'B4:2 B4:2 B4:2 D5:2 F#5:6 E5:2', // ba-cio scio-glie-rà il
        'D5 D5 D5:2 B4:2 Bb4:3 F#4:1', // si-len-zio che ti fa
        'G4 G4 _:8', // mi-a!
        '_:2 D5:2 E5:2 F#5:2 E5:2 D5:2 E5:3 C#5:1', // (여자 합창) Il no-me suo nes-sun sa-
        'B4:8 _:8', // prà… (2/4)
        '_:2 E5:2 F#5:2 G5:2 F#5:2 E5:2 F#5:3 D5:1', // E noi do-vrem, a-hi-mè, mo-
        'C#5 D5 E5 _', // rir, mo-rir!
        '_:10 E5:2 F#5:2 G5:2', // (테너) Di-le-gua, o
        'A5 A5 A5:2 A5:2 A5:3 F#5:1', // not-te! tra-mon-ta-te,
        'F#5 F#5 F#5:2 F#5:2 F#5:3 D5:1', // stel-le! tra-mon-ta-te,
        'A4 A4:2 A4:2 A4:2 A4:2 E5:3 C#5:1', // stel-le! Al-l'al-ba vin-ce-
        'D5:12 C#5:3 E5:1', // rò! Vin-ce-
        'A5:12 D5:3 B5:1', // rò! Vin-ce-
        'A5:16', // rò!
      ],
    },
    // 왼쪽 쿵 (마디별): 0 = 마디에 두 번(1·3박) / 1 = 박마다. 'Ma il mio mistero'부터 박마다
    kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bars: null, // 아래 LEVELS 다음에 멜로디로 만듦 (tapBars)
  },
];

/** 🎭 tapMelody 곡의 채보: 멜로디 음마다 S(오른쪽 = 멜로디), kick 에 따라 K(왼쪽 쿵), 겹치면 B */
export function tapBars(melody, kick = []) {
  return melody.map((line, b) => {
    const cells = Array(STEPS_PER_BAR).fill('.');
    let step = 0;
    for (const tok of line.trim().split(/\s+/)) {
      const [name, l] = tok.split(':');
      if (name !== '_') cells[step] = 'S';
      step += l === undefined ? 4 : Number(l);
    }
    const ks = (kick[b] ?? 0) >= 1 ? [0, 4, 8, 12] : [0, 8];
    for (const k of ks) cells[k] = cells[k] === 'S' ? 'B' : 'K';
    return cells.join('');
  });
}
for (const l of LEVELS) if (l.tapMelody && !l.bars) l.bars = tapBars(l.song.melody, l.kick);

// ---------------------------------------------------------------
// 🎬 영상 찍기 전용 (릴스용): 단계 목록·랭킹·진행엔 안 나옴. '영상 찍기' 화면에서만.
//   4악기가 다 나와서 화려해 보이지만, 패턴은 10단계(캉캉)와 같은 정도 + 조금 느리게(108 → 96 BPM)
//   → 보는 사람은 '어려워 보이는데 잘 친다', 치는 사람은 할 만함
// ---------------------------------------------------------------
export const STUDIO_LEVELS = [
  {
    id: 'r4',
    studioOnly: true,
    name: '캉캉 4드럼',
    composer: '오펜바흐',
    tagline: '릴스용 · 네 악기 총출동 (느리게)',
    theme: 'city',
    difficulty: 4,
    bpm: 96,
    song: LEVELS[9].song,
    bars: [
      'X.......B.......',
      'B...S...B...S...',
      'K.H.S...K.H.S...',
      'K.H.S...K.H.S.H.',
      'C.H.S.H.K.H.S.H.',
      'K.H.S.H.K.K.S...',
      'X...S...J...S...',
      'B.B.S...B.B.S...',
      'C.H.S.H.K.H.S.H.',
      'J.H.S.H.J.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'X...S.H.B...S.H.',
      'C.H.S.H.J.H.S.H.',
      'K.HKS.H.K.HKS.H.',
      'X.H.B.H.X.H.B.H.',
      'X.B.X.B.X.......',
    ],
  },
];
export const getStudioLevel = (id) => STUDIO_LEVELS.find((l) => l.id === id) || null;

/** 누구나 칠 수 있는 단계: 1~FREE_UPTO. 그 뒤 단계와 💎 무제한 모드(그리그·단계별)는 전부 팔로워 인증(암호) 필요 */
export const FREE_UPTO = 3;
/** (예전 '인증 신청만 해도 열림' 단계 — 이제 없음) */
export const VERIFY_LEVELS = [];
export function needsVerify(id) {
  return false;
}
/** 팔로워 인증(인증 완료)이 있어야 열리는 단계 */
export const CLOSED_LEVELS = LEVELS.filter((l) => l.id > FREE_UPTO).map((l) => l.id);
/** 진행 순서에서 건너뛰는 단계 (없음: 1→2→…→15 차례로) */
export const SKIP_LEVELS = [];
/** 판 id 가 팔로워 인증이 필요한지: 4단계부터 + 무제한 모드('endless', 'e5' 등) 전부 */
export function isClosed(id) {
  if (id === 'endless' || (typeof id === 'string' && /^e\d+$/.test(id))) return true;
  return Number(id) > FREE_UPTO;
}
/** 이 단계 앞에서 깨야 하는 단계 번호 (잠긴 단계는 건너뜀). 1단계는 null */
export function prevOpenId(id) {
  let n = Number(id) - 1;
  while (n >= 1 && SKIP_LEVELS.includes(n)) n--;
  return n >= 1 ? n : null;
}
/** 다음에 칠 수 있는 단계 번호 (잠긴 단계는 건너뜀). 없으면 null */
export function nextOpenId(id) {
  let n = Number(id) + 1;
  while (SKIP_LEVELS.includes(n)) n++;
  return getLevel(n) ? n : null;
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

/** 🎹 두 손 피아노 — 오른손: 멜로디 음 아래 3~12반음 안에서 같이 누를 화음 음 (긴 음은 하나 더) */
export function pianoHarmony(song, mb, s, midi, long = false) {
  const pcs = chordAt(song, mb, s).notes.map((m) => ((m % 12) + 12) % 12);
  const out = [];
  for (let m = midi - 3; m >= midi - 12 && m >= 50 && out.length < (long ? 2 : 1); m--) {
    if (pcs.includes(((m % 12) + 12) % 12) && (!out.length || out.at(-1) - m >= 3)) out.push(m);
  }
  return out;
}
/** 🎹 두 손 피아노 — 왼손: 8분음표마다 베이스 → 5도 → 옥타브 → 3도 (반 마디마다 되풀이). 8분 자리가 아니면 null */
export function pianoLeftHand(song, mb, s) {
  if (s % 2) return null;
  const ch = chordAt(song, mb, s);
  let b = ch.notes[0] - 24;
  while (b < 36) b += 12;
  while (b > 47) b -= 12;
  const third = ch.notes[1] - ch.notes[0];
  const k = (s % 8) / 2;
  return { midi: [b, b + 7, b + 12, b + 12 + third][k], vel: k === 0 ? 0.55 : 0.32, steps: 8 - (s % 8) };
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
  return tempoOf(level).barStart(COUNT_IN_BARS + level.bars.length + OUTRO_BARS);
}

// ---------------------------------------------------------------
// 박자 시계: 마디마다 BPM 이 달라질 수 있음 (무제한 모드는 단계마다 빨라짐)
//   bar = 카운트인을 포함한 전체 마디 번호 (0 = 카운트인 첫 마디)
// ---------------------------------------------------------------
export class TempoMap {
  /** @param {(bar:number)=>number} bpmOfBar  @param {number} [constBpm] 고정 빠르기면 계산을 곱셈으로 */
  constructor(bpmOfBar, constBpm = 0) {
    this.bpmOf = bpmOfBar;
    this.constBpm = constBpm;
    this.starts = [0];
    this._hint = 0;
  }
  bpm(bar) {
    return this.constBpm || this.bpmOf(Math.max(0, Math.floor(bar)));
  }
  barLen(bar) {
    return 240 / this.bpm(bar);
  }
  barStart(bar) {
    if (this.constBpm) return (bar * 240) / this.constBpm;
    if (bar <= 0) return bar * this.barLen(0);
    while (this.starts.length <= bar) {
      const b = this.starts.length - 1;
      this.starts.push(this.starts[b] + this.barLen(b));
    }
    return this.starts[bar];
  }
  stepTime(step) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    return this.barStart(bar) + ((step - bar * STEPS_PER_BAR) * this.barLen(bar)) / STEPS_PER_BAR;
  }
  /** 시각 → 마디 위치(소수). 음수 시각도 첫 마디 빠르기로 */
  barAt(t) {
    if (this.constBpm) return (t * this.constBpm) / 240;
    if (t < 0) return t / this.barLen(0);
    let b = this._hint;
    if (this.barStart(b) > t) b = 0;
    while (this.barStart(b + 1) <= t) b++;
    this._hint = b;
    return b + (t - this.barStart(b)) / this.barLen(b);
  }
  beatAt(t) {
    return this.barAt(t) * 4;
  }
  beatTime(beat) {
    const bar = Math.floor(beat / 4);
    return this.barStart(bar) + ((beat - bar * 4) * this.barLen(bar)) / 4;
  }
}

const _tempos = new WeakMap();
/** 단계의 박자 시계 (보통 단계는 고정 BPM) */
export function tempoOf(level) {
  if (level.tempo) return level.tempo;
  let t = _tempos.get(level);
  if (!t) {
    t = new TempoMap(() => level.bpm, level.bpm);
    _tempos.set(level, t);
  }
  return t;
}

/** 이 단계에서 쓰는 악기들 (화면 왼쪽부터 순서) */
export function levelLanes(level) {
  if (level.lanes) return level.lanes; // 단계별 무제한: 채보가 늘어나도 처음부터 원래 단계의 악기 그대로
  const used = new Set([KICK, SNARE]);
  for (const bar of level.bars) for (const c of bar) for (const l of CHAR_LANES[c] || []) used.add(l);
  return SCREEN_ORDER.filter((l) => used.has(l));
}

/**
 * 채보 → 노트 목록. time 은 곡 시작(카운트인 첫 박) 기준 초.
 * 동시치기(B/J/X)는 레인마다 같은 시각의 노트 + 같은 pair 번호.
 * fromBar~toBar 로 일부 마디만 만들 수 있음 (무제한 모드가 앞으로 나갈 마디를 그때그때 추가)
 */
export function buildNotes(level, fromBar = 0, toBar = level.bars.length, pairStart = 0) {
  const notes = [];
  const tempo = tempoOf(level);
  let pair = pairStart;
  for (let b = fromBar; b < toBar; b++) {
    const bar = level.bars[b];
    const mult = (level.barMult && level.barMult[b]) || 1;
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const lanes = CHAR_LANES[bar[s]];
      if (!lanes) continue;
      const step = (COUNT_IN_BARS + b) * STEPS_PER_BAR + s;
      const time = tempo.stepTime(step);
      const p = lanes.length > 1 ? pair++ : -1;
      for (const lane of lanes) notes.push({ time, lane, step, pair: p, mult });
    }
  }
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  notes.forEach((n, i) => (n.id = i));
  notes.nextPair = pair;
  return notes;
}

// ---------------------------------------------------------------
// 💥 연타 구간 (드럼 롤): 리듬게임의 '꾹 누르기' 대신 드럼다운 '마구 두드리기'.
//   level.rolls = [{ bar, from, len, lane }] — 그 칸들엔 다른 노트가 없음. 점수·정확도와 상관없고(랭킹 공정),
//   ROLL_HEART_HITS 번 칠 때마다 하트 +1 (한 구간 최대 ROLL_MAX_HEARTS 개)
// ✨ 황금 콩: 곡의 1/4·2/4·3/4 쯤 혼자 치는 노트 하나씩 금색. GREAT 이상이면 하트 +1 (점수는 그대로)
// ---------------------------------------------------------------
export const ROLL_HEART_HITS = 8;
export const ROLL_MAX_HEARTS = 2;
export const GOLD_SPOTS = [0.25, 0.5, 0.75];

export function buildRolls(level) {
  if (!level.rolls) return [];
  const tempo = tempoOf(level);
  return level.rolls.map((r, i) => {
    const s0 = (COUNT_IN_BARS + r.bar) * STEPS_PER_BAR + r.from;
    return { id: i, lane: r.lane, t0: tempo.stepTime(s0), t1: tempo.stepTime(s0 + r.len), hits: 0, hearts: 0 };
  });
}

/** 노트 목록에 황금 콩 표시 (n.gold = true). 고른 노트 수 */
export function markGoldNotes(notes) {
  let n = 0;
  for (const f of GOLD_SPOTS) {
    const start = Math.floor(notes.length * f);
    for (let i = start; i < notes.length; i++) {
      if (notes[i].pair < 0 && !notes[i].gold) {
        notes[i].gold = true;
        n++;
        break;
      }
    }
  }
  return n;
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

// ---------------------------------------------------------------
// 진행 잠금: 앞 단계를 깨야(별 1개 이상) 다음 단계가 열림. 마지막 단계를 깨면 무제한 모드
// ---------------------------------------------------------------
/** 이 기록이 '깬' 기록인지 (별 1개 이상) */
export function isClearBest(best) {
  return !!best && (best.stars || 0) >= 1;
}
/** 본편 마지막 단계 (🎄 이벤트 곡은 본편 순서 밖). 총 등수는 1~이 단계까지만 합침 */
export const LAST_LEVEL_ID = LEVELS.filter((l) => !l.xmas && !l.long).at(-1).id;
/** 본편 단계 (총 등수·무제한·빠른 대결) */
export const MAIN_LEVELS = LEVELS.filter((l) => !l.xmas && !l.long);
/** 화면에 보일 단계 이름: '5단계' / 이벤트 곡은 '🎄 크리스마스 이벤트' */
export function levelLabel(lv) {
  const l = typeof lv === 'object' && lv ? lv : getLevel(lv);
  if (l && l.xmas) return '🎄 크리스마스 이벤트';
  if (l && l.long) return '🎭 장거리';
  return `${l ? l.id : lv}단계`;
}

/** 2026-11-17: 8단계에 '운명 교향곡'을 끼워 넣어서, 예전 8~14단계는 번호가 하나씩 밀림(9~15).
 *  저장된 기록 키('8', 'e8', 서버 칸 '-8')를 새 번호로 바꿔 줌. 예전 번호가 아니면 그대로. */
export function shiftOldLevelKey(key) {
  const m = /^(e|-)?(\d+)$/.exec(String(key));
  if (!m) return key;
  const n = Number(m[2]);
  return n >= 8 && n <= 14 ? (m[1] || '') + (n + 1) : String(key);
}
/** 무제한 모드(그리그)는 13단계(터키 행진곡)를 깨면 열림 */
export const ENDLESS_FROM = 13;
/** 1~3단계는 앞 단계를 안 깨도 바로 칠 수 있음 */
export const FREE_LEVELS = 3;
/** bests = { [levelId]: best } 일 때 이 단계가 열려 있는지 (1~3단계는 항상)
 *  - 바로 앞 단계를 깨면 열림
 *  - 같은 난이도(입문·쉬움·보통·어려움·지옥) 단계를 하나라도 깨면 그 난이도는 전부 열림 (2026-11-18)
 *  단계별 무제한('e5' 등)은 그 단계를 깨면 열림 */
export function isUnlocked(levelId, bests) {
  if (levelId === ENDLESS_ID) return isClearBest(bests[ENDLESS_FROM]);
  const base = levelEndlessBase(levelId);
  if (base) return isClearBest(bests[base.id]);
  if (levelId >= 1 && levelId <= FREE_LEVELS) return true;
  // 🎄 캐롤 단계는 앞 단계를 안 깼어도 바로 (잠금은 isClosed: 팔로워 인증)
  if (getLevel(levelId)?.xmas || getLevel(levelId)?.long) return true;
  const prev = prevOpenId(levelId);
  if (prev === null || isClearBest(bests[prev])) return true;
  const lv = getLevel(levelId);
  return !!lv && MAIN_LEVELS.some((l) => l.difficulty === lv.difficulty && isClearBest(bests[l.id]));
}
/** 같은 난이도 단계들 */
export const tierOf = (levelId) => {
  const lv = getLevel(levelId);
  return lv ? MAIN_LEVELS.filter((l) => l.difficulty === lv.difficulty).map((l) => l.id) : [];
};
/** 잠긴 단계 안내: 같은 난이도에 이미 열린 단계가 있으면 '그 난이도 하나만 깨면', 아니면 '앞 단계 깨면' */
export function unlockHint(levelId, bests) {
  const lv = getLevel(levelId);
  if (!lv) return null;
  const word = DIFFICULTY_WORDS[lv.difficulty];
  const near = tierOf(levelId).some((id) => id !== lv.id && isUnlocked(id, bests));
  if (near) return { tier: true, word, short: `${word} 단계 하나만 깨면 열림` };
  // 같은 난이도는 하나만 깨면 전부 열리므로, 난이도 첫 단계가 아닌 카드는 '그 난이도 첫 단계'를 깨라고 안내 (10·11·12 → 9단계)
  const first = tierOf(levelId)[0];
  const prev = first !== undefined && first !== lv.id ? first : prevOpenId(levelId);
  return { tier: false, word, prev, short: `${prev}단계 깨면 열림` };
}
/** 아직 안 깬 첫 단계 (잠긴 단계는 건너뜀. 다 깼으면 무제한 모드) */
export function nextChallenge(bests) {
  const lv = MAIN_LEVELS.find((l) => !SKIP_LEVELS.includes(l.id) && !isClearBest(bests[l.id]));
  return lv ? lv.id : ENDLESS_ID;
}

// ---------------------------------------------------------------
// 무제한 모드 / 레벨업 챌린지
//   한 판 안에서 Lv.1, Lv.2 … 로 올라감. 한 단계 = ROUND_BARS 마디, 단계마다 BPM +10 (끝없이)
//   패턴도 기본 쿵짝 → 8비트 → 엇박 → 필인 지옥 … 순서로 어려워짐
//   목숨이 다 떨어질 때까지 계속. 별 대신 다이아몬드 3개.
//   rounds 를 주면(영상 찍기용 레벨업 챌린지) 그 단계까지만 치고 끝남
// ---------------------------------------------------------------
export const ENDLESS_ID = 'endless';
export const ROUND_BARS = 4;
export const ENDLESS_BASE_BPM = 90;
export const ENDLESS_BPM_STEP = 10;

/** 다이아몬드: Lv.N 까지 깨면 (= Lv.N+1 도달) */
export const DIAMOND_RULES = [
  { diamonds: 3, round: 10, text: 'Lv.10 클리어' },
  { diamonds: 2, round: 7, text: 'Lv.7 클리어' },
  { diamonds: 1, round: 4, text: 'Lv.4 클리어 (드러머 재능!)' },
];
export function diamondsFor(roundsCleared) {
  for (const r of DIAMOND_RULES) if (roundsCleared >= r.round) return r.diamonds;
  return 0;
}

const ROUND_NAMES = [
  ['기본 쿵짝', ''],
  ['8비트 록', ''],
  ['엇박 들어갑니다', ''],
  ['필인 지옥', '손가락 꼬임 주의!'],
  ['더블 킥', '왼손 엄지 바빠요'],
  ['16비트 그루브', ''],
  ['속도 한계 돌파', '여기부터 진짜 고수'],
  ['광속 드러머', ''],
  ['인간 메트로놈', ''],
  ['전설의 엄지', '여기까지 오면 드러머 확정'],
];
export function roundBpm(round) {
  return ENDLESS_BASE_BPM + ENDLESS_BPM_STEP * (round - 1);
}
/** 단계 정보: { round, bpm, name, warn } */
export function roundInfo(round) {
  const [name, warn] = ROUND_NAMES[round - 1] || ['한계 없음', '어디까지 가나 보자'];
  return { round, bpm: roundBpm(round), name, warn };
}

// 같은 엄지(킥)는 2칸(8분음표) 간격 이상. 16분음표는 엄지 번갈아 칠 때만
const POOLS = {
  1: ['K...S...K...S...', 'K...S...K...S...', 'K...K...S...S...', 'K.......S...S...'],
  2: ['K...S...K.K.S...', 'K.K.S...K.K.S...', 'K...S.K.K...S...', 'K.K.S...K...S...'],
  3: ['K..KS...K..KS...', 'K...S..K.K..S...', 'K..K..S.K...S...', 'K...S..K..K.S...', 'K..KS..K..K.S...'],
  4: ['K.K.S...K..KS...', 'K..KS..K.K..S...', 'K...S.K.K..KS...'],
  5: ['K.K.S.K.K.K.S...', 'K.K.S...K.K.S.K.', 'B...K.K.S.K.K.S.', 'K.K.S.K.K.K.S.K.'],
  6: ['K.S.SK.SK.S.SK.S', 'K.SKS..SK.SKS..S', 'K..KS.SK.KS.S..S', 'K.S..KS.K.S.SK.S'],
};
const FILLS = ['K.S.K.S.KSKSKSKS', 'K...S...KSKS.S.S', 'K.K.S...SKSKSKS.', 'KSKSKSK.S.S.B...', 'K.S.K.S.B.B.B...'];
const FILLS_FAST = ['K.S.K.S.B.B.B...', 'B...B...K.S.K.S.', 'K.K.S.S.K.K.B...'];
/** 16분음표(붙어 있는 두 칸)가 있는 패턴 — 너무 빠르면 뺌 */
/** 두 글자가 같은 엄지를 쓰는지 (킥·크래시 = 왼쪽, 스네어·하이햇 = 오른쪽) */
const thumbs = (c) => new Set((CHAR_LANES[c] || []).map((l) => (l === KICK || l === CRASH ? 'L' : 'R')));
const sameThumb = (a, b) => [...thumbs(a)].some((h) => thumbs(b).has(h));
const has16th = (bar) => [...bar].some((c, i) => c !== '.' && i < bar.length - 1 && bar[i + 1] !== '.');

/** 간단한 고정 시드 난수 (같은 시드면 같은 채보) */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** round 단계의 마디 ROUND_BARS 개 */
export function roundBars(round, rand = Math.random, bpm = roundBpm(round)) {
  const fast = bpm > 140;
  const ok = (list) => {
    const f = fast ? list.filter((b) => !has16th(b)) : list;
    return f.length ? f : list.filter((b) => !has16th(b));
  };
  const tiers = round <= 6 ? [round] : [3, 4, 5, 6];
  let pool = ok(tiers.flatMap((t) => POOLS[t]));
  if (!pool.length) pool = POOLS[2];
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
  const out = [];
  for (let i = 0; i < ROUND_BARS; i++) {
    if (i === ROUND_BARS - 1 && round >= 4) out.push(pick(fast ? FILLS_FAST : ok(FILLS)));
    else if (i === ROUND_BARS - 1 && round >= 2) out.push(pick(ok(POOLS[Math.min(round, 3)])));
    else out.push(pick(pool));
  }
  // 단계 첫 마디는 한숨 돌리게 (새 단계 이름이 크게 뜨는 동안)
  if (round > 1) out[0] = round >= 3 ? 'K...S...K.K.S...' : 'K...S...K...S...';
  // 마디 경계에서 같은 엄지 16분음표 연타가 생기면 앞 마디 마지막 칸을 비움
  // (단계 첫 마디는 항상 킥으로 시작하고 단계 마지막 마디는 킥으로 끝나지 않아서 단계 사이 경계는 안전)
  for (let i = 1; i < out.length; i++) if (sameThumb(out[i - 1][STEPS_PER_BAR - 1], out[i][0])) out[i - 1] = out[i - 1].slice(0, -1) + '.';
  return out;
}

/**
 * 무제한 모드(또는 rounds 단계짜리 레벨업 챌린지) 판 하나.
 * level 처럼 쓰지만 bars 가 치는 동안 계속 늘어남 → ensureBars(n)
 */
export function makeEndless({ rounds = Infinity, seed = (Math.random() * 2 ** 31) | 0, bpm = null } = {}) {
  const mk = LEVELS.find((l) => l.id === 8);
  const rand = rng(seed);
  const run = {
    id: rounds === Infinity ? ENDLESS_ID : `ch${rounds}`,
    endless: rounds === Infinity,
    challenge: true,
    maxRounds: rounds,
    seed,
    name: rounds === Infinity ? '무제한 모드' : `레벨업 챌린지`,
    composer: '그리그',
    songName: '산왕의 궁전에서',
    tagline: '깰수록 점점 빨라져요 · 속도 한도 없음',
    difficulty: 5,
    bpm: ENDLESS_BASE_BPM,
    song: mk.song,
    bars: [],
    barMult: [],
    barRound: [],
    roundsBuilt: 0,
    /** n 마디까지 채보 만들기 (단계 단위) */
    ensureBars(n) {
      while (this.bars.length < n && this.roundsBuilt < this.maxRounds) {
        const r = ++this.roundsBuilt;
        for (const bar of roundBars(r, rand, bpm ?? roundBpm(r))) {
          this.bars.push(bar);
          this.barMult.push(1 + 0.1 * (r - 1)); // 빠를수록 점수 더
          this.barRound.push(r);
        }
      }
      return this.bars.length;
    },
    /** 본편 mb 번째 마디의 단계 (1부터) */
    roundOfBar(mb) {
      if (mb < 0) return 1;
      return Math.floor(mb / ROUND_BARS) + 1;
    },
  };
  // 카운트인은 Lv.1 빠르기, 아웃트로는 마지막 단계 빠르기
  run.tempo = new TempoMap((bar) => {
    const r = Math.min(run.roundOfBar(bar - COUNT_IN_BARS), run.maxRounds);
    return bpm ?? roundBpm(r);
  });
  run.ensureBars(ROUND_BARS * 2);
  return run;
}

// ---------------------------------------------------------------
// 🎵 릴스 박자 맞추기 (운영자 전용, 영상 찍기 화면 · /?thumb=okay 기기에서만)
//   유행하는 노래 BPM 에 맞춰 레벨업 챌린지처럼 Lv.1 기본 쿵짝 → Lv.2 8비트 → … 점점 어려워짐. 빠르기는 그대로.
//   노래는 게임에 안 넣음 (저작권). 드럼만 찍고, 노래는 인스타 편집기에서 입힘 → 반주 없이 드럼 소리만 남
// ---------------------------------------------------------------
export const BEAT_ID = 'beat';
export const BEAT_MIN_BPM = 60;
export const BEAT_MAX_BPM = 200;
export const BEAT_MAX_ROUNDS = 6;
const BEAT_NAMES = ['기본 쿵짝', '8비트', '엇박 들어갑니다', '16분 쪼개기', '더블 킥', '필인 지옥'];
/** BPM·단계 수 정리 (이상한 값이면 기본값) */
export function beatOpts(o = {}) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const bpm = Math.round(Math.min(BEAT_MAX_BPM, Math.max(BEAT_MIN_BPM, n(o.bpm, 120))) * 10) / 10;
  const rounds = Math.min(BEAT_MAX_ROUNDS, Math.max(1, Math.round(n(o.rounds, 4))));
  const seed = Number.isInteger(o.seed) ? o.seed : (Math.random() * 2 ** 31) | 0;
  // 예전 형식(빌드업→드롭·드럼 커버)은 '비트'로
  const style = o.style === 'drop' || o.style === 'cover' ? 'steady' : BEAT_STYLES.some((x) => x.id === o.style) ? o.style : 'levelup';
  const diff = BEAT_DIFFS.some((x) => x.id === o.diff) ? o.diff : 'easy';
  return { bpm, rounds, seed, style, diff, title: String(o.title || '').slice(0, 24), click: !!o.click };
}
/**
 * 박자 맞추기 형식 (빠르기는 노래 그대로, 노래는 릴스에서 하이라이트만 잘라 입힘)
 *   levelup: Lv.1 기본 쿵짝 → 점점 어려워짐
 *   steady:  '비트' — 구간 없이 같은 난이도로 쭉 (쉬움 / 보통 / 어려움). 4마디마다 짧은 필인
 */
export const BEAT_STYLES = [
  { id: 'levelup', name: '레벨업', desc: '점점 어려워짐' },
  { id: 'steady', name: '비트', desc: '같은 난이도로 쭉' },
  { id: 'song', name: '노래 따라', desc: '노래 소리대로 (화면 녹화 필요)' },
];
export const BEAT_DIFFS = [
  { id: 'easy', name: '쉬움', desc: '쿵·짝만' },
  { id: 'normal', name: '보통', desc: '하이햇 추가' },
  { id: 'hard', name: '어려움', desc: '크래시·탐탐·잘게' },
];
export const beatStyleName = (style, diff) =>
  style === 'steady' || style === 'song'
    ? `${style === 'song' ? '노래 따라' : '비트'}(${(BEAT_DIFFS.find((x) => x.id === diff) || BEAT_DIFFS[0]).name})`
    : '레벨업';
// 같은 엄지(킥·크래시·탐탐 / 스네어·하이햇)는 2칸 이상 띄움. fast(140 BPM 넘음)면 붙은 칸 없음
const STEADY = {
  easy: {
    groove: { slow: ['K...S...K...S...', 'K...S...K...S...', 'K...S...K.K.S...'], fast: ['K...S...K...S...', 'K...S...K...S...', 'K...S...K.K.S...'] },
    fill: { slow: ['K...S...K.K.S.S.', 'K...S...K...S.S.'], fast: ['K...S...K.K.S.S.', 'K...S...K...S.S.'] },
  },
  normal: {
    groove: { slow: ['K.H.S.H.K.H.S.H.', 'K.H.S.H.K.K.S.H.', 'J.H.S.H.K.H.S.H.'], fast: ['K.H.S.H.K.H.S.H.', 'K.H.S.H.K.K.S.H.', 'J.H.S.H.K.H.S.H.'] },
    fill: { slow: ['K.H.S.H.K.S.S.S.', 'K.H.S.H.T.T.S.S.'], fast: ['K.H.S.H.K.S.S.S.', 'K.H.S.H.T.T.S.S.'] },
  },
  hard: {
    groove: {
      slow: ['J.H.S.H.J.HKS.H.', 'J.H.S.H.K.HKS.H.', 'J.HKS.H.J.H.S.H.', 'X.H.S.H.K.HKS.H.', 'C.HKS.H.K.HKS.H.'],
      fast: ['J.H.S.H.J.H.S.H.', 'J.H.S.H.K.H.S.H.', 'J.H.S.H.J.J.S.H.', 'X.H.S.H.K.H.S.H.', 'C.H.S.H.K.H.S.H.'],
    },
    fill: { slow: ['J.H.S.H.KSK.Y.Y.', 'J.H.S...T.T.S.S.', 'K.S.T.S.KSK.B...'], fast: ['J.H.S.H.T.T.S.S.', 'J.H.S...Y...Y...', 'K.S.T.S.K.S.B...'] },
  },
};
function steadyBeatBars(diff, rounds, bpm, rand) {
  const sp = bpm > 140 ? 'fast' : 'slow';
  const set = STEADY[diff] || STEADY.easy;
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
  const out = [];
  for (let r = 1; r <= rounds; r++) {
    const a = pick(set.groove[sp]);
    const b = pick(set.groove[sp]);
    out.push(a, b, a, pick(set.fill[sp]));
  }
  // 마디 경계에서 같은 엄지 연타가 생기면 앞 마디 마지막 칸을 비움
  for (let i = 1; i < out.length; i++) if (sameThumb(out[i - 1][STEPS_PER_BAR - 1], out[i][0])) out[i - 1] = out[i - 1].slice(0, -1) + '.';
  return out;
}

/** 박자 맞추기 판 (게임 시간 = 카운트인 + 단계 수 × ROUND_BARS 마디) */
export function makeBeatReel(o = {}) {
  const { bpm, rounds, seed, title, click, style, diff } = beatOpts(o);
  const run = makeEndless({ rounds, seed, bpm });
  if (style === 'steady' || style === 'song') {
    // 노래 따라: 화면 녹화 소리로 만든 채보(o.bars, main 에서 만들어 넘김). 없으면 비트로
    const song = style === 'song' && Array.isArray(o.bars) && o.bars.length === rounds * ROUND_BARS;
    const bars = song ? o.bars.slice() : steadyBeatBars(diff, rounds, bpm, rng(seed));
    run.bars = bars;
    run.barMult = bars.map(() => 1);
    run.barRound = bars.map((_, i) => Math.floor(i / ROUND_BARS) + 1);
    run.roundsBuilt = rounds;
    run.lanes = levelLanes({ bars });
    Object.assign(run, {
      id: BEAT_ID,
      beat: true,
      beatStyle: song ? 'song' : 'steady',
      beatDiff: diff,
      steady: true,
      theme: 'city', // 맵이 4마디마다 안 바뀌게
      click,
      name: title || '엄지 드럼 챌린지',
      songName: title || '엄지 드럼 챌린지',
      composer: `${bpm} BPM`,
      tagline: '릴스용 · 노래는 인스타에서 입혀요',
      bpm,
      roundInfo: (r) => ({ round: r, bpm, name: '', big: '', sub: '', warn: '' }),
    });
    return run;
  }
  Object.assign(run, {
    id: BEAT_ID,
    beat: true,
    click,
    name: title || '엄지 드럼 챌린지',
    songName: title || '엄지 드럼 챌린지',
    composer: `${bpm} BPM`,
    tagline: '릴스용 · 노래는 인스타에서 입혀요',
    bpm,
    beatStyle: 'levelup',
    roundInfo: (r) => ({ round: r, bpm, name: BEAT_NAMES[r - 1] || '필인 지옥', warn: '' }),
  });
  return run;
}
/** 박자 맞추기 영상 길이(초): 카운트인 + 본편 */
export function beatSeconds(o = {}) {
  const { bpm, rounds } = beatOpts(o);
  return ((COUNT_IN_BARS + rounds * ROUND_BARS) * 4 * 60) / bpm;
}

// ---------------------------------------------------------------
// 🎧 노래 맞히기 퀴즈 (영상 찍기 전용): 곡 제목을 숨기고 앞부분만 치다가 끝나면 정답 공개
//   id = 'q' + 단계 + 'x' + 마디 수 (0 = 끝까지). 예) 'q2x8' = 환희의 송가 앞 8마디. 기록·랭킹엔 안 들어감
// ---------------------------------------------------------------
export const QUIZ_BARS = [8, 12, 0];
export const quizId = (id, bars) => `q${id}x${bars}`;
export const isQuizId = (id) => /^q\d+x\d+$/.test(String(id));
export function makeQuizLevel(id) {
  const m = /^q(\d+)x(\d+)$/.exec(String(id));
  const base = m && getLevel(Number(m[1]));
  if (!base) return null;
  const n = Number(m[2]);
  const bars = n > 0 && n < base.bars.length ? base.bars.slice(0, n) : base.bars;
  return { ...base, id, baseId: base.id, quiz: true, bars, lanes: levelLanes(base) };
}
/** 퀴즈 영상 길이(초): 카운트인 + 본편 */
export function quizSeconds(id) {
  const lv = makeQuizLevel(id);
  return lv ? Math.round(((COUNT_IN_BARS + lv.bars.length) * 4 * 60) / lv.bpm) : 0;
}

// ---------------------------------------------------------------
// 단계별 무제한 모드: 그 단계 곡·채보를 4마디씩 끝없이 이어 치고, 4마디마다 BPM +LEVEL_ENDLESS_STEP
//   id = 'e' + 단계 번호 (예: 'e13'). 그 단계를 깨면 열림. 다이아 기준은 그리그 무제한과 같음
// ---------------------------------------------------------------
export const LEVEL_ENDLESS_STEP = 6;
export const levelEndlessId = (id) => `e${id}`;
/** 'e13' → 13단계 레벨 (아니면 null) */
export function levelEndlessBase(id) {
  const m = /^e(\d+)$/.exec(String(id));
  return m ? getLevel(Number(m[1])) : null;
}

// ⚔️ 멀티 서바이벌: 곡을 원래 빠르기로 한 번 다 치고, 둘 다 살아 있으면 그때부터 4마디마다 빨라지며 끝없이.
//   먼저 목숨을 다 쓴 사람이 짐 (그 순간 판이 끝남). id = 'v' + 단계 번호 (예: 'v13'). 기록·랭킹엔 안 들어감
export const levelSurvivalId = (id) => `v${id}`;
/** 'v13' → 13단계 레벨 (아니면 null) */
export function levelSurvivalBase(id) {
  const m = /^v(\d+)$/.exec(String(id));
  return m ? getLevel(Number(m[1])) : null;
}

/**
 * 단계별 무제한 판. intro = true 면 첫 단계가 '곡 전체'(원래 빠르기), 그 뒤부터 4마디씩 빨라짐 (멀티 서바이벌)
 */
export function makeLevelEndless(base, { intro = false } = {}) {
  const bpmOf = (r) => base.bpm + LEVEL_ENDLESS_STEP * (r - 1);
  const introBars = intro ? base.bars.length : 0;
  const run = {
    id: intro ? levelSurvivalId(base.id) : levelEndlessId(base.id),
    baseId: base.id,
    survival: intro,
    introBars,
    rolls: intro ? base.rolls : undefined,
    endless: true,
    challenge: true,
    maxRounds: Infinity,
    name: `${base.name} 무제한`,
    composer: base.composer,
    songName: base.name,
    tagline: `${base.id}단계 곡이 끝없이 · 4마디마다 BPM +${LEVEL_ENDLESS_STEP}`,
    difficulty: base.difficulty,
    bpm: base.bpm,
    song: base.song,
    lanes: levelLanes(base),
    bars: [],
    barMult: [],
    barRound: [],
    roundsBuilt: 0,
    ensureBars(n) {
      while (this.bars.length < n) {
        const r = ++this.roundsBuilt;
        // intro: 1단계 = 곡 전체, 2단계부터 곡 처음부터 4마디씩
        const len = introBars && r === 1 ? introBars : ROUND_BARS;
        const from = introBars ? (r === 1 ? 0 : (r - 2) * ROUND_BARS) : (r - 1) * ROUND_BARS;
        for (let i = 0; i < len; i++) {
          this.bars.push(base.bars[(from + i) % base.bars.length]);
          this.barMult.push(1 + 0.1 * (r - 1));
          this.barRound.push(r);
        }
      }
      return this.bars.length;
    },
    roundOfBar(mb) {
      if (mb < 0) return 1;
      if (introBars) return mb < introBars ? 1 : Math.floor((mb - introBars) / ROUND_BARS) + 2;
      return Math.floor(mb / ROUND_BARS) + 1;
    },
    /** 지금 단계 안에서 얼마나 왔나 0~1 */
    roundProgress(mb) {
      if (mb < 0) return 0;
      if (introBars && mb < introBars) return mb / introBars;
      return ((mb - introBars) % ROUND_BARS) / ROUND_BARS;
    },
    /** 화면에 띄울 단계 정보 (그리그 무제한의 roundInfo 대신) */
    roundInfo(r) {
      return { round: r, bpm: bpmOf(r), name: r === 1 ? '원래 빠르기' : `${Math.round((bpmOf(r) / base.bpm) * 100)}% 빠르기`, warn: '' };
    },
  };
  run.tempo = new TempoMap((bar) => bpmOf(run.roundOfBar(bar - COUNT_IN_BARS)));
  run.ensureBars(introBars + ROUND_BARS * 2);
  return run;
}
