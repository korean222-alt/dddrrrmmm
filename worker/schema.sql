-- 오케이스트라 D1(SQLite) 테이블. 워커가 처음 뜰 때 자동으로 만들고(IF NOT EXISTS), 직접 돌려도 됨
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  igsid TEXT,
  username TEXT,
  verified_at INTEGER,
  last_error TEXT,
  last_error_at INTEGER
);
CREATE TABLE IF NOT EXISTS players (
  igsid TEXT PRIMARY KEY,
  username TEXT,
  follow_verified_at INTEGER
);
CREATE TABLE IF NOT EXISTS scores (
  igsid TEXT NOT NULL,
  level INTEGER NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT,
  max_combo INTEGER,
  at INTEGER NOT NULL,
  PRIMARY KEY (igsid, level)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, score DESC, at);
CREATE TABLE IF NOT EXISTS used_runs (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
