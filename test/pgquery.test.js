// Postgres 저장소: 요청 줄이려고 한 문장으로 합친 쿼리(점수 저장·내 등수·통계 묶음)가 예전과 같은 결과인지
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PgStore } from '../server/pgstore.js';

async function fresh() {
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  return { q, store: await new PgStore(q).init() };
}

test('recordScore: 처음·더 낮음·더 높음·없는 참여자', async () => {
  const { store } = await fresh();
  await store.upsertPlayer('g_a', { username: 'a', ig: 'a1' });
  assert.deepEqual(await store.recordScore('g_a', 5, { score: 500, grade: 'A', maxCombo: 3 }), { improved: true, best: 500 });
  assert.deepEqual(await store.recordScore('g_a', 5, { score: 400, grade: 'B', maxCombo: 1 }), { improved: false, best: 500 });
  assert.deepEqual(await store.recordScore('g_a', 5, { score: 500, grade: 'B', maxCombo: 1 }), { improved: false, best: 500 });
  assert.deepEqual(await store.recordScore('g_a', 5, { score: 900, grade: 'S', maxCombo: 9 }), { improved: true, best: 900 });
  assert.equal((await store.scoresOf('g_a'))[0].grade, 'S');
  assert.equal(await store.recordScore('g_nobody', 5, { score: 1, grade: null, maxCombo: 0 }), null);
  assert.equal((await store.scoresOf('g_nobody')).length, 0);
  // 무제한(BIGINT) 값
  assert.deepEqual(await store.recordScore('g_a', 0, { score: 25e9 + 1, grade: null, maxCombo: 0 }), { improved: true, best: 25e9 + 1 });
});

test('rankOf: 점수 순 → 같으면 먼저 낸 사람, 인증 안 된 사람은 빠짐', async () => {
  const { q, store } = await fresh();
  for (const id of ['g_a', 'g_b', 'g_c', 'g_d']) {
    await store.upsertPlayer(id, { username: id, ig: id });
    await store.setChecked(id, true);
  }
  await store.setChecked('g_d', false);
  await q('INSERT INTO scores VALUES ($1, 3, 100, null, 0, 10), ($2, 3, 200, null, 0, 10), ($3, 3, 100, null, 0, 5), ($4, 3, 999, null, 0, 1)', ['g_a', 'g_b', 'g_c', 'g_d']);
  assert.deepEqual(await store.rankOf(3, 'g_b'), { rank: 1, score: 200 });
  assert.deepEqual(await store.rankOf(3, 'g_c'), { rank: 2, score: 100 });
  assert.deepEqual(await store.rankOf(3, 'g_a'), { rank: 3, score: 100 });
  assert.equal(await store.rankOf(3, 'g_d'), null);
  assert.equal(await store.rankOf(4, 'g_a'), null);
});

test('trackPlays: 같은 판의 시작+끝이 한 번에 와도 합쳐서 한 줄', async () => {
  const { q, store } = await fresh();
  await store.trackPlays([
    { id: 'play00001', sid: 'sess0001', vid: 'v', level: '3', mode: 'normal', startedAt: 1000 },
    { id: 'play00001', sid: 'sess0001', vid: 'v', level: '3', mode: 'normal', startedAt: 900, endedAt: 2000, result: 'clear', score: 777, stars: 3, sec: 60 },
    { id: 'play00002', sid: 'sess0001', vid: 'v', level: '4', mode: 'normal', startedAt: 2100 },
  ]);
  const rows = await q('SELECT id, started_at, ended_at, result, score, stars, sec FROM plays ORDER BY id');
  assert.equal(rows.length, 2);
  assert.equal(Number(rows[0].started_at), 1000);
  assert.equal(Number(rows[0].ended_at), 2000);
  assert.equal(rows[0].result, 'clear');
  assert.equal(Number(rows[0].score), 777);
  assert.equal(rows[1].ended_at, null);
  // 나중에 끝만 와도 이어서 채움
  await store.trackPlays([{ id: 'play00002', sid: 'sess0001', vid: 'v', level: '4', startedAt: 2000, endedAt: 3000, result: 'fail', score: 5, stars: 0, sec: 30 }]);
  const r2 = await q("SELECT started_at, result FROM plays WHERE id = 'play00002'");
  assert.equal(Number(r2[0].started_at), 2100);
  assert.equal(r2[0].result, 'fail');
  await store.trackPlays([]);
});
