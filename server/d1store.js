// Cloudflare D1(SQLite) 저장소 (2026-11-21 Neon → D1). PgStore 와 같은 메서드 — 전부 Promise
//   대부분의 쿼리는 PgStore 것을 그대로 씀: $1 → ?1, ::bigint 같은 형 변환만 빼서 SQLite 로 보냄
//   SQLite 에 없는 것(DO 블록·데이터 고치는 WITH·GREATEST·jsonb 연산)을 쓰는 메서드만 아래에서 다시 씀
//   db = { q(text, params) → 행 배열, batch([[text, params], …]) → 문장마다 행 배열 (한 트랜잭션) }
//   Worker: D1 바인딩(env.DB) / 테스트: node:sqlite (d1Local)
//   ⚠ D1 무료는 요청(Worker 실행) 하나당 쿼리 50번까지, 쿼리 하나당 바인딩 값 100개까지

import { PgStore } from './pgstore.js';
import { LAST_LEVEL_ID } from '../public/js/charts.js';

/** Postgres 문장 → SQLite 문장 ($1 → ?1, 형 변환 빼기) */
export function toSqlite(text) {
  return text.replace(/::(bigint|integer|int|text|jsonb)\b/gi, '').replace(/\$(\d+)/g, '?$1');
}

/** D1 은 undefined·boolean 을 못 받음 */
/** 접속 통계를 다시 쓰는 최소 간격 */
export const RANK_CAP = 200;
export const SESSION_WRITE_EVERY_MS = 10 * 60 * 1000;

const playRow = (r) => ({
  id: r.id, vid: r.vid, level: r.level, startedAt: Number(r.started_at), result: r.result, ...(Number(r.w) > 1 ? { w: Number(r.w) } : {}),
  score: r.score == null ? null : Number(r.score), stars: r.stars == null ? null : Number(r.stars), sec: r.sec == null ? null : Number(r.sec),
});
const val = (v) => (v === undefined ? null : v === true ? 1 : v === false ? 0 : v);

/**
 * SQLite 표 (Neon 의 SCHEMA 를 다 돈 뒤 모양과 같은 열)
 *   ⚠ D1 무료 쓰기 = 하루 10만 줄, 색인도 한 줄씩 셈 → 통계 표(sessions·plays)엔 색인을 안 둠 (관리자 통계는 가끔이라 읽기로 충분)
 *   ⚠ 글자·여러 칸 주 키는 SQLite 가 숨은 색인을 하나 더 만들어 쓰기가 2배 → 자주 쓰는 표는 WITHOUT ROWID(주 키가 곧 표, 한 줄 = 1번)
 *     (players·scores·maps 등은 11-21 미리 복사 때 이미 보통 표로 만들어져 그대로 둠 — 바꾸려면 다시 써야 해서 쓰기 한도를 또 씀)
 */
export const D1_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS wallet (igsid TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL DEFAULT 0, tn INTEGER NOT NULL DEFAULT 0, fday TEXT, fn INTEGER NOT NULL DEFAULT 0, init INTEGER NOT NULL DEFAULT 0, owned TEXT, gift TEXT, s2 TEXT) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at INTEGER, ig TEXT, created_at INTEGER, checked_at INTEGER, hidden_at INTEGER, kakao TEXT, google TEXT)`,
  `CREATE TABLE IF NOT EXISTS scores (igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER, at INTEGER NOT NULL, chk TEXT, PRIMARY KEY (igsid, level))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at)`,
  `CREATE TABLE IF NOT EXISTS level_tries (igsid TEXT NOT NULL, level INTEGER NOT NULL, starts INTEGER NOT NULL DEFAULT 0, clears INTEGER NOT NULL DEFAULT 0, last_at INTEGER, PRIMARY KEY (igsid, level)) WITHOUT ROWID`,
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
  // 인기 맵 목록이 맵 표 전체를 정렬하지 않게 (좋아요가 바뀔 때만 색인 쓰기)
  `CREATE INDEX IF NOT EXISTS maps_top ON maps (likes DESC, at DESC)`,
  `CREATE TABLE IF NOT EXISTS map_votes (map_id TEXT NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (map_id, who, kind))`,
  `CREATE TABLE IF NOT EXISTS map_scores (map_id TEXT NOT NULL, mode TEXT NOT NULL, igsid TEXT NOT NULL, nick TEXT, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (map_id, mode, igsid))`,
  `CREATE INDEX IF NOT EXISTS map_scores_top ON map_scores (map_id, mode, score DESC)`,
  `CREATE TABLE IF NOT EXISTS ranked (season TEXT NOT NULL, igsid TEXT NOT NULL, rating INTEGER NOT NULL, games INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (season, igsid))`,
  `CREATE INDEX IF NOT EXISTS ranked_top ON ranked (season, rating DESC)`,
  `CREATE TABLE IF NOT EXISTS season_scores (season INTEGER NOT NULL, igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (season, igsid, level)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS hall (season INTEGER NOT NULL, board TEXT NOT NULL, rank INTEGER NOT NULL, igsid TEXT NOT NULL, username TEXT, score INTEGER NOT NULL, n INTEGER, rounds INTEGER, at INTEGER NOT NULL, image TEXT, msg TEXT, PRIMARY KEY (season, board, rank)) WITHOUT ROWID`,
  // 📊 오늘 쓴 양 (2026-11-22, 한도 브레이크용 — handler `brake`). 하루 한 줄
  `CREATE TABLE IF NOT EXISTS usage_day (day TEXT PRIMARY KEY, r INTEGER NOT NULL DEFAULT 0, w INTEGER NOT NULL DEFAULT 0, q INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID`,
  // 📊 시간 순 통계 표 (2026-11-22): 주 키 맨 앞이 시작 시각 → 관리자 통계가 그 기간 줄만 읽음
  //   (예전 sessions·plays 는 주 키가 무작위 id 라 통계 볼 때마다 표 전체를 읽었음 — 한 달이면 한 번에 50만 줄)
  //   sessions_t.fresh = 처음 온 방문자(방문자 쿠키가 없던 접속). 예전 표는 그대로 두고 그 전 기간만 읽음
  `CREATE TABLE IF NOT EXISTS sessions_t (started_at INTEGER NOT NULL, sid TEXT NOT NULL, vid TEXT NOT NULL, last_at INTEGER NOT NULL, active_sec INTEGER NOT NULL DEFAULT 0, ref TEXT, device TEXT, fresh INTEGER NOT NULL DEFAULT 0, w INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (started_at, sid)) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS plays_t (started_at INTEGER NOT NULL, id TEXT NOT NULL, sid TEXT NOT NULL, vid TEXT NOT NULL, level TEXT NOT NULL, mode TEXT, ended_at INTEGER, result TEXT, score INTEGER, stars INTEGER, sec INTEGER, w INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (started_at, id)) WITHOUT ROWID`,
  // 랭킹에서 내린 사람만 담는 작은 색인 (지우기 purgeHidden 이 참여자 표 전체를 안 읽게). 안 내린 사람은 색인에 안 들어가 쓰기도 안 늚
  `CREATE INDEX IF NOT EXISTS players_hidden ON players (hidden_at) WHERE hidden_at IS NOT NULL`,
  // 🔑 같은 인스타 아이디의 예전 계정 찾기 (2026-11-25, 새로 등록할 때마다 → 표 전체 안 읽게)
  `CREATE INDEX IF NOT EXISTS players_ig ON players (ig)`,
  `CREATE TABLE IF NOT EXISTS ranked_runs (igsid TEXT NOT NULL, level INTEGER NOT NULL, rating INTEGER NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (igsid, level))`,
  // 🗳 투표 (2026-11-23 시즌 2 피아노 미리보기): 한 사람 한 표
  `CREATE TABLE IF NOT EXISTS poll_votes (poll TEXT NOT NULL, igsid TEXT NOT NULL, choice TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (poll, igsid)) WITHOUT ROWID`,
];

/** 이미 있는 표에 열 더하기 — SQLite 엔 'IF NOT EXISTS' 가 없어서 하나씩 해 보고, 이미 있으면 오류를 그냥 넘김 */
export const D1_ALTERS = [
  // 핵 의심 확인용 JSON (2026-11-21, pgstore SCHEMA 와 같음)
  'ALTER TABLE scores ADD COLUMN chk TEXT',
  // 🪙 지갑: 마지막 판 토큰으로 받은 코인 (2026-11-22)
  'ALTER TABLE wallet ADD COLUMN tn INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE wallet ADD COLUMN owned TEXT',
  // 🎁 운영자 코인 알림 · 💬 명예의 전당 한마디 (2026-11-22)
  'ALTER TABLE wallet ADD COLUMN gift TEXT',
  // 🎁 시즌 2 출석·퀘스트 받은 것 (2026-11-26)
  'ALTER TABLE wallet ADD COLUMN s2 TEXT',
  // 🔑 카카오 로그인: 카카오 회원번호의 해시 (2026-11-26)
  'ALTER TABLE players ADD COLUMN kakao TEXT',
  'ALTER TABLE players ADD COLUMN google TEXT',
  'ALTER TABLE hall ADD COLUMN msg TEXT',
  // 📊 통계 표본 무게 (2026-11-22 저녁) — 표를 그날 만들었다면 열이 없을 수 있음
  'ALTER TABLE sessions_t ADD COLUMN w INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE plays_t ADD COLUMN w INTEGER NOT NULL DEFAULT 1',
];
// ⚠ 2026-11-22 밤: 운영 D1 에 wallet.owned·sessions_t.w 가 없었음 (열 추가가 오류를 그냥 넘겨서, 한도 초과 때 실패해도 '했음' 표시가 됨)
//   → 표마다 있는 열을 한 번에 읽고(쿼리 1번) 없는 열만 추가, 추가가 실패하면 '했음' 표시를 안 함 (다음 요청에 다시)

/** 열을 다 넣은 뒤에 만드는 색인 (예전 표엔 열이 나중에 붙으므로 D1_SCHEMA 에 두면 init 이 통째로 실패함) */
export const D1_AFTER = [
  // 🔑 카카오 로그인으로 계정 찾기 (2026-11-26, 연결한 사람만 색인에 들어감)
  `CREATE INDEX IF NOT EXISTS players_kakao ON players (kakao) WHERE kakao IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS players_google ON players (google) WHERE google IS NOT NULL`,
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
  for (const ch of D1_SCHEMA.join('\n') + '|' + D1_ALTERS.join(';') + '|' + D1_AFTER.join(';') + '|' + DONE_MIGRATIONS.join(',')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 'd1schema:' + h.toString(36);
})();

/** Worker 의 D1 바인딩 → { q, batch }. meter = { r, w } 가 있으면 D1 이 알려 준 읽은·쓴 줄 수를 더함 (한도 브레이크용) */
export function d1Binding(D1, meter = null) {
  const prep = (text, params = []) => D1.prepare(text).bind(...params.map(val));
  const tally = (res) => {
    if (meter && res && res.meta) {
      meter.r += Number(res.meta.rows_read) || 0;
      meter.w += Number(res.meta.rows_written) || 0;
    }
    return res;
  };
  return {
    q: async (text, params) => tally(await prep(text, params).all()).results || [],
    batch: async (list) => (await D1.batch(list.map(([t, p]) => prep(t, p)))).map((r) => tally(r).results || []),
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
    // 통계 줄에 표본 무게(w)를 적을 수 있음 → handler 가 사람이 많을 때 일부만 적음 (worker 가 통계를 Neon 에 쓰면 false 로)
    this.statsSampled = true;
  }
  /** 여러 문장을 한 번에 (한 트랜잭션). [[pg 문장, params], …] */
  batch(list) {
    return this.db.batch(list.map(([t, p = []]) => [toSqlite(t), p]));
  }

  /** D1_ALTERS 중 아직 없는 열만 추가. 실패하면 던짐 (init 이 '했음'을 안 적게) */
  async addMissingColumns() {
    const want = D1_ALTERS.map((a) => {
      const m = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/.exec(a);
      return m && { sql: a, t: m[1], c: m[2] };
    }).filter(Boolean);
    const tables = [...new Set(want.map((w) => w.t))];
    let have = null;
    try {
      const rows = await this.db.q(tables.map((t) => `SELECT '${t}' AS t, name AS c FROM pragma_table_info('${t}')`).join(' UNION ALL '), []);
      have = new Set(rows.map((r) => `${r.t}.${r.c}`));
    } catch {}
    for (const w of want) {
      if (have && have.has(`${w.t}.${w.c}`)) continue;
      try {
        await this.db.q(w.sql, []);
      } catch (e) {
        if (!/duplicate column/i.test(String((e && e.message) || e))) throw e;
      }
    }
  }

  async init() {
    try {
      if (await this.one('SELECT 1 AS ok FROM settings WHERE key = $1', [D1_FLAG])) return this;
    } catch {}
    const now = String(Date.now());
    await this.batch(D1_SCHEMA.map((s) => [s]));
    await this.addMissingColumns();
    await this.batch(D1_AFTER.map((x) => [x]));
    await this.batch([
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
      // 시간 순 통계 표는 주 키 범위라 지울 줄만 읽음
      ['DELETE FROM sessions_t WHERE started_at < $1', [old]],
      ['DELETE FROM plays_t WHERE started_at < $1', [old]],
      // 통계(plays·sessions) 400일 지난 것 지우기는 뺌: 색인이 없어 지울 때마다 표 전체를 읽음(2026-11-22 한 번에 2만 줄),
      //   지울 게 생기는 건 2027-12 부터 → 그때 따로 (예: 하루 한 번 Actions 에서)
    ]);
  }

  /**
   * 내 등수: 내 위 사람을 RANK_CAP 명까지만 셈 (2026-11-22: 등수 세기가 하루 D1 읽기의 75% — 1번에 1천~1.5천 줄)
   *   점수 색인(scores_rank)을 내 점수부터 위로 훑다 RANK_CAP 명에서 멈춤 → 넘으면 { rank: null, over: true }
   */
  async rankOf(level, igsid) {
    const r = await this.one(
      `WITH mine AS (
         SELECT s.score, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE s.igsid = $1 AND s.level = $2 AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL)
       SELECT mine.score, (SELECT COUNT(*) FROM (SELECT 1 FROM scores s JOIN players p ON p.igsid = s.igsid
           WHERE s.level = $2 AND s.score >= mine.score AND (s.score > mine.score OR s.at < mine.at)
             AND p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL LIMIT ${RANK_CAP})) AS n
       FROM mine`,
      [igsid, level]
    );
    if (!r) return null;
    const n = Number(r.n);
    return n >= RANK_CAP ? { rank: null, over: true, score: Number(r.score) } : { rank: n + 1, score: Number(r.score) };
  }

  /** 📊 오늘 쓴 양 더하기 → 오늘 합계 { r, w, q } (add 가 다 0 이면 읽기만) */
  async usageAdd(day, add) {
    if (!add.r && !add.w && !add.q) {
      const row = await this.one('SELECT r, w, q FROM usage_day WHERE day = $1', [day]);
      return row ? { r: Number(row.r), w: Number(row.w), q: Number(row.q) } : { r: 0, w: 0, q: 0 };
    }
    const row = await this.one(
      `INSERT INTO usage_day (day, r, w, q) VALUES ($1, $2, $3, $4)
       ON CONFLICT (day) DO UPDATE SET r = usage_day.r + excluded.r, w = usage_day.w + excluded.w, q = usage_day.q + excluded.q
       RETURNING r, w, q`,
      [day, add.r, add.w, add.q]
    );
    return { r: Number(row.r), w: Number(row.w), q: Number(row.q) };
  }

  /** 최고점이면 바꿈. 한 번에 (예전 점수 읽기 + 저장) */
  async recordScore(igsid, level, entry) {
    const [[pre], up] = await this.batch([
      ['SELECT EXISTS (SELECT 1 FROM players WHERE igsid = $1) AS ok, (SELECT score FROM scores WHERE igsid = $1 AND level = $2) AS prev', [igsid, level]],
      [
        `INSERT INTO scores (igsid, level, score, grade, max_combo, at, chk)
         SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM players WHERE igsid = $1)
         ON CONFLICT (igsid, level) DO UPDATE SET score = excluded.score, grade = excluded.grade,
           max_combo = excluded.max_combo, at = excluded.at, chk = excluded.chk WHERE excluded.score > scores.score
         RETURNING score`,
        [igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, entry.at ?? Date.now(), entry.chk ?? null],
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
  async trackSession({ sid, vid, now, activeSec, ref, device, st = null, fresh = false, w = 1 }) {
    // 새 폰(세션 시작 시각 st 를 보냄) → 시간 순 표. 예전 앱(st 없음)만 예전 표에
    if (st != null) {
      await this.q(
        `INSERT INTO sessions_t (started_at, sid, vid, last_at, active_sec, ref, device, fresh, w) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (started_at, sid) DO UPDATE SET last_at = excluded.last_at, active_sec = MAX(sessions_t.active_sec, excluded.active_sec)
         WHERE excluded.last_at >= sessions_t.last_at + ${SESSION_WRITE_EVERY_MS}`,
        [st, sid, vid, now, activeSec, ref || null, device || null, fresh ? 1 : 0, w || 1]
      );
      return;
    }
    await this.q(
      `INSERT INTO sessions (sid, vid, started_at, last_at, active_sec, ref, device) VALUES ($1, $2, $3, $3, $4, $5, $6)
       ON CONFLICT (sid) DO UPDATE SET last_at = excluded.last_at, active_sec = MAX(sessions.active_sec, excluded.active_sec)
       WHERE excluded.last_at >= sessions.last_at + ${SESSION_WRITE_EVERY_MS}`,
      [sid, vid, now, activeSec, ref || null, device || null]
    );
  }

  /**
   * 판 통계: 끝난 판만 한 줄 (D1 쓰기 아끼기 — 시작 때 한 줄 + 끝날 때 고치던 것). 끝 신호 없이 사라진 판은 안 남음
   *   시간 순 표 plays_t 에 (2026-11-22)
   *   바인딩 값 100개 제한이라 8줄(×12)씩 끊어서 batch 로
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
    const rows = [...byId.values()].map((p) => [p.id, p.sid, p.vid, p.level, p.mode ?? null, p.startedAt, p.endedAt ?? null, p.result ?? null, p.score ?? null, p.stars ?? null, p.sec ?? null, p.w || 1]);
    const stmts = [];
    for (let i = 0; i < rows.length; i += 8) {
      const part = rows.slice(i, i + 8);
      const vals = part.map((_, j) => '(' + Array.from({ length: 12 }, (_, k) => `$${j * 12 + k + 1}`).join(', ') + ')');
      stmts.push([
        `INSERT INTO plays_t (id, sid, vid, level, mode, started_at, ended_at, result, score, stars, sec, w) VALUES ${vals.join(', ')}
         ON CONFLICT (started_at, id) DO UPDATE SET ended_at = COALESCE(excluded.ended_at, plays_t.ended_at), result = COALESCE(excluded.result, plays_t.result),
           score = COALESCE(excluded.score, plays_t.score), stars = COALESCE(excluded.stars, plays_t.stars), sec = COALESCE(excluded.sec, plays_t.sec)`,
        part.flat(),
      ]);
    }
    await this.batch(stmts);
  }

  /**
   * 📊 관리자 통계 원본: 시간 순 표(sessions_t·plays_t)는 기간 줄만 읽음.
   *   그 표가 쓰이기 전(cut) 기간만 예전 표(sessions·plays, 표 전체를 읽음)에서 — legacy:false 면 예전 표는 안 읽음(한도 브레이크 때)
   */
  async statsRaw(from, to, { legacy = true } = {}) {
    const [cutRow, ses, pl, fresh] = await this.batch([
      ['SELECT (SELECT MIN(started_at) FROM sessions_t) AS a, (SELECT MIN(started_at) FROM plays_t) AS b', []],
      ['SELECT sid, vid, started_at, active_sec, ref, device, w FROM sessions_t WHERE started_at >= $1 AND started_at < $2', [from, to]],
      ['SELECT id, vid, level, started_at, result, score, stars, sec, w FROM plays_t WHERE started_at >= $1 AND started_at < $2', [from, to]],
      ['SELECT DISTINCT vid FROM sessions_t WHERE started_at >= $1 AND started_at < $2 AND fresh = 1', [from, to]],
    ]);
    const c = cutRow[0] || {};
    const cutS = c.a == null ? Infinity : Number(c.a);
    const cutP = c.b == null ? Infinity : Number(c.b);
    const out = {
      sessions: ses.map((r) => ({ sid: r.sid, vid: r.vid, startedAt: Number(r.started_at), activeSec: Number(r.active_sec), ref: r.ref, device: r.device, ...(Number(r.w) > 1 ? { w: Number(r.w) } : {}) })),
      plays: pl.map(playRow),
      newVids: fresh.map((r) => r.vid),
      legacySkipped: false,
    };
    // 예전 표: 시간 순 표가 시작되기 전 기간만 (표마다 따로). 표 전체를 읽으므로 legacy:false 면 건너뜀
    if (from < cutS || from < cutP) {
      // 시간 순 표가 아직 비었으면(처음·시험) 예전 표가 유일한 통계라 그대로 읽음
      if (!legacy && Number.isFinite(cutS) && Number.isFinite(cutP)) out.legacySkipped = true;
      else {
        if (from < cutS) {
          const t = Math.min(to, cutS);
          const [ss, fr] = await this.batch([
            ['SELECT sid, vid, started_at, active_sec, ref, device FROM sessions WHERE started_at >= $1 AND started_at < $2', [from, t]],
            ['SELECT vid FROM sessions GROUP BY vid HAVING MIN(started_at) >= $1 AND MIN(started_at) < $2', [from, t]],
          ]);
          out.sessions.push(...ss.map((r) => ({ sid: r.sid, vid: r.vid, startedAt: Number(r.started_at), activeSec: Number(r.active_sec), ref: r.ref, device: r.device })));
          out.newVids = [...new Set([...out.newVids, ...fr.map((r) => r.vid)])];
        }
        if (from < cutP) {
          const ps = await this.q('SELECT id, vid, level, started_at, result, score, stars, sec FROM plays WHERE started_at >= $1 AND started_at < $2', [from, Math.min(to, cutP)]);
          out.plays.push(...ps.map(playRow));
        }
      }
    }
    return out;
  }

  /**
   * 관리자 참여자 목록 (2026-11-22, 예전 쿼리는 한 번에 6만 줄): totals:false 면 참여자 표만 (점수 합계는 playerTotals 를 따로 오래 기억)
   *   totals:true 면 점수를 사람별로 먼저 모은 뒤 붙임
   */
  async listPlayers(limit = 1_000_000, { totals = true } = {}) {
    if (!totals) {
      const rows = await this.q(
        `SELECT igsid, username, ig, created_at, checked_at, hidden_at FROM players WHERE username IS NOT NULL
         ORDER BY (hidden_at IS NOT NULL), (ig IS NULL), (checked_at IS NULL) DESC, created_at DESC NULLS LAST LIMIT $1`,
        [limit]
      );
      const n = (v) => (v == null ? null : Number(v));
      return rows.map((r) => ({ igsid: r.igsid, username: r.username, ig: r.ig || null, createdAt: n(r.created_at), checkedAt: n(r.checked_at), hiddenAt: n(r.hidden_at) }));
    }
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at,
         COALESCE(t.total, 0) AS total, COALESCE(t.levels, 0) AS levels, t.top, t.endless
       FROM players p LEFT JOIN (
         SELECT igsid, SUM(CASE WHEN level > 0 AND level < 3000 THEN score ELSE 0 END) AS total, SUM(CASE WHEN level > 0 AND level < 3000 THEN 1 ELSE 0 END) AS levels,
           MAX(CASE WHEN level > 0 AND level <= ${LAST_LEVEL_ID} THEN level END) AS top, MAX(CASE WHEN level = 0 THEN score END) AS endless
         FROM scores GROUP BY igsid) t ON t.igsid = p.igsid
       WHERE p.username IS NOT NULL
       ORDER BY (p.hidden_at IS NOT NULL), (p.ig IS NULL), (p.checked_at IS NULL) DESC, p.created_at DESC NULLS LAST LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      igsid: r.igsid, username: r.username, ig: r.ig || null, createdAt: r.created_at == null ? null : Number(r.created_at), checkedAt: r.checked_at == null ? null : Number(r.checked_at),
      hiddenAt: r.hidden_at == null ? null : Number(r.hidden_at),
      total: Number(r.total), levels: Number(r.levels), top: r.top == null ? 0 : Number(r.top), endless: r.endless == null ? null : Number(r.endless),
    }));
  }

  /** 판 수 세기 여러 개를 한 번에 [{ igsid, level, starts, clears, at }] (handler 가 몇 분 모아서) — 바인딩 100개 제한이라 19줄씩 */
  async addTries(list) {
    const stmts = [];
    for (let i = 0; i < list.length; i += 19) {
      const part = list.slice(i, i + 19);
      stmts.push([
        `INSERT INTO level_tries (igsid, level, starts, clears, last_at) VALUES ${part.map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5})`).join(', ')}
         ON CONFLICT (igsid, level) DO UPDATE SET starts = level_tries.starts + excluded.starts, clears = level_tries.clears + excluded.clears, last_at = excluded.last_at`,
        part.flatMap((t) => [t.igsid, t.level, t.starts, t.clears, t.at]),
      ]);
    }
    if (stmts.length) await this.batch(stmts);
  }

  /** 사람별 점수 합계 { igsid: { total, levels, top, endless } } — 점수 표를 한 번 훑음 (admin 이 30분 기억) */
  async playerTotals() {
    const rows = await this.q(
      `SELECT igsid, SUM(CASE WHEN level > 0 AND level < 3000 THEN score ELSE 0 END) AS total, SUM(CASE WHEN level > 0 AND level < 3000 THEN 1 ELSE 0 END) AS levels,
         MAX(CASE WHEN level > 0 AND level <= ${LAST_LEVEL_ID} THEN level END) AS top, MAX(CASE WHEN level = 0 THEN score END) AS endless
       FROM scores GROUP BY igsid`,
      []
    );
    const out = {};
    for (const r of rows) out[r.igsid] = { total: Number(r.total), levels: Number(r.levels), top: r.top == null ? 0 : Number(r.top), endless: r.endless == null ? null : Number(r.endless) };
    return out;
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
