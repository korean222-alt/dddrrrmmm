// Vercel 함수: /api/* 와 /webhook 을 처리 (vercel.json 의 rewrites 가 여기로 보냄)
//   DB = Neon Postgres. Vercel 대시보드 → Storage 에서 Neon 을 이 프로젝트에 연결하면
//   DATABASE_URL 환경변수가 자동으로 생겨요. 없으면 /api/health 가 503 → 사이트는 서버 없는 모드로 돌아감
//
//   기본 설정은 아래 DEFAULTS. Vercel 환경변수로 같은 이름을 넣으면 그 값이 우선.
//   비밀값(Vercel → Settings → Environment Variables, Sensitive 로):
//     IG_ACCESS_TOKEN  인스타 장기 토큰 / IG_APP_SECRET  웹훅 서명 검증용 앱 시크릿
//   SESSION_SECRET 은 안 넣어도 됨 (DB 에 처음 한 번 자동 생성)

import { neon } from '@neondatabase/serverless';
import { makeConfig } from '../server/settings.js';
import { createHandler } from '../server/handler.js';
import { createInstagram } from '../server/instagram.js';
import { PgStore } from '../server/pgstore.js';

const DEFAULTS = {
  NODE_ENV: 'production',
  INSTAGRAM_HANDLE: 'ok_aystra',
  // 사업자등록 없이 운영: 4단계부터 '팔로우하러 가기' 누르면 열림(soft),
  // 랭킹 인스타 아이디는 DM 코드를 운영자가 /admin.html 에서 직접 승인(manual)
  GATE_MODE: 'soft',
  GATE_FROM_LEVEL: '4',
  FOLLOW_CHECK_MODE: 'manual',
  // 수동 승인이라 코드는 3일 동안 유효
  CODE_TTL_MIN: '4320',
  ALLOW_DEV_SIMULATE: 'false',
  // Meta 웹훅 등록할 때 '확인 토큰' 칸에 이 값을 그대로
  IG_VERIFY_TOKEN: 'okaystra-Apkm9hqeZCdQ',
  IG_SEND_REPLIES: 'true',
  // 연결 테스트 동안 웹훅 원문을 로그로 (Vercel → Logs). 다 되면 'false'
  IG_DEBUG: 'true',
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
      return { store, handle: createHandler(cfg, { store, ig: createInstagram(cfg) }) };
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
