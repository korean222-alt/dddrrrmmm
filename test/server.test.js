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
    FOLLOW_PASSWORD: '시험1234',
    SUGGEST_BOT_TOKEN: 'bot-token-123',
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

const adm = { 'x-admin-token': 'admin-pw' };
/** 운영자가 이 인스타 아이디의 팔로우를 '확인함' 처리 (신청만 해도 열리지만 운영자 확인 표시) */
async function verifyIg(ig) {
  const c = client();
  const p = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === ig);
  assert.equal((await c('POST', '/api/admin/players/check', { igsid: p.igsid, checked: true }, adm)).json.ok, true);
}

test('팔로워 인증: 1~3단계는 누구나 / 4단계부터·무제한은 인증 완료한 사람만 / 아이디만 적은 신청으론 안 열림', async () => {
  const c = client();
  for (const lv of [4, 9, 12, 14, 15, 'endless', 'e3']) assert.equal((await c('POST', '/api/runs', { level: lv })).json.error, 'confirm_required', String(lv));
  for (const lv of [1, 2, 3]) assert.equal((await c('POST', '/api/runs', { level: lv })).status, 200);
  // 아이디만 적은 신청: 여전히 잠김, 점수도 못 올림
  const g = await c('POST', '/api/guest', { name: '인증대기', ig: 'wait.me' });
  assert.equal(g.json.confirmed, false);
  for (const lv of [4, 12, 'endless', 'e3']) assert.equal((await c('POST', '/api/runs', { level: lv })).json.error, 'confirm_pending', String(lv));
  const run1 = (await c('POST', '/api/runs', { level: 1 })).json.runToken;
  const s1 = await c('POST', '/api/scores', { runToken: run1, level: 1, ...perfectRun(1) });
  assert.equal(s1.status, 403);
  assert.equal(s1.json.error, 'verify_required');
  // 인증 완료(운영자 확인 또는 암호) → 전부 열림
  await verifyIg('wait.me');
  assert.equal((await c('GET', '/api/me')).json.confirmed, true);
  for (const lv of [4, 9, 12, 13, 14, 15, 'endless', 'e3', 'e13', 'e15']) assert.equal((await c('POST', '/api/runs', { level: lv })).status, 200, String(lv));
  // 랭킹에서 내리면 다시 잠김
  const p = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === 'wait.me');
  await c('POST', '/api/admin/players/hide', { igsid: p.igsid, hidden: true }, adm);
  assert.equal((await c('GET', '/api/me')).json.confirmed, false);
  for (const lv of [4, 12, 'e3']) assert.equal((await c('POST', '/api/runs', { level: lv })).status, 403);
});

test('팔로워 암호: 틀리면 아무것도 안 생김 / 맞으면 바로 인증 완료(전부 열림) / 관리자가 암호 교체', async () => {
  const c = client();
  // 처음 온 사람은 닉네임·아이디가 있어야 함
  assert.equal((await c('POST', '/api/verify/password', { password: '시험1234' })).json.error, 'bad_name');
  assert.equal((await c('POST', '/api/verify/password', { name: '암호왕', password: '시험1234' })).json.error, 'bad_ig');
  // 틀린 암호 → 403, 참여자도 안 만들어짐
  assert.equal((await c('POST', '/api/verify/password', { name: '암호왕', ig: 'pass.me', password: '틀림' })).json.error, 'wrong_password');
  assert.equal((await c('GET', '/api/me')).json.verified, false);
  // 띄어쓰기·대소문자 무시
  const ok = await c('POST', '/api/verify/password', { name: '암호왕', ig: '@pass.me', password: ' 시험 1234 ' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.confirmed, true);
  assert.equal(ok.json.player.ig, 'pass.me');
  for (const lv of [9, 12, 'endless', 13, 14, 15, 'e3']) assert.equal((await c('POST', '/api/runs', { level: lv })).status, 200, String(lv));
  const listed = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === 'pass.me');
  assert.ok(listed && listed.checkedAt);
  // 관리자: 암호 보기 · 바꾸기 (관리자만)
  assert.equal((await c('GET', '/api/admin/follow-password')).status, 401);
  assert.deepEqual((await c('GET', '/api/admin/follow-password', null, adm)).json, { password: '시험1234', source: 'env' });
  assert.equal((await c('POST', '/api/admin/follow-password', { password: '새암호77' }, adm)).json.ok, true);
  assert.equal((await c('GET', '/api/admin/follow-password', null, adm)).json.source, 'admin');
  // 이미 참여한 사람은 암호만 (닉네임·아이디 그대로)
  const c2 = client();
  await c2('POST', '/api/guest', { name: '신청만', ig: 'apply.only' });
  assert.equal((await c2('POST', '/api/verify/password', { password: '시험1234' })).json.error, 'wrong_password');
  const ok2 = await c2('POST', '/api/verify/password', { password: '새암호77' });
  assert.equal(ok2.json.confirmed, true);
  assert.equal(ok2.json.player.username, '신청만');
  // 빈 값이면 환경변수 암호로 돌아감
  await c('POST', '/api/admin/follow-password', { password: '' }, adm);
  assert.deepEqual((await c('GET', '/api/admin/follow-password', null, adm)).json, { password: '시험1234', source: 'env' });
});

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
  // 인스타 아이디는 꼭 필요 (없거나 이상하면 거부)
  assert.equal((await c('POST', '/api/guest', { name: '쿵짝왕' })).status, 400);
  assert.equal((await c('POST', '/api/guest', { name: '쿵짝왕', ig: 'a b' })).status, 400);
  const g = await c('POST', '/api/guest', { name: ' 쿵짝왕 ', ig: '@Kong_Jjak' });
  assert.equal(g.status, 200);
  assert.equal(g.json.player.username, '쿵짝왕');
  assert.equal((await c('GET', '/api/me')).json.guest, true);
  assert.equal((await c('GET', '/api/me')).json.needsIg, false);

  // 인증 전엔 4단계 잠김 → 인증 완료하면 열림
  assert.equal((await c('POST', '/api/runs', { level: 4 })).status, 403);
  await verifyIg('kong_jjak');
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
  assert.equal((await c('POST', '/api/guest', { name: '새이름' })).status, 200); // 아이디는 이미 있으니 이름만 바꿔도 됨
  const lb2 = (await c('GET', '/api/leaderboard?level=4')).json;
  assert.equal(lb2.entries[0].username, '새이름');
  assert.equal(lb2.entries[0].score, pr.score);

  // 총 등수: 단계별 최고점의 합. 2단계도 치면 합이 늘어남
  const t1 = (await c('GET', '/api/leaderboard?level=total')).json;
  assert.equal(t1.entries[0].score, pr.score);
  assert.equal(t1.entries[0].levels, 1);
  assert.equal(t1.entries[0].me, true);
  assert.equal(t1.me.rank, 1);
  const run2 = (await c('POST', '/api/runs', { level: 2 })).json.runToken;
  const pr2 = perfectRun(2);
  assert.equal((await c('POST', '/api/scores', { runToken: run2, level: 2, ...pr2 })).status, 200);
  const t2 = (await c('GET', '/api/leaderboard?level=total')).json;
  assert.equal(t2.entries[0].score, pr.score + pr2.score);
  assert.equal(t2.entries[0].levels, 2);
  assert.equal(t2.me.score, pr.score + pr2.score);
});

test('무제한 모드: 따로 랭킹 (깬 단계 먼저, 같으면 점수) · 총 등수엔 안 들어감', async () => {
  const c = client();
  const d = client();
  await c('POST', '/api/guest', { name: '무제한왕', ig: 'endless_king' });
  await d('POST', '/api/guest', { name: '둘째', ig: 'second.one' });
  await verifyIg('endless_king');
  await verifyIg('second.one');
  const run = (await c('POST', '/api/runs', { level: 'endless' })).json.runToken;
  assert.ok(run);
  // 조작 거부: 단계 0, 말도 안 되는 점수, 다른 단계용 토큰
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 'endless', rounds: 0, score: 100 })).status, 400);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 'endless', rounds: 3, score: 99999999 })).status, 400);
  const run4 = (await c('POST', '/api/runs', { level: 4 })).json.runToken;
  assert.equal((await c('POST', '/api/scores', { runToken: run4, level: 'endless', rounds: 3, score: 100 })).status, 400);
  const ok = await c('POST', '/api/scores', { runToken: run, level: 'endless', rounds: 5, score: 40000 });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.rank, 1);
  assert.equal(ok.json.rounds, 5);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 'endless', rounds: 5, score: 40000 })).status, 409);
  // 둘째: 같은 단계, 더 높은 점수 → 1위. 첫째는 2위
  const run2 = (await d('POST', '/api/runs', { level: 'endless' })).json.runToken;
  assert.equal((await d('POST', '/api/scores', { runToken: run2, level: 'endless', rounds: 5, score: 41000 })).status, 200);
  const lb = (await c('GET', '/api/leaderboard?level=endless')).json;
  assert.equal(lb.entries[0].username, '둘째');
  assert.equal(lb.entries[0].rounds, 5);
  assert.equal(lb.entries[0].score, 41000);
  assert.equal(lb.entries[1].me, true);
  assert.equal(lb.me.rank, 2);
  // 더 낮은 기록은 그대로
  const run3 = (await c('POST', '/api/runs', { level: 'endless' })).json.runToken;
  const low = await c('POST', '/api/scores', { runToken: run3, level: 'endless', rounds: 2, score: 9000 });
  assert.equal(low.json.improved, false);
  assert.equal(low.json.rounds, 5);
  // 총 등수엔 무제한 점수가 안 섞임
  const tot = (await c('GET', '/api/leaderboard?level=total')).json;
  assert.ok(tot.entries.every((e) => e.score < 1_000_000_000));
  // 점수가 100만을 넘어도 잘리지 않음 (예전엔 999,999 에서 멈췄음)
  const run5 = (await c('POST', '/api/runs', { level: 'endless' })).json.runToken;
  const big = await c('POST', '/api/scores', { runToken: run5, level: 'endless', rounds: 24, score: 1_620_000 });
  assert.equal(big.status, 200);
  assert.equal(big.json.rounds, 24);
  assert.equal(big.json.best, 1_620_000);
  const lb2 = (await c('GET', '/api/leaderboard?level=endless')).json;
  assert.equal(lb2.entries[0].username, '무제한왕');
  assert.equal(lb2.entries[0].score, 1_620_000);
  assert.equal(lb2.entries[0].rounds, 24);
  assert.ok(!tot.entries.some((e) => e.username === '무제한왕'));
});

test('단계별 무제한: 인증 신청만으론 잠김, 운영자 확인(인증 완료)하면 판 시작됨', async () => {
  const c = client();
  await c('POST', '/api/guest', { name: '잠금확인', ig: 'closed.check' });
  const r = await c('POST', '/api/runs', { level: 'e5' });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'confirm_pending');
  await verifyIg('closed.check');
  assert.equal((await c('POST', '/api/runs', { level: 'e5' })).status, 200);
});

test('단계별 무제한: 곡마다 따로 랭킹 (그리그 무제한·다른 단계·총 등수와 안 섞임) — 잠금을 푼(GATE_MODE=open) 서버로', async (t) => {
  if (process.env.TEST_BASE) return t.skip('이미 떠 있는 서버엔 잠금 해제 설정을 못 줌');
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kk2-'));
  const { server: s2 } = createApp(loadConfig({ SESSION_SECRET: 'test-secret-2', DATA_FILE: path.join(tmp2, 'db.json'), GATE_MODE: 'open', INSTAGRAM_HANDLE: 'ok_aystra', MIN_RUN_RATIO: '0', ADMIN_TOKEN: 'admin-pw' }));
  await new Promise((r) => s2.listen(0, r));
  const saved = base;
  base = `http://127.0.0.1:${s2.address().port}`;
  try {
    await perStageEndlessRanking();
  } finally {
    base = saved;
    s2.close();
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
});

async function perStageEndlessRanking() {
  const c = client();
  await c('POST', '/api/guest', { name: '오단계무한', ig: 'e5_king' });
  await verifyIg('e5_king'); // 랭킹엔 인증 완료한 사람만
  const run = (await c('POST', '/api/runs', { level: 'e5' })).json.runToken;
  assert.ok(run);
  // 없는 단계, 다른 무제한용 토큰은 거부
  assert.equal((await c('POST', '/api/runs', { level: 'e99' })).status, 400);
  const grieg = (await c('POST', '/api/runs', { level: 'endless' })).json.runToken;
  assert.equal((await c('POST', '/api/scores', { runToken: grieg, level: 'e5', rounds: 3, score: 1000 })).status, 400);
  assert.equal((await c('POST', '/api/scores', { runToken: run, level: 'e6', rounds: 3, score: 1000 })).status, 400);
  const ok = await c('POST', '/api/scores', { runToken: run, level: 'e5', rounds: 7, score: 52000 });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.rounds, 7);
  assert.equal(ok.json.rank, 1);
  const lb = (await c('GET', '/api/leaderboard?level=e5')).json;
  assert.equal(lb.level, 'e5');
  assert.equal(lb.entries[0].username, '오단계무한');
  assert.equal(lb.entries[0].rounds, 7);
  assert.equal(lb.entries[0].score, 52000);
  assert.equal(lb.me.rank, 1);
  // 다른 랭킹에는 안 보임
  for (const lv of ['e6', 'endless', '5', 'total']) {
    const other = (await c('GET', `/api/leaderboard?level=${lv}`)).json;
    assert.ok(!other.entries.some((e) => e.username === '오단계무한'), lv);
  }
}

test('관리자: 랭킹에서 내리기 → 랭킹에서 안 보임 → 다시 들어와 아이디를 넣으면 돌아옴', async () => {
  const adm = { 'x-admin-token': 'admin-pw' };
  const c = client();
  await c('POST', '/api/guest', { name: '숨김대상', ig: 'hide.me' });
  await verifyIg('hide.me');
  const run = (await c('POST', '/api/runs', { level: 3 })).json.runToken;
  await c('POST', '/api/scores', { runToken: run, level: 3, ...perfectRun(3) });
  const me = (await c('GET', '/api/admin/players', null, adm)).json.players.find((p) => p.username === '숨김대상');
  assert.equal((await c('POST', '/api/admin/players/hide', { igsid: me.igsid }, adm)).json.ok, true);
  // 랭킹(단계·총 등수)에서 사라짐, 기록은 남아 있음
  assert.ok(!(await c('GET', '/api/leaderboard?level=3')).json.entries.some((e) => e.username === '숨김대상'));
  assert.ok(!(await c('GET', '/api/leaderboard?level=total')).json.entries.some((e) => e.username === '숨김대상'));
  const listed = (await c('GET', '/api/admin/players', null, adm)).json.players.find((p) => p.igsid === me.igsid);
  assert.ok(listed.hiddenAt);
  // 다시 접속하면 알림 정보 (5일 뒤 삭제)
  const m1 = (await c('GET', '/api/me')).json;
  assert.ok(m1.hidden);
  assert.ok(Math.abs(m1.hidden.deleteAt - listed.hiddenAt - 5 * 86400000) < 1000);
  // 아이디를 다시 적으면 내림은 풀리지만, 다시 인증해야 랭킹에 보임
  assert.equal((await c('POST', '/api/guest', { name: '숨김대상', ig: 'hide.me' })).status, 200);
  assert.equal((await c('GET', '/api/me')).json.hidden, null);
  const back = (await c('GET', '/api/admin/players', null, adm)).json.players.find((p) => p.igsid === me.igsid);
  assert.equal(back.hiddenAt, null);
  assert.equal(back.checkedAt, null);
  assert.ok(!(await c('GET', '/api/leaderboard?level=3')).json.entries.some((e) => e.username === '숨김대상'));
  assert.equal((await c('POST', '/api/verify/password', { password: '시험1234' })).json.confirmed, true);
  assert.ok((await c('GET', '/api/leaderboard?level=3')).json.entries.some((e) => e.username === '숨김대상'));
});

test('관리자: 랭킹 참여자 목록(인스타 아이디) → 확인함 → 삭제', async () => {
  const adm = { 'x-admin-token': 'admin-pw' };
  const c = client();
  await c('POST', '/api/guest', { name: '삭제대상', ig: 'del.me' });
  const pre = (await c('GET', '/api/admin/players', null, adm)).json.players.find((p) => p.username === '삭제대상');
  assert.equal(pre.checkedAt, null);
  await verifyIg('del.me');
  const run = (await c('POST', '/api/runs', { level: 2 })).json.runToken;
  await c('POST', '/api/scores', { runToken: run, level: 2, ...perfectRun(2) });
  // 비밀번호 없으면 거부
  assert.equal((await c('GET', '/api/admin/players')).status, 401);
  const list = (await c('GET', '/api/admin/players', null, adm)).json.players;
  const me = list.find((p) => p.username === '삭제대상');
  assert.equal(me.ig, 'del.me');
  assert.ok(me.checkedAt);
  assert.equal(me.levels, 1);
  // 확인 취소 → 랭킹에서 안 보임 / 다시 확인함 → 보임
  assert.equal((await c('POST', '/api/admin/players/check', { igsid: me.igsid, checked: false }, adm)).json.ok, true);
  assert.ok(!(await c('GET', '/api/leaderboard?level=2')).json.entries.some((e) => e.username === '삭제대상'));
  assert.equal((await c('POST', '/api/admin/players/check', { igsid: me.igsid, checked: true }, adm)).json.ok, true);
  assert.ok((await c('GET', '/api/leaderboard?level=2')).json.entries.some((e) => e.username === '삭제대상'));
  // 아이디를 바꾸면 다시 확인 필요
  await c('POST', '/api/guest', { name: '삭제대상', ig: 'other_id' });
  assert.equal((await c('GET', '/api/admin/players', null, adm)).json.players.find((p) => p.igsid === me.igsid).checkedAt, null);
  // 삭제: 랭킹에서도 사라지고, 그 사람은 다시 닉네임을 정해야 함
  assert.equal((await c('POST', '/api/admin/players/delete', { igsid: me.igsid }, adm)).json.ok, true);
  assert.ok(!(await c('GET', '/api/leaderboard?level=2')).json.entries.some((e) => e.username === '삭제대상'));
  assert.equal((await c('GET', '/api/me')).json.guest, undefined);
  assert.ok(!(await c('GET', '/api/admin/players', null, adm)).json.players.some((p) => p.igsid === me.igsid));
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

  // 판 시작(/api/runs) 요청에 얹혀 온 통계도 저장 (따로 /api/track 안 보내도 됨)
  const r = await a('POST', '/api/runs', { level: 1, track: { sid: 'sess-aaaaaaaa-3', active: 40, plays: [{ ev: 'end', id: 'play-aaaa-0003', level: 1, result: 'clear', score: 10, stars: 1, sec: 30 }] } });
  assert.equal(r.status, 200);
  assert.ok(r.json.runToken);
  // 잘못된 통계가 얹혀도 판 시작은 됨
  assert.equal((await a('POST', '/api/runs', { level: 1, track: { sid: 'x' } })).status, 200);
  const st3 = (await a('GET', '/api/admin/stats?days=7', null, { 'x-admin-token': 'admin-pw' })).json;
  assert.equal(st3.totals.sessions, 4);
  assert.equal(st3.totals.plays, 4);
});

/** 팔로워 암호로 인증한 사람 (멀티·건의하기는 인증한 사람만) */
async function verifiedClient(name, ig) {
  const c = client();
  const r = await c('POST', '/api/verify/password', { name, ig, password: '시험1234' });
  assert.equal(r.status, 200, `인증 ${name}`);
  return c;
}

test('건의함: 남기기 → 관리자 보기·처리 → 봇 읽기(토큰)', async () => {
  // 인증 안 한 사람은 못 남김
  assert.equal((await client()('POST', '/api/suggestions', { kind: 'song', text: '안녕하세요' })).json.error, 'confirm_required');
  const c = await verifiedClient('건의왕', 'sug.gest');
  assert.equal((await c('POST', '/api/suggestions', { kind: 'song', text: 'x' })).status, 400);
  const r = await c('POST', '/api/suggestions', { kind: 'song', text: '  캐논 무제한도 만들어 주세요  ' });
  assert.equal(r.status, 200);
  assert.ok(Number.isInteger(r.json.id));
  await c('POST', '/api/suggestions', { kind: 'weird', text: '버그 있어요\n두 줄' });
  const rc = await c('POST', '/api/suggestions', { kind: 'bug', text: '답장 주세요', contact: '  @reply.me  ' });
  assert.equal((await c('GET', '/api/admin/suggestions')).status, 401);
  const admin = { 'x-admin-token': 'admin-pw' };
  const list = await c('GET', '/api/admin/suggestions?days=7', null, admin);
  assert.equal(list.status, 200);
  const mine = list.json.suggestions.find((x) => x.id === r.json.id);
  assert.equal(mine.body, '캐논 무제한도 만들어 주세요');
  assert.equal(mine.kind, 'song');
  assert.ok(list.json.suggestions.some((x) => x.kind === 'etc' && x.body.includes('\n')));
  assert.equal((await c('POST', '/api/admin/suggestions/done', { id: r.json.id }, admin)).json.ok, true);
  // 봇: 토큰이 틀리면 401, 맞으면 최근 1일
  assert.equal((await c('GET', '/api/bot/suggestions?token=nope')).status, 401);
  const bot = await c('GET', '/api/bot/suggestions?days=1&token=bot-token-123');
  assert.equal(bot.status, 200);
  const b1 = bot.json.suggestions.find((x) => x.id === r.json.id);
  assert.equal(b1.done, true);
  assert.match(b1.at, /KST$/);
  assert.equal(b1.vid, undefined);
  assert.equal(bot.json.suggestions.find((x) => x.id === rc.json.id).contact, '@reply.me', '답장 받을 곳');
  assert.equal(list.json.suggestions.find((x) => x.id === rc.json.id).contact, '@reply.me');
  assert.equal((await c('POST', '/api/admin/suggestions/delete', { id: r.json.id }, admin)).json.ok, true);
  const after = await c('GET', '/api/admin/suggestions', null, admin);
  assert.ok(!after.json.suggestions.some((x) => x.id === r.json.id));
});

test('대결 방: 만들기 → 들어가기 → 둘 다 준비하면 시작 → 점수 주고받기 → 한 판 더', async () => {
  const C = client();
  // 인증 안 한 사람은 방을 못 만들고 못 들어감
  assert.equal((await C('POST', '/api/rooms', { action: 'create', name: '셋째', mode: 'versus', level: 1 })).json.error, 'confirm_required');
  const A = await verifiedClient('쿵짝왕', 'room.a');
  const B = await verifiedClient('친구', 'room.b');
  const made = await A('POST', '/api/rooms', { action: 'create', name: '쿵짝왕', mode: 'versus', level: 1 });
  assert.equal(made.status, 200);
  const code = made.json.code;
  assert.match(code, /^\d{4}$/);
  const a = { code, slot: made.json.slot, key: made.json.key };
  assert.equal(made.json.room.players.a.key, undefined);
  assert.equal((await B('POST', '/api/rooms', { action: 'join', code: '0000', name: '친구' })).status, 404);
  const joined = await B('POST', '/api/rooms', { action: 'join', code, name: '친구' });
  assert.equal(joined.status, 200);
  const b = { code, slot: joined.json.slot, key: joined.json.key };
  assert.equal(b.slot, 'b');
  assert.equal((await C('POST', '/api/rooms', { action: 'join', code, name: '셋째' })).json.error, 'confirm_required');
  const D = await verifiedClient('넷째', 'room.d');
  assert.equal((await D('POST', '/api/rooms', { action: 'join', code, name: '넷째' })).status, 409, '꽉 참');
  // 남의 키로는 못 바꿈
  assert.equal((await C('POST', '/api/rooms', { action: 'sync', ...b, key: 'x' })).status, 403);
  // 방장이 1단계로 + 팀전, 둘 다 준비 → 시작
  let r = await A('POST', '/api/rooms', { action: 'sync', ...a, level: 1, mode: 'team', ready: true });
  assert.equal(r.json.room.status, 'lobby');
  assert.equal(r.json.room.mode, 'team');
  assert.equal(r.json.room.players.a.ready, true);
  r = await B('POST', '/api/rooms', { action: 'sync', ...b, ready: true });
  assert.equal(r.json.room.status, 'playing');
  assert.equal(r.json.room.round, 1);
  assert.ok(r.json.room.startAt > r.json.now);
  // 치는 중: 점수 주고받기
  await A('POST', '/api/rooms', { action: 'sync', ...a, live: { score: 1200, combo: 3, progress: 0.2, lives: 5 } });
  r = await B('POST', '/api/rooms', { action: 'sync', ...b, live: { score: 800, combo: 1, progress: 0.2, lives: 4 } });
  assert.equal(r.json.room.players.a.live.score, 1200);
  await A('POST', '/api/rooms', { action: 'sync', ...a, final: { score: 50000, stars: 3, grade: 'S', accuracy: 0.97 } });
  r = await B('POST', '/api/rooms', { action: 'sync', ...b, final: { score: 40000, stars: 2, grade: 'A', failed: false } });
  assert.equal(r.json.room.players.a.final.score, 50000);
  assert.equal(r.json.room.players.b.final.grade, 'A');
  // 한 판 더 → 대기실, 준비 풀림
  r = await A('POST', '/api/rooms', { action: 'again', ...a });
  assert.equal(r.json.room.status, 'lobby');
  assert.equal(r.json.room.players.a.ready, false);
  assert.equal(r.json.room.players.a.final.score, 50000); // 지난 판 결과는 대기실에서도 보임
  // 나가기 → 방장 넘어감
  await A('POST', '/api/rooms', { action: 'leave', ...a });
  r = await B('POST', '/api/rooms', { action: 'sync', ...b });
  assert.equal(r.json.room.host, 'b');
  assert.deepEqual(Object.keys(r.json.room.players), ['b']);
});

test('⚡ 빠른 대결: 같은 묶음에서 기다리는 사람과 바로 붙고 곡은 둘 다 칠 수 있는 것, 실시간 연결 신호 전달', async () => {
  // 빠른 대결도 인증한 사람만 (쉬움·보통도)
  for (const bracket of ['easy', 'hard']) assert.equal((await client()('POST', '/api/rooms', { action: 'quick', name: '셋째', bracket })).json.error, 'confirm_required');
  const A = await verifiedClient('기다림', 'quick.a');
  const B = await verifiedClient('찾음', 'quick.b');
  const C = await verifiedClient('셋째', 'quick.c');
  assert.deepEqual((await client()('POST', '/api/rooms', { action: 'count' })).json.waiting, { easy: 0, hard: 0 });
  const a = await A('POST', '/api/rooms', { action: 'quick', name: '기다림', bracket: 'easy' });
  assert.equal(a.status, 200);
  assert.equal(a.json.waiting, true);
  assert.deepEqual((await client()('POST', '/api/rooms', { action: 'count' })).json.waiting, { easy: 1, hard: 0 }, '기다리는 사람 수');
  assert.equal(a.json.room.pub, 'easy');
  assert.match(a.json.room.players.a.pid, /^\w{6,}$/);
  const b = await B('POST', '/api/rooms', { action: 'quick', name: '찾음', bracket: 'easy' });
  assert.equal(b.status, 200);
  assert.equal(b.json.code, a.json.code, '기다리던 방에 붙음');
  assert.equal(b.json.room.status, 'lobby', '붙어도 바로 시작 안 함 → 대기실');
  const ka = { code: a.json.code, slot: 'a', key: a.json.key };
  const kb = { code: b.json.code, slot: 'b', key: b.json.key };
  // 방장(a)만 무제한(서바이벌) 켜기. 켜면 준비가 풀림
  let q = await B('POST', '/api/rooms', { action: 'sync', ...kb, endless: true });
  assert.equal(q.json.room.endless, false, '방장 아니면 못 바꿈');
  q = await B('POST', '/api/rooms', { action: 'sync', ...kb, ready: true });
  q = await A('POST', '/api/rooms', { action: 'sync', ...ka, endless: true });
  assert.equal(q.json.room.endless, true);
  assert.equal(q.json.room.players.b.ready, false, '규칙이 바뀌면 준비 풀림');
  // 한 사람만 준비 → 아직 대기
  q = await A('POST', '/api/rooms', { action: 'sync', ...ka, ready: true });
  assert.equal(q.json.room.status, 'lobby');
  assert.equal(q.json.room.players.a.ready, true);
  // 둘 다 준비 → 시작 (곡은 그 묶음에서 무작위)
  q = await B('POST', '/api/rooms', { action: 'sync', ...kb, ready: true });
  assert.equal(q.json.room.status, 'playing');
  assert.equal(q.json.room.endless, true);
  assert.ok(q.json.room.level >= 1 && q.json.room.level <= 8, '쉬움·보통 = 1~8단계');
  assert.ok(q.json.room.startAt > q.json.now);
  // 서바이벌 결과: 목숨 다 씀 · 버틴 시간 · Lv 이 상대에게 전달
  await A('POST', '/api/rooms', { action: 'sync', ...ka, final: { score: 1200, died: true, survived: 42.5, lv: 2 } });
  q = await B('POST', '/api/rooms', { action: 'sync', ...kb });
  assert.deepEqual([q.json.room.players.a.final.died, q.json.room.players.a.final.survived, q.json.room.players.a.final.lv], [true, 42.5, 2]);
  // 실시간 연결 신호: A 가 offer, B 가 answer
  await A('POST', '/api/rooms', { action: 'sync', ...ka, sig: { id: 'x1', to: b.json.room.players.b.pid, type: 'offer', sdp: 'v=0 offer' } });
  let r = await B('POST', '/api/rooms', { action: 'sync', ...kb });
  assert.equal(r.json.room.players.a.sig.sdp, 'v=0 offer');
  await B('POST', '/api/rooms', { action: 'sync', ...kb, sig: { id: 'x1', to: a.json.room.players.a.pid, type: 'answer', sdp: 'v=0 answer' } });
  r = await A('POST', '/api/rooms', { action: 'sync', ...ka });
  assert.equal(r.json.room.players.b.sig.type, 'answer');
  // 다른 묶음 사람은 이 방에 안 붙음
  const c = await C('POST', '/api/rooms', { action: 'quick', name: '셋째', bracket: 'easy' });
  assert.notEqual(c.json.code, a.json.code);
  assert.equal(c.json.waiting, true);
  await C('POST', '/api/rooms', { action: 'leave', code: c.json.code, slot: 'a', key: c.json.key });
});

test('📱 기기 옮기기: 코드 만들기 → 새 기기에서 넣으면 기록 + 랭킹 계정(인증 포함) · 한 번만 · 틀린 코드 거부', async () => {
  const old = client();
  const ok = await old('POST', '/api/verify/password', { name: '옮기는사람', ig: 'move.me', password: '시험1234' });
  assert.equal(ok.json.confirmed, true);
  const bests = { 1: { score: 900000, grade: 'S', stars: 3, fullCombo: true, at: 1 }, endless: { score: 5, diamonds: 2, roundsCleared: 7 }, 'bad key!': { score: 1 } };
  const made = await old('POST', '/api/transfer', { op: 'make', data: { bests, nick: '옮기는사람', settings: { music: 0.3, offsetMs: 120, band: 'piano', evil: 1 } } });
  assert.equal(made.status, 200);
  assert.match(made.json.code, /^\d{6}$/);
  assert.ok(made.json.expiresAt > Date.now());

  const fresh = client();
  assert.equal((await fresh('GET', '/api/me')).json.verified, false);
  assert.equal((await fresh('POST', '/api/transfer', { op: 'take', code: '12' })).json.error, 'bad_code');
  const wrong = String((Number(made.json.code) + 1) % 1_000_000).padStart(6, '0');
  assert.equal((await fresh('POST', '/api/transfer', { op: 'take', code: wrong })).status, 404);
  const got = await fresh('POST', '/api/transfer', { op: 'take', code: made.json.code.slice(0, 3) + ' ' + made.json.code.slice(3) });
  assert.equal(got.status, 200);
  assert.equal(got.json.data.bests[1].stars, 3);
  assert.equal(got.json.data.bests.endless.roundsCleared, 7);
  assert.equal(got.json.data.bests['bad key!'], undefined);
  assert.deepEqual(got.json.data.settings, { music: 0.3, band: 'piano' }, '싱크 보정은 안 넘김');
  assert.equal(got.json.me.confirmed, true);
  // 새 기기가 같은 계정이 됨 → 잠긴 단계도 열림
  assert.equal((await fresh('GET', '/api/me')).json.player.username, '옮기는사람');
  assert.equal((await fresh('POST', '/api/runs', { level: 9 })).status, 200);
  // 한 번만
  assert.equal((await client()('POST', '/api/transfer', { op: 'take', code: made.json.code })).status, 404);
  // 랭킹 참여 안 한 사람도 기록은 옮길 수 있음 (계정은 없음)
  const anon = client();
  const m2 = await anon('POST', '/api/transfer', { op: 'make', data: { bests: { 2: { score: 1, stars: 1 } } } });
  const g2 = await client()('POST', '/api/transfer', { op: 'take', code: m2.json.code });
  assert.equal(g2.json.me, null);
  assert.equal(g2.json.data.bests[2].stars, 1);
  assert.equal((await anon('POST', '/api/transfer', { op: 'make', data: 'x' })).json.error, 'bad_data');
});

test('📦 예전 기록 되찾기: 같은 인스타 아이디 + 암호 → 원래 계정·랭킹 점수·깬 단계 / 새로 생긴 중복 계정은 합침', async () => {
  // 예전 주소에서 인증하고 1·2단계 점수를 올린 사람
  const oldPhone = client();
  await oldPhone('POST', '/api/verify/password', { name: '옛날사람', ig: 'old.timer', password: '시험1234' });
  for (const lv of [1, 2]) {
    const run = (await oldPhone('POST', '/api/runs', { level: lv })).json.runToken;
    assert.equal((await oldPhone('POST', '/api/scores', { runToken: run, level: lv, ...perfectRun(lv) })).status, 200);
  }
  // 새 주소: 쿠키가 없음 → 닉네임 없이 아이디 + 암호만으로 되찾기
  const fresh = client();
  const r = await fresh('POST', '/api/verify/password', { ig: '@Old.Timer', password: '시험1234' });
  assert.equal(r.status, 200);
  assert.equal(r.json.restored.username, '옛날사람');
  assert.equal(r.json.restored.levels, 2);
  assert.equal(r.json.player.username, '옛날사람');
  assert.equal(r.json.confirmed, true);
  assert.equal(r.json.bests[1].stars, 3, 'SS 면 별 3개');
  assert.ok(r.json.bests[2].score > 0);
  // 같은 계정이라 랭킹에 한 번만, 내 기록으로 보임
  const lb = (await fresh('GET', '/api/leaderboard?level=1')).json;
  assert.equal(lb.entries.filter((e) => e.username === '옛날사람').length, 1);
  assert.ok(lb.me && lb.me.score > 0);

  // 예전 기록이 없는 아이디 + 닉네임 없음 → bad_name (처음이면 닉네임이 필요)
  assert.equal((await client()('POST', '/api/verify/password', { ig: 'never.seen', password: '시험1234' })).json.error, 'bad_name');
  // 처음 온 사람은 예전처럼 새 계정
  const first = await client()('POST', '/api/verify/password', { name: '처음왔어', ig: 'brand.new', password: '시험1234' });
  assert.equal(first.json.restored, null);
  assert.equal(first.json.player.username, '처음왔어');
  // 암호가 틀리면 아무것도 안 줌
  assert.equal((await client()('POST', '/api/verify/password', { ig: 'old.timer', password: '틀림' })).json.error, 'wrong_password');
});

test('📦 옛 주소 다리: 같은 폰이면 싱크 보정까지 넘김', async () => {
  const c = client();
  const m = await c('POST', '/api/transfer', { op: 'make', data: { bests: {}, settings: { offsetMs: 80 }, calib: { offsetMs: 80, calibrated: true } } });
  const t = await client()('POST', '/api/transfer', { op: 'take', code: m.json.code });
  assert.deepEqual(t.json.data.calib, { offsetMs: 80, calibrated: true });
  assert.equal(t.json.data.settings.offsetMs, undefined);
});

test('📦 되찾기: 새 주소에서 아이디만 적어 생긴 중복 계정은 예전 계정으로 합쳐짐 (따로 띄운 서버: 닉네임 요청 제한 안 걸리게)', async (t) => {
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-dup-'));
  const { server: s3 } = createApp(loadConfig({ SESSION_SECRET: 's3', DATA_FILE: path.join(tmp3, 'db.json'), GATE_MODE: 'soft', MIN_RUN_RATIO: '0', ADMIN_TOKEN: 'admin-pw', FOLLOW_PASSWORD: '시험1234' }));
  await new Promise((r) => s3.listen(0, r));
  t.after(() => {
    s3.close();
    fs.rmSync(tmp3, { recursive: true, force: true });
  });
  const saved = base;
  base = `http://127.0.0.1:${s3.address().port}`;
  try {
    // 이미 새 주소에서 새로 인증해서 중복 계정이 생긴 사람 → '예전 기록 되찾기'(같은 아이디로 다시 인증)하면 합쳐짐
    const p2 = client();
    await p2('POST', '/api/verify/password', { name: '중복원조', ig: 'dup.user', password: '시험1234' });
    const run3 = (await p2('POST', '/api/runs', { level: 3 })).json.runToken;
    await p2('POST', '/api/scores', { runToken: run3, level: 3, ...perfectRun(3) });
    const newPhone = client();
    const g = await newPhone('POST', '/api/guest', { name: '새로만든', ig: 'dup.user' }); // 아이디만 적은 새 계정 (예전 주소 기록을 못 보고)
    assert.equal(g.status, 200, JSON.stringify(g.json));
    const run1 = (await newPhone('POST', '/api/runs', { level: 1 })).json.runToken;
    assert.ok(run1);
    const back = await newPhone('POST', '/api/verify/password', { password: '시험1234' });
    assert.equal(back.json.restored.username, '중복원조');
    assert.equal(back.json.player.username, '중복원조');
    const players = (await newPhone('GET', '/api/admin/players', null, adm)).json.players.filter((x) => x.ig === 'dup.user');
    assert.equal(players.length, 1, '새로 만든 계정은 지워지고 하나만');
  } finally {
    base = saved;
  }
});

test('📦 되찾기: 아이디를 대충 적었던 사람 → 닉네임 + 비슷한 아이디로 / 운영자 되찾기 코드', async () => {
  // 예전 주소: 아이디를 'jiminnn_12' 로 대충 적고 인증 + 1단계 점수
  const oldPhone = client();
  await oldPhone('POST', '/api/verify/password', { name: '지민이', ig: 'jiminnn_12', password: '시험1234' });
  const run = (await oldPhone('POST', '/api/runs', { level: 1 })).json.runToken;
  await oldPhone('POST', '/api/scores', { runToken: run, level: 1, ...perfectRun(1) });

  // 되찾기 창: 아이디만 (정확히 기억 못 함) → 못 찾음 (새 계정 안 만듦)
  const p = client();
  assert.equal((await p('POST', '/api/verify/password', { ig: 'jimin.12', password: '시험1234', restore: true })).json.error, 'no_old');
  assert.equal((await p('GET', '/api/me')).json.verified, false, '아무것도 안 생김');
  // 닉네임 + 비슷한 아이디 → 찾음
  const r = await p('POST', '/api/verify/password', { name: '지민이', ig: 'jimin_12', password: '시험1234', restore: true });
  assert.equal(r.json.restored.username, '지민이');
  assert.equal(r.json.bests[1].stars, 3);
  assert.equal(r.json.player.ig, 'jimin_12', '아이디는 이번에 적은 걸로 고쳐짐');
  // 닉네임만 같고 아이디가 전혀 다르면 못 가져감 (닉네임은 랭킹에 보이니까)
  const thief = client();
  assert.equal((await thief('POST', '/api/verify/password', { name: '지민이', ig: 'totally.other', password: '시험1234', restore: true })).json.error, 'no_old');

  // 운영자 되찾기 코드: 관리자만, 넣은 폰이 그 계정이 됨 (+ 깬 단계)
  const target = (await p('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.username === '지민이');
  assert.equal((await client()('POST', '/api/admin/players/recover', { igsid: target.igsid })).status, 401);
  const rc = await client()('POST', '/api/admin/players/recover', { igsid: target.igsid }, adm);
  assert.match(rc.json.code, /^\d{6}$/);
  assert.ok(rc.json.expiresAt - Date.now() > 23 * 3600 * 1000, '24시간');
  const lost = client();
  const got = await lost('POST', '/api/transfer', { op: 'take', code: rc.json.code });
  assert.equal(got.json.me.player.username, '지민이');
  assert.equal(got.json.me.confirmed, true);
  assert.equal(got.json.data.bests[1].stars, 3);
});

test('📮 되찾기 요청: 암호 필요 → admin 에 후보와 함께 → 승인하면 보낸 폰이 다음 확인 때 그 계정으로', async () => {
  // 예전 계정: 아이디를 엉망으로 적었던 사람
  const oldPhone = client();
  await oldPhone('POST', '/api/verify/password', { name: '잃어버린', ig: 'xx_lost_99', password: '시험1234' });
  const run = (await oldPhone('POST', '/api/runs', { level: 2 })).json.runToken;
  await oldPhone('POST', '/api/scores', { runToken: run, level: 2, ...perfectRun(2) });

  const p = client();
  assert.equal((await p('POST', '/api/recover-request', { nick: '잃어버린', nowIg: 'real.me', password: '틀림' })).json.error, 'wrong_password');
  assert.equal((await p('POST', '/api/recover-request', { nowIg: 'real.me', password: '시험1234' })).json.error, 'need_nick');
  assert.equal((await p('POST', '/api/recover-request', { nick: '잃어버린', nowIg: '!!', password: '시험1234' })).json.error, 'bad_ig');
  const sent = await p('POST', '/api/recover-request', { nick: '잃어버린', oldIg: 'lost99?', nowIg: '@Real.Me', password: '시험1234', memo: '2단계까지 깼어요' });
  assert.equal(sent.status, 200);
  const token = sent.json.token;
  assert.ok(token.length >= 20);
  assert.equal((await p('POST', '/api/recover-request/status', { token })).json.status, 'wait');
  assert.equal((await p('GET', '/api/me')).json.verified, false);

  // admin: 관리자만, 후보 계정이 같이 나옴
  assert.equal((await client()('GET', '/api/admin/recover-requests')).status, 401);
  const list = (await p('GET', '/api/admin/recover-requests', null, adm)).json.requests;
  const req = list.find((x) => x.nowIg === 'real.me');
  assert.equal(req.status, 'wait');
  assert.equal(req.memo, '2단계까지 깼어요');
  assert.equal(req.token, undefined, '관리자 목록엔 토큰 안 나옴');
  const cand = req.candidates.find((c) => c.username === '잃어버린');
  assert.ok(cand && cand.why.includes('닉네임 같음'));

  // 승인 → 보낸 폰이 확인하면 그 계정 + 깬 단계
  assert.equal((await p('POST', '/api/admin/recover-requests/approve', { id: req.id, igsid: cand.igsid }, adm)).json.ok, true);
  const done = await p('POST', '/api/recover-request/status', { token });
  assert.equal(done.json.status, 'done');
  assert.equal(done.json.me.player.username, '잃어버린');
  assert.equal(done.json.me.confirmed, true);
  assert.equal(done.json.bests[2].stars, 3);
  assert.equal((await p('GET', '/api/me')).json.player.username, '잃어버린', '쿠키도 그 계정');
  // 토큰 모르면 못 가져감
  assert.equal((await client()('POST', '/api/recover-request/status', { token: 'x'.repeat(30) })).status, 404);

  // 못 찾음 처리
  const p2 = client();
  const s2 = await p2('POST', '/api/recover-request', { nick: '없는사람', nowIg: 'nobody.here', password: '시험1234' });
  const r2 = (await p2('GET', '/api/admin/recover-requests', null, adm)).json.requests.find((x) => x.nowIg === 'nobody.here');
  assert.equal(r2.candidates.length, 0);
  await p2('POST', '/api/admin/recover-requests/reject', { id: r2.id }, adm);
  assert.equal((await p2('POST', '/api/recover-request/status', { token: s2.json.token })).json.status, 'rejected');
  assert.equal((await p2('POST', '/api/admin/recover-requests/delete', { id: r2.id }, adm)).json.ok, true);
});
