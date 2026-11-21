// 🎤 노래에서 목소리만 골라내기 (폰 안에서만, 파일은 밖으로 안 나감)
//   Spleeter 2stems 보컬 모델 (Deezer, MIT) 을 ONNX(fp16, 약 20MB) 로 → onnxruntime-web(wasm) 으로 돌림.
//   처음 쓸 때만 받음(약 30MB, 그 뒤엔 캐시). '음 따기' 를 누를 때만 받아서 다른 사람·다른 화면엔 영향 없음.
//   순서: 스테레오 STFT(4096, 홉 1024) 크기 → 모델이 '목소리 크기' 를 냄 → 원래 스펙트럼에 그 비율(마스크)을 곱해 → 역변환
//   11-21 사용자 노래 2곡(인스타 화면 녹화)으로 시험: 음 따기 정답률 43% → 63% (분리 보컬 pYIN 기준)
import { fft } from './usermap.js';

const ORT_DIR = '/vendor/ort-1.22.0/';
const MODEL = '/assets/models/spleeter-vocals-fp16.onnx?v=1';
const SR = 44100;
const N = 4096;
const H = 1024;
const F = 1024; // 모델이 보는 주파수 칸 (0 ~ 11kHz)
const T = 512; // 모델 한 번에 보는 프레임 수 (약 12초)

const sessP = new Map();

function loadScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => no(new Error('script'));
    document.head.appendChild(s);
  });
}

/** 모델 준비 (모델마다 한 번만). onProgress(0~1) = 받는 중. 악기 음 따기(instnotes.js)도 같이 씀 */
export function modelSession(url, onProgress = () => {}, sizeGuess = 19.7e6) {
  if (!sessP.has(url)) {
    const p = (async () => {
      if (!globalThis.ort) await loadScript(ORT_DIR + 'ort.wasm.min.js');
      const ort = globalThis.ort;
      ort.env.wasm.wasmPaths = ORT_DIR;
      ort.env.wasm.numThreads = 1;
      const res = await fetch(url);
      if (!res.ok) throw new Error('model ' + res.status);
      const total = Number(res.headers.get('content-length')) || sizeGuess;
      let bytes;
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        const parts = [];
        let got = 0;
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          onProgress(Math.min(1, got / total));
        }
        bytes = new Uint8Array(got);
        let at = 0;
        for (const q of parts) bytes.set(q, at), (at += q.length);
      } else bytes = new Uint8Array(await res.arrayBuffer());
      return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch((e) => {
      sessP.delete(url);
      throw e;
    });
    sessP.set(url, p);
  }
  return sessP.get(url);
}
const session = (onProgress) => modelSession(MODEL, onProgress);

/** 간단한 선형 보간으로 44.1kHz 로 */
export function resample(x, from) {
  const n = Math.floor((x.length * SR) / from);
  const y = new Float32Array(n);
  const r = from / SR;
  for (let i = 0; i < n; i++) {
    const p = i * r;
    const a = Math.floor(p);
    const f = p - a;
    y[i] = (x[a] || 0) * (1 - f) + (x[a + 1] || 0) * f;
  }
  return y;
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/**
 * 목소리만 남긴 스테레오 소리
 * @param {Float32Array} L @param {Float32Array} R @param {number} sr
 * @param {(stage: 'model'|'sep', p: number) => void} onProgress
 * @returns {Promise<{ L: Float32Array, R: Float32Array, sr: number }>}
 */
export async function separateVocals(L, R, sr, onProgress = () => {}) {
  if (sr !== SR) {
    L = resample(L, sr);
    R = resample(R, sr);
  }
  const sess = await session((p) => onProgress('model', p));
  const ort = globalThis.ort;
  const n = L.length;
  const nfr = Math.max(0, Math.floor((n - N) / H) + 1);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const wsum = new Float32Array(n);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); // periodic hann
  const chans = [L, R];
  const outs = [outL, outR];
  const splits = Math.ceil(nfr / T);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const inName = sess.inputNames[0];
  const outName = sess.outputNames[0];
  for (let sp = 0; sp < splits; sp++) {
    const f0 = sp * T;
    const cnt = Math.min(T, nfr - f0);
    // 이 조각의 스펙트럼 (0 ~ F 칸만 보관)
    const specRe = [new Float32Array(T * F), new Float32Array(T * F)];
    const specIm = [new Float32Array(T * F), new Float32Array(T * F)];
    const x = new Float32Array(2 * T * F);
    for (let c = 0; c < 2; c++) {
      const s = chans[c];
      for (let t = 0; t < cnt; t++) {
        const a = (f0 + t) * H;
        for (let i = 0; i < N; i++) (re[i] = s[a + i] * win[i]), (im[i] = 0);
        fft(re, im);
        const o = t * F;
        for (let k = 0; k < F; k++) {
          specRe[c][o + k] = re[k];
          specIm[c][o + k] = im[k];
          x[c * T * F + o + k] = Math.hypot(re[k], im[k]);
        }
      }
    }
    await nextFrame();
    const r = await sess.run({ [inName]: new ort.Tensor('float32', x, [2, 1, T, F]) });
    const y = r[outName].data;
    for (let c = 0; c < 2; c++) {
      const out = outs[c];
      for (let t = 0; t < cnt; t++) {
        const o = t * F;
        re.fill(0);
        im.fill(0);
        for (let k = 0; k < F; k++) {
          const mag = x[c * T * F + o + k];
          const m = mag > 1e-8 ? Math.min(1, Math.max(0, y[c * T * F + o + k] / mag)) : 0;
          re[k] = specRe[c][o + k] * m;
          im[k] = specIm[c][o + k] * m;
          // 역변환은 켤레 대칭으로
          if (k > 0) (re[N - k] = re[k]), (im[N - k] = -im[k]);
        }
        // ifft = conj(fft(conj(X))) / N
        for (let i = 0; i < N; i++) im[i] = -im[i];
        fft(re, im);
        const a = (f0 + t) * H;
        for (let i = 0; i < N; i++) {
          out[a + i] += (re[i] / N) * win[i];
          if (c === 0) wsum[a + i] += win[i] * win[i];
        }
      }
    }
    onProgress('sep', (sp + 1) / splits);
    await nextFrame();
  }
  for (let i = 0; i < n; i++) {
    const w = wsum[i] > 1e-3 ? wsum[i] : 1;
    outL[i] /= w;
    outR[i] /= w;
  }
  return { L: outL, R: outR, sr: SR };
}
