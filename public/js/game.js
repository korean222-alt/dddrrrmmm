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
 * 터치 판정은 단순하게 (2026-11-24, 사용자 '그냥 눌렀을 때 쿵 있으면 맞은 거, 없으면 미스 아니야?'):
 *   ① 누른 줄에 판정 시간(GOOD) 안 콩이 있으면 → 그 콩 (가장 먼저 온 것)
 *   ② 단, 누른 줄 콩이 아직 안 왔는데(PERFECT 보다 이름) 선 바로 옆(NEAR_LINE)을 눌렀고 옆 줄 콩이 먼저 와 있으면 → 옆 줄 콩
 *      (쿵짝쿵에서 짝 엄지가 가운데 선을 살짝 넘어 쿵 줄을 누른 것. 콩 시각이 같으면 늘 내 줄)
 *   ③ 누른 줄에 칠 콩이 없으면 → 옆 줄 쪽 절반(NEAR_HALF)이면 옆 줄 콩, 아니면 같은 엄지 줄(챙·쿵 / 짝·츠) 콩
 *   ④ 동시에 치는 콩(쿵+짝 같이): 한 엄지가 선을 넘어 남의 줄 콩을 쳤으면, 다른 엄지가 누를 때 남은 짝꿍 콩을 침
 *   ⑤ 아무것도 없으면 → 헛침. 지나간 콩을 조금 늦게 친 거면 그 콩 MISS 하나만 (다음 콩보다 지나간 콩이 먼저)
 *      일찍 누른 거면(EARLY 안) 헛침인데, 그 콩을 끝내 못 치면 헛침 대신 그 콩 MISS 로 바꿈 → 벌은 한 번만
 *   한 터치는 그 콩 하나만 건드림 — 예전처럼 일찍 누른 터치가 다음 콩을 MISS 로 만들거나, 콩을 빌려 갔다 되돌려 주지 않음.
 *   (예전 규칙들이 겹쳐서, 엄지를 떼며 굴린 '가짜 터치' 하나에 제대로 친 콩까지 MISS + 헛침이 됨 → '분명히 눌렀는데 안 눌려요')
 */
const NEAR_LINE = 0.3;
const NEAR_HALF = 0.5;
/** 같은 줄을 이 시간(초) 안에 또 누르면 다른 엄지로 봄 (② 의 '선 바로 옆'을 옆 줄 쪽 절반까지 넓힘) */
const TWIN_GAP = 0.15;

export class Game {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {import('./render.js').Renderer} o.renderer
   */
  constructor({ audio, renderer, level, settings, auto = false, onHud, onEnd, onDeath, pairHeart }) {
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
    /** 늦게 도착한 터치로 되살린 MISS 수 · 터치가 가장 늦게 도착한 시간(초) — 폰 버벅임 확인용으로 점수와 같이 보냄 */
    this.revived = 0;
    this.maxLag = 0;
    /** 진짜 실수(헛침·지나가지 않은 MISS) 수 — 되살릴 때 콤보를 이어 줄지 (_revive) */
    this._hardBreaks = 0;
    /** 줄마다 마지막으로 눌린 곡 시각 (TWIN_GAP) */
    this._touchAt = {};
    /**
     * 쌍(동시치기)에서 다른 콩을 쳤으면 남은 콩 MISS 로 하트를 안 깎음 (_loseLife). 살아남는 게 곧 랭킹·승부인 곳
     *   (무제한·레벨업 챌린지·서바이벌 = level.challenge, 멀티 = main 이 false 로 줌)은 빼고 예전 그대로
     */
    this.pairHeart = pairHeart ?? !level.challenge;
    /** 쌍 봐주기로 GOOD 준 콩 수 · 엄지 쪽(left/right)마다 마지막으로 헛침·늦은 MISS 가 된 터치 시각 (_pairSave) */
    this.pairSaved = 0;
    this._wasteAt = {};
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

  _rollHit(roll, rt) {
    roll.hits++;
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
    if (this.r.live) for (const n of ['live2_combo.mp3']) this.audio.loadTrack(`assets/sfx/${n}`);
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
   * 반환: 이 터치의 결과 { lane, res } (res = perfect·great·good·miss·wrong·roll·none) — 터치 표시용 (main ?touch=show)
   */
  input(lane, perfMs, near) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return null;
    const playing = this.state === 'playing' && !this.auto;
    const t = playing ? this.songTime(perfMs) : 0;
    // 터치가 처리되기까지 걸린 시간 (폰 버벅임 확인용. 이상한 시각은 안 셈)
    const lag = perfMs != null ? rt - perfMs / 1000 : 0;
    if (playing && lag > this.maxLag && lag < 5) this.maxLag = lag;
    const side = playing && near ? near.filter((c) => c.d <= NEAR_HALF) : [];
    // 연타 구간: 그 줄(또는 그 줄 쪽 절반)은 칠 때마다 연타 +1, 다른 줄은 헛침 아님 (구간엔 노트가 없음)
    const roll = playing ? this._rollAt(t) : null;
    const touched = lane;
    let note = null;
    if (roll) {
      if (roll.lane !== lane && side.some((c) => c.lane === roll.lane)) lane = roll.lane;
    } else if (playing) {
      // 이 줄을 방금(TWIN_GAP 안) 다른 터치가 눌렀음 → 이 터치는 다른 엄지일 가능성이 큼 → 선 건너편 콩을 옆 줄 쪽 절반까지 봄
      //   (2026-11-24 DM 영상: 쿵 → 0.1초 뒤 짝에서 짝만 빠짐 = 두 엄지가 가운데에 붙어 짝 엄지가 쿵 줄 안쪽을 누름)
      const twin = t - (this._touchAt[lane] ?? -9) < TWIN_GAP;
      this._touchAt[lane] = t;
      note = this._pick(lane, t, side, twin ? NEAR_HALF : NEAR_LINE);
      // 이 콩은 방금 일찍 누른 터치(헛침)가 이미 쓴 것이고, 같은 줄 다음 콩도 판정 시간 안이면 → 이 터치는 다음 콩 것.
      //   일찍 누른 콩은 지금 MISS (그 헛침이 MISS 로 바뀜, 벌은 한 번만)
      if (note && note.early && !note.judged) {
        const next = this._take(note.lane, t, note);
        if (next) {
          this._miss(note, rt);
          note = next;
        }
      }
      if (note) lane = note.lane;
    }
    // 소리가 오류 나도 판정은 꼭 함 (예전에 소리 엔진을 새로 만든 뒤 쿵 소리만 오류 나서 쿵 판정이 통째로 빠졌음)
    try {
      if (this.level.tapMelody && lane === SNARE) {
        if (playing) this._playMelodyTap(t);
      } else if (!this.auto) this.audio.playLane(lane);
    } catch {}
    this.r.onTap(lane, rt);
    if (!playing) return null;
    if (roll) {
      if (roll.lane === lane) {
        this._rollHit(roll, rt);
        return { lane, res: 'roll' };
      }
      if (t >= roll.t0 && t <= roll.t1) return { lane, res: 'none' };
    }
    if (note) {
      // 이 터치가 '사실은' 다른 콩 것이었거나 남는 터치였을 수도 → 기억해 두고, 이 콩의 진짜 주인 터치가 헛침이 될 때 한 번 바꿔 줌 (_retake):
      //   - 선 바로 옆 터치: 선 건너편 줄에도 칠 콩이 있었음 (엄지가 선을 살짝 넘음) → 이 터치는 그 콩으로
      //   - 다음 콩을 일찍 친 터치: 이 줄에 조금 늦게 친 지나간 콩이 있었음 → 이 터치는 그 콩(어차피 MISS) 것
      //   - 그 밖(같은 엄지가 한 번 더 튕김 등): 이 터치가 헛침 (벌은 그대로, 진짜 터치가 아니라 남는 터치에)
      const dt = t - note.time;
      let alt = null;
      for (const l of [touched, ...side.map((c) => c.lane)]) {
        if (l === note.lane) continue;
        const k = this._take(l, t);
        if (k && (!alt || k.time < alt.time)) alt = k;
      }
      if (!alt && dt < 0) alt = this._late(note.lane, t);
      note.swap = { alt, t, from: touched };
      this._hit(note, dt, rt);
      return { lane, res: note.result };
    }
    // 이 줄 콩을 다른 터치가 먼저 쳐 갔고, 그 터치에 돌려줄 콩이 있음 → 서로 바꾸면 둘 다 맞음 (지나간 콩 MISS 보다 먼저)
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const n = this._retake(l, t, rt, false);
      if (n) return { lane: l, res: n.result };
    }
    // 지나간 콩을 GOOD 보다 조금 늦게 친 것: 그 콩을 지금 MISS 로 (어차피 MISS) — 헛침까지 더 받지 않게.
    //   이미 MISS 로 넘어간 콩이면(폰이 버벅여 터치가 늦게 도착) 벌은 받았으니 아무것도 안 함
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const late = this._late(l, t);
      if (!late) continue;
      this._waste(touched, t);
      if (!late.judged) this._miss(late, rt);
      return { lane: l, res: 'miss' };
    }
    // 위 경우: 이 줄 콩을 다른 터치가 먼저 쳐 갔고 이 터치는 칠 게 없음 → 이 터치가 그 콩을 치고, 먼저 친 터치는 원래 콩으로 (한 번만)
    for (const l of [lane, ...side.map((c) => c.lane)]) {
      const n = this._retake(l, t, rt, true);
      if (!n) continue;
      return { lane: l, res: n.result };
    }
    // 노트 없는 곳을 누름(일찍 누른 것 포함) → 헛침: 점수 없음 + 콤보 끊김 + 목숨 하나 (카운트인/끝난 뒤는 봐줌). 다가오는 콩은 그대로
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) {
      const hurt = this._wrong(lane, rt, t);
      // 일찍 누른 콩: 끝내 못 치고 지나가면 이 헛침이 그 콩 MISS 로 바뀜 (_sweep) — 한 번 실수에 벌 한 번
      const soon = this._early(lane, t);
      if (soon && !soon.early) soon.early = { hurt };
      return { lane, res: 'wrong' };
    }
    return { lane, res: 'none' };
  }

  /** 이 터치(시각 t, 누른 줄 lane, 선 근처 옆 줄 side)가 칠 콩 (맨 위 '터치 판정은 단순하게' 규칙, 없으면 null) */
  _pick(lane, t, side, zone = NEAR_LINE) {
    const own = this._take(lane, t);
    // 내 줄 콩이 왔음(PERFECT 안이거나 지났음) → 그 콩
    if (own && t - own.time >= -JUDGE.perfect) return own;
    // 내 줄 지나간 콩에 조금 늦은 터치 → 그 콩 것 (옆 줄·같은 엄지 줄 콩을 가져가지 않음. input 이 그 콩 MISS 하나로)
    if (!own && this._late(lane, t)) return null;
    let alt = null;
    for (const c of side) {
      if (own && c.d > zone) continue;
      const k = this._take(c.lane, t);
      if (k && (!alt || k.time < alt.time)) alt = k;
    }
    const hand = INSTRUMENTS[lane] && INSTRUMENTS[lane].hand;
    if (own) {
      // 같은 엄지가 맡는 줄(챙·쿵 / 짝·츠)은 동시에 나오지 않음 → 내 줄 콩은 아직 안 왔고 같은 엄지 줄 콩이 먼저 와 있으면 그 콩
      //   (2026-11-24: 두 엄지를 거의 같이 누르면 폰이 터치를 하나만 보낼 때가 있음 → 엄지를 벌려 바깥 줄(챙·츠)만 눌러도 쿵·짝이 다 쳐지게)
      for (const l of this.laneOrder) {
        if (l === lane || !INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
        const k = this._take(l, t);
        if (k && (!alt || k.time < alt.time)) alt = k;
      }
      return alt && alt.time < own.time ? alt : own;
    }
    if (alt) return alt;
    // 동시에 치는 콩: 이 줄 콩을 다른 엄지가 방금 (선을 넘어) 쳤으면 → 같은 시각의 남은 콩
    const done = this._doneNear(lane, t);
    if (done) {
      for (const l of this.laneOrder) {
        if (l === lane) continue;
        const k = this._take(l, t);
        if (k && k.time === done.time) return k;
      }
    }
    // 같은 엄지가 맡는 줄(챙·쿵·탐 / 짝·츠)은 동시에 나오지 않음 → 내 줄에 노트가 없으면 같은 엄지 줄의 노트로.
    //   4줄일 때 맨 왼쪽 챙 줄이 넓어서 왼쪽 엄지가 쿵 대신 챙을 눌러 쿵이 '안 쳐지던' 것 (유저 맵 신고)
    for (const l of this.laneOrder) {
      if (l === lane || !INSTRUMENTS[l] || INSTRUMENTS[l].hand !== hand) continue;
      const k = this._take(l, t);
      if (k && (!alt || k.time < alt.time)) alt = k;
    }
    return alt;
  }

  /** 이 줄에서 t 에 칠 수 있는 콩: 판정 시간(GOOD) 안의 안 쳐진 콩 중 가장 먼저 온 것 (after 를 주면 그 콩 뒤에서, 없으면 null) */
  _take(lane, t, after = null) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length; i++) {
      const n = list[i];
      const dt = t - n.time;
      if (dt < -JUDGE.good) return null;
      if (after && n.time <= after.time) continue;
      if (dt <= JUDGE.good && this._open(n, t)) return n;
    }
    return null;
  }

  /**
   * 이 줄에서 다른 터치가 '어쩌면 남의 콩을' 쳐 간 콩(swap)을 이 터치(t)가 되찾음: 판정은 이 터치 시간으로 다시 매기고,
   *   먼저 친 터치는 그때 칠 수 있던 원래 콩(swap.alt)으로 — 그 콩이 그 터치 시각에 판정 시간 안일 때만.
   *   돌려줄 콩이 없으면(남는 터치) 먼저 친 터치가 헛침, 지나간 콩이었으면 그 콩이 MISS (벌은 늘 한 번).
   *   바꾸기는 한 번만, 줄줄이 이어지지 않음. 이 터치가 어차피 헛침이 될 때만 부름. stray=false 면 둘 다 맞는 바꾸기만
   */
  _retake(lane, t, rt, stray) {
    const list = this.lanes[lane];
    for (let i = Math.max(0, this.ptr[lane] - 4); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      const s = n.swap;
      if (!s || !n.judged || n.result === 'miss' || Math.abs(t - n.time) > JUDGE.good) continue;
      const a = s.alt;
      const adt = a ? s.t - a.time : 0;
      const altOk = a && Math.abs(adt) <= JUDGE.good && this._open(a, s.t);
      if (!altOk && !stray) continue;
      // 먼저 친 터치에 돌려줄 콩이 없으면 이 터치가 시간이 더 잘 맞을 때만 (정확히 친 콩을 뒤 터치가 뺏으면 안 됨).
      //   남는 터치는 가끔 하나 → 0.5초 안에 헛침이 있었으면(마구 두드림) 안 바꿈 (여러 번 두드려 시간 맞는 걸 골라 갖지 못하게)
      if (!altOk && Math.abs(t - n.time) >= Math.abs(s.t - n.time)) continue;
      if (!a && t - (this._wrongT ?? -9) < 0.5) continue;
      n.swap = null;
      const dt = t - n.time;
      const ad = Math.abs(dt);
      const res = ad <= JUDGE.perfect ? 'perfect' : ad <= JUDGE.great ? 'great' : 'good';
      if (n.offAt != null) this.offsets[n.offAt] = dt;
      if (res !== n.result) {
        this.counts[n.result]--;
        this.counts[res]++;
        this.score += Math.round((pointsFor(res, n.comboAt) - pointsFor(n.result, n.comboAt)) * (n.mult || 1));
        n.result = res;
      }
      this.r.onJudge(n.lane, res, rt, dt < 0);
      if (altOk) this._hit(a, adt, rt);
      else if (!a) this._wrong(s.from, rt, s.t); // 남는 터치였음 → 그 터치가 헛침
      return n;
    }
    return null;
  }

  /** 이 줄에서 너무 일찍(GOOD 밖 EARLY 안) 누른, 아직 안 쳐진 다음 콩 (없으면 null) */
  _early(lane, t) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length; i++) {
      const n = list[i];
      const dt = t - n.time;
      if (dt < -JUDGE.early) return null;
      if (!n.judged && dt < -JUDGE.good) return n;
    }
    return null;
  }

  /** 이 줄에서 t 의 판정 시간(GOOD) 안에 이미 쳐진 콩 (MISS 말고, 없으면 null) */
  _doneNear(lane, t) {
    const list = this.lanes[lane];
    for (let i = this._from(lane, t); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      if (n.judged && n.result !== 'miss' && Math.abs(t - n.time) <= JUDGE.good) return n;
    }
    return null;
  }

  /** 이 줄에서 GOOD 보다 조금(MISS_SLACK 안) 늦게 친 콩: 아직 안 쳐졌거나, 지나가서 MISS 로 넘긴 것 (없으면 null) */
  _late(lane, t) {
    const list = this.lanes[lane];
    let best = null;
    for (let i = this._from(lane, t); i < list.length && list[i].time < t; i++) {
      const n = list[i];
      const dt = t - n.time;
      // 일찍 누른 헛침이 이미 쓴 콩은 빼고 (지나가면 그 헛침이 MISS 로 바뀜)
      if (dt > JUDGE.good && dt <= JUDGE.good + MISS_SLACK && (!n.judged || n.swept) && !n.early) best = n;
    }
    return best;
  }

  /**
   * 터치(누른 시각 t) 기준으로 아직 칠 수 있는 콩: 안 쳐진 콩, 또는 지나가서 MISS 로 넘겼지만 t 때는 아직 넘기기 전이었던 콩.
   *   폰이 버벅여 터치가 늦게 도착하면 그사이 화면 갱신이 콩을 MISS 로 넘겨 버림 → 그 터치는 '누른 그 순간' 상황 그대로 판정:
   *   GOOD 안이면 되살림(_revive). (2026-11-23 '빽빽한 곳이나 그 부분을 지나고 나면 터치가 잘 안 돼요')
   *   제때 도착한 터치는 MISS 처리(콩 시각 + GOOD + MISS_SLACK) 전에 판정되므로 늘 '안 쳐진 콩'만 봄
   */
  _open(n, t) {
    return !n.judged || (n.swept && t - n.time <= JUDGE.good + MISS_SLACK);
  }

  /** 이 줄에서 t 기준으로 볼 첫 콩 자리: 판정 자리(ptr)에서 MISS 로 넘긴 콩까지 조금 거슬러 올라감 (_open) */
  _from(lane, t) {
    const list = this.lanes[lane];
    const p = Math.min(this.ptr[lane], list.length);
    let i = p;
    while (i > 0 && p - i < 24 && list[i - 1].time > t - 1) i--;
    return i;
  }

  /** 콩을 침 (MISS 로 넘겼던 콩이면 되살림) */
  _hit(n, dt, rt) {
    if (n.swept) this._revive(n, dt, rt);
    else this._judge(n, dt, rt);
  }

  /**
   * 늦게 도착한 터치로 MISS 를 되살림: MISS 로 받은 벌(판정 수·목숨)을 돌려주고 그 터치 시각으로 판정.
   *   콤보는 그 MISS 뒤에 다른 실수(헛침·진짜 MISS)가 없었을 때만 이어 줌
   */
  _revive(n, dt, rt) {
    if (n.saved) {
      // 쌍 봐주기로 GOOD 준 콩에 늦게 도착한 진짜 터치(폰 버벅임) → 봐준 GOOD 을 되돌리고 그 터치 시각으로 판정
      n.saved = false;
      n.swept = false;
      this.pairSaved--;
      this.counts.good--;
      this.score -= n.savedPts || 0;
      if (n.saveHard === this._hardBreaks) this.combo = Math.max(0, this.combo - 1);
      this._judge(n, dt, rt);
      return;
    }
    n.swept = false;
    n.revived = true;
    this.revived++;
    this.counts.miss--;
    // 일찍 누른 헛침을 이 MISS 로 바꿨었음 → 콩을 쳤으니 그건 도로 헛침
    if (n.wasWrong) {
      n.wasWrong = false;
      this.counts.wrong++;
    }
    // 이 MISS 로 깎인 하트를 돌려줌. 같은 쌍의 다른 콩이 MISS 로 깎은 하트도 — 이제 이 콩을 쳤으니
    //   쌍 규칙(하나만 쳐도 하트 그대로, _loseLife·pairHeart)으로 그 MISS 는 하트를 안 깎음
    let refund = !!n.hurt;
    n.hurt = false;
    for (const l of this.laneOrder) {
      if (l === n.lane) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time); i < list.length && list[i].time <= n.time; i++) {
        const m = list[i];
        if (m.time !== n.time) continue;
        if (this.pairHeart) {
          if (m.hurt) {
            m.hurt = false;
            refund = true;
          }
        } else if (refund && m.swept) {
          // 쌍 규칙을 안 쓰는 곳: 같이 놓친 동시치기 콩이 아직 MISS → 목숨 하나는 그 콩 몫 (둘 다 놓쳐도 하나만 깎는 규칙)
          m.hurt = true;
          refund = false;
        }
      }
    }
    if (refund && this.livesOn && this.state === 'playing') {
      this.lives = Math.min(MAX_LIVES, this.lives + 1);
      if (this._lostAt === n.time) this._lostAt = null;
    }
    const u = n.undo;
    n.undo = null;
    if (u && u.hard === this._hardBreaks) this.combo = Math.max(this.combo, u.combo);
    this._judge(n, dt, rt);
  }

  /** 노트 없는 곳을 누름(헛침): 콤보 끊김 + 목숨 하나. 두 엄지가 동시에 미끄러져도(0.12초 안) 하나만 */
  _wrong(lane, rt, t) {
    this.counts.wrong++;
    if (t !== undefined) this._waste(lane, t);
    if (t !== undefined) this._wrongT = Math.max(this._wrongT ?? -9, t);
    this.combo = 0;
    this._hardBreaks++;
    this.r.onJudge(lane, 'wrong', rt);
    if (t === undefined || t - (this._wrongLostAt ?? -9) < WRONG_GAP) return false;
    if (t < this.graceUntil || !this.livesOn || this.state !== 'playing') return false;
    this._wrongLostAt = t;
    this._hurt(rt);
    return true;
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
    n.comboAt = this.combo; // 되찾기 때 판정을 다시 매길 때 씀 (_retake)
    n.offAt = this.offsets.length;
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
    this.r.onJudge(n.lane, res, rt, dt < 0);
    this.r.onCombo(this.combo, rt);
    // 🔔 25콤보마다 '반짝' (치는 소리에 안 묻히게 작게)
    if (this.combo > 0 && this.combo % 25 === 0) {
      try {
        this.audio.sfxFile(this.audio.uiSet === 'live' ? 'live2_combo' : 'combo', 0.35);
      } catch {}
    }
    if (this.livesOn && !(this.auto && this.level.failReel) && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.combo % 25 === 0) {
      // 소리 오류가 여기서 터지면 같은 터치 이벤트에 같이 온 다른 엄지 터치가 빠짐 → 막아 둠
      try {
        this.audio.crash(undefined, this.audio.sfxBus, 0.5);
      } catch {}
      this.milestoneAt = this.songTime();
    }
    if (this.settings.vibrate && navigator.vibrate) {
      try {
        navigator.vibrate(res === 'perfect' ? 12 : 8);
      } catch {}
    }
  }

  /** MISS. swept = 지나가서 MISS 로 넘김 (늦게 도착한 터치가 되살릴 수 있게 그 전 콤보를 기억, _revive) */
  _miss(n, rt, swept = false) {
    n.judged = true;
    n.result = 'miss';
    if (swept) {
      n.swept = true;
      n.undo = { combo: this.combo, hard: this._hardBreaks };
    } else this._hardBreaks++;
    this.counts.miss++;
    this.combo = 0;
    this.r.onJudge(n.lane, 'miss', rt);
    // 일찍 누른 헛침이 이 콩 것이었음 → 헛침을 이 MISS 로 바꿈 (목숨은 그 헛침 때 이미 깎였으면 또 안 깎음)
    const e = n.early;
    if (e) {
      n.early = null;
      n.wasWrong = true;
      this.counts.wrong = Math.max(0, this.counts.wrong - 1);
      if (e.hurt) return;
    }
    this._loseLife(n, rt);
  }

  /**
   * 지나간 노트 → MISS. 기준은 '바로 전 화면' 때 곡 시각 (한 프레임 늦게):
   *   폰이 버벅인 뒤 화면 갱신이 밀려 있던 터치보다 먼저 돌아도, 버벅이는 동안 누른 터치가 먼저 판정됨 (그 뒤에 온 건 _revive)
   */
  _sweep(now, rt) {
    const h = Math.min(now, this._sweepPrev ?? now);
    this._sweepPrev = now;
    for (const lane of this.laneOrder) {
      const list = this.lanes[lane];
      while (this.ptr[lane] < list.length) {
        const n = list[this.ptr[lane]];
        if (n.judged) {
          this.ptr[lane]++;
          continue;
        }
        if (h - n.time > JUDGE.good + MISS_SLACK) {
          if (this._canPairSave(n)) this._pairSave(n, rt);
          else this._miss(n, rt, true);
          this.ptr[lane]++;
          continue;
        }
        break;
      }
    }
  }

  /**
   * MISS → 목숨 하나. 동시치기(두 레인 같은 시각)를 둘 다 놓쳐도 하나만 깎음.
   *   🖐 쌍(점선으로 이어진 동시치기 = 같은 시각 콩)에서 다른 콩은 쳤으면 하트는 안 깎음 — 점수·콤보·정확도는 MISS 그대로 (2026-11-24):
   *   폰이 동시에 닿은 두 엄지 중 하나의 터치를 아예 안 보낼 때가 있음(DM 영상: 쌍 5번 중 3번, 「창·캔·포」가 1만 오름).
   *   안 누른 건지 폰이 안 보낸 건지 게임은 모름 → 맞음으로 쳐 주진 않고(랭킹 점수 그대로), 폰 탓일 수 있는 하트만 지킴
   */
  _loseLife(n, rt) {
    if (!this.livesOn || this.state !== 'playing') return;
    if (n.time < this.graceUntil) return;
    if (this._lostAt === n.time) return;
    if (this.pairHeart && this._mateHit(n)) return;
    this._lostAt = n.time;
    n.hurt = true; // 되살리면 돌려줌 (_revive)
    this._hurt(rt);
  }

  /** 이 터치가 헛침·늦은 MISS 였음 → 그 엄지 쪽 기록 (쌍 봐주기는 그쪽을 누르다 틀린 콩엔 안 줌) */
  _waste(lane, t) {
    const hand = INSTRUMENTS[lane] && INSTRUMENTS[lane].hand;
    if (hand) this._wasteAt[hand] = Math.max(this._wasteAt[hand] ?? -9, t);
  }

  /**
   * 🖐 쌍 봐주기 (2026-11-24, 사용자 결정 'MISS 뜨고 하트 안 깎이는 것보다 GOOD'):
   *   쌍(같은 시각 콩)에서 다른 콩은 쳤는데 이 콩은 터치 없이 지나감 → MISS 대신 GOOD (하트·콤보 그대로, 점수는 GOOD 만큼).
   *   아이폰은 한 엄지가 떨어지는 순간 다른 엄지가 닿으면 그 터치를 아예 안 보낼 때가 있음(CLAUDE.md 🍎).
   *   그 엄지 쪽에서 헛침·늦은 터치·일찍 누름이 있었으면(누르다 틀림) 그대로 MISS. 무제한·챌린지·멀티(pairHeart false)는 안 함
   */
  _canPairSave(n) {
    if (!this.pairHeart || n.early || !this._mateHit(n)) return false;
    const hand = INSTRUMENTS[n.lane] && INSTRUMENTS[n.lane].hand;
    return (this._wasteAt[hand] ?? -9) < n.time - JUDGE.good;
  }

  _pairSave(n, rt) {
    n.judged = true;
    n.swept = true; // 늦게 도착한 진짜 터치가 오면 되돌리고 다시 판정 (_revive)
    n.saved = true;
    n.result = 'good';
    n.saveHard = this._hardBreaks;
    this.pairSaved++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts.good++;
    n.savedPts = Math.round(pointsFor('good', this.combo) * (n.mult || 1));
    this.score += n.savedPts;
    n.comboAt = this.combo;
    this.r.onJudge(n.lane, 'good', rt);
    this.r.onCombo(this.combo, rt);
    if (this.livesOn && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
  }

  /** 같은 시각 다른 줄 콩(쌍) 중 맞힌 게 있나 (MISS 말고) */
  _mateHit(n) {
    for (const l of this.laneOrder) {
      if (l === n.lane) continue;
      const list = this.lanes[l];
      for (let i = this._from(l, n.time); i < list.length && list[i].time <= n.time; i++) {
        const m = list[i];
        if (m.time === n.time && m.judged && m.result !== 'miss') return true;
      }
    }
    return false;
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
    this._sweep(now, rt);
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

  /**
   * 핵 의심 확인용: 박자 오차 퍼짐(표준편차)·평균(ms), 친 수, 가짜 입력 수. 사람은 손가락이라 오차가 들쭉날쭉, 자동 입력은 너무 일정
   *   + 폰 버벅임: 늦게 도착한 터치로 되살린 MISS 수(rv)·터치가 가장 늦게 처리된 시간(lag, ms)
   */
  _check() {
    const o = this.offsets;
    const n = o.length;
    const mean = n ? o.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(o.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1)) : 0;
    return { sd: Math.round(sd * 1000), mean: Math.round(mean * 1000), n, fake: this.fakeTaps, rv: this.revived, lag: Math.round(this.maxLag * 1000), ps: this.pairSaved };
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
