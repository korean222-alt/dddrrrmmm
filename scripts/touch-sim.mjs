// 🖐 터치 판정 시뮬레이션 (2026-11-23 '빽빽한 구간·엇박 터치 씹힘' 때 만듦)
//   사람처럼 치는 가짜 손가락(타이밍 흔들림·엄지 자리 흔들림·가끔 건너뜀·터치 늦게 도착)으로 game.js 판정을 돌려서
//   - 씹힘: GOOD 안에 맞는 줄을 쳤는데 MISS 가 된 콩
//   - 헛침: 헛침 수 (가짜 손가락은 남는 터치를 안 함 → 전부 판정 탓)
//   - 낮아짐: 친 시간보다 낮은 판정 (PERFECT 로 쳤는데 GOOD 등)
//   - 마구 연타: 두 엄지가 아무 때나 두드릴 때 맞히는 비율 (올라가면 랭킹 공정이 깨짐 → 판정 바꿀 때 꼭 확인)
// 쓰기: node scripts/touch-sim.mjs                 지금 코드
//       node scripts/touch-sim.mjs <예전 폴더>     예전 코드(public/js 가 있는 폴더, 예: git worktree)와 나란히 비교
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [...process.argv.slice(2).map((d) => path.resolve(d)), here];
const RUNS = +(process.env.RUNS || 20);
const IDS = (process.env.LV || '4,5,6,7,8,9,10,12,13,14,15,17,18,19,21').split(',').map(Number);

const noop = () => {};
globalThis.requestAnimationFrame ??= () => 0;
globalThis.cancelAnimationFrame ??= noop;
globalThis.navigator ??= {};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 사람 유형 (sigma=타이밍 흔들림 초, bias=평균 늦음, posSigma=엄지 자리 흔들림(줄 너비), skip=안 침, offbeatMul=엇박에서 흔들림 배,
//   frame=화면 한 프레임, lag=터치가 늦게 도착, toCenter=두 엄지가 가운데 선 쪽으로 쏠림)
const PROFILES = {
  잘침: { sigma: 0.03, bias: 0, posSigma: 0.18, skip: 0, offbeatMul: 1.2, frame: 1 / 60, lag: 0.02 },
  보통: { sigma: 0.045, bias: 0.01, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  서툼: { sigma: 0.065, bias: 0.02, posSigma: 0.25, skip: 0.03, offbeatMul: 1.5, frame: 1 / 30, lag: 0.05 },
  가운데: { sigma: 0.045, bias: 0.01, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, toCenter: 0.25 },
  늦게침: { sigma: 0.04, bias: 0.05, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  일찍침: { sigma: 0.04, bias: -0.04, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  넘어감: { sigma: 0.045, bias: 0.01, posSigma: 0.3, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, toCenter: 0.35 },
};

async function engine(dir) {
  const { Game } = await import(pathToFileURL(path.join(dir, 'public/js/game.js')).href);
  const C = await import(pathToFileURL(path.join(dir, 'public/js/charts.js')).href);
  let clock = 0;
  const renderer = new Proxy({}, { get: () => noop });
  const audio = new Proxy({ ctx: { suspend: async () => {}, resume: async () => {}, state: 'running' }, heardTime: () => clock }, { get: (o, k) => (k in o ? o[k] : noop) });
  const make = (lv) => {
    const g = new Game({ audio, renderer, level: lv, settings: {}, onDeath: noop, onEnd: noop });
    g.startTime = 0;
    g.state = 'playing';
    g.player = { stop: noop };
    g.livesOn = false; // 끝까지
    return g;
  };
  // game._loop 의 '지나간 노트 → MISS' 와 같게
  const sweep = (g, now) => {
    for (const lane of g.laneOrder) {
      const list = g.lanes[lane];
      while (g.ptr[lane] < list.length) {
        const n = list[g.ptr[lane]];
        if (n.judged) { g.ptr[lane]++; continue; }
        if (now - Math.max(n.time, n.hold || 0) > C.JUDGE.good + 0.12) { g._miss(n, 0); n.swept = true; g.ptr[lane]++; continue; }
        break;
      }
    }
  };
  // render.laneHit 와 같은 모양 (u = 줄 너비 단위 가로 자리)
  const press = (g, u) => {
    const order = g.laneOrder;
    const i = Math.max(0, Math.min(order.length - 1, Math.floor(u)));
    const f = Math.max(0, Math.min(1, u - i));
    const near = [];
    if (i > 0) near.push({ lane: order[i - 1], d: f });
    if (i < order.length - 1) near.push({ lane: order[i + 1], d: 1 - f });
    near.sort((a, b) => a.d - b.d);
    g.input(order[i], 0, near, u);
  };
  const play = (g, taps, P, end) => {
    let ti = 0;
    for (let now = 0; now < end; now += P.frame || 1 / 60) {
      while (ti < taps.length && taps[ti].at + (P.lag || 0) <= now) {
        const tp = taps[ti++];
        clock = tp.at;
        press(g, tp.u);
      }
      clock = now;
      sweep(g, now);
    }
  };
  return { C, make, play };
}

function human(E, lv, P, seed) {
  const R = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(R() || 1e-9)) * Math.cos(2 * Math.PI * R());
  const g = E.make(lv);
  const order = g.laneOrder;
  const notes = order.flatMap((l) => g.lanes[l]);
  const step = 60 / (lv.bpm || 100) / 4;
  const taps = [];
  for (const n of notes) {
    if (R() < P.skip) { n._exp = 'skip'; continue; }
    const off = Math.round(n.time / step) % 2 === 1;
    const err = P.bias + gauss() * P.sigma * (off ? P.offbeatMul : 1);
    const ad = Math.abs(err);
    const J = E.C.JUDGE;
    n._exp = ad <= J.perfect ? 'perfect' : ad <= J.great ? 'great' : ad <= J.good ? 'good' : 'miss';
    const left = E.C.INSTRUMENTS[n.lane].hand === 'left';
    const u = order.indexOf(n.lane) + 0.5 + gauss() * P.posSigma + (P.toCenter ? (left ? P.toCenter : -P.toCenter) : 0);
    taps.push({ at: n.time + err, u });
  }
  taps.sort((a, b) => a.at - b.at);
  E.play(g, taps, P, Math.max(...notes.map((n) => n.time)) + 1);
  const rank = { perfect: 3, great: 2, good: 1, miss: 0 };
  let eaten = 0, down = 0;
  for (const n of notes) {
    if (n._exp === 'skip' || n._exp === 'miss') continue;
    if (!n.judged || n.result === 'miss') eaten++;
    else if (rank[n.result] < rank[n._exp]) down++;
  }
  return { eaten, wrong: g.counts.wrong, down };
}

function masher(E, lv, rate, seed) {
  const R = rng(seed);
  const g = E.make(lv);
  const n = g.laneOrder.length;
  const end = g.lastNoteTime + 0.5;
  const taps = [];
  for (const hand of [0, 1]) for (let t = 0; t < end; t += -Math.log(1 - R()) / rate) taps.push({ at: t, u: (hand + R()) * (n / 2) });
  taps.sort((a, b) => a.at - b.at);
  E.play(g, taps, { frame: 1 / 60 }, end + 0.5);
  const c = g.counts;
  return { hit: c.perfect + c.great + c.good, notes: g.notes.length };
}

const engines = [];
for (const d of dirs) engines.push({ name: path.basename(d), E: await engine(d) });
console.log(`단계 ${IDS.join(',')} · 유형마다 ${RUNS}판 · 숫자는 판 하나(단계 전부 합) 평균\n`);
console.log('유형'.padEnd(5), engines.map((e) => `[${e.name}] 씹힘 / 헛침 / 낮아짐`).join('   '));
for (const [name, P] of Object.entries(PROFILES)) {
  const cols = engines.map(({ E }) => {
    const t = { eaten: 0, wrong: 0, down: 0 };
    for (const id of IDS) {
      const lv = E.C.LEVELS.find((l) => l.id === id);
      if (!lv) continue;
      for (let k = 0; k < RUNS; k++) {
        const r = human(E, lv, P, 1000 * id + k);
        for (const key in t) t[key] += r[key];
      }
    }
    return `${(t.eaten / RUNS).toFixed(2).padStart(7)} / ${(t.wrong / RUNS).toFixed(2).padStart(6)} / ${(t.down / RUNS).toFixed(2).padStart(6)}`;
  });
  console.log(name.padEnd(5), cols.join('   '));
}
console.log('\n마구 연타 (두 엄지 초당 N번씩) 맞히는 비율 — 올라가면 안 됨');
for (const rate of [4, 8, 12]) {
  const cols = engines.map(({ E }) => {
    let hit = 0, notes = 0;
    for (const id of [5, 7, 9, 12, 15, 19]) {
      const lv = E.C.LEVELS.find((l) => l.id === id);
      if (!lv) continue;
      for (let k = 0; k < 10; k++) {
        const r = masher(E, lv, rate, 77 * id + k);
        hit += r.hit;
        notes += r.notes;
      }
    }
    return `${((100 * hit) / notes).toFixed(1)}%`;
  });
  console.log(`  초당 ${rate}x2:`, engines.map((e, i) => `[${e.name}] ${cols[i]}`).join('   '));
}
