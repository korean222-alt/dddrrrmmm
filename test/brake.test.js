// 🧯 한도 브레이크: 오늘 쓴 양을 세서 40%·60%·80% 에서 단계별로 줄임 (server/handler.js brake)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { D1Store, d1Local } from '../server/d1store.js';
import { createHandler, USAGE_LIMITS } from '../server/handler.js';
import { loadConfig } from '../server/config.js';

async function setup(meter) {
  const store = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: '/dev/null', FREE_PASS_UNTIL: '0', ADMIN_TOKEN: 'pw', MIN_RUN_RATIO: '0' });
  return { store, handle: createHandler(cfg, { store, meter }) };
}
const call = (handle, path, body, headers = {}) =>
  handle(new Request('http://x' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }));

test('사용량 합치기 → 오늘 합계 · admin 에서 단계 보임', async () => {
  const meter = { r: 1000, w: 10, q: 0 };
  const { handle } = await setup(meter);
  assert.equal((await call(handle, '/api/config')).status, 200);
  const u = await (await call(handle, '/api/admin/usage', null, { 'x-admin-token': 'pw' })).json();
  assert.ok(u.r >= 1000 && u.w >= 10 && u.q >= 2, JSON.stringify(u));
  assert.equal(u.level, 0);
});

test('2단계(60%): 새 멀티 방 막음 · 3단계(80%): 서버 없는 모드(db_down), 운영자 화면은 그대로', async () => {
  const meter = { r: Math.ceil(USAGE_LIMITS.r * 0.65), w: 0, q: 0 };
  const { handle } = await setup(meter);
  const r = await call(handle, '/api/rooms', { action: 'create' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'busy');
  meter.w = Math.ceil(USAGE_LIMITS.w * 0.85);
  meter.q = 100; // 바로 합치게
  const d = await call(handle, '/api/me');
  assert.equal(d.status, 503);
  assert.equal((await d.json()).error, 'db_down');
  const a = await call(handle, '/api/admin/usage', null, { 'x-admin-token': 'pw' });
  assert.equal(a.status, 200);
  assert.equal((await a.json()).level, 3);
});

test('meter 없으면(JSON·Neon 저장소) 브레이크 없음', async () => {
  const { handle } = await setup(null);
  assert.equal((await call(handle, '/api/rooms', { action: 'create' })).status !== 503, true);
});

test('🆓 임시 이용 기간엔 인증 없이 4단계부터·멀티·건의하기 바로 / 기간 끝나면 다시 잠김', async () => {
  const store = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  const mk = (until) => createHandler(loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: '/dev/null', FREE_PASS_UNTIL: String(until) }), { store });
  const open = mk(Date.now() + 3600e3);
  assert.equal((await call(open, '/api/runs', { level: 4 })).status, 200);
  assert.equal((await call(open, '/api/runs', { level: 'endless' })).status, 200);
  assert.notEqual((await call(open, '/api/rooms', { action: 'create', name: '쿵', level: 5 })).status, 403);
  assert.notEqual((await call(open, '/api/suggestions', { text: '좋아요 좋아요', kind: 'etc' })).status, 403);
  const closed = mk(0);
  assert.equal((await call(closed, '/api/runs', { level: 4 })).status, 403);
});
