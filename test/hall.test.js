// 🏛 시즌 총합 랭킹 · 명예의 전당: JSON 저장소와 Postgres 저장소(PGlite)가 똑같이 동작하는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { JsonStore } from '../server/store.js';
import { seasonAt, endedSeasons, seasonLeftText, cleanHallImage, SEASONS } from '../public/js/season.js';

const E = 1_000_000_000;

async function stores() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-hall-'));
  const json = new JsonStore(path.join(tmp, 'db.json'));
  json.init();
  const { PGlite } = await import('@electric-sql/pglite');
  const { PgStore } = await import('../server/pgstore.js');
  const db = new PGlite();
  const pg = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
  const { DatabaseSync } = await import('node:sqlite');
  const { D1Store, d1Local } = await import('../server/d1store.js');
  const d1 = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  return { json, pg, d1 };
}

test('시즌: 시즌 1 은 11/26 23:59:59(한국) 까지, 그 뒤는 시즌 2 · 안내 문구', () => {
  const kst = (d, h = 12) => Date.UTC(2026, 10, d, h - 9);
  assert.equal(seasonAt(kst(21)).n, 1);
  assert.equal(seasonAt(SEASONS[0].end).n, 1);
  assert.equal(seasonAt(SEASONS[0].end + 1).n, 2);
  assert.deepEqual(endedSeasons(kst(26, 23)), []);
  assert.deepEqual(endedSeasons(kst(27, 0)), [1]);
  assert.equal(seasonLeftText(kst(21)), '🏆 5일 뒤 시즌 1이 종료돼요');
  assert.match(seasonLeftText(kst(26, 20)), /오늘 밤 11시 59분에 시즌 1/);
  assert.match(seasonLeftText(kst(28)), /시즌 2 진행 중/);
  assert.ok(cleanHallImage('data:image/jpeg;base64,AAAA'));
  assert.equal(cleanHallImage('data:text/html;base64,AAAA'), null);
  assert.equal(cleanHallImage('data:image/jpeg;base64,' + 'A'.repeat(70000)), null);
});

test('시즌 총합 랭킹(단계·무제한) · 시즌 2 는 그 시즌 기록만 · 명예의 전당 사진은 본인만', async () => {
  const { json, pg, d1 } = await stores();
  for (const [name, s] of Object.entries({ json, pg, d1 })) {
    for (const [id, nick] of [['a', '쿵왕'], ['b', '짝왕'], ['c', '셋째'], ['d', '미인증']]) {
      await s.upsertPlayer(id, { username: nick, ig: id + '_ig' });
      if (id !== 'd') await s.setChecked(id, true);
    }
    await s.recordScore('a', 1, { score: 1000, grade: 'A', maxCombo: 1 });
    await s.recordScore('a', 2, { score: 2000, grade: 'A', maxCombo: 1 });
    await s.recordScore('b', 1, { score: 2500, grade: 'S', maxCombo: 1 });
    await s.recordScore('c', 1, { score: 100, grade: 'C', maxCombo: 1 });
    await s.recordScore('d', 1, { score: 99999, grade: 'S', maxCombo: 1 });
    // 무제한: 그리그(0) + 단계별(-3)
    await s.recordScore('b', 0, { score: 5 * E + 40000, grade: null, maxCombo: 0 });
    await s.recordScore('b', -3, { score: 2 * E + 9000, grade: null, maxCombo: 0 });
    await s.recordScore('c', 0, { score: 9 * E + 45000, grade: null, maxCombo: 0 });

    const st = (await s.seasonBoard(1, 'stage', 50)).rows;
    assert.deepEqual(st.map((r) => [r.username, r.score, r.n, r.rank]), [['쿵왕', 3000, 2, 1], ['짝왕', 2500, 1, 2], ['셋째', 100, 1, 3]], name);
    const en = (await s.seasonBoard(1, 'endless', 50)).rows;
    assert.deepEqual(en.map((r) => [r.username, r.score, r.rounds, r.n]), [['짝왕', 49000, 7, 2], ['셋째', 45000, 9, 1]], name);
    assert.equal((await s.seasonRankOf(1, 'stage', 'c')).rank, 3, name);
    assert.equal(await s.seasonRankOf(1, 'stage', 'd'), null, name);

    // 시즌 2: 새로 친 것만
    await s.recordSeasonScore(2, 'c', 1, 500);
    await s.recordSeasonScore(2, 'c', 1, 300); // 낮은 건 그대로
    await s.recordSeasonScore(2, 'a', 1, 400);
    const s2 = (await s.seasonBoard(2, 'stage', 50)).rows;
    assert.deepEqual(s2.map((r) => [r.username, r.score]), [['셋째', 500], ['쿵왕', 400]], name);
    assert.equal((await s.seasonBoard(2, 'endless', 50)).rows.length, 0, name);

    // 명예의 전당: 한 번 넣으면 그대로 (두 번 넣어도 안 바뀜)
    const top = (await s.seasonBoard(1, 'stage', 3)).rows.map((r) => ({ ...r, season: 1, board: 'stage' }));
    await s.hallInsert(top);
    await s.hallInsert(top.map((r) => ({ ...r, username: '바뀜' })));
    const hall = await s.hallList();
    assert.deepEqual(hall.map((h) => [h.season, h.board, h.rank, h.username]), [[1, 'stage', 1, '쿵왕'], [1, 'stage', 2, '짝왕'], [1, 'stage', 3, '셋째']], name);
    assert.equal(await s.hallSetImage(1, 'stage', 1, 'data:image/jpeg;base64,AAAA', 'b'), false, name); // 남의 칸
    assert.equal(await s.hallSetImage(1, 'stage', 1, 'data:image/jpeg;base64,AAAA', 'a'), true, name);
    assert.equal((await s.hallList())[0].image, 'data:image/jpeg;base64,AAAA', name);
    assert.equal(await s.hallSetImage(1, 'stage', 1, null), true, name); // 운영자 지우기
    assert.equal((await s.hallList())[0].image, null, name);

    // 계정 합치기 때 시즌 기록도 옮김
    await s.moveScores('c', 'a');
    assert.deepEqual((await s.seasonBoard(2, 'stage', 50)).rows.map((r) => [r.username, r.score]), [['쿵왕', 500]], name);
  }
});

test('🕵 핵 의심 지표: 겹친 판·고단계 만점 잡고, 평범한 기록은 안 잡음', async () => {
  const { findSuspects, suspectReport } = await import('../server/suspect.js');
  const { getLevel, maxScore } = await import('../public/js/charts.js');
  const T = Date.UTC(2026, 10, 21);
  const ps = [{ igsid: 'a', username: 'a' }, { igsid: 'b', username: 'b' }];
  const rows = [
    { igsid: 'a', level: 10, score: maxScore(getLevel(10)), at: T },
    { igsid: 'a', level: 11, score: 1000, at: T + 5000 },
    { igsid: 'a', level: 12, score: 1000, at: T + 9000 },
    { igsid: 'b', level: 4, score: 1000, at: T },
    { igsid: 'b', level: 5, score: 1000, at: T + 3600e3 },
  ];
  // c: 평범하게 연달아 침 (1시간 안에 8단계, 간격은 곡 길이 이상) → 예전엔 잡혔는데 이제 안 잡힘
  // d: 기록 옮기기로 한꺼번에 들어옴 (같은 시각) → 겹친 판 아님
  ps.push({ igsid: 'c', username: 'c' }, { igsid: 'd', username: 'd' });
  for (let i = 0; i < 8; i++) rows.push({ igsid: 'c', level: i + 1, score: 1000, at: T + i * 6 * 60e3 });
  for (let i = 0; i < 8; i++) rows.push({ igsid: 'd', level: i + 1, score: 1000, at: T });
  const r = findSuspects(ps, rows);
  assert.deepEqual(r.map((x) => x.igsid), ['a']);
  assert.ok(r[0].reasons.length >= 2);
  const rep = suspectReport(ps[0], rows);
  assert.equal(rep.items.length, 3);
  assert.equal(rep.items.filter((x) => x.overlap).length, 2);
  assert.ok(rep.items[0].near && rep.items[0].rare && rep.items[0].rank === 1);
  const rc = suspectReport(ps[2], rows);
  assert.equal(rc.risk, 0);
  assert.ok(rc.items.every((x) => !x.overlap));
  const rd = suspectReport(ps[3], rows);
  assert.equal(rd.risk, 0);
  assert.equal(rd.items.filter((x) => x.copied).length, 7);
});
