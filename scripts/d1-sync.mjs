// Neon(Postgres) ⇄ Cloudflare D1 데이터 옮기기·맞춰 보기 (2026-11-21). GitHub Actions 'D1 옮기기' 가 돌림
//
//   node scripts/d1-sync.mjs prepare        D1 'okaystra' 만들기(없으면) · id 출력 · Neon 표마다 줄 수
//   node scripts/d1-sync.mjs copy           D1 에 표 만들고 Neon 전부 복사 → 맞춰 보기(빠진 줄은 따라잡기로 채움) → 안 맞으면 실패
//   node scripts/d1-sync.mjs catchup        (D1 로 바꾼 뒤) 복사 시작 뒤 Neon 에 생긴/바뀐 줄을 D1 에 합침 → 최종 맞춰 보기
//   node scripts/d1-sync.mjs verify         Neon 과 D1 비교 보고만 (아무것도 안 바꿈)
//   node scripts/d1-sync.mjs back           (Neon 으로 되돌린 뒤) D1 로 바꾼 뒤 D1 에 생긴/바뀐 줄을 Neon 에 합침
//   node scripts/d1-sync.mjs backfill       예전 통계(plays·sessions, 15만 줄+)를 그날 남은 D1 쓰기 한도 안에서 조금씩 (매일 Actions 가 돌림)
//
//   ⚠ D1 무료 쓰기 = 하루 10만 줄(색인 포함, UTC 0시 = 한국 9시 초기화) → 통계 두 표는 copy·catchup 에서 빼고 backfill 로 며칠에 나눠 옮김
//
//   환경: CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID · NEON_DATABASE_URL (GitHub 비밀값) · D1_NAME(기본 okaystra)
//   시험: D1_LOCAL=파일.sqlite 면 D1 대신 node:sqlite 파일, NEON_LOCAL=pglite 폴더면 Neon 대신 PGlite
//
//   표마다: cols(열·형 i 정수 r 실수 t 글자 j JSON) · pk · ts(바뀐 시각 SQL, 따라잡기 기준) · merge(따라잡기 때 이미 있으면)
//   전체 복사는 Neon 값이 이김(D1 은 아직 아무도 안 씀), 따라잡기는 '더 높은 점수·더 늦은 시각·빈 칸만 채움' 처럼 둘 다 살림

import { D1_SCHEMA, D1_ALTERS } from '../server/d1store.js';

/** 통계 표 (backfill 로 따로 옮김) */
const MAIN = (list) => list.filter((t) => !t.backfill);

export const TABLES = [
  {
    name: 'settings', cols: { key: 't', value: 't' }, pk: ['key'], ts: null,
    merge: 'NOTHING',
    // d1:* · d1schema:* 는 옮기기 상태 표시(D1 에만 있어야 함) → 두 DB 사이에 주고받지 않음
    //   (11-22 되돌릴 때 d1:switched_at 이 Neon 으로 갔다가 다음 복사 때 D1 로 돌아와 '이미 쓰는 중' 으로 멈췄음)
    only: "key NOT LIKE 'd1:%' AND key NOT LIKE 'd1schema:%'",
  },
  {
    name: 'players', cols: { igsid: 't', username: 't', follow_verified_at: 'i', ig: 't', created_at: 'i', checked_at: 'i', hidden_at: 'i' }, pk: ['igsid'],
    ts: 'COALESCE(created_at, 0) >= $S OR ABS(COALESCE(checked_at, 0)) >= $S OR COALESCE(hidden_at, 0) >= $S',
    merge: `username = COALESCE(players.username, excluded.username), ig = COALESCE(players.ig, excluded.ig),
      created_at = COALESCE(players.created_at, excluded.created_at), checked_at = COALESCE(players.checked_at, excluded.checked_at)`,
  },
  {
    name: 'scores', cols: { igsid: 't', level: 'i', score: 'i', grade: 't', max_combo: 'i', at: 'i', chk: 't' }, pk: ['igsid', 'level'], ts: 'at >= $S',
    merge: 'score = excluded.score, grade = excluded.grade, max_combo = excluded.max_combo, at = excluded.at, chk = excluded.chk WHERE excluded.score > scores.score',
  },
  {
    name: 'season_scores', cols: { season: 'i', igsid: 't', level: 'i', score: 'i', at: 'i' }, pk: ['season', 'igsid', 'level'], ts: 'at >= $S',
    merge: 'score = excluded.score, at = excluded.at WHERE excluded.score > season_scores.score',
  },
  {
    name: 'hall', cols: { season: 'i', board: 't', rank: 'i', igsid: 't', username: 't', score: 'i', n: 'i', rounds: 'i', at: 'i', image: 't' }, pk: ['season', 'board', 'rank'], ts: null,
    merge: 'image = COALESCE(hall.image, excluded.image)', page: 50,
  },
  {
    name: 'maps', cols: { id: 't', igsid: 't', nick: 't', name: 't', bpm: 'r', bars: 'i', diff: 'i', data: 'j', at: 'i', plays: 'i', likes: 'i', reports: 'i', hidden_at: 'i' }, pk: ['id'], ts: null,
    merge: `plays = CASE WHEN excluded.plays > maps.plays THEN excluded.plays ELSE maps.plays END,
      likes = CASE WHEN excluded.likes > maps.likes THEN excluded.likes ELSE maps.likes END,
      reports = CASE WHEN excluded.reports > maps.reports THEN excluded.reports ELSE maps.reports END,
      hidden_at = COALESCE(maps.hidden_at, excluded.hidden_at)`,
    page: 100,
  },
  { name: 'map_votes', cols: { map_id: 't', who: 't', kind: 't' }, pk: ['map_id', 'who', 'kind'], ts: null, merge: 'NOTHING' },
  {
    name: 'map_scores', cols: { map_id: 't', mode: 't', igsid: 't', nick: 't', score: 'i', at: 'i' }, pk: ['map_id', 'mode', 'igsid'], ts: 'at >= $S',
    merge: 'score = excluded.score, nick = excluded.nick, at = excluded.at WHERE excluded.score > map_scores.score',
  },
  {
    // id 는 자동 번호 → 따라잡기 땐 id 빼고 (같은 시각·내용이 없을 때만) 넣음
    name: 'suggestions', cols: { id: 'i', at: 'i', kind: 't', body: 't', nick: 't', vid: 't', done_at: 'i', contact: 't' }, pk: ['id'],
    ts: 'at >= $S OR COALESCE(done_at, 0) >= $S', serial: ['at', 'body'],
  },
  {
    name: 'recover_requests', cols: { id: 'i', token: 't', at: 'i', nick: 't', old_ig: 't', now_ig: 't', memo: 't', status: 't', igsid: 't', done_at: 'i', from_igsid: 't' }, pk: ['id'],
    ts: 'at >= $S OR COALESCE(done_at, 0) >= $S', serial: ['token'],
    serialMerge: `status = excluded.status, igsid = excluded.igsid, done_at = excluded.done_at
      WHERE recover_requests.done_at IS NULL AND excluded.done_at IS NOT NULL`,
  },
  {
    name: 'sessions', cols: { sid: 't', vid: 't', started_at: 'i', last_at: 'i', active_sec: 'i', ref: 't', device: 't' }, pk: ['sid'], ts: 'last_at >= $S',
    merge: `started_at = CASE WHEN excluded.started_at < sessions.started_at THEN excluded.started_at ELSE sessions.started_at END,
      last_at = CASE WHEN excluded.last_at > sessions.last_at THEN excluded.last_at ELSE sessions.last_at END,
      active_sec = CASE WHEN excluded.active_sec > sessions.active_sec THEN excluded.active_sec ELSE sessions.active_sec END`,
    page: 5000, light: true, backfill: 'started_at',
  },
  {
    name: 'plays', cols: { id: 't', sid: 't', vid: 't', level: 't', mode: 't', started_at: 'i', ended_at: 'i', result: 't', score: 'i', stars: 'i', sec: 'i' }, pk: ['id'],
    ts: 'started_at >= $S OR COALESCE(ended_at, 0) >= $S',
    merge: `ended_at = COALESCE(plays.ended_at, excluded.ended_at), result = COALESCE(plays.result, excluded.result), score = COALESCE(plays.score, excluded.score),
      stars = COALESCE(plays.stars, excluded.stars), sec = COALESCE(plays.sec, excluded.sec)`,
    page: 5000, light: true, backfill: 'started_at',
  },
  {
    name: 'ranked', cols: { season: 't', igsid: 't', rating: 'i', games: 'i', at: 'i', data: 'j' }, pk: ['season', 'igsid'], ts: 'at >= $S',
    merge: 'rating = excluded.rating, games = excluded.games, at = excluded.at, data = excluded.data WHERE excluded.at > ranked.at',
  },
  {
    name: 'ranked_runs', cols: { igsid: 't', level: 'i', rating: 'i', at: 'i', data: 'j' }, pk: ['igsid', 'level'], ts: 'at >= $S',
    merge: 'rating = excluded.rating, at = excluded.at, data = excluded.data WHERE excluded.at > ranked_runs.at',
  },
];

// ---------------------------------------------------------------- 값 → SQL 글자
export function lit(v, type) {
  if (v === null || v === undefined) return 'NULL';
  if (type === 'i' || type === 'r') {
    const s = typeof v === 'bigint' ? v.toString() : String(v).trim();
    if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s)) throw new Error(`숫자가 아님: ${s}`);
    if (type === 'i' && !/^-?\d+$/.test(s)) return String(Math.round(Number(s)));
    return s;
  }
  const s = type === 'j' && typeof v !== 'string' ? JSON.stringify(v) : String(v);
  if (s.includes('\u0000')) throw new Error('글자에 NUL');
  return "'" + s.replace(/'/g, "''") + "'";
}

/** 비교용으로 값 하나를 글자로 (Neon 은 BIGINT 를 글자로, jsonb 는 객체로 줌) */
export function norm(v, type) {
  if (v === null || v === undefined) return '∅';
  if (type === 'i' || type === 'r') return String(Number(v));
  if (type === 'j') return typeof v === 'string' ? JSON.stringify(JSON.parse(v)) : JSON.stringify(v);
  return String(v);
}

// ---------------------------------------------------------------- DB 연결
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cloudflare D1 REST (Worker 밖에서 D1 읽고 쓰기) */
export function d1Rest({ token, account, name }) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
  let id = null;
  async function call(url, init = {}) {
    for (let i = 0; ; i++) {
      let res, body;
      try {
        res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
        body = await res.json().catch(() => null);
      } catch (e) {
        if (i < 4) { await sleep(1000 * 2 ** i); continue; }
        throw e;
      }
      if (res.ok && body && body.success) return body.result;
      const msg = JSON.stringify(body && body.errors ? body.errors : body).slice(0, 500);
      if ((res.status === 429 || res.status >= 500) && i < 4) { await sleep(1000 * 2 ** i); continue; }
      throw new Error(`D1 API ${res.status}: ${msg}`);
    }
  }
  return {
    kind: 'd1',
    async find() {
      const list = await call(`${base}?name=${encodeURIComponent(name)}`);
      const db = (list || []).find((d) => d.name === name);
      if (db) id = db.uuid;
      return db || null;
    },
    async create() {
      const db = await call(base, { method: 'POST', body: JSON.stringify({ name, primary_location_hint: 'apac' }) });
      id = db.uuid;
      return db;
    },
    async q(sql) {
      if (!id && !(await this.find())) throw new Error(`D1 '${name}' 없음 — prepare 먼저`);
      const r = await call(`${base}/${id}/query`, { method: 'POST', body: JSON.stringify({ sql }) });
      return (r && r[0] && r[0].results) || [];
    },
  };
}

/** Neon (Postgres) */
export async function neonDb(url) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url, { fullResults: false });
  return { kind: 'pg', q: (text) => sql.query(text, []) };
}

/** 시험용: node:sqlite 파일을 D1 처럼 */
export async function localSqlite(file) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  return {
    kind: 'd1',
    async find() { return { uuid: 'local', name: file }; },
    async create() { return { uuid: 'local', name: file }; },
    async q(sql) {
      const st = db.prepare(sql);
      return st.columns().length ? st.all() : (st.run(), []);
    },
  };
}

/** 시험용: PGlite 를 Neon 처럼 */
export async function localPg(pglite) {
  return { kind: 'pg', q: async (text) => (await pglite.query(text)).rows };
}

// ---------------------------------------------------------------- 읽기 · 쓰기
/** since 뒤에 바뀐 줄만 (ts 가 없는 작은 표는 늘 전부) */
const sinceSql = (t, since) => {
  const conds = [];
  if (t.only) conds.push(`(${t.only})`);
  if (since && t.ts) conds.push(`(${t.ts.replaceAll('$S', String(Math.floor(since)))})`);
  return conds.length ? `WHERE ${conds.join(' AND ')}` : '';
};

/** 표 전부(또는 since 뒤에 바뀐 줄) 읽기 — pk 순서로 나눠서 */
export async function readTable(db, t, { since = 0, cols = Object.keys(t.cols) } = {}) {
  const out = [];
  const page = t.page || 2000;
  const where = sinceSql(t, since);
  const order = t.pk.join(', ');
  for (let off = 0; ; off += page) {
    const rows = await db.q(`SELECT ${cols.join(', ')} FROM ${t.name} ${where} ORDER BY ${order} LIMIT ${page} OFFSET ${off}`);
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

async function countOf(db, t) {
  return Number((await db.q(`SELECT COUNT(*) AS n FROM ${t.name}`))[0].n);
}

/**
 * 줄들을 넣기. mode 'replace' = 있으면 덮어씀(전체 복사) / 'merge' = 표의 merge 규칙(따라잡기)
 *   한 문장 90KB 넘지 않게 여러 줄씩 묶음
 */
export async function writeRows(db, t, rows, mode) {
  if (!rows.length) return 0;
  const serial = mode === 'merge' && t.serial;
  const cols = Object.keys(t.cols).filter((c) => !(serial && c === 'id'));
  const nonPk = cols.filter((c) => !t.pk.includes(c));
  if (serial) {
    // 자동 번호 표: 같은 줄(serial 열이 같은)이 없을 때만 (id 는 받는 쪽이 새로)
    let n = 0;
    for (const r of rows) {
      const vals = cols.map((c) => lit(r[c], t.cols[c]));
      const same = t.serial.map((c) => `${c} = ${lit(r[c], t.cols[c])}`).join(' AND ');
      const conflict = t.serialMerge ? ` ON CONFLICT (${t.serial.join(', ')}) DO UPDATE SET ${t.serialMerge}` : '';
      if (t.serialMerge) await db.q(`INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${vals.join(', ')})${conflict}`);
      else await db.q(`INSERT INTO ${t.name} (${cols.join(', ')}) SELECT ${vals.join(', ')} WHERE NOT EXISTS (SELECT 1 FROM ${t.name} WHERE ${same})`);
      n++;
    }
    return n;
  }
  const conflict =
    mode === 'replace'
      ? nonPk.length ? `DO UPDATE SET ${nonPk.map((c) => `${c} = excluded.${c}`).join(', ')}` : 'DO NOTHING'
      : t.merge === 'NOTHING' || !t.merge ? 'DO NOTHING' : `DO UPDATE SET ${t.merge}`;
  const head = `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES `;
  const tail = ` ON CONFLICT (${t.pk.join(', ')}) ${conflict}`;
  let chunk = [];
  let size = 0;
  let n = 0;
  const flush = async () => {
    if (!chunk.length) return;
    await db.q(head + chunk.join(', ') + tail);
    n += chunk.length;
    chunk = [];
    size = 0;
  };
  for (const r of rows) {
    const v = '(' + cols.map((c) => lit(r[c], t.cols[c])).join(', ') + ')';
    if (chunk.length && (size + v.length > 90_000 || chunk.length >= 500)) await flush();
    chunk.push(v);
    size += v.length;
  }
  await flush();
  return n;
}

/** pk 로 줄 지우기 (200줄씩) */
export async function deleteRows(db, t, rows) {
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    // OR 로 이으면 D1 의 '식 깊이 100' 에 걸림 → (주 키) IN (VALUES …)
    const vals = part.map((r) => '(' + t.pk.map((c) => lit(r[c], t.cols[c])).join(', ') + ')').join(', ');
    await db.q(`DELETE FROM ${t.name} WHERE (${t.pk.join(', ')}) IN (VALUES ${vals})`);
    n += part.length;
  }
  return n;
}

// ---------------------------------------------------------------- 맞춰 보기
const keyOf = (t, r) => t.pk.map((c) => norm(r[c], t.cols[c])).join('\u0001');
const rowOf = (t, r) => Object.keys(t.cols).map((c) => norm(r[c], t.cols[c])).join('\u0001');
const tsOf = (r) => Math.max(0, ...['at', 'created_at', 'checked_at', 'hidden_at', 'last_at', 'started_at', 'ended_at', 'done_at'].map((c) => Math.abs(Number(r[c]) || 0)));

/**
 * src 의 줄이 dst 에 다 있고 같은지. { table, src, dst, missing, diff, extra, lateOnly }
 *   lateOnly = 빠지거나 다른 줄이 전부 `late` 이후에 바뀐 것 (복사 중에 새로 생긴 기록 → 따라잡기로 채워질 것)
 */
export async function compare(src, dst, { late = Infinity, tables = MAIN(TABLES) } = {}) {
  const report = [];
  for (const t of tables) {
    const cols = t.light ? [...t.pk, ...Object.keys(t.cols).filter((c) => /_at$/.test(c))] : Object.keys(t.cols);
    const [a, b] = await Promise.all([readTable(src, t, { cols }), readTable(dst, t, { cols })]);
    const bm = new Map(b.map((r) => [keyOf(t, r), r]));
    const sub = (r) => (t.light ? t.pk.map((c) => norm(r[c], t.cols[c])).join('\u0001') : rowOf(t, r));
    let missing = 0, diff = 0, notLate = 0, missingLate = 0;
    const samples = [];
    const fix = []; // src 에서 다르거나 빠진 줄 (light 표 빼고) → 고쳐 넣기용
    for (const r of a) {
      const k = keyOf(t, r);
      const o = bm.get(k);
      if (!o || sub(o) !== sub(r)) {
        if (!o) missing++;
        else diff++;
        if (!t.light && fix.length < 20000) fix.push(r);
        if (tsOf(r) < late) {
          notLate++;
          if (samples.length < 3) samples.push(t.pk.map((c) => r[c]).join('/'));
        } else if (!o) missingLate++;
      }
      bm.delete(k);
    }
    // dst 에만 있는 줄 (src 에서 지워진 것). settings 의 d1:* 표시는 옮기기용이라 뺌
    const extraRows = [...bm.values()].filter((r) => !(t.name === 'settings' && /^d1(:|schema:)/.test(r.key)));
    report.push({ table: t.name, src: a.length, dst: b.length, missing, diff, extra: bm.size, extraRows, notLate, missingLate, samples, fix });
  }
  return report;
}

export function printReport(title, report) {
  console.log(`\n=== ${title} ===`);
  console.log('표'.padEnd(18) + 'Neon'.padStart(9) + 'D1'.padStart(9) + '  빠짐  다름  D1에만');
  for (const r of report)
    console.log(r.table.padEnd(18) + String(r.src).padStart(9) + String(r.dst).padStart(9) + String(r.missing).padStart(6) + String(r.diff).padStart(6) + String(r.extra).padStart(8) + (r.notLate ? `  ⚠ ${r.notLate} (예: ${r.samples.join(', ')})` : ''));
}

/** secret:session(로그인 쿠키 서명 키)이 같은지 — 값은 안 찍음 */
export async function sameSessionSecret(a, b) {
  const get = async (db) => ((await db.q(`SELECT value FROM settings WHERE key = 'secret:session'`))[0] || {}).value || null;
  const [x, y] = await Promise.all([get(a), get(b)]);
  return { neon: !!x, d1: !!y, same: !!x && x === y };
}

// ---------------------------------------------------------------- 명령
/** WITHOUT ROWID 로 바꾼 표가 예전(보통 표) 모양으로 비어 있으면 지우고 다시 만듦 (11-21 미리 복사 때 만든 빈 표) */
const ROWLESS = ['used_runs', 'sessions', 'plays', 'rooms', 'transfers', 'season_scores', 'hall'];

export async function createSchema(d1) {
  for (const t of ROWLESS) {
    const row = (await d1.q(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${lit(t, 't')}`))[0];
    if (!row || /WITHOUT ROWID/i.test(row.sql)) continue;
    const n = Number((await d1.q(`SELECT COUNT(*) AS n FROM ${t}`))[0].n);
    if (n === 0) await d1.q(`DROP TABLE ${t}`);
    else console.log(`  ⚠ ${t}: 보통 표인데 ${n}줄 있어서 그대로 둠`);
  }
  for (const s of D1_SCHEMA) await d1.q(s);
  // 나중에 더한 열 (이미 미리 복사해 둔 표엔 없음). 이미 있으면 오류 → 넘어감
  for (const a of D1_ALTERS) await d1.q(a).catch(() => {});
}

export async function copyAll(neonDb, d1, { since = 0, mode = 'replace', log = console.log, tables = MAIN(TABLES) } = {}) {
  for (const t of tables) {
    const rows = await readTable(neonDb, t, { since });
    const n = await writeRows(d1, t, rows, mode);
    log(`  ${t.name}: ${n}줄 ${mode === 'replace' ? '복사' : '합침'}`);
  }
}

const setFlag = (db, key, value) => db.q(`INSERT INTO settings (key, value) VALUES (${lit(key, 't')}, ${lit(String(value), 't')}) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
const getFlag = async (db, key) => ((await db.q(`SELECT value FROM settings WHERE key = ${lit(key, 't')}`))[0] || {}).value || null;

/**
 * copy: (처음) 전체 복사 / (미리 복사해 둔 게 있으면) 그 뒤 바뀐 줄만 → 맞춰 보기(다르거나 빠진 줄은 그 줄만 다시 넣음) → 안 맞으면 throw
 *   사이트는 아직 Neon 이라 Neon 값이 이김. 끝나면 d1:copied_at = 이번 시작 시각 (catchup 이 그 뒤부터 따라잡음)
 */
export async function runCopy(neonDb, d1, { log = console.log } = {}) {
  await createSchema(d1);
  // 되돌린 적이 있으면(그 뒤로 D1 을 안 씀) 남은 switched_at 은 옛 표시 → 지움
  const sw = Number(await getFlag(d1, 'd1:switched_at'));
  if (sw && Number(await getFlag(d1, 'd1:rolled_back_at')) > sw) await d1.q(`DELETE FROM settings WHERE key = 'd1:switched_at'`);
  // 예전에 Neon 으로 잘못 넘어간 옮기기 표시 지우기
  await neonDb.q(`DELETE FROM settings WHERE key LIKE 'd1:%' OR key LIKE 'd1schema:%'`);
  if (await getFlag(d1, 'd1:switched_at')) throw new Error('D1 이 이미 쓰이는 중(d1:switched_at 있음) — 전체 복사로 덮으면 D1 기록이 사라짐. catchup 을 쓰세요');
  const start = Date.now() - 60_000;
  const prev = Number(await getFlag(d1, 'd1:copied_at'));
  if (prev) {
    log(`미리 복사해 둔 것 있음 → ${new Date(prev).toISOString()} 뒤 바뀐 줄만`);
    await copyAll(neonDb, d1, { since: prev - 10 * 60_000, log });
  } else {
    log(`전체 복사 시작 (기준 시각 ${new Date(start).toISOString()})`);
    await copyAll(neonDb, d1, { log });
  }
  let report;
  for (let round = 1; round <= 4; round++) {
    const late = Date.now();
    report = await compare(neonDb, d1, { late });
    printReport(`맞춰 보기 ${round}`, report);
    const bad = report.filter((r) => r.missing || r.diff || r.extraRows.length);
    if (!bad.length) break;
    for (const r of bad) {
      const t = TABLES.find((x) => x.name === r.table);
      // 다르거나 빠진 줄만 다시 (복사 중에 바뀐 것, 시각이 안 바뀌는 고침(아이디 변경 등))
      if (r.fix.length) log(`  ${r.table}: ${await writeRows(d1, t, r.fix, 'replace')}줄 다시 넣음`);
      // 미리 복사한 뒤 Neon 에서 지워진 줄(계정 합치기·운영자 삭제 등)은 D1 에서도 지움 — 아직 사이트는 Neon 이라 Neon 이 기준
      if (r.extraRows.length) log(`  ${r.table}: Neon 에서 지워진 ${await deleteRows(d1, t, r.extraRows)}줄 지움`);
    }
  }
  const secret = await sameSessionSecret(neonDb, d1);
  log(`secret:session (로그인 쿠키 키): Neon ${secret.neon ? '있음' : '없음'} · D1 ${secret.d1 ? '있음' : '없음'} · ${secret.same ? '같음 ✅' : '다름 ❌'}`);
  const stuck = report.filter((r) => r.notLate || r.extraRows.length);
  if (!secret.same) throw new Error('secret:session 이 안 맞음 — 바꾸면 모두 로그아웃됨');
  if (stuck.length) throw new Error(`안 맞는 표: ${stuck.map((r) => r.table).join(', ')}`);
  await setFlag(d1, 'd1:copied_at', start);
  log('✅ 복사·맞춰 보기 통과');
  return start;
}

/** catchup: D1 로 바꾼 뒤, 복사 시작 뒤 Neon 에서 생긴/바뀐 줄을 합침 + 최종 보고 */
export async function runCatchup(neonDb, d1, { log = console.log } = {}) {
  const t0 = Number(await getFlag(d1, 'd1:copied_at'));
  if (!t0) throw new Error('d1:copied_at 없음 — copy 먼저');
  if (!(await getFlag(d1, 'd1:switched_at'))) await setFlag(d1, 'd1:switched_at', Date.now());
  log(`따라잡기: ${new Date(t0).toISOString()} 뒤 Neon 기록 → D1`);
  await copyAll(neonDb, d1, { since: t0, mode: 'merge', log });
  const report = await compare(neonDb, d1, { late: t0 });
  printReport('최종 (Neon 의 모든 줄이 D1 에 있어야 함 · 다름 = D1 에서 그 뒤 더 바뀐 것)', report);
  // 복사 시작 뒤 Neon 에 생긴 줄이 D1 에 없으면 따라잡기 실패. 그 전 줄이 없으면 D1 에서 정리(오래 숨긴 참여자 삭제 등)된 것일 수 있어 경고만
  const lost = report.filter((r) => r.missingLate);
  if (lost.length) throw new Error(`D1 에 빠진 새 줄: ${lost.map((r) => `${r.table} ${r.missingLate}`).join(', ')}`);
  const old = report.filter((r) => r.missing - r.missingLate > 0);
  if (old.length) log(`⚠ 복사 전부터 있던 줄 중 D1 에 없는 것: ${old.map((r) => `${r.table} ${r.missing - r.missingLate} (예: ${r.samples.join(', ')})`).join(' / ')} — D1 로 바꾼 뒤 지워진 것인지 확인`);
  const secret = await sameSessionSecret(neonDb, d1);
  log(`secret:session: ${secret.same ? '같음 ✅' : '다름 ❌'}`);
  if (!secret.same) throw new Error('secret:session 다름');
  log('✅ 따라잡기 통과');
}

/** back: Neon 으로 되돌린 뒤, D1 로 바꾼 뒤 D1 에 생긴/바뀐 줄을 Neon 에 합침 */
export async function runBack(neonDb, d1, { log = console.log } = {}) {
  const since = Number(await getFlag(d1, 'd1:switched_at')) || Number(await getFlag(d1, 'd1:copied_at'));
  if (!since) throw new Error('D1 로 바꾼 적 없음');
  log(`되돌리기: ${new Date(since - 120_000).toISOString()} 뒤 D1 기록 → Neon`);
  await copyAll(d1, neonDb, { since: since - 120_000, mode: 'merge', log, tables: TABLES });
  await setFlag(d1, 'd1:rolled_back_at', Date.now());
  // 다시 D1 로 갈 땐 catchup 이 그 뒤 Neon 기록을 가져오게
  await setFlag(d1, 'd1:copied_at', Date.now() - 60_000);
  await d1.q(`DELETE FROM settings WHERE key = 'd1:switched_at'`);
  const report = await compare(d1, neonDb, { tables: TABLES });
  printReport('되돌린 뒤 (D1 의 줄이 Neon 에 있어야 함, 여기선 왼쪽이 D1)', report);
  log('✅ 되돌리기 합치기 끝');
}

/** 오늘(UTC) 이 계정 D1 에 쓴 줄 수 (Cloudflare GraphQL). 못 읽으면 null */
export async function d1WrittenToday({ token, account }) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($a: String!, $d: Date!) { viewer { accounts(filter: { accountTag: $a }) { d1AnalyticsAdaptiveGroups(limit: 100, filter: { date: $d }) { sum { rowsWritten } } } } }`,
        variables: { a: account, d: date },
      }),
    });
    const j = await res.json();
    const groups = j && j.data && j.data.viewer.accounts[0] && j.data.viewer.accounts[0].d1AnalyticsAdaptiveGroups;
    if (!groups) return null;
    return groups.reduce((n, g) => n + Number(g.sum.rowsWritten || 0), 0);
  } catch {
    return null;
  }
}

/**
 * backfill: 예전 통계를 오래된 것부터 budget 줄까지 D1 에 (어디까지 했는지는 D1 settings 'd1:backfill:<표>')
 *   D1 에 같은 줄이 이미 있으면(바꾼 뒤 이어진 접속 등) 합침. 돌려주는 값 = 이번에 넣은 줄 수 · 다 끝났나
 */
export async function runBackfill(neonDb, d1, { budget, log = console.log } = {}) {
  if (!(await getFlag(d1, 'd1:switched_at'))) throw new Error('아직 D1 로 안 바꿈 — migrate 먼저');
  let left = budget;
  let done = true;
  for (const t of TABLES.filter((x) => x.backfill)) {
    const key = 'd1:backfill:' + t.name;
    const pos = JSON.parse((await getFlag(d1, key)) || 'null');
    if (pos && pos.done) continue;
    let ts = pos ? pos.ts : -1;
    let id = pos ? pos.id : '';
    let n = 0;
    const pk = t.pk[0];
    while (left > 0) {
      const lim = Math.min(t.page || 2000, left, neonDb.pageCap || Infinity);
      const rows = await neonDb.q(
        `SELECT ${Object.keys(t.cols).join(', ')} FROM ${t.name}
         WHERE ${t.backfill} > ${Math.floor(ts)} OR (${t.backfill} = ${Math.floor(ts)} AND ${pk} > ${lit(id, 't')})
         ORDER BY ${t.backfill}, ${pk} LIMIT ${lim}`
      );
      if (!rows.length) {
        await setFlag(d1, key, JSON.stringify({ ts, id, done: true }));
        log(`  ${t.name}: 다 옮김 ✅`);
        break;
      }
      await writeRows(d1, t, rows, 'merge');
      const last = rows[rows.length - 1];
      ts = Number(last[t.backfill]);
      id = String(last[pk]);
      n += rows.length;
      left -= rows.length;
      await setFlag(d1, key, JSON.stringify({ ts, id, done: false }));
    }
    const all = await countOf(neonDb, t);
    const before = await neonDb.q(`SELECT COUNT(*) AS n FROM ${t.name} WHERE ${t.backfill} < ${Math.floor(ts)} OR (${t.backfill} = ${Math.floor(ts)} AND ${pk} <= ${lit(id, 't')})`);
    log(`  ${t.name}: 이번에 ${n}줄 · Neon ${all}줄 중 ${Number(before[0].n)}줄까지 옮김 (${new Date(Math.max(0, ts)).toISOString().slice(0, 16)} 까지)`);
    const p = JSON.parse((await getFlag(d1, key)) || 'null');
    if (!p || !p.done) done = false;
  }
  if (done) {
    const rep = await compare(neonDb, d1, { tables: TABLES.filter((x) => x.backfill) });
    printReport('통계 옮기기 끝 — Neon 의 모든 통계 줄이 D1 에 있어야 함', rep);
    const miss = rep.filter((r) => r.missing);
    if (miss.length) throw new Error(`D1 에 빠진 통계 줄: ${miss.map((r) => `${r.table} ${r.missing}`).join(', ')}`);
  }
  return { written: budget - left, done };
}

async function main() {
  const cmd = process.argv[2];
  const env = process.env;
  const d1 = env.D1_LOCAL
    ? await localSqlite(env.D1_LOCAL)
    : d1Rest({ token: env.CLOUDFLARE_API_TOKEN, account: env.CLOUDFLARE_ACCOUNT_ID, name: env.D1_NAME || 'okaystra' });
  const needNeon = cmd !== 'prepare' || env.NEON_DATABASE_URL;
  if (needNeon && !env.NEON_DATABASE_URL) {
    console.error('❌ NEON_DATABASE_URL 이 없음: GitHub 저장소 Settings → Secrets and variables → Actions → New repository secret 에 NEON_DATABASE_URL (Neon 접속 주소) 를 넣어 주세요');
    process.exit(2);
  }
  const neonDbConn = env.NEON_DATABASE_URL ? await neonDb(env.NEON_DATABASE_URL) : null;
  // 11-21 scores.chk(핵 의심 확인용) 추가 — Neon 을 오래 안 깨웠으면 열이 없을 수 있음
  if (neonDbConn) await neonDbConn.q('ALTER TABLE scores ADD COLUMN IF NOT EXISTS chk TEXT');

  if (cmd === 'prepare') {
    let db = await d1.find();
    if (!db) {
      db = await d1.create();
      console.log(`D1 새로 만듦: ${db.name}`);
    }
    console.log(`D1 이름 ${db.name} · database_id ${db.uuid}`);
    if (env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(env.GITHUB_STEP_SUMMARY, `D1 database_id: \`${db.uuid}\`\n`);
    if (neonDbConn) {
      let total = 0;
      console.log('\nNeon 줄 수:');
      for (const t of TABLES) {
        const n = await countOf(neonDbConn, t);
        total += n;
        console.log(`  ${t.name.padEnd(18)} ${n}`);
      }
      console.log(`  합계 ${total} (D1 무료 쓰기 = 하루 10만 줄, 색인도 셈)`);
      // 하루에 새로 생기는 양 (D1 무료 쓰기 한도와 비교)
      const day = Date.now() - 86400000;
      const one = async (sql) => Number((await neonDbConn.q(sql))[0].n);
      console.log('\n지난 24시간:');
      console.log(`  plays 새로 ${await one(`SELECT COUNT(*) AS n FROM plays WHERE started_at >= ${day}`)} · 끝남 ${await one(`SELECT COUNT(*) AS n FROM plays WHERE ended_at >= ${day}`)}`);
      console.log(`  sessions 새로 ${await one(`SELECT COUNT(*) AS n FROM sessions WHERE started_at >= ${day}`)} · 갱신 ${await one(`SELECT COUNT(*) AS n FROM sessions WHERE last_at >= ${day}`)}`);
      console.log(`  scores 바뀜 ${await one(`SELECT COUNT(*) AS n FROM scores WHERE at >= ${day}`)} · players 새로 ${await one(`SELECT COUNT(*) AS n FROM players WHERE created_at >= ${day}`)}`);
      console.log(`  used_runs 지금 ${await one(`SELECT COUNT(*) AS n FROM used_runs`)} · 살아 있는 것 ${await one(`SELECT COUNT(*) AS n FROM used_runs WHERE expires_at >= ${Date.now()}`)}`);
      console.log(`  plays 첫 기록 ${new Date(await one(`SELECT MIN(started_at) AS n FROM plays`)).toISOString()}`);
    }
    return;
  }
  const usage = async (when) => {
    if (env.D1_LOCAL) return null;
    const w = await d1WrittenToday({ token: env.CLOUDFLARE_API_TOKEN, account: env.CLOUDFLARE_ACCOUNT_ID });
    console.log(`D1 오늘(UTC) 쓴 줄 ${when}: ${w == null ? '못 읽음' : w.toLocaleString()} / 100,000`);
    return w;
  };
  if (cmd === 'backfill') {
    if (!(await d1.find()) || !(await getFlag(d1, 'd1:switched_at').catch(() => null))) return void console.log('아직 D1 로 안 바꿈 — 할 일 없음');
    const w = await usage('지금');
    // 하루 한도 10만 중 9만까지만, 남은 시간 실사용 몫(5천)은 남겨 둠. 사용량을 못 읽으면 조심해서 1만 5천
    const cap = Number(env.BACKFILL_MAX || 40000);
    const budget = w == null ? 15000 : Math.max(0, Math.min(cap, 85000 - w));
    console.log(`이번 통계 옮기기 한도: ${budget}줄`);
    if (!budget) return;
    const r = await runBackfill(neonDbConn, d1, { budget });
    console.log(r.done ? '✅ 예전 통계 전부 D1 에 옮김' : `이번에 ${r.written}줄. 남은 건 내일 이어서`);
    await usage('끝난 뒤');
    return;
  }
  if (cmd === 'copy' || cmd === 'catchup') await usage('시작 전');
  if (cmd === 'copy') return void (await runCopy(neonDbConn, d1));
  if (cmd === 'catchup') return void (await runCatchup(neonDbConn, d1));
  if (cmd === 'back') return void (await runBack(neonDbConn, d1));
  if (cmd === 'verify') {
    printReport('Neon → D1 비교', await compare(neonDbConn, d1));
    const s = await sameSessionSecret(neonDbConn, d1);
    console.log(`secret:session: ${s.same ? '같음 ✅' : '다름 ❌'}`);
    return;
  }
  console.error('명령: prepare | copy | catchup | verify | back | backfill');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
}
