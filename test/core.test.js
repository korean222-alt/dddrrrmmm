import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { LEVELS, buildNotes, noteCount, maxScore, gradeFor, scoreBounds, pointsFor } from '../public/js/charts.js';
import { extractCodes, generateCode, isCode } from '../server/codes.js';
import { verifySignature, createInstagram } from '../server/instagram.js';
import { sign, unsign } from '../server/session.js';
import { messagesFromWebhook, processDm } from '../server/verify.js';
import { JsonStore } from '../server/store.js';

test('채보: 모든 마디가 16칸, 허용 문자만', () => {
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.id, i + 1);
    for (const bar of lv.bars) assert.match(bar, /^[KSB.]{16}$/, `Lv.${lv.id} ${bar}`);
    for (const k of ['hat', 'bass', 'chord', 'lead']) assert.equal(lv.song[k].length, 16, `Lv.${lv.id} song.${k}`);
  });
});

test('Lv.1~3 공개, Lv.4+ 잠금 대상', () => {
  assert.deepEqual(LEVELS.filter((l) => !l.gated).map((l) => l.id), [1, 2, 3]);
  assert.ok(LEVELS.find((l) => l.id === 4).gated);
});

test('노트 생성: 동시치기는 두 레인 같은 시각', () => {
  for (const lv of LEVELS) {
    const notes = buildNotes(lv);
    assert.equal(notes.length, noteCount(lv));
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i].time >= notes[i - 1].time);
  }
  const both = buildNotes(LEVELS[4]).filter((n) => n.pair === 0);
  assert.equal(both.length, 2);
  assert.equal(both[0].time, both[1].time);
});

test('점수: 만점, 등급, 범위', () => {
  const lv = LEVELS[0];
  const n = noteCount(lv);
  let s = 0;
  for (let c = 1; c <= n; c++) s += pointsFor('perfect', c);
  assert.equal(maxScore(lv), s);
  assert.equal(gradeFor({ perfect: n, great: 0, good: 0, miss: 0 }), 'SS');
  assert.equal(gradeFor({ perfect: 0, great: 0, good: 0, miss: n }), 'D');
  const b = scoreBounds({ perfect: n, great: 0, good: 0, miss: 0 });
  assert.ok(b.min <= s && s <= b.max);
});

test('DM 코드 인식', () => {
  assert.deepEqual(extractCodes('콩콩-K7P2'), ['K7P2']);
  assert.deepEqual(extractCodes('안녕하세요! 콩콩 k7p2 보냅니다'), ['K7P2']);
  assert.deepEqual(extractCodes('k7p2'), ['K7P2']);
  assert.deepEqual(extractCodes('콩콩–K7P2입니다'.replace('입니다', ' 입니다')), ['K7P2']);
  assert.deepEqual(extractCodes('그냥 잡담이에요'), []);
  assert.deepEqual(extractCodes('K0O1'), []); // 0,O,1 은 코드에 안 씀
  for (let i = 0; i < 50; i++) assert.ok(isCode(generateCode()));
});

test('웹훅 서명 검증', () => {
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  assert.ok(verifySignature(body, sig, 'secret'));
  assert.ok(!verifySignature(body, sig, 'other'));
  assert.ok(!verifySignature(body, 'sha256=abc', 'secret'));
  assert.ok(!verifySignature(body, undefined, 'secret'));
});

test('서명 토큰', () => {
  const t = sign({ igsid: '1' }, 'k');
  assert.deepEqual(unsign(t, 'k'), { igsid: '1' });
  assert.equal(unsign(t, 'x'), null);
  assert.equal(unsign(t.slice(0, -2) + 'aa', 'k'), null);
});

test('웹훅 본문 파싱: 에코/내 계정/텍스트 없음 제외', () => {
  const body = {
    object: 'instagram',
    entry: [
      {
        id: 'BIZ',
        messaging: [
          { sender: { id: 'U1' }, recipient: { id: 'BIZ' }, message: { mid: 'm1', text: '콩콩-K7P2' } },
          { sender: { id: 'BIZ' }, recipient: { id: 'U1' }, message: { mid: 'm2', text: '답장', is_echo: true } },
          { sender: { id: 'U2' }, recipient: { id: 'BIZ' }, message: { mid: 'm3', attachments: [] } },
        ],
      },
    ],
  };
  assert.deepEqual(messagesFromWebhook(body), [{ igsid: 'U1', text: '콩콩-K7P2' }]);
});

function fakeDeps(following) {
  const store = new JsonStore('/dev/null');
  store._save = () => {};
  const sent = [];
  const cfg = { codePrefix: '콩콩', instagramHandle: 'kongkong', followCheckMode: 'fake', ig: {} };
  const ig = { sendDm: async (id, text) => sent.push({ id, text }), checkFollow: async () => ({ following, username: 'alice' }) };
  return { store, ig, cfg, sent };
}

test('DM 처리: 팔로우 중이면 verified + 플레이어 저장', async () => {
  const d = fakeDeps(true);
  d.store.createCode({ code: 'K7P2', purpose: 'unlock', sessionId: 's', status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 60000 });
  const out = await processDm({ igsid: 'U1', text: '콩콩-K7P2' }, d);
  assert.equal(out.result, 'verified');
  assert.equal(d.store.getCode('K7P2').status, 'verified');
  assert.equal(d.store.getPlayer('U1').username, 'alice');
  assert.equal(d.sent.length, 1);
});

test('DM 처리: 팔로우 안 하면 not_following → 팔로우 후 재전송하면 verified', async () => {
  const d = fakeDeps(false);
  d.store.createCode({ code: 'AB23', purpose: 'unlock', sessionId: 's', status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 60000 });
  assert.equal((await processDm({ igsid: 'U1', text: 'AB23' }, d)).result, 'not_following');
  assert.match(d.sent[0].text, /@kongkong/);
  d.ig.checkFollow = async () => ({ following: true, username: 'alice' });
  assert.equal((await processDm({ igsid: 'U1', text: 'AB23' }, d)).result, 'verified');
});

test('DM 처리: 만료 코드 / 없는 코드', async () => {
  const d = fakeDeps(true);
  d.store.createCode({ code: 'ZZ99', purpose: 'unlock', sessionId: 's', status: 'pending', createdAt: 0, expiresAt: 1 });
  assert.equal((await processDm({ igsid: 'U1', text: 'ZZ99' }, d)).result, 'expired');
  assert.equal((await processDm({ igsid: 'U1', text: '안녕하세요' }, d)).result, 'no_code');
});

test('checkFollow: fake 는 항상 확인됨, real 은 is_user_follow_business 사용', async () => {
  const base = { followCheckMode: 'fake', ig: { graphHost: 'graph.instagram.com', apiVersion: 'v23.0', accessToken: '' } };
  assert.equal((await createInstagram(base).checkFollow('123456')).following, true);

  const fetchOk = async () => ({ ok: true, status: 200, json: async () => ({ username: 'bob', is_user_follow_business: false }) });
  const real = createInstagram({ ...base, followCheckMode: 'real', ig: { ...base.ig, accessToken: 't' } }, fetchOk);
  assert.deepEqual(await real.checkFollow('1'), { following: false, username: 'bob', source: 'real' });

  const fetchMissing = async () => ({ ok: true, status: 200, json: async () => ({ username: 'bob' }) });
  const real2 = createInstagram({ ...base, followCheckMode: 'real', ig: { ...base.ig, accessToken: 't' } }, fetchMissing);
  await assert.rejects(real2.checkFollow('1'), /is_user_follow_business/);
});
