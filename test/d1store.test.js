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
    r.push({ ...(await s.getPlayer('g_b')), createdAt: undefined });
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
    // 통계는 D1 에서 덜 씀(끝난 판만·접속은 10분마다) → 끝난 판·첫 접속 기준으로 비교
    // st(세션 시작)·fresh(처음 온 방문자): D1 은 시간 순 표에, Postgres 는 무시
    await s.trackSession({ sid: 's1', vid: 'v1', now: 100, activeSec: 5, st: 100, fresh: true });
    await s.trackSession({ sid: 's1', vid: 'v1', now: 100 + 600000, activeSec: 9, st: 100 });
    // 9줄 넘게 한 번에 (D1 바인딩 100개 제한 → 끊어 보냄)
    await s.trackPlays(Array.from({ length: 23 }, (_, i) => ({ id: 'p' + i, sid: 's1', vid: 'v1', level: String(i), startedAt: 100 + i, endedAt: i % 2 ? 900 : null, result: i % 2 ? 'clear' : null, score: i })));
    await s.trackPlays([{ id: 'p0', sid: 's1', vid: 'v1', level: '0', startedAt: 1, endedAt: 999, result: 'fail' }]);
    const st = await s.statsRaw(0, 1e15);
    r.push(st.sessions, st.plays.filter((p) => p.result && p.id !== 'p0').sort((a, b) => a.id.localeCompare(b.id)), st.newVids);
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
  // (D1 접속 통계는 시간 순 표 sessions_t 에)
  for (const t of ['players', 'scores', 'season_scores', 'sessions'])
    assert.equal(Number((await dq(`SELECT COUNT(*) AS n FROM ${t === 'sessions' ? 'sessions_t' : t}`))[0].n), Number((await pq(`SELECT COUNT(*) AS n FROM ${t}`))[0].n), t);
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

test('D1 통계는 덜 씀: 시작만 한 판은 안 남고, 접속은 10분 넘게 지났을 때만 고침', async () => {
  const raw = d1Local(new DatabaseSync(':memory:'));
  const lite = { ...raw, q: async (t, p) => (await raw.q(t, p)).map((r) => ({ ...r })) };
  const d1 = await new D1Store(lite).init();
  await d1.trackPlays([{ id: 'play0001', sid: 's', vid: 'v', level: '3', startedAt: 10 }]);
  assert.equal((await lite.q('SELECT COUNT(*) AS n FROM plays_t'))[0].n, 0);
  await d1.trackPlays([
    { id: 'play0002', sid: 's', vid: 'v', level: '3', startedAt: 10 },
    { id: 'play0002', sid: 's', vid: 'v', level: '3', startedAt: 5, endedAt: 70, result: 'clear', score: 9, stars: 3, sec: 60 },
  ]);
  assert.deepEqual(await lite.q('SELECT id, started_at, ended_at, result FROM plays_t'), [{ id: 'play0002', started_at: 10, ended_at: 70, result: 'clear' }]);
  await d1.trackSession({ sid: 's', vid: 'v', now: 1000, activeSec: 1 });
  await d1.trackSession({ sid: 's', vid: 'v', now: 1000 + 60000, activeSec: 50 });
  assert.deepEqual(await lite.q('SELECT last_at, active_sec FROM sessions'), [{ last_at: 1000, active_sec: 1 }]);
  await d1.trackSession({ sid: 's', vid: 'v', now: 1000 + 600000, activeSec: 300 });
  assert.deepEqual(await lite.q('SELECT last_at, active_sec FROM sessions'), [{ last_at: 601000, active_sec: 300 }]);
  // 새 폰(st 를 보냄)은 시간 순 표에, 같은 규칙(10분)
  await d1.trackSession({ sid: 's2', vid: 'v', now: 2000, activeSec: 1, st: 1990, fresh: true });
  await d1.trackSession({ sid: 's2', vid: 'v', now: 2000 + 60000, activeSec: 50, st: 1990 });
  assert.deepEqual(await lite.q('SELECT started_at, last_at, active_sec, fresh FROM sessions_t'), [{ started_at: 1990, last_at: 2000, active_sec: 1, fresh: 1 }]);
  // 관리자 통계: 시간 순 표는 기간만, 그 전 기간은 예전 표(legacy:false 면 건너뜀)
  const st = await d1.statsRaw(1500, 5000);
  assert.deepEqual([st.sessions.map((x) => x.sid), st.newVids], [['s2'], ['v']]);
  const all = await d1.statsRaw(0, 1e15, { legacy: false });
  assert.equal(all.legacySkipped, true);
  assert.deepEqual(all.sessions.map((x) => x.sid), ['s2']);
  assert.deepEqual((await d1.statsRaw(0, 1e15)).sessions.map((x) => x.sid).sort(), ['s', 's2']);
  // 통계 표엔 색인 없음 (쓰기 아끼기)
  assert.deepEqual((await lite.q("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('plays', 'sessions', 'plays_t', 'sessions_t') AND name NOT LIKE 'sqlite_%'")), []);
});

test('D1 등수는 위 사람을 RANK_CAP 명까지만 셈 (읽기 아끼기) · 같은 점수는 먼저 낸 사람이 위', async () => {
  const { RANK_CAP } = await import('../server/d1store.js');
  const lite = d1Local(new DatabaseSync(':memory:'));
  const d1 = await new D1Store(lite).init();
  const n = RANK_CAP + 5;
  for (let i = 0; i < n; i++) {
    await lite.q('INSERT INTO players (igsid, username, created_at, checked_at) VALUES (?1, ?2, 1, 1)', ['p' + i, 'n' + i]);
    await lite.q('INSERT INTO scores (igsid, level, score, at) VALUES (?1, 4, ?2, ?3)', ['p' + i, 1000 - (i >> 1), i]);
  }
  assert.deepEqual(await d1.rankOf(4, 'p0'), { rank: 1, score: 1000 });
  assert.deepEqual(await d1.rankOf(4, 'p1'), { rank: 2, score: 1000 });
  assert.deepEqual(await d1.rankOf(4, 'p10'), { rank: 11, score: 995 });
  assert.deepEqual(await d1.rankOf(4, 'p' + (RANK_CAP - 1)), { rank: RANK_CAP, score: 1000 - ((RANK_CAP - 1) >> 1) });
  assert.equal((await d1.rankOf(4, 'p' + (n - 1))).over, true);
});

test('init: 예전 모양 표(열 없음)엔 없는 열만 추가 · 추가가 실패하면 다음에 다시 (11-22 운영 D1 에 wallet.owned·sessions_t.w 가 없었음)', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE wallet (igsid TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL DEFAULT 0, fday TEXT, fn INTEGER NOT NULL DEFAULT 0, init INTEGER NOT NULL DEFAULT 0, tn INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID');
  raw.exec('CREATE TABLE sessions_t (started_at INTEGER NOT NULL, sid TEXT NOT NULL, vid TEXT NOT NULL, last_at INTEGER NOT NULL, active_sec INTEGER NOT NULL DEFAULT 0, ref TEXT, device TEXT, fresh INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (started_at, sid)) WITHOUT ROWID');
  const lite = d1Local(raw);
  let fail = true;
  const flaky = { q: (t, p) => (fail && /^ALTER TABLE wallet ADD COLUMN gift/.test(t) ? Promise.reject(new Error('D1_ERROR: Exceeded maximum daily rows read')) : lite.q(t, p)), batch: (l) => lite.batch(l) };
  await assert.rejects(new D1Store(flaky).init());
  fail = false;
  await new D1Store(flaky).init();
  const cols = (t) => raw.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  for (const c of ['owned', 'gift']) assert.ok(cols('wallet').includes(c), c);
  assert.ok(cols('sessions_t').includes('w'));
});
