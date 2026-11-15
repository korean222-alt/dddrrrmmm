// HTTP 통합 테스트: 코드 발급 → (웹훅 DM) → 인증 쿠키 → 점수 등록 → 랭킹
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { getLevel, noteCount, pointsFor } from '../public/js/charts.js';

let server, base, tmp;
const SECRET = 'app-secret';

// TEST_BASE=http://127.0.0.1:8787 이면 이미 떠 있는 서버(예: wrangler dev 로 띄운 Cloudflare Worker)에 대고 같은 테스트
before(async () => {
  if (process.env.TEST_BASE) {
    base = process.env.TEST_BASE;
    return;
  }
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-'));
  const cfg = loadConfig({
    SESSION_SECRET: 'test-secret',
    DATA_FILE: path.join(tmp, 'db.json'),
    GATE_MODE: 'follow',
    FOLLOW_CHECK_MODE: 'fake',
    ALLOW_DEV_SIMULATE: 'true',
    IG_APP_SECRET: SECRET,
    IG_VERIFY_TOKEN: 'vt',
    INSTAGRAM_HANDLE: 'ok_aystra',
    MIN_RUN_RATIO: '0',
  });
  ({ server } = createApp(cfg));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (!server) return;
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function client() {
  const jar = {};
  return async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
        ...headers,
      },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  };
}

function webhookBody(igsid, text) {
  return JSON.stringify({ object: 'instagram', entry: [{ id: 'BIZ', time: Date.now(), messaging: [{ sender: { id: igsid }, recipient: { id: 'BIZ' }, timestamp: Date.now(), message: { mid: 'x', text } }] }] });
}
const sig = (b) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(b).digest('hex');

test('정적 파일과 헬스체크', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/health')).json.app, 'okaystra');
  const html = await c('GET', '/');
  assert.equal(html.status, 200);
  assert.match(html.text, /오케이스트라/);
  assert.equal((await c('GET', '/../package.json')).status, 404);
});

test('웹훅 등록 확인 (hub.challenge)', async () => {
  const c = client();
  const ok = await c('GET', '/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123');
  assert.equal(ok.text, '123');
  assert.equal((await c('GET', '/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1')).status, 403);
});

test('전체 흐름: 잠금 → DM 웹훅 → 인증 → 점수 → 랭킹', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/me')).json.verified, false);
  // Lv.4 는 잠겨 있음
  assert.equal((await c('POST', '/api/runs', { level: 4 })).status, 403);
  // Lv.1 은 바로
  assert.equal((await c('POST', '/api/runs', { level: 1 })).status, 200);

  const code = (await c('POST', '/api/codes', { purpose: 'unlock' })).json;
  assert.match(code.display, /^OK-[A-Z2-9]{4}$/);
  assert.equal((await c('GET', `/api/codes/${code.code}`)).json.status, 'pending');

  // 다른 브라우저는 남의 코드를 조회할 수 없음
  const other = client();
  assert.equal((await other('GET', `/api/codes/${code.code}`)).status, 404);

  // 서명 틀린 웹훅은 거부
  const bad = webhookBody('U100', code.display);
  assert.equal((await c('POST', '/webhook', bad, { 'X-Hub-Signature-256': 'sha256=00' })).status, 401);

  // 진짜 웹훅 (DM 본문에 코드)
  const body = webhookBody('U100', `안녕하세요 ${code.display.toLowerCase()} 입니다`);
  assert.equal((await c('POST', '/webhook', body, { 'X-Hub-Signature-256': sig(body), 'Content-Type': 'application/json' })).status, 200);
  await new Promise((r) => setTimeout(r, 50));

  const polled = await c('GET', `/api/codes/${code.code}`);
  assert.equal(polled.json.status, 'verified');
  assert.equal((await c('GET', '/api/me')).json.verified, true);

  // 이제 Lv.4 시작 가능
  const run = (await c('POST', '/api/runs', { level: 4 })).json.runToken;
  assert.ok(run);
  const lv = getLevel(4);
  const n = noteCount(lv);
  let score = 0;
  for (let i = 1; i <= n; i++) score += pointsFor('perfect', i);

  // 조작된 점수는 거부
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, score: score + 10, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0 } })).status, 400);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, score, maxCombo: n, counts: { perfect: n - 1, great: 0, good: 0, miss: 0 } })).status, 400);

  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0, wrong: -1 } })).status, 400);
  const ok = await c('POST', '/api/scores', { runToken: run, level: 4, score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0, wrong: 0 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.rank, 1);
  // 같은 판 재사용 불가
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0 } })).status, 409);

  const lb = (await c('GET', '/api/leaderboard?level=4')).json;
  assert.equal(lb.entries[0].score, score);
  assert.equal(lb.entries[0].me, true);
  assert.equal(lb.me.rank, 1);
});

test('점수 등록은 인증 필수', async () => {
  const c = client();
  const run = (await c('POST', '/api/runs', { level: 1 })).json.runToken;
  const r = await c('POST', '/api/scores', { runToken: run, level: 1, score: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: noteCount(getLevel(1)) } });
  assert.equal(r.status, 401);
});

test('개발용 DM 시뮬레이션: 팔로우 안 함 → 팔로우', async () => {
  const c = client();
  const code = (await c('POST', '/api/codes', { purpose: 'ranking' })).json;
  await c('POST', '/api/dev/simulate-dm', { code: code.code, notFollowing: true });
  assert.equal((await c('GET', `/api/codes/${code.code}`)).json.status, 'not_following');
  await c('POST', '/api/dev/simulate-dm', { code: code.code });
  const r = await c('GET', `/api/codes/${code.code}`);
  assert.equal(r.json.status, 'verified');
  assert.equal(r.json.player.username, 'dev_tester');
});
