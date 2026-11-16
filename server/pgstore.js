// Postgres 저장소 (Neon). server/store.js(JsonStore)와 같은 메서드 — 전부 Promise
//   q(text, params) → 행 배열. Vercel 에선 Neon HTTP 드라이버, 테스트에선 PGlite(메모리 Postgres)
//   시각(ms)은 BIGINT 라서 드라이버가 문자열/BigInt 로 줄 수 있어 Number() 로 바꿔 씀

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`,
  // ig = 인스타 아이디(랭킹 참여 때 받음), checked_at = 운영자가 팔로우를 확인한 시각
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS ig TEXT`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at BIGINT`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_at BIGINT`,
  // hidden_at = 운영자가 '팔로우 확인 안 됨'으로 랭킹에서 내린 시각. HIDE_KEEP_MS 뒤 자동 삭제
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS hidden_at BIGINT`,
  `CREATE TABLE IF NOT EXISTS scores (
     igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER,
     at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at)`,
  `CREATE TABLE IF NOT EXISTS used_runs (nonce TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  // 이용 통계 (익명): 접속 1회 / 곡 한 판. vid = 브라우저마다 붙는 무작위 번호
  `CREATE TABLE IF NOT EXISTS sessions (
     sid TEXT PRIMARY KEY, vid TEXT NOT NULL, started_at BIGINT NOT NULL, last_at BIGINT NOT NULL,
     active_sec INTEGER NOT NULL DEFAULT 0, ref TEXT, device TEXT)`,
  `CREATE INDEX IF NOT EXISTS sessions_started ON sessions (started_at)`,
  `CREATE INDEX IF NOT EXISTS sessions_vid ON sessions (vid)`,
  `CREATE TABLE IF NOT EXISTS plays (
     id TEXT PRIMARY KEY, sid TEXT NOT NULL, vid TEXT NOT NULL, level TEXT NOT NULL, mode TEXT,
     started_at BIGINT NOT NULL, ended_at BIGINT, result TEXT, score INTEGER, stars INTEGER, sec INTEGER)`,
  `CREATE INDEX IF NOT EXISTS plays_started ON plays (started_at)`,
];

// 이용 통계는 1년 보관
const STATS_KEEP_MS = 400 * 24 * 3600 * 1000;

/** 랭킹에서 내린 참여자를 이만큼 뒤에 지움 (그 사이 다시 들어와 아이디를 넣으면 살아남) */
export const HIDE_KEEP_MS = 5 * 24 * 3600 * 1000;

const num = (v) => (v === null || v === undefined ? v : Number(v));

export class PgStore {
  /** @param {(text: string, params?: any[]) => Promise<any[]>} q */
  constructor(q) {
    this.q = q;
  }

  async init() {
    for (const s of SCHEMA) await this.q(s);
    await this.removeInstagramData();
    return this;
  }

  /**
   * 인스타 아이디 등록 기능을 없애면서, 그동안 등록된 인스타 계정 기록을 한 번 지움:
   *   - 인스타로 인증된 플레이어(follow_verified_at 이 있는 사람)와 그 점수
   *   - DM 인증 코드 테이블(codes) 전체 (인스타 아이디·ID 가 들어 있음)
   * 닉네임으로 참여한 사람의 기록은 그대로. 한 번 하고 나면 표시를 남겨서 다시 안 돌림.
   */
  async removeInstagramData() {
    const FLAG = 'migration:remove-instagram-v1';
    if (await this.one('SELECT value FROM settings WHERE key = $1', [FLAG])) return;
    const gone = await this.q('SELECT igsid FROM players WHERE follow_verified_at IS NOT NULL');
    await this.q('DELETE FROM scores WHERE igsid IN (SELECT igsid FROM players WHERE follow_verified_at IS NOT NULL)');
    await this.q('DELETE FROM players WHERE follow_verified_at IS NOT NULL');
    await this.q('DROP TABLE IF EXISTS codes');
    await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [FLAG, String(Date.now())]);
    console.log(`[store] 인스타 등록 기록 삭제: 플레이어 ${gone.length}명 + 점수 + 인증 코드`);
  }

  async one(text, params) {
    return (await this.q(text, params))[0] || null;
  }

  /** 서버 비밀값 (예: 쿠키 서명 키). 없으면 처음 한 번 무작위로 만들어 저장 */
  async secret(name) {
    const key = 'secret:' + name;
    const row = await this.one('SELECT value FROM settings WHERE key = $1', [key]);
    if (row) return row.value;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
    return (await this.one('SELECT value FROM settings WHERE key = $1', [key])).value;
  }

  // ----- players -----
  async getPlayer(igsid) {
    const r = await this.one('SELECT * FROM players WHERE igsid = $1', [igsid]);
    return r ? { igsid: r.igsid, username: r.username, ig: r.ig || null, hiddenAt: num(r.hidden_at) ?? null } : null;
  }
  async upsertPlayer(igsid, patch) {
    // 인스타 아이디가 바뀌면 운영자가 팔로우를 다시 확인해야 함 (checked_at 비움)
    await this.q(
      `INSERT INTO players (igsid, username, ig, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (igsid) DO UPDATE SET username = COALESCE(EXCLUDED.username, players.username),
         checked_at = CASE WHEN EXCLUDED.ig IS NOT NULL AND (EXCLUDED.ig IS DISTINCT FROM players.ig OR players.hidden_at IS NOT NULL) THEN NULL ELSE players.checked_at END,
         hidden_at = CASE WHEN EXCLUDED.ig IS NOT NULL THEN NULL ELSE players.hidden_at END,
         ig = COALESCE(EXCLUDED.ig, players.ig)`,
      [igsid, patch.username ?? null, patch.ig ?? null, Date.now()]
    );
    return this.getPlayer(igsid);
  }
  /** 관리자용 참여자 목록 (확인 안 한 사람 먼저, 최근 가입 순) */
  async listPlayers() {
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at,
         COALESCE(SUM(s.score) FILTER (WHERE s.level > 0), 0) AS total, COUNT(s.level) FILTER (WHERE s.level > 0) AS levels,
         MAX(s.score) FILTER (WHERE s.level = 0) AS endless
       FROM players p LEFT JOIN scores s ON s.igsid = p.igsid WHERE p.username IS NOT NULL
       GROUP BY p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at
       ORDER BY (p.hidden_at IS NOT NULL), (p.checked_at IS NULL) DESC, p.created_at DESC NULLS LAST LIMIT 1000`
    );
    return rows.map((r) => ({
      igsid: r.igsid, username: r.username, ig: r.ig || null, createdAt: num(r.created_at) ?? null, checkedAt: num(r.checked_at) ?? null,
      hiddenAt: num(r.hidden_at) ?? null,
      total: Number(r.total), levels: Number(r.levels), endless: r.endless == null ? null : Number(r.endless),
    }));
  }
  async deletePlayer(igsid) {
    await this.q('DELETE FROM scores WHERE igsid = $1', [igsid]);
    const r = await this.q('DELETE FROM players WHERE igsid = $1 RETURNING igsid', [igsid]);
    return r.length === 1;
  }
  /** 랭킹에서 내리기(on) / 되돌리기. 내린 사람은 HIDE_KEEP_MS 뒤 purgeHidden 이 지움 */
  async setHidden(igsid, on, now = Date.now()) {
    const r = await this.q('UPDATE players SET hidden_at = $2, checked_at = NULL WHERE igsid = $1 RETURNING igsid', [igsid, on ? now : null]);
    return r.length === 1;
  }
  /** 내린 지 HIDE_KEEP_MS 지난 참여자를 점수와 함께 삭제. 지운 수 */
  async purgeHidden(now = Date.now()) {
    const cut = now - HIDE_KEEP_MS;
    await this.q('DELETE FROM scores WHERE igsid IN (SELECT igsid FROM players WHERE hidden_at IS NOT NULL AND hidden_at < $1)', [cut]);
    const r = await this.q('DELETE FROM players WHERE hidden_at IS NOT NULL AND hidden_at < $1 RETURNING igsid', [cut]);
    return r.length;
  }
  async setChecked(igsid, on) {
    // 확인함 = 숨김도 풀림
    const r = await this.q('UPDATE players SET checked_at = $2, hidden_at = CASE WHEN $2::BIGINT IS NULL THEN hidden_at ELSE NULL END WHERE igsid = $1 RETURNING igsid', [igsid, on ? Date.now() : null]);
    return r.length === 1;
  }
  async recordScore(igsid, level, entry) {
    if (!(await this.getPlayer(igsid))) return null;
    const prev = await this.one('SELECT score FROM scores WHERE igsid = $1 AND level = $2', [igsid, level]);
    const improved = !prev || entry.score > prev.score;
    if (improved) {
      await this.q(
        `INSERT INTO scores (igsid, level, score, grade, max_combo, at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
           max_combo = EXCLUDED.max_combo, at = EXCLUDED.at`,
        [igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, Date.now()]
      );
    }
    return { improved, best: improved ? entry.score : prev.score };
  }
  async leaderboard(level, limit = 50) {
    const rows = await this.q(
      `SELECT s.igsid, p.username, s.score, s.grade, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.level = $1 AND p.username IS NOT NULL AND p.hidden_at IS NULL ORDER BY s.score DESC, s.at ASC LIMIT $2`,
      [level, limit]
    );
    return {
      rows: rows.map((r, i) => ({ ...r, score: Number(r.score), at: Number(r.at), rank: i + 1 })),
    };
  }
  /** 총 등수: 단계별 최고점의 합. 같으면 먼저 달성한 사람이 위 */
  async totalLeaderboard(limit = 50) {
    const rows = await this.q(
      `SELECT s.igsid, p.username, SUM(s.score) AS score, COUNT(*) AS levels, MAX(s.at) AS at
       FROM scores s JOIN players p ON p.igsid = s.igsid WHERE p.username IS NOT NULL AND p.hidden_at IS NULL AND s.level > 0
       GROUP BY s.igsid, p.username ORDER BY score DESC, at ASC LIMIT $1`,
      [limit]
    );
    return { rows: rows.map((r, i) => ({ ...r, score: Number(r.score), levels: Number(r.levels), at: Number(r.at), rank: i + 1 })) };
  }
  async totalRankOf(igsid) {
    const mine = await this.one(
      `SELECT SUM(s.score) AS score, COUNT(*) AS levels, MAX(s.at) AS at FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.igsid = $1 AND p.username IS NOT NULL AND p.hidden_at IS NULL AND s.level > 0`,
      [igsid]
    );
    if (!mine || mine.score == null) return null;
    const ahead = await this.one(
      `SELECT COUNT(*) AS n FROM (SELECT SUM(s.score) AS t, MAX(s.at) AS a FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE p.username IS NOT NULL AND p.hidden_at IS NULL AND s.level > 0 GROUP BY s.igsid) x WHERE x.t > $1 OR (x.t = $1 AND x.a < $2)`,
      [Number(mine.score), Number(mine.at)]
    );
    return { rank: Number(ahead ? ahead.n : 0) + 1, score: Number(mine.score), levels: Number(mine.levels) };
  }
  async rankOf(level, igsid) {
    const mine = await this.one(
      'SELECT s.score, s.at FROM scores s JOIN players p ON p.igsid = s.igsid WHERE s.igsid = $1 AND s.level = $2 AND p.hidden_at IS NULL',
      [igsid, level]
    );
    if (!mine) return null;
    const ahead = await this.one(
      `SELECT COUNT(*) AS n FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.level = $1 AND p.username IS NOT NULL AND p.hidden_at IS NULL AND (s.score > $2 OR (s.score = $2 AND s.at < $3))`,
      [level, mine.score, mine.at]
    );
    return { rank: Number(ahead ? ahead.n : 0) + 1, score: Number(mine.score) };
  }

  /** 게스트 기록을 인증된 플레이어로 옮김 (단계별 더 높은 점수만 남김) */
  async moveScores(from, to) {
    if (from === to) return;
    await this.q(
      `INSERT INTO scores (igsid, level, score, grade, max_combo, at)
       SELECT $2, level, score, grade, max_combo, at FROM scores WHERE igsid = $1
       ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
         max_combo = EXCLUDED.max_combo, at = EXCLUDED.at WHERE EXCLUDED.score > scores.score`,
      [from, to]
    );
    await this.q('DELETE FROM scores WHERE igsid = $1', [from]);
  }

  // ----- 판 토큰 1회용 처리 -----
  async useRun(nonce, expiresAt) {
    const r = await this.q('INSERT INTO used_runs (nonce, expires_at) VALUES ($1, $2) ON CONFLICT (nonce) DO NOTHING RETURNING nonce', [nonce, expiresAt]);
    return r.length === 1;
  }

  // ----- 이용 통계 (익명) -----
  async trackSession({ sid, vid, now, activeSec, ref, device }) {
    await this.q(
      `INSERT INTO sessions (sid, vid, started_at, last_at, active_sec, ref, device) VALUES ($1, $2, $3, $3, $4, $5, $6)
       ON CONFLICT (sid) DO UPDATE SET last_at = EXCLUDED.last_at, active_sec = GREATEST(sessions.active_sec, EXCLUDED.active_sec)`,
      [sid, vid, now, activeSec, ref || null, device || null]
    );
  }
  async trackPlay(p) {
    await this.q(
      `INSERT INTO plays (id, sid, vid, level, mode, started_at, ended_at, result, score, stars, sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET ended_at = COALESCE(EXCLUDED.ended_at, plays.ended_at), result = COALESCE(EXCLUDED.result, plays.result),
         score = COALESCE(EXCLUDED.score, plays.score), stars = COALESCE(EXCLUDED.stars, plays.stars), sec = COALESCE(EXCLUDED.sec, plays.sec)`,
      [p.id, p.sid, p.vid, p.level, p.mode ?? null, p.startedAt, p.endedAt ?? null, p.result ?? null, p.score ?? null, p.stars ?? null, p.sec ?? null]
    );
  }
  /** [from, to) 에 시작한 접속·판 원본 (최대 10만 줄) + 이 기간에 처음 온 방문자 */
  async statsRaw(from, to) {
    const sessions = await this.q(
      `SELECT sid, vid, started_at, active_sec, ref, device FROM sessions WHERE started_at >= $1 AND started_at < $2 LIMIT 100000`,
      [from, to]
    );
    const plays = await this.q(
      `SELECT id, vid, level, started_at, result, score, stars, sec FROM plays WHERE started_at >= $1 AND started_at < $2 LIMIT 100000`,
      [from, to]
    );
    const fresh = await this.q('SELECT vid FROM sessions GROUP BY vid HAVING MIN(started_at) >= $1 AND MIN(started_at) < $2', [from, to]);
    return {
      sessions: sessions.map((r) => ({ sid: r.sid, vid: r.vid, startedAt: Number(r.started_at), activeSec: Number(r.active_sec), ref: r.ref, device: r.device })),
      plays: plays.map((r) => ({
        id: r.id, vid: r.vid, level: r.level, startedAt: Number(r.started_at), result: r.result,
        score: r.score == null ? null : Number(r.score), stars: r.stars == null ? null : Number(r.stars), sec: r.sec == null ? null : Number(r.sec),
      })),
      newVids: fresh.map((r) => r.vid),
    };
  }

  flush() {}
}
