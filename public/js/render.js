// 게임 화면 그리기 (Canvas 2D)
// 콘셉트: 공연 무대 + 멀리서 다가오는 길(원근법). 길 맨 앞(판정선)에 악기가 놓여 있고, 줄 어디를 눌러도 그 악기가 울림.
//   노트는 먼 곳(화면 위, 작게)에서 나타나 점점 커지며 다가옴. 줄도 위로 갈수록 좁아짐.
//   노트는 드럼 게임 관례대로 킥 = 가로 막대, 스네어 = 둥근 드럼 헤드 패드, 하이햇/크래시 = 심벌.
// 타격감: 킥은 화면 전체가 '쿵' 하고 눌리고(펀치), 스네어는 '짝' 하고 옆으로 튀며 불꽃.

import { buildRasters } from './mascot.js';
import { loadBuddies } from './buddies.js';
import { buildKit, SNARE_RY } from './kit3d.js';
import { THEMES, SHOP_KITS, themeForLevel, cycleTheme } from './themes.js';
import { paintScenery, SceneFx } from './scenery.js';

export const LANE = [
  { key: 'kick', main: '#FF8A4C', light: '#FFC08F', dark: '#C9532A', rgb: '255,138,76', thumb: '왼쪽 엄지', word: '킥 (쿵)', short: '쿵' },
  { key: 'snare', main: '#62C8FF', light: '#D7F1FF', dark: '#2F86CF', rgb: '98,200,255', thumb: '오른쪽 엄지', word: '스네어 (짝)', short: '짝' },
  { key: 'hat', main: '#FFD24A', light: '#FFF2B8', dark: '#B9821C', rgb: '255,210,74', thumb: '오른쪽 엄지', word: '하이햇 (츠)', short: '츠' },
  { key: 'crash', main: '#C38BFF', light: '#EBDDFF', dark: '#7F4CCF', rgb: '195,139,255', thumb: '왼쪽 엄지', word: '크래시 (챙)', short: '챙' },
  { key: 'tom', main: '#4FE0A6', light: '#C9FBE6', dark: '#1F9E70', rgb: '79,224,166', thumb: '왼쪽 엄지', word: '탐탐 (둥)', short: '둥' },
];

// 🎨 콩(노트) 색 고르기 (상점에서 장착). 줄 순서: 쿵·짝·하이햇·크래시·탐탐 [main, light, dark]
export const NOTE_PALETTES = {
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
export function applyNoteColors(key) {
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
export const JUDGE_STYLE = {
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

export class Renderer {
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
    // 🎨 설정에서 고른 배경 (영상 찍기는 원래 맵 그대로)
    let pick = !this.studio && this.bgPick && THEMES[this.bgPick] ? this.bgPick : null;
    if (pick === 'photo' && !this.bgPhoto) pick = null; // 사진이 없으면(지웠거나 못 읽음) 원래 맵
    // 🎤 라이브 스테이지 세트: 배경을 '단계별'로 둔 사람은 세트 무대가 깔림
    if (!pick && !this.studio && this.uiStyle === 'live') pick = 'livestage';
    if (!this.studio && this.uiStyle === 's1') pick = 's1stage'; // 🥇 시즌 1 세트 무대
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

  /** 🎤 라이브 스테이지 세트로 그리는 중 (영상 찍기·장거리 피아노 곡은 원래 화면) */
  get live() {
    return this.uiStyle === 'live' && !this.studio && !this.melodyMode;
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
    const kp = !this.studio && this.kitPick && (THEMES[this.kitPick] || SHOP_KITS[this.kitPick]);
    this.kit = buildKit(
      kp ? { ...this.theme, kit: kp.kit } : this.theme,
      { instR: L.instR, padR: L.padR, barW: L.barW, barH: L.barH, cymR: L.cymR, dpr: L.dpr, standTo: L.H - L.strikeY },
      LANE
    );
    // ✨ 콩 스킨 질감 (영상 찍기는 기본 콩)
    const fx = !this.studio && skinFx();
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
export function preloadShopBg(src) {
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
