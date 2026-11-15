// Vercel 함수: /api/* 를 처리 (vercel.json 의 rewrites 가 여기로 보냄)
//   DB = Neon Postgres. Vercel 대시보드 → Storage 에서 Neon 을 이 프로젝트에 연결하면
//   DATABASE_URL 환경변수가 자동으로 생겨요. 없으면 /api/health 가 503 → 사이트는 서버 없는 모드로 돌아감
//
//   기본 설정은 아래 DEFAULTS. Vercel 환경변수로 같은 이름을 넣으면 그 값이 우선.
//   ADMIN_TOKEN 은 /admin.html (이용 통계) 비밀번호 (Sensitive 로). SESSION_SECRET 은 안 넣어도 됨 (DB 에 처음 한 번 자동 생성)

import { neon } from '@neondatabase/serverless';
import { makeConfig } from '../server/settings.js';
import { createHandler } from '../server/handler.js';
import { PgStore } from '../server/pgstore.js';

const DEFAULTS = {
  NODE_ENV: 'production',
  INSTAGRAM_HANDLE: 'ok_aystra',
  // 4단계부터 '팔로우하러 가기' 누르면 열림 (진짜 확인은 아님)
  GATE_MODE: 'soft',
};

const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let ready = null;
function setup() {
  if (!ready) {
    ready = (async () => {
      const sql = neon(dbUrl());
      const store = await new PgStore((text, params = []) => sql.query(text, params)).init();
      const env = { ...DEFAULTS };
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') env[k] = v;
      const cfg = makeConfig(env);
      if (!cfg.sessionSecret) cfg.sessionSecret = await store.secret('session');
      return { store, handle: createHandler(cfg, { store }) };
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

async function handle(request) {
  const url = new URL(request.url);
  // DB 가 연결 안 됐으면 '서버 없음'으로 알려서 사이트가 서버 없는 모드로 돌게
  if (url.pathname === '/api/health') {
    return Response.json(dbUrl() ? { ok: true, app: 'okaystra' } : { ok: false, error: 'db_not_connected' }, {
      status: dbUrl() ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', ...SECURITY_HEADERS },
    });
  }
  if (!dbUrl()) return Response.json({ error: 'db_not_connected' }, { status: 503, headers: SECURITY_HEADERS });
  try {
    const { handle } = await setup();
    const res = await handle(request, { ip: request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '?' });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    return res;
  } catch (e) {
    console.error('[api] 준비 실패', e);
    return Response.json({ error: 'server_error' }, { status: 500, headers: SECURITY_HEADERS });
  }
}

export const GET = handle;
export const POST = handle;
