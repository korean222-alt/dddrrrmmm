// 📴 서버 없을 때(DB 한도 초과 등) 친 최고 기록을 나중에 올리기 (2026-11-22)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { setNoPassword } from '../server/handler.js';
setNoPassword(false); // 예전 팔로워 암호·잠금 동작 시험 (사이트는 2026-11-26 부터 암호 없음 → nopass.test.js)
import { getLevel, noteCount, pointsFor } from '../public/js/charts.js';

let server, base, tmp;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-off-'));
  const cfg = loadConfig({ SESSION_SECRET: 'test-secret', DATA_FILE: path.join(tmp, 'db.json'), GATE_MODE: 'soft', MIN_RUN_RATIO: '0', ADMIN_TOKEN: 'admin-pw', FREE_PASS_UNTIL: '0' });
  ({ server } = createApp(cfg, {}));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
function client() {
  const jar = {};
  return async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar[kv.slice(0, i)] = kv.slice(i + 1);
    }
    return { status: res.status, json: await res.json().catch(() => null) };
  };
}
const adm = { 'x-admin-token': 'admin-pw' };
async function verifyIg(ig) {
  const c = client();
  const p = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === ig);
  assert.equal((await c('POST', '/api/admin/players/check', { igsid: p.igsid, checked: true }, adm)).json.ok, true);
}
function perfectRun(level) {
  const n = noteCount(getLevel(level));
  let score = 0;
  for (let i = 1; i <= n; i++) score += pointsFor('perfect', i);
  return { score, maxCombo: n, counts: { perfect: n, great: 0, good: 0, miss: 0, wrong: 0 } };
}

test('📴 서버 없을 때 친 최고 기록: 판 토큰 없이 다음 판 시작·점수 등록에 얹어 올림 (인증 완료한 사람만, 36시간 안)', async () => {
  const c = client();
  const g = await c('POST', '/api/guest', { name: '오프라인', ig: 'off.line' });
  assert.equal(g.status, 200, JSON.stringify(g.json));
  const pr6 = perfectRun(6);
  const at = Date.now() - 3600 * 1000;
  const list = [
    { level: 6, ...pr6, at, check: { sd: 20, n: 300 } },
    { level: 7, ...perfectRun(7), score: perfectRun(7).score + 5, at }, // 조작 → 버림
    { level: 8, ...perfectRun(8), at: Date.now() - 40 * 3600 * 1000 }, // 너무 오래됨 → 버림
    { level: 'endless', rounds: 2, score: 1000, at },
  ];
  // 인증 전: 안 받음 (폰이 계속 들고 있음)
  assert.equal((await c('POST', '/api/runs', { level: 1, offline: list })).json.offline, undefined);
  await verifyIg('off.line');
  const r = (await c('POST', '/api/runs', { level: 1, offline: list })).json;
  assert.ok(r.runToken);
  assert.deepEqual(r.offline.done.sort(), ['6', '7', '8', 'endless']);
  assert.equal(r.offline.improved, 2);
  const lb = (await c('GET', '/api/leaderboard?level=6')).json;
  assert.equal(lb.me.score, pr6.score);
  assert.equal((await c('GET', '/api/leaderboard?level=7')).json.me, null);
  assert.equal((await c('GET', '/api/leaderboard?level=endless')).json.me.rounds, 2);
  // 핵 의심 화면에 '서버 없을 때' 표시, 친 시각 그대로
  const me = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === 'off.line');
  const rep = (await c('GET', '/api/admin/suspects?igsid=' + me.igsid, null, adm)).json.report;
  const l6 = rep.items.find((x) => x.level === 6);
  assert.equal(l6.off, true);
  assert.equal(l6.sd, 20);
  assert.ok(Math.abs(l6.at - at) < 1000);
  assert.ok(rep.reasons.some((x) => x.includes('서버 없을 때')));
});

test('🩹 11-22 13시~11-23 9시 서버 쉬던 때 친 기록: 폰 최고 기록에서 얹어 보내면 받음 (점수 상한·시각만, 표시 없음)', async () => {
  const { validateLost, LOST_FROM, LOST_TO, LOST_UNTIL } = await import('../server/handler.js');
  const { maxScore } = await import('../public/js/charts.js');
  const at = LOST_FROM + 3600 * 1000;
  const max17 = maxScore(getLevel(17));
  assert.equal(validateLost({ level: 17, score: max17, maxCombo: 999, grade: 'S', at }).ok, true);
  assert.equal(validateLost({ level: 17, score: max17, maxCombo: 999, at }).maxCombo, noteCount(getLevel(17)));
  assert.equal(validateLost({ level: 17, score: max17 + 1, at }).error, 'bad_score');
  assert.equal(validateLost({ level: 17, score: 1000, at: LOST_TO }).error, 'bad_at');
  assert.equal(validateLost({ level: 17, score: 1000, at: LOST_FROM - 1 }).error, 'bad_at');
  assert.equal(validateLost({ level: 999, score: 1000, at }).error, 'bad_level');
  if (Date.now() > LOST_UNTIL) return; // 받는 기간 끝남
  const c = client();
  assert.equal((await c('POST', '/api/guest', { name: '되살림', ig: 'lost.rec' })).status, 200);
  const list = [
    { level: 9, score: 1234, maxCombo: 10, grade: 'B', at },
    { level: 10, score: 999999999, at }, // 상한 넘음 → 버림
  ];
  assert.equal((await c('POST', '/api/runs', { level: 1, lost: list })).json.lost, undefined); // 인증 전엔 안 받음
  await verifyIg('lost.rec');
  const r = (await c('POST', '/api/runs', { level: 1, lost: list })).json;
  assert.deepEqual(r.lost.done.sort(), ['10', '9']);
  const lb = (await c('GET', '/api/leaderboard?level=9')).json;
  assert.equal(lb.me.score, 1234);
  assert.equal((await c('GET', '/api/leaderboard?level=10')).json.me, null);
  const me = (await c('GET', '/api/admin/players', null, adm)).json.players.find((x) => x.ig === 'lost.rec');
  const l9 = (await c('GET', '/api/admin/suspects?igsid=' + me.igsid, null, adm)).json.report.items.find((x) => x.level === 9);
  assert.ok(!l9.off);
});
