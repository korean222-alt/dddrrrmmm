// 오디오 엔진: 음원 파일 없이 Web Audio 로 드럼/반주를 합성합니다.
// - 모든 박자 판정은 AudioContext 시계 기준 (setTimeout 보다 훨씬 정확)
// - heardTime(): "지금 스피커에서 나오고 있는 소리"의 시각. 출력 지연까지 반영.

import { STEPS_PER_BAR, COUNT_IN_BARS, OUTRO_BARS, stepDur } from './charts.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeSilentWavUrl() {
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 0.8, sfx: 1 };
    this._clock = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    let ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    this.master = ctx.createGain();
    this.master.gain.value = 0.95;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    return ctx;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.volumes.music * 0.5;
    this.sfxBus.gain.value = this.volumes.sfx * 1.0;
  }

  /** 반드시 사용자 터치 이벤트 안에서 호출 (iOS/인앱 브라우저 정책) */
  async unlock() {
    const ctx = this.ensure();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS 무음 스위치 우회 (Safari 17+)
    } catch {}
    if (!this._unlocked) {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      this._unlocked = true;
      // 구형 iOS: 무음 <audio> 를 틀어 두면 무음 스위치에서도 Web Audio 가 들림
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.audioSession) {
        try {
          const el = document.createElement('audio');
          el.setAttribute('playsinline', '');
          el.loop = true;
          el.src = makeSilentWavUrl();
          el.play().catch(() => {});
          this._silentEl = el;
        } catch {}
      }
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {}
    }
    return ctx.state === 'running';
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  resetClock() {
    this._clock = null;
  }

  /** 지금 귀에 들리는 소리의 AudioContext 시각. perfMs 를 주면 그 순간(터치 시각) 기준. */
  heardTime(perfMs = performance.now()) {
    const ctx = this.ctx;
    if (!ctx) return 0;
    if (ctx.state === 'running' && ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        const sample = ts.contextTime - ts.performanceTime / 1000;
        if (this._clock === null || Math.abs(sample - this._clock) > 0.04) this._clock = sample;
        else this._clock += (sample - this._clock) * 0.04;
        return Math.min(perfMs / 1000 + this._clock, ctx.currentTime);
      }
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  // ---------- 악기 ----------
  _noise(t, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.connect(dest);
    s.start(t, Math.random() * 0.5, dur + 0.05);
    return s;
  }

  kick(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.45);
    // 비터 클릭
    const cg = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3500;
    cg.gain.setValueAtTime(0.35 * vel, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    f.connect(cg).connect(dest);
    this._noise(t, 0.03, f);
  }

  snare(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    hp.connect(ng).connect(dest);
    this._noise(t, 0.22, hp);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.003);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(dest);
    o.start(t);
    o.stop(t + 0.14);
  }

  hat(t, vel = 0.5, open = false, dest = this.musicBus) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const g = ctx.createGain();
    const d = open ? 0.22 : 0.045;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    hp.connect(g).connect(dest);
    this._noise(t, d, hp);
  }

  crash(t, dest = this.musicBus) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    hp.connect(g).connect(dest);
    this._noise(t, 0.95, hp);
  }

  click(t, accent = false, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.45, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.08);
  }

  bass(t, midi, dur, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(220, t + Math.min(dur, 0.25));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
    g.gain.setValueAtTime(0.55, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pluck(t, midis, dur, dest = this.musicBus) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g).connect(dest);
    for (const m of midis) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  lead(t, midi, dur, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = mtof(midi);
    f.type = 'lowpass';
    f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
    g.gain.setValueAtTime(0.09, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

// ---------- 반주 생성 ----------
const DEGREES = { I: [0, 'M'], ii: [2, 'm'], iii: [4, 'm'], IV: [5, 'M'], V: [7, 'M'], vi: [9, 'm'] };
const PENTA = [0, 2, 4, 7, 9];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chordNotes(root, deg) {
  const [off, q] = DEGREES[deg] || DEGREES.I;
  const r = root + off;
  return { root: r, triad: [r, r + (q === 'M' ? 4 : 3), r + 7] };
}

/** 4마디 멜로디 모티브를 레벨마다 고정 시드로 생성 (매번 같은 곡) */
function buildLead(level) {
  const rng = mulberry32(level.id * 7919 + 13);
  const root = level.song.root;
  const pool = [];
  for (let o = 12; o <= 24; o += 12) for (const p of PENTA) pool.push(root + o + p);
  let idx = 3;
  const motif = [];
  for (let bar = 0; bar < 4; bar++) {
    const ch = chordNotes(root, level.song.prog[bar % level.song.prog.length]);
    const pat = level.song.lead;
    const hits = [];
    for (let s = 0; s < 16; s++) if (pat[s] === 'x') hits.push(s);
    hits.forEach((s, i) => {
      if (s % 4 === 0) {
        // 강박: 화음 구성음에 가장 가까운 음
        let best = idx;
        let bd = 99;
        pool.forEach((m, j) => {
          const pc = (m - root + 120) % 12;
          const isChord = ch.triad.some((c) => (c - root + 120) % 12 === pc);
          const d = Math.abs(j - idx) + (isChord ? 0 : 3);
          if (d < bd) {
            bd = d;
            best = j;
          }
        });
        idx = best;
      } else {
        idx = Math.max(0, Math.min(pool.length - 1, idx + Math.round((rng() - 0.5) * 3)));
      }
      const next = hits[i + 1] ?? 16;
      motif.push({ bar, step: s, midi: pool[idx], len: Math.min(next - s, 4) });
    });
  }
  return motif;
}

/**
 * 한 판의 반주 재생기. lookahead 스케줄러로 AudioContext 시각에 정확히 예약.
 * startTime = 카운트인 첫 박의 AudioContext 시각.
 */
export class SongPlayer {
  constructor(audio, level, startTime, { autoChart = false } = {}) {
    this.audio = audio;
    this.level = level;
    this.startTime = startTime;
    this.autoChart = autoChart;
    this.sd = stepDur(level);
    this.totalSteps = (COUNT_IN_BARS + level.bars.length + OUTRO_BARS) * STEPS_PER_BAR;
    this.step = 0;
    this.lead = buildLead(level);
    const ctx = audio.ctx;
    this.bus = ctx.createGain();
    this.bus.connect(audio.musicBus);
    this.drumBus = ctx.createGain();
    this.drumBus.connect(audio.sfxBus);
  }

  start() {
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  tick() {
    const horizon = this.audio.ctx.currentTime + 0.2;
    while (this.step < this.totalSteps) {
      const t = this.startTime + this.step * this.sd;
      if (t > horizon) break;
      if (t >= this.audio.ctx.currentTime - 0.01) this.scheduleStep(this.step, t);
      this.step++;
    }
    if (this.step >= this.totalSteps) clearInterval(this.timer);
  }

  scheduleStep(i, t) {
    const a = this.audio;
    const bar = Math.floor(i / STEPS_PER_BAR);
    const s = i % STEPS_PER_BAR;
    const song = this.level.song;
    const sd = this.sd;
    if (bar < COUNT_IN_BARS) {
      if (s % 4 === 0) a.click(t, s === 0, this.bus);
      return;
    }
    const mb = bar - COUNT_IN_BARS; // 본편 마디 번호
    const chartBars = this.level.bars.length;
    const ch = chordNotes(song.root, song.prog[mb % song.prog.length]);

    if (mb >= chartBars) {
      // 아웃트로: 마지막 화음 한 방
      if (s === 0) {
        a.crash(t, this.bus);
        a.bass(t, ch.root - 24, this.sd * 12, this.bus);
        a.pluck(t, ch.triad.map((m) => m), this.sd * 14, this.bus);
      }
      return;
    }

    // 하이햇
    const hc = song.hat[s];
    if (hc === 'x' || hc === 'o') a.hat(t, s % 4 === 0 ? 0.6 : 0.35, hc === 'o', this.bus);
    // 베이스
    const bc = song.bass[s];
    if (bc && bc !== '.') {
      const m = ch.root - 24 + (bc === 'o' ? 12 : bc === '5' ? 7 : 0);
      a.bass(t, m, sd * 1.8, this.bus);
    }
    // 화음
    if (song.chord[s] === 'x' && mb >= 1) a.pluck(t, ch.triad, sd * 3, this.bus);
    // 멜로디 (처음 2마디는 쉬고 들어옴)
    if (mb >= 2) {
      const mbar = mb % 4;
      for (const n of this.lead) if (n.bar === mbar && n.step === s) a.lead(t, n.midi, n.len * sd * 0.95, this.bus);
    }
    // 8마디마다 크래시
    if (s === 0 && mb > 0 && mb % 8 === 0) a.crash(t, this.bus);
    // 자동 연주(데모/릴스 녹화용)
    if (this.autoChart) {
      const c = this.level.bars[mb][s];
      if (c === 'K' || c === 'B') a.kick(t, 1, this.drumBus);
      if (c === 'S' || c === 'B') a.snare(t, 1, this.drumBus);
    }
  }

  stop(fade = 0.15) {
    clearInterval(this.timer);
    const ctx = this.audio.ctx;
    const now = ctx.currentTime;
    for (const b of [this.bus, this.drumBus]) {
      try {
        b.gain.cancelScheduledValues(now);
        b.gain.setValueAtTime(b.gain.value, now);
        b.gain.linearRampToValueAtTime(0, now + fade);
      } catch {}
    }
    setTimeout(() => {
      try {
        this.bus.disconnect();
        this.drumBus.disconnect();
      } catch {}
    }, fade * 1000 + 300);
  }
}

/** 싱크 보정용 메트로놈: count 번 클릭, 각 클릭의 AudioContext 시각 배열 반환 */
export function playMetronome(audio, bpm = 100, count = 12) {
  const ctx = audio.ctx;
  const t0 = ctx.currentTime + 0.4;
  const beat = 60 / bpm;
  const times = [];
  for (let i = 0; i < count; i++) {
    const t = t0 + i * beat;
    audio.click(t, i % 4 === 0, audio.sfxBus);
    times.push(t);
  }
  return times;
}
