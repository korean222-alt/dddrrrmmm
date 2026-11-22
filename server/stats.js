// 이용 통계 집계 (관리자 페이지용). 저장소(JsonStore/PgStore)가 원본 행을 주면 여기서 한 번에 계산 →
// 두 저장소가 같은 숫자를 내도록 계산은 이 파일 하나에만 둡니다.
//
// 원본 행:
//   sessions: { sid, vid, startedAt, lastAt, activeSec, ref, device }   ← 접속 1회 (30분 안 끊기면 한 세션)
//   plays:    { id, sid, vid, level, mode, startedAt, endedAt, result, score, stars, sec }  ← 곡 한 판
//   newVids:  기간 안에 처음 온 방문자 id 목록 (그 전에는 한 번도 안 옴)
// vid = 브라우저(기기)마다 붙는 익명 번호. 이름·아이디·IP 와 연결되지 않아요.
// w = 표본 무게 (2026-11-22): 사람이 많아지면 방문자 일부만 적고(D1 쓰기 아끼기) 그 줄을 w 배로 셈. 없으면 1

import { levelEndlessBase, getLevel } from '../public/js/charts.js';

const DAY = 24 * 3600 * 1000;

const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const round1 = (n) => Math.round(n * 10) / 10;

function levelName(id) {
  const base = levelEndlessBase(id);
  if (base) return `${base.name} 무제한`;
  const lv = getLevel(/^\d+$/.test(id) ? Number(id) : id);
  if (!lv) return '';
  return lv.challenge ? (lv.endless ? '무제한 모드' : '레벨업 챌린지') : lv.name;
}

/**
 * @param {{sessions: object[], plays: object[], newVids: string[]}} raw
 * @param {{from: number, to: number, tzMin?: number}} opt  tzMin: 날짜 나눌 시간대 (기본 한국 +540분)
 */
export function buildStats(raw, { from, to, tzMin = 540 }) {
  const { sessions, plays } = raw;
  const newVids = new Set(raw.newVids || []);
  const shift = tzMin * 60000;
  const dayKey = (t) => new Date(t + shift).toISOString().slice(0, 10);
  const hourOf = (t) => new Date(t + shift).getUTCHours();

  // 날짜별 칸 (빈 날도 0 으로)
  const perDay = new Map();
  for (let t = from; t < to + DAY; t += DAY) {
    const k = dayKey(Math.min(t, to));
    if (!perDay.has(k)) perDay.set(k, { date: k, visitors: new Map(), sessions: 0, plays: 0, activeSec: 0 });
  }
  const day = (t) => perDay.get(dayKey(t)) || null;

  const wOf = (x) => (Number.isFinite(x.w) && x.w > 0 ? x.w : 1);
  const sumW = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const visitors = new Map(); // vid → 무게
  let nSessions = 0;
  for (const s of sessions) {
    const w = wOf(s);
    visitors.set(s.vid, Math.max(visitors.get(s.vid) || 0, w));
    nSessions += w;
    const d = day(s.startedAt);
    if (d) {
      d.visitors.set(s.vid, Math.max(d.visitors.get(s.vid) || 0, w));
      d.sessions += w;
      d.activeSec += (s.activeSec || 0) * w;
    }
  }

  // 판 정리: 결과 없는 판(중간에 나감/탭 닫음)은 quit
  const hours = new Array(24).fill(0);
  const byLevel = new Map();
  const perVisitor = new Map();
  const res = { clear: 0, fail: 0, quit: 0 };
  const secs = [];
  let nPlays = 0;
  for (const p of plays) {
    const w = wOf(p);
    nPlays += w;
    const r = p.result === 'clear' || p.result === 'fail' ? p.result : 'quit';
    res[r] += w;
    hours[hourOf(p.startedAt)] += w;
    const d = day(p.startedAt);
    if (d) d.plays += w;
    perVisitor.set(p.vid, (perVisitor.get(p.vid) || 0) + 1);
    if (p.sec > 0) secs.push(p.sec);
    const k = String(p.level);
    const l = byLevel.get(k) || { level: k, name: levelName(k), plays: 0, clear: 0, fail: 0, quit: 0, scores: [], secs: [], stars: [] };
    l.plays += w;
    l[r] += w;
    if (r === 'clear' && Number.isFinite(p.score)) l.scores.push(p.score);
    if (p.sec > 0) l.secs.push(p.sec);
    if (r === 'clear' && Number.isFinite(p.stars)) l.stars.push(p.stars);
    byLevel.set(k, l);
  }

  const levelOrder = (a, b) => {
    const na = /^\d+$/.test(a.level), nb = /^\d+$/.test(b.level);
    if (na && nb) return Number(a.level) - Number(b.level);
    if (na !== nb) return na ? -1 : 1;
    return a.level.localeCompare(b.level);
  };

  const count = (key) => {
    const m = new Map();
    for (const s of sessions) m.set(s[key] || '', (m.get(s[key] || '') || 0) + wOf(s));
    return [...m].map(([name, n]) => ({ name: name || '(직접·알 수 없음)', sessions: n })).sort((a, b) => b.sessions - a.sessions);
  };

  // 방문자당 몇 판 했나 (판 0번 = 들어와서 구경만 한 사람)
  const dist = { 0: 0, '1': 0, '2-3': 0, '4-9': 0, '10+': 0 };
  for (const [v, w] of visitors) {
    const n = perVisitor.get(v) || 0;
    dist[n === 0 ? '0' : n === 1 ? '1' : n <= 3 ? '2-3' : n <= 9 ? '4-9' : '10+'] += w;
  }

  const actives = sessions.map((s) => s.activeSec || 0).filter((n) => n > 0);
  const nVisitors = sumW(visitors);
  const nNew = [...visitors].filter(([v]) => newVids.has(v)).reduce((a, [, w]) => a + w, 0);
  const sampled = sessions.some((s) => wOf(s) > 1) || plays.some((p) => wOf(p) > 1);
  const done = res.clear + res.fail;

  return {
    range: { from, to, tzMin },
    totals: {
      visitors: nVisitors,
      newVisitors: nNew,
      returningVisitors: nVisitors - nNew,
      sessions: nSessions,
      plays: nPlays,
      clears: res.clear,
      fails: res.fail,
      quits: res.quit,
      clearRate: done + res.quit ? round1((res.clear / (done + res.quit)) * 100) : 0,
      avgPlaysPerVisitor: nVisitors ? round1(nPlays / nVisitors) : 0,
      avgSessionSec: Math.round(avg(actives)),
      medianSessionSec: Math.round(median(actives)),
      totalActiveSec: Math.round(sessions.reduce((a, s) => a + (s.activeSec || 0) * wOf(s), 0)),
      avgPlaySec: Math.round(avg(secs)),
    },
    sampled,
    perDay: [...perDay.values()].map((d) => ({ date: d.date, visitors: sumW(d.visitors), sessions: d.sessions, plays: d.plays, activeSec: Math.round(d.activeSec) })),
    byLevel: [...byLevel.values()]
      .map(({ scores, secs: ls, stars, ...l }) => ({
        ...l,
        avgScore: Math.round(avg(scores)),
        avgStars: round1(avg(stars)),
        avgSec: Math.round(avg(ls)),
      }))
      .sort(levelOrder),
    byHour: hours,
    playsPerVisitor: dist,
    refs: count('ref').slice(0, 15),
    devices: count('device'),
  };
}
