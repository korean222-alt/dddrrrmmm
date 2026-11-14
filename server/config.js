import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env 파일이 있으면 읽기 (Node 21.7+ 내장)
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {}

export function loadConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const bool = (v, d) => (v === undefined || v === '' ? d : v === 'true' || v === '1');
  let sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) {
    if (prod) throw new Error('SESSION_SECRET 환경변수가 필요합니다 (production).');
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[config] SESSION_SECRET 이 없어 임시 값을 씁니다. 재시작하면 인증 쿠키가 풀립니다.');
  }
  return {
    prod,
    port: Number(env.PORT) || 3000,
    publicDir: path.join(ROOT, 'public'),
    dataFile: env.DATA_FILE || path.join(ROOT, 'data', 'db.json'),
    sessionSecret,
    // open: Lv.4+ 누구나 / follow: 팔로우 인증 후
    gateMode: env.GATE_MODE === 'follow' ? 'follow' : 'open',
    // fake: checkFollow 가 항상 "팔로우 중" / real: 인스타 API 로 진짜 확인
    followCheckMode: env.FOLLOW_CHECK_MODE === 'real' ? 'real' : 'fake',
    // 테스트용 "DM 보낸 척" API. 기본: 개발 환경에서만 켜짐
    devSimulate: bool(env.ALLOW_DEV_SIMULATE, !prod),
    instagramHandle: (env.INSTAGRAM_HANDLE || '').replace(/^@/, ''),
    siteUrl: env.SITE_URL || '',
    codePrefix: env.CODE_PREFIX || '콩콩',
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
