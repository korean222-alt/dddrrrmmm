// 맵 분위기(테마): 단계를 묶어서 묶음마다 무대가 바뀜. 곡이 달아오르면(heat) 조명·입자가 같이 커짐.
//   1~3 노을 피크닉 · 4~6 네온 시티 · 7~9 황금 콘서트홀 · 10~12 블랙 스테이지 · 13~15 용암 보스전 · 16 오로라 설원
//   그리그 무제한·레벨업 챌린지는 우주 무대에서 시작해 Lv 이 오를 때마다 맵이 바뀜(THEME_CYCLE).
//   단계별 무제한(e5 등)은 그 단계 맵 그대로.
//
// kit: 드럼 세트 마감. shell = [밝은, 기본, 어두운] 색, finish = gloss | sparkle | wood | fade | metal
//   hw = 금속 부품 색(chrome | gold | black), cym = 심벌 색(gold | silver | dark)

export const THEMES = {
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
export const THEME_GROUPS = [
  { from: 1, to: 3, key: 'sunset' },
  { from: 4, to: 6, key: 'city' },
  { from: 7, to: 9, key: 'hall' },
  { from: 10, to: 12, key: 'void' },
  { from: 13, to: 15, key: 'lava' },
  { from: 16, to: 16, key: 'aurora' },
];

/** 그리그 무제한·레벨업 챌린지: Lv 이 오를 때마다 이 순서로 맵이 바뀜 */
export const THEME_CYCLE = ['space', 'sunset', 'city', 'hall', 'void', 'lava', 'aurora'];

export function themeKeyForId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return 'space';
  const g = THEME_GROUPS.find((t) => n >= t.from && n <= t.to);
  return g ? g.key : n > 16 ? 'aurora' : 'sunset';
}

/** 레벨(판) → { key, cycle } . cycle 이면 Lv 마다 맵이 바뀜 */
export function themeForLevel(lv) {
  if (!lv) return { key: 'sunset', cycle: false };
  if (lv.baseId != null) return { key: themeKeyForId(lv.baseId), cycle: false };
  if (lv.challenge) return { key: 'space', cycle: true };
  return { key: themeKeyForId(lv.id), cycle: false };
}

/** cycle 판의 round 번째 단계 맵 */
export function cycleTheme(round) {
  const r = Math.max(1, round | 0);
  return THEME_CYCLE[(r - 1) % THEME_CYCLE.length];
}

/** 이 단계가 묶음의 첫 단계면 그 묶음 정보 (단계 목록 제목용) */
export function groupStarting(id) {
  const g = THEME_GROUPS.find((t) => t.from === id);
  return g ? { ...g, theme: THEMES[g.key] } : null;
}
