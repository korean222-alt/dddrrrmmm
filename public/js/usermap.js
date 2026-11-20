// 🌍 유저 맵 (브라우저와 서버가 같이 씀)
//   유저가 피아노로 멜로디를 찍고(또는 노래 파일에서 음을 따서) 드럼 채보를 붙여 올리는 맵.
//   올라가는 건 음표 데이터뿐 (노래 파일은 폰 밖으로 안 나감). 서버는 cleanMap 으로 검사해서 저장.
//
//   맵 모양: { name, bpm, bars: ['K...S...', …], melody: ['C5 E5:2 _:2 …', …], prog: ['C', 'F G', …] }
//     bars = 드럼 채보(charts.js 표기), melody = 마디별 멜로디(charts.js 표기), prog = 마디별 코드(자동)

import { STEPS_PER_BAR, parseMelody, parseChord, CHAR_LANES, KICK, SNARE, HAT, CRASH } from './charts.js';

export const MAP_LIMITS = { minBars: 2, maxBars: 64, minBpm: 60, maxBpm: 180, nameMax: 30, minNotes: 8 };
const DRUM_RE = /^[KSHCBJX.]{16}$/;
const LOW = 36; // C2
const HIGH = 96; // C7

// ---------- 음이름 ----------
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
/** 한국식 계이름 (건반 글자) */
export const SOLFA = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

// ---------- 멜로디: 마디별 음표 배열 ↔ 문자열 ----------
/** [{ step, midi, len }] (한 마디) → 'C5:2 _:2 E5:4 …' (빈 칸은 쉼) */
export function barToMelody(notes) {
  const out = [];
  let at = 0;
  for (const n of [...notes].sort((a, b) => a.step - b.step)) {
    if (n.step < at) continue;
    if (n.step > at) out.push(`_:${n.step - at}`);
    const len = Math.max(1, Math.min(n.len, STEPS_PER_BAR - n.step));
    out.push(`${midiName(n.midi)}:${len}`);
    at = n.step + len;
  }
  if (at < STEPS_PER_BAR) out.push(`_:${STEPS_PER_BAR - at}`);
  return out.join(' ');
}
/** 멜로디 문자열 배열 → 마디별 음표 배열 */
export function melodyToBars(melody) {
  const bars = melody.map(() => []);
  for (const n of parseMelody(melody)) bars[n.bar].push({ step: n.step, midi: n.midi, len: n.len });
  return bars;
}

// ---------- 드럼 칸: 글자 ↔ 악기 ----------
/** 채보 글자 → { K, S, H, C } 켜짐 */
export function drumCell(ch) {
  const lanes = CHAR_LANES[ch] || [];
  return { K: lanes.includes(KICK), S: lanes.includes(SNARE), H: lanes.includes(HAT), C: lanes.includes(CRASH) };
}
/**
 * 악기 켜짐 → 글자. 같은 엄지(킥·크래시 / 스네어·하이햇)는 동시에 못 쳐서 하나만.
 *   크래시+하이햇은 글자가 없어서 크래시만
 */
export function cellChar({ K, S, H, C }) {
  const left = C ? 'C' : K ? 'K' : '';
  const right = S ? 'S' : H ? 'H' : '';
  if (left === 'K' && right === 'S') return 'B';
  if (left === 'K' && right === 'H') return 'J';
  if (left === 'C' && right === 'S') return 'X';
  if (left === 'C') return 'C';
  return left || right || '.';
}
/** 칸에서 악기 하나 켜기/끄기 (같은 엄지 악기는 꺼짐) */
export function toggleDrum(ch, inst) {
  const c = drumCell(ch);
  const on = !c[inst];
  if (on) {
    if (inst === 'K') c.C = false;
    if (inst === 'C') (c.K = false), (c.H = false);
    if (inst === 'S') c.H = false;
    if (inst === 'H') (c.S = false), (c.C = false);
  }
  c[inst] = on;
  return cellChar(c);
}

// ---------- 화음 자동 ----------
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
/** 멜로디 전체에서 가장 그럴듯한 장조 으뜸음 (0 = C) */
export function guessKey(bars) {
  const w = new Array(12).fill(0);
  for (const bar of bars) for (const n of bar) w[n.midi % 12] += n.len;
  let best = 0;
  let bestScore = -Infinity;
  for (let k = 0; k < 12; k++) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += w[(i + k) % 12] * MAJOR_PROFILE[i];
    if (s > bestScore) (bestScore = s), (best = k);
  }
  return best;
}
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/**
 * 멜로디 → 마디별 코드 (반 마디씩). 그 조의 I·ii·iii·IV·V·vi 중 멜로디 음을 가장 많이 품는 것.
 *   비슷하면 I·IV·V, 그리고 앞 코드 유지를 좋아함. 멜로디가 없는 칸은 앞 코드 그대로
 */
export function harmonize(bars) {
  const key = guessKey(bars);
  const degrees = [
    [0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'],
  ].map(([d, q], i) => {
    const root = (key + d) % 12;
    const tones = [root, (root + (q ? 3 : 4)) % 12, (root + 7) % 12];
    return { name: KEY_NAMES[root] + q, tones, bonus: [0.3, 0, 0, 0.2, 0.25, 0.1][i] };
  });
  let prev = degrees[0];
  const prog = [];
  for (const bar of bars) {
    const halves = [];
    for (let h = 0; h < 2; h++) {
      const w = new Array(12).fill(0);
      let total = 0;
      for (const n of bar) {
        const a = Math.max(n.step, h * 8);
        const b = Math.min(n.step + n.len, h * 8 + 8);
        if (b <= a) continue;
        // 박 첫머리 음에 더 무게
        const weight = (b - a) * (n.step % 4 === 0 ? 1.5 : 1);
        w[n.midi % 12] += weight;
        total += weight;
      }
      if (!total) {
        halves.push(prev);
        continue;
      }
      let best = prev;
      let bestScore = -Infinity;
      for (const d of degrees) {
        let s = 0;
        for (let pc = 0; pc < 12; pc++) s += d.tones.includes(pc) ? w[pc] : -0.6 * w[pc];
        s = s / total + d.bonus + (d === prev ? 0.15 : 0);
        if (s > bestScore) (bestScore = s), (best = d);
      }
      halves.push(best);
      prev = best;
    }
    prog.push(halves[0] === halves[1] ? halves[0].name : `${halves[0].name} ${halves[1].name}`);
  }
  return prog;
}

// ---------- 드럼 자동 ----------
/**
 * 멜로디에 맞춘 드럼 채보 (쉬움 · 보통 · 어려움)
 *   쉬움: 쿵(1·3박) 짝(2·4박) / 보통: + 멜로디가 8분 자리에서 시작하면 쿵·짝 / 어려움: + 하이햇 8분, 8마디마다 크래시
 *   멜로디가 쉬는 마디는 단순하게
 */
export function autoDrums(bars, diff = 'normal') {
  return bars.map((bar, b) => {
    const cells = new Array(STEPS_PER_BAR).fill('.');
    const on = (s, inst) => (cells[s] = cellChar({ ...drumCell(cells[s]), [inst]: true }));
    on(0, 'K');
    on(8, 'K');
    on(4, 'S');
    on(12, 'S');
    if (diff !== 'easy') {
      for (const n of bar) {
        if (n.step % 2) continue;
        if (n.step % 4 === 0) continue; // 정박은 이미 있음
        // 8분 엇박: 앞 박이 쿵이면 짝, 짝이면 쿵 (번갈아)
        const prevBeat = Math.floor(n.step / 4) % 2;
        on(n.step, prevBeat ? 'K' : 'S');
      }
    }
    if (diff === 'hard') {
      for (let s = 0; s < STEPS_PER_BAR; s += 2) if (cells[s] === '.' || cells[s] === 'K') on(s, 'H');
      for (const n of bar) if (n.step % 2 && n.len >= 2) on(n.step, 'H');
      if (b % 8 === 0) cells[0] = 'X';
    } else if (diff === 'normal' && b % 8 === 0 && b > 0) cells[0] = 'X';
    return cells.join('');
  });
}

// ---------- 검사 (서버가 저장 전에) ----------
/** 맵 하나 검사 → 깨끗한 맵 (이상하면 null) */
export function cleanMap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (![...name].length || [...name].length > MAP_LIMITS.nameMax) return null;
  const bpm = Math.round(Number(raw.bpm) * 10) / 10;
  if (!(bpm >= MAP_LIMITS.minBpm && bpm <= MAP_LIMITS.maxBpm)) return null;
  const bars = raw.bars;
  if (!Array.isArray(bars) || bars.length < MAP_LIMITS.minBars || bars.length > MAP_LIMITS.maxBars) return null;
  if (!bars.every((b) => typeof b === 'string' && DRUM_RE.test(b))) return null;
  let notes = 0;
  for (const b of bars) for (const c of b) notes += (CHAR_LANES[c] || []).length;
  if (notes < MAP_LIMITS.minNotes) return null;
  const melody = raw.melody;
  if (!Array.isArray(melody) || melody.length !== bars.length || !melody.every((m) => typeof m === 'string' && m.length <= 200)) return null;
  try {
    for (const n of parseMelody(melody)) if (n.midi < LOW || n.midi > HIGH) return null;
  } catch {
    return null;
  }
  const prog = raw.prog;
  if (!Array.isArray(prog) || prog.length !== bars.length) return null;
  try {
    for (const p of prog) {
      const parts = String(p).trim().split(/\s+/);
      if (parts.length < 1 || parts.length > 2) return null;
      parts.forEach(parseChord);
    }
  } catch {
    return null;
  }
  return { name, bpm, bars: [...bars], melody: melody.map((m) => m.trim().replace(/\s+/g, ' ')), prog: prog.map((p) => String(p).trim().replace(/\s+/g, ' ')) };
}

/** 노트 수로 어림한 난이도 1~5 (초당 노트) */
export function mapDifficulty(map) {
  let notes = 0;
  for (const b of map.bars) for (const c of b) if (c !== '.') notes++;
  const sec = (map.bars.length * 4 * 60) / map.bpm;
  const nps = notes / sec;
  return nps < 1.6 ? 1 : nps < 2.4 ? 2 : nps < 3.4 ? 3 : nps < 4.6 ? 4 : 5;
}

const THEME_KEYS = ['sunset', 'city', 'hall', 'aurora', 'void', 'space', 'lava'];
/** 맵 → 게임 단계 */
export function mapLevel(map, { id = 'um', by = '', mapId = null } = {}) {
  let h = 0;
  for (const ch of String(mapId || map.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id,
    custom: true,
    userMap: true,
    mapId,
    name: map.name,
    composer: by ? `${by} 님 맵` : '유저 맵',
    songName: map.name,
    tagline: '',
    theme: THEME_KEYS[h % THEME_KEYS.length],
    difficulty: mapDifficulty(map),
    bpm: map.bpm,
    bars: map.bars,
    song: {
      prog: map.prog,
      melody: map.melody,
      hat: '................',
      bass: 'x.......x.......',
      chord: 'x.......x.......',
    },
  };
}

// ---------- 🎙 노래 파일에서 멜로디 따기 (초안) ----------
//   16분 칸마다 소리의 주파수를 보고(배음 더하기) 가장 센 음 하나를 고름 → 같은 음이 이어지면 한 음으로.
//   반주가 꽉 찬 노래는 지저분하게 나와서, 만든 뒤 손으로 다듬는 용도

/** 제자리 FFT (re, im 길이 2의 거듭제곱) */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * 노래(모노) → 마디별 멜로디 음표 초안
 * @param {Float32Array} mono
 * @param {number} sr
 * @param {{ firstBeat: number, bpm: number, bars: number, lo?: number, hi?: number }} o
 * @returns {{ bars: Array<Array<{step,midi,len}>>, found: number }}
 */
export function transcribe(mono, sr, { firstBeat, bpm, bars, lo = 55, hi = 84 }) {
  const N = 4096;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const stepSec = 60 / bpm / 4;
  const steps = bars * STEPS_PER_BAR;
  const binHz = sr / N;
  const cand = [];
  for (let m = lo; m <= hi; m++) cand.push(m);
  const pitch = new Int16Array(steps).fill(-1);
  const sal = new Float32Array(steps);
  const energy = new Float32Array(steps);
  const mag = new Float32Array(N / 2);
  for (let s = 0; s < steps; s++) {
    // 칸 시작 조금 뒤(음이 울리는 중)를 가운데로
    const c = Math.round((firstBeat + s * stepSec + stepSec * 0.4) * sr);
    const a = c - N / 2;
    if (a < 0 || a + N > mono.length) continue;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = mono[a + i];
      e += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    energy[s] = Math.sqrt(e / N);
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    let best = -1;
    let bestV = 0;
    let sum = 0;
    for (const m of cand) {
      const f0 = 440 * Math.pow(2, (m - 69) / 12);
      let v = 0;
      for (let h = 1; h <= 5; h++) {
        const k = Math.round((f0 * h) / binHz);
        if (k + 1 >= N / 2) break;
        v += Math.pow(0.8, h - 1) * Math.max(mag[k - 1], mag[k], mag[k + 1]);
      }
      // 아래 옥타브 배음에 속지 않게: 반 주파수 자리에도 힘이 크면 깎음
      const kh = Math.round(f0 / 2 / binHz);
      if (kh > 1) v -= 0.3 * Math.max(mag[kh - 1], mag[kh], mag[kh + 1]);
      sum += v;
      if (v > bestV) (bestV = v), (best = m);
    }
    const mean = sum / cand.length;
    if (best >= 0 && mean > 0 && bestV / mean > 1.9) {
      pitch[s] = best;
      sal[s] = bestV / mean;
    }
  }
  // 조용한 칸은 쉼 (가장 큰 소리의 12% 아래)
  let maxE = 0;
  for (let s = 0; s < steps; s++) if (energy[s] > maxE) maxE = energy[s];
  for (let s = 0; s < steps; s++) if (energy[s] < maxE * 0.12) pitch[s] = -1;
  // 한 칸짜리 튐 정리: 앞뒤가 같은 음이면 가운데도 그 음 (옥타브 튐도)
  for (let s = 1; s < steps - 1; s++) {
    const p = pitch[s - 1];
    if (p >= 0 && p === pitch[s + 1] && pitch[s] !== p && (pitch[s] < 0 || Math.abs(pitch[s] - p) === 12 || sal[s] < 2.4)) pitch[s] = p;
  }
  // 같은 음을 다시 쳤나: 짧은 창(약 23ms)으로 칸 시작 바로 전과 바로 뒤의 그 음 세기를 비교
  const N2 = 1 << Math.round(Math.log2(sr * 0.023)); // 약 23ms (44.1kHz 면 1024)
  const win2 = new Float32Array(N2);
  for (let i = 0; i < N2; i++) win2[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N2 - 1));
  const re2 = new Float64Array(N2);
  const im2 = new Float64Array(N2);
  const pitchMag = (sec, m) => {
    const a = Math.round(sec * sr) - N2 / 2;
    if (a < 0 || a + N2 > mono.length) return 0;
    for (let i = 0; i < N2; i++) (re2[i] = mono[a + i] * win2[i]), (im2[i] = 0);
    fft(re2, im2);
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    let v = 0;
    for (let h = 1; h <= 3; h++) {
      const k = Math.round((f0 * h * N2) / sr);
      if (k + 1 >= N2 / 2) break;
      for (let j = k - 1; j <= k + 1; j++) v += Math.hypot(re2[j], im2[j]);
    }
    return v;
  };
  const pitchOnset = (s, m) => {
    const t = firstBeat + s * stepSec;
    const before = pitchMag(t - 0.03, m);
    const after = pitchMag(t + Math.min(0.05, stepSec * 0.4), m);
    return after > before * 1.5 + 1e-6;
  };
  // 새 음 시작: 음이 바뀌거나, 같은 음이어도 그 음이 다시 세지면(다시 침)
  const out = Array.from({ length: bars }, () => []);
  let found = 0;
  let cur = null;
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / STEPS_PER_BAR);
    const step = s % STEPS_PER_BAR;
    const p = pitch[s];
    const reHit = cur && p === cur.midi && s > 0 && pitchOnset(s, p);
    if (p < 0) {
      cur = null;
      continue;
    }
    if (!cur || p !== cur.midi || reHit || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[bar].push(cur);
      found++;
    } else cur.len++;
  }
  // 16분 한 칸짜리가 너무 많으면 지저분 → 앞 음과 반음 차이 나는 외톨이 한 칸은 지움
  for (const bar of out) {
    for (let i = bar.length - 1; i >= 0; i--) {
      const n = bar[i];
      if (n.len === 1) {
        const prev = bar[i - 1];
        const next = bar[i + 1];
        const lonely = (!prev || prev.step + prev.len < n.step) && (!next || next.step > n.step + 1);
        if (lonely) {
          bar.splice(i, 1);
          found--;
        }
      }
    }
  }
  // 음역 정리: 가운데가 C5 근처가 되게 옥타브 이동
  const all = out.flat();
  if (all.length) {
    const sorted = all.map((n) => n.midi).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const shift = 12 * Math.round((72 - med) / 12);
    for (const n of all) n.midi = Math.max(48, Math.min(90, n.midi + shift));
  }
  return { bars: out, found };
}

/**
 * Basic Pitch 같은 음 목록 [{ startTimeSeconds, durationSeconds, pitchMidi, amplitude }] → 마디별 멜로디
 *   16분 칸마다 그때 울리는 음 중 '위쪽 줄'(멜로디는 보통 제일 높고 셈)을 고름: 센 음들 중 가장 높은 음
 * @returns {{ bars: Array<Array<{step,midi,len}>>, found: number }}
 */
export function notesToMelody(notes, { firstBeat, bpm, bars, lo = 52, hi = 88 }) {
  const stepSec = 60 / bpm / 4;
  const steps = bars * STEPS_PER_BAR;
  const ns = notes.filter((n) => n.pitchMidi >= lo && n.pitchMidi <= hi && n.durationSeconds >= stepSec * 0.6);
  let maxA = 0;
  for (const n of ns) maxA = Math.max(maxA, n.amplitude);
  const pick = new Int16Array(steps).fill(-1);
  const startAt = new Int8Array(steps);
  for (let s = 0; s < steps; s++) {
    const a = firstBeat + s * stepSec;
    const b = a + stepSec;
    let loudest = 0;
    const live = [];
    for (const n of ns) {
      const ov = Math.min(b, n.startTimeSeconds + n.durationSeconds) - Math.max(a, n.startTimeSeconds);
      if (ov < stepSec * 0.5) continue;
      live.push(n);
      loudest = Math.max(loudest, n.amplitude);
    }
    if (!live.length || loudest < maxA * 0.25) continue;
    let best = null;
    for (const n of live) if (n.amplitude >= loudest * 0.7 && (!best || n.pitchMidi > best.pitchMidi)) best = n;
    pick[s] = best.pitchMidi;
    // 이 칸 근처에서 시작한 음이면 새 음
    startAt[s] = Math.abs(best.startTimeSeconds - a) < stepSec * 0.6 ? 1 : 0;
  }
  const out = Array.from({ length: bars }, () => []);
  let found = 0;
  let cur = null;
  for (let s = 0; s < steps; s++) {
    const p = pick[s];
    if (p < 0) {
      cur = null;
      continue;
    }
    const step = s % STEPS_PER_BAR;
    if (!cur || cur.midi !== p || startAt[s] || step === 0) {
      cur = { step, midi: p, len: 1 };
      out[Math.floor(s / STEPS_PER_BAR)].push(cur);
      found++;
    } else cur.len++;
  }
  return { bars: out, found };
}

/**
 * 따 온 멜로디 정리 (듣기 좋게)
 *   1) 옥타브 튐: 앞뒤 음들보다 10반음 넘게 떨어진 음은 옥타브를 옮김
 *   2) grid=2 면 8분음표 칸마다 음 하나 (16분 부스러기가 없어짐)
 *   4) key=true 면 조에서 벗어난 음을 가까운 음계 음으로
 */
export function cleanMelody(bars, { grid = 2, key = true } = {}) {
  let all = [];
  bars.forEach((bar, b) => bar.forEach((n) => all.push({ at: b * STEPS_PER_BAR + n.step, midi: n.midi, len: n.len })));
  all.sort((a, b) => a.at - b.at);
  // 1) 옥타브 튐
  const orig = all.map((n) => n.midi);
  for (let i = 0; i < all.length; i++) {
    const near = orig.slice(Math.max(0, i - 4), i).concat(orig.slice(i + 1, i + 5)).sort((a, b) => a - b);
    if (near.length < 2) continue;
    const h = near.length / 2;
    const med = near.length % 2 ? near[Math.floor(h)] : (near[h - 1] + near[h]) / 2;
    while (all[i].midi - med > 9) all[i].midi -= 12;
    while (med - all[i].midi > 9) all[i].midi += 12;
  }
  // 2) grid=2: 8분 칸마다 음 하나. 칸 앞쪽 음을 쓰되, 앞쪽이 앞 음의 이어짐이고 뒤쪽에서 새 음이 시작하면 그 새 음
  if (grid > 1) {
    const total = bars.length * STEPS_PER_BAR;
    const pitch = new Int16Array(total).fill(-1);
    const onset = new Uint8Array(total);
    for (const n of all) {
      for (let i = 0; i < n.len && n.at + i < total; i++) pitch[n.at + i] = n.midi;
      onset[n.at] = 1;
    }
    const slots = [];
    for (let at = 0; at < total; at += grid) {
      let pick = -1;
      let hit = false;
      for (let i = 0; i < grid; i++) {
        const s2 = at + i;
        if (pitch[s2] < 0) continue;
        if (pick < 0 || (onset[s2] && !hit)) {
          if (pick >= 0 && !onset[s2]) continue;
          pick = pitch[s2];
          hit = hit || !!onset[s2];
        }
      }
      slots.push({ at, midi: pick, hit });
    }
    all = [];
    for (const sl of slots) {
      if (sl.midi < 0) continue;
      const prev = all[all.length - 1];
      if (prev && prev.midi === sl.midi && prev.at + prev.len === sl.at && !sl.hit) prev.len += grid;
      else all.push({ at: sl.at, midi: sl.midi, len: grid });
    }
  }
  // 1b) 앞뒤 음 둘 다보다 10반음 넘게 높거나 낮으면 옥타브 실수
  for (let i = 1; i < all.length - 1; i++) {
    const d1 = all[i].midi - all[i - 1].midi;
    const d2 = all[i].midi - all[i + 1].midi;
    if (d1 >= 10 && d2 >= 10) all[i].midi -= 12;
    else if (d1 <= -10 && d2 <= -10) all[i].midi += 12;
  }
  // 4) 조 맞추기
  if (key) {
    const k = guessKey([all.map((n) => ({ midi: n.midi, len: n.len, step: 0 }))]);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((d) => (k + d) % 12);
    const w = new Array(12).fill(0);
    for (const n of all) w[n.midi % 12] += n.len;
    for (const n of all) {
      const pc = n.midi % 12;
      // 음계 밖인데 자주 안 나오는 음만 (곡에 많이 나오면 일부러 쓴 음)
      if (scale.includes(pc) || w[pc] > all.reduce((a, x) => a + x.len, 0) * 0.08) continue;
      n.midi += scale.includes((pc + 1) % 12) && (w[(pc + 1) % 12] >= w[(pc + 11) % 12] || !scale.includes((pc + 11) % 12)) ? 1 : -1;
    }
  }
  // 마디로 다시 나눔 (마디를 넘는 음은 마디 끝에서 자름)
  const res = bars.map(() => []);
  for (const n of all) {
    const b = Math.floor(n.at / STEPS_PER_BAR);
    if (b >= res.length) continue;
    const step = n.at % STEPS_PER_BAR;
    res[b].push({ step, midi: n.midi, len: Math.max(1, Math.min(n.len, STEPS_PER_BAR - step)) });
  }
  return res;
}
