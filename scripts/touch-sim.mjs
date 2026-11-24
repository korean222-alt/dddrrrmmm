// 🖐 터치 판정 시뮬레이션 (2026-11-23 '빽빽한 구간·엇박 터치 씹힘' 때 만듦)
//   사람처럼 치는 가짜 손가락(타이밍 흔들림·엄지 자리 흔들림·가끔 건너뜀·터치 늦게 도착)으로 game.js 판정을 돌려서
//   - 씹힘: GOOD 안에 맞는 줄을 쳤는데 MISS 가 된 콩
//   - 헛침: 헛침 수 (가짜 손가락은 남는 터치를 안 함 → 전부 판정 탓)
//   - 낮아짐: 친 시간보다 낮은 판정 (PERFECT 로 쳤는데 GOOD 등)
//   - 마구 연타: 두 엄지가 아무 때나 두드릴 때 맞히는 비율 (올라가면 랭킹 공정이 깨짐 → 판정 바꿀 때 꼭 확인)
// 쓰기: node scripts/touch-sim.mjs                 지금 코드
//       node scripts/touch-sim.mjs <예전 폴더>     예전 코드(public/js 가 있는 폴더, 예: git worktree)와 나란히 비교
//       HITCH=0.3 node scripts/touch-sim.mjs       폰이 버벅임: 3초에 한 번쯤 0.3초 동안 화면·터치 처리가 멈춤 (HITCH_EVERY=초)
//         FRAME_FIRST=1 이면 멈춘 뒤 화면 갱신(MISS 처리)이 밀린 터치보다 먼저 돎 (2026-11-23 '빽빽한 곳 뒤에서 터치가 안 돼요')
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
//   frame=화면 한 프레임, lag=터치가 늦게 도착, toCenter=두 엄지가 가운데 선 쪽으로 쏠림, alt=같은 줄 빠른 연타는 두 엄지로 번갈아(줄 안 자리 ±alt))
const PROFILES = {
  잘침: { sigma: 0.03, bias: 0, posSigma: 0.18, skip: 0, offbeatMul: 1.2, frame: 1 / 60, lag: 0.02 },
  보통: { sigma: 0.045, bias: 0.01, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  서툼: { sigma: 0.065, bias: 0.02, posSigma: 0.25, skip: 0.03, offbeatMul: 1.5, frame: 1 / 30, lag: 0.05 },
  가운데: { sigma: 0.045, bias: 0.01, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, toCenter: 0.25 },
  늦게침: { sigma: 0.04, bias: 0.05, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  일찍침: { sigma: 0.04, bias: -0.04, posSigma: 0.22, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03 },
  번갈아: { sigma: 0.045, bias: 0.01, posSigma: 0.15, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, alt: 0.3 },
  넘어감: { sigma: 0.045, bias: 0.01, posSigma: 0.3, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, toCenter: 0.35 },
  // 붙음: 두 엄지가 가운데 선에 바짝 붙어 침 (2026-11-24 DM 영상 '쿵 → 0.1초 뒤 짝'에서 짝만 빠짐: 짝 엄지가 쿵 쪽에 닿는 듯)
  붙음: { sigma: 0.04, bias: 0.01, posSigma: 0.18, skip: 0, offbeatMul: 1.3, frame: 1 / 60, lag: 0.03, toCenter: 0.45 },
  // 가짜 터치: 진짜로 친 뒤 0.03~0.08초에 가운데 쪽 0.3~0.6줄 옆에서 터치가 하나 더 들어옴 (엄지를 떼며 굴림 → 움직임을 새 터치로 본 것,
  //   다른 엄지가 스침 등). stray = 진짜 터치 중 그런 게 생기는 비율. 2026-11-24 '아직 인식이 제대로 안 돼요' 때 추가
  // 벌림: 두 엄지를 벌려 바깥 줄(챙·츠)만 누름 — 두 엄지가 가운데서 붙으면 폰이 터치를 하나만 보내는 사람에게 권하는 자세 (2026-11-24)
  벌림: { sigma: 0.045, bias: 0.01, posSigma: 0.15, skip: 0.01, offbeatMul: 1.35, frame: 1 / 60, lag: 0.03, wide: true },
  가짜조금: { sigma: 0.04, bias: 0.01, posSigma: 0.2, skip: 0, offbeatMul: 1.3, frame: 1 / 60, lag: 0.03, toCenter: 0.15, stray: 0.03 },
  가짜많이: { sigma: 0.04, bias: 0.01, posSigma: 0.2, skip: 0, offbeatMul: 1.3, frame: 1 / 60, lag: 0.03, toCenter: 0.15, stray: 0.1 },
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
  // game._loop 의 '지나간 노트 → MISS' (있으면 게임 것 그대로, 예전 코드는 같은 모양으로)
  const sweep = (g, now) => {
    if (g._sweep) return g._sweep(now, 0);
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
  const H = +(process.env.HITCH || 0), EVERY = +(process.env.HITCH_EVERY || 3), FF = process.env.FRAME_FIRST === '1';
  const play = (g, taps, P, end) => {
    let ti = 0;
    const R = rng(12345);
    let nextHitch = H ? EVERY * (0.5 + R()) : Infinity;
    for (let now = 0; now < end; now += P.frame || 1 / 60) {
      if (now >= nextHitch) {
        now += H; // 버벅임: 이 동안 화면도 터치도 처리 못 함 (터치 시각은 실제로 누른 때)
        nextHitch = now + EVERY * (0.5 + R());
        if (FF) {
          clock = now;
          sweep(g, now);
        }
      }
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

function human(E, lv, P, seed, lives = false) {
  const R = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(R() || 1e-9)) * Math.cos(2 * Math.PI * R());
  const g = E.make(lv);
  if (lives) {
    g.livesOn = true;
    g.onDeath = () => {};
  }
  const order = g.laneOrder;
  const notes = order.flatMap((l) => g.lanes[l]);
  const step = 60 / (lv.bpm || 100) / 4;
  const taps = [];
  const lastAt = {}, lastLeft = {};
  notes.sort((a, b) => a.time - b.time);
  for (const n of notes) {
    if (R() < P.skip) { n._exp = 'skip'; continue; }
    const off = Math.round(n.time / step) % 2 === 1;
    const err = P.bias + gauss() * P.sigma * (off ? P.offbeatMul : 1);
    const ad = Math.abs(err);
    const J = E.C.JUDGE;
    n._exp = ad <= J.perfect ? 'perfect' : ad <= J.great ? 'great' : ad <= J.good ? 'good' : 'miss';
    let left = E.C.INSTRUMENTS[n.lane].hand === 'left';
    let shift = 0;
    if (P.alt) {
      if (n.time - (lastAt[n.lane] ?? -9) < 0.2) left = !lastLeft[n.lane];
      lastAt[n.lane] = n.time;
      lastLeft[n.lane] = left;
      shift = left ? -P.alt : P.alt;
    }
    // 벌림: 엄지를 벌려 맨 바깥 줄만 누름 (왼엄지 = 맨 왼쪽 줄, 오른엄지 = 맨 오른쪽 줄)
    const home = P.wide ? (left ? 0 : order.length - 1) : order.indexOf(n.lane);
    const u = home + 0.5 + shift + gauss() * P.posSigma + (P.toCenter ? (left ? P.toCenter : -P.toCenter) : 0);
    taps.push({ at: n.time + err, u, n });
    if (P.stray && R() < P.stray) {
      const dir = u < order.length / 2 ? 1 : -1; // 가운데 쪽으로
      taps.push({ at: n.time + err + 0.03 + 0.05 * R(), u: u + dir * (0.3 + 0.3 * R()), stray: true });
      n._stray = true;
    }
  }
  // 폰이 동시에 닿은 두 엄지 중 하나의 터치를 안 보냄 (2026-11-24 DM 영상: 쌍 5번 중 3번) — pairDrop = 쌍마다 그럴 확률
  if (P.pairDrop) {
    const byPair = new Map();
    for (const tp of taps) if (tp.n && tp.n.pair >= 0 && !tp.stray) (byPair.get(tp.n.pair) || byPair.set(tp.n.pair, []).get(tp.n.pair)).push(tp);
    const drop = new Set();
    for (const g2 of byPair.values()) if (g2.length > 1 && R() < P.pairDrop) drop.add(g2[Math.floor(R() * g2.length)]);
    for (let i = taps.length - 1; i >= 0; i--) if (drop.has(taps[i])) {
      taps[i].n._exp = 'drop';
      taps.splice(i, 1);
    }
  }
  // 빠른 번갈아 콩(다른 엄지 콩 0.04~0.16초 뒤)의 터치를 폰이 안 보냄 — altDrop = 그럴 확률 (2026-11-24)
  if (P.altDrop && E.C.isQuickAlt) {
    const ns = [...notes].sort((a, b) => a.time - b.time);
    const quick = new Set(ns.filter((n, i) => n.pair < 0 && E.C.isQuickAlt(ns, i)));
    for (let i = taps.length - 1; i >= 0; i--) if (taps[i].n && quick.has(taps[i].n) && !taps[i].stray && R() < P.altDrop) {
      taps[i].n._exp = 'drop';
      taps.splice(i, 1);
    }
  }
  taps.sort((a, b) => a.at - b.at);
  E.play(g, taps, P, Math.max(...notes.map((n) => n.time)) + 1);
  if (lives) return { alive: g.state !== 'dead', drops: notes.filter((n) => n._exp === 'drop').length };
  const rank = { perfect: 3, great: 2, good: 1, miss: 0 };
  let eaten = 0, down = 0, strays = 0;
  for (const n of notes) {
    if (n._stray) strays++;
    if (n._exp === 'skip' || n._exp === 'miss' || n._exp === 'drop') continue;
    if (!n.judged || n.result === 'miss') eaten++;
    else if (rank[n.result] < rank[n._exp]) down++;
  }
  // 가짜 터치는 헛침 하나까지는 어쩔 수 없음 → 그걸 뺀 헛침
  return { eaten, wrong: Math.max(0, g.counts.wrong - strays), down, pen: g.counts.miss + g.counts.wrong };
}

function masher(E, lv, rate, seed, lives = false) {
  const R = rng(seed);
  const g = E.make(lv);
  if (lives) {
    g.livesOn = true;
    g.onDeath = () => {};
  }
  const n = g.laneOrder.length;
  const end = g.lastNoteTime + 0.5;
  const taps = [];
  for (const hand of [0, 1]) for (let t = 0; t < end; t += -Math.log(1 - R()) / rate) taps.push({ at: t, u: (hand + R()) * (n / 2) });
  taps.sort((a, b) => a.at - b.at);
  E.play(g, taps, { frame: 1 / 60 }, end + 0.5);
  const c = g.counts;
  return { hit: c.perfect + c.great + c.good, notes: g.notes.length, alive: g.state !== 'dead', score: g.score / (g.maxScore || 1) };
}

const engines = [];
for (const d of dirs) engines.push({ name: path.basename(d), E: await engine(d) });
console.log(`단계 ${IDS.join(',')} · 유형마다 ${RUNS}판 · 숫자는 판 하나(단계 전부 합) 평균\n`);
console.log('유형'.padEnd(5), engines.map((e) => `[${e.name}] 씹힘 / 헛침 / 낮아짐 / 벌 전부`).join('   '));
console.log('     (벌 전부 = MISS + 헛침, 사람이 진짜로 틀린 것까지. 하트가 깎이는 횟수에 가까움)');
for (const [name, P] of Object.entries(PROFILES)) {
  const cols = engines.map(({ E }) => {
    const t = { eaten: 0, wrong: 0, down: 0, pen: 0 };
    for (const id of IDS) {
      const lv = E.C.LEVELS.find((l) => l.id === id);
      if (!lv) continue;
      for (let k = 0; k < RUNS; k++) {
        const r = human(E, lv, P, 1000 * id + k);
        for (const key in t) t[key] += r[key];
      }
    }
    return `${(t.eaten / RUNS).toFixed(2).padStart(7)} / ${(t.wrong / RUNS).toFixed(2).padStart(6)} / ${(t.down / RUNS).toFixed(2).padStart(6)} / ${(t.pen / RUNS).toFixed(1).padStart(6)}`;
  });
  console.log(name.padEnd(5), cols.join('   '));
}
console.log('\n폰이 쌍(동시치기) 중 하나의 터치를 안 보냄 — 하트 켜고 끝까지 살아남은 판 (2026-11-24 쌍 하트 규칙)');
for (const [name, base] of [['잘침', PROFILES.잘침], ['보통', PROFILES.보통]]) {
  for (const drop of [0, 0.3, 0.6, 'alt']) {
    const cols = engines.map(({ E }) => {
      let alive = 0, runs = 0;
      for (const id of IDS) {
        const lv = E.C.LEVELS.find((l) => l.id === id);
        if (!lv) continue;
        for (let k = 0; k < RUNS; k++) {
          runs++;
          const P = drop === 'alt' ? { ...base, pairDrop: 0.3, altDrop: 0.3 } : { ...base, pairDrop: drop };
          if (human(E, lv, P, 5000 * id + k, true).alive) alive++;
        }
      }
      return `${alive}/${runs}판`;
    });
    console.log(`  ${name} · ${drop === 'alt' ? '쌍·번갈아 30% 빠짐' : `쌍 ${Math.round(drop * 100)}% 빠짐`}:`.padEnd(22), engines.map((e, i) => `[${e.name}] ${cols[i]}`).join('   '));
  }
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
console.log('\n마구 연타 — 하트 없이(🛡 무적): 점수(만점 대비) — 제대로 친 사람(보통 85%↑)보다 한참 낮아야 함');
for (const rate of [4, 8, 12]) {
  const cols = engines.map(({ E }) => {
    let runs = 0, score = 0;
    for (const id of [5, 7, 9, 12, 15, 19]) {
      const lv = E.C.LEVELS.find((l) => l.id === id);
      if (!lv) continue;
      for (let k = 0; k < 10; k++) {
        runs++;
        score += masher(E, lv, rate, 77 * id + k).score;
      }
    }
    return `${((100 * score) / runs).toFixed(1)}%`;
  });
  console.log(`  초당 ${rate}x2:`, engines.map((e, i) => `[${e.name}] ${cols[i]}`).join('   '));
}
console.log('\n마구 연타 — 하트 켜고: 끝까지 살아남은 판 · 점수(만점 대비) — 0 이어야 함');
for (const rate of [4, 8, 12]) {
  const cols = engines.map(({ E }) => {
    let alive = 0, runs = 0, score = 0;
    for (const id of [5, 7, 9, 12, 15, 19]) {
      const lv = E.C.LEVELS.find((l) => l.id === id);
      if (!lv) continue;
      for (let k = 0; k < 10; k++) {
        const r = masher(E, lv, rate, 77 * id + k, true);
        runs++;
        if (r.alive) alive++;
        score += r.score;
      }
    }
    return `${alive}/${runs}판 · 점수 ${((100 * score) / runs).toFixed(1)}%`;
  });
  console.log(`  초당 ${rate}x2:`, engines.map((e, i) => `[${e.name}] ${cols[i]}`).join('   '));
}
