// 📣 광고 노출 통계 (2026-11-27 사용자: '광고 데이터들 나중에 광고주에게 줘야 해서, 몇 번 보고 한 명이 평균 얼마나 보는지')
//
// 폰(track.js trackAd*)이 광고를 보여 줄 때 {start·click·end} 이벤트를 이용 통계 요청(/api/runs·/api/scores·/api/track)에 얹어 보냄
//   → 서버가 방문자 쿠키(vid, 이름·아이디 없는 익명)별로 하루 한 줄(표 ad_vday: day·ad·vid)에 더함
//   → admin '📣 광고' 탭이 이 표를 묶어서 보여 줌 (노출·순 시청자·1인당 평균·끝까지 본 비율·클릭·시청 시간·날짜별)
// 통계 표본(statsRate)은 적용 안 함: 광고주에게 줄 숫자라 빠짐없이 적음 (광고는 판 수보다 훨씬 드물어 쓰기도 적음)

const ID = /^[\w-]{8,40}$/;
const AD = /^[\w-]{1,24}$/;

/** 폰이 보낸 광고 이벤트 검증 (최대 10개, 이상한 건 버림) */
export function cleanAds(list) {
  const out = [];
  for (const e of (Array.isArray(list) ? list : []).slice(0, 10)) {
    if (!e || typeof e !== 'object') continue;
    const ev = e.ev === 'start' || e.ev === 'click' || e.ev === 'end' ? e.ev : null;
    if (!ev || typeof e.id !== 'string' || !ID.test(e.id) || typeof e.ad !== 'string' || !AD.test(e.ad)) continue;
    const o = { ev, id: e.id, ad: e.ad, surface: e.surface === 'drum' || e.surface === 'tile' ? e.surface : 'other' };
    if (ev === 'end') {
      o.result = e.result === 'done' ? 'done' : 'closed';
      o.sec = Number.isFinite(e.sec) ? Math.max(0, Math.min(600, Math.round(e.sec))) : 0;
    }
    out.push(o);
  }
  return out;
}

/** 이벤트 → 광고별 숫자 한 줄 [{ad, shows, done, closed, clicks, sec, drum, tile}] */
export function foldAds(events) {
  const by = new Map();
  for (const e of events) {
    let r = by.get(e.ad);
    if (!r) by.set(e.ad, (r = { ad: e.ad, shows: 0, done: 0, closed: 0, clicks: 0, sec: 0, drum: 0, tile: 0 }));
    if (e.ev === 'start') {
      r.shows++;
      if (e.surface === 'drum') r.drum++;
      else if (e.surface === 'tile') r.tile++;
    } else if (e.ev === 'click') r.clicks++;
    else {
      if (e.result === 'done') r.done++;
      else r.closed++;
      r.sec += e.sec || 0;
    }
  }
  return [...by.values()];
}

/** 같은 이벤트가 두 번 와도(다시 보냄) 한 번만 세게 — 서버 인스턴스 메모리에 최근 것만 */
export function makeAdDedupe(max = 5000) {
  const seen = new Set();
  return (vid, events) => {
    if (seen.size > max) seen.clear();
    return events.filter((e) => {
      const k = `${vid}:${e.ev}:${e.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
}

const n = (v) => Number(v) || 0;
const round1 = (v) => Math.round(v * 10) / 10;
const ratio = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null); // % (소수 한 자리)
const BUCKETS = [
  ['1번', (c) => c === 1],
  ['2번', (c) => c === 2],
  ['3~4번', (c) => c >= 3 && c <= 4],
  ['5~9번', (c) => c >= 5 && c <= 9],
  ['10번 이상', (c) => c >= 10],
];

/** 한 광고(또는 전체)의 숫자 한 묶음 */
function summarize(sum, viewerRows) {
  const counts = viewerRows.map((v) => n(v.shows)).sort((a, b) => a - b);
  const viewers = viewerRows.length;
  const finished = sum.done + sum.closed;
  const mid = counts.length ? (counts.length % 2 ? counts[(counts.length - 1) / 2] : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2) : 0;
  return {
    shows: sum.shows,
    viewers,
    perViewer: viewers ? round1(sum.shows / viewers) : 0, // 한 명이 평균 몇 번 봤나
    median: mid,
    max: counts.length ? counts[counts.length - 1] : 0,
    done: sum.done,
    closed: sum.closed,
    drop: Math.max(0, sum.shows - finished), // 보여 줬는데 끝도 닫기도 안 남기고 사라진 것 (앱을 나감 등)
    doneRate: ratio(sum.done, sum.shows),
    clicks: sum.clicks,
    ctr: ratio(sum.clicks, sum.shows), // 클릭률 = 클릭 ÷ 노출
    avgSec: finished ? round1(sum.sec / finished) : 0, // 한 번 볼 때 평균 몇 초
    drum: sum.drum,
    tile: sum.tile,
    repeatViewers: viewerRows.filter((v) => n(v.shows) >= 2).length, // 2번 이상 본 사람
    repeatRate: ratio(viewerRows.filter((v) => n(v.shows) >= 2).length, viewers),
    multiDayViewers: viewerRows.filter((v) => n(v.days) >= 2).length, // 이틀 이상 본 사람
    clickers: viewerRows.filter((v) => n(v.clicks) >= 1).length, // 한 번이라도 누른 사람
    dist: BUCKETS.map(([label, f]) => ({ label, viewers: counts.filter(f).length })),
  };
}

const ZERO = () => ({ shows: 0, done: 0, closed: 0, clicks: 0, sec: 0, drum: 0, tile: 0 });
const addInto = (a, r) => {
  for (const k of ['shows', 'done', 'closed', 'clicks', 'sec', 'drum', 'tile']) a[k] += n(r[k]);
  return a;
};

/**
 * 저장소가 준 원본({ byDay: [{day, ad, viewers, shows, …}], byViewer: [{ad, vid, shows, done, closed, clicks, days}] })
 *   → admin 화면용 {from, to, total, ads: [{ad, …summarize, perDay}]}. vid 는 여기서 버림 (밖으로 안 나감)
 */
export function buildAdStats(raw, { from, to }) {
  const byDay = raw.byDay || [];
  const byViewer = raw.byViewer || [];
  const adIds = [...new Set([...byDay.map((r) => r.ad), ...byViewer.map((r) => r.ad)])];
  const ads = adIds.map((ad) => {
    const sum = ZERO();
    const perDay = byDay
      .filter((r) => r.ad === ad)
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .map((r) => {
        addInto(sum, r);
        const fin = n(r.done) + n(r.closed);
        return { day: r.day, viewers: n(r.viewers), shows: n(r.shows), perViewer: n(r.viewers) ? round1(n(r.shows) / n(r.viewers)) : 0, done: n(r.done), closed: n(r.closed), clicks: n(r.clicks), avgSec: fin ? round1(n(r.sec) / fin) : 0, drum: n(r.drum), tile: n(r.tile) };
      });
    return { ad, ...summarize(sum, byViewer.filter((v) => v.ad === ad)), perDay };
  });
  // 광고 전체: 같은 사람이 광고 둘을 다 봤으면 한 명으로 (vid 로 합침)
  const all = new Map();
  const totalSum = ZERO();
  for (const v of byViewer) {
    const r = all.get(v.vid) || { shows: 0, clicks: 0, days: 0 };
    r.shows += n(v.shows);
    r.clicks += n(v.clicks);
    r.days = Math.max(r.days, n(v.days));
    all.set(v.vid, r);
    addInto(totalSum, { shows: v.shows, done: v.done, closed: v.closed, clicks: v.clicks });
  }
  for (const r of byDay) addInto(totalSum, { sec: r.sec, drum: r.drum, tile: r.tile });
  return { from, to, total: summarize(totalSum, [...all.values()]), ads };
}
