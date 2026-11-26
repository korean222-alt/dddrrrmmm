// 🎹 시즌 2 (2026-11-26): 피아노 타일 채보·랭킹 · 출석·퀘스트 · 카카오 로그인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';
import { TILE_SONGS, tileLap, lapMirrors, tileTimes, tilesWithin, checkTileRun, tileSong, tileSlot, lapSpeed, lapStars, MAX_LAPS, gradeLaps, lapGrade } from '../public/js/tiles.js';
import { todayQuests, applyS2, kstDay, prevDay, attReward, QUEST_POOL } from '../public/js/quests.js';
import { kakaoHash } from '../server/kakao.js';
import { getLevel } from '../public/js/charts.js';
import { roomLevel, pickTileLevel } from '../server/rooms.js';

test('타일 채보: 음 하나 = 타일 하나 · 같은 줄 연속 없음(바퀴 경계 포함) · 타일 사이 0.12초 이상 · 첫 곡 뒤부터 빨라짐', () => {
  for (const s of TILE_SONGS) {
    const lap = tileLap(s.id);
    assert.ok(lap && lap.tiles.length >= 20, `${s.id} 타일 수`);
    const mir = lapMirrors(lap);
    let prev = -1;
    for (let k = 0; k < 3; k++) {
      lap.tiles.forEach((t, i) => {
        const lane = mir[k] ? 3 - t.lane : t.lane;
        assert.ok(lane >= 0 && lane <= 3);
        assert.notEqual(lane, prev, `${s.id} 바퀴 ${k} 타일 ${i}: 같은 줄 연속`);
        prev = lane;
        if (i) assert.ok(((t.step - lap.tiles[i - 1].step) * 15) / s.bpm >= 0.119, `${s.id} 타일 간격`);
      });
    }
    // 음 하나 = 타일 하나 (묶음 없음)
    const notes = getLevel(s.id).song.melody.join(' ').split(/\s+/).filter((x) => x && !x.startsWith('_')).length;
    assert.equal(lap.tiles.length, notes * lap.reps, `${s.id} 음 수`);
    // 한 바퀴는 20초 이상, 타일 시각은 늘어나기만
    assert.ok((lap.beats * 60) / s.bpm >= 20 - 0.01);
    const times = tileTimes(s.id);
    assert.equal(times.length, lap.tiles.length * MAX_LAPS);
    for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
    // 둘째 바퀴는 첫 바퀴보다 짧게 걸림
    const n = lap.tiles.length;
    assert.ok(times[2 * n - 1] - times[n] < times[n - 1] - times[0]);
  }
  assert.equal(lapSpeed(0), 1);
  assert.ok(lapSpeed(1) > 1 && lapSpeed(3) > lapSpeed(2));
  // 첫 바퀴 동안 별이 차오르고(1/3·2/3·끝), 그 뒤로 다이아
  assert.deepEqual(lapStars(0, 0.2), { stars: 0, gems: 0 });
  assert.deepEqual(lapStars(0, 0.34), { stars: 1, gems: 0 });
  assert.deepEqual(lapStars(0, 0.99), { stars: 2, gems: 0 });
  assert.deepEqual(lapStars(1), { stars: 3, gems: 0 });
  assert.deepEqual(lapStars(5), { stars: 3, gems: 4 });
  assert.equal(gradeLaps(lapGrade(7)), 7);
  assert.equal(tileSong('t99'), null);
  assert.equal(tileSong('t1').order, 1);
  assert.equal(tileSlot(12), 3012);
});

test('타일 점수 검사: 시간 안에 칠 수 있는 수만 · 바퀴 수와 맞아야', () => {
  const lap = tileLap(1);
  const per = lap.tiles.length;
  const sec = tileTimes(1)[per - 1] + 1;
  assert.ok(checkTileRun(1, { tiles: per, laps: 1, maxCombo: per }, sec).ok);
  assert.equal(checkTileRun(1, { tiles: per, laps: 1 }, 5).error, 'too_fast');
  assert.equal(checkTileRun(1, { tiles: 5, laps: 3 }, 999).error, 'bad_score');
  assert.equal(checkTileRun(1, { tiles: 3 * per, laps: 1 }, 9999).error, 'bad_score');
  assert.equal(checkTileRun(1, { tiles: -1, laps: 0 }, 10).error, 'bad_score');
  assert.ok(tilesWithin(1, 0) < tilesWithin(1, 30));
});

test('퀘스트: 날마다 3개(쉬운 것 1개), 같은 종류 안 겹침 · 출석은 하루 한 번, 이어지면 연속', () => {
  for (let d = 0; d < 40; d++) {
    const day = kstDay(Date.UTC(2026, 10, 1) + d * 86400000);
    const q = todayQuests(day);
    assert.equal(q.length, 3);
    assert.ok(q[0].easy);
    assert.equal(new Set(q.map((x) => x.kind)).size, 3);
    assert.ok(q.every((x) => QUEST_POOL.includes(x)));
  }
  const now = Date.UTC(2026, 10, 27, 3);
  const today = kstDay(now);
  let w = { coins: 100 };
  let r = applyS2(w, { att: today }, [], now);
  assert.equal(r.out.att.streak, 1);
  assert.equal(r.wallet.coins, 100 + attReward(1));
  r = applyS2(r.wallet, { att: today }, [], now);
  assert.equal(r.changed, false, '같은 날 두 번은 안 줌');
  // 다음 날 → 연속 2일
  const now2 = now + 86400000;
  r = applyS2(r.wallet, { att: kstDay(now2) }, [], now2);
  assert.equal(r.out.att.streak, 2);
  // 하루 건너뜀 → 다시 1일
  const now4 = now2 + 2 * 86400000;
  r = applyS2(r.wallet, { att: kstDay(now4) }, [], now4);
  assert.equal(r.out.att.streak, 1);
  // 미래 날짜·엉뚱한 날짜는 안 받음
  assert.equal(applyS2({ coins: 0 }, { att: '2030-01-01' }, [], now).changed, false);
  assert.equal(prevDay('2026-12-01'), '2026-11-30');
  // 퀘스트: 오늘 것만, 한 번씩만, 모두 완료는 3개 다 받은 뒤
  const qs = todayQuests(today).map((x) => x.id);
  r = applyS2({ coins: 0 }, { q: [qs[0], 'all', 'nope'], qd: today }, [], now);
  assert.deepEqual(r.out.q, [qs[0]]);
  r = applyS2(r.wallet, { q: [qs[0], qs[1], qs[2], 'all'], qd: today }, [], now);
  assert.deepEqual(r.out.q, [qs[1], qs[2], 'all']);
  const total = todayQuests(today).reduce((a, x) => a + x.reward, 0) + 100;
  assert.equal(r.wallet.coins, total);
  // 커뮤니티: 달성한 것만, 한 번만
  const comm = [{ id: 'f2000', done: true, reward: 1000 }, { id: 'x', done: false, reward: 9 }];
  r = applyS2({ coins: 0 }, { cq: ['f2000', 'x'] }, comm, now);
  assert.equal(r.wallet.coins, 1000);
  assert.equal(applyS2(r.wallet, { cq: ['f2000'] }, comm, now).changed, false);
});

// 저장소 셋 다 (JSON · D1(SQLite) · Postgres) 에서 같은 흐름
const KINDS = ['json', 'd1', 'pg'];
async function makeStore(kind, file) {
  if (kind === 'd1') {
    const { DatabaseSync } = await import('node:sqlite');
    const { D1Store, d1Local } = await import('../server/d1store.js');
    return new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  }
  if (kind === 'pg') {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PgStore } = await import('../server/pgstore.js');
    const db = new PGlite();
    return new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
  }
  return new JsonStore(file).init();
}
async function setup(extra = {}, kind = 'json') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-s2-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', ADMIN_TOKEN: 'adm', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: String(Date.now() + 86400000), MIN_RUN_RATIO: '0', ...extra });
  const store = await makeStore(kind, cfg.dataFile);
  const h = createHandler(cfg, { store });
  let jar = '';
  const call = async (p, body, headers = {}) => {
    const r = await h(new Request('http://x' + p, body === undefined ? { headers: { Cookie: jar, ...headers } } : { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jar, ...headers }, body: JSON.stringify(body) }), { ip: '5.5.5.' + Math.floor(Math.random() * 200) });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k] = kv.split('=');
      jar = jar.split('; ').filter((x) => x && !x.startsWith(k + '=')).concat(kv.endsWith('=') ? [] : [kv]).join('; ');
    }
    return r;
  };
  return { cfg, store, call, jar: () => jar, setJar: (j) => (jar = j) };
}

for (const kind of KINDS) test(`[${kind}] 시즌 2 타일 랭킹: 열기 전엔 미리보기(안 올림) → admin 이 열면 올라가고 곡 랭킹·타일 총합에 보임 · 출석은 코인과 같이`, async () => {
  const { call, store } = await setup({}, kind);
  assert.equal((await call('/api/verify/password', { name: '타일왕', ig: 'tile_king' })).status, 200);
  const cfgRes = await (await call('/api/config')).json();
  assert.equal(cfgRes.s2Open, false);
  assert.equal(cfgRes.s2Community[0].id, 'f2000');
  // 판 토큰 + 출석(코인 얹기)
  const run = await (await call('/api/runs', { level: 't1', coins: { s2: { att: kstDay() } } })).json();
  assert.ok(run.runToken);
  assert.equal(run.s2.att.streak, 1);
  assert.equal(run.coins, attReward(1));
  const per = tileLap(1).tiles.length;
  const play = { level: 't1', runToken: run.runToken, tiles: 12, laps: 0, maxCombo: 12 };
  // 너무 빨리 올림 → 거절 (판 시작 바로 뒤라 12개를 칠 수 없음)
  assert.equal((await call('/api/scores', play)).status, 400);
  // 시간을 당겨서 (판 토큰을 1분 전 것으로) — 열기 전엔 미리보기
  const { sign } = await import('../server/session.js');
  const old = sign({ l: 't1', t: Date.now() - 60_000, n: 'nonce-1' }, 's');
  const pre = await (await call('/api/scores', { ...play, runToken: old, tiles: per + 5, laps: 1 })).json();
  assert.equal(pre.preview, true);
  assert.equal((await store.leaderboard(3001, 50)).rows.length, 0);
  // admin 이 시즌 2 를 열고 팔로워 수를 적음
  assert.equal((await call('/api/admin/s2', { open: true }, {})).status, 401);
  const ad = await (await call('/api/admin/s2', { open: true, community: [{ id: 'f2000', icon: '📸', title: '팔로워 2,000명', goal: 2000, now: 2010, reward: 1000, done: true }] }, { 'X-Admin-Token': 'adm' })).json();
  assert.equal(ad.open, true);
  assert.equal(ad.community[0].done, true);
  const out = await (await call('/api/scores', { ...play, runToken: old, tiles: per + 5, laps: 1 })).json();
  assert.equal(out.improved, true);
  assert.equal(out.rank, 1);
  assert.ok(out.next && out.next.t1, '다음 판 토큰');
  // 같은 판 토큰 다시 → 409
  assert.equal((await call('/api/scores', { ...play, runToken: old, tiles: per + 6, laps: 1 })).status, 409);
  const lb = await (await call('/api/leaderboard?level=t1')).json();
  assert.equal(lb.entries[0].username, '타일왕');
  assert.equal(lb.entries[0].score, per + 5);
  assert.equal(lb.entries[0].laps, 1);
  const hall = await (await call('/api/hall?board=tiles')).json();
  assert.equal(hall.board, 'tiles');
  assert.equal(hall.me.score, per + 5);
  // 드럼 단계 총합엔 안 섞임
  const stage = await (await call('/api/hall?board=stage')).json();
  assert.equal(stage.me, null);
  // 커뮤니티 퀘스트 받기 (한 번만)
  const r1 = await (await call('/api/runs', { level: 't1', coins: { s2: { cq: ['f2000'] } } })).json();
  assert.deepEqual(r1.s2.cq, ['f2000']);
  const r2 = await (await call('/api/runs', { level: 't1', coins: { s2: { cq: ['f2000'] } } })).json();
  assert.deepEqual(r2.s2.cq, []);
  assert.equal(r2.coins, r1.coins);
  // 내 정보에 출석
  const me = await (await call('/api/me')).json();
  assert.equal(me.att.streak, 1);
});

test('타일 곡 잠금: 4번째 곡부터는 인증한 사람만 판 토큰', async () => {
  const { call } = await setup({ FREE_PASS_UNTIL: '0' });
  assert.equal((await call('/api/runs', { level: 't1' })).status, 200);
  const r = await call('/api/runs', { level: `t${TILE_SONGS[5].id}` });
  assert.equal(r.status, 403);
  assert.equal((await call('/api/runs', { level: 't999' })).status, 400);
});

for (const kind of KINDS) test(`[${kind}] 카카오 로그인: 키 없으면 꺼짐 · 연결 → 다른 브라우저에서 카카오로 같은 계정 · 다른 계정엔 못 붙임 · 다른 브라우저 시작은 거절`, async () => {
  const off = await setup({}, kind);
  assert.equal((await off.call('/api/auth/kakao/start', { mode: 'login' })).status, 404);
  assert.equal((await (await off.call('/api/config')).json()).kakao, false);
  const { call, jar, setJar } = await setup({ KAKAO_REST_KEY: 'rk', KAKAO_SECRET: 'cs' }, kind);
  assert.equal((await (await call('/api/config')).json()).kakao, true);
  assert.equal((await call('/api/verify/password', { name: '카톡이', ig: 'kakao_one' })).status, 200);
  const realFetch = globalThis.fetch;
  let kakaoId = '777';
  globalThis.fetch = async (u) => {
    if (String(u).includes('/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
    if (String(u).includes('/v2/user/me')) return new Response(JSON.stringify({ id: Number(kakaoId) }), { status: 200 });
    throw new Error('unexpected ' + u);
  };
  try {
    const go = async (mode) => {
      const st = await (await call('/api/auth/kakao/start', { mode })).json();
      assert.match(st.url, /^https:\/\/kauth\.kakao\.com\/oauth\/authorize\?/);
      const state = new URL(st.url).searchParams.get('state');
      assert.equal(new URL(st.url).searchParams.get('redirect_uri'), 'http://x/api/auth/kakao/callback');
      const r = await call(`/api/auth/kakao/callback?code=c&state=${encodeURIComponent(state)}`);
      assert.equal(r.status, 302);
      return r.headers.get('location');
    };
    assert.equal(await go('link'), '/?kakao=linked');
    assert.equal((await (await call('/api/me')).json()).kakao, true);
    const mine = jar();
    // 다른 브라우저(쿠키 없음)에서 카카오로 → 같은 계정
    setJar('');
    assert.equal(await go('login'), '/?kakao=login');
    assert.equal((await (await call('/api/me')).json()).player.username, '카톡이');
    // 다른 계정이 같은 카카오를 붙이려 함 → taken
    setJar('');
    assert.equal((await call('/api/verify/password', { name: '딴사람', ig: 'other_one' })).status, 200);
    assert.equal(await go('link'), '/?kakao=taken');
    // 연결 안 된 카카오로 로그인 → 이 폰 계정(카카오 없음)에 연결
    kakaoId = '888';
    assert.equal(await go('login'), '/?kakao=linked');
    // 다른 브라우저에서 시작한 state 를 가져와도 (쿠키가 다르면) 거절
    setJar(mine);
    const st = await (await call('/api/auth/kakao/start', { mode: 'login' })).json();
    setJar('');
    const r = await call(`/api/auth/kakao/callback?code=c&state=${encodeURIComponent(new URL(st.url).searchParams.get('state'))}`);
    assert.equal(r.headers.get('location'), '/?kakao=expired');
    // 취소
    assert.equal((await call('/api/auth/kakao/callback?error=access_denied')).headers.get('location'), '/?kakao=cancel');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.notEqual(kakaoHash('1', 'a'), kakaoHash('1', 'b'));
});

test('⚔️ 타일 대결: 랜덤(tiles) 두 사람이 붙으면 바로 타일 곡 · 친구 방 곡을 타일로 바꿀 수 있음', async () => {
  assert.equal(roomLevel('t3'), 't3');
  assert.equal(roomLevel(5), 5);
  assert.equal(roomLevel('t999'), null);
  for (let i = 0; i < 20; i++) assert.ok(['t1', 't2', 't3'].includes(pickTileLevel(false)));
  const a = await setup();
  const b = await setup();
  // 같은 서버(저장소)에서 두 사람: b 의 call 을 a 의 handler 로 쓰려면 같은 setup 이어야 함 → a 하나로 쿠키만 바꿔 씀
  const room = async (body) => (await a.call('/api/rooms', body)).json();
  const w = await room({ action: 'quick', name: '하나', bracket: 'tiles' });
  assert.equal(w.waiting, true);
  const j = await room({ action: 'quick', name: '둘', bracket: 'tiles' });
  assert.equal(j.room.status, 'playing');
  assert.match(String(j.room.level), /^t\d+$/);
  const cnt = await room({ action: 'count' });
  assert.equal(typeof cnt.waiting.tiles, 'number');
  // 친구 방: 타일 곡으로 만들고 바꾸기
  const c = await room({ action: 'create', name: '방장', mode: 'versus', level: 't2' });
  assert.equal(c.room.level, 't2');
  const ch = await room({ action: 'sync', code: c.code, slot: c.slot, key: c.key, level: 't1' });
  assert.equal(ch.room.level, 't1');
  void b;
});
