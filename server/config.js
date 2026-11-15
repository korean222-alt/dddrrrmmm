// Node 서버 설정: .env 읽기 + 파일 경로. 값 해석은 settings.js (Cloudflare Worker 와 공용)

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeConfig } from './settings.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env 파일이 있으면 읽기 (Node 21.7+ 내장)
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {}

export function loadConfig(env = process.env) {
  const cfg = makeConfig(env);
  if (!cfg.sessionSecret) {
    if (cfg.prod) throw new Error('SESSION_SECRET 환경변수가 필요합니다 (production).');
    cfg.sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[config] SESSION_SECRET 이 없어 임시 값을 씁니다. 재시작하면 인증 쿠키가 풀립니다.');
  }
  return {
    ...cfg,
    port: Number(env.PORT) || 3000,
    publicDir: path.join(ROOT, 'public'),
    dataFile: env.DATA_FILE || path.join(ROOT, 'data', 'db.json'),
  };
}
