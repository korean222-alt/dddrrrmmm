// 🔓 팔로워 암호 없앰 (2026-11-26 사용자 '암호 들어간 건 다 없애자 — 팔로우 받고 DM 으로 사이트 링크만 줌')
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler, NO_PASSWORD } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-nopass-'));
// 예전 임시 이용 기간이 이미 끝난 것처럼 (FREE_PASS_UNTIL 과거) + 암호도 있는 설정이어도 → 암호 없이
const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: String(Date.now() - 1000), FOLLOW_PASSWORD: '옛암호' });
const store = new JsonStore(cfg.dataFile).init();
const handle = createHandler(cfg, { store });
function client() {
  let tok = null;
  return async (p, body = null, method = body ? 'POST' : 'GET') => {
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers['X-Player'] = tok;
    const r = await handle(new Request('http://x' + p, { method, headers, body: body ? JSON.stringify(body) : undefined }), { ip: '7.7.7.' + Math.floor(Math.random() * 200) });
    const t = r.headers.get('x-player');
    if (t && t !== '-') tok = t;
    return { status: r.status, json: await r.json().catch(() => null) };
  };
}

test('사이트 기본값은 암호 없음', () => {
  assert.equal(NO_PASSWORD, true);
});

test('이용 등록 = 암호 없이 바로 인증 완료 (임시 아님) · 4단계부터 열림', async () => {
  const c = client();
  const boot = await c('/api/health?boot=1');
  assert.ok(boot.json.config.freePassUntil > Date.UTC(2090, 0, 1), '예전 폰도 열림으로 읽게 아주 먼 날');
  const r = await c('/api/verify/password', { name: '링크로옴', ig: 'came.by_link' });
  assert.equal(r.status, 200);
  assert.equal(r.json.confirmed, true);
  assert.equal(r.json.temp, false);
  assert.ok(store.getPlayer(Object.keys(store.data.players).find((k) => store.data.players[k].username === '링크로옴')).checkedAt > 0);
  // 아이디를 바꿔도(예전엔 암호로 다시 인증) 그대로 완료
  const g = await c('/api/guest', { name: '링크로옴', ig: 'new.id_here' });
  assert.equal(g.status, 200);
  assert.equal(g.json.confirmed, true);
  // 판 시작: 4단계 (등록 안 한 사람도)
  const anon = client();
  assert.equal((await anon('/api/runs', { level: 4 })).status, 200);
});

test('예전 임시 인증(음수)은 안 풀림', async () => {
  store.upsertPlayer('g_temp1', { username: '임시였음', ig: 'temp.was' });
  store.setChecked('g_temp1', 'temp');
  const c = client();
  await c('/api/health?boot=1');
  assert.ok(store.getPlayer('g_temp1').checkedAt < 0, '그대로 (인증 유지)');
});

test('예전 계정 되찾기 = 암호 대신 되찾기 요청', async () => {
  const c = client();
  const r = await c('/api/verify/password', { ig: 'temp.was', restore: true });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'need_request');
  // 암호를 알아도 되찾기로 남의 계정을 못 가져감
  const r2 = await c('/api/verify/password', { ig: 'temp.was', password: '옛암호', restore: true });
  assert.equal(r2.status, 403);
  assert.equal(r2.json.error, 'need_request');
  // 되찾기 요청은 암호 없이
  const q = await c('/api/recover-request', { nick: '임시였음', nowIg: 'temp.was' });
  assert.equal(q.status, 200);
  assert.ok(q.json.token);
});
