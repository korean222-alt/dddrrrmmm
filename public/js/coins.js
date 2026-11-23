// 🪙 코인 (2026-11-22)
//   PERFECT 2코인 · GREAT·GOOD·연타 1코인. 판 도중에 나가도 그때까지 번 만큼. 잔액은 서버 지갑(팔로워 인증한 계정)에 보관.
//   판이 끝나면 폰에 모아 두었다가 다음 판 시작(/api/runs)·점수 등록(/api/scores) 요청에 얹어 보냄 → 요청 수 그대로.
//   · 판 토큰이 있는 판 → runs [{tok, n}] (서버가 그 곡 콩 수로 상한 확인)
//   · 토큰 없는 판(연습·멀티·유저 맵·내 노래…) → free (서버가 하루 한도)
//   · 인증 전(계정 없음)에 번 코인 → 폰 'coins' 에 → 인증하면 init 으로 한 번 올림
import { load, save } from './storage.js';

let account = false; // 서버 지갑을 쓰는 계정인가 (팔로워 인증 완료)
let onChange = () => {};

// 지갑에 적는 건 D1 쓰기 1줄 → 판마다 보내지 않고 10분에 한 번(또는 판이 많이 쌓이면) 모아서 (2026-11-22 저녁)
//   화면 잔액은 보낼 것까지 더해서 보여 주니 그대로. 서버는 판 토큰을 14일까지 받음
const SEND_EVERY_MS = 10 * 60 * 1000;
const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const queue = () => {
  const q = load('coinQ', []);
  return Array.isArray(q) ? q.filter((x) => x && typeof x.tok === 'string' && x.n > 0) : [];
};

export function coinsInit({ changed } = {}) {
  if (changed) onChange = changed;
  // 보내다 끊긴 것(앱을 닫음 등)은 다시 줄에 넣음 (서버가 같은 판은 한 번만 받음)
  const s = load('coinSending', null);
  if (s) {
    save('coinQ', [...(s.runs || []), ...queue()].slice(-40));
    save('coinFree', int(load('coinFree', 0)) + int(s.free));
    save('coinSending', null);
  }
}

/** 인증 상태가 바뀌면 (me 받을 때마다) */
export function setCoinAccount(on, serverCoins) {
  account = !!on;
  if (account && Number.isFinite(serverCoins)) save('coinSrv', int(serverCoins));
  onChange();
}

/** 화면에 보일 잔액 */
export function coinTotal() {
  const local = int(load('coins', 0));
  if (!account) return local;
  const sending = load('coinSending', null);
  const pend = queue().reduce((a, x) => a + int(x.n), 0) + int(load('coinFree', 0));
  const inFlight = sending ? (sending.runs || []).reduce((a, x) => a + int(x.n), 0) + int(sending.free) + int(sending.init) : 0;
  return int(load('coinSrv', 0)) + pend + inFlight + (load('coinInit', false) ? 0 : local);
}

/** 판 하나 끝: n 코인 (tok = 그 판의 서버 판 토큰, 없으면 null) */
export function addRunCoins(n, tok) {
  n = int(n);
  if (!n) return;
  if (!account) save('coins', int(load('coins', 0)) + n);
  else if (tok) {
    const q = queue();
    const same = q.find((x) => x.tok === tok);
    if (same) same.n += n;
    else q.push({ tok, n });
    save('coinQ', q.slice(-40));
  }
  else save('coinFree', int(load('coinFree', 0)) + n);
  onChange();
}

/**
 * 요청에 얹을 것 (없으면 undefined). 보내는 중인 게 있으면 겹쳐 보내지 않음
 *   force: 10분 기다림 없이 지금 다 (🛒 상점에서 살 때 — 구매 요청에 얹으면 서버가 먼저 더하고 그다음 차감)
 */
export function takeCoins({ force = false } = {}) {
  if (!account || load('coinSending', null)) return undefined;
  const runs = queue();
  const free = int(load('coinFree', 0));
  const init = load('coinInit', false) ? null : int(load('coins', 0));
  if (!runs.length && !free && init == null) return undefined;
  const last = Number(load('coinSentAt', 0)) || 0;
  if (!force && init == null && Date.now() - last < SEND_EVERY_MS && runs.length < 25) return undefined;
  const c = { runs, free };
  if (init != null) c.init = init;
  save('coinSending', c);
  save('coinQ', []);
  save('coinFree', 0);
  return c;
}

/** 응답이 왔음: data.coins 가 있으면 서버가 받은 것 → 보낸 것 비우고 잔액 갱신, 없으면 다시 줄에 */
export function coinsResult(data) {
  const s = load('coinSending', null);
  if (data && Number.isFinite(data.coins)) {
    save('coinSrv', int(data.coins));
    if (s) save('coinSentAt', Date.now());
    if (s && s.init != null) save('coinInit', true);
    save('coinSending', null);
    // 오늘 한도(하루 5000)를 넘어 서버가 못 받은 만큼 → 다시 모아 뒀다가 다음 날 (2026-11-23)
    const rest = int(data.coinRest);
    if (rest) save('coinFree', int(load('coinFree', 0)) + rest);
  } else if (s) coinsInit();
  onChange();
}
