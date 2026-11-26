// 🔑 구글 로그인 (2026-11-26, 시즌 2) — 카카오 로그인과 똑같은 방식(server/kakao.js). 받는 건 구글 계정 번호(sub)뿐, 서버엔 해시만.
//   운영자 준비: console.cloud.google.com → API 및 서비스 → OAuth 동의 화면(외부, 앱 이름) → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)
//               · 승인된 리디렉션 URI `<사이트>/api/auth/google/callback` → Cloudflare 비밀값 GOOGLE_CLIENT_ID · GOOGLE_SECRET
//   ⚠ 구글은 인스타·카톡 앱 안 브라우저에서 로그인을 막음(disallowed_useragent) → 폰은 앱 안에선 구글 버튼 대신 안내
import crypto from 'node:crypto';

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_ME = 'https://openidconnect.googleapis.com/v1/userinfo';

export function googleHash(id, secret) {
  return crypto.createHash('sha256').update(`google:${secret}:${id}`).digest('hex').slice(0, 40);
}

export function googleAuthUrl({ key, redirectUri, state }) {
  const u = new URL(GOOGLE_AUTH);
  u.searchParams.set('client_id', key);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid');
  u.searchParams.set('prompt', 'select_account');
  u.searchParams.set('state', state);
  return u.toString();
}

/** 인가 코드 → 구글 계정 번호 (실패하면 오류) */
export async function googleUserId({ key, secret, redirectUri, code }, fetchImpl = fetch) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: key, client_secret: secret, redirect_uri: redirectUri, code });
  const tr = await fetchImpl(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const tj = await tr.json().catch(() => null);
  if (!tr.ok || !tj || !tj.access_token) throw new Error('google_token');
  const mr = await fetchImpl(GOOGLE_ME, { headers: { Authorization: `Bearer ${tj.access_token}` } });
  const mj = await mr.json().catch(() => null);
  if (!mr.ok || !mj || !mj.sub) throw new Error('google_me');
  return String(mj.sub);
}
