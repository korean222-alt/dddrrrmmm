// 🎹 시즌 2 피아노 타일 게임 (2026-11-26)
//   보기 두 가지 (설정 「타일 보기」, 판정은 똑같음 — 랭킹 같이 씀):
//     'tile' : 클래식 — 밝은 바닥에 검은 타일 4줄이 내려옴
//     'road' : 원근 — 건반 모드처럼 어두운 무대의 길 위로 멀리서부터 빛 타일이 다가오고, 아래 건반 4개를 누름 (더 멀리까지 보임)
//   규칙: 아래쪽에 온 타일(판정선 READY_B 박 앞부터, 가장 먼저 칠 타일은 NEXT_B 박 앞부터)을 그 줄에서 누르면 됨 — 판정 글자 없음
//         놓침(화면 밖으로 지나감)·빈 줄 누름 = 하트 하나, 바퀴를 돌면 하트 하나 회복, 하트 0 이면 끝
//   🖐 터치 씹힘 대비 (CLAUDE.md 터치 씹힘 1~4차):
//     · touchstart 로 받고, pointerdown 도 받아서 같은 자리(24px)·80ms 안이면 한 번만 (폰마다 한쪽만 올 때가 있어서)
//     · touchmove 로는 절대 새 터치를 만들지 않음 (가짜 터치의 원인이었음)
//     · 방금 친 줄을 0.12초 안에 또 누른 '튕김'은 무시 (그 줄에 칠 타일이 있으면 그대로 침 — 이득 없음)
//     · 하트를 잃은 뒤 0.35초는 빈 줄 누름으로 또 깎지 않음 (한 번의 실수가 줄줄이 깎이지 않게)

import { STEPS_PER_BAR, COUNT_IN_BARS, pianoHarmony } from './charts.js';
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
   * @param {{ audio, canvas, songId:number, view?:'tile'|'road', offsetMs?:number, onEnd:(r)=>void, onLap?:(laps:number)=>void }} o
   */
  constructor({ audio, canvas, songId, view = 'tile', offsetMs = 0, onEnd, onLap }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.songId = songId;
    this.view = view === 'road' ? 'road' : 'tile';
    this.offset = (offsetMs || 0) / 1000;
    this.onEnd = onEnd;
    this.onLap = onLap;
    this.lap = tileLap(songId);
    this.level = tileLevel(songId);
    this.tempo = this.level.tempo;
    this.per = this.lap.tiles.length;
    const mir = lapMirrors(this.lap);
    this.tiles = [];
    for (let k = 0; k < MAX_LAPS; k++) {
      for (const t of this.lap.tiles) {
        const abs = COUNT_IN_BARS * STEPS_PER_BAR + k * this.lap.bars * STEPS_PER_BAR + t.step;
        this.tiles.push({ k, beat: abs / 4, t: this.tempo.stepTime(abs), lane: mir[k] ? 3 - t.lane : t.lane, notes: t.notes, midi: t.midi, bar: t.bar, s: t.s, len: t.len, absBar: Math.floor(abs / STEPS_PER_BAR) });
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
    this.head = 0;
    this.lastHit = [-9, -9, -9, -9];
    this.lastHurt = -9;
    this.press = new Float32Array(4);
    this.fx = { rings: [], parts: [], bad: [], lap: [], hurt: [], notes: [] };
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
  start() {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('touchstart', this._onTouch, { passive: false });
    // 아이폰: 꾹 누르면 뜨는 돋보기·글자 고르기 막기 (touchmove 로는 아무것도 안 함)
    for (const ev of ['touchmove', 'touchend', 'touchcancel']) c.addEventListener(ev, this._noop, { passive: false });
    c.addEventListener('pointerdown', this._onPointer);
    this._play(this.audio.ctx.currentTime + 0.35);
  }

  _play(startTime) {
    this.startTime = startTime;
    this.player = new SongPlayer(this.audio, this.level, startTime);
    this.player.start();
    this.state = 'playing';
    this.lastFrame = performance.now();
    const loop = () => {
      if (this.state !== 'playing' && this.state !== 'dying') return;
      this._tick();
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
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._bg = null;
    this._layout();
    if (this.state === 'paused') this._draw(this.pausedAt, 0);
  }

  _layout() {
    const { W, H } = this;
    this.hudH = Math.max(84, H * 0.13);
    if (this.view === 'tile') {
      this.laneW = W / 4;
      this.judgeY = H * 0.8;
      this.ppb = clamp((H * 0.2) / this.tileB, H * 0.2, H * 0.36);
      this.tileH = this.tileB * this.ppb;
      this.lookB = (this.judgeY + this.tileH) / this.ppb + 0.3;
      return;
    }
    // 원근: 길(판정선까지) + 아래 건반 4개
    this.kbH = Math.max(70, H * 0.13);
    this.judgeY = H - this.kbH - Math.max(8, H * 0.015);
    this.side = Math.max(8, W * 0.04);
    this.keyW = (W - this.side * 2) / 4;
    this.VB = 4.6;
    this.lookB = this.VB;
    this.FAR = 3.4;
    this.sFar = 1 / (1 + this.FAR);
    this.topY = this.hudH + 8;
    this.horizonY = (this.topY - this.judgeY * this.sFar) / (1 - this.sFar);
    this.cx = W / 2;
  }

  /** 지금 곡 시각 (귀에 들리는 소리 기준) */
  now(perfMs = performance.now()) {
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
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
  _laneX0(l) {
    return this.view === 'tile' ? l * this.laneW : this.side + l * this.keyW;
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
    const sx = r.width ? this.W / r.width : 1;
    const sy = r.height ? this.H / r.height : 1;
    const x = (cx - r.left) * sx;
    const y = (cy - r.top) * sy;
    const pn = performance.now();
    // touchstart 와 pointerdown 이 같은 손가락으로 둘 다 오면 한 번만
    this.recent = this.recent.filter((p) => pn - p.at < 120);
    if (this.recent.some((p) => pn - p.at < 80 && Math.hypot(p.x - x, p.y - y) < 24)) return;
    this.recent.push({ x, y, at: pn });
    const lane = this._laneAt(x, y);
    if (lane < 0) return;
    const tms = ts > 0 && Math.abs(pn - ts) < 300 ? ts : pn;
    const t = this.now(tms);
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
    if (pick) this._hit(pick, t, x, y);
    else this._wrong(lane, t, x, y);
  }

  _hit(tl, t, x, y) {
    tl.hit = true;
    tl.hitAt = t;
    this.score++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastHit[tl.lane] = t;
    this.comboAt = t;
    this._sound(tl);
    const cx = this._laneMid(tl.lane);
    const cy = this.view === 'tile' ? Math.min(this.judgeY - this.tileH * 0.5, Math.max(this.hudH + 20, this.judgeY - (tl.beat - this.tempo.beatAt(t)) * this.ppb - this.tileH * 0.5)) : this.judgeY;
    const col = this.view === 'tile' ? '#ffc35c' : `hsl(${ROAD_HUE[tl.lane]},95%,72%)`;
    this.fx.rings.push({ x: cx, y: cy, at: t, color: col });
    for (let i = 0; i < 7; i++) {
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
      this.audio.pianoOr('lead', this.audio.ctx.currentTime, 40, 0.25, this.audio.sfxBus, 0.5);
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

  _sound(tl) {
    const a = this.audio;
    const rt = a.ctx.currentTime;
    const sd = this.tempo.barLen(tl.absBar) / STEPS_PER_BAR;
    try {
      for (const n of tl.notes) {
        const dur = clamp(n.len * sd * 0.95, 0.14, 1.6);
        if (a.piano) a.pianoNote(rt + n.d * sd, n.midi, dur, n.d ? 0.78 : 0.95, a.sfxBus);
        else a.lead(rt + n.d * sd, n.midi, dur, a.sfxBus);
      }
      const dur0 = clamp(tl.len * sd * 0.95, 0.2, 1.6);
      for (const h of pianoHarmony(this.level.song, tl.bar, tl.s, tl.midi, tl.len >= 4)) a.pianoOr('lead', rt, h, dur0, a.sfxBus, 0.45);
    } catch {}
  }

  result() {
    const { stars, crowns } = lapStars(this.lapsDone);
    return {
      songId: this.songId,
      tiles: this.score,
      laps: this.lapsDone,
      stars,
      crowns,
      maxCombo: this.maxCombo,
      missed: this.missed,
      wrong: this.wrong,
      per: this.per,
      complete: this.lapsDone >= MAX_LAPS,
      topSpeed: lapSpeed(Math.max(0, Math.min(MAX_LAPS - 1, this.lapsDone))),
      view: this.view,
    };
  }

  // ---------- 매 화면 ----------
  _goneB(tl) {
    return Math.max(GONE_B, (GONE_MIN_SEC * this.tempo.bpm(tl.absBar)) / 60);
  }

  _tick() {
    const pn = performance.now();
    const dt = Math.min(0.05, (pn - this.lastFrame) / 1000);
    this.lastFrame = pn;
    const t = this.now(pn);
    if (this.state === 'dying') {
      this._draw(this.diedAt, dt, true);
      if (pn - this.diedPerf > 1300) this._finish();
      return;
    }
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
    // 바퀴 다 돎 → 별, 하트 회복
    while (this.state === 'playing' && this.head >= (this.lapsDone + 1) * this.per) {
      this.lapsDone++;
      if (this.hearts < TILE_HEARTS) {
        this.hearts++;
        this.fx.hurt.push({ at: t, heal: true, heart: this.hearts - 1 });
      }
      this.fx.lap.push({ at: t, kind: 'lap', v: this.lapsDone });
      try {
        if (this.lapsDone <= 3) this.audio.fanfare();
        else this.audio.sfxFile('combo', 0.6);
      } catch {}
      if (this.onLap) this.onLap(this.lapsDone);
      if (this.lapsDone >= MAX_LAPS) {
        this.state = 'dying';
        this.diedAt = t;
        this.diedPerf = performance.now();
        this.complete = true;
        if (this.player) this.player.stop(0.4);
        this.player = null;
      }
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
    const g = this.g;
    g.save();
    // 하트를 잃으면 화면이 살짝 흔들림
    const hurt = this.fx.hurt.filter((h) => !h.heal).at(-1);
    const hk = hurt ? 1 - (t - hurt.at) / 0.3 : 0;
    if (hk > 0 && !frozen) g.translate(Math.sin(t * 90) * 5 * hk, 0);
    if (this.view === 'road') this._drawRoad(g, t, frozen);
    else this._drawTiles(g, t, frozen);
    this._drawFx(g, t);
    this._drawHud(g, t, frozen);
    this._drawCount(g, t);
    this._drawLapFx(g, t);
    if (frozen) this._drawDying(g, t);
    g.restore();
    const old = t - 1.6;
    for (const k of Object.keys(this.fx)) this.fx[k] = this.fx[k].filter((f) => f.at > old);
  }

  // ======== 클래식 타일 ========
  _tileBg(g) {
    const { W, H, judgeY } = this;
    if (!this._bg) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#fffaf2');
      bg.addColorStop(0.55, '#fdf1f5');
      bg.addColorStop(1, '#f0e9ff');
      const zone = g.createLinearGradient(0, judgeY - READY_B * this.ppb, 0, H);
      zone.addColorStop(0, 'rgba(255,190,110,0)');
      zone.addColorStop(0.55, 'rgba(255,190,110,0.12)');
      zone.addColorStop(1, 'rgba(255,160,150,0.22)');
      const line = g.createLinearGradient(0, 0, W, 0);
      line.addColorStop(0, 'rgba(255,196,92,0)');
      line.addColorStop(0.18, '#ffc45c');
      line.addColorStop(0.82, '#ff8fb8');
      line.addColorStop(1, 'rgba(255,143,184,0)');
      const div = g.createLinearGradient(0, 0, 0, H);
      div.addColorStop(0, 'rgba(150,120,190,0)');
      div.addColorStop(0.5, 'rgba(150,120,190,0.16)');
      div.addColorStop(1, 'rgba(150,120,190,0.28)');
      this._bg = { bg, zone, line, div };
    }
    return this._bg;
  }

  _drawTiles(g, t, frozen) {
    const { W, H, laneW, judgeY, ppb, tileH } = this;
    const C = this._tileBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      const r = (0.08 + (i % 4) * 0.035) * W;
      const x = ((i * 0.293 + 0.11) % 1) * W + Math.sin(t * 0.5 + i) * 12;
      const span = H + r * 2;
      const y = H + r - ((t * (14 + (i % 3) * 7) + i * 211) % span);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const hue = i % 2 ? '255,186,140' : '196,160,255';
      gr.addColorStop(0, `rgba(${hue},0.2)`);
      gr.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = C.zone;
    g.fillRect(0, judgeY - READY_B * ppb, W, H - judgeY + READY_B * ppb);
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.01) continue;
      const gr = g.createLinearGradient(0, judgeY - H * 0.4, 0, H);
      gr.addColorStop(0, 'rgba(255,200,120,0)');
      gr.addColorStop(1, `rgba(255,180,120,${0.4 * a})`);
      g.fillStyle = gr;
      g.fillRect(i * laneW, judgeY - H * 0.4, laneW, H * 0.4 + H - judgeY);
    }
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.32 * a})`;
      rr(g, b.lane * laneW + 3, judgeY - READY_B * ppb, laneW - 6, H - judgeY + READY_B * ppb - 4, 14);
      g.fill();
    }
    g.fillStyle = C.div;
    for (let i = 1; i < 4; i++) g.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    const gap = 4;
    const h = tileH - gap;
    const first = this._firstOpen();
    for (let i = Math.max(0, this.head - 8); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.beat - this.bNow;
      if (d > this.lookB) break;
      const yB = judgeY - d * ppb;
      if (yB - h > H + 10) continue;
      if (tl.hit && t - tl.hitAt > 0.3) continue;
      if (tl.miss && t - tl.missAt > 0.7 && tl !== this.failTile) continue;
      this._tile(g, tl, tl.lane * laneW + 3, yB - h, laneW - 6, h, t, tl === first);
    }
    g.fillStyle = 'rgba(255,190,110,0.16)';
    g.fillRect(0, judgeY - 5, W, 10);
    g.fillStyle = C.line;
    g.fillRect(0, judgeY - 1.5, W, 3);
  }

  _firstOpen() {
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (!tl.hit && !tl.miss) return tl;
    }
    return null;
  }

  _tile(g, tl, x, y, w, h, t, isFirst) {
    const r = Math.min(12, w * 0.14);
    if (tl.miss) {
      const blink = tl === this.failTile ? 0.55 + 0.45 * Math.sin(t * 22) : 1 - ease((t - tl.missAt) / 0.7);
      g.globalAlpha = Math.max(0, blink);
      g.fillStyle = '#ff4d6d';
      rr(g, x, y, w, h, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    if (tl.hit) {
      const k = ease((t - tl.hitAt) / 0.3);
      const sx = -w * 0.06 * k;
      const sy = -h * 0.06 * k;
      g.globalAlpha = 1 - k;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#fff7e0');
      gr.addColorStop(1, '#ffc35c');
      g.fillStyle = gr;
      rr(g, x + sx, y + sy, w - sx * 2, h - sy * 2, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = 'rgba(40,20,60,0.16)';
    rr(g, x + 2, y + 5, w, h, r);
    g.fill();
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#3d3854');
    gr.addColorStop(0.5, '#1d1a2a');
    gr.addColorStop(1, '#0c0a12');
    g.fillStyle = gr;
    rr(g, x, y, w, h, r);
    g.fill();
    g.save();
    rr(g, x, y, w, h, r);
    g.clip();
    const gl = g.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,0.2)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h * 0.22);
    g.lineTo(x, y + h * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffc35c';
    g.fillRect(x, y + h - 3, w, 3);
    g.restore();
    // 가장 먼저 칠 타일: 금빛 테두리가 살짝 숨 쉼
    if (isFirst) {
      g.strokeStyle = `rgba(255,200,110,${0.45 + 0.35 * Math.sin(t * 9)})`;
      g.lineWidth = 2.5;
      rr(g, x + 1, y + 1, w - 2, h - 2, r);
      g.stroke();
    }
    const cx = x + w / 2;
    const cy = y + h * 0.6;
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

  // ======== 원근 (건반처럼) ========
  _roadBg(g) {
    const { W, H, judgeY } = this;
    if (!this._bg) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#070918');
      bg.addColorStop(0.55, '#140f38');
      bg.addColorStop(1, '#231350');
      const road = g.createLinearGradient(0, this.topY, 0, judgeY);
      road.addColorStop(0, 'rgba(30,24,80,0.3)');
      road.addColorStop(1, 'rgba(44,32,110,0.8)');
      const line = g.createLinearGradient(this.side, 0, W - this.side, 0);
      line.addColorStop(0, `hsl(${ROAD_HUE[0]},95%,70%)`);
      line.addColorStop(0.5, `hsl(${ROAD_HUE[2]},95%,72%)`);
      line.addColorStop(1, `hsl(${ROAD_HUE[3]},95%,72%)`);
      this._bg = { bg, road, line };
    }
    return this._bg;
  }

  _drawRoad(g, t, frozen) {
    const { W, H, judgeY, side, keyW } = this;
    const C = this._roadBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    for (const sd of [0, 1]) {
      const sw = Math.sin(t * 0.45 + sd * 2) * W * 0.08;
      const x0 = sd ? W * 0.84 : W * 0.16;
      const gr = g.createLinearGradient(0, 0, 0, judgeY);
      gr.addColorStop(0, sd ? 'rgba(255,140,220,0.16)' : 'rgba(110,200,255,0.16)');
      gr.addColorStop(1, 'rgba(140,120,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0 - 12, 0);
      g.lineTo(x0 + 12, 0);
      g.lineTo(x0 + sw + W * 0.2, judgeY);
      g.lineTo(x0 + sw - W * 0.2, judgeY);
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      const x = ((i * 0.618 + 0.05) % 1) * W;
      const span = judgeY - this.hudH;
      const y = this.hudH + ((((i * 0.377 + 0.1) % 1) * span - t * (6 + (i % 4) * 3) + 4000) % span);
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1.5 + (i % 5) * 0.4) + i));
      g.fillStyle = `rgba(220,225,255,${a})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    const x0 = side;
    const x1 = W - side;
    const sF = this.sFar;
    this._trap(g, x0, x1, sF, 1);
    g.fillStyle = C.road;
    g.fill();
    // 누를 수 있는 곳 (판정선 READY_B 박 앞까지) 살짝 밝게
    const sR = this._s(READY_B);
    this._trap(g, x0, x1, sR, 1);
    g.fillStyle = 'rgba(160,140,255,0.1)';
    g.fill();
    for (let l = 1; l < 4; l++) {
      const x = side + l * keyW;
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(this._px(x, sF), this._py(sF));
      g.lineTo(x, judgeY);
      g.stroke();
    }
    for (let k = Math.ceil(this.bNow); k < this.bNow + this.VB; k++) {
      const d = k - this.bNow;
      const s = this._s(d);
      const y = this._py(s);
      g.fillStyle = `rgba(200,190,255,${(k % 4 === 0 ? 0.16 : 0.06) * Math.min(1, (this.VB - d) / 0.8)})`;
      g.fillRect(this._px(x0, s), y, this._px(x1, s) - this._px(x0, s), Math.max(1, 2 * s));
    }
    for (const [x, hue] of [
      [x0, ROAD_HUE[0]],
      [x1, ROAD_HUE[3]],
    ]) {
      g.strokeStyle = `hsla(${hue},95%,70%,0.8)`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(this._px(x, sF), this._py(sF));
      g.lineTo(x, judgeY);
      g.stroke();
    }
    // 누른 줄 빛 기둥
    for (let l = 0; l < 4; l++) {
      const a = this.press[l];
      if (a < 0.01) continue;
      const sTop = this._s(this.VB * 0.5);
      const gr = g.createLinearGradient(0, this._py(sTop), 0, judgeY);
      gr.addColorStop(0, `hsla(${ROAD_HUE[l]},95%,65%,0)`);
      gr.addColorStop(1, `hsla(${ROAD_HUE[l]},95%,65%,${0.45 * a})`);
      this._trap(g, side + l * keyW, side + (l + 1) * keyW, sTop, 1);
      g.fillStyle = gr;
      g.fill();
    }
    for (const bd of this.fx.bad) {
      const a = 1 - ease((t - bd.at) / 0.45);
      if (a <= 0) continue;
      this._trap(g, side + bd.lane * keyW, side + (bd.lane + 1) * keyW, sR, 1);
      g.fillStyle = `rgba(255,77,109,${0.35 * a})`;
      g.fill();
    }
    // 다가오는 빛 타일
    g.save();
    g.beginPath();
    g.rect(0, this.hudH, W, judgeY - this.hudH);
    g.clip();
    const first = this._firstOpen();
    for (let i = Math.max(0, this.head - 8); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      let dH = tl.beat - this.bNow;
      if (dH > this.VB) break;
      if (tl.hit && t - tl.hitAt > 0.25) continue;
      if (tl.miss && t - tl.missAt > 0.5 && tl !== this.failTile) continue;
      if (dH < -0.6) continue;
      const dT = Math.min(this.VB, dH + Math.min(0.55, this.tileB * 0.7)); // 짧은 판 (긴 막대면 꾹 누르는 음처럼 보여서)
      if (tl.hit) dH = Math.max(0, dH);
      if (dT <= dH) continue;
      const pad = keyW * 0.08;
      const xa = side + tl.lane * keyW + pad;
      const xb = side + (tl.lane + 1) * keyW - pad;
      const sH = this._s(dH);
      const sT = this._s(dT);
      const far = Math.min(1, (this.VB - dH) / 0.7);
      const hue = ROAD_HUE[tl.lane];
      let alpha = far;
      if (tl.hit) alpha *= 1 - ease((t - tl.hitAt) / 0.25);
      if (tl.miss) alpha *= tl === this.failTile ? 0.6 + 0.4 * Math.sin(t * 22) : 1 - ease((t - tl.missAt) / 0.5);
      g.globalAlpha = Math.max(0, alpha);
      const yT = this._py(sT);
      const yH = this._py(sH);
      // 바깥 빛
      this._trap(g, xa - 5, xb + 5, sT, sH);
      g.fillStyle = tl.miss ? 'rgba(255,77,109,0.3)' : `hsla(${hue},95%,62%,0.22)`;
      g.fill();
      const gr = g.createLinearGradient(0, yT, 0, yH);
      if (tl.miss) {
        gr.addColorStop(0, '#a3203a');
        gr.addColorStop(1, '#ff4d6d');
      } else if (tl.hit) {
        gr.addColorStop(0, '#fff3d6');
        gr.addColorStop(1, '#ffffff');
      } else {
        gr.addColorStop(0, `hsla(${hue},80%,40%,0.9)`);
        gr.addColorStop(1, `hsl(${hue},95%,70%)`);
      }
      this._trap(g, xa, xb, sT, sH);
      g.fillStyle = gr;
      g.fill();
      const mw = (xb - xa) * 0.12;
      const mx = (xa + xb) / 2;
      this._trap(g, mx - mw, mx + mw, sT, sH);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillRect(this._px(xa, sH) + 1, yH - Math.max(2, 4 * sH), this._px(xb, sH) - this._px(xa, sH) - 2, Math.max(1.5, 3.5 * sH));
      if (tl === first && !tl.hit && !tl.miss) {
        this._trap(g, xa, xb, sT, sH);
        g.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(t * 9)})`;
        g.lineWidth = 2;
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    g.restore();
    // 판정선 + 건반 4개
    g.fillStyle = 'rgba(180,160,255,0.22)';
    g.fillRect(side, judgeY - 6, W - side * 2, 6);
    g.fillStyle = C.line;
    g.fillRect(side, judgeY - 2.5, W - side * 2, 2.5);
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
      const gr = g.createLinearGradient(0, top + dy, 0, top + dy + kh - 6);
      gr.addColorStop(0, '#dcd8e6');
      gr.addColorStop(0.15, '#fbfaff');
      gr.addColorStop(1, '#ecebf4');
      g.fillStyle = gr;
      rr(g, x, top + dy, w, kh - 6, 9);
      g.fill();
      if (p > 0.02) {
        const tg = g.createLinearGradient(0, top, 0, top + kh);
        tg.addColorStop(0, `hsla(${ROAD_HUE[l]},95%,65%,${0.75 * p})`);
        tg.addColorStop(1, `hsla(${ROAD_HUE[l]},95%,80%,${0.2 * p})`);
        g.fillStyle = tg;
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
  _drawHud(g, t, frozen) {
    const { W, hudH } = this;
    const road = this.view === 'road';
    const bg = g.createLinearGradient(0, 0, 0, hudH);
    if (road) {
      bg.addColorStop(0, 'rgba(7,9,24,0.96)');
      bg.addColorStop(1, 'rgba(7,9,24,0)');
    } else {
      bg.addColorStop(0, 'rgba(255,250,242,0.95)');
      bg.addColorStop(1, 'rgba(255,250,242,0)');
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, W, hudH);
    const ink = road ? '#ffffff' : '#3b2a4a';
    const outline = road ? 'rgba(7,9,24,0.9)' : '#fffaf2';
    // 바퀴 진행 줄 (끝에 별)
    const lapIdx = Math.min(MAX_LAPS - 1, this.lapsDone);
    const lb0 = this.lapBeat0 + lapIdx * this.lap.beats;
    const p = clamp((this.bNow - lb0) / this.lap.beats, 0, 1);
    const px0 = 64;
    const px1 = W - 64;
    g.fillStyle = road ? 'rgba(255,255,255,0.12)' : 'rgba(59,42,74,0.1)';
    rr(g, px0, 10, px1 - px0, 7, 3.5);
    g.fill();
    const pg = g.createLinearGradient(px0, 0, px1, 0);
    pg.addColorStop(0, '#ffc45c');
    pg.addColorStop(1, '#ff6fae');
    g.fillStyle = pg;
    rr(g, px0, 10, Math.max(7, (px1 - px0) * p), 7, 3.5);
    g.fill();
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
    // 빠르기
    const sp = lapSpeed(lapIdx);
    if (sp > 1.001) {
      g.font = font(Math.min(15, W * 0.038));
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillStyle = road ? '#ffd36b' : '#ff7a2e';
      g.fillText(`⚡ ×${sp.toFixed(2)}`, 16, 34 + hs);
    }
    // 점수 (친 타일 수)
    const sTxt = Math.round(this.shown).toLocaleString();
    const pop = this.comboAt != null ? 1 + 0.08 * (1 - ease((t - this.comboAt) / 0.15)) : 1;
    g.save();
    g.translate(W / 2, 24);
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
    // 별 3개 + 왕관
    const { stars, crowns } = lapStars(this.lapsDone);
    const sy = 24 + Math.min(54, W * 0.135);
    const ss = Math.min(15, W * 0.038);
    for (let i = 0; i < 3; i++) star(g, W / 2 + (i - 1) * (ss * 2.3), sy + ss, ss, i < stars ? '#ffc23d' : road ? 'rgba(255,255,255,0.16)' : 'rgba(59,42,74,0.14)', i < stars ? '#e08a00' : null);
    if (crowns > 0) {
      g.font = font(ss * 1.3);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillStyle = road ? '#ffd36b' : '#c77a00';
      g.fillText(`👑${crowns > 1 ? '×' + crowns : ''}`, W / 2 + ss * 3.7, sy + ss);
    }
    if (this.combo >= 10) {
      g.font = font(Math.min(16, W * 0.04));
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillStyle = road ? 'rgba(255,255,255,0.75)' : 'rgba(59,42,74,0.6)';
      g.fillText(`${this.combo} 연속`, W / 2, sy + ss * 2.4);
    }
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
      g.beginPath();
      g.arc(p.x + p.vx * d, p.y + p.vy * d + 160 * d * d, p.s * (1 - k * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 하트를 잃음: 화면 가장자리 빨갛게
    const hurt = this.fx.hurt.filter((h) => !h.heal).at(-1);
    if (hurt) {
      const a = 1 - ease((t - hurt.at) / 0.5);
      if (a > 0) {
        const { W, H } = this;
        const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(255,40,80,0)');
        gr.addColorStop(1, `rgba(255,40,80,${0.42 * a})`);
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
      }
    }
  }

  /** 바퀴를 돎: 별 · SPEED UP / 50연속 */
  _drawLapFx(g, t) {
    const { W, H } = this;
    for (const f of this.fx.lap) {
      const k = (t - f.at) / 1.4;
      if (k < 0 || k > 1) continue;
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const cy = H * 0.36;
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
      const { stars, crowns } = lapStars(f.v);
      const big = Math.min(46, W * 0.115);
      if (crowns > 0) {
        g.font = font(big * 1.5);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('👑', 0, -big * 0.2);
      } else {
        for (let i = 0; i < 3; i++) star(g, (i - 1) * big * 1.25, -big * 0.2 - (i === 1 ? big * 0.25 : 0), big * 0.55, i < stars ? '#ffc23d' : 'rgba(255,255,255,0.3)', i < stars ? '#e08a00' : null);
      }
      g.font = font(Math.min(28, W * 0.07));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 6;
      const msg = f.v >= MAX_LAPS ? '완주!' : `SPEED UP ×${lapSpeed(f.v).toFixed(2)}`;
      g.strokeStyle = this.view === 'road' ? 'rgba(7,9,24,0.9)' : '#fff';
      g.strokeText(msg, 0, big * 0.95);
      const gr = g.createLinearGradient(-100, 0, 100, 0);
      gr.addColorStop(0, '#ff9a3d');
      gr.addColorStop(1, '#ff4fa0');
      g.fillStyle = gr;
      g.fillText(msg, 0, big * 0.95);
      g.restore();
      // 반짝이 (처음 한 번만 만들어 둠)
      if (!f.sp) {
        f.sp = Array.from({ length: 22 }, () => ({ a: Math.random() * Math.PI * 2, v: 120 + Math.random() * 220, s: 2 + Math.random() * 3, c: Math.random() < 0.5 ? '#ffd36b' : '#ff8fc4' }));
      }
      for (const p of f.sp) {
        const d = (t - f.at) * 0.9;
        g.globalAlpha = Math.max(0, 1 - k * 1.3);
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(W / 2 + Math.cos(p.a) * p.v * d, cy + Math.sin(p.a) * p.v * d + 120 * d * d, p.s, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  _drawDying(g, t) {
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
    const msg = this.complete ? '👑 완주!' : '아쉬워요!';
    g.strokeStyle = this.view === 'road' || !this.complete ? 'rgba(10,8,20,0.85)' : '#fff';
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

  /** 화면 한 장 (시작 전 미리보기·일시정지 뒤 배경) */
  drawIdle(t = -2) {
    this.resize();
    this.startTime = 0;
    this._draw(t, 0);
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
