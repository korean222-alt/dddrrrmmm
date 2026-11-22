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

let ready = null;
function setup(env) {
  if (!ready) {
    ready = (async () => {
      let store;
      if (useD1(env)) {
        store = await new D1Store(d1Binding(env.DB)).init();
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
      return createHandler(cfg, { store });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function api(request, env) {
  const url = new URL(request.url);
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
};
