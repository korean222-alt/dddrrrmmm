// 🥁 쿵짝 패드 (2026-11-28 미리보기, 운영자만 /?pad=okay) — 노래에 맞춰 맞는 패드 누르기
//   위: 4칸씩 줄지어 깔린 주사위 칸(쿵 눈 1 · 짝 눈 2 · 챙 눈 3, 11-28 사용자 '주사위가 좋을 듯'). 박자마다 한 칸씩 왼쪽→오른쪽, 위→아래로 읽어 나감
//       (지나가는 빛 막대가 칸 한가운데에 올 때 누름). 친 칸은 색이 들어오고, 다 친 줄은 위로 밀려 올라감
//   아래: 주사위 패드 3개 — 쿵(주황 ⚀) · 짝(초록 ⚁) · 챙(파랑 ⚂). 누르면 드럼 소리
//   칸 = 곡 드럼 채보(K·S·H…)에서. 드럼이 빈 칸은 멜로디(올라감 챙·내려감 쿵·같음 짝), 그것도 없으면 기본 박자
//   빠르기: 곡 BPM 그대로, 난이도는 칸 간격(2분·4분·8분) — 이웃 칸 0.2초↑
//   어려움은 앞으로 올 칸이 색 없이 모양만 (읽어야 함)
//   연습판: 기록은 폰에만, 랭킹·코인·서버 요청 없음

import { COUNT_IN_BARS, STEPS_PER_BAR, KICK, SNARE, HAT, CHAR_LANES, CRASH, TOM, JUDGE, pointsFor, tempoOf, parseMelody } from './charts.js';
import { SongPlayer } from './audio.js';

export const PADS = [
  { id: 0, name: '쿵', lane: KICK, color: '#ff8a3d', deep: '#d4561a', shape: 1 },
  { id: 1, name: '짝', lane: SNARE, color: '#38c96b', deep: '#1f9447', shape: 2 },
  { id: 2, name: '챙', lane: HAT, color: '#4aa3ff', deep: '#1f6fd0', shape: 3 },
];
export const PAD_SONGS = [1, 3, 5, 7, 12, 15];
export const PAD_DIFFS = [
  { id: 'easy', name: '쉬움', rps: 1.6, hint: true },
  { id: 'normal', name: '보통', rps: 2.8, hint: true },
  { id: 'hard', name: '어려움', rps: 3.6, hint: false },
];
/** 이웃 칸은 이만큼(초) 넘게 떨어짐 */
export const PAD_MIN_GAP = 0.2;
export const PAD_COLS = 4;
const WIN = { perfect: JUDGE.perfect + 0.01, great: JUDGE.great + 0.01, good: JUDGE.good + 0.01 };
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px, w = '') => `${w ? w + ' ' : ''}${Math.round(px)}px ${FONT}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 채보 글자 → 패드 (q = 마디 안 박 번호) */
function padOfChar(c, q) {
  if (c === 'B') return q % 2 ? 1 : 0; // 쿵+짝 같이: 뒷박이면 짝
  const lanes = CHAR_LANES[c];
  if (!lanes || !lanes.length) return -1;
  if (lanes.includes(KICK)) return 0;
  if (lanes.includes(SNARE) || lanes.includes(TOM)) return 1;
  if (lanes.includes(HAT) || lanes.includes(CRASH)) return 2;
  return -1;
}

/** 난이도 → 칸 하나 = 16분 몇 칸 (8 = 2분음표, 4 = 4분, 2 = 8분). 초당 칸이 목표에 가깝고 0.2초 규칙 지키는 것 */
export function padUnit(bpm, rps) {
  const step = 60 / bpm / 4;
  let best = 8;
  let bd = Infinity;
  for (const u of [8, 4, 2]) {
    const gap = u * step;
    if (gap < PAD_MIN_GAP) continue;
    const d = Math.abs(Math.log(1 / gap / rps));
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

/** 곡 → 칸 목록 [{ i, t, pad, bar, step }] (t = 곡 시작(카운트인 첫 박) 기준 초) */
export function padChart(level, diffId = 'normal') {
  const diff = PAD_DIFFS.find((d) => d.id === diffId) || PAD_DIFFS[1];
  const u = padUnit(level.bpm, diff.rps);
  const tempo = tempoOf(level);
  // 멜로디 (짧으면 되풀이): 칸 자리에서 시작하는 음 → 바로 앞 음보다 올라감/내려감/같음
  const mel = new Map();
  try {
    const src = level.song.melody || [];
    const notes = parseMelody(src);
    for (let r = 0; src.length && r * src.length < level.bars.length; r++)
      for (const n of notes) mel.set((n.bar + r * src.length) * STEPS_PER_BAR + n.step, n.midi);
  } catch {}
  let lastMidi = null;
  const cells = [];
  level.bars.forEach((bar, mb) => {
    for (let s = 0; s < STEPS_PER_BAR; s += u) {
      const q = Math.floor(s / 4);
      let pad = padOfChar(bar[s], q);
      for (let k = 1; pad < 0 && k < u; k++) pad = padOfChar(bar[s + k], q);
      let midi = null;
      for (let k = 0; midi == null && k < u; k++) midi = mel.get(mb * STEPS_PER_BAR + s + k) ?? null;
      // 드럼이 빈 칸: 멜로디가 올라가면 챙 · 내려가면 쿵 · 같으면 짝, 멜로디도 없으면 앞박 쿵 · 뒷박 짝 · 엇박 챙
      if (pad < 0 && midi != null && lastMidi != null) pad = midi > lastMidi ? 2 : midi < lastMidi ? 0 : 1;
      if (pad < 0) pad = s % 4 ? 2 : q % 2 ? 1 : 0;
      if (midi != null) lastMidi = midi;
      const t = tempo.stepTime((COUNT_IN_BARS + mb) * STEPS_PER_BAR + s);
      cells.push({ i: cells.length, t, pad, bar: mb, step: s });
    }
  });
  return { cells, unit: u, gap: tempo.stepTime(u) - tempo.stepTime(0), hint: diff.hint, diff: diff.id };
}

/** 시간 차(초) → 판정 */
export function padJudge(dt) {
  const a = Math.abs(dt);
  return a <= WIN.perfect ? 'perfect' : a <= WIN.great ? 'great' : a <= WIN.good ? 'good' : null;
}

export function padStars(acc, miss) {
  return acc >= 0.95 && miss === 0 ? 3 : acc >= 0.85 ? 2 : acc >= 0.6 ? 1 : 0;
}
export function padGrade(acc) {
  return acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
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

const JUDGE_TXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', wrong: '헛침' };
const JUDGE_COL = { perfect: '#fff27a', great: '#9cf0ff', good: '#c9f7b0', miss: '#ff7b7b', wrong: '#ff9f9f' };

export class PadGame {
  /** @param {{ audio, canvas, level, diff, offsetMs?, onEnd }} o */
  constructor({ audio, canvas, level, diff, offsetMs = 0, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.level = level;
    this.onEnd = onEnd;
    this.offset = (offsetMs || 0) / 1000;
    const ch = padChart(level, diff);
    this.cells = ch.cells;
    this.gap = ch.gap;
    this.hint = ch.hint;
    this.diff = ch.diff;
    this.rows = Math.ceil(this.cells.length / PAD_COLS);
    this.lastT = this.cells.at(-1).t;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.score = 0;
    this.shown = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.scroll = 0; // 위로 밀린 줄 수 (부드럽게)
    this.padPress = [0, 0, 0];
    this.fx = []; // { kind, at, ... }
    this.state = 'ready';
    this._onDown = (e) => this._down(e);
    this._onTouch = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  start() {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    for (const ev of ['touchstart', 'touchmove', 'touchend']) c.addEventListener(ev, this._onTouch, { passive: false });
    this._play(this.audio.ctx.currentTime + 0.35);
  }

  _play(startTime) {
    this.startTime = startTime;
    this.player = new SongPlayer(this.audio, this.level, startTime);
    this.player.start();
    this.state = 'playing';
    const loop = () => {
      if (this.state !== 'playing') return;
      this._tick();
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
  }

  _halt() {
    cancelAnimationFrame(this.raf);
    if (this.player) this.player.stop(0.08);
    this.player = null;
  }

  pause() {
    if (this.state !== 'playing') return false;
    this.pausedAt = this.now();
    this._halt();
    this.state = 'paused';
    this._draw(this.pausedAt);
    return true;
  }

  /** 이어 하기: 2마디 앞(최대 2초)부터 흘러 멈춘 자리로 */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.resumeAt = this.pausedAt;
    this._play(this.audio.ctx.currentTime + 1.8 - this.pausedAt);
  }

  stop() {
    this._halt();
    this.state = 'stopped';
    const c = this.canvas;
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
    if (this.state === 'paused') this._draw(this.pausedAt);
  }

  _layout() {
    const { W, H } = this;
    this.hudH = Math.max(54, H * 0.085);
    this.padTop = H * 0.7;
    const side = Math.max(12, W * 0.04);
    const gridTop = this.hudH + H * 0.02;
    const gridH = this.padTop - gridTop - H * 0.03;
    this.gapPx = Math.max(6, W * 0.022);
    this.cell = Math.min((W - side * 2 - this.gapPx * (PAD_COLS - 1)) / PAD_COLS, (gridH - this.gapPx * 3) / 4.4);
    this.gridW = this.cell * PAD_COLS + this.gapPx * (PAD_COLS - 1);
    this.gridX = (W - this.gridW) / 2;
    this.gridTop = gridTop;
    this.gridH = gridH;
    this.rowH = this.cell + this.gapPx;
    // 패드 3개
    const pg = Math.max(10, W * 0.035);
    const pw = (W - side * 2 - pg * 2) / 3;
    const ph = Math.min(pw * 1.15, H - this.padTop - H * 0.05);
    this.pads = PADS.map((p, i) => ({ ...p, x: side + i * (pw + pg), y: this.padTop + (H - this.padTop - ph) * 0.4, w: pw, h: ph }));
  }

  /** 지금 곡 시각 (귀에 들리는 소리 기준) */
  now(perfMs = performance.now()) {
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  // ---------- 입력 ----------
  _down(e) {
    e.preventDefault();
    if (this.state !== 'playing') return;
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * this.W) / (r.width || this.W);
    const y = ((e.clientY - r.top) * this.H) / (r.height || this.H);
    if (y < this.padTop - this.H * 0.04) return; // 패드 칸 밖(위 칸 그림)은 안 셈
    const pad = clamp(Math.floor((x / this.W) * 3), 0, 2);
    const ts = e.timeStamp > 0 && Math.abs(performance.now() - e.timeStamp) < 300 ? e.timeStamp : performance.now();
    this.tap(pad, this.now(ts));
  }

  /** 패드 pad 를 곡 시각 t 에 누름 (시험에서도 부름) */
  tap(pad, t) {
    this.padPress[pad] = 1;
    try {
      this.audio.playLane(PADS[pad].lane);
    } catch {}
    // 앞뒤 GOOD 안에서 아직 안 친 칸 중 같은 패드, 시간이 가장 잘 맞는 것
    let best = null;
    let bd = Infinity;
    for (const c of this.cells) {
      if (c.t - t > WIN.good) break;
      if (c.judged || t - c.t > WIN.good || c.pad !== pad) continue;
      const d = Math.abs(t - c.t);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) {
      // 칠 칸이 없거나 다른 패드 = 헛침 (콤보 끊김)
      this.counts.wrong++;
      this.combo = 0;
      this.fx.push({ kind: 'pad', pad, judge: 'wrong', at: t });
      return 'wrong';
    }
    const j = padJudge(t - best.t);
    best.judged = j;
    best.dt = t - best.t;
    best.at = t;
    this.counts[j]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += pointsFor(j, this.combo);
    this.fx.push({ kind: 'pad', pad, judge: j, at: t, dt: t - best.t });
    return j;
  }

  /** 지나간 칸 = MISS (한 프레임 넉넉히) */
  sweep(t) {
    for (const c of this.cells) {
      if (c.t > t) break;
      if (c.judged || t - c.t <= WIN.good + 0.04) continue;
      c.judged = 'miss';
      c.at = t;
      this.counts.miss++;
      this.combo = 0;
    }
  }

  _tick() {
    const t = this.now();
    this.sweep(t);
    this._draw(t);
    if (t > this.lastT + Math.max(1, this.gap * 2)) this._finish();
  }

  result() {
    const n = this.cells.length;
    const c = this.counts;
    const acc = (c.perfect + c.great * 0.7 + c.good * 0.4) / Math.max(1, n + c.wrong * 0.5);
    return {
      score: this.score,
      cells: n,
      ...c,
      hit: c.perfect + c.great + c.good,
      accuracy: acc,
      maxCombo: this.maxCombo,
      stars: padStars(acc, c.miss),
      grade: padGrade(acc),
      full: c.miss === 0 && c.wrong === 0,
      diff: this.diff,
    };
  }

  _finish() {
    if (this.state !== 'playing') return;
    this._halt();
    this.state = 'over';
    this.stop();
    this.state = 'over';
    this.onEnd(this.result());
  }

  // ---------- 그리기 ----------
  /** 지금 칠 칸 번호(소수): 칸 한가운데 = 그 칸 시각 */
  _pos(t) {
    const cs = this.cells;
    if (t <= cs[0].t) return (t - cs[0].t) / this.gap;
    let lo = 0;
    let hi = cs.length - 1;
    if (t >= cs[hi].t) return hi + (t - cs[hi].t) / this.gap;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cs[m].t <= t) lo = m;
      else hi = m;
    }
    return lo + (t - cs[lo].t) / (cs[hi].t - cs[lo].t);
  }

  _draw(t) {
    const { g, W, H } = this;
    // 배경: 차분한 남색
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#171b3a');
    bg.addColorStop(0.6, '#1f2550');
    bg.addColorStop(1, '#141832');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const pos = this._pos(t);
    const curRow = Math.floor(Math.max(0, pos + 0.5) / PAD_COLS);
    // 지금 줄이 위에서 두 번째에 오게 (처음 줄은 맨 위)
    const want = clamp(curRow - 1, 0, Math.max(0, this.rows - 3));
    this.scroll += (want - this.scroll) * 0.2;
    if (Math.abs(want - this.scroll) < 0.002) this.scroll = want;

    this._drawGrid(t, pos);
    this._drawPads(t);
    this._drawHud(t);
    this._drawCount(t);
  }

  _cellXY(i) {
    const r = Math.floor(i / PAD_COLS);
    const c = i % PAD_COLS;
    return { x: this.gridX + c * (this.cell + this.gapPx), y: this.gridTop + (r - this.scroll) * this.rowH, r };
  }

  _drawGrid(t, pos) {
    const { g, cell } = this;
    g.save();
    rr(g, this.gridX - 8, this.gridTop - 6, this.gridW + 16, this.gridH + 6, 16);
    g.clip();
    const r0 = Math.max(0, Math.floor(this.scroll) - 1);
    const r1 = Math.min(this.rows, Math.ceil(this.scroll + this.gridH / this.rowH) + 1);
    const cur = Math.round(pos);
    for (let i = r0 * PAD_COLS; i < Math.min(this.cells.length, r1 * PAD_COLS); i++) {
      const c = this.cells[i];
      const p = PADS[c.pad];
      const { x, y } = this._cellXY(i);
      if (y > this.gridTop + this.gridH + 4 || y + cell < this.gridTop - 10) continue;
      const done = c.judged && c.judged !== 'miss';
      const since = c.at != null ? t - c.at : 9;
      const pop = done ? 1 + 0.12 * Math.max(0, 1 - since / 0.18) : 1;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const s = cell * pop;
      // 칸 바탕
      g.save();
      g.translate(cx, cy);
      rr(g, -s / 2, -s / 2, s, s, s * 0.2);
      if (done) {
        g.fillStyle = p.color;
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        rr(g, -s / 2, -s / 2, s, s * 0.45, s * 0.2);
        g.fill();
      } else if (c.judged === 'miss') {
        g.fillStyle = '#4a2433';
        g.fill();
      } else {
        g.fillStyle = this.hint ? p.color : '#3a4170';
        g.globalAlpha = this.hint ? 0.26 : 1;
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = this.hint ? p.color : 'rgba(255,255,255,0.14)';
        g.globalAlpha = this.hint ? 0.55 : 1;
        g.lineWidth = 2;
        g.stroke();
        g.globalAlpha = 1;
      }
      g.restore();
      // 모양
      const shapeCol = done ? 'rgba(20,20,40,0.75)' : c.judged === 'miss' ? 'rgba(255,120,120,0.45)' : this.hint ? '#ffffff' : 'rgba(255,255,255,0.88)';
      drawShape(g, p.shape, cx, cy, s * 0.36, shapeCol);
      if (c.judged === 'miss') {
        g.strokeStyle = 'rgba(255,110,110,0.8)';
        g.lineWidth = Math.max(2, cell * 0.05);
        g.beginPath();
        g.moveTo(cx - cell * 0.18, cy - cell * 0.18);
        g.lineTo(cx + cell * 0.18, cy + cell * 0.18);
        g.moveTo(cx + cell * 0.18, cy - cell * 0.18);
        g.lineTo(cx - cell * 0.18, cy + cell * 0.18);
        g.stroke();
      }
      // 판정 글자 (칸 위쪽에 작게)
      if (done && since < 0.7) {
        g.globalAlpha = Math.min(1, (0.7 - since) / 0.25);
        g.fillStyle = '#ffffff';
        g.font = font(cell * 0.17);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(JUDGE_TXT[c.judged], cx, y + cell * 0.14 - Math.min(1, since / 0.3) * cell * 0.06);
        g.globalAlpha = 1;
      }
      // 지금 칠 칸: 하얀 테두리
      if (i === cur && !c.judged && pos > -1.5) {
        const k = 1 - Math.min(1, Math.abs(pos - i));
        g.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * k})`;
        g.lineWidth = 3 + k * 2;
        rr(g, x - 3, y - 3, cell + 6, cell + 6, cell * 0.22);
        g.stroke();
      }
    }
    // 지나가는 빛 막대 (칸 한가운데 = 누를 때)
    if (pos > -PAD_COLS && pos < this.cells.length) {
      const i = Math.floor(pos + 0.5);
      const frac = pos + 0.5 - i; // 0 = 칸 왼쪽 끝, 0.5 = 한가운데
      const row = Math.floor(Math.max(0, i) / PAD_COLS);
      const col = ((Math.max(0, i) % PAD_COLS) + PAD_COLS) % PAD_COLS;
      const xx = this.gridX + col * (this.cell + this.gapPx) + frac * this.cell;
      const yy = this.gridTop + (row - this.scroll) * this.rowH;
      if (i >= 0) {
        const lg = g.createLinearGradient(xx - 10, 0, xx + 10, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(xx - 10, yy - 6, 20, this.cell + 12);
      }
    }
    g.restore();
    // 위·아래 끝 흐리게
    const fade = (y0, y1, up) => {
      const lg = g.createLinearGradient(0, y0, 0, y1);
      lg.addColorStop(up ? 1 : 0, 'rgba(31,37,80,0)');
      lg.addColorStop(up ? 0 : 1, 'rgba(31,37,80,0.95)');
      g.fillStyle = lg;
      g.fillRect(0, y0, this.W, y1 - y0);
    };
    fade(this.gridTop + this.gridH - this.rowH * 0.45, this.gridTop + this.gridH + 2, false);
  }

  _drawPads(t) {
    const { g } = this;
    for (const p of this.pads) {
      this.padPress[p.id] *= 0.82;
      const k = this.padPress[p.id];
      const last = [...this.fx].reverse().find((f) => f.kind === 'pad' && f.pad === p.id);
      const since = last ? t - last.at : 9;
      const sc = 1 - k * 0.06;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      g.save();
      g.translate(cx, cy);
      g.scale(sc, sc);
      // 그림자 + 몸통
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
      // 친 순간 고리 + 판정 글자
      if (since < 0.35 && last) {
        const a = 1 - since / 0.35;
        g.strokeStyle = last.judge === 'wrong' ? `rgba(255,110,110,${a})` : `rgba(255,255,255,${a})`;
        g.lineWidth = 4 * a + 1;
        rr(g, p.x - since * 60, p.y - since * 60, p.w + since * 120, p.h + since * 120, p.w * 0.2);
        g.stroke();
      }
      if (since < 0.55 && last) {
        g.globalAlpha = Math.min(1, (0.55 - since) / 0.2);
        g.fillStyle = JUDGE_COL[last.judge] || '#fff';
        g.font = font(Math.min(p.w * 0.2, 26));
        g.textAlign = 'center';
        g.fillText(JUDGE_TXT[last.judge], cx, p.y - 14 - since * 30);
        g.globalAlpha = 1;
      }
    }
    if (this.fx.length > 40) this.fx.splice(0, this.fx.length - 20);
  }

  _drawHud(t) {
    const { g, W } = this;
    this.shown += (this.score - this.shown) * 0.25;
    if (Math.abs(this.score - this.shown) < 1) this.shown = this.score;
    const y = this.hudH * 0.52;
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.textAlign = 'right';
    g.font = font(this.hudH * 0.4);
    g.fillText(Math.round(this.shown).toLocaleString(), W - 16, y);
    g.textAlign = 'left';
    g.font = font(this.hudH * 0.26);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(this.level.name, 58, y);
    if (this.combo >= 3) {
      g.textAlign = 'center';
      g.fillStyle = '#ffe27a';
      g.font = font(this.hudH * 0.32);
      g.fillText(`${this.combo} COMBO`, W / 2, this.hudH + 2);
    }
    // 진행 줄
    const k = clamp(t / this.lastT, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, this.hudH * 0.92, W, 3);
    g.fillStyle = '#ffb347';
    g.fillRect(0, this.hudH * 0.92, W * k, 3);
  }

  /** 시작 전 3·2·1 (이어 하기도) */
  _drawCount(t) {
    const { g } = this;
    let left = null;
    let per = 60 / this.level.bpm;
    if (this.resumeAt != null && t < this.resumeAt) {
      left = this.resumeAt - t;
      per = 0.6;
    } else if (t < this.cells[0].t) left = this.cells[0].t - t;
    if (left == null || left <= 0.02) return;
    const n = Math.ceil(left / per - 0.001);
    if (n > 3) return;
    const txt = String(n);
    g.save();
    g.fillStyle = 'rgba(15,18,40,0.55)';
    g.beginPath();
    g.arc(this.W / 2, this.gridTop + this.gridH * 0.5, this.cell * 0.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = font(this.cell * 0.8);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, this.W / 2, this.gridTop + this.gridH * 0.5 + 2);
    g.restore();
  }
}
