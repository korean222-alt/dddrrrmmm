// 저장소: JSON 파일 하나 (codes, players). 트래픽이 커지면 같은 메서드로
// Postgres/Supabase 구현을 만들어 갈아끼우면 됩니다.
//
// codes:   { [code]: { code, purpose, sessionId, status, createdAt, expiresAt, igsid?, username?, verifiedAt? } }
//          status: pending | not_following | verified | expired
// sessions: { [sid]: { sid, vid, startedAt, lastAt, activeSec, ref, device } }   ← 이용 통계 (접속 1회)
// plays:    { [id]: { id, sid, vid, level, mode, startedAt, endedAt, result, score, stars, sec } }  ← 곡 한 판
// players: { [igsid]: { igsid, username, followVerifiedAt, bests: { [level]: { score, grade, maxCombo, at } } } }

import fs from 'node:fs';
import path from 'node:path';

// 이용 통계는 1년 보관
export const STATS_KEEP_MS = 400 * 24 * 3600 * 1000;

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { codes: {}, players: {}, usedRuns: {}, sessions: {}, plays: {} };
    this._timer = null;
  }

  init() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = { codes: d.codes || {}, players: d.players || {}, usedRuns: d.usedRuns || {}, sessions: d.sessions || {}, plays: d.plays || {} };
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

  // ----- codes -----
  createCode(rec) {
    this.data.codes[rec.code] = rec;
    this._save();
    return rec;
  }
  getCode(code) {
    return this.data.codes[code] || null;
  }
  updateCode(code, patch) {
    const rec = this.data.codes[code];
    if (!rec) return null;
    Object.assign(rec, patch);
    this._save();
    return rec;
  }
  /** 승인 기다리는 코드 (관리자 페이지용) */
  listPendingCodes(now = Date.now(), limit = 100) {
    return Object.values(this.data.codes)
      .filter((r) => (r.status === 'pending' || r.status === 'not_following') && r.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
  /** 오래된 코드/사용한 판 토큰 정리 */
  prune(now = Date.now()) {
    let n = 0;
    for (const [k, r] of Object.entries(this.data.codes)) {
      if (r.expiresAt + 24 * 3600 * 1000 < now) {
        delete this.data.codes[k];
        n++;
      }
    }
    for (const [k, exp] of Object.entries(this.data.usedRuns)) if (exp < now) delete this.data.usedRuns[k];
    const old = now - STATS_KEEP_MS;
    for (const [k, r] of Object.entries(this.data.sessions)) if (r.startedAt < old) delete this.data.sessions[k];
    for (const [k, r] of Object.entries(this.data.plays)) if (r.startedAt < old) delete this.data.plays[k];
    if (n) this._save();
    return n;
  }

  // ----- players -----
  getPlayer(igsid) {
    return this.data.players[igsid] || null;
  }
  upsertPlayer(igsid, patch) {
    const p = this.data.players[igsid] || { igsid, username: null, followVerifiedAt: null, bests: {} };
    Object.assign(p, patch);
    this.data.players[igsid] = p;
    this._save();
    return p;
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
      if (b && p.username) rows.push({ igsid: p.igsid, username: p.username, verified: !!p.followVerifiedAt, score: b.score, grade: b.grade, at: b.at });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
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
