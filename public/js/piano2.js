// 🎹 시즌 2 피아노 미리보기 (2026-11-23) — 두 방식을 쳐 보고 투표
//   A 'tiles' : 세로 화면 · 4줄 피아노 타일. 검은 타일이 내려오고 판정선에 닿을 때 누르면 그 음(+화음)이 피아노로
//              줄은 멜로디 움직임대로(올라가면 오른쪽, 내려가면 왼쪽, 같은 줄 연속 없음)
//              타일은 모두 같은 크기, 꾹 누르기 없음 (11-23 사용자)
//   B 'keys'  : 가로 화면 · 아래 진짜 피아노 건반(흰 건반 10개 안팎 + 검은 건반)에 빛 막대가 위에서 떨어짐(글자 없음),
//              누른 건반 음이 그대로 남. 위에 쿵콩이·짝콩이가 반응. 막대 길이만큼 꾹 누르면 점수 더
//   판정: 앞뒤 0.12초 안 = PERFECT, 0.18초 안 = GREAT (넉넉하게 — 웬만하면 PERFECT, 11-23 사용자)
//   ⚡ 점점 빠르게(fast): 곡을 길게 되풀이하며 마디마다 빨라짐(끝에 1.6배). 화면은 박자 기준이라 타일 간격은 그대로
//   연습판: 기록·랭킹·코인·서버 요청 없음. 반주는 피아노 왼손만(SongPlayer pianoOnly)

import { parseMelody, tempoOf, TempoMap, COUNT_IN_BARS, STEPS_PER_BAR, CRASH, pianoHarmony } from './charts.js';
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
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const pc = (m) => ((m % 12) + 12) % 12;
const isWhite = (m) => WHITE.includes(pc(m));
/** 맞힘으로 치는 범위(초, 앞뒤). 넉넉하게 */
export const P2_HIT_WIN = 0.18;
/** 이 안이면 PERFECT */
export const P2_PERFECT = 0.12;
const HIT_POINTS = { perfect: 1000, great: 650 };
const HOLD_POINTS = 900; // 꾹 누르는 1초마다 (건반만)
/** ⚡ 점점 빠르게: 끝에서 이만큼 (1.6 = 1.6배) */
export const P2_FAST_MAX = 1.6;
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;

/** 게임 단계 → 미리보기용 (멜로디는 내가 침, 반주는 피아노 왼손만). fast = 점점 빠르게 */
export function p2Level(level, { fast = false } = {}) {
  const dots = '.'.repeat(STEPS_PER_BAR);
  const song = { ...level.song, pianoLH: true, bass: dots, chord: dots, hat: dots, bells: undefined, glock: undefined, choir: undefined, audio: undefined, epic: false };
  // 짧은 멜로디는 30초쯤(빨라지기면 55초쯤) 되게 되풀이 (코드 진행도 멜로디 길이에 맞춰 같이)
  const bars = level.song.melody.length;
  const reps = Math.max(1, Math.ceil((fast ? 55 : 30) / ((bars * 240) / level.bpm)));
  if (reps > 1) {
    song.melody = Array.from({ length: reps }, () => level.song.melody).flat();
    const prog = level.song.prog || ['C'];
    song.prog = Array.from({ length: bars }, (_, i) => prog[i % prog.length]);
  }
  const out = { ...level, song, tapMelody: true, pianoOnly: true, lanes: [CRASH], bars: song.melody.map(() => dots) };
  delete out.tempo;
  if (fast) {
    const total = song.melody.length;
    out.fast = true;
    out.tempo = new TempoMap((bar) => level.bpm * p2FastMult(bar - COUNT_IN_BARS, total));
  }
  return out;
}

/** 점점 빠르게: 곡 마디 b (0 부터) 의 빠르기 배수. 처음 1배 → 끝 P2_FAST_MAX */
export function p2FastMult(b, total) {
  const k = Math.max(0, Math.min(1, b / Math.max(1, total - 1)));
  return 1 + (P2_FAST_MAX - 1) * k;
}

/** 곡 → 칠 음표 [{ t, dur, end, midi, bar, step, len, beat, lenB }] (곡 시작 = 카운트인 첫 박 기준 초, beat = 박 위치) */
export function p2Notes(level) {
  const tempo = tempoOf(level);
  return parseMelody(level.song.melody).map((n) => {
    const s0 = (COUNT_IN_BARS + n.bar) * STEPS_PER_BAR + n.step;
    const t = tempo.stepTime(s0);
    const end = tempo.stepTime(s0 + n.len);
    return { t, dur: end - t, end, midi: n.midi, bar: n.bar, step: n.step, len: n.len, beat: s0 / 4, lenB: n.len / 4 };
  });
}

/** 판정: 시간 차(초) → 'perfect' | 'great' | null(못 맞힘) */
export function p2Judge(dt) {
  const a = Math.abs(dt);
  return a <= P2_PERFECT ? 'perfect' : a <= P2_HIT_WIN ? 'great' : null;
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

/** A: 모든 타일 같은 크기(박 단위) — 같은 줄 다음 타일과 안 겹치게, 0.4~0.95박 */
export function p2TileBeats(notes, lanes) {
  let min = Infinity;
  const last = [null, null, null, null];
  notes.forEach((n, i) => {
    const L = lanes[i];
    if (last[L] != null) min = Math.min(min, n.beat - last[L]);
    last[L] = n.beat;
  });
  return Math.max(0.4, Math.min(0.95, (isFinite(min) ? min : 1) * 0.9));
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

/** 맞힌 비율 → 별 0~3 · 등급 */
export function p2Stars(acc, miss) {
  return acc >= 0.95 && miss === 0 ? 3 : acc >= 0.85 ? 2 : acc >= 0.6 ? 1 : 0;
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

/** 건반 빛 색: 왼쪽(낮은 음) 하늘색 → 파랑 → 보라 → 오른쪽 분홍 */
function laneHue(i, n) {
  return 188 + (n > 1 ? i / (n - 1) : 0) * 140;
}

export class PianoPreview {
  /**
   * @param {{ audio, canvas, level, style: 'tiles'|'keys', fast?: boolean, rotated?: () => boolean, onEnd }} o
   *   rotated(): 가로 화면을 세로 폰에 90° 돌려 그리는 중인지 (터치 좌표를 돌려 읽음)
   */
  constructor({ audio, canvas, level, style, fast, rotated, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.style = style;
    this.rotated = rotated || (() => false);
    this.onEnd = onEnd;
    this.level = p2Level(level, { fast: !!fast });
    this.tempo = tempoOf(this.level);
    this.baseBpm = level.bpm;
    this.notes = p2Notes(this.level);
    if (style === 'keys') {
      this.keys = p2Keys(this.notes);
      const idx = new Map(this.keys.map((k, i) => [k.midi, i]));
      for (const n of this.notes) {
        n.lane = idx.get(n.midi);
        n.holdable = true; // 건반은 모든 음을 막대 길이만큼 꾹
      }
      this.hues = this.keys.map((_, i) => laneHue(i, this.keys.length));
      if (typeof window !== 'undefined') buddies();
    } else {
      const lanes = p2TileLanes(this.notes);
      this.notes.forEach((n, i) => {
        n.lane = lanes[i];
        n.holdable = false; // 타일은 꾹 없음
      });
      this.tileB = p2TileBeats(this.notes, lanes);
    }
    this.lanes = style === 'keys' ? this.keys.length : 4;
    this.counts = { hit: 0, perfect: 0, great: 0, miss: 0, wrong: 0 };
    this.holdSec = 0; // 꾹 누른 시간
    this.holdMax = this.notes.filter((n) => n.holdable).reduce((a, n) => a + n.dur, 0);
    this.bonus = 0;
    this.score = 0;
    this.shown = 0; // 화면에 보이는 점수 (부드럽게 따라감)
    this.combo = 0;
    this.maxCombo = 0;
    this.topSpeed = 1;
    this.speedNow = 1;
    this.pressed = new Map(); // pointerId → { lane, note, x, y }
    this.press = new Float32Array(this.lanes); // 건반·줄 눌림 0~1 (부드럽게)
    this.fx = { flash: [], pops: [], rings: [], parts: [], bad: [] };
    this.mood = { kong: { pose: 'idle', until: 0 }, jjak: { pose: 'idle', until: 0 } };
    this.lastEnd = this.notes.reduce((a, n) => Math.max(a, n.end), 0);
    this.beat = 60 / this.level.bpm;
    this.state = 'ready';
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    this._onMove = (e) => this._move(e);
  }

  // ---------- 시작·멈춤 ----------
  start() {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointermove', this._onMove);
    for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, this._onUp);
    this._play(this.audio.ctx.currentTime + 0.35);
  }

  _play(startTime) {
    this.startTime = startTime;
    this.player = new SongPlayer(this.audio, this.level, startTime);
    this.player.start();
    this.state = 'playing';
    this.lastFrame = performance.now();
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

  /** 일시정지 (꾹 누르던 음은 거기까지) */
  pause() {
    if (this.state !== 'playing') return false;
    const t = this.now();
    this.pausedAt = t;
    for (const p of this.pressed.values()) if (p.note) this._release(p.note, t, p);
    this.pressed.clear();
    this.press.fill(0);
    this._halt();
    this.state = 'paused';
    this._draw(t, 0);
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
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointermove', this._onMove);
    for (const ev of ['pointerup', 'pointercancel']) c.removeEventListener(ev, this._onUp);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._bgCache = null;
    this._layout();
    if (this.state === 'paused') this._draw(this.pausedAt, 0);
  }

  _layout() {
    const { W, H } = this;
    if (this.style === 'tiles') {
      this.laneW = W / 4;
      this.judgeY = H * 0.8;
      // 박 하나의 높이: 타일이 화면 1/5쯤 되게 (0.22~0.4 화면)
      this.ppb = Math.max(H * 0.22, Math.min(H * 0.4, (H * 0.2) / this.tileB));
      this.tileH = this.tileB * this.ppb;
      this.lookB = (this.judgeY + this.tileH) / this.ppb + 0.2;
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
    // 화면 높이에 박 몇 개: 1.25초어치 또는 2.1박 중 큰 쪽 (처음 빠르기 기준)
    this.ppb = (this.judgeY - this.hudH) / Math.max(1.25 / this.beat, 2.1);
    this.lookB = (this.judgeY - this.hudH) / this.ppb + 0.2;
    let wi = 0;
    this.cols = this.keys.map((k) => {
      if (k.white) {
        const x = side + wi * this.keyW;
        wi++;
        return { x, w: this.keyW, white: true };
      }
      const bw = this.keyW * 0.6;
      return { x: side + wi * this.keyW - bw / 2, w: bw, white: false };
    });
    this.blackH = this.kbH * 0.6;
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
    if (y < this.kbY + this.blackH) {
      for (let i = 0; i < this.cols.length; i++) {
        const c = this.cols[i];
        if (!c.white && x >= c.x && x < c.x + c.w) return i;
      }
    }
    let best = 0;
    let bd = Infinity;
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      if (x >= c.x && x < c.x + c.w) {
        bd = -1;
        best = i;
      } else if (bd >= 0) {
        const d = Math.abs(c.x + c.w / 2 - x);
        if (d < bd) {
          bd = d;
          best = i;
        }
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
    // 이 줄에서 가장 가까운 안 친 음 (앞뒤 P2_HIT_WIN 안이면 맞힘)
    let best = null;
    for (const n of this.notes) {
      if (n.lane !== lane || n.hit || n.miss) continue;
      const dt = t - n.t;
      if (dt < -P2_HIT_WIN) break;
      if (Math.abs(dt) <= P2_HIT_WIN && (!best || Math.abs(dt) < Math.abs(t - best.t))) best = n;
    }
    const press = { lane, note: null, x, y, at: t };
    this.pressed.set(e.pointerId, press);
    this.fx.flash.push({ lane, at: t });
    if (best) {
      best.hit = true;
      best.hitAt = t;
      best.hitX = x;
      best.hitY = y;
      this._sound(best, rt);
      this._hit(best, t, p2Judge(t - best.t) || 'great');
      this._burst(best, t, x, y);
      if (best.holdable) {
        best.holding = true;
        best.heldTo = Math.max(t, best.t);
        best.bonus = 0;
        press.note = best;
      }
    } else {
      // 칠 게 없는데 누름 = 헛침 (건반은 그 음이 남)
      if (this.style === 'keys') this._keySound(lane, rt, 0.55);
      this.counts.wrong++;
      this.combo = 0;
      this.fx.bad.push({ lane, at: t, x, y });
      this.fx.pops.push({ kind: 'wrong', lane, at: t });
      this._mood(lane, 'miss', t, 0.5);
    }
  }

  _move(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    p.y = this._local(e).y;
  }

  _up(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    this.pressed.delete(e.pointerId);
    if (p.note && p.note.holding) this._release(p.note, this.now(), p);
  }

  /** 꾹 누르던 손을 뗌 (또는 음이 끝남): 그때까지 쌓인 보너스를 보여 줌 */
  _release(n, t) {
    this._credit(n, t);
    n.holding = false;
    n.releasedAt = t;
    // 긴 음만 '+보너스' 글자 (짧은 음까지 띄우면 어지러움)
    if (n.bonus >= 150 && n.dur >= this.beat * 1.5) this.fx.pops.push({ kind: 'bonus', lane: n.lane, at: t, v: Math.round(n.bonus) });
  }

  /** 꾹 누른 만큼 점수 (음 끝까지만) */
  _credit(n, t) {
    const to = Math.min(t, n.end);
    if (to <= n.heldTo) return;
    const sec = to - n.heldTo;
    n.heldTo = to;
    this.holdSec += sec;
    const pts = sec * HOLD_POINTS * (1 + Math.min(this.combo, 100) / 200);
    n.bonus += pts;
    this.bonus += pts;
    this.score += pts;
  }

  _hit(n, t, kind) {
    this.counts.hit++;
    this.counts[kind]++;
    n.judge = kind;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += HIT_POINTS[kind] * (1 + Math.min(this.combo, 100) / 100) * this.speedNow;
    this.comboAt = t;
    this.fx.pops.push({ kind, lane: n.lane, at: t });
    if (this.combo % 10 === 0) {
      this._mood(-1, 'cheer', t, 0.9);
      this.comboBig = t;
    } else this._mood(n.lane, 'hit', t, 0.22);
  }

  _missNote(n, t) {
    n.miss = true;
    n.missAt = t;
    this.counts.miss++;
    this.combo = 0;
    this.fx.pops.push({ kind: 'miss', lane: n.lane, at: t });
    this._mood(n.lane, 'miss', t, 0.7);
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

  _laneX(lane) {
    if (this.style === 'tiles') return (lane + 0.5) * this.laneW;
    const c = this.cols[lane];
    return c.x + c.w / 2;
  }

  _laneColor(lane, l = 66, a = 1) {
    return `hsla(${this.hues[lane]},95%,${l}%,${a})`;
  }

  /** 맞힌 자리: 퍼지는 고리 + 빛 알갱이 */
  _burst(n, t, x, y) {
    const keys = this.style === 'keys';
    const col = keys ? this._laneColor(n.lane, 70) : '#ffc35c';
    const cx = keys ? this._laneX(n.lane) : this._laneX(n.lane);
    const cy = keys ? this.judgeY : this.judgeY - this.tileH * 0.5;
    this.fx.rings.push({ x: cx, y: cy, at: t, color: col });
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * (0.1 + 0.8 * Math.random());
      const v = 110 + Math.random() * 120;
      this.fx.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: t, life: 0.45 + Math.random() * 0.25, color: col, s: 2 + Math.random() * 2.5 });
    }
  }

  get accuracy() {
    const c = this.counts;
    return c.hit / Math.max(1, this.notes.length + c.wrong);
  }

  result() {
    const c = this.counts;
    const acc = this.accuracy;
    return {
      score: Math.round(this.score),
      accuracy: acc,
      maxCombo: this.maxCombo,
      ...c,
      notes: this.notes.length,
      bonus: Math.round(this.bonus),
      holdMax: this.holdMax,
      holdPct: this.holdMax ? Math.min(1, this.holdSec / this.holdMax) : 0,
      topSpeed: this.topSpeed,
      full: c.miss === 0 && c.wrong === 0,
      stars: p2Stars(acc, c.miss),
      grade: p2Grade(acc),
    };
  }

  // ---------- 매 화면 ----------
  _tick() {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    const t = this.now(nowMs);
    for (const n of this.notes) {
      if (!n.hit && !n.miss && t - n.t > P2_HIT_WIN) this._missNote(n, t);
      if (n.holding) {
        this._credit(n, t);
        if (t >= n.end) this._release(n, t);
      }
    }
    if (t > this.lastEnd + 1.4) {
      this.stop();
      this.state = 'ended';
      this._draw(t, dt);
      if (this.onEnd) this.onEnd(this.result());
      return;
    }
    this._draw(t, dt);
  }

  _draw(t, dt = 0) {
    // 지금 박 위치 · 빠르기
    this.bNow = this.tempo.beatAt(t);
    if (this.level.fast) {
      this.speedNow = this.tempo.bpm(Math.max(0, Math.floor(this.bNow / 4))) / this.baseBpm;
      if (t > 0 && t < this.lastEnd) this.topSpeed = Math.max(this.topSpeed, this.speedNow);
    }
    // 부드럽게 따라가는 값들: 점수 숫자, 줄·건반 눌림
    this.shown += (this.score - this.shown) * Math.min(1, dt * 10);
    if (Math.abs(this.score - this.shown) < 1) this.shown = this.score;
    const held = new Set([...this.pressed.values()].map((p) => p.lane));
    for (let i = 0; i < this.lanes; i++) {
      const target = held.has(i) ? 1 : 0;
      const rate = target ? 40 : 12;
      this.press[i] += (target - this.press[i]) * Math.min(1, dt * rate);
    }
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
    const s = 0.85 + 0.25 * ease((1 - frac) * 3);
    const cx = this.W / 2;
    const cy = this.style === 'keys' ? (this.hudH + this.judgeY) / 2 : this.H * 0.42;
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

  /** ⚡ ×1.25 (점점 빠르게일 때만) */
  _drawSpeed(g, x, y, size, color) {
    if (!this.level.fast) return;
    g.save();
    g.font = font(size);
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(`⚡ ×${this.speedNow.toFixed(2)}`, x, y);
    g.restore();
  }

  // ======== A: 피아노 타일 (세로) ========
  _tilesBg(g) {
    const { W, H } = this;
    if (!this._bgCache) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#fff8ee');
      bg.addColorStop(0.55, '#fdf0f3');
      bg.addColorStop(1, '#efe8ff');
      const zone = g.createLinearGradient(0, this.judgeY - this.tileH, 0, H);
      zone.addColorStop(0, 'rgba(255,190,110,0)');
      zone.addColorStop(0.5, 'rgba(255,190,110,0.10)');
      zone.addColorStop(1, 'rgba(255,170,140,0.18)');
      const line = g.createLinearGradient(0, 0, W, 0);
      line.addColorStop(0, 'rgba(255,196,92,0)');
      line.addColorStop(0.2, '#ffc45c');
      line.addColorStop(0.8, '#ff8fb8');
      line.addColorStop(1, 'rgba(255,143,184,0)');
      const div = g.createLinearGradient(0, 0, 0, H);
      div.addColorStop(0, 'rgba(150,120,190,0)');
      div.addColorStop(0.5, 'rgba(150,120,190,0.16)');
      div.addColorStop(1, 'rgba(150,120,190,0.26)');
      this._bgCache = { bg, zone, line, div };
    }
    return this._bgCache;
  }

  _drawTiles(g, t) {
    const { W, H, laneW, judgeY, ppb, tileH } = this;
    const C = this._tilesBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // 천천히 떠오르는 빛 방울
    for (let i = 0; i < 7; i++) {
      const r = (0.08 + (i % 4) * 0.035) * W;
      const x = ((i * 0.293 + 0.11) % 1) * W + Math.sin(t * 0.5 + i) * 12;
      const span = H + r * 2;
      const y = H + r - ((t * (14 + (i % 3) * 7) + i * 211) % span);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const hue = i % 2 ? '255,186,140' : '196,160,255';
      gr.addColorStop(0, `rgba(${hue},0.22)`);
      gr.addColorStop(1, `rgba(${hue},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = C.zone;
    g.fillRect(0, judgeY - tileH, W, H - judgeY + tileH);
    // 누른 줄 빛 (부드럽게 켜지고 꺼짐)
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.01) continue;
      const gr = g.createLinearGradient(0, judgeY - H * 0.35, 0, H);
      gr.addColorStop(0, 'rgba(255,200,120,0)');
      gr.addColorStop(1, `rgba(255,180,120,${0.38 * a})`);
      g.fillStyle = gr;
      g.fillRect(i * laneW, judgeY - H * 0.35, laneW, H * 0.35 + H - judgeY);
    }
    // 헛침: 그 칸이 빨갛게 (부드럽게 사라짐)
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.38 * a})`;
      rr(g, b.lane * laneW + 3, judgeY - tileH, laneW - 6, H - judgeY + tileH - 4, 12);
      g.fill();
    }
    g.fillStyle = C.div;
    for (let i = 1; i < 4; i++) g.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 타일 (모두 같은 크기, 아래 끝이 판정선에 닿을 때 누름)
    const gap = 4;
    const h = tileH - gap;
    for (const n of this.notes) {
      const d = n.beat - this.bNow;
      if (d > this.lookB) break;
      const yB = judgeY - d * ppb;
      if (yB - h > H + 10) continue;
      if (n.hit && t - n.hitAt > 0.32) continue;
      if (n.miss && t - n.missAt > 0.6) continue;
      this._tile(g, n, n.lane * laneW + 3, yB - h, laneW - 6, h, t);
    }
    // 판정선: 금빛
    g.fillStyle = 'rgba(255,190,110,0.18)';
    g.fillRect(0, judgeY - 5, W, 10);
    g.fillStyle = C.line;
    g.fillRect(0, judgeY - 1.5, W, 3);
    // 위: 진행 줄 · 점수 · 콤보
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    const top = 12;
    g.fillStyle = 'rgba(59,42,74,0.1)';
    rr(g, 70, top + 6, W - 140, 8, 4);
    g.fill();
    if (!this._pg || this._pgW !== W) {
      this._pg = g.createLinearGradient(70, 0, W - 70, 0);
      this._pg.addColorStop(0, '#ffc45c');
      this._pg.addColorStop(1, '#ff6fae');
      this._pgW = W;
    }
    g.fillStyle = this._pg;
    rr(g, 70, top + 6, Math.max(8, (W - 140) * p), 8, 4);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    const sTxt = Math.round(this.shown).toLocaleString();
    g.font = font(Math.min(52, W * 0.13));
    g.lineWidth = 6;
    g.strokeStyle = '#fff8ee';
    g.strokeText(sTxt, W / 2, top + 26);
    g.fillStyle = '#3b2a4a';
    g.fillText(sTxt, W / 2, top + 26);
    this._drawCombo(g, t, W / 2, top + 26 + Math.min(58, W * 0.145), Math.min(22, W * 0.056), '#fff8ee');
    this._drawSpeed(g, W - 14, top + 44, Math.min(18, W * 0.045), '#ff7a2e');
  }

  /** 콤보 글자: 맞힐 때마다 살짝 통 튀고, 10콤보마다 크게 */
  _drawCombo(g, t, x, y, size, outline) {
    if (this.combo < 2) return;
    const k1 = this.comboAt != null ? 1 - ease((t - this.comboAt) / 0.18) : 0;
    const k2 = this.comboBig != null ? 1 - ease((t - this.comboBig) / 0.4) : 0;
    const s = 1 + 0.12 * k1 + 0.35 * k2;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.font = font(size);
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = outline;
    g.strokeText(`${this.combo} 콤보`, 0, 0);
    g.fillStyle = k2 > 0.05 ? '#ff5fa2' : '#ff8a4c';
    g.fillText(`${this.combo} 콤보`, 0, 0);
    g.restore();
  }

  _tile(g, n, x, y, w, h, t) {
    const r = Math.min(12, w * 0.14);
    if (n.miss) {
      // 놓친 타일: 빨갛게 됐다가 사라짐
      g.globalAlpha = 1 - ease((t - n.missAt) / 0.6);
      g.fillStyle = '#ff4d6d';
      rr(g, x, y, w, h, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    if (n.hit) {
      // 친 타일: 금빛으로 번쩍 → 살짝 커지며 사라짐
      const k = ease((t - n.hitAt) / 0.32);
      const sx = -w * 0.05 * k;
      const sy = -h * 0.05 * k;
      g.globalAlpha = 1 - k;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#fff6dc');
      gr.addColorStop(1, '#ffc35c');
      g.fillStyle = gr;
      rr(g, x + sx, y + sy, w - sx * 2, h - sy * 2, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    // 그림자
    g.fillStyle = 'rgba(40,20,60,0.16)';
    rr(g, x + 2, y + 5, w, h, r);
    g.fill();
    // 검은 유광 타일
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#3d3854');
    gr.addColorStop(0.5, '#1d1a2a');
    gr.addColorStop(1, '#0c0a12');
    g.fillStyle = gr;
    rr(g, x, y, w, h, r);
    g.fill();
    // 위쪽 빛 반사
    g.save();
    rr(g, x, y, w, h, r);
    g.clip();
    const gl = g.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,0.20)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h * 0.22);
    g.lineTo(x, y + h * 0.42);
    g.closePath();
    g.fill();
    // 아래 금빛 테두리 (누를 끝)
    g.fillStyle = '#ffc35c';
    g.fillRect(x, y + h - 3, w, 3);
    g.restore();
    // 가운데 작은 금빛 마름모
    const cx = x + w / 2;
    const cy = y + h * 0.62;
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

  // ======== B: 건반 (가로) ========
  _keysBg(g) {
    const { W, H, hudH, judgeY } = this;
    if (!this._bgCache) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#080a1a');
      bg.addColorStop(0.6, '#15103a');
      bg.addColorStop(1, '#241450');
      const floor = g.createLinearGradient(0, judgeY - (judgeY - hudH) * 0.35, 0, judgeY);
      floor.addColorStop(0, 'rgba(120,110,255,0)');
      floor.addColorStop(1, 'rgba(150,120,255,0.16)');
      const line = g.createLinearGradient(this.cols[0].x, 0, this.cols.at(-1).x + this.cols.at(-1).w, 0);
      line.addColorStop(0, this._laneColor(0, 70));
      line.addColorStop(1, this._laneColor(this.lanes - 1, 70));
      const hud = g.createLinearGradient(0, 0, 0, hudH);
      hud.addColorStop(0, 'rgba(8,10,26,0.96)');
      hud.addColorStop(1, 'rgba(8,10,26,0.7)');
      const pgr = g.createLinearGradient(0, 0, W, 0);
      pgr.addColorStop(0, '#6ee7ff');
      pgr.addColorStop(0.5, '#8a7dff');
      pgr.addColorStop(1, '#ff7ad9');
      this._bgCache = { bg, floor, line, hud, pgr };
    }
    return this._bgCache;
  }

  _drawKeys(g, t) {
    const { W, H, judgeY, hudH, ppb } = this;
    const C = this._keysBg(g);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    // 무대 조명 두 줄기 (천천히 흔들림)
    for (const side of [0, 1]) {
      const sw = Math.sin(t * 0.45 + side * 2) * W * 0.08;
      const x0 = side ? W * 0.82 : W * 0.18;
      const gr = g.createLinearGradient(0, 0, 0, judgeY);
      gr.addColorStop(0, side ? 'rgba(255,140,220,0.16)' : 'rgba(110,200,255,0.16)');
      gr.addColorStop(1, 'rgba(140,120,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0 - 14, 0);
      g.lineTo(x0 + 14, 0);
      g.lineTo(x0 + sw + W * 0.17, judgeY);
      g.lineTo(x0 + sw - W * 0.17, judgeY);
      g.closePath();
      g.fill();
    }
    // 반짝이는 작은 별
    for (let i = 0; i < 26; i++) {
      const x = ((i * 0.618 + 0.05) % 1) * W;
      const y = hudH + (((i * 0.377 + 0.1) % 1) * (judgeY - hudH) - t * (6 + (i % 4) * 3) + 4000) % (judgeY - hudH);
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1.5 + (i % 5) * 0.4) + i));
      g.fillStyle = `rgba(220,225,255,${a})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    g.fillStyle = C.floor;
    g.fillRect(0, judgeY - (judgeY - hudH) * 0.35, W, (judgeY - hudH) * 0.35);
    // 흰 건반 칸 안내선 (도 자리는 조금 밝게)
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      g.fillStyle = pc(this.keys[i].midi) === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
      g.fillRect(Math.round(c.x) - 0.5, hudH, 1, judgeY - hudH);
    });
    // 누른 건반 빛 기둥 (눌림 값 따라 부드럽게)
    for (let i = 0; i < this.lanes; i++) if (this.press[i] > 0.01) this._column(g, i, this.press[i]);
    // 떨어지는 빛 막대 (글자 없음)
    g.save();
    g.beginPath();
    g.rect(0, hudH, W, judgeY - hudH);
    g.clip();
    for (const n of this.notes) {
      const d = n.beat - this.bNow;
      if (d > this.lookB) break;
      if (n.miss && t - n.missAt > 0.45) continue;
      const fade = n.hit && !n.holding ? 1 - ease((t - (n.releasedAt ?? n.hitAt)) / 0.22) : 1;
      if (fade <= 0) continue;
      const c = this.cols[n.lane];
      const pad = c.white ? Math.max(3, c.w * 0.14) : 2;
      const yHead = judgeY - d * ppb;
      const len = Math.max(c.w * 0.45, n.lenB * ppb - Math.max(4, ppb * 0.05));
      const yTop = yHead - len;
      const yBot = n.hit ? Math.min(judgeY, yHead) : yHead;
      if (yBot < hudH - 4 || yBot <= yTop + 2) continue;
      const x = c.x + pad;
      const w = c.w - pad * 2;
      const r = Math.min(9, w * 0.35);
      const L = n.miss ? 0.3 * (1 - ease((t - n.missAt) / 0.45)) : 1;
      g.globalAlpha = L * fade;
      // 바깥 빛
      g.fillStyle = this._laneColor(n.lane, 62, n.holding ? 0.38 : 0.2);
      rr(g, x - 4, yTop - 4, w + 8, yBot - yTop + 8, r + 4);
      g.fill();
      // 몸통: 위는 진하게, 아래(건반 쪽)는 밝게
      const gr = g.createLinearGradient(0, yTop, 0, yBot);
      gr.addColorStop(0, this._laneColor(n.lane, c.white ? 48 : 42, 0.85));
      gr.addColorStop(1, this._laneColor(n.lane, c.white ? 74 : 66));
      g.fillStyle = gr;
      rr(g, x, yTop, w, yBot - yTop, r);
      g.fill();
      // 가운데 빛 줄
      g.fillStyle = 'rgba(255,255,255,0.35)';
      rr(g, x + w * 0.36, yTop + 4, w * 0.28, Math.max(0, yBot - yTop - 8), w * 0.14);
      g.fill();
      // 머리(건반 쪽 끝) 하얀 줄
      g.fillStyle = 'rgba(255,255,255,0.95)';
      rr(g, x + 2, yBot - 4, w - 4, 3, 1.5);
      g.fill();
      if (n.holding) {
        const pulse = 0.18 + 0.12 * Math.sin(t * 14);
        g.fillStyle = `rgba(255,255,255,${pulse})`;
        rr(g, x, yTop, w, yBot - yTop, r);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
    this._keyboard(g, t);
    // 판정선: 무지개 빛 줄
    g.fillStyle = 'rgba(180,160,255,0.22)';
    g.fillRect(this.cols[0].x, judgeY - 6, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 6);
    g.fillStyle = C.line;
    g.fillRect(this.cols[0].x, judgeY - 2.5, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 2.5);
    this._keysHud(g, t);
  }

  _column(g, lane, a) {
    const c = this.cols[lane];
    const top = this.judgeY - (this.judgeY - this.hudH) * 0.7;
    const gr = g.createLinearGradient(0, top, 0, this.judgeY);
    gr.addColorStop(0, this._laneColor(lane, 65, 0));
    gr.addColorStop(1, this._laneColor(lane, 65, a * 0.42));
    g.fillStyle = gr;
    g.fillRect(c.x, top, c.w, this.judgeY - top);
  }

  /** 진짜 피아노 같은 건반: 검은 건반 바닥 + 빨간 펠트 + 상아빛 흰 건반 + 유광 검은 건반 */
  _keyboard(g) {
    const { kbY, kbH, H } = this;
    const x0 = this.cols[0].x - 6;
    const x1 = this.cols.at(-1).x + this.cols.at(-1).w + 6;
    // 건반 바닥(검은 칠)
    const base = g.createLinearGradient(0, kbY - 6, 0, H);
    base.addColorStop(0, '#1a1822');
    base.addColorStop(1, '#050408');
    g.fillStyle = base;
    rr(g, x0, kbY - 6, x1 - x0, H - kbY + 6, 10);
    g.fill();
    const lip = Math.max(4, kbH * 0.05);
    const label = Math.min(this.keyW * 0.3, kbH * 0.12);
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      const p = this.press[i];
      const dy = lip * 0.8 * p;
      const x = c.x + 1.5;
      const w = c.w - 3;
      const top = kbY + 2;
      const hh = kbH - 2;
      // 아래 두께(앞면)
      g.fillStyle = p > 0.02 ? mix('#c9c4d4', '#a9a3b8', p) : '#c9c4d4';
      rr(g, x, top + lip, w, hh - lip, 7);
      g.fill();
      // 윗면
      const gr = g.createLinearGradient(0, top + dy, 0, top + dy + hh - lip);
      gr.addColorStop(0, '#dcd8e4');
      gr.addColorStop(0.12, '#fbfaff');
      gr.addColorStop(1, '#efedf5');
      g.fillStyle = gr;
      rr(g, x, top + dy, w, hh - lip, 7);
      g.fill();
      if (p > 0.02) {
        const tg = g.createLinearGradient(0, top + dy, 0, top + dy + hh - lip);
        tg.addColorStop(0, this._laneColor(i, 70, 0.7 * p));
        tg.addColorStop(1, this._laneColor(i, 80, 0.15 * p));
        g.fillStyle = tg;
        rr(g, x, top + dy, w, hh - lip, 7);
        g.fill();
      }
      g.fillStyle = 'rgba(150,140,170,0.75)';
      g.font = font(label);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(p2Solfa(this.keys[i].midi), x + w / 2, top + dy + hh - lip - label * 0.6);
    });
    this.cols.forEach((c, i) => {
      if (c.white) return;
      const p = this.press[i];
      const dy = 3 * p;
      const bl = Math.max(4, this.blackH * 0.09);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      rr(g, c.x + 2, kbY, c.w, this.blackH + 3, 5);
      g.fill();
      g.fillStyle = '#121117';
      rr(g, c.x, kbY - 1, c.w, this.blackH, 5);
      g.fill();
      const gr = g.createLinearGradient(c.x, 0, c.x + c.w, 0);
      gr.addColorStop(0, '#2c2a35');
      gr.addColorStop(0.5, '#44414f');
      gr.addColorStop(1, '#25232d');
      g.fillStyle = gr;
      rr(g, c.x + 1.5, kbY - 1 + dy, c.w - 3, this.blackH - bl, 4);
      g.fill();
      if (p > 0.02) {
        g.fillStyle = this._laneColor(i, 60, 0.55 * p);
        rr(g, c.x + 1.5, kbY - 1 + dy, c.w - 3, this.blackH - bl, 4);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.22)';
      rr(g, c.x + c.w * 0.25, kbY + 3 + dy, c.w * 0.5, this.blackH * 0.45, 2);
      g.fill();
    });
    // 빨간 펠트 (건반 위 가장자리)
    g.fillStyle = '#9e1430';
    g.fillRect(x0 + 4, kbY - 1, x1 - x0 - 8, 3);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x0 + 4, kbY + 2, x1 - x0 - 8, 2);
  }

  _keysHud(g, t) {
    const { W, hudH } = this;
    const C = this._keysBg(g);
    g.fillStyle = C.hud;
    g.fillRect(0, 0, W, hudH);
    const midY = hudH * 0.5;
    const imgs = buddyImgs || {};
    const size = hudH * 1.05;
    const pose = (w) => {
      const m = this.mood[w];
      return m.until > t ? m.pose : 'idle';
    };
    const bob = (w) => {
      const p = pose(w);
      if (p === 'cheer') return -6 * Math.abs(Math.sin(t * 12));
      if (p === 'hit') return -3 * (1 - ease((t - (this.mood[w].until - 0.22)) / 0.22));
      return Math.sin(t * 3 + (w === 'kong' ? 0 : 1.5)) * 1.5;
    };
    const kong = imgs[`kong_${pose('kong')}`];
    const jjak = imgs[`jjak_${pose('jjak')}`];
    const bx0 = 70;
    if (kong && kong.complete && kong.naturalWidth) g.drawImage(kong, bx0, midY - size / 2 + bob('kong'), size, size);
    if (jjak && jjak.complete && jjak.naturalWidth) g.drawImage(jjak, W - 150 - size, midY - size / 2 + bob('jjak'), size, size);
    const px0 = bx0 + size + 14;
    const px1 = W - 150 - size - 14;
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    g.fillStyle = 'rgba(255,255,255,0.12)';
    rr(g, px0, midY - 5, px1 - px0, 10, 5);
    g.fill();
    g.fillStyle = C.pgr;
    rr(g, px0, midY - 5, Math.max(10, (px1 - px0) * p), 10, 5);
    g.fill();
    this._drawCombo(g, t, (px0 + px1) / 2, midY + 9, Math.min(18, hudH * 0.3), '#0b0d1f');
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.font = font(Math.min(30, hudH * 0.48));
    g.fillText(Math.round(this.shown).toLocaleString(), W - 16, midY - (this.level.fast ? 7 : 0));
    this._drawSpeed(g, W - 16, midY + hudH * 0.27, Math.min(14, hudH * 0.24), '#ffd36b');
  }

  // ======== 효과 · 글자 ========
  _drawFx(g, t) {
    const keys = this.style === 'keys';
    for (const r of this.fx.rings) {
      const k = (t - r.at) / 0.4;
      if (k < 0 || k > 1) continue;
      const e = ease(k);
      g.globalAlpha = (1 - e) * 0.85;
      g.strokeStyle = r.color;
      g.lineWidth = 4 * (1 - e) + 1;
      const R = (keys ? this.keyW * 0.34 : this.laneW * 0.26) * (0.5 + e * 1.1);
      g.beginPath();
      g.ellipse(r.x, r.y, R, R * (keys ? 0.45 : 0.8), 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of this.fx.parts) {
      const d = t - p.at;
      if (d < 0 || d > p.life) continue;
      const k = d / p.life;
      const x = p.x + p.vx * d;
      const y = p.y + p.vy * d + 160 * d * d;
      g.globalAlpha = (1 - ease(k)) * 0.9;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(x, y, p.s * (1 - k * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 글자: PERFECT · GREAT · MISS(놓침·헛침) · 꾹 보너스(+점수)
    const seen = new Set();
    for (let i = this.fx.pops.length - 1; i >= 0; i--) {
      const p = this.fx.pops[i];
      // 타일은 줄마다 하나, 건반은 줄이 좁아서 화면에 하나만 (보너스는 따로)
      const bonus = p.kind === 'bonus';
      const key = keys ? (bonus ? 'b' : 'k') : bonus ? 'b' + p.lane : p.lane;
      if (seen.has(key)) continue;
      seen.add(key);
      const life = bonus ? 0.8 : p.kind === 'perfect' || p.kind === 'great' ? 0.45 : 0.55;
      const k = (t - p.at) / life;
      if (k < 0 || k > 1) continue;
      let cx = this._laneX(p.lane);
      const name = bonus ? `+${p.v.toLocaleString()}` : p.kind === 'perfect' ? 'PERFECT' : p.kind === 'great' ? 'GREAT' : 'MISS';
      const pop = k < 0.2 ? 0.7 + 0.4 * ease(k / 0.2) : 1.1 - 0.1 * ease((k - 0.2) / 0.8);
      const base = keys ? Math.min(this.H * 0.07, 28) : Math.min(this.laneW * (name.length > 5 ? 0.2 : 0.26), 26);
      const size = base * pop;
      if (keys) cx = Math.max(size * 3, Math.min(this.W - size * 3, cx));
      else cx = Math.max(size * 2.2, Math.min(this.W - size * 2.2, cx));
      const y = keys
        ? (bonus ? this.judgeY - this.H * 0.2 : this.judgeY - this.H * 0.1) - ease(k) * (bonus ? 30 : 12)
        : this.judgeY - this.tileH - this.H * 0.035 - ease(k) * (bonus ? 34 : 16);
      g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(3, size * 0.24);
      g.strokeStyle = keys ? 'rgba(8,10,26,0.9)' : '#ffffff';
      g.strokeText(name, cx, y);
      if (p.kind === 'perfect') {
        const tw = g.measureText(name).width / 2;
        const gr = g.createLinearGradient(cx - tw, y - size / 2, cx + tw, y + size / 2);
        gr.addColorStop(0, '#ffd24a');
        gr.addColorStop(0.5, '#ff8a3d');
        gr.addColorStop(1, '#ff5fa2');
        g.fillStyle = gr;
      } else g.fillStyle = bonus ? '#ff5fa2' : p.kind === 'great' ? '#3d9bff' : p.kind === 'wrong' ? '#ff4d6d' : '#9a94ae';
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
function rgbOf(c) {
  if (c[0] === '#') {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = c.match(/\d+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
}
function mix(a, b, k) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}
