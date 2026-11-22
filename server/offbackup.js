// 📴 서버 보관함 (2026-11-22, D1 하루 읽기 한도가 차서 랭킹이 안 올라가던 날 · 사용자 요청 '기록 확실하게 저장')
//   D1 이 막혀 있을 때 폰이 서버 없는 모드에서 친 최고 기록을 Neon 표 offline_backup 에 바로 맡김 (폰에도 그대로 남김)
//   → D1 이 다시 열리면(한국 오전 9시) Worker 예약 작업(wrangler.jsonc triggers)이 D1 랭킹으로 옮기고 Neon 에서 지움
//   폰도 서버가 돌아오면 자기 몫을 /api/runs·/api/scores 에 얹어 올리므로 두 길 — 최고점만 남아서 두 번 들어가도 같음
//   ⚠ 예약 작업 한 번에 D1 쿼리 50개까지(무료) → FLUSH_MAX 줄씩
import { unsign, parseCookies } from './session.js';
import { validateOffline } from './handler.js';
import { seasonAt } from '../public/js/season.js';

export const SAVE_MAX = 20;
export const FLUSH_MAX = 40;
const DROP_MS = 7 * 24 * 3600 * 1000; // D1 에 계정이 없어서 못 옮긴 건 7일 뒤 버림

const TABLE = `CREATE TABLE IF NOT EXISTS offline_backup (
  igsid TEXT NOT NULL, slot INTEGER NOT NULL, score BIGINT NOT NULL, rec TEXT NOT NULL, saved_at BIGINT NOT NULL,
  PRIMARY KEY (igsid, slot))`;
let tableReady = false;
async function ensureTable(pg) {
  if (tableReady) return;
  await pg(TABLE, []);
  tableReady = true;
}

/**
 * 맡기기: 쿠키(서명)로 누군지 확인 → 기록 검사(판 토큰 없는 검사 그대로) → Neon 에 단계마다 최고점만
 * @returns {{status:number, body:object}}
 */
export async function backupSave({ pg, secret, cookieHeader, body, now = Date.now() }) {
  const p = unsign(parseCookies(cookieHeader)['kk_player'], secret);
  if (!p || !p.igsid) return { status: 401, body: { error: 'no_player' } };
  const list = Array.isArray(body && body.records) ? body.records.slice(0, SAVE_MAX) : [];
  const rows = new Map();
  for (const e of list) {
    const v = validateOffline(e, { sessionSecret: secret, minRunRatio: 0 }, now);
    if (!v.ok) continue;
    const prev = rows.get(v.slot);
    if (!prev || v.score > prev.score) rows.set(v.slot, v);
  }
  if (!rows.size) return { status: 200, body: { ok: true, saved: [] } };
  await ensureTable(pg);
  const vals = [];
  const params = [];
  for (const v of rows.values()) {
    const i = params.length;
    vals.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`);
    params.push(p.igsid, v.slot, v.score, JSON.stringify({ grade: v.grade, maxCombo: v.maxCombo, chk: v.chk, at: v.at, endless: !!v.endless }), now);
  }
  await pg(
    `INSERT INTO offline_backup (igsid, slot, score, rec, saved_at) VALUES ${vals.join(', ')}
     ON CONFLICT (igsid, slot) DO UPDATE SET score = EXCLUDED.score, rec = EXCLUDED.rec, saved_at = EXCLUDED.saved_at
     WHERE EXCLUDED.score > offline_backup.score`,
    params
  );
  return { status: 200, body: { ok: true, saved: [...rows.values()].map((v) => v.key) } };
}

/**
 * 옮기기: Neon 보관함 → D1 랭킹 (D1 이 막혀 있으면 오류 → 그대로 두고 다음 예약 때)
 *   d1 = D1Store (batch 한 번 = 한 트랜잭션). 옮긴 줄은 그 점수 이하일 때만 지움 (그 사이 더 좋은 게 들어왔으면 남김)
 * @returns {{moved:number, dropped:number, left:boolean}}
 */
export async function backupFlush({ pg, d1, now = Date.now() }) {
  await ensureTable(pg);
  const rows = await pg('SELECT igsid, slot, score, rec, saved_at FROM offline_backup ORDER BY saved_at LIMIT $1', [FLUSH_MAX]);
  if (!rows.length) return { moved: 0, dropped: 0, left: false };
  const recs = rows.map((r) => ({ ...r, slot: Number(r.slot), score: Number(r.score), saved_at: Number(r.saved_at), rec: JSON.parse(r.rec) }));
  // 계정이 D1 에 있나 (한 번에)
  const ids = [...new Set(recs.map((r) => r.igsid))];
  const have = new Set((await d1.q(`SELECT igsid FROM players WHERE igsid IN (${ids.map((_, i) => '$' + (i + 1)).join(', ')})`, ids)).map((r) => r.igsid));
  const stmts = [];
  const done = [];
  let dropped = 0;
  // 같은 사람 같은 칸 여러 줄은 없음(주 키) — 한 번에 넣음
  for (const r of recs) {
    if (!have.has(r.igsid)) {
      if (now - r.saved_at > DROP_MS) {
        done.push(r);
        dropped++;
      }
      continue;
    }
    stmts.push([
      `INSERT INTO scores (igsid, level, score, grade, max_combo, at, chk) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (igsid, level) DO UPDATE SET score = excluded.score, grade = excluded.grade,
         max_combo = excluded.max_combo, at = excluded.at, chk = excluded.chk WHERE excluded.score > scores.score`,
      [r.igsid, r.slot, r.score, r.rec.grade ?? null, r.rec.maxCombo ?? 0, r.rec.at, r.rec.chk ?? null],
    ]);
    const sn = seasonAt(r.rec.at).n;
    if (sn > 1 && sn === seasonAt(now).n) {
      stmts.push([
        `INSERT INTO season_scores (season, igsid, level, score, at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (season, igsid, level) DO UPDATE SET score = excluded.score, at = excluded.at WHERE excluded.score > season_scores.score`,
        [sn, r.igsid, r.slot, r.score, r.rec.at],
      ]);
    }
    done.push(r);
  }
  if (stmts.length) await d1.batch(stmts);
  if (done.length) {
    const ps = done.flatMap((r) => [r.igsid, r.slot, r.score]);
    const vs = done.map((_, i) => `($${i * 3 + 1}::text, $${i * 3 + 2}::int, $${i * 3 + 3}::bigint)`).join(', ');
    await pg(`DELETE FROM offline_backup o USING (VALUES ${vs}) AS d(igsid, slot, score) WHERE o.igsid = d.igsid AND o.slot = d.slot AND o.score <= d.score`, ps);
  }
  return { moved: done.length - dropped, dropped, left: rows.length >= FLUSH_MAX };
}
