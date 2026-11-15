// Postgres 저장소 (Neon). server/store.js(JsonStore)와 같은 메서드 — 전부 Promise
//   q(text, params) → 행 배열. Vercel 에선 Neon HTTP 드라이버, 테스트에선 PGlite(메모리 Postgres)
//   시각(ms)은 BIGINT 라서 드라이버가 문자열/BigInt 로 줄 수 있어 Number() 로 바꿔 씀

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS codes (
     code TEXT PRIMARY KEY, purpose TEXT NOT NULL, session_id TEXT NOT NULL, status TEXT NOT NULL,
     created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, igsid TEXT, username TEXT,
     verified_at BIGINT, last_error TEXT, last_error_at BIGINT)`,
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`,
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

// codes 테이블: JS 이름 ↔ 열 이름
const CODE_COLS = {
  code: 'code',
  purpose: 'purpose',
  sessionId: 'session_id',
  status: 'status',
  createdAt: 'created_at',
  expiresAt: 'expires_at',
  igsid: 'igsid',
  username: 'username',
  verifiedAt: 'verified_at',
  lastError: 'last_error',
  lastErrorAt: 'last_error_at',
};
const NUM_COLS = new Set(['created_at', 'expires_at', 'verified_at', 'last_error_at']);

const num = (v) => (v === null || v === undefined ? v : Number(v));

function codeFromRow(r) {
  if (!r) return null;
  const out = {};
  for (const [k, col] of Object.entries(CODE_COLS)) if (r[col] !== null && r[col] !== undefined) out[k] = NUM_COLS.has(col) ? Number(r[col]) : r[col];
  return out;
}

export class PgStore {
  /** @param {(text: string, params?: any[]) => Promise<any[]>} q */
  constructor(q) {
    this.q = q;
  }

  async init() {
    for (const s of SCHEMA) await this.q(s);
    return this;
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

  // ----- codes -----
  async createCode(rec) {
    const keys = Object.keys(CODE_COLS).filter((k) => rec[k] !== undefined);
    const cols = keys.map((k) => CODE_COLS[k]);
    const sets = cols.filter((c) => c !== 'code').map((c) => `${c} = EXCLUDED.${c}`);
    await this.q(
      `INSERT INTO codes (${cols.join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')})
       ON CONFLICT (code) DO UPDATE SET ${sets.join(', ')}`,
      keys.map((k) => rec[k])
    );
    return rec;
  }
  async getCode(code) {
    return codeFromRow(await this.one('SELECT * FROM codes WHERE code = $1', [code]));
  }
  async updateCode(code, patch) {
    const keys = Object.keys(patch).filter((k) => CODE_COLS[k] && k !== 'code');
    if (keys.length) {
      await this.q(
        `UPDATE codes SET ${keys.map((k, i) => `${CODE_COLS[k]} = $${i + 1}`).join(', ')} WHERE code = $${keys.length + 1}`,
        [...keys.map((k) => (patch[k] === undefined ? null : patch[k])), code]
      );
    }
    return this.getCode(code);
  }
  /** 승인 기다리는 코드 (관리자 페이지용) */
  async listPendingCodes(now = Date.now(), limit = 100) {
    const rows = await this.q(
      `SELECT * FROM codes WHERE status IN ('pending', 'not_following') AND expires_at > $1 ORDER BY created_at DESC LIMIT $2`,
      [now, limit]
    );
    return rows.map(codeFromRow);
  }
  /** 오래된 코드/사용한 판 토큰 정리 */
  async prune(now = Date.now()) {
    const del = await this.q('DELETE FROM codes WHERE expires_at + 86400000 < $1 RETURNING code', [now]);
    await this.q('DELETE FROM used_runs WHERE expires_at < $1', [now]);
    await this.q('DELETE FROM plays WHERE started_at < $1', [now - STATS_KEEP_MS]);
    await this.q('DELETE FROM sessions WHERE started_at < $1', [now - STATS_KEEP_MS]);
    return del.length;
  }

  // ----- players -----
  async getPlayer(igsid) {
    const r = await this.one('SELECT * FROM players WHERE igsid = $1', [igsid]);
    return r ? { igsid: r.igsid, username: r.username, followVerifiedAt: num(r.follow_verified_at) } : null;
  }
  async upsertPlayer(igsid, patch) {
    await this.q(
      `INSERT INTO players (igsid, username, follow_verified_at) VALUES ($1, $2, $3)
       ON CONFLICT (igsid) DO UPDATE SET username = COALESCE(EXCLUDED.username, players.username),
         follow_verified_at = COALESCE(EXCLUDED.follow_verified_at, players.follow_verified_at)`,
      [igsid, patch.username ?? null, patch.followVerifiedAt ?? null]
    );
    return this.getPlayer(igsid);
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
      `SELECT s.igsid, p.username, p.follow_verified_at, s.score, s.grade, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.level = $1 AND p.username IS NOT NULL ORDER BY s.score DESC, s.at ASC LIMIT $2`,
      [level, limit]
    );
    return {
      rows: rows.map(({ follow_verified_at, ...r }, i) => ({ ...r, verified: follow_verified_at != null, score: Number(r.score), at: Number(r.at), rank: i + 1 })),
    };
  }
  async rankOf(level, igsid) {
    const mine = await this.one('SELECT score, at FROM scores WHERE igsid = $1 AND level = $2', [igsid, level]);
    if (!mine) return null;
    const ahead = await this.one(
      `SELECT COUNT(*) AS n FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.level = $1 AND p.username IS NOT NULL AND (s.score > $2 OR (s.score = $2 AND s.at < $3))`,
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
