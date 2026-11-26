// 🎵 3곡 합산 방 (2026-11-26 건의): 방 처리 코드를 직접 불러 시험 (HTTP 요청 제한과 상관없이)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from '../server/store.js';
import { createRoomHandler, pickSumSongs } from '../server/rooms.js';
import { getLevel } from '../public/js/charts.js';

test('🎵 곡 고르기: 1곡은 고른 곡, 2·3곡은 다른 곡 · 1~3단계를 고르면 1~3단계에서 · 비슷한 난이도', () => {
  for (const first of [1, 2, 3]) {
    const s = pickSumSongs(first);
    assert.equal(s[0], first);
    assert.equal(new Set(s).size, 3);
    assert.ok(s.every((id) => id >= 1 && id <= 3));
  }
  for (let first = 4; first <= 18; first++) {
    const s = pickSumSongs(first);
    assert.equal(s[0], first);
    assert.equal(new Set(s).size, 3);
    const d = getLevel(first).difficulty;
    assert.ok(s.every((id) => id > 3 && id <= 18 && Math.abs(getLevel(id).difficulty - d) <= 1), `${first}: ${s}`);
  }
});

test('🎵 3곡 합산 방: 둘 다 곡을 끝내면 다음 곡 · 곡마다 점수가 쌓임 · 3곡 뒤엔 안 넘어감 · 한 판 더는 처음부터', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sum3-'));
  const store = new JsonStore(path.join(dir, 'db.json'));
  const room = createRoomHandler({ store, getPlayer: async () => ({}), canPlay: null });
  let now = 1_000_000;
  const call = async (body) => {
    const [status, out] = await room(null, body, (now += 1000));
    assert.equal(status, 200, JSON.stringify(out));
    return out;
  };
  const made = await call({ action: 'create', name: '합산장', mode: 'versus', level: 1 });
  const a = { code: made.code, slot: 'a', key: made.key };
  const joined = await call({ action: 'join', code: a.code, name: '친구' });
  const b = { code: a.code, slot: 'b', key: joined.key };
  // 무제한을 켰다가 3곡 합산으로 → 무제한은 꺼짐 (같이 못 켬)
  await call({ action: 'sync', ...a, endless: true });
  let r = await call({ action: 'sync', ...a, endless: false, sum3: true, ready: true });
  assert.equal(r.room.sum3, true);
  assert.equal(r.room.endless, false);
  r = await call({ action: 'sync', ...b, ready: true });
  assert.equal(r.room.status, 'playing');
  const { songs, setFrom } = r.room.sum;
  assert.equal(songs.length, 3);
  assert.equal(songs[0], 1, '1곡은 방장이 고른 곡');
  const scores = [[30000, 28000], [41000, 45000], [50000, 49000]];
  for (let i = 0; i < 3; i++) {
    assert.equal(r.room.round, setFrom + i);
    assert.equal(r.room.level, songs[i]);
    // 한 사람만 끝내면 다음 곡으로 안 넘어감
    r = await call({ action: 'sync', ...a, final: { score: scores[i][0] } });
    assert.equal(r.room.round, setFrom + i);
    r = await call({ action: 'sync', ...b, final: { score: scores[i][1] } });
    if (i < 2) assert.ok(r.room.startAt > now, '다음 곡 시작 시각');
  }
  assert.equal(r.room.round, setFrom + 2, '3곡 뒤엔 더 안 넘어감');
  assert.equal(r.room.status, 'playing');
  assert.deepEqual(r.room.players.a.sums, [30000, 41000, 50000]);
  assert.deepEqual(r.room.players.b.sums, [28000, 45000, 49000]);
  // 한 판 더 → 새 세트는 점수가 처음부터
  await call({ action: 'again', ...a });
  await call({ action: 'sync', ...a, ready: true });
  r = await call({ action: 'sync', ...b, ready: true });
  assert.equal(r.room.sum.setFrom, setFrom + 3);
  assert.equal(r.room.players.a.sums, null);
  // 합산을 끄면 보통 점수 승부 (세 곡 정보 없음)
  await call({ action: 'again', ...a });
  r = await call({ action: 'sync', ...a, sum3: false, ready: true });
  r = await call({ action: 'sync', ...b, ready: true });
  assert.equal(r.room.sum3, false);
  assert.equal(r.room.sum, null);
});

test('🎵 3곡 합산은 친구 방만 (랜덤 대결 방에선 못 켬)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sum3b-'));
  const store = new JsonStore(path.join(dir, 'db.json'));
  const room = createRoomHandler({ store, getPlayer: async () => ({}), canPlay: null });
  const [, q] = await room(null, { action: 'quick', name: '혼자', bracket: 'easy' }, 1000);
  const [, r] = await room(null, { action: 'sync', code: q.code, slot: 'a', key: q.key, sum3: true }, 2000);
  assert.equal(r.room.sum3, false);
});
