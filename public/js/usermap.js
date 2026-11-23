// 🌍 유저 맵 (브라우저와 서버가 같이 씀)
//   유저가 피아노로 멜로디를 찍고(또는 노래 파일에서 음을 따서) 드럼 채보를 붙여 올리는 맵.
//   올라가는 건 음표 데이터뿐 (노래 파일은 폰 밖으로 안 나감). 서버는 cleanMap 으로 검사해서 저장.
//
//   맵 모양: { name, bpm, bars: ['K...S...', …], melody: ['C5 E5:2 _:2 …', …], prog: ['C', 'F G', …] }
//     bars = 드럼 채보(charts.js 표기), melody = 마디별 멜로디(charts.js 표기), prog = 마디별 코드(자동)

import { STEPS_PER_BAR, parseMelody, parseChord, CHAR_LANES, KICK, SNARE, HAT, CRASH } from './charts.js';
import { DECO_THEMES, NOTE_FREE } from './shop.js';

/** 🎨 만든 사람이 고르는 맵 꾸미기 (2026-11-23 사용자): 상점의 무료 것만 — 무대·드럼 = 맵 8개, 콩 = 색 콩 */
export const MAP_DECO = { bg: DECO_THEMES, kit: DECO_THEMES, notes: NOTE_FREE };

export const MAP_LIMITS = { minBars: 2, maxBars: 64, minBpm: 60, maxBpm: 180, nameMax: 30, minNotes: 8 };
const DRUM_RE = /^[KSHCBJX.]{16}$/;
const LOW = 36; // C2
const HIGH = 96; // C7
const LOW_LH = 24; // C1 (왼손 베이스는 더 낮게)

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
  const out = { name, bpm, bars: [...bars], melody: melody.map((m) => m.trim().replace(/\s+/g, ' ')), prog: prog.map((p) => String(p).trim().replace(/\s+/g, ' ')) };
  // 🎹 왼손(아래 줄, 악보에서) — 있으면 자동 베이스 대신 이걸 침. 이상하면 빼고 맵은 그대로
  const low = raw.low;
  if (Array.isArray(low) && low.length === bars.length && low.every((m) => typeof m === 'string' && m.length <= 200)) {
    try {
      const ns = parseMelody(low);
      if (ns.length && ns.every((n) => n.midi >= LOW_LH && n.midi <= HIGH)) out.low = low.map((m) => m.trim().replace(/\s+/g, ' '));
    } catch {}
  }
  // 🎨 꾸미기(있을 때만, 무료 것만). 이상한 값은 빼고 맵은 살림
  const deco = raw.deco;
  if (deco && typeof deco === 'object') {
    const d = {};
    for (const [k, list] of Object.entries(MAP_DECO)) if (typeof deco[k] === 'string' && list.includes(deco[k])) d[k] = deco[k];
    if (Object.keys(d).length) out.deco = d;
  }
  return out;
}

/** 노트 수로 어림한 난이도 1~5 (초당 노트) */
export function mapDifficulty(map) {
  let notes = 0;
  for (const b of map.bars) for (const c of b) if (c !== '.') notes++;
  const sec = (map.bars.length * 4 * 60) / map.bpm;
  const nps = notes / sec;
  return nps < 1.6 ? 1 : nps < 2.4 ? 2 : nps < 3.4 ? 3 : nps < 4.6 ? 4 : 5;
}

/** 멜로디 없이 드럼만 있는 맵인지 */
export function isDrumOnly(map) {
  return map.melody.every((m) => !/[A-G]/.test(m));
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
    theme: (map.deco && map.deco.bg) || THEME_KEYS[h % THEME_KEYS.length],
    // 🎨 만든 사람이 고른 드럼·콩 색 (치는 사람이 상점에서 장착한 게 있으면 그게 먼저, main.js setKit)
    deco: map.deco || null,
    difficulty: mapDifficulty(map),
    bpm: map.bpm,
    bars: map.bars,
    song: {
      prog: map.prog,
      melody: map.melody,
      // 🎹 악보 왼손(있을 때만) — 자동 베이스는 끄고 이걸 피아노로
      low: map.low || null,
      hat: '................',
      // 🥁 드럼만 맵(멜로디가 다 쉼)은 베이스·화음도 안 깔고 드럼만
      bass: isDrumOnly(map) || map.low ? '................' : 'x.......x.......',
      chord: isDrumOnly(map) ? '................' : 'x.......x.......',
    },
  };
}

// ---------- 🎙 노래 파일에서 멜로디 따기 (초안) ----------
//   16분 칸마다 소리의 주파수를 보고(배음 더하기) 가장 센 음 하나를 고름 → 같은 음이 이어지면 한 음으로.
//   반주가 꽉 찬 노래는 지저분하게 나와서, 만든 뒤 손으로 다듬는 용도

/** 제자리 FFT (re, im 길이 2의 거듭제곱) */
export function fft(re, im) {
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
 * 노래 → 마디별 멜로디 음표 초안
 *   input = 모노 Float32Array 또는 [왼쪽, 오른쪽]. 스테레오면 '가운데 소리'만 봄:
 *   보컬은 거의 늘 가운데, 신스·코드·기타는 좌우로 퍼져 있어서 좌우가 다른 소리를 빼면 보컬이 또렷해짐 (K-pop 처럼 반주가 꽉 찬 곡)
 *   그다음 칸마다 음 후보 점수(배음 더하기)를 매기고, 음이 크게 튀지 않는 길을 고름(비터비)
 * @param {Float32Array | Float32Array[]} input
 * @param {number} sr
 * @param {{ firstBeat: number, bpm: number, bars: number, lo?: number, hi?: number }} o
 * @returns {{ bars: Array<Array<{step,midi,len}>>, found: number }}
 */
// 음 따기 설정 (11-21 시험장에서 고름: 사람 목소리 비슷한 소리 + 팝 반주 24곡, 8분 칸 정답률 62% → 87%, scripts/melody-bench.mjs)
const POSS = [0.5, 0.8]; // 16분 칸 안에서 볼 자리 (음 첫머리 끌어올림을 피해 조금 뒤쪽)
const WHITEN = 0.8; // 스펙트럼 고르게 하는 세기
const KEYTH = 0.03; // 곡에서 이보다 드문 '조 밖 음'만 음계 음으로 고침
const KEYTH_STRAY = 0.1; // 짧게 튀는 조 밖 음은 이 정도까지
export function transcribe(input, sr, { firstBeat, bpm, bars, lo = 45, hi = 88 }) {
  const chans = input instanceof Float32Array ? [input] : input;
  const L = chans[0];
  const R = chans[chans.length - 1];
  const stereo = L !== R;
  const len = L.length;
  const mono = stereo ? new Float32Array(len) : L;
  if (stereo) for (let i = 0; i < len; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const N = 4096;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const reR = new Float64Array(N);
  const imR = new Float64Array(N);
  const stepSec = 60 / bpm / 4;
  const steps = bars * STEPS_PER_BAR;
  const binHz = sr / N;
  const C = hi - lo + 1;
  const comp = stereo ? 0.5 : 1; // 세기 눌러 주기 (가운데만 남기면 큰 소리가 덜 몰려서 √ 가 나음)
  const kMin = Math.floor(100 / binHz);
  const kMax = Math.min(N / 2 - 2, Math.ceil(5000 / binHz));
  const sal = new Float32Array(steps * C);
  const energy = new Float32Array(steps);
  const mag = new Float32Array(N / 2);
  const wmag = new Float32Array(N / 2);
  const csum = new Float64Array(N / 2 + 1);
  const peak = (k) => Math.max(mag[k - 1], mag[k], mag[k + 1]);
  for (let s = 0; s < steps; s++) for (const pos of POSS) {
    // 칸 안 몇 군데(음이 울리는 중)를 보고 더함 — 음 첫머리 끌어올림(스쿱)에 덜 속게
    const a = Math.round((firstBeat + s * stepSec + stepSec * pos) * sr) - N / 2;
    if (a < 0 || a + N > len) continue;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = mono[a + i];
      e += v * v;
      re[i] = L[a + i] * win[i];
      im[i] = 0;
      if (stereo) (reR[i] = R[a + i] * win[i]), (imR[i] = 0);
    }
    energy[s] += Math.sqrt(e / N) / POSS.length;
    fft(re, im);
    if (stereo) fft(reR, imR);
    mag.fill(0);
    for (let k = kMin; k <= kMax; k++) {
      let m;
      if (stereo) {
        const sr2 = re[k] + reR[k];
        const si = im[k] + imR[k];
        const dr = re[k] - reR[k];
        const di = im[k] - imR[k];
        const S = sr2 * sr2 + si * si;
        const D = dr * dr + di * di;
        // 좌우가 같을수록 1, 다를수록 0
        const w = S + D > 0 ? Math.max(0, (S - D) / (S + D)) : 0;
        m = Math.sqrt(S) * 0.5 * w * w * w;
      } else m = Math.hypot(re[k], im[k]);
      mag[k] = comp === 1 ? m : Math.pow(m, comp);
    }
    // 스펙트럼 고르게 (whitening): 둘레 평균으로 나눔 → 큰 베이스·패드가 낮은 쪽에서 표를 몰아가지 않게
    {
      csum[0] = 0;
      for (let k = 0; k < N / 2; k++) csum[k + 1] = csum[k] + mag[k];
      for (let k = kMin; k <= kMax; k++) {
        const hw = Math.max(3, Math.round(k * 0.12));
        const a2 = Math.max(0, k - hw);
        const b2 = Math.min(N / 2, k + hw + 1);
        const avg = (csum[b2] - csum[a2]) / (b2 - a2);
        wmag[k] = avg > 0 ? mag[k] / Math.pow(avg, WHITEN) : 0;
      }
      for (let k = kMin; k <= kMax; k++) mag[k] = wmag[k];
    }
    for (let j = 0; j < C; j++) {
      const f0 = 440 * Math.pow(2, (lo + j - 69) / 12);
      let v = 0;
      let odd = 0;
      let even = 0;
      for (let h = 1; h <= 8; h++) {
        const k = Math.round((f0 * h) / binHz);
        if (k + 1 > kMax) break;
        const p = Math.pow(0.84, h - 1) * peak(k);
        v += p;
        if (h % 2) odd += p;
        else even += p;
      }
      // 한 옥타브 아래 가짜 후보: 진짜 음의 배음은 짝수 자리에만 걸리고 홀수 자리(1·3·5배)는 비어 있음 → 깎음
      if (odd + even > 0) v *= Math.min(1, (2.2 * odd) / (odd + even));
      // 아래 옥타브 배음에 속지 않게: 반 주파수·1.5배 자리에도 힘이 크면 깎음
      const kh = Math.round(f0 / 2 / binHz);
      if (kh > kMin) v -= 0.3 * peak(kh);
      const k15 = Math.round((f0 * 1.5) / binHz);
      if (k15 + 1 <= kMax) v -= 0.2 * peak(k15);
      sal[s * C + j] += Math.max(0, v);
    }
  }
  // 칸마다 점수 → 로그 (가장 센 후보 = 0), 쉼 점수는 소리가 작거나 음이 또렷하지 않으면 높게
  let maxE = 0;
  for (let s = 0; s < steps; s++) if (energy[s] > maxE) maxE = energy[s];
  const S1 = C + 1;
  const emit = new Float32Array(steps * S1);
  for (let s = 0; s < steps; s++) {
    let mx = 0;
    let sum = 0;
    for (let j = 0; j < C; j++) (mx = Math.max(mx, sal[s * C + j])), (sum += sal[s * C + j]);
    const voiced = energy[s] >= maxE * 0.12 && mx > 0 && mx / (sum / C) > 1.6;
    for (let j = 0; j < C; j++) emit[s * S1 + j] = mx > 0 ? Math.log(sal[s * C + j] / mx + 1e-3) : -7;
    emit[s * S1 + C] = voiced ? -2.5 : 0;
  }
  // 비터비: 음이 바뀌거나 멀리 튀면 벌점 (한 옥타브 넘게 튀면 크게)
  const tr = (x, y) => {
    if (x === y) return 0;
    if (x === C || y === C) return -1;
    const d = Math.abs(x - y);
    return -0.1 - 0.03 * Math.min(12, d) - (d > 12 ? 2 : 0);
  };
  let prev = new Float32Array(S1);
  let next = new Float32Array(S1);
  const back = new Int16Array(steps * S1);
  for (let j = 0; j < S1; j++) prev[j] = emit[j];
  for (let s = 1; s < steps; s++) {
    for (let y = 0; y < S1; y++) {
      let bv = -Infinity;
      let bi = 0;
      for (let x = 0; x < S1; x++) {
        const v = prev[x] + tr(x, y);
        if (v > bv) (bv = v), (bi = x);
      }
      next[y] = bv + emit[s * S1 + y];
      back[s * S1 + y] = bi;
    }
    [prev, next] = [next, prev];
  }
  const pitch = new Int16Array(steps).fill(-1);
  let bi = 0;
  for (let j = 1; j < S1; j++) if (prev[j] > prev[bi]) bi = j;
  for (let s = steps - 1; s >= 0; s--) {
    pitch[s] = bi === C ? -1 : lo + bi;
    bi = back[s * S1 + bi];
  }
  // 같은 음을 다시 쳤나: 짧은 창(약 23ms)으로 칸 시작 바로 전과 바로 뒤의 그 음 세기를 비교
  const N2 = 1 << Math.round(Math.log2(sr * 0.023)); // 약 23ms (44.1kHz 면 1024)
  const win2 = new Float32Array(N2);
  for (let i = 0; i < N2; i++) win2[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N2 - 1));
  const re2 = new Float64Array(N2);
  const im2 = new Float64Array(N2);
  const re3 = new Float64Array(N2);
  const im3 = new Float64Array(N2);
  const pitchMag = (sec, m) => {
    const a = Math.round(sec * sr) - N2 / 2;
    if (a < 0 || a + N2 > len) return 0;
    for (let i = 0; i < N2; i++) (re2[i] = L[a + i] * win2[i]), (im2[i] = 0);
    fft(re2, im2);
    if (stereo) {
      for (let i = 0; i < N2; i++) (re3[i] = R[a + i] * win2[i]), (im3[i] = 0);
      fft(re3, im3);
    }
    const f0 = 440 * Math.pow(2, (m - 69) / 12);
    let v = 0;
    for (let h = 1; h <= 3; h++) {
      const k = Math.round((f0 * h * N2) / sr);
      if (k + 1 >= N2 / 2) break;
      for (let j = k - 1; j <= k + 1; j++) {
        if (!stereo) {
          v += Math.hypot(re2[j], im2[j]);
          continue;
        }
        // 가운데 소리만 (좌우로 퍼진 반주가 맥놀이로 '다시 친 것'처럼 보이지 않게)
        const sr2 = re2[j] + re3[j];
        const si = im2[j] + im3[j];
        const dr = re2[j] - re3[j];
        const di = im2[j] - im3[j];
        const S = sr2 * sr2 + si * si;
        const D = dr * dr + di * di;
        const w = S + D > 0 ? Math.max(0, (S - D) / (S + D)) : 0;
        v += Math.sqrt(S) * 0.5 * w * w * w;
      }
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
    const tot = all.reduce((a, x) => a + x.len, 0);
    for (let i = 0; i < all.length; i++) {
      const n = all[i];
      const pc = n.midi % 12;
      if (scale.includes(pc)) continue;
      // 음계 밖 음: 아주 드물면 고침. 조금 드물면(단조의 올린 7음 같은 건 자주 나옴) 짧고 앞뒤에 같은 음이 없는 '튀는 음'만
      const pcAt = (j) => (all[j] ? all[j].midi % 12 : -1);
      const stray = n.len <= 2 && pcAt(i - 1) !== pc && pcAt(i + 1) !== pc;
      if (w[pc] > tot * (stray ? KEYTH_STRAY : KEYTH)) continue;
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
