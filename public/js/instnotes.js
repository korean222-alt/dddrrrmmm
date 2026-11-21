// 🎹 반주(악기)에서 음 따기 — Spotify Basic Pitch (Apache-2.0, ONNX 228KB) 를 폰 안에서 돌림
//   11-21 사용자 '반주만 넣었는데 그것도 못 따, 중간중간 안 따지는 곳도 있어' → 배음 더하기로 고르던 악기 줄을
//   여러 음을 한꺼번에 듣는 신경망으로 바꿈. 22.05kHz 소리를 2초 창(겹침 30프레임)으로 넣으면
//   1/86초마다 88건반(A0~C8) 각각 '울리는 중' · '막 시작' 확률이 나옴
import { modelSession } from './vocalsep.js';

const MODEL = '/assets/models/basic-pitch.onnx?v=1';
const SR = 22050;
const N = 43844; // 창 길이 (2초 - 256)
const OV = 30 * 256; // 겹침
const HOP = N - OV;
export const BP_FPS = SR / 256;

/** 간단한 저역 필터 + 줄이기 → 22.05kHz */
function to22k(x, sr) {
  if (sr === SR) return x;
  const r = sr / SR;
  const n = Math.floor(x.length / r);
  const y = new Float32Array(n);
  const w = Math.max(1, Math.round(r));
  for (let i = 0; i < n; i++) {
    const c = i * r;
    const a = Math.floor(c);
    let v = 0;
    for (let k = 0; k < w; k++) v += x[a + k] || 0;
    y[i] = v / w;
  }
  return y;
}

/**
 * 소리 → { note, onset: Float32Array(frames*88), frames, fps } (프레임 0 = 소리 0초)
 * @param {Float32Array} x 모노 @param {number} sr
 */
export async function instrumentNotes(x, sr, onProgress = () => {}) {
  const sess = await modelSession(MODEL, (p) => onProgress('model', p), 230e3);
  const ort = globalThis.ort;
  const y = to22k(x, sr);
  const a = new Float32Array(y.length + OV / 2);
  a.set(y, OV / 2);
  const starts = [];
  for (let i = 0; i < a.length; i += HOP) starts.push(i);
  const frames = Math.floor((y.length * BP_FPS) / SR);
  const note = new Float32Array(frames * 88);
  const onset = new Float32Array(frames * 88);
  const per = 172 - 30; // 창마다 쓰는 프레임 (앞뒤 15씩 버림)
  const BATCH = 4;
  for (let b0 = 0; b0 < starts.length; b0 += BATCH) {
    const nb = Math.min(BATCH, starts.length - b0);
    const inp = new Float32Array(nb * N);
    for (let j = 0; j < nb; j++) inp.set(a.subarray(starts[b0 + j], starts[b0 + j] + N), j * N);
    const r = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', inp, [nb, N, 1]) });
    const nt = r['StatefulPartitionedCall:1'].data;
    const on = r['StatefulPartitionedCall:2'].data;
    for (let j = 0; j < nb; j++) {
      for (let t = 0; t < per; t++) {
        const f = (b0 + j) * per + t;
        if (f >= frames) break;
        const src = (j * 172 + 15 + t) * 88;
        note.set(nt.subarray(src, src + 88), f * 88);
        onset.set(on.subarray(src, src + 88), f * 88);
      }
    }
    onProgress('run', Math.min(1, (b0 + nb) / starts.length));
    await new Promise((res) => setTimeout(res, 0));
  }
  return { note, onset, frames, fps: BP_FPS };
}
