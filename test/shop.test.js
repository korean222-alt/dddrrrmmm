import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOf, buyItem, cleanOwned, legacyRefund, seasonReward, seasonRewards, SHOP_ITEMS } from '../public/js/shop.js';
import { NOTE_PALETTES } from '../public/js/render.js';
import { THEMES, SHOP_KITS } from '../public/js/themes.js';

test('가격표: 상점 전용만 팜 · 예전 맵 배경·드럼·색 콩은 안 팜(무료)', () => {
  assert.equal(priceOf('notes:galaxy'), 50000);
  assert.equal(priceOf('notes:gold'), 30000);
  assert.equal(priceOf('bg:photo'), 5000);
  for (const old of ['notes:neon', 'bg:city', 'kit:lava', 'notes:basic', 'bg:auto', 'kit:nope']) assert.equal(priceOf(old), null, old);
  assert.deepEqual(cleanOwned(['bg:sakura', 'bg:sakura', 'bg:city', 7]), ['bg:sakura']);
  // 파는 물건은 다 그림·드럼·스킨이 있음
  for (const [id] of SHOP_ITEMS) {
    const [type, key] = id.split(':');
    if (type === 'notes') assert.ok(NOTE_PALETTES[key] && NOTE_PALETTES[key].fx && NOTE_PALETTES[key].shop, id);
    if (type === 'bg' && key !== 'photo') assert.ok(THEMES[key] && THEMES[key].img, id);
    if (type === 'kit') assert.ok(SHOP_KITS[key] && SHOP_KITS[key].kit.shell, id);
  }
});

test('예전에 산 것 돌려주기', () => {
  assert.deepEqual(legacyRefund(['notes:neon', 'bg:city', 'kit:lava', 'notes:gold', 'bg:photo']), { refund: 4500, keep: ['notes:gold', 'bg:photo'] });
  assert.deepEqual(legacyRefund(null), { refund: 0, keep: [] });
});

test('사기', () => {
  let r = buyItem({ coins: 7000, owned: [] }, 'notes:flame');
  assert.equal(r.ok, true);
  assert.equal(r.wallet.coins, 1000);
  r = buyItem(r.wallet, 'notes:flame');
  assert.equal(r.already, true);
  assert.equal(r.wallet.coins, 1000);
  assert.equal(buyItem(r.wallet, 'kit:goldkit').error, 'not_enough');
  assert.equal(buyItem(r.wallet, 'notes:zzz').error, 'bad_item');
});

test('🏆 시즌 보상: 등수별 · 두 판에 다 들면 큰 것 하나만', () => {
  assert.deepEqual([1, 2, 3, 4, 10, 11, 50, 51, 100, 101].map(seasonReward), [100000, 70000, 50000, 10000, 10000, 5000, 5000, 3000, 3000, 0]);
  const r = seasonRewards({
    stage: [{ igsid: 'a', rank: 1 }, { igsid: 'b', rank: 2 }, { igsid: 'c', rank: 60 }],
    endless: [{ igsid: 'c', rank: 3 }, { igsid: 'a', rank: 2 }, { igsid: 'd', rank: 120 }],
  });
  const by = Object.fromEntries(r.map((x) => [x.igsid, x]));
  assert.equal(r.length, 3);
  assert.deepEqual([by.a.coins, by.a.board, by.a.rank], [100000, 'stage', 1]);
  assert.equal(by.b.coins, 70000);
  assert.deepEqual([by.c.coins, by.c.board, by.c.rank], [50000, 'endless', 3]);
});
