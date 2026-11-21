import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeSong, detectChords } from '../public/js/songmap.js';
import { videoToAac } from '../public/js/mp4audio.js';

const SR = 44100;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** 사람 목소리 비슷한 소리(배음 + 비브라토) 멜로디 + 화음 반주 + 쿵 */
function song({ bpm, mel, prog, voice = true }) {
  const st = 60 / bpm / 4;
  const lead = 1;
  const bars = prog.length;
  const n = Math.ceil((lead + bars * 16 * st + 1) * SR);
  const V = new Float32Array(n);
  const A = new Float32Array(n);
  for (const [at, midi, len] of mel) {
    const a = Math.round((lead + at * st) * SR);
    const d = Math.round((len * st - 0.02) * SR);
    let ph = 0;
    for (let i = 0; i < d; i++) {
      const t = i / SR;
      const f = hz(midi + (t > 0.12 ? 0.2 * Math.sin(2 * Math.PI * 5.5 * t) : 0));
      ph += (2 * Math.PI * f) / SR;
      let v = 0;
      for (let h = 1; h <= 8; h++) v += Math.sin(h * ph) / h;
      V[a + i] += 0.25 * v * Math.min(1, t / 0.02, (d / SR - t) / 0.03);
    }
  }
  const CH = { C: [60, 64, 67], F: [65, 69, 72], G: [67, 71, 74], Am: [69, 72, 76] };
  prog.forEach((c, b) => {
    const a = Math.round((lead + b * 16 * st) * SR);
    const d = Math.round(16 * st * SR);
    for (const m of [...CH[c], CH[c][0] - 24]) for (let i = 0; i < d; i++) A[a + i] += 0.06 * Math.sin((2 * Math.PI * hz(m) * i) / SR) * Math.exp(-i / SR / 2);
    for (let k = 0; k < 4; k++) {
      const s = a + Math.round(k * 4 * st * SR);
      for (let i = 0; i < 0.12 * SR; i++) A[s + i] += 0.5 * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-i / SR / 0.03)) * (i / SR)) * Math.exp(-i / SR / 0.08);
    }
  });
  const mix = new Float32Array(n);
  for (let i = 0; i < n; i++) mix[i] = A[i] + (voice ? V[i] : 0);
  return { mix: [mix, mix], voc: voice ? [V, V] : null, firstBeat: lead, bars };
}

test('노래 → 멜로디·코드·드럼 (목소리)', () => {
  const bpm = 100;
  // 도레미파솔 … (8분음표)
  const mel = [
    [0, 60, 2], [2, 62, 2], [4, 64, 2], [6, 65, 2], [8, 67, 4], [12, 67, 4],
    [16, 69, 2], [18, 69, 2], [20, 69, 2], [22, 69, 2], [24, 67, 8],
    [32, 65, 2], [34, 65, 2], [36, 65, 2], [38, 65, 2], [40, 64, 4], [44, 64, 4],
    [48, 62, 4], [52, 62, 4], [56, 60, 8],
  ];
  const s = song({ bpm, mel, prog: ['C', 'F', 'G', 'C'] });
  const r = transcribeSong({ ...s, sr: SR, bpm });
  assert.equal(r.bars.length, 4);
  // 8분 칸마다 음이름 비교 (옥타브는 무시 — 피아노 높이로 옮겨짐)
  const want = new Array(64).fill(-1);
  for (const [at, m, len] of mel) for (let i = 0; i < len; i++) want[at + i] = m % 12;
  const got = new Array(64).fill(-1);
  r.bars.forEach((bar, b) => bar.forEach((n) => { for (let i = 0; i < n.len; i++) got[b * 16 + n.step + i] = n.midi % 12; }));
  let ok = 0;
  let cnt = 0;
  for (let i = 0; i < 64; i += 2) if (want[i] >= 0) (cnt++, got[i] === want[i] && ok++);
  assert.ok(ok / cnt >= 0.8, `멜로디 ${ok}/${cnt}`);
  // 코드는 반주에서 (C F G C)
  assert.deepEqual(r.prog.map((p) => p.split(' ')[0]), ['C', 'F', 'G', 'C']);
  // 드럼은 마디마다 16칸, 첫 박에 쿵 쪽
  assert.equal(r.drums.length, 4);
  for (const d of r.drums) assert.match(d, /^[KSHCBJX.]{16}$/);
  assert.ok(r.vocalRatio > 0.12);
});

test('목소리 없는 곡은 악기 멜로디를 땀', () => {
  const bpm = 100;
  // 목소리 대신 반주에 높은 리드 (C6 근처)
  const mel = [[0, 84, 4], [4, 86, 4], [8, 88, 4], [12, 84, 4], [16, 79, 8], [24, 81, 8], [32, 84, 4], [36, 83, 4], [40, 81, 8], [48, 79, 16]];
  const s = song({ bpm, mel, prog: ['C', 'F', 'G', 'C'], voice: false });
  // 리드를 반주(mix)에 섞고, 골라낸 목소리는 거의 빈 소리
  const lead = song({ bpm, mel, prog: ['C', 'C', 'C', 'C'] }).voc[0];
  const mix = s.mix[0].map((x, i) => x + (lead[i] || 0));
  const quiet = new Float32Array(mix.length).map((_, i) => mix[i] * 0.02);
  const r = transcribeSong({ mix: [mix, mix], voc: [quiet, quiet], sr: SR, firstBeat: s.firstBeat, bpm, bars: 4 });
  assert.ok(r.vocalRatio < 0.12);
  assert.ok(r.found >= 6, `음 ${r.found}개`);
  assert.ok(r.leadShare > 0.3);
});

test('코드 찾기: 반주 화음', () => {
  const s = song({ bpm: 120, mel: [], prog: ['Am', 'F', 'C', 'G'], voice: false });
  const prog = detectChords(s.mix[0], SR, { firstBeat: s.firstBeat, bpm: 120, bars: 4 });
  assert.deepEqual(prog.map((p) => p.split(' ')[0]), ['Am', 'F', 'C', 'G']);
});

// ---------- 영상 파일에서 AAC 꺼내기 ----------
function box(type, ...parts) {
  const body = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const len = 8 + body.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  new DataView(out.buffer).setUint32(0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let at = 8;
  for (const b of body) out.set(b, at), (at += b.length);
  return out;
}
const u32 = (...v) => {
  const a = new Uint8Array(v.length * 4);
  v.forEach((x, i) => new DataView(a.buffer).setUint32(i * 4, x));
  return a;
};

test('영상(mp4/mov) 소리 → ADTS', async () => {
  // AAC 조각 3개 (내용은 아무거나)
  const frames = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6, 7]), new Uint8Array([8, 9])];
  const ftyp = box('ftyp', [0x71, 0x74, 0x20, 0x20], u32(0));
  const mdatData = new Uint8Array([0xee, ...frames[0], ...frames[1], 0xee, 0xee, ...frames[2]]);
  const mdat = box('mdat', mdatData);
  const dataAt = ftyp.length + 8;
  // esds: ES(03) → DecoderConfig(04, oti 0x40) → DecSpecificInfo(05): AAC-LC, 44.1kHz(4), 스테레오(2)
  const asc = [(2 << 3) | (4 >> 1), ((4 & 1) << 7) | (2 << 3)];
  const esds = box('esds', u32(0), [0x03, 25, 0, 1, 0], [0x04, 17, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0x05, 2, ...asc], [0x06, 1, 2]);
  // QuickTime 처럼 mp4a → wave → esds
  const mp4a = box('mp4a', new Uint8Array(6), [0, 1], new Uint8Array(20), box('wave', box('frma', [0x6d, 0x70, 0x34, 0x61]), esds));
  const stsd = box('stsd', u32(0, 1), mp4a);
  const stsz = box('stsz', u32(0, 0, 3, 3, 4, 2));
  const stsc = box('stsc', u32(0, 2, 1, 2, 1, 2, 1, 1));
  const stco = box('stco', u32(0, 2, dataAt + 1, dataAt + 1 + 7 + 2));
  const stbl = box('stbl', stsd, stsz, stsc, stco);
  const hdlr = box('hdlr', u32(0, 0), [0x73, 0x6f, 0x75, 0x6e], new Uint8Array(12));
  const vide = box('trak', box('mdia', box('hdlr', u32(0, 0), [0x76, 0x69, 0x64, 0x65], new Uint8Array(12))));
  const moov = box('moov', vide, box('trak', box('mdia', hdlr, box('minf', stbl))));
  const file = new Blob([ftyp, mdat, moov]);
  const out = await videoToAac(file);
  assert.ok(out);
  assert.equal(out.length, 3 * 7 + 9);
  // 첫 조각: ADTS 머리 + 내용
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xf1);
  assert.equal((out[2] >> 6) & 3, 1); // LC
  assert.equal((out[2] >> 2) & 15, 4); // 44.1kHz
  assert.equal(((out[2] & 1) << 2) | (out[3] >> 6), 2); // 스테레오
  assert.equal(((out[3] & 3) << 11) | (out[4] << 3) | (out[5] >> 5), 10); // 조각 길이 7+3
  assert.deepEqual([...out.slice(7, 10)], [1, 2, 3]);
  assert.deepEqual([...out.slice(10 + 7, 10 + 11)], [4, 5, 6, 7]);
  assert.deepEqual([...out.slice(-2)], [8, 9]);
  // moov 가 없으면 null
  assert.equal(await videoToAac(new Blob([ftyp, mdat])), null);
});
