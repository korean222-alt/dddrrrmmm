// 실행: node scripts/melody-bench.mjs  (V=1 곡별, HARD=1.5 더 어렵게, DBG=곡번호 칸별 비교, TR=다른 usermap.js 로 비교)
// 🎤 음 따기 시험장: 게임 멜로디를 '사람 목소리 비슷한 소리'로 부르고 팝 반주를 깔아서 → 음 따기 → 정답과 비교
//   목소리: 성대 배음 + 모음 포먼트, 음 시작 때 아래서 끌어올림(스쿱), 비브라토, 살짝 늦게·살짝 음 이탈, 숨소리
//   반주: 피아노 화음(좌우로 퍼짐), 가운데 패드·베이스·킥·스네어(가운데라서 '가운데만 듣기'로 안 빠짐), 하이햇, 목소리 리버브(좌우 다름)
//   점수: 8분 칸마다 (정답 음이 있는 칸) 같은 음(옥타브 무시 안 함, 전체 옥타브 맞춤 후)이면 정답
import { LEVELS, parseMelody, parseChord, STEPS_PER_BAR } from '../public/js/charts.js';

const SR = 44100;
const mod = await import(process.env.TR || '../public/js/usermap.js');
const { transcribe, cleanMelody } = mod;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const VOWELS = [
  [800, 1200, 2500], // a
  [500, 1900, 2500], // e
  [300, 2200, 2900], // i
  [500, 900, 2400], // o
  [320, 800, 2300], // u
];
function formantGain(f, fm) {
  let g = 0.02;
  for (let i = 0; i < 3; i++) {
    const bw = 80 + 40 * i;
    g += [1, 0.6, 0.25][i] / (1 + ((f - fm[i]) / bw) ** 2);
  }
  return g;
}

function render(level, { bars = 8, seed = 1, hard = 1, voiceOct = 0 } = {}) {
  const r = rng(seed);
  const bpm = level.bpm;
  const st = 60 / bpm / 4;
  const lead = 1.0; // 앞에 1초
  const notes = parseMelody(level.song.melody).filter((n) => n.bar < bars);
  // 멜로디 배열이 마디보다 짧으면 반복
  const melBars = level.song.melody.length;
  const all = [];
  for (let b0 = 0; b0 < bars; b0 += melBars) for (const n of parseMelody(level.song.melody)) if (b0 + n.bar < bars) all.push({ ...n, bar: b0 + n.bar });
  // 목소리 음역으로 (가운데 ~ A4)
  const med = all.map((n) => n.midi).sort((a, b) => a - b)[Math.floor(all.length / 2)];
  const shift = 12 * Math.round((67 + voiceOct * 12 - med) / 12);
  const total = Math.ceil((lead + bars * 16 * st + 2) * SR);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const V = new Float32Array(total); // 목소리 (리버브용)
  // ---- 목소리
  for (const n of all) {
    const at = n.bar * 16 + n.step;
    const t0 = lead + at * st + r() * 0.045 * hard; // 살짝 늦게
    const dur = n.len * st - 0.03 - r() * 0.03;
    if (dur < 0.04) continue;
    const midi = n.midi + shift;
    const detune = (r() - 0.5) * 0.3 * hard; // 반음의 ±15%
    const vowel = VOWELS[Math.floor(r() * VOWELS.length)];
    const a = Math.round(t0 * SR);
    const nS = Math.round(dur * SR);
    let ph = new Float64Array(40);
    const scoop = (0.6 + r() * 0.6) * hard; // 반음
    const vibDepth = (0.25 + r() * 0.25) * hard;
    const vibRate = 5 + r() * 1.5;
    for (let i = 0; i < nS; i++) {
      const t = i / SR;
      let m = midi + detune - scoop * Math.exp(-t / 0.05);
      if (t > 0.18) m += vibDepth * Math.min(1, (t - 0.18) / 0.15) * Math.sin(2 * Math.PI * vibRate * t);
      const f0 = hz(m);
      const env = Math.min(1, t / 0.035) * Math.min(1, (dur - t) / 0.05);
      let v = 0;
      for (let h = 1; h <= 40; h++) {
        const f = f0 * h;
        if (f > 6000) break;
        ph[h - 1] += (2 * Math.PI * f) / SR;
        v += (Math.sin(ph[h - 1]) / h) * formantGain(f, vowel);
      }
      v += (r() - 0.5) * 0.04 * hard; // 숨소리
      if (t < 0.03) v += (r() - 0.5) * 0.25 * hard * (1 - t / 0.03); // 자음
      V[a + i] += v * env * 0.5;
    }
  }
  // 목소리: 가운데 + 리버브(좌우 다르게)
  for (let i = 0; i < total; i++) {
    L[i] += V[i];
    R[i] += V[i];
  }
  const taps = [
    [0.031, 0.25, 0],
    [0.047, 0.25, 1],
    [0.073, 0.2, 0],
    [0.089, 0.2, 1],
    [0.13, 0.15, 0],
    [0.17, 0.15, 1],
  ];
  for (const [d, g, side] of taps) {
    const k = Math.round(d * SR);
    const out = side ? R : L;
    for (let i = k; i < total; i++) out[i] += V[i - k] * g * hard;
  }
  // ---- 반주
  const prog = level.song.prog;
  const tone = (out, out2, pan, t0, dur, f, gain, decay, harm = 6) => {
    const a = Math.round(t0 * SR);
    const nS = Math.round(dur * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < nS && a + i < total; i++) {
      const t = i / SR;
      let v = 0;
      for (let h = 1; h <= harm; h++) v += Math.sin(2 * Math.PI * f * h * t) / (h * h * 0.7 + 0.3);
      v *= Math.exp(-t / decay) * Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.02);
      L[a + i] += v * gl;
      R[a + i] += v * gr;
    }
  };
  for (let b = 0; b < bars; b++) {
    const parts = (prog[b % prog.length] || 'C').split(' ');
    const half = 16 / parts.length;
    parts.forEach((p, pi) => {
      const ch = parseChord(p);
      const t0 = lead + (b * 16 + pi * half) * st;
      // 가운데 패드 (화음 음 길게)
      for (const m of ch.notes) tone(L, R, 0, t0, half * st, hz(m), 0.06 * hard, 3, 3);
      // 베이스 (가운데)
      for (let k = 0; k < half; k += 4) tone(L, R, 0, t0 + k * st, 3.5 * st, hz(ch.root - 24), 0.35, 0.6, 4);
      // 피아노 8분 펼친 화음 (좌우)
      for (let k = 0; k < half; k += 2) {
        const m = ch.notes[(k / 2) % ch.notes.length] + (k % 4 ? 12 : 0);
        tone(L, R, k % 4 ? 0.7 : -0.7, t0 + k * st, 2 * st, hz(m), 0.16 * hard, 0.4, 6);
      }
    });
    // 드럼 (가운데)
    for (let s = 0; s < 16; s++) {
      const t0 = lead + (b * 16 + s) * st;
      const a = Math.round(t0 * SR);
      if (s % 8 === 0) for (let i = 0; i < 0.15 * SR; i++) { const t = i / SR; const v = Math.sin(2 * Math.PI * (50 + 100 * Math.exp(-t / 0.03)) * t) * Math.exp(-t / 0.08) * 0.6; L[a + i] += v; R[a + i] += v; }
      if (s % 8 === 4) for (let i = 0; i < 0.15 * SR; i++) { const t = i / SR; const v = (r() - 0.5) * Math.exp(-t / 0.05) * 0.5 * hard; L[a + i] += v; R[a + i] += v; }
      if (s % 2 === 0) for (let i = 0; i < 0.04 * SR; i++) { const t = i / SR; const v = (r() - 0.5) * Math.exp(-t / 0.01) * 0.15; L[a + i] += v * 0.8; R[a + i] += v * 1.2; }
    }
  }
  return { L, R, firstBeat: lead, bpm, bars, truth: all.map((n) => ({ at: n.bar * 16 + n.step, midi: n.midi + shift, len: n.len })) };
}

/** 8분 칸 점수 */
function score(truth, outBars, bars) {
  const total = bars * 16;
  const T = new Int16Array(total).fill(-1);
  for (const n of truth) for (let i = 0; i < n.len && n.at + i < total; i++) T[n.at + i] = n.midi;
  const O = new Int16Array(total).fill(-1);
  outBars.forEach((bar, b) => bar.forEach((n) => { for (let i = 0; i < n.len; i++) O[b * 16 + n.step + i] = n.midi; }));
  let best = 0;
  for (const sh of [-24, -12, 0, 12, 24]) {
    let ok = 0, cnt = 0;
    for (let s = 0; s < total; s += 2) {
      // 칸 가운데쯤의 정답 (8분 칸 앞쪽)
      if (T[s] < 0) continue;
      cnt++;
      if (O[s] >= 0 && O[s] + sh === T[s]) ok++;
      else if (O[s + 1] >= 0 && O[s + 1] + sh === T[s] && T[s + 1] === T[s]) ok++;
    }
    best = Math.max(best, cnt ? ok / cnt : 0);
  }
  // 소리 없는 칸에 음을 넣은 비율 (헛음)
  let fp = 0, rest = 0;
  for (let s = 0; s < total; s += 2) if (T[s] < 0) { rest++; if (O[s] >= 0) fp++; }
  return { acc: best, fp: rest ? fp / rest : 0 };
}

const IDS = (process.env.IDS || '1,2,3,4,5,7,8,9,12,16,17,23').split(',').map(Number);
const hard = Number(process.env.HARD || 1);
let sum = 0, sumC = 0, n = 0, sumO = 0;
const rows = [];
for (const id of IDS) {
  const lv = LEVELS.find((l) => l.id === id);
  for (const seed of [1, 2]) {
    const s = render(lv, { seed: seed * 7 + id, hard, voiceOct: seed === 2 ? -1 : 0 });
    const t = transcribe([s.L, s.R], SR, { firstBeat: s.firstBeat, bpm: s.bpm, bars: s.bars, ...(process.env.LO ? { lo: +process.env.LO, hi: +process.env.HI } : {}) });
    const raw = score(s.truth, t.bars, s.bars);
    if (process.env.DBG && +process.env.DBG === id && seed === +(process.env.SEED||1)) {
      const T = new Int16Array(s.bars*16).fill(-1); for (const n of s.truth) for (let i=0;i<n.len;i++) T[n.at+i]=n.midi;
      const OB = process.env.DCL ? cleanMelody(t.bars,{grid:2,key:!process.env.NOKEY}) : t.bars; const O = new Int16Array(s.bars*16).fill(-1); OB.forEach((bar,b)=>bar.forEach(n=>{for(let i=0;i<n.len;i++)O[b*16+n.step+i]=n.midi;}));
      for (let b=0;b<s.bars;b++){ let a='',c=''; for(let k=0;k<16;k+=1){a+=String(T[b*16+k]).padStart(3);c+=String(O[b*16+k]).padStart(3);} console.log('T'+a+'\nO'+c); }
    }
    const cl = score(s.truth, cleanMelody(t.bars, { grid: +(process.env.GRID||2), key: !process.env.NOKEY }), s.bars);
    rows.push(`${String(id).padStart(2)} ${seed === 2 ? '낮은목소리' : '높은목소리'} raw ${(raw.acc * 100).toFixed(0).padStart(3)}% clean ${(cl.acc * 100).toFixed(0).padStart(3)}% 헛음 ${(cl.fp * 100).toFixed(0)}%`);
    // 정답을 8분 칸으로 정리한 것과의 점수 = 8분 칸으로는 이게 최대
    const tb = Array.from({length:s.bars},()=>[]); for (const n of s.truth) tb[Math.floor(n.at/16)].push({step:n.at%16,midi:n.midi,len:Math.min(n.len,16-n.at%16)});
    const orc = score(s.truth, cleanMelody(tb,{grid:2,key:false}), s.bars);
    rows[rows.length-1] += ` 8분최대 ${(orc.acc*100).toFixed(0)}%`;
    sumO = (globalThis.sumO||0) + orc.acc; globalThis.sumO = sumO;
    sum += raw.acc; sumC += cl.acc; n++;
  }
}
if (process.env.V) console.log(rows.join('\n'));
console.log(`8분최대 ${((globalThis.sumO / n) * 100).toFixed(1)}%`);
console.log(`평균 raw ${((sum / n) * 100).toFixed(1)}%  clean ${((sumC / n) * 100).toFixed(1)}%`);
