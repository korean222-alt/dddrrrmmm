// 🛒 상점 (2026-11-22): 코인으로 꾸미기를 삼. 서버(handler)와 폰(main)이 같은 가격표를 씀
//   11-22 밤 개편(사용자 '이미 있는 배경·드럼 말고 새로 만들어야 희귀성 · 색만 바뀌어서 안 사고 싶음'):
//   맵 배경·맵 드럼·색만 바꾸는 콩 색은 무료로 돌리고, 상점엔 상점에서만 파는 새 것만.
//   콩 스킨 = 색 + 질감 + 꼬리·반짝이 효과(render.js NOTE_PALETTES fx), 배경 = 새 그림(themes.js img), 드럼 = 새 마감(themes.js SHOP_KITS)
import { SEASONS } from './season.js';

//   id = 'bg:sakura' · 'kit:goldkit' · 'notes:flame' · 'bg:photo' · 'ui:live'(화면 스타일 세트) (설정 → 꾸미기의 decoOwned 와 같은 모양)

/** 맵 8개 (배경·드럼 세트로 고를 수 있는 것, 무료) */
export const DECO_THEMES = ['sunset', 'city', 'hall', 'void', 'lava', 'aurora', 'xmas', 'space'];
/** 색만 바꾸는 콩 색 (무료) */
export const NOTE_FREE = ['candy', 'neon', 'ocean', 'fire', 'mono'];

/** 상점 물건: [id, 값, 등급] — 등급 rare 레어 · epic 에픽 · legend 전설 */
export const SHOP_ITEMS = [
  // 🎤 세트 (2026-11-22, 사용자 요청: 리듬게임 라이브 화면 스타일 세트) = 화면 스타일(render.js live) + 세트 무대 · 11-23 사용자 1만 → 2만
  ['ui:live', 20000, 'epic'],
  // 🥇 시즌 1 한정 콩 스킨 (2026-11-23 사용자 '시즌1 때만 얻을 수 있는 스킨, 1 을 강조') — 값도 1 로만, 시즌 1 끝나면 못 삼(LIMITED)
  ['notes:s1', 11111, 'legend'],
  ['notes:galaxy', 50000, 'legend'],
  ['notes:gold', 30000, 'legend'],
  ['notes:cyber', 9000, 'epic'],
  ['notes:flame', 6000, 'rare'],
  ['notes:ice', 6000, 'rare'],
  ['notes:heart', 6000, 'rare'],
  ['bg:palace', 15000, 'epic'],
  ['bg:cybercity', 10000, 'epic'],
  ['bg:sakura', 8000, 'rare'],
  ['bg:abyss', 8000, 'rare'],
  ['bg:photo', 5000, 'rare'],
  ['kit:goldkit', 12000, 'epic'],
  ['kit:neonkit', 7000, 'rare'],
  ['kit:crystal', 7000, 'rare'],
  ['kit:rainbow', 7000, 'rare'],
];
/** 기간 한정: 이 시각(ms)이 지나면 못 삼 (산 사람은 계속 씀) */
export const LIMITED = { 'notes:s1': SEASONS[0].end };
/** 지금 살 수 있나 (한정 물건 기간 확인) */
export const onSale = (id, now = Date.now()) => !(LIMITED[id] && now > LIMITED[id]);
const PRICE = new Map(SHOP_ITEMS.map(([id, p]) => [id, p]));
export const RARITY = Object.fromEntries(SHOP_ITEMS.map(([id, , r]) => [id, r]));
export const RARITY_NAME = { rare: '레어', epic: '에픽', legend: '전설' };

/** 이 물건 값 (팔지 않는 것이면 null) */
export function priceOf(id) {
  return PRICE.get(String(id || '')) ?? null;
}

/** 예전에 팔던 것(지금은 무료) 값 — 산 사람에게 돌려줌 */
export function legacyPrice(id) {
  const [type, key] = String(id || '').split(':');
  if (type === 'notes' && NOTE_FREE.includes(key)) return 1000;
  if (type === 'bg' && DECO_THEMES.includes(key)) return 1500;
  if (type === 'kit' && DECO_THEMES.includes(key)) return 2000;
  return 0;
}
/** 산 목록에서 예전 물건 빼고 돌려줄 코인 → { refund, keep } */
export function legacyRefund(list) {
  const keep = [];
  let refund = 0;
  for (const x of Array.isArray(list) ? list : []) {
    const p = legacyPrice(x);
    if (p) refund += p;
    else keep.push(x);
  }
  return { refund, keep };
}

/** 서버가 받은 산 목록 정리 (모르는 것·겹친 것 빼기) */
export function cleanOwned(list) {
  return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string' && priceOf(x) != null))] : [];
}

/**
 * 사기: 지갑 { coins, owned } → { ok, wallet, error }
 *   이미 있으면 ok(돈 안 냄), 모자라면 not_enough
 */
export function buyItem(w, id, now = Date.now()) {
  const price = priceOf(id);
  if (price == null) return { ok: false, error: 'bad_item', wallet: w };
  const owned = cleanOwned(w.owned);
  if (owned.includes(id)) return { ok: true, already: true, wallet: { ...w, owned } };
  if (!onSale(id, now)) return { ok: false, error: 'season_over', wallet: { ...w, owned } };
  if ((w.coins || 0) < price) return { ok: false, error: 'not_enough', wallet: { ...w, owned } };
  return { ok: true, wallet: { ...w, coins: w.coins - price, owned: [...owned, id] } };
}

// ---------------- 🏆 시즌 보상 (2026-11-22, 사용자 결정) ----------------
//   1등 10만 · 2등 7만 · 3등 5만 · 10등까지 1만 · 50등까지 5천 · 100등까지 3천
//   단계 총합·무제한 총합 둘 다 보고, 한 사람이 둘 다 들면 큰 것 하나만
export function seasonReward(rank) {
  if (rank === 1) return 100000;
  if (rank === 2) return 70000;
  if (rank === 3) return 50000;
  if (rank <= 10) return 10000;
  if (rank <= 50) return 5000;
  if (rank <= 100) return 3000;
  return 0;
}
/** boards = { stage: [{igsid, rank}], endless: [...] } → [{ igsid, coins, board, rank }] 사람마다 가장 큰 것 하나 */
export function seasonRewards(boards) {
  const best = new Map();
  for (const board of ['stage', 'endless']) {
    for (const r of boards[board] || []) {
      const coins = seasonReward(r.rank);
      if (!coins || !r.igsid) continue;
      const o = best.get(r.igsid);
      if (!o || coins > o.coins) best.set(r.igsid, { igsid: r.igsid, coins, board, rank: r.rank });
    }
  }
  return [...best.values()];
}
