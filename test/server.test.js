// HTTP 통합 테스트: 닉네임 → 판 시작 → 점수 등록 → 랭킹, 이용 통계
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { getLevel, noteCount, pointsFor } from '../public/js/charts.js';

let server, base, tmp;

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
    GATE_MODE: 'soft',
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

test('정적 파일과 헬스체크', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/health')).json.app, 'okaystra');
  const html = await c('GET', '/');
  assert.equal(html.status, 200);
  assert.match(html.text, /오케이스트라/);
  assert.equal((await c('GET', '/../package.json')).status, 404);
});

test('닉네임 → 판 시작 → 점수 등록(조작 거부) → 랭킹', async () => {
  const c = client();
  const me0 = (await c('GET', '/api/me')).json;
  assert.equal(me0.guest, undefined);
  // 이상한 닉네임 거부
  assert.equal((await c('POST', '/api/guest', { name: 'a' })).status, 400);
  assert.equal((await c('POST', '/api/guest', { name: '<b>x</b>' })).status, 400);
  const g = await c('POST', '/api/guest', { name: ' 쿵짝왕 ' });
  assert.equal(g.status, 200);
  assert.equal(g.json.player.username, '쿵짝왕');
  assert.equal((await c('GET', '/api/me')).json.guest, true);

  // 서버는 4단계도 막지 않음 (잠금은 안내일 뿐)
  const run = (await c('POST', '/api/runs', { level: 4 })).json.runToken;
  assert.ok(run);
  const pr = perfectRun(4);
  const n = noteCount(getLevel(4));

  // 조작된 점수는 거부
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, ...pr, score: pr.score + 10 })).status, 400);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, ...pr, counts: { perfect: n - 1, great: 0, good: 0, miss: 0 } })).status, 400);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, ...pr, counts: { ...pr.counts, wrong: -1 } })).status, 400);
  const ok = await c('POST', '/api/scores', { runToken: run, level: 4, ...pr });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.rank, 1);
  // 같은 판 재사용 불가
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 4, ...pr })).status, 409);

  const lb = (await c('GET', '/api/leaderboard?level=4')).json;
  assert.equal(lb.entries[0].score, pr.score);
  assert.equal(lb.entries[0].username, '쿵짝왕');
  assert.equal(lb.entries[0].me, true);
  assert.equal(lb.entries[0].verified, undefined);
  assert.equal(lb.me.rank, 1);

  // 닉네임을 바꿔도 기록은 그대로 (같은 사람)
  assert.equal((await c('POST', '/api/guest', { name: '새이름' })).status, 200);
  const lb2 = (await c('GET', '/api/leaderboard?level=4')).json;
  assert.equal(lb2.entries[0].username, '새이름');
  assert.equal(lb2.entries[0].score, pr.score);
});

test('인스타 아이디 등록(DM 코드·웹훅·관리자 승인)은 없어짐', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/codes', { purpose: 'ranking' })).status, 404);
  assert.equal((await c('GET', '/api/codes/ABCD')).status, 404);
  assert.equal((await c('POST', '/api/dev/simulate-dm', {})).status, 404);
  assert.equal((await c('GET', '/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=1')).status, 404);
  assert.equal((await c('POST', '/api/admin/approve', { code: 'OK-ABCD', username: 'x' }, { 'x-admin-token': 'admin-pw' })).status, 404);
  assert.equal((await c('GET', '/api/admin/codes', null, { 'x-admin-token': 'admin-pw' })).status, 404);
  const cfg = (await c('GET', '/api/config')).json;
  assert.equal(cfg.followCheckMode, undefined);
  assert.equal(cfg.devSimulate, undefined);
});

test('점수 등록은 닉네임이 있어야 함', async () => {
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
