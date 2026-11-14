// 오디오 엔진: 음원 파일 없이 Web Audio 로 드럼/반주를 합성합니다.
// - 모든 박자 판정은 AudioContext 시계 기준 (setTimeout 보다 훨씬 정확)
// - heardTime(): "지금 스피커에서 나오고 있는 소리"의 시각. 출력 지연까지 반영.

import { STEPS_PER_BAR, COUNT_IN_BARS, OUTRO_BARS, stepDur, parseMelody, chordAt, levelLanes, CHAR_LANES, KICK, SNARE, HAT, CRASH } from './charts.js';

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
    this.out = comp;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    // 작은 방 울림(리버브): 드럼이 '방 안에서' 울리는 느낌
    try {
      const len = Math.floor(ctx.sampleRate * 1.1);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const verb = ctx.createConvolver();
      verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      verb.connect(wet).connect(this.master);
      const sendS = ctx.createGain();
      sendS.gain.value = 0.55;
      this.sfxBus.connect(sendS).connect(verb);
      const sendM = ctx.createGain();
      sendM.gain.value = 0.6;
      this.musicBus.connect(sendM).connect(verb);
    } catch {}
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

  /** 킥: 서브(낮은 둥) + 펀치 + 비터 클릭 */
  kick(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1 * vel, t + 0.003);
    g.gain.setValueAtTime(1.0 * vel, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.52);
    if (!this._sat) {
      this._sat = ctx.createWaveShaper();
      const c = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) c[i] = Math.tanh((i / 512 - 1) * 2.2);
      this._sat.curve = c;
      this._sat.connect(this.sfxBus);
    }
    const p = ctx.createOscillator();
    const pg = ctx.createGain();
    p.type = 'triangle';
    p.frequency.setValueAtTime(260, t);
    p.frequency.exponentialRampToValueAtTime(90, t + 0.04);
    pg.gain.setValueAtTime(0.5 * vel, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    p.connect(pg).connect(dest === this.sfxBus ? this._sat : dest);
    p.start(t);
    p.stop(t + 0.07);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.45 * vel, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    f.connect(cg).connect(dest);
    this._noise(t, 0.03, f);
  }

  /** 스네어: 통 울림(두 톤) + 스냅(밝은 노이즈) + 스네어 줄 떨림 */
  snare(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    for (const [fr, amp] of [[185, 0.5], [330, 0.28]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(fr * 1.25, t);
      o.frequency.exponentialRampToValueAtTime(fr, t + 0.03);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp * vel, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + 0.15);
    }
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    bp.connect(ng).connect(dest);
    this._noise(t, 0.14, bp);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.005);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    hp.connect(rg).connect(dest);
    this._noise(t, 0.28, hp);
  }

  /** 하이햇 (밴드가 쳐줌. 금속성 고음) */
  hat(t, vel = 0.5, open = false, dest = this.musicBus) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 10000;
    pk.gain.value = 6;
    const g = ctx.createGain();
    const d = open ? 0.3 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    hp.connect(pk).connect(g).connect(dest);
    this._noise(t, d + 0.02, hp);
  }

  /** 크래시 심벌 */
  crash(t = this.ctx.currentTime, dest = this.musicBus, vol = 0.5) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    hp.connect(g).connect(dest);
    this._noise(t, 0.9, hp);
    this._noise(t + 0.85, 0.8, hp);
  }

  /** 플레이어가 누른 악기 소리 (t 를 주면 그 시각에 예약) */
  playLane(lane, t = this.ctx.currentTime, dest = this.sfxBus) {
    if (lane === KICK) this.kick(t, 1, dest);
    else if (lane === SNARE) this.snare(t, 1, dest);
    else if (lane === HAT) this.hat(t, 1.6, false, dest);
    else if (lane === CRASH) this.crash(t, dest, 0.42);
  }

  /** 녹화용 오디오 스트림 (게임 소리 전체) */
  captureStream() {
    const ctx = this.ensure();
    if (!this._streamDest) {
      this._streamDest = ctx.createMediaStreamDestination();
      this.out.connect(this._streamDest);
    }
    return this._streamDest.stream;
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

  /** 둥글고 부드러운 베이스 (킥처럼 '쿵' 하고 들리지 않게 어택을 느리게) */
  bass(t, midi, dur, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = mtof(midi + 12);
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.03);
    g.gain.setValueAtTime(0.3, t + dur * 0.6);
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

  /** 멜로디: 건반 느낌(때리면 밝고 금방 잦아드는 소리)으로 곡이 또렷하게 들리게 */
  lead(t, midi, dur, dest = this.musicBus) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(4200, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + Math.min(0.6, dur + 0.1));
    const g = ctx.createGain();
    const end = t + Math.max(0.08, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.18);
    g.gain.setTargetAtTime(0.05, t + 0.18, 0.4);
    g.gain.setValueAtTime(0.05, end - 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, end + 0.08);
    f.connect(g).connect(dest);
    for (const [type, mult, amp] of [['triangle', 1, 1], ['square', 1, 0.28], ['sine', 2, 0.22]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = mtof(midi) * mult;
      og.gain.value = amp;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(end + 0.1);
    }
  }
}

// ---------- 반주 ----------
// 곡 데이터(멜로디·코드)는 charts.js 의 level.song 에 있습니다.

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
    this.melody = parseMelody(level.song.melody || []);
    this.melodyBars = (level.song.melody || []).length;
    const lanes = levelLanes(level);
    this.mineCrash = lanes.includes(CRASH); // 크래시를 내가 치면 반주 크래시는 쉼
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
    const ch = chordAt(song, mb, s);

    if (mb >= chartBars) {
      // 아웃트로: 곡의 으뜸화음 한 방
      if (s === 0) {
        const home = chordAt(song, 0, 0);
        a.crash(t, this.bus);
        a.bass(t, home.root - 24, this.sd * 12, this.bus);
        a.pluck(t, home.notes, this.sd * 14, this.bus);
        const last = this.melody.filter((n) => n.bar === 0)[0];
        if (last) a.lead(t, home.root + 12 * Math.round((last.midi - home.root) / 12), this.sd * 10, this.bus);
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
    if (song.chord[s] === 'x') a.pluck(t, ch.notes, sd * 3, this.bus);
    // 멜로디 (클래식 곡 주제 선율)
    if (this.melodyBars) {
      const mbar = mb % this.melodyBars;
      for (const n of this.melody) if (n.bar === mbar && n.step === s) a.lead(t, n.midi, n.len * sd * 0.92, this.bus);
    }
    // 8마디마다 크래시
    if (s === 0 && mb > 0 && mb % 8 === 0 && !this.mineCrash) a.crash(t, this.bus);
    // 자동 연주(데모/릴스 녹화용)
    if (this.autoChart) {
      for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
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
