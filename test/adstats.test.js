// 📣 광고 노출 통계 (2026-11-27): 폰이 보낸 start·click·end → 방문자별 하루 한 줄 → admin 집계
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { D1Store, d1Local } from '../server/d1store.js';
import { PgStore } from '../server/pgstore.js';
import { JsonStore } from '../server/store.js';
import { createHandler, cleanTrack } from '../server/handler.js';
import { loadConfig } from '../server/config.js';
import { cleanAds, foldAds, makeAdDedupe, buildAdStats } from '../server/adstats.js';

const ev = (ev, id, extra = {}) => ({ ev, id, ad: 'house', surface: 'drum', ...extra });

test('cleanAds: 이상한 이벤트는 버리고 10개까지만', () => {
  const ok = cleanAds([ev('start', 'abcdefgh1'), ev('click', 'abcdefgh1'), ev('end', 'abcdefgh1', { result: 'done', sec: 5.4 })]);
  assert.equal(ok.length, 3);
  assert.deepEqual(ok[2], { ev: 'end', id: 'abcdefgh1', ad: 'house', surface: 'drum', result: 'done', sec: 5 });
  assert.equal(cleanAds([{ ev: 'start', id: 'short', ad: 'house' }, { ev: 'zzz', id: 'abcdefgh1', ad: 'house' }, { ev: 'start', id: 'abcdefgh1', ad: 'bad ad!' }, null, 'x']).length, 0);
  assert.equal(cleanAds(Array.from({ length: 30 }, (_, i) => ev('start', 'abcdefgh' + i))).length, 10);
  assert.equal(cleanAds('nope').length, 0);
  // 어디서 떴나는 drum·tile 외엔 other, end 결과는 done 아니면 closed, 초는 600 상한
  const e = cleanAds([ev('end', 'abcdefgh1', { surface: 'x', result: 'weird', sec: 99999 })])[0];
  assert.deepEqual([e.surface, e.result, e.sec], ['other', 'closed', 600]);
  // cleanTrack 이 ads 를 같이 걸러 줌
  assert.equal(cleanTrack({ sid: 'sess-aaaaaaaa', ads: [ev('start', 'abcdefgh1')] }).ads.length, 1);
  assert.deepEqual(cleanTrack({ sid: 'sess-aaaaaaaa' }).ads, []);
});

test('foldAds · makeAdDedupe', () => {
  const rows = foldAds([ev('start', 'a1111111'), ev('start', 'b1111111', { surface: 'tile' }), ev('click', 'a1111111'), ev('end', 'a1111111', { result: 'done', sec: 5 }), ev('end', 'b1111111', { result: 'closed', sec: 2 }), { ...ev('start', 'c1111111'), ad: 'adsense' }]);
  assert.deepEqual(rows.find((r) => r.ad === 'house'), { ad: 'house', shows: 2, done: 1, closed: 1, clicks: 1, sec: 7, drum: 1, tile: 1 });
  assert.equal(rows.find((r) => r.ad === 'adsense').shows, 1);
  const dd = makeAdDedupe();
  assert.equal(dd('v1', [ev('start', 'a1111111')]).length, 1);
  assert.equal(dd('v1', [ev('start', 'a1111111'), ev('click', 'a1111111')]).length, 1); // 같은 start 는 한 번만
  assert.equal(dd('v2', [ev('start', 'a1111111')]).length, 1); // 다른 방문자는 따로
});

// 세 저장소가 같은 결과를 줘야 함
let db;
async function allStores() {
  db = new PGlite();
  const pg = await new PgStore(async (text, params) => (await db.query(text, params)).rows).init();
  const d1 = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  const json = new JsonStore('/dev/null');
  json._save = () => {};
  return { pg, d1, json };
}

test('저장소 셋(JSON·Postgres·D1)이 같은 광고 통계를 줌 · 같은 날 다시 보내면 더함 · 하루 상한', async () => {
  const out = {};
  for (const [name, s] of Object.entries(await allStores())) {
    // 방문자 v1: 5/1 에 3번 (끝까지 2·닫음 1·클릭 1) 다음 날 1번 / v2: 5/1 에 1번 (드럼 아님)
    await s.trackAds({ vid: 'v1', day: '2026-05-01', rows: [{ ad: 'house', shows: 2, done: 1, closed: 1, clicks: 1, sec: 9, drum: 2, tile: 0 }] });
    await s.trackAds({ vid: 'v1', day: '2026-05-01', rows: [{ ad: 'house', shows: 1, done: 1, closed: 0, clicks: 0, sec: 5, drum: 0, tile: 1 }] });
    await s.trackAds({ vid: 'v1', day: '2026-05-02', rows: [{ ad: 'house', shows: 1, done: 1, closed: 0, clicks: 0, sec: 5, drum: 1, tile: 0 }] });
    await s.trackAds({ vid: 'v2', day: '2026-05-01', rows: [{ ad: 'house', shows: 1, done: 0, closed: 1, clicks: 0, sec: 1, drum: 0, tile: 0 }, { ad: 'adsense', shows: 1, done: 1, closed: 0, clicks: 0, sec: 20, drum: 1, tile: 0 }] });
    // 상한: 한 사람이 하루에 아무리 보내도 300번까지만
    await s.trackAds({ vid: 'spam', day: '2026-05-03', rows: [{ ad: 'house', shows: 250, done: 0, closed: 0, clicks: 0, sec: 0, drum: 0, tile: 0 }] });
    await s.trackAds({ vid: 'spam', day: '2026-05-03', rows: [{ ad: 'house', shows: 250, done: 0, closed: 0, clicks: 0, sec: 0, drum: 0, tile: 0 }] });
    const raw = await s.adStats('2026-05-01', '2026-05-03');
    const sortBy = (k) => (a, b) => (a[k] + a.ad < b[k] + b.ad ? -1 : 1);
    raw.byDay.sort(sortBy('day'));
    raw.byViewer.sort(sortBy('vid'));
    out[name] = raw;
    // 기간 밖은 안 셈
    const one = await s.adStats('2026-05-02', '2026-05-02');
    assert.equal(one.byDay.length, 1, name);
    assert.equal(one.byViewer[0].shows, 1, name);
  }
  assert.deepEqual(out.pg, out.d1);
  assert.deepEqual(out.json, out.d1);
  const raw = out.d1;
  const spam = raw.byViewer.find((v) => v.vid === 'spam');
  assert.equal(spam.shows, 300);
  assert.equal(raw.byViewer.find((v) => v.vid === 'v1' && v.ad === 'house').shows, 4);
  assert.equal(raw.byViewer.find((v) => v.vid === 'v1' && v.ad === 'house').days, 2);

  // 집계: 한 명이 평균 몇 번 · 끝까지 비율 · 클릭률 · 분포
  const st = buildAdStats({ byDay: raw.byDay.filter((r) => r.day < '2026-05-03'), byViewer: raw.byViewer.filter((v) => v.vid !== 'spam') }, { from: '2026-05-01', to: '2026-05-02' });
  const house = st.ads.find((a) => a.ad === 'house');
  assert.equal(house.shows, 5); // v1 4 + v2 1
  assert.equal(house.viewers, 2);
  assert.equal(house.perViewer, 2.5);
  assert.equal(house.done, 3);
  assert.equal(house.closed, 2);
  assert.equal(house.doneRate, 60);
  assert.equal(house.clicks, 1);
  assert.equal(house.ctr, 20);
  assert.equal(house.avgSec, 4); // (9+5+5+1) / 5
  assert.equal(house.drop, 0);
  assert.equal(house.repeatViewers, 1);
  assert.equal(house.multiDayViewers, 1);
  assert.deepEqual([house.drum, house.tile], [3, 1]);
  assert.deepEqual(house.dist.map((d) => d.viewers), [1, 0, 1, 0, 0]); // 1번 1명(v2), 3~4번 1명(v1)
  assert.deepEqual(house.perDay.map((d) => [d.day, d.viewers, d.shows]), [['2026-05-01', 2, 4], ['2026-05-02', 1, 1]]);
  assert.equal(st.total.viewers, 2); // v2 가 두 광고를 다 봐도 한 명
  assert.equal(st.total.shows, 6);
  assert.ok(!JSON.stringify(st).includes('"vid"'), 'vid 는 밖으로 안 나감');
  // 기록이 없어도 안 터짐
  assert.deepEqual(buildAdStats({ byDay: [], byViewer: [] }, { from: 'a', to: 'b' }).ads, []);
});

test('HTTP: /api/track 에 얹은 광고 이벤트가 쌓이고 admin /api/admin/ads 로 보임 (같은 이벤트 두 번은 한 번)', async () => {
  const store = await new D1Store(d1Local(new DatabaseSync(':memory:'))).init();
  const handle = createHandler(loadConfig({ SESSION_SECRET: 's', GATE_MODE: 'soft', DATA_FILE: '/dev/null', FREE_PASS_UNTIL: '0', ADMIN_TOKEN: 'pw' }), { store });
  let cookie = '';
  const call = async (path, body, headers = {}) => {
    const res = await handle(new Request('http://x' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: body ? JSON.stringify(body) : undefined }));
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of sc) cookie = (cookie ? cookie + '; ' : '') + c.split(';')[0];
    return res;
  };
  const sid = 'sess-adtest-0001';
  const send = (ads) => call('/api/track', { sid, active: 5, ads });
  assert.equal((await send([ev('start', 'adview-0001'), ev('click', 'adview-0001'), ev('end', 'adview-0001', { result: 'done', sec: 5 })])).status, 200);
  assert.equal((await send([ev('start', 'adview-0001')])).status, 200); // 다시 보낸 것
  assert.equal((await send([ev('start', 'adview-0002', { surface: 'tile' }), ev('end', 'adview-0002', { surface: 'tile', result: 'closed', sec: 2 })])).status, 200);
  assert.equal((await call('/api/admin/ads?days=1')).status, 401);
  const r = await (await call('/api/admin/ads?days=1&fresh=1', null, { 'x-admin-token': 'pw' })).json();
  assert.equal(r.ads.length, 1);
  const a = r.ads[0];
  assert.deepEqual([a.ad, a.shows, a.viewers, a.done, a.closed, a.clicks, a.drum, a.tile], ['house', 2, 1, 1, 1, 1, 1, 1]);
  assert.equal(a.perViewer, 2);
  assert.equal(r.total.viewers, 1);
});
