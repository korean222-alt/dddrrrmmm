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
    tagline: '운영진은 포기했어요 · 미레미레미시레도 질주 · 하이햇 트릴 연타',
    difficulty: 5,
    bpm: 144,
    // 단계 카드: NEW 딱지(이 날까지, 한국 시간) · ☠ 게임에서 제일 어려운 곡 표시
    newUntil: '2026-11-28',
    extreme: true,
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
function tapBars(melody, kick = []) {
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

/** 🎹 두 손 피아노 — 오른손: 멜로디 음 아래 3~12반음 안에서 같이 누를 화음 음 (긴 음은 하나 더) */
function pianoHarmony(song, mb, s, midi, long = false) {
  const pcs = chordAt(song, mb, s).notes.map((m) => ((m % 12) + 12) % 12);
  const out = [];
  for (let m = midi - 3; m >= midi - 12 && m >= 50 && out.length < (long ? 2 : 1); m--) {
    if (pcs.includes(((m % 12) + 12) % 12) && (!out.length || out.at(-1) - m >= 3)) out.push(m);
  }
  return out;
}
/** 🎹 두 손 피아노 — 왼손: 8분음표마다 베이스 → 5도 → 옥타브 → 3도 (반 마디마다 되풀이). 8분 자리가 아니면 null */
function pianoLeftHand(song, mb, s) {
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

/**
 * 🍎 아이폰 터치 빠짐이 잘 나는 '빠른 번갈아' 콩 (2026-11-24, tasks/채보-만들때-주의.md):
 *   다른 엄지 콩이 ALT_GAP[0]~ALT_GAP[1]초 앞에 있는 콩 — 앞 엄지가 떨어지는 순간 이 엄지가 닿기 쉬움.
 *   이런 콩이 전체의 ALT_SHARE 넘는 곡 = '위험 곡' → 게임이 번갈아 콩도 봐줌 (game _altSave)
 */
const ALT_GAP = [0.04, 0.16];
const ALT_SHARE = 0.2;
/** 콩 n 바로 앞(ALT_GAP)에 다른 엄지 콩이 있나. notes 는 시각 순 */
function isQuickAlt(notes, i) {
  const n = notes[i];
  const hand = INSTRUMENTS[n.lane] && INSTRUMENTS[n.lane].hand;
  for (let j = i - 1; j >= 0 && n.time - notes[j].time < ALT_GAP[1]; j--) {
    const m = notes[j];
    if (n.time - m.time > ALT_GAP[0] && INSTRUMENTS[m.lane] && INSTRUMENTS[m.lane].hand !== hand) return true;
  }
  return false;
}
/** 빠른 번갈아 콩 비율 (0~1) */
function quickAltShare(notes) {
  const ns = [...notes].sort((a, b) => a.time - b.time);
  if (!ns.length) return 0;
  let k = 0;
  for (let i = 0; i < ns.length; i++) if (isQuickAlt(ns, i)) k++;
  return k / ns.length;
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
/** 본편 마지막 단계 (🎄 이벤트 곡은 본편 순서 밖). 총 등수는 1~이 단계까지만 합침 */
const LAST_LEVEL_ID = LEVELS.filter((l) => !l.xmas && !l.long).at(-1).id;
/** 본편 단계 (총 등수·무제한·빠른 대결) */
const MAIN_LEVELS = LEVELS.filter((l) => !l.xmas && !l.long);
/** 화면에 보일 단계 이름: '5단계' / 이벤트 곡은 '🎄 크리스마스 이벤트' */
function levelLabel(lv) {
  const l = typeof lv === 'object' && lv ? lv : getLevel(lv);
  if (l && l.xmas) return '🎄 크리스마스 이벤트';
  if (l && l.long) return '🎭 장거리';
  return `${l ? l.id : lv}단계`;
}

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
  // 🎄 캐롤 단계는 앞 단계를 안 깼어도 바로 (잠금은 isClosed: 팔로워 인증)
  if (getLevel(levelId)?.xmas || getLevel(levelId)?.long) return true;
  const prev = prevOpenId(levelId);
  if (prev === null || isClearBest(bests[prev])) return true;
  const lv = getLevel(levelId);
  return !!lv && MAIN_LEVELS.some((l) => l.difficulty === lv.difficulty && isClearBest(bests[l.id]));
}
/** 같은 난이도 단계들 */
const tierOf = (levelId) => {
  const lv = getLevel(levelId);
  return lv ? MAIN_LEVELS.filter((l) => l.difficulty === lv.difficulty).map((l) => l.id) : [];
};
/** 잠긴 단계 안내: 같은 난이도에 이미 열린 단계가 있으면 '그 난이도 하나만 깨면', 아니면 '앞 단계 깨면' */
function unlockHint(levelId, bests) {
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
function nextChallenge(bests) {
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
function roundBars(round, rand = Math.random, bpm = roundBpm(round)) {
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
function makeEndless({ rounds = Infinity, seed = (Math.random() * 2 ** 31) | 0, bpm = null } = {}) {
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
const BEAT_ID = 'beat';
const BEAT_MIN_BPM = 60;
const BEAT_MAX_BPM = 200;
const BEAT_MAX_ROUNDS = 6;
const BEAT_NAMES = ['기본 쿵짝', '8비트', '엇박 들어갑니다', '16분 쪼개기', '더블 킥', '필인 지옥'];
/** BPM·단계 수 정리 (이상한 값이면 기본값) */
function beatOpts(o = {}) {
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
const BEAT_STYLES = [
  { id: 'levelup', name: '레벨업', desc: '점점 어려워짐' },
  { id: 'steady', name: '비트', desc: '같은 난이도로 쭉' },
  { id: 'song', name: '노래 따라', desc: '노래 소리대로 (화면 녹화 필요)' },
];
const BEAT_DIFFS = [
  { id: 'easy', name: '쉬움', desc: '쿵·짝만' },
  { id: 'normal', name: '보통', desc: '하이햇 추가' },
  { id: 'hard', name: '어려움', desc: '크래시·탐탐·잘게' },
];
const beatStyleName = (style, diff) =>
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
function makeBeatReel(o = {}) {
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
function beatSeconds(o = {}) {
  const { bpm, rounds } = beatOpts(o);
  return ((COUNT_IN_BARS + rounds * ROUND_BARS) * 4 * 60) / bpm;
}

// ---------------------------------------------------------------
// 🎧 노래 맞히기 퀴즈 (영상 찍기 전용): 곡 제목을 숨기고 앞부분만 치다가 끝나면 정답 공개
//   id = 'q' + 단계 + 'x' + 마디 수 (0 = 끝까지). 예) 'q2x8' = 환희의 송가 앞 8마디. 기록·랭킹엔 안 들어감
// ---------------------------------------------------------------
const QUIZ_BARS = [8, 12, 0];
const quizId = (id, bars) => `q${id}x${bars}`;
const isQuizId = (id) => /^q\d+x\d+$/.test(String(id));
function makeQuizLevel(id) {
  const m = /^q(\d+)x(\d+)$/.exec(String(id));
  const base = m && getLevel(Number(m[1]));
  if (!base) return null;
  const n = Number(m[2]);
  const bars = n > 0 && n < base.bars.length ? base.bars.slice(0, n) : base.bars;
  return { ...base, id, baseId: base.id, quiz: true, bars, lanes: levelLanes(base) };
}
/** 퀴즈 영상 길이(초): 카운트인 + 본편 */
function quizSeconds(id) {
  const lv = makeQuizLevel(id);
  return lv ? Math.round(((COUNT_IN_BARS + lv.bars.length) * 4 * 60) / lv.bpm) : 0;
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

// ⚔️ 멀티 서바이벌: 곡을 원래 빠르기로 한 번 다 치고, 둘 다 살아 있으면 그때부터 4마디마다 빨라지며 끝없이.
//   먼저 목숨을 다 쓴 사람이 짐 (그 순간 판이 끝남). id = 'v' + 단계 번호 (예: 'v13'). 기록·랭킹엔 안 들어감
const levelSurvivalId = (id) => `v${id}`;
/** 'v13' → 13단계 레벨 (아니면 null) */
function levelSurvivalBase(id) {
  const m = /^v(\d+)$/.exec(String(id));
  return m ? getLevel(Number(m[1])) : null;
}

/**
 * 단계별 무제한 판. intro = true 면 첫 단계가 '곡 전체'(원래 빠르기), 그 뒤부터 4마디씩 빨라짐 (멀티 서바이벌)
 */
function makeLevelEndless(base, { intro = false } = {}) {
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

return { STEPS_PER_BAR, KICK, SNARE, HAT, CRASH, TOM, INSTRUMENTS, CHAR_LANES, isLeftThumb, COUNT_IN_BARS, OUTRO_BARS, JUDGE, POINTS, ACC_WEIGHT, STAR_RULES, DIFFICULTY_WORDS, LEVELS, tapBars, STUDIO_LEVELS, getStudioLevel, FREE_UPTO, VERIFY_LEVELS, needsVerify, CLOSED_LEVELS, SKIP_LEVELS, isClosed, prevOpenId, nextOpenId, noteToMidi, parseChord, chordAt, pianoHarmony, pianoLeftHand, parseMelody, getLevel, beatDur, stepDur, barDur, levelDuration, TempoMap, tempoOf, levelLanes, buildNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS, GOLD_SPOTS, buildRolls, markGoldNotes, noteCount, comboMultiplier, pointsFor, ALT_GAP, ALT_SHARE, isQuickAlt, quickAltShare, maxScore, accuracy, gradeFor, starsFor, scoreBounds, isClearBest, LAST_LEVEL_ID, MAIN_LEVELS, levelLabel, shiftOldLevelKey, ENDLESS_FROM, FREE_LEVELS, isUnlocked, tierOf, unlockHint, nextChallenge, ENDLESS_ID, ROUND_BARS, ENDLESS_BASE_BPM, ENDLESS_BPM_STEP, DIAMOND_RULES, diamondsFor, roundBpm, roundInfo, roundBars, makeEndless, BEAT_ID, BEAT_MIN_BPM, BEAT_MAX_BPM, BEAT_MAX_ROUNDS, beatOpts, BEAT_STYLES, BEAT_DIFFS, beatStyleName, makeBeatReel, beatSeconds, QUIZ_BARS, quizId, isQuizId, makeQuizLevel, quizSeconds, LEVEL_ENDLESS_STEP, levelEndlessId, levelEndlessBase, levelSurvivalId, levelSurvivalBase, makeLevelEndless };
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
function todayLevel(d = new Date(), canOpen = (id) => !isClosed(id)) {
  const day = Math.floor((d.getTime() + 9 * 3600000) / DAY_MS);
  // 이 폰에서 못 여는 단계(인증 전 4단계부터)는 오늘의 노래로 안 나옴
  const order = TODAY_ORDER.filter((id) => getLevel(id) && canOpen(id));
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

// ---- daily.js ----
const __m_daily = (() => {
// 🔥 오늘의 챌린지 (2026-11-22): 오늘의 노래 + 날마다 바뀌는 미션 하나 + 연속 성공 일수.
// 전부 폰에서 계산·저장 (서버 요청 없음). 날짜는 한국 시간 자정에 바뀜.

const { kstDateKey } = __m_versus;

const DAY_MS = 86400000;

/** 미션 종류. need(곡 콩 수) → 목표 숫자 */
const KINDS = [
  { k: 'combo', text: (n) => `콤보 ${n} 넘기기`, need: (total) => Math.max(20, Math.round((total * 0.5) / 10) * 10) },
  { k: 'acc', text: (n) => `정확도 ${n}% 넘기기`, need: () => 85 },
  { k: 'stars', text: () => '별 3개 받기', need: () => 3 },
  { k: 'perfect', text: (n) => `PERFECT ${n}개`, need: (total) => Math.max(10, Math.round((total * 0.6) / 10) * 10) },
  { k: 'miss', text: (n) => `MISS ${n}개 이하로 끝까지`, need: () => 3 },
  { k: 'fc', text: () => '풀콤보', need: () => 0 },
];

const dayNo = (d = new Date()) => Math.floor((d.getTime() + 9 * 3600000) / DAY_MS);

/** 오늘의 미션 { key, kind, target, text } (곡 콩 수에 맞춰 목표를 정함) */
function todayMission(total, d = new Date()) {
  const n = dayNo(d);
  // 같은 미션이 연달아 안 나오게 7 을 곱해 섞음
  const m = KINDS[(((n * 7) % KINDS.length) + KINDS.length) % KINDS.length];
  const target = m.need(total || 0);
  return { key: kstDateKey(d), kind: m.k, target, text: m.text(target) };
}

/** 이 판이 미션을 해냈나 (자동 연주·연습·실패 판은 안 됨) */
function missionDone(mission, res) {
  if (!mission || !res || res.auto || res.practice || res.failed || res.stopped) return false;
  const t = mission.target;
  switch (mission.kind) {
    case 'combo': return (res.maxCombo || 0) >= t;
    case 'acc': return (res.accuracy || 0) * 100 >= t;
    case 'stars': return (res.stars || 0) >= t;
    case 'perfect': return ((res.counts && res.counts.perfect) || 0) >= t;
    case 'miss': return !res.continued && ((res.counts && res.counts.miss) || 0) <= t;
    case 'fc': return !!res.fullCombo;
    default: return false;
  }
}

/** 어제 날짜 키 */
function prevKey(key) {
  return new Date(Date.parse(key + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);
}

/**
 * 저장된 기록 { last, streak, best } 을 오늘 기준으로 읽기.
 * 오늘이나 어제 성공했으면 연속이 이어지고, 그 전이면 0 으로 보여 줌.
 */
function streakView(rec, today = kstDateKey()) {
  const r = rec && typeof rec === 'object' ? rec : {};
  const doneToday = r.last === today;
  const alive = doneToday || r.last === prevKey(today);
  return { doneToday, streak: alive ? r.streak || 0 : 0, best: r.best || 0 };
}

/** 오늘 성공 기록하기 → 새 기록 (이미 오늘 했으면 그대로) */
function markDone(rec, today = kstDateKey()) {
  const r = rec && typeof rec === 'object' ? rec : {};
  if (r.last === today) return { rec: r, isNew: false };
  const streak = r.last === prevKey(today) ? (r.streak || 0) + 1 : 1;
  const next = { last: today, streak, best: Math.max(r.best || 0, streak) };
  return { rec: next, isNew: true };
}

return { todayMission, missionDone, streakView, markDone };
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

const { STEPS_PER_BAR, COUNT_IN_BARS, OUTRO_BARS, tempoOf, parseMelody, chordAt, levelLanes, CHAR_LANES, KICK, SNARE, HAT, CRASH, TOM, pianoHarmony, pianoLeftHand } = __m_charts;

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

  /** 🎤 녹음된 곡(노래 파일) 받아서 풀어 둠. 실패하면 null. 한 번 받으면 다시 안 받음 (새 소리 엔진에서도 그대로 씀) */
  loadTrack(src) {
    this._tracks ??= new Map();
    this._trackBufs ??= new Map();
    if (this._tracks.has(src)) return this._tracks.get(src);
    const ctx = this.ensure();
    const p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then(
        (ab) =>
          new Promise((res, rej) => {
            const q = ctx.decodeAudioData(ab, res, rej);
            if (q && q.then) q.then(res, rej);
          })
      )
      .then((buf) => {
        this._trackBufs.set(src, buf);
        return buf;
      })
      .catch(() => {
        this._tracks.delete(src);
        return null;
      });
    this._tracks.set(src, p);
    return p;
  }

  /**
   * 🔔 효과음 파일 (2026-11-22, ElevenLabs 로 만든 assets/sfx/*.mp3): combo 콤보 반짝 · cheer 풀콤보 환호 · buy 상점 구매 · gift 선물 받기
   *   처음 부를 때 받아 두고(loadTrack 캐시), 아직 못 받았으면 이번엔 조용히 넘어감. 효과음 볼륨(sfxBus)을 따름
   */
  sfxFile(name, vol = 1) {
    const src = `assets/sfx/${name.includes('.') ? name : name + '.mp3'}`;
    const ctx = this.ctx;
    const buf = this.trackBuffer(src);
    if (!buf) {
      const t0 = performance.now();
      // 아직 안 받았으면 받고 나서 바로 (1.5초 넘게 걸리면 이번엔 건너뜀)
      this.loadTrack(src).then((b) => b && performance.now() - t0 < 1500 && this.sfxFile(name, vol));
      return;
    }
    if (!ctx || !this.sfxBus || this.sfxBus.context !== ctx) return;
    try {
      const s = ctx.createBufferSource();
      const g = ctx.createGain();
      s.buffer = buf;
      g.gain.value = vol;
      s.connect(g).connect(this.sfxBus);
      s.start(ctx.currentTime + 0.01);
    } catch {}
  }
  /** 효과음 파일 미리 받기 (첫 터치 뒤) */
  prefetchSfx() {
    for (const n of ['combo', 'cheer', 'buy', 'gift', ...(this.uiSet === 'live' ? ['live2_tap', 'live2_combo', 'live2_clear'] : [])]) this.loadTrack(`assets/sfx/${n}.mp3`);
  }

  /** 받아 둔 곡 (없으면 null) */
  trackBuffer(src) {
    return (this._trackBufs && this._trackBufs.get(src)) || null;
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
      setTimeout(() => this.prefetchSfx(), 1500); // 🔔 효과음 파일 미리 (작은 정적 파일, 서버 요청 아님)
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
      // 아이폰: 다른 앱·탭이 소리를 잡고 있으면 resume() 이 끝나지 않을 수 있음 → 1초만 기다리고 넘어감 (화면이 멈추지 않게)
      try {
        await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1000))]);
      } catch {}
    }
    return ctx.state === 'running';
  }

  /**
   * 소리 엔진을 통째로 새로 만듦. 반드시 터치 이벤트 안에서.
   *   아이폰에서 다른 앱(음악·영상·화면 녹화 등)이 소리를 가져갔다 돌려주면 옛 AudioContext 가
   *   resume() 해도 다시 안 켜지거나 'running' 인데 시계가 멈춘 채로 남는 일이 있음 → 새 엔진이면 바로 켜짐.
   *   받아 둔 피아노·오케스트라 소리(AudioBuffer)는 새 엔진에서도 그대로 씀
   */
  rebuild() {
    const old = this.ctx;
    this.ctx = null;
    this._streamDest = null;
    this._clock = null;
    // 옛 엔진에 붙어 있던 노드는 새 엔진에 못 이음 (잇는 순간 오류 → 쿵만 안 눌리던 것)
    this._sat = null;
    this._tickBus = null;
    this.frozen = false;
    try {
      if (old) old.close().catch(() => {});
    } catch {}
    const ctx = this.ensure();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {}
    this._unlocked = true;
    ctx.resume().catch(() => {});
    if (this._silentEl) this._silentEl.play().catch(() => {});
    this.rebuiltAt = performance.now();
    return ctx;
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
    if (!this._sat || this._sat.context !== ctx) {
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

  /** 🔔 썰매 방울 (캐롤): 높은 쇳소리 '찰랑' 두세 겹 */
  sleigh(t, vel = 0.5, dest = this.musicBus) {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    bp.connect(g).connect(dest);
    // 방울 여러 개가 아주 조금씩 늦게 부딪힘
    for (const dt of [0, 0.012, 0.027]) this._noise(t + dt, 0.05, bp);
    for (const [f, a] of [[5200, 0.05], [6900, 0.035]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(a * vel, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + 0.14);
    }
  }

  /** 🔔 글로켄슈필 (캐롤 멜로디를 한 옥타브 위에서 반짝이게) */
  glock(t, midi, dest = this.musicBus, vel = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.06 * vel;
    g.connect(dest);
    for (const [mult, amp, d] of [[1, 1, 1.1], [2.76, 0.25, 0.35], [5.4, 0.12, 0.15]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = mtof(midi) * mult;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + d + 0.02);
    }
  }

  /** 🎤 합창 '아~' (캐롤을 같이 부르는 목소리): 톱니파 세 겹(살짝 어긋나게) → 목소리 공명(포먼트) → 비브라토.
   *  아래 한 옥타브는 남자 목소리 '오~' 로 작게 받쳐 줌 */
  choir(t, midi, dur, dest = this.musicBus, vel = 1) {
    const ctx = this.ctx;
    const end = t + Math.max(0.14, dur);
    const g = ctx.createGain();
    const peak = 0.4 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.045);
    g.gain.setValueAtTime(peak, Math.max(t + 0.05, end - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, end + 0.12);
    g.connect(dest);
    // 비브라토: 처음엔 곧게, 0.25초쯤부터 살짝 떨림
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.4;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(14, t + 0.3);
    lfo.connect(lg);
    lfo.start(t);
    lfo.stop(end + 0.15);
    const voice = (m, formants, amp, detunes) => {
      const vg = ctx.createGain();
      vg.gain.value = amp;
      vg.connect(g);
      const bps = formants.map(([f, q, a]) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const ag = ctx.createGain();
        ag.gain.value = a;
        bp.connect(ag).connect(vg);
        return bp;
      });
      for (const d of detunes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = d;
        lg.connect(o.detune);
        for (const bp of bps) o.connect(bp);
        o.start(t);
        o.stop(end + 0.15);
      }
    };
    voice(midi, [[800, 5, 1], [1150, 7, 0.55], [2900, 9, 0.22]], 1, [-9, 0, 8]); // 여자 '아'
    voice(midi - 12, [[450, 5, 1], [800, 7, 0.4], [2830, 9, 0.12]], 0.45, [-6, 5]); // 남자 '오'
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
    if (!this._tickBus || this._tickBus.context !== ctx) {
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
    // 🎹 유저 맵 왼손 (악보 아래 줄)
    try {
      this.lowNotes = level.song.low ? parseMelody(level.song.low) : [];
    } catch {
      this.lowNotes = [];
    }
    this.melodyBars = (level.song.melody || []).length;
    const lanes = levelLanes(level);
    this.mineCrash = lanes.includes(CRASH); // 크래시를 내가 치면 반주 크래시는 쉼
    const ctx = audio.ctx;
    this.bus = ctx.createGain();
    this.bus.connect(audio.musicBus);
    this.drumBus = ctx.createGain();
    this.drumBus.connect(audio.sfxBus);
    // 🎤 녹음된 곡: 반주를 만들지 않고 파일을 박자에 맞춰 틂 (song.audio.offset = 채보 첫 마디가 시작하는 파일 시각)
    this.track = level.song.audio ? audio.trackBuffer(level.song.audio.src) : null;
  }

  get totalSteps() {
    if (this.level.endless) return Infinity;
    return (COUNT_IN_BARS + this.level.bars.length + OUTRO_BARS) * STEPS_PER_BAR;
  }

  start() {
    if (this.track) this._startTrack();
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  /** 녹음된 곡 틀기. 이미 지난 시각이면(이어 가기·소리 엔진 새로 만듦) 그 자리부터 */
  _startTrack() {
    const ctx = this.audio.ctx;
    const info = this.level.song.audio;
    // 🐢 느리게 연습: 파일도 같은 비율로 느리게 틂 (소리도 조금 낮아짐)
    const rate = this.level.practice || 1;
    const t0 = this.startTime + this.tempo.barStart(COUNT_IN_BARS) - (info.offset || 0) / rate;
    const now = ctx.currentTime + 0.03;
    const src = ctx.createBufferSource();
    src.buffer = this.track;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = info.gain ?? 1;
    src.connect(g).connect(this.bus);
    if (t0 >= now) src.start(t0);
    else if ((now - t0) * rate < this.track.duration) src.start(now, (now - t0) * rate);
    else return;
    this.trackSrc = src;
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
    // 🎹 pianoOnly(시즌 2 피아노): 반주도 피아노만 (오케스트라·크래시 없이)
    const orch = a.orchestra && !this.level.pianoOnly;
    if (bar < COUNT_IN_BARS) {
      // 박자 맞추기 영상: 시작 전 똑딱이 노래와 겹치지 않게 (박자 소리를 켰을 때만)
      if (s % 4 === 0 && (!this.level.beat || this.level.click)) a.click(t, s === 0, this.bus);
      return;
    }
    const mb = bar - COUNT_IN_BARS; // 본편 마디 번호
    if (mb >= this.level.bars.length && this.level.ensureBars) this.level.ensureBars(mb + 1);
    const chartBars = this.level.bars.length;
    // 🎵 릴스 박자 맞추기: 반주 없음 (노래는 인스타에서 입힘). 드럼(+ 고르면 조용한 박자 소리)만
    if (this.level.beat) {
      if (mb >= chartBars) return;
      if (this.level.click && s % 4 === 0) a.click(t, s === 0, this.bus);
      if (this.autoChart) for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
      return;
    }
    if (this.track) {
      // 🎤 녹음된 곡: 반주는 파일이 함 (자동 연주 드럼만)
      if (this.autoChart && mb < chartBars) for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
      return;
    }
    const ch = chordAt(song, mb, s);

    if (mb >= chartBars) {
      // 아웃트로: 곡의 으뜸화음 한 방
      if (s === 0 && this.level.pianoOnly) {
        // 🎹 피아노만: 으뜸화음을 피아노로 한 번
        const home = chordAt(song, 0, 0);
        for (const m of [home.root - 24, home.root - 12, ...home.notes]) a.pianoOr('lead', t, m, sd * 14, this.bus, 0.5);
        return;
      }
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
    // 🎄 캐롤: 썰매 방울
    if (song.bells && song.bells[s] === 'x') a.sleigh(t, s % 4 === 0 ? 0.7 : 0.45, this.bus);
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
    // 🎹 유저 맵 왼손: 악보 아래 줄 그대로
    if (this.lowNotes && this.lowNotes.length) for (const n of this.lowNotes) if (n.bar === mb && n.step === s) {
          const d = Math.max(0.2, n.len * sd * 0.95);
          if (a.piano) a.pianoNote(t, n.midi, d, 0.8, this.bus);
          else a.bass(t, n.midi, d, this.bus);
        }
    // 🎹 두 손 피아노 왼손: 베이스 + 펼친 화음 (pianoLH 곡)
    if (song.pianoLH) {
      const lh = pianoLeftHand(song, mb, s);
      if (lh) a.pianoOr('lead', t, lh.midi, lh.steps * sd * 0.98, this.bus, lh.vel);
    }
    // 멜로디 (클래식 곡 주제 선율). 🎭 tapMelody 곡은 내가 칠 때만 남 (자동 연주·영상 찍기 땐 반주가 침)
    if (this.melodyBars && (!this.level.tapMelody || this.autoChart)) {
      const mbar = mb % this.melodyBars;
      for (const n of this.melody) {
        if (n.bar !== mbar || n.step !== s) continue;
        const dur = n.len * sd * 0.92;
        // 🎄 캐롤: 글로켄슈필이 한 옥타브 위에서 같이 (긴 음만, 너무 시끄럽지 않게)
        if (song.glock && n.len >= 2) a.glock(t, n.midi + 12, this.bus, 0.6 + 0.4 * heat);
        // 🎤 합창이 멜로디를 같이 부름 (짧은 음은 조금 작게)
        if (song.choir) a.choir(t, n.midi, n.len * sd * 0.95, this.bus, (n.len >= 2 ? 1 : 0.7) * (0.75 + 0.25 * heat));
        // 🎹 tapMelody 곡(자동 연주): 오른손 화음까지 피아노로 (내가 칠 때와 같은 소리)
        if (this.level.tapMelody) {
          a.pianoOr('lead', t, n.midi, Math.max(0.25, dur), this.drumBus, 1.25);
          for (const h of pianoHarmony(song, mb, s, n.midi, n.len >= 4)) a.pianoOr('lead', t, h, Math.max(0.25, dur), this.drumBus, 0.6);
          continue;
        }
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
      for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) if (!(this.level.tapMelody && lane === SNARE)) a.playLane(lane, t, this.drumBus);
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
    if (this.trackSrc) {
      try {
        this.trackSrc.stop(now + fade + 0.02);
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

// ---- buddies.js ----
const __m_buddies = (() => {
// 🥁 쿵콩이·짝콩이 (3D 그림)
//   쿵콩이 = 주황 콩, 빨간 큰북(쿵·왼쪽) / 짝콩이 = 초록 콩, 파란 작은북(짝·오른쪽)
//   그림: public/assets/mascot/{kong|jjak}_{idle|hit|miss|cheer}.webp, drum_{kong|jjak}.webp
//   그림을 바꾸면 V 를 올릴 것 (정적 파일은 30일 캐시)
//   소리(말·냥)는 넣었다가 거슬린다고 해서 뺌 (2026-11-20)

const V = '1';
const BUDDY_POSES = ['idle', 'hit', 'miss', 'cheer'];
const buddyUrl = (name) => `assets/mascot/${name}.webp?v=${V}`;

let imgsP = null;
function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
/** 그림 전부 받아 둠. { kong:{idle,hit,miss,cheer}, jjak:{...}, drum:{kong,jjak} } — 하나라도 실패하면 null (예전 그림으로) */
function loadBuddies() {
  if (imgsP) return imgsP;
  const names = [];
  for (const k of ['kong', 'jjak']) for (const p of BUDDY_POSES) names.push([k, p, `${k}_${p}`]);
  names.push(['drum', 'kong', 'drum_kong'], ['drum', 'jjak', 'drum_jjak']);
  imgsP = Promise.all(names.map(([, , n]) => loadImg(buddyUrl(n)))).then((ims) => {
    if (ims.some((x) => !x)) {
      imgsP = null;
      return null;
    }
    const out = { kong: {}, jjak: {}, drum: {} };
    names.forEach(([a, b], i) => (out[a][b] = ims[i]));
    return out;
  });
  return imgsP;
}

return { BUDDY_POSES, buddyUrl, loadBuddies };
})();

// ---- piano2.js ----
const __m_piano2 = (() => {
// 🎹 시즌 2 피아노 미리보기 (2026-11-23) — 두 방식을 쳐 보고 투표
//   A 'tiles' : 세로 화면 · 4줄 피아노 타일. 검은 타일이 내려오고 판정선에 닿을 때 누르면 그 음(+화음)이 피아노로
//              줄은 멜로디 움직임대로(올라가면 오른쪽, 내려가면 왼쪽, 같은 줄 연속 없음)
//              타일은 모두 같은 크기, 꾹 누르기 없음, 판정 글자 없음 — 화면 아래쪽에 온 타일을 누르기만 하면 됨
//              (판정선 밑으로 지나가도 화면 밖으로 나가기 전이면 맞힘, 11-23 사용자)
//   B 'keys'  : 가로 화면 · 아래 진짜 피아노 건반(흰 건반 10개 안팎 + 검은 건반)에 빛 막대가 원근 길을 따라 멀리서 다가옴
//              (드럼 게임처럼 멀리 있는 것도 보임, 글자 없음). 누른 건반 음이 그대로 남. 위에 쿵콩이·짝콩이가 반응.
//              막대 길이만큼 꾹 누르면 점수 더 — 누르는 동안 건반에 게이지가 차오름
//   건반 판정: 앞뒤 0.12초 안 = PERFECT, 0.18초 안 = GREAT (넉넉하게 — 웬만하면 PERFECT, 11-23 사용자)
//   ⚡ 점점 빠르게(fast): 곡을 길게 되풀이하며 마디마다 빨라짐(끝에 1.6배). 화면은 박자 기준이라 타일 간격은 그대로
//   연습판: 기록·랭킹·코인·서버 요청 없음. 반주는 피아노 왼손만(SongPlayer pianoOnly)

const { parseMelody, tempoOf, TempoMap, COUNT_IN_BARS, STEPS_PER_BAR, CRASH, pianoHarmony } = __m_charts;
const { SongPlayer } = __m_audio;
const { buddyUrl } = __m_buddies;

/** 미리보기 곡 (퍼블릭 도메인 단계 곡의 멜로디) */
const P2_SONGS = [
  { id: 1, diff: '쉬움' },
  { id: 2, diff: '쉬움' },
  { id: 11, diff: '보통' },
  { id: 12, diff: '어려움' },
];
const P2_SOLFA = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const pc = (m) => ((m % 12) + 12) % 12;
const isWhite = (m) => WHITE.includes(pc(m));
/** 맞힘으로 치는 범위(초, 앞뒤). 넉넉하게 */
const P2_HIT_WIN = 0.18;
/** 이 안이면 PERFECT */
const P2_PERFECT = 0.12;
/** 누르는 버릇 보정은 앞뒤 이만큼까지 */
const P2_BIAS_MAX = 0.15;

/** 맞힌 시간 차들(초) → 새 버릇 값: 최근 것의 가운데값 쪽으로 반씩 (튀는 값에 안 흔들리게) */
function p2LearnBias(bias, dts) {
  if (dts.length < 4) return bias;
  const r = dts.slice(-12).sort((a, b) => a - b);
  const mid = r[Math.floor(r.length / 2)];
  return Math.max(-P2_BIAS_MAX, Math.min(P2_BIAS_MAX, bias + (mid - bias) * 0.5));
}
const HIT_POINTS = { perfect: 1000, great: 650, ok: 1000 };
/** 타일: 아래 끝이 화면 높이의 이만큼 아래로 내려오면 누를 수 있음 */
const TILE_READY = 0.42;
const HOLD_POINTS = 900; // 꾹 누르는 1초마다 (건반만)
/** ⚡ 점점 빠르게: 끝에서 이만큼 (1.6 = 1.6배) */
const P2_FAST_MAX = 1.6;
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;

/** 게임 단계 → 미리보기용 (멜로디는 내가 침, 반주는 피아노 왼손만). fast = 점점 빠르게 */
function p2Level(level, { fast = false } = {}) {
  const dots = '.'.repeat(STEPS_PER_BAR);
  const song = { ...level.song, pianoLH: true, bass: dots, chord: dots, hat: dots, bells: undefined, glock: undefined, choir: undefined, audio: undefined, epic: false };
  // 짧은 멜로디는 30초쯤(빨라지기면 55초쯤) 되게 되풀이 (코드 진행도 멜로디 길이에 맞춰 같이)
  const bars = level.song.melody.length;
  const reps = Math.max(1, Math.ceil((fast ? 55 : 30) / ((bars * 240) / level.bpm)));
  if (reps > 1) {
    song.melody = Array.from({ length: reps }, () => level.song.melody).flat();
    const prog = level.song.prog || ['C'];
    song.prog = Array.from({ length: bars }, (_, i) => prog[i % prog.length]);
  }
  const out = { ...level, song, tapMelody: true, pianoOnly: true, lanes: [CRASH], bars: song.melody.map(() => dots) };
  delete out.tempo;
  if (fast) {
    const total = song.melody.length;
    out.fast = true;
    out.tempo = new TempoMap((bar) => level.bpm * p2FastMult(bar - COUNT_IN_BARS, total));
  }
  return out;
}

/** 점점 빠르게: 곡 마디 b (0 부터) 의 빠르기 배수. 처음 1배 → 끝 P2_FAST_MAX */
function p2FastMult(b, total) {
  const k = Math.max(0, Math.min(1, b / Math.max(1, total - 1)));
  return 1 + (P2_FAST_MAX - 1) * k;
}

/** 곡 → 칠 음표 [{ t, dur, end, midi, bar, step, len, beat, lenB }] (곡 시작 = 카운트인 첫 박 기준 초, beat = 박 위치) */
function p2Notes(level) {
  const tempo = tempoOf(level);
  return parseMelody(level.song.melody).map((n) => {
    const s0 = (COUNT_IN_BARS + n.bar) * STEPS_PER_BAR + n.step;
    const t = tempo.stepTime(s0);
    const end = tempo.stepTime(s0 + n.len);
    return { t, dur: end - t, end, midi: n.midi, bar: n.bar, step: n.step, len: n.len, beat: s0 / 4, lenB: n.len / 4 };
  });
}

/** 판정: 시간 차(초) → 'perfect' | 'great' | null(못 맞힘) */
function p2Judge(dt) {
  const a = Math.abs(dt);
  return a <= P2_PERFECT ? 'perfect' : a <= P2_HIT_WIN ? 'great' : null;
}

/** A: 4줄 — 올라가면 오른쪽, 내려가면 왼쪽(크게 뛰면 두 칸), 같은 음은 옆 줄. 같은 줄 연속 없음 */
function p2TileLanes(notes) {
  const out = [];
  let prev = -1;
  notes.forEach((n, i) => {
    let L;
    if (prev < 0) L = n.midi >= notes.reduce((a, x) => a + x.midi, 0) / notes.length ? 2 : 1;
    else {
      const d = n.midi - notes[i - 1].midi;
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

/** A: 모든 타일 같은 크기(박 단위) — 같은 줄 다음 타일과 안 겹치게, 0.4~0.95박 */
function p2TileBeats(notes, lanes) {
  let min = Infinity;
  const last = [null, null, null, null];
  notes.forEach((n, i) => {
    const L = lanes[i];
    if (last[L] != null) min = Math.min(min, n.beat - last[L]);
    last[L] = n.beat;
  });
  return Math.max(0.4, Math.min(0.95, (isFinite(min) ? min : 1) * 0.9));
}

/** B: 쓸 건반 [{ midi, white }] — 곡 음역(검은 건반 포함), 흰 건반 10개 이상이 되게 양쪽으로 넓힘, 많아야 15개 */
function p2Keys(notes, minWhite = 10, maxWhite = 15) {
  let lo = Math.min(...notes.map((n) => n.midi));
  let hi = Math.max(...notes.map((n) => n.midi));
  while (!isWhite(lo)) lo--;
  while (!isWhite(hi)) hi++;
  const whites = () => {
    let c = 0;
    for (let m = lo; m <= hi; m++) if (isWhite(m)) c++;
    return c;
  };
  let up = true;
  while (whites() < minWhite) {
    if (up) {
      hi++;
      while (!isWhite(hi)) hi++;
    } else {
      lo--;
      while (!isWhite(lo)) lo--;
    }
    up = !up;
  }
  while (whites() > maxWhite) {
    hi--;
    while (!isWhite(hi)) hi--;
  }
  const keys = [];
  for (let m = lo; m <= hi; m++) keys.push({ midi: m, white: isWhite(m) });
  return keys;
}

const p2Solfa = (m) => P2_SOLFA[pc(m)];

/** 맞힌 비율 → 별 0~3 · 등급 */
function p2Stars(acc, miss) {
  return acc >= 0.95 && miss === 0 ? 3 : acc >= 0.85 ? 2 : acc >= 0.6 ? 1 : 0;
}
function p2Grade(acc) {
  return acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
}

let buddyImgs = null;
function buddies() {
  if (buddyImgs) return buddyImgs;
  buddyImgs = {};
  for (const who of ['kong', 'jjak']) for (const pose of ['idle', 'hit', 'miss', 'cheer']) {
    const im = new Image();
    im.src = buddyUrl(`${who}_${pose}`);
    buddyImgs[`${who}_${pose}`] = im;
  }
  return buddyImgs;
}

/** 건반 빛 색: 왼쪽(낮은 음) 하늘색 → 파랑 → 보라 → 오른쪽 분홍 */
function laneHue(i, n) {
  return 188 + (n > 1 ? i / (n - 1) : 0) * 140;
}

class PianoPreview {
  /**
   * @param {{ audio, canvas, level, style: 'tiles'|'keys', fast?: boolean, rotated?: () => boolean, onEnd }} o
   *   rotated(): 가로 화면을 세로 폰에 90° 돌려 그리는 중인지 (터치 좌표를 돌려 읽음)
   */
  constructor({ audio, canvas, level, style, fast, rotated, onEnd, offsetMs = 0, bias = 0 }) {
    // 드럼 게임과 같은 싱크 보정(설정의 offsetMs) + 이 폰에서 배운 '누르는 버릇'(bias, 초)
    //   11-23 사용자 'PERFECT 가 막대가 오기 전에 눌러야 뜸' → 판정 가운데를 내가 실제로 누르는 때로 옮김 (화면은 그대로)
    this.offset = (offsetMs || 0) / 1000;
    this.bias = Math.max(-P2_BIAS_MAX, Math.min(P2_BIAS_MAX, bias || 0));
    this.hitDts = [];
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.style = style;
    this.rotated = rotated || (() => false);
    this.onEnd = onEnd;
    this.level = p2Level(level, { fast: !!fast });
    this.tempo = tempoOf(this.level);
    this.baseBpm = level.bpm;
    this.notes = p2Notes(this.level);
    if (style === 'keys') {
      // 건반은 곡 음역만 (흰 건반 7개부터) → 건반이 넓어져 치기 쉬움 (11-23 사용자 '치기 너무 어려워')
      this.keys = p2Keys(this.notes, 7, 15);
      const idx = new Map(this.keys.map((k, i) => [k.midi, i]));
      for (const n of this.notes) {
        n.lane = idx.get(n.midi);
        n.holdable = true; // 건반은 모든 음을 막대 길이만큼 꾹
      }
      this.hues = this.keys.map((_, i) => laneHue(i, this.keys.length));
      this.usedLane = new Set(this.notes.map((n) => n.lane));
      if (typeof window !== 'undefined') buddies();
    } else {
      const lanes = p2TileLanes(this.notes);
      this.notes.forEach((n, i) => {
        n.lane = lanes[i];
        n.holdable = false; // 타일은 꾹 없음
      });
      this.tileB = p2TileBeats(this.notes, lanes);
    }
    this.lanes = style === 'keys' ? this.keys.length : 4;
    this.counts = { hit: 0, perfect: 0, great: 0, ok: 0, miss: 0, wrong: 0 };
    this.holdSec = 0; // 꾹 누른 시간
    this.holdMax = this.notes.filter((n) => n.holdable).reduce((a, n) => a + n.dur, 0);
    this.bonus = 0;
    this.score = 0;
    this.shown = 0; // 화면에 보이는 점수 (부드럽게 따라감)
    this.combo = 0;
    this.maxCombo = 0;
    this.topSpeed = 1;
    this.speedNow = 1;
    this.pressed = new Map(); // pointerId → { lane, note, x, y }
    this.press = new Float32Array(this.lanes); // 건반·줄 눌림 0~1 (부드럽게)
    this.fx = { flash: [], pops: [], rings: [], parts: [], bad: [] };
    this.mood = { kong: { pose: 'idle', until: 0 }, jjak: { pose: 'idle', until: 0 } };
    this.lastEnd = this.notes.reduce((a, n) => Math.max(a, n.end), 0);
    this.beat = 60 / this.level.bpm;
    this.state = 'ready';
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    this._onMove = (e) => this._move(e);
    // 아이폰: 꾹 누르면 뜨는 돋보기(확대경)·글자 고르기 막기 — 터치 기본 동작만 끔(포인터 이벤트는 그대로 옴)
    this._onTouch = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  // ---------- 시작·멈춤 ----------
  start() {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointermove', this._onMove);
    for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, this._onUp);
    for (const ev of ['touchstart', 'touchmove', 'touchend']) c.addEventListener(ev, this._onTouch, { passive: false });
    this._play(this.audio.ctx.currentTime + 0.35);
  }

  _play(startTime) {
    this.startTime = startTime;
    this.player = new SongPlayer(this.audio, this.level, startTime);
    this.player.start();
    this.state = 'playing';
    this.lastFrame = performance.now();
    const loop = () => {
      if (this.state !== 'playing') return;
      this._tick();
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  _halt() {
    cancelAnimationFrame(this.raf);
    if (this.player) this.player.stop(0.08);
    this.player = null;
  }

  /** 일시정지 (꾹 누르던 음은 거기까지) */
  pause() {
    if (this.state !== 'playing') return false;
    const t = this.now();
    this.pausedAt = t;
    for (const p of this.pressed.values()) if (p.note) this._release(p.note, t, p);
    this.pressed.clear();
    this.press.fill(0);
    this._halt();
    this.state = 'paused';
    this._draw(t, 0);
    return true;
  }

  /** 이어 하기: 1.8초 앞에서 다시 흘러 3·2·1 뒤 멈춘 자리 */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.resumeAt = this.pausedAt;
    this._play(this.audio.ctx.currentTime + 1.8 - this.pausedAt);
  }

  stop() {
    this._halt();
    this.state = 'stopped';
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointermove', this._onMove);
    for (const ev of ['pointerup', 'pointercancel']) c.removeEventListener(ev, this._onUp);
    for (const ev of ['touchstart', 'touchmove', 'touchend']) c.removeEventListener(ev, this._onTouch);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._bgCache = null;
    this._layout();
    if (this.state === 'paused') this._draw(this.pausedAt, 0);
  }

  _layout() {
    const { W, H } = this;
    if (this.style === 'tiles') {
      this.laneW = W / 4;
      this.judgeY = H * 0.8;
      // 박 하나의 높이: 타일이 화면 1/5쯤 되게 (0.22~0.4 화면)
      this.ppb = Math.max(H * 0.22, Math.min(H * 0.4, (H * 0.2) / this.tileB));
      this.tileH = this.tileB * this.ppb;
      this.lookB = (this.judgeY + this.tileH) / this.ppb + 0.2;
      this.readyB = (this.judgeY - H * TILE_READY) / this.ppb; // 이만큼 박 앞이면 누를 수 있음
      this.goneB = (H - this.judgeY + this.tileH) / this.ppb; // 이만큼 지나면(화면 밖) 놓침
      return;
    }
    // 건반: 위 정보 줄 → 떨어지는 칸 → 건반
    const side = Math.max(10, W * 0.025);
    this.hudH = Math.max(46, H * 0.15);
    const nWhite = this.keys.filter((k) => k.white).length;
    this.keyW = (W - side * 2) / nWhite;
    this.kbH = Math.min(H * 0.36, this.keyW * 2.6);
    this.kbY = H - this.kbH - Math.max(6, H * 0.02);
    this.judgeY = this.kbY;
    // 원근 길: 판정선에서 VB 박 앞까지 보임 (멀수록 작고 좁게). 처음 빠르기로 2.4초어치 또는 3.5박
    this.VB = Math.max(3.5, 2.4 / this.beat);
    this.lookB = this.VB;
    this.topY = this.hudH + 6;
    this.FAR = 3.2;
    this.sFar = 1 / (1 + this.FAR);
    this.horizonY = (this.topY - this.judgeY * this.sFar) / (1 - this.sFar);
    this.cx = W / 2;
    let wi = 0;
    this.cols = this.keys.map((k) => {
      if (k.white) {
        const x = side + wi * this.keyW;
        wi++;
        return { x, w: this.keyW, white: true };
      }
      const bw = this.keyW * 0.6;
      return { x: side + wi * this.keyW - bw / 2, w: bw, white: false };
    });
    this.blackH = this.kbH * 0.6;
    this.roadX0 = this.cols[0].x;
    this.roadX1 = this.cols.at(-1).x + this.cols.at(-1).w;
  }

  // ---------- 건반 원근 ----------
  /** 판정선까지 남은 박 d → 크기 배율 (판정선 1, 멀수록 작게) */
  _s(d) {
    return 1 / (1 + Math.max(-0.4, (d / this.VB) * this.FAR));
  }
  _py(s) {
    return this.horizonY + (this.judgeY - this.horizonY) * s;
  }
  /** 옆으로 좁아지는 정도: 원근의 절반만 (11-23 사용자: 구석 건반 막대가 가운데로 쏠려 보여 다른 건반을 침) */
  _sx(s) {
    return 1 - (1 - s) * 0.45;
  }
  _px(x, s) {
    return this.cx + (x - this.cx) * this._sx(s);
  }
  /** 길 위 사다리꼴 (판정선 자리 x 범위 xa~xb, 크기 배율 sa(먼 쪽)~sb(가까운 쪽)) */
  _trap(g, xa, xb, sa, sb) {
    g.beginPath();
    g.moveTo(this._px(xa, sa), this._py(sa));
    g.lineTo(this._px(xb, sa), this._py(sa));
    g.lineTo(this._px(xb, sb), this._py(sb));
    g.lineTo(this._px(xa, sb), this._py(sb));
    g.closePath();
  }

  /** 지금 곡 시각 (귀에 들리는 소리 기준) */
  now(perfMs = performance.now()) {
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  // ---------- 입력 ----------
  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    if (this.rotated()) return { x: e.clientY - r.top, y: r.right - e.clientX };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _laneAt(x, y) {
    if (this.style === 'tiles') {
      if (y < this.H * 0.18) return -1;
      return Math.max(0, Math.min(3, Math.floor(x / this.laneW)));
    }
    if (y < this.judgeY - (this.judgeY - this.hudH) * 0.45) return -1;
    // 길 위를 누르면: 그 높이에서 막대가 보이는 자리 → 건반 자리로 되돌려 읽음 (원근 때문에 다른 건반이 눌리지 않게)
    if (y < this.judgeY) {
      const k = this._sx(Math.max(this.sFar, Math.min(1, (y - this.horizonY) / (this.judgeY - this.horizonY))));
      x = this.cx + (x - this.cx) / k;
    }
    this._tapX = x;
    // 검은 건반은 곡에 그 음이 있을 때만 따로 눌림 (없으면 밑의 흰 건반으로)
    if (y < this.kbY + this.blackH) {
      for (let i = 0; i < this.cols.length; i++) {
        const c = this.cols[i];
        if (!c.white && this.usedLane.has(i) && x >= c.x && x < c.x + c.w) return i;
      }
    }
    let best = 0;
    let bd = Infinity;
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      if (x >= c.x && x < c.x + c.w) {
        bd = -1;
        best = i;
      } else if (bd >= 0) {
        const d = Math.abs(c.x + c.w / 2 - x);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    return best;
  }

  _down(e) {
    e.preventDefault();
    if (this.state !== 'playing') return;
    const { x, y } = this._local(e);
    let lane = this._laneAt(x, y);
    if (lane < 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    // 손가락이 닿은 때 (이벤트 처리까지 걸린 시간은 빼고)
    const ts = e.timeStamp > 0 && Math.abs(performance.now() - e.timeStamp) < 300 ? e.timeStamp : performance.now();
    const t = this.now(ts);
    const rt = this.audio.ctx.currentTime;
    const bias = this.style === 'keys' ? this.bias : 0;
    let best = null;
    if (this.style === 'tiles') {
      // 타일: 이 줄에서 화면 아래쪽에 온 가장 먼저 안 친 타일 (판정선 밑으로 지나갔어도 화면 안이면)
      const b = this.tempo.beatAt(t);
      for (const n of this.notes) {
        if (n.lane !== lane || n.hit || n.miss) continue;
        if (n.beat - b <= this.readyB) best = n;
        break;
      }
    } else {
      // 건반: 가장 가까운 안 친 음 (앞뒤 P2_HIT_WIN 안이면 맞힘)
      //   누른 건반에 칠 음이 없으면 옆 건반(손가락 자리에서 건반 한 칸 안)의 음도 받아 줌 — 판정 칸을 막대보다 넉넉하게
      const tx = this._tapX ?? x;
      let bestD = Infinity;
      for (const n of this.notes) {
        if (n.hit || n.miss) continue;
        const dt = t - n.t - bias;
        if (dt < -P2_HIT_WIN) break;
        if (Math.abs(dt) > P2_HIT_WIN) continue;
        const near = n.lane === lane ? 0 : Math.abs(this._laneX(n.lane) - tx) / this.keyW;
        if (near > 1.05) continue;
        // 같은 건반 먼저, 그다음 시간이 잘 맞는 것, 그다음 가까운 건반
        const score = (n.lane === lane ? 0 : 1) + Math.abs(dt) * 2 + near * 0.3;
        if (score < bestD) {
          bestD = score;
          best = n;
        }
      }
    }
    if (best && best.lane !== lane) lane = best.lane; // 옆 건반 음을 받아 줬으면 그 건반이 눌린 걸로
    const press = { lane, note: null, x, y, at: t };
    this.pressed.set(e.pointerId, press);
    this.fx.flash.push({ lane, at: t });
    if (best) {
      best.hit = true;
      best.hitAt = t;
      best.hitX = x;
      best.hitY = y;
      this._sound(best, rt);
      if (this.style === 'keys') {
        this.hitDts.push(t - best.t);
        this.bias = p2LearnBias(this.bias, this.hitDts);
      }
      this._hit(best, t, this.style === 'tiles' ? 'ok' : p2Judge(t - best.t - bias) || 'great');
      this._burst(best, t, x, y);
      if (best.holdable) {
        best.holding = true;
        best.heldTo = Math.max(t, best.t);
        best.bonus = 0;
        press.note = best;
      }
    } else {
      // 칠 게 없는데 누름 = 헛침 (건반은 그 음이 남)
      if (this.style === 'keys') this._keySound(lane, rt, 0.55);
      this.counts.wrong++;
      this.combo = 0;
      this.fx.bad.push({ lane, at: t, x, y });
      this.fx.pops.push({ kind: 'wrong', lane, at: t });
      this._mood(lane, 'miss', t, 0.5);
    }
  }

  _move(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    p.y = this._local(e).y;
  }

  _up(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    this.pressed.delete(e.pointerId);
    if (p.note && p.note.holding) this._release(p.note, this.now(), p);
  }

  /** 꾹 누르던 손을 뗌 (또는 음이 끝남): 그때까지 쌓인 보너스를 보여 줌 */
  _release(n, t) {
    this._credit(n, t);
    n.holding = false;
    n.releasedAt = t;
    // 긴 음만 '+보너스' 글자 (짧은 음까지 띄우면 어지러움)
    if (n.bonus >= 150 && n.dur >= this.beat * 1.5) this.fx.pops.push({ kind: 'bonus', lane: n.lane, at: t, v: Math.round(n.bonus) });
  }

  /** 꾹 누른 만큼 점수 (음 끝까지만) */
  _credit(n, t) {
    const to = Math.min(t, n.end);
    if (to <= n.heldTo) return;
    const sec = to - n.heldTo;
    n.heldTo = to;
    this.holdSec += sec;
    const pts = sec * HOLD_POINTS * (1 + Math.min(this.combo, 100) / 200);
    n.bonus += pts;
    this.bonus += pts;
    this.score += pts;
  }

  _hit(n, t, kind) {
    this.counts.hit++;
    this.counts[kind]++;
    n.judge = kind;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += HIT_POINTS[kind] * (1 + Math.min(this.combo, 100) / 100) * this.speedNow;
    this.comboAt = t;
    if (kind !== 'ok') this.fx.pops.push({ kind, lane: n.lane, at: t });
    if (this.combo % 10 === 0) {
      this._mood(-1, 'cheer', t, 0.9);
      this.comboBig = t;
    } else this._mood(n.lane, 'hit', t, 0.22);
  }

  _missNote(n, t) {
    n.miss = true;
    n.missAt = t;
    this.counts.miss++;
    this.combo = 0;
    this.fx.pops.push({ kind: 'miss', lane: n.lane, at: t });
    this._mood(n.lane, 'miss', t, 0.7);
  }

  /** 마스코트 표정 (건반: 왼쪽 반 = 쿵콩이, 오른쪽 반 = 짝콩이, -1 = 둘 다) */
  _mood(lane, pose, t, dur) {
    if (this.style !== 'keys') return;
    const half = this.keys.length / 2;
    const who = lane < 0 ? ['kong', 'jjak'] : [lane < half ? 'kong' : 'jjak'];
    for (const w of who) {
      const m = this.mood[w];
      if (m.pose === 'cheer' && m.until > t && pose === 'hit') continue;
      m.pose = pose;
      m.until = t + dur;
    }
  }

  _sound(n, rt) {
    const a = this.audio;
    const dur = Math.min(1.8, Math.max(0.3, n.dur * 0.95));
    try {
      if (a.piano) a.pianoNote(rt, n.midi, dur, 0.95, a.sfxBus);
      else a.lead(rt, n.midi, dur, a.sfxBus);
      // 타일: 오른손 화음까지 (건반은 누른 음만)
      if (this.style === 'tiles') for (const h of pianoHarmony(this.level.song, n.bar, n.step, n.midi, n.len >= 4)) a.pianoOr('lead', rt, h, dur, a.sfxBus, 0.5);
    } catch {}
  }

  _keySound(lane, rt, vel) {
    const a = this.audio;
    try {
      if (a.piano) a.pianoNote(rt, this.keys[lane].midi, 0.35, vel, a.sfxBus);
      else a.lead(rt, this.keys[lane].midi, 0.3, a.sfxBus);
    } catch {}
  }

  _laneX(lane) {
    if (this.style === 'tiles') return (lane + 0.5) * this.laneW;
    const c = this.cols[lane];
    return c.x + c.w / 2;
  }

  _laneColor(lane, l = 66, a = 1) {
    return `hsla(${this.hues[lane]},95%,${l}%,${a})`;
  }

  /** 맞힌 자리: 퍼지는 고리 + 빛 알갱이 */
  _burst(n, t, x, y) {
    const keys = this.style === 'keys';
    const col = keys ? this._laneColor(n.lane, 70) : '#ffc35c';
    const cx = keys ? this._laneX(n.lane) : this._laneX(n.lane);
    const cy = keys ? this.judgeY : this.judgeY - this.tileH * 0.5;
    this.fx.rings.push({ x: cx, y: cy, at: t, color: col });
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * (0.1 + 0.8 * Math.random());
      const v = 110 + Math.random() * 120;
      this.fx.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: t, life: 0.45 + Math.random() * 0.25, color: col, s: 2 + Math.random() * 2.5 });
    }
  }

  get accuracy() {
    const c = this.counts;
    return c.hit / Math.max(1, this.notes.length + c.wrong);
  }

  result() {
    const c = this.counts;
    const acc = this.accuracy;
    return {
      score: Math.round(this.score),
      accuracy: acc,
      maxCombo: this.maxCombo,
      ...c,
      notes: this.notes.length,
      bonus: Math.round(this.bonus),
      holdMax: this.holdMax,
      holdPct: this.holdMax ? Math.min(1, this.holdSec / this.holdMax) : 0,
      topSpeed: this.topSpeed,
      style: this.style,
      bias: this.bias,
      full: c.miss === 0 && c.wrong === 0,
      stars: p2Stars(acc, c.miss),
      grade: p2Grade(acc),
    };
  }

  // ---------- 매 화면 ----------
  _tick() {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    const t = this.now(nowMs);
    const b = this.tempo.beatAt(t);
    const tiles = this.style === 'tiles';
    for (const n of this.notes) {
      if (!n.hit && !n.miss && (tiles ? b - n.beat > this.goneB : t - n.t - this.bias > P2_HIT_WIN)) this._missNote(n, t);
      if (n.holding) {
        this._credit(n, t);
        if (t >= n.end) this._release(n, t);
      }
    }
    if (t > this.lastEnd + 1.4) {
      this.stop();
      this.state = 'ended';
      this._draw(t, dt);
      if (this.onEnd) this.onEnd(this.result());
      return;
    }
    this._draw(t, dt);
  }

  _draw(t, dt = 0) {
    // 지금 박 위치 · 빠르기
    this.bNow = this.tempo.beatAt(t);
    if (this.level.fast) {
      this.speedNow = this.tempo.bpm(Math.max(0, Math.floor(this.bNow / 4))) / this.baseBpm;
      if (t > 0 && t < this.lastEnd) this.topSpeed = Math.max(this.topSpeed, this.speedNow);
    }
    // 부드럽게 따라가는 값들: 점수 숫자, 줄·건반 눌림
    this.shown += (this.score - this.shown) * Math.min(1, dt * 10);
    if (Math.abs(this.score - this.shown) < 1) this.shown = this.score;
    const held = new Set([...this.pressed.values()].map((p) => p.lane));
    for (let i = 0; i < this.lanes; i++) {
      const target = held.has(i) ? 1 : 0;
      const rate = target ? 40 : 12;
      this.press[i] += (target - this.press[i]) * Math.min(1, dt * rate);
    }
    const g = this.g;
    g.save();
    if (this.style === 'keys') this._drawKeys(g, t);
    else this._drawTiles(g, t);
    this._drawFx(g, t);
    this._drawCount(g, t);
    g.restore();
    const old = t - 1.2;
    for (const k of Object.keys(this.fx)) this.fx[k] = this.fx[k].filter((f) => f.at > old);
  }

  /** 3 · 2 · 1 (처음과 이어 하기) */
  _drawCount(g, t) {
    const first = this.resumeAt != null ? this.resumeAt : this.notes.length ? this.notes[0].t : 0;
    const left = first - t;
    if (left <= 0.05 || left > this.beat * 3.2 + (this.resumeAt != null ? 0.6 : 0)) {
      if (left <= 0.05) this.resumeAt = null;
      return;
    }
    const k = Math.min(3, Math.ceil((left / (this.beat * 3)) * 3 - 0.001));
    const frac = (left / (this.beat * 3)) * 3 - (k - 1);
    const s = 0.85 + 0.25 * ease((1 - frac) * 3);
    const cx = this.W / 2;
    const cy = this.style === 'keys' ? (this.hudH + this.judgeY) / 2 : this.H * 0.42;
    const R = Math.min(this.W, this.H) * 0.13;
    g.save();
    g.globalAlpha = Math.min(1, frac * 2.5);
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#ff8a4c';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, R * s - 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, frac % 1 || 1));
    g.stroke();
    g.fillStyle = '#3b2a4a';
    g.font = font(R * 1.2 * s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(k), cx, cy + R * 0.06);
    g.restore();
  }

  /** ⚡ ×1.25 (점점 빠르게일 때만) */
  _drawSpeed(g, x, y, size, color) {
    if (!this.level.fast) return;
    g.save();
    g.font = font(size);
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(`⚡ ×${this.speedNow.toFixed(2)}`, x, y);
    g.restore();
  }

  // ======== A: 피아노 타일 (세로) ========
  _tilesBg(g) {
    const { W, H } = this;
    if (!this._bgCache) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#fff8ee');
      bg.addColorStop(0.55, '#fdf0f3');
      bg.addColorStop(1, '#efe8ff');
      const zone = g.createLinearGradient(0, this.judgeY - this.tileH, 0, H);
      zone.addColorStop(0, 'rgba(255,190,110,0)');
      zone.addColorStop(0.5, 'rgba(255,190,110,0.10)');
      zone.addColorStop(1, 'rgba(255,170,140,0.18)');
      const line = g.createLinearGradient(0, 0, W, 0);
      line.addColorStop(0, 'rgba(255,196,92,0)');
      line.addColorStop(0.2, '#ffc45c');
      line.addColorStop(0.8, '#ff8fb8');
      line.addColorStop(1, 'rgba(255,143,184,0)');
      const div = g.createLinearGradient(0, 0, 0, H);
      div.addColorStop(0, 'rgba(150,120,190,0)');
      div.addColorStop(0.5, 'rgba(150,120,190,0.16)');
      div.addColorStop(1, 'rgba(150,120,190,0.26)');
      this._bgCache = { bg, zone, line, div };
    }
    return this._bgCache;
  }

  _drawTiles(g, t) {
    const { W, H, laneW, judgeY, ppb, tileH } = this;
    const C = this._tilesBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // 천천히 떠오르는 빛 방울
    for (let i = 0; i < 7; i++) {
      const r = (0.08 + (i % 4) * 0.035) * W;
      const x = ((i * 0.293 + 0.11) % 1) * W + Math.sin(t * 0.5 + i) * 12;
      const span = H + r * 2;
      const y = H + r - ((t * (14 + (i % 3) * 7) + i * 211) % span);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const hue = i % 2 ? '255,186,140' : '196,160,255';
      gr.addColorStop(0, `rgba(${hue},0.22)`);
      gr.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = C.zone;
    g.fillRect(0, judgeY - tileH, W, H - judgeY + tileH);
    // 누른 줄 빛 (부드럽게 켜지고 꺼짐)
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.01) continue;
      const gr = g.createLinearGradient(0, judgeY - H * 0.35, 0, H);
      gr.addColorStop(0, 'rgba(255,200,120,0)');
      gr.addColorStop(1, `rgba(255,180,120,${0.38 * a})`);
      g.fillStyle = gr;
      g.fillRect(i * laneW, judgeY - H * 0.35, laneW, H * 0.35 + H - judgeY);
    }
    // 헛침: 그 칸이 빨갛게 (부드럽게 사라짐)
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.38 * a})`;
      rr(g, b.lane * laneW + 3, judgeY - tileH, laneW - 6, H - judgeY + tileH - 4, 12);
      g.fill();
    }
    g.fillStyle = C.div;
    for (let i = 1; i < 4; i++) g.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 타일 (모두 같은 크기, 아래 끝이 판정선에 닿을 때 누름)
    const gap = 4;
    const h = tileH - gap;
    for (const n of this.notes) {
      const d = n.beat - this.bNow;
      if (d > this.lookB) break;
      const yB = judgeY - d * ppb;
      if (yB - h > H + 10) continue;
      if (n.hit && t - n.hitAt > 0.32) continue;
      if (n.miss && t - n.missAt > 0.6) continue;
      this._tile(g, n, n.lane * laneW + 3, yB - h, laneW - 6, h, t);
    }
    // 판정선: 금빛
    g.fillStyle = 'rgba(255,190,110,0.18)';
    g.fillRect(0, judgeY - 5, W, 10);
    g.fillStyle = C.line;
    g.fillRect(0, judgeY - 1.5, W, 3);
    // 위: 진행 줄 · 점수 · 콤보
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    const top = 12;
    g.fillStyle = 'rgba(59,42,74,0.1)';
    rr(g, 70, top + 6, W - 140, 8, 4);
    g.fill();
    if (!this._pg || this._pgW !== W) {
      this._pg = g.createLinearGradient(70, 0, W - 70, 0);
      this._pg.addColorStop(0, '#ffc45c');
      this._pg.addColorStop(1, '#ff6fae');
      this._pgW = W;
    }
    g.fillStyle = this._pg;
    rr(g, 70, top + 6, Math.max(8, (W - 140) * p), 8, 4);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    const sTxt = Math.round(this.shown).toLocaleString();
    g.font = font(Math.min(52, W * 0.13));
    g.lineWidth = 6;
    g.strokeStyle = '#fff8ee';
    g.strokeText(sTxt, W / 2, top + 26);
    g.fillStyle = '#3b2a4a';
    g.fillText(sTxt, W / 2, top + 26);
    this._drawCombo(g, t, W / 2, top + 26 + Math.min(58, W * 0.145), Math.min(22, W * 0.056), '#fff8ee');
    this._drawSpeed(g, W - 14, top + 44, Math.min(18, W * 0.045), '#ff7a2e');
  }

  /** 콤보 글자: 맞힐 때마다 살짝 통 튀고, 10콤보마다 크게 */
  _drawCombo(g, t, x, y, size, outline) {
    if (this.combo < 2) return;
    const k1 = this.comboAt != null ? 1 - ease((t - this.comboAt) / 0.18) : 0;
    const k2 = this.comboBig != null ? 1 - ease((t - this.comboBig) / 0.4) : 0;
    const s = 1 + 0.12 * k1 + 0.35 * k2;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.font = font(size);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = outline;
    g.strokeText(`${this.combo} 콤보`, 0, 0);
    g.fillStyle = k2 > 0.05 ? '#ff5fa2' : '#ff8a4c';
    g.fillText(`${this.combo} 콤보`, 0, 0);
    g.restore();
  }

  _tile(g, n, x, y, w, h, t) {
    const r = Math.min(12, w * 0.14);
    if (n.miss) {
      // 놓친 타일: 빨갛게 됐다가 사라짐
      g.globalAlpha = 1 - ease((t - n.missAt) / 0.6);
      g.fillStyle = '#ff4d6d';
      rr(g, x, y, w, h, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    if (n.hit) {
      // 친 타일: 금빛으로 번쩍 → 살짝 커지며 사라짐
      const k = ease((t - n.hitAt) / 0.32);
      const sx = -w * 0.05 * k;
      const sy = -h * 0.05 * k;
      g.globalAlpha = 1 - k;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#fff6dc');
      gr.addColorStop(1, '#ffc35c');
      g.fillStyle = gr;
      rr(g, x + sx, y + sy, w - sx * 2, h - sy * 2, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    // 그림자
    g.fillStyle = 'rgba(40,20,60,0.16)';
    rr(g, x + 2, y + 5, w, h, r);
    g.fill();
    // 검은 유광 타일
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#3d3854');
    gr.addColorStop(0.5, '#1d1a2a');
    gr.addColorStop(1, '#0c0a12');
    g.fillStyle = gr;
    rr(g, x, y, w, h, r);
    g.fill();
    // 위쪽 빛 반사
    g.save();
    rr(g, x, y, w, h, r);
    g.clip();
    const gl = g.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,0.20)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h * 0.22);
    g.lineTo(x, y + h * 0.42);
    g.closePath();
    g.fill();
    // 아래 금빛 테두리 (누를 끝)
    g.fillStyle = '#ffc35c';
    g.fillRect(x, y + h - 3, w, 3);
    g.restore();
    // 가운데 작은 금빛 마름모
    const cx = x + w / 2;
    const cy = y + h * 0.62;
    const s = Math.min(7, w * 0.07);
    g.fillStyle = 'rgba(255,205,120,0.85)';
    g.beginPath();
    g.moveTo(cx, cy - s);
    g.lineTo(cx + s, cy);
    g.lineTo(cx, cy + s);
    g.lineTo(cx - s, cy);
    g.closePath();
    g.fill();
  }

  // ======== B: 건반 (가로) ========
  _keysBg(g) {
    const { W, H, hudH, judgeY } = this;
    if (!this._bgCache) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#080a1a');
      bg.addColorStop(0.6, '#15103a');
      bg.addColorStop(1, '#241450');
      const floor = g.createLinearGradient(0, judgeY - (judgeY - hudH) * 0.35, 0, judgeY);
      floor.addColorStop(0, 'rgba(120,110,255,0)');
      floor.addColorStop(1, 'rgba(150,120,255,0.16)');
      const line = g.createLinearGradient(this.cols[0].x, 0, this.cols.at(-1).x + this.cols.at(-1).w, 0);
      line.addColorStop(0, this._laneColor(0, 70));
      line.addColorStop(1, this._laneColor(this.lanes - 1, 70));
      const hud = g.createLinearGradient(0, 0, 0, hudH);
      hud.addColorStop(0, 'rgba(8,10,26,0.96)');
      hud.addColorStop(1, 'rgba(8,10,26,0.7)');
      const pgr = g.createLinearGradient(0, 0, W, 0);
      pgr.addColorStop(0, '#6ee7ff');
      pgr.addColorStop(0.5, '#8a7dff');
      pgr.addColorStop(1, '#ff7ad9');
      const road = g.createLinearGradient(0, this.topY, 0, judgeY);
      road.addColorStop(0, 'rgba(30,24,80,0.35)');
      road.addColorStop(1, 'rgba(40,30,100,0.75)');
      this._bgCache = { bg, floor, line, hud, pgr, road };
    }
    return this._bgCache;
  }

  _drawKeys(g, t) {
    const { W, H, judgeY, hudH } = this;
    const C = this._keysBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // 무대 조명 두 줄기 (천천히 흔들림)
    for (const side of [0, 1]) {
      const sw = Math.sin(t * 0.45 + side * 2) * W * 0.08;
      const x0 = side ? W * 0.82 : W * 0.18;
      const gr = g.createLinearGradient(0, 0, 0, judgeY);
      gr.addColorStop(0, side ? 'rgba(255,140,220,0.16)' : 'rgba(110,200,255,0.16)');
      gr.addColorStop(1, 'rgba(140,120,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0 - 14, 0);
      g.lineTo(x0 + 14, 0);
      g.lineTo(x0 + sw + W * 0.17, judgeY);
      g.lineTo(x0 + sw - W * 0.17, judgeY);
      g.closePath();
      g.fill();
    }
    // 반짝이는 작은 별
    for (let i = 0; i < 26; i++) {
      const x = ((i * 0.618 + 0.05) % 1) * W;
      const y = hudH + (((i * 0.377 + 0.1) % 1) * (judgeY - hudH) - t * (6 + (i % 4) * 3) + 4000) % (judgeY - hudH);
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1.5 + (i % 5) * 0.4) + i));
      g.fillStyle = `rgba(220,225,255,${a})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    // 원근 길 (어두운 유리) + 가장자리 빛
    const sF = this.sFar;
    this._trap(g, this.roadX0, this.roadX1, sF, 1);
    g.fillStyle = C.road;
    g.fill();
    // 흰 건반 칸 나눔 선 (도 자리는 조금 밝게)
    g.lineWidth = 1;
    this.cols.forEach((c, i) => {
      if (!c.white || i === 0) return;
      g.strokeStyle = pc(this.keys[i].midi) === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      g.beginPath();
      g.moveTo(this._px(c.x, sF), this._py(sF));
      g.lineTo(c.x, judgeY);
      g.stroke();
    });
    // 박마다 가로줄 (흘러오는 느낌)
    for (let k = Math.ceil(this.bNow); k < this.bNow + this.VB; k++) {
      const d = k - this.bNow;
      const s = this._s(d);
      const y = this._py(s);
      g.fillStyle = `rgba(200,190,255,${(k % 4 === 0 ? 0.16 : 0.07) * Math.min(1, (this.VB - d) / 0.8)})`;
      g.fillRect(this._px(this.roadX0, s), y, this._px(this.roadX1, s) - this._px(this.roadX0, s), Math.max(1, 2 * s));
    }
    g.fillStyle = C.floor;
    g.fillRect(0, judgeY - (judgeY - hudH) * 0.35, W, (judgeY - hudH) * 0.35);
    // 길 가장자리 빛
    for (const [x, col] of [
      [this.roadX0, this._laneColor(0, 70, 0.8)],
      [this.roadX1, this._laneColor(this.lanes - 1, 70, 0.8)],
    ]) {
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(this._px(x, sF), this._py(sF));
      g.lineTo(x, judgeY);
      g.stroke();
    }
    // 누른 건반 빛 기둥 (눌림 값 따라 부드럽게)
    for (let i = 0; i < this.lanes; i++) if (this.press[i] > 0.01) this._column(g, i, this.press[i]);
    // 다가오는 빛 막대 (원근: 멀리선 작고 좁게, 글자 없음)
    g.save();
    g.beginPath();
    g.rect(0, hudH, W, judgeY - hudH);
    g.clip();
    for (const n of this.notes) {
      let dH = n.beat - this.bNow;
      if (dH > this.VB) break;
      if (n.miss && t - n.missAt > 0.45) continue;
      const fade = n.hit && !n.holding ? 1 - ease((t - (n.releasedAt ?? n.hitAt)) / 0.22) : 1;
      if (fade <= 0) continue;
      let dT = dH + Math.max(0.2, n.lenB - 0.06);
      if (n.hit) dH = Math.max(0, dH);
      if (dT <= dH + 0.02) continue;
      dT = Math.min(dT, this.VB);
      const c = this.cols[n.lane];
      const pad = c.white ? Math.max(3, c.w * 0.14) : 2;
      const xa = c.x + pad;
      const xb = c.x + c.w - pad;
      const sH = this._s(dH);
      const sT = this._s(dT);
      const far = Math.min(1, (this.VB - dH) / 0.7);
      const L = n.miss ? 0.3 * (1 - ease((t - n.missAt) / 0.45)) : 1;
      g.globalAlpha = L * fade * far;
      // 바깥 빛
      this._trap(g, xa - 4, xb + 4, sT, sH);
      g.fillStyle = this._laneColor(n.lane, 62, n.holding ? 0.38 : 0.2);
      g.fill();
      // 몸통: 먼 쪽은 진하게, 건반 쪽은 밝게
      const yT = this._py(sT);
      const yH = this._py(sH);
      const gr = g.createLinearGradient(0, yT, 0, yH);
      gr.addColorStop(0, this._laneColor(n.lane, c.white ? 48 : 42, 0.85));
      gr.addColorStop(1, this._laneColor(n.lane, c.white ? 74 : 66));
      this._trap(g, xa, xb, sT, sH);
      g.fillStyle = gr;
      g.fill();
      // 가운데 빛 줄
      const mw = (xb - xa) * 0.14;
      const mx = (xa + xb) / 2;
      this._trap(g, mx - mw, mx + mw, sT, sH);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fill();
      // 머리(건반 쪽 끝) 하얀 줄
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(this._px(xa, sH) + 1, yH - Math.max(2, 4 * sH), this._px(xb, sH) - this._px(xa, sH) - 2, Math.max(1.5, 3 * sH));
      if (n.holding) {
        const pulse = 0.18 + 0.12 * Math.sin(t * 14);
        this._trap(g, xa, xb, sT, sH);
        g.fillStyle = `rgba(255,255,255,${pulse})`;
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
    this._keyboard(g, t);
    // 판정선: 무지개 빛 줄
    g.fillStyle = 'rgba(180,160,255,0.22)';
    g.fillRect(this.cols[0].x, judgeY - 6, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 6);
    g.fillStyle = C.line;
    g.fillRect(this.cols[0].x, judgeY - 2.5, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 2.5);
    this._keysHud(g, t);
  }

  _column(g, lane, a) {
    const c = this.cols[lane];
    const sTop = this._s(this.VB * 0.55);
    const top = this._py(sTop);
    const gr = g.createLinearGradient(0, top, 0, this.judgeY);
    gr.addColorStop(0, this._laneColor(lane, 65, 0));
    gr.addColorStop(1, this._laneColor(lane, 65, a * 0.42));
    this._trap(g, c.x, c.x + c.w, sTop, 1);
    g.fillStyle = gr;
    g.fill();
  }

  /** 진짜 피아노 같은 건반: 검은 건반 바닥 + 빨간 펠트 + 상아빛 흰 건반 + 유광 검은 건반 */
  /** 꾹 누르는 음의 진행 0~1 (건반마다) — 건반 위에 게이지로 */
  _holdGauge(t) {
    const m = new Map();
    for (const p of this.pressed.values()) {
      const n = p.note;
      if (n && n.holding && n.dur >= 0.4) m.set(n.lane, Math.max(0, Math.min(1, (t - n.t) / n.dur)));
    }
    return m;
  }

  _keyboard(g, t) {
    const { kbY, kbH, H } = this;
    const gauge = this._holdGauge(t);
    const x0 = this.cols[0].x - 6;
    const x1 = this.cols.at(-1).x + this.cols.at(-1).w + 6;
    // 건반 바닥(검은 칠)
    const base = g.createLinearGradient(0, kbY - 6, 0, H);
    base.addColorStop(0, '#1a1822');
    base.addColorStop(1, '#050408');
    g.fillStyle = base;
    rr(g, x0, kbY - 6, x1 - x0, H - kbY + 6, 10);
    g.fill();
    const lip = Math.max(4, kbH * 0.05);
    const label = Math.min(this.keyW * 0.3, kbH * 0.12);
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      const p = this.press[i];
      const dy = lip * 0.8 * p;
      const x = c.x + 1.5;
      const w = c.w - 3;
      const top = kbY + 2;
      const hh = kbH - 2;
      // 아래 두께(앞면)
      g.fillStyle = p > 0.02 ? mix('#c9c4d4', '#a9a3b8', p) : '#c9c4d4';
      rr(g, x, top + lip, w, hh - lip, 7);
      g.fill();
      // 윗면
      const gr = g.createLinearGradient(0, top + dy, 0, top + dy + hh - lip);
      gr.addColorStop(0, '#dcd8e4');
      gr.addColorStop(0.12, '#fbfaff');
      gr.addColorStop(1, '#efedf5');
      g.fillStyle = gr;
      rr(g, x, top + dy, w, hh - lip, 7);
      g.fill();
      if (p > 0.02) {
        const tg = g.createLinearGradient(0, top + dy, 0, top + dy + hh - lip);
        tg.addColorStop(0, this._laneColor(i, 70, 0.7 * p));
        tg.addColorStop(1, this._laneColor(i, 80, 0.15 * p));
        g.fillStyle = tg;
        rr(g, x, top + dy, w, hh - lip, 7);
        g.fill();
      }
      if (gauge.has(i)) this._gauge(g, i, x + 3, top + dy + 3, w - 6, hh - lip - 6, gauge.get(i), t);
      g.fillStyle = 'rgba(150,140,170,0.75)';
      g.font = font(label);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(p2Solfa(this.keys[i].midi), x + w / 2, top + dy + hh - lip - label * 0.6);
    });
    this.cols.forEach((c, i) => {
      if (c.white) return;
      const p = this.press[i];
      const dy = 3 * p;
      const bl = Math.max(4, this.blackH * 0.09);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      rr(g, c.x + 2, kbY, c.w, this.blackH + 3, 5);
      g.fill();
      g.fillStyle = '#121117';
      rr(g, c.x, kbY - 1, c.w, this.blackH, 5);
      g.fill();
      const gr = g.createLinearGradient(c.x, 0, c.x + c.w, 0);
      gr.addColorStop(0, '#2c2a35');
      gr.addColorStop(0.5, '#44414f');
      gr.addColorStop(1, '#25232d');
      g.fillStyle = gr;
      rr(g, c.x + 1.5, kbY - 1 + dy, c.w - 3, this.blackH - bl, 4);
      g.fill();
      if (p > 0.02) {
        g.fillStyle = this._laneColor(i, 60, 0.55 * p);
        rr(g, c.x + 1.5, kbY - 1 + dy, c.w - 3, this.blackH - bl, 4);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.22)';
      rr(g, c.x + c.w * 0.25, kbY + 3 + dy, c.w * 0.5, this.blackH * 0.45, 2);
      g.fill();
      if (gauge.has(i)) this._gauge(g, i, c.x + 3, kbY + 1 + dy, c.w - 6, this.blackH - bl - 4, gauge.get(i), t);
    });
    // 빨간 펠트 (건반 위 가장자리)
    g.fillStyle = '#9e1430';
    g.fillRect(x0 + 4, kbY - 1, x1 - x0 - 8, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x0 + 4, kbY + 2, x1 - x0 - 8, 2);
  }

  /** 꾹 게이지: 건반 아래에서 위로 차오름 + 위 끝 빛 줄 */
  _gauge(g, lane, x, y, w, h, k, t) {
    const fh = h * k;
    g.save();
    rr(g, x, y, w, h, 5);
    g.clip();
    g.fillStyle = 'rgba(20,16,40,0.18)';
    g.fillRect(x, y, w, h);
    const gr = g.createLinearGradient(0, y + h, 0, y + h - Math.max(10, fh));
    gr.addColorStop(0, this._laneColor(lane, 52, 0.95));
    gr.addColorStop(1, this._laneColor(lane, 72, 0.95));
    g.fillStyle = gr;
    g.fillRect(x, y + h - fh, w, fh);
    g.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * Math.sin(t * 16)})`;
    g.fillRect(x, y + h - fh - 1.5, w, 3);
    g.restore();
  }

  _keysHud(g, t) {
    const { W, hudH } = this;
    const C = this._keysBg(g);
    g.fillStyle = C.hud;
    g.fillRect(0, 0, W, hudH);
    const midY = hudH * 0.5;
    const imgs = buddyImgs || {};
    const size = hudH * 1.05;
    const pose = (w) => {
      const m = this.mood[w];
      return m.until > t ? m.pose : 'idle';
    };
    const bob = (w) => {
      const p = pose(w);
      if (p === 'cheer') return -6 * Math.abs(Math.sin(t * 12));
      if (p === 'hit') return -3 * (1 - ease((t - (this.mood[w].until - 0.22)) / 0.22));
      return Math.sin(t * 3 + (w === 'kong' ? 0 : 1.5)) * 1.5;
    };
    const kong = imgs[`kong_${pose('kong')}`];
    const jjak = imgs[`jjak_${pose('jjak')}`];
    const bx0 = 70;
    if (kong && kong.complete && kong.naturalWidth) g.drawImage(kong, bx0, midY - size / 2 + bob('kong'), size, size);
    if (jjak && jjak.complete && jjak.naturalWidth) g.drawImage(jjak, W - 150 - size, midY - size / 2 + bob('jjak'), size, size);
    const px0 = bx0 + size + 14;
    const px1 = W - 150 - size - 14;
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    g.fillStyle = 'rgba(255,255,255,0.12)';
    rr(g, px0, midY - 5, px1 - px0, 10, 5);
    g.fill();
    g.fillStyle = C.pgr;
    rr(g, px0, midY - 5, Math.max(10, (px1 - px0) * p), 10, 5);
    g.fill();
    this._drawCombo(g, t, (px0 + px1) / 2, midY + 9, Math.min(18, hudH * 0.3), '#0b0d1f');
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.font = font(Math.min(30, hudH * 0.48));
    g.fillText(Math.round(this.shown).toLocaleString(), W - 16, midY - (this.level.fast ? 7 : 0));
    this._drawSpeed(g, W - 16, midY + hudH * 0.27, Math.min(14, hudH * 0.24), '#ffd36b');
  }

  // ======== 효과 · 글자 ========
  _drawFx(g, t) {
    const keys = this.style === 'keys';
    for (const r of this.fx.rings) {
      const k = (t - r.at) / 0.4;
      if (k < 0 || k > 1) continue;
      const e = ease(k);
      g.globalAlpha = (1 - e) * 0.85;
      g.strokeStyle = r.color;
      g.lineWidth = 4 * (1 - e) + 1;
      const R = (keys ? this.keyW * 0.34 : this.laneW * 0.26) * (0.5 + e * 1.1);
      g.beginPath();
      g.ellipse(r.x, r.y, R, R * (keys ? 0.45 : 0.8), 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of this.fx.parts) {
      const d = t - p.at;
      if (d < 0 || d > p.life) continue;
      const k = d / p.life;
      const x = p.x + p.vx * d;
      const y = p.y + p.vy * d + 160 * d * d;
      g.globalAlpha = (1 - ease(k)) * 0.9;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(x, y, p.s * (1 - k * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 글자: PERFECT · GREAT · MISS(놓침·헛침) · 꾹 보너스(+점수)
    const seen = new Set();
    for (let i = this.fx.pops.length - 1; i >= 0; i--) {
      const p = this.fx.pops[i];
      // 타일은 줄마다 하나, 건반은 줄이 좁아서 화면에 하나만 (보너스는 따로)
      const bonus = p.kind === 'bonus';
      const key = keys ? (bonus ? 'b' : 'k') : bonus ? 'b' + p.lane : p.lane;
      if (seen.has(key)) continue;
      seen.add(key);
      const life = bonus ? 0.8 : p.kind === 'perfect' || p.kind === 'great' ? 0.45 : 0.55;
      const k = (t - p.at) / life;
      if (k < 0 || k > 1) continue;
      let cx = this._laneX(p.lane);
      const name = bonus ? `+${p.v.toLocaleString()}` : p.kind === 'perfect' ? 'PERFECT' : p.kind === 'great' ? 'GREAT' : 'MISS';
      const pop = k < 0.2 ? 0.7 + 0.4 * ease(k / 0.2) : 1.1 - 0.1 * ease((k - 0.2) / 0.8);
      const base = keys ? Math.min(this.H * 0.07, 28) : Math.min(this.laneW * (name.length > 5 ? 0.2 : 0.26), 26);
      const size = base * pop;
      if (keys) cx = Math.max(size * 3, Math.min(this.W - size * 3, cx));
      else cx = Math.max(size * 2.2, Math.min(this.W - size * 2.2, cx));
      const y = keys
        ? (bonus ? this.judgeY - this.H * 0.2 : this.judgeY - this.H * 0.1) - ease(k) * (bonus ? 30 : 12)
        : p.kind === 'miss' ? this.H - this.H * 0.06 - ease(k) * 16 : this.judgeY - this.tileH - this.H * 0.035 - ease(k) * (bonus ? 34 : 16);
      g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(3, size * 0.24);
      g.strokeStyle = keys ? 'rgba(8,10,26,0.9)' : '#ffffff';
      g.strokeText(name, cx, y);
      if (p.kind === 'perfect') {
        const tw = g.measureText(name).width / 2;
        const gr = g.createLinearGradient(cx - tw, y - size / 2, cx + tw, y + size / 2);
        gr.addColorStop(0, '#ffd24a');
        gr.addColorStop(0.5, '#ff8a3d');
        gr.addColorStop(1, '#ff5fa2');
        g.fillStyle = gr;
      } else g.fillStyle = bonus ? '#ff5fa2' : p.kind === 'great' ? '#3d9bff' : p.kind === 'wrong' ? '#ff4d6d' : '#9a94ae';
      g.fillText(name, cx, y);
    }
    g.globalAlpha = 1;
  }
}

// ---------- 그리기 도우미 ----------
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function rgbOf(c) {
  if (c[0] === '#') {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = c.match(/\d+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
}
function mix(a, b, k) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}

return { P2_SONGS, P2_SOLFA, P2_HIT_WIN, P2_PERFECT, P2_BIAS_MAX, p2LearnBias, P2_FAST_MAX, p2Level, p2FastMult, p2Notes, p2Judge, p2TileLanes, p2TileBeats, p2Keys, p2Solfa, p2Stars, p2Grade, PianoPreview };
})();

// ---- shop.js ----
const __m_shop = (() => {
// 🛒 상점 (2026-11-22): 코인으로 꾸미기를 삼. 서버(handler)와 폰(main)이 같은 가격표를 씀
//   11-22 밤 개편(사용자 '이미 있는 배경·드럼 말고 새로 만들어야 희귀성 · 색만 바뀌어서 안 사고 싶음'):
//   맵 배경·맵 드럼·색만 바꾸는 콩 색은 무료로 돌리고, 상점엔 상점에서만 파는 새 것만.
//   콩 스킨 = 색 + 질감 + 꼬리·반짝이 효과(render.js NOTE_PALETTES fx), 배경 = 새 그림(themes.js img), 드럼 = 새 마감(themes.js SHOP_KITS)

//   id = 'bg:sakura' · 'kit:goldkit' · 'notes:flame' · 'bg:photo' · 'ui:live'(화면 스타일 세트) (설정 → 꾸미기의 decoOwned 와 같은 모양)

/** 맵 8개 (배경·드럼 세트로 고를 수 있는 것, 무료) */
const DECO_THEMES = ['sunset', 'city', 'hall', 'void', 'lava', 'aurora', 'xmas', 'space'];
/** 색만 바꾸는 콩 색 (무료) */
const NOTE_FREE = ['candy', 'neon', 'ocean', 'fire', 'mono'];

/** 상점 물건: [id, 값, 등급] — 등급 rare 레어 · epic 에픽 · legend 전설 */
const SHOP_ITEMS = [
  // 🎤 세트 (2026-11-22, 사용자 요청: 리듬게임 라이브 화면 스타일 세트) = 화면 스타일(render.js live) + 세트 무대 · 11-23 1만 → 2만 · 11-24 2만5천
  ['ui:live', 25000, 'epic'],
  // 🥇 시즌 1 한정 세트 (2026-11-23 사용자 '시즌1 때만, 1 을 강조, 세트로, 1111') = 금빛 「1」 콩 + 시즌 1 무대 + 황금 드럼. 시즌 1 끝나면 못 삼(LIMITED)
  ['ui:s1', 1111, 'limited'], // 11-24 사용자: 등급 「한정」, 11/27 까지 팖
  // 2026-11-24 사용자: 레어 5천 · 에픽 1만 · 전설 4만 (시즌 1 세트·라이브 세트만 따로)
  ['notes:galaxy', 40000, 'legend'],
  ['notes:gold', 40000, 'legend'],
  ['notes:cyber', 10000, 'epic'],
  ['notes:flame', 5000, 'rare'],
  ['notes:ice', 5000, 'rare'],
  ['notes:heart', 5000, 'rare'],
  ['bg:palace', 10000, 'epic'],
  ['bg:cybercity', 10000, 'epic'],
  ['bg:sakura', 5000, 'rare'],
  ['bg:abyss', 5000, 'rare'],
  ['bg:photo', 5000, 'rare'],
  ['kit:goldkit', 10000, 'epic'],
  ['kit:neonkit', 5000, 'rare'],
  ['kit:crystal', 5000, 'rare'],
  ['kit:rainbow', 5000, 'rare'],
];
/** 기간 한정: 이 시각(ms)이 지나면 못 삼 (산 사람은 계속 씀) */
//   🥇 시즌 1 세트: 11-24 사용자 '27일까지' → 11/27 23:59:59 KST (시즌 1 은 11/26 끝)
const S1_SALE_END = Date.UTC(2026, 10, 27, 14, 59, 59);
const LIMITED = { 'ui:s1': S1_SALE_END };
/** 지금 살 수 있나 (한정 물건 기간 확인) */
const onSale = (id, now = Date.now()) => !(LIMITED[id] && now > LIMITED[id]);
const PRICE = new Map(SHOP_ITEMS.map(([id, p]) => [id, p]));
const RARITY = Object.fromEntries(SHOP_ITEMS.map(([id, , r]) => [id, r]));
const RARITY_NAME = { rare: '레어', epic: '에픽', legend: '전설', limited: '한정' };

/** 이 물건 값 (팔지 않는 것이면 null) */
function priceOf(id) {
  return PRICE.get(String(id || '')) ?? null;
}

/** 예전에 팔던 것(지금은 무료) 값 — 산 사람에게 돌려줌 */
function legacyPrice(id) {
  const [type, key] = String(id || '').split(':');
  if (type === 'notes' && NOTE_FREE.includes(key)) return 1000;
  if (type === 'bg' && DECO_THEMES.includes(key)) return 1500;
  if (type === 'kit' && DECO_THEMES.includes(key)) return 2000;
  return 0;
}
/** 산 목록에서 예전 물건 빼고 돌려줄 코인 → { refund, keep } */
function legacyRefund(list) {
  const keep = [];
  let refund = 0;
  for (const x of Array.isArray(list) ? list : []) {
    const p = legacyPrice(x);
    if (p) refund += p;
    else keep.push(x);
  }
  return { refund, keep };
}

/** 서버가 받은 산 목록 정리 (모르는 것·겹친 것 빼기) */
function cleanOwned(list) {
  return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string' && priceOf(x) != null))] : [];
}

/**
 * 사기: 지갑 { coins, owned } → { ok, wallet, error }
 *   이미 있으면 ok(돈 안 냄), 모자라면 not_enough
 */
function buyItem(w, id, now = Date.now()) {
  const price = priceOf(id);
  if (price == null) return { ok: false, error: 'bad_item', wallet: w };
  const owned = cleanOwned(w.owned);
  if (owned.includes(id)) return { ok: true, already: true, wallet: { ...w, owned } };
  if (!onSale(id, now)) return { ok: false, error: 'season_over', wallet: { ...w, owned } };
  if ((w.coins || 0) < price) return { ok: false, error: 'not_enough', wallet: { ...w, owned } };
  return { ok: true, wallet: { ...w, coins: w.coins - price, owned: [...owned, id] } };
}

// ---------------- 🏆 시즌 보상 (2026-11-22, 사용자 결정) ----------------
//   1등 10만 · 2등 7만 · 3등 5만 · 10등까지 1만 · 50등까지 5천 · 100등까지 3천
//   단계 총합·무제한 총합 둘 다 보고, 한 사람이 둘 다 들면 큰 것 하나만
function seasonReward(rank) {
  if (rank === 1) return 100000;
  if (rank === 2) return 70000;
  if (rank === 3) return 50000;
  if (rank <= 10) return 10000;
  if (rank <= 50) return 5000;
  if (rank <= 100) return 3000;
  return 0;
}
/** boards = { stage: [{igsid, rank}], endless: [...] } → [{ igsid, coins, board, rank }] 사람마다 가장 큰 것 하나 */
function seasonRewards(boards) {
  const best = new Map();
  for (const board of ['stage', 'endless']) {
    for (const r of boards[board] || []) {
      const coins = seasonReward(r.rank);
      if (!coins || !r.igsid) continue;
      const o = best.get(r.igsid);
      if (!o || coins > o.coins) best.set(r.igsid, { igsid: r.igsid, coins, board, rank: r.rank });
    }
  }
  return [...best.values()];
}

return { DECO_THEMES, NOTE_FREE, SHOP_ITEMS, S1_SALE_END, LIMITED, onSale, RARITY, RARITY_NAME, priceOf, legacyPrice, legacyRefund, cleanOwned, buyItem, seasonReward, seasonRewards };
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
  } else if (finish === 'rainbow') {
    // 🌈 상점 무지개 드럼: 가로로 무지개 + 위에 광택
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    ['#FF4D6D', '#FF9F1C', '#FFE14D', '#3FD6A0', '#3FA9FF', '#9B6BFF', '#FF4D9E'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    g.fillStyle = gr;
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
//   1~3 노을 피크닉 · 4~6 네온 시티 · 7~9 황금 콘서트홀 · 10~12 블랙 스테이지 · 13~15 용암 보스전 · 16~17 오로라 설원
//   크리스마스 마을 = 🎄 크리스마스 이벤트 곡(내부 번호 19·21·22)
//   그리그 무제한·레벨업 챌린지는 우주 무대에서 시작해 Lv 이 오를 때마다 맵이 바뀜(THEME_CYCLE).
//   단계별 무제한(e5 등)은 그 단계 맵 그대로.
//
// kit: 드럼 세트 마감. shell = [밝은, 기본, 어두운] 색, finish = gloss | sparkle | wood | fade | metal
//   hw = 금속 부품 색(chrome | gold | black), cym = 심벌 색(gold | silver | dark)

const THEMES = {
  sunset: {
    key: 'sunset',
    name: '노을 피크닉',
    icon: 'sunset',
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
    icon: 'city',
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
    icon: 'hall',
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
    icon: 'spot',
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
    icon: 'volcano',
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
    icon: 'moon',
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
  xmas: {
    key: 'xmas',
    name: '크리스마스 마을',
    icon: 'tree',
    sky: ['#06102A', '#132A55', '#3A4E86'],
    ground: ['#E9F2FA', '#7C93AE'],
    glow: '255,214,140',
    hot: '255,90,90',
    laneBase: 'rgba(14,20,44,0.74)',
    laneTint: 0.75,
    rail: null,
    beat: '255,240,220',
    fog: '60,40,90',
    spots: ['255,90,90', '120,255,160', '255,214,120', '255,90,90'],
    particle: 'snow',
    kit: {
      shell: ['#FF8A8A', '#D7263D', '#6E0F1C'],
      finish: 'sparkle',
      sparkle: '#FFFFFF',
      snare: ['#C8FFD8', '#2FAF5E', '#0E5A2C'],
      snareFinish: 'gloss',
      hoop: ['#FFF4C2', '#E0B84A', '#7A5A14'],
      inlay: '#FFD84A',
      hw: 'gold',
      head: '#FFF8F0',
      emblem: '#D7263D',
      emblemText: '#0E5A2C',
      cym: 'gold',
    },
  },
  // 📷 내 사진 배경 (상점에서 장착). 하늘·땅 대신 사진을 깔고, 길은 반투명이라 사진이 비침. 단계 묶음엔 안 씀
  photo: {
    key: 'photo',
    name: '내 사진',
    icon: 'spot',
    sky: ['#0A0814', '#14102A', '#221A40'],
    ground: ['#120E22', '#06040C'],
    glow: '255,240,220',
    hot: '255,200,140',
    laneBase: 'rgba(12,10,24,0.34)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.2,
    spots: ['255,240,220', '200,220,255', '255,200,230', '220,255,240'],
    particle: 'gold',
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
  // 🛒 상점 전용 배경 (2026-11-22, ElevenLabs 그림 assets/bg/sakura.webp). 사진 배경처럼 그림을 깔고 길은 반투명
  sakura: {
    key: 'sakura',
    name: '벚꽃 콘서트',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/sakura.webp',
    imgDim: 0.28,
    sky: ['#0A0814', '#14102A', '#221A40'],
    ground: ['#120E22', '#06040C'],
    glow: '255,190,220',
    hot: '255,130,180',
    laneBase: 'rgba(12,10,24,0.38)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['255,180,210', '255,220,160', '255,140,190', '255,240,250'],
    particle: 'petal',
    kit: {
      shell: ['#FFD6E6', '#FF8FB8', '#C2477A'],
      finish: 'sparkle',
      sparkle: '#FFFFFF',
      snare: ['#FFFFFF', '#FFD0E2', '#D9819F'],
      snareFinish: 'gloss',
      hoop: ['#FFFFFF', '#F2D7E2', '#B58A9C'],
      inlay: '#FF8FB8',
      hw: 'chrome',
      head: '#FFF8FB',
      emblem: '#FF8FB8',
      emblemText: '#C2477A',
      cym: 'gold',
    },
  },
  // 🛒 상점 전용 배경 (2026-11-22, ElevenLabs 그림 assets/bg/cybercity.webp). 사진 배경처럼 그림을 깔고 길은 반투명
  cybercity: {
    key: 'cybercity',
    name: '사이버 시티',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/cybercity.webp',
    imgDim: 0.28,
    sky: ['#0A0814', '#14102A', '#221A40'],
    ground: ['#120E22', '#06040C'],
    glow: '200,120,255',
    hot: '255,60,220',
    laneBase: 'rgba(12,10,24,0.38)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['255,60,220', '60,230,255', '160,90,255', '255,255,255'],
    particle: 'neon',
    kit: {
      shell: ['#5A5E6A', '#14141C', '#000000'],
      finish: 'sparkle',
      sparkle: '#FF3CDC',
      snare: ['#C9FBFF', '#38E1FF', '#0B7A99'],
      snareFinish: 'metal',
      hoop: ['#FFB8F4', '#FF3CDC', '#8A0E74'],
      inlay: '#38E1FF',
      hw: 'black',
      head: '#E9FDFF',
      emblem: '#FF3CDC',
      emblemText: '#38E1FF',
      cym: 'dark',
    },
  },
  // 🛒 상점 전용 배경 (2026-11-22, ElevenLabs 그림 assets/bg/palace.webp). 사진 배경처럼 그림을 깔고 길은 반투명
  palace: {
    key: 'palace',
    name: '황금 궁전',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/palace.webp',
    imgDim: 0.28,
    sky: ['#0A0814', '#14102A', '#221A40'],
    ground: ['#120E22', '#06040C'],
    glow: '255,220,140',
    hot: '255,190,80',
    laneBase: 'rgba(12,10,24,0.38)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['255,215,120', '255,240,190', '255,180,90', '255,250,230'],
    particle: 'gold',
    kit: {
      shell: ['#FFF1B8', '#E2B23C', '#7A5512'],
      finish: 'metal',
      snare: ['#FFFFFF', '#F2E2B0', '#B0903A'],
      snareFinish: 'metal',
      hoop: ['#FFF4C2', '#E0B84A', '#7A5A14'],
      inlay: '#B8202E',
      hw: 'gold',
      head: '#FFF8EC',
      emblem: '#B8202E',
      emblemText: '#7A5512',
      cym: 'gold',
    },
  },
  // 🎤 라이브 스테이지 세트 무대 (2026-11-22, ElevenLabs 그림 assets/bg/livestage.webp, 사람·글자 없는 빈 공연장).
  //   따로 팔지 않음: 세트(ui:live)를 쓰고 배경이 '단계별'이면 깔림 (render.js setTheme)
  livestage: {
    key: 'livestage',
    name: '라이브 스테이지',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/livestage.webp',
    imgDim: 0.3,
    sky: ['#0A0A2A', '#1A1450', '#2A1E66'],
    ground: ['#120E30', '#06040C'],
    glow: '160,220,255',
    hot: '255,140,220',
    laneBase: 'rgba(12,10,30,0.4)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['120,230,255', '255,140,220', '190,160,255', '255,240,170'],
    particle: 'neon',
    kit: {
      shell: ['#E8F6FF', '#7FC8FF', '#2A4E9E'],
      finish: 'gloss',
      snare: ['#FFFFFF', '#FFC2E6', '#C2508E'],
      snareFinish: 'metal',
      hoop: ['#FFFFFF', '#B8E8FF', '#4A7ABF'],
      inlay: '#FF8AD8',
      hw: 'chrome',
      head: '#FFFFFF',
      emblem: '#7FC8FF',
      emblemText: '#FF8AD8',
      cym: 'gold',
    },
  },
  // 🥇 시즌 1 세트 무대 (2026-11-23, ElevenLabs 그림 assets/bg/s1stage.webp — 남색 공연장에 커다란 금빛 「1」). 따로 안 팖: 세트(ui:s1)를 끼면 깔림
  s1stage: {
    key: 's1stage',
    name: '시즌 1 무대',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/s1stage.webp',
    imgDim: 0.3,
    sky: ['#070A24', '#121A4A', '#2B3A8C'],
    ground: ['#0C1036', '#05061A'],
    glow: '255,215,90',
    hot: '255,190,60',
    laneBase: 'rgba(10,12,40,0.45)',
    laneTint: 0.85,
    rail: null,
    beat: '255,225,140',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['255,215,90', '255,255,255', '150,170,255', '255,190,60'],
    particle: 'neon',
    kit: {
      shell: ['#FFF3B0', '#FFD23F', '#B07A00'],
      finish: 'gloss',
      snare: ['#FFFFFF', '#FFE07A', '#B8860B'],
      snareFinish: 'metal',
      hoop: ['#FFFFFF', '#FFE9A8', '#B8860B'],
      inlay: '#2B3A8C',
      hw: 'chrome',
      head: '#FFFFFF',
      emblem: '#2B3A8C',
      emblemText: '#FFD23F',
      cym: 'gold',
    },
  },
  // 🛒 상점 전용 배경 (2026-11-22, ElevenLabs 그림 assets/bg/abyss.webp). 사진 배경처럼 그림을 깔고 길은 반투명
  abyss: {
    key: 'abyss',
    name: '심해 수정 동굴',
    icon: 'spot',
    shop: true,
    img: 'assets/bg/abyss.webp',
    imgDim: 0.28,
    sky: ['#0A0814', '#14102A', '#221A40'],
    ground: ['#120E22', '#06040C'],
    glow: '100,230,240',
    hot: '160,120,255',
    laneBase: 'rgba(12,10,24,0.38)',
    laneTint: 0.85,
    rail: null,
    beat: '255,255,255',
    fog: '0,0,0',
    fogA: 0.15,
    spots: ['80,240,230', '160,120,255', '120,200,255', '220,255,255'],
    particle: 'haze',
    kit: {
      shell: ['#B8FFF6', '#2EC4C0', '#0B5E6A'],
      finish: 'sparkle',
      sparkle: '#E8FFFF',
      snare: ['#E8DEFF', '#9B7BFF', '#4A2E9E'],
      snareFinish: 'gloss',
      hoop: ['#E6FFFD', '#9EDBD8', '#4F8A88'],
      inlay: '#9B7BFF',
      hw: 'chrome',
      head: '#F2FFFE',
      emblem: '#2EC4C0',
      emblemText: '#0B5E6A',
      cym: 'silver',
    },
  },
  space: {
    key: 'space',
    name: '우주 무대',
    icon: 'planet',
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

/** 🥁 상점 전용 드럼 세트 (2026-11-22). 설정 kitPick 이 이 키면 맵 드럼 대신 이것 */
const SHOP_KITS = {
  goldkit: {
    name: '👑 황금 드럼',
    kit: {
      shell: ['#FFF6C8', '#F2C232', '#8A5A08'],
      finish: 'metal',
      sparkle: '#FFFFFF',
      snare: ['#FFF6C8', '#F2C232', '#8A5A08'],
      snareFinish: 'metal',
      hoop: ['#FFFBE0', '#F5D25A', '#9A6A10'],
      inlay: '#FFF1B8',
      hw: 'gold',
      head: '#FFFDF2',
      emblem: '#8A5A08',
      emblemText: '#FFF1B8',
      cym: 'gold',
    },
  },
  neonkit: {
    name: '⚡ 블랙 네온',
    kit: {
      shell: ['#3A3D4A', '#0B0B12', '#000000'],
      finish: 'sparkle',
      sparkle: '#20F0C8',
      snare: ['#3A3D4A', '#0B0B12', '#000000'],
      snareFinish: 'gloss',
      hoop: ['#B6FFF3', '#20F0C8', '#077A63'],
      inlay: '#FF2BD6',
      hw: 'black',
      head: '#F0FFFB',
      emblem: '#20F0C8',
      emblemText: '#FF2BD6',
      cym: 'dark',
    },
  },
  crystal: {
    name: '💎 크리스탈',
    kit: {
      shell: ['#FFFFFF', '#BFEFFF', '#5AA8D6'],
      finish: 'sparkle',
      sparkle: '#FFFFFF',
      snare: ['#FFFFFF', '#D8F4FF', '#7FBCE0'],
      snareFinish: 'metal',
      hoop: ['#FFFFFF', '#DDEFFA', '#8AB4CF'],
      inlay: '#7FD8FF',
      hw: 'chrome',
      head: '#FFFFFF',
      emblem: '#7FD8FF',
      emblemText: '#2F7FB0',
      cym: 'silver',
    },
  },
  rainbow: {
    name: '🌈 무지개',
    kit: {
      shell: ['#FF5E7E', '#FFD93A', '#3FD6A0'],
      finish: 'rainbow',
      sparkle: '#FFFFFF',
      snare: ['#FFFFFF', '#E9E4FF', '#A99FD6'],
      snareFinish: 'gloss',
      hoop: ['#FFFFFF', '#E3D8F0', '#9A8CB0'],
      inlay: '#B26BFF',
      hw: 'chrome',
      head: '#FFFFFF',
      emblem: '#B26BFF',
      emblemText: '#5A2E9E',
      cym: 'gold',
    },
  },
};

const THEME_GROUPS = [
  { from: 1, to: 3, key: 'sunset' },
  { from: 4, to: 6, key: 'city' },
  { from: 7, to: 9, key: 'hall' },
  { from: 10, to: 12, key: 'void' },
  { from: 13, to: 15, key: 'lava' },
  { from: 16, to: 18, key: 'aurora' },
  { from: 19, to: 22, key: 'xmas' }, // 🎄 크리스마스 이벤트 곡 (19·21·22)
  { from: 23, to: 23, key: 'hall' }, // 🎭 장거리 (네순 도르마)
];

/** 그리그 무제한·레벨업 챌린지: Lv 이 오를 때마다 이 순서로 맵이 바뀜 */
const THEME_CYCLE = ['space', 'sunset', 'city', 'hall', 'void', 'lava', 'aurora'];

function themeKeyForId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return 'space';
  const g = THEME_GROUPS.find((t) => n >= t.from && n <= t.to);
  return g ? g.key : n > 20 ? 'aurora' : 'sunset';
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

return { THEMES, SHOP_KITS, THEME_GROUPS, THEME_CYCLE, themeKeyForId, themeForLevel, cycleTheme, groupStarting };
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

/** 크리스마스 마을: 길 양옆 트리 (정적 그림·동적 전구 공용) */
function xmasTrees(L) {
  const { cx, topY, GW } = L;
  const out = [];
  for (const [f, k] of [[-0.62, 1], [-0.36, 0.7], [0.4, 0.75], [0.66, 1.05]]) {
    const h = topY * 0.5 * k;
    out.push({ x: cx + GW * f, y: topY + h * 0.06, h, w: h * 0.36 });
  }
  return out;
}
/** 트리 위 전구 자리 (트리마다 지그재그로 감은 줄) */
function xmasLights(L) {
  const pts = [];
  xmasTrees(L).forEach((t, ti) => {
    for (let row = 0; row < 4; row++) {
      const yy = t.y - t.h * (0.18 + row * 0.19);
      const half = t.w * (1 - (row * 0.19 + 0.18)) * 0.95;
      for (let j = 0; j < 4; j++) {
        const u = (j + 0.5) / 4;
        pts.push({ x: t.x - half + 2 * half * (row % 2 ? 1 - u : u), y: yy + t.h * 0.05 * u, k: ti * 16 + row * 4 + j });
      }
    }
  });
  return pts;
}
const XMAS_COLS = ['255,80,80', '255,214,90', '120,220,255', '130,255,150'];

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

  xmas(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(41);
    // 별 + 큰 별 하나
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      g.fillRect(r() * W, r() * topY * 0.8, 1.3, 1.3);
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx + GW * 0.05, topY * 0.16, GW * 0.12, '255,236,170', 0.6, 0.2);
    g.restore();
    // 눈 덮인 언덕
    g.fillStyle = '#C9D9EA';
    g.beginPath();
    g.moveTo(0, topY + 1);
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * W;
      g.lineTo(x, topY - topY * (0.06 + 0.05 * Math.sin(i * 0.9) + 0.03 * Math.sin(i * 2.3)));
    }
    g.lineTo(W, topY + 1);
    g.fill();
    // 작은 집들 (불 켜진 창)
    for (const [f, sc] of [[-0.18, 1], [0.16, 0.85], [-0.02, 0.7]]) {
      const hw = topY * 0.07 * sc;
      const hx = cx + GW * f;
      const hy = topY - topY * 0.05;
      g.fillStyle = '#5A3A4A';
      g.fillRect(hx - hw, hy - hw * 1.2, hw * 2, hw * 1.2);
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.moveTo(hx - hw * 1.25, hy - hw * 1.15);
      g.lineTo(hx, hy - hw * 2.1);
      g.lineTo(hx + hw * 1.25, hy - hw * 1.15);
      g.fill();
      g.fillStyle = '#FFD27A';
      g.fillRect(hx - hw * 0.6, hy - hw * 0.8, hw * 0.45, hw * 0.45);
      g.fillRect(hx + hw * 0.15, hy - hw * 0.8, hw * 0.45, hw * 0.45);
    }
    // 트리
    for (const t of xmasTrees(L)) {
      g.fillStyle = '#5A3A22';
      g.fillRect(t.x - t.w * 0.08, t.y - t.h * 0.08, t.w * 0.16, t.h * 0.12);
      for (let k = 0; k < 3; k++) {
        const top = t.y - t.h * (0.42 + k * 0.29);
        const bot = t.y - t.h * (0.06 + k * 0.27);
        const ww = t.w * (1 - k * 0.24);
        const tg = g.createLinearGradient(t.x - ww, 0, t.x + ww, 0);
        tg.addColorStop(0, '#0E4A2A');
        tg.addColorStop(0.5, '#1F7A45');
        tg.addColorStop(1, '#0B3A20');
        g.fillStyle = tg;
        g.beginPath();
        g.moveTo(t.x, top - t.h * 0.12);
        g.lineTo(t.x + ww, bot);
        g.lineTo(t.x - ww, bot);
        g.fill();
        // 가지 위 눈
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.moveTo(t.x - ww, bot);
        g.quadraticCurveTo(t.x, bot - t.h * 0.05, t.x + ww, bot);
        g.quadraticCurveTo(t.x, bot - t.h * 0.015, t.x - ww, bot);
        g.fill();
      }
      // 꼭대기 별
      g.fillStyle = '#FFD84A';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = (i % 2 ? 0.4 : 1) * t.w * 0.16;
        g.lineTo(t.x + Math.cos(a) * rr, t.y - t.h * 1.04 + Math.sin(a) * rr);
      }
      g.fill();
    }
    // 전구 (꺼진 상태로 작게. 반짝임은 FX)
    for (const p of xmasLights(L)) {
      g.fillStyle = `rgba(${XMAS_COLS[p.k % 4]},0.9)`;
      g.beginPath();
      g.arc(p.x, p.y, Math.max(1.2, GW * 0.006), 0, TAU);
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
const BEAMS = { sunset: 'swing', city: 'swing', hall: 'down', void: 'down', lava: 'swing', space: 'swing', aurora: 'none', xmas: 'none' };

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
  xmas(ctx, L, T, s) {
    // 트리 전구가 박자마다 색 무리별로 번갈아 반짝 + 큰 별이 박자에 맞춰 숨 쉼
    const b = Math.floor(s.beatNo || 0);
    for (const p of xmasLights(L)) {
      const on = (p.k + b) % 3 === 0 ? s.beat : 0;
      glow(ctx, p.x, p.y, L.GW * (0.018 + 0.016 * on), XMAS_COLS[p.k % 4], 0.3 + 0.2 * s.heat + on * (0.45 + 0.35 * s.heat));
    }
    glow(ctx, L.cx + L.GW * 0.05, L.topY * 0.16, L.GW * (0.07 + 0.03 * s.beat), '255,236,170', 0.25 + 0.3 * s.beat);
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
const { loadBuddies } = __m_buddies;
const { buildKit, SNARE_RY } = __m_kit3d;
const { THEMES, SHOP_KITS, themeForLevel, cycleTheme } = __m_themes;
const { paintScenery, SceneFx } = __m_scenery;

const LANE = [
  { key: 'kick', main: '#FF8A4C', light: '#FFC08F', dark: '#C9532A', rgb: '255,138,76', thumb: '왼쪽 엄지', word: '킥 (쿵)', short: '쿵' },
  { key: 'snare', main: '#62C8FF', light: '#D7F1FF', dark: '#2F86CF', rgb: '98,200,255', thumb: '오른쪽 엄지', word: '스네어 (짝)', short: '짝' },
  { key: 'hat', main: '#FFD24A', light: '#FFF2B8', dark: '#B9821C', rgb: '255,210,74', thumb: '오른쪽 엄지', word: '하이햇 (츠)', short: '츠' },
  { key: 'crash', main: '#C38BFF', light: '#EBDDFF', dark: '#7F4CCF', rgb: '195,139,255', thumb: '왼쪽 엄지', word: '크래시 (챙)', short: '챙' },
  { key: 'tom', main: '#4FE0A6', light: '#C9FBE6', dark: '#1F9E70', rgb: '79,224,166', thumb: '왼쪽 엄지', word: '탐탐 (둥)', short: '둥' },
];

// 🎨 콩(노트) 색 고르기 (상점에서 장착). 줄 순서: 쿵·짝·하이햇·크래시·탐탐 [main, light, dark]
const NOTE_PALETTES = {
  basic: { name: '기본', c: null },
  candy: { name: '사탕', c: [['#FF6FA8', '#FFC2DA', '#C93A76'], ['#7FD8FF', '#D9F4FF', '#3B9FD1'], ['#FFE066', '#FFF6C4', '#C9A21F'], ['#B98BFF', '#E7DAFF', '#7A4CD0'], ['#7CF0C0', '#D3FCEB', '#2FB585']] },
  neon: { name: '네온', c: [['#FF2BD6', '#FFA8F0', '#A3008A'], ['#00E5FF', '#A8F7FF', '#008CA3'], ['#C6FF00', '#EEFFA8', '#7A9E00'], ['#8C5CFF', '#D2C2FF', '#4A1FC2'], ['#00FF9C', '#B0FFDD', '#00A365']] },
  ocean: { name: '바다', c: [['#2E9BFF', '#B5DCFF', '#145FB0'], ['#36E0D0', '#C0F7F1', '#13968A'], ['#9AD8FF', '#E6F6FF', '#4C93BF'], ['#6F7BFF', '#D0D4FF', '#3A44BF'], ['#3FD6A0', '#C6F5E3', '#1A8F66']] },
  fire: { name: '불꽃', c: [['#FF4A2E', '#FFB3A6', '#B3200E'], ['#FF9F1C', '#FFDDA8', '#B86600'], ['#FFD93A', '#FFF3B0', '#B88F00'], ['#FF5E7E', '#FFC2CE', '#B32446'], ['#FF7A3A', '#FFCBA8', '#B3450E']] },
  mono: { name: '흑백', c: [['#F2F2F2', '#FFFFFF', '#9A9A9A'], ['#BFC4CC', '#EEF0F3', '#6E747E'], ['#E6E6E6', '#FFFFFF', '#8E8E8E'], ['#A8ADB5', '#E2E4E8', '#5E636B'], ['#D0D0D0', '#F5F5F5', '#7A7A7A']] },
  // ✨ 상점 콩 스킨 (2026-11-22 밤 개편: 색만이 아니라 질감 tex + 꼬리 trail + 빛 aura + 반짝이 spark). shop = 산 사람만 설정에 보임
  //   trail·aura 는 'r,g,b', trail 'rainbow' = 무지개로 흐름
  ice: { name: '💎 크리스탈', shop: true, fx: { tex: 'ice', trail: '150,230,255', aura: '170,240,255', spark: '#FFFFFF' }, c: [['#7FE3FF', '#E6FBFF', '#2E8FBF'], ['#B9F1FF', '#FFFFFF', '#5FB3D6'], ['#D6F6FF', '#FFFFFF', '#7FB8CC'], ['#9CCBFF', '#E8F3FF', '#4C7FC2'], ['#8FF0E6', '#E2FFFB', '#2E9E92']] },
  flame: { name: '🔥 불꽃', shop: true, fx: { tex: 'flame', trail: '255,110,20', aura: '255,90,20', spark: '#FFD27A', flicker: true }, c: [['#FF5A1F', '#FFC08A', '#A8200A'], ['#FF8A1F', '#FFD9A8', '#B04A00'], ['#FFC53A', '#FFF0B0', '#B07A00'], ['#FF3D3D', '#FFB0A8', '#9E0E0E'], ['#FF7A3A', '#FFCBA8', '#B3450E']] },
  heart: { name: '💖 러블리', shop: true, fx: { tex: 'heart', trail: '255,120,190', aura: '255,140,200', spark: '#FFFFFF', heart: true }, c: [['#FF5FA2', '#FFD0E4', '#C21E66'], ['#FF8FC8', '#FFE2F1', '#C24E8A'], ['#FFB3D9', '#FFF0F7', '#C27A9E'], ['#E86BFF', '#F7D6FF', '#9E2EB8'], ['#FF7AB0', '#FFD6E7', '#C23E74']] },
  cyber: { name: '⚡ 사이버', shop: true, fx: { tex: 'cyber', trail: '0,240,255', trail2: '255,40,220', aura: '0,240,255', spark: '#E8FFFF', glitch: true }, c: [['#00F0FF', '#B8FCFF', '#007A8A'], ['#FF2BD6', '#FFB8F2', '#8A0072'], ['#C6FF00', '#F0FFB0', '#6A8A00'], ['#8C5CFF', '#D8CCFF', '#3A1FA8'], ['#00FF9C', '#B0FFDD', '#00A365']] },
  gold: { name: '👑 황금', shop: true, fx: { tex: 'gold', trail: '255,200,60', aura: '255,210,80', spark: '#FFFDE0', big: true }, c: [['#FFC83D', '#FFF1B8', '#B07A00'], ['#FFD75A', '#FFF6CC', '#B8860B'], ['#FFE07A', '#FFF8D6', '#B89520'], ['#F2B84A', '#FFE9BF', '#A8701E'], ['#D9B45A', '#F7EBC7', '#8C6C1E']] },
  // 🥇 시즌 1 한정 (2026-11-23): 남색 바탕에 금빛 「1」 을 크게 새김, 금빛 꼬리 (shop.js LIMITED — 시즌 1 동안만 팖)
  s1: { name: '🥇 시즌 1', set: true, fx: { tex: 's1', trail: '255,205,70', aura: '255,215,90', spark: '#FFF6C8', big: true }, c: [['#2B3A8C', '#8FA2FF', '#121A4A'], ['#2B3A8C', '#8FA2FF', '#121A4A'], ['#33459E', '#A3B3FF', '#16205A'], ['#2B3A8C', '#8FA2FF', '#121A4A'], ['#2B3A8C', '#8FA2FF', '#121A4A']] },
  galaxy: { name: '🌌 은하수', shop: true, fx: { tex: 'galaxy', trail: 'rainbow', aura: '180,120,255', spark: '#FFFFFF', big: true }, c: [['#B26BFF', '#E6D0FF', '#6A22C2'], ['#4FD8FF', '#CFF5FF', '#1688B0'], ['#FF7AD9', '#FFD3F2', '#B8338F'], ['#7C8CFF', '#D9DEFF', '#3B46C2'], ['#5CFFC8', '#CCFFEE', '#1FA67A']] },
};
let noteSkin = 'basic';
/** 지금 콩 스킨의 효과 (없으면 null) */
const skinFx = () => (NOTE_PALETTES[noteSkin] || {}).fx || null;
const LANE_BASE = LANE.map((l) => ({ main: l.main, light: l.light, dark: l.dark, rgb: l.rgb }));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
/** 콩 색 바꾸기 (LANE 을 바꿔 둠 → 다음 resize 때 노트 그림이 새로 만들어짐) */
function applyNoteColors(key) {
  noteSkin = NOTE_PALETTES[key] ? key : 'basic';
  const p = (NOTE_PALETTES[key] || NOTE_PALETTES.basic).c;
  LANE.forEach((l, i) => {
    if (!p) return Object.assign(l, LANE_BASE[i]);
    const [main, light, dark] = p[i];
    Object.assign(l, { main, light, dark, rgb: hexRgb(main) });
  });
}
const KICK = 0;
const SNARE = 1;
const HAT = 2;
const CRASH = 3;
const TOM = 4;

// 판정 글자: 한눈에 구분되게 크기·색·빛을 다르게 (11-22 '글자 구분이 잘 됐으면')
//   PERFECT = 제일 크게 금빛 그라데이션 + 빛 / GREAT = 초록 보통 / GOOD = 작게 하늘색
const JUDGE_STYLE = {
  perfect: { text: 'PERFECT', color: '#FFE45C', grad: ['#FFFBE0', '#FFD93A', '#FF9F1C'], scale: 1.2, glow: '255,210,60' },
  great: { text: 'GREAT', color: '#4DF08A', scale: 1, glow: '60,240,130' },
  good: { text: 'GOOD', color: '#8FB8FF', scale: 0.78 },
  miss: { text: 'MISS', color: '#FF6B8A', scale: 0.9 },
  wrong: { text: '헛침!', color: '#FF6B8A', scale: 0.9 },
};

const INK = '#2B1D3A';
// 🎤 라이브 스테이지 세트 판정 글자: 기울인 굵은 글씨 + 가로 그라데이션
const LIVE_FONT = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, "Apple SD Gothic Neo", sans-serif';
const LIVE_JUDGE = {
  PERFECT: { c: ['#FF8AD8', '#FFE27A', '#7DF2FF', '#B996FF'], k: 1, glow: 'rgba(255,200,255,0.9)' },
  GREAT: { c: ['#FF6FAE', '#FFB7D9'], k: 0.92, glow: 'rgba(255,120,190,0.7)' },
  GOOD: { c: ['#4FC8FF', '#B6EEFF'], k: 0.84 },
  MISS: { c: ['#8E94AA', '#D6D9E4'], k: 0.84 },
  '헛침!': { c: ['#8E94AA', '#D6D9E4'], k: 0.84 },
};
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

/** 하트 모양 경로 (가운데 cx,cy · 폭 size). 캔버스엔 이모지 대신 이걸로 */
function heartPath(ctx, cx, cy, size) {
  const k = size / 24;
  const X = (v) => cx + (v - 12) * k;
  const Y = (v) => cy + (v - 13) * k;
  ctx.beginPath();
  ctx.moveTo(X(12), Y(20.5));
  ctx.bezierCurveTo(X(12), Y(20.5), X(4), Y(15.6), X(4), Y(9.9));
  ctx.bezierCurveTo(X(4), Y(5.5), X(9.6), Y(4), X(12), Y(7.2));
  ctx.bezierCurveTo(X(14.4), Y(4), X(20), Y(5.5), X(20), Y(9.9));
  ctx.bezierCurveTo(X(20), Y(15.6), X(12), Y(20.5), X(12), Y(20.5));
  ctx.closePath();
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.rasters = null;
    this.buddies = null; // 쿵콩이·짝콩이 3D 그림 (줄여 둔 캔버스). 못 받으면 예전 그림
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
    this.fx = { judges: [], sparks: [], bursts: [], booms: [], banners: [], coins: [] };
    this.hitAt = [-9, -9, -9, -9, -9];
    this.piano = new Map(); // 🎹 midi → { t0, d } 눌린 건반
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
    // 🎨 설정에서 고른 배경 (영상 찍기는 「내 꾸미기 적용」 켰을 때만)
    let pick = !this.plainStudio && this.bgPick && THEMES[this.bgPick] ? this.bgPick : null;
    if (pick === 'photo' && !this.bgPhoto) pick = null; // 사진이 없으면(지웠거나 못 읽음) 원래 맵
    // 🎤 라이브 스테이지 세트: 배경을 '단계별'로 둔 사람은 세트 무대가 깔림
    if (!pick && !this.plainStudio && this.uiStyle === 'live') pick = 'livestage';
    if (!this.plainStudio && this.uiStyle === 's1') pick = 's1stage'; // 🥇 시즌 1 세트 무대
    // 같은 맵 키여도 사진·밝기가 바뀌었으면 배경을 다시 그림
    const pk = pick === 'photo' ? `${this.bgPhoto && this.bgPhoto.src}|${this.photoDim}` : '';
    if (pk !== this._photoKey) {
      this._photoKey = pk;
      this._themeDirty = true;
    }
    const t = pick ? { key: pick, cycle: false } : themeForLevel(lv);
    this.themeBase = t.key;
    this.themeCycle = t.cycle;
    if (this.themeKey !== t.key) {
      this.themeKey = t.key;
      this._themeDirty = true;
    }
    this.themeFx = null;
  }

  /** 영상 찍기인데 「내 꾸미기 적용」을 끈 판 = 원래 맵·드럼·기본 콩 (2026-11-23 사용자: 영상 찍기에도 스킨) */
  get plainStudio() {
    return !!this.studio && !this.studioSkin;
  }

  /** 🎤 라이브 스테이지 세트로 그리는 중 (영상 찍기·장거리 피아노 곡은 원래 화면) */
  get live() {
    return this.uiStyle === 'live' && !this.plainStudio && !this.melodyMode;
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
    // 🎨 설정에서 고른 드럼 세트 (영상 찍기는 맵 드럼 그대로)
    const kp = !this.plainStudio && this.kitPick && (THEMES[this.kitPick] || SHOP_KITS[this.kitPick]);
    this.kit = buildKit(
      kp ? { ...this.theme, kit: kp.kit } : this.theme,
      { instR: L.instR, padR: L.padR, barW: L.barW, barH: L.barH, cymR: L.cymR, dpr: L.dpr, standTo: L.H - L.strikeY },
      LANE
    );
    // ✨ 콩 스킨 질감 (영상 찍기는 기본 콩)
    const fx = !this.plainStudio && skinFx();
    this._skinFx = fx;
    if (fx && fx.tex) for (const [lane, sp] of Object.entries(this.kit.notes.live)) this.kit.notes.live[lane] = { ...sp, img: skinTexture(sp.img, fx.tex, Number(lane)) };
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
    L.buddyW = GW * 0.22;
    const bpx = Math.round(L.buddyW * dpr);
    if (this._buddyKey !== bpx) {
      const imgs = await loadBuddies();
      this.buddies = imgs ? shrinkBuddies(imgs, bpx) : null;
      this._buddyKey = imgs ? bpx : null;
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
    const s = y === undefined ? 1 : this._sRoad(y);
    const xw = L.cx + (x - L.cx) / s;
    const i = Math.floor((xw - L.x0) / L.laneW);
    return order[clamp(i, 0, order.length - 1)];
  }

  /**
   * laneAt + 옆 줄 정보. near = 바로 옆 줄들과 경계까지 거리(줄 너비 기준, 0~1, 가까운 순).
   *   엄지가 가운데 쪽으로 쏠려 경계 근처를 누르면 game.js 가 노트 있는 옆 줄로 봐줌
   */
  laneHit(x, y) {
    const L = this.L;
    const order = this.laneOrder;
    if (!L) return { lane: order[0], near: [], u: null };
    const s = y === undefined ? 1 : this._sRoad(y);
    const u = (L.cx + (x - L.cx) / s - L.x0) / L.laneW;
    const i = clamp(Math.floor(u), 0, order.length - 1);
    const f = clamp(u - i, 0, 1);
    const near = [];
    if (i > 0) near.push({ lane: order[i - 1], d: f });
    if (i < order.length - 1) near.push({ lane: order[i + 1], d: 1 - f });
    near.sort((a, b) => a.d - b.d);
    return { lane: order[i], near, u };
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
  /**
   * 줄 모양의 크기 배율. 판정선 위는 원근(멀수록 좁음), 판정선 아래(엄지 누르는 자리)는 곧게 내려감.
   *   예전엔 아래로도 계속 벌어져서, 엄지가 실제로 누르는 화면 아래쪽에선 가장자리 줄(3줄일 때 킥, 4·5줄일 때 크래시)이
   *   화면 밖으로 밀려 아주 좁아짐 → 왼쪽 엄지가 조금만 안쪽을 눌러도 옆 줄로 들어가 '안 눌리는' 것처럼 됨
   */
  _sRoad(y) {
    return clamp(this._sAtY(y), this.L.sFar, 1);
  }
  /** 길 위 사다리꼴 (월드 x 범위 xa~xb, 화면 y 범위 ya~yb). 판정선을 지나면 거기서 꺾여 곧게 내려감 */
  _trap(g, xa, xb, ya, yb) {
    const sa = this._sRoad(ya);
    const sb = this._sRoad(yb);
    const yk = this.L.strikeY;
    const bend = ya < yk && yb > yk;
    g.beginPath();
    g.moveTo(this._px(xa, sa), ya);
    g.lineTo(this._px(xb, sa), ya);
    if (bend) g.lineTo(xb, yk);
    g.lineTo(this._px(xb, sb), yb);
    g.lineTo(this._px(xa, sb), yb);
    if (bend) g.lineTo(xa, yk);
    g.closePath();
  }

  _paintPhoto(g, L, img = this.bgPhoto, dim = this.photoDim) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const k = Math.max(L.W / iw, L.H / ih);
    const w = iw * k;
    const h = ih * k;
    g.fillStyle = '#000';
    g.fillRect(0, 0, L.W, L.H);
    try {
      g.drawImage(img, (L.W - w) / 2, (L.H - h) / 2, w, h);
    } catch {}
    const d = Math.max(0, Math.min(0.85, dim ?? 0.4));
    const gr = g.createLinearGradient(0, 0, 0, L.H);
    gr.addColorStop(0, `rgba(0,0,0,${d * 0.6})`);
    gr.addColorStop(0.5, `rgba(0,0,0,${d})`);
    gr.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, d * 1.2)})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, L.W, L.H);
  }

  _drawStatic() {
    const L = this.L;
    const T = this.theme;
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    // 맵 배경 (하늘·땅·장식). 📷 내 사진이면 사진을 화면에 꽉 차게 + 노트가 잘 보이게 어둡게
    // 🛒 상점 배경 그림: 받아 두었으면 사진처럼, 아직이면 받고 나서 다시 그림
    const bgImg = T.img ? shopBg(T.img, () => this.theme === T && this.L && this._drawStatic()) : null;
    if (T.key === 'photo' && this.bgPhoto) this._paintPhoto(g, L);
    else if (bgImg) this._paintPhoto(g, L, bgImg, T.imgDim);
    else paintScenery(g, L, T);
    this._staticLive = this.live;
    if (this._staticLive) return this._liveStatic(g);
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
      g.lineTo(x + 1, L.strikeY + 1);
      g.lineTo(x + 1, L.H + 2);
      g.stroke();
      g.strokeStyle = lg;
      g.lineWidth = edge ? 3.5 : 2;
      if (edge) {
        g.shadowColor = `rgba(${rgb},0.8)`;
        g.shadowBlur = 10;
      }
      g.beginPath();
      g.moveTo(this._px(x, L.sFar), y0);
      g.lineTo(x, L.strikeY);
      g.lineTo(x, L.H);
      g.stroke();
      g.shadowBlur = 0;
    }
    // 길 끝(먼 곳)
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(this._px(L.x0, L.sFar), y0 - 1, (L.x1 - L.x0) * L.sFar, 2);
    // 먼 곳 안개
    const fog = g.createLinearGradient(0, y0 - 2, 0, y0 + (L.strikeY - y0) * 0.22);
    fog.addColorStop(0, `rgba(${T.fog},${T.fogA ?? 0.75})`);
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

  /** 🎹 장거리 곡: 오른쪽 피아노에서 이 음들의 건반이 눌림 */
  onPiano(midis, rt, d) {
    for (const m of midis) this.piano.set(m, { t0: rt, d });
  }

  onJudge(lane, judge, rt, early) {
    const L = this.L;
    const style = JUDGE_STYLE[judge];
    // 🪙 코인 튀기: PERFECT 2개 · GREAT·GOOD 1개. 판정선에서 살짝 튀어 올랐다가 아래(엄지 자리, 지나간 콩 쪽)로 떨어짐
    if (this.coinFx && (judge === 'perfect' || (!this.coinPerfectOnly && (judge === 'great' || judge === 'good'))) && this.L) {
      const L = this.L;
      const n = judge === 'perfect' && !this.coinPerfectOnly ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const side = n === 2 ? (i ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
        this.fx.coins.push({
          x: L.laneX[lane] + side * L.instR * 0.5,
          y: L.strikeY + L.instR * 0.2,
          vx: side * L.instR * (1.2 + Math.random() * 0.8),
          vy: -L.instR * (2.2 + Math.random() * 0.8),
          t0: rt + i * 0.04,
          spin: Math.random() * 6,
        });
      }
      if (this.fx.coins.length > 40) this.fx.coins.splice(0, this.fx.coins.length - 40);
    }
    this._lastJudgeAt = rt;
    this.fx.judges.push({ lane, text: style.text, color: style.color, grad: style.grad, scale: style.scale || 1, glow: style.glow, t0: rt, sub: judge === 'perfect' || judge === 'miss' || judge === 'wrong' ? '' : early ? 'FAST' : 'SLOW' });
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
    this.fx.banners.push({ text: healed ? '황금 콩! 하트 +1' : '황금 콩!', t0: rt, color: '#FFD84A' });
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
    // 🎤 세트 화면 ↔ 원래 화면이 바뀌었으면(장거리 피아노 곡 등) 길을 다시 그림
    if (this._staticLive !== this.live) this._drawStatic();
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
    const live = this.live;
    if (live) this._liveFlash(rt);
    else if (!lite) this._drawLaneFlash(rt);
    ctx.save();
    // 치는 화면은 판정선·콩이 꼼짝 않게 (2026-11-22 '칠 때마다 쿵·짝이 움직여서 탈락' 신고). 흔들림은 영상 찍기에서만
    if (this.studio) {
      const sc = 1 + pe * 0.012;
      ctx.translate(L.cx, L.strikeY);
      ctx.scale(sc, sc);
      ctx.translate(-L.cx + (Math.random() - 0.5) * ce * 3, -L.strikeY + pe * 3);
    }

    this._drawBeatLines(st);
    if (live) {
      this._liveCombo(st, rt);
      this._liveTargets(st, rt);
    } else {
      this._drawCombo(st, rt);
      this._drawInstruments(st, rt, pe);
      this._drawTargets(st, rt);
    }
    this._drawRolls(st, rt);
    if (live) this._liveNotes(st);
    else this._drawNotes(st);
    if (live) this._liveBursts(rt);
    else this._drawBursts(rt);
    if (q >= 1) this._drawSparks(rt);
    this._drawCoins(rt);
    this._drawJudges(rt); // 세트도 기본 드럼 화면처럼 줄마다 판정선 위에 작게 (11-22 사용자 '가운데·아래 다 가리거나 안 보임')
    this._drawRollCount(st, rt);
    ctx.restore();

    if (!lite) this._drawMascot(st, rt);
    this._drawBanners(rt);
    if (!this.studio) this._drawRound(st, rt);
    this._drawCountIn(st, rt);
    this._drawThemeChip(st, rt);
    this._drawLifeFx(st, rt);
    if (this.studio) this._drawStudio(st, rt);
    if (this.touchShow && !this.studio) this._drawTouches(rt);
  }

  /**
   * 🖐 터치 표시 (/?touch=show 로 켠 기기만, 2026-11-24): 손가락이 닿은 자리에 동그라미 + 어느 줄로 · 어떤 판정이었는지.
   *   '분명히 눌렀는데 안 눌려요' 신고 때 화면 녹화로 폰이 터치를 보냈는지·어디로 갔는지 보려고. 화면 어디에도 링크 없음
   */
  markTouch(x, y, r, rt) {
    const list = (this.touchMarks ||= []);
    // 같은 자리를 또 누르면 동그라미가 겹쳐 안 보임 → 자리는 그대로 두고 고리만 조금씩 크게 (자리를 옮겨 그리면 '다른 데 눌린' 것처럼 보임)
    const k = list.filter((m) => rt - m.t0 < 1.4 && Math.abs(m.x - x) < 14 && Math.abs(m.y - y) < 14).length;
    list.push({ x, y, k: Math.min(k, 4), lane: r ? r.lane : null, res: r ? r.res : 'none', t0: rt });
    if (list.length > 30) list.splice(0, list.length - 30);
    this.touchCount = (this.touchCount || 0) + 1;
  }

  _drawTouches(rt) {
    const ctx = this.ctx;
    const L = this.L;
    const COL = { perfect: '#ffd84a', great: '#5ee08a', good: '#59b7ff', miss: '#ff4d5e', wrong: '#ff4d5e', roll: '#ffffff', none: '#bbbbbb' };
    const TXT = { perfect: 'P', great: 'GR', good: 'GD', miss: 'MISS', wrong: '헛침', roll: '연타', none: '·' };
    const NAME = { [KICK]: '쿵', [SNARE]: '짝', [HAT]: '츠', [CRASH]: '챙' };
    const marks = (this.touchMarks || []).filter((m) => rt - m.t0 < 1.4 && rt >= m.t0 - 0.05);
    this.touchMarks = marks;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of marks) {
      const a = 1 - (rt - m.t0) / 1.4;
      const c = COL[m.res] || '#fff';
      ctx.globalAlpha = Math.max(0, a);
      ctx.lineWidth = 3;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 18 + (m.k || 0) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      const label = `${m.lane != null && NAME[m.lane] ? NAME[m.lane] : ''} ${TXT[m.res] || ''}`.trim();
      ctx.font = '700 13px sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(label, m.x, m.y - 30);
      ctx.fillText(label, m.x, m.y - 30);
    }
    ctx.globalAlpha = 0.85;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    // 폰이 지금 '누르고 있다'고 보는 손가락 (하얀 고리)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    for (const h of this.touchHeld || []) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 27, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 받은 이벤트 수 (인스타 아래 툴바에 안 가리게 위쪽): 친 터치 · 창 touchstart · 캔버스 touchstart · pointerdown · 뗌 / 누르는 중 · 한쪽 이벤트로만 온 터치
    const d = this.touchDiag || {};
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 3;
    const lines = [`터치 ${this.touchCount || 0} · 창 ${d.win || 0} 캔 ${d.can || 0} 포 ${d.ptr || 0} 뗌 ${d.end || 0}`, `누르는 중 ${(this.touchHeld || []).length} · 한쪽만 ${d.only || 0}`];
    if (this.touchEnv) lines.push(this.touchEnv); // 기기·iOS·브라우저 (main deviceLabel)
    lines.forEach((txt, i) => {
      const y = Math.max(150, L.H * 0.24) + i * 16;
      ctx.strokeText(txt, 8, y);
      ctx.fillText(txt, 8, y);
    });
    ctx.restore();
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
    const k = this.studio ? 1 + pulse * 0.05 : 1; // 판정 자리 크기는 그대로 (영상에서만 박자에 출렁)
    for (const lane of this.laneOrder) {
      const x = L.laneX[lane];
      const lit = rt - this.hitAt[lane] < 0.1;
      const c = LANE[lane].rgb;
      if (this.melodyMode && lane === SNARE) {
        // 🎹 피아노 줄: 흰 건반 위에선 흰 선이 안 보여서 진한 테두리 + 금색 판정선
        const w = Math.min(L.laneW * 0.94, L.GW * 0.46);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(43,29,58,0.85)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, L.strikeY);
        ctx.lineTo(x + w / 2, L.strikeY);
        ctx.stroke();
        ctx.strokeStyle = lit ? '#FFFFFF' : `rgba(255,205,70,${0.85 + 0.15 * pulse})`;
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.restore();
        continue;
      }
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
      // 하트 모양(직접 그림) + '+3'
      const hy = y + fs * 0.75;
      const hs = fs * 0.42;
      const tw = ctx.measureText(`+${f.hearts}`).width;
      const hx = x - tw / 2 - hs * 0.15;
      ctx.fillStyle = '#FF8FB0';
      heartPath(ctx, hx - hs * 0.5, hy, hs);
      ctx.stroke();
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.strokeText(`+${f.hearts}`, hx + hs * 0.15, hy);
      ctx.fillText(`+${f.hearts}`, hx + hs * 0.15, hy);
    }
    ctx.restore();
  }

  /** 지금 보이는 콩 (+ 동시치기 점선을 그림) */
  _noteVis(st) {
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
    return vis;
  }

  _drawNotes(st) {
    const ctx = this.ctx;
    const L = this.L;
    const vis = this._noteVis(st);
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
      const fx = !n.judged && this._skinFx;
      if (fx) {
        ctx.restore();
        this._skinBack(n, dt, ps, x, y, sp, a, st, fx);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(ps, ps * (0.82 + 0.18 * Math.min(1, ps)));
      }
      ctx.globalAlpha = a;
      ctx.drawImage(img.img, -img.ax, -img.ay, img.w, img.h);
      if (fx) this._skinFront(n, img, a, fx);
      // 🎭 멜로디 콩: 계이름 (도·레·미)
      if (n.sol && !n.judged) {
        const fs = Math.max(12, Math.round(img.h * 0.5));
        ctx.font = `${fs}px Jua, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = -img.ax + img.w / 2;
        const cy = -img.ay + img.h * 0.42;
        ctx.lineWidth = Math.max(3, fs * 0.22);
        ctx.strokeStyle = 'rgba(40,20,70,0.9)';
        ctx.strokeText(n.sol, cx, cy);
        ctx.fillStyle = '#fff';
        ctx.fillText(n.sol, cx, cy);
      }
      ctx.restore();
    }
  }

  /** ✨ 콩 스킨: 콩 뒤 짧고 옅은 꼬리 (화면 좌표)
   *  2026-11-22 사용자 '치는 데 방해 안 되게': 콩 뒤 동그란 빛(aura)은 없앰, 꼬리는 짧고 가늘고 옅게, 흔들림 줄임 */
  _skinBack(n, dt, ps, x, y, sp, a, st, fx) {
    const ctx = this.ctx;
    const L = this.L;
    const t = performance.now() / 1000;
    const len = fx.big ? 0.12 : 0.09;
    const ps2 = this._s(dt + len, st.approach);
    const y2 = this._py(ps2);
    const x2 = this._px(L.laneX[n.lane], ps2);
    const w0 = Math.min(sp.w, sp.h * 1.6) * 0.24 * ps * (fx.flicker ? 0.94 + 0.08 * Math.sin(t * 31 + n.id) : 1);
    const w2 = w0 * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const drawTrail = (rgb, k, off) => {
      const gr = ctx.createLinearGradient(0, y, 0, y2);
      if (rgb === 'rainbow') {
        const h = (t * 120 + n.id * 40) % 360;
        gr.addColorStop(0, `hsla(${h},100%,65%,${0.32 * a})`);
        gr.addColorStop(0.5, `hsla(${(h + 80) % 360},100%,65%,${0.16 * a})`);
        gr.addColorStop(1, `hsla(${(h + 160) % 360},100%,65%,0)`);
      } else {
        gr.addColorStop(0, `rgba(${rgb},${0.3 * a * k})`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
      }
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - w0 + off, y);
      ctx.lineTo(x + w0 + off, y);
      ctx.lineTo(x2 + w2 + off, y2);
      ctx.lineTo(x2 - w2 + off, y2);
      ctx.closePath();
      ctx.fill();
    };
    if (fx.trail2) {
      const j = 1.2 * ps;
      drawTrail(fx.trail, 0.9, -j);
      drawTrail(fx.trail2, 0.9, j);
    } else drawTrail(fx.trail, 1, 0);
    ctx.restore();
  }
  /** ✨ 콩 스킨: 콩 위 반짝이 (콩 좌표, 이미 translate·scale 된 상태) */
  _skinFront(n, img, a, fx) {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    const cnt = 1; // 작은 반짝이 하나만 (방해 안 되게)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cnt; i++) {
      const ph = (t * (1.3 + i * 0.4) + n.id * 0.37 + i * 0.31) % 1;
      const tw = Math.sin(ph * Math.PI);
      if (tw <= 0.05) continue;
      const seed = (n.id * 7 + i * 13) % 17;
      const px = -img.ax + img.w * (0.15 + ((seed * 0.13) % 0.7));
      const py = -img.ay + img.h * (0.2 + ((seed * 0.29) % 0.45));
      const s = img.h * (fx.big ? 0.16 : 0.13) * tw;
      ctx.globalAlpha = a * tw * 0.6;
      ctx.fillStyle = fx.spark;
      if (fx.heart) drawHeart(ctx, px, py, s * 0.7);
      else drawGlint(ctx, px, py, s);
    }
    ctx.restore();
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
      } else if (this.melodyMode && b.lane === SNARE) {
        // 🎹 피아노: 건반 위로 얇게 금빛만 (건반이 가려지지 않게)
        const w = Math.min(L.laneW * 0.94, L.GW * 0.46) * (1 + e * 0.08);
        const h = L.instR * 0.35 * (1 + e);
        rr(ctx, x - w / 2, L.strikeY - L.instR * 0.45 - h, w, h, h / 2);
        ctx.fillStyle = 'rgba(255,215,120,0.45)';
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
        const k = 1 + pe * (this.studio ? 0.07 : 0.025);
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
      } else if (this.melodyMode && lane === SNARE) {
        this._drawPiano(x, y, rt);
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
      const ly = Math.min(L.H - fs * 1.1, L.strikeY + L.instR * (this.melodyMode && lane === SNARE ? 1.95 : 1.55));
      ctx.strokeText(this.melodyMode && lane === SNARE ? '피아노' : LANE[lane].short, x, ly);
      ctx.fillStyle = LANE[lane].light;
      ctx.fillText(this.melodyMode && lane === SNARE ? '피아노' : LANE[lane].short, x, ly);
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

  /**
   * 🎹 장거리 곡 오른쪽 줄: 스네어 대신 피아노 (검은 몸통 + 건반 1~2옥타브).
   *   멜로디 노트를 치면 그 음(+ 오른손 화음)의 건반이 쑥 들어가고 금빛으로 → 진짜 치는 것처럼
   */
  _drawPiano(x, y, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const R = this.pianoRange || { base: 60, oct: 2 };
    const nW = 7 * R.oct;
    const w = Math.min(L.laneW * 0.94, L.GW * 0.46);
    const kw = w / nW;
    const kh = Math.min(kw * 5.2, L.instR * 1.5);
    // 판정선이 건반 윗부분에 오게 피아노를 아래로 → 선·과녁이 잘 보임 (퍼펙트 맞추기 쉽게)
    const top = y - kh * 0.2;
    const x0 = x - w / 2;
    const pad = kw * 0.45;
    const lidH = kh * 0.55;
    // 눌린 건반 (오래된 건 지움). 몇 번째 건반인지는 옥타브를 접어서
    const down = new Map();
    for (const [m, p] of this.piano) {
      const a = rt - p.t0;
      if (a > p.d + 0.15) {
        this.piano.delete(m);
        continue;
      }
      const k = (((m - R.base) % (12 * R.oct)) + 12 * R.oct) % (12 * R.oct);
      const v = a < p.d ? 1 : 1 - (a - p.d) / 0.15;
      down.set(k, Math.max(down.get(k) || 0, v));
    }
    ctx.save();
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, top + kh + pad * 1.4, w * 0.58, kh * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // 몸통 (윗판 + 앞판), 검은 광택
    const body = ctx.createLinearGradient(0, top - lidH, 0, top + kh + pad);
    body.addColorStop(0, '#3A3346');
    body.addColorStop(0.35, '#15121B');
    body.addColorStop(1, '#07060A');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x0 - pad, top - lidH, w + pad * 2, lidH + kh + pad * 1.2, pad * 0.9);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 윗판 하이라이트 + 금색 글씨
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(x0 - pad * 0.6, top - lidH + pad * 0.35, w + pad * 1.2, lidH * 0.18, lidH * 0.09);
    ctx.fill();
    ctx.fillStyle = '#E9C46A';
    ctx.font = `${Math.round(lidH * 0.38)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KONG', x, top - lidH * 0.42);
    // 건반 칸 (빨간 펠트 띠)
    ctx.fillStyle = '#7A1E2C';
    ctx.fillRect(x0 - 1, top - kh * 0.06, w + 2, kh * 0.08);
    // 흰 건반
    const WHITE = [0, 2, 4, 5, 7, 9, 11];
    for (let i = 0; i < nW; i++) {
      const k = Math.floor(i / 7) * 12 + WHITE[i % 7];
      const v = down.get(k) || 0;
      const kx = x0 + i * kw;
      const dy = v * kh * 0.05;
      const g = ctx.createLinearGradient(0, top, 0, top + kh);
      if (v > 0) {
        g.addColorStop(0, '#FFF1B8');
        g.addColorStop(1, '#F2B93B');
      } else {
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(1, '#E6E1EC');
      }
      ctx.fillStyle = g;
      ctx.fillRect(kx + 0.75, top + dy, kw - 1.5, kh - dy);
      // 건반 앞면 두께 (눌리면 얇아짐)
      ctx.fillStyle = v > 0 ? '#C98A1E' : '#B9B2C4';
      ctx.fillRect(kx + 0.75, top + kh, kw - 1.5, kh * 0.09 * (1 - v * 0.7));
      if (v > 0) {
        ctx.fillStyle = `rgba(255,236,150,${0.45 * v})`;
        ctx.fillRect(kx - kw * 0.15, top - kh * 0.25, kw * 1.3, kh * 0.25);
      }
    }
    // 검은 건반
    const BLACK = [[0, 1], [1, 3], [3, 6], [4, 8], [5, 10]];
    for (let o = 0; o < R.oct; o++) {
      for (const [wi, semi] of BLACK) {
        const k = o * 12 + semi;
        const v = down.get(k) || 0;
        const bw = kw * 0.6;
        const bx = x0 + (o * 7 + wi + 1) * kw - bw / 2;
        const bh = kh * 0.6 - v * kh * 0.04;
        const g = ctx.createLinearGradient(0, top, 0, top + bh);
        g.addColorStop(0, v > 0 ? '#D99A26' : '#3B3542');
        g.addColorStop(1, v > 0 ? '#8A5A0C' : '#0B0A0E');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(bx, top + v * kh * 0.03, bw, bh, [0, 0, bw * 0.18, bw * 0.18]);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(bx + bw * 0.18, top + bh * 0.5, bw * 0.16, bh * 0.4);
      }
    }
    ctx.restore();
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
    if (this.buddies) return this._drawBuddies(st, rt);
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

  /** 쿵콩이(왼쪽, 쿵 줄)·짝콩이(오른쪽, 나머지 줄): 화면 맨 아래 가운데에 나란히. 자기 줄을 치면 콩! */
  _drawBuddies(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const B = this.buddies;
    const w = L.buddyW;
    ctx.globalAlpha = 1;
    const phase = beatPhase(st);
    const cheer = rt < this.cheerUntil || st.finished;
    const kongHit = rt - this.hitAt[KICK];
    const kongMiss = rt - this.missAt[KICK];
    let jHit = -9;
    let jMiss = -9;
    for (let i = 0; i < this.hitAt.length; i++) {
      if (i === KICK) continue;
      jHit = Math.max(jHit, this.hitAt[i]);
      jMiss = Math.max(jMiss, this.missAt[i]);
    }
    const parts = [
      ['kong', -1, kongHit, kongMiss, 0],
      ['jjak', 1, rt - jHit, rt - jMiss, 0.5],
    ];
    for (const [who, side, th, tm, off] of parts) {
      const set = B[who];
      let img = set.idle;
      if (th < 0.16) img = set.hit;
      else if (tm < 0.45) img = set.miss;
      else if (cheer) img = set.cheer;
      // 박자에 맞춰 살짝 출렁 (둘이 엇갈리게)
      const ph = (phase + off) % 1;
      const bob = st.playing ? Math.pow(1 - ph, 3) : 0;
      // 칠 때: 납작했다가 폴짝
      const hp = th < 0.3 ? th / 0.3 : 1;
      const hop = th < 0.3 ? Math.sin(hp * Math.PI) * w * 0.1 : 0;
      const squash = th < 0.06 ? 1 - th / 0.06 : 0;
      const sy = 1 - bob * 0.04 - squash * 0.12;
      const sx = 1 + bob * 0.02 + squash * 0.1;
      const jump = cheer ? Math.abs(Math.sin(rt * 11 + off * 3)) * w * 0.1 : 0;
      const cx = L.cx + side * w * 0.43;
      const dw = w * sx;
      const dh = w * sy;
      ctx.drawImage(img, cx - dw / 2, L.mascotBase + w * 0.06 - dh * 0.98 - hop - jump, dw, dh);
    }
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
      const size = Math.min(L.GW * 0.055, L.laneW * 0.2) * sc * (j.scale || 1);
      ctx.save();
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      // 🎤 세트: 자리는 기본처럼, 글씨만 세트 모양 (기울인 굵은 글씨 + 파스텔 그라데이션, 11-22 사용자)
      if (this.live) {
        this._liveJudgeText(j, x, y, size);
        ctx.restore();
        continue;
      }
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = INK;
      if (j.glow && !this.lite) {
        ctx.shadowColor = `rgba(${j.glow},0.9)`;
        ctx.shadowBlur = size * 0.6;
      }
      ctx.strokeText(j.text, x, y);
      ctx.shadowBlur = 0;
      if (j.grad) {
        const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
        g.addColorStop(0, j.grad[0]);
        g.addColorStop(0.5, j.grad[1]);
        g.addColorStop(1, j.grad[2]);
        ctx.fillStyle = g;
      } else ctx.fillStyle = j.color;
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


  /** 🎤 세트 판정 글자 한 개 (자리·크기는 _drawJudges 가 정함) */
  _liveJudgeText(j, x, y, size) {
    const ctx = this.ctx;
    const look = LIVE_JUDGE[j.text] || LIVE_JUDGE.MISS;
    const sz = size * 1.05 * look.k;
    ctx.font = `italic 900 ${Math.round(sz)}px ${LIVE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const tw = ctx.measureText(j.text).width;
    ctx.lineWidth = sz * 0.3;
    ctx.strokeStyle = 'rgba(24,20,70,0.85)';
    ctx.strokeText(j.text, x, y);
    ctx.lineWidth = sz * 0.14;
    ctx.strokeStyle = '#FFFFFF';
    if (look.glow && !this.lite) {
      ctx.shadowColor = look.glow;
      ctx.shadowBlur = sz * 0.5;
    }
    ctx.strokeText(j.text, x, y);
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
    look.c.forEach((c, i) => g.addColorStop(look.c.length > 1 ? i / (look.c.length - 1) : 0, c));
    ctx.fillStyle = g;
    ctx.fillText(j.text, x, y);
    if (j.sub) {
      ctx.font = `italic 900 ${Math.round(sz * 0.5)}px ${LIVE_FONT}`;
      ctx.lineWidth = sz * 0.12;
      ctx.strokeStyle = 'rgba(24,20,70,0.85)';
      ctx.strokeText(j.sub, x, y + sz * 0.8);
      ctx.fillStyle = j.sub === 'FAST' ? '#9CD8FF' : '#FFB3C8';
      ctx.fillText(j.sub, x, y + sz * 0.8);
    }
  }

  /** 🪙 코인: 판정선 조금 위까지만 튀고 아래로 떨어지며 사라짐 (다가오는 콩을 안 가리게 작게, 0.55초) */
  _drawCoins(rt) {
    const list = this.fx.coins;
    if (!list.length) return;
    const ctx = this.ctx;
    const L = this.L;
    const LIFE = 0.65;
    const g = L.instR * 14; // 중력
    const r = Math.max(4, L.instR * 0.16);
    this.fx.coins = list.filter((c) => rt - c.t0 < LIFE);
    for (const c of this.fx.coins) {
      const t = rt - c.t0;
      if (t < 0) continue;
      const x = c.x + c.vx * t;
      const y = c.y + c.vy * t + 0.5 * g * t * t;
      const sx = Math.abs(Math.cos(c.spin + t * 14)); // 빙글빙글
      ctx.save();
      ctx.globalAlpha = t < LIFE * 0.6 ? 1 : 1 - (t - LIFE * 0.6) / (LIFE * 0.4);
      ctx.translate(x, y);
      ctx.scale(Math.max(0.15, sx), 1);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#B57A00';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD23F';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.3, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,230,0.9)';
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------------- 🎤 라이브 스테이지 세트 (2026-11-22, 상점) ----------------
  //   모바일 리듬게임 라이브 화면 느낌: 어두운 유리 길 + 하얀 빛 가장자리 · 납작한 막대 콩 · 빛나는 판정선
  //   · 가운데 큰 판정 글자(파스텔 그라데이션) · 가운데 콤보 · 빛 기둥 타격 효과. 드럼 악기는 안 그림(줄 아무 데나 눌러도 됨은 그대로)
  //   특정 게임의 이름·로고·캐릭터·그림은 쓰지 않음 (장르에서 흔한 모양만)

  _liveNote() {
    const L = this.L;
    return { w: L.laneW * 0.86, h: Math.max(11, L.GW * 0.05) };
  }

  _liveStatic(g) {
    const L = this.L;
    const y0 = L.topY;
    const n = this.laneOrder.length;
    const path = (x) => {
      g.beginPath();
      g.moveTo(this._px(x, L.sFar), y0);
      g.lineTo(x, L.strikeY);
      g.lineTo(x, L.H);
    };
    // 어두운 유리 길
    this._trap(g, L.x0, L.x1, y0, L.H);
    const lg = g.createLinearGradient(0, y0, 0, L.H);
    lg.addColorStop(0, 'rgba(12,14,44,0.2)');
    lg.addColorStop(0.55, 'rgba(14,16,50,0.6)');
    lg.addColorStop(1, 'rgba(6,6,24,0.82)');
    g.fillStyle = lg;
    g.fill();
    // 줄마다 아래쪽에 옅은 색
    this.laneOrder.forEach((lane, i) => {
      const xa = L.x0 + L.laneW * i;
      const gr = g.createLinearGradient(0, y0, 0, L.strikeY);
      gr.addColorStop(0, `rgba(${LANE[lane].rgb},0)`);
      gr.addColorStop(1, `rgba(${LANE[lane].rgb},0.13)`);
      this._trap(g, xa + 1, xa + L.laneW - 1, y0, L.strikeY);
      g.fillStyle = gr;
      g.fill();
    });
    // 줄 사이 가는 선
    for (let i = 1; i < n; i++) {
      const x = L.x0 + L.laneW * i;
      const gr = g.createLinearGradient(0, y0, 0, L.H);
      gr.addColorStop(0, 'rgba(255,255,255,0.04)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.3)');
      gr.addColorStop(1, 'rgba(255,255,255,0.12)');
      g.strokeStyle = gr;
      g.lineWidth = 1.2;
      path(x);
      g.stroke();
    }
    // 가장자리: 하얀 빛 줄
    for (const x of [L.x0, L.x1]) {
      const gr = g.createLinearGradient(0, y0, 0, L.H);
      gr.addColorStop(0, 'rgba(220,245,255,0.15)');
      gr.addColorStop(0.65, 'rgba(235,250,255,0.95)');
      gr.addColorStop(1, 'rgba(235,250,255,0.4)');
      g.save();
      g.shadowColor = 'rgba(140,225,255,0.9)';
      g.shadowBlur = 12;
      g.strokeStyle = gr;
      g.lineWidth = 2.5;
      path(x);
      g.stroke();
      g.restore();
    }
    // 엄지 자리는 조금 더 어둡게
    this._trap(g, L.x0, L.x1, L.strikeY, L.H);
    g.fillStyle = 'rgba(0,0,12,0.28)';
    g.fill();
    // 먼 곳 빛 띠
    const fw = (L.x1 - L.x0) * L.sFar;
    const fx0 = this._px(L.x0, L.sFar);
    const fg = g.createLinearGradient(fx0, 0, fx0 + fw, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0)');
    fg.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fg;
    g.fillRect(fx0, y0 - 1, fw, 2);
  }

  /** 누른 줄에 판정선부터 위로 옅은 빛 */
  _liveFlash(rt) {
    const ctx = this.ctx;
    const L = this.L;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lane of this.laneOrder) {
      const a = rt - this.hitAt[lane];
      if (a > 0.16 || a < 0) continue;
      const k = 1 - a / 0.16;
      const xa = L.laneX[lane] - L.laneHalf;
      const top = L.strikeY - (L.strikeY - L.topY) * 0.5;
      const gr = ctx.createLinearGradient(0, top, 0, L.strikeY);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, `rgba(${hexRgb(LANE[lane].light)},${0.32 * k})`);
      this._trap(ctx, xa + 1, xa + L.laneW - 1, top, L.strikeY);
      ctx.fillStyle = gr;
      ctx.fill();
    }
    ctx.restore();
  }

  /** 판정선(하얀 빛 막대) + 줄마다 콩 자리 + 줄 이름 */
  _liveTargets(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = beatPhase(st);
    const pulse = st.playing ? Math.pow(1 - phase, 3) : 0;
    const N = this._liveNote();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(150,230,255,${0.22 + 0.18 * pulse})`;
    ctx.lineWidth = N.h * 0.9;
    ctx.beginPath();
    ctx.moveTo(L.x0, L.strikeY);
    ctx.lineTo(L.x1, L.strikeY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const lane of this.laneOrder) {
      const x = L.laneX[lane];
      const age = rt - this.hitAt[lane];
      const lit = age >= 0 && age < 0.12 ? 1 - age / 0.12 : 0;
      rr(ctx, x - N.w / 2, L.strikeY - N.h / 2, N.w, N.h, N.h / 2);
      ctx.fillStyle = `rgba(${hexRgb(LANE[lane].light)},${0.08 + 0.5 * lit})`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.5 * lit})`;
      ctx.stroke();
      // 줄 이름 + (컴퓨터) 키
      const fs = Math.round(Math.min(L.laneW * 0.15, L.GW * 0.042));
      const ly = Math.min(L.H - fs * 1.2, L.strikeY + N.h * 2.4);
      ctx.font = `${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(${hexRgb(LANE[lane].light)},0.85)`;
      ctx.fillText(LANE[lane].short, x, ly);
      const kc = this.keyLabels && this.keyLabels[lane];
      if (kc) {
        const ks = Math.round(fs * 1.2);
        const ky = Math.min(L.H - ks * 0.7, ly + fs * 1.1 + ks * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        rr(ctx, x - ks * 0.62, ky - ks * 0.62, ks * 1.24, ks * 1.24, ks * 0.26);
        ctx.fill();
        ctx.fillStyle = '#1A1840';
        ctx.font = `${ks}px ${FONT}`;
        ctx.fillText(kc, x, ky + ks * 0.04);
      }
    }
    ctx.restore();
  }

  /** 납작한 막대 콩 (줄 색 + 하얀 테두리 + 가운데 빛 줄) */
  _liveNotes(st) {
    const ctx = this.ctx;
    const L = this.L;
    const N = this._liveNote();
    const vis = this._noteVis(st);
    const glow = !this.lite;
    const fx = this._skinFx;
    for (let k = vis.length - 1; k >= 0; k--) {
      const n = vis[k];
      const dt = n.time - st.now;
      const ps = this._s(dt, st.approach);
      const y = this._py(ps);
      const x = this._px(L.laneX[n.lane], ps);
      let a = clamp((1 - dt / st.approach) / 0.1, 0, 1);
      if (dt < 0) a *= clamp(1 + dt * 5, 0, 1);
      if (n.judged) a *= 0.5;
      const w = N.w * ps;
      const h = N.h * ps * (0.82 + 0.18 * Math.min(1, ps));
      const C = LANE[n.lane];
      const gold = n.gold && !n.judged;
      const [light, main, dark] = n.judged ? ['#C4C8D2', '#8A8F9C', '#535764'] : gold ? ['#FFF8D0', '#FFD23F', '#C98A00'] : [C.light, C.main, C.dark];
      const rgb = n.judged ? '160,165,180' : gold ? '255,210,63' : C.rgb;
      // 세트에선 빛을 막대에 붙은 납작한 모양으로 (큰 동그라미가 콩·판정 글자를 가린다는 신고 2026-11-22)
      if (fx && !n.judged) this._skinBack(n, dt, ps, x, y, { w: N.w, h: N.h * 1.6, flat: true }, a, st, fx);
      ctx.save();
      ctx.globalAlpha = a;
      if (glow && !n.judged) {
        ctx.globalCompositeOperation = 'lighter';
        rr(ctx, x - w / 2 - h * 0.4, y - h * 0.9, w + h * 0.8, h * 1.8, h * 0.9);
        ctx.fillStyle = `rgba(${rgb},${gold ? 0.45 : 0.28})`;
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      const gr = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      gr.addColorStop(0, light);
      gr.addColorStop(0.45, main);
      gr.addColorStop(1, dark);
      rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, 2.2 * ps);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      // 가운데 빛 줄
      rr(ctx, x - w * 0.34, y - h * 0.14, w * 0.68, h * 0.28, h * 0.14);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fill();
      // 양 끝 작은 마름모
      ctx.fillStyle = '#FFFFFF';
      for (const sx of [-1, 1]) {
        const cx = x + sx * (w / 2 - h * 0.55);
        const r = h * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx, y - r);
        ctx.lineTo(cx + r, y);
        ctx.lineTo(cx, y + r);
        ctx.lineTo(cx - r, y);
        ctx.closePath();
        ctx.fill();
      }
      if (gold) {
        const tw = 0.5 + 0.5 * Math.sin(performance.now() / 140 + n.id);
        ctx.globalAlpha = a * tw;
        drawGlint(ctx, x - w * 0.22, y - h * 0.2, h * 0.7);
      }
      ctx.restore();
    }
  }

  /** 맞히면: 빛 기둥 + 판정선 위 납작한 빛 + 퍼지는 마름모 */
  _liveBursts(rt) {
    const ctx = this.ctx;
    const L = this.L;
    const N = this._liveNote();
    this.fx.booms.length = 0;
    this.fx.bursts = this.fx.bursts.filter((b) => rt - b.t0 < 0.34);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.fx.bursts) {
      const p = (rt - b.t0) / 0.34;
      if (p < 0) continue;
      const e = easeOut(p);
      const x = L.laneX[b.lane];
      const y = L.strikeY;
      const rgb = hexRgb(LANE[b.lane].light);
      // 빛 기둥
      const hgt = (L.strikeY - L.topY) * (0.3 + 0.25 * b.pow) * (0.6 + 0.4 * e);
      const w = L.laneW * 0.92 * (1 - p * 0.35);
      const gr = ctx.createLinearGradient(0, y - hgt, 0, y);
      gr.addColorStop(0, `rgba(${rgb},0)`);
      gr.addColorStop(0.7, `rgba(${rgb},${0.3 * (1 - p) * b.pow})`);
      gr.addColorStop(1, `rgba(255,255,255,${0.55 * (1 - p) * b.pow})`);
      this._trap(ctx, x - w / 2, x + w / 2, y - hgt, y);
      ctx.fillStyle = gr;
      ctx.fill();
      // 판정선 위 납작한 빛
      const rx = L.laneW * 0.6 * (1 + e * 0.3);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, (N.h * 1.1) / rx);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - p)})`);
      rg.addColorStop(0.4, `rgba(${rgb},${0.6 * (1 - p)})`);
      rg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 퍼지는 마름모 테두리
      const d = L.laneW * 0.16 * (1 + e * 1.8);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - p) * b.pow})`;
      ctx.lineWidth = 2.5 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y - d * 0.55);
      ctx.lineTo(x + d, y);
      ctx.lineTo(x, y + d * 0.55);
      ctx.lineTo(x - d, y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 가운데 큰 판정 글자 (가장 최근 것 하나) */
  /** 가운데 콤보 (콩 뒤에 흐리게) */
  _liveCombo(st, rt) {
    if (st.combo < 3) return;
    const ctx = this.ctx;
    const L = this.L;
    const p = clamp((rt - this.comboPopAt) / 0.15, 0, 1);
    const sc = 1 + (1 - easeOut(p)) * 0.18;
    const x = L.cx;
    const y = L.topY + (L.strikeY - L.topY) * 0.36;
    const size = L.GW * 0.15 * sc;
    const txt = String(st.combo);
    ctx.save();
    ctx.globalAlpha = 0.22; // 11-22 '콤보가 가림' → 콩 뒤에 아주 옅게
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic 900 ${Math.round(L.GW * 0.036)}px ${LIVE_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(L.GW * 0.012)}px`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('COMBO', x, y - size * 0.62);
    ctx.font = `italic 900 ${Math.round(size)}px ${LIVE_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const tw = ctx.measureText(txt).width;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = 'rgba(24,20,70,0.7)';
    ctx.strokeText(txt, x, y);
    if (st.combo >= 50) {
      const g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
      LIVE_JUDGE.PERFECT.c.forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#FFFFFF';
    ctx.fillText(txt, x, y);
    ctx.restore();
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
    // 세트 화면: 첫 판정이 뜨면 안내(말풍선·물결·한 줄)는 바로 꺼짐 — 가운데 PERFECT·콩을 가려서 (2026-11-22)
    if (label) this._ciLabelAt = rt;
    if (this.live && !label && (this._lastJudgeAt || 0) > (this._ciLabelAt || 0)) return;
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
      const t2 = this.melodyMode && i === SNARE ? '멜로디 (피아노)' : LANE[i].word;
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
      // 위를 가리키는 화살표 (통통 튐)
      const ay = zy + Math.sin(rt * 6) * zs * 0.2;
      const aw = zs * 0.75;
      ctx.beginPath();
      ctx.moveTo(L.laneX[i], ay - aw * 0.75);
      ctx.lineTo(L.laneX[i] + aw * 0.7, ay + aw * 0.1);
      ctx.lineTo(L.laneX[i] + aw * 0.25, ay + aw * 0.1);
      ctx.lineTo(L.laneX[i] + aw * 0.25, ay + aw * 0.7);
      ctx.lineTo(L.laneX[i] - aw * 0.25, ay + aw * 0.7);
      ctx.lineTo(L.laneX[i] - aw * 0.25, ay + aw * 0.1);
      ctx.lineTo(L.laneX[i] - aw * 0.7, ay + aw * 0.1);
      ctx.closePath();
      ctx.fill();
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
    const text = T.name;
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
    const big = clearText || info.big || `Lv.${info.round}`;
    const fs = fitFont(ctx, big, this.L.GW * 0.86, size);
    ctx.font = `${fs}px ${FONT}`;
    ctx.lineWidth = fs * 0.14;
    ctx.strokeStyle = INK;
    ctx.strokeText(big, x, y);
    ctx.fillStyle = '#FFD84A';
    ctx.fillText(big, x, y);
    const sub = clearText || info.sub != null ? info.sub || '' : `${info.name} · ${info.bpm} BPM`;
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
      this._roundText({ sub: s.bottom }, L.cx, top + L.GW * 0.12, L.GW * 0.17, s.endText || `Lv.${st.cleared} 클리어!`);
    } else if (!st.round || st.countIn || st.now < 0 || s.steady) {
      // 훅 (비트 형식은 치는 내내): 큰 흰 글씨 두 줄 + 작은 부제
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

  /** 영상 찍기 노래 맞히기: 위에 "이 노래 제목 맞혀봐!" + 가려진 제목 + 정답 공개까지 막대 → 곡이 끝나면 정답 */
  _drawStudioQuiz(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    const top = L.H * 0.045;
    if (st.finished) {
      if (s.revealAt == null) s.revealAt = rt;
      const age = rt - s.revealAt;
      // "정답은!" 이 먼저 → 0.5초 뒤 제목이 톡 튀어나옴
      const ls = Math.round(L.GW * 0.07);
      ctx.font = `${ls}px ${FONT}`;
      ctx.lineWidth = ls * 0.2;
      ctx.strokeText('정답은!', L.cx, top + ls * 0.6);
      ctx.fillStyle = '#FFD84A';
      ctx.fillText('정답은!', L.cx, top + ls * 0.6);
      const a2 = age - 0.5;
      if (a2 > 0) {
        const pop = a2 < 0.3 ? 0.6 + 0.4 * easeOut(a2 / 0.3) + Math.sin((a2 / 0.3) * Math.PI) * 0.15 : 1;
        const fs = fitFont(ctx, s.answer, L.GW * 0.9, L.GW * 0.15);
        const y = top + ls * 1.3 + fs * 0.65;
        ctx.save();
        ctx.translate(L.cx, y);
        ctx.scale(pop, pop);
        ctx.font = `${fs}px ${FONT}`;
        ctx.lineWidth = fs * 0.18;
        ctx.strokeText(s.answer, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(s.answer, 0, 0);
        ctx.restore();
        if (s.composer && a2 > 0.25) {
          const cs = Math.round(L.GW * 0.055);
          ctx.font = `${cs}px ${FONT}`;
          ctx.lineWidth = cs * 0.22;
          ctx.globalAlpha = Math.min(1, (a2 - 0.25) / 0.3);
          ctx.strokeText(s.composer, L.cx, y + fs * 0.62 + cs * 0.5);
          ctx.fillStyle = '#FFD84A';
          ctx.fillText(s.composer, L.cx, y + fs * 0.62 + cs * 0.5);
          ctx.globalAlpha = 1;
          if (s.bottomEnd) {
            const bs = fitFont(ctx, s.bottomEnd, L.GW * 0.9, L.GW * 0.048);
            ctx.font = `${bs}px ${FONT}`;
            ctx.lineWidth = bs * 0.22;
            ctx.strokeText(s.bottomEnd, L.cx, y + fs * 0.62 + cs * 1.6 + bs * 0.5);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(s.bottomEnd, L.cx, y + fs * 0.62 + cs * 1.6 + bs * 0.5);
          }
        }
      }
      ctx.restore();
      return;
    }
    s.revealAt = null;
    // 훅
    const words = (s.top || '').trim();
    const fs = fitFont(ctx, words, L.GW * 0.92, L.GW * 0.11);
    ctx.font = `${fs}px ${FONT}`;
    ctx.lineWidth = fs * 0.16;
    ctx.strokeText(words, L.cx, top + fs * 0.7);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(words, L.cx, top + fs * 0.7);
    let y = top + fs * 1.45;
    if (s.bottom) {
      const bs = fitFont(ctx, s.bottom, L.GW * 0.9, L.GW * 0.05);
      ctx.font = `${bs}px ${FONT}`;
      ctx.lineWidth = bs * 0.2;
      ctx.strokeText(s.bottom, L.cx, y + bs * 0.4);
      ctx.fillStyle = '#FFD84A';
      ctx.fillText(s.bottom, L.cx, y + bs * 0.4);
      y += bs * 1.5;
    }
    // 가려진 제목 카드 + 정답 공개까지 막대
    const cw = L.GW * 0.62;
    const ch = L.GW * 0.13;
    const beat = st.beatDur ? (Math.max(0, st.now) / st.beatDur) % 1 : 0;
    const bump = 1 + (st.now > 0 ? (1 - easeOut(Math.min(1, beat * 3))) * 0.04 : 0);
    ctx.save();
    ctx.translate(L.cx, y + ch * 0.6);
    ctx.scale(bump, bump);
    rr(ctx, -cw / 2, -ch / 2, cw, ch, ch * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    const qs = Math.round(ch * 0.56);
    ctx.font = `${qs}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText('제목: ? ? ?', 0, qs * 0.05);
    ctx.restore();
    const p = Math.max(0, Math.min(1, st.progress || 0));
    const bw = cw;
    const bh = L.GW * 0.022;
    const by = y + ch * 1.2 + bh;
    rr(ctx, L.cx - bw / 2, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(10,6,24,0.55)';
    ctx.fill();
    if (p > 0.01) {
      rr(ctx, L.cx - bw / 2, by, bw * p, bh, bh / 2);
      ctx.fillStyle = '#FFD84A';
      ctx.fill();
    }
    ctx.restore();
  }

  /** 박자 맞추기 카운트다운: 첫 쿵까지 남은 초를 크게 (5·4·3·2·1 → 시작!) */
  _drawSyncCountdown(st, rt) {
    const left = st.tempo.barStart(1) - st.now; // 채보 첫 쿵까지
    if (left <= -0.5 || left > this.studio.countdown + 0.05) return;
    const ctx = this.ctx;
    const L = this.L;
    const text = left > 0 ? String(Math.ceil(left - 1e-6)) : '시작!';
    const frac = left > 0 ? left - Math.floor(left - 1e-6) : 1; // 1 → 0 (숫자가 바뀔 때 1)
    const pop = 1 + Math.max(0, frac - 0.75) * 1.2;
    const fs = L.GW * (left > 0 ? 0.32 : 0.18);
    ctx.save();
    ctx.globalAlpha = left > 0 ? 1 : Math.max(0, 1 + left * 2);
    ctx.translate(L.cx, L.H * 0.43);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `${Math.round(fs)}px ${FONT}`;
    ctx.lineWidth = fs * 0.12;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = '#FFD84A';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** 💀 실패 영상: 치는 동안 위 문구 + 하트 줄 → 하트가 다 떨어지면 'N%에서 탈락' + 큰 도발 문구 */
  _drawStudioFail(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    const top = L.H * 0.045;
    if (st.dead) {
      if (s.deadAt == null) s.deadAt = rt;
      const age = rt - s.deadAt;
      // ① 'N%에서 탈락' (빨강) → ② 0.45초 뒤 도발 문구가 톡 → ③ 프로필 링크 안내
      const pct = Math.round(Math.max(0, Math.min(1, st.progress || 0)) * 100);
      const head = `${pct}%에서 탈락…`;
      const hs = fitFont(ctx, head, L.GW * 0.8, L.GW * 0.085);
      const y0 = L.H * 0.3;
      ctx.globalAlpha = Math.min(1, age / 0.2);
      ctx.font = `${hs}px ${FONT}`;
      ctx.lineWidth = hs * 0.2;
      ctx.strokeText(head, L.cx, y0);
      ctx.fillStyle = '#FF5A6E';
      ctx.fillText(head, L.cx, y0);
      ctx.globalAlpha = 1;
      const a2 = age - 0.45;
      if (a2 > 0) {
        const words = (s.bottom || '').trim();
        // 길면 가운데 띄어쓰기에서 두 줄로
        let lines = [words];
        if (words.length > 9) {
          const sp = [...words.matchAll(/ /g)].map((m) => m.index);
          if (sp.length) {
            const cut = sp.reduce((b, i) => (Math.abs(i - words.length / 2) < Math.abs(b - words.length / 2) ? i : b), sp[0]);
            lines = [words.slice(0, cut), words.slice(cut + 1)];
          }
        }
        const fs = Math.min(...lines.map((l) => fitFont(ctx, l, L.GW * 0.92, L.GW * 0.15)));
        const pop = a2 < 0.3 ? 0.6 + 0.4 * easeOut(a2 / 0.3) + Math.sin((a2 / 0.3) * Math.PI) * 0.15 : 1 + Math.sin(a2 * 5) * 0.02;
        const yc = y0 + hs * 0.9 + (fs * 1.15 * lines.length) / 2;
        ctx.save();
        ctx.translate(L.cx, yc);
        ctx.scale(pop, pop);
        ctx.font = `${fs}px ${FONT}`;
        ctx.lineWidth = fs * 0.18;
        lines.forEach((l, i) => {
          const y = (i - (lines.length - 1) / 2) * fs * 1.15;
          ctx.strokeText(l, 0, y);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(l, 0, y);
        });
        ctx.restore();
        if (s.bottomEnd && a2 > 0.5) {
          const bs = fitFont(ctx, s.bottomEnd, L.GW * 0.8, L.GW * 0.05);
          ctx.font = `${bs}px ${FONT}`;
          ctx.globalAlpha = Math.min(1, (a2 - 0.5) / 0.3);
          const tw = ctx.measureText(s.bottomEnd).width + bs * 1.4;
          const by = yc + (fs * 1.15 * lines.length) / 2 + bs * 1.6;
          rr(ctx, L.cx - tw / 2, by - bs, tw, bs * 2, bs);
          ctx.fillStyle = '#FF8A4C';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(s.bottomEnd, L.cx, by + bs * 0.05);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
      return;
    }
    s.deadAt = null;
    // 치는 동안: 위 문구 + 곡 이름 + 하트 줄
    const words = (s.top || '').trim();
    const fs = fitFont(ctx, words, L.GW * 0.92, L.GW * 0.11);
    ctx.font = `${fs}px ${FONT}`;
    ctx.lineWidth = fs * 0.16;
    ctx.strokeText(words, L.cx, top + fs * 0.7);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(words, L.cx, top + fs * 0.7);
    let y = top + fs * 1.45;
    if (s.label) {
      const ls = fitFont(ctx, s.label, L.GW * 0.9, L.GW * 0.045);
      ctx.font = `${ls}px ${FONT}`;
      ctx.lineWidth = ls * 0.22;
      ctx.strokeText(s.label, L.cx, y + ls * 0.4);
      ctx.fillStyle = '#FFD84A';
      ctx.fillText(s.label, L.cx, y + ls * 0.4);
      y += ls * 1.4;
    }
    const max = st.maxLives || 5;
    const lives = st.lives == null ? max : st.lives;
    const hs = L.GW * 0.085;
    const gap = hs * 1.15;
    const f = this.lifeFx;
    for (let i = 0; i < max; i++) {
      const hx = L.cx + (i - (max - 1) / 2) * gap;
      const hy = y + hs * 0.6;
      const full = i < lives;
      // 방금 깎인 하트: 크게 튀었다가 꺼짐
      const justLost = f && f.delta < 0 && i === lives && rt - f.t0 < 0.4;
      const k = justLost ? 1 + (1 - (rt - f.t0) / 0.4) * 0.5 : 1;
      ctx.fillStyle = full || justLost ? '#FF4D6D' : 'rgba(40,28,60,0.7)';
      ctx.lineWidth = hs * 0.09;
      heartPath(ctx, hx, hy, hs * k);
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawStudio(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    if (s.cover) return; // 릴스 썸네일: 글씨는 cover.js 가 따로 그림
    if (s.countdown && st.tempo) this._drawSyncCountdown(st, rt);
    if (s.quiz) {
      this._drawStudioQuiz(st, rt);
      return;
    }
    if (s.challenge) {
      this._drawStudioChallenge(st, rt);
      return;
    }
    if (s.fail) {
      this._drawStudioFail(st, rt);
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

// ---------------- ✨ 콩 스킨 그림 (2026-11-22) ----------------
function drawGlint(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}
function drawHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fill();
}
/** 노트 그림에 질감 입히기 (그림 모양 안쪽만: source-atop) */
function skinTexture(src, tex, lane) {
  const c = document.createElement('canvas');
  const W = (c.width = src.width);
  const H = (c.height = src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const lin = (stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  };
  let seed = 7 + lane * 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (tex === 'gold') {
    lin([[0, 'rgba(255,250,205,0.92)'], [0.35, 'rgba(255,205,50,0.85)'], [0.6, 'rgba(190,120,0,0.85)'], [1, 'rgba(255,225,110,0.9)']]);
  } else if (tex === 'galaxy') {
    const gr = g.createRadialGradient(W * 0.35, H * 0.35, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(255,120,220,0.9)');
    gr.addColorStop(0.45, 'rgba(110,50,220,0.92)');
    gr.addColorStop(1, 'rgba(20,10,70,0.95)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF';
    for (let i = 0; i < (W * H) / 300; i++) {
      g.globalAlpha = 0.4 + rnd() * 0.6;
      const s = 0.6 + rnd() * 1.6;
      g.fillRect(rnd() * W, rnd() * H, s, s);
    }
    g.globalAlpha = 1;
  } else if (tex === 'ice') {
    lin([[0, 'rgba(255,255,255,0.75)'], [0.5, 'rgba(160,230,255,0.5)'], [1, 'rgba(80,170,230,0.6)']], 0, 0, W, H);
  } else if (tex === 'flame') {
    lin([[0, 'rgba(255,240,140,0.85)'], [0.4, 'rgba(255,140,20,0.8)'], [1, 'rgba(200,20,0,0.85)']]);
  } else if (tex === 'heart') {
    lin([[0, 'rgba(255,230,245,0.8)'], [0.5, 'rgba(255,110,180,0.7)'], [1, 'rgba(200,40,120,0.75)']]);
  } else if (tex === 's1') {
    // 남색 → 보라 바탕 + 가운데 금빛 「1」 (테두리 진하게, 위아래 금 그라데이션)
    lin([[0, 'rgba(70,90,200,0.92)'], [0.55, 'rgba(25,30,95,0.95)'], [1, 'rgba(12,14,50,0.97)']]);
    const fs = Math.round(H * 0.86);
    g.font = `900 ${fs}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const gold = g.createLinearGradient(0, H * 0.1, 0, H * 0.9);
    gold.addColorStop(0, '#FFF7C2');
    gold.addColorStop(0.45, '#FFD23F');
    gold.addColorStop(1, '#C88A00');
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, fs * 0.14);
    g.strokeStyle = 'rgba(10,12,40,0.95)';
    g.strokeText('1', W / 2, H * 0.53);
    g.fillStyle = gold;
    g.fillText('1', W / 2, H * 0.53);
  } else if (tex === 'cyber') {
    lin([[0, 'rgba(10,10,30,0.75)'], [1, 'rgba(10,10,30,0.85)']]);
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = lane % 2 ? 'rgba(255,40,220,0.95)' : 'rgba(0,240,255,0.95)';
    g.lineWidth = Math.max(1, H * 0.05);
    for (let y = H * 0.25; y < H; y += H * 0.22) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  }
  // 빛 줄 (비스듬히)
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(W * 0.2, 0, W * 0.6, H);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.45, `rgba(255,255,255,${tex === 'cyber' ? 0.15 : 0.55})`);
  sh.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);
  // 테두리 빛 (사이버·은하수)
  if (tex === 'cyber' || tex === 'galaxy' || tex === 'gold' || tex === 's1') {
    g.globalCompositeOperation = 'source-over';
    g.save();
    g.shadowColor = tex === 'cyber' ? (lane % 2 ? '#FF2BD6' : '#00F0FF') : tex === 'gold' || tex === 's1' ? '#FFE27A' : '#D9A8FF';
    g.shadowBlur = H * 0.08; // 테두리 빛은 콩 바로 둘레만
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(src, 0, 0);
    g.restore();
  }
  return c;
}

// 🛒 상점 배경 그림 받아 두기 (한 번 받으면 계속 씀)
const _shopBg = new Map();
function shopBg(src, onLoad) {
  let e = _shopBg.get(src);
  if (!e) {
    const img = new Image();
    e = { img, ok: false, wait: [] };
    _shopBg.set(src, e);
    img.onload = () => {
      e.ok = true;
      const w = e.wait;
      e.wait = [];
      w.forEach((f) => f());
    };
    img.src = src;
  }
  if (e.ok) return e.img;
  if (onLoad && e.wait.length < 4) e.wait.push(onLoad);
  return null;
}
function preloadShopBg(src) {
  return new Promise((res) => {
    if (shopBg(src, () => res(true))) res(true);
    setTimeout(() => res(false), 6000);
  });
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

/** 쿵콩이·짝콩이 그림을 화면 크기에 맞게 미리 줄여 둠 (매 프레임 큰 그림을 줄이면 느림) */
function shrinkBuddies(imgs, px) {
  const out = { kong: {}, jjak: {} };
  for (const who of ['kong', 'jjak'])
    for (const [pose, im] of Object.entries(imgs[who])) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.max(1, px);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, px, px);
      out[who][pose] = c;
    }
  return out;
}

return { LANE, NOTE_PALETTES, applyNoteColors, JUDGE_STYLE, Renderer, preloadShopBg };
})();

// ---- shoppreview.js ----
const __m_shoppreview = (() => {
// 🛒 상점 미리보기 (2026-11-22, 사용자 요청 '누르면 미리보기'): 실제 게임 화면을 작은 캔버스에 돌려 보여 줌
//   고른 물건만 바꾸고 나머지는 지금 쓰는 꾸미기 그대로. 콩이 내려와 저절로 PERFECT 로 맞음. 서버 요청 없음
//   콩 색은 LANE 을 바꿔야 해서(applyNoteColors) 닫을 때 main 이 원래 색으로 돌려놓음

const { Renderer, applyNoteColors, LANE } = __m_render;
const { buildKit } = __m_kit3d;
const { THEMES, SHOP_KITS } = __m_themes;
const { LEVELS, LAST_LEVEL_ID, levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } = __m_charts;

let cur = null; // { r, raf, cv }

/** 4줄(쿵·짝·하이햇·크래시)이 다 나오는 단계 하나 */
function sampleLevel() {
  const ok = LEVELS.filter((l) => l.id >= 5 && l.id <= LAST_LEVEL_ID && !l.long && !l.xmas && levelLanes(l).length >= 4);
  return ok[0] || LEVELS.find((l) => l.id === 4) || LEVELS[0];
}

/** 사진 배경 미리보기용 예시 그림 (내 사진이 아직 없을 때) */
function samplePhoto() {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 640;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 360, 640);
  gr.addColorStop(0, '#ffb3c7');
  gr.addColorStop(0.5, '#ffd6a5');
  gr.addColorStop(1, '#9bd3ff');
  g.fillStyle = gr;
  g.fillRect(0, 0, 360, 640);
  g.font = '120px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('📷', 180, 250);
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillStyle = '#fff';
  g.fillText('내 사진', 180, 360);
  return c;
}

function stopShopPreview() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf);
  cur = null;
}

/**
 * @param {HTMLCanvasElement} cv  화면에 붙어 있는 캔버스 (CSS 크기가 정해져 있어야 함)
 * @param {{ bg, kit, notes, ui, photo }} o  bg·kit = 'auto' | 맵 키 | 'photo', notes = 콩 색 키, ui = 'live'(세트) | 'basic', photo = 내 사진 Image (없으면 예시)
 */
async function startShopPreview(cv, { bg, kit, notes, ui, photo }) {
  stopShopPreview();
  const me = {};
  cur = me;
  const lv = sampleLevel();
  const r = new Renderer(cv);
  r.laneOrder = levelLanes(lv);
  r.newLane = -1;
  r.quality = 2;
  r.bgPick = bg && bg !== 'auto' ? bg : null;
  r.kitPick = kit && kit !== 'auto' ? kit : null;
  r.uiStyle = ui === 'live' || ui === 's1' ? ui : null;
  if (bg === 'photo') {
    r.bgPhoto = photo || samplePhoto();
    r.photoDim = 0.35;
  }
  applyNoteColors(notes || 'basic');
  r.setTheme(lv);
  await r.resize(2);
  if (cur !== me) return;
  const tempo = tempoOf(lv);
  const all = buildNotes(lv);
  const from = tempo.barStart(COUNT_IN_BARS + 2);
  const to = tempo.barStart(COUNT_IN_BARS + 6);
  const beat = 60 / tempo.bpm(0);
  let notesNow = [];
  let next = 0;
  const reset = () => {
    notesNow = all.filter((n) => n.time >= from - 0.5 && n.time < to + 3).map((n) => ({ ...n, judged: n.time < from, result: n.time < from ? 'perfect' : null }));
    next = notesNow.findIndex((n) => !n.judged);
    if (next < 0) next = notesNow.length;
  };
  reset();
  let combo = 0;
  let score = 0;
  const t0 = performance.now() / 1000;
  let loopAt = t0;
  const tick = () => {
    if (cur !== me) return;
    const rt = performance.now() / 1000;
    let now = from + (rt - loopAt);
    if (now >= to) {
      loopAt = rt;
      now = from;
      combo = 0;
      reset();
    }
    // 판정선에 닿은 콩은 저절로 PERFECT
    while (next < notesNow.length && notesNow[next].time <= now) {
      const n = notesNow[next++];
      n.judged = true;
      n.result = 'perfect';
      combo++;
      score += 100;
      try {
        r.onTap(n.lane, rt);
        r.onJudge(n.lane, 'perfect', rt, false);
      } catch {}
    }
    const st = { now, notes: notesNow, approach: 1.6, beatDur: beat, tempo, combo, score, playing: true, heat: 0.6, hatAge: 0.05, crashAge: 0.1, rolls: [] };
    try {
      r.draw(st, rt);
    } catch {}
    me.raf = requestAnimationFrame(tick);
  };
  me.raf = requestAnimationFrame(tick);
}

/** 🥁 드럼 세트 크게 보기 (게임 화면에선 드럼이 작아서 차이가 잘 안 보임) */
function drawKitCloseup(cv, kitKey) {
  const theme = SHOP_KITS[kitKey] ? { kit: SHOP_KITS[kitKey].kit } : THEMES[kitKey];
  if (!theme) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth || 240;
  const H = cv.clientHeight || 120;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2A1B4A');
  bg.addColorStop(1, '#0E0820');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const R = H * 0.3;
  const kit = buildKit(theme, { instR: R, padR: R * 0.8, barW: R * 2, barH: R * 0.3, cymR: R * 1.1, dpr, standTo: H * 0.35 }, LANE);
  const put = (sp, x, y, k = 1) => g.drawImage(sp.img, x - sp.ax * k, y - sp.ay * k, sp.w * k, sp.h * k);
  put(kit.cym, W * 0.2, H * 0.3, 0.9);
  put(kit.cym, W * 0.82, H * 0.24, 1);
  put(kit.snare, W * 0.73, H * 0.55, 0.9);
  put(kit.kick, W * 0.42, H * 0.5, 1);
}

return { stopShopPreview, startShopPreview, drawKitCloseup };
})();

// ---- usermap.js ----
const __m_usermap = (() => {
// 🌍 유저 맵 (브라우저와 서버가 같이 씀)
//   유저가 피아노로 멜로디를 찍고(또는 노래 파일에서 음을 따서) 드럼 채보를 붙여 올리는 맵.
//   올라가는 건 음표 데이터뿐 (노래 파일은 폰 밖으로 안 나감). 서버는 cleanMap 으로 검사해서 저장.
//
//   맵 모양: { name, bpm, bars: ['K...S...', …], melody: ['C5 E5:2 _:2 …', …], prog: ['C', 'F G', …] }
//     bars = 드럼 채보(charts.js 표기), melody = 마디별 멜로디(charts.js 표기), prog = 마디별 코드(자동)

const { STEPS_PER_BAR, parseMelody, parseChord, CHAR_LANES, KICK, SNARE, HAT, CRASH } = __m_charts;
const { DECO_THEMES, NOTE_FREE } = __m_shop;

/** 🎨 만든 사람이 고르는 맵 꾸미기 (2026-11-23 사용자): 상점의 무료 것만 — 무대·드럼 = 맵 8개, 콩 = 색 콩 */
const MAP_DECO = { bg: DECO_THEMES, kit: DECO_THEMES, notes: NOTE_FREE };

const MAP_LIMITS = { minBars: 2, maxBars: 64, minBpm: 60, maxBpm: 180, nameMax: 30, minNotes: 8 };
const DRUM_RE = /^[KSHCBJX.]{16}$/;
const LOW = 36; // C2
const HIGH = 96; // C7
const LOW_LH = 24; // C1 (왼손 베이스는 더 낮게)

// ---------- 음이름 ----------
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
/** 한국식 계이름 (건반 글자) */
const SOLFA = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

// ---------- 멜로디: 마디별 음표 배열 ↔ 문자열 ----------
/** [{ step, midi, len }] (한 마디) → 'C5:2 _:2 E5:4 …' (빈 칸은 쉼) */
function barToMelody(notes) {
  const out = [];
  let at = 0;
  for (const n of [...notes].sort((a, b) => a.step - b.step)) {
    if (n.step < at) continue;
    if (n.step > at) out.push(`_:${n.step - at}`);
    const len = Math.max(1, Math.min(n.len, STEPS_PER_BAR - n.step));
    out.push(`${midiName(n.midi)}:${len}`);
    at = n.step + len;
  }
  if (at < STEPS_PER_BAR) out.push(`_:${STEPS_PER_BAR - at}`);
  return out.join(' ');
}
/** 멜로디 문자열 배열 → 마디별 음표 배열 */
function melodyToBars(melody) {
  const bars = melody.map(() => []);
  for (const n of parseMelody(melody)) bars[n.bar].push({ step: n.step, midi: n.midi, len: n.len });
  return bars;
}

// ---------- 드럼 칸: 글자 ↔ 악기 ----------
/** 채보 글자 → { K, S, H, C } 켜짐 */
function drumCell(ch) {
  const lanes = CHAR_LANES[ch] || [];
  return { K: lanes.includes(KICK), S: lanes.includes(SNARE), H: lanes.includes(HAT), C: lanes.includes(CRASH) };
}
/**
 * 악기 켜짐 → 글자. 같은 엄지(킥·크래시 / 스네어·하이햇)는 동시에 못 쳐서 하나만.
 *   크래시+하이햇은 글자가 없어서 크래시만
 */
function cellChar({ K, S, H, C }) {
  const left = C ? 'C' : K ? 'K' : '';
  const right = S ? 'S' : H ? 'H' : '';
  if (left === 'K' && right === 'S') return 'B';
  if (left === 'K' && right === 'H') return 'J';
  if (left === 'C' && right === 'S') return 'X';
  if (left === 'C') return 'C';
  return left || right || '.';
}
/** 칸에서 악기 하나 켜기/끄기 (같은 엄지 악기는 꺼짐) */
function toggleDrum(ch, inst) {
  const c = drumCell(ch);
  const on = !c[inst];
  if (on) {
    if (inst === 'K') c.C = false;
    if (inst === 'C') (c.K = false), (c.H = false);
    if (inst === 'S') c.H = false;
    if (inst === 'H') (c.S = false), (c.C = false);
  }
  c[inst] = on;
  return cellChar(c);
}

// ---------- 화음 자동 ----------
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
/** 멜로디 전체에서 가장 그럴듯한 장조 으뜸음 (0 = C) */
function guessKey(bars) {
  const w = new Array(12).fill(0);
  for (const bar of bars) for (const n of bar) w[n.midi % 12] += n.len;
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < 12; k++) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += w[(i + k) % 12] * MAJOR_PROFILE[i];
    if (s > bestScore) (bestScore = s), (best = k);
  }
  return best;
}
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/**
 * 멜로디 → 마디별 코드 (반 마디씩). 그 조의 I·ii·iii·IV·V·vi 중 멜로디 음을 가장 많이 품는 것.
 *   비슷하면 I·IV·V, 그리고 앞 코드 유지를 좋아함. 멜로디가 없는 칸은 앞 코드 그대로
 */
function harmonize(bars) {
  const key = guessKey(bars);
  const degrees = [
    [0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'],
  ].map(([d, q], i) => {
    const root = (key + d) % 12;
    const tones = [root, (root + (q ? 3 : 4)) % 12, (root + 7) % 12];
    return { name: KEY_NAMES[root] + q, tones, bonus: [0.3, 0, 0, 0.2, 0.25, 0.1][i] };
  });
  let prev = degrees[0];
  const prog = [];
  for (const bar of bars) {
    const halves = [];
    for (let h = 0; h < 2; h++) {
      const w = new Array(12).fill(0);
      let total = 0;
      for (const n of bar) {
        const a = Math.max(n.step, h * 8);
        const b = Math.min(n.step + n.len, h * 8 + 8);
        if (b <= a) continue;
        // 박 첫머리 음에 더 무게
        const weight = (b - a) * (n.step % 4 === 0 ? 1.5 : 1);
        w[n.midi % 12] += weight;
        total += weight;
      }
      if (!total) {
        halves.push(prev);
        continue;
      }
      let best = prev;
      let bestScore = -Infinity;
      for (const d of degrees) {
        let s = 0;
        for (let pc = 0; pc < 12; pc++) s += d.tones.includes(pc) ? w[pc] : -0.6 * w[pc];
        s = s / total + d.bonus + (d === prev ? 0.15 : 0);
        if (s > bestScore) (bestScore = s), (best = d);
      }
      halves.push(best);
      prev = best;
    }
    prog.push(halves[0] === halves[1] ? halves[0].name : `${halves[0].name} ${halves[1].name}`);
  }
  return prog;
}

// ---------- 드럼 자동 ----------
/**
 * 멜로디에 맞춘 드럼 채보 (쉬움 · 보통 · 어려움)
 *   쉬움: 쿵(1·3박) 짝(2·4박) / 보통: + 멜로디가 8분 자리에서 시작하면 쿵·짝 / 어려움: + 하이햇 8분, 8마디마다 크래시
 *   멜로디가 쉬는 마디는 단순하게
 */
function autoDrums(bars, diff = 'normal') {
  return bars.map((bar, b) => {
    const cells = new Array(STEPS_PER_BAR).fill('.');
    const on = (s, inst) => (cells[s] = cellChar({ ...drumCell(cells[s]), [inst]: true }));
    on(0, 'K');
    on(8, 'K');
    on(4, 'S');
    on(12, 'S');
    if (diff !== 'easy') {
      for (const n of bar) {
        if (n.step % 2) continue;
        if (n.step % 4 === 0) continue; // 정박은 이미 있음
        // 8분 엇박: 앞 박이 쿵이면 짝, 짝이면 쿵 (번갈아)
        const prevBeat = Math.floor(n.step / 4) % 2;
        on(n.step, prevBeat ? 'K' : 'S');
      }
    }
    if (diff === 'hard') {
      for (let s = 0; s < STEPS_PER_BAR; s += 2) if (cells[s] === '.' || cells[s] === 'K') on(s, 'H');
      for (const n of bar) if (n.step % 2 && n.len >= 2) on(n.step, 'H');
      if (b % 8 === 0) cells[0] = 'X';
    } else if (diff === 'normal' && b % 8 === 0 && b > 0) cells[0] = 'X';
    return cells.join('');
  });
}

// ---------- 검사 (서버가 저장 전에) ----------
/** 맵 하나 검사 → 깨끗한 맵 (이상하면 null) */
function cleanMap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (![...name].length || [...name].length > MAP_LIMITS.nameMax) return null;
  const bpm = Math.round(Number(raw.bpm) * 10) / 10;
  if (!(bpm >= MAP_LIMITS.minBpm && bpm <= MAP_LIMITS.maxBpm)) return null;
  const bars = raw.bars;
  if (!Array.isArray(bars) || bars.length < MAP_LIMITS.minBars || bars.length > MAP_LIMITS.maxBars) return null;
  if (!bars.every((b) => typeof b === 'string' && DRUM_RE.test(b))) return null;
  let notes = 0;
  for (const b of bars) for (const c of b) notes += (CHAR_LANES[c] || []).length;
  if (notes < MAP_LIMITS.minNotes) return null;
  const melody = raw.melody;
  if (!Array.isArray(melody) || melody.length !== bars.length || !melody.every((m) => typeof m === 'string' && m.length <= 200)) return null;
  try {
    for (const n of parseMelody(melody)) if (n.midi < LOW || n.midi > HIGH) return null;
  } catch {
    return null;
  }
  const prog = raw.prog;
  if (!Array.isArray(prog) || prog.length !== bars.length) return null;
  try {
    for (const p of prog) {
      const parts = String(p).trim().split(/\s+/);
      if (parts.length < 1 || parts.length > 2) return null;
      parts.forEach(parseChord);
    }
  } catch {
    return null;
  }
  const out = { name, bpm, bars: [...bars], melody: melody.map((m) => m.trim().replace(/\s+/g, ' ')), prog: prog.map((p) => String(p).trim().replace(/\s+/g, ' ')) };
  // 🎹 왼손(아래 줄, 악보에서) — 있으면 자동 베이스 대신 이걸 침. 이상하면 빼고 맵은 그대로
  const low = raw.low;
  if (Array.isArray(low) && low.length === bars.length && low.every((m) => typeof m === 'string' && m.length <= 200)) {
    try {
      const ns = parseMelody(low);
      if (ns.length && ns.every((n) => n.midi >= LOW_LH && n.midi <= HIGH)) out.low = low.map((m) => m.trim().replace(/\s+/g, ' '));
    } catch {}
  }
  // 🎨 꾸미기(있을 때만, 무료 것만). 이상한 값은 빼고 맵은 살림
  const deco = raw.deco;
  if (deco && typeof deco === 'object') {
    const d = {};
    for (const [k, list] of Object.entries(MAP_DECO)) if (typeof deco[k] === 'string' && list.includes(deco[k])) d[k] = deco[k];
    if (Object.keys(d).length) out.deco = d;
  }
  return out;
}

/** 노트 수로 어림한 난이도 1~5 (초당 노트) */
function mapDifficulty(map) {
  let notes = 0;
  for (const b of map.bars) for (const c of b) if (c !== '.') notes++;
  const sec = (map.bars.length * 4 * 60) / map.bpm;
  const nps = notes / sec;
  return nps < 1.6 ? 1 : nps < 2.4 ? 2 : nps < 3.4 ? 3 : nps < 4.6 ? 4 : 5;
}

/** 멜로디 없이 드럼만 있는 맵인지 */
function isDrumOnly(map) {
  return map.melody.every((m) => !/[A-G]/.test(m));
}

const THEME_KEYS = ['sunset', 'city', 'hall', 'aurora', 'void', 'space', 'lava'];
/** 맵 → 게임 단계 */
function mapLevel(map, { id = 'um', by = '', mapId = null } = {}) {
  let h = 0;
  for (const ch of String(mapId || map.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id,
    custom: true,
    userMap: true,
    mapId,
    name: map.name,
    composer: by ? `${by} 님 맵` : '유저 맵',
    songName: map.name,
    tagline: '',
    theme: (map.deco && map.deco.bg) || THEME_KEYS[h % THEME_KEYS.length],
    // 🎨 만든 사람이 고른 드럼·콩 색 (치는 사람이 상점에서 장착한 게 있으면 그게 먼저, main.js setKit)
    deco: map.deco || null,
    difficulty: mapDifficulty(map),
    bpm: map.bpm,
    bars: map.bars,
    song: {
      prog: map.prog,
      melody: map.melody,
      // 🎹 악보 왼손(있을 때만) — 자동 베이스는 끄고 이걸 피아노로
      low: map.low || null,
      hat: '................',
      // 🥁 드럼만 맵(멜로디가 다 쉼)은 베이스·화음도 안 깔고 드럼만
      bass: isDrumOnly(map) || map.low ? '................' : 'x.......x.......',
      chord: isDrumOnly(map) ? '................' : 'x.......x.......',
    },
  };
}

// ---------- 🎙 노래 파일에서 멜로디 따기 (초안) ----------
//   16분 칸마다 소리의 주파수를 보고(배음 더하기) 가장 센 음 하나를 고름 → 같은 음이 이어지면 한 음으로.
//   반주가 꽉 찬 노래는 지저분하게 나와서, 만든 뒤 손으로 다듬는 용도

/** 제자리 FFT (re, im 길이 2의 거듭제곱) */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * 노래 → 마디별 멜로디 음표 초안
 *   input = 모노 Float32Array 또는 [왼쪽, 오른쪽]. 스테레오면 '가운데 소리'만 봄:
 *   보컬은 거의 늘 가운데, 신스·코드·기타는 좌우로 퍼져 있어서 좌우가 다른 소리를 빼면 보컬이 또렷해짐 (K-pop 처럼 반주가 꽉 찬 곡)
 *   그다음 칸마다 음 후보 점수(배음 더하기)를 매기고, 음이 크게 튀지 않는 길을 고름(비터비)
 * @param {Float32Array | Float32Array[]} input
 * @param {number} sr
 * @param {{ firstBeat: number, bpm: number, bars: number, lo?: number, hi?: number }} o
 * @returns {{ bars: Array<Array<{step,midi,len}>>, found: number }}
 */
// 음 따기 설정 (11-21 시험장에서 고름: 사람 목소리 비슷한 소리 + 팝 반주 24곡, 8분 칸 정답률 62% → 87%, scripts/melody-bench.mjs)
const POSS = [0.5, 0.8]; // 16분 칸 안에서 볼 자리 (음 첫머리 끌어올림을 피해 조금 뒤쪽)
const WHITEN = 0.8; // 스펙트럼 고르게 하는 세기
const KEYTH = 0.03; // 곡에서 이보다 드문 '조 밖 음'만 음계 음으로 고침
const KEYTH_STRAY = 0.1; // 짧게 튀는 조 밖 음은 이 정도까지
function transcribe(input, sr, { firstBeat, bpm, bars, lo = 45, hi = 88 }) {
  const chans = input instanceof Float32Array ? [input] : input;
  const L = chans[0];
  const R = chans[chans.length - 1];
  const stereo = L !== R;
  const len = L.length;
  const mono = stereo ? new Float32Array(len) : L;
  if (stereo) for (let i = 0; i < len; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const N = 4096;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const reR = new Float64Array(N);
  const imR = new Float64Array(N);
  const stepSec = 60 / bpm / 4;
  const steps = bars * STEPS_PER_BAR;
  const binHz = sr / N;
  const C = hi - lo + 1;
  const comp = stereo ? 0.5 : 1; // 세기 눌러 주기 (가운데만 남기면 큰 소리가 덜 몰려서 √ 가 나음)
  const kMin = Math.floor(100 / binHz);
  const kMax = Math.min(N / 2 - 2, Math.ceil(5000 / binHz));
  const sal = new Float32Array(steps * C);
  const energy = new Float32Array(steps);
  const mag = new Float32Array(N / 2);
  const wmag = new Float32Array(N / 2);
  const csum = new Float64Array(N / 2 + 1);
  const peak = (k) => Math.max(mag[k - 1], mag[k], mag[k + 1]);
  for (let s = 0; s < steps; s++) for (const pos of POSS) {
    // 칸 안 몇 군데(음이 울리는 중)를 보고 더함 — 음 첫머리 끌어올림(스쿱)에 덜 속게
    const a = Math.round((firstBeat + s * stepSec + stepSec * pos) * sr) - N / 2;
    if (a < 0 || a + N > len) continue;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = mono[a + i];
      e += v * v;
      re[i] = L[a + i] * win[i];
      im[i] = 0;
      if (stereo) (reR[i] = R[a + i] * win[i]), (imR[i] = 0);
    }
    energy[s] += Math.sqrt(e / N) / POSS.length;
    fft(re, im);
    if (stereo) fft(reR, imR);
    mag.fill(0);
    for (let k = kMin; k <= kMax; k++) {
      let m;
      if (stereo) {
        const sr2 = re[k] + reR[k];
        const si = im[k] + imR[k];
        const dr = re[k] - reR[k];
        const di = im[k] - imR[k];
        const S = sr2 * sr2 + si * si;
        const D = dr * dr + di * di;
        // 좌우가 같을수록 1, 다를수록 0
        const w = S + D > 0 ? Math.max(0, (S - D) / (S + D)) : 0;
        m = Math.sqrt(S) * 0.5 * w * w * w;
      } else m = Math.hypot(re[k], im[k]);
      mag[k] = comp === 1 ? m : Math.pow(m, comp);
    }
    // 스펙트럼 고르게 (whitening): 둘레 평균으로 나눔 → 큰 베이스·패드가 낮은 쪽에서 표를 몰아가지 않게
    {
      csum[0] = 0;
      for (let k = 0; k < N / 2; k++) csum[k + 1] = csum[k] + mag[k];
      for (let k = kMin; k <= kMax; k++) {
        const hw = Math.max(3, Math.round(k * 0.12));
        const a2 = Math.max(0, k - hw);
        const b2 = Math.min(N / 2, k + hw + 1);
        const avg = (csum[b2] - csum[a2]) / (b2 - a2);
        wmag[k] = avg > 0 ? mag[k] / Math.pow(avg, WHITEN) : 0;
      }
      for (let k = kMin; k <= kMax; k++) mag[k] = wmag[k];
    }
    for (let j = 0; j < C; j++) {
      const f0 = 440 * Math.pow(2, (lo + j - 69) / 12);
      let v = 0;
      let odd = 0;
      let even = 0;
      for (let h = 1; h <= 8; h++) {
        const k = Math.round((f0 * h) / binHz);
        if (k + 1 > kMax) break;
        const p = Math.pow(0.84, h - 1) * peak(k);
        v += p;
        if (h % 2) odd += p;
        else even += p;
      }
      // 한 옥타브 아래 가짜 후보: 진짜 음의 배음은 짝수 자리에만 걸리고 홀수 자리(1·3·5배)는 비어 있음 → 깎음
      if (odd + even > 0) v *= Math.min(1, (2.2 * odd) / (odd + even));
      // 아래 옥타브 배음에 속지 않게: 반 주파수·1.5배 자리에도 힘이 크면 깎음
      const kh = Math.round(f0 / 2 / binHz);
      if (kh > kMin) v -= 0.3 * peak(kh);
      const k15 = Math.round((f0 * 1.5) / binHz);
      if (k15 + 1 <= kMax) v -= 0.2 * peak(k15);
      sal[s * C + j] += Math.max(0, v);
    }
  }
  // 칸마다 점수 → 로그 (가장 센 후보 = 0), 쉼 점수는 소리가 작거나 음이 또렷하지 않으면 높게
  let maxE = 0;
  for (let s = 0; s < steps; s++) if (energy[s] > maxE) maxE = energy[s];
  const S1 = C + 1;
  const emit = new Float32Array(steps * S1);
  for (let s = 0; s < steps; s++) {
    let mx = 0;
    let sum = 0;
    for (let j = 0; j < C; j++) (mx = Math.max(mx, sal[s * C + j])), (sum += sal[s * C + j]);
    const voiced = energy[s] >= maxE * 0.12 && mx > 0 && mx / (sum / C) > 1.6;
    for (let j = 0; j < C; j++) emit[s * S1 + j] = mx > 0 ? Math.log(sal[s * C + j] / mx + 1e-3) : -7;
    emit[s * S1 + C] = voiced ? -2.5 : 0;
  }
  // 비터비: 음이 바뀌거나 멀리 튀면 벌점 (한 옥타브 넘게 튀면 크게)
  const tr = (x, y) => {
    if (x === y) return 0;
    if (x === C || y === C) return -1;
    const d = Math.abs(x - y);
    return -0.1 - 0.03 * Math.min(12, d) - (d > 12 ? 2 : 0);
  };
  let prev = new Float32Array(S1);
  let next = new Float32Array(S1);
  const back = new Int16Array(steps * S1);
  for (let j = 0; j < S1; j++) prev[j] = emit[j];
  for (let s = 1; s < steps; s++) {
    for (let y = 0; y < S1; y++) {
      let bv = -Infinity;
      let bi = 0;
      for (let x = 0; x < S1; x++) {
        const v = prev[x] + tr(x, y);
        if (v > bv) (bv = v), (bi = x);
      }
      next[y] = bv + emit[s * S1 + y];
      back[s * S1 + y] = bi;
    }
    [prev, next] = [next, prev];
  }
  const pitch = new Int16Array(steps).fill(-1);
  let bi = 0;
  for (let j = 1; j < S1; j++) if (prev[j] > prev[bi]) bi = j;
  for (let s = steps - 1; s >= 0; s--) {
    pitch[s] = bi === C ? -1 : lo + bi;
    bi = back[s * S1 + bi];
  }
  // 같은 음을 다시 쳤나: 짧은 창(약 23ms)으로 칸 시작 바로 전과 바로 뒤의 그 음 세기를 비교
  const N2 = 1 << Math.round(Math.log2(sr * 0.023)); // 약 23ms (44.1kHz 면 1024)
  const win2 = new Float32Array(N2);
  for (let i = 0; i < N2; i++) win2[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N2 - 1));
  const re2 = new Float64Array(N2);
  const im2 = new Float64Array(N2);
  const re3 = new Float64Array(N2);
  const im3 = new Float64Array(N2);
  const pitchMag = (sec, m) => {
    const a = Math.round(sec * sr) - N2 / 2;
    if (a < 0 || a + N2 > len) return 0;
    for (let i = 0; i < N2; i++) (re2[i] = L[a + i] * win2[i]), (im2[i] = 0);
    fft(re2, im2);
    if (stereo) {
      for (let i = 0; i < N2; i++) (re3[i] = R[a + i] * win2[i]), (im3[i] = 0);
      fft(re3, im3);
    }
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    let v = 0;
    for (let h = 1; h <= 3; h++) {
      const k = Math.round((f0 * h * N2) / sr);
      if (k + 1 >= N2 / 2) break;
      for (let j = k - 1; j <= k + 1; j++) {
        if (!stereo) {
          v += Math.hypot(re2[j], im2[j]);
          continue;
        }
        // 가운데 소리만 (좌우로 퍼진 반주가 맥놀이로 '다시 친 것'처럼 보이지 않게)
        const sr2 = re2[j] + re3[j];
        const si = im2[j] + im3[j];
        const dr = re2[j] - re3[j];
        const di = im2[j] - im3[j];
        const S = sr2 * sr2 + si * si;
        const D = dr * dr + di * di;
        const w = S + D > 0 ? Math.max(0, (S - D) / (S + D)) : 0;
        v += Math.sqrt(S) * 0.5 * w * w * w;
      }
    }
    return v;
  };
  const pitchOnset = (s, m) => {
    const t = firstBeat + s * stepSec;
    const before = pitchMag(t - 0.03, m);
    const after = pitchMag(t + Math.min(0.05, stepSec * 0.4), m);
    return after > before * 1.5 + 1e-6;
  };
  // 새 음 시작: 음이 바뀌거나, 같은 음이어도 그 음이 다시 세지면(다시 침)
  const out = Array.from({ length: bars }, () => []);
  let found = 0;
  let cur = null;
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / STEPS_PER_BAR);
    const step = s % STEPS_PER_BAR;
    const p = pitch[s];
    const reHit = cur && p === cur.midi && s > 0 && pitchOnset(s, p);
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || p !== cur.midi || reHit || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[bar].push(cur);
      found++;
    } else cur.len++;
  }
  // 16분 한 칸짜리가 너무 많으면 지저분 → 앞 음과 반음 차이 나는 외톨이 한 칸은 지움
  for (const bar of out) {
    for (let i = bar.length - 1; i >= 0; i--) {
      const n = bar[i];
      if (n.len === 1) {
        const prev = bar[i - 1];
        const next = bar[i + 1];
        const lonely = (!prev || prev.step + prev.len < n.step) && (!next || next.step > n.step + 1);
        if (lonely) {
          bar.splice(i, 1);
          found--;
        }
      }
    }
  }
  // 음역 정리: 가운데가 C5 근처가 되게 옥타브 이동
  const all = out.flat();
  if (all.length) {
    const sorted = all.map((n) => n.midi).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const shift = 12 * Math.round((72 - med) / 12);
    for (const n of all) n.midi = Math.max(48, Math.min(90, n.midi + shift));
  }
  return { bars: out, found };
}

/**
 * Basic Pitch 같은 음 목록 [{ startTimeSeconds, durationSeconds, pitchMidi, amplitude }] → 마디별 멜로디
 *   16분 칸마다 그때 울리는 음 중 '위쪽 줄'(멜로디는 보통 제일 높고 셈)을 고름: 센 음들 중 가장 높은 음
 * @returns {{ bars: Array<Array<{step,midi,len}>>, found: number }}
 */
function notesToMelody(notes, { firstBeat, bpm, bars, lo = 52, hi = 88 }) {
  const stepSec = 60 / bpm / 4;
  const steps = bars * STEPS_PER_BAR;
  const ns = notes.filter((n) => n.pitchMidi >= lo && n.pitchMidi <= hi && n.durationSeconds >= stepSec * 0.6);
  let maxA = 0;
  for (const n of ns) maxA = Math.max(maxA, n.amplitude);
  const pick = new Int16Array(steps).fill(-1);
  const startAt = new Int8Array(steps);
  for (let s = 0; s < steps; s++) {
    const a = firstBeat + s * stepSec;
    const b = a + stepSec;
    let loudest = 0;
    const live = [];
    for (const n of ns) {
      const ov = Math.min(b, n.startTimeSeconds + n.durationSeconds) - Math.max(a, n.startTimeSeconds);
      if (ov < stepSec * 0.5) continue;
      live.push(n);
      loudest = Math.max(loudest, n.amplitude);
    }
    if (!live.length || loudest < maxA * 0.25) continue;
    let best = null;
    for (const n of live) if (n.amplitude >= loudest * 0.7 && (!best || n.pitchMidi > best.pitchMidi)) best = n;
    pick[s] = best.pitchMidi;
    // 이 칸 근처에서 시작한 음이면 새 음
    startAt[s] = Math.abs(best.startTimeSeconds - a) < stepSec * 0.6 ? 1 : 0;
  }
  const out = Array.from({ length: bars }, () => []);
  let found = 0;
  let cur = null;
  for (let s = 0; s < steps; s++) {
    const p = pick[s];
    if (p < 0) {
      cur = null;
      continue;
    }
    const step = s % STEPS_PER_BAR;
    if (!cur || cur.midi !== p || startAt[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
      found++;
    } else cur.len++;
  }
  return { bars: out, found };
}

/**
 * 따 온 멜로디 정리 (듣기 좋게)
 *   1) 옥타브 튐: 앞뒤 음들보다 10반음 넘게 떨어진 음은 옥타브를 옮김
 *   2) grid=2 면 8분음표 칸마다 음 하나 (16분 부스러기가 없어짐)
 *   4) key=true 면 조에서 벗어난 음을 가까운 음계 음으로
 */
function cleanMelody(bars, { grid = 2, key = true } = {}) {
  let all = [];
  bars.forEach((bar, b) => bar.forEach((n) => all.push({ at: b * STEPS_PER_BAR + n.step, midi: n.midi, len: n.len })));
  all.sort((a, b) => a.at - b.at);
  // 1) 옥타브 튐
  const orig = all.map((n) => n.midi);
  for (let i = 0; i < all.length; i++) {
    const near = orig.slice(Math.max(0, i - 4), i).concat(orig.slice(i + 1, i + 5)).sort((a, b) => a - b);
    if (near.length < 2) continue;
    const h = near.length / 2;
    const med = near.length % 2 ? near[Math.floor(h)] : (near[h - 1] + near[h]) / 2;
    while (all[i].midi - med > 9) all[i].midi -= 12;
    while (med - all[i].midi > 9) all[i].midi += 12;
  }
  // 2) grid=2: 8분 칸마다 음 하나. 칸 앞쪽 음을 쓰되, 앞쪽이 앞 음의 이어짐이고 뒤쪽에서 새 음이 시작하면 그 새 음
  if (grid > 1) {
    const total = bars.length * STEPS_PER_BAR;
    const pitch = new Int16Array(total).fill(-1);
    const onset = new Uint8Array(total);
    for (const n of all) {
      for (let i = 0; i < n.len && n.at + i < total; i++) pitch[n.at + i] = n.midi;
      onset[n.at] = 1;
    }
    const slots = [];
    for (let at = 0; at < total; at += grid) {
      let pick = -1;
      let hit = false;
      for (let i = 0; i < grid; i++) {
        const s2 = at + i;
        if (pitch[s2] < 0) continue;
        if (pick < 0 || (onset[s2] && !hit)) {
          if (pick >= 0 && !onset[s2]) continue;
          pick = pitch[s2];
          hit = hit || !!onset[s2];
        }
      }
      slots.push({ at, midi: pick, hit });
    }
    all = [];
    for (const sl of slots) {
      if (sl.midi < 0) continue;
      const prev = all[all.length - 1];
      if (prev && prev.midi === sl.midi && prev.at + prev.len === sl.at && !sl.hit) prev.len += grid;
      else all.push({ at: sl.at, midi: sl.midi, len: grid });
    }
  }
  // 1b) 앞뒤 음 둘 다보다 10반음 넘게 높거나 낮으면 옥타브 실수
  for (let i = 1; i < all.length - 1; i++) {
    const d1 = all[i].midi - all[i - 1].midi;
    const d2 = all[i].midi - all[i + 1].midi;
    if (d1 >= 10 && d2 >= 10) all[i].midi -= 12;
    else if (d1 <= -10 && d2 <= -10) all[i].midi += 12;
  }
  // 4) 조 맞추기
  if (key) {
    const k = guessKey([all.map((n) => ({ midi: n.midi, len: n.len, step: 0 }))]);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((d) => (k + d) % 12);
    const w = new Array(12).fill(0);
    for (const n of all) w[n.midi % 12] += n.len;
    const tot = all.reduce((a, x) => a + x.len, 0);
    for (let i = 0; i < all.length; i++) {
      const n = all[i];
      const pc = n.midi % 12;
      if (scale.includes(pc)) continue;
      // 음계 밖 음: 아주 드물면 고침. 조금 드물면(단조의 올린 7음 같은 건 자주 나옴) 짧고 앞뒤에 같은 음이 없는 '튀는 음'만
      const pcAt = (j) => (all[j] ? all[j].midi % 12 : -1);
      const stray = n.len <= 2 && pcAt(i - 1) !== pc && pcAt(i + 1) !== pc;
      if (w[pc] > tot * (stray ? KEYTH_STRAY : KEYTH)) continue;
      n.midi += scale.includes((pc + 1) % 12) && (w[(pc + 1) % 12] >= w[(pc + 11) % 12] || !scale.includes((pc + 11) % 12)) ? 1 : -1;
    }
  }
  // 마디로 다시 나눔 (마디를 넘는 음은 마디 끝에서 자름)
  const res = bars.map(() => []);
  for (const n of all) {
    const b = Math.floor(n.at / STEPS_PER_BAR);
    if (b >= res.length) continue;
    const step = n.at % STEPS_PER_BAR;
    res[b].push({ step, midi: n.midi, len: Math.max(1, Math.min(n.len, STEPS_PER_BAR - step)) });
  }
  return res;
}

return { MAP_DECO, MAP_LIMITS, midiName, SOLFA, barToMelody, melodyToBars, drumCell, cellChar, toggleDrum, guessKey, harmonize, autoDrums, cleanMap, mapDifficulty, isDrumOnly, mapLevel, fft, transcribe, notesToMelody, cleanMelody };
})();

// ---- vocalsep.js ----
const __m_vocalsep = (() => {
// 🎤 노래에서 목소리만 골라내기 (폰 안에서만, 파일은 밖으로 안 나감)
//   Spleeter 2stems 보컬 모델 (Deezer, MIT) 을 ONNX(fp16, 약 20MB) 로 → onnxruntime-web(wasm) 으로 돌림.
//   처음 쓸 때만 받음(약 30MB, 그 뒤엔 캐시). '음 따기' 를 누를 때만 받아서 다른 사람·다른 화면엔 영향 없음.
//   순서: 스테레오 STFT(4096, 홉 1024) 크기 → 모델이 '목소리 크기' 를 냄 → 원래 스펙트럼에 그 비율(마스크)을 곱해 → 역변환
//   11-21 사용자 노래 2곡(인스타 화면 녹화)으로 시험: 음 따기 정답률 43% → 63% (분리 보컬 pYIN 기준)
const { fft } = __m_usermap;

const ORT_DIR = '/vendor/ort-1.22.0/';
const MODEL = '/assets/models/spleeter-vocals-fp16.onnx?v=1';
const SR = 44100;
const N = 4096;
const H = 1024;
const F = 1024; // 모델이 보는 주파수 칸 (0 ~ 11kHz)
const T = 512; // 모델 한 번에 보는 프레임 수 (약 12초)

const sessP = new Map();

function loadScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(new Error('script'));
    document.head.appendChild(s);
  });
}

/** 모델 준비 (모델마다 한 번만). onProgress(0~1) = 받는 중. 악기 음 따기(instnotes.js)도 같이 씀 */
function modelSession(url, onProgress = () => {}, sizeGuess = 19.7e6) {
  if (!sessP.has(url)) {
    const p = (async () => {
      if (!globalThis.ort) await loadScript(ORT_DIR + 'ort.wasm.min.js');
      const ort = globalThis.ort;
      ort.env.wasm.wasmPaths = ORT_DIR;
      ort.env.wasm.numThreads = 1;
      const res = await fetch(url);
      if (!res.ok) throw new Error('model ' + res.status);
      const total = Number(res.headers.get('content-length')) || sizeGuess;
      let bytes;
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        const parts = [];
        let got = 0;
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          onProgress(Math.min(1, got / total));
        }
        bytes = new Uint8Array(got);
        let at = 0;
        for (const q of parts) bytes.set(q, at), (at += q.length);
      } else bytes = new Uint8Array(await res.arrayBuffer());
      return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch((e) => {
      sessP.delete(url);
      throw e;
    });
    sessP.set(url, p);
  }
  return sessP.get(url);
}
const session = (onProgress) => modelSession(MODEL, onProgress);

/** 간단한 선형 보간으로 44.1kHz 로 */
function resample(x, from) {
  const n = Math.floor((x.length * SR) / from);
  const y = new Float32Array(n);
  const r = from / SR;
  for (let i = 0; i < n; i++) {
    const p = i * r;
    const a = Math.floor(p);
    const f = p - a;
    y[i] = (x[a] || 0) * (1 - f) + (x[a + 1] || 0) * f;
  }
  return y;
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/**
 * 목소리만 남긴 스테레오 소리
 * @param {Float32Array} L @param {Float32Array} R @param {number} sr
 * @param {(stage: 'model'|'sep', p: number) => void} onProgress
 * @returns {Promise<{ L: Float32Array, R: Float32Array, sr: number }>}
 */
async function separateVocals(L, R, sr, onProgress = () => {}) {
  if (sr !== SR) {
    L = resample(L, sr);
    R = resample(R, sr);
  }
  const sess = await session((p) => onProgress('model', p));
  const ort = globalThis.ort;
  const n = L.length;
  const nfr = Math.max(0, Math.floor((n - N) / H) + 1);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const wsum = new Float32Array(n);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); // periodic hann
  const chans = [L, R];
  const outs = [outL, outR];
  const splits = Math.ceil(nfr / T);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const inName = sess.inputNames[0];
  const outName = sess.outputNames[0];
  for (let sp = 0; sp < splits; sp++) {
    const f0 = sp * T;
    const cnt = Math.min(T, nfr - f0);
    // 이 조각의 스펙트럼 (0 ~ F 칸만 보관)
    const specRe = [new Float32Array(T * F), new Float32Array(T * F)];
    const specIm = [new Float32Array(T * F), new Float32Array(T * F)];
    const x = new Float32Array(2 * T * F);
    for (let c = 0; c < 2; c++) {
      const s = chans[c];
      for (let t = 0; t < cnt; t++) {
        const a = (f0 + t) * H;
        for (let i = 0; i < N; i++) (re[i] = s[a + i] * win[i]), (im[i] = 0);
        fft(re, im);
        const o = t * F;
        for (let k = 0; k < F; k++) {
          specRe[c][o + k] = re[k];
          specIm[c][o + k] = im[k];
          x[c * T * F + o + k] = Math.hypot(re[k], im[k]);
        }
      }
    }
    await nextFrame();
    const r = await sess.run({ [inName]: new ort.Tensor('float32', x, [2, 1, T, F]) });
    const y = r[outName].data;
    for (let c = 0; c < 2; c++) {
      const out = outs[c];
      for (let t = 0; t < cnt; t++) {
        const o = t * F;
        re.fill(0);
        im.fill(0);
        for (let k = 0; k < F; k++) {
          const mag = x[c * T * F + o + k];
          const m = mag > 1e-8 ? Math.min(1, Math.max(0, y[c * T * F + o + k] / mag)) : 0;
          re[k] = specRe[c][o + k] * m;
          im[k] = specIm[c][o + k] * m;
          // 역변환은 켤레 대칭으로
          if (k > 0) (re[N - k] = re[k]), (im[N - k] = -im[k]);
        }
        // ifft = conj(fft(conj(X))) / N
        for (let i = 0; i < N; i++) im[i] = -im[i];
        fft(re, im);
        const a = (f0 + t) * H;
        for (let i = 0; i < N; i++) {
          out[a + i] += (re[i] / N) * win[i];
          if (c === 0) wsum[a + i] += win[i] * win[i];
        }
      }
    }
    onProgress('sep', (sp + 1) / splits);
    await nextFrame();
  }
  for (let i = 0; i < n; i++) {
    const w = wsum[i] > 1e-3 ? wsum[i] : 1;
    outL[i] /= w;
    outR[i] /= w;
  }
  return { L: outL, R: outR, sr: SR };
}

return { modelSession, resample, separateVocals };
})();

// ---- beatsync.js ----
const __m_beatsync = (() => {
// 🎧 박자 맞추기용 노래 분석 (운영자 전용, 이 폰 안에서만. 파일은 어디에도 안 올림)
//   노래 파일의 하이라이트 부분에서 BPM 과 박 위치(첫 박)를 찾아서, 드럼 채보가 노래 박에 딱 붙게 함.
//   방법: 10ms 마다 소리 세기가 '확 커지는 정도'(온셋) → 박 간격별로 겹쳐 보며 가장 잘 맞는 BPM·위치 고르기.
//   쿵(킥)·짝(스네어) 구분: 낮은 소리가 센 박을 1·3박(쿵)으로.

const HOP = 0.01; // 10ms

/** 구간의 온셋 세기 (전체 소리 + 낮은 소리) */
function onsetEnvelope(samples, sr, start, dur) {
  const hop = Math.max(1, Math.round(sr * HOP));
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(samples.length, Math.floor((start + dur) * sr));
  const n = Math.max(0, Math.floor((s1 - s0) / hop));
  const all = new Float32Array(n);
  const low = new Float32Array(n);
  // 한 극 저역 필터(~150Hz)로 킥 소리만 따로
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let lp = 0;
  let prevE = 0;
  let prevL = 0;
  for (let f = 0; f < n; f++) {
    let e = 0;
    let l = 0;
    const base = s0 + f * hop;
    for (let i = 0; i < hop; i++) {
      const x = samples[base + i];
      lp = (1 - a) * x + a * lp;
      e += x * x;
      l += lp * lp;
    }
    const le = Math.log(1e-9 + e / hop);
    const ll = Math.log(1e-9 + l / hop);
    all[f] = Math.max(0, le - prevE);
    low[f] = l / hop; // 낮은 소리 세기 그대로 (쿵·짝 구분용)
    prevE = le;
    prevL = ll;
  }
  // 살짝 뭉개서(3칸) 박 위치를 칸 사이까지 읽을 수 있게
  const sm = new Float32Array(n);
  for (let f = 0; f < n; f++) sm[f] = 0.25 * (all[f - 1] || 0) + 0.5 * all[f] + 0.25 * (all[f + 1] || 0);
  return { all: sm, low, hopSec: hop / sr };
}

/** 박 간격 period(프레임, 소수 가능)·위치 phase 로 겹친 세기 (박 beats 개만 → 빠르기마다 공평하게) */
function combScore(env, period, phase, beats) {
  let s = 0;
  for (let k = 0; k < beats; k++) {
    const t = phase + k * period;
    const i = Math.floor(t);
    const fr = t - i;
    s += (env[i] || 0) * (1 - fr) + (env[i + 1] || 0) * fr;
  }
  return s / beats;
}

function bestPhase(env, period, beats = Math.floor((env.length - 2) / period) - 1) {
  let best = 0;
  let bestS = -1;
  for (let p = 0; p < period; p += 0.25) {
    const s = combScore(env, period, p, beats);
    if (s > bestS) {
      bestS = s;
      best = p;
    }
  }
  return { phase: best, score: bestS };
}

/**
 * samples: 모노 Float32Array, sr: 샘플레이트, start: 하이라이트 시작(초)
 * hintBpm 을 주면 그 근처(±4%)에서만 찾음 (탭으로 잰 값·직접 쓴 값)
 * → { bpm, firstBeat(초, start 이후 첫 '쿵' 박), confidence 0~1 }
 */
function detectBeat(samples, sr, { start = 0, dur = 24, hintBpm = null } = {}) {
  const { all, low, hopSec: H } = onsetEnvelope(samples, sr, start, dur);
  if (all.length < 300) return null;
  // 1) BPM: 0.5 BPM 단위로 훑고 → 0.05 단위로 다듬기
  const lo = hintBpm ? hintBpm * 0.96 : 70;
  const hi = hintBpm ? hintBpm * 1.04 : 190;
  // 가장 느린 빠르기로도 다 들어가는 박 수로 통일
  const beats = Math.floor((all.length - 2) / (60 / lo / H)) - 1;
  const scoreAt = (bpm) => bestPhase(all, 60 / bpm / H, beats).score;
  let best = lo;
  let bestS = -1;
  const scores = [];
  for (let b = lo; b <= hi; b += 0.5) {
    const s = scoreAt(b);
    scores.push(s);
    if (s > bestS) {
      bestS = s;
      best = b;
    }
  }
  for (let b = best - 0.5; b <= best + 0.5; b += 0.02) {
    const s = scoreAt(b);
    if (s > bestS) {
      bestS = s;
      best = b;
    }
  }
  // 힌트 없이 찾았으면: 절반 빠르기도 거의 같은 점수면(반 박마다 소리가 있는 곡) 사람들이 세는 쪽으로 — 그대로 둠.
  //   두 배 빠르기 쪽이 훨씬 잘 맞으면 그쪽 (드럼이 반 박씩 어긋나는 걸 막음)
  if (!hintBpm && best * 2 <= 200 && scoreAt(best * 2) > bestS * 1.15) best *= 2;
  const bpm = Math.round(best * 100) / 100;
  const period = 60 / bpm / H;
  const { phase } = bestPhase(all, period, Math.floor((all.length - 2) / period) - 1);
  // 2) 쿵(1·3박) 찾기: 짝수 박 / 홀수 박 중 낮은 소리가 더 센 쪽
  const lowAt = (k) => {
    let s = 0;
    for (let t = phase + k * period; t < low.length - 6; t += period * 2) for (let i = 0; i < 6; i++) s += low[Math.floor(t) + i];
    return s;
  };
  const kickShift = lowAt(1) > lowAt(0) * 1.05 ? 1 : 0;
  const firstBeat = start + (phase + kickShift * period) * H;
  // 믿을 만한가: 맞는 BPM 점수가 평균보다 얼마나 튀나
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const confidence = Math.max(0, Math.min(1, (bestS / (mean || 1) - 1) / 1.5));
  return { bpm, firstBeat, confidence };
}

/** AudioBuffer → 모노 */
function monoOf(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const a = buf.getChannelData(0);
  const b = buf.getChannelData(1);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
  return out;
}

// ---------------------------------------------------------------
// 🥁 노래 따라 채보: 노래 소리를 16분음표 칸마다 읽어서 드럼 채보를 만듦
//   낮은 소리가 '확' 커지는 칸 → 쿵(K), 높은 소리 → 짝(S)/하이햇(H), 둘 다 → 동시에(B),
//   곡에서 가장 센 순간(정박) → 크래시+스네어 '팡'(X, 쉬움은 B)
//   엄지 규칙: 붙은 칸(16분)에 같은 엄지 금지, 140 BPM 넘으면 붙은 칸 자체 금지
// ---------------------------------------------------------------
const THUMB = { K: 'L', C: 'L', T: 'L', S: 'R', H: 'R', B: 'LR', X: 'LR', J: 'LR', Y: 'LR' };
const clash = (a, b) => !!THUMB[a] && !!THUMB[b] && [...THUMB[a]].some((h) => THUMB[b].includes(h));

/** 소리 세기 '확 커짐' 을 세 갈래(낮은·높은·전체)로, 10ms 단위 */
function bandFlux(samples, sr, start, dur) {
  const hop = Math.max(1, Math.round(sr * 0.01));
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(samples.length, Math.floor((start + dur) * sr));
  const n = Math.max(0, Math.floor((s1 - s0) / hop));
  const low = new Float32Array(n);
  const high = new Float32Array(n);
  const all = new Float32Array(n);
  const loud = new Float32Array(n);
  const aL = Math.exp((-2 * Math.PI * 150) / sr);
  const aH = Math.exp((-2 * Math.PI * 2500) / sr);
  let lp = 0;
  let lp2 = 0;
  let pL = 0;
  let pH = 0;
  let pA = 0;
  for (let f = 0; f < n; f++) {
    let eL = 0;
    let eH = 0;
    let eA = 0;
    const base = s0 + f * hop;
    for (let i = 0; i < hop; i++) {
      const x = samples[base + i];
      lp = (1 - aL) * x + aL * lp;
      lp2 = (1 - aH) * x + aH * lp2;
      const hp = x - lp2; // 2.5kHz 위 (스네어·하이햇·심벌)
      eL += lp * lp;
      eH += hp * hp;
      eA += x * x;
    }
    const lL = Math.log(1e-9 + eL / hop);
    const lH = Math.log(1e-9 + eH / hop);
    const lA = Math.log(1e-9 + eA / hop);
    // 세기도 같이 봄 (아주 작은 소리의 '확' 은 무시)
    low[f] = Math.max(0, lL - pL) * Math.sqrt(eL / hop);
    high[f] = Math.max(0, lH - pH) * Math.sqrt(eH / hop);
    all[f] = Math.max(0, lA - pA) * Math.sqrt(eA / hop);
    loud[f] = Math.sqrt(eA / hop);
    pL = lL;
    pH = lH;
    pA = lA;
  }
  return { low, high, all, loud, hopSec: hop / sr, n };
}

const DIFF_RULES = {
  easy: { perBar: 4, grid: 4, chars: 'KSB', accent: 'B', beatBonus: 0.5 }, // 쉬움: 정박(4분)에만
  normal: { perBar: 6, grid: 2, chars: 'KSHBJ', accent: 'X', beatBonus: 0.3 },
  hard: { perBar: 9, grid: 1, chars: 'KSHBJ', accent: 'X', beatBonus: 0.2 },
};

/**
 * 노래 따라 채보. samples·sr = 노래(화면 녹화) 소리, firstBeat = 채보 첫 칸의 노래 시각, bars = 마디 수
 * → { bars: ['K...S...', …], covered: 소리가 있는 마디 수 }
 *   소리가 끝난 뒤 마디는 기본 쿵짝으로 채움
 */
function songChart(samples, sr, { firstBeat, bpm, bars, diff = 'easy' }) {
  const rule = DIFF_RULES[diff] || DIFF_RULES.easy;
  const fast = bpm > 140;
  const stepSec = 60 / bpm / 4;
  const total = bars * 16;
  const { low, high, loud, hopSec, n } = bandFlux(samples, sr, firstBeat - 0.05, total * stepSec + 0.2);
  const at = (arr, t) => {
    // 칸 시각 ±20ms 안에서 가장 큰 값 (앞쪽 0.05초 여유를 둠)
    const c = Math.round((t + 0.05) / hopSec);
    let m = 0;
    for (let i = c - 2; i <= c + 2; i++) if (i >= 0 && i < n && arr[i] > m) m = arr[i];
    return m;
  };
  const L = new Float32Array(total);
  const Hh = new Float32Array(total);
  const A = new Float32Array(total);
  let covered = 0;
  for (let k = 0; k < total; k++) {
    const t = k * stepSec;
    if ((t + 0.05) / hopSec < n - 3) covered = Math.floor(k / 16) + 1;
    L[k] = at(low, t);
    Hh[k] = at(high, t);
    // '팡' 은 소리 크기로: 칸 시각부터 60ms 평균
    const c = Math.round((t + 0.05) / hopSec);
    let sum = 0;
    for (let i = c; i < c + 6 && i < n; i++) sum += loud[i] || 0;
    A[k] = sum / 6;
  }
  const pct = (arr, p) => {
    const v = Array.from(arr.slice(0, covered * 16)).filter((x) => x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 1;
  };
  const nL = pct(L, 0.9) || 1;
  const nH = pct(Hh, 0.9) || 1;
  // '팡': 곡에서 손꼽게 센 순간만 (가장 센 소리의 55% 이상 + 상위 3%)
  const maxA = Math.max(0, ...Array.from(A.slice(0, covered * 16)));
  const accentLine = Math.max(pct(A, 0.97), maxA * 0.55);
  const out = new Array(total).fill('.');
  // 마디별 소리 크기 → 거의 조용한 마디(인트로 앞 무음·노래 끝)는 쉼
  const barLoud = [];
  for (let b = 0; b < covered; b++) {
    let sum = 0;
    for (let s = 0; s < 16; s++) sum += A[b * 16 + s];
    barLoud.push(sum / 16);
  }
  const midLoud = barLoud.slice().sort((a, b) => a - b)[Math.floor(barLoud.length / 2)] || 0;
  for (let b = 0; b < covered; b++) {
    if (barLoud[b] < midLoud * 0.12) continue;
    const cands = [];
    for (let s = 0; s < 16; s += rule.grid) {
      const k = b * 16 + s;
      const lo = Math.min(1.5, L[k] / nL);
      const hi = Math.min(1.5, Hh[k] / nH);
      // 정박일수록 조금 더 (마디 첫 박·셋째 박은 쿵 자리)
      const pos = s % 4 === 0 ? rule.beatBonus : s % 2 === 0 ? 0 : -0.15;
      let ch;
      if (A[k] >= accentLine && s % 4 === 0) ch = rule.accent;
      else if (lo > 0.55 && hi > 0.55 && rule.chars.includes('B') && s % 4 === 0) ch = 'B';
      else if (lo >= hi) ch = 'K';
      else ch = rule.chars.includes('H') && s % 4 !== 0 && hi < 0.8 ? 'H' : 'S';
      const score = Math.max(lo, hi) + pos + (ch === rule.accent ? 1 : 0) + ((s === 0 || s === 8) && ch === 'K' ? 0.2 : 0);
      if (Math.max(lo, hi) > 0.12 || ch === rule.accent) cands.push({ k, ch, score });
    }
    cands.sort((x, y) => y.score - x.score);
    let placed = 0;
    for (const c of cands) {
      if (placed >= rule.perBar) break;
      const prev = out[c.k - 1];
      const next = out[c.k + 1];
      if (fast && ((prev && prev !== '.') || (next && next !== '.'))) continue;
      if (clash(prev, c.ch) || clash(next, c.ch)) continue;
      out[c.k] = c.ch;
      placed++;
    }
    // 너무 비면(조용한 마디) 첫 박 쿵·셋째 박 짝 정도는 넣음
    const base = b * 16;
    if (placed < 2) {
      if (out[base] === '.' && !clash(out[base - 1], 'K') && !clash(out[base + 1], 'K')) out[base] = 'K';
      if (out[base + 4] === '.' && !clash(out[base + 3], 'S') && !clash(out[base + 5], 'S')) out[base + 4] = 'S';
      if (out[base + 12] === '.' && !clash(out[base + 11], 'S') && !clash(out[base + 13], 'S')) out[base + 12] = 'S';
    }
  }
  // 소리가 끝난 마디: 기본 쿵짝
  for (let b = covered; b < bars; b++) {
    const bar = 'K...S...K...S...';
    for (let s = 0; s < 16; s++) out[b * 16 + s] = bar[s];
    if (clash(out[b * 16 - 1], 'K')) out[b * 16 - 1] = '.';
  }
  const res = [];
  for (let b = 0; b < bars; b++) res.push(out.slice(b * 16, b * 16 + 16).join(''));
  return { bars: res, covered: Math.min(covered, bars) };
}

return { detectBeat, monoOf, songChart };
})();

// ---- songmap.js ----
const __m_songmap = (() => {
// 🎼 노래 파일 → 유저 맵 (폰 안에서만. 파일은 밖으로 안 나감)
//   11-21 사용자 요청 '음 따는 게 너무 못 따. 딸 수 있는 건 다 따서 원래 곡이랑 최대한 비슷하게'
//   ① 멜로디: 골라낸 목소리(vocalsep.js)에서 10ms 마다 음 높이(pYIN 방식: YIN 후보 + 음 이어 고르기) → 음표로 끊어 박에 맞춤
//      목소리가 없는 곳(전주·간주·연주곡)은 반주에서 가장 또렷한 위쪽 줄(신스·피아노·카우벨 등)을 땀
//   ② 화음: 반주(원래 소리 − 목소리)의 음 분포로 반 마디마다 코드 (멜로디로 짐작하지 않고 곡에서)
//   ③ 드럼: 곡의 쿵·짝을 그대로 (beatsync.js songChart)
const { fft, cleanMelody } = __m_usermap;
const { STEPS_PER_BAR } = __m_charts;
const { songChart } = __m_beatsync;

const LOG = Math.log;
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** 가운데(L+R)/2 */
function center(chans) {
  const L = chans[0];
  const R = chans[chans.length - 1];
  if (L === R) return L;
  const out = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) out[i] = (L[i] + R[i]) * 0.5;
  return out;
}

/** 정수배로 줄이기 (저역 필터 + 솎기) → 약 target Hz */
function downsample(x, sr, target) {
  const d = Math.max(1, Math.round(sr / target));
  if (d === 1) return { y: x, sr };
  const taps = 8 * d + 1;
  const h = new Float32Array(taps);
  const fc = 0.45 / d;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const k = i - (taps - 1) / 2;
    const sinc = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  const n = Math.floor(x.length / d);
  const y = new Float32Array(n);
  const half = (taps - 1) >> 1;
  for (let j = 0; j < n; j++) {
    const c = j * d;
    let v = 0;
    const a = Math.max(0, c - half);
    const b = Math.min(x.length - 1, c + half);
    for (let i = a; i <= b; i++) v += x[i] * h[i - c + half];
    y[j] = v;
  }
  return { y, sr: sr / d };
}

// ---------------------------------------------------------------
// ① 목소리 음 높이 (pYIN 방식)
// ---------------------------------------------------------------
// 문턱값 분포 (베타 분포 평균 0.15) — 이 문턱보다 낮은 첫 골짜기를 음으로 봄
const TH = [];
{
  const a = 2;
  const b = 11.33;
  let s = 0;
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const w = Math.pow(t, a - 1) * Math.pow(1 - t, b - 1);
    TH.push([t, w]);
    s += w;
  }
  for (const p of TH) p[1] /= s;
}

/**
 * YIN 후보: 프레임마다 [{ midi, p }] (p 합 ≤ 1 = 음이 있을 확률) + 세기
 * @param {Float32Array} y 줄인 소리 @param {number} sr @param {number} hop 샘플
 */
function yinCandidates(y, sr, hop, lo, hi) {
  const tauMax = Math.ceil(sr / midiToHz(lo)) + 2;
  const tauMin = Math.max(2, Math.floor(sr / midiToHz(hi)));
  const W = Math.round(sr * 0.032);
  let N = 1;
  while (N < W + tauMax + 2) N <<= 1;
  const nF = Math.max(0, Math.floor((y.length - W - tauMax) / hop));
  const reA = new Float64Array(N);
  const imA = new Float64Array(N);
  const reB = new Float64Array(N);
  const imB = new Float64Array(N);
  const d = new Float64Array(tauMax + 2);
  const dn = new Float64Array(tauMax + 2);
  const cands = new Array(nF);
  const rms = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    const a = f * hop;
    reA.fill(0);
    imA.fill(0);
    reB.fill(0);
    imB.fill(0);
    const segLen = W + tauMax + 1;
    for (let i = 0; i < segLen; i++) reA[i] = y[a + i];
    for (let i = 0; i < W; i++) reB[i] = y[a + i];
    let e0 = 0;
    for (let i = 0; i < W; i++) e0 += y[a + i] * y[a + i];
    rms[f] = Math.sqrt(e0 / W);
    if (e0 < 1e-9) {
      cands[f] = [];
      continue;
    }
    fft(reA, imA);
    fft(reB, imB);
    // r(τ) = IFFT(conj(B)·A)
    for (let k = 0; k < N; k++) {
      const r = reB[k] * reA[k] + imB[k] * imA[k];
      const i = reB[k] * imA[k] - imB[k] * reA[k];
      reA[k] = r;
      imA[k] = -i; // conj 해서 정방향 FFT 로 역변환
    }
    fft(reA, imA);
    // eτ = Σ_{j=τ}^{τ+W-1} x²
    let et = e0;
    d[0] = 0;
    for (let t = 1; t <= tauMax; t++) {
      et += y[a + t + W - 1] * y[a + t + W - 1] - y[a + t - 1] * y[a + t - 1];
      d[t] = Math.max(0, e0 + et - (2 * reA[t]) / N);
    }
    // 누적 평균 정규화
    let cs = 0;
    dn[0] = 1;
    for (let t = 1; t <= tauMax; t++) {
      cs += d[t];
      dn[t] = cs > 0 ? (d[t] * t) / cs : 1;
    }
    // 골짜기들
    const mins = [];
    for (let t = tauMin; t < tauMax; t++) {
      if (dn[t] < dn[t - 1] && dn[t] <= dn[t + 1] && dn[t] < 1) {
        // 포물선으로 τ 다듬기
        const s0 = dn[t - 1];
        const s1 = dn[t];
        const s2 = dn[t + 1];
        const den = s0 - 2 * s1 + s2;
        const off = den > 0 ? (0.5 * (s0 - s2)) / den : 0;
        mins.push({ tau: t + Math.max(-1, Math.min(1, off)), v: s1 });
      }
    }
    const out = [];
    if (mins.length) {
      const prob = new Float64Array(mins.length);
      let gi = 0;
      for (let i = 1; i < mins.length; i++) if (mins[i].v < mins[gi].v) gi = i;
      for (const [th, w] of TH) {
        let k = -1;
        for (let i = 0; i < mins.length; i++)
          if (mins[i].v < th) {
            k = i;
            break;
          }
        if (k >= 0) prob[k] += w;
        else prob[gi] += w * 0.01; // 문턱 아래가 없으면 가장 깊은 골짜기에 아주 조금
      }
      for (let i = 0; i < mins.length; i++) if (prob[i] > 0.005) out.push({ midi: hzToMidi(sr / mins[i].tau), p: prob[i] });
    }
    cands[f] = out;
  }
  return { cands, rms, nF };
}

/**
 * 후보들 → 한 줄 음 높이 (비터비). 20센트 칸, 프레임 사이 5반음 안에서는 부드럽게, 그보다 멀면 벌점
 * gate[f] = 0~1 (목소리가 있을 법한 정도, 1 이면 그대로)
 */
function viterbiPitch(cands, nF, lo, hi, gate, { switchP = 0.02, voiceBias = 1, unvoiced = 30 } = {}) {
  const RES = 5;
  const B = (hi - lo) * RES + 1;
  const U = B; // 쉼 상태
  const S = B + 1;
  const J = 25;
  const lSwitch = LOG(switchP);
  const lStay = LOG(1 - switchP);
  // 음이 옮겨 가는 벌점: 20센트 칸 하나에 0.12 (반음 0.6). 5반음 넘게 한 번에 뛰면 크게
  const tw = new Float64Array(J + 1);
  for (let k = 0; k <= J; k++) tw[k] = lStay - 0.12 * k;
  const lJump = lStay - 6;
  const back = new Int16Array(nF * S);
  let prev = new Float64Array(S).fill(0);
  let cur = new Float64Array(S);
  const emit = new Float64Array(S);
  const path = new Float32Array(nF).fill(-1);
  const exact = new Float32Array(B);
  for (let f = 0; f < nF; f++) {
    // 방출
    emit.fill(0);
    let vp = 0;
    for (const c of cands[f]) {
      const b = Math.round((c.midi - lo) * RES);
      if (b < 0 || b >= B) continue;
      emit[b] += c.p;
      vp += c.p;
    }
    const g = gate ? gate[f] : 1;
    vp = Math.min(1, vp);
    const vScale = g * voiceBias;
    for (let b = 0; b < B; b++) emit[b] = LOG(emit[b] * vScale + 1e-4 / B);
    // pYIN 처럼: 얕은 골짜기라도 있으면 음 쪽으로 (쉼 점수는 칸 수로 나눈 만큼)
    emit[U] = LOG(Math.max(1e-4, 1 - vp * g) / unvoiced + 1e-7);
    if (f === 0) {
      for (let s = 0; s < S; s++) cur[s] = emit[s];
    } else {
      let gmax = -Infinity;
      let gi = 0;
      for (let b = 0; b < B; b++)
        if (prev[b] > gmax) {
          gmax = prev[b];
          gi = b;
        }
      for (let b = 0; b < B; b++) {
        let bv = prev[U] + lSwitch;
        let bi = U;
        const a0 = Math.max(0, b - J);
        const a1 = Math.min(B - 1, b + J);
        for (let a = a0; a <= a1; a++) {
          const v = prev[a] + tw[Math.abs(a - b)];
          if (v > bv) {
            bv = v;
            bi = a;
          }
        }
        if (gmax + lJump > bv) {
          bv = gmax + lJump;
          bi = gi;
        }
        cur[b] = bv + emit[b];
        back[f * S + b] = bi;
      }
      // 쉼으로
      let bv = prev[U] + lStay;
      let bi = U;
      if (gmax + lSwitch > bv) {
        bv = gmax + lSwitch;
        bi = gi;
      }
      cur[U] = bv + emit[U];
      back[f * S + U] = bi;
    }
    // 정규화 (숫자 안 커지게)
    let m = -Infinity;
    for (let s = 0; s < S; s++) if (cur[s] > m) m = cur[s];
    for (let s = 0; s < S; s++) cur[s] -= m;
    [prev, cur] = [cur, prev];
  }
  let bi = 0;
  for (let s = 1; s < S; s++) if (prev[s] > prev[bi]) bi = s;
  for (let f = nF - 1; f >= 0; f--) {
    path[f] = bi === U ? -1 : bi;
    bi = back[f * S + bi];
  }
  // 칸 → 실제 음 높이 (그 칸 근처 후보의 정확한 값)
  const out = new Float32Array(nF).fill(-1);
  for (let f = 0; f < nF; f++) {
    if (path[f] < 0) continue;
    const m = lo + path[f] / RES;
    let best = m;
    let bd = 0.35;
    for (const c of cands[f]) {
      const dd = Math.abs(c.midi - m);
      if (dd < bd) (bd = dd), (best = c.midi);
    }
    out[f] = best;
  }
  return out;
}

// ---------------------------------------------------------------
// 반주의 위쪽 줄 (목소리가 없는 곳)
//   배음 더하기로 음 후보 점수 → 가장 또렷한 음을 이어 고름
// ---------------------------------------------------------------
function leadSalience(x, sr, hop, lo, hi, want = null) {
  const N = 2048;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const binHz = sr / N;
  const nF = Math.max(0, Math.floor((x.length - N) / hop) + 1);
  const C = hi - lo + 1;
  const kMin = Math.floor(80 / binHz);
  const kMax = Math.min(N / 2 - 2, Math.ceil(6000 / binHz));
  const mag = new Float32Array(N / 2);
  const wm = new Float32Array(N / 2);
  const cs = new Float64Array(N / 2 + 1);
  const cands = new Array(nF);
  const peak = (k) => Math.max(wm[k - 1], wm[k], wm[k + 1]);
  for (let f = 0; f < nF; f++) {
    if (want && !want(f)) {
      cands[f] = [];
      continue;
    }
    const a = f * hop;
    for (let i = 0; i < N; i++) (re[i] = x[a + i] * win[i]), (im[i] = 0);
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.sqrt(Math.hypot(re[k], im[k]));
    cs[0] = 0;
    for (let k = 0; k < N / 2; k++) cs[k + 1] = cs[k] + mag[k];
    for (let k = kMin; k <= kMax; k++) {
      const hw = Math.max(3, Math.round(k * 0.15));
      const a2 = Math.max(0, k - hw);
      const b2 = Math.min(N / 2, k + hw + 1);
      const avg = (cs[b2] - cs[a2]) / (b2 - a2);
      wm[k] = avg > 0 ? Math.max(0, mag[k] / avg - 1) : 0;
    }
    const sal = new Float32Array(C);
    let mx = 0;
    let sum = 0;
    for (let j = 0; j < C; j++) {
      const f0 = midiToHz(lo + j);
      let v = 0;
      let odd = 0;
      let even = 0;
      for (let h = 1; h <= 6; h++) {
        const k = Math.round((f0 * h) / binHz);
        if (k + 1 > kMax) break;
        const p = Math.pow(0.8, h - 1) * peak(k);
        v += p;
        if (h % 2) odd += p;
        else even += p;
      }
      if (odd + even > 0) v *= Math.min(1, (2.2 * odd) / (odd + even));
      // 바탕음이 없으면 크게 깎음
      const k1 = Math.round(f0 / binHz);
      if (peak(k1) <= 0) v *= 0.3;
      // 더 낮은 음의 배음일 뿐이면(반 주파수·1.5배 자리에도 소리) 깎음 — 찌그러진 808 베이스처럼 배음이 촘촘한 소리
      const kh = Math.round(f0 / 2 / binHz);
      const k15 = Math.round((f0 * 1.5) / binHz);
      const k25 = Math.round((f0 * 2.5) / binHz);
      if (kh > kMin) v -= 0.6 * peak(kh);
      if (k15 + 1 <= kMax) v -= 0.6 * peak(k15);
      if (k25 + 1 <= kMax) v -= 0.3 * peak(k25);
      v = Math.max(0, v);
      sal[j] = v;
      sum += v;
      if (v > mx) mx = v;
    }
    // 후보: 상위 몇 개 (뚜렷할수록 p 큼)
    const out = [];
    if (mx > 0) {
      const mean = sum / C;
      const clarity = Math.min(1, Math.max(0, (mx / (mean + 1e-9) - 2) / 4));
      for (let j = 0; j < C; j++) {
        if (sal[j] < mx * 0.6) continue;
        if (j > 0 && sal[j - 1] > sal[j]) continue;
        if (j < C - 1 && sal[j + 1] > sal[j]) continue;
        out.push({ midi: lo + j, p: clarity * (sal[j] / mx) * 0.8 });
      }
    }
    cands[f] = out;
  }
  return { cands, nF };
}

// ---------------------------------------------------------------
// 음 높이 줄 → 음표 → 박 칸
// ---------------------------------------------------------------
/** 전체 음정이 표준(A=440)에서 얼마나 벗어났나 (반음 단위, -0.5~0.5). 빨리 감은 노래 등 */
function tuningOffset(f0) {
  let c = 0;
  let s = 0;
  for (const m of f0) {
    if (m < 0) continue;
    c += Math.cos(2 * Math.PI * m);
    s += Math.sin(2 * Math.PI * m);
  }
  return c || s ? Math.atan2(s, c) / (2 * Math.PI) : 0;
}

/**
 * 프레임 음 높이(+세기) → 음표 [{ t0, t1, midi }] (초)
 *   음이 바뀌면(반올림 음이 몇 프레임 이어서 다르면) 끊고, 같은 음이어도 소리가 다시 세지면(새 글자) 끊음
 */
function segment(f0, rms, hopSec, tune) {
  const nF = f0.length;
  const semi = new Int16Array(nF).fill(-1);
  for (let f = 0; f < nF; f++) if (f0[f] >= 0) semi[f] = Math.round(f0[f] - tune);
  // 세기 첫머리
  const le = new Float32Array(nF);
  for (let f = 0; f < nF; f++) le[f] = LOG(rms[f] + 1e-5);
  const K = Math.max(2, Math.round(0.04 / hopSec)); // 40ms 넘게 다른 음이면 바뀐 것
  const minLen = Math.max(2, Math.round(0.06 / hopSec));
  const notes = [];
  let f = 0;
  while (f < nF) {
    if (semi[f] < 0) {
      f++;
      continue;
    }
    // 목소리 한 덩어리 [f, e)
    let e = f;
    while (e < nF && semi[e] >= 0) e++;
    // 덩어리 안에서 음 바뀜 찾기
    const cuts = [f];
    let curP = semi[f];
    // 시작 몇 프레임은 끌어올림일 수 있으니 덩어리 앞쪽 다수결로 첫 음
    {
      const cnt = new Map();
      for (let i = f; i < Math.min(e, f + 3 * K); i++) cnt.set(semi[i], (cnt.get(semi[i]) || 0) + 1);
      let bc = 0;
      for (const [p, c] of cnt) if (c > bc) (bc = c), (curP = p);
    }
    let i = f + 1;
    while (i < e) {
      if (semi[i] !== curP) {
        // K 프레임 넘게 같은 새 음이 이어지나
        let j = i;
        const np = semi[i];
        while (j < e && Math.abs(semi[j] - np) === 0) j++;
        if (j - i >= K) {
          cuts.push(i);
          curP = np;
          i = j;
          continue;
        }
        i++;
        continue;
      }
      // 같은 음인데 세기가 확 커짐 (새 글자)
      if (i - cuts[cuts.length - 1] >= minLen && i + minLen <= e) {
        let lowest = le[i];
        for (let k = Math.max(cuts[cuts.length - 1], i - K); k < i; k++) lowest = Math.min(lowest, le[k]);
        if (le[i] - lowest > 0.7 && le[Math.min(e - 1, i + 1)] - lowest > 0.7) {
          cuts.push(i);
          i += minLen;
          continue;
        }
      }
      i++;
    }
    cuts.push(e);
    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c];
      const b = cuts[c + 1];
      if (b - a < minLen) continue;
      // 음 높이: 뒤쪽 3/4 의 가운데값 (첫머리 끌어올림 빼고)
      const vals = [];
      for (let k = a + Math.floor((b - a) / 4); k < b; k++) vals.push(f0[k] - tune);
      vals.sort((x, y) => x - y);
      notes.push({ t0: a * hopSec, t1: b * hopSec, midi: Math.round(vals[vals.length >> 1]), a, b });
    }
    f = e;
  }
  // 바로 붙은 같은 음 조각이 아주 짧으면 합침
  const out = [];
  for (const n of notes) {
    const p = out[out.length - 1];
    if (p && p.midi === n.midi && n.t0 - p.t1 < 0.03 && n.t1 - n.t0 < 0.08) p.t1 = n.t1;
    else out.push(n);
  }
  return out;
}

/** 음표(초) → 마디별 16분 칸 음표. 가장 가까운 칸에 붙이고, 뒤 음이 앞 음 꼬리를 덮음 */
function quantize(notes, firstBeat, bpm, bars) {
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  const cell = new Int16Array(total).fill(-1);
  const onset = new Uint8Array(total);
  for (const n of [...notes].sort((p, q) => p.t0 - q.t0)) {
    const on = (n.t0 - firstBeat) / st;
    const off = (n.t1 - firstBeat) / st;
    const s0 = Math.round(on);
    let s1 = Math.round(off);
    if (s1 <= s0) {
      if (off - on < 0.45) continue; // 16분의 반도 안 되는 음은 버림
      s1 = s0 + 1;
    }
    if (s0 >= total || s1 <= 0) continue;
    for (let s = Math.max(0, s0); s < Math.min(total, s1); s++) {
      cell[s] = n.midi;
      onset[s] = 0;
    }
    if (s0 >= 0) onset[s0] = 1;
  }
  const out = Array.from({ length: bars }, () => []);
  let cur = null;
  for (let s = 0; s < total; s++) {
    const p = cell[s];
    const step = s % STEPS_PER_BAR;
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || cur.midi !== p || onset[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
    } else cur.len++;
  }
  return out;
}

// ---------------------------------------------------------------
// ② 화음: 반주 음 분포(크로마) → 반 마디마다 코드
// ---------------------------------------------------------------
const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_P = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_P = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** 반 마디마다 크로마(12) + 베이스 크로마(12) */
function halfBarChroma(x, sr, firstBeat, bpm, bars) {
  const N = 4096;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const binHz = sr / N;
  // 칸 → 음이름 (가까운 반음에 붙임, 반음 사이 칸은 버림)
  const pcOf = new Int8Array(N / 2).fill(-1);
  const isBass = new Uint8Array(N / 2);
  for (let k = 1; k < N / 2; k++) {
    const f = k * binHz;
    if (f < 40 || f > 2500) continue;
    const m = hzToMidi(f);
    if (Math.abs(m - Math.round(m)) > 0.4) continue;
    pcOf[k] = ((Math.round(m) % 12) + 12) % 12;
    isBass[k] = f < 180 ? 1 : 0;
  }
  const halfSec = (60 / bpm) * 2;
  const H = 2 * bars;
  const chroma = Array.from({ length: H }, () => new Float64Array(12));
  const bass = Array.from({ length: H }, () => new Float64Array(12));
  const energy = new Float64Array(H);
  const hop = Math.round(sr * 0.05);
  const mag = new Float64Array(N / 2);
  const cs = new Float64Array(N / 2 + 1);
  for (let h = 0; h < H; h++) {
    const t0 = firstBeat + h * halfSec;
    for (let t = t0 + 0.02; t < t0 + halfSec - 0.02; t += hop / sr) {
      const a = Math.round(t * sr) - N / 2;
      if (a < 0 || a + N > x.length) continue;
      for (let i = 0; i < N; i++) (re[i] = x[a + i] * win[i]), (im[i] = 0);
      fft(re, im);
      for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
      // 둘레 평균보다 튀어나온 봉우리만 (북소리·잡음처럼 고르게 퍼진 소리는 빼고 음만)
      cs[0] = 0;
      for (let k = 0; k < N / 2; k++) cs[k + 1] = cs[k] + mag[k];
      for (let k = 2; k < N / 2 - 1; k++) {
        const pc = pcOf[k];
        if (pc < 0 || mag[k] < mag[k - 1] || mag[k] < mag[k + 1]) continue;
        const hw = Math.max(4, Math.round(k * 0.06));
        const a2 = Math.max(0, k - hw);
        const b2 = Math.min(N / 2, k + hw + 1);
        const avg = (cs[b2] - cs[a2]) / (b2 - a2);
        const v = mag[k] - 1.5 * avg;
        if (v <= 0) continue;
        if (isBass[k]) bass[h][pc] += v;
        else chroma[h][pc] += v;
        energy[h] += v;
      }
    }
  }
  return { chroma, bass, energy };
}

/**
 * 반 마디마다 코드 → 마디별 prog ('C', 'Am F' …)
 *   장·단3화음 24개를 크로마에 맞춰 보고, 조에 맞는 코드·앞 코드 유지에 조금 더 점수(비터비)
 */
function detectChords(x0, sr0, { firstBeat, bpm, bars, melody = null }) {
  // 낮은 음까지 반음을 가르려면 주파수 칸이 촘촘해야 해서 11kHz 로 줄여서 (4096 칸 = 2.7Hz)
  const { y: x, sr } = downsample(x0, sr0, 11025);
  const { chroma, bass, energy } = halfBarChroma(x, sr, firstBeat, bpm, bars);
  const H = chroma.length;
  // 정규화
  const norm = (v) => {
    let s = 0;
    for (const a of v) s += a * a;
    s = Math.sqrt(s) || 1;
    return Array.from(v, (a) => a / s);
  };
  const C = chroma.map(norm);
  const Bn = bass.map(norm);
  // 딴 멜로디 음도 같이 봄 (반주가 흐릿한 곡에서도 멜로디와 안 부딪히게)
  const M = Array.from({ length: H }, () => new Float64Array(12));
  if (melody)
    melody.forEach((bar, b) =>
      bar.forEach((nn) => {
        for (let i = 0; i < nn.len; i++) {
          const h = 2 * b + ((nn.step + i) >= 8 ? 1 : 0);
          if (h < H) M[h][((nn.midi % 12) + 12) % 12] += (nn.step + i) % 4 === 0 ? 1.5 : 1;
        }
      })
    );
  const Mn = M.map((v) => (v.some((x) => x) ? norm(v) : v));
  // 조 (곡 전체 크로마)
  const tot = new Array(12).fill(0);
  for (const c of C) for (let i = 0; i < 12; i++) tot[i] += c[i];
  let key = 0;
  let minor = false;
  let bestK = -Infinity;
  for (let k = 0; k < 12; k++)
    for (const [prof, mn] of [
      [MAJOR_P, false],
      [MINOR_P, true],
    ]) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += tot[(i + k) % 12] * prof[i];
      if (s > bestK) (bestK = s), (key = k), (minor = mn);
    }
  // 장조 기준 으뜸음 (나란한조 단조면 +3)
  const majTonic = minor ? (key + 3) % 12 : key;
  const diatonic = new Set([0, 2, 4, 5, 7, 9, 11].map((d) => (majTonic + d) % 12));
  const chords = [];
  for (let r = 0; r < 12; r++)
    for (const q of [0, 1]) {
      const tones = [r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12];
      const inKey = tones.every((t) => diatonic.has(t));
      chords.push({ name: NOTE[r] + (q ? 'm' : ''), root: r, tones, prior: inKey ? 0 : -0.12 });
    }
  // 방출: 화음 음 비중 - 밖 음 비중 + 베이스가 뿌리음이면 더
  const em = (h, c) => {
    let inS = 0;
    let out = 0;
    for (let i = 0; i < 12; i++) (c.tones.includes(i) ? (inS += C[h][i]) : (out += C[h][i]));
    let s = inS / 3 - (out / 9) * 1.2 + c.prior;
    let mIn = 0;
    let mOut = 0;
    for (let i = 0; i < 12; i++) (c.tones.includes(i) ? (mIn += Mn[h][i]) : (mOut += Mn[h][i]));
    s += MELW * (mIn / 3 - (mOut / 9) * 1.2);
    s += BASSW * Bn[h][c.root] + 0.1 * Bn[h][c.tones[2]] - 0.1 * Bn[h][(c.root + 1) % 12];
    return s * 4;
  };
  const K = chords.length;
  let prev = new Float64Array(K);
  let cur = new Float64Array(K);
  const back = new Int16Array(H * K);
  const maxE = Math.max(1e-9, ...energy);
  const STAY = 0.3; // 앞 코드 유지 점수
  const BASSW = 0.35; // 베이스가 뿌리음이면 더
  const MELW = 0.3; // 멜로디 음 (살짝)
  for (let h = 0; h < H; h++) {
    const silent = energy[h] < maxE * 0.03;
    for (let j = 0; j < K; j++) {
      const e = silent ? 0 : em(h, chords[j]);
      if (h === 0) {
        cur[j] = e;
        continue;
      }
      let bv = -Infinity;
      let bi = 0;
      for (let i = 0; i < K; i++) {
        const v = prev[i] + (i === j ? STAY : 0);
        if (v > bv) (bv = v), (bi = i);
      }
      cur[j] = bv + e;
      back[h * K + j] = bi;
    }
    [prev, cur] = [cur, prev];
  }
  const pick = new Int16Array(H);
  let bi = 0;
  for (let j = 1; j < K; j++) if (prev[j] > prev[bi]) bi = j;
  for (let h = H - 1; h >= 0; h--) {
    pick[h] = bi;
    bi = back[h * K + bi];
  }
  const prog = [];
  for (let b = 0; b < bars; b++) {
    const a = chords[pick[2 * b]].name;
    const c = chords[pick[2 * b + 1]].name;
    prog.push(a === c ? a : `${a} ${c}`);
  }
  return prog;
}

// ---------------------------------------------------------------
// 한꺼번에
// ---------------------------------------------------------------
/**
 * @param {{ mix: Float32Array[], voc?: Float32Array[]|null, sr: number, firstBeat: number, bpm: number, bars: number, grid?: number }} o
 *   mix = 원래 소리 [L, R], voc = 골라낸 목소리 [L, R] (못 골랐으면 null), firstBeat = 첫 마디 시작(초, 이 소리 안에서)
 * @returns {{ bars, found, prog, drums, vocalShare, leadShare }}
 */
function transcribeSong({ mix, voc = null, sr, firstBeat, bpm, bars, grid = 2, lead = true, inst = null }) {
  const mixM = center(mix);
  const n = mixM.length;
  const accM = new Float32Array(n);
  let vocM = null;
  if (voc) {
    vocM = center(voc);
    for (let i = 0; i < n; i++) accM[i] = mixM[i] - (vocM[i] || 0);
  } else accM.set(mixM);
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  // 목소리가 거의 없는 곡(연주곡·비트)이면 목소리 쪽은 안 봄 (골라낸 소리는 악기 찌꺼기라서)
  let vocalRatio = 0;
  if (vocM) {
    const a = Math.max(0, Math.floor(firstBeat * sr));
    const b = Math.min(n, Math.ceil((firstBeat + total * st) * sr));
    let ev = 0;
    let em = 0;
    for (let i = a; i < b; i += 4) {
      ev += vocM[i] * vocM[i];
      em += mixM[i] * mixM[i];
    }
    vocalRatio = Math.sqrt(ev / (em + 1e-12));
    if (vocalRatio < 0.12) vocM = null;
  }

  // ① 목소리
  const LO = 40;
  const HI = 88;
  let vocNotes = [];
  let vocBars = null;
  if (vocM) {
    const { y, sr: sr2 } = downsample(vocM, sr, 11025);
    const hop = Math.round(sr2 * 0.0116);
    const hopSec = hop / sr2;
    const yc = yinCandidates(y, sr2, hop, LO, HI);
    // 반주 대비 목소리 세기 → 목소리가 거의 없는 곳은 쉼 쪽으로 (분리 찌꺼기)
    const { y: my } = downsample(mixM, sr, 11025);
    const W = Math.round(sr2 * 0.032);
    const gate = new Float32Array(yc.nF);
    let vmax = 0;
    for (let f = 0; f < yc.nF; f++) vmax = Math.max(vmax, yc.rms[f]);
    for (let f = 0; f < yc.nF; f++) {
      let e = 0;
      const a = f * hop;
      for (let i = 0; i < W && a + i < my.length; i++) e += my[a + i] * my[a + i];
      const mr = Math.sqrt(e / W);
      const ratio = yc.rms[f] / (mr + 1e-9);
      const abs = yc.rms[f] / (vmax + 1e-9);
      gate[f] = Math.min(1, Math.max(0, (ratio - 0.02) / 0.05)) * Math.min(1, Math.max(0, (abs - 0.01) / 0.04));
    }
    const f0 = viterbiPitch(yc.cands, yc.nF, LO, HI, gate);
    const tune = tuningOffset(f0);
    const c0 = (Math.round(sr2 * 0.032) / 2) / sr2; // 프레임 가운데 시각
    vocNotes = segment(f0, yc.rms, hopSec, tune).map((nn) => ({ ...nn, t0: nn.t0 + c0, t1: nn.t1 + c0 }));
    vocBars = quantize(vocNotes, firstBeat, bpm, bars);
  }
  // 목소리가 있는 칸
  const vocCell = new Uint8Array(total);
  if (vocBars) vocBars.forEach((bar, b) => bar.forEach((nn) => { for (let i = 0; i < nn.len; i++) vocCell[b * 16 + nn.step + i] = 1; }));
  let vocCount = 0;
  for (const v of vocCell) vocCount += v;

  // 목소리가 없는 긴 구간(1마디 넘게) → 반주의 위쪽 줄
  const gaps = [];
  {
    let s = 0;
    while (s < total) {
      if (vocCell[s]) {
        s++;
        continue;
      }
      let e = s;
      while (e < total && !vocCell[e]) e++;
      // 악기 음(inst)이 있으면 한 박 넘게 빈 곳도 채움 (중간중간 비는 곳 줄이기)
      if (lead && (e - s >= (inst ? 4 : 16) || vocCount < total * 0.1)) gaps.push([s, e]);
      s = e;
    }
  }
  let leadBars = null;
  let leadCount = 0;
  if (gaps.length && inst) {
    leadBars = instLine(inst, gaps, firstBeat, bpm, bars);
    leadBars.forEach((bar) => (leadCount += bar.reduce((a, x) => a + x.len, 0)));
  } else if (gaps.length) {
    const { y, sr: sr2 } = downsample(vocCount < total * 0.1 ? mixM : accM, sr, 22050);
    const hop = Math.round(sr2 * 0.0116);
    const hopSec = hop / sr2;
    const LLO = 52;
    const LHI = 96;
    // 목소리 없는 구간만 봄
    const off = 1024 / sr2; // 창 가운데
    const nF0 = Math.max(0, Math.floor((y.length - 2048) / hop) + 1);
    const inGap = new Uint8Array(nF0);
    for (const [a, b] of gaps) {
      const f0 = Math.max(0, Math.floor((firstBeat + a * st - off) / hopSec));
      const f1 = Math.min(nF0, Math.ceil((firstBeat + b * st - off) / hopSec));
      for (let f = f0; f < f1; f++) inGap[f] = 1;
    }
    const ls = leadSalience(y, sr2, hop, LLO, LHI, (f) => inGap[f]);
    const f0 = viterbiPitch(ls.cands, ls.nF, LLO, LHI, null, { switchP: 0.03, voiceBias: 1.2 });
    // 창 가운데 시각으로 맞춤
    const rms = new Float32Array(ls.nF);
    for (let f = 0; f < ls.nF; f++) {
      let e = 0;
      const a = f * hop + 512;
      const b = Math.min(y.length, a + 1024);
      for (let i = a; i < b; i++) e += y[i] * y[i];
      rms[f] = Math.sqrt(e / 1024);
    }
    const notes = segment(f0, rms, hopSec, 0).map((nn) => ({ ...nn, t0: nn.t0 + off, t1: nn.t1 + off }));
    leadBars = quantize(notes, firstBeat, bpm, bars);
    leadBars.forEach((bar) => (leadCount += bar.reduce((a, x) => a + x.len, 0)));
  }

  // 합치기: 목소리 음 + (목소리 없는 곳의) 반주 위쪽 줄. 반주 줄은 목소리 음역 근처로 옥타브를 옮김
  const merged = Array.from({ length: bars }, () => []);
  const vocMed = median((vocBars || []).flat().map((x) => x.midi));
  for (let b = 0; b < bars; b++) {
    if (vocBars) merged[b].push(...vocBars[b].map((x) => ({ ...x })));
    if (leadBars) {
      for (const x of leadBars[b]) {
        const s = b * 16 + x.step;
        let ok = true;
        for (let i = 0; i < x.len; i++) if (vocCell[s + i]) ok = false;
        if (!ok) continue;
        let m = x.midi;
        if (vocMed != null && vocCount >= total * 0.1) {
          while (m - vocMed > 9) m -= 12;
          while (vocMed - m > 9) m += 12;
        }
        merged[b].push({ ...x, midi: m });
      }
      merged[b].sort((p, q) => p.step - q.step);
    }
  }
  let res = cleanMelody(merged, { grid });
  // 피아노로 듣기 좋은 높이: 가운데가 C4~C6 사이 (C5 근처)
  const all = res.flat();
  if (all.length) {
    const med = median(all.map((x) => x.midi));
    const shift = 12 * Math.round((70 - med) / 12);
    for (const x of all) x.midi = Math.max(48, Math.min(90, x.midi + shift));
  }
  const found = all.length;
  // ② 화음 (반주에서)
  let prog = null;
  try {
    prog = detectChords(accM, sr, { firstBeat, bpm, bars, melody: merged });
  } catch (e) {
    prog = null;
  }
  // ③ 드럼 (곡의 쿵·짝)
  let drums = null;
  try {
    drums = songChart(accM, sr, { firstBeat, bpm, bars, diff: 'normal' }).bars;
  } catch (e) {
    drums = null;
  }
  return { bars: res, found, prog, drums, vocalShare: vocCount / total, leadShare: leadCount / total, vocalRatio };
}

/**
 * Basic Pitch 결과 → 악기 멜로디 (16분 칸마다 '위쪽 줄': 울리는 음 중 가장 높은 음, 베이스 위에 아무것도 없으면 베이스)
 *   gaps 안의 칸만. 같은 음이 이어져도 그 건반의 '막 시작' 확률이 높으면 새 음
 */
function instLine(inst, gaps, firstBeat, bpm, bars) {
  const { note, onset, frames, fps } = inst;
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  const want = new Uint8Array(total);
  for (const [a, b] of gaps) for (let s = a; s < b; s++) want[s] = 1;
  const pick = new Int16Array(total).fill(-1);
  const hit = new Uint8Array(total);
  const act = new Float32Array(88);
  // 문턱: 곡에서 가장 또렷한 음의 30% (0.15~0.3) — 베이스·비트뿐인 곡도 뭔가는 따게
  let gmax = 0;
  for (let i = 0; i < note.length; i++) if (note[i] > gmax) gmax = note[i];
  const TH = Math.max(0.15, Math.min(0.3, gmax * 0.3));
  for (let s = 0; s < total; s++) {
    if (!want[s]) continue;
    const f0 = Math.max(0, Math.round((firstBeat + (s + 0.15) * st) * fps));
    const f1 = Math.min(frames, Math.round((firstBeat + (s + 0.9) * st) * fps) + 1);
    if (f1 <= f0) continue;
    act.fill(0);
    for (let f = f0; f < f1; f++) for (let k = 0; k < 88; k++) act[k] += note[f * 88 + k];
    let mx = 0;
    for (let k = 0; k < 88; k++) (act[k] /= f1 - f0), (mx = Math.max(mx, act[k]));
    if (mx < TH) continue;
    // 위쪽 줄: 꽤 센 음 중 가장 높은 음 (C3 위). 없으면 가장 센 음(베이스 줄)
    let best = -1;
    for (let k = 87; k >= 48 - 21; k--)
      if (act[k] >= Math.max(TH, mx * 0.45)) {
        best = k;
        break;
      }
    if (best < 0) for (let k = 0; k < 88; k++) if (act[k] === mx) best = k;
    pick[s] = best + 21;
    // 그 건반이 칸 시작 근처에서 막 울리기 시작했나
    const c = Math.round((firstBeat + s * st) * fps);
    let on = 0;
    for (let f = Math.max(0, c - 2); f <= Math.min(frames - 1, c + 3); f++) on = Math.max(on, onset[f * 88 + best]);
    hit[s] = on > 0.4 ? 1 : 0;
  }
  const out = Array.from({ length: bars }, () => []);
  let cur = null;
  for (let s = 0; s < total; s++) {
    const p = pick[s];
    const step = s % STEPS_PER_BAR;
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || cur.midi !== p || hit[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
    } else cur.len++;
  }
  // 16분 한 칸짜리 외톨이(앞뒤가 비었거나 다른 음)는 잡음일 때가 많아 지움
  for (const bar of out)
    for (let i = bar.length - 1; i >= 0; i--) {
      const n = bar[i];
      if (n.len === 1 && !(bar[i - 1] && bar[i - 1].step + bar[i - 1].len === n.step) && !(bar[i + 1] && bar[i + 1].step === n.step + 1)) bar.splice(i, 1);
    }
  return out;
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}

return { detectChords, transcribeSong };
})();

// ---- instnotes.js ----
const __m_instnotes = (() => {
// 🎹 반주(악기)에서 음 따기 — Spotify Basic Pitch (Apache-2.0, ONNX 228KB) 를 폰 안에서 돌림
//   11-21 사용자 '반주만 넣었는데 그것도 못 따, 중간중간 안 따지는 곳도 있어' → 배음 더하기로 고르던 악기 줄을
//   여러 음을 한꺼번에 듣는 신경망으로 바꿈. 22.05kHz 소리를 2초 창(겹침 30프레임)으로 넣으면
//   1/86초마다 88건반(A0~C8) 각각 '울리는 중' · '막 시작' 확률이 나옴
const { modelSession } = __m_vocalsep;

const MODEL = '/assets/models/basic-pitch.onnx?v=1';
const SR = 22050;
const N = 43844; // 창 길이 (2초 - 256)
const OV = 30 * 256; // 겹침
const HOP = N - OV;
const BP_FPS = SR / 256;

/** 간단한 저역 필터 + 줄이기 → 22.05kHz */
function to22k(x, sr) {
  if (sr === SR) return x;
  const r = sr / SR;
  const n = Math.floor(x.length / r);
  const y = new Float32Array(n);
  const w = Math.max(1, Math.round(r));
  for (let i = 0; i < n; i++) {
    const c = i * r;
    const a = Math.floor(c);
    let v = 0;
    for (let k = 0; k < w; k++) v += x[a + k] || 0;
    y[i] = v / w;
  }
  return y;
}

/**
 * 소리 → { note, onset: Float32Array(frames*88), frames, fps } (프레임 0 = 소리 0초)
 * @param {Float32Array} x 모노 @param {number} sr
 */
async function instrumentNotes(x, sr, onProgress = () => {}) {
  const sess = await modelSession(MODEL, (p) => onProgress('model', p), 230e3);
  const ort = globalThis.ort;
  const y = to22k(x, sr);
  const a = new Float32Array(y.length + OV / 2);
  a.set(y, OV / 2);
  const starts = [];
  for (let i = 0; i < a.length; i += HOP) starts.push(i);
  const frames = Math.floor((y.length * BP_FPS) / SR);
  const note = new Float32Array(frames * 88);
  const onset = new Float32Array(frames * 88);
  const per = 172 - 30; // 창마다 쓰는 프레임 (앞뒤 15씩 버림)
  const BATCH = 4;
  for (let b0 = 0; b0 < starts.length; b0 += BATCH) {
    const nb = Math.min(BATCH, starts.length - b0);
    const inp = new Float32Array(nb * N);
    for (let j = 0; j < nb; j++) inp.set(a.subarray(starts[b0 + j], starts[b0 + j] + N), j * N);
    const r = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', inp, [nb, N, 1]) });
    const nt = r['StatefulPartitionedCall:1'].data;
    const on = r['StatefulPartitionedCall:2'].data;
    for (let j = 0; j < nb; j++) {
      for (let t = 0; t < per; t++) {
        const f = (b0 + j) * per + t;
        if (f >= frames) break;
        const src = (j * 172 + 15 + t) * 88;
        note.set(nt.subarray(src, src + 88), f * 88);
        onset.set(on.subarray(src, src + 88), f * 88);
      }
    }
    onProgress('run', Math.min(1, (b0 + nb) / starts.length));
    await new Promise((res) => setTimeout(res, 0));
  }
  return { note, onset, frames, fps: BP_FPS };
}

return { BP_FPS, instrumentNotes };
})();

// ---- scorefile.js ----
const __m_scorefile = (() => {
// 🎼 악보 파일(MIDI · MusicXML · .mxl) → 유저 맵 (폰 안에서만 읽음, 서버엔 음표 JSON 만)
//   외부 라이브러리 없음: MIDI 는 직접 읽고, MusicXML 은 작은 XML 읽개, .mxl(zip)은 브라우저 DecompressionStream 으로 풂.
//
//   악보 → { ppq, bpm, timeSig, title, tracks: [{ name, isDrum, notes: [{ tick, dur, midi }] }] }
//   맵   → scoreToMap(score, { melody, start, bars }) = { bpm, mel(마디별 음표), prog, drums, found }
//     멜로디 = 고른 트랙의 16분 칸마다 가장 위 음 (셋잇단 같은 건 가까운 칸으로)
//     코드   = 나머지 트랙 음으로 반 마디마다 (mk.prog 형식 'C' / 'Am F')
//     드럼   = 드럼 트랙(MIDI 채널 10 · MusicXML 타악기) → 쿵·짝·하이햇·크래시 4줄

const { STEPS_PER_BAR } = __m_charts;
const { cellChar, drumCell, MAP_LIMITS } = __m_usermap;

const PPQ = 480; // MusicXML 을 바꿀 때 쓰는 4분음표 틱

// ---------------- MIDI ----------------
/** .mid 바이트 → 악보 */
function parseMidi(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let p = 0;
  const str = (n) => String.fromCharCode(...u.subarray(p, p + n));
  const u32 = () => ((u[p++] << 24) | (u[p++] << 16) | (u[p++] << 8) | u[p++]) >>> 0;
  const u16 = () => (u[p++] << 8) | u[p++];
  const vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = u[p++];
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };
  // RIFF 로 싸인 .rmi 도 있음
  let start = 0;
  for (; start < Math.min(u.length - 4, 200); start++) if (u[start] === 0x4d && u[start + 1] === 0x54 && u[start + 2] === 0x68 && u[start + 3] === 0x64) break;
  p = start;
  if (str(4) !== 'MThd') throw new Error('MIDI 파일이 아니에요');
  p += 4;
  const hlen = u32();
  const hEnd = p + hlen;
  const format = u16();
  const ntr = u16();
  const div = u16();
  if (div & 0x8000) throw new Error('이 MIDI 형식(SMPTE)은 못 읽어요');
  p = hEnd;
  const ppq = div || 480;
  const groups = new Map(); // `${트랙}:${채널}` → 트랙
  const tempos = [];
  let timeSig = null;
  let title = '';
  for (let t = 0; t < ntr && p + 8 <= u.length; t++) {
    const id = str(4);
    p += 4;
    const len = u32();
    const end = Math.min(u.length, p + len);
    if (id !== 'MTrk') {
      p = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    let name = '';
    const on = new Map(); // `${ch}:${key}` → [{ tick }]
    const programs = {};
    const get = (ch) => {
      const k = format === 0 ? `0:${ch}` : `${t}:${ch}`;
      if (!groups.has(k)) groups.set(k, { track: t, channel: ch, name: '', program: null, isDrum: ch === 9, notes: [] });
      return groups.get(k);
    };
    const off = (ch, key) => {
      const st = on.get(`${ch}:${key}`);
      if (!st || !st.length) return;
      const s = st.shift();
      get(ch).notes.push({ tick: s.tick, dur: Math.max(1, tick - s.tick), midi: key, vel: s.vel });
    };
    while (p < end) {
      tick += vlq();
      let b = u[p];
      if (b & 0x80) {
        p++;
        if (b < 0xf0) status = b;
      } else b = status;
      if (b === 0xff) {
        const type = u[p++];
        const l = vlq();
        const d = u.subarray(p, p + l);
        p += l;
        if (type === 0x51 && l === 3) tempos.push({ tick, bpm: 60e6 / ((d[0] << 16) | (d[1] << 8) | d[2]) });
        else if (type === 0x58 && l >= 2 && !timeSig) timeSig = [d[0], 2 ** d[1]];
        else if (type === 0x03 && !name) name = decodeText(d);
        else if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        p += vlq();
        continue;
      }
      if (!(b & 0x80)) break; // 망가진 곳
      const ch = b & 0x0f;
      const hi = b & 0xf0;
      const d1 = u[p++];
      const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : u[p++];
      if (hi === 0x90 && d2 > 0) {
        const k = `${ch}:${d1}`;
        if (!on.has(k)) on.set(k, []);
        on.get(k).push({ tick, vel: d2 });
      } else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) off(ch, d1);
      else if (hi === 0xc0) programs[ch] = d1;
    }
    // 안 꺼진 음은 한 박으로
    for (const [k, st] of on) for (const s of st) get(Number(k.split(':')[0])).notes.push({ tick: s.tick, dur: ppq, midi: Number(k.split(':')[1]), vel: s.vel });
    for (const g of groups.values()) if (g.track === t || format === 0) {
      if (!g.name) g.name = name;
      if (g.program == null && programs[g.channel] != null) g.program = programs[g.channel];
    }
    if (t === 0 && name && format === 1) title = name;
    p = end;
  }
  tempos.sort((a, b) => a.tick - b.tick);
  const tracks = [...groups.values()].filter((g) => g.notes.length).map((g) => ({ ...g, notes: g.notes.sort((a, b) => a.tick - b.tick || b.midi - a.midi) }));
  // 트랙 0 이름이 곡 이름(악기 없는 트랙)일 때만 제목으로
  if (title && tracks.some((tr) => tr.track === 0)) title = '';
  return { ppq, bpm: tempos.length ? tempos[0].bpm : 120, tempoChanges: new Set(tempos.map((x) => Math.round(x.bpm))).size > 1, timeSig: timeSig || [4, 4], title, tracks };
}
function decodeText(d) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(d).trim();
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(d).trim();
    } catch {
      return String.fromCharCode(...d).trim();
    }
  }
}

// ---------------- 작은 XML 읽개 ----------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));
/** XML 글 → { name, attrs, kids, text } 나무 */
function parseXml(src) {
  const root = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] != null) top.text += m[1];
    else if (m[2]) {
      for (let i = stack.length - 1; i > 0; i--)
        if (stack[i].name === m[2]) {
          stack.length = i;
          break;
        }
    } else if (m[3]) {
      const el = { name: m[3], attrs: {}, kids: [], text: '' };
      for (const a of (m[4] || '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) el.attrs[a[1]] = unent(a[2] ?? a[3]);
      top.kids.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] != null && stack.length > 1) top.text += unent(m[6]);
  }
  return root;
}
const kid = (el, name) => el && el.kids.find((k) => k.name === name);
const kidsOf = (el, name) => (el ? el.kids.filter((k) => k.name === name) : []);
const txt = (el, name) => {
  const k = kid(el, name);
  return k ? k.text.trim() : '';
};
const find = (el, name) => {
  if (!el) return null;
  for (const k of el.kids) {
    if (k.name === name) return k;
    const f = find(k, name);
    if (f) return f;
  }
  return null;
};
const findAll = (el, name, out = []) => {
  for (const k of el.kids) {
    if (k.name === name) out.push(k);
    findAll(k, name, out);
  }
  return out;
};

// ---------------- MusicXML ----------------
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 드럼 악보의 줄 위치(display-step) → GM 드럼 번호 (악기 정보가 없을 때) */
function drumFromDisplay(midi) {
  if (midi <= 65) return 36; // F4 이하 = 베이스드럼
  if (midi <= 74) return 38; // C5 근처 = 스네어
  if (midi <= 79) return 42; // G5 = 하이햇
  return 49; // A5 위 = 크래시
}
/** MusicXML 글 → 악보 (score-partwise) */
function parseMusicXml(src) {
  const doc = parseXml(src);
  let score = find(doc, 'score-partwise');
  if (!score) {
    if (find(doc, 'score-timewise')) throw new Error('timewise MusicXML 은 못 읽어요 (partwise 로 저장해 주세요)');
    throw new Error('MusicXML 파일이 아니에요');
  }
  const title = txt(kid(score, 'work'), 'work-title') || txt(score, 'movement-title') || '';
  // 파트 정보 (이름, 타악기 번호)
  const info = {};
  for (const sp of findAll(kid(score, 'part-list') || score, 'score-part')) {
    const inst = {};
    let ch10 = false;
    for (const mi of kidsOf(sp, 'midi-instrument')) {
      const un = Number(txt(mi, 'midi-unpitched'));
      if (un) inst[mi.attrs.id] = un - 1;
      if (txt(mi, 'midi-channel') === '10') ch10 = true;
    }
    info[sp.attrs.id] = { name: txt(sp, 'part-name') || txt(sp, 'part-abbreviation'), inst, ch10 };
  }
  let bpm = null;
  let timeSig = null;
  const tempoSet = new Set();
  const tracks = [];
  let pad = null; // 못갖춘마디(앞 마디가 짧음) → 첫 마디가 제자리에 오게 앞에 쉼
  for (const part of kidsOf(score, 'part')) {
    const pi = info[part.attrs.id] || { name: '', inst: {}, ch10: false };
    const byStaff = new Map();
    const tr = (staff, drum) => {
      const k = `${staff}:${drum ? 1 : 0}`;
      if (!byStaff.has(k)) byStaff.set(k, { name: pi.name, staff, isDrum: drum, notes: [] });
      return byStaff.get(k);
    };
    let divisions = 1;
    let beats = 4;
    let beatType = 4;
    let mStart = 0;
    let first = true;
    const tiesOpen = new Map(); // `${staff}:${midi}` → 음 (이어붙임줄)
    for (const meas of kidsOf(part, 'measure')) {
      let pos = 0;
      let maxPos = 0;
      let lastStart = 0;
      for (const el of meas.kids) {
        if (el.name === 'attributes') {
          const d = Number(txt(el, 'divisions'));
          if (d > 0) divisions = d;
          const tm = kid(el, 'time');
          if (tm && txt(tm, 'beats')) {
            beats = Number(txt(tm, 'beats').split('+').reduce((a, b) => a + Number(b), 0)) || 4;
            beatType = Number(txt(tm, 'beat-type')) || 4;
            if (!timeSig) timeSig = [beats, beatType];
          }
        } else if (el.name === 'direction' || el.name === 'sound') {
          const snd = el.name === 'sound' ? el : find(el, 'sound');
          let t = snd && Number(snd.attrs.tempo);
          if (!t) {
            const mt = find(el, 'metronome');
            const pm = mt && Number(txt(mt, 'per-minute'));
            if (pm) {
              const unit = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 }[txt(mt, 'beat-unit')] || 1;
              t = pm * unit * (kid(mt, 'beat-unit-dot') ? 1.5 : 1);
            }
          }
          if (t > 0) {
            if (bpm == null) bpm = t;
            tempoSet.add(Math.round(t));
          }
        } else if (el.name === 'backup') pos -= (Number(txt(el, 'duration')) * PPQ) / divisions;
        else if (el.name === 'forward') {
          pos += (Number(txt(el, 'duration')) * PPQ) / divisions;
          maxPos = Math.max(maxPos, pos);
        }
        else if (el.name === 'note') {
          const dur = (Number(txt(el, 'duration')) * PPQ) / divisions || 0;
          const isChord = !!kid(el, 'chord');
          if (kid(el, 'grace') || kid(el, 'cue')) continue;
          const at = isChord ? lastStart : pos;
          if (!isChord) {
            lastStart = pos;
            pos += dur;
          }
          maxPos = Math.max(maxPos, pos);
          if (kid(el, 'rest')) continue;
          const staff = Number(txt(el, 'staff')) || 1;
          const ties = kidsOf(el, 'tie').map((t) => t.attrs.type);
          const pitch = kid(el, 'pitch');
          const unp = kid(el, 'unpitched');
          let midi;
          let drum = false;
          if (pitch) {
            midi = 12 * (Number(txt(pitch, 'octave')) + 1) + STEP_PC[txt(pitch, 'step')] + Math.round(Number(txt(pitch, 'alter')) || 0);
            if (pi.ch10 && !Object.keys(pi.inst).length) (drum = true), (midi = drumFromDisplay(midi));
          } else if (unp) {
            drum = true;
            const ins = kid(el, 'instrument');
            midi = ins && pi.inst[ins.attrs.id] != null ? pi.inst[ins.attrs.id] : drumFromDisplay(12 * (Number(txt(unp, 'display-octave')) + 1) + (STEP_PC[txt(unp, 'display-step')] ?? 0));
          } else continue;
          if (!Number.isFinite(midi)) continue;
          const key = `${staff}:${midi}`;
          if (!drum && ties.includes('stop') && tiesOpen.has(key)) {
            const n = tiesOpen.get(key);
            n.dur = mStart + at + dur - n.tick;
            if (!ties.includes('start')) tiesOpen.delete(key);
            continue;
          }
          const n = { tick: Math.round(mStart + at), dur: Math.max(1, Math.round(dur)), midi };
          tr(staff, drum).notes.push(n);
          if (!drum && ties.includes('start')) tiesOpen.set(key, n);
        }
      }
      const nominal = (beats * 4 * PPQ) / beatType;
      // 마디 길이는 박자표대로 (파트끼리 맞게). 못갖춘마디(implicit·첫 마디가 짧음)만 실제 길이
      const short = maxPos > 0 && maxPos < nominal - 1 && (meas.attrs.implicit === 'yes' || first);
      const len = short ? maxPos : Math.max(nominal, maxPos);
      if (first && pad == null) pad = len < nominal - 1 && len > 0 ? nominal - len : 0;
      first = false;
      mStart += len;
    }
    for (const t of byStaff.values()) if (t.notes.length) tracks.push(t);
  }
  // 한 파트에 줄(오른손·왼손)이 여럿이면 이름에 붙여 구분
  const multi = new Set(tracks.filter((t) => t.staff > 1).map((t) => t.name));
  for (const t of tracks) {
    if (multi.has(t.name) && !t.isDrum) t.name = `${t.name || '파트'} ${t.staff === 1 ? '(위 줄)' : `(${t.staff}번째 줄)`}`;
    for (const n of t.notes) n.tick += pad || 0;
    t.notes.sort((a, b) => a.tick - b.tick || b.midi - a.midi);
  }
  return { ppq: PPQ, bpm: bpm || 120, tempoChanges: tempoSet.size > 1, timeSig: timeSig || [4, 4], title, tracks };
}

// ---------------- .mxl (zip) ----------------
async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 .mxl 압축을 못 풀어요. .musicxml 로 저장해서 넣어 주세요');
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([data]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
/** zip 바이트 → { 이름: () => Promise<Uint8Array> } */
function readZip(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) throw new Error('zip 파일이 아니에요');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    const lh = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = u.subarray(lh, lh + csize);
    files[name] = () => (method === 0 ? Promise.resolve(data) : method === 8 ? inflateRaw(data) : Promise.reject(new Error('못 푸는 압축 방식')));
  }
  return files;
}
function xmlText(u) {
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u);
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u);
  return new TextDecoder('utf-8').decode(u);
}

/** 파일 바이트 + 이름 → 악보 (MIDI · MusicXML · mxl 자동 구분) */
async function readScoreFile(bytes, name = '') {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const head = String.fromCharCode(...u.subarray(0, 4));
  if (head === 'MThd' || head === 'RIFF' || /\.(mid|midi|kar|rmi)$/i.test(name)) return parseMidi(u);
  if (head.startsWith('PK')) {
    const files = readZip(u);
    let path = null;
    if (files['META-INF/container.xml']) {
      const c = parseXml(xmlText(await files['META-INF/container.xml']()));
      const rf = find(c, 'rootfile');
      if (rf && files[rf.attrs['full-path']]) path = rf.attrs['full-path'];
    }
    path = path || Object.keys(files).find((f) => !f.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(f));
    if (!path) throw new Error('.mxl 안에 악보가 없어요');
    return parseMusicXml(xmlText(await files[path]()));
  }
  return parseMusicXml(xmlText(u));
}

// ---------------- 악보 → 맵 ----------------
const isHint = (s, re) => re.test(String(s || ''));
const MEL_HINT = /melod|vocal|voice|vox|lead|sing|solo|soprano|tenor|flute|violin\s*i\b|treble|right|멜로디|보컬|노래|주선율|오른손/i;
const NOT_MEL = /bass|drum|perc|pad|chord|comp|accomp|string|left|베이스|드럼|반주|코드|왼손/i;

/** 4분음표가 맵에서 몇 박인지 (BPM 을 60~180 에 맞추려고 반·두 배) */
function tempoFit(bpm) {
  let f = 1;
  let b = bpm;
  while (b > MAP_LIMITS.maxBpm) (b /= 2), (f *= 2);
  while (b < MAP_LIMITS.minBpm) (b *= 2), (f /= 2);
  return { bpm: b, f };
}

/** 악보 요약: 트랙 목록(드럼 아닌 것) · 추천 멜로디 · 전체 마디 수 · 첫 음 마디 */
function scoreInfo(score) {
  const { f, bpm } = tempoFit(score.bpm);
  const step = (score.ppq * f) / 4;
  const barTicks = step * STEPS_PER_BAR;
  const mel = [];
  score.tracks.forEach((t, i) => {
    if (t.isDrum || !t.notes.length) return;
    const ps = t.notes.map((n) => n.midi).sort((a, b) => a - b);
    const starts = new Set(t.notes.map((n) => Math.round(n.tick / step)));
    const first = Math.min(...t.notes.map((n) => n.tick));
    mel.push({ index: i, name: t.name, count: t.notes.length, lo: ps[0], hi: ps[ps.length - 1], median: ps[Math.floor(ps.length / 2)], mono: starts.size / t.notes.length, firstBar: Math.floor(first / barTicks + 0.01) });
  });
  const maxCount = Math.max(1, ...mel.map((m) => m.count));
  let guess = -1;
  let best = -Infinity;
  for (const m of mel) {
    if (m.count < Math.max(8, maxCount * 0.12)) continue;
    // 높은 음 + 한 음씩(화음 적음) + 이름이 멜로디스러우면
    const s = m.median + 12 * m.mono + (isHint(m.name, MEL_HINT) ? 14 : 0) - (isHint(m.name, NOT_MEL) ? 18 : 0) + Math.min(6, Math.log2(m.count));
    if (s > best) (best = s), (guess = m.index);
  }
  if (guess < 0 && mel.length) guess = mel.reduce((a, b) => (b.count > a.count ? b : a)).index;
  let last = 0;
  let firstTick = Infinity;
  for (const t of score.tracks)
    for (const n of t.notes) {
      last = Math.max(last, n.tick + n.dur);
      firstTick = Math.min(firstTick, n.tick);
    }
  return {
    melodyTracks: mel,
    guess,
    hasDrums: score.tracks.some((t) => t.isDrum && t.notes.length),
    totalBars: Math.max(1, Math.ceil(last / barTicks - 0.01)),
    firstBar: Number.isFinite(firstTick) ? Math.floor(firstTick / barTicks) : 0,
    bpm,
  };
}

const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_P = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_P = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
/** 반 마디마다 울리는 음(크로마·가장 낮은 음) → 코드 */
function chordsFromNotes(halves) {
  const tot = new Array(12).fill(0);
  for (const h of halves) for (let i = 0; i < 12; i++) tot[i] += h.chroma[i];
  if (!tot.some((x) => x)) return null;
  let key = 0;
  let minor = false;
  let bk = -Infinity;
  for (let k = 0; k < 12; k++)
    for (const [prof, mn] of [
      [MAJOR_P, false],
      [MINOR_P, true],
    ]) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += tot[(i + k) % 12] * prof[i];
      if (s > bk) (bk = s), (key = k), (minor = mn);
    }
  const tonic = minor ? (key + 3) % 12 : key;
  const dia = new Set([0, 2, 4, 5, 7, 9, 11].map((d) => (tonic + d) % 12));
  const chords = [];
  for (let r = 0; r < 12; r++)
    for (const q of [0, 1]) {
      const tones = [r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12];
      chords.push({ name: NOTE[r] + (q ? 'm' : ''), root: r, tones, prior: tones.every((t) => dia.has(t)) ? 0.08 : 0 });
    }
  let prev = null;
  const out = halves.map((h) => {
    const sum = h.chroma.reduce((a, b) => a + b, 0);
    if (!sum) return prev;
    let pick = null;
    let bs = -Infinity;
    for (const c of chords) {
      let inS = 0;
      for (const t of c.tones) inS += h.chroma[t];
      let s = inS / sum - (1 - inS / sum) * 0.6 + c.prior;
      if (h.bass === c.root) s += 0.18;
      else if (h.bass === c.tones[1] || h.bass === c.tones[2]) s += 0.04;
      if (prev && prev === c.name) s += 0.07;
      if (s > bs) (bs = s), (pick = c);
    }
    prev = pick.name;
    return pick.name;
  });
  // 앞쪽 소리 없는 곳은 첫 코드로
  const firstChord = out.find(Boolean);
  return out.map((c) => c || firstChord);
}

/** GM 드럼 번호 → 맵 악기 (K·S·H·C, 탐탐 등은 안 씀) */
function gmDrum(n) {
  if (n === 35 || n === 36) return 'K';
  if (n === 37 || n === 38 || n === 39 || n === 40) return 'S';
  if (n === 42 || n === 44 || n === 46 || n === 51 || n === 53 || n === 59) return 'H';
  if (n === 49 || n === 52 || n === 55 || n === 57) return 'C';
  return null;
}

/**
 * 악보 → 맵 재료
 * @param {object} score readScoreFile 결과
 * @param {{ melody?: number, start?: number, bars?: number }} o melody = 트랙 번호(-1 = 멜로디 없음), start = 시작 마디(0부터), bars = 마디 수
 * @returns {{ bpm, mel, prog, drums, found, bars, start }}
 */
function scoreToMap(score, { melody = null, start = null, bars = MAP_LIMITS.maxBars } = {}) {
  const info = scoreInfo(score);
  const { f } = tempoFit(score.bpm);
  const step = (score.ppq * f) / 4;
  const mIdx = melody == null ? info.guess : melody;
  const s0 = Math.max(0, Math.min(info.totalBars - 1, start == null ? info.firstBar : start));
  const n = Math.max(1, Math.min(MAP_LIMITS.maxBars, bars, info.totalBars - s0));
  const from = s0 * STEPS_PER_BAR;
  const to = from + n * STEPS_PER_BAR;
  const q = (tick) => Math.round(tick / step);
  // 🎹 멜로디: 16분 칸마다 시작하는 음 중 가장 위 → 다음 음 전까지
  const top = new Map(); // 칸 → { midi, end }
  const melTrack = score.tracks[mIdx];
  const used = new Set();
  if (melTrack && !melTrack.isDrum)
    for (const nn of melTrack.notes) {
      const s = q(nn.tick);
      if (s < from || s >= to) continue;
      const cur = top.get(s);
      if (!cur || nn.midi > cur.midi) {
        if (cur) used.delete(cur.ref);
        top.set(s, { midi: nn.midi, end: Math.max(s + 1, q(nn.tick + nn.dur)), ref: nn });
        used.add(nn);
      }
    }
  const steps = [...top.keys()].sort((a, b) => a - b);
  const mel = Array.from({ length: n }, () => []);
  let found = 0;
  steps.forEach((s, i) => {
    const t = top.get(s);
    const next = i + 1 < steps.length ? steps[i + 1] : to;
    const rel = s - from;
    const b = Math.floor(rel / STEPS_PER_BAR);
    const st = rel % STEPS_PER_BAR;
    let midi = t.midi;
    while (midi < 36) midi += 12;
    while (midi > 96) midi -= 12;
    const len = Math.max(1, Math.min(t.end, next, (b + 1) * STEPS_PER_BAR + from) - s);
    mel[b].push({ step: st, midi, len });
    found++;
  });
  // 🎸 코드: 나머지 트랙(드럼 빼고) + 멜로디 트랙의 아래 음. 멜로디는 살짝만
  const halves = Array.from({ length: n * 2 }, () => ({ chroma: new Array(12).fill(0), bass: -1, low: 999 }));
  let accN = 0;
  const addNote = (nn, w) => {
    const a = Math.max(from, nn.tick / step);
    const b = Math.min(to, (nn.tick + nn.dur) / step);
    for (let h = Math.max(0, Math.floor((a - from) / 8)); h < n * 2 && from + h * 8 < b; h++) {
      const ov = Math.min(b, from + h * 8 + 8) - Math.max(a, from + h * 8);
      if (ov <= 0) continue;
      halves[h].chroma[((nn.midi % 12) + 12) % 12] += ov * w;
      if (w >= 1 && nn.midi < halves[h].low) (halves[h].low = nn.midi), (halves[h].bass = ((nn.midi % 12) + 12) % 12);
    }
  };
  score.tracks.forEach((t, i) => {
    if (t.isDrum) return;
    for (const nn of t.notes) {
      if (i === mIdx && used.has(nn)) continue;
      addNote(nn, 1);
      accN++;
    }
  });
  let prog = null;
  if (accN >= 2) {
    if (melTrack && !melTrack.isDrum) for (const nn of used) addNote(nn, 0.25);
    const ch = chordsFromNotes(halves);
    if (ch) prog = Array.from({ length: n }, (_, b) => (ch[2 * b] === ch[2 * b + 1] ? ch[2 * b] : `${ch[2 * b]} ${ch[2 * b + 1]}`));
  }
  // 🥁 드럼 트랙 → 4줄
  let drums = null;
  const dTracks = score.tracks.filter((t) => t.isDrum);
  if (dTracks.length) {
    const cells = Array.from({ length: n * STEPS_PER_BAR }, () => '.');
    let hits = 0;
    for (const t of dTracks)
      for (const nn of t.notes) {
        const inst = gmDrum(nn.midi);
        const s = q(nn.tick) - from;
        if (!inst || s < 0 || s >= cells.length) continue;
        const c = drumCell(cells[s]);
        // 같은 엄지 겹침: 크래시 > 쿵, 짝 > 하이햇 (cellChar 규칙)
        c[inst] = true;
        cells[s] = cellChar(c);
        hits++;
      }
    if (hits >= 4) drums = Array.from({ length: n }, (_, b) => cells.slice(b * STEPS_PER_BAR, (b + 1) * STEPS_PER_BAR).join(''));
  }
  // 🎹 왼손(아래 줄): 멜로디 말고 다른 트랙(드럼 빼고)에서 16분 칸마다 시작하는 가장 낮은 음 → 다음 음 전까지
  //   한 트랙 피아노(MIDI)면 멜로디 트랙의 안 쓴 음 중 가온 도(C4) 아래만
  const bot = new Map();
  score.tracks.forEach((t, i) => {
    if (t.isDrum) return;
    for (const nn of t.notes) {
      if (i === mIdx && (used.has(nn) || nn.midi >= 60)) continue;
      const s = q(nn.tick);
      if (s < from || s >= to) continue;
      const cur = bot.get(s);
      if (!cur || nn.midi < cur.midi) bot.set(s, { midi: nn.midi, end: Math.max(s + 1, q(nn.tick + nn.dur)) });
    }
  });
  let low = null;
  if (bot.size >= 4) {
    const lb = Array.from({ length: n }, () => []);
    const ls = [...bot.keys()].sort((a, b) => a - b);
    ls.forEach((s, i) => {
      const t = bot.get(s);
      const next = i + 1 < ls.length ? ls[i + 1] : to;
      const rel = s - from;
      const b = Math.floor(rel / STEPS_PER_BAR);
      let midi = t.midi;
      while (midi < 28) midi += 12;
      while (midi > 72) midi -= 12;
      lb[b].push({ step: rel % STEPS_PER_BAR, midi, len: Math.max(1, Math.min(t.end, next, (b + 1) * STEPS_PER_BAR + from) - s) });
    });
    low = lb;
  }
  return { bpm: Math.round(info.bpm), mel, prog, drums, low, found, bars: n, start: s0, melodyIndex: mIdx };
}

/** 추천 시작 마디: 고른 멜로디가 처음 나오는 마디 (멜로디 없는 전주는 건너뜀) */
function recommendStart(info, melody) {
  const t = info.melodyTracks.find((m) => m.index === melody);
  const b = t ? t.firstBar : info.firstBar;
  return Math.max(0, Math.min(b, info.totalBars - 1));
}

return { parseMidi, parseXml, parseMusicXml, readZip, readScoreFile, scoreInfo, chordsFromNotes, gmDrum, scoreToMap, recommendStart };
})();

// ---- mp4audio.js ----
const __m_mp4audio = (() => {
// 🎞 영상 파일(mp4·mov)에서 소리(AAC)만 꺼내기 (폰 안에서만)
//   아이폰 사파리는 사진첩에서 고른 영상(.mov)을 decodeAudioData 로 못 풀고, 영상을 재생하며 받아 적는 방법은
//   영상 길이만큼 걸리고 중간에 멈추기도 함(11-21 '1분 40초 영상이 10초만 읽힘').
//   → 파일의 상자(moov/trak/stbl)를 읽어 소리 조각 위치를 알아내고, 조각마다 ADTS 머리(7바이트)를 붙여 .aac 로 만듦.
//   파일 전체를 메모리에 올리지 않고 필요한 부분만 읽음 (화면 녹화는 수백 MB)

const td = (u8, at) => String.fromCharCode(u8[at], u8[at + 1], u8[at + 2], u8[at + 3]);
const u32 = (u8, at) => ((u8[at] << 24) | (u8[at + 1] << 16) | (u8[at + 2] << 8) | u8[at + 3]) >>> 0;
const u64 = (u8, at) => u32(u8, at) * 4294967296 + u32(u8, at + 4);

async function readAt(file, pos, len) {
  return new Uint8Array(await file.slice(pos, pos + len).arrayBuffer());
}

/** u8[start, end) 안의 상자들 → [{ type, at(내용 시작), end }] */
function boxes(u8, start = 0, end = u8.length) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(u8, p);
    const type = td(u8, p + 4);
    let head = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = u64(u8, p + 8);
      head = 16;
    } else if (size === 0) size = end - p;
    if (size < head || p + size > end) break;
    out.push({ type, at: p + head, end: p + size });
    p += size;
  }
  return out;
}
const child = (u8, box, type) => boxes(u8, box.at, box.end).find((b) => b.type === type) || null;
function path(u8, box, types) {
  let b = box;
  for (const t of types) if (!(b = b && child(u8, b, t))) return null;
  return b;
}

/** 파일 맨 위 상자들을 훑어 moov 를 찾아 통째로 읽음 */
async function readMoov(file) {
  let pos = 0;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const h = await readAt(file, pos, 16);
    let size = u32(h, 0);
    const type = td(h, 4);
    if (size === 1) size = u64(h, 8);
    else if (size === 0) size = file.size - pos;
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > 64 * 1048576) return null;
      return readAt(file, pos, size);
    }
    pos += size;
  }
  return null;
}

/** ES 서술자 길이 (1~4바이트, 앞 비트가 '더 있음') */
function descLen(u8, p) {
  let len = 0;
  let n = 0;
  for (; n < 4; n++) {
    const b = u8[p + n];
    len = (len << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return { len, size: n + 1 };
}

/** 샘플 설명(stsd) 안의 esds → { objType, sfi, ch } (AAC 가 아니면 null) */
function aacConfig(u8, stsd) {
  // stsd 안에서 'esds' 글자를 찾음 (QuickTime 은 mp4a → wave → esds 로 한 겹 더 들어감)
  for (let p = stsd.at; p + 8 < stsd.end; p++) {
    if (u8[p] !== 0x65 || td(u8, p) !== 'esds') continue;
    const end = Math.min(stsd.end, p - 4 + u32(u8, p - 4));
    let q = p + 4 + 4; // 'esds' + 버전·플래그
    if (u8[q] !== 0x03) return null;
    q += 1 + descLen(u8, q + 1).size;
    const flags = u8[q + 2];
    q += 3;
    if (flags & 0x80) q += 2;
    if (flags & 0x40) q += 1 + u8[q];
    if (flags & 0x20) q += 2;
    if (u8[q] !== 0x04) return null;
    q += 1 + descLen(u8, q + 1).size;
    const oti = u8[q];
    if (oti !== 0x40 && oti !== 0x66 && oti !== 0x67) return null; // MPEG-4 / MPEG-2 AAC
    q += 13;
    if (u8[q] !== 0x05 || q >= end) return null;
    q += 1 + descLen(u8, q + 1).size;
    const b0 = u8[q];
    const b1 = u8[q + 1];
    let objType = b0 >> 3;
    let sfi = ((b0 & 7) << 1) | (b1 >> 7);
    let ch = (b1 >> 3) & 15;
    if (objType === 31) return null;
    if (sfi === 15) return null;
    // HE-AAC(SBR·PS) 는 ADTS 에선 LC 로 (디코더가 알아서 SBR 을 붙임)
    if (objType === 5 || objType === 29) objType = 2;
    if (objType < 1 || objType > 4 || ch < 1 || ch > 7) return null;
    return { objType, sfi, ch };
  }
  return null;
}

/** 소리 트랙의 샘플(AAC 조각) 위치·크기 */
function audioTrack(u8, moov) {
  for (const trak of boxes(u8, moov.at, moov.end).filter((b) => b.type === 'trak')) {
    const hdlr = path(u8, trak, ['mdia', 'hdlr']);
    if (!hdlr || td(u8, hdlr.at + 8) !== 'soun') continue;
    const stbl = path(u8, trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;
    const stsd = child(u8, stbl, 'stsd');
    const stsz = child(u8, stbl, 'stsz');
    const stsc = child(u8, stbl, 'stsc');
    const stco = child(u8, stbl, 'stco') || child(u8, stbl, 'co64');
    if (!stsd || !stsz || !stsc || !stco) continue;
    const cfg = aacConfig(u8, stsd);
    if (!cfg) continue;
    // 크기
    const fixed = u32(u8, stsz.at + 4);
    const count = u32(u8, stsz.at + 8);
    if (fixed !== 0 || !count) continue; // AAC 는 조각마다 크기가 다름
    const sizes = new Uint32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = u32(u8, stsz.at + 12 + i * 4);
    // 조각 묶음(chunk) 위치
    const wide = td(u8, stco.at - 4) === 'co64';
    const nChunks = u32(u8, stco.at + 4);
    const offs = new Array(nChunks);
    for (let i = 0; i < nChunks; i++) offs[i] = wide ? u64(u8, stco.at + 8 + i * 8) : u32(u8, stco.at + 8 + i * 4);
    // 묶음마다 조각 수
    const nRuns = u32(u8, stsc.at + 4);
    const per = new Uint32Array(nChunks);
    for (let r = 0; r < nRuns; r++) {
      const first = u32(u8, stsc.at + 8 + r * 12) - 1;
      const spc = u32(u8, stsc.at + 12 + r * 12);
      const next = r + 1 < nRuns ? u32(u8, stsc.at + 8 + (r + 1) * 12) - 1 : nChunks;
      for (let c = first; c < next && c < nChunks; c++) per[c] = spc;
    }
    return { cfg, sizes, offs, per };
  }
  return null;
}

function adtsHeader(cfg, len) {
  const L = len + 7;
  const profile = cfg.objType - 1;
  return [0xff, 0xf1, (profile << 6) | (cfg.sfi << 2) | (cfg.ch >> 2), ((cfg.ch & 3) << 6) | (L >> 11), (L >> 3) & 0xff, ((L & 7) << 5) | 0x1f, 0xfc];
}

/**
 * 영상 파일 → ADTS(.aac) 바이트 (소리가 AAC 가 아니거나 못 읽으면 null)
 * @param {Blob} file
 * @param {(p: number) => void} [onProgress] 0~1
 * @returns {Promise<Uint8Array|null>}
 */
async function videoToAac(file, onProgress = () => {}) {
  const moovBytes = await readMoov(file);
  if (!moovBytes) return null;
  const top = boxes(moovBytes).find((b) => b.type === 'moov');
  if (!top) return null;
  const tr = audioTrack(moovBytes, top);
  if (!tr) return null;
  const { cfg, sizes, offs, per } = tr;
  let total = 0;
  for (let i = 0; i < sizes.length; i++) total += sizes[i] + 7;
  if (total > 200 * 1048576) return null;
  const out = new Uint8Array(total);
  // 묶음마다 [파일 위치, 길이, 첫 조각 번호]. 가까이 붙은 묶음은 한 번에 읽음
  const jobs = [];
  let s = 0;
  for (let c = 0; c < offs.length && s < sizes.length; c++) {
    let len = 0;
    for (let k = 0; k < per[c] && s + k < sizes.length; k++) len += sizes[s + k];
    jobs.push({ pos: offs[c], len, s0: s, n: Math.min(per[c], sizes.length - s) });
    s += per[c];
  }
  const groups = [];
  for (const j of jobs) {
    const g = groups[groups.length - 1];
    if (g && j.pos >= g.pos && j.pos - (g.pos + g.len) < 65536 && j.pos + j.len - g.pos < 8 * 1048576) {
      g.len = j.pos + j.len - g.pos;
      g.jobs.push(j);
    } else groups.push({ pos: j.pos, len: j.len, jobs: [j] });
  }
  // 조각 번호 → out 안의 자리
  const at = new Float64Array(sizes.length + 1);
  for (let i = 0; i < sizes.length; i++) at[i + 1] = at[i] + sizes[i] + 7;
  let done = 0;
  const work = async (g) => {
    const buf = await readAt(file, g.pos, g.len);
    for (const j of g.jobs) {
      let p = j.pos - g.pos;
      for (let k = 0; k < j.n; k++) {
        const i = j.s0 + k;
        const sz = sizes[i];
        if (p + sz > buf.length) throw new Error('short');
        const o = at[i];
        out.set(adtsHeader(cfg, sz), o);
        out.set(buf.subarray(p, p + sz), o + 7);
        p += sz;
      }
    }
    done++;
    onProgress(done / groups.length);
  };
  // 여러 개를 같이 읽음
  let next = 0;
  const lanes = Array.from({ length: 6 }, async () => {
    while (next < groups.length) await work(groups[next++]);
  });
  await Promise.all(lanes);
  return out;
}

return { videoToAac };
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
  // 🎨 꾸미기: 배경·드럼 세트 = 'auto'(단계 맵 따라) 또는 themes.js 맵 키, 콩 색 = render.js NOTE_PALETTES 키
  bg: 'auto',
  kit: 'auto',
  notes: 'basic',
  // 🎤 화면 스타일: 'basic' 또는 'live'(상점 라이브 스테이지 세트)
  ui: 'basic',
  // 📷 내 사진 배경 어둡게 (0~0.85). 사진 파일 자체는 IndexedDB (photoSave)
  photoDim: 0.4,
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

/** 18단계 = 엘리제를 위하여 (2026-11-21). 이 브라우저에 남은 그 전 18번(빼 버린 찬송가) 기록은 한 번 지움 */
const ELISE_FROM = Date.parse('2026-11-21T06:15:00Z');
function resetOldLevel18() {
  if (load('level18V2', false)) return;
  for (const key of ['bests', 'mockBoard']) {
    const old = load(key, null);
    if (!old || typeof old !== 'object') continue;
    let changed = false;
    for (const k of ['18', 'e18']) {
      const v = old[k];
      if (v && !(v.at >= ELISE_FROM)) { delete old[k]; changed = true; }
    }
    if (changed) save(key, old);
  }
  save('level18V2', true);
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

// ---------------- 📷 내 사진 배경: 이 폰의 IndexedDB 에만 (서버로 안 감) ----------------
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('okaystra', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) {
      rej(e);
    }
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = tx.onabort = () => rej(tx.error);
  });
}
/** 사진(Blob) 저장. IndexedDB 가 막힌 브라우저면 작을 때만 localStorage 에 */
async function photoSave(blob) {
  try {
    await idbDo('readwrite', (st) => st.put(blob, 'bgPhoto'));
    remove('bgPhotoUrl');
    return true;
  } catch {
    if (blob.size > 1.5e6) return false;
    const url = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.onerror = () => r(null);
      fr.readAsDataURL(blob);
    });
    if (!url) return false;
    try {
      localStorage.setItem(PREFIX + 'bgPhotoUrl', JSON.stringify(url));
      return true;
    } catch {
      return false;
    }
  }
}
/** 저장된 사진 → 이미지 주소(objectURL 또는 data URL), 없으면 null */
async function photoLoad() {
  try {
    const b = await idbDo('readonly', (st) => st.get('bgPhoto'));
    if (b) return URL.createObjectURL(b);
  } catch {}
  return load('bgPhotoUrl', null);
}
async function photoDelete() {
  try {
    await idbDo('readwrite', (st) => st.delete('bgPhoto'));
  } catch {}
  remove('bgPhotoUrl');
}

return { load, save, remove, DEFAULT_SETTINGS, loadSettings, saveSettings, loadBests, saveBest, resetOldLevel18, migrateLevelOrder, photoSave, photoLoad, photoDelete };
})();

// ---- coins.js ----
const __m_coins = (() => {
// 🪙 코인 (2026-11-22)
//   PERFECT 2코인 · GREAT·GOOD·연타 1코인. 판 도중에 나가도 그때까지 번 만큼. 잔액은 서버 지갑(팔로워 인증한 계정)에 보관.
//   판이 끝나면 폰에 모아 두었다가 다음 판 시작(/api/runs)·점수 등록(/api/scores) 요청에 얹어 보냄 → 요청 수 그대로.
//   · 판 토큰이 있는 판 → runs [{tok, n}] (서버가 그 곡 콩 수로 상한 확인)
//   · 토큰 없는 판(연습·멀티·유저 맵·내 노래…) → free (서버가 하루 한도)
//   · 인증 전(계정 없음)에 번 코인 → 폰 'coins' 에 → 인증하면 init 으로 한 번 올림
const { load, save } = __m_storage;

let account = false; // 서버 지갑을 쓰는 계정인가 (팔로워 인증 완료)
let onChange = () => {};

// 지갑에 적는 건 D1 쓰기 1줄 → 판마다 보내지 않고 10분에 한 번(또는 판이 많이 쌓이면) 모아서 (2026-11-22 저녁)
//   화면 잔액은 보낼 것까지 더해서 보여 주니 그대로. 서버는 판 토큰을 14일까지 받음
// 2026-11-23 사용자 '바로 서버로, 안전하게' → 기다리지 않고 다음 판 시작·점수 요청마다 얹어 보냄 (지갑 쓰기 판마다 1줄)
//   서버가 D1 쓰기가 많다고 알려 주면(coinSlow, 브레이크 1단계~) 1시간 동안은 예전처럼 10분에 한 번
const SLOW_MS = 10 * 60 * 1000;
const sendEvery = () => (Number(load('coinSlowUntil', 0)) > Date.now() ? SLOW_MS : 0);
const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const queue = () => {
  const q = load('coinQ', []);
  return Array.isArray(q) ? q.filter((x) => x && typeof x.tok === 'string' && x.n > 0) : [];
};

function coinsInit({ changed } = {}) {
  if (changed) onChange = changed;
  // 보내다 끊긴 것(앱을 닫음 등)은 다시 줄에 넣음 (서버가 같은 판은 한 번만 받음)
  const s = load('coinSending', null);
  if (s) {
    save('coinQ', [...(s.runs || []), ...queue()].slice(-40));
    save('coinFree', int(load('coinFree', 0)) + int(s.free));
    save('coinSending', null);
  }
}

/** 인증 상태가 바뀌면 (me 받을 때마다) */
function setCoinAccount(on, serverCoins) {
  account = !!on;
  if (account && Number.isFinite(serverCoins)) save('coinSrv', int(serverCoins));
  onChange();
}

/** 화면에 보일 잔액 */
function coinTotal() {
  const local = int(load('coins', 0));
  if (!account) return local;
  const sending = load('coinSending', null);
  const pend = queue().reduce((a, x) => a + int(x.n), 0) + int(load('coinFree', 0));
  const inFlight = sending ? (sending.runs || []).reduce((a, x) => a + int(x.n), 0) + int(sending.free) + int(sending.init) : 0;
  return int(load('coinSrv', 0)) + pend + inFlight + (load('coinInit', false) ? 0 : local);
}

/** 판 하나 끝: n 코인 (tok = 그 판의 서버 판 토큰, 없으면 null) */
function addRunCoins(n, tok) {
  n = int(n);
  if (!n) return;
  if (!account) save('coins', int(load('coins', 0)) + n);
  else if (tok) {
    const q = queue();
    const same = q.find((x) => x.tok === tok);
    if (same) same.n += n;
    else q.push({ tok, n });
    save('coinQ', q.slice(-40));
  }
  else save('coinFree', int(load('coinFree', 0)) + n);
  onChange();
}

/**
 * 요청에 얹을 것 (없으면 undefined). 보내는 중인 게 있으면 겹쳐 보내지 않음
 *   force: 10분 기다림 없이 지금 다 (🛒 상점에서 살 때 — 구매 요청에 얹으면 서버가 먼저 더하고 그다음 차감)
 */
function takeCoins({ force = false } = {}) {
  if (!account || load('coinSending', null)) return undefined;
  const runs = queue();
  const free = int(load('coinFree', 0));
  const init = load('coinInit', false) ? null : int(load('coins', 0));
  if (!runs.length && !free && init == null) return undefined;
  const last = Number(load('coinSentAt', 0)) || 0;
  if (!force && init == null && Date.now() - last < sendEvery() && runs.length < 25) return undefined;
  const c = { runs, free };
  if (init != null) c.init = init;
  save('coinSending', c);
  save('coinQ', []);
  save('coinFree', 0);
  return c;
}

/** 서버 지갑에 바로 들어간 코인 (투표 보상 등) — 계정이면 화면 잔액에도 더함 */
function addServerCoins(n) {
  if (account && int(n)) save('coinSrv', int(load('coinSrv', 0)) + int(n));
  onChange();
}

/** 응답이 왔음: data.coins 가 있으면 서버가 받은 것 → 보낸 것 비우고 잔액 갱신, 없으면 다시 줄에 */
function coinsResult(data) {
  const s = load('coinSending', null);
  if (data && Number.isFinite(data.coins)) {
    save('coinSrv', int(data.coins));
    if (s) save('coinSentAt', Date.now());
    if (s && s.init != null) save('coinInit', true);
    save('coinSending', null);
    // 오늘 한도(하루 5000)를 넘어 서버가 못 받은 만큼 → 다시 모아 뒀다가 다음 날 (2026-11-23)
    if (data.coinSlow) save('coinSlowUntil', Date.now() + 60 * 60 * 1000);
    const rest = int(data.coinRest);
    if (rest) save('coinFree', int(load('coinFree', 0)) + rest);
  } else if (s) coinsInit();
  onChange();
}

return { coinsInit, setCoinAccount, coinTotal, addRunCoins, takeCoins, addServerCoins, coinsResult };
})();

// ---- season.js ----
const __m_season = (() => {
// 🏛 시즌 · 명예의 전당 (브라우저와 서버가 같이 씀)
//   시즌마다 '단계 총합'(1~LAST_LEVEL_ID 단계 최고점 합)과 '무제한 총합'(무제한 판들의 점수 합) 두 랭킹.
//   시즌이 끝나면 두 랭킹의 1·2·3등이 명예의 전당(hall)에 영원히 남고, 그 사람은 프로필 사진을 올릴 수 있음.
//   시즌 1 = 처음 ~ 2026-11-26 23:59:59 (한국 시간, 인스타 DM 금지 마지막 날) / 시즌 2 = 11-27 부터 (끝나는 날은 아직 안 정함)
//   시즌 1 점수 = 지금까지의 최고 기록(scores), 시즌 2 부터는 그 시즌에 친 기록만(season_scores)

const SEASONS = [
  { n: 1, end: Date.UTC(2026, 10, 26, 14, 59, 59, 999) },
  { n: 2, end: null },
];
const HALL_BOARDS = ['stage', 'endless'];
const BOARD_LABEL = { stage: '🎵 단계 총합', endless: '💎 무제한 총합' };
/** 프로필 사진 (data URL) 최대 길이 — 160px 정사각 JPEG 면 보통 10~20KB */
const HALL_IMAGE_MAX = 60000;

/** 그 시각의 시즌 { n, start, end } */
function seasonAt(t = Date.now()) {
  let start = 0;
  for (const s of SEASONS) {
    if (s.end == null || t <= s.end) return { n: s.n, start, end: s.end };
    start = s.end + 1;
  }
  const last = SEASONS[SEASONS.length - 1];
  return { n: last.n, start, end: last.end };
}
/** 이미 끝난 시즌 번호들 */
const endedSeasons = (t = Date.now()) => SEASONS.filter((s) => s.end != null && t > s.end).map((s) => s.n);

/** '3일 뒤 시즌 1이 끝나요' 같은 안내 (한국 날짜 기준) */
function seasonLeftText(t = Date.now()) {
  const s = seasonAt(t);
  if (s.end == null) return `🏆 시즌 ${s.n} 진행 중`;
  const day = (ms) => Math.floor((ms + 9 * 3600e3) / 86400e3); // 한국 날짜 번호
  const d = day(s.end) - day(t);
  if (d <= 0) return `⏰ 오늘 밤 11시 59분에 시즌 ${s.n}이 끝나요!`;
  if (d === 1) return `⏰ 내일 밤 11시 59분에 시즌 ${s.n}이 끝나요!`;
  return `🏆 ${d}일 뒤 시즌 ${s.n}이 종료돼요`;
}

/** 사진 data URL 검사 */
const cleanHallImage = (v) =>
  typeof v === 'string' && v.length <= HALL_IMAGE_MAX && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;

return { SEASONS, HALL_BOARDS, BOARD_LABEL, HALL_IMAGE_MAX, seasonAt, endedSeasons, seasonLeftText, cleanHallImage };
})();

// ---- offrec.js ----
const __m_offrec = (() => {
// 📴 서버 없을 때 친 판의 최고 기록 (2026-11-22, D1 하루 한도가 차서 랭킹이 안 올라가던 날)
//   서버 없는 모드에선 판 토큰을 못 받아 점수를 못 올림 → 단계마다 최고 기록 하나만 폰에 모아 둠
//   서버가 돌아오면 다음 판 시작(/api/runs)·점수 등록(/api/scores)에 얹어 보냄 (코인처럼, 요청 안 늘림)
//   서버는 콩 수·점수 상한·친 시각(36시간 안)만 보고 받음. 한 번에 5개씩, 받은 것(done)만 지움
const { load, save } = __m_storage;
const { SEASONS } = __m_season;

const KEEP_MS = 34 * 3600 * 1000; // 서버는 36시간까지 받음 → 조금 일찍 버림
const pending = () => {
  const m = load('offRecs', {});
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
};
const better = (a, b) => (a.rounds != null ? a.rounds > b.rounds || (a.rounds === b.rounds && a.score > b.score) : a.score > b.score);

/** 결과 하나 담기 (같은 단계는 더 좋은 것만). 담았으면 true */
function queueOffline(r, endless) {
  const e = endless
    ? { level: r.levelId, rounds: r.roundsCleared, score: r.score, at: Date.now() }
    : { level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts, check: r.check, at: Date.now() };
  if (!Number.isInteger(e.score) || (endless ? !(r.roundsCleared >= 1) : !r.counts)) return false;
  const m = pending();
  const key = String(r.levelId);
  if (m[key] && Date.now() - m[key].at < KEEP_MS && !better(e, m[key])) return true;
  m[key] = e;
  save('offRecs', m);
  return true;
}

const offlineCount = () => Object.keys(pending()).length;

/** 요청에 얹을 것 (없으면 undefined). 오래된 건 버림 */
function takeOffline() {
  const m = pending();
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(m)) {
    if (!m[k] || !(now - m[k].at < KEEP_MS)) {
      delete m[k];
      changed = true;
    }
  }
  if (changed) save('offRecs', m);
  const list = Object.values(m);
  return list.length ? list.slice(0, 5) : undefined;
}

/** 응답: offline.done 에 든 단계는 지움 (서버가 받았거나 형식이 틀려 버림) */
function offlineResult(data) {
  const o = data && data.offline;
  if (!o || !Array.isArray(o.done) || !o.done.length) return;
  const m = pending();
  const bk = load('offBk', {}) || {};
  for (const k of o.done) {
    delete m[String(k)];
    delete bk[String(k)];
  }
  save('offRecs', m);
  save('offBk', bk);
  try {
    window.dispatchEvent(new CustomEvent('okaystra:offline-sent', { detail: { n: o.done.length, improved: o.improved || 0 } }));
  } catch {}
}

/**
 * 📴 서버 보관함(Neon)에도 맡김 — D1 이 막혀도 받는 따로 된 길 (/api/offline-save). 폰 것도 그대로 둠
 *   맡긴 단계는 offBk 에 그 점수로 기억 → 화면에 '서버 보관함에도 저장됨'
 * @returns {Promise<boolean>} 이 기록이 서버 보관함에 들어갔나
 */
async function backupOffline(levelId) {
  const m = pending();
  const list = Object.values(m);
  if (!list.length) return false;
  try {
    const res = await fetch('/api/offline-save', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: list }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    const bk = load('offBk', {}) || {};
    for (const k of d.saved || []) if (m[k]) bk[k] = m[k].score;
    save('offBk', bk);
    return levelId != null && isBackedUp(levelId);
  } catch {
    return false;
  }
}
function isBackedUp(levelId) {
  const k = String(levelId);
  const m = pending();
  const bk = load('offBk', {}) || {};
  return !!m[k] && bk[k] === m[k].score;
}

// 🩹 11-22 13시~11-23 9시(KST) 서버가 쉬는 동안 친 기록은 이 폰이 저장도 안 하고 버렸음(submitRank 버그, 11-23 고침)
//   → '내 최고 기록'(bests)에 남은 그 시간 것을 다음 판 시작·점수 등록에 얹어 한 번 올림 (서버 validateLost, 시즌 1 끝까지)
const LOST_FROM = Date.parse('2026-11-22T04:00:00Z');
const LOST_TO = Date.parse('2026-11-23T00:00:00Z');
const LOST_UNTIL = SEASONS[0].end; // 시즌 1 끝까지만
function takeLost() {
  if (load('lostSent', 0) || Date.now() > LOST_UNTIL) return undefined;
  let m = load('lostRecs', null);
  if (!m || typeof m !== 'object') {
    m = {};
    const bests = load('bests', {}) || {};
    for (const [k, b] of Object.entries(bests)) {
      if (!/^[1-9][0-9]*$/.test(k) || !b || !Number.isInteger(b.score) || !(b.at >= LOST_FROM && b.at < LOST_TO)) continue;
      m[k] = { level: Number(k), score: b.score, maxCombo: b.maxCombo, grade: b.grade, at: b.at };
    }
    save('lostRecs', m);
  }
  const list = Object.values(m);
  if (!list.length) {
    save('lostSent', 1);
    return undefined;
  }
  return list.slice(0, 5);
}
/** 응답 lost.done 에 든 단계는 지움 → 다 보냈으면 다시 안 봄 */
function lostResult(data) {
  const o = data && data.lost;
  if (!o || !Array.isArray(o.done)) return;
  const m = load('lostRecs', {}) || {};
  for (const k of o.done) delete m[String(k)];
  save('lostRecs', m);
  if (!Object.keys(m).length) save('lostSent', 1);
}

return { queueOffline, offlineCount, takeOffline, offlineResult, backupOffline, isBackedUp, takeLost, lostResult };
})();

// ---- game.js ----
const __m_game = (() => {
// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

const { STEPS_PER_BAR, tempoOf, ROUND_BARS, roundInfo, diamondsFor, buildNotes, JUDGE, pointsFor, accuracy, gradeFor, starsFor, COUNT_IN_BARS, OUTRO_BARS, maxScore, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH, buildRolls, markGoldNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS, parseMelody, pianoHarmony, ALT_GAP } = __m_charts;
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
/**
 * 지나간 노트를 MISS 로 넘기기 전에 이만큼(초) 더 기다림.
 *   폰이 한 프레임 버벅이면 터치 이벤트가 늦게 도착함(시각은 실제로 누른 때). 그 사이 화면 갱신이 먼저
 *   돌면서 노트를 MISS 로 지워 버리면, 제때 누른 터치가 '안 먹힌' 것처럼 됨 → 늦게 온 터치도 판정되게 여유를 둠
 */
const MISS_SLACK = 0.12;
/**
 * 터치 판정은 단순하게 (2026-11-24, 사용자 '그냥 눌렀을 때 쿵 있으면 맞은 거, 없으면 미스 아니야?'):
 *   ① 누른 줄에 판정 시간(GOOD) 안 콩이 있으면 → 그 콩 (가장 먼저 온 것)
 *   ② 단, 누른 줄 콩이 아직 안 왔는데(PERFECT 보다 이름) 선 바로 옆(NEAR_LINE)을 눌렀고 옆 줄 콩이 먼저 와 있으면 → 옆 줄 콩
 *      (쿵짝쿵에서 짝 엄지가 가운데 선을 살짝 넘어 쿵 줄을 누른 것. 콩 시각이 같으면 늘 내 줄)
 *   ③ 누른 줄에 칠 콩이 없으면 → 옆 줄 쪽 절반(NEAR_HALF)이면 옆 줄 콩, 아니면 같은 엄지 줄(챙·쿵 / 짝·츠) 콩
 *   ④ 동시에 치는 콩(쿵+짝 같이): 한 엄지가 선을 넘어 남의 줄 콩을 쳤으면, 다른 엄지가 누를 때 남은 짝꿍 콩을 침
 *   ⑤ 아무것도 없으면 → 헛침. 지나간 콩을 조금 늦게 친 거면 그 콩 MISS 하나만 (다음 콩보다 지나간 콩이 먼저)
 *      일찍 누른 거면(EARLY 안) 헛침인데, 그 콩을 끝내 못 치면 헛침 대신 그 콩 MISS 로 바꿈 → 벌은 한 번만
 *   한 터치는 그 콩 하나만 건드림 — 예전처럼 일찍 누른 터치가 다음 콩을 MISS 로 만들거나, 콩을 빌려 갔다 되돌려 주지 않음.
 *   (예전 규칙들이 겹쳐서, 엄지를 떼며 굴린 '가짜 터치' 하나에 제대로 친 콩까지 MISS + 헛침이 됨 → '분명히 눌렀는데 안 눌려요')
 */
const NEAR_LINE = 0.3;
const NEAR_HALF = 0.5;
/** 같은 줄을 이 시간(초) 안에 또 누르면 다른 엄지로 봄 (② 의 '선 바로 옆'을 옆 줄 쪽 절반까지 넓힘) */
const TWIN_GAP = 0.15;

class Game {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {import('./render.js').Renderer} o.renderer
   */
  constructor({ audio, renderer, level, settings, auto = false, onHud, onEnd, onDeath, pairHeart }) {
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
    if (level.tapMelody) this._attachMelody();
    /** 레벨업 챌린지(무제한 모드): 지금 단계 */
    this.round = 0;
    this.ptr = INSTRUMENTS.map(() => 0);
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.offsets = [];
    /** 프로그램이 만든 가짜 입력 수 (브라우저가 isTrusted=false 로 표시) — 핵 의심 확인용으로 점수와 같이 보냄 */
    this.fakeTaps = 0;
    /** 늦게 도착한 터치로 되살린 MISS 수 · 터치가 가장 늦게 도착한 시간(초) — 폰 버벅임 확인용으로 점수와 같이 보냄 */
    this.revived = 0;
    this.maxLag = 0;
    /** 진짜 실수(헛침·지나가지 않은 MISS) 수 — 되살릴 때 콤보를 이어 줄지 (_revive) */
    this._hardBreaks = 0;
    /** 줄마다 마지막으로 눌린 곡 시각 (TWIN_GAP) */
    this._touchAt = {};
    /**
     * 🖐 폰이 빠뜨린 터치 봐주기 (쌍·빠른 번갈아 → GOOD, _canPairSave). 모든 곡 + 무제한(2026-11-24 사용자 '무제한 모드도').
     *   멀티(main 이 false 로 줌)·영상용 레벨업 챌린지는 예전 그대로
     */
    this.pairHeart = pairHeart ?? (!level.challenge || !!level.endless);
    /** 쌍 봐주기로 GOOD 준 콩 수 · 엄지 쪽(left/right)마다 마지막으로 헛침·늦은 MISS 가 된 터치 시각 (_pairSave) */
    this.pairSaved = 0;
    this._wasteAt = {};
    /** 빠른 번갈아 콩도 봐줌 — 처음엔 위험 곡만이었다가 같은 날 '그 곡들만 있는 거 맞아?' → 모든 곡(같은 버그가 어느 곡에서나 남) */
    this.altSave = this.pairHeart;
    // 자동 연주(영상 찍기)나 죽었을 때 처리할 곳이 없으면 목숨 없음
    //   💀 실패 영상(level.failReel): 자동 연주라도 목숨이 있음 → failAt 부터 일부러 놓쳐서 하트가 다 떨어짐
    this.livesOn = (!auto || !!level.failReel) && !!this.onDeath;
    this.lives = MAX_LIVES;
    this.failAt = level.failReel && auto ? this.tempo.barStart(COUNT_IN_BARS) + (level.failAfter || 12) : Infinity;
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

  /**
   * 💀 실패 영상 자동 연주: 사람처럼 — 처음엔 거의 PERFECT(가끔 GREAT·GOOD),
   * failAt 부터 흔들림: MISS 하나 → GOOD·GREAT 섞어 버티다 → 또 MISS … 하트가 줄수록 MISS 간격이 짧아지고 GOOD 이 많아짐.
   * 반환: 판정 오차(초) 또는 null(놓침). 같은 시각 콩(동시치기)은 같은 운명.
   */
  _failDt(n) {
    const f = (this._fail ||= { fates: new Map(), nextMiss: this.failAt });
    let fate = f.fates.get(n.time);
    if (fate === undefined) {
      const R = Math.random;
      const sign = () => (R() < 0.5 ? -1 : 1);
      const great = () => sign() * (JUDGE.perfect + 0.005 + R() * (JUDGE.great - JUDGE.perfect - 0.01));
      const good = () => sign() * (JUDGE.great + 0.005 + R() * (JUDGE.good - JUDGE.great - 0.01));
      if (n.time < this.failAt) {
        // 잘 치는 구간: PERFECT 85% · GREAT 12% · GOOD 3%
        const x = R();
        fate = x < 0.85 ? sign() * R() * JUDGE.perfect * 0.8 : x < 0.97 ? great() : good();
      } else if (n.time >= f.nextMiss) {
        fate = null;
        // 다음 MISS 까지: 하트가 많으면 길게 버팀, 적으면 금방 (놓친 뒤라 지금 하트는 하나 적음)
        const left = Math.max(0, this.lives - 1);
        const gap = left >= 4 ? 1.6 + R() * 0.8 : left === 3 ? 1.2 + R() * 0.7 : left === 2 ? 0.8 + R() * 0.6 : 0.45 + R() * 0.45;
        f.nextMiss = n.time + gap;
      } else {
        // 버티는 구간: 하트가 줄수록 GOOD 이 많아짐. 황금 콩은 하트가 차지 않게 GOOD
        const pGood = n.gold ? 1 : 0.35 + (MAX_LIVES - this.lives) * 0.12;
        const x = R();
        fate = x < pGood ? good() : x < pGood + 0.3 ? great() : sign() * R() * JUDGE.perfect * 0.8;
      }
      f.fates.set(n.time, fate);
    }
    return fate;
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

  /** 🎭 tapMelody: 멜로디 줄(SNARE) 노트마다 그 자리의 멜로디 음(midi·길이·계이름)을 붙임 → 누르면 피아노로 그 음 */
  _attachMelody() {
    const SOL = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
    const at = new Map();
    for (const m of parseMelody(this.level.song.melody)) at.set((COUNT_IN_BARS + m.bar) * STEPS_PER_BAR + m.step, m);
    for (const n of this.lanes[SNARE]) {
      const m = at.get(n.step);
      if (!m) continue;
      n.midi = m.midi;
      n.dur = this.tempo.stepTime(n.step + m.len) - this.tempo.stepTime(n.step);
      n.sol = SOL[m.midi % 12];
      // 🎹 오른손 화음 (멜로디 아래 화음 음, 긴 음은 하나 더)
      n.harm = pianoHarmony(this.level.song, m.bar, m.step, m.midi, m.len >= 4);
    }
    // 🎹 오른쪽 줄 피아노 건반 범위: 멜로디 가장 낮은 음의 도부터 1~2옥타브
    const ms = [...at.values()].map((m) => m.midi);
    if (ms.length) {
      const base = Math.floor(Math.min(...ms) / 12) * 12;
      this.r.pianoRange = { base, oct: Math.max(...ms) - base >= 12 ? 2 : 1 };
    }
  }

  /** 🎹 멜로디 노트를 쳤을 때 오른쪽 피아노 건반이 눌림 */
  _pianoKeys(n, rt) {
    if (n && n.midi != null) this.r.onPiano([n.midi, ...(n.harm || [])], rt, Math.max(0.18, Math.min(0.6, (n.dur || 0.3) * 0.8)));
  }

  /** 🎭 멜로디 줄을 누름 → 칠 노트(없으면 바로 앞뒤로 가장 가까운 노트)의 음을 피아노로 */
  _playMelodyTap(t) {
    const list = this.lanes[SNARE];
    let best = null;
    for (let i = Math.max(0, this.ptr[SNARE] - 2); i < list.length; i++) {
      const n = list[i];
      if (n.time - t > JUDGE.early) break;
      if (!best || Math.abs(n.time - t) < Math.abs(best.time - t)) best = n;
    }
    if (!best || best.midi == null || Math.abs(best.time - t) > JUDGE.early) return;
    const a = this.audio;
    const t0 = a.ctx.currentTime;
    const d = Math.max(0.25, best.dur * 0.95);
    a.pianoOr('lead', t0, best.midi, d, a.sfxBus, 1.25);
    for (const h of best.harm || []) a.pianoOr('lead', t0, h, d, a.sfxBus, 0.6);
    this._pianoKeys(best, performance.now() / 1000);
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
    // 소리 시계가 멈춘 동안(_virt): 화면 시계로 곡 시각을 이어 감 → 게임이 '1' 에서 서 있지 않음 (소리만 잠깐 끊김)
    const v = this._virt;
    if (v) return v.at + ((perfMs ?? performance.now()) / 1000 - v.rt);
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  start() {
    const ctx = this.audio.ctx;
    this.audio.resetClock();
    this.r.reset();
    this.r.laneOrder = this.laneOrder;
    this.r.melodyMode = !!this.level.tapMelody;
    if (this.r.live) for (const n of ['live2_combo.mp3']) this.audio.loadTrack(`assets/sfx/${n}`);
    let at = ctx.currentTime + 0.35;
    // 🎵 내 노래: 노래를 처음부터 틀고, 채보(카운트인)는 leadIn 초 뒤에 시작
    if (this.level.leadIn > 0) at += this.level.leadIn;
    this.startTime = at;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.start();
    this.state = 'playing';
    this._clockWatch = null;
    this._virt = null;
    this._goodNow = undefined;
    this._tickAt = performance.now() / 1000;
    this._raf = requestAnimationFrame(this._loop);
  }

  /**
   * 소리 엔진을 새로 만든 뒤(audio.rebuild): 멈췄던 자리부터 새 시계로 곡을 이어서.
   *   아이폰에서 다른 앱이 소리를 가져가면 옛 엔진이 다시 안 켜지는 일이 있어 엔진째 바꿈 (main 의 터치 처리)
   *   일시정지·목숨 끝 상태면 다시 시작할 때(resume) 맞춤
   */
  reanchor() {
    if (this.state === 'paused' || this.state === 'dead') {
      this._needAnchor = true;
      return;
    }
    if (this.state !== 'playing') return;
    this._needAnchor = false;
    const at = this._goodNow ?? -0.35; // 마지막 곡 시각 (못 흘렀으면 처음부터)
    if (this.player) this.player.stop(0.01);
    // 새 소리 시계가 실제로 흐르는 게 보일 때까지 화면 시계로 이어 가다가 _loop 에서 맞춰 붙임 (_alignClock)
    this._virt = { at, rt: performance.now() / 1000 };
    this._clockWatch = null;
    this._stallSince = null;
  }

  /** 화면 시계로 가던 곡 시각에 소리 시계를 맞춰 붙이고, 그 자리부터 곡을 다시 틂 */
  _alignClock(rt) {
    const v = this._virt;
    const at = v.at + (rt - v.rt);
    this._virt = null;
    this.audio.resetClock();
    if (this.player) this.player.stop(0.01);
    this.startTime = this.audio.heardTime(rt * 1000) - this.offset - at;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.step = Math.max(0, Math.floor(this.tempo.barAt(Math.max(0, at)) * STEPS_PER_BAR) - 1);
    this.player.start();
  }

  pause() {
    if (this.state !== 'playing') return;
    this._heldAt = this.songTime();
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
  }

  async resume() {
    if (this.state !== 'paused') return;
    // 화면 시계로 가던 중이면 멈췄던 자리에서 다시 셈
    if (this._virt) this._virt = { at: this._heldAt, rt: performance.now() / 1000 };
    // 아이폰에서 소리가 막혀 있으면 resume() 이 끝나지 않을 수 있음 → 0.4초만 기다림 (안 켜지면 루프가 '멈춤'으로 보고 터치로 살림)
    await Promise.race([this.audio.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    this.audio.resetClock();
    this.state = 'playing';
    this._clockWatch = null;
    this._tickAt = performance.now() / 1000;
    // 멈춰 둔 동안 소리 시계가 흘러 버렸으면(광고·일시정지 화면 터치 등으로 소리가 다시 켜짐) 멈췄던 자리로 되돌림.
    //   안 그러면 그동안 지나간 노트가 한꺼번에 MISS → 이어하자마자 죽음
    const held = this._heldAt;
    if (held != null && Math.abs(this.songTime() - held) > 0.15) {
      this._goodNow = held;
      this._needAnchor = true;
    }
    if (this._needAnchor) this.reanchor();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.state = 'stopped';
    this.audio.frozen = false;
    cancelAnimationFrame(this._raf);
    if (this.player) this.player.stop();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
  }

  /**
   * 엄지 입력. lane = 악기 번호(charts.js KICK/SNARE/HAT/CRASH). perfMs = event.timeStamp
   * near = 바로 옆 줄들 [{ lane, d }] (d = 경계까지 거리, 줄 너비 기준). 터치일 때만 옴 (render.laneHit)
   * 반환: 이 터치의 결과 { lane, res } (res = perfect·great·good·miss·wrong·roll·none) — 터치 표시용 (main ?touch=show)
   */
  input(lane, perfMs, near) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return null;
    const playing = this.state === 'playing' && !this.auto;
    const t = playing ? this.songTime(perfMs) : 0;
    // 터치가 처리되기까지 걸린 시간 (폰 버벅임 확인용. 이상한 시각은 안 셈)
    const lag = perfMs != null ? rt - perfMs / 1000 : 0;
    if (playing && lag > this.maxLag && lag < 5) this.maxLag = lag;
    const side = playing && near ? near.filter((c) => c.d <= NEAR_HALF) : [];
    // 연타 구간: 그 줄(또는 그 줄 쪽 절반)은 칠 때마다 연타 +1, 다른 줄은 헛침 아님 (구간엔 노트가 없음)
    const roll = playing ? this._rollAt(t) : null;
    const touched = lane;
    let note = null;
    if (roll) {
      if (roll.lane !== lane && side.some((c) => c.lane === roll.lane)) lane = roll.lane;
    } else if (playing) {
      // 이 줄을 방금(TWIN_GAP 안) 다른 터치가 눌렀음 → 이 터치는 다른 엄지일 가능성이 큼 → 선 건너편 콩을 옆 줄 쪽 절반까지 봄
      //   (2026-11-24 DM 영상: 쿵 → 0.1초 뒤 짝에서 짝만 빠짐 = 두 엄지가 가운데에 붙어 짝 엄지가 쿵 줄 안쪽을 누름)
      const twin = t - (this._touchAt[lane] ?? -9) < TWIN_GAP;
      this._touchAt[lane] = t;
      note = this._pick(lane, t, side, twin ? NEAR_HALF : NEAR_LINE);
      // 이 콩은 방금 일찍 누른 터치(헛침)가 이미 쓴 것이고, 같은 줄 다음 콩도 판정 시간 안이면 → 이 터치는 다음 콩 것.
      //   일찍 누른 콩은 지금 MISS (그 헛침이 MISS 로 바뀜, 벌은 한 번만)
      if (note && note.early && !note.judged) {
        const next = this._take(note.lane, t, note);
        if (next) {
          this._miss(note, rt);
          note = next;
        }
      }
      if (note) lane = note.lane;
    }
    // 소리가 오류 나도 판정은 꼭 함 (예전에 소리 엔진을 새로 만든 뒤 쿵 소리만 오류 나서 쿵 판정이 통째로 빠졌음)
    try {
      if (this.level.tapMelody && lane === SNARE) {
        if (playing) this._playMelodyTap(t);
      } else if (!this.auto) this.audio.playLane(lane);
    } catch {}
    this.r.onTap(lane, rt);
    if (!playing) return null;
    if (roll) {
      if (roll.lane === lane) {
        this._rollHit(roll, rt);
        return { lane, res: 'roll' };
      }
      if (t >= roll.t0 && t <= roll.t1) return { lane, res: 'none' };
    }
    if (note) {
      // 이 터치가 '사실은' 다른 콩 것이었거나 남는 터치였을 수도 → 기억해 두고, 이 콩의 진짜 주인 터치가 헛침이 될 때 한 번 바꿔 줌 (_retake):
      //   - 선 바로 옆 터치: 선 건너편 줄에도 칠 콩이 있었음 (엄지가 선을 살짝 넘음) → 이 터치는 그 콩으로
      //   - 다음 콩을 일찍 친 터치: 이 줄에 조금 늦게 친 지나간 콩이 있었음 → 이 터치는 그 콩(어차피 MISS) 것
      //   - 그 밖(같은 엄지가 한 번 더 튕김 등): 이 터치가 헛침 (벌은 그대로, 진짜 터치가 아니라 남는 터치에)
      const dt = t - note.time;
      let alt = null;
      for (const l of [touched, ...side.map((c) => c.lane)]) {
        if (l === note.lane) continue;
        const k = this._take(l, t);
        if (k && (!alt || k.time < alt.time)) alt = k;
      }
      if (!alt && dt < 0) alt = this._late(note.lane, t);
      note.swap = { alt, t, from: touched };
      this._hit(note, dt, rt);
      return { lane, res: note.result };
    }
    // 이 줄 콩을 다른 터치가 먼저 쳐 갔고, 그 터치에 돌려줄 콩이 있음 → 서로 바꾸면 둘 다 맞음 (지나간 콩 MISS 보다 먼저)
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const n = this._retake(l, t, rt, false);
      if (n) return { lane: l, res: n.result };
    }
    // 지나간 콩을 GOOD 보다 조금 늦게 친 것: 그 콩을 지금 MISS 로 (어차피 MISS) — 헛침까지 더 받지 않게.
    //   이미 MISS 로 넘어간 콩이면(폰이 버벅여 터치가 늦게 도착) 벌은 받았으니 아무것도 안 함
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const late = this._late(l, t);
      if (!late) continue;
      this._waste(touched, t);
      if (!late.judged) this._miss(late, rt);
      return { lane: l, res: 'miss' };
    }
    // 위 경우: 이 줄 콩을 다른 터치가 먼저 쳐 갔고 이 터치는 칠 게 없음 → 이 터치가 그 콩을 치고, 먼저 친 터치는 원래 콩으로 (한 번만)
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const n = this._retake(l, t, rt, true);
      if (!n) continue;
      return { lane: l, res: n.result };
    }
    // 노트 없는 곳을 누름(일찍 누른 것 포함) → 헛침: 점수 없음 + 콤보 끊김 + 목숨 하나 (카운트인/끝난 뒤는 봐줌). 다가오는 콩은 그대로
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) {
      const hurt = this._wrong(lane, rt, t);
      // 일찍 누른 콩: 끝내 못 치고 지나가면 이 헛침이 그 콩 MISS 로 바뀜 (_sweep) — 한 번 실수에 벌 한 번
      const soon = this._early(lane, t);
      if (soon && !soon.early) soon.early = { hurt };
      return { lane, res: 'wrong' };
    }
    return { lane, res: 'none' };
  }

  /** 이 터치(시각 t, 누른 줄 lane, 선 근처 옆 줄 side)가 칠 콩 (맨 위 '터치 판정은 단순하게' 규칙, 없으면 null) */
  _pick(lane, t, side, zone = NEAR_LINE) {
    const own = this._take(lane, t);
    // 내 줄 콩이 왔음(PERFECT 안이거나 지났음) → 그 콩
    if (own && t - own.time >= -JUDGE.perfect) return own;
    // 내 줄 지나간 콩에 조금 늦은 터치 → 그 콩 것 (옆 줄·같은 엄지 줄 콩을 가져가지 않음. input 이 그 콩 MISS 하나로)
    if (!own && this._late(lane, t)) return null;
    let alt = null;
    for (const c of side) {
      if (own && c.d > zone) continue;
      const k = this._take(c.lane, t);
      if (k && (!alt || k.time < alt.time)) alt = k;
    }
    const hand = INSTRUMENTS[lane] && INSTRUMENTS[lane].hand;
    if (own) {
      // 같은 엄지가 맡는 줄(챙·쿵 / 짝·츠)은 동시에 나오지 않음 → 내 줄 콩은 아직 안 왔고 같은 엄지 줄 콩이 먼저 와 있으면 그 콩
      //   (2026-11-24: 두 엄지를 거의 같이 누르면 폰이 터치를 하나만 보낼 때가 있음 → 엄지를 벌려 바깥 줄(챙·츠)만 눌러도 쿵·짝이 다 쳐지게)
      for (const l of this.laneOrder) {
        if (l === lane || !INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
        const k = this._take(l, t);
        if (k && (!alt || k.time < alt.time)) alt = k;
      }
      return alt && alt.time < own.time ? alt : own;
    }
    if (alt) return alt;
    // 동시에 치는 콩: 이 줄 콩을 다른 엄지가 방금 (선을 넘어) 쳤으면 → 같은 시각의 남은 콩
    const done = this._doneNear(lane, t);
    if (done) {
      for (const l of this.laneOrder) {
        if (l === lane) continue;
        const k = this._take(l, t);
        if (k && k.time === done.time) return k;
      }
    }
    // 같은 엄지가 맡는 줄(챙·쿵·탐 / 짝·츠)은 동시에 나오지 않음 → 내 줄에 노트가 없으면 같은 엄지 줄의 노트로.
    //   4줄일 때 맨 왼쪽 챙 줄이 넓어서 왼쪽 엄지가 쿵 대신 챙을 눌러 쿵이 '안 쳐지던' 것 (유저 맵 신고)
    for (const l of this.laneOrder) {
      if (l === lane || !INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
      const k = this._take(l, t);
      if (k && (!alt || k.time < alt.time)) alt = k;
    }
    return alt;
  }

  /** 이 줄에서 t 에 칠 수 있는 콩: 판정 시간(GOOD) 안의 안 쳐진 콩 중 가장 먼저 온 것 (after 를 주면 그 콩 뒤에서, 없으면 null) */
  _take(lane, t, after = null) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length; i++) {
      const n = list[i];
      const dt = t - n.time;
      if (dt < -JUDGE.good) return null;
      if (after && n.time <= after.time) continue;
      if (dt <= JUDGE.good && this._open(n, t)) return n;
    }
    return null;
  }

  /**
   * 이 줄에서 다른 터치가 '어쩌면 남의 콩을' 쳐 간 콩(swap)을 이 터치(t)가 되찾음: 판정은 이 터치 시간으로 다시 매기고,
   *   먼저 친 터치는 그때 칠 수 있던 원래 콩(swap.alt)으로 — 그 콩이 그 터치 시각에 판정 시간 안일 때만.
   *   돌려줄 콩이 없으면(남는 터치) 먼저 친 터치가 헛침, 지나간 콩이었으면 그 콩이 MISS (벌은 늘 한 번).
   *   바꾸기는 한 번만, 줄줄이 이어지지 않음. 이 터치가 어차피 헛침이 될 때만 부름. stray=false 면 둘 다 맞는 바꾸기만
   */
  _retake(lane, t, rt, stray) {
    const list = this.lanes[lane];
    for (let i = Math.max(0, this.ptr[lane] - 4); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      const s = n.swap;
      if (!s || !n.judged || n.result === 'miss' || Math.abs(t - n.time) > JUDGE.good) continue;
      const a = s.alt;
      const adt = a ? s.t - a.time : 0;
      const altOk = a && Math.abs(adt) <= JUDGE.good && this._open(a, s.t);
      if (!altOk && !stray) continue;
      // 먼저 친 터치에 돌려줄 콩이 없으면 이 터치가 시간이 더 잘 맞을 때만 (정확히 친 콩을 뒤 터치가 뺏으면 안 됨).
      //   남는 터치는 가끔 하나 → 0.5초 안에 헛침이 있었으면(마구 두드림) 안 바꿈 (여러 번 두드려 시간 맞는 걸 골라 갖지 못하게)
      if (!altOk && Math.abs(t - n.time) >= Math.abs(s.t - n.time)) continue;
      if (!a && t - (this._wrongT ?? -9) < 0.5) continue;
      n.swap = null;
      const dt = t - n.time;
      const ad = Math.abs(dt);
      const res = ad <= JUDGE.perfect ? 'perfect' : ad <= JUDGE.great ? 'great' : 'good';
      if (n.offAt != null) this.offsets[n.offAt] = dt;
      if (res !== n.result) {
        this.counts[n.result]--;
        this.counts[res]++;
        this.score += Math.round((pointsFor(res, n.comboAt) - pointsFor(n.result, n.comboAt)) * (n.mult || 1));
        n.result = res;
      }
      this.r.onJudge(n.lane, res, rt, dt < 0);
      if (altOk) this._hit(a, adt, rt);
      else if (!a) this._wrong(s.from, rt, s.t); // 남는 터치였음 → 그 터치가 헛침
      return n;
    }
    return null;
  }

  /** 이 줄에서 너무 일찍(GOOD 밖 EARLY 안) 누른, 아직 안 쳐진 다음 콩 (없으면 null) */
  _early(lane, t) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length; i++) {
      const n = list[i];
      const dt = t - n.time;
      if (dt < -JUDGE.early) return null;
      if (!n.judged && dt < -JUDGE.good) return n;
    }
    return null;
  }

  /** 이 줄에서 t 의 판정 시간(GOOD) 안에 이미 쳐진 콩 (MISS 말고, 없으면 null) */
  _doneNear(lane, t) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      if (n.judged && n.result !== 'miss' && Math.abs(t - n.time) <= JUDGE.good) return n;
    }
    return null;
  }

  /** 이 줄에서 GOOD 보다 조금(MISS_SLACK 안) 늦게 친 콩: 아직 안 쳐졌거나, 지나가서 MISS 로 넘긴 것 (없으면 null) */
  _late(lane, t) {
    const list = this.lanes[lane];
    let best = null;
    for (let i = this._from(lane, t); i < list.length && list[i].time < t; i++) {
      const n = list[i];
      const dt = t - n.time;
      // 일찍 누른 헛침이 이미 쓴 콩은 빼고 (지나가면 그 헛침이 MISS 로 바뀜)
      if (dt > JUDGE.good && dt <= JUDGE.good + MISS_SLACK && (!n.judged || n.swept) && !n.early) best = n;
    }
    return best;
  }

  /**
   * 터치(누른 시각 t) 기준으로 아직 칠 수 있는 콩: 안 쳐진 콩, 또는 지나가서 MISS 로 넘겼지만 t 때는 아직 넘기기 전이었던 콩.
   *   폰이 버벅여 터치가 늦게 도착하면 그사이 화면 갱신이 콩을 MISS 로 넘겨 버림 → 그 터치는 '누른 그 순간' 상황 그대로 판정:
   *   GOOD 안이면 되살림(_revive). (2026-11-23 '빽빽한 곳이나 그 부분을 지나고 나면 터치가 잘 안 돼요')
   *   제때 도착한 터치는 MISS 처리(콩 시각 + GOOD + MISS_SLACK) 전에 판정되므로 늘 '안 쳐진 콩'만 봄
   */
  _open(n, t) {
    return !n.judged || (n.swept && t - n.time <= JUDGE.good + MISS_SLACK);
  }

  /** 이 줄에서 t 기준으로 볼 첫 콩 자리: 판정 자리(ptr)에서 MISS 로 넘긴 콩까지 조금 거슬러 올라감 (_open) */
  _from(lane, t) {
    const list = this.lanes[lane];
    const p = Math.min(this.ptr[lane], list.length);
    let i = p;
    while (i > 0 && p - i < 24 && list[i - 1].time > t - 1) i--;
    return i;
  }

  /** 콩을 침 (MISS 로 넘겼던 콩이면 되살림) */
  _hit(n, dt, rt) {
    if (n.swept) this._revive(n, dt, rt);
    else this._judge(n, dt, rt);
  }

  /**
   * 늦게 도착한 터치로 MISS 를 되살림: MISS 로 받은 벌(판정 수·목숨)을 돌려주고 그 터치 시각으로 판정.
   *   콤보는 그 MISS 뒤에 다른 실수(헛침·진짜 MISS)가 없었을 때만 이어 줌
   */
  _revive(n, dt, rt) {
    if (n.saved) {
      // 쌍 봐주기로 GOOD 준 콩에 늦게 도착한 진짜 터치(폰 버벅임) → 봐준 GOOD 을 되돌리고 그 터치 시각으로 판정
      n.saved = false;
      n.swept = false;
      this.pairSaved--;
      this.counts.good--;
      this.score -= n.savedPts || 0;
      if (n.saveHard === this._hardBreaks) this.combo = Math.max(0, this.combo - 1);
      this._judge(n, dt, rt);
      return;
    }
    n.swept = false;
    n.revived = true;
    this.revived++;
    this.counts.miss--;
    // 일찍 누른 헛침을 이 MISS 로 바꿨었음 → 콩을 쳤으니 그건 도로 헛침
    if (n.wasWrong) {
      n.wasWrong = false;
      this.counts.wrong++;
    }
    // 이 MISS 로 깎인 하트를 돌려줌. 같은 쌍의 다른 콩이 MISS 로 깎은 하트도 — 이제 이 콩을 쳤으니
    //   쌍 규칙(하나만 쳐도 하트 그대로, _loseLife·pairHeart)으로 그 MISS 는 하트를 안 깎음
    let refund = !!n.hurt;
    n.hurt = false;
    for (const l of this.laneOrder) {
      if (l === n.lane) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time); i < list.length && list[i].time <= n.time; i++) {
        const m = list[i];
        if (m.time !== n.time) continue;
        if (this.pairHeart) {
          if (m.hurt) {
            m.hurt = false;
            refund = true;
          }
        } else if (refund && m.swept) {
          // 쌍 규칙을 안 쓰는 곳: 같이 놓친 동시치기 콩이 아직 MISS → 목숨 하나는 그 콩 몫 (둘 다 놓쳐도 하나만 깎는 규칙)
          m.hurt = true;
          refund = false;
        }
      }
    }
    if (refund && this.livesOn && this.state === 'playing') {
      this.lives = Math.min(MAX_LIVES, this.lives + 1);
      if (this._lostAt === n.time) this._lostAt = null;
    }
    const u = n.undo;
    n.undo = null;
    if (u && u.hard === this._hardBreaks) this.combo = Math.max(this.combo, u.combo);
    this._judge(n, dt, rt);
  }

  /** 노트 없는 곳을 누름(헛침): 콤보 끊김 + 목숨 하나. 두 엄지가 동시에 미끄러져도(0.12초 안) 하나만 */
  _wrong(lane, rt, t) {
    this.counts.wrong++;
    if (t !== undefined) this._waste(lane, t);
    if (t !== undefined) this._wrongT = Math.max(this._wrongT ?? -9, t);
    this.combo = 0;
    this._hardBreaks++;
    this.r.onJudge(lane, 'wrong', rt);
    if (t === undefined || t - (this._wrongLostAt ?? -9) < WRONG_GAP) return false;
    if (t < this.graceUntil || !this.livesOn || this.state !== 'playing') return false;
    this._wrongLostAt = t;
    this._hurt(rt);
    return true;
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
    n.comboAt = this.combo; // 되찾기 때 판정을 다시 매길 때 씀 (_retake)
    n.offAt = this.offsets.length;
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
    // 🔔 25콤보마다 '반짝' (치는 소리에 안 묻히게 작게)
    if (this.combo > 0 && this.combo % 25 === 0) {
      try {
        this.audio.sfxFile(this.audio.uiSet === 'live' ? 'live2_combo' : 'combo', 0.35);
      } catch {}
    }
    if (this.livesOn && !(this.auto && this.level.failReel) && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.combo % 25 === 0) {
      // 소리 오류가 여기서 터지면 같은 터치 이벤트에 같이 온 다른 엄지 터치가 빠짐 → 막아 둠
      try {
        this.audio.crash(undefined, this.audio.sfxBus, 0.5);
      } catch {}
      this.milestoneAt = this.songTime();
    }
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(res === 'perfect' ? 12 : 8);
      } catch {}
    }
  }

  /** MISS. swept = 지나가서 MISS 로 넘김 (늦게 도착한 터치가 되살릴 수 있게 그 전 콤보를 기억, _revive) */
  _miss(n, rt, swept = false) {
    n.judged = true;
    n.result = 'miss';
    if (swept) {
      n.swept = true;
      n.undo = { combo: this.combo, hard: this._hardBreaks };
    } else this._hardBreaks++;
    this.counts.miss++;
    this.combo = 0;
    this.r.onJudge(n.lane, 'miss', rt);
    // 일찍 누른 헛침이 이 콩 것이었음 → 헛침을 이 MISS 로 바꿈 (목숨은 그 헛침 때 이미 깎였으면 또 안 깎음)
    const e = n.early;
    if (e) {
      n.early = null;
      n.wasWrong = true;
      this.counts.wrong = Math.max(0, this.counts.wrong - 1);
      if (e.hurt) return;
    }
    this._loseLife(n, rt);
  }

  /**
   * 지나간 노트 → MISS. 기준은 '바로 전 화면' 때 곡 시각 (한 프레임 늦게):
   *   폰이 버벅인 뒤 화면 갱신이 밀려 있던 터치보다 먼저 돌아도, 버벅이는 동안 누른 터치가 먼저 판정됨 (그 뒤에 온 건 _revive)
   */
  _sweep(now, rt) {
    const h = Math.min(now, this._sweepPrev ?? now);
    this._sweepPrev = now;
    for (const lane of this.laneOrder) {
      const list = this.lanes[lane];
      while (this.ptr[lane] < list.length) {
        const n = list[this.ptr[lane]];
        if (n.judged) {
          this.ptr[lane]++;
          continue;
        }
        if (h - n.time > JUDGE.good + MISS_SLACK) {
          if (this._canPairSave(n)) this._pairSave(n, rt);
          else this._miss(n, rt, true);
          this.ptr[lane]++;
          continue;
        }
        break;
      }
    }
  }

  /**
   * MISS → 목숨 하나. 동시치기(두 레인 같은 시각)를 둘 다 놓쳐도 하나만 깎음.
   *   🖐 쌍(점선으로 이어진 동시치기 = 같은 시각 콩)에서 다른 콩은 쳤으면 하트는 안 깎음 — 점수·콤보·정확도는 MISS 그대로 (2026-11-24):
   *   폰이 동시에 닿은 두 엄지 중 하나의 터치를 아예 안 보낼 때가 있음(DM 영상: 쌍 5번 중 3번, 「창·캔·포」가 1만 오름).
   *   안 누른 건지 폰이 안 보낸 건지 게임은 모름 → 맞음으로 쳐 주진 않고(랭킹 점수 그대로), 폰 탓일 수 있는 하트만 지킴
   */
  _loseLife(n, rt) {
    if (!this.livesOn || this.state !== 'playing') return;
    if (n.time < this.graceUntil) return;
    if (this._lostAt === n.time) return;
    if (this.pairHeart && this._mateHit(n)) return;
    this._lostAt = n.time;
    n.hurt = true; // 되살리면 돌려줌 (_revive)
    this._hurt(rt);
  }

  /** 이 터치가 헛침·늦은 MISS 였음 → 그 엄지 쪽 기록 (쌍 봐주기는 그쪽을 누르다 틀린 콩엔 안 줌) */
  _waste(lane, t) {
    const hand = INSTRUMENTS[lane] && INSTRUMENTS[lane].hand;
    if (hand) this._wasteAt[hand] = Math.max(this._wasteAt[hand] ?? -9, t);
  }

  /**
   * 🖐 쌍 봐주기 (2026-11-24, 사용자 결정 'MISS 뜨고 하트 안 깎이는 것보다 GOOD'):
   *   쌍(같은 시각 콩)에서 다른 콩은 쳤는데 이 콩은 터치 없이 지나감 → MISS 대신 GOOD (하트·콤보 그대로, 점수는 GOOD 만큼).
   *   아이폰은 한 엄지가 떨어지는 순간 다른 엄지가 닿으면 그 터치를 아예 안 보낼 때가 있음(CLAUDE.md 🍎).
   *   그 엄지 쪽에서 헛침·늦은 터치·일찍 누름이 있었으면(누르다 틀림) 그대로 MISS. 무제한·챌린지·멀티(pairHeart false)는 안 함
   */
  _canPairSave(n) {
    if (!this.pairHeart || n.early) return false;
    // 쌍의 다른 콩을 쳤음 / (위험 곡) 바로 앞(0.04~0.16초)의 다른 엄지 콩을 쳤음 — 그 엄지가 떨어질 때 이 터치가 빠졌을 수 있음
    if (!this._mateHit(n) && !(this.altSave && this._prevOtherHit(n))) return false;
    // 이 엄지가 바로 앞 자기 콩은 진짜로 쳤어야 함 — 폰이 빠뜨리는 건 가끔이라, 한 엄지만 일부러 안 치면(무제한에서 반만 치기) 안 봐줌
    if (!this._handPrevReal(n)) return false;
    const hand = INSTRUMENTS[n.lane] && INSTRUMENTS[n.lane].hand;
    return (this._wasteAt[hand] ?? -9) < n.time - JUDGE.good;
  }

  _pairSave(n, rt) {
    n.judged = true;
    n.swept = true; // 늦게 도착한 진짜 터치가 오면 되돌리고 다시 판정 (_revive)
    n.saved = true;
    n.result = 'good';
    n.saveHard = this._hardBreaks;
    this.pairSaved++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts.good++;
    n.savedPts = Math.round(pointsFor('good', this.combo) * (n.mult || 1));
    this.score += n.savedPts;
    n.comboAt = this.combo;
    this.r.onJudge(n.lane, 'good', rt);
    this.r.onCombo(this.combo, rt);
    if (this.livesOn && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
  }

  /** 같은 엄지의 바로 앞 콩(가장 최근 것)을 진짜로 쳤나. 앞 콩이 없으면(곡 처음) 그렇다고 봄 */
  _handPrevReal(n) {
    const hand = INSTRUMENTS[n.lane] && INSTRUMENTS[n.lane].hand;
    let last = null;
    for (const l of this.laneOrder) {
      if (!INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time - 1); i < list.length && list[i].time < n.time; i++) {
        const m = list[i];
        if (m !== n && m.time < n.time && (!last || m.time > last.time)) last = m;
      }
    }
    return !last || (last.judged && last.result !== 'miss' && !last.saved);
  }

  /** 바로 앞(ALT_GAP)의 다른 엄지 콩을 진짜로 쳤나 (봐준 GOOD 은 안 침 — 줄줄이 봐주지 않게) */
  _prevOtherHit(n) {
    const hand = INSTRUMENTS[n.lane] && INSTRUMENTS[n.lane].hand;
    for (const l of this.laneOrder) {
      if (!INSTRUMENTS[l] || INSTRUMENTS[l].hand === hand) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time - 1); i < list.length && list[i].time < n.time; i++) {
        const m = list[i];
        const d = n.time - m.time;
        if (d > ALT_GAP[0] && d < ALT_GAP[1] && m.judged && m.result !== 'miss' && !m.saved) return true;
      }
    }
    return false;
  }

  /** 같은 시각 다른 줄 콩(쌍) 중 맞힌 게 있나 (MISS 말고) */
  _mateHit(n) {
    for (const l of this.laneOrder) {
      if (l === n.lane) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time); i < list.length && list[i].time <= n.time; i++) {
        const m = list[i];
        if (m.time === n.time && m.judged && m.result !== 'miss') return true;
      }
    }
    return false;
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
    this._heldAt = this.diedAt;
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

  /** ⚔️ 멀티: 상대가 먼저 목숨을 다 씀(또는 나감) → 내 판도 지금 끝 (살아남아서 이김) */
  endNow() {
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'dead') return false;
    const wasDead = this.state === 'dead';
    const at = wasDead ? this.diedAt : this.songTime();
    this.state = 'finished';
    cancelAnimationFrame(this._raf);
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
    this.player.stop(0.6);
    if (this.level.challenge) this._finishChallenge(wasDead, at);
    else this._finish(wasDead, true);
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
    // 'running' 이라면서 시계가 안 가는 경우도 멈춤으로 봄 (아이폰: 다른 앱 소리를 틀고 돌아왔을 때)
    let frozen = !actx || actx.state !== 'running';
    let flowing = false;
    if (!frozen) {
      const w = this._clockWatch;
      if (!w || w.ct !== actx.currentTime) {
        if (w) {
          this._tickAt = rt; // 시계가 실제로 흐름 (터치로 엔진을 새로 만들어도 안 흐르면 그대로 → 얼마나 오래 멈췄나)
          flowing = true;
        }
        this._clockWatch = { ct: actx.currentTime, rt };
      }
      else if (rt - w.rt > 0.3) frozen = true;
    }
    this.audio.frozen = frozen;
    if (frozen) {
      if (rt - (this._resumeTry || 0) > 0.7) {
        this._resumeTry = rt;
        actx.resume().catch(() => {});
        this.audio.resetClock();
        if (this.onStall && rt - (this._stallSince ?? rt) > 1.2) this.onStall(rt - (this._tickAt ?? rt));
      }
      this._stallSince ??= rt;
      // 소리 시계가 멈춤 → 화면 시계로 곡을 이어 감 (마지막으로 시계가 흐르던 순간부터)
      if (!this._virt) this._virt = { at: this._goodNow ?? this.songTime(), rt: this._clockWatch?.rt ?? rt };
    } else {
      this._stallSince = null;
      // 소리 시계가 다시 흐름 → 그 시계를 지금 곡 시각에 맞춰 붙임
      if (this._virt && flowing) this._alignClock(rt);
    }
    const now = this.songTime();
    this._goodNow = now;
    this._extend(now);
    this._checkRound(now, rt);

    if (this.auto) {
      for (const lane of this.laneOrder) {
        const list = this.lanes[lane];
        while (this.ptr[lane] < list.length && list[this.ptr[lane]].time <= now) {
          const n = list[this.ptr[lane]];
          // 💀 실패 영상: 놓치기로 한 콩은 안 침 (지나가면 아래에서 MISS)
          const dt = this.level.failReel ? this._failDt(n) : 0;
          if (dt == null) break;
          this.r.onTap(lane, rt);
          if (lane === SNARE && this.level.tapMelody) this._pianoKeys(n, rt);
          this._judge(n, dt, rt);
          this.ptr[lane]++;
        }
      }
      // 자동 연주: 연타 구간은 16분음표마다 두드림
      for (const roll of this.rolls) {
        if (now < roll.t0 || now > roll.t1 || now >= this.failAt) continue;
        const want = Math.floor((now - roll.t0) / (this.tempo.stepTime(1) - this.tempo.stepTime(0))) + 1;
        while (roll.hits < want) {
          this.audio.playLane(roll.lane);
          this.r.onTap(roll.lane, rt);
          this._rollHit(roll, rt);
        }
      }
    }

    // 지나간 노트 → MISS
    this._sweep(now, rt);
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
    const r = this.level.introBars
      ? this.level.roundOfBar(mb + 0.25)
      : Math.min(this.level.maxRounds, Math.max(1, Math.floor((mb + 0.25) / ROUND_BARS) + 1));
    if (r !== this.round) {
      this.round = r;
      this.roundInfo = this._roundInfo(r);
      if (this.r.onRound) this.r.onRound(this.roundInfo, rt);
    }
  }

  /** 지금까지 깬 단계 수 */
  _roundsCleared(now) {
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    if (this.level.introBars) return Math.max(0, this.level.roundOfBar(mb) - 1);
    return Math.max(0, Math.min(this.level.maxRounds, Math.floor(mb / ROUND_BARS)));
  }

  _hud(now) {
    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    let progress;
    if (this.level.roundProgress) progress = Math.max(0, this.level.roundProgress(barPos));
    else if (this.level.endless) progress = Math.max(0, (barPos % ROUND_BARS) / ROUND_BARS);
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
    if (now < ciEnd && (now > -0.5 || !this.level.leadIn)) {
      const b = Math.max(0, Math.floor(now / this.beat));
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: now < 0 ? 0 : (now / this.beat) % 1, fade: 1 };
    } else if (now < ciEnd + this.beat * 2) {
      countIn = { label: '', phase: 1, fade: 1 - (now - ciEnd) / (this.beat * 2) };
    }
    // 박자 맞추기 자동 연주 영상: 3·2·1 숫자·말풍선 없이 (영상이 노래 구간 시작부터 찍힘)
    if (this.level.hideCountIn) countIn = null;

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
        progress: Math.max(0, Math.min(1, now / this.endTime)),
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

  /** stopped: 멀티에서 상대가 먼저 쓰러져 곡 중간에 끝남 (기록엔 안 남김) */
  _finish(failed = false, stopped = false) {
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
      stopped,
      continued: this.continues,
      progress: failed || stopped ? Math.max(0, Math.min(1, (failed ? this.diedAt ?? 0 : this.songTime()) / this.endTime)) : 1,
      avgOffsetMs,
      check: this._check(),
      auto: this.auto,
      practice: this.level.practice || 0,
      timeline: this.timeline.slice(),
      rollHits: this.rollHits,
      goldHits: this.goldHits,
      goldTotal: this.goldTotal,
    });
  }

  /**
   * 핵 의심 확인용: 박자 오차 퍼짐(표준편차)·평균(ms), 친 수, 가짜 입력 수. 사람은 손가락이라 오차가 들쭉날쭉, 자동 입력은 너무 일정
   *   + 폰 버벅임: 늦게 도착한 터치로 되살린 MISS 수(rv)·터치가 가장 늦게 처리된 시간(lag, ms)
   */
  _check() {
    const o = this.offsets;
    const n = o.length;
    const mean = n ? o.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(o.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : 0;
    return { sd: Math.round(sd * 1000), mean: Math.round(mean * 1000), n, fake: this.fakeTaps, rv: this.revived, lag: Math.round(this.maxLag * 1000), ps: this.pairSaved };
  }

  /** 무제한 모드 / 레벨업 챌린지 결과: 몇 단계까지 깼나 + 다이아몬드 */
  _finishChallenge(died, atOverride) {
    const lv = this.level;
    const stopped = atOverride !== undefined; // 멀티: 상대가 먼저 져서 중간에 끝남
    const at = stopped ? atOverride : died ? this.diedAt ?? this.songTime() : this.endTime;
    const cleared = died || stopped ? this._roundsCleared(at) : lv.maxRounds;
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
      bpmReached: this._roundInfo(Math.max(1, Math.min(lv.maxRounds, cleared + (died || stopped ? 1 : 0)))).bpm,
      // 멀티 승부용: 얼마나 오래 버텼나 (곡 시작부터 초)
      survived: Math.max(0, Number.isFinite(at) ? at : 0),
      diamonds: diamondsFor(cleared),
      stars: 0,
      fullCombo: false,
      failed: false,
      died,
      continued: this.continues,
      progress: 1,
      avgOffsetMs,
      auto: this.auto,
      practice: this.level.practice || 0,
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
// 5분마다 (Cloudflare 무료 하루 10만 건 아끼기). 곡 시작·끝은 모아 두었다가 판 시작(/api/runs)·점수 올리기
//   요청에 얹어 보냄(takeTrack) → 따로 요청 안 함. 화면을 떠날 때는 바로 (단, 1분 안에 보냈으면 판 기록이 있을 때만)
const FLUSH_MS = 300 * 1000;
const HIDE_GAP_MS = 60 * 1000;

let on = false;
let sess = null; // { sid, ref, st(세션 시작 시각) }
let activeMs = 0;
let lastInput = Date.now();
let lastSent = -1;
let lastSentAt = 0;
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

function payloadNow() {
  const payload = { sid: sess.sid, st: sess.st, active: Math.round(activeMs / 1000), ref: sess.ref, device: deviceKind(), plays: queue.splice(0, 10) };
  lastSent = payload.active;
  lastSentAt = Date.now();
  writeStore();
  return payload;
}

/** 다른 API 요청에 얹어 보낼 통계 (없으면 null). 서버가 /api/runs·/api/scores 에서 같이 저장 */
function takeTrack() {
  if (!on || !sess) return null;
  return payloadNow();
}

// 서버가 '지금은 표본 밖'(rest)이라 하면 그동안 통계만 따로 보내는 요청은 안 함 (판 요청에 얹는 건 그대로)
let restUntil = 0;
function send() {
  if (!on || !sess) return;
  if (Date.now() < restUntil) {
    queue.length = 0;
    return;
  }
  const payload = payloadNow();
  try {
    fetch('/api/track', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Number.isFinite(d.rest) && d.rest > 0) restUntil = Date.now() + Math.min(d.rest, 6 * 3600 * 1000);
      })
      .catch(() => {});
  } catch {}
}

/** 서버가 있을 때 한 번 부름 */
function initTracker({ enabled }) {
  if (!enabled || on) return;
  on = true;
  const prev = readStore();
  if (prev && prev.sid && Date.now() - prev.at < SESSION_GAP_MS) {
    sess = { sid: prev.sid, ref: prev.ref || '', st: prev.st || Date.now() };
    activeMs = (prev.active || 0) * 1000;
  } else {
    // st: 세션 시작 시각 → 서버가 통계를 시간 순 표에 넣어 관리자 통계가 그 기간만 읽게 (2026-11-22, D1 읽기 아끼기)
    sess = { sid: rid() + rid(), ref: referrer(), st: Date.now() };
    activeMs = 0;
  }
  const touch = () => (lastInput = Date.now());
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, touch, { capture: true, passive: true });
  setInterval(() => {
    if (!document.hidden && Date.now() - lastInput < IDLE_MS) activeMs += TICK_MS;
  }, TICK_MS);
  setInterval(() => {
    // 판 시작·점수 요청에 얹어서 방금(5분 안) 보냈으면 건너뜀 → 계속 치는 사람은 따로 안 보냄
    if (Date.now() - lastSentAt < FLUSH_MS - TICK_MS) return;
    if (!document.hidden && (queue.length || Math.round(activeMs / 1000) !== lastSent)) send();
  }, FLUSH_MS);
  const leave = () => {
    if (queue.length || (Date.now() - lastSentAt > HIDE_GAP_MS && Math.round(activeMs / 1000) !== lastSent)) send();
  };
  document.addEventListener('visibilitychange', () => document.hidden && leave());
  window.addEventListener('pagehide', leave);
  // 들어오자마자 보내지 않음: 첫 판 시작 요청에 얹히거나, 5분 뒤·화면을 떠날 때 보냄
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
  // 바로 안 보냄: 다음 판 시작·점수 올리기 요청에 얹히거나, 5분마다·화면을 떠날 때 같이 감
}

const hasOpenPlay = () => !!play;

return { takeTrack, initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay };
})();

// ---- api.js ----
const __m_api = (() => {
// 서버 통신. 서버가 없으면(정적 호스팅/로컬 파일) 브라우저 안 가짜 API로 동작합니다.
//
// 랭킹: guest(닉네임) → startRun() 으로 판 토큰 → submitScore() (끝까지 친 판은 알아서 올림)

const { load, save } = __m_storage;
const { gradeFor } = __m_charts;
const { takeTrack } = __m_track;
const { takeCoins, coinsResult } = __m_coins;
const { takeOffline, offlineResult, takeLost, lostResult } = __m_offrec;
const { seasonAt } = __m_season;

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
    // 🧯 서버 DB 가 막힘(하루 한도 등) → main.js 가 서버 없는 모드로 바꿈
    if (res.status === 503 && data && data.error === 'db_down') {
      noteServerDown(data);
      try {
        window.dispatchEvent(new CustomEvent('okaystra:db-down'));
      } catch {}
    }
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// 📴 서버 없을 때 친 최고 기록(offrec.js)도 같이 얹음
function withCoins(send) {
  const coins = takeCoins();
  const offline = takeOffline();
  const lost = takeLost();
  return send(coins, offline, lost).then(
    (r) => {
      if (coins) coinsResult(r);
      if (offline) offlineResult(r);
      if (lost) lostResult(r);
      return r;
    },
    (e) => {
      if (coins) coinsResult(e && e.data);
      if (offline) offlineResult(e && e.data);
      if (lost) lostResult(e && e.data);
      throw e;
    }
  );
}

const LB_CACHE_MS = 60 * 1000;
const NEXT_TOKEN_MS = 10 * 60 * 1000;
let nextTok = {}; // 단계 → { tok, at }
const usedPre = []; // 미리 받은 토큰으로 시작한 단계 (서버 판 수 세기용, 다음 요청에 얹음)
const lbCache = new Map();

function serverApi(boot = null) {
  // 첫 접속 때 /api/health?boot=1 로 받은 설정·내 정보는 한 번만 그대로 씀 (요청 아끼기)
  let bootConfig = boot && boot.config;
  let bootMe = boot && boot.me;
  return {
    mode: 'server',
    /** 🛒 상점에서 사기: 모아 둔 코인을 지금 다 얹어 보냄(서버가 먼저 더하고 차감) */
    async buy(item) {
      const coins = takeCoins({ force: true });
      try {
        const r = await http('POST', '/api/shop/buy', { item, coins });
        coinsResult(r);
        return r;
      } catch (e) {
        if (coins) coinsResult(e && e.data);
        throw e;
      }
    },
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
    // 이용 통계는 따로 안 보내고 이 요청들에 얹어 보냄 (요청 수 아끼기)
    // 🪙 코인도 얹어 보냄 (coins.js). 응답에 잔액이 오면 받은 것, 아니면 다음에 다시
    // 🎟 점수를 올리면 서버가 '같은 단계·다음 단계' 판 토큰을 미리 줌 → 깬 뒤 바로 다시·다음 판은 /api/runs 요청 없이 (Worker 요청 아끼기)
    startRun: (level) => {
      const k = String(level);
      const pre = nextTok[k];
      nextTok = {}; // 하나 쓰면 나머지는 버림 (코인은 판 순서대로만 받음)
      if (pre && Date.now() - pre.at < NEXT_TOKEN_MS) {
        usedPre.push(k);
        return Promise.resolve({ runToken: pre.tok });
      }
      return withCoins((coins, offline, lost) => http('POST', '/api/runs', { level, track: takeTrack(), coins, offline, lost, pre: usedPre.splice(0) }));
    },
    submitScore: (payload) => {
      lbCache.clear();
      nextTok = {};
      return withCoins((coins, offline, lost) => http('POST', '/api/scores', { ...payload, track: takeTrack(), coins, offline, lost, pre: usedPre.splice(0) })).then((r) => {
        if (r && r.next && typeof r.next === 'object') for (const [k, tok] of Object.entries(r.next)) if (typeof tok === 'string') nextTok[k] = { tok, at: Date.now() };
        return r;
      });
    },
    // 랭킹은 1분 동안 같은 걸 다시 씀 (탭을 왔다 갔다 해도 요청 안 함). 점수 올리면 비움
    leaderboard: (level) => {
      const hit = lbCache.get(String(level));
      if (hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/leaderboard?level=${level}`);
      lbCache.set(String(level), { at: Date.now(), p });
      p.catch(() => lbCache.delete(String(level)));
      return p;
    },
    // 🏛 명예의 전당: 랭킹처럼 1분 동안 같은 걸 다시 씀
    hall: (board) => {
      const key = 'hall:' + board;
      const hit = lbCache.get(key);
      if (hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/hall?board=${board === 'endless' ? 'endless' : 'stage'}`);
      lbCache.set(key, { at: Date.now(), p });
      p.catch(() => lbCache.delete(key));
      return p;
    },
    hallPhoto: (body) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/hall/photo', body);
    },
    // 💬 명예의 전당 한마디 / 🎁 운영자 선물 봤음(+ 한마디) (2026-11-22)
    hallMsg: (body) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/hall/msg', body);
    },
    giftAck: (msg) => {
      lbCache.delete('hall:stage');
      lbCache.delete('hall:endless');
      return http('POST', '/api/gift/ack', { msg: msg || null });
    },
    // 🗳 투표 (2026-11-23 시즌 2 피아노 미리보기)
    poll: (id) => http('GET', `/api/poll?id=${encodeURIComponent(id)}`),
    vote: (id, choice) => http('POST', '/api/poll', { id, choice }),
    logout: () => http('POST', '/api/logout'),
    suggest: (kind, text, contact) => http('POST', '/api/suggestions', { kind, text, contact }),
    room: (body) => http('POST', '/api/rooms', body),
    ranked: (body) => http('POST', '/api/ranked', body),
    transfer: (body) => http('POST', '/api/transfer', body),
    recoverRequest: (body) => http('POST', '/api/recover-request', body),
    recoverStatus: (token) => http('POST', '/api/recover-request/status', { token }),
    // 🎹 유저 맵: 목록은 1분 동안 같은 걸 다시 씀 (fresh 면 새로)
    maps: (sort, fresh) => {
      const key = 'maps:' + sort;
      const hit = lbCache.get(key);
      if (!fresh && hit && Date.now() - hit.at < LB_CACHE_MS) return hit.p;
      const p = http('GET', `/api/maps?sort=${sort === 'top' ? 'top' : 'new'}`);
      lbCache.set(key, { at: Date.now(), p });
      p.catch(() => lbCache.delete(key));
      return p;
    },
    mapGet: (id) => http('GET', `/api/maps/${encodeURIComponent(id)}?play=1`),
    mapUpload: (map) => {
      lbCache.delete('maps:new');
      return http('POST', '/api/maps', { map });
    },
    mapScore: (id, mode, score) => http('POST', `/api/maps/${encodeURIComponent(id)}/score`, { mode, score }),
    mapVote: (id, kind, on) => http('POST', `/api/maps/${encodeURIComponent(id)}/${kind === 'report' ? 'report' : 'like'}`, { on }),
    mapDelete: (id) => {
      lbCache.delete('maps:new');
      lbCache.delete('maps:top');
      return http('POST', `/api/maps/${encodeURIComponent(id)}/delete`);
    },
  };
}

// ---------------- 서버 없는 모드 (정적 호스팅) ----------------
// 랭킹·DM 인증은 서버가 있어야 진짜로 동작. 이 모드에선 화면에 '곧 오픈'으로 나오고,
// 아래 흐름은 내 컴퓨터(localhost)에서 개발할 때만 씀.
const isEndless = (level) => level === 'endless' || /^e\d+$/.test(String(level));

// 📴 서버(DB)가 쉬는 동안: 진짜 사이트면 Neon 에 남은 예전 랭킹(/api/snap/*)을 보여 줌 (5분 동안 같은 걸 다시 씀)
const isLocal = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const snapCache = new Map();
function snapGet(path) {
  const hit = snapCache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.p;
  const p = fetch(path, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  snapCache.set(path, { at: Date.now(), p });
  return p;
}

function mockApi(cfg) {
  const getPlayer = () => load('mockPlayer', null);
  const real = cfg.apiMode !== 'mock' && !isLocal();
  return {
    mode: 'mock',
    async buy() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async hallMsg() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async poll() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async vote() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
    async giftAck() {
      throw Object.assign(new Error('no_server'), { status: 503 });
    },
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
      if (real && level !== 'total') {
        const d = await snapGet(`/api/snap/leaderboard?level=${encodeURIComponent(level)}`);
        if (d && Array.isArray(d.entries)) return d;
        return { level, entries: [], me: null, snapFail: true };
      }
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
    // 🎹 유저 맵: 서버가 쉬는 동안 예전 목록·맵 (치기만, 기록·좋아요·올리기는 안 됨)
    ...(real
      ? {
          async maps(sort) {
            const d = await snapGet(`/api/snap/maps?sort=${sort === 'top' ? 'top' : 'new'}`);
            if (!d || !Array.isArray(d.maps)) throw Object.assign(new Error('no_server'), { status: 503 });
            return d;
          },
          async mapGet(id) {
            const d = await snapGet(`/api/snap/maps/${encodeURIComponent(id)}`);
            if (!d || !d.map) throw Object.assign(new Error('no_server'), { status: 503 });
            return d;
          },
          async mapVote() {
            throw Object.assign(new Error('no_server'), { status: 503 });
          },
        }
      : {}),
    async hall(board) {
      if (real) {
        const d = await snapGet(`/api/snap/hall?board=${board === 'endless' ? 'endless' : 'stage'}`);
        if (d && Array.isArray(d.entries)) return d;
      }
      const s = seasonAt();
      return { season: { n: s.n, end: s.end }, board, levels: 15, entries: [], me: null, hall: [], sample: true };
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
    async ranked() {
      const e = new Error('no_server');
      e.status = 503;
      throw e;
    },
  };
}

// 🧯 서버가 쉬는 중(db_down)이면 다음에 붙어 볼 시각을 폰에 적어 둠 (2026-11-22 밤).
//   서버가 쉬는 동안 폰마다 새로고침·판 시작 때마다 /api/health 를 불러 한 시간에 9천 건 → Worker 하루 한도(10만)를 위협.
//   서버가 알려 준 until(하루 한도면 오전 9시)까지, 단 최대 30분(+몇 분 흩뿌림) 동안은 묻지 않고 바로 서버 없는 모드.
//   새로고침해도 이어짐(폰 저장). 사람이 누른 인증·되찾기(force)는 바로 물어봄.
const DOWN_MAX_MS = 30 * 60 * 1000;
function noteServerDown(data) {
  const now = Date.now();
  const hint = data && Number(data.until) > now ? Number(data.until) - now : 5 * 60 * 1000;
  const wait = Math.min(DOWN_MAX_MS, Math.max(2 * 60 * 1000, hint)) + Math.floor(Math.random() * 5 * 60 * 1000);
  try {
    save('srvNextTry', now + wait);
  } catch {}
}
function serverResting() {
  const t = Number(load('srvNextTry', 0)) || 0;
  return t > Date.now() && t - Date.now() < DOWN_MAX_MS + 6 * 60 * 1000;
}

async function createApi(cfg) {
  if (cfg.apiMode === 'mock') return mockApi(cfg);
  if (cfg.apiMode === 'server') return serverApi();
  // 서버가 쉬는 중이라고 적어 둔 동안은 묻지 않음 (force 면 물어봄)
  if (!cfg.force && serverResting()) return mockApi(cfg);
  // auto: /api/health 가 응답하면 서버 사용
  try {
    const ctrl = new AbortController();
    // Cloudflare 서버가 막 새로 떴을 땐 1~2초 걸릴 수 있음 → 넉넉히 (서버가 꺼져 있으면 바로 실패가 와서 오래 안 기다림)
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('/api/health?boot=1', { signal: ctrl.signal, credentials: 'same-origin' });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.app === 'okaystra') {
        save('srvNextTry', 0);
        return serverApi(j);
      }
    } else if (res.status === 503) {
      const j = await res.json().catch(() => null);
      if (j && j.error === 'db_down') noteServerDown(j);
    }
  } catch {}
  return mockApi(cfg);
}

return { noteServerDown, serverResting, createApi };
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
//   게임이 바뀌거나 기능이 추가될 때만 맨 위에 한 덩어리 추가 (id 는 겹치지 않게 날짜-번호).
//   잠금·인증·운영 정책(누가 무엇을 쓸 수 있나) 같은 건 안 씀
//   짧게: 하루에 한 덩어리(같은 날 소식은 합침), 한 줄씩 2~5줄. 유저가 몰라도 되는 것(내부 구조·자잘한 수정·로딩 안내 등)은 안 씀

const NEWS = [
  {
    id: '2026-11-24h',
    date: '11월 24일',
    title: '🛒 상점 오픈! · 🖐 터치 판정을 단순하게',
    items: [
      '<b>🛒 상점이 열렸어요!</b> 첫 화면 <b>상점</b> 버튼 · 모은 코인으로 콩 스킨·무대·드럼·세트를 살 수 있어요 (레어 5천 · 에픽 1만 · 전설 4만 · 🎤 라이브 스테이지 세트 2만5천)',
      '업데이트·건의하기·홈 화면으로 보기는 <b>⚙ 설정</b> 안으로 · 설정 → <b>터치 표시</b>를 켜면 누른 자리에 동그라미와 판정이 보여요',
      '<b>누른 줄에 콩이 있으면 맞음, 없으면 헛침</b> — 엄지를 떼며 미끄러지거나 조금 일찍 눌러도 다음 콩이 MISS 되지 않아요',
      '<b>🖐 같이 치는 두 콩·빠르게 번갈아 치는 콩</b>은 터치가 안 들어와도 남은 콩을 <b>GOOD</b> 으로 쳐 줘요 (무제한 포함, 멀티 빼고) — 아이폰이 한 엄지가 떨어지는 순간 다른 엄지 터치를 빠뜨릴 때가 있어서예요',
      '왼엄지·오른엄지 쪽 <b>아무 줄이나</b> 눌러도 그쪽에 먼저 온 콩이 쳐져요 — 엄지를 벌려 바깥쪽을 눌러도 돼요',
    ],
  },
  {
    id: '2026-11-23m',
    date: '11월 23일',
    title: '🎹 시즌 2 피아노 미리보기 · 투표 · 🖐 터치 씹힘 고침',
    items: [
      '<b>🎹 시즌 2 미리보기!</b> 피아노 두 가지(A 세로 타일 · B 가로 건반)를 쳐 보고 <b>마음에 드는 쪽에 투표</b>하면 <b>🪙 500코인</b>! 표는 나중에 바꿀 수 있어요',
      '미리보기 새로: <b>⚡ 점점 빠르게</b> · 건반은 멀리서 다가오는 <b>원근 길</b>과 꾹 게이지 · 타일은 아래로 내려온 걸 <b>누르기만 하면</b> 돼요',
      '<b>🖐 터치 씹힘 고쳤어요!</b> <b>쿵 바로 뒤 짝</b>처럼 두 엄지로 빠르게 번갈아 칠 때 하나가 안 눌리던 것 · 폰이 잠깐 버벅이면 제때 친 콩이 MISS 되던 것 · 옆 줄을 살짝 누르면 씹히던 것',
      '<b>🎹 내 맵 만들기 다시 열렸어요!</b> 원하는 마디부터 듣기 · 건반 녹음 16분 칸까지 · 📤 올리기에서 <b>🎨 무대·드럼·콩 색</b>도 골라요 · 유저 맵 코인은 <b>PERFECT 때만 1개</b>',
      '<b>🥇 시즌 1 한정 세트</b> — 금빛 「1」 콩 + 시즌 1 무대 + 황금 드럼! 시즌 1 이 끝나면 다시는 안 팔아요',
    ],
  },
  {
    id: '2026-11-22n',
    date: '11월 22일',
    title: '🖐 터치 씹힘 고침 · 🛒 새 상점 · 🏆 시즌 보상 · 🔥 오늘의 챌린지',
    items: [
      '<b>🖐 터치가 씹히던 것 고쳤어요!</b> 누른 채 살짝 밀며 떼면 헛침으로 하트가 깎이던 문제, 조금 늦게 친 한 번에 하트가 2~3개 깎이던 문제예요',
      '<b>🥁 윌리엄 텔 「쿵짝쿵」</b>처럼 쿵·짝이 빠르게 번갈아 나올 때 하나가 안 눌리던 것도 고쳤어요',
      '<b>🛒 상점이 새로 바뀌어요!</b> <b>🎤 라이브 스테이지 세트</b>(리듬게임 라이브 화면 스타일로 통째로!) · ✨ 콩 스킨 · 🌄 새 무대 · 🥁 새 드럼 — 누르면 미리보기, 곧 판매 시작',
      '맵 배경·맵 드럼·콩 색은 이제 <b>무료</b>! 예전에 산 사람은 코인을 돌려드려요',
      '꾸미기는 이제 <b>상점에서 장착</b> — 장착 중인 것과 <b>보유</b>한 것만 따로 볼 수 있어요 · 콩 스킨 효과는 치는 데 안 가리게 줄였어요',
      '<b>🏆 시즌 1 보상</b> — 1등 10만 · 2등 7만 · 3등 5만 · 10등까지 1만 · 50등까지 5천 · 100등까지 3천 코인',
      '<b>🏛 명예의 전당</b>에 오르면 사진과 함께 <b>한마디</b>도 남길 수 있어요',
      '<b>칠 때마다 판정선이 흔들리던 것</b> 고쳤어요 — 이제 쿵·짝 자리가 꼼짝 안 해요',
      '<b>🎵 최신곡으로 치기</b> — 노래 나오는 화면을 화면 녹화해서 넣으면 그 노래로 쳐요',
      '<b>🔥 오늘의 챌린지</b> — 매일 곡 하나와 미션이 바뀌어요. 성공하면 <b>연속 일수</b>가 쌓여요!',
      '<b>🪙 코인</b> — PERFECT 2개, 나머지 1개! 중간에 끝나도 친 만큼 쌓여요',
      'PERFECT·GREAT·GOOD 글자를 크기·색으로 더 잘 구분되게 바꿨어요',
      '서버가 잠깐 쉴 때 친 기록도 폰에 모아 뒀다가, 서버가 돌아오면 <b>랭킹에 올라가요</b>',
    ],
  },
  {
    id: '2026-11-21u',
    date: '11월 21일',
    title: '🎲 랜덤 대결 · 🎹 18단계 엘리제를 위하여 · 🏛 명예의 전당 · 🎭 장거리 · 🎼 악보로 맵',
    items: [
      '<b>🥁 쿵이 가끔 안 눌리던 것 고쳤어요!</b> 다른 앱에 갔다 오거나 소리가 끊긴 뒤 쿵만 안 쳐지던 문제예요',
      '<b>🎹 유저 맵: 악보 파일(MIDI·MusicXML)로 바로 만들 수 있어요!</b> 🎹 멜로디 탭 → 🎼 악보 파일로 — 악보의 음·박자 그대로, 드럼 트랙이 있으면 드럼도 그대로. 멜로디 트랙·시작 마디는 <b>자동으로 추천</b>해 주고, 악보 <b>왼손(아래 줄)</b>도 그대로 피아노로 쳐요',
      '<b>⚔️ 멀티 → 🎲 랜덤 대결</b>이 생겼어요! 모르는 사람과 바로 붙어서 4~18단계 무작위 곡 — 둘 다 깨면 다른 곡이 바로 이어지고(<b>한 곡마다 점점 빨라져요 ⚡</b>), <b>먼저 쓰러지는 쪽이 져요</b>',
      '<b>18단계 엘리제를 위하여</b>(베토벤 · 지옥)가 새로 생겼어요! 게임에서 <b>가장 어려운 곡</b> — 미레미레미시레도 질주에 하이햇 트릴 연타까지',
      '<b>🏛 명예의 전당</b>이 생겼어요! 🏆 랭킹 → 🎵 단계 총합 / 💎 무제한 총합',
      '<b>시즌 1은 11월 26일 밤 11시 59분에 끝나요.</b> 1·2·3등은 명예의 전당에 영원히 기록되고, 프로필 사진도 올릴 수 있어요',
      '<b>🎭 장거리</b>가 바뀌었어요: 곡 하나를 <b>처음부터 끝까지</b>! 첫 곡은 오페라 <b>네순 도르마</b>',
      '왼쪽 엄지는 <b>쿵</b>, 오른쪽은 <b>🎹 피아노</b> — 누르면 그 음의 건반이 눌리며 피아노 화음이 울려요. 놓치면 그 음은 안 들려요!',
      '<b>🎹 유저 맵 노래 파일 음 따기</b>가 훨씬 좋아졌어요: 목소리 멜로디에, 목소리 없는 곳·반주만 있는 곡은 <b>악기 음을 듣는 AI</b>로 악기 멜로디를, <b>코드·드럼까지 노래에서</b> 따고, <b>노래 끝까지</b>(최대 64마디) 따요. 아이폰 화면 녹화 영상도 끝까지 바로 읽어요',
      '드럼 탭 맨 위 <b>⚡ 자동 드럼</b>(쉬움·보통·어려움)으로 직접 안 쳐도 바로 드럼이 생겨요',
      '<b>🥁 드럼 탭 칸 고치기</b>: 아래 칸에서 점을 누르면 지워지고, 빈 칸을 누르고 드럼을 치면 거기에 들어가요',
      '<b>🎹 맵 만들기</b>가 탭으로 바뀌었어요: <b>🥁 드럼</b>은 진짜 드럼 세트처럼 쳐서 녹음(겹쳐 치기 가능), <b>🎹 멜로디</b>에서 그 위에 피아노를 얹어요. 드럼만 올려도 돼요!'
    ],
  },
  {
    id: '2026-11-20r',
    date: '11월 20일',
    title: '🎭 장거리 · 🎹 유저 맵 · 🎵 내 노래로 치기 · 🥁 쿵콩이·짝콩이',
    items: [
      '<b>🎹 유저 맵</b>: 똑딱 소리에 맞춰 건반을 쳐서 녹음하거나, 노래 파일에서 멜로디를 따서 내 맵을 만들어요',
      '드럼은 쉬움·보통·어려움 자동, 또는 노래에 맞춰 패드를 쳐서 직접 만들어요. 다른 사람 맵을 치고 ❤ 좋아요도 눌러요',
      '유저 맵은 <b>🛡 무적</b> / <b>❤ 하트 5개</b> 중에 골라 쳐요. 모드마다 🥇🥈🥉 랭킹이 따로 있어요',
      '<b>🎵 내 노래로 치기</b>: 폰에 있는 노래(mp3·화면 녹화)를 넣으면 그 박자에 맞춰 채보를 만들어 줘요',
      '<b>쿵콩이·짝콩이</b>가 자기 북을 타고 나타났어요! 게임 중에도 둘이 같이 쳐요',
    ],
  },
  {
    id: '2026-11-19p',
    date: '11월 19일',
    title: '🐢 느리게 연습 · 🎄 크리스마스 이벤트 곡 3개',
    items: [
      '<b>🐢 느리게 연습</b>: 일시정지·결과 화면에서 50%·70%·85% 빠르기로 연습해요. 목숨이 안 줄어요 (기록엔 안 남음)',
      '합창 노래에 맞춰 치는 <b>데크 더 홀즈</b>(보통) · <b>위 위시 유 어 메리 크리스마스</b>(어려움) · <b>크리스마스의 12일</b>(지옥). 앞 단계를 안 깼어도 바로 칠 수 있어요',
      '데크 더 홀즈는 곡이 바뀌어서 랭킹을 새로 시작해요',
      '이어하자마자 죽거나 곡이 멈추던 문제를 고쳤어요',
    ],
  },
  {
    id: '2026-11-18n',
    date: '11월 18일',
    title: '⚔️ 멀티 대결 · 16·17단계',
    items: [
      '<b>멀티</b>: 모르는 사람과 바로 붙는 빠른 대결, 4자리 코드로 여는 친구 대결 방(팀전·무제한 규칙)',
      '<b>16단계</b> 모차르트(탐탐 추가) · <b>17단계</b> 라 쿠카라차, 연타 구간과 황금 콩(하트 +1)',
      '3D 드럼과 단계마다 다른 맵. 같은 난이도 단계를 하나만 깨도 그 난이도 전부 열려요',
      '⚙️ 설정에서 다른 폰으로 기록 옮기기 · 예전 주소 기록 되찾기',
      '터치가 안 먹거나 옆 줄로 들어가던 것 고침',
    ],
  },
  {
    id: '2026-11-17a',
    date: '11월 17일',
    title: '운명 교향곡 · 저사양 모드',
    items: [
      '8단계 <b>운명 교향곡</b>(베토벤) 추가',
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
//   서버(/api/rooms): 방 만들기·들어가기·빠른 대결 짝짓기·준비·시작 시각·최종 점수. 대기실 3초마다 주고받음.
//   ⚡ 실시간: 두 폰을 직접 이어서(WebRTC 데이터 채널) 치는 동안 점수를 0.2초마다 바로 주고받음.
//     처음 이을 때만 서버로 서로 주소(SDP)를 한 번씩 건넴. 이어지면 치는 동안 서버 요청은 15초에 한 번(살아 있음 표시)만.
//     통신사 망에 따라 직접 연결이 안 되면 예전처럼 서버로 4초마다 (자동으로 바뀜).
//   서버 시계와 내 시계 차이(offset)를 재서 '같은 시각에 시작'을 맞춤.

// Vercel 요청 수를 아끼려고 넉넉하게
// 하루 10만 건(Cloudflare 무료) 아끼기: 실시간 연결이 안 됐을 때만 서버로 주고받으니 너무 촘촘하지 않게
const ROOM_POLL_LOBBY_MS = 3000;
const ROOM_POLL_PLAY_MS = 5000;
const ROOM_POLL_RT_MS = 15000; // 실시간 연결됐을 때 치는 중
const ROOM_POLL_WAIT_MS = 5000; // 빠른 대결 상대 기다리는 중
// 대기실에서 한동안 아무 변화가 없으면 천천히 (창을 켜 둔 채 놔두면 3초마다 계속 → 하루 무료 요청을 많이 먹음)
//   자리 비움 판정(1분)보다 짧게. 누가 준비·곡 바꾸기를 하거나 내가 뭘 누르면 바로 원래 간격
const ROOM_IDLE_SLOW_AFTER_MS = 3 * 60_000;
const ROOM_IDLE_SLOWER_AFTER_MS = 15 * 60_000;
const ROOM_POLL_IDLE_MS = 10_000;
const ROOM_POLL_IDLER_MS = 30_000;
/** 방 모양에서 매번 바뀌는 값(ago)만 빼고 비교용 글자로 */
function roomSig(room) {
  if (!room) return '';
  const players = {};
  for (const [k, p] of Object.entries(room.players || {})) {
    const { ago, ...rest } = p || {};
    players[k] = rest;
  }
  return JSON.stringify({ ...room, players });
}
/** 대기실 주고받기 간격: 변화 없이 idleMs 지났으면 천천히 */
function lobbyPollMs(idleMs) {
  return idleMs > ROOM_IDLE_SLOWER_AFTER_MS ? ROOM_POLL_IDLER_MS : idleMs > ROOM_IDLE_SLOW_AFTER_MS ? ROOM_POLL_IDLE_MS : ROOM_POLL_LOBBY_MS;
}
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
    this._sig = '';
    this._changedAt = Date.now();
    // 화면으로 돌아오면 대기실은 바로 한 번 받고 빠른 간격으로 (천천히 받던 중이었어도 바로 보이게)
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', () => {
        if (document.hidden || !this.code || (this.room && this.room.status === 'playing')) return;
        if (Date.now() - this._changedAt <= ROOM_IDLE_SLOW_AFTER_MS) return;
        this._changedAt = Date.now();
        this.poll();
      });
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
    this._sig = roomSig(r.room);
    this._changedAt = Date.now();
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

  /** 🎲 랜덤 대결에서 지금 기다리는 사람 수 { rush } (실패하면 null) */
  async waitingCounts() {
    try {
      const r = await this.api.room({ action: 'count' });
      return (r && r.waiting) || null;
    } catch {
      return null;
    }
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
    if (!this.code) return;
    // 주고받는 중에 '바로 보내기'가 오면 끝나자마자 한 번 더 (다음 주기까지 안 기다리게)
    if (this._busy) {
      this._again = true;
      return;
    }
    this._busy = true;
    clearTimeout(this._timer); // 주기 타이머는 끝나고 다시 잡음 (겹쳐서 두 번 보내지 않게)
    const body = { action: 'sync', code: this.code, slot: this.slot, key: this.key, ...this.pending };
    // 내가 뭘 보냄(준비·곡 바꾸기…) = 변화
    if (Object.keys(this.pending).length) this._changedAt = Date.now();
    this.pending = {};
    try {
      const r = await this._call(body);
      this._fails = 0;
      const sig = roomSig(r.room);
      if (sig !== this._sig) {
        this._sig = sig;
        this._changedAt = Date.now();
      }
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
      if (this._again && this.code) {
        this._again = false;
        this.poll();
      } else this._schedule();
    }
  }

  _schedule() {
    clearTimeout(this._timer);
    if (!this.code) return;
    const playing = this.room && this.room.status === 'playing';
    const linking = this.link && !this.link.open; // 연결 신호 주고받는 중엔 빨리
    // 🎲 랜덤 대결: 내 곡이 끝났으면 다음 곡 시작을 빨리 알아채게 (결과 화면에서 기다리는 중)
    const mf = this.me && this.me.final;
    const rushWait = playing && this.room.pub === 'rush' && mf && mf.round === this.room.round;
    const ms = rushWait ? ROOM_POLL_LOBBY_MS : playing ? (this.realtime ? ROOM_POLL_RT_MS : ROOM_POLL_PLAY_MS) : this.waiting ? ROOM_POLL_WAIT_MS : linking ? 1500 : lobbyPollMs(Date.now() - this._changedAt);
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
        this.peerFinal = { round: m.round, score: m.score | 0, stars: m.stars | 0, grade: String(m.grade || ''), failed: !!m.failed, maxCombo: m.maxCombo | 0, accuracy: +m.accuracy || 0, died: !!m.died, survived: +m.survived || 0, lv: m.lv | 0 };
        this.onUpdate(this.room);
        // 🎲 랜덤 대결: 상대도 끝남 → 서버가 다음 곡을 정했을 테니 바로 물어봄
        if (this.room && this.room.pub === 'rush' && !m.died) setTimeout(() => this.poll(), 400);
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
      this._sig = roomSig(r.room);
      this._changedAt = Date.now();
      this._update();
    } catch {}
    // 치는 중엔 15초 간격이었으니 대기실 간격(3초)으로 다시 잡음 (상대 준비·규칙 바뀐 게 늦게 보이던 것)
    this._schedule();
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

/**
 * ⚔️ 서바이벌 승패: 먼저 목숨을 다 쓴 사람이 짐. 둘 다 졌으면(거의 동시) 더 오래 버틴 쪽, 그것도 같으면 점수.
 * me/them = { died, survived(초), score }
 */
function survivalOutcome(me, them) {
  if (!me.died && them.died) return 'win';
  if (me.died && !them.died) return 'lose';
  const d = (me.survived || 0) - (them.survived || 0);
  if (Math.abs(d) > 0.05) return d > 0 ? 'win' : 'lose';
  if (me.score === them.score) return 'draw';
  return me.score > them.score ? 'win' : 'lose';
}

/** 방 결과: 개인전은 승패, 팀전은 합계 */
function roomOutcome(mode, mine, theirs) {
  if (mode === 'team') return { team: (mine || 0) + (theirs || 0) };
  if (mine === theirs) return { result: 'draw' };
  return { result: mine > theirs ? 'win' : 'lose' };
}

return { ROOM_POLL_LOBBY_MS, ROOM_POLL_PLAY_MS, ROOM_POLL_RT_MS, ROOM_POLL_WAIT_MS, ROOM_IDLE_SLOW_AFTER_MS, ROOM_IDLE_SLOWER_AFTER_MS, ROOM_POLL_IDLE_MS, ROOM_POLL_IDLER_MS, roomSig, lobbyPollMs, RoomClient, survivalOutcome, roomOutcome };
})();

// ---- cover.js ----
const __m_cover = (() => {
// 🖼 릴스 썸네일(표지) 만들기: 실제 게임 화면(맵·3D 드럼·떨어지는 노트·PERFECT 효과)을 1080×1920 으로 그리고
//   위에 큰 훅 문구를 얹음. 인스타 프로필 격자는 가운데(3:4)만 보여서 중요한 건 가운데 쪽에.

const { Renderer, preloadShopBg } = __m_render;
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
async function makeReelCover({ lv, title, sub, bottom, deco = null }) {
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
    r.studio = { cover: true, top: '', bottom: '', label: '' };
    // 🎨 영상 찍기 「꾸미기」 켰으면 상점에서 장착한 무대·드럼·세트도 썸네일에 (2026-11-24 사용자). 콩 색은 부르는 쪽이 맞춤
    if (deco) Object.assign(r, { studioSkin: true, bgPick: deco.bgPick, kitPick: deco.kitPick, photoDim: deco.photoDim, bgPhoto: deco.bgPhoto, uiStyle: deco.uiStyle });
    r.setTheme(lv);
    if (r.theme.img) await preloadShopBg(r.theme.img); // 상점 무대 그림은 받은 뒤에 그림
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
const { loadBuddies } = __m_buddies;
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

  const pill = `${level.xmas ? '크리스마스 이벤트' : level.long ? '장거리' : `${level.id}단계`} · ${level.composer} ${level.name}`;
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
    const B = await loadBuddies();
    if (!B) throw new Error('no buddies');
    const face = (result.stars || 0) <= 1 ? 'miss' : 'cheer';
    const dw = 400;
    const bottom = 1720;
    for (const [who, x] of [['kong', W / 2 - dw - 10], ['jjak', W / 2 + 10]]) {
      const dh = (dw * B.drum[who].height) / B.drum[who].width;
      g.drawImage(B.drum[who], x, bottom - dh, dw, dh);
      const cw = dw * 0.92;
      g.drawImage(B[who][face], x + dw * 0.04, bottom - dw * 0.56 - cw, cw, cw);
    }
  } catch {
   try {
    const r = await buildRasters(340, 400);
    const face = (result.stars || 0) <= 1 ? 'miss' : 'cheer';
    g.drawImage(r.kong[face], W / 2 - 170, 1170, 340, 340);
    g.drawImage(r.bass, W / 2 - 400, 1300, 380, 399);
    g.drawImage(r.snare, W / 2 + 40, 1370, 360, 345);
   } catch {}
  }

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

// ---- icons.js ----
const __m_icons = (() => {
// 직접 그린 아이콘 (SVG). 화면에 이모지를 안 쓰고 전부 이걸로 보여 줌.
//   icon('heart') → <svg class="i"> 문자열 (innerHTML 에 넣어서 씀)
//   글 속에 이모지를 적어도 됨: watchEmoji() 가 화면에 붙는 글의 이모지를 같은 모양 아이콘으로 바꿔 줌
//   (EMOJI 표에 없는 이모지는 지움). 캔버스 글씨엔 이모지를 쓰지 말 것 (바꿀 수 없음).

const S = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';

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

  // ---- 이모지 대신 쓰는 것들 ----
  gem: `<path d="M7 3.5h10l4.5 5.6L12 21 2.5 9.1z" ${F} fill-opacity=".22"/><path d="M7 3.5h10l4.5 5.6L12 21 2.5 9.1zM2.5 9.1h19M9.4 9.1L12 21l2.6-11.9M7 3.5l2.4 5.6L12 3.5l2.6 5.6L17 3.5" ${S} stroke-width="1.9"/>`,
  sparkle: `<path d="M10 2c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7zM18.5 14c.3 2.1 1.4 3.2 3.5 3.5-2.1.3-3.2 1.4-3.5 3.5-.3-2.1-1.4-3.2-3.5-3.5 2.1-.3 3.2-1.4 3.5-3.5z" ${F}/>`,
  bolt: `<path d="M13.5 2L4.5 13.5h6.5L10 22l9.5-12.5h-6.7z" ${F} stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  burst: `<path d="M12 2l2 5.2 5-2.6-1.9 5.3L22 12l-4.9 2.1 1.9 5.3-5-2.6L12 22l-2-5.2-5 2.6 1.9-5.3L2 12l4.9-2.1L5 4.6l5 2.6z" ${F}/>`,
  drum: `<ellipse cx="12" cy="10" rx="8" ry="3" ${S} stroke-width="2"/><path d="M4 10v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7M8 12.7v7M16 12.7v7M6 2.5l4.5 5M18 2.5l-4.5 5" ${S} stroke-width="2"/>`,
  chat: `<path d="M4 6a2.5 2.5 0 012.5-2.5h11A2.5 2.5 0 0120 6v7.5a2.5 2.5 0 01-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 014 13.5z" ${S} stroke-width="2"/><circle cx="8.3" cy="9.8" r="1.25" ${F}/><circle cx="12" cy="9.8" r="1.25" ${F}/><circle cx="15.7" cy="9.8" r="1.25" ${F}/>`,
  image: `<rect x="3" y="4.5" width="18" height="15" rx="2.5" ${S} stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.8" ${F}/><path d="M3.5 17.5l5-4.5 4 3.5 3-2.5 5 4" ${S} stroke-width="2"/>`,
  party: `<path d="M3.5 20.5L8 8.5l7.5 7.5z" ${F}/><path d="M12.5 4.5c1.5 1 1.6 2.6.6 3.6M17 9.5c1.3-1.4 3-1.4 4-.4M16 3v1.6M20.5 13.5H22M19 5.5l1.2-1.2M9.5 3.5l.6 1.4" ${S} stroke-width="1.9"/>`,
  note: `<path d="M9 18V5l11-2v13" ${S} stroke-width="2.2"/><circle cx="6.5" cy="18" r="2.6" ${F}/><circle cx="17.5" cy="16" r="2.6" ${F}/>`,
  fire: `<path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-4.3-3.3-6.6-4.5-10.8-1.6 1.3-2.7 3.4-2.6 5.6C11 8.3 9.7 6.8 9.3 5 6.6 7.6 4.5 11 4.5 14.8 4.5 19 7.6 22 12 22z" ${F}/><path d="M12 21c-1.9 0-3.2-1.3-3.2-3.1 0-1.9 1.5-3 2.3-4.7.9 1.2 1.4 1.6 2.4 1.8.3-.8.4-1.5.4-2.3 1.4 1.2 1.5 3 1.5 5.2 0 1.8-1.4 3.1-3.4 3.1z" fill="#fff" fill-opacity=".5"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="3"/>`,
  ok: `<circle cx="12" cy="12" r="10" ${F}/><path d="M7.2 12.4l3.2 3.2 6.4-6.6" stroke="#fff" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  team: `<circle cx="8.5" cy="8" r="3.3" ${S} stroke-width="2"/><circle cx="16.8" cy="9.2" r="2.7" ${S} stroke-width="2"/><path d="M2.5 20c0-3.4 2.7-6.2 6-6.2s6 2.8 6 6.2M14.6 14.3c.7-.4 1.4-.5 2.2-.5 2.7 0 4.7 2.3 4.7 5.2" ${S} stroke-width="2"/>`,
  clapper: `<rect x="3" y="9" width="18" height="11.5" rx="2" ${S} stroke-width="2"/><path d="M3.2 8.6L4 4.7 20.3 2.6l.8 3.9zM8.6 4.1l2.3 3.8M14.4 3.4l2.3 3.8" ${S} stroke-width="2"/>`,
  megaphone: `<path d="M3.5 10v4A1.5 1.5 0 005 15.5h2l9.5 4.5V4L7 8.5H5A1.5 1.5 0 003.5 10z" ${S} stroke-width="2"/><path d="M7.5 15.5l1.3 4.5M19.5 9.5a3.5 3.5 0 010 5" ${S} stroke-width="2"/>`,
  unlock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" ${F}/><path d="M8 10.5V8a4 4 0 017.7-1.6" ${S} stroke-width="2.4"/>`,
  sprout: `<path d="M12 21.5v-9.5" ${S} stroke-width="2.2"/><path d="M12 12.5C12 8 9 5.5 3.5 5.5c0 4.5 3 7 8.5 7zM12 10.5c0-4 2.8-6.5 8.5-6.5 0 4-2.8 6.5-8.5 6.5z" ${F}/>`,
  warn: `<path d="M12 3.2L2 20.5h20z" ${F} stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v5M12 17.5v.1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  key: `<circle cx="7.5" cy="15.5" r="4.5" ${S} stroke-width="2.2"/><path d="M10.7 12.3L20 3M15.5 7.5l3 3M13.3 9.7l2 2" ${S} stroke-width="2.2"/>`,
  sunset: `<path d="M5.5 17a6.5 6.5 0 0113 0z" ${F}/><path d="M2 17h20M6 20.5h12M12 3.5v3M4.2 8.7l2 2M19.8 8.7l-2 2" ${S} stroke-width="2"/>`,
  city: `<path d="M3 21V10h5v11M8 21V4h8v17M16 21v-8h5v8M2 21h20M11 7.5h2M11 11h2M11 14.5h2" ${S} stroke-width="2"/>`,
  hall: `<path d="M3 9.5L12 4l9 5.5zM5.5 11.5v6.5M9.8 11.5v6.5M14.2 11.5v6.5M18.5 11.5v6.5M3 21h18" ${S} stroke-width="2"/>`,
  spot: `<path d="M8.5 2.5h7L14 7.5h-4z" ${F}/><path d="M10 8.5L5.5 18.5M14 8.5l4.5 10" ${S} stroke-width="2"/><ellipse cx="12" cy="19" rx="7.5" ry="2.3" ${S} stroke-width="2"/>`,
  volcano: `<path d="M2 21.5l6-10h8l6 10z" ${F}/><path d="M9.5 8c.9-1.7 1.6-2.2 2.5-2.2s1.6.5 2.5 2.2M12 2v1.5M7.5 3.5l1 1.2M16.5 3.5l-1 1.2" ${S} stroke-width="2"/>`,
  planet: `<circle cx="12" cy="12" r="5.5" ${F}/><ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-20 12 12)" ${S} stroke-width="1.8"/>`,
  tree: `<path d="M12 2.5l1.1 2.2 2.4.3-1.8 1.6.5 2.4L12 7.8 9.8 9l.5-2.4L8.5 5l2.4-.3z" ${F}/><path d="M12 9l-5 6h3l-4 5h12l-4-5h3z" ${F}/><path d="M11 20h2v2.5h-2z" ${F}/>`,
  moon: `<path d="M14 3a8.5 8.5 0 107 12.5A7 7 0 0114 3z" ${F}/><path d="M19 3.5v3M17.5 5h3" ${S} stroke-width="1.6"/>`,
  mute: `<path d="M3.5 9.5H7L12 5v14l-5-4.5H3.5z" ${F} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" ${S} stroke-width="2.2"/>`,
  camera: `<path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3A1.5 1.5 0 0121.5 9v9.5A1.5 1.5 0 0120 20H4a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 014 7.5z" ${S} stroke-width="2"/><circle cx="12" cy="13.5" r="3.6" ${S} stroke-width="2"/>`,
  piano: `<rect x="3" y="4" width="18" height="16" rx="2" ${S} stroke-width="2"/><path d="M9 20v-6M15 20v-6" ${S} stroke-width="2"/><path d="M7.5 4h3v10h-3zM13.5 4h3v10h-3z" ${F}/>`,
  bulb: `<path d="M9.5 18h5M10.5 21.5h3M8.5 15a6.5 6.5 0 117 0c-.8.6-1 1.5-1 3h-5c0-1.5-.2-2.4-1-3z" ${S} stroke-width="2"/>`,
  bug: `<ellipse cx="12" cy="14" rx="5" ry="6.5" ${S} stroke-width="2"/><path d="M12 8v12.5M9.5 7L8 4.5M14.5 7L16 4.5M7 12H3M17 12h4M7 16.5l-3.5 2M17 16.5l3.5 2" ${S} stroke-width="2"/>`,
  infinity: `<path d="M12 12c-2-2.7-3.7-4-5.5-4a4 4 0 000 8c1.8 0 3.5-1.3 5.5-4zm0 0c2 2.7 3.7 4 5.5 4a4 4 0 000-8c-1.8 0-3.5 1.3-5.5 4z" ${S} stroke-width="2.2"/>`,
  medal: `<path d="M7.5 2.5L10.5 9M16.5 2.5L13.5 9" ${S} stroke-width="2.4"/><circle cx="12" cy="15" r="6.5" ${F}/><circle cx="12" cy="15" r="3.6" fill="#fff" fill-opacity=".35"/>`,
  crown: `<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" ${F} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  mail: `<rect x="3" y="5.5" width="18" height="13" rx="2.5" ${S} stroke-width="2"/><path d="M3.5 7l8.5 6.5L20.5 7" ${S} stroke-width="2"/>`,
  heartbreak: `<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.2a4.4 4.4 0 018 2.7c0 5.7-8 10.6-8 10.6z" ${F}/><path d="M12.3 7.6l-2 4 3 2.2-1.6 4.2" stroke="#fff" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  home: `<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" ${S} stroke-width="2"/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" ${S} stroke-width="2"/><path d="M10.5 18.5h3" ${S} stroke-width="2"/>`,
};

/** 이모지 → 아이콘 이름 (같은 뜻은 같은 아이콘) */
const EMOJI = {
  '💎': 'gem', '⚔': 'swords', '✨': 'sparkle', '⚡': 'bolt', '💥': 'burst', '🥁': 'drum', '💬': 'chat', '🖼': 'image',
  '🎉': 'party', '🔒': 'lock', '❤': 'heart', '🎵': 'note', '🔥': 'fire', '🏆': 'trophy', '✅': 'ok', '✓': 'check',
  '🤝': 'team', '👫': 'team', '🎬': 'clapper', '📢': 'megaphone', '🔓': 'unlock', '🌱': 'sprout', '⚠': 'warn', '🔑': 'key',
  '🌅': 'sunset', '🌃': 'city', '🎻': 'hall', '🖤': 'spot', '🌋': 'volcano', '🪐': 'planet', '🌌': 'moon', '🎄': 'tree', '🔇': 'mute',
  '📸': 'camera', '🎹': 'piano', '💡': 'bulb', '🐞': 'bug', '⚙': 'gear', '♾': 'infinity', '🥇': 'medal', '🥈': 'medal',
  '🥉': 'medal', '🔄': 'retry', '👑': 'crown', '💌': 'mail', '💔': 'heartbreak', '✕': 'close', '🏠': 'home', '📲': 'phone',
  '⬆': 'share', '▶': 'play',
};

/** svg 문자열. emo=true 면 이모지 자리용 색(하트 분홍·다이아 하늘색 등)을 입힘 */
const icon = (n, emo = false) => `<svg class="i${emo ? ' e-' + n : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// 표에 있는 이모지 (+ 뒤에 붙는 변형 기호), 그리고 표에 없는 나머지 그림 이모지
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KNOWN = new RegExp(`(${Object.keys(EMOJI).map(esc).join('|')})\\uFE0F?`, 'gu');
const OTHER = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})[️‍\p{Extended_Pictographic}\p{Emoji_Modifier}]*\s?/gu;
const ANY = /[←-⯿\u{1F000}-\u{1FAFF}]/u;
// 글만 들어가는 곳: 이모지만 지움 / 손대지 않는 곳
const NO_SVG = new Set(['OPTION', 'TITLE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

/** 이모지만 지운 글 (svg 를 못 넣는 곳: 선택 목록·공유 글·캔버스) */
const stripEmoji = (s) => String(s).replace(KNOWN, '').replace(OTHER, '').replace(/\s{2,}/g, ' ').trim();

const cache = new Map();
function svgNode(name) {
  if (!cache.has(name)) {
    const t = document.createElement('template');
    t.innerHTML = icon(name, true);
    cache.set(name, t.content.firstChild);
  }
  return cache.get(name).cloneNode(true);
}

function fixText(node) {
  const s = node.nodeValue;
  if (!s || !ANY.test(s)) return;
  const p = node.parentNode;
  if (!p || SKIP.has(p.nodeName)) return;
  if (NO_SVG.has(p.nodeName)) {
    const t = stripEmoji(s);
    if (t !== s) node.nodeValue = t;
    return;
  }
  const frag = document.createDocumentFragment();
  let last = 0;
  let changed = false;
  for (const m of s.matchAll(KNOWN)) {
    if (m.index > last) frag.append(s.slice(last, m.index).replace(OTHER, ''));
    frag.append(svgNode(EMOJI[m[1]]));
    last = m.index + m[0].length;
    changed = true;
  }
  const tail = s.slice(last);
  const tailClean = tail.replace(OTHER, '');
  if (!changed && tailClean === s) return;
  frag.append(tailClean);
  p.replaceChild(frag, node);
}

function walk(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || root.nodeName === 'svg' || SKIP.has(root.nodeName)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  while (tw.nextNode()) if (ANY.test(tw.currentNode.nodeValue) && !SKIP.has(tw.currentNode.parentNode.nodeName)) list.push(tw.currentNode);
  list.forEach(fixText);
}

/** 지금 화면 + 앞으로 붙는 글의 이모지를 아이콘으로 */
function watchEmoji(root = document.body) {
  walk(root);
  new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'characterData') fixText(r.target);
      else r.addedNodes.forEach(walk);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}

return { ICONS, EMOJI, icon, stripEmoji, watchEmoji };
})();

// ---- main.js ----
const __m_main = (() => {
// 오케이스트라 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

const { LEVELS, getLevel, levelLanes, DIFFICULTY_WORDS, STAR_RULES, ENDLESS_ID, LAST_LEVEL_ID, MAIN_LEVELS, levelLabel, makeEndless, isUnlocked, unlockHint, nextChallenge, DIAMOND_RULES, roundInfo, ENDLESS_FROM, LEVEL_ENDLESS_STEP, makeLevelEndless, levelEndlessBase, levelEndlessId, needsVerify, FREE_UPTO, isClosed, prevOpenId, nextOpenId, STUDIO_LEVELS, getStudioLevel, levelSurvivalId, levelSurvivalBase, COUNT_IN_BARS, ROUND_BARS, BEAT_ID, makeBeatReel, beatOpts, beatSeconds, BEAT_MAX_ROUNDS, BEAT_STYLES, BEAT_DIFFS, beatStyleName, QUIZ_BARS, quizId, isQuizId, makeQuizLevel, quizSeconds, STEPS_PER_BAR, CHAR_LANES, KICK, SNARE, HAT, CRASH, parseChord, noteCount } = __m_charts;
const { todayMission, missionDone, streakView, markDone } = __m_daily;
const { PianoPreview, P2_SONGS } = __m_piano2;
const { DECO_THEMES, NOTE_FREE, SHOP_ITEMS, RARITY, RARITY_NAME, priceOf, legacyRefund, LIMITED, onSale } = __m_shop;
const { startShopPreview, stopShopPreview, drawKitCloseup } = __m_shoppreview;
const { separateVocals, resample } = __m_vocalsep;
const { transcribeSong } = __m_songmap;
const { instrumentNotes } = __m_instnotes;
const { readScoreFile, scoreInfo, scoreToMap, recommendStart } = __m_scorefile;
const { videoToAac } = __m_mp4audio;
const { MAP_LIMITS, midiName, SOLFA, barToMelody, drumCell, toggleDrum, harmonize, autoDrums, cleanMap, mapLevel, MAP_DECO } = __m_usermap;
const { AudioEngine, playMetronome } = __m_audio;
const { Renderer, NOTE_PALETTES, LANE, applyNoteColors } = __m_render;
const { coinsInit, setCoinAccount, coinTotal, addRunCoins, addServerCoins } = __m_coins;
const { queueOffline, backupOffline } = __m_offrec;
const { Game, MAX_LIVES, LIFE_REGEN_COMBO, REVIVE_LIVES } = __m_game;
const { initAds, showRewarded } = __m_ads;
const { createApi, serverResting } = __m_api;
const { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay } = __m_track;
const { CONFIG } = __m_config;
const { buddyUrl, loadBuddies } = __m_buddies;
const { groupStarting, THEMES, SHOP_KITS } = __m_themes;
const { NEWS, LATEST_NEWS } = __m_news;
const { RoomClient, roomOutcome, survivalOutcome } = __m_room;
const { makeReelCover } = __m_cover;
const { detectBeat, monoOf, songChart } = __m_beatsync;
const { seasonLeftText, BOARD_LABEL } = __m_season;
const { loadSettings, saveSettings, loadBests, saveBest, load, save, remove, migrateLevelOrder, resetOldLevel18, photoSave, photoLoad, photoDelete } = __m_storage;

resetOldLevel18(); // 18번 = 엘리제를 위하여 (그 전 찬송가 기록 지움)
migrateLevelOrder(); // 8단계에 새 곡이 끼면서 밀린 번호를 이 브라우저 기록에도 반영 (아래 state 보다 먼저)
const { makeShareCard, gradeColor } = __m_sharecard;
const { icon, watchEmoji } = __m_icons;
const { todayLevel, encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome, cleanName } = __m_versus;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);

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

/**
 * 서버 없는 모드로 시작한 화면(첫 접속 때 서버가 늦게 깨서 기다리다 포기함)을 서버에 다시 붙임. 붙으면 true.
 *   그대로 두면 새로고침 전까지 인증·기록 옮기기·랭킹이 계속 '서버 연결 안 됨'이라서.
 *   부르는 곳: 시작 몇 초 뒤 한 번, 앱으로 돌아올 때(30초에 한 번), 인증·기록 옮기기 누를 때
 */
let reconnecting = null;
let reconnectTriedAt = 0;
let reconnectFails = 0;
/** 🧯 서버 DB 가 막힘 → 서버 없는 모드로 (인증했던 폰은 그대로 열림, 기록·코인은 폰에). reconnectServer 가 나중에 다시 붙임 */
let dbDownShown = false;
async function goOffline() {
  if (!state.api || state.api.mode !== 'server') return;
  state.api = await createApi({ ...CONFIG, apiMode: 'mock' });
  if (state.roomClient) state.roomClient.api = state.api;
  reconnectTriedAt = Date.now();
  reconnectFails = Math.max(reconnectFails, 2); // 2분 뒤부터 다시 붙어 봄
  if (!dbDownShown) {
    dbDownShown = true;
    toast('서버가 잠깐 쉬어요 · 게임은 그대로, 기록·코인은 저장돼요', 3500);
  }
  refreshTitle();
  renderLevels();
}
window.addEventListener('okaystra:db-down', () => goOffline().catch(() => {}));
window.addEventListener('okaystra:offline-sent', (ev) => {
  const d = ev.detail || {};
  if (d.improved > 0) toast(`서버 없을 때 친 기록 ${d.improved}개가 랭킹에 올라갔어요 🏆`, 3200);
});
function reconnectServer({ force = false } = {}) {
  if (state.api && state.api.mode === 'server') return Promise.resolve(true);
  if (CONFIG.apiMode === 'mock') return Promise.resolve(false);
  // 계속 안 되면 30초 → 1분 → 2분 … 10분 간격으로만 다시 해 봄 (하루 한도를 넘겨 서버가 막혔을 때 헛요청 줄이기)
  const gap = Math.min(600, 30 * 2 ** reconnectFails) * 1000;
  if (!force && Date.now() - reconnectTriedAt < gap) return Promise.resolve(false);
  reconnectTriedAt = Date.now();
  reconnecting ??= (async () => {
    try {
      const api = await createApi({ ...CONFIG, apiMode: 'auto', force });
      if (api.mode !== 'server') {
        reconnectFails = Math.min(reconnectFails + 1, 5);
        return false;
      }
      reconnectFails = 0;
      state.api = api;
      if (state.roomClient) state.roomClient.api = api;
      initTracker({ enabled: true });
      try {
        state.me = await api.me();
      } catch {}
      refreshTitle();
      renderLevels();
      return true;
    } catch {
      return false;
    } finally {
      reconnecting = null;
    }
  })();
  return reconnecting;
}
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
  if (state.api && state.api.mode === 'server') {
    const ok = !!(isVerified() && state.me.confirmed);
    // 서버가 알려 준 내 인증 상태를 폰에 기억 (서버가 잠깐 안 될 때 쓰려고). 내 정보를 받기 전(빈 me)엔 안 바꿈
    const known = state.me && (state.me.guest || state.me.verified === false);
    if (known && ok !== !!load('confirmedAt', 0)) ok ? save('confirmedAt', Date.now()) : remove('confirmedAt');
    return ok;
  }
  // 서버가 잠깐 안 될 때(하루 한도 초과 등 — 2026-11-22 D1 읽기 한도): 7일 안에 인증 완료였던 폰은 그대로 열어 둠
  //   (기록·코인은 폰에 모아 뒀다가 서버가 돌아오면 올라감)
  //   이 기억이 없는 폰(새 코드가 서버와 한 번도 못 만남)은 4단계 이상 기록이 있으면 인증했던 폰으로 봄 (인증해야만 칠 수 있어서)
  if (!state.api || CONFIG_STATIC()) return false;
  // 2026-11-22 사용자 요청: 서버가 쉬는 동안엔 누구나 전부 열림 (인증 창 때문에 릴스에 「쿵」 댓글·DM 이 쏟아져서)
  return true;
}
/** 처음부터 서버 없이 배포된 사이트(정적 호스팅)인가 */
const CONFIG_STATIC = () => CONFIG.apiMode === 'mock';
const CONFIRM_WHAT = VERIFY_WHAT;
/** 인증 완료 전엔 잠긴 것 (4단계부터, 무제한 전부). 개발용 ?gate=open 에선 풀림 */
const closedLocked = (id) => state.cfg.gateMode !== 'open' && isClosed(id) && !isConfirmed() && !freePass();
/** 인스타 댓글에 쓸 키워드 (키티챗 자동 DM 키워드와 같아야 함) */
const VERIFY_KEYWORD = '쿵';
/** 🆓 암호 없이 임시 인증 기간 (인스타 DM 이 막혔을 때, 서버 설정 freePassUntil). 끝나면 팔로워 암호로 다시 인증 */
// 서버 설정을 못 받았을 때(서버가 쉬는 중)는 폰에 기억한 값, 그것도 없으면 서버 기본값(11/26 23:59 KST)
const FREE_PASS_DEFAULT = Date.UTC(2026, 10, 26, 14, 59, 59);
const freePassUntilNow = () => state.cfg.freePassUntil ?? load('freePassUntil', null) ?? FREE_PASS_DEFAULT;
const freePass = () => { const u = freePassUntilNow(); return !!(u && Date.now() < u); };
const freePassDay = () => {
  const d = new Date(freePassUntilNow());
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

function openVerify(id, { pass = '', label = '', then = null, restore = false } = {}) {
  state.verifyRestore = restore;
  state.verifyFor = id ?? state.verifyFor ?? null;
  // 인증하면 이어서 할 일 (멀티 창 열기·건의하기 등)
  state.verifyThen = then;
  const lv = label ? { label } : id == null ? null : id === ENDLESS_ID ? { label: '💎 무제한 모드 · 그리그' } : levelEndlessBase(id) ? { label: `💎 ${levelEndlessBase(id).id}단계 무제한 · ${levelEndlessBase(id).name}` } : getLevel(id) ? { label: `${levelLabel(id)} · ${getLevel(id).composer} ${getLevel(id).name}` } : null;
  $('#verify-level').hidden = !lv;
  if (lv) $('#verify-level').textContent = lv.label;
  const done = isConfirmed() && !restore;
  const free = freePass() && !restore && !done;
  // 임시 인증 기간이 끝나 다시 잠긴 사람
  const tempOver = !done && !restore && !freePass() && !!load('wasTemp', false);
  $('#verify-mascots').innerHTML = buddiesHTML('cheer', done ? 'cheer' : 'idle');
  $('#verify-title').textContent = restore ? '예전 기록 되찾기' : done ? (state.me.temp && freePass() ? '이용 가능해요!' : '팔로워 인증 완료!') : freePass() ? '이용 등록' : '팔로워 인증';
  $('#verify-desc').innerHTML = restore
    ? `예전 주소(kongkong-drum.vercel.app)에서 <b>팔로워 인증</b>을 받았던 분은, 그때 쓴 <b>인스타 아이디</b>와 <b>팔로워 암호</b>를 넣으면 랭킹 닉네임·점수·깬 단계를 되찾아요.`
    : done
    ? state.me.temp && freePass()
      ? `🎉 <b>${freePassDay()}</b>까지 전부 이용할 수 있어요. 그 뒤엔 팔로우 인증을 다시 받아야 해요.`
      : `이미 인증됐어요 🎉 잠긴 단계와 💎 무제한 모드가 전부 열려 있어요.`
    : free
    ? `📢 인스타 DM 이 잠시 막혀서, <b>${freePassDay()}까지는</b> 닉네임·인스타 아이디만 적으면 전부 이용할 수 있어요!<br>그 뒤에는 <b>팔로우 인증을 다시 받아야</b> 해요.`
    : tempOver
    ? `이용 기간이 끝났어요. 「${VERIFY_KEYWORD}」 댓글을 달고 DM 으로 받은 <b>팔로워 암호</b>로 팔로우 인증을 다시 받으면 계속 쓸 수 있어요 (기록은 그대로).`
    : `1~${FREE_UPTO}단계는 맛보기! <b>${VERIFY_WHAT()}</b>는 ${igWho()} 팔로워 인증을 받으면 전부 열려요.<br>랭킹에도 인증한 사람만 올라가요.`;
  const step = (n, text) => `<li class="${done ? 'done' : ''}"><b>${done ? '✓' : n}</b><span>${text}</span></li>`;
  $('#verify-steps').innerHTML = free
    ? [step(1, '아래에 닉네임·인스타 아이디 적기'), step(2, `<b>시작하기</b> → ${freePassDay()}까지 전부 이용 가능`)].join('')
    : [
    step(1, `${atHandle()} <b>팔로우</b>하기`),
    step(2, `아무 게시물·릴스에 <b>「${VERIFY_KEYWORD}」</b> 댓글 달기`),
    step(3, `DM 이 오면 <b>버튼</b>을 눌러 <b>팔로워 암호</b> 받기`),
    step(4, '아래에 암호를 적고 <b>인증하기</b>'),
  ].join('');
  $('#verify-pass-row').hidden = free;
  $('#verify-submit').textContent = free ? '시작하기' : '인증하기';
  const url = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  $('#verify-acts').innerHTML = done ? '' : `<a class="btn btn-insta" href="${url}" target="_blank" rel="noopener">${icon('insta')} ${free ? '팔로우하러 가기' : '팔로우 · 댓글 달러 가기'}</a>`;
  const me = state.me || {};
  const hasName = !!(me.guest && me.player && me.player.username);
  const hasIg = !!(hasName && me.player.ig && !me.hidden);
  $('#verify-form').hidden = done;
  $('#verify-note').hidden = done || free;
  // 되찾기: 닉네임은 '아이디를 대충 적었을 때' 같이 찾는 용도 (안 적어도 됨)
  $('#verify-name-row').hidden = hasName && !restore;
  $('#verify-ig-row').hidden = hasIg && !restore;
  $('#verify-name-hint').textContent = restore ? '예전 랭킹 닉네임 · 아이디가 헷갈리면 같이 적어요' : '2~12자 · 랭킹에 보여요';
  $('#verify-name').value = hasName ? me.player.username : load('lastNick', '');
  $('#verify-ig').value = (me.player && me.player.ig) || load('lastIg', '');
  if (pass) $('#verify-pass').value = pass;
  $('#verify-err').hidden = true;
  $('#verify-req').hidden = true;
  $('#a2hs-inapp').hidden = !isInApp();
  openModal('modal-verify');
}

async function submitVerify() {
  const err = (t) => {
    $('#verify-err').textContent = t;
    $('#verify-err').hidden = false;
  };
  $('#verify-err').hidden = true;
  $('#verify-req').hidden = true;
  const body = { password: $('#verify-pass').value.trim() };
  if (state.verifyRestore) body.restore = true;
  if (!$('#verify-name-row').hidden && !(state.verifyRestore && !$('#verify-name').value.trim())) {
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
  const free = freePass() && !state.verifyRestore;
  if (free) delete body.password;
  else if (!body.password) return err('DM 으로 받은 팔로워 암호를 적어 주세요.');
  if (!(await reconnectServer({ force: true }))) return err('지금은 서버에 연결이 안 돼서 인증할 수 없어요. 잠시 후 다시 해 주세요.');
  const btn = $('#verify-submit');
  btn.disabled = true;
  try {
    const { restored, bests, ...me } = await state.api.verifyPassword(body);
    state.me = me;
    if (bests && Object.keys(bests).length) save('bests', mergeBests(loadBests(), bests));
    if (body.name) save('lastNick', body.name);
    if (body.ig) save('lastIg', body.ig);
    $('#verify-pass').value = '';
    closeModal('modal-verify');
    refreshTitle();
    refreshFollowChip();
    renderLevels();
    save('wasTemp', !!me.temp);
    if (me.temp) toast(`🎉 ${freePassDay()}까지 전부 이용할 수 있어요! 그 뒤엔 팔로우 인증을 다시 받아야 해요`, 4600);
    else if (restored) toast(`📦 예전 기록을 되찾았어요! 「${restored.username}」 계정${restored.levels ? ` · ${restored.levels}개 단계` : ''} 그대로예요`, 4200);
    else if (state.verifyRestore) toast('이 인스타 아이디로 된 예전 랭킹 기록은 없었어요. 인증은 완료!', 3600);
    else toast(`🎉 팔로워 인증 완료! 잠긴 단계·💎 무제한·멀티·건의하기가 전부 열렸어요`, 3600);
    state.verifyRestore = false;
    submitRank();
    state.verifyFor = null;
    const then = state.verifyThen;
    state.verifyThen = null;
    if (then) setTimeout(then, 400);
  } catch (e) {
    const c = e.data && e.data.error;
    if (state.verifyRestore && (c === 'no_old' || c === 'bad_name' || c === 'need_password')) $('#verify-req').hidden = false;
    err(
      c === 'need_password' ? '예전 기록 되찾기는 팔로워 암호가 있어야 해요. 지금은 인스타 DM 이 막혀 있어서, 아래 「되찾기 요청」으로 보내 주세요.'
        : c === 'wrong_password' ? '암호가 달라요. DM 속 암호를 다시 확인해 주세요. (암호는 매주 바뀌어요)'
        : c === 'rate_limited' || e.status === 429 ? '너무 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요.'
        : c === 'bad_ig' ? '인스타 아이디를 정확히 써 주세요.'
        : c === 'no_old' || (c === 'bad_name' && state.verifyRestore)
          ? '예전 기록을 못 찾았어요. 예전 랭킹 닉네임도 같이 적어 보세요. 그래도 안 되면 아래 「되찾기 요청」을 보내 주세요 — 운영자가 찾아 드려요.'
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
  const sb = levelSurvivalBase(id);
  if (sb) return makeLevelEndless(sb, { intro: true });
  const eb = levelEndlessBase(id);
  if (eb) return makeLevelEndless(eb);
  if (typeof id === 'string' && /^ch\d+$/.test(id)) return makeEndless({ rounds: Number(id.slice(2)) });
  if (id === BEAT_ID) {
    const o = load('beatReel', null) || {};
    return withSync(makeBeatReel({ ...o, bars: songBars(beatOpts(o)) }));
  }
  if (isQuizId(id)) return makeQuizLevel(id);
  if (id === MY_ID) return my.level;
  if (id === UM_ID) return um.level;
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
    : `${h && h.prev ? h.prev : prevOpenId(id)}단계를 별 1개 이상으로 깨면 ${id}단계가 열려요`;
}
const LOCK_FROM_PREV = (id) => (id === ENDLESS_ID ? `${ENDLESS_FROM}단계 깨면 열림` : (unlockHint(id, loadBests()) || { short: `${prevOpenId(id)}단계 깨면 열림` }).short);
const CLOSED_META = () => `<span class="lockline">${icon('lock')} 팔로워 암호</span>`;

// ---------------- 타이틀 ----------------
function buildTitle() {
  const scene = $('#title-scene');
  const timers = {};
  scene.querySelectorAll('.buddy').forEach((el) => {
    const who = el.classList.contains('buddy-kong') ? 'kong' : 'jjak';
    el.querySelector('.b-drum').src = buddyUrl('drum_' + who);
    const ch = el.querySelector('.b-char');
    ch.src = buddyUrl(who + '_idle');
    const bub = el.querySelector('.b-bubble');
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      await audio.unlock();
      if (who === 'kong') audio.kick();
      else audio.snare();
      bub.textContent = who === 'kong' ? '쿵!' : '짝!';
      for (const x of [el, bub]) x.classList.remove(x === el ? 'hit' : 'show');
      void el.offsetWidth;
      el.classList.add('hit');
      bub.classList.add('show');
      ch.src = buddyUrl(who + '_hit');
      clearTimeout(timers[who]);
      timers[who] = setTimeout(() => {
        ch.src = buddyUrl(who + '_idle');
        el.classList.remove('hit');
      }, 260);
    });
  });
  // 미리 받아 둠 (눌렀을 때 바로 바뀌게)
  loadBuddies();
  refreshQuick();
}

/** 결과·인증 화면용 쿵콩이·짝콩이 그림 */
function buddiesHTML(face, face2 = face) {
  return `<img alt="" src="${buddyUrl('kong_' + face)}" /><img alt="" src="${buddyUrl('jjak_' + face2)}" />`;
}

/** '바로 시작': 릴스 링크(?level=N)로 온 곡이 열려 있으면 그 곡, 아니면 아직 안 깬 첫 단계 */
function refreshQuick() {
  const q = getLevel(params.get('level'));
  const id = q && !progressLocked(q.id) && !closedLocked(q.id) ? q.id : nextChallenge(loadBests());
  state.quickId = id;
  $('[data-action="quickstart"]').innerHTML =
    id === ENDLESS_ID ? `${icon('play')} 바로 시작 <small>무제한 모드</small>` : `${icon('play')} 바로 시작 <small>${levelLabel(id)}</small>`;
}

/** 🔥 오늘의 챌린지: 오늘의 노래(이 폰에서 열 수 있는 곡 중) + 미션 + 연속 성공 */
const todayPick = () => todayLevel(new Date(), (id) => !closedLocked(id));
const todayMissionNow = () => { const lv = todayPick(); return { lv, mission: todayMission(noteCount(lv)) }; };

function refreshToday() {
  const { lv, mission } = todayMissionNow();
  const st = streakView(load('daily', null));
  $('#today-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#today-sub').textContent = st.doneToday ? `✅ 오늘 성공! · ${levelLabel(lv)}` : `🎯 ${mission.text} · ${levelLabel(lv)}`;
  $('#today-streak').textContent = st.streak ? `🔥 ${st.streak}일 연속` : '';
  const chip = $('#daily-chip');
  if (chip) {
    chip.classList.toggle('done', st.doneToday);
    chip.innerHTML = `<b>🔥 오늘의 챌린지</b><span>${st.doneToday ? '✅ 성공' : escapeHtml(mission.text)}${st.streak ? ` · ${st.streak}일 연속` : ''}</span><i>›</i>`;
  }
}

/** 결과 화면: 오늘의 노래를 쳤으면 미션 성공/남은 미션 표시 */
function showDailyResult(res) {
  const box = $('#res-daily');
  box.hidden = true;
  if (state.auto || res.practice || res.room) return;
  const { lv, mission } = todayMissionNow();
  if (String(res.levelId) !== String(lv.id)) return;
  const rec = load('daily', null);
  if (missionDone(mission, res)) {
    const { rec: next, isNew } = markDone(rec);
    if (isNew) save('daily', next);
    box.innerHTML = `🔥 오늘의 챌린지 성공!${next.streak > 1 ? ` <b>${next.streak}일 연속</b>` : ''}<small>내일 또 새 미션이 나와요</small>`;
    box.className = 'res-daily ok';
  } else if (!streakView(rec).doneToday) {
    box.innerHTML = `🎯 오늘의 챌린지: ${escapeHtml(mission.text)}<small>다시 해 보세요!</small>`;
    box.className = 'res-daily';
  } else return;
  box.hidden = false;
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
      : (!me.guest || me.needsIg || !me.confirmed) && freePass()
        ? `📝 이용 등록 · 랭킹 참여`
        : !me.guest || me.needsIg
        ? `📸 팔로워 인증 받기 · 랭킹 참여`
        : me.confirmed && me.temp && freePass()
          ? `✅ ${freePassDay()}까지 이용 가능`
          : me.confirmed
          ? `✅ @${me.player?.ig || ''} 팔로워 인증 완료`
          : `📸 팔로워 인증 받기 · 랭킹 참여`;
  }
}

function refreshTitle() {
  refreshFollowChip();
  syncCoinAccount();
  refreshCoins();
  // 🆓 임시 인증 기간 안내 (인스타 DM 막힘)
  const fp = $('#free-pass-note');
  fp.hidden = !(state.api && state.api.mode === 'server' && freePass());
  if (!fp.hidden) fp.querySelector('span').innerHTML = `인스타 DM 이 잠시 막혀서 <b>${freePassDay()}까지는</b> 4단계부터·무제한·멀티 전부 이용할 수 있어요! 그 뒤엔 팔로우 인증을 다시 받아야 해요.`;
  // 멀티·건의하기는 팔로워 인증한 사람만 → 안 했으면 🔒
  const lockMark = followGated() ? '🔒 ' : '';
  $('.mode-multi b').innerHTML = `${icon('swords', true)} ${lockMark}멀티`;
  $('[data-action="suggest-open"] span:not([data-icon])').textContent = `${lockMark}건의하기`;
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
  const m = load('levelMode', 'normal');
  return m === 'endless' || m === 'long' ? m : 'normal';
}

// ---------------- 🎭 장거리: 곡 하나를 처음부터 끝까지 (왼손 쿵 + 오른손 피아노 멜로디) ----------------
function renderLongLevels() {
  const bests = loadBests();
  $('#level-list').innerHTML = LEVELS.filter((l) => l.long)
    .map((lv) => {
      const vLock = closedLocked(lv.id) || verifyLocked(lv.id);
      const b = bests[lv.id];
      const meta = vLock
        ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
        : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
      return `<button class="level-card long-card ${vLock ? 'locked' : ''}" data-level="${lv.id}">
      <div class="lv"><span class="ev">${icon('hall', true)}<small>장거리</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.sub ? `${lv.sub} · ` : ''}${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
    })
    .join('');
  refreshToday();
  $('#levels-foot').innerHTML = '🎭 장거리는 곡 하나를 <b>처음부터 끝까지</b> 쳐요.<br>왼쪽 엄지는 <b>쿵</b>, 오른쪽 엄지는 <b>멜로디</b> — 누를 때마다 그 음이 <b>피아노</b>로 나요. 놓치면 그 음은 안 들려요!';
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
  return `<div class="level-group theme-${g.key}" role="presentation">${icon(g.theme.icon, true)}<b>${g.key === 'xmas' ? '크리스마스 이벤트' : g.theme.name}</b><small>${g.key === 'xmas' ? '기간 한정 특별 곡' : `${g.from}~${g.to}단계 맵`}</small></div>`;
}

function renderEndlessLevels(bests) {
  const list = [grieggCardHTML(bests)];
  for (const lv of MAIN_LEVELS) {
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
  $('#levels-foot').innerHTML = `${isConfirmed() || freePass() ? '' : `🔒 💎 무제한 모드는 <b>${igWho()} 팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}12단계를 깨면 그리그 무제한이 열려요. 목숨이 다 떨어질 때까지 계속!<br>단계별 무제한은 그 단계를 깨면 열려요.<br>💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어`;
}

function renderLevels() {
  const bests = loadBests();
  const mode = levelMode();
  $$('#level-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  if (mode === 'endless') {
    renderEndlessLevels(bests);
    return;
  }
  if (mode === 'long') {
    renderLongLevels();
    return;
  }
  // 🎄 크리스마스 이벤트 곡은 맨 위에
  const list = [...LEVELS.filter((l) => l.xmas), ...LEVELS.filter((l) => !l.xmas && !l.long)].map((lv) => {
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
    const fresh = lv.newUntil && Date.now() < Date.parse(`${lv.newUntil}T23:59:59+09:00`);
    return `${groupHeadHTML(lv.id)}<button class="level-card ${locked ? 'locked' : ''} ${lv.boss ? 'boss' : ''} ${lv.xmas ? 'xmas' : ''} ${lv.extreme ? 'extreme' : ''}" data-level="${lv.id}">
      ${fresh ? '<span class="newtag">NEW</span>' : ''}
      <div class="lv">${lv.xmas ? `<span class="ev">${icon('tree', true)}<small>이벤트</small></span>` : `<span>${lv.id}<small>단계</small></span>`}</div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}${lv.extreme ? '<span class="extreme-chip">☠ 게임에서 제일 어려움</span>' : ''}</div>
      <div class="meta">${meta}</div>
    </button>`;
  });
  // 맨 아래: 그리그 무제한 모드 (12단계 깨면 열림)
  list.push(grieggCardHTML(bests));
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() || freePass() ? '' : `🔒 1~${FREE_UPTO}단계는 맛보기! ${FREE_UPTO + 1}단계부터와 💎 무제한은 <b>팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요.<br><b>같은 난이도를 하나 깨면 그 난이도는 전부 열려요</b> (예: 지옥 하나 깨면 지옥 전부)<br>별 3개: ${STAR_RULES[0].text}`;
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
const CANVAS_TEXT = '도레미파솔라시#멜로디쿵짝챙츠둥왼쪽오른엄지킥스네어하이햇크래시탐연타황금콩다가온선에닿을때그줄을톡여기눌러도OK키클릭NEW노을피크닉네온시티콘서트홀블랙스테이지용암보스전오로라설원우주무대크리스마스마을GROOVECOMBO점';
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
/** 🐢 느리게 연습: 같은 채보를 rate 배 빠르기로 (목숨·기록·랭킹 없음) */
/** 🎲 랜덤 대결 N곡째 빠르기: 1곡째 그대로, 한 곡마다 +7%, 최대 1.5배 */
function rushSpeed(round) {
  return Math.min(1.5, 1 + 0.07 * Math.max(0, (round | 0) - 1));
}
function practiceLevel(lv, rate) {
  return { ...lv, bpm: Math.round(lv.bpm * rate * 10) / 10, practice: rate };
}
/** 연습으로 칠 수 있는 판인가 (일반 단계만. 무제한·멀티·영상 찍기 X) */
const canPractice = (lv) => !!lv && !lv.challenge && !lv.studioOnly && !lv.custom && !state.studio.active && !document.body.classList.contains('room-game') && !state.auto;

async function startLevel(id, opts = {}) {
  const base = playable(id);
  if (!base) return;
  const practice = !opts.room && opts.practice && canPractice(base) ? opts.practice : 0;
  state.practice = practice;
  // 🎲 랜덤 대결: 곡이 넘어갈수록 빨라짐 (두 사람 다 round 로 같은 빠르기)
  const rushRate = opts.room && opts.room.rush ? rushSpeed(opts.room.round) : 1;
  let lv = practice ? practiceLevel(base, practice) : rushRate > 1 ? { ...base, bpm: Math.round(base.bpm * rushRate * 10) / 10 } : base;
  if (state.studio.active && isFailFormat() && typeof lv.id === 'number' && !lv.challenge) lv = failLevel(lv);
  // 친구 대결 방 판: { startAt(내 시계 ms), mode } — 같은 시각에 시작, 랭킹엔 안 올림
  // 🏆 랭킹전 판: 실시간 { startAt(내 시계 ms), mode, round } / 고스트 { ghost, gid } — 랭킹엔 안 올림
  const room = opts.room || null;
  const live = !!room && !room.ghost;
  document.body.classList.toggle('room-game', !!room);
  // 처음 한 번은 박자 보정을 꼭 하고 시작 (영상 찍기·자동 연주는 제외. 대결 방은 '준비' 전에 미리 함)
  if (!room && needsCalibration()) {
    openCalibration({ required: true, after: () => startLevel(id, opts) });
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
  $('#hud-lv').textContent = practice ? `🐢 연습 ${Math.round(practice * 100)}%` : lv.userMap ? '🎹 유저 맵' : lv.custom ? '🎵 내 노래' : lv.survival ? '⚔️ 서바이벌' : lv.challenge ? (lv.endless ? '무제한' : '챌린지') : lv.studioOnly ? '🎬 릴스용' : levelLabel(lv);
  $('#hud-name').textContent = lv.challenge ? `${lv.songName} · ${lv.composer}` : `${lv.name} · ${lv.composer}`;
  if (room && room.rush) $('#hud-lv').textContent = `🎲 ${room.round}곡째${rushRate > 1 ? ` · ⚡${rushRate.toFixed(2).replace(/0$/, '')}배` : ''}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  closeModal('modal-continue');
  const st = state.studio;
  renderLives(st.active || state.auto || practice || lv.custom ? null : MAX_LIVES);
  const vs = room && room.ghost ? room.ghost : !room && !st.active && !practice && !lv.challenge && state.vs && state.vs.levelId === id ? state.vs : null;
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
  // 🎤 녹음된 곡(노래 파일)은 다 받아야 시작 (못 받으면 단계 고르기로)
  if (lv.song && lv.song.audio && !audio.trackBuffer(lv.song.audio.src)) {
    toast('🎤 노래 받는 중…', 2500);
    const buf = await audio.loadTrack(lv.song.audio.src);
    if (stale()) return;
    if (!buf) {
      show('screen-levels');
      toast('노래를 받지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요', 3000);
      return;
    }
  }
  $('#screen-game').classList.toggle('studio-mode', st.active);
  renderer.studio = st.active ? studioOverlay(lv) : null;
  renderer.studioSkin = st.active && st.skin !== false;
  setKit(lv);
  await fontsReady(renderer.studio ? `${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}` : '');
  await new Promise((r) => requestAnimationFrame(r));
  const cw = $('#game-canvas').clientWidth || window.innerWidth;
  await renderer.resize(st.active ? Math.min(3, Math.max(2, 1080 / cw)) : 2);
  if (stale()) return;
  awardRunCoins(state.game); // 판 도중에 다시 시작하면 그때까지 맞힌 만큼 (새 판 토큰을 받기 전에)
  if (state.game) state.game.stop();
  state.runToken = null;
  // 영상 찍기는 팔로우 잠금 없이 (계정 주인이 촬영용으로 씀) → 서버 판 토큰도 안 받음
  // 인증 안 한 사람이 1~3단계를 칠 땐 랭킹에 못 올리니 판 토큰도 안 받음 (서버 요청 아끼기, 통계는 5분마다 따로 감)
  // 서버 없는 모드면 가끔 다시 붙어 봄 (간격은 reconnectServer 가 정함, 기다리지 않음)
  if (state.api && state.api.mode !== 'server') reconnectServer();
  const canRank = isConfirmed() || state.cfg.gateMode === 'open' || isClosed(id);
  syncCoinAccount();
  if ((!lv.challenge || lv.endless) && !st.active && !room && !practice && !lv.custom && canRank) state.api
    .startRun(id)
    .then((r) => {
      state.runToken = r.runToken;
      if (state.game && state.game.level.id === id && !state.game._coined) state.game._runToken = r.runToken;
    })
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
  const last = { score: -1, p: -1, op: -1, lives: MAX_LIVES, stars: -1, shown: -1 };
  // 실시간 대결: 상대 점수는 몇 초 늦게 옴 → 내 점수도 '상대가 보낸 진행 위치' 때의 점수로 보여 줘야 같은 지점끼리 비교됨
  const myHist = []; // [진행, 점수] (진행 순)
  const myScoreAt = (p) => {
    let lo = 0, hi = myHist.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (myHist[mid][0] <= p) { ans = myHist[mid][1]; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };
  $('#hud-coin').textContent = '0';
  $('#hud-coin-box').hidden = !!(state.auto || st.active);
  renderer.coinFx = !(state.auto || st.active);
  renderer.coinPerfectOnly = !!lv.userMap; // 🎹 유저 맵: PERFECT 때만 코인 하나
  const starBox = $('#hud-stars');
  starBox.hidden = !!lv.endless;
  starBox.innerHTML = starsHTML(0);
  state.game = new Game({
    // 🖐 쌍 하나만 쳐도 하트 그대로(2026-11-24)는 혼자 하는 판만 — 멀티는 살아남기가 승부라 예전 그대로 (무제한·챌린지는 game 이 알아서 뺌)
    pairHeart: room ? false : undefined,
    audio,
    renderer,
    level: lv,
    settings: state.settings,
    auto: state.auto,
    onHud: (h) => {
      if (h.score !== last.score) $('#hud-score').textContent = fmt(h.score);
      const cn = runCoins(state.game);
      if (cn !== last.coins) {
        const el = $('#hud-coin');
        el.textContent = fmt(cn);
        // 통통 튐: 튀는 중이면 그냥 둠 (예전엔 맞힐 때마다 offsetWidth 로 화면 배치를 강제로 다시 계산 → 빽빽한 곳에서 프레임마다)
        const box = el.parentNode;
        if (cn > (last.coins || 0) && !box.classList.contains('bump')) {
          box.classList.add('bump');
          setTimeout(() => box.classList.remove('bump'), 360);
        }
        last.coins = cn;
      }
      const p = Math.round(h.progress * 200);
      if (p !== last.p) $('#hud-progress').style.width = p / 2 + '%';
      if (live) {
        // 내 점수는 다음 주고받기 때 같이 감 (2초마다), 상대 점수는 받은 값
        state.roomClient.send({ live: { score: h.score, combo: state.game ? state.game.combo : 0, progress: h.progress, lives: h.lives } });
        const o = state.roomClient.other;
        const op = o && o.final ? o.final.score : o && o.live ? o.live.score : 0;
        // ⚔️ 개인전: 상대가 목숨을 다 써서 끝났거나 방을 나갔으면 이 판도 바로 끝 → 내가 이김
        //   (무제한 서바이벌은 곡 끝이 없으니 상대 판이 끝났다는 건 쓰러졌다는 것)
        const opDown = !o || (o.left && !o.final) || (o.final && (lv.survival || o.final.died));
        if (room.mode === 'versus' && opDown && state.game && state.game.state === 'playing') {
          state.game.endNow();
          return;
        }
        const rtNow = state.roomClient.realtime;
        if (rtNow !== last.rt) {
          $('#vs-name').textContent = (rtNow ? '⚡' : '') + roomOtherName();
          last.rt = rtNow;
        }
        const seq = !lv.endless && !lv.roundProgress;
        if (seq && (!myHist.length || h.progress > myHist[myHist.length - 1][0])) myHist.push([h.progress, h.score]);
        else if (seq && myHist.length) myHist[myHist.length - 1][1] = h.score;
        // 상대가 끝냈으면(final) 지금 내 점수, 아니면 상대가 보낸 진행 위치 때의 내 점수
        const me = seq && o && !o.final && o.live && o.live.progress < h.progress ? myScoreAt(o.live.progress) : h.score;
        if (op !== last.op || me !== last.shown) {
          $('#vs-me').textContent = fmt(me);
          const ol = o && o.live && o.live.lives != null ? ` ♥${o.live.lives}` : '';
          $('#vs-op').textContent = room.mode === 'team' ? `${fmt(op)} · 팀 ${fmt(h.score + op)}` : fmt(op) + ol;
          const tot = me + op;
          $('#vs-fill').style.width = (tot ? (me / tot) * 100 : 50).toFixed(1) + '%';
          last.shown = me;
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
      res.coins = awardRunCoins(state.game);
      if (lv.custom) return lv.userMap ? umFinish(res) : myFinish(res);
      if (room) rk.game = null;
      if (!state.studio.active && !res.auto && !res.practice) trackPlayEnd({ result: res.failed || res.died ? 'fail' : 'clear', score: res.score, stars: res.stars });
      if (room && room.ghost) res.room = { mode: 'versus', ghost: room.ghost, gid: room.gid };
      if (live && state.roomClient.active) {
        res.room = { mode: room.mode, round: room.round, ranked: !!room.ranked, rush: !!room.rush };
        state.roomClient.send(
          { final: { score: res.score, stars: res.stars, grade: res.grade, failed: !!res.failed, maxCombo: res.maxCombo, accuracy: res.accuracy, died: !!(res.died || res.failed), survived: res.survived || 0, lv: res.roundReached || 0 } },
          true
        );
      }
      return state.studio.active ? studioFinish(res) : showResult(res);
    },
    // 영상 찍기 땐 목숨 없음 (녹화 중에 멈추면 안 되니까). 멀티는 광고 이어하기 없이 그 자리에서 끝
    // 🐢 연습은 목숨 없이 끝까지
    onDeath: st.active ? (lv.failReel ? studioFailDeath : null) : practice ? null : lv.userMap && um.from === 'list' && um.mode === 'hearts' ? umDeath : lv.custom ? null : room ? onRoomDeath : onDeath,
  });
  if (live) {
    // 상대와 같은 시각에 시작: 남은 시간 카운트다운 (Game.start 가 0.35초 뒤에 첫 박을 놓음)
    const box = $('#studio-count');
    box.hidden = false;
    $('#studio-count-msg').textContent = room.rush ? `🎲 ${room.round}곡째${rushSpeed(room.round) > 1 ? ` (⚡${Math.round(rushSpeed(room.round) * 100)}% 빠르기)` : ''}! ${roomOtherName()} 님과 대결` : room.ranked ? `🏆 ${roomOtherName()} 님과 랭킹전!` : room.mode === 'team' ? '🤝 팀전! 둘이 같이 깨 봐요' : `⚔️ ${roomOtherName()} 님과 대결!`;
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
  const sg = state.game;
  sg.onStall = () => {
    // 소리 시계가 멈춰도 게임은 화면 시계로 계속 감 (game._virt) → 안내만 가끔
    if (Date.now() - stallToastAt < 10000) return;
    stallToastAt = Date.now();
    toast('🔇 폰이 소리를 잠깐 멈췄어요. 화면을 톡 누르면 소리가 다시 나요', 3000);
  };
  // 🎵 내 노래: 녹화 버튼을 켰으면 시작과 같이 녹화
  if (lv.custom && !lv.userMap && my.rec) {
    await stopRecorder(); // 다시 치기: 앞 판 녹화가 남아 있으면 버림
    startRecorder();
  }
  if (state.runToken && !state.game._runToken) state.game._runToken = state.runToken;
  state.game.start();
  if (lv.synced && st.active) scheduleSyncRec(state.game);
  // 영상 찍기·자동 연주·내 노래는 통계에 안 셈
  if (!st.active && !state.auto && !practice && !lv.custom) trackPlayStart(lv.survival ? lv.baseId : id, vs || room ? 'vs' : 'normal');
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  canvasRect = null;
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
  applyDeco();
  // 🎨 유저 맵: 만든 사람이 고른 드럼·콩 색 — 치는 사람이 상점에서 장착한 게(세트 포함) 있으면 그게 먼저. 무대는 lv.theme 으로
  const md = lv.userMap && lv.deco;
  if (md && !renderer.uiStyle && !renderer.studio) {
    if (md.kit && !renderer.kitPick) renderer.kitPick = md.kit;
    if (md.notes && decoPick('notes') === DECO_FREE.notes) applyNoteColors(md.notes);
  }
  renderer.setTheme(lv); // 단계 묶음마다 맵 분위기가 다름 (themes.js)
  renderer.touchShow = !!load('touchShow', false);
  if (renderer.touchShow && !renderer.touchEnv) renderer.touchEnv = deviceLabel();
  renderer.touchMarks = [];
  renderer.touchCount = 0;
  renderer.touchHeld = [];
  if (renderer.touchDiag) Object.assign(renderer.touchDiag, { win: 0, can: 0, ptr: 0, end: 0, only: 0 });
  // 마우스·키보드 쓰는 컴퓨터면 줄마다 키 글자를 보여줌 (폰·태블릿은 안 보임)
  renderer.keyLabels = null;
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const letters = KEY_LABELS[renderer.laneOrder.length] || KEY_LABELS[2];
    renderer.keyLabels = {};
    renderer.laneOrder.forEach((lane, i) => (renderer.keyLabels[lane] = letters[i]));
  }
}

/**
 * 🖐 터치 표시용 기기 정보 (2026-11-24): 폰 종류·OS·브라우저를 터치 진단 숫자 밑에 한 줄로.
 *   아이폰은 한 엄지가 떨어지는 순간 다른 엄지가 닿으면 터치를 빠뜨림(CLAUDE.md 🍎) → iOS 버전 차이인지 영상으로 확인하려고.
 *   사파리 26 부터는 주소창 정보(UA)의 iOS 숫자가 18.6 으로 고정이라 사파리 버전도 같이 보여 줌. 인스타 안 브라우저는 기종 번호(iPhone15,2 등)도 나옴
 */
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const out = [];
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  const ipad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  // 사파리 26 부터 주소창 정보(UA)의 iOS 숫자는 18.x 로 고정 → 진짜 버전은 사파리 버전(= iOS 버전). 인스타는 자기 칸에 진짜 iOS 를 적음
  const safariV = ua.match(/Version\/(\d+)(?:\.(\d+))?/);
  const igV = ua.match(/; iOS (\d+)[_.](\d+)(?:[_.](\d+))?;/);
  let iosV = ios ? `${ios[1]}.${ios[2]}${ios[3] ? '.' + ios[3] : ''}` : '';
  if (igV) iosV = `${igV[1]}.${igV[2]}${igV[3] ? '.' + igV[3] : ''}`;
  else if (safariV && +safariV[1] >= 26) iosV = `${safariV[1]}.${safariV[2] || 0}`;
  else if (ios && +ios[1] === 18 && +ios[2] >= 6 && !safariV) iosV += '↑'; // 크롬 등: 고정된 숫자라 '이 버전 이상'
  if (ios) out.push(`${ipad ? 'iPad' : 'iPhone'} iOS ${iosV}`);
  else if (ipad) out.push('iPad');
  else if (android) out.push(`Android ${android[1]}`);
  const model = ua.match(/\((iPhone\d+,\d+|iPad\d+,\d+);/) || ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|;|\))/);
  if (model && model[1] !== 'K') out.push(model[1].trim());
  const safari = ua.match(/Version\/(\d+(?:\.\d+)?)/);
  if (/Instagram/i.test(ua)) out.push('인스타');
  else if (/KAKAOTALK/i.test(ua)) out.push('카톡');
  else if (/CriOS\/(\d+)/.test(ua)) out.push(`크롬 ${ua.match(/CriOS\/(\d+)/)[1]}`);
  else if (safari && (ios || ipad)) out.push(`사파리 ${safari[1]}`);
  else if (/Chrome\/(\d+)/.test(ua)) out.push(`크롬 ${ua.match(/Chrome\/(\d+)/)[1]}`);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (standalone) out.push('홈 화면');
  return out.join(' · ') || ua.slice(0, 40);
}

/** 누른 줄의 악기 (원근으로 비스듬한 줄 모양 그대로. 악기 그림을 정확히 안 눌러도 됨) */
//   캔버스 자리는 손가락을 새로 댈 때마다 다시 잼 (2026-11-24: 판 시작 때 한 번 잰 값을 계속 쓰면
//   아이폰에서 판 도중 화면이 밀릴 때(인스타 브라우저 툴바·스크롤) 줄 판정·터치 표시가 엉뚱한 데로 감)
let canvasRect = null;
function measureCanvas() {
  const r = $('#game-canvas').getBoundingClientRect();
  if (r.width > 0) {
    canvasRect = r;
    // 캔버스 크기가 그려 둔 크기와 다르면(resize 이벤트를 놓침) 다시 맞춤
    const L = renderer.L;
    if (L && !renderer.studio && (Math.abs(r.width - L.W) > 2 || Math.abs(r.height - L.H) > 2) && !measureCanvas.busy) {
      measureCanvas.busy = true;
      Promise.resolve(renderer.resize()).finally(() => (measureCanvas.busy = false));
    }
  }
  return canvasRect;
}
/** 화면 좌표 → 캔버스(그림) 좌표. 캔버스가 그린 크기와 잠깐 달라도 비율로 맞춤 */
function toCanvas(x, y) {
  const r = canvasRect || measureCanvas();
  if (!r) return { x, y };
  const L = renderer.L;
  const kx = L && r.width > 0 ? L.W / r.width : 1;
  const ky = L && r.height > 0 ? L.H / r.height : 1;
  return { x: (x - r.left) * kx, y: (y - r.top) * ky };
}
function laneFromPoint(x, y) {
  const p = toCanvas(x, y);
  return renderer.laneHit(p.x, p.y);
}

/** 화면 터치 → 게임 입력 (옆 줄 정보까지 넘겨서 경계 근처 터치를 봐줌) */
function tapAt(x, y, perfMs) {
  const { lane, near } = laneFromPoint(x, y);
  const r = state.game.input(lane, perfMs, near);
  // 🖐 터치 표시 (/?touch=show 기기만): 닿은 자리에 어느 줄·어떤 판정이었는지
  if (renderer.touchShow) {
    const p = toCanvas(x, y);
    renderer.markTouch(p.x, p.y, r, performance.now() / 1000);
  }
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
  // 폰·태블릿: 손가락마다 touchstart 의 changedTouches 로 바로 받음 (두 엄지가 거의 동시에 닿아도 하나씩 다 들어옴).
  //   2026-11-24: 터치의 pointerdown 도 같이 받음 — 일부 아이폰에서 같은 자리를 빨리 다시 누르면 터치가 안 들어온다는 신고.
  //   폰이 둘 중 하나만 보내도 치게 하고, 둘 다 오면(보통) 같은 자리·같은 시각 것은 한 번만 침 (seen)
  const diag = (renderer.touchDiag = { win: 0, can: 0, ptr: 0, end: 0, only: 0 });
  const seen = [];
  /** 이 터치를 쳐도 되나 (다른 쪽 이벤트로 이미 쳤으면 false). 짝이 안 온 채 지난 것 = 한쪽 이벤트로만 온 터치 → 세어 둠 */
  const fresh = (src, x, y, ts) => {
    while (seen.length && ts - seen[0].ts > 250) if (!seen.shift().both) diag.only++;
    const i = seen.findIndex((k) => k.src !== src && !k.both && Math.abs(k.x - x) < 3 && Math.abs(k.y - y) < 3 && Math.abs(k.ts - ts) < 80);
    if (i >= 0) {
      seen[i].both = true;
      return false;
    }
    seen.push({ src, x, y, ts, both: false });
    return true;
  };
  // ⚠ '시작을 본 적 없는 손가락이 touchmove·touchend 에 보이면 한 번 침'(orphans)은 넣었다가 뺌 (2026-11-24 밤):
  //   아이폰은 새 손가락의 touchstart 를 보내기 전에, 다른 손가락의 touchend·touchmove 의 touches 목록에 그 손가락을 먼저 넣어 보냄
  //   → 같은 터치를 두 번 쳐서 헛침 (운영자 폰 영상에서 20초에 3번). 다시 넣지 말 것
  /** 🖐 터치 표시: 지금 폰이 '누르고 있다'고 보는 손가락들 (뗐는데도 남아 있으면 폰이 뗀 걸 못 본 것) */
  const held = (e) => {
    if (!renderer.touchShow) return;
    renderer.touchHeld = Array.from(e.touches, (t) => toCanvas(t.clientX, t.clientY));
  };
  window.addEventListener('touchstart', (e) => (diag.win += e.changedTouches.length), { capture: true, passive: true });
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      measureCanvas();
      if (e.pointerType === 'touch') {
        diag.ptr++;
        if (!fresh('p', e.clientX, e.clientY, e.timeStamp)) return;
      }
      if (!e.isTrusted) state.game.fakeTaps++;
      try {
        tapAt(e.clientX, e.clientY, e.timeStamp);
      } catch {}
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      diag.can += e.changedTouches.length;
      measureCanvas();
      // 한 터치에서 오류가 나도 같이 온 다른 엄지 터치는 꼭 침 (두 엄지가 동시에 닿으면 한 이벤트에 같이 옴)
      for (const t of e.changedTouches) {
        if (!fresh('t', t.clientX, t.clientY, e.timeStamp)) continue;
        if (!e.isTrusted) state.game.fakeTaps++;
        try {
          tapAt(t.clientX, t.clientY, e.timeStamp);
        } catch {}
      }
      held(e);
    },
    { passive: false }
  );
  // 손가락 움직임(touchmove)은 터치로 안 셈 — 손가락을 새로 댄 것만 침 (2026-11-24).
  //   예전엔 '두 엄지를 폰이 한 손가락으로 합쳐 보낸다'고 보고 다른 줄로 넘어간 움직임을 새 터치로 셌는데(11-22·11-23),
  //   엄지를 떼며 굴리기만 해도 가짜 터치가 생겨 헛침·다음 콩 MISS 가 났음. 폰 자판도 두 엄지 빠른 입력을 따로 받으므로 합쳐짐은 드묾
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      held(e);
    },
    { passive: false }
  );
  // 뗄 때도 기본 동작을 막음 (아이폰이 빠른 두 번 터치를 '두 번 탭' 몸짓으로 보고 기다리지 않게)
  for (const ev of ['touchend', 'touchcancel'])
    canvas.addEventListener(
      ev,
      (e) => {
        if (e.cancelable) e.preventDefault();
        diag.end += e.changedTouches.length;
        held(e);
      },
      { passive: false }
    );
  ['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) =>
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
    if (!e.isTrusted) state.game.fakeTaps++;
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
    $('#pause-stuck').hidden = true;
    $('#pause-title').textContent = '잠깐 쉬어요';
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
    $('#cont-level').textContent = `${levelLabel(lv)} · ${lv.name}`;
    $('#cont-progress').style.width = `${Math.round(info.progress * 100)}%`;
    $('#cont-progress-text').textContent = `곡 ${Math.round(info.progress * 100)}% 까지 왔어요`;
  }
  $('#btn-continue').hidden = !info.canContinue;
  $('#cont-note').textContent = info.canContinue
    ? `광고를 끝까지 보면 목숨 ${REVIVE_LIVES}개로 바로 그 자리부터 이어서 쳐요 (한 판에 한 번)`
    : '이어하기는 한 판에 한 번이에요. 다시 도전해 보세요!';
  openModal('modal-continue');
}

/** ⚔️ 멀티: 목숨을 다 쓰면 이어하기(광고) 없이 바로 끝 → 결과 (상대 판도 이걸 받고 끝남) */
function onRoomDeath() {
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
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
function showResCoins(res) {
  const el = $('#res-coins');
  el.hidden = !(res.coins > 0);
  if (res.coins > 0) el.innerHTML = `<i class="coin-ico"></i> +${fmt(res.coins)} <small>모은 코인 ${fmt(getCoins())}</small>`;
}

function showResult(res) {
  if (state.suggestLite && !state.settings.lite) {
    state.suggestLite = false;
    setTimeout(() => toast('폰이 버거워해서 무대 효과를 줄였어요. 그래도 버벅이면 ⚙ 설정 → 저사양 모드', 4200), 2600);
  }
  res.runToken = state.runToken;
  state.lastResult = res;
  $('#res-offline').hidden = true;
  $('#res-daily').hidden = true;
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
  // 멀티에서 상대가 먼저 쓰러져 중간에 끝난 판(stopped)도 기록엔 안 남김
  const quiet = state.auto || !!res.practice; // 자동 연주·연습은 기록 안 남김
  const best = quiet || res.failed || res.stopped ? { isNew: false } : saveBest(res);
  // 이번 판으로 새로 열린 단계 알림
  if (!quiet && !res.failed && !res.stopped) {
    if (res.levelId === ENDLESS_FROM && !wasOpen.endless && !progressLocked(ENDLESS_ID)) setTimeout(() => toast('💎 무제한 모드가 열렸어요! 깰수록 빨라져요', 3200), 2600);
    else {
      // 같은 난이도를 하나 깨면 그 난이도가 전부 열림 → 여러 단계가 한 번에 열렸으면 그렇게 알림
      const opened = LEVELS.filter((l) => !wasOpen.levels.includes(l.id) && !progressLocked(l.id)).map((l) => l.id);
      if (opened.length > 1) setTimeout(() => toast(`🔓 ${opened[0]}~${opened[opened.length - 1]}단계가 한꺼번에 열렸어요!`, 3000), 2600);
      else if (opened.length === 1) setTimeout(() => toast(`🔓 ${opened[0]}단계가 열렸어요!`, 2600), 2600);
    }
  }
  $('#res-level').textContent = `${res.practice ? `🐢 연습 ${Math.round(res.practice * 100)}% · ` : ''}${levelLabel(lv)} · ${lv.composer} ${lv.name}`;
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
  showResCoins(res);
  showDailyResult(res);
  const badge = $('#res-badge');
  badge.hidden = !res.fullCombo;
  badge.textContent = res.counts.perfect === res.total && !res.counts.wrong ? 'ALL PERFECT' : 'FULL COMBO';
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.stars === 0 ? 'miss' : res.stars === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = buddiesHTML(face);
  const timing =
    Math.abs(res.avgOffsetMs) < 15 ? '타이밍 딱 좋아요' : res.avgOffsetMs < 0 ? `평균 ${-res.avgOffsetMs}ms 빨라요` : `평균 ${res.avgOffsetMs}ms 늦어요`;
  const extras = [res.goldTotal ? `✨ 황금 콩 ${res.goldHits}/${res.goldTotal}` : '', res.rollHits ? `💥 연타 ${res.rollHits}번` : ''].filter(Boolean).join(' · ');
  $('#res-meta').innerHTML = `정확도 ${(res.accuracy * 100).toFixed(1)}% · 최대 콤보 ${res.maxCombo} · ${timing}${extras ? '<br>' + extras : ''}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : res.practice ? '<br>(🐢 연습 — 기록·랭킹엔 안 남아요)' : ''}`;
  const next = getLevel(nextOpenId(lv.id));
  const nb = $('#btn-next');
  nb.hidden = false;
  if (next) nb.innerHTML = `다음 ${next.id}단계 ${progressLocked(next.id) ? icon('lock') : ''}`;
  else nb.innerHTML = `💎 무제한 모드 ${progressLocked(ENDLESS_ID) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = quiet || res.failed;
  // 끝까지 친 판은 알아서 랭킹에 올림 (점수 올라가는 연출이 끝날 즈음)
  if (!quiet && !res.failed && !res.room) setTimeout(() => submitRank(res), 1800);
  $('#btn-vs').hidden = quiet || res.failed;
  $('#btn-practice').hidden = !!res.room || state.auto;
  $('#btn-practice').textContent = res.practice ? '🐢 연습 빠르기 바꾸기' : '🐢 느리게 연습';
  // 박자가 계속 한쪽으로 밀리면 (블루투스 이어폰 등) 한 번에 맞추기
  const hits = (res.counts.perfect || 0) + (res.counts.great || 0) + (res.counts.good || 0);
  if (!state.auto && hits >= 8 && Math.abs(res.avgOffsetMs) >= 40) {
    const nextOffset = clampOffset(state.settings.offsetMs + res.avgOffsetMs);
    if (nextOffset !== state.settings.offsetMs)
      $('#res-meta').innerHTML += `<br><button class="btn btn-sm btn-ghost res-tune" data-action="tune-sync" data-offset="${nextOffset}">박자가 안 맞나요? 내 손에 맞게 자동 보정</button>`;
  }
  // 1:1 대결 결과
  const vs = !quiet && state.vs && state.vs.levelId === res.levelId ? state.vs : null;
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
  const sv = levelSurvivalBase(res.levelId); // ⚔️ 멀티 서바이벌: 기록·랭킹·다이아 안 남김
  const base = levelEndlessBase(res.levelId) || sv;
  const lv = base || getLevel(8);
  $('#btn-practice').hidden = true;
  const best = state.auto || sv ? { isNew: false } : saveBest(res);
  $('#res-level').textContent = sv ? `⚔️ 서바이벌 · ${sv.composer} ${sv.name}` : base ? `${base.id}단계 무제한 · ${base.composer} ${base.name}` : `무제한 모드 · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.remove('failed');
  const g = $('#res-grade');
  g.textContent = `Lv.${res.roundReached}`;
  g.style.color = '#FFD84A';
  const next = DIAMOND_RULES.slice().reverse().find((r) => r.diamonds > res.diamonds);
  $('#res-star-hint').innerHTML = sv
    ? `Lv.${res.roundReached} · ${res.bpmReached} BPM 까지 버텼어요`
    : res.diamonds === 3
      ? `다이아 3개! 진짜 드러머예요 💎💎💎`
      : `${res.roundsCleared ? `Lv.${res.roundsCleared}까지 클리어` : 'Lv.1부터 다시 도전!'} · 다음 💎: ${next.text}`;
  $('#res-new').hidden = !best.isNew;
  showResCoins(res);
  $('#res-badge').hidden = true;
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.diamonds === 0 ? 'miss' : res.diamonds === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = buddiesHTML(face);
  const prev = best.prev && !best.isNew ? ` · 내 최고 Lv.${best.prev.roundsCleared || 0} 클리어` : '';
  $('#res-meta').innerHTML = `최고 속도 ${res.bpmReached} BPM · 최대 콤보 ${res.maxCombo} · 정확도 ${(res.accuracy * 100).toFixed(1)}%${prev}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  $('#btn-next').hidden = true;
  // 무제한 모드는 랭킹이 따로 있어서 끝나면 알아서 올려요 (Lv.1 이상 깼을 때)
  $('#btn-rank').hidden = state.auto || !res.endless || !!sv;
  $('#btn-vs').hidden = true;
  show('screen-result');
  renderLevels();
  animateResult({ ...res, stars: sv ? 0 : res.diamonds }, null, true);
  if (!state.auto && res.endless && !sv) setTimeout(() => submitRank(res), 1800);
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
    if (res.fullCombo && !res.failed) audio.sfxFile(audio.uiSet === 'live' ? 'live2_clear' : 'cheer', 0.8); // 🔔 풀콤보 환호 (세트면 세트 소리)
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
  if (!r || r.auto || r.practice) return;
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
  const text = `${nick}의 1:1 도전장! ${CONFIG.appName} ${lv.name}(${lv.composer}) ${fmt(r.score)}점. 이길 수 있어?`;
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
  $('#vs-in-level').textContent = `${levelLabel(lv)} · ${lv.composer} ${lv.name}`;
  $('#vs-in-score').textContent = `${fmt(ch.score)}점`;
  $('#vs-in-stars').innerHTML = starsHTML(ch.stars);
  openModal('modal-vs');
}

/** 랭킹에 내 점수 올리기. 끝까지 친 판은 결과가 뜨면 알아서 올라가요 (닉네임이 있을 때) */
async function submitRank(r = state.lastResult) {
  // 무제한 모드는 목숨이 다해 끝나도 올림 (최소 Lv.1 은 깨야). 영상용 챌린지(ch4 등)는 안 올림
  // 무제한(그리그·단계별)은 곡마다 따로 랭킹
  const endless = !!r && (r.levelId === ENDLESS_ID || !!levelEndlessBase(r.levelId));
  if (!r || r.auto || r.practice || (r.challenge && !endless) || (r.failed && !endless) || r.submitted || r.submitting) return;
  if (endless && !(r.roundsCleared >= 1)) return;
  // 서버 없이 올린 사이트(apiMode mock)만 안 올림. 진짜 사이트가 서버 없는 모드(api.mode mock)일 땐 아래 keepOffline 으로 폰·서버 보관함에
  //   (2026-11-23: 예전엔 demoOnly() 만 봐서 서버가 쉬는 동안 친 기록이 저장도 안 되고 버려졌음)
  if (demoOnly() && CONFIG.apiMode === 'mock') return;
  // 📴 서버 없는 모드(DB 한도 초과 등)·판 토큰을 못 받은 판: 인증한 폰이면 최고 기록을 폰에 모았다가 서버가 돌아오면 올림
  const realTok = r.runToken && !String(r.runToken).startsWith('mock.');
  const keepOffline = () => {
    if (CONFIG.apiMode === 'mock' || !isConfirmed() || !queueOffline(r, endless)) return;
    r.submitted = true;
    // 폰에 저장 + 서버 보관함(Neon, D1 이 막혀도 받음)에도 맡김 → 결과 화면에 어디에 저장됐는지 보여 줌
    const box = $('#res-offline');
    const here = () => state.lastResult === r;
    const say = (html) => {
      if (!here()) return;
      box.innerHTML = html;
      box.hidden = false;
    };
    say('📴 서버가 쉬는 중 · 기록을 <b>이 폰</b>에 저장했어요<small>서버 보관함에도 맡기는 중…</small>');
    backupOffline(r.levelId).then((ok) =>
      say(
        ok
          ? '✅ 기록을 <b>이 폰</b>과 <b>서버 보관함</b>에 저장했어요<small>오전 9시부터 랭킹에 자동으로 올라가요</small>'
          : '📴 기록을 <b>이 폰</b>에 저장했어요<small>오전 9시 뒤에 이 폰에서 게임을 한 번 열어 주세요 · 방문 기록·사이트 데이터는 지우지 마세요</small>'
      )
    );
  };
  if (state.api.mode !== 'server') return keepOffline();
  // 랭킹은 팔로워 인증(암호)을 받은 사람만 → 안 받았으면 인증 창을 한 번 띄움
  if (!isConfirmed()) {
    askNickname();
    return;
  }
  if (!realTok) return keepOffline(); // 판 시작 요청이 실패했던 판
  r.submitting = true;
  try {
    const out = await state.api.submitScore(
      endless
        ? { runToken: r.runToken, level: r.levelId, rounds: r.roundsCleared, score: r.score }
        : { runToken: r.runToken, level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts, check: r.check }
    );
    r.submitted = true;
    // kept: 기록이 안 올라서 서버가 등수를 안 셈 (D1 읽기 아끼기)
    if (out.kept && out.rank == null) toast(endless ? `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요`, 3000);
    else if (out.busy) toast(endless ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어` : '랭킹에 올라갔어요! 🏆', 3000);
    else if (out.over) toast(endless ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · 200위 밖` : '랭킹에 올라갔어요! 200위 밖', 3000);
    else if (out.rank == null) toast('팔로우 확인이 안 돼서 지금은 랭킹에 안 보여요. 위 ⚠️ 버튼을 눌러 주세요', 3200);
    else if (endless) toast(out.improved ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · ${out.rank}위 🏆` : `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요 · ${out.rank}위`, 3200);
    else toast(out.improved ? `랭킹에 올라갔어요! 현재 ${out.rank}위 🏆` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요 · ${out.rank}위`, 3000);
  } catch (e) {
    if (e.status === 503 || !e.status) keepOffline(); // 서버가 막혔거나 연결이 끊김
    else if (e.status === 401 || (e.status === 403 && e.data && e.data.error === 'verify_required')) {
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
    ? `${CONFIG.appName} 무제한 모드 Lv.${r.roundsCleared} 클리어 (${r.bpmReached} BPM) ${fmt(r.score)}점! 너도 엄지로 쳐 봐 ${url}`
    : `${CONFIG.appName} ${levelLabel(r.levelId)} ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 ${url}`;
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
/** 🏛 명예의 전당 칸 ('hall-stage' 단계 총합 / 'hall-endless' 무제한 총합) */
const isHallRank = (id) => typeof id === 'string' && id.startsWith('hall-');
const rankModeOf = (id) => (isHallRank(id) ? 'hall' : isEndlessRank(id) ? 'endless' : 'normal');

async function openRank(levelId) {
  state.rankLevel = levelId === 'total' ? 'hall-stage' : levelId || state.rankLevel || 'hall-stage';
  renderRankTabs();
  openModal('modal-rank');
  await loadRank();
}

/** 위: 🏛 명예의 전당 / 🎵 단계 / 💎 무제한. 아래: 그 안의 탭 (전당 = 단계 총합·무제한 총합, 단계 = 단계별, 무제한 = 그리그 + 단계별 무제한) */
function renderRankTabs() {
  const cur = state.rankLevel;
  const mode = rankModeOf(cur);
  $('#rank-season').textContent = seasonLeftText();
  $$('#rank-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rankMode === mode)));
  const tab = (id, label) => `<button role="tab" data-rank="${id}" aria-selected="${id === cur}">${label}</button>`;
  $('#rank-tabs').innerHTML =
    mode === 'hall'
      ? tab('hall-stage', BOARD_LABEL.stage) + tab('hall-endless', BOARD_LABEL.endless)
      : mode === 'endless'
        ? tab(ENDLESS_ID, '♾️ 그리그') + MAIN_LEVELS.filter((l) => !closedLocked(levelEndlessId(l.id))).map((l) => tab(levelEndlessId(l.id), `${l.id}단계 ∞`)).join('')
        : LEVELS.map((l) => tab(l.id, l.xmas ? '🎄 이벤트' : l.long ? '🎭 장거리' : `${l.id}단계`)).join('');
  const sel = $('#rank-tabs [aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
}

/** 📴 서버가 쉬는 동안 랭킹 창 맨 위 안내 (예전 랭킹을 보여 줄 때 / 못 받았을 때) */
function snapNotice(data) {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0); // 다음 UTC 0시 = 한국 오전 9시
  const when = `${new Date(next.getTime() + 9 * 3600000).getUTCDate()}일 오전 9시`;
  if (data && data.snap) {
    const t = new Date(data.snap.at + 9 * 3600000);
    const h = t.getUTCHours();
    const at = `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시 ${t.getUTCMinutes()}분`;
    return `<div class="rank-snap">📴 서버가 쉬는 중이라 <b>${at}</b> 기준 랭킹이에요<br><b>${when}부터</b> 실시간으로 업데이트돼요</div>`;
  }
  return `<div class="rank-snap">📴 서버가 쉬는 중이에요 · 랭킹은 <b>${when}부터</b> 다시 보여요</div>`;
}

async function loadRank() {
  const list = $('#rank-list');
  // 서버가 쉬는 동안(진짜 사이트)엔 예전 랭킹을 보여 줌 → '곧 열려요'는 서버 없이 올린 사이트(apiMode mock)에서만
  if (demoOnly() && CONFIG.apiMode === 'mock') {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  const want = state.rankLevel;
  try {
    if (isHallRank(want)) {
      const board = want === 'hall-endless' ? 'endless' : 'stage';
      const data = await state.api.hall(board);
      if (state.rankLevel !== want) return;
      list.innerHTML = (data.snap || (data.sample && !isLocalDev()) ? snapNotice(data) : '') + hallHtml(data, board);
      const foot = [];
      foot.push(board === 'endless' ? '무제한 판(그리그·단계별 무제한) 점수를 모두 더한 점수예요.' : '단계별 최고점을 모두 더한 점수예요. 더 많은 단계를 높은 점수로 칠수록 올라가요!');
      if (data.season.n > 1) foot.push(`시즌 ${data.season.n}에 친 기록만 세요.`);
      if (data.me) foot.push(data.me.rank ? `내 순위: ${data.me.rank}위.` : `내 순위: ${data.me.cap || 200}위 밖.`);
      rankFootJoin(foot);
      return;
    }
    const data = await state.api.leaderboard(want);
    if (state.rankLevel !== want) return;
    const endless = isEndlessRank(want);
    if (data.snapFail) list.innerHTML = snapNotice(null);
    else if (!data.entries.length) list.innerHTML = '<div class="rank-empty">아직 기록 없음</div>';
    else if (endless) list.innerHTML = endlessRankHtml(data);
    else
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g" style="color:${gradeColor(e.grade)}">${e.grade || ''}</span></div>`
        )
        .join('');
    if (data.snap) list.innerHTML = snapNotice(data) + list.innerHTML;
    const foot = [];
    if (data.sample && isLocalDev()) foot.push('(개발 모드: 서버 없이 내 기록만 보여요)');
    if (endless) {
      const eb = levelEndlessBase(want);
      foot.push(`${eb ? `${eb.id}단계 ${escapeHtml(eb.name)} 무제한` : '그리그 무제한 모드'} 랭킹이에요. 더 높은 단계(Lv.)까지 깬 사람이 위, 같으면 점수가 높은 사람이 위예요.`);
    }
    if (data.me) foot.push(data.me.rank ? `내 순위: ${data.me.rank}위.` : `내 순위: ${data.me.cap || 200}위 밖.`);
    rankFootJoin(foot);
  } catch {
    list.innerHTML = '<div class="rank-empty">랭킹을 불러오지 못했어요.</div>';
  }
}
function rankFootJoin(foot) {
  if (state.me.guest) foot.push(`<b>${escapeHtml(state.me.player?.username)}</b> 님으로 참여 중 · 끝까지 치면 점수가 알아서 올라가요.`);
  else foot.push('닉네임을 정하면 끝까지 친 점수가 알아서 랭킹에 올라가요. <button class="link" data-action="rank-join">닉네임 정하기</button>');
  $('#rank-foot').innerHTML = foot.join(' ');
}

/** 🏛 명예의 전당: 끝난 시즌 1·2·3등(사진) + 이번 시즌 총합 순위(시상대 + 목록) */
var lastHallData = null;
function hallHtml(data, board) {
  lastHallData = data;
  const sub = (e) => (board === 'endless' ? `Lv.${fmt(e.rounds)} · ${e.n}판` : `${e.n}/${data.levels}단계`);
  const past = {};
  for (const h of data.hall || []) if (h.board === board) (past[h.season] ||= []).push(h);
  const seasons = Object.keys(past).map(Number).sort((a, b) => b - a);
  const avatar = (h) => (h.image ? `<img class="hall-img" src="${escapeHtml(h.image)}" alt="">` : `<span class="hall-img none medal m${h.rank}">${icon('medal')}</span>`);
  const btn = (n, h, action, label, cls) => `<button class="${cls}" data-action="${action}" data-season="${n}" data-board="${board}" data-rank="${h.rank}">${label}</button>`;
  const pastHtml = seasons
    .map((n) => {
      const cards = [2, 1, 3]
        .map((rk) => past[n].find((h) => h.rank === rk))
        .filter(Boolean)
        .map((h) => {
          const mine = h.me
            ? btn(n, h, 'hall-photo', `📷 ${h.image ? '사진 바꾸기' : '사진 올리기'}`, 'btn btn-sm btn-ghost') +
              (h.image ? btn(n, h, 'hall-photo-del', '지우기', 'link small') : '') +
              btn(n, h, 'hall-msg', `💬 ${h.msg ? '한마디 고치기' : '한마디 쓰기'}`, 'btn btn-sm btn-ghost')
            : '';
          const msg = h.msg ? `<span class="hall-msg">“${escapeHtml(h.msg)}”</span>` : '';
          return `<div class="hall-card r${h.rank} ${h.me ? 'me' : ''}">${avatar(h)}<span class="hall-rk">${['🥇', '🥈', '🥉'][h.rank - 1]} ${h.rank}등</span>
            <b class="hall-nm">${escapeHtml(h.username)}</b><span class="hall-sc">${fmt(h.score)}</span><span class="pl">${sub(h)}</span>${msg}${mine}</div>`;
        })
        .join('');
      return `<div class="hall-sec"><h4>🏛 시즌 ${n} 명예의 전당</h4><div class="hall-row">${cards}</div></div>`;
    })
    .join('');
  const note = `<div class="hall-note">🏛 시즌이 끝나면 <b>1·2·3등은 명예의 전당에 영원히 기록돼요</b> (사진·한마디)<br>🪙 100등까지 코인 보상 · 1등 10만 · 2등 7만 · 3등 5만</div>`;
  const cur = data.entries || [];
  let now = `<h4 class="hall-cur">🏆 시즌 ${data.season.n} 지금 순위</h4>`;
  if (!cur.length) now += '<div class="rank-empty">아직 아무도 없어요. 첫 1위의 주인공이 되어보세요!</div>';
  else {
    const top = cur.slice(0, 3);
    const podium = [1, 0, 2]
      .filter((i) => top[i])
      .map((i) => {
        const e = top[i];
        return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal m${i + 1}">${icon('medal')}</span>
          <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
          <span class="pl">${sub(e)}</span><span class="step">${i + 1}등</span></div>`;
      })
      .join('');
    const rest = cur
      .slice(3, 50)
      .map(
        (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g small">${board === 'endless' ? `Lv.${fmt(e.rounds)}` : `${e.n}/${data.levels}`}</span></div>`
      )
      .join('');
    now += `<div class="podium">${podium}</div>${rest}`;
  }
  return note + pastHtml + now;
}

/** 🏛 명예의 전당 사진: 고른 사진을 가운데 정사각형으로 잘라 160px JPEG 로 (서버엔 이 작은 사진만) */
let hallPick = null;
async function hallPhotoPicked(file) {
  const pick = hallPick;
  hallPick = null;
  if (!file || !pick) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = bad;
      im.src = url;
    });
    const S = 160;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    let image = c.toDataURL('image/jpeg', 0.82);
    if (image.length > 58000) image = c.toDataURL('image/jpeg', 0.6);
    await state.api.hallPhoto({ ...pick, image });
    if (!$('#modal-gift').hidden) $('#gift-photo').style.backgroundImage = `url('${image}')`;
    toast('📷 프로필 사진을 올렸어요! (이상한 사진은 운영자가 지울 수 있어요)', 2800);
    loadRank();
  } catch {
    toast('사진을 올리지 못했어요. 다른 사진으로 해 보세요');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 무제한: 총 등수처럼 1·2·3등 시상대(깬 단계 Lv.) + 4등부터 목록 */
function endlessRankHtml(data) {
  const top = data.entries.slice(0, 3);
  const podium = [1, 0, 2]
    .filter((i) => top[i])
    .map((i) => {
      const e = top[i];
      return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal m${i + 1}">${icon('medal')}</span>
        <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
        <span class="pl">Lv.${e.rounds}</span><span class="step">${i + 1}등</span></div>`;
    })
    .join('');
  const rest = data.entries
    .slice(3, 50)
    .map(
      (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
        <span class="s">${fmt(e.score)}</span><span class="g endless">Lv.${e.rounds}</span></div>`
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
  $('#set-touchshow').checked = !!load('touchShow', false);
  $$('#set-band button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.band === (s.band || 'orch')));
  updateSettingLabels();
  renderDeco();
  $('#settings-account').innerHTML = state.me.guest
    ? `랭킹 닉네임: <b>${escapeHtml(state.me.player?.username)}</b> · <button class="link" data-action="logout">닉네임 지우기</button>`
    : `랭킹은 팔로워 인증을 받은 사람만 올라가요 · <button class="link" data-action="rank-join">팔로워 인증 받기</button>`;
  $('#transfer-code').hidden = true;
  openModal('modal-settings');
}
// ---------------- 📱 다른 폰으로 옮기기 (계정 연동) ----------------
//   옛 폰: 기록을 서버에 올리고 6자리 코드(10분, 한 번만) → 새 폰: 코드를 넣으면 기록을 합치고 랭킹 계정(인증 포함)도 이어받음
//   버튼 누를 때만 요청 1번씩 (주기적 호출 없음)
/** 두 기록 합치기: 단계마다 점수 높은 쪽 + 별·다이아·깬 단계는 큰 값 */
function mergeBests(mine, theirs) {
  const out = { ...mine };
  for (const [k, t] of Object.entries(theirs || {})) {
    const m = out[k];
    if (!m) {
      out[k] = t;
      continue;
    }
    const best = (t.score || 0) > (m.score || 0) ? { ...t } : { ...m };
    for (const f of ['stars', 'diamonds', 'roundsCleared']) {
      const v = Math.max(m[f] || 0, t[f] || 0);
      if (v) best[f] = v;
    }
    out[k] = best;
  }
  return out;
}
async function transferMake() {
  if (!(await reconnectServer({ force: true }))) return toast('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요');
  const { offsetMs, ...settings } = state.settings;
  const data = { bests: loadBests(), nick: load('nick', ''), lastNick: load('lastNick', ''), lastIg: load('lastIg', ''), settings, coins: load('coins', 0), decoOwned: load('decoOwned', []) };
  try {
    const r = await state.api.transfer({ op: 'make', data });
    $('#transfer-code-num').textContent = `${r.code.slice(0, 3)} ${r.code.slice(3)}`;
    $('#transfer-code').hidden = false;
  } catch (e) {
    toast(e.status === 429 ? '너무 자주 눌렀어요. 10분 뒤에 다시 해 주세요' : '코드를 못 만들었어요. 다시 해 주세요');
  }
}
/** 가져온 기록 적용: 기록 합치기 + 닉네임 칸 + 설정 (+ 같은 폰이면 싱크 보정) + 랭킹 계정 */
function applyTransfer(data, me) {
  save('bests', mergeBests(loadBests(), data.bests));
  for (const f of ['nick', 'lastNick', 'lastIg']) if (data[f] && !load(f, '')) save(f, data[f]);
  // 🪙 인증 전에 폰에 모은 코인은 많은 쪽(계정 코인은 서버에 있어서 그대로), 산 꾸미기는 합침
  if (Number.isFinite(data.coins) && data.coins > load('coins', 0)) save('coins', Math.floor(data.coins));
  if (Array.isArray(data.decoOwned)) save('decoOwned', [...new Set([...(load('decoOwned', []) || []), ...data.decoOwned])]);
  refreshCoins();
  if (data.settings || data.calib) {
    state.settings = { ...state.settings, ...(data.settings || {}) };
    if (data.calib) {
      state.settings.offsetMs = data.calib.offsetMs;
      if (data.calib.calibrated) save('calibrated', true);
    }
    saveSettings(state.settings);
    audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
    applyLite();
  }
  if (me) state.me = me;
}

/** 옛 주소(kongkong-drum.vercel.app)의 다리 페이지가 기록을 챙겨 ?t=코드 로 보내 줌 → 자동으로 가져옴 */
async function takeBridgeCode(code) {
  if (!(await reconnectServer({ force: true }))) return toast('예전 기록을 가져오려면 인터넷 연결을 확인하고 새로고침해 주세요', 3600);
  try {
    const { data, me } = await state.api.transfer({ op: 'take', code });
    applyTransfer(data, me);
    refreshTitle();
    renderLevels();
    toast('📦 주소가 바뀌었어요! 예전에 하던 기록을 그대로 가져왔어요', 3600);
  } catch (e) {
    if (e.status === 404) toast('예전 기록 코드가 지났어요. 예전 주소로 한 번 더 들어와 주세요', 3600);
  }
}

async function transferTake() {
  const code = $('#transfer-input').value.replace(/\D/g, '');
  if (code.length !== 6) return toast('옛 폰에서 받은 숫자 6자리를 넣어 주세요');
  if (!(await reconnectServer({ force: true }))) return toast('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요');
  try {
    const { data, me } = await state.api.transfer({ op: 'take', code });
    applyTransfer(data, me);
    $('#transfer-input').value = '';
    closeModal('modal-settings');
    refreshTitle();
    renderLevels();
    toast(me && me.confirmed ? '🎉 기록과 팔로워 인증을 가져왔어요!' : me ? '🎉 기록과 랭킹 닉네임을 가져왔어요!' : '🎉 기록을 가져왔어요!', 3200);
  } catch (e) {
    toast(e.status === 429 ? '너무 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요' : e.status === 404 ? '코드가 틀렸거나 10분이 지났어요. 옛 폰에서 다시 받아 주세요' : '가져오지 못했어요. 다시 해 주세요', 3200);
  }
}

// ---------------- 🚨 긴급 공지: 새 주소 이사 (2026-11-18) ----------------
//   첫 화면 맨 위 노란 버튼. '확인했어요' 누르면 이 기기에선 숨김. 12월이 끝나면 저절로 안 보임
const MOVE_NOTICE_UNTIL = Date.parse('2027-01-01T00:00:00+09:00');
function refreshMoveBtn() {
  $('#btn-move').hidden = !!load('moveNoticeOk', false) || Date.now() > MOVE_NOTICE_UNTIL;
}
function openMove() {
  openModal('modal-move');
}

// ---------------- 📮 기록 되찾기 요청 (운영자가 admin 에서 계정을 골라 승인 → 이 폰이 다음에 들어올 때 자동으로) ----------------
//   보낸 요청 표시(token)는 이 폰에만 저장. 확인은 사이트에 들어올 때 · 앱으로 돌아올 때(2분에 한 번)만 1번 (주기적 호출 없음)
function openReq() {
  const pending = !!load('recoverReq', null);
  $('#req-form').hidden = pending;
  $('#req-wait').hidden = !pending;
  $('#req-err').hidden = true;
  if (!pending) {
    if (!$('#req-now').value) $('#req-now').value = load('lastIg', '');
    if (!$('#req-old').value) $('#req-old').value = load('lastIg', '');
    if (!$('#req-nick').value) $('#req-nick').value = load('lastNick', '') || load('nick', '');
  }
  openModal('modal-req');
}
async function sendReq() {
  const err = (t) => {
    $('#req-err').textContent = t;
    $('#req-err').hidden = false;
  };
  $('#req-err').hidden = true;
  const nick = $('#req-nick').value.trim();
  const oldIg = $('#req-old').value.trim();
  let nowIg = $('#req-now').value.trim().toLowerCase();
  const um = nowIg.match(/instagram\.com\/([^/?#\s]+)/);
  if (um) nowIg = um[1];
  nowIg = nowIg.replace(/^@+/, '');
  if (!nick && !oldIg) return err('예전 닉네임이나 예전 아이디 중 하나는 적어 주세요.');
  if (!/^[a-z0-9._]{1,30}$/.test(nowIg)) return err('지금 인스타 아이디를 정확히 적어 주세요. (영문·숫자·_ . 만)');
  const password = $('#req-pass').value.trim();
  if (!password && !freePass()) return err('팔로워 암호를 적어 주세요. (게시물에 「쿵」 댓글을 달면 DM 으로 와요)');
  if (!(await reconnectServer({ force: true }))) return err('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요.');
  $('#req-send').disabled = true;
  try {
    const r = await state.api.recoverRequest({ nick, oldIg, nowIg, password, memo: $('#req-memo').value.trim() });
    save('recoverReq', { token: r.token, at: Date.now() });
    $('#req-pass').value = '';
    $('#req-memo').value = '';
    openReq();
  } catch (e) {
    const c = e.data && e.data.error;
    err(
      c === 'wrong_password' ? '암호가 달라요. 「쿵」 댓글 DM 속 암호를 다시 확인해 주세요.'
        : c === 'rate_limited' || e.status === 429 ? '너무 여러 번 보냈어요. 10분 뒤에 다시 해 주세요.'
        : c === 'bad_ig' ? '지금 인스타 아이디를 정확히 적어 주세요.'
        : '보내지 못했어요. 다시 해 주세요.'
    );
  } finally {
    $('#req-send').disabled = false;
  }
}
/** 보낸 요청이 승인됐나 확인 → 승인됐으면 계정·기록을 이 폰으로 */
async function checkReq({ manual = false } = {}) {
  const req = load('recoverReq', null);
  if (!req || !req.token || !state.api || state.api.mode !== 'server') return;
  try {
    const r = await state.api.recoverStatus(req.token);
    if (r.status === 'done') {
      remove('recoverReq');
      state.me = r.me;
      if (r.bests) save('bests', mergeBests(loadBests(), r.bests));
      closeModal('modal-req');
      refreshTitle();
      renderLevels();
      toast(`📦 운영자가 확인했어요! 「${r.me.player.username}」 계정${r.levels ? ` · ${r.levels}개 단계` : ''}를 되찾았어요`, 4500);
    } else if (r.status === 'rejected') {
      remove('recoverReq');
      closeModal('modal-req');
      toast('되찾기 요청을 확인했는데 맞는 계정을 못 찾았어요. 닉네임·아이디를 다시 적어 보내 주세요', 4500);
    } else if (manual) toast('아직 확인 중이에요. 조금 뒤에 다시 들어와 주세요', 2400);
  } catch (e) {
    if (e.status === 404) remove('recoverReq');
  }
}

// ---------------- 🪙 코인 (2026-11-22) ----------------
//   맞힌 콩(PERFECT·GREAT·GOOD) 1개 = 1코인, 연타 1번 = 1코인. 판이 끝나거나 그만둘 때 한 번 더함.
//   잔액은 서버 지갑(인증한 계정)에, 판 시작·점수 요청에 얹어 보냄 → 새 요청 없음 (coins.js). 자동 연주·영상 찍기는 0.
//   곧 상점에서 꾸미기(배경·드럼·콩 색·내 사진)를 사는 데 씀 → 산 것은 load('decoOwned') 목록
/** 인증 상태·서버 잔액을 coins.js 에 알림 (me 를 새로 받았을 때 그 잔액은 한 번만 씀) */
function syncCoinAccount() {
  const me = state.me || {};
  // 🛒 서버에 있는 산 것 → 이 폰 목록에 합침 (폰을 바꿔도 그대로)
  if (Array.isArray(me.owned) && me.owned.length) {
    const mine = load('decoOwned', []) || [];
    const all = [...new Set([...mine, ...me.owned])];
    if (all.length !== mine.length) save('decoOwned', all);
  }
  const fresh = Number.isFinite(me.coins) && !me._coinsUsed;
  if (fresh) me._coinsUsed = true;
  setCoinAccount(isConfirmed(), fresh ? me.coins : undefined);
  if (me.gift && !giftShown) setTimeout(() => showGift(me.gift), 600);
}

// ---------------- 🎁 운영자 선물 · 💬 명예의 전당 한마디 (2026-11-22) ----------------
//   운영자가 admin 에서 코인을 주면(지갑에 바로 들어감) 그 사람이 다음에 들어올 때 /api/me·boot 에 gift 가 실려 옴 → 팝업.
//   hall 이 있으면 명예의 전당 한마디 칸도. '받기·남기기' = /api/gift/ack (알림 지움), '나중에' = 다음 접속 때 또 뜸. 새 폴링 없음
var giftShown = false; // var: 시작 때 syncCoinAccount 가 먼저 불려도 되게
var giftMode = null; // { gift } 또는 { edit: { season, board, rank, msg } }
function showGift(gift) {
  if (!gift || giftShown) return;
  giftShown = true;
  giftMode = { gift };
  $('#gift-top').hidden = false;
  $('#gift-coins-line').hidden = !(gift.coins > 0);
  $('#gift-coins').textContent = fmt(gift.coins || 0);
  $('#gift-note').textContent = gift.note || '';
  $('#gift-msg-box').hidden = !gift.hall;
  $('#gift-photo-box').hidden = !gift.hall;
  $('#gift-photo').style.backgroundImage = '';
  $('#gift-msg-title').textContent = gift.hall ? `🏛 시즌 ${gift.hall.season} 명예의 전당에 남길 한마디` : '';
  $('#gift-msg').value = '';
  $('#gift-ok').textContent = gift.hall ? '받고 명예의 전당에 남기기' : '받기';
  $('#gift-later').hidden = !gift.hall;
  openModal('modal-gift');
  refreshCoins();
}
function editHallMsg(season, board, rank, msg) {
  giftMode = { edit: { season, board, rank } };
  $('#gift-top').hidden = true;
  $('#gift-photo-box').hidden = true;
  $('#gift-msg-box').hidden = false;
  $('#gift-msg-title').textContent = `🏛 시즌 ${season} 명예의 전당 한마디`;
  $('#gift-msg').value = msg || '';
  $('#gift-ok').textContent = '저장';
  $('#gift-later').hidden = false;
  $('#gift-later').textContent = '닫기';
  openModal('modal-gift');
}
async function giftOk() {
  const mode = giftMode;
  if (!mode) return closeModal('modal-gift');
  if (mode.gift) audio.unlock().then(() => audio.sfxFile('gift', 0.9)).catch(() => {}); // 🔔 선물 받기
  const msg = $('#gift-msg').value.trim();
  const b = $('#gift-ok');
  b.disabled = true;
  try {
    if (mode.edit) {
      await state.api.hallMsg({ ...mode.edit, msg });
      toast(msg ? '💬 한마디를 남겼어요!' : '한마디를 지웠어요', 2200);
      loadRank();
    } else {
      if (mode.gift.hall && !msg) {
        b.disabled = false;
        $('#gift-msg').focus();
        return toast('한마디를 적어 주세요 · 나중에 써도 돼요', 2200);
      }
      const r = await state.api.giftAck(msg);
      if (state.me) state.me.gift = null;
      toast(r && r.saved ? '🎉 받았어요! 한마디도 명예의 전당에 남겼어요' : '🎉 받았어요!', 2600);
    }
    giftMode = null;
    closeModal('modal-gift');
  } catch (e) {
    toast(e && e.status === 503 ? '서버가 잠깐 쉬는 중이에요 · 조금 뒤 다시' : '저장하지 못했어요 · 잠시 뒤 다시 해 주세요', 2600);
  } finally {
    b.disabled = false;
  }
}
function giftLater() {
  const g = giftMode && giftMode.gift;
  giftMode = null;
  closeModal('modal-gift');
  $('#gift-later').textContent = '나중에 쓸게요';
  if (g) toast('코인은 이미 들어왔어요 · 다음에 들어오면 다시 물어볼게요', 2600);
}
const getCoins = () => coinTotal();
function refreshCoins() {
  const el = $('#coin-num');
  if (el) el.textContent = fmt(getCoins());
}
/** 이 판에서 번 코인: PERFECT 2 · GREAT·GOOD·연타 1 (자동 연주·영상 찍기는 0) · 🎹 유저 맵은 PERFECT 1 만 */
function runCoins(g) {
  if (!g || state.auto || g.auto || state.studio.active) return 0;
  const c = g.counts || {};
  if (g.level && g.level.userMap) return Math.max(0, Math.min(40000, c.perfect || 0));
  return Math.max(0, Math.min(40000, (c.perfect || 0) * 2 + (c.great || 0) + (c.good || 0) + (g.rollHits || 0)));
}
/**
 * 이 판에서 번 코인 중 아직 안 넣은 만큼 넣음. 판 도중(앱을 내림·그만둠)에도 부르고, 끝나면 final → 더는 안 넣음.
 * 돌려주는 값 = 이 판에서 번 코인 전부
 */
function awardRunCoins(g, final = true) {
  if (!g) return 0;
  const total = runCoins(g);
  if (g._coined) return total;
  if (final) g._coined = true;
  const delta = total - (g._coinPaid || 0);
  if (delta > 0) {
    g._coinPaid = total;
    syncCoinAccount();
    // 판 토큰은 이 판 것일 때만 (서버가 같은 판은 합쳐서 한 판 최대까지만 받음)
    const tok = g._runToken && !String(g._runToken).startsWith('mock.') ? g._runToken : null; // 서버 없을 때 받은 가짜 토큰은 안 씀
    addRunCoins(delta, tok);
  }
  return total;
}

// ---------------- 🎨 꾸미기 (배경·드럼 세트·콩 색) ----------------
//   11-22 사용자 결정: 원래 배경(단계별)·맵 드럼·기본 콩 색만 무료, 나머지(다른 배경·드럼·콩 색·📷 내 사진)는
//   🔒 잠금 → 곧 상점에서 코인으로 엶. 열린 건 load('decoOwned') = ['bg:city', 'kit:lava', 'notes:neon', 'bg:photo' …]
//   11-22 밤 상점 개편: 맵 배경·맵 드럼·색만 바꾸는 콩 색은 무료, 상점 전용(새 그림 배경·새 드럼·효과 콩 스킨·📷 내 사진)만 잠금
const DECO_FREE = { bg: 'auto', kit: 'auto', notes: 'basic', ui: 'basic' };
function decoOpen(type, key) {
  if (!key || key === DECO_FREE[type]) return true;
  if (load('shopTest', false)) return true; // 🛒 운영자 시험(/?shoptest=okay): 이 기기에서만 상점 물건 전부 써 보기 (서버·지갑은 그대로)
  if ((type === 'bg' || type === 'kit') && DECO_THEMES.includes(key)) return true;
  if (type === 'notes' && NOTE_FREE.includes(key)) return true;
  const owned = load('decoOwned', []);
  return Array.isArray(owned) && owned.includes(`${type}:${key}`);
}
const decoPick = (type) => {
  const k = state.settings[type] || DECO_FREE[type];
  return decoOpen(type, k) ? k : DECO_FREE[type];
};
//   이 폰에만 저장(설정). 서버 요청 없음. 영상 찍기는 원래 맵 그대로(render.js)
function applyDeco() {
  const s = state.settings;
  // 🎤 라이브 스테이지 세트는 화면 전체가 세트 것(세트 무대·기본 콩) — 장착한 배경·콩 스킨은 세트를 빼면 돌아옴 (2026-11-22 사용자)
  const ui = decoPick('ui');
  const live = ui === 'live';
  const s1 = ui === 's1'; // 🥇 시즌 1 세트 = 금빛 「1」 콩 + 시즌 1 무대 + 황금 드럼 (2026-11-23)
  const bg = live || s1 ? 'auto' : decoPick('bg');
  const kit = live ? 'auto' : s1 ? 'goldkit' : decoPick('kit');
  renderer.bgPick = bg !== 'auto' ? bg : null;
  renderer.kitPick = kit !== 'auto' ? kit : null;
  renderer.photoDim = s.photoDim ?? 0.4;
  renderer.uiStyle = live ? 'live' : s1 ? 's1' : null;
  document.documentElement.classList.toggle('ui-live', live); // 게임 위 정보 칸·결과 화면도 세트 모양
  audio.uiSet = live ? 'live' : null; // 세트 버튼 소리
  applyNoteColors(renderer.plainStudio || live ? 'basic' : s1 ? 's1' : decoPick('notes'));
}
// 2026-11-22 사용자: 설정의 꾸미기 칸은 없애고 상점 한 곳에서 (장착 중 표시 + 「보유」 탭)
function renderDeco() {
  renderPhotoOpts();
  if ($('#screen-shop').classList.contains('active')) renderShop();
}

// 📷 내 사진 배경: 고른 사진을 긴 쪽 1600px JPEG 로 줄여 이 폰(IndexedDB)에만 저장. 서버로 안 보냄
const photo = { url: null };
function setPhotoImage(url) {
  if (photo.url && photo.url.startsWith('blob:') && photo.url !== url) URL.revokeObjectURL(photo.url);
  photo.url = url;
  if (!url) {
    renderer.bgPhoto = null;
    return Promise.resolve(false);
  }
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      renderer.bgPhoto = img;
      res(true);
    };
    img.onerror = () => {
      renderer.bgPhoto = null;
      res(false);
    };
    img.src = url;
  });
}
async function loadPhotoBg() {
  try {
    const url = await photoLoad();
    if (url) await setPhotoImage(url);
  } catch {}
}
async function shrinkPhoto(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(src);
  }
}
async function pickPhoto(file) {
  if (!file || !decoOpen('bg', 'photo')) return;
  let blob = null;
  try {
    blob = await shrinkPhoto(file);
  } catch {}
  if (!blob) return toast('이 사진은 못 읽었어요 · 다른 사진으로 해 보세요', 2800);
  if (!(await photoSave(blob))) return toast('사진을 저장하지 못했어요 (브라우저 저장 공간이 막혀 있어요)', 3200);
  await setPhotoImage(await photoLoad());
  state.settings.bg = 'photo';
  saveSettings(state.settings);
  applyDeco();
  renderDeco();
  toast('📷 배경으로 넣었어요! 다음 판부터 보여요', 2400);
}
const LANE_DEFAULT = LANE.slice(0, 4).map((l) => l.main);

// ---------------- 🛒 상점 (2026-11-22, 밤 개편) ----------------
//   가격표는 shop.js (서버와 같이 씀). 상점 전용 물건만 팜: ✨ 콩 스킨(질감·꼬리·반짝이) · 🌄 새 그림 배경 · 🥁 새 드럼 · 📷 내 사진
//   물건을 누르면 팝업(실제 게임 화면 미리보기 + 사기). 운영자가 admin 에서 열기 전엔 구경만(state.cfg.shopOpen)
//   인증한 계정 = 서버 지갑에서 차감(/api/shop/buy, 모아 둔 코인을 같이 보냄), 인증 전 = 이 폰 코인에서 차감
const SHOP_BGS = SHOP_ITEMS.map(([id]) => id.split(':')).filter(([t, k]) => t === 'bg' && THEMES[k] && THEMES[k].img).map(([, k]) => k);
// 2026-11-24 상점 오픈: 서버가 닫았다고 할 때만 닫힘 (서버 없는 모드에서도 이 폰 코인으로 삼)
const shopIsOpen = () => state.cfg.shopOpen !== false;
function shopSwatch(type, key) {
  if (key === DECO_FREE[type]) {
    if (type === 'notes') return `conic-gradient(${LANE_DEFAULT.join(',')})`;
    return type === 'kit' ? 'radial-gradient(circle at 35% 30%,#FFB27A,#E2562E 55%,#7A1E10)' : 'linear-gradient(#FF9A6B,#6A1B78)';
  }
  if (type === 'ui' && key === 's1') return 'radial-gradient(circle at 50% 40%,#FFF3B0,#FFD23F 30%,#2B3A8C 60%,#0C1036)';
  if (type === 'ui') return 'linear-gradient(160deg,#1A1450 0%,#3A2A8A 45%,#FF8AD8 70%,#7DF2FF 100%)';
  if (type === 'notes') {
    const p = NOTE_PALETTES[key];
    const c = (p && p.c ? p.c.slice(0, 4).map((x) => x[0]) : LANE_DEFAULT).join(',');
    if (key === 'gold') return 'radial-gradient(circle at 35% 30%,#FFFBE0,#FFD23F 45%,#B07A00)';
    if (key === 'galaxy') return 'radial-gradient(circle at 35% 30%,#FF9AE8,#7A3CFF 50%,#140A46)';
    return `conic-gradient(${c})`;
  }
  if (key === 'photo') return 'linear-gradient(135deg,#ffd6a5,#bde0fe)';
  if (type === 'kit' && SHOP_KITS[key]) {
    const k = SHOP_KITS[key].kit;
    if (k.finish === 'rainbow') return 'conic-gradient(#FF4D6D,#FF9F1C,#FFE14D,#3FD6A0,#3FA9FF,#9B6BFF,#FF4D6D)';
    return `radial-gradient(circle at 35% 30%,${k.shell[0]},${k.shell[1]} 55%,${k.shell[2]})`;
  }
  const t = THEMES[key];
  if (!t) return '#555';
  if (type === 'bg' && t.img) return `center/cover url('${t.img}')`;
  if (type === 'kit') {
    const sh = t.kit.shell;
    return `radial-gradient(circle at 35% 30%,${sh[0]},${sh[1]} 55%,${sh[2]})`;
  }
  return `linear-gradient(${t.sky.join(',')})`;
}
function shopName(type, key) {
  if (key === DECO_FREE[type]) return { ui: '기본 화면', notes: '기본 콩', bg: '기본 무대', kit: '기본 드럼' }[type];
  if (type === 'ui') return key === 's1' ? '🥇 시즌 1 세트' : '🎤 라이브 세트';
  if (type === 'notes') return (NOTE_PALETTES[key] || {}).name || key;
  if (key === 'photo') return '📷 내 사진 배경';
  if (type === 'kit' && SHOP_KITS[key]) return SHOP_KITS[key].name;
  return (THEMES[key] || {}).name || key;
}
const SHOP_DESC = {
  notes: '콩 모양에 질감 + 꼬리 + 반짝이가 붙어요',
  bg: '상점에서만 파는 무대예요',
  kit: '상점에서만 파는 드럼 세트예요',
  photo: '내 사진을 무대 배경으로 깔아요',
  ui: '판정선·콩·판정 글자·콤보·무대·버튼 소리가 리듬게임 라이브 화면처럼 한 번에 바뀌어요',
  basic: '처음 화면 그대로예요 · 누르면 이 분야만 기본으로 돌아가요',
  free: '무료예요',
  s1: '11월 27일까지만 살 수 있어요 · 금빛 「1」 콩 + 시즌 1 무대 + 황금 드럼이 한 번에 · 그 뒤엔 다시는 안 팔아요',
};
const isBasicId = (id) => {
  const [type, key] = String(id || '').split(':');
  return key != null && DECO_FREE[type] === key;
};
/** 무료 꾸미기 (맵 배경·맵 드럼·색만 바꾸는 콩) — 예전 설정 칸에 있던 것, 이제 상점에 「무료」로 */
const isFreeId = (id) => {
  const [type, key] = String(id || '').split(':');
  return ((type === 'bg' || type === 'kit') && DECO_THEMES.includes(key)) || (type === 'notes' && NOTE_FREE.includes(key));
};
const SHOP_TYPES = [['ui', '🎤 세트'], ['notes', '✨ 콩'], ['bg', '🌄 배경'], ['kit', '🥁 드럼']];
/** 한 분야의 상점 칸: [id, 값(무료 0), 등급('' = 무료)] — 기본 → 상점 물건 → 무료 */
function shopRow(type) {
  return [
    [`${type}:${DECO_FREE[type]}`, 0, ''],
    // 🥇 기간 한정(시즌 1 스킨)은 기간이 지나면 산 사람에게만 보임
    ...SHOP_ITEMS.filter(([id]) => id.startsWith(type + ':') && (onSale(id) || decoOpen(...id.split(':')))),
    ...(type === 'notes' ? NOTE_FREE : type === 'ui' ? [] : DECO_THEMES).map((k) => [`${type}:${k}`, 0, '']),
  ];
}
var shopTab = 'all';
var shopRare = 'all'; // 등급 필터 (2026-11-24): all free rare epic legend limited
function renderShop() {
  $('#shop-coins').textContent = fmt(getCoins());
  $('#shop-closed').hidden = shopIsOpen();
  const live = decoPick('ui') !== 'basic'; // 세트(라이브·시즌 1)를 끼면
  // 👕 지금 장착 중 (세트를 끼면 배경·드럼·콩은 세트 것)
  $('#shop-now').innerHTML =
    `<b>장착 중</b><div class="now-row">` +
    SHOP_TYPES.map(([type, label]) => {
      const key = decoPick(type);
      const off = live && type !== 'ui';
      return `<button class="now-item ${off ? 'off' : ''}" data-shop="${type}:${key}"><i style="background:${shopSwatch(type, key)}"></i><small>${label}</small><span>${escapeHtml(shopName(type, key))}</span></button>`;
    }).join('') +
    `</div>` +
    (live ? '<p class="muted small">세트를 끼면 배경·드럼·콩은 세트 것</p>' : '');
  $$('#shop-tabs [data-shop-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shopTab === shopTab)));
  $$('#shop-rare [data-shop-rare]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shopRare === shopRare)));
  const item = ([id, price, rare]) => {
    const [type, key] = id.split(':');
    const own = decoOpen(type, key);
    const using = own && decoPick(type) === key;
    const tag = rare ? RARITY_NAME[rare] : '무료';
    const label = using ? '✓ 장착 중' : !rare ? '' : own ? '보유' : `<i class="coin-ico"></i>${fmt(price)}`;
    return `<button class="shop-item ${rare ? 'r-' + rare : 'r-free'} ${own ? 'owned' : ''} ${using ? 'using' : ''}" data-shop="${id}">
      <em class="rar">${tag}</em>
      <i style="background:${shopSwatch(type, key)}"></i><b>${escapeHtml(shopName(type, key))}</b>
      <span>${label}</span></button>`;
  };
  const mine = shopTab === 'mine';
  const sec = ([type, title]) => {
    const rows = shopRow(type).filter(([id, , r]) => (!mine || decoOpen(...id.split(':'))) && (shopRare === 'all' || (r || 'free') === shopRare));
    return rows.length ? `<h4>${title}</h4><div class="shop-grid">${rows.map(item).join('')}</div>` : '';
  };
  $('#shop-list').innerHTML = SHOP_TYPES.map(sec).join('');
  renderPhotoOpts();
}
function renderPhotoOpts() {
  $('#set-photo-opts').hidden = !(decoPick('bg') === 'photo' && photo.url);
  $('#set-photo-dim').value = state.settings.photoDim ?? 0.4;
}
function openShop(focus) {
  renderShop();
  closeModal('modal-settings');
  show('screen-shop');
  if (typeof focus === 'string' && (priceOf(focus) != null || isFreeId(focus))) previewShop(focus);
}
// 👀 미리보기 팝업: 실제 게임 화면. 고른 것만 바꾸고 나머지는 지금 꾸미기 그대로
var shopPrevId = null;
function previewShop(id) {
  const [type, key] = id.split(':');
  const basic = isBasicId(id);
  const free = isFreeId(id);
  if (priceOf(id) == null && !basic && !free) return;
  shopPrevId = id;
  const own = decoOpen(type, key);
  const rare = basic || free ? '' : RARITY[id];
  $('#shopitem-rar').textContent = basic || free ? '무료' : RARITY_NAME[rare] || '';
  $('#shopitem-rar').className = 'rar r-' + (rare || 'free');
  $('#shopitem-name').textContent = shopName(type, key);
  $('#shopitem-desc').textContent = LIMITED[id] ? SHOP_DESC.s1 : basic ? SHOP_DESC.basic : free ? SHOP_DESC.free : key === 'photo' ? SHOP_DESC.photo : SHOP_DESC[type];
  const b = $('#shopitem-buy');
  const using = own && decoPick(type) === key;
  if (own) {
    // 기본으로 돌아가는 건 분야마다 맨 앞 「기본」 칸으로 (2026-11-22)
    b.innerHTML = using ? '✓ 장착 중' : '장착하기';
    b.disabled = using;
  } else if (!onSale(id)) {
    b.innerHTML = '판매가 끝나서 이제 못 사요';
    b.disabled = true;
  } else if (!shopIsOpen()) {
    b.innerHTML = `🔒 판매 준비 중 · <i class="coin-ico"></i> ${fmt(priceOf(id))}`;
    b.disabled = true;
  } else {
    b.innerHTML = `<i class="coin-ico"></i> ${fmt(priceOf(id))} 사기`;
    b.disabled = false;
  }
  openModal('modal-shopitem');
  const pick = { bg: decoPick('bg'), kit: decoPick('kit'), notes: decoPick('notes'), ui: decoPick('ui') };
  pick[type] = key;
  // 🎤 세트는 화면 전체가 바뀜: 세트 미리보기는 세트 무대·기본 콩으로 (장착한 배경·콩 스킨에 안 섞이게, 2026-11-22)
  if (type === 'ui' && key === 'live') Object.assign(pick, { bg: 'auto', kit: 'auto', notes: 'basic' });
  if (type === 'ui' && key === 's1') Object.assign(pick, { bg: 'auto', kit: 'goldkit', notes: 's1' });
  // 세트를 낀 채 다른 걸 미리보면 세트 빼고 (세트가 화면을 다 덮어서)
  if (type !== 'ui') pick.ui = 'basic';
  // 콩 스킨은 어두운 무대에서 (화려한 맵 위에선 잘 안 보임)
  if (type === 'notes' && pick.bg === 'auto') pick.bg = 'void';
  const kc = $('#shopitem-kit');
  kc.hidden = type !== 'kit';
  if (type === 'kit') requestAnimationFrame(() => drawKitCloseup(kc, key));
  startShopPreview($('#shopitem-cv'), { ...pick, photo: pick.bg === 'photo' ? renderer.bgPhoto : null }).catch(() => {});
}
function closeShopPreview() {
  stopShopPreview();
  shopPrevId = null;
  closeModal('modal-shopitem');
  applyDeco(); // 미리보기로 바꾼 콩 스킨 되돌리기
}
function closeShop() {
  closeShopPreview();
  refreshTitle();
  show('screen-title');
}
/** 산 것을 바로 씀 (사진 배경이면 사진 고르기) */
function equipDeco(id) {
  const [type, key] = id.split(':');
  if (type === 'bg' && key === 'photo') {
    if (!photo.url) return $('#set-photo-file').click();
  }
  state.settings[type] = key;
  saveSettings(state.settings);
  applyDeco();
  renderDeco();
}
async function buyShop(id) {
  const price = priceOf(id);
  const [type, key] = id.split(':');
  if (price == null || decoOpen(type, key)) return;
  if (!shopIsOpen()) return toast('🔒 상점은 곧 열려요 · 지금은 구경만 돼요', 2400);
  if (!onSale(id)) return toast('판매가 끝나서 이제 못 사요', 2400);
  if (getCoins() < price) return toast(`🪙 코인이 ${fmt(price - getCoins())}개 모자라요 · 콩을 맞히면 쌓여요`, 2600);
  const name = shopName(type, key);
  const account = isConfirmed() && state.api && state.api.mode === 'server';
  if (account) {
    if (load('coinSending', null)) return toast('코인 보내는 중이에요 · 잠시 뒤 다시 눌러 주세요', 2200);
    try {
      const r = await state.api.buy(id);
      save('decoOwned', [...new Set([...(load('decoOwned', []) || []), ...(r.owned || []), id])]);
    } catch (e) {
      if (e && e.status === 402) return renderShop(), toast('🪙 코인이 모자라요', 2200);
      if (e && e.data && e.data.error === 'season_over') return renderShop(), toast('판매가 끝나서 이제 못 사요', 2400);
      if (e && e.data && e.data.error === 'shop_closed') {
        state.cfg.shopOpen = false;
        renderShop();
        return toast('🔒 상점은 곧 열려요 · 지금은 구경만 돼요', 2400);
      }
      return toast(e && e.status === 503 ? '서버가 잠깐 쉬는 중이라 지금은 못 사요 · 조금 뒤 다시' : '사지 못했어요 · 잠시 뒤 다시 해 주세요', 2800);
    }
  } else {
    const have = Number(load('coins', 0)) || 0;
    if (have < price) return toast('🪙 코인이 모자라요', 2200);
    save('coins', have - price);
    save('decoOwned', [...new Set([...(load('decoOwned', []) || []), id])]);
  }
  refreshCoins();
  renderShop();
  equipDeco(id);
  audio.unlock().then(() => audio.sfxFile('buy', 0.9)).catch(() => {}); // 🔔 구매
  if (shopPrevId === id) previewShop(id);
  toast(`🎉 ${name} 샀어요! 바로 적용했어요`, 2400);
}
/** 상점 개편 전에 이 폰 코인으로 산 것(이제 무료) 값 돌려주기 — 인증 전 폰만, 한 번 */
function refundLegacyLocal() {
  if (load('legacyRefund1', false)) return;
  save('legacyRefund1', true);
  if (isConfirmed() || load('confirmedAt', null)) return;
  const { refund } = legacyRefund(load('decoOwned', []) || []);
  if (refund > 0) {
    save('coins', (Number(load('coins', 0)) || 0) + refund);
    toast(`🛒 상점이 바뀌어서 예전에 산 꾸미기 값 ${fmt(refund)}코인을 돌려드렸어요`, 3200);
  }
}
function bindDeco() {
  loadPhotoBg();
  $('#set-photo-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    pickPhoto(f);
  });
  $('#set-photo-dim').addEventListener('input', (e) => {
    state.settings.photoDim = Number(e.target.value);
    saveSettings(state.settings);
    applyDeco();
  });
  $('#set-photo-opts').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-photo-act]');
    if (!a) return;
    if (a.dataset.photoAct === 'change') return $('#set-photo-file').click();
    await photoDelete();
    await setPhotoImage(null);
    state.settings.bg = 'auto';
    saveSettings(state.settings);
    applyDeco();
    renderDeco();
    toast('사진을 지웠어요', 1800);
  });
  $('#shop-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]');
    if (b) previewShop(b.dataset.shop);
  });
  $('#shopitem-buy').addEventListener('click', () => {
    const id = shopPrevId;
    if (!id) return;
    const [type, key] = id.split(':');
    if (!decoOpen(type, key)) return buyShop(id);
    if (decoPick(type) === key) return;
    equipDeco(id);
    renderShop();
    previewShop(id);
    toast(`${shopName(type, key)} 장착했어요`, 1800);
  });
  $('#shop-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop-tab]');
    if (!b) return;
    shopTab = b.dataset.shopTab;
    renderShop();
  });
  $('#shop-rare').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop-rare]');
    if (!b) return;
    shopRare = b.dataset.shopRare;
    renderShop();
  });
  $('#shop-now').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]');
    if (b) previewShop(b.dataset.shop);
  });
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
  bindDeco();
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
  // 🖐 터치 표시 (2026-11-24 사용자): 누른 자리에 동그라미 + 줄·판정. /?touch=show 와 같은 값
  $('#set-touchshow').addEventListener('input', (e) => {
    save('touchShow', e.target.checked);
    renderer.touchShow = e.target.checked;
  });
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

const calib = { taps: [], pTaps: [], clicks: [], active: false, required: false, after: null, fails: 0, ctx0: 0, perf0: 0 };

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
  calib.pTaps = [];
  calib.active = true;
  const clicks = playMetronome(audio, 100, 12);
  calib.clicks = clicks;
  // 소리 시계가 멈춘 폰(아이폰에서 다른 앱·탭이 소리를 잡고 있을 때)을 위해 화면 시계 기준도 같이 잼
  calib.ctx0 = audio.ctx.currentTime;
  calib.perf0 = performance.now() / 1000;
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
  // 소리 시계가 거의 안 흘렀으면(멈춤) 소리 대신 반짝임(화면 시계) 기준으로 잼 — 탭이 전부 같은 시각으로 찍혀 '너무 적어요'만 뜨던 것
  const flowed = audio.ctx.currentTime - calib.ctx0;
  const elapsed = performance.now() / 1000 - calib.perf0;
  const stalled = audio.ctx.state !== 'running' || flowed < elapsed * 0.5;
  const taps = stalled ? calib.pTaps : calib.taps;
  const clicks = stalled ? calib.clicks.map((c) => calib.perf0 + (c - calib.ctx0)) : calib.clicks;
  const diffs = [];
  for (const t of taps) {
    let best = null;
    for (const c of clicks.slice(4)) if (best === null || Math.abs(t - c) < Math.abs(t - best)) best = c;
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
  $('#calib-result').textContent = stalled
    ? `소리가 안 나서 반짝임으로 맞췄어요 (${ms > 0 ? '+' : ''}${ms}ms). 다른 앱·탭 소리를 끄고 새로고침하면 소리도 나요!`
    : `보정값 ${ms > 0 ? '+' : ''}${ms}ms 저장했어요. 잘못 쳤다면 다시 할 수 있어요!`;
  // 결과를 보고 다시 할 수 있게: '다시 하기'는 보조 버튼으로, 필수 보정이면 '이 값으로 시작하기'로 이어감
  $('#calib-start').textContent = '다시 하기';
  $('#calib-start').classList.remove('btn-primary');
  $('#calib-start').classList.add('btn-ghost');
  if (calib.required) $('#calib-done').hidden = false;
}

// ---------------- 🎵 내 노래로 치기 ----------------
//   폰에 있는 노래(mp3)·영상(mp4·화면 녹화)을 넣으면 BPM·박을 찾아(beatsync.js) 그 노래에 맞는 채보를 만들고
//   노래를 틀면서 직접 침 (자동 연주 없음). 파일은 이 폰 메모리에만 (서버로 안 감, API 요청도 없음)
//   기록·랭킹·통계엔 안 들어감. 🎬 녹화 버튼을 켜면 치는 화면 + 소리를 영상으로 저장
const MY_ID = 'my';
const my = { url: null, name: '', buf: null, mono: null, bpm: null, beat0: null, sound0: 0, diff: load('myDiff', 'easy'), from: 'start', rec: false, level: null, blob: null, blobUrl: null };
const myBusy = () => my.loading;
function openMysong() {
  if (followGated()) {
    openVerify(null, { label: '🎵 최신곡으로 치기는 팔로워만', then: openMysong });
    return;
  }
  if (state.game) state.game.stop();
  $$('#my-diff button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.diff === my.diff));
  $$('#my-from button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.from === my.from));
  $('#my-start-wrap').hidden = my.from !== 'pick';
  const ok = canRecordFile();
  $('#my-rec').disabled = !ok;
  $('#my-rec').checked = ok && my.rec;
  $('#my-rec-hint').textContent = ok ? '켜면 치는 화면이 노래 소리까지 영상 파일로 저장돼요.' : '이 브라우저는 바로 녹화가 안 돼요. 폰 화면 녹화로 찍어 주세요.';
  show('screen-mysong');
}
async function myPick(file) {
  if (my.loading) return;
  if (my.url) URL.revokeObjectURL(my.url);
  my.url = URL.createObjectURL(file);
  my.name = file.name.replace(/\.[^.]+$/, '').slice(0, 30);
  my.buf = my.mono = null;
  my.bpm = my.beat0 = null;
  $('#my-opts').hidden = true;
  $('#my-result').hidden = true;
  my.loading = true;
  audio.unlock();
  const buf = await openTrackFile(my.url, file, (t, mb) => ($('#my-status').textContent = `노래 여는 중… ${t}초 (파일 ${fmtMb(mb)}, 보통 몇 초면 돼요)`));
  my.loading = false;
  if (!buf) {
    // 아이폰은 화면 녹화(.mov) 같은 영상을 바로 못 풀어서 → 소리 없이 한 번 재생하며 읽음.
    //   아이폰은 버튼을 눌러야 영상 재생을 허락해서, 버튼을 누르게 함
    $('#my-status').innerHTML =
      '이 영상은 한 번 재생하면서 소리를 읽어야 해요 (<b>영상 길이만큼</b> 걸려요, 소리는 안 나요).' +
      '<button class="btn btn-hot my-cap" type="button" data-action="mysong-capture">영상 소리 읽기</button>';
    return;
  }
  myLoaded(buf);
}
/** 영상 소리 읽기 (버튼 안에서 바로 재생해야 아이폰이 허락함) */
async function myCapture() {
  if (!my.url || my.loading) return;
  my.loading = true;
  audio.unlock();
  $('#my-status').textContent = '영상 소리 읽는 중… 화면을 끄지 마세요';
  const buf = await captureMediaAudio(my.url, (t, d) => ($('#my-status').textContent = capText(t, d)), 360);
  my.loading = false;
  if (buf) {
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(my.url, buf);
  }
  myLoaded(buf);
}
function myLoaded(buf) {
  if (!buf || buf.duration < 12) {
    $('#my-status').textContent = buf ? '노래가 너무 짧아요 (12초 넘는 걸로 넣어 주세요)' : '소리를 못 읽었어요. 소리가 들어 있는 mp3·m4a·mp4 로 해 보세요';
    return;
  }
  my.buf = buf;
  my.mono = monoOf(buf);
  myDetect();
}
/** BPM·박 찾기 (노래 가운데쯤에서 재고, 앞뒤로 같은 박 간격을 이어 씀) */
function myDetect(hintBpm = null) {
  const buf = my.buf;
  const sr = buf.sampleRate;
  my.sound0 = soundStart(my.mono, sr);
  const winStart = Math.max(my.sound0 + 3, Math.min(buf.duration * 0.3, buf.duration - 26));
  const r = detectBeat(my.mono, sr, { start: Math.max(0, winStart), hintBpm });
  if (!r) {
    $('#my-status').textContent = '박자를 못 찾았어요. 드럼 소리가 뚜렷한 노래로 해 보세요';
    return;
  }
  my.bpm = Math.round(r.bpm * 10) / 10;
  my.beat0 = r.firstBeat; // 노래 가운데쯤의 '쿵' 박
  const m = Math.floor(buf.duration / 60);
  $('#my-status').innerHTML = `<b>${escapeHtml(my.name)}</b> · ${m}:${String(Math.floor(buf.duration % 60)).padStart(2, '0')} · <b>${my.bpm} BPM</b>${r.confidence < 0.3 ? ' · 박이 흐릿해서 조금 어긋날 수 있어요' : ''}${buf.partial ? `<br>⚠️ 영상 앞 ${Math.round(buf.duration)}초만 읽혔어요 (읽는 동안 화면을 켜 두세요)` : ''}`;
  $('#my-bpm').textContent = `${my.bpm} BPM`;
  $('#my-opts').hidden = false;
}
function myMul(m) {
  if (!my.buf || !my.bpm) return;
  const want = my.bpm * m;
  if (want < 50 || want > 220) return toast('더는 바꿀 수 없어요');
  myDetect(want);
  toast(`${my.bpm} BPM 으로 바꿨어요`, 1400);
}
/** 고른 옵션으로 채보 만들기 → 판 */
function myBuild() {
  const buf = my.buf;
  const beat = 60 / my.bpm;
  const bar = beat * 4;
  // 시작: 처음부터면 첫 소리, 아니면 적은 시각. '쿵' 박 줄(2박 간격)에 맞춰 그 뒤 첫 박
  const pick = my.from === 'pick' ? parseTime($('#my-start').value) : null;
  const from = Math.max(0, Math.min(buf.duration - 12, pick ?? my.sound0));
  const k = Math.ceil((from - my.beat0) / (beat * 2) - 1e-6);
  const first = my.beat0 + k * beat * 2;
  const len = Number($('#my-len').value) || 0;
  const end = len ? Math.min(buf.duration, first + len) : buf.duration;
  const bars = Math.floor((end - first) / bar);
  if (bars < 2) return null;
  const chart = songChart(my.mono, buf.sampleRate, { firstBeat: first, bpm: my.bpm, bars, diff: my.diff });
  if (!chart.bars.some((b) => /[^.]/.test(b))) return null;
  const countIn = bar * COUNT_IN_BARS;
  return {
    id: MY_ID,
    custom: true,
    name: my.name || '내 노래',
    composer: '내 노래',
    songName: my.name || '내 노래',
    tagline: '',
    theme: 'city',
    difficulty: my.diff === 'hard' ? 5 : my.diff === 'normal' ? 3 : 1,
    bpm: my.bpm,
    bars: chart.bars,
    // 노래 파일: 채보 첫 마디 = 노래의 first 초. 처음부터면 노래를 0초부터 틀고 채보는 그만큼 뒤에
    song: { ...LEVELS[0].song, audio: { src: my.url, offset: first, gain: 1 } },
    leadIn: pick == null ? Math.max(0, first - countIn) : 0,
  };
}
async function myStart() {
  if (!my.buf || !my.bpm) return toast('노래 파일을 먼저 골라 주세요');
  const lv = myBuild();
  if (!lv) return toast('채보를 못 만들었어요. 시작 위치나 길이를 바꿔 보세요');
  my.level = lv;
  my.rec = $('#my-rec').checked && !$('#my-rec').disabled;
  $('#my-result').hidden = true;
  await startLevel(MY_ID);
}
async function myFinish(res) {
  const blob = await stopRecorder();
  if (state.game) state.game.stop();
  if (my.blobUrl) URL.revokeObjectURL(my.blobUrl);
  my.blob = blob && blob.size ? blob : null;
  my.blobUrl = my.blob ? URL.createObjectURL(my.blob) : null;
  const acc = Math.round((res.accuracy || 0) * 100);
  $('#my-res-text').innerHTML =
    `<b class="my-grade">${res.grade}</b> ${fmt(res.score)}점 · 정확도 ${acc}% · 최대 콤보 ${res.maxCombo}` +
    `<br><small>PERFECT ${res.counts.perfect} · GREAT ${res.counts.great} · GOOD ${res.counts.good} · MISS ${res.counts.miss}</small>`;
  const v = $('#my-video');
  v.hidden = !my.blobUrl;
  $('#my-save').hidden = !my.blobUrl;
  if (my.blobUrl) {
    v.src = my.blobUrl;
    v.onloadedmetadata = () => {
      try {
        v.currentTime = 0.1;
      } catch {}
    };
  }
  $('#my-result').hidden = false;
  openMysong();
  requestAnimationFrame(() => $('#my-result').scrollIntoView({ block: 'start' }));
}
async function mySave() {
  if (!my.blob) return;
  const ext = my.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([my.blob], `okaystra-내노래.${ext}`, { type: my.blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = my.blobUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------------- 🎹 유저 맵 ----------------
//   유저가 피아노로 멜로디를 찍고(또는 노래 파일에서 음을 따서) 드럼 노트를 붙여 올리는 맵. 운영자 개입 없음
//   올라가는 건 음표 데이터뿐 (몇 KB). 요청: 목록 볼 때(1분 캐시) · 맵 받을 때 · 올리기/좋아요/신고 누를 때만
const UM_ID = 'um';
const um = { level: null, from: 'list', sort: 'new', mapId: null, list: null, wasAuto: false, mode: load('mapMode', 'free') === 'hearts' ? 'hearts' : 'free', top: null };
const newDraft = () => ({ name: '', bpm: 100, mel: [[], [], [], []], drums: autoDrums([[], [], [], []], 'easy'), drumsAuto: 'easy', bar: 0, cur: 0, len: 2, oct: 4, way: 'play', step: false, tab: 'mel' });
let mk = load('mapDraft', null);
if (!mk || !Array.isArray(mk.mel) || !Array.isArray(mk.drums) || mk.mel.length !== mk.drums.length || mk.mel.length < 2) mk = newDraft();
if (!['drum', 'mel', 'done'].includes(mk.tab)) mk.tab = 'mel';
if (!['play', 'file', 'score'].includes(mk.way)) mk.way = 'play';
const mkSave = () => save('mapDraft', mk);
/** ↩ 되돌리기: 녹음·자동 채우기 직전 모습 하나 (폰에 저장 안 함) */
let mkUndo = null;
const mkSnap = () => {
  mkUndo = JSON.stringify({ mel: mk.mel, drums: mk.drums, drumsAuto: mk.drumsAuto, bpm: mk.bpm, prog: mk.prog || null, songDrums: mk.songDrums || null, low: mk.low || null });
  $('#mk-undo').disabled = false;
};
const umLikes = () => load('mapLikes', {});

function openMaps() {
  if (followGated()) {
    openVerify(null, { label: '🎹 유저 맵은 팔로워만', then: openMaps });
    return;
  }
  if (state.game) state.game.stop();
  $$('#maps-sort button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sort === um.sort));
  show('screen-maps');
  loadMaps();
}
async function loadMaps(fresh = false) {
  const box = $('#maps-list');
  if (!state.api.maps) {
    box.innerHTML = '<p class="rank-empty">지금은 서버에 연결이 안 돼서 유저 맵을 못 불러와요</p>';
    return;
  }
  if (!um.list) box.innerHTML = '<p class="rank-empty">불러오는 중…</p>';
  try {
    const r = await state.api.maps(um.sort, fresh);
    um.list = r.maps || [];
    um.snap = r.snap || null;
    renderMaps();
  } catch (e) {
    box.innerHTML = e.status === 503 ? snapNotice(null).replace('랭킹은', '유저 맵은') : `<p class="rank-empty">${e.status === 429 ? '오늘 서버가 바빠요. 내일 오전 9시에 다시 열려요' : '못 불러왔어요. 잠시 뒤 다시 해 보세요'}</p>`;
  }
}
/** 📴 서버가 쉬는 동안 유저 맵 목록 위 안내 */
function mapsSnapNotice() {
  const n = snapNotice({ snap: um.snap });
  return n.replace('</b> 기준 랭킹이에요', '</b>까지 올라온 맵이에요 · 지금은 치기만 돼요').replace('실시간으로 업데이트돼요', '기록·좋아요·올리기가 다시 돼요');
}
function renderMaps() {
  const box = $('#maps-list');
  const likes = umLikes();
  if (!um.list.length) {
    box.innerHTML = '<p class="rank-empty">아직 올라온 맵이 없어요</p>';
    return;
  }
  box.innerHTML = (um.snap ? mapsSnapNotice() : '') + um.list
    .map((m) => {
      const liked = !!likes[m.id];
      return `<div class="map-card" data-id="${m.id}">
        <div class="map-info"><h4>${escapeHtml(m.name)}</h4>
          <p>${escapeHtml(m.nick || '익명')} · ${Math.round(m.bpm)} BPM · ${m.bars}마디 · ${DIFFICULTY_WORDS[m.diff] || ''}</p>
          <p class="map-meta">▶ ${fmt(m.plays)} · ❤ ${fmt(m.likes)}</p></div>
        <div class="map-btns">
          <button class="btn btn-primary map-play" type="button" data-map-act="play">▶ 치기</button>
          <div class="map-small">
            <button type="button" data-map-act="like" aria-pressed="${liked}">❤ 좋아요</button>
            ${m.mine ? '<button type="button" data-map-act="delete">지우기</button>' : '<button type="button" data-map-act="report">신고</button>'}
          </div>
        </div>
      </div>`;
    })
    .join('');
}
async function mapAct(id, act, btn) {
  const m = (um.list || []).find((x) => x.id === id);
  if (act === 'play') return playMap(id);
  try {
    if (act === 'like') {
      const likes = umLikes();
      const on = !likes[id];
      const r = await state.api.mapVote(id, 'like', on);
      if (on) likes[id] = 1;
      else delete likes[id];
      save('mapLikes', likes);
      if (m) m.likes = r.likes;
      renderMaps();
      return;
    }
    if (act === 'report') {
      if (!confirm('이 맵을 신고할까요?')) return;
      await state.api.mapVote(id, 'report', true);
      toast('신고했어요. 고마워요', 1800);
      if (btn) btn.disabled = true;
      return;
    }
    if (act === 'delete') {
      if (!confirm('내 맵을 지울까요? 되돌릴 수 없어요')) return;
      await state.api.mapDelete(id);
      um.list = um.list.filter((x) => x.id !== id);
      renderMaps();
      toast('지웠어요', 1400);
    }
  } catch (e) {
    toast(e.status === 403 ? '팔로워 인증을 하면 쓸 수 있어요' : e.status === 404 ? '이미 내려간 맵이에요' : e.status === 503 ? '서버가 쉬는 중이라 오전 9시부터 돼요' : '잠시 뒤 다시 해 보세요', 2200);
  }
}
async function playMap(id) {
  toast('맵 받는 중…', 1500);
  let r;
  try {
    r = await state.api.mapGet(id);
  } catch (e) {
    toast(e.status === 404 ? '이미 내려간 맵이에요' : '맵을 못 받았어요. 다시 해 보세요', 2200);
    if (e.status === 404) loadMaps(true);
    return;
  }
  const map = r.map && cleanMap(r.map.data);
  if (!map) return toast('맵이 이상해요', 2000);
  um.level = mapLevel(map, { id: UM_ID, by: r.map.nick || '', mapId: id });
  um.from = 'list';
  um.mapId = id;
  um.top = r.top || null;
  openMapMode(r.map.name);
}
/** 🛡 무적 / ❤ 하트 5개 고르기 + 모드별 1~3등 (맵 받을 때 같이 온 것) */
function mapTopHTML(list) {
  if (!list || !list.length) return '<li class="mm-empty">아직 기록 없음</li>';
  const medal = ['🥇', '🥈', '🥉'];
  return list.map((r, i) => `<li><span>${medal[i]}</span><em>${escapeHtml(r.nick || '익명')}</em><b>${fmt(r.score)}</b></li>`).join('');
}
function openMapMode(name) {
  $('#mm-name').textContent = name || '유저 맵';
  for (const mode of ['free', 'hearts']) {
    $(`#mm-top-${mode}`).innerHTML = mapTopHTML(um.top && um.top[mode]);
    $(`#modal-mapmode [data-mm="${mode}"]`).setAttribute('aria-pressed', String(um.mode === mode));
  }
  openModal('modal-mapmode');
}
async function startMapMode(mode) {
  um.mode = mode === 'hearts' ? 'hearts' : 'free';
  save('mapMode', um.mode);
  closeModal('modal-mapmode');
  await startLevel(UM_ID);
}
/** ❤ 하트 모드: 다 쓰면 이어하기 없이 바로 끝 (기록 안 남음) */
function umDeath() {
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
}
/** 판 끝 (유저 맵) */
function umFinish(res) {
  if (state.game) state.game.stop();
  const auto = state.auto;
  if (um.wasAuto) {
    state.auto = false;
    um.wasAuto = false;
  }
  if (um.from === 'make') {
    openMapMake();
    if (!auto) toast(`${res.grade} · ${fmt(res.score)}점 · 정확도 ${Math.round((res.accuracy || 0) * 100)}%`, 3000);
    return;
  }
  show('screen-maps');
  const acc = Math.round((res.accuracy || 0) * 100);
  const liked = !!umLikes()[um.mapId];
  const box = $('#maps-list');
  const banner = document.createElement('div');
  banner.className = 'map-res';
  const mode = um.mode;
  const modeName = mode === 'hearts' ? '❤ 하트 5개' : '🛡 무적';
  // 🏆 기록 보내기: 무적은 끝까지 친 판, 하트는 살아남은 판만 (판마다 요청 1번)
  const canRank = !auto && !res.practice && !res.stopped && um.mapId && state.api.mapScore && !(mode === 'hearts' && res.failed);
  banner.innerHTML = `<b>${res.failed ? '💔' : res.grade}</b> ${fmt(res.score)}점 · 정확도 ${acc}% · 최대 콤보 ${res.maxCombo}
    <div class="map-rank"><small>${modeName} 랭킹</small><ol id="map-res-top">${res.failed && mode === 'hearts' ? '<li class="mm-empty">하트를 다 써서 이번 판은 기록이 안 남아요</li>' : canRank ? '<li class="mm-empty">기록 올리는 중…</li>' : mapTopHTML(um.top && um.top[mode])}</ol></div>
    <div class="map-res-btns"><button class="btn btn-ghost" type="button" data-map-again>다시 치기</button>${liked ? '' : '<button class="btn btn-hot" type="button" data-map-like>❤ 이 맵 좋아요</button>'}</div>`;
  if (canRank) {
    const id = um.mapId;
    state.api
      .mapScore(id, mode, res.score)
      .then((r) => {
        if (um.mapId !== id) return;
        um.top = r.top || um.top;
        const ol = banner.querySelector('#map-res-top');
        if (ol) ol.innerHTML = mapTopHTML(um.top && um.top[mode]);
        const rank = (um.top && um.top[mode] ? um.top[mode] : []).findIndex((x) => x.nick === (state.me && state.me.player && state.me.player.username) && x.score === res.score);
        if (rank >= 0) toast(`${['🥇 1등', '🥈 2등', '🥉 3등'][rank]}! ${modeName} 랭킹에 올랐어요`, 2600);
        else if (r.best) toast('내 최고 기록!', 1600);
      })
      .catch(() => {
        const ol = banner.querySelector('#map-res-top');
        if (ol) ol.innerHTML = '<li class="mm-empty">기록을 못 올렸어요 (서버가 바빠요)</li>';
      });
  }
  box.querySelector('.map-res')?.remove();
  box.prepend(banner);
  banner.querySelector('[data-map-again]').onclick = () => openMapMode(um.level && um.level.name);
  const lb = banner.querySelector('[data-map-like]');
  if (lb)
    lb.onclick = async () => {
      lb.disabled = true;
      await mapAct(um.mapId, 'like');
      $('#maps-list').prepend(banner);
      lb.remove();
    };
  $('#screen-maps').scrollTop = 0;
}
function umQuit() {
  if (um.wasAuto) {
    state.auto = false;
    um.wasAuto = false;
  }
  if (um.from === 'make') openMapMake();
  else openMaps();
}

// ----- 맵 만들기 -----
//   ① 멜로디: 노래 파일에서 자동으로 따거나, 똑딱 소리에 맞춰 건반을 쳐서 녹음 (자세히 고치기 = 한 칸씩)
//   ② 드럼: 멜로디에 맞춰 자동 (쉬움·보통·어려움), 원하면 한 칸씩
//   ③ 처음부터 듣기 → 직접 쳐 보기 → 올리기
const MAPMAKE_OFF = false;
function openMapMake() {
  if (followGated()) {
    openVerify(null, { label: '🎹 맵 만들기는 팔로워만', then: openMapMake });
    return;
  }
  if (state.game) state.game.stop();
  audio.loadPiano();
  show('screen-mapmake');
  // 처음 뜨는 탭은 늘 🎹 멜로디 (사용자 요청 11-21)
  mk.tab = 'mel';
  $('#mk-name').value = mk.name;
  $('#mk-step').checked = !!mk.step;
  mkRender();
}
function mkFixBars() {
  while (mk.drums.length < mk.mel.length) mk.drums.push('K...S...K...S...');
  mk.drums.length = mk.mel.length;
  // 🎵 노래 드럼: 노래에서 딴 그대로 (마디 수가 안 맞게 바뀌면 내가 친 드럼으로)
  if (mk.drumsAuto === 'song' && !(Array.isArray(mk.songDrums) && mk.songDrums.length === mk.mel.length)) mk.drumsAuto = null;
  if (mk.drumsAuto === 'song') mk.drums = [...mk.songDrums];
  else if (mk.drumsAuto) mk.drums = autoDrums(mk.mel, mk.drumsAuto);
  // 🎹 왼손(악보 아래 줄): 마디 수를 멜로디에 맞춤
  if (Array.isArray(mk.low)) {
    while (mk.low.length < mk.mel.length) mk.low.push([]);
    mk.low.length = mk.mel.length;
    if (!mk.low.some((b) => b.length)) mk.low = null;
  }
  mk.bar = Math.max(0, Math.min(mk.mel.length - 1, mk.bar));
  mk.cur = Math.max(0, Math.min(STEPS_PER_BAR - 1, mk.cur));
  mkSave();
}
/** 화음: 노래 파일에서 딴 코드가 있으면 그것(곡의 진짜 코드), 없으면 멜로디로 짐작 */
function mkProg() {
  if (Array.isArray(mk.prog) && mk.prog.length === mk.mel.length && mk.mel.some((b) => b.length)) return mk.prog;
  return harmonize(mk.mel);
}
/** 마디 번호 글자 (탭마다 하나씩 있음) */
function mkBarText() {
  $$('.mk-barno').forEach((el) => (el.textContent = `${mk.bar + 1} / ${mk.mel.length} 마디`));
  const pb = $('#mk-play-bar');
  if (pb && !mkp.bus) pb.textContent = `${mk.bar + 1}마디부터`;
}
const mkDrumNotes = () => mk.drums.reduce((a, d) => a + [...d].reduce((x, c) => x + (CHAR_LANES[c] || []).length, 0), 0);
const mkMelNotes = () => mk.mel.reduce((a, b) => a + b.length, 0);
/** 🎨 맵 꾸미기 (2026-11-23 사용자): 상점 무료 것(맵 무대·맵 드럼·색 콩) 중에서 만든 사람이 고름 → 맵에 같이 올라감 */
const MK_DECO_ROWS = [['bg', '🌄 무대'], ['kit', '🥁 드럼'], ['notes', '✨ 콩 색']];
function mkDecoRender() {
  const d = mk.deco || {};
  $('#mk-deco').innerHTML =
    '<h4>🎨 꾸미기</h4>' +
    MK_DECO_ROWS.map(([type, label]) => {
      const keys = [null, ...MAP_DECO[type]];
      return `<div class="mk-deco-row"><b>${label}</b><div class="chips">${keys
        .map((k) => {
          const name = k ? shopName(type, k) : type === 'notes' ? '기본 콩' : '자동';
          const sw = shopSwatch(type, k || DECO_FREE[type]);
          return `<button type="button" data-mkdeco="${type}:${k || ''}" aria-pressed="${(d[type] || null) === k}"><i style="background:${sw}"></i>${escapeHtml(name)}</button>`;
        })
        .join('')}</div></div>`;
    }).join('');
}
function mkRender() {
  $('#mk-bpm').textContent = String(mk.bpm);
  mkBarText();
  // 탭
  $$('#mk-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === mk.tab)));
  for (const t of ['drum', 'mel', 'done']) $(`#mk-pane-${t}`).hidden = mk.tab !== t;
  const dn = mkDrumNotes();
  const mn = mkMelNotes();
  $('#mk-tab-drum').textContent = `노트 ${dn}개`;
  $('#mk-tab-mel').textContent = mn ? `음 ${mn}개` : '없음 (드럼만)';
  $('#mk-tab-bars').textContent = `${mk.mel.length}마디`;
  $('#mk-sum').innerHTML = `🥁 드럼 노트 <b>${dn}</b>개 · 🎹 멜로디 ${mn ? `음 <b>${mn}</b>개` : '<b>없음</b> (드럼만 나오는 맵)'}<br>${mk.mel.length}마디 · ${mk.bpm} BPM · 약 ${Math.round((mk.mel.length * 4 * 60) / mk.bpm)}초`;
  mkDecoRender();
  $$('#mk-way button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.way === mk.way));
  $('#mk-way-file').hidden = mk.way !== 'file';
  $('#mk-way-play').hidden = mk.way !== 'play';
  $('#mk-way-score').hidden = mk.way !== 'score';
  $$('#mk-len button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.len) === mk.len));
  $$('#mk-auto button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.diff === mk.drumsAuto));
  $('#mk-auto-song').hidden = !(Array.isArray(mk.songDrums) && mk.songDrums.length === mk.mel.length);
  $('#mk-drum-state').textContent =
    mk.drumsAuto === 'song' ? '· 지금: 노래 드럼 그대로' : mk.drumsAuto ? `· 지금: 자동 ${{ easy: '쉬움', normal: '보통', hard: '어려움' }[mk.drumsAuto] || ''}` : '· 지금: 내가 친 드럼';
  $('#mk-octlabel').textContent = `${midiName(12 * (mk.oct + 1))} ~ ${midiName(12 * (mk.oct + 1) + 23)}`;
  mkKeys();
  mkRoll();
  mkDroll();
  mkGrid();
}
/** 지금 마디 드럼 그림 (4줄 × 16칸). head = 재생·녹음 중 위치 */
const DROLL_ROWS = [
  [CRASH, '크래시', '#e7b52c'],
  [HAT, '하이햇', '#25b865'],
  [SNARE, '짝', '#3d9bff'],
  [KICK, '쿵', '#ff7a3d'],
];
function mkDroll(head = null) {
  const cv = $('#mk-droll');
  if (!cv || !cv.clientWidth) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = 120;
  if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
  if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fffaf3';
  g.fillRect(0, 0, w, h);
  const lx = 44;
  const cw = (w - lx) / STEPS_PER_BAR;
  const rh = h / DROLL_ROWS.length;
  g.font = '11px sans-serif';
  g.textBaseline = 'middle';
  DROLL_ROWS.forEach(([, label], r) => {
    g.fillStyle = '#3b2a4a';
    g.fillText(label, 6, r * rh + rh / 2);
  });
  for (let st = 0; st <= STEPS_PER_BAR; st++) {
    g.fillStyle = st % 4 === 0 ? 'rgba(59,42,74,0.35)' : 'rgba(59,42,74,0.1)';
    g.fillRect(lx + Math.round(st * cw) - (st % 4 === 0 ? 1 : 0), 0, st % 4 === 0 ? 2 : 1, h);
  }
  // 고른 칸 (패드를 치면 여기에 들어감)
  if (mk.dsel != null && !drec.on) {
    g.fillStyle = 'rgba(255,47,125,0.16)';
    g.fillRect(lx + mk.dsel * cw, 0, cw, h);
    g.strokeStyle = '#ff2f7d';
    g.lineWidth = 2;
    g.strokeRect(lx + mk.dsel * cw + 1, 1, cw - 2, h - 2);
  }
  const bar = mk.drums[mk.bar] || '';
  [...bar].forEach((ch, st) => {
    const lanes = CHAR_LANES[ch] || [];
    DROLL_ROWS.forEach(([lane, , color], r) => {
      if (!lanes.includes(lane)) return;
      g.fillStyle = color;
      g.beginPath();
      g.arc(lx + (st + 0.5) * cw, r * rh + rh / 2, Math.min(cw, rh) * 0.38, 0, Math.PI * 2);
      g.fill();
    });
  });
  if (head != null && head >= 0) {
    g.fillStyle = '#ff2f7d';
    g.fillRect(lx + head * cw - 1, 0, 3, h);
  }
}
function mkKeys() {
  const box = $('#mk-keys');
  const base = 12 * (mk.oct + 1);
  if (box.dataset.base === String(base)) return;
  box.dataset.base = String(base);
  const whites = [];
  const blacks = [];
  let wi = 0;
  for (let m = base; m < base + 24; m++) {
    const pc = m % 12;
    if ([1, 3, 6, 8, 10].includes(pc)) blacks.push(`<button type="button" class="mk-key black" data-midi="${m}" style="left:calc(${(wi / 14) * 100}% - 3.2%)"></button>`);
    else {
      whites.push(`<button type="button" class="mk-key" data-midi="${m}"><small>${pc === 0 ? midiName(m) : SOLFA[pc]}</small></button>`);
      wi++;
    }
  }
  box.innerHTML = whites.join('') + blacks.join('');
}
/** 지금 마디 멜로디 그림 (가로 16칸, 세로 음높이). head = 재생·녹음 중 위치(칸, 소수) */
function mkRoll(head = null) {
  const cv = $('#mk-roll');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 320;
  const h = 130;
  if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
  if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fffaf3';
  g.fillRect(0, 0, w, h);
  const notes = mk.mel[mk.bar] || [];
  // 세로: 이 마디 음들 둘레만 (없으면 건반 범위 가운데). 음이 크게 보이게
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
  if (lo === Infinity) (lo = 12 * (mk.oct + 1) + 5), (hi = lo + 12);
  lo -= 2;
  hi += 2;
  while (hi - lo < 12) (lo--, hi++);
  const rows = hi - lo + 1;
  const cw = w / STEPS_PER_BAR;
  const rh = h / rows;
  for (let m = lo; m <= hi; m++) {
    if ([1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12)) {
      g.fillStyle = 'rgba(59,42,74,0.06)';
      g.fillRect(0, h - (m - lo + 1) * rh, w, rh);
    }
  }
  for (let s = 0; s <= STEPS_PER_BAR; s++) {
    g.fillStyle = s % 4 === 0 ? 'rgba(59,42,74,0.35)' : 'rgba(59,42,74,0.1)';
    g.fillRect(Math.round(s * cw) - (s % 4 === 0 ? 1 : 0), 0, s % 4 === 0 ? 2 : 1, h);
  }
  if (head == null && mk.step) {
    g.fillStyle = 'rgba(255,95,162,0.22)';
    g.fillRect(mk.cur * cw, 0, Math.min(mk.len, STEPS_PER_BAR - mk.cur) * cw, h);
    g.fillStyle = '#ff2f7d';
    g.fillRect(mk.cur * cw, 0, 3, h);
  }
  g.font = '12px sans-serif';
  g.textBaseline = 'middle';
  for (const n of notes) {
    const y = h - (n.midi - lo + 1) * rh;
    g.fillStyle = '#ff8a4c';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 1.5;
    g.beginPath();
    if (g.roundRect) g.roundRect(n.step * cw + 1, y + 1, n.len * cw - 2, rh - 2, 4);
    else g.rect(n.step * cw + 1, y + 1, n.len * cw - 2, rh - 2);
    g.fill();
    g.stroke();
    if (n.len * cw > 22 && rh > 11) {
      g.fillStyle = '#3b2a4a';
      g.fillText(SOLFA[n.midi % 12], n.step * cw + 4, y + rh / 2);
    }
  }
  if (head != null) {
    g.fillStyle = '#2f8cff';
    g.fillRect(head * cw - 1, 0, 3, h);
  }
}
function mkGrid() {
  if (!$('#mk-drum-more').open) return;
  const rows = [
    ['C', '크래시'],
    ['K', '킥 (쿵)'],
    ['S', '스네어 (짝)'],
    ['H', '하이햇'],
  ];
  const bar = mk.drums[mk.bar];
  $('#mk-grid').innerHTML = rows
    .map(
      ([k, label]) =>
        `<div class="mk-grow"><span>${label}</span><div class="mk-cells">${[...bar]
          .map((ch, s) => `<button type="button" class="mk-cell${s % 4 === 0 ? ' beat' : ''}" data-step="${s}" data-inst="${k}" aria-pressed="${drumCell(ch)[k]}"></button>`)
          .join('')}</div></div>`
    )
    .join('');
}
const LANE_OF = { K: KICK, S: SNARE, H: HAT, C: CRASH };
function mkDrumTap(step, inst) {
  const bar = [...mk.drums[mk.bar]];
  bar[step] = toggleDrum(bar[step], inst);
  mk.drums[mk.bar] = bar.join('');
  mk.drumsAuto = null;
  if (drumCell(bar[step])[inst]) mkSound(() => audio.playLane(LANE_OF[inst], audio.ctx.currentTime + 0.01));
  mkSave();
  mkRender();
}
/** 소리 내기 (처음엔 소리 엔진을 깨움) */
function mkSound(fn) {
  audio.unlock();
  if (!audio.ctx) return;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
}
/** bar 마디의 from 칸부터 len 칸을 비움 (걸쳐 있던 음은 잘라냄) */
function mkClearRange(bar, from, len) {
  const to = from + len;
  const out = [];
  for (const n of mk.mel[bar]) {
    const end = n.step + n.len;
    if (end <= from || n.step >= to) out.push(n);
    else if (n.step < from) out.push({ ...n, len: from - n.step });
    else if (end > to) out.push({ ...n, step: to, len: end - to });
  }
  mk.mel[bar] = out.sort((a, b) => a.step - b.step);
}
/** 전체 칸 번호 at 에 음 넣기 (마디를 넘으면 그 마디 끝에서 자름, 모자란 마디는 만듦) */
function mkPut(at, midi, len) {
  const bar = Math.floor(at / STEPS_PER_BAR);
  if (bar >= MAP_LIMITS.maxBars) return false;
  while (mk.mel.length <= bar) mk.mel.push([]);
  const step = at % STEPS_PER_BAR;
  len = Math.max(1, Math.min(len, STEPS_PER_BAR - step));
  mkClearRange(bar, step, len);
  mk.mel[bar].push({ step, midi, len });
  mk.mel[bar].sort((a, b) => a.step - b.step);
  return true;
}
function mkAdvance(len) {
  mk.cur += len;
  if (mk.cur >= STEPS_PER_BAR) {
    mk.cur = 0;
    if (mk.bar + 1 >= mk.mel.length) {
      if (mk.mel.length >= MAP_LIMITS.maxBars) {
        mk.cur = STEPS_PER_BAR - 1;
        toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
        return;
      }
      mk.mel.push([]);
    }
    mk.bar++;
  }
}
/** 건반 누름: 녹음 중이면 녹음, 한 칸씩 넣기면 빨간 줄 자리에, 아니면 소리만 */
function mkKeyDown(midi, el) {
  mkSound(() => audio.lead(audio.ctx.currentTime + 0.005, midi, 0.6, audio.musicBus));
  if (rec.on) return recDown(midi, el);
  if (!mk.step) return;
  const len = Math.min(mk.len, STEPS_PER_BAR - mk.cur);
  mkPut(mk.bar * STEPS_PER_BAR + mk.cur, midi, len);
  mkAdvance(len);
  mkFixBars();
  mkRender();
}
function mkRest() {
  const len = Math.min(mk.len, STEPS_PER_BAR - mk.cur);
  mkClearRange(mk.bar, mk.cur, len);
  mkAdvance(len);
  mkFixBars();
  mkRender();
}
/** 한 칸 지우기: 지금 칸 바로 앞 음을 지우고 그 자리로 */
function mkBack() {
  for (let tries = 0; tries < 2; tries++) {
    const notes = mk.mel[mk.bar];
    const prev = notes.filter((n) => n.step < mk.cur || (mk.cur === 0 && n.step === 0)).pop();
    if (prev) {
      notes.splice(notes.indexOf(prev), 1);
      mk.cur = prev.step;
      break;
    }
    if (mk.cur > 0) {
      mk.cur = 0;
      break;
    }
    if (mk.bar === 0) break;
    mk.bar--;
    mk.cur = STEPS_PER_BAR;
  }
  mk.cur = Math.min(mk.cur, STEPS_PER_BAR - 1);
  mkFixBars();
  mkRender();
}
function mkBarOp(op) {
  const b = mk.bar;
  mkSnap();
  if (op === 'add' || op === 'copy') {
    if (mk.mel.length >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    mk.mel.splice(b + 1, 0, op === 'copy' ? mk.mel[b].map((n) => ({ ...n })) : []);
    mk.drums.splice(b + 1, 0, op === 'copy' ? mk.drums[b] : 'K...S...K...S...');
    for (const k of ['prog', 'songDrums']) if (Array.isArray(mk[k]) && mk[k].length === mk.mel.length - 1) mk[k].splice(b + 1, 0, mk[k][b]);
    mk.bar = b + 1;
    mk.cur = 0;
    if (op === 'copy') toast('마디를 복사해서 뒤에 넣었어요', 1400);
  } else if (op === 'clear') {
    mk.mel[b] = [];
    mk.cur = 0;
  } else if (op === 'del') {
    if (mk.mel.length <= MAP_LIMITS.minBars) return toast(`${MAP_LIMITS.minBars}마디는 있어야 해요`, 1400);
    mk.mel.splice(b, 1);
    mk.drums.splice(b, 1);
    for (const k of ['prog', 'songDrums']) if (Array.isArray(mk[k]) && mk[k].length === mk.mel.length + 1) mk[k].splice(b, 1);
  }
  mkFixBars();
  mkRender();
}

// ----- ▶ 처음부터 듣기 (멜로디 + 화음 + 드럼, 조금씩 앞서 예약) -----
const mkp = { bus: null, raf: 0, t0: 0, sd: 0, next: 0, steps: 0, prog: null };
function mkStopPlay() {
  if (!mkp.bus) return;
  const b = mkp.bus;
  mkp.bus = null;
  cancelAnimationFrame(mkp.raf);
  try {
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.03);
    setTimeout(() => b.disconnect(), 400);
  } catch {}
  $('#mk-play-label').textContent = '처음부터 듣기';
  $('#mk-play [data-icon]').innerHTML = icon('play');
  $('#mk-play').classList.remove('playing');
  mkBarText();
  mkRoll();
  mkDroll();
}
/** from = 시작 마디 (0 = 처음부터, 유저 건의 11-22 '해당 마디부터 재생') */
function mkPlayToggle(from = 0) {
  if (mkp.bus) return mkStopPlay();
  from = Math.max(0, Math.min(mk.mel.length - 1, from | 0));
  if (rec.on) recStop();
  if (drec.on) drecStop();
  mkSound(() => {
    const ctx = audio.ctx;
    const bus = ctx.createGain();
    bus.connect(audio.musicBus);
    mkp.bus = bus;
    mkp.sd = 15 / mk.bpm;
    mkp.next = from * STEPS_PER_BAR;
    mkp.t0 = ctx.currentTime + 0.15 - mkp.next * mkp.sd;
    mkp.steps = mk.mel.length * STEPS_PER_BAR;
    mkp.prog = mkProg();
    $('#mk-play-label').textContent = '멈춤';
    $('#mk-play [data-icon]').innerHTML = icon('pause');
    $('#mk-play').classList.add('playing');
    $('#mk-play-bar').textContent = '■ 멈춤';
    const tick = () => {
      if (mkp.bus !== bus) return;
      const now = ctx.currentTime;
      // 0.3초 앞까지 예약
      while (mkp.next < mkp.steps && mkp.t0 + mkp.next * mkp.sd < now + 0.3) {
        mkPlayStep(mkp.next, mkp.t0 + mkp.next * mkp.sd, bus, mkp.prog, mkp.sd, true);
        mkp.next++;
      }
      const pos = (now - mkp.t0) / mkp.sd;
      if (pos >= mkp.steps + 4) return mkStopPlay();
      const bar = Math.max(0, Math.min(mk.mel.length - 1, Math.floor(pos / STEPS_PER_BAR)));
      if (bar !== mk.bar) {
        mk.bar = bar;
        mkBarText();
        mkGrid();
      }
      const head = pos < 0 ? 0 : Math.min(STEPS_PER_BAR, pos - bar * STEPS_PER_BAR);
      mkRoll(head);
      mkDroll(head);
      mkp.raf = requestAnimationFrame(tick);
    };
    tick();
  });
}
function mkPlayStep(i, t, bus, prog, sd, drums) {
  const b = Math.floor(i / STEPS_PER_BAR);
  const s = i % STEPS_PER_BAR;
  for (const n of mk.mel[b] || []) if (n.step === s) audio.lead(t, n.midi, n.len * sd * 0.92, bus);
  if (mkDrumOnly()) {
    // 🥁 드럼만: 반주 없이 드럼만 (녹음 중엔 똑딱 소리만)
    if (drums) for (const l of CHAR_LANES[(mk.drums[b] || '')[s]] || []) audio.playLane(l, t, bus);
    return;
  }
  const parts = (prog[b] || 'C').split(' ');
  const partLen = STEPS_PER_BAR / parts.length;
  if (s % partLen === 0) {
    const ch = parseChord(parts[s / partLen]);
    if (!mk.low) audio.bass(t, ch.root - 24, partLen * sd * 0.9, bus);
    if (s % 8 === 0 || partLen === 8) audio.pluck(t, ch.notes, partLen * sd * 0.8, bus, 0.5);
  }
  // 🎹 왼손(악보 아래 줄)
  if (mk.low) for (const n of mk.low[b] || []) if (n.step === s) {
    if (audio.piano) audio.pianoNote(t, n.midi, Math.max(0.2, n.len * sd * 0.95), 0.8, bus);
    else audio.bass(t, n.midi, n.len * sd * 0.9, bus);
  }
  if (drums) for (const l of CHAR_LANES[(mk.drums[b] || '')[s]] || []) audio.playLane(l, t, bus);
}

// ----- 🥁 드럼 직접 쳐서 만들기 (멜로디를 틀어 주고 패드를 치면 그 자리에 노트) -----
//   치는 동안 마디가 늘어남 (최대 64). 「겹쳐 치기」면 지금 드럼을 두고 더함
const drec = { on: false, bus: null, t0: 0, sd: 0, startBar: 0, next: 0, raf: 0, prog: null, q: 2, bar: -1, grow: true, from: '0', over: false };
const mkDrumOnly = () => !mk.mel.some((b) => b.length);
/** 녹음 중 bar 마디가 있게 (grow 면 늘림). 못 넣으면 false */
function drecHasBar(bar) {
  if (bar < mk.mel.length) return true;
  if (!drec.grow || bar >= MAP_LIMITS.maxBars) return false;
  while (mk.mel.length <= bar) {
    mk.mel.push([]);
    mk.drums.push('................');
  }
  return true;
}
function drecToggle() {
  if (drec.on) return drecStop();
  mkStopPlay();
  recStop();
  mkSound(() => {
    const ctx = audio.ctx;
    drec.from = $('#mk-drec-from').value;
    drec.over = $('#mk-drec-over').checked;
    drec.grow = true;
    if (drec.from === 'end') {
      // 드럼이 마지막으로 들어 있는 마디 뒤부터 (자동 드럼이면 맨 끝 뒤)
      const last = mk.drums.reduce((m, d, i) => (/[^.]/.test(d) ? i : m), -1);
      drec.startBar = mk.drumsAuto ? mk.mel.length : last + 1;
      if (drec.startBar >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    } else drec.startBar = drec.from === 'bar' ? mk.bar : 0;
    mkSnap();
    // 멜로디 없이 처음부터 새로 치면 마디 수도 친 만큼
    if (drec.from === '0' && !drec.over && mkDrumOnly()) {
      mk.mel = [[], []];
      mk.drums = ['................', '................'];
    }
    drec.q = Number($('#mk-drec-q').value) || 2;
    drec.bus = ctx.createGain();
    drec.bus.connect(audio.musicBus);
    drec.sd = 15 / mk.bpm;
    drec.prog = mkProg();
    // 똑딱 한 마디 뒤부터
    drec.t0 = ctx.currentTime + 0.2 + STEPS_PER_BAR * drec.sd;
    drec.next = -STEPS_PER_BAR;
    drec.bar = -1;
    drec.on = true;
    mk.dsel = null;
    mk.drumsAuto = null;
    mk.bar = drec.startBar;
    while (mk.mel.length <= mk.bar) mk.mel.push([]), mk.drums.push('................');
    mkRender();
    $('#mk-drec-btn').classList.add('on');
    $('#mk-drec-label').textContent = '멈춤';
    $('#mk-pads').scrollIntoView({ behavior: 'smooth', block: 'center' });
    const end = mk.mel.length * STEPS_PER_BAR;
    const tick = () => {
      if (!drec.on) return;
      const now = ctx.currentTime;
      while (drec.t0 + drec.next * drec.sd < now + 0.25) {
        const t = drec.t0 + drec.next * drec.sd;
        const at = drec.startBar * STEPS_PER_BAR + drec.next;
        if (drec.next % 4 === 0) audio.click(t, drec.next % STEPS_PER_BAR === 0, drec.bus);
        // 겹쳐 치기면 지금 드럼도 같이 (멜로디는 늘 같이)
        if (drec.next >= 0 && at < end) mkPlayStep(at, t, drec.bus, drec.prog, drec.sd, drec.over);
        drec.next++;
      }
      const pos = (now - drec.t0) / drec.sd;
      if (pos < 0) $('#mk-drec-msg').textContent = `준비… ${Math.ceil(-pos / 4)}`;
      else {
        const bar = drec.startBar + Math.floor(pos / STEPS_PER_BAR);
        if (!drecHasBar(bar)) return drecStop();
        if (bar > drec.bar) {
          // 지나가는 마디는 새로 침 (겹쳐 치기면 그대로 두고 더함)
          drec.bar = bar;
          if (!drec.over) mk.drums[bar] = '................';
        }
        if (bar !== mk.bar) {
          mk.bar = bar;
          mkBarText();
          mkGrid();
        }
        $('#mk-drec-msg').textContent = `● 드럼 녹음 중 · ${bar + 1}마디 (다 치면 「멈춤」)`;
        const head = pos - (bar - drec.startBar) * STEPS_PER_BAR;
        mkDroll(head);
      }
      drec.raf = requestAnimationFrame(tick);
    };
    tick();
  });
}
/** 패드 침: 소리는 바로, 녹음 중이면 가까운 칸에 노트 */
function padHit(inst) {
  mkSound(() => audio.playLane(LANE_OF[inst], audio.ctx.currentTime + 0.003));
  if (!drec.on) {
    // 아래 칸을 골라 뒀으면 그 칸에 노트
    if (mk.dsel == null || !mk.drums[mk.bar]) return;
    const cells = [...mk.drums[mk.bar]];
    if (drumCell(cells[mk.dsel])[inst]) return;
    cells[mk.dsel] = toggleDrum(cells[mk.dsel], inst);
    mk.drums[mk.bar] = cells.join('');
    mk.drumsAuto = null;
    mkSave();
    mkRender();
    return;
  }
  const pos = (audio.heardTime(performance.now()) - (state.settings.offsetMs || 0) / 1000 - drec.t0) / drec.sd;
  const q = Math.round(pos / drec.q) * drec.q;
  if (q < 0) return;
  const at = drec.startBar * STEPS_PER_BAR + q;
  const bar = Math.floor(at / STEPS_PER_BAR);
  if (!drecHasBar(bar)) return;
  // 다음 마디 첫 칸으로 반올림됐는데 그 마디가 아직 안 지워졌으면 지금 지움
  if (bar > drec.bar) {
    drec.bar = bar;
    if (!drec.over) mk.drums[bar] = '................';
  }
  const cells = [...mk.drums[bar]];
  const s = at % STEPS_PER_BAR;
  if (!drumCell(cells[s])[inst]) cells[s] = toggleDrum(cells[s], inst);
  mk.drums[bar] = cells.join('');
  if (bar === mk.bar) mkGrid();
  $('#mk-tab-drum').textContent = `노트 ${mkDrumNotes()}개`;
}
function drecStop() {
  if (!drec.on) return;
  drec.on = false;
  cancelAnimationFrame(drec.raf);
  try {
    const b = drec.bus;
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
    setTimeout(() => b.disconnect(), 300);
  } catch {}
  $('#mk-drec-btn').classList.remove('on');
  $('#mk-drec-label').textContent = '드럼 녹음';
  if (drec.grow) {
    // 늘린 마디 중 끝에 빈 마디(드럼·멜로디 다 없음)는 뺌
    while (mk.mel.length > MAP_LIMITS.minBars && !mk.mel[mk.mel.length - 1].length && !/[^.]/.test(mk.drums[mk.drums.length - 1])) {
      mk.mel.pop();
      mk.drums.pop();
    }
    // 멜로디 없이 처음부터 쳤으면 앞쪽 빈 마디(치기 전에 기다린 것)도 뺌
    while (drec.from === '0' && !drec.over && mkDrumOnly() && mk.drums.length > MAP_LIMITS.minBars && !/[^.]/.test(mk.drums[0])) {
      mk.mel.shift();
      mk.drums.shift();
    }
    mk.bar = Math.min(mk.bar, mk.mel.length - 1);
  }
  let n = 0;
  for (const b of mk.drums) for (const c of b) n += (CHAR_LANES[c] || []).length;
  $('#mk-drec-msg').textContent = n >= MAP_LIMITS.minNotes ? `드럼 노트 ${n}개! 「처음부터 듣기」로 들어 보고, 🎹 멜로디 탭에서 피아노를 얹어 보세요` : '노트가 너무 적어요. 똑딱 소리에 맞춰 패드를 더 쳐 주세요';
  mkSave();
  mkRender();
}

// ----- ● 건반 쳐서 녹음 (똑딱 소리에 맞춰 치면 16분·8분음표에 맞춰 넣음) -----
// 11-22 유저 건의 '음을 자세하게 인식 안 해' → 8분 고정이던 걸 고를 수 있게 (기본 16분)
const rec = { q: 1, on: false, bus: null, t0: 0, sd: 0, startBar: 0, next: -STEPS_PER_BAR, raf: 0, down: new Map(), last: null, maxStep: 0 };
function recToggle() {
  if (rec.on) return recStop();
  mkStopPlay();
  drecStop();
  mkSound(() => {
    const ctx = audio.ctx;
    const from = $('#mk-rec-from').value;
    const lastBar = mk.mel.reduce((m, bar, i) => (bar.length ? i : m), -1);
    rec.startBar = from === 'bar' ? mk.bar : from === 'end' ? lastBar + 1 : 0;
    if (rec.startBar >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    if (from === '0' && mk.mel.some((b) => b.length) && !confirm('처음부터 다시 녹음할까요? 지금 멜로디는 지워져요 (↩ 되돌리기 가능)')) return;
    mkSnap();
    if (from === '0') mk.mel = mk.mel.map(() => []);
    rec.drums = $('#mk-rec-drums').checked;
    rec.q = Number($('#mk-rec-q').value) || 1;
    rec.bus = ctx.createGain();
    rec.bus.connect(audio.musicBus);
    rec.sd = 15 / mk.bpm;
    // 똑딱 한 마디 뒤부터 녹음
    rec.t0 = ctx.currentTime + 0.2 + STEPS_PER_BAR * rec.sd;
    rec.next = -STEPS_PER_BAR;
    rec.down.clear();
    rec.last = null;
    rec.maxStep = 0;
    rec.on = true;
    mk.bar = rec.startBar;
    while (mk.mel.length <= mk.bar) mk.mel.push([]);
    mkFixBars();
    mkRender();
    $('#mk-rec').classList.add('on');
    $('#mk-rec-label').textContent = '멈춤';
    const tick = () => {
      if (!rec.on) return;
      const now = ctx.currentTime;
      while (rec.t0 + rec.next * rec.sd < now + 0.25) {
        const t = rec.t0 + rec.next * rec.sd;
        if (rec.next % 4 === 0) audio.click(t, rec.next % STEPS_PER_BAR === 0, rec.bus);
        // 🥁 만든 드럼 위에 피아노 얹기: 드럼 같이 틀기
        if (rec.drums && rec.next >= 0) {
          const at = rec.startBar * STEPS_PER_BAR + rec.next;
          const d = mk.drums[Math.floor(at / STEPS_PER_BAR)];
          if (d) for (const l of CHAR_LANES[d[at % STEPS_PER_BAR]] || []) audio.playLane(l, t, rec.bus);
        }
        rec.next++;
      }
      const pos = (now - rec.t0) / rec.sd;
      if (pos < 0) $('#mk-rec-msg').textContent = `준비… ${Math.ceil(-pos / 4)}`;
      else {
        const bar = rec.startBar + Math.floor(pos / STEPS_PER_BAR);
        if (bar >= MAP_LIMITS.maxBars) return recStop();
        $('#mk-rec-msg').textContent = `● 녹음 중 · ${bar + 1}마디 (다 치면 「멈춤」)`;
        if (bar !== mk.bar) {
          while (mk.mel.length <= bar) mk.mel.push([]);
          mk.bar = bar;
          // 녹음이 지나가는 마디의 예전 음은 비움 (덮어쓰기)
          if (from !== '0') mk.mel[bar] = [];
          mkBarText();
        }
        mkRoll(pos - (mk.bar - rec.startBar) * STEPS_PER_BAR);
      }
      rec.raf = requestAnimationFrame(tick);
    };
    if (from !== '0') mk.mel[rec.startBar] = [];
    tick();
  });
}
/** 녹음 기준 칸 위치 (소수). 박자 보정값만큼 당김 */
const recPos = () => (audio.heardTime(performance.now()) - (state.settings.offsetMs || 0) / 1000 - rec.t0) / rec.sd;
function recDown(midi, el) {
  const pos = recPos();
  if (pos < -rec.q) return;
  const q = Math.max(0, Math.round(pos / rec.q) * rec.q);
  const at = rec.startBar * STEPS_PER_BAR + q;
  // 앞 음이 아직 눌려 있으면 여기서 끊김 (한 번에 한 음)
  if (rec.last && rec.last.at < at && rec.last.open) rec.last.len = Math.max(rec.q, at - rec.last.at);
  const note = { at, midi, len: rec.q * 2, open: true };
  rec.last = note;
  rec.down.set(el || midi, { note, pos });
  mkPut(at, midi, note.len);
  rec.maxStep = Math.max(rec.maxStep, at + rec.q);
  mkRoll(pos - (mk.bar - rec.startBar) * STEPS_PER_BAR);
}
function recUp(key) {
  const d = rec.down.get(key);
  if (!d) return;
  rec.down.delete(key);
  const n = d.note;
  if (!n.open) return;
  n.open = false;
  const held = recPos() - d.pos;
  const len = Math.max(rec.q, Math.round(held / rec.q) * rec.q);
  if (rec.last === n || len < n.len) {
    n.len = len;
    // 다시 넣기 (길이만 바뀜)
    const bar = Math.floor(n.at / STEPS_PER_BAR);
    const step = n.at % STEPS_PER_BAR;
    const same = (mk.mel[bar] || []).find((x) => x.step === step && x.midi === n.midi);
    if (same) {
      mk.mel[bar].splice(mk.mel[bar].indexOf(same), 1);
      mkPut(n.at, n.midi, len);
    }
  }
}
function recStop() {
  if (!rec.on) return;
  rec.on = false;
  cancelAnimationFrame(rec.raf);
  try {
    const b = rec.bus;
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
    setTimeout(() => b.disconnect(), 300);
  } catch {}
  $('#mk-rec').classList.remove('on');
  $('#mk-rec-label').textContent = '녹음';
  // 처음부터 녹음했으면 친 데까지만 남김
  const lastBar = mk.mel.reduce((m, bar, i) => (bar.length ? i : m), -1);
  // (내가 친 드럼이 더 길면 드럼 끝까지는 남김)
  const lastDrum = mk.drumsAuto ? -1 : mk.drums.reduce((m, d, i) => (/[^.]/.test(d) ? i : m), -1);
  if ($('#mk-rec-from').value === '0' && lastBar >= 0) mk.mel.length = Math.max(MAP_LIMITS.minBars, lastBar + 1, lastDrum + 1);
  const n = mk.mel.reduce((a, b) => a + b.length, 0);
  $('#mk-rec-msg').textContent = n ? `녹음했어요! 「처음부터 듣기」로 드럼이랑 같이 들어 보세요` : '음이 안 들어갔어요. 똑딱 소리에 맞춰 건반을 눌러 보세요';
  // 드럼을 아직 안 쳤으면(다 비었으면) 자동 드럼
  if (!mk.drumsAuto && !mkDrumNotes()) mk.drumsAuto = 'easy';
  mk.bar = Math.min(mk.bar, mk.mel.length - 1);
  mkFixBars();
  mkRender();
}

function mkMap(strict = true) {
  mk.name = $('#mk-name').value.trim();
  mkSave();
  const raw = { name: mk.name || (strict ? '' : '내 맵'), bpm: mk.bpm, bars: mk.drums, melody: mk.mel.map(barToMelody), prog: mkProg() };
  if (Array.isArray(mk.low) && mk.low.length === mk.mel.length) raw.low = mk.low.map(barToMelody);
  if (mk.deco) raw.deco = mk.deco;
  const map = cleanMap(raw);
  if (map) return map;
  if (!raw.name) toast('곡 이름을 적어 주세요', 1800);
  else toast('드럼 노트가 너무 적어요. ② 드럼에서 더 넣어 주세요', 2400);
  return null;
}
async function mkPlay(auto) {
  mkStopPlay();
  recStop();
  drecStop();
  const map = mkMap(false);
  if (!map) return;
  um.level = mapLevel(map, { id: UM_ID, by: state.me && state.me.player ? state.me.player.username : '' });
  um.from = 'make';
  um.wasAuto = auto && !state.auto;
  if (auto) state.auto = true;
  await startLevel(UM_ID);
}
async function mkUpload() {
  mkStopPlay();
  recStop();
  drecStop();
  const map = mkMap(true);
  if (!map) {
    if (!mk.name) $('#mk-name').focus();
    return;
  }
  if (!state.api.mapUpload) return toast('지금은 서버에 연결이 안 돼서 못 올려요', 2200);
  if (!confirm(`「${map.name}」 맵을 올릴까요? 올리면 누구나 칠 수 있어요`)) return;
  try {
    await state.api.mapUpload(map);
    toast('올렸어요! 유저 맵 「새 맵」에 떠요', 2400);
    um.sort = 'new';
    um.list = null;
    openMaps();
    loadMaps(true);
  } catch (e) {
    const err = e.data && e.data.error;
    toast(
      err === 'too_many_maps' ? '맵은 하루 10개까지 올릴 수 있어요' : e.status === 403 ? '팔로워 인증을 하면 올릴 수 있어요' : err === 'bad_map' ? '맵에 이상한 데가 있어요. 다시 확인해 주세요' : '못 올렸어요. 잠시 뒤 다시 해 보세요',
      2600
    );
  }
}
function mkNew() {
  if (!confirm('지금 만들던 맵을 지우고 새로 시작할까요?')) return;
  mkStopPlay();
  recStop();
  drecStop();
  mkSnap();
  mk = newDraft();
  $('#mk-name').value = '';
  $('#mk-step').checked = false;
  mkSave();
  mkRender();
}

// ----- 🎵 노래 파일에서 음 따기 -----
const mkf = { url: null, buf: null, mono: null, name: '', busy: false };
async function mkPickFile(file) {
  if (mkf.busy) return;
  if (mkf.url) URL.revokeObjectURL(mkf.url);
  mkf.url = URL.createObjectURL(file);
  mkf.name = file.name.replace(/\.[^.]+$/, '').slice(0, 30);
  mkf.buf = mkf.mono = null;
  $('#mk-file-opts').hidden = true;
  mkf.busy = true;
  audio.unlock();
  const buf = await openTrackFile(mkf.url, file, (t, mb) => ($('#mk-file-status').textContent = `노래 여는 중… ${t}초 (파일 ${fmtMb(mb)})`));
  mkf.busy = false;
  if (!buf) {
    $('#mk-file-status').innerHTML =
      '이 영상은 한 번 재생하면서 소리를 읽어야 해요 (<b>영상 길이만큼</b> 걸려요, 소리는 안 나요).' +
      '<button class="btn btn-hot my-cap" type="button" data-action="mk-capture">영상 소리 읽기</button>';
    return;
  }
  mkFileLoaded(buf);
}
async function mkCapture() {
  if (!mkf.url || mkf.busy) return;
  mkf.busy = true;
  audio.unlock();
  const buf = await captureMediaAudio(mkf.url, (t, d) => ($('#mk-file-status').textContent = capText(t, d)), 180, true);
  mkf.busy = false;
  mkFileLoaded(buf);
}
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
function mkFileLoaded(buf) {
  if (!buf || buf.duration < 6) {
    $('#mk-file-status').textContent = buf ? '노래가 너무 짧아요' : '소리를 못 읽었어요. 소리가 들어 있는 mp3·m4a·mp4 로 해 보세요';
    return;
  }
  mkf.buf = buf;
  mkf.mono = monoOf(buf);
  $('#mk-file-status').innerHTML =
    `<b>${escapeHtml(mkf.name)}</b> · ${mmss(buf.duration)}` +
    (buf.partial ? `<br>⚠️ 영상 ${mmss(buf.partial)} 중 ${mmss(buf.duration)}까지만 읽혔어요. 끝까지 따려면 다시 골라서 읽는 동안 화면을 켜 두세요` : '');
  $('#mk-file-opts').hidden = false;
}
async function mkTranscribe() {
  const buf = mkf.buf;
  if (!buf || mkf.busy) return;
  const sr = buf.sampleRate;
  const st = $('#mk-file-status');
  const s0 = soundStart(mkf.mono, sr);
  const pick = parseTime($('#mk-file-start').value);
  const from = Math.max(0, Math.min(buf.duration - 4, pick ?? s0));
  const lenSel = $('#mk-file-len').value;
  const want = lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16;
  // 박: 고른 데부터 노래 끝까지(최대 2분)를 다 보고 찾음 → 긴 곡도 뒤에서 박이 안 밀림
  const bStart = Math.max(0, Math.min(from + 2, buf.duration - 12));
  const r = detectBeat(mkf.mono, sr, { start: bStart, dur: Math.max(24, Math.min(120, buf.duration - bStart)) });
  if (!r) {
    st.textContent = '박자를 못 찾았어요. 박이 뚜렷한 노래로 해 보세요';
    return;
  }
  let bpm = r.bpm;
  while (bpm > MAP_LIMITS.maxBpm) bpm /= 2;
  while (bpm < MAP_LIMITS.minBpm) bpm *= 2;
  const beat = 60 / bpm;
  // 고른 시각 바로 뒤의 박부터 (첫 소리가 박보다 살짝 늦게 잡혀도 그 박부터)
  const k = Math.ceil((from - r.firstBeat) / beat - 0.3);
  const first = r.firstBeat + k * beat;
  const avail = Math.floor((buf.duration - first) / (beat * 4));
  if (avail < MAP_LIMITS.minBars) {
    st.textContent = `시작 뒤로 노래가 ${Math.max(0, Math.floor(buf.duration - first))}초밖에 없어요. 시작을 앞으로 당겨 주세요`;
    return;
  }
  const bars = Math.min(want, MAP_LIMITS.maxBars, avail);
  // 🎤 먼저 목소리만 골라냄 (vocalsep.js, 폰 안에서). 고른 구간 앞뒤 1초만. 안 되면(옛 폰 등) 원래 소리로만
  const a0 = Math.max(0, Math.floor((first - 1) * sr));
  const a1 = Math.min(buf.length, Math.ceil((first + bars * 4 * beat + 1) * sr));
  const Lc = (buf.numberOfChannels > 1 ? buf.getChannelData(0) : mkf.mono).subarray(a0, a1);
  const Rc = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : mkf.mono).subarray(a0, a1);
  const btn = $('#mk-transcribe');
  mkf.busy = true;
  btn.disabled = true;
  let t = null;
  try {
    let v = null;
    try {
      v = await separateVocals(Lc, Rc, sr, (stage, p) => {
        st.textContent = stage === 'model' ? `목소리 골라내는 준비… ${Math.round(p * 100)}% (처음 한 번만 받아요, 약 30MB)` : `목소리·반주 나누는 중… ${Math.round(p * 100)}%`;
      });
    } catch (e) {
      console.warn('vocalsep', e);
      toast('이 폰에선 목소리 골라내기가 안 돼서 그냥 따요', 2200);
    }
    // 🎹 반주 악기 음 (Basic Pitch, 228KB) — 목소리 없는 곳·연주곡의 멜로디
    let inst = null;
    try {
      const mono = new Float32Array(Lc.length);
      for (let i = 0; i < mono.length; i++) mono[i] = (Lc[i] + Rc[i]) * 0.5;
      inst = await instrumentNotes(mono, sr, (stage, p) => (st.textContent = stage === 'model' ? '악기 음 듣는 준비…' : `악기 음 듣는 중… ${Math.round(p * 100)}%`));
    } catch (e) {
      console.warn('instnotes', e);
    }
    st.textContent = '멜로디·코드·드럼 따는 중…';
    await new Promise((res) => setTimeout(res, 40));
    // 목소리를 골랐으면 같은 빠르기(44.1kHz)로 맞춰서
    const mix = v && v.sr !== sr ? [resample(Lc, sr), resample(Rc, sr)] : [Lc, Rc];
    t = transcribeSong({
      mix,
      voc: v ? [v.L, v.R] : null,
      sr: v ? v.sr : sr,
      firstBeat: first - a0 / sr,
      bpm,
      bars,
      grid: $('#mk-file-clean').value === 'fine' ? 1 : 2,
      inst,
    });
  } catch (e) {
    console.warn('transcribe', e);
  } finally {
    mkf.busy = false;
    btn.disabled = false;
  }
  if (!t || t.found < 4) {
    st.textContent = '음을 거의 못 땄어요. 멜로디가 또렷한 구간으로 해 보세요';
    return;
  }
  // confirm() 은 앱 안 브라우저에서 안 뜰 수 있어서 묻지 않음 (↩ 되돌리기 가능)
  mkSnap();
  mk.mel = t.bars;
  mk.low = null;
  mk.bpm = Math.round(bpm);
  // 코드·드럼도 노래에서 (곡의 진짜 코드 · 곡의 쿵짝 자리)
  mk.prog = Array.isArray(t.prog) && t.prog.length === bars ? t.prog : null;
  if (Array.isArray(t.drums) && t.drums.length === bars) {
    mk.songDrums = t.drums;
    mk.drumsAuto = 'song';
  } else {
    mk.songDrums = null;
    mk.drumsAuto = 'normal';
  }
  mk.bar = 0;
  mk.cur = 0;
  // 화면 녹화·사진첩 파일 이름(ScreenRecording_…, IMG_1234)은 곡 이름으로 안 씀
  if (!$('#mk-name').value.trim() && !/^(screen|rpreplay|img|vid|video|audio|record|녹음|화면|\d)/i.test(mkf.name) && !/\d{4}/.test(mkf.name)) $('#mk-name').value = mkf.name;
  mk.name = $('#mk-name').value.trim();
  mkFixBars();
  mkRender();
  const sec = Math.round((bars * 4 * 60) / bpm);
  st.innerHTML =
    `<b>${bars}마디</b>(약 ${mmss(sec)})에서 음 <b>${t.found}개</b>를 땄어요 · ${mk.bpm} BPM` +
    `<br>${t.vocalRatio < 0.12 ? '목소리가 거의 없는 곡이라 악기 멜로디를 땄어요' : t.leadShare > 0.05 ? '노래 부분은 목소리, 전주·간주는 악기 멜로디를 땄어요' : '목소리 멜로디를 땄어요'}` +
    ([mk.prog && '코드', mk.drumsAuto === 'song' && '드럼'].filter(Boolean).join('·') ? `<br>${[mk.prog && '코드', mk.drumsAuto === 'song' && '드럼'].filter(Boolean).join('·')}도 노래에서 땄어요` : '') +
    (lenSel !== 'all' && want > bars ? `<br>노래가 짧아서 ${bars}마디까지만 땄어요` : '') +
    '<br>「처음부터 듣기」로 들어 보고, 틀린 음은 손으로 고쳐 주세요';
}

// ----- 🎼 악보 파일(MIDI·MusicXML)로 만들기 (scorefile.js, 폰 안에서만 읽음 · 요청 없음) -----
const mks = { score: null, info: null, name: '' };
async function mkPickScore(file) {
  const st = $('#mk-score-status');
  $('#mk-score-opts').hidden = true;
  mks.score = mks.info = null;
  if (file.size > 8 * 1024 * 1024) {
    st.textContent = '파일이 너무 커요 (8MB 까지). 악보 파일(.mid·.musicxml·.mxl)이 맞는지 봐 주세요';
    return;
  }
  st.textContent = '악보 읽는 중…';
  let sc;
  try {
    sc = await readScoreFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (e) {
    console.warn('score', e);
    st.textContent = `악보를 못 읽었어요${e && /[가-힣]/.test(e.message) ? ` (${e.message})` : ''}. MIDI(.mid)·MusicXML(.musicxml·.mxl) 파일로 해 주세요`;
    return;
  }
  const info = scoreInfo(sc);
  if (!info.melodyTracks.length && !info.hasDrums) {
    st.textContent = '악보에 음이 없어요';
    return;
  }
  mks.score = sc;
  mks.info = info;
  mks.name = (sc.title || file.name.replace(/\.[^.]+$/, '')).slice(0, 30);
  const sel = $('#mk-score-mel');
  sel.innerHTML =
    info.melodyTracks
      .map((t) => {
        const label = `${t.name || `트랙 ${t.index + 1}`} · 음 ${t.count}개 · ${midiName(t.lo)}~${midiName(t.hi)}${t.index === info.guess ? ' (추천)' : ''}`;
        return `<option value="${t.index}"${t.index === info.guess ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('') + '<option value="-1">멜로디 없이 (드럼만)</option>';
  if (info.guess < 0) sel.value = '-1';
  $('#mk-score-len').value = 'all';
  mks.startTouched = false;
  mkScoreStartOpts();
  $('#mk-score-opts').hidden = false;
  const sec = Math.round((info.totalBars * 4 * 60) / info.bpm);
  st.innerHTML =
    `<b>${escapeHtml(mks.name)}</b> · ${info.totalBars}마디 · ${Math.round(info.bpm)} BPM (약 ${mmss(sec)})` +
    `<br>${info.hasDrums ? '🥁 드럼 트랙도 있어요 — 그대로 넣어요' : '드럼 트랙이 없어서 드럼은 자동으로 만들어요'}` +
    (Math.round(info.bpm) !== Math.round(sc.bpm) ? `<br>원래 ${Math.round(sc.bpm)} BPM 이라 ${Math.round(info.bpm)} BPM 으로 맞췄어요 (박자는 그대로)` : '') +
    (sc.tempoChanges ? '<br>중간에 빠르기가 바뀌는 곡이라 처음 빠르기로 해요' : '') +
    (sc.timeSig && (sc.timeSig[0] !== 4 || sc.timeSig[1] !== 4) && !(sc.timeSig[0] === 2 && sc.timeSig[1] === 4) ? `<br>${sc.timeSig[0]}/${sc.timeSig[1]}박자 곡이라 4박씩 묶어요` : '') +
    '';
}
/** 시작 마디 목록 + 추천 (멜로디 트랙이 바뀌면 추천도 바뀜, 손으로 고른 뒤엔 그대로) */
function mkScoreStartOpts() {
  const info = mks.info;
  if (!info) return;
  const melIdx = Number($('#mk-score-mel').value);
  const rec = recommendStart(info, melIdx);
  const ss = $('#mk-score-start');
  const keep = mks.startTouched ? Number(ss.value) : rec;
  const opts = [];
  for (let b = 0; b < Math.max(1, info.totalBars - 1); b++) opts.push(`<option value="${b}"${b === keep ? ' selected' : ''}>${b + 1}마디${b === rec ? ' (추천 · 멜로디 시작)' : ''}</option>`);
  ss.innerHTML = opts.join('');
  mkScoreRec();
}
function mkScoreRec() {
  const info = mks.info;
  if (!info) return;
  const melIdx = Number($('#mk-score-mel').value);
  const t = info.melodyTracks.find((m) => m.index === melIdx);
  const start = Number($('#mk-score-start').value) || 0;
  const lenSel = $('#mk-score-len').value;
  const bars = Math.min(lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16, info.totalBars - start);
  const rec = recommendStart(info, melIdx);
  $('#mk-score-rec').innerHTML =
    `👉 이렇게 만들어요: 멜로디 <b>${t ? escapeHtml(t.name || `트랙 ${t.index + 1}`) : '없이 (드럼만)'}</b> · <b>${start + 1}마디부터 ${bars}마디</b>` +
    (start === rec && rec > 0 ? ` (앞 ${rec}마디 전주는 건너뛰어요)` : '') +
    (start + bars < info.totalBars ? `<br>곡이 길어서 ${start + bars}마디까지만 들어가요` : '') +
    '<br>모르면 그대로 「악보로 맵 만들기」만 누르세요';
}
function mkScoreMake() {
  const sc = mks.score;
  if (!sc) return;
  const st = $('#mk-score-status');
  const lenSel = $('#mk-score-len').value;
  let r;
  try {
    r = scoreToMap(sc, {
      melody: Number($('#mk-score-mel').value),
      start: Number($('#mk-score-start').value) || 0,
      bars: lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16,
    });
  } catch (e) {
    console.warn('scoreToMap', e);
    st.textContent = '맵으로 바꾸다 문제가 생겼어요. 「직접 고르기」에서 멜로디 트랙이나 시작 마디를 바꿔 보세요';
    toast('악보를 맵으로 못 바꿨어요');
    return;
  }
  // 맵은 2마디부터 (1마디짜리 곡은 한 마디 쉼을 붙임)
  while (r.mel.length < MAP_LIMITS.minBars) {
    r.mel.push([]);
    if (r.drums) r.drums.push('................');
    if (r.prog) r.prog.push(r.prog[r.prog.length - 1]);
  }
  if (!r.found && !r.drums) {
    st.textContent = '그 구간엔 음이 없어요. 「직접 고르기」에서 시작 마디나 멜로디 트랙을 바꿔 보세요';
    toast('그 구간엔 음이 없어요');
    return;
  }
  // confirm() 은 인스타 앱 안 브라우저 등에서 안 뜨고 '아니오'로 돌아와서 아무 일도 안 일어났음 → 묻지 않고 바꾸고 ↩ 되돌리기로
  const hadDraft = mk.mel.some((b) => b.length) || mk.drumsAuto !== 'easy';
  mkSnap();
  mk.mel = r.mel;
  mk.low = r.low || null;
  mk.bpm = Math.max(MAP_LIMITS.minBpm, Math.min(MAP_LIMITS.maxBpm, r.bpm));
  mk.prog = r.prog;
  if (r.drums) {
    mk.songDrums = r.drums;
    mk.drumsAuto = 'song';
  } else {
    mk.songDrums = null;
    mk.drumsAuto = 'normal';
  }
  mk.bar = 0;
  mk.cur = 0;
  if (!$('#mk-name').value.trim()) $('#mk-name').value = mks.name;
  mk.name = $('#mk-name').value.trim();
  mkFixBars();
  mkRender();
  st.innerHTML =
    `<b>${r.mel.length}마디</b>(${r.start + 1}마디부터)로 만들었어요 · 멜로디 음 <b>${r.found}개</b> · ${mk.bpm} BPM` +
    `<br>${[r.prog ? '코드는 반주 트랙에서' : '코드는 멜로디로 짐작', r.low ? '🎹 왼손(아래 줄)도 악보 그대로' : '', r.drums ? '드럼은 악보 드럼 그대로' : '드럼은 자동'].filter(Boolean).join(' · ')}` +
    '<br>위 「처음부터 듣기」로 들어 보고, 고칠 곳은 「자세히 고치기」에서 손봐요' +
    (hadDraft ? '<br>전에 만들던 건 위 「↩ 되돌리기」로 되돌릴 수 있어요' : '');
  toast('🎼 악보로 맵을 만들었어요');
  $('#mk-play').scrollIntoView({ block: 'center', behavior: 'smooth' });
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
  beat: { top: '엄지 드럼 챌린지', bottom: '어디까지 따라오나 보자' },
  beatSteady: { top: '이 노래 엄지로 쳐봐', bottom: '프로필 링크에서 직접 쳐보기' },
  quiz: { top: '이 노래 제목 맞혀봐!', bottom: '정답은 영상 끝에 · 댓글로 먼저!' },
  fail: { top: '이 정도는 쉽지 ㅋㅋ', bottom: '이거 깰 수 있는 사람?' },
};
const isQuizFormat = () => state.studio.format === 'quiz';
/** 💀 실패 영상: 잘 치다가 일부러 MISS 를 줄줄이 → 하트가 다 떨어져 끝 → 도발 문구 */
const isFailFormat = () => state.studio.format === 'fail';
const FAIL_SECS = [8, 12, 18, 25];
/** 실패 영상 판: 탈락 시점(첫 콩부터 초)을 곡 길이 안으로 */
function failLevel(lv) {
  const total = (lv.bars.length * 4 * 60) / lv.bpm;
  return { ...lv, failReel: true, failAfter: Math.max(3, Math.min(state.studio.failSec || 12, total * 0.85)) };
}
/** 실제로 칠 판 id: 노래 맞히기면 'q2x8' 처럼 */
const studioPlayId = () => (isQuizFormat() && typeof state.studio.level === 'number' ? quizId(state.studio.level, state.studio.quizBars ?? 8) : state.studio.level);
const STUDIO_CHALLENGES = [4, 7];
function studioDefaults(id) {
  if (isQuizFormat()) return STUDIO_TEXT.quiz;
  if (isFailFormat()) return STUDIO_TEXT.fail;
  if (id === BEAT_ID) {
    const style = beatSaved().style;
    return style === 'steady' || style === 'song' ? STUDIO_TEXT.beatSteady : STUDIO_TEXT.beat;
  }
  return isChallengeId(id) ? STUDIO_TEXT.challenge(Number(String(id).slice(2))) : STUDIO_TEXT.level;
}
function pickStudioLevel(id) {
  const st = state.studio;
  const top = $('#studio-top');
  const bottom = $('#studio-bottom');
  // 기본 문구 그대로였으면 새 기본 문구로 바꿔 줌 (직접 쓴 문구는 그대로)
  const all = [STUDIO_TEXT.level, STUDIO_TEXT.beat, STUDIO_TEXT.beatSteady, { top: '드롭에서 엄지 터짐 주의', bottom: '빌드업 끝까지 따라와 봐' }, { top: '이 노래 엄지로 드럼 커버', bottom: '프로필 링크에서 직접 쳐보기' }, STUDIO_TEXT.quiz, STUDIO_TEXT.fail, ...STUDIO_CHALLENGES.map(STUDIO_TEXT.challenge)];
  const after = studioDefaults(id);
  if (!top.value.trim() || all.some((d) => d.top === top.value.trim())) top.value = after.top;
  if (!bottom.value.trim() || all.some((d) => d.bottom === bottom.value.trim())) bottom.value = after.bottom;
  // 썸네일 곡 배지: 자동으로 들어간 값이었으면 새 곡으로 (직접 고쳤으면 그대로)
  if (coverOn()) {
    const sub = $('#cover-sub');
    const prevAuto = coverSubOf(playable(st.level));
    if (!sub.value.trim() || sub.value.trim() === prevAuto) sub.value = coverSubOf(playable(id));
  }
  st.level = id;
  fillQuizBars();
  fillFailLen();
}

/** 실패 영상: 몇 초쯤에 탈락할지 + 문구 칸 이름 */
function fillFailLen() {
  const st = state.studio;
  const on = isFailFormat();
  $('#fail-len').hidden = !on;
  $('#studio-top-label').textContent = on ? '위 (치는 동안)' : '위 (훅)';
  $('#studio-bottom-label').textContent = on ? '끝 (도발 문구)' : '아래 (유도)';
  if (!on) return;
  if (!FAIL_SECS.includes(st.failSec)) st.failSec = 12;
  $('#fail-secs').innerHTML = FAIL_SECS.map((n) => `<option value="${n}">약 ${n}초에 탈락</option>`).join('');
  $('#fail-secs').value = String(st.failSec);
}

/** 노래 맞히기: 길이 고르기 (곡마다 초가 달라서 곡을 바꾸면 다시 채움) */
function fillQuizBars() {
  const st = state.studio;
  $('#quiz-len').hidden = !isQuizFormat();
  if (!isQuizFormat() || typeof st.level !== 'number') return;
  const lv = getLevel(st.level);
  const opts = QUIZ_BARS.filter((n) => n === 0 || n < lv.bars.length);
  if (!opts.includes(st.quizBars ?? 8)) st.quizBars = opts[0];
  $('#quiz-bars').innerHTML = opts
    .map((n) => `<option value="${n}">${n ? `앞 ${n}마디` : '끝까지'} · 약 ${quizSeconds(quizId(lv.id, n))}초</option>`)
    .join('');
  $('#quiz-bars').value = String(st.quizBars ?? 8);
}

/** 형식(그냥 치기 / 노래 맞히기)에 맞는 곡 버튼들 */
function renderStudioLevels() {
  const st = state.studio;
  $$('#studio-format button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.format === (st.format || 'play')));
  if (isQuizFormat() || isFailFormat()) {
    $('#studio-levels').innerHTML = LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${levelLabel(l)} · ${l.name}</button>`).join('');
  } else {
    $('#studio-levels').innerHTML =
      (coverOn() ? `<button class="chip-hot" data-studio-level="${BEAT_ID}" aria-pressed="${st.level === BEAT_ID}">${beatChipText()}</button>` : '') +
      STUDIO_CHALLENGES.map(
        (n) => `<button class="chip-hot" data-studio-level="ch${n}" aria-pressed="${st.level === 'ch' + n}">🔥 레벨업 챌린지 Lv.1→${n}</button>`
      ).join('') +
      STUDIO_LEVELS.map((l) => `<button class="chip-hot" data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">🎬 릴스용 · ${l.name} (느리게)</button>`).join('') +
      LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${l.id}. ${l.name}</button>`).join('');
  }
  fillQuizBars();
}
function pickStudioFormat(f) {
  const st = state.studio;
  st.format = f;
  // 노래 맞히기·실패 영상은 진짜 곡만 (레벨업 챌린지·박자 맞추기는 곡이 아님)
  const real = typeof st.level === 'number' && getLevel(st.level);
  pickStudioLevel(f === 'quiz' && !real ? 2 : f === 'fail' && !real ? (getLevel(9) ? 9 : 2) : st.level);
  renderStudioLevels();
}

/** 영상 화면에 그릴 문구 */
function studioOverlay(lv) {
  const st = state.studio;
  if (lv.quiz) return { top: st.top, bottom: st.bottom, quiz: true, answer: lv.name, composer: lv.composer, bottomEnd: '프로필 링크에서 직접 쳐보기' };
  if (isFailFormat() && typeof lv.id === 'number') return { top: st.top, bottom: st.bottom, fail: true, label: `${levelLabel(lv)} · ${lv.composer} ${lv.name}`, bottomEnd: '프로필 링크에서 도전' };
  return {
    top: st.top,
    bottom: st.bottom,
    challenge: !!lv.challenge,
    steady: !!lv.steady,
    countdown: lv.synced ? lv.syncCountdown || 0 : 0,
    endText: lv.steady ? '클리어!' : '',
    label: lv.beat ? `${lv.songName} · ${beatStyleName(lv.beatStyle, lv.beatDiff)}` : lv.challenge ? '레벨업 챌린지' : lv.studioOnly ? `${lv.composer} ${lv.name}` : `${levelLabel(lv)} · ${lv.composer} ${lv.name}`,
  };
}

function openStudio() {
  if (state.game) state.game.stop();
  const st = state.studio;
  st.active = false;
  $('#screen-game').classList.remove('studio-mode');
  if (isQuizFormat() && (typeof st.level !== 'number' || !getLevel(st.level))) st.level = 2;
  if (isFailFormat() && (typeof st.level !== 'number' || !getLevel(st.level))) st.level = getLevel(9) ? 9 : 2;
  renderStudioLevels();
  $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === st.mode));
  $('#studio-top').value = st.top;
  $('#studio-bottom').value = st.bottom;
  const ok = canRecordFile();
  $('#studio-file').disabled = !ok;
  $('#studio-file').checked = ok && st.file;
  $('#studio-skin').checked = st.skin !== false;
  $('#studio-file-hint').textContent = ok
    ? '켜면 이 화면이 그대로 소리까지 영상 파일로 저장돼요. 끄면 폰 화면 녹화로 찍으면 돼요.'
    : '이 브라우저는 바로 저장이 안 돼요. 폰 화면 녹화(제어센터)로 찍어주세요.';
  closeModal('modal-studio-done');
  fillCoverForm();
  fillBeatForm();
  show('screen-studio');
}

// ---------------- 🎵 유행곡 박자 맞추기 (운영자 전용, /?thumb=okay 기기에서만) ----------------
//   노래 BPM 에 맞춘 레벨업 챌린지(빠르기 고정). 노래는 게임에 안 넣고 인스타 편집기에서 입힘 (저작권)
const beatSaved = () => beatOpts(load('beatReel', null) || {});

// ---------------- 🎧 화면 녹화로 박자 자동 맞추기 (운영자 전용) ----------------
//   인스타에서 쓸 노래 구간을 고르고, 그 구간이 처음부터 재생되는 걸 화면 녹화 → 그 영상을 여기서 고름.
//   소리가 시작되는 순간 = 인스타 구간 시작 = 우리 영상 0초. 거기서 BPM·첫 박(쿵)을 찾아,
//   드럼 영상의 첫 쿵이 '영상 0초 + (구간 시작 → 첫 박) + 한 마디 단위'에 오게 녹화함.
//   노래는 영상에 안 넣음 (인스타에서 같은 구간을 넣으면 맞음). 파일은 이 폰 메모리에만 (어디에도 안 올림)
const sync = { url: null, name: '', firstBeat: null, t0: 0, bpm: null };
const syncCalib = () => Number(load('syncCalib', 0)) || 0;
/** 박자 맞추기 판: 녹화 중이면 첫 쿵이 노래 박에 오게 시작 시각을 정해 줌 */
/** 카운트다운(초): 영상 0초부터 노래가 나오고, 드럼은 이만큼 뒤의 첫 쿵부터 */
const syncCountdown = () => Math.max(0, Math.min(20, Number(load('syncCountdown', 5)) || 0));
/** 채보 첫 쿵의 녹화 속 시각: 노래 구간 시작 + 카운트다운 뒤의 첫 '쿵' 박 (쿵 박은 2박 간격) */
function syncChartStart() {
  if (sync.firstBeat == null) return null;
  const beat = 60 / (beatSaved().bpm || sync.bpm || 120);
  const k = Math.max(0, Math.ceil((sync.t0 + syncCountdown() - sync.firstBeat) / (beat * 2) - 1e-6));
  return sync.firstBeat + k * beat * 2;
}
function withSync(lv) {
  const st = state.studio;
  const start = syncChartStart();
  if (start == null) return lv;
  // 확인용: 화면 녹화의 노래를 같이 틂 (채보 첫 쿵 = 노래의 그 박). 영상에도 들어감
  if ($('#sync-play').checked && audio.trackBuffer(sync.url)) {
    lv.song = { ...lv.song, audio: { src: sync.url, offset: start, gain: 1 } };
    lv.withSong = true;
  }
  // 녹화는 '노래 구간 시작' 순간부터 (영상 0초 = 인스타 노래 0초). 카운트다운 동안 노래가 흐르고 드럼은 그 뒤 첫 쿵부터
  if (!st.active || !st.file) return lv;
  lv.synced = true;
  lv.syncLead = start - sync.t0; // 노래 구간 시작 → 첫 쿵
  lv.syncCountdown = syncCountdown();
  // 카운트다운을 쓰면 우리 숫자(5·4·3·2·1)로, 아니면 자동 연주 영상엔 3·2·1 안 보이게
  lv.hideCountIn = lv.syncCountdown > 0 || state.auto;
  // 녹화 시작이 판 시작보다 앞서야 하니, 카운트인 한 마디보다 길면 판을 그만큼 늦게 시작
  const countIn = (60 / lv.bpm) * 4 * COUNT_IN_BARS;
  lv.leadIn = Math.max(0, lv.syncLead - countIn) + 0.3;
  return lv;
}
/** 이 폰의 녹화 지연(ms, 찍은 영상을 재서 자동) */
const syncLag = () => Number(load('syncLag', 0)) || 0;
/** 노래 구간 시작 순간에 녹화 시작 (첫 쿵 - lead - 지연·보정) */
function scheduleSyncRec(g) {
  const st = state.studio;
  const lv = g.level;
  const c0 = g.startTime + g.tempo.barStart(COUNT_IN_BARS) - lv.syncLead - (syncLag() + syncCalib()) / 1000;
  const go = () => {
    if (state.game !== g || !st.active) return;
    // 마지막 몇 ms 는 소리 시계를 보며 기다림 (타이머 오차 줄이기)
    const end = performance.now() + 60;
    while (audio.ctx.currentTime < c0 && performance.now() < end) {}
    startRecorder();
  };
  setTimeout(go, Math.max(0, (c0 - audio.ctx.currentTime) * 1000 - 40));
}
/** '1:02.5' · '62.5' → 초 (비우면 null) */
function parseTime(v) {
  const t = String(v || '').trim().replace(/[^\d:.]/g, '');
  if (!t) return null;
  const parts = t.split(':').map(Number);
  const sec = parts.length > 1 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(sec) && sec >= 0 ? sec : null;
}
const fmtTime = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}`;
/** 녹화에서 소리가 처음 나는 시각 (10ms 단위, 가장 큰 소리의 5%를 넘는 첫 순간) */
function soundStart(mono, sr) {
  const hop = Math.round(sr * 0.01);
  const n = Math.floor(Math.min(mono.length, sr * 90) / hop);
  const rms = new Float32Array(n);
  let mx = 0;
  for (let f = 0; f < n; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += mono[i] * mono[i];
    rms[f] = Math.sqrt(e / hop);
    if (rms[f] > mx) mx = rms[f];
  }
  for (let f = 0; f < n; f++) if (rms[f] > mx * 0.05) return f * 0.01;
  return 0;
}
/**
 * 찍힌 영상에서 첫 쿵이 실제로 몇 초에 나왔나 재서, 폰마다 다른 녹화 지연을 「싱크 보정」에 자동 반영.
 *   (카운트인 똑딱을 껐으니 영상의 첫 소리 = 첫 쿵) 어긋났으면 한 번 더 찍으면 맞음
 */
async function syncSelfCheck(blob, computed, lead) {
  try {
    const ab = await blob.arrayBuffer();
    const buf = await new Promise((res, rej) => {
      const q = audio.ctx.decodeAudioData(ab, res, rej);
      if (q && q.then) q.then(res, rej);
    });
    const m = monoOf(buf);
    let mx = 0;
    for (let i = 0; i < m.length; i++) if (Math.abs(m[i]) > mx) mx = Math.abs(m[i]);
    let at = -1;
    for (let i = 0; i < m.length; i++)
      if (Math.abs(m[i]) > mx * 0.3) {
        at = i / buf.sampleRate;
        break;
      }
    if (at < 0) return;
    const d = at - computed; // 이 폰의 녹화 지연 (− 면 영상 소리가 계산보다 빠름)
    if (Math.abs(d) > 0.4) return;
    const lag = Math.round((-d * 1000) / 5) * 5;
    const off = Math.round((at - lead) * 1000); // 이번 영상: 첫 쿵이 노래 박보다 이만큼 늦음
    save('syncLag', lag);
    if (Math.abs(off - syncCalib()) > 15)
      $('#studio-done-msg').textContent += ` · 이번 영상은 드럼이 ${Math.abs(off)}ms ${off < 0 ? '빨라요' : '늦어요'}. 이 폰에 맞게 자동으로 맞췄으니 「다시 찍기」 한 번 하면 딱 맞아요.`;
  } catch {}
}
/** 🥁 노래 따라: 화면 녹화 소리로 채보 (같은 설정이면 다시 안 만듦) */
let songCache = null;
function songBars(o) {
  if (o.style !== 'song' || sync.firstBeat == null) return null;
  const buf = audio.trackBuffer(sync.url);
  if (!buf) return null;
  const first = syncChartStart();
  const key = [sync.url, first, o.bpm, o.rounds, o.diff].join('|');
  if (songCache && songCache.key === key) return songCache.bars;
  const r = songChart(monoOf(buf), buf.sampleRate, { firstBeat: first, bpm: o.bpm, bars: o.rounds * ROUND_BARS, diff: o.diff });
  songCache = { key, bars: r.bars, covered: r.covered };
  return r.bars;
}
/** 노래 따라 안내 한 줄 */
function songInfoText() {
  const o = beatSaved();
  if (o.style !== 'song') return '';
  if (sync.firstBeat == null) return '노래 따라는 위에서 화면 녹화 영상을 넣고 박자를 찾아야 만들어져요 (그 전엔 비트로 쳐요)';
  songBars(o);
  const c = songCache ? songCache.covered : 0;
  const all = o.rounds * ROUND_BARS;
  return c >= all ? `노래 따라: ${all}마디 전부 노래 소리대로 만들었어요` : `노래 따라: ${all}마디 중 ${c}마디만 녹화 소리가 있어서, 뒤는 기본 쿵짝이에요 (더 길게 화면 녹화하면 끝까지)`;
}
let syncPreview = null;
function stopSyncPreview() {
  if (syncPreview) {
    syncPreview.pause();
    syncPreview = null;
  }
}
/**
 * 노래·영상 파일 열기 (기다린 시간·파일 크기를 onTick 으로 알려 줌).
 *   아이폰의 영상 파일은 바로 못 여니 시도하지 않음 → null (영상 소리 읽기 버튼으로)
 *   그 밖에도 limit 초 안에 못 열면 null
 */
async function openTrackFile(url, file, onTick, limit = 12) {
  const isVideo = /^video\//.test(file.type) || /\.(mov|mp4|m4v|qt)$/i.test(file.name);
  const mb = file.size / 1048576;
  const t0 = performance.now();
  const tick = () => onTick(Math.floor((performance.now() - t0) / 1000), mb);
  tick();
  const timer = setInterval(tick, 500);
  const race = (p, sec) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), sec * 1000))]);
  let buf = null;
  // 아이폰 영상(.mov)은 decodeAudioData 로 바로 못 풂 → 영상 상자에서 소리(AAC)만 꺼내서 풂 (몇 초, 영상 길이 그대로)
  if (isVideo && phoneOs() === 'ios') buf = await race(videoAudio(url, file), limit * 2);
  else {
    buf = await race(audio.loadTrack(url), limit);
    if (!buf && isVideo) buf = await race(videoAudio(url, file), limit);
  }
  clearInterval(timer);
  return buf;
}
/** 영상 파일 → 소리만 꺼내서 AudioBuffer (못 하면 null). 꺼낸 소리는 trackBuffer(url) 로도 씀 */
async function videoAudio(url, file) {
  try {
    const aac = await videoToAac(file);
    if (!aac) return null;
    const ctx = audio.ensure();
    const buf = await new Promise((res, rej) => {
      const q = ctx.decodeAudioData(aac.buffer, res, rej);
      if (q && q.then) q.then(res, rej);
    });
    if (!buf || buf.duration < 1) return null;
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(url, buf);
    return buf;
  } catch (e) {
    console.warn('videoAudio', e);
    return null;
  }
}
const fmtMb = (mb) => (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + 'MB';
/** 영상 소리 읽기 진행: 지난 초/전체 초 + 남은 시간 */
const capText = (t, d) => `영상 소리 읽는 중… ${Math.floor(t)}/${Math.round(d)}초 · 약 ${Math.max(1, Math.round(d - t))}초 남음 (화면을 끄지 마세요)`;
async function syncPick(file) {
  stopSyncPreview();
  if (sync.url) URL.revokeObjectURL(sync.url);
  sync.url = URL.createObjectURL(file);
  sync.name = file.name;
  sync.firstBeat = null;
  $('#sync-panel').hidden = false;
  $('#sync-name').textContent = file.name;
  audio.unlock();
  const buf = await openTrackFile(sync.url, file, (t, mb) => ($('#sync-result').textContent = `여는 중… ${t}초 (파일 ${fmtMb(mb)}, 보통 몇 초면 돼요)`));
  if (!buf) {
    // 아이폰 사파리는 화면 녹화(.mov)를 바로 못 풀어서 → 영상을 소리 없이 한 번 재생하며 소리를 읽음 (버튼을 눌러야 재생됨)
    $('#sync-result').innerHTML = '<b>「박자 찾기」를 눌러 주세요.</b> 영상을 소리 없이 한 번 재생하면서 소리를 읽어요 (영상 길이만큼, 최대 1분 걸려요)';
    $('#sync-detect-btn').textContent = '박자 찾기';
    return;
  }
  syncDetect();
}
/**
 * 영상(.mov 등)을 소리 없이 재생하면서 소리를 그대로 받아 적음 → AudioBuffer (최대 30초)
 *   첫 소리·첫 박의 '간격'만 쓰므로 받아 적기 시작이 조금 늦어도 결과는 같음
 */
function captureMediaAudio(url, onProgress, maxSec = 60, stereo = false) {
  return new Promise((resolve) => {
    const ctx = audio.ensure();
    const v = document.createElement('video');
    v.src = url;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    let src;
    let sp;
    let mute;
    const chunks = [];
    let done = false;
    const MAX = maxSec;
    // 아이폰이 화면 밖 영상을 멈추지 않게 화면에 아주 작게 붙여 둠 + 화면 꺼짐 막기
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(v);
    let lock = null;
    try {
      navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => (done ? l.release() : (lock = l))).catch(() => {});
    } catch {}
    // 중간에 멈추면(다른 앱·화면 꺼짐 등) 다시 재생
    const resume = () => {
      if (!done && v.paused && !v.ended) v.play().catch(() => {});
    };
    v.onpause = () => setTimeout(resume, 300);
    const onVis = () => document.visibilityState === 'visible' && resume();
    document.addEventListener('visibilitychange', onVis);
    const finish = (ok = true) => {
      if (done) return;
      done = true;
      const want = Math.min(MAX, v.duration || 0);
      try {
        v.onpause = null;
        v.pause();
        src && src.disconnect();
        sp && sp.disconnect();
        mute && mute.disconnect();
        v.remove();
        document.removeEventListener('visibilitychange', onVis);
        lock && lock.release();
      } catch {}
      const len = chunks.reduce((a, c) => a + c[0].length, 0);
      if (!ok || len < ctx.sampleRate * 3) return resolve(null);
      // 좌우 그대로 (유저 맵 음 따기가 가운데 소리=보컬을 골라 듣는 데 씀)
      const nch = chunks.some((c) => c[1] !== c[0]) ? 2 : 1;
      const buf = ctx.createBuffer(nch, len, ctx.sampleRate);
      for (let k = 0; k < nch; k++) {
        const ch = buf.getChannelData(k);
        let o = 0;
        for (const c of chunks) {
          ch.set(c[k], o);
          o += c[k].length;
        }
      }
      // 영상보다 한참 짧게 읽혔으면 표시 (부른 쪽이 안내)
      if (want > 0 && buf.duration < want - 2) buf.partial = want;
      resolve(buf);
    };
    try {
      src = ctx.createMediaElementSource(v);
      sp = ctx.createScriptProcessor(4096, 2, 1);
      mute = ctx.createGain();
      mute.gain.value = 0; // 스피커로는 안 나감
      src.connect(sp);
      sp.connect(mute);
      mute.connect(ctx.destination);
    } catch {
      return resolve(null);
    }
    sp.onaudioprocess = (e) => {
      if (done || v.paused) return;
      const ib = e.inputBuffer;
      const a = new Float32Array(ib.getChannelData(0));
      if (!stereo || ib.numberOfChannels < 2) {
        // 모노로 (긴 노래는 폰 메모리 아끼기)
        const b = ib.numberOfChannels > 1 ? ib.getChannelData(1) : a;
        for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[i]) * 0.5;
        chunks.push([a, a]);
      } else chunks.push([a, new Float32Array(ib.getChannelData(1))]);
    };
    v.ontimeupdate = () => {
      onProgress && onProgress(v.currentTime, Math.min(MAX, v.duration || MAX));
      if (v.currentTime >= MAX) finish();
    };
    v.onended = () => finish();
    v.onerror = () => finish(false);
    setTimeout(() => finish(), (MAX + 15) * 1000);
    const p = v.play();
    if (p && p.catch) p.catch(() => finish(false));
  });
}
function syncListen() {
  if (!sync.url) return;
  if (syncPreview) return stopSyncPreview();
  const a = new Audio(sync.url);
  a.currentTime = sync.firstBeat != null ? sync.firstBeat : parseTime($('#sync-start').value) ?? 0;
  a.play().catch(() => {});
  syncPreview = a;
  setTimeout(() => syncPreview === a && stopSyncPreview(), 8000);
}
let syncCapturing = false;
async function syncDetect() {
  if (!sync.url) return toast('화면 녹화 영상을 먼저 골라 주세요');
  let buf = audio.trackBuffer(sync.url);
  if (!buf) {
    if (syncCapturing) return;
    syncCapturing = true;
    await audio.unlock();
    $('#sync-result').textContent = '소리 읽는 중… (영상이 끝날 때까지 기다려 주세요)';
    buf = await captureMediaAudio(sync.url, (t, d) => ($('#sync-result').textContent = capText(t, d)));
    syncCapturing = false;
    if (!buf) {
      $('#sync-result').textContent = '영상 소리를 못 읽었어요. 화면 녹화할 때 소리가 들어갔는지 확인하고 다시 골라 주세요';
      return;
    }
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(sync.url, buf); // 다시 찾기 때는 바로
    $('#sync-detect-btn').textContent = '박자 다시 찾기';
  }
  stopSyncPreview();
  const mono = monoOf(buf);
  // 구간 시작: 비우면 녹화에서 소리가 처음 나는 순간 (인스타 구간이 재생되기 시작한 때)
  const manual = parseTime($('#sync-start').value);
  const start = manual ?? soundStart(mono, buf.sampleRate);
  if (start >= buf.duration - 6) return toast('녹화가 너무 짧아요. 노래가 10초 넘게 나오게 녹화해 주세요');
  const free = detectBeat(mono, buf.sampleRate, { start });
  // 탭/직접 쓴 BPM 이 감지값(또는 그 두 배·절반)과 가까우면 그 근처에서 다시 정밀하게 → 사람이 세는 쪽(쿵짝 빠르기)을 따름
  const want = Number($('#beat-bpm').value) || 0;
  let r = free;
  if (free && want) {
    for (const m of [1, 2, 0.5]) {
      if (Math.abs(free.bpm * m - want) / want < 0.04) {
        r = detectBeat(mono, buf.sampleRate, { start, hintBpm: want }) || free;
        break;
      }
    }
  }
  if (!r) return toast('박자를 못 찾았어요. 다른 구간으로 해 보세요');
  sync.firstBeat = r.firstBeat;
  sync.t0 = start;
  sync.bpm = r.bpm;
  $('#beat-bpm').value = Math.round(r.bpm * 10) / 10;
  saveBeatForm();
  pickBeat();
  $('#sync-result').innerHTML =
    `<b>${Math.round(r.bpm * 10) / 10} BPM</b> · 노래 시작(${fmtTime(start)}) 뒤 ${(r.firstBeat - start).toFixed(2)}초에 첫 박` +
    `${r.confidence < 0.3 ? ' · <b>박이 잘 안 들려요</b>(소리 크게 다시 녹화)' : ''}<br>` +
    '이대로 녹화하면 드럼이 이 박에 맞춰 나와요. 드럼이 2배로 바쁘면 ÷2 누르고 다시 「박자 찾기」' +
    (songInfoText() ? `<br>${songInfoText()}` : '');
}
function beatChipText() {
  const o = beatSaved();
  return `🎵 박자 맞추기 · ${beatStyleName(o.style, o.diff)} · ${o.title || o.bpm + ' BPM'}`;
}
function fillBeatForm() {
  $('#beat-block').hidden = !coverOn();
  if (!coverOn()) return;
  const o = beatSaved();
  $('#beat-bpm').value = o.bpm;
  $('#beat-title').value = o.title;
  $('#beat-click').checked = o.click;
  $('#sync-calib').textContent = `${syncCalib() > 0 ? '+' : ''}${syncCalib()}ms`;
  $('#sync-cd').textContent = syncCountdown() ? `${syncCountdown()}초` : '없음';
  // 버튼은 한 번만 만듦 (BPM 칸을 고치다 바로 형식을 누르면, 다시 그리는 사이 누른 게 사라짐)
  if (!$('#beat-style').children.length)
    $('#beat-style').innerHTML = BEAT_STYLES.map((x) => `<button type="button" data-beat-style="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-style button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatStyle === o.style));
  if (!$('#beat-diff').children.length)
    $('#beat-diff').innerHTML = BEAT_DIFFS.map((x) => `<button type="button" data-beat-diff="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-diff button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatDiff === o.diff));
  $('#beat-diff').hidden = o.style === 'levelup';
  const sel = $('#beat-rounds');
  const key = `${o.bpm}|${o.style}`;
  if (!sel.options.length || sel.dataset.key !== key) {
    sel.innerHTML = Array.from({ length: BEAT_MAX_ROUNDS }, (_, i) => {
      const r = i + 1;
      const text = o.style === 'levelup' ? `Lv.1→${r}` : `${r * 4}마디`;
      return `<option value="${r}">${text} · 약 ${Math.round(beatSeconds({ bpm: o.bpm, rounds: r }))}초</option>`;
    }).join('');
    sel.dataset.key = key;
  }
  sel.value = String(o.rounds);
}
/** 폼 → 저장 (패턴 시드는 그대로 → 같은 채보로 다시 찍을 수 있음) */
function saveBeatForm({ reroll = false } = {}) {
  const prev = beatSaved();
  const o = beatOpts({
    bpm: $('#beat-bpm').value,
    rounds: $('#beat-rounds').value,
    title: $('#beat-title').value.trim(),
    click: $('#beat-click').checked,
    style: ($('#beat-style [aria-pressed="true"]') || {}).dataset?.beatStyle || prev.style,
    diff: ($('#beat-diff [aria-pressed="true"]') || {}).dataset?.beatDiff || prev.diff,
    seed: reroll ? undefined : prev.seed,
  });
  save('beatReel', o);
  fillBeatForm();
  const chip = $(`#studio-levels [data-studio-level="${BEAT_ID}"]`);
  if (chip) chip.textContent = beatChipText();
  return o;
}
function pickBeat() {
  saveBeatForm();
  state.studio.format = 'play'; // 박자 맞추기는 '그냥 치기' 형식 안에 있음
  pickStudioLevel(BEAT_ID);
  renderStudioLevels();
  toast(songInfoText() || `${beatChipText()} 골랐어요`, songInfoText() ? 3500 : 1600);
}
// 탭으로 BPM 재기: 마지막 12번 탭 간격의 중앙값 (2초 쉬면 새로 잼)
const beatTaps = [];
function beatTap(e) {
  e.preventDefault();
  const now = e.timeStamp || performance.now();
  if (beatTaps.length && now - beatTaps[beatTaps.length - 1] > 2000) beatTaps.length = 0;
  beatTaps.push(now);
  if (beatTaps.length > 13) beatTaps.shift();
  const gaps = beatTaps.slice(1).map((t, i) => t - beatTaps[i]).sort((a, b) => a - b);
  if (gaps.length < 3) {
    $('#beat-tap-bpm').textContent = '탭';
    $('#beat-tap-msg').textContent = `${beatTaps.length}번… 계속 톡톡`;
    return;
  }
  const bpm = Math.round((60000 / gaps[gaps.length >> 1]) * 2) / 2;
  $('#beat-tap-bpm').textContent = `${bpm} BPM`;
  $('#beat-tap-msg').textContent = beatTaps.length >= 8 ? '좋아요! 숫자가 안 바뀌면 그게 BPM (2초 쉬면 새로 재요)' : `${beatTaps.length}번… 8번 넘게 톡톡`;
  $('#beat-bpm').value = bpm;
  if (beatTaps.length >= 8) saveBeatForm();
}

// ---------------- 🖼 릴스 썸네일 (운영자 전용, /?thumb=okay) ----------------
const coverOn = () => load('thumbTool', false) === true;
const coverSubOf = (lv) => (!lv ? '' : isQuizFormat() ? '노래 맞히기 퀴즈' : lv.beat ? `${lv.songName} · ${beatStyleName(lv.beatStyle, lv.beatDiff)}` : lv.challenge ? `${lv.composer} ${lv.songName} · 레벨업 챌린지` : `${lv.composer} ${lv.name}`);
/** 썸네일 칸 채우기: 직접 쓴 문구는 기억, 곡 배지는 곡을 바꾸면 따라 바뀜(직접 고쳤으면 그대로) */
function fillCoverForm() {
  $('#cover-block').hidden = !coverOn();
  if (!coverOn()) return;
  const saved = load('coverText', null) || { l1: '엄지 두 개로', l2: '따라 쳐봐!', bottom: '프로필 링크에서 바로 해보기' };
  const lv = playable(state.studio.level);
  $('#cover-l1').value = saved.l1 ?? '';
  $('#cover-l2').value = saved.l2 ?? '';
  $('#cover-bottom').value = saved.bottom ?? '';
  $('#cover-sub').value = saved.subFixed ? saved.sub || '' : coverSubOf(lv);
}
function saveCoverForm() {
  const lv = playable(state.studio.level);
  const sub = $('#cover-sub').value.trim();
  save('coverText', { l1: $('#cover-l1').value.trim(), l2: $('#cover-l2').value.trim(), bottom: $('#cover-bottom').value.trim(), sub, subFixed: sub !== coverSubOf(lv) });
}
/** 🖼 릴스 썸네일: 고른 곡의 게임 화면 + 직접 쓴 문구로 1080×1920 표지 */
async function studioCover() {
  const st = state.studio;
  const lv = playable(st.level);
  if (!lv) return;
  saveCoverForm();
  const l1 = $('#cover-l1').value.trim();
  const l2 = $('#cover-l2').value.trim();
  const top = l1 && l2 ? `${l1}\n${l2}` : l1 || l2 || '엄지로 드럼 쳐봐!';
  const sub = $('#cover-sub').value.trim();
  const bottom = $('#cover-bottom').value.trim();
  toast('썸네일 만드는 중…', 1500);
  try {
    await fontsReady(top + sub + bottom);
    // 🎨 「꾸미기」 체크를 따라 썸네일에도 장착한 스킨·무대·드럼 (끄면 원래 맵·기본 콩)
    const skin = $('#studio-skin').checked;
    applyDeco(); // 장착한 것 최신으로 (첫 판 전이면 아직 안 불렸을 수 있음)
    const deco = skin ? { bgPick: renderer.bgPick, kitPick: renderer.kitPick, photoDim: renderer.photoDim, bgPhoto: renderer.bgPhoto, uiStyle: renderer.uiStyle } : null;
    if (!skin) applyNoteColors('basic');
    let canvas;
    try {
      canvas = await makeReelCover({ lv, title: top, sub, bottom, deco });
    } finally {
      if (!skin) applyDeco();
    }
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
  st.skin = $('#studio-skin').checked;
  st.quizBars = Number($('#quiz-bars').value || st.quizBars || 8);
  st.failSec = Number($('#fail-secs').value || st.failSec || 12);
  save('studio', { level: st.level, mode: st.mode, top: st.top, bottom: st.bottom, file: st.file, skin: st.skin, format: st.format || 'play', quizBars: st.quizBars, failSec: st.failSec });
  const playId = studioPlayId();
  closeModal('modal-studio-done');
  await audio.unlock();
  st.active = true;
  state.auto = st.mode === 'auto';
  // 9:16 화면을 먼저 깔고 카운트다운
  show('screen-game');
  $('#screen-game').classList.add('studio-mode');
  const lv = playable(playId) || getLevel(1);
  renderer.studio = studioOverlay(lv);
  renderer.studioSkin = st.skin !== false; // 🎨 상점에서 장착한 스킨·무대·드럼도 영상에 (2026-11-23 사용자)
  setKit(lv);
  await fontsReady(`${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}`);
  await new Promise((r) => requestAnimationFrame(r));
  await renderer.resize(Math.min(3, Math.max(2, 1080 / ($('#game-canvas').clientWidth || 390))));
  renderer.draw({ now: -1, notes: [], approach: 1.5, beatDur: 60 / lv.bpm, combo: 0, score: 0, playing: false }, performance.now() / 1000);
  const box = $('#studio-count');
  box.hidden = false;
  $('#studio-count-msg').textContent = st.file ? '녹화 준비 중… 화면 그대로 영상으로 저장돼요' : '폰 화면 녹화 켜셨나요? 곧 시작해요 (곡이 멈추면 화면을 톡)';
  for (const n of ['3', '2', '1']) {
    $('#studio-count-num').textContent = n;
    await new Promise((r) => setTimeout(r, 800));
    if (!st.active) {
      box.hidden = true;
      return;
    }
  }
  box.hidden = true;
  if (playId === BEAT_ID && sync.firstBeat != null && !st.file) toast('「영상 파일로 바로 저장」을 켜야 화면 녹화한 노래 박에 맞춰져요', 3000);
  // 박자 맞추기(화면 녹화로 맞춤)는 녹화를 '노래 구간 시작' 순간에 시작 → startLevel 뒤에
  if (st.file && !(playId === BEAT_ID && sync.firstBeat != null)) startRecorder();
  await startLevel(playId);
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
    st.recCtx = audio.ctx.currentTime; // 영상 0초 = 이 소리 시각 (첫 쿵이 영상 몇 초인지 계산용)
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

/** 💀 실패 영상: 하트가 다 떨어짐 → '띠로리' + 그대로 끝 (studioFinish 가 도발 문구 장면을 찍음) */
function studioFailDeath() {
  const g = state.game;
  if (!g || !state.studio.active) return;
  g.giveUp();
  try {
    audio.aww();
  } catch {}
}

async function studioFinish(res) {
  const st = state.studio;
  // 마지막 장면(환호하는 마스코트)을 잠깐 더 담기
  const g = state.game;
  const t0 = performance.now();
  const died = !!(res.failed && g && g.level.failReel);
  await new Promise((resolve) => {
    (function hold() {
      const rt = performance.now() / 1000;
      renderer.draw(
        {
          now: died ? g.diedAt : g.endTime,
          notes: died ? g.notes : [],
          dead: died,
          lives: died ? 0 : null,
          maxLives: MAX_LIVES,
          progress: res.progress,
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
      // 노래 맞히기: 정답이 뜨는 장면을 넉넉히
      if (performance.now() - t0 < (renderer.studio && (renderer.studio.quiz || died) ? 3600 : res.challenge ? 2400 : 1500)) requestAnimationFrame(hold);
      else resolve();
    })();
  });
  // 박자 맞추기: 첫 쿵이 영상 몇 초에 나오나 (인스타에서 노래 첫 박을 여기에 맞춤)
  const firstHit = g && g.level.beat && st.recorder && st.recCtx != null ? g.startTime + g.tempo.barStart(COUNT_IN_BARS) - st.recCtx : null;
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
    $('#studio-done-msg').textContent =
      g && g.level.withSong
        ? '노래를 같이 넣은 확인용 영상이에요. 박이 맞으면, 인스타에 올릴 건 「노래도 같이 틀기」를 끄고 다시 찍으세요 (노래는 인스타에서 넣기)'
        : g && g.level.synced
        ? (g.level.syncCountdown ? `영상 0초부터 노래가 나오고, ${g.level.syncCountdown}초 카운트다운 뒤 첫 박(영상 ${g.level.syncLead.toFixed(2)}초)부터 드럼이에요. ` : '') + '영상 0초 = 노래 구간 시작이에요. 인스타에서 같은 노래·같은 구간을 넣고 노래 클립을 맨 앞(0초)에 붙이면 맞아요. 드럼이 노래보다 빠르면 「싱크 보정」을 +, 늦으면 −로 바꿔 다시 찍기'
        : firstHit != null && firstHit > 0
        ? `영상이 만들어졌어요. 첫 쿵은 영상 약 ${firstHit.toFixed(1)}초예요. 인스타에서 영상 앞을 그만큼 잘라내고, 노래는 하이라이트 첫 박(첫 강세)부터 시작하게 고르면 박자가 맞아요.`
        : '영상이 만들어졌어요. 저장해서 릴스에 올려보세요!';
    // 보정 없이 첫 쿵이 와야 할 영상 시각과 비교 (보정값은 그 차이만큼)
    if (g && g.level.synced && !g.level.withSong && state.studio.mode === 'auto' && firstHit != null) syncSelfCheck(blob, firstHit, g.level.syncLead);
  } else {
    video.hidden = true;
    $('#btn-studio-save').hidden = true;
    $('#studio-done-msg').textContent = '화면 녹화를 멈추고 사진 앱에서 확인하세요. 위아래를 9:16으로 잘라 쓰면 딱 맞아요.';
  }
  if (!res.auto && !res.challenge && !res.failed && !isQuizId(res.levelId)) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `okaystra-${isQuizFormat() ? 'quiz-' + st.level : isFailFormat() ? 'fail-' + st.level : isChallengeId(st.level) ? 'challenge' : st.level + '단계'}.${ext}`, { type: st.blob.type });
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
// ---------------- 🏆 랭킹전 (실시간 매칭 → 안 잡히면 고스트) ----------------
//   실시간 상대를 RANKED_WAIT_MS 동안 찾고(5초마다 물어봄), 붙으면 서버가 바로 시작 시각을 정함.
//   안 잡히면 비슷한 점수인 사람의 예전 판(고스트)과 겨룸. 판이 끝나면 /api/ranked 로 결과 한 번 → 엘로 점수.
const RANKED_WAIT_MS = 20_000;
const roomUi = { round: 0, newMode: 'versus' };
const rk = { info: null, infoAt: 0, sub: null, game: null };
const TIER_UI = { bronze: ['🥉', '브론즈'], silver: ['🥈', '실버'], gold: ['🥇', '골드'], diamond: ['💎', '다이아'], master: ['👑', '마스터'] };
const TIER_MIN = { bronze: 0, silver: 1100, gold: 1300, diamond: 1500, master: 1700 };
const tierOfRating = (r) => Object.keys(TIER_MIN).reduce((t, k) => (r >= TIER_MIN[k] ? k : t), 'bronze');
const tierHtml = (key, rating) => `${TIER_UI[key] ? TIER_UI[key][0] + ' ' + TIER_UI[key][1] : ''}${rating != null ? ` <b>${fmt(rating)}</b>` : ''}`;
function roomOtherName() {
  const o = state.roomClient && state.roomClient.other;
  if (!o) return '상대';
  return o.rt != null ? `${TIER_UI[tierOfRating(o.rt)][0]}${o.name}` : o.name;
}
/** 서버 방 이름 규칙(글자·숫자·_ . 공백, 12자)에 맞춘 내 이름 */
function myRoomName() {
  const raw = (state.me && state.me.player && state.me.player.username) || load('roomName', '') || '';
  return raw.replace(/[^\p{L}\p{N}_. ]/gu, '').trim().slice(0, 12) || '드러머';
}
function roomErrText(e) {
  const k = (e && (e.data && e.data.error)) || (e && e.message) || '';
  return (
    {
      rate_limited: '잠시 뒤 다시 해 주세요',
      busy: '서버가 붐벼서 멀티는 잠시 쉬어요 · 혼자 치기는 그대로예요',
      no_server: '지금은 서버에 연결할 수 없어요',
      room_gone: '대결이 끝났어요',
      daily_limit: '오늘 랭킹전은 다 쳤어요! 내일 다시 만나요 (하루 30판)',
      confirm_required: '🏆 랭킹전은 팔로워 인증을 받아야 할 수 있어요',
      confirm_pending: '🏆 랭킹전은 팔로워 인증을 받아야 할 수 있어요',
    }[k] || '연결이 불안정해요. 잠시 뒤 다시 해 주세요'
  );
}
/** 대결 창에서 보일 칸: entry(처음) · wait(랭킹전 상대 찾는 중) · lobby(친구 방 대기실) */
function roomPanel(which) {
  $('#room-entry').hidden = which !== 'entry';
  $('#room-wait').hidden = which !== 'wait';
  $('#room-lobby').hidden = which !== 'lobby';
}
/** 랭킹전·건의하기 잠금: 팔로워 인증 안 했으면 true (개발용 ?gate=open 이면 풀림) */
function followGated() {
  return state.cfg.gateMode !== 'open' && !isConfirmed() && !freePass();
}
function openRoom(code) {
  if (followGated()) {
    openVerify(null, { label: '⚔️ 친구 대결은 팔로워만', then: () => openRoom(code) });
    return;
  }
  const c = state.roomClient;
  const friend = c.active && c.room && !c.room.pub;
  roomPanel(friend ? 'lobby' : c.active && c.waiting ? 'wait' : 'entry');
  if (friend) renderFriendRoom(c.room);
  else {
    $('#room-name').value = load('roomName', '') || myRoomName();
    if (code) $('#room-code').value = code;
    $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === roomUi.newMode)));
    showRushWaiting();
  }
  openModal('modal-room');
}
function renderRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  if (room.pub !== 'ranked') return renderFriendRoom(room);
  // 상대가 붙으면 서버가 정한 시각에 같이 시작
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    stopWaitTimer();
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      rk.game = { kind: 'live', levelId: room.level };
      startLevel(room.level, { room: { startAt, mode: 'versus', round: room.round, ranked: true } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
}
function stopWaitTimer() {
  clearInterval(roomUi.waitTimer);
  roomUi.waitTimer = null;
}
/** 🏆 랭킹전 시작: 실시간 상대 찾기 → RANKED_WAIT_MS 안에 안 잡히면 고스트 */
async function rankedGo() {
  if (followGated()) return openRoom();
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => openRoom() });
    return;
  }
  if (rk.info && rk.info.me && rk.info.me.left <= 0) return toast(roomErrText({ message: 'daily_limit' }), 3000);
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  const c = state.roomClient;
  try {
    if (c.active) await c.leave();
    const waiting = await c.quick(myRoomName(), 'ranked');
    if (!waiting) return; // 바로 붙음 → renderRoom 이 시작
  } catch (e) {
    toast(roomErrText(e), 3000);
    return;
  }
  openModal('modal-room');
  roomPanel('wait');
  const t0 = Date.now();
  const tick = async () => {
    if (!c.active || !c.waiting) return stopWaitTimer();
    const left = Math.max(0, Math.ceil((RANKED_WAIT_MS - (Date.now() - t0)) / 1000));
    $('#room-wait-title').textContent = `실시간 상대 찾는 중… ${left}초`;
    $('#room-wait-sub').textContent = '안 잡히면 비슷한 실력의 고스트와 겨뤄요';
    if (Date.now() - t0 < RANKED_WAIT_MS) return;
    stopWaitTimer();
    // 마지막으로 한 번 더 확인 (그 사이 누가 붙었으면 실시간으로)
    await c.poll();
    if (!c.active || !c.waiting) return;
    await c.leave();
    rankedGhost();
  };
  stopWaitTimer();
  tick();
  roomUi.waitTimer = setInterval(tick, 1000);
}
async function rankedGhost() {
  $('#room-wait-title').textContent = '👻 고스트 불러오는 중…';
  $('#room-wait-sub').textContent = '';
  let r;
  try {
    r = await state.api.ranked({ action: 'ghost' });
  } catch (e) {
    roomPanel('entry');
    toast(roomErrText(e), 3000);
    return;
  }
  closeModal('modal-room');
  const g = { ...r.ghost, name: `👻${r.ghost.name}`, rt: r.ghost.rating };
  rk.game = { kind: 'ghost', gid: r.gid, levelId: g.levelId };
  toast(`👻 ${r.ghost.name} 님의 기록과 대결! ${TIER_UI[tierOfRating(g.rating)][0]} ${fmt(g.rating)}`, 2600);
  startLevel(g.levelId, { room: { ghost: g, gid: r.gid, mode: 'versus' } });
}
/** 판 끝 → 결과 보내기 (실시간은 상대가 끝날 때까지 몇 번 다시) */
async function submitRanked(res) {
  const sub = rk.sub;
  if (!sub || sub.res !== res || sub.state !== 'idle') return;
  sub.state = 'sending';
  const c = state.roomClient;
  const body = { action: 'result', levelId: res.levelId, score: res.score, timeline: res.timeline, died: !!(res.failed || res.died) };
  if (res.room.ghost) Object.assign(body, { kind: 'ghost', gid: res.room.gid });
  else Object.assign(body, { kind: 'live', code: sub.code, slot: sub.slot, key: sub.key });
  try {
    const d = await state.api.ranked(body);
    if (d.wait) {
      sub.state = sub.tries++ < 30 ? 'idle' : 'error';
      if (sub.state === 'idle') setTimeout(() => submitRanked(res), 4000);
      return;
    }
    sub.state = 'done';
    sub.data = d;
    rk.infoAt = 0;
    if (d.tierUp && TIER_UI[d.tierUp] && d.delta > 0) setTimeout(() => toast(`🎉 ${TIER_UI[d.tierUp].join(' ')} 승급!`, 3200), 600);
    if (!res.room.ghost) c.leave();
  } catch (e) {
    sub.state = 'error';
    sub.err = e;
  }
  renderRoomResult();
}
/** 결과 화면: 랭킹전 / 친구 대결 결과 */
function renderRoomResult() {
  const res = state.lastResult;
  if (!res || !res.room) return;
  if (res.room.ranked || res.room.ghost) renderRankedResult();
  else if (res.room.rush) renderRushResult();
  else renderFriendResult();
}
/** 결과 화면: 랭킹전 결과 (승패 · 점수 변화) */
function renderRankedResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  if (!rk.sub || rk.sub.res !== res) rk.sub = { res, state: 'idle', tries: 0, code: c.code, slot: c.slot, key: c.key };
  const sub = rk.sub;
  const mine = res.score;
  const died = !!(res.failed || res.died);
  const word = { 1: '승리! 🎉', 0: '아쉽게 패배…', 0.5: '무승부!' };
  const cls = { 1: 'win', 0: 'lose', 0.5: 'draw' };
  let opName, theirs, result = null, why = '';
  if (res.room.ghost) {
    const g = res.room.ghost;
    opName = g.name;
    theirs = g.score;
    result = died ? 0 : mine === theirs ? 0.5 : mine > theirs ? 1 : 0;
    if (died) why = '목숨을 다 썼어요';
  } else {
    const o = c.active ? c.other : null;
    opName = o ? roomOtherName() : sub.opName || '상대';
    if (o) sub.opName = opName;
    theirs = o && o.final ? o.final.score : o && o.live ? o.live.score : null;
    if (theirs != null) sub.theirs = theirs;
    else theirs = sub.theirs ?? null;
    if (sub.data) result = sub.data.result;
    else if (o && o.final) result = !!o.final.died !== died ? (died ? 0 : 1) : mine === o.final.score ? 0.5 : mine > o.final.score ? 1 : 0;
    else if (o && o.left) result = 1;
    if (result === 1 && ((o && o.left && !o.final) || (sub.data && sub.data.opGone))) why = '상대가 나갔어요';
    else if (result === 1 && o && o.final && o.final.died) why = `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요`;
    else if (result === 0 && died) why = '내가 먼저 목숨을 다 썼어요';
  }
  if (sub.data && sub.data.void) result = null;
  let head;
  if (sub.data && sub.data.void) head = '<div class="room-word">상대가 시작 전에 나갔어요 · 점수 변화 없음</div>';
  else if (result == null) head = `<div class="room-word">${escapeHtml(opName)} 님 아직 치는 중…</div>`;
  else head = `<div class="room-word ${cls[result]}">${word[result]}</div>${why ? `<div class="room-why">${why}</div>` : ''}`;
  let rating = '';
  if (sub.state === 'done' && sub.data && !sub.data.void) {
    const d = sub.data;
    rating = `<div class="rk-delta ${d.delta >= 0 ? 'up' : 'down'}">${tierHtml(d.tier, d.rating)} <span>${d.delta >= 0 ? '+' : ''}${d.delta}</span></div>${d.placement ? `<div class="room-why">배치고사 ${d.placement}판 남음</div>` : ''}`;
  } else if (sub.state === 'error') rating = `<div class="room-why">${roomErrText(sub.err)} · 점수 반영이 안 됐어요</div>`;
  else rating = '<div class="room-why">점수 계산 중…</div>';
  box.innerHTML = `${head}${rating}
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${escapeHtml(opName)}<b>${theirs == null ? '-' : fmt(theirs)}</b></span></div>
    <div class="room-acts"><button class="btn btn-primary" data-action="room-next">🏆 한 판 더</button><button class="btn btn-ghost" data-action="room-leave">나가기</button></div>`;
  // 결과가 정해지면 서버로 (실시간은 서버가 상대 점수를 확인)
  if (sub.state === 'idle' && (res.room.ghost || result != null)) submitRanked(res);
}
/** 🎲 지금 기다리는 사람 수 (창 열 때 한 번만 물어봄 — 요청 아끼려고 폴링 안 함, 10초 안에 다시 열면 그대로) */
async function showRushWaiting() {
  const el = $('#rush-wait');
  if (Date.now() - (roomUi.cntAt || 0) < 10_000) return;
  roomUi.cntAt = Date.now();
  const n = await state.roomClient.waitingCounts();
  if (!n || n.rush == null) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle('on', n.rush > 0);
  el.textContent = n.rush > 0 ? `지금 대기 ${n.rush >= 5 ? '5명+' : n.rush + '명'} · 바로 붙어요!` : '지금 대기 0명';
}
// ----- 🎲 랜덤 대결 (4~18단계 무작위 · 둘 다 깨면 다음 곡 · 먼저 쓰러지면 짐) -----
const RUSH_WAIT_MAX_MS = 3 * 60_000; // 이만큼 기다려도 안 잡히면 그만 (서버 요청 아끼기)
const rush = { over: null }; // 끝난 판 결과 (방을 나간 뒤에도 결과 화면에 그대로)
async function rushGo() {
  if (followGated()) {
    openVerify(null, { label: '🎲 랜덤 대결은 팔로워만', then: rushGo });
    return;
  }
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: rushGo });
    return;
  }
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  rush.over = null;
  const c = state.roomClient;
  try {
    if (c.active) await c.leave();
    const waiting = await c.quick(myRoomName(), 'rush');
    if (!waiting) return; // 바로 붙음 → renderRoom 이 시작
  } catch (e) {
    toast(roomErrText(e), 3000);
    return;
  }
  openModal('modal-room');
  roomPanel('wait');
  const t0 = Date.now();
  const tick = async () => {
    if (!c.active || !c.waiting) return stopWaitTimer();
    const sec = Math.floor((Date.now() - t0) / 1000);
    $('#room-wait-title').textContent = `🎲 상대 찾는 중… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#room-wait-sub').textContent = '누가 들어오면 바로 시작해요 · 친구에게 랜덤 대결 들어오라고 해 보세요!';
    if (Date.now() - t0 < RUSH_WAIT_MAX_MS) return;
    stopWaitTimer();
    await c.poll();
    if (!c.active || !c.waiting) return;
    await c.leave();
    roomPanel('entry');
    toast('지금은 상대가 없어요. 조금 뒤에 다시 해 보세요', 3200);
  };
  stopWaitTimer();
  tick();
  roomUi.waitTimer = setInterval(tick, 1000);
}
/** 결과 화면: 랜덤 대결 (둘 다 깼으면 다음 곡 기다림 / 누가 쓰러졌으면 승패) */
function renderRushResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  const acts = '<div class="room-acts"><button class="btn btn-hot" data-action="rush-next">🎲 새 상대 찾기</button><button class="btn btn-ghost" data-action="room-leave">나가기</button></div>';
  if (rush.over && rush.over.res === res) {
    box.innerHTML = rush.over.html + acts;
    return;
  }
  const round = res.room.round || 1;
  const o = c.active && c.room && c.room.round === round ? c.other : c.active && c.room && c.room.round > round ? { next: true } : null;
  const iDied = !!(res.failed || res.died);
  const mine = res.score;
  let r = null, why = '', theirs = null;
  if (o && o.next) {
    // 다음 곡이 벌써 정해짐 → 곧 시작 (renderFriendRoom 이 시작함)
    box.innerHTML = `<div class="room-word win">둘 다 깼어요! 🎉</div><div class="room-why">${round + 1}곡째 곧 시작해요…</div>`;
    return;
  }
  if (!c.active || !o || (o.left && !o.final)) {
    if (iDied) r = 'lose', why = '내가 먼저 목숨을 다 썼어요';
    else r = 'win', why = '상대가 나갔어요';
  } else if (iDied || (o.final && o.final.died)) {
    theirs = o.final ? o.final.score : o.live ? o.live.score : null;
    if (iDied && !(o.final && o.final.died)) r = 'lose', why = '내가 먼저 목숨을 다 썼어요';
    else if (!iDied) r = 'win', why = `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요`;
    else {
      r = roomOutcome('versus', mine, theirs).result;
      why = '둘 다 쓰러져서 점수로';
    }
  } else if (o.final) {
    box.innerHTML = `<div class="room-word win">둘 다 깼어요! 🎉</div><div class="room-why">다른 곡으로 ${round + 1}곡째 준비 중…</div>
      <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${escapeHtml(o.name)}<b>${fmt(o.final.score)}</b></span></div>`;
    return;
  } else {
    box.innerHTML = `<div class="room-word">${escapeHtml(o.name)} 님 아직 치는 중… ${o.live ? Math.round((o.live.progress || 0) * 100) + '%' : ''}</div><div class="room-why">상대도 깨면 다른 곡이 바로 이어져요</div>`;
    return;
  }
  const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' };
  const name = o && o.name ? escapeHtml(o.name) : '상대';
  const html = `<div class="room-word ${r}">${word[r]}</div><div class="room-why">${why} · ${round}곡째에서 끝 (${round - 1}곡 같이 깸)</div>
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${name}<b>${theirs == null ? '-' : fmt(theirs)}</b></span></div>`;
  rush.over = { res, html };
  box.innerHTML = html + acts;
  if (c.active) c.leave(); // 판이 끝났으니 방에서 나옴
}
async function rushNext() {
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  refreshTitle();
  openRoom();
  rushGo();
}
// ----- 👫 친구 대결 방 (코드로 만들고 들어가기) -----
function renderFriendRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  // 둘 다 준비 → 새 판 시작 (서버가 정한 시각에)
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      // 개인전 + 방장이 '무제한'을 켰으면 서바이벌 (곡이 끝나도 둘 다 살아 있으면 끝없이 빨라짐). 아니면 원래 곡으로 점수 승부
      rk.game = null;
      if (room.pub === 'rush') {
        stopWaitTimer();
        startLevel(room.level, { room: { startAt, mode: 'versus', round: room.round, rush: true } });
        return;
      }
      startLevel(room.mode === 'versus' && room.endless ? levelSurvivalId(room.level) : room.level, { room: { startAt, mode: room.mode, round: room.round } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
  // 🎲 랜덤 대결은 대기실 없음 (붙으면 바로 시작)
  if (room.pub === 'rush') {
    if (c.waiting && !$('#modal-room').hidden) roomPanel('wait');
    return;
  }
  // 빠른 대결: 아직 상대가 없으면 '찾는 중' 화면
  if (c.waiting) {
    roomUi.wasWaiting = true;
    roomPanel('wait');
    return;
  }
  if (roomUi.wasWaiting) {
    roomUi.wasWaiting = false;
    if (c.other) toast(`상대를 찾았어요! '준비!'를 누르면 시작해요`, 2800);
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
  // 개인전 규칙: 점수 승부 / 💎 무제한(서바이벌) — 방장이 고름 (빠른 대결 방도)
  const versus = room.mode === 'versus';
  $('#room-rule').hidden = !versus;
  $('#room-rule-note').hidden = !versus;
  $$('#room-rule [data-rule]').forEach((b) => {
    const on = (b.dataset.rule === 'endless') === !!room.endless;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = !host && !on;
  });
  $('#room-rule-note').textContent = room.endless
    ? `💎 무제한: 곡이 끝나도 둘 다 살아 있으면 끝없이 빨라져요. 먼저 쓰러지면 져요${host ? '' : ' (방장이 골라요)'}`
    : `🏆 점수 승부: 곡이 끝났을 때 점수가 높으면 이겨요. 먼저 쓰러지면 바로 져요${host ? '' : ' (방장이 골라요)'}`;
  $$('#room-mode [data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === room.mode));
    b.disabled = !host && b.dataset.mode !== room.mode;
  });
  const sel = $('#room-level');
  const opts = LEVELS.filter((lv) => !lv.long).map((lv) => {
    const ok = lv.id <= FREE_UPTO || isConfirmed() || freePass();
    return `<option value="${lv.id}"${ok ? '' : ' disabled'}>${levelLabel(lv)} · ${lv.name}${ok ? '' : ' (잠김)'}</option>`;
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
    : pub && !(me && me.ready) && !other.ready
      ? `${other.name} 님과 붙었어요! 둘 다 '준비!'를 누르면 시작 (곡은 무작위)`
    : me && me.ready && !other.ready
      ? `${other.name} 님이 준비하면 바로 시작해요`
      : !(me && me.ready) && other.ready
        ? `${other.name} 님은 준비 완료! '준비!'를 누르면 시작해요`
        : room.mode === 'team'
          ? '팀전: 둘의 점수를 합쳐요. 피아노 파트는 곧 나와요!'
          : room.endless
            ? '💎 무제한 서바이벌: 먼저 목숨을 다 쓰면 져요!'
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
  const text = `오케이스트라 대결 방에 들어와! 코드 ${c.code}`;
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
function renderFriendResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  const o = c.other;
  const mine = res.score;
  const theirs = o && o.final ? o.final.score : null;
  const team = res.room.mode === 'team';
  const surv = !!levelSurvivalBase(res.levelId);
  const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' };
  let head;
  if ((surv ? !res.died : res.stopped) && (!c.active || !o || !o.final)) head = `<div class="room-word win">${word.win} ${c.active && o ? '' : '상대가 나갔어요'}</div>`;
  else if (!c.active) head = '<div class="room-word">방이 닫혔어요</div>';
  else if (!o) head = '<div class="room-word">친구가 나갔어요</div>';
  else if (theirs == null) head = `<div class="room-word">${escapeHtml(o.name)} 님 ${surv ? '결과 기다리는 중…' : '아직 치는 중… ' + (o.live ? Math.round((o.live.progress || 0) * 100) + '%' : '')}</div>`;
  else if (team) head = `<div class="room-word win">🤝 팀 점수 ${fmt(roomOutcome('team', mine, theirs).team)}</div>`;
  else if (surv || res.failed || res.stopped || o.final.died) {
    // 누가 목숨을 다 써서 판이 끝났으면 쓰러진 쪽이 짐 (서바이벌은 둘 다 쓰러지면 더 오래 버틴 쪽)
    const r = surv
      ? survivalOutcome({ died: !!res.died, survived: res.survived, score: mine }, { died: !!o.final.died, survived: o.final.survived, score: theirs })
      : !!res.failed !== !!o.final.died
        ? res.failed ? 'lose' : 'win'
        : roomOutcome('versus', mine, theirs).result;
    const why = r === 'win' ? `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요` : r === 'lose' ? '내가 먼저 목숨을 다 썼어요' : '';
    head = `<div class="room-word ${r}">${word[r]}</div>${why ? `<div class="room-why">${why}</div>` : ''}`;
  } else {
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

/** 결과 화면: 랭킹전 한 판 더 */
async function roomNext() {
  if (state.roomClient.active) await state.roomClient.leave();
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  refreshTitle();
  rankedGo();
}
async function roomLeave() {
  stopWaitTimer();
  if (state.roomClient.active) await state.roomClient.leave();
  roomUi.round = 0;
  document.body.classList.remove('room-game');
  if ($('#screen-result').classList.contains('in-room')) {
    $('#screen-result').classList.remove('in-room');
    $('#res-room').hidden = true;
    refreshTitle();
    show('screen-title');
    openRoom();
    return;
  }
  roomPanel('entry');
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

/** 랭킹전 판을 중간에 그만둠 → 진 판 (실시간은 방을 나가면 서버가 처리) */
function rankedQuit() {
  const g = rk.game;
  rk.game = null;
  if (!g) return;
  if (g.kind === 'live') state.roomClient.leave();
  else state.api.ranked({ action: 'result', kind: 'ghost', quit: true, gid: g.gid, levelId: g.levelId }).catch(() => {});
  rk.infoAt = 0;
  toast('랭킹전을 그만둬서 진 판이 됐어요', 2600);
}

// ---------------- 📲 홈 화면에 추가 (앱처럼) ----------------
// 안드로이드 크롬은 설치 창을 바로 띄울 수 있음 (beforeinstallprompt). 아이폰은 안내만
let installPrompt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const phoneOs = () => (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : '');
function initA2hs() {
  // 이미 홈 화면 아이콘으로 열었으면 버튼 숨김
  if (isStandalone()) {
    $('#btn-a2hs').hidden = true;
    $('#btn-a2hs').parentElement.classList.add('two');
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('#a2hs-install').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('#a2hs-install').hidden = true;
    closeModal('modal-a2hs');
    toast('홈 화면에 추가됐어요! 이제 아이콘으로 바로 들어와요');
  });
}
function openA2hs() {
  const os = phoneOs();
  $('#a2hs-tip-inapp').hidden = !isInApp();
  $('#a2hs-install').hidden = !installPrompt;
  // 내 폰 안내를 맨 위에 + 강조
  $$('#modal-a2hs .a2hs-os').forEach((el) => {
    el.classList.toggle('me', el.dataset.os === os);
    el.style.order = '';
  });
  const box = $('#modal-a2hs .sheet');
  const mine = os && $(`#modal-a2hs .a2hs-os[data-os="${os}"]`);
  if (mine) box.insertBefore(mine, box.querySelector('.a2hs-os'));
  openModal('modal-a2hs');
}
async function a2hsInstall() {
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null;
  $('#a2hs-install').hidden = true;
  try {
    await p.prompt();
  } catch {}
}

// ---------------- 업데이트 소식 · 건의하기 ----------------
function refreshNewsDot() {
  const seen = load('newsSeen', '') === LATEST_NEWS;
  $('#news-dot').hidden = seen;
  $('#gear-dot').hidden = seen; // 업데이트 버튼이 설정 안으로 가서 톱니에도 빨간 점 (2026-11-24)
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
  $('#suggest-contact').value = load('suggestContact', '');
  $('#suggest-count').textContent = `${[...$('#suggest-text').value].length} / 500`;
  // 자주 묻는 질문이 먼저 보이게 입력칸에 바로 포커스 주지 않음(폰 자판이 가림)
  openModal('modal-suggest');
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
    const contact = $('#suggest-contact').value.trim();
    await state.api.suggest(suggestState.kind, text, contact);
    if (contact) save('suggestContact', contact);
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

// ---------------- 🎹 시즌 2 피아노 미리보기 · 투표 (2026-11-23) ----------------
//   A 타일(세로) / B 건반(가로) 을 쳐 보고 한 표 (이용 등록한 계정당 한 번, 넣으면 바로 결과)
//   치는 건 연습판: 기록·랭킹·코인·서버 요청 없음. 투표만 요청 1번 (+ 이미 투표한 폰은 화면 열 때 결과 1번)
//   B 는 가로 화면: 폰이 세로면 무대(.p2-stage)를 90° 돌려 그림 (회전 잠금이어도 폰만 돌리면 됨)
const P2_POLL = 'piano2';
const P2_NAME = { tiles: 'A 타일', keys: 'B 건반' };
const p2 = { song: 1, style: null, game: null, fast: !!load('p2Fast', false) };
function p2Tried() {
  return load('p2Tried2', {}) || {};
}
function p2Bests() {
  return load('p2Best', {}) || {};
}
function openP2() {
  if (!P2_SONGS.some((x) => x.id === p2.song)) p2.song = P2_SONGS[0].id;
  renderP2();
  show('screen-p2');
  const mine = load('p2Vote', null);
  if (mine && state.api && state.api.mode === 'server') {
    state.api.poll(P2_POLL).then((r) => {
      if (r && r.counts) {
        save('p2Vote', { ...mine, counts: r.counts });
        renderP2();
      }
    }, () => {});
  }
}
function renderP2() {
  const tried = p2Tried();
  const bests = p2Bests();
  $('#p2-songs').innerHTML = P2_SONGS.map((x) => {
    const lv = getLevel(x.id);
    return `<button type="button" data-p2song="${x.id}" class="${x.id === p2.song ? 'on' : ''}"><b>${escapeHtml(lv.name)}</b><small>${escapeHtml(lv.composer || '')}</small><em class="d-${x.diff === '쉬움' ? 1 : x.diff === '보통' ? 2 : 3}">${x.diff}</em></button>`;
  }).join('');
  const fb = $('#p2-fast');
  fb.classList.toggle('on', p2.fast);
  fb.setAttribute('aria-pressed', String(p2.fast));
  $$('#screen-p2 [data-done]').forEach((el) => (el.hidden = !tried[el.dataset.done]));
  $$('#screen-p2 [data-best]').forEach((el) => {
    const b = bests[`${el.dataset.best}:${p2.song}${p2.fast ? ':f' : ''}`];
    el.textContent = b ? `최고 ${b.score.toLocaleString()}` : '';
  });
  const both = !!(tried.tiles && tried.keys);
  const mine = load('p2Vote', null);
  $$('#screen-p2 [data-action="p2-vote"]').forEach((b) => {
    b.disabled = !both || (!!mine && mine.choice === b.dataset.choice);
    b.classList.toggle('mine', !!mine && mine.choice === b.dataset.choice);
  });
  const hint = $('#p2-vote-hint');
  hint.textContent = mine ? '다른 쪽을 누르면 표를 바꿀 수 있어요' : both ? '투표하면 🪙 500코인 · 나중에 바꿀 수 있어요' : `둘 다 쳐 보면 투표할 수 있어요 (${(tried.tiles ? 1 : 0) + (tried.keys ? 1 : 0)}/2)`;
  const box = $('#p2-result');
  box.hidden = !mine;
  if (mine) {
    const c = mine.counts || {};
    const a = c.a || 0;
    const b = c.b || 0;
    const total = Math.max(1, a + b);
    const row = (k, name, n) => {
      const pct = Math.round((n / total) * 100);
      const lead = n >= (k === 'a' ? b : a) && n > 0;
      return `<div class="p2-bar ${mine.choice === k ? 'mine' : ''} ${lead ? 'lead' : ''}"><span class="p2-bar-name">${name}${mine.choice === k ? ' <em>내 표</em>' : ''}</span><b>${pct}%</b><span class="p2-bar-track"><i style="width:${pct}%"></i></span><small>${n.toLocaleString()}표</small></div>`;
    };
    box.innerHTML = row('a', 'A 타일', a) + row('b', 'B 건반', b) + `<p class="hint">지금까지 ${(a + b).toLocaleString()}명 투표 · 많이 받은 쪽이 시즌 2에 나와요</p>`;
  }
}
/** 무대 크기·회전: 건반은 가로(폰이 세로면 90° 돌림), 타일은 세로(넓은 화면이면 가운데 폭만) */
function p2Stage() {
  const st = $('#p2-stage');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rot = p2.style === 'keys' && vh > vw;
  st.classList.toggle('rot', rot);
  st.classList.toggle('land', p2.style === 'keys');
  if (p2.style === 'keys') {
    st.style.width = (rot ? vh : vw) + 'px';
    st.style.height = (rot ? vw : vh) + 'px';
    st.style.left = rot ? vw + 'px' : '0px';
  } else {
    const w = Math.min(vw, Math.round(vh * 0.66));
    st.style.width = w + 'px';
    st.style.height = vh + 'px';
    st.style.left = Math.round((vw - w) / 2) + 'px';
  }
  return rot;
}
window.addEventListener('resize', () => {
  if (!$('#screen-p2play').classList.contains('active')) return;
  p2Stage();
  if (p2.game) p2.game.resize();
});
function p2Layers(id) {
  for (const x of ['p2-turn', 'p2-paused', 'p2-over']) $('#' + x).hidden = x !== id;
}
async function p2Play(style) {
  if (style) p2.style = style;
  stopP2();
  show('screen-p2play');
  p2Stage();
  const ctx = audio.ensure();
  audio.unlock();
  // 가로 건반인데 폰이 세로: 돌려 달라고 먼저 (시작 버튼)
  if (p2.style === 'keys' && window.innerHeight > window.innerWidth && !p2.turned) {
    p2Layers('p2-turn');
    drawP2Idle();
    return;
  }
  p2Layers(null);
  await p2Begin(ctx);
}
async function p2Begin() {
  p2Layers(null);
  await audio.unlock();
  await Promise.race([audio.loadPiano(), new Promise((r) => setTimeout(r, 3000))]);
  if (!$('#screen-p2play').classList.contains('active')) return;
  p2Stage();
  const g = new PianoPreview({
    audio,
    canvas: $('#p2-canvas'),
    level: getLevel(p2.song),
    style: p2.style,
    fast: p2.fast,
    offsetMs: state.settings.offsetMs || 0,
    bias: Number(load('p2Bias', 0)) || 0,
    rotated: () => $('#p2-stage').classList.contains('rot'),
    onEnd: (r) => p2End(r),
  });
  p2.game = g;
  g.start();
}
/** 돌려 달라는 안내 뒤에 깔 빈 무대 (게임 그림 한 장) */
function drawP2Idle() {
  const g = new PianoPreview({ audio, canvas: $('#p2-canvas'), level: getLevel(p2.song), style: p2.style, onEnd: () => {} });
  g.resize();
  g.startTime = 0;
  g.state = 'paused';
  g.pausedAt = -5;
  g._draw(-5);
}
function stopP2() {
  if (p2.game) p2.game.stop();
  p2.game = null;
}
function p2End(r) {
  p2.game = null;
  if (r.style === 'keys' && Number.isFinite(r.bias)) save('p2Bias', Math.round(r.bias * 1000) / 1000);
  const tried = p2Tried();
  tried[p2.style] = 1;
  save('p2Tried2', tried);
  const bests = p2Bests();
  const key = `${p2.style}:${p2.song}${p2.fast ? ':f' : ''}`;
  const isNew = !bests[key] || r.score > bests[key].score;
  if (isNew) {
    bests[key] = { score: r.score, stars: r.stars, at: Date.now() };
    save('p2Best', bests);
  }
  const lv = getLevel(p2.song);
  $('#p2-res-song').textContent = `${lv.name} · ${P2_NAME[p2.style]}${p2.fast ? ' · ⚡' : ''}`;
  $('#p2-res-buddy').src = `assets/mascot/${r.stars >= 2 ? 'kong_cheer' : r.stars === 1 ? 'kong_idle' : 'kong_miss'}.webp`;
  $$('#p2-res-stars i').forEach((el, i) => {
    el.className = i < r.stars ? 'on' : '';
    el.style.animationDelay = `${0.25 + i * 0.22}s`;
  });
  $('#p2-res-grade').textContent = r.full ? 'FC' : r.grade;
  $('#p2-res-grade').className = 'g-' + (r.full ? 'fc' : r.grade.toLowerCase());
  $('#p2-res-new').hidden = !isNew || r.score <= 0;
  const tot = Math.max(1, r.notes + r.wrong);
  const rows = [
    ...(r.style === 'tiles'
      ? [['맞힘', r.hit, 'p', `${r.hit} / ${r.notes}`]]
      : [
          ['PERFECT', r.perfect, 'p', r.perfect],
          ['GREAT', r.great, 'g', r.great],
        ]),
    ['놓침', r.miss, 'm', r.miss],
    ['헛침', r.wrong, 'w', r.wrong],
  ];
  $('#p2-res-stats').innerHTML =
    `<div class="p2-res-acc"><span>맞힌 비율</span><b>${Math.round(r.accuracy * 100)}%</b><span>최대 콤보</span><b>${r.maxCombo}</b></div>` +
    rows.map(([n, v, c, txt]) => `<div class="p2-jrow j-${c}"><span>${n}</span><i><u style="width:${Math.round((v / tot) * 100)}%"></u></i><b>${txt}</b></div>`).join('') +
    (r.holdMax ? `<div class="p2-jrow j-h"><span>꾹 보너스</span><i><u style="width:${Math.round(r.holdPct * 100)}%"></u></i><b>+${r.bonus.toLocaleString()}</b></div>` : '') +
    (r.topSpeed > 1.01 ? `<div class="p2-res-acc"><span>최고 빠르기</span><b>×${r.topSpeed.toFixed(2)}</b></div>` : '');
  const other = p2.style === 'tiles' ? 'keys' : 'tiles';
  $('#p2-res-next').textContent = tried[other] ? '투표하러 가기' : `${P2_NAME[other]}도 쳐 보기`;
  // 점수 올라가는 숫자
  const el = $('#p2-res-score');
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 900);
    el.textContent = Math.round(r.score * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1 && !$('#p2-over').hidden) requestAnimationFrame(step);
  };
  p2Layers('p2-over');
  requestAnimationFrame(step);
  audio.unlock().then(() => audio.sfxFile(r.stars >= 2 ? 'cheer' : 'combo', 0.7)).catch(() => {});
}
function p2Pause() {
  if (p2.game && p2.game.pause()) p2Layers('p2-paused');
}
async function p2Vote(choice) {
  const tried = p2Tried();
  if (!tried.tiles || !tried.keys) return toast('둘 다 쳐 보면 투표할 수 있어요');
  const prev = load('p2Vote', null);
  if (prev && prev.choice === choice) return;
  if (!state.api || state.api.mode !== 'server') return toast('서버가 쉬는 중이에요. 조금 뒤에 다시 해 주세요');
  try {
    const r = await state.api.vote(P2_POLL, choice);
    save('p2Vote', { choice: r.mine || choice, counts: r.counts || {}, at: Date.now() });
    renderP2();
    if (r.bonus > 0) {
      addServerCoins(r.bonus);
      audio.sfxFile('gift', 0.7);
      return toast(`투표 고마워요! 🪙 ${r.bonus.toLocaleString()}코인 받았어요`);
    }
    toast(r.changed ? `${choice === 'a' ? 'A 타일' : 'B 건반'}로 표를 바꿨어요` : r.already ? '이미 이쪽에 투표했어요' : '투표했어요! 고마워요');
  } catch (e) {
    if (e && e.status === 401) {
      toast('투표는 이용 등록 후에 할 수 있어요');
      askNickname(true);
    } else toast('투표를 못 보냈어요. 조금 뒤에 다시 해 주세요');
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-p2song]');
  if (!b) return;
  p2.song = Number(b.dataset.p2song);
  renderP2();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) p2Pause();
});

const ACTIONS = {
  'room-open': () => openRoom(),
  'room-close': () => closeModal('modal-room'),
  'ranked-go': rankedGo,
  'rush-go': rushGo,
  'rush-next': rushNext,
  'room-create': roomCreate,
  'room-join': roomJoin,
  'room-ready': roomReady,
  'room-share': roomShare,
  'room-again': roomAgain,
  'room-leave': roomLeave,
  'room-next': roomNext,
  'news-open': openNews,
  'shop-open': () => openShop(),
  'close-shop': () => closeShop(),
  'close-shopitem': () => closeShopPreview(),
  'a2hs-open': openA2hs,
  'close-a2hs': () => closeModal('modal-a2hs'),
  'a2hs-install': a2hsInstall,
  'close-news': () => closeModal('modal-news'),
  // 🚨 긴급 공지 (새 주소 이사)
  'move-open': openMove,
  'close-move': () => closeModal('modal-move'),
  'move-ok': () => {
    save('moveNoticeOk', true);
    closeModal('modal-move');
    refreshMoveBtn();
  },
  'move-restore': () => {
    closeModal('modal-move');
    openVerify(null, { restore: true });
  },
  // 📮 기록 되찾기 요청
  'req-open': () => {
    closeModal('modal-move');
    closeModal('modal-verify');
    openReq();
  },
  'close-req': () => closeModal('modal-req'),
  'req-send': () => sendReq(),
  'req-check': () => checkReq({ manual: true }),
  'move-copy': async () => {
    const url = 'https://play.kongkong-drum.workers.dev';
    try {
      await navigator.clipboard.writeText(url);
      toast('새 주소를 복사했어요', 1600);
    } catch {
      toast(url, 3000);
    }
  },
  'move-a2hs': () => {
    closeModal('modal-move');
    document.querySelector('[data-action="a2hs-open"]').click();
  },
  'suggest-open': openSuggest,
  'maps-open': () => openMaps(),
  'p2-open': () => openP2(),
  'p2-play': (el) => p2Play(el.dataset.style),
  'p2-go': () => {
    p2.turned = true;
    p2Begin();
  },
  'p2-pause': () => p2Pause(),
  'p2-resume': () => {
    p2Layers(null);
    if (p2.game) p2.game.resume();
  },
  'p2-again': () => p2Play(),
  'p2-exit': () => {
    stopP2();
    p2Layers(null);
    renderP2();
    show('screen-p2');
  },
  'p2-next': () => {
    const tried = p2Tried();
    const other = p2.style === 'tiles' ? 'keys' : 'tiles';
    if (!tried[other]) return p2Play(other);
    p2Layers(null);
    renderP2();
    show('screen-p2');
    setTimeout(() => $('#p2-vote').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  },
  'p2-vote': (el) => p2Vote(el.dataset.choice),
  'p2-fast': () => {
    p2.fast = !p2.fast;
    save('p2Fast', p2.fast);
    renderP2();
  },
  'mm-start': (el) => startMapMode(el.dataset.mm),
  'mm-close': () => closeModal('modal-mapmode'),
  // 🚧 맵 만들기 잠시 막음 (11-22 운영자 요청). 풀 땐 MAPMAKE_OFF=false + index.html #maps-make 의 disabled·문구 되돌리기
  'mapmake-open': () => (MAPMAKE_OFF ? toast('맵 만들기는 잠시 쉬어요', 1600) : openMapMake()),
  'mk-bpm': (el) => {
    mk.bpm = Math.max(MAP_LIMITS.minBpm, Math.min(MAP_LIMITS.maxBpm, mk.bpm + Number(el.dataset.d)));
    mkSave();
    mkRender();
  },
  'mk-bar': (el) => {
    mk.bar = Math.max(0, Math.min(mk.mel.length - 1, mk.bar + Number(el.dataset.d)));
    mk.cur = 0;
    mkRender();
  },
  'mk-oct': (el) => {
    mk.oct = Math.max(2, Math.min(5, mk.oct + Number(el.dataset.d)));
    mkSave();
    mkRender();
  },
  'mk-baradd': () => mkBarOp('add'),
  'mk-barcopy': () => mkBarOp('copy'),
  'mk-barclear': () => mkBarOp('clear'),
  'mk-bardel': () => mkBarOp('del'),
  'mk-rest': () => mkRest(),
  'mk-back': () => mkBack(),
  'mk-play': () => mkPlayToggle(0),
  'mk-play-bar': () => mkPlayToggle(mk.bar),
  'mk-rec': () => recToggle(),
  'mk-drec': () => drecToggle(),
  'mk-undo': () => {
    if (!mkUndo) return;
    if (rec.on) recStop();
    if (drec.on) drecStop();
    mkStopPlay();
    Object.assign(mk, JSON.parse(mkUndo));
    mkUndo = null;
    $('#mk-undo').disabled = true;
    mkFixBars();
    mkRender();
    toast('되돌렸어요', 1200);
  },
  'mk-bardrumclear': () => {
    mkSnap();
    mk.drums[mk.bar] = '................';
    mk.drumsAuto = null;
    mkSave();
    mkRender();
  },
  'mk-try': () => mkPlay(false),
  'mk-upload': () => mkUpload(),
  'mk-new': () => mkNew(),
  'mk-capture': () => mkCapture(),
  'mk-transcribe': () => mkTranscribe(),
  'mk-score-make': () => mkScoreMake(),
  'mysong-open': () => openMysong(),
  'mysong-start': () => myStart(),
  'mysong-save': () => mySave(),
  'mysong-capture': () => myCapture(),
  'mysong-mul': (el) => myMul(Number(el.dataset.mul)),
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
  today: () => tryStart(todayPick().id, { free: true }),
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
    openRank('hall-stage');
  },
  'hall-photo': (a) => {
    hallPick = { season: Number(a.dataset.season), board: a.dataset.board, rank: Number(a.dataset.rank) };
    const f = $('#hall-photo-file');
    f.value = '';
    f.click();
  },
  'hall-msg': (a) => {
    const season = Number(a.dataset.season);
    const board = a.dataset.board;
    const rank = Number(a.dataset.rank);
    const h = ((lastHallData && lastHallData.hall) || []).find((x) => x.season === season && x.board === board && x.rank === rank);
    editHallMsg(season, board, rank, h && h.msg);
  },
  'hall-photo-del': async (a) => {
    if (!confirm('프로필 사진을 지울까요?')) return;
    try {
      await state.api.hallPhoto({ season: Number(a.dataset.season), board: a.dataset.board, rank: Number(a.dataset.rank), image: null });
      loadRank();
    } catch {
      toast('사진을 지우지 못했어요. 잠시 뒤 다시 해 주세요');
    }
  },
  settings: openSettings,
  pause: togglePause,
  resume: resumeGame,
  retry: () => {
    closeModal('modal-pause');
    closeModal('modal-continue');
    startLevel(state.levelId, { practice: state.practice });
  },
  'practice-open': () => {
    if (!canPractice(playable(state.levelId))) {
      toast('이 판은 연습 모드가 없어요. 일반 단계에서 해 보세요', 2600);
      return;
    }
    openModal('modal-practice');
  },
  'practice-close': () => closeModal('modal-practice'),
  'practice-go': (el) => {
    const rate = Number(el.dataset.rate) || 0.7;
    closeModal('modal-practice');
    closeModal('modal-pause');
    closeModal('modal-continue');
    startLevel(state.levelId, { practice: rate });
  },
  quit: () => {
    closeModal('modal-pause');
    // 🏆 랭킹전 판을 중간에 그만두면 진 판 / 친구 대결은 지금 점수로 끝낸 걸로 알림
    if (document.body.classList.contains('room-game')) {
      if (rk.game) rankedQuit();
      else if (state.roomClient.active && state.roomClient.room && state.roomClient.room.pub === 'rush') {
        state.roomClient.leave(); // 🎲 랜덤 대결을 그만두면 진 판 (상대는 내가 나간 걸 보고 이김)
        toast('랜덤 대결을 그만뒀어요', 2200);
      } else if (state.roomClient.active && state.game)
        state.roomClient.send({ final: { score: state.game.score, stars: 0, grade: 'F', failed: true, died: true, maxCombo: state.game.maxCombo, accuracy: 0 } }, true);
    }
    document.body.classList.remove('room-game');
    if (state.game) {
      const n = awardRunCoins(state.game);
      if (n > 0) toast(`코인 +${fmt(n)}`, 1800);
      state.game.stop();
    }
    if (state.levelId === MY_ID) {
      stopRecorder();
      openMysong();
      return;
    }
    if (state.levelId === UM_ID) return umQuit();
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
  'studio-cover': () => studioCover(),
  'transfer-make': () => transferMake(),
  'restore-open': () => {
    closeModal('modal-settings');
    openVerify(null, { restore: true });
  },
  'transfer-take': () => transferTake(),
  'beat-pick': () => pickBeat(),
  'sync-detect': () => syncDetect(),
  'sync-cd': (el) => {
    const v = Math.max(0, Math.min(20, syncCountdown() + Number(el.dataset.step)));
    save('syncCountdown', v);
    $('#sync-cd').textContent = v ? `${v}초` : '없음';
  },
  'sync-calib': (el) => {
    const v = Math.max(-500, Math.min(500, syncCalib() + Number(el.dataset.step)));
    save('syncCalib', v);
    $('#sync-calib').textContent = `${v > 0 ? '+' : ''}${v}ms`;
  },
  'sync-listen': () => syncListen(),
  'beat-reroll': () => {
    saveBeatForm({ reroll: true });
    toast('패턴을 새로 뽑았어요', 1200);
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
  // 🎤 세트 버튼 소리 (2026-11-22 사용자 '세트면 버튼 효과음도'): 세트를 끼면 버튼·칩을 누를 때 반짝 소리 (게임 치는 화면 밖에서만)
  document.addEventListener(
    'click',
    (e) => {
      if (audio.uiSet !== 'live' || $('#screen-game').classList.contains('active')) return;
      const b = e.target.closest('button, .chip, [data-act], a.btn');
      if (!b || b.disabled) return;
      audio.unlock().then(() => audio.sfxFile('live2_tap', 0.5)).catch(() => {});
    },
    true,
  );
  document.addEventListener('click', (e) => {
    const newMode = e.target.closest('#room-mode-new [data-mode]');
    if (newMode) {
      roomUi.newMode = newMode.dataset.mode;
      $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === newMode)));
      return;
    }
    const ruleBtn = e.target.closest('#room-rule [data-rule]');
    if (ruleBtn) {
      if (state.roomClient.isHost) state.roomClient.send({ endless: ruleBtn.dataset.rule === 'endless' }, true);
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
    const sf = e.target.closest('#studio-format [data-format]');
    if (sf) {
      pickStudioFormat(sf.dataset.format);
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
      const want = rm.dataset.rankMode;
      if (want !== rankModeOf(state.rankLevel)) {
        state.rankLevel = want === 'hall' ? 'hall-stage' : want === 'endless' ? ENDLESS_ID : 1;
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
      ACTIONS[a.dataset.action](a);
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
  $('#beat-tap').addEventListener('pointerdown', beatTap);
  $$('[data-beat-mul]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#beat-bpm').value = Number($('#beat-bpm').value || 120) * Number(b.dataset.beatMul);
      saveBeatForm();
    })
  );
  ['#beat-bpm', '#beat-rounds', '#beat-title', '#beat-click'].forEach((sel) => $(sel).addEventListener('change', () => saveBeatForm()));
  // 박자 맞추기 형식 (레벨업 / 비트) · 비트 난이도: 고르면 바로 그걸로 선택
  $('#beat-style').addEventListener('click', (e) => {
    const b = e.target.closest('[data-beat-style]');
    if (!b) return;
    $$('#beat-style button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pickBeat();
  });
  $('#beat-diff').addEventListener('click', (e) => {
    const b = e.target.closest('[data-beat-diff]');
    if (!b) return;
    $$('#beat-diff button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pickBeat();
  });
  $('#sync-file').addEventListener('change', (e) => e.target.files[0] && syncPick(e.target.files[0]));
  $('#my-file').addEventListener('change', (e) => e.target.files[0] && myPick(e.target.files[0]));
  // 🎹 유저 맵
  $('#maps-sort').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]');
    if (!b) return;
    um.sort = b.dataset.sort;
    $$('#maps-sort button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    loadMaps();
  });
  $('#maps-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-map-act]');
    const card = b && b.closest('.map-card');
    if (card) mapAct(card.dataset.id, b.dataset.mapAct, b);
  });
  $('#mk-file').addEventListener('change', (e) => e.target.files[0] && mkPickFile(e.target.files[0]));
  $('#mk-score-file').addEventListener('change', (e) => {
    if (e.target.files[0]) mkPickScore(e.target.files[0]);
    e.target.value = '';
  });
  $('#mk-score-mel').addEventListener('change', mkScoreStartOpts);
  $('#mk-score-start').addEventListener('change', () => {
    mks.startTouched = true;
    mkScoreRec();
  });
  $('#mk-score-len').addEventListener('change', mkScoreRec);
  $('#hall-photo-file').addEventListener('change', (e) => hallPhotoPicked(e.target.files[0]));
  $('#gift-ok').addEventListener('click', giftOk);
  $('#gift-photo-btn').addEventListener('click', () => {
    const h = giftMode && giftMode.gift && giftMode.gift.hall;
    if (!h) return;
    hallPick = { season: h.season, board: h.board, rank: h.rank };
    const f = $('#hall-photo-file');
    f.value = '';
    f.click();
  });
  $('#gift-later').addEventListener('click', giftLater);
  $('#mk-name').addEventListener('change', () => {
    mk.name = $('#mk-name').value.trim();
    mkSave();
  });
  $('#mk-way').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-way]');
    if (!b) return;
    mk.way = b.dataset.way;
    mkSave();
    mkRender();
  });
  $('#mk-step').addEventListener('change', () => {
    mk.step = $('#mk-step').checked;
    mkSave();
    mkRender();
  });
  $('#mk-drum-more').addEventListener('toggle', () => mkGrid());
  $('#mk-deco').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mkdeco]');
    if (!b) return;
    const [type, key] = b.dataset.mkdeco.split(':');
    const d = { ...(mk.deco || {}) };
    if (key) d[type] = key;
    else delete d[type];
    mk.deco = Object.keys(d).length ? d : null;
    mkSave();
    mkDecoRender();
  });
  $('#mk-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b || b.dataset.tab === mk.tab) return;
    if (rec.on) recStop();
    if (drec.on) drecStop();
    mk.tab = b.dataset.tab;
    mkSave();
    mkRender();
  });
  $('#mk-pads').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.kpad');
    if (!b) return;
    e.preventDefault();
    b.classList.remove('on');
    void b.offsetWidth;
    b.classList.add('on');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('on'), 450);
    padHit(b.dataset.inst);
  });
  $('#mk-pads').addEventListener('contextmenu', (e) => e.preventDefault());
  $('#mk-len').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-len]');
    if (!b) return;
    mk.len = Number(b.dataset.len);
    mkSave();
    mkRender();
  });
  $('#mk-auto').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-diff]');
    if (!b) return;
    mkSnap();
    mk.drumsAuto = b.dataset.diff;
    mkFixBars();
    mkRender();
    toast(mk.drumsAuto === 'song' ? '넣은 노래의 드럼 자리로 다시 채웠어요 (↩ 되돌리기 가능)' : '드럼을 자동으로 새로 채웠어요 (↩ 되돌리기 가능)', 1800);
  });
  $('#mk-keys').addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.mk-key');
    if (!k) return;
    e.preventDefault();
    k.classList.add('on');
    mkKeyDown(Number(k.dataset.midi), k);
  });
  // 건반에서 손 뗌: 녹음 중이면 음 길이가 정해짐
  const keyUp = () => {
    $$('#mk-keys .mk-key.on').forEach((x) => x.classList.remove('on'));
    for (const key of [...rec.down.keys()]) recUp(key);
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#mk-keys').addEventListener(ev, keyUp);
  $('#mk-grid').addEventListener('click', (e) => {
    const c = e.target.closest('.mk-cell');
    if (c) mkDrumTap(Number(c.dataset.step), c.dataset.inst);
  });
  // 드럼 칸 그림: 점을 누르면 지움, 빈 곳을 누르면 그 칸을 고름 (패드를 치면 거기에 들어감)
  $('#mk-droll').addEventListener('pointerdown', (e) => {
    if (drec.on) return;
    const r = e.currentTarget.getBoundingClientRect();
    const lx = 44;
    const x = e.clientX - r.left;
    if (x < lx) return void ((mk.dsel = null), mkDroll());
    const st = Math.max(0, Math.min(STEPS_PER_BAR - 1, Math.floor(((x - lx) / (r.width - lx)) * STEPS_PER_BAR)));
    const row = Math.max(0, Math.min(DROLL_ROWS.length - 1, Math.floor(((e.clientY - r.top) / r.height) * DROLL_ROWS.length)));
    const inst = { [CRASH]: 'C', [HAT]: 'H', [SNARE]: 'S', [KICK]: 'K' }[DROLL_ROWS[row][0]];
    const cells = [...(mk.drums[mk.bar] || '')];
    if (cells.length && drumCell(cells[st])[inst]) {
      cells[st] = toggleDrum(cells[st], inst);
      mk.drums[mk.bar] = cells.join('');
      mk.drumsAuto = null;
      mk.dsel = st;
      mkSave();
      mkRender();
      return;
    }
    mk.dsel = mk.dsel === st ? null : st;
    mkDroll();
  });
  $('#mk-roll').addEventListener('pointerdown', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mk.cur = Math.max(0, Math.min(STEPS_PER_BAR - 1, Math.floor(((e.clientX - r.left) / r.width) * STEPS_PER_BAR)));
    mkRender();
  });
  $('#my-diff').addEventListener('click', (e) => {
    const b = e.target.closest('[data-diff]');
    if (!b) return;
    my.diff = b.dataset.diff;
    save('myDiff', my.diff);
    $$('#my-diff button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  $('#my-from').addEventListener('click', (e) => {
    const b = e.target.closest('[data-from]');
    if (!b) return;
    my.from = b.dataset.from;
    $$('#my-from button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('#my-start-wrap').hidden = my.from !== 'pick';
  });
  $('#my-rec').addEventListener('change', (e) => (my.rec = e.target.checked));
  $('#quiz-bars').addEventListener('change', (e) => (state.studio.quizBars = Number(e.target.value)));
  $('#fail-secs').addEventListener('change', (e) => (state.studio.failSec = Number(e.target.value)));
  $('#calib-pad').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!audio.ctx) return;
    audio.kick(undefined, 0.6);
    if (calib.active) {
      calib.taps.push(audio.heardTime(e.timeStamp));
      calib.pTaps.push(e.timeStamp / 1000);
    }
  });
  // 오디오는 첫 터치에서 깨움 (iOS / 인앱 브라우저)
  const wake = () => audio.unlock().then(() => audio.loadPiano()).then(() => audio.orchOn && audio.loadOrch());
  window.addEventListener('pointerdown', wake, { once: true, capture: true });
  window.addEventListener('keydown', wake, { once: true, capture: true });
  // 폰이 소리를 멈췄으면(아이폰: 다른 앱 소리·화면 녹화·제어 센터·전화·알림 등) 다음 터치에서 다시 켬.
  //   iOS 는 터치 이벤트 안에서만 소리를 켤 수 있고, 다른 앱이 소리를 가져갔다 돌려주면 옛 엔진은 resume() 해도
  //   안 켜지거나 'running' 인데 시계가 멈춘 채로 남음 (곡이 '1' 에서 멈추던 것) → 그럴 땐 엔진을 새로 만들고
  //   게임은 멈췄던 자리부터 이어 감 (game.reanchor). 한 번 누를 때 여러 이벤트가 오니 1초에 한 번만
  const revive = () => {
    const ctx = audio.ctx;
    if (!ctx || ctx.state === 'closed') return;
    const g = state.game;
    // 일시정지·목숨 끝(이어하기 창·광고)은 일부러 소리를 멈춰 둔 것 → 여기서 켜면 곡이 혼자 흘러감 (광고 보는 동안 곡이 이어져서
    //   이어하자마자 죽던 것). 다시 켜는 건 게임의 resume() 이 함
    if (g && (g.state === 'paused' || g.state === 'dead')) {
      audio._visCheck = null;
      return;
    }
    const live = g && g.state === 'playing';
    let stuck = ctx.state !== 'running' || (live && g.state === 'playing' && audio.frozen);
    // 다른 앱에 갔다 돌아온 뒤 첫 터치: 'running' 이라는데 돌아온 뒤로 시계가 한 번도 안 갔으면 멈춘 것
    const vc = audio._visCheck;
    if (vc && performance.now() - vc.t > 150) {
      audio._visCheck = null;
      if (!stuck && ctx.currentTime === vc.ct) {
        stuck = true;
        audio._resumeFailed = true;
      }
    }
    if (!stuck) return;
    if (performance.now() - (audio.rebuiltAt || 0) < 1000) return;
    // 판 진행 중이거나 iOS 가 '끊김(interrupted)' 으로 잡고 있으면 엔진을 새로. 그 밖엔 그냥 다시 켜 봄
    if ((g && g.state === 'playing') || ctx.state === 'interrupted' || audio._resumeFailed) {
      audio.rebuild();
      audio._resumeFailed = false;
      if (live) g.reanchor();
      return;
    }
    audio.resetClock();
    const p = ctx.resume();
    if (p && p.then) {
      const t = setTimeout(() => (audio._resumeFailed = ctx.state !== 'running'), 500);
      p.then(() => clearTimeout(t), () => (audio._resumeFailed = true));
    }
  };
  for (const ev of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'keydown']) window.addEventListener(ev, revive, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audio.ctx && audio.ctx.state === 'running') audio._visCheck = { ct: audio.ctx.currentTime, t: performance.now() };
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game) awardRunCoins(state.game, false); // 🪙 앱을 닫아 버려도 그때까지 번 코인은 남게
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        $('#pause-stuck').hidden = true;
    $('#pause-title').textContent = '잠깐 쉬어요';
        openModal('modal-pause');
      }
    } else {
    }
  });
  let rz;
  window.addEventListener('resize', () => {
    canvasRect = null;
    clearTimeout(rz);
    rz = setTimeout(() => {
      if ($('#screen-game').classList.contains('active')) renderer.resize();
    }, 120);
  });
}

// ---------------- 시작 ----------------
async function boot() {
  initA2hs(); // 설치 창(beforeinstallprompt)은 일찍 올 수 있어서 맨 먼저
  $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon, el.hasAttribute('data-e'))));
  // 화면 글의 이모지 → 직접 그린 아이콘 (토스트·업데이트 소식 등 나중에 붙는 글까지)
  watchEmoji();
  Object.assign(state.studio, load('studio', {}), { active: false });
  buildTitle();
  bindActions();
  bindGameInput();
  coinsInit({ changed: refreshCoins });
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
      roomUi.round = 0;
      toast('방이 닫혔어요', 2400);
      if (!$('#modal-room').hidden) openRoom();
      if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
    },
  });
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'instagramHandle', 'siteUrl', 'freePassUntil', 'shopOpen']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
    if (sc.freePassUntil !== undefined) save('freePassUntil', Number(sc.freePassUntil) || 0);
  } catch {}
  const g = devParam('gate');
  if (g === 'open' || g === 'soft') state.cfg.gateMode = g;
  try {
    refundLegacyLocal();
  } catch {}
  initAds(state.cfg);
  initTracker({ enabled: state.api.mode === 'server' });
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  refreshNewsDot();
  refreshMoveBtn();
  checkReq();
  // 서버가 늦게 깨서 서버 없는 모드로 시작했으면 몇 초 뒤 한 번 더 붙어 봄
  if (state.api.mode !== 'server' && !serverResting()) setTimeout(() => reconnectServer({ force: true }), 4000);
  // 옛 주소에서 넘어옴 (/?t=123456): 그쪽 기록·로그인을 자동으로 가져옴
  const bridgeCode = params.get('t');
  if (/^\d{6}$/.test(bridgeCode || '')) {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('t');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    takeBridgeCode(bridgeCode);
  }
  $('#room-level').addEventListener('change', (e) => {
    if (state.roomClient.isHost) state.roomClient.send({ level: Number(e.target.value) }, true);
  });
  // 🖼 릴스 썸네일 만들기 (운영자 전용): /?thumb=okay 로 들어오면 이 기기에서 켜지고 영상 찍기 화면으로, ?thumb=off 면 끔
  const thumb = params.get('thumb');
  if (thumb === 'okay' || thumb === 'off') {
    save('thumbTool', thumb === 'okay');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('thumb');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (thumb === 'okay') setTimeout(() => {
      openStudio();
      toast('🖼 릴스 썸네일 칸이 켜졌어요 (영상 찍기 화면 맨 아래)', 3000);
    }, 300);
  }
  // 🖐 터치 표시: /?touch=show 면 이 기기에서 게임 중 손가락이 닿은 자리·판정을 그림 (터치 씹힘 신고 때 화면 녹화로 보려고), ?touch=off 면 끔
  const touchShow = params.get('touch');
  if (touchShow === 'show' || touchShow === 'off') {
    save('touchShow', touchShow === 'show');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('touch');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    setTimeout(() => toast(touchShow === 'show' ? '🖐 터치 표시를 켰어요 · 치면서 화면 녹화해 주세요' : '🖐 터치 표시를 껐어요', 3000), 300);
  }
  // 🛒 운영자 시험: /?shoptest=okay 면 이 기기에서만 상점 물건을 전부 써 봄 (산 것으로 안 침, 서버 안 감), ?shoptest=off 면 끔
  const shopTest = params.get('shoptest');
  if (shopTest === 'okay' || shopTest === 'off') {
    save('shopTest', shopTest === 'okay');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('shoptest');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    applyDeco();
    setTimeout(() => {
      if (shopTest === 'okay') {
        openShop();
        toast('🛒 이 기기에서 상점 물건을 전부 써 볼 수 있어요 · 상점에서 장착해요', 3600);
      } else toast('🛒 상점 시험 모드를 껐어요', 2000);
    }, 300);
  }
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
    if (document.hidden) return;
    if (state.api.mode !== 'server') return void reconnectServer();
    // 앱으로 자주 왔다 갔다 해도 10분에 한 번만, 이미 인증 끝난 사람은 안 물어봄 (요청 수 아끼기)
    if (state.me.confirmed && !state.me.hidden && !load('recoverReq', null)) return;
    if (Date.now() - meCheckedAt < 600 * 1000) return;
    meCheckedAt = Date.now();
    if (load('recoverReq', null)) return void checkReq();
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
  if (devParam('debug') === '1') window.__kk = { state, audio, renderer, startLevel };
}

boot();

return {  };
})();
