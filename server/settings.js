// 설정값 해석 (Node 서버와 Cloudflare Worker 가 같이 씀 — 파일 시스템/경로 없음)

export function makeConfig(env = {}) {
  const prod = env.NODE_ENV === 'production';
  const bool = (v, d) => (v === undefined || v === '' ? d : v === 'true' || v === '1');
  return {
    prod,
    sessionSecret: env.SESSION_SECRET || '',
    // soft(기본): 9·12단계·그리그 무제한은 인증 신청, 13·14단계·단계별 무제한은 운영자 확인(인증 완료) / open: 잠금 전부 해제 (개발용)
    gateMode: env.GATE_MODE === 'open' ? 'open' : 'soft',
    // /admin.html (이용 통계) 비밀번호. 비어 있으면 관리자 기능 꺼짐
    adminToken: env.ADMIN_TOKEN || '',
    // 이용 통계에서 '하루'를 나누는 시간대 (UTC 와의 차이, 분). 기본 한국 +540
    statsTzMin: env.STATS_TZ_MIN && Number.isFinite(Number(env.STATS_TZ_MIN)) ? Number(env.STATS_TZ_MIN) : 540,
    // 팔로워 암호 (키티챗이 팔로워에게만 DM 으로 주는 암호). 관리자 화면에서 바꾸면 DB 값이 우선
    followPassword: env.FOLLOW_PASSWORD || '',
    // 🆓 암호 없이 '임시 인증' 받는 기간의 끝 (ms). 관리자 화면에서 바꾸면 DB 값이 우선. 0 이면 꺼짐
    //   2026-11-19 인스타 DM 7일 금지 → 11/26 23:59(한국)까지. 테스트는 FREE_PASS_UNTIL=0
    // 🪙 코인 잠깐 멈춤 (비밀값 COINS_PAUSE=1): D1 이 막혀 잠깐 Neon 으로 갈 때 — Neon 엔 오늘 지갑이 없어서 잔액이 0 으로 보임.
    //   멈춘 동안 서버는 코인을 안 받고 잔액도 안 알려 줌 → 폰이 모아 뒀다가 D1 으로 돌아오면 보냄 (2026-11-22)
    coinsPause: /^(1|true|on)$/i.test(String(env.COINS_PAUSE || '').trim()),
    freePassUntil: env.FREE_PASS_UNTIL !== undefined && env.FREE_PASS_UNTIL !== '' ? Number(env.FREE_PASS_UNTIL) || 0 : Date.UTC(2026, 10, 26, 14, 59, 59),
    // 건의함을 매일 읽는 봇용 읽기 전용 토큰 (GET /api/bot/suggestions?token=…). 비어 있으면 봇 주소 꺼짐
    botToken: env.SUGGEST_BOT_TOKEN || '',
    instagramHandle: (env.INSTAGRAM_HANDLE || '').replace(/^@/, ''),
    siteUrl: env.SITE_URL || '',
    cookieSecure: bool(env.COOKIE_SECURE, prod),
    trustProxy: bool(env.TRUST_PROXY, prod),
    // 점수 검증: 실제 곡 길이의 몇 % 이상 지나야 제출 가능한지
    minRunRatio: env.MIN_RUN_RATIO !== undefined ? Number(env.MIN_RUN_RATIO) : 0.9,
  };
}
