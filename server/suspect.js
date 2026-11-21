// 🕵 핵 의심 지표 (관리자용, 2026-11-21 사용자 요청)
//   서버는 이미 판 토큰·시간·판정 개수·점수 범위를 검사함. 여기선 통과한 기록 중에서도 '사람이 하기 어려운 패턴'을 점수로 모아 보여 줌.
//   확정이 아니라 참고용 — 운영자가 보고 판단. DB 표는 안 늘리고 scores(단계별 최고 기록 + 기록한 시각)만 읽음.
import { LAST_LEVEL_ID, getLevel, levelDuration, barDur, COUNT_IN_BARS, maxScore } from '../public/js/charts.js';

const MIN_RUN_RATIO = 0.9;
const MAX_REASONS = 6;

/**
 * players: listPlayers() 결과, rows: allScores() 결과 [{ igsid, level, score, grade, at }]
 * → 의심 순으로 [{ igsid, username, ig, risk, reasons: [...] }] (risk 0 은 뺌)
 */
export function findSuspects(players, rows, { minRisk = 1 } = {}) {
  const byId = new Map();
  for (const r of rows) {
    if (!(r.level >= 1 && r.level <= LAST_LEVEL_ID)) continue;
    const lv = getLevel(r.level);
    if (!lv) continue;
    (byId.get(r.igsid) || byId.set(r.igsid, []).get(r.igsid)).push({ ...r, lv });
  }
  const out = [];
  for (const p of players) {
    const list = byId.get(p.igsid);
    if (!list || !list.length) continue;
    let risk = 0;
    const reasons = [];
    // 1) 판이 겹침: 한 곡을 끝내는 데 최소 (곡 길이 × 0.9) 초 걸리는데, 다른 단계 기록이 그보다 가까운 시각에 찍힘
    const timed = list.filter((r) => r.at > 0).sort((a, b) => a.at - b.at);
    let overlaps = 0;
    for (let i = 1; i < timed.length; i++) {
      const b = timed[i];
      const need = (levelDuration(b.lv) - COUNT_IN_BARS * barDur(b.lv)) * MIN_RUN_RATIO * 1000;
      if (b.at - timed[i - 1].at < need * 0.8) overlaps++;
    }
    if (overlaps) {
      risk += Math.min(overlaps, 4) * 25;
      reasons.push(`⏱ 곡 길이보다 짧은 간격으로 기록된 단계 ${overlaps}번 (동시에 여러 판을 돌렸을 수 있음)`);
    }
    // 2) 만점 근처: 높은 단계에서 최대 점수의 99.5% 이상
    const perfect = list.filter((r) => r.lv.id >= 8 && r.score >= maxScore(r.lv) * 0.995).map((r) => r.lv.id).sort((a, b) => a - b);
    if (perfect.length) {
      risk += Math.min(perfect.length, 5) * 15 + (perfect.some((id) => id >= 15) ? 20 : 0);
      reasons.push(`💯 8단계 이상 만점 근처 ${perfect.length}개 (${perfect.join('·')}단계)`);
    }
    // 3) 짧은 시간에 단계를 쓸어 담음: 처음~마지막 기록이 1시간 안인데 6단계 이상
    if (timed.length >= 6) {
      const span = timed[timed.length - 1].at - timed[0].at;
      if (span < 3600e3) {
        risk += 30;
        reasons.push(`⚡ ${timed.length}단계 기록이 ${Math.max(1, Math.round(span / 60000))}분 안에 몰림`);
      }
    }
    if (risk >= minRisk) out.push({ igsid: p.igsid, username: p.username, ig: p.ig || null, risk, reasons: reasons.slice(0, MAX_REASONS) });
  }
  return out.sort((a, b) => b.risk - a.risk);
}
