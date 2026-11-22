// 🧯 DB 가 막혔을 때(D1 하루 한도 등): 503 db_down 을 주고, 5분 동안은 DB 를 안 건드림
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';

test('DB 오류(한도 초과) → 503 db_down · 그 뒤엔 DB 안 건드리고 바로 db_down', async () => {
  let calls = 0;
  const boom = () => {
    calls++;
    throw new Error('D1_ERROR: Exceeded maximum daily rows read');
  };
  const store = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : boom) });
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: '/dev/null', FREE_PASS_UNTIL: '0' });
  const handle = createHandler(cfg, { store });
  const r1 = await handle(new Request('http://x/api/health?boot=1'));
  assert.equal(r1.status, 503);
  assert.equal((await r1.json()).error, 'db_down');
  const n = calls;
  const r2 = await handle(new Request('http://x/api/me'));
  assert.equal(r2.status, 503);
  assert.equal((await r2.json()).error, 'db_down');
  assert.equal(calls, n, 'DB 를 다시 안 부름');
});

test('DB 가 쉬는 동안에도 관리자 화면 로그인은 됨 (사용량 요청 = "쉬는 중", 비밀번호는 확인)', async () => {
  let calls = 0;
  const boom = () => {
    calls++;
    throw new Error('D1_ERROR: Exceeded maximum daily rows read');
  };
  const store = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : boom) });
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: '/dev/null', FREE_PASS_UNTIL: '0', ADMIN_TOKEN: 'pw' });
  const handle = createHandler(cfg, { store, meter: { r: 0, w: 0, q: 0 } });
  assert.equal((await handle(new Request('http://x/api/me'))).status, 503);
  const n = calls;
  const ok = await handle(new Request('http://x/api/admin/usage', { headers: { 'x-admin-token': 'pw' } }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).dbDown, true);
  assert.equal(calls, n, 'DB 를 다시 안 부름');
  assert.equal((await handle(new Request('http://x/api/admin/usage', { headers: { 'x-admin-token': 'nope' } }))).status, 503);
});
