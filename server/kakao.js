// 🔑 카카오 로그인 (2026-11-26, 시즌 2) — 계정에 카카오를 연결해 두면 다른 브라우저·앱(인스타 안·사파리·홈 화면 앱)에서도
//   「카카오로 로그인」 한 번에 같은 계정(기록·코인·산 것). 받는 정보는 카카오 회원번호뿐이고 서버엔 해시만 저장.
//   팔로워 인증(잠금 정책)과는 따로 — 연결만 해 줌.
//   운영자 준비: developers.kakao.com 앱 → 플랫폼 Web 도메인 · 카카오 로그인 켜기 · Redirect URI `<사이트>/api/auth/kakao/callback`
//               · 보안 Client Secret 켜기 → Cloudflare 비밀값 KAKAO_REST_KEY · KAKAO_SECRET (둘 다 있어야 버튼이 보임)
//   흐름: GET /api/auth/kakao/start?mode=login|link → 카카오 동의 화면 → GET /api/auth/kakao/callback → '/?kakao=결과' 로 돌아옴
//   ⚠ 남의 카카오를 내 계정에 몰래 붙이는 공격 막기: state 에 서명 + 같은 브라우저 쿠키(kk_ks)의 번호가 맞아야 함

import crypto from 'node:crypto';

export const KAKAO_AUTH = 'https://kauth.kakao.com/oauth/authorize';
export const KAKAO_TOKEN = 'https://kauth.kakao.com/oauth/token';
export const KAKAO_ME = 'https://kapi.kakao.com/v2/user/me';
export const KAKAO_STATE_MS = 10 * 60 * 1000;

/** 카카오 회원번호 → 저장할 해시 (서버 비밀 섞음, 원래 번호는 저장 안 함) */
export function kakaoHash(id, secret) {
  return crypto.createHash('sha256').update(`kakao:${secret}:${id}`).digest('hex').slice(0, 40);
}

export function kakaoAuthUrl({ key, redirectUri, state }) {
  const u = new URL(KAKAO_AUTH);
  u.searchParams.set('client_id', key);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  return u.toString();
}

/** 인가 코드 → 카카오 회원번호 (실패하면 오류) */
export async function kakaoUserId({ key, secret, redirectUri, code }, fetchImpl = fetch) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: key, client_secret: secret, redirect_uri: redirectUri, code });
  const tr = await fetchImpl(KAKAO_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: body.toString() });
  const tj = await tr.json().catch(() => null);
  if (!tr.ok || !tj || !tj.access_token) throw new Error('kakao_token');
  const mr = await fetchImpl(KAKAO_ME, { headers: { Authorization: `Bearer ${tj.access_token}` } });
  const mj = await mr.json().catch(() => null);
  if (!mr.ok || !mj || mj.id == null) throw new Error('kakao_me');
  return String(mj.id);
}
