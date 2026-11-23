// 🎹 시즌 2 피아노 미리보기 (2026-11-23) — 두 방식을 쳐 보고 투표
//   A 'tiles' : 세로 화면 · 4줄 피아노 타일. 검은 타일이 내려오고 판정선에 닿을 때 누르면 그 음(+화음)이 피아노로
//              줄은 멜로디 움직임대로(올라가면 오른쪽, 내려가면 왼쪽, 같은 줄 연속 없음)
//   B 'keys'  : 가로 화면 · 아래 진짜 건반(흰 건반 10개 안팎 + 검은 건반)에 계이름 색 막대가 위에서 떨어짐,
//              누른 건반 음이 그대로 남. 위에 쿵콩이·짝콩이가 반응
//   둘 다: 2분음표 이상은 꾹 누르기, 일찍 누르면 MISS(마구 누르기 막기), 칠 게 없는데 누르면 헛침, 일시정지·이어 하기
//   연습판: 기록·랭킹·코인·서버 요청 없음. 반주는 피아노 왼손만(SongPlayer pianoOnly)

import { parseMelody, tempoOf, COUNT_IN_BARS, STEPS_PER_BAR, JUDGE, POINTS, ACC_WEIGHT, CRASH, pianoHarmony } from './charts.js';
import { SongPlayer } from './audio.js';
import { buddyUrl } from './buddies.js';

/** 미리보기 곡 (퍼블릭 도메인 단계 곡의 멜로디) */
export const P2_SONGS = [
  { id: 1, diff: '쉬움' },
  { id: 2, diff: '쉬움' },
  { id: 11, diff: '보통' },
  { id: 12, diff: '어려움' },
];
export const P2_SOLFA = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
/** 계이름 색 (도~시, 반음은 아래 음 색) */
const SOLFA_COLOR = ['#a970f0', '#a970f0', '#f2962a', '#f2962a', '#53c22b', '#d23f8e', '#d23f8e', '#5f86f5', '#5f86f5', '#ee75bd', '#ee75bd', '#14bf99'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const pc = (m) => ((m % 12) + 12) % 12;
const isWhite = (m) => WHITE.includes(pc(m));
const HOLD_STEPS = 8; // 2분음표 이상이면 꾹 누르기
const HOLD_GRACE = 0.15; // 끝나기 이만큼 전에 떼도 성공
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
const JUDGE_NAME = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', wrong: 'MISS' };

/** 게임 단계 → 미리보기용 (멜로디는 내가 침, 반주는 피아노 왼손만) */
export function p2Level(level) {
  const dots = '.'.repeat(STEPS_PER_BAR);
  const song = { ...level.song, pianoLH: true, bass: dots, chord: dots, hat: dots, bells: undefined, glock: undefined, choir: undefined, audio: undefined, epic: false };
  // 짧은 멜로디는 30초쯤 되게 되풀이 (코드 진행도 멜로디 길이에 맞춰 같이)
  const bars = level.song.melody.length;
  const reps = Math.max(1, Math.ceil(30 / ((bars * 240) / level.bpm)));
  if (reps > 1) {
    song.melody = Array.from({ length: reps }, () => level.song.melody).flat();
    const prog = level.song.prog || ['C'];
    song.prog = Array.from({ length: bars }, (_, i) => prog[i % prog.length]);
  }
  return { ...level, song, tapMelody: true, pianoOnly: true, lanes: [CRASH], bars: song.melody.map(() => dots) };
}

/** 곡 → 칠 음표 [{ t, dur, end, midi, hold, bar, step }] (곡 시작 = 카운트인 첫 박 기준 초) */
export function p2Notes(level) {
  const tempo = tempoOf(level);
  return parseMelody(level.song.melody).map((n) => {
    const s0 = (COUNT_IN_BARS + n.bar) * STEPS_PER_BAR + n.step;
    const t = tempo.stepTime(s0);
    const end = tempo.stepTime(s0 + n.len);
    return { t, dur: end - t, end, midi: n.midi, hold: n.len >= HOLD_STEPS, bar: n.bar, step: n.step, len: n.len };
  });
}

/** A: 4줄 — 올라가면 오른쪽, 내려가면 왼쪽(크게 뛰면 두 칸), 같은 음은 옆 줄. 같은 줄 연속 없음 */
export function p2TileLanes(notes) {
  const out = [];
  let prev = -1;
  notes.forEach((n, i) => {
    let L;
    if (prev < 0) L = n.midi >= notes.reduce((a, x) => a + x.midi, 0) / notes.length ? 2 : 1;
    else {
      const d = n.midi - notes[i - 1].midi;
      const step = Math.abs(d) >= 5 ? 2 : 1;
      if (d > 0) L = prev + step <= 3 ? prev + step : prev - 1 - (i % 2);
      else if (d < 0) L = prev - step >= 0 ? prev - step : prev + 1 + (i % 2);
      else L = prev === 0 ? 1 : prev === 3 ? 2 : prev + (i % 2 ? 1 : -1);
      L = Math.max(0, Math.min(3, L));
      if (L === prev) L = prev === 0 ? 1 : prev - 1;
    }
    out.push(L);
    prev = L;
  });
  return out;
}

/** B: 쓸 건반 [{ midi, white }] — 곡 음역(검은 건반 포함), 흰 건반 10개 이상이 되게 양쪽으로 넓힘, 많아야 15개 */
export function p2Keys(notes, minWhite = 10, maxWhite = 15) {
  let lo = Math.min(...notes.map((n) => n.midi));
  let hi = Math.max(...notes.map((n) => n.midi));
  while (!isWhite(lo)) lo--;
  while (!isWhite(hi)) hi++;
  const whites = () => {
    let c = 0;
    for (let m = lo; m <= hi; m++) if (isWhite(m)) c++;
    return c;
  };
  let up = true;
  while (whites() < minWhite) {
    if (up) {
      hi++;
      while (!isWhite(hi)) hi++;
    } else {
      lo--;
      while (!isWhite(lo)) lo--;
    }
    up = !up;
  }
  while (whites() > maxWhite) {
    hi--;
    while (!isWhite(hi)) hi--;
  }
  const keys = [];
  for (let m = lo; m <= hi; m++) keys.push({ midi: m, white: isWhite(m) });
  return keys;
}

export const p2Solfa = (m) => P2_SOLFA[pc(m)];

/** 정확도 → 별 0~3 · 등급 */
export function p2Stars(acc, miss) {
  return acc >= 0.92 && miss === 0 ? 3 : acc >= 0.8 ? 2 : acc >= 0.6 ? 1 : 0;
}
export function p2Grade(acc) {
  return acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.6 ? 'C' : 'D';
}

let buddyImgs = null;
function buddies() {
  if (buddyImgs) return buddyImgs;
  buddyImgs = {};
  for (const who of ['kong', 'jjak']) for (const pose of ['idle', 'hit', 'miss', 'cheer']) {
    const im = new Image();
    im.src = buddyUrl(`${who}_${pose}`);
    buddyImgs[`${who}_${pose}`] = im;
  }
  return buddyImgs;
}

export class PianoPreview {
  /**
   * @param {{ audio, canvas, level, style: 'tiles'|'keys', rotated?: () => boolean, onEnd, onCombo? }} o
   *   rotated(): 가로 화면을 세로 폰에 90° 돌려 그리는 중인지 (터치 좌표를 돌려 읽음)
   */
  constructor({ audio, canvas, level, style, rotated, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.style = style;
    this.rotated = rotated || (() => false);
    this.onEnd = onEnd;
    this.base = level;
    this.level = p2Level(level);
    this.notes = p2Notes(this.level);
    if (style === 'keys') {
      this.keys = p2Keys(this.notes);
      const idx = new Map(this.keys.map((k, i) => [k.midi, i]));
      for (const n of this.notes) n.lane = idx.get(n.midi);
      if (typeof window !== 'undefined') buddies();
    } else {
      const lanes = p2TileLanes(this.notes);
      this.notes.forEach((n, i) => (n.lane = lanes[i]));
    }
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.items = this.notes.length + this.notes.filter((n) => n.hold).length; // 긴 음은 끝도 한 번 더
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.pressed = new Map(); // pointerId → { lane, note }
    this.fx = { flash: [], pops: [], rings: [], parts: [], bad: [] };
    this.mood = { kong: { pose: 'idle', until: 0 }, jjak: { pose: 'idle', until: 0 } };
    this.lastEnd = this.notes.reduce((a, n) => Math.max(a, n.end), 0);
    this.beat = 60 / this.level.bpm;
    this.state = 'ready';
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    this._resize = () => this.resize();
  }

  // ---------- 시작·멈춤 ----------
  start() {
    this.audio.ensure();
    this.resize();
    window.addEventListener('resize', this._resize);
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, this._onUp);
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

  /** 일시정지 (꾹 누르던 음은 거기까지로 판정) */
  pause() {
    if (this.state !== 'playing') return false;
    const t = this.now();
    this.pausedAt = t;
    for (const n of this.notes) if (n.holding) {
      n.holding = false;
      this._tail(n, t >= n.end - HOLD_GRACE * 2, t);
    }
    this.pressed.clear();
    this._halt();
    this.state = 'paused';
    this._draw(t);
    return true;
  }

  /** 이어 하기: 1.8초 앞에서 다시 흘러 3·2·1 뒤 멈춘 자리 */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.resumeAt = this.pausedAt;
    this._play(this.audio.ctx.currentTime + 1.8 - this.pausedAt);
  }

  stop() {
    this._halt();
    this.state = 'stopped';
    window.removeEventListener('resize', this._resize);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    for (const ev of ['pointerup', 'pointercancel']) c.removeEventListener(ev, this._onUp);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
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
    if (this.style === 'tiles') {
      this.laneW = W / 4;
      this.judgeY = H * 0.8;
      this.speed = (H * 0.25) / this.beat; // 4분음표 하나 = 화면 높이 1/4
      this.look = this.judgeY / this.speed + 0.2;
      return;
    }
    // 건반: 위 정보 줄 → 떨어지는 칸 → 건반
    const side = Math.max(10, W * 0.025);
    this.hudH = Math.max(46, H * 0.15);
    const nWhite = this.keys.filter((k) => k.white).length;
    this.keyW = (W - side * 2) / nWhite;
    this.kbH = Math.min(H * 0.36, this.keyW * 2.6);
    this.kbY = H - this.kbH - Math.max(6, H * 0.02);
    this.judgeY = this.kbY;
    this.speed = (this.judgeY - this.hudH) / Math.max(1.25, this.beat * 2.1);
    this.look = (this.judgeY - this.hudH) / this.speed + 0.15;
    // 건반 칸 (흰 건반 차례대로, 검은 건반은 두 흰 건반 사이 가운데)
    let wi = 0;
    this.cols = this.keys.map((k) => {
      if (k.white) {
        const x = side + wi * this.keyW;
        wi++;
        return { x, w: this.keyW, white: true };
      }
      const bw = this.keyW * 0.62;
      return { x: side + wi * this.keyW - bw / 2, w: bw, white: false };
    });
    this.blackH = this.kbH * 0.56;
  }

  /** 지금 곡 시각 (귀에 들리는 소리 기준) */
  now(perfMs = performance.now()) {
    return this.audio.heardTime(perfMs) - this.startTime;
  }

  // ---------- 입력 ----------
  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    if (this.rotated()) return { x: e.clientY - r.top, y: r.right - e.clientX };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _laneAt(x, y) {
    if (this.style === 'tiles') {
      if (y < this.H * 0.18) return -1;
      return Math.max(0, Math.min(3, Math.floor(x / this.laneW)));
    }
    if (y < this.judgeY - (this.judgeY - this.hudH) * 0.45) return -1;
    // 검은 건반 먼저 (건반 윗부분과 그 위 칸)
    if (y < this.kbY + this.blackH) {
      for (let i = 0; i < this.cols.length; i++) {
        const c = this.cols[i];
        if (!c.white && x >= c.x && x < c.x + c.w) return i;
      }
    }
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      if (c.white && x >= c.x && x < c.x + c.w) return i;
    }
    // 양 끝 바깥: 가장 가까운 흰 건반
    let best = 0;
    let bd = Infinity;
    this.cols.forEach((c, i) => {
      const d = Math.abs(c.x + c.w / 2 - x);
      if (c.white && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  _down(e) {
    e.preventDefault();
    if (this.state !== 'playing') return;
    const { x, y } = this._local(e);
    const lane = this._laneAt(x, y);
    if (lane < 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    const t = this.now();
    const rt = this.audio.ctx.currentTime;
    // 이 줄에서 가장 가까운 안 친 콩
    let best = null;
    let early = null;
    for (const n of this.notes) {
      if (n.lane !== lane || n.judged) continue;
      const dt = t - n.t;
      if (dt < -JUDGE.early) break;
      if (Math.abs(dt) <= JUDGE.good) {
        if (!best || Math.abs(dt) < Math.abs(t - best.t)) best = n;
      } else if (dt < -JUDGE.good && !early) early = n;
    }
    const press = { lane, note: null, x, y };
    this.pressed.set(e.pointerId, press);
    this.fx.flash.push({ lane, at: t });
    if (best) {
      const dt = Math.abs(t - best.t);
      const kind = dt <= JUDGE.perfect ? 'perfect' : dt <= JUDGE.great ? 'great' : 'good';
      best.judged = kind;
      best.hitAt = t;
      this._sound(best, rt);
      this._count(kind, best, t);
      this._burst(best, kind, t, x);
      if (best.hold) {
        best.holding = true;
        press.note = best;
      }
    } else if (early) {
      // 너무 일찍 누름: 그 콩은 MISS (마구 누르기 막기)
      early.judged = 'miss';
      early.missAt = t;
      if (this.style === 'keys') this._keySound(lane, rt, 0.5);
      this._count('miss', early, t);
      if (early.hold) this._tail(early, false, t);
    } else {
      // 칠 콩이 없는데 누름 = 헛침
      if (this.style === 'keys') this._keySound(lane, rt, 0.55);
      this.counts.wrong++;
      this._breakCombo();
      this.fx.bad.push({ lane, at: t, y });
      this.fx.pops.push({ kind: 'wrong', lane, at: t });
      this._mood(lane, 'miss', t, 0.5);
    }
  }

  _up(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    this.pressed.delete(e.pointerId);
    const n = p.note;
    if (n && n.holding) {
      n.holding = false;
      const t = this.now();
      this._tail(n, t >= n.end - HOLD_GRACE, t);
    }
  }

  _tail(n, ok, t) {
    if (n.tail) return;
    n.tail = ok ? 'perfect' : 'miss';
    n.tailAt = t;
    if (ok) {
      this._count('perfect', n, t, true);
      this._burst(n, 'perfect', t, null, true);
    } else this._count('miss', n, t, true);
  }

  _breakCombo() {
    this.combo = 0;
  }

  _count(kind, n, t, tail = false) {
    this.counts[kind]++;
    if (kind === 'miss') {
      this._breakCombo();
      this._mood(n.lane, 'miss', t, 0.7);
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round(POINTS[kind] * (1 + Math.min(this.combo, 100) / 100));
      if (this.combo % 10 === 0) {
        this._mood(-1, 'cheer', t, 0.9);
        this.comboPopAt = t;
      } else if (kind === 'perfect') this._mood(n.lane, 'hit', t, 0.22);
    }
    if (!tail || kind === 'miss') this.fx.pops.push({ kind, lane: n.lane, at: t });
  }

  /** 마스코트 표정 (건반: 왼쪽 반 = 쿵콩이, 오른쪽 반 = 짝콩이, -1 = 둘 다) */
  _mood(lane, pose, t, dur) {
    if (this.style !== 'keys') return;
    const half = this.keys.length / 2;
    const who = lane < 0 ? ['kong', 'jjak'] : [lane < half ? 'kong' : 'jjak'];
    for (const w of who) {
      const m = this.mood[w];
      if (m.pose === 'cheer' && m.until > t && pose === 'hit') continue;
      m.pose = pose;
      m.until = t + dur;
    }
  }

  _sound(n, rt) {
    const a = this.audio;
    const dur = Math.min(1.8, Math.max(0.3, n.dur * 0.95));
    try {
      if (a.piano) a.pianoNote(rt, n.midi, dur, 0.95, a.sfxBus);
      else a.lead(rt, n.midi, dur, a.sfxBus);
      // 타일: 오른손 화음까지 (건반은 누른 음만)
      if (this.style === 'tiles') for (const h of pianoHarmony(this.level.song, n.bar, n.step, n.midi, n.len >= 4)) a.pianoOr('lead', rt, h, dur, a.sfxBus, 0.5);
    } catch {}
  }

  _keySound(lane, rt, vel) {
    const a = this.audio;
    try {
      if (a.piano) a.pianoNote(rt, this.keys[lane].midi, 0.35, vel, a.sfxBus);
      else a.lead(rt, this.keys[lane].midi, 0.3, a.sfxBus);
    } catch {}
  }

  _color(n) {
    return this.style === 'keys' ? SOLFA_COLOR[pc(n.midi)] : '#ff8a4c';
  }

  /** 맞힌 자리: 퍼지는 고리 + 튀는 조각 */
  _burst(n, kind, t, x, tail = false) {
    let cx;
    if (this.style === 'tiles') cx = (n.lane + 0.5) * this.laneW;
    else cx = this.cols[n.lane].x + this.cols[n.lane].w / 2;
    const col = kind === 'perfect' ? (this.style === 'keys' ? this._color(n) : '#ff8a4c') : kind === 'great' ? '#3d8bff' : '#25b865';
    this.fx.rings.push({ x: cx, y: this.judgeY, at: t, color: col, big: tail });
    const k = kind === 'perfect' ? 10 : 6;
    for (let i = 0; i < k; i++) {
      const a = -Math.PI * (0.1 + 0.8 * Math.random());
      const v = (this.style === 'keys' ? 140 : 220) * (0.5 + Math.random());
      this.fx.parts.push({ x: cx + (Math.random() - 0.5) * 20, y: this.judgeY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: t, life: 0.45 + Math.random() * 0.25, color: col, s: 3 + Math.random() * 4, star: kind === 'perfect' && i % 3 === 0 });
    }
  }

  get accuracy() {
    const c = this.counts;
    const got = c.perfect * ACC_WEIGHT.perfect + c.great * ACC_WEIGHT.great + c.good * ACC_WEIGHT.good;
    return got / Math.max(1, this.items + c.wrong);
  }

  result() {
    const c = this.counts;
    const acc = this.accuracy;
    return { score: this.score, accuracy: acc, maxCombo: this.maxCombo, ...c, items: this.items, full: c.miss === 0 && c.wrong === 0, stars: p2Stars(acc, c.miss), grade: p2Grade(acc) };
  }

  // ---------- 매 화면 ----------
  _tick() {
    const t = this.now();
    for (const n of this.notes) {
      if (!n.judged && t - n.t > JUDGE.good) {
        n.judged = 'miss';
        n.missAt = t;
        this._count('miss', n, t);
        if (n.hold) this._tail(n, false, t); // 머리를 놓치면 끝도 놓침
      }
      if (n.holding && t >= n.end) {
        n.holding = false;
        this._tail(n, true, t);
      }
    }
    if (t > this.lastEnd + 1.4) {
      this.stop();
      this.state = 'ended';
      this._draw(t);
      if (this.onEnd) this.onEnd(this.result());
      return;
    }
    this._draw(t);
  }

  _draw(t) {
    const g = this.g;
    g.save();
    if (this.style === 'keys') this._drawKeys(g, t);
    else this._drawTiles(g, t);
    this._drawFx(g, t);
    this._drawCount(g, t);
    g.restore();
    const old = t - 1.2;
    for (const k of Object.keys(this.fx)) this.fx[k] = this.fx[k].filter((f) => f.at > old);
  }

  /** 3 · 2 · 1 (처음과 이어 하기) */
  _drawCount(g, t) {
    const first = this.resumeAt != null ? this.resumeAt : this.notes.length ? this.notes[0].t : 0;
    const left = first - t;
    if (left <= 0.05 || left > this.beat * 3.2 + (this.resumeAt != null ? 0.6 : 0)) {
      if (left <= 0.05) this.resumeAt = null;
      return;
    }
    const k = Math.min(3, Math.ceil((left / (this.beat * 3)) * 3 - 0.001));
    const frac = (left / (this.beat * 3)) * 3 - (k - 1);
    const s = 1 + (frac - 0.5) * 0.35;
    const cx = this.W / 2;
    const cy = this.style === 'keys' ? (this.hudH + this.judgeY) / 2 : this.H * 0.42;
    const R = Math.min(this.W, this.H) * 0.13;
    g.save();
    g.globalAlpha = Math.min(1, frac * 2.2);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ff8a4c';
    g.beginPath();
    g.arc(cx, cy, R * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (frac % 1)), false);
    g.lineTo(cx, cy);
    g.closePath();
    g.globalAlpha *= 0.18;
    g.fill();
    g.globalAlpha = Math.min(1, frac * 2.2);
    g.fillStyle = '#3b2a4a';
    g.font = font(R * 1.25 * s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(k), cx, cy + R * 0.06);
    g.restore();
  }

  // ======== A: 피아노 타일 (세로) ========
  _drawTiles(g, t) {
    const { W, H, laneW, judgeY, speed } = this;
    // 바닥: 따뜻한 흰색 + 줄 칸
    g.fillStyle = '#fbf8f3';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      if (i % 2) {
        g.fillStyle = '#f6f1ea';
        g.fillRect(i * laneW, 0, laneW, H);
      }
    }
    // 누르는 자리 띠
    const zone = g.createLinearGradient(0, judgeY - 30, 0, H);
    zone.addColorStop(0, 'rgba(255,138,76,0)');
    zone.addColorStop(0.25, 'rgba(255,138,76,0.07)');
    zone.addColorStop(1, 'rgba(255,138,76,0.13)');
    g.fillStyle = zone;
    g.fillRect(0, judgeY - 30, W, H - judgeY + 30);
    // 누른 줄 빛
    for (const f of this.fx.flash) {
      const a = Math.max(0, 1 - (t - f.at) / 0.22);
      if (a <= 0) continue;
      const gr = g.createLinearGradient(0, judgeY - H * 0.35, 0, H);
      gr.addColorStop(0, 'rgba(255,170,120,0)');
      gr.addColorStop(1, `rgba(255,170,120,${0.35 * a})`);
      g.fillStyle = gr;
      g.fillRect(f.lane * laneW, judgeY - H * 0.35, laneW, H);
    }
    for (const [, p] of this.pressed) {
      g.fillStyle = 'rgba(255,170,120,0.16)';
      g.fillRect(p.lane * laneW, judgeY, laneW, H - judgeY);
    }
    // 헛침: 그 자리 빨간 칸
    for (const b of this.fx.bad) {
      const a = Math.max(0, 1 - (t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.45 * a})`;
      g.fillRect(b.lane * laneW + 2, judgeY - laneW * 0.1, laneW - 4, H - judgeY + laneW * 0.1);
    }
    // 줄 경계
    g.fillStyle = '#e8e1d6';
    for (let i = 1; i < 4; i++) g.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 타일
    const gap = 3;
    for (const n of this.notes) {
      const dt = n.t - t;
      if (dt > this.look) break;
      const yB = judgeY - dt * speed;
      const len = Math.max(this.beat * speed * 0.48, n.dur * speed) - gap;
      if (yB - len > H + 10) continue;
      const done = n.judged && n.judged !== 'miss';
      if (done && !n.hold && t - n.hitAt > 0.35) continue;
      if (n.hold && n.tail && t - n.tailAt > 0.35 && n.tail !== 'miss') continue;
      if (n.judged === 'miss' && t - n.missAt > 0.7) continue;
      const x = n.lane * laneW + 2;
      const w = laneW - 4;
      this._tile(g, n, x, yB - len, w, len, t, done);
    }
    // 판정선
    g.fillStyle = 'rgba(59,42,74,0.22)';
    g.fillRect(0, judgeY, W, 2);
    // 위: 진행 줄 · 점수 · 콤보
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    const top = 12;
    g.fillStyle = 'rgba(59,42,74,0.1)';
    rr(g, 70, top + 6, W - 140, 8, 4);
    g.fill();
    const pg = g.createLinearGradient(70, 0, W - 70, 0);
    pg.addColorStop(0, '#ffb27e');
    pg.addColorStop(1, '#ff5fa2');
    g.fillStyle = pg;
    rr(g, 70, top + 6, Math.max(8, (W - 140) * p), 8, 4);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.font = font(Math.min(52, W * 0.13));
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = '#fbf8f3';
    g.strokeText(this.score.toLocaleString(), W / 2, top + 26);
    g.fillStyle = '#3b2a4a';
    g.fillText(this.score.toLocaleString(), W / 2, top + 26);
    if (this.combo >= 2) {
      const pop = this.comboPopAt != null ? Math.max(0, 1 - (t - this.comboPopAt) / 0.3) : 0;
      g.font = font(Math.min(22, W * 0.055) * (1 + pop * 0.35));
      g.lineWidth = 5;
      g.strokeText(`${this.combo} 콤보`, W / 2, top + 26 + Math.min(56, W * 0.14));
      g.fillStyle = pop > 0 ? '#ff5fa2' : '#ff8a4c';
      g.fillText(`${this.combo} 콤보`, W / 2, top + 26 + Math.min(56, W * 0.14));
    }
  }

  _tile(g, n, x, y, w, h, t, done) {
    const r = Math.min(10, w * 0.12);
    if (n.judged === 'miss' && !n.holding) {
      // 놓친 타일: 빨갛게 깜빡
      const blink = Math.floor((t - n.missAt) / 0.12) % 2 === 0;
      g.fillStyle = blink ? '#ff4d6d' : '#c9324f';
      rr(g, x, y, w, h, r);
      g.fill();
      return;
    }
    if (done && !n.hold) {
      // 친 타일: 옅게 남았다 사라짐
      const a = Math.max(0, 1 - (t - n.hitAt) / 0.35);
      g.fillStyle = `rgba(59,42,74,${0.16 * a})`;
      rr(g, x, y, w, h, r);
      g.fill();
      return;
    }
    // 검은 타일 (위 빛 줄 + 아래 그림자)
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#3a3450');
    gr.addColorStop(1, '#17141f');
    g.fillStyle = gr;
    rr(g, x, y, w, h, r);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    rr(g, x + 4, y + 3, w - 8, Math.min(6, h * 0.2), 3);
    g.fill();
    if (n.hold) {
      const y0 = this.judgeY;
      // 가운데 줄 + 아래 동그라미 = 꾹
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + w / 2 - 2, y + 14, 4, Math.max(0, h - 40));
      // 누르는 동안 아래부터 차오름
      if (n.holding || n.tail === 'perfect') {
        const fillTop = Math.max(y, y0 - (Math.min(t, n.end) - n.t) * this.speed);
        const fg = g.createLinearGradient(0, y + h, 0, y);
        fg.addColorStop(0, '#ffb27e');
        fg.addColorStop(1, '#ff5fa2');
        g.save();
        rr(g, x, y, w, h, r);
        g.clip();
        g.fillStyle = fg;
        g.fillRect(x, fillTop, w, y + h - fillTop);
        g.restore();
        if (n.holding) {
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fillRect(x + 6, fillTop - 2, w - 12, 3);
        }
      }
      const cy = y + h - Math.min(26, h * 0.3);
      g.fillStyle = n.holding ? '#fff' : 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x + w / 2, cy, Math.min(9, w * 0.1), 0, Math.PI * 2);
      g.fill();
    }
  }

  // ======== B: 건반 (가로) ========
  _drawKeys(g, t) {
    const { W, H, judgeY, kbY, kbH, hudH, speed } = this;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    // 떨어지는 칸: 흰 건반 줄은 아주 옅게 번갈아
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      g.fillStyle = i % 2 ? '#f8f7fb' : '#fcfbfe';
      g.fillRect(c.x, hudH, c.w, judgeY - hudH);
    });
    g.fillStyle = '#efedf4';
    this.cols.forEach((c) => {
      if (c.white) g.fillRect(Math.round(c.x) - 0.5, hudH, 1, judgeY - hudH);
    });
    // 누른 건반 빛 기둥
    const held = new Set([...this.pressed.values()].map((p) => p.lane));
    for (const f of this.fx.flash) {
      const a = Math.max(0, 1 - (t - f.at) / 0.25);
      if (a > 0 && !held.has(f.lane)) this._column(g, f.lane, a * 0.5);
    }
    for (const l of held) this._column(g, l, 0.5);
    // 떨어지는 막대
    g.save();
    g.beginPath();
    g.rect(0, hudH, W, judgeY - hudH);
    g.clip();
    const label = Math.min(this.keyW * 0.42, H * 0.06);
    for (const n of this.notes) {
      const dt = n.t - t;
      if (dt > this.look) break;
      const done = n.judged && n.judged !== 'miss';
      if (done && !n.holding) continue;
      if (n.judged === 'miss' && t - n.missAt > 0.5) continue;
      const c = this.cols[n.lane];
      const pad = c.white ? Math.max(3, c.w * 0.1) : 2;
      const yHead = judgeY - dt * speed;
      const len = Math.max(c.w * 0.5, n.dur * speed - Math.max(4, speed * 0.035));
      const yTop = yHead - len;
      const yBot = n.holding ? judgeY : yHead;
      if (yBot < hudH - 4 || yBot <= yTop) continue;
      const x = c.x + pad;
      const w = c.w - pad * 2;
      const col = SOLFA_COLOR[pc(n.midi)];
      const r = Math.min(12, w * 0.32);
      g.globalAlpha = n.judged === 'miss' ? 0.28 : 1;
      g.fillStyle = shade(col, -0.22);
      rr(g, x, yTop + 4, w, yBot - yTop, r);
      g.fill();
      g.fillStyle = col;
      rr(g, x, yTop, w, yBot - yTop - 3, r);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.32)';
      rr(g, x + w * 0.2, yTop + 5, w * 0.6, Math.min(5, (yBot - yTop) * 0.2), 2.5);
      g.fill();
      if (n.holding) {
        const pulse = 0.25 + 0.15 * Math.sin(t * 18);
        g.fillStyle = `rgba(255,255,255,${pulse})`;
        rr(g, x, yTop, w, yBot - yTop - 3, r);
        g.fill();
      }
      if (yBot - yTop > label * 1.2 && w > label * 0.9) {
        g.fillStyle = '#fff';
        g.font = font(Math.min(label, w * 0.62));
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillText(p2Solfa(n.midi), x + w / 2, yBot - 7);
      }
      g.globalAlpha = 1;
    }
    g.restore();
    // 건반
    this._keyboard(g, t, held);
    // 판정선 (건반 윗면)
    g.fillStyle = 'rgba(88,204,2,0.55)';
    g.fillRect(this.cols[0].x, judgeY - 2, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 2);
    // 위 정보 줄
    this._keysHud(g, t);
  }

  _column(g, lane, a) {
    const c = this.cols[lane];
    const col = SOLFA_COLOR[pc(this.keys[lane].midi)];
    const top = this.judgeY - (this.judgeY - this.hudH) * 0.6;
    const gr = g.createLinearGradient(0, top, 0, this.judgeY);
    gr.addColorStop(0, hexA(col, 0));
    gr.addColorStop(1, hexA(col, a * 0.5));
    g.fillStyle = gr;
    g.fillRect(c.x, top, c.w, this.judgeY - top);
  }

  _keyboard(g, t, held) {
    const { kbY, kbH } = this;
    const lip = Math.max(5, kbH * 0.07);
    // 흰 건반
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      const k = this.keys[i];
      const col = SOLFA_COLOR[pc(k.midi)];
      const down = held.has(i);
      const dy = down ? lip * 0.6 : 0;
      const x = c.x + 2;
      const w = c.w - 4;
      g.fillStyle = col;
      rr(g, x, kbY + lip, w, kbH - lip, 12);
      g.fill();
      g.fillStyle = down ? tint(col, 0.8) : '#ffffff';
      rr(g, x, kbY + dy, w, kbH - lip, 12);
      g.fill();
      g.strokeStyle = down ? col : '#dddbe4';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = col;
      g.font = font(Math.min(c.w * 0.42, kbH * 0.2));
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(p2Solfa(k.midi), x + w / 2, kbY + kbH - lip - kbH * 0.1 + dy);
    });
    // 검은 건반
    this.cols.forEach((c, i) => {
      if (c.white) return;
      const down = held.has(i);
      const dy = down ? 3 : 0;
      const bl = Math.max(4, this.blackH * 0.1);
      g.fillStyle = '#26242c';
      rr(g, c.x, kbY - 2, c.w, this.blackH, 9);
      g.fill();
      g.fillStyle = down ? shade(SOLFA_COLOR[pc(this.keys[i].midi)], -0.15) : '#4a4852';
      rr(g, c.x, kbY - 2 + dy, c.w, this.blackH - bl, 9);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      rr(g, c.x + c.w * 0.18, kbY + 4 + dy, c.w * 0.64, 4, 2);
      g.fill();
    });
  }

  _keysHud(g, t) {
    const { W, hudH } = this;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, hudH);
    const midY = hudH * 0.5;
    // 마스코트 (왼쪽 쿵콩이, 오른쪽 짝콩이)
    const imgs = buddyImgs || {};
    const size = hudH * 1.05;
    const pose = (w) => {
      const m = this.mood[w];
      return m.until > t ? m.pose : 'idle';
    };
    const bob = (w) => (pose(w) === 'hit' ? -3 : pose(w) === 'cheer' ? -6 * Math.abs(Math.sin(t * 14)) : Math.sin(t * 3 + (w === 'kong' ? 0 : 1.5)) * 1.5);
    const kong = imgs[`kong_${pose('kong')}`];
    const jjak = imgs[`jjak_${pose('jjak')}`];
    const bx0 = 70;
    if (kong && kong.complete && kong.naturalWidth) g.drawImage(kong, bx0, midY - size / 2 + bob('kong'), size, size);
    if (jjak && jjak.complete && jjak.naturalWidth) g.drawImage(jjak, W - 150 - size, midY - size / 2 + bob('jjak'), size, size);
    // 진행 줄
    const px0 = bx0 + size + 14;
    const px1 = W - 150 - size - 14;
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    g.fillStyle = '#ecebf1';
    rr(g, px0, midY - 6, px1 - px0, 12, 6);
    g.fill();
    g.fillStyle = '#58cc02';
    rr(g, px0, midY - 6, Math.max(12, (px1 - px0) * p), 12, 6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    rr(g, px0 + 6, midY - 4, Math.max(0, (px1 - px0) * p - 12), 3, 1.5);
    g.fill();
    // 콤보 (진행 줄 아래)
    if (this.combo >= 2) {
      const pop = this.comboPopAt != null ? Math.max(0, 1 - (t - this.comboPopAt) / 0.3) : 0;
      g.font = font(Math.min(18, hudH * 0.3) * (1 + pop * 0.35));
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillStyle = pop > 0 ? '#ff5fa2' : '#ff8a4c';
      g.fillText(`${this.combo} 콤보`, (px0 + px1) / 2, midY + 9);
    }
    // 점수
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = '#3b2a4a';
    g.font = font(Math.min(30, hudH * 0.48));
    g.fillText(this.score.toLocaleString(), W - 16, midY);
  }

  // ======== 효과 · 판정 글자 ========
  _drawFx(g, t) {
    for (const r of this.fx.rings) {
      const k = (t - r.at) / (r.big ? 0.45 : 0.32);
      if (k < 0 || k > 1) continue;
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = r.color;
      g.lineWidth = (r.big ? 7 : 5) * (1 - k) + 1;
      g.beginPath();
      const R = (this.style === 'keys' ? this.keyW * 0.35 : this.laneW * 0.28) * (0.6 + k * (r.big ? 1.6 : 1.1));
      g.ellipse(r.x, r.y, R, R * (this.style === 'keys' ? 0.55 : 0.5), 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const p of this.fx.parts) {
      const dt = t - p.at;
      if (dt < 0 || dt > p.life) continue;
      const k = dt / p.life;
      const x = p.x + p.vx * dt;
      const y = p.y + p.vy * dt + 420 * dt * dt;
      g.globalAlpha = 1 - k;
      g.fillStyle = p.color;
      if (p.star) star(g, x, y, p.s * 1.6, dt * 8);
      else {
        g.beginPath();
        g.arc(x, y, p.s * (1 - k * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // 판정 글자: 판정선 위 — 타일은 줄마다 마지막 것, 건반은 줄이 좁아서 가장 최근 것 하나만
    const seen = new Set();
    for (let i = this.fx.pops.length - 1; i >= 0; i--) {
      const p = this.fx.pops[i];
      if (seen.has(p.lane) || (this.style === 'keys' && seen.size)) continue;
      seen.add(p.lane);
      const k = (t - p.at) / 0.55;
      if (k < 0 || k > 1) continue;
      let cx;
      let w;
      if (this.style === 'tiles') {
        cx = (p.lane + 0.5) * this.laneW;
        w = this.laneW;
      } else {
        const c = this.cols[p.lane];
        cx = c.x + c.w / 2;
        w = Math.max(this.keyW, c.w) * 1.3;
      }
      const name = JUDGE_NAME[p.kind];
      const color = { perfect: '#ff7a3d', great: '#3d8bff', good: '#25b865', miss: '#9a94ae', wrong: '#ff4d6d' }[p.kind];
      const pop = k < 0.15 ? 0.7 + (k / 0.15) * 0.45 : 1.15 - Math.min(0.15, (k - 0.15) * 0.5);
      const size = (this.style === 'keys' ? Math.min(this.H * 0.075, 30) : Math.min(w * 0.3, 30)) * pop;
      if (this.style === 'keys') cx = Math.max(size * 2.6, Math.min(this.W - size * 2.6, cx));
      const y = this.judgeY - (this.style === 'keys' ? this.H * 0.09 : this.H * 0.06) - k * 14;
      g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(3, size * 0.22);
      g.strokeStyle = '#ffffff';
      g.strokeText(name, cx, y);
      g.fillStyle = color;
      g.fillText(name, cx, y);
    }
    g.globalAlpha = 1;
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
function star(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr2 = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  g.closePath();
  g.fill();
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
  const [r, g, b] = rgbOf(hex).map((c) => Math.max(0, Math.round(c * (1 + k))));
  return `rgb(${r},${g},${b})`;
}
function tint(hex, k) {
  const [r, g, b] = rgbOf(hex).map((c) => Math.round(c + (255 - c) * k));
  return `rgb(${r},${g},${b})`;
}
