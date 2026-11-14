// 한 판의 게임 진행: 시간 관리, 입력 판정, 점수/콤보.

import {
  buildNotes, beatDur, barDur, JUDGE, pointsFor, accuracy, gradeFor,
  COUNT_IN_BARS, OUTRO_BARS, maxScore,
} from './charts.js';
import { SongPlayer } from './audio.js';

const COUNT_LABELS = ['3', '2', '1', '시작!'];

export class Game {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {import('./render.js').Renderer} o.renderer
   */
  constructor({ audio, renderer, level, settings, auto = false, onHud, onEnd }) {
    this.audio = audio;
    this.r = renderer;
    this.level = level;
    this.settings = settings;
    this.auto = auto;
    this.onHud = onHud || (() => {});
    this.onEnd = onEnd || (() => {});
    this.notes = buildNotes(level);
    this.lanes = [[], []];
    for (const n of this.notes) {
      n.judged = false;
      n.result = null;
      this.lanes[n.lane].push(n);
    }
    this.ptr = [0, 0];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.offsets = [];
    this.state = 'idle';
    this.beat = beatDur(level);
    this.approach = 1.5 / (settings.noteSpeed || 1);
    this.lastNoteTime = this.notes.length ? this.notes[this.notes.length - 1].time : 0;
    this.endTime = this.lastNoteTime + barDur(level) * OUTRO_BARS + 0.4;
    this.maxScore = maxScore(level);
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

  /** 엄지 입력. lane 0=쿵, 1=짝. perfMs = event.timeStamp */
  input(lane, perfMs) {
    const rt = performance.now() / 1000;
    if (!this.auto) {
      if (lane === 0) this.audio.kick();
      else this.audio.snare();
    }
    this.r.onTap(lane, rt);
    if (this.state !== 'playing' || this.auto) return;
    const t = this.songTime(perfMs);
    const list = this.lanes[lane];
    for (let i = this.ptr[lane]; i < list.length; i++) {
      const n = list[i];
      if (n.judged) continue;
      const dt = t - n.time;
      if (dt < -JUDGE.good) break; // 아직 먼 노트: 헛치기(벌점 없음)
      if (dt > JUDGE.good) continue;
      this._judge(n, dt, rt);
      return;
    }
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
  }

  _loop() {
    if (this.state !== 'playing') return;
    const rt = performance.now() / 1000;
    const now = this.songTime();

    if (this.auto) {
      for (const lane of [0, 1]) {
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
    for (const lane of [0, 1]) {
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

    // 카운트인 표시
    let countIn = null;
    const ciEnd = COUNT_IN_BARS * barDur(this.level);
    if (now >= 0 && now < ciEnd) {
      const b = Math.floor(now / this.beat);
      countIn = { label: COUNT_LABELS[Math.min(b, 3)], phase: (now / this.beat) % 1 };
    } else if (now < 0) {
      countIn = { label: COUNT_LABELS[0], phase: 0 };
    }

    this.r.draw(
      {
        now,
        notes: this.notes,
        approach: this.approach,
        beatDur: this.beat,
        combo: this.combo,
        playing: true,
        countIn,
        finished: now > this.lastNoteTime + 0.3,
      },
      rt
    );

    this.onHud({
      score: this.score,
      combo: this.combo,
      progress: Math.max(0, Math.min(1, now / this.endTime)),
    });

    if (now >= this.endTime) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  _finish() {
    this.state = 'finished';
    this.player.stop(0.6);
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
      grade: gradeFor(this.counts),
      fullCombo: this.counts.miss === 0,
      avgOffsetMs,
      auto: this.auto,
    });
  }
}
