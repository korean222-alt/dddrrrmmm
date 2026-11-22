// Cloudflare Worker (드럼 전용 Cloudflare 계정, 2026-11-18 Vercel 무료 한도 초과로 옮김)
//   - 게임 화면 파일(public/)은 Workers 정적 파일로 바로 나감 → 무료 · 요청 수 무제한 (이 코드를 안 거침)
//   - /api/* 만 이 코드로 와서 server/handler.js 처리 (Vercel 함수 api/server.js 와 같은 일)
//   - DB = Cloudflare D1(env.DB, 2026-11-21 Neon 에서 옮김) 또는 Neon Postgres(DATABASE_URL)
//     어느 쪽을 쓸지는 비밀값 DB_MODE: 'd1' 이면 D1, 없거나 'neon' 이면 Neon → 되돌리기 = DB_MODE 를 neon 으로 (배포 필요 없음)
//     (옮기기·되돌리기는 GitHub Actions 'D1 옮기기' 가 함. tasks/D1-옮기기.md)
//     비밀값 STATS_DB=neon 이면 D1 모드에서도 판·접속 통계만 Neon 에 씀 (예전 통계 옮기기가 끝날 때까지, 끝나면 Actions 가 d1 로)
//   - 비밀값(DATABASE_URL · ADMIN_TOKEN · FOLLOW_PASSWORD · SUGGEST_BOT_TOKEN · DB_MODE)은
//     Cloudflare 대시보드 → Workers → play → 설정 → 변수 및 비밀 에 넣음 (코드·저장소에 안 씀)
//   SESSION_SECRET 은 안 넣어도 됨 (DB settings 의 secret:session 을 같이 씀 — D1 로 옮길 때 같이 옮김)

import { neon } from '@neondatabase/serverless';
import { makeConfig } from '../server/settings.js';
import { createHandler } from '../server/handler.js';
import { PgStore } from '../server/pgstore.js';
import { D1Store, d1Binding } from '../server/d1store.js';
import { backupSave, backupFlush } from '../server/offbackup.js';

const DEFAULTS = {
  NODE_ENV: 'production',
  INSTAGRAM_HANDLE: 'ok_aystra',
  GATE_MODE: 'soft',
};

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const dbUrl = (env) => env.DATABASE_URL || env.POSTGRES_URL || '';
const useD1 = (env) => String(env.DB_MODE || '').trim().toLowerCase() === 'd1';
/** DB 가 연결돼 있나. D1 쪽인데 바인딩이 없으면 Neon 으로 몰래 넘어가지 않고 '없음' (두 DB 에 나뉘어 쓰이는 것 막기) */
const hasDb = (env) => (useD1(env) ? !!env.DB : !!dbUrl(env));

const neonStore = (env) => {
  const sql = neon(dbUrl(env));
  return new PgStore((text, params = []) => sql.query(text, params));
};

// 🧯 한도 브레이크용: 이 인스턴스가 읽은·쓴 D1 줄 수와 요청 수 (handler 가 몇 분마다 usage_day 에 합침)
const meter = { r: 0, w: 0, q: 0 };
let ready = null;
function setup(env) {
  if (!ready) {
    ready = (async () => {
      let store;
      if (useD1(env)) {
        store = await new D1Store(d1Binding(env.DB, meter)).init();
        // 옛 Vercel 다리(Neon)에서 만든 '기록 옮기기' 코드는 Neon 에 있음 → D1 에 없으면 Neon 에서 한 번 더 찾음
        if (dbUrl(env)) {
          const take = store.takeTransfer.bind(store);
          let neonOld = null;
          store.takeTransfer = async (code, now) => {
            const t = await take(code, now);
            if (t) return t;
            try {
              return await (neonOld ||= neonStore(env)).takeTransfer(code, now);
            } catch (e) {
              console.error('[api] Neon 옮기기 코드 찾기 실패', e);
              return null;
            }
          };
        }
        // 통계(판·접속)를 잠시 Neon 에 쓰기 (비밀값 STATS_DB=neon): D1 하루 쓰기 한도 아끼기 — 예전 통계 옮기기(backfill)가
        //   끝날 때까지. Neon 에 쌓인 건 backfill 이 이어서 D1 로 가져감. Neon 이 안 되면 D1 에 씀 (안 잃게)
        if (dbUrl(env) && String(env.STATS_DB || '').trim().toLowerCase() === 'neon') {
          store.statsSampled = false; // Neon 통계 표엔 표본 무게 열이 없음 → 다 적음
          let neonStats = null;
          const stats = () => (neonStats ||= neonStore(env));
          for (const m of ['trackSession', 'trackPlays']) {
            const d1 = store[m].bind(store);
            store[m] = async (arg) => {
              try {
                return await stats()[m](arg);
              } catch (e) {
                console.error('[api] Neon 통계 쓰기 실패 → D1 에', e);
                return d1(arg);
              }
            };
          }
        }
      } else {
        store = await neonStore(env).init();
      }
      const vars = { ...DEFAULTS };
      for (const [k, v] of Object.entries(env)) if (typeof v === 'string' && v !== '') vars[k] = v;
      const cfg = makeConfig(vars);
      if (!cfg.sessionSecret) cfg.sessionSecret = await store.secret('session');
      return createHandler(cfg, { store, meter: useD1(env) ? meter : null });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

// 📴 서버 보관함 (server/offbackup.js): D1 이 막혀도 Neon 에 기록을 맡김 → D1 을 안 거치고 바로 처리
let neonSecret = null;
const bkHits = new Map();
async function offlineSave(request, env) {
  const h = { 'Cache-Control': 'no-store', ...SECURITY_HEADERS };
  if (request.method !== 'POST' || !dbUrl(env)) return Response.json({ error: 'no_backup' }, { status: 503, headers: h });
  const ip = request.headers.get('cf-connecting-ip') || '?';
  const now = Date.now();
  const hit = bkHits.get(ip);
  if (hit && now - hit.t < 10 * 60 * 1000 && hit.n >= 40) return Response.json({ error: 'rate_limited' }, { status: 429, headers: h });
  bkHits.set(ip, hit && now - hit.t < 10 * 60 * 1000 ? { t: hit.t, n: hit.n + 1 } : { t: now, n: 1 });
  if (bkHits.size > 5000) bkHits.clear();
  try {
    const raw = await request.text();
    if (raw.length > 32 * 1024) return Response.json({ error: 'too_large' }, { status: 413, headers: h });
    const sql = neon(dbUrl(env));
    const pg = (text, params = []) => sql.query(text, params);
    // 쿠키 서명 열쇠: D1 로 옮길 때 Neon 의 것을 그대로 가져감 → Neon 에서 읽음 (새로 만들지 않음)
    if (!neonSecret) neonSecret = env.SESSION_SECRET || ((await pg("SELECT value FROM settings WHERE key = 'secret:session'"))[0] || {}).value || null;
    if (!neonSecret) return Response.json({ error: 'no_backup' }, { status: 503, headers: h });
    const out = await backupSave({ pg, secret: neonSecret, cookieHeader: request.headers.get('cookie'), body: raw ? JSON.parse(raw) : {}, now });
    return Response.json(out.body, { status: out.status, headers: h });
  } catch (e) {
    console.error('[api] 서버 보관함 실패', e);
    return Response.json({ error: 'backup_failed' }, { status: 503, headers: h });
  }
}

// 📴 서버(D1) 가 쉬는 동안 보여 줄 랭킹 (2026-11-22): Neon 에 남은 D1 이사 전(11-22 09:49 KST) 랭킹을 그대로
//   /api/snap/leaderboard?level= · /api/snap/hall?board= · /api/snap/maps?sort= · /api/snap/maps/<id> → Neon 저장소로 만든 handler 에 /api/leaderboard·/api/hall 로 넘김
//   쿠키 빼고(내 줄 없음) 인스턴스 메모리 10분 + 폰 캐시 → Neon 을 덜 깨움
let snapReady = null;
let snapAt = null;
const snapMemo = new Map();
async function snapshot(request, env, url) {
  const h = { 'Cache-Control': 'public, max-age=600', ...SECURITY_HEADERS };
  if (request.method !== 'GET' || !dbUrl(env)) return Response.json({ error: 'no_snapshot' }, { status: 503, headers: SECURITY_HEADERS });
  // caches.default 는 workers.dev 주소에선 아무 일도 안 함(Cloudflare 문서, 11-22 확인) → 인스턴스 메모리에 10분
  const k = url.pathname + url.search;
  const m = snapMemo.get(k);
  if (m && m.exp > Date.now()) return Response.json(m.body, { headers: h });
  try {
    const store = neonStore(env);
    snapReady ||= (async () => {
      const vars = { ...DEFAULTS };
      for (const [k, v] of Object.entries(env)) if (typeof v === 'string' && v !== '') vars[k] = v;
      const cfg = makeConfig(vars);
      if (!cfg.sessionSecret) cfg.sessionSecret = ((await store.q("SELECT value FROM settings WHERE key = 'secret:session'"))[0] || {}).value || 'x';
      return createHandler(cfg, { store });
    })().catch((e) => {
      snapReady = null;
      throw e;
    });
    const handle = await snapReady;
    if (snapAt == null) snapAt = Number(((await store.q('SELECT MAX(at) AS t FROM scores'))[0] || {}).t) || 0;
    const inner = new URL(url);
    inner.pathname = url.pathname.replace('/api/snap/', '/api/');
    inner.searchParams.delete('play'); // 맵 받기: 친 횟수 올리기(쓰기) 안 함, 1~3등은 같이
    if (/^\/api\/maps\/./.test(inner.pathname)) inner.searchParams.set('top', '1');
    const res = await handle(new Request(inner.toString(), { method: 'GET' }), { ip: request.headers.get('cf-connecting-ip') || '?' });
    if (!res.ok) {
      const why = await res.text().catch(() => '');
      console.error('[api] 쉬는 동안 보기 실패', inner.pathname, res.status, why.slice(0, 200));
      return Response.json({ error: 'no_snapshot', status: res.status, why: why.slice(0, 200) }, { status: 503, headers: SECURITY_HEADERS });
    }
    const body = { ...(await res.json()), snap: { at: snapAt } };
    if (snapMemo.size > 500) snapMemo.clear();
    snapMemo.set(k, { exp: Date.now() + 10 * 60 * 1000, body });
    return Response.json(body, { headers: h });
  } catch (e) {
    console.error('[api] 쉬는 동안 랭킹 실패', e);
    return Response.json({ error: 'no_snapshot' }, { status: 503, headers: SECURITY_HEADERS });
  }
}

async function api(request, env) {
  const url = new URL(request.url);
  if (/^\/api\/snap\/(leaderboard|hall|maps|maps\/[A-Za-z0-9]{7})$/.test(url.pathname)) {
    meter.q++;
    return snapshot(request, env, url);
  }
  if (url.pathname === '/api/offline-save') {
    meter.q++;
    return offlineSave(request, env);
  }
  const db = hasDb(env);
  // DB 가 연결 안 됐으면 '서버 없음' → 사이트는 서버 없는 모드로 돎
  if (url.pathname === '/api/health' && !(db && url.searchParams.get('boot') === '1')) {
    return Response.json(db ? { ok: true, app: 'okaystra', db: useD1(env) ? 'd1' : 'neon' } : { ok: false, error: 'db_not_connected' }, {
      status: db ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
    });
  }
  if (!db) return Response.json({ error: 'db_not_connected' }, { status: 503, headers: SECURITY_HEADERS });
  try {
    const handle = await setup(env);
    const res = await handle(request, { ip: request.headers.get('cf-connecting-ip') || '?' });
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    return out;
  } catch (e) {
    console.error('[api] 준비 실패', e);
    // 관리자 화면 로그인은 되게: 비밀번호가 맞으면 'DB 쉬는 중'만 알려 줌 (DB 안 씀)
    if (url.pathname === '/api/admin/usage') {
      const t = request.headers.get('x-admin-token') || '';
      const ok = !!env.ADMIN_TOKEN && t.length === env.ADMIN_TOKEN.length && t === env.ADMIN_TOKEN;
      return Response.json(ok ? { dbDown: true, metered: true } : { error: 'admin_required' }, { status: ok ? 200 : 401, headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS } });
    }
    // 준비(DB 첫 확인)에서 실패 = 거의 DB 문제(D1 하루 한도 등) → 폰이 서버 없는 모드로 가게 db_down
    return Response.json({ error: 'db_down' }, { status: 503, headers: SECURITY_HEADERS });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env);
    return env.ASSETS.fetch(request);
  },
  // 📴 서버 보관함 → D1 랭킹 (wrangler.jsonc triggers: D1 한도가 풀리는 한국 오전 9시부터 3시간, 10분마다)
  async scheduled(event, env, ctx) {
    if (!useD1(env) || !env.DB || !dbUrl(env)) return;
    const sql = neon(dbUrl(env));
    const pg = (text, params = []) => sql.query(text, params);
    ctx.waitUntil(
      backupFlush({ pg, d1: new D1Store(d1Binding(env.DB, meter)) })
        .then((r) => r.moved + r.dropped && console.log('[cron] 서버 보관함 → D1', r))
        .catch((e) => console.error('[cron] 서버 보관함 옮기기 실패 (다음 예약 때 다시)', e))
    );
  },
};
