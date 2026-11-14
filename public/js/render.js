// 게임 화면 그리기 (Canvas 2D)
// 콘셉트: 공연 무대 위 드럼 세트. 마스코트 드러머가 직접 치고, 노트는 드럼 게임 관례대로
//   킥 = 레인을 가로지르는 가로 막대 (페달 밟는 느낌), 스네어 = 둥근 드럼 헤드 패드.
// 타격감: 킥은 화면 전체가 '쿵' 하고 눌리고(펀치), 스네어는 '짝' 하고 옆으로 튀며 불꽃.

import { buildRasters, SNARE_VIEW } from './mascot.js';

export const LANE = [
  { key: 'kick', main: '#FF8A4C', light: '#FFC08F', dark: '#C9532A', rgb: '255,138,76', thumb: '왼쪽 엄지', word: '킥 (쿵)' },
  { key: 'snare', main: '#62C8FF', light: '#D7F1FF', dark: '#2F86CF', rgb: '98,200,255', thumb: '오른쪽 엄지', word: '스네어 (짝)' },
];

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
const SPOT_COLORS = ['255,95,162', '255,210,74', '95,211,255', '155,123,255'];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.rasters = null;
    this.studio = null; // 영상 찍기: { top, bottom, label }
    this.reset();
  }

  reset() {
    this.fx = { judges: [], sparks: [], bursts: [], booms: [], banners: [] };
    this.hitAt = [-9, -9];
    this.missAt = [-9, -9];
    this.punchAt = -9;
    this.punchPow = 0;
    this.crackAt = -9;
    this.comboPopAt = -9;
    this.cheerUntil = -9;
  }

  async resize(maxDpr = 2) {
    const dpr = this.studio ? maxDpr : Math.min(window.devicePixelRatio || 1, maxDpr);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    const GW = Math.min(W, H * 0.6);
    const GX = (W - GW) / 2;
    const studio = !!this.studio;
    const L = {
      W, H, dpr, GW, GX, studio,
      cx: W / 2,
      topY: H * (studio ? 0.25 : 0.155),
      strikeY: H * 0.585,
      laneX: [GX + GW * 0.3, GX + GW * 0.7],
      laneHalf: GW * 0.14,
      floorY: H * 0.865,
      drummerX: GX + GW * 0.5,
      drummerBase: H * 0.8,
      drummerW: GW * 0.38,
      bassX: GX + GW * 0.29,
      bassY: H * 0.795,
      bassW: GW * 0.4,
      snareX: GX + GW * 0.705,
      snareY: H * 0.772,
      snareW: GW * 0.36,
      hatX: GX + GW * 0.95,
      hatY: H * 0.69,
      hatR: GW * 0.12,
      crashX: GX + GW * 0.07,
      crashY: H * 0.635,
      crashR: GW * 0.14,
    };
    L.barW = L.laneHalf * 1.72;
    L.barH = GW * 0.046;
    L.padR = GW * 0.066;
    L.snareScale = L.snareW / SNARE_VIEW.w;
    this.L = L;
    const key = `${Math.round(L.drummerW * dpr)}x${Math.round(L.bassW * dpr)}`;
    if (this._rasterKey !== key) {
      this.rasters = await buildRasters(Math.round(L.drummerW * dpr), Math.round(L.bassW * dpr));
      this._rasterKey = key;
    }
    this._sticks();
    this._drawStatic();
  }

  /** 드러머 양손 스틱: 화면 오른쪽 손 = 스네어, 왼쪽 손 = 크래시 */
  _sticks() {
    const L = this.L;
    const w = L.drummerW;
    const top = L.drummerBase - w * 0.945;
    const hand = (hx) => ({ px: L.drummerX - w / 2 + (hx / 200) * w, py: top + (160 / 200) * w });
    const mk = (h, tx, ty, dir, lift) => {
      const hit = Math.atan2(ty - h.py, tx - h.px);
      const dist = Math.hypot(tx - h.px, ty - h.py);
      return { ...h, hit, rest: hit + lift * dir, len: (dist * 120) / 92, dir };
    };
    const sy = L.snareY - SNARE_VIEW.ry * L.snareScale * 0.1;
    this.stickR = mk(hand(172), L.snareX - L.GW * 0.02, sy, 1, -0.75);
    this.stickL = mk(hand(28), L.crashX + L.crashR * 0.35, L.crashY + L.crashR * 0.05, -1, -0.22);
  }

  _drawStatic() {
    const L = this.L;
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, L.H);
    bg.addColorStop(0, '#160F38');
    bg.addColorStop(0.55, '#33186A');
    bg.addColorStop(0.86, '#5B2167');
    g.fillStyle = bg;
    g.fillRect(0, 0, L.W, L.H);
    // LED 벽
    const step = L.GW * 0.045;
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = step; y < L.floorY - step; y += step)
      for (let x = (L.W % step) / 2; x < L.W; x += step) {
        g.beginPath();
        g.arc(x, y, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    // 조명 트러스
    g.fillStyle = '#0E0A24';
    g.fillRect(0, 0, L.W, L.H * 0.022);
    // 무대 바닥 (나무)
    const fl = g.createLinearGradient(0, L.floorY, 0, L.H);
    fl.addColorStop(0, '#8A5236');
    fl.addColorStop(1, '#3E2218');
    g.fillStyle = fl;
    g.fillRect(0, L.floorY, L.W, L.H - L.floorY);
    g.fillStyle = 'rgba(255,220,180,0.35)';
    g.fillRect(0, L.floorY, L.W, 2);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      const y = L.floorY + (L.H - L.floorY) * (k / 6) ** 1.4;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(L.W, y);
      g.stroke();
    }
    // 노트 하이웨이 (드럼 악보판)
    const x0 = L.laneX[0] - L.laneHalf;
    const x1 = L.laneX[1] + L.laneHalf;
    const y0 = L.topY;
    const y1 = L.strikeY + L.GW * 0.07;
    rr(g, x0 - 6, y0, x1 - x0 + 12, y1 - y0, L.GW * 0.04);
    g.fillStyle = 'rgba(10,6,28,0.66)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.stroke();
    [0, 1].forEach((i) => {
      const lg = g.createLinearGradient(0, y0, 0, y1);
      lg.addColorStop(0, `rgba(${LANE[i].rgb},0)`);
      lg.addColorStop(1, `rgba(${LANE[i].rgb},0.2)`);
      g.fillStyle = lg;
      g.fillRect(L.laneX[i] - L.laneHalf, y0 + 8, L.laneHalf * 2, y1 - y0 - 16);
      for (const side of [-1, 1]) {
        const x = L.laneX[i] + side * L.laneHalf;
        const rg = g.createLinearGradient(0, y0, 0, y1);
        rg.addColorStop(0, `rgba(${LANE[i].rgb},0)`);
        rg.addColorStop(1, `rgba(${LANE[i].rgb},0.85)`);
        g.strokeStyle = rg;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y0 + 10);
        g.lineTo(x, y1 - 10);
        g.stroke();
      }
    });
  }

  // ---------- 이벤트 ----------
  onTap(lane, rt) {
    this.hitAt[lane] = rt;
    if (lane === 0) {
      this.punchAt = rt;
      this.punchPow = 0.6;
    } else this.crackAt = rt;
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
    if (lane === 0) {
      this.punchAt = rt;
      this.punchPow = pow;
      this.fx.booms.push({ t0: rt, pow });
    } else {
      this.crackAt = rt;
      const n = judge === 'perfect' ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        this.fx.sparks.push({
          x: L.snareX,
          y: L.snareY - L.GW * 0.01,
          a,
          sp: L.GW * (0.5 + Math.random() * 0.8),
          t0: rt,
          life: 0.22 + Math.random() * 0.18,
          len: L.GW * (0.03 + Math.random() * 0.04),
          color: Math.random() < 0.5 ? '#FFFFFF' : Math.random() < 0.5 ? '#FFE45C' : LANE[1].light,
        });
      }
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
    const pe = Math.exp(-(rt - this.punchAt) * 22) * this.punchPow; // 킥 펀치
    const ce = Math.exp(-(rt - this.crackAt) * 30); // 스네어 크랙
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const fever = st.combo >= 30;

    this._drawSpots(st, rt, pe, fever);
    ctx.save();
    const sc = 1 + pe * 0.014;
    ctx.translate(L.cx, L.H * 0.6);
    ctx.scale(sc, sc);
    ctx.translate(-L.cx + (Math.random() - 0.5) * ce * 3, -L.H * 0.6 + pe * 4);

    this._drawBeatLines(st);
    this._drawCombo(st, rt);
    this._drawTargets(st, rt);
    this._drawNotes(st);
    this._drawBursts(rt);
    this._drawKit(st, rt, pe);
    this._drawJudges(rt);
    ctx.restore();

    this._drawCrowd(st, rt, fever);
    this._drawBanners(rt);
    this._drawCountIn(st);
    if (this.studio) this._drawStudio(st);
  }

  _drawSpots(st, rt, pe, fever) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const beatGlow = st.playing ? Math.pow(1 - phase, 4) : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const speed = fever ? 1.6 : 0.6;
    [0.08, 0.34, 0.66, 0.92].forEach((fx, k) => {
      const x = L.GX + L.GW * fx;
      const ang = Math.sin(rt * speed + k * 1.7) * 0.35 + (fx - 0.5) * -0.5;
      const len = L.H * 0.95;
      const spread = L.GW * 0.16;
      const tx = x + Math.sin(ang) * len;
      const ty = L.H * 0.02 + Math.cos(ang) * len;
      const a = 0.07 + beatGlow * 0.05 + pe * 0.12 + (fever ? 0.05 : 0);
      const gr = ctx.createLinearGradient(x, 0, tx, ty);
      gr.addColorStop(0, `rgba(${SPOT_COLORS[k]},${a * 2})`);
      gr.addColorStop(1, `rgba(${SPOT_COLORS[k]},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - 4, L.H * 0.02);
      ctx.lineTo(tx - spread * Math.cos(ang), ty + spread * Math.sin(ang));
      ctx.lineTo(tx + spread * Math.cos(ang), ty - spread * Math.sin(ang));
      ctx.lineTo(x + 4, L.H * 0.02);
      ctx.fill();
      ctx.fillStyle = `rgba(${SPOT_COLORS[k]},0.9)`;
      ctx.beginPath();
      ctx.arc(x, L.H * 0.022, L.GW * 0.018, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _y(dt, approach) {
    const L = this.L;
    return L.strikeY - (dt / approach) * (L.strikeY - L.topY);
  }

  _drawBeatLines(st) {
    const ctx = this.ctx;
    const L = this.L;
    if (!st.beatDur) return;
    const sub = st.beatDur / 2;
    const first = Math.ceil(st.now / sub);
    for (let b = first; ; b++) {
      const dt = b * sub - st.now;
      if (dt > st.approach) break;
      const y = this._y(dt, st.approach);
      if (y < L.topY + 10) continue;
      const bar = b % 8 === 0;
      const beat = b % 2 === 0;
      ctx.strokeStyle = bar ? 'rgba(255,255,255,0.4)' : beat ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = bar ? 2.5 : 1.2;
      for (const i of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(L.laneX[i] - L.laneHalf + 4, y);
        ctx.lineTo(L.laneX[i] + L.laneHalf - 4, y);
        ctx.stroke();
      }
    }
  }

  _drawTargets(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const pulse = st.playing ? Math.pow(1 - phase, 3) : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L.laneX[0] - L.laneHalf, L.strikeY);
    ctx.lineTo(L.laneX[1] + L.laneHalf, L.strikeY);
    ctx.stroke();
    const k = 1 + pulse * 0.05;
    const hk = rt - this.hitAt[0] < 0.1;
    rr(ctx, L.laneX[0] - (L.barW * k) / 2, L.strikeY - (L.barH * k) / 2, L.barW * k, L.barH * k, (L.barH * k) / 2);
    ctx.fillStyle = hk ? 'rgba(255,138,76,0.55)' : 'rgba(255,138,76,0.12)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,170,120,${0.6 + 0.4 * pulse})`;
    ctx.stroke();
    const hs = rt - this.hitAt[1] < 0.1;
    ctx.beginPath();
    ctx.arc(L.laneX[1], L.strikeY, L.padR * k, 0, Math.PI * 2);
    ctx.fillStyle = hs ? 'rgba(98,200,255,0.55)' : 'rgba(98,200,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = `rgba(180,230,255,${0.6 + 0.4 * pulse})`;
    ctx.stroke();
  }

  _kickBar(x, y, alpha, grey) {
    const ctx = this.ctx;
    const L = this.L;
    const w = L.barW;
    const h = L.barH;
    ctx.save();
    ctx.globalAlpha = alpha;
    rr(ctx, x - w / 2, y - h / 2 + h * 0.3, w, h, h / 2);
    ctx.fillStyle = grey ? '#6E6880' : LANE[0].dark;
    ctx.fill();
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    const gr = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    gr.addColorStop(0, grey ? '#C9C4D6' : LANE[0].light);
    gr.addColorStop(1, grey ? '#9A94AE' : LANE[0].main);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    rr(ctx, x - w / 2 + h * 0.5, y - h * 0.32, w * 0.45, h * 0.18, h * 0.09);
    ctx.fill();
    ctx.restore();
  }

  _snarePad(x, y, alpha, grey) {
    const ctx = this.ctx;
    const r = this.L.padR;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grey ? '#6E6880' : '#4C6E9E';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grey ? '#C9C4D6' : '#E8E6F0';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const gr = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r * 0.78);
    gr.addColorStop(0, '#FFFFFF');
    gr.addColorStop(1, grey ? '#B9B4C4' : LANE[1].light);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.76, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = grey ? '#8C86A0' : LANE[1].main;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = grey ? '#8C86A0' : LANE[1].dark;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
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
    const seen = new Set();
    for (const n of vis) {
      if (n.pair < 0 || n.judged) continue;
      if (seen.has(n.pair)) {
        const y = this._y(n.time - st.now, st.approach);
        ctx.strokeStyle = 'rgba(255,228,92,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(L.laneX[0] + L.barW / 2, y);
        ctx.lineTo(L.laneX[1] - L.padR, y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else seen.add(n.pair);
    }
    for (let k = vis.length - 1; k >= 0; k--) {
      const n = vis[k];
      const dt = n.time - st.now;
      const y = this._y(dt, st.approach);
      let a = clamp((1 - dt / st.approach) / 0.08, 0, 1);
      if (dt < 0) a *= clamp(1 + dt * 5, 0, 1);
      if (n.judged) a *= 0.55;
      if (n.lane === 0) this._kickBar(L.laneX[0], y, a, n.judged);
      else this._snarePad(L.laneX[1], y, a, n.judged);
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
      if (b.lane === 0) {
        const w = L.barW * (1 + e * 0.6);
        const h = L.barH * (1 + e * 2.2);
        rr(ctx, L.laneX[0] - w / 2, L.strikeY - h / 2, w, h, h / 2);
        ctx.fillStyle = 'rgba(255,170,100,0.8)';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(L.laneX[1], L.strikeY, L.padR * (1 + e * 1.3), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(160,225,255,0.8)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _cymbal(x, y, r, tilt, wob) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt + wob);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.22, 0, 0, Math.PI * 2);
    const gr = ctx.createLinearGradient(-r, 0, r, 0);
    gr.addColorStop(0, '#C7922A');
    gr.addColorStop(0.45, '#FFE59A');
    gr.addColorStop(1, '#F4C84A');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,90,20,0.45)';
    ctx.lineWidth = 1;
    for (const f of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * f, r * 0.22 * f, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#8C6418';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.03, r * 0.1, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _stand(x, y1, y2) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.strokeStyle = '#D9D6E6';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  _drawKit(st, rt, pe) {
    const ctx = this.ctx;
    const L = this.L;
    const R = this.rasters;
    // 크래시: 크래시 칠 때 흔들림
    const ca = st.crashAge ?? 9;
    const cw = ca < 1.5 ? Math.sin(ca * 18) * Math.exp(-ca * 3) * 0.25 : 0;
    this._stand(L.crashX, L.crashY, L.floorY);
    this._cymbal(L.crashX, L.crashY, L.crashR, -0.22, cw);
    // 하이햇: 반주 하이햇에 맞춰 닫힘
    const ha = st.hatAge ?? 9;
    const close = ha < 0.08 ? 1 - ha / 0.08 : 0;
    this._stand(L.hatX, L.hatY, L.floorY);
    this._cymbal(L.hatX, L.hatY + L.hatR * 0.12, L.hatR, 0.05, 0);
    this._cymbal(L.hatX, L.hatY - L.hatR * (0.1 - close * 0.08), L.hatR, 0.05, 0);

    // 드러머
    const th = Math.min(rt - this.hitAt[0], rt - this.hitAt[1]);
    const tm = Math.min(rt - this.missAt[0], rt - this.missAt[1]);
    const set = R.kong;
    let face = set.idle;
    if (th < 0.16) face = set.hit;
    else if (tm < 0.45) face = set.miss;
    else if (rt < this.cheerUntil || st.finished) face = set.cheer;
    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const bob = st.playing ? Math.pow(1 - phase, 3) : 0;
    const tk = rt - this.hitAt[0];
    const kickSquash = tk < 0.5 ? Math.exp(-tk * 14) * Math.cos(tk * 30) : 0;
    const w = L.drummerW;
    const sy = 1 - bob * 0.045 - kickSquash * 0.1;
    const sx = 1 + bob * 0.03 + kickSquash * 0.07;
    ctx.drawImage(face, L.drummerX - (w * sx) / 2, L.drummerBase - w * sy * 0.945, w * sx, w * sy);

    const counting = !!(st.countIn && st.countIn.label);
    this._drawStick(this.stickL, st, counting ? 'count' : 'hit', bob, ca);
    this._drawStick(this.stickR, st, counting ? 'count' : 'hit', bob, rt - this.hitAt[1]);

    // 베이스드럼: 킥에 헤드가 '쿵' 부풀어 오름
    const bw = L.bassW * (1 + pe * 0.06);
    const bh = bw * 1.05;
    ctx.drawImage(R.bass, L.bassX - bw / 2, L.bassY - bh * (100 / 210), bw, bh);
    const kt = rt - this.hitAt[0];
    if (kt < 0.18) {
      ctx.fillStyle = `rgba(255,240,220,${0.6 * (1 - kt / 0.18)})`;
      ctx.beginPath();
      ctx.arc(L.bassX, L.bassY, bw * 0.39, 0, Math.PI * 2);
      ctx.fill();
    }
    this.fx.booms = this.fx.booms.filter((b) => rt - b.t0 < 0.45);
    for (const b of this.fx.booms) {
      const p = (rt - b.t0) / 0.45;
      ctx.strokeStyle = `rgba(255,170,110,${(1 - p) * b.pow})`;
      ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(L.bassX, L.bassY, L.bassW * (0.48 + easeOut(p) * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 스네어
    const stt = rt - this.hitAt[1];
    const sq = stt < 0.25 ? Math.exp(-stt * 25) * 0.05 : 0;
    const swd = L.snareW * (1 + sq);
    const shg = swd * (230 / 240) * (1 - sq);
    ctx.drawImage(R.snare, L.snareX - swd / 2, L.snareY - SNARE_VIEW.cy * L.snareScale * (1 - sq), swd, shg);
    if (stt < 0.14) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - stt / 0.14)})`;
      ctx.beginPath();
      ctx.ellipse(L.snareX, L.snareY, SNARE_VIEW.rx * L.snareScale * 0.9, SNARE_VIEW.ry * L.snareScale * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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

  _drawStick(s, st, mode, bob, age) {
    const ctx = this.ctx;
    let p = 0;
    if (age < 0.045) p = age / 0.045;
    else if (age < 0.28) p = 1 - easeOut((age - 0.045) / 0.235);
    let ang = s.rest + (s.hit - s.rest) * p;
    if (p === 0) ang -= bob * 0.12 * s.dir;
    if (mode === 'count') {
      // 카운트: 스틱을 머리 위로 들어 '딱딱' 부딪힘
      const ph = st.countIn ? st.countIn.phase : 0;
      ang = -Math.PI / 2 + s.dir * (ph < 0.12 ? 0.12 : 0.32);
    }
    const sh = (s.len * 24 * 1.3) / 120;
    ctx.save();
    ctx.translate(s.px, s.py);
    ctx.rotate(ang);
    ctx.drawImage(this.rasters.stick, -(s.len * 14) / 120, -sh / 2, s.len, sh);
    ctx.restore();
  }

  _drawCombo(st, rt) {
    if (st.combo < 3) return;
    const ctx = this.ctx;
    const L = this.L;
    const p = clamp((rt - this.comboPopAt) / 0.15, 0, 1);
    const sc = 1 + (1 - easeOut(p)) * 0.22;
    const y = L.topY + (L.strikeY - L.topY) * 0.24;
    const size = L.GW * 0.14 * sc;
    ctx.save();
    ctx.globalAlpha = 0.92;
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
    const latest = [null, null];
    for (const j of this.fx.judges) latest[j.lane] = j;
    for (const j of latest) {
      if (!j) continue;
      const t = (rt - j.t0) / 0.45;
      const sc = t < 0.12 ? 1.3 - (t / 0.12) * 0.3 : 1;
      const x = L.laneX[j.lane];
      const y = L.strikeY - L.GW * 0.11 - t * L.GW * 0.02;
      const size = L.GW * 0.055 * sc;
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

  _drawCrowd(st, rt, fever) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const bob = st.playing ? Math.pow(1 - phase, 2) : 0;
    const n = 11;
    const baseY = L.H * 0.985;
    const r = L.GW * 0.06;
    ctx.fillStyle = '#120B26';
    for (let k = 0; k < n; k++) {
      const x = L.GX + (L.GW * (k + 0.5)) / n + (k % 2 ? 4 : -4);
      const jump = (k % 3 === 0 ? bob : bob * 0.5) * L.GW * 0.012;
      const y = baseY - (k % 2 ? r * 0.3 : 0) - jump;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.6, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.6, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      if ((fever && k % 2 === 0) || (rt < this.cheerUntil && k % 3 !== 1)) {
        ctx.save();
        ctx.strokeStyle = '#120B26';
        ctx.lineWidth = r * 0.28;
        ctx.lineCap = 'round';
        const sway = Math.sin(rt * 6 + k) * r * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y);
        ctx.lineTo(x - r * 0.75 + sway, y - r * 1.9);
        ctx.moveTo(x + r * 0.5, y);
        ctx.lineTo(x + r * 0.75 + sway, y - r * 1.9);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _drawBanners(rt) {
    const ctx = this.ctx;
    const L = this.L;
    this.fx.banners = this.fx.banners.filter((b) => rt - b.t0 < 1.1);
    for (const b of this.fx.banners) {
      const t = (rt - b.t0) / 1.1;
      const size = L.GW * 0.09;
      const pop = t < 0.15 ? easeOut(t / 0.15) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
      const y = L.topY + (L.strikeY - L.topY) * 0.55;
      ctx.save();
      ctx.translate(L.cx, y);
      ctx.scale(pop, pop);
      ctx.rotate(-0.05);
      const w = L.GW * 0.7;
      const h = size * 1.4;
      rr(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = '#FF5FA2';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(b.text, 0, size * 0.05);
      ctx.restore();
    }
  }

  _drawCountIn(st) {
    if (!st.countIn) return;
    const ctx = this.ctx;
    const L = this.L;
    const { label, phase, fade } = st.countIn;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [0, 1].forEach((i) => {
      const fs = L.GW * 0.038;
      ctx.font = `${Math.round(fs)}px ${FONT}`;
      const t1 = LANE[i].thumb;
      const t2 = LANE[i].word;
      const tw = Math.max(ctx.measureText(t1).width, ctx.measureText(t2).width) + fs * 1.4;
      const x = L.laneX[i];
      const y = L.strikeY + L.GW * 0.03;
      rr(ctx, x - tw / 2, y, tw, fs * 2.8, fs * 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(t1, x, y + fs * 0.85);
      ctx.fillStyle = LANE[i].dark;
      ctx.fillText(t2, x, y + fs * 2);
    });
    if (label) {
      const a = 1 - phase;
      const sc = 1 + (1 - easeOut(Math.min(1, phase * 4))) * 0.35;
      const size = L.GW * 0.2 * sc;
      ctx.globalAlpha = clamp(a * 1.5, 0, 1);
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = INK;
      const y = L.topY + (L.strikeY - L.topY) * 0.42;
      ctx.strokeText(label, L.cx, y);
      ctx.fillStyle = '#FFE45C';
      ctx.fillText(label, L.cx, y);
    }
    ctx.restore();
  }

  _drawStudio(st) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
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
      const by = L.floorY + (L.H - L.floorY) * 0.42;
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

function fitFont(ctx, text, maxW, start) {
  let fs = Math.round(start);
  ctx.font = `${fs}px ${FONT}`;
  while (fs > 10 && ctx.measureText(text).width > maxW) {
    fs -= 1;
    ctx.font = `${fs}px ${FONT}`;
  }
  return fs;
}
