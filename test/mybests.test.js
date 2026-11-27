// 📦 브라우저를 바꾸고 로그인하면 곡 목록 결과(단계·무제한·타일)를 서버에서 되받기 (2026-11-27)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler, tileBestsFromScores } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';
import { TILE_SONGS, tileSlot, lapGrade, tileLap } from '../public/js/tiles.js';

test('/api/my-bests: 단계 기록 + 타일 기록(바퀴 → 별·다이아)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-mb-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const r1 = await h(new Request('http://x/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '기록받기', ig: 'mb_test' }) }), { ip: '1.1.1.1' });
  assert.equal(r1.status, 200);
  const tok = r1.headers.get('x-player');
  const pl = store.data ? Object.entries(store.data.players || {}).find(([, p]) => p.username === '기록받기') : null;
  const igsid = pl ? pl[0] : null;
  assert.ok(igsid);
  const a = TILE_SONGS[0].id;
  const b = TILE_SONGS[1].id;
  store.recordScore(igsid, 3, { score: 50000, grade: 'A', maxCombo: 40 });
  store.recordScore(igsid, tileSlot(a), { score: 900, grade: lapGrade(3), maxCombo: 100 });
  store.recordScore(igsid, tileSlot(b), { score: 5, grade: lapGrade(0), maxCombo: 5 });
  const r = await h(new Request('http://x/api/my-bests', { headers: { 'X-Player': tok } }), { ip: '1.1.1.1' });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.bests[3].score, 50000);
  assert.ok(!Object.keys(d.bests).some((k) => Number(k) >= 3000), '타일은 단계 기록에 안 섞임');
  assert.deepEqual(d.tiles[a], { tiles: 900, laps: 3, stars: 3, gems: 2, at: 0 });
  assert.equal(d.tiles[b].laps, 0);
  assert.ok(d.tiles[b].stars < 3);
  // 로그인 안 하면 401
  assert.equal((await h(new Request('http://x/api/my-bests'), { ip: '1.1.1.1' })).status, 401);
});

test('타일 첫 바퀴 못 끝낸 기록은 친 비율로 별', () => {
  const id = TILE_SONGS[0].id;
  const per = tileLap(id).tiles.length;
  const t = tileBestsFromScores([{ level: tileSlot(id), score: Math.ceil(per * 0.7), grade: 'L0', maxCombo: 0 }]);
  assert.equal(t[id].stars, 2);
  assert.equal(t[id].gems, 0);
});
