// Cloudflare D1(SQLite) 저장소 (2026-11-21 Neon → D1). PgStore 와 같은 메서드 — 전부 Promise
//   대부분의 쿼리는 PgStore 것을 그대로 씀: $1 → ?1, ::bigint 같은 형 변환만 빼서 SQLite 로 보냄
//   SQLite 에 없는 것(DO 블록·데이터 고치는 WITH·GREATEST·jsonb 연산)을 쓰는 메서드만 아래에서 다시 씀
//   db = { q(text, params) → 행 배열, batch([[text, params], …]) → 문장마다 행 배열 (한 트랜잭션) }
//   Worker: D1 바인딩(env.DB) / 테스트: node:sqlite (d1Local)
//   ⚠ D1 무료는 요청(Worker 실행) 하나당 쿼리 50번까지, 쿼리 하나당 바인딩 값 100개까지

import { PgStore } from './pgstore.js';

/** Postgres 문장 → SQLite 문장 ($1 → ?1, 형 변환 빼기) */
export function toSqlite(text) {
  return text.replace(/::(bigint|integer|int|text|jsonb)\b/gi, '').replace(/\$(\d+)/g, '?$1');
}

/** D1 은 undefined·boolean 을 못 받음 */
/** 접속 통계를 다시 쓰는 최소 간격 */
export const SESSION_WRITE_EVERY_MS = 10 * 60 * 1000;

const val = (v) => (v === undefined ? null : v === true ? 1 : v === false ? 0 : v);

/**
 * SQLite 표 (Neon 의 SCHEMA 를 다 돈 뒤 모양과 같은 열)
 *   ⚠ D1 무료 쓰기 = 하루 10만 줄, 색인도 한 줄씩 셈 → 통계 표(sessions·plays)엔 색인을 안 둠 (관리자 통계는 가끔이라 읽기로 충분)
 *   ⚠ 글자·여러 칸 주 키는 SQLite 가 숨은 색인을 하나 더 만들어 쓰기가 2배 → 자주 쓰는 표는 WITHOUT ROWID(주 키가 곧 표, 한 줄 = 1번)
 *     (players·scores·maps 등은 11-21 미리 복사 때 이미 보통 표로 만들어져 그대로 둠 — 바꾸려면 다시 써야 해서 쓰기 한도를 또 씀)
 */
export const D1_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at INTEGER, ig TEXT, created_at INTEGER, checked_at INTEGER, hidden_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at INTEGER NOT NULL, PRIMARY KEY (igsid, level))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at)`,
  `CREATE TABLE IF NOT EXISTS used_runs (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, vid TEXT NOT NULL, started_at INTEGER NOT NULL, last_at INTEGER NOT NULL, active_sec INTEGER NOT NULL DEFAULT 0, ref TEXT, device TEXT) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS plays (id TEXT PRIMARY KEY, sid TEXT NOT NULL, vid TEXT NOT NULL, level TEXT NOT NULL, mode TEXT, started_at INTEGER NOT NULL, ended_at INTEGER, result TEXT, score INTEGER, stars INTEGER, sec INTEGER) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, kind TEXT, body TEXT NOT NULL, nick TEXT, vid TEXT, done_at INTEGER, contact TEXT)`,
  `CREATE INDEX IF NOT EXISTS suggestions_at ON suggestions (at)`,
  `CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS transfers (code TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS recover_requests (id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, at INTEGER NOT NULL, nick TEXT, old_ig TEXT, now_ig TEXT, memo TEXT, status TEXT NOT NULL DEFAULT 'wait', igsid TEXT, done_at INTEGER, from_igsid TEXT)`,
  `CREATE INDEX IF NOT EXISTS recover_requests_at ON recover_requests (at)`,
  `CREATE TABLE IF NOT EXISTS maps (id TEXT PRIMARY KEY, igsid TEXT NOT NULL, nick TEXT, name TEXT NOT NULL, bpm REAL NOT NULL, bars INTEGER NOT NULL, diff INTEGER NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, plays INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS maps_at ON maps (at)`,
  `CREATE INDEX IF NOT EXISTS maps_igsid ON maps (igsid, at)`,
  `CREATE TABLE IF NOT EXISTS map_votes (map_id TEXT NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (map_id, who, kind))`,
  `CREATE TABLE IF NOT EXISTS map_scores (map_id TEXT NOT NULL, mode TEXT NOT NULL, igsid TEXT NOT NULL, nick TEXT, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (map_id, mode, igsid))`,
  `CREATE INDEX IF NOT EXISTS map_scores_top ON map_scores (map_id, mode, score DESC)`,
  `CREATE TABLE IF NOT EXISTS ranked (season TEXT NOT NULL, igsid TEXT NOT NULL, rating INTEGER NOT NULL, games INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (season, igsid))`,
  `CREATE INDEX IF NOT EXISTS ranked_top ON ranked (season, rating DESC)`,
  `CREATE TABLE IF NOT EXISTS season_scores (season INTEGER NOT NULL, igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (season, igsid, level)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS hall (season INTEGER NOT NULL, board TEXT NOT NULL, rank INTEGER NOT NULL, igsid TEXT NOT NULL, username TEXT, score INTEGER NOT NULL, n INTEGER, rounds INTEGER, at INTEGER NOT NULL, image TEXT, PRIMARY KEY (season, board, rank)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS ranked_runs (igsid TEXT NOT NULL, level INTEGER NOT NULL, rating INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (igsid, level))`,
];

/** Neon 에서 이미 끝난 옛 기록 옮기기들 — D1 은 그 뒤 데이터를 받으므로 '했음' 으로만 표시 */
const DONE_MIGRATIONS = [
  'migration:remove-instagram-v1',
  'migration:insert-level-8-v1',
  'migration:insert-level-8-repair-v1',
  'migration:reset-level-19-v1',
  'migration:reset-level-18-v1',
  'migration:reset-level-18-v2',
];

const D1_FLAG = (() => {
  let h = 2166136261;
  for (const ch of D1_SCHEMA.join('\n') + '|' + DONE_MIGRATIONS.join(',')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 'd1schema:' + h.toString(36);
})();

/** Worker 의 D1 바인딩 → { q, batch } */
export function d1Binding(D1) {
  const prep = (text, params = []) => D1.prepare(text).bind(...params.map(val));
  return {
    q: async (text, params) => (await prep(text, params).all()).results || [],
    batch: async (list) => (await D1.batch(list.map(([t, p]) => prep(t, p)))).map((r) => r.results || []),
  };
}

/** node:sqlite (테스트·옮기기 스크립트 시험용) → { q, batch } */
export function d1Local(db) {
  const run = (text, params = []) => {
    const st = db.prepare(text);
    return st.columns().length ? st.all(...params.map(val)) : (st.run(...params.map(val)), []);
  };
  return {
    q: async (text, params) => run(text, params),
    batch: async (list) => {
      db.exec('BEGIN');
      try {
        const out = list.map(([t, p]) => run(t, p));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export class D1Store extends PgStore {
  /** @param {{ q: Function, batch: Function }} db */
  constructor(db) {
    super((text, params = []) => db.q(toSqlite(text), params));
    this.db = db;
  }
  /** 여러 문장을 한 번에 (한 트랜잭션). [[pg 문장, params], …] */
  batch(list) {
    return this.db.batch(list.map(([t, p = []]) => [toSqlite(t), p]));
  }

  async init() {
    try {
      if (await this.one('SELECT 1 AS ok FROM settings WHERE key = $1', [D1_FLAG])) return this;
    } catch {}
    const now = String(Date.now());
    await this.batch([
      ...D1_SCHEMA.map((s) => [s]),
      [`INSERT INTO settings (key, value) VALUES ${[...DONE_MIGRATIONS, D1_FLAG].map((_, i) => `($${i + 1}, '${now}')`).join(', ')} ON CONFLICT (key) DO NOTHING`, [...DONE_MIGRATIONS, D1_FLAG]],
    ]);
    return this;
  }
  // Neon 시절 옛 기록 옮기기 (D1 에선 할 일 없음)
  async removeInstagramData() {}
  async shiftLevelsV2() {}
  async repairShiftedLevels() {}
  async resetDeckRanking() {}
  async resetLevel18() {}
  async resetEliseRanking() {}

  async cleanup(now = Date.now()) {
    const old = now - 400 * 24 * 3600 * 1000;
    await this.batch([
      // 판 토큰(하루 약 1.1만)은 지우지 않음: 지우는 것도 한 줄씩 쓰기로 셈 → 하루 쓰기 1.1만 줄 아낌 (1년 약 400만 줄·200MB, D1 무료 저장 5GB)
      ['DELETE FROM rooms WHERE expires_at < $1', [now]],
      ['DELETE FROM transfers WHERE expires_at < $1', [now]],
      ['DELETE FROM plays WHERE started_at < $1', [old]],
      ['DELETE FROM sessions WHERE started_at < $1', [old]],
    ]);
  }

  /** 최고점이면 바꿈. 한 번에 (예전 점수 읽기 + 저장) */
  async recordScore(igsid, level, entry) {
    const [[pre], up] = await this.batch([
      ['SELECT EXISTS (SELECT 1 FROM players WHERE igsid = $1) AS ok, (SELECT score FROM scores WHERE igsid = $1 AND level = $2) AS prev', [igsid, level]],
      [
        `INSERT INTO scores (igsid, level, score, grade, max_combo, at)
         SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM players WHERE igsid = $1)
         ON CONFLICT (igsid, level) DO UPDATE SET score = excluded.score, grade = excluded.grade,
           max_combo = excluded.max_combo, at = excluded.at WHERE excluded.score > scores.score
         RETURNING score`,
        [igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, Date.now()],
      ],
    ]);
    if (!pre || !pre.ok) return null;
    const improved = up.length > 0;
    return { improved, best: improved ? entry.score : Number(pre.prev) };
  }

  /**
   * 접속 통계: 처음 한 번 넣고, 그 뒤엔 10분 넘게 지났을 때만 고침 (D1 쓰기 아끼기 — 매 판·5분마다 고치던 것)
   *   조건이 안 맞으면 아무 줄도 안 바뀌어 쓰기로 안 셈
   */
  async trackSession({ sid, vid, now, activeSec, ref, device }) {
    await this.q(
      `INSERT INTO sessions (sid, vid, started_at, last_at, active_sec, ref, device) VALUES ($1, $2, $3, $3, $4, $5, $6)
       ON CONFLICT (sid) DO UPDATE SET last_at = excluded.last_at, active_sec = MAX(sessions.active_sec, excluded.active_sec)
       WHERE excluded.last_at >= sessions.last_at + ${SESSION_WRITE_EVERY_MS}`,
      [sid, vid, now, activeSec, ref || null, device || null]
    );
  }

  /**
   * 판 통계: 끝난 판만 한 줄 (D1 쓰기 아끼기 — 시작 때 한 줄 + 끝날 때 고치던 것). 끝 신호 없이 사라진 판은 안 남음
   *   바인딩 값 100개 제한이라 9줄(×11)씩 끊어서 batch 로
   */
  async trackPlays(list) {
    const byId = new Map();
    const ended = new Set(list.filter((p) => p.endedAt != null).map((p) => p.id));
    for (const p of list) {
      if (!ended.has(p.id)) continue;
      const r = byId.get(p.id);
      if (!r) byId.set(p.id, { ...p });
      else for (const k of ['endedAt', 'result', 'score', 'stars', 'sec']) if (p[k] != null) r[k] = p[k];
    }
    if (!byId.size) return;
    const rows = [...byId.values()].map((p) => [p.id, p.sid, p.vid, p.level, p.mode ?? null, p.startedAt, p.endedAt ?? null, p.result ?? null, p.score ?? null, p.stars ?? null, p.sec ?? null]);
    const stmts = [];
    for (let i = 0; i < rows.length; i += 9) {
      const part = rows.slice(i, i + 9);
      const vals = part.map((_, j) => '(' + Array.from({ length: 11 }, (_, k) => `$${j * 11 + k + 1}`).join(', ') + ')');
      stmts.push([
        `INSERT INTO plays (id, sid, vid, level, mode, started_at, ended_at, result, score, stars, sec) VALUES ${vals.join(', ')}
         ON CONFLICT (id) DO UPDATE SET ended_at = COALESCE(excluded.ended_at, plays.ended_at), result = COALESCE(excluded.result, plays.result),
           score = COALESCE(excluded.score, plays.score), stars = COALESCE(excluded.stars, plays.stars), sec = COALESCE(excluded.sec, plays.sec)`,
        part.flat(),
      ]);
    }
    await this.batch(stmts);
  }

  async pickRankedRuns(notIgsid, rating, levels, since, n = 8) {
    const rows = await this.q(
      'SELECT data FROM ranked_runs WHERE igsid <> $1 AND level IN (SELECT CAST(value AS INTEGER) FROM json_each($2)) AND at >= $3 ORDER BY ABS(rating - $4) ASC, at DESC LIMIT $5',
      [notIgsid, JSON.stringify(levels), since, rating, n]
    );
    return rows.map((r) => this._json(r.data));
  }

  /**
   * 방 고치기 (한 문장이라 두 사람이 동시에 보내도 안 섞임). Postgres 판의 `data || top` 처럼 얕게 합침:
   *   top 의 키마다 json_set, slot 이면 players.<slot> 을 (예전 data 의 그 사람 값 || player) 로
   */
  async patchRoom(code, { top = {}, slot = null, player = null, cond = {} }, now, expiresAt) {
    const params = [code, now, expiresAt, cond.status ?? null, cond.round ?? null, cond.slotFree ?? null];
    const p = (v) => (params.push(v), `$${params.length}`);
    const key = (k) => '"' + String(k).replace(/["\\]/g, '') + '"';
    const sets = [];
    for (const [k, v] of Object.entries(top)) sets.push(`'$.${key(k)}'`, `json(${p(JSON.stringify(v ?? null))})`);
    if (slot != null) {
      const s = key(slot);
      sets.push(`'$.players'`, `json(COALESCE(data->'$.players', '{}'))`);
      sets.push(`'$.players.${s}'`, `json(COALESCE(data->'$.players.${s}', '{}'))`);
      for (const [k, v] of Object.entries(player || {})) sets.push(`'$.players.${s}.${key(k)}'`, `json(${p(JSON.stringify(v ?? null))})`);
    }
    const r = await this.one(
      `UPDATE rooms SET data = ${sets.length ? `json_set(data, ${sets.join(', ')})` : 'data'}, updated_at = $2, expires_at = $3
       WHERE code = $1 AND expires_at > $2
         AND ($4 IS NULL OR data->>'status' = $4)
         AND ($5 IS NULL OR COALESCE(data->>'round', 0) = $5)
         AND ($6 IS NULL OR (data->'players'->($6)) IS NULL)
       RETURNING data`,
      params
    );
    return r ? JSON.parse(r.data) : null;
  }
}
