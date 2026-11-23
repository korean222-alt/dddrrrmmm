// 🎹 시즌 2 피아노 미리보기 (2026-11-23) — 두 방식을 쳐 보고 투표
//   A 'tiles' : 세로 화면 · 4줄 피아노 타일. 검은 타일이 내려오고 판정선에 닿을 때 누르면 그 음(+화음)이 피아노로
//              줄은 멜로디 움직임대로(올라가면 오른쪽, 내려가면 왼쪽, 같은 줄 연속 없음)
//   B 'keys'  : 가로 화면 · 아래 진짜 건반(흰 건반 10개 안팎 + 검은 건반)에 계이름 색 막대가 위에서 떨어짐,
//              누른 건반 음이 그대로 남. 위에 쿵콩이·짝콩이가 반응
//   판정은 PERFECT 같은 단계 없이 '맞힘 / 놓침' 만 (11-23 사용자: 너무 깐깐함). 칠 게 없는데 누르면 헛침(콤보 끊김)
//   꾹 누르기 = 누르고 있는 동안 점수가 더 쌓임: 건반은 모든 음(막대 길이만큼), 타일은 긴 타일(2분음표 이상)
//   타일의 긴 타일 게이지는 손가락 자리에서 타일 위쪽으로 차오름(타일이 손가락 밑으로 지나간 만큼)
//   연습판: 기록·랭킹·코인·서버 요청 없음. 반주는 피아노 왼손만(SongPlayer pianoOnly)

import { parseMelody, tempoOf, COUNT_IN_BARS, STEPS_PER_BAR, CRASH, pianoHarmony } from './charts.js';
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
const HOLD_STEPS = 8; // 타일: 2분음표 이상이면 긴 타일(꾹)
/** 맞힘으로 치는 범위(초, 앞뒤). 넉넉하게 — 판정 단계 없음 */
export const P2_HIT_WIN = 0.18;
const HIT_POINTS = 1000;
const HOLD_POINTS = 900; // 꾹 누르는 1초마다
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;

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

export class PianoPreview {
  /**
   * @param {{ audio, canvas, level, style: 'tiles'|'keys', rotated?: () => boolean, onEnd }} o
   *   rotated(): 가로 화면을 세로 폰에 90° 돌려 그리는 중인지 (터치 좌표를 돌려 읽음)
   */
  constructor({ audio, canvas, level, style, rotated, onEnd }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.style = style;
    this.rotated = rotated || (() => false);
    this.onEnd = onEnd;
    this.level = p2Level(level);
    this.notes = p2Notes(this.level);
    if (style === 'keys') {
      this.keys = p2Keys(this.notes);
      const idx = new Map(this.keys.map((k, i) => [k.midi, i]));
      for (const n of this.notes) {
        n.lane = idx.get(n.midi);
        n.holdable = true; // 건반은 모든 음을 막대 길이만큼 꾹
      }
      if (typeof window !== 'undefined') buddies();
    } else {
      const lanes = p2TileLanes(this.notes);
      this.notes.forEach((n, i) => {
        n.lane = lanes[i];
        n.holdable = n.hold;
      });
    }
    this.lanes = style === 'keys' ? this.keys.length : 4;
    this.counts = { hit: 0, miss: 0, wrong: 0 };
    this.holdSec = 0; // 꾹 누른 시간
    this.holdMax = this.notes.filter((n) => n.holdable).reduce((a, n) => a + n.dur, 0);
    this.bonus = 0;
    this.score = 0;
    this.shown = 0; // 화면에 보이는 점수 (부드럽게 따라감)
    this.combo = 0;
    this.maxCombo = 0;
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
    this._layout();
    if (this.state === 'paused') this._draw(this.pausedAt, 0);
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
    // 이 줄에서 가장 가까운 안 친 콩 (앞뒤 P2_HIT_WIN 안이면 맞힘)
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
      this._hit(best, t);
      this._burst(best, t, x, y);
      if (best.holdable) {
        best.holding = true;
        best.heldTo = Math.max(t, best.t);
        best.bonus = 0;
        best.fingerY = y;
        best.fill = 0;
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
    if (!p || !p.note) return;
    const { y } = this._local(e);
    p.y = y;
    p.note.fingerY = y;
  }

  _up(e) {
    const p = this.pressed.get(e.pointerId);
    if (!p) return;
    this.pressed.delete(e.pointerId);
    if (p.note && p.note.holding) this._release(p.note, this.now(), p);
  }

  /** 꾹 누르던 손을 뗌 (또는 음이 끝남): 그때까지 쌓인 보너스를 보여 줌 */
  _release(n, t, p) {
    this._credit(n, t);
    n.holding = false;
    n.releasedAt = t;
    if (t >= n.end - 0.05) n.full = true; // 끝까지 누름 → 타일 게이지 가득
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

  _hit(n, t) {
    this.counts.hit++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += HIT_POINTS * (1 + Math.min(this.combo, 100) / 100);
    this.comboAt = t;
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

  /** 맞힌 자리: 손가락 자리에서 퍼지는 고리 + 몇 개 안 되는 부드러운 빛 알갱이 */
  _burst(n, t, x, y) {
    const col = this.style === 'keys' ? SOLFA_COLOR[pc(n.midi)] : '#ff8a4c';
    const cx = this.style === 'tiles' ? x : this._laneX(n.lane);
    const cy = this.style === 'tiles' ? Math.min(y, this.H - 20) : this.judgeY;
    this.fx.rings.push({ x: cx, y: cy, at: t, color: col });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * (0.15 + 0.7 * Math.random());
      const v = 90 + Math.random() * 90;
      this.fx.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: t, life: 0.5 + Math.random() * 0.2, color: col, s: 2.5 + Math.random() * 2.5 });
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
      holdPct: this.holdMax ? Math.min(1, this.holdSec / this.holdMax) : 0,
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

  _draw(t, dt) {
    // 부드럽게 따라가는 값들: 점수 숫자, 줄·건반 눌림
    this.shown += (this.score - this.shown) * Math.min(1, dt * 10);
    if (Math.abs(this.score - this.shown) < 1) this.shown = this.score;
    const held = new Set([...this.pressed.values()].map((p) => p.lane));
    for (let i = 0; i < this.lanes; i++) {
      const target = held.has(i) ? 1 : 0;
      const rate = target ? 40 : 14;
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

  // ======== A: 피아노 타일 (세로) ========
  _drawTiles(g, t) {
    const { W, H, laneW, judgeY, speed } = this;
    g.fillStyle = '#fbf8f3';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#f6f1ea';
    for (let i = 1; i < 4; i += 2) g.fillRect(i * laneW, 0, laneW, H);
    // 누르는 자리 띠
    if (!this._zone || this._zoneH !== H) {
      this._zone = g.createLinearGradient(0, judgeY - 30, 0, H);
      this._zone.addColorStop(0, 'rgba(255,138,76,0)');
      this._zone.addColorStop(0.25, 'rgba(255,138,76,0.07)');
      this._zone.addColorStop(1, 'rgba(255,138,76,0.13)');
      this._zoneH = H;
    }
    g.fillStyle = this._zone;
    g.fillRect(0, judgeY - 30, W, H - judgeY + 30);
    // 누른 줄 빛 (부드럽게 켜지고 꺼짐)
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.01) continue;
      const gr = g.createLinearGradient(0, judgeY - H * 0.3, 0, H);
      gr.addColorStop(0, 'rgba(255,170,120,0)');
      gr.addColorStop(1, `rgba(255,170,120,${0.32 * a})`);
      g.fillStyle = gr;
      g.fillRect(i * laneW, judgeY - H * 0.3, laneW, H * 0.3 + H - judgeY);
    }
    // 헛침: 그 칸이 빨갛게 (부드럽게 사라짐)
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = `rgba(255,77,109,${0.38 * a})`;
      rr(g, b.lane * laneW + 3, judgeY - 6, laneW - 6, H - judgeY, 10);
      g.fill();
    }
    g.fillStyle = '#e8e1d6';
    for (let i = 1; i < 4; i++) g.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 타일
    const gap = 3;
    for (const n of this.notes) {
      const d = n.t - t;
      if (d > this.look) break;
      const yB = judgeY - d * speed;
      const len = Math.max(this.beat * speed * 0.48, n.dur * speed) - gap;
      if (yB - len > H + 10) continue;
      if (n.hit && !n.holdable && t - n.hitAt > 0.3) continue;
      if (n.miss && t - n.missAt > 0.6) continue;
      if (n.hit && n.holdable && !n.holding && t - (n.releasedAt ?? n.end) > 0.4) continue;
      this._tile(g, n, n.lane * laneW + 2, yB - len, laneW - 4, len, t);
    }
    g.fillStyle = 'rgba(59,42,74,0.2)';
    g.fillRect(0, judgeY, W, 2);
    // 위: 진행 줄 · 점수 · 콤보
    const p = Math.max(0, Math.min(1, t / this.lastEnd));
    const top = 12;
    g.fillStyle = 'rgba(59,42,74,0.1)';
    rr(g, 70, top + 6, W - 140, 8, 4);
    g.fill();
    if (!this._pg || this._pgW !== W) {
      this._pg = g.createLinearGradient(70, 0, W - 70, 0);
      this._pg.addColorStop(0, '#ffb27e');
      this._pg.addColorStop(1, '#ff5fa2');
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
    g.strokeStyle = '#fbf8f3';
    g.strokeText(sTxt, W / 2, top + 26);
    g.fillStyle = '#3b2a4a';
    g.fillText(sTxt, W / 2, top + 26);
    this._drawCombo(g, t, W / 2, top + 26 + Math.min(58, W * 0.145), Math.min(22, W * 0.056), '#fbf8f3');
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
    const r = Math.min(10, w * 0.12);
    if (n.miss) {
      // 놓친 타일: 빨갛게 됐다가 사라짐
      const a = 1 - ease((t - n.missAt) / 0.6);
      g.globalAlpha = a;
      g.fillStyle = '#ff4d6d';
      rr(g, x, y, w, h, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    if (n.hit && !n.holdable) {
      // 친 타일: 살짝 작아지며 옅어짐
      const k = ease((t - n.hitAt) / 0.3);
      const sx = w * 0.06 * k;
      const sy = h * 0.06 * k;
      g.globalAlpha = (1 - k) * 0.9;
      g.fillStyle = '#d9cfe8';
      rr(g, x + sx, y + sy, w - sx * 2, h - sy * 2, r);
      g.fill();
      g.globalAlpha = 1;
      return;
    }
    if (n.hit && n.holdable && !n.holding) g.globalAlpha = 1 - ease((t - (n.releasedAt ?? n.end)) / 0.4);
    // 검은 타일 (위 빛 줄)
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#3a3450');
    gr.addColorStop(1, '#17141f');
    g.fillStyle = gr;
    rr(g, x, y, w, h, r);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    rr(g, x + 4, y + 3, w - 8, Math.min(6, h * 0.2), 3);
    g.fill();
    if (n.holdable) {
      const yB = y + h;
      // 가운데 줄 = 꾹
      g.fillStyle = 'rgba(255,255,255,0.16)';
      rr(g, x + w / 2 - 2, y + 14, 4, Math.max(0, h - 36), 2);
      g.fill();
      if (n.hit) {
        // 게이지: 타일 아래에서 손가락 자리까지 (타일이 손가락 밑으로 지나간 만큼 위로 차오름)
        if (n.holding) n.fill = Math.max(n.fill || 0, Math.min(h, yB - Math.min(yB, n.fingerY ?? this.judgeY)));
        const fh = n.full ? h : Math.min(h, n.fill || 0);
        if (fh > 0) {
          const fg = g.createLinearGradient(0, yB, 0, yB - Math.max(40, fh));
          fg.addColorStop(0, '#ffb27e');
          fg.addColorStop(1, '#ff5fa2');
          g.save();
          rr(g, x, y, w, h, r);
          g.clip();
          g.fillStyle = fg;
          g.fillRect(x, yB - fh, w, fh);
          if (n.holding) {
            // 손가락 자리: 빛나는 줄
            const glow = 0.75 + 0.25 * Math.sin(t * 16);
            g.fillStyle = `rgba(255,255,255,${glow})`;
            g.fillRect(x + 5, yB - fh - 2, w - 10, 4);
          }
          g.restore();
        }
      }
      const cy = yB - Math.min(24, h * 0.3);
      if (!n.hit) {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.arc(x + w / 2, cy, Math.min(9, w * 0.1), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // ======== B: 건반 (가로) ========
  _drawKeys(g, t) {
    const { W, H, judgeY, hudH, speed } = this;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      g.fillStyle = i % 2 ? '#f8f7fb' : '#fcfbfe';
      g.fillRect(c.x, hudH, c.w, judgeY - hudH);
    });
    g.fillStyle = '#efedf4';
    this.cols.forEach((c) => {
      if (c.white) g.fillRect(Math.round(c.x) - 0.5, hudH, 1, judgeY - hudH);
    });
    // 누른 건반 빛 기둥 (눌림 값 따라 부드럽게)
    for (let i = 0; i < this.lanes; i++) if (this.press[i] > 0.01) this._column(g, i, this.press[i] * 0.5);
    // 떨어지는 막대
    g.save();
    g.beginPath();
    g.rect(0, hudH, W, judgeY - hudH);
    g.clip();
    const label = Math.min(this.keyW * 0.42, H * 0.06);
    for (const n of this.notes) {
      const d = n.t - t;
      if (d > this.look) break;
      if (n.miss && t - n.missAt > 0.45) continue;
      const fade = n.hit && !n.holding ? 1 - ease((t - (n.releasedAt ?? n.hitAt)) / 0.22) : 1;
      if (fade <= 0) continue;
      const c = this.cols[n.lane];
      const pad = c.white ? Math.max(3, c.w * 0.1) : 2;
      const yHead = judgeY - d * speed;
      const len = Math.max(c.w * 0.5, n.dur * speed - Math.max(4, speed * 0.035));
      const yTop = yHead - len;
      const yBot = n.hit ? Math.min(judgeY, yHead) : yHead;
      if (yBot < hudH - 4 || yBot <= yTop + 2) continue;
      const x = c.x + pad;
      const w = c.w - pad * 2;
      const col = SOLFA_COLOR[pc(n.midi)];
      const r = Math.min(12, w * 0.32);
      g.globalAlpha = (n.miss ? 0.3 * (1 - ease((t - n.missAt) / 0.45)) : 1) * fade;
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
        // 꾹 누르는 중: 건반 쪽 끝이 빛나며 빨려 들어감
        const pulse = 0.22 + 0.12 * Math.sin(t * 14);
        g.fillStyle = `rgba(255,255,255,${pulse})`;
        rr(g, x, yTop, w, yBot - yTop - 3, r);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(x + 3, yBot - 6, w - 6, 3);
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
    this._keyboard(g, t);
    g.fillStyle = 'rgba(88,204,2,0.55)';
    g.fillRect(this.cols[0].x, judgeY - 2, this.cols.at(-1).x + this.cols.at(-1).w - this.cols[0].x, 2);
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

  _keyboard(g) {
    const { kbY, kbH } = this;
    const lip = Math.max(5, kbH * 0.07);
    this.cols.forEach((c, i) => {
      if (!c.white) return;
      const k = this.keys[i];
      const col = SOLFA_COLOR[pc(k.midi)];
      const p = this.press[i];
      const dy = lip * 0.65 * p;
      const x = c.x + 2;
      const w = c.w - 4;
      g.fillStyle = col;
      rr(g, x, kbY + lip, w, kbH - lip, 12);
      g.fill();
      g.fillStyle = p > 0.02 ? mix('#ffffff', tint(col, 0.78), p) : '#ffffff';
      rr(g, x, kbY + dy, w, kbH - lip, 12);
      g.fill();
      g.strokeStyle = p > 0.02 ? mix('#dddbe4', col, p) : '#dddbe4';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = col;
      g.font = font(Math.min(c.w * 0.42, kbH * 0.2));
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(p2Solfa(k.midi), x + w / 2, kbY + kbH - lip - kbH * 0.1 + dy);
    });
    this.cols.forEach((c, i) => {
      if (c.white) return;
      const p = this.press[i];
      const dy = 3 * p;
      const bl = Math.max(4, this.blackH * 0.1);
      g.fillStyle = '#26242c';
      rr(g, c.x, kbY - 2, c.w, this.blackH, 9);
      g.fill();
      g.fillStyle = p > 0.02 ? mix('#4a4852', shade(SOLFA_COLOR[pc(this.keys[i].midi)], -0.15), p) : '#4a4852';
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
    g.fillStyle = '#ecebf1';
    rr(g, px0, midY - 6, px1 - px0, 12, 6);
    g.fill();
    g.fillStyle = '#58cc02';
    rr(g, px0, midY - 6, Math.max(12, (px1 - px0) * p), 12, 6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    rr(g, px0 + 6, midY - 4, Math.max(0, (px1 - px0) * p - 12), 3, 1.5);
    g.fill();
    this._drawCombo(g, t, (px0 + px1) / 2, midY + 9, Math.min(18, hudH * 0.3), '#ffffff');
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillStyle = '#3b2a4a';
    g.font = font(Math.min(30, hudH * 0.48));
    g.fillText(Math.round(this.shown).toLocaleString(), W - 16, midY);
  }

  // ======== 효과 · 글자 ========
  _drawFx(g, t) {
    for (const r of this.fx.rings) {
      const k = (t - r.at) / 0.4;
      if (k < 0 || k > 1) continue;
      const e = ease(k);
      g.globalAlpha = (1 - e) * 0.8;
      g.strokeStyle = r.color;
      g.lineWidth = 4 * (1 - e) + 1;
      const R = (this.style === 'keys' ? this.keyW * 0.32 : this.laneW * 0.22) * (0.5 + e * 1.1);
      g.beginPath();
      g.ellipse(r.x, r.y, R, R * (this.style === 'keys' ? 0.5 : 1), 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of this.fx.parts) {
      const d = t - p.at;
      if (d < 0 || d > p.life) continue;
      const k = d / p.life;
      const x = p.x + p.vx * d;
      const y = p.y + p.vy * d + 160 * d * d;
      g.globalAlpha = (1 - ease(k)) * 0.85;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(x, y, p.s * (1 - k * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 글자: MISS(놓침·헛침) · 꾹 보너스(+점수). 맞힘은 글자 없이 고리만
    const seen = new Set();
    for (let i = this.fx.pops.length - 1; i >= 0; i--) {
      const p = this.fx.pops[i];
      // 타일은 줄마다 하나, 건반은 줄이 좁아서 화면에 하나만
      const key = this.style === 'keys' ? 'k' : p.kind === 'bonus' ? 'b' + p.lane : p.lane;
      if (seen.has(key)) continue;
      seen.add(key);
      const k = (t - p.at) / (p.kind === 'bonus' ? 0.8 : 0.55);
      if (k < 0 || k > 1) continue;
      let cx = this._laneX(p.lane);
      const bonus = p.kind === 'bonus';
      const name = bonus ? `+${p.v.toLocaleString()}` : 'MISS';
      const color = bonus ? '#ff5fa2' : p.kind === 'wrong' ? '#ff4d6d' : '#9a94ae';
      const pop = k < 0.2 ? 0.75 + 0.35 * ease(k / 0.2) : 1.1 - 0.1 * ease((k - 0.2) / 0.8);
      const size = (this.style === 'keys' ? Math.min(this.H * 0.065, 26) : Math.min(this.laneW * 0.26, 26)) * pop;
      if (this.style === 'keys') cx = Math.max(size * 2.4, Math.min(this.W - size * 2.4, cx));
      const y = this.judgeY - (this.style === 'keys' ? this.H * 0.09 : this.H * 0.06) - ease(k) * (bonus ? 34 : 14);
      g.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(3, size * 0.24);
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
function rgbOf(c) {
  if (c[0] === '#') {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = c.match(/\d+/g) || [0, 0, 0];
  return m.slice(0, 3).map(Number);
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
function mix(a, b, k) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}
