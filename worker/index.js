// Cloudflare Worker (드럼 전용 Cloudflare 계정, 2026-11-18 Vercel 무료 한도 초과로 옮김)
//   - 게임 화면 파일(public/)은 Workers 정적 파일로 바로 나감 → 무료 · 요청 수 무제한 (이 코드를 안 거침)
//   - /api/* 만 이 코드로 와서 server/handler.js 처리 (Vercel 함수 api/server.js 와 같은 일)
//   - DB = Neon Postgres. 비밀값(DATABASE_URL · ADMIN_TOKEN · FOLLOW_PASSWORD · SUGGEST_BOT_TOKEN)은
//     Cloudflare 대시보드 → Workers → play → 설정 → 변수 및 비밀 에 넣음 (코드·저장소에 안 씀)
//   SESSION_SECRET 은 안 넣어도 됨 (DB 에 처음 한 번 자동 생성된 값을 같이 씀)

import { neon } from '@neondatabase/serverless';
import { makeConfig } from '../server/settings.js';
import { createHandler } from '../server/handler.js';
import { PgStore } from '../server/pgstore.js';

const DEFAULTS = {
  NODE_ENV: 'production',
  INSTAGRAM_HANDLE: 'ok_aystra',
  GATE_MODE: 'soft',
};

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const dbUrl = (env) => env.DATABASE_URL || env.POSTGRES_URL || '';

let ready = null;
function setup(env) {
  if (!ready) {
    ready = (async () => {
      const sql = neon(dbUrl(env));
      const store = await new PgStore((text, params = []) => sql.query(text, params)).init();
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
  const db = dbUrl(env);
  // DB 가 연결 안 됐으면 '서버 없음' → 사이트는 서버 없는 모드로 돎
  if (url.pathname === '/api/health' && !(db && url.searchParams.get('boot') === '1')) {
    return Response.json(db ? { ok: true, app: 'okaystra' } : { ok: false, error: 'db_not_connected' }, {
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
    return Response.json({ error: 'server_error' }, { status: 500, headers: SECURITY_HEADERS });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
