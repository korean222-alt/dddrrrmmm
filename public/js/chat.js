// 💬 채팅 (2026-11-28 사용자 '채팅 18:00~20시까지만' → 같은 날 '서버 괜찮으면 24시까지') — 서버·폰 같이 씀
//   열리는 시간(한국 시각)·글 검사(길이·링크·연락처·욕)만. 저장·폴링은 server/handler.js · main.js
export const CHAT_MAX = 80;
export const CHAT_HOURS = '18-24';
const KST = 9 * 3600 * 1000;

/** '18-24' → '저녁 6시~밤 12시' (화면 글자) */
export function chatHoursText(hours = CHAT_HOURS) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(hours || CHAT_HOURS)) || /^(\d+)-(\d+)$/.exec(CHAT_HOURS);
  const h = (n) => {
    n = Number(n) % 24;
    if (n === 0) return '밤 12시';
    if (n === 12) return '낮 12시';
    return (n < 6 ? '새벽 ' : n < 12 ? '오전 ' : n < 18 ? '오후 ' : n < 21 ? '저녁 ' : '밤 ') + (n > 12 ? n - 12 : n) + '시';
  };
  return `${h(m[1])}~${h(m[2])}`;
}

/** 지금 채팅이 열렸나 { open, start, end, next } — hours = '18-20' (한국 시각, 끝 시각은 안 들어감) */
export function chatWindow(now = Date.now(), hours = CHAT_HOURS) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(hours || CHAT_HOURS)) || /^(\d+)-(\d+)$/.exec(CHAT_HOURS);
  const a = Math.min(24, Number(m[1]));
  const b = Math.min(24, Math.max(a, Number(m[2])));
  const day = Math.floor((now + KST) / 86400000) * 86400000 - KST; // 오늘 한국 0시
  const start = day + a * 3600000;
  const end = day + b * 3600000;
  if (now >= start && now < end) return { open: true, start, end, next: start };
  const next = now < start ? start : start + 86400000;
  return { open: false, start, end, next };
}

// 연락처·링크는 막음 (학생 유저 많음 — 밖으로 불러내기 막기)
const CONTACT = [
  /https?:\/\//i,
  /www\./i,
  /[a-z0-9-]+\.(com|net|kr|io|me|gg|ly|link|xyz|org|co)\b/i,
  /open\s*\.?\s*kakao/i,
  /오픈\s*채팅|오픈\s*톡|오픈카톡|카톡\s*(아이디|id)|카카오\s*아이디|디코|디스코드|discord|텔레그램|telegram|라인\s*아이디/i,
  /\d[\d\s.-]{8,}\d/, // 전화번호 같은 긴 숫자
  /01[016789]\D{0,3}\d{3,4}\D{0,3}\d{4}/,
  /(^|\s)@[a-z0-9_.]{3,}/i, // 인스타 아이디
];
// 욕은 별표로 가림 (글은 보냄)
const BAD = /(씨\s*발|시\s*발|ㅅ\s*ㅂ|ㅆ\s*ㅂ|병\s*신|ㅂ\s*ㅅ|개\s*새\s*끼|개새|좆|존\s*나|졸\s*라|지\s*랄|ㅈ\s*ㄹ|미친\s*(놈|년|새끼)|니\s*애\s*미|느\s*금\s*마|애\s*미|씹|꺼\s*져|닥\s*쳐|fuck|shit|bitch)/gi;

/** 글 검사 → { text } 또는 { error: 'empty' | 'long' | 'contact' } */
export function chatClean(v) {
  let t = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return { error: 'empty' };
  if (t.length > CHAT_MAX) return { error: 'long' };
  if (CONTACT.some((re) => re.test(t))) return { error: 'contact' };
  t = t.replace(BAD, (w) => '*'.repeat(Math.min(4, w.replace(/\s/g, '').length)));
  // 같은 글자 길게 반복은 줄임 (ㅋㅋㅋㅋㅋㅋㅋㅋ… → 8개)
  t = t.replace(/(.)\1{8,}/g, (w, c) => c.repeat(8));
  return { text: t };
}
