// 🔑 로그인 열쇠를 쿠키 + 폰 저장소(X-Player) 둘 다로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-key-'));
const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
const handle = createHandler(cfg, { store: new JsonStore(cfg.dataFile).init() });
const call = (p, init) => handle(new Request('http://x' + p, init), { ip: '1.2.3.4' });

// 🔑 2026-11-25: 들어올 때마다 쿠키가 날아가 새 계정이 생기던 폰 → 열쇠를 X-Player 로도 주고받음
test('쿠키가 날아가도 폰 저장소 열쇠(X-Player)로 같은 계정 · 쿠키도 다시 줌', async () => {
  const r1 = await call('/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '열쇠시험', ig: 'key_test1' }) });
  assert.equal(r1.status, 200);
  const tok = r1.headers.get('x-player');
  assert.ok(tok && tok.includes('.'), '새 계정 열쇠를 헤더로 줌');
  // 쿠키 없이 헤더만 → 같은 계정 + 쿠키 다시
  const r2 = await call('/api/me', { headers: { 'X-Player': tok } });
  const me = await r2.json();
  assert.equal(me.player.username, '열쇠시험');
  assert.ok(r2.headers.getSetCookie().some((c) => c.startsWith('kk_player=')), '쿠키 다시 줌');
  // 쿠키만 있는 폰 → 헤더로 열쇠를 알려 줌 (저장소에 하나 갖게)
  const ck = `kk_player=${encodeURIComponent(tok)}`;
  const r3 = await call('/api/me', { headers: { Cookie: ck } });
  assert.equal(r3.headers.get('x-player'), tok);
  // 둘 다 있으면 조용히
  const r4 = await call('/api/me', { headers: { Cookie: ck, 'X-Player': tok } });
  assert.equal(r4.headers.get('x-player'), null);
  assert.equal(r4.headers.getSetCookie().length, 0);
  // 가짜 열쇠는 안 됨
  const r5 = await call('/api/me', { headers: { 'X-Player': tok.slice(0, -2) + 'xx' } });
  assert.equal((await r5.json()).verified, false);
  // 로그아웃 → '-' (폰 저장소에서 지움)
  const r6 = await call('/api/logout', { method: 'POST', headers: { 'X-Player': tok } });
  assert.equal(r6.headers.get('x-player'), '-');
});
