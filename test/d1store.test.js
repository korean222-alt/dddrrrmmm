// D1(SQLite) 저장소가 Postgres 저장소(PGlite)와 똑같이 동작하는지 — 따로 다시 쓴 메서드 위주
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { PgStore } from '../server/pgstore.js';
import { D1Store, d1Local, toSqlite } from '../server/d1store.js';

async function both() {
  const db = new PGlite();
  const pq = async (text, params) => (await db.query(text, params)).rows;
  const pg = await new PgStore(pq).init();
  const lite = d1Local(new DatabaseSync(':memory:'));
  const d1 = await new D1Store(lite).init();
  return { pg, d1, pq, dq: lite.q };
}

test('toSqlite: $1 → ?1, 형 변환 빼기', () => {
  assert.equal(toSqlite('SELECT $1::bigint, $12, data->>\'$.a\''), "SELECT ?1, ?12, data->>'$.a'");
});

test('init: 두 번째부턴 쿼리 1번 · 옛 기록 옮기기는 했음으로 표시', async () => {
  const lite = d1Local(new DatabaseSync(':memory:'));
  let n = 0;
  const counted = { q: (t, p) => (n++, lite.q(t, p)), batch: (l) => ((n += l.length), lite.batch(l)) };
  await new D1Store(counted).init();
  assert.ok(n < 40, `처음 init 문장 ${n}개 (D1 무료 = 요청당 50번)`);
  n = 0;
  await new D1Store(counted).init();
  assert.equal(n, 1);
  assert.ok((await lite.q("SELECT 1 FROM settings WHERE key = 'migration:reset-level-18-v2'")).length);
});

test('점수·랭킹·참여자·통계가 Postgres 와 같은 결과', async () => {
  const { pg, d1, pq, dq } = await both();
  const out = {};
  for (const [name, s] of Object.entries({ pg, d1 })) {
    const r = [];
    for (const id of ['g_a', 'g_b', 'g_c']) {
      await s.upsertPlayer(id, { username: id + '닉', ig: id + '_ig' });
      await s.setChecked(id, true);
    }
    await s.upsertPlayer('g_b', { username: null, ig: 'changed' }); // 아이디 바뀜 → 확인 풀림
    r.push(await s.getPlayer('g_b'));
    r.push(await s.recordScore('g_a', 5, { score: 500, grade: 'A', maxCombo: 3 }));
    r.push(await s.recordScore('g_a', 5, { score: 400, grade: 'B', maxCombo: 1 }));
    r.push(await s.recordScore('g_a', 5, { score: 900, grade: 'S', maxCombo: 9 }));
    r.push(await s.recordScore('g_nobody', 5, { score: 1, grade: null, maxCombo: 0 }));
    r.push(await s.recordScore('g_c', 5, { score: 800, grade: 'S', maxCombo: 9 }));
    r.push(await s.recordScore('g_c', 0, { score: 25e9 + 1, grade: null, maxCombo: 0 }));
    r.push(await s.rankOf(5, 'g_c'));
    r.push((await s.leaderboard(5)).rows.map((x) => [x.igsid, x.score, x.rank]));
    r.push((await s.totalLeaderboard()).rows.map((x) => [x.igsid, x.score, x.levels]));
    r.push(await s.totalRankOf('g_c'));
    r.push((await s.listPlayers()).sort((a, b) => a.igsid.localeCompare(b.igsid)).map((p) => [p.igsid, p.total, p.levels, p.top, p.endless, p.checkedAt != null]));
    r.push((await s.playersByName(' G_A닉 ')).map((p) => [p.igsid, p.scores]));
    await s.moveScores('g_a', 'g_c');
    r.push((await s.scoresOf('g_c')).sort((a, b) => a.level - b.level));
    await s.recordSeasonScore(2, 'g_c', 3, 70);
    await s.recordSeasonScore(2, 'g_c', 3, 50);
    r.push((await s.seasonBoard(2, 'stage')).rows.map((x) => [x.igsid, x.score, x.rank]));
    r.push(await s.setHidden('g_c', true, 1));
    r.push(await s.purgeHidden(Date.now()));
    r.push(await s.expireTempChecks());
    await s.trackSession({ sid: 's1', vid: 'v1', now: 100, activeSec: 5 });
    await s.trackSession({ sid: 's1', vid: 'v1', now: 200, activeSec: 3 });
    // 9줄 넘게 한 번에 (D1 바인딩 100개 제한 → 끊어 보냄)
    await s.trackPlays(Array.from({ length: 23 }, (_, i) => ({ id: 'p' + i, sid: 's1', vid: 'v1', level: String(i), startedAt: 100 + i, endedAt: i % 2 ? 900 : null, result: i % 2 ? 'clear' : null, score: i })));
    await s.trackPlays([{ id: 'p0', sid: 's1', vid: 'v1', level: '0', startedAt: 1, endedAt: 999, result: 'fail' }]);
    const st = await s.statsRaw(0, 1e15);
    r.push(st.sessions, st.plays.sort((a, b) => a.id.localeCompare(b.id)), st.newVids);
    const sid = await s.addSuggestion({ at: 5, kind: 'k', body: 'b', nick: 'n', vid: 'v1', contact: null });
    r.push(sid, await s.setSuggestionDone(sid, true, 7), await s.listSuggestions(0), await s.countSuggestions('v1', 0));
    const rid = await s.addRecoverRequest({ token: 'tok', at: 1, nick: 'n', oldIg: 'o', nowIg: 'w', memo: null, fromIgsid: 'g_b' });
    r.push(await s.setRecoverRequest(rid, { status: 'ok', igsid: 'g_b' }, 9), await s.recoverRequestByToken('tok'));
    r.push(await s.useRun('n1', 10), await s.useRun('n1', 10));
    r.push(await s.secret('session') === (await s.secret('session')));
    await s.setSetting('x', 3);
    r.push(await s.getSetting('x'));
    out[name] = r;
  }
  assert.deepEqual(out.d1, out.pg);
  // 테스트 끝 표시: 두 DB 의 줄 수 같음
  for (const t of ['players', 'scores', 'season_scores', 'plays', 'sessions'])
    assert.equal(Number((await dq(`SELECT COUNT(*) AS n FROM ${t}`))[0].n), Number((await pq(`SELECT COUNT(*) AS n FROM ${t}`))[0].n), t);
});

test('맵·투표·맵 점수·랭킹전 기록이 Postgres 와 같은 결과', async () => {
  const { pg, d1 } = await both();
  const out = {};
  for (const [name, s] of Object.entries({ pg, d1 })) {
    const r = [];
    r.push(await s.addMap({ id: 'm1', igsid: 'g_a', nick: 'n', name: '맵', bpm: 120.5, bars: 8, diff: 2, data: { notes: [1, 2, { a: null }] }, at: 10 }));
    r.push(await s.addMap({ id: 'm1', igsid: 'g_a', nick: 'n', name: '맵', bpm: 120, bars: 8, diff: 2, data: {}, at: 10 }));
    r.push(await s.countMapsBy('g_a', 0), await s.listMaps('top'), await s.getMap('m1', { play: true }));
    r.push(await s.voteMap('m1', 'u1', 'like', true), await s.voteMap('m1', 'u1', 'like', true), await s.voteMap('m1', 'u2', 'like', true), await s.voteMap('m1', 'u2', 'like', false));
    for (const u of ['u1', 'u2', 'u3']) r.push(await s.voteMap('m1', u, 'report', true, 77));
    r.push(await s.getMap('m1'), await s.addMapScore('m1', 'g_a', 'n', 'free', 5));
    await s.addMap({ id: 'm2', igsid: 'g_a', nick: 'n', name: '맵2', bpm: 90, bars: 4, diff: 1, data: [], at: 11 });
    r.push(await s.addMapScore('m2', 'g_a', 'n', 'free', 5), await s.addMapScore('m2', 'g_a', 'n2', 'free', 3), await s.addMapScore('m2', 'g_b', 'b', 'free', 9), await s.addMapScore('m2', 'g_b', 'b', 'hearts', 1));
    r.push(await s.topMapScores('m2'));
    r.push(await s.deleteMap('m2', 'g_x'), await s.deleteMap('m2', 'g_a'), await s.topMapScores('m2'));
    for (const [igsid, level, rating] of [['a', 3, 1000], ['b', 4, 1200], ['c', 5, 990], ['d', 3, 1010]]) await s.putRankedRun({ igsid, level, rating, at: 50 });
    r.push(await s.pickRankedRuns('d', 1000, [3, 5], 0));
    await s.putRanked({ season: 's1', igsid: 'a', rating: 1100, games: 2, at: 3 });
    await s.putRanked({ season: 's1', igsid: 'a', rating: 1150, games: 3, at: 4 });
    r.push(await s.getRanked('a', 's1'), await s.topRanked('s1'));
    await s.hallInsert([{ season: 1, board: 'stage', rank: 1, igsid: 'a', username: 'A', score: 5, n: 2, rounds: 0, at: 9 }]);
    r.push(await s.hallSetImage(1, 'stage', 1, 'data:x', 'b'), await s.hallSetImage(1, 'stage', 1, 'data:x', 'a'), await s.hallList());
    out[name] = r;
  }
  assert.deepEqual(out.d1, out.pg);
});

test('친구 대결 방: patchRoom(얕게 합치기·조건)·findOpenRooms·옮기기 코드가 Postgres 와 같은 결과', async () => {
  const { pg, d1 } = await both();
  const out = {};
  const now = 1000;
  for (const [name, s] of Object.entries({ pg, d1 })) {
    const r = [];
    r.push(await s.createRoom('1234', { status: 'lobby', round: 0, pub: 'rush', host: 'a', opts: { x: 1, y: 2 }, players: { a: { name: 'A', ready: null, deep: { k: 1 } } } }, now, now + 100));
    r.push(await s.createRoom('1234', {}, now, now + 100));
    r.push(await s.findOpenRooms('rush', 0, now));
    // b 들어오기 (자리 비었을 때만)
    r.push(await s.patchRoom('1234', { top: { opts: { z: 3 } }, slot: 'b', player: { name: 'B', ready: false }, cond: { slotFree: 'b', status: 'lobby', round: 0 } }, now + 1, now + 200));
    r.push(await s.patchRoom('1234', { slot: 'b', player: { name: 'B2' }, cond: { slotFree: 'b' } }, now + 2, now + 200));
    r.push(await s.findOpenRooms('rush', 0, now));
    // 내 값만 합치기 (deep 은 통째로 바뀜, 없던 키 추가, null 넣기)
    r.push(await s.patchRoom('1234', { slot: 'a', player: { ready: true, deep: { j: 2 }, live: null } }, now + 3, now + 200));
    // 조건 안 맞음
    r.push(await s.patchRoom('1234', { top: { status: 'playing' }, cond: { status: 'playing' } }, now + 4, now + 200));
    r.push(await s.patchRoom('1234', { top: { status: 'playing', round: 1 }, cond: { status: 'lobby', round: 0 } }, now + 4, now + 200));
    r.push(await s.patchRoom('1234', { top: { status: 'lobby' }, cond: { status: 'playing', round: 0 } }, now + 5, now + 200));
    // players 통째로 바꾸기
    r.push(await s.patchRoom('1234', { top: { players: { b: { name: 'B' } }, host: 'b', void: true } }, now + 6, now + 200));
    // 없는 자리에 처음 넣기 + players 가 아예 없던 방
    await s.createRoom('5555', { status: 'lobby' }, now, now + 100);
    r.push(await s.patchRoom('5555', { slot: 'a', player: { name: 'A' } }, now + 1, now + 100));
    r.push(await s.patchRoom('5555', {}, now + 2, now + 100));
    r.push(await s.patchRoom('9999', { top: { a: 1 } }, now, now + 100));
    r.push(await s.patchRoom('1234', { top: { a: 1 } }, now + 999, now + 100)); // 지난 방
    r.push(await s.getRoom('1234', now + 7), await s.getRoom('1234', now + 9999));
    r.push(await s.putTransfer('000001', { data: { a: [1] }, igsid: 'x' }, now, now + 10), await s.putTransfer('000001', {}, now, now + 10));
    r.push(await s.takeTransfer('000001', now), await s.takeTransfer('000001', now));
    await s.deleteRoom('5555');
    r.push(await s.getRoom('5555', now));
    out[name] = r;
  }
  assert.deepEqual(out.d1, out.pg);
});
