// 🎹 시즌 2 피아노 미리보기 (2026-11-23) — 두 방식을 쳐 보고 투표
//   A 'live' : 어두운 무대, 원근 있는 4줄 길에 납작한 막대 콩 (줄 = 음 높이 대충, 누르면 그 음이 피아노로)
//   B 'keys' : 밝은 화면, 아래 진짜 건반(흰 건반 8개 안팎)에 계이름 색 콩이 위에서 내려옴, 누른 건반 음이 그대로 남
//   긴 음(2분음표 이상)은 끝까지 누르고 있기. 연습판: 기록·랭킹·코인·서버 요청 없음
//   반주는 SongPlayer(멜로디 빼고 베이스·화음·하이햇), 멜로디는 내가 칠 때만 남

import { parseMelody, tempoOf, COUNT_IN_BARS, STEPS_PER_BAR, JUDGE, POINTS, ACC_WEIGHT } from './charts.js';
import { SongPlayer } from './audio.js';

export const P2_SOLFA = ['도', '도', '레', '레', '미', '파', '파', '솔', '솔', '라', '라', '시'];
/** 계이름 색 (도~시) */
const P2_COLORS = { 도: '#b77cf5', 레: '#f39a2e', 미: '#5cc72e', 파: '#d0408f', 솔: '#6f8ff7', 라: '#f07cc3', 시: '#1cc6a1' };
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const isWhite = (m) => WHITE.includes(((m % 12) + 12) % 12);
const HOLD_STEPS = 8; // 2분음표 이상이면 꾹 누르기
const HOLD_GRACE = 0.14; // 끝나기 이만큼 전에 떼도 성공
const LOOK = 1.55; // 콩이 보이기 시작하는 시간(초)

/** 곡 → 칠 음표 [{ t, dur, end, midi, hold }] (곡 시작 = 카운트인 첫 박 기준 초) */
export function p2Notes(level) {
  const tempo = tempoOf(level);
  return parseMelody(level.song.melody).map((n) => {
    const s0 = (COUNT_IN_BARS + n.bar) * STEPS_PER_BAR + n.step;
    const t = tempo.stepTime(s0);
    const end = tempo.stepTime(s0 + n.len);
    return { t, dur: end - t, end, midi: n.midi, hold: n.len >= HOLD_STEPS };
  });
}

/** B: 쓸 흰 건반들 (곡 음역, 적어도 8개·많아야 10개). 검은 건반 음은 아래 흰 건반으로 */
export function p2Keys(notes) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) {
    const m = isWhite(n.midi) ? n.midi : n.midi - 1;
    lo = Math.min(lo, m);
    hi = Math.max(hi, m);
  }
  const keys = [];
  for (let m = lo; m <= hi; m++) if (isWhite(m)) keys.push(m);
  let m = hi;
  while (keys.length < 8) {
    m++;
    if (isWhite(m)) keys.push(m);
  }
  return keys.slice(0, 10);
}

/** A: 음 높이 → 4줄 (낮은 음 왼쪽). 같은 음은 같은 줄 */
export function p2LiveLanes(notes, lanes = 4) {
  const pitches = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b);
  const lo = pitches[0];
  const span = Math.max(1, pitches.at(-1) - lo + 1);
  return notes.map((n) => Math.min(lanes - 1, Math.floor(((n.midi - lo) / span) * lanes)));
}

const solfa = (m) => P2_SOLFA[((m % 12) + 12) % 12];

export class PianoPreview {
  /** @param {{ audio, canvas, level, style: 'live'|'keys', onEnd }} o */
  constructor({ audio, canvas, level, style, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.ctx2 = canvas.getContext('2d');
    this.style = style;
    this.onEnd = onEnd;
    this.level = { ...level, tapMelody: true, bars: level.song.melody.map(() => '.'.repeat(STEPS_PER_BAR)) };
    this.notes = p2Notes(this.level);
    if (style === 'keys') {
      this.keys = p2Keys(this.notes);
      for (const n of this.notes) n.lane = this.keys.indexOf(isWhite(n.midi) ? n.midi : n.midi - 1);
      this.laneCount = this.keys.length;
    } else {
      const lanes = p2LiveLanes(this.notes);
      this.notes.forEach((n, i) => (n.lane = lanes[i]));
      this.laneCount = 4;
    }
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.items = this.notes.length + this.notes.filter((n) => n.hold).length; // 긴 음은 끝도 한 번 더 판정
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.pressed = new Map(); // pointerId → { lane, at, note }
    this.flash = []; // 줄 빛 { lane, at }
    this.pops = []; // 판정 글자 { kind, at, lane }
    this.bursts = []; // 맞힌 자리 반짝 { lane, at, color }
    this.lastEnd = this.notes.reduce((a, n) => Math.max(a, n.end), 0);
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    this._resize = () => this.resize();
  }

  start() {
    const a = this.audio;
    a.ensure();
    this.resize();
    window.addEventListener('resize', this._resize);
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointerup', this._onUp);
    c.addEventListener('pointercancel', this._onUp);
    c.addEventListener('pointerleave', this._onUp);
    this.startTime = a.ctx.currentTime + 0.35;
    this.player = new SongPlayer(a, this.level, this.startTime);
    this.player.start();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.player) this.player.stop();
    this.player = null;
    window.removeEventListener('resize', this._resize);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointercancel', this._onUp);
    c.removeEventListener('pointerleave', this._onUp);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    this.W = r.width || window.innerWidth;
    this.H = r.height || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layout();
  }

  _layout() {
    const { W, H } = this;
    if (this.style === 'keys') {
      const side = Math.max(8, W * 0.03);
      this.kbX = side;
      this.keyW = (W - side * 2) / this.laneCount;
      this.kbH = Math.min(H * 0.27, this.keyW * 4.2);
      this.kbY = H - this.kbH - Math.max(14, H * 0.03);
      this.judgeY = this.kbY;
      this.speed = (this.judgeY - H * 0.1) / LOOK;
    } else {
      this.judgeY = H * 0.8;
      this.topY = H * 0.13;
      this.nearW = Math.min(W * 0.96, H * 0.62);
      this.farW = this.nearW * 0.3;
    }
  }

  /** 지금 곡 시각 (귀에 들리는 소리 기준) */
  now(perfMs) {
    return this.audio.heardTime(perfMs) - this.startTime;
  }

  // ---------- 입력 ----------
  _laneAt(x, y) {
    if (this.style === 'keys') {
      if (y < this.judgeY - this.H * 0.25) return -1;
      return Math.max(0, Math.min(this.laneCount - 1, Math.floor((x - this.kbX) / this.keyW)));
    }
    if (y < this.H * 0.45) return -1;
    const left = (this.W - this.nearW) / 2;
    return Math.max(0, Math.min(3, Math.floor(((x - left) / this.nearW) * 4)));
  }

  _down(e) {
    e.preventDefault();
    if (!this.running) return;
    const r = this.canvas.getBoundingClientRect();
    const lane = this._laneAt(e.clientX - r.left, e.clientY - r.top);
    if (lane < 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    const t = this.now(performance.now());
    const rt = this.audio.ctx.currentTime;
    // 이 줄에서 가장 가까운 안 친 콩 (GOOD 범위 안)
    let best = null;
    for (const n of this.notes) {
      if (n.lane !== lane || n.judged) continue;
      const dt = t - n.t;
      if (dt < -JUDGE.good) break;
      if (Math.abs(dt) <= JUDGE.good && (!best || Math.abs(dt) < Math.abs(t - best.t))) best = n;
    }
    const press = { lane, at: t, note: null };
    this.pressed.set(e.pointerId, press);
    this.flash.push({ lane, at: t });
    if (best) {
      const dt = Math.abs(t - best.t);
      const kind = dt <= JUDGE.perfect ? 'perfect' : dt <= JUDGE.great ? 'great' : 'good';
      best.judged = kind;
      this._count(kind, lane, t);
      this._sound(best.midi, best.hold ? best.dur : Math.max(0.3, best.dur), rt);
      this.bursts.push({ lane, at: t, color: this._color(best) });
      if (best.hold) {
        best.holding = true;
        press.note = best;
      }
    } else {
      // 칠 콩이 없는데 누름: B 는 건반 소리 그대로, A 는 소리 없음 — 둘 다 헛침
      if (this.style === 'keys') this._sound(this.keys[lane], 0.3, rt, 0.55);
      this.counts.wrong++;
      this.combo = 0;
      this.pops.push({ kind: 'wrong', at: t, lane });
    }
  }

  _up(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    this.pressed.delete(e.pointerId);
    const n = p.note;
    if (n && n.holding) {
      n.holding = false;
      const t = this.now(performance.now());
      if (t >= n.end - HOLD_GRACE) this._tail(n, true, t);
      else this._tail(n, false, t);
    }
  }

  _tail(n, ok, t) {
    if (n.tail) return;
    n.tail = ok ? 'perfect' : 'miss';
    this._count(n.tail, n.lane, t, true);
  }

  _count(kind, lane, t, tail = false) {
    this.counts[kind]++;
    if (kind === 'miss') this.combo = 0;
    else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round(POINTS[kind] * (1 + Math.min(this.combo, 100) / 100));
    }
    if (!tail || kind === 'miss') this.pops.push({ kind, at: t, lane });
  }

  _sound(midi, dur, rt, vel = 1) {
    const a = this.audio;
    try {
      if (a.piano) a.pianoNote(rt, midi, Math.min(1.6, dur), 0.95 * vel, a.sfxBus);
      else a.lead(rt, midi, Math.min(1.2, dur), a.sfxBus);
    } catch {}
  }

  _color(n) {
    if (this.style === 'keys') return P2_COLORS[solfa(this.keys[n.lane])];
    return ['#7df2ff', '#b996ff', '#ff8ad8', '#ffe27a'][n.lane];
  }

  get accuracy() {
    const c = this.counts;
    const got = c.perfect * ACC_WEIGHT.perfect + c.great * ACC_WEIGHT.great + c.good * ACC_WEIGHT.good;
    return got / Math.max(1, this.items + c.wrong);
  }

  // ---------- 매 화면 ----------
  _tick() {
    const t = this.now(performance.now());
    for (const n of this.notes) {
      if (!n.judged && t - n.t > JUDGE.good) {
        n.judged = 'miss';
        this._count('miss', n.lane, t);
        if (n.hold) this._tail(n, false, t); // 머리를 놓치면 끝도 놓침
      }
      if (n.holding && t >= n.end) {
        n.holding = false;
        this._tail(n, true, t);
      }
    }
    if (t > this.lastEnd + 1.2 && !this.ended) {
      this.ended = true;
      this.stop();
      this._draw(t);
      if (this.onEnd) {
        const c = this.counts;
        this.onEnd({ score: this.score, accuracy: this.accuracy, maxCombo: this.maxCombo, ...c, full: c.miss === 0 && c.wrong === 0 });
      }
      return;
    }
    this._draw(t);
  }

  _draw(t) {
    const g = this.ctx2;
    g.save();
    if (this.style === 'keys') this._drawKeys(g, t);
    else this._drawLive(g, t);
    this._drawCommon(g, t);
    g.restore();
    const old = t - 1;
    this.flash = this.flash.filter((f) => f.at > old);
    this.pops = this.pops.filter((f) => f.at > old);
    this.bursts = this.bursts.filter((f) => f.at > old);
  }

  /** 진행 줄 · 점수 · 카운트다운 */
  _drawCommon(g, t) {
    const { W, H } = this;
    const dark = this.style === 'live';
    const total = this.lastEnd;
    const p = Math.max(0, Math.min(1, t / total));
    const top = Math.max(10, H * 0.015) + (this.safeTop || 0);
    g.fillStyle = dark ? 'rgba(255,255,255,0.15)' : '#e5e5ea';
    rr(g, 16, top, W - 32, 7, 4);
    g.fill();
    g.fillStyle = dark ? '#7df2ff' : '#58cc02';
    rr(g, 16, top, Math.max(7, (W - 32) * p), 7, 4);
    g.fill();
    g.textAlign = 'right';
    g.textBaseline = 'top';
    g.fillStyle = dark ? '#fff' : '#3c3c43';
    g.font = `800 ${Math.round(Math.min(22, W * 0.055))}px system-ui, sans-serif`;
    g.fillText(this.score.toLocaleString(), W - 18, top + 16);
    // 3 · 2 · 1
    const beat = 60 / this.level.bpm;
    const first = this.notes.length ? this.notes[0].t : 0;
    if (t < first - 0.05 && t > first - beat * 3.5) {
      const k = Math.ceil((first - t) / beat);
      if (k >= 1 && k <= 3) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `900 ${Math.round(W * 0.2)}px system-ui, sans-serif`;
        g.fillStyle = dark ? 'rgba(255,255,255,0.85)' : 'rgba(60,60,67,0.75)';
        g.fillText(String(k), W / 2, H * 0.38);
      }
    }
  }

  // ======== B: 건반 ========
  _drawKeys(g, t) {
    const { W, H, kbX, keyW, kbY, kbH, judgeY, speed } = this;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    // 건반마다 옅은 길
    for (let i = 0; i < this.laneCount; i++) {
      const x = kbX + i * keyW;
      g.fillStyle = i % 2 ? '#f7f7fa' : '#fbfbfd';
      g.fillRect(x, 0, keyW, judgeY);
      const fl = this.flash.filter((f) => f.lane === i).at(-1);
      const held = [...this.pressed.values()].some((p) => p.lane === i);
      if (fl || held) {
        const a = held ? 0.5 : Math.max(0, 1 - (t - fl.at) / 0.25) * 0.5;
        const grd = g.createLinearGradient(0, judgeY - H * 0.3, 0, judgeY);
        const col = P2_COLORS[solfa(this.keys[i])];
        grd.addColorStop(0, hexA(col, 0));
        grd.addColorStop(1, hexA(col, a * 0.45));
        g.fillStyle = grd;
        g.fillRect(x, judgeY - H * 0.3, keyW, H * 0.3);
      }
    }
    // 콩 (계이름 색 막대, 길이 = 음 길이)
    const pad = Math.max(3, keyW * 0.09);
    const label = Math.round(Math.min(keyW * 0.42, 22));
    g.save();
    g.beginPath();
    g.rect(0, 0, W, judgeY);
    g.clip();
    for (const n of this.notes) {
      if (n.t - t > LOOK + 0.2) break;
      if (n.judged && n.judged !== 'miss' && !n.holding) continue;
      if (n.judged === 'miss' && t - n.end > 0.3) continue;
      const yHead = judgeY - (n.t - t) * speed;
      const len = Math.max(keyW * 0.55, n.dur * speed - Math.max(4, speed * 0.03));
      let yTop = yHead - len;
      let yBot = n.holding ? judgeY : yHead;
      if (yBot < -10) continue;
      const x = kbX + n.lane * keyW + pad;
      const w = keyW - pad * 2;
      const col = P2_COLORS[solfa(this.keys[n.lane])];
      g.globalAlpha = n.judged === 'miss' ? 0.3 : 1;
      g.fillStyle = shade(col, -0.18);
      rr(g, x, yTop + 4, w, yBot - yTop, Math.min(12, w * 0.3));
      g.fill();
      g.fillStyle = col;
      rr(g, x, yTop, w, yBot - yTop - 3, Math.min(12, w * 0.3));
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      rr(g, x + w * 0.18, yTop + 5, w * 0.64, 4, 2);
      g.fill();
      if (n.holding) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        rr(g, x, yTop, w, yBot - yTop - 3, Math.min(12, w * 0.3));
        g.fill();
      }
      if (yBot - yTop > label * 1.3) {
        g.fillStyle = '#fff';
        g.font = `800 ${label}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillText(solfa(n.midi), x + w / 2, yBot - 8);
      }
      g.globalAlpha = 1;
    }
    g.restore();
    // 맞힌 자리 반짝
    for (const b of this.bursts) {
      const k = (t - b.at) / 0.35;
      if (k < 0 || k > 1) continue;
      const cx = kbX + (b.lane + 0.5) * keyW;
      g.globalAlpha = 1 - k;
      g.strokeStyle = b.color;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, judgeY, keyW * (0.3 + k * 0.5), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    // 건반
    for (let i = 0; i < this.laneCount; i++) {
      const midi = this.keys[i];
      const col = P2_COLORS[solfa(midi)];
      const held = [...this.pressed.values()].some((p) => p.lane === i);
      const dy = held ? 5 : 0;
      const x = kbX + i * keyW + 2;
      const w = keyW - 4;
      g.fillStyle = col;
      rr(g, x, kbY + 6, w, kbH - 6, 12);
      g.fill();
      g.fillStyle = held ? tint(col, 0.82) : '#ffffff';
      g.strokeStyle = '#dcdce2';
      g.lineWidth = 2;
      rr(g, x, kbY + dy, w, kbH - 12, 12);
      g.fill();
      g.stroke();
      g.fillStyle = col;
      g.font = `800 ${Math.round(Math.min(keyW * 0.4, 24))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(solfa(midi), x + w / 2, kbY + kbH - 24 + dy);
    }
    // 검은 건반 (모양만, 누르면 아래 흰 건반으로)
    for (let i = 0; i < this.laneCount - 1; i++) {
      if (!isWhite(this.keys[i] + 1)) {
        const x = kbX + (i + 1) * keyW - keyW * 0.3;
        g.fillStyle = '#333338';
        rr(g, x, kbY - 2, keyW * 0.6, kbH * 0.46, 8);
        g.fill();
        g.fillStyle = '#4a4a50';
        rr(g, x, kbY - 2, keyW * 0.6, kbH * 0.46 - 8, 8);
        g.fill();
      }
    }
    // 판정선
    g.fillStyle = 'rgba(88,204,2,0.9)';
    g.fillRect(kbX, judgeY - 3, keyW * this.laneCount, 3);
    this._drawPops(g, t, false);
  }

  // ======== A: 라이브 ========
  /** 시간 차(초) → 길 위 깊이 0(판정선)~1(멀리) → 화면 y·폭 */
  _proj(dt) {
    const z = Math.max(0, dt / LOOK);
    const f = (z * 1.8) / (1 + 0.8 * z); // 멀수록 촘촘하게
    const y = this.judgeY - (this.judgeY - this.topY) * Math.min(1.15, f);
    const k = (this.judgeY - y) / (this.judgeY - this.topY);
    const w = this.nearW + (this.farW - this.nearW) * Math.min(1, k);
    return { y, w, left: (this.W - w) / 2 };
  }

  _drawLive(g, t) {
    const { W, H, judgeY } = this;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0d2c');
    bg.addColorStop(0.6, '#1a1040');
    bg.addColorStop(1, '#2a0f3e');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // 길 (유리)
    const far = this._proj(LOOK * 1.3);
    const near = { y: H, w: this.nearW * 1.08 };
    near.left = (W - near.w) / 2;
    const nj = this._proj(0);
    g.beginPath();
    g.moveTo(far.left, far.y);
    g.lineTo(far.left + far.w, far.y);
    g.lineTo(near.left + near.w, near.y);
    g.lineTo(near.left, near.y);
    g.closePath();
    const lg = g.createLinearGradient(0, far.y, 0, H);
    lg.addColorStop(0, 'rgba(120,140,255,0.04)');
    lg.addColorStop(1, 'rgba(160,200,255,0.18)');
    g.fillStyle = lg;
    g.fill();
    // 줄 빛 (누른 줄)
    for (let i = 0; i < 4; i++) {
      const fl = this.flash.filter((f) => f.lane === i).at(-1);
      const held = [...this.pressed.values()].some((p) => p.lane === i);
      if (!fl && !held) continue;
      const a = held ? 0.55 : Math.max(0, 1 - (t - fl.at) / 0.3) * 0.55;
      if (a <= 0) continue;
      const fx = (s) => far.left + (far.w * s) / 4;
      const nx = (s) => nj.left + (nj.w * s) / 4;
      g.beginPath();
      g.moveTo(fx(i), far.y);
      g.lineTo(fx(i + 1), far.y);
      g.lineTo(nx(i + 1), judgeY);
      g.lineTo(nx(i), judgeY);
      g.closePath();
      const cg = g.createLinearGradient(0, far.y, 0, judgeY);
      cg.addColorStop(0, 'rgba(180,230,255,0)');
      cg.addColorStop(1, `rgba(180,230,255,${a})`);
      g.fillStyle = cg;
      g.fill();
    }
    // 줄 경계
    for (let s = 0; s <= 4; s++) {
      const edge = s === 0 || s === 4;
      g.strokeStyle = edge ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.16)';
      g.lineWidth = edge ? 2.5 : 1;
      if (edge) {
        g.shadowColor = 'rgba(160,220,255,0.9)';
        g.shadowBlur = 12;
      }
      g.beginPath();
      g.moveTo(far.left + (far.w * s) / 4, far.y);
      g.lineTo(near.left + (near.w * s) / 4, near.y);
      g.stroke();
      g.shadowBlur = 0;
    }
    // 긴 음 띠
    for (const n of this.notes) {
      if (!n.hold || n.t - t > LOOK * 1.3) continue;
      if (n.tail || (n.judged === 'miss' && t > n.end)) continue;
      if (n.judged && n.judged !== 'miss' && !n.holding) continue;
      const a = this._proj(Math.max(n.holding ? 0 : n.t - t, 0));
      const b = this._proj(Math.max(0, n.end - t));
      if (n.end - t < 0) continue;
      const ax = (p, s) => p.left + (p.w * s) / 4;
      const inset = 0.12;
      g.beginPath();
      g.moveTo(ax(b, n.lane + inset), b.y);
      g.lineTo(ax(b, n.lane + 1 - inset), b.y);
      g.lineTo(ax(a, n.lane + 1 - inset), a.y);
      g.lineTo(ax(a, n.lane + inset), a.y);
      g.closePath();
      g.fillStyle = n.holding ? 'rgba(140,255,200,0.55)' : n.judged === 'miss' ? 'rgba(255,255,255,0.12)' : 'rgba(140,255,200,0.32)';
      g.fill();
    }
    // 콩 (납작한 막대)
    for (const n of this.notes) {
      const dt = n.t - t;
      if (dt > LOOK * 1.3) break;
      if (n.judged && !(n.judged === 'miss' && dt > -0.25)) continue;
      const p = this._proj(Math.max(dt, 0) + Math.min(0, dt) * 0.4);
      const lw = p.w / 4;
      const x = p.left + lw * n.lane + lw * 0.06;
      const w = lw * 0.88;
      const h = Math.max(6, 18 * (p.w / this.nearW));
      const y = dt < 0 ? judgeY - dt * 260 : p.y;
      const col = n.hold ? '#8dffc8' : this._color(n);
      g.globalAlpha = n.judged === 'miss' ? 0.35 : 1;
      g.shadowColor = col;
      g.shadowBlur = 10;
      const grd = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, col);
      g.fillStyle = grd;
      rr(g, x, y - h / 2, w, h, h / 2);
      g.fill();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }
    // 판정선
    g.shadowColor = 'rgba(160,230,255,1)';
    g.shadowBlur = 16;
    g.fillStyle = '#ffffff';
    g.fillRect(nj.left, judgeY - 2, nj.w, 4);
    g.shadowBlur = 0;
    // 맞힌 자리 반짝
    for (const b of this.bursts) {
      const k = (t - b.at) / 0.3;
      if (k < 0 || k > 1) continue;
      const cx = nj.left + (nj.w / 4) * (b.lane + 0.5);
      g.globalAlpha = (1 - k) * 0.9;
      g.fillStyle = b.color;
      g.beginPath();
      g.ellipse(cx, judgeY, (nj.w / 8) * (0.6 + k * 0.6), 10 + k * 14, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    // 가운데 콤보
    if (this.combo >= 3) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.font = `900 ${Math.round(W * 0.16)}px system-ui, sans-serif`;
      g.fillText(String(this.combo), W / 2, H * 0.42);
      g.font = `800 ${Math.round(W * 0.04)}px system-ui, sans-serif`;
      g.fillText('COMBO', W / 2, H * 0.42 + W * 0.11);
    }
    this._drawPops(g, t, true);
  }

  /** 판정 글자: 줄마다 판정선 위 */
  _drawPops(g, t, dark) {
    const names = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', wrong: '헛침' };
    const colors = dark
      ? { perfect: ['#ff9be1', '#ffe27a', '#7df2ff'], great: ['#9be8ff', '#b9a6ff'], good: ['#c6ffb0', '#8be0a0'], miss: ['#9a9ab0'], wrong: ['#9a9ab0'] }
      : { perfect: ['#58cc02', '#3fae00'], great: ['#1cb0f6', '#1899d6'], good: ['#ff9600', '#e58600'], miss: ['#c0c0c8'], wrong: ['#c0c0c8'] };
    const seen = new Set();
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      if (seen.has(p.lane)) continue;
      seen.add(p.lane);
      const k = (t - p.at) / 0.5;
      if (k < 0 || k > 1) continue;
      let cx;
      let w;
      if (this.style === 'keys') {
        cx = this.kbX + (p.lane + 0.5) * this.keyW;
        w = this.keyW;
      } else {
        const nj = this._proj(0);
        cx = nj.left + (nj.w / 4) * (p.lane + 0.5);
        w = nj.w / 4;
      }
      const y = this.judgeY - this.H * 0.05 - k * 18;
      const size = Math.round(Math.min(w * (p.kind === 'perfect' ? 0.3 : 0.26), 20));
      g.globalAlpha = 1 - k * k;
      g.font = `italic 900 ${size}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const cs = colors[p.kind];
      const tw = g.measureText(names[p.kind]).width;
      const grd = g.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
      cs.forEach((c, j) => grd.addColorStop(cs.length === 1 ? 0 : j / (cs.length - 1), c));
      if (dark) {
        g.strokeStyle = 'rgba(10,10,40,0.8)';
        g.lineWidth = 3;
        g.strokeText(names[p.kind], cx, y);
      }
      g.fillStyle = grd;
      g.fillText(names[p.kind], cx, y);
      g.globalAlpha = 1;
    }
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
function rgbOf(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function hexA(hex, a) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, k) {
  const [r, g, b] = rgbOf(hex).map((c) => Math.round(c * (1 + k)));
  return `rgb(${r},${g},${b})`;
}
function tint(hex, k) {
  const [r, g, b] = rgbOf(hex).map((c) => Math.round(c + (255 - c) * k));
  return `rgb(${r},${g},${b})`;
}
