import crypto from 'node:crypto';

// 헷갈리는 글자(0/O, 1/I) 제외
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

export function generateCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export function isCode(s) {
  return CODE_RE.test(s);
}

export function displayCode(code, prefix) {
  return `${prefix}-${code}`;
}

/**
 * DM 문장에서 코드 후보 뽑기. "콩콩-K7P2", "k7p2", "콩콩 K7P2 입니다" 모두 인식.
 * 접두사가 붙은 것을 먼저, 그다음 맨 4글자 토큰 순서.
 */
export function extractCodes(text, prefix = '콩콩') {
  if (!text) return [];
  const t = String(text).normalize('NFKC').toUpperCase();
  const out = [];
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withPrefix = new RegExp(`${esc}\\s*[-–—_:·.]?\\s*([A-Z0-9]{4})(?![A-Z0-9])`, 'g');
  for (const m of t.matchAll(withPrefix)) if (isCode(m[1])) out.push(m[1]);
  for (const m of t.matchAll(/(?<![A-Z0-9])([A-Z0-9]{4})(?![A-Z0-9])/g)) if (isCode(m[1]) && !out.includes(m[1])) out.push(m[1]);
  return out;
}
