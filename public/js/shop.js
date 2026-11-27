// 🛒 상점 (2026-11-22): 코인으로 꾸미기를 삼. 서버(handler)와 폰(main)이 같은 가격표를 씀
//   11-22 밤 개편(사용자 '이미 있는 배경·드럼 말고 새로 만들어야 희귀성 · 색만 바뀌어서 안 사고 싶음'):
//   맵 배경·맵 드럼·색만 바꾸는 콩 색은 무료로 돌리고, 상점엔 상점에서만 파는 새 것만.
//   콩 스킨 = 색 + 질감 + 꼬리·반짝이 효과(render.js NOTE_PALETTES fx), 배경 = 새 그림(themes.js img), 드럼 = 새 마감(themes.js SHOP_KITS)

//   id = 'bg:sakura' · 'kit:goldkit' · 'notes:flame' · 'bg:photo' · 'ui:live'(화면 스타일 세트) (설정 → 꾸미기의 decoOwned 와 같은 모양)

/** 맵 8개 (배경·드럼 세트로 고를 수 있는 것, 무료) */
export const DECO_THEMES = ['sunset', 'city', 'hall', 'void', 'lava', 'aurora', 'xmas', 'space'];
/** 색만 바꾸는 콩 색 (무료) */
export const NOTE_FREE = ['candy', 'neon', 'ocean', 'fire', 'mono'];

/** 상점 물건: [id, 값, 등급] — 등급 rare 레어 · epic 에픽 · legend 전설 */
export const SHOP_ITEMS = [
  // 🎤 세트 (2026-11-22, 사용자 요청: 리듬게임 라이브 화면 스타일 세트) = 화면 스타일(render.js live) + 세트 무대 · 11-23 1만 → 2만 · 11-24 2만5천
  ['ui:live', 25000, 'epic'],
  // 🥇 시즌 1 한정 세트 (2026-11-23 사용자 '시즌1 때만, 1 을 강조, 세트로, 1111') = 금빛 「1」 콩 + 시즌 1 무대 + 황금 드럼. 시즌 1 끝나면 못 삼(LIMITED)
  ['ui:s1', 1111, 'limited'], // 11-24 사용자: 등급 「한정」, 11/27 까지 팖
  // 2026-11-24 사용자: 레어 5천 · 에픽 1만 · 전설 4만 (시즌 1 세트·라이브 세트만 따로)
  ['notes:galaxy', 40000, 'legend'],
  ['notes:gold', 40000, 'legend'],
  ['notes:cyber', 10000, 'epic'],
  ['notes:flame', 5000, 'rare'],
  ['notes:ice', 5000, 'rare'],
  ['notes:heart', 5000, 'rare'],
  ['bg:palace', 10000, 'epic'],
  ['bg:cybercity', 10000, 'epic'],
  ['bg:sakura', 5000, 'rare'],
  ['bg:abyss', 5000, 'rare'],
  ['bg:photo', 5000, 'rare'],
  ['kit:goldkit', 10000, 'epic'],
  ['kit:neonkit', 5000, 'rare'],
  ['kit:crystal', 5000, 'rare'],
  ['kit:rainbow', 5000, 'rare'],
];
/** 기간 한정: 이 시각(ms)이 지나면 못 삼 (산 사람은 계속 씀) */
//   🥇 시즌 1 세트: 11-24 사용자 '27일까지' → 11/27 23:59:59 KST (시즌 1 은 11/26 끝)
export const S1_SALE_END = Date.UTC(2026, 10, 27, 14, 59, 59);
export const LIMITED = { 'ui:s1': S1_SALE_END };
/** 지금 살 수 있나 (한정 물건 기간 확인) */
/** 판매 끝 (산 사람은 계속 씀): 📷 내 사진 — 2026-11-27 사용자 '내 사진 넣기 스킨 빼고' */
export const RETIRED = new Set(['bg:photo']);
export const onSale = (id, now = Date.now()) => !RETIRED.has(id) && !(LIMITED[id] && now > LIMITED[id]);
const PRICE = new Map(SHOP_ITEMS.map(([id, p]) => [id, p]));
export const RARITY = Object.fromEntries(SHOP_ITEMS.map(([id, , r]) => [id, r]));
export const RARITY_NAME = { rare: '레어', epic: '에픽', legend: '전설', limited: '한정' };

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

/** 💎 코인 말고 다이아도 같이 내야 하는 것 (2026-11-27 사용자 '라이브 세트는 다이아 3개도') */
export const SHOP_GEMS = { 'ui:live': 3 };
export const gemPriceOf = (id) => SHOP_GEMS[id] || 0;

/**
 * 사기: 지갑 { coins, owned, s2: { gm 다이아 } } → { ok, wallet, error }
 *   이미 있으면 ok(돈 안 냄), 모자라면 not_enough
 */
export function buyItem(w, id, now = Date.now()) {
  const price = priceOf(id);
  if (price == null) return { ok: false, error: 'bad_item', wallet: w };
  const owned = cleanOwned(w.owned);
  if (owned.includes(id)) return { ok: true, already: true, wallet: { ...w, owned } };
  if (!onSale(id, now)) return { ok: false, error: 'season_over', wallet: { ...w, owned } };
  if ((w.coins || 0) < price) return { ok: false, error: 'not_enough', wallet: { ...w, owned } };
  const gems = gemPriceOf(id);
  const s2 = (w.s2 && typeof w.s2 === 'object' && w.s2) || {};
  if (gems && (s2.gm || 0) < gems) return { ok: false, error: 'not_enough_gems', wallet: { ...w, owned } };
  return { ok: true, wallet: { ...w, coins: w.coins - price, owned: [...owned, id], ...(gems ? { s2: { ...s2, gm: s2.gm - gems } } : {}) } };
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
/**
 * boards = { stage: [{igsid, rank}], endless: [...] } → [{ igsid, coins, board, rank, also }] 사람마다 가장 큰 것 하나
 *   단 1·2·3등이 두 판 이상이면 그 1·2·3등 보상을 다 더함 (2026-11-27 사용자: 단계 1등 + 무제한 2등 = 17만). also = 더한 다른 판들
 */
export function seasonRewards(boards) {
  const best = new Map();
  for (const board of ['stage', 'endless', 'tiles']) {
    for (const r of boards[board] || []) {
      const coins = seasonReward(r.rank);
      if (!coins || !r.igsid) continue;
      const o = best.get(r.igsid);
      if (o && o.rank <= 3 && r.rank <= 3) {
        const big = coins > o.coins ? { board, rank: r.rank } : { board: o.board, rank: o.rank };
        const small = coins > o.coins ? { board: o.board, rank: o.rank } : { board, rank: r.rank };
        best.set(r.igsid, { igsid: r.igsid, coins: o.coins + coins, ...big, also: [...(o.also || []), small] });
      } else if (!o || coins > o.coins) best.set(r.igsid, { igsid: r.igsid, coins, board, rank: r.rank });
    }
  }
  return [...best.values()];
}
