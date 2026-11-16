// 오늘의 노래 + 1:1 대결 (도전장 링크)
//
// 서버 없이 되는 '비동기 1:1': 내 점수와 마디별 점수 기록을 링크에 담아 보내면,
// 친구가 같은 곡을 칠 때 화면 위에 내 점수가 실시간으로 같이 올라가서 경주하듯 겨룸.
// 링크 내용은 누구나 고칠 수 있으니 랭킹처럼 '공식 기록'으로 쓰지는 않습니다.

import { LEVELS, getLevel, maxScore, isClosed } from './charts.js';

const DAY_MS = 86400000;
/** 날마다 돌아가며 나오는 순서 (같은 곡이 이틀 연속 안 나오게) */
const TODAY_ORDER = [3, 9, 1, 11, 5, 13, 7, 2, 14, 10, 6, 12, 4, 8];
const GRADES = ['SS', 'S', 'A', 'B', 'C', 'D'];
export const NAME_MAX = 10;

/** 한국 시간 기준 날짜 'YYYY-MM-DD' */
export function kstDateKey(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/** 오늘의 노래 (한국 시간 자정에 바뀜) */
export function todayLevel(d = new Date()) {
  const day = Math.floor((d.getTime() + 9 * 3600000) / DAY_MS);
  // 잠긴 단계(9·13·14)는 오늘의 노래로 안 나옴
  const order = TODAY_ORDER.filter((id) => getLevel(id) && !isClosed(id));
  const ids = order.length ? order : LEVELS.filter((l) => !isClosed(l.id)).map((l) => l.id);
  return getLevel(ids[((day % ids.length) + ids.length) % ids.length]);
}

/** 닉네임 정리: 앞뒤 공백·제어문자·꺾쇠 제거, 최대 NAME_MAX 글자 */
export function cleanName(s) {
  return [...String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()].slice(0, NAME_MAX).join('');
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * 결과 → 도전장 코드 (주소의 ?vs= 뒤에 붙음)
 * timeline 은 마디마다의 누적 점수 → 차이값으로 줄여서 담음
 */
export function encodeChallenge({ name, levelId, score, stars, grade, accuracy, timeline }) {
  const tl = (timeline || []).map((v, i, a) => v - (i ? a[i - 1] : 0));
  const payload = { v: 1, n: cleanName(name) || '드러머', l: levelId, s: score, t: stars, g: grade, a: Math.round((accuracy || 0) * 1000), d: tl };
  return b64urlEncode(JSON.stringify(payload));
}

/** 도전장 코드 → { name, levelId, score, stars, grade, accuracy, timeline } (이상하면 null) */
export function decodeChallenge(code) {
  if (typeof code !== 'string' || code.length > 2000) return null;
  let p;
  try {
    p = JSON.parse(b64urlDecode(code));
  } catch {
    return null;
  }
  if (!p || p.v !== 1) return null;
  const level = getLevel(p.l);
  if (!level) return null;
  const int = (x) => Number.isInteger(x);
  if (!int(p.s) || p.s < 0 || p.s > maxScore(level)) return null;
  if (!int(p.t) || p.t < 0 || p.t > 3) return null;
  if (!GRADES.includes(p.g)) return null;
  if (!int(p.a) || p.a < 0 || p.a > 1000) return null;
  if (!Array.isArray(p.d) || p.d.length !== level.bars.length || !p.d.every((x) => int(x) && x >= 0)) return null;
  const timeline = [];
  p.d.reduce((sum, x) => (timeline.push(sum + x), sum + x), 0);
  if (timeline[timeline.length - 1] !== p.s) return null;
  const name = cleanName(p.n);
  if (!name) return null;
  return { name, levelId: level.id, score: p.s, stars: p.t, grade: p.g, accuracy: p.a / 1000, timeline };
}

/** 상대의 '지금 이 순간' 점수. barPos = 본편 몇 번째 마디쯤인지(소수) */
export function opponentScoreAt(timeline, barPos) {
  if (!timeline || !timeline.length || !(barPos > 0)) return 0;
  const i = Math.floor(barPos);
  if (i >= timeline.length) return timeline[timeline.length - 1];
  const prev = i ? timeline[i - 1] : 0;
  return Math.round(prev + (timeline[i] - prev) * (barPos - i));
}

/** 'win' | 'lose' | 'draw' */
export function versusOutcome(myScore, theirScore) {
  return myScore > theirScore ? 'win' : myScore < theirScore ? 'lose' : 'draw';
}
