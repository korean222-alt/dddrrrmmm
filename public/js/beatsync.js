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
