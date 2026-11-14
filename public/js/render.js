// 게임 화면 그리기 (Canvas 2D). 원근 2레인 + 동전 노트 + 드럼 위 마스코트.

import { buildRasters, DRUM_VIEW, DRUMS } from './mascot.js';

export const LANE = [
  { key: 'kong', main: '#FF8A5B', light: '#FFC2A3', dark: '#B9472A', ink: '#4A1A0A', rgb: '255,138,91', word: '쿵!', label: '왼쪽 엄지', sub: '쿵 · 킥' },
  { key: 'jjak', main: '#4FD6E0', light: '#B5F4F7', dark: '#1D8C97', ink: '#06363B', rgb: '79,214,224', word: '짝!', label: '오른쪽 엄지', sub: '짝 · 스네어' },
];

export const JUDGE_STYLE = {
  perfect: { text: 'PERFECT', color: '#FFE45C' },
  great: { text: 'GREAT', color: '#7CF5B4' },
  good: { text: 'GOOD', color: '#9CC8FF' },
  miss: { text: 'MISS', color: '#FF6B8A' },
};

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const K = 4.4; // 원근 강도
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.rasters = null;
    this.fx = { pops: [], judges: [], particles: [], ripples: [], banners: [] };
    this.laneFlash = [-9, -9];
    this.drumHit = [-9, -9];
    this.mascotHit = [-9, -9];
    this.mascotMiss = [-9, -9];
    this.comboPopAt = -9;
    this.cheerUntil = -9;
  }

  async resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    const GW = Math.min(W, H * 0.62);
    const GX = (W - GW) / 2;
    const L = {
      W, H, dpr, GW, GX,
      cx: W / 2,
      horizonY: H * 0.17,
      hitY: H * 0.655,
      laneX: [GX + GW * 0.27, GX + GW * 0.73],
      laneHalf: GW * 0.205,
      headRx: GW * 0.19,
    };
    L.headRy = (L.headRx * DRUM_VIEW.ry) / DRUM_VIEW.rx;
    L.drumScale = L.headRx / DRUM_VIEW.rx;
    L.drumW = DRUM_VIEW.w * L.drumScale;
    L.mascotW = L.headRx * 1.18;
    this.L = L;
    const key = `${Math.round(L.mascotW * dpr)}x${Math.round(L.drumW * dpr)}`;
    if (this._rasterKey !== key) {
      this.rasters = await buildRasters(Math.round(L.mascotW * dpr), Math.round(L.drumW * dpr));
      this._rasterKey = key;
    }
    this._drawStatic();
  }

  // 원근 투영: z=0 판정선, z=1 노트가 처음 보이는 거리
  scaleAt(z) {
    return 1 / (1 + z * K);
  }
  project(lane, z) {
    const L = this.L;
    const s = this.scaleAt(z);
    return { x: L.cx + (L.laneX[lane] - L.cx) * s, y: L.horizonY + (L.hitY - L.horizonY) * s, s };
  }
  edgeX(lane, side, s) {
    const L = this.L;
    const x = L.laneX[lane] + side * L.laneHalf;
    return L.cx + (x - L.cx) * s;
  }
  yAt(s) {
    return this.L.horizonY + (this.L.hitY - this.L.horizonY) * s;
  }

  _lanePath(lane) {
    const L = this.L;
    const sTop = this.scaleAt(1.25);
    const sBot = (L.H + 40 - L.horizonY) / (L.hitY - L.horizonY);
    const p = new Path2D();
    p.moveTo(this.edgeX(lane, -1, sTop), this.yAt(sTop));
    p.lineTo(this.edgeX(lane, 1, sTop), this.yAt(sTop));
    p.lineTo(this.edgeX(lane, 1, sBot), this.yAt(sBot));
    p.lineTo(this.edgeX(lane, -1, sBot), this.yAt(sBot));
    p.closePath();
    return p;
  }

  _drawStatic() {
    const L = this.L;
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    // 배경
    const bgGrad = g.createLinearGradient(0, 0, 0, L.H);
    bgGrad.addColorStop(0, '#1E1840');
    bgGrad.addColorStop(0.55, '#141030');
    bgGrad.addColorStop(1, '#0B0918');
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, L.W, L.H);
    // 지평선 빛
    const glow = g.createRadialGradient(L.cx, L.horizonY, 0, L.cx, L.horizonY, L.GW * 0.75);
    glow.addColorStop(0, 'rgba(255,216,77,0.20)');
    glow.addColorStop(0.4, 'rgba(160,110,255,0.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, L.W, L.H);
    // 별가루
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * L.W;
      const y = rnd() * L.H * 0.6;
      g.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.25})`;
      g.beginPath();
      g.arc(x, y, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    // 레인
    this.lanePaths = [0, 1].map((i) => this._lanePath(i));
    [0, 1].forEach((i) => {
      const col = LANE[i];
      const p = this.lanePaths[i];
      g.fillStyle = 'rgba(14,11,32,0.85)';
      g.fill(p);
      const lg = g.createLinearGradient(0, L.horizonY, 0, L.H);
      lg.addColorStop(0, `rgba(${col.rgb},0)`);
      lg.addColorStop(0.75, `rgba(${col.rgb},0.16)`);
      lg.addColorStop(1, `rgba(${col.rgb},0.05)`);
      g.fillStyle = lg;
      g.fill(p);
      // 레일
      const sTop = this.scaleAt(1.25);
      const sBot = (L.H + 40 - L.horizonY) / (L.hitY - L.horizonY);
      for (const side of [-1, 1]) {
        const x1 = this.edgeX(i, side, sTop);
        const y1 = this.yAt(sTop);
        const x2 = this.edgeX(i, side, sBot);
        const y2 = this.yAt(sBot);
        const rg = g.createLinearGradient(0, y1, 0, L.hitY);
        rg.addColorStop(0, `rgba(${col.rgb},0)`);
        rg.addColorStop(1, `rgba(${col.rgb},0.9)`);
        g.strokeStyle = `rgba(${col.rgb},0.18)`;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.strokeStyle = rg;
        g.lineWidth = 3;
        g.stroke();
      }
    });
    // 드럼 아래 라벨
    [0, 1].forEach((i) => {
      const x = L.laneX[i];
      const bottom = L.hitY + (DRUMS[LANE[i].key].height + DRUM_VIEW.ry) * L.drumScale;
      const y = Math.min(L.H - L.GW * 0.07, bottom + L.GW * 0.075);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = `${Math.round(L.GW * 0.052)}px ${FONT}`;
      g.fillStyle = '#FFF8EC';
      g.fillText(LANE[i].label, x, y);
      g.font = `${Math.round(L.GW * 0.036)}px ${FONT}`;
      g.fillStyle = `rgba(${LANE[i].rgb},0.95)`;
      g.fillText(LANE[i].sub, x, y + L.GW * 0.05);
    });
  }

  // ---------- 효과 트리거 ----------
  onTap(lane, rt) {
    this.drumHit[lane] = rt;
    this.mascotHit[lane] = rt;
    this.laneFlash[lane] = rt;
  }

  onJudge(lane, judge, rt, early) {
    const L = this.L;
    const style = JUDGE_STYLE[judge];
    if (judge === 'miss') {
      this.mascotMiss[lane] = rt;
      this.fx.judges.push({ lane, text: style.text, color: style.color, t0: rt, sub: '' });
      return;
    }
    const col = LANE[lane];
    const x = L.laneX[lane];
    const side = lane === 0 ? -1 : 1;
    const popSize = L.GW * (judge === 'perfect' ? 0.15 : 0.12);
    this.fx.pops.push({
      text: col.word,
      x: clamp(x + side * L.headRx * 0.7, L.GX + popSize * 0.8, L.GX + L.GW - popSize * 0.8),
      y: L.hitY - L.mascotW * 0.72,
      t0: rt,
      rot: side * (0.08 + Math.random() * 0.1),
      color: col.main,
      size: popSize,
    });
    this.fx.judges.push({ lane, text: style.text, color: style.color, t0: rt, sub: judge === 'perfect' ? '' : early ? 'FAST' : 'SLOW' });
    this.fx.ripples.push({ lane, t0: rt, color: col.rgb, big: judge === 'perfect' });
    const n = judge === 'perfect' ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      const sp = L.GW * (0.5 + Math.random() * 0.9);
      this.fx.particles.push({
        x: x + (Math.random() - 0.5) * L.headRx,
        y: L.hitY,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t0: rt,
        life: 0.45 + Math.random() * 0.35,
        r: L.GW * (0.008 + Math.random() * 0.012),
        color: Math.random() < 0.35 ? '#FFFFFF' : Math.random() < 0.5 ? col.light : '#FFE45C',
        star: Math.random() < 0.4,
      });
    }
  }

  onCombo(combo, rt) {
    this.comboPopAt = rt;
    if (combo > 0 && combo % 25 === 0) {
      this.fx.banners.push({ text: `${combo} COMBO!`, t0: rt });
      this.cheerUntil = rt + 0.9;
    }
  }

  // ---------- 매 프레임 ----------
  draw(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    if (!L) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

    // 레인 플래시
    [0, 1].forEach((i) => {
      const a = 1 - (rt - this.laneFlash[i]) / 0.18;
      if (a > 0) {
        ctx.fillStyle = `rgba(${LANE[i].rgb},${0.22 * a})`;
        ctx.fill(this.lanePaths[i]);
      }
    });

    this._drawBeatLines(st);
    this._drawCountIn(st);
    this._drawCombo(st, rt);

    // 드럼
    [0, 1].forEach((i) => this._drawDrum(i, st, rt));
    // 노트 (먼 것부터)
    this._drawNotes(st);
    // 판정 링 + 마스코트
    [0, 1].forEach((i) => this._drawRipples(i, rt));
    [0, 1].forEach((i) => this._drawMascot(i, st, rt));

    this._drawFx(rt);
  }

  _drawBeatLines(st) {
    const ctx = this.ctx;
    const beat = st.beatDur;
    if (!beat) return;
    const first = Math.ceil(st.now / beat);
    for (let b = first; ; b++) {
      const z = (b * beat - st.now) / st.approach;
      if (z > 1.2) break;
      if (z < 0) continue;
      const s = this.scaleAt(z);
      const y = this.yAt(s);
      const bar = b % 4 === 0;
      const alpha = clamp(1 - z / 1.2, 0, 1) * (bar ? 0.4 : 0.16);
      ctx.lineWidth = bar ? 2 : 1;
      for (const i of [0, 1]) {
        ctx.strokeStyle = `rgba(${LANE[i].rgb},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(this.edgeX(i, -1, s), y);
        ctx.lineTo(this.edgeX(i, 1, s), y);
        ctx.stroke();
      }
    }
  }

  _drawNotes(st) {
    const ctx = this.ctx;
    const L = this.L;
    const visible = [];
    for (const n of st.notes) {
      if (n.judged && n.result !== 'miss') continue;
      const dt = n.time - st.now;
      if (dt > st.approach * 1.2) break;
      if (dt < -0.25) continue;
      visible.push(n);
    }
    // 동시치기 연결선
    const pairs = new Map();
    for (const n of visible) if (n.pair >= 0 && !n.judged) pairs.set(n.pair, (pairs.get(n.pair) || 0) + 1);
    for (let k = visible.length - 1; k >= 0; k--) {
      const n = visible[k];
      const z = (n.time - st.now) / st.approach;
      if (n.lane === 0 && n.pair >= 0 && pairs.get(n.pair) === 2 && z > 0) {
        const a = this.project(0, z);
        const b = this.project(1, z);
        ctx.strokeStyle = `rgba(255,228,92,${clamp((1.2 - z) / 0.3, 0, 1) * 0.85})`;
        ctx.lineWidth = Math.max(2, 8 * a.s);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    for (let k = visible.length - 1; k >= 0; k--) {
      const n = visible[k];
      const z = (n.time - st.now) / st.approach;
      let alpha = clamp((1.2 - z) / 0.3, 0, 1);
      if (z < 0) alpha *= clamp(1 + z * 6, 0, 1);
      if (n.judged) alpha *= 0.35; // 놓친 노트는 흐리게 지나감
      if (alpha <= 0) continue;
      const p = this.project(n.lane, z);
      this._drawCoin(n.lane, p.x, p.y, L.headRx * 0.9 * p.s, alpha);
    }
  }

  _drawCoin(lane, x, y, rx, alpha) {
    const ctx = this.ctx;
    const col = LANE[lane];
    const ry = rx * 0.4;
    const th = rx * 0.17;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 옆면
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.ellipse(x, y + th, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - rx, y, rx * 2, th);
    // 윗면
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, col.light);
    g.addColorStop(1, col.main);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,29,58,0.9)';
    ctx.lineWidth = Math.max(1, rx * 0.045);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, rx * 0.03);
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.8, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 글자
    if (rx > 7) {
      ctx.translate(x, y + ry * 0.05);
      ctx.scale(1, 0.55);
      ctx.fillStyle = col.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(rx * 0.95)}px ${FONT}`;
      ctx.fillText(lane === 0 ? '쿵' : '짝', 0, rx * 0.04);
    }
    ctx.restore();
  }

  _drawDrum(i, st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const img = this.rasters.drum[LANE[i].key];
    const t = rt - this.drumHit[i];
    const shake = t < 0.25 ? Math.exp(-t * 22) * L.GW * 0.012 : 0;
    const x = L.laneX[i] - L.drumW / 2;
    const y = L.hitY - DRUM_VIEW.cy * L.drumScale + shake;
    // 판정 타겟 링 (박자에 맞춰 숨쉬기)
    const beatPhase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const pulse = Math.pow(1 - beatPhase, 4);
    ctx.save();
    ctx.strokeStyle = `rgba(${LANE[i].rgb},${0.35 + 0.4 * pulse})`;
    ctx.lineWidth = 3 + 3 * pulse;
    ctx.beginPath();
    ctx.ellipse(L.laneX[i], L.hitY + shake, L.headRx * (1.1 + 0.03 * pulse), L.headRy * (1.18 + 0.05 * pulse), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(img, x, y, L.drumW, L.drumW * (DRUM_VIEW.h / DRUM_VIEW.w));
    // 헤드 번쩍
    if (t < 0.2) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - t / 0.2)})`;
      ctx.beginPath();
      ctx.ellipse(L.laneX[i], L.hitY + shake, L.headRx * 0.95, L.headRy * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRipples(i, rt) {
    const ctx = this.ctx;
    const L = this.L;
    this.fx.ripples = this.fx.ripples.filter((r) => rt - r.t0 < 0.4);
    for (const r of this.fx.ripples) {
      if (r.lane !== i) continue;
      const p = (rt - r.t0) / 0.4;
      const e = easeOut(p);
      const sc = 1 + e * (r.big ? 0.75 : 0.5);
      ctx.strokeStyle = `rgba(${r.color},${1 - p})`;
      ctx.lineWidth = (r.big ? 7 : 5) * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(L.laneX[i], L.hitY, L.headRx * sc, L.headRy * sc * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawMascot(i, st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const set = this.rasters[LANE[i].key];
    const th = rt - this.mascotHit[i];
    const tm = rt - this.mascotMiss[i];
    let img = set.idle;
    if (th < 0.16) img = set.hit;
    else if (tm < 0.45) img = set.miss;
    else if (rt < this.cheerUntil || st.finished) img = set.cheer;
    // 박자 끄덕임 + 눌림(스프링)
    const beatPhase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const bob = st.playing ? Math.pow(1 - beatPhase, 3) * 0.05 : 0;
    const spring = th < 0.6 ? Math.exp(-th * 14) * Math.cos(th * 34) : 0;
    const sy = 1 - bob - spring * 0.26;
    const sx = 1 + bob * 0.6 + spring * 0.18;
    const w = L.mascotW;
    const baseY = L.hitY + L.headRy * 0.35;
    const dw = w * sx;
    const dh = w * sy;
    // 그림자
    ctx.fillStyle = 'rgba(40,20,40,0.22)';
    ctx.beginPath();
    ctx.ellipse(L.laneX[i], baseY - w * 0.03, w * 0.42 * sx, L.headRy * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, L.laneX[i] - dw / 2, baseY - dh * 0.95, dw, dh);
  }

  _drawCombo(st, rt) {
    if (st.combo < 3) return;
    const ctx = this.ctx;
    const L = this.L;
    const p = clamp((rt - this.comboPopAt) / 0.15, 0, 1);
    const sc = 1 + (1 - easeOut(p)) * 0.25;
    const y = L.horizonY + (L.hitY - L.horizonY) * 0.3;
    const size = L.GW * 0.15 * sc;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = '#2B1D3A';
    ctx.strokeText(String(st.combo), L.cx, y);
    ctx.fillStyle = st.combo >= 50 ? '#FFE45C' : '#FFFFFF';
    ctx.fillText(String(st.combo), L.cx, y);
    ctx.font = `${Math.round(L.GW * 0.04)}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,248,236,0.75)';
    ctx.fillText('COMBO', L.cx, y + size * 0.62);
    ctx.restore();
  }

  _drawCountIn(st) {
    if (!st.countIn) return;
    const { label, phase } = st.countIn;
    const ctx = this.ctx;
    const L = this.L;
    const a = 1 - phase;
    const sc = 1 + (1 - easeOut(Math.min(1, phase * 4))) * 0.4;
    const size = L.GW * (label.length > 1 ? 0.16 : 0.26) * sc;
    ctx.save();
    ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = '#2B1D3A';
    const y = L.horizonY + (L.hitY - L.horizonY) * 0.33;
    ctx.strokeText(label, L.cx, y);
    ctx.fillStyle = '#FFE45C';
    ctx.fillText(label, L.cx, y);
    ctx.restore();
  }

  _drawFx(rt) {
    const ctx = this.ctx;
    const L = this.L;
    const fx = this.fx;
    // 파티클
    fx.particles = fx.particles.filter((p) => rt - p.t0 < p.life);
    for (const p of fx.particles) {
      const t = rt - p.t0;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * L.GW * 2.4 * t * t;
      const a = 1 - t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.star) {
        const r = p.r * 1.6;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 ? r * 0.4 : r;
          const ang = (k * Math.PI) / 4 + t * 6;
          ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 큰 "쿵!" "짝!"
    fx.pops = fx.pops.filter((p) => rt - p.t0 < 0.55);
    for (const p of fx.pops) {
      const t = (rt - p.t0) / 0.55;
      const sc = t < 0.15 ? 1.5 - easeOut(t / 0.15) * 0.5 : 1;
      const a = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y - t * L.GW * 0.05);
      ctx.rotate(p.rot);
      ctx.scale(sc, sc);
      ctx.font = `${Math.round(p.size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = p.size * 0.16;
      ctx.strokeStyle = '#2B1D3A';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.size * 0.03, p.size * 0.04);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    // 판정 글자 (레인별 최신 것만)
    fx.judges = fx.judges.filter((j) => rt - j.t0 < 0.5);
    const latest = [null, null];
    for (const j of fx.judges) latest[j.lane] = j;
    for (const j of latest) {
      if (!j) continue;
      const t = (rt - j.t0) / 0.5;
      const sc = t < 0.12 ? 1.3 - (t / 0.12) * 0.3 : 1;
      const x = L.laneX[j.lane];
      const y = L.hitY - L.mascotW * 1.42 - t * 8;
      const size = L.GW * 0.058 * sc;
      ctx.save();
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = '#1A1230';
      ctx.strokeText(j.text, x, y);
      ctx.fillStyle = j.color;
      ctx.fillText(j.text, x, y);
      if (j.sub) {
        ctx.font = `${Math.round(size * 0.55)}px ${FONT}`;
        ctx.lineWidth = size * 0.12;
        ctx.strokeText(j.sub, x, y + size * 0.85);
        ctx.fillStyle = j.sub === 'FAST' ? '#9CC8FF' : '#FFB08A';
        ctx.fillText(j.sub, x, y + size * 0.85);
      }
      ctx.restore();
    }

    // 콤보 배너
    fx.banners = fx.banners.filter((b) => rt - b.t0 < 1.1);
    for (const b of fx.banners) {
      const t = (rt - b.t0) / 1.1;
      const size = L.GW * 0.1;
      const slide = t < 0.2 ? (1 - easeOut(t / 0.2)) * L.GW : t > 0.8 ? -easeOut((t - 0.8) / 0.2) * L.GW : 0;
      const y = L.horizonY + (L.hitY - L.horizonY) * 0.55;
      ctx.save();
      ctx.translate(L.cx + slide, y);
      ctx.rotate(-0.06);
      ctx.fillStyle = 'rgba(255,216,77,0.95)';
      const w = L.GW * 0.8;
      const h = size * 1.35;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, h / 2) : ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2B1D3A';
      ctx.fillText(b.text, 0, size * 0.04);
      ctx.restore();
    }
  }
}
