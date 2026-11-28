// 🙂👥 남의 프로필 보기 · 친구 (2026-11-28): 랭킹 판 + 닉네임으로 찾음, 친구는 settings 한 줄
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';
import { seasonAt } from '../public/js/season.js';
import { tileSlot } from '../public/js/tiles.js';

test('프로필 보기 · 친구 추가·목록·끊기', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-fr-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const req = (method, url, body, tok) => h(new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }), { ip: '1.1.1.3' });
  const mk = async (name, ig) => (await req('POST', '/api/guest', { name, ig })).headers.get('x-player');
  const a = await mk('친구A', 'fr_a');
  const b = await mk('친구B', 'fr_b');
  await req('POST', '/api/intro', { intro: { t: '나는 B', i: 'piano', s: 3 } }, b);
  const n = seasonAt().n;
  for (const p of Object.values(store.data.players)) {
    p.checkedAt = p.checkedAt || Date.now();
    const rec = { score: p.username === '친구B' ? 5000 : 1000, at: Date.now(), grade: 'L1' };
    store.data.seasonScores[`${n}|${p.igsid}`] = { [tileSlot(3)]: rec };
    p.bests[tileSlot(3)] = rec;
  }
  // 프로필: 타일 총합 판에서 닉네임으로
  const pr = await req('GET', '/api/profile?b=tiles&u=' + encodeURIComponent('친구B'), null, a);
  assert.equal(pr.status, 200);
  const p = (await pr.json()).p;
  assert.equal(p.username, '친구B');
  assert.equal(p.intro.t, '나는 B');
  assert.equal(p.score, 5000);
  assert.equal(p.rank, 1);
  assert.equal(p.friend, false);
  assert.equal(p.igsid, undefined, 'igsid 는 안 보냄');
  assert.equal((await req('GET', '/api/profile?b=tiles&u=없는사람', null, a)).status, 404);
  // 곡 판에서도
  assert.equal((await req('GET', '/api/profile?b=t3&u=' + encodeURIComponent('친구B'))).status, 200);
  // 친구 추가 → 목록 (나 + B, 점수 순)
  assert.equal((await req('POST', '/api/friends', { add: { b: 'tiles', u: '친구A' } }, a)).status, 400, '나는 못 추가');
  // 친구 요청 → B 가 받은 요청 보고 수락 (2026-11-28 '요청 보낼 수 있게')
  const ra = await (await req('POST', '/api/friends', { add: { b: 'tiles', u: '친구B' } }, a)).json();
  assert.equal(ra.state, 'sent');
  assert.equal((await (await req('GET', '/api/profile?b=tiles&u=' + encodeURIComponent('친구B'), null, a)).json()).p.sent, true);
  assert.equal((await (await req('GET', '/api/me', null, b)).json()).frReq, 1);
  const lb = await (await req('GET', '/api/friends', null, b)).json();
  assert.deepEqual(lb.reqs.map((c) => c.username), ['친구A']);
  assert.equal((await req('POST', '/api/friends', { accept: '친구A' }, b)).status, 200);
  assert.deepEqual((await (await req('GET', '/api/friends', null, b)).json()).list.map((c) => c.username).sort(), ['친구A', '친구B'].sort());
  const l = await (await req('GET', '/api/friends', null, a)).json();
  assert.deepEqual(l.list.map((c) => [c.username, !!c.me, c.friend]), [['친구B', false, true], ['친구A', true, false]]);
  assert.equal(JSON.stringify(l).includes('igsid'), false);
  assert.equal((await (await req('GET', '/api/profile?b=tiles&u=' + encodeURIComponent('친구B'), null, a)).json()).p.friend, true);
  // 끊기
  await req('POST', '/api/friends', { del: -1, u: '친구B' }, a);
  const l2 = await (await req('GET', '/api/friends', null, a)).json();
  assert.deepEqual(l2.list.map((c) => c.username), ['친구A']);
  assert.deepEqual((await (await req('GET', '/api/friends', null, b)).json()).list.map((c) => c.username), ['친구B'], '끊으면 둘 다');
  // 닉네임으로 찾기 → 요청 → 상대도 나한테 요청하면 바로 친구
  const sr = await (await req('GET', '/api/friends/search?q=' + encodeURIComponent('친구'), null, a)).json();
  assert.deepEqual(sr.list.map((c) => [c.username, c.n]), [['친구B', 0]]);
  assert.equal((await (await req('POST', '/api/friends', { add: { b: 'name', u: '친구B', n: 0 } }, a)).json()).state, 'sent');
  assert.equal((await (await req('POST', '/api/friends', { add: { b: 'name', u: '친구A', n: 0 } }, b)).json()).state, 'friend');
  assert.equal((await req('GET', '/api/friends')).status, 401);
});

// D1(SQLite)·Postgres 저장소의 친구 카드 쿼리 (쿼리 1번, 숨긴 사람 빼고, 기록 없으면 0)
for (const kind of ['d1', 'pg']) {
  test(`[${kind}] friendCards`, async () => {
    let store;
    if (kind === 'd1') {
      const { DatabaseSync } = await import('node:sqlite');
      const { D1Store, d1Local } = await import('../server/d1store.js');
      store = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
    } else {
      const { PGlite } = await import('@electric-sql/pglite');
      const { PgStore } = await import('../server/pgstore.js');
      const db = new PGlite();
      store = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
    }
    await store.upsertPlayer('g1', { username: '하나', ig: 'one' });
    await store.upsertPlayer('g2', { username: '둘', ig: 'two' });
    await store.setIntro('g1', { t: '안녕', s: 3, i: '' });
    await store.recordSeasonScore(2, 'g1', tileSlot(3), 700);
    await store.recordSeasonScore(2, 'g1', tileSlot(4), 300);
    await store.recordSeasonScore(2, 'g1', 5, 99999); // 드럼 기록은 안 셈
    const cards = (await store.friendCards(2, ['g1', 'g2', 'g3'])).sort((a, b) => b.score - a.score);
    assert.deepEqual(cards.map((c) => [c.username, c.score, c.n]), [['하나', 1000, 2], ['둘', 0, 0]]);
    assert.equal(cards[0].intro.t, '안녕');
    assert.deepEqual(await store.friendCards(2, []), []);
    // 💬 채팅 · 🔎 닉네임 찾기
    const id1 = await store.chatAdd({ at: 1000, igsid: 'g1', name: '하나', av: null, text: '첫 글' });
    const id2 = await store.chatAdd({ at: 2000, igsid: 'g2', name: '둘', av: null, text: '둘째' });
    assert.ok(id2 > id1);
    assert.deepEqual((await store.chatSince(0, 0)).map((r) => r.text), ['첫 글', '둘째']);
    assert.deepEqual((await store.chatSince(id1, 0)).map((r) => r.text), ['둘째']);
    assert.deepEqual((await store.chatSince(0, 1500)).map((r) => r.text), ['둘째']);
    for (let i = 0; i < 3; i++) await store.chatReport(id1, 3);
    assert.deepEqual((await store.chatSince(0, 0)).map((r) => r.text), ['둘째']);
    assert.equal((await store.chatGet(id1)).igsid, 'g1');
    await store.chatPurge(1500);
    assert.equal(await store.chatGet(id1), null);
    await store.upsertPlayer('g3', { username: '하나둘', ig: 'three' });
    assert.deepEqual((await store.findByName('하나')).map((r) => r.username), ['하나', '하나둘']);
    assert.deepEqual((await store.findByName('하나', { exact: true })).map((r) => r.igsid), ['g1']);
  });
}

test('🎮 친구 초대 · 🖼 프로필 배경(그림은 산 사람만)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-fr2-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const req = (method, url, body, tok) => h(new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }), { ip: '1.1.1.4' });
  const mk = async (name, ig) => (await req('POST', '/api/guest', { name, ig })).headers.get('x-player');
  const a = await mk('초대A', 'iv_a');
  const b = await mk('초대B', 'iv_b');
  const n = seasonAt().n;
  for (const p of Object.values(store.data.players)) {
    p.checkedAt = p.checkedAt || Date.now();
    store.data.seasonScores[`${n}|${p.igsid}`] = { [tileSlot(3)]: { score: 100, at: Date.now() } };
  }
  // 친구가 아니면 초대 못 함
  assert.equal((await req('POST', '/api/friends', { invite: { u: '초대B', code: '1234' } }, a)).status, 404);
  await req('POST', '/api/friends', { add: { b: 'tiles', u: '초대B' } }, a);
  await req('POST', '/api/friends', { accept: '초대A' }, b);
  assert.equal((await req('POST', '/api/friends', { invite: { u: '초대B', code: '1234' } }, a)).status, 200);
  const me = await (await req('GET', '/api/me', null, b)).json();
  assert.equal(me.invite.from, '초대A');
  assert.equal(me.invite.code, '1234');
  assert.equal((await (await req('GET', '/api/me', null, a)).json()).invite, undefined);
  // 배경: 색은 바로, 그림은 산 사람만
  let r = await (await req('POST', '/api/intro', { intro: { t: 'hi', b: 'sunset' } }, a)).json();
  assert.equal(r.player.intro.b, 'sunset');
  r = await (await req('POST', '/api/intro', { intro: { t: 'hi', b: 'sakura' } }, a)).json();
  assert.equal(r.player.intro.b, undefined);
  const ida = Object.values(store.data.players).find((p) => p.username === '초대A').igsid;
  await store.putWallet(ida, { coins: 0, t: 0, tn: 0, fday: '', fn: 0, init: 0, owned: ['bg:sakura'] });
  r = await (await req('POST', '/api/intro', { intro: { t: 'hi', b: 'sakura' } }, a)).json();
  assert.equal(r.player.intro.b, 'sakura');
});

test('💬 채팅: 열린 시간에만 · 로그인 계정만 · 연락처 막음 · 신고 3번이면 가림', async () => {
  const { chatWindow, chatClean } = await import('../public/js/chat.js');
  // 한국 18시~24시 (기본)
  const { chatHoursText } = await import('../public/js/chat.js');
  const day = Date.UTC(2026, 10, 28) - 9 * 3600e3;
  assert.equal(chatWindow(day + 17.9 * 3600e3).open, false);
  assert.equal(chatWindow(day + 18.5 * 3600e3).open, true);
  assert.equal(chatWindow(day + 23.9 * 3600e3).open, true);
  assert.equal(chatWindow(day + 24.1 * 3600e3).open, false);
  assert.equal(chatWindow(day + 20 * 3600e3, '18-20').open, false);
  assert.equal(chatWindow(day + 21 * 3600e3, '18-20').next, day + 42 * 3600e3);
  assert.equal(chatHoursText('18-24'), '저녁 6시~밤 12시');
  assert.equal(chatHoursText('18-20'), '저녁 6시~저녁 8시');
  assert.equal(chatClean('안녕 https://x.com').error, 'contact');
  assert.equal(chatClean('내 번호 010-1234-5678').error, 'contact');
  assert.equal(chatClean('오픈채팅 들어와').error, 'contact');
  assert.equal(chatClean('@my_insta 팔로우').error, 'contact');
  assert.equal(chatClean('x'.repeat(81)).error, 'long');
  assert.equal(chatClean('이거 시발 어렵다').text, '이거 ** 어렵다');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-chat-'));
  const mkH = (hours) => {
    const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0', CHAT_HOURS: hours, ADMIN_TOKEN: 'adm' });
    const store = new JsonStore(cfg.dataFile).init();
    return { store, h: createHandler(cfg, { store }) };
  };
  const { h } = mkH('0-24');
  const req = (method, url, body, tok, ip = '1.1.1.5') => h(new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }), { ip });
  const mk = async (name, ig) => (await req('POST', '/api/guest', { name, ig })).headers.get('x-player');
  const toks = [await mk('채팅1', 'c_1'), await mk('채팅2', 'c_2'), await mk('채팅3', 'c_3'), await mk('채팅4', 'c_4')];
  assert.equal((await req('POST', '/api/chat', { text: 'hi' })).status, 401);
  assert.equal((await req('POST', '/api/chat', { text: 'http://a.com' }, toks[0])).status, 400);
  const r1 = await (await req('POST', '/api/chat', { text: '안녕하세요' }, toks[0])).json();
  assert.equal(r1.msg.text, '안녕하세요');
  assert.equal((await req('POST', '/api/chat', { text: '또' }, toks[0])).status, 429, '3초에 1개');
  const g = await (await req('GET', '/api/chat?after=0', null, toks[1])).json();
  assert.equal(g.open, true);
  assert.deepEqual(g.msgs.map((x) => [x.name, x.text, x.mine]), [['채팅1', '안녕하세요', false]]);
  // 채팅에서 프로필
  assert.equal((await req('GET', `/api/profile?b=chat:${r1.msg.id}&u=` + encodeURIComponent('채팅1'), null, toks[1])).status, 200);
  // 신고 3번 → 가림 + 그 사람 못 씀
  for (const t of toks.slice(1)) await req('POST', '/api/chat', { report: r1.msg.id }, t);
  const g2 = await (await req('GET', '/api/chat?after=0', null, toks[1])).json();
  assert.equal(g2.msgs.length, 0);
  await new Promise((r) => setTimeout(r, 3100));
  assert.equal((await req('POST', '/api/chat', { text: '다시' }, toks[0])).status, 403);
  // 닫힌 시간
  const closed = mkH('0-0');
  const c = await (await closed.h(new Request('http://x/api/chat?after=0'), { ip: '1.1.1.6' })).json();
  assert.equal(c.open, false);
});

test('📢 채팅 공지: /공지 10 내용 = 공지 권한 계정만, 일반 글로 안 올라감', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-chatn-'));
  const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0', CHAT_HOURS: '0-24', ADMIN_TOKEN: 'adm' });
  const store = new JsonStore(cfg.dataFile).init();
  const h = createHandler(cfg, { store });
  const req = (method, url, body, tok, extra = {}) => h(new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-Player': tok } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined }), { ip: '1.1.1.7' });
  const mk = async (name, ig) => (await req('POST', '/api/guest', { name, ig })).headers.get('x-player');
  const boss = await mk('운영자', 'n_1');
  const user = await mk('손님', 'n_2');
  // 권한 없으면 못 씀 · 글로도 안 올라감
  assert.equal((await req('POST', '/api/chat', { text: '/공지 10 안녕하세요' }, user)).status, 400);
  const igsid = Object.values(store.data.players).find((p) => p.username === '운영자').igsid;
  const a = await (await req('POST', '/api/admin/chat-admin', { igsid }, null, { 'x-admin-token': 'adm' })).json();
  assert.equal(a.on, true);
  assert.equal((await req('POST', '/api/chat', { text: '/공지 안녕' }, boss)).status, 400, '분 없으면 안내');
  const r = await (await req('POST', '/api/chat', { text: '/공지 10 안녕하세요 여러분' }, boss)).json();
  assert.equal(r.notice.t, '안녕하세요 여러분');
  assert.ok(Math.abs(r.notice.until - Date.now() - 600_000) < 5000);
  const g = await (await req('GET', '/api/chat?after=0', null, user)).json();
  assert.equal(g.notice.t, '안녕하세요 여러분');
  assert.equal(g.msgs.length, 0, '명령은 글로 안 올라감');
  await req('POST', '/api/chat', { text: '/공지 끄기' }, boss);
  assert.equal((await (await req('GET', '/api/chat?after=0', null, user)).json()).notice, null);
});
