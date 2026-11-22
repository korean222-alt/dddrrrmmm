// Neon → D1 옮기기 스크립트(scripts/d1-sync.mjs): PGlite 를 Neon, node:sqlite 파일을 D1 로 놓고
//   전체 복사 → 맞춰 보기 → (바꾼 뒤) 따라잡기 → 되돌리기 까지 기록이 하나도 안 빠지는지
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { PgStore } from '../server/pgstore.js';
import { D1Store, d1Local } from '../server/d1store.js';
import { localPg, localSqlite, runCopy, runCatchup, runBack, runBackfill, compare, TABLES, lit } from '../scripts/d1-sync.mjs';

const quiet = () => {};

async function seed(s, tag, at) {
  for (const id of ['a', 'b', 'c'].map((x) => tag + x)) {
    await s.upsertPlayer(id, { username: '닉' + id, ig: id + "_i'g" });
    await s.setChecked(id, id.endsWith('c') ? 'temp' : true);
    await s.recordScore(id, 3, { score: 1000 + id.length, grade: 'A', maxCombo: 5 });
    await s.recordScore(id, 0, { score: 25e9 + 7, grade: null, maxCombo: 0 });
    await s.recordSeasonScore(2, id, 3, 50, at);
  }
  await s.addMap({ id: tag + 'm1', igsid: tag + 'a', nick: 'n', name: "맵 '따옴표'", bpm: 123.4, bars: 8, diff: 2, data: { notes: [1, 2, { z: null, '한글': '값' }] }, at });
  await s.voteMap(tag + 'm1', 'u1', 'like', true);
  await s.addMapScore(tag + 'm1', tag + 'a', 'n', 'free', 77, at);
  await s.addSuggestion({ at, kind: 'idea', body: tag + ' 건의\n줄바꿈', nick: 'n', vid: 'v', contact: null });
  await s.addRecoverRequest({ token: tag + 'tok', at, nick: 'n', oldIg: 'o', nowIg: 'w', memo: null, fromIgsid: null });
  await s.trackSession({ sid: tag + 's1', vid: 'v', now: at, activeSec: 3 });
  await s.trackPlays([{ id: tag + 'p1', sid: tag + 's1', vid: 'v', level: '3', startedAt: at }]);
  await s.putRankedRun({ igsid: tag + 'a', level: 3, rating: 1000, at, x: 1 });
}

test('Neon → D1 전체 복사 · 따라잡기 · 되돌리기', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-d1sync-'));
  const file = path.join(tmp, 'd1.sqlite');
  const pglite = new PGlite();
  const neonStore = await new PgStore(async (t, p) => (await pglite.query(t, p)).rows).init();
  const neon = await localPg(pglite);
  const d1 = await localSqlite(file);

  const old = Date.now() - 86400000;
  await seed(neonStore, 'o', old);
  await neonStore.hallInsert([{ season: 1, board: 'stage', rank: 1, igsid: 'oa', username: '닉oa', score: 5, n: 2, rounds: 0, at: old }]);
  await neonStore.hallSetImage(1, 'stage', 1, 'data:image/jpeg;base64,' + 'A'.repeat(60000));
  const secret = await neonStore.secret('session');

  await runCopy(neon, d1, { log: quiet });
  for (const r of await compare(neon, d1)) assert.deepEqual([r.table, r.missing, r.diff, r.extra], [r.table, 0, 0, 0]); // settings 의 d1:* 표시는 비교에서 빠짐

  // 미리 복사해 둔 뒤 다시 copy: 바뀐 줄만 + 시각이 안 바뀌는 고침(닉네임 변경)도 맞춰 보기에서 잡아 고침
  await neonStore.upsertPlayer('ob', { username: '새닉', ig: null });
  // 그 사이 Neon 에서 지워진 계정(계정 합치기·운영자 삭제)은 D1 에서도 지움 (11-22 랭킹에 지운 계정이 다시 보였던 것)
  await neonStore.deletePlayer('oa');
  // 지울 줄이 많아도 (D1 '식 깊이 100' 제한에 안 걸리게) — 가짜 점수 250개를 D1 에만
  await d1.q(`INSERT INTO scores (igsid, level, score, at) VALUES ${Array.from({ length: 250 }, (_, i) => `('ghost', ${i + 100}, 1, 1)`).join(', ')}`);
  await runCopy(neon, d1, { log: quiet });
  assert.equal((await d1.q("SELECT username FROM players WHERE igsid = 'ob'"))[0].username, '새닉');
  assert.equal((await d1.q("SELECT COUNT(*) AS n FROM players WHERE igsid = 'oa'"))[0].n, 0);
  assert.equal((await d1.q("SELECT COUNT(*) AS n FROM scores WHERE igsid = 'oa'"))[0].n, 0);
  assert.equal((await d1.q("SELECT COUNT(*) AS n FROM scores WHERE igsid = 'ghost'"))[0].n, 0);
  for (const r of await compare(neon, d1)) if (r.table !== 'settings') assert.equal(r.extra, 0, r.table);
  await neonStore.upsertPlayer('oa', { username: '닉oa', ig: "oa_i'g" }); // 아래 시험이 쓰는 계정 되살림
  await neonStore.setChecked('oa', true);
  await neonStore.recordScore('oa', 3, { score: 1002, grade: 'A', maxCombo: 5 });
  await runCopy(neon, d1, { log: quiet });

  // D1 저장소로 읽어도 똑같이 보임 (랭킹·맵·명예의 전당·로그인 키)
  const d1Store = await new D1Store(d1Local(new DatabaseSync(file))).init();
  assert.equal(await d1Store.secret('session'), secret);
  assert.deepEqual((await d1Store.leaderboard(3)).rows, (await neonStore.leaderboard(3)).rows);
  assert.deepEqual(await d1Store.getMap('om1'), await neonStore.getMap('om1'));
  assert.deepEqual(await d1Store.hallList(), await neonStore.hallList());
  assert.deepEqual(await d1Store.listSuggestions(), await neonStore.listSuggestions());
  assert.deepEqual(await d1Store.getPlayer('oc'), await neonStore.getPlayer('oc'));
  assert.deepEqual(await d1Store.topMapScores('om1'), await neonStore.topMapScores('om1'));

  // 복사 중·바꾸기 직전에 Neon 에 생긴 기록 + D1 로 바꾼 뒤 D1 에 생긴 기록
  await seed(neonStore, 'n', Date.now());
  await neonStore.recordScore('oa', 3, { score: 999999, grade: 'S', maxCombo: 9 }); // Neon 에서 점수 오름
  await d1Store.addSuggestion({ at: Date.now(), kind: 'idea', body: 'D1 에서 쓴 건의', nick: 'n', vid: 'v', contact: null });
  await d1Store.recordScore('ob', 3, { score: 5000, grade: 'S', maxCombo: 9 });
  await d1Store.upsertPlayer('d1only', { username: 'D1사람', ig: 'x' });

  await runCatchup(neon, d1, { log: quiet });
  const rep = await compare(neon, d1);
  for (const r of rep) assert.equal(r.missing, 0, r.table);
  assert.equal((await d1Store.scoresOf('oa')).find((x) => x.level === 3).score, 999999);
  assert.equal((await d1Store.scoresOf('ob')).find((x) => x.level === 3).score, 5000); // D1 의 더 높은 점수 그대로
  assert.ok(await d1Store.getPlayer('nc'));
  assert.equal((await d1Store.listSuggestions()).length, 3); // Neon 2 + D1 1, id 안 겹침
  assert.ok(await d1Store.recoverRequestByToken('ntok'));
  // 두 번 돌려도 그대로
  await runCatchup(neon, d1, { log: quiet });
  assert.equal((await d1Store.listSuggestions()).length, 3);

  // 통계(plays·sessions)는 copy·catchup 에서 빠지고 backfill 로 조금씩
  const stats = TABLES.filter((t) => t.backfill);
  assert.equal((await d1.q('SELECT COUNT(*) AS n FROM plays'))[0].n, 0);
  await neonStore.trackPlays(Array.from({ length: 30 }, (_, i) => ({ id: 'bf' + String(i).padStart(3, '0'), sid: 'os1', vid: 'v', level: '1', startedAt: old + (i % 7) })));
  // 바꾼 뒤 D1 에 이어진 접속 (같은 sid) → 합칠 때 처음 시각은 Neon 쪽
  await d1Store.trackSession({ sid: 'os1', vid: 'v', now: Date.now(), activeSec: 99 });
  let r1 = await runBackfill(neon, d1, { budget: 5, log: quiet });
  assert.deepEqual(r1, { written: 5, done: false });
  r1 = await runBackfill(neon, d1, { budget: 7, log: quiet });
  assert.equal(r1.done, false);
  r1 = await runBackfill(neon, d1, { budget: 1000, log: quiet });
  assert.equal(r1.done, true);
  for (const r of await compare(neon, d1, { tables: stats })) assert.equal(r.missing, 0, r.table);
  assert.equal((await d1.q('SELECT COUNT(*) AS n FROM plays'))[0].n, (await neon.q('SELECT COUNT(*) AS n FROM plays'))[0].n);
  assert.equal(Number((await d1.q("SELECT started_at FROM sessions WHERE sid = 'os1'"))[0].started_at), old);
  assert.equal((await runBackfill(neon, d1, { budget: 1000, log: quiet })).written, 0);

  // 되돌리기: D1 에서 생긴 기록이 Neon 으로
  await runBack(neon, d1, { log: quiet });
  assert.ok(await neonStore.getPlayer('d1only'));
  assert.equal((await neonStore.scoresOf('ob')).find((x) => x.level === 3).score, 5000);
  assert.equal((await neonStore.listSuggestions()).length, 3);
  for (const r of await compare(d1, neon)) assert.equal(r.missing, 0, r.table);
  // 옮기기 표시(d1:*)는 Neon 으로 안 넘어감
  assert.equal((await neon.q("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'd1%'"))[0].n, 0);
  // 되돌린 뒤 다시 migrate: 다시 copy 가 됨 (11-22 '이미 쓰는 중' 으로 멈췄던 것)
  await d1.q(`INSERT INTO settings (key, value) VALUES ('d1:switched_at', '1') ON CONFLICT (key) DO UPDATE SET value = '1'`);
  await neon.q(`INSERT INTO settings (key, value) VALUES ('d1:switched_at', '1')`);
  await runCopy(neon, d1, { log: quiet });
  assert.equal((await neon.q("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'd1%'"))[0].n, 0);

  // 이미 D1 을 쓰는 중이면 전체 복사(덮어쓰기)는 거절
  await d1.q(`INSERT INTO settings (key, value) VALUES ('d1:switched_at', '${Date.now() + 1000}') ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  await assert.rejects(runCopy(neon, d1, { log: quiet }), /이미 쓰이는 중/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('lit: 따옴표·숫자·JSON · 표 정의에 D1 표 열이 다 있음', async () => {
  assert.equal(lit("a'b", 't'), "'a''b'");
  assert.equal(lit('25000000007', 'i'), '25000000007');
  assert.equal(lit(null, 'i'), 'NULL');
  assert.equal(lit({ a: 1 }, 'j'), `'{"a":1}'`);
  assert.throws(() => lit('1; DROP', 'i'));
  const db = new DatabaseSync(':memory:');
  const store = await new D1Store(d1Local(db)).init();
  assert.ok(store);
  for (const t of TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map((c) => c.name);
    assert.deepEqual(cols.sort(), Object.keys(t.cols).sort(), t.name);
  }
});

test('createSchema: 비어 있는 예전 모양(보통 표) 통계·토큰 표는 WITHOUT ROWID 로 다시 만듦, 줄이 있으면 그대로', async () => {
  const { createSchema } = await import('../scripts/d1-sync.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-d1schema-'));
  const d1 = await localSqlite(path.join(tmp, 'x.sqlite'));
  await d1.q('CREATE TABLE used_runs (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
  await d1.q('CREATE TABLE plays (id TEXT PRIMARY KEY, sid TEXT NOT NULL, vid TEXT NOT NULL, level TEXT NOT NULL, mode TEXT, started_at INTEGER NOT NULL, ended_at INTEGER, result TEXT, score INTEGER, stars INTEGER, sec INTEGER)');
  await d1.q("INSERT INTO plays (id, sid, vid, level, started_at) VALUES ('p', 's', 'v', '1', 1)");
  await d1.q('CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at INTEGER NOT NULL, PRIMARY KEY (igsid, level))');
  await createSchema(d1);
  await createSchema(d1); // 두 번 돌려도 됨
  // 미리 복사해 둔 예전 scores 에도 나중에 더한 열(chk)이 생김
  assert.ok((await d1.q('PRAGMA table_info(scores)')).some((c) => c.name === 'chk'));
  const sqlOf = async (t) => (await d1.q(`SELECT sql FROM sqlite_master WHERE name = '${t}'`))[0].sql;
  assert.match(await sqlOf('used_runs'), /WITHOUT ROWID/);
  assert.doesNotMatch(await sqlOf('plays'), /WITHOUT ROWID/);
  assert.match(await sqlOf('sessions'), /WITHOUT ROWID/);
  assert.equal((await d1.q('SELECT COUNT(*) AS n FROM plays'))[0].n, 1);
  // D1 저장소: 판 토큰은 cleanup 에서 안 지움 (쓰기 아끼기), 한 번만 쓸 수 있는 건 그대로
  const store = await new D1Store(d1Local(new DatabaseSync(path.join(tmp, 'x.sqlite')))).init();
  assert.equal(await store.useRun('n1', 1), true);
  await store.cleanup(Date.now());
  assert.equal(await store.useRun('n1', 1), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('사이트 랭킹 비교: 같은 닉네임이 여럿이어도 틀리게 안 잡음 · 점수가 내려가거나 사라지면 잡음', async () => {
  const { boardDiff } = await import('../scripts/d1-site-check.mjs');
  const before = [['예빈', 252926], ['가', 240000], ['예빈', 226518]];
  assert.deepEqual(boardDiff(before, before), []);
  assert.deepEqual(boardDiff(before, [['예빈', 252926], ['가', 241000], ['예빈', 226518]]), []);
  assert.equal(boardDiff(before, [['예빈', 252926], ['가', 240000]]).length, 1); // 둘째 예빈 사라짐
  assert.equal(boardDiff(before, [['예빈', 226518], ['가', 240000], ['예빈', 226518]]).length, 1); // 점수 내려감
});
