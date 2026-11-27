// 📝 내 프로필 「소개」 탭: /api/intro 저장 → /api/me 에 보임 · 검사 (2026-11-27)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';
import { cleanIntro } from '../public/js/avatars.js';

test('cleanIntro: 60자·악기·곡 번호만', () => {
  assert.equal(cleanIntro(null), null);
  assert.equal(cleanIntro({ t: '   ' }), null);
  assert.deepEqual(cleanIntro({ t: ' 안녕\n하세요 ', i: 'piano', s: 3 }), { t: '안녕 하세요', s: 3, i: 'piano' });
  assert.equal(cleanIntro({ t: 'a'.repeat(100) }).t.length, 60);
  assert.deepEqual(cleanIntro({ t: 'x', i: 'guitar', s: -1 }), { t: 'x', s: 0, i: '' });
});

test('/api/intro 저장하면 /api/me 에 소개가 보임 · 계정 없으면 401', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-intro-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const post = (url, body, tok) => h(new Request('http://x' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}) }, body: JSON.stringify(body) }), { ip: '1.1.1.2' });
  assert.equal((await post('/api/intro', { intro: { t: 'hi' } })).status, 401);
  const r1 = await post('/api/guest', { name: '소개왕', ig: 'intro_test' });
  const tok = r1.headers.get('x-player');
  const r = await post('/api/intro', { intro: { t: '엘리제 깨는 중', i: 'piano', s: 18 } }, tok);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).player.intro, { t: '엘리제 깨는 중', s: 18, i: 'piano' });
  const me = await (await h(new Request('http://x/api/me', { headers: { 'X-Player': tok } }), { ip: '1.1.1.2' })).json();
  assert.equal(me.player.intro.t, '엘리제 깨는 중');
  // 지우기
  await post('/api/intro', { intro: null }, tok);
  const me2 = await (await h(new Request('http://x/api/me', { headers: { 'X-Player': tok } }), { ip: '1.1.1.2' })).json();
  assert.equal(me2.player.intro, null);
});
