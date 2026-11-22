import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOf, buyItem, cleanOwned, NOTE_PREMIUM } from '../public/js/shop.js';

test('가격표: 보통은 싸게, 특별 콩 색은 비싸게, 모르는 건 null', () => {
  assert.equal(priceOf('notes:neon'), 1000);
  assert.equal(priceOf('bg:city'), 1500);
  assert.equal(priceOf('kit:lava'), 2000);
  assert.equal(priceOf('bg:photo'), 5000);
  assert.equal(priceOf('notes:gold'), NOTE_PREMIUM.gold);
  assert.ok(priceOf('notes:galaxy') >= 30000);
  assert.equal(priceOf('notes:basic'), null);
  assert.equal(priceOf('bg:auto'), null);
  assert.equal(priceOf('kit:nope'), null);
  assert.deepEqual(cleanOwned(['bg:city', 'bg:city', 'x', 7]), ['bg:city']);
});

test('사기', () => {
  let r = buyItem({ coins: 1200, owned: [] }, 'notes:neon');
  assert.equal(r.ok, true);
  assert.equal(r.wallet.coins, 200);
  r = buyItem(r.wallet, 'notes:neon');
  assert.equal(r.already, true);
  assert.equal(r.wallet.coins, 200);
  assert.equal(buyItem(r.wallet, 'kit:lava').error, 'not_enough');
  assert.equal(buyItem(r.wallet, 'notes:zzz').error, 'bad_item');
});
