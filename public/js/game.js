// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

import {
  STEPS_PER_BAR, tempoOf, ROUND_BARS, roundInfo, diamondsFor,
  buildNotes, JUDGE, pointsFor, accuracy, gradeFor, starsFor,
  COUNT_IN_BARS, OUTRO_BARS, maxScore, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH,
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
export const REVIVE_LIVES = 1;
/** 이어하기 직후 목숨 안 깎이는 시간(초) */
const REVIVE_GRACE = 1.6;
/** 헛침으로 목숨이 깎인 뒤 이 시간(초) 안의 헛침은 또 안 깎음 (두 엄지 동시 실수) */
const WRONG_GAP = 0.12;

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
    // 자동 연주(영상 찍기)나 죽었을 때 처리할 곳이 없으면 목숨 없음
    this.livesOn = !auto && !!this.onDeath;
    this.lives = MAX_LIVES;
    this.continues = 0;
    this.graceUntil = -Infinity;
    this._lostAt = null;
    this.state = 'idle';
    this.beat = 60 / this.tempo.bpm(0);
    this.approach = 1.5 / (settings.noteSpeed || 1);
    this.firstNoteTime = this.notes.length ? this.notes[0].time : 0;
    this._setEnd();
    this.maxScore = level.endless ? 0 : maxScore(level);
    /** 마디마다 끝났을 때 점수 (1:1 대결에서 상대 점수를 실시간으로 보여줄 때 씀) */
    this.timeline = [];
    this._loop = this._loop.bind(this);
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
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    this.audio.ctx.suspend().catch(() => {});
  }

  async resume() {
    if (this.state !== 'paused') return;
    await this.audio.ctx.resume().catch(() => {});
    this.audio.resetClock();
    this.state = 'playing';
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.state = 'stopped';
    cancelAnimationFrame(this._raf);
    if (this.player) this.player.stop();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume().catch(() => {});
  }

  /** 엄지 입력. lane = 악기 번호(charts.js KICK/SNARE/HAT/CRASH). perfMs = event.timeStamp */
  input(lane, perfMs) {
    const rt = performance.now() / 1000;
    if (!this.laneOrder.includes(lane)) return;
    if (!this.auto) this.audio.playLane(lane);
    this.r.onTap(lane, rt);
    if (this.state !== 'playing' || this.auto) return;
    const t = this.songTime(perfMs);
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
      return;
    }
    // 너무 일찍 누름 → 그 노트는 MISS (마구 연타해서 점수 받는 것 방지)
    if (ahead && t - ahead.time >= -JUDGE.early) {
      this._miss(ahead, rt);
      return;
    }
    // 노트 없는 곳을 누름 → 헛침: 점수 없음 + 콤보 끊김 (카운트인/끝난 뒤는 봐줌)
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) this._wrong(lane, rt, t);
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

  /** 이어하기 안 하고 끝내기 → 실패 결과 */
  giveUp() {
    if (this.state !== 'dead') return;
    this.audio.ctx.resume().catch(() => {});
    this._finish(true);
  }

  _loop() {
    if (this.state !== 'playing') return;
    const rt = performance.now() / 1000;
    const now = this.songTime();
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
        if (now - n.time > JUDGE.good) {
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
    const r = Math.min(this.level.maxRounds, Math.max(1, Math.floor((mb + 0.25) / ROUND_BARS) + 1));
    if (r !== this.round) {
      this.round = r;
      this.roundInfo = this._roundInfo(r);
      if (this.r.onRound) this.r.onRound(this.roundInfo, rt);
    }
  }

  /** 지금까지 깬 단계 수 */
  _roundsCleared(now) {
    const mb = this.tempo.barAt(now) - COUNT_IN_BARS;
    return Math.max(0, Math.min(this.level.maxRounds, Math.floor(mb / ROUND_BARS)));
  }

  _hud(now) {
    const barPos = this.tempo.barAt(now) - COUNT_IN_BARS;
    let progress;
    if (this.level.endless) progress = Math.max(0, (barPos % ROUND_BARS) / ROUND_BARS);
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

  _finish(failed = false) {
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
      continued: this.continues,
      progress: failed ? Math.max(0, Math.min(1, (this.diedAt ?? 0) / this.endTime)) : 1,
      avgOffsetMs,
      auto: this.auto,
      timeline: this.timeline.slice(),
    });
  }

  /** 무제한 모드 / 레벨업 챌린지 결과: 몇 단계까지 깼나 + 다이아몬드 */
  _finishChallenge(died) {
    const lv = this.level;
    const at = died ? this.diedAt ?? this.songTime() : this.endTime;
    const cleared = died ? this._roundsCleared(at) : lv.maxRounds;
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
      bpmReached: this._roundInfo(Math.max(1, Math.min(lv.maxRounds, cleared + (died ? 1 : 0)))).bpm,
      diamonds: diamondsFor(cleared),
      stars: 0,
      fullCombo: false,
      failed: false,
      died,
      continued: this.continues,
      progress: 1,
      avgOffsetMs,
      auto: this.auto,
      timeline: [],
    });
  }
}
