// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

import {
  STEPS_PER_BAR, tempoOf, ROUND_BARS, roundInfo, diamondsFor,
  buildNotes, JUDGE, pointsFor, accuracy, gradeFor, starsFor,
  COUNT_IN_BARS, OUTRO_BARS, maxScore, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH,
  buildRolls, markGoldNotes, ROLL_HEART_HITS, ROLL_MAX_HEARTS,
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
 */
const CROSS_GAP = 0.09;
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
    /** 레벨업 챌린지(무제한 모드): 지금 단계 */
    this.round = 0;
    this.ptr = INSTRUMENTS.map(() => 0);
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, wrong: 0 };
    this.offsets = [];
    /** 줄마다 마지막으로 누른 시각(곡 시간) — 엄지가 옆 줄로 넘어왔는지 볼 때 */
    this._tapAt = {};
    /** 줄마다 마지막으로 누른 자리 (render.laneHit 의 u, 줄 너비 단위) */
    this._tapPos = {};
    // 자동 연주(영상 찍기)나 죽었을 때 처리할 곳이 없으면 목숨 없음
    this.livesOn = !auto && !!this.onDeath;
    this.lives = MAX_LIVES;
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
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  start() {
    const ctx = this.audio.ctx;
    this.audio.resetClock();
    this.r.reset();
    this.r.laneOrder = this.laneOrder;
    this.startTime = ctx.currentTime + 0.35;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.start();
    this.state = 'playing';
    this._clockWatch = null;
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
    const at = this._goodNow ?? -0.35; // 마지막으로 시계가 흐르던 곡 시각 (못 흘렀으면 처음부터)
    const ctx = this.audio.ctx;
    this.audio.resetClock();
    if (this.player) this.player.stop(0.01);
    // 0.3초 뒤에 그 자리부터 다시 (heardTime ≈ currentTime 이라 곡 시각이 at 에서 이어짐)
    this.startTime = ctx.currentTime + 0.3 - at;
    this.player = new SongPlayer(this.audio, this.level, this.startTime, { autoChart: this.auto });
    this.player.step = Math.max(0, Math.floor(this.tempo.barAt(Math.max(0, at)) * STEPS_PER_BAR) - 1);
    this.player.start();
    this._clockWatch = null;
    this._stallSince = null;
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
  input(lane, perfMs, near, pos) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return;
    const playing = this.state === 'playing' && !this.auto;
    const t = playing ? this.songTime(perfMs) : 0;
    const touched = lane;
    if (playing && near && near.length) lane = this._pickLane(lane, t, near, pos);
    if (!this.auto) this.audio.playLane(lane);
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
    for (let i = this.ptr[lane]; i < list.length; i++) {
      const n = list[i];
      if (n.judged) continue;
      const dt = t - n.time;
      if (dt > JUDGE.good) continue;
      if (dt < -JUDGE.good) {
        ahead = n;
        break;
      }
      this._judge(n, dt, rt);
      // 옆 줄에서 넘어온 터치가 가져간 노트 → 그 줄 엄지가 곧 진짜로 치면 헛침으로 안 봄
      if (lane !== touched) n.borrowed = true;
      return;
    }
    // 이 줄 노트를 옆 줄 터치가 먼저 가져갔음 → 이번이 진짜 그 노트를 친 것 (헛침·MISS 아님)
    for (let i = Math.max(0, this.ptr[lane] - 4); i < list.length && list[i].time - t <= JUDGE.good; i++) {
      const n = list[i];
      if (n.borrowed && !n.reclaimed && Math.abs(t - n.time) <= JUDGE.good) {
        n.reclaimed = true;
        this.r.onJudge(lane, n.result, rt);
        return;
      }
    }
    // 너무 일찍 누름 → 그 노트는 MISS (마구 연타해서 점수 받는 것 방지)
    if (ahead && t - ahead.time >= -JUDGE.early) {
      this._miss(ahead, rt);
      return;
    }
    // 노트 없는 곳을 누름 → 헛침: 점수 없음 + 콤보 끊김 (카운트인/끝난 뒤는 봐줌)
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) this._wrong(lane, rt, t);
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
    if (best === null) return lane;
    if (!own) return best;
    // 둘 다 노트가 있으면 내 줄 우선. 다만 엄지가 넘어온 경우 옆 줄 노트가 확실히 더 가까우면 옆 줄
    if (crossed && bestGap + JUDGE.perfect < Math.abs(t - own.time)) return best;
    return lane;
  }

  /** 노트 없는 곳을 누름(헛침): 콤보 끊김 + 목숨 하나. 두 엄지가 동시에 미끄러져도(0.12초 안) 하나만 */
  _wrong(lane, rt, t) {
    this.counts.wrong++;
    this.combo = 0;
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
    this.r.onJudge(n.lane, res, rt, dt < 0);
    this.r.onCombo(this.combo, rt);
    if (this.livesOn && this.combo % LIFE_REGEN_COMBO === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.r.onLife(this.lives, +1, rt);
    }
    if (this.combo % 25 === 0) {
      this.audio.crash(undefined, this.audio.sfxBus, 0.5);
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
    if (!frozen) {
      const w = this._clockWatch;
      if (!w || w.ct !== actx.currentTime) {
        if (w) this._tickAt = rt; // 시계가 실제로 흐름 (터치로 엔진을 새로 만들어도 안 흐르면 그대로 → 얼마나 오래 멈췄나)
        this._clockWatch = { ct: actx.currentTime, rt };
      }
      else if (rt - w.rt > 0.5) frozen = true;
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
    } else this._stallSince = null;
    const now = this.songTime();
    if (!frozen) this._goodNow = now;
    this._extend(now);
    this._checkRound(now, rt);

    if (this.auto) {
      for (const lane of this.laneOrder) {
        const list = this.lanes[lane];
        while (this.ptr[lane] < list.length && list[this.ptr[lane]].time <= now) {
          const n = list[this.ptr[lane]];
          this.r.onTap(lane, rt);
          this._judge(n, 0, rt);
          this.ptr[lane]++;
        }
      }
      // 자동 연주: 연타 구간은 16분음표마다 두드림
      for (const roll of this.rolls) {
        if (now < roll.t0 || now > roll.t1) continue;
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
    if (now < ciEnd) {
      const b = Math.max(0, Math.floor(now / this.beat));
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: now < 0 ? 0 : (now / this.beat) % 1, fade: 1 };
    } else if (now < ciEnd + this.beat * 2) {
      countIn = { label: '', phase: 1, fade: 1 - (now - ciEnd) / (this.beat * 2) };
    }

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
      auto: this.auto,
      practice: this.level.practice || 0,
      timeline: this.timeline.slice(),
      rollHits: this.rollHits,
      goldHits: this.goldHits,
      goldTotal: this.goldTotal,
    });
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
