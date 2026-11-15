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

// TEST_BASE=http://127.0.0.1:3000 이면 이미 떠 있는 서버에 대고 같은 테스트
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
    ADMIN_TOKEN: 'admin-pw',
  });
  // TEST_PG=1: Vercel 과 같은 Postgres 저장소(PgStore)를 메모리 Postgres(PGlite)로 시험
  let store;
  if (process.env.TEST_PG) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PgStore } = await import('../server/pgstore.js');
    const db = new PGlite();
    store = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
  }
  ({ server } = createApp(cfg, { store }));
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

test('점수 등록은 닉네임 또는 인증 필요', async () => {
  const c = client();
  const run = (await c('POST', '/api/runs', { level: 1 })).json.runToken;
  const r = await c('POST', '/api/scores', { runToken: run, level: 1, score: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: noteCount(getLevel(1)) } });
  assert.equal(r.status, 401);
});

function perfectRun(level) {
  const n = noteCount(getLevel(level));
  let score = 0;
  for (let i = 1; i <= n; i++) score += pointsFor('perfect', i);
  return { score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0, wrong: 0 } };
}

test('닉네임으로 랭킹 참여 → 운영자 수동 승인하면 인스타 아이디로 기록이 옮겨감', async () => {
  const c = client();
  // 이상한 닉네임 거부
  assert.equal((await c('POST', '/api/guest', { name: 'a' })).status, 400);
  assert.equal((await c('POST', '/api/guest', { name: '<b>x</b>' })).status, 400);
  const g = await c('POST', '/api/guest', { name: ' 쿵짝왕 ' });
  assert.equal(g.status, 200);
  assert.equal(g.json.player.username, '쿵짝왕');
  const me = (await c('GET', '/api/me')).json;
  assert.equal(me.verified, false);
  assert.equal(me.guest, true);
  // 닉네임만으로는 팔로우 잠금(4단계)이 안 풀림
  assert.equal((await c('POST', '/api/runs', { level: 4 })).status, 403);
  // 닉네임으로 점수 등록 → 랭킹에 (인증 표시 없이)
  const run = (await c('POST', '/api/runs', { level: 2 })).json.runToken;
  const ok = await c('POST', '/api/scores', { runToken: run, level: 2, ...perfectRun(2) });
  assert.equal(ok.status, 200);
  let lb = (await c('GET', '/api/leaderboard?level=2')).json;
  const mine = lb.entries.find((e) => e.me);
  assert.equal(mine.username, '쿵짝왕');
  assert.equal(mine.verified, false);

  // 인스타 인증 코드 → 관리자 승인
  const code = (await c('POST', '/api/codes', { purpose: 'ranking' })).json;
  assert.equal((await c('GET', '/api/admin/codes')).status, 401);
  assert.equal((await c('GET', '/api/admin/codes', null, { 'x-admin-token': 'wrong-pw' })).status, 401);
  const list = (await c('GET', '/api/admin/codes', null, { 'x-admin-token': 'admin-pw' })).json.codes;
  assert.ok(list.some((x) => x.code === code.code));
  const adm = (body) => c('POST', '/api/admin/approve', body, { 'x-admin-token': 'admin-pw' });
  assert.equal((await adm({ code: code.display, username: 'bad name!' })).status, 400);
  assert.equal((await adm({ code: 'OK-ZZZZ', username: 'someone' })).status, 404);
  assert.equal((await adm({ code: code.display.toLowerCase(), username: '@Drum.King_1' })).status, 200);
  assert.equal((await adm({ code: code.display, username: 'drum.king_1' })).status, 409);

  const polled = await c('GET', `/api/codes/${code.code}`);
  assert.equal(polled.json.status, 'verified');
  assert.equal(polled.json.player.username, 'drum.king_1');
  assert.equal((await c('GET', '/api/me')).json.verified, true);
  assert.equal((await c('POST', '/api/runs', { level: 4 })).status, 200);
  // 닉네임 기록이 인스타 아이디로 옮겨짐 (중복 없이)
  lb = (await c('GET', '/api/leaderboard?level=2')).json;
  assert.equal(lb.entries.filter((e) => e.username === '쿵짝왕').length, 0);
  const moved = lb.entries.find((e) => e.me);
  assert.equal(moved.username, 'drum.king_1');
  assert.equal(moved.verified, true);
  // 인증된 사람은 닉네임으로 못 돌아감
  assert.equal((await c('POST', '/api/guest', { name: '다른이름' })).status, 409);
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

test('이용 통계: 접속·판 기록 → 관리자만 집계 조회', async () => {
  const a = client();
  const b = client();
  const sidA = 'sess-aaaaaaaa-1';
  // 방문자 A: 접속 + 2단계 시작 → 끝까지, 3단계 시작 후 중간에 나감
  assert.equal((await a('POST', '/api/track', { sid: sidA, active: 10, ref: 'Instagram.com', device: 'inapp' })).status, 200);
  assert.equal((await a('POST', '/api/track', { sid: sidA, active: 90, ref: 'x', device: 'mobile', plays: [{ ev: 'start', id: 'play-aaaa-0001', level: 2, mode: 'normal' }] })).status, 200);
  await a('POST', '/api/track', { sid: sidA, active: 150, plays: [{ ev: 'end', id: 'play-aaaa-0001', level: 2, result: 'clear', score: 1234, stars: 3, sec: 60 }, { ev: 'start', id: 'play-aaaa-0002', level: 3 }] });
  await a('POST', '/api/track', { sid: sidA, active: 200, plays: [{ ev: 'end', id: 'play-aaaa-0002', level: 3, result: 'quit', sec: 12 }] });
  // 방문자 B: 시작 알림이 유실되고 끝 알림만 옴 (그래도 한 판으로 셈) + 실패
  await b('POST', '/api/track', { sid: 'sess-bbbbbbbb-1', active: 30, ref: 'utm', device: 'desktop', plays: [{ ev: 'end', id: 'play-bbbb-0001', level: 'endless', result: 'fail', score: 500, stars: 0, sec: 40 }] });
  // 이상한 값은 거부/무시
  assert.equal((await a('POST', '/api/track', { sid: 'x' })).status, 400);
  assert.equal((await a('POST', '/api/track', 'not json')).status, 400);

  // 관리자만
  assert.equal((await a('GET', '/api/admin/stats')).status, 401);
  const st = (await a('GET', '/api/admin/stats?days=7', null, { 'x-admin-token': 'admin-pw' })).json;
  const t = st.totals;
  assert.equal(t.visitors, 2);
  assert.equal(t.newVisitors, 2);
  assert.equal(t.sessions, 2);
  assert.equal(t.plays, 3);
  assert.equal(t.clears, 1);
  assert.equal(t.fails, 1);
  assert.equal(t.quits, 1);
  // 활동 시간은 줄어들지 않고 가장 큰 값 (A 200초, B 30초 → 평균 115)
  assert.equal(t.avgSessionSec, 115);
  const lv2 = st.byLevel.find((x) => x.level === '2');
  assert.equal(lv2.clear, 1);
  assert.equal(lv2.avgScore, 1234);
  assert.ok(st.byLevel.find((x) => x.level === 'endless'));
  assert.equal(st.perDay.length, 7);
  assert.equal(st.perDay.at(-1).plays, 3);
  assert.ok(st.refs.length >= 1);
  // 방문자 번호 쿠키는 다시 발급되지 않음 (같은 브라우저 = 같은 방문자)
  await a('POST', '/api/track', { sid: 'sess-aaaaaaaa-2', active: 5 });
  const st2 = (await a('GET', '/api/admin/stats?days=7', null, { 'x-admin-token': 'admin-pw' })).json;
  assert.equal(st2.totals.visitors, 2);
  assert.equal(st2.totals.sessions, 3);
});
