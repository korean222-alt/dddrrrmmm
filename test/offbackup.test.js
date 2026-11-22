// 📴 서버 보관함: D1 이 막혀도 Neon 에 기록을 맡기고, D1 이 열리면 랭킹으로 옮김 (server/offbackup.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseSync } from 'node:sqlite';
import { D1Store, d1Local } from '../server/d1store.js';
import { backupSave, backupFlush } from '../server/offbackup.js';
import { sign } from '../server/session.js';
import { getLevel, noteCount, pointsFor } from '../public/js/charts.js';

function perfectRun(level) {
  const n = noteCount(getLevel(level));
  let score = 0;
  for (let i = 1; i <= n; i++) score += pointsFor('perfect', i);
  return { score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0, wrong: 0 } };
}

test('맡기기 → 최고점만 · 쿠키 없으면 거절 · 조작 점수 버림 → D1 열리면 옮기고 보관함 비움', async () => {
  const db = new PGlite();
  const pg = async (text, params) => (await db.query(text, params)).rows;
  const secret = 's';
  const cookie = 'kk_player=' + sign({ igsid: 'p1' }, secret);
  const now = Date.now();
  const at = now - 3600 * 1000;
  const pr = perfectRun(6);
  assert.equal((await backupSave({ pg, secret, cookieHeader: '', body: { records: [] } })).status, 401);
  const half = { ...pr, score: Math.floor(pr.score / 2), counts: { perfect: 0, great: 0, good: 0, miss: pr.counts.perfect, wrong: 0 }, maxCombo: 0 };
  half.score = 0;
  let r = await backupSave({ pg, secret, cookieHeader: cookie, body: { records: [{ level: 6, ...half, at }] }, now });
  assert.deepEqual(r.body.saved, ['6']);
  r = await backupSave({ pg, secret, cookieHeader: cookie, body: { records: [{ level: 6, ...pr, at }, { level: 7, ...perfectRun(7), score: 1e9, at }, { level: 'endless', rounds: 2, score: 900, at }] }, now });
  assert.deepEqual(r.body.saved.sort(), ['6', 'endless']);
  // 낮은 점수로 다시 맡겨도 안 내려감
  await backupSave({ pg, secret, cookieHeader: cookie, body: { records: [{ level: 6, ...half, at }] }, now });
  assert.equal(Number((await pg('SELECT score FROM offline_backup WHERE slot = 6', []))[0].score), pr.score);

  // D1: 계정 있음 → 옮김
  const d1 = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  await d1.q("INSERT INTO players (igsid, username, created_at) VALUES ('p1', '오프', 1)", []);
  const f = await backupFlush({ pg, d1, now });
  assert.equal(f.moved, 2);
  const s6 = (await d1.q('SELECT score, at, chk FROM scores WHERE igsid = $1 AND level = 6', ['p1']))[0];
  assert.equal(Number(s6.score), pr.score);
  assert.equal(Number(s6.at), at);
  assert.equal(JSON.parse(s6.chk).off, 1);
  assert.equal((await pg('SELECT * FROM offline_backup', [])).length, 0);
  // 이미 D1 에 더 좋은 기록이 있으면 그대로
  await backupSave({ pg, secret, cookieHeader: cookie, body: { records: [{ level: 6, ...half, at }] }, now });
  await backupFlush({ pg, d1, now });
  assert.equal(Number((await d1.q('SELECT score FROM scores WHERE igsid = $1 AND level = 6', ['p1']))[0].score), pr.score);
  // D1 이 막혀 있으면 오류 → 보관함 그대로
  await backupSave({ pg, secret, cookieHeader: cookie, body: { records: [{ level: 8, ...perfectRun(8), at }] }, now });
  const down = { q: async () => { throw new Error('D1_ERROR: limit'); }, batch: async () => { throw new Error('D1_ERROR'); } };
  await assert.rejects(backupFlush({ pg, d1: down, now }));
  assert.equal((await pg('SELECT * FROM offline_backup', [])).length, 1);
});
