// 저장소: JSON 파일 하나 (codes, players). 트래픽이 커지면 같은 메서드로
// Postgres/Supabase 구현을 만들어 갈아끼우면 됩니다.
//
// codes:   { [code]: { code, purpose, sessionId, status, createdAt, expiresAt, igsid?, username?, verifiedAt? } }
//          status: pending | not_following | verified | expired
// sessions: { [sid]: { sid, vid, startedAt, lastAt, activeSec, ref, device } }   ← 이용 통계 (접속 1회)
// plays:    { [id]: { id, sid, vid, level, mode, startedAt, endedAt, result, score, stars, sec } }  ← 곡 한 판
// players: { [igsid]: { igsid, username, ig(인스타 아이디), createdAt, checkedAt(운영자가 팔로우 확인한 시각), bests: { [level]: { score, grade, maxCombo, at } } } }
//          level 0 = 무제한 모드 (점수 = 깬 단계 × 1,000,000 + 점수, 서버가 풀어서 보여줌)

import fs from 'node:fs';
import path from 'node:path';

// 이용 통계는 1년 보관
export const STATS_KEEP_MS = 400 * 24 * 3600 * 1000;

/** 관리자 목록 정렬: 아직 확인 안 한 사람 먼저, 그 안에선 최근 가입 순 */
export const sortPlayers = (rows) => rows.sort((a, b) => !!a.checkedAt - !!b.checkedAt || (b.createdAt || 0) - (a.createdAt || 0));

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { players: {}, usedRuns: {}, sessions: {}, plays: {} };
    this._timer = null;
  }

  init() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = { players: d.players || {}, usedRuns: d.usedRuns || {}, sessions: d.sessions || {}, plays: d.plays || {} };
      // 인스타 아이디 등록 기능을 없앴으므로, 예전에 인증된 인스타 계정 기록과 인증 코드는 지움
      for (const [k, p] of Object.entries(this.data.players)) if (p.followVerifiedAt) delete this.data.players[k];
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[store] 읽기 실패, 새로 시작:', e.message);
    }
    return this;
  }

  _save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 200);
  }

  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[store] 저장 실패:', e.message);
    }
  }

  // ----- players -----
  getPlayer(igsid) {
    return this.data.players[igsid] || null;
  }
  upsertPlayer(igsid, patch) {
    const p = this.data.players[igsid] || { igsid, username: null, ig: null, createdAt: Date.now(), checkedAt: null, bests: {} };
    const { ig, ...rest } = patch;
    Object.assign(p, rest);
    // 인스타 아이디가 바뀌면 운영자가 팔로우를 다시 확인해야 함
    if (ig && ig !== p.ig) {
      p.ig = ig;
      p.checkedAt = null;
    }
    this.data.players[igsid] = p;
    this._save();
    return p;
  }
  /** 관리자용 참여자 목록 (확인 안 한 사람 먼저, 최근 가입 순) */
  listPlayers() {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      if (!p.username) continue;
      const bs = Object.entries(p.bests || {}).filter(([lv]) => Number(lv) > 0);
      rows.push({
        igsid: p.igsid, username: p.username, ig: p.ig || null, createdAt: p.createdAt || null, checkedAt: p.checkedAt || null,
        total: bs.reduce((a, [, b]) => a + b.score, 0), levels: bs.length, endless: p.bests && p.bests[0] ? p.bests[0].score : null,
      });
    }
    return sortPlayers(rows);
  }
  deletePlayer(igsid) {
    const had = !!this.data.players[igsid];
    delete this.data.players[igsid];
    if (had) this._save();
    return had;
  }
  setChecked(igsid, on) {
    const p = this.data.players[igsid];
    if (!p) return false;
    p.checkedAt = on ? Date.now() : null;
    this._save();
    return true;
  }
  recordScore(igsid, level, entry) {
    const p = this.data.players[igsid];
    if (!p) return null;
    const prev = p.bests[level];
    const improved = !prev || entry.score > prev.score;
    if (improved) {
      p.bests[level] = { ...entry, at: Date.now() };
      this._save();
    }
    return { improved, best: improved ? entry.score : prev.score };
  }
  leaderboard(level, limit = 50) {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      const b = p.bests[level];
      if (b && p.username) rows.push({ igsid: p.igsid, username: p.username, score: b.score, grade: b.grade, at: b.at });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
  }

  /** 총 등수: 단계별 최고점의 합. 같으면 먼저 달성한 사람이 위 */
  totalLeaderboard(limit = 50) {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      const bs = Object.entries(p.bests || {}).filter(([lv]) => Number(lv) > 0).map(([, b]) => b); // 0 이하 = 무제한 (따로 랭킹)
      if (!bs.length || !p.username) continue;
      rows.push({
        igsid: p.igsid, username: p.username, score: bs.reduce((a, b) => a + b.score, 0),
        levels: bs.length, at: Math.max(...bs.map((b) => b.at || 0)),
      });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
  }
  totalRankOf(igsid) {
    const r = this.totalLeaderboard(0).all.find((x) => x.igsid === igsid);
    return r ? { rank: r.rank, score: r.score, levels: r.levels } : null;
  }

  /** 이 플레이어의 순위 { rank, score } (기록 없으면 null) */
  rankOf(level, igsid) {
    const r = this.leaderboard(level, 0).all.find((x) => x.igsid === igsid);
    return r ? { rank: r.rank, score: r.score } : null;
  }

  /** 게스트 기록을 인증된 플레이어로 옮김 (단계별 더 높은 점수만 남김) */
  moveScores(from, to) {
    const a = this.data.players[from];
    const b = this.data.players[to];
    if (!a || !b || from === to) return;
    for (const [lv, e] of Object.entries(a.bests || {})) if (!b.bests[lv] || e.score > b.bests[lv].score) b.bests[lv] = e;
    a.bests = {};
    this._save();
  }

  // ----- 판 토큰 1회용 처리 -----
  useRun(nonce, expiresAt) {
    if (this.data.usedRuns[nonce]) return false;
    this.data.usedRuns[nonce] = expiresAt;
    this._save();
    return true;
  }

  // ----- 이용 통계 (익명) -----
  /** 접속 1회: 처음이면 만들고, 이후엔 마지막 시각·활동 시간(초)만 갱신 */
  trackSession({ sid, vid, now, activeSec, ref, device }) {
    const r = this.data.sessions[sid];
    if (!r) this.data.sessions[sid] = { sid, vid, startedAt: now, lastAt: now, activeSec, ref, device };
    else {
      r.lastAt = now;
      r.activeSec = Math.max(r.activeSec || 0, activeSec);
    }
    this._save();
  }
  /** 곡 한 판: 시작(startedAt) 또는 끝(endedAt, result, score…)을 같은 id 로 이어서 채움 */
  trackPlay(p) {
    const r = this.data.plays[p.id];
    if (!r) this.data.plays[p.id] = { result: null, endedAt: null, score: null, stars: null, sec: null, ...p };
    else for (const k of ['endedAt', 'result', 'score', 'stars', 'sec']) if (p[k] != null) r[k] = p[k];
    this._save();
  }
  /** [from, to) 에 시작한 접속·판 원본 + 이 기간에 처음 온 방문자 */
  statsRaw(from, to) {
    const inRange = (r) => r.startedAt >= from && r.startedAt < to;
    const sessions = Object.values(this.data.sessions);
    const first = new Map();
    for (const s of sessions) if (!first.has(s.vid) || s.startedAt < first.get(s.vid)) first.set(s.vid, s.startedAt);
    return {
      sessions: sessions.filter(inRange),
      plays: Object.values(this.data.plays).filter(inRange),
      newVids: [...first].filter(([, t]) => t >= from && t < to).map(([v]) => v),
    };
  }
}
