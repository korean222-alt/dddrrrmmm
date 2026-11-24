// 🍎 채보 터치 위험 세기 (2026-11-24, tasks/채보-만들때-주의.md)
//   아이폰은 한 엄지가 떨어지는(또는 움직이는) 순간 다른 엄지가 닿으면 그 터치를 빠뜨릴 때가 있음.
//   → 그런 순간이 생기기 쉬운 콩을 단계마다 셈:
//     쌍     = 다른 엄지 두 콩이 같은 시각 (쌍 봐주기로 남은 콩 GOOD 이 되긴 함)
//     번갈아 = 다른 엄지 콩이 0.04~0.16초 앞에 있는 콩 (앞 엄지가 떨어지는 때와 겹치기 쉬움, 쌍 봐주기 없음)
// 쓰기: node scripts/chart-risk.mjs            모든 단계
//       node scripts/chart-risk.mjs 21 15      그 단계만
import { LEVELS, buildNotes, levelLanes, INSTRUMENTS, KICK, SNARE, HAT, CRASH, TOM, isQuickAlt, ALT_SHARE } from '../public/js/charts.js';

const NAME = { [KICK]: '쿵', [SNARE]: '짝', [HAT]: '츠', [CRASH]: '챙', [TOM]: '탐' };
const ids = process.argv.slice(2).map(Number);
console.log(`단계  곡                  줄     콩   쌍(콩)   번갈아   번갈아 많은 줄   (⚠ = 번갈아 ${ALT_SHARE * 100}% 넘음 — 새 곡은 이렇게 만들지 말 것)`);
for (const lv of LEVELS) {
  if (ids.length && !ids.includes(lv.id)) continue;
  if (!lv.bars || !lv.bars.length) continue;
  const ns = buildNotes(lv, 0, lv.bars.length, 0).sort((a, b) => a.time - b.time);
  let pairs = 0, alt = 0;
  const perLane = {};
  for (let i = 0; i < ns.length; i++) {
    const n = ns[i];
    if (n.pair >= 0) pairs++;
    if (isQuickAlt(ns, i)) {
      alt++;
      perLane[NAME[n.lane]] = (perLane[NAME[n.lane]] || 0) + 1;
    }
  }
  const lanes = levelLanes(lv).map((l) => NAME[l]).join('');
  const top = Object.entries(perLane).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  console.log(`${String(lv.id).padStart(3)}   ${String(lv.name).slice(0, 16).padEnd(18)}${lanes.padEnd(6)}${String(ns.length).padStart(4)}   ${String(pairs).padStart(5)}   ${String(alt).padStart(6)}${alt / ns.length >= ALT_SHARE ? ' ⚠' : '  '}  ${top}`);
}
