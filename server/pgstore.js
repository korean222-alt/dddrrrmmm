// Postgres 저장소 (Neon). server/store.js(JsonStore)와 같은 메서드 — 전부 Promise
//   q(text, params) → 행 배열. Vercel 에선 Neon HTTP 드라이버, 테스트에선 PGlite(메모리 Postgres)
//   시각(ms)은 BIGINT 라서 드라이버가 문자열/BigInt 로 줄 수 있어 Number() 로 바꿔 씀

import { LAST_LEVEL_ID } from '../public/js/charts.js';

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
  // 무제한 기록(level <= 0)은 '깬 단계 × 10억 + 점수' 라 INTEGER(약 21억)를 넘음 → BIGINT
  `DO $$ BEGIN
     IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'score') = 'integer' THEN
       ALTER TABLE scores ALTER COLUMN score TYPE BIGINT;
     END IF;
   END $$`,
  // 예전 방식(깬 단계 × 100만 + 점수, 999,999 에서 잘림) → 새 방식. 깬 단계는 1 이상이라 새 방식 값은 항상 10억 이상 → 여러 번 돌려도 안전
  `UPDATE scores SET score = (score / 1000000) * 1000000000 + score % 1000000 WHERE level <= 0 AND score < 1000000000`,
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
  // 건의함: 사용자가 남긴 건의사항 (운영자 화면 + 매일 읽는 봇). done_at = 처리함 표시
  `CREATE TABLE IF NOT EXISTS suggestions (
     id BIGSERIAL PRIMARY KEY, at BIGINT NOT NULL, kind TEXT, body TEXT NOT NULL, nick TEXT, vid TEXT, done_at BIGINT)`,
  `CREATE INDEX IF NOT EXISTS suggestions_at ON suggestions (at)`,
  // 회신 받을 인스타 아이디·이메일 (선택)
  `ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS contact TEXT`,
  // 친구 대결 방: 방 하나 = 행 하나 (JSON). 2시간 동안 아무도 안 쓰면 지움
  `CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at BIGINT NOT NULL, expires_at BIGINT NOT NULL)`,
  // 기기 옮기기: 6자리 코드 하나 = 행 하나 (10분, 한 번 쓰면 지움)
  `CREATE TABLE IF NOT EXISTS transfers (code TEXT PRIMARY KEY, data JSONB NOT NULL, expires_at BIGINT NOT NULL)`,
  // 기록 되찾기 요청 (아이디가 기억 안 나는 사람 → 운영자가 admin 에서 계정을 골라 승인). token 은 요청한 폰만 앎
  `CREATE TABLE IF NOT EXISTS recover_requests (
     id BIGSERIAL PRIMARY KEY, token TEXT UNIQUE NOT NULL, at BIGINT NOT NULL, nick TEXT, old_ig TEXT, now_ig TEXT, memo TEXT,
     status TEXT NOT NULL DEFAULT 'wait', igsid TEXT, done_at BIGINT)`,
  `CREATE INDEX IF NOT EXISTS recover_requests_at ON recover_requests (at)`,
  // 요청을 보낸 폰이 그때 쓰던 계정 (후보에서 '지금 이 폰 계정'으로 따로 보여 줌)
  `ALTER TABLE recover_requests ADD COLUMN IF NOT EXISTS from_igsid TEXT`,
];

/** init 에서 도는 옛 기록 옮기기 목록 — 새로 추가하면 여기에도 이름을 붙임 (SCHEMA_FLAG 가 바뀌어 다시 돎) */
const MIGRATIONS = ['remove-instagram-v1', 'insert-level-8-v1', 'repair-shifted-levels', 'reset-level-19-v1'];
/** 🎄 데크 더 홀즈(19)를 합창 녹음 곡으로 바꾼 배포 시각: 그 전 점수(옛 채보)만 랭킹에서 지움 */
export const DECK_RESET_BEFORE = Date.parse('2026-11-19T07:13:00Z');
/** 표·옮기기 내용이 바뀌면 달라지는 표시 이름 (짧은 해시) */
const SCHEMA_FLAG = (() => {
  let h = 2166136261;
  for (const ch of SCHEMA.join('\n') + '|' + MIGRATIONS.join(',')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 'schema:' + h.toString(36);
})();

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
    // 표 만들기·옛 기록 옮기기는 한 번 끝나면 settings 에 표시 → 다음부터는 이 한 줄만 확인 (서버가 새로 뜰 때마다 30번 왕복하던 것)
    //   SCHEMA 나 MIGRATIONS 가 바뀌면 표시 이름이 바뀌어서 한 번 다시 돎
    try {
      if (await this.one('SELECT 1 AS ok FROM settings WHERE key = $1', [SCHEMA_FLAG])) return this;
    } catch {}
    for (const s of SCHEMA) await this.q(s);
    await this.removeInstagramData();
    await this.shiftLevelsV2();
    await this.repairShiftedLevels();
    await this.resetDeckRanking();
    await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [SCHEMA_FLAG, String(Date.now())]);
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

  /** 🎄 데크 더 홀즈가 합창 녹음 곡·새 채보로 바뀌어서 그 전 점수만 한 번 지움 (새 채보 점수는 그대로) */
  async resetDeckRanking() {
    const FLAG = 'migration:reset-level-19-v1';
    const got = await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key', [FLAG, String(Date.now())]);
    if (!got.length) return;
    await this.q('DELETE FROM scores WHERE level = 19 AND at < $1', [DECK_RESET_BEFORE]);
    console.log('[store] 데크 더 홀즈 랭킹 초기화 (옛 채보 점수)');
  }

  /**
   * 8단계에 '운명 교향곡'이 끼면서 예전 8~14단계가 9~15단계로 밀림 → 점수(scores.level)와 이용 통계(plays.level)를 한 번만 옮김.
   *   scores.level: 8~14 → 9~15, 단계별 무제한 칸 -8~-14 → -9~-15 (그리그 0·1~7 은 그대로)
   *   plays.level (글자): '8'~'14' → '9'~'15', 'e8'~'e14' → 'e9'~'e15'
   * 표시를 '먼저' 남겨서 서버가 동시에 여러 개 떠도 한 곳만 실행. 기본키(igsid, level)가 겹치지 않게 +1000 으로 잠깐 비켜 놓았다가 돌아옴.
   * 그 전에 15단계에 남아 있던 어려운 「운명」 점수는 지움 (그 칸은 이제 윌리엄 텔. 안 지우면 기본키가 겹쳐 이전이 통째로 멈춤).
   */
  async shiftLevelsV2() {
    const FLAG = 'migration:insert-level-8-v1';
    const got = await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key', [FLAG, String(Date.now())]);
    if (!got.length) return;
    await this.q('DELETE FROM scores WHERE level IN (15, -15)');
    await this.q('DELETE FROM plays WHERE level IN (\'15\', \'e15\')');
    await this.q('UPDATE scores SET level = level + 1000 WHERE level BETWEEN 8 AND 14');
    await this.q('UPDATE scores SET level = level - 1000 WHERE level BETWEEN -14 AND -8');
    await this._settleShifted();
    await this.q(
      `UPDATE plays SET level = CASE
         WHEN level ~ '^[0-9]+$' THEN (level::int + 1)::text
         ELSE 'e' || (substr(level, 2)::int + 1)::text END
       WHERE (level ~ '^[0-9]+$' AND level::int BETWEEN 8 AND 14) OR (level ~ '^e[0-9]+$' AND substr(level, 2)::int BETWEEN 8 AND 14)`
    );
    console.log('[store] 8단계 신곡 끼움: 8~14단계 기록을 9~15단계로 옮김');
  }

  /** 잠시 비켜 둔 점수(1008~1014, -1008~-1014)를 제자리(9~15, -9~-15)로. 이미 그 칸에 점수가 있으면 더 높은 쪽만 남김 */
  async _settleShifted() {
    await this.q(
      `INSERT INTO scores (igsid, level, score, grade, max_combo, at)
       SELECT igsid, level - 999, score, grade, max_combo, at FROM scores WHERE level BETWEEN 1008 AND 1014
       ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, max_combo = EXCLUDED.max_combo, at = EXCLUDED.at
       WHERE EXCLUDED.score > scores.score`
    );
    await this.q('DELETE FROM scores WHERE level BETWEEN 1008 AND 1014');
    await this.q(
      `INSERT INTO scores (igsid, level, score, grade, max_combo, at)
       SELECT igsid, level + 999, score, grade, max_combo, at FROM scores WHERE level BETWEEN -1014 AND -1008
       ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, max_combo = EXCLUDED.max_combo, at = EXCLUDED.at
       WHERE EXCLUDED.score > scores.score`
    );
    await this.q('DELETE FROM scores WHERE level BETWEEN -1014 AND -1008');
  }

  /**
   * 복구: 위 이전이 15단계 칸에서 막혀 멈춘 적이 있음 (먼저 넣었던 어려운 「운명」 점수가 15단계에 남아
   * 윌리엄 텔 점수가 들어갈 때 기본키가 겹침 → 8~14단계 점수가 1008~1014 에 비켜 둔 채 랭킹이 비어 보임).
   * 비켜 둔 점수가 있을 때만, 한 트랜잭션으로:
   *   ① 이전 시작 전에 15단계에 있던 점수(없어진 어려운 운명)는 치워 두고
   *   ② 비켜 둔 점수를 제자리로 (그 뒤에 새로 친 점수와 겹치면 더 높은 쪽)
   *   ③ 같이 못 옮긴 이용 통계도 옮김
   * 중간에 죽으면 통째로 롤백돼서 다음 시작이 다시 시도함.
   */
  async repairShiftedLevels() {
    const FLAG = 'migration:insert-level-8-repair-v1';
    if (await this.one('SELECT 1 AS x FROM settings WHERE key = $1', [FLAG])) return;
    const stuck = await this.one('SELECT 1 AS x FROM scores WHERE level BETWEEN 1008 AND 1014 OR level BETWEEN -1014 AND -1008 LIMIT 1');
    await this.q(`DO $$
DECLARE
  claimed integer;
  t bigint;
BEGIN
  INSERT INTO settings (key, value) VALUES ('${FLAG}', '${Date.now()}')
  ON CONFLICT (key) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed = 0 THEN
    RETURN;
  END IF;

  SELECT NULLIF(value, '')::bigint INTO t FROM settings WHERE key = 'migration:insert-level-8-v1';

  IF EXISTS (
    SELECT 1 FROM scores
    WHERE level BETWEEN 1008 AND 1014 OR level BETWEEN -1014 AND -1008
  ) THEN
    IF t IS NOT NULL THEN
      UPDATE scores
        SET level = CASE WHEN level = 15 THEN 9015 ELSE -9015 END
        WHERE level IN (15, -15) AND at < t;
    END IF;

    INSERT INTO scores (igsid, level, score, grade, max_combo, at)
    SELECT igsid, level - 999, score, grade, max_combo, at
    FROM scores WHERE level BETWEEN 1008 AND 1014
    ON CONFLICT (igsid, level) DO UPDATE
      SET score = EXCLUDED.score, grade = EXCLUDED.grade, max_combo = EXCLUDED.max_combo, at = EXCLUDED.at
      WHERE EXCLUDED.score > scores.score;
    DELETE FROM scores WHERE level BETWEEN 1008 AND 1014;

    INSERT INTO scores (igsid, level, score, grade, max_combo, at)
    SELECT igsid, level + 999, score, grade, max_combo, at
    FROM scores WHERE level BETWEEN -1014 AND -1008
    ON CONFLICT (igsid, level) DO UPDATE
      SET score = EXCLUDED.score, grade = EXCLUDED.grade, max_combo = EXCLUDED.max_combo, at = EXCLUDED.at
      WHERE EXCLUDED.score > scores.score;
    DELETE FROM scores WHERE level BETWEEN -1014 AND -1008;

    DELETE FROM scores WHERE level IN (9015, -9015);

    IF t IS NOT NULL THEN
      DELETE FROM plays WHERE level IN ('15', 'e15') AND started_at < t;
      UPDATE plays SET level = CASE
        WHEN level ~ '^[0-9]+$' THEN (level::int + 1)::text
        ELSE 'e' || (substr(level, 2)::int + 1)::text END
      WHERE started_at < t
        AND ((level ~ '^[0-9]+$' AND level::int BETWEEN 8 AND 14)
          OR (level ~ '^e[0-9]+$' AND substr(level, 2)::int BETWEEN 8 AND 14));
    END IF;
  END IF;
END $$`);
    if (stuck) console.log('[store] 8~15단계 랭킹 복구: 멈춘 점수 이전을 마무리함');
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

  /** 설정값 하나 (없으면 null) */
  async getSetting(key) {
    const row = await this.one('SELECT value FROM settings WHERE key = $1', ['set:' + key]);
    return row ? row.value : null;
  }
  async setSetting(key, value) {
    await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['set:' + key, String(value)]);
  }

  // ----- players -----
  async getPlayer(igsid) {
    const r = await this.one('SELECT * FROM players WHERE igsid = $1', [igsid]);
    return r ? { igsid: r.igsid, username: r.username, ig: r.ig || null, hiddenAt: num(r.hidden_at) ?? null, checkedAt: num(r.checked_at) ?? null } : null;
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
  /** limit: admin 참여자 탭은 1000명, 되찾기 후보 찾기는 전부(예전 계정은 목록 맨 뒤라 잘리면 못 찾음) */
  async listPlayers(limit = 1000) {
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at,
         COALESCE(SUM(s.score) FILTER (WHERE s.level > 0), 0) AS total, COUNT(s.level) FILTER (WHERE s.level > 0) AS levels,
         MAX(s.level) FILTER (WHERE s.level > 0 AND s.level <= $2) AS top,
         MAX(s.score) FILTER (WHERE s.level = 0) AS endless
       FROM players p LEFT JOIN scores s ON s.igsid = p.igsid WHERE p.username IS NOT NULL
       GROUP BY p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at
       ORDER BY (p.hidden_at IS NOT NULL), (p.ig IS NULL), (p.checked_at IS NULL) DESC, p.created_at DESC NULLS LAST LIMIT $1`,
      [limit, LAST_LEVEL_ID]
    );
    return rows.map((r) => ({
      igsid: r.igsid, username: r.username, ig: r.ig || null, createdAt: num(r.created_at) ?? null, checkedAt: num(r.checked_at) ?? null,
      hiddenAt: num(r.hidden_at) ?? null,
      total: Number(r.total), levels: Number(r.levels), top: r.top == null ? 0 : Number(r.top), endless: r.endless == null ? null : Number(r.endless),
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
  /** 최고점이면 바꿈. DB 왕복 1번 (참여자 확인 + 예전 점수 + 저장을 한 문장으로) */
  async recordScore(igsid, level, entry) {
    const r = await this.one(
      `WITH pl AS (SELECT 1 FROM players WHERE igsid = $1),
         prev AS (SELECT score FROM scores WHERE igsid = $1 AND level = $2),
         up AS (
           INSERT INTO scores (igsid, level, score, grade, max_combo, at)
           SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM pl)
           ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
             max_combo = EXCLUDED.max_combo, at = EXCLUDED.at WHERE EXCLUDED.score > scores.score
           RETURNING score)
       SELECT EXISTS (SELECT 1 FROM pl) AS ok, (SELECT score FROM prev) AS prev, (SELECT score FROM up) AS up`,
      [igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, Date.now()]
    );
    if (!r || !r.ok) return null;
    const improved = r.up != null;
    return { improved, best: improved ? entry.score : Number(r.prev) };
  }
  async leaderboard(level, limit = 50) {
    const rows = await this.q(
      `SELECT s.igsid, p.username, s.score, s.grade, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.level = $1 AND p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL ORDER BY s.score DESC, s.at ASC LIMIT $2`,
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
       FROM scores s JOIN players p ON p.igsid = s.igsid WHERE p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL AND s.level > 0 AND s.level <= ${LAST_LEVEL_ID}
       GROUP BY s.igsid, p.username ORDER BY score DESC, at ASC LIMIT $1`,
      [limit]
    );
    return { rows: rows.map((r, i) => ({ ...r, score: Number(r.score), levels: Number(r.levels), at: Number(r.at), rank: i + 1 })) };
  }
  async totalRankOf(igsid) {
    const mine = await this.one(
      `SELECT SUM(s.score) AS score, COUNT(*) AS levels, MAX(s.at) AS at FROM scores s JOIN players p ON p.igsid = s.igsid
       WHERE s.igsid = $1 AND p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL AND s.level > 0 AND s.level <= ${LAST_LEVEL_ID}`,
      [igsid]
    );
    if (!mine || mine.score == null) return null;
    const ahead = await this.one(
      `SELECT COUNT(*) AS n FROM (SELECT SUM(s.score) AS t, MAX(s.at) AS a FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL AND s.level > 0 AND s.level <= ${LAST_LEVEL_ID} GROUP BY s.igsid) x WHERE x.t > $1 OR (x.t = $1 AND x.a < $2)`,
      [Number(mine.score), Number(mine.at)]
    );
    return { rank: Number(ahead ? ahead.n : 0) + 1, score: Number(mine.score), levels: Number(mine.levels) };
  }
  /** 내 등수 (DB 왕복 1번) */
  async rankOf(level, igsid) {
    const r = await this.one(
      `WITH mine AS (
         SELECT s.score, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
         WHERE s.igsid = $1 AND s.level = $2 AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL)
       SELECT mine.score, (SELECT COUNT(*) FROM scores s JOIN players p ON p.igsid = s.igsid
           WHERE s.level = $2 AND p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL
             AND (s.score > mine.score OR (s.score = mine.score AND s.at < mine.at))) AS n
       FROM mine`,
      [igsid, level]
    );
    if (!r) return null;
    return { rank: Number(r.n) + 1, score: Number(r.score) };
  }

  /** 이 인스타 아이디로 된 참여자들 (기록 되찾기용): 점수 많은 순 → 오래된 순 */
  async playersByIg(ig) {
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.checked_at, p.created_at, (SELECT COUNT(*) FROM scores s WHERE s.igsid = p.igsid) AS n
         FROM players p WHERE p.ig = $1 AND p.username IS NOT NULL ORDER BY n DESC, p.created_at ASC NULLS LAST LIMIT 20`,
      [ig]
    );
    return rows.map((r) => ({ igsid: r.igsid, username: r.username, checkedAt: num(r.checked_at) ?? null, createdAt: num(r.created_at) ?? null, scores: Number(r.n) }));
  }
  /** 이 닉네임(대소문자·앞뒤 띄어쓰기 무시)인 참여자들 + 인스타 아이디 (기록 되찾기: 아이디를 대충 적었던 사람) */
  async playersByName(name) {
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.ig, p.created_at, (SELECT COUNT(*) FROM scores s WHERE s.igsid = p.igsid) AS n
         FROM players p WHERE lower(trim(p.username)) = lower(trim($1)) ORDER BY n DESC, p.created_at ASC NULLS LAST LIMIT 20`,
      [name]
    );
    return rows.map((r) => ({ igsid: r.igsid, username: r.username, ig: r.ig || null, createdAt: num(r.created_at) ?? null, scores: Number(r.n) }));
  }
  /** 한 사람의 랭킹 기록 전부 (level: 단계 번호 / 0 = 그리그 무제한 / -N = N단계 무제한) */
  async scoresOf(igsid) {
    const rows = await this.q('SELECT level, score, grade, max_combo FROM scores WHERE igsid = $1', [igsid]);
    return rows.map((r) => ({ level: Number(r.level), score: Number(r.score), grade: r.grade || null, maxCombo: Number(r.max_combo) || 0 }));
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
    await this.trackPlays([p]);
  }
  /** 여러 판을 한 번에 (DB 왕복 1번). 같은 id(시작+끝)는 먼저 합침 — 한 문장에서 같은 줄을 두 번 못 고침 */
  async trackPlays(list) {
    const byId = new Map();
    for (const p of list) {
      const r = byId.get(p.id);
      if (!r) byId.set(p.id, { ...p });
      else for (const k of ['endedAt', 'result', 'score', 'stars', 'sec']) if (p[k] != null) r[k] = p[k];
    }
    if (!byId.size) return;
    const casts = ['', '', '', '', '', '::bigint', '::bigint', '', '::int', '::int', '::int'];
    const vals = [];
    const params = [];
    for (const p of byId.values()) {
      const row = [p.id, p.sid, p.vid, p.level, p.mode ?? null, p.startedAt, p.endedAt ?? null, p.result ?? null, p.score ?? null, p.stars ?? null, p.sec ?? null];
      vals.push('(' + row.map((_, i) => `$${params.length + i + 1}${casts[i]}`).join(', ') + ')');
      params.push(...row);
    }
    await this.q(
      `INSERT INTO plays (id, sid, vid, level, mode, started_at, ended_at, result, score, stars, sec)
       VALUES ${vals.join(', ')}
       ON CONFLICT (id) DO UPDATE SET ended_at = COALESCE(EXCLUDED.ended_at, plays.ended_at), result = COALESCE(EXCLUDED.result, plays.result),
         score = COALESCE(EXCLUDED.score, plays.score), stars = COALESCE(EXCLUDED.stars, plays.stars), sec = COALESCE(EXCLUDED.sec, plays.sec)`,
      params
    );
  }
  /** [from, to) 에 시작한 접속·판 원본 (한도 없음) + 이 기간에 처음 온 방문자 */
  async statsRaw(from, to) {
    const sessions = await this.q(
      `SELECT sid, vid, started_at, active_sec, ref, device FROM sessions WHERE started_at >= $1 AND started_at < $2`,
      [from, to]
    );
    const plays = await this.q(
      `SELECT id, vid, level, started_at, result, score, stars, sec FROM plays WHERE started_at >= $1 AND started_at < $2`,
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

  // ----- 건의함 -----
  async addSuggestion({ at, kind, body, nick, vid, contact }) {
    const r = await this.one('INSERT INTO suggestions (at, kind, body, nick, vid, contact) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [at, kind, body, nick ?? null, vid ?? null, contact ?? null]);
    return Number(r.id);
  }
  /** from(ms) 이후 건의사항, 최신 먼저 */
  async listSuggestions(from = 0, limit = 500) {
    const rows = await this.q('SELECT * FROM suggestions WHERE at >= $1 ORDER BY at DESC LIMIT $2', [from, limit]);
    return rows.map((r) => ({ id: Number(r.id), at: Number(r.at), kind: r.kind, body: r.body, nick: r.nick, contact: r.contact || null, doneAt: num(r.done_at) ?? null }));
  }
  async setSuggestionDone(id, on, now = Date.now()) {
    const r = await this.q('UPDATE suggestions SET done_at = $2 WHERE id = $1 RETURNING id', [id, on ? now : null]);
    return r.length === 1;
  }
  async deleteSuggestion(id) {
    const r = await this.q('DELETE FROM suggestions WHERE id = $1 RETURNING id', [id]);
    return r.length === 1;
  }
  /** 이 브라우저(vid)가 since 이후 남긴 건의 수 (도배 방지) */
  async countSuggestions(vid, since) {
    const r = await this.one('SELECT COUNT(*) AS n FROM suggestions WHERE vid = $1 AND at >= $2', [vid, since]);
    return Number(r.n);
  }

  // ----- 친구 대결 방 -----
  /** 새 방 (같은 코드가 살아 있으면 false) */
  async createRoom(code, data, now, expiresAt) {
    await this.q('DELETE FROM rooms WHERE expires_at < $1', [now]);
    const r = await this.q(
      `INSERT INTO rooms (code, data, updated_at, expires_at) VALUES ($1, $2::jsonb, $3, $4) ON CONFLICT (code) DO NOTHING RETURNING code`,
      [code, JSON.stringify(data), now, expiresAt]
    );
    return r.length === 1;
  }
  async getRoom(code, now = Date.now()) {
    const r = await this.one('SELECT data FROM rooms WHERE code = $1 AND expires_at > $2', [code, now]);
    return r ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null;
  }
  /**
   * 방 고치기 (한 문장이라 두 사람이 동시에 보내도 안 섞임)
   *   top: 방 전체 값 덮어쓰기(players 를 넣으면 통째로 바꿈) / slot+player: 그 사람 값만 합치기
   *   cond: { status, round, slotFree } 가 맞을 때만 (안 맞으면 null)
   */
  async patchRoom(code, { top = {}, slot = null, player = null, cond = {} }, now, expiresAt) {
    const r = await this.one(
      `UPDATE rooms SET
         data = CASE WHEN $3::text IS NULL THEN data || $2::jsonb
                ELSE (data || $2::jsonb) || jsonb_build_object('players',
                  COALESCE(data->'players', '{}'::jsonb) || jsonb_build_object($3::text, COALESCE(data->'players'->($3::text), '{}'::jsonb) || $4::jsonb)) END,
         updated_at = $5, expires_at = $6
       WHERE code = $1 AND expires_at > $5
         AND ($7::text IS NULL OR data->>'status' = $7::text)
         AND ($8::int IS NULL OR COALESCE((data->>'round')::int, 0) = $8::int)
         AND ($9::text IS NULL OR (data->'players'->($9::text)) IS NULL)
       RETURNING data`,
      [code, JSON.stringify(top), slot, JSON.stringify(player || {}), now, expiresAt, cond.status ?? null, cond.round ?? null, cond.slotFree ?? null]
    );
    return r ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null;
  }
  /** 빠른 대결: 이 묶음에서 한 명이 기다리는(최근 주고받은) 방 코드들 */
  async findOpenRooms(bracket, freshAfter, now = Date.now()) {
    const rows = await this.q(
      `SELECT code FROM rooms WHERE expires_at > $3 AND updated_at > $2 AND data->>'pub' = $1 AND data->>'status' = 'lobby'
         AND (data->'players'->'a') IS NOT NULL AND (data->'players'->'b') IS NULL ORDER BY updated_at LIMIT 5`,
      [bracket, freshAfter, now]
    );
    return rows.map((r) => r.code);
  }
  async deleteRoom(code) {
    await this.q('DELETE FROM rooms WHERE code = $1', [code]);
  }

  // ----- 기록 되찾기 요청 -----
  async addRecoverRequest({ token, at, nick, oldIg, nowIg, memo, fromIgsid }) {
    const r = await this.one(
      'INSERT INTO recover_requests (token, at, nick, old_ig, now_ig, memo, from_igsid) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [token, at, nick ?? null, oldIg ?? null, nowIg ?? null, memo ?? null, fromIgsid ?? null]
    );
    return Number(r.id);
  }
  _recoverRow(r) {
    return r && { id: Number(r.id), at: Number(r.at), nick: r.nick, oldIg: r.old_ig, nowIg: r.now_ig, memo: r.memo, status: r.status, igsid: r.igsid || null, fromIgsid: r.from_igsid || null, doneAt: num(r.done_at) ?? null };
  }
  async listRecoverRequests(limit = 300) {
    const rows = await this.q('SELECT * FROM recover_requests ORDER BY at DESC LIMIT $1', [limit]);
    return rows.map((r) => this._recoverRow(r));
  }
  async recoverRequestByToken(token) {
    return this._recoverRow(await this.one('SELECT * FROM recover_requests WHERE token = $1', [token]));
  }
  async setRecoverRequest(id, { status, igsid = null }, now = Date.now()) {
    const r = await this.q('UPDATE recover_requests SET status = $2, igsid = $3, done_at = $4 WHERE id = $1 RETURNING id', [id, status, igsid, status === 'wait' ? null : now]);
    return r.length === 1;
  }
  async deleteRecoverRequest(id) {
    const r = await this.q('DELETE FROM recover_requests WHERE id = $1 RETURNING id', [id]);
    return r.length === 1;
  }

  // ----- 기기 옮기기 -----
  /** 새 코드 (같은 코드가 살아 있으면 false). 지난 코드는 이때 같이 지움 */
  async putTransfer(code, data, now, expiresAt) {
    await this.q('DELETE FROM transfers WHERE expires_at < $1', [now]);
    const r = await this.q(`INSERT INTO transfers (code, data, expires_at) VALUES ($1, $2::jsonb, $3) ON CONFLICT (code) DO NOTHING RETURNING code`, [
      code,
      JSON.stringify(data),
      expiresAt,
    ]);
    return r.length === 1;
  }
  /** 코드로 꺼내고 바로 지움 (한 번만 쓸 수 있음). 없거나 지났으면 null */
  async takeTransfer(code, now = Date.now()) {
    const r = await this.one('DELETE FROM transfers WHERE code = $1 RETURNING data, expires_at', [code]);
    if (!r || Number(r.expires_at) <= now) return null;
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }

  flush() {}
}
