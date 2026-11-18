// 자동 생성 파일 — scripts/bundle.js 가 public/js/*.js 를 묶음. 직접 고치지 마세요 (npm run bundle)
'use strict';
// ---- charts.js ----
const __m_charts = (() => {
// 오케이스트라 — 레벨/채보 정의 (브라우저와 서버가 같이 씁니다)
//
// 채보 표기: 한 마디 = 16칸(16분음표)
//   K = 킥 (왼쪽 엄지)        S = 스네어 (오른쪽 엄지)
//   H = 하이햇 (오른쪽 엄지, 5단계부터)   C = 크래시 (왼쪽 엄지, 6단계부터)
//   T = 탐탐 (왼쪽 엄지, 16단계부터)
//   B = 킥+스네어 동시   J = 킥+하이햇 동시   X = 크래시+스네어 동시   Y = 탐탐+스네어 동시   . = 쉼
//   같은 엄지끼리(킥·크래시·탐탐 / 스네어·하이햇)는 동시에 못 누르니 그런 조합은 없음
// 새 레벨을 추가하려면 LEVELS 배열에 객체를 하나 더 넣으면 됩니다.

const STEPS_PER_BAR = 16;

// 악기(레인) 번호. 화면에는 왼쪽부터 크래시 · 킥 · 스네어 · 하이햇 순서로 나옵니다.
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const CRASH = 3;
const TOM = 4;
const INSTRUMENTS = [
  { id: KICK, name: '킥', hand: 'left' },
  { id: SNARE, name: '스네어', hand: 'right' },
  { id: HAT, name: '하이햇', hand: 'right' },
  { id: CRASH, name: '크래시', hand: 'left' },
  { id: TOM, name: '탐탐', hand: 'left' },
];
// 화면 왼쪽부터: 크래시 · 킥 · 탐탐 | 스네어 · 하이햇 (왼쪽 엄지 셋, 오른쪽 엄지 둘)
const SCREEN_ORDER = [CRASH, KICK, TOM, SNARE, HAT];
/** 채보 글자 → 누를 레인들 */
const CHAR_LANES = { K: [KICK], S: [SNARE], H: [HAT], C: [CRASH], T: [TOM], B: [KICK, SNARE], J: [KICK, HAT], X: [CRASH, SNARE], Y: [TOM, SNARE] };
/** 왼쪽 엄지 악기인지 (같은 엄지 연타 검사·안내에 씀) */
const isLeftThumb = (lane) => INSTRUMENTS[lane] && INSTRUMENTS[lane].hand === 'left';
const COUNT_IN_BARS = 1; // 시작 전 "3, 2, 1" 한 마디
const OUTRO_BARS = 1; // 끝난 뒤 여운 한 마디

// 판정 범위(초). 인스타 인앱 브라우저 지연을 고려해 살짝 넉넉하게.
//   early: 노트보다 이만큼 먼저 누르면(GOOD 범위 밖) 그 노트는 MISS 처리 → 마구 연타 방지
const JUDGE = { perfect: 0.055, great: 0.1, good: 0.15, early: 0.26 };
const POINTS = { perfect: 1000, great: 700, good: 400 };
const ACC_WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

// 별 3개 기준 (정확도 = 판정 점수 / (노트 수 + 헛침 수))
const STAR_RULES = [
  { stars: 3, acc: 0.9, clean: true, text: '미스·헛침 없이 정확도 90% 이상' },
  { stars: 2, acc: 0.75, text: '정확도 75% 이상' },
  { stars: 1, acc: 0.5, text: '정확도 50% 이상' },
];

const DIFFICULTY_WORDS = ['', '입문', '쉬움', '보통', '어려움', '지옥'];

// ---------------------------------------------------------------
// 반주 곡: 전부 퍼블릭 도메인 — 작곡가 사후 70년이 지난 곡 또는 작곡가 미상의 전통 민요.
//   (최신 가요·팝, 저작권이 남은 동요는 멜로디만 다시 연주해도 안 됨) 직접 편곡·합성.
//   melody: 마디별 문자열. "음이름:길이(16분음표 칸 수)" — 길이 생략하면 4(4분음표). "_" = 쉼
//           예) 'E5 E5 F5 G5', 'E5:6 D5:2 D5:8'. 마디마다 길이 합이 16이어야 함.
//   prog:   마디별 코드. 'D A' 처럼 두 개 쓰면 반 마디씩. 마디 수보다 짧으면 반복.
//   melody 도 채보보다 짧으면 반복합니다.
// ---------------------------------------------------------------
const LEVELS = [
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
];

// ---------------------------------------------------------------
// 🎬 영상 찍기 전용 (릴스용): 단계 목록·랭킹·진행엔 안 나옴. '영상 찍기' 화면에서만.
//   4악기가 다 나와서 화려해 보이지만, 패턴은 10단계(캉캉)와 같은 정도 + 조금 느리게(108 → 96 BPM)
//   → 보는 사람은 '어려워 보이는데 잘 친다', 치는 사람은 할 만함
// ---------------------------------------------------------------
const STUDIO_LEVELS = [
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
const getStudioLevel = (id) => STUDIO_LEVELS.find((l) => l.id === id) || null;

/** 누구나 칠 수 있는 단계: 1~FREE_UPTO. 그 뒤 단계와 💎 무제한 모드(그리그·단계별)는 전부 팔로워 인증(암호) 필요 */
const FREE_UPTO = 3;
/** (예전 '인증 신청만 해도 열림' 단계 — 이제 없음) */
const VERIFY_LEVELS = [];
function needsVerify(id) {
  return false;
}
/** 팔로워 인증(인증 완료)이 있어야 열리는 단계 */
const CLOSED_LEVELS = LEVELS.filter((l) => l.id > FREE_UPTO).map((l) => l.id);
/** 진행 순서에서 건너뛰는 단계 (없음: 1→2→…→15 차례로) */
const SKIP_LEVELS = [];
/** 판 id 가 팔로워 인증이 필요한지: 4단계부터 + 무제한 모드('endless', 'e5' 등) 전부 */
function isClosed(id) {
  if (id === 'endless' || (typeof id === 'string' && /^e\d+$/.test(id))) return true;
  return Number(id) > FREE_UPTO;
}
/** 이 단계 앞에서 깨야 하는 단계 번호 (잠긴 단계는 건너뜀). 1단계는 null */
function prevOpenId(id) {
  let n = Number(id) - 1;
  while (n >= 1 && SKIP_LEVELS.includes(n)) n--;
  return n >= 1 ? n : null;
}
/** 다음에 칠 수 있는 단계 번호 (잠긴 단계는 건너뜀). 없으면 null */
function nextOpenId(id) {
  let n = Number(id) + 1;
  while (SKIP_LEVELS.includes(n)) n++;
  return getLevel(n) ? n : null;
}

// ---------- 음이름 / 코드 해석 ----------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' → 73 (C4 = 60) */
function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`음이름 오류: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** 'F#m' → { root, notes } 뿌리음은 G3~F#4 근처 */
function parseChord(name) {
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
function chordAt(song, mb, s) {
  const entry = song.prog[((mb % song.prog.length) + song.prog.length) % song.prog.length];
  const parts = entry.trim().split(/\s+/);
  const idx = Math.min(parts.length - 1, Math.floor((s * parts.length) / STEPS_PER_BAR));
  return parseChord(parts[idx]);
}

/** melody 문자열 → [{ bar, step, midi, len }] (bar 는 melody 안에서의 마디 번호) */
function parseMelody(melody) {
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

function getLevel(id) {
  return LEVELS.find((l) => l.id === Number(id)) || null;
}

function beatDur(level) {
  return 60 / level.bpm;
}
function stepDur(level) {
  return beatDur(level) / 4;
}
function barDur(level) {
  return beatDur(level) * 4;
}

/** 곡 전체 길이(초): 카운트인 + 본편 + 아웃트로 */
function levelDuration(level) {
  return tempoOf(level).barStart(COUNT_IN_BARS + level.bars.length + OUTRO_BARS);
}

// ---------------------------------------------------------------
// 박자 시계: 마디마다 BPM 이 달라질 수 있음 (무제한 모드는 단계마다 빨라짐)
//   bar = 카운트인을 포함한 전체 마디 번호 (0 = 카운트인 첫 마디)
// ---------------------------------------------------------------
class TempoMap {
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
function tempoOf(level) {
  if (level.tempo) return level.tempo;
  let t = _tempos.get(level);
  if (!t) {
    t = new TempoMap(() => level.bpm, level.bpm);
    _tempos.set(level, t);
  }
  return t;
}

/** 이 단계에서 쓰는 악기들 (화면 왼쪽부터 순서) */
function levelLanes(level) {
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
function buildNotes(level, fromBar = 0, toBar = level.bars.length, pairStart = 0) {
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
const ROLL_HEART_HITS = 8;
const ROLL_MAX_HEARTS = 2;
const GOLD_SPOTS = [0.25, 0.5, 0.75];

function buildRolls(level) {
  if (!level.rolls) return [];
  const tempo = tempoOf(level);
  return level.rolls.map((r, i) => {
    const s0 = (COUNT_IN_BARS + r.bar) * STEPS_PER_BAR + r.from;
    return { id: i, lane: r.lane, t0: tempo.stepTime(s0), t1: tempo.stepTime(s0 + r.len), hits: 0, hearts: 0 };
  });
}

/** 노트 목록에 황금 콩 표시 (n.gold = true). 고른 노트 수 */
function markGoldNotes(notes) {
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

function noteCount(level) {
  let n = 0;
  for (const bar of level.bars) for (const c of bar) n += (CHAR_LANES[c] || []).length;
  return n;
}

/** 콤보 보너스: 50콤보까지 서서히 올라 최대 1.5배 */
function comboMultiplier(combo) {
  return 1 + Math.min(combo, 50) / 100;
}

function pointsFor(judge, comboAfter) {
  if (!POINTS[judge]) return 0;
  return Math.round(POINTS[judge] * comboMultiplier(comboAfter));
}

/** 전부 PERFECT 일 때 점수 */
function maxScore(level) {
  const n = noteCount(level);
  let s = 0;
  for (let c = 1; c <= n; c++) s += pointsFor('perfect', c);
  return s;
}

function judgedTotal(counts) {
  return (counts.perfect || 0) + (counts.great || 0) + (counts.good || 0) + (counts.miss || 0);
}

/** 정확도. 헛침(노트 없는데 누름)도 분모에 들어가서 마구 누르면 떨어짐 */
function accuracy(counts) {
  const total = judgedTotal(counts) + (counts.wrong || 0);
  if (!total) return 0;
  const w =
    (counts.perfect || 0) * ACC_WEIGHT.perfect +
    (counts.great || 0) * ACC_WEIGHT.great +
    (counts.good || 0) * ACC_WEIGHT.good;
  return w / total;
}

function gradeFor(counts) {
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
function starsFor(counts) {
  const a = accuracy(counts);
  const clean = !counts.miss && !counts.wrong && judgedTotal(counts) > 0;
  for (const r of STAR_RULES) if (a >= r.acc - 1e-9 && (!r.clean || clean)) return r.stars;
  return 0;
}

/** 판정 개수로 가능한 점수 범위 (서버의 점수 검증용) */
function scoreBounds(counts) {
  // 헛침은 점수를 주지도 깎지도 않음 (콤보만 끊김)
  const base =
    (counts.perfect || 0) * POINTS.perfect + (counts.great || 0) * POINTS.great + (counts.good || 0) * POINTS.good;
  return { min: Math.floor(base * 0.999), max: Math.ceil(base * comboMultiplier(Infinity)) };
}

// ---------------------------------------------------------------
// 진행 잠금: 앞 단계를 깨야(별 1개 이상) 다음 단계가 열림. 마지막 단계를 깨면 무제한 모드
// ---------------------------------------------------------------
/** 이 기록이 '깬' 기록인지 (별 1개 이상) */
function isClearBest(best) {
  return !!best && (best.stars || 0) >= 1;
}
const LAST_LEVEL_ID = LEVELS[LEVELS.length - 1].id;

/** 2026-11-17: 8단계에 '운명 교향곡'을 끼워 넣어서, 예전 8~14단계는 번호가 하나씩 밀림(9~15).
 *  저장된 기록 키('8', 'e8', 서버 칸 '-8')를 새 번호로 바꿔 줌. 예전 번호가 아니면 그대로. */
function shiftOldLevelKey(key) {
  const m = /^(e|-)?(\d+)$/.exec(String(key));
  if (!m) return key;
  const n = Number(m[2]);
  return n >= 8 && n <= 14 ? (m[1] || '') + (n + 1) : String(key);
}
/** 무제한 모드(그리그)는 13단계(터키 행진곡)를 깨면 열림 */
const ENDLESS_FROM = 13;
/** 1~3단계는 앞 단계를 안 깨도 바로 칠 수 있음 */
const FREE_LEVELS = 3;
/** bests = { [levelId]: best } 일 때 이 단계가 열려 있는지 (1~3단계는 항상)
 *  - 바로 앞 단계를 깨면 열림
 *  - 같은 난이도(입문·쉬움·보통·어려움·지옥) 단계를 하나라도 깨면 그 난이도는 전부 열림 (2026-11-18)
 *  단계별 무제한('e5' 등)은 그 단계를 깨면 열림 */
function isUnlocked(levelId, bests) {
  if (levelId === ENDLESS_ID) return isClearBest(bests[ENDLESS_FROM]);
  const base = levelEndlessBase(levelId);
  if (base) return isClearBest(bests[base.id]);
  if (levelId >= 1 && levelId <= FREE_LEVELS) return true;
  const prev = prevOpenId(levelId);
  if (prev === null || isClearBest(bests[prev])) return true;
  const lv = getLevel(levelId);
  return !!lv && LEVELS.some((l) => l.difficulty === lv.difficulty && isClearBest(bests[l.id]));
}
/** 같은 난이도 단계들 */
const tierOf = (levelId) => {
  const lv = getLevel(levelId);
  return lv ? LEVELS.filter((l) => l.difficulty === lv.difficulty).map((l) => l.id) : [];
};
/** 잠긴 단계 안내: 같은 난이도에 이미 열린 단계가 있으면 '그 난이도 하나만 깨면', 아니면 '앞 단계 깨면' */
function unlockHint(levelId, bests) {
  const lv = getLevel(levelId);
  if (!lv) return null;
  const word = DIFFICULTY_WORDS[lv.difficulty];
  const near = tierOf(levelId).some((id) => id !== lv.id && isUnlocked(id, bests));
  return near ? { tier: true, word, short: `${word} 단계 하나만 깨면 열림` } : { tier: false, word, prev: prevOpenId(levelId), short: `${prevOpenId(levelId)}단계 깨면 열림` };
}
/** 아직 안 깬 첫 단계 (잠긴 단계는 건너뜀. 다 깼으면 무제한 모드) */
function nextChallenge(bests) {
  const lv = LEVELS.find((l) => !SKIP_LEVELS.includes(l.id) && !isClearBest(bests[l.id]));
  return lv ? lv.id : ENDLESS_ID;
}

// ---------------------------------------------------------------
// 무제한 모드 / 레벨업 챌린지
//   한 판 안에서 Lv.1, Lv.2 … 로 올라감. 한 단계 = ROUND_BARS 마디, 단계마다 BPM +10 (끝없이)
//   패턴도 기본 쿵짝 → 8비트 → 엇박 → 필인 지옥 … 순서로 어려워짐
//   목숨이 다 떨어질 때까지 계속. 별 대신 다이아몬드 3개.
//   rounds 를 주면(영상 찍기용 레벨업 챌린지) 그 단계까지만 치고 끝남
// ---------------------------------------------------------------
const ENDLESS_ID = 'endless';
const ROUND_BARS = 4;
const ENDLESS_BASE_BPM = 90;
const ENDLESS_BPM_STEP = 10;

/** 다이아몬드: Lv.N 까지 깨면 (= Lv.N+1 도달) */
const DIAMOND_RULES = [
  { diamonds: 3, round: 10, text: 'Lv.10 클리어' },
  { diamonds: 2, round: 7, text: 'Lv.7 클리어' },
  { diamonds: 1, round: 4, text: 'Lv.4 클리어 (드러머 재능!)' },
];
function diamondsFor(roundsCleared) {
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
function roundBpm(round) {
  return ENDLESS_BASE_BPM + ENDLESS_BPM_STEP * (round - 1);
}
/** 단계 정보: { round, bpm, name, warn } */
function roundInfo(round) {
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
function roundBars(round, rand = Math.random) {
  const bpm = roundBpm(round);
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
function makeEndless({ rounds = Infinity, seed = (Math.random() * 2 ** 31) | 0 } = {}) {
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
        for (const bar of roundBars(r, rand)) {
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
    return roundBpm(r);
  });
  run.ensureBars(ROUND_BARS * 2);
  return run;
}

// ---------------------------------------------------------------
// 단계별 무제한 모드: 그 단계 곡·채보를 4마디씩 끝없이 이어 치고, 4마디마다 BPM +LEVEL_ENDLESS_STEP
//   id = 'e' + 단계 번호 (예: 'e13'). 그 단계를 깨면 열림. 다이아 기준은 그리그 무제한과 같음
// ---------------------------------------------------------------
const LEVEL_ENDLESS_STEP = 6;
const levelEndlessId = (id) => `e${id}`;
/** 'e13' → 13단계 레벨 (아니면 null) */
function levelEndlessBase(id) {
  const m = /^e(\d+)$/.exec(String(id));
  return m ? getLevel(Number(m[1])) : null;
}

function makeLevelEndless(base) {
  const bpmOf = (r) => base.bpm + LEVEL_ENDLESS_STEP * (r - 1);
  const run = {
    id: levelEndlessId(base.id),
    baseId: base.id,
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
        for (let i = 0; i < ROUND_BARS; i++) {
          this.bars.push(base.bars[((r - 1) * ROUND_BARS + i) % base.bars.length]);
          this.barMult.push(1 + 0.1 * (r - 1));
          this.barRound.push(r);
        }
      }
      return this.bars.length;
    },
    roundOfBar(mb) {
      if (mb < 0) return 1;
      return Math.floor(mb / ROUND_BARS) + 1;
    },
    /** 화면에 띄울 단계 정보 (그리그 무제한의 roundInfo 대신) */
    roundInfo(r) {
      return { round: r, bpm: bpmOf(r), name: r === 1 ? '원래 빠르기' : `${Math.round((bpmOf(r) / base.bpm) * 100)}% 빠르기`, warn: '' };
    },
  };
  run.tempo = new TempoMap((bar) => bpmOf(run.roundOfBar(bar - COUNT_IN_BARS)));
  run.ensureBars(ROUND_BARS * 2);
  return run;
}

return { STEPS_PER_BAR, KICK, SNARE, HAT, CRASH, TOM, INSTRUMENTS, CHAR_LANES, isLeftThumb, COUNT_IN_BARS, OUTRO_BARS, JUDGE, POINTS, ACC_WEIGHT, STAR_RULES, DIFFICULTY_WORDS, LEVELS, STUDIO_LEVELS, getStudioLevel, FREE_UPTO, VERIFY_LEVELS, needsVerify, CLOSED_LEVELS, SKIP_LEVELS, isClosed, prevOpenId, nextOpenId, noteToMidi, parseChord, chordAt, parseMelody, getLevel, beatDur, stepDur, barDur, levelDuration, TempoMap, tempoOf, levelLanes, buildNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS, GOLD_SPOTS, buildRolls, markGoldNotes, noteCount, comboMultiplier, pointsFor, maxScore, accuracy, gradeFor, starsFor, scoreBounds, isClearBest, LAST_LEVEL_ID, shiftOldLevelKey, ENDLESS_FROM, FREE_LEVELS, isUnlocked, tierOf, unlockHint, nextChallenge, ENDLESS_ID, ROUND_BARS, ENDLESS_BASE_BPM, ENDLESS_BPM_STEP, DIAMOND_RULES, diamondsFor, roundBpm, roundInfo, roundBars, makeEndless, LEVEL_ENDLESS_STEP, levelEndlessId, levelEndlessBase, makeLevelEndless };
})();

// ---- audio.js ----
const __m_audio = (() => {
// 오디오 엔진: 드럼은 Web Audio 합성, 곡(멜로디·화음·베이스)은 진짜 악기 샘플로 연주합니다.
//   피아노 샘플: Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) — public/audio/piano/
//   오케스트라 샘플: VS Chamber Orchestra Community Edition (Versilian Studios, CC0) — public/audio/orch/
//     바이올린·첼로 합주, 호른·트롬본, 튜바, 팀파니. 피아노는 박자가 또렷하게 들리게 같이 침
//   샘플을 못 불러오면 예전 합성음으로 대신 연주합니다.
// - 모든 박자 판정은 AudioContext 시계 기준 (setTimeout 보다 훨씬 정확)
// - heardTime(): "지금 스피커에서 나오고 있는 소리"의 시각. 출력 지연까지 반영.

const { STEPS_PER_BAR, COUNT_IN_BARS, OUTRO_BARS, tempoOf, parseMelody, chordAt, levelLanes, CHAR_LANES, KICK, SNARE, HAT, CRASH, TOM } = __m_charts;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeSilentWavUrl() {
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// 피아노 샘플: C · D# · F# · A (단3도 간격) → 가장 가까운 샘플을 최대 ±1.5음 올리고 내려서 씀
const PIANO_BASE = 'audio/piano.bin';
const PIANO_NOTES = [];
for (let o = 2; o <= 6; o++) for (const [n, pc] of [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]]) PIANO_NOTES.push({ file: `${n}${o}.mp3`, midi: 12 * (o + 1) + pc });
PIANO_NOTES.push({ file: 'C7.mp3', midi: 96 });
const PIANO_GAIN = 1.9; // 샘플이 합성음보다 작게 녹음돼 있어서 키움 (곡이 드럼에 묻히지 않게)

// 오케스트라 샘플 (파일 이름 = 악기_미디번호.mp3). 소리 크기는 파일마다 맞춰 둠
const ORCH_BASE = 'audio/orch.bin';

/** 묶음 파일(scripts/pack-audio.js) 하나를 받아 files 순서대로 ArrayBuffer 배열로 (없으면 null) */
async function fetchPack(url, files) {
  try {
    const r = await fetch(url);
    if (!r.ok) return files.map(() => null);
    const all = await r.arrayBuffer();
    const hl = new DataView(all).getUint32(0);
    const index = JSON.parse(new TextDecoder().decode(new Uint8Array(all, 4, hl)));
    const base = 4 + hl;
    return files.map((n) => {
      const e = index[n.file];
      return e ? all.slice(base + e[0], base + e[0] + e[1]) : null;
    });
  } catch {
    return files.map(() => null);
  }
}
const ORCH = {
  vln: [55, 57, 59, 62, 66, 69, 72, 76, 79, 83, 86],
  vc: [36, 40, 43, 47, 50, 53, 57, 60, 64],
  br: [43, 46, 50, 53, 57, 60, 61, 63, 65, 74, 77],
  tuba: [34, 39, 41, 46, 50],
  timp: [37, 42],
};
const ORCH_FILES = Object.entries(ORCH).flatMap(([k, list]) => list.map((midi) => ({ set: k, midi, file: `${k}_${midi}.mp3` })));
const ORCH_GAIN = { vln: 0.62, vc: 0.62, br: 0.55, tuba: 0.6, timp: 0.9 };

/** 샘플 앞의 무음 길이(초): 음이 실제로 시작하는 지점부터 틀어야 박자가 정확함 */
function onsetOf(buf) {
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.05;
  for (let i = 0; i < n; i++) if (Math.abs(d[i]) > th) return Math.max(0, i / buf.sampleRate - 0.002);
  return 0;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 0.8, sfx: 1 };
    this._clock = null;
    this.piano = null; // [{ midi, buf, offset }] 불러오면 채워짐
    this._pianoRaw = null;
    this._pianoLoading = null;
    this.orch = null; // { vln: [{ midi, buf, offset }], ... }
    this._orchRaw = null;
    this._orchLoading = null;
    /** 반주를 오케스트라로 (false 면 피아노만) */
    this.orchOn = true;
  }

  /** 오케스트라 샘플 미리 받기 (피아노 다음에) */
  prefetchOrch(base = ORCH_BASE) {
    if (this._orchRaw) return this._orchRaw;
    this._orchRaw = fetchPack(base, ORCH_FILES);
    return this._orchRaw;
  }

  /** 오케스트라 샘플 디코딩. 실패하면 false (피아노만으로 연주) */
  loadOrch() {
    if (this.orch) return Promise.resolve(true);
    if (this._orchLoading) return this._orchLoading;
    const ctx = this.ensure();
    this._orchLoading = this.prefetchOrch().then(async (raws) => {
      const out = {};
      for (const k of Object.keys(ORCH)) out[k] = [];
      let ok = 0;
      for (let i = 0; i < raws.length; i++) {
        const ab = raws[i];
        if (!ab) continue;
        try {
          const buf = await new Promise((res, rej) => {
            const p = ctx.decodeAudioData(ab.slice(0), res, rej);
            if (p && p.then) p.then(res, rej);
          });
          out[ORCH_FILES[i].set].push({ midi: ORCH_FILES[i].midi, buf, offset: onsetOf(buf) });
          ok++;
        } catch {}
      }
      if (ok < ORCH_FILES.length * 0.8 || Object.values(out).some((l) => !l.length)) {
        this._orchLoading = null;
        return false;
      }
      for (const l of Object.values(out)) l.sort((a, b) => a.midi - b.midi);
      this.orch = out;
      return true;
    });
    return this._orchLoading;
  }

  /** 지금 오케스트라로 칠 수 있나 */
  get orchestra() {
    return this.orchOn && !!this.orch;
  }

  /**
   * 오케스트라 악기 한 음. set = 'vln' | 'vc' | 'br' | 'tuba' | 'timp'
   * attack 초 동안 서서히 커지고, dur 뒤 release 로 잦아듦
   */
  orchNote(set, t, midi, dur, vel = 0.6, dest = this.musicBus, attack = 0.015, release = 0.18) {
    const list = this.orch && this.orch[set];
    if (!list || !list.length) return;
    const ctx = this.ctx;
    let s = list[0];
    for (const p of list) if (Math.abs(p.midi - midi) < Math.abs(s.midi - midi)) s = p;
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    const v = vel * ORCH_GAIN[set];
    const t0 = Math.max(t, ctx.currentTime);
    const end = t0 + Math.max(0.06, dur);
    if (attack > 0.002) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + attack);
    } else g.gain.setValueAtTime(v, t0);
    g.gain.setValueAtTime(v, Math.max(end, t0 + attack));
    g.gain.setTargetAtTime(0, Math.max(end, t0 + attack), release);
    src.connect(g).connect(dest);
    src.start(t0, s.offset);
    src.stop(Math.min(end + release * 6, t0 + s.buf.duration / src.playbackRate.value));
  }

  /** 피아노 샘플 파일 미리 받기 (AudioContext 없이도 가능 → 페이지 열자마자 호출) */
  prefetchPiano(base = PIANO_BASE) {
    if (this._pianoRaw) return this._pianoRaw;
    this._pianoRaw = fetchPack(base, PIANO_NOTES);
    return this._pianoRaw;
  }

  /** 피아노 샘플 디코딩. 실패해도 에러 없이 false (합성음으로 대신 연주) */
  loadPiano() {
    if (this.piano) return Promise.resolve(true);
    if (this._pianoLoading) return this._pianoLoading;
    const ctx = this.ensure();
    this._pianoLoading = this.prefetchPiano().then(async (raws) => {
      const out = [];
      await Promise.all(
        raws.map(async (ab, i) => {
          if (!ab) return;
          try {
            const buf = await new Promise((res, rej) => {
              const p = ctx.decodeAudioData(ab, res, rej);
              if (p && p.then) p.then(res, rej);
            });
            out.push({ midi: PIANO_NOTES[i].midi, buf, offset: onsetOf(buf) });
          } catch {}
        })
      );
      if (out.length < PIANO_NOTES.length * 0.8) {
        this._pianoLoading = null;
        return false;
      }
      out.sort((a, b) => a.midi - b.midi);
      this.piano = out;
      return true;
    });
    return this._pianoLoading;
  }

  /** 피아노 한 음. vel 0~1, dur 초 뒤에 건반을 뗌(댐퍼) */
  pianoNote(t, midi, dur, vel = 0.8, dest = this.musicBus) {
    const ctx = this.ctx;
    let s = this.piano[0];
    for (const p of this.piano) if (Math.abs(p.midi - midi) < Math.abs(s.midi - midi)) s = p;
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    const rel = t + Math.max(0.08, dur);
    const v = vel * PIANO_GAIN;
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, rel);
    g.gain.setTargetAtTime(0, rel, 0.08);
    src.connect(g).connect(dest);
    src.start(Math.max(t, ctx.currentTime), s.offset);
    src.stop(rel + 0.6);
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.gain.value = 0.95;
    this.master.connect(comp).connect(ctx.destination);
    this.out = comp;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    // 작은 방 울림(리버브): 드럼이 '방 안에서' 울리는 느낌
    try {
      const len = Math.floor(ctx.sampleRate * 1.1);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const verb = ctx.createConvolver();
      verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      verb.connect(wet).connect(this.master);
      const sendS = ctx.createGain();
      sendS.gain.value = 0.55;
      this.sfxBus.connect(sendS).connect(verb);
      const sendM = ctx.createGain();
      sendM.gain.value = 0.6;
      this.musicBus.connect(sendM).connect(verb);
    } catch {}
    this.applyVolumes();
    const len = ctx.sampleRate;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    return ctx;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.volumes.music * 0.5;
    this.sfxBus.gain.value = this.volumes.sfx * 1.0;
  }

  /** 반드시 사용자 터치 이벤트 안에서 호출 (iOS/인앱 브라우저 정책) */
  async unlock() {
    const ctx = this.ensure();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS 무음 스위치 우회 (Safari 17+)
    } catch {}
    if (!this._unlocked) {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      this._unlocked = true;
      // 구형 iOS: 무음 <audio> 를 틀어 두면 무음 스위치에서도 Web Audio 가 들림
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.audioSession) {
        try {
          const el = document.createElement('audio');
          el.setAttribute('playsinline', '');
          el.loop = true;
          el.src = makeSilentWavUrl();
          el.play().catch(() => {});
          this._silentEl = el;
        } catch {}
      }
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {}
    }
    return ctx.state === 'running';
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  resetClock() {
    this._clock = null;
  }

  /** 지금 귀에 들리는 소리의 AudioContext 시각. perfMs 를 주면 그 순간(터치 시각) 기준. */
  heardTime(perfMs = performance.now()) {
    const ctx = this.ctx;
    if (!ctx) return 0;
    if (ctx.state === 'running' && ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        const sample = ts.contextTime - ts.performanceTime / 1000;
        if (this._clock === null || Math.abs(sample - this._clock) > 0.04) this._clock = sample;
        else this._clock += (sample - this._clock) * 0.04;
        return Math.min(perfMs / 1000 + this._clock, ctx.currentTime);
      }
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  // ---------- 악기 ----------
  _noise(t, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.connect(dest);
    s.start(t, Math.random() * 0.5, dur + 0.05);
    return s;
  }

  /** 킥: 서브(낮은 둥) + 펀치 + 비터 클릭 */
  kick(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1 * vel, t + 0.003);
    g.gain.setValueAtTime(1.0 * vel, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.52);
    if (!this._sat) {
      this._sat = ctx.createWaveShaper();
      const c = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) c[i] = Math.tanh((i / 512 - 1) * 2.2);
      this._sat.curve = c;
      this._sat.connect(this.sfxBus);
    }
    const p = ctx.createOscillator();
    const pg = ctx.createGain();
    p.type = 'triangle';
    p.frequency.setValueAtTime(260, t);
    p.frequency.exponentialRampToValueAtTime(90, t + 0.04);
    pg.gain.setValueAtTime(0.5 * vel, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    p.connect(pg).connect(dest === this.sfxBus ? this._sat : dest);
    p.start(t);
    p.stop(t + 0.07);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.45 * vel, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    f.connect(cg).connect(dest);
    this._noise(t, 0.03, f);
  }

  /** 스네어: 통 울림(두 톤) + 스냅(밝은 노이즈) + 스네어 줄 떨림 */
  snare(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    for (const [fr, amp] of [[185, 0.5], [330, 0.28]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(fr * 1.25, t);
      o.frequency.exponentialRampToValueAtTime(fr, t + 0.03);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp * vel, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + 0.15);
    }
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    bp.connect(ng).connect(dest);
    this._noise(t, 0.14, bp);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.005);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    hp.connect(rg).connect(dest);
    this._noise(t, 0.28, hp);
  }

  /** 탐탐 (플로어 탐): 낮게 '둥' — 음이 살짝 내려가는 통 울림 + 가죽 치는 소리 */
  tom(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    for (const [fr, amp, dec] of [[130, 0.75, 0.42], [205, 0.22, 0.2]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(fr * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(fr, t + 0.06);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp * vel, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.001, t + dec);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + dec + 0.02);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    lp.connect(ng).connect(dest);
    this._noise(t, 0.06, lp);
  }

  /** 하이햇 (밴드가 쳐줌. 금속성 고음) */
  hat(t, vel = 0.5, open = false, dest = this.musicBus) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 10000;
    pk.gain.value = 6;
    const g = ctx.createGain();
    const d = open ? 0.3 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    hp.connect(pk).connect(g).connect(dest);
    this._noise(t, d + 0.02, hp);
  }

  /** 크래시 심벌 */
  crash(t = this.ctx.currentTime, dest = this.musicBus, vol = 0.5) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    hp.connect(g).connect(dest);
    this._noise(t, 0.9, hp);
    this._noise(t + 0.85, 0.8, hp);
  }

  /** 플레이어가 누른 악기 소리 (t 를 주면 그 시각에 예약) */
  playLane(lane, t = this.ctx.currentTime, dest = this.sfxBus) {
    if (lane === KICK) this.kick(t, 1, dest);
    else if (lane === SNARE) this.snare(t, 1, dest);
    else if (lane === HAT) this.hat(t, 1.6, false, dest);
    else if (lane === CRASH) this.crash(t, dest, 0.42);
    else if (lane === TOM) this.tom(t, 1, dest);
  }

  /** 결과 화면 별 하나 '띵!' (i = 0,1,2 갈수록 높아짐) */
  starChime(t = this.ctx.currentTime, i = 0) {
    const ctx = this.ctx;
    const base = [1046.5, 1318.5, 1568][Math.min(2, i)];
    const out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(this.sfxBus);
    for (const [mult, amp, decay] of [[1, 0.5, 0.9], [2, 0.18, 0.5], [3.01, 0.1, 0.3], [4.2, 0.06, 0.18]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * mult * 0.985, t);
      o.frequency.exponentialRampToValueAtTime(base * mult, t + 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    // 반짝이 (짧고 밝은 노이즈)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.12, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    hp.connect(ng).connect(out);
    this._noise(t, 0.27, hp);
  }

  /** 점수 올라가는 '따라라라' 한 알. p = 0~1 (갈수록 높아짐) */
  tick(t, p = 0) {
    const ctx = this.ctx;
    if (!this._tickBus) {
      this._tickBus = ctx.createGain();
      this._tickBus.connect(this.sfxBus);
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 700 * Math.pow(2, p * 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    o.connect(g).connect(this._tickBus);
    o.start(t);
    o.stop(t + 0.06);
  }

  /** 예약해 둔 '따라라라'를 바로 멈춤 (결과 연출 건너뛸 때) */
  silenceTicks() {
    if (!this._tickBus) return;
    try {
      this._tickBus.disconnect();
    } catch {}
    this._tickBus = null;
  }

  /** 점수 다 오르면 '딴!' (드럼 + 밝은 화음) */
  land(t = this.ctx.currentTime) {
    this.kick(t, 0.7);
    this.snare(t, 0.5);
    for (const m of [72, 79, 84]) {
      if (this.piano) this.pianoNote(t, m, 0.5, 0.5, this.sfxBus);
      else this.lead(t, m, 0.3, this.sfxBus);
    }
  }

  /** 별 3개 다 모으면 '짜잔' 화음 */
  fanfare(t = this.ctx.currentTime) {
    const notes = [72, 76, 79, 84];
    if (this.orchestra) {
      for (const m of [48, 55, 60, 64]) this.orchNote('br', t + 0.02, m, 1.1, 0.7, this.sfxBus, 0.03, 0.4);
      for (const m of [72, 76, 79]) this.orchNote('vln', t + 0.02, m, 1.2, 0.6, this.sfxBus, 0.03, 0.4);
      this.orchNote('timp', t, 36, 1.5, 0.9, this.sfxBus, 0, 0.5);
    }
    if (this.piano) {
      notes.forEach((m, k) => this.pianoNote(t + k * 0.06, m, 1.2, 0.7, this.sfxBus));
      return;
    }
    notes.forEach((m, k) => this.lead(t + k * 0.06, m, 1, this.sfxBus));
  }

  /** 별 0개 / 대결 패배: '띠로리' */
  aww(t = this.ctx.currentTime) {
    [[67, 0], [63, 0.22], [60, 0.44]].forEach(([m, d]) => {
      if (this.piano) this.pianoNote(t + d, m, 0.3, 0.55, this.sfxBus);
      else this.lead(t + d, m, 0.25, this.sfxBus);
    });
  }

  /** 녹화용 오디오 스트림 (게임 소리 전체) */
  captureStream() {
    const ctx = this.ensure();
    if (!this._streamDest) {
      this._streamDest = ctx.createMediaStreamDestination();
      this.out.connect(this._streamDest);
    }
    return this._streamDest.stream;
  }

  click(t, accent = false, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.45, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** 피아노로 lead/bass 를 vel 배율로 (오케스트라와 섞을 때 피아노는 조금 작게) */
  pianoOr(kind, t, midi, dur, dest, scale = 1) {
    if (!this.piano) return kind === 'bass' ? this.bass(t, midi, dur, dest) : this.lead(t, midi, dur, dest);
    if (kind === 'bass') return this.pianoNote(t, midi + 12, dur, 0.62 * scale, dest);
    return this.pianoNote(t, midi, dur, scale, dest);
  }

  /** 둥글고 부드러운 베이스 (킥처럼 '쿵' 하고 들리지 않게 어택을 느리게) */
  bass(t, midi, dur, dest = this.musicBus) {
    if (this.piano) return this.pianoNote(t, midi + 12, dur, 0.62, dest);
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = mtof(midi + 12);
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.03);
    g.gain.setValueAtTime(0.3, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pluck(t, midis, dur, dest = this.musicBus, scale = 1) {
    if (this.piano) {
      for (const m of midis) this.pianoNote(t, m, dur, 0.3 * scale, dest);
      return;
    }
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g).connect(dest);
    for (const m of midis) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  /** 멜로디: 건반 느낌(때리면 밝고 금방 잦아드는 소리)으로 곡이 또렷하게 들리게 */
  lead(t, midi, dur, dest = this.musicBus) {
    if (this.piano) return this.pianoNote(t, midi, dur, 1, dest);
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + Math.min(0.6, dur + 0.1));
    const g = ctx.createGain();
    const end = t + Math.max(0.08, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.18);
    g.gain.setTargetAtTime(0.05, t + 0.18, 0.4);
    g.gain.setValueAtTime(0.05, end - 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, end + 0.08);
    f.connect(g).connect(dest);
    for (const [type, mult, amp] of [['triangle', 1, 1], ['square', 1, 0.28], ['sine', 2, 0.22]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = mtof(midi) * mult;
      og.gain.value = amp;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(end + 0.1);
    }
  }
}

// ---------- 반주 ----------
// 곡 데이터(멜로디·코드)는 charts.js 의 level.song 에 있습니다.

/**
 * 한 판의 반주 재생기. lookahead 스케줄러로 AudioContext 시각에 정확히 예약.
 * startTime = 카운트인 첫 박의 AudioContext 시각.
 * 빠르기는 박자 시계(tempoOf)를 따름 → 무제한 모드처럼 단계마다 빨라져도 그대로 맞음.
 *
 * 오케스트라 편곡 (샘플을 받았고 설정이 '오케스트라'일 때):
 *   멜로디 = 피아노(박자 또렷하게) + 바이올린 합주
 *   화음   = 현악 패드(바이올린 + 첼로) / 곡이 달아오르면 호른·트롬본
 *   베이스 = 피아노 + 첼로, 절정에서 튜바
 *   팀파니 = 마디 첫 박 + 크래시 직전 롤
 *   곡 앞부분은 가볍게, 뒤로 갈수록(무제한 모드는 단계가 오를수록) 악기가 늘며 웅장해짐
 */
class SongPlayer {
  constructor(audio, level, startTime, { autoChart = false } = {}) {
    this.audio = audio;
    this.level = level;
    this.startTime = startTime;
    this.autoChart = autoChart;
    this.tempo = tempoOf(level);
    this.step = 0;
    this.melody = parseMelody(level.song.melody || []);
    this.melodyBars = (level.song.melody || []).length;
    const lanes = levelLanes(level);
    this.mineCrash = lanes.includes(CRASH); // 크래시를 내가 치면 반주 크래시는 쉼
    const ctx = audio.ctx;
    this.bus = ctx.createGain();
    this.bus.connect(audio.musicBus);
    this.drumBus = ctx.createGain();
    this.drumBus.connect(audio.sfxBus);
  }

  get totalSteps() {
    if (this.level.endless) return Infinity;
    return (COUNT_IN_BARS + this.level.bars.length + OUTRO_BARS) * STEPS_PER_BAR;
  }

  start() {
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  tick() {
    const horizon = this.audio.ctx.currentTime + 0.2;
    while (this.step < this.totalSteps) {
      const t = this.startTime + this.tempo.stepTime(this.step);
      if (t > horizon) break;
      if (t >= this.audio.ctx.currentTime - 0.01) this.scheduleStep(this.step, t);
      this.step++;
    }
    if (this.step >= this.totalSteps) clearInterval(this.timer);
  }

  /** 곡이 얼마나 달아올랐나 0.35 ~ 1 (악기 수가 늘어남) */
  intensity(mb) {
    const lv = this.level;
    if (lv.challenge) return Math.min(1, 0.35 + 0.15 * (lv.roundOfBar(mb) - 1));
    // epic 곡(15단계)은 처음부터 금관·팀파니·튜바가 총출동 (첫 두 마디만 살짝 낮춰 '빠바바밤' 을 또렷하게)
    if (lv.song.epic) return mb < 2 ? 0.65 : 1;
    const n = lv.bars.length;
    return mb < 4 ? 0.35 : mb < n / 2 ? 0.65 : 1;
  }

  scheduleStep(i, t) {
    const a = this.audio;
    const bar = Math.floor(i / STEPS_PER_BAR);
    const s = i % STEPS_PER_BAR;
    const song = this.level.song;
    const sd = this.tempo.barLen(bar) / STEPS_PER_BAR;
    const orch = a.orchestra;
    if (bar < COUNT_IN_BARS) {
      if (s % 4 === 0) a.click(t, s === 0, this.bus);
      return;
    }
    const mb = bar - COUNT_IN_BARS; // 본편 마디 번호
    if (mb >= this.level.bars.length && this.level.ensureBars) this.level.ensureBars(mb + 1);
    const chartBars = this.level.bars.length;
    const ch = chordAt(song, mb, s);

    if (mb >= chartBars) {
      // 아웃트로: 곡의 으뜸화음 한 방
      if (s === 0) {
        const home = chordAt(song, 0, 0);
        a.crash(t, this.bus);
        a.bass(t, home.root - 24, sd * 12, this.bus);
        a.pluck(t, home.notes, sd * 14, this.bus);
        const last = this.melody.filter((n) => n.bar === 0)[0];
        if (last) a.lead(t, home.root + 12 * Math.round((last.midi - home.root) / 12), sd * 10, this.bus);
        if (orch) {
          const d = sd * 14;
          for (const m of home.notes) a.orchNote('vln', t, m + 12, d, 0.5, this.bus, 0.01, 0.5);
          for (const m of home.notes) a.orchNote('br', t, m - 12, d, 0.6, this.bus, 0.01, 0.5);
          a.orchNote('vc', t, home.root - 12, d, 0.7, this.bus, 0.01, 0.5);
          a.orchNote('tuba', t, home.root - 24, d, 0.7, this.bus, 0.01, 0.5);
          a.orchNote('timp', t, this._timpPitch(home.root), 2, 0.9, this.bus, 0, 0.6);
        }
      }
      return;
    }

    const heat = this.intensity(mb);
    // 하이햇
    const hc = song.hat[s];
    if (hc === 'x' || hc === 'o') a.hat(t, s % 4 === 0 ? 0.6 : 0.35, hc === 'o', this.bus);
    // 베이스 (오케스트라면 첼로가 같이 받쳐줌)
    const bc = song.bass[s];
    if (bc && bc !== '.') {
      const m = ch.root - 24 + (bc === 'o' ? 12 : bc === '5' ? 7 : 0);
      if (orch) {
        a.pianoOr('bass', t, m, sd * 1.8, this.bus, 0.75);
        a.orchNote('vc', t, m + 12, Math.max(sd * 1.8, 0.22), 0.45 + 0.25 * heat, this.bus, 0.01, 0.12);
      } else a.bass(t, m, sd * 1.8, this.bus);
    }
    // 화음
    if (song.chord[s] === 'x') a.pluck(t, ch.notes, sd * 3, this.bus, orch ? 0.6 : 1);
    // 멜로디 (클래식 곡 주제 선율)
    if (this.melodyBars) {
      const mbar = mb % this.melodyBars;
      for (const n of this.melody) {
        if (n.bar !== mbar || n.step !== s) continue;
        const dur = n.len * sd * 0.92;
        if (!orch) {
          a.lead(t, n.midi, dur, this.bus);
          continue;
        }
        a.pianoOr('lead', t, n.midi, dur, this.bus, 0.72);
        // 바이올린 합주: 긴 음은 풍성하게, 16분음표 질주는 살짝만
        if (n.len >= 2) a.orchNote('vln', t, n.midi, n.len * sd, 0.55 + 0.3 * heat, this.bus, 0.03, 0.15);
        else a.orchNote('vln', t, n.midi, sd * 1.4, 0.3 + 0.15 * heat, this.bus, 0.004, 0.06);
        // 절정: 호른이 한 옥타브 아래로 멜로디를 같이 (긴 음만. epic 곡은 8분음표까지)
        const epic = !!song.epic;
        if (heat >= 1 && n.len >= (epic ? 2 : 4) && n.midi - 12 >= 45) a.orchNote('br', t, n.midi - 12, Math.max(n.len * sd, 0.2), epic ? 0.5 : 0.4, this.bus, 0.03, 0.15);
        // epic: 짧은 음마다 팀파니가 같이 '두두두 쿵' 말발굽처럼 받쳐 줌
        if (epic && heat >= 0.65 && n.len <= 2) a.orchNote('timp', t, this._timpPitch(ch.root), 0.6, 0.38, this.bus, 0, 0.3);
      }
    }
    if (orch) this._orchestra(mb, s, t, sd, ch, heat);
    // 8마디마다 크래시
    if (s === 0 && mb > 0 && mb % 8 === 0 && !this.mineCrash) a.crash(t, this.bus);
    // 자동 연주(데모/릴스 녹화용)
    if (this.autoChart) {
      for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
    }
  }

  /** 팀파니 음높이: 뿌리음을 C2~B2 근처로 */
  _timpPitch(root) {
    let m = root;
    while (m > 44) m -= 12;
    while (m < 33) m += 12;
    return m;
  }

  /** 현악 패드 · 금관 · 튜바 · 팀파니 */
  _orchestra(mb, s, t, sd, ch, heat) {
    const a = this.audio;
    const song = this.level.song;
    const entry = song.prog[((mb % song.prog.length) + song.prog.length) % song.prog.length];
    const parts = entry.trim().split(/\s+/).length;
    const partLen = STEPS_PER_BAR / parts;
    // 코드가 바뀌는 자리마다 현악 패드
    if (s % partLen === 0) {
      const d = partLen * sd;
      const pv = 0.22 + 0.16 * heat;
      for (const m of ch.notes.slice(0, 3)) a.orchNote('vln', t, m, d, pv, this.bus, Math.min(0.12, d * 0.25), 0.25);
      a.orchNote('vc', t, ch.root - 12, d, pv + 0.1, this.bus, Math.min(0.1, d * 0.2), 0.25);
      // 금관: 달아오르면 코드 첫 자리마다, 그 전엔 4마디마다 한 번
      if (heat >= 1 || (heat >= 0.65 && s === 0 && mb % 4 === 0)) {
        const bv = heat >= 1 ? 0.42 : 0.32;
        for (const m of [ch.root - 12, ch.notes[1] - 12, ch.notes[2] - 12]) a.orchNote('br', t, m, d * 0.95, bv, this.bus, 0.04, 0.2);
      }
    }
    // 튜바: 절정에서 마디 첫 박
    if (heat >= 1 && s === 0) a.orchNote('tuba', t, ch.root - 24, 16 * sd * 0.85, 0.55, this.bus, 0.02, 0.2);
    // 팀파니
    const tp = this._timpPitch(ch.root);
    if (heat >= 0.65 && s === 0) a.orchNote('timp', t, tp, 1.5, heat >= 1 ? 0.75 : 0.5, this.bus, 0, 0.5);
    if (heat >= 1 && s === 8) a.orchNote('timp', t, tp, 1, 0.45, this.bus, 0, 0.4);
    // 크래시 나오기 직전 마디 끝: 팀파니 롤 (두두두두 → 쾅)
    const toCrash = (mb + 1) % 8 === 0 && (this.level.endless || mb + 1 < this.level.bars.length);
    if (heat >= 0.65 && toCrash && s >= 12) a.orchNote('timp', t, tp, 0.5, 0.3 + (s - 12) * 0.12, this.bus, 0, 0.12);
  }

  stop(fade = 0.15) {
    clearInterval(this.timer);
    const ctx = this.audio.ctx;
    const now = ctx.currentTime;
    for (const b of [this.bus, this.drumBus]) {
      try {
        b.gain.cancelScheduledValues(now);
        b.gain.setValueAtTime(b.gain.value, now);
        b.gain.linearRampToValueAtTime(0, now + fade);
      } catch {}
    }
    setTimeout(() => {
      try {
        this.bus.disconnect();
        this.drumBus.disconnect();
      } catch {}
    }, fade * 1000 + 300);
  }
}

/** 싱크 보정용 메트로놈: count 번 클릭, 각 클릭의 AudioContext 시각 배열 반환 */
function playMetronome(audio, bpm = 100, count = 12) {
  const ctx = audio.ctx;
  const t0 = ctx.currentTime + 0.4;
  const beat = 60 / bpm;
  const times = [];
  for (let i = 0; i < count; i++) {
    const t = t0 + i * beat;
    audio.click(t, i % 4 === 0, audio.sfxBus);
    times.push(t);
  }
  return times;
}

return { AudioEngine, SongPlayer, playMetronome };
})();

// ---- mascot.js ----
const __m_mascot = (() => {
// 오케이스트라 마스코트 — 쿵콩이(킥) / 짝콩이(스네어)
// SVG 하나로 화면(DOM)과 게임(캔버스) 양쪽에 같은 그림을 씁니다.

const OUTLINE = '#2B1D3A';

const MASCOTS = {
  kong: { name: '쿵콩이', body: '#FFD3A1', hi: '#FFF3E2', shade: '#EFA567', leaf: '#7BD66A', leafDark: '#4FA845' },
  jjak: { name: '짝콩이', body: '#BDF0DE', hi: '#F2FFFA', shade: '#74CDB5', leaf: '#8EE07A', leafDark: '#52AE4A' },
};

const DRUMS = {
  // 쿵(킥): 코랄 몸통 + 크림색 지그재그 끈
  kong: { body: '#FF8E6B', bodyDark: '#D9603F', deco: '#FFF1D6', rim: '#FFFFFF', rimDark: '#C9B9A6', height: 92, style: 'rope' },
  // 짝(스네어): 하늘색 몸통 + 흰 물방울 무늬
  jjak: { body: '#7FC8FF', bodyDark: '#4A97D6', deco: '#FFFFFF', rim: '#FFFFFF', rimDark: '#B4C3D6', height: 74, style: 'dots' },
};

let uid = 0;

function sprout(kind, p) {
  const o = OUTLINE;
  if (kind === 'kong') {
    return `
    <path d="M100 46 C 98 34 100 26 104 17" stroke="${o}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M100 46 C 98 34 100 26 104 17" stroke="${p.leafDark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M104 20 C 114 4 138 4 146 13 C 137 27 116 31 104 20 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M110 19 C 120 14 130 12 138 13" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M101 24 C 91 10 69 10 61 19 C 69 32 89 35 101 24 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>`;
  }
  // 짝콩이: 큰 잎 하나 + 동그란 꽃봉오리
  return `
    <path d="M100 46 C 101 34 98 25 93 17" stroke="${o}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M100 46 C 101 34 98 25 93 17" stroke="${p.leafDark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M95 20 C 84 2 58 2 50 12 C 59 28 82 33 95 20 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M89 18 C 79 13 69 11 60 12" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="112" cy="22" r="10" fill="#FFB3C7" stroke="${o}" stroke-width="5"/>
    <circle cx="109" cy="19" r="3" fill="#fff" fill-opacity=".8"/>`;
}

function face(type) {
  const o = OUTLINE;
  const blush = `
    <ellipse cx="54" cy="139" rx="12" ry="7.5" fill="#FF8FA8" opacity=".6"/>
    <ellipse cx="146" cy="139" rx="12" ry="7.5" fill="#FF8FA8" opacity=".6"/>`;
  if (type === 'hit') {
    return `${blush}
    <path d="M63 122 Q74 106 85 122" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M115 122 Q126 106 137 122" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M86 132 Q100 130 114 132 Q112 156 100 156 Q88 156 86 132 Z" fill="#7A2840" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="149" rx="8" ry="4.5" fill="#FF7E95"/>`;
  }
  if (type === 'miss') {
    return `${blush}
    <path d="M64 109 L83 118 L64 127" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M136 109 L117 118 L136 127" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M86 143 Q93 136 100 143 Q107 150 114 143" stroke="${o}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M160 70 C 152 84 152 94 160 97 C 168 94 168 84 160 70 Z" fill="#8FD3FF" stroke="${o}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (type === 'cheer') {
    // 반짝 별 눈
    const star = (cx, cy) =>
      `<path d="M${cx} ${cy - 13} L${cx + 4} ${cy - 4} L${cx + 13} ${cy} L${cx + 4} ${cy + 4} L${cx} ${cy + 13} L${cx - 4} ${cy + 4} L${cx - 13} ${cy} L${cx - 4} ${cy - 4} Z" fill="${o}"/>
       <circle cx="${cx + 2}" cy="${cy - 3}" r="2.5" fill="#fff"/>`;
    return `${blush}${star(74, 117)}${star(126, 117)}
    <path d="M86 132 Q100 130 114 132 Q112 156 100 156 Q88 156 86 132 Z" fill="#7A2840" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="149" rx="8" ry="4.5" fill="#FF7E95"/>`;
  }
  // idle
  return `${blush}
    <ellipse cx="74" cy="118" rx="9.5" ry="12.5" fill="${o}"/>
    <ellipse cx="126" cy="118" rx="9.5" ry="12.5" fill="${o}"/>
    <circle cx="77.5" cy="112.5" r="4" fill="#fff"/>
    <circle cx="129.5" cy="112.5" r="4" fill="#fff"/>
    <circle cx="71" cy="123" r="1.8" fill="#fff" opacity=".8"/>
    <circle cx="123" cy="123" r="1.8" fill="#fff" opacity=".8"/>
    <path d="M90 136 Q95 143 100 136 Q105 143 110 136" stroke="${o}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** 마스코트 SVG 문자열. viewBox 200x200, 몸 바닥이 y≈188 */
function mascotSVG(kind = 'kong', type = 'idle', size = 200) {
  const p = MASCOTS[kind];
  const id = `m${kind}${++uid}`;
  const o = OUTLINE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}" cx="36%" cy="30%" r="80%">
      <stop offset="0" stop-color="${p.hi}"/>
      <stop offset=".5" stop-color="${p.body}"/>
      <stop offset="1" stop-color="${p.shade}"/>
    </radialGradient>
  </defs>
  ${sprout(kind, p)}
  <path d="M100 40 C 152 40 183 84 183 130 C 183 170 148 189 100 189 C 52 189 17 170 17 130 C 17 84 48 40 100 40 Z" fill="url(#${id})" stroke="${o}" stroke-width="6"/>
  <ellipse cx="64" cy="74" rx="17" ry="9" fill="#fff" opacity=".6" transform="rotate(-32 64 74)"/>
  <circle cx="86" cy="62" r="4" fill="#fff" opacity=".6"/>
  ${face(type)}
  <ellipse cx="30" cy="172" rx="17" ry="12.5" fill="${p.body}" stroke="${o}" stroke-width="5.5"/>
  <ellipse cx="170" cy="172" rx="17" ry="12.5" fill="${p.body}" stroke="${o}" stroke-width="5.5"/>
</svg>`;
}

/** 드럼 SVG. viewBox 240x200, 헤드 중심 (120,56) rx110 ry40 */
const DRUM_VIEW = { w: 240, h: 200, cx: 120, cy: 56, rx: 110, ry: 40 };

function drumSVG(kind = 'kong', size = 240) {
  const d = DRUMS[kind];
  const { cx, cy, rx, ry } = DRUM_VIEW;
  const h = d.height;
  const id = `d${kind}${++uid}`;
  const L = cx - rx;
  const R = cx + rx;
  const yb = cy + h;
  const front = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  let deco = '';
  if (d.style === 'rope') {
    // 지그재그 끈 (위 테두리와 아래 테두리 사이)
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const x = L + 8 + ((R - L - 16) * i) / n;
      const top = cy + front(x) + 12;
      const bot = yb + front(x) - 16;
      pts.push(`${x.toFixed(1)},${(i % 2 ? bot : top).toFixed(1)}`);
    }
    deco = `<polyline points="${pts.join(' ')}" fill="none" stroke="${OUTLINE}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${d.deco}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else {
    const dots = [];
    [[-0.62, 0.35], [-0.2, 0.62], [0.25, 0.32], [0.65, 0.6], [-0.75, 0.75], [0.0, 0.2]].forEach(([fx, fy]) => {
      const x = cx + rx * fx;
      const y = cy + front(x) + (h - 6) * fy;
      const r = 7 * Math.sqrt(1 - fx * fx) + 2;
      dots.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.9).toFixed(1)}" fill="${d.deco}" opacity=".9"/>`);
    });
    deco = dots.join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="${size}" height="${(size * 200) / 240}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" x2="1">
      <stop offset="0" stop-color="${d.bodyDark}"/>
      <stop offset=".25" stop-color="${d.body}"/>
      <stop offset=".65" stop-color="${d.body}"/>
      <stop offset="1" stop-color="${d.bodyDark}"/>
    </linearGradient>
    <clipPath id="${id}c"><path d="M${L} ${cy} L${L} ${yb} A${rx} ${ry} 0 0 0 ${R} ${yb} L${R} ${cy} Z"/></clipPath>
  </defs>
  <ellipse cx="${cx}" cy="${yb + ry - 2}" rx="${rx * 0.95}" ry="${ry * 0.45}" fill="${OUTLINE}" opacity=".18"/>
  <path d="M${L} ${cy} L${L} ${yb} A${rx} ${ry} 0 0 0 ${R} ${yb} L${R} ${cy} Z" fill="url(#${id}b)" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
  <g clip-path="url(#${id}c)">${deco}</g>
  <path d="M${L} ${yb - 9} A${rx} ${ry} 0 0 0 ${R} ${yb - 9} L${R} ${yb} A${rx} ${ry} 0 0 1 ${L} ${yb} Z" fill="${d.rim}" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${d.rim}" stroke="${OUTLINE}" stroke-width="5"/>
  <ellipse cx="${cx}" cy="${cy + 1}" rx="${rx - 11}" ry="${ry - 7}" fill="#FFFBF2" stroke="${d.rimDark}" stroke-width="2.5"/>
  <ellipse cx="${cx - 28}" cy="${cy - 6}" rx="30" ry="7" fill="#fff" opacity=".9"/>
</svg>`;
}

/** 드럼 스틱 (가로로 눕힌 상태, 손잡이가 왼쪽). viewBox 120x24 */
function stickSVG(size = 120) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 24" width="${size}" height="${(size * 24) / 120}" aria-hidden="true">
  <path d="M6 12 L104 9.5 L104 14.5 Z" fill="#E9B97A" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="2" y="7" width="34" height="10" rx="5" fill="#C98E52" stroke="${OUTLINE}" stroke-width="3.5"/>
  <circle cx="106" cy="12" r="8" fill="#FFF3DF" stroke="${OUTLINE}" stroke-width="3.5"/>
</svg>`;
}

/** 베이스드럼(킥) 정면. viewBox 200x210, 중심 (100,100) r=92 */
function bassDrumSVG(size = 200) {
  const id = `bd${++uid}`;
  const lugs = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 10;
    const x = 100 + Math.cos(a) * 86;
    const y = 100 + Math.sin(a) * 86;
    lugs.push(`<rect x="${(x - 4).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="8" height="14" rx="3" fill="#E8E6F0" stroke="${OUTLINE}" stroke-width="2.5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 210" width="${size}" height="${(size * 210) / 200}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}h" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#FFFDF7"/><stop offset="1" stop-color="#EFE4D2"/></radialGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A5C"/><stop offset="1" stop-color="#D84E2E"/></linearGradient>
  </defs>
  <path d="M46 168 L22 206 M154 168 L178 206" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round"/>
  <path d="M46 168 L22 206 M154 168 L178 206" stroke="#D9D6E6" stroke-width="4" stroke-linecap="round"/>
  <circle cx="100" cy="100" r="94" fill="url(#${id}r)" stroke="${OUTLINE}" stroke-width="6"/>
  ${lugs.join('')}
  <circle cx="100" cy="100" r="78" fill="url(#${id}h)" stroke="${OUTLINE}" stroke-width="5"/>
  <circle cx="100" cy="100" r="54" fill="none" stroke="#FF8A5C" stroke-width="7"/>
  <circle cx="100" cy="100" r="54" fill="none" stroke="${OUTLINE}" stroke-width="2" opacity=".35"/>
  <path d="M100 118 C 99 106 100 98 103 90" stroke="${OUTLINE}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M100 118 C 99 106 100 98 103 90" stroke="#4FA845" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M103 92 C 112 78 130 79 135 86 C 128 97 112 100 103 92 Z" fill="#7BD66A" stroke="${OUTLINE}" stroke-width="4"/>
  <path d="M100 95 C 91 82 73 82 68 89 C 75 100 91 103 100 95 Z" fill="#7BD66A" stroke="${OUTLINE}" stroke-width="4"/>
  <circle cx="138" cy="140" r="11" fill="${OUTLINE}" opacity=".85"/>
  <ellipse cx="70" cy="60" rx="22" ry="9" fill="#fff" opacity=".8" transform="rotate(-30 70 60)"/>
</svg>`;
}

/** 스네어(옆에서 살짝 위) + 스탠드. viewBox 240x230, 헤드 중심 (120,52) rx104 ry30 */
const SNARE_VIEW = { w: 240, h: 230, cx: 120, cy: 52, rx: 104, ry: 30 };
function snareSVG(size = 240) {
  const { cx, cy, rx, ry } = SNARE_VIEW;
  const h = 58;
  const L = cx - rx;
  const R = cx + rx;
  const yb = cy + h;
  const id = `sn${++uid}`;
  const front = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
  const lugs = [-0.75, -0.37, 0, 0.37, 0.75]
    .map((f) => {
      const x = cx + rx * f;
      const w = 10 * Math.sqrt(1 - f * f) + 3;
      const y1 = cy + front(x) + 10;
      return `<rect x="${(x - w / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${h - 20}" rx="${(w / 2).toFixed(1)}" fill="#F4F2FA" stroke="${OUTLINE}" stroke-width="2.5"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 230" width="${size}" height="${(size * 230) / 240}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" x2="1">
      <stop offset="0" stop-color="#2F86CF"/><stop offset=".25" stop-color="#6CC6FF"/><stop offset=".45" stop-color="#C9ECFF"/><stop offset=".6" stop-color="#6CC6FF"/><stop offset="1" stop-color="#2F86CF"/>
    </linearGradient>
  </defs>
  <path d="M120 ${yb + ry} L120 200 M120 196 L72 226 M120 196 L168 226 M120 196 L120 228" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round"/>
  <path d="M120 ${yb + ry} L120 200 M120 196 L72 226 M120 196 L168 226 M120 196 L120 228" stroke="#D9D6E6" stroke-width="4" stroke-linecap="round"/>
  <path d="M${L} ${cy} L${L} ${yb} A${rx} ${ry} 0 0 0 ${R} ${yb} L${R} ${cy} Z" fill="url(#${id}b)" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
  ${lugs}
  <path d="M${L} ${yb - 7} A${rx} ${ry} 0 0 0 ${R} ${yb - 7} L${R} ${yb} A${rx} ${ry} 0 0 1 ${L} ${yb} Z" fill="#E8E6F0" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#E8E6F0" stroke="${OUTLINE}" stroke-width="5"/>
  <ellipse cx="${cx}" cy="${cy + 1}" rx="${rx - 10}" ry="${ry - 6}" fill="#FFFCF5" stroke="#B9B4C8" stroke-width="2"/>
  <ellipse cx="${cx - 26}" cy="${cy - 5}" rx="28" ry="6" fill="#fff"/>
</svg>`;
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function rasterize(svg, w, h) {
  const img = await svgToImage(svg);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * 캔버스용 래스터 묶음. pxSize = 마스코트 한 변 픽셀(디바이스 픽셀).
 * { kong: {idle,hit,miss,cheer}, jjak: {...}, drum: {kong, jjak} }
 */
async function buildRasters(mascotPx, drumPx) {
  const out = { kong: {}, jjak: {}, drum: {} };
  const jobs = [];
  for (const kind of ['kong', 'jjak']) {
    for (const type of ['idle', 'hit', 'miss', 'cheer']) {
      jobs.push(rasterize(mascotSVG(kind, type, mascotPx), mascotPx, mascotPx).then((c) => (out[kind][type] = c)));
    }
    jobs.push(rasterize(drumSVG(kind, drumPx), drumPx, (drumPx * 200) / 240).then((c) => (out.drum[kind] = c)));
  }
  jobs.push(rasterize(bassDrumSVG(drumPx), drumPx, (drumPx * 210) / 200).then((c) => (out.bass = c)));
  jobs.push(rasterize(snareSVG(drumPx), drumPx, (drumPx * 230) / 240).then((c) => (out.snare = c)));
  const sp = Math.round(drumPx * 0.9);
  jobs.push(rasterize(stickSVG(sp), sp, (sp * 24) / 120).then((c) => (out.stick = c)));
  await Promise.all(jobs);
  return out;
}

return { OUTLINE, MASCOTS, DRUMS, mascotSVG, DRUM_VIEW, drumSVG, stickSVG, bassDrumSVG, SNARE_VIEW, snareSVG, buildRasters };
})();

// ---- kit3d.js ----
const __m_kit3d = (() => {
// 3D 느낌 드럼 세트 그림 (Canvas 2D 로 원통 음영·금속 반사·광택을 직접 그려 스프라이트로 만들어 둠)
//   킥 = 베이스드럼 정면(위에서 살짝 내려다봐서 통 윗면이 보임), 스네어 = 위에서 비스듬히 본 원통 + 스탠드,
//   심벌 = 선반 자국(lathe) + 비스듬한 금속 반사. 노트도 같은 재질로 입체(막대·작은 드럼·작은 심벌).
// 스프라이트: { img, w, h, ax, ay } (CSS px). 그릴 때 drawImage(img, x - ax, y - ay, w, h)

const TAU = Math.PI * 2;
const OUT = 'rgba(12,8,20,0.85)';

const METAL = {
  chrome: ['#4E5462', '#C9CED8', '#FFFFFF', '#8E95A3', '#E6E9EF', '#5E6472'],
  gold: ['#5E3E0C', '#D9A93C', '#FFF2C0', '#A87A22', '#F2CF6A', '#6E4A12'],
  black: ['#060608', '#34363E', '#8A8E99', '#1A1B20', '#3E414A', '#08080A'],
};
const CYM = {
  gold: { dark: '#6E4A12', mid: '#C8932F', light: '#FFE7A6', groove: '120,80,20' },
  silver: { dark: '#4C5160', mid: '#AEB5C3', light: '#FFFFFF', groove: '60,66,80' },
  dark: { dark: '#1E1812', mid: '#5A4834', light: '#B89A6C', groove: '20,14,8' },
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function sprite(w, h, ax, ay, dpr, fn) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(ax, ay);
  fn(g);
  return { img: c, w, h, ax, ay };
}

function metalGrad(g, x0, x1, tone = 'chrome', y = 0) {
  const m = METAL[tone] || METAL.chrome;
  const gr = g.createLinearGradient(x0, y, x1, y);
  [0, 0.16, 0.3, 0.52, 0.76, 1].forEach((p, i) => gr.addColorStop(p, m[i]));
  return gr;
}

/** 원통 음영: 가장자리 어둡게 + 왼쪽 위 반사 줄 (재질 위에 덮어 씀) */
function cylShade(g, x0, x1, y0, y1, strength = 1) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, `rgba(0,0,0,${0.55 * strength})`);
  gr.addColorStop(0.14, `rgba(0,0,0,${0.12 * strength})`);
  gr.addColorStop(0.24, 'rgba(255,255,255,0)');
  gr.addColorStop(0.3, `rgba(255,255,255,${0.55 * strength})`);
  gr.addColorStop(0.335, `rgba(255,255,255,${0.12 * strength})`);
  gr.addColorStop(0.62, 'rgba(0,0,0,0)');
  gr.addColorStop(0.86, `rgba(0,0,0,${0.3 * strength})`);
  gr.addColorStop(1, `rgba(0,0,0,${0.62 * strength})`);
  g.fillStyle = gr;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** 통 재질 칠하기 (이미 clip 된 상태). colors = [밝은, 기본, 어두운] */
function paintFinish(g, finish, colors, x0, x1, y0, y1, opt = {}) {
  const [li, base, dk] = colors;
  const w = x1 - x0;
  const h = y1 - y0;
  if (finish === 'fade') {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, li);
    gr.addColorStop(0.45, base);
    gr.addColorStop(1, dk);
    g.fillStyle = gr;
  } else if (finish === 'metal') {
    g.fillStyle = metalGradFrom(g, x0, x1, colors);
  } else {
    g.fillStyle = base;
  }
  g.fillRect(x0, y0, w, h);
  if (finish === 'wood') {
    const r = rng(7);
    g.lineWidth = Math.max(0.6, w * 0.004);
    for (let i = 0; i < 46; i++) {
      const x = x0 + r() * w;
      g.strokeStyle = r() < 0.5 ? `rgba(70,30,8,${0.12 + r() * 0.18})` : `rgba(255,220,170,${0.08 + r() * 0.12})`;
      g.beginPath();
      g.moveTo(x, y0);
      const amp = w * 0.01 * (0.5 + r());
      for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(k * 1.3 + i) * amp, y0 + (h * k) / 8);
      g.stroke();
    }
  }
  if (finish === 'sparkle' || opt.sparkle) {
    const r = rng(11);
    const n = Math.round((w * h) / 30);
    const col = opt.sparkle || li;
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.15 + r() * 0.55;
      const s = Math.max(0.6, w * 0.006 * (0.4 + r()));
      g.fillRect(x0 + r() * w, y0 + r() * h, s, s);
    }
    g.globalAlpha = 1;
  }
}

function metalGradFrom(g, x0, x1, [li, base, dk]) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, dk);
  gr.addColorStop(0.18, base);
  gr.addColorStop(0.3, li);
  gr.addColorStop(0.5, base);
  gr.addColorStop(0.76, li);
  gr.addColorStop(1, dk);
  return gr;
}

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
}

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  w = Math.max(0.1, w);
  h = Math.max(0.1, h);
  if (g.roundRect) g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  else g.rect(x, y, w, h);
}

function floorShadow(g, x, y, rx, ry, a = 0.55) {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(0,0,0,${a})`);
  gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.45})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

/** 금속 막대 (스탠드·다리) */
function rod(g, x1, y1, x2, y2, w, tone) {
  g.lineCap = 'round';
  g.strokeStyle = OUT;
  g.lineWidth = w + 2;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  const m = METAL[tone] || METAL.chrome;
  g.strokeStyle = m[1];
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = m[2];
  g.globalAlpha = 0.7;
  g.lineWidth = w * 0.35;
  g.beginPath();
  g.moveTo(x1 - w * 0.2, y1);
  g.lineTo(x2 - w * 0.2, y2);
  g.stroke();
  g.globalAlpha = 1;
}

/** 브랜드 새싹 엠블럼 */
function sprout(g, s, leaf = '#7BD66A', dark = '#3F8F38') {
  g.lineCap = 'round';
  g.strokeStyle = dark;
  g.lineWidth = s * 0.09;
  g.beginPath();
  g.moveTo(0, s * 0.35);
  g.quadraticCurveTo(-s * 0.03, 0, s * 0.06, -s * 0.18);
  g.stroke();
  g.fillStyle = leaf;
  g.strokeStyle = dark;
  g.lineWidth = s * 0.05;
  for (const sg of [1, -1]) {
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.12);
    g.bezierCurveTo(sg * s * 0.25, -s * 0.5, sg * s * 0.62, -s * 0.38, sg * s * 0.6, -s * 0.22);
    g.bezierCurveTo(sg * s * 0.5, -s * 0.02, sg * s * 0.2, 0, s * 0.04, -s * 0.12);
    g.fill();
    g.stroke();
  }
}

// ---------------------------------------------------------------- 킥
/** 베이스드럼 정면. R = 앞 헤드(테 포함) 반지름. 기준점 = 헤드 가운데 */
function drawKick(g, R, kit) {
  const d = R * 0.36; // 통 깊이가 위로 보이는 만큼
  const Rb = R * 0.965;
  floorShadow(g, 0, R * 1.0, R * 1.25, R * 0.22, 0.65);
  // 다리(스퍼)
  for (const s of [-1, 1]) rod(g, s * R * 0.72, R * 0.2, s * R * 1.12, R * 1.0, R * 0.07, kit.hw);
  for (const s of [-1, 1]) {
    ellipse(g, s * R * 1.12, R * 1.0, R * 0.09, R * 0.045);
    g.fillStyle = '#16131C';
    g.fill();
  }
  // 통(뒤 테 → 앞 테까지)
  g.save();
  g.beginPath();
  g.arc(0, -d, Rb, Math.PI, 0);
  g.lineTo(R, 0);
  g.arc(0, 0, R, 0, Math.PI);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.clip();
  paintFinish(g, kit.finish, kit.shell, -R, R, -d - R, R, { sparkle: kit.sparkle });
  cylShade(g, -R, R, -d - R, R, 0.9);
  // 위에서 빛: 통 윗부분 밝게
  const top = g.createLinearGradient(0, -d - Rb, 0, -d + R * 0.2);
  top.addColorStop(0, 'rgba(255,255,255,0.35)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = top;
  g.fillRect(-R, -d - Rb, R * 2, R);
  g.restore();
  // 통 윗면 반사 줄
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = R * 0.035;
  g.beginPath();
  g.arc(0, -d * 0.55, R * 0.985, Math.PI * 1.18, Math.PI * 1.5);
  g.stroke();
  g.restore();
  // 뒤 테 (위쪽만 보임)
  g.lineWidth = R * 0.09;
  g.strokeStyle = OUT;
  g.beginPath();
  g.arc(0, -d, Rb, Math.PI * 1.02, Math.PI * 1.98);
  g.stroke();
  g.lineWidth = R * 0.06;
  g.strokeStyle = kit.hoop[1];
  g.stroke();
  g.lineWidth = R * 0.018;
  g.strokeStyle = kit.inlay;
  g.stroke();
  // 러그 (통 위쪽 띠에 박힌 금속)
  for (const deg of [-162, -126, -90, -54, -18]) {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * R * 0.99;
    const y = -d * 0.5 + Math.sin(a) * R * 0.99;
    const w = R * 0.1 * (0.45 + 0.55 * Math.abs(Math.sin(a)));
    rrect(g, x - w / 2, y - R * 0.13, w, R * 0.26, w / 2);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, x - w / 2 + 1, y - R * 0.13 + 1, w - 2, R * 0.26 - 2, w / 2);
    g.fillStyle = metalGrad(g, x - w / 2, x + w / 2, kit.hw);
    g.fill();
  }
  // 앞 테 (색 테 + 가운데 상감 줄)
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.arc(0, 0, R * 0.855, 0, TAU, true);
  const hg = g.createLinearGradient(0, -R, 0, R);
  hg.addColorStop(0, kit.hoop[0]);
  hg.addColorStop(0.5, kit.hoop[1]);
  hg.addColorStop(1, kit.hoop[2]);
  g.fillStyle = hg;
  g.fill();
  g.lineWidth = R * 0.03;
  g.strokeStyle = OUT;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R * 0.93, 0, TAU);
  g.lineWidth = R * 0.038;
  g.strokeStyle = kit.inlay;
  g.stroke();
  // 테 위쪽 반사
  g.beginPath();
  g.arc(0, 0, R * 0.965, Math.PI * 1.1, Math.PI * 1.55);
  g.lineWidth = R * 0.025;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.stroke();
  // 클로(테 잡는 쇠)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    g.save();
    g.rotate(a);
    rrect(g, R * 0.84, -R * 0.045, R * 0.19, R * 0.09, R * 0.03);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, R * 0.85, -R * 0.032, R * 0.17, R * 0.064, R * 0.025);
    const m = METAL[kit.hw] || METAL.chrome;
    g.fillStyle = m[1];
    g.fill();
    g.fillStyle = m[2];
    g.globalAlpha = 0.7;
    g.fillRect(R * 0.87, -R * 0.03, R * 0.12, R * 0.018);
    g.globalAlpha = 1;
    g.restore();
  }
  // 앞 헤드
  const H = R * 0.855;
  const head = g.createRadialGradient(-H * 0.3, -H * 0.35, H * 0.1, 0, 0, H);
  head.addColorStop(0, lighten(kit.head, 0.25));
  head.addColorStop(0.75, kit.head);
  head.addColorStop(1, darken(kit.head, 0.22));
  g.beginPath();
  g.arc(0, 0, H, 0, TAU);
  g.fillStyle = head;
  g.fill();
  // 엠블럼
  g.beginPath();
  g.arc(0, -H * 0.04, H * 0.56, 0, TAU);
  g.lineWidth = H * 0.07;
  g.strokeStyle = kit.emblem;
  g.stroke();
  g.lineWidth = H * 0.018;
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.arc(0, -H * 0.04, H * 0.49, 0, TAU);
  g.stroke();
  g.save();
  g.translate(0, -H * 0.12);
  sprout(g, H * 0.62);
  g.restore();
  g.fillStyle = kit.emblemText;
  let fs = Math.max(4, H * 0.15);
  g.font = `900 ${fs}px system-ui, sans-serif`;
  while (fs > 4 && g.measureText('OKAYSTRA').width > H * 0.8) g.font = `900 ${(fs -= 0.5)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('OKAYSTRA', 0, H * 0.28);
  // 공기 구멍(포트)
  g.beginPath();
  g.arc(H * 0.56, H * 0.56, H * 0.13, 0, TAU);
  g.fillStyle = '#0B0910';
  g.fill();
  g.lineWidth = H * 0.04;
  g.strokeStyle = (METAL[kit.hw] || METAL.chrome)[1];
  g.stroke();
  // 헤드 테두리 그늘 + 광택
  const ao = g.createRadialGradient(0, 0, H * 0.82, 0, 0, H);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = ao;
  g.beginPath();
  g.arc(0, 0, H, 0, TAU);
  g.fill();
  g.save();
  g.translate(-H * 0.38, -H * 0.5);
  g.rotate(-0.55);
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, H * 0.42);
  gl.addColorStop(0, 'rgba(255,255,255,0.75)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.scale(1, 0.32);
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, H * 0.42, 0, TAU);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- 스네어
/** 스네어 (위에서 비스듬히). Rx = 테 가로 반지름. 기준점 = 헤드 가운데 */
const SNARE_RY = 0.36;
function drawSnare(g, Rx, kit, standTo, opt = {}) {
  const ry = Rx * SNARE_RY;
  const H = Rx * (opt.depth || 0.48);
  floorShadow(g, 0, standTo, Rx * 0.85, Rx * 0.13, 0.6);
  if (opt.legs) {
    // 플로어 탐: 통 옆에서 바닥까지 다리 셋
    for (const f of [-0.92, 0.92, 0.3]) rod(g, f * Rx, H * 0.35, f * Rx * 1.12, standTo - Rx * 0.02, Rx * 0.06, kit.hw);
  } else {
    // 스탠드
    rod(g, 0, H + ry, 0, standTo - Rx * 0.32, Rx * 0.07, kit.hw);
    rod(g, 0, standTo - Rx * 0.34, -Rx * 0.68, standTo - Rx * 0.02, Rx * 0.06, kit.hw);
    rod(g, 0, standTo - Rx * 0.34, Rx * 0.68, standTo - Rx * 0.02, Rx * 0.06, kit.hw);
    rod(g, 0, standTo - Rx * 0.34, 0, standTo + Rx * 0.04, Rx * 0.06, kit.hw);
    for (const s of [-1, 1]) rod(g, 0, H + ry * 1.1, s * Rx * 0.62, H + ry * 0.55, Rx * 0.05, kit.hw);
  }
  // 통
  g.save();
  g.beginPath();
  g.moveTo(-Rx, 0);
  g.lineTo(-Rx, H);
  g.ellipse(0, H, Rx, ry, 0, Math.PI, 0, true);
  g.lineTo(Rx, 0);
  g.ellipse(0, 0, Rx, ry, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.clip();
  const finish = opt.finish || kit.snareFinish || 'gloss';
  paintFinish(g, finish, opt.colors || kit.snare, -Rx, Rx, -ry, H + ry, { sparkle: opt.colors ? kit.sparkle : kit.snareSparkle });
  cylShade(g, -Rx, Rx, -ry, H + ry, finish === 'metal' ? 0.6 : 1);
  g.restore();
  // 아래 테
  const t = Rx * 0.075;
  g.beginPath();
  g.moveTo(-Rx, H - t);
  g.ellipse(0, H - t, Rx, ry, 0, Math.PI, 0, true);
  g.lineTo(Rx, H);
  g.ellipse(0, H, Rx, ry, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = metalGrad(g, -Rx, Rx, kit.hw);
  g.fill();
  g.lineWidth = Rx * 0.015;
  g.strokeStyle = OUT;
  g.stroke();
  // 튜브 러그 + 텐션 볼트
  for (const f of [-0.86, -0.5, 0, 0.5, 0.86]) {
    const x = f * Rx;
    const k = Math.sqrt(1 - f * f);
    const y0 = ry * k + Rx * 0.06;
    const y1 = H + ry * k - Rx * 0.08;
    const w = Rx * (0.035 + 0.06 * k);
    rrect(g, x - w / 2, y0, w, y1 - y0, w / 2);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, x - w / 2 + 0.8, y0 + 0.8, w - 1.6, y1 - y0 - 1.6, w / 2);
    g.fillStyle = metalGrad(g, x - w / 2, x + w / 2, kit.hw);
    g.fill();
  }
  // 위 테 옆면
  const tt = Rx * 0.07;
  g.beginPath();
  g.moveTo(Rx, 0);
  g.ellipse(0, 0, Rx, ry, 0, 0, Math.PI, false);
  g.lineTo(-Rx, tt);
  g.ellipse(0, tt, Rx, ry, 0, Math.PI, 0, true);
  g.closePath();
  g.fillStyle = metalGrad(g, -Rx, Rx, kit.hw);
  g.fill();
  g.lineWidth = Rx * 0.015;
  g.strokeStyle = OUT;
  g.stroke();
  // 위 테 윗면 (고리)
  g.beginPath();
  g.ellipse(0, 0, Rx, ry, 0, 0, TAU);
  g.ellipse(0, 0, Rx * 0.92, ry * 0.86, 0, 0, TAU, true);
  const m = METAL[kit.hw] || METAL.chrome;
  const rg = g.createLinearGradient(-Rx, -ry, Rx, ry);
  rg.addColorStop(0, m[2]);
  rg.addColorStop(0.35, m[1]);
  rg.addColorStop(0.6, m[3]);
  rg.addColorStop(1, m[4]);
  g.fillStyle = rg;
  g.fill();
  // 헤드 (코팅된 흰 가죽)
  const hx = Rx * 0.92;
  const hy = ry * 0.86;
  g.save();
  ellipse(g, 0, 0, hx, hy);
  g.clip();
  const hg = g.createRadialGradient(-hx * 0.25, -hy * 0.4, hx * 0.05, 0, 0, hx);
  hg.addColorStop(0, '#FFFFFF');
  hg.addColorStop(0.7, '#F6F1E6');
  hg.addColorStop(1, '#D9D1C2');
  g.fillStyle = hg;
  g.fillRect(-hx, -hy, hx * 2, hy * 2);
  // 테두리 안쪽 그늘 (칼라)
  g.lineWidth = Rx * 0.06;
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  ellipse(g, 0, 0, hx, hy);
  g.stroke();
  // 많이 친 자국 (가운데 살짝 회색)
  ellipse(g, Rx * 0.04, ry * 0.05, Rx * 0.22, ry * 0.22);
  g.fillStyle = 'rgba(120,110,100,0.12)';
  g.fill();
  g.restore();
  g.lineWidth = Rx * 0.018;
  g.strokeStyle = OUT;
  ellipse(g, 0, 0, Rx, ry);
  g.stroke();
  // 테 반사
  g.beginPath();
  g.ellipse(0, 0, Rx * 0.96, ry * 0.93, 0, Math.PI * 1.1, Math.PI * 1.45);
  g.lineWidth = Rx * 0.022;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.stroke();
}

// ---------------------------------------------------------------- 심벌
function drawCymbal(g, r, tone, tint) {
  const c = tint || CYM[tone] || CYM.gold;
  const ry = r * 0.28;
  // 아랫면 두께
  ellipse(g, 0, r * 0.05, r, ry);
  g.fillStyle = c.dark;
  g.fill();
  g.save();
  ellipse(g, 0, 0, r, ry);
  g.clip();
  // 비스듬한 금속 반사 (원뿔 그라데이션)
  let gr;
  if (g.createConicGradient) {
    gr = g.createConicGradient(-0.4, 0, 0);
    const st = [c.mid, c.light, c.mid, c.dark, c.mid, c.light, c.mid, c.dark, c.mid];
    st.forEach((col, i) => gr.addColorStop(i / (st.length - 1), col));
  } else {
    gr = g.createLinearGradient(-r, 0, r, 0);
    gr.addColorStop(0, c.dark);
    gr.addColorStop(0.4, c.light);
    gr.addColorStop(1, c.mid);
  }
  g.fillStyle = gr;
  g.fillRect(-r, -ry, r * 2, ry * 2);
  // 선반 자국
  g.lineWidth = Math.max(0.5, r * 0.012);
  for (let i = 0; i < 16; i++) {
    const f = 0.2 + (0.8 * i) / 15;
    g.strokeStyle = i % 2 ? `rgba(${c.groove},0.22)` : 'rgba(255,255,255,0.14)';
    ellipse(g, 0, -ry * 0.05 * (1 - f), r * f, ry * f);
    g.stroke();
  }
  // 위에서 빛
  const sh = g.createLinearGradient(0, -ry, 0, ry);
  sh.addColorStop(0, 'rgba(255,255,255,0.25)');
  sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh;
  g.fillRect(-r, -ry, r * 2, ry * 2);
  g.restore();
  // 벨 (가운데 볼록)
  ellipse(g, 0, -ry * 0.12, r * 0.24, ry * 0.36);
  const bg = g.createRadialGradient(-r * 0.06, -ry * 0.3, 0, 0, -ry * 0.1, r * 0.24);
  bg.addColorStop(0, c.light);
  bg.addColorStop(1, c.mid);
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = Math.max(0.6, r * 0.015);
  g.strokeStyle = `rgba(${c.groove},0.6)`;
  g.stroke();
  ellipse(g, 0, -ry * 0.2, r * 0.045, ry * 0.08);
  g.fillStyle = '#121014';
  g.fill();
  // 테두리
  g.lineWidth = Math.max(1, r * 0.03);
  g.strokeStyle = OUT;
  ellipse(g, 0, 0, r, ry);
  g.stroke();
}

// ---------------------------------------------------------------- 노트
function drawKickNote(g, w, h, C, grey) {
  const dep = h * 0.55;
  const main = grey ? '#8C86A0' : C.main;
  const light = grey ? '#D6D2E0' : C.light;
  const dark = grey ? '#4E4860' : C.dark;
  if (!grey) {
    g.save();
    g.shadowColor = `rgba(${C.rgb},0.9)`;
    g.shadowBlur = h * 0.9;
    rrect(g, -w / 2, -h / 2, w, h + dep, h / 2);
    g.fillStyle = `rgba(${C.rgb},0.6)`;
    g.fill();
    g.restore();
  }
  // 옆면(두께)
  rrect(g, -w / 2, -h / 2, w, h + dep, h / 2);
  g.fillStyle = OUT;
  g.fill();
  rrect(g, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h + dep - 3, h / 2);
  const sg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  sg.addColorStop(0, darken(dark, 0.35));
  sg.addColorStop(0.3, dark);
  sg.addColorStop(0.7, dark);
  sg.addColorStop(1, darken(dark, 0.35));
  g.fillStyle = sg;
  g.fill();
  // 윗면
  rrect(g, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 1, h / 2);
  const tg = g.createLinearGradient(0, -h / 2, 0, h / 2);
  tg.addColorStop(0, light);
  tg.addColorStop(0.55, main);
  tg.addColorStop(1, main);
  g.fillStyle = tg;
  g.fill();
  // 금속 끝마개
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - h * 0.62);
    ellipse(g, x, 0, h * 0.26, h * 0.26);
    g.fillStyle = metalGrad(g, x - h * 0.26, x + h * 0.26, 'chrome');
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = OUT;
    g.stroke();
  }
  // 광택
  rrect(g, -w / 2 + h * 1.05, -h * 0.34, w * 0.5, h * 0.2, h * 0.1);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fill();
}

function drawSnareNote(g, r, C, grey) {
  const ry = r * 0.62;
  const dep = r * 0.36;
  if (!grey) {
    g.save();
    g.shadowColor = `rgba(${C.rgb},0.9)`;
    g.shadowBlur = r * 0.6;
    ellipse(g, 0, dep * 0.5, r, ry);
    g.fillStyle = `rgba(${C.rgb},0.6)`;
    g.fill();
    g.restore();
  }
  // 옆면
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(-r, dep);
  g.ellipse(0, dep, r, ry, 0, Math.PI, 0, true);
  g.lineTo(r, 0);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = grey ? '#6E6880' : C.dark;
  g.fillRect(-r, 0, r * 2, dep + ry);
  cylShade(g, -r, r, 0, dep + ry, 0.9);
  g.restore();
  // 테(색) + 헤드
  ellipse(g, 0, 0, r, ry);
  g.fillStyle = OUT;
  g.fill();
  ellipse(g, 0, 0, r - 1.5, ry - 1.5);
  const hg = g.createLinearGradient(-r, -ry, r, ry);
  hg.addColorStop(0, grey ? '#D6D2E0' : C.light);
  hg.addColorStop(0.6, grey ? '#9A94AE' : C.main);
  hg.addColorStop(1, grey ? '#6E6880' : C.dark);
  g.fillStyle = hg;
  g.fill();
  const hr = g.createRadialGradient(-r * 0.25, -ry * 0.35, 0, 0, 0, r * 0.78);
  hr.addColorStop(0, '#FFFFFF');
  hr.addColorStop(1, grey ? '#C9C4D6' : '#EEF6FF');
  ellipse(g, 0, 0, r * 0.76, ry * 0.74);
  g.fillStyle = hr;
  g.fill();
  ellipse(g, 0, ry * 0.02, r * 0.16, ry * 0.16);
  g.fillStyle = grey ? '#8C86A0' : C.dark;
  g.fill();
  // 테 반사
  g.beginPath();
  g.ellipse(0, 0, r * 0.9, ry * 0.88, 0, Math.PI * 1.08, Math.PI * 1.5);
  g.lineWidth = r * 0.07;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
}

// ---------------------------------------------------------------- 색 유틸
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function lighten(h, k) {
  return rgbHex(hexRgb(h).map((v) => v + (255 - v) * k));
}
function darken(h, k) {
  return rgbHex(hexRgb(h).map((v) => v * (1 - k)));
}

/**
 * 테마 하나의 드럼 세트 + 노트 스프라이트.
 * sz = { instR, padR, barW, barH, cymR(lane), dpr, standTo }  lanes = LANE 색 정보
 */
function buildKit(theme, sz, lanes) {
  const kit = theme.kit;
  const dpr = sz.dpr;
  const out = {};
  // 킥: 헤드 반지름 = instR
  const R = sz.instR;
  out.kick = sprite(R * 2.6, R * 2.75, R * 1.3, R * 1.48, dpr, (g) => drawKick(g, R, kit));
  out.kickR = R;
  // 스네어: 테 가로 반지름
  const Rx = sz.instR * 1.22;
  const standTo = Math.max(Rx * 1.2, sz.standTo);
  out.snare = sprite(Rx * 2.3, standTo + Rx * 0.55 + Rx * 0.2, Rx * 1.15, Rx * 0.55, dpr, (g) => drawSnare(g, Rx, kit, standTo));
  out.snareRx = Rx;
  // 탐탐 (플로어 탐): 베이스드럼과 같은 마감, 더 깊은 통, 다리
  const Tx = sz.instR * 1.12;
  const tomTo = Tx * 1.35;
  out.tom = sprite(Tx * 2.6, tomTo + Tx * 0.75, Tx * 1.3, Tx * 0.55, dpr, (g) =>
    drawSnare(g, Tx, kit, tomTo, { depth: 0.8, legs: true, colors: kit.shell, finish: kit.finish })
  );
  // 심벌 (하이햇·크래시 공용, 그릴 때 크기·기울기 조절)
  const cr = sz.cymR * 1.05;
  out.cym = sprite(cr * 2.2, cr * 0.9, cr * 1.1, cr * 0.4, dpr, (g) => drawCymbal(g, cr, kit.cym));
  out.cymR = cr;
  // 노트 (s=1 크기 기준, 가까이 오면 커지니 해상도 넉넉히)
  const nd = dpr * 1.6;
  const pad = 14;
  const C = lanes;
  out.notes = {};
  for (const grey of [false, true]) {
    const k = grey ? 'grey' : 'live';
    const n = (out.notes[k] = {});
    const w = sz.barW;
    const h = sz.barH;
    n[0] = sprite(w + pad * 2, h * 2 + pad * 2, w / 2 + pad, h / 2 + pad, nd, (g) => drawKickNote(g, w, h, C[0], grey));
    const r = sz.padR;
    n[1] = sprite(r * 2 + pad * 2, r * 1.9 + pad * 2, r + pad, r * 0.62 + pad, nd, (g) => drawSnareNote(g, r, C[1], grey));
    if (C[4]) n[4] = sprite(r * 2 + pad * 2, r * 1.9 + pad * 2, r + pad, r * 0.62 + pad, nd, (g) => drawSnareNote(g, r, C[4], grey));
    for (const lane of [2, 3]) {
      const cr2 = sz.cymR * (lane === 3 ? 1 : 0.86);
      const L = C[lane];
      const tint = grey
        ? { dark: '#4E4860', mid: '#8C86A0', light: '#D6D2E0', groove: '40,36,50' }
        : { dark: L.dark, mid: L.main, light: L.light, groove: '60,40,20' };
      n[lane] = sprite(cr2 * 2.2 + pad * 2, cr2 * 0.9 + pad * 2, cr2 * 1.1 + pad, cr2 * 0.4 + pad, nd, (g) => {
        if (!grey) {
          g.save();
          g.shadowColor = `rgba(${L.rgb},0.9)`;
          g.shadowBlur = cr2 * 0.35;
          ellipse(g, 0, 0, cr2, cr2 * 0.28);
          g.fillStyle = `rgba(${L.rgb},0.6)`;
          g.fill();
          g.restore();
        }
        drawCymbal(g, cr2, 'gold', tint);
        if (lane === 3 && !grey) {
          g.fillStyle = '#FFFFFF';
          for (const sx of [-0.6, 0.6]) {
            ellipse(g, cr2 * sx, -cr2 * 0.02, cr2 * 0.07, cr2 * 0.07);
            g.fill();
          }
        }
      });
    }
  }
  // ✨ 황금 콩: 같은 노트를 금색으로 물들인 것 (노트 모양 안쪽만 칠함 → 네모가 안 생김)
  out.notes.gold = {};
  for (const [lane, sp] of Object.entries(out.notes.live)) {
    const c = document.createElement('canvas');
    c.width = sp.img.width;
    c.height = sp.img.height;
    const g = c.getContext('2d');
    g.drawImage(sp.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 0, c.height);
    gr.addColorStop(0, 'rgba(255,240,170,0.75)');
    gr.addColorStop(0.5, 'rgba(255,200,50,0.6)');
    gr.addColorStop(1, 'rgba(200,130,10,0.65)');
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
    out.notes.gold[lane] = { ...sp, img: c };
  }
  return out;
}

return { SNARE_RY, lighten, darken, buildKit };
})();

// ---- themes.js ----
const __m_themes = (() => {
// 맵 분위기(테마): 단계를 묶어서 묶음마다 무대가 바뀜. 곡이 달아오르면(heat) 조명·입자가 같이 커짐.
//   1~3 노을 피크닉 · 4~6 네온 시티 · 7~9 황금 콘서트홀 · 10~12 블랙 스테이지 · 13~15 용암 보스전 · 16 오로라 설원
//   그리그 무제한·레벨업 챌린지는 우주 무대에서 시작해 Lv 이 오를 때마다 맵이 바뀜(THEME_CYCLE).
//   단계별 무제한(e5 등)은 그 단계 맵 그대로.
//
// kit: 드럼 세트 마감. shell = [밝은, 기본, 어두운] 색, finish = gloss | sparkle | wood | fade | metal
//   hw = 금속 부품 색(chrome | gold | black), cym = 심벌 색(gold | silver | dark)

const THEMES = {
  sunset: {
    key: 'sunset',
    name: '노을 피크닉',
    emoji: '🌅',
    sky: ['#2B1650', '#9A3F86', '#FF9A6B'],
    ground: ['#3A1846', '#170A24'],
    glow: '255,190,140',
    hot: '255,120,90',
    laneBase: 'rgba(32,12,44,0.58)',
    laneTint: 0.8,
    rail: null,
    beat: '255,236,214',
    fog: '150,60,120',
    spots: ['255,150,120', '255,210,140', '255,120,170', '200,140,255'],
    particle: 'petal',
    kit: {
      shell: ['#FFC3A8', '#FF7A59', '#B53C26'],
      finish: 'sparkle',
      sparkle: '#FFF1E2',
      snare: ['#D4FAEE', '#5FD0B2', '#23866F'],
      snareFinish: 'gloss',
      hoop: ['#FFFFFF', '#E3D8CC', '#A89A8C'],
      inlay: '#FF7A59',
      hw: 'chrome',
      head: '#FFF8EC',
      emblem: '#FF7A59',
      emblemText: '#B53C26',
      cym: 'gold',
    },
  },
  city: {
    key: 'city',
    name: '네온 시티',
    emoji: '🌃',
    sky: ['#06041A', '#1E0B45', '#6A1B78'],
    ground: ['#150828', '#05020C'],
    glow: '255,80,200',
    hot: '255,60,200',
    laneBase: 'rgba(8,4,22,0.7)',
    laneTint: 0.75,
    rail: null,
    beat: '200,240,255',
    fog: '90,20,110',
    spots: ['255,60,200', '60,230,255', '160,90,255', '60,230,255'],
    particle: 'neon',
    kit: {
      shell: ['#4A5070', '#1A1D2E', '#06070C'],
      finish: 'sparkle',
      sparkle: '#7DF9FF',
      snare: ['#FF9BE6', '#E13BB8', '#6E0F5E'],
      snareFinish: 'sparkle',
      snareSparkle: '#FFE1F7',
      hoop: ['#3A3E52', '#16182A', '#05060C'],
      inlay: '#39E6FF',
      hw: 'chrome',
      head: '#F2F5FF',
      emblem: '#E13BB8',
      emblemText: '#1A1D2E',
      cym: 'silver',
    },
  },
  hall: {
    key: 'hall',
    name: '황금 콘서트홀',
    emoji: '🎻',
    sky: ['#140306', '#3E0B16', '#7A2A1C'],
    ground: ['#3A2012', '#160A05'],
    glow: '255,214,150',
    hot: '255,190,90',
    laneBase: 'rgba(40,18,8,0.66)',
    laneTint: 0.55,
    rail: null,
    beat: '255,230,180',
    fog: '90,30,20',
    spots: ['255,224,170', '255,200,120', '255,232,190', '255,200,120'],
    particle: 'gold',
    kit: {
      shell: ['#F0BE82', '#B8743A', '#5E3212'],
      finish: 'wood',
      snare: ['#FFF0B8', '#D4A645', '#6E4A12'],
      snareFinish: 'metal',
      hoop: ['#FFE9A0', '#D2A23E', '#7A5416'],
      inlay: '#5A2A10',
      hw: 'gold',
      head: '#F7EFDC',
      emblem: '#8C1C2A',
      emblemText: '#5A2A10',
      cym: 'gold',
    },
  },
  void: {
    key: 'void',
    name: '블랙 스테이지',
    emoji: '🖤',
    sky: ['#000000', '#040406', '#0C0C12'],
    ground: ['#08080B', '#000000'],
    glow: '255,255,255',
    hot: '255,255,255',
    laneBase: 'rgba(16,16,20,0.94)',
    laneTint: 0.2,
    rail: '235,236,242',
    beat: '255,255,255',
    fog: '0,0,0',
    spots: ['255,255,255', '255,250,240', '240,245,255', '255,255,255'],
    particle: 'haze',
    kit: {
      shell: ['#5A5E6A', '#17181E', '#000000'],
      finish: 'gloss',
      snare: ['#FFFFFF', '#AEB4C0', '#3C414C'],
      snareFinish: 'metal',
      hoop: ['#FFFFFF', '#B9BEC8', '#5A606C'],
      inlay: '#E8E9EE',
      hw: 'chrome',
      head: '#FAFAFA',
      emblem: '#17181E',
      emblemText: '#17181E',
      cym: 'silver',
    },
  },
  lava: {
    key: 'lava',
    name: '용암 보스전',
    emoji: '🌋',
    sky: ['#0A0204', '#3A0710', '#A3300C'],
    ground: ['#1E0406', '#060102'],
    glow: '255,120,40',
    hot: '255,80,20',
    laneBase: 'rgba(20,4,4,0.72)',
    laneTint: 0.7,
    rail: null,
    beat: '255,200,160',
    fog: '120,20,10',
    spots: ['255,90,30', '255,160,40', '255,60,40', '255,190,80'],
    particle: 'ember',
    kit: {
      shell: ['#FF7A3A', '#C21E12', '#160304'],
      finish: 'fade',
      snare: ['#5A5A64', '#1C1C22', '#040405'],
      snareFinish: 'sparkle',
      snareSparkle: '#FF8A3A',
      hoop: ['#4A4A52', '#1A1A20', '#050506'],
      inlay: '#FF5A1F',
      hw: 'black',
      head: '#1E1E24',
      emblem: '#FF6A2A',
      emblemText: '#FFB27A',
      cym: 'dark',
    },
  },
  aurora: {
    key: 'aurora',
    name: '오로라 설원',
    emoji: '🌌',
    sky: ['#020A1A', '#0A2A3E', '#1C4A5E'],
    ground: ['#C7D9E8', '#5C7A94'],
    glow: '120,255,200',
    hot: '110,255,190',
    laneBase: 'rgba(6,18,34,0.78)',
    laneTint: 0.7,
    rail: null,
    beat: '210,255,240',
    fog: '20,60,80',
    spots: ['120,255,200', '140,180,255', '200,140,255', '120,255,200'],
    particle: 'snow',
    kit: {
      shell: ['#E8FBFF', '#8FD8F0', '#2C6E8E'],
      finish: 'sparkle',
      sparkle: '#FFFFFF',
      snare: ['#FFFFFF', '#C9D3E0', '#5A667A'],
      snareFinish: 'metal',
      hoop: ['#FFFFFF', '#B9C6D4', '#5A6676'],
      inlay: '#4FE0A6',
      hw: 'chrome',
      head: '#F4FBFF',
      emblem: '#1F9E70',
      emblemText: '#2C6E8E',
      cym: 'silver',
    },
  },
  space: {
    key: 'space',
    name: '우주 무대',
    emoji: '🪐',
    sky: ['#020310', '#0A1240', '#2E1A70'],
    ground: ['#0A0A26', '#02020A'],
    glow: '160,140,255',
    hot: '120,160,255',
    laneBase: 'rgba(4,4,22,0.66)',
    laneTint: 0.7,
    rail: null,
    beat: '210,220,255',
    fog: '40,30,110',
    spots: ['140,120,255', '90,220,255', '255,120,220', '140,120,255'],
    particle: 'star',
    kit: {
      shell: ['#B49CFF', '#4B2BB8', '#12073E'],
      finish: 'sparkle',
      sparkle: '#FFFFFF',
      snare: ['#B5F6FF', '#38B8E0', '#0F4A6E'],
      snareFinish: 'sparkle',
      snareSparkle: '#FFFFFF',
      hoop: ['#FFFFFF', '#B9BEC8', '#5A606C'],
      inlay: '#FFD84A',
      hw: 'chrome',
      head: '#EEF0FF',
      emblem: '#4B2BB8',
      emblemText: '#4B2BB8',
      cym: 'silver',
    },
  },
};

/** 단계 묶음 → 맵 (단계 고르기 화면 묶음 제목에도 씀) */
const THEME_GROUPS = [
  { from: 1, to: 3, key: 'sunset' },
  { from: 4, to: 6, key: 'city' },
  { from: 7, to: 9, key: 'hall' },
  { from: 10, to: 12, key: 'void' },
  { from: 13, to: 15, key: 'lava' },
  { from: 16, to: 16, key: 'aurora' },
];

/** 그리그 무제한·레벨업 챌린지: Lv 이 오를 때마다 이 순서로 맵이 바뀜 */
const THEME_CYCLE = ['space', 'sunset', 'city', 'hall', 'void', 'lava', 'aurora'];

function themeKeyForId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return 'space';
  const g = THEME_GROUPS.find((t) => n >= t.from && n <= t.to);
  return g ? g.key : n > 16 ? 'aurora' : 'sunset';
}

/** 레벨(판) → { key, cycle } . cycle 이면 Lv 마다 맵이 바뀜 */
function themeForLevel(lv) {
  if (!lv) return { key: 'sunset', cycle: false };
  if (lv.theme && THEMES[lv.theme]) return { key: lv.theme, cycle: false };
  if (lv.baseId != null) return { key: themeKeyForId(lv.baseId), cycle: false };
  if (lv.challenge) return { key: 'space', cycle: true };
  return { key: themeKeyForId(lv.id), cycle: false };
}

/** cycle 판의 round 번째 단계 맵 */
function cycleTheme(round) {
  const r = Math.max(1, round | 0);
  return THEME_CYCLE[(r - 1) % THEME_CYCLE.length];
}

/** 이 단계가 묶음의 첫 단계면 그 묶음 정보 (단계 목록 제목용) */
function groupStarting(id) {
  const g = THEME_GROUPS.find((t) => t.from === id);
  return g ? { ...g, theme: THEMES[g.key] } : null;
}

return { THEMES, THEME_GROUPS, THEME_CYCLE, themeKeyForId, themeForLevel, cycleTheme, groupStarting };
})();

// ---- scenery.js ----
const __m_scenery = (() => {
// 맵 배경(정적) + 노래에 맞춰 움직이는 무대 효과(동적)
//   paintScenery: 하늘·땅·장식 (테마 바뀔 때·화면 크기 바뀔 때 한 번)
//   SceneFx.draw: 조명·입자·비트 반응 (매 프레임, heat 0~1 = 곡이 얼마나 달아올랐나)

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function radial(g, x, y, r, rgb, a, mid = 0.4) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(mid, `rgba(${rgb},${a * 0.4})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 노을 피크닉 전구 줄 위치 (정적 그림·동적 반짝임 공용) */
function garland(L) {
  const pts = [];
  const y0 = L.topY * 0.42;
  const sag = L.topY * 0.22;
  const n = Math.max(9, Math.round(L.W / 34));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: t * L.W, y: y0 + Math.sin(t * Math.PI) * sag * 0.25 + Math.abs(Math.sin(t * Math.PI * 2)) * sag });
  }
  return pts;
}

/** 블랙 스테이지 천장 조명 위치 */
function rigLamps(L) {
  const n = 5;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: L.GX + L.GW * (0.1 + (0.8 * i) / (n - 1)), y: L.H * 0.04 });
  return out;
}

// ------------------------------------------------------------------ 정적
function paintScenery(g, L, T) {
  const { W, H, cx, topY, GW } = L;
  // 하늘
  const sky = g.createLinearGradient(0, 0, 0, topY);
  sky.addColorStop(0, T.sky[0]);
  sky.addColorStop(0.55, T.sky[1]);
  sky.addColorStop(1, T.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, topY + 1);
  // 땅
  const gd = g.createLinearGradient(0, topY, 0, H);
  gd.addColorStop(0, T.ground[0]);
  gd.addColorStop(1, T.ground[1]);
  g.fillStyle = gd;
  g.fillRect(0, topY, W, H - topY);
  const paint = PAINT[T.key];
  if (paint) paint(g, L, T, sky);
  // 지평선 빛
  g.save();
  g.globalCompositeOperation = 'lighter';
  radial(g, cx, topY, GW * 0.85, T.glow, T.key === 'void' ? 0.08 : 0.3);
  g.restore();
}

const PAINT = {
  sunset(g, L, T, sky) {
    const { W, cx, topY, GW } = L;
    const r = rng(3);
    // 구름
    g.fillStyle = 'rgba(255,190,210,0.28)';
    for (let i = 0; i < 6; i++) {
      const x = r() * W;
      const y = topY * (0.12 + r() * 0.35);
      const s = GW * (0.06 + r() * 0.06);
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(x + (k - 1.5) * s * 0.9, y + Math.abs(k - 1.5) * s * 0.2, s, s * 0.55, 0, 0, TAU);
        g.fill();
      }
    }
    // 레트로 해 (아래쪽 줄무늬)
    const sr = GW * 0.26;
    const sy = topY - sr * 0.12;
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx, sy, sr * 2.2, '255,170,120', 0.35);
    g.restore();
    const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr * 0.3);
    sg.addColorStop(0, '#FFF1B0');
    sg.addColorStop(0.5, '#FFB86B');
    sg.addColorStop(1, '#FF5F8A');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(cx, sy, sr, Math.PI, 0);
    g.lineTo(cx + sr, topY);
    g.lineTo(cx - sr, topY);
    g.fill();
    g.fillStyle = sky;
    for (let i = 0; i < 5; i++) {
      const y = sy - sr * 0.5 + i * sr * 0.17;
      g.fillRect(cx - sr, y, sr * 2, sr * (0.02 + i * 0.022));
    }
    // 언덕 두 겹
    const hills = [
      ['#7A2F72', 0.07, 1.3, 11],
      ['#4A1C55', 0.04, 2.1, 17],
    ];
    for (const [col, amp, fr, seed] of hills) {
      const rr2 = rng(seed);
      const ph = rr2() * 6;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, topY + 1);
      for (let x = 0; x <= W; x += 6) {
        const y = topY - GW * amp * (0.6 + 0.4 * Math.sin((x / W) * Math.PI * fr * 2 + ph)) * (0.55 + Math.abs(x - cx) / W);
        g.lineTo(x, y);
      }
      g.lineTo(W, topY + 1);
      g.fill();
    }
    // 잔디 쪽 땅 무늬
    g.strokeStyle = 'rgba(255,170,190,0.07)';
    g.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const y = topY + (L.H - topY) * Math.pow(i / 12, 1.8);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // 전구 줄
    const pts = garland(L);
    g.strokeStyle = 'rgba(30,10,30,0.8)';
    g.lineWidth = 1.5;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    const cols = ['#FFE07A', '#FF9AB8', '#9AE6FF', '#C8FF9A'];
    pts.forEach((p, i) => {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.arc(p.x, p.y + 4, 3.2, 0, TAU);
      g.fill();
    });
  },

  city(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(5);
    // 별 몇 개
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) g.fillRect(r() * W, r() * topY * 0.6, 1.2, 1.2);
    // 빌딩 (먼 줄 → 가까운 줄)
    const rows = [
      { col: '#2A1452', hMin: 0.06, hMax: 0.16, wMin: 0.05, wMax: 0.1, win: 0.18 },
      { col: '#13082A', hMin: 0.08, hMax: 0.3, wMin: 0.07, wMax: 0.14, win: 0.3 },
    ];
    rows.forEach((row, ri) => {
      let x = -10;
      while (x < W + 10) {
        const w = GW * (row.wMin + r() * (row.wMax - row.wMin));
        // 가운데(길 끝)는 낮게, 옆으로 갈수록 높게
        const side = Math.min(1, Math.abs(x + w / 2 - cx) / (GW * 0.5));
        const h = GW * (row.hMin + r() * (row.hMax - row.hMin)) * (0.45 + side * 0.9);
        const y = topY - h;
        g.fillStyle = row.col;
        g.fillRect(x, y, w, h + 1);
        if (r() < 0.25 && ri === 1) {
          g.fillRect(x + w * 0.45, y - h * 0.18, Math.max(1.5, w * 0.06), h * 0.18);
          g.fillStyle = '#FF3355';
          g.beginPath();
          g.arc(x + w * 0.48, y - h * 0.18, 2, 0, TAU);
          g.fill();
        }
        // 창문
        const ws = Math.max(2, GW * 0.009);
        for (let wy = y + ws * 2; wy < topY - ws; wy += ws * 2.4)
          for (let wx = x + ws; wx < x + w - ws; wx += ws * 2)
            if (r() < row.win) {
              g.fillStyle = r() < 0.7 ? `rgba(255,214,120,${0.35 + r() * 0.5})` : `rgba(120,240,255,${0.35 + r() * 0.5})`;
              g.fillRect(wx, wy, ws, ws * 1.2);
            }
        x += w + GW * 0.004;
      }
    });
    // 네온 간판
    g.save();
    g.lineWidth = 2.5;
    [
      [0.05, 0.62, '#FF4FD8'],
      [0.82, 0.55, '#39E6FF'],
    ].forEach(([fx, fy, col]) => {
      const x = fx * W;
      const y = topY * fy;
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.strokeStyle = col;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, GW * 0.12, GW * 0.05, 6);
      else g.rect(x, y, GW * 0.12, GW * 0.05);
      g.stroke();
    });
    g.restore();
    // 바닥 네온 격자 (원근)
    g.save();
    g.beginPath();
    g.rect(0, topY, W, H - topY);
    g.clip();
    g.strokeStyle = 'rgba(255,79,216,0.28)';
    g.lineWidth = 1.2;
    for (let i = -14; i <= 14; i++) {
      g.beginPath();
      g.moveTo(cx + i * GW * 0.05, topY);
      g.lineTo(cx + i * GW * 0.05 * ((H - L.horizonY) / (topY - L.horizonY)), H);
      g.stroke();
    }
    for (let i = 1; i < 14; i++) {
      const y = topY + (H - topY) * Math.pow(i / 14, 2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.restore();
  },

  hall(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    // 파이프 오르간 (길 끝 뒤)
    const n = 23;
    const ow = GW * 0.95;
    const pw = ow / n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = cx - ow / 2 + i * pw;
      const h = topY * (0.32 + 0.38 * Math.pow(Math.sin(t * Math.PI), 1.4)) * (i % 2 ? 0.86 : 1);
      const pg = g.createLinearGradient(x, 0, x + pw, 0);
      pg.addColorStop(0, '#6E4A12');
      pg.addColorStop(0.35, '#FFE29A');
      pg.addColorStop(0.6, '#D9A93C');
      pg.addColorStop(1, '#5E3E0C');
      g.fillStyle = pg;
      g.fillRect(x + pw * 0.1, topY - h, pw * 0.8, h);
      g.fillStyle = 'rgba(20,6,4,0.8)';
      g.beginPath();
      g.ellipse(x + pw / 2, topY - h * 0.22, pw * 0.25, pw * 0.12, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,240,200,0.6)';
      g.beginPath();
      g.ellipse(x + pw / 2, topY - h, pw * 0.4, pw * 0.12, 0, 0, TAU);
      g.fill();
    }
    // 나무 바닥 (원근 널빤지)
    g.save();
    g.beginPath();
    g.rect(0, topY, W, H - topY);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      g.beginPath();
      g.moveTo(cx + i * GW * 0.035, topY);
      g.lineTo(cx + i * GW * 0.035 * ((H - L.horizonY) / (topY - L.horizonY)), H);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,210,150,0.06)';
    for (let i = 1; i < 16; i++) {
      const y = topY + (H - topY) * Math.pow(i / 16, 2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.restore();
    // 커튼 (양옆)
    const cw = Math.max(W * 0.12, (W - GW) / 2 + GW * 0.1);
    for (const side of [-1, 1]) {
      g.save();
      const x0 = side < 0 ? 0 : W;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 - side * cw, 0);
      g.quadraticCurveTo(x0 - side * cw * 0.55, H * 0.45, x0 - side * cw * 0.35, H * 0.72);
      g.lineTo(x0, H * 0.78);
      g.closePath();
      g.clip();
      const cg = g.createLinearGradient(x0, 0, x0 - side * cw, 0);
      for (let k = 0; k <= 10; k++) cg.addColorStop(k / 10, k % 2 ? '#3A050C' : '#8C1426');
      g.fillStyle = cg;
      g.fillRect(Math.min(x0, x0 - side * cw), 0, cw, H);
      const sh = g.createLinearGradient(0, 0, 0, H * 0.8);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)');
      sh.addColorStop(0.4, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = sh;
      g.fillRect(Math.min(x0, x0 - side * cw), 0, cw, H);
      g.restore();
      // 금색 끈
      g.fillStyle = '#E8B84A';
      g.beginPath();
      g.ellipse(x0 - side * cw * 0.42, H * 0.5, cw * 0.18, 4, side * 0.3, 0, TAU);
      g.fill();
    }
    // 위쪽 장식 휘장
    const vh = H * 0.045;
    g.fillStyle = '#6E0E1C';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, 0);
    g.lineTo(W, vh);
    const sc = Math.max(5, Math.round(W / 60));
    for (let i = sc; i >= 0; i--) {
      const x = (i / sc) * W;
      g.quadraticCurveTo(x + W / sc / 2, vh * 1.7, x, vh);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#E8B84A';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, vh * 0.55);
    g.lineTo(W, vh * 0.55);
    g.stroke();
  },

  void(g, L, T) {
    const { W, H, topY, GW } = L;
    // 천장 트러스
    const ty = H * 0.028;
    g.fillStyle = '#1A1B20';
    g.fillRect(0, ty - 4, W, 8);
    g.strokeStyle = '#2A2C33';
    g.lineWidth = 1.5;
    for (let x = 0; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, ty - 4);
      g.lineTo(x + 7, ty + 4);
      g.lineTo(x + 14, ty - 4);
      g.stroke();
    }
    // 조명 깡통 + 은은한 빛 기둥
    for (const p of rigLamps(L)) {
      const cone = g.createLinearGradient(0, p.y, 0, topY + (H - topY) * 0.3);
      cone.addColorStop(0, 'rgba(255,255,255,0.07)');
      cone.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(p.x - 5, p.y + 8);
      g.lineTo(p.x - GW * 0.12, topY + (H - topY) * 0.3);
      g.lineTo(p.x + GW * 0.12, topY + (H - topY) * 0.3);
      g.lineTo(p.x + 5, p.y + 8);
      g.fill();
      g.fillStyle = '#24252C';
      g.beginPath();
      if (g.roundRect) g.roundRect(p.x - 7, p.y, 14, 12, 3);
      else g.rect(p.x - 7, p.y, 14, 12);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(p.x - 5, p.y + 10, 10, 2);
    }
    // 반짝이는 검은 바닥 (지평선 쪽 살짝 반사)
    const sh = g.createLinearGradient(0, topY, 0, topY + (H - topY) * 0.25);
    sh.addColorStop(0, 'rgba(255,255,255,0.06)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, topY, W, (H - topY) * 0.25);
  },

  lava(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    // 연기 띠
    for (let i = 0; i < 4; i++) {
      const y = topY * (0.15 + i * 0.18);
      const sg = g.createLinearGradient(0, y - 12, 0, y + 12);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0.25)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.fillRect(0, y - 12, W, 24);
    }
    // 붉은 달
    const mx = cx + GW * 0.3;
    const my = topY * 0.42;
    const mr = GW * 0.09;
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, mx, my, mr * 3, '255,80,30', 0.35);
    g.restore();
    const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    mg.addColorStop(0, '#FFB070');
    mg.addColorStop(0.6, '#E8461A');
    mg.addColorStop(1, '#7A1406');
    g.fillStyle = mg;
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
    // 화산 (가운데 큰 것 + 옆 산)
    const mount = (x, w, h, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w, topY + 1);
      g.lineTo(x - w * 0.14, topY - h);
      g.lineTo(x + w * 0.14, topY - h);
      g.lineTo(x + w, topY + 1);
      g.fill();
    };
    mount(cx - GW * 0.45, GW * 0.35, topY * 0.28, '#2A0608');
    mount(cx + GW * 0.5, GW * 0.4, topY * 0.34, '#2A0608');
    const vh = topY * 0.42;
    mount(cx, GW * 0.42, vh, '#1A0304');
    // 분화구 빛 + 용암 줄기
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx, topY - vh, GW * 0.18, '255,110,30', 0.7);
    g.restore();
    g.strokeStyle = '#FF6A1A';
    g.lineCap = 'round';
    const r = rng(9);
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 1.5 + r() * 2;
      g.beginPath();
      let x = cx + (r() - 0.5) * GW * 0.1;
      let y = topY - vh;
      g.moveTo(x, y);
      while (y < topY) {
        y += vh * 0.12;
        x += (r() - 0.5) * GW * 0.04 + (x - cx) * 0.12;
        g.lineTo(x, Math.min(y, topY));
      }
      g.stroke();
    }
    // 땅 갈라진 틈
    g.save();
    g.shadowColor = '#FF5A1A';
    g.shadowBlur = 8;
    g.strokeStyle = 'rgba(255,110,40,0.8)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      let x = cx + side * (GW * 0.25 + r() * W * 0.5);
      let y = topY + (H - topY) * (0.05 + r() * 0.9);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * GW * 0.12;
        y += (r() - 0.3) * GW * 0.05;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  },

  aurora(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(31);
    // 별
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      g.fillRect(r() * W, r() * topY * 0.8, 1.3, 1.3);
    }
    // 오로라 띠 (정적 바탕. 움직이는 빛은 FX)
    g.save();
    g.globalCompositeOperation = 'lighter';
    auroraBands(g, L, 0, 0.55);
    g.restore();
    // 눈 덮인 산
    const peaks = [
      [cx - GW * 0.55, GW * 0.42, topY * 0.42],
      [cx - GW * 0.15, GW * 0.3, topY * 0.3],
      [cx + GW * 0.25, GW * 0.38, topY * 0.48],
      [cx + GW * 0.62, GW * 0.4, topY * 0.36],
    ];
    for (const [x, w, h] of peaks) {
      const mg = g.createLinearGradient(0, topY - h, 0, topY);
      mg.addColorStop(0, '#FFFFFF');
      mg.addColorStop(0.28, '#BFD6E6');
      mg.addColorStop(1, '#2A4A64');
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(x - w, topY + 1);
      g.lineTo(x - w * 0.1, topY - h);
      g.lineTo(x + w * 0.08, topY - h * 0.92);
      g.lineTo(x + w, topY + 1);
      g.fill();
      g.fillStyle = 'rgba(20,40,60,0.35)';
      g.beginPath();
      g.moveTo(x + w * 0.08, topY - h * 0.92);
      g.lineTo(x + w, topY + 1);
      g.lineTo(x + w * 0.2, topY + 1);
      g.fill();
    }
    // 눈밭 반짝이
    for (let i = 0; i < 120; i++) {
      const y = topY + (H - topY) * Math.pow(r(), 1.5);
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
      g.fillRect(r() * W, y, 1.5, 1.5);
    }
  },

  space(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(21);
    // 성운
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx - GW * 0.35, topY * 0.35, GW * 0.5, '150,60,220', 0.22, 0.5);
    radial(g, cx + GW * 0.35, topY * 0.6, GW * 0.45, '40,160,230', 0.18, 0.5);
    radial(g, cx, topY * 0.9, GW * 0.6, '255,90,200', 0.12, 0.5);
    g.restore();
    // 별
    for (let i = 0; i < 180; i++) {
      const y = r() * H;
      const s = r() < 0.1 ? 2.2 : r() < 0.4 ? 1.4 : 0.9;
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
      g.fillRect(r() * W, y, s, s);
    }
    // 고리 행성
    const px = cx - GW * 0.3;
    const py = topY * 0.45;
    const pr = GW * 0.085;
    const ring = () => {
      g.beginPath();
      g.ellipse(px, py, pr * 1.9, pr * 0.42, -0.3, 0, TAU);
    };
    g.lineWidth = pr * 0.16;
    g.strokeStyle = 'rgba(255,214,140,0.55)';
    ring();
    g.stroke();
    const pg = g.createRadialGradient(px - pr * 0.35, py - pr * 0.4, 0, px, py, pr);
    pg.addColorStop(0, '#FFE2B0');
    pg.addColorStop(0.6, '#E58A5A');
    pg.addColorStop(1, '#5A2A5A');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    // 고리 앞쪽 반
    g.save();
    g.beginPath();
    g.rect(px - pr * 2, py - pr * 0.05, pr * 4, pr);
    g.clip();
    g.strokeStyle = 'rgba(255,224,170,0.75)';
    ring();
    g.stroke();
    g.restore();
    // 작은 달
    g.fillStyle = '#CFD6FF';
    g.beginPath();
    g.arc(cx + GW * 0.36, topY * 0.25, GW * 0.025, 0, TAU);
    g.fill();
    // 지평선 빛줄기
    const hl = g.createLinearGradient(0, topY - 2, 0, topY + 6);
    hl.addColorStop(0, 'rgba(120,200,255,0)');
    hl.addColorStop(0.5, 'rgba(120,200,255,0.5)');
    hl.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = hl;
    g.fillRect(0, topY - 2, W, 8);
  },
};

/** 오로라 띠 (t = 시간으로 일렁임, a = 밝기) */
function auroraBands(g, L, t, a) {
  const { W, topY } = L;
  const bands = [
    ['120,255,200', 0.18, 0.12],
    ['140,180,255', 0.3, 0.1],
    ['200,140,255', 0.42, 0.08],
  ];
  bands.forEach(([col, fy, th], k) => {
    const y0 = topY * fy;
    const h = topY * th;
    g.beginPath();
    g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 12) g.lineTo(x, y0 + Math.sin(x / W * 6.3 + t * (0.5 + k * 0.2) + k) * h * 0.7);
    for (let x = W; x >= 0; x -= 12) g.lineTo(x, y0 + h * 2.2 + Math.sin(x / W * 5.1 + t * 0.4 + k * 2) * h * 0.5);
    g.closePath();
    const gr = g.createLinearGradient(0, y0 - h, 0, y0 + h * 2.6);
    gr.addColorStop(0, `rgba(${col},0)`);
    gr.addColorStop(0.35, `rgba(${col},${a * 0.6})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fill();
  });
}

// ------------------------------------------------------------------ 동적
// 매 프레임 그라데이션을 새로 만들면 느린 폰에서 버벅여서, 빛·기둥·햇살·오로라는 미리 그려 둔 그림(스프라이트)을
// 크기·투명도만 바꿔 찍음. quality: 2 = 전부 / 1 = 입자·테마 장식 빼고 조명만 / 0 = 동적 효과 없음
const BEAMS = { sunset: 'swing', city: 'swing', hall: 'down', void: 'down', lava: 'swing', space: 'swing', aurora: 'none' };

const glowCache = new Map();
/** 가운데가 밝은 동그란 빛 (색마다 한 번만 그림, 128px) */
function glowSprite(rgb) {
  let c = glowCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.4)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(rgb, c);
  return c;
}
/** 반지름 r 짜리 빛을 a 세기로 (ctx 는 이미 lighter 상태) */
function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0.004 || r <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

const beamCache = new Map();
/** 위에서 아래로 퍼지는 조명 기둥 (꼭대기 0,0 · 길이 1 · 끝 너비 1 기준으로 늘려 씀) */
function beamSprite(rgb) {
  let c = beamCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(30, 0);
  g.lineTo(0, 256);
  g.lineTo(64, 256);
  g.lineTo(34, 0);
  g.fill();
  beamCache.set(rgb, c);
  return c;
}
/** (x,y) 에서 ang 방향(0 = 아래)으로 len 길이, 끝 너비 w 인 기둥 */
function beam(ctx, x, y, ang, len, w, rgb, a) {
  if (a <= 0.004) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(beamSprite(rgb), -w / 2, 0, w, len);
  ctx.restore();
}

class SceneFx {
  constructor() {
    this.parts = [];
    this.last = 0;
    this.spawnAcc = 0;
    this._key = '';
  }

  reset() {
    this.parts = [];
  }

  /** 화면 크기·맵이 바뀌면 미리 그려 둘 것들 (햇살 바퀴·오로라 띠·아래 열기 그라데이션) */
  _prepare(ctx, L, T) {
    const key = `${T.key}:${L.W}x${L.H}`;
    if (this._key === key) return;
    this._key = key;
    this.rays = null;
    this.aurora = null;
    this.heatGrad = null;
    this.strobe = null;
    if (T.key === 'sunset') {
      const sr = L.GW * 0.26;
      const R = sr * 2.6;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.translate(128, 128);
      g.fillStyle = 'rgba(255,210,150,1)';
      for (let i = 0; i < 12; i++) {
        g.rotate((Math.PI * 2) / 12);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-128 * (0.12 / 2.6), -128);
        g.lineTo(128 * (0.12 / 2.6), -128);
        g.fill();
      }
      this.rays = { c, R };
    }
    if (T.key === 'aurora') {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(L.W / 2));
      c.height = Math.max(1, Math.round(L.topY / 2));
      const g = c.getContext('2d');
      g.scale(0.5, 0.5);
      auroraBands(g, L, 0, 1);
      this.aurora = c;
    }
    if (T.key === 'lava') {
      const gr = ctx.createLinearGradient(0, L.H, 0, L.H * 0.6);
      gr.addColorStop(0, 'rgba(255,70,10,1)');
      gr.addColorStop(1, 'rgba(255,70,10,0)');
      this.heatGrad = gr;
    }
    if (T.key === 'void') {
      const gr = ctx.createLinearGradient(0, 0, 0, L.strikeY);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      this.strobe = gr;
    }
  }

  /**
   * s = { rt, heat 0~1, beat(박 첫머리 1 → 0), barBeat(마디 첫 박이면 같은 값, 아니면 0),
   *       pe(킥 펀치), fever, playing, lite, quality(2·1·0) }
   */
  draw(ctx, L, T, s) {
    const dt = Math.min(0.05, Math.max(0, s.rt - (this.last || s.rt)));
    this.last = s.rt;
    const q = s.lite ? 0 : s.quality ?? 2;
    if (q <= 0) return;
    this._prepare(ctx, L, T);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this._beams(ctx, L, T, s, q);
    if (q >= 2) {
      const fx = FX[T.key];
      if (fx) fx.call(this, ctx, L, T, s);
    }
    // 곡이 달아오르면 지평선이 비트에 맞춰 크게 빛남
    const hk = s.heat * (0.55 + 0.45 * s.beat);
    glow(ctx, L.cx, L.topY, L.GW * (0.55 + 0.25 * s.beat), T.hot, 0.28 * hk);
    // 곡이 한 단계 달아오른 순간: 지평선에서 빛이 퍼짐 + 입자 한 번에
    if (s.surge > 0.01) {
      glow(ctx, L.cx, L.topY, L.GW * (0.5 + (1 - s.surge) * 0.9), T.hot, 0.45 * s.surge);
      if (!this._surging && q >= 2) for (let i = 0; i < 24 && this.parts.length < 110; i++) this.parts.push(spawn(T.particle, L, s));
      this._surging = true;
    } else this._surging = false;
    ctx.restore();
    if (q >= 2) this._particles(ctx, L, T, s, dt);
    else this.parts.length = 0;
  }

  _beams(ctx, L, T, s, q) {
    const mode = BEAMS[T.key];
    if (mode === 'none') return;
    const a0 = 0.05 + s.heat * 0.07 + s.beat * (0.03 + s.heat * 0.05) + s.pe * 0.1 + (s.fever ? 0.04 : 0);
    if (mode === 'down') {
      const lamps = T.key === 'void' ? rigLamps(L) : [0.12, 0.5, 0.88].map((f) => ({ x: L.GX + L.GW * f, y: 0 }));
      const yb = L.strikeY + (L.H - L.strikeY) * 0.2;
      const spread = L.GW * (0.32 + 0.1 * s.heat);
      lamps.forEach((p, k) => {
        if (q < 2 && k % 2) return;
        // 블랙 스테이지: 마디 첫 박에 조명이 하나씩 번갈아 '팍' (곡 절정일수록)
        const on = T.key === 'void' ? a0 * 0.6 + s.barBeat * s.heat * (k % 2 === (s.barIdx & 1) ? 0.22 : 0.05) : a0 * 0.8;
        beam(ctx, p.x, p.y + 6, 0, yb - p.y, spread, T.spots[k % T.spots.length], on * 1.6);
      });
      return;
    }
    const speed = (s.fever ? 1.6 : 0.6) * (0.7 + s.heat * 0.8);
    [0.08, 0.34, 0.66, 0.92].forEach((fx, k) => {
      if (q < 2 && (k === 1 || k === 2)) return;
      const x = L.GX + L.GW * fx;
      const ang = Math.sin(s.rt * speed + k * 1.7) * (0.3 + s.heat * 0.15) + (fx - 0.5) * -0.5;
      const col = T.spots[k];
      beam(ctx, x, L.H * 0.02, ang, L.H * 0.95, L.GW * 0.32, col, a0 * 2);
      glow(ctx, x, L.H * 0.022, L.GW * 0.03, col, 0.9);
    });
  }

  _particles(ctx, L, T, s, dt) {
    const kind = T.particle;
    // 곡이 달아오를수록 많이
    const rate = (PART_RATE[kind] || 6) * (0.35 + s.heat * 1.1) * (s.playing ? 1 : 0.4);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1 && this.parts.length < 60) {
      this.spawnAcc -= 1;
      this.parts.push(spawn(kind, L, s));
    }
    if (this.spawnAcc > 1) this.spawnAcc = 0;
    const keep = [];
    for (const p of this.parts) {
      const age = s.rt - p.t0;
      if (age > p.life || age < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      keep.push(p);
      const fade = Math.min(1, age / 0.3, (p.life - age) / 0.5);
      drawPart(ctx, p, fade, s);
    }
    this.parts = keep;
  }
}

const PART_RATE = { petal: 7, neon: 9, gold: 12, haze: 2.5, ember: 22, star: 14, snow: 18 };

function spawn(kind, L, s) {
  const r = Math.random;
  const p = { kind, t0: s.rt, rot: r() * TAU, vr: (r() - 0.5) * 3, size: 1, x: 0, y: 0, vx: 0, vy: 0, life: 4 };
  const W = L.W;
  const H = L.H;
  switch (kind) {
    case 'petal':
      Object.assign(p, { x: r() * W, y: -10, vx: 15 + r() * 30, vy: 30 + r() * 40, size: 3 + r() * 3, life: 9, col: r() < 0.6 ? '255,170,200' : '255,230,180' });
      break;
    case 'neon':
      Object.assign(p, { x: r() * W, y: H + 10, vx: 0, vy: -(40 + r() * 70), size: 1.5 + r() * 2.5, life: 9, col: r() < 0.5 ? '255,79,216' : '57,230,255' });
      break;
    case 'gold':
      // 절정이면 위에서 금빛 종이가루, 아니면 떠다니는 먼지
      if (s.heat > 0.7 && r() < 0.6)
        Object.assign(p, { x: r() * W, y: -10, vx: (r() - 0.5) * 30, vy: 60 + r() * 60, size: 3 + r() * 3, life: 9, col: r() < 0.5 ? '255,215,110' : '255,240,200', conf: true, vr: (r() - 0.5) * 8 });
      else Object.assign(p, { x: L.GX + r() * L.GW, y: r() * L.strikeY, vx: (r() - 0.5) * 8, vy: -4 - r() * 8, size: 1 + r() * 1.6, life: 4 + r() * 3, col: '255,220,150' });
      break;
    case 'snow':
      Object.assign(p, { x: r() * W, y: -6, vx: (r() - 0.3) * 20, vy: 25 + r() * 45, size: 1 + r() * 2.2, life: 14, col: '255,255,255' });
      break;
    case 'haze':
      Object.assign(p, { x: r() * W, y: L.topY + r() * (H - L.topY) * 0.6, vx: (r() < 0.5 ? -1 : 1) * (6 + r() * 10), vy: -2, size: L.GW * (0.2 + r() * 0.25), life: 8, col: '255,255,255' });
      break;
    case 'ember':
      Object.assign(p, { x: r() * W, y: H + 6, vx: (r() - 0.5) * 30, vy: -(60 + r() * 120), size: 1.2 + r() * 2.2, life: 6, col: r() < 0.6 ? '255,120,40' : '255,200,80' });
      break;
    case 'star': {
      // 소실점에서 바깥으로 튀어나오는 별 (워프)
      const a = r() * TAU;
      const sp = 60 + r() * 120 + s.heat * 260;
      Object.assign(p, { x: L.cx + Math.cos(a) * 6, y: L.topY + Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, size: 1 + r() * 1.4, life: 3, col: r() < 0.7 ? '255,255,255' : '160,200,255', warp: true });
      break;
    }
  }
  return p;
}

function drawPart(ctx, p, fade, s) {
  switch (p.kind) {
    case 'petal':
      ctx.save();
      ctx.globalAlpha = 0.7 * fade;
      ctx.translate(p.x + Math.sin(p.rot) * 6, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgb(${p.col})`;
      ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      ctx.restore();
      break;
    case 'gold':
      if (p.conf) {
        ctx.save();
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7 * Math.abs(Math.cos(p.rot * 2)));
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, p.x, p.y, p.size * 2.5, p.col, (0.5 + 0.4 * s.beat) * fade);
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    case 'haze':
      glow(ctx, p.x, p.y, p.size, '255,255,255', fade * 0.05);
      break;
    case 'snow':
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(p.x + Math.sin(p.rot) * 5 - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
      break;
    case 'star': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.9;
      const k = 0.03 + s.heat * 0.06;
      ctx.strokeStyle = `rgb(${p.col})`;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      ctx.stroke();
      ctx.restore();
      break;
    }
    default: {
      // neon · ember: 빛나는 점
      ctx.globalCompositeOperation = 'lighter';
      const x = p.x + (p.kind === 'ember' ? Math.sin(p.rot * 2) * 4 : 0);
      glow(ctx, x, p.y, p.size * 3, p.col, fade * (p.kind === 'ember' ? 0.9 : 0.6));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** 테마별 장식 (this = SceneFx, ctx 는 lighter 상태) */
const FX = {
  sunset(ctx, L, T, s) {
    // 해 뒤로 도는 햇살 (미리 그린 바퀴를 돌림)
    const sr = L.GW * 0.26;
    const sy = L.topY - sr * 0.12;
    if (this.rays) {
      ctx.save();
      ctx.translate(L.cx, sy);
      ctx.rotate(s.rt * 0.08);
      ctx.globalAlpha = Math.min(1, 0.04 + s.heat * 0.08 + s.beat * 0.04);
      const R = this.rays.R;
      ctx.drawImage(this.rays.c, -R, -R, R * 2, R * 2);
      ctx.restore();
    }
    // 전구가 박자마다 번갈아 반짝
    const pts = garland(L);
    const cols = ['255,224,122', '255,154,184', '154,230,255', '200,255,154'];
    const b = Math.floor(s.beatNo || 0);
    pts.forEach((p, i) => {
      const on = (i + b) % 2 === 0 ? s.beat : 0;
      glow(ctx, p.x, p.y + 4, 12 + 8 * on, cols[i % cols.length], 0.25 + 0.25 * s.heat + on * (0.4 + 0.4 * s.heat));
    });
  },
  city(ctx, L, T, s) {
    // 지평선 위 이퀄라이저 (박자·곡 세기에 맞춰)
    const n = 18;
    const w = L.GW / n;
    const b = Math.floor(s.beatNo || 0);
    ctx.globalAlpha = 0.25 + 0.3 * s.heat;
    for (let i = 0; i < n; i++) {
      const seed = Math.sin(i * 12.9898 + b * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed);
      const h = L.topY * 0.06 * (0.3 + rnd * (0.4 + s.heat)) * (0.5 + s.beat * 0.8);
      ctx.fillStyle = i % 2 ? 'rgb(57,230,255)' : 'rgb(255,79,216)';
      ctx.fillRect(L.GX + i * w + w * 0.15, L.topY - h, w * 0.7, h);
    }
    ctx.globalAlpha = 1;
  },
  hall(ctx, L, T, s) {
    // 금빛 오르간이 박자에 맞춰 은은하게
    glow(ctx, L.cx, L.topY - L.topY * 0.35, L.GW * 0.6, '255,210,120', 0.06 + 0.1 * s.heat * s.beat);
  },
  void(ctx, L, T, s) {
    // 절정: 마디 첫 박에 화면 위쪽이 하얗게 번쩍 (눈부시지 않게 약하게)
    if (this.strobe && s.heat > 0.6 && s.barBeat > 0) {
      ctx.globalAlpha = 0.14 * s.barBeat * s.heat;
      ctx.fillStyle = this.strobe;
      ctx.fillRect(0, 0, L.W, L.strikeY);
      ctx.globalAlpha = 1;
    }
  },
  lava(ctx, L, T, s) {
    // 분화구가 박자마다 끓어오름 + 화면 아래 열기
    const vh = L.topY * 0.42;
    glow(ctx, L.cx, L.topY - vh, L.GW * (0.2 + 0.1 * s.beat + 0.1 * s.heat), '255,100,20', 0.25 + 0.35 * s.beat * (0.4 + s.heat));
    if (this.heatGrad) {
      ctx.globalAlpha = 0.08 + 0.14 * s.heat;
      ctx.fillStyle = this.heatGrad;
      ctx.fillRect(0, L.H * 0.6, L.W, L.H * 0.4);
      ctx.globalAlpha = 1;
    }
  },
  aurora(ctx, L, T, s) {
    // 오로라가 박자·곡 세기에 맞춰 일렁이며 밝아짐 (미리 그린 띠를 좌우로 흔들며 겹쳐 찍음)
    if (!this.aurora) return;
    const a = Math.min(1, 0.12 + 0.25 * s.heat + 0.15 * s.beat);
    const dx = Math.sin(s.rt * 0.35) * L.W * 0.04;
    ctx.globalAlpha = a;
    ctx.drawImage(this.aurora, dx, 0, L.W, L.topY);
    ctx.globalAlpha = a * 0.5;
    ctx.drawImage(this.aurora, -dx * 1.6, L.topY * 0.03, L.W, L.topY);
    ctx.globalAlpha = 1;
  },
  space(ctx, L, T, s) {
    glow(ctx, L.cx, L.topY, L.GW * 0.35, '160,140,255', 0.1 + 0.2 * s.beat * (0.3 + s.heat));
  },
};

return { paintScenery, SceneFx };
})();

// ---- render.js ----
const __m_render = (() => {
// 게임 화면 그리기 (Canvas 2D)
// 콘셉트: 공연 무대 + 멀리서 다가오는 길(원근법). 길 맨 앞(판정선)에 악기가 놓여 있고, 줄 어디를 눌러도 그 악기가 울림.
//   노트는 먼 곳(화면 위, 작게)에서 나타나 점점 커지며 다가옴. 줄도 위로 갈수록 좁아짐.
//   노트는 드럼 게임 관례대로 킥 = 가로 막대, 스네어 = 둥근 드럼 헤드 패드, 하이햇/크래시 = 심벌.
// 타격감: 킥은 화면 전체가 '쿵' 하고 눌리고(펀치), 스네어는 '짝' 하고 옆으로 튀며 불꽃.

const { buildRasters } = __m_mascot;
const { buildKit, SNARE_RY } = __m_kit3d;
const { THEMES, themeForLevel, cycleTheme } = __m_themes;
const { paintScenery, SceneFx } = __m_scenery;

const LANE = [
  { key: 'kick', main: '#FF8A4C', light: '#FFC08F', dark: '#C9532A', rgb: '255,138,76', thumb: '왼쪽 엄지', word: '킥 (쿵)', short: '쿵' },
  { key: 'snare', main: '#62C8FF', light: '#D7F1FF', dark: '#2F86CF', rgb: '98,200,255', thumb: '오른쪽 엄지', word: '스네어 (짝)', short: '짝' },
  { key: 'hat', main: '#FFD24A', light: '#FFF2B8', dark: '#B9821C', rgb: '255,210,74', thumb: '오른쪽 엄지', word: '하이햇 (츠)', short: '츠' },
  { key: 'crash', main: '#C38BFF', light: '#EBDDFF', dark: '#7F4CCF', rgb: '195,139,255', thumb: '왼쪽 엄지', word: '크래시 (챙)', short: '챙' },
  { key: 'tom', main: '#4FE0A6', light: '#C9FBE6', dark: '#1F9E70', rgb: '79,224,166', thumb: '왼쪽 엄지', word: '탐탐 (둥)', short: '둥' },
];
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const CRASH = 3;
const TOM = 4;

const JUDGE_STYLE = {
  perfect: { text: 'PERFECT', color: '#FFE45C' },
  great: { text: 'GREAT', color: '#7CF5B4' },
  good: { text: 'GOOD', color: '#9CC8FF' },
  miss: { text: 'MISS', color: '#FF6B8A' },
  wrong: { text: '헛침!', color: '#FF6B8A' },
};

const INK = '#2B1D3A';
const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** 지금 박자 안에서의 위치 0~1 (빠르기가 바뀌어도 박자 시계를 따라감) */
function beatPhase(st) {
  if (st.tempo) return ((st.tempo.beatAt(st.now) % 1) + 1) % 1;
  return st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.rasters = null;
    this.studio = null; // 영상 찍기: { top, bottom, label }
    this.laneOrder = [KICK, SNARE]; // 화면 왼쪽부터 악기 순서
    this.newLane = -1; // 이번 단계에 새로 나온 악기 (카운트인 때 NEW 표시)
    this.themeKey = 'sunset'; // 맵 분위기 (themes.js)
    this.themeCycle = false; // 그리그 무제한·챌린지: Lv 마다 맵이 바뀜
    this.scene = new SceneFx();
    this.quality = 2; // 자동 화질 (_autoQuality)
    this.reset();
  }

  reset() {
    this.fx = { judges: [], sparks: [], bursts: [], booms: [], banners: [] };
    this.hitAt = [-9, -9, -9, -9, -9];
    this.missAt = [-9, -9, -9, -9, -9];
    this.punchAt = -9;
    this.punchPow = 0;
    this.crackAt = -9;
    this.comboPopAt = -9;
    this.cheerUntil = -9;
    this.lifeFx = { t0: -9, delta: 0 };
    this.roundFx = null;
    this.rollFx = null;
    this.heatS = 0;
    this.themeFx = null; // 맵 바뀔 때 { t0, prev(캔버스) } → 이전 맵이 서서히 사라짐
    if (this.scene) this.scene.reset();
  }

  /**
   * 자동 화질: 화면이 버벅이면(프레임 간격 평균이 26ms 넘게 1.5초) 효과를 한 단계씩 줄임.
   *   2 = 전부 / 1 = 입자·테마 장식 빼고 조명만 / 0 = 움직이는 무대 효과 없음 (영상 찍기는 항상 2)
   *   한 번 내려간 화질은 이 기기에 기억 (onQualityDrop 으로 저장)
   */
  _autoQuality(st, rt) {
    const dt = rt - (this._lastDraw || rt);
    if (!st.playing || this.studio || this.lite || !(dt > 0) || dt > 0.25) return;
    this._ema = this._ema == null ? dt : this._ema * 0.94 + dt * 0.06;
    if (this._ema > 0.026) {
      this._slowFor = (this._slowFor || 0) + dt;
      if (this._slowFor > 1.5 && this.quality > 0) {
        this.quality--;
        this._slowFor = 0;
        this._ema = 1 / 60;
        if (this.onQualityDrop) this.onQualityDrop(this.quality);
      }
    } else this._slowFor = Math.max(0, (this._slowFor || 0) - dt);
  }

  /** 이 판의 맵 정하기 (단계 묶음별). 화면 크기가 정해진 뒤 resize() 가 그림을 만듦 */
  setTheme(lv) {
    const t = themeForLevel(lv);
    this.themeBase = t.key;
    this.themeCycle = t.cycle;
    if (this.themeKey !== t.key) {
      this.themeKey = t.key;
      this._themeDirty = true;
    }
    this.themeFx = null;
  }

  get theme() {
    return THEMES[this.themeKey] || THEMES.sunset;
  }

  /** 판 도중 맵 바꾸기 (무제한 Lv 업): 지금 배경을 남겨 두고 새 배경 위로 서서히 사라지게 */
  _switchTheme(key, rt) {
    if (key === this.themeKey || !this.L) return;
    const prev = this.bg;
    this.bg = document.createElement('canvas');
    this.themeKey = key;
    this._buildKit();
    this._drawStatic();
    this.themeFx = { t0: rt, prev, key };
    this.scene.reset();
  }

  _buildKit() {
    const L = this.L;
    this.kit = buildKit(
      this.theme,
      { instR: L.instR, padR: L.padR, barW: L.barW, barH: L.barH, cymR: L.cymR, dpr: L.dpr, standTo: L.H - L.strikeY },
      LANE
    );
  }

  /** 레벨업 챌린지: 새 단계 (화면 가운데 "Lv.3" 크게) */
  onRound(info, rt) {
    this.roundFx = { info, t0: rt };
  }

  /**
   * 피아노 타일처럼: 화면을 레인 수만큼 세로 줄로 나누고, 줄 맨 아래에 그 줄의 악기가 놓임.
   * 줄 아무 데나 누르면 그 악기가 울림 (악기를 정확히 안 눌러도 됨).
   */
  async resize(maxDpr = 2) {
    // 저사양 모드: 화면 픽셀 수를 줄임 (레티나 2~3배 → 1배). 영상 찍기(studio)는 그대로
    //   자동 화질이 0까지 내려간 기기는 1.5배로 (다음 판부터)
    const dpr = this.studio ? maxDpr : Math.min(window.devicePixelRatio || 1, this.lite ? 1 : this.quality <= 0 ? 1.5 : maxDpr);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    const GW = Math.min(W, H * 0.62);
    const GX = (W - GW) / 2;
    const studio = !!this.studio;
    const n = this.laneOrder.length;
    // 판정선에서 길 폭. 아래로 갈수록 더 넓어지니 조금 좁게
    const RW = GW * 0.9;
    const laneW = RW / n;
    const L = {
      W, H, dpr, GW, GX, studio, n, laneW,
      cx: W / 2,
      topY: H * (studio ? 0.25 : 0.18),
      // 판정선은 엄지에 안 가리게 조금 위로. 그 아래 빈 줄이 엄지 올려두는 자리
      strikeY: H * (studio ? 0.64 : 0.655),
      laneX: [],
      laneHalf: laneW / 2,
    };
    L.x0 = W / 2 - RW / 2;
    L.x1 = W / 2 + RW / 2;
    this.laneOrder.forEach((lane, i) => (L.laneX[lane] = L.x0 + laneW * (i + 0.5)));
    // 원근: 노트까지 거리 d(판정선=0, 가장 먼 곳=FAR) → 크기 s = CAM / (CAM + d)
    //   화면 y = horizonY + (strikeY - horizonY) * s,  x = cx + (x0 - cx) * s
    L.cam = 1;
    L.far = 2.8;
    L.sFar = L.cam / (L.cam + L.far);
    L.horizonY = (L.topY - L.strikeY * L.sFar) / (1 - L.sFar);
    L.sBottom = (H - L.horizonY) / (L.strikeY - L.horizonY);
    // 줄 맨 아래 악기 크기 (판정선 위치에 악기 중심)
    L.instR = Math.min(laneW * 0.36, H * 0.07, GW * 0.17);
    L.barW = Math.min(laneW * 0.8, GW * 0.34);
    L.barH = GW * 0.046;
    L.padR = Math.min(laneW * 0.3, GW * 0.085);
    L.cymR = Math.min(laneW * 0.4, GW * 0.13);
    L.mascotW = GW * 0.17;
    L.mascotBase = H - 4;
    this.L = L;
    const drumPx = Math.round(L.instR * 2.7 * dpr);
    const key = `${Math.round(L.mascotW * dpr)}x${drumPx}`;
    if (this._rasterKey !== key) {
      this.rasters = await buildRasters(Math.round(L.mascotW * dpr), drumPx);
      this._rasterKey = key;
    }
    this._buildKit();
    this._themeDirty = false;
    this._drawStatic();
  }

  /** 화면 좌표(캔버스 기준) → 그 줄의 악기. 비스듬한 줄 모양 그대로 판단, 길 밖이면 가까운 줄 */
  laneAt(x, y) {
    const L = this.L;
    const order = this.laneOrder;
    if (!L) return order[0];
    const s = y === undefined ? 1 : clamp(this._sAtY(y), L.sFar, L.sBottom);
    const xw = L.cx + (x - L.cx) / s;
    const i = Math.floor((xw - L.x0) / L.laneW);
    return order[clamp(i, 0, order.length - 1)];
  }

  // ---------- 원근 ----------
  /** 남은 시간 dt → 크기 배율 s (판정선 1, 멀수록 작아짐) */
  _s(dt, approach) {
    const L = this.L;
    const d = Math.max(-0.6 * L.cam, (dt / approach) * L.far);
    return L.cam / (L.cam + d);
  }
  _py(s) {
    const L = this.L;
    return L.horizonY + (L.strikeY - L.horizonY) * s;
  }
  _px(x, s) {
    return this.L.cx + (x - this.L.cx) * s;
  }
  _sAtY(y) {
    const L = this.L;
    return (y - L.horizonY) / (L.strikeY - L.horizonY);
  }
  /** 길 위 사다리꼴 (월드 x 범위 xa~xb, 화면 y 범위 ya~yb) */
  _trap(g, xa, xb, ya, yb) {
    const sa = this._sAtY(ya);
    const sb = this._sAtY(yb);
    g.beginPath();
    g.moveTo(this._px(xa, sa), ya);
    g.lineTo(this._px(xb, sa), ya);
    g.lineTo(this._px(xb, sb), yb);
    g.lineTo(this._px(xa, sb), yb);
    g.closePath();
  }

  _drawStatic() {
    const L = this.L;
    const T = this.theme;
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    // 맵 배경 (하늘·땅·장식)
    paintScenery(g, L, T);
    // 원근 길(레인): 위(먼 곳)는 좁고 아래(가까운 곳)는 넓음. 줄 전체가 버튼
    const y0 = L.topY;
    const padTop = L.strikeY - L.instR * 1.45;
    const tint = T.laneTint;
    this.laneOrder.forEach((lane, i) => {
      const C = LANE[lane];
      const xa = L.x0 + L.laneW * i;
      const xb = xa + L.laneW;
      const lg = g.createLinearGradient(0, y0, 0, L.H);
      lg.addColorStop(0, `rgba(${C.rgb},${0.03 * tint})`);
      lg.addColorStop((padTop - y0) / (L.H - y0), `rgba(${C.rgb},${0.2 * tint})`);
      lg.addColorStop(1, `rgba(${C.rgb},${0.36 * tint})`);
      this._trap(g, xa, xb, y0, L.H);
      g.fillStyle = T.laneBase;
      g.fill();
      g.fillStyle = lg;
      g.fill();
      // 바닥 광택: 무대 바닥이 살짝 반사되는 느낌 (줄 가운데가 밝음)
      const xm = (xa + xb) / 2;
      const sheen = g.createLinearGradient(this._px(xa, 1), 0, this._px(xb, 1), 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      this._trap(g, xa, xb, y0, L.H);
      g.fillStyle = sheen;
      g.fill();
      // 바닥 무늬: 길 따라 가운데 가는 줄
      const ml = g.createLinearGradient(0, y0, 0, L.strikeY);
      ml.addColorStop(0, `rgba(${C.rgb},0)`);
      ml.addColorStop(1, `rgba(${C.rgb},${0.28 * tint})`);
      g.strokeStyle = ml;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(this._px(xm, L.sFar), y0);
      g.lineTo(xm, L.strikeY);
      g.stroke();
      // 아래쪽 '누르는 판' (악기가 놓인 자리)
      const m = Math.min(8, L.laneW * 0.06);
      this._trap(g, xa + m, xb - m, padTop, L.H + 20);
      g.fillStyle = `rgba(${C.rgb},${0.16 * tint})`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = `rgba(${T.rail || C.rgb},${0.55 * (T.rail ? 0.5 : 1)})`;
      g.stroke();
    });
    // 줄 사이 구분선 (소실점 쪽으로 모임) — 두께 있는 레일처럼
    for (let i = 0; i <= this.laneOrder.length; i++) {
      const x = L.x0 + L.laneW * i;
      const lane = this.laneOrder[Math.min(i, this.laneOrder.length - 1)];
      const edge = i === 0 || i === this.laneOrder.length;
      const rgb = T.rail || LANE[lane].rgb;
      const lg = g.createLinearGradient(0, y0, 0, L.H);
      lg.addColorStop(0, 'rgba(255,255,255,0.08)');
      lg.addColorStop(0.7, `rgba(${rgb},${edge ? 0.9 : 0.6})`);
      lg.addColorStop(1, `rgba(${rgb},0.3)`);
      // 레일 그림자(아래 어두운 선) → 입체감
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = edge ? 5 : 3;
      g.beginPath();
      g.moveTo(this._px(x, L.sFar) + 1, y0 + 1);
      g.lineTo(this._px(x, L.sBottom) + 2, L.H + 2);
      g.stroke();
      g.strokeStyle = lg;
      g.lineWidth = edge ? 3.5 : 2;
      if (edge) {
        g.shadowColor = `rgba(${rgb},0.8)`;
        g.shadowBlur = 10;
      }
      g.beginPath();
      g.moveTo(this._px(x, L.sFar), y0);
      g.lineTo(this._px(x, L.sBottom), L.H);
      g.stroke();
      g.shadowBlur = 0;
    }
    // 길 끝(먼 곳)
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(this._px(L.x0, L.sFar), y0 - 1, (L.x1 - L.x0) * L.sFar, 2);
    // 먼 곳 안개
    const fog = g.createLinearGradient(0, y0 - 2, 0, y0 + (L.strikeY - y0) * 0.22);
    fog.addColorStop(0, `rgba(${T.fog},0.75)`);
    fog.addColorStop(1, `rgba(${T.fog},0)`);
    g.fillStyle = fog;
    g.fillRect(this._px(L.x0, L.sFar) - 20, y0 - 2, (L.x1 - L.x0) * L.sFar + 40, (L.strikeY - y0) * 0.22 + 2);
    // 악기 발밑 그림자 고리 (무대 바닥에 놓인 느낌)
    for (const lane of this.laneOrder) {
      const x = L.laneX[lane];
      const r = L.instR * 1.25;
      g.save();
      g.translate(x, L.strikeY + L.instR * 0.55);
      g.scale(1, 0.28);
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      sg.addColorStop(0, 'rgba(0,0,0,0.45)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // ---------- 이벤트 ----------
  onTap(lane, rt) {
    this.hitAt[lane] = rt;
    if (lane === KICK) {
      this.punchAt = rt;
      this.punchPow = 0.6;
    } else if (lane === SNARE) this.crackAt = rt;
  }

  onJudge(lane, judge, rt, early) {
    const L = this.L;
    const style = JUDGE_STYLE[judge];
    this.fx.judges.push({ lane, text: style.text, color: style.color, t0: rt, sub: judge === 'perfect' || judge === 'miss' || judge === 'wrong' ? '' : early ? 'FAST' : 'SLOW' });
    if (judge === 'miss' || judge === 'wrong') {
      this.missAt[lane] = rt;
      return;
    }
    const pow = judge === 'perfect' ? 1 : judge === 'great' ? 0.8 : 0.55;
    this.fx.bursts.push({ lane, t0: rt, pow });
    if (lane === KICK) {
      this.punchAt = rt;
      this.punchPow = pow;
      this.fx.booms.push({ t0: rt, pow });
    } else {
      if (lane === SNARE) this.crackAt = rt;
      const at = [L.laneX[lane], L.strikeY - L.instR * 0.2];
      const n = this.lite && !this.studio ? 0 : judge === 'perfect' ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        this.fx.sparks.push({
          x: at[0],
          y: at[1],
          a,
          sp: L.GW * (0.5 + Math.random() * 0.8),
          t0: rt,
          life: 0.22 + Math.random() * 0.18,
          len: L.GW * (0.03 + Math.random() * 0.04),
          color: Math.random() < 0.5 ? '#FFFFFF' : Math.random() < 0.5 ? '#FFE45C' : LANE[lane].light,
        });
      }
    }
  }

  /** 목숨 변화: delta < 0 이면 빨간 테두리 번쩍 */
  onLife(lives, delta, rt) {
    this.lifeFx = { t0: rt, delta, lives };
  }

  /** 💥 연타 한 번 */
  onRoll(roll, rt) {
    this.rollFx = { id: roll.id, lane: roll.lane, hits: roll.hits, hearts: roll.hearts, t: rt };
    this.hitAt[roll.lane] = rt;
    this.fx.bursts.push({ lane: roll.lane, t0: rt, pow: 0.6 });
  }

  /** ✨ 황금 콩을 침 */
  onGold(lane, healed, rt) {
    this.fx.banners.push({ text: healed ? '✨ 황금 콩! ❤️+1' : '✨ 황금 콩!', t0: rt, color: '#FFD84A' });
    const L = this.L;
    if (this.lite && !this.studio) return;
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.8;
      this.fx.sparks.push({ x: L.laneX[lane], y: L.strikeY, a, sp: L.GW * (0.5 + Math.random() * 0.9), t0: rt, life: 0.3 + Math.random() * 0.25, len: L.GW * 0.04, color: Math.random() < 0.6 ? '#FFD84A' : '#FFFFFF' });
    }
  }

  onCombo(combo, rt) {
    this.comboPopAt = rt;
    if (combo > 0 && combo % 25 === 0) {
      this.fx.banners.push({ text: `${combo} COMBO!`, t0: rt });
      this.cheerUntil = rt + 1.0;
    }
  }

  // ---------- 그리기 ----------
  draw(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    if (!L) return;
    const lite = this.lite && !this.studio;
    // 저사양 모드: 120Hz 화면에서도 초당 60번까지만 그림 (판정은 그대로)
    if (lite && rt - (this._lastDraw || 0) < 1 / 65 && rt >= (this._lastDraw || 0)) return;
    this._autoQuality(st, rt);
    this._lastDraw = rt;
    const q = lite ? 0 : this.studio ? 2 : this.quality;
    const pe = Math.exp(-(rt - this.punchAt) * 22) * this.punchPow; // 킥 펀치
    const ce = Math.exp(-(rt - this.crackAt) * 30); // 스네어 크랙
    // 무제한·챌린지: Lv 이 오르면 맵이 바뀜 (저사양 모드는 그대로)
    if (this.themeCycle && !lite && st.round && st.round.round) {
      const key = cycleTheme(st.round.round);
      if (key !== this.themeKey) this._switchTheme(key, rt);
    }
    // 곡이 달아오른 정도 (부드럽게 따라감)
    const dtr = Math.min(0.1, Math.max(0, rt - (this._heatAt || rt)));
    this._heatAt = rt;
    this.heatS += ((st.heat ?? 0) - this.heatS) * Math.min(1, dtr * 1.5);
    // 곡이 한 단계 달아오르는 순간(악기가 늘어날 때) 무대가 '확' 밝아짐
    const hNow = st.heat ?? 0;
    if (hNow > (this._lastHeat ?? hNow) + 0.2) this.surgeAt = rt;
    this._lastHeat = hNow;
    const surge = rt - (this.surgeAt ?? -9) < 1.6 ? Math.exp(-(rt - this.surgeAt) * 2.2) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    const tf = this.themeFx;
    if (tf) {
      const k = (rt - tf.t0) / 1.2;
      if (k >= 1 || k < 0) this.themeFx = null;
      else {
        ctx.globalAlpha = 1 - easeOut(k);
        ctx.drawImage(tf.prev, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const fever = st.combo >= 30;

    const bt = st.tempo ? st.tempo.beatAt(st.now) : st.beatDur ? st.now / st.beatDur : 0;
    const bph = ((bt % 1) + 1) % 1;
    const beat = st.playing && st.now >= 0 ? Math.pow(1 - bph, 3) : 0;
    const inBar = (((bt % 4) + 4) % 4);
    this.scene.draw(ctx, L, this.theme, {
      rt,
      heat: this.heatS,
      beat,
      beatNo: Math.floor(bt),
      barBeat: inBar < 1 ? beat : 0,
      barIdx: Math.floor(bt / 4),
      pe,
      fever,
      surge,
      playing: !!st.playing,
      lite,
      quality: q,
    });
    if (!lite) this._drawLaneFlash(rt);
    ctx.save();
    const sc = 1 + pe * 0.012;
    ctx.translate(L.cx, L.strikeY);
    ctx.scale(sc, sc);
    ctx.translate(-L.cx + (Math.random() - 0.5) * ce * 3, -L.strikeY + pe * 3);

    this._drawBeatLines(st);
    this._drawCombo(st, rt);
    this._drawInstruments(st, rt, pe);
    this._drawTargets(st, rt);
    this._drawRolls(st, rt);
    this._drawNotes(st);
    this._drawBursts(rt);
    if (q >= 1) this._drawSparks(rt);
    this._drawJudges(rt);
    this._drawRollCount(st, rt);
    ctx.restore();

    if (!lite) this._drawMascot(st, rt);
    this._drawBanners(rt);
    if (!this.studio) this._drawRound(st, rt);
    this._drawCountIn(st, rt);
    this._drawThemeChip(st, rt);
    this._drawLifeFx(st, rt);
    if (this.studio) this._drawStudio(st, rt);
  }

  /** 목숨 깎이면 화면 가장자리가 빨갛게, 다 떨어지면 화면이 어두워짐 */
  _drawLifeFx(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const f = this.lifeFx;
    const age = rt - f.t0;
    const lost = f.delta < 0 && age < 0.5 ? 1 - age / 0.5 : 0;
    const low = st.lives != null && st.lives === 1 && !st.dead ? 0.35 + 0.25 * Math.sin(rt * 6) : 0;
    const k = Math.max(lost, low, st.dead ? 1 : 0);
    if (k > 0) {
      const gr = ctx.createRadialGradient(L.cx, L.H / 2, Math.min(L.W, L.H) * 0.3, L.cx, L.H / 2, Math.max(L.W, L.H) * 0.75);
      gr.addColorStop(0, 'rgba(255,40,80,0)');
      gr.addColorStop(1, `rgba(255,40,80,${0.55 * k})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    if (st.dead) {
      ctx.fillStyle = 'rgba(14,6,30,0.55)';
      ctx.fillRect(0, 0, L.W, L.H);
    }
    // 회복: 초록빛 반짝
    if (f.delta > 0 && age < 0.45) {
      const gr = ctx.createRadialGradient(L.cx, L.H / 2, Math.min(L.W, L.H) * 0.3, L.cx, L.H / 2, Math.max(L.W, L.H) * 0.75);
      gr.addColorStop(0, 'rgba(124,245,180,0)');
      gr.addColorStop(1, `rgba(124,245,180,${0.35 * (1 - age / 0.45)})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, L.W, L.H);
    }
  }

  /** 누른 줄 전체가 번쩍 (줄 어디를 눌러도 된다는 느낌) */
  _drawLaneFlash(rt) {
    const ctx = this.ctx;
    const L = this.L;
    for (const lane of this.laneOrder) {
      const a = rt - this.hitAt[lane];
      if (a > 0.18) continue;
      const k = 1 - a / 0.18;
      const x = L.laneX[lane] - L.laneHalf;
      const gr = ctx.createLinearGradient(0, L.topY, 0, L.H);
      gr.addColorStop(0, `rgba(${LANE[lane].rgb},0)`);
      gr.addColorStop(0.75, `rgba(${LANE[lane].rgb},${0.28 * k})`);
      gr.addColorStop(1, `rgba(${LANE[lane].rgb},${0.45 * k})`);
      ctx.fillStyle = gr;
      this._trap(ctx, x, x + L.laneW, L.topY, L.H);
      ctx.fill();
    }
  }


  _y(dt, approach) {
    return this._py(this._s(dt, approach));
  }

  _drawBeatLines(st) {
    const ctx = this.ctx;
    const L = this.L;
    if (!st.beatDur && !st.tempo) return;
    const sub = st.beatDur / 2;
    const first = st.tempo ? Math.ceil(st.tempo.beatAt(st.now) * 2) : Math.ceil(st.now / sub);
    for (let b = first; b < first + 400; b++) {
      const dt = (st.tempo ? st.tempo.beatTime(b / 2) : b * sub) - st.now;
      if (dt > st.approach) break;
      const s = this._s(dt, st.approach);
      const y = this._py(s);
      if (y < L.topY + 4) continue;
      const bar = b % 8 === 0;
      const beat = b % 2 === 0;
      ctx.strokeStyle = bar ? 'rgba(255,255,255,0.4)' : beat ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = (bar ? 2.5 : 1.2) * Math.max(0.5, s);
      for (const i of this.laneOrder) {
        ctx.beginPath();
        ctx.moveTo(this._px(L.laneX[i] - L.laneHalf + 4, s), y);
        ctx.lineTo(this._px(L.laneX[i] + L.laneHalf - 4, s), y);
        ctx.stroke();
      }
    }
  }

  /** 판정선: 악기 위를 가로지르는 밝은 선 + 악기마다 고리 */
  _drawTargets(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = beatPhase(st);
    const pulse = st.playing ? Math.pow(1 - phase, 3) : 0;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(L.x0, L.strikeY);
    ctx.lineTo(L.x1, L.strikeY);
    ctx.stroke();
    // 박자마다 은은한 빛 (shadowBlur 는 느린 폰에서 무거워서 두꺼운 반투명 선으로)
    if (pulse > 0.05) {
      ctx.strokeStyle = `rgba(255,255,255,${0.18 * pulse})`;
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    ctx.restore();
    const k = 1 + pulse * 0.05;
    for (const lane of this.laneOrder) {
      const x = L.laneX[lane];
      const lit = rt - this.hitAt[lane] < 0.1;
      const c = LANE[lane].rgb;
      ctx.beginPath();
      if (lane === KICK) rr(ctx, x - (L.barW * k) / 2, L.strikeY - (L.barH * k) / 2, L.barW * k, L.barH * k, (L.barH * k) / 2);
      else if (lane === SNARE || lane === TOM) ctx.ellipse(x, L.strikeY, L.padR * 1.1 * k, L.padR * 1.1 * k * 0.62, 0, 0, Math.PI * 2);
      else {
        const rx = this._cymR(lane) * k;
        ctx.ellipse(x, L.strikeY, rx, rx * 0.36, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${c},${lit ? 0.5 : 0.1})`;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash(lit ? [] : [7, 5]);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }


  _cymR(lane) {
    return this.L.cymR * (lane === CRASH ? 1 : 0.86);
  }


  /** 💥 연타 구간: 줄 위에 길게 빛나는 띠 (줄무늬가 흘러내림) + 시작 쪽에 '연타!' */
  _drawRolls(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    for (const r of st.rolls || []) {
      if (!this.laneOrder.includes(r.lane)) continue;
      const d0 = r.t0 - st.now;
      const d1 = r.t1 - st.now;
      if (d0 > st.approach || d1 < -0.2) continue;
      const s0 = this._s(Math.max(d0, -0.2), st.approach);
      const s1 = this._s(Math.min(d1, st.approach), st.approach);
      const yNear = this._py(s0);
      const yFar = this._py(s1);
      const C = LANE[r.lane];
      const xa = L.laneX[r.lane] - L.laneHalf * 0.72;
      const xb = L.laneX[r.lane] + L.laneHalf * 0.72;
      const active = d0 <= 0 && d1 >= 0;
      ctx.save();
      this._trap(ctx, xa, xb, yFar, yNear);
      const gr = ctx.createLinearGradient(0, yFar, 0, yNear);
      gr.addColorStop(0, `rgba(${C.rgb},0.15)`);
      gr.addColorStop(1, `rgba(${C.rgb},${active ? 0.75 : 0.55})`);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,255,255,${active ? 0.95 : 0.7})`;
      ctx.stroke();
      // 흘러내리는 줄무늬
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 6;
      const span = Math.max(1, yNear - yFar);
      const off = ((rt * 260) % 28) - 28;
      for (let y = yFar + off; y < yNear + 28; y += 28) {
        ctx.beginPath();
        ctx.moveTo(this._px(xa, this._sAtY(y)) - 30, y + 14);
        ctx.lineTo(this._px(xb, this._sAtY(y)) + 30, y - 14);
        ctx.stroke();
      }
      ctx.restore();
      // 시작 쪽 글자
      if (!active && d0 > 0) {
        const fs = Math.round(Math.min(L.laneW * 0.24, L.GW * 0.06) * Math.max(0.5, s0));
        ctx.save();
        ctx.font = `${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = fs * 0.24;
        ctx.strokeStyle = INK;
        ctx.strokeText('연타!', this._px(L.laneX[r.lane], s0), yNear - fs * 0.7);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('연타!', this._px(L.laneX[r.lane], s0), yNear - fs * 0.7);
        ctx.restore();
      }
    }
  }

  /** 💥 연타 중: 악기 위에 '×12' 큰 숫자 + 끝나면 '연타 23!' */
  _drawRollCount(st, rt) {
    const f = this.rollFx;
    if (!f) return;
    const roll = (st.rolls || []).find((r) => r.id === f.id);
    const age = rt - f.t;
    const over = roll && st.now > roll.t1 + 0.1;
    if (age > (over ? 1.2 : 0.9)) return;
    const ctx = this.ctx;
    const L = this.L;
    const x = L.laneX[f.lane];
    const pop = 1 + Math.max(0, 0.25 - age) * 1.6;
    const fs = Math.round(Math.min(L.laneW * 0.42, L.GW * 0.11) * pop);
    ctx.save();
    ctx.globalAlpha = age > 0.6 ? Math.max(0, 1 - (age - 0.6) / 0.6) : 1;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.2;
    ctx.strokeStyle = INK;
    const y = L.strikeY - L.instR * 2.4;
    const t = over ? `연타 ${f.hits}!` : `×${f.hits}`;
    ctx.strokeText(t, x, y);
    ctx.fillStyle = LANE[f.lane].light;
    ctx.fillText(t, x, y);
    if (f.hearts) {
      ctx.font = `${Math.round(fs * 0.45)}px ${FONT}`;
      ctx.lineWidth = fs * 0.1;
      ctx.strokeText(`❤️+${f.hearts}`, x, y + fs * 0.75);
      ctx.fillStyle = '#FF8FB0';
      ctx.fillText(`❤️+${f.hearts}`, x, y + fs * 0.75);
    }
    ctx.restore();
  }

  _drawNotes(st) {
    const ctx = this.ctx;
    const L = this.L;
    const vis = [];
    for (const n of st.notes) {
      const dt = n.time - st.now;
      if (dt > st.approach) break;
      if (n.judged && n.result !== 'miss') continue;
      if (dt < -0.25) continue;
      vis.push(n);
    }
    // 동시치기: 두 노트를 점선으로 잇기
    const seen = new Map();
    for (const n of vis) {
      if (n.pair < 0 || n.judged) continue;
      const o = seen.get(n.pair);
      if (o) {
        const ps = this._s(n.time - st.now, st.approach);
        const y = this._py(ps);
        const [a, b] = [o, n].sort((p, q) => L.laneX[p.lane] - L.laneX[q.lane]);
        ctx.strokeStyle = 'rgba(255,228,92,0.85)';
        ctx.lineWidth = 3 * ps;
        ctx.setLineDash([6 * ps, 5 * ps]);
        ctx.beginPath();
        ctx.moveTo(this._px(L.laneX[a.lane] + L.laneHalf * 0.8, ps), y);
        ctx.lineTo(this._px(L.laneX[b.lane] - L.laneHalf * 0.8, ps), y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else seen.set(n.pair, n);
    }
    for (let k = vis.length - 1; k >= 0; k--) {
      const n = vis[k];
      const dt = n.time - st.now;
      const ps = this._s(dt, st.approach);
      const y = this._py(ps);
      const x = this._px(L.laneX[n.lane], ps);
      let a = clamp((1 - dt / st.approach) / 0.1, 0, 1);
      if (dt < 0) a *= clamp(1 + dt * 5, 0, 1);
      if (n.judged) a *= 0.55;
      ctx.save();
      ctx.translate(x, y);
      // 바닥에 누운 느낌: 멀수록 살짝 더 납작
      ctx.scale(ps, ps * (0.82 + 0.18 * Math.min(1, ps)));
      // 3D 노트 스프라이트 (킥 = 두께 있는 막대, 스네어 = 작은 드럼, 하이햇·크래시 = 작은 심벌)
      const sp = this.kit.notes[n.judged ? 'grey' : 'live'][n.lane];
      // ✨ 황금 콩: 금빛 후광 + 반짝이
      // ✨ 황금 콩: 노트 자체를 금색으로 + 뒤에서 은은하게 빛남 (박자처럼 숨 쉬듯)
      const gold = n.gold && !n.judged && this.kit.notes.gold;
      if (gold) {
        const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 160 + n.id);
        const R = Math.max(sp.w, sp.h) * 0.75;
        ctx.globalAlpha = a * pulse;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(goldGlow(), -R, -R * 0.62, R * 2, R * 1.24);
        ctx.globalCompositeOperation = 'source-over';
      }
      const img = gold ? this.kit.notes.gold[n.lane] : sp;
      ctx.globalAlpha = a;
      ctx.drawImage(img.img, -img.ax, -img.ay, img.w, img.h);
      ctx.restore();
    }
  }

  _drawBursts(rt) {
    const ctx = this.ctx;
    const L = this.L;
    this.fx.bursts = this.fx.bursts.filter((b) => rt - b.t0 < 0.3);
    for (const b of this.fx.bursts) {
      const p = (rt - b.t0) / 0.3;
      const e = easeOut(p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * b.pow;
      ctx.globalCompositeOperation = 'lighter';
      const x = L.laneX[b.lane];
      if (b.lane === KICK) {
        const w = L.barW * (1 + e * 0.6);
        const h = L.barH * (1 + e * 2.2);
        rr(ctx, x - w / 2, L.strikeY - h / 2, w, h, h / 2);
        ctx.fillStyle = 'rgba(255,170,100,0.8)';
        ctx.fill();
      } else if (b.lane === SNARE || b.lane === TOM) {
        ctx.beginPath();
        ctx.ellipse(x, L.strikeY, L.padR * (1 + e * 1.3), L.padR * (1 + e * 1.3) * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.lane === TOM ? 'rgba(140,255,200,0.8)' : 'rgba(160,225,255,0.8)';
        ctx.fill();
      } else {
        const rx = this._cymR(b.lane) * (1 + e * 0.9);
        ctx.beginPath();
        ctx.ellipse(x, L.strikeY, rx, rx * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${LANE[b.lane].rgb},0.85)`;
        ctx.fill();
      }
      ctx.restore();
    }
    // 킥 울림 링
    this.fx.booms = this.fx.booms.filter((b) => rt - b.t0 < 0.45);
    if (this.laneOrder.includes(KICK))
      for (const b of this.fx.booms) {
        const p = (rt - b.t0) / 0.45;
        ctx.strokeStyle = `rgba(255,170,110,${(1 - p) * b.pow})`;
        ctx.lineWidth = 6 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(L.laneX[KICK], L.strikeY, L.instR * (1.05 + easeOut(p) * 0.7), 0, Math.PI * 2);
        ctx.stroke();
      }
  }


  /** 심벌 스프라이트 (3D 금속) 를 크기 r, 기울기로 */
  _cymbal(x, y, r, tilt, wob) {
    const ctx = this.ctx;
    const sp = this.kit.cym;
    const k = r / this.kit.cymR;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt + wob);
    ctx.scale(k, k);
    ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
    ctx.restore();
  }

  _stand(x, y1, y2) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(12,8,20,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    const gr = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
    gr.addColorStop(0, '#7A808E');
    gr.addColorStop(0.4, '#FFFFFF');
    gr.addColorStop(1, '#8E95A3');
    ctx.strokeStyle = gr;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  /** 줄 맨 아래 악기들: 킥 = 베이스드럼 정면, 스네어 = 스네어, 하이햇/크래시 = 심벌 */
  _drawInstruments(st, rt, pe) {
    const ctx = this.ctx;
    const L = this.L;
    for (const lane of this.laneOrder) {
      const x = L.laneX[lane];
      const y = L.strikeY;
      const age = rt - this.hitAt[lane];
      if (lane === KICK) {
        // 3D 베이스드럼: 킥이면 통 전체가 살짝 부풀고 앞 헤드가 번쩍
        const sp = this.kit.kick;
        const k = 1 + pe * 0.07;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k, k * (1 - pe * 0.02));
        ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
        if (age < 0.18) {
          ctx.fillStyle = `rgba(255,244,228,${0.55 * (1 - age / 0.18)})`;
          ctx.beginPath();
          ctx.arc(0, 0, this.kit.kickR * 0.86, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (lane === SNARE || lane === TOM) {
        // 3D 스네어·탐탐: 칠 때 헤드가 눌렸다 튀어오름 (탐탐은 더 깊은 통 + 다리, 드럼 세트와 같은 마감)
        const sq = age < 0.25 ? Math.exp(-age * (lane === TOM ? 18 : 25)) * (lane === TOM ? 0.07 : 0.05) : 0;
        const sp = lane === TOM ? this.kit.tom : this.kit.snare;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + sq, 1 - sq);
        ctx.drawImage(sp.img, -sp.ax, -sp.ay, sp.w, sp.h);
        if (age < 0.14) {
          const Rx = this.kit.snareRx;
          ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - age / 0.14)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, Rx * 0.92, Rx * SNARE_RY * 0.86, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else {
        const r = this._cymR(lane) * 1.05;
        const auto = lane === HAT ? st.hatAge ?? 9 : st.crashAge ?? 9;
        const a = Math.min(auto, age);
        this._stand(x, y, L.H);
        if (lane === HAT) {
          const close = a < 0.08 ? 1 - a / 0.08 : 0;
          this._cymbal(x, y + r * 0.1, r, 0, 0);
          this._cymbal(x, y - r * (0.12 - close * 0.1), r, 0, 0);
        } else {
          const wob = a < 1.5 ? Math.sin(a * 18) * Math.exp(-a * 3) * 0.25 : 0;
          this._cymbal(x, y, r, -0.08, wob);
        }
      }
      // 줄 아래 악기 이름 (항상 작게)
      const fs = Math.round(Math.min(L.laneW * 0.16, L.GW * 0.045));
      ctx.save();
      ctx.font = `${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.28;
      ctx.strokeStyle = INK;
      const ly = Math.min(L.H - fs * 1.1, L.strikeY + L.instR * 1.55);
      ctx.strokeText(LANE[lane].short, x, ly);
      ctx.fillStyle = LANE[lane].light;
      ctx.fillText(LANE[lane].short, x, ly);
      // 컴퓨터(키보드) 쓰는 사람용: 줄마다 어떤 키인지 키캡으로
      const kc = this.keyLabels && this.keyLabels[lane];
      if (kc) {
        const ks = Math.round(fs * 1.25);
        const ky = Math.min(L.H - ks * 0.7, ly + fs * 1.15 + ks * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(2, ks * 0.1);
        ctx.beginPath();
        ctx.roundRect(x - ks * 0.62, ky - ks * 0.62, ks * 1.24, ks * 1.24, ks * 0.26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = `${ks}px ${FONT}`;
        ctx.fillText(kc, x, ky + ks * 0.04);
      }
      ctx.restore();
    }
  }

  _drawSparks(rt) {
    const ctx = this.ctx;
    this.fx.sparks = this.fx.sparks.filter((s) => rt - s.t0 < s.life);
    ctx.lineCap = 'round';
    for (const s of this.fx.sparks) {
      const t = rt - s.t0;
      const d = s.sp * t;
      const x = s.x + Math.cos(s.a) * d;
      const y = s.y + Math.sin(s.a) * d;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 1 - t / s.life;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(s.a) * s.len, y - Math.sin(s.a) * s.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** 마스코트 쿵콩이: 화면 맨 아래 가운데에서 박자 타며 표정 바뀜 */
  _drawMascot(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const set = this.rasters.kong;
    const th = rt - Math.max(...this.hitAt);
    const tm = rt - Math.max(...this.missAt);
    let face = set.idle;
    if (th < 0.16) face = set.hit;
    else if (tm < 0.45) face = set.miss;
    else if (rt < this.cheerUntil || st.finished) face = set.cheer;
    const phase = beatPhase(st);
    const bob = st.playing ? Math.pow(1 - phase, 3) : 0;
    const w = L.mascotW;
    const sy = 1 - bob * 0.05;
    const sx = 1 + bob * 0.03;
    const jump = rt < this.cheerUntil ? Math.abs(Math.sin(rt * 12)) * w * 0.12 : 0;
    ctx.drawImage(face, L.cx - (w * sx) / 2, L.mascotBase - w * sy * 0.945 - jump, w * sx, w * sy);
  }

  _drawCombo(st, rt) {
    if (st.combo < 3) return;
    const ctx = this.ctx;
    const L = this.L;
    const p = clamp((rt - this.comboPopAt) / 0.15, 0, 1);
    const sc = 1 + (1 - easeOut(p)) * 0.22;
    // 악보(노트)가 가려지지 않게: 작고 흐리게, 노트 뒤에 깔림
    const y = L.topY + (L.strikeY - L.topY) * 0.2;
    const size = L.GW * 0.09 * sc;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = INK;
    ctx.strokeText(String(st.combo), L.cx, y);
    ctx.fillStyle = st.combo >= 30 ? '#FFE45C' : '#FFFFFF';
    ctx.fillText(String(st.combo), L.cx, y);
    ctx.font = `${Math.round(L.GW * 0.038)}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(st.combo >= 30 ? 'GROOVE!' : 'COMBO', L.cx, y + size * 0.62);
    ctx.restore();
  }

  _drawJudges(rt) {
    const ctx = this.ctx;
    const L = this.L;
    this.fx.judges = this.fx.judges.filter((j) => rt - j.t0 < 0.45);
    const latest = [null, null, null, null, null];
    for (const j of this.fx.judges) latest[j.lane] = j;
    for (const j of latest) {
      if (!j) continue;
      const t = (rt - j.t0) / 0.45;
      const sc = t < 0.12 ? 1.3 - (t / 0.12) * 0.3 : 1;
      const x = L.laneX[j.lane];
      const y = L.strikeY - L.instR * 1.75 - t * L.GW * 0.02;
      const size = Math.min(L.GW * 0.055, L.laneW * 0.2) * sc;
      ctx.save();
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = INK;
      ctx.strokeText(j.text, x, y);
      ctx.fillStyle = j.color;
      ctx.fillText(j.text, x, y);
      if (j.sub) {
        ctx.font = `${Math.round(size * 0.55)}px ${FONT}`;
        ctx.lineWidth = size * 0.12;
        ctx.strokeText(j.sub, x, y + size * 0.8);
        ctx.fillStyle = j.sub === 'FAST' ? '#9CC8FF' : '#FFB08A';
        ctx.fillText(j.sub, x, y + size * 0.8);
      }
      ctx.restore();
    }
  }


  _drawBanners(rt) {
    const ctx = this.ctx;
    const L = this.L;
    this.fx.banners = this.fx.banners.filter((b) => rt - b.t0 < 1.1);
    for (const b of this.fx.banners) {
      const t = (rt - b.t0) / 1.1;
      // 악보를 가리지 않게: 판정선 아래 엄지 자리 쪽이 아니라, 노트가 아직 작은 길 맨 위쪽에 작고 반투명하게
      const size = L.GW * 0.055;
      const pop = t < 0.15 ? easeOut(t / 0.15) : t > 0.6 ? 1 - easeOut((t - 0.6) / 0.4) : 1;
      const y = L.topY + (L.strikeY - L.topY) * 0.07;
      ctx.save();
      ctx.globalAlpha = 0.7 * pop;
      ctx.translate(L.cx, y);
      ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = INK;
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color || '#FF9CC8';
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }

  /** 카운트인: 큰 숫자 + 줄마다 "왼쪽 엄지 / 킥 (쿵)" 말풍선 + 누르라는 물결 */
  _drawCountIn(st, rt) {
    if (!st.countIn) return;
    const ctx = this.ctx;
    const L = this.L;
    const { label, phase, fade } = st.countIn;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.laneOrder.forEach((i) => {
      const x = L.laneX[i];
      // 물결: "여기 줄 아무 데나 눌러요"
      for (let k = 0; k < 2; k++) {
        const p = ((rt * 0.9 + k * 0.5) % 1 + 1) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p) * fade})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, L.strikeY, L.instR * (0.6 + p * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      const fs = Math.min(L.laneW * 0.15, L.GW * 0.042);
      ctx.font = `${Math.round(fs)}px ${FONT}`;
      const t1 = LANE[i].thumb;
      const t2 = LANE[i].word;
      const tw = Math.min(L.laneW - 6, Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + fs * 1.2);
      const bh = fs * 2.8;
      const y = L.strikeY - L.instR * 1.45 - bh - fs * 0.6;
      rr(ctx, x - tw / 2, y, tw, bh, fs * 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill();
      // 말풍선 꼬리 (악기를 가리킴)
      ctx.beginPath();
      ctx.moveTo(x - fs * 0.5, y + bh - 1);
      ctx.lineTo(x, y + bh + fs * 0.55);
      ctx.lineTo(x + fs * 0.5, y + bh - 1);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(t1, x, y + fs * 0.85);
      ctx.fillStyle = LANE[i].dark;
      ctx.fillText(t2, x, y + fs * 2);
      if (i === this.newLane) {
        const bw = fs * 3.2;
        rr(ctx, x - bw / 2, y - fs * 1.15, bw, fs * 1.3, fs * 0.65);
        ctx.fillStyle = '#FF5FA2';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('NEW!', x, y - fs * 0.48);
      }
    });
    // 판정선 아래 빈 자리: 엄지 올려두는 곳
    const zt = '여기 눌러도 OK';
    const zs = fitFont(ctx, zt, L.laneW * 0.86, Math.min(L.laneW * 0.16, L.GW * 0.042));
    const zy = L.strikeY + L.instR * 1.55 + (L.H - L.strikeY - L.instR * 1.55) * 0.3;
    for (const i of this.laneOrder) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
      if (this.keyLabels) {
        // 컴퓨터: 손가락 대신 키 안내 (키캡은 줄 아래에 항상 떠 있음)
        ctx.font = `${zs}px ${FONT}`;
        ctx.fillText(`${this.keyLabels[i]} 키 · 클릭도 OK`, L.laneX[i], zy + zs * 1.5);
        continue;
      }
      ctx.font = `${Math.round(zs * 1.5)}px ${FONT}`;
      ctx.fillText('👆', L.laneX[i], zy + Math.sin(rt * 6) * zs * 0.2);
      ctx.font = `${zs}px ${FONT}`;
      ctx.fillText(zt, L.laneX[i], zy + zs * 1.5);
    }
    // 한 줄 안내
    const hs = Math.round(L.GW * 0.045);
    ctx.font = `${hs}px ${FONT}`;
    const hint = '다가온 콩이 선에 닿을 때 그 줄을 톡!';
    const hy = L.topY + (L.strikeY - L.topY) * 0.62;
    const hw = ctx.measureText(hint).width + hs * 1.6;
    rr(ctx, L.cx - hw / 2, hy - hs * 0.9, hw, hs * 1.8, hs * 0.9);
    ctx.fillStyle = 'rgba(20,12,48,0.82)';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(hint, L.cx, hy + hs * 0.05);
    if (label) {
      const a = 1 - phase;
      const sc = 1 + (1 - easeOut(Math.min(1, phase * 4))) * 0.35;
      const size = L.GW * 0.2 * sc;
      ctx.globalAlpha = clamp(a * 1.5, 0, 1) * fade;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = INK;
      const y = L.topY + (L.strikeY - L.topY) * 0.33;
      ctx.strokeText(label, L.cx, y);
      ctx.fillStyle = '#FFE45C';
      ctx.fillText(label, L.cx, y);
    }
    ctx.restore();
  }

  /** 맵 이름 칩 (카운트인 동안 + 무제한에서 맵이 바뀐 직후) — 길 끝 위쪽 하늘에 작게 */
  _drawThemeChip(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    let a = 0;
    if (st.countIn) a = st.countIn.fade;
    const tf = this.themeFx;
    if (tf && rt - tf.t0 < 2) a = Math.max(a, 0.8 * Math.min(1, (2 - (rt - tf.t0)) / 0.5));
    if (a <= 0.01 || this.studio) return;
    const T = this.theme;
    const text = `${T.emoji} ${T.name}`;
    const fs = Math.round(L.GW * 0.036);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + fs * 1.6;
    // 위쪽 HUD(하트) 와 안 겹치게 길 안쪽 먼 곳에
    const y = L.topY + (L.strikeY - L.topY) * 0.13;
    rr(ctx, L.cx - w / 2, y - fs * 0.85, w, fs * 1.7, fs * 0.85);
    ctx.fillStyle = 'rgba(10,6,24,0.72)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${T.glow},0.8)`;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, L.cx, y + fs * 0.05);
    ctx.restore();
  }

  /** 새 단계 배너: "Lv.3" + "엇박 들어갑니다 · 110 BPM" (+ 경고) — 1.8초 */
  _drawRound(st, rt) {
    const f = this.roundFx;
    // 게임 중엔 노트를 가려서 안 띄움 (단계·BPM 은 위쪽 HUD 에 나옴). 영상 찍기 화면에서만
    if (!f || st.countIn || !this.studio) return;
    const age = rt - f.t0;
    const D = 1.3;
    if (age > D) return;
    const ctx = this.ctx;
    const L = this.L;
    const t = age / D;
    const pop = age < 0.18 ? easeOut(age / 0.18) : 1;
    const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    // 노트를 가리지 않게 위쪽에 작게
    const y = L.topY + (L.strikeY - L.topY) * 0.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = L.GW * 0.6;
    const bh = L.GW * 0.2;
    rr(ctx, L.cx - bw / 2, y - bh * 0.55, bw, bh, L.GW * 0.06);
    ctx.fillStyle = 'rgba(14,9,34,0.78)';
    ctx.fill();
    ctx.translate(L.cx, y);
    ctx.scale(pop, pop);
    this._roundText(f.info, 0, 0, L.GW * 0.09);
    ctx.restore();
  }

  /** "Lv.N" 노란 큰 글씨 + 부제 + 빨간 경고 (y = Lv 글씨 가운데) */
  _roundText(info, x, y, size, clearText) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const big = clearText || `Lv.${info.round}`;
    const fs = fitFont(ctx, big, this.L.GW * 0.86, size);
    ctx.font = `${fs}px ${FONT}`;
    ctx.lineWidth = fs * 0.14;
    ctx.strokeStyle = INK;
    ctx.strokeText(big, x, y);
    ctx.fillStyle = '#FFD84A';
    ctx.fillText(big, x, y);
    const sub = clearText ? info.sub || '' : `${info.name} · ${info.bpm} BPM`;
    if (sub) {
      const ss = fitFont(ctx, sub, this.L.GW * 0.86, size * 0.3);
      ctx.font = `${ss}px ${FONT}`;
      ctx.lineWidth = ss * 0.2;
      ctx.strokeText(sub, x, y + fs * 0.66);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(sub, x, y + fs * 0.66);
    }
    if (!clearText && info.warn) {
      const ws = Math.round(size * 0.24);
      ctx.font = `${ws}px ${FONT}`;
      ctx.lineWidth = ws * 0.2;
      ctx.strokeText(info.warn, x, y + fs * 0.66 + ws * 1.5);
      ctx.fillStyle = '#FF6B5A';
      ctx.fillText(info.warn, x, y + fs * 0.66 + ws * 1.5);
    }
  }

  /** 영상 찍기 레벨업 챌린지: 릴스처럼 위에 훅 문구 → 시작하면 "Lv.N · 이름 · BPM" */
  _drawStudioChallenge(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const top = L.H * 0.045;
    if (st.cleared) {
      this._roundText({ sub: s.bottom }, L.cx, top + L.GW * 0.12, L.GW * 0.17, `Lv.${st.cleared} 클리어!`);
    } else if (!st.round || st.countIn || st.now < 0) {
      // 훅: 큰 흰 글씨 두 줄 + 작은 부제
      const words = (s.top || '').trim();
      const fs = fitFont(ctx, words, L.GW * 0.92, L.GW * 0.12);
      ctx.font = `${fs}px ${FONT}`;
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = INK;
      ctx.strokeText(words, L.cx, top + fs * 0.7);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(words, L.cx, top + fs * 0.7);
      if (s.bottom) {
        const bs = fitFont(ctx, s.bottom, L.GW * 0.9, L.GW * 0.055);
        ctx.font = `${bs}px ${FONT}`;
        ctx.lineWidth = bs * 0.2;
        ctx.strokeText(s.bottom, L.cx, top + fs * 1.45 + bs * 0.4);
        ctx.fillStyle = '#FFD84A';
        ctx.fillText(s.bottom, L.cx, top + fs * 1.45 + bs * 0.4);
      }
    } else {
      const f = this.roundFx;
      const age = f ? rt - f.t0 : 9;
      const pop = 1 + (age < 0.25 ? (1 - easeOut(age / 0.25)) * 0.25 : 0);
      ctx.translate(L.cx, top + L.GW * 0.11);
      ctx.scale(pop, pop);
      this._roundText(st.round, 0, 0, L.GW * 0.2);
    }
    ctx.restore();
  }

  _drawStudio(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    if (s.cover) return; // 릴스 썸네일: 글씨는 cover.js 가 따로 그림
    if (s.challenge) {
      this._drawStudioChallenge(st, rt);
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cw = L.GW * 0.9;
    const ch = L.H * 0.12;
    const cx = L.cx - cw / 2;
    const cy = L.H * 0.04;
    rr(ctx, cx, cy, cw, ch, L.GW * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const fs = fitFont(ctx, s.top, cw * 0.9, L.GW * 0.075);
    ctx.font = `${fs}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(s.top, L.cx, cy + ch * 0.38);
    ctx.font = `${Math.round(L.GW * 0.042)}px ${FONT}`;
    ctx.fillStyle = '#E2541F';
    ctx.fillText(s.label, L.cx, cy + ch * 0.76);
    ctx.font = `${Math.round(L.GW * 0.05)}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = L.GW * 0.016;
    ctx.strokeStyle = INK;
    const scoreText = `${(st.score || 0).toLocaleString('ko-KR')}점`;
    ctx.strokeText(scoreText, L.cx, cy + ch + L.H * 0.028);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(scoreText, L.cx, cy + ch + L.H * 0.028);
    if (s.bottom) {
      const bfs = fitFont(ctx, s.bottom, L.GW * 0.85, L.GW * 0.048);
      ctx.font = `${bfs}px ${FONT}`;
      const tw = ctx.measureText(s.bottom).width + bfs * 1.4;
      const by = L.H * 0.955;
      rr(ctx, L.cx - tw / 2, by - bfs, tw, bfs * 2, bfs);
      ctx.fillStyle = '#FF8A4C';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(s.bottom, L.cx, by + bfs * 0.05);
    }
    ctx.restore();
  }
}

let _goldGlow = null;
/** 황금 콩 후광 (한 번만 그려 둠) */
function goldGlow() {
  if (_goldGlow) return _goldGlow;
  const c = (_goldGlow = document.createElement('canvas'));
  c.width = c.height = 96;
  const g = c.getContext('2d');
  const gl = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gl.addColorStop(0, 'rgba(255,220,90,0.9)');
  gl.addColorStop(0.5, 'rgba(255,190,40,0.45)');
  gl.addColorStop(1, 'rgba(255,190,40,0)');
  g.fillStyle = gl;
  g.fillRect(0, 0, 96, 96);
  return c;
}

function fitFont(ctx, text, maxW, start) {
  let fs = Math.round(start);
  ctx.font = `${fs}px ${FONT}`;
  while (fs > 10 && ctx.measureText(text).width > maxW) {
    fs -= 1;
    ctx.font = `${fs}px ${FONT}`;
  }
  return fs;
}

return { LANE, JUDGE_STYLE, Renderer };
})();

// ---- game.js ----
const __m_game = (() => {
// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

const { STEPS_PER_BAR, tempoOf, ROUND_BARS, roundInfo, diamondsFor, buildNotes, JUDGE, pointsFor, accuracy, gradeFor, starsFor, COUNT_IN_BARS, OUTRO_BARS, maxScore, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH, buildRolls, markGoldNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS } = __m_charts;
const { SongPlayer } = __m_audio;

const COUNT_LABELS = ['1', '2', '3', '4!'];

/** 목숨: MISS 하면 하나씩 줄고, 0개가 되면 멈춤 → 이어하기(광고) 또는 끝 */
const MAX_LIVES = 5;
/** 콤보가 이만큼 쌓일 때마다 목숨 하나 회복 (최대 MAX_LIVES) */
const LIFE_REGEN_COMBO = 20;
/** 한 판에 이어하기 몇 번까지 */
const MAX_CONTINUES = 1;
/** 광고 보고 이어하면 목숨 몇 개로 다시 시작하는지 */
const REVIVE_LIVES = 2;
/** 이어하기 직후 목숨 안 깎이는 시간(초) */
const REVIVE_GRACE = 1.6;
/** 헛침으로 목숨이 깎인 뒤 이 시간(초) 안의 헛침은 또 안 깎음 (두 엄지 동시 실수) */
const WRONG_GAP = 0.12;

class Game {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {import('./render.js').Renderer} o.renderer
   */
  constructor({ audio, renderer, level, settings, auto = false, onHud, onEnd, onDeath }) {
    this.audio = audio;
    this.r = renderer;
    this.level = level;
    this.settings = settings;
    this.auto = auto;
    this.onHud = onHud || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onDeath = onDeath || null;
    this.onStall = null;
    this.tempo = tempoOf(level);
    /** 화면 왼쪽부터 레인(악기) 순서 */
    this.laneOrder = levelLanes(level);
    this.notes = [];
    this.lanes = INSTRUMENTS.map(() => []);
    this.builtBars = 0;
    this._pair = 0;
    this._addNotes();
    /** 레벨업 챌린지(무제한 모드): 지금 단계 */
    this.round = 0;
    this.ptr = INSTRUMENTS.map(() => 0);
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.offsets = [];
    // 자동 연주(영상 찍기)나 죽었을 때 처리할 곳이 없으면 목숨 없음
    this.livesOn = !auto && !!this.onDeath;
    this.lives = MAX_LIVES;
    this.continues = 0;
    this.graceUntil = -Infinity;
    this._lostAt = null;
    this.state = 'idle';
    this.beat = 60 / this.tempo.bpm(0);
    // 콩 다가오는 속도는 1로 고정 (설정에서 없앰. 예전에 바꿔 둔 값도 무시)
    this.approach = 1.5;
    this.firstNoteTime = this.notes.length ? this.notes[0].time : 0;
    this._setEnd();
    this.maxScore = level.endless ? 0 : maxScore(level);
    /** 마디마다 끝났을 때 점수 (1:1 대결에서 상대 점수를 실시간으로 보여줄 때 씀) */
    this.timeline = [];
    // 💥 연타 구간 · ✨ 황금 콩 (점수와 상관없이 하트를 돌려받는 재미 요소)
    this.rolls = buildRolls(level);
    this.rollHits = 0;
    this.goldTotal = level.challenge ? 0 : markGoldNotes(this.notes);
    this.goldHits = 0;
    this._loop = this._loop.bind(this);
  }

  /** 지금(t) 진행 중인 연타 구간 (앞뒤로 살짝 여유) */
  _rollAt(t) {
    for (const r of this.rolls) if (t >= r.t0 - 0.08 && t <= r.t1 + 0.06) return r;
    return null;
  }

  _rollHit(roll, rt) {
    roll.hits++;
    this.rollHits++;
    if (roll.hits % ROLL_HEART_HITS === 0 && roll.hearts < ROLL_MAX_HEARTS && this.livesOn && this.lives < MAX_LIVES) {
      roll.hearts++;
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.r.onRoll) this.r.onRoll(roll, rt);
  }

  /** 채보 마디가 늘어났으면(무제한 모드) 노트 추가 */
  _addNotes() {
    const lv = this.level;
    if (lv.bars.length <= this.builtBars) return false;
    const add = buildNotes(lv, this.builtBars, lv.bars.length, this._pair);
    this._pair = add.nextPair;
    const base = this.notes.length;
    for (const n of add) {
      n.id += base;
      n.judged = false;
      n.result = null;
      this.notes.push(n);
      this.lanes[n.lane].push(n);
    }
    this.builtBars = lv.bars.length;
    return true;
  }

  /** 끝나는 시각: 무제한 모드는 끝없음 (목숨이 다 떨어질 때까지) */
  _setEnd() {
    const lv = this.level;
    this.lastNoteTime = this.notes.length ? this.notes[this.notes.length - 1].time : 0;
    if (lv.endless) {
      this.endTime = Infinity;
      return;
    }
    const lastBar = COUNT_IN_BARS + lv.bars.length - 1;
    this.endTime = this.lastNoteTime + this.tempo.barLen(lastBar) * OUTRO_BARS + 0.4;
  }

  /** 무제한 모드: 앞으로 2단계치 채보는 늘 만들어 둠 */
  _extend(now) {
    const lv = this.level;
    if (!lv.ensureBars) return;
    const bar = Math.max(0, Math.floor(this.tempo.barAt(now)) - COUNT_IN_BARS);
    lv.ensureBars(bar + ROUND_BARS * 2);
    if (this._addNotes()) this._setEnd();
  }

  get offset() {
    return (this.settings.offsetMs || 0) / 1000;
  }

  /** 노래 기준 현재 시각(초). 판정과 화면이 같은 시계를 씀 */
  songTime(perfMs) {
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  start() {
    const ctx = this.audio.ctx;
    this.audio.resetClock();
    this.r.reset();
    this.r.laneOrder = this.laneOrder;
    this.startTime = ctx.currentTime + 0.35;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.start();
    this.state = 'playing';
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
  }

  async resume() {
    if (this.state !== 'paused') return;
    await this.audio.ctx.resume().catch(() => {});
    this.audio.resetClock();
    this.state = 'playing';
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.state = 'stopped';
    cancelAnimationFrame(this._raf);
    if (this.player) this.player.stop();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
  }

  /** 엄지 입력. lane = 악기 번호(charts.js KICK/SNARE/HAT/CRASH). perfMs = event.timeStamp */
  input(lane, perfMs) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return;
    if (!this.auto) this.audio.playLane(lane);
    this.r.onTap(lane, rt);
    if (this.state !== 'playing' || this.auto) return;
    const t = this.songTime(perfMs);
    // 연타 구간: 그 줄은 칠 때마다 연타 +1, 다른 줄은 헛침 아님 (구간엔 노트가 없음)
    const roll = this._rollAt(t);
    if (roll && roll.lane === lane) {
      this._rollHit(roll, performance.now() / 1000);
      return;
    }
    if (roll && t >= roll.t0 && t <= roll.t1) return;
    const list = this.lanes[lane];
    let ahead = null;
    for (let i = this.ptr[lane]; i < list.length; i++) {
      const n = list[i];
      if (n.judged) continue;
      const dt = t - n.time;
      if (dt > JUDGE.good) continue;
      if (dt < -JUDGE.good) {
        ahead = n;
        break;
      }
      this._judge(n, dt, rt);
      return;
    }
    // 너무 일찍 누름 → 그 노트는 MISS (마구 연타해서 점수 받는 것 방지)
    if (ahead && t - ahead.time >= -JUDGE.early) {
      this._miss(ahead, rt);
      return;
    }
    // 노트 없는 곳을 누름 → 헛침: 점수 없음 + 콤보 끊김 (카운트인/끝난 뒤는 봐줌)
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) this._wrong(lane, rt, t);
  }

  /** 노트 없는 곳을 누름(헛침): 콤보 끊김 + 목숨 하나. 두 엄지가 동시에 미끄러져도(0.12초 안) 하나만 */
  _wrong(lane, rt, t) {
    this.counts.wrong++;
    this.combo = 0;
    this.r.onJudge(lane, 'wrong', rt);
    if (t === undefined || t - (this._wrongLostAt ?? -9) < WRONG_GAP) return;
    if (t < this.graceUntil || !this.livesOn || this.state !== 'playing') return;
    this._wrongLostAt = t;
    this._hurt(rt);
  }

  _judge(n, dt, rt) {
    const ad = Math.abs(dt);
    const res = ad <= JUDGE.perfect ? 'perfect' : ad <= JUDGE.great ? 'great' : 'good';
    n.judged = true;
    n.result = res;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[res]++;
    this.score += Math.round(pointsFor(res, this.combo) * (n.mult || 1));
    if (n.gold && res !== 'good') {
      this.goldHits++;
      const heal = this.livesOn && this.lives < MAX_LIVES;
      if (heal) {
        this.lives++;
        this.r.onLife(this.lives, +1, rt);
      }
      if (this.r.onGold) this.r.onGold(n.lane, heal, rt);
    }
    this.offsets.push(dt);
    this.r.onJudge(n.lane, res, rt, dt < 0);
    this.r.onCombo(this.combo, rt);
    if (this.livesOn && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.combo % 25 === 0) {
      this.audio.crash(undefined, this.audio.sfxBus, 0.5);
      this.milestoneAt = this.songTime();
    }
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(res === 'perfect' ? 12 : 8);
      } catch {}
    }
  }

  _miss(n, rt) {
    n.judged = true;
    n.result = 'miss';
    this.counts.miss++;
    this.combo = 0;
    this.r.onJudge(n.lane, 'miss', rt);
    this._loseLife(n, rt);
  }

  /** MISS → 목숨 하나. 동시치기(두 레인 같은 시각)를 둘 다 놓쳐도 하나만 깎음 */
  _loseLife(n, rt) {
    if (!this.livesOn || this.state !== 'playing') return;
    if (n.time < this.graceUntil) return;
    if (this._lostAt === n.time) return;
    this._lostAt = n.time;
    this._hurt(rt);
  }

  /** 목숨 하나 깎기 (0개면 멈춤) */
  _hurt(rt) {
    this.lives = Math.max(0, this.lives - 1);
    this.r.onLife(this.lives, -1, rt);
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
    if (this.lives <= 0) this._die();
  }

  /** 목숨 0개: 그 자리에서 멈춤 (노래도 멈춤). 이어하기 또는 포기는 바깥(main)에서 고름 */
  _die() {
    this.state = 'dead';
    this.diedAt = this.songTime();
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
    // 멈춘 화면에 '목숨 끝' 표시 한 번 그리기
    this._drawFrame(this.diedAt, performance.now() / 1000, true);
    this.onHud(this._hud(this.diedAt));
    this.onDeath({
      canContinue: this.continues < MAX_CONTINUES,
      progress: Math.max(0, Math.min(1, this.diedAt / this.endTime)),
      score: this.score,
    });
  }

  /** 광고 보고 이어하기: 목숨 REVIVE_LIVES 개로 그 자리부터, 바깥에서 카운트다운 후 resume() */
  revive() {
    if (this.state !== 'dead') return false;
    this.continues++;
    this.lives = REVIVE_LIVES;
    this.graceUntil = this.diedAt + REVIVE_GRACE;
    this.r.onLife(this.lives, +REVIVE_LIVES, performance.now() / 1000);
    this.state = 'paused';
    return true;
  }

  /** 이어하기 안 하고 끝내기 → 실패 결과 */
  giveUp() {
    if (this.state !== 'dead') return;
    this.audio.ctx.resume().catch(() => {});
    this._finish(true);
  }

  _loop() {
    if (this.state !== 'playing') return;
    const rt = performance.now() / 1000;
    // 소리 시계가 멈춤(폰이 소리를 잠깐 끊음: 알림·전화·다른 앱 소리 등) → 곡도 멈춰 보임.
    //   바로 다시 켜 보고, 그래도 안 되면 '화면을 눌러 주세요' 안내 (iOS 는 터치해야 다시 켜짐)
    const actx = this.audio.ctx;
    if (actx && actx.state !== 'running') {
      if (rt - (this._resumeTry || 0) > 0.7) {
        this._resumeTry = rt;
        actx.resume().catch(() => {});
        this.audio.resetClock();
        if (this.onStall && rt - (this._stallSince ?? rt) > 1.2) this.onStall();
      }
      this._stallSince ??= rt;
    } else this._stallSince = null;
    const now = this.songTime();
    this._extend(now);
    this._checkRound(now, rt);

    if (this.auto) {
      for (const lane of this.laneOrder) {
        const list = this.lanes[lane];
        while (this.ptr[lane] < list.length && list[this.ptr[lane]].time <= now) {
          const n = list[this.ptr[lane]];
          this.r.onTap(lane, rt);
          this._judge(n, 0, rt);
          this.ptr[lane]++;
        }
      }
      // 자동 연주: 연타 구간은 16분음표마다 두드림
      for (const roll of this.rolls) {
        if (now < roll.t0 || now > roll.t1) continue;
        const want = Math.floor((now - roll.t0) / (this.tempo.stepTime(1) - this.tempo.stepTime(0))) + 1;
        while (roll.hits < want) {
          this.audio.playLane(roll.lane);
          this.r.onTap(roll.lane, rt);
          this._rollHit(roll, rt);
        }
      }
    }

    // 지나간 노트 → MISS
    for (const lane of this.laneOrder) {
      const list = this.lanes[lane];
      while (this.ptr[lane] < list.length) {
        const n = list[this.ptr[lane]];
        if (n.judged) {
          this.ptr[lane]++;
          continue;
        }
        if (now - n.time > JUDGE.good) {
          this._miss(n, rt);
          this.ptr[lane]++;
          continue;
        }
        break;
      }
    }
    if (this.state !== 'playing') return; // 방금 목숨이 다 떨어짐 (_die 가 화면 그림)

    this._drawFrame(now, rt);

    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    while (!this.level.challenge && this.timeline.length < this.level.bars.length && this.timeline.length < Math.floor(barPos)) this.timeline.push(this.score);

    this.onHud(this._hud(now));

    if (now >= this.endTime) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  /** 레벨업 챌린지: 단계가 바뀌면 화면에 "Lv.3 엇박 들어갑니다 · 110 BPM" (한 마디 미리 예고) */
  /** 단계 정보: 단계별 무제한은 원래 곡 빠르기에서 시작 */
  _roundInfo(r) {
    return this.level.roundInfo ? this.level.roundInfo(r) : roundInfo(r);
  }

  _checkRound(now, rt) {
    if (!this.level.challenge) return;
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    // 새 단계 시작 한 박 전부터 크게 띄움 (첫 단계는 카운트인 마지막 박)
    const r = Math.min(this.level.maxRounds, Math.max(1, Math.floor((mb + 0.25) / ROUND_BARS) + 1));
    if (r !== this.round) {
      this.round = r;
      this.roundInfo = this._roundInfo(r);
      if (this.r.onRound) this.r.onRound(this.roundInfo, rt);
    }
  }

  /** 지금까지 깬 단계 수 */
  _roundsCleared(now) {
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    return Math.max(0, Math.min(this.level.maxRounds, Math.floor(mb / ROUND_BARS)));
  }

  _hud(now) {
    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    let progress;
    if (this.level.endless) progress = Math.max(0, (barPos % ROUND_BARS) / ROUND_BARS);
    else progress = Math.max(0, Math.min(1, now / this.endTime));
    return {
      score: this.score,
      combo: this.combo,
      lives: this.livesOn ? this.lives : null,
      progress,
      barPos,
      round: this.round ? this.roundInfo : null,
      // 지금까지 친 걸로 받을 별 개수 (무제한 모드는 별 대신 💎)
      stars: this.level.endless ? null : starsFor(this.counts),
    };
  }

  _drawFrame(now, rt, dead = false) {
    // 카운트인 표시 (+ 엄지 안내)
    let countIn = null;
    const ciEnd = this.tempo.barStart(COUNT_IN_BARS);
    if (now < ciEnd) {
      const b = Math.max(0, Math.floor(now / this.beat));
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: now < 0 ? 0 : (now / this.beat) % 1, fade: 1 };
    } else if (now < ciEnd + this.beat * 2) {
      countIn = { label: '', phase: 1, fade: 1 - (now - ciEnd) / (this.beat * 2) };
    }

    const { hatAge, crashAge } = this._kitAges(now);
    // 곡이 얼마나 달아올랐나 0~1 (반주 악기 수와 같은 기준) → 맵 조명·입자가 같이 커짐
    let heat = 0;
    if (this.player && this.player.intensity) {
      const mb = Math.max(0, Math.floor(this.tempo.barAt(now)) - COUNT_IN_BARS);
      heat = Math.max(0, Math.min(1, (this.player.intensity(mb) - 0.35) / 0.65));
    }

    this.r.draw(
      {
        hatAge,
        crashAge,
        heat,
        now,
        notes: this.notes,
        approach: this.approach,
        beatDur: this.beat,
        tempo: this.tempo,
        round: this.round ? this.roundInfo : null,
        combo: this.combo,
        score: this.score,
        playing: !dead,
        dead,
        lives: this.livesOn ? this.lives : null,
        maxLives: MAX_LIVES,
        countIn,
        rolls: this.rolls,
        finished: now > this.lastNoteTime + 0.3,
      },
      rt
    );
  }

  /** 반주 하이햇/크래시가 마지막으로 울린 뒤 지난 시간 (드럼 세트 애니메이션용) */
  _kitAges(now) {
    const tp = this.tempo;
    const idx = Math.floor(tp.barAt(now) * STEPS_PER_BAR);
    const song = this.level.song;
    let hatAge = 9;
    // 하이햇/크래시를 내가 치는 단계에선 반주가 안 침 (화면도 내 타격에만 반응)
    const mineHat = this.laneOrder.includes(HAT);
    const mineCrash = this.laneOrder.includes(CRASH);
    for (let i = idx; i > idx - 16 && i >= 0 && !mineHat; i--) {
      const bar = Math.floor(i / STEPS_PER_BAR);
      const s = i % STEPS_PER_BAR;
      const mb = bar - COUNT_IN_BARS;
      const c = mb < 0 ? (s % 4 === 0 ? 'x' : '.') : mb < this.level.bars.length ? song.hat[s] : '.';
      if (c === 'x' || c === 'o') {
        hatAge = now - tp.stepTime(i);
        break;
      }
    }
    const mbNow = Math.floor(tp.barAt(now)) - COUNT_IN_BARS;
    let crashAge = 9;
    for (let mb = mbNow; mb >= Math.max(0, mbNow - 2) && !mineCrash; mb--) {
      if ((mb > 0 && mb % 8 === 0) || (!this.level.endless && mb === this.level.bars.length)) {
        crashAge = now - tp.barStart(mb + COUNT_IN_BARS);
        break;
      }
    }
    if (this.milestoneAt !== undefined) crashAge = Math.min(crashAge, now - this.milestoneAt);
    return { hatAge, crashAge };
  }

  _finish(failed = false) {
    this.state = 'finished';
    this.player.stop(0.6);
    if (this.level.challenge) {
      this._finishChallenge(failed);
      return;
    }
    while (this.timeline.length < this.level.bars.length) this.timeline.push(this.score);
    this.timeline[this.timeline.length - 1] = this.score;
    const total = this.notes.length;
    const avgOffsetMs = this.offsets.length
      ? Math.round((this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length) * 1000)
      : 0;
    this.onEnd({
      levelId: this.level.id,
      score: this.score,
      maxScore: this.maxScore,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total,
      accuracy: accuracy(this.counts),
      grade: failed ? 'F' : gradeFor(this.counts),
      stars: failed ? 0 : starsFor(this.counts),
      fullCombo: !failed && this.counts.miss === 0 && this.counts.wrong === 0,
      failed,
      continued: this.continues,
      progress: failed ? Math.max(0, Math.min(1, (this.diedAt ?? 0) / this.endTime)) : 1,
      avgOffsetMs,
      auto: this.auto,
      timeline: this.timeline.slice(),
      rollHits: this.rollHits,
      goldHits: this.goldHits,
      goldTotal: this.goldTotal,
    });
  }

  /** 무제한 모드 / 레벨업 챌린지 결과: 몇 단계까지 깼나 + 다이아몬드 */
  _finishChallenge(died) {
    const lv = this.level;
    const at = died ? this.diedAt ?? this.songTime() : this.endTime;
    const cleared = died ? this._roundsCleared(at) : lv.maxRounds;
    const avgOffsetMs = this.offsets.length
      ? Math.round((this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length) * 1000)
      : 0;
    const judged = this.notes.filter((n) => n.judged).length;
    this.onEnd({
      levelId: lv.id,
      challenge: true,
      endless: !!lv.endless,
      score: this.score,
      maxScore: this.score,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total: judged,
      accuracy: accuracy(this.counts),
      grade: gradeFor(this.counts),
      roundsCleared: cleared,
      roundReached: Math.min(lv.maxRounds, cleared + 1),
      bpmReached: this._roundInfo(Math.max(1, Math.min(lv.maxRounds, cleared + (died ? 1 : 0)))).bpm,
      diamonds: diamondsFor(cleared),
      stars: 0,
      fullCombo: false,
      failed: false,
      died,
      continued: this.continues,
      progress: 1,
      avgOffsetMs,
      auto: this.auto,
      timeline: [],
    });
  }
}

return { MAX_LIVES, LIFE_REGEN_COMBO, MAX_CONTINUES, REVIVE_LIVES, Game };
})();

// ---- ads.js ----
const __m_ads = (() => {
// 보상형 광고 (이어하기용)
//
// 1순위: 구글 애드센스 'H5 게임 광고'(Ad Placement API)의 보상형 광고 adBreak({ type: 'reward' }).
//        config.js 의 ads.adsenseClient 에 'ca-pub-…' 를 넣으면 켜집니다. (애드센스 승인 + H5 게임 광고 신청 필요)
// 2순위: 광고가 없거나(승인 전, 광고 재고 없음, 광고 차단) 실패하면 → 홍보 화면(팔로우하고 집 한 채! · @goyangi.seom)을 몇 초 보여주고 이어하기.
//        이어하기가 막혀서 답답한 일은 없게 하고, 그 시간에 인스타 팔로우를 유도.
//
// showRewarded() → Promise<'rewarded' | 'dismissed'>
//   rewarded : 끝까지 봄 → 이어하기 줌
//   dismissed: 중간에 닫음 → 이어하기 없음

let adsense = null; // { ready: bool }

/** 앱 시작할 때 한 번: 애드센스 스크립트를 미리 불러와 광고를 준비시킴 */
function initAds(cfg) {
  const a = (cfg && cfg.ads) || {};
  if (!/^ca-pub-\d{10,}$/.test(a.adsenseClient || '') || adsense) return;
  adsense = { ready: false };
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = function (o) {
    window.adsbygoogle.push(o);
  };
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${a.adsenseClient}`;
  if (a.test) s.dataset.adbreakTest = 'on';
  s.onerror = () => (adsense = { ready: false, failed: true });
  document.head.appendChild(s);
  window.adConfig({
    preloadAdBreaks: 'on',
    sound: 'on',
    onReady: () => adsense && (adsense.ready = true),
  });
}

/** 애드센스 보상형 광고 1회. 광고가 안 뜨면 'unavailable' */
function adsenseReward(hooks) {
  return new Promise((resolve) => {
    let state = 'waiting'; // waiting → showing → done
    const finish = (r) => {
      if (state === 'done') return;
      state = 'done';
      resolve(r);
    };
    // 광고가 준비 안 돼 있으면 beforeReward 가 안 불림 → 잠깐 기다렸다 대체 광고로
    const timer = setTimeout(() => state === 'waiting' && finish('unavailable'), 2500);
    try {
      window.adBreak({
        type: 'reward',
        name: 'continue',
        beforeAd: () => hooks.beforeAd && hooks.beforeAd(),
        afterAd: () => hooks.afterAd && hooks.afterAd(),
        // 사용자가 이미 "광고 보고 이어하기"를 눌렀으니 바로 보여줌
        beforeReward: (showAdFn) => {
          if (state !== 'waiting') return;
          state = 'showing';
          clearTimeout(timer);
          showAdFn();
        },
        adDismissed: () => finish('dismissed'),
        adViewed: () => finish('rewarded'),
        adBreakDone: () => {
          clearTimeout(timer);
          finish(state === 'showing' ? 'dismissed' : 'unavailable');
        },
      });
    } catch {
      clearTimeout(timer);
      finish('unavailable');
    }
  });
}

/**
 * 대체 광고: 우리 인스타 홍보 화면을 seconds 초 보여줌. 다 보면 '이어하기' 버튼이 켜짐.
 * 화면 요소는 index.html 의 #modal-ad.
 */
function houseAd({ seconds = 5, handle = '' } = {}) {
  return new Promise((resolve) => {
    const $ = (s) => document.querySelector(s);
    const modal = $('#modal-ad');
    const btn = $('#ad-continue');
    const close = $('#ad-close');
    const count = $('#ad-count');
    const link = $('#ad-insta');
    link.href = handle ? `https://www.instagram.com/${handle}/` : 'https://www.instagram.com/';
    $('#ad-handle').textContent = handle ? '@' + handle : '인스타그램';
    btn.disabled = true;
    modal.hidden = false;
    let left = seconds;
    const tick = () => {
      count.textContent = left > 0 ? `${left}초 뒤 이어하기` : '';
      btn.textContent = left > 0 ? `${left}` : '▶ 이어하기';
      if (left <= 0) {
        btn.disabled = false;
        clearInterval(timer);
      }
      left--;
    };
    const timer = setInterval(tick, 1000);
    tick();
    const done = (r) => {
      clearInterval(timer);
      btn.onclick = close.onclick = null;
      modal.hidden = true;
      resolve(r);
    };
    btn.onclick = () => !btn.disabled && done('rewarded');
    close.onclick = () => done('dismissed');
  });
}

/**
 * 보상형 광고 보여주기.
 * @param {{ ads?: object, instagramHandle?: string }} cfg
 * @param {{ beforeAd?: Function, afterAd?: Function }} hooks 광고 소리 나는 동안 게임 소리 끄기 등
 */
async function showRewarded(cfg, hooks = {}) {
  const a = (cfg && cfg.ads) || {};
  if (adsense && !adsense.failed && typeof window.adBreak === 'function') {
    const r = await adsenseReward(hooks);
    if (r !== 'unavailable') return r;
  }
  return houseAd({ seconds: a.houseSeconds ?? 5, handle: a.houseHandle || cfg.instagramHandle });
}

return { initAds, showRewarded };
})();

// ---- storage.js ----
const __m_storage = (() => {
// localStorage 래퍼 (인앱 브라우저/사생활 모드에서 막혀도 게임은 돌아가게)

const { shiftOldLevelKey } = __m_charts;

// 이름을 바꾸면서 접두사도 바꿈 → 출시 전 테스트하며 쌓인 기록·설정은 전부 초기화
const PREFIX = 'okaystra:';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

const DEFAULT_SETTINGS = {
  music: 0.8,
  sfx: 1,
  noteSpeed: 1,
  offsetMs: 0,
  vibrate: true,
  // 저사양 모드: 그림 해상도 낮추고 반짝이·조명 효과 끔 (렉 걸리는 폰용)
  lite: false,
  // 반주: 'orch' = 오케스트라(현악·금관·팀파니 + 피아노) / 'piano' = 피아노만
  band: 'orch',
};

function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}
function saveSettings(s) {
  save('settings', s);
}

/** 레벨별 내 최고 기록 { [levelId]: {score, grade, stars, accuracy, maxCombo, fullCombo, at} }
 *  별은 점수와 따로, 지금까지 받은 최고 개수를 기억합니다.
 *  무제한 모드('endless')는 별 대신 diamonds(다이아)와 roundsCleared(깬 단계 수)도 최고값으로 기억. */
function loadBests() {
  return load('bests', {});
}
function saveBest(result) {
  const bests = loadBests();
  const prev = bests[result.levelId];
  const stars = Math.max(result.stars || 0, (prev && prev.stars) || 0);
  const diamonds = Math.max(result.diamonds || 0, (prev && prev.diamonds) || 0);
  const roundsCleared = Math.max(result.roundsCleared || 0, (prev && prev.roundsCleared) || 0);
  const extra = result.challenge ? { diamonds, roundsCleared } : {};
  if (!prev || result.score > prev.score) {
    bests[result.levelId] = {
      score: result.score,
      grade: result.grade,
      stars,
      accuracy: result.accuracy,
      maxCombo: result.maxCombo,
      fullCombo: result.fullCombo,
      ...extra,
      at: Date.now(),
    };
    save('bests', bests);
    return { isNew: true, prev };
  }
  if (stars !== (prev.stars || 0) || (result.challenge && (diamonds !== (prev.diamonds || 0) || roundsCleared !== (prev.roundsCleared || 0)))) {
    Object.assign(prev, { stars }, extra);
    save('bests', bests);
  }
  return { isNew: false, prev };
}

/** 8단계에 새 곡이 끼면서 예전 8~14단계가 9~15단계로 밀림 → 이 브라우저에 쌓인 기록·설정을 한 번만 옮김 */
function migrateLevelOrder() {
  if (load('levelOrderV2', false)) return;
  for (const key of ['bests', 'mockBoard']) {
    const old = load(key, null);
    if (!old || typeof old !== 'object') continue;
    const next = {};
    for (const [k, v] of Object.entries(old)) next[shiftOldLevelKey(k)] = v;
    // 예전 8단계 이후를 깬 사람이 새 8단계 때문에 길이 막히지 않게, 새 8단계는 깬 걸로 쳐 줌
    if (key === 'bests' && next[9] && (next[9].stars || 0) >= 1 && !next[8]) next[8] = { score: 0, grade: 'D', stars: 1, at: Date.now() };
    save(key, next);
  }
  const st = load('studio', null);
  if (st && Number(st.level) >= 8 && Number(st.level) <= 14) save('studio', { ...st, level: Number(st.level) + 1 });
  save('levelOrderV2', true);
}

return { load, save, remove, DEFAULT_SETTINGS, loadSettings, saveSettings, loadBests, saveBest, migrateLevelOrder };
})();

// ---- api.js ----
const __m_api = (() => {
// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 랭킹: guest(닉네임) → startRun() 으로 판 토큰 → submitScore() (끝까지 친 판은 알아서 올림)

const { load, save } = __m_storage;
const { gradeFor } = __m_charts;

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function serverApi(boot = null) {
  // 첫 접속 때 /api/health?boot=1 로 받은 설정·내 정보는 한 번만 그대로 씀 (요청 아끼기)
  let bootConfig = boot && boot.config;
  let bootMe = boot && boot.me;
  return {
    mode: 'server',
    config: () => {
      if (bootConfig) {
        const c = bootConfig;
        bootConfig = null;
        return Promise.resolve(c);
      }
      return http('GET', '/api/config');
    },
    me: () => {
      if (bootMe) {
        const m = bootMe;
        bootMe = null;
        return Promise.resolve(m);
      }
      return http('GET', '/api/me');
    },
    guest: (name, ig) => http('POST', '/api/guest', { name, ig }),
    verifyPassword: (body) => http('POST', '/api/verify/password', body),
    startRun: (level) => http('POST', '/api/runs', { level }),
    submitScore: (payload) => http('POST', '/api/scores', payload),
    leaderboard: (level) => http('GET', `/api/leaderboard?level=${level}`),
    logout: () => http('POST', '/api/logout'),
    suggest: (kind, text) => http('POST', '/api/suggestions', { kind, text }),
    room: (body) => http('POST', '/api/rooms', body),
  };
}

// ---------------- 서버 없는 모드 (정적 호스팅) ----------------
// 랭킹·DM 인증은 서버가 있어야 진짜로 동작. 이 모드에선 화면에 '곧 오픈'으로 나오고,
// 아래 흐름은 내 컴퓨터(localhost)에서 개발할 때만 씀.
const isEndless = (level) => level === 'endless' || /^e\d+$/.test(String(level));

function mockApi(cfg) {
  const getPlayer = () => load('mockPlayer', null);
  return {
    mode: 'mock',
    async config() {
      return { gateMode: cfg.gateMode, instagramHandle: cfg.instagramHandle };
    },
    async me() {
      const p = getPlayer();
      return p ? { verified: !p.guest, guest: !!p.guest, player: p } : { verified: false };
    },
    async guest(name, ig) {
      const p = { username: String(name).trim(), ig, guest: true };
      save('mockPlayer', p);
      return { verified: false, guest: true, player: p };
    },
    async startRun(level) {
      return { runToken: `mock.${level}.${Date.now()}` };
    },
    async submitScore({ level, score, counts, rounds }) {
      const p = getPlayer();
      if (!p) {
        const e = new Error('verify_required');
        e.status = 401;
        throw e;
      }
      const board = load('mockBoard', {});
      if (isEndless(level)) {
        const prev = board[level];
        const improved = !prev || rounds > prev.rounds || (rounds === prev.rounds && score > prev.score);
        if (improved) board[level] = { username: p.username, rounds, score, at: Date.now() };
        save('mockBoard', board);
        return { improved, best: board[level].score, rounds: board[level].rounds, rank: 1 };
      }
      const prev = board[level];
      const improved = !prev || score > prev.score;
      if (improved) board[level] = { username: p.username, score, grade: gradeFor(counts), at: Date.now() };
      save('mockBoard', board);
      const lb = await this.leaderboard(level);
      return { best: improved ? score : prev.score, improved, rank: lb.me ? lb.me.rank : null };
    },
    async leaderboard(level) {
      if (isEndless(level)) {
        const mine = load('mockBoard', {})[level];
        const entries = mine ? [{ rank: 1, username: mine.username, rounds: mine.rounds, score: mine.score, me: true }] : [];
        return { level, entries, me: mine ? { rank: 1, rounds: mine.rounds, score: mine.score } : null, sample: true };
      }
      if (level === 'total') {
        const p = getPlayer();
        const bs = Object.entries(load('mockBoard', {})).filter(([k]) => /^\d+$/.test(k)).map(([, v]) => v);
        const me = p && bs.length ? { rank: 1, score: bs.reduce((a, b) => a + b.score, 0), levels: bs.length } : null;
        const entries = me ? [{ rank: 1, username: p.username, score: me.score, levels: me.levels, me: true }] : [];
        return { level: 'total', levels: 15, entries, me, sample: true };
      }
      const entries = [];
      const mine = load('mockBoard', {})[level];
      if (mine && !isEndless(level)) entries.push({ ...mine, me: true });
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((e, i) => (e.rank = i + 1));
      const me = entries.find((e) => e.me) || null;
      return { level: Number(level), entries, me, sample: true };
    },
    async logout() {
      save('mockPlayer', null);
      return { ok: true };
    },
    async suggest() {
      return { ok: true, mock: true };
    },
    async room() {
      const e = new Error('no_server');
      e.status = 503;
      throw e;
    },
  };
}

async function createApi(cfg) {
  if (cfg.apiMode === 'mock') return mockApi(cfg);
  if (cfg.apiMode === 'server') return serverApi();
  // auto: /api/health 가 응답하면 서버 사용
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health?boot=1', { signal: ctrl.signal, credentials: 'same-origin' });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.app === 'okaystra') return serverApi(j);
    }
  } catch {}
  return mockApi(cfg);
}

return { createApi };
})();

// ---- track.js ----
const __m_track = (() => {
// 익명 이용 통계: 접속 시간(실제로 화면을 보고 만진 시간)과 곡 시작/끝을 서버에 모읍니다.
// 이름·아이디·IP 는 보내지 않아요. 서버가 없는 모드(mock)에선 아무것도 안 함.
//   · 세션 = 탭 하나에서 30분 넘게 안 쉬고 이어진 접속
//   · 활동 시간 = 화면이 보이고 + 최근 1분 안에 터치/키 입력이 있었던 시간

const KEY = 'kkTrack';
const IDLE_MS = 60 * 1000; // 이 시간 동안 입력 없으면 활동 시간 안 셈
const SESSION_GAP_MS = 30 * 60 * 1000;
const TICK_MS = 5000;
// 2분마다 (Vercel 요청 수 아끼기. 곡 시작·끝은 모아서 같이 보냄, 화면을 떠날 때는 바로)
const FLUSH_MS = 120 * 1000;

let on = false;
let sess = null; // { sid, ref }
let activeMs = 0;
let lastInput = Date.now();
let lastSent = -1;
let play = null; // 진행 중인 판 { id, level, mode, startedAt }
const queue = []; // 아직 못 보낸 판 이벤트

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
function writeStore() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...sess, active: Math.round(activeMs / 1000), at: Date.now() }));
  } catch {}
}

function referrer() {
  try {
    const q = new URLSearchParams(location.search);
    const u = q.get('utm_source') || q.get('src') || q.get('ref');
    if (u) return u;
    if (document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h && h !== location.hostname) return h.replace(/^www\./, '');
    }
  } catch {}
  return '';
}

function deviceKind() {
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(ua)) return 'inapp';
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
}

function send() {
  if (!on || !sess) return;
  const payload = { sid: sess.sid, active: Math.round(activeMs / 1000), ref: sess.ref, device: deviceKind(), plays: queue.splice(0, 10) };
  lastSent = payload.active;
  writeStore();
  try {
    fetch('/api/track', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

/** 서버가 있을 때 한 번 부름 */
function initTracker({ enabled }) {
  if (!enabled || on) return;
  on = true;
  const prev = readStore();
  if (prev && prev.sid && Date.now() - prev.at < SESSION_GAP_MS) {
    sess = { sid: prev.sid, ref: prev.ref || '' };
    activeMs = (prev.active || 0) * 1000;
  } else {
    sess = { sid: rid() + rid(), ref: referrer() };
    activeMs = 0;
  }
  const touch = () => (lastInput = Date.now());
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, touch, { capture: true, passive: true });
  setInterval(() => {
    if (!document.hidden && Date.now() - lastInput < IDLE_MS) activeMs += TICK_MS;
  }, TICK_MS);
  setInterval(() => {
    if (!document.hidden && (queue.length || Math.round(activeMs / 1000) !== lastSent)) send();
  }, FLUSH_MS);
  document.addEventListener('visibilitychange', () => document.hidden && send());
  window.addEventListener('pagehide', send);
  send();
}

/** 곡 시작 (자동 연주·영상 찍기는 부르지 않음) */
function trackPlayStart(level, mode = 'normal') {
  if (!on) return;
  if (play) trackPlayEnd({ result: 'quit' });
  play = { id: rid() + rid(), level, mode, startedAt: Date.now() };
  queue.push({ ev: 'start', id: play.id, level, mode });
}

/** 곡 끝. res: { result: 'clear'|'fail'|'quit', score?, stars? }. 진행 중인 판이 없으면 무시 */
function trackPlayEnd(res = {}) {
  if (!on || !play) return;
  const p = play;
  play = null;
  queue.push({
    ev: 'end',
    id: p.id,
    level: p.level,
    mode: p.mode,
    result: res.result || 'quit',
    score: res.score,
    stars: res.stars,
    sec: Math.round((Date.now() - p.startedAt) / 1000),
  });
  send();
}

const hasOpenPlay = () => !!play;

return { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay };
})();

// ---- config.js ----
const __m_config = (() => {
// 사이트 기본 설정. 서버(/api/config)가 있으면 서버 값이 우선합니다.
const CONFIG = {
  appName: '오케이스트라',
  // 인스타 계정 아이디 (@ 빼고). 서버의 INSTAGRAM_HANDLE 이 있으면 그걸 씁니다.
  instagramHandle: 'ok_aystra',
  // 'soft' : 12단계·무제한 모드는 팔로워 인증(운영자가 인스타 팔로우 확인)을 받은 사람만. 나머지는 누구나 (지금 기본값)
  // 'open' : 잠금 없이 전부 열림
  // (개발할 때만: localhost 에서 주소 뒤에 ?gate=soft / ?gate=open 을 붙이면 바꿔볼 수 있어요)
  gateMode: 'soft',
  // 'auto' : 서버(/api)가 있으면 서버, 없으면 브라우저 안에서만 도는 모드(랭킹은 '곧 오픈')
  // 'server' | 'mock' 로 고정 가능
  apiMode: 'auto',
  // 공유 카드에 찍힐 주소. 비우면 현재 주소.
  siteUrl: '',
  // 목숨 다 떨어졌을 때 '광고 보고 이어하기' (한 판에 한 번)
  ads: {
    // 구글 애드센스 H5 게임 광고(보상형). 승인 받으면 'ca-pub-1234567890123456' 처럼 넣기.
    // 비어 있으면 광고 대신 우리 인스타 홍보 화면(houseSeconds 초)을 보고 이어하기.
    adsenseClient: '',
    // true: 애드센스 테스트 광고 (승인 전 화면 확인용, 수익 없음)
    test: false,
    houseSeconds: 5,
    // 광고 대신 나오는 홍보 화면에서 팔로우하러 보낼 인스타 아이디 (@ 빼고). 비우면 instagramHandle.
    houseHandle: 'goyangi.seom',
  },
};

return { CONFIG };
})();

// ---- news.js ----
const __m_news = (() => {
// 업데이트 소식 (시작 화면 📢 버튼). 맨 위가 최신. 새 글이 올라오면 버튼에 빨간 점.
//   새 기능을 배포할 때 여기 맨 위에 한 덩어리 추가 (id 는 겹치지 않게 날짜-번호)

const NEWS = [
  {
    id: '2026-11-18f',
    date: '11월 18일',
    title: '같은 난이도 한 번에 열기',
    items: [
      '🔓 같은 난이도 단계를 <b>하나만 깨도 그 난이도는 전부</b> 열려요! (예: 지옥 하나 깨면 13~16단계 전부)',
    ],
  },
  {
    id: '2026-11-18e',
    date: '11월 18일',
    title: '멀티 · 건의하기는 팔로워 전용',
    items: [
      '⚔️ <b>멀티</b>(빠른 대결·친구 방)와 💬 <b>건의하기</b>는 팔로워 인증을 받으면 쓸 수 있어요. 버튼을 누르면 인증 방법이 나와요',
    ],
  },
  {
    id: '2026-11-18d',
    date: '11월 18일',
    title: '싱글 · 멀티 · 실시간 빠른 대결',
    items: [
      '첫 화면이 <b>🥁 싱글</b>(혼자 단계 깨기) · <b>⚔️ 멀티</b>로 나뉘었어요',
      '⚡ <b>빠른 대결</b>: 모르는 사람과 바로 1:1! <b>🌱 쉬움·보통</b>(1~8단계) · <b>🔥 어려움·극악</b>(9~16단계) 두 방에서 같은 방 사람끼리 붙어요. 곡은 무작위',
      '⚡ <b>실시간</b>: 폰끼리 바로 이어져서 상대 점수가 바로바로 올라가요 (연결이 안 되는 망에선 조금 늦게 보여요)',
      '사람이 적을 땐 상대를 못 찾을 수 있어요. 그땐 친구 방을 만들어 불러 보세요!',
      '✨ 황금 콩 주변에 네모가 보이던 것 고침 — 이제 금색으로 은은하게 빛나요',
    ],
  },
  {
    id: '2026-11-18c',
    date: '11월 18일',
    title: '버벅임 줄이기 · 소리 멈춤 안내',
    items: [
      '⚡ 폰이 버거워하면 <b>무대 효과를 알아서 줄여요</b> (게임은 그대로, 조명·불빛만 덜)',
      '🔇 폰이 소리를 잠깐 멈추면(알림·전화 등) 카운트가 멈출 수 있어요. 이제 바로 다시 켜고, 안 되면 화면을 한 번 눌러 달라고 알려 드려요',
      '콩 다가오는 속도는 하나로 맞췄어요 (설정에서 빠짐)',
    ],
  },
  {
    id: '2026-11-18b',
    date: '11월 18일',
    title: '친구랑 대결 방 · 16단계 · 연타 구간',
    items: [
      '⚔️ <b>친구랑 대결 방</b>: 방을 만들고 4자리 코드를 친구에게 보내면 같은 곡을 동시에 시작! 치는 동안 상대 점수가 실시간으로 보여요. <b>팀전</b>은 두 사람 점수를 합쳐서 같이 깨요 (피아노 파트는 곧 추가)',
      '🥁 <b>16단계</b> 모차르트 교향곡 40번: 드럼이 하나 더! <b>탐탐(둥)</b>이 추가돼 5개 악기로 쳐요. 속도는 15단계보다 살짝 느려요',
      '💥 <b>연타 구간</b>(16단계): 곡 중간 반짝이는 띠가 내려오면 그 줄을 마구 두드려요! 많이 칠수록 하트를 돌려받아요',
      '✨ <b>황금 콩</b>: 모든 곡에 금색 노트가 3개 숨어 있어요. GREAT 이상으로 치면 하트 +1',
      '❤️ 광고 보고 이어하기가 이제 <b>하트 2개</b>',
      '💬 <b>건의하기</b> 버튼이 생겼어요. 하고 싶은 말을 남겨 주세요!',
    ],
  },
  {
    id: '2026-11-18a',
    date: '11월 18일',
    title: '3D 드럼 · 단계마다 다른 맵',
    items: [
      '드럼 세트가 <b>3D</b>로 바뀌었어요 (킥·스네어·심벌·노트 전부)',
      '단계 묶음마다 맵이 달라요: 🌅 노을 피크닉(1~3) · 🌃 네온 시티(4~6) · 🎻 황금 콘서트홀(7~9) · 🖤 블랙 스테이지(10~12) · 🌋 용암 보스전(13~15) · 🪐 우주(무제한)',
      '노래가 달아오를수록 조명과 불빛이 커져요',
    ],
  },
  {
    id: '2026-11-17a',
    date: '11월 17일',
    title: '운명 교향곡 · 팔로워 인증',
    items: [
      '8단계 <b>운명 교향곡</b>(베토벤) 추가',
      '1~3단계는 누구나, 4단계부터·무제한·랭킹은 팔로워 인증으로 열려요',
      '설정에 <b>저사양 모드</b> 추가 (폰이 버벅이면 켜 보세요)',
    ],
  },
  {
    id: '2026-11-15a',
    date: '11월 15일',
    title: '무제한 모드 · 랭킹',
    items: ['💎 단계별 무제한 모드 + 곡마다 랭킹', '🏆 총 등수 시상대', '박자 보정(처음 한 번)'],
  },
];

const LATEST_NEWS = NEWS[0].id;

return { NEWS, LATEST_NEWS };
})();

// ---- room.js ----
const __m_room = (() => {
// 친구 대결 방 클라이언트
//   서버(/api/rooms): 방 만들기·들어가기·빠른 대결 짝짓기·준비·시작 시각·최종 점수. 대기실 2.5초마다 주고받음.
//   ⚡ 실시간: 두 폰을 직접 이어서(WebRTC 데이터 채널) 치는 동안 점수를 0.2초마다 바로 주고받음.
//     처음 이을 때만 서버로 서로 주소(SDP)를 한 번씩 건넴. 이어지면 치는 동안 서버 요청은 15초에 한 번(살아 있음 표시)만.
//     통신사 망에 따라 직접 연결이 안 되면 예전처럼 서버로 4초마다 (자동으로 바뀜).
//   서버 시계와 내 시계 차이(offset)를 재서 '같은 시각에 시작'을 맞춤.

// Vercel 요청 수를 아끼려고 넉넉하게
const ROOM_POLL_LOBBY_MS = 2500;
const ROOM_POLL_PLAY_MS = 4000;
const ROOM_POLL_RT_MS = 15000; // 실시간 연결됐을 때 치는 중
const ROOM_POLL_WAIT_MS = 4000; // 빠른 대결 상대 기다리는 중
const LIVE_EVERY_MS = 200;
const LINK_GIVEUP_MS = 20000;
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

const rid = () => Math.random().toString(36).slice(2, 12);

function iceDone(pc, ms = 3000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

/** 상대 폰과 직접 연결 하나 (주소를 한 번에 다 모아서 건넴 — 서버를 한 번씩만 거치게) */
class PeerLink {
  constructor(id, peer) {
    this.id = id;
    this.peer = peer;
    this.t0 = Date.now();
    this.open = false;
    this.accepted = false;
    this.onMessage = null;
    this.onOpen = null;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }
  _wire(ch) {
    this.ch = ch;
    ch.onopen = () => {
      this.open = true;
      if (this.onOpen) this.onOpen();
    };
    ch.onclose = () => (this.open = false);
    ch.onmessage = (e) => {
      try {
        if (this.onMessage) this.onMessage(JSON.parse(e.data));
      } catch {}
    };
  }
  async offer() {
    this._wire(this.pc.createDataChannel('kk'));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await iceDone(this.pc);
    return this.pc.localDescription.sdp;
  }
  async answer(sdp) {
    this.pc.ondatachannel = (e) => this._wire(e.channel);
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await iceDone(this.pc);
    return this.pc.localDescription.sdp;
  }
  async accept(sdp) {
    if (this.accepted) return;
    this.accepted = true;
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }
  send(obj) {
    if (!this.open) return false;
    try {
      this.ch.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }
  close() {
    this.open = false;
    try {
      if (this.ch) this.ch.close();
    } catch {}
    try {
      this.pc.close();
    } catch {}
  }
}

class RoomClient {
  /**
   * @param {{ api, onUpdate(room), onError(err), onGone(), onLink(open) }} o
   */
  constructor({ api, onUpdate, onError, onGone, onLink }) {
    this.api = api;
    this.onUpdate = onUpdate || (() => {});
    this.onError = onError || (() => {});
    this.onGone = onGone || (() => {});
    this.onLink = onLink || (() => {});
    this.room = null;
    this.code = null;
    this.slot = null;
    this.key = null;
    this.offset = 0; // 서버 시각 - 내 시각 (ms)
    this.bestRtt = Infinity;
    this.pending = {};
    this._timer = null;
    this._busy = false;
    this._fails = 0;
    this.link = null;
    this.peerLive = null;
    this.peerFinal = null;
    this._failedPeer = null;
    this._lastLive = 0;
  }

  get active() {
    return !!this.code;
  }
  get isHost() {
    return !!this.room && this.room.host === this.slot;
  }
  /** 폰끼리 직접 연결돼서 실시간으로 주고받는 중 */
  get realtime() {
    return !!(this.link && this.link.open);
  }
  get me() {
    return this.room && this.room.players[this.slot];
  }
  _otherRaw() {
    if (!this.room) return null;
    return this.room.players[this.slot === 'a' ? 'b' : 'a'] || null;
  }
  /** 상대 (실시간으로 받은 점수가 있으면 그게 더 최신) */
  get other() {
    const o = this._otherRaw();
    if (!o) return null;
    const r = this.room.round;
    const out = { ...o };
    if (this.peerLive && this.peerLive.round === r) out.live = this.peerLive;
    if (!out.final && this.peerFinal && this.peerFinal.round === r) out.final = this.peerFinal;
    return out;
  }
  /** 서버 시각(ms) → 내 Date.now() 기준 */
  toLocal(serverMs) {
    return serverMs - this.offset;
  }

  async _call(body) {
    const t0 = Date.now();
    const r = await this.api.room(body);
    const t1 = Date.now();
    if (r && r.now) {
      // 왕복이 가장 짧았던 응답으로 시계 차이를 잼 (더 정확)
      const rtt = t1 - t0;
      if (rtt <= this.bestRtt + 30) {
        this.bestRtt = Math.min(this.bestRtt, rtt);
        this.offset = r.now - (t0 + t1) / 2;
      }
    }
    return r;
  }

  _enter(r) {
    this._closeLink();
    this._failedPeer = null;
    this.code = r.code;
    this.slot = r.slot;
    this.key = r.key;
    this.room = r.room;
    this.bestRtt = Infinity;
    this._update();
    this._schedule();
  }

  _update() {
    this._syncLink();
    this.onUpdate(this.room);
  }

  async create(name, mode, level) {
    this._enter(await this._call({ action: 'create', name, mode, level }));
  }

  async join(code, name) {
    this._enter(await this._call({ action: 'join', code, name }));
  }

  /** ⚡ 빠른 대결: 같은 묶음에서 기다리는 사람이 있으면 바로 붙음. 없으면 기다림 (true) */
  async quick(name, bracket) {
    const r = await this._call({ action: 'quick', name, bracket });
    this._enter(r);
    return !!r.waiting;
  }

  /** 빠른 대결에서 아직 상대를 기다리는 중 */
  get waiting() {
    return !!(this.room && this.room.pub && this.room.status === 'lobby' && !this._otherRaw());
  }

  /** 다음 주고받기 때 같이 보낼 값 (ready, level, mode, live, final…) — 바로 보내려면 now=true */
  send(fields, now = false) {
    if (fields.live) {
      const { live, ...rest } = fields;
      if (this.realtime) {
        // 실시간: 상대 폰으로 바로 (0.2초마다), 서버엔 안 보냄
        if (Date.now() - this._lastLive >= LIVE_EVERY_MS) {
          this._lastLive = Date.now();
          this.link.send({ t: 'live', round: this.room && this.room.round, ...live });
        }
      } else this.pending.live = live;
      fields = rest;
    }
    if (fields.final && this.realtime) this.link.send({ t: 'final', round: this.room && this.room.round, ...fields.final });
    Object.assign(this.pending, fields);
    if (now) return this.poll();
    return null;
  }

  async poll() {
    if (!this.code || this._busy) return;
    this._busy = true;
    const body = { action: 'sync', code: this.code, slot: this.slot, key: this.key, ...this.pending };
    this.pending = {};
    try {
      const r = await this._call(body);
      this._fails = 0;
      this.room = r.room;
      this._update();
    } catch (e) {
      if (e.status === 404 || (e.status === 403 && e.message === 'not_in_room')) {
        this._stop();
        this.onGone(e);
      } else {
        // 준비 못 함(잠긴 곡) 같은 건 화면에 알림. 네트워크 오류는 다음 번에 다시
        if (e.status === 403) this.onError(e);
        else if (++this._fails >= 5) this.onError(e);
        // 못 보낸 final·연결 신호는 다시 보냄 (ready 는 화면에서 다시 누르게)
        if (body.final && !this.pending.final) this.pending.final = body.final;
        if (body.sig && !this.pending.sig) this.pending.sig = body.sig;
      }
    } finally {
      this._busy = false;
      this._schedule();
    }
  }

  _schedule() {
    clearTimeout(this._timer);
    if (!this.code) return;
    const playing = this.room && this.room.status === 'playing';
    const linking = this.link && !this.link.open; // 연결 신호 주고받는 중엔 빨리
    const ms = playing ? (this.realtime ? ROOM_POLL_RT_MS : ROOM_POLL_PLAY_MS) : this.waiting ? ROOM_POLL_WAIT_MS : linking ? 1500 : ROOM_POLL_LOBBY_MS;
    this._timer = setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden) this._schedule();
      else this.poll();
    }, ms);
  }

  // ---------- ⚡ 폰끼리 직접 연결 ----------
  _newLink(id, peer) {
    const link = new PeerLink(id, peer);
    link.onMessage = (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'live') this.peerLive = { round: m.round, score: m.score | 0, combo: m.combo | 0, progress: +m.progress || 0, lives: m.lives };
      else if (m.t === 'final') {
        this.peerFinal = { round: m.round, score: m.score | 0, stars: m.stars | 0, grade: String(m.grade || ''), failed: !!m.failed, maxCombo: m.maxCombo | 0, accuracy: +m.accuracy || 0 };
        this.onUpdate(this.room);
      }
    };
    link.onOpen = () => {
      this.onLink(true);
      this.onUpdate(this.room);
      this._schedule();
    };
    this.link = link;
    return link;
  }

  _closeLink() {
    if (this.link) {
      const was = this.link.open;
      this.link.close();
      this.link = null;
      if (was) this.onLink(false);
    }
    this.peerLive = null;
    this.peerFinal = null;
  }

  _fail(peer) {
    this._failedPeer = peer;
    this._closeLink();
  }

  /** 방 상태를 보고 연결을 만들거나(a 가 먼저 제안, b 가 답) 정리 */
  _syncLink() {
    const me = this.me;
    const o = this._otherRaw();
    if (typeof RTCPeerConnection === 'undefined' || !this.room || !me || !o || !o.pid || !me.pid) {
      this._closeLink();
      return;
    }
    if (this.link && this.link.peer !== o.pid) this._closeLink();
    // 한동안 안 이어지면 이 상대와는 서버로만 (통신사 망에 따라 직접 연결이 막히기도 함)
    if (this.link && !this.link.open && Date.now() - this.link.t0 > LINK_GIVEUP_MS) this._fail(o.pid);
    if (this._failedPeer === o.pid) return;
    if (this.link && this.link.open) return;
    if (this.slot === 'a') {
      if (!this.link) {
        const id = rid();
        const link = this._newLink(id, o.pid);
        link
          .offer()
          .then((sdp) => this.link === link && this.send({ sig: { id, to: o.pid, type: 'offer', sdp } }, true))
          .catch(() => this.link === link && this._fail(o.pid));
      } else if (o.sig && o.sig.type === 'answer' && o.sig.id === this.link.id && o.sig.to === me.pid) {
        const link = this.link;
        link.accept(o.sig.sdp).catch(() => this.link === link && this._fail(o.pid));
      }
    } else {
      const sg = o.sig;
      if (sg && sg.type === 'offer' && sg.to === me.pid && (!this.link || this.link.id !== sg.id)) {
        this._closeLink();
        const link = this._newLink(sg.id, o.pid);
        link
          .answer(sg.sdp)
          .then((sdp) => this.link === link && this.send({ sig: { id: sg.id, to: o.pid, type: 'answer', sdp } }, true))
          .catch(() => this.link === link && this._fail(o.pid));
      }
    }
  }

  async again() {
    if (!this.code) return;
    this.peerFinal = null;
    this.peerLive = null;
    try {
      const r = await this._call({ action: 'again', code: this.code, slot: this.slot, key: this.key });
      this.room = r.room;
      this._update();
    } catch {}
  }

  _stop() {
    clearTimeout(this._timer);
    this._closeLink();
    this.code = null;
    this.room = null;
  }

  async leave() {
    if (!this.code) return;
    const body = { action: 'leave', code: this.code, slot: this.slot, key: this.key };
    this._stop();
    try {
      await this.api.room(body);
    } catch {}
  }
}

/** 방 결과: 개인전은 승패, 팀전은 합계 */
function roomOutcome(mode, mine, theirs) {
  if (mode === 'team') return { team: (mine || 0) + (theirs || 0) };
  if (mine === theirs) return { result: 'draw' };
  return { result: mine > theirs ? 'win' : 'lose' };
}

return { ROOM_POLL_LOBBY_MS, ROOM_POLL_PLAY_MS, ROOM_POLL_RT_MS, ROOM_POLL_WAIT_MS, RoomClient, roomOutcome };
})();

// ---- cover.js ----
const __m_cover = (() => {
// 🖼 릴스 썸네일(표지) 만들기: 실제 게임 화면(맵·3D 드럼·떨어지는 노트·PERFECT 효과)을 1080×1920 으로 그리고
//   위에 큰 훅 문구를 얹음. 인스타 프로필 격자는 가운데(3:4)만 보여서 중요한 건 가운데 쪽에.

const { Renderer } = __m_render;
const { levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } = __m_charts;

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const INK = '#2B1D3A';
const W = 360; // CSS px (× 3 = 1080)
const H = 640;

/** 긴 문구를 두 줄로 (가운데에 가까운 띄어쓰기에서) */
function splitTitle(text) {
  const t = String(text || '').trim();
  if (t.includes('\n')) return t.split('\n').slice(0, 2);
  if ([...t].length <= 8) return [t];
  const mid = t.length / 2;
  let best = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
}

function fit(ctx, text, maxW, size) {
  let fs = size;
  ctx.font = `${fs}px ${FONT}`;
  while (fs > 12 && ctx.measureText(text).width > maxW) ctx.font = `${(fs -= 1)}px ${FONT}`;
  return fs;
}

function pill(ctx, text, cx, cy, size, fill, color) {
  const fs = fit(ctx, text, W * 0.8, size);
  const w = ctx.measureText(text).width + fs * 1.4;
  const h = fs * 1.9;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + fs * 0.05);
}

/**
 * @param {{ lv, title, sub, bottom }} o  lv = 칠 판(단계), title = 큰 훅(두 줄까지), sub = 곡 이름 배지, bottom = 아래 유도 문구
 * @returns {Promise<HTMLCanvasElement>} 1080×1920
 */
async function makeReelCover({ lv, title, sub, bottom }) {
  // 그릴 글자가 든 글꼴 묶음을 미리 받음 (안 그러면 처음 보는 글자만 기본 글꼴로 나옴, 예: '캉캉')
  try {
    await Promise.race([document.fonts.load(`40px ${FONT.split(',')[0]}`, `${title}${sub || ''}${bottom || ''}0123456789`), new Promise((r) => setTimeout(r, 3000))]);
  } catch {}
  const cv = document.createElement('canvas');
  cv.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(cv);
  try {
    const r = new Renderer(cv);
    r.laneOrder = levelLanes(lv);
    r.newLane = -1;
    r.setTheme(lv);
    r.studio = { cover: true, top: '', bottom: '', label: '' };
    await r.resize(3);
    // 노트가 화면에 가장 많이 내려오는 순간 (첫·끝 마디는 빼고)
    const tempo = tempoOf(lv);
    const all = buildNotes(lv);
    const APPROACH = 2.3; // 썸네일만: 길을 더 길게 보여줘서 노트가 많이 보이게
    let now = tempo.barStart(COUNT_IN_BARS + 1);
    let most = -1;
    for (let b = 1; b < lv.bars.length - 2; b++)
      for (const q of [0, 0.5]) {
        const t = tempo.barStart(COUNT_IN_BARS + b) + q * tempo.barLen(COUNT_IN_BARS + b) + 0.05; // 막 친 순간 (선 위 노트는 사라짐)
        const n = all.filter((x) => x.time >= t && x.time < t + APPROACH * 0.9).length;
        if (n > most) {
          most = n;
          now = t;
        }
      }
    const notes = all.map((n) => ({ ...n, judged: n.time < now - 0.02, result: n.time < now - 0.02 ? 'perfect' : null }));
    const beat = 60 / tempo.bpm(0);
    const st = { now, notes, approach: APPROACH, beatDur: beat, tempo, combo: 0, score: 0, playing: true, heat: 1, hatAge: 0.05, crashAge: 0.1, rolls: [] };
    // 조명·입자가 자리 잡게 몇 프레임 돌리고, 마지막에 킥·스네어 PERFECT
    let rt = 100;
    for (let k = 0; k < 150; k++) r.draw(st, (rt += 1 / 60));
    const lanes = r.laneOrder;
    const hit = lanes.filter((l) => l === 0 || l === 1);
    for (const l of hit) {
      r.onTap(l, rt);
      r.onJudge(l, 'perfect', rt, false);
    }
    rt += 0.06;
    r.draw(st, rt);

    // ---- 글씨 ----
    const ctx = cv.getContext('2d');
    ctx.setTransform(3, 0, 0, 3, 0, 0);
    // 위쪽을 살짝 어둡게 (글씨가 잘 보이게)
    const shade = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    shade.addColorStop(0, 'rgba(10,6,24,0.72)');
    shade.addColorStop(0.7, 'rgba(10,6,24,0.25)');
    shade.addColorStop(1, 'rgba(10,6,24,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H * 0.5);
    const lines = splitTitle(title);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    let y = lines.length > 1 ? 118 : 140;
    lines.forEach((line, i) => {
      const fs = fit(ctx, line, W * 0.9, 50);
      ctx.lineWidth = fs * 0.2;
      ctx.strokeStyle = INK;
      ctx.strokeText(line, W / 2, y);
      // 두 번째 줄(또는 한 줄이면 그 줄)은 노란색으로 강조
      ctx.fillStyle = i === lines.length - 1 ? '#FFD84A' : '#FFFFFF';
      ctx.fillText(line, W / 2, y);
      y += fs * 1.12;
    });
    if (sub) pill(ctx, sub, W / 2, y + 14, 15, '#FFFFFF', '#E2541F');
    if (bottom) pill(ctx, bottom, W / 2, H * 0.905, 16, '#FF8A4C', '#FFFFFF');
    return cv;
  } finally {
    cv.remove();
  }
}

return { splitTitle, makeReelCover };
})();

// ---- sharecard.js ----
const __m_sharecard = (() => {
// 결과 공유 카드 (인스타 스토리 1080x1920)

const { buildRasters } = __m_mascot;
const { getLevel } = __m_charts;

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

async function makeShareCard(result, { siteUrl, handle }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const level = getLevel(result.levelId);

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160F38');
  bg.addColorStop(0.6, '#33186A');
  bg.addColorStop(1, '#5B2167');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 조명
  g.save();
  g.globalCompositeOperation = 'lighter';
  [['255,95,162', 120, 0.5], ['255,210,74', 540, 0], ['95,211,255', 960, -0.5]].forEach(([c, x, ang]) => {
    const gr = g.createLinearGradient(x, 0, x - ang * 900, 1500);
    gr.addColorStop(0, `rgba(${c},0.35)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - 10, 0);
    g.lineTo(x - ang * 900 - 260, 1500);
    g.lineTo(x - ang * 900 + 260, 1500);
    g.lineTo(x + 10, 0);
    g.fill();
  });
  g.restore();
  // 무대 바닥
  const fl = g.createLinearGradient(0, 1620, 0, H);
  fl.addColorStop(0, '#8A5236');
  fl.addColorStop(1, '#3E2218');
  g.fillStyle = fl;
  g.fillRect(0, 1620, W, H - 1620);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `110px ${FONT}`;
  g.lineWidth = 22;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('OKAYSTRA', W / 2, 200);
  g.fillStyle = '#FFFFFF';
  g.fillText('OKAYSTRA', W / 2, 200);

  const pill = `${level.id}단계 · ${level.composer} ${level.name}`;
  g.font = `56px ${FONT}`;
  const pw = g.measureText(pill).width + 90;
  g.fillStyle = '#FF8A4C';
  roundRect(g, (W - pw) / 2, 300, pw, 100, 50);
  g.fill();
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#FFFFFF';
  g.fillText(pill, W / 2, 352);

  // 별 3개
  const stars = result.stars || 0;
  [-1, 0, 1].forEach((d, i) => {
    const r = i === 1 ? 92 : 76;
    drawStar(g, W / 2 + d * 200, i === 1 ? 500 : 520, r, i < stars);
  });

  // 등급
  g.font = `220px ${FONT}`;
  g.lineJoin = 'round';
  g.lineWidth = 28;
  g.strokeStyle = '#3B2A4A';
  g.strokeText(result.grade, W / 2, 730);
  g.fillStyle = gradeColor(result.grade);
  g.fillText(result.grade, W / 2, 730);

  g.font = `140px ${FONT}`;
  g.lineWidth = 20;
  g.strokeStyle = '#2B1D3A';
  g.strokeText(result.score.toLocaleString('ko-KR'), W / 2, 920);
  g.fillStyle = '#FFFFFF';
  g.fillText(result.score.toLocaleString('ko-KR'), W / 2, 920);
  g.font = `48px ${FONT}`;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  const tags = [`정확도 ${(result.accuracy * 100).toFixed(1)}%`, `최대 콤보 ${result.maxCombo}`];
  g.fillText(tags.join('   ·   '), W / 2, 1030);
  if (result.fullCombo) {
    g.font = `60px ${FONT}`;
    g.fillStyle = '#25B865';
    g.fillText(result.counts.perfect === result.total ? 'ALL PERFECT!' : 'FULL COMBO!', W / 2, 1110);
  }

  // 마스코트 + 드럼
  try {
    const r = await buildRasters(340, 400);
    const face = (result.stars || 0) <= 1 ? 'miss' : 'cheer';
    g.drawImage(r.kong[face], W / 2 - 170, 1170, 340, 340);
    g.drawImage(r.bass, W / 2 - 400, 1300, 380, 399);
    g.drawImage(r.snare, W / 2 + 40, 1370, 360, 345);
  } catch {}

  g.font = `56px ${FONT}`;
  g.fillStyle = '#FFFFFF';
  g.lineWidth = 12;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.fillText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.font = `40px ${FONT}`;
  g.fillStyle = 'rgba(255,240,220,0.85)';
  const foot = [handle ? '@' + handle : '', siteUrl.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
  g.fillText(foot, W / 2, 1840);

  return c;
}

function gradeColor(grade) {
  return { SS: '#FF7A3D', S: '#FFB33D', A: '#25B865', B: '#3D8BFF', C: '#A889E8', D: '#9A94AE', F: '#FF6B8A' }[grade] || '#3B2A4A';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawStar(g, cx, cy, r, on) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = '#2B1D3A';
  g.stroke();
  g.fillStyle = on ? '#FFD24A' : 'rgba(255,255,255,0.22)';
  g.fill();
  g.restore();
}

return { makeShareCard, gradeColor };
})();

// ---- versus.js ----
const __m_versus = (() => {
// 오늘의 노래 + 1:1 대결 (도전장 링크)
//
// 서버 없이 되는 '비동기 1:1': 내 점수와 마디별 점수 기록을 링크에 담아 보내면,
// 친구가 같은 곡을 칠 때 화면 위에 내 점수가 실시간으로 같이 올라가서 경주하듯 겨룸.
// 링크 내용은 누구나 고칠 수 있으니 랭킹처럼 '공식 기록'으로 쓰지는 않습니다.

const { LEVELS, getLevel, maxScore, isClosed } = __m_charts;

const DAY_MS = 86400000;
/** 날마다 돌아가며 나오는 순서 (같은 곡이 이틀 연속 안 나오게) */
const TODAY_ORDER = [3, 10, 1, 12, 5, 14, 7, 2, 15, 11, 6, 13, 4, 9, 8];
const GRADES = ['SS', 'S', 'A', 'B', 'C', 'D'];
const NAME_MAX = 10;

/** 한국 시간 기준 날짜 'YYYY-MM-DD' */
function kstDateKey(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/** 오늘의 노래 (한국 시간 자정에 바뀜) */
function todayLevel(d = new Date()) {
  const day = Math.floor((d.getTime() + 9 * 3600000) / DAY_MS);
  // 팔로워 인증이 필요한 단계(4단계부터)는 오늘의 노래로 안 나옴
  const order = TODAY_ORDER.filter((id) => getLevel(id) && !isClosed(id));
  const ids = order.length ? order : LEVELS.filter((l) => !isClosed(l.id)).map((l) => l.id);
  return getLevel(ids[((day % ids.length) + ids.length) % ids.length]);
}

/** 닉네임 정리: 앞뒤 공백·제어문자·꺾쇠 제거, 최대 NAME_MAX 글자 */
function cleanName(s) {
  return [...String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()].slice(0, NAME_MAX).join('');
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * 결과 → 도전장 코드 (주소의 ?vs= 뒤에 붙음)
 * timeline 은 마디마다의 누적 점수 → 차이값으로 줄여서 담음
 */
function encodeChallenge({ name, levelId, score, stars, grade, accuracy, timeline }) {
  const tl = (timeline || []).map((v, i, a) => v - (i ? a[i - 1] : 0));
  const payload = { v: 1, n: cleanName(name) || '드러머', l: levelId, s: score, t: stars, g: grade, a: Math.round((accuracy || 0) * 1000), d: tl };
  return b64urlEncode(JSON.stringify(payload));
}

/** 도전장 코드 → { name, levelId, score, stars, grade, accuracy, timeline } (이상하면 null) */
function decodeChallenge(code) {
  if (typeof code !== 'string' || code.length > 2000) return null;
  let p;
  try {
    p = JSON.parse(b64urlDecode(code));
  } catch {
    return null;
  }
  if (!p || p.v !== 1) return null;
  const level = getLevel(p.l);
  if (!level) return null;
  const int = (x) => Number.isInteger(x);
  if (!int(p.s) || p.s < 0 || p.s > maxScore(level)) return null;
  if (!int(p.t) || p.t < 0 || p.t > 3) return null;
  if (!GRADES.includes(p.g)) return null;
  if (!int(p.a) || p.a < 0 || p.a > 1000) return null;
  if (!Array.isArray(p.d) || p.d.length !== level.bars.length || !p.d.every((x) => int(x) && x >= 0)) return null;
  const timeline = [];
  p.d.reduce((sum, x) => (timeline.push(sum + x), sum + x), 0);
  if (timeline[timeline.length - 1] !== p.s) return null;
  const name = cleanName(p.n);
  if (!name) return null;
  return { name, levelId: level.id, score: p.s, stars: p.t, grade: p.g, accuracy: p.a / 1000, timeline };
}

/** 상대의 '지금 이 순간' 점수. barPos = 본편 몇 번째 마디쯤인지(소수) */
function opponentScoreAt(timeline, barPos) {
  if (!timeline || !timeline.length || !(barPos > 0)) return 0;
  const i = Math.floor(barPos);
  if (i >= timeline.length) return timeline[timeline.length - 1];
  const prev = i ? timeline[i - 1] : 0;
  return Math.round(prev + (timeline[i] - prev) * (barPos - i));
}

/** 'win' | 'lose' | 'draw' */
function versusOutcome(myScore, theirScore) {
  return myScore > theirScore ? 'win' : myScore < theirScore ? 'lose' : 'draw';
}

return { NAME_MAX, kstDateKey, todayLevel, cleanName, encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome };
})();

// ---- main.js ----
const __m_main = (() => {
// 오케이스트라 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

const { LEVELS, getLevel, levelLanes, DIFFICULTY_WORDS, STAR_RULES, ENDLESS_ID, LAST_LEVEL_ID, makeEndless, isUnlocked, unlockHint, nextChallenge, DIAMOND_RULES, roundInfo, ENDLESS_FROM, LEVEL_ENDLESS_STEP, makeLevelEndless, levelEndlessBase, levelEndlessId, needsVerify, FREE_UPTO, isClosed, prevOpenId, nextOpenId, STUDIO_LEVELS, getStudioLevel } = __m_charts;
const { AudioEngine, playMetronome } = __m_audio;
const { Renderer } = __m_render;
const { Game, MAX_LIVES, LIFE_REGEN_COMBO, REVIVE_LIVES } = __m_game;
const { initAds, showRewarded } = __m_ads;
const { createApi } = __m_api;
const { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay } = __m_track;
const { CONFIG } = __m_config;
const { mascotSVG, stickSVG, bassDrumSVG, snareSVG } = __m_mascot;
const { groupStarting } = __m_themes;
const { NEWS, LATEST_NEWS } = __m_news;
const { RoomClient, roomOutcome } = __m_room;
const { makeReelCover } = __m_cover;
const { loadSettings, saveSettings, loadBests, saveBest, load, save, remove, migrateLevelOrder } = __m_storage;

migrateLevelOrder(); // 8단계에 새 곡이 끼면서 밀린 번호를 이 브라우저 기록에도 반영 (아래 state 보다 먼저)
const { makeShareCard, gradeColor } = __m_sharecard;
const { todayLevel, encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome, cleanName } = __m_versus;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);

const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 13v4M8 20h8M9.5 17h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  retry: '<path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-5.7 2.3L4 8.5M4 4v4.5h4.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="3" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 10.5l5-3v9l-5-3z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
  swords: '<path d="M4 4l9.5 9.5M4 4v3.5M4 4h3.5M20 4l-9.5 9.5M20 4v3.5M20 4h-3.5M7 14l3 3M5.5 18.5l2-2M17 14l-3 3M18.5 18.5l-2-2" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.2a4.4 4.4 0 018 2.7c0 5.7-8 10.6-8 10.6z" fill="currentColor"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/>',
};
const STAR_PATH = 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.22 6.5L12 17.3l-5.82 3.15 1.22-6.5-4.8-4.55 6.55-.85z';
const GEM_PATH = 'M7 3.5h10l4.5 5.6L12 21 2.5 9.1z M2.5 9.1h19 M7 3.5l2.4 5.6L12 21l2.6-11.9L17 3.5';
/** 다이아몬드 3개 (무제한 모드). 별과 같은 연출 클래스를 씀 */
const gemsHTML = (n, cls = '') =>
  `<span class="stars gems ${cls}" aria-label="다이아몬드 ${n}개">${[0, 1, 2]
    .map((i) => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="--i:${i}"><path d="${GEM_PATH}"/></svg>`)
    .join('')}</span>`;
/** 별 3개 (n개 채움) */
const starsHTML = (n, cls = '') =>
  `<span class="stars ${cls}" aria-label="별 ${n}개">${[0, 1, 2]
    .map((i) => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="--i:${i}"><path d="${STAR_PATH}"/></svg>`)
    .join('')}</span>`;
const diffHTML = (d) =>
  `<span class="diff" aria-label="난이도 ${d}/5"><span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>${DIFFICULTY_WORDS[d] || ''}</span>`;
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const audio = new AudioEngine();
const renderer = new Renderer($('#game-canvas'));
// 자동 화질: 이 기기에서 버벅여서 내려갔던 단계를 기억해 다음 판부터 그대로
renderer.quality = Math.max(0, Math.min(2, Number(load('gfxQ', 2)) || 0));
renderer.onQualityDrop = (q) => {
  save('gfxQ', q);
  if (q === 0) state.suggestLite = true;
};

const state = {
  api: null,
  cfg: { ...CONFIG },
  me: { verified: false },
  settings: loadSettings(),
  auto: false,
  studio: { level: 'ch4', mode: 'auto', top: '엄지로 드럼 쳐보세요', bottom: 'Lv.4까지 오면 드러머 재능 있음', file: false, active: false },
  levelId: 1,
  game: null,
  lastResult: null,
  runToken: null,
  rankLevel: 1,
  vs: null, // 받은 도전장 { name, levelId, score, stars, grade, accuracy, timeline }
};

// ---------------- 유틸 ----------------
function show(screenId) {
  // 곡 도중 다른 화면으로 나가면 '중간에 나감'으로 기록
  if (screenId !== 'screen-game' && hasOpenPlay()) trackPlayEnd({ result: 'quit' });
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
}
function openModal(id) {
  $('#' + id).hidden = false;
}
function closeModal(id) {
  $('#' + id).hidden = true;
}
let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const handle = () => state.cfg.instagramHandle || '';
const atHandle = () => (handle() ? '@' + handle() : '우리 인스타 계정');
/** "@아이디 인스타" 또는 그냥 "인스타" */
const igWho = () => (handle() ? `@${handle()} 인스타` : '인스타');
const isInApp = () => /Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(navigator.userAgent);

const isLocalDev = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
/** 테스트용 주소 옵션(?gate= ?level= …)은 내 컴퓨터(localhost)에서만. 실제 사이트에선 무시 */
const devParam = (k) => (isLocalDev() ? params.get(k) : null);
/** 서버 없이 배포된 상태(정적 호스팅): 랭킹은 아직 안 열림 */
const demoOnly = () => state.api && state.api.mode === 'mock' && !isLocalDev();
const SOON = () => `랭킹은 곧 열려요! ${atHandle()} 팔로우하고 기다려 주세요`;

// ---------------- 팔로워 인증 (12단계 · 무제한 모드) ----------------
// 1~FREE_UPTO 단계는 누구나. 그 뒤 단계·무제한·랭킹은 팔로워 암호(키티챗 DM)로 인증 완료한 사람만
/** 팔로워 인증 신청 완료 (서버 없는 모드에선 확인할 방법이 없어서 열어 둠) */
function isVerified() {
  if (!state.api || state.api.mode !== 'server') return true;
  return !!(state.me && state.me.guest && state.me.checked);
}
const verifyLocked = (id) => state.cfg.gateMode !== 'open' && needsVerify(id) && !isVerified();
const VERIFY_WHAT = () => `${FREE_UPTO + 1}단계부터·💎 무제한·⚔️ 멀티·💬 건의하기`;
/** 운영자가 팔로우를 확인함 = 인증 완료 (서버 없는 모드에선 확인할 방법이 없어서 잠가 둠) */
function isConfirmed() {
  return !!(state.api && state.api.mode === 'server' && isVerified() && state.me.confirmed);
}
const CONFIRM_WHAT = VERIFY_WHAT;
/** 인증 완료 전엔 잠긴 것 (4단계부터, 무제한 전부). 개발용 ?gate=open 에선 풀림 */
const closedLocked = (id) => state.cfg.gateMode !== 'open' && isClosed(id) && !isConfirmed();
/** 인스타 댓글에 쓸 키워드 (키티챗 자동 DM 키워드와 같아야 함) */
const VERIFY_KEYWORD = '쿵';

function openVerify(id, { pass = '', label = '', then = null } = {}) {
  state.verifyFor = id ?? state.verifyFor ?? null;
  // 인증하면 이어서 할 일 (멀티 창 열기·건의하기 등)
  state.verifyThen = then;
  const lv = label ? { label } : id == null ? null : id === ENDLESS_ID ? { label: '💎 무제한 모드 · 그리그' } : levelEndlessBase(id) ? { label: `💎 ${levelEndlessBase(id).id}단계 무제한 · ${levelEndlessBase(id).name}` } : getLevel(id) ? { label: `${id}단계 · ${getLevel(id).composer} ${getLevel(id).name}` } : null;
  $('#verify-level').hidden = !lv;
  if (lv) $('#verify-level').textContent = lv.label;
  const done = isConfirmed();
  $('#verify-mascots').innerHTML = mascotSVG('kong', 'cheer') + mascotSVG('jjak', done ? 'cheer' : 'idle');
  $('#verify-title').textContent = done ? '팔로워 인증 완료!' : '팔로워 인증';
  $('#verify-desc').innerHTML = done
    ? `이미 인증됐어요 🎉 잠긴 단계와 💎 무제한 모드가 전부 열려 있어요.`
    : `1~${FREE_UPTO}단계는 맛보기! <b>${VERIFY_WHAT()}</b>는 ${igWho()} 팔로워 인증을 받으면 전부 열려요.<br>랭킹에도 인증한 사람만 올라가요.`;
  const step = (n, text) => `<li class="${done ? 'done' : ''}"><b>${done ? '✓' : n}</b><span>${text}</span></li>`;
  $('#verify-steps').innerHTML = [
    step(1, `${atHandle()} <b>팔로우</b>하기`),
    step(2, `아무 게시물·릴스에 <b>「${VERIFY_KEYWORD}」</b> 댓글 달기`),
    step(3, `DM 이 오면 <b>버튼</b>을 눌러 <b>팔로워 암호</b> 받기`),
    step(4, '아래에 암호를 적고 <b>인증하기</b>'),
  ].join('');
  const url = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  $('#verify-acts').innerHTML = done ? '' : `<a class="btn btn-insta" href="${url}" target="_blank" rel="noopener">${icon('insta')} 팔로우 · 댓글 달러 가기</a>`;
  const me = state.me || {};
  const hasName = !!(me.guest && me.player && me.player.username);
  const hasIg = !!(hasName && me.player.ig && !me.hidden);
  $('#verify-form').hidden = done;
  $('#verify-note').hidden = done;
  $('#verify-name-row').hidden = hasName;
  $('#verify-ig-row').hidden = hasIg;
  $('#verify-name').value = hasName ? me.player.username : load('lastNick', '');
  $('#verify-ig').value = (me.player && me.player.ig) || load('lastIg', '');
  if (pass) $('#verify-pass').value = pass;
  $('#verify-err').hidden = true;
  $('#a2hs-inapp').hidden = !isInApp();
  openModal('modal-verify');
}

async function submitVerify() {
  const err = (t) => {
    $('#verify-err').textContent = t;
    $('#verify-err').hidden = false;
  };
  $('#verify-err').hidden = true;
  const body = { password: $('#verify-pass').value.trim() };
  if (!$('#verify-name-row').hidden) {
    const name = $('#verify-name').value.trim();
    if ([...name].length < 2) return err('닉네임을 2자 이상으로 써 주세요.');
    if (!/^[\p{L}\p{N}_. ]+$/u.test(name)) return err('닉네임은 한글·영문·숫자·_ . 만 쓸 수 있어요.');
    body.name = name;
  }
  if (!$('#verify-ig-row').hidden) {
    let ig = $('#verify-ig').value.trim().toLowerCase();
    const um = ig.match(/instagram\.com\/([^/?#\s]+)/);
    if (um) ig = um[1];
    ig = ig.replace(/^@+/, '');
    if (!/^[a-z0-9._]{1,30}$/.test(ig)) return err('인스타 아이디를 정확히 써 주세요. (영문·숫자·_ . 만)');
    body.ig = ig;
  }
  if (!body.password) return err('DM 으로 받은 팔로워 암호를 적어 주세요.');
  if (!state.api || state.api.mode !== 'server') return err('지금은 서버에 연결이 안 돼서 인증할 수 없어요. 잠시 후 다시 해 주세요.');
  const btn = $('#verify-submit');
  btn.disabled = true;
  try {
    state.me = await state.api.verifyPassword(body);
    if (body.name) save('lastNick', body.name);
    if (body.ig) save('lastIg', body.ig);
    $('#verify-pass').value = '';
    closeModal('modal-verify');
    refreshTitle();
    refreshFollowChip();
    renderLevels();
    toast(`🎉 팔로워 인증 완료! 잠긴 단계·💎 무제한·멀티·건의하기가 전부 열렸어요`, 3600);
    submitRank();
    state.verifyFor = null;
    const then = state.verifyThen;
    state.verifyThen = null;
    if (then) setTimeout(then, 400);
  } catch (e) {
    const c = e.data && e.data.error;
    err(
      c === 'wrong_password' ? '암호가 달라요. DM 속 암호를 다시 확인해 주세요. (암호는 매주 바뀌어요)'
        : c === 'rate_limited' || e.status === 429 ? '너무 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요.'
        : c === 'bad_ig' ? '인스타 아이디를 정확히 써 주세요.'
        : c === 'bad_name' ? '닉네임을 2~12자로 써 주세요.'
        : c === 'password_off' ? '지금은 암호 인증을 쉬고 있어요. 아래 "아이디만 적고 신청하기"를 써 주세요.'
        : '인증하지 못했어요. 다시 시도해 주세요.'
    );
  } finally {
    btn.disabled = false;
  }
}

/** 단계 id → 칠 판 (숫자 = 일반 단계, 'endless' = 무제한 모드, 'e13' = 13단계 무제한, 'ch4' = 영상용 레벨업 챌린지 4단계까지) */
function playable(id) {
  if (id === ENDLESS_ID) return makeEndless();
  const eb = levelEndlessBase(id);
  if (eb) return makeLevelEndless(eb);
  if (typeof id === 'string' && /^ch\d+$/.test(id)) return makeEndless({ rounds: Number(id.slice(2)) });
  return getStudioLevel(id) || getLevel(id);
}
const isChallengeId = (id) => id === ENDLESS_ID || (typeof id === 'string' && /^(ch|e)\d+$/.test(id));
/** 앞 단계를 안 깨서 잠김 (팔로우 잠금과 별개) */
const progressLocked = (id) => !isUnlocked(id, loadBests());
function progressLockText(id) {
  if (id === ENDLESS_ID) return `${ENDLESS_FROM}단계 ${getLevel(ENDLESS_FROM).name}을 깨면 무제한 모드가 열려요 💎`;
  const eb = levelEndlessBase(id);
  if (eb) return `${eb.id}단계 ${eb.name}을 별 1개 이상으로 깨면 무제한이 열려요 💎`;
  const h = unlockHint(id, loadBests());
  return h && h.tier
    ? `${h.word} 단계를 아무거나 하나 별 1개 이상으로 깨면 ${h.word} 단계가 전부 열려요`
    : `${prevOpenId(id)}단계를 별 1개 이상으로 깨면 ${id}단계가 열려요`;
}
const LOCK_FROM_PREV = (id) => (id === ENDLESS_ID ? `${ENDLESS_FROM}단계 깨면 열림` : (unlockHint(id, loadBests()) || { short: `${prevOpenId(id)}단계 깨면 열림` }).short);
const CLOSED_META = () => `<span class="lockline">${icon('lock')} 팔로워 암호</span>`;

// ---------------- 타이틀 ----------------
function buildTitle() {
  const scene = $('#title-scene');
  const drummer = scene.querySelector('.kit-drummer');
  drummer.innerHTML = mascotSVG('kong', 'idle');
  scene.querySelector('.kit-stick').innerHTML = stickSVG();
  scene.querySelector('.kit-bass').innerHTML = bassDrumSVG();
  scene.querySelector('.kit-snare').innerHTML = snareSVG();
  scene.querySelector('.kit-crash').innerHTML =
    '<svg viewBox="0 0 120 120"><path d="M60 30 L60 120" stroke="#2B1D3A" stroke-width="7"/><path d="M60 30 L60 120" stroke="#D9D6E6" stroke-width="3"/><ellipse cx="60" cy="28" rx="56" ry="12" fill="#F4C84A" stroke="#2B1D3A" stroke-width="4" transform="rotate(-12 60 28)"/></svg>';
  let t;
  scene.querySelectorAll('[data-lane]').forEach((el) => {
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      await audio.unlock();
      const kick = el.dataset.lane === '0';
      if (kick) audio.kick();
      else audio.snare();
      const cls = kick ? 'hit-kick' : 'hit-snare';
      scene.classList.remove(cls);
      void scene.offsetWidth;
      scene.classList.add(cls);
      drummer.innerHTML = mascotSVG('kong', 'hit');
      clearTimeout(t);
      t = setTimeout(() => {
        drummer.innerHTML = mascotSVG('kong', 'idle');
        scene.classList.remove('hit-kick', 'hit-snare');
      }, 170);
    });
  });
  refreshQuick();
}

/** '바로 시작': 릴스 링크(?level=N)로 온 곡이 열려 있으면 그 곡, 아니면 아직 안 깬 첫 단계 */
function refreshQuick() {
  const q = getLevel(params.get('level'));
  const id = q && !progressLocked(q.id) && !closedLocked(q.id) ? q.id : nextChallenge(loadBests());
  state.quickId = id;
  $('[data-action="quickstart"]').innerHTML =
    id === ENDLESS_ID ? `${icon('play')} 바로 시작 <small>무제한 모드</small>` : `${icon('play')} 바로 시작 <small>${id}단계</small>`;
}

function refreshToday() {
  const lv = todayLevel();
  const best = loadBests()[lv.id];
  $('#today-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#today-sub').textContent = best ? `내 최고 ${fmt(best.score)}점 · 친구에게 1:1 도전장 ⚔️` : `${lv.id}단계 · 점수 내고 친구에게 1:1 도전장 ⚔️`;
}

/** 시작 화면·단계 고르기의 작은 '팔로우·랭킹 참여' 버튼 */
function refreshFollowChip() {
  const me = state.me || {};
  const on = state.api && state.api.mode === 'server';
  for (const el of $$('.follow-chip')) {
    el.hidden = !on;
    el.classList.toggle('warn', !!me.hidden);
    el.classList.toggle('todo', !me.hidden && !me.confirmed);
    el.classList.toggle('ok', !me.hidden && !!me.confirmed);
    el.textContent = me.hidden
      ? '⚠️ 팔로우 확인 안 됨'
      : !me.guest || me.needsIg
        ? `📸 팔로워 인증 받기 · 랭킹 참여`
        : me.confirmed
          ? `✅ @${me.player?.ig || ''} 팔로워 인증 완료`
          : `📸 팔로워 인증 받기 · 랭킹 참여`;
  }
}

function refreshTitle() {
  refreshFollowChip();
  // 멀티·건의하기는 팔로워 인증한 사람만 → 안 했으면 🔒
  const lockMark = followGated() ? '🔒 ' : '';
  $('.mode-multi small').textContent = `${lockMark}실시간 대결`;
  $('[data-action="suggest-open"] span').textContent = `${lockMark}건의하기`;
  refreshToday();
  refreshQuick();
  const foot = $('#title-foot');
  if (state.me.guest) {
    foot.innerHTML = `<b>${escapeHtml(state.me.player?.username || '')}</b> 님, 오늘도 쿵짝!`;
  } else {
    foot.innerHTML = handle() ? `만든 곳 <a href="https://instagram.com/${handle()}" target="_blank" rel="noopener">${atHandle()}</a> · 새 곡 소식은 인스타에서!` : '모두 아는 명곡에 맞춰 드럼을 쳐 보세요!';
  }
}

// ---------------- 레벨 목록 ----------------
/** 단계 목록 보기: 'normal' = 일반 단계 / 'endless' = 단계별 무제한 */
function levelMode() {
  return load('levelMode', 'normal') === 'endless' ? 'endless' : 'normal';
}

/** 그리그 무제한 모드 카드 (12단계를 깨고 팔로워 인증을 받으면 열림) */
function grieggCardHTML(bests) {
  const eVLock = verifyLocked(ENDLESS_ID);
  const eLock = eVLock || !isUnlocked(ENDLESS_ID, bests);
  const eb = bests[ENDLESS_ID];
  return `<button class="level-card endless-card ${eLock ? 'locked' : ''}" data-level="${ENDLESS_ID}">
      <div class="lv"><span>∞</span></div>
      <div class="info"><h4>무제한 모드 <small>그리그</small></h4><p>깰수록 BPM +10 · 속도 한도 없음</p><p class="gem-rule">💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어</p></div>
      <div class="meta">${eLock ? `<span class="lockline">${icon('lock')} ${eVLock ? '팔로워 인증' : LOCK_FROM_PREV(ENDLESS_ID)}</span>` : `${gemsHTML(eb ? eb.diamonds || 0 : 0, 'sm')}<span>${eb ? `최고 Lv.${eb.roundsCleared || 0} 클리어` : 'NEW'}</span>`}</div>
    </button>`;
}

/** 무제한 보기: 맨 위에 그리그 무제한(랭킹) + 단계별 무제한 (지금은 전부 준비 중) */
/** 단계 묶음 제목 (묶음마다 맵 분위기가 다름) */
function groupHeadHTML(id) {
  const g = groupStarting(id);
  if (!g) return '';
  return `<div class="level-group theme-${g.key}" role="presentation"><span>${g.theme.emoji}</span><b>${g.theme.name}</b><small>${g.from}~${g.to}단계 맵</small></div>`;
}

function renderEndlessLevels(bests) {
  const list = [grieggCardHTML(bests)];
  for (const lv of LEVELS) {
    const id = levelEndlessId(lv.id);
    const closed = closedLocked(id);
    const prevLock = !isUnlocked(id, bests);
    const vLock = verifyLocked(id);
    const locked = closed || prevLock || vLock;
    const b = bests[id];
    const meta = closed
      ? CLOSED_META()
      : vLock
      ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
      : prevLock
      ? `<span class="lockline">${icon('lock')} ${lv.id}단계 깨면 열림</span>`
      : `${gemsHTML(b ? b.diamonds || 0 : 0, 'sm')}<span>${b ? `최고 Lv.${b.roundsCleared || 0}` : 'NEW'}</span>`;
    list.push(groupHeadHTML(lv.id));
    list.push(`<button class="level-card endless-card lv-endless ${locked ? 'locked' : ''}" data-level="${id}">
      <div class="lv"><span>${lv.id}<small>∞</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.bpm} BPM부터 · 4마디마다 +${LEVEL_ENDLESS_STEP}</p></div>
      <div class="meta">${meta}</div>
    </button>`);
  }
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() ? '' : `🔒 💎 무제한 모드는 <b>${igWho()} 팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}12단계를 깨면 그리그 무제한이 열려요. 목숨이 다 떨어질 때까지 계속!<br>단계별 무제한은 그 단계를 깨면 열려요.<br>💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어`;
}

function renderLevels() {
  const bests = loadBests();
  const mode = levelMode();
  $$('#level-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  if (mode === 'endless') {
    renderEndlessLevels(bests);
    return;
  }
  const list = LEVELS.map((lv) => {
    const prevLock = !isUnlocked(lv.id, bests);
    const closed = closedLocked(lv.id);
    const vLock = verifyLocked(lv.id);
    const locked = closed || prevLock || vLock;
    const b = bests[lv.id];
    const meta = closed
      ? CLOSED_META()
      : vLock
      ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
      : prevLock
      ? `<span class="lockline">${icon('lock')} ${LOCK_FROM_PREV(lv.id)}</span>`
      : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
    return `${groupHeadHTML(lv.id)}<button class="level-card ${locked ? 'locked' : ''} ${lv.boss ? 'boss' : ''}" data-level="${lv.id}">
      <div class="lv"><span>${lv.id}<small>단계</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
  });
  // 맨 아래: 그리그 무제한 모드 (12단계 깨면 열림)
  list.push(grieggCardHTML(bests));
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() ? '' : `🔒 1~${FREE_UPTO}단계는 맛보기! ${FREE_UPTO + 1}단계부터와 💎 무제한은 <b>팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요.<br><b>같은 난이도를 하나 깨면 그 난이도는 전부 열려요</b> (예: 지옥 하나 깨면 지옥 전부)<br>별 3개: ${STAR_RULES[0].text}`;
}

// ---------------- 게임 ----------------
/** free: 오늘의 노래·친구 도전장은 앞 단계를 안 깼어도 칠 수 있음 */
async function tryStart(id, { free = false } = {}) {
  // 4단계부터와 무제한은 팔로워 인증(인증 완료)해야 열림
  if (closedLocked(id)) {
    openVerify(id);
    return;
  }
  // 팔로워 인증 단계는 앞 단계를 안 깼어도 신청은 미리 할 수 있게 먼저 안내
  if (verifyLocked(id)) {
    openVerify(id);
    return;
  }
  if (!free && progressLocked(id)) {
    toast(progressLockText(id), 2800);
    if ($('#screen-title').classList.contains('active')) {
      renderLevels();
      show('screen-levels');
    }
    return;
  }
  startLevel(id);
}

// 구글 글꼴(Jua)은 한글을 글자 묶음별로 나눠 받아서, 캔버스에만 쓰는 글자는 따로 받아 둬야 깨지지 않음
const CANVAS_TEXT = '쿵짝챙츠둥왼쪽오른엄지킥스네어하이햇크래시탐연타황금콩다가온선에닿을때그줄을톡여기눌러도OK키클릭NEW노을피크닉네온시티콘서트홀블랙스테이지용암보스전오로라설원우주무대GROOVECOMBO점';
async function fontsReady(extra = '') {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Jua"'), document.fonts.load('40px "Jua"', CANVAS_TEXT + extra)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {}
}

// 곡 시작은 비동기(악기 소리 불러오기 등)라서, 같은 단계를 빠르게 두 번 누르면 게임이 둘 생겨
// 먼저 만든 쪽이 카운트인 중에 이미 진행되던 버그가 있었음 → 마지막 호출만 살리고 앞선 호출은 중단
let startSeq = 0;
async function startLevel(id, opts = {}) {
  const lv = playable(id);
  if (!lv) return;
  // 친구 대결 방 판: { startAt(내 시계 ms), mode } — 같은 시각에 시작, 랭킹엔 안 올림
  const room = opts.room || null;
  document.body.classList.toggle('room-game', !!room);
  // 처음 한 번은 박자 보정을 꼭 하고 시작 (영상 찍기·자동 연주는 제외. 대결 방은 '준비' 전에 미리 함)
  if (!room && needsCalibration()) {
    openCalibration({ required: true, after: () => startLevel(id) });
    return;
  }
  const seq = ++startSeq;
  const stale = () => seq !== startSeq;
  state.levelId = id;
  await audio.unlock();
  if (stale()) return;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  audio.orchOn = state.settings.band !== 'piano';
  if (state.game) state.game.stop();
  closeModal('modal-pause');
  show('screen-game');
  $('#hud-lv').textContent = lv.challenge ? (lv.endless ? '무제한' : '챌린지') : lv.studioOnly ? '🎬 릴스용' : `${lv.id}단계`;
  $('#hud-name').textContent = lv.challenge ? `${lv.songName} · ${lv.composer}` : `${lv.name} · ${lv.composer}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  closeModal('modal-continue');
  const st = state.studio;
  renderLives(st.active || state.auto ? null : MAX_LIVES);
  const vs = !room && !st.active && !lv.challenge && state.vs && state.vs.levelId === id ? state.vs : null;
  $('#hud-vs').hidden = !vs && !room;
  if (vs || room) {
    $('#vs-name').textContent = vs ? vs.name : (state.roomClient.realtime ? '⚡' : '') + roomOtherName();
    $('#vs-me').textContent = '0';
    $('#vs-op').textContent = '0';
    $('#vs-fill').style.width = '50%';
  }
  // 악기 샘플이 아직이면 잠깐 기다림 (최대 3초. 피아노가 안 되면 합성음, 오케스트라는 받는 대로 중간부터 합류)
  const orchLoad = audio.orchOn ? audio.loadOrch() : Promise.resolve();
  await Promise.race([Promise.all([audio.loadPiano(), orchLoad]), new Promise((r) => setTimeout(r, 3000))]);
  if (stale()) return;
  $('#screen-game').classList.toggle('studio-mode', st.active);
  renderer.studio = st.active ? studioOverlay(lv) : null;
  setKit(lv);
  await fontsReady(renderer.studio ? `${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}` : '');
  await new Promise((r) => requestAnimationFrame(r));
  const cw = $('#game-canvas').clientWidth || window.innerWidth;
  await renderer.resize(st.active ? Math.min(3, Math.max(2, 1080 / cw)) : 2);
  if (stale()) return;
  if (state.game) state.game.stop();
  state.runToken = null;
  // 영상 찍기는 팔로우 잠금 없이 (계정 주인이 촬영용으로 씀) → 서버 판 토큰도 안 받음
  if ((!lv.challenge || lv.endless) && !st.active && !room) state.api
    .startRun(id)
    .then((r) => (state.runToken = r.runToken))
    .catch((e) => {
      if (e.status === 403 && state.game && state.game.level.id === id) {
        state.game.stop();
        show('screen-levels');
        if (e.data && e.data.error === 'verify_required') {
          state.me = { ...state.me, checked: false };
          renderLevels();
          openVerify(id);
          return;
        }
        if (e.data && /^confirm_/.test(e.data.error)) {
          state.me = { ...state.me, confirmed: false };
          renderLevels();
          openVerify(id);
          return;
        }
        toast('판을 시작하지 못했어요. 다시 해 보세요', 2600);
      }
    });
  const last = { score: -1, p: -1, op: -1, lives: MAX_LIVES, stars: -1 };
  const starBox = $('#hud-stars');
  starBox.hidden = !!lv.endless;
  starBox.innerHTML = starsHTML(0);
  state.game = new Game({
    audio,
    renderer,
    level: lv,
    settings: state.settings,
    auto: state.auto,
    onHud: (h) => {
      if (h.score !== last.score) $('#hud-score').textContent = fmt(h.score);
      const p = Math.round(h.progress * 200);
      if (p !== last.p) $('#hud-progress').style.width = p / 2 + '%';
      if (room) {
        // 내 점수는 다음 주고받기 때 같이 감 (2초마다), 상대 점수는 받은 값
        state.roomClient.send({ live: { score: h.score, combo: state.game ? state.game.combo : 0, progress: h.progress, lives: h.lives } });
        const o = state.roomClient.other;
        const op = o && o.final ? o.final.score : o && o.live ? o.live.score : 0;
        const rtNow = state.roomClient.realtime;
        if (rtNow !== last.rt) {
          $('#vs-name').textContent = (rtNow ? '⚡' : '') + roomOtherName();
          last.rt = rtNow;
        }
        if (op !== last.op || h.score !== last.score) {
          $('#vs-me').textContent = fmt(h.score);
          $('#vs-op').textContent = room.mode === 'team' ? `${fmt(op)} · 팀 ${fmt(h.score + op)}` : fmt(op);
          const tot = h.score + op;
          $('#vs-fill').style.width = (tot ? (h.score / tot) * 100 : 50).toFixed(1) + '%';
        }
        last.op = op;
      } else if (vs) {
        const op = opponentScoreAt(vs.timeline, h.barPos);
        if (op !== last.op || h.score !== last.score) {
          $('#vs-me').textContent = fmt(h.score);
          $('#vs-op').textContent = fmt(op);
          const tot = h.score + op;
          $('#vs-fill').style.width = (tot ? (h.score / tot) * 100 : 50).toFixed(1) + '%';
        }
        last.op = op;
      }
      if (h.round && h.round !== last.round) {
        $('#hud-name').textContent = `Lv.${h.round.round} · ${h.round.name} · ${h.round.bpm} BPM`;
        last.round = h.round;
      }
      if (h.lives != null && h.lives !== last.lives) {
        renderLives(h.lives, last.lives);
        last.lives = h.lives;
      }
      if (h.stars != null && h.stars !== last.stars) {
        starBox.innerHTML = starsHTML(h.stars);
        // 새로 생긴 별만 톡 튀어나오게
        if (last.stars >= 0) starBox.querySelectorAll('svg').forEach((el, i) => i >= last.stars && i < h.stars && el.classList.add('pop'));
        last.stars = h.stars;
      }
      last.score = h.score;
      last.p = p;
    },
    onEnd: (res) => {
      if (!state.studio.active && !res.auto) trackPlayEnd({ result: res.failed || res.died ? 'fail' : 'clear', score: res.score, stars: res.stars });
      if (room && state.roomClient.active) {
        res.room = { mode: room.mode, round: room.round };
        state.roomClient.send({ final: { score: res.score, stars: res.stars, grade: res.grade, failed: !!res.failed, maxCombo: res.maxCombo, accuracy: res.accuracy } }, true);
      }
      return state.studio.active ? studioFinish(res) : showResult(res);
    },
    // 영상 찍기 땐 목숨 없음 (녹화 중에 멈추면 안 되니까)
    onDeath: st.active ? null : onDeath,
  });
  if (room) {
    // 친구와 같은 시각에 시작: 남은 시간 카운트다운 (Game.start 가 0.35초 뒤에 첫 박을 놓음)
    const box = $('#studio-count');
    box.hidden = false;
    $('#studio-count-msg').textContent = room.mode === 'team' ? '🤝 팀전! 둘이 같이 깨 봐요' : `⚔️ ${roomOtherName()} 님과 대결!`;
    const g = state.game;
    // 기다리는 동안 무대(맵)를 그려 둠
    renderer.draw({ now: -1, notes: g.notes, approach: g.approach, beatDur: g.beat, combo: 0, score: 0, playing: false }, performance.now() / 1000);
    await new Promise((resolve) => {
      const tick = () => {
        if (stale() || state.game !== g) return resolve();
        const left = room.startAt - 350 - Date.now();
        $('#studio-count-num').textContent = String(Math.max(1, Math.ceil(left / 1000)));
        if (left <= 0) return resolve();
        setTimeout(tick, Math.min(100, left));
      };
      tick();
    });
    box.hidden = true;
    if (stale() || state.game !== g) return;
  }
  let stallToastAt = 0;
  state.game.onStall = () => {
    if (Date.now() - stallToastAt < 4000) return;
    stallToastAt = Date.now();
    toast('🔇 폰이 소리를 잠깐 멈췄어요. 화면을 한 번 톡 눌러 주세요', 3000);
  };
  state.game.start();
  // 영상 찍기·자동 연주는 통계에 안 셈
  if (!st.active && !state.auto) trackPlayStart(id, vs || room ? 'vs' : 'normal');
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
  renderer.setTheme(lv); // 단계 묶음마다 맵 분위기가 다름 (themes.js)
  // 마우스·키보드 쓰는 컴퓨터면 줄마다 키 글자를 보여줌 (폰·태블릿은 안 보임)
  renderer.keyLabels = null;
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const letters = KEY_LABELS[renderer.laneOrder.length] || KEY_LABELS[2];
    renderer.keyLabels = {};
    renderer.laneOrder.forEach((lane, i) => (renderer.keyLabels[lane] = letters[i]));
  }
}

/** 누른 줄의 악기 (원근으로 비스듬한 줄 모양 그대로. 악기 그림을 정확히 안 눌러도 됨) */
function laneFromPoint(x, y) {
  const r = $('#game-canvas').getBoundingClientRect();
  return renderer.laneAt(x - r.left, y - r.top);
}

// 키보드: 레인 수에 따라 왼쪽부터 키 배정
const KEYMAP = {
  2: [['KeyF', 'KeyD', 'KeyA', 'ArrowLeft'], ['KeyJ', 'KeyK', 'KeyL', 'ArrowRight']],
  3: [['KeyF', 'KeyD', 'ArrowLeft'], ['KeyJ', 'ArrowDown'], ['KeyK', 'KeyL', 'ArrowRight']],
  4: [['KeyD', 'KeyS'], ['KeyF', 'ArrowLeft'], ['KeyJ', 'ArrowRight'], ['KeyK', 'KeyL']],
  5: [['KeyS', 'KeyA'], ['KeyD'], ['KeyF', 'ArrowLeft'], ['KeyJ', 'ArrowRight'], ['KeyK', 'KeyL']],
};

// 화면에 보여줄 키 글자 (KEYMAP 의 첫 번째와 같게)
const KEY_LABELS = { 2: ['F', 'J'], 3: ['F', 'J', 'K'], 4: ['D', 'F', 'J', 'K'], 5: ['S', 'D', 'F', 'J', 'K'] };

function bindGameInput() {
  const canvas = $('#game-canvas');
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      state.game.input(laneFromPoint(e.clientX, e.clientY), e.timeStamp);
    },
    { passive: false }
  );
  ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu'].forEach((ev) =>
    canvas.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
  );
  window.addEventListener('keydown', (e) => {
    if (!$('#screen-game').classList.contains('active') || !state.game) return;
    // 방금 누른 버튼에 포커스가 남아 있으면 스페이스·엔터가 그 버튼을 또 눌러 버림
    if (document.activeElement && document.activeElement !== document.body && !$('#modal-pause').offsetParent) document.activeElement.blur();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      togglePause();
      return;
    }
    if (e.repeat) return;
    const order = state.game.laneOrder;
    const idx = (KEYMAP[order.length] || KEYMAP[2]).findIndex((keys) => keys.includes(e.code));
    if (idx >= 0) state.game.input(order[idx], e.timeStamp);
    else if (e.code === 'Space') {
      state.game.input(0, e.timeStamp);
      state.game.input(1, e.timeStamp);
    } else return;
    e.preventDefault();
  });
}

function togglePause() {
  const g = state.game;
  if (!g) return;
  if (g.state === 'playing') {
    g.pause();
    openModal('modal-pause');
  } else if (g.state === 'paused') resumeGame();
}

async function resumeGame() {
  closeModal('modal-pause');
  const g = state.game;
  if (!g || g.state !== 'paused') return;
  await countdownResume(g);
}

/** 3초 카운트다운 후 재개 (손가락 올릴 시간) */
async function countdownResume(g) {
  for (const n of ['3', '2', '1']) {
    toast(n, 450);
    await new Promise((r) => setTimeout(r, 450));
  }
  if (state.game !== g || g.state !== 'paused') return;
  await audio.unlock();
  g.resume();
}

// ---------------- 목숨 · 이어하기 ----------------
/** HUD 하트 n개 (null 이면 숨김). prev 보다 줄면 깨지는 연출, 늘면 통통 */
function renderLives(n, prev) {
  const box = $('#hud-lives');
  if (n == null) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) => {
    const cls = i < n ? 'on' : 'off';
    const fx = prev != null && i >= n && i < prev ? ' lost' : prev != null && i < n && i >= prev ? ' gain' : '';
    return `<i class="${cls}${fx}">${icon('heart')}</i>`;
  }).join('');
  box.classList.toggle('low', n === 1);
}

/** 이어하기 창이 뜬 뒤 이 시간(ms) 동안은 창 안 버튼이 눌리지 않음 (터치 중이던 손가락 오입력 방지) */
const CONT_GUARD_MS = 500;
let contOpenedAt = -Infinity;

/** 목숨 0개: 게임이 멈춘 상태로 이어하기 창 */
function onDeath(info) {
  const g = state.game;
  const lv = g.level;
  state.death = info;
  contOpenedAt = performance.now();
  $('#cont-score').textContent = `${fmt(info.score)}점`;
  if (lv.challenge) {
    const r = g.roundInfo || roundInfo(1);
    $('#cont-level').textContent = `${lv.baseId ? lv.name : '무제한 모드'} · Lv.${r.round} ${r.name}`;
    $('#cont-progress').style.width = `${Math.min(100, (r.round / 10) * 100)}%`;
    $('#cont-progress-text').textContent = `Lv.${r.round} · ${r.bpm} BPM 까지 왔어요`;
  } else {
    $('#cont-level').textContent = `${lv.id}단계 · ${lv.name}`;
    $('#cont-progress').style.width = `${Math.round(info.progress * 100)}%`;
    $('#cont-progress-text').textContent = `곡 ${Math.round(info.progress * 100)}% 까지 왔어요`;
  }
  $('#btn-continue').hidden = !info.canContinue;
  $('#cont-note').textContent = info.canContinue
    ? `광고를 끝까지 보면 목숨 ${REVIVE_LIVES}개로 바로 그 자리부터 이어서 쳐요 (한 판에 한 번)`
    : '이어하기는 한 판에 한 번이에요. 다시 도전해 보세요!';
  openModal('modal-continue');
}

async function continueWithAd() {
  const g = state.game;
  if (!g || g.state !== 'dead') return;
  const btn = $('#btn-continue');
  btn.disabled = true;
  closeModal('modal-continue');
  const r = await showRewarded(state.cfg, {
    beforeAd: () => audio.setVolumes({ music: 0, sfx: 0 }),
    afterAd: () => audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx }),
  });
  btn.disabled = false;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  if (state.game !== g || g.state !== 'dead') return;
  if (r === 'rewarded' && g.revive()) {
    renderLives(REVIVE_LIVES, 0);
    await countdownResume(g);
  } else {
    toast('광고를 끝까지 봐야 이어할 수 있어요');
    onDeath(state.death);
  }
}

function giveUp() {
  closeModal('modal-continue');
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
}

// ---------------- 결과 ----------------
function showResult(res) {
  if (state.suggestLite && !state.settings.lite) {
    state.suggestLite = false;
    setTimeout(() => toast('폰이 버거워해서 무대 효과를 줄였어요. 그래도 버벅이면 ⚙ 설정 → 저사양 모드', 4200), 2600);
  }
  res.runToken = state.runToken;
  state.lastResult = res;
  $('#screen-result').classList.toggle('in-room', !!res.room);
  $('#res-room').hidden = !res.room;
  if (res.room) setTimeout(renderRoomResult, 0);
  if (res.challenge) {
    showChallengeResult(res);
    return;
  }
  const lv = getLevel(res.levelId);
  const nextId = nextOpenId(res.levelId);
  const wasOpen = { next: nextId == null || !progressLocked(nextId), endless: !progressLocked(ENDLESS_ID), levels: LEVELS.filter((l) => !progressLocked(l.id)).map((l) => l.id) };
  // 목숨 다 써서 끝난 판은 최고 기록에 안 들어감
  const best = state.auto || res.failed ? { isNew: false } : saveBest(res);
  // 이번 판으로 새로 열린 단계 알림
  if (!state.auto && !res.failed) {
    if (res.levelId === ENDLESS_FROM && !wasOpen.endless && !progressLocked(ENDLESS_ID)) setTimeout(() => toast('💎 무제한 모드가 열렸어요! 깰수록 빨라져요', 3200), 2600);
    else {
      // 같은 난이도를 하나 깨면 그 난이도가 전부 열림 → 여러 단계가 한 번에 열렸으면 그렇게 알림
      const opened = LEVELS.filter((l) => !wasOpen.levels.includes(l.id) && !progressLocked(l.id)).map((l) => l.id);
      if (opened.length > 1) setTimeout(() => toast(`🔓 ${opened[0]}~${opened[opened.length - 1]}단계가 한꺼번에 열렸어요!`, 3000), 2600);
      else if (opened.length === 1) setTimeout(() => toast(`🔓 ${opened[0]}단계가 열렸어요!`, 2600), 2600);
    }
  }
  $('#res-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.toggle('failed', !!res.failed);
  const g = $('#res-grade');
  g.textContent = res.grade;
  g.style.color = gradeColor(res.grade);
  const nextRule = STAR_RULES.slice().reverse().find((r) => r.stars > res.stars);
  $('#res-star-hint').innerHTML = res.failed
    ? `목숨을 다 썼어요! 곡 ${Math.round((res.progress || 0) * 100)}% 까지 · 콤보 ${LIFE_REGEN_COMBO}개마다 목숨 +1`
    : res.stars === 3
      ? '완벽해요! 별 3개 달성 🎉'
      : res.stars === 0
        ? `아쉬워요! 별 1개: ${STAR_RULES[2].text}`
        : `별 ${nextRule.stars}개: ${nextRule.text}`;
  $('#res-new').hidden = !best.isNew;
  const badge = $('#res-badge');
  badge.hidden = !res.fullCombo;
  badge.textContent = res.counts.perfect === res.total && !res.counts.wrong ? 'ALL PERFECT' : 'FULL COMBO';
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.stars === 0 ? 'miss' : res.stars === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = mascotSVG('kong', face) + mascotSVG('jjak', face);
  const timing =
    Math.abs(res.avgOffsetMs) < 15 ? '타이밍 딱 좋아요' : res.avgOffsetMs < 0 ? `평균 ${-res.avgOffsetMs}ms 빨라요` : `평균 ${res.avgOffsetMs}ms 늦어요`;
  const extras = [res.goldTotal ? `✨ 황금 콩 ${res.goldHits}/${res.goldTotal}` : '', res.rollHits ? `💥 연타 ${res.rollHits}번` : ''].filter(Boolean).join(' · ');
  $('#res-meta').innerHTML = `정확도 ${(res.accuracy * 100).toFixed(1)}% · 최대 콤보 ${res.maxCombo} · ${timing}${extras ? '<br>' + extras : ''}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  const next = getLevel(nextOpenId(lv.id));
  const nb = $('#btn-next');
  nb.hidden = false;
  if (next) nb.innerHTML = `다음 ${next.id}단계 ${progressLocked(next.id) ? icon('lock') : ''}`;
  else nb.innerHTML = `💎 무제한 모드 ${progressLocked(ENDLESS_ID) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = state.auto || res.failed;
  // 끝까지 친 판은 알아서 랭킹에 올림 (점수 올라가는 연출이 끝날 즈음)
  if (!state.auto && !res.failed && !res.room) setTimeout(() => submitRank(res), 1800);
  $('#btn-vs').hidden = state.auto || res.failed;
  // 박자가 계속 한쪽으로 밀리면 (블루투스 이어폰 등) 한 번에 맞추기
  const hits = (res.counts.perfect || 0) + (res.counts.great || 0) + (res.counts.good || 0);
  if (!state.auto && hits >= 8 && Math.abs(res.avgOffsetMs) >= 40) {
    const nextOffset = clampOffset(state.settings.offsetMs + res.avgOffsetMs);
    if (nextOffset !== state.settings.offsetMs)
      $('#res-meta').innerHTML += `<br><button class="btn btn-sm btn-ghost res-tune" data-action="tune-sync" data-offset="${nextOffset}">박자가 안 맞나요? 내 손에 맞게 자동 보정</button>`;
  }
  // 1:1 대결 결과
  const vs = !state.auto && state.vs && state.vs.levelId === res.levelId ? state.vs : null;
  const box = $('#res-vs');
  let outcome = null;
  if (vs) {
    outcome = versusOutcome(res.score, vs.score);
    const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' }[outcome];
    box.innerHTML = `<div class="vs-result ${outcome}">${word}</div>
      <div class="vs-row"><span>나<b>${fmt(res.score)}</b></span><span class="vs-x">VS</span><span>${escapeHtml(vs.name)}<b>${fmt(vs.score)}</b></span></div>`;
    $('#btn-vs').innerHTML = `${icon('swords')} ${outcome === 'win' ? '이겼다고 도전장 보내기' : '다시 도전장 보내기'}`;
  } else $('#btn-vs').innerHTML = `${icon('swords')} 친구에게 1:1 도전장`;
  show('screen-result');
  renderLevels();
  animateResult(res, outcome);
}

/** 무제한 모드 결과: 등급 자리에 "Lv.N", 별 대신 다이아몬드 */
function showChallengeResult(res) {
  const base = levelEndlessBase(res.levelId);
  const lv = base || getLevel(8);
  const best = state.auto ? { isNew: false } : saveBest(res);
  $('#res-level').textContent = base ? `${base.id}단계 무제한 · ${base.composer} ${base.name}` : `무제한 모드 · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.remove('failed');
  const g = $('#res-grade');
  g.textContent = `Lv.${res.roundReached}`;
  g.style.color = '#FFD84A';
  const next = DIAMOND_RULES.slice().reverse().find((r) => r.diamonds > res.diamonds);
  $('#res-star-hint').innerHTML =
    res.diamonds === 3
      ? `다이아 3개! 진짜 드러머예요 💎💎💎`
      : `${res.roundsCleared ? `Lv.${res.roundsCleared}까지 클리어` : 'Lv.1부터 다시 도전!'} · 다음 💎: ${next.text}`;
  $('#res-new').hidden = !best.isNew;
  $('#res-badge').hidden = true;
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.diamonds === 0 ? 'miss' : res.diamonds === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = mascotSVG('kong', face) + mascotSVG('jjak', face);
  const prev = best.prev && !best.isNew ? ` · 내 최고 Lv.${best.prev.roundsCleared || 0} 클리어` : '';
  $('#res-meta').innerHTML = `최고 속도 ${res.bpmReached} BPM · 최대 콤보 ${res.maxCombo} · 정확도 ${(res.accuracy * 100).toFixed(1)}%${prev}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  $('#btn-next').hidden = true;
  // 무제한 모드는 랭킹이 따로 있어서 끝나면 알아서 올려요 (Lv.1 이상 깼을 때)
  $('#btn-rank').hidden = state.auto || !res.endless;
  $('#btn-vs').hidden = true;
  show('screen-result');
  renderLevels();
  animateResult({ ...res, stars: res.diamonds }, null, true);
  if (!state.auto && res.endless) setTimeout(() => submitRank(res), 1800);
}

const clampOffset = (ms) => Math.max(-200, Math.min(200, Math.round(ms / 5) * 5));

/**
 * 결과 연출: 점수가 0부터 '따라라라' 올라감 → '딴!' → 별이 하나씩 '띵! 띵! 띵!' → 등급 도장 (+ 1:1 승패)
 * 화면을 누르면 바로 끝까지 건너뜀.
 */
const resultAnim = { id: 0, finish: null };
function animateResult(res, outcome, gems = false) {
  const id = ++resultAnim.id;
  const alive = () => resultAnim.id === id;
  const scoreEl = $('#res-score');
  const grade = $('#res-grade');
  const vsBox = $('#res-vs');
  const hint = $('#res-star-hint');
  $('#res-stars').innerHTML = gems ? gemsHTML(0, 'big seq') : starsHTML(0, 'big seq');
  const starEls = $$('#res-stars svg');
  grade.classList.add('pending');
  hint.classList.add('pending');
  vsBox.hidden = true;
  scoreEl.classList.remove('land');
  scoreEl.textContent = '0';
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => alive() && fn(), ms));

  const ratio = Math.min(1, res.score / (res.maxScore || res.score || 1));
  const startMs = 350;
  const countMs = res.score > 0 ? Math.round(700 + 1100 * ratio) : 0;
  const landMs = startMs + countMs;
  const starGap = 420;
  const gradeMs = landMs + 380 + Math.max(0, res.stars - 1) * starGap + 420;

  // 1) 점수 올라가는 소리: AudioContext 시계로 미리 예약해서 고르게 '따라라라'
  if (audio.running && countMs) {
    const t0 = audio.ctx.currentTime + startMs / 1000;
    const n = Math.floor(countMs / 55);
    for (let k = 0; k < n; k++) audio.tick(t0 + k * 0.055, k / n);
  }
  let raf;
  const t0 = performance.now() + startMs;
  const step = () => {
    if (!alive()) return;
    const p = Math.min(1, Math.max(0, (performance.now() - t0) / (countMs || 1)));
    scoreEl.textContent = fmt(Math.round(res.score * (1 - Math.pow(1 - p, 2))));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  // 2) 다 오르면 '딴!'
  const land = (sound) => {
    scoreEl.textContent = fmt(res.score);
    scoreEl.classList.add('land');
    if (sound && audio.running) audio.land();
  };
  later(landMs, () => land(true));
  // 3) 별 하나씩 '띵!'
  const starOn = (i, sound) => {
    starEls[i].classList.add('on');
    if (sound && audio.running) audio.starChime(audio.ctx.currentTime, i);
  };
  for (let i = 0; i < res.stars; i++) later(landMs + 380 + i * starGap, () => starOn(i, true));
  // 4) 등급 도장 + 승패
  const reveal = (sound) => {
    grade.classList.remove('pending');
    hint.classList.remove('pending');
    grade.style.animation = 'none';
    void grade.offsetWidth;
    grade.style.animation = '';
    vsBox.hidden = !outcome;
    if (!sound || !audio.running) return;
    const t = audio.ctx.currentTime + 0.05;
    if (res.stars === 3 || outcome === 'win') audio.fanfare(t);
    else if (res.stars === 0 || outcome === 'lose') audio.aww(t);
  };
  later(gradeMs, () => reveal(true));
  resultAnim.finish = () => {
    if (!alive()) return;
    resultAnim.id++;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    if (audio.running) audio.silenceTicks();
    land(false);
    starEls.forEach((el, i) => i < res.stars && el.classList.add('on'));
    reveal(false);
  };
}

// ---------------- 1:1 대결 (도전장 링크) ----------------
function siteUrl() {
  return state.cfg.siteUrl || location.origin + location.pathname.replace(/index\.html$/, '');
}

function sendChallenge() {
  const r = state.lastResult;
  if (!r || r.auto) return;
  const nick = load('nick', '');
  if (!nick) {
    $('#nick-input').value = '';
    openModal('modal-nick');
    setTimeout(() => $('#nick-input').focus(), 50);
    return;
  }
  shareChallenge(nick);
}

async function shareChallenge(nick) {
  const r = state.lastResult;
  const lv = getLevel(r.levelId);
  const code = encodeChallenge({ name: nick, levelId: r.levelId, score: r.score, stars: r.stars, grade: r.grade, accuracy: r.accuracy, timeline: r.timeline });
  const url = `${siteUrl()}?vs=${code}`;
  const text = `⚔️ ${nick}의 1:1 도전장! ${CONFIG.appName} ${lv.name}(${lv.composer}) ${fmt(r.score)}점. 이길 수 있어?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${CONFIG.appName} 1:1 도전장`, text, url });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const ok = await copyText(`${text} ${url}`);
  toast(ok ? '도전장 링크를 복사했어요! 카톡·DM에 붙여넣어 보내세요' : '링크를 복사하지 못했어요', 3200);
}

function openIncomingVs(ch) {
  const lv = getLevel(ch.levelId);
  state.vsIncoming = ch;
  $('#vs-in-name').textContent = ch.name;
  $('#vs-in-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  $('#vs-in-score').textContent = `${fmt(ch.score)}점`;
  $('#vs-in-stars').innerHTML = starsHTML(ch.stars);
  openModal('modal-vs');
}

/** 랭킹에 내 점수 올리기. 끝까지 친 판은 결과가 뜨면 알아서 올라가요 (닉네임이 있을 때) */
async function submitRank(r = state.lastResult) {
  // 무제한 모드는 목숨이 다해 끝나도 올림 (최소 Lv.1 은 깨야). 영상용 챌린지(ch4 등)는 안 올림
  // 무제한(그리그·단계별)은 곡마다 따로 랭킹
  const endless = !!r && (r.levelId === ENDLESS_ID || !!levelEndlessBase(r.levelId));
  if (!r || r.auto || (r.challenge && !endless) || (r.failed && !endless) || r.submitted || r.submitting) return;
  if (endless && !(r.roundsCleared >= 1)) return;
  if (demoOnly() || state.api.mode !== 'server') return;
  // 랭킹은 팔로워 인증(암호)을 받은 사람만 → 안 받았으면 인증 창을 한 번 띄움
  if (!isConfirmed()) {
    askNickname();
    return;
  }
  if (!r.runToken) return;
  r.submitting = true;
  try {
    const out = await state.api.submitScore(
      endless
        ? { runToken: r.runToken, level: r.levelId, rounds: r.roundsCleared, score: r.score }
        : { runToken: r.runToken, level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts }
    );
    r.submitted = true;
    if (out.rank == null) toast('팔로우 확인이 안 돼서 지금은 랭킹에 안 보여요. 위 ⚠️ 버튼을 눌러 주세요', 3200);
    else if (endless) toast(out.improved ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · ${out.rank}위 🏆` : `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요 · ${out.rank}위`, 3200);
    else toast(out.improved ? `랭킹에 올라갔어요! 현재 ${out.rank}위 🏆` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요 · ${out.rank}위`, 3000);
  } catch (e) {
    if (e.status === 401 || (e.status === 403 && e.data && e.data.error === 'verify_required')) {
      if (e.status === 401) state.me = { verified: false };
      else state.me = { ...state.me, confirmed: false };
      askNickname();
    }
    // 그 밖의 실패(이미 올린 판, 검증 실패 등)는 조용히 넘어감
  } finally {
    r.submitting = false;
  }
}

/** 닉네임이 아직 없으면 한 번 물어봄 (이번 접속에서 닫으면 다시 안 물음) */
function askNickname(force = false) {
  if (!force && state.nickAsked) return;
  state.nickAsked = true;
  // 인증 완료한 사람은 닉네임 바꾸기, 아니면 팔로워 인증 창
  if (isConfirmed()) openJoin();
  else openVerify(null);
}

// 랭킹 닉네임 정하기
function openJoin() {
  $('#join-err').hidden = true;
  $('#join-name').value = state.me.player?.username || load('lastNick', '');
  $('#join-ig').value = state.me.player?.ig || load('lastIg', '');
  const h = state.me.hidden;
  $('#join-warn').hidden = !h;
  if (h) {
    const d = new Date(h.deleteAt);
    $('#join-warn').innerHTML = `⚠️ <b>팔로우 확인이 안 됐어요.</b> 그래서 지금은 랭킹에서 내려가 있어요.<br>${atHandle()} 팔로우하고 인스타 아이디를 다시 적으면 랭킹에 돌아와요. <b>${d.getMonth() + 1}월 ${d.getDate()}일</b>까지 안 하면 기록이 지워져요.`;
  }
  $('#join-rule-handle').textContent = atHandle();
  $('#join-insta').href = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  openModal('modal-join');
  setTimeout(() => $('#join-name').focus(), 50);
}
async function submitJoin() {
  const name = $('#join-name').value.trim();
  const err = (t) => {
    $('#join-err').textContent = t;
    $('#join-err').hidden = false;
  };
  if ([...name].length < 2) return err('2자 이상으로 써 주세요.');
  if (!/^[\p{L}\p{N}_. ]+$/u.test(name)) return err('한글·영문·숫자·_ . 만 쓸 수 있어요.');
  // @ 나 인스타 주소로 써도 아이디만 뽑음 (서버도 같은 규칙으로 한 번 더 확인)
  let ig = $('#join-ig').value.trim().toLowerCase();
  const um = ig.match(/instagram\.com\/([^/?#\s]+)/);
  if (um) ig = um[1];
  ig = ig.replace(/^@+/, '');
  if (!/^[a-z0-9._]{1,30}$/.test(ig)) return err('인스타 아이디를 정확히 써 주세요. (영문·숫자·_ . 만)');
  try {
    state.me = await state.api.guest(name, ig);
    save('lastNick', name);
    save('lastIg', ig);
    closeModal('modal-join');
    refreshTitle();
    refreshFollowChip();
    renderLevels();
    if (state.me.checked) toast(`🎉 ${name} 님, 팔로워 인증 완료! ${VERIFY_WHAT()}가 열렸어요`, 3600);
    else toast(`${name} 님, 반가워요!`, 3000);
    submitRank();
  } catch (e) {
    err(e.status === 429 ? '잠시 후 다시 시도해 주세요.' : e.data && e.data.error === 'bad_ig' ? '인스타 아이디를 정확히 써 주세요.' : '등록하지 못했어요. 다시 시도해 주세요.');
  }
}

async function shareResult() {
  const r = state.lastResult;
  if (!r) return;
  toast('결과 카드 만드는 중…', 1200);
  const url = siteUrl();
  const canvas = await makeShareCard(r, { siteUrl: url, handle: handle() });
  const text = r.challenge
    ? `${CONFIG.appName} 무제한 모드 Lv.${r.roundsCleared} 클리어 (${r.bpmReached} BPM) ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${url}`
    : `${CONFIG.appName} ${r.levelId}단계 ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${url}`;
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], `okaystra-${r.challenge ? 'endless' : 'lv' + r.levelId}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    $('#share-title').textContent = '결과 카드';
    $('#share-hint').textContent = '이미지를 길게 눌러 저장하고 스토리에 올려보세요!';
    $('#share-img').src = canvas.toDataURL('image/png');
    openModal('modal-share');
    copyText(text);
  } catch {
    toast('이 브라우저에선 이미지 저장이 안 돼요. 스크린샷으로 남겨주세요!');
  }
}

// ---------------- 랭킹 ----------------
/** 이 랭킹 칸이 무제한 랭킹인지 ('endless' 또는 'e5' 같은 단계별 무제한) */
const isEndlessRank = (id) => id === ENDLESS_ID || !!levelEndlessBase(id);

async function openRank(levelId) {
  state.rankLevel = levelId || state.rankLevel || 1;
  renderRankTabs();
  openModal('modal-rank');
  await loadRank();
}

/** 위: 🎵 단계 / 💎 무제한 전환. 아래: 그 안의 탭 (단계 = 총 등수 + 1~15단계, 무제한 = 그리그 + 단계별 무제한) */
function renderRankTabs() {
  const cur = state.rankLevel;
  const endless = isEndlessRank(cur);
  $$('#rank-mode button').forEach((b) => b.setAttribute('aria-selected', String((b.dataset.rankMode === 'endless') === endless)));
  const tab = (id, label) => `<button role="tab" data-rank="${id}" aria-selected="${id === cur}">${label}</button>`;
  $('#rank-tabs').innerHTML = endless
    ? tab(ENDLESS_ID, '♾️ 그리그') + LEVELS.filter((l) => !closedLocked(levelEndlessId(l.id))).map((l) => tab(levelEndlessId(l.id), `${l.id}단계 ∞`)).join('')
    : tab('total', '🏆 총 등수') + LEVELS.map((l) => tab(l.id, `${l.id}단계`)).join('');
  const sel = $('#rank-tabs [aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
}

async function loadRank() {
  const list = $('#rank-list');
  if (demoOnly()) {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  try {
    const data = await state.api.leaderboard(state.rankLevel);
    const total = state.rankLevel === 'total';
    const endless = isEndlessRank(state.rankLevel);
    if (!data.entries.length) list.innerHTML = '<div class="rank-empty">아직 아무도 없어요. 첫 1위의 주인공이 되어보세요!</div>';
    else if (total) list.innerHTML = totalRankHtml(data);
    else if (endless)
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g endless">Lv.${e.rounds}</span></div>`
        )
        .join('');
    else
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g" style="color:${gradeColor(e.grade)}">${e.grade || ''}</span></div>`
        )
        .join('');
    const foot = [];
    if (data.sample && isLocalDev()) foot.push('(개발 모드: 서버 없이 내 기록만 보여요)');
    if (total) foot.push('단계별 최고점을 모두 더한 점수예요. 더 많은 단계를 높은 점수로 칠수록 올라가요!');
    if (endless) {
      const eb = levelEndlessBase(state.rankLevel);
      foot.push(`${eb ? `${eb.id}단계 ${escapeHtml(eb.name)} 무제한` : '그리그 무제한 모드'} 랭킹이에요. 더 높은 단계(Lv.)까지 깬 사람이 위, 같으면 점수가 높은 사람이 위예요.`);
    }
    if (data.me) foot.push(`내 순위: ${data.me.rank}위.`);
    if (state.me.guest) foot.push(`<b>${escapeHtml(state.me.player?.username)}</b> 님으로 참여 중 · 끝까지 치면 점수가 알아서 올라가요.`);
    else foot.push('닉네임을 정하면 끝까지 친 점수가 알아서 랭킹에 올라가요. <button class="link" data-action="rank-join">닉네임 정하기</button>');
    $('#rank-foot').innerHTML = foot.join(' ');
  } catch {
    list.innerHTML = '<div class="rank-empty">랭킹을 불러오지 못했어요.</div>';
  }
}

/** 총 등수: 1·2·3등 시상대 + 4등부터 목록 */
function totalRankHtml(data) {
  const n = data.levels || LEVELS.length;
  const MEDAL = ['🥇', '🥈', '🥉'];
  const top = data.entries.slice(0, 3);
  // 시상대는 2등-1등-3등 순서로 늘어놓기
  const order = [1, 0, 2].filter((i) => top[i]);
  const podium = order
    .map((i) => {
      const e = top[i];
      return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal">${MEDAL[i]}</span>
        <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
        <span class="pl">${e.levels}/${n}단계</span><span class="step">${i + 1}등</span></div>`;
    })
    .join('');
  const rest = data.entries
    .slice(3, 50)
    .map(
      (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
        <span class="s">${fmt(e.score)}</span><span class="g small">${e.levels}/${n}</span></div>`
    )
    .join('');
  return `<div class="podium">${podium}</div>${rest}`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------- 설정 / 보정 ----------------
function openSettings() {
  const s = state.settings;
  $('#set-music').value = s.music;
  $('#set-sfx').value = s.sfx;
  $('#set-offset').value = s.offsetMs;
  $('#set-vibrate').checked = !!s.vibrate;
  $('#set-lite').checked = !!s.lite;
  $$('#set-band button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.band === (s.band || 'orch')));
  updateSettingLabels();
  $('#settings-account').innerHTML = state.me.guest
    ? `랭킹 닉네임: <b>${escapeHtml(state.me.player?.username)}</b> · <button class="link" data-action="logout">닉네임 지우기</button>`
    : `랭킹은 팔로워 인증을 받은 사람만 올라가요 · <button class="link" data-action="rank-join">팔로워 인증 받기</button>`;
  openModal('modal-settings');
}
function updateSettingLabels() {
  const s = state.settings;
  $('#set-offset-val').textContent = s.offsetMs === 0 ? '0ms' : `${s.offsetMs > 0 ? '+' : ''}${s.offsetMs}ms`;
}
/** 저사양 모드 적용: 게임 그림(해상도·효과) + 화면 꾸밈(애니메이션·그림자) */
function applyLite() {
  const on = !!state.settings.lite;
  // 저사양 모드를 직접 껐으면 자동 화질도 처음(최고)부터 다시
  if (!on && renderer.lite) {
    renderer.quality = 2;
    save('gfxQ', 2);
  }
  renderer.lite = on;
  document.documentElement.classList.toggle('lite', on);
  if ($('#screen-game').classList.contains('active')) renderer.resize();
}
function bindSettings() {
  const upd = () => {
    const s = state.settings;
    s.music = Number($('#set-music').value);
    s.sfx = Number($('#set-sfx').value);
    s.offsetMs = Number($('#set-offset').value);
    s.vibrate = $('#set-vibrate').checked;
    s.lite = $('#set-lite').checked;
    applyLite();
    audio.setVolumes({ music: s.music, sfx: s.sfx });
    saveSettings(s);
    updateSettingLabels();
  };
  ['#set-music', '#set-sfx', '#set-offset', '#set-vibrate', '#set-lite'].forEach((id) => $(id).addEventListener('input', upd));
  $('#set-band').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-band]');
    if (!b) return;
    state.settings.band = b.dataset.band;
    saveSettings(state.settings);
    audio.orchOn = b.dataset.band !== 'piano';
    $$('#set-band button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    await audio.unlock();
    if (audio.orchOn) audio.loadOrch().then((ok) => ok && audio.fanfare());
    else audio.fanfare();
  });
  $('#set-sfx').addEventListener('change', async () => {
    await audio.unlock();
    audio.snare();
  });
}

const calib = { taps: [], clicks: [], active: false, required: false, after: null, fails: 0 };

/** 박자 보정을 한 번도 안 했고 직접 맞춘 값도 없으면 필수 (이번 접속에서 '나중에'를 눌렀으면 넘어감) */
function needsCalibration() {
  if (state.studio.active || state.auto || state.calibSkipped) return false;
  return !load('calibrated', false) && !state.settings.offsetMs;
}

/** 보정 창 열기. required 면 닫을 수 없고, 성공하면 after() 로 이어서 시작 */
function openCalibration({ required = false, after = null } = {}) {
  Object.assign(calib, { required, after, fails: 0, active: false });
  $('#calib-title').textContent = required ? '처음 한 번! 박자 맞추기' : '싱크 보정';
  $('#calib-desc').innerHTML = required
    ? '폰·이어폰마다 소리가 조금씩 늦게 들려요. <b>똑 소리(또는 반짝임)에 맞춰</b> 아래 드럼을 <b>8번</b> 탭하면 내 폰에 딱 맞게 보정돼요. 10초면 끝!'
    : '"똑" 소리에 맞춰 아래 드럼을 탭하세요. (8번)';
  $('#calib-count').textContent = '준비';
  $('#calib-result').textContent = '';
  $('#calib-close').hidden = required;
  $('#calib-skip').hidden = true;
  $('#calib-done').hidden = true;
  $('#calib-start').textContent = '시작';
  $('#calib-start').classList.add('btn-primary');
  $('#calib-start').classList.remove('btn-ghost');
  openModal('modal-calibrate');
}
async function startCalibration() {
  if (calib.active) return; // 측정 중에 또 누르면 무시
  await audio.unlock();
  $('#calib-done').hidden = true;
  $('#calib-skip').hidden = true;
  calib.taps = [];
  calib.active = true;
  const clicks = playMetronome(audio, 100, 12);
  calib.clicks = clicks;
  $('#calib-result').textContent = '';
  const pad = $('#calib-pad');
  clicks.forEach((t, i) => {
    const ms = (t - audio.ctx.currentTime) * 1000;
    setTimeout(() => {
      $('#calib-count').textContent = i < 4 ? `준비 ${4 - i}` : String(i - 3);
      pad.classList.add('beat');
      setTimeout(() => pad.classList.remove('beat'), 90);
    }, ms);
  });
  const endMs = (clicks[clicks.length - 1] - audio.ctx.currentTime) * 1000 + 600;
  setTimeout(finishCalibration, endMs);
}
function finishCalibration() {
  calib.active = false;
  const diffs = [];
  for (const t of calib.taps) {
    let best = null;
    for (const c of calib.clicks.slice(4)) if (best === null || Math.abs(t - c) < Math.abs(t - best)) best = c;
    if (best !== null && Math.abs(t - best) < 0.3) diffs.push(t - best);
  }
  $('#calib-count').textContent = '끝!';
  if (diffs.length < 4) {
    $('#calib-result').textContent = '탭이 너무 적어요. 소리(또는 반짝임)에 맞춰 8번 눌러 주세요!';
    $('#calib-start').textContent = '다시 하기';
    // 계속 안 되는 폰(소리 꺼짐·터치 문제)이 갇히지 않게, 3번 실패하면 이번 접속만 건너뛸 수 있음
    if (++calib.fails >= 3 && calib.required) $('#calib-skip').hidden = false;
    // 이미 한 번 성공해서 저장된 값이 있으면 그 값으로 시작할 수도 있음
    if (calib.required && load('calibrated', false)) $('#calib-done').hidden = false;
    return;
  }
  diffs.sort((a, b) => a - b);
  const med = diffs[Math.floor(diffs.length / 2)];
  const ms = Math.max(-200, Math.min(200, Math.round((med * 1000) / 5) * 5));
  state.settings.offsetMs = ms;
  saveSettings(state.settings);
  save('calibrated', true);
  $('#set-offset').value = ms;
  updateSettingLabels();
  $('#calib-result').textContent = `보정값 ${ms > 0 ? '+' : ''}${ms}ms 저장했어요. 잘못 쳤다면 다시 할 수 있어요!`;
  // 결과를 보고 다시 할 수 있게: '다시 하기'는 보조 버튼으로, 필수 보정이면 '이 값으로 시작하기'로 이어감
  $('#calib-start').textContent = '다시 하기';
  $('#calib-start').classList.remove('btn-primary');
  $('#calib-start').classList.add('btn-ghost');
  if (calib.required) $('#calib-done').hidden = false;
}

// ---------------- 영상 찍기 ----------------
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return null;
}
const canRecordFile = () => !!pickMime() && !!HTMLCanvasElement.prototype.captureStream;

// 레벨업 챌린지(릴스처럼 Lv.1 → Lv.N 점점 빨라짐)를 고르면 문구도 거기에 맞게
const STUDIO_TEXT = {
  level: { top: '엄지 두 개로 따라 쳐봐!', bottom: '프로필 링크에서 바로 해보기' },
  challenge: (n) => ({ top: '엄지로 드럼 쳐보세요', bottom: `Lv.${n}까지 오면 드러머 재능 있음` }),
};
const STUDIO_CHALLENGES = [4, 7];
function studioDefaults(id) {
  return isChallengeId(id) ? STUDIO_TEXT.challenge(Number(String(id).slice(2))) : STUDIO_TEXT.level;
}
function pickStudioLevel(id) {
  const st = state.studio;
  const top = $('#studio-top');
  const bottom = $('#studio-bottom');
  // 기본 문구 그대로였으면 새 기본 문구로 바꿔 줌 (직접 쓴 문구는 그대로)
  const all = [STUDIO_TEXT.level, ...STUDIO_CHALLENGES.map(STUDIO_TEXT.challenge)];
  const after = studioDefaults(id);
  if (!top.value.trim() || all.some((d) => d.top === top.value.trim())) top.value = after.top;
  if (!bottom.value.trim() || all.some((d) => d.bottom === bottom.value.trim())) bottom.value = after.bottom;
  st.level = id;
}

/** 영상 화면에 그릴 문구 */
function studioOverlay(lv) {
  const st = state.studio;
  return {
    top: st.top,
    bottom: st.bottom,
    challenge: !!lv.challenge,
    label: lv.challenge ? '레벨업 챌린지' : lv.studioOnly ? `${lv.composer} ${lv.name}` : `${lv.id}단계 · ${lv.composer} ${lv.name}`,
  };
}

function openStudio() {
  if (state.game) state.game.stop();
  const st = state.studio;
  st.active = false;
  $('#screen-game').classList.remove('studio-mode');
  $('#studio-levels').innerHTML =
    STUDIO_CHALLENGES.map(
      (n) => `<button class="chip-hot" data-studio-level="ch${n}" aria-pressed="${st.level === 'ch' + n}">🔥 레벨업 챌린지 Lv.1→${n}</button>`
    ).join('') +
    STUDIO_LEVELS.map((l) => `<button class="chip-hot" data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">🎬 릴스용 · ${l.name} (느리게)</button>`).join('') +
    LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${l.id}. ${l.name}</button>`).join('');
  $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === st.mode));
  $('#studio-top').value = st.top;
  $('#studio-bottom').value = st.bottom;
  const ok = canRecordFile();
  $('#studio-file').disabled = !ok;
  $('#studio-file').checked = ok && st.file;
  $('#studio-file-hint').textContent = ok
    ? '켜면 이 화면이 그대로 소리까지 영상 파일로 저장돼요. 끄면 폰 화면 녹화로 찍으면 돼요.'
    : '이 브라우저는 바로 저장이 안 돼요. 폰 화면 녹화(제어센터)로 찍어주세요.';
  closeModal('modal-studio-done');
  show('screen-studio');
}

/** 🖼 릴스 썸네일: 고른 곡·위(훅)·아래 문구 그대로 1080×1920 표지 */
async function studioCover() {
  const st = state.studio;
  const lv = playable(st.level);
  if (!lv) return;
  const top = $('#studio-top').value.trim() || '엄지 두 개로 따라 쳐봐!';
  const bottom = $('#studio-bottom').value.trim();
  toast('썸네일 만드는 중…', 1500);
  try {
    const sub = lv.challenge ? `${lv.composer} ${lv.songName} · 레벨업 챌린지` : `${lv.composer} ${lv.name}`;
    await fontsReady(top + sub + bottom);
    const canvas = await makeReelCover({ lv, title: top, sub, bottom });
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], `okaystra-cover-${lv.id}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    $('#share-title').textContent = '릴스 썸네일';
    $('#share-hint').textContent = '이미지를 길게 눌러 저장하고, 릴스 올릴 때 커버로 고르세요!';
    $('#share-img').src = canvas.toDataURL('image/png');
    openModal('modal-share');
  } catch (e) {
    console.error(e);
    toast('썸네일을 만들지 못했어요. 다시 해 주세요');
  }
}

async function studioStart() {
  const st = state.studio;
  st.top = $('#studio-top').value.trim();
  st.bottom = $('#studio-bottom').value.trim();
  st.file = $('#studio-file').checked;
  save('studio', { level: st.level, mode: st.mode, top: st.top, bottom: st.bottom, file: st.file });
  closeModal('modal-studio-done');
  await audio.unlock();
  st.active = true;
  state.auto = st.mode === 'auto';
  // 9:16 화면을 먼저 깔고 카운트다운
  show('screen-game');
  $('#screen-game').classList.add('studio-mode');
  const lv = playable(st.level) || getLevel(1);
  renderer.studio = studioOverlay(lv);
  setKit(lv);
  await fontsReady(`${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}`);
  await new Promise((r) => requestAnimationFrame(r));
  await renderer.resize(Math.min(3, Math.max(2, 1080 / ($('#game-canvas').clientWidth || 390))));
  renderer.draw({ now: -1, notes: [], approach: 1.5, beatDur: 60 / lv.bpm, combo: 0, score: 0, playing: false }, performance.now() / 1000);
  const box = $('#studio-count');
  box.hidden = false;
  $('#studio-count-msg').textContent = st.file ? '녹화 준비 중… 화면 그대로 영상으로 저장돼요' : '폰 화면 녹화 켜셨나요? 곧 시작해요';
  for (const n of ['3', '2', '1']) {
    $('#studio-count-num').textContent = n;
    await new Promise((r) => setTimeout(r, 800));
    if (!st.active) {
      box.hidden = true;
      return;
    }
  }
  box.hidden = true;
  if (st.file) startRecorder();
  await startLevel(st.level);
}

function startRecorder() {
  const st = state.studio;
  try {
    const mime = pickMime();
    const v = $('#game-canvas').captureStream(60);
    const a = audio.captureStream();
    const stream = new MediaStream([...v.getVideoTracks(), ...a.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    st.chunks = [];
    st.mime = mime;
    rec.ondataavailable = (e) => e.data && e.data.size && st.chunks.push(e.data);
    rec.start(250);
    st.recorder = rec;
  } catch (e) {
    st.recorder = null;
    toast('영상 저장을 시작하지 못했어요. 화면 녹화로 찍어주세요.');
  }
}

function stopRecorder() {
  const st = state.studio;
  const rec = st.recorder;
  st.recorder = null;
  if (!rec || rec.state === 'inactive') return Promise.resolve(null);
  return new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(st.chunks, { type: (st.mime || 'video/webm').split(';')[0] }));
    rec.stop();
  });
}

async function studioFinish(res) {
  const st = state.studio;
  // 마지막 장면(환호하는 마스코트)을 잠깐 더 담기
  const g = state.game;
  const t0 = performance.now();
  await new Promise((resolve) => {
    (function hold() {
      const rt = performance.now() / 1000;
      renderer.draw(
        {
          now: g.endTime,
          notes: [],
          approach: g.approach,
          beatDur: g.beat,
          combo: g.combo,
          score: res.score,
          playing: false,
          finished: true,
          round: g.roundInfo || null,
          cleared: res.challenge ? res.roundsCleared : 0,
        },
        rt
      );
      if (performance.now() - t0 < (res.challenge ? 2400 : 1500)) requestAnimationFrame(hold);
      else resolve();
    })();
  });
  const blob = await stopRecorder();
  st.active = false;
  state.auto = false;
  const video = $('#studio-video');
  if (st.blobUrl) URL.revokeObjectURL(st.blobUrl);
  st.blob = blob;
  if (blob && blob.size) {
    st.blobUrl = URL.createObjectURL(blob);
    video.src = st.blobUrl;
    video.onloadedmetadata = () => {
      try {
        video.currentTime = 0.1;
      } catch {}
    };
    video.hidden = false;
    $('#btn-studio-save').hidden = false;
    $('#studio-done-msg').textContent = '영상이 만들어졌어요. 저장해서 릴스에 올려보세요!';
  } else {
    video.hidden = true;
    $('#btn-studio-save').hidden = true;
    $('#studio-done-msg').textContent = '화면 녹화를 멈추고 사진 앱에서 확인하세요. 위아래를 9:16으로 잘라 쓰면 딱 맞아요.';
  }
  if (!res.auto && !res.challenge) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `okaystra-${isChallengeId(st.level) ? 'challenge' : st.level + '단계'}.${ext}`, { type: st.blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = st.blobUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (ext === 'webm') toast('webm 파일이에요. 인스타에 안 올라가면 mp4로 변환해 주세요', 3500);
}

async function studioStop() {
  const st = state.studio;
  st.active = false;
  $('#studio-count').hidden = true;
  if (state.game) state.game.stop();
  await stopRecorder();
  state.auto = false;
  $('#screen-game').classList.remove('studio-mode');
  renderer.studio = null;
  openStudio();
}

// ---------------- 이벤트 연결 ----------------
// ---------------- 친구 대결 방 ----------------
const roomUi = { newMode: 'versus', round: 0 };
function roomOtherName() {
  const o = state.roomClient && state.roomClient.other;
  return o ? o.name : '친구';
}
function myRoomName() {
  return load('roomName', '') || (state.me && state.me.player && state.me.player.username) || '';
}
function roomErrText(e) {
  const k = (e && (e.data && e.data.error)) || (e && e.message) || '';
  return (
    {
      rate_limited: '잠시 뒤 다시 해 주세요',
      no_server: '지금은 서버에 연결할 수 없어요',
      room_gone: '그런 방이 없어요. 코드를 확인해 주세요',
      room_full: '방이 꽉 찼어요 (두 명까지)',
      room_busy: '지금 치는 중인 방이에요. 끝나면 들어와 주세요',
      bad_name: '이름은 1~12자, 글자·숫자만 써 주세요',
      bad_code: '코드 4자리를 적어 주세요',
      confirm_required: `이 곡은 팔로워 인증을 받아야 칠 수 있어요 (1~${FREE_UPTO}단계는 누구나)`,
      confirm_pending: `이 곡은 팔로워 인증을 받아야 칠 수 있어요 (1~${FREE_UPTO}단계는 누구나)`,
    }[k] || '연결이 불안정해요. 잠시 뒤 다시 해 주세요'
  );
}
/** 멀티 창에서 보일 칸: entry(처음) · wait(빠른 대결 상대 찾는 중) · lobby(대기실) */
function roomPanel(which) {
  $('#room-entry').hidden = which !== 'entry';
  $('#room-wait').hidden = which !== 'wait';
  $('#room-lobby').hidden = which !== 'lobby';
}
/** 멀티·건의하기 잠금: 팔로워 인증 안 했으면 true (개발용 ?gate=open 이면 풀림) */
function followGated() {
  return state.cfg.gateMode !== 'open' && !isConfirmed();
}
function openRoom(code) {
  if (followGated()) {
    openVerify(null, { label: '⚔️ 멀티 플레이 (빠른 대결 · 친구 방)는 팔로워만', then: () => openRoom(code) });
    return;
  }
  const c = state.roomClient;
  roomPanel(!c.active ? 'entry' : c.waiting ? 'wait' : 'lobby');
  if (!c.active) {
    $('#room-name').value = myRoomName();
    if (code) $('#room-code').value = code;
    $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === roomUi.newMode)));
  } else renderRoom(c.room);
  openModal('modal-room');
}
function renderRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  // 둘 다 준비 → 새 판 시작 (서버가 정한 시각에)
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      startLevel(room.level, { room: { startAt, mode: room.mode, round: room.round } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
  // 빠른 대결: 아직 상대가 없으면 '찾는 중' 화면
  if (c.waiting) {
    roomPanel('wait');
    return;
  }
  stopWaitTimer();
  roomPanel('lobby');
  const pub = !!room.pub;
  $('#room-code-show').textContent = room.code;
  // 빠른 대결 방은 코드·모드·곡 고르기 없음 (곡은 무작위)
  $('#room-code-box').hidden = pub;
  $('#room-mode').hidden = pub;
  $('#room-level').closest('.field').hidden = pub;
  const lk = $('#room-link');
  lk.hidden = !c.other;
  lk.classList.toggle('on', c.realtime);
  lk.textContent = c.realtime ? '⚡ 실시간 연결됨 — 점수가 바로바로 보여요' : '🔄 실시간 연결 중… (안 되면 조금 늦게 보여요)';
  const host = c.isHost;
  $$('#room-mode [data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === room.mode));
    b.disabled = !host && b.dataset.mode !== room.mode;
  });
  const sel = $('#room-level');
  const opts = LEVELS.map((lv) => {
    const ok = lv.id <= FREE_UPTO || isConfirmed();
    return `<option value="${lv.id}"${ok ? '' : ' disabled'}>${lv.id}단계 · ${lv.name}${ok ? '' : ' 🔒'}</option>`;
  }).join('');
  if (sel.dataset.sig !== opts) {
    sel.innerHTML = opts;
    sel.dataset.sig = opts;
  }
  if (document.activeElement !== sel) sel.value = String(room.level);
  sel.disabled = !host;
  $('#room-level-note').textContent = host ? '(방장이 골라요)' : '(방장이 고른 곡)';
  const me = c.me;
  const other = c.other;
  $('#room-players').innerHTML = ['a', 'b']
    .map((s) => {
      const p = room.players[s];
      if (!p) return `<div class="room-player empty"><b>빈 자리</b><small>친구를 기다려요…</small></div>`;
      const mine = s === c.slot;
      const lost = !mine && p.ago > 15000;
      const lastRes = p.final ? `<span class="last">지난 판 ${fmt(p.final.score)}점</span>` : '';
      return `<div class="room-player ${mine ? 'me' : ''}"><b>${escapeHtml(p.name)}${mine ? ' (나)' : ''}</b>
        <small>${s === room.host ? '👑 방장 · ' : ''}${p.part === 'piano' ? '🎹 피아노' : '🥁 드럼'}</small><br>
        <span class="rdy ${p.ready ? 'on' : ''}">${lost ? '연결 끊김?' : p.ready ? '준비 완료' : '준비 전'}</span>${lastRes}</div>`;
    })
    .join('');
  $('#room-ready').textContent = me && me.ready ? '준비 취소' : '준비!';
  $('#room-hint').textContent = !other
    ? `친구에게 코드 ${room.code} 를 알려 주세요. 들어오면 같이 '준비!'`
    : me && me.ready && !other.ready
      ? `${other.name} 님이 준비하면 바로 시작해요`
      : !(me && me.ready) && other.ready
        ? `${other.name} 님은 준비 완료! '준비!'를 누르면 시작해요`
        : room.mode === 'team'
          ? '팀전: 둘의 점수를 합쳐요. 피아노 파트는 곧 나와요!'
          : '개인전: 같은 곡을 동시에 치고 점수로 승부!';
}
async function roomCreate() {
  const name = $('#room-name').value.trim();
  if (!name) return toast('이름을 적어 주세요');
  save('roomName', name);
  try {
    roomUi.round = 0;
    await state.roomClient.create(name, roomUi.newMode, 1);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
async function roomJoin() {
  const name = $('#room-name').value.trim();
  const code = $('#room-code').value.replace(/\D/g, '');
  if (!name) return toast('이름을 적어 주세요');
  if (code.length !== 4) return toast('코드 4자리를 적어 주세요');
  save('roomName', name);
  try {
    roomUi.round = 0;
    await state.roomClient.join(code, name);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
async function roomReady() {
  const c = state.roomClient;
  if (!c.active) return;
  const want = !(c.me && c.me.ready);
  if (want && needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => openRoom() });
    return;
  }
  // 소리는 사용자가 누를 때만 켤 수 있어서 '준비' 때 미리 켜 둠 (시작은 타이머로)
  if (want) await audio.unlock();
  c.send({ ready: want }, true);
}
async function roomShare() {
  const c = state.roomClient;
  if (!c.active) return;
  const url = `${location.origin}/?room=${c.code}`;
  const text = `🥁 오케이스트라 대결 방에 들어와! 코드 ${c.code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '오케이스트라 대결', text, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('링크를 복사했어요! 친구에게 보내 주세요');
  } catch {
    toast(`코드 ${c.code} 를 친구에게 알려 주세요`, 3000);
  }
}
// ⚡ 빠른 대결: 같은 묶음 사람을 90초까지 기다림 (사람이 적을 수 있어서)
const QUICK_WAIT_MS = 90_000;
function stopWaitTimer() {
  clearInterval(roomUi.waitTimer);
  roomUi.waitTimer = null;
}
async function roomQuick(bracket) {
  const name = $('#room-name').value.trim() || myRoomName();
  if (!name) {
    roomPanel('entry');
    openModal('modal-room');
    return toast('이름을 적어 주세요');
  }
  if (followGated()) return openRoom();
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => roomQuick(bracket) });
    return;
  }
  save('roomName', name);
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  roomUi.bracket = bracket;
  try {
    const waiting = await state.roomClient.quick(name, bracket);
    // 바로 붙었으면 renderRoom 이 게임을 시작함 (창은 이미 닫힘)
    if (!waiting) return;
    openModal('modal-room');
    roomPanel('wait');
    const t0 = Date.now();
    const label = bracket === 'hard' ? '🔥 어려움·극악' : '🌱 쉬움·보통';
    const tick = () => {
      const c = state.roomClient;
      if (!c.active || !c.waiting) return stopWaitTimer();
      const sec = Math.floor((Date.now() - t0) / 1000);
      $('#room-wait-title').textContent = `${label} 상대 찾는 중… ${sec}초`;
      $('#room-wait-sub').textContent = sec < 30 ? '같은 묶음에 들어오는 사람과 바로 붙어요' : '지금은 사람이 적은가 봐요. 조금만 더 기다려 볼게요…';
      if (Date.now() - t0 > QUICK_WAIT_MS) {
        stopWaitTimer();
        c.leave();
        roomPanel('entry');
        toast('지금은 상대가 없어요 😢 친구를 부르거나 조금 뒤에 다시 해 보세요', 3600);
      }
    };
    stopWaitTimer();
    tick();
    roomUi.waitTimer = setInterval(tick, 1000);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
/** 결과 화면: 빠른 대결 새 상대 찾기 */
async function roomNext() {
  const bracket = (state.roomClient.room && state.roomClient.room.pub) || roomUi.bracket || 'easy';
  await state.roomClient.leave();
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  roomQuick(bracket);
}

async function roomLeave() {
  stopWaitTimer();
  await state.roomClient.leave();
  roomUi.round = 0;
  document.body.classList.remove('room-game');
  closeModal('modal-room');
  if ($('#screen-result').classList.contains('in-room')) {
    $('#screen-result').classList.remove('in-room');
    $('#res-room').hidden = true;
    refreshTitle();
    show('screen-title');
  }
  toast('방에서 나왔어요');
}
/** 결과 화면: 대결 방 결과 (상대가 끝날 때까지 2초마다 갱신) */
function renderRoomResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  const o = c.other;
  const mine = res.score;
  const theirs = o && o.final ? o.final.score : null;
  const team = res.room.mode === 'team';
  let head;
  if (!c.active) head = '<div class="room-word">방이 닫혔어요</div>';
  else if (!o) head = '<div class="room-word">친구가 나갔어요</div>';
  else if (theirs == null) head = `<div class="room-word">${escapeHtml(o.name)} 님 아직 치는 중… ${o.live ? Math.round((o.live.progress || 0) * 100) + '%' : ''}</div>`;
  else if (team) head = `<div class="room-word win">🤝 팀 점수 ${fmt(roomOutcome('team', mine, theirs).team)}</div>`;
  else {
    const r = roomOutcome('versus', mine, theirs).result;
    head = `<div class="room-word ${r}">${{ win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' }[r]}</div>`;
  }
  const other = o ? `${escapeHtml(o.name)}<b>${theirs == null ? (o.live ? fmt(o.live.score) : '-') : fmt(theirs)}</b>` : '-';
  box.innerHTML = `${head}
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>${team ? '+' : 'VS'}</span><span>${other}</span></div>
    <div class="room-acts"><button class="btn btn-primary" data-action="room-again">${c.room && c.room.pub ? '이 상대와 한 판 더' : '한 판 더'}</button>${c.room && c.room.pub ? '<button class="btn btn-hot" data-action="room-next">새 상대 찾기</button>' : ''}<button class="btn btn-ghost" data-action="room-leave">방 나가기</button></div>`;
}
async function roomAgain() {
  const c = state.roomClient;
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  if (c.active) await c.again();
  openRoom();
}

// ---------------- 업데이트 소식 · 건의하기 ----------------
function refreshNewsDot() {
  $('#news-dot').hidden = load('newsSeen', '') === LATEST_NEWS;
}
function openNews() {
  const seen = load('newsSeen', '');
  const seenIdx = NEWS.findIndex((n) => n.id === seen);
  $('#news-list').innerHTML = NEWS.map(
    (n, i) => `<article class="news-item ${seenIdx < 0 ? (i === 0 ? 'new' : '') : i < seenIdx ? 'new' : ''}">
      <h4>${n.title} <small>${n.date}</small>${(seenIdx < 0 ? i === 0 : i < seenIdx) ? '<em>NEW</em>' : ''}</h4>
      <ul>${n.items.map((t) => `<li>${t}</li>`).join('')}</ul></article>`
  ).join('');
  save('newsSeen', LATEST_NEWS);
  refreshNewsDot();
  openModal('modal-news');
}
const suggestState = { kind: 'song', sending: false };
function openSuggest() {
  if (followGated()) {
    openVerify(null, { label: '💬 건의하기는 팔로워만', then: openSuggest });
    return;
  }
  $('#suggest-text').value = load('suggestDraft', '');
  $('#suggest-count').textContent = `${[...$('#suggest-text').value].length} / 500`;
  openModal('modal-suggest');
  setTimeout(() => $('#suggest-text').focus(), 50);
}
async function sendSuggest() {
  const text = $('#suggest-text').value.trim();
  if ([...text].length < 2) {
    toast('내용을 조금만 더 적어 주세요');
    return;
  }
  if (suggestState.sending) return;
  suggestState.sending = true;
  $('#suggest-send').disabled = true;
  try {
    await state.api.suggest(suggestState.kind, text);
    save('suggestDraft', '');
    $('#suggest-text').value = '';
    closeModal('modal-suggest');
    toast('고마워요! 건의가 잘 전달됐어요 💌', 2600);
  } catch (e) {
    toast(e.status === 429 ? '조금 있다가 다시 보내 주세요 (1시간에 5개까지)' : '보내지 못했어요. 잠시 뒤 다시 해 주세요', 2800);
  } finally {
    suggestState.sending = false;
    $('#suggest-send').disabled = false;
  }
}

const ACTIONS = {
  'room-open': () => openRoom(),
  'room-close': () => closeModal('modal-room'),
  'room-create': roomCreate,
  'room-join': roomJoin,
  'room-ready': roomReady,
  'room-share': roomShare,
  'room-leave': roomLeave,
  'room-quick': () => {},
  'room-next': roomNext,
  'room-again': roomAgain,
  'news-open': openNews,
  'close-news': () => closeModal('modal-news'),
  'suggest-open': openSuggest,
  'close-suggest': () => closeModal('modal-suggest'),
  'suggest-send': sendSuggest,
  quickstart: () => tryStart(state.quickId ?? 1),
  'continue-ad': continueWithAd,
  'give-up': giveUp,
  levels: () => {
    if (state.game) state.game.stop();
    state.studio.active = false;
    $('#screen-game').classList.remove('studio-mode');
    renderer.studio = null;
    renderLevels();
    show('screen-levels');
  },
  home: () => {
    refreshTitle();
    show('screen-title');
  },
  today: () => tryStart(todayLevel().id, { free: true }),
  'send-vs': sendChallenge,
  'close-vs': () => {
    state.vsIncoming = null;
    closeModal('modal-vs');
  },
  'accept-vs': () => {
    const ch = state.vsIncoming;
    closeModal('modal-vs');
    if (!ch) return;
    state.vs = ch;
    state.vsIncoming = null;
    tryStart(ch.levelId, { free: true });
  },
  'close-nick': () => closeModal('modal-nick'),
  'save-nick': () => {
    const nick = cleanName($('#nick-input').value);
    if (!nick) {
      toast('이름을 한 글자 이상 써 주세요');
      return;
    }
    save('nick', nick);
    closeModal('modal-nick');
    shareChallenge(nick);
  },
  'tune-sync': () => {
    const b = $('.res-tune');
    if (!b) return;
    state.settings.offsetMs = clampOffset(Number(b.dataset.offset));
    saveSettings(state.settings);
    save('calibrated', true);
    b.remove();
    toast(`박자 보정 ${state.settings.offsetMs > 0 ? '+' : ''}${state.settings.offsetMs}ms 저장! 다시 해 보세요`, 2800);
  },
  ranking: () => {
    openRank('total');
  },
  settings: openSettings,
  pause: togglePause,
  resume: resumeGame,
  retry: () => {
    closeModal('modal-pause');
    closeModal('modal-continue');
    startLevel(state.levelId);
  },
  quit: () => {
    closeModal('modal-pause');
    // 대결 방 판을 중간에 나가면 지금 점수로 끝낸 걸로 알림
    if (document.body.classList.contains('room-game') && state.roomClient.active && state.game)
      state.roomClient.send({ final: { score: state.game.score, stars: 0, grade: 'F', failed: true, maxCombo: state.game.maxCombo, accuracy: 0 } }, true);
    document.body.classList.remove('room-game');
    if (state.game) state.game.stop();
    renderLevels();
    show('screen-levels');
  },
  next: () => (typeof state.levelId === 'number' && nextOpenId(state.levelId) ? tryStart(nextOpenId(state.levelId)) : tryStart(ENDLESS_ID)),
  'submit-rank': () => {
    const id = state.lastResult && state.lastResult.levelId;
    openRank(id === ENDLESS_ID || typeof id === 'number' ? id : 1);
  },
  'close-join': () => closeModal('modal-join'),
  'rank-join': () => {
    closeModal('modal-rank');
    closeModal('modal-settings');
    askNickname(true);
  },
  'verify-open': () => openVerify(null),
  'verify-join': () => {
    closeModal('modal-verify');
    askNickname(true);
  },
  'close-verify': () => {
    state.verifyFor = null;
    closeModal('modal-verify');
  },
  share: shareResult,
  'close-rank': () => closeModal('modal-rank'),
  'close-settings': () => closeModal('modal-settings'),
  'close-share': () => closeModal('modal-share'),
  'studio-cover': () => {
    state.studio.top = $('#studio-top').value.trim();
    state.studio.bottom = $('#studio-bottom').value.trim();
    studioCover();
  },
  'close-calibrate': () => !calib.required && closeModal('modal-calibrate'),
  calibrate: () => openCalibration(),
  'calib-done': () => {
    const after = calib.after;
    Object.assign(calib, { required: false, after: null });
    closeModal('modal-calibrate');
    if (after) after();
  },
  'calib-skip': () => {
    state.calibSkipped = true;
    const after = calib.after;
    Object.assign(calib, { required: false, after: null });
    closeModal('modal-calibrate');
    if (after) after();
  },
  'calib-start': startCalibration,
  logout: async () => {
    try {
      await state.api.logout();
    } catch {}
    state.me = { verified: false };
    closeModal('modal-settings');
    renderLevels();
    refreshTitle();
    toast('닉네임을 지웠어요');
  },
  studio: openStudio,
  'studio-start': studioStart,
  'studio-stop': studioStop,
  'studio-again': studioStart,
  'studio-save': studioSave,
  'close-studio-done': () => {
    closeModal('modal-studio-done');
    $('#screen-game').classList.remove('studio-mode');
    renderer.studio = null;
    openStudio();
  },
  'dismiss-inapp': () => {
    $('#inapp-note').hidden = true;
    save('inappDismissed', true);
  },
};

function bindActions() {
  $('#verify-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitVerify();
  });
  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitJoin();
  });
  // 소리가 멈춰 있으면(iOS 는 터치가 있어야 다시 켜짐) 아무 데나 눌러도 다시 켬
  document.addEventListener(
    'pointerdown',
    () => {
      if (audio.ctx && audio.ctx.state !== 'running' && state.game && state.game.state === 'playing') {
        audio.ctx.resume().catch(() => {});
        audio.resetClock();
      }
    },
    { capture: true, passive: true }
  );
  document.addEventListener('click', (e) => {
    const qb = e.target.closest('[data-action="room-quick"]');
    if (qb) {
      roomQuick(qb.dataset.bracket);
      return;
    }
    const newMode = e.target.closest('#room-mode-new [data-mode]');
    if (newMode) {
      roomUi.newMode = newMode.dataset.mode;
      $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === newMode)));
      return;
    }
    const roomMode = e.target.closest('#room-mode [data-mode]');
    if (roomMode) {
      if (state.roomClient.isHost) state.roomClient.send({ mode: roomMode.dataset.mode }, true);
      return;
    }
    const kindBtn = e.target.closest('#suggest-kind [data-kind]');
    if (kindBtn) {
      suggestState.kind = kindBtn.dataset.kind;
      $('#suggest-note').hidden = suggestState.kind !== 'song';
      document.querySelectorAll('#suggest-kind [data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b === kindBtn)));
      return;
    }
    const modeBtn = e.target.closest('#level-mode [data-mode]');
    if (modeBtn) {
      save('levelMode', modeBtn.dataset.mode);
      renderLevels();
      return;
    }
    const lvBtn = e.target.closest('[data-level]');
    if (lvBtn) {
      const v = lvBtn.dataset.level;
      tryStart(/^\d+$/.test(v) ? Number(v) : v);
      return;
    }
    const sl = e.target.closest('[data-studio-level]');
    if (sl) {
      const v = sl.dataset.studioLevel;
      pickStudioLevel(/^\d+$/.test(v) ? Number(v) : v);
      $$('#studio-levels button').forEach((b) => b.setAttribute('aria-pressed', b === sl));
      return;
    }
    const sm = e.target.closest('#studio-mode [data-mode]');
    if (sm) {
      state.studio.mode = sm.dataset.mode;
      $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b === sm));
      return;
    }
    const rm = e.target.closest('[data-rank-mode]');
    if (rm) {
      const want = rm.dataset.rankMode === 'endless';
      if (want !== isEndlessRank(state.rankLevel)) {
        state.rankLevel = want ? ENDLESS_ID : 'total';
        renderRankTabs();
        loadRank();
      }
      return;
    }
    const tab = e.target.closest('[data-rank]');
    if (tab) {
      state.rankLevel = /^\d+$/.test(tab.dataset.rank) ? Number(tab.dataset.rank) : tab.dataset.rank;
      $$('#rank-tabs button').forEach((b) => b.setAttribute('aria-selected', b === tab));
      loadRank();
      return;
    }
    const a = e.target.closest('[data-action]');
    if (a && ACTIONS[a.dataset.action]) {
      e.preventDefault();
      // 이어하기 창이 막 뜬 직후에는 버튼 입력 무시 (이미 누르고 있던 손가락이 버튼을 치는 것 방지)
      if (a.closest('#modal-continue') && performance.now() - contOpenedAt < CONT_GUARD_MS) return;
      ACTIONS[a.dataset.action]();
    }
  });
  // 모달 바깥 탭 → 닫기 (일시정지 모달 제외)
  $$('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target !== m || m.id === 'modal-pause' || m.id === 'modal-continue' || m.id === 'modal-ad' || (m.id === 'modal-calibrate' && calib.required)) return;
      m.hidden = true;
    })
  );
  // 결과 연출 중 화면을 누르면 바로 끝까지
  $('#screen-result').addEventListener('pointerdown', () => resultAnim.finish && resultAnim.finish());
  $('#calib-pad').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!audio.ctx) return;
    audio.kick(undefined, 0.6);
    if (calib.active) calib.taps.push(audio.heardTime(e.timeStamp));
  });
  // 오디오는 첫 터치에서 깨움 (iOS / 인앱 브라우저)
  const wake = () => audio.unlock().then(() => audio.loadPiano()).then(() => audio.orchOn && audio.loadOrch());
  window.addEventListener('pointerdown', wake, { once: true, capture: true });
  window.addEventListener('keydown', wake, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        openModal('modal-pause');
      }
    } else {
    }
  });
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if ($('#screen-game').classList.contains('active')) renderer.resize();
    }, 120);
  });
}

// ---------------- 시작 ----------------
async function boot() {
  $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  Object.assign(state.studio, load('studio', {}), { active: false });
  buildTitle();
  bindActions();
  bindGameInput();
  bindSettings();
  applyLite();
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  audio.orchOn = state.settings.band !== 'piano';
  audio.prefetchPiano().then(() => audio.orchOn && audio.prefetchOrch());
  refreshToday();

  if (isInApp() && !load('inappDismissed', false)) $('#inapp-note').hidden = false;

  state.api = await createApi(CONFIG);
  state.roomClient = new RoomClient({
    api: state.api,
    onUpdate: renderRoom,
    onLink: () => renderRoom(state.roomClient.room),
    onError: (e) => toast(roomErrText(e), 3000),
    onGone: () => {
      toast('방이 닫혔어요', 2400);
      roomUi.round = 0;
      if (!$('#modal-room').hidden) openRoom();
      if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
    },
  });
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'instagramHandle', 'siteUrl']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
  } catch {}
  const g = devParam('gate');
  if (g === 'open' || g === 'soft') state.cfg.gateMode = g;
  initAds(state.cfg);
  initTracker({ enabled: state.api.mode === 'server' });
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  refreshNewsDot();
  $('#room-level').addEventListener('change', (e) => {
    if (state.roomClient.isHost) state.roomClient.send({ level: Number(e.target.value) }, true);
  });
  // 친구가 보낸 방 링크 (/?room=1234)
  if (/^\d{4}$/.test(params.get('room') || '')) {
    const code = params.get('room');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('room');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    setTimeout(() => openRoom(code), 400);
  }
  $('#suggest-text').addEventListener('input', () => {
    const v = $('#suggest-text').value;
    $('#suggest-count').textContent = `${[...v].length} / 500`;
    save('suggestDraft', v);
  });
  renderLevels();
  // 운영자가 팔로우 확인이 안 돼서 랭킹에서 내린 사람: 들어오자마자 알림 (아이디를 다시 넣을 기회)
  if (state.me.hidden) setTimeout(() => askNickname(true), 600);
  // 앱으로 돌아올 때 인증 상태 다시 받기 (운영자가 '확인함'을 누르면 새로고침 없이 바로 열림)
  let meCheckedAt = Date.now();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || state.api.mode !== 'server') return;
    // 앱으로 자주 왔다 갔다 해도 2분에 한 번만 (Vercel 요청 수 아끼기)
    if (Date.now() - meCheckedAt < 120 * 1000) return;
    meCheckedAt = Date.now();
    try {
      const me = await state.api.me();
      if (!me || (me.confirmed === state.me.confirmed && me.checked === state.me.checked && !!me.hidden === !!state.me.hidden)) return;
      const nowConfirmed = me.confirmed && !state.me.confirmed;
      state.me = me;
      refreshTitle();
      renderLevels();
      if (nowConfirmed) toast(`✅ 팔로워 인증 완료! ${CONFIRM_WHAT()}가 열렸어요`, 3400);
    } catch {}
  });
  if (params.get('screen') === 'levels') show('screen-levels');
  // DM 속 링크(/?k=암호)로 들어옴 → 인증 창에 암호를 미리 채워서 염 (주소에선 지움)
  if (params.get('k')) {
    const k = params.get('k').slice(0, 40);
    try {
      const u = new URL(location.href);
      u.searchParams.delete('k');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (!isConfirmed()) setTimeout(() => openVerify(null, { pass: k }), 300);
  }
  // 친구가 보낸 1:1 도전장 링크로 들어옴
  if (params.get('vs')) {
    const ch = decodeChallenge(params.get('vs'));
    try {
      const u = new URL(location.href);
      u.searchParams.delete('vs');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (ch) openIncomingVs(ch);
    else toast('도전장 링크가 깨졌어요. 다시 받아 주세요!', 3000);
  }
  document.documentElement.dataset.api = state.api.mode;
  if (devParam('debug') === '1') window.__kk = { state, audio, renderer };
}

boot();

return {  };
})();
