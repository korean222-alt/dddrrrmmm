// 🎹 시즌 2 피아노 타일 게임 — 2026-11-26 밤 피아노 타일처럼 다시 (사용자 '디테일은 전부 피아노 타일을 따라 해')
//   · 화면 = 줄 TILE_ROWS(4)개. 보통 타일 높이 = 화면 높이 / 4 로 모든 곡·유저 맵이 같음 (곡마다 바꾸지 말 것)
//   · 맨 아래 「시작」 타일을 누르면 내려오기 시작 (대결은 서버가 정한 시각에 같이)
//   · 다음 칠 타일(가장 아래)이 보이기만 하면 언제 눌러도 됨 — 판정 글자 없음. 타일을 누르면 그 음이 남(반주가 따로 흐르지 않음)
//     친 타일은 옅은 회색으로, 놓친 타일·빈 칸 누름은 빨갛게 (하트 하나, 바퀴를 돌면 하나 회복, 0 이면 끝)
//   · 긴 타일(꾹): 누른 채로 있으면 손가락 자리까지 파랗게 차오르고, 끝까지 누르면 +줄 수
//   · 첫 바퀴: 별 3개가 1/3·2/3·끝에 차오름 → 둘째 바퀴(빨라짐): 빈 다이아 3개가 똑같이 차오름 → 그 뒤로도 바퀴마다 빨라짐
//   🧈 부드럽게 (11-26 '누를 때 끊기는 느낌'): 소리 시계를 안 따라감 — 화면은 performance.now 로만 흐름(반주가 없어서 맞출 소리가 없음),
//     매 화면 새 배열·그라데이션을 안 만듦(배경·타일은 크기가 바뀔 때 한 번 그려 둠)
//   🖐 터치 (CLAUDE.md 터치 씹힘 1~4차): touchstart + pointerdown(같은 자리 80ms 안 한 번만), touchmove 로는 새 터치를 안 만듦,
//     방금 친 줄을 0.12초 안에 또 누른 튕김은 무시, 하트를 잃은 뒤 0.35초는 빈 칸 누름으로 또 깎지 않음
//   🎨 스킨(상점): skin.palette(콩 스킨 색) → 타일 색, skin.bg(무대 그림·하늘색) → 배경
//   ⚔️ 대결(vs): 상대 점수 막대, maxLaps 바퀴(기본 3)에서 끝

import { STEPS_PER_BAR } from './charts.js';
import { tileLap, lapTempo, lapMirrors, lapStars, MAX_LAPS, TILE_HEARTS, TILE_ROWS, GONE_ROWS } from './tiles.js';

const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 원근 보기 줄 색 (왼쪽부터 하늘·파랑·보라·분홍) */
const ROAD_HUE = [188, 222, 270, 318];
const BOUNCE_SEC = 0.12;
const GRACE_SEC = 0.35;
/** 원근 보기에서 보이는 줄 수 */
const ROAD_VB = 4.6;
const HOLD_BLUE = '#5ec8ff';

export class TileGame {
  /**
   * @param {{ audio, canvas, songId?:number, lap?:object, view?:'tile'|'road', onEnd:(r)=>void, onLap?:(laps:number)=>void,
   *           maxLaps?:number, skin?:object, vs?:{ name:string, other:()=>({score,lives,done}|null), onLive?:(live)=>void } }} o
   *   lap 을 주면 그걸로 (유저 맵 타일), 아니면 songId 의 곡
   */
  constructor({ audio, canvas, songId = 0, lap = null, view = 'tile', onEnd, onLap, maxLaps = MAX_LAPS, vs = null, skin = null }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.songId = songId;
    this.view = view === 'road' ? 'road' : 'tile';
    this.onEnd = onEnd;
    this.onLap = onLap;
    this.vs = vs;
    this.skin = skin || {};
    this.maxLaps = Math.max(1, Math.min(MAX_LAPS, maxLaps));
    this.lap = lap || tileLap(songId);
    this.tempo = lapTempo(this.lap);
    this.u = this.lap.u;
    this.per = this.lap.tiles.length;
    this.t0 = this.tempo.stepTime(this.lap.first);
    const mir = lapMirrors(this.lap);
    this.tiles = [];
    for (let k = 0; k < this.maxLaps; k++) {
      for (const t of this.lap.tiles) {
        const abs = k * this.lap.steps + t.step;
        this.tiles.push({ k, abs, row: abs / this.u, rows: t.rows, hold: t.hold, lane: mir[k] ? 3 - t.lane : t.lane, midi: t.midi, span: Math.min(t.len, t.gap), acc: t.acc, bar: Math.floor(abs / STEPS_PER_BAR) });
      }
    }
    this.row0 = this.tiles[0].row;
    this.hearts = TILE_HEARTS;
    this.score = 0;
    this.shown = 0;
    this.hits = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missed = 0;
    this.wrong = 0;
    this.lapsDone = 0;
    this.starsNow = 0;
    this.gemsNow = 0;
    this.head = 0;
    this.lastHit = [-9, -9, -9, -9];
    this.lastHurt = -9;
    this.hurtFx = null;
    this.press = new Float32Array(4);
    this.holds = [];
    this.fx = { bad: [], pop: [], lap: [], icon: [] };
    this.recent = [];
    this.state = 'ready';
    this.t = 0;
    this.taps = 0;
    this._onTouch = (e) => this._touch(e);
    this._onTouchEnd = (e) => this._touchEnd(e);
    this._onPointer = (e) => this._pointer(e);
    this._onPointerUp = (e) => this._release('p', e.pointerId);
    this._noop = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  // ---------- 시작·멈춤 ----------
  /** delay 가 있으면(대결) 그 초 뒤에 저절로 시작, 없으면 맨 아래 「시작」 타일을 누를 때 시작 */
  start(delay = 0) {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('touchstart', this._onTouch, { passive: false });
    c.addEventListener('touchmove', this._noop, { passive: false });
    c.addEventListener('touchend', this._onTouchEnd, { passive: false });
    c.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    c.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    this.lastFrame = performance.now();
    if (this.vs && delay > 0) {
      this.perf0 = performance.now() + delay * 1000;
      this.state = 'playing';
    } else this.state = 'ready';
    this._loop();
  }

  _loop() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (this.state === 'stopped' || this.state === 'ended' || this.state === 'paused') return;
      this._tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'count') return false;
    if (this.state === 'playing') this.pausedT = this._time(performance.now());
    cancelAnimationFrame(this.raf);
    this.state = 'paused';
    this.press.fill(0);
    this._endHolds();
    this._draw(this.pausedT, 0);
    return true;
  }

  /** 이어 하기: 화면은 멈춘 채 3·2·1 → 멈춘 자리부터 */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.state = 'count';
    this.countUntil = performance.now() + 1500;
    this.lastFrame = performance.now();
    this._loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.state !== 'ended') this.state = 'stopped';
    const c = this.canvas;
    c.removeEventListener('touchstart', this._onTouch);
    c.removeEventListener('touchmove', this._noop);
    c.removeEventListener('touchend', this._onTouchEnd);
    c.removeEventListener('touchcancel', this._onTouchEnd);
    c.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layout();
    this._cache();
    if (this.state === 'paused' || this.state === 'ready') this._draw(this.state === 'paused' ? this.pausedT : 0, 0);
  }

  /** 스킨 그림(무대)이 늦게 받아졌을 때 다시 그려 둠 */
  refreshSkin() {
    if (!this.W) return;
    this._cache();
  }

  _layout() {
    const { W, H } = this;
    this.hudH = Math.max(84, H * 0.13);
    if (this.view === 'tile') {
      this.laneW = W / 4;
      this.rowH = H / TILE_ROWS; // ⚠ 모든 곡이 같은 타일 크기
      this.baseY = H; // 곡 시각의 타일 아래 끝 자리 (시작 타일이 맨 아랫줄)
      this.lookRows = (this.baseY + 4) / this.rowH + 0.2;
      this.tapRows = (this.baseY - this.hudH * 0.5) / this.rowH;
      return;
    }
    // 원근: 길(판정선까지) + 아래 건반 4개
    this.kbH = Math.max(70, H * 0.13);
    this.judgeY = H - this.kbH - Math.max(8, H * 0.015);
    this.side = Math.max(8, W * 0.04);
    this.keyW = (W - this.side * 2) / 4;
    this.VB = ROAD_VB;
    this.lookRows = this.VB;
    this.tapRows = this.VB;
    this.FAR = 3.4;
    this.sFar = 1 / (1 + this.FAR);
    this.topY = this.hudH + 8;
    this.horizonY = (this.topY - this.judgeY * this.sFar) / (1 - this.sFar);
    this.cx = W / 2;
  }

  /** 스킨: 콩 스킨 색이면 [main, light, dark] (줄마다), 아니면 null */
  _pal(lane) {
    const p = this.skin.palette;
    return p ? p[[0, 1, 2, 3][lane] % p.length] : null;
  }
  get dark() {
    return !!(this.skin.img || this.skin.sky) || this.view === 'road';
  }

  /** 크기가 바뀔 때 한 번만 그려 두는 그림 (배경·타일) */
  _cache() {
    const { W, H, dpr } = this;
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [c, g];
    };
    this.spr = {};
    const [bg, b] = mk(W, H);
    if (this.view === 'tile') {
      const { laneW } = this;
      this._paintBg(b, W, H);
      // 줄 사이 얇은 선
      b.fillStyle = this.dark ? 'rgba(255,255,255,0.16)' : 'rgba(40,30,60,0.12)';
      for (let i = 1; i < 4; i++) b.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
      // 타일 그림: 줄마다(스킨 색이 줄마다 다를 수 있어서), 높이 1줄짜리 (긴 타일은 따로 그림)
      const tw = laneW - 2;
      const th = this.rowH - 2;
      this.spr.tile = [0, 1, 2, 3].map((l) => {
        const [tc, t] = mk(tw, th);
        this._paintTile(t, tw, th, l);
        return tc;
      });
      this.spr.tw = tw;
      this.spr.th = th;
      // 누른 줄 빛
      const [pc, p] = mk(laneW, H);
      const pg = p.createLinearGradient(0, 0, 0, H);
      const pr = this.dark ? '255,255,255' : '120,140,200';
      pg.addColorStop(0, `rgba(${pr},0)`);
      pg.addColorStop(1, `rgba(${pr},0.22)`);
      p.fillStyle = pg;
      p.fillRect(0, 0, laneW, H);
      this.spr.press = pc;
    } else {
      const { judgeY, side, keyW, sFar } = this;
      if (this.skin.img || this.skin.sky) this._paintBg(b, W, H);
      else {
        const gr = b.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#070918');
        gr.addColorStop(0.55, '#140f38');
        gr.addColorStop(1, '#231350');
        b.fillStyle = gr;
        b.fillRect(0, 0, W, H);
      }
      const x0 = side;
      const x1 = W - side;
      this._trap(b, x0, x1, sFar, 1);
      const road = b.createLinearGradient(0, this.topY, 0, judgeY);
      road.addColorStop(0, 'rgba(30,24,80,0.3)');
      road.addColorStop(1, 'rgba(44,32,110,0.8)');
      b.fillStyle = road;
      b.fill();
      b.lineWidth = 1;
      b.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let l = 1; l < 4; l++) {
        const x = side + l * keyW;
        b.beginPath();
        b.moveTo(this._px(x, sFar), this._py(sFar));
        b.lineTo(x, judgeY);
        b.stroke();
      }
      for (const [x, hue] of [
        [x0, ROAD_HUE[0]],
        [x1, ROAD_HUE[3]],
      ]) {
        b.strokeStyle = `hsla(${hue},95%,70%,0.8)`;
        b.lineWidth = 2;
        b.beginPath();
        b.moveTo(this._px(x, sFar), this._py(sFar));
        b.lineTo(x, judgeY);
        b.stroke();
      }
      b.fillStyle = 'rgba(180,160,255,0.22)';
      b.fillRect(side, judgeY - 6, W - side * 2, 6);
      const line = b.createLinearGradient(side, 0, W - side, 0);
      line.addColorStop(0, `hsl(${ROAD_HUE[0]},95%,70%)`);
      line.addColorStop(0.5, `hsl(${ROAD_HUE[2]},95%,72%)`);
      line.addColorStop(1, `hsl(${ROAD_HUE[3]},95%,72%)`);
      b.fillStyle = line;
      b.fillRect(side, judgeY - 2.5, W - side * 2, 2.5);
      this.spr.col = [0, 1, 2, 3].map((l) => {
        const sTop = this._s(this.VB * 0.5);
        const top = this._py(sTop);
        const [cc, c] = mk(W, judgeY - top + 2);
        c.translate(0, -top);
        const cg = c.createLinearGradient(0, top, 0, judgeY);
        cg.addColorStop(0, `hsla(${ROAD_HUE[l]},95%,65%,0)`);
        cg.addColorStop(1, `hsla(${ROAD_HUE[l]},95%,65%,0.45)`);
        this._trap(c, side + l * keyW, side + (l + 1) * keyW, sTop, 1);
        c.fillStyle = cg;
        c.fill();
        return { c: cc, y: top, w: W, h: judgeY - top + 2 };
      });
    }
    this.spr.bg = bg;
    // 위 정보 칸 바탕
    const [hc, h] = mk(W, this.hudH);
    const hg = h.createLinearGradient(0, 0, 0, this.hudH);
    if (this.dark) {
      hg.addColorStop(0, 'rgba(7,9,24,0.85)');
      hg.addColorStop(1, 'rgba(7,9,24,0)');
    } else {
      hg.addColorStop(0, 'rgba(255,255,255,0.9)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
    }
    h.fillStyle = hg;
    h.fillRect(0, 0, W, this.hudH);
    this.spr.hud = hc;
  }

  /** 배경: 기본은 피아노 타일처럼 밝은 흰 바탕 / 스킨 무대 그림·하늘색이면 그걸 깔고 어둡게 */
  _paintBg(b, W, H) {
    const sk = this.skin;
    if (sk.img && sk.img.complete && sk.img.naturalWidth) {
      const iw = sk.img.naturalWidth;
      const ih = sk.img.naturalHeight;
      const s = Math.max(W / iw, H / ih);
      b.drawImage(sk.img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      b.fillStyle = `rgba(6,4,16,${sk.dim ?? 0.45})`;
      b.fillRect(0, 0, W, H);
      return;
    }
    if (sk.sky || sk.img) {
      const sky = sk.sky || ['#0A0814', '#14102A', '#221A40'];
      const gr = b.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, sky[0]);
      gr.addColorStop(0.55, sky[1]);
      gr.addColorStop(1, sky[2]);
      b.fillStyle = gr;
      b.fillRect(0, 0, W, H);
      b.fillStyle = 'rgba(6,4,16,0.25)';
      b.fillRect(0, 0, W, H);
      return;
    }
    const gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#f3f1f8');
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);
  }

  /** 타일 한 장 (기본 = 검은 타일, 스킨 = 그 색) */
  _paintTile(t, tw, th, lane) {
    const pal = this._pal(lane);
    const g = t.createLinearGradient(0, 0, 0, th);
    if (pal) {
      g.addColorStop(0, pal[1]);
      g.addColorStop(0.35, pal[0]);
      g.addColorStop(1, pal[2]);
    } else if (this.dark) {
      g.addColorStop(0, '#2c2840');
      g.addColorStop(1, '#0d0b16');
    } else {
      g.addColorStop(0, '#2a2a33');
      g.addColorStop(1, '#0b0b10');
    }
    t.fillStyle = g;
    t.fillRect(0, 0, tw, th);
    // 위쪽 살짝 빛
    t.fillStyle = 'rgba(255,255,255,0.1)';
    t.fillRect(0, 0, tw, Math.max(2, th * 0.05));
    if (this.dark && !pal) {
      t.strokeStyle = 'rgba(255,255,255,0.35)';
      t.lineWidth = 1.5;
      t.strokeRect(0.75, 0.75, tw - 1.5, th - 1.5);
    }
    const tex = this.skin.fx && this.skin.fx.tex;
    if (tex === 's1') {
      t.font = font(th * 0.5);
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      t.fillStyle = 'rgba(255,215,90,0.85)';
      t.fillText('1', tw / 2, th / 2);
    } else if (tex) {
      // 스킨 반짝이 (작게, 치는 데 방해 안 되게)
      t.fillStyle = this.skin.fx.spark || '#fff';
      t.globalAlpha = 0.7;
      t.beginPath();
      t.arc(tw * 0.78, th * 0.22, Math.max(1.5, tw * 0.03), 0, Math.PI * 2);
      t.fill();
      t.globalAlpha = 1;
    }
  }

  /** 곡 시각 (performance.now 기준, 반주가 없어 소리 시계를 안 따라감) */
  _time(pn) {
    return this.perf0 == null ? 0 : (pn - this.perf0) / 1000;
  }
  /** 곡 시각 → 지금 줄 위치 */
  _rowAt(t) {
    return (this.tempo.barAt(t + this.t0) * STEPS_PER_BAR) / this.u;
  }

  // ---------- 원근 ----------
  _s(d) {
    return 1 / (1 + Math.max(-0.35, (d / this.VB) * this.FAR));
  }
  _py(s) {
    return this.horizonY + (this.judgeY - this.horizonY) * s;
  }
  _sx(s) {
    return 1 - (1 - s) * 0.55;
  }
  _px(x, s) {
    return this.cx + (x - this.cx) * this._sx(s);
  }
  _trap(g, xa, xb, sa, sb) {
    g.beginPath();
    g.moveTo(this._px(xa, sa), this._py(sa));
    g.lineTo(this._px(xb, sa), this._py(sa));
    g.lineTo(this._px(xb, sb), this._py(sb));
    g.lineTo(this._px(xa, sb), this._py(sb));
    g.closePath();
  }
  _laneMid(l) {
    return this.view === 'tile' ? (l + 0.5) * this.laneW : this.side + (l + 0.5) * this.keyW;
  }

  // ---------- 입력 ----------
  _touch(e) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) {
      try {
        this._press(t.clientX, t.clientY, e.timeStamp, 't', t.identifier);
      } catch {}
    }
  }
  _touchEnd(e) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) this._release('t', t.identifier);
  }
  _pointer(e) {
    if (e.cancelable) e.preventDefault();
    this._press(e.clientX, e.clientY, e.timeStamp, 'p', e.pointerId);
  }

  _laneAt(x, y) {
    if (y < this.hudH * 0.6) return -1;
    if (this.view === 'tile') return clamp(Math.floor(x / this.laneW), 0, 3);
    // 길 위를 누르면 그 높이에서 타일이 보이는 자리 → 건반 자리로 되돌려 읽음
    if (y < this.judgeY) {
      const k = this._sx(clamp((y - this.horizonY) / (this.judgeY - this.horizonY), this.sFar, 1));
      x = this.cx + (x - this.cx) / k;
    }
    return clamp(Math.floor((x - this.side) / this.keyW), 0, 3);
  }

  _press(cx, cy, ts, src, id) {
    if (this.state !== 'playing' && this.state !== 'ready') return;
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left) * (r.width ? this.W / r.width : 1);
    const y = (cy - r.top) * (r.height ? this.H / r.height : 1);
    const pn = performance.now();
    // touchstart 와 pointerdown 이 같은 손가락으로 둘 다 오면 한 번만
    if (this.recent.length > 8) this.recent = this.recent.filter((p) => pn - p.at < 120);
    for (const p of this.recent) if (pn - p.at < 80 && Math.abs(p.x - x) < 24 && Math.abs(p.y - y) < 24) return;
    this.recent.push({ x, y, at: pn });
    const lane = this._laneAt(x, y);
    if (lane < 0) return;
    const tsOk = ts > 0 && Math.abs(pn - ts) < 300 ? ts : pn;
    // 「시작」 타일
    if (this.state === 'ready') {
      const first = this.tiles[0];
      if (lane !== first.lane) return;
      this.perf0 = tsOk;
      this.state = 'playing';
      this.lastFrame = pn;
      this._hit(first, 0, y, src, id);
      return;
    }
    const t = this._time(tsOk);
    if (t < 0) return; // 대결: 아직 시작 전
    const cur = this._rowAt(t);
    this.taps++;
    this.press[lane] = 1;
    // 칠 타일: 아직 안 친 것 중 가장 아래 두 개 (두 번째는 첫 번째와 한 줄 안으로 붙어 있을 때만 — 빠른 음)
    let a = null;
    let b = null;
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (tl.hit || tl.miss) continue;
      if (!a) a = tl;
      else {
        b = tl;
        break;
      }
    }
    const visible = (tl) => tl && tl.row - cur < this.tapRows;
    if (a && a.lane === lane && visible(a)) return this._hit(a, t, y, src, id);
    if (b && b.lane === lane && visible(b) && b.row - a.row <= 1.01) return this._hit(b, t, y, src, id);
    // 방금 이 줄을 쳤음(튕김) · 꾹 누르는 중인 긴 타일 줄 · 그 자리에 아직 칠 차례가 아닌 타일이 있음 → 그냥 넘어감
    if (t - this.lastHit[lane] < BOUNCE_SEC) return;
    if (this.holds.some((h) => h.tile.lane === lane)) return;
    if (this.view === 'tile' && this._tileUnder(lane, y, cur)) return;
    this._wrong(lane, t, x, y);
  }

  /** 그 자리에 보이는 (아직 안 친) 타일이 있나 — 차례가 아닌 타일을 누른 건 벌 안 줌 */
  _tileUnder(lane, y, cur) {
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.row - cur;
      if (d > this.lookRows) break;
      if (tl.lane !== lane || tl.hit || tl.miss) continue;
      const yb = this.baseY - d * this.rowH;
      if (y <= yb + 4 && y >= yb - tl.rows * this.rowH - 4) return true;
    }
    return false;
  }

  _hit(tl, t, y, src, id) {
    tl.hit = true;
    tl.hitAt = t;
    this.score++;
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastHit[tl.lane] = t;
    this.press[tl.lane] = 1;
    this.comboAt = t;
    this._sound(tl);
    if (tl.hold) {
      const cur = this._rowAt(t);
      const yb = this.view === 'tile' ? this.baseY - (tl.row - cur) * this.rowH : 0;
      this.holds.push({ tile: tl, src, id, fy: Math.min(y, yb), at: t });
      tl.fill = 0;
    }
  }

  /** 손가락을 뗌 → 그 손가락이 누르던 긴 타일 끝 */
  _release(src, id) {
    for (const h of this.holds.slice()) if (h.src === src && h.id === id) this._holdDone(h, false);
  }
  _endHolds() {
    for (const h of this.holds.slice()) this._holdDone(h, false);
  }
  _holdDone(h, full) {
    const i = this.holds.indexOf(h);
    if (i < 0) return;
    this.holds.splice(i, 1);
    const tl = h.tile;
    const p = full ? 1 : tl.fill || 0;
    const bonus = full ? tl.rows - 1 : Math.max(0, Math.min(tl.rows - 1, Math.floor(p * tl.rows + 1e-6) - 1));
    tl.done = true;
    tl.fill = p;
    if (bonus > 0) {
      this.score += bonus;
      this.fx.pop.push({ at: this.t, lane: tl.lane, v: bonus, tile: tl });
    }
  }

  _wrong(lane, t, x, y) {
    this.fx.bad.push({ lane, at: t, y });
    if (t - this.lastHurt < GRACE_SEC) return;
    this.wrong++;
    this.combo = 0;
    this._hurt(t, lane);
  }

  _miss(tl, t) {
    tl.miss = true;
    tl.missAt = t;
    this.missed++;
    this.combo = 0;
    this._hurt(t, tl.lane, tl);
  }

  _hurt(t, lane, tl = null) {
    this.hearts--;
    this.lastHurt = t;
    this.hurtFx = { at: t, heart: this.hearts };
    try {
      if (this.audio.piano) this.audio.pianoNote(this.audio.ctx.currentTime, 40, 0.25, 0.4, this.audio.sfxBus);
    } catch {}
    if (this.hearts <= 0) this._die(t, tl);
  }

  _die(t, tl) {
    this.state = 'dying';
    this.diedAt = t;
    this.diedPerf = performance.now();
    this.failTile = tl;
    this._endHolds();
    try {
      this.audio.aww();
    } catch {}
  }

  /** 타일 하나 = 음 하나 (피아노), 반 마디 첫 타일엔 왼손 낮은 음 */
  _sound(tl) {
    const a = this.audio;
    const rt = a.ctx.currentTime;
    const sd = this.tempo.barLen(tl.bar) / STEPS_PER_BAR;
    const dur = clamp(tl.span * sd * 1.05, 0.18, 2.2);
    try {
      if (a.piano) {
        a.pianoNote(rt, tl.midi, dur, 0.95, a.sfxBus);
        if (tl.acc) for (const m of tl.acc) a.pianoNote(rt, m, Math.max(dur, 0.6), 0.42, a.sfxBus);
      } else a.lead(rt, tl.midi, dur, a.sfxBus);
    } catch {}
  }

  result() {
    const lapI = Math.min(1, this.lapsDone);
    const frac = this.lapsDone >= 2 ? 1 : Math.max(0, Math.min(1, (this.head - lapI * this.per) / this.per));
    const { stars, gems } = lapStars(this.lapsDone, frac);
    return {
      songId: this.songId,
      tiles: this.score,
      hits: this.hits,
      laps: this.lapsDone,
      stars,
      gems,
      maxCombo: this.maxCombo,
      missed: this.missed,
      wrong: this.wrong,
      per: this.per,
      complete: this.lapsDone >= this.maxLaps,
      died: this.hearts <= 0,
      view: this.view,
    };
  }

  /** 대결: 상대에게 보낼 지금 상태 */
  live() {
    return { score: this.score, combo: this.combo, progress: Math.min(1, this.head / (this.per * this.maxLaps)), lives: Math.max(0, this.hearts) };
  }

  // ---------- 매 화면 ----------
  _tick() {
    const pn = performance.now();
    const dt = Math.min(0.05, (pn - this.lastFrame) / 1000);
    this.lastFrame = pn;
    if (this.state === 'ready') return this._draw(0, dt);
    if (this.state === 'count') {
      if (pn >= this.countUntil) {
        this.perf0 = pn - this.pausedT * 1000;
        this.state = 'playing';
      } else return this._draw(this.pausedT, dt);
    }
    if (this.state === 'dying') {
      this._draw(this.diedAt, dt, true);
      if (pn - this.diedPerf > 1300) this._finish();
      return;
    }
    const t = this._time(pn);
    this.t = t;
    const cur = this._rowAt(t);
    if (t > 0) {
      // 지나간 타일 = 놓침 (바로 전 화면 시각으로 — 폰이 버벅인 뒤 밀린 터치가 먼저 처리되게)
      const prev = this._curPrev ?? cur;
      this._curPrev = cur;
      for (let i = this.head; i < this.tiles.length && this.state === 'playing'; i++) {
        const tl = this.tiles[i];
        if (prev - tl.row <= GONE_ROWS) break;
        if (!tl.hit && !tl.miss) this._miss(tl, t);
      }
    }
    // 꾹 누르는 긴 타일: 손가락 자리까지 차오름 (원근 보기는 판정선 지난 만큼)
    for (const h of this.holds.slice()) {
      const tl = h.tile;
      let p;
      if (this.view === 'tile') {
        const yb = this.baseY - (tl.row - cur) * this.rowH;
        const th = tl.rows * this.rowH;
        p = clamp((yb - h.fy) / th, 0, 1);
        if (yb - th > this.H) p = 1;
      } else p = clamp((cur - tl.row) / tl.rows, 0, 1);
      tl.fill = Math.max(tl.fill || 0, p);
      if (p >= 0.985) this._holdDone(h, true);
    }
    while (this.head < this.tiles.length && (this.tiles[this.head].hit || this.tiles[this.head].miss)) this.head++;
    // 별(첫 바퀴) · 다이아(둘째 바퀴): 1/3 · 2/3 지날 때 하나씩
    if (this.state === 'playing' && this.lapsDone < 2) {
      const st = lapStars(0, (this.head - this.lapsDone * this.per) / this.per).stars;
      if (this.lapsDone === 0) while (this.starsNow < st) this.fx.icon.push({ at: t, i: this.starsNow++, gem: false });
      else while (this.gemsNow < st) this.fx.icon.push({ at: t, i: this.gemsNow++, gem: true });
    }
    // 바퀴 다 돎 → 셋째 별 / 셋째 다이아 · 하트 회복 · 빨라짐
    while (this.state === 'playing' && this.head >= (this.lapsDone + 1) * this.per) {
      this.lapsDone++;
      if (this.lapsDone === 1) while (this.starsNow < 3) this.fx.icon.push({ at: t, i: this.starsNow++, gem: false });
      if (this.lapsDone === 2) while (this.gemsNow < 3) this.fx.icon.push({ at: t, i: this.gemsNow++, gem: true });
      if (this.hearts < TILE_HEARTS) {
        this.hearts++;
        this.hurtFx = { at: t, heal: true, heart: this.hearts - 1 };
      }
      this.fx.lap.push({ at: t, v: this.lapsDone });
      try {
        if (this.lapsDone <= 2) this.audio.fanfare();
        else this.audio.sfxFile('combo', 0.6);
      } catch {}
      if (this.onLap) this.onLap(this.lapsDone);
      if (this.lapsDone >= this.maxLaps) {
        this.state = 'dying';
        this.diedAt = t;
        this.diedPerf = performance.now();
        this.complete = true;
        this._endHolds();
      }
    }
    if (this.vs && this.vs.onLive && pn - (this._liveAt || 0) > 250) {
      this._liveAt = pn;
      try {
        this.vs.onLive(this.live());
      } catch {}
    }
    this._draw(t, dt);
  }

  _finish() {
    this.stop();
    this.state = 'ended';
    if (this.onEnd) this.onEnd(this.result());
  }

  _draw(t, dt = 0, frozen = false) {
    this.cur = this._rowAt(t);
    this.shown += (this.score - this.shown) * Math.min(1, dt * 14);
    if (Math.abs(this.score - this.shown) < 0.5) this.shown = this.score;
    for (let i = 0; i < 4; i++) this.press[i] = Math.max(0, this.press[i] - dt * 6);
    this.realT = performance.now() / 1000;
    const g = this.g;
    g.save();
    const hf = this.hurtFx && !this.hurtFx.heal ? this.hurtFx : null;
    const hk = hf ? 1 - (t - hf.at) / 0.3 : 0;
    if (hk > 0 && !frozen) g.translate(Math.sin(t * 90) * 4 * hk, 0);
    if (this.view === 'road') this._drawRoad(g, t);
    else this._drawTiles(g, t);
    this._drawEdge(g, t);
    this._drawHud(g, t);
    this._drawCount(g, t);
    this._drawLapFx(g, t);
    if (frozen) this._drawDying(g);
    g.restore();
    // 지난 효과 치우기 (가끔만)
    if (++this._gc > 30) {
      this._gc = 0;
      const old = t - 1.8;
      for (const k of Object.keys(this.fx)) if (this.fx[k].length) this.fx[k] = this.fx[k].filter((f) => f.at > old);
    }
  }

  // ======== 클래식 타일 (피아노 타일) ========
  _drawTiles(g, t) {
    const { W, H, laneW, rowH, baseY } = this;
    const S = this.spr;
    g.drawImage(S.bg, 0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.drawImage(S.press, i * laneW, 0, laneW, H);
    }
    g.globalAlpha = 1;
    // 빈 칸 누름 = 그 칸 빨갛게
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,60,80,${0.55 * a})`;
      g.fillRect(b.lane * laneW + 1, b.y - rowH / 2, laneW - 2, rowH);
    }
    const cur = this.cur;
    const tw = S.tw;
    const ready = this.state === 'ready';
    for (let i = Math.max(0, this.head - 10); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.row - cur;
      if (d > this.lookRows) break;
      const yb = baseY - d * rowH;
      const th = tl.rows * rowH;
      const y = yb - th;
      if (y > H + 4) continue;
      const x = tl.lane * laneW + 1;
      if (tl.miss) {
        const fail = tl === this.failTile;
        const a = fail ? 0.6 + 0.4 * Math.sin(this.realT * 20) : 1 - ease((t - tl.missAt) / 0.8);
        if (a <= 0) continue;
        g.globalAlpha = a;
        g.fillStyle = '#ff3b52';
        g.fillRect(x, y + 1, tw, th - 2);
        g.globalAlpha = 1;
        continue;
      }
      if (tl.hold) {
        this._drawHold(g, tl, x, y + 1, tw, th - 2);
        continue;
      }
      if (tl.hit) {
        // 친 타일: 옅은 회색으로 남아 내려감 (피아노 타일처럼)
        g.fillStyle = this.dark ? 'rgba(255,255,255,0.14)' : 'rgba(30,30,40,0.12)';
        g.fillRect(x, y + 1, tw, th - 2);
        continue;
      }
      g.drawImage(S.tile[tl.lane], x, y + 1, tw, S.th);
      if (ready && i === 0) {
        g.font = font(Math.min(30, laneW * 0.28));
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#ffffff';
        g.fillText('시작', x + tw / 2, y + th / 2);
      }
    }
    // 긴 타일 끝까지 눌렀을 때 +N
    for (const p of this.fx.pop) {
      const k = (t - p.at) / 0.8;
      if (k < 0 || k > 1) continue;
      g.globalAlpha = 1 - ease(k);
      g.font = font(Math.min(30, laneW * 0.3));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = this.dark ? 'rgba(0,0,0,0.7)' : '#fff';
      const yy = H * 0.55 - k * 40;
      g.strokeText(`+${p.v}`, (p.lane + 0.5) * laneW, yy);
      g.fillStyle = HOLD_BLUE;
      g.fillText(`+${p.v}`, (p.lane + 0.5) * laneW, yy);
      g.globalAlpha = 1;
    }
  }

  /** 긴 타일: 검은 몸통 + 가운데 줄 + 아래 동그라미, 누른 만큼 파랗게 차오름 */
  _drawHold(g, tl, x, y, w, h) {
    const pal = this._pal(tl.lane);
    const done = tl.done || (tl.hit && !this.holds.some((q) => q.tile === tl));
    g.globalAlpha = done ? 0.35 : 1;
    const body = g.createLinearGradient(0, y, 0, y + h);
    if (pal) {
      body.addColorStop(0, pal[0]);
      body.addColorStop(1, pal[2]);
    } else {
      body.addColorStop(0, this.dark ? '#2c2840' : '#34343f');
      body.addColorStop(1, this.dark ? '#0d0b16' : '#0b0b10');
    }
    g.fillStyle = body;
    g.fillRect(x, y, w, h);
    if (this.dark && !pal) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.5;
      g.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    }
    // 가운데 줄 + 아래 동그라미
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(x + w / 2 - 1.5, y + 8, 3, h - 16);
    g.beginPath();
    g.arc(x + w / 2, y + h - Math.min(28, h * 0.12), Math.min(9, w * 0.09), 0, Math.PI * 2);
    g.fill();
    // 차오른 만큼 (아래부터)
    const f = tl.fill || 0;
    if (tl.hit && f > 0) {
      const fh = h * f;
      g.globalAlpha = done ? 0.35 : 0.92;
      const gg = g.createLinearGradient(0, y + h - fh, 0, y + h);
      gg.addColorStop(0, '#c9f0ff');
      gg.addColorStop(1, HOLD_BLUE);
      g.fillStyle = gg;
      g.fillRect(x, y + h - fh, w, fh);
      if (!done) {
        g.fillStyle = '#ffffff';
        g.fillRect(x, y + h - fh - 2, w, 3);
      }
    }
    g.globalAlpha = 1;
  }

  // ======== 원근 (건반처럼) ========
  _drawRoad(g, t) {
    const { W, H, judgeY, side, keyW } = this;
    const S = this.spr;
    g.drawImage(S.bg, 0, 0, W, H);
    const x0 = side;
    const x1 = W - side;
    const cur = this.cur;
    for (let k = Math.ceil(cur); k < cur + this.VB; k++) {
      const d = k - cur;
      const s = this._s(d);
      g.fillStyle = `rgba(200,190,255,${0.07 * Math.min(1, (this.VB - d) / 0.8)})`;
      g.fillRect(this._px(x0, s), this._py(s), this._px(x1, s) - this._px(x0, s), Math.max(1, 2 * s));
    }
    for (let l = 0; l < 4; l++) {
      const a = this.press[l];
      if (a < 0.02) continue;
      const c = S.col[l];
      g.globalAlpha = a;
      g.drawImage(c.c, 0, c.y, c.w, c.h);
    }
    g.globalAlpha = 1;
    for (const bd of this.fx.bad) {
      const a = 1 - ease((t - bd.at) / 0.45);
      if (a <= 0) continue;
      this._trap(g, side + bd.lane * keyW, side + (bd.lane + 1) * keyW, this._s(1.2), 1);
      g.fillStyle = `rgba(255,77,109,${0.35 * a})`;
      g.fill();
    }
    g.save();
    g.beginPath();
    g.rect(0, this.hudH, W, judgeY - this.hudH);
    g.clip();
    for (let i = Math.max(0, this.head - 10); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      let dH = tl.row - cur;
      if (dH > this.VB) break;
      const len = tl.hold ? tl.rows * 0.92 : 0.55;
      if (dH + len < -0.6) continue;
      let alpha = Math.min(1, (this.VB - dH) / 0.7);
      if (tl.hit && !tl.hold) {
        const k = ease((t - tl.hitAt) / 0.22);
        if (k >= 1) continue;
        alpha *= 1 - k;
        dH = Math.max(0, dH);
      }
      if (tl.miss) {
        const fail = tl === this.failTile;
        alpha *= fail ? 0.6 + 0.4 * Math.sin(this.realT * 22) : 1 - ease((t - tl.missAt) / 0.5);
        if (alpha <= 0) continue;
      }
      const dT = Math.min(this.VB, dH + len);
      if (dT <= dH) continue;
      const pad = keyW * 0.08;
      const xa = side + tl.lane * keyW + pad;
      const xb = side + (tl.lane + 1) * keyW - pad;
      const sH = this._s(Math.max(-0.3, dH));
      const sT = this._s(dT);
      const hue = ROAD_HUE[tl.lane];
      const pal = this._pal(tl.lane);
      const done = tl.hold && tl.done;
      g.globalAlpha = Math.max(0, alpha) * (done ? 0.4 : 1);
      this._trap(g, xa, xb, sT, sH);
      g.fillStyle = tl.miss ? '#ff4d6d' : pal ? pal[0] : `hsl(${hue},90%,58%)`;
      g.fill();
      if (tl.hold && tl.hit && (tl.fill || 0) > 0) {
        const fT = Math.min(dT, Math.max(-0.3, dH) + len * tl.fill);
        this._trap(g, xa, xb, this._s(fT), sH);
        g.fillStyle = HOLD_BLUE;
        g.fill();
      } else if (!tl.miss) {
        this._trap(g, xa, xb, (sT + sH) / 2, sH);
        g.fillStyle = pal ? pal[1] : `hsla(${hue},100%,80%,0.55)`;
        g.globalAlpha *= 0.55;
        g.fill();
      }
      g.globalAlpha = Math.max(0, alpha) * (done ? 0.4 : 1);
      const yH = this._py(sH);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(this._px(xa, sH) + 1, yH - Math.max(2, 4 * sH), this._px(xb, sH) - this._px(xa, sH) - 2, Math.max(1.5, 3.5 * sH));
      if (this.state === 'ready' && i === 0) {
        g.font = font(Math.min(22, keyW * 0.24));
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillStyle = '#fff';
        g.fillText('시작', (this._px(xa, sH) + this._px(xb, sH)) / 2, yH - 8);
      }
    }
    g.globalAlpha = 1;
    g.restore();
    for (const p of this.fx.pop) {
      const k = (t - p.at) / 0.8;
      if (k < 0 || k > 1) continue;
      g.globalAlpha = 1 - ease(k);
      g.font = font(26);
      g.textAlign = 'center';
      g.fillStyle = HOLD_BLUE;
      g.fillText(`+${p.v}`, side + (p.lane + 0.5) * keyW, judgeY - 30 - k * 40);
      g.globalAlpha = 1;
    }
    this._keys(g);
  }

  _keys(g) {
    const { side, keyW, judgeY, H } = this;
    const top = judgeY + 2;
    const kh = H - top - 6;
    g.fillStyle = '#0b0a12';
    rr(g, side - 5, top - 3, keyW * 4 + 10, kh + 8, 12);
    g.fill();
    for (let l = 0; l < 4; l++) {
      const p = this.press[l];
      const x = side + l * keyW + 2;
      const w = keyW - 4;
      const dy = 3 * p;
      g.fillStyle = '#bdb8cb';
      rr(g, x, top + 4, w, kh - 4, 9);
      g.fill();
      g.fillStyle = '#f7f6fb';
      rr(g, x, top + dy, w, kh - 6, 9);
      g.fill();
      if (p > 0.02) {
        g.fillStyle = `hsla(${ROAD_HUE[l]},95%,65%,${0.6 * p})`;
        rr(g, x, top + dy, w, kh - 6, 9);
        g.fill();
      }
      g.fillStyle = `hsl(${ROAD_HUE[l]},90%,62%)`;
      rr(g, x + w * 0.3, top + dy + kh - 18, w * 0.4, 5, 2.5);
      g.fill();
    }
  }

  // ======== 위 정보 줄 ========
  _drawHud(g, t) {
    const { W, hudH } = this;
    const dark = this.dark;
    g.drawImage(this.spr.hud, 0, 0, W, hudH);
    // 진행 줄 (맨 위, 피아노 타일처럼 별·다이아 자리 표시)
    const lapI = Math.min(this.maxLaps - 1, this.lapsDone);
    const p = this.state === 'ready' ? 0 : clamp((this.cur - this.row0 - lapI * (this.lap.steps / this.u)) / (this.lap.steps / this.u), 0, 1);
    const px0 = 12;
    const px1 = W - 12;
    g.fillStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(40,30,60,0.1)';
    g.fillRect(px0, 6, px1 - px0, 5);
    g.fillStyle = this.lapsDone === 0 ? '#ff5a5f' : this.lapsDone === 1 ? '#3aa8e8' : '#b06bff';
    g.fillRect(px0, 6, (px1 - px0) * p, 5);
    if (this.lapsDone < 2) {
      for (let i = 1; i <= 3; i++) {
        const x = px0 + ((px1 - px0) * i) / 3 - (i === 3 ? 7 : 0);
        const on = i <= (this.lapsDone === 0 ? this.starsNow : this.gemsNow);
        if (this.lapsDone === 0) star(g, x, 8.5, 6.5, on ? '#ffc23d' : dark ? 'rgba(255,255,255,0.35)' : 'rgba(40,30,60,0.25)', on ? '#e08a00' : null);
        else if (on) gem(g, x, 8.5, 6);
        else gemOutline(g, x, 8.5, 6, dark);
      }
    }
    // 하트
    const hs = Math.min(22, W * 0.055);
    for (let i = 0; i < TILE_HEARTS; i++) {
      const on = i < this.hearts;
      const ev = this.hurtFx && this.hurtFx.heart === i ? this.hurtFx : null;
      let s = 1;
      if (ev) {
        const k = (t - ev.at) / 0.45;
        if (k >= 0 && k < 1) s = ev.heal ? 1 + 0.5 * (1 - ease(k)) : 1 + 0.35 * Math.sin(k * Math.PI);
      }
      heart(g, 16 + i * (hs + 6) + hs / 2, 22 + hs / 2, hs * s, on ? '#ff4d6d' : dark ? 'rgba(255,255,255,0.2)' : 'rgba(59,42,74,0.15)');
    }
    // 점수 (피아노 타일처럼 가운데 위, 빨간 숫자)
    const sTxt = Math.round(this.shown).toLocaleString();
    const pop = this.comboAt != null ? 1 + 0.08 * (1 - ease((t - this.comboAt) / 0.15)) : 1;
    g.save();
    g.translate(W / 2, 18);
    g.scale(pop, pop);
    g.font = font(Math.min(52, W * 0.13));
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = dark ? 'rgba(7,9,24,0.9)' : '#ffffff';
    g.strokeText(sTxt, 0, 0);
    g.fillStyle = dark ? '#ffffff' : '#ff4b55';
    g.fillText(sTxt, 0, 0);
    g.restore();
    // 별 3개 · 다이아 3개 (빈 것 → 차오름)
    const sy = 18 + Math.min(56, W * 0.14) + 10;
    const ss = Math.min(12, W * 0.031);
    for (let i = 0; i < 6; i++) {
      const isGem = i >= 3;
      const k = i % 3;
      const on = isGem ? k < this.gemsNow : k < this.starsNow;
      const ev = this.fx.icon.find((f) => f.gem === isGem && f.i === k);
      const kk = ev ? clamp((t - ev.at) / 0.4, 0, 1) : 1;
      const sc = on && kk < 1 ? 1 + 0.7 * Math.sin(kk * Math.PI) : 1;
      const x = W / 2 + (i - 2.5) * ss * 2.3 + (isGem ? ss * 0.5 : -ss * 0.5);
      if (!isGem) star(g, x, sy, ss * sc, on ? '#ffc23d' : dark ? 'rgba(255,255,255,0.22)' : 'rgba(59,42,74,0.16)', on ? '#e08a00' : null);
      else if (on) gem(g, x, sy, ss * 0.95 * sc);
      else gemOutline(g, x, sy, ss * 0.95, dark);
    }
    if (this.combo >= 10 && !this.vs) {
      g.font = font(Math.min(15, W * 0.038));
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(59,42,74,0.55)';
      g.fillText(`${this.combo} 연속`, W / 2, sy + ss * 1.5);
    }
    if (this.vs) this._drawVs(g, sy + ss * 1.6, dark);
  }

  /** ⚔️ 대결: 나 vs 상대 막대 */
  _drawVs(g, y, dark) {
    const { W } = this;
    const o = (this.vs.other && this.vs.other()) || null;
    const mine = this.score;
    const theirs = o ? o.score || 0 : 0;
    const x0 = 18;
    const x1 = W - 18;
    const k = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
    g.fillStyle = '#ff7ab0';
    rr(g, x0, y, x1 - x0, 8, 4);
    g.fill();
    g.fillStyle = '#ffb84a';
    rr(g, x0, y, Math.max(8, (x1 - x0) * k), 8, 4);
    g.fill();
    g.font = font(13);
    g.textBaseline = 'top';
    g.fillStyle = dark ? '#fff' : '#3b2a4a';
    g.textAlign = 'left';
    g.fillText(`나 ${mine}`, x0, y + 11);
    g.textAlign = 'right';
    const nm = (this.vs.name || '상대').slice(0, 8);
    g.fillText(o && o.done ? `${nm} ${theirs} (끝)` : `${nm} ${theirs}${o && o.lives != null ? ' · ♥' + o.lives : ''}`, x1, y + 11);
  }

  /** 하트를 잃음: 화면 가장자리 빨갛게 (가장자리 띠 네 개 — 원형 그라데이션은 무거워서) */
  _drawEdge(g, t) {
    const hf = this.hurtFx && !this.hurtFx.heal ? this.hurtFx : null;
    if (!hf) return;
    const a = 1 - ease((t - hf.at) / 0.5);
    if (a <= 0) return;
    const { W, H } = this;
    const e = Math.min(W, H) * 0.05;
    g.fillStyle = `rgba(255,40,80,${0.35 * a})`;
    g.fillRect(0, 0, W, e);
    g.fillRect(0, H - e, W, e);
    g.fillRect(0, e, e, H - 2 * e);
    g.fillRect(W - e, e, e, H - 2 * e);
  }

  /** 바퀴를 돎: 별 3개 완성 / 다이아 3개 완성 / N바퀴 */
  _drawLapFx(g, t) {
    const { W, H } = this;
    const cy = H * 0.36;
    for (const f of this.fx.lap) {
      const k = (t - f.at) / 1.4;
      if (k < 0 || k > 1) continue;
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      g.save();
      g.globalAlpha = a;
      const s = 0.7 + 0.45 * ease(k / 0.25);
      g.translate(W / 2, cy);
      g.scale(s, s);
      const big = Math.min(42, W * 0.105);
      if (f.v === 1) for (let i = 0; i < 3; i++) star(g, (i - 1) * big * 1.25, -(i === 1 ? big * 0.25 : 0), big * 0.55, '#ffc23d', '#e08a00');
      else if (f.v === 2) for (let i = 0; i < 3; i++) gem(g, (i - 1) * big * 1.25, -(i === 1 ? big * 0.25 : 0), big * 0.5);
      g.font = font(Math.min(28, W * 0.07));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 6;
      const msg = f.v >= this.maxLaps ? '완주!' : f.v === 1 ? '별 3개! 더 빨라져요' : f.v === 2 ? '다이아 3개! 더 빨라져요' : `${f.v}바퀴! 더 빨라져요`;
      g.strokeStyle = this.dark ? 'rgba(7,9,24,0.9)' : '#fff';
      g.strokeText(msg, 0, f.v <= 2 ? big * 0.95 : 0);
      g.fillStyle = f.v === 1 ? '#ff9a3d' : f.v === 2 ? '#3aa8e8' : '#b06bff';
      g.fillText(msg, 0, f.v <= 2 ? big * 0.95 : 0);
      g.restore();
    }
  }

  _drawDying(g) {
    const { W, H } = this;
    const k = clamp((performance.now() - this.diedPerf) / 600, 0, 1);
    g.fillStyle = this.complete ? `rgba(255,250,240,${0.25 * k})` : `rgba(30,10,30,${0.3 * k})`;
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = k;
    g.font = font(Math.min(40, W * 0.1));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 7;
    const msg = this.complete ? '완주!' : '아쉬워요!';
    g.strokeStyle = 'rgba(10,8,20,0.85)';
    g.strokeText(msg, W / 2, H * 0.45);
    g.fillStyle = this.complete ? '#ffc23d' : '#ffffff';
    g.fillText(msg, W / 2, H * 0.45);
    g.restore();
  }

  /** 이어 하기 3·2·1 · 대결 시작 전 'VS 상대' */
  _drawCount(g, t) {
    const { W, H } = this;
    let left = null;
    if (this.state === 'count') left = (this.countUntil - performance.now()) / 1000;
    else if (this.vs && this.state === 'playing' && t < 0) {
      if (t < -3) {
        g.save();
        g.fillStyle = 'rgba(20,12,40,0.55)';
        g.fillRect(0, H * 0.3, W, H * 0.24);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font(Math.min(44, W * 0.11));
        g.fillStyle = '#ffd36b';
        g.fillText('VS', W / 2, H * 0.37);
        g.font = font(Math.min(26, W * 0.065));
        g.fillStyle = '#fff';
        g.fillText(this.vs.name || '상대', W / 2, H * 0.44);
        g.font = font(16);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillText(`${Math.ceil(-t - 3)}초 뒤 같이 시작!`, W / 2, H * 0.5);
        g.restore();
        return;
      }
      left = -t * 0.5; // 3초 → 1.5 로 맞춰 3·2·1
    }
    if (left == null || left <= 0) return;
    const total = 1.5;
    const k = Math.min(3, Math.ceil((left / total) * 3 - 0.001));
    const frac = (left / total) * 3 - (k - 1);
    const s = 0.85 + 0.25 * ease((1 - frac) * 3);
    const cx = W / 2;
    const cy = H * 0.42;
    const R = Math.min(W, H) * 0.13;
    g.save();
    g.globalAlpha = Math.min(1, frac * 2.5);
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#3b2a4a';
    g.font = font(R * 1.2 * s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(k), cx, cy + R * 0.06);
    g.restore();
  }
}
TileGame.prototype._gc = 0;

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
function heart(g, cx, cy, s, color) {
  g.save();
  g.translate(cx, cy);
  g.scale(s / 24, s / 24);
  g.beginPath();
  g.moveTo(0, 8);
  g.bezierCurveTo(-14, -1, -10, -14, 0, -6);
  g.bezierCurveTo(10, -14, 14, -1, 0, 8);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}
function star(g, cx, cy, r, color, edge) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = 1.5;
    g.stroke();
  }
}
/** 다이아 테두리 모양 */
function gemPath(g, cx, cy, r) {
  const top = cy - r * 0.62;
  const mid = cy - r * 0.12;
  const bot = cy + r * 0.9;
  const xw = r * 1.05;
  const xi = r * 0.45;
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx, bot);
  g.lineTo(cx - xw, mid);
  g.closePath();
}
/** ◇ 빈 다이아 (아직 못 받음): 테두리만 */
export function gemOutline(g, cx, cy, r, dark = false) {
  gemPath(g, cx, cy, r);
  g.fillStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(59,42,74,0.06)';
  g.fill();
  g.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(59,42,74,0.28)';
  g.lineWidth = Math.max(1, r * 0.14);
  g.lineJoin = 'round';
  g.stroke();
}
/** 💎 다이아몬드 (이모지 대신 직접 그림): 윗면·옆면 조각 + 반짝임 */
export function gem(g, cx, cy, r) {
  const top = cy - r * 0.62;
  const mid = cy - r * 0.12;
  const bot = cy + r * 0.9;
  const xw = r * 1.05;
  const xi = r * 0.45;
  g.beginPath();
  g.moveTo(cx - xw, mid);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx, bot);
  g.closePath();
  g.fillStyle = '#3aa8e8';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, mid);
  g.lineTo(cx + xi, mid);
  g.lineTo(cx, bot);
  g.closePath();
  g.fillStyle = '#7fd7ff';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx - xw, mid);
  g.closePath();
  g.fillStyle = '#a9e8ff';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx, mid);
  g.closePath();
  g.fillStyle = '#e6f9ff';
  g.fill();
  gemPath(g, cx, cy, r);
  g.strokeStyle = '#1d6fa3';
  g.lineWidth = Math.max(1, r * 0.08);
  g.lineJoin = 'round';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx - r * 0.35, top + r * 0.2, r * 0.1, 0, Math.PI * 2);
  g.fill();
}
