// 설정값 해석 (Node 서버와 Cloudflare Worker 가 같이 씀 — 파일 시스템/경로 없음)

export function makeConfig(env = {}) {
  const prod = env.NODE_ENV === 'production';
  const bool = (v, d) => (v === undefined || v === '' ? d : v === 'true' || v === '1');
  return {
    prod,
    sessionSecret: env.SESSION_SECRET || '',
    // soft: "팔로우하고 오세요" 안내만 / follow: DM 코드로 진짜 팔로우 확인 / open: 잠금 없음
    gateMode: ['follow', 'open'].includes(env.GATE_MODE) ? env.GATE_MODE : 'soft',
    // 몇 단계부터 팔로우가 필요한지 (1 = 처음부터)
    gateFromLevel: Math.max(1, Number(env.GATE_FROM_LEVEL) || 4),
    // fake: checkFollow 가 항상 "팔로우 중" / real: 인스타 API 로 진짜 확인
    // manual: DM 은 운영자가 인스타 앱에서 직접 보고 /admin.html 에서 승인 (메타 비즈니스 인증 없이)
    followCheckMode: ['real', 'manual'].includes(env.FOLLOW_CHECK_MODE) ? env.FOLLOW_CHECK_MODE : 'fake',
    // /admin.html 승인 페이지 비밀번호. 비어 있으면 관리자 기능 꺼짐
    adminToken: env.ADMIN_TOKEN || '',
    // 테스트용 "DM 보낸 척" API. 기본: 개발 환경에서만 켜짐
    devSimulate: bool(env.ALLOW_DEV_SIMULATE, !prod),
    instagramHandle: (env.INSTAGRAM_HANDLE || '').replace(/^@/, ''),
    siteUrl: env.SITE_URL || '',
    codePrefix: env.CODE_PREFIX || 'OK',
    codeTtlMs: (Number(env.CODE_TTL_MIN) || 10) * 60 * 1000,
    cookieSecure: bool(env.COOKIE_SECURE, prod),
    trustProxy: bool(env.TRUST_PROXY, prod),
    // 점수 검증: 실제 곡 길이의 몇 % 이상 지나야 제출 가능한지
    minRunRatio: env.MIN_RUN_RATIO !== undefined ? Number(env.MIN_RUN_RATIO) : 0.9,
    ig: {
      appSecret: env.IG_APP_SECRET || '',
      verifyToken: env.IG_VERIFY_TOKEN || '',
      accessToken: env.IG_ACCESS_TOKEN || '',
      graphHost: env.IG_GRAPH_HOST || 'graph.instagram.com',
      apiVersion: env.IG_API_VERSION || 'v23.0',
      businessId: env.IG_BUSINESS_ID || '',
      sendReplies: bool(env.IG_SEND_REPLIES, true),
      debug: bool(env.IG_DEBUG, false),
    },
  };
}
