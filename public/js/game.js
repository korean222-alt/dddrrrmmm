// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

import {
  STEPS_PER_BAR, stepDur,
  buildNotes, beatDur, barDur, JUDGE, pointsFor, accuracy, gradeFor, starsFor,
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
/** 이어하기 직후 목숨 안 깎이는 시간(초) */
const REVIVE_GRACE = 1.6;

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
    this.notes = buildNotes(level);
    /** 화면 왼쪽부터 레인(악기) 순서 */
    this.laneOrder = levelLanes(level);
    this.lanes = INSTRUMENTS.map(() => []);
    for (const n of this.notes) {
      n.judged = false;
      n.result = null;
      this.lanes[n.lane].push(n);
    }
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
    this.beat = beatDur(level);
    this.approach = 1.5 / (settings.noteSpeed || 1);
    this.firstNoteTime = this.notes.length ? this.notes[0].time : 0;
    this.lastNoteTime = this.notes.length ? this.notes[this.notes.length - 1].time : 0;
    this.endTime = this.lastNoteTime + barDur(level) * OUTRO_BARS + 0.4;
    this.maxScore = maxScore(level);
    /** 마디마다 끝났을 때 점수 (1:1 대결에서 상대 점수를 실시간으로 보여줄 때 씀) */
    this.timeline = [];
    this._loop = this._loop.bind(this);
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
    if (t > this.firstNoteTime - this.beat && t < this.lastNoteTime + JUDGE.good) this._wrong(lane, rt);
  }

  _wrong(lane, rt) {
    this.counts.wrong++;
    this.combo = 0;
    this.r.onJudge(lane, 'wrong', rt);
  }

  _judge(n, dt, rt) {
    const ad = Math.abs(dt);
    const res = ad <= JUDGE.perfect ? 'perfect' : ad <= JUDGE.great ? 'great' : 'good';
    n.judged = true;
    n.result = res;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[res]++;
    this.score += pointsFor(res, this.combo);
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

  /** 광고 보고 이어하기: 목숨 다시 꽉 채우고, 바깥에서 카운트다운 후 resume() */
  revive() {
    if (this.state !== 'dead') return false;
    this.continues++;
    this.lives = MAX_LIVES;
    this.graceUntil = this.diedAt + REVIVE_GRACE;
    this.r.onLife(this.lives, +MAX_LIVES, performance.now() / 1000);
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

    const barPos = (now - COUNT_IN_BARS * barDur(this.level)) / barDur(this.level);
    while (this.timeline.length < this.level.bars.length && this.timeline.length < Math.floor(barPos)) this.timeline.push(this.score);

    this.onHud(this._hud(now));

    if (now >= this.endTime) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  _hud(now) {
    return {
      score: this.score,
      combo: this.combo,
      lives: this.livesOn ? this.lives : null,
      progress: Math.max(0, Math.min(1, now / this.endTime)),
      barPos: (now - COUNT_IN_BARS * barDur(this.level)) / barDur(this.level),
    };
  }

  _drawFrame(now, rt, dead = false) {
    // 카운트인 표시 (+ 엄지 안내)
    let countIn = null;
    const ciEnd = COUNT_IN_BARS * barDur(this.level);
    if (now < ciEnd) {
      const b = Math.max(0, Math.floor(now / this.beat));
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: now < 0 ? 0 : (now / this.beat) % 1, fade: 1 };
    } else if (now < ciEnd + this.beat * 2) {
      countIn = { label: '', phase: 1, fade: 1 - (now - ciEnd) / (this.beat * 2) };
    }

    const { hatAge, crashAge } = this._kitAges(now);

    this.r.draw(
      {
        hatAge,
        crashAge,
        now,
        notes: this.notes,
        approach: this.approach,
        beatDur: this.beat,
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
    const sd = stepDur(this.level);
    const idx = Math.floor(now / sd);
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
        hatAge = now - i * sd;
        break;
      }
    }
    const barLen = sd * STEPS_PER_BAR;
    const mbNow = Math.floor(now / barLen) - COUNT_IN_BARS;
    let crashAge = 9;
    for (let mb = mbNow; mb >= Math.max(0, mbNow - 2) && !mineCrash; mb--) {
      if ((mb > 0 && mb % 8 === 0) || mb === this.level.bars.length) {
        crashAge = now - (mb + COUNT_IN_BARS) * barLen;
        break;
      }
    }
    if (this.milestoneAt !== undefined) crashAge = Math.min(crashAge, now - this.milestoneAt);
    return { hatAge, crashAge };
  }

  _finish(failed = false) {
    this.state = 'finished';
    this.player.stop(0.6);
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
}
