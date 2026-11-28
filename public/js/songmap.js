// 🎼 노래 파일 → 유저 맵 (폰 안에서만. 파일은 밖으로 안 나감)
//   11-21 사용자 요청 '음 따는 게 너무 못 따. 딸 수 있는 건 다 따서 원래 곡이랑 최대한 비슷하게'
//   ① 멜로디: 골라낸 목소리(vocalsep.js)에서 10ms 마다 음 높이(pYIN 방식: YIN 후보 + 음 이어 고르기) → 음표로 끊어 박에 맞춤
//      목소리가 없는 곳(전주·간주·연주곡)은 반주에서 가장 또렷한 위쪽 줄(신스·피아노·카우벨 등)을 땀
//   ② 화음: 반주(원래 소리 − 목소리)의 음 분포로 반 마디마다 코드 (멜로디로 짐작하지 않고 곡에서)
//   ③ 드럼: 곡의 쿵·짝을 그대로 (beatsync.js songChart)
import { fft, cleanMelody, tidyDrums } from './usermap.js';
import { STEPS_PER_BAR } from './charts.js';
import { songChart } from './beatsync.js';

const LOG = Math.log;
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** 가운데(L+R)/2 */
function center(chans) {
  const L = chans[0];
  const R = chans[chans.length - 1];
  if (L === R) return L;
  const out = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) out[i] = (L[i] + R[i]) * 0.5;
  return out;
}

/** 정수배로 줄이기 (저역 필터 + 솎기) → 약 target Hz */
function downsample(x, sr, target) {
  const d = Math.max(1, Math.round(sr / target));
  if (d === 1) return { y: x, sr };
  const taps = 8 * d + 1;
  const h = new Float32Array(taps);
  const fc = 0.45 / d;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const k = i - (taps - 1) / 2;
    const sinc = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  const n = Math.floor(x.length / d);
  const y = new Float32Array(n);
  const half = (taps - 1) >> 1;
  for (let j = 0; j < n; j++) {
    const c = j * d;
    let v = 0;
    const a = Math.max(0, c - half);
    const b = Math.min(x.length - 1, c + half);
    for (let i = a; i <= b; i++) v += x[i] * h[i - c + half];
    y[j] = v;
  }
  return { y, sr: sr / d };
}

// ---------------------------------------------------------------
// ① 목소리 음 높이 (pYIN 방식)
// ---------------------------------------------------------------
// 문턱값 분포 (베타 분포 평균 0.15) — 이 문턱보다 낮은 첫 골짜기를 음으로 봄
const TH = [];
{
  const a = 2;
  const b = 11.33;
  let s = 0;
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const w = Math.pow(t, a - 1) * Math.pow(1 - t, b - 1);
    TH.push([t, w]);
    s += w;
  }
  for (const p of TH) p[1] /= s;
}

/**
 * YIN 후보: 프레임마다 [{ midi, p }] (p 합 ≤ 1 = 음이 있을 확률) + 세기
 * @param {Float32Array} y 줄인 소리 @param {number} sr @param {number} hop 샘플
 */
function yinCandidates(y, sr, hop, lo, hi) {
  const tauMax = Math.ceil(sr / midiToHz(lo)) + 2;
  const tauMin = Math.max(2, Math.floor(sr / midiToHz(hi)));
  const W = Math.round(sr * 0.032);
  let N = 1;
  while (N < W + tauMax + 2) N <<= 1;
  const nF = Math.max(0, Math.floor((y.length - W - tauMax) / hop));
  const reA = new Float64Array(N);
  const imA = new Float64Array(N);
  const reB = new Float64Array(N);
  const imB = new Float64Array(N);
  const d = new Float64Array(tauMax + 2);
  const dn = new Float64Array(tauMax + 2);
  const cands = new Array(nF);
  const rms = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    const a = f * hop;
    reA.fill(0);
    imA.fill(0);
    reB.fill(0);
    imB.fill(0);
    const segLen = W + tauMax + 1;
    for (let i = 0; i < segLen; i++) reA[i] = y[a + i];
    for (let i = 0; i < W; i++) reB[i] = y[a + i];
    let e0 = 0;
    for (let i = 0; i < W; i++) e0 += y[a + i] * y[a + i];
    rms[f] = Math.sqrt(e0 / W);
    if (e0 < 1e-9) {
      cands[f] = [];
      continue;
    }
    fft(reA, imA);
    fft(reB, imB);
    // r(τ) = IFFT(conj(B)·A)
    for (let k = 0; k < N; k++) {
      const r = reB[k] * reA[k] + imB[k] * imA[k];
      const i = reB[k] * imA[k] - imB[k] * reA[k];
      reA[k] = r;
      imA[k] = -i; // conj 해서 정방향 FFT 로 역변환
    }
    fft(reA, imA);
    // eτ = Σ_{j=τ}^{τ+W-1} x²
    let et = e0;
    d[0] = 0;
    for (let t = 1; t <= tauMax; t++) {
      et += y[a + t + W - 1] * y[a + t + W - 1] - y[a + t - 1] * y[a + t - 1];
      d[t] = Math.max(0, e0 + et - (2 * reA[t]) / N);
    }
    // 누적 평균 정규화
    let cs = 0;
    dn[0] = 1;
    for (let t = 1; t <= tauMax; t++) {
      cs += d[t];
      dn[t] = cs > 0 ? (d[t] * t) / cs : 1;
    }
    // 골짜기들
    const mins = [];
    for (let t = tauMin; t < tauMax; t++) {
      if (dn[t] < dn[t - 1] && dn[t] <= dn[t + 1] && dn[t] < 1) {
        // 포물선으로 τ 다듬기
        const s0 = dn[t - 1];
        const s1 = dn[t];
        const s2 = dn[t + 1];
        const den = s0 - 2 * s1 + s2;
        const off = den > 0 ? (0.5 * (s0 - s2)) / den : 0;
        mins.push({ tau: t + Math.max(-1, Math.min(1, off)), v: s1 });
      }
    }
    const out = [];
    if (mins.length) {
      const prob = new Float64Array(mins.length);
      let gi = 0;
      for (let i = 1; i < mins.length; i++) if (mins[i].v < mins[gi].v) gi = i;
      for (const [th, w] of TH) {
        let k = -1;
        for (let i = 0; i < mins.length; i++)
          if (mins[i].v < th) {
            k = i;
            break;
          }
        if (k >= 0) prob[k] += w;
        else prob[gi] += w * 0.01; // 문턱 아래가 없으면 가장 깊은 골짜기에 아주 조금
      }
      for (let i = 0; i < mins.length; i++) if (prob[i] > 0.005) out.push({ midi: hzToMidi(sr / mins[i].tau), p: prob[i] });
    }
    cands[f] = out;
  }
  return { cands, rms, nF };
}

/**
 * 후보들 → 한 줄 음 높이 (비터비). 20센트 칸, 프레임 사이 5반음 안에서는 부드럽게, 그보다 멀면 벌점
 * gate[f] = 0~1 (목소리가 있을 법한 정도, 1 이면 그대로)
 */
function viterbiPitch(cands, nF, lo, hi, gate, { switchP = 0.02, voiceBias = 1, unvoiced = 30 } = {}) {
  const RES = 5;
  const B = (hi - lo) * RES + 1;
  const U = B; // 쉼 상태
  const S = B + 1;
  const J = 25;
  const lSwitch = LOG(switchP);
  const lStay = LOG(1 - switchP);
  // 음이 옮겨 가는 벌점: 20센트 칸 하나에 0.12 (반음 0.6). 5반음 넘게 한 번에 뛰면 크게
  const tw = new Float64Array(J + 1);
  for (let k = 0; k <= J; k++) tw[k] = lStay - 0.12 * k;
  const lJump = lStay - 6;
  const back = new Int16Array(nF * S);
  let prev = new Float64Array(S).fill(0);
  let cur = new Float64Array(S);
  const emit = new Float64Array(S);
  const path = new Float32Array(nF).fill(-1);
  const exact = new Float32Array(B);
  for (let f = 0; f < nF; f++) {
    // 방출
    emit.fill(0);
    let vp = 0;
    for (const c of cands[f]) {
      const b = Math.round((c.midi - lo) * RES);
      if (b < 0 || b >= B) continue;
      emit[b] += c.p;
      vp += c.p;
    }
    const g = gate ? gate[f] : 1;
    vp = Math.min(1, vp);
    const vScale = g * voiceBias;
    for (let b = 0; b < B; b++) emit[b] = LOG(emit[b] * vScale + 1e-4 / B);
    // pYIN 처럼: 얕은 골짜기라도 있으면 음 쪽으로 (쉼 점수는 칸 수로 나눈 만큼)
    emit[U] = LOG(Math.max(1e-4, 1 - vp * g) / unvoiced + 1e-7);
    if (f === 0) {
      for (let s = 0; s < S; s++) cur[s] = emit[s];
    } else {
      let gmax = -Infinity;
      let gi = 0;
      for (let b = 0; b < B; b++)
        if (prev[b] > gmax) {
          gmax = prev[b];
          gi = b;
        }
      for (let b = 0; b < B; b++) {
        let bv = prev[U] + lSwitch;
        let bi = U;
        const a0 = Math.max(0, b - J);
        const a1 = Math.min(B - 1, b + J);
        for (let a = a0; a <= a1; a++) {
          const v = prev[a] + tw[Math.abs(a - b)];
          if (v > bv) {
            bv = v;
            bi = a;
          }
        }
        if (gmax + lJump > bv) {
          bv = gmax + lJump;
          bi = gi;
        }
        cur[b] = bv + emit[b];
        back[f * S + b] = bi;
      }
      // 쉼으로
      let bv = prev[U] + lStay;
      let bi = U;
      if (gmax + lSwitch > bv) {
        bv = gmax + lSwitch;
        bi = gi;
      }
      cur[U] = bv + emit[U];
      back[f * S + U] = bi;
    }
    // 정규화 (숫자 안 커지게)
    let m = -Infinity;
    for (let s = 0; s < S; s++) if (cur[s] > m) m = cur[s];
    for (let s = 0; s < S; s++) cur[s] -= m;
    [prev, cur] = [cur, prev];
  }
  let bi = 0;
  for (let s = 1; s < S; s++) if (prev[s] > prev[bi]) bi = s;
  for (let f = nF - 1; f >= 0; f--) {
    path[f] = bi === U ? -1 : bi;
    bi = back[f * S + bi];
  }
  // 칸 → 실제 음 높이 (그 칸 근처 후보의 정확한 값)
  const out = new Float32Array(nF).fill(-1);
  for (let f = 0; f < nF; f++) {
    if (path[f] < 0) continue;
    const m = lo + path[f] / RES;
    let best = m;
    let bd = 0.35;
    for (const c of cands[f]) {
      const dd = Math.abs(c.midi - m);
      if (dd < bd) (bd = dd), (best = c.midi);
    }
    out[f] = best;
  }
  return out;
}

// ---------------------------------------------------------------
// 반주의 위쪽 줄 (목소리가 없는 곳)
//   배음 더하기로 음 후보 점수 → 가장 또렷한 음을 이어 고름
// ---------------------------------------------------------------
function leadSalience(x, sr, hop, lo, hi, want = null) {
  const N = 2048;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const binHz = sr / N;
  const nF = Math.max(0, Math.floor((x.length - N) / hop) + 1);
  const C = hi - lo + 1;
  const kMin = Math.floor(80 / binHz);
  const kMax = Math.min(N / 2 - 2, Math.ceil(6000 / binHz));
  const mag = new Float32Array(N / 2);
  const wm = new Float32Array(N / 2);
  const cs = new Float64Array(N / 2 + 1);
  const cands = new Array(nF);
  const peak = (k) => Math.max(wm[k - 1], wm[k], wm[k + 1]);
  for (let f = 0; f < nF; f++) {
    if (want && !want(f)) {
      cands[f] = [];
      continue;
    }
    const a = f * hop;
    for (let i = 0; i < N; i++) (re[i] = x[a + i] * win[i]), (im[i] = 0);
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.sqrt(Math.hypot(re[k], im[k]));
    cs[0] = 0;
    for (let k = 0; k < N / 2; k++) cs[k + 1] = cs[k] + mag[k];
    for (let k = kMin; k <= kMax; k++) {
      const hw = Math.max(3, Math.round(k * 0.15));
      const a2 = Math.max(0, k - hw);
      const b2 = Math.min(N / 2, k + hw + 1);
      const avg = (cs[b2] - cs[a2]) / (b2 - a2);
      wm[k] = avg > 0 ? Math.max(0, mag[k] / avg - 1) : 0;
    }
    const sal = new Float32Array(C);
    let mx = 0;
    let sum = 0;
    for (let j = 0; j < C; j++) {
      const f0 = midiToHz(lo + j);
      let v = 0;
      let odd = 0;
      let even = 0;
      for (let h = 1; h <= 6; h++) {
        const k = Math.round((f0 * h) / binHz);
        if (k + 1 > kMax) break;
        const p = Math.pow(0.8, h - 1) * peak(k);
        v += p;
        if (h % 2) odd += p;
        else even += p;
      }
      if (odd + even > 0) v *= Math.min(1, (2.2 * odd) / (odd + even));
      // 바탕음이 없으면 크게 깎음
      const k1 = Math.round(f0 / binHz);
      if (peak(k1) <= 0) v *= 0.3;
      // 더 낮은 음의 배음일 뿐이면(반 주파수·1.5배 자리에도 소리) 깎음 — 찌그러진 808 베이스처럼 배음이 촘촘한 소리
      const kh = Math.round(f0 / 2 / binHz);
      const k15 = Math.round((f0 * 1.5) / binHz);
      const k25 = Math.round((f0 * 2.5) / binHz);
      if (kh > kMin) v -= 0.6 * peak(kh);
      if (k15 + 1 <= kMax) v -= 0.6 * peak(k15);
      if (k25 + 1 <= kMax) v -= 0.3 * peak(k25);
      v = Math.max(0, v);
      sal[j] = v;
      sum += v;
      if (v > mx) mx = v;
    }
    // 후보: 상위 몇 개 (뚜렷할수록 p 큼)
    const out = [];
    if (mx > 0) {
      const mean = sum / C;
      const clarity = Math.min(1, Math.max(0, (mx / (mean + 1e-9) - 2) / 4));
      for (let j = 0; j < C; j++) {
        if (sal[j] < mx * 0.6) continue;
        if (j > 0 && sal[j - 1] > sal[j]) continue;
        if (j < C - 1 && sal[j + 1] > sal[j]) continue;
        out.push({ midi: lo + j, p: clarity * (sal[j] / mx) * 0.8 });
      }
    }
    cands[f] = out;
  }
  return { cands, nF };
}

// ---------------------------------------------------------------
// 음 높이 줄 → 음표 → 박 칸
// ---------------------------------------------------------------
/** 전체 음정이 표준(A=440)에서 얼마나 벗어났나 (반음 단위, -0.5~0.5). 빨리 감은 노래 등 */
function tuningOffset(f0) {
  let c = 0;
  let s = 0;
  for (const m of f0) {
    if (m < 0) continue;
    c += Math.cos(2 * Math.PI * m);
    s += Math.sin(2 * Math.PI * m);
  }
  return c || s ? Math.atan2(s, c) / (2 * Math.PI) : 0;
}

/**
 * 프레임 음 높이(+세기) → 음표 [{ t0, t1, midi }] (초)
 *   음이 바뀌면(반올림 음이 몇 프레임 이어서 다르면) 끊고, 같은 음이어도 소리가 다시 세지면(새 글자) 끊음
 */
function segment(f0, rms, hopSec, tune) {
  const nF = f0.length;
  const semi = new Int16Array(nF).fill(-1);
  for (let f = 0; f < nF; f++) if (f0[f] >= 0) semi[f] = Math.round(f0[f] - tune);
  // 세기 첫머리
  const le = new Float32Array(nF);
  for (let f = 0; f < nF; f++) le[f] = LOG(rms[f] + 1e-5);
  const K = Math.max(2, Math.round(0.04 / hopSec)); // 40ms 넘게 다른 음이면 바뀐 것
  const minLen = Math.max(2, Math.round(0.06 / hopSec));
  const notes = [];
  let f = 0;
  while (f < nF) {
    if (semi[f] < 0) {
      f++;
      continue;
    }
    // 목소리 한 덩어리 [f, e)
    let e = f;
    while (e < nF && semi[e] >= 0) e++;
    // 덩어리 안에서 음 바뀜 찾기
    const cuts = [f];
    let curP = semi[f];
    // 시작 몇 프레임은 끌어올림일 수 있으니 덩어리 앞쪽 다수결로 첫 음
    {
      const cnt = new Map();
      for (let i = f; i < Math.min(e, f + 3 * K); i++) cnt.set(semi[i], (cnt.get(semi[i]) || 0) + 1);
      let bc = 0;
      for (const [p, c] of cnt) if (c > bc) (bc = c), (curP = p);
    }
    let i = f + 1;
    while (i < e) {
      if (semi[i] !== curP) {
        // K 프레임 넘게 같은 새 음이 이어지나
        let j = i;
        const np = semi[i];
        while (j < e && Math.abs(semi[j] - np) === 0) j++;
        if (j - i >= K) {
          cuts.push(i);
          curP = np;
          i = j;
          continue;
        }
        i++;
        continue;
      }
      // 같은 음인데 세기가 확 커짐 (새 글자)
      if (i - cuts[cuts.length - 1] >= minLen && i + minLen <= e) {
        let lowest = le[i];
        for (let k = Math.max(cuts[cuts.length - 1], i - K); k < i; k++) lowest = Math.min(lowest, le[k]);
        if (le[i] - lowest > 0.7 && le[Math.min(e - 1, i + 1)] - lowest > 0.7) {
          cuts.push(i);
          i += minLen;
          continue;
        }
      }
      i++;
    }
    cuts.push(e);
    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c];
      const b = cuts[c + 1];
      if (b - a < minLen) continue;
      // 음 높이: 뒤쪽 3/4 의 가운데값 (첫머리 끌어올림 빼고)
      const vals = [];
      for (let k = a + Math.floor((b - a) / 4); k < b; k++) vals.push(f0[k] - tune);
      vals.sort((x, y) => x - y);
      notes.push({ t0: a * hopSec, t1: b * hopSec, midi: Math.round(vals[vals.length >> 1]), a, b });
    }
    f = e;
  }
  // 바로 붙은 같은 음 조각이 아주 짧으면 합침
  const out = [];
  for (const n of notes) {
    const p = out[out.length - 1];
    if (p && p.midi === n.midi && n.t0 - p.t1 < 0.03 && n.t1 - n.t0 < 0.08) p.t1 = n.t1;
    else out.push(n);
  }
  return out;
}

/** 음표(초) → 마디별 16분 칸 음표. 가장 가까운 칸에 붙이고, 뒤 음이 앞 음 꼬리를 덮음 */
function quantize(notes, firstBeat, bpm, bars) {
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  const cell = new Int16Array(total).fill(-1);
  const onset = new Uint8Array(total);
  for (const n of [...notes].sort((p, q) => p.t0 - q.t0)) {
    const on = (n.t0 - firstBeat) / st;
    const off = (n.t1 - firstBeat) / st;
    const s0 = Math.round(on);
    let s1 = Math.round(off);
    if (s1 <= s0) {
      if (off - on < 0.45) continue; // 16분의 반도 안 되는 음은 버림
      s1 = s0 + 1;
    }
    if (s0 >= total || s1 <= 0) continue;
    for (let s = Math.max(0, s0); s < Math.min(total, s1); s++) {
      cell[s] = n.midi;
      onset[s] = 0;
    }
    if (s0 >= 0) onset[s0] = 1;
  }
  const out = Array.from({ length: bars }, () => []);
  let cur = null;
  for (let s = 0; s < total; s++) {
    const p = cell[s];
    const step = s % STEPS_PER_BAR;
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || cur.midi !== p || onset[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
    } else cur.len++;
  }
  return out;
}

// ---------------------------------------------------------------
// ② 화음: 반주 음 분포(크로마) → 반 마디마다 코드
// ---------------------------------------------------------------
const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_P = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_P = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** 반 마디마다 크로마(12) + 베이스 크로마(12) */
function halfBarChroma(x, sr, firstBeat, bpm, bars) {
  const N = 4096;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const binHz = sr / N;
  // 칸 → 음이름 (가까운 반음에 붙임, 반음 사이 칸은 버림)
  const pcOf = new Int8Array(N / 2).fill(-1);
  const isBass = new Uint8Array(N / 2);
  for (let k = 1; k < N / 2; k++) {
    const f = k * binHz;
    if (f < 40 || f > 2500) continue;
    const m = hzToMidi(f);
    if (Math.abs(m - Math.round(m)) > 0.4) continue;
    pcOf[k] = ((Math.round(m) % 12) + 12) % 12;
    isBass[k] = f < 180 ? 1 : 0;
  }
  const halfSec = (60 / bpm) * 2;
  const H = 2 * bars;
  const chroma = Array.from({ length: H }, () => new Float64Array(12));
  const bass = Array.from({ length: H }, () => new Float64Array(12));
  const energy = new Float64Array(H);
  const hop = Math.round(sr * 0.05);
  const mag = new Float64Array(N / 2);
  const cs = new Float64Array(N / 2 + 1);
  for (let h = 0; h < H; h++) {
    const t0 = firstBeat + h * halfSec;
    for (let t = t0 + 0.02; t < t0 + halfSec - 0.02; t += hop / sr) {
      const a = Math.round(t * sr) - N / 2;
      if (a < 0 || a + N > x.length) continue;
      for (let i = 0; i < N; i++) (re[i] = x[a + i] * win[i]), (im[i] = 0);
      fft(re, im);
      for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
      // 둘레 평균보다 튀어나온 봉우리만 (북소리·잡음처럼 고르게 퍼진 소리는 빼고 음만)
      cs[0] = 0;
      for (let k = 0; k < N / 2; k++) cs[k + 1] = cs[k] + mag[k];
      for (let k = 2; k < N / 2 - 1; k++) {
        const pc = pcOf[k];
        if (pc < 0 || mag[k] < mag[k - 1] || mag[k] < mag[k + 1]) continue;
        const hw = Math.max(4, Math.round(k * 0.06));
        const a2 = Math.max(0, k - hw);
        const b2 = Math.min(N / 2, k + hw + 1);
        const avg = (cs[b2] - cs[a2]) / (b2 - a2);
        const v = mag[k] - 1.5 * avg;
        if (v <= 0) continue;
        if (isBass[k]) bass[h][pc] += v;
        else chroma[h][pc] += v;
        energy[h] += v;
      }
    }
  }
  return { chroma, bass, energy };
}

/**
 * 반 마디마다 코드 → 마디별 prog ('C', 'Am F' …)
 *   장·단3화음 24개를 크로마에 맞춰 보고, 조에 맞는 코드·앞 코드 유지에 조금 더 점수(비터비)
 */
export function detectChords(x0, sr0, { firstBeat, bpm, bars, melody = null, inst = null, low = null }) {
  // 낮은 음까지 반음을 가르려면 주파수 칸이 촘촘해야 해서 11kHz 로 줄여서 (4096 칸 = 2.7Hz)
  const { y: x, sr } = downsample(x0, sr0, 11025);
  const { chroma, bass, energy } = halfBarChroma(x, sr, firstBeat, bpm, bars);
  const H = chroma.length;
  // 정규화
  const norm = (v) => {
    let s = 0;
    for (const a of v) s += a * a;
    s = Math.sqrt(s) || 1;
    return Array.from(v, (a) => a / s);
  };
  let C = chroma.map(norm);
  let Bn = bass.map(norm);
  // 🎹 Basic Pitch 음(있으면): C3~C6 울림을 음이름으로 모아 크로마에 반 섞음 — 신스·패드 화음도 또렷하게 (2026-11-28)
  if (inst) {
    const { note, frames, fps } = inst;
    const halfSec = (60 / bpm) * 2;
    C = C.map((c, h) => {
      const v = new Float64Array(12);
      const f0 = Math.max(0, Math.round((firstBeat + h * halfSec) * fps));
      const f1 = Math.min(frames, Math.round((firstBeat + (h + 1) * halfSec) * fps));
      for (let f = f0; f < f1; f++) for (let k = 48 - 21; k <= 84 - 21; k++) v[(k + 21) % 12] += note[f * 88 + k];
      if (!v.some((x) => x > 0)) return c;
      const n = norm(v);
      return norm(c.map((x, i) => 0.5 * x + 0.5 * n[i]));
    });
  }
  // 🎸 딴 베이스 줄(있으면): 반 마디마다 길이만큼 → 베이스 쪽에 반 섞음
  if (low) {
    Bn = Bn.map((bv, h) => {
      const v = new Float64Array(12);
      const bar = low[h >> 1] || [];
      for (const nn of bar) for (let i = 0; i < nn.len; i++) if (((nn.step + i) >= 8 ? 1 : 0) === (h & 1)) v[((nn.midi % 12) + 12) % 12] += (nn.step + i) % 8 === 0 ? 2 : 1;
      if (!v.some((x) => x > 0)) return bv;
      const n = norm(v);
      return norm(bv.map((x, i) => 0.5 * x + 0.5 * n[i]));
    });
  }
  // 딴 멜로디 음도 같이 봄 (반주가 흐릿한 곡에서도 멜로디와 안 부딪히게)
  const M = Array.from({ length: H }, () => new Float64Array(12));
  if (melody)
    melody.forEach((bar, b) =>
      bar.forEach((nn) => {
        for (let i = 0; i < nn.len; i++) {
          const h = 2 * b + ((nn.step + i) >= 8 ? 1 : 0);
          if (h < H) M[h][((nn.midi % 12) + 12) % 12] += (nn.step + i) % 4 === 0 ? 1.5 : 1;
        }
      })
    );
  const Mn = M.map((v) => (v.some((x) => x) ? norm(v) : v));
  // 조 (곡 전체 크로마)
  const tot = new Array(12).fill(0);
  for (const c of C) for (let i = 0; i < 12; i++) tot[i] += c[i];
  // 딴 베이스·멜로디도 조 찾기에 (반주 크로마만 보면 찌꺼기 음 때문에 조가 틀릴 때가 있어서, 2026-11-28)
  if (low) for (const v of Bn) for (let i = 0; i < 12; i++) tot[i] += 0.7 * v[i];
  if (melody) for (const v of Mn) for (let i = 0; i < 12; i++) tot[i] += 0.5 * v[i];
  let key = 0;
  let minor = false;
  let bestK = -Infinity;
  for (let k = 0; k < 12; k++)
    for (const [prof, mn] of [
      [MAJOR_P, false],
      [MINOR_P, true],
    ]) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += tot[(i + k) % 12] * prof[i];
      if (s > bestK) (bestK = s), (key = k), (minor = mn);
    }
  // 장조 기준 으뜸음 (나란한조 단조면 +3)
  const majTonic = minor ? (key + 3) % 12 : key;
  const diatonic = new Set([0, 2, 4, 5, 7, 9, 11].map((d) => (majTonic + d) % 12));
  const chords = [];
  for (let r = 0; r < 12; r++)
    for (const q of [0, 1]) {
      const tones = [r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12];
      const inKey = tones.every((t) => diatonic.has(t));
      chords.push({ name: NOTE[r] + (q ? 'm' : ''), root: r, tones, prior: inKey ? 0 : -0.12 });
    }
  // 방출: 화음 음 비중 - 밖 음 비중 + 베이스가 뿌리음이면 더
  const em = (h, c) => {
    let inS = 0;
    let out = 0;
    for (let i = 0; i < 12; i++) (c.tones.includes(i) ? (inS += C[h][i]) : (out += C[h][i]));
    let s = inS / 3 - (out / 9) * 1.2 + c.prior;
    let mIn = 0;
    let mOut = 0;
    for (let i = 0; i < 12; i++) (c.tones.includes(i) ? (mIn += Mn[h][i]) : (mOut += Mn[h][i]));
    s += MELW * (mIn / 3 - (mOut / 9) * 1.2);
    s += BASSW * Bn[h][c.root] + 0.1 * Bn[h][c.tones[2]] - 0.1 * Bn[h][(c.root + 1) % 12];
    return s * 4;
  };
  const K = chords.length;
  let prev = new Float64Array(K);
  let cur = new Float64Array(K);
  const back = new Int16Array(H * K);
  const maxE = Math.max(1e-9, ...energy);
  const STAY = 0.3; // 앞 코드 유지 점수
  const BASSW = 0.35; // 베이스가 뿌리음이면 더
  const MELW = 0.3; // 멜로디 음 (살짝)
  for (let h = 0; h < H; h++) {
    const silent = energy[h] < maxE * 0.03;
    for (let j = 0; j < K; j++) {
      const e = silent ? 0 : em(h, chords[j]);
      if (h === 0) {
        cur[j] = e;
        continue;
      }
      let bv = -Infinity;
      let bi = 0;
      for (let i = 0; i < K; i++) {
        const v = prev[i] + (i === j ? STAY : 0);
        if (v > bv) (bv = v), (bi = i);
      }
      cur[j] = bv + e;
      back[h * K + j] = bi;
    }
    [prev, cur] = [cur, prev];
  }
  const pick = new Int16Array(H);
  let bi = 0;
  for (let j = 1; j < K; j++) if (prev[j] > prev[bi]) bi = j;
  for (let h = H - 1; h >= 0; h--) {
    pick[h] = bi;
    bi = back[h * K + bi];
  }
  const prog = [];
  for (let b = 0; b < bars; b++) {
    const a = chords[pick[2 * b]].name;
    const c = chords[pick[2 * b + 1]].name;
    prog.push(a === c ? a : `${a} ${c}`);
  }
  return prog;
}

// ---------------------------------------------------------------
// 한꺼번에
// ---------------------------------------------------------------
/**
 * @param {{ mix: Float32Array[], voc?: Float32Array[]|null, sr: number, firstBeat: number, bpm: number, bars: number, grid?: number }} o
 *   mix = 원래 소리 [L, R], voc = 골라낸 목소리 [L, R] (못 골랐으면 null), firstBeat = 첫 마디 시작(초, 이 소리 안에서)
 * @returns {{ bars, found, prog, drums, vocalShare, leadShare }}
 */
export function transcribeSong({ mix, voc = null, sr, firstBeat, bpm, bars, grid = 2, lead = true, inst = null }) {
  const mixM = center(mix);
  const n = mixM.length;
  const accM = new Float32Array(n);
  let vocM = null;
  if (voc) {
    vocM = center(voc);
    for (let i = 0; i < n; i++) accM[i] = mixM[i] - (vocM[i] || 0);
  } else accM.set(mixM);
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  // 목소리가 거의 없는 곡(연주곡·비트)이면 목소리 쪽은 안 봄 (골라낸 소리는 악기 찌꺼기라서)
  let vocalRatio = 0;
  if (vocM) {
    const a = Math.max(0, Math.floor(firstBeat * sr));
    const b = Math.min(n, Math.ceil((firstBeat + total * st) * sr));
    let ev = 0;
    let em = 0;
    for (let i = a; i < b; i += 4) {
      ev += vocM[i] * vocM[i];
      em += mixM[i] * mixM[i];
    }
    vocalRatio = Math.sqrt(ev / (em + 1e-12));
    if (vocalRatio < 0.12) vocM = null;
  }

  // ① 목소리
  const LO = 40;
  const HI = 88;
  let vocNotes = [];
  let vocBars = null;
  if (vocM) {
    const { y, sr: sr2 } = downsample(vocM, sr, 11025);
    const hop = Math.round(sr2 * 0.0116);
    const hopSec = hop / sr2;
    const yc = yinCandidates(y, sr2, hop, LO, HI);
    // 반주 대비 목소리 세기 → 목소리가 거의 없는 곳은 쉼 쪽으로 (분리 찌꺼기)
    const { y: my } = downsample(mixM, sr, 11025);
    const W = Math.round(sr2 * 0.032);
    const gate = new Float32Array(yc.nF);
    let vmax = 0;
    for (let f = 0; f < yc.nF; f++) vmax = Math.max(vmax, yc.rms[f]);
    for (let f = 0; f < yc.nF; f++) {
      let e = 0;
      const a = f * hop;
      for (let i = 0; i < W && a + i < my.length; i++) e += my[a + i] * my[a + i];
      const mr = Math.sqrt(e / W);
      const ratio = yc.rms[f] / (mr + 1e-9);
      const abs = yc.rms[f] / (vmax + 1e-9);
      gate[f] = Math.min(1, Math.max(0, (ratio - 0.02) / 0.05)) * Math.min(1, Math.max(0, (abs - 0.01) / 0.04));
    }
    const f0 = viterbiPitch(yc.cands, yc.nF, LO, HI, gate);
    const tune = tuningOffset(f0);
    const c0 = (Math.round(sr2 * 0.032) / 2) / sr2; // 프레임 가운데 시각
    vocNotes = segment(f0, yc.rms, hopSec, tune).map((nn) => ({ ...nn, t0: nn.t0 + c0, t1: nn.t1 + c0 }));
    vocBars = quantize(vocNotes, firstBeat, bpm, bars);
  }
  // 목소리가 있는 칸
  const vocCell = new Uint8Array(total);
  if (vocBars) vocBars.forEach((bar, b) => bar.forEach((nn) => { for (let i = 0; i < nn.len; i++) vocCell[b * 16 + nn.step + i] = 1; }));
  let vocCount = 0;
  for (const v of vocCell) vocCount += v;

  // 목소리가 없는 긴 구간(1마디 넘게) → 반주의 위쪽 줄
  const gaps = [];
  {
    let s = 0;
    while (s < total) {
      if (vocCell[s]) {
        s++;
        continue;
      }
      let e = s;
      while (e < total && !vocCell[e]) e++;
      // 악기 음(inst)이 있으면 한 박 넘게 빈 곳도 채움 (중간중간 비는 곳 줄이기)
      if (lead && (e - s >= (inst ? 4 : 16) || vocCount < total * 0.1)) gaps.push([s, e]);
      s = e;
    }
  }
  let leadBars = null;
  let leadCount = 0;
  if (gaps.length && inst) {
    leadBars = instLine(inst, gaps, firstBeat, bpm, bars);
    leadBars.forEach((bar) => (leadCount += bar.reduce((a, x) => a + x.len, 0)));
  } else if (gaps.length) {
    const { y, sr: sr2 } = downsample(vocCount < total * 0.1 ? mixM : accM, sr, 22050);
    const hop = Math.round(sr2 * 0.0116);
    const hopSec = hop / sr2;
    const LLO = 52;
    const LHI = 96;
    // 목소리 없는 구간만 봄
    const off = 1024 / sr2; // 창 가운데
    const nF0 = Math.max(0, Math.floor((y.length - 2048) / hop) + 1);
    const inGap = new Uint8Array(nF0);
    for (const [a, b] of gaps) {
      const f0 = Math.max(0, Math.floor((firstBeat + a * st - off) / hopSec));
      const f1 = Math.min(nF0, Math.ceil((firstBeat + b * st - off) / hopSec));
      for (let f = f0; f < f1; f++) inGap[f] = 1;
    }
    const ls = leadSalience(y, sr2, hop, LLO, LHI, (f) => inGap[f]);
    const f0 = viterbiPitch(ls.cands, ls.nF, LLO, LHI, null, { switchP: 0.03, voiceBias: 1.2 });
    // 창 가운데 시각으로 맞춤
    const rms = new Float32Array(ls.nF);
    for (let f = 0; f < ls.nF; f++) {
      let e = 0;
      const a = f * hop + 512;
      const b = Math.min(y.length, a + 1024);
      for (let i = a; i < b; i++) e += y[i] * y[i];
      rms[f] = Math.sqrt(e / 1024);
    }
    const notes = segment(f0, rms, hopSec, 0).map((nn) => ({ ...nn, t0: nn.t0 + off, t1: nn.t1 + off }));
    leadBars = quantize(notes, firstBeat, bpm, bars);
    leadBars.forEach((bar) => (leadCount += bar.reduce((a, x) => a + x.len, 0)));
  }

  // 합치기: 목소리 음 + (목소리 없는 곳의) 반주 위쪽 줄. 반주 줄은 목소리 음역 근처로 옥타브를 옮김
  const merged = Array.from({ length: bars }, () => []);
  const vocMed = median((vocBars || []).flat().map((x) => x.midi));
  for (let b = 0; b < bars; b++) {
    if (vocBars) merged[b].push(...vocBars[b].map((x) => ({ ...x })));
    if (leadBars) {
      for (const x of leadBars[b]) {
        const s = b * 16 + x.step;
        let ok = true;
        for (let i = 0; i < x.len; i++) if (vocCell[s + i]) ok = false;
        if (!ok) continue;
        let m = x.midi;
        if (vocMed != null && vocCount >= total * 0.1) {
          while (m - vocMed > 9) m -= 12;
          while (vocMed - m > 9) m += 12;
        }
        merged[b].push({ ...x, midi: m });
      }
      merged[b].sort((p, q) => p.step - q.step);
    }
  }
  let res = cleanMelody(merged, { grid });
  // 피아노로 듣기 좋은 높이: 가운데가 C4~C6 사이 (C5 근처)
  const all = res.flat();
  if (all.length) {
    const med = median(all.map((x) => x.midi));
    const shift = 12 * Math.round((70 - med) / 12);
    for (const x of all) x.midi = Math.max(48, Math.min(90, x.midi + shift));
  }
  const found = all.length;
  // ④ 베이스 (반주의 맨 아래 줄 → 맵 low, 게임이 자동 베이스 대신 이걸 침)
  let low = null;
  try {
    if (inst) low = bassLine(inst, firstBeat, bpm, bars);
  } catch (e) {
    low = null;
  }
  // ② 화음 (반주에서)
  let prog = null;
  try {
    prog = detectChords(accM, sr, { firstBeat, bpm, bars, melody: merged, inst, low });
  } catch (e) {
    prog = null;
  }
  // ③ 드럼 (곡의 쿵·짝)
  let drums = null;
  try {
    // 같은 줄 8분 안 두 번(쿵쿵·짝짝)은 마디에 한 번까지 (2026-11-25 사용자 '있어도 되는데 너무 자주')
    drums = tidyDrums(songChart(accM, sr, { firstBeat, bpm, bars, diff: 'normal' }).bars, 1);
  } catch (e) {
    drums = null;
  }
  return { bars: res, found, prog, drums, low, vocalShare: vocCount / total, leadShare: leadCount / total, vocalRatio };
}

/**
 * 🎸 Basic Pitch 결과 → 베이스 줄 (2026-11-28 사용자 '반주 소리도 싹 다')
 *   16분 칸마다 C1~G3 에서 꽤 센 음 중 가장 낮은 음. 사이드체인·짧은 끊김(한 칸)은 이어 붙이고, 외톨이 한 칸은 지움.
 *   높이는 한 옥타브(E2~D#3) 안으로 접음 — 옥타브 착각 없이 피아노 왼손으로 또렷하게. 같은 음 다시 치기는 8분 자리만.
 *   베이스가 거의 없으면(칸 15% 미만) null
 */
export function bassLine(inst, firstBeat, bpm, bars) {
  const { note, onset, frames, fps } = inst;
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  const K0 = 24 - 21; // C1
  const K1 = 55 - 21; // G3
  let gmax = 0;
  for (let f = 0; f < frames; f++) for (let k = K0; k <= K1; k++) gmax = Math.max(gmax, note[f * 88 + k]);
  if (gmax < 0.2) return null;
  const TH = Math.max(0.18, gmax * 0.3);
  const pick = new Int16Array(total).fill(-1);
  const hit = new Uint8Array(total);
  const act = new Float32Array(88);
  for (let s = 0; s < total; s++) {
    const f0 = Math.max(0, Math.round((firstBeat + (s + 0.1) * st) * fps));
    const f1 = Math.min(frames, Math.round((firstBeat + (s + 0.9) * st) * fps) + 1);
    if (f1 <= f0) continue;
    act.fill(0);
    for (let f = f0; f < f1; f++) for (let k = K0; k <= K1; k++) act[k] += note[f * 88 + k];
    let mx = 0;
    for (let k = K0; k <= K1; k++) (act[k] /= f1 - f0), (mx = Math.max(mx, act[k]));
    if (mx < TH) continue;
    let best = -1;
    for (let k = K0; k <= K1; k++)
      if (act[k] >= Math.max(TH, mx * 0.5)) {
        best = k;
        break;
      }
    // 바로 위 옥타브가 훨씬 세면(낮은 쪽은 배음 착각) 위 것
    if (best + 12 <= K1 && act[best + 12] > act[best] * 1.6) best += 12;
    pick[s] = best;
    const c = Math.round((firstBeat + s * st) * fps);
    let on = 0;
    for (let f = Math.max(0, c - 2); f <= Math.min(frames - 1, c + 3); f++) on = Math.max(on, onset[f * 88 + best]);
    hit[s] = on > 0.35 ? 1 : 0;
  }
  // 높이: 한 옥타브(E2~D#3) 안으로 접음 → 옥타브 착각·오르내림 없이 피아노 왼손으로 또렷하게
  for (let s = 0; s < total; s++) if (pick[s] >= 0) pick[s] = 40 + ((((pick[s] + 21 - 40) % 12) + 12) % 12);
  // 한 칸 끊김(사이드체인 '우웅')은 앞뒤 같은 음이면 이어 붙임
  for (let s = 1; s < total - 1; s++) if (pick[s] < 0 && pick[s - 1] >= 0 && pick[s - 1] === pick[s + 1] && !hit[s + 1]) pick[s] = pick[s - 1];
  let used = 0;
  for (const p of pick) if (p >= 0) used++;
  if (used < total * 0.15) return null;
  const out = Array.from({ length: bars }, () => []);
  let cur = null;
  for (let s = 0; s < total; s++) {
    const p = pick[s];
    const step = s % STEPS_PER_BAR;
    if (p < 0) {
      cur = null;
      continue;
    }
    const midi = p;
    // 같은 음 다시 치기는 8분 자리에서만 (16분마다 '둥둥둥'은 피아노로 지저분)
    if (!cur || cur.midi !== midi || step === 0 || (hit[s] && step % 2 === 0)) {
      cur = { step, midi, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
    } else cur.len++;
  }
  for (const bar of out)
    for (let i = bar.length - 1; i >= 0; i--) {
      const n = bar[i];
      if (n.len === 1 && !(bar[i - 1] && bar[i - 1].step + bar[i - 1].len === n.step) && !(bar[i + 1] && bar[i + 1].step === n.step + 1)) bar.splice(i, 1);
    }
  return out;
}

/**
 * Basic Pitch 결과 → 악기 멜로디 (16분 칸마다 '위쪽 줄': 울리는 음 중 가장 높은 음, 베이스 위에 아무것도 없으면 베이스)
 *   gaps 안의 칸만. 같은 음이 이어져도 그 건반의 '막 시작' 확률이 높으면 새 음
 */
function instLine(inst, gaps, firstBeat, bpm, bars) {
  const { note, onset, frames, fps } = inst;
  const st = 60 / bpm / 4;
  const total = bars * STEPS_PER_BAR;
  const want = new Uint8Array(total);
  for (const [a, b] of gaps) for (let s = a; s < b; s++) want[s] = 1;
  const pick = new Int16Array(total).fill(-1);
  const hit = new Uint8Array(total);
  const act = new Float32Array(88);
  // 문턱: 곡에서 가장 또렷한 음의 30% (0.15~0.3) — 베이스·비트뿐인 곡도 뭔가는 따게
  let gmax = 0;
  for (let i = 0; i < note.length; i++) if (note[i] > gmax) gmax = note[i];
  const TH = Math.max(0.15, Math.min(0.3, gmax * 0.3));
  for (let s = 0; s < total; s++) {
    if (!want[s]) continue;
    const f0 = Math.max(0, Math.round((firstBeat + (s + 0.15) * st) * fps));
    const f1 = Math.min(frames, Math.round((firstBeat + (s + 0.9) * st) * fps) + 1);
    if (f1 <= f0) continue;
    act.fill(0);
    for (let f = f0; f < f1; f++) for (let k = 0; k < 88; k++) act[k] += note[f * 88 + k];
    let mx = 0;
    for (let k = 0; k < 88; k++) (act[k] /= f1 - f0), (mx = Math.max(mx, act[k]));
    if (mx < TH) continue;
    // 위쪽 줄: 꽤 센 음 중 가장 높은 음 (C3 위). 없으면 가장 센 음(베이스 줄)
    let best = -1;
    for (let k = 87; k >= 48 - 21; k--)
      if (act[k] >= Math.max(TH, mx * 0.45)) {
        best = k;
        break;
      }
    if (best < 0) for (let k = 0; k < 88; k++) if (act[k] === mx) best = k;
    pick[s] = best + 21;
    // 그 건반이 칸 시작 근처에서 막 울리기 시작했나
    const c = Math.round((firstBeat + s * st) * fps);
    let on = 0;
    for (let f = Math.max(0, c - 2); f <= Math.min(frames - 1, c + 3); f++) on = Math.max(on, onset[f * 88 + best]);
    hit[s] = on > 0.4 ? 1 : 0;
  }
  const out = Array.from({ length: bars }, () => []);
  let cur = null;
  for (let s = 0; s < total; s++) {
    const p = pick[s];
    const step = s % STEPS_PER_BAR;
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || cur.midi !== p || hit[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
    } else cur.len++;
  }
  // 16분 한 칸짜리 외톨이(앞뒤가 비었거나 다른 음)는 잡음일 때가 많아 지움
  for (const bar of out)
    for (let i = bar.length - 1; i >= 0; i--) {
      const n = bar[i];
      if (n.len === 1 && !(bar[i - 1] && bar[i - 1].step + bar[i - 1].len === n.step) && !(bar[i + 1] && bar[i + 1].step === n.step + 1)) bar.splice(i, 1);
    }
  return out;
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}
