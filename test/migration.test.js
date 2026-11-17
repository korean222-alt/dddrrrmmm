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
  assert.equal(rows['g_a:0'], 24_000_999_999);
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
  assert.equal(b[0].score, 24_000_999_999);
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
  await q(`DELETE FROM settings WHERE key = 'migration:insert-level-8-v1'`);
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
