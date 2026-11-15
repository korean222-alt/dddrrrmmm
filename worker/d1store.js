// Cloudflare D1(SQLite) 저장소. server/store.js(JsonStore)와 같은 메서드 (전부 Promise)

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, purpose TEXT NOT NULL, session_id TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, igsid TEXT, username TEXT, verified_at INTEGER, last_error TEXT, last_error_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at INTEGER NOT NULL, PRIMARY KEY (igsid, level))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at)`,
  `CREATE TABLE IF NOT EXISTS used_runs (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

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

function codeFromRow(r) {
  if (!r) return null;
  const out = {};
  for (const [k, col] of Object.entries(CODE_COLS)) if (r[col] !== null && r[col] !== undefined) out[k] = r[col];
  return out;
}

export class D1Store {
  /** @param {D1Database} db */
  constructor(db) {
    this.db = db;
  }

  async init() {
    await this.db.batch(SCHEMA.map((s) => this.db.prepare(s)));
    return this;
  }

  /** 서버 비밀값 (예: 쿠키 서명 키). 없으면 처음 한 번 무작위로 만들어 저장 */
  async secret(name) {
    const key = 'secret:' + name;
    const row = await this.db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    if (row) return row.value;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    await this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
    return (await this.db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first()).value;
  }

  // ----- codes -----
  async createCode(rec) {
    const keys = Object.keys(CODE_COLS).filter((k) => rec[k] !== undefined);
    await this.db
      .prepare(`INSERT OR REPLACE INTO codes (${keys.map((k) => CODE_COLS[k]).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
      .bind(...keys.map((k) => rec[k]))
      .run();
    return rec;
  }
  async getCode(code) {
    return codeFromRow(await this.db.prepare('SELECT * FROM codes WHERE code = ?').bind(code).first());
  }
  async updateCode(code, patch) {
    const keys = Object.keys(patch).filter((k) => CODE_COLS[k] && k !== 'code');
    if (keys.length) {
      await this.db
        .prepare(`UPDATE codes SET ${keys.map((k) => `${CODE_COLS[k]} = ?`).join(', ')} WHERE code = ?`)
        .bind(...keys.map((k) => (patch[k] === undefined ? null : patch[k])), code)
        .run();
    }
    return this.getCode(code);
  }
  /** 오래된 코드/사용한 판 토큰 정리 */
  async prune(now = Date.now()) {
    const r = await this.db.batch([
      this.db.prepare('DELETE FROM codes WHERE expires_at + 86400000 < ?').bind(now),
      this.db.prepare('DELETE FROM used_runs WHERE expires_at < ?').bind(now),
    ]);
    return r[0].meta.changes || 0;
  }

  // ----- players -----
  async getPlayer(igsid) {
    const r = await this.db.prepare('SELECT * FROM players WHERE igsid = ?').bind(igsid).first();
    return r ? { igsid: r.igsid, username: r.username, followVerifiedAt: r.follow_verified_at } : null;
  }
  async upsertPlayer(igsid, patch) {
    await this.db
      .prepare(
        `INSERT INTO players (igsid, username, follow_verified_at) VALUES (?, ?, ?)
         ON CONFLICT(igsid) DO UPDATE SET username = COALESCE(excluded.username, players.username),
           follow_verified_at = COALESCE(excluded.follow_verified_at, players.follow_verified_at)`
      )
      .bind(igsid, patch.username ?? null, patch.followVerifiedAt ?? null)
      .run();
    return this.getPlayer(igsid);
  }
  async recordScore(igsid, level, entry) {
    if (!(await this.getPlayer(igsid))) return null;
    const prev = await this.db.prepare('SELECT score FROM scores WHERE igsid = ? AND level = ?').bind(igsid, level).first();
    const improved = !prev || entry.score > prev.score;
    if (improved) {
      await this.db
        .prepare('INSERT OR REPLACE INTO scores (igsid, level, score, grade, max_combo, at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, Date.now())
        .run();
    }
    return { improved, best: improved ? entry.score : prev.score };
  }
  async leaderboard(level, limit = 50) {
    const { results } = await this.db
      .prepare(
        `SELECT s.igsid, p.username, s.score, s.grade, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE s.level = ? AND p.username IS NOT NULL ORDER BY s.score DESC, s.at ASC LIMIT ?`
      )
      .bind(level, limit)
      .all();
    return { rows: results.map((r, i) => ({ ...r, rank: i + 1 })) };
  }
  async rankOf(level, igsid) {
    const mine = await this.db.prepare('SELECT score, at FROM scores WHERE igsid = ? AND level = ?').bind(igsid, level).first();
    if (!mine) return null;
    const ahead = await this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE s.level = ? AND p.username IS NOT NULL AND (s.score > ? OR (s.score = ? AND s.at < ?))`
      )
      .bind(level, mine.score, mine.score, mine.at)
      .first();
    return { rank: (ahead ? ahead.n : 0) + 1, score: mine.score };
  }

  // ----- 판 토큰 1회용 처리 -----
  async useRun(nonce, expiresAt) {
    const r = await this.db.prepare('INSERT OR IGNORE INTO used_runs (nonce, expires_at) VALUES (?, ?)').bind(nonce, expiresAt).run();
    return (r.meta.changes || 0) === 1;
  }

  flush() {}
}
