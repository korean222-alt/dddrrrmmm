// 오디오 엔진: 드럼은 Web Audio 합성, 곡(멜로디·화음·베이스)은 진짜 악기 샘플로 연주합니다.
//   피아노 샘플: Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) — public/audio/piano/
//   오케스트라 샘플: VS Chamber Orchestra Community Edition (Versilian Studios, CC0) — public/audio/orch/
//     바이올린·첼로 합주, 호른·트롬본, 튜바, 팀파니. 피아노는 박자가 또렷하게 들리게 같이 침
//   샘플을 못 불러오면 예전 합성음으로 대신 연주합니다.
// - 모든 박자 판정은 AudioContext 시계 기준 (setTimeout 보다 훨씬 정확)
// - heardTime(): "지금 스피커에서 나오고 있는 소리"의 시각. 출력 지연까지 반영.

import { STEPS_PER_BAR, COUNT_IN_BARS, OUTRO_BARS, tempoOf, parseMelody, chordAt, levelLanes, CHAR_LANES, KICK, SNARE, HAT, CRASH, TOM } from './charts.js';

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

// 피아노 샘플: C · D# · F# · A (단3도 간격) → 가장 가까운 샘플을 최대 ±1.5음 올리고 내려서 씀
const PIANO_BASE = 'audio/piano.bin';
const PIANO_NOTES = [];
for (let o = 2; o <= 6; o++) for (const [n, pc] of [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]]) PIANO_NOTES.push({ file: `${n}${o}.mp3`, midi: 12 * (o + 1) + pc });
PIANO_NOTES.push({ file: 'C7.mp3', midi: 96 });
const PIANO_GAIN = 1.9; // 샘플이 합성음보다 작게 녹음돼 있어서 키움 (곡이 드럼에 묻히지 않게)

// 오케스트라 샘플 (파일 이름 = 악기_미디번호.mp3). 소리 크기는 파일마다 맞춰 둠
const ORCH_BASE = 'audio/orch.bin';

/** 묶음 파일(scripts/pack-audio.js) 하나를 받아 files 순서대로 ArrayBuffer 배열로 (없으면 null) */
async function fetchPack(url, files) {
  try {
    const r = await fetch(url);
    if (!r.ok) return files.map(() => null);
    const all = await r.arrayBuffer();
    const hl = new DataView(all).getUint32(0);
    const index = JSON.parse(new TextDecoder().decode(new Uint8Array(all, 4, hl)));
    const base = 4 + hl;
    return files.map((n) => {
      const e = index[n.file];
      return e ? all.slice(base + e[0], base + e[0] + e[1]) : null;
    });
  } catch {
    return files.map(() => null);
  }
}
const ORCH = {
  vln: [55, 57, 59, 62, 66, 69, 72, 76, 79, 83, 86],
  vc: [36, 40, 43, 47, 50, 53, 57, 60, 64],
  br: [43, 46, 50, 53, 57, 60, 61, 63, 65, 74, 77],
  tuba: [34, 39, 41, 46, 50],
  timp: [37, 42],
};
const ORCH_FILES = Object.entries(ORCH).flatMap(([k, list]) => list.map((midi) => ({ set: k, midi, file: `${k}_${midi}.mp3` })));
const ORCH_GAIN = { vln: 0.62, vc: 0.62, br: 0.55, tuba: 0.6, timp: 0.9 };

/** 샘플 앞의 무음 길이(초): 음이 실제로 시작하는 지점부터 틀어야 박자가 정확함 */
function onsetOf(buf) {
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(buf.sampleRate * 0.2));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.05;
  for (let i = 0; i < n; i++) if (Math.abs(d[i]) > th) return Math.max(0, i / buf.sampleRate - 0.002);
  return 0;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 0.8, sfx: 1 };
    this._clock = null;
    this.piano = null; // [{ midi, buf, offset }] 불러오면 채워짐
    this._pianoRaw = null;
    this._pianoLoading = null;
    this.orch = null; // { vln: [{ midi, buf, offset }], ... }
    this._orchRaw = null;
    this._orchLoading = null;
    /** 반주를 오케스트라로 (false 면 피아노만) */
    this.orchOn = true;
  }

  /** 오케스트라 샘플 미리 받기 (피아노 다음에) */
  prefetchOrch(base = ORCH_BASE) {
    if (this._orchRaw) return this._orchRaw;
    this._orchRaw = fetchPack(base, ORCH_FILES);
    return this._orchRaw;
  }

  /** 오케스트라 샘플 디코딩. 실패하면 false (피아노만으로 연주) */
  loadOrch() {
    if (this.orch) return Promise.resolve(true);
    if (this._orchLoading) return this._orchLoading;
    const ctx = this.ensure();
    this._orchLoading = this.prefetchOrch().then(async (raws) => {
      const out = {};
      for (const k of Object.keys(ORCH)) out[k] = [];
      let ok = 0;
      for (let i = 0; i < raws.length; i++) {
        const ab = raws[i];
        if (!ab) continue;
        try {
          const buf = await new Promise((res, rej) => {
            const p = ctx.decodeAudioData(ab.slice(0), res, rej);
            if (p && p.then) p.then(res, rej);
          });
          out[ORCH_FILES[i].set].push({ midi: ORCH_FILES[i].midi, buf, offset: onsetOf(buf) });
          ok++;
        } catch {}
      }
      if (ok < ORCH_FILES.length * 0.8 || Object.values(out).some((l) => !l.length)) {
        this._orchLoading = null;
        return false;
      }
      for (const l of Object.values(out)) l.sort((a, b) => a.midi - b.midi);
      this.orch = out;
      return true;
    });
    return this._orchLoading;
  }

  /** 지금 오케스트라로 칠 수 있나 */
  get orchestra() {
    return this.orchOn && !!this.orch;
  }

  /**
   * 오케스트라 악기 한 음. set = 'vln' | 'vc' | 'br' | 'tuba' | 'timp'
   * attack 초 동안 서서히 커지고, dur 뒤 release 로 잦아듦
   */
  orchNote(set, t, midi, dur, vel = 0.6, dest = this.musicBus, attack = 0.015, release = 0.18) {
    const list = this.orch && this.orch[set];
    if (!list || !list.length) return;
    const ctx = this.ctx;
    let s = list[0];
    for (const p of list) if (Math.abs(p.midi - midi) < Math.abs(s.midi - midi)) s = p;
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    const v = vel * ORCH_GAIN[set];
    const t0 = Math.max(t, ctx.currentTime);
    const end = t0 + Math.max(0.06, dur);
    if (attack > 0.002) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + attack);
    } else g.gain.setValueAtTime(v, t0);
    g.gain.setValueAtTime(v, Math.max(end, t0 + attack));
    g.gain.setTargetAtTime(0, Math.max(end, t0 + attack), release);
    src.connect(g).connect(dest);
    src.start(t0, s.offset);
    src.stop(Math.min(end + release * 6, t0 + s.buf.duration / src.playbackRate.value));
  }

  /** 피아노 샘플 파일 미리 받기 (AudioContext 없이도 가능 → 페이지 열자마자 호출) */
  prefetchPiano(base = PIANO_BASE) {
    if (this._pianoRaw) return this._pianoRaw;
    this._pianoRaw = fetchPack(base, PIANO_NOTES);
    return this._pianoRaw;
  }

  /** 피아노 샘플 디코딩. 실패해도 에러 없이 false (합성음으로 대신 연주) */
  loadPiano() {
    if (this.piano) return Promise.resolve(true);
    if (this._pianoLoading) return this._pianoLoading;
    const ctx = this.ensure();
    this._pianoLoading = this.prefetchPiano().then(async (raws) => {
      const out = [];
      await Promise.all(
        raws.map(async (ab, i) => {
          if (!ab) return;
          try {
            const buf = await new Promise((res, rej) => {
              const p = ctx.decodeAudioData(ab, res, rej);
              if (p && p.then) p.then(res, rej);
            });
            out.push({ midi: PIANO_NOTES[i].midi, buf, offset: onsetOf(buf) });
          } catch {}
        })
      );
      if (out.length < PIANO_NOTES.length * 0.8) {
        this._pianoLoading = null;
        return false;
      }
      out.sort((a, b) => a.midi - b.midi);
      this.piano = out;
      return true;
    });
    return this._pianoLoading;
  }

  /** 🎤 녹음된 곡(노래 파일) 받아서 풀어 둠. 실패하면 null. 한 번 받으면 다시 안 받음 (새 소리 엔진에서도 그대로 씀) */
  loadTrack(src) {
    this._tracks ??= new Map();
    this._trackBufs ??= new Map();
    if (this._tracks.has(src)) return this._tracks.get(src);
    const ctx = this.ensure();
    const p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then(
        (ab) =>
          new Promise((res, rej) => {
            const q = ctx.decodeAudioData(ab, res, rej);
            if (q && q.then) q.then(res, rej);
          })
      )
      .then((buf) => {
        this._trackBufs.set(src, buf);
        return buf;
      })
      .catch(() => {
        this._tracks.delete(src);
        return null;
      });
    this._tracks.set(src, p);
    return p;
  }

  /** 받아 둔 곡 (없으면 null) */
  trackBuffer(src) {
    return (this._trackBufs && this._trackBufs.get(src)) || null;
  }

  /** 피아노 한 음. vel 0~1, dur 초 뒤에 건반을 뗌(댐퍼) */
  pianoNote(t, midi, dur, vel = 0.8, dest = this.musicBus) {
    const ctx = this.ctx;
    let s = this.piano[0];
    for (const p of this.piano) if (Math.abs(p.midi - midi) < Math.abs(s.midi - midi)) s = p;
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    const rel = t + Math.max(0.08, dur);
    const v = vel * PIANO_GAIN;
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, rel);
    g.gain.setTargetAtTime(0, rel, 0.08);
    src.connect(g).connect(dest);
    src.start(Math.max(t, ctx.currentTime), s.offset);
    src.stop(rel + 0.6);
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

  /**
   * 소리 엔진을 통째로 새로 만듦. 반드시 터치 이벤트 안에서.
   *   아이폰에서 다른 앱(음악·영상·화면 녹화 등)이 소리를 가져갔다 돌려주면 옛 AudioContext 가
   *   resume() 해도 다시 안 켜지거나 'running' 인데 시계가 멈춘 채로 남는 일이 있음 → 새 엔진이면 바로 켜짐.
   *   받아 둔 피아노·오케스트라 소리(AudioBuffer)는 새 엔진에서도 그대로 씀
   */
  rebuild() {
    const old = this.ctx;
    this.ctx = null;
    this._streamDest = null;
    this._clock = null;
    this.frozen = false;
    try {
      if (old) old.close().catch(() => {});
    } catch {}
    const ctx = this.ensure();
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {}
    this._unlocked = true;
    ctx.resume().catch(() => {});
    if (this._silentEl) this._silentEl.play().catch(() => {});
    this.rebuiltAt = performance.now();
    return ctx;
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

  /** 탐탐 (플로어 탐): 낮게 '둥' — 음이 살짝 내려가는 통 울림 + 가죽 치는 소리 */
  tom(t = this.ctx.currentTime, vel = 1, dest = this.sfxBus) {
    const ctx = this.ctx;
    for (const [fr, amp, dec] of [[130, 0.75, 0.42], [205, 0.22, 0.2]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(fr * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(fr, t + 0.06);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp * vel, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.001, t + dec);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + dec + 0.02);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.35 * vel, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    lp.connect(ng).connect(dest);
    this._noise(t, 0.06, lp);
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

  /** 🔔 썰매 방울 (캐롤): 높은 쇳소리 '찰랑' 두세 겹 */
  sleigh(t, vel = 0.5, dest = this.musicBus) {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    bp.connect(g).connect(dest);
    // 방울 여러 개가 아주 조금씩 늦게 부딪힘
    for (const dt of [0, 0.012, 0.027]) this._noise(t + dt, 0.05, bp);
    for (const [f, a] of [[5200, 0.05], [6900, 0.035]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(a * vel, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + 0.14);
    }
  }

  /** 🔔 글로켄슈필 (캐롤 멜로디를 한 옥타브 위에서 반짝이게) */
  glock(t, midi, dest = this.musicBus, vel = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.06 * vel;
    g.connect(dest);
    for (const [mult, amp, d] of [[1, 1, 1.1], [2.76, 0.25, 0.35], [5.4, 0.12, 0.15]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = mtof(midi) * mult;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(amp, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + d + 0.02);
    }
  }

  /** 🎤 합창 '아~' (캐롤을 같이 부르는 목소리): 톱니파 세 겹(살짝 어긋나게) → 목소리 공명(포먼트) → 비브라토.
   *  아래 한 옥타브는 남자 목소리 '오~' 로 작게 받쳐 줌 */
  choir(t, midi, dur, dest = this.musicBus, vel = 1) {
    const ctx = this.ctx;
    const end = t + Math.max(0.14, dur);
    const g = ctx.createGain();
    const peak = 0.4 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.045);
    g.gain.setValueAtTime(peak, Math.max(t + 0.05, end - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, end + 0.12);
    g.connect(dest);
    // 비브라토: 처음엔 곧게, 0.25초쯤부터 살짝 떨림
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.4;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(14, t + 0.3);
    lfo.connect(lg);
    lfo.start(t);
    lfo.stop(end + 0.15);
    const voice = (m, formants, amp, detunes) => {
      const vg = ctx.createGain();
      vg.gain.value = amp;
      vg.connect(g);
      const bps = formants.map(([f, q, a]) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const ag = ctx.createGain();
        ag.gain.value = a;
        bp.connect(ag).connect(vg);
        return bp;
      });
      for (const d of detunes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = d;
        lg.connect(o.detune);
        for (const bp of bps) o.connect(bp);
        o.start(t);
        o.stop(end + 0.15);
      }
    };
    voice(midi, [[800, 5, 1], [1150, 7, 0.55], [2900, 9, 0.22]], 1, [-9, 0, 8]); // 여자 '아'
    voice(midi - 12, [[450, 5, 1], [800, 7, 0.4], [2830, 9, 0.12]], 0.45, [-6, 5]); // 남자 '오'
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
    else if (lane === TOM) this.tom(t, 1, dest);
  }

  /** 결과 화면 별 하나 '띵!' (i = 0,1,2 갈수록 높아짐) */
  starChime(t = this.ctx.currentTime, i = 0) {
    const ctx = this.ctx;
    const base = [1046.5, 1318.5, 1568][Math.min(2, i)];
    const out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(this.sfxBus);
    for (const [mult, amp, decay] of [[1, 0.5, 0.9], [2, 0.18, 0.5], [3.01, 0.1, 0.3], [4.2, 0.06, 0.18]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * mult * 0.985, t);
      o.frequency.exponentialRampToValueAtTime(base * mult, t + 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    // 반짝이 (짧고 밝은 노이즈)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.12, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    hp.connect(ng).connect(out);
    this._noise(t, 0.27, hp);
  }

  /** 점수 올라가는 '따라라라' 한 알. p = 0~1 (갈수록 높아짐) */
  tick(t, p = 0) {
    const ctx = this.ctx;
    if (!this._tickBus) {
      this._tickBus = ctx.createGain();
      this._tickBus.connect(this.sfxBus);
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 700 * Math.pow(2, p * 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    o.connect(g).connect(this._tickBus);
    o.start(t);
    o.stop(t + 0.06);
  }

  /** 예약해 둔 '따라라라'를 바로 멈춤 (결과 연출 건너뛸 때) */
  silenceTicks() {
    if (!this._tickBus) return;
    try {
      this._tickBus.disconnect();
    } catch {}
    this._tickBus = null;
  }

  /** 점수 다 오르면 '딴!' (드럼 + 밝은 화음) */
  land(t = this.ctx.currentTime) {
    this.kick(t, 0.7);
    this.snare(t, 0.5);
    for (const m of [72, 79, 84]) {
      if (this.piano) this.pianoNote(t, m, 0.5, 0.5, this.sfxBus);
      else this.lead(t, m, 0.3, this.sfxBus);
    }
  }

  /** 별 3개 다 모으면 '짜잔' 화음 */
  fanfare(t = this.ctx.currentTime) {
    const notes = [72, 76, 79, 84];
    if (this.orchestra) {
      for (const m of [48, 55, 60, 64]) this.orchNote('br', t + 0.02, m, 1.1, 0.7, this.sfxBus, 0.03, 0.4);
      for (const m of [72, 76, 79]) this.orchNote('vln', t + 0.02, m, 1.2, 0.6, this.sfxBus, 0.03, 0.4);
      this.orchNote('timp', t, 36, 1.5, 0.9, this.sfxBus, 0, 0.5);
    }
    if (this.piano) {
      notes.forEach((m, k) => this.pianoNote(t + k * 0.06, m, 1.2, 0.7, this.sfxBus));
      return;
    }
    notes.forEach((m, k) => this.lead(t + k * 0.06, m, 1, this.sfxBus));
  }

  /** 별 0개 / 대결 패배: '띠로리' */
  aww(t = this.ctx.currentTime) {
    [[67, 0], [63, 0.22], [60, 0.44]].forEach(([m, d]) => {
      if (this.piano) this.pianoNote(t + d, m, 0.3, 0.55, this.sfxBus);
      else this.lead(t + d, m, 0.25, this.sfxBus);
    });
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

  /** 피아노로 lead/bass 를 vel 배율로 (오케스트라와 섞을 때 피아노는 조금 작게) */
  pianoOr(kind, t, midi, dur, dest, scale = 1) {
    if (!this.piano) return kind === 'bass' ? this.bass(t, midi, dur, dest) : this.lead(t, midi, dur, dest);
    if (kind === 'bass') return this.pianoNote(t, midi + 12, dur, 0.62 * scale, dest);
    return this.pianoNote(t, midi, dur, scale, dest);
  }

  /** 둥글고 부드러운 베이스 (킥처럼 '쿵' 하고 들리지 않게 어택을 느리게) */
  bass(t, midi, dur, dest = this.musicBus) {
    if (this.piano) return this.pianoNote(t, midi + 12, dur, 0.62, dest);
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

  pluck(t, midis, dur, dest = this.musicBus, scale = 1) {
    if (this.piano) {
      for (const m of midis) this.pianoNote(t, m, dur, 0.3 * scale, dest);
      return;
    }
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
    if (this.piano) return this.pianoNote(t, midi, dur, 1, dest);
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
 * 빠르기는 박자 시계(tempoOf)를 따름 → 무제한 모드처럼 단계마다 빨라져도 그대로 맞음.
 *
 * 오케스트라 편곡 (샘플을 받았고 설정이 '오케스트라'일 때):
 *   멜로디 = 피아노(박자 또렷하게) + 바이올린 합주
 *   화음   = 현악 패드(바이올린 + 첼로) / 곡이 달아오르면 호른·트롬본
 *   베이스 = 피아노 + 첼로, 절정에서 튜바
 *   팀파니 = 마디 첫 박 + 크래시 직전 롤
 *   곡 앞부분은 가볍게, 뒤로 갈수록(무제한 모드는 단계가 오를수록) 악기가 늘며 웅장해짐
 */
export class SongPlayer {
  constructor(audio, level, startTime, { autoChart = false } = {}) {
    this.audio = audio;
    this.level = level;
    this.startTime = startTime;
    this.autoChart = autoChart;
    this.tempo = tempoOf(level);
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
    // 🎤 녹음된 곡: 반주를 만들지 않고 파일을 박자에 맞춰 틂 (song.audio.offset = 채보 첫 마디가 시작하는 파일 시각)
    this.track = level.song.audio ? audio.trackBuffer(level.song.audio.src) : null;
  }

  get totalSteps() {
    if (this.level.endless) return Infinity;
    return (COUNT_IN_BARS + this.level.bars.length + OUTRO_BARS) * STEPS_PER_BAR;
  }

  start() {
    if (this.track) this._startTrack();
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  /** 녹음된 곡 틀기. 이미 지난 시각이면(이어 가기·소리 엔진 새로 만듦) 그 자리부터 */
  _startTrack() {
    const ctx = this.audio.ctx;
    const info = this.level.song.audio;
    const t0 = this.startTime + this.tempo.barStart(COUNT_IN_BARS) - (info.offset || 0);
    const now = ctx.currentTime + 0.03;
    const src = ctx.createBufferSource();
    src.buffer = this.track;
    const g = ctx.createGain();
    g.gain.value = info.gain ?? 1;
    src.connect(g).connect(this.bus);
    if (t0 >= now) src.start(t0);
    else if (now - t0 < this.track.duration) src.start(now, now - t0);
    else return;
    this.trackSrc = src;
  }

  tick() {
    const horizon = this.audio.ctx.currentTime + 0.2;
    while (this.step < this.totalSteps) {
      const t = this.startTime + this.tempo.stepTime(this.step);
      if (t > horizon) break;
      if (t >= this.audio.ctx.currentTime - 0.01) this.scheduleStep(this.step, t);
      this.step++;
    }
    if (this.step >= this.totalSteps) clearInterval(this.timer);
  }

  /** 곡이 얼마나 달아올랐나 0.35 ~ 1 (악기 수가 늘어남) */
  intensity(mb) {
    const lv = this.level;
    if (lv.challenge) return Math.min(1, 0.35 + 0.15 * (lv.roundOfBar(mb) - 1));
    // epic 곡(15단계)은 처음부터 금관·팀파니·튜바가 총출동 (첫 두 마디만 살짝 낮춰 '빠바바밤' 을 또렷하게)
    if (lv.song.epic) return mb < 2 ? 0.65 : 1;
    const n = lv.bars.length;
    return mb < 4 ? 0.35 : mb < n / 2 ? 0.65 : 1;
  }

  scheduleStep(i, t) {
    const a = this.audio;
    const bar = Math.floor(i / STEPS_PER_BAR);
    const s = i % STEPS_PER_BAR;
    const song = this.level.song;
    const sd = this.tempo.barLen(bar) / STEPS_PER_BAR;
    const orch = a.orchestra;
    if (bar < COUNT_IN_BARS) {
      if (s % 4 === 0) a.click(t, s === 0, this.bus);
      return;
    }
    const mb = bar - COUNT_IN_BARS; // 본편 마디 번호
    if (mb >= this.level.bars.length && this.level.ensureBars) this.level.ensureBars(mb + 1);
    const chartBars = this.level.bars.length;
    // 🎵 릴스 박자 맞추기: 반주 없음 (노래는 인스타에서 입힘). 드럼(+ 고르면 조용한 박자 소리)만
    if (this.level.beat) {
      if (mb >= chartBars) return;
      if (this.level.click && s % 4 === 0) a.click(t, s === 0, this.bus);
      if (this.autoChart) for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
      return;
    }
    if (this.track) {
      // 🎤 녹음된 곡: 반주는 파일이 함 (자동 연주 드럼만)
      if (this.autoChart && mb < chartBars) for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
      return;
    }
    const ch = chordAt(song, mb, s);

    if (mb >= chartBars) {
      // 아웃트로: 곡의 으뜸화음 한 방
      if (s === 0) {
        const home = chordAt(song, 0, 0);
        a.crash(t, this.bus);
        a.bass(t, home.root - 24, sd * 12, this.bus);
        a.pluck(t, home.notes, sd * 14, this.bus);
        const last = this.melody.filter((n) => n.bar === 0)[0];
        if (last) a.lead(t, home.root + 12 * Math.round((last.midi - home.root) / 12), sd * 10, this.bus);
        if (orch) {
          const d = sd * 14;
          for (const m of home.notes) a.orchNote('vln', t, m + 12, d, 0.5, this.bus, 0.01, 0.5);
          for (const m of home.notes) a.orchNote('br', t, m - 12, d, 0.6, this.bus, 0.01, 0.5);
          a.orchNote('vc', t, home.root - 12, d, 0.7, this.bus, 0.01, 0.5);
          a.orchNote('tuba', t, home.root - 24, d, 0.7, this.bus, 0.01, 0.5);
          a.orchNote('timp', t, this._timpPitch(home.root), 2, 0.9, this.bus, 0, 0.6);
        }
      }
      return;
    }

    const heat = this.intensity(mb);
    // 하이햇
    const hc = song.hat[s];
    if (hc === 'x' || hc === 'o') a.hat(t, s % 4 === 0 ? 0.6 : 0.35, hc === 'o', this.bus);
    // 🎄 캐롤: 썰매 방울
    if (song.bells && song.bells[s] === 'x') a.sleigh(t, s % 4 === 0 ? 0.7 : 0.45, this.bus);
    // 베이스 (오케스트라면 첼로가 같이 받쳐줌)
    const bc = song.bass[s];
    if (bc && bc !== '.') {
      const m = ch.root - 24 + (bc === 'o' ? 12 : bc === '5' ? 7 : 0);
      if (orch) {
        a.pianoOr('bass', t, m, sd * 1.8, this.bus, 0.75);
        a.orchNote('vc', t, m + 12, Math.max(sd * 1.8, 0.22), 0.45 + 0.25 * heat, this.bus, 0.01, 0.12);
      } else a.bass(t, m, sd * 1.8, this.bus);
    }
    // 화음
    if (song.chord[s] === 'x') a.pluck(t, ch.notes, sd * 3, this.bus, orch ? 0.6 : 1);
    // 멜로디 (클래식 곡 주제 선율)
    if (this.melodyBars) {
      const mbar = mb % this.melodyBars;
      for (const n of this.melody) {
        if (n.bar !== mbar || n.step !== s) continue;
        const dur = n.len * sd * 0.92;
        // 🎄 캐롤: 글로켄슈필이 한 옥타브 위에서 같이 (긴 음만, 너무 시끄럽지 않게)
        if (song.glock && n.len >= 2) a.glock(t, n.midi + 12, this.bus, 0.6 + 0.4 * heat);
        // 🎤 합창이 멜로디를 같이 부름 (짧은 음은 조금 작게)
        if (song.choir) a.choir(t, n.midi, n.len * sd * 0.95, this.bus, (n.len >= 2 ? 1 : 0.7) * (0.75 + 0.25 * heat));
        if (!orch) {
          a.lead(t, n.midi, dur, this.bus);
          continue;
        }
        a.pianoOr('lead', t, n.midi, dur, this.bus, 0.72);
        // 바이올린 합주: 긴 음은 풍성하게, 16분음표 질주는 살짝만
        if (n.len >= 2) a.orchNote('vln', t, n.midi, n.len * sd, 0.55 + 0.3 * heat, this.bus, 0.03, 0.15);
        else a.orchNote('vln', t, n.midi, sd * 1.4, 0.3 + 0.15 * heat, this.bus, 0.004, 0.06);
        // 절정: 호른이 한 옥타브 아래로 멜로디를 같이 (긴 음만. epic 곡은 8분음표까지)
        const epic = !!song.epic;
        if (heat >= 1 && n.len >= (epic ? 2 : 4) && n.midi - 12 >= 45) a.orchNote('br', t, n.midi - 12, Math.max(n.len * sd, 0.2), epic ? 0.5 : 0.4, this.bus, 0.03, 0.15);
        // epic: 짧은 음마다 팀파니가 같이 '두두두 쿵' 말발굽처럼 받쳐 줌
        if (epic && heat >= 0.65 && n.len <= 2) a.orchNote('timp', t, this._timpPitch(ch.root), 0.6, 0.38, this.bus, 0, 0.3);
      }
    }
    if (orch) this._orchestra(mb, s, t, sd, ch, heat);
    // 8마디마다 크래시
    if (s === 0 && mb > 0 && mb % 8 === 0 && !this.mineCrash) a.crash(t, this.bus);
    // 자동 연주(데모/릴스 녹화용)
    if (this.autoChart) {
      for (const lane of CHAR_LANES[this.level.bars[mb][s]] || []) a.playLane(lane, t, this.drumBus);
    }
  }

  /** 팀파니 음높이: 뿌리음을 C2~B2 근처로 */
  _timpPitch(root) {
    let m = root;
    while (m > 44) m -= 12;
    while (m < 33) m += 12;
    return m;
  }

  /** 현악 패드 · 금관 · 튜바 · 팀파니 */
  _orchestra(mb, s, t, sd, ch, heat) {
    const a = this.audio;
    const song = this.level.song;
    const entry = song.prog[((mb % song.prog.length) + song.prog.length) % song.prog.length];
    const parts = entry.trim().split(/\s+/).length;
    const partLen = STEPS_PER_BAR / parts;
    // 코드가 바뀌는 자리마다 현악 패드
    if (s % partLen === 0) {
      const d = partLen * sd;
      const pv = 0.22 + 0.16 * heat;
      for (const m of ch.notes.slice(0, 3)) a.orchNote('vln', t, m, d, pv, this.bus, Math.min(0.12, d * 0.25), 0.25);
      a.orchNote('vc', t, ch.root - 12, d, pv + 0.1, this.bus, Math.min(0.1, d * 0.2), 0.25);
      // 금관: 달아오르면 코드 첫 자리마다, 그 전엔 4마디마다 한 번
      if (heat >= 1 || (heat >= 0.65 && s === 0 && mb % 4 === 0)) {
        const bv = heat >= 1 ? 0.42 : 0.32;
        for (const m of [ch.root - 12, ch.notes[1] - 12, ch.notes[2] - 12]) a.orchNote('br', t, m, d * 0.95, bv, this.bus, 0.04, 0.2);
      }
    }
    // 튜바: 절정에서 마디 첫 박
    if (heat >= 1 && s === 0) a.orchNote('tuba', t, ch.root - 24, 16 * sd * 0.85, 0.55, this.bus, 0.02, 0.2);
    // 팀파니
    const tp = this._timpPitch(ch.root);
    if (heat >= 0.65 && s === 0) a.orchNote('timp', t, tp, 1.5, heat >= 1 ? 0.75 : 0.5, this.bus, 0, 0.5);
    if (heat >= 1 && s === 8) a.orchNote('timp', t, tp, 1, 0.45, this.bus, 0, 0.4);
    // 크래시 나오기 직전 마디 끝: 팀파니 롤 (두두두두 → 쾅)
    const toCrash = (mb + 1) % 8 === 0 && (this.level.endless || mb + 1 < this.level.bars.length);
    if (heat >= 0.65 && toCrash && s >= 12) a.orchNote('timp', t, tp, 0.5, 0.3 + (s - 12) * 0.12, this.bus, 0, 0.12);
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
    if (this.trackSrc) {
      try {
        this.trackSrc.stop(now + fade + 0.02);
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
