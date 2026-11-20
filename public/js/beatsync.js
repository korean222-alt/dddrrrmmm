// 🎧 박자 맞추기용 노래 분석 (운영자 전용, 이 폰 안에서만. 파일은 어디에도 안 올림)
//   노래 파일의 하이라이트 부분에서 BPM 과 박 위치(첫 박)를 찾아서, 드럼 채보가 노래 박에 딱 붙게 함.
//   방법: 10ms 마다 소리 세기가 '확 커지는 정도'(온셋) → 박 간격별로 겹쳐 보며 가장 잘 맞는 BPM·위치 고르기.
//   쿵(킥)·짝(스네어) 구분: 낮은 소리가 센 박을 1·3박(쿵)으로.

const HOP = 0.01; // 10ms

/** 구간의 온셋 세기 (전체 소리 + 낮은 소리) */
function onsetEnvelope(samples, sr, start, dur) {
  const hop = Math.max(1, Math.round(sr * HOP));
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(samples.length, Math.floor((start + dur) * sr));
  const n = Math.max(0, Math.floor((s1 - s0) / hop));
  const all = new Float32Array(n);
  const low = new Float32Array(n);
  // 한 극 저역 필터(~150Hz)로 킥 소리만 따로
  const a = Math.exp((-2 * Math.PI * 150) / sr);
  let lp = 0;
  let prevE = 0;
  let prevL = 0;
  for (let f = 0; f < n; f++) {
    let e = 0;
    let l = 0;
    const base = s0 + f * hop;
    for (let i = 0; i < hop; i++) {
      const x = samples[base + i];
      lp = (1 - a) * x + a * lp;
      e += x * x;
      l += lp * lp;
    }
    const le = Math.log(1e-9 + e / hop);
    const ll = Math.log(1e-9 + l / hop);
    all[f] = Math.max(0, le - prevE);
    low[f] = l / hop; // 낮은 소리 세기 그대로 (쿵·짝 구분용)
    prevE = le;
    prevL = ll;
  }
  // 살짝 뭉개서(3칸) 박 위치를 칸 사이까지 읽을 수 있게
  const sm = new Float32Array(n);
  for (let f = 0; f < n; f++) sm[f] = 0.25 * (all[f - 1] || 0) + 0.5 * all[f] + 0.25 * (all[f + 1] || 0);
  return { all: sm, low, hopSec: hop / sr };
}

/** 박 간격 period(프레임, 소수 가능)·위치 phase 로 겹친 세기 (박 beats 개만 → 빠르기마다 공평하게) */
function combScore(env, period, phase, beats) {
  let s = 0;
  for (let k = 0; k < beats; k++) {
    const t = phase + k * period;
    const i = Math.floor(t);
    const fr = t - i;
    s += (env[i] || 0) * (1 - fr) + (env[i + 1] || 0) * fr;
  }
  return s / beats;
}

function bestPhase(env, period, beats = Math.floor((env.length - 2) / period) - 1) {
  let best = 0;
  let bestS = -1;
  for (let p = 0; p < period; p += 0.25) {
    const s = combScore(env, period, p, beats);
    if (s > bestS) {
      bestS = s;
      best = p;
    }
  }
  return { phase: best, score: bestS };
}

/**
 * samples: 모노 Float32Array, sr: 샘플레이트, start: 하이라이트 시작(초)
 * hintBpm 을 주면 그 근처(±4%)에서만 찾음 (탭으로 잰 값·직접 쓴 값)
 * → { bpm, firstBeat(초, start 이후 첫 '쿵' 박), confidence 0~1 }
 */
export function detectBeat(samples, sr, { start = 0, dur = 24, hintBpm = null } = {}) {
  const { all, low, hopSec: H } = onsetEnvelope(samples, sr, start, dur);
  if (all.length < 300) return null;
  // 1) BPM: 0.5 BPM 단위로 훑고 → 0.05 단위로 다듬기
  const lo = hintBpm ? hintBpm * 0.96 : 70;
  const hi = hintBpm ? hintBpm * 1.04 : 190;
  // 가장 느린 빠르기로도 다 들어가는 박 수로 통일
  const beats = Math.floor((all.length - 2) / (60 / lo / H)) - 1;
  const scoreAt = (bpm) => bestPhase(all, 60 / bpm / H, beats).score;
  let best = lo;
  let bestS = -1;
  const scores = [];
  for (let b = lo; b <= hi; b += 0.5) {
    const s = scoreAt(b);
    scores.push(s);
    if (s > bestS) {
      bestS = s;
      best = b;
    }
  }
  for (let b = best - 0.5; b <= best + 0.5; b += 0.02) {
    const s = scoreAt(b);
    if (s > bestS) {
      bestS = s;
      best = b;
    }
  }
  // 힌트 없이 찾았으면: 절반 빠르기도 거의 같은 점수면(반 박마다 소리가 있는 곡) 사람들이 세는 쪽으로 — 그대로 둠.
  //   두 배 빠르기 쪽이 훨씬 잘 맞으면 그쪽 (드럼이 반 박씩 어긋나는 걸 막음)
  if (!hintBpm && best * 2 <= 200 && scoreAt(best * 2) > bestS * 1.15) best *= 2;
  const bpm = Math.round(best * 100) / 100;
  const period = 60 / bpm / H;
  const { phase } = bestPhase(all, period, Math.floor((all.length - 2) / period) - 1);
  // 2) 쿵(1·3박) 찾기: 짝수 박 / 홀수 박 중 낮은 소리가 더 센 쪽
  const lowAt = (k) => {
    let s = 0;
    for (let t = phase + k * period; t < low.length - 6; t += period * 2) for (let i = 0; i < 6; i++) s += low[Math.floor(t) + i];
    return s;
  };
  const kickShift = lowAt(1) > lowAt(0) * 1.05 ? 1 : 0;
  const firstBeat = start + (phase + kickShift * period) * H;
  // 믿을 만한가: 맞는 BPM 점수가 평균보다 얼마나 튀나
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const confidence = Math.max(0, Math.min(1, (bestS / (mean || 1) - 1) / 1.5));
  return { bpm, firstBeat, confidence };
}

/** AudioBuffer → 모노 */
export function monoOf(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const a = buf.getChannelData(0);
  const b = buf.getChannelData(1);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
  return out;
}

// ---------------------------------------------------------------
// 🥁 노래 따라 채보: 노래 소리를 16분음표 칸마다 읽어서 드럼 채보를 만듦
//   낮은 소리가 '확' 커지는 칸 → 쿵(K), 높은 소리 → 짝(S)/하이햇(H), 둘 다 → 동시에(B),
//   곡에서 가장 센 순간(정박) → 크래시+스네어 '팡'(X, 쉬움은 B)
//   엄지 규칙: 붙은 칸(16분)에 같은 엄지 금지, 140 BPM 넘으면 붙은 칸 자체 금지
// ---------------------------------------------------------------
const THUMB = { K: 'L', C: 'L', T: 'L', S: 'R', H: 'R', B: 'LR', X: 'LR', J: 'LR', Y: 'LR' };
const clash = (a, b) => !!THUMB[a] && !!THUMB[b] && [...THUMB[a]].some((h) => THUMB[b].includes(h));

/** 소리 세기 '확 커짐' 을 세 갈래(낮은·높은·전체)로, 10ms 단위 */
function bandFlux(samples, sr, start, dur) {
  const hop = Math.max(1, Math.round(sr * 0.01));
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(samples.length, Math.floor((start + dur) * sr));
  const n = Math.max(0, Math.floor((s1 - s0) / hop));
  const low = new Float32Array(n);
  const high = new Float32Array(n);
  const all = new Float32Array(n);
  const loud = new Float32Array(n);
  const aL = Math.exp((-2 * Math.PI * 150) / sr);
  const aH = Math.exp((-2 * Math.PI * 2500) / sr);
  let lp = 0;
  let lp2 = 0;
  let pL = 0;
  let pH = 0;
  let pA = 0;
  for (let f = 0; f < n; f++) {
    let eL = 0;
    let eH = 0;
    let eA = 0;
    const base = s0 + f * hop;
    for (let i = 0; i < hop; i++) {
      const x = samples[base + i];
      lp = (1 - aL) * x + aL * lp;
      lp2 = (1 - aH) * x + aH * lp2;
      const hp = x - lp2; // 2.5kHz 위 (스네어·하이햇·심벌)
      eL += lp * lp;
      eH += hp * hp;
      eA += x * x;
    }
    const lL = Math.log(1e-9 + eL / hop);
    const lH = Math.log(1e-9 + eH / hop);
    const lA = Math.log(1e-9 + eA / hop);
    // 세기도 같이 봄 (아주 작은 소리의 '확' 은 무시)
    low[f] = Math.max(0, lL - pL) * Math.sqrt(eL / hop);
    high[f] = Math.max(0, lH - pH) * Math.sqrt(eH / hop);
    all[f] = Math.max(0, lA - pA) * Math.sqrt(eA / hop);
    loud[f] = Math.sqrt(eA / hop);
    pL = lL;
    pH = lH;
    pA = lA;
  }
  return { low, high, all, loud, hopSec: hop / sr, n };
}

const DIFF_RULES = {
  easy: { perBar: 4, grid: 4, chars: 'KSB', accent: 'B', beatBonus: 0.5 }, // 쉬움: 정박(4분)에만
  normal: { perBar: 6, grid: 2, chars: 'KSHBJ', accent: 'X', beatBonus: 0.3 },
  hard: { perBar: 9, grid: 1, chars: 'KSHBJ', accent: 'X', beatBonus: 0.2 },
};

/**
 * 노래 따라 채보. samples·sr = 노래(화면 녹화) 소리, firstBeat = 채보 첫 칸의 노래 시각, bars = 마디 수
 * → { bars: ['K...S...', …], covered: 소리가 있는 마디 수 }
 *   소리가 끝난 뒤 마디는 기본 쿵짝으로 채움
 */
export function songChart(samples, sr, { firstBeat, bpm, bars, diff = 'easy' }) {
  const rule = DIFF_RULES[diff] || DIFF_RULES.easy;
  const fast = bpm > 140;
  const stepSec = 60 / bpm / 4;
  const total = bars * 16;
  const { low, high, loud, hopSec, n } = bandFlux(samples, sr, firstBeat - 0.05, total * stepSec + 0.2);
  const at = (arr, t) => {
    // 칸 시각 ±20ms 안에서 가장 큰 값 (앞쪽 0.05초 여유를 둠)
    const c = Math.round((t + 0.05) / hopSec);
    let m = 0;
    for (let i = c - 2; i <= c + 2; i++) if (i >= 0 && i < n && arr[i] > m) m = arr[i];
    return m;
  };
  const L = new Float32Array(total);
  const Hh = new Float32Array(total);
  const A = new Float32Array(total);
  let covered = 0;
  for (let k = 0; k < total; k++) {
    const t = k * stepSec;
    if ((t + 0.05) / hopSec < n - 3) covered = Math.floor(k / 16) + 1;
    L[k] = at(low, t);
    Hh[k] = at(high, t);
    // '팡' 은 소리 크기로: 칸 시각부터 60ms 평균
    const c = Math.round((t + 0.05) / hopSec);
    let sum = 0;
    for (let i = c; i < c + 6 && i < n; i++) sum += loud[i] || 0;
    A[k] = sum / 6;
  }
  const pct = (arr, p) => {
    const v = Array.from(arr.slice(0, covered * 16)).filter((x) => x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 1;
  };
  const nL = pct(L, 0.9) || 1;
  const nH = pct(Hh, 0.9) || 1;
  // '팡': 곡에서 손꼽게 센 순간만 (가장 센 소리의 55% 이상 + 상위 3%)
  const maxA = Math.max(0, ...Array.from(A.slice(0, covered * 16)));
  const accentLine = Math.max(pct(A, 0.97), maxA * 0.55);
  const out = new Array(total).fill('.');
  for (let b = 0; b < covered; b++) {
    const cands = [];
    for (let s = 0; s < 16; s += rule.grid) {
      const k = b * 16 + s;
      const lo = Math.min(1.5, L[k] / nL);
      const hi = Math.min(1.5, Hh[k] / nH);
      // 정박일수록 조금 더 (마디 첫 박·셋째 박은 쿵 자리)
      const pos = s % 4 === 0 ? rule.beatBonus : s % 2 === 0 ? 0 : -0.15;
      let ch;
      if (A[k] >= accentLine && s % 4 === 0) ch = rule.accent;
      else if (lo > 0.55 && hi > 0.55 && rule.chars.includes('B') && s % 4 === 0) ch = 'B';
      else if (lo >= hi) ch = 'K';
      else ch = rule.chars.includes('H') && s % 4 !== 0 && hi < 0.8 ? 'H' : 'S';
      const score = Math.max(lo, hi) + pos + (ch === rule.accent ? 1 : 0) + ((s === 0 || s === 8) && ch === 'K' ? 0.2 : 0);
      if (Math.max(lo, hi) > 0.12 || ch === rule.accent) cands.push({ k, ch, score });
    }
    cands.sort((x, y) => y.score - x.score);
    let placed = 0;
    for (const c of cands) {
      if (placed >= rule.perBar) break;
      const prev = out[c.k - 1];
      const next = out[c.k + 1];
      if (fast && ((prev && prev !== '.') || (next && next !== '.'))) continue;
      if (clash(prev, c.ch) || clash(next, c.ch)) continue;
      out[c.k] = c.ch;
      placed++;
    }
    // 너무 비면(조용한 마디) 첫 박 쿵·셋째 박 짝 정도는 넣음
    const base = b * 16;
    if (placed < 2) {
      if (out[base] === '.' && !clash(out[base - 1], 'K') && !clash(out[base + 1], 'K')) out[base] = 'K';
      if (out[base + 4] === '.' && !clash(out[base + 3], 'S') && !clash(out[base + 5], 'S')) out[base + 4] = 'S';
      if (out[base + 12] === '.' && !clash(out[base + 11], 'S') && !clash(out[base + 13], 'S')) out[base + 12] = 'S';
    }
  }
  // 소리가 끝난 마디: 기본 쿵짝
  for (let b = covered; b < bars; b++) {
    const bar = 'K...S...K...S...';
    for (let s = 0; s < 16; s++) out[b * 16 + s] = bar[s];
    if (clash(out[b * 16 - 1], 'K')) out[b * 16 - 1] = '.';
  }
  const res = [];
  for (let b = 0; b < bars; b++) res.push(out.slice(b * 16, b * 16 + 16).join(''));
  return { bars: res, covered: Math.min(covered, bars) };
}
