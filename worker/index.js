// Cloudflare Worker: 게임 사이트(public/ 정적 파일) + /api + /webhook(인스타 DM 인증)
//   정적 파일은 Workers 정적 자산(ASSETS)이 바로 내보내고, /api·/webhook 만 이 코드가 처리
//   저장소는 D1(okaystra-db). 쿠키 서명 키는 SESSION_SECRET 이 없으면 D1 에 처음 한 번 만들어 둠

import { makeConfig } from '../server/settings.js';
import { createHandler } from '../server/handler.js';
import { createInstagram } from '../server/instagram.js';
import { D1Store } from './d1store.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

let ready = null;
function setup(env) {
  if (!ready) {
    ready = (async () => {
      const store = await new D1Store(env.DB).init();
      const cfg = makeConfig(env);
      if (!cfg.sessionSecret) cfg.sessionSecret = await store.secret('session');
      const ig = createInstagram(cfg);
      return { cfg, store, handle: createHandler(cfg, { store, ig }) };
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return withHeaders(Response.json({ ok: true, app: 'okaystra' }, { headers: { 'Cache-Control': 'no-store' } }));
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook')) {
      try {
        const { handle } = await setup(env);
        const res = await handle(request, {
          ip: request.headers.get('cf-connecting-ip') || '?',
          waitUntil: (p) => ctx.waitUntil(p),
        });
        return withHeaders(res);
      } catch (e) {
        console.error('[worker] 준비 실패', e);
        return withHeaders(Response.json({ error: 'server_error' }, { status: 500 }));
      }
    }
    const res = await env.ASSETS.fetch(request);
    // 게임 코드는 5분 캐시 (배포하면 늦어도 5분 뒤 반영)
    const extra = /^\/js\/|\.css$/.test(url.pathname) ? { 'Cache-Control': 'public, max-age=300' } : {};
    return withHeaders(res, extra);
  },

  /** 하루 한 번: 오래된 인증 코드·판 토큰 정리 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      setup(env)
        .then(({ store }) => store.prune())
        .catch((e) => console.error('[worker] 정리 실패', e))
    );
  },
};
