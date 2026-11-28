// Postgres 저장소 (Neon). server/store.js(JsonStore)와 같은 메서드 — 전부 Promise
//   q(text, params) → 행 배열. Vercel 에선 Neon HTTP 드라이버, 테스트에선 PGlite(메모리 Postgres)
//   시각(ms)은 BIGINT 라서 드라이버가 문자열/BigInt 로 줄 수 있어 Number() 로 바꿔 씀

import { LAST_LEVEL_ID } from '../public/js/charts.js';
import { TILE_SLOT0, TILE_SLOT_MAX } from '../public/js/tiles.js';
const parseIntro = (v) => {
  if (!v) return null;
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return null;
  }
};

/** 시즌 총합 판마다 더하는 기록 (stage = 드럼 단계, endless = 무제한, tiles = 🎹 피아노 타일 곡들) */
export const boardWhere = (board) => (board === 'endless' ? 's.level <= 0' : board === 'tiles' ? `s.level > ${TILE_SLOT0} AND s.level <= ${TILE_SLOT_MAX}` : `s.level > 0 AND s.level <= ${LAST_LEVEL_ID}`);

/** 🛒 wallet.owned (JSON 글자) → 배열 */
const parseOwned = (v) => {
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** 🎁 wallet.gift (JSON 글자) → 객체 */
const parseGift = (v) => {
  try {
    const g = typeof v === 'string' ? JSON.parse(v) : v;
    return g && typeof g === 'object' ? g : null;
  } catch {
    return null;
  }
};

const SCHEMA = [
  // 🪙 코인 지갑 (2026-11-22): coins 잔액, t = 마지막으로 받은 판 토큰 시각(같은 판 두 번 못 받게), fday·fn = 토큰 없는 코인 하루 한도, init = 폰에 있던 코인 한 번 올림
  `CREATE TABLE IF NOT EXISTS wallet (igsid TEXT PRIMARY KEY, coins BIGINT NOT NULL DEFAULT 0, t BIGINT NOT NULL DEFAULT 0, fday TEXT, fn INTEGER NOT NULL DEFAULT 0, init INTEGER NOT NULL DEFAULT 0)`,
  // tn = 마지막 판 토큰으로 지금까지 받은 코인 (판 도중에 나눠 보내도 한 판 최대를 넘지 않게)
  `ALTER TABLE wallet ADD COLUMN IF NOT EXISTS tn INTEGER NOT NULL DEFAULT 0`,
  // owned = 🛒 상점에서 산 것 JSON 배열 ['bg:city', 'notes:gold' …] (2026-11-22)
  `ALTER TABLE wallet ADD COLUMN IF NOT EXISTS owned TEXT`,
  // gift = 🎁 운영자가 준 코인 알림 JSON { coins, note, hall:{season,board,rank}, at } — 폰이 확인하면 비움 (2026-11-22)
  `ALTER TABLE wallet ADD COLUMN IF NOT EXISTS gift TEXT`,
  // s2 = 🎁 시즌 2 출석·퀘스트 받은 것 JSON { ad 출석한 날, as 연속 일수, qd·qc 그날 받은 퀘스트, cq 받은 커뮤니티 퀘스트 } (2026-11-26)
  `ALTER TABLE wallet ADD COLUMN IF NOT EXISTS s2 TEXT`,
  `CREATE TABLE IF NOT EXISTS players (igsid TEXT PRIMARY KEY, username TEXT, follow_verified_at BIGINT)`,
  // ig = 인스타 아이디(랭킹 참여 때 받음), checked_at = 운영자가 팔로우를 확인한 시각
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS ig TEXT`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at BIGINT`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_at BIGINT`,
  // hidden_at = 운영자가 '팔로우 확인 안 됨'으로 랭킹에서 내린 시각. HIDE_KEEP_MS 뒤 자동 삭제
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS hidden_at BIGINT`,
  // kakao = 🔑 카카오 회원번호의 해시 (2026-11-26 카카오 로그인, 연결한 사람만)
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS kakao TEXT`,
  `CREATE INDEX IF NOT EXISTS players_kakao ON players (kakao) WHERE kakao IS NOT NULL`,
  // google = 🔑 구글 계정 번호의 해시 (2026-11-26 구글 로그인)
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS google TEXT`,
  // av = 🙂 프로필 이미지 id (2026-11-27, public/js/avatars.js)
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS av TEXT`,
  // intro = 📝 자기소개 JSON (2026-11-27)
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS intro TEXT`,
  `CREATE INDEX IF NOT EXISTS players_google ON players (google) WHERE google IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS scores (
     igsid TEXT NOT NULL, level INTEGER NOT NULL, score INTEGER NOT NULL, grade TEXT, max_combo INTEGER,
     at BIGINT NOT NULL, PRIMARY KEY (igsid, level))`,
  `CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at)`,
  `CREATE INDEX IF NOT EXISTS players_ig ON players (ig)`,
  // chk = 핵 의심 확인용 JSON { ms 실제로 친 시간, sd·mean 박자 오차(ms), n 친 수, fake 가짜 입력 수 } (2026-11-21)
  `ALTER TABLE scores ADD COLUMN IF NOT EXISTS chk TEXT`,
  // 단계마다 몇 판 했나 (핵 의심 확인용, 2026-11-22): starts = 판 시작(4단계부터만, 누군지 아는 판), clears = 깨고 점수 올린 판
  `CREATE TABLE IF NOT EXISTS level_tries (igsid TEXT NOT NULL, level INTEGER NOT NULL, starts INTEGER NOT NULL DEFAULT 0, clears INTEGER NOT NULL DEFAULT 0, last_at BIGINT, PRIMARY KEY (igsid, level))`,
  // 무제한 기록(level <= 0)은 '깬 단계 × 10억 + 점수' 라 INTEGER(약 21억)를 넘음 → BIGINT
  `DO $$ BEGIN
     IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'score') = 'integer' THEN
       ALTER TABLE scores ALTER COLUMN score TYPE BIGINT;
     END IF;
   END $$`,
  // 예전 방식(깬 단계 × 100만 + 점수, 999,999 에서 잘림) → 새 방식. 깬 단계는 1 이상이라 새 방식 값은 항상 10억 이상 → 여러 번 돌려도 안전
  `UPDATE scores SET score = (score / 1000000) * 1000000000 + score % 1000000 WHERE level <= 0 AND score < 1000000000`,
  // 예전 방식에서 999,999 로 잘린 무제한 점수 → 깬 단계로 어림한 점수 (2026-11-21 사용자 결정: 대충 예상치로). 어림값은 999,999 가 아니라 한 번만 바뀜
  `UPDATE scores SET score = (score / 1000000000) * 1000000000 + (score / 1000000000) * (52000 + 450 * (score / 1000000000)) WHERE level <= 0 AND score >= 1000000000 AND score % 1000000000 = 999999`,
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
  // 🌍 유저 맵: 음표 데이터(JSON)만. hidden_at = 신고가 쌓여 숨김
  `CREATE TABLE IF NOT EXISTS maps (
     id TEXT PRIMARY KEY, igsid TEXT NOT NULL, nick TEXT, name TEXT NOT NULL, bpm REAL NOT NULL, bars INTEGER NOT NULL, diff INTEGER NOT NULL,
     data JSONB NOT NULL, at BIGINT NOT NULL, plays INTEGER NOT NULL DEFAULT 0, likes INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden_at BIGINT)`,
  `CREATE INDEX IF NOT EXISTS maps_at ON maps (at)`,
  `CREATE INDEX IF NOT EXISTS maps_igsid ON maps (igsid, at)`,
  `CREATE TABLE IF NOT EXISTS map_votes (map_id TEXT NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (map_id, who, kind))`,
  // 🏆 유저 맵 점수: 맵·모드(free 무적 / hearts 하트 5개)·사람마다 최고 점수 하나
  `CREATE TABLE IF NOT EXISTS map_scores (map_id TEXT NOT NULL, mode TEXT NOT NULL, igsid TEXT NOT NULL, nick TEXT, score INTEGER NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (map_id, mode, igsid))`,
  `CREATE INDEX IF NOT EXISTS map_scores_top ON map_scores (map_id, mode, score DESC)`,
  `CREATE TABLE IF NOT EXISTS ranked (season TEXT NOT NULL, igsid TEXT NOT NULL, rating INTEGER NOT NULL, games INTEGER NOT NULL, at BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (season, igsid))`,
  `CREATE INDEX IF NOT EXISTS ranked_top ON ranked (season, rating DESC)`,
  // 🏛 시즌 2 부터의 시즌 기록 (단계·무제한 총합 랭킹용, 시즌마다 사람·단계별 최고점 하나). 시즌 1 은 scores 를 그대로 씀
  `CREATE TABLE IF NOT EXISTS season_scores (season INTEGER NOT NULL, igsid TEXT NOT NULL, level INTEGER NOT NULL, score BIGINT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (season, igsid, level))`,
  // 🏛 명예의 전당: 끝난 시즌의 1·2·3등 (영원히). image = 본인이 올린 프로필 사진(data URL)
  `CREATE TABLE IF NOT EXISTS hall (season INTEGER NOT NULL, board TEXT NOT NULL, rank INTEGER NOT NULL, igsid TEXT NOT NULL, username TEXT, score BIGINT NOT NULL, n INTEGER, rounds INTEGER, at BIGINT NOT NULL, image TEXT, PRIMARY KEY (season, board, rank))`,
  // msg = 명예의 전당 한마디 (2026-11-22)
  `ALTER TABLE hall ADD COLUMN IF NOT EXISTS msg TEXT`,
  `CREATE TABLE IF NOT EXISTS ranked_runs (igsid TEXT NOT NULL, level INTEGER NOT NULL, rating INTEGER NOT NULL, at BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (igsid, level))`,
  // 🗳 투표 (2026-11-23 시즌 2 피아노 미리보기): 한 사람 한 표
  `CREATE TABLE IF NOT EXISTS poll_votes (poll TEXT NOT NULL, igsid TEXT NOT NULL, choice TEXT NOT NULL, at BIGINT NOT NULL, PRIMARY KEY (poll, igsid))`,
  // 📣 광고 노출 통계 (2026-11-27): 날짜·광고·방문자(익명 쿠키)마다 한 줄 — server/adstats.js
  `CREATE TABLE IF NOT EXISTS ad_vday (day TEXT NOT NULL, ad TEXT NOT NULL, vid TEXT NOT NULL, shows INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, sec INTEGER NOT NULL DEFAULT 0, s_drum INTEGER NOT NULL DEFAULT 0, s_tile INTEGER NOT NULL DEFAULT 0, at BIGINT NOT NULL, PRIMARY KEY (day, ad, vid))`,
];

/** init 에서 도는 옛 기록 옮기기 목록 — 새로 추가하면 여기에도 이름을 붙임 (SCHEMA_FLAG 가 바뀌어 다시 돎) */
const MIGRATIONS = ['remove-instagram-v1', 'insert-level-8-v1', 'repair-shifted-levels', 'reset-level-19-v1', 'reset-level-18-v1', 'reset-level-18-v2'];
/** 🎄 데크 더 홀즈(19)를 합창 녹음 곡으로 바꾼 배포 시각: 그 전 점수(옛 채보)만 랭킹에서 지움 */
export const DECK_RESET_BEFORE = Date.parse('2026-11-19T07:13:00Z');
/** 18단계 = 엘리제를 위하여 (2026-11-21). 그 전 18번 점수는 하루 들어갔다 뺀 찬송가 것 → 한 번 지움 */
export const ELISE_FROM = Date.parse('2026-11-21T06:15:00Z');
/** 표·옮기기 내용이 바뀌면 달라지는 표시 이름 (짧은 해시) */
const SCHEMA_FLAG = (() => {
  let h = 2166136261;
  for (const ch of SCHEMA.join('\n') + '|' + MIGRATIONS.join(',')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 'schema:' + h.toString(36);
})();

/** SCHEMA 전부를 DO 블록 하나로 (문장마다 다른 $s0$ 따옴표로 감싸 EXECUTE → 안쪽의 DO $$ … $$ 도 그대로 됨) */
export function schemaBlock() {
  return `DO $schema$ BEGIN\n${SCHEMA.map((s, i) => `EXECUTE $s${i}$${s}$s${i}$;`).join('\n')}\nEND $schema$`;
}

// 이용 통계는 1년 보관
const STATS_KEEP_MS = 400 * 24 * 3600 * 1000;

/** 랭킹에서 내린 참여자를 이만큼 뒤에 지움 (그 사이 다시 들어와 아이디를 넣으면 살아남) */
export const HIDE_KEEP_MS = 5 * 24 * 3600 * 1000;

/** scores.chk(JSON 글) → 객체 (없거나 깨졌으면 null) */
export const parseChk = (s) => {
  if (!s) return null;
  try {
    return typeof s === 'string' ? JSON.parse(s) : s;
  } catch {
    return null;
  }
};

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
    // ⚠ Cloudflare 무료는 요청 하나당 바깥 연결(=Neon 쿼리) 50번까지 → 표 만들기를 한 문장(DO 블록)으로 묶어 1번에 보냄
    //   (하나씩 보내면 40번 넘게 왕복 → 표를 하나만 더 늘려도 배포 직후 서버가 계속 실패할 수 있었음)
    await this.q(schemaBlock());
    await this.removeInstagramData();
    await this.shiftLevelsV2();
    await this.repairShiftedLevels();
    await this.resetDeckRanking();
    await this.resetLevel18();
    await this.resetEliseRanking();
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

  /** 18단계가 엘리제를 위하여로 생겨서, 그 전 18번(빼 버린 찬송가) 점수·단계별 무제한 칸(-18)을 한 번 지움 */
  async resetLevel18() {
    const FLAG = 'migration:reset-level-18-v1';
    const got = await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key', [FLAG, String(Date.now())]);
    if (!got.length) return;
    await this.q('DELETE FROM scores WHERE level IN (18, -18) AND at < $1', [ELISE_FROM]);
    console.log('[store] 18단계 옛 점수(찬송가) 지움');
  }

  /** 18단계 엘리제 랭킹 초기화 (2026-11-21 운영자 요청, 채보를 어렵게 바꾼 뒤): 18·-18 점수 전부 한 번 지움 */
  async resetEliseRanking() {
    const FLAG = 'migration:reset-level-18-v2';
    const got = await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key', [FLAG, String(Date.now())]);
    if (!got.length) return;
    await this.q('DELETE FROM scores WHERE level IN (18, -18)');
    console.log('[store] 18단계 엘리제 랭킹 초기화');
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
  /** 아직 없을 때만 적음 → 처음 적은 쪽만 true (시즌 보상 한 번만) */
  async claimSetting(key, value) {
    const rows = await this.q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key', ['set:' + key, String(value)]);
    return rows.length > 0;
  }

  // ----- 🪙 코인 지갑 -----
  async getWallet(igsid) {
    const r = await this.one('SELECT coins, t, tn, fday, fn, init, owned, gift, s2 FROM wallet WHERE igsid = $1', [igsid]);
    return r ? { coins: num(r.coins), t: num(r.t), tn: num(r.tn) || 0, fday: r.fday || '', fn: num(r.fn), init: num(r.init), owned: parseOwned(r.owned), gift: parseGift(r.gift), s2: parseGift(r.s2) } : null;
  }
  /** 🎁 운영자가 코인 주기: 잔액에 바로 더하고(한 줄, 덮어쓰기 없이) 알림(gift)을 적음 */
  async giveCoins(igsid, coins, gift) {
    await this.q(
      `INSERT INTO wallet (igsid, coins, gift) VALUES ($1, $2, $3) ON CONFLICT (igsid) DO UPDATE SET coins = wallet.coins + EXCLUDED.coins, gift = COALESCE(EXCLUDED.gift, wallet.gift)`,
      [igsid, coins, gift ? JSON.stringify(gift) : null]
    );
  }
  /** 🏆 여러 사람에게 한꺼번에 (시즌 보상). D1 은 쿼리당 값 100개까지라 30명씩 */
  async giveCoinsMany(list) {
    for (let i = 0; i < list.length; i += 30) {
      const part = list.slice(i, i + 30);
      const params = [];
      const vals = part.map((r) => {
        params.push(r.igsid, r.coins, r.gift ? JSON.stringify(r.gift) : null);
        const k = params.length;
        return `($${k - 2}, $${k - 1}, $${k})`;
      });
      await this.q(
        `INSERT INTO wallet (igsid, coins, gift) VALUES ${vals.join(', ')} ON CONFLICT (igsid) DO UPDATE SET coins = wallet.coins + EXCLUDED.coins, gift = EXCLUDED.gift`,
        params
      );
    }
  }
  /** 🎁 알림 지우기 (폰이 봤음) */
  async clearGift(igsid) {
    await this.q('UPDATE wallet SET gift = NULL WHERE igsid = $1', [igsid]);
  }
  async putWallet(igsid, w) {
    await this.q(
      `INSERT INTO wallet (igsid, coins, t, tn, fday, fn, init, owned, s2) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (igsid) DO UPDATE SET coins = EXCLUDED.coins, t = EXCLUDED.t, tn = EXCLUDED.tn, fday = EXCLUDED.fday, fn = EXCLUDED.fn, init = EXCLUDED.init, owned = EXCLUDED.owned, s2 = COALESCE(EXCLUDED.s2, wallet.s2)`,
      [igsid, w.coins, w.t || 0, w.tn || 0, w.fday || '', w.fn || 0, w.init || 0, w.owned && w.owned.length ? JSON.stringify(w.owned) : null, w.s2 ? JSON.stringify(w.s2) : null]
    );
  }

  // ----- players -----
  async getPlayer(igsid) {
    const r = await this.one('SELECT * FROM players WHERE igsid = $1', [igsid]);
    return r ? { igsid: r.igsid, username: r.username, ig: r.ig || null, hiddenAt: num(r.hidden_at) ?? null, checkedAt: num(r.checked_at) ?? null, kakao: !!r.kakao, google: !!r.google, av: r.av || null, intro: parseIntro(r.intro), createdAt: num(r.created_at) ?? null } : null;
  }
  /** 📝 자기소개 (null = 지우기) */
  async setIntro(igsid, intro) {
    await this.q('UPDATE players SET intro = $2 WHERE igsid = $1', [igsid, intro ? JSON.stringify(intro) : null]);
  }
  async upsertPlayer(igsid, patch) {
    // 인스타 아이디가 바뀌면 운영자가 팔로우를 다시 확인해야 함 (checked_at 비움)
    await this.q(
      `INSERT INTO players (igsid, username, ig, created_at, av) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (igsid) DO UPDATE SET username = COALESCE(EXCLUDED.username, players.username), av = COALESCE(EXCLUDED.av, players.av),
         checked_at = CASE WHEN EXCLUDED.ig IS NOT NULL AND (EXCLUDED.ig IS DISTINCT FROM players.ig OR players.hidden_at IS NOT NULL) THEN NULL ELSE players.checked_at END,
         hidden_at = CASE WHEN EXCLUDED.ig IS NOT NULL THEN NULL ELSE players.hidden_at END,
         ig = COALESCE(EXCLUDED.ig, players.ig)`,
      [igsid, patch.username ?? null, patch.ig ?? null, Date.now(), patch.av ?? null]
    );
    return this.getPlayer(igsid);
  }
  /** 관리자용 참여자 목록 (확인 안 한 사람 먼저, 최근 가입 순) */
  /** limit: 기본은 제한 없음(2026-11-21 사용자 요청, 1000명 넘어 사람이 안 보였음)(예전 계정은 목록 맨 뒤라 잘리면 못 찾음) */
  async listPlayers(limit = 1_000_000) {
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.ig, p.created_at, p.checked_at, p.hidden_at,
         COALESCE(SUM(s.score) FILTER (WHERE s.level > 0 AND s.level < 3000), 0) AS total, COUNT(s.level) FILTER (WHERE s.level > 0 AND s.level < 3000) AS levels,
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
    await this.q('DELETE FROM level_tries WHERE igsid = $1', [igsid]);
    await this.q('DELETE FROM season_scores WHERE igsid = $1', [igsid]);
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
  /**
   * 다 쓴 줄 지우기 (DB 왕복 1번): 지난 판 토큰(used_runs, 전엔 안 지워서 판마다 쌓였음)·끝난 방·지난 옮기기 코드·1년 넘은 이용 통계
   *   Neon 무료 저장 용량 아끼기. 접속(/api/me) 때 가끔(purgeMaybe)
   */
  async cleanup(now = Date.now()) {
    const old = now - STATS_KEEP_MS;
    await this.q(
      `WITH a AS (DELETE FROM used_runs WHERE expires_at < $1),
         b AS (DELETE FROM rooms WHERE expires_at < $1),
         c AS (DELETE FROM transfers WHERE expires_at < $1),
         d AS (DELETE FROM plays WHERE started_at < $2)
       DELETE FROM sessions WHERE started_at < $2`,
      [now, old]
    );
  }
  async setChecked(igsid, on) {
    // 확인함 = 숨김도 풀림. on === 'temp' 는 암호 없이 받은 임시 인증 → 음수 시각으로 표시
    const v = on === 'temp' ? -Date.now() : on ? Date.now() : null;
    const r = await this.q('UPDATE players SET checked_at = $2, hidden_at = CASE WHEN $2::BIGINT IS NULL THEN hidden_at ELSE NULL END WHERE igsid = $1 RETURNING igsid', [igsid, v]);
    return r.length === 1;
  }
  /** 임시 인증 기간이 끝남 → 임시 인증(음수)만 풀기 */
  async expireTempChecks() {
    const r = await this.q('UPDATE players SET checked_at = NULL WHERE checked_at < 0 RETURNING igsid', []);
    return r.length;
  }
  /** 최고점이면 바꿈. DB 왕복 1번 (참여자 확인 + 예전 점수 + 저장을 한 문장으로) */
  async recordScore(igsid, level, entry) {
    const r = await this.one(
      `WITH pl AS (SELECT 1 FROM players WHERE igsid = $1),
         prev AS (SELECT score FROM scores WHERE igsid = $1 AND level = $2),
         up AS (
           INSERT INTO scores (igsid, level, score, grade, max_combo, at, chk)
           SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM pl)
           ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
             max_combo = EXCLUDED.max_combo, at = EXCLUDED.at, chk = EXCLUDED.chk WHERE EXCLUDED.score > scores.score
           RETURNING score)
       SELECT EXISTS (SELECT 1 FROM pl) AS ok, (SELECT score FROM prev) AS prev, (SELECT score FROM up) AS up`,
      [igsid, level, entry.score, entry.grade ?? null, entry.maxCombo ?? 0, entry.at ?? Date.now(), entry.chk ?? null]
    );
    if (!r || !r.ok) return null;
    const improved = r.up != null;
    return { improved, best: improved ? entry.score : Number(r.prev) };
  }
  async leaderboard(level, limit = 50) {
    const rows = await this.q(
      `SELECT s.igsid, p.username, p.av, s.score, s.grade, s.at FROM scores s JOIN players p ON p.igsid = s.igsid
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

  // ---------- 🏛 시즌 총합 랭킹 · 명예의 전당 ----------
  async recordSeasonScore(season, igsid, level, score, now = Date.now()) {
    await this.q(
      `INSERT INTO season_scores (season, igsid, level, score, at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (season, igsid, level) DO UPDATE SET score = EXCLUDED.score, at = EXCLUDED.at WHERE EXCLUDED.score > season_scores.score`,
      [season, igsid, level, score, now]
    );
  }
  /** 시즌 총합 순위 SQL (board: stage = 단계 최고점 합, endless = 무제한 점수 합) */
  _seasonSql(season, board) {
    const src = Number(season) === 1 ? 'scores' : `(SELECT igsid, level, score, at FROM season_scores WHERE season = ${Math.floor(Number(season)) || 0})`;
    const sum = board === 'endless' ? 'SUM(s.score % 1000000000)' : 'SUM(s.score)';
    const rounds = board === 'endless' ? 'SUM(s.score / 1000000000)' : '0';
    const where = boardWhere(board);
    // 사람별로 먼저 모은 뒤 players 와 합침 (D1 읽는 줄 줄이기, 2026-11-22)
    return `SELECT x.*, ROW_NUMBER() OVER (ORDER BY x.score DESC, x.at ASC) AS rank FROM (
        SELECT t.igsid, p.username, t.score, t.n, t.rounds, t.at FROM (
          SELECT s.igsid, ${sum} AS score, COUNT(*) AS n, ${rounds} AS rounds, MAX(s.at) AS at
          FROM ${src} s WHERE ${where} GROUP BY s.igsid) t
        JOIN players p ON p.igsid = t.igsid
        WHERE p.username IS NOT NULL AND p.hidden_at IS NULL AND p.checked_at IS NOT NULL) x`;
  }
  /** 내 시즌 총합만 (내 기록 줄만 읽음). 랭킹에 안 보이는 사람이면 null */
  async seasonMine(season, board, igsid) {
    const sum = board === 'endless' ? 'SUM(s.score % 1000000000)' : 'SUM(s.score)';
    const rounds = board === 'endless' ? 'SUM(s.score / 1000000000)' : '0';
    const where = boardWhere(board);
    const r =
      Number(season) === 1
        ? await this.one(`SELECT ${sum} AS score, COUNT(*) AS n, ${rounds} AS rounds, MAX(s.at) AS at FROM scores s WHERE s.igsid = $1 AND ${where}`, [igsid])
        : await this.one(`SELECT ${sum} AS score, COUNT(*) AS n, ${rounds} AS rounds, MAX(s.at) AS at FROM season_scores s WHERE s.season = $2 AND s.igsid = $1 AND ${where}`, [igsid, Math.floor(Number(season)) || 0]);
    if (!r || r.score == null) return null;
    const p = await this.getPlayer(igsid);
    if (!p || !p.username || p.hiddenAt || !p.checkedAt) return null;
    return { igsid, username: p.username, score: Number(r.score), n: Number(r.n), rounds: Number(r.rounds), at: Number(r.at) };
  }
  /** 👥 친구 카드 (2026-11-28): 프로필 + 그 시즌 타일 총합을 쿼리 1번으로 (사람마다 자기 타일 기록 줄만 읽음) */
  async friendCards(season, ids) {
    ids = [...new Set(ids)].slice(0, 50);
    if (!ids.length) return [];
    const ph = ids.map((_, i) => `$${i + 1}`).join(',');
    const n = Math.floor(Number(season)) || 0;
    const src = n === 1 ? `(SELECT igsid, level, score, at FROM scores WHERE igsid IN (${ph}))` : `(SELECT igsid, level, score, at FROM season_scores WHERE season = ${n} AND igsid IN (${ph}))`;
    const rows = await this.q(
      `SELECT p.igsid, p.username, p.av, p.intro, p.hidden_at, t.score, t.n, t.at FROM players p
       LEFT JOIN (SELECT s.igsid, SUM(s.score) AS score, COUNT(*) AS n, MAX(s.at) AS at FROM ${src} s WHERE ${boardWhere('tiles')} GROUP BY s.igsid) t ON t.igsid = p.igsid
       WHERE p.igsid IN (${ph})`,
      ids
    );
    return rows
      .filter((r) => r.username && r.hidden_at == null)
      .map((r) => ({ igsid: r.igsid, username: r.username, av: r.av || null, intro: parseIntro(r.intro), score: Number(r.score) || 0, n: Number(r.n) || 0, at: Number(r.at) || 0 }));
  }
  _seasonRow(r) {
    return { igsid: r.igsid, username: r.username, score: Number(r.score), n: Number(r.n), rounds: Number(r.rounds), at: Number(r.at), rank: Number(r.rank) };
  }
  async seasonBoard(season, board, limit = 50) {
    const rows = await this.q(`${this._seasonSql(season, board)} ORDER BY rank LIMIT $1`, [limit]);
    return { rows: rows.map((r) => this._seasonRow(r)) };
  }
  async seasonRankOf(season, board, igsid) {
    const r = await this.one(`SELECT * FROM (${this._seasonSql(season, board)}) y WHERE y.igsid = $1`, [igsid]);
    return r ? this._seasonRow(r) : null;
  }
  async hallList() {
    const rows = await this.q('SELECT * FROM hall ORDER BY season DESC, board, rank');
    return rows.map((r) => ({ season: Number(r.season), board: r.board, rank: Number(r.rank), igsid: r.igsid, username: r.username, score: Number(r.score), n: num(r.n), rounds: num(r.rounds), at: Number(r.at), image: r.image || null, msg: r.msg || null }));
  }
  /** 끝난 시즌의 1·2·3등 넣기 (이미 있으면 그대로) */
  async hallInsert(rows) {
    for (const r of rows)
      await this.q(
        `INSERT INTO hall (season, board, rank, igsid, username, score, n, rounds, at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (season, board, rank) DO NOTHING`,
        [r.season, r.board, r.rank, r.igsid, r.username, r.score, r.n ?? null, r.rounds ?? null, r.at]
      );
  }
  /** 💬 한마디 (null = 지우기). igsid 를 주면 본인 것만 */
  /** 🗳 한 표 넣기 / 바꾸기 (2026-11-23 사용자: 표 바꿀 수 있게). { added, changed, prev, choice } */
  async pollVote(poll, igsid, choice, at = Date.now()) {
    const old = await this.q('SELECT choice FROM poll_votes WHERE poll = $1 AND igsid = $2', [poll, igsid]);
    if (!old.length) {
      await this.q('INSERT INTO poll_votes (poll, igsid, choice, at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [poll, igsid, choice, at]);
      return { added: true, changed: false, prev: null, choice };
    }
    const prev = old[0].choice;
    if (prev === choice) return { added: false, changed: false, prev, choice };
    await this.q('UPDATE poll_votes SET choice = $3, at = $4 WHERE poll = $1 AND igsid = $2', [poll, igsid, choice, at]);
    return { added: false, changed: true, prev, choice };
  }
  /** 🗳 표 수 { 선택: 수 } */
  async pollCounts(poll) {
    const rows = await this.q('SELECT choice, COUNT(*) AS n FROM poll_votes WHERE poll = $1 GROUP BY choice', [poll]);
    const out = {};
    for (const r of rows) out[r.choice] = Number(r.n);
    return out;
  }
  async hallSetMsg(season, board, rank, msg, igsid = null) {
    const rows = await this.q(
      `UPDATE hall SET msg = $4 WHERE season = $1 AND board = $2 AND rank = $3 ${igsid ? 'AND igsid = $5' : ''} RETURNING rank`,
      igsid ? [season, board, rank, msg, igsid] : [season, board, rank, msg]
    );
    return rows.length > 0;
  }
  /** 프로필 사진 (null = 지우기). igsid 를 주면 본인 것만 */
  async hallSetImage(season, board, rank, image, igsid = null) {
    const rows = await this.q(
      `UPDATE hall SET image = $4 WHERE season = $1 AND board = $2 AND rank = $3 ${igsid ? 'AND igsid = $5' : ''} RETURNING rank`,
      igsid ? [season, board, rank, image, igsid] : [season, board, rank, image]
    );
    return rows.length > 0;
  }

  // ----- 🔑 카카오 로그인 (2026-11-26) -----
  async playerByKakao(kid) {
    const r = await this.one('SELECT igsid FROM players WHERE kakao = $1 AND username IS NOT NULL LIMIT 1', [kid]);
    return r ? r.igsid : null;
  }
  async kakaoOf(igsid) {
    const r = await this.one('SELECT kakao FROM players WHERE igsid = $1', [igsid]);
    return r ? r.kakao || null : null;
  }
  async setKakao(igsid, kid) {
    await this.q('UPDATE players SET kakao = $2 WHERE igsid = $1', [igsid, kid]);
  }
  // 🔑 구글 로그인 (2026-11-26) — 카카오와 같음
  async playerByGoogle(gid) {
    const r = await this.one('SELECT igsid FROM players WHERE google = $1 AND username IS NOT NULL LIMIT 1', [gid]);
    return r ? r.igsid : null;
  }
  async googleOf(igsid) {
    const r = await this.one('SELECT google FROM players WHERE igsid = $1', [igsid]);
    return r ? r.google || null : null;
  }
  async setGoogle(igsid, gid) {
    await this.q('UPDATE players SET google = $2 WHERE igsid = $1', [igsid, gid]);
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
  /** 핵 의심 분석용: 모든 단계 최고 기록 (쿼리 한 번) */
  async allScores() {
    const rows = await this.q('SELECT igsid, level, score, grade, max_combo, at, chk FROM scores WHERE level > 0');
    return rows.map((r) => ({ igsid: r.igsid, level: Number(r.level), score: Number(r.score), grade: r.grade || null, maxCombo: Number(r.max_combo) || 0, at: Number(r.at) || 0, chk: parseChk(r.chk) }));
  }
  /** 판 수 세기: 시작 starts·깸 clears 만큼 더함 (DB 왕복 1번) */
  async addTry(igsid, level, starts, clears, now = Date.now()) {
    await this.q(
      `INSERT INTO level_tries (igsid, level, starts, clears, last_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (igsid, level) DO UPDATE SET starts = level_tries.starts + EXCLUDED.starts, clears = level_tries.clears + EXCLUDED.clears, last_at = EXCLUDED.last_at`,
      [igsid, level, starts, clears, now]
    );
  }
  async triesOf(igsid) {
    const rows = await this.q('SELECT level, starts, clears, last_at FROM level_tries WHERE igsid = $1', [igsid]);
    return rows.map((r) => ({ level: Number(r.level), starts: Number(r.starts), clears: Number(r.clears), at: Number(r.last_at) || 0 }));
  }
  async scoresOf(igsid) {
    const rows = await this.q('SELECT level, score, grade, max_combo FROM scores WHERE igsid = $1', [igsid]);
    return rows.map((r) => ({ level: Number(r.level), score: Number(r.score), grade: r.grade || null, maxCombo: Number(r.max_combo) || 0 }));
  }

  /** 게스트 기록을 인증된 플레이어로 옮김 (단계별 더 높은 점수만 남김) */
  async moveScores(from, to) {
    if (from === to) return;
    await this.q(
      `INSERT INTO scores (igsid, level, score, grade, max_combo, at, chk)
       SELECT $2, level, score, grade, max_combo, at, chk FROM scores WHERE igsid = $1
       ON CONFLICT (igsid, level) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
         max_combo = EXCLUDED.max_combo, at = EXCLUDED.at, chk = EXCLUDED.chk WHERE EXCLUDED.score > scores.score`,
      [from, to]
    );
    await this.q('DELETE FROM scores WHERE igsid = $1', [from]);
    await this.q(
      `INSERT INTO level_tries (igsid, level, starts, clears, last_at) SELECT $2, level, starts, clears, last_at FROM level_tries WHERE igsid = $1
       ON CONFLICT (igsid, level) DO UPDATE SET starts = level_tries.starts + EXCLUDED.starts, clears = level_tries.clears + EXCLUDED.clears`,
      [from, to]
    );
    await this.q('DELETE FROM level_tries WHERE igsid = $1', [from]);
    await this.q(
      `INSERT INTO season_scores (season, igsid, level, score, at)
       SELECT season, $2, level, score, at FROM season_scores WHERE igsid = $1
       ON CONFLICT (season, igsid, level) DO UPDATE SET score = EXCLUDED.score, at = EXCLUDED.at WHERE EXCLUDED.score > season_scores.score`,
      [from, to]
    );
    await this.q('DELETE FROM season_scores WHERE igsid = $1', [from]);
  }

  // ----- 판 토큰 1회용 처리 -----
  /** 이 판 토큰이 이미 쓰였나 (읽기만) */
  async runUsed(nonce) {
    return !!(await this.one('SELECT 1 AS ok FROM used_runs WHERE nonce = $1', [nonce]));
  }
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
  // ----- 📣 광고 노출 통계 (server/adstats.js) -----
  /** 한 방문자의 하루치 광고 숫자를 더함. rows = [{ad, shows, done, closed, clicks, sec, drum, tile}] (광고마다 한 줄 → 쓰기 1번) */
  async trackAds({ vid, day, rows, now = Date.now() }) {
    if (!rows || !rows.length) return;
    // 한 사람이 하루에 만들 수 있는 양에 상한 (이상한 반복 요청이 숫자를 부풀리지 못하게)
    const CAP = { shows: 300, done: 300, closed: 300, clicks: 300, sec: 36000, s_drum: 300, s_tile: 300 };
    const vals = [];
    const params = [];
    for (const r of rows) {
      const row = [day, r.ad, vid, r.shows, r.done, r.closed, r.clicks, r.sec, r.drum, r.tile, now];
      vals.push('(' + row.map((_, i) => `$${params.length + i + 1}`).join(', ') + ')');
      params.push(...row);
    }
    const add = (c) => `${c} = CASE WHEN ad_vday.${c} + EXCLUDED.${c} > ${CAP[c]} THEN ${CAP[c]} ELSE ad_vday.${c} + EXCLUDED.${c} END`;
    await this.q(
      `INSERT INTO ad_vday (day, ad, vid, shows, done, closed, clicks, sec, s_drum, s_tile, at) VALUES ${vals.join(', ')}
       ON CONFLICT (day, ad, vid) DO UPDATE SET ${Object.keys(CAP).map(add).join(', ')}, at = EXCLUDED.at`,
      params
    );
  }
  /**
   * day(YYYY-MM-DD) fromDay~toDay 의 광고 원본: 날짜·광고별 합계(byDay) + 광고·방문자별 합계(byViewer)
   *   표를 두 번 훑음 (기간 줄만) — handler 가 10분 이상 기억해 둠
   */
  async adStats(fromDay, toDay) {
    const [byDay, byViewer] = await Promise.all([
      this.q(
        `SELECT day, ad, COUNT(*) AS viewers, SUM(shows) AS shows, SUM(done) AS done, SUM(closed) AS closed, SUM(clicks) AS clicks, SUM(sec) AS sec, SUM(s_drum) AS drum, SUM(s_tile) AS tile
         FROM ad_vday WHERE day >= $1 AND day <= $2 GROUP BY day, ad`,
        [fromDay, toDay]
      ),
      this.q(
        `SELECT ad, vid, SUM(shows) AS shows, SUM(done) AS done, SUM(closed) AS closed, SUM(clicks) AS clicks, COUNT(*) AS days
         FROM ad_vday WHERE day >= $1 AND day <= $2 GROUP BY ad, vid`,
        [fromDay, toDay]
      ),
    ]);
    const num = (v) => Number(v) || 0;
    return {
      byDay: byDay.map((r) => ({ day: r.day, ad: r.ad, viewers: num(r.viewers), shows: num(r.shows), done: num(r.done), closed: num(r.closed), clicks: num(r.clicks), sec: num(r.sec), drum: num(r.drum), tile: num(r.tile) })),
      byViewer: byViewer.map((r) => ({ ad: r.ad, vid: r.vid, shows: num(r.shows), done: num(r.done), closed: num(r.closed), clicks: num(r.clicks), days: num(r.days) })),
    };
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

  // ----- 🌍 유저 맵 -----
  async addMap({ id, igsid, nick, name, bpm, bars, diff, data, at }) {
    const r = await this.q(
      `INSERT INTO maps (id, igsid, nick, name, bpm, bars, diff, data, at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, igsid, nick ?? null, name, bpm, bars, diff, JSON.stringify(data), at]
    );
    return r.length === 1;
  }
  async countMapsBy(igsid, since) {
    const r = await this.one('SELECT COUNT(*) AS n FROM maps WHERE igsid = $1 AND at >= $2', [igsid, since]);
    return Number(r.n);
  }
  _mapRow(r) {
    return { id: r.id, igsid: r.igsid, nick: r.nick, name: r.name, bpm: Number(r.bpm), bars: Number(r.bars), diff: Number(r.diff), at: Number(r.at), plays: Number(r.plays), likes: Number(r.likes) };
  }
  async listMaps(sort = 'new', limit = 60) {
    // 인기 = 좋아요 → 최근 (친 횟수는 판마다 바뀌어 색인에 넣으면 D1 쓰기가 늘어서 뺌, 2026-11-22)
    const order = sort === 'top' ? 'likes DESC, at DESC' : 'at DESC';
    const rows = await this.q(`SELECT id, igsid, nick, name, bpm, bars, diff, at, plays, likes FROM maps WHERE hidden_at IS NULL ORDER BY ${order} LIMIT $1`, [limit]);
    return rows.map((r) => this._mapRow(r));
  }
  async getMap(id, { play = false } = {}) {
    const r = play
      ? await this.one('UPDATE maps SET plays = plays + 1 WHERE id = $1 AND hidden_at IS NULL RETURNING *', [id])
      : await this.one('SELECT * FROM maps WHERE id = $1 AND hidden_at IS NULL', [id]);
    if (!r) return null;
    return { ...this._mapRow(r), data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data };
  }
  async voteMap(id, who, kind, on, now = Date.now(), hideAt = 3) {
    if (!(await this.one('SELECT id FROM maps WHERE id = $1 AND hidden_at IS NULL', [id]))) return null;
    if (on) await this.q('INSERT INTO map_votes (map_id, who, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, who, kind]);
    else await this.q('DELETE FROM map_votes WHERE map_id = $1 AND who = $2 AND kind = $3', [id, who, kind]);
    const col = kind === 'like' ? 'likes' : 'reports';
    const r = await this.one(
      `UPDATE maps SET ${col} = (SELECT COUNT(*) FROM map_votes WHERE map_id = $1 AND kind = $2)${kind === 'report' ? ', hidden_at = CASE WHEN (SELECT COUNT(*) FROM map_votes WHERE map_id = $1 AND kind = $2) >= $3 THEN $4::bigint ELSE hidden_at END' : ''} WHERE id = $1 RETURNING likes, hidden_at`,
      kind === 'report' ? [id, kind, hideAt, now] : [id, kind]
    );
    return { likes: Number(r.likes), hidden: r.hidden_at != null };
  }
  async deleteMap(id, igsid) {
    const r = await this.q('DELETE FROM maps WHERE id = $1 AND igsid = $2 RETURNING id', [id, igsid]);
    if (r.length) {
      await this.q('DELETE FROM map_votes WHERE map_id = $1', [id]);
      await this.q('DELETE FROM map_scores WHERE map_id = $1', [id]);
    }
    return r.length === 1;
  }
  /** 🏆 맵 점수: 그 사람의 그 모드 최고 점수보다 높을 때만 바꿈 */
  async addMapScore(id, igsid, nick, mode, score, now = Date.now()) {
    if (!(await this.one('SELECT id FROM maps WHERE id = $1 AND hidden_at IS NULL', [id]))) return null;
    const r = await this.q(
      `INSERT INTO map_scores (map_id, mode, igsid, nick, score, at) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (map_id, mode, igsid) DO UPDATE SET score = EXCLUDED.score, nick = EXCLUDED.nick, at = EXCLUDED.at WHERE map_scores.score < EXCLUDED.score
       RETURNING score`,
      [id, mode, igsid, nick ?? null, score, now]
    );
    return { best: r.length === 1 };
  }
  /** 모드별 1~n등 */
  async topMapScores(id, n = 3) {
    // 모드마다 색인(map_scores_top)으로 위 n 줄만 읽음 (예전 ROW_NUMBER 는 그 맵 기록을 전부 읽었음, 2026-11-22)
    const part = (mode, a) =>
      `SELECT mode, nick, score, at FROM (SELECT mode, nick, score, at FROM map_scores WHERE map_id = $1 AND mode = '${mode}' ORDER BY score DESC, at ASC LIMIT $2) ${a}`;
    const rows = await this.q(`${part('free', 'f')} UNION ALL ${part('hearts', 'h')} UNION ALL ${part('tiles', 't')} UNION ALL ${part('tfree', 'tf')}`, [id, n]);
    const out = { free: [], hearts: [], tiles: [], tfree: [] };
    rows.sort((a, b) => Number(b.score) - Number(a.score) || Number(a.at) - Number(b.at));
    for (const r of rows) if (out[r.mode]) out[r.mode].push({ nick: r.nick, score: Number(r.score) });
    return out;
  }

  // ----- 🏆 랭킹전 -----
  _json(v) {
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  async getRanked(igsid, season) {
    const r = await this.one('SELECT data FROM ranked WHERE season = $1 AND igsid = $2', [season, igsid]);
    return r ? this._json(r.data) : null;
  }
  async putRanked(row) {
    await this.q(
      `INSERT INTO ranked (season, igsid, rating, games, at, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (season, igsid) DO UPDATE SET rating = EXCLUDED.rating, games = EXCLUDED.games, at = EXCLUDED.at, data = EXCLUDED.data`,
      [row.season, row.igsid, row.rating, row.games, row.at, JSON.stringify(row)]
    );
  }
  async topRanked(season, n = 20) {
    const rows = await this.q('SELECT data FROM ranked WHERE season = $1 AND games > 0 ORDER BY rating DESC, at ASC LIMIT $2', [season, n]);
    return rows.map((r) => this._json(r.data));
  }
  async putRankedRun(run) {
    await this.q(
      `INSERT INTO ranked_runs (igsid, level, rating, at, data) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (igsid, level) DO UPDATE SET rating = EXCLUDED.rating, at = EXCLUDED.at, data = EXCLUDED.data`,
      [run.igsid, run.level, run.rating, run.at, JSON.stringify(run)]
    );
  }
  async pickRankedRuns(notIgsid, rating, levels, since, n = 8) {
    const rows = await this.q(
      'SELECT data FROM ranked_runs WHERE igsid <> $1 AND level IN (SELECT (jsonb_array_elements_text($2::jsonb))::int) AND at >= $3 ORDER BY ABS(rating - $4::int) ASC, at DESC LIMIT $5',
      [notIgsid, JSON.stringify(levels), since, rating, n]
    );
    return rows.map((r) => this._json(r.data));
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
