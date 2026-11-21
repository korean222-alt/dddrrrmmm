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

test('init: 표 만들기는 한 번에 (Cloudflare 무료 = 요청당 바깥 연결 50번) · 두 번째부턴 1번', async () => {
  const db = new PGlite();
  let n = 0;
  const q = async (text, params) => (n++, (await db.query(text, params)).rows);
  await new PgStore(q).init();
  assert.ok(n <= 35, `처음(빈 DB, 옛 기록 옮기기 전부) init 쿼리 ${n}번`);
  // 표가 다 생겼는지
  for (const t of ['players', 'scores', 'used_runs', 'rooms', 'maps', 'season_scores', 'hall', 'ranked_runs'])
    assert.ok((await q(`SELECT to_regclass('public.${t}') AS t`))[0].t, t);
  // 표 설계가 바뀐 척(표시 지움) → 다시 돌아도 문제없고 쿼리 수 적음
  await q(`DELETE FROM settings WHERE key LIKE 'schema:%'`);
  n = 0;
  await new PgStore(q).init();
  assert.ok(n <= 15, `다시 init 쿼리 ${n}번`);
  n = 0;
  await new PgStore(q).init();
  assert.equal(n, 1);
});

test('cleanup: 지난 판 토큰·끝난 방·지난 옮기기 코드·1년 넘은 통계만 지움', async () => {
  const { q, store } = await fresh();
  const now = Date.now();
  await store.useRun('old', now - 1000);
  await store.useRun('new', now + 1000);
  await store.createRoom('1111', { a: 1 }, now - 10_000, now - 1);
  await store.createRoom('2222', { a: 1 }, now, now + 10_000);
  await store.putTransfer('111111', { x: 1 }, now - 10_000, now - 1);
  await store.putTransfer('222222', { x: 1 }, now, now + 10_000);
  await store.trackSession({ sid: 'oldsess1', vid: 'v', now: now - 500 * 86400000, activeSec: 1 });
  await store.trackSession({ sid: 'newsess1', vid: 'v', now, activeSec: 1 });
  await store.trackPlays([{ id: 'oldplay1', sid: 'oldsess1', vid: 'v', level: '1', startedAt: now - 500 * 86400000 }, { id: 'newplay1', sid: 'newsess1', vid: 'v', level: '1', startedAt: now }]);
  await store.cleanup(now);
  const col = async (sql) => (await q(sql)).map((r) => Object.values(r)[0]).join();
  assert.equal(await col('SELECT nonce FROM used_runs'), 'new');
  assert.equal(await col('SELECT code FROM rooms'), '2222');
  assert.equal(await col('SELECT code FROM transfers'), '222222');
  assert.equal(await col('SELECT sid FROM sessions'), 'newsess1');
  assert.equal(await col('SELECT id FROM plays'), 'newplay1');
  // 다 쓴 토큰을 지운 뒤에도 살아 있는 토큰은 여전히 한 번만
  assert.equal(await store.useRun('new', now + 1000), false);
});
