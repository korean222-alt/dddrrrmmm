// 익명 이용 통계: 접속 시간(실제로 화면을 보고 만진 시간)과 곡 시작/끝을 서버에 모읍니다.
// 이름·아이디·IP 는 보내지 않아요. 서버가 없는 모드(mock)에선 아무것도 안 함.
//   · 세션 = 탭 하나에서 30분 넘게 안 쉬고 이어진 접속
//   · 활동 시간 = 화면이 보이고 + 최근 1분 안에 터치/키 입력이 있었던 시간

const KEY = 'kkTrack';
const IDLE_MS = 60 * 1000; // 이 시간 동안 입력 없으면 활동 시간 안 셈
const SESSION_GAP_MS = 30 * 60 * 1000;
const TICK_MS = 5000;
// 5분마다 (Cloudflare 무료 하루 10만 건 아끼기). 곡 시작·끝은 모아 두었다가 판 시작(/api/runs)·점수 올리기
//   요청에 얹어 보냄(takeTrack) → 따로 요청 안 함. 화면을 떠날 때는 바로 (단, 1분 안에 보냈으면 판 기록이 있을 때만)
const FLUSH_MS = 300 * 1000;
const HIDE_GAP_MS = 60 * 1000;

let on = false;
let sess = null; // { sid, ref, st(세션 시작 시각) }
let activeMs = 0;
let lastInput = Date.now();
let lastSent = -1;
let lastSentAt = 0;
let play = null; // 진행 중인 판 { id, level, mode, startedAt }
const queue = []; // 아직 못 보낸 판 이벤트
const adQueue = []; // 📣 아직 못 보낸 광고 이벤트 (광고주에게 줄 숫자라 '표본 밖' 때도 버리지 않음)

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
function writeStore() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...sess, active: Math.round(activeMs / 1000), at: Date.now() }));
  } catch {}
}

function referrer() {
  try {
    const q = new URLSearchParams(location.search);
    const u = q.get('utm_source') || q.get('src') || q.get('ref');
    if (u) return u;
    if (document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h && h !== location.hostname) return h.replace(/^www\./, '');
    }
  } catch {}
  return '';
}

function deviceKind() {
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(ua)) return 'inapp';
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
}

function payloadNow() {
  const payload = { sid: sess.sid, st: sess.st, active: Math.round(activeMs / 1000), ref: sess.ref, device: deviceKind(), plays: queue.splice(0, 10), ads: adQueue.splice(0, 10) };
  lastSent = payload.active;
  lastSentAt = Date.now();
  writeStore();
  return payload;
}

/** 다른 API 요청에 얹어 보낼 통계 (없으면 null). 서버가 /api/runs·/api/scores 에서 같이 저장 */
export function takeTrack() {
  if (!on || !sess) return null;
  return payloadNow();
}

// 서버가 '지금은 표본 밖'(rest)이라 하면 그동안 통계만 따로 보내는 요청은 안 함 (판 요청에 얹는 건 그대로)
let restUntil = 0;
function send() {
  if (!on || !sess) return;
  if (Date.now() < restUntil) {
    queue.length = 0;
    if (!adQueue.length) return; // 광고 이벤트가 있으면 그것만이라도 보냄
  }
  const payload = payloadNow();
  try {
    fetch('/api/track', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Number.isFinite(d.rest) && d.rest > 0) restUntil = Date.now() + Math.min(d.rest, 6 * 3600 * 1000);
      })
      .catch(() => {});
  } catch {}
}

/** 서버가 있을 때 한 번 부름 */
export function initTracker({ enabled }) {
  if (!enabled || on) return;
  on = true;
  const prev = readStore();
  if (prev && prev.sid && Date.now() - prev.at < SESSION_GAP_MS) {
    sess = { sid: prev.sid, ref: prev.ref || '', st: prev.st || Date.now() };
    activeMs = (prev.active || 0) * 1000;
  } else {
    // st: 세션 시작 시각 → 서버가 통계를 시간 순 표에 넣어 관리자 통계가 그 기간만 읽게 (2026-11-22, D1 읽기 아끼기)
    sess = { sid: rid() + rid(), ref: referrer(), st: Date.now() };
    activeMs = 0;
  }
  const touch = () => (lastInput = Date.now());
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, touch, { capture: true, passive: true });
  setInterval(() => {
    if (!document.hidden && Date.now() - lastInput < IDLE_MS) activeMs += TICK_MS;
  }, TICK_MS);
  setInterval(() => {
    // 판 시작·점수 요청에 얹어서 방금(5분 안) 보냈으면 건너뜀 → 계속 치는 사람은 따로 안 보냄
    if (Date.now() - lastSentAt < FLUSH_MS - TICK_MS) return;
    if (!document.hidden && (queue.length || adQueue.length || Math.round(activeMs / 1000) !== lastSent)) send();
  }, FLUSH_MS);
  const leave = () => {
    if (queue.length || adQueue.length || (Date.now() - lastSentAt > HIDE_GAP_MS && Math.round(activeMs / 1000) !== lastSent)) send();
  };
  document.addEventListener('visibilitychange', () => document.hidden && leave());
  window.addEventListener('pagehide', leave);
  // 들어오자마자 보내지 않음: 첫 판 시작 요청에 얹히거나, 5분 뒤·화면을 떠날 때 보냄
}

/** 곡 시작 (자동 연주·영상 찍기는 부르지 않음) */
export function trackPlayStart(level, mode = 'normal') {
  if (!on) return;
  if (play) trackPlayEnd({ result: 'quit' });
  play = { id: rid() + rid(), level, mode, startedAt: Date.now() };
  queue.push({ ev: 'start', id: play.id, level, mode });
}

/** 곡 끝. res: { result: 'clear'|'fail'|'quit', score?, stars? }. 진행 중인 판이 없으면 무시 */
export function trackPlayEnd(res = {}) {
  if (!on || !play) return;
  const p = play;
  play = null;
  queue.push({
    ev: 'end',
    id: p.id,
    level: p.level,
    mode: p.mode,
    result: res.result || 'quit',
    score: res.score,
    stars: res.stars,
    sec: Math.round((Date.now() - p.startedAt) / 1000),
  });
  // 바로 안 보냄: 다음 판 시작·점수 올리기 요청에 얹히거나, 5분마다·화면을 떠날 때 같이 감
}

export const hasOpenPlay = () => !!play;

// ---------------- 📣 광고 노출 (2026-11-27, 광고주에게 줄 통계: server/adstats.js · admin '📣 광고') ----------------
// 광고를 보여 줄 때 start · 인스타 버튼을 누르면 click · 끝나면 end(done = 끝까지 봄 / closed = 중간에 닫음, sec = 본 초).
// 판 통계처럼 다른 요청(판 시작·점수 올리기)에 얹혀 가거나 5분마다·화면을 떠날 때 감 → 따로 요청을 늘리지 않음.
// 서버가 없는 모드(on=false)에선 아무것도 안 함. 이름·아이디 없이 익명 방문자 쿠키로만 셈.
const ads = new Map(); // 보고 있는 광고 id → { ad, src, surface, at }

/** 광고 하나 보여 주기 시작. ad = 광고 이름(우리 광고 'house', 애드센스 'adsense'…), surface = 'drum' | 'tile' (어디서 떴나). 반환 = 이 노출의 id */
export function trackAdStart({ ad = 'house', surface = 'other' } = {}) {
  const id = rid() + rid();
  if (!on) return id;
  ads.set(id, { ad, surface, at: Date.now() });
  adQueue.push({ ev: 'start', id, ad, surface });
  return id;
}

/** 광고의 인스타 버튼을 눌렀다 (노출마다 한 번만) */
export function trackAdClick(id) {
  const a = ads.get(id);
  if (!on || !a || a.clicked) return;
  a.clicked = true;
  adQueue.push({ ev: 'click', id, ad: a.ad, surface: a.surface });
}

/** 광고가 끝났다. result: 'done'(끝까지 봐서 보상) | 'closed'(중간에 닫음) */
export function trackAdEnd(id, result) {
  const a = ads.get(id);
  if (!on || !a) return;
  ads.delete(id);
  adQueue.push({ ev: 'end', id, ad: a.ad, surface: a.surface, result: result === 'done' ? 'done' : 'closed', sec: Math.round((Date.now() - a.at) / 1000) });
}
