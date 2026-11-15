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
