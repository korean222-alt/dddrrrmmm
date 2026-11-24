// 🕵 핵 의심 지표 (관리자용, 2026-11-21 사용자 요청 · 같은 날 다시 만듦: 천 명 넘게 잡혀서)
//   서버는 이미 판 토큰·걸린 시간·판정 개수·점수 범위를 검사함. 여기선 통과한 기록 중에서도 '사람이 하기 어려운 패턴'만 봄.
//   확정이 아니라 참고용 — 운영자가 보고 판단. DB 표는 안 늘리고 scores(단계별 최고 기록 + 기록한 시각)만 읽음.
//   예전 규칙 '1시간 안에 6단계' 는 평범하게 연달아 치는 사람을 다 잡아서 뺌. 이제 목록엔 강한 신호만, 나머지는 사람별 자세히 보기로.
import { getLevel, levelDuration, barDur, COUNT_IN_BARS, maxScore, noteCount, levelLabel } from '../public/js/charts.js';

export const NEAR_PERFECT = 0.995; // 최대 점수의 99.5% 이상 = 거의 전부 PERFECT
export const HIGH_LEVEL = 10; // 이 단계부터 만점 근처를 셈
const OVERLAP_RATIO = 0.5; // 직전 기록과의 간격이 이 곡 치는 시간의 절반도 안 되면 '겹친 판' (한 폰으로는 불가능)
const COPY_GAP_MS = 2000; // 이보다 가까운 건 기록 옮기기·계정 합치기로 한꺼번에 들어간 것 → 안 셈
export const LIST_MIN_RISK = 60; // 목록엔 이 점수 이상만 = 겹친 판 2번 이상 / 가짜 입력 / 기계처럼 일정한 박자 (사람이 한 폰으로는 못 내는 것만)
// 아래 둘은 2026-11-21 부터 점수 올릴 때 같이 받는 scores.chk 로 봄 (그 전 기록·예전 앱은 없음)
export const FAKE_MIN = 5; // 프로그램이 만든 입력(isTrusted=false)이 이만큼 이상
export const BOT_SD_MS = 8; // 박자 오차 표준편차가 이 ms 이하 (사람 손가락은 보통 20~50ms) — 실제 기록 보고 조정할 것
const BOT_MIN_HITS = 100;
const LIST_MAX = 100;

/** 곡을 끝까지 치는 데 걸리는 시간(초, 카운트인 뺌) — 서버 점수 검사와 같은 기준 */
const playSec = (lv) => levelDuration(lv) - COUNT_IN_BARS * barDur(lv);

/** 단계별: 기록한 사람 수, 만점 근처인 사람 수, 점수 목록(등수용) */
function levelStats(rows) {
  const st = new Map();
  for (const r of rows) {
    const lv = getLevel(r.level);
    if (!lv || !(r.level > 0)) continue;
    let s = st.get(r.level);
    if (!s) st.set(r.level, (s = { lv, max: maxScore(lv), notes: noteCount(lv), players: 0, near: 0, scores: [], sds: [] }));
    s.players++;
    if (r.chk && r.chk.sd != null && r.chk.n >= 20) s.sds.push(r.chk.sd);
    s.scores.push(r.score);
    if (r.score >= s.max * NEAR_PERFECT) s.near++;
  }
  for (const s of st.values()) {
    s.scores.sort((a, b) => b - a);
    s.sds.sort((a, b) => a - b);
    s.sdMid = s.sds.length ? s.sds[Math.floor(s.sds.length / 2)] : null;
  }
  return st;
}

/** 이 단계 만점 근처가 드문가: 그 단계 기록한 사람의 2% 이하(최소 3명까지는 드문 걸로) */
const isRare = (s) => s.near <= Math.max(3, Math.floor(s.players * 0.02));

/** 한 사람 기록 분석 → { risk, reasons, items } (items = 기록한 시각 순 단계별 자세히) */
function analyze(list, st) {
  const items = list
    .map((r) => {
      const s = st.get(r.level);
      if (!s) return null;
      const pct = s.max ? r.score / s.max : 0;
      return {
        level: r.level, label: levelLabel(s.lv), score: r.score, max: s.max, pct: Math.round(pct * 1000) / 10,
        grade: r.grade || null, maxCombo: r.maxCombo || 0, notes: s.notes, at: r.at || 0,
        playSec: Math.round(playSec(s.lv)),
        near: r.level >= HIGH_LEVEL && pct >= NEAR_PERFECT, nearCount: s.near, players: s.players,
        rank: s.scores.findIndex((x) => x <= r.score) + 1,
        rare: false, gapSec: null, overlap: false, copied: false,
        // chk: 실제로 친 시간(초)·박자 오차(ms)·가짜 입력 — 11-21 이후 최고 기록만 있음
        realSec: r.chk && r.chk.ms != null ? Math.round(r.chk.ms / 1000) : null,
        sd: r.chk && r.chk.sd != null ? r.chk.sd : null, mean: r.chk && r.chk.mean != null ? r.chk.mean : null,
        hits: r.chk && r.chk.n != null ? r.chk.n : null, fake: (r.chk && r.chk.fake) || 0, sdMid: s.sdMid,
        bot: !!(r.chk && r.chk.sd != null && r.chk.n >= BOT_MIN_HITS && r.chk.sd <= BOT_SD_MS),
        off: !!(r.chk && r.chk.off), // 📴 서버 없을 때 친 판 (판 토큰 없이 나중에 올림, 11-22)
        // 📶 폰 버벅임 (11-23): 터치가 가장 늦게 처리된 시간(ms)·늦게 온 터치로 되살린 MISS 수
        lag: (r.chk && r.chk.lag) || 0, rv: (r.chk && r.chk.rv) || 0, ps: (r.chk && r.chk.ps) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.at || Infinity) - (b.at || Infinity) || a.level - b.level);
  let risk = 0;
  const reasons = [];
  // 1) 겹친 판: 직전 기록과의 간격 < 이 곡 치는 시간 × 0.5  (판 토큰은 곡 시간이 지나야 받아 주므로, 한 폰으로 하나씩 치면 못 나옴)
  let prev = null;
  let overlaps = 0;
  const olv = [];
  for (const it of items) {
    if (!it.at) continue;
    if (prev) {
      const gap = it.at - prev.at;
      it.gapSec = Math.round(gap / 100) / 10;
      if (gap < COPY_GAP_MS) it.copied = true;
      else if (gap < it.playSec * 1000 * OVERLAP_RATIO) {
        it.overlap = true;
        overlaps++;
        olv.push(it.level);
      }
    }
    prev = it;
  }
  if (overlaps) {
    risk += Math.min(overlaps, 4) * 30;
    reasons.push(`⏱ 겹친 판 ${overlaps}번 — 곡 치는 시간의 절반도 안 돼서 다음 단계 기록이 찍힘 (${olv.join('·')}단계). 여러 창·기기로 동시에 돌렸거나 자동 프로그램일 수 있음`);
  }
  // 참고(점수 없음): 서버 없을 때 친 판은 판 토큰이 없어 실제로 친 시간을 확인 못 함
  const off = items.filter((it) => it.off);
  if (off.length) reasons.push(`📴 서버 없을 때 친 기록 ${off.length}개 (${off.map((it) => it.level).join('·')}단계) — 판 확인 코드 없이 나중에 올라옴`);
  // 3) 가짜 입력: 화면을 손가락이 아니라 프로그램이 눌렀음 (브라우저가 표시해 줌)
  const fake = items.filter((it) => it.fake >= FAKE_MIN);
  if (fake.length) {
    risk += 60 + (fake.length - 1) * 20;
    reasons.push(`🤖 가짜 입력 — 프로그램이 누른 입력이 기록에 섞임 (${fake.map((it) => `${it.level}단계 ${it.fake}번`).join(', ')})`);
  }
  // 4) 기계처럼 일정한 박자: 박자 오차 퍼짐이 사람 손가락으론 안 나올 만큼 작음
  const bot = items.filter((it) => it.bot);
  if (bot.length) {
    risk += 60 + (bot.length - 1) * 20;
    reasons.push(`🎯 박자가 기계처럼 일정 — 오차 퍼짐 ${BOT_SD_MS}ms 이하 (${bot.map((it) => `${it.level}단계 ${it.sd}ms`).join(', ')}). 자동 입력 프로그램일 수 있음`);
  }
  // 2) 높은 단계 만점 근처 — 잘하는 사람도 나와서 의심 점수엔 안 넣음 (11-21 사용자: '잘하는 사람은 다 뜸'). 자세히 보기에서 참고로만
  const near = items.filter((it) => it.near);
  for (const it of near) {
    const s = st.get(it.level);
    it.rare = isRare(s);
  }
  if (near.length) {
    const rare = near.filter((it) => it.rare).length;
    reasons.push(`💯 ${HIGH_LEVEL}단계 이상 만점 근처(99.5%↑) ${near.length}개 (${near.map((it) => it.level).join('·')}단계)` + (rare ? ` · 그중 ${rare}개는 전체에서 몇 명 안 되는 기록` : ''));
  }
  return { risk, reasons, items };
}

const byPlayer = (rows) => {
  const m = new Map();
  for (const r of rows) {
    if (!(r.level > 0)) continue;
    (m.get(r.igsid) || m.set(r.igsid, []).get(r.igsid)).push(r);
  }
  return m;
};

/**
 * players: listPlayers() 결과, rows: allScores() 결과 [{ igsid, level, score, grade, maxCombo, at }]
 * → 강한 신호만 의심 순으로 [{ igsid, username, ig, risk, reasons }] (최대 100명)
 */
export function findSuspects(players, rows, { minRisk = LIST_MIN_RISK, limit = LIST_MAX } = {}) {
  const st = levelStats(rows);
  const mine = byPlayer(rows);
  const out = [];
  for (const p of players) {
    const list = mine.get(p.igsid);
    if (!list) continue;
    const a = analyze(list, st);
    if (a.risk >= minRisk) out.push({ igsid: p.igsid, username: p.username, ig: p.ig || null, risk: a.risk, reasons: a.reasons });
  }
  return out.sort((a, b) => b.risk - a.risk).slice(0, limit);
}

/** 한 사람 자세히 (의심받는 사람이 생겼을 때 운영자가 확인용) */
export function suspectReport(player, rows, tries = []) {
  const st = levelStats(rows);
  const a = analyze(byPlayer(rows).get(player.igsid) || [], st);
  // 단계마다 몇 판 했나 (11-22 부터 셈): 기록 없는 단계도 판 수가 있으면 줄을 만듦
  const tm = new Map(tries.map((t) => [t.level, t]));
  for (const it of a.items) {
    const t = tm.get(it.level);
    it.starts = t ? t.starts : null;
    it.clears = t ? t.clears : null;
    tm.delete(it.level);
  }
  for (const t of tm.values()) {
    const lv = getLevel(t.level);
    if (lv) a.items.push({ level: t.level, label: levelLabel(lv), noRecord: true, starts: t.starts, clears: t.clears, at: 0, playSec: Math.round(playSec(lv)) });
  }
  return { igsid: player.igsid, username: player.username, ig: player.ig || null, risk: a.risk, listed: a.risk >= LIST_MIN_RISK, reasons: a.reasons, items: a.items };
}
