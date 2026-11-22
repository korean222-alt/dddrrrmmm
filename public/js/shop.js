// 🛒 상점 (2026-11-22): 코인으로 꾸미기를 삼. 서버(handler)와 폰(main)이 같은 가격표를 씀
//   사용자 결정: 보통 꾸미기는 싸게, 특별한 건 비싸게(랭커만 살 정도)
//   id = 'bg:city' · 'kit:lava' · 'notes:neon' · 'bg:photo' (설정 → 꾸미기의 decoOwned 와 같은 모양)

/** 맵 8개 (배경·드럼 세트로 고를 수 있는 것) */
export const DECO_THEMES = ['sunset', 'city', 'hall', 'void', 'lava', 'aurora', 'xmas', 'space'];
/** 보통 콩 색 / ✨ 특별 콩 색 */
export const NOTE_SHOP = ['candy', 'neon', 'ocean', 'fire', 'mono'];
export const NOTE_PREMIUM = { gold: 30000, galaxy: 50000 };

export const PRICES = {
  notes: 1000,
  bg: 1500,
  kit: 2000,
  photo: 5000,
};

/** 이 물건 값 (팔지 않는 것이면 null) */
export function priceOf(id) {
  const [type, key] = String(id || '').split(':');
  if (type === 'bg' && key === 'photo') return PRICES.photo;
  if ((type === 'bg' || type === 'kit') && DECO_THEMES.includes(key)) return PRICES[type];
  if (type === 'notes') {
    if (NOTE_SHOP.includes(key)) return PRICES.notes;
    if (NOTE_PREMIUM[key]) return NOTE_PREMIUM[key];
  }
  return null;
}

/** 서버가 받은 산 목록 정리 (모르는 것·겹친 것 빼기) */
export function cleanOwned(list) {
  return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string' && priceOf(x) != null))] : [];
}

/**
 * 사기: 지갑 { coins, owned } → { ok, wallet, error }
 *   이미 있으면 ok(돈 안 냄), 모자라면 not_enough
 */
export function buyItem(w, id) {
  const price = priceOf(id);
  if (price == null) return { ok: false, error: 'bad_item', wallet: w };
  const owned = cleanOwned(w.owned);
  if (owned.includes(id)) return { ok: true, already: true, wallet: { ...w, owned } };
  if ((w.coins || 0) < price) return { ok: false, error: 'not_enough', wallet: { ...w, owned } };
  return { ok: true, wallet: { ...w, coins: w.coins - price, owned: [...owned, id] } };
}
