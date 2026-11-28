// 🥁 쿵짝 패드 (2026-11-28 미리보기, 운영자만 /?pad=okay)
//   11-28 사용자 '박자 맞추기 너무 어려워, 영상처럼 한 주사위가 반복되다 딴 거 나오게, 터치 한 번이 주사위 하나 채우게'
//   → 박자 판정 없음. 위 주사위 칸을 왼쪽→오른쪽, 위→아래 순서로, 맞는 패드를 누를 때마다 한 칸씩 채움
//     (다 채운 줄은 위로 밀려 올라감). 틀린 패드 = 실수(칸은 그대로, 빨갛게 흔들림·콤보 끊김)
//   노래는 내가 치는 만큼 흐름: 맞게 누를 때마다 곡 멜로디 다음 음 + 화음 + 왼손 베이스 (피아노), 패드 드럼 소리도 같이
//   주사위: 쿵 눈 1(주황) · 짝 눈 2(초록) · 챙 눈 3(파랑) — 8마디마다 '주로 나오는 주사위'가 바뀌고,
//           쉬움 = 4마디 첫 음·멜로디 꼭대기 음만 다른 것 · 보통 = + 바닥 음 · 어려움 = + 홀수 마디 첫 음, 앞 칸 색 없음(눈 개수만)
//   기록 = 걸린 시간 + 실수(별: 실수 0 = 3개, 3 이하 = 2개, 10 이하 = 1개). 폰에만(padBest), 랭킹·코인·서버 요청 없음

import { KICK, SNARE, HAT, parseMelody, pianoHarmony, pianoLeftHand } from './charts.js';

export const PADS = [
  { id: 0, name: '쿵', lane: KICK, color: '#ff8a3d', deep: '#d4561a', shape: 1 },
  { id: 1, name: '짝', lane: SNARE, color: '#38c96b', deep: '#1f9447', shape: 2 },
  { id: 2, name: '챙', lane: HAT, color: '#4aa3ff', deep: '#1f6fd0', shape: 3 },
];
export const PAD_SONGS = [1, 3, 5, 7, 12, 15];
export const PAD_DIFFS = [
  { id: 'easy', name: '쉬움', hint: true },
  { id: 'normal', name: '보통', hint: true },
  { id: 'hard', name: '어려움', hint: false },
];
export const PAD_COLS = 4;
/** 주로 나오는 주사위가 바뀌는 마디 수 */
export const PAD_SEG_BARS = 8;
const MAIN_ORDER = [1, 0, 2]; // 짝 → 쿵 → 챙 → …
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 곡 → 주사위 목록 [{ i, pad, midi, bar, step, len, odd }] (멜로디 음 하나 = 주사위 하나) */
export function padChart(level, diffId = 'normal') {
  const diff = PAD_DIFFS.find((d) => d.id === diffId) || PAD_DIFFS[1];
  // 멜로디가 곡(채보)보다 짧으면 되풀이 (게임 반주처럼)
  const mel = level.song.melody || [];
  const one = parseMelody(mel);
  const bars = Math.max(mel.length, (level.bars || []).length);
  const notes = [];
  for (let r = 0; mel.length && r * mel.length < bars; r++)
    for (const n of one) if (n.bar + r * mel.length < bars) notes.push({ ...n, bar: n.bar + r * mel.length });
  const cells = notes.map((n, i) => {
    const main = MAIN_ORDER[Math.floor(n.bar / PAD_SEG_BARS) % MAIN_ORDER.length];
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const phraseStart = n.step === 0 && n.bar % 4 === 0 && n.bar % PAD_SEG_BARS !== 0;
    const barStart = n.step === 0;
    const peak = prev && next && n.midi - prev.midi >= 2 && n.midi - next.midi >= 2;
    const valley = prev && next && prev.midi - n.midi >= 2 && next.midi - n.midi >= 2;
    let shift = 0;
    if (phraseStart) shift = 1;
    else if (peak) shift = 1;
    else if (diff.id !== 'easy' && valley) shift = 2;
    else if (diff.id === 'hard' && barStart && n.bar % 2 === 1) shift = 2;
    return { i, pad: (main + shift) % 3, midi: n.midi, bar: n.bar, step: n.step, len: n.len, odd: shift > 0 };
  });
  return { cells, hint: diff.hint, diff: diff.id };
}

/** 실수 수 → 별 0~3 */
export function padStars(miss) {
  return miss === 0 ? 3 : miss <= 3 ? 2 : miss <= 10 ? 1 : 0;
}
export function padGrade(miss) {
  return miss === 0 ? 'S' : miss <= 2 ? 'A' : miss <= 5 ? 'B' : miss <= 10 ? 'C' : 'D';
}
/** 기록 비교: 별 많은 쪽, 같으면 빠른 쪽 */
export function padBetter(a, b) {
  if (!b || !Number.isFinite(b.time)) return true;
  if (a.stars !== b.stars) return a.stars > b.stars;
  return a.time < b.time;
}

/** 주사위 눈 자리 (가운데 기준, 면 반지름 1) — 쿵 1개 · 짝 2개 · 챙 3개 */
export const PIPS = [
  [[0, 0]],
  [[-0.5, -0.5], [0.5, 0.5]],
  [[-0.55, -0.55], [0, 0], [0.55, 0.55]],
];

/** 주사위 눈 그리기 (cx, cy 가운데, r = 면 반지름) */
export function drawShape(g, pips, cx, cy, r, color) {
  const pr = r * (pips === 1 ? 0.34 : 0.25);
  g.fillStyle = color;
  g.beginPath();
  for (const [dx, dy] of PIPS[pips - 1] || PIPS[0]) {
    g.moveTo(cx + dx * r + pr, cy + dy * r);
    g.arc(cx + dx * r, cy + dy * r, pr, 0, Math.PI * 2);
  }
  g.fill();
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class PadGame {
  /** @param {{ audio, canvas, level, diff, onEnd }} o */
  constructor({ audio, canvas, level, diff, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.level = level;
    this.onEnd = onEnd;
    const ch = padChart(level, diff);
    this.cells = ch.cells;
    this.hint = ch.hint;
    this.diff = ch.diff;
    this.rows = Math.ceil(this.cells.length / PAD_COLS);
    this.idx = 0; // 다음에 채울 주사위
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.t0 = 0; // 시계가 흐르기 시작한 때 (첫 터치·이어 하기)
    this.used = 0; // 그 전까지 걸린 시간(ms)
    this.scroll = 0;
    this.padPress = [0, 0, 0];
    this.padFx = [null, null, null]; // { at, ok }
    this.shakeAt = -1e9;
    this.state = 'ready';
    this._onDown = (e) => this._down(e);
    this._onTouch = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  start() {
    try {
      this.audio.ensure();
    } catch {}
    this.resize();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    for (const ev of ['touchstart', 'touchmove', 'touchend']) c.addEventListener(ev, this._onTouch, { passive: false });
    this.state = 'playing';
    this._loop();
  }

  _loop() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      if (this.state !== 'playing') return;
      this._draw(nowMs());
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** 걸린 시간(초) — 첫 터치부터, 멈춘 동안은 빼고 */
  elapsed(now = nowMs()) {
    return (this.used + (this.t0 ? now - this.t0 : 0)) / 1000;
  }

  pause() {
    if (this.state !== 'playing') return false;
    this.wasRunning = !!this.t0;
    if (this.t0) {
      this.used += nowMs() - this.t0;
      this.t0 = 0;
    }
    cancelAnimationFrame(this.raf);
    this.state = 'paused';
    return true;
  }

  resume() {
    if (this.state !== 'paused') return;
    if (this.wasRunning) this.t0 = nowMs();
    this.state = 'playing';
    this._loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.state !== 'over') this.state = 'stopped';
    const c = this.canvas;
    if (!c.removeEventListener) return;
    c.removeEventListener('pointerdown', this._onDown);
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
    this._layout();
    if (this.state === 'paused') this._draw(nowMs());
  }

  _layout() {
    const { W, H } = this;
    this.hudH = Math.max(54, H * 0.085);
    this.padTop = H * 0.7;
    const side = Math.max(12, W * 0.04);
    const gridTop = this.hudH + H * 0.03;
    const gridH = this.padTop - gridTop - H * 0.05;
    this.gapPx = Math.max(6, W * 0.022);
    this.cell = Math.min((W - side * 2 - this.gapPx * (PAD_COLS - 1)) / PAD_COLS, (gridH - this.gapPx * 3) / 4.4);
    this.gridW = this.cell * PAD_COLS + this.gapPx * (PAD_COLS - 1);
    this.gridX = (W - this.gridW) / 2;
    this.gridTop = gridTop;
    this.gridH = gridH;
    this.rowH = this.cell + this.gapPx;
    const pg = Math.max(10, W * 0.035);
    const pw = (W - side * 2 - pg * 2) / 3;
    const ph = Math.min(pw * 1.15, H - this.padTop - H * 0.05);
    this.pads = PADS.map((p, i) => ({ ...p, x: side + i * (pw + pg), y: this.padTop + (H - this.padTop - ph) * 0.4, w: pw, h: ph }));
  }

  // ---------- 입력 ----------
  _down(e) {
    e.preventDefault();
    if (this.state !== 'playing') return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * this.W) / (r.width || this.W);
    const y = ((e.clientY - r.top) * this.H) / (r.height || this.H);
    if (y < this.padTop - this.H * 0.04) return; // 위 주사위 그림은 안 셈
    this.tap(clamp(Math.floor((x / this.W) * 3), 0, 2));
  }

  /** 패드 pad 누름 → 'ok' | 'miss' | null(끝난 뒤) (시험에서도 부름) */
  tap(pad, now = nowMs()) {
    const c = this.cells[this.idx];
    if (!c || this.state === 'over') return null;
    if (!this.t0) this.t0 = now;
    this.padPress[pad] = 1;
    if (c.pad !== pad) {
      this.miss++;
      this.combo = 0;
      this.shakeAt = now;
      this.padFx[pad] = { at: now, ok: false };
      this._sound(null, pad);
      return 'miss';
    }
    c.done = true;
    c.at = now;
    this.idx++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.padFx[pad] = { at: now, ok: true };
    this._sound(c, pad);
    if (this.idx >= this.cells.length) this._finish(now);
    return 'ok';
  }

  /** 맞으면 패드 드럼 + 멜로디 음 + 화음 + 왼손, 틀리면 드럼만 */
  _sound(c, pad) {
    const a = this.audio;
    try {
      const t = a.ctx.currentTime;
      a.playLane(PADS[pad].lane, t);
      if (!c) return;
      const song = this.level.song;
      const dur = Math.min(1.2, Math.max(0.3, (c.len * 60) / this.level.bpm / 4));
      if (a.piano) a.pianoNote(t, c.midi, dur, 0.9, a.sfxBus);
      else a.lead(t, c.midi, dur, a.sfxBus);
      for (const h of pianoHarmony(song, c.bar, c.step, c.midi, c.len >= 4)) a.pianoOr('lead', t, h, dur, a.sfxBus, 0.45);
      const lh = pianoLeftHand(song, c.bar, c.step - (c.step % 4));
      if (lh) a.pianoOr('lead', t, lh.midi, Math.max(dur, 0.5), a.sfxBus, lh.vel);
    } catch {}
  }

  result() {
    const time = Math.round(this.elapsed(this.endAt) * 10) / 10;
    return {
      time,
      cells: this.cells.length,
      miss: this.miss,
      maxCombo: this.maxCombo,
      stars: padStars(this.miss),
      grade: padGrade(this.miss),
      full: this.miss === 0,
      speed: time > 0 ? this.cells.length / time : 0,
      diff: this.diff,
    };
  }

  _finish(now) {
    this.endAt = now;
    this.state = 'over';
    if (typeof requestAnimationFrame === 'undefined') return this.onEnd(this.result());
    this._draw(now);
    // 마지막 주사위가 채워지는 게 보이게 조금 뒤에
    setTimeout(() => {
      this.stop();
      this.onEnd(this.result());
    }, 450);
  }

  // ---------- 그리기 ----------
  _draw(now) {
    const { g, W, H } = this;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#171b3a');
    bg.addColorStop(0.6, '#1f2550');
    bg.addColorStop(1, '#141832');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // 지금 줄이 위에서 두 번째에 오게 (처음 줄은 맨 위)
    const want = clamp(Math.floor(this.idx / PAD_COLS) - 1, 0, Math.max(0, this.rows - 3));
    this.scroll += (want - this.scroll) * 0.25;
    if (Math.abs(want - this.scroll) < 0.002) this.scroll = want;
    this._drawGrid(now);
    this._drawPads(now);
    this._drawHud(now);
  }

  _drawGrid(now) {
    const { g, cell } = this;
    g.save();
    rr(g, this.gridX - 8, this.gridTop - 8, this.gridW + 16, this.gridH + 8, 16);
    g.clip();
    const r0 = Math.max(0, Math.floor(this.scroll) - 1);
    const r1 = Math.min(this.rows, Math.ceil(this.scroll + this.gridH / this.rowH) + 1);
    for (let i = r0 * PAD_COLS; i < Math.min(this.cells.length, r1 * PAD_COLS); i++) {
      const c = this.cells[i];
      const p = PADS[c.pad];
      const r = Math.floor(i / PAD_COLS);
      let x = this.gridX + (i % PAD_COLS) * (cell + this.gapPx);
      const y = this.gridTop + (r - this.scroll) * this.rowH;
      if (y > this.gridTop + this.gridH + 4 || y + cell < this.gridTop - 10) continue;
      const cur = i === this.idx;
      const since = c.done ? now - c.at : 1e9;
      const shake = cur ? now - this.shakeAt : 1e9;
      const bad = shake < 260;
      if (bad) x += Math.sin(shake / 22) * cell * 0.07 * (1 - shake / 260);
      const pop = c.done ? 1 + 0.14 * Math.max(0, 1 - since / 160) : 1;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const s = cell * pop;
      g.save();
      g.translate(cx, cy);
      rr(g, -s / 2, -s / 2, s, s, s * 0.2);
      if (c.done) {
        g.fillStyle = p.color;
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.2)';
        rr(g, -s / 2, -s / 2, s, s * 0.45, s * 0.2);
        g.fill();
      } else if (bad) {
        g.fillStyle = '#8a2c40';
        g.fill();
      } else {
        g.fillStyle = this.hint ? p.color : '#3a4170';
        g.globalAlpha = this.hint ? 0.26 : 1;
        g.fill();
        g.globalAlpha = this.hint ? 0.55 : 1;
        g.strokeStyle = this.hint ? p.color : 'rgba(255,255,255,0.14)';
        g.lineWidth = 2;
        g.stroke();
        g.globalAlpha = 1;
      }
      g.restore();
      drawShape(g, p.shape, cx, cy, s * 0.36, c.done ? 'rgba(20,20,40,0.75)' : '#ffffff');
      // 채운 순간 반짝 고리
      if (since < 300) {
        const k = since / 300;
        g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
        g.lineWidth = 3;
        rr(g, x - k * 10, y - k * 10, cell + k * 20, cell + k * 20, cell * 0.24);
        g.stroke();
      }
      // 다음에 누를 주사위: 하얀 테두리가 숨쉬듯
      if (cur && this.state !== 'over') {
        const k = 0.5 + 0.5 * Math.sin(now / 160);
        g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * k})`;
        g.lineWidth = 3 + k * 2;
        rr(g, x - 4, y - 4, cell + 8, cell + 8, cell * 0.24);
        g.stroke();
      }
    }
    g.restore();
    // 아래 끝 흐리게
    const y0 = this.gridTop + this.gridH - this.rowH * 0.45;
    const y1 = this.gridTop + this.gridH + 2;
    const lg = g.createLinearGradient(0, y0, 0, y1);
    lg.addColorStop(0, 'rgba(31,37,80,0)');
    lg.addColorStop(1, 'rgba(31,37,80,0.95)');
    g.fillStyle = lg;
    g.fillRect(0, y0, this.W, y1 - y0);
    // 시작 전 안내
    if (this.idx === 0 && !this.miss) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = font(Math.min(20, this.W * 0.045));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('하얀 테두리 주사위와 같은 눈 패드를 눌러요', this.W / 2, this.padTop - this.H * 0.035);
    }
  }

  _drawPads(now) {
    const { g } = this;
    for (const p of this.pads) {
      this.padPress[p.id] *= 0.8;
      const k = this.padPress[p.id];
      const fx = this.padFx[p.id];
      const since = fx ? now - fx.at : 1e9;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      g.save();
      g.translate(cx, cy);
      g.scale(1 - k * 0.06, 1 - k * 0.06);
      g.fillStyle = p.deep;
      rr(g, -p.w / 2, -p.h / 2 + p.h * 0.05, p.w, p.h, p.w * 0.16);
      g.fill();
      const body = g.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
      body.addColorStop(0, p.color);
      body.addColorStop(1, p.deep);
      g.fillStyle = body;
      rr(g, -p.w / 2, -p.h / 2 + k * p.h * 0.04, p.w, p.h * 0.95, p.w * 0.16);
      g.fill();
      g.fillStyle = `rgba(255,255,255,${0.18 + k * 0.35})`;
      rr(g, -p.w / 2 + 6, -p.h / 2 + 6 + k * p.h * 0.04, p.w - 12, p.h * 0.32, p.w * 0.12);
      g.fill();
      g.restore();
      drawShape(g, p.shape, cx, cy - p.h * 0.07, Math.min(p.w, p.h) * 0.3, '#ffffff');
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = font(Math.min(p.w, p.h) * 0.17);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.name, cx, p.y + p.h * 0.83);
      if (since < 320) {
        const a = 1 - since / 320;
        const sp = since / 1000;
        g.strokeStyle = fx.ok ? `rgba(255,255,255,${a})` : `rgba(255,90,90,${a})`;
        g.lineWidth = 4 * a + 1;
        rr(g, p.x - sp * 60, p.y - sp * 60, p.w + sp * 120, p.h + sp * 120, p.w * 0.2);
        g.stroke();
      }
    }
  }

  _drawHud(now) {
    const { g, W } = this;
    const y = this.hudH * 0.52;
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.textAlign = 'right';
    g.font = font(this.hudH * 0.4);
    g.fillText(`${this.elapsed(this.state === 'over' ? this.endAt : now).toFixed(1)}초`, W - 16, y);
    g.textAlign = 'left';
    g.font = font(this.hudH * 0.26);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(this.level.name, 58, y - this.hudH * 0.13);
    g.fillStyle = this.miss ? '#ff9a9a' : 'rgba(255,255,255,0.55)';
    g.font = font(this.hudH * 0.22);
    g.fillText(`${this.idx} / ${this.cells.length} · 실수 ${this.miss}`, 58, y + this.hudH * 0.17);
    if (this.combo >= 5) {
      g.textAlign = 'center';
      g.fillStyle = '#ffe27a';
      g.font = font(this.hudH * 0.3);
      g.fillText(`${this.combo} COMBO`, W / 2, this.hudH + this.H * 0.012);
    }
    const k = this.idx / this.cells.length;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, this.hudH * 0.92, W, 3);
    g.fillStyle = '#ffb347';
    g.fillRect(0, this.hudH * 0.92, W * k, 3);
  }
}
