// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

import {
  STEPS_PER_BAR, tempoOf, ROUND_BARS, roundInfo, diamondsFor,
  buildNotes, JUDGE, pointsFor, accuracy, gradeFor, starsFor,
  COUNT_IN_BARS, OUTRO_BARS, maxScore, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH,
  buildRolls, markGoldNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS, parseMelody, pianoHarmony,
} from './charts.js';
import { SongPlayer } from './audio.js';

const COUNT_LABELS = ['1', '2', '3', '4!'];

/** 목숨: MISS 하면 하나씩 줄고, 0개가 되면 멈춤 → 이어하기(광고) 또는 끝 */
export const MAX_LIVES = 5;
/** 콤보가 이만큼 쌓일 때마다 목숨 하나 회복 (최대 MAX_LIVES) */
export const LIFE_REGEN_COMBO = 20;
/** 한 판에 이어하기 몇 번까지 */
export const MAX_CONTINUES = 1;
/** 광고 보고 이어하면 목숨 몇 개로 다시 시작하는지 */
export const REVIVE_LIVES = 2;
/** 이어하기 직후 목숨 안 깎이는 시간(초) */
const REVIVE_GRACE = 1.6;
/** 헛침으로 목숨이 깎인 뒤 이 시간(초) 안의 헛침은 또 안 깎음 (두 엄지 동시 실수) */
const WRONG_GAP = 0.12;
/**
 * 지나간 노트를 MISS 로 넘기기 전에 이만큼(초) 더 기다림.
 *   폰이 한 프레임 버벅이면 터치 이벤트가 늦게 도착함(시각은 실제로 누른 때). 그 사이 화면 갱신이 먼저
 *   돌면서 노트를 MISS 로 지워 버리면, 제때 누른 터치가 '안 먹힌' 것처럼 됨 → 늦게 온 터치도 판정되게 여유를 둠
 */
const MISS_SLACK = 0.12;
/**
 * 경계 근처 터치 봐주기. 엄지 두 개가 가운데로 모이면(손가락이 겹치면) 왼손이 오른쪽 줄을 누르기 쉬움.
 *   - 줄 경계에서 줄 너비의 이 비율 안쪽을 눌렀는데 그 줄엔 칠 노트가 없고 옆 줄엔 있으면 → 옆 줄로 침
 */
const NEAR_EDGE = 0.3;
/**
 *   - 같은 줄을 이 시간(초) 안에 또 눌렀으면 다른 엄지가 넘어온 것 → 경계에서 멀어도 옆 줄 노트가 더 맞으면 옆 줄로
 *     (2026-11-22 0.09 → 0.15: 윌리엄 텔 '쿵짝쿵'은 쿵·짝이 0.104초 간격이라 예전 값으론 넘어온 엄지를 못 알아봄)
 */
const CROSS_GAP = 0.15;
/**
 *   - 경계 근처·넘어온 엄지 터치에서 내 줄과 옆 줄 둘 다 노트가 있으면, 옆 줄 노트가 이만큼(초) 넘게 더 가까울 때 옆 줄로.
 *     (2026-11-22 '쿵짝쿵에서 쿵이나 짝 하나가 안 눌림': 4줄 곡은 쿵·짝이 화면 가운데에 붙어 있어 엄지가 선을 살짝 넘기 쉬움.
 *      예전엔 넘어온 엄지일 때만, 그것도 PERFECT 범위(0.055초)만큼 더 가까워야 옮겨서, 쿵 터치가 0.1초 뒤 짝 노트를 일찍 가져가고
 *      → 쿵 MISS → 진짜 짝 터치는 헛침 이 됐음)
 */
const PICK_MARGIN = 0.02;
/**
 *   - 단, 같은 줄을 거의 같은 자리(줄 너비의 이 비율 안)에서 또 누른 건 같은 엄지가 연타한 것 → 넘어온 걸로 안 봄
 *     (산왕의 궁전 킥 연타: 남는 킥 터치가 바로 뒤 스네어 노트를 가져가서, 진짜 스네어 터치가 헛침이 되던 것)
 */
const CROSS_DIST = 0.3;

export class Game {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {import('./render.js').Renderer} o.renderer
   */
  constructor({ audio, renderer, level, settings, auto = false, onHud, onEnd, onDeath }) {
    this.audio = audio;
    this.r = renderer;
    this.level = level;
    this.settings = settings;
    this.auto = auto;
    this.onHud = onHud || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onDeath = onDeath || null;
    this.onStall = null;
    this.tempo = tempoOf(level);
    /** 화면 왼쪽부터 레인(악기) 순서 */
    this.laneOrder = levelLanes(level);
    this.notes = [];
    this.lanes = INSTRUMENTS.map(() => []);
    this.builtBars = 0;
    this._pair = 0;
    this._addNotes();
    if (level.tapMelody) this._attachMelody();
    /** 레벨업 챌린지(무제한 모드): 지금 단계 */
    this.round = 0;
    this.ptr = INSTRUMENTS.map(() => 0);
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.offsets = [];
    /** 프로그램이 만든 가짜 입력 수 (브라우저가 isTrusted=false 로 표시) — 핵 의심 확인용으로 점수와 같이 보냄 */
    this.fakeTaps = 0;
    /** 줄마다 마지막으로 누른 시각(곡 시간) — 엄지가 옆 줄로 넘어왔는지 볼 때 */
    this._tapAt = {};
    /** 줄마다 마지막으로 누른 자리 (render.laneHit 의 u, 줄 너비 단위) */
    this._tapPos = {};
    // 자동 연주(영상 찍기)나 죽었을 때 처리할 곳이 없으면 목숨 없음
    //   💀 실패 영상(level.failReel): 자동 연주라도 목숨이 있음 → failAt 부터 일부러 놓쳐서 하트가 다 떨어짐
    this.livesOn = (!auto || !!level.failReel) && !!this.onDeath;
    this.lives = MAX_LIVES;
    this.failAt = level.failReel && auto ? this.tempo.barStart(COUNT_IN_BARS) + (level.failAfter || 12) : Infinity;
    this.continues = 0;
    this.graceUntil = -Infinity;
    this._lostAt = null;
    this.state = 'idle';
    this.beat = 60 / this.tempo.bpm(0);
    // 콩 다가오는 속도는 1로 고정 (설정에서 없앰. 예전에 바꿔 둔 값도 무시)
    this.approach = 1.5;
    this.firstNoteTime = this.notes.length ? this.notes[0].time : 0;
    this._setEnd();
    this.maxScore = level.endless ? 0 : maxScore(level);
    /** 마디마다 끝났을 때 점수 (1:1 대결에서 상대 점수를 실시간으로 보여줄 때 씀) */
    this.timeline = [];
    // 💥 연타 구간 · ✨ 황금 콩 (점수와 상관없이 하트를 돌려받는 재미 요소)
    this.rolls = buildRolls(level);
    this.rollHits = 0;
    this.goldTotal = level.challenge ? 0 : markGoldNotes(this.notes);
    this.goldHits = 0;
    this._loop = this._loop.bind(this);
  }

  /**
   * 💀 실패 영상 자동 연주: 사람처럼 — 처음엔 거의 PERFECT(가끔 GREAT·GOOD),
   * failAt 부터 흔들림: MISS 하나 → GOOD·GREAT 섞어 버티다 → 또 MISS … 하트가 줄수록 MISS 간격이 짧아지고 GOOD 이 많아짐.
   * 반환: 판정 오차(초) 또는 null(놓침). 같은 시각 콩(동시치기)은 같은 운명.
   */
  _failDt(n) {
    const f = (this._fail ||= { fates: new Map(), nextMiss: this.failAt });
    let fate = f.fates.get(n.time);
    if (fate === undefined) {
      const R = Math.random;
      const sign = () => (R() < 0.5 ? -1 : 1);
      const great = () => sign() * (JUDGE.perfect + 0.005 + R() * (JUDGE.great - JUDGE.perfect - 0.01));
      const good = () => sign() * (JUDGE.great + 0.005 + R() * (JUDGE.good - JUDGE.great - 0.01));
      if (n.time < this.failAt) {
        // 잘 치는 구간: PERFECT 85% · GREAT 12% · GOOD 3%
        const x = R();
        fate = x < 0.85 ? sign() * R() * JUDGE.perfect * 0.8 : x < 0.97 ? great() : good();
      } else if (n.time >= f.nextMiss) {
        fate = null;
        // 다음 MISS 까지: 하트가 많으면 길게 버팀, 적으면 금방 (놓친 뒤라 지금 하트는 하나 적음)
        const left = Math.max(0, this.lives - 1);
        const gap = left >= 4 ? 1.6 + R() * 0.8 : left === 3 ? 1.2 + R() * 0.7 : left === 2 ? 0.8 + R() * 0.6 : 0.45 + R() * 0.45;
        f.nextMiss = n.time + gap;
      } else {
        // 버티는 구간: 하트가 줄수록 GOOD 이 많아짐. 황금 콩은 하트가 차지 않게 GOOD
        const pGood = n.gold ? 1 : 0.35 + (MAX_LIVES - this.lives) * 0.12;
        const x = R();
        fate = x < pGood ? good() : x < pGood + 0.3 ? great() : sign() * R() * JUDGE.perfect * 0.8;
      }
      f.fates.set(n.time, fate);
    }
    return fate;
  }

  /** 지금(t) 진행 중인 연타 구간 (앞뒤로 살짝 여유) */
  _rollAt(t) {
    for (const r of this.rolls) if (t >= r.t0 - 0.08 && t <= r.t1 + 0.06) return r;
    return null;
  }

  /** 🎤 라이브 세트: 드럼 소리 대신 리듬게임 「착」 소리 (2026-11-22 사용자 '세트엔 드럼 없으니 드럼 소리 없애고') */
  get _liveSfx() {
    return !!this.r.live && !this.auto;
  }
  _tapSfx(name, vol = 0.9) {
    try {
      // 아직 안 받았으면 이번엔 건너뜀 (늦게 나는 치는 소리는 박자를 헷갈리게 함)
      if (!this.audio.trackBuffer(`assets/sfx/${name}`)) return void this.audio.loadTrack(`assets/sfx/${name}`);
      this.audio.sfxFile(name, vol);
    } catch {}
  }

  _rollHit(roll, rt) {
    roll.hits++;
    if (this._liveSfx) this._tapSfx('live2_hit.wav', 0.7);
    this.rollHits++;
    if (roll.hits % ROLL_HEART_HITS === 0 && roll.hearts < ROLL_MAX_HEARTS && this.livesOn && this.lives < MAX_LIVES) {
      roll.hearts++;
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.r.onRoll) this.r.onRoll(roll, rt);
  }

  /** 채보 마디가 늘어났으면(무제한 모드) 노트 추가 */
  _addNotes() {
    const lv = this.level;
    if (lv.bars.length <= this.builtBars) return false;
    const add = buildNotes(lv, this.builtBars, lv.bars.length, this._pair);
    this._pair = add.nextPair;
    const base = this.notes.length;
    for (const n of add) {
      n.id += base;
      n.judged = false;
      n.result = null;
      this.notes.push(n);
      this.lanes[n.lane].push(n);
    }
    this.builtBars = lv.bars.length;
    return true;
  }

  /** 🎭 tapMelody: 멜로디 줄(SNARE) 노트마다 그 자리의 멜로디 음(midi·길이·계이름)을 붙임 → 누르면 피아노로 그 음 */
  _attachMelody() {
    const SOL = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
    const at = new Map();
    for (const m of parseMelody(this.level.song.melody)) at.set((COUNT_IN_BARS + m.bar) * STEPS_PER_BAR + m.step, m);
    for (const n of this.lanes[SNARE]) {
      const m = at.get(n.step);
      if (!m) continue;
      n.midi = m.midi;
      n.dur = this.tempo.stepTime(n.step + m.len) - this.tempo.stepTime(n.step);
      n.sol = SOL[m.midi % 12];
      // 🎹 오른손 화음 (멜로디 아래 화음 음, 긴 음은 하나 더)
      n.harm = pianoHarmony(this.level.song, m.bar, m.step, m.midi, m.len >= 4);
    }
    // 🎹 오른쪽 줄 피아노 건반 범위: 멜로디 가장 낮은 음의 도부터 1~2옥타브
    const ms = [...at.values()].map((m) => m.midi);
    if (ms.length) {
      const base = Math.floor(Math.min(...ms) / 12) * 12;
      this.r.pianoRange = { base, oct: Math.max(...ms) - base >= 12 ? 2 : 1 };
    }
  }

  /** 🎹 멜로디 노트를 쳤을 때 오른쪽 피아노 건반이 눌림 */
  _pianoKeys(n, rt) {
    if (n && n.midi != null) this.r.onPiano([n.midi, ...(n.harm || [])], rt, Math.max(0.18, Math.min(0.6, (n.dur || 0.3) * 0.8)));
  }

  /** 🎭 멜로디 줄을 누름 → 칠 노트(없으면 바로 앞뒤로 가장 가까운 노트)의 음을 피아노로 */
  _playMelodyTap(t) {
    const list = this.lanes[SNARE];
    let best = null;
    for (let i = Math.max(0, this.ptr[SNARE] - 2); i < list.length; i++) {
      const n = list[i];
      if (n.time - t > JUDGE.early) break;
      if (!best || Math.abs(n.time - t) < Math.abs(best.time - t)) best = n;
    }
    if (!best || best.midi == null || Math.abs(best.time - t) > JUDGE.early) return;
    const a = this.audio;
    const t0 = a.ctx.currentTime;
    const d = Math.max(0.25, best.dur * 0.95);
    a.pianoOr('lead', t0, best.midi, d, a.sfxBus, 1.25);
    for (const h of best.harm || []) a.pianoOr('lead', t0, h, d, a.sfxBus, 0.6);
    this._pianoKeys(best, performance.now() / 1000);
  }

  /** 끝나는 시각: 무제한 모드는 끝없음 (목숨이 다 떨어질 때까지) */
  _setEnd() {
    const lv = this.level;
    this.lastNoteTime = this.notes.length ? this.notes[this.notes.length - 1].time : 0;
    if (lv.endless) {
      this.endTime = Infinity;
      return;
    }
    const lastBar = COUNT_IN_BARS + lv.bars.length - 1;
    this.endTime = this.lastNoteTime + this.tempo.barLen(lastBar) * OUTRO_BARS + 0.4;
  }

  /** 무제한 모드: 앞으로 2단계치 채보는 늘 만들어 둠 */
  _extend(now) {
    const lv = this.level;
    if (!lv.ensureBars) return;
    const bar = Math.max(0, Math.floor(this.tempo.barAt(now)) - COUNT_IN_BARS);
    lv.ensureBars(bar + ROUND_BARS * 2);
    if (this._addNotes()) this._setEnd();
  }

  get offset() {
    return (this.settings.offsetMs || 0) / 1000;
  }

  /** 노래 기준 현재 시각(초). 판정과 화면이 같은 시계를 씀 */
  songTime(perfMs) {
    // 소리 시계가 멈춘 동안(_virt): 화면 시계로 곡 시각을 이어 감 → 게임이 '1' 에서 서 있지 않음 (소리만 잠깐 끊김)
    const v = this._virt;
    if (v) return v.at + ((perfMs ?? performance.now()) / 1000 - v.rt);
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  start() {
    const ctx = this.audio.ctx;
    this.audio.resetClock();
    this.r.reset();
    this.r.laneOrder = this.laneOrder;
    this.r.melodyMode = !!this.level.tapMelody;
    if (this.r.live) for (const n of ['live2_hit.wav', 'live2_hit2.wav', 'live2_combo.mp3']) this.audio.loadTrack(`assets/sfx/${n}`);
    let at = ctx.currentTime + 0.35;
    // 🎵 내 노래: 노래를 처음부터 틀고, 채보(카운트인)는 leadIn 초 뒤에 시작
    if (this.level.leadIn > 0) at += this.level.leadIn;
    this.startTime = at;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.start();
    this.state = 'playing';
    this._clockWatch = null;
    this._virt = null;
    this._goodNow = undefined;
    this._tickAt = performance.now() / 1000;
    this._raf = requestAnimationFrame(this._loop);
  }

  /**
   * 소리 엔진을 새로 만든 뒤(audio.rebuild): 멈췄던 자리부터 새 시계로 곡을 이어서.
   *   아이폰에서 다른 앱이 소리를 가져가면 옛 엔진이 다시 안 켜지는 일이 있어 엔진째 바꿈 (main 의 터치 처리)
   *   일시정지·목숨 끝 상태면 다시 시작할 때(resume) 맞춤
   */
  reanchor() {
    if (this.state === 'paused' || this.state === 'dead') {
      this._needAnchor = true;
      return;
    }
    if (this.state !== 'playing') return;
    this._needAnchor = false;
    const at = this._goodNow ?? -0.35; // 마지막 곡 시각 (못 흘렀으면 처음부터)
    if (this.player) this.player.stop(0.01);
    // 새 소리 시계가 실제로 흐르는 게 보일 때까지 화면 시계로 이어 가다가 _loop 에서 맞춰 붙임 (_alignClock)
    this._virt = { at, rt: performance.now() / 1000 };
    this._clockWatch = null;
    this._stallSince = null;
  }

  /** 화면 시계로 가던 곡 시각에 소리 시계를 맞춰 붙이고, 그 자리부터 곡을 다시 틂 */
  _alignClock(rt) {
    const v = this._virt;
    const at = v.at + (rt - v.rt);
    this._virt = null;
    this.audio.resetClock();
    if (this.player) this.player.stop(0.01);
    this.startTime = this.audio.heardTime(rt * 1000) - this.offset - at;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.step = Math.max(0, Math.floor(this.tempo.barAt(Math.max(0, at)) * STEPS_PER_BAR) - 1);
    this.player.start();
  }

  pause() {
    if (this.state !== 'playing') return;
    this._heldAt = this.songTime();
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
  }

  async resume() {
    if (this.state !== 'paused') return;
    // 화면 시계로 가던 중이면 멈췄던 자리에서 다시 셈
    if (this._virt) this._virt = { at: this._heldAt, rt: performance.now() / 1000 };
    // 아이폰에서 소리가 막혀 있으면 resume() 이 끝나지 않을 수 있음 → 0.4초만 기다림 (안 켜지면 루프가 '멈춤'으로 보고 터치로 살림)
    await Promise.race([this.audio.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    this.audio.resetClock();
    this.state = 'playing';
    this._clockWatch = null;
    this._tickAt = performance.now() / 1000;
    // 멈춰 둔 동안 소리 시계가 흘러 버렸으면(광고·일시정지 화면 터치 등으로 소리가 다시 켜짐) 멈췄던 자리로 되돌림.
    //   안 그러면 그동안 지나간 노트가 한꺼번에 MISS → 이어하자마자 죽음
    const held = this._heldAt;
    if (held != null && Math.abs(this.songTime() - held) > 0.15) {
      this._goodNow = held;
      this._needAnchor = true;
    }
    if (this._needAnchor) this.reanchor();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.state = 'stopped';
    this.audio.frozen = false;
    cancelAnimationFrame(this._raf);
    if (this.player) this.player.stop();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
  }

  /**
   * 엄지 입력. lane = 악기 번호(charts.js KICK/SNARE/HAT/CRASH). perfMs = event.timeStamp
   * near = 바로 옆 줄들 [{ lane, d }] (d = 경계까지 거리, 줄 너비 기준). 터치일 때만 옴 (render.laneHit)
   * pos = 누른 가로 자리 (줄 너비 단위, render.laneHit 의 u). 터치일 때만
   */
  input(lane, perfMs, near, pos, soft = false) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return;
    const playing = this.state === 'playing' && !this.auto;
    if (soft) {
      if (playing) this._softTap(lane, this.songTime(perfMs), rt);
      return;
    }
    const t = playing ? this.songTime(perfMs) : 0;
    const touched = lane;
    if (playing && near && near.length) lane = this._pickLane(lane, t, near, pos);
    // 소리가 오류 나도 판정은 꼭 함 (예전에 소리 엔진을 새로 만든 뒤 쿵 소리만 오류 나서 쿵 판정이 통째로 빠졌음)
    try {
      if (this.level.tapMelody && lane === SNARE) {
        if (playing) this._playMelodyTap(t);
      } else if (!this.auto && !this._liveSfx) this.audio.playLane(lane);
    } catch {}
    this.r.onTap(lane, rt);
    if (!playing) return;
    this._tapAt[lane] = t;
    this._tapPos[lane] = pos;
    // 연타 구간: 그 줄은 칠 때마다 연타 +1, 다른 줄은 헛침 아님 (구간엔 노트가 없음)
    const roll = this._rollAt(t);
    if (roll && roll.lane === lane) {
      this._rollHit(roll, performance.now() / 1000);
      return;
    }
    if (roll && t >= roll.t0 && t <= roll.t1) return;
    const list = this.lanes[lane];
    let ahead = null;
    let late = null; // GOOD 보다 조금 늦게 친 노트 (아직 MISS 로 안 넘어감)
    for (let i = this.ptr[lane]; i < list.length; i++) {
      const n = list[i];
      if (n.judged) continue;
      const dt = t - n.time;
      if (dt > JUDGE.good) {
        if (dt <= JUDGE.good + MISS_SLACK) late = n;
        continue;
      }
      if (dt < -JUDGE.good) {
        ahead = n;
        break;
      }
      // 이 줄 노트를 옆 줄 터치·되살린 터치가 먼저 가져갔고 그게 이 터치에 더 가까우면 → 이번 터치는 그 노트를 친 것.
      //   안 그러면 다음 노트를 일찍 쳐 버리고, 그다음 터치는 헛침이 되는 연쇄가 생김 (2026-11-22 '터치 씹힘')
      const b = this._borrowedNear(lane, t);
      if (b && Math.abs(t - b.time) < Math.abs(dt)) {
        b.reclaimed = true;
        this.r.onJudge(lane, b.result, rt);
        return;
      }
      this._judge(n, dt, rt);
      // 옆 줄에서 넘어온 터치가 가져간 노트 → 그 줄 엄지가 곧 진짜로 치면 헛침으로 안 봄
      if (lane !== touched) n.borrowed = true;
      return;
    }
    // 이 줄 노트를 옆 줄 터치가 먼저 가져갔음 → 이번이 진짜 그 노트를 친 것 (헛침·MISS 아님)
    const b = this._borrowedNear(lane, t);
    if (b) {
      b.reclaimed = true;
      this.r.onJudge(lane, b.result, rt);
      return;
    }
    // 조금 늦게 친 것 (GOOD 밖): 그 노트를 지금 MISS 로 하고 끝. 예전엔 이 터치가 헛침(하트 하나)이 되고 그 노트도 MISS(또 하나),
    //   다음 노트가 가까우면 '너무 일찍 누름'으로 그것까지 MISS → 늦은 터치 한 번에 하트 2~3개 ('분명 쳤는데 씹혔다')
    const early = ahead && t - ahead.time >= -JUDGE.early;
    if (late && (!early || t - late.time <= ahead.time - t)) {
      if (this._liveSfx) this._tapSfx('live2_hit2.wav', 0.35);
      this._miss(late, rt);
      return;
    }
    // 너무 일찍 누름 → 그 노트는 MISS (마구 연타해서 점수 받는 것 방지)
    if (early) {
      if (this._liveSfx) this._tapSfx('live2_hit2.wav', 0.35);
      this._miss(ahead, rt);
      return;
    }
    // 노트 없는 곳을 누름 → 헛침: 점수 없음 + 콤보 끊김 (카운트인/끝난 뒤는 봐줌)
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) this._wrong(lane, rt, t);
  }

  /** 이 줄에서 다른 터치가 먼저 가져간(borrowed) 노트 중 t 에 가장 가까운 것 (GOOD 범위 안, 없으면 null) */
  _borrowedNear(lane, t) {
    const list = this.lanes[lane];
    let best = null;
    for (let i = Math.max(0, this.ptr[lane] - 4); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      if (n.borrowed && !n.reclaimed && Math.abs(t - n.time) <= JUDGE.good && (!best || Math.abs(t - n.time) < Math.abs(t - best.time))) best = n;
    }
    return best;
  }

  /**
   * '되살린' 터치 (main 의 touchmove: 아이폰이 손가락 뗌을 놓쳐서 새로 누른 게 움직임으로만 온 것 같을 때).
   *   진짜 새 터치인지 확실하지 않으니 벌은 절대 안 줌: 맞힐 노트가 GREAT 범위 안에 있을 때만 치고(소리도 그때만),
   *   아니면 아무 일도 없음 (헛침·이른 MISS 없음). 가져간 노트는 borrowed → 곧 오는 진짜 터치는 헛침이 아님.
   *   2026-11-22: 이걸 보통 터치처럼 셌더니, 누른 채 살짝 굴리며 떼는 손가락이 터치 한 번 더로 잡혀
   *   헛침·MISS 가 쏟아짐 ('터치가 씹혀요' 댓글 폭주)
   */
  _softTap(lane, t, rt) {
    const roll = this._rollAt(t);
    if (roll) {
      if (roll.lane !== lane) return;
      try {
        if (!this._liveSfx) this.audio.playLane(lane);
      } catch {}
      this.r.onTap(lane, rt);
      this._rollHit(roll, rt);
      return;
    }
    const list = this.lanes[lane];
    let n = null;
    for (let i = this.ptr[lane]; i < list.length && list[i].time - t <= JUDGE.great; i++) {
      const c = list[i];
      if (!c.judged && Math.abs(t - c.time) <= JUDGE.great && (!n || Math.abs(t - c.time) < Math.abs(t - n.time))) n = c;
    }
    if (!n) return;
    try {
      if (this.level.tapMelody && lane === SNARE) this._playMelodyTap(t);
      else if (!this._liveSfx) this.audio.playLane(lane);
    } catch {}
    this.r.onTap(lane, rt);
    this._judge(n, t - n.time, rt);
    n.borrowed = true;
  }

  /** 지금(t) 이 줄에서 누르면 판정될 노트 (없으면 null) */
  _noteFor(lane, t) {
    const list = this.lanes[lane];
    for (let i = this.ptr[lane]; i < list.length; i++) {
      const n = list[i];
      if (n.judged) continue;
      const dt = t - n.time;
      if (dt > JUDGE.good) continue;
      return dt < -JUDGE.good ? null : n;
    }
    return null;
  }

  /** 경계 근처·엄지가 넘어온 터치를 노트 있는 옆 줄로 옮김 (NEAR_EDGE, CROSS_GAP) */
  _pickLane(lane, t, near, pos) {
    // 같은 줄을 방금 다른 엄지가 쳤음 → 이 손가락은 옆 줄로 가려던 것 (같은 자리 연타는 같은 엄지라 아님)
    const prevPos = this._tapPos[lane];
    const sameThumb = pos != null && prevPos != null && Math.abs(pos - prevPos) < CROSS_DIST;
    const crossed = !sameThumb && t - (this._tapAt[lane] ?? -9) < CROSS_GAP;
    const roll = this._rollAt(t);
    if (roll) {
      if (roll.lane !== lane && near.some((c) => c.lane === roll.lane && (c.d <= NEAR_EDGE || crossed))) return roll.lane;
      return lane;
    }
    const own = this._noteFor(lane, t);
    let best = null;
    let bestGap = Infinity;
    for (const c of near) {
      if (c.d > NEAR_EDGE && !crossed) continue;
      const n = this._noteFor(c.lane, t);
      if (n && Math.abs(t - n.time) < bestGap) {
        best = c.lane;
        bestGap = Math.abs(t - n.time);
      }
    }
    if (best === null && !own) {
      // 같은 엄지가 맡는 줄(챙·쿵·탐 / 짝·츠)은 동시에 나오지 않음 → 내 줄에 노트가 없으면 같은 엄지 줄의 노트로.
      //   4줄일 때 맨 왼쪽 챙 줄이 넓어서 왼쪽 엄지가 쿵 대신 챙을 눌러 쿵이 '안 쳐지던' 것 (유저 맵 신고)
      const hand = INSTRUMENTS[lane] && INSTRUMENTS[lane].hand;
      for (const l of this.laneOrder) {
        if (l === lane || !INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
        const n = this._noteFor(l, t);
        if (n && Math.abs(t - n.time) < bestGap) {
          best = l;
          bestGap = Math.abs(t - n.time);
        }
      }
    }
    if (best === null) return lane;
    if (!own) return best;
    // 둘 다 노트가 있으면 내 줄 우선. 다만 (경계 근처거나 엄지가 넘어온 터치) 옆 줄 노트가 확실히 더 가까우면 옆 줄
    if (bestGap + PICK_MARGIN < Math.abs(t - own.time)) return best;
    return lane;
  }

  /** 노트 없는 곳을 누름(헛침): 콤보 끊김 + 목숨 하나. 두 엄지가 동시에 미끄러져도(0.12초 안) 하나만 */
  _wrong(lane, rt, t) {
    this.counts.wrong++;
    this.combo = 0;
    if (this._liveSfx) this._tapSfx('live2_hit2.wav', 0.35);
    this.r.onJudge(lane, 'wrong', rt);
    if (t === undefined || t - (this._wrongLostAt ?? -9) < WRONG_GAP) return;
    if (t < this.graceUntil || !this.livesOn || this.state !== 'playing') return;
    this._wrongLostAt = t;
    this._hurt(rt);
  }

  _judge(n, dt, rt) {
    const ad = Math.abs(dt);
    const res = ad <= JUDGE.perfect ? 'perfect' : ad <= JUDGE.great ? 'great' : 'good';
    n.judged = true;
    n.result = res;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[res]++;
    this.score += Math.round(pointsFor(res, this.combo) * (n.mult || 1));
    if (n.gold && res !== 'good') {
      this.goldHits++;
      const heal = this.livesOn && this.lives < MAX_LIVES;
      if (heal) {
        this.lives++;
        this.r.onLife(this.lives, +1, rt);
      }
      if (this.r.onGold) this.r.onGold(n.lane, heal, rt);
    }
    this.offsets.push(dt);
    if (this._liveSfx) this._tapSfx(res === 'perfect' ? 'live2_hit.wav' : 'live2_hit2.wav', res === 'perfect' ? 0.9 : 0.75);
    this.r.onJudge(n.lane, res, rt, dt < 0);
    this.r.onCombo(this.combo, rt);
    // 🔔 25콤보마다 '반짝' (치는 소리에 안 묻히게 작게)
    if (this.combo > 0 && this.combo % 25 === 0) this.audio.sfxFile(this.audio.uiSet === 'live' ? 'live2_combo' : 'combo', 0.35);
    if (this.livesOn && !(this.auto && this.level.failReel) && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.combo % 25 === 0) {
      if (!this.r.live) this.audio.crash(undefined, this.audio.sfxBus, 0.5);
      this.milestoneAt = this.songTime();
    }
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(res === 'perfect' ? 12 : 8);
      } catch {}
    }
  }

  _miss(n, rt) {
    n.judged = true;
    n.result = 'miss';
    this.counts.miss++;
    this.combo = 0;
    this.r.onJudge(n.lane, 'miss', rt);
    this._loseLife(n, rt);
  }

  /** MISS → 목숨 하나. 동시치기(두 레인 같은 시각)를 둘 다 놓쳐도 하나만 깎음 */
  _loseLife(n, rt) {
    if (!this.livesOn || this.state !== 'playing') return;
    if (n.time < this.graceUntil) return;
    if (this._lostAt === n.time) return;
    this._lostAt = n.time;
    this._hurt(rt);
  }

  /** 목숨 하나 깎기 (0개면 멈춤) */
  _hurt(rt) {
    this.lives = Math.max(0, this.lives - 1);
    this.r.onLife(this.lives, -1, rt);
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
    if (this.lives <= 0) this._die();
  }

  /** 목숨 0개: 그 자리에서 멈춤 (노래도 멈춤). 이어하기 또는 포기는 바깥(main)에서 고름 */
  _die() {
    this.state = 'dead';
    this.diedAt = this.songTime();
    this._heldAt = this.diedAt;
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
    // 멈춘 화면에 '목숨 끝' 표시 한 번 그리기
    this._drawFrame(this.diedAt, performance.now() / 1000, true);
    this.onHud(this._hud(this.diedAt));
    this.onDeath({
      canContinue: this.continues < MAX_CONTINUES,
      progress: Math.max(0, Math.min(1, this.diedAt / this.endTime)),
      score: this.score,
    });
  }

  /** 광고 보고 이어하기: 목숨 REVIVE_LIVES 개로 그 자리부터, 바깥에서 카운트다운 후 resume() */
  revive() {
    if (this.state !== 'dead') return false;
    this.continues++;
    this.lives = REVIVE_LIVES;
    this.graceUntil = this.diedAt + REVIVE_GRACE;
    this.r.onLife(this.lives, +REVIVE_LIVES, performance.now() / 1000);
    this.state = 'paused';
    return true;
  }

  /** ⚔️ 멀티: 상대가 먼저 목숨을 다 씀(또는 나감) → 내 판도 지금 끝 (살아남아서 이김) */
  endNow() {
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'dead') return false;
    const wasDead = this.state === 'dead';
    const at = wasDead ? this.diedAt : this.songTime();
    this.state = 'finished';
    cancelAnimationFrame(this._raf);
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
    this.player.stop(0.6);
    if (this.level.challenge) this._finishChallenge(wasDead, at);
    else this._finish(wasDead, true);
    return true;
  }

  /** 이어하기 안 하고 끝내기 → 실패 결과 */
  giveUp() {
    if (this.state !== 'dead') return;
    this.audio.ctx.resume().catch(() => {});
    this._finish(true);
  }

  _loop() {
    if (this.state !== 'playing') return;
    const rt = performance.now() / 1000;
    // 소리 시계가 멈춤(폰이 소리를 잠깐 끊음: 알림·전화·다른 앱 소리 등) → 곡도 멈춰 보임.
    //   바로 다시 켜 보고, 그래도 안 되면 '화면을 눌러 주세요' 안내 (iOS 는 터치해야 다시 켜짐)
    const actx = this.audio.ctx;
    // 'running' 이라면서 시계가 안 가는 경우도 멈춤으로 봄 (아이폰: 다른 앱 소리를 틀고 돌아왔을 때)
    let frozen = !actx || actx.state !== 'running';
    let flowing = false;
    if (!frozen) {
      const w = this._clockWatch;
      if (!w || w.ct !== actx.currentTime) {
        if (w) {
          this._tickAt = rt; // 시계가 실제로 흐름 (터치로 엔진을 새로 만들어도 안 흐르면 그대로 → 얼마나 오래 멈췄나)
          flowing = true;
        }
        this._clockWatch = { ct: actx.currentTime, rt };
      }
      else if (rt - w.rt > 0.3) frozen = true;
    }
    this.audio.frozen = frozen;
    if (frozen) {
      if (rt - (this._resumeTry || 0) > 0.7) {
        this._resumeTry = rt;
        actx.resume().catch(() => {});
        this.audio.resetClock();
        if (this.onStall && rt - (this._stallSince ?? rt) > 1.2) this.onStall(rt - (this._tickAt ?? rt));
      }
      this._stallSince ??= rt;
      // 소리 시계가 멈춤 → 화면 시계로 곡을 이어 감 (마지막으로 시계가 흐르던 순간부터)
      if (!this._virt) this._virt = { at: this._goodNow ?? this.songTime(), rt: this._clockWatch?.rt ?? rt };
    } else {
      this._stallSince = null;
      // 소리 시계가 다시 흐름 → 그 시계를 지금 곡 시각에 맞춰 붙임
      if (this._virt && flowing) this._alignClock(rt);
    }
    const now = this.songTime();
    this._goodNow = now;
    this._extend(now);
    this._checkRound(now, rt);

    if (this.auto) {
      for (const lane of this.laneOrder) {
        const list = this.lanes[lane];
        while (this.ptr[lane] < list.length && list[this.ptr[lane]].time <= now) {
          const n = list[this.ptr[lane]];
          // 💀 실패 영상: 놓치기로 한 콩은 안 침 (지나가면 아래에서 MISS)
          const dt = this.level.failReel ? this._failDt(n) : 0;
          if (dt == null) break;
          this.r.onTap(lane, rt);
          if (lane === SNARE && this.level.tapMelody) this._pianoKeys(n, rt);
          this._judge(n, dt, rt);
          this.ptr[lane]++;
        }
      }
      // 자동 연주: 연타 구간은 16분음표마다 두드림
      for (const roll of this.rolls) {
        if (now < roll.t0 || now > roll.t1 || now >= this.failAt) continue;
        const want = Math.floor((now - roll.t0) / (this.tempo.stepTime(1) - this.tempo.stepTime(0))) + 1;
        while (roll.hits < want) {
          this.audio.playLane(roll.lane);
          this.r.onTap(roll.lane, rt);
          this._rollHit(roll, rt);
        }
      }
    }

    // 지나간 노트 → MISS
    for (const lane of this.laneOrder) {
      const list = this.lanes[lane];
      while (this.ptr[lane] < list.length) {
        const n = list[this.ptr[lane]];
        if (n.judged) {
          this.ptr[lane]++;
          continue;
        }
        if (now - n.time > JUDGE.good + MISS_SLACK) {
          this._miss(n, rt);
          this.ptr[lane]++;
          continue;
        }
        break;
      }
    }
    if (this.state !== 'playing') return; // 방금 목숨이 다 떨어짐 (_die 가 화면 그림)

    this._drawFrame(now, rt);

    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    while (!this.level.challenge && this.timeline.length < this.level.bars.length && this.timeline.length < Math.floor(barPos)) this.timeline.push(this.score);

    this.onHud(this._hud(now));

    if (now >= this.endTime) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  /** 레벨업 챌린지: 단계가 바뀌면 화면에 "Lv.3 엇박 들어갑니다 · 110 BPM" (한 마디 미리 예고) */
  /** 단계 정보: 단계별 무제한은 원래 곡 빠르기에서 시작 */
  _roundInfo(r) {
    return this.level.roundInfo ? this.level.roundInfo(r) : roundInfo(r);
  }

  _checkRound(now, rt) {
    if (!this.level.challenge) return;
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    // 새 단계 시작 한 박 전부터 크게 띄움 (첫 단계는 카운트인 마지막 박)
    const r = this.level.introBars
      ? this.level.roundOfBar(mb + 0.25)
      : Math.min(this.level.maxRounds, Math.max(1, Math.floor((mb + 0.25) / ROUND_BARS) + 1));
    if (r !== this.round) {
      this.round = r;
      this.roundInfo = this._roundInfo(r);
      if (this.r.onRound) this.r.onRound(this.roundInfo, rt);
    }
  }

  /** 지금까지 깬 단계 수 */
  _roundsCleared(now) {
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    if (this.level.introBars) return Math.max(0, this.level.roundOfBar(mb) - 1);
    return Math.max(0, Math.min(this.level.maxRounds, Math.floor(mb / ROUND_BARS)));
  }

  _hud(now) {
    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    let progress;
    if (this.level.roundProgress) progress = Math.max(0, this.level.roundProgress(barPos));
    else if (this.level.endless) progress = Math.max(0, (barPos % ROUND_BARS) / ROUND_BARS);
    else progress = Math.max(0, Math.min(1, now / this.endTime));
    return {
      score: this.score,
      combo: this.combo,
      lives: this.livesOn ? this.lives : null,
      progress,
      barPos,
      round: this.round ? this.roundInfo : null,
      // 지금까지 친 걸로 받을 별 개수 (무제한 모드는 별 대신 💎)
      stars: this.level.endless ? null : starsFor(this.counts),
    };
  }

  _drawFrame(now, rt, dead = false) {
    // 카운트인 표시 (+ 엄지 안내)
    let countIn = null;
    const ciEnd = this.tempo.barStart(COUNT_IN_BARS);
    if (now < ciEnd && (now > -0.5 || !this.level.leadIn)) {
      const b = Math.max(0, Math.floor(now / this.beat));
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: now < 0 ? 0 : (now / this.beat) % 1, fade: 1 };
    } else if (now < ciEnd + this.beat * 2) {
      countIn = { label: '', phase: 1, fade: 1 - (now - ciEnd) / (this.beat * 2) };
    }
    // 박자 맞추기 자동 연주 영상: 3·2·1 숫자·말풍선 없이 (영상이 노래 구간 시작부터 찍힘)
    if (this.level.hideCountIn) countIn = null;

    const { hatAge, crashAge } = this._kitAges(now);
    // 곡이 얼마나 달아올랐나 0~1 (반주 악기 수와 같은 기준) → 맵 조명·입자가 같이 커짐
    let heat = 0;
    if (this.player && this.player.intensity) {
      const mb = Math.max(0, Math.floor(this.tempo.barAt(now)) - COUNT_IN_BARS);
      heat = Math.max(0, Math.min(1, (this.player.intensity(mb) - 0.35) / 0.65));
    }

    this.r.draw(
      {
        hatAge,
        crashAge,
        heat,
        now,
        notes: this.notes,
        approach: this.approach,
        beatDur: this.beat,
        tempo: this.tempo,
        round: this.round ? this.roundInfo : null,
        combo: this.combo,
        score: this.score,
        playing: !dead,
        dead,
        lives: this.livesOn ? this.lives : null,
        maxLives: MAX_LIVES,
        countIn,
        rolls: this.rolls,
        finished: now > this.lastNoteTime + 0.3,
        progress: Math.max(0, Math.min(1, now / this.endTime)),
      },
      rt
    );
  }

  /** 반주 하이햇/크래시가 마지막으로 울린 뒤 지난 시간 (드럼 세트 애니메이션용) */
  _kitAges(now) {
    const tp = this.tempo;
    const idx = Math.floor(tp.barAt(now) * STEPS_PER_BAR);
    const song = this.level.song;
    let hatAge = 9;
    // 하이햇/크래시를 내가 치는 단계에선 반주가 안 침 (화면도 내 타격에만 반응)
    const mineHat = this.laneOrder.includes(HAT);
    const mineCrash = this.laneOrder.includes(CRASH);
    for (let i = idx; i > idx - 16 && i >= 0 && !mineHat; i--) {
      const bar = Math.floor(i / STEPS_PER_BAR);
      const s = i % STEPS_PER_BAR;
      const mb = bar - COUNT_IN_BARS;
      const c = mb < 0 ? (s % 4 === 0 ? 'x' : '.') : mb < this.level.bars.length ? song.hat[s] : '.';
      if (c === 'x' || c === 'o') {
        hatAge = now - tp.stepTime(i);
        break;
      }
    }
    const mbNow = Math.floor(tp.barAt(now)) - COUNT_IN_BARS;
    let crashAge = 9;
    for (let mb = mbNow; mb >= Math.max(0, mbNow - 2) && !mineCrash; mb--) {
      if ((mb > 0 && mb % 8 === 0) || (!this.level.endless && mb === this.level.bars.length)) {
        crashAge = now - tp.barStart(mb + COUNT_IN_BARS);
        break;
      }
    }
    if (this.milestoneAt !== undefined) crashAge = Math.min(crashAge, now - this.milestoneAt);
    return { hatAge, crashAge };
  }

  /** stopped: 멀티에서 상대가 먼저 쓰러져 곡 중간에 끝남 (기록엔 안 남김) */
  _finish(failed = false, stopped = false) {
    this.state = 'finished';
    this.player.stop(0.6);
    if (this.level.challenge) {
      this._finishChallenge(failed);
      return;
    }
    while (this.timeline.length < this.level.bars.length) this.timeline.push(this.score);
    this.timeline[this.timeline.length - 1] = this.score;
    const total = this.notes.length;
    const avgOffsetMs = this.offsets.length
      ? Math.round((this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length) * 1000)
      : 0;
    this.onEnd({
      levelId: this.level.id,
      score: this.score,
      maxScore: this.maxScore,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total,
      accuracy: accuracy(this.counts),
      grade: failed ? 'F' : gradeFor(this.counts),
      stars: failed ? 0 : starsFor(this.counts),
      fullCombo: !failed && this.counts.miss === 0 && this.counts.wrong === 0,
      failed,
      stopped,
      continued: this.continues,
      progress: failed || stopped ? Math.max(0, Math.min(1, (failed ? this.diedAt ?? 0 : this.songTime()) / this.endTime)) : 1,
      avgOffsetMs,
      check: this._check(),
      auto: this.auto,
      practice: this.level.practice || 0,
      timeline: this.timeline.slice(),
      rollHits: this.rollHits,
      goldHits: this.goldHits,
      goldTotal: this.goldTotal,
    });
  }

  /** 핵 의심 확인용: 박자 오차 퍼짐(표준편차)·평균(ms), 친 수, 가짜 입력 수. 사람은 손가락이라 오차가 들쭉날쭉, 자동 입력은 너무 일정 */
  _check() {
    const o = this.offsets;
    const n = o.length;
    const mean = n ? o.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(o.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : 0;
    return { sd: Math.round(sd * 1000), mean: Math.round(mean * 1000), n, fake: this.fakeTaps };
  }

  /** 무제한 모드 / 레벨업 챌린지 결과: 몇 단계까지 깼나 + 다이아몬드 */
  _finishChallenge(died, atOverride) {
    const lv = this.level;
    const stopped = atOverride !== undefined; // 멀티: 상대가 먼저 져서 중간에 끝남
    const at = stopped ? atOverride : died ? this.diedAt ?? this.songTime() : this.endTime;
    const cleared = died || stopped ? this._roundsCleared(at) : lv.maxRounds;
    const avgOffsetMs = this.offsets.length
      ? Math.round((this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length) * 1000)
      : 0;
    const judged = this.notes.filter((n) => n.judged).length;
    this.onEnd({
      levelId: lv.id,
      challenge: true,
      endless: !!lv.endless,
      score: this.score,
      maxScore: this.score,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total: judged,
      accuracy: accuracy(this.counts),
      grade: gradeFor(this.counts),
      roundsCleared: cleared,
      roundReached: Math.min(lv.maxRounds, cleared + 1),
      bpmReached: this._roundInfo(Math.max(1, Math.min(lv.maxRounds, cleared + (died || stopped ? 1 : 0)))).bpm,
      // 멀티 승부용: 얼마나 오래 버텼나 (곡 시작부터 초)
      survived: Math.max(0, Number.isFinite(at) ? at : 0),
      diamonds: diamondsFor(cleared),
      stars: 0,
      fullCombo: false,
      failed: false,
      died,
      continued: this.continues,
      progress: 1,
      avgOffsetMs,
      auto: this.auto,
      practice: this.level.practice || 0,
      timeline: [],
    });
  }
}
