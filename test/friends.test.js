// 🙂👥 남의 프로필 보기 · 친구 (2026-11-28): 랭킹 판 + 닉네임으로 찾음, 친구는 settings 한 줄
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';
import { seasonAt } from '../public/js/season.js';
import { tileSlot } from '../public/js/tiles.js';

test('프로필 보기 · 친구 추가·목록·끊기', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-fr-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const req = (method, url, body, tok) => h(new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }), { ip: '1.1.1.3' });
  const mk = async (name, ig) => (await req('POST', '/api/guest', { name, ig })).headers.get('x-player');
  const a = await mk('친구A', 'fr_a');
  const b = await mk('친구B', 'fr_b');
  await req('POST', '/api/intro', { intro: { t: '나는 B', i: 'piano', s: 3 } }, b);
  const n = seasonAt().n;
  for (const p of Object.values(store.data.players)) {
    p.checkedAt = p.checkedAt || Date.now();
    const rec = { score: p.username === '친구B' ? 5000 : 1000, at: Date.now(), grade: 'L1' };
    store.data.seasonScores[`${n}|${p.igsid}`] = { [tileSlot(3)]: rec };
    p.bests[tileSlot(3)] = rec;
  }
  // 프로필: 타일 총합 판에서 닉네임으로
  const pr = await req('GET', '/api/profile?b=tiles&u=' + encodeURIComponent('친구B'), null, a);
  assert.equal(pr.status, 200);
  const p = (await pr.json()).p;
  assert.equal(p.username, '친구B');
  assert.equal(p.intro.t, '나는 B');
  assert.equal(p.score, 5000);
  assert.equal(p.rank, 1);
  assert.equal(p.friend, false);
  assert.equal(p.igsid, undefined, 'igsid 는 안 보냄');
  assert.equal((await req('GET', '/api/profile?b=tiles&u=없는사람', null, a)).status, 404);
  // 곡 판에서도
  assert.equal((await req('GET', '/api/profile?b=t3&u=' + encodeURIComponent('친구B'))).status, 200);
  // 친구 추가 → 목록 (나 + B, 점수 순)
  assert.equal((await req('POST', '/api/friends', { add: { b: 'tiles', u: '친구A' } }, a)).status, 400, '나는 못 추가');
  assert.equal((await req('POST', '/api/friends', { add: { b: 'tiles', u: '친구B' } }, a)).status, 200);
  const l = await (await req('GET', '/api/friends', null, a)).json();
  assert.deepEqual(l.list.map((c) => [c.username, !!c.me, c.friend]), [['친구B', false, true], ['친구A', true, false]]);
  assert.equal(JSON.stringify(l).includes('igsid'), false);
  assert.equal((await (await req('GET', '/api/profile?b=tiles&u=' + encodeURIComponent('친구B'), null, a)).json()).p.friend, true);
  // 끊기
  await req('POST', '/api/friends', { del: -1, u: '친구B' }, a);
  const l2 = await (await req('GET', '/api/friends', null, a)).json();
  assert.deepEqual(l2.list.map((c) => c.username), ['친구A']);
  assert.equal((await req('GET', '/api/friends')).status, 401);
});

// D1(SQLite)·Postgres 저장소의 친구 카드 쿼리 (쿼리 1번, 숨긴 사람 빼고, 기록 없으면 0)
for (const kind of ['d1', 'pg']) {
  test(`[${kind}] friendCards`, async () => {
    let store;
    if (kind === 'd1') {
      const { DatabaseSync } = await import('node:sqlite');
      const { D1Store, d1Local } = await import('../server/d1store.js');
      store = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
    } else {
      const { PGlite } = await import('@electric-sql/pglite');
      const { PgStore } = await import('../server/pgstore.js');
      const db = new PGlite();
      store = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
    }
    await store.upsertPlayer('g1', { username: '하나', ig: 'one' });
    await store.upsertPlayer('g2', { username: '둘', ig: 'two' });
    await store.setIntro('g1', { t: '안녕', s: 3, i: '' });
    await store.recordSeasonScore(2, 'g1', tileSlot(3), 700);
    await store.recordSeasonScore(2, 'g1', tileSlot(4), 300);
    await store.recordSeasonScore(2, 'g1', 5, 99999); // 드럼 기록은 안 셈
    const cards = (await store.friendCards(2, ['g1', 'g2', 'g3'])).sort((a, b) => b.score - a.score);
    assert.deepEqual(cards.map((c) => [c.username, c.score, c.n]), [['하나', 1000, 2], ['둘', 0, 0]]);
    assert.equal(cards[0].intro.t, '안녕');
    assert.deepEqual(await store.friendCards(2, []), []);
  });
}
