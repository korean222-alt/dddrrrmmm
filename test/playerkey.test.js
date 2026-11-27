// 🔑 로그인 열쇠를 쿠키 + 폰 저장소(X-Player) 둘 다로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHandler, setOldAsk, setNoPassword } from '../server/handler.js';
setNoPassword(false); // 예전 팔로워 암호 동작 시험 (사이트는 11-26 부터 암호 없음)
import { loadConfig } from '../server/config.js';
import { JsonStore } from '../server/store.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-key-'));
const cfg = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp, 'db.json'), FREE_PASS_UNTIL: '0' });
const handle = createHandler(cfg, { store: new JsonStore(cfg.dataFile).init() });
const call = (p, init) => handle(new Request('http://x' + p, init), { ip: '1.2.3.4' });

// 🔑 2026-11-25: 들어올 때마다 쿠키가 날아가 새 계정이 생기던 폰 → 열쇠를 X-Player 로도 주고받음
test('쿠키가 날아가도 폰 저장소 열쇠(X-Player)로 같은 계정 · 쿠키도 다시 줌', async () => {
  const r1 = await call('/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '열쇠시험', ig: 'key_test1' }) });
  assert.equal(r1.status, 200);
  const tok = r1.headers.get('x-player');
  assert.ok(tok && tok.includes('.'), '새 계정 열쇠를 헤더로 줌');
  // 쿠키 없이 헤더만 → 같은 계정 + 쿠키 다시
  const r2 = await call('/api/me', { headers: { 'X-Player': tok } });
  const me = await r2.json();
  assert.equal(me.player.username, '열쇠시험');
  assert.ok(r2.headers.getSetCookie().some((c) => c.startsWith('kk_player=')), '쿠키 다시 줌');
  // 쿠키만 있는 폰 → 헤더로 열쇠를 알려 줌 (저장소에 하나 갖게)
  const ck = `kk_player=${encodeURIComponent(tok)}`;
  const r3 = await call('/api/me', { headers: { Cookie: ck } });
  assert.equal(r3.headers.get('x-player'), tok);
  // 둘 다 있으면 조용히
  const r4 = await call('/api/me', { headers: { Cookie: ck, 'X-Player': tok } });
  assert.equal(r4.headers.get('x-player'), null);
  assert.equal(r4.headers.getSetCookie().length, 0);
  // 가짜 열쇠는 안 됨
  const r5 = await call('/api/me', { headers: { 'X-Player': tok.slice(0, -2) + 'xx' } });
  assert.equal((await r5.json()).verified, false);
  // 로그아웃 → '-' (폰 저장소에서 지움)
  const r6 = await call('/api/logout', { method: 'POST', headers: { 'X-Player': tok } });
  assert.equal(r6.headers.get('x-player'), '-');
});

// 🔑 같은 아이디·닉네임 예전 계정 → 새로 만들지 않고 '암호로 이어가기 / 새로 시작'
test('예전 계정 있으면 409 old_account · 새로 시작(fresh) 됨 · 암호로 이어가면 그 계정 + 새 계정 코인도 옮김', async () => {
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-old-'));
  const cfg2 = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp2, 'db.json'), FREE_PASS_UNTIL: String(Date.now() + 86400000), FOLLOW_PASSWORD: '암호1' });
  const store = new JsonStore(cfg2.dataFile).init();
  const h = createHandler(cfg2, { store });
  const req = (p, body, headers = {}) => h(new Request('http://x' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), { ip: '9.9.9.' + Math.random() });
  setOldAsk(true);
  store.upsertPlayer('g_old', { username: '빨대', ig: 'straw' });
  store.recordScore('g_old', 3, { score: 1000, grade: 'A', maxCombo: 10 });
  // 이용 등록(임시) · 같은 아이디+닉네임(띄어쓰기·대소문자 무시) → 409
  const r1 = await req('/api/verify/password', { name: '빨 대', ig: 'straw' });
  assert.equal(r1.status, 409);
  assert.equal((await r1.json()).username, '빨대');
  assert.equal((await req('/api/guest', { name: '빨대', ig: 'straw' })).status, 409);
  // 닉네임 다르면 그냥 새로
  assert.equal((await req('/api/verify/password', { name: '딴사람', ig: 'straw' })).status, 200);
  // 새로 시작
  const r2 = await req('/api/verify/password', { name: '빨대', ig: 'straw', fresh: true });
  assert.equal(r2.status, 200);
  const tok = r2.headers.get('x-player');
  const nu = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString()).igsid;
  assert.notEqual(nu, 'g_old');
  store.putWallet(nu, { coins: 300, t: 5, tn: 1, fday: '', fn: 0, init: 1, owned: ['bg:x'] });
  store.putWallet('g_old', { coins: 1000, t: 2, tn: 0, fday: '', fn: 0, init: 0, owned: [] });
  // 그 폰이 암호로 이어가기 → 예전 계정 + 코인 합침
  const r3 = await req('/api/verify/password', { password: '암호1', restore: true }, { 'X-Player': tok });
  assert.equal(r3.status, 200);
  assert.equal((await r3.json()).restored.username, '빨대');
  assert.equal(store.getWallet('g_old').coins, 1300);
  assert.deepEqual(store.getWallet('g_old').owned, ['bg:x']);
  assert.equal(store.getPlayer(nu), null);
  setOldAsk(false);
  assert.equal((await req('/api/verify/password', { name: '빨대', ig: 'straw' })).status, 200, '꺼 두면 그냥 새로');
});

test('합쳐서 지운 계정의 열쇠 → 남긴 계정으로 이어 주고 새 열쇠', async () => {
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-alias-'));
  const cfg3 = loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: path.join(tmp3, 'db.json'), FREE_PASS_UNTIL: '0' });
  const store = new JsonStore(cfg3.dataFile).init();
  const h = createHandler(cfg3, { store });
  const r1 = await h(new Request('http://x/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '옛계정', ig: 'old_one' }) }), { ip: '5.5.5.5' });
  const tok = r1.headers.get('x-player');
  const oldId = JSON.parse(Buffer.from(tok.split('.')[0], 'base64url').toString()).igsid;
  store.upsertPlayer('g_keep', { username: '남긴계정', ig: 'old_one' });
  store.deletePlayer(oldId);
  store.setSetting('alias:' + oldId, 'g_keep');
  const r2 = await h(new Request('http://x/api/me', { headers: { 'X-Player': tok } }), { ip: '5.5.5.5' });
  assert.equal((await r2.json()).player.username, '남긴계정');
  const nt = r2.headers.get('x-player');
  assert.equal(JSON.parse(Buffer.from(nt.split('.')[0], 'base64url').toString()).igsid, 'g_keep');
});

// 🙂 프로필 이미지 (2026-11-27): 가입 때 같이 · 나중에 바꾸기 · 이상한 값 거절 · 랭킹 줄에 보임
test('프로필 이미지: 가입 때 av · /api/avatar 로 바꿈 · 이상한 값 400', async () => {
  const r1 = await call('/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '프로필시험', ig: 'av_test1', av: 'jjak2' }) });
  assert.equal((await r1.clone().json()).player.av, 'jjak2');
  const tok = r1.headers.get('x-player');
  const r2 = await call('/api/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player': tok }, body: JSON.stringify({ av: 'crown' }) });
  assert.equal((await r2.json()).player.av, 'crown');
  const r3 = await call('/api/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Player': tok }, body: JSON.stringify({ av: '<img>' }) });
  assert.equal(r3.status, 400);
  const me = await (await call('/api/me', { headers: { 'X-Player': tok } })).json();
  assert.equal(me.player.av, 'crown');
  const r4 = await call('/api/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ av: 'kong' }) });
  assert.equal(r4.status, 401);
});
