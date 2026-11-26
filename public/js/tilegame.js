// 🎹 시즌 2 피아노 타일 게임 (2026-11-26)
//   보기 두 가지 (설정 「타일 보기」, 판정은 똑같음 — 랭킹 같이 씀):
//     'tile' : 클래식 — 밝은 바닥에 검은 타일 4줄이 내려옴
//     'road' : 원근 — 건반 모드처럼 어두운 무대의 길 위로 멀리서부터 빛 타일이 다가오고, 아래 건반 4개를 누름 (더 멀리까지 보임)
//   규칙: 아래쪽에 온 타일(판정선 READY_B 박 앞부터, 가장 먼저 칠 타일은 NEXT_B 박 앞부터)을 그 줄에서 누르면 됨 — 판정 글자 없음
//         놓침(화면 밖으로 지나감)·빈 줄 누름 = 하트 하나, 바퀴를 돌면 하트 하나 회복, 하트 0 이면 끝
//   ★ 첫 바퀴(곡 하나) 동안 별 3개가 차오름 → 그 뒤 바퀴마다 빨라지고 다이아몬드 (11-26 사용자). 빠르기 숫자·번개는 안 보임
//   타일 하나 = 음 하나 (화음·묶음 없음, 11-26 사용자)
//   🧈 부드럽게 (11-26 사용자 '살짝 렉 걸리며 내려오고 터치하면 멈칫'):
//     · 화면 시계는 소리 시계를 그대로 쓰지 않고 performance.now 로 흘리면서 소리 시계 쪽으로 조금씩만 당김 (`_clock`)
//       — 소리 시계는 몇 ms 덩어리로 움직여서 그대로 그리면 타일이 덜컹거림
//     · 배경·타일 그림은 크기가 바뀔 때 한 번만 그려 두고(오프스크린 캔버스) 매 화면엔 붙이기만 → 그라데이션을 매번 안 만듦
//   🖐 터치 씹힘 대비 (CLAUDE.md 터치 씹힘 1~4차):
//     · touchstart 로 받고, pointerdown 도 받아서 같은 자리(24px)·80ms 안이면 한 번만 (폰마다 한쪽만 올 때가 있어서)
//     · touchmove 로는 절대 새 터치를 만들지 않음 (가짜 터치의 원인이었음)
//     · 방금 친 줄을 0.12초 안에 또 누른 '튕김'은 무시 (그 줄에 칠 타일이 있으면 그대로 침 — 이득 없음)
//     · 하트를 잃은 뒤 0.35초는 빈 줄 누름으로 또 깎지 않음 (한 번의 실수가 줄줄이 깎이지 않게)
//   ⚔️ 대결(vs): 상대 점수 막대를 위에 그림, maxLaps 바퀴(기본 3)에서 끝

import { STEPS_PER_BAR, COUNT_IN_BARS } from './charts.js';
import { SongPlayer } from './audio.js';
import { tileLap, tileLevel, lapMirrors, lapSpeed, lapStars, MAX_LAPS, TILE_HEARTS, READY_B, NEXT_B, GONE_B, GONE_MIN_SEC } from './tiles.js';

const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 원근 보기 줄 색 (왼쪽부터 하늘·파랑·보라·분홍) */
const ROAD_HUE = [188, 222, 270, 318];
const BOUNCE_SEC = 0.12;
const GRACE_SEC = 0.35;

export class TileGame {
  /**
   * @param {{ audio, canvas, songId:number, view?:'tile'|'road', offsetMs?:number, onEnd:(r)=>void, onLap?:(laps:number)=>void,
   *           maxLaps?:number, vs?:{ name:string, other:()=>({score,lives,done,died}|null), onLive?:(live)=>void } }} o
   */
  constructor({ audio, canvas, songId, view = 'tile', offsetMs = 0, onEnd, onLap, maxLaps = MAX_LAPS, vs = null }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.songId = songId;
    this.view = view === 'road' ? 'road' : 'tile';
    this.offset = (offsetMs || 0) / 1000;
    this.onEnd = onEnd;
    this.onLap = onLap;
    this.vs = vs;
    this.maxLaps = Math.max(1, Math.min(MAX_LAPS, maxLaps));
    this.lap = tileLap(songId);
    this.level = tileLevel(songId);
    this.tempo = this.level.tempo;
    this.per = this.lap.tiles.length;
    const mir = lapMirrors(this.lap);
    this.tiles = [];
    for (let k = 0; k < this.maxLaps; k++) {
      for (const t of this.lap.tiles) {
        const abs = COUNT_IN_BARS * STEPS_PER_BAR + k * this.lap.bars * STEPS_PER_BAR + t.step;
        this.tiles.push({ k, beat: abs / 4, t: this.tempo.stepTime(abs), lane: mir[k] ? 3 - t.lane : t.lane, midi: t.midi, len: t.len, absBar: Math.floor(abs / STEPS_PER_BAR) });
      }
    }
    // 타일 높이(박): 같은 줄 다음 타일과 안 겹치게
    let min = Infinity;
    const last = [null, null, null, null];
    for (const t of this.tiles.slice(0, this.per * 2)) {
      if (last[t.lane] != null) min = Math.min(min, t.beat - last[t.lane]);
      last[t.lane] = t.beat;
    }
    this.tileB = clamp((isFinite(min) ? min : 1) * 0.88, 0.45, 0.95);
    this.lapBeat0 = COUNT_IN_BARS * 4;
    this.hearts = TILE_HEARTS;
    this.score = 0;
    this.shown = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missed = 0;
    this.wrong = 0;
    this.lapsDone = 0;
    this.starsNow = 0;
    this.head = 0;
    this.lastHit = [-9, -9, -9, -9];
    this.lastHurt = -9;
    this.press = new Float32Array(4);
    this.fx = { rings: [], parts: [], bad: [], lap: [], hurt: [], star: [] };
    this.recent = [];
    this.state = 'ready';
    this.taps = 0;
    this._onTouch = (e) => this._touch(e);
    this._onPointer = (e) => this._pointer(e);
    this._noop = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  // ---------- 시작·멈춤 ----------
  /** delay = 지금부터 몇 초 뒤에 곡 시계 0 (대결은 서버가 정한 시각까지 기다림) */
  start(delay = 0.35) {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('touchstart', this._onTouch, { passive: false });
    // 아이폰: 꾹 누르면 뜨는 돋보기·글자 고르기 막기 (touchmove 로는 아무것도 안 함)
    for (const ev of ['touchmove', 'touchend', 'touchcancel']) c.addEventListener(ev, this._noop, { passive: false });
    c.addEventListener('pointerdown', this._onPointer);
    this._play(this.audio.ctx.currentTime + delay);
  }

  _play(startTime) {
    this.startTime = startTime;
    this._ck = null;
    this.player = new SongPlayer(this.audio, this.level, startTime);
    this.player.start();
    this.state = 'playing';
    this.lastFrame = performance.now();
    const loop = (ts) => {
      if (this.state !== 'playing' && this.state !== 'dying') return;
      this._tick(ts);
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  _halt(fade = 0.08) {
    cancelAnimationFrame(this.raf);
    if (this.player) this.player.stop(fade);
    this.player = null;
  }

  pause() {
    if (this.state !== 'playing') return false;
    this.pausedAt = this.now();
    this._halt();
    this.state = 'paused';
    this.press.fill(0);
    this._draw(this.pausedAt, 0);
    return true;
  }

  /** 이어 하기: 1.8초 앞에서 다시 흘러 3·2·1 뒤 멈춘 자리 (그 사이 지나간 타일은 이미 처리됨) */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.resumeAt = this.pausedAt;
    this._play(this.audio.ctx.currentTime + 1.8 - this.pausedAt);
  }

  stop() {
    this._halt();
    if (this.state !== 'ended') this.state = 'stopped';
    const c = this.canvas;
    c.removeEventListener('touchstart', this._onTouch);
    for (const ev of ['touchmove', 'touchend', 'touchcancel']) c.removeEventListener(ev, this._noop);
    c.removeEventListener('pointerdown', this._onPointer);
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
    if (this.state === 'paused') this._draw(this.pausedAt, 0);
  }

  _layout() {
    const { W, H } = this;
    this.hudH = Math.max(84, H * 0.13);
    if (this.view === 'tile') {
      this.laneW = W / 4;
      this.judgeY = H * 0.8;
      // 11-26 사용자 '너무 느려' → 박 하나를 더 길게 (타일이 더 빨리 내려옴, 화면에 2~3박)
      this.ppb = clamp((H * 0.27) / this.tileB, H * 0.24, H * 0.42);
      this.tileH = this.tileB * this.ppb;
      this.lookB = (this.judgeY + this.tileH) / this.ppb + 0.3;
      return;
    }
    // 원근: 길(판정선까지) + 아래 건반 4개
    this.kbH = Math.max(70, H * 0.13);
    this.judgeY = H - this.kbH - Math.max(8, H * 0.015);
    this.side = Math.max(8, W * 0.04);
    this.keyW = (W - this.side * 2) / 4;
    this.VB = 3.8;
    this.lookB = this.VB;
    this.FAR = 3.4;
    this.sFar = 1 / (1 + this.FAR);
    this.topY = this.hudH + 8;
    this.horizonY = (this.topY - this.judgeY * this.sFar) / (1 - this.sFar);
    this.cx = W / 2;
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
      const { judgeY, ppb, laneW } = this;
      const gr = b.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#fffaf2');
      gr.addColorStop(0.55, '#fdf1f5');
      gr.addColorStop(1, '#f0e9ff');
      b.fillStyle = gr;
      b.fillRect(0, 0, W, H);
      const zone = b.createLinearGradient(0, judgeY - READY_B * ppb, 0, H);
      zone.addColorStop(0, 'rgba(255,190,110,0)');
      zone.addColorStop(0.55, 'rgba(255,190,110,0.12)');
      zone.addColorStop(1, 'rgba(255,160,150,0.22)');
      b.fillStyle = zone;
      b.fillRect(0, judgeY - READY_B * ppb, W, H - judgeY + READY_B * ppb);
      const div = b.createLinearGradient(0, 0, 0, H);
      div.addColorStop(0, 'rgba(150,120,190,0)');
      div.addColorStop(0.5, 'rgba(150,120,190,0.16)');
      div.addColorStop(1, 'rgba(150,120,190,0.28)');
      b.fillStyle = div;
      for (let i = 1; i < 4; i++) b.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
      b.fillStyle = 'rgba(255,190,110,0.16)';
      b.fillRect(0, judgeY - 5, W, 10);
      const line = b.createLinearGradient(0, 0, W, 0);
      line.addColorStop(0, 'rgba(255,196,92,0)');
      line.addColorStop(0.18, '#ffc45c');
      line.addColorStop(0.82, '#ff8fb8');
      line.addColorStop(1, 'rgba(255,143,184,0)');
      b.fillStyle = line;
      b.fillRect(0, judgeY - 1.5, W, 3);
      // 검은 유광 타일 한 장
      const tw = laneW - 6;
      const th = this.tileH - 4;
      const [tc, t] = mk(tw + 4, th + 8);
      const r = Math.min(12, tw * 0.14);
      t.fillStyle = 'rgba(40,20,60,0.16)';
      rr(t, 2, 5, tw, th, r);
      t.fill();
      const tg = t.createLinearGradient(0, 0, tw, th);
      tg.addColorStop(0, '#3d3854');
      tg.addColorStop(0.5, '#1d1a2a');
      tg.addColorStop(1, '#0c0a12');
      t.fillStyle = tg;
      rr(t, 0, 0, tw, th, r);
      t.fill();
      t.save();
      rr(t, 0, 0, tw, th, r);
      t.clip();
      const gl = t.createLinearGradient(0, 0, 0, th * 0.5);
      gl.addColorStop(0, 'rgba(255,255,255,0.2)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      t.fillStyle = gl;
      t.beginPath();
      t.moveTo(0, 0);
      t.lineTo(tw, 0);
      t.lineTo(tw, th * 0.22);
      t.lineTo(0, th * 0.42);
      t.closePath();
      t.fill();
      t.fillStyle = '#ffc35c';
      t.fillRect(0, th - 3, tw, 3);
      t.restore();
      const cx = tw / 2;
      const cy = th * 0.6;
      const s = Math.min(7, tw * 0.07);
      t.fillStyle = 'rgba(255,205,120,0.85)';
      t.beginPath();
      t.moveTo(cx, cy - s);
      t.lineTo(cx + s, cy);
      t.lineTo(cx, cy + s);
      t.lineTo(cx - s, cy);
      t.closePath();
      t.fill();
      this.spr.tile = { c: tc, w: tw + 4, h: th + 8 };
      // 금빛 친 타일
      const [hc, h] = mk(tw, th);
      const hg = h.createLinearGradient(0, 0, 0, th);
      hg.addColorStop(0, '#fff7e0');
      hg.addColorStop(1, '#ffc35c');
      h.fillStyle = hg;
      rr(h, 0, 0, tw, th, r);
      h.fill();
      this.spr.hit = { c: hc, w: tw, h: th };
      // 누른 줄 빛
      const [pc, p] = mk(laneW, H * 0.4 + H - judgeY);
      const pg = p.createLinearGradient(0, 0, 0, H * 0.4 + H - judgeY);
      pg.addColorStop(0, 'rgba(255,200,120,0)');
      pg.addColorStop(0.5, 'rgba(255,180,120,0.4)');
      pg.addColorStop(1, 'rgba(255,180,120,0.4)');
      p.fillStyle = pg;
      p.fillRect(0, 0, laneW, H * 0.4 + H - judgeY);
      this.spr.press = { c: pc, w: laneW, h: H * 0.4 + H - judgeY };
    } else {
      const { judgeY, side, keyW, sFar } = this;
      const gr = b.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#070918');
      gr.addColorStop(0.55, '#140f38');
      gr.addColorStop(1, '#231350');
      b.fillStyle = gr;
      b.fillRect(0, 0, W, H);
      const x0 = side;
      const x1 = W - side;
      this._trap(b, x0, x1, sFar, 1);
      const road = b.createLinearGradient(0, this.topY, 0, judgeY);
      road.addColorStop(0, 'rgba(30,24,80,0.3)');
      road.addColorStop(1, 'rgba(44,32,110,0.8)');
      b.fillStyle = road;
      b.fill();
      this._trap(b, x0, x1, this._s(READY_B), 1);
      b.fillStyle = 'rgba(160,140,255,0.1)';
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
      // 판정선
      b.fillStyle = 'rgba(180,160,255,0.22)';
      b.fillRect(side, judgeY - 6, W - side * 2, 6);
      const line = b.createLinearGradient(side, 0, W - side, 0);
      line.addColorStop(0, `hsl(${ROAD_HUE[0]},95%,70%)`);
      line.addColorStop(0.5, `hsl(${ROAD_HUE[2]},95%,72%)`);
      line.addColorStop(1, `hsl(${ROAD_HUE[3]},95%,72%)`);
      b.fillStyle = line;
      b.fillRect(side, judgeY - 2.5, W - side * 2, 2.5);
      // 무대 조명 기둥 (흔들림 없이 한 장)
      for (const sd of [0, 1]) {
        const xb = sd ? W * 0.84 : W * 0.16;
        const lg = b.createLinearGradient(0, 0, 0, judgeY);
        lg.addColorStop(0, sd ? 'rgba(255,140,220,0.14)' : 'rgba(110,200,255,0.14)');
        lg.addColorStop(1, 'rgba(140,120,255,0)');
        b.fillStyle = lg;
        b.beginPath();
        b.moveTo(xb - 12, 0);
        b.lineTo(xb + 12, 0);
        b.lineTo(xb + W * 0.2, judgeY);
        b.lineTo(xb - W * 0.2, judgeY);
        b.closePath();
        b.fill();
      }
      // 누른 줄 빛 기둥 (줄마다)
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
    if (this.view === 'road') {
      hg.addColorStop(0, 'rgba(7,9,24,0.96)');
      hg.addColorStop(1, 'rgba(7,9,24,0)');
    } else {
      hg.addColorStop(0, 'rgba(255,250,242,0.95)');
      hg.addColorStop(1, 'rgba(255,250,242,0)');
    }
    h.fillStyle = hg;
    h.fillRect(0, 0, W, this.hudH);
    this.spr.hud = hc;
    // 떠다니는 빛 방울 (한 장 그려 두고 크기만 바꿔 붙임)
    if (this.view === 'tile') {
      this.spr.bub = ['255,186,140', '196,160,255'].map((rgb) => {
        const [bc, bb] = mk(64, 64);
        const rg = bb.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, `rgba(${rgb},0.22)`);
        rg.addColorStop(1, `rgba(${rgb},0)`);
        bb.fillStyle = rg;
        bb.fillRect(0, 0, 64, 64);
        return bc;
      });
    }
  }

  /**
   * 지금 곡 시각 (부드러운 화면 시계) — 소리 시계(heardTime)는 덩어리로 움직여서 그대로 그리면 덜컹거림
   *   → performance.now 로 흘리고, 소리 시계와 차이는 매 화면 8%씩만 당김 (0.12초 넘게 벌어지면 바로 맞춤)
   */
  _clock(pn) {
    const target = this.audio.heardTime(pn) - this.startTime - this.offset;
    const ck = this._ck;
    if (!ck) {
      this._ck = { t: target, at: pn };
      return target;
    }
    if (pn <= ck.at) return ck.t + (pn - ck.at) / 1000;
    const pred = ck.t + (pn - ck.at) / 1000;
    const err = target - pred;
    const t = Math.abs(err) > 0.12 ? target : pred + err * 0.08;
    this._ck = { t, at: pn };
    return t;
  }
  /** 그 순간(터치 시각 등)의 곡 시각: 화면 시계 기준 (내가 보고 누른 것과 같게) */
  now(pn = performance.now()) {
    if (this._ck) return this._ck.t + (pn - this._ck.at) / 1000;
    return this.audio.heardTime(pn) - this.startTime - this.offset;
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
        this._press(t.clientX, t.clientY, e.timeStamp);
      } catch {}
    }
  }
  _pointer(e) {
    if (e.cancelable) e.preventDefault();
    this._press(e.clientX, e.clientY, e.timeStamp);
  }

  _laneAt(x, y) {
    if (y < this.hudH * 0.85) return -1;
    if (this.view === 'tile') return clamp(Math.floor(x / this.laneW), 0, 3);
    // 길 위를 누르면 그 높이에서 타일이 보이는 자리 → 건반 자리로 되돌려 읽음
    if (y < this.judgeY) {
      const k = this._sx(clamp((y - this.horizonY) / (this.judgeY - this.horizonY), this.sFar, 1));
      x = this.cx + (x - this.cx) / k;
    }
    return clamp(Math.floor((x - this.side) / this.keyW), 0, 3);
  }

  _press(cx, cy, ts) {
    if (this.state !== 'playing') return;
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left) * (r.width ? this.W / r.width : 1);
    const y = (cy - r.top) * (r.height ? this.H / r.height : 1);
    const pn = performance.now();
    // touchstart 와 pointerdown 이 같은 손가락으로 둘 다 오면 한 번만
    this.recent = this.recent.filter((p) => pn - p.at < 120);
    if (this.recent.some((p) => pn - p.at < 80 && Math.hypot(p.x - x, p.y - y) < 24)) return;
    this.recent.push({ x, y, at: pn });
    const lane = this._laneAt(x, y);
    if (lane < 0) return;
    const t = this.now(ts > 0 && Math.abs(pn - ts) < 300 ? ts : pn);
    const b = this.tempo.beatAt(t);
    this.taps++;
    this.press[lane] = 1;
    // 이 줄에서 칠 타일: 판정선 READY_B 박 앞까지 / 가장 먼저 칠 타일이면 NEXT_B 박 앞까지
    let first = null;
    let pick = null;
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (tl.beat - b > NEXT_B) break;
      if (tl.hit || tl.miss) continue;
      if (!first) first = tl;
      if (tl.lane !== lane) continue;
      if (tl.beat - b <= READY_B || tl === first) pick = tl;
      break;
    }
    if (pick) this._hit(pick, t, b);
    else this._wrong(lane, t, x, y);
  }

  _hit(tl, t, b) {
    tl.hit = true;
    tl.hitAt = t;
    this.score++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastHit[tl.lane] = t;
    this.comboAt = t;
    this._sound(tl);
    const cx = this._laneMid(tl.lane);
    const cy = this.view === 'tile' ? clamp(this.judgeY - (tl.beat - b) * this.ppb - this.tileH * 0.5, this.hudH + 20, this.judgeY - this.tileH * 0.5) : this.judgeY;
    const col = this.view === 'tile' ? '#ffc35c' : `hsl(${ROAD_HUE[tl.lane]},95%,72%)`;
    this.fx.rings.push({ x: cx, y: cy, at: t, color: col });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * (0.12 + 0.76 * Math.random());
      const v = 120 + Math.random() * 130;
      this.fx.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: t, life: 0.4 + Math.random() * 0.25, color: col, s: 2 + Math.random() * 2.4 });
    }
    if (this.combo % 50 === 0) this.fx.lap.push({ at: t, kind: 'combo', v: this.combo });
  }

  _wrong(lane, t, x, y) {
    // 튕김: 방금 이 줄을 쳤음 → 그냥 넘어감 (칠 타일이 있었으면 위에서 이미 쳤음)
    if (t - this.lastHit[lane] < BOUNCE_SEC) return;
    this.fx.bad.push({ lane, at: t, x, y });
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
    this.fx.hurt.push({ at: t, lane, heart: this.hearts });
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
    if (this.player) this.player.stop(0.3);
    this.player = null;
    try {
      this.audio.aww();
    } catch {}
  }

  /** 타일 하나 = 음 하나 (피아노) */
  _sound(tl) {
    const a = this.audio;
    const rt = a.ctx.currentTime;
    const sd = this.tempo.barLen(tl.absBar) / STEPS_PER_BAR;
    const dur = clamp(tl.len * sd * 0.95, 0.15, 1.6);
    try {
      if (a.piano) a.pianoNote(rt, tl.midi, dur, 0.95, a.sfxBus);
      else a.lead(rt, tl.midi, dur, a.sfxBus);
    } catch {}
  }

  result() {
    const { stars, gems } = lapStars(this.lapsDone, this.lapsDone ? 1 : Math.min(this.head, this.per) / this.per);
    return {
      songId: this.songId,
      tiles: this.score,
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
  _goneB(tl) {
    return Math.max(GONE_B, (GONE_MIN_SEC * this.tempo.bpm(tl.absBar)) / 60);
  }

  _tick(ts) {
    const pn = performance.now();
    const dt = Math.min(0.05, (pn - this.lastFrame) / 1000);
    this.lastFrame = pn;
    if (this.state === 'dying') {
      this._draw(this.diedAt, dt, true);
      if (pn - this.diedPerf > 1300) this._finish();
      return;
    }
    const t = this._clock(pn);
    const b = this.tempo.beatAt(t);
    // 지나간 타일 = 놓침 (바로 전 화면까지의 시각으로 — 폰이 버벅인 뒤 밀린 터치가 먼저 처리되게)
    const bPrev = this._bPrev ?? b;
    this._bPrev = b;
    for (let i = this.head; i < this.tiles.length && this.state === 'playing'; i++) {
      const tl = this.tiles[i];
      if (bPrev - tl.beat <= this._goneB(tl)) break;
      if (!tl.hit && !tl.miss) this._miss(tl, t);
    }
    while (this.head < this.tiles.length && (this.tiles[this.head].hit || this.tiles[this.head].miss)) this.head++;
    // 첫 바퀴: 1/3 · 2/3 지날 때 별 하나씩
    if (this.state === 'playing' && this.lapsDone === 0) {
      const st = lapStars(0, this.head / this.per).stars;
      while (this.starsNow < st) this.fx.star.push({ at: t, i: this.starsNow++ });
    }
    // 바퀴 다 돎 → (첫 바퀴면 셋째 별) · 그 뒤로 다이아 · 하트 회복
    while (this.state === 'playing' && this.head >= (this.lapsDone + 1) * this.per) {
      this.lapsDone++;
      if (this.lapsDone === 1) while (this.starsNow < 3) this.fx.star.push({ at: t, i: this.starsNow++ });
      if (this.hearts < TILE_HEARTS) {
        this.hearts++;
        this.fx.hurt.push({ at: t, heal: true, heart: this.hearts - 1 });
      }
      this.fx.lap.push({ at: t, kind: 'lap', v: this.lapsDone });
      try {
        if (this.lapsDone === 1) this.audio.fanfare();
        else this.audio.sfxFile('combo', 0.6);
      } catch {}
      if (this.onLap) this.onLap(this.lapsDone);
      if (this.lapsDone >= this.maxLaps) {
        this.state = 'dying';
        this.diedAt = t;
        this.diedPerf = performance.now();
        this.complete = true;
        if (this.player) this.player.stop(0.4);
        this.player = null;
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
    this.bNow = this.tempo.beatAt(t);
    this.shown += (this.score - this.shown) * Math.min(1, dt * 14);
    if (Math.abs(this.score - this.shown) < 0.5) this.shown = this.score;
    for (let i = 0; i < 4; i++) this.press[i] = Math.max(0, this.press[i] - dt * 6);
    this.realT = performance.now() / 1000; // 반짝임 등 (곡 시계가 멈춰도 움직임)
    const g = this.g;
    g.save();
    const hurt = this.fx.hurt.filter((h) => !h.heal).at(-1);
    const hk = hurt ? 1 - (t - hurt.at) / 0.3 : 0;
    if (hk > 0 && !frozen) g.translate(Math.sin(t * 90) * 5 * hk, 0);
    if (this.view === 'road') this._drawRoad(g, t);
    else this._drawTiles(g, t);
    this._drawFx(g, t);
    this._drawHud(g, t);
    this._drawCount(g, t);
    this._drawLapFx(g, t);
    if (frozen) this._drawDying(g);
    g.restore();
    const old = t - 1.8;
    for (const k of Object.keys(this.fx)) if (this.fx[k].length) this.fx[k] = this.fx[k].filter((f) => f.at > old);
  }

  // ======== 클래식 타일 ========
  _drawTiles(g, t) {
    const { W, H, laneW, judgeY, ppb, tileH } = this;
    const S = this.spr;
    g.drawImage(S.bg, 0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const r = (0.1 + (i % 4) * 0.04) * W;
      const x = ((i * 0.293 + 0.11) % 1) * W + Math.sin(t * 0.5 + i) * 12;
      const span = H + r * 2;
      const y = H + r - ((t * (14 + (i % 3) * 7) + i * 211) % span);
      g.drawImage(S.bub[i % 2], x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.01) continue;
      g.globalAlpha = a;
      g.drawImage(S.press.c, i * laneW, judgeY - H * 0.4, S.press.w, S.press.h);
    }
    g.globalAlpha = 1;
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.3 * a})`;
      g.fillRect(b.lane * laneW + 3, judgeY - READY_B * ppb, laneW - 6, H - judgeY + READY_B * ppb);
    }
    const h = tileH - 4;
    const first = this._firstOpen();
    for (let i = Math.max(0, this.head - 8); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.beat - this.bNow;
      if (d > this.lookB) break;
      const yB = judgeY - d * ppb;
      if (yB - h > H + 10) continue;
      const x = tl.lane * laneW + 3;
      const y = yB - h;
      if (tl.hit) {
        const k = ease((t - tl.hitAt) / 0.28);
        if (k >= 1) continue;
        g.globalAlpha = 1 - k;
        const s = 1 + 0.06 * k;
        g.drawImage(S.hit.c, x + (S.hit.w * (1 - s)) / 2, y + (S.hit.h * (1 - s)) / 2, S.hit.w * s, S.hit.h * s);
        g.globalAlpha = 1;
        continue;
      }
      if (tl.miss) {
        const fail = tl === this.failTile;
        const a = fail ? 0.55 + 0.45 * Math.sin(this.realT * 22) : 1 - ease((t - tl.missAt) / 0.7);
        if (a <= 0) continue;
        g.globalAlpha = a;
        g.fillStyle = '#ff4d6d';
        rr(g, x, y, laneW - 6, h, Math.min(12, laneW * 0.14));
        g.fill();
        g.globalAlpha = 1;
        continue;
      }
      g.drawImage(S.tile.c, x, y, S.tile.w, S.tile.h);
      if (tl === first) {
        g.strokeStyle = `rgba(255,200,110,${0.45 + 0.35 * Math.sin(this.realT * 9)})`;
        g.lineWidth = 2.5;
        rr(g, x + 1, y + 1, laneW - 8, h - 2, Math.min(12, laneW * 0.14));
        g.stroke();
      }
    }
  }

  _firstOpen() {
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (!tl.hit && !tl.miss) return tl;
    }
    return null;
  }

  // ======== 원근 (건반처럼) ========
  _drawRoad(g, t) {
    const { W, H, judgeY, side, keyW } = this;
    const S = this.spr;
    g.drawImage(S.bg, 0, 0, W, H);
    // 반짝이는 작은 별
    const span = judgeY - this.hudH;
    for (let i = 0; i < 22; i++) {
      const x = ((i * 0.618 + 0.05) % 1) * W;
      const y = this.hudH + ((((i * 0.377 + 0.1) % 1) * span - t * (6 + (i % 4) * 3) + 4000) % span);
      g.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(this.realT * (1.5 + (i % 5) * 0.4) + i));
      g.fillStyle = '#dce1ff';
      g.fillRect(x, y, 1.6, 1.6);
    }
    g.globalAlpha = 1;
    const x0 = side;
    const x1 = W - side;
    // 박마다 가로줄 (흘러오는 느낌)
    for (let k = Math.ceil(this.bNow); k < this.bNow + this.VB; k++) {
      const d = k - this.bNow;
      const s = this._s(d);
      g.fillStyle = `rgba(200,190,255,${(k % 4 === 0 ? 0.16 : 0.06) * Math.min(1, (this.VB - d) / 0.8)})`;
      g.fillRect(this._px(x0, s), this._py(s), this._px(x1, s) - this._px(x0, s), Math.max(1, 2 * s));
    }
    for (let l = 0; l < 4; l++) {
      const a = this.press[l];
      if (a < 0.01) continue;
      const c = S.col[l];
      g.globalAlpha = a;
      g.drawImage(c.c, 0, c.y, c.w, c.h);
    }
    g.globalAlpha = 1;
    const sR = this._s(READY_B);
    for (const bd of this.fx.bad) {
      const a = 1 - ease((t - bd.at) / 0.45);
      if (a <= 0) continue;
      this._trap(g, side + bd.lane * keyW, side + (bd.lane + 1) * keyW, sR, 1);
      g.fillStyle = `rgba(255,77,109,${0.35 * a})`;
      g.fill();
    }
    g.save();
    g.beginPath();
    g.rect(0, this.hudH, W, judgeY - this.hudH);
    g.clip();
    const first = this._firstOpen();
    const len = Math.min(0.55, this.tileB * 0.7); // 짧은 판 (긴 막대면 꾹 누르는 음처럼 보여서)
    for (let i = Math.max(0, this.head - 8); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      let dH = tl.beat - this.bNow;
      if (dH > this.VB) break;
      if (dH < -0.6) continue;
      let alpha = Math.min(1, (this.VB - dH) / 0.7);
      if (tl.hit) {
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
      const sH = this._s(dH);
      const sT = this._s(dT);
      const hue = ROAD_HUE[tl.lane];
      g.globalAlpha = Math.max(0, alpha);
      this._trap(g, xa - 5, xb + 5, sT, sH);
      g.fillStyle = tl.miss ? 'rgba(255,77,109,0.3)' : `hsla(${hue},95%,62%,0.22)`;
      g.fill();
      this._trap(g, xa, xb, sT, sH);
      g.fillStyle = tl.miss ? '#ff4d6d' : tl.hit ? '#fff6e6' : `hsl(${hue},90%,58%)`;
      g.fill();
      // 아래 절반은 밝게 (그라데이션 대신 겹쳐 칠함)
      if (!tl.miss && !tl.hit) {
        this._trap(g, xa, xb, (sT + sH) / 2, sH);
        g.fillStyle = `hsla(${hue},100%,80%,0.55)`;
        g.fill();
      }
      const yH = this._py(sH);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(this._px(xa, sH) + 1, yH - Math.max(2, 4 * sH), this._px(xb, sH) - this._px(xa, sH) - 2, Math.max(1.5, 3.5 * sH));
      if (tl === first) {
        this._trap(g, xa, xb, sT, sH);
        g.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(this.realT * 9)})`;
        g.lineWidth = 2;
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.restore();
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
    g.fillStyle = '#9e1430';
    g.fillRect(side - 1, top - 2, keyW * 4 + 2, 3);
  }

  // ======== 위 정보 줄 ========
  _drawHud(g, t) {
    const { W, hudH } = this;
    const road = this.view === 'road';
    g.drawImage(this.spr.hud, 0, 0, W, hudH);
    const ink = road ? '#ffffff' : '#3b2a4a';
    const outline = road ? 'rgba(7,9,24,0.9)' : '#fffaf2';
    // 바퀴 진행 줄
    const lapIdx = Math.min(this.maxLaps - 1, this.lapsDone);
    const lb0 = this.lapBeat0 + lapIdx * this.lap.beats;
    const p = clamp((this.bNow - lb0) / this.lap.beats, 0, 1);
    const px0 = 64;
    const px1 = W - 64;
    g.fillStyle = road ? 'rgba(255,255,255,0.12)' : 'rgba(59,42,74,0.1)';
    rr(g, px0, 10, px1 - px0, 7, 3.5);
    g.fill();
    g.fillStyle = this.lapsDone ? '#7fd7ff' : '#ffb84a';
    rr(g, px0, 10, Math.max(7, (px1 - px0) * p), 7, 3.5);
    g.fill();
    // 첫 바퀴: 진행 줄 위 1/3·2/3·끝 자리에 작은 별 표시
    if (!this.lapsDone) for (let i = 1; i <= 3; i++) star(g, px0 + ((px1 - px0) * i) / 3 - (i === 3 ? 6 : 0), 13.5, 6, i <= this.starsNow ? '#ffc23d' : road ? 'rgba(255,255,255,0.3)' : 'rgba(59,42,74,0.22)', null);
    // 하트
    const hs = Math.min(22, W * 0.055);
    for (let i = 0; i < TILE_HEARTS; i++) {
      const on = i < this.hearts;
      const ev = this.fx.hurt.filter((h) => h.heart === i).at(-1);
      let s = 1;
      if (ev) {
        const k = (t - ev.at) / 0.45;
        if (k >= 0 && k < 1) s = ev.heal ? 1 + 0.5 * (1 - ease(k)) : 1 + 0.35 * Math.sin(k * Math.PI);
      }
      heart(g, 16 + i * (hs + 6) + hs / 2, 30 + hs / 2, hs * s, on ? '#ff4d6d' : road ? 'rgba(255,255,255,0.18)' : 'rgba(59,42,74,0.15)');
    }
    // 점수 (친 타일 수)
    const sTxt = Math.round(this.shown).toLocaleString();
    const pop = this.comboAt != null ? 1 + 0.08 * (1 - ease((t - this.comboAt) / 0.15)) : 1;
    g.save();
    g.translate(W / 2, 22);
    g.scale(pop, pop);
    g.font = font(Math.min(50, W * 0.125));
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = outline;
    g.strokeText(sTxt, 0, 0);
    g.fillStyle = ink;
    g.fillText(sTxt, 0, 0);
    g.restore();
    // 별 3개 (첫 바퀴 동안 차오름) → 그 뒤 다이아몬드
    const sy = 22 + Math.min(54, W * 0.135) + 12;
    const ss = Math.min(14, W * 0.036);
    if (this.lapsDone < 1) {
      for (let i = 0; i < 3; i++) {
        const ev = this.fx.star.find((f) => f.i === i);
        const k = ev ? clamp((t - ev.at) / 0.4, 0, 1) : 1;
        const on = i < this.starsNow;
        const sc = on && k < 1 ? 1 + 0.6 * Math.sin(k * Math.PI) : 1;
        star(g, W / 2 + (i - 1) * (ss * 2.4), sy, ss * sc, on ? '#ffc23d' : road ? 'rgba(255,255,255,0.16)' : 'rgba(59,42,74,0.14)', on ? '#e08a00' : null);
      }
    } else {
      const gems = this.lapsDone - 1;
      for (let i = 0; i < 3; i++) star(g, W / 2 - ss * 3.4 + i * ss * 1.5, sy, ss * 0.62, '#ffc23d', null);
      gem(g, W / 2 + ss * 0.9, sy, ss * 1.05);
      g.font = font(ss * 1.5);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = road ? '#bfeaff' : '#2a7fb8';
      g.fillText(`×${gems}`, W / 2 + ss * 2.1, sy + 1);
    }
    if (this.combo >= 10 && !this.vs) {
      g.font = font(Math.min(16, W * 0.04));
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillStyle = road ? 'rgba(255,255,255,0.75)' : 'rgba(59,42,74,0.6)';
      g.fillText(`${this.combo} 연속`, W / 2, sy + ss * 1.6);
    }
    if (this.vs) this._drawVs(g, sy + ss * 1.8, road);
  }

  /** ⚔️ 대결: 나 vs 상대 막대 */
  _drawVs(g, y, road) {
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
    g.fillStyle = road ? '#fff' : '#3b2a4a';
    g.textAlign = 'left';
    g.fillText(`나 ${mine}`, x0, y + 11);
    g.textAlign = 'right';
    const nm = (this.vs.name || '상대').slice(0, 8);
    g.fillText(o && o.done ? `${nm} ${theirs} (끝)` : `${nm} ${theirs}${o && o.lives != null ? ' · ♥' + o.lives : ''}`, x1, y + 11);
  }

  // ======== 효과 ========
  _drawFx(g, t) {
    for (const r of this.fx.rings) {
      const k = (t - r.at) / 0.38;
      if (k < 0 || k > 1) continue;
      const e = ease(k);
      g.globalAlpha = (1 - e) * 0.85;
      g.strokeStyle = r.color;
      g.lineWidth = 4 * (1 - e) + 1;
      const R = (this.view === 'tile' ? this.laneW : this.keyW) * 0.3 * (0.5 + e * 1.1);
      g.beginPath();
      g.ellipse(r.x, r.y, R, R * (this.view === 'tile' ? 0.8 : 0.42), 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of this.fx.parts) {
      const d = t - p.at;
      if (d < 0 || d > p.life) continue;
      const k = d / p.life;
      g.globalAlpha = (1 - ease(k)) * 0.9;
      g.fillStyle = p.color;
      const s = p.s * (1 - k * 0.4);
      g.fillRect(p.x + p.vx * d - s, p.y + p.vy * d + 160 * d * d - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    // 하트를 잃음: 화면 가장자리 빨갛게 (가장자리 띠 네 개 — 원형 그라데이션은 무거워서)
    const hurt = this.fx.hurt.filter((h) => !h.heal).at(-1);
    if (hurt) {
      const a = 1 - ease((t - hurt.at) / 0.5);
      if (a > 0) {
        const { W, H } = this;
        const e = Math.min(W, H) * 0.06;
        g.fillStyle = `rgba(255,40,80,${0.35 * a})`;
        g.fillRect(0, 0, W, e);
        g.fillRect(0, H - e, W, e);
        g.fillRect(0, e, e, H - 2 * e);
        g.fillRect(W - e, e, e, H - 2 * e);
      }
    }
  }

  /** 별이 찰 때 · 바퀴를 돎(별 3개 완성 / 다이아) · 50연속 */
  _drawLapFx(g, t) {
    const { W, H } = this;
    const cy = H * 0.36;
    for (const f of this.fx.lap) {
      const k = (t - f.at) / 1.4;
      if (k < 0 || k > 1) continue;
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      g.save();
      g.globalAlpha = a;
      if (f.kind === 'combo') {
        g.font = font(Math.min(34, W * 0.085));
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 6;
        g.strokeStyle = this.view === 'road' ? 'rgba(7,9,24,0.9)' : '#fff';
        g.strokeText(`${f.v} 연속!`, W / 2, cy + 60 - k * 30);
        g.fillStyle = '#ff5fa2';
        g.fillText(`${f.v} 연속!`, W / 2, cy + 60 - k * 30);
        g.restore();
        continue;
      }
      const s = 0.7 + 0.45 * ease(k / 0.25);
      g.translate(W / 2, cy);
      g.scale(s, s);
      const big = Math.min(46, W * 0.115);
      if (f.v === 1) {
        for (let i = 0; i < 3; i++) star(g, (i - 1) * big * 1.25, -(i === 1 ? big * 0.25 : 0), big * 0.55, '#ffc23d', '#e08a00');
      } else {
        gem(g, 0, 0, big * 0.75);
      }
      g.font = font(Math.min(28, W * 0.07));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 6;
      const msg = f.v >= this.maxLaps ? (this.vs ? '완주!' : '전부 완주!') : f.v === 1 ? '별 3개 완성!' : `다이아 ${f.v - 1}개!`;
      g.strokeStyle = this.view === 'road' ? 'rgba(7,9,24,0.9)' : '#fff';
      g.strokeText(msg, 0, big * 0.95);
      g.fillStyle = f.v === 1 ? '#ff9a3d' : '#3aa8e8';
      g.fillText(msg, 0, big * 0.95);
      g.restore();
      if (!f.sp) f.sp = Array.from({ length: 22 }, () => ({ a: Math.random() * Math.PI * 2, v: 120 + Math.random() * 220, s: 2 + Math.random() * 3, c: Math.random() < 0.5 ? (f.v === 1 ? '#ffd36b' : '#9be6ff') : '#ff8fc4' }));
      const d = (t - f.at) * 0.9;
      g.globalAlpha = Math.max(0, 1 - k * 1.3);
      for (const p of f.sp) {
        g.fillStyle = p.c;
        g.fillRect(W / 2 + Math.cos(p.a) * p.v * d - p.s, cy + Math.sin(p.a) * p.v * d + 120 * d * d - p.s, p.s * 2, p.s * 2);
      }
      g.globalAlpha = 1;
    }
  }

  _drawDying(g) {
    const { W, H } = this;
    const k = clamp((performance.now() - this.diedPerf) / 600, 0, 1);
    g.fillStyle = this.complete ? `rgba(255,250,240,${0.25 * k})` : `rgba(30,10,30,${0.35 * k})`;
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

  /** 3 · 2 · 1 (처음과 이어 하기) */
  _drawCount(g, t) {
    const beat = 60 / this.tempo.bpm(0);
    const first = this.resumeAt != null ? this.resumeAt : this.tiles.length ? this.tiles[0].t : 0;
    const left = first - t;
    // ⚔️ 대결: 같이 시작하기 전까지 'VS 상대' + 남은 초
    if (this.vs && this.resumeAt == null && left > beat * 3.2) {
      const { W, H } = this;
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
      g.fillText(`${Math.ceil(left - beat * 3)}초 뒤 같이 시작!`, W / 2, H * 0.5);
      g.restore();
      return;
    }
    if (left <= 0.05 || left > beat * 3.2 + (this.resumeAt != null ? 0.6 : 0)) {
      if (left <= 0.05) this.resumeAt = null;
      return;
    }
    const k = Math.min(3, Math.ceil((left / (beat * 3)) * 3 - 0.001));
    const frac = (left / (beat * 3)) * 3 - (k - 1);
    const s = 0.85 + 0.25 * ease((1 - frac) * 3);
    const cx = this.W / 2;
    const cy = this.H * 0.42;
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
/** 💎 다이아몬드 (이모지 대신 직접 그림): 윗면·옆면 조각 + 반짝임 */
export function gem(g, cx, cy, r) {
  const top = cy - r * 0.62;
  const mid = cy - r * 0.12;
  const bot = cy + r * 0.9;
  const xw = r * 1.05;
  const xi = r * 0.45;
  // 아래 큰 조각
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
  // 윗면
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
  // 테두리
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx, bot);
  g.lineTo(cx - xw, mid);
  g.closePath();
  g.strokeStyle = '#1d6fa3';
  g.lineWidth = Math.max(1, r * 0.08);
  g.lineJoin = 'round';
  g.stroke();
  // 반짝
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx - r * 0.35, top + r * 0.2, r * 0.1, 0, Math.PI * 2);
  g.fill();
}
