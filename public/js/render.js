// 게임 화면 그리기 (Canvas 2D)
// 콘셉트: 공연 무대 + 멀리서 다가오는 길(원근법). 길 맨 앞(판정선)에 악기가 놓여 있고, 줄 어디를 눌러도 그 악기가 울림.
//   노트는 먼 곳(화면 위, 작게)에서 나타나 점점 커지며 다가옴. 줄도 위로 갈수록 좁아짐.
//   노트는 드럼 게임 관례대로 킥 = 가로 막대, 스네어 = 둥근 드럼 헤드 패드, 하이햇/크래시 = 심벌.
// 타격감: 킥은 화면 전체가 '쿵' 하고 눌리고(펀치), 스네어는 '짝' 하고 옆으로 튀며 불꽃.

import { buildRasters } from './mascot.js';
import { buildKit, SNARE_RY } from './kit3d.js';
import { THEMES, themeForLevel, cycleTheme } from './themes.js';
import { paintScenery, SceneFx } from './scenery.js';

export const LANE = [
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

export const JUDGE_STYLE = {
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

  /**
   * laneAt + 옆 줄 정보. near = 바로 옆 줄들과 경계까지 거리(줄 너비 기준, 0~1, 가까운 순).
   *   엄지가 가운데 쪽으로 쏠려 경계 근처를 누르면 game.js 가 노트 있는 옆 줄로 봐줌
   */
  laneHit(x, y) {
    const L = this.L;
    const order = this.laneOrder;
    if (!L) return { lane: order[0], near: [] };
    const s = y === undefined ? 1 : clamp(this._sAtY(y), L.sFar, L.sBottom);
    const u = (L.cx + (x - L.cx) / s - L.x0) / L.laneW;
    const i = clamp(Math.floor(u), 0, order.length - 1);
    const f = clamp(u - i, 0, 1);
    const near = [];
    if (i > 0) near.push({ lane: order[i - 1], d: f });
    if (i < order.length - 1) near.push({ lane: order[i + 1], d: 1 - f });
    near.sort((a, b) => a.d - b.d);
    return { lane: order[i], near };
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
