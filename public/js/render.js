// 게임 화면 그리기 (Canvas 2D)
// 콘셉트: 낮 하늘 정원. 구름에서 콩이 떨어지고, 드럼 옆에 선 쿵콩이·짝콩이가 스틱으로 쳐서 콩을 튕겨냄.

import { buildRasters, DRUM_VIEW, DRUMS } from './mascot.js';

export const LANE = [
  { key: 'kong', bean: '#FF9466', beanLight: '#FFD2B5', beanDark: '#D8643A', rgb: '255,148,102', thumb: '왼쪽 엄지', word: '쿵' },
  { key: 'jjak', bean: '#5DBBFF', beanLight: '#C6E9FF', beanDark: '#2F86CF', rgb: '93,187,255', thumb: '오른쪽 엄지', word: '짝' },
];

export const JUDGE_STYLE = {
  perfect: { text: '완벽!', color: '#FF7A3D' },
  great: { text: '좋아!', color: '#25B865' },
  good: { text: '괜찮아', color: '#3D8BFF' },
  miss: { text: '앗!', color: '#9A94AE' },
};

const INK = '#3B2A4A';
const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bg = document.createElement('canvas');
    this.rasters = null;
    this.studio = null; // 영상 찍기 모드: { top, bottom, label }
    this.reset();
  }

  reset() {
    this.fx = { judges: [], particles: [], bouncers: [], banners: [], ripples: [] };
    this.hitAt = [-9, -9];
    this.missAt = [-9, -9];
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
      topY: H * (studio ? 0.27 : 0.19),
      hitY: H * 0.7,
      laneX: [GX + GW * 0.37, GX + GW * 0.63],
      laneHalf: GW * 0.105,
      headRx: GW * 0.125,
      beanW: GW * 0.145,
      mascotW: GW * 0.27,
      mascotX: [GX + GW * 0.135, GX + GW * 0.865],
    };
    L.drumScale = L.headRx / DRUM_VIEW.rx;
    L.headRy = DRUM_VIEW.ry * L.drumScale;
    L.drumW = DRUM_VIEW.w * L.drumScale;
    L.groundY = L.hitY + (DRUMS.kong.height + DRUM_VIEW.ry * 0.6) * L.drumScale;
    L.mascotBase = [0, 1].map((i) => L.hitY + (DRUMS[LANE[i].key].height + DRUM_VIEW.ry * 0.9) * L.drumScale);
    this.L = L;
    const key = `${Math.round(L.mascotW * dpr)}x${Math.round(L.drumW * dpr)}`;
    if (this._rasterKey !== key) {
      this.rasters = await buildRasters(Math.round(L.mascotW * dpr), Math.round(L.drumW * dpr));
      this._rasterKey = key;
    }
    this._sticks();
    this._drawStatic();
  }

  /** 스틱 기준점(손)과 내려칠 각도 계산 */
  _sticks() {
    const L = this.L;
    this.stick = [0, 1].map((i) => {
      const w = L.mascotW;
      const top = L.mascotBase[i] - w * 0.945;
      const handX = i === 0 ? 168 : 32;
      const px = L.mascotX[i] - w / 2 + (handX / 200) * w;
      const py = top + (166 / 200) * w;
      const tx = L.laneX[i] + (i === 0 ? -1 : 1) * L.headRx * 0.15;
      const ty = L.hitY - L.headRy * 0.15;
      const hit = Math.atan2(ty - py, tx - px);
      const dir = i === 0 ? 1 : -1;
      const dist = Math.hypot(tx - px, ty - py);
      return { px, py, hit, rest: hit - 0.7 * dir, len: (dist * 120) / 92 };
    });
  }

  _cloud(g, x, y, s, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.ellipse(x, y, s * 0.9, s * 0.42, 0, 0, Math.PI * 2);
    g.ellipse(x - s * 0.45, y + s * 0.05, s * 0.45, s * 0.33, 0, 0, Math.PI * 2);
    g.ellipse(x + s * 0.5, y + s * 0.06, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
    g.ellipse(x - s * 0.1, y - s * 0.25, s * 0.45, s * 0.38, 0, 0, Math.PI * 2);
    g.ellipse(x + s * 0.28, y - s * 0.18, s * 0.33, s * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  _drawStatic() {
    const L = this.L;
    const c = this.bg;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    // 하늘
    const sky = g.createLinearGradient(0, 0, 0, L.H);
    sky.addColorStop(0, '#8FD3FF');
    sky.addColorStop(0.45, '#CDEEFF');
    sky.addColorStop(0.72, '#FFF4DA');
    g.fillStyle = sky;
    g.fillRect(0, 0, L.W, L.H);
    // 해
    const sx = L.GX + L.GW * 0.9;
    const sy = L.H * 0.06;
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, L.GW * 0.32);
    sun.addColorStop(0, 'rgba(255,240,170,0.95)');
    sun.addColorStop(0.3, 'rgba(255,230,150,0.5)');
    sun.addColorStop(1, 'rgba(255,230,150,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, L.W, L.H * 0.4);
    // 먼 언덕
    g.fillStyle = '#BFE7A2';
    g.beginPath();
    g.moveTo(0, L.groundY - L.GW * 0.06);
    for (let x = 0; x <= L.W; x += 10) g.lineTo(x, L.groundY - L.GW * 0.08 - Math.sin(x / (L.GW * 0.22)) * L.GW * 0.035);
    g.lineTo(L.W, L.H);
    g.lineTo(0, L.H);
    g.fill();
    // 앞 잔디
    const grass = g.createLinearGradient(0, L.groundY, 0, L.H);
    grass.addColorStop(0, '#8ED46B');
    grass.addColorStop(1, '#6DBA55');
    g.fillStyle = grass;
    g.beginPath();
    g.moveTo(0, L.groundY);
    for (let x = 0; x <= L.W; x += 8) g.lineTo(x, L.groundY - Math.sin(x / (L.GW * 0.09)) * L.GW * 0.008);
    g.lineTo(L.W, L.H);
    g.lineTo(0, L.H);
    g.fill();
    // 꽃
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * L.W;
      const y = L.groundY + L.GW * 0.03 + rnd() * (L.H - L.groundY - L.GW * 0.04);
      const r = L.GW * (0.006 + rnd() * 0.006);
      g.fillStyle = ['#FFFFFF', '#FFE27A', '#FFB3C7'][i % 3];
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(x + Math.cos((k * Math.PI * 2) / 5) * r, y + Math.sin((k * Math.PI * 2) / 5) * r, r * 0.8, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#FFB547';
      g.beginPath();
      g.arc(x, y, r * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    // 콩이 떨어지는 길 (반투명 유리관)
    [0, 1].forEach((i) => {
      const x = L.laneX[i] - L.laneHalf;
      const w = L.laneHalf * 2;
      const y = L.topY;
      const h = L.hitY - L.topY;
      const lg = g.createLinearGradient(0, y, 0, y + h);
      lg.addColorStop(0, 'rgba(255,255,255,0.15)');
      lg.addColorStop(1, `rgba(${LANE[i].rgb},0.28)`);
      g.fillStyle = lg;
      g.beginPath();
      g.roundRect ? g.roundRect(x, y, w, h, w / 2) : g.rect(x, y, w, h);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 2.5;
      g.stroke();
      g.setLineDash([3, 9]);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(L.laneX[i], y + w * 0.6);
      g.lineTo(L.laneX[i], y + h - L.headRy * 1.2);
      g.stroke();
      g.setLineDash([]);
      // 구름(콩이 나오는 곳)
      this._cloud(g, L.laneX[i], L.topY + L.GW * 0.005, L.GW * 0.14);
    });
  }

  // ---------- 이벤트 ----------
  onTap(lane, rt) {
    this.hitAt[lane] = rt;
  }

  onJudge(lane, judge, rt, early) {
    const L = this.L;
    const style = JUDGE_STYLE[judge];
    this.fx.judges.push({ lane, text: style.text, color: style.color, t0: rt, sub: judge === 'perfect' || judge === 'miss' ? '' : early ? '빨라' : '늦어' });
    if (judge === 'miss') {
      this.missAt[lane] = rt;
      return;
    }
    const x = L.laneX[lane];
    const out = lane === 0 ? 1 : -1; // 콩은 화면 바깥쪽 반대로(가운데로) 튕김
    const power = judge === 'perfect' ? 1 : judge === 'great' ? 0.8 : 0.6;
    this.fx.bouncers.push({
      lane,
      x,
      y: L.hitY - L.headRy * 0.4,
      vx: out * L.GW * (0.25 + Math.random() * 0.25),
      vy: -L.GW * (1.5 + Math.random() * 0.4) * power,
      spin: (Math.random() - 0.5) * 14,
      t0: rt,
    });
    this.fx.ripples.push({ lane, t0: rt, big: judge === 'perfect' });
    const n = judge === 'perfect' ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const sp = L.GW * (0.35 + Math.random() * 0.7);
      const kind = Math.random();
      this.fx.particles.push({
        x: x + (Math.random() - 0.5) * L.headRx,
        y: L.hitY,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t0: rt,
        life: 0.5 + Math.random() * 0.4,
        r: L.GW * (0.012 + Math.random() * 0.01),
        rot: Math.random() * 6,
        kind: kind < 0.45 ? 'leaf' : kind < 0.75 ? 'note' : 'star',
        color: kind < 0.45 ? (Math.random() < 0.5 ? '#7BD66A' : '#A8E58F') : kind < 0.75 ? LANE[lane].beanDark : '#FFD447',
      });
    }
  }

  onCombo(combo, rt) {
    this.comboPopAt = rt;
    if (combo > 0 && combo % 25 === 0) {
      this.fx.banners.push({ text: `${combo} 콤보!`, t0: rt });
      this.cheerUntil = rt + 0.9;
    }
  }

  // ---------- 그리기 ----------
  draw(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    if (!L) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

    this._drawDriftClouds(rt);
    this._drawBeatDots(st);
    [0, 1].forEach((i) => this._drawDrum(i, st, rt));
    [0, 1].forEach((i) => this._drawTarget(i, st, rt));
    this._drawNotes(st, rt);
    [0, 1].forEach((i) => this._drawMascot(i, st, rt));
    this._drawFx(rt);
    this._drawCombo(st, rt);
    this._drawCountIn(st);
    if (this.studio) this._drawStudio(st);
  }

  _drawDriftClouds(rt) {
    const L = this.L;
    const span = L.W + L.GW * 0.6;
    [[0.08, 0.16, 0.12, 9], [0.22, 0.1, 0.09, 14], [0.42, 0.13, 0.08, 11]].forEach(([y, s, a, sp], k) => {
      const x = ((rt * L.GW * (0.01 * sp) + k * span * 0.37) % span) - L.GW * 0.3;
      this._cloud(this.ctx, x, L.H * y + (L.studio ? L.H * 0.05 : 0), L.GW * s, 0.55 + a);
    });
  }

  _yAt(dt, approach) {
    const L = this.L;
    return L.hitY - (dt / approach) * (L.hitY - L.topY);
  }

  _drawBeatDots(st) {
    const ctx = this.ctx;
    const L = this.L;
    if (!st.beatDur) return;
    const first = Math.ceil(st.now / st.beatDur);
    for (let b = first; ; b++) {
      const dt = b * st.beatDur - st.now;
      if (dt > st.approach) break;
      const y = this._yAt(dt, st.approach);
      const bar = b % 4 === 0;
      for (const i of [0, 1]) {
        ctx.fillStyle = bar ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
        const r = bar ? 3.2 : 2;
        ctx.beginPath();
        ctx.arc(L.laneX[i] - L.laneHalf * 0.78, y, r, 0, Math.PI * 2);
        ctx.arc(L.laneX[i] + L.laneHalf * 0.78, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** 콩 한 알 */
  _bean(x, y, w, lane, rot, alpha = 1, grey = false) {
    const ctx = this.ctx;
    const c = LANE[lane];
    const rx = w / 2;
    const ry = w * 0.36;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    // 강낭콩 모양: 아래쪽이 살짝 들어간 타원
    const path = new Path2D();
    path.moveTo(-rx, 0);
    path.bezierCurveTo(-rx, -ry * 1.35, rx, -ry * 1.35, rx, 0);
    path.bezierCurveTo(rx, ry * 1.1, rx * 0.35, ry * 1.05, 0, ry * 0.62);
    path.bezierCurveTo(-rx * 0.35, ry * 1.05, -rx, ry * 1.1, -rx, 0);
    path.closePath();
    const gr = ctx.createLinearGradient(0, -ry, 0, ry);
    gr.addColorStop(0, grey ? '#E4E1EA' : c.beanLight);
    gr.addColorStop(1, grey ? '#B9B4C4' : c.bean);
    ctx.fillStyle = gr;
    ctx.fill(path);
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    // 배꼽 + 반짝
    ctx.strokeStyle = grey ? '#9F99AE' : c.beanDark;
    ctx.lineWidth = Math.max(1.5, w * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx * 0.12, ry * 0.42);
    ctx.quadraticCurveTo(0, ry * 0.2, rx * 0.12, ry * 0.42);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.45, rx * 0.22, ry * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawNotes(st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const visible = [];
    for (const n of st.notes) {
      const dt = n.time - st.now;
      if (dt > st.approach) break;
      if (n.judged && n.result !== 'miss') continue;
      if (dt < -0.3) continue;
      visible.push(n);
    }
    // 동시치기: 덩굴로 연결
    const pairs = new Map();
    for (const n of visible) if (n.pair >= 0 && !n.judged) (pairs.get(n.pair) || pairs.set(n.pair, []).get(n.pair)).push(n);
    for (const [, ps] of pairs) {
      if (ps.length !== 2) continue;
      const y = this._yAt(ps[0].time - st.now, st.approach);
      if (y > L.hitY) continue;
      ctx.strokeStyle = '#5DBB4A';
      ctx.lineWidth = Math.max(3, L.GW * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(L.laneX[0], y);
      ctx.quadraticCurveTo(L.cx, y + L.GW * 0.04, L.laneX[1], y);
      ctx.stroke();
      ctx.fillStyle = '#7BD66A';
      ctx.beginPath();
      ctx.ellipse(L.cx, y + L.GW * 0.02, L.GW * 0.022, L.GW * 0.011, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = visible.length - 1; k >= 0; k--) {
      const n = visible[k];
      const dt = n.time - st.now;
      const y = this._yAt(dt, st.approach);
      const p = dt / st.approach;
      let alpha = clamp((1 - p) / 0.08, 0, 1);
      const grey = n.judged; // 놓친 콩
      if (dt < 0) alpha *= clamp(1 + dt * 4, 0, 1);
      const scale = 0.75 + 0.25 * clamp(1 - p, 0, 1);
      const wob = Math.sin(rt * 4 + n.id * 1.7) * 0.18;
      this._bean(L.laneX[n.lane], y, L.beanW * scale, n.lane, wob, alpha * (grey ? 0.6 : 1), grey);
    }
  }

  _drawDrum(i, st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const img = this.rasters.drum[LANE[i].key];
    const t = rt - this.hitAt[i];
    const squash = t < 0.3 ? Math.exp(-t * 18) * 0.06 : 0;
    const w = L.drumW * (1 + squash);
    const h = L.drumW * (DRUM_VIEW.h / DRUM_VIEW.w) * (1 - squash);
    ctx.drawImage(img, L.laneX[i] - w / 2, L.hitY - DRUM_VIEW.cy * L.drumScale * (1 - squash) + squash * L.headRy, w, h);
    if (t < 0.18) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - t / 0.18)})`;
      ctx.beginPath();
      ctx.ellipse(L.laneX[i], L.hitY + squash * L.headRy, L.headRx * 0.9, L.headRy * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawTarget(i, st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const pulse = Math.pow(1 - phase, 3);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -rt * 20;
    ctx.strokeStyle = `rgba(${LANE[i].rgb},${0.55 + 0.4 * pulse})`;
    ctx.lineWidth = 3 + 2 * pulse;
    ctx.beginPath();
    ctx.ellipse(L.laneX[i], L.hitY - L.headRy * 0.4, L.beanW * 0.62 * (1 + 0.08 * pulse), L.beanW * 0.3 * (1 + 0.08 * pulse), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // 퍼지는 링
    this.fx.ripples = this.fx.ripples.filter((r) => rt - r.t0 < 0.4);
    for (const r of this.fx.ripples) {
      if (r.lane !== i) continue;
      const p = (rt - r.t0) / 0.4;
      const sc = 1 + easeOut(p) * (r.big ? 0.9 : 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
      ctx.lineWidth = (r.big ? 6 : 4) * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(L.laneX[i], L.hitY, L.headRx * sc, L.headRy * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawMascot(i, st, rt) {
    const ctx = this.ctx;
    const L = this.L;
    const set = this.rasters[LANE[i].key];
    const th = rt - this.hitAt[i];
    const tm = rt - this.missAt[i];
    let img = set.idle;
    if (th < 0.18) img = set.hit;
    else if (tm < 0.45) img = set.miss;
    else if (rt < this.cheerUntil || st.finished) img = set.cheer;

    const phase = st.beatDur ? ((st.now / st.beatDur) % 1 + 1) % 1 : 0;
    const bob = st.playing ? Math.pow(1 - phase, 3) : 0;
    const spring = th < 0.6 ? Math.exp(-th * 12) * Math.cos(th * 28) : 0;
    const sy = 1 - bob * 0.04 - spring * 0.12;
    const sx = 1 + bob * 0.025 + spring * 0.08;
    const w = L.mascotW;
    const base = L.mascotBase[i];
    // 그림자
    ctx.fillStyle = 'rgba(59,42,74,0.18)';
    ctx.beginPath();
    ctx.ellipse(L.mascotX[i], base - w * 0.02, w * 0.4, w * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    const dw = w * sx;
    const dh = w * sy;
    ctx.drawImage(img, L.mascotX[i] - dw / 2, base - dh * 0.945, dw, dh);
    // 스틱 (앞발로 쥐고 드럼을 침)
    const s = this.stick[i];
    let p;
    if (th < 0.05) p = th / 0.05;
    else if (th < 0.3) p = 1 - easeOut((th - 0.05) / 0.25);
    else p = 0;
    const idle = st.playing ? -bob * 0.12 * (i === 0 ? 1 : -1) : Math.sin(rt * 2 + i) * 0.06;
    const ang = s.rest + (s.hit - s.rest) * p + (p === 0 ? idle : 0);
    const stick = this.rasters.stick;
    const sh = (s.len * 24 * 1.25) / 120;
    ctx.save();
    ctx.translate(s.px, s.py - spring * w * 0.05);
    ctx.rotate(ang);
    ctx.drawImage(stick, -(s.len * 14) / 120, -sh / 2, s.len, sh);
    ctx.restore();

  }

  _drawCombo(st, rt) {
    if (st.combo < 3) return;
    const ctx = this.ctx;
    const L = this.L;
    const p = clamp((rt - this.comboPopAt) / 0.15, 0, 1);
    const sc = 1 + (1 - easeOut(p)) * 0.2;
    const y = L.studio ? L.H * 0.4 : L.H * 0.4;
    const size = L.GW * 0.11 * sc;
    const x = L.GX + L.GW * 0.135;
    const x2 = L.GX + L.GW * 0.865;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // 왼쪽 하늘에 콤보, 오른쪽엔 콤보 라벨 대신 박자 별
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(String(st.combo), x, y);
    ctx.fillStyle = st.combo >= 50 ? '#FF7A3D' : INK;
    ctx.fillText(String(st.combo), x, y);
    ctx.font = `${Math.round(L.GW * 0.036)}px ${FONT}`;
    ctx.lineWidth = L.GW * 0.012;
    ctx.strokeText('콤보', x, y + size * 0.7);
    ctx.fillStyle = INK;
    ctx.fillText('콤보', x, y + size * 0.7);
    // 오른쪽: 콤보 배율 게이지 (콩이 쌓임)
    const filled = Math.min(5, Math.floor(st.combo / 10));
    for (let k = 0; k < 5; k++) {
      const by = y + size * 0.5 - k * L.GW * 0.045;
      if (k < filled) this._bean(x2, by, L.GW * 0.06, k % 2, 0.1 * (k % 2 ? 1 : -1));
      else {
        ctx.strokeStyle = 'rgba(59,42,74,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x2, by, L.GW * 0.03, L.GW * 0.018, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawCountIn(st) {
    if (!st.countIn) return;
    const ctx = this.ctx;
    const L = this.L;
    const { label, phase, fade } = st.countIn;
    ctx.save();
    // 엄지 안내 (카운트인 동안)
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    [0, 1].forEach((i) => {
      const fs = L.GW * 0.04;
      ctx.font = `${Math.round(fs)}px ${FONT}`;
      const text = `${LANE[i].thumb} · ${LANE[i].word}`;
      const tw = ctx.measureText(text).width + fs * 1.2;
      const ax = L.mascotX[i];
      const x = clamp(ax, L.GX + tw / 2 + 6, L.GX + L.GW - tw / 2 - 6);
      const y = L.mascotBase[i] - L.mascotW * 1.15;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - tw / 2, y - fs * 0.9, tw, fs * 1.8, fs * 0.9) : ctx.rect(x - tw / 2, y - fs * 0.9, tw, fs * 1.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ax - fs * 0.4, y + fs * 0.85);
      ctx.lineTo(ax + fs * 0.4, y + fs * 0.85);
      ctx.lineTo(ax, y + fs * 1.35);
      ctx.fill();
      ctx.fillStyle = LANE[i].beanDark;
      ctx.fillText(text, x, y + fs * 0.05);
    });
    // 숫자
    const a = 1 - phase;
    const sc = 1 + (1 - easeOut(Math.min(1, phase * 4))) * 0.35;
    const size = L.GW * (label.length > 1 ? 0.13 : 0.22) * sc;
    ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = '#FFFFFF';
    const y = L.topY + (L.hitY - L.topY) * 0.38;
    ctx.strokeText(label, L.cx, y);
    ctx.fillStyle = '#FF7A3D';
    ctx.fillText(label, L.cx, y);
    ctx.restore();
  }

  _drawStudio(st) {
    const ctx = this.ctx;
    const L = this.L;
    const s = this.studio;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 상단 자막 카드
    const cw = L.GW * 0.9;
    const ch = L.H * 0.12;
    const cx = L.cx - cw / 2;
    const cy = L.H * 0.035;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx, cy, cw, ch, L.GW * 0.05) : ctx.rect(cx, cy, cw, ch);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const fs = fitFont(ctx, s.top, cw * 0.9, L.GW * 0.075);
    ctx.font = `${fs}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(s.top, L.cx, cy + ch * 0.38);
    ctx.font = `${Math.round(L.GW * 0.042)}px ${FONT}`;
    ctx.fillStyle = '#25A35A';
    ctx.fillText(s.label, L.cx, cy + ch * 0.76);
    // 점수 + 하단 문구
    ctx.font = `${Math.round(L.GW * 0.05)}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = L.GW * 0.016;
    ctx.strokeStyle = '#FFFFFF';
    const scoreText = `${(st.score || 0).toLocaleString('ko-KR')}점`;
    ctx.strokeText(scoreText, L.cx, cy + ch + L.H * 0.03);
    ctx.fillStyle = INK;
    ctx.fillText(scoreText, L.cx, cy + ch + L.H * 0.03);
    if (s.bottom) {
      const bfs = fitFont(ctx, s.bottom, L.GW * 0.85, L.GW * 0.048);
      ctx.font = `${bfs}px ${FONT}`;
      const tw = ctx.measureText(s.bottom).width + bfs * 1.4;
      const by = L.groundY + (L.H - L.groundY) * 0.42;
      ctx.fillStyle = '#FF7A3D';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(L.cx - tw / 2, by - bfs, tw, bfs * 2, bfs) : ctx.rect(L.cx - tw / 2, by - bfs, tw, bfs * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(s.bottom, L.cx, by + bfs * 0.05);
    }
    ctx.restore();
  }

  _drawFx(rt) {
    const ctx = this.ctx;
    const L = this.L;
    const fx = this.fx;
    const grav = L.GW * 4.2;
    // 튕겨나가는 콩
    fx.bouncers = fx.bouncers.filter((b) => rt - b.t0 < 0.75);
    for (const b of fx.bouncers) {
      const t = rt - b.t0;
      const x = b.x + b.vx * t;
      const y = b.y + b.vy * t + 0.5 * grav * t * t;
      this._bean(x, y, L.beanW * (1 - t * 0.3), b.lane, b.spin * t, t < 0.45 ? 1 : 1 - (t - 0.45) / 0.3);
    }
    // 파티클
    fx.particles = fx.particles.filter((p) => rt - p.t0 < p.life);
    for (const p of fx.particles) {
      const t = rt - p.t0;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * grav * 0.6 * t * t;
      ctx.save();
      ctx.globalAlpha = 1 - t / p.life;
      ctx.translate(x, y);
      ctx.rotate(p.rot + t * 5);
      ctx.fillStyle = p.color;
      if (p.kind === 'leaf') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.3, p.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'note') {
        ctx.rotate(-(p.rot + t * 5));
        ctx.font = `${Math.round(p.r * 3)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♪', 0, 0);
      } else {
        const r = p.r * 1.4;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? r * 0.45 : r;
          const a = (k * Math.PI) / 5;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // 판정 글자 (레인별 최신)
    fx.judges = fx.judges.filter((j) => rt - j.t0 < 0.5);
    const latest = [null, null];
    for (const j of fx.judges) latest[j.lane] = j;
    for (const j of latest) {
      if (!j) continue;
      const t = (rt - j.t0) / 0.5;
      const sc = t < 0.12 ? 1.35 - (t / 0.12) * 0.35 : 1;
      const x = L.laneX[j.lane];
      const y = L.hitY - L.GW * 0.2 - t * L.GW * 0.03;
      const size = L.GW * 0.062 * sc;
      ctx.save();
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.24;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(j.text, x, y);
      ctx.fillStyle = j.color;
      ctx.fillText(j.text, x, y);
      if (j.sub) {
        ctx.font = `${Math.round(size * 0.55)}px ${FONT}`;
        ctx.lineWidth = size * 0.14;
        ctx.strokeText(j.sub, x, y + size * 0.85);
        ctx.fillStyle = INK;
        ctx.fillText(j.sub, x, y + size * 0.85);
      }
      ctx.restore();
    }
    // 콤보 배너 (잎사귀 리본)
    fx.banners = fx.banners.filter((b) => rt - b.t0 < 1.1);
    for (const b of fx.banners) {
      const t = (rt - b.t0) / 1.1;
      const size = L.GW * 0.085;
      const pop = t < 0.15 ? easeOut(t / 0.15) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
      const y = L.topY + (L.hitY - L.topY) * 0.5;
      ctx.save();
      ctx.translate(L.cx, y);
      ctx.scale(pop, pop);
      ctx.rotate(-0.05);
      const w = L.GW * 0.62;
      const h = size * 1.5;
      ctx.fillStyle = '#5DBB4A';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(-w / 2 + h * 0.3, -h / 2, -w / 2 + h, -h / 2);
      ctx.lineTo(w / 2 - h, -h / 2);
      ctx.quadraticCurveTo(w / 2 - h * 0.3, -h / 2, w / 2, 0);
      ctx.quadraticCurveTo(w / 2 - h * 0.3, h / 2, w / 2 - h, h / 2);
      ctx.lineTo(-w / 2 + h, h / 2);
      ctx.quadraticCurveTo(-w / 2 + h * 0.3, h / 2, -w / 2, 0);
      ctx.fill();
      ctx.stroke();
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(b.text, 0, size * 0.05);
      ctx.restore();
    }
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
