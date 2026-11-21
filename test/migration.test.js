// 인스타 아이디 등록 기능을 없앨 때: 이미 등록된 인스타 계정 기록은 지우고 닉네임 기록은 남김
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { PgStore } from '../server/pgstore.js';
import { JsonStore } from '../server/store.js';

test('Postgres: 인스타로 인증된 플레이어·점수·인증 코드는 삭제, 닉네임 기록은 유지 (한 번만)', async () => {
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  // 예전 DB 모양: codes 테이블 + 인증된 플레이어(m_ 수동 승인, 숫자 IGSID 웹훅) + 닉네임 플레이어
  await q(`CREATE TABLE codes (code TEXT PRIMARY KEY, purpose TEXT NOT NULL, session_id TEXT NOT NULL, status TEXT NOT NULL,
    created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, igsid TEXT, username TEXT, verified_at BIGINT, last_error TEXT, last_error_at BIGINT)`);
  await q(`CREATE TABLE players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`);
  await q(`CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`);
  await q(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await q(`INSERT INTO codes VALUES ('K7P2', 'ranking', 's', 'verified', 1, 2, 'm_drum.king', 'drum.king', 3, NULL, NULL)`);
  await q(`INSERT INTO players VALUES ('m_drum.king', 'drum.king', 1000), ('17841400000', 'someone', 2000), ('g_abc', '쿵짝왕', NULL)`);
  await q(`INSERT INTO scores VALUES ('m_drum.king', 2, 900, 'A', 10, 1), ('17841400000', 2, 800, 'B', 9, 1), ('g_abc', 2, 700, 'C', 8, 1)`);

  const store = await new PgStore(q).init();
  assert.equal((await q('SELECT igsid FROM players ORDER BY igsid')).map((r) => r.igsid).join(), 'g_abc');
  assert.equal((await q('SELECT igsid FROM scores')).map((r) => r.igsid).join(), 'g_abc');
  assert.equal((await q(`SELECT to_regclass('public.codes') AS t`))[0].t, null);
  await store.setChecked('g_abc', true); // 랭킹엔 팔로워 인증한 사람만
  const lb = await store.leaderboard(2);
  assert.equal(lb.rows.length, 1);
  assert.equal(lb.rows[0].username, '쿵짝왕');

  // 두 번째 시작부터는 다시 지우지 않음 (플래그)
  await q(`INSERT INTO players VALUES ('m_late', 'late', 5)`);
  await new PgStore(q).init();
  assert.equal((await q(`SELECT 1 FROM players WHERE igsid = 'm_late'`)).length, 1);
});

test('JSON 저장소: 인증된 인스타 플레이어는 시작할 때 지움', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-mig-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      codes: { K7P2: { code: 'K7P2', username: 'drum.king' } },
      players: {
        'm_drum.king': { igsid: 'm_drum.king', username: 'drum.king', followVerifiedAt: 1, bests: { 2: { score: 900 } } },
        g_abc: { igsid: 'g_abc', username: '쿵짝왕', followVerifiedAt: null, bests: { 2: { score: 700 } } },
      },
    })
  );
  const store = new JsonStore(file).init();
  assert.deepEqual(Object.keys(store.data.players), ['g_abc']);
  assert.equal(store.data.codes, undefined);
  store.flush();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).codes, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('랭킹에서 내린 참여자는 5일 지나면 자동 삭제 (JSON · Postgres 저장소 둘 다)', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PgStore } = await import('../server/pgstore.js');
  const db = new PGlite();
  const pg = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-hide-'));
  const js = new JsonStore(path.join(dir, 'db.json')).init();
  const DAY = 86400000;
  const t0 = Date.UTC(2026, 10, 1);
  for (const store of [js, pg]) {
    await store.upsertPlayer('g_a', { username: '내림', ig: 'a' });
    await store.upsertPlayer('g_b', { username: '그대로', ig: 'b' });
    await store.recordScore('g_a', 2, { score: 500, grade: 'A', maxCombo: 1 });
    await store.setHidden('g_a', true, t0);
    assert.equal((await store.leaderboard(2, 50)).rows.length, 0, '내린 사람은 랭킹에서 안 보임');
    assert.equal(await store.purgeHidden(t0 + 4 * DAY), 0, '4일째엔 안 지움');
    assert.ok(await store.getPlayer('g_a'));
    assert.equal(await store.purgeHidden(t0 + 5 * DAY + 1), 1, '5일 지나면 지움');
    assert.equal(await store.getPlayer('g_a'), null);
    assert.ok(await store.getPlayer('g_b'));
  }
  js.flush();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('무제한 기록: 예전 방식(깬 단계 × 100만, 점수 999,999 에서 잘림) → 새 방식(× 10억) (JSON · Postgres)', async () => {
  // Postgres: 예전 DB 는 score 가 INTEGER
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  await q(`CREATE TABLE players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`);
  await q(`CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`);
  await q(`INSERT INTO players VALUES ('g_a', '그리그왕', NULL), ('g_b', '단계왕', NULL)`);
  // g_a: 그리그 Lv.24 (999,999 에서 잘림) + 7단계 일반 점수 / g_b: 5단계 무제한(level -5) Lv.3 · 41,000
  await q(`INSERT INTO scores VALUES ('g_a', 0, 24999999, NULL, 0, 1), ('g_a', 7, 650000, 'S', 100, 1), ('g_b', -5, 3041000, NULL, 0, 1)`);
  const pg = await new PgStore(q).init();
  await new PgStore(q).init(); // 두 번 돌려도 그대로
  const rows = Object.fromEntries((await q('SELECT igsid, level, score FROM scores')).map((r) => [`${r.igsid}:${r.level}`, Number(r.score)]));
  assert.equal(rows['g_a:0'], 24_001_507_200, '999,999 로 잘린 점수는 깬 단계로 어림');
  assert.equal(rows['g_a:7'], 650000, '일반 단계 점수는 안 건드림');
  assert.equal(rows['g_b:-5'], 3_000_041_000);
  // 이제 100만 점이 넘어도 그대로 저장
  const out = await pg.recordScore('g_a', 0, { score: 25 * 1e9 + 1_620_000, grade: null, maxCombo: 0 });
  assert.equal(out.improved, true);
  await pg.setChecked('g_a', true); // 랭킹엔 팔로워 인증한 사람만
  assert.equal((await pg.leaderboard(0, 50)).rows[0].score, 25 * 1e9 + 1_620_000);

  // JSON 저장소
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-end-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ players: { g_a: { igsid: 'g_a', username: '그리그왕', bests: { 0: { score: 24999999 }, 7: { score: 650000 }, '-5': { score: 3041000 } } } } }));
  const js = new JsonStore(file).init();
  const b = js.data.players.g_a.bests;
  assert.equal(b[0].score, 24_001_507_200);
  assert.equal(b[7].score, 650000);
  assert.equal(b[-5].score, 3_000_041_000);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('8단계에 신곡이 끼면서: 예전 8~14단계 기록이 9~15단계로 한 번만 밀림 (Postgres + JSON)', async () => {
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  // 예전 DB: 새 곡이 끼기 전 (표시 없음)
  await q(`CREATE TABLE players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`);
  await q(`CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`);
  await q(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await q(`INSERT INTO players VALUES ('g_a', '가')`);
  await new PgStore(q).init(); // plays 테이블은 init 이 만듦. 그 뒤에 예전 모양 통계를 넣고 다시 돌려 확인
  await q(`DELETE FROM settings WHERE key = 'migration:insert-level-8-v1' OR key LIKE 'schema:%'`);
  await q(`DELETE FROM scores`);
  await q(`INSERT INTO scores VALUES ('g_a', 7, 70, 'A', 1, 1), ('g_a', 8, 80, 'A', 1, 1), ('g_a', 9, 90, 'A', 1, 1), ('g_a', 14, 140, 'A', 1, 1),
    ('g_a', 0, 5000000000, 'A', 1, 1), ('g_a', -7, 7, 'A', 1, 1), ('g_a', -8, 8, 'A', 1, 1), ('g_a', -14, 14, 'A', 1, 1)`);
  for (const [id, lv] of [['p1', '7'], ['p2', '8'], ['p3', '14'], ['p4', 'e8'], ['p5', 'e14'], ['p6', 'endless'], ['p7', 'e7']])
    await q(`INSERT INTO plays (id, sid, vid, level, started_at) VALUES ($1, 's', 'v', $2, 1)`, [id, lv]);
  await new PgStore(q).init();
  await new PgStore(q).init(); // 두 번 돌려도 한 번만 밀림
  const sc = Object.fromEntries((await q('SELECT level, score FROM scores')).map((r) => [Number(r.level), Number(r.score)]));
  assert.deepEqual(sc, { 7: 70, 9: 80, 10: 90, 15: 140, 0: 5000000000, '-7': 7, '-9': 8, '-15': 14 });
  const pl = Object.fromEntries((await q('SELECT id, level FROM plays')).map((r) => [r.id, r.level]));
  assert.deepEqual(pl, { p1: '7', p2: '9', p3: '15', p4: 'e9', p5: 'e15', p6: 'endless', p7: 'e7' });

  // JSON 저장소: 파일에 표시가 없으면 한 번 밀고, 다시 열어도 안 밈. 새로 만든 파일엔 처음부터 표시
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-shift-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ players: { g_a: { igsid: 'g_a', bests: { 7: { score: 70 }, 8: { score: 80 }, '-8': { score: 8 } } } }, plays: { x: { id: 'x', level: 'e8' }, y: { id: 'y', level: 3 } } }));
  const js = new JsonStore(file).init();
  assert.deepEqual(Object.keys(js.data.players.g_a.bests).sort(), ['-9', '7', '9']);
  assert.equal(js.data.plays.x.level, 'e9');
  assert.equal(js.data.plays.y.level, 3);
  js.flush();
  const again = new JsonStore(file).init();
  assert.deepEqual(Object.keys(again.data.players.g_a.bests).sort(), ['-9', '7', '9']);
  const fresh = new JsonStore(path.join(dir, 'new.json')).init();
  assert.ok(fresh.data.settings['migration:insert-level-8-v1']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('8단계 이전이 15단계 칸 충돌로 멈춘 DB 복구: 비켜 둔 점수를 제자리로, 없어진 곡 점수만 지움, 두 번 안 돌림', async () => {
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  await new PgStore(q).init();
  const T = 1_000_000;
  // 멈춘 상태: 이전 표시는 있고(T 에 시작), 점수는 1008~1014 에 비켜 있고, 15단계 칸엔 없어진 어려운 운명 점수(T 전) + 이전 뒤 새로 친 점수
  // 1008 = 예전 8단계 → 9단계, 1014 = 예전 14단계 → 15단계, -1008 = 예전 무제한 8 → -9
  await q(`DELETE FROM settings`);
  await q(`INSERT INTO settings VALUES ('migration:insert-level-8-v1', '${T}')`);
  await q(`INSERT INTO players (igsid, username) VALUES ('a', '가'), ('b', '나'), ('c', '다')`);
  await q(`INSERT INTO scores VALUES
    ('a', 7, 70, 'A', 1, 5),
    ('a', 1008, 90, 'A', 1, 5), ('b', 1008, 10, 'C', 1, 5), ('a', 1014, 140, 'A', 1, 5), ('b', 1014, 100, 'B', 1, 5),
    ('a', -1008, 9, 'A', 1, 5),
    ('a', 15, 298926, 'A', 1, ${T - 10}), ('c', 15, 111, 'B', 1, ${T - 5}), ('c', -15, 222, 'B', 1, ${T - 5}),
    ('b', 15, 120, 'C', 1, ${T + 10}), ('a', 9, 50, 'C', 1, ${T + 20}), ('b', 9, 95, 'S', 1, ${T + 20}), ('a', 8, 80, 'A', 1, ${T + 30})`);
  await q(`INSERT INTO plays (id, sid, vid, level, started_at) VALUES ('p1', 's', 'v', '14', ${T - 5}), ('p2', 's', 'v', '15', ${T - 5}), ('p4', 's', 'v', 'e14', ${T - 5}), ('p3', 's', 'v', '9', ${T + 5})`);
  await new PgStore(q).init();
  await new PgStore(q).init();
  const sc = Object.fromEntries((await q('SELECT igsid, level, score FROM scores ORDER BY igsid, level')).map((r) => [`${r.igsid}:${r.level}`, Number(r.score)]));
  assert.deepEqual(sc, {
    'a:7': 70,
    'a:8': 80,
    'a:9': 90,
    'a:15': 140,
    'a:-9': 9,
    'b:9': 95,
    'b:15': 120,
  });
  const pl = Object.fromEntries((await q('SELECT id, level FROM plays')).map((r) => [r.id, r.level]));
  assert.deepEqual(pl, { p1: '15', p3: '9', p4: 'e15' });
});

test('Postgres: 표 만들기·옮기기는 한 번 끝나면 다음 시작 땐 한 줄만 확인 (Cloudflare 가 서버를 자주 새로 띄움)', async () => {
  const db = new PGlite();
  let n = 0;
  const q = async (text, params) => {
    n++;
    return (await db.query(text, params)).rows;
  };
  await new PgStore(q).init();
  assert.ok(n > 15, `처음엔 표를 다 만듦 (${n}번)`);
  n = 0;
  const store = await new PgStore(q).init();
  assert.equal(n, 1, '두 번째부터는 한 번만');
  await store.putTransfer('123456', { a: 1 }, 0, Date.now() + 1000);
  assert.deepEqual(await store.takeTransfer('123456'), { a: 1 }, '표는 그대로 씀');
});

test('🎄 데크 더 홀즈(19) 랭킹 초기화: 새 곡으로 바뀌기 전 점수만 한 번 지움 (Postgres + JSON)', async () => {
  const { DECK_RESET_BEFORE } = await import('../server/pgstore.js');
  const old = DECK_RESET_BEFORE - 1000;
  const fresh = DECK_RESET_BEFORE + 1000;
  // Postgres
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  await q(`CREATE TABLE players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`);
  await q(`CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`);
  await q(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await q(`INSERT INTO players VALUES ('g_a', 'a', NULL), ('g_b', 'b', NULL)`);
  await q(`INSERT INTO scores VALUES ('g_a', 19, 900, 'A', 10, ${old}), ('g_b', 19, 800, 'B', 9, ${fresh}), ('g_a', 2, 700, 'C', 8, ${old}), ('g_a', 21, 600, 'C', 8, ${old})`);
  await new PgStore(q).init();
  const left = (await q('SELECT igsid, level FROM scores ORDER BY igsid, level')).map((r) => `${r.igsid}:${r.level}`).join();
  assert.equal(left, 'g_a:2,g_a:21,g_b:19');
  // 한 번만: 다시 시작해도 그 뒤 점수는 그대로
  await q(`INSERT INTO scores VALUES ('g_a', 19, 500, 'C', 1, ${old})`);
  await new PgStore(q).init();
  assert.equal((await q(`SELECT 1 FROM scores WHERE igsid = 'g_a' AND level = 19`)).length, 1);
  // JSON
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-mig-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ settings: { 'migration:insert-level-8-v1': '1' }, players: {
    g_a: { igsid: 'g_a', username: 'a', bests: { 19: { score: 900, at: old }, 2: { score: 700, at: old } } },
    g_b: { igsid: 'g_b', username: 'b', bests: { 19: { score: 800, at: fresh } } },
  } }));
  const store = new JsonStore(file).init();
  assert.deepEqual(Object.keys(store.data.players.g_a.bests), ['2']);
  assert.equal(store.data.players.g_b.bests[19].score, 800);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('18단계 엘리제를 위하여: 그 전 18번(빼 버린 찬송가) 점수만 한 번 지움 (Postgres + JSON)', async () => {
  const { ELISE_FROM } = await import('../server/pgstore.js');
  const old = ELISE_FROM - 1000;
  const fresh = ELISE_FROM + 1000;
  const db = new PGlite();
  const q = async (text, params) => (await db.query(text, params)).rows;
  await q(`CREATE TABLE players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`);
  await q(`CREATE TABLE scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`);
  await q(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await q(`INSERT INTO players VALUES ('g_a', 'a', NULL), ('g_b', 'b', NULL)`);
  await q(`INSERT INTO scores VALUES ('g_a', 18, 900, 'A', 10, ${old}), ('g_a', -18, 900, 'A', 10, ${old}), ('g_b', 18, 800, 'B', 9, ${fresh}), ('g_a', 17, 700, 'C', 8, ${old})`);
  await new PgStore(q).init();
  const left = (await q('SELECT igsid, level FROM scores ORDER BY igsid, level')).map((r) => `${r.igsid}:${r.level}`).join();
  assert.equal(left, 'g_a:17,g_b:18');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-mig-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ settings: { 'migration:insert-level-8-v1': '1', 'migration:reset-level-19-v1': '1' }, players: {
    g_a: { igsid: 'g_a', username: 'a', bests: { 18: { score: 900, at: old }, 17: { score: 700, at: old } } },
    g_b: { igsid: 'g_b', username: 'b', bests: { 18: { score: 800, at: fresh } } },
  } }));
  const store = new JsonStore(file).init();
  assert.deepEqual(Object.keys(store.data.players.g_a.bests), ['17']);
  assert.equal(store.data.players.g_b.bests[18].score, 800);
  fs.rmSync(dir, { recursive: true, force: true });
});
