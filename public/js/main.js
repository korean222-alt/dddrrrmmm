// 오케이스트라 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

import {
  LEVELS, getLevel, levelLanes, DIFFICULTY_WORDS, STAR_RULES,
  ENDLESS_ID, LAST_LEVEL_ID, MAIN_LEVELS, levelLabel, makeEndless, isUnlocked, unlockHint, nextChallenge, DIAMOND_RULES, roundInfo,
  ENDLESS_FROM, LEVEL_ENDLESS_STEP, makeLevelEndless, levelEndlessBase, levelEndlessId, needsVerify, FREE_UPTO, isClosed, prevOpenId, nextOpenId,
  STUDIO_LEVELS, getStudioLevel, levelSurvivalId, levelSurvivalBase, COUNT_IN_BARS, ROUND_BARS,
  BEAT_ID, makeBeatReel, beatOpts, beatSeconds, BEAT_MAX_ROUNDS, BEAT_STYLES, BEAT_DIFFS, beatStyleName,
  QUIZ_BARS, quizId, isQuizId, makeQuizLevel, quizSeconds, STEPS_PER_BAR, CHAR_LANES, KICK, SNARE, HAT, CRASH, parseChord, noteCount,
} from './charts.js';
import { todayMission, missionDone, streakView, markDone } from './daily.js';
import { DECO_THEMES, NOTE_FREE, SHOP_ITEMS, RARITY, RARITY_NAME, priceOf, legacyRefund } from './shop.js';
import { startShopPreview, stopShopPreview, drawKitCloseup } from './shoppreview.js';
import { separateVocals, resample } from './vocalsep.js';
import { transcribeSong } from './songmap.js';
import { instrumentNotes } from './instnotes.js';
import { readScoreFile, scoreInfo, scoreToMap, recommendStart } from './scorefile.js';
import { videoToAac } from './mp4audio.js';
import { MAP_LIMITS, midiName, SOLFA, barToMelody, drumCell, toggleDrum, harmonize, autoDrums, cleanMap, mapLevel } from './usermap.js';
import { AudioEngine, playMetronome } from './audio.js';
import { Renderer, NOTE_PALETTES, LANE, applyNoteColors } from './render.js';
import { coinsInit, setCoinAccount, coinTotal, addRunCoins } from './coins.js';
import { queueOffline, backupOffline } from './offrec.js';
import { Game, MAX_LIVES, LIFE_REGEN_COMBO, REVIVE_LIVES } from './game.js';
import { initAds, showRewarded } from './ads.js';
import { createApi } from './api.js';
import { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay } from './track.js';
import { CONFIG } from './config.js';
import { buddyUrl, loadBuddies } from './buddies.js';
import { groupStarting, THEMES, SHOP_KITS } from './themes.js';
import { NEWS, LATEST_NEWS } from './news.js';
import { RoomClient, roomOutcome, survivalOutcome } from './room.js';
import { makeReelCover } from './cover.js';
import { detectBeat, monoOf, songChart } from './beatsync.js';
import { seasonLeftText, BOARD_LABEL } from './season.js';
import { loadSettings, saveSettings, loadBests, saveBest, load, save, remove, migrateLevelOrder, resetOldLevel18, photoSave, photoLoad, photoDelete } from './storage.js';

resetOldLevel18(); // 18번 = 엘리제를 위하여 (그 전 찬송가 기록 지움)
migrateLevelOrder(); // 8단계에 새 곡이 끼면서 밀린 번호를 이 브라우저 기록에도 반영 (아래 state 보다 먼저)
import { makeShareCard, gradeColor } from './sharecard.js';
import { icon, watchEmoji } from './icons.js';
import { todayLevel, encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome, cleanName } from './versus.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);

const STAR_PATH = 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.22 6.5L12 17.3l-5.82 3.15 1.22-6.5-4.8-4.55 6.55-.85z';
const GEM_PATH = 'M7 3.5h10l4.5 5.6L12 21 2.5 9.1z M2.5 9.1h19 M7 3.5l2.4 5.6L12 21l2.6-11.9L17 3.5';
/** 다이아몬드 3개 (무제한 모드). 별과 같은 연출 클래스를 씀 */
const gemsHTML = (n, cls = '') =>
  `<span class="stars gems ${cls}" aria-label="다이아몬드 ${n}개">${[0, 1, 2]
    .map((i) => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="--i:${i}"><path d="${GEM_PATH}"/></svg>`)
    .join('')}</span>`;
/** 별 3개 (n개 채움) */
const starsHTML = (n, cls = '') =>
  `<span class="stars ${cls}" aria-label="별 ${n}개">${[0, 1, 2]
    .map((i) => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="--i:${i}"><path d="${STAR_PATH}"/></svg>`)
    .join('')}</span>`;
const diffHTML = (d) =>
  `<span class="diff" aria-label="난이도 ${d}/5"><span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>${DIFFICULTY_WORDS[d] || ''}</span>`;

const audio = new AudioEngine();
const renderer = new Renderer($('#game-canvas'));
// 자동 화질: 이 기기에서 버벅여서 내려갔던 단계를 기억해 다음 판부터 그대로
renderer.quality = Math.max(0, Math.min(2, Number(load('gfxQ', 2)) || 0));
renderer.onQualityDrop = (q) => {
  save('gfxQ', q);
  if (q === 0) state.suggestLite = true;
};

const state = {
  api: null,
  cfg: { ...CONFIG },
  me: { verified: false },
  settings: loadSettings(),
  auto: false,
  studio: { level: 'ch4', mode: 'auto', top: '엄지로 드럼 쳐보세요', bottom: 'Lv.4까지 오면 드러머 재능 있음', file: false, active: false },
  levelId: 1,
  game: null,
  lastResult: null,
  runToken: null,
  rankLevel: 1,
  vs: null, // 받은 도전장 { name, levelId, score, stars, grade, accuracy, timeline }
};

// ---------------- 유틸 ----------------
function show(screenId) {
  // 곡 도중 다른 화면으로 나가면 '중간에 나감'으로 기록
  if (screenId !== 'screen-game' && hasOpenPlay()) trackPlayEnd({ result: 'quit' });
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
}
function openModal(id) {
  $('#' + id).hidden = false;
}
function closeModal(id) {
  $('#' + id).hidden = true;
}
let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const handle = () => state.cfg.instagramHandle || '';
const atHandle = () => (handle() ? '@' + handle() : '우리 인스타 계정');
/** "@아이디 인스타" 또는 그냥 "인스타" */
const igWho = () => (handle() ? `@${handle()} 인스타` : '인스타');
const isInApp = () => /Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(navigator.userAgent);

const isLocalDev = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

/**
 * 서버 없는 모드로 시작한 화면(첫 접속 때 서버가 늦게 깨서 기다리다 포기함)을 서버에 다시 붙임. 붙으면 true.
 *   그대로 두면 새로고침 전까지 인증·기록 옮기기·랭킹이 계속 '서버 연결 안 됨'이라서.
 *   부르는 곳: 시작 몇 초 뒤 한 번, 앱으로 돌아올 때(30초에 한 번), 인증·기록 옮기기 누를 때
 */
let reconnecting = null;
let reconnectTriedAt = 0;
let reconnectFails = 0;
/** 🧯 서버 DB 가 막힘 → 서버 없는 모드로 (인증했던 폰은 그대로 열림, 기록·코인은 폰에). reconnectServer 가 나중에 다시 붙임 */
let dbDownShown = false;
async function goOffline() {
  if (!state.api || state.api.mode !== 'server') return;
  state.api = await createApi({ ...CONFIG, apiMode: 'mock' });
  if (state.roomClient) state.roomClient.api = state.api;
  reconnectTriedAt = Date.now();
  reconnectFails = Math.max(reconnectFails, 2); // 2분 뒤부터 다시 붙어 봄
  if (!dbDownShown) {
    dbDownShown = true;
    toast('서버가 잠깐 쉬어요 · 게임은 그대로, 기록·코인은 저장돼요', 3500);
  }
  refreshTitle();
  renderLevels();
}
window.addEventListener('okaystra:db-down', () => goOffline().catch(() => {}));
window.addEventListener('okaystra:offline-sent', (ev) => {
  const d = ev.detail || {};
  if (d.improved > 0) toast(`서버 없을 때 친 기록 ${d.improved}개가 랭킹에 올라갔어요 🏆`, 3200);
});
function reconnectServer({ force = false } = {}) {
  if (state.api && state.api.mode === 'server') return Promise.resolve(true);
  if (CONFIG.apiMode === 'mock') return Promise.resolve(false);
  // 계속 안 되면 30초 → 1분 → 2분 … 10분 간격으로만 다시 해 봄 (하루 한도를 넘겨 서버가 막혔을 때 헛요청 줄이기)
  const gap = Math.min(600, 30 * 2 ** reconnectFails) * 1000;
  if (!force && Date.now() - reconnectTriedAt < gap) return Promise.resolve(false);
  reconnectTriedAt = Date.now();
  reconnecting ??= (async () => {
    try {
      const api = await createApi({ ...CONFIG, apiMode: 'auto' });
      if (api.mode !== 'server') {
        reconnectFails = Math.min(reconnectFails + 1, 5);
        return false;
      }
      reconnectFails = 0;
      state.api = api;
      if (state.roomClient) state.roomClient.api = api;
      initTracker({ enabled: true });
      try {
        state.me = await api.me();
      } catch {}
      refreshTitle();
      renderLevels();
      return true;
    } catch {
      return false;
    } finally {
      reconnecting = null;
    }
  })();
  return reconnecting;
}
/** 테스트용 주소 옵션(?gate= ?level= …)은 내 컴퓨터(localhost)에서만. 실제 사이트에선 무시 */
const devParam = (k) => (isLocalDev() ? params.get(k) : null);
/** 서버 없이 배포된 상태(정적 호스팅): 랭킹은 아직 안 열림 */
const demoOnly = () => state.api && state.api.mode === 'mock' && !isLocalDev();
const SOON = () => `랭킹은 곧 열려요! ${atHandle()} 팔로우하고 기다려 주세요`;

// ---------------- 팔로워 인증 (12단계 · 무제한 모드) ----------------
// 1~FREE_UPTO 단계는 누구나. 그 뒤 단계·무제한·랭킹은 팔로워 암호(키티챗 DM)로 인증 완료한 사람만
/** 팔로워 인증 신청 완료 (서버 없는 모드에선 확인할 방법이 없어서 열어 둠) */
function isVerified() {
  if (!state.api || state.api.mode !== 'server') return true;
  return !!(state.me && state.me.guest && state.me.checked);
}
const verifyLocked = (id) => state.cfg.gateMode !== 'open' && needsVerify(id) && !isVerified();
const VERIFY_WHAT = () => `${FREE_UPTO + 1}단계부터·💎 무제한·⚔️ 멀티·💬 건의하기`;
/** 운영자가 팔로우를 확인함 = 인증 완료 (서버 없는 모드에선 확인할 방법이 없어서 잠가 둠) */
function isConfirmed() {
  if (state.api && state.api.mode === 'server') {
    const ok = !!(isVerified() && state.me.confirmed);
    // 서버가 알려 준 내 인증 상태를 폰에 기억 (서버가 잠깐 안 될 때 쓰려고). 내 정보를 받기 전(빈 me)엔 안 바꿈
    const known = state.me && (state.me.guest || state.me.verified === false);
    if (known && ok !== !!load('confirmedAt', 0)) ok ? save('confirmedAt', Date.now()) : remove('confirmedAt');
    return ok;
  }
  // 서버가 잠깐 안 될 때(하루 한도 초과 등 — 2026-11-22 D1 읽기 한도): 7일 안에 인증 완료였던 폰은 그대로 열어 둠
  //   (기록·코인은 폰에 모아 뒀다가 서버가 돌아오면 올라감)
  //   이 기억이 없는 폰(새 코드가 서버와 한 번도 못 만남)은 4단계 이상 기록이 있으면 인증했던 폰으로 봄 (인증해야만 칠 수 있어서)
  if (!state.api || CONFIG_STATIC()) return false;
  // 2026-11-22 사용자 요청: 서버가 쉬는 동안엔 누구나 전부 열림 (인증 창 때문에 릴스에 「쿵」 댓글·DM 이 쏟아져서)
  return true;
}
/** 처음부터 서버 없이 배포된 사이트(정적 호스팅)인가 */
const CONFIG_STATIC = () => CONFIG.apiMode === 'mock';
const CONFIRM_WHAT = VERIFY_WHAT;
/** 인증 완료 전엔 잠긴 것 (4단계부터, 무제한 전부). 개발용 ?gate=open 에선 풀림 */
const closedLocked = (id) => state.cfg.gateMode !== 'open' && isClosed(id) && !isConfirmed() && !freePass();
/** 인스타 댓글에 쓸 키워드 (키티챗 자동 DM 키워드와 같아야 함) */
const VERIFY_KEYWORD = '쿵';
/** 🆓 암호 없이 임시 인증 기간 (인스타 DM 이 막혔을 때, 서버 설정 freePassUntil). 끝나면 팔로워 암호로 다시 인증 */
// 서버 설정을 못 받았을 때(서버가 쉬는 중)는 폰에 기억한 값, 그것도 없으면 서버 기본값(11/26 23:59 KST)
const FREE_PASS_DEFAULT = Date.UTC(2026, 10, 26, 14, 59, 59);
const freePassUntilNow = () => state.cfg.freePassUntil ?? load('freePassUntil', null) ?? FREE_PASS_DEFAULT;
const freePass = () => { const u = freePassUntilNow(); return !!(u && Date.now() < u); };
const freePassDay = () => {
  const d = new Date(freePassUntilNow());
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

function openVerify(id, { pass = '', label = '', then = null, restore = false } = {}) {
  state.verifyRestore = restore;
  state.verifyFor = id ?? state.verifyFor ?? null;
  // 인증하면 이어서 할 일 (멀티 창 열기·건의하기 등)
  state.verifyThen = then;
  const lv = label ? { label } : id == null ? null : id === ENDLESS_ID ? { label: '💎 무제한 모드 · 그리그' } : levelEndlessBase(id) ? { label: `💎 ${levelEndlessBase(id).id}단계 무제한 · ${levelEndlessBase(id).name}` } : getLevel(id) ? { label: `${levelLabel(id)} · ${getLevel(id).composer} ${getLevel(id).name}` } : null;
  $('#verify-level').hidden = !lv;
  if (lv) $('#verify-level').textContent = lv.label;
  const done = isConfirmed() && !restore;
  const free = freePass() && !restore && !done;
  // 임시 인증 기간이 끝나 다시 잠긴 사람
  const tempOver = !done && !restore && !freePass() && !!load('wasTemp', false);
  $('#verify-mascots').innerHTML = buddiesHTML('cheer', done ? 'cheer' : 'idle');
  $('#verify-title').textContent = restore ? '예전 기록 되찾기' : done ? (state.me.temp && freePass() ? '이용 가능해요!' : '팔로워 인증 완료!') : freePass() ? '이용 등록' : '팔로워 인증';
  $('#verify-desc').innerHTML = restore
    ? `예전 주소(kongkong-drum.vercel.app)에서 <b>팔로워 인증</b>을 받았던 분은, 그때 쓴 <b>인스타 아이디</b>와 <b>팔로워 암호</b>를 넣으면 랭킹 닉네임·점수·깬 단계를 되찾아요.`
    : done
    ? state.me.temp && freePass()
      ? `🎉 <b>${freePassDay()}</b>까지 전부 이용할 수 있어요. 그 뒤엔 팔로우 인증을 다시 받아야 해요.`
      : `이미 인증됐어요 🎉 잠긴 단계와 💎 무제한 모드가 전부 열려 있어요.`
    : free
    ? `📢 인스타 DM 이 잠시 막혀서, <b>${freePassDay()}까지는</b> 닉네임·인스타 아이디만 적으면 전부 이용할 수 있어요!<br>그 뒤에는 <b>팔로우 인증을 다시 받아야</b> 해요.`
    : tempOver
    ? `이용 기간이 끝났어요. 「${VERIFY_KEYWORD}」 댓글을 달고 DM 으로 받은 <b>팔로워 암호</b>로 팔로우 인증을 다시 받으면 계속 쓸 수 있어요 (기록은 그대로).`
    : `1~${FREE_UPTO}단계는 맛보기! <b>${VERIFY_WHAT()}</b>는 ${igWho()} 팔로워 인증을 받으면 전부 열려요.<br>랭킹에도 인증한 사람만 올라가요.`;
  const step = (n, text) => `<li class="${done ? 'done' : ''}"><b>${done ? '✓' : n}</b><span>${text}</span></li>`;
  $('#verify-steps').innerHTML = free
    ? [step(1, '아래에 닉네임·인스타 아이디 적기'), step(2, `<b>시작하기</b> → ${freePassDay()}까지 전부 이용 가능`)].join('')
    : [
    step(1, `${atHandle()} <b>팔로우</b>하기`),
    step(2, `아무 게시물·릴스에 <b>「${VERIFY_KEYWORD}」</b> 댓글 달기`),
    step(3, `DM 이 오면 <b>버튼</b>을 눌러 <b>팔로워 암호</b> 받기`),
    step(4, '아래에 암호를 적고 <b>인증하기</b>'),
  ].join('');
  $('#verify-pass-row').hidden = free;
  $('#verify-submit').textContent = free ? '시작하기' : '인증하기';
  const url = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  $('#verify-acts').innerHTML = done ? '' : `<a class="btn btn-insta" href="${url}" target="_blank" rel="noopener">${icon('insta')} ${free ? '팔로우하러 가기' : '팔로우 · 댓글 달러 가기'}</a>`;
  const me = state.me || {};
  const hasName = !!(me.guest && me.player && me.player.username);
  const hasIg = !!(hasName && me.player.ig && !me.hidden);
  $('#verify-form').hidden = done;
  $('#verify-note').hidden = done || free;
  // 되찾기: 닉네임은 '아이디를 대충 적었을 때' 같이 찾는 용도 (안 적어도 됨)
  $('#verify-name-row').hidden = hasName && !restore;
  $('#verify-ig-row').hidden = hasIg && !restore;
  $('#verify-name-hint').textContent = restore ? '예전 랭킹 닉네임 · 아이디가 헷갈리면 같이 적어요' : '2~12자 · 랭킹에 보여요';
  $('#verify-name').value = hasName ? me.player.username : load('lastNick', '');
  $('#verify-ig').value = (me.player && me.player.ig) || load('lastIg', '');
  if (pass) $('#verify-pass').value = pass;
  $('#verify-err').hidden = true;
  $('#verify-req').hidden = true;
  $('#a2hs-inapp').hidden = !isInApp();
  openModal('modal-verify');
}

async function submitVerify() {
  const err = (t) => {
    $('#verify-err').textContent = t;
    $('#verify-err').hidden = false;
  };
  $('#verify-err').hidden = true;
  $('#verify-req').hidden = true;
  const body = { password: $('#verify-pass').value.trim() };
  if (state.verifyRestore) body.restore = true;
  if (!$('#verify-name-row').hidden && !(state.verifyRestore && !$('#verify-name').value.trim())) {
    const name = $('#verify-name').value.trim();
    if ([...name].length < 2) return err('닉네임을 2자 이상으로 써 주세요.');
    if (!/^[\p{L}\p{N}_. ]+$/u.test(name)) return err('닉네임은 한글·영문·숫자·_ . 만 쓸 수 있어요.');
    body.name = name;
  }
  if (!$('#verify-ig-row').hidden) {
    let ig = $('#verify-ig').value.trim().toLowerCase();
    const um = ig.match(/instagram\.com\/([^/?#\s]+)/);
    if (um) ig = um[1];
    ig = ig.replace(/^@+/, '');
    if (!/^[a-z0-9._]{1,30}$/.test(ig)) return err('인스타 아이디를 정확히 써 주세요. (영문·숫자·_ . 만)');
    body.ig = ig;
  }
  const free = freePass() && !state.verifyRestore;
  if (free) delete body.password;
  else if (!body.password) return err('DM 으로 받은 팔로워 암호를 적어 주세요.');
  if (!(await reconnectServer({ force: true }))) return err('지금은 서버에 연결이 안 돼서 인증할 수 없어요. 잠시 후 다시 해 주세요.');
  const btn = $('#verify-submit');
  btn.disabled = true;
  try {
    const { restored, bests, ...me } = await state.api.verifyPassword(body);
    state.me = me;
    if (bests && Object.keys(bests).length) save('bests', mergeBests(loadBests(), bests));
    if (body.name) save('lastNick', body.name);
    if (body.ig) save('lastIg', body.ig);
    $('#verify-pass').value = '';
    closeModal('modal-verify');
    refreshTitle();
    refreshFollowChip();
    renderLevels();
    save('wasTemp', !!me.temp);
    if (me.temp) toast(`🎉 ${freePassDay()}까지 전부 이용할 수 있어요! 그 뒤엔 팔로우 인증을 다시 받아야 해요`, 4600);
    else if (restored) toast(`📦 예전 기록을 되찾았어요! 「${restored.username}」 계정${restored.levels ? ` · ${restored.levels}개 단계` : ''} 그대로예요`, 4200);
    else if (state.verifyRestore) toast('이 인스타 아이디로 된 예전 랭킹 기록은 없었어요. 인증은 완료!', 3600);
    else toast(`🎉 팔로워 인증 완료! 잠긴 단계·💎 무제한·멀티·건의하기가 전부 열렸어요`, 3600);
    state.verifyRestore = false;
    submitRank();
    state.verifyFor = null;
    const then = state.verifyThen;
    state.verifyThen = null;
    if (then) setTimeout(then, 400);
  } catch (e) {
    const c = e.data && e.data.error;
    if (state.verifyRestore && (c === 'no_old' || c === 'bad_name' || c === 'need_password')) $('#verify-req').hidden = false;
    err(
      c === 'need_password' ? '예전 기록 되찾기는 팔로워 암호가 있어야 해요. 지금은 인스타 DM 이 막혀 있어서, 아래 「되찾기 요청」으로 보내 주세요.'
        : c === 'wrong_password' ? '암호가 달라요. DM 속 암호를 다시 확인해 주세요. (암호는 매주 바뀌어요)'
        : c === 'rate_limited' || e.status === 429 ? '너무 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요.'
        : c === 'bad_ig' ? '인스타 아이디를 정확히 써 주세요.'
        : c === 'no_old' || (c === 'bad_name' && state.verifyRestore)
          ? '예전 기록을 못 찾았어요. 예전 랭킹 닉네임도 같이 적어 보세요. 그래도 안 되면 아래 「되찾기 요청」을 보내 주세요 — 운영자가 찾아 드려요.'
        : c === 'bad_name' ? '닉네임을 2~12자로 써 주세요.'
        : c === 'password_off' ? '지금은 암호 인증을 쉬고 있어요. 아래 "아이디만 적고 신청하기"를 써 주세요.'
        : '인증하지 못했어요. 다시 시도해 주세요.'
    );
  } finally {
    btn.disabled = false;
  }
}

/** 단계 id → 칠 판 (숫자 = 일반 단계, 'endless' = 무제한 모드, 'e13' = 13단계 무제한, 'ch4' = 영상용 레벨업 챌린지 4단계까지) */
function playable(id) {
  if (id === ENDLESS_ID) return makeEndless();
  const sb = levelSurvivalBase(id);
  if (sb) return makeLevelEndless(sb, { intro: true });
  const eb = levelEndlessBase(id);
  if (eb) return makeLevelEndless(eb);
  if (typeof id === 'string' && /^ch\d+$/.test(id)) return makeEndless({ rounds: Number(id.slice(2)) });
  if (id === BEAT_ID) {
    const o = load('beatReel', null) || {};
    return withSync(makeBeatReel({ ...o, bars: songBars(beatOpts(o)) }));
  }
  if (isQuizId(id)) return makeQuizLevel(id);
  if (id === MY_ID) return my.level;
  if (id === UM_ID) return um.level;
  return getStudioLevel(id) || getLevel(id);
}
const isChallengeId = (id) => id === ENDLESS_ID || (typeof id === 'string' && /^(ch|e)\d+$/.test(id));
/** 앞 단계를 안 깨서 잠김 (팔로우 잠금과 별개) */
const progressLocked = (id) => !isUnlocked(id, loadBests());
function progressLockText(id) {
  if (id === ENDLESS_ID) return `${ENDLESS_FROM}단계 ${getLevel(ENDLESS_FROM).name}을 깨면 무제한 모드가 열려요 💎`;
  const eb = levelEndlessBase(id);
  if (eb) return `${eb.id}단계 ${eb.name}을 별 1개 이상으로 깨면 무제한이 열려요 💎`;
  const h = unlockHint(id, loadBests());
  return h && h.tier
    ? `${h.word} 단계를 아무거나 하나 별 1개 이상으로 깨면 ${h.word} 단계가 전부 열려요`
    : `${h && h.prev ? h.prev : prevOpenId(id)}단계를 별 1개 이상으로 깨면 ${id}단계가 열려요`;
}
const LOCK_FROM_PREV = (id) => (id === ENDLESS_ID ? `${ENDLESS_FROM}단계 깨면 열림` : (unlockHint(id, loadBests()) || { short: `${prevOpenId(id)}단계 깨면 열림` }).short);
const CLOSED_META = () => `<span class="lockline">${icon('lock')} 팔로워 암호</span>`;

// ---------------- 타이틀 ----------------
function buildTitle() {
  const scene = $('#title-scene');
  const timers = {};
  scene.querySelectorAll('.buddy').forEach((el) => {
    const who = el.classList.contains('buddy-kong') ? 'kong' : 'jjak';
    el.querySelector('.b-drum').src = buddyUrl('drum_' + who);
    const ch = el.querySelector('.b-char');
    ch.src = buddyUrl(who + '_idle');
    const bub = el.querySelector('.b-bubble');
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      await audio.unlock();
      if (who === 'kong') audio.kick();
      else audio.snare();
      bub.textContent = who === 'kong' ? '쿵!' : '짝!';
      for (const x of [el, bub]) x.classList.remove(x === el ? 'hit' : 'show');
      void el.offsetWidth;
      el.classList.add('hit');
      bub.classList.add('show');
      ch.src = buddyUrl(who + '_hit');
      clearTimeout(timers[who]);
      timers[who] = setTimeout(() => {
        ch.src = buddyUrl(who + '_idle');
        el.classList.remove('hit');
      }, 260);
    });
  });
  // 미리 받아 둠 (눌렀을 때 바로 바뀌게)
  loadBuddies();
  refreshQuick();
}

/** 결과·인증 화면용 쿵콩이·짝콩이 그림 */
function buddiesHTML(face, face2 = face) {
  return `<img alt="" src="${buddyUrl('kong_' + face)}" /><img alt="" src="${buddyUrl('jjak_' + face2)}" />`;
}

/** '바로 시작': 릴스 링크(?level=N)로 온 곡이 열려 있으면 그 곡, 아니면 아직 안 깬 첫 단계 */
function refreshQuick() {
  const q = getLevel(params.get('level'));
  const id = q && !progressLocked(q.id) && !closedLocked(q.id) ? q.id : nextChallenge(loadBests());
  state.quickId = id;
  $('[data-action="quickstart"]').innerHTML =
    id === ENDLESS_ID ? `${icon('play')} 바로 시작 <small>무제한 모드</small>` : `${icon('play')} 바로 시작 <small>${levelLabel(id)}</small>`;
}

/** 🔥 오늘의 챌린지: 오늘의 노래(이 폰에서 열 수 있는 곡 중) + 미션 + 연속 성공 */
const todayPick = () => todayLevel(new Date(), (id) => !closedLocked(id));
const todayMissionNow = () => { const lv = todayPick(); return { lv, mission: todayMission(noteCount(lv)) }; };

function refreshToday() {
  const { lv, mission } = todayMissionNow();
  const st = streakView(load('daily', null));
  $('#today-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#today-sub').textContent = st.doneToday ? `✅ 오늘 성공! · ${levelLabel(lv)}` : `🎯 ${mission.text} · ${levelLabel(lv)}`;
  $('#today-streak').textContent = st.streak ? `🔥 ${st.streak}일 연속` : '';
  const chip = $('#daily-chip');
  if (chip) {
    chip.classList.toggle('done', st.doneToday);
    chip.innerHTML = `<b>🔥 오늘의 챌린지</b><span>${st.doneToday ? '✅ 성공' : escapeHtml(mission.text)}${st.streak ? ` · ${st.streak}일 연속` : ''}</span><i>›</i>`;
  }
}

/** 결과 화면: 오늘의 노래를 쳤으면 미션 성공/남은 미션 표시 */
function showDailyResult(res) {
  const box = $('#res-daily');
  box.hidden = true;
  if (state.auto || res.practice || res.room) return;
  const { lv, mission } = todayMissionNow();
  if (String(res.levelId) !== String(lv.id)) return;
  const rec = load('daily', null);
  if (missionDone(mission, res)) {
    const { rec: next, isNew } = markDone(rec);
    if (isNew) save('daily', next);
    box.innerHTML = `🔥 오늘의 챌린지 성공!${next.streak > 1 ? ` <b>${next.streak}일 연속</b>` : ''}<small>내일 또 새 미션이 나와요</small>`;
    box.className = 'res-daily ok';
  } else if (!streakView(rec).doneToday) {
    box.innerHTML = `🎯 오늘의 챌린지: ${escapeHtml(mission.text)}<small>다시 해 보세요!</small>`;
    box.className = 'res-daily';
  } else return;
  box.hidden = false;
}

/** 시작 화면·단계 고르기의 작은 '팔로우·랭킹 참여' 버튼 */
function refreshFollowChip() {
  const me = state.me || {};
  const on = state.api && state.api.mode === 'server';
  for (const el of $$('.follow-chip')) {
    el.hidden = !on;
    el.classList.toggle('warn', !!me.hidden);
    el.classList.toggle('todo', !me.hidden && !me.confirmed);
    el.classList.toggle('ok', !me.hidden && !!me.confirmed);
    el.textContent = me.hidden
      ? '⚠️ 팔로우 확인 안 됨'
      : (!me.guest || me.needsIg || !me.confirmed) && freePass()
        ? `📝 이용 등록 · 랭킹 참여`
        : !me.guest || me.needsIg
        ? `📸 팔로워 인증 받기 · 랭킹 참여`
        : me.confirmed && me.temp && freePass()
          ? `✅ ${freePassDay()}까지 이용 가능`
          : me.confirmed
          ? `✅ @${me.player?.ig || ''} 팔로워 인증 완료`
          : `📸 팔로워 인증 받기 · 랭킹 참여`;
  }
}

function refreshTitle() {
  refreshFollowChip();
  syncCoinAccount();
  refreshCoins();
  // 🆓 임시 인증 기간 안내 (인스타 DM 막힘)
  const fp = $('#free-pass-note');
  fp.hidden = !(state.api && state.api.mode === 'server' && freePass());
  if (!fp.hidden) fp.querySelector('span').innerHTML = `인스타 DM 이 잠시 막혀서 <b>${freePassDay()}까지는</b> 4단계부터·무제한·멀티 전부 이용할 수 있어요! 그 뒤엔 팔로우 인증을 다시 받아야 해요.`;
  // 멀티·건의하기는 팔로워 인증한 사람만 → 안 했으면 🔒
  const lockMark = followGated() ? '🔒 ' : '';
  $('.mode-multi b').innerHTML = `${icon('swords', true)} ${lockMark}멀티`;
  $('[data-action="suggest-open"] span:not([data-icon])').textContent = `${lockMark}건의하기`;
  refreshToday();
  refreshQuick();
  const foot = $('#title-foot');
  if (state.me.guest) {
    foot.innerHTML = `<b>${escapeHtml(state.me.player?.username || '')}</b> 님, 오늘도 쿵짝!`;
  } else {
    foot.innerHTML = handle() ? `만든 곳 <a href="https://instagram.com/${handle()}" target="_blank" rel="noopener">${atHandle()}</a> · 새 곡 소식은 인스타에서!` : '모두 아는 명곡에 맞춰 드럼을 쳐 보세요!';
  }
}

// ---------------- 레벨 목록 ----------------
/** 단계 목록 보기: 'normal' = 일반 단계 / 'endless' = 단계별 무제한 */
function levelMode() {
  const m = load('levelMode', 'normal');
  return m === 'endless' || m === 'long' ? m : 'normal';
}

// ---------------- 🎭 장거리: 곡 하나를 처음부터 끝까지 (왼손 쿵 + 오른손 피아노 멜로디) ----------------
function renderLongLevels() {
  const bests = loadBests();
  $('#level-list').innerHTML = LEVELS.filter((l) => l.long)
    .map((lv) => {
      const vLock = closedLocked(lv.id) || verifyLocked(lv.id);
      const b = bests[lv.id];
      const meta = vLock
        ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
        : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
      return `<button class="level-card long-card ${vLock ? 'locked' : ''}" data-level="${lv.id}">
      <div class="lv"><span class="ev">${icon('hall', true)}<small>장거리</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.sub ? `${lv.sub} · ` : ''}${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
    })
    .join('');
  refreshToday();
  $('#levels-foot').innerHTML = '🎭 장거리는 곡 하나를 <b>처음부터 끝까지</b> 쳐요.<br>왼쪽 엄지는 <b>쿵</b>, 오른쪽 엄지는 <b>멜로디</b> — 누를 때마다 그 음이 <b>피아노</b>로 나요. 놓치면 그 음은 안 들려요!';
}

/** 그리그 무제한 모드 카드 (12단계를 깨고 팔로워 인증을 받으면 열림) */
function grieggCardHTML(bests) {
  const eVLock = verifyLocked(ENDLESS_ID);
  const eLock = eVLock || !isUnlocked(ENDLESS_ID, bests);
  const eb = bests[ENDLESS_ID];
  return `<button class="level-card endless-card ${eLock ? 'locked' : ''}" data-level="${ENDLESS_ID}">
      <div class="lv"><span>∞</span></div>
      <div class="info"><h4>무제한 모드 <small>그리그</small></h4><p>깰수록 BPM +10 · 속도 한도 없음</p><p class="gem-rule">💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어</p></div>
      <div class="meta">${eLock ? `<span class="lockline">${icon('lock')} ${eVLock ? '팔로워 인증' : LOCK_FROM_PREV(ENDLESS_ID)}</span>` : `${gemsHTML(eb ? eb.diamonds || 0 : 0, 'sm')}<span>${eb ? `최고 Lv.${eb.roundsCleared || 0} 클리어` : 'NEW'}</span>`}</div>
    </button>`;
}

/** 무제한 보기: 맨 위에 그리그 무제한(랭킹) + 단계별 무제한 (지금은 전부 준비 중) */
/** 단계 묶음 제목 (묶음마다 맵 분위기가 다름) */
function groupHeadHTML(id) {
  const g = groupStarting(id);
  if (!g) return '';
  return `<div class="level-group theme-${g.key}" role="presentation">${icon(g.theme.icon, true)}<b>${g.key === 'xmas' ? '크리스마스 이벤트' : g.theme.name}</b><small>${g.key === 'xmas' ? '기간 한정 특별 곡' : `${g.from}~${g.to}단계 맵`}</small></div>`;
}

function renderEndlessLevels(bests) {
  const list = [grieggCardHTML(bests)];
  for (const lv of MAIN_LEVELS) {
    const id = levelEndlessId(lv.id);
    const closed = closedLocked(id);
    const prevLock = !isUnlocked(id, bests);
    const vLock = verifyLocked(id);
    const locked = closed || prevLock || vLock;
    const b = bests[id];
    const meta = closed
      ? CLOSED_META()
      : vLock
      ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
      : prevLock
      ? `<span class="lockline">${icon('lock')} ${lv.id}단계 깨면 열림</span>`
      : `${gemsHTML(b ? b.diamonds || 0 : 0, 'sm')}<span>${b ? `최고 Lv.${b.roundsCleared || 0}` : 'NEW'}</span>`;
    list.push(groupHeadHTML(lv.id));
    list.push(`<button class="level-card endless-card lv-endless ${locked ? 'locked' : ''}" data-level="${id}">
      <div class="lv"><span>${lv.id}<small>∞</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.bpm} BPM부터 · 4마디마다 +${LEVEL_ENDLESS_STEP}</p></div>
      <div class="meta">${meta}</div>
    </button>`);
  }
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() || freePass() ? '' : `🔒 💎 무제한 모드는 <b>${igWho()} 팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}12단계를 깨면 그리그 무제한이 열려요. 목숨이 다 떨어질 때까지 계속!<br>단계별 무제한은 그 단계를 깨면 열려요.<br>💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어`;
}

function renderLevels() {
  const bests = loadBests();
  const mode = levelMode();
  $$('#level-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  if (mode === 'endless') {
    renderEndlessLevels(bests);
    return;
  }
  if (mode === 'long') {
    renderLongLevels();
    return;
  }
  // 🎄 크리스마스 이벤트 곡은 맨 위에
  const list = [...LEVELS.filter((l) => l.xmas), ...LEVELS.filter((l) => !l.xmas && !l.long)].map((lv) => {
    const prevLock = !isUnlocked(lv.id, bests);
    const closed = closedLocked(lv.id);
    const vLock = verifyLocked(lv.id);
    const locked = closed || prevLock || vLock;
    const b = bests[lv.id];
    const meta = closed
      ? CLOSED_META()
      : vLock
      ? `<span class="lockline">${icon('lock')} 팔로워 인증</span>`
      : prevLock
      ? `<span class="lockline">${icon('lock')} ${LOCK_FROM_PREV(lv.id)}</span>`
      : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
    const fresh = lv.newUntil && Date.now() < Date.parse(`${lv.newUntil}T23:59:59+09:00`);
    return `${groupHeadHTML(lv.id)}<button class="level-card ${locked ? 'locked' : ''} ${lv.boss ? 'boss' : ''} ${lv.xmas ? 'xmas' : ''} ${lv.extreme ? 'extreme' : ''}" data-level="${lv.id}">
      ${fresh ? '<span class="newtag">NEW</span>' : ''}
      <div class="lv">${lv.xmas ? `<span class="ev">${icon('tree', true)}<small>이벤트</small></span>` : `<span>${lv.id}<small>단계</small></span>`}</div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}${lv.extreme ? '<span class="extreme-chip">☠ 게임에서 제일 어려움</span>' : ''}</div>
      <div class="meta">${meta}</div>
    </button>`;
  });
  // 맨 아래: 그리그 무제한 모드 (12단계 깨면 열림)
  list.push(grieggCardHTML(bests));
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() || freePass() ? '' : `🔒 1~${FREE_UPTO}단계는 맛보기! ${FREE_UPTO + 1}단계부터와 💎 무제한은 <b>팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요.<br><b>같은 난이도를 하나 깨면 그 난이도는 전부 열려요</b> (예: 지옥 하나 깨면 지옥 전부)<br>별 3개: ${STAR_RULES[0].text}`;
}

// ---------------- 게임 ----------------
/** free: 오늘의 노래·친구 도전장은 앞 단계를 안 깼어도 칠 수 있음 */
async function tryStart(id, { free = false } = {}) {
  // 4단계부터와 무제한은 팔로워 인증(인증 완료)해야 열림
  if (closedLocked(id)) {
    openVerify(id);
    return;
  }
  // 팔로워 인증 단계는 앞 단계를 안 깼어도 신청은 미리 할 수 있게 먼저 안내
  if (verifyLocked(id)) {
    openVerify(id);
    return;
  }
  if (!free && progressLocked(id)) {
    toast(progressLockText(id), 2800);
    if ($('#screen-title').classList.contains('active')) {
      renderLevels();
      show('screen-levels');
    }
    return;
  }
  startLevel(id);
}

// 구글 글꼴(Jua)은 한글을 글자 묶음별로 나눠 받아서, 캔버스에만 쓰는 글자는 따로 받아 둬야 깨지지 않음
const CANVAS_TEXT = '도레미파솔라시#멜로디쿵짝챙츠둥왼쪽오른엄지킥스네어하이햇크래시탐연타황금콩다가온선에닿을때그줄을톡여기눌러도OK키클릭NEW노을피크닉네온시티콘서트홀블랙스테이지용암보스전오로라설원우주무대크리스마스마을GROOVECOMBO점';
async function fontsReady(extra = '') {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Jua"'), document.fonts.load('40px "Jua"', CANVAS_TEXT + extra)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {}
}

// 곡 시작은 비동기(악기 소리 불러오기 등)라서, 같은 단계를 빠르게 두 번 누르면 게임이 둘 생겨
// 먼저 만든 쪽이 카운트인 중에 이미 진행되던 버그가 있었음 → 마지막 호출만 살리고 앞선 호출은 중단
let startSeq = 0;
/** 🐢 느리게 연습: 같은 채보를 rate 배 빠르기로 (목숨·기록·랭킹 없음) */
/** 🎲 랜덤 대결 N곡째 빠르기: 1곡째 그대로, 한 곡마다 +7%, 최대 1.5배 */
function rushSpeed(round) {
  return Math.min(1.5, 1 + 0.07 * Math.max(0, (round | 0) - 1));
}
function practiceLevel(lv, rate) {
  return { ...lv, bpm: Math.round(lv.bpm * rate * 10) / 10, practice: rate };
}
/** 연습으로 칠 수 있는 판인가 (일반 단계만. 무제한·멀티·영상 찍기 X) */
const canPractice = (lv) => !!lv && !lv.challenge && !lv.studioOnly && !lv.custom && !state.studio.active && !document.body.classList.contains('room-game') && !state.auto;

async function startLevel(id, opts = {}) {
  const base = playable(id);
  if (!base) return;
  const practice = !opts.room && opts.practice && canPractice(base) ? opts.practice : 0;
  state.practice = practice;
  // 🎲 랜덤 대결: 곡이 넘어갈수록 빨라짐 (두 사람 다 round 로 같은 빠르기)
  const rushRate = opts.room && opts.room.rush ? rushSpeed(opts.room.round) : 1;
  let lv = practice ? practiceLevel(base, practice) : rushRate > 1 ? { ...base, bpm: Math.round(base.bpm * rushRate * 10) / 10 } : base;
  if (state.studio.active && isFailFormat() && typeof lv.id === 'number' && !lv.challenge) lv = failLevel(lv);
  // 친구 대결 방 판: { startAt(내 시계 ms), mode } — 같은 시각에 시작, 랭킹엔 안 올림
  // 🏆 랭킹전 판: 실시간 { startAt(내 시계 ms), mode, round } / 고스트 { ghost, gid } — 랭킹엔 안 올림
  const room = opts.room || null;
  const live = !!room && !room.ghost;
  document.body.classList.toggle('room-game', !!room);
  // 처음 한 번은 박자 보정을 꼭 하고 시작 (영상 찍기·자동 연주는 제외. 대결 방은 '준비' 전에 미리 함)
  if (!room && needsCalibration()) {
    openCalibration({ required: true, after: () => startLevel(id, opts) });
    return;
  }
  const seq = ++startSeq;
  const stale = () => seq !== startSeq;
  state.levelId = id;
  await audio.unlock();
  if (stale()) return;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  audio.orchOn = state.settings.band !== 'piano';
  if (state.game) state.game.stop();
  closeModal('modal-pause');
  show('screen-game');
  $('#hud-lv').textContent = practice ? `🐢 연습 ${Math.round(practice * 100)}%` : lv.userMap ? '🎹 유저 맵' : lv.custom ? '🎵 내 노래' : lv.survival ? '⚔️ 서바이벌' : lv.challenge ? (lv.endless ? '무제한' : '챌린지') : lv.studioOnly ? '🎬 릴스용' : levelLabel(lv);
  $('#hud-name').textContent = lv.challenge ? `${lv.songName} · ${lv.composer}` : `${lv.name} · ${lv.composer}`;
  if (room && room.rush) $('#hud-lv').textContent = `🎲 ${room.round}곡째${rushRate > 1 ? ` · ⚡${rushRate.toFixed(2).replace(/0$/, '')}배` : ''}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  closeModal('modal-continue');
  const st = state.studio;
  renderLives(st.active || state.auto || practice || lv.custom ? null : MAX_LIVES);
  const vs = room && room.ghost ? room.ghost : !room && !st.active && !practice && !lv.challenge && state.vs && state.vs.levelId === id ? state.vs : null;
  $('#hud-vs').hidden = !vs && !room;
  if (vs || room) {
    $('#vs-name').textContent = vs ? vs.name : (state.roomClient.realtime ? '⚡' : '') + roomOtherName();
    $('#vs-me').textContent = '0';
    $('#vs-op').textContent = '0';
    $('#vs-fill').style.width = '50%';
  }
  // 악기 샘플이 아직이면 잠깐 기다림 (최대 3초. 피아노가 안 되면 합성음, 오케스트라는 받는 대로 중간부터 합류)
  const orchLoad = audio.orchOn ? audio.loadOrch() : Promise.resolve();
  await Promise.race([Promise.all([audio.loadPiano(), orchLoad]), new Promise((r) => setTimeout(r, 3000))]);
  if (stale()) return;
  // 🎤 녹음된 곡(노래 파일)은 다 받아야 시작 (못 받으면 단계 고르기로)
  if (lv.song && lv.song.audio && !audio.trackBuffer(lv.song.audio.src)) {
    toast('🎤 노래 받는 중…', 2500);
    const buf = await audio.loadTrack(lv.song.audio.src);
    if (stale()) return;
    if (!buf) {
      show('screen-levels');
      toast('노래를 받지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요', 3000);
      return;
    }
  }
  $('#screen-game').classList.toggle('studio-mode', st.active);
  renderer.studio = st.active ? studioOverlay(lv) : null;
  setKit(lv);
  await fontsReady(renderer.studio ? `${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}` : '');
  await new Promise((r) => requestAnimationFrame(r));
  const cw = $('#game-canvas').clientWidth || window.innerWidth;
  await renderer.resize(st.active ? Math.min(3, Math.max(2, 1080 / cw)) : 2);
  if (stale()) return;
  awardRunCoins(state.game); // 판 도중에 다시 시작하면 그때까지 맞힌 만큼 (새 판 토큰을 받기 전에)
  if (state.game) state.game.stop();
  state.runToken = null;
  // 영상 찍기는 팔로우 잠금 없이 (계정 주인이 촬영용으로 씀) → 서버 판 토큰도 안 받음
  // 인증 안 한 사람이 1~3단계를 칠 땐 랭킹에 못 올리니 판 토큰도 안 받음 (서버 요청 아끼기, 통계는 5분마다 따로 감)
  // 서버 없는 모드면 가끔 다시 붙어 봄 (간격은 reconnectServer 가 정함, 기다리지 않음)
  if (state.api && state.api.mode !== 'server') reconnectServer();
  const canRank = isConfirmed() || state.cfg.gateMode === 'open' || isClosed(id);
  syncCoinAccount();
  if ((!lv.challenge || lv.endless) && !st.active && !room && !practice && !lv.custom && canRank) state.api
    .startRun(id)
    .then((r) => {
      state.runToken = r.runToken;
      if (state.game && state.game.level.id === id && !state.game._coined) state.game._runToken = r.runToken;
    })
    .catch((e) => {
      if (e.status === 403 && state.game && state.game.level.id === id) {
        state.game.stop();
        show('screen-levels');
        if (e.data && e.data.error === 'verify_required') {
          state.me = { ...state.me, checked: false };
          renderLevels();
          openVerify(id);
          return;
        }
        if (e.data && /^confirm_/.test(e.data.error)) {
          state.me = { ...state.me, confirmed: false };
          renderLevels();
          openVerify(id);
          return;
        }
        toast('판을 시작하지 못했어요. 다시 해 보세요', 2600);
      }
    });
  const last = { score: -1, p: -1, op: -1, lives: MAX_LIVES, stars: -1, shown: -1 };
  // 실시간 대결: 상대 점수는 몇 초 늦게 옴 → 내 점수도 '상대가 보낸 진행 위치' 때의 점수로 보여 줘야 같은 지점끼리 비교됨
  const myHist = []; // [진행, 점수] (진행 순)
  const myScoreAt = (p) => {
    let lo = 0, hi = myHist.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (myHist[mid][0] <= p) { ans = myHist[mid][1]; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  };
  $('#hud-coin').textContent = '0';
  $('#hud-coin-box').hidden = !!(state.auto || st.active);
  renderer.coinFx = !(state.auto || st.active);
  const starBox = $('#hud-stars');
  starBox.hidden = !!lv.endless;
  starBox.innerHTML = starsHTML(0);
  state.game = new Game({
    audio,
    renderer,
    level: lv,
    settings: state.settings,
    auto: state.auto,
    onHud: (h) => {
      if (h.score !== last.score) $('#hud-score').textContent = fmt(h.score);
      const cn = runCoins(state.game);
      if (cn !== last.coins) {
        const el = $('#hud-coin');
        el.textContent = fmt(cn);
        // 통통 튐: 튀는 중이면 그냥 둠 (예전엔 맞힐 때마다 offsetWidth 로 화면 배치를 강제로 다시 계산 → 빽빽한 곳에서 프레임마다)
        const box = el.parentNode;
        if (cn > (last.coins || 0) && !box.classList.contains('bump')) {
          box.classList.add('bump');
          setTimeout(() => box.classList.remove('bump'), 360);
        }
        last.coins = cn;
      }
      const p = Math.round(h.progress * 200);
      if (p !== last.p) $('#hud-progress').style.width = p / 2 + '%';
      if (live) {
        // 내 점수는 다음 주고받기 때 같이 감 (2초마다), 상대 점수는 받은 값
        state.roomClient.send({ live: { score: h.score, combo: state.game ? state.game.combo : 0, progress: h.progress, lives: h.lives } });
        const o = state.roomClient.other;
        const op = o && o.final ? o.final.score : o && o.live ? o.live.score : 0;
        // ⚔️ 개인전: 상대가 목숨을 다 써서 끝났거나 방을 나갔으면 이 판도 바로 끝 → 내가 이김
        //   (무제한 서바이벌은 곡 끝이 없으니 상대 판이 끝났다는 건 쓰러졌다는 것)
        const opDown = !o || (o.left && !o.final) || (o.final && (lv.survival || o.final.died));
        if (room.mode === 'versus' && opDown && state.game && state.game.state === 'playing') {
          state.game.endNow();
          return;
        }
        const rtNow = state.roomClient.realtime;
        if (rtNow !== last.rt) {
          $('#vs-name').textContent = (rtNow ? '⚡' : '') + roomOtherName();
          last.rt = rtNow;
        }
        const seq = !lv.endless && !lv.roundProgress;
        if (seq && (!myHist.length || h.progress > myHist[myHist.length - 1][0])) myHist.push([h.progress, h.score]);
        else if (seq && myHist.length) myHist[myHist.length - 1][1] = h.score;
        // 상대가 끝냈으면(final) 지금 내 점수, 아니면 상대가 보낸 진행 위치 때의 내 점수
        const me = seq && o && !o.final && o.live && o.live.progress < h.progress ? myScoreAt(o.live.progress) : h.score;
        if (op !== last.op || me !== last.shown) {
          $('#vs-me').textContent = fmt(me);
          const ol = o && o.live && o.live.lives != null ? ` ♥${o.live.lives}` : '';
          $('#vs-op').textContent = room.mode === 'team' ? `${fmt(op)} · 팀 ${fmt(h.score + op)}` : fmt(op) + ol;
          const tot = me + op;
          $('#vs-fill').style.width = (tot ? (me / tot) * 100 : 50).toFixed(1) + '%';
          last.shown = me;
        }
        last.op = op;
      } else if (vs) {
        const op = opponentScoreAt(vs.timeline, h.barPos);
        if (op !== last.op || h.score !== last.score) {
          $('#vs-me').textContent = fmt(h.score);
          $('#vs-op').textContent = fmt(op);
          const tot = h.score + op;
          $('#vs-fill').style.width = (tot ? (h.score / tot) * 100 : 50).toFixed(1) + '%';
        }
        last.op = op;
      }
      if (h.round && h.round !== last.round) {
        $('#hud-name').textContent = `Lv.${h.round.round} · ${h.round.name} · ${h.round.bpm} BPM`;
        last.round = h.round;
      }
      if (h.lives != null && h.lives !== last.lives) {
        renderLives(h.lives, last.lives);
        last.lives = h.lives;
      }
      if (h.stars != null && h.stars !== last.stars) {
        starBox.innerHTML = starsHTML(h.stars);
        // 새로 생긴 별만 톡 튀어나오게
        if (last.stars >= 0) starBox.querySelectorAll('svg').forEach((el, i) => i >= last.stars && i < h.stars && el.classList.add('pop'));
        last.stars = h.stars;
      }
      last.score = h.score;
      last.p = p;
    },
    onEnd: (res) => {
      res.coins = awardRunCoins(state.game);
      if (lv.custom) return lv.userMap ? umFinish(res) : myFinish(res);
      if (room) rk.game = null;
      if (!state.studio.active && !res.auto && !res.practice) trackPlayEnd({ result: res.failed || res.died ? 'fail' : 'clear', score: res.score, stars: res.stars });
      if (room && room.ghost) res.room = { mode: 'versus', ghost: room.ghost, gid: room.gid };
      if (live && state.roomClient.active) {
        res.room = { mode: room.mode, round: room.round, ranked: !!room.ranked, rush: !!room.rush };
        state.roomClient.send(
          { final: { score: res.score, stars: res.stars, grade: res.grade, failed: !!res.failed, maxCombo: res.maxCombo, accuracy: res.accuracy, died: !!(res.died || res.failed), survived: res.survived || 0, lv: res.roundReached || 0 } },
          true
        );
      }
      return state.studio.active ? studioFinish(res) : showResult(res);
    },
    // 영상 찍기 땐 목숨 없음 (녹화 중에 멈추면 안 되니까). 멀티는 광고 이어하기 없이 그 자리에서 끝
    // 🐢 연습은 목숨 없이 끝까지
    onDeath: st.active ? (lv.failReel ? studioFailDeath : null) : practice ? null : lv.userMap && um.from === 'list' && um.mode === 'hearts' ? umDeath : lv.custom ? null : room ? onRoomDeath : onDeath,
  });
  if (live) {
    // 상대와 같은 시각에 시작: 남은 시간 카운트다운 (Game.start 가 0.35초 뒤에 첫 박을 놓음)
    const box = $('#studio-count');
    box.hidden = false;
    $('#studio-count-msg').textContent = room.rush ? `🎲 ${room.round}곡째${rushSpeed(room.round) > 1 ? ` (⚡${Math.round(rushSpeed(room.round) * 100)}% 빠르기)` : ''}! ${roomOtherName()} 님과 대결` : room.ranked ? `🏆 ${roomOtherName()} 님과 랭킹전!` : room.mode === 'team' ? '🤝 팀전! 둘이 같이 깨 봐요' : `⚔️ ${roomOtherName()} 님과 대결!`;
    const g = state.game;
    // 기다리는 동안 무대(맵)를 그려 둠
    renderer.draw({ now: -1, notes: g.notes, approach: g.approach, beatDur: g.beat, combo: 0, score: 0, playing: false }, performance.now() / 1000);
    await new Promise((resolve) => {
      const tick = () => {
        if (stale() || state.game !== g) return resolve();
        const left = room.startAt - 350 - Date.now();
        $('#studio-count-num').textContent = String(Math.max(1, Math.ceil(left / 1000)));
        if (left <= 0) return resolve();
        setTimeout(tick, Math.min(100, left));
      };
      tick();
    });
    box.hidden = true;
    if (stale() || state.game !== g) return;
  }
  let stallToastAt = 0;
  const sg = state.game;
  sg.onStall = () => {
    // 소리 시계가 멈춰도 게임은 화면 시계로 계속 감 (game._virt) → 안내만 가끔
    if (Date.now() - stallToastAt < 10000) return;
    stallToastAt = Date.now();
    toast('🔇 폰이 소리를 잠깐 멈췄어요. 화면을 톡 누르면 소리가 다시 나요', 3000);
  };
  // 🎵 내 노래: 녹화 버튼을 켰으면 시작과 같이 녹화
  if (lv.custom && !lv.userMap && my.rec) {
    await stopRecorder(); // 다시 치기: 앞 판 녹화가 남아 있으면 버림
    startRecorder();
  }
  if (state.runToken && !state.game._runToken) state.game._runToken = state.runToken;
  state.game.start();
  if (lv.synced && st.active) scheduleSyncRec(state.game);
  // 영상 찍기·자동 연주·내 노래는 통계에 안 셈
  if (!st.active && !state.auto && !practice && !lv.custom) trackPlayStart(lv.survival ? lv.baseId : id, vs || room ? 'vs' : 'normal');
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  canvasRect = null;
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
  applyDeco();
  renderer.setTheme(lv); // 단계 묶음마다 맵 분위기가 다름 (themes.js)
  // 마우스·키보드 쓰는 컴퓨터면 줄마다 키 글자를 보여줌 (폰·태블릿은 안 보임)
  renderer.keyLabels = null;
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const letters = KEY_LABELS[renderer.laneOrder.length] || KEY_LABELS[2];
    renderer.keyLabels = {};
    renderer.laneOrder.forEach((lane, i) => (renderer.keyLabels[lane] = letters[i]));
  }
}

/** 누른 줄의 악기 (원근으로 비스듬한 줄 모양 그대로. 악기 그림을 정확히 안 눌러도 됨) */
//   캔버스 자리는 기억해 둠 (손가락 움직임마다 getBoundingClientRect 로 화면 배치를 다시 계산하지 않게). 판 시작·화면 크기 바뀔 때 비움
let canvasRect = null;
function laneFromPoint(x, y) {
  let r = canvasRect;
  if (!r) {
    r = $('#game-canvas').getBoundingClientRect();
    if (r.width > 0) canvasRect = r;
  }
  return renderer.laneHit(x - r.left, y - r.top);
}

/** 화면 터치 → 게임 입력 (옆 줄 정보까지 넘겨서 경계 근처 터치를 봐줌) */
function tapAt(x, y, perfMs, soft = false) {
  const { lane, near, u } = laneFromPoint(x, y);
  state.game.input(lane, perfMs, near, u, soft);
}

// 키보드: 레인 수에 따라 왼쪽부터 키 배정
const KEYMAP = {
  2: [['KeyF', 'KeyD', 'KeyA', 'ArrowLeft'], ['KeyJ', 'KeyK', 'KeyL', 'ArrowRight']],
  3: [['KeyF', 'KeyD', 'ArrowLeft'], ['KeyJ', 'ArrowDown'], ['KeyK', 'KeyL', 'ArrowRight']],
  4: [['KeyD', 'KeyS'], ['KeyF', 'ArrowLeft'], ['KeyJ', 'ArrowRight'], ['KeyK', 'KeyL']],
  5: [['KeyS', 'KeyA'], ['KeyD'], ['KeyF', 'ArrowLeft'], ['KeyJ', 'ArrowRight'], ['KeyK', 'KeyL']],
};

// 화면에 보여줄 키 글자 (KEYMAP 의 첫 번째와 같게)
const KEY_LABELS = { 2: ['F', 'J'], 3: ['F', 'J', 'K'], 4: ['D', 'F', 'J', 'K'], 5: ['S', 'D', 'F', 'J', 'K'] };

function bindGameInput() {
  const canvas = $('#game-canvas');
  // 폰·태블릿: 손가락마다 touchstart 의 changedTouches 로 바로 받음 (두 엄지가 거의 동시에 닿아도 하나씩 다 들어옴).
  //   pointerdown 은 마우스·펜(그리고 터치 이벤트가 없는 기기의 터치)만 → 같은 터치를 두 번 치지 않게
  const touchEvents = 'ontouchstart' in window;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (!state.game || (touchEvents && e.pointerType === 'touch')) return;
      if (!e.isTrusted) state.game.fakeTaps++;
      tapAt(e.clientX, e.clientY, e.timeStamp);
    },
    { passive: false }
  );
  // 눌려 있는 손가락 (identifier → 마지막으로 본 시각·자리). 아래 touchmove '되살리기'용
  const held = new Map();
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      // 게임 시작 전부터 대고 있던 손가락도 기억 (안 그러면 시작 뒤 첫 움직임이 '새 터치'로 잡힘)
      for (const t of e.changedTouches) held.set(t.identifier, { at: e.timeStamp, x: t.clientX, y: t.clientY, u: state.game ? laneFromPoint(t.clientX, t.clientY).u : null });
      if (!state.game) return;
      if (!e.isTrusted) state.game.fakeTaps += e.changedTouches.length;
      for (const t of e.changedTouches) tapAt(t.clientX, t.clientY, e.timeStamp);
    },
    { passive: false }
  );
  // 손가락 움직임(touchmove)이 사실은 '새로 누른 것'일 수 있는 두 경우 → '부드러운 터치'(soft)로 넘김:
  //   맞힐 콩이 GREAT 범위에 있을 때만 치고, 아니면 아무 일도 없음 (헛침·MISS 벌 없음, game._softTap)
  //   ① 아이폰이 손가락 하나의 '뗌'(touchend)을 놓치면, 그 근처를 새로 눌러도 그 '유령 손가락'의 움직임으로만 올 수 있음
  //      → 한동안(0.25초) 조용하던 손가락이 10px 넘게 옮겨 옴
  //   ② 두 엄지가 가까이(4줄 곡의 쿵·짝은 화면 가운데에 붙어 있음) 거의 동시에 닿으면 폰이 둘을 손가락 하나가 움직인 걸로 합쳐 보낼 수 있음
  //      → 누른 손가락이 다른 줄로 넘어감 (줄 경계에서 줄 너비 0.15 넘게 들어가야, 경계에서 떨리는 건 안 셈)
  //      (2026-11-22 '윌리엄 텔 쿵짝쿵에서 분명히 눌렀는데 쿵이나 짝 하나가 안 눌림' 문의)
  //   ⚠ 2026-11-22 저녁 ①의 기준을 70ms·4px 로 줄이고 보통 터치처럼 셌더니, 누른 채 살짝 굴리며 떼는 손가락이
  //   터치 한 번 더로 잡혀 헛침(하트)·MISS 가 쏟아짐 → '터치가 자꾸 씹혀요' 댓글 폭주. 같은 줄 기준을 줄이거나 벌을 주지 말 것
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      for (const t of e.changedTouches) {
        const h = held.get(t.identifier);
        const { u } = laneFromPoint(t.clientX, t.clientY);
        let revived = !h || (e.timeStamp - h.at > 250 && Math.hypot(t.clientX - h.x, t.clientY - h.y) > 10);
        let hu = h && h.u != null ? h.u : u;
        if (!revived && u != null && hu != null) {
          // 줄 경계에서 0.15 넘게 다른 줄 안으로 들어옴 (길 밖 가장자리는 맨 끝 줄로 봄)
          const n = renderer.laneOrder.length;
          const cl = (v) => Math.min(n - 1e-6, Math.max(0, v));
          const pi = Math.floor(cl(hu));
          const cu = cl(u);
          if (cu >= pi + 1.15 || cu <= pi - 0.15) revived = true;
        }
        if (revived) hu = u;
        held.set(t.identifier, { at: e.timeStamp, x: t.clientX, y: t.clientY, u: hu });
        if (revived) tapAt(t.clientX, t.clientY, e.timeStamp, true);
      }
    },
    { passive: false }
  );
  for (const ev of ['touchend', 'touchcancel'])
    canvas.addEventListener(ev, (e) => {
      for (const t of e.changedTouches) held.delete(t.identifier);
    });
  ['gesturestart', 'dblclick', 'contextmenu'].forEach((ev) =>
    canvas.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
  );
  window.addEventListener('keydown', (e) => {
    if (!$('#screen-game').classList.contains('active') || !state.game) return;
    // 방금 누른 버튼에 포커스가 남아 있으면 스페이스·엔터가 그 버튼을 또 눌러 버림
    if (document.activeElement && document.activeElement !== document.body && !$('#modal-pause').offsetParent) document.activeElement.blur();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      togglePause();
      return;
    }
    if (e.repeat) return;
    if (!e.isTrusted) state.game.fakeTaps++;
    const order = state.game.laneOrder;
    const idx = (KEYMAP[order.length] || KEYMAP[2]).findIndex((keys) => keys.includes(e.code));
    if (idx >= 0) state.game.input(order[idx], e.timeStamp);
    else if (e.code === 'Space') {
      state.game.input(0, e.timeStamp);
      state.game.input(1, e.timeStamp);
    } else return;
    e.preventDefault();
  });
}

function togglePause() {
  const g = state.game;
  if (!g) return;
  if (g.state === 'playing') {
    g.pause();
    $('#pause-stuck').hidden = true;
    $('#pause-title').textContent = '잠깐 쉬어요';
    openModal('modal-pause');
  } else if (g.state === 'paused') resumeGame();
}

async function resumeGame() {
  closeModal('modal-pause');
  const g = state.game;
  if (!g || g.state !== 'paused') return;
  await countdownResume(g);
}

/** 3초 카운트다운 후 재개 (손가락 올릴 시간) */
async function countdownResume(g) {
  for (const n of ['3', '2', '1']) {
    toast(n, 450);
    await new Promise((r) => setTimeout(r, 450));
  }
  if (state.game !== g || g.state !== 'paused') return;
  await audio.unlock();
  g.resume();
}

// ---------------- 목숨 · 이어하기 ----------------
/** HUD 하트 n개 (null 이면 숨김). prev 보다 줄면 깨지는 연출, 늘면 통통 */
function renderLives(n, prev) {
  const box = $('#hud-lives');
  if (n == null) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) => {
    const cls = i < n ? 'on' : 'off';
    const fx = prev != null && i >= n && i < prev ? ' lost' : prev != null && i < n && i >= prev ? ' gain' : '';
    return `<i class="${cls}${fx}">${icon('heart')}</i>`;
  }).join('');
  box.classList.toggle('low', n === 1);
}

/** 이어하기 창이 뜬 뒤 이 시간(ms) 동안은 창 안 버튼이 눌리지 않음 (터치 중이던 손가락 오입력 방지) */
const CONT_GUARD_MS = 500;
let contOpenedAt = -Infinity;

/** 목숨 0개: 게임이 멈춘 상태로 이어하기 창 */
function onDeath(info) {
  const g = state.game;
  const lv = g.level;
  state.death = info;
  contOpenedAt = performance.now();
  $('#cont-score').textContent = `${fmt(info.score)}점`;
  if (lv.challenge) {
    const r = g.roundInfo || roundInfo(1);
    $('#cont-level').textContent = `${lv.baseId ? lv.name : '무제한 모드'} · Lv.${r.round} ${r.name}`;
    $('#cont-progress').style.width = `${Math.min(100, (r.round / 10) * 100)}%`;
    $('#cont-progress-text').textContent = `Lv.${r.round} · ${r.bpm} BPM 까지 왔어요`;
  } else {
    $('#cont-level').textContent = `${levelLabel(lv)} · ${lv.name}`;
    $('#cont-progress').style.width = `${Math.round(info.progress * 100)}%`;
    $('#cont-progress-text').textContent = `곡 ${Math.round(info.progress * 100)}% 까지 왔어요`;
  }
  $('#btn-continue').hidden = !info.canContinue;
  $('#cont-note').textContent = info.canContinue
    ? `광고를 끝까지 보면 목숨 ${REVIVE_LIVES}개로 바로 그 자리부터 이어서 쳐요 (한 판에 한 번)`
    : '이어하기는 한 판에 한 번이에요. 다시 도전해 보세요!';
  openModal('modal-continue');
}

/** ⚔️ 멀티: 목숨을 다 쓰면 이어하기(광고) 없이 바로 끝 → 결과 (상대 판도 이걸 받고 끝남) */
function onRoomDeath() {
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
}

async function continueWithAd() {
  const g = state.game;
  if (!g || g.state !== 'dead') return;
  const btn = $('#btn-continue');
  btn.disabled = true;
  closeModal('modal-continue');
  const r = await showRewarded(state.cfg, {
    beforeAd: () => audio.setVolumes({ music: 0, sfx: 0 }),
    afterAd: () => audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx }),
  });
  btn.disabled = false;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  if (state.game !== g || g.state !== 'dead') return;
  if (r === 'rewarded' && g.revive()) {
    renderLives(REVIVE_LIVES, 0);
    await countdownResume(g);
  } else {
    toast('광고를 끝까지 봐야 이어할 수 있어요');
    onDeath(state.death);
  }
}

function giveUp() {
  closeModal('modal-continue');
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
}

// ---------------- 결과 ----------------
function showResCoins(res) {
  const el = $('#res-coins');
  el.hidden = !(res.coins > 0);
  if (res.coins > 0) el.innerHTML = `<i class="coin-ico"></i> +${fmt(res.coins)} <small>모은 코인 ${fmt(getCoins())}</small>`;
}

function showResult(res) {
  if (state.suggestLite && !state.settings.lite) {
    state.suggestLite = false;
    setTimeout(() => toast('폰이 버거워해서 무대 효과를 줄였어요. 그래도 버벅이면 ⚙ 설정 → 저사양 모드', 4200), 2600);
  }
  res.runToken = state.runToken;
  state.lastResult = res;
  $('#res-offline').hidden = true;
  $('#res-daily').hidden = true;
  $('#screen-result').classList.toggle('in-room', !!res.room);
  $('#res-room').hidden = !res.room;
  if (res.room) setTimeout(renderRoomResult, 0);
  if (res.challenge) {
    showChallengeResult(res);
    return;
  }
  const lv = getLevel(res.levelId);
  const nextId = nextOpenId(res.levelId);
  const wasOpen = { next: nextId == null || !progressLocked(nextId), endless: !progressLocked(ENDLESS_ID), levels: LEVELS.filter((l) => !progressLocked(l.id)).map((l) => l.id) };
  // 목숨 다 써서 끝난 판은 최고 기록에 안 들어감
  // 멀티에서 상대가 먼저 쓰러져 중간에 끝난 판(stopped)도 기록엔 안 남김
  const quiet = state.auto || !!res.practice; // 자동 연주·연습은 기록 안 남김
  const best = quiet || res.failed || res.stopped ? { isNew: false } : saveBest(res);
  // 이번 판으로 새로 열린 단계 알림
  if (!quiet && !res.failed && !res.stopped) {
    if (res.levelId === ENDLESS_FROM && !wasOpen.endless && !progressLocked(ENDLESS_ID)) setTimeout(() => toast('💎 무제한 모드가 열렸어요! 깰수록 빨라져요', 3200), 2600);
    else {
      // 같은 난이도를 하나 깨면 그 난이도가 전부 열림 → 여러 단계가 한 번에 열렸으면 그렇게 알림
      const opened = LEVELS.filter((l) => !wasOpen.levels.includes(l.id) && !progressLocked(l.id)).map((l) => l.id);
      if (opened.length > 1) setTimeout(() => toast(`🔓 ${opened[0]}~${opened[opened.length - 1]}단계가 한꺼번에 열렸어요!`, 3000), 2600);
      else if (opened.length === 1) setTimeout(() => toast(`🔓 ${opened[0]}단계가 열렸어요!`, 2600), 2600);
    }
  }
  $('#res-level').textContent = `${res.practice ? `🐢 연습 ${Math.round(res.practice * 100)}% · ` : ''}${levelLabel(lv)} · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.toggle('failed', !!res.failed);
  const g = $('#res-grade');
  g.textContent = res.grade;
  g.style.color = gradeColor(res.grade);
  const nextRule = STAR_RULES.slice().reverse().find((r) => r.stars > res.stars);
  $('#res-star-hint').innerHTML = res.failed
    ? `목숨을 다 썼어요! 곡 ${Math.round((res.progress || 0) * 100)}% 까지 · 콤보 ${LIFE_REGEN_COMBO}개마다 목숨 +1`
    : res.stars === 3
      ? '완벽해요! 별 3개 달성 🎉'
      : res.stars === 0
        ? `아쉬워요! 별 1개: ${STAR_RULES[2].text}`
        : `별 ${nextRule.stars}개: ${nextRule.text}`;
  $('#res-new').hidden = !best.isNew;
  showResCoins(res);
  showDailyResult(res);
  const badge = $('#res-badge');
  badge.hidden = !res.fullCombo;
  badge.textContent = res.counts.perfect === res.total && !res.counts.wrong ? 'ALL PERFECT' : 'FULL COMBO';
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.stars === 0 ? 'miss' : res.stars === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = buddiesHTML(face);
  const timing =
    Math.abs(res.avgOffsetMs) < 15 ? '타이밍 딱 좋아요' : res.avgOffsetMs < 0 ? `평균 ${-res.avgOffsetMs}ms 빨라요` : `평균 ${res.avgOffsetMs}ms 늦어요`;
  const extras = [res.goldTotal ? `✨ 황금 콩 ${res.goldHits}/${res.goldTotal}` : '', res.rollHits ? `💥 연타 ${res.rollHits}번` : ''].filter(Boolean).join(' · ');
  $('#res-meta').innerHTML = `정확도 ${(res.accuracy * 100).toFixed(1)}% · 최대 콤보 ${res.maxCombo} · ${timing}${extras ? '<br>' + extras : ''}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : res.practice ? '<br>(🐢 연습 — 기록·랭킹엔 안 남아요)' : ''}`;
  const next = getLevel(nextOpenId(lv.id));
  const nb = $('#btn-next');
  nb.hidden = false;
  if (next) nb.innerHTML = `다음 ${next.id}단계 ${progressLocked(next.id) ? icon('lock') : ''}`;
  else nb.innerHTML = `💎 무제한 모드 ${progressLocked(ENDLESS_ID) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = quiet || res.failed;
  // 끝까지 친 판은 알아서 랭킹에 올림 (점수 올라가는 연출이 끝날 즈음)
  if (!quiet && !res.failed && !res.room) setTimeout(() => submitRank(res), 1800);
  $('#btn-vs').hidden = quiet || res.failed;
  $('#btn-practice').hidden = !!res.room || state.auto;
  $('#btn-practice').textContent = res.practice ? '🐢 연습 빠르기 바꾸기' : '🐢 느리게 연습';
  // 박자가 계속 한쪽으로 밀리면 (블루투스 이어폰 등) 한 번에 맞추기
  const hits = (res.counts.perfect || 0) + (res.counts.great || 0) + (res.counts.good || 0);
  if (!state.auto && hits >= 8 && Math.abs(res.avgOffsetMs) >= 40) {
    const nextOffset = clampOffset(state.settings.offsetMs + res.avgOffsetMs);
    if (nextOffset !== state.settings.offsetMs)
      $('#res-meta').innerHTML += `<br><button class="btn btn-sm btn-ghost res-tune" data-action="tune-sync" data-offset="${nextOffset}">박자가 안 맞나요? 내 손에 맞게 자동 보정</button>`;
  }
  // 1:1 대결 결과
  const vs = !quiet && state.vs && state.vs.levelId === res.levelId ? state.vs : null;
  const box = $('#res-vs');
  let outcome = null;
  if (vs) {
    outcome = versusOutcome(res.score, vs.score);
    const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' }[outcome];
    box.innerHTML = `<div class="vs-result ${outcome}">${word}</div>
      <div class="vs-row"><span>나<b>${fmt(res.score)}</b></span><span class="vs-x">VS</span><span>${escapeHtml(vs.name)}<b>${fmt(vs.score)}</b></span></div>`;
    $('#btn-vs').innerHTML = `${icon('swords')} ${outcome === 'win' ? '이겼다고 도전장 보내기' : '다시 도전장 보내기'}`;
  } else $('#btn-vs').innerHTML = `${icon('swords')} 친구에게 1:1 도전장`;
  show('screen-result');
  renderLevels();
  animateResult(res, outcome);
}

/** 무제한 모드 결과: 등급 자리에 "Lv.N", 별 대신 다이아몬드 */
function showChallengeResult(res) {
  const sv = levelSurvivalBase(res.levelId); // ⚔️ 멀티 서바이벌: 기록·랭킹·다이아 안 남김
  const base = levelEndlessBase(res.levelId) || sv;
  const lv = base || getLevel(8);
  $('#btn-practice').hidden = true;
  const best = state.auto || sv ? { isNew: false } : saveBest(res);
  $('#res-level').textContent = sv ? `⚔️ 서바이벌 · ${sv.composer} ${sv.name}` : base ? `${base.id}단계 무제한 · ${base.composer} ${base.name}` : `무제한 모드 · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.remove('failed');
  const g = $('#res-grade');
  g.textContent = `Lv.${res.roundReached}`;
  g.style.color = '#FFD84A';
  const next = DIAMOND_RULES.slice().reverse().find((r) => r.diamonds > res.diamonds);
  $('#res-star-hint').innerHTML = sv
    ? `Lv.${res.roundReached} · ${res.bpmReached} BPM 까지 버텼어요`
    : res.diamonds === 3
      ? `다이아 3개! 진짜 드러머예요 💎💎💎`
      : `${res.roundsCleared ? `Lv.${res.roundsCleared}까지 클리어` : 'Lv.1부터 다시 도전!'} · 다음 💎: ${next.text}`;
  $('#res-new').hidden = !best.isNew;
  showResCoins(res);
  $('#res-badge').hidden = true;
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.diamonds === 0 ? 'miss' : res.diamonds === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = buddiesHTML(face);
  const prev = best.prev && !best.isNew ? ` · 내 최고 Lv.${best.prev.roundsCleared || 0} 클리어` : '';
  $('#res-meta').innerHTML = `최고 속도 ${res.bpmReached} BPM · 최대 콤보 ${res.maxCombo} · 정확도 ${(res.accuracy * 100).toFixed(1)}%${prev}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  $('#btn-next').hidden = true;
  // 무제한 모드는 랭킹이 따로 있어서 끝나면 알아서 올려요 (Lv.1 이상 깼을 때)
  $('#btn-rank').hidden = state.auto || !res.endless || !!sv;
  $('#btn-vs').hidden = true;
  show('screen-result');
  renderLevels();
  animateResult({ ...res, stars: sv ? 0 : res.diamonds }, null, true);
  if (!state.auto && res.endless && !sv) setTimeout(() => submitRank(res), 1800);
}

const clampOffset = (ms) => Math.max(-200, Math.min(200, Math.round(ms / 5) * 5));

/**
 * 결과 연출: 점수가 0부터 '따라라라' 올라감 → '딴!' → 별이 하나씩 '띵! 띵! 띵!' → 등급 도장 (+ 1:1 승패)
 * 화면을 누르면 바로 끝까지 건너뜀.
 */
const resultAnim = { id: 0, finish: null };
function animateResult(res, outcome, gems = false) {
  const id = ++resultAnim.id;
  const alive = () => resultAnim.id === id;
  const scoreEl = $('#res-score');
  const grade = $('#res-grade');
  const vsBox = $('#res-vs');
  const hint = $('#res-star-hint');
  $('#res-stars').innerHTML = gems ? gemsHTML(0, 'big seq') : starsHTML(0, 'big seq');
  const starEls = $$('#res-stars svg');
  grade.classList.add('pending');
  hint.classList.add('pending');
  vsBox.hidden = true;
  scoreEl.classList.remove('land');
  scoreEl.textContent = '0';
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => alive() && fn(), ms));

  const ratio = Math.min(1, res.score / (res.maxScore || res.score || 1));
  const startMs = 350;
  const countMs = res.score > 0 ? Math.round(700 + 1100 * ratio) : 0;
  const landMs = startMs + countMs;
  const starGap = 420;
  const gradeMs = landMs + 380 + Math.max(0, res.stars - 1) * starGap + 420;

  // 1) 점수 올라가는 소리: AudioContext 시계로 미리 예약해서 고르게 '따라라라'
  if (audio.running && countMs) {
    const t0 = audio.ctx.currentTime + startMs / 1000;
    const n = Math.floor(countMs / 55);
    for (let k = 0; k < n; k++) audio.tick(t0 + k * 0.055, k / n);
  }
  let raf;
  const t0 = performance.now() + startMs;
  const step = () => {
    if (!alive()) return;
    const p = Math.min(1, Math.max(0, (performance.now() - t0) / (countMs || 1)));
    scoreEl.textContent = fmt(Math.round(res.score * (1 - Math.pow(1 - p, 2))));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  // 2) 다 오르면 '딴!'
  const land = (sound) => {
    scoreEl.textContent = fmt(res.score);
    scoreEl.classList.add('land');
    if (sound && audio.running) audio.land();
  };
  later(landMs, () => land(true));
  // 3) 별 하나씩 '띵!'
  const starOn = (i, sound) => {
    starEls[i].classList.add('on');
    if (sound && audio.running) audio.starChime(audio.ctx.currentTime, i);
  };
  for (let i = 0; i < res.stars; i++) later(landMs + 380 + i * starGap, () => starOn(i, true));
  // 4) 등급 도장 + 승패
  const reveal = (sound) => {
    grade.classList.remove('pending');
    hint.classList.remove('pending');
    grade.style.animation = 'none';
    void grade.offsetWidth;
    grade.style.animation = '';
    vsBox.hidden = !outcome;
    if (!sound || !audio.running) return;
    const t = audio.ctx.currentTime + 0.05;
    if (res.stars === 3 || outcome === 'win') audio.fanfare(t);
    if (res.fullCombo && !res.failed) audio.sfxFile('cheer', 0.8); // 🔔 풀콤보 환호
    else if (res.stars === 0 || outcome === 'lose') audio.aww(t);
  };
  later(gradeMs, () => reveal(true));
  resultAnim.finish = () => {
    if (!alive()) return;
    resultAnim.id++;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    if (audio.running) audio.silenceTicks();
    land(false);
    starEls.forEach((el, i) => i < res.stars && el.classList.add('on'));
    reveal(false);
  };
}

// ---------------- 1:1 대결 (도전장 링크) ----------------
function siteUrl() {
  return state.cfg.siteUrl || location.origin + location.pathname.replace(/index\.html$/, '');
}

function sendChallenge() {
  const r = state.lastResult;
  if (!r || r.auto || r.practice) return;
  const nick = load('nick', '');
  if (!nick) {
    $('#nick-input').value = '';
    openModal('modal-nick');
    setTimeout(() => $('#nick-input').focus(), 50);
    return;
  }
  shareChallenge(nick);
}

async function shareChallenge(nick) {
  const r = state.lastResult;
  const lv = getLevel(r.levelId);
  const code = encodeChallenge({ name: nick, levelId: r.levelId, score: r.score, stars: r.stars, grade: r.grade, accuracy: r.accuracy, timeline: r.timeline });
  const url = `${siteUrl()}?vs=${code}`;
  const text = `${nick}의 1:1 도전장! ${CONFIG.appName} ${lv.name}(${lv.composer}) ${fmt(r.score)}점. 이길 수 있어?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${CONFIG.appName} 1:1 도전장`, text, url });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const ok = await copyText(`${text} ${url}`);
  toast(ok ? '도전장 링크를 복사했어요! 카톡·DM에 붙여넣어 보내세요' : '링크를 복사하지 못했어요', 3200);
}

function openIncomingVs(ch) {
  const lv = getLevel(ch.levelId);
  state.vsIncoming = ch;
  $('#vs-in-name').textContent = ch.name;
  $('#vs-in-level').textContent = `${levelLabel(lv)} · ${lv.composer} ${lv.name}`;
  $('#vs-in-score').textContent = `${fmt(ch.score)}점`;
  $('#vs-in-stars').innerHTML = starsHTML(ch.stars);
  openModal('modal-vs');
}

/** 랭킹에 내 점수 올리기. 끝까지 친 판은 결과가 뜨면 알아서 올라가요 (닉네임이 있을 때) */
async function submitRank(r = state.lastResult) {
  // 무제한 모드는 목숨이 다해 끝나도 올림 (최소 Lv.1 은 깨야). 영상용 챌린지(ch4 등)는 안 올림
  // 무제한(그리그·단계별)은 곡마다 따로 랭킹
  const endless = !!r && (r.levelId === ENDLESS_ID || !!levelEndlessBase(r.levelId));
  if (!r || r.auto || r.practice || (r.challenge && !endless) || (r.failed && !endless) || r.submitted || r.submitting) return;
  if (endless && !(r.roundsCleared >= 1)) return;
  if (demoOnly()) return;
  // 📴 서버 없는 모드(DB 한도 초과 등)·판 토큰을 못 받은 판: 인증한 폰이면 최고 기록을 폰에 모았다가 서버가 돌아오면 올림
  const realTok = r.runToken && !String(r.runToken).startsWith('mock.');
  const keepOffline = () => {
    if (CONFIG.apiMode === 'mock' || !isConfirmed() || !queueOffline(r, endless)) return;
    r.submitted = true;
    // 폰에 저장 + 서버 보관함(Neon, D1 이 막혀도 받음)에도 맡김 → 결과 화면에 어디에 저장됐는지 보여 줌
    const box = $('#res-offline');
    const here = () => state.lastResult === r;
    const say = (html) => {
      if (!here()) return;
      box.innerHTML = html;
      box.hidden = false;
    };
    say('📴 서버가 쉬는 중 · 기록을 <b>이 폰</b>에 저장했어요<small>서버 보관함에도 맡기는 중…</small>');
    backupOffline(r.levelId).then((ok) =>
      say(
        ok
          ? '✅ 기록을 <b>이 폰</b>과 <b>서버 보관함</b>에 저장했어요<small>오전 9시부터 랭킹에 자동으로 올라가요</small>'
          : '📴 기록을 <b>이 폰</b>에 저장했어요<small>오전 9시 뒤에 이 폰에서 게임을 한 번 열어 주세요 · 방문 기록·사이트 데이터는 지우지 마세요</small>'
      )
    );
  };
  if (state.api.mode !== 'server') return keepOffline();
  // 랭킹은 팔로워 인증(암호)을 받은 사람만 → 안 받았으면 인증 창을 한 번 띄움
  if (!isConfirmed()) {
    askNickname();
    return;
  }
  if (!realTok) return keepOffline(); // 판 시작 요청이 실패했던 판
  r.submitting = true;
  try {
    const out = await state.api.submitScore(
      endless
        ? { runToken: r.runToken, level: r.levelId, rounds: r.roundsCleared, score: r.score }
        : { runToken: r.runToken, level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts, check: r.check }
    );
    r.submitted = true;
    // kept: 기록이 안 올라서 서버가 등수를 안 셈 (D1 읽기 아끼기)
    if (out.kept && out.rank == null) toast(endless ? `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요`, 3000);
    else if (out.busy) toast(endless ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어` : '랭킹에 올라갔어요! 🏆', 3000);
    else if (out.over) toast(endless ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · 200위 밖` : '랭킹에 올라갔어요! 200위 밖', 3000);
    else if (out.rank == null) toast('팔로우 확인이 안 돼서 지금은 랭킹에 안 보여요. 위 ⚠️ 버튼을 눌러 주세요', 3200);
    else if (endless) toast(out.improved ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · ${out.rank}위 🏆` : `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요 · ${out.rank}위`, 3200);
    else toast(out.improved ? `랭킹에 올라갔어요! 현재 ${out.rank}위 🏆` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요 · ${out.rank}위`, 3000);
  } catch (e) {
    if (e.status === 503 || !e.status) keepOffline(); // 서버가 막혔거나 연결이 끊김
    else if (e.status === 401 || (e.status === 403 && e.data && e.data.error === 'verify_required')) {
      if (e.status === 401) state.me = { verified: false };
      else state.me = { ...state.me, confirmed: false };
      askNickname();
    }
    // 그 밖의 실패(이미 올린 판, 검증 실패 등)는 조용히 넘어감
  } finally {
    r.submitting = false;
  }
}

/** 닉네임이 아직 없으면 한 번 물어봄 (이번 접속에서 닫으면 다시 안 물음) */
function askNickname(force = false) {
  if (!force && state.nickAsked) return;
  state.nickAsked = true;
  // 인증 완료한 사람은 닉네임 바꾸기, 아니면 팔로워 인증 창
  if (isConfirmed()) openJoin();
  else openVerify(null);
}

// 랭킹 닉네임 정하기
function openJoin() {
  $('#join-err').hidden = true;
  $('#join-name').value = state.me.player?.username || load('lastNick', '');
  $('#join-ig').value = state.me.player?.ig || load('lastIg', '');
  const h = state.me.hidden;
  $('#join-warn').hidden = !h;
  if (h) {
    const d = new Date(h.deleteAt);
    $('#join-warn').innerHTML = `⚠️ <b>팔로우 확인이 안 됐어요.</b> 그래서 지금은 랭킹에서 내려가 있어요.<br>${atHandle()} 팔로우하고 인스타 아이디를 다시 적으면 랭킹에 돌아와요. <b>${d.getMonth() + 1}월 ${d.getDate()}일</b>까지 안 하면 기록이 지워져요.`;
  }
  $('#join-rule-handle').textContent = atHandle();
  $('#join-insta').href = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  openModal('modal-join');
  setTimeout(() => $('#join-name').focus(), 50);
}
async function submitJoin() {
  const name = $('#join-name').value.trim();
  const err = (t) => {
    $('#join-err').textContent = t;
    $('#join-err').hidden = false;
  };
  if ([...name].length < 2) return err('2자 이상으로 써 주세요.');
  if (!/^[\p{L}\p{N}_. ]+$/u.test(name)) return err('한글·영문·숫자·_ . 만 쓸 수 있어요.');
  // @ 나 인스타 주소로 써도 아이디만 뽑음 (서버도 같은 규칙으로 한 번 더 확인)
  let ig = $('#join-ig').value.trim().toLowerCase();
  const um = ig.match(/instagram\.com\/([^/?#\s]+)/);
  if (um) ig = um[1];
  ig = ig.replace(/^@+/, '');
  if (!/^[a-z0-9._]{1,30}$/.test(ig)) return err('인스타 아이디를 정확히 써 주세요. (영문·숫자·_ . 만)');
  try {
    state.me = await state.api.guest(name, ig);
    save('lastNick', name);
    save('lastIg', ig);
    closeModal('modal-join');
    refreshTitle();
    refreshFollowChip();
    renderLevels();
    if (state.me.checked) toast(`🎉 ${name} 님, 팔로워 인증 완료! ${VERIFY_WHAT()}가 열렸어요`, 3600);
    else toast(`${name} 님, 반가워요!`, 3000);
    submitRank();
  } catch (e) {
    err(e.status === 429 ? '잠시 후 다시 시도해 주세요.' : e.data && e.data.error === 'bad_ig' ? '인스타 아이디를 정확히 써 주세요.' : '등록하지 못했어요. 다시 시도해 주세요.');
  }
}

async function shareResult() {
  const r = state.lastResult;
  if (!r) return;
  toast('결과 카드 만드는 중…', 1200);
  const url = siteUrl();
  const canvas = await makeShareCard(r, { siteUrl: url, handle: handle() });
  const text = r.challenge
    ? `${CONFIG.appName} 무제한 모드 Lv.${r.roundsCleared} 클리어 (${r.bpmReached} BPM) ${fmt(r.score)}점! 너도 엄지로 쳐 봐 ${url}`
    : `${CONFIG.appName} ${levelLabel(r.levelId)} ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 ${url}`;
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], `okaystra-${r.challenge ? 'endless' : 'lv' + r.levelId}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    $('#share-title').textContent = '결과 카드';
    $('#share-hint').textContent = '이미지를 길게 눌러 저장하고 스토리에 올려보세요!';
    $('#share-img').src = canvas.toDataURL('image/png');
    openModal('modal-share');
    copyText(text);
  } catch {
    toast('이 브라우저에선 이미지 저장이 안 돼요. 스크린샷으로 남겨주세요!');
  }
}

// ---------------- 랭킹 ----------------
/** 이 랭킹 칸이 무제한 랭킹인지 ('endless' 또는 'e5' 같은 단계별 무제한) */
const isEndlessRank = (id) => id === ENDLESS_ID || !!levelEndlessBase(id);
/** 🏛 명예의 전당 칸 ('hall-stage' 단계 총합 / 'hall-endless' 무제한 총합) */
const isHallRank = (id) => typeof id === 'string' && id.startsWith('hall-');
const rankModeOf = (id) => (isHallRank(id) ? 'hall' : isEndlessRank(id) ? 'endless' : 'normal');

async function openRank(levelId) {
  state.rankLevel = levelId === 'total' ? 'hall-stage' : levelId || state.rankLevel || 'hall-stage';
  renderRankTabs();
  openModal('modal-rank');
  await loadRank();
}

/** 위: 🏛 명예의 전당 / 🎵 단계 / 💎 무제한. 아래: 그 안의 탭 (전당 = 단계 총합·무제한 총합, 단계 = 단계별, 무제한 = 그리그 + 단계별 무제한) */
function renderRankTabs() {
  const cur = state.rankLevel;
  const mode = rankModeOf(cur);
  $('#rank-season').textContent = seasonLeftText();
  $$('#rank-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rankMode === mode)));
  const tab = (id, label) => `<button role="tab" data-rank="${id}" aria-selected="${id === cur}">${label}</button>`;
  $('#rank-tabs').innerHTML =
    mode === 'hall'
      ? tab('hall-stage', BOARD_LABEL.stage) + tab('hall-endless', BOARD_LABEL.endless)
      : mode === 'endless'
        ? tab(ENDLESS_ID, '♾️ 그리그') + MAIN_LEVELS.filter((l) => !closedLocked(levelEndlessId(l.id))).map((l) => tab(levelEndlessId(l.id), `${l.id}단계 ∞`)).join('')
        : LEVELS.map((l) => tab(l.id, l.xmas ? '🎄 이벤트' : l.long ? '🎭 장거리' : `${l.id}단계`)).join('');
  const sel = $('#rank-tabs [aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
}

/** 📴 서버가 쉬는 동안 랭킹 창 맨 위 안내 (예전 랭킹을 보여 줄 때 / 못 받았을 때) */
function snapNotice(data) {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0); // 다음 UTC 0시 = 한국 오전 9시
  const when = `${new Date(next.getTime() + 9 * 3600000).getUTCDate()}일 오전 9시`;
  if (data && data.snap) {
    const t = new Date(data.snap.at + 9 * 3600000);
    const h = t.getUTCHours();
    const at = `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시 ${t.getUTCMinutes()}분`;
    return `<div class="rank-snap">📴 서버가 쉬는 중이라 <b>${at}</b> 기준 랭킹이에요<br><b>${when}부터</b> 실시간으로 업데이트돼요</div>`;
  }
  return `<div class="rank-snap">📴 서버가 쉬는 중이에요 · 랭킹은 <b>${when}부터</b> 다시 보여요</div>`;
}

async function loadRank() {
  const list = $('#rank-list');
  // 서버가 쉬는 동안(진짜 사이트)엔 예전 랭킹을 보여 줌 → '곧 열려요'는 서버 없이 올린 사이트(apiMode mock)에서만
  if (demoOnly() && CONFIG.apiMode === 'mock') {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  const want = state.rankLevel;
  try {
    if (isHallRank(want)) {
      const board = want === 'hall-endless' ? 'endless' : 'stage';
      const data = await state.api.hall(board);
      if (state.rankLevel !== want) return;
      list.innerHTML = (data.snap || (data.sample && !isLocalDev()) ? snapNotice(data) : '') + hallHtml(data, board);
      const foot = [];
      foot.push(board === 'endless' ? '무제한 판(그리그·단계별 무제한) 점수를 모두 더한 점수예요.' : '단계별 최고점을 모두 더한 점수예요. 더 많은 단계를 높은 점수로 칠수록 올라가요!');
      if (data.season.n > 1) foot.push(`시즌 ${data.season.n}에 친 기록만 세요.`);
      if (data.me) foot.push(data.me.rank ? `내 순위: ${data.me.rank}위.` : `내 순위: ${data.me.cap || 200}위 밖.`);
      rankFootJoin(foot);
      return;
    }
    const data = await state.api.leaderboard(want);
    if (state.rankLevel !== want) return;
    const endless = isEndlessRank(want);
    if (data.snapFail) list.innerHTML = snapNotice(null);
    else if (!data.entries.length) list.innerHTML = '<div class="rank-empty">아직 기록 없음</div>';
    else if (endless) list.innerHTML = endlessRankHtml(data);
    else
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g" style="color:${gradeColor(e.grade)}">${e.grade || ''}</span></div>`
        )
        .join('');
    if (data.snap) list.innerHTML = snapNotice(data) + list.innerHTML;
    const foot = [];
    if (data.sample && isLocalDev()) foot.push('(개발 모드: 서버 없이 내 기록만 보여요)');
    if (endless) {
      const eb = levelEndlessBase(want);
      foot.push(`${eb ? `${eb.id}단계 ${escapeHtml(eb.name)} 무제한` : '그리그 무제한 모드'} 랭킹이에요. 더 높은 단계(Lv.)까지 깬 사람이 위, 같으면 점수가 높은 사람이 위예요.`);
    }
    if (data.me) foot.push(data.me.rank ? `내 순위: ${data.me.rank}위.` : `내 순위: ${data.me.cap || 200}위 밖.`);
    rankFootJoin(foot);
  } catch {
    list.innerHTML = '<div class="rank-empty">랭킹을 불러오지 못했어요.</div>';
  }
}
function rankFootJoin(foot) {
  if (state.me.guest) foot.push(`<b>${escapeHtml(state.me.player?.username)}</b> 님으로 참여 중 · 끝까지 치면 점수가 알아서 올라가요.`);
  else foot.push('닉네임을 정하면 끝까지 친 점수가 알아서 랭킹에 올라가요. <button class="link" data-action="rank-join">닉네임 정하기</button>');
  $('#rank-foot').innerHTML = foot.join(' ');
}

/** 🏛 명예의 전당: 끝난 시즌 1·2·3등(사진) + 이번 시즌 총합 순위(시상대 + 목록) */
var lastHallData = null;
function hallHtml(data, board) {
  lastHallData = data;
  const sub = (e) => (board === 'endless' ? `Lv.${fmt(e.rounds)} · ${e.n}판` : `${e.n}/${data.levels}단계`);
  const past = {};
  for (const h of data.hall || []) if (h.board === board) (past[h.season] ||= []).push(h);
  const seasons = Object.keys(past).map(Number).sort((a, b) => b - a);
  const avatar = (h) => (h.image ? `<img class="hall-img" src="${escapeHtml(h.image)}" alt="">` : `<span class="hall-img none medal m${h.rank}">${icon('medal')}</span>`);
  const btn = (n, h, action, label, cls) => `<button class="${cls}" data-action="${action}" data-season="${n}" data-board="${board}" data-rank="${h.rank}">${label}</button>`;
  const pastHtml = seasons
    .map((n) => {
      const cards = [2, 1, 3]
        .map((rk) => past[n].find((h) => h.rank === rk))
        .filter(Boolean)
        .map((h) => {
          const mine = h.me
            ? btn(n, h, 'hall-photo', `📷 ${h.image ? '사진 바꾸기' : '사진 올리기'}`, 'btn btn-sm btn-ghost') +
              (h.image ? btn(n, h, 'hall-photo-del', '지우기', 'link small') : '') +
              btn(n, h, 'hall-msg', `💬 ${h.msg ? '한마디 고치기' : '한마디 쓰기'}`, 'btn btn-sm btn-ghost')
            : '';
          const msg = h.msg ? `<span class="hall-msg">“${escapeHtml(h.msg)}”</span>` : '';
          return `<div class="hall-card r${h.rank} ${h.me ? 'me' : ''}">${avatar(h)}<span class="hall-rk">${['🥇', '🥈', '🥉'][h.rank - 1]} ${h.rank}등</span>
            <b class="hall-nm">${escapeHtml(h.username)}</b><span class="hall-sc">${fmt(h.score)}</span><span class="pl">${sub(h)}</span>${msg}${mine}</div>`;
        })
        .join('');
      return `<div class="hall-sec"><h4>🏛 시즌 ${n} 명예의 전당</h4><div class="hall-row">${cards}</div></div>`;
    })
    .join('');
  const note = `<div class="hall-note">🏛 시즌이 끝나면 <b>1·2·3등은 명예의 전당에 영원히 기록돼요</b> (사진·한마디)<br>🪙 100등까지 코인 보상 · 1등 10만 · 2등 7만 · 3등 5만</div>`;
  const cur = data.entries || [];
  let now = `<h4 class="hall-cur">🏆 시즌 ${data.season.n} 지금 순위</h4>`;
  if (!cur.length) now += '<div class="rank-empty">아직 아무도 없어요. 첫 1위의 주인공이 되어보세요!</div>';
  else {
    const top = cur.slice(0, 3);
    const podium = [1, 0, 2]
      .filter((i) => top[i])
      .map((i) => {
        const e = top[i];
        return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal m${i + 1}">${icon('medal')}</span>
          <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
          <span class="pl">${sub(e)}</span><span class="step">${i + 1}등</span></div>`;
      })
      .join('');
    const rest = cur
      .slice(3, 50)
      .map(
        (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g small">${board === 'endless' ? `Lv.${fmt(e.rounds)}` : `${e.n}/${data.levels}`}</span></div>`
      )
      .join('');
    now += `<div class="podium">${podium}</div>${rest}`;
  }
  return note + pastHtml + now;
}

/** 🏛 명예의 전당 사진: 고른 사진을 가운데 정사각형으로 잘라 160px JPEG 로 (서버엔 이 작은 사진만) */
let hallPick = null;
async function hallPhotoPicked(file) {
  const pick = hallPick;
  hallPick = null;
  if (!file || !pick) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = bad;
      im.src = url;
    });
    const S = 160;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    let image = c.toDataURL('image/jpeg', 0.82);
    if (image.length > 58000) image = c.toDataURL('image/jpeg', 0.6);
    await state.api.hallPhoto({ ...pick, image });
    if (!$('#modal-gift').hidden) $('#gift-photo').style.backgroundImage = `url('${image}')`;
    toast('📷 프로필 사진을 올렸어요! (이상한 사진은 운영자가 지울 수 있어요)', 2800);
    loadRank();
  } catch {
    toast('사진을 올리지 못했어요. 다른 사진으로 해 보세요');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 무제한: 총 등수처럼 1·2·3등 시상대(깬 단계 Lv.) + 4등부터 목록 */
function endlessRankHtml(data) {
  const top = data.entries.slice(0, 3);
  const podium = [1, 0, 2]
    .filter((i) => top[i])
    .map((i) => {
      const e = top[i];
      return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal m${i + 1}">${icon('medal')}</span>
        <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
        <span class="pl">Lv.${e.rounds}</span><span class="step">${i + 1}등</span></div>`;
    })
    .join('');
  const rest = data.entries
    .slice(3, 50)
    .map(
      (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
        <span class="s">${fmt(e.score)}</span><span class="g endless">Lv.${e.rounds}</span></div>`
    )
    .join('');
  return `<div class="podium">${podium}</div>${rest}`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------- 설정 / 보정 ----------------
function openSettings() {
  const s = state.settings;
  $('#set-music').value = s.music;
  $('#set-sfx').value = s.sfx;
  $('#set-offset').value = s.offsetMs;
  $('#set-vibrate').checked = !!s.vibrate;
  $('#set-lite').checked = !!s.lite;
  $$('#set-band button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.band === (s.band || 'orch')));
  updateSettingLabels();
  renderDeco();
  $('#settings-account').innerHTML = state.me.guest
    ? `랭킹 닉네임: <b>${escapeHtml(state.me.player?.username)}</b> · <button class="link" data-action="logout">닉네임 지우기</button>`
    : `랭킹은 팔로워 인증을 받은 사람만 올라가요 · <button class="link" data-action="rank-join">팔로워 인증 받기</button>`;
  $('#transfer-code').hidden = true;
  openModal('modal-settings');
}
// ---------------- 📱 다른 폰으로 옮기기 (계정 연동) ----------------
//   옛 폰: 기록을 서버에 올리고 6자리 코드(10분, 한 번만) → 새 폰: 코드를 넣으면 기록을 합치고 랭킹 계정(인증 포함)도 이어받음
//   버튼 누를 때만 요청 1번씩 (주기적 호출 없음)
/** 두 기록 합치기: 단계마다 점수 높은 쪽 + 별·다이아·깬 단계는 큰 값 */
function mergeBests(mine, theirs) {
  const out = { ...mine };
  for (const [k, t] of Object.entries(theirs || {})) {
    const m = out[k];
    if (!m) {
      out[k] = t;
      continue;
    }
    const best = (t.score || 0) > (m.score || 0) ? { ...t } : { ...m };
    for (const f of ['stars', 'diamonds', 'roundsCleared']) {
      const v = Math.max(m[f] || 0, t[f] || 0);
      if (v) best[f] = v;
    }
    out[k] = best;
  }
  return out;
}
async function transferMake() {
  if (!(await reconnectServer({ force: true }))) return toast('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요');
  const { offsetMs, ...settings } = state.settings;
  const data = { bests: loadBests(), nick: load('nick', ''), lastNick: load('lastNick', ''), lastIg: load('lastIg', ''), settings, coins: load('coins', 0), decoOwned: load('decoOwned', []) };
  try {
    const r = await state.api.transfer({ op: 'make', data });
    $('#transfer-code-num').textContent = `${r.code.slice(0, 3)} ${r.code.slice(3)}`;
    $('#transfer-code').hidden = false;
  } catch (e) {
    toast(e.status === 429 ? '너무 자주 눌렀어요. 10분 뒤에 다시 해 주세요' : '코드를 못 만들었어요. 다시 해 주세요');
  }
}
/** 가져온 기록 적용: 기록 합치기 + 닉네임 칸 + 설정 (+ 같은 폰이면 싱크 보정) + 랭킹 계정 */
function applyTransfer(data, me) {
  save('bests', mergeBests(loadBests(), data.bests));
  for (const f of ['nick', 'lastNick', 'lastIg']) if (data[f] && !load(f, '')) save(f, data[f]);
  // 🪙 인증 전에 폰에 모은 코인은 많은 쪽(계정 코인은 서버에 있어서 그대로), 산 꾸미기는 합침
  if (Number.isFinite(data.coins) && data.coins > load('coins', 0)) save('coins', Math.floor(data.coins));
  if (Array.isArray(data.decoOwned)) save('decoOwned', [...new Set([...(load('decoOwned', []) || []), ...data.decoOwned])]);
  refreshCoins();
  if (data.settings || data.calib) {
    state.settings = { ...state.settings, ...(data.settings || {}) };
    if (data.calib) {
      state.settings.offsetMs = data.calib.offsetMs;
      if (data.calib.calibrated) save('calibrated', true);
    }
    saveSettings(state.settings);
    audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
    applyLite();
  }
  if (me) state.me = me;
}

/** 옛 주소(kongkong-drum.vercel.app)의 다리 페이지가 기록을 챙겨 ?t=코드 로 보내 줌 → 자동으로 가져옴 */
async function takeBridgeCode(code) {
  if (!(await reconnectServer({ force: true }))) return toast('예전 기록을 가져오려면 인터넷 연결을 확인하고 새로고침해 주세요', 3600);
  try {
    const { data, me } = await state.api.transfer({ op: 'take', code });
    applyTransfer(data, me);
    refreshTitle();
    renderLevels();
    toast('📦 주소가 바뀌었어요! 예전에 하던 기록을 그대로 가져왔어요', 3600);
  } catch (e) {
    if (e.status === 404) toast('예전 기록 코드가 지났어요. 예전 주소로 한 번 더 들어와 주세요', 3600);
  }
}

async function transferTake() {
  const code = $('#transfer-input').value.replace(/\D/g, '');
  if (code.length !== 6) return toast('옛 폰에서 받은 숫자 6자리를 넣어 주세요');
  if (!(await reconnectServer({ force: true }))) return toast('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요');
  try {
    const { data, me } = await state.api.transfer({ op: 'take', code });
    applyTransfer(data, me);
    $('#transfer-input').value = '';
    closeModal('modal-settings');
    refreshTitle();
    renderLevels();
    toast(me && me.confirmed ? '🎉 기록과 팔로워 인증을 가져왔어요!' : me ? '🎉 기록과 랭킹 닉네임을 가져왔어요!' : '🎉 기록을 가져왔어요!', 3200);
  } catch (e) {
    toast(e.status === 429 ? '너무 여러 번 틀렸어요. 10분 뒤에 다시 해 주세요' : e.status === 404 ? '코드가 틀렸거나 10분이 지났어요. 옛 폰에서 다시 받아 주세요' : '가져오지 못했어요. 다시 해 주세요', 3200);
  }
}

// ---------------- 🚨 긴급 공지: 새 주소 이사 (2026-11-18) ----------------
//   첫 화면 맨 위 노란 버튼. '확인했어요' 누르면 이 기기에선 숨김. 12월이 끝나면 저절로 안 보임
const MOVE_NOTICE_UNTIL = Date.parse('2027-01-01T00:00:00+09:00');
function refreshMoveBtn() {
  $('#btn-move').hidden = !!load('moveNoticeOk', false) || Date.now() > MOVE_NOTICE_UNTIL;
}
function openMove() {
  openModal('modal-move');
}

// ---------------- 📮 기록 되찾기 요청 (운영자가 admin 에서 계정을 골라 승인 → 이 폰이 다음에 들어올 때 자동으로) ----------------
//   보낸 요청 표시(token)는 이 폰에만 저장. 확인은 사이트에 들어올 때 · 앱으로 돌아올 때(2분에 한 번)만 1번 (주기적 호출 없음)
function openReq() {
  const pending = !!load('recoverReq', null);
  $('#req-form').hidden = pending;
  $('#req-wait').hidden = !pending;
  $('#req-err').hidden = true;
  if (!pending) {
    if (!$('#req-now').value) $('#req-now').value = load('lastIg', '');
    if (!$('#req-old').value) $('#req-old').value = load('lastIg', '');
    if (!$('#req-nick').value) $('#req-nick').value = load('lastNick', '') || load('nick', '');
  }
  openModal('modal-req');
}
async function sendReq() {
  const err = (t) => {
    $('#req-err').textContent = t;
    $('#req-err').hidden = false;
  };
  $('#req-err').hidden = true;
  const nick = $('#req-nick').value.trim();
  const oldIg = $('#req-old').value.trim();
  let nowIg = $('#req-now').value.trim().toLowerCase();
  const um = nowIg.match(/instagram\.com\/([^/?#\s]+)/);
  if (um) nowIg = um[1];
  nowIg = nowIg.replace(/^@+/, '');
  if (!nick && !oldIg) return err('예전 닉네임이나 예전 아이디 중 하나는 적어 주세요.');
  if (!/^[a-z0-9._]{1,30}$/.test(nowIg)) return err('지금 인스타 아이디를 정확히 적어 주세요. (영문·숫자·_ . 만)');
  const password = $('#req-pass').value.trim();
  if (!password && !freePass()) return err('팔로워 암호를 적어 주세요. (게시물에 「쿵」 댓글을 달면 DM 으로 와요)');
  if (!(await reconnectServer({ force: true }))) return err('지금은 서버에 연결이 안 돼요. 잠시 후 다시 해 주세요.');
  $('#req-send').disabled = true;
  try {
    const r = await state.api.recoverRequest({ nick, oldIg, nowIg, password, memo: $('#req-memo').value.trim() });
    save('recoverReq', { token: r.token, at: Date.now() });
    $('#req-pass').value = '';
    $('#req-memo').value = '';
    openReq();
  } catch (e) {
    const c = e.data && e.data.error;
    err(
      c === 'wrong_password' ? '암호가 달라요. 「쿵」 댓글 DM 속 암호를 다시 확인해 주세요.'
        : c === 'rate_limited' || e.status === 429 ? '너무 여러 번 보냈어요. 10분 뒤에 다시 해 주세요.'
        : c === 'bad_ig' ? '지금 인스타 아이디를 정확히 적어 주세요.'
        : '보내지 못했어요. 다시 해 주세요.'
    );
  } finally {
    $('#req-send').disabled = false;
  }
}
/** 보낸 요청이 승인됐나 확인 → 승인됐으면 계정·기록을 이 폰으로 */
async function checkReq({ manual = false } = {}) {
  const req = load('recoverReq', null);
  if (!req || !req.token || !state.api || state.api.mode !== 'server') return;
  try {
    const r = await state.api.recoverStatus(req.token);
    if (r.status === 'done') {
      remove('recoverReq');
      state.me = r.me;
      if (r.bests) save('bests', mergeBests(loadBests(), r.bests));
      closeModal('modal-req');
      refreshTitle();
      renderLevels();
      toast(`📦 운영자가 확인했어요! 「${r.me.player.username}」 계정${r.levels ? ` · ${r.levels}개 단계` : ''}를 되찾았어요`, 4500);
    } else if (r.status === 'rejected') {
      remove('recoverReq');
      closeModal('modal-req');
      toast('되찾기 요청을 확인했는데 맞는 계정을 못 찾았어요. 닉네임·아이디를 다시 적어 보내 주세요', 4500);
    } else if (manual) toast('아직 확인 중이에요. 조금 뒤에 다시 들어와 주세요', 2400);
  } catch (e) {
    if (e.status === 404) remove('recoverReq');
  }
}

// ---------------- 🪙 코인 (2026-11-22) ----------------
//   맞힌 콩(PERFECT·GREAT·GOOD) 1개 = 1코인, 연타 1번 = 1코인. 판이 끝나거나 그만둘 때 한 번 더함.
//   잔액은 서버 지갑(인증한 계정)에, 판 시작·점수 요청에 얹어 보냄 → 새 요청 없음 (coins.js). 자동 연주·영상 찍기는 0.
//   곧 상점에서 꾸미기(배경·드럼·콩 색·내 사진)를 사는 데 씀 → 산 것은 load('decoOwned') 목록
/** 인증 상태·서버 잔액을 coins.js 에 알림 (me 를 새로 받았을 때 그 잔액은 한 번만 씀) */
function syncCoinAccount() {
  const me = state.me || {};
  // 🛒 서버에 있는 산 것 → 이 폰 목록에 합침 (폰을 바꿔도 그대로)
  if (Array.isArray(me.owned) && me.owned.length) {
    const mine = load('decoOwned', []) || [];
    const all = [...new Set([...mine, ...me.owned])];
    if (all.length !== mine.length) save('decoOwned', all);
  }
  const fresh = Number.isFinite(me.coins) && !me._coinsUsed;
  if (fresh) me._coinsUsed = true;
  setCoinAccount(isConfirmed(), fresh ? me.coins : undefined);
  if (me.gift && !giftShown) setTimeout(() => showGift(me.gift), 600);
}

// ---------------- 🎁 운영자 선물 · 💬 명예의 전당 한마디 (2026-11-22) ----------------
//   운영자가 admin 에서 코인을 주면(지갑에 바로 들어감) 그 사람이 다음에 들어올 때 /api/me·boot 에 gift 가 실려 옴 → 팝업.
//   hall 이 있으면 명예의 전당 한마디 칸도. '받기·남기기' = /api/gift/ack (알림 지움), '나중에' = 다음 접속 때 또 뜸. 새 폴링 없음
var giftShown = false; // var: 시작 때 syncCoinAccount 가 먼저 불려도 되게
var giftMode = null; // { gift } 또는 { edit: { season, board, rank, msg } }
function showGift(gift) {
  if (!gift || giftShown) return;
  giftShown = true;
  giftMode = { gift };
  $('#gift-top').hidden = false;
  $('#gift-coins-line').hidden = !(gift.coins > 0);
  $('#gift-coins').textContent = fmt(gift.coins || 0);
  $('#gift-note').textContent = gift.note || '';
  $('#gift-msg-box').hidden = !gift.hall;
  $('#gift-photo-box').hidden = !gift.hall;
  $('#gift-photo').style.backgroundImage = '';
  $('#gift-msg-title').textContent = gift.hall ? `🏛 시즌 ${gift.hall.season} 명예의 전당에 남길 한마디` : '';
  $('#gift-msg').value = '';
  $('#gift-ok').textContent = gift.hall ? '받고 명예의 전당에 남기기' : '받기';
  $('#gift-later').hidden = !gift.hall;
  openModal('modal-gift');
  refreshCoins();
}
function editHallMsg(season, board, rank, msg) {
  giftMode = { edit: { season, board, rank } };
  $('#gift-top').hidden = true;
  $('#gift-photo-box').hidden = true;
  $('#gift-msg-box').hidden = false;
  $('#gift-msg-title').textContent = `🏛 시즌 ${season} 명예의 전당 한마디`;
  $('#gift-msg').value = msg || '';
  $('#gift-ok').textContent = '저장';
  $('#gift-later').hidden = false;
  $('#gift-later').textContent = '닫기';
  openModal('modal-gift');
}
async function giftOk() {
  const mode = giftMode;
  if (!mode) return closeModal('modal-gift');
  if (mode.gift) audio.unlock().then(() => audio.sfxFile('gift', 0.9)).catch(() => {}); // 🔔 선물 받기
  const msg = $('#gift-msg').value.trim();
  const b = $('#gift-ok');
  b.disabled = true;
  try {
    if (mode.edit) {
      await state.api.hallMsg({ ...mode.edit, msg });
      toast(msg ? '💬 한마디를 남겼어요!' : '한마디를 지웠어요', 2200);
      loadRank();
    } else {
      if (mode.gift.hall && !msg) {
        b.disabled = false;
        $('#gift-msg').focus();
        return toast('한마디를 적어 주세요 · 나중에 써도 돼요', 2200);
      }
      const r = await state.api.giftAck(msg);
      if (state.me) state.me.gift = null;
      toast(r && r.saved ? '🎉 받았어요! 한마디도 명예의 전당에 남겼어요' : '🎉 받았어요!', 2600);
    }
    giftMode = null;
    closeModal('modal-gift');
  } catch (e) {
    toast(e && e.status === 503 ? '서버가 잠깐 쉬는 중이에요 · 조금 뒤 다시' : '저장하지 못했어요 · 잠시 뒤 다시 해 주세요', 2600);
  } finally {
    b.disabled = false;
  }
}
function giftLater() {
  const g = giftMode && giftMode.gift;
  giftMode = null;
  closeModal('modal-gift');
  $('#gift-later').textContent = '나중에 쓸게요';
  if (g) toast('코인은 이미 들어왔어요 · 다음에 들어오면 다시 물어볼게요', 2600);
}
const getCoins = () => coinTotal();
function refreshCoins() {
  const el = $('#coin-num');
  if (el) el.textContent = fmt(getCoins());
}
/** 이 판에서 번 코인: PERFECT 2 · GREAT·GOOD·연타 1 (자동 연주·영상 찍기는 0) */
function runCoins(g) {
  if (!g || state.auto || g.auto || state.studio.active) return 0;
  const c = g.counts || {};
  return Math.max(0, Math.min(40000, (c.perfect || 0) * 2 + (c.great || 0) + (c.good || 0) + (g.rollHits || 0)));
}
/**
 * 이 판에서 번 코인 중 아직 안 넣은 만큼 넣음. 판 도중(앱을 내림·그만둠)에도 부르고, 끝나면 final → 더는 안 넣음.
 * 돌려주는 값 = 이 판에서 번 코인 전부
 */
function awardRunCoins(g, final = true) {
  if (!g) return 0;
  const total = runCoins(g);
  if (g._coined) return total;
  if (final) g._coined = true;
  const delta = total - (g._coinPaid || 0);
  if (delta > 0) {
    g._coinPaid = total;
    syncCoinAccount();
    // 판 토큰은 이 판 것일 때만 (서버가 같은 판은 합쳐서 한 판 최대까지만 받음)
    const tok = g._runToken && !String(g._runToken).startsWith('mock.') ? g._runToken : null; // 서버 없을 때 받은 가짜 토큰은 안 씀
    addRunCoins(delta, tok);
  }
  return total;
}

// ---------------- 🎨 꾸미기 (배경·드럼 세트·콩 색) ----------------
//   11-22 사용자 결정: 원래 배경(단계별)·맵 드럼·기본 콩 색만 무료, 나머지(다른 배경·드럼·콩 색·📷 내 사진)는
//   🔒 잠금 → 곧 상점에서 코인으로 엶. 열린 건 load('decoOwned') = ['bg:city', 'kit:lava', 'notes:neon', 'bg:photo' …]
//   11-22 밤 상점 개편: 맵 배경·맵 드럼·색만 바꾸는 콩 색은 무료, 상점 전용(새 그림 배경·새 드럼·효과 콩 스킨·📷 내 사진)만 잠금
const DECO_FREE = { bg: 'auto', kit: 'auto', notes: 'basic', ui: 'basic' };
function decoOpen(type, key) {
  if (!key || key === DECO_FREE[type]) return true;
  if (load('shopTest', false)) return true; // 🛒 운영자 시험(/?shoptest=okay): 이 기기에서만 상점 물건 전부 써 보기 (서버·지갑은 그대로)
  if ((type === 'bg' || type === 'kit') && DECO_THEMES.includes(key)) return true;
  if (type === 'notes' && NOTE_FREE.includes(key)) return true;
  const owned = load('decoOwned', []);
  return Array.isArray(owned) && owned.includes(`${type}:${key}`);
}
const decoPick = (type) => {
  const k = state.settings[type] || DECO_FREE[type];
  return decoOpen(type, k) ? k : DECO_FREE[type];
};
//   이 폰에만 저장(설정). 서버 요청 없음. 영상 찍기는 원래 맵 그대로(render.js)
function applyDeco() {
  const s = state.settings;
  const bg = decoPick('bg');
  const kit = decoPick('kit');
  renderer.bgPick = bg !== 'auto' ? bg : null;
  renderer.kitPick = kit !== 'auto' ? kit : null;
  renderer.photoDim = s.photoDim ?? 0.4;
  renderer.uiStyle = decoPick('ui') === 'live' ? 'live' : null; // 🎤 라이브 스테이지 세트
  document.documentElement.classList.toggle('ui-live', !!renderer.uiStyle); // 게임 위 정보 칸·결과 화면도 세트 모양
  applyNoteColors(renderer.studio ? 'basic' : decoPick('notes'));
}
function renderDeco() {
  const s = { ...state.settings, bg: decoPick('bg'), kit: decoPick('kit'), notes: decoPick('notes'), ui: decoPick('ui') };
  const chip = (attr, key, label, bg, on) => {
    const open = decoOpen(attr, key);
    return `<button class="chip ${open ? '' : 'locked'}" data-${attr}="${key}" aria-pressed="${open && on}"><i style="background:${bg}"></i>${label}${open ? '' : ' 🔒'}</button>`;
  };
  const auto = 'conic-gradient(#FF9A6B,#6A1B78,#7A2A1C,#1C4A5E,#FF9A6B)';
  const ph = photo.url ? `center/cover url('${photo.url}')` : '#555';
  $('#set-bg').innerHTML =
    chip('bg', 'auto', '단계별', auto, !s.bg || s.bg === 'auto') +
    chip('bg', 'photo', photo.url ? '📷 내 사진' : '📷 사진 넣기', ph, s.bg === 'photo' && !!photo.url) +
    DECO_THEMES.map((k) => chip('bg', k, THEMES[k].name, `linear-gradient(${THEMES[k].sky.join(',')})`, s.bg === k)).join('') +
    SHOP_BGS.map((k) => chip('bg', k, THEMES[k].name, shopSwatch('bg', k), s.bg === k)).join('');
  $('#set-kit').innerHTML =
    chip('kit', 'auto', '맵 따라', auto, !s.kit || s.kit === 'auto') +
    DECO_THEMES.map((k) => {
      const sh = THEMES[k].kit.shell;
      return chip('kit', k, THEMES[k].name, `radial-gradient(circle at 35% 30%,${sh[0]},${sh[1]} 55%,${sh[2]})`, s.kit === k);
    }).join('') +
    Object.keys(SHOP_KITS).map((k) => chip('kit', k, SHOP_KITS[k].name, shopSwatch('kit', k), s.kit === k)).join('');
  const lanes = (p) => (p.c ? p.c.slice(0, 4).map((c) => c[0]) : LANE_DEFAULT);
  $('#set-notes').innerHTML = Object.entries(NOTE_PALETTES)
    .map(([k, p]) => chip('notes', k, p.name, p.shop ? shopSwatch('notes', k) : `conic-gradient(${lanes(p).join(',')})`, (s.notes || 'basic') === k))
    .join('');
  $('#set-ui').innerHTML = chip('ui', 'basic', '기본', 'linear-gradient(#FF9A6B,#6A1B78)', s.ui !== 'live') + chip('ui', 'live', shopName('ui', 'live'), shopSwatch('ui', 'live'), s.ui === 'live');
  $('#set-photo-opts').hidden = !(decoPick('bg') === 'photo' && photo.url);
  $('#set-photo-dim').value = s.photoDim ?? 0.4;
}

// 📷 내 사진 배경: 고른 사진을 긴 쪽 1600px JPEG 로 줄여 이 폰(IndexedDB)에만 저장. 서버로 안 보냄
const photo = { url: null };
function setPhotoImage(url) {
  if (photo.url && photo.url.startsWith('blob:') && photo.url !== url) URL.revokeObjectURL(photo.url);
  photo.url = url;
  if (!url) {
    renderer.bgPhoto = null;
    return Promise.resolve(false);
  }
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      renderer.bgPhoto = img;
      res(true);
    };
    img.onerror = () => {
      renderer.bgPhoto = null;
      res(false);
    };
    img.src = url;
  });
}
async function loadPhotoBg() {
  try {
    const url = await photoLoad();
    if (url) await setPhotoImage(url);
  } catch {}
}
async function shrinkPhoto(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(src);
  }
}
async function pickPhoto(file) {
  if (!file || !decoOpen('bg', 'photo')) return;
  let blob = null;
  try {
    blob = await shrinkPhoto(file);
  } catch {}
  if (!blob) return toast('이 사진은 못 읽었어요 · 다른 사진으로 해 보세요', 2800);
  if (!(await photoSave(blob))) return toast('사진을 저장하지 못했어요 (브라우저 저장 공간이 막혀 있어요)', 3200);
  await setPhotoImage(await photoLoad());
  state.settings.bg = 'photo';
  saveSettings(state.settings);
  applyDeco();
  renderDeco();
  toast('📷 배경으로 넣었어요! 다음 판부터 보여요', 2400);
}
const LANE_DEFAULT = LANE.slice(0, 4).map((l) => l.main);

// ---------------- 🛒 상점 (2026-11-22, 밤 개편) ----------------
//   가격표는 shop.js (서버와 같이 씀). 상점 전용 물건만 팜: ✨ 콩 스킨(질감·꼬리·반짝이) · 🌄 새 그림 배경 · 🥁 새 드럼 · 📷 내 사진
//   물건을 누르면 팝업(실제 게임 화면 미리보기 + 사기). 운영자가 admin 에서 열기 전엔 구경만(state.cfg.shopOpen)
//   인증한 계정 = 서버 지갑에서 차감(/api/shop/buy, 모아 둔 코인을 같이 보냄), 인증 전 = 이 폰 코인에서 차감
const SHOP_BGS = SHOP_ITEMS.map(([id]) => id.split(':')).filter(([t, k]) => t === 'bg' && THEMES[k] && THEMES[k].img).map(([, k]) => k);
const shopIsOpen = () => !!state.cfg.shopOpen;
function shopSwatch(type, key) {
  if (type === 'ui') return 'linear-gradient(160deg,#1A1450 0%,#3A2A8A 45%,#FF8AD8 70%,#7DF2FF 100%)';
  if (type === 'notes') {
    const p = NOTE_PALETTES[key];
    const c = (p && p.c ? p.c.slice(0, 4).map((x) => x[0]) : LANE_DEFAULT).join(',');
    if (key === 'gold') return 'radial-gradient(circle at 35% 30%,#FFFBE0,#FFD23F 45%,#B07A00)';
    if (key === 'galaxy') return 'radial-gradient(circle at 35% 30%,#FF9AE8,#7A3CFF 50%,#140A46)';
    return `conic-gradient(${c})`;
  }
  if (key === 'photo') return 'linear-gradient(135deg,#ffd6a5,#bde0fe)';
  if (type === 'kit' && SHOP_KITS[key]) {
    const k = SHOP_KITS[key].kit;
    if (k.finish === 'rainbow') return 'conic-gradient(#FF4D6D,#FF9F1C,#FFE14D,#3FD6A0,#3FA9FF,#9B6BFF,#FF4D6D)';
    return `radial-gradient(circle at 35% 30%,${k.shell[0]},${k.shell[1]} 55%,${k.shell[2]})`;
  }
  const t = THEMES[key];
  if (!t) return '#555';
  if (type === 'bg' && t.img) return `center/cover url('${t.img}')`;
  if (type === 'kit') {
    const sh = t.kit.shell;
    return `radial-gradient(circle at 35% 30%,${sh[0]},${sh[1]} 55%,${sh[2]})`;
  }
  return `linear-gradient(${t.sky.join(',')})`;
}
function shopName(type, key) {
  if (type === 'ui') return '🎤 라이브 스테이지 세트';
  if (type === 'notes') return (NOTE_PALETTES[key] || {}).name || key;
  if (key === 'photo') return '📷 내 사진 배경';
  if (type === 'kit' && SHOP_KITS[key]) return SHOP_KITS[key].name;
  return (THEMES[key] || {}).name || key;
}
const SHOP_DESC = {
  notes: '콩 모양에 질감 + 꼬리 + 반짝이가 붙어요',
  bg: '상점에서만 파는 무대예요',
  kit: '상점에서만 파는 드럼 세트예요',
  photo: '내 사진을 무대 배경으로 깔아요',
  ui: '판정선·콩·판정 글자·콤보·무대가 리듬게임 라이브 화면처럼 한 번에 바뀌어요',
};
function renderShop() {
  $('#shop-coins').textContent = fmt(getCoins());
  $('#shop-closed').hidden = shopIsOpen();
  const item = ([id, price, rare]) => {
    const [type, key] = id.split(':');
    const own = decoOpen(type, key);
    return `<button class="shop-item r-${rare} ${own ? 'owned' : ''}" data-shop="${id}">
      <em class="rar">${RARITY_NAME[rare]}</em>
      <i style="background:${shopSwatch(type, key)}"></i><b>${escapeHtml(shopName(type, key))}</b>
      <span>${own ? '보유' : `<i class="coin-ico"></i>${fmt(price)}`}</span></button>`;
  };
  const sec = (title, type) => `<h4>${title}</h4><div class="shop-grid">${SHOP_ITEMS.filter(([id]) => id.startsWith(type + ':')).map(item).join('')}</div>`;
  $('#shop-list').innerHTML = sec('🎤 세트', 'ui') + sec('✨ 콩 스킨', 'notes') + sec('🌄 배경', 'bg') + sec('🥁 드럼 세트', 'kit');
}
function openShop(focus) {
  renderShop();
  openModal('modal-shop');
  if (typeof focus === 'string' && priceOf(focus) != null) previewShop(focus);
}
// 👀 미리보기 팝업: 실제 게임 화면. 고른 것만 바꾸고 나머지는 지금 꾸미기 그대로
var shopPrevId = null;
function previewShop(id) {
  const [type, key] = id.split(':');
  if (priceOf(id) == null) return;
  shopPrevId = id;
  const own = decoOpen(type, key);
  const rare = RARITY[id];
  $('#shopitem-rar').textContent = RARITY_NAME[rare] || '';
  $('#shopitem-rar').className = 'rar r-' + rare;
  $('#shopitem-name').textContent = shopName(type, key);
  $('#shopitem-desc').textContent = key === 'photo' ? SHOP_DESC.photo : SHOP_DESC[type];
  const b = $('#shopitem-buy');
  const using = own && decoPick(type) === key;
  if (own) {
    // 쓰는 중이면 기본으로 되돌리는 버튼 (2026-11-22 '세트 샀는데 기본으로도 돌아갈 수 있게')
    b.innerHTML = using ? '✓ 쓰는 중 · 기본으로 돌리기' : '이걸로 바꾸기';
    b.disabled = false;
  } else if (!shopIsOpen()) {
    b.innerHTML = `🔒 판매 준비 중 · <i class="coin-ico"></i> ${fmt(priceOf(id))}`;
    b.disabled = true;
  } else {
    b.innerHTML = `<i class="coin-ico"></i> ${fmt(priceOf(id))} 사기`;
    b.disabled = false;
  }
  openModal('modal-shopitem');
  const pick = { bg: decoPick('bg'), kit: decoPick('kit'), notes: decoPick('notes'), ui: decoPick('ui') };
  pick[type] = key;
  // 콩 스킨은 어두운 무대에서 (화려한 맵 위에선 잘 안 보임)
  if (type === 'notes' && pick.bg === 'auto') pick.bg = 'void';
  const kc = $('#shopitem-kit');
  kc.hidden = type !== 'kit';
  if (type === 'kit') requestAnimationFrame(() => drawKitCloseup(kc, key));
  startShopPreview($('#shopitem-cv'), { ...pick, photo: pick.bg === 'photo' ? renderer.bgPhoto : null }).catch(() => {});
}
function closeShopPreview() {
  stopShopPreview();
  shopPrevId = null;
  closeModal('modal-shopitem');
  applyDeco(); // 미리보기로 바꾼 콩 스킨 되돌리기
}
function closeShop() {
  closeShopPreview();
  closeModal('modal-shop');
}
/** 산 것을 바로 씀 (사진 배경이면 사진 고르기) */
function equipDeco(id) {
  const [type, key] = id.split(':');
  if (type === 'bg' && key === 'photo') {
    if (!photo.url) return $('#set-photo-file').click();
  }
  state.settings[type] = key;
  saveSettings(state.settings);
  applyDeco();
  renderDeco();
}
async function buyShop(id) {
  const price = priceOf(id);
  const [type, key] = id.split(':');
  if (price == null || decoOpen(type, key)) return;
  if (!shopIsOpen()) return toast('🔒 상점은 곧 열려요 · 지금은 구경만 돼요', 2400);
  if (getCoins() < price) return toast(`🪙 코인이 ${fmt(price - getCoins())}개 모자라요 · 콩을 맞히면 쌓여요`, 2600);
  const name = shopName(type, key);
  const account = isConfirmed() && state.api && state.api.mode === 'server';
  if (account) {
    if (load('coinSending', null)) return toast('코인 보내는 중이에요 · 잠시 뒤 다시 눌러 주세요', 2200);
    try {
      const r = await state.api.buy(id);
      save('decoOwned', [...new Set([...(load('decoOwned', []) || []), ...(r.owned || []), id])]);
    } catch (e) {
      if (e && e.status === 402) return renderShop(), toast('🪙 코인이 모자라요', 2200);
      if (e && e.data && e.data.error === 'shop_closed') {
        state.cfg.shopOpen = false;
        renderShop();
        return toast('🔒 상점은 곧 열려요 · 지금은 구경만 돼요', 2400);
      }
      return toast(e && e.status === 503 ? '서버가 잠깐 쉬는 중이라 지금은 못 사요 · 조금 뒤 다시' : '사지 못했어요 · 잠시 뒤 다시 해 주세요', 2800);
    }
  } else {
    const have = Number(load('coins', 0)) || 0;
    if (have < price) return toast('🪙 코인이 모자라요', 2200);
    save('coins', have - price);
    save('decoOwned', [...new Set([...(load('decoOwned', []) || []), id])]);
  }
  refreshCoins();
  renderShop();
  equipDeco(id);
  audio.unlock().then(() => audio.sfxFile('buy', 0.9)).catch(() => {}); // 🔔 구매
  if (shopPrevId === id) previewShop(id);
  toast(`🎉 ${name} 샀어요! 바로 적용했어요`, 2400);
}
/** 상점 개편 전에 이 폰 코인으로 산 것(이제 무료) 값 돌려주기 — 인증 전 폰만, 한 번 */
function refundLegacyLocal() {
  if (load('legacyRefund1', false)) return;
  save('legacyRefund1', true);
  if (isConfirmed() || load('confirmedAt', null)) return;
  const { refund } = legacyRefund(load('decoOwned', []) || []);
  if (refund > 0) {
    save('coins', (Number(load('coins', 0)) || 0) + refund);
    toast(`🛒 상점이 바뀌어서 예전에 산 꾸미기 값 ${fmt(refund)}코인을 돌려드렸어요`, 3200);
  }
}
function bindDeco() {
  loadPhotoBg();
  $('#set-photo-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    pickPhoto(f);
  });
  $('#set-photo-dim').addEventListener('input', (e) => {
    state.settings.photoDim = Number(e.target.value);
    saveSettings(state.settings);
    applyDeco();
  });
  $('#set-photo-opts').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-photo-act]');
    if (!a) return;
    if (a.dataset.photoAct === 'change') return $('#set-photo-file').click();
    await photoDelete();
    await setPhotoImage(null);
    state.settings.bg = 'auto';
    saveSettings(state.settings);
    applyDeco();
    renderDeco();
    toast('사진을 지웠어요', 1800);
  });
  $('#shop-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]');
    if (b) previewShop(b.dataset.shop);
  });
  $('#shopitem-buy').addEventListener('click', () => {
    const id = shopPrevId;
    if (!id) return;
    const [type, key] = id.split(':');
    if (!decoOpen(type, key)) return buyShop(id);
    if (decoPick(type) === key) {
      state.settings[type] = DECO_FREE[type];
      saveSettings(state.settings);
      applyDeco();
      renderDeco();
      previewShop(id);
      return toast('기본으로 돌렸어요 · 다시 쓰려면 「이걸로 바꾸기」', 2000);
    }
    equipDeco(id);
    previewShop(id);
    toast(`${shopName(type, key)}(으)로 바꿨어요`, 1800);
  });
  $('#set-deco').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const s = state.settings;
    const [type, key] = Object.entries(DECO_FREE).map(([t]) => [t, b.dataset[t]]).find(([, k]) => k) || [];
    if (!decoOpen(type, key)) return openShop(`${type}:${key}`);
    if (b.dataset.bg === 'photo' && !photo.url) return $('#set-photo-file').click();
    if (b.dataset.bg) s.bg = b.dataset.bg;
    if (b.dataset.kit) s.kit = b.dataset.kit;
    if (b.dataset.notes) s.notes = b.dataset.notes;
    if (b.dataset.ui) s.ui = b.dataset.ui;
    saveSettings(s);
    applyDeco();
    renderDeco();
    audio.unlock().then(() => audio.snare()).catch(() => {});
  });
}

function updateSettingLabels() {
  const s = state.settings;
  $('#set-offset-val').textContent = s.offsetMs === 0 ? '0ms' : `${s.offsetMs > 0 ? '+' : ''}${s.offsetMs}ms`;
}
/** 저사양 모드 적용: 게임 그림(해상도·효과) + 화면 꾸밈(애니메이션·그림자) */
function applyLite() {
  const on = !!state.settings.lite;
  // 저사양 모드를 직접 껐으면 자동 화질도 처음(최고)부터 다시
  if (!on && renderer.lite) {
    renderer.quality = 2;
    save('gfxQ', 2);
  }
  renderer.lite = on;
  document.documentElement.classList.toggle('lite', on);
  if ($('#screen-game').classList.contains('active')) renderer.resize();
}
function bindSettings() {
  bindDeco();
  const upd = () => {
    const s = state.settings;
    s.music = Number($('#set-music').value);
    s.sfx = Number($('#set-sfx').value);
    s.offsetMs = Number($('#set-offset').value);
    s.vibrate = $('#set-vibrate').checked;
    s.lite = $('#set-lite').checked;
    applyLite();
    audio.setVolumes({ music: s.music, sfx: s.sfx });
    saveSettings(s);
    updateSettingLabels();
  };
  ['#set-music', '#set-sfx', '#set-offset', '#set-vibrate', '#set-lite'].forEach((id) => $(id).addEventListener('input', upd));
  $('#set-band').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-band]');
    if (!b) return;
    state.settings.band = b.dataset.band;
    saveSettings(state.settings);
    audio.orchOn = b.dataset.band !== 'piano';
    $$('#set-band button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    await audio.unlock();
    if (audio.orchOn) audio.loadOrch().then((ok) => ok && audio.fanfare());
    else audio.fanfare();
  });
  $('#set-sfx').addEventListener('change', async () => {
    await audio.unlock();
    audio.snare();
  });
}

const calib = { taps: [], clicks: [], active: false, required: false, after: null, fails: 0 };

/** 박자 보정을 한 번도 안 했고 직접 맞춘 값도 없으면 필수 (이번 접속에서 '나중에'를 눌렀으면 넘어감) */
function needsCalibration() {
  if (state.studio.active || state.auto || state.calibSkipped) return false;
  return !load('calibrated', false) && !state.settings.offsetMs;
}

/** 보정 창 열기. required 면 닫을 수 없고, 성공하면 after() 로 이어서 시작 */
function openCalibration({ required = false, after = null } = {}) {
  Object.assign(calib, { required, after, fails: 0, active: false });
  $('#calib-title').textContent = required ? '처음 한 번! 박자 맞추기' : '싱크 보정';
  $('#calib-desc').innerHTML = required
    ? '폰·이어폰마다 소리가 조금씩 늦게 들려요. <b>똑 소리(또는 반짝임)에 맞춰</b> 아래 드럼을 <b>8번</b> 탭하면 내 폰에 딱 맞게 보정돼요. 10초면 끝!'
    : '"똑" 소리에 맞춰 아래 드럼을 탭하세요. (8번)';
  $('#calib-count').textContent = '준비';
  $('#calib-result').textContent = '';
  $('#calib-close').hidden = required;
  $('#calib-skip').hidden = true;
  $('#calib-done').hidden = true;
  $('#calib-start').textContent = '시작';
  $('#calib-start').classList.add('btn-primary');
  $('#calib-start').classList.remove('btn-ghost');
  openModal('modal-calibrate');
}
async function startCalibration() {
  if (calib.active) return; // 측정 중에 또 누르면 무시
  await audio.unlock();
  $('#calib-done').hidden = true;
  $('#calib-skip').hidden = true;
  calib.taps = [];
  calib.active = true;
  const clicks = playMetronome(audio, 100, 12);
  calib.clicks = clicks;
  $('#calib-result').textContent = '';
  const pad = $('#calib-pad');
  clicks.forEach((t, i) => {
    const ms = (t - audio.ctx.currentTime) * 1000;
    setTimeout(() => {
      $('#calib-count').textContent = i < 4 ? `준비 ${4 - i}` : String(i - 3);
      pad.classList.add('beat');
      setTimeout(() => pad.classList.remove('beat'), 90);
    }, ms);
  });
  const endMs = (clicks[clicks.length - 1] - audio.ctx.currentTime) * 1000 + 600;
  setTimeout(finishCalibration, endMs);
}
function finishCalibration() {
  calib.active = false;
  const diffs = [];
  for (const t of calib.taps) {
    let best = null;
    for (const c of calib.clicks.slice(4)) if (best === null || Math.abs(t - c) < Math.abs(t - best)) best = c;
    if (best !== null && Math.abs(t - best) < 0.3) diffs.push(t - best);
  }
  $('#calib-count').textContent = '끝!';
  if (diffs.length < 4) {
    $('#calib-result').textContent = '탭이 너무 적어요. 소리(또는 반짝임)에 맞춰 8번 눌러 주세요!';
    $('#calib-start').textContent = '다시 하기';
    // 계속 안 되는 폰(소리 꺼짐·터치 문제)이 갇히지 않게, 3번 실패하면 이번 접속만 건너뛸 수 있음
    if (++calib.fails >= 3 && calib.required) $('#calib-skip').hidden = false;
    // 이미 한 번 성공해서 저장된 값이 있으면 그 값으로 시작할 수도 있음
    if (calib.required && load('calibrated', false)) $('#calib-done').hidden = false;
    return;
  }
  diffs.sort((a, b) => a - b);
  const med = diffs[Math.floor(diffs.length / 2)];
  const ms = Math.max(-200, Math.min(200, Math.round((med * 1000) / 5) * 5));
  state.settings.offsetMs = ms;
  saveSettings(state.settings);
  save('calibrated', true);
  $('#set-offset').value = ms;
  updateSettingLabels();
  $('#calib-result').textContent = `보정값 ${ms > 0 ? '+' : ''}${ms}ms 저장했어요. 잘못 쳤다면 다시 할 수 있어요!`;
  // 결과를 보고 다시 할 수 있게: '다시 하기'는 보조 버튼으로, 필수 보정이면 '이 값으로 시작하기'로 이어감
  $('#calib-start').textContent = '다시 하기';
  $('#calib-start').classList.remove('btn-primary');
  $('#calib-start').classList.add('btn-ghost');
  if (calib.required) $('#calib-done').hidden = false;
}

// ---------------- 🎵 내 노래로 치기 ----------------
//   폰에 있는 노래(mp3)·영상(mp4·화면 녹화)을 넣으면 BPM·박을 찾아(beatsync.js) 그 노래에 맞는 채보를 만들고
//   노래를 틀면서 직접 침 (자동 연주 없음). 파일은 이 폰 메모리에만 (서버로 안 감, API 요청도 없음)
//   기록·랭킹·통계엔 안 들어감. 🎬 녹화 버튼을 켜면 치는 화면 + 소리를 영상으로 저장
const MY_ID = 'my';
const my = { url: null, name: '', buf: null, mono: null, bpm: null, beat0: null, sound0: 0, diff: load('myDiff', 'easy'), from: 'start', rec: false, level: null, blob: null, blobUrl: null };
const myBusy = () => my.loading;
function openMysong() {
  if (followGated()) {
    openVerify(null, { label: '🎵 최신곡으로 치기는 팔로워만', then: openMysong });
    return;
  }
  if (state.game) state.game.stop();
  $$('#my-diff button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.diff === my.diff));
  $$('#my-from button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.from === my.from));
  $('#my-start-wrap').hidden = my.from !== 'pick';
  const ok = canRecordFile();
  $('#my-rec').disabled = !ok;
  $('#my-rec').checked = ok && my.rec;
  $('#my-rec-hint').textContent = ok ? '켜면 치는 화면이 노래 소리까지 영상 파일로 저장돼요.' : '이 브라우저는 바로 녹화가 안 돼요. 폰 화면 녹화로 찍어 주세요.';
  show('screen-mysong');
}
async function myPick(file) {
  if (my.loading) return;
  if (my.url) URL.revokeObjectURL(my.url);
  my.url = URL.createObjectURL(file);
  my.name = file.name.replace(/\.[^.]+$/, '').slice(0, 30);
  my.buf = my.mono = null;
  my.bpm = my.beat0 = null;
  $('#my-opts').hidden = true;
  $('#my-result').hidden = true;
  my.loading = true;
  audio.unlock();
  const buf = await openTrackFile(my.url, file, (t, mb) => ($('#my-status').textContent = `노래 여는 중… ${t}초 (파일 ${fmtMb(mb)}, 보통 몇 초면 돼요)`));
  my.loading = false;
  if (!buf) {
    // 아이폰은 화면 녹화(.mov) 같은 영상을 바로 못 풀어서 → 소리 없이 한 번 재생하며 읽음.
    //   아이폰은 버튼을 눌러야 영상 재생을 허락해서, 버튼을 누르게 함
    $('#my-status').innerHTML =
      '이 영상은 한 번 재생하면서 소리를 읽어야 해요 (<b>영상 길이만큼</b> 걸려요, 소리는 안 나요).' +
      '<button class="btn btn-hot my-cap" type="button" data-action="mysong-capture">영상 소리 읽기</button>';
    return;
  }
  myLoaded(buf);
}
/** 영상 소리 읽기 (버튼 안에서 바로 재생해야 아이폰이 허락함) */
async function myCapture() {
  if (!my.url || my.loading) return;
  my.loading = true;
  audio.unlock();
  $('#my-status').textContent = '영상 소리 읽는 중… 화면을 끄지 마세요';
  const buf = await captureMediaAudio(my.url, (t, d) => ($('#my-status').textContent = capText(t, d)), 360);
  my.loading = false;
  if (buf) {
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(my.url, buf);
  }
  myLoaded(buf);
}
function myLoaded(buf) {
  if (!buf || buf.duration < 12) {
    $('#my-status').textContent = buf ? '노래가 너무 짧아요 (12초 넘는 걸로 넣어 주세요)' : '소리를 못 읽었어요. 소리가 들어 있는 mp3·m4a·mp4 로 해 보세요';
    return;
  }
  my.buf = buf;
  my.mono = monoOf(buf);
  myDetect();
}
/** BPM·박 찾기 (노래 가운데쯤에서 재고, 앞뒤로 같은 박 간격을 이어 씀) */
function myDetect(hintBpm = null) {
  const buf = my.buf;
  const sr = buf.sampleRate;
  my.sound0 = soundStart(my.mono, sr);
  const winStart = Math.max(my.sound0 + 3, Math.min(buf.duration * 0.3, buf.duration - 26));
  const r = detectBeat(my.mono, sr, { start: Math.max(0, winStart), hintBpm });
  if (!r) {
    $('#my-status').textContent = '박자를 못 찾았어요. 드럼 소리가 뚜렷한 노래로 해 보세요';
    return;
  }
  my.bpm = Math.round(r.bpm * 10) / 10;
  my.beat0 = r.firstBeat; // 노래 가운데쯤의 '쿵' 박
  const m = Math.floor(buf.duration / 60);
  $('#my-status').innerHTML = `<b>${escapeHtml(my.name)}</b> · ${m}:${String(Math.floor(buf.duration % 60)).padStart(2, '0')} · <b>${my.bpm} BPM</b>${r.confidence < 0.3 ? ' · 박이 흐릿해서 조금 어긋날 수 있어요' : ''}${buf.partial ? `<br>⚠️ 영상 앞 ${Math.round(buf.duration)}초만 읽혔어요 (읽는 동안 화면을 켜 두세요)` : ''}`;
  $('#my-bpm').textContent = `${my.bpm} BPM`;
  $('#my-opts').hidden = false;
}
function myMul(m) {
  if (!my.buf || !my.bpm) return;
  const want = my.bpm * m;
  if (want < 50 || want > 220) return toast('더는 바꿀 수 없어요');
  myDetect(want);
  toast(`${my.bpm} BPM 으로 바꿨어요`, 1400);
}
/** 고른 옵션으로 채보 만들기 → 판 */
function myBuild() {
  const buf = my.buf;
  const beat = 60 / my.bpm;
  const bar = beat * 4;
  // 시작: 처음부터면 첫 소리, 아니면 적은 시각. '쿵' 박 줄(2박 간격)에 맞춰 그 뒤 첫 박
  const pick = my.from === 'pick' ? parseTime($('#my-start').value) : null;
  const from = Math.max(0, Math.min(buf.duration - 12, pick ?? my.sound0));
  const k = Math.ceil((from - my.beat0) / (beat * 2) - 1e-6);
  const first = my.beat0 + k * beat * 2;
  const len = Number($('#my-len').value) || 0;
  const end = len ? Math.min(buf.duration, first + len) : buf.duration;
  const bars = Math.floor((end - first) / bar);
  if (bars < 2) return null;
  const chart = songChart(my.mono, buf.sampleRate, { firstBeat: first, bpm: my.bpm, bars, diff: my.diff });
  if (!chart.bars.some((b) => /[^.]/.test(b))) return null;
  const countIn = bar * COUNT_IN_BARS;
  return {
    id: MY_ID,
    custom: true,
    name: my.name || '내 노래',
    composer: '내 노래',
    songName: my.name || '내 노래',
    tagline: '',
    theme: 'city',
    difficulty: my.diff === 'hard' ? 5 : my.diff === 'normal' ? 3 : 1,
    bpm: my.bpm,
    bars: chart.bars,
    // 노래 파일: 채보 첫 마디 = 노래의 first 초. 처음부터면 노래를 0초부터 틀고 채보는 그만큼 뒤에
    song: { ...LEVELS[0].song, audio: { src: my.url, offset: first, gain: 1 } },
    leadIn: pick == null ? Math.max(0, first - countIn) : 0,
  };
}
async function myStart() {
  if (!my.buf || !my.bpm) return toast('노래 파일을 먼저 골라 주세요');
  const lv = myBuild();
  if (!lv) return toast('채보를 못 만들었어요. 시작 위치나 길이를 바꿔 보세요');
  my.level = lv;
  my.rec = $('#my-rec').checked && !$('#my-rec').disabled;
  $('#my-result').hidden = true;
  await startLevel(MY_ID);
}
async function myFinish(res) {
  const blob = await stopRecorder();
  if (state.game) state.game.stop();
  if (my.blobUrl) URL.revokeObjectURL(my.blobUrl);
  my.blob = blob && blob.size ? blob : null;
  my.blobUrl = my.blob ? URL.createObjectURL(my.blob) : null;
  const acc = Math.round((res.accuracy || 0) * 100);
  $('#my-res-text').innerHTML =
    `<b class="my-grade">${res.grade}</b> ${fmt(res.score)}점 · 정확도 ${acc}% · 최대 콤보 ${res.maxCombo}` +
    `<br><small>PERFECT ${res.counts.perfect} · GREAT ${res.counts.great} · GOOD ${res.counts.good} · MISS ${res.counts.miss}</small>`;
  const v = $('#my-video');
  v.hidden = !my.blobUrl;
  $('#my-save').hidden = !my.blobUrl;
  if (my.blobUrl) {
    v.src = my.blobUrl;
    v.onloadedmetadata = () => {
      try {
        v.currentTime = 0.1;
      } catch {}
    };
  }
  $('#my-result').hidden = false;
  openMysong();
  requestAnimationFrame(() => $('#my-result').scrollIntoView({ block: 'start' }));
}
async function mySave() {
  if (!my.blob) return;
  const ext = my.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([my.blob], `okaystra-내노래.${ext}`, { type: my.blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = my.blobUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------------- 🎹 유저 맵 ----------------
//   유저가 피아노로 멜로디를 찍고(또는 노래 파일에서 음을 따서) 드럼 노트를 붙여 올리는 맵. 운영자 개입 없음
//   올라가는 건 음표 데이터뿐 (몇 KB). 요청: 목록 볼 때(1분 캐시) · 맵 받을 때 · 올리기/좋아요/신고 누를 때만
const UM_ID = 'um';
const um = { level: null, from: 'list', sort: 'new', mapId: null, list: null, wasAuto: false, mode: load('mapMode', 'free') === 'hearts' ? 'hearts' : 'free', top: null };
const newDraft = () => ({ name: '', bpm: 100, mel: [[], [], [], []], drums: autoDrums([[], [], [], []], 'easy'), drumsAuto: 'easy', bar: 0, cur: 0, len: 2, oct: 4, way: 'play', step: false, tab: 'mel' });
let mk = load('mapDraft', null);
if (!mk || !Array.isArray(mk.mel) || !Array.isArray(mk.drums) || mk.mel.length !== mk.drums.length || mk.mel.length < 2) mk = newDraft();
if (!['drum', 'mel', 'done'].includes(mk.tab)) mk.tab = 'mel';
if (!['play', 'file', 'score'].includes(mk.way)) mk.way = 'play';
const mkSave = () => save('mapDraft', mk);
/** ↩ 되돌리기: 녹음·자동 채우기 직전 모습 하나 (폰에 저장 안 함) */
let mkUndo = null;
const mkSnap = () => {
  mkUndo = JSON.stringify({ mel: mk.mel, drums: mk.drums, drumsAuto: mk.drumsAuto, bpm: mk.bpm, prog: mk.prog || null, songDrums: mk.songDrums || null, low: mk.low || null });
  $('#mk-undo').disabled = false;
};
const umLikes = () => load('mapLikes', {});

function openMaps() {
  if (followGated()) {
    openVerify(null, { label: '🎹 유저 맵은 팔로워만', then: openMaps });
    return;
  }
  if (state.game) state.game.stop();
  $$('#maps-sort button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sort === um.sort));
  show('screen-maps');
  loadMaps();
}
async function loadMaps(fresh = false) {
  const box = $('#maps-list');
  if (!state.api.maps) {
    box.innerHTML = '<p class="rank-empty">지금은 서버에 연결이 안 돼서 유저 맵을 못 불러와요</p>';
    return;
  }
  if (!um.list) box.innerHTML = '<p class="rank-empty">불러오는 중…</p>';
  try {
    const r = await state.api.maps(um.sort, fresh);
    um.list = r.maps || [];
    um.snap = r.snap || null;
    renderMaps();
  } catch (e) {
    box.innerHTML = e.status === 503 ? snapNotice(null).replace('랭킹은', '유저 맵은') : `<p class="rank-empty">${e.status === 429 ? '오늘 서버가 바빠요. 내일 오전 9시에 다시 열려요' : '못 불러왔어요. 잠시 뒤 다시 해 보세요'}</p>`;
  }
}
/** 📴 서버가 쉬는 동안 유저 맵 목록 위 안내 */
function mapsSnapNotice() {
  const n = snapNotice({ snap: um.snap });
  return n.replace('</b> 기준 랭킹이에요', '</b>까지 올라온 맵이에요 · 지금은 치기만 돼요').replace('실시간으로 업데이트돼요', '기록·좋아요·올리기가 다시 돼요');
}
function renderMaps() {
  const box = $('#maps-list');
  const likes = umLikes();
  if (!um.list.length) {
    box.innerHTML = '<p class="rank-empty">아직 올라온 맵이 없어요</p>';
    return;
  }
  box.innerHTML = (um.snap ? mapsSnapNotice() : '') + um.list
    .map((m) => {
      const liked = !!likes[m.id];
      return `<div class="map-card" data-id="${m.id}">
        <div class="map-info"><h4>${escapeHtml(m.name)}</h4>
          <p>${escapeHtml(m.nick || '익명')} · ${Math.round(m.bpm)} BPM · ${m.bars}마디 · ${DIFFICULTY_WORDS[m.diff] || ''}</p>
          <p class="map-meta">▶ ${fmt(m.plays)} · ❤ ${fmt(m.likes)}</p></div>
        <div class="map-btns">
          <button class="btn btn-primary map-play" type="button" data-map-act="play">▶ 치기</button>
          <div class="map-small">
            <button type="button" data-map-act="like" aria-pressed="${liked}">❤ 좋아요</button>
            ${m.mine ? '<button type="button" data-map-act="delete">지우기</button>' : '<button type="button" data-map-act="report">신고</button>'}
          </div>
        </div>
      </div>`;
    })
    .join('');
}
async function mapAct(id, act, btn) {
  const m = (um.list || []).find((x) => x.id === id);
  if (act === 'play') return playMap(id);
  try {
    if (act === 'like') {
      const likes = umLikes();
      const on = !likes[id];
      const r = await state.api.mapVote(id, 'like', on);
      if (on) likes[id] = 1;
      else delete likes[id];
      save('mapLikes', likes);
      if (m) m.likes = r.likes;
      renderMaps();
      return;
    }
    if (act === 'report') {
      if (!confirm('이 맵을 신고할까요?')) return;
      await state.api.mapVote(id, 'report', true);
      toast('신고했어요. 고마워요', 1800);
      if (btn) btn.disabled = true;
      return;
    }
    if (act === 'delete') {
      if (!confirm('내 맵을 지울까요? 되돌릴 수 없어요')) return;
      await state.api.mapDelete(id);
      um.list = um.list.filter((x) => x.id !== id);
      renderMaps();
      toast('지웠어요', 1400);
    }
  } catch (e) {
    toast(e.status === 403 ? '팔로워 인증을 하면 쓸 수 있어요' : e.status === 404 ? '이미 내려간 맵이에요' : e.status === 503 ? '서버가 쉬는 중이라 오전 9시부터 돼요' : '잠시 뒤 다시 해 보세요', 2200);
  }
}
async function playMap(id) {
  toast('맵 받는 중…', 1500);
  let r;
  try {
    r = await state.api.mapGet(id);
  } catch (e) {
    toast(e.status === 404 ? '이미 내려간 맵이에요' : '맵을 못 받았어요. 다시 해 보세요', 2200);
    if (e.status === 404) loadMaps(true);
    return;
  }
  const map = r.map && cleanMap(r.map.data);
  if (!map) return toast('맵이 이상해요', 2000);
  um.level = mapLevel(map, { id: UM_ID, by: r.map.nick || '', mapId: id });
  um.from = 'list';
  um.mapId = id;
  um.top = r.top || null;
  openMapMode(r.map.name);
}
/** 🛡 무적 / ❤ 하트 5개 고르기 + 모드별 1~3등 (맵 받을 때 같이 온 것) */
function mapTopHTML(list) {
  if (!list || !list.length) return '<li class="mm-empty">아직 기록 없음</li>';
  const medal = ['🥇', '🥈', '🥉'];
  return list.map((r, i) => `<li><span>${medal[i]}</span><em>${escapeHtml(r.nick || '익명')}</em><b>${fmt(r.score)}</b></li>`).join('');
}
function openMapMode(name) {
  $('#mm-name').textContent = name || '유저 맵';
  for (const mode of ['free', 'hearts']) {
    $(`#mm-top-${mode}`).innerHTML = mapTopHTML(um.top && um.top[mode]);
    $(`#modal-mapmode [data-mm="${mode}"]`).setAttribute('aria-pressed', String(um.mode === mode));
  }
  openModal('modal-mapmode');
}
async function startMapMode(mode) {
  um.mode = mode === 'hearts' ? 'hearts' : 'free';
  save('mapMode', um.mode);
  closeModal('modal-mapmode');
  await startLevel(UM_ID);
}
/** ❤ 하트 모드: 다 쓰면 이어하기 없이 바로 끝 (기록 안 남음) */
function umDeath() {
  const g = state.game;
  if (g && g.state === 'dead') g.giveUp();
}
/** 판 끝 (유저 맵) */
function umFinish(res) {
  if (state.game) state.game.stop();
  const auto = state.auto;
  if (um.wasAuto) {
    state.auto = false;
    um.wasAuto = false;
  }
  if (um.from === 'make') {
    openMapMake();
    if (!auto) toast(`${res.grade} · ${fmt(res.score)}점 · 정확도 ${Math.round((res.accuracy || 0) * 100)}%`, 3000);
    return;
  }
  show('screen-maps');
  const acc = Math.round((res.accuracy || 0) * 100);
  const liked = !!umLikes()[um.mapId];
  const box = $('#maps-list');
  const banner = document.createElement('div');
  banner.className = 'map-res';
  const mode = um.mode;
  const modeName = mode === 'hearts' ? '❤ 하트 5개' : '🛡 무적';
  // 🏆 기록 보내기: 무적은 끝까지 친 판, 하트는 살아남은 판만 (판마다 요청 1번)
  const canRank = !auto && !res.practice && !res.stopped && um.mapId && state.api.mapScore && !(mode === 'hearts' && res.failed);
  banner.innerHTML = `<b>${res.failed ? '💔' : res.grade}</b> ${fmt(res.score)}점 · 정확도 ${acc}% · 최대 콤보 ${res.maxCombo}
    <div class="map-rank"><small>${modeName} 랭킹</small><ol id="map-res-top">${res.failed && mode === 'hearts' ? '<li class="mm-empty">하트를 다 써서 이번 판은 기록이 안 남아요</li>' : canRank ? '<li class="mm-empty">기록 올리는 중…</li>' : mapTopHTML(um.top && um.top[mode])}</ol></div>
    <div class="map-res-btns"><button class="btn btn-ghost" type="button" data-map-again>다시 치기</button>${liked ? '' : '<button class="btn btn-hot" type="button" data-map-like>❤ 이 맵 좋아요</button>'}</div>`;
  if (canRank) {
    const id = um.mapId;
    state.api
      .mapScore(id, mode, res.score)
      .then((r) => {
        if (um.mapId !== id) return;
        um.top = r.top || um.top;
        const ol = banner.querySelector('#map-res-top');
        if (ol) ol.innerHTML = mapTopHTML(um.top && um.top[mode]);
        const rank = (um.top && um.top[mode] ? um.top[mode] : []).findIndex((x) => x.nick === (state.me && state.me.player && state.me.player.username) && x.score === res.score);
        if (rank >= 0) toast(`${['🥇 1등', '🥈 2등', '🥉 3등'][rank]}! ${modeName} 랭킹에 올랐어요`, 2600);
        else if (r.best) toast('내 최고 기록!', 1600);
      })
      .catch(() => {
        const ol = banner.querySelector('#map-res-top');
        if (ol) ol.innerHTML = '<li class="mm-empty">기록을 못 올렸어요 (서버가 바빠요)</li>';
      });
  }
  box.querySelector('.map-res')?.remove();
  box.prepend(banner);
  banner.querySelector('[data-map-again]').onclick = () => openMapMode(um.level && um.level.name);
  const lb = banner.querySelector('[data-map-like]');
  if (lb)
    lb.onclick = async () => {
      lb.disabled = true;
      await mapAct(um.mapId, 'like');
      $('#maps-list').prepend(banner);
      lb.remove();
    };
  $('#screen-maps').scrollTop = 0;
}
function umQuit() {
  if (um.wasAuto) {
    state.auto = false;
    um.wasAuto = false;
  }
  if (um.from === 'make') openMapMake();
  else openMaps();
}

// ----- 맵 만들기 -----
//   ① 멜로디: 노래 파일에서 자동으로 따거나, 똑딱 소리에 맞춰 건반을 쳐서 녹음 (자세히 고치기 = 한 칸씩)
//   ② 드럼: 멜로디에 맞춰 자동 (쉬움·보통·어려움), 원하면 한 칸씩
//   ③ 처음부터 듣기 → 직접 쳐 보기 → 올리기
const MAPMAKE_OFF = true;
function openMapMake() {
  if (followGated()) {
    openVerify(null, { label: '🎹 맵 만들기는 팔로워만', then: openMapMake });
    return;
  }
  if (state.game) state.game.stop();
  audio.loadPiano();
  show('screen-mapmake');
  // 처음 뜨는 탭은 늘 🎹 멜로디 (사용자 요청 11-21)
  mk.tab = 'mel';
  $('#mk-name').value = mk.name;
  $('#mk-step').checked = !!mk.step;
  mkRender();
}
function mkFixBars() {
  while (mk.drums.length < mk.mel.length) mk.drums.push('K...S...K...S...');
  mk.drums.length = mk.mel.length;
  // 🎵 노래 드럼: 노래에서 딴 그대로 (마디 수가 안 맞게 바뀌면 내가 친 드럼으로)
  if (mk.drumsAuto === 'song' && !(Array.isArray(mk.songDrums) && mk.songDrums.length === mk.mel.length)) mk.drumsAuto = null;
  if (mk.drumsAuto === 'song') mk.drums = [...mk.songDrums];
  else if (mk.drumsAuto) mk.drums = autoDrums(mk.mel, mk.drumsAuto);
  // 🎹 왼손(악보 아래 줄): 마디 수를 멜로디에 맞춤
  if (Array.isArray(mk.low)) {
    while (mk.low.length < mk.mel.length) mk.low.push([]);
    mk.low.length = mk.mel.length;
    if (!mk.low.some((b) => b.length)) mk.low = null;
  }
  mk.bar = Math.max(0, Math.min(mk.mel.length - 1, mk.bar));
  mk.cur = Math.max(0, Math.min(STEPS_PER_BAR - 1, mk.cur));
  mkSave();
}
/** 화음: 노래 파일에서 딴 코드가 있으면 그것(곡의 진짜 코드), 없으면 멜로디로 짐작 */
function mkProg() {
  if (Array.isArray(mk.prog) && mk.prog.length === mk.mel.length && mk.mel.some((b) => b.length)) return mk.prog;
  return harmonize(mk.mel);
}
/** 마디 번호 글자 (탭마다 하나씩 있음) */
function mkBarText() {
  $$('.mk-barno').forEach((el) => (el.textContent = `${mk.bar + 1} / ${mk.mel.length} 마디`));
  const pb = $('#mk-play-bar');
  if (pb && !mkp.bus) pb.textContent = `${mk.bar + 1}마디부터`;
}
const mkDrumNotes = () => mk.drums.reduce((a, d) => a + [...d].reduce((x, c) => x + (CHAR_LANES[c] || []).length, 0), 0);
const mkMelNotes = () => mk.mel.reduce((a, b) => a + b.length, 0);
function mkRender() {
  $('#mk-bpm').textContent = String(mk.bpm);
  mkBarText();
  // 탭
  $$('#mk-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === mk.tab)));
  for (const t of ['drum', 'mel', 'done']) $(`#mk-pane-${t}`).hidden = mk.tab !== t;
  const dn = mkDrumNotes();
  const mn = mkMelNotes();
  $('#mk-tab-drum').textContent = `노트 ${dn}개`;
  $('#mk-tab-mel').textContent = mn ? `음 ${mn}개` : '없음 (드럼만)';
  $('#mk-tab-bars').textContent = `${mk.mel.length}마디`;
  $('#mk-sum').innerHTML = `🥁 드럼 노트 <b>${dn}</b>개 · 🎹 멜로디 ${mn ? `음 <b>${mn}</b>개` : '<b>없음</b> (드럼만 나오는 맵)'}<br>${mk.mel.length}마디 · ${mk.bpm} BPM · 약 ${Math.round((mk.mel.length * 4 * 60) / mk.bpm)}초`;
  $$('#mk-way button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.way === mk.way));
  $('#mk-way-file').hidden = mk.way !== 'file';
  $('#mk-way-play').hidden = mk.way !== 'play';
  $('#mk-way-score').hidden = mk.way !== 'score';
  $$('#mk-len button').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.len) === mk.len));
  $$('#mk-auto button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.diff === mk.drumsAuto));
  $('#mk-auto-song').hidden = !(Array.isArray(mk.songDrums) && mk.songDrums.length === mk.mel.length);
  $('#mk-drum-state').textContent =
    mk.drumsAuto === 'song' ? '· 지금: 노래 드럼 그대로' : mk.drumsAuto ? `· 지금: 자동 ${{ easy: '쉬움', normal: '보통', hard: '어려움' }[mk.drumsAuto] || ''}` : '· 지금: 내가 친 드럼';
  $('#mk-octlabel').textContent = `${midiName(12 * (mk.oct + 1))} ~ ${midiName(12 * (mk.oct + 1) + 23)}`;
  mkKeys();
  mkRoll();
  mkDroll();
  mkGrid();
}
/** 지금 마디 드럼 그림 (4줄 × 16칸). head = 재생·녹음 중 위치 */
const DROLL_ROWS = [
  [CRASH, '크래시', '#e7b52c'],
  [HAT, '하이햇', '#25b865'],
  [SNARE, '짝', '#3d9bff'],
  [KICK, '쿵', '#ff7a3d'],
];
function mkDroll(head = null) {
  const cv = $('#mk-droll');
  if (!cv || !cv.clientWidth) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = 120;
  if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
  if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fffaf3';
  g.fillRect(0, 0, w, h);
  const lx = 44;
  const cw = (w - lx) / STEPS_PER_BAR;
  const rh = h / DROLL_ROWS.length;
  g.font = '11px sans-serif';
  g.textBaseline = 'middle';
  DROLL_ROWS.forEach(([, label], r) => {
    g.fillStyle = '#3b2a4a';
    g.fillText(label, 6, r * rh + rh / 2);
  });
  for (let st = 0; st <= STEPS_PER_BAR; st++) {
    g.fillStyle = st % 4 === 0 ? 'rgba(59,42,74,0.35)' : 'rgba(59,42,74,0.1)';
    g.fillRect(lx + Math.round(st * cw) - (st % 4 === 0 ? 1 : 0), 0, st % 4 === 0 ? 2 : 1, h);
  }
  // 고른 칸 (패드를 치면 여기에 들어감)
  if (mk.dsel != null && !drec.on) {
    g.fillStyle = 'rgba(255,47,125,0.16)';
    g.fillRect(lx + mk.dsel * cw, 0, cw, h);
    g.strokeStyle = '#ff2f7d';
    g.lineWidth = 2;
    g.strokeRect(lx + mk.dsel * cw + 1, 1, cw - 2, h - 2);
  }
  const bar = mk.drums[mk.bar] || '';
  [...bar].forEach((ch, st) => {
    const lanes = CHAR_LANES[ch] || [];
    DROLL_ROWS.forEach(([lane, , color], r) => {
      if (!lanes.includes(lane)) return;
      g.fillStyle = color;
      g.beginPath();
      g.arc(lx + (st + 0.5) * cw, r * rh + rh / 2, Math.min(cw, rh) * 0.38, 0, Math.PI * 2);
      g.fill();
    });
  });
  if (head != null && head >= 0) {
    g.fillStyle = '#ff2f7d';
    g.fillRect(lx + head * cw - 1, 0, 3, h);
  }
}
function mkKeys() {
  const box = $('#mk-keys');
  const base = 12 * (mk.oct + 1);
  if (box.dataset.base === String(base)) return;
  box.dataset.base = String(base);
  const whites = [];
  const blacks = [];
  let wi = 0;
  for (let m = base; m < base + 24; m++) {
    const pc = m % 12;
    if ([1, 3, 6, 8, 10].includes(pc)) blacks.push(`<button type="button" class="mk-key black" data-midi="${m}" style="left:calc(${(wi / 14) * 100}% - 3.2%)"></button>`);
    else {
      whites.push(`<button type="button" class="mk-key" data-midi="${m}"><small>${pc === 0 ? midiName(m) : SOLFA[pc]}</small></button>`);
      wi++;
    }
  }
  box.innerHTML = whites.join('') + blacks.join('');
}
/** 지금 마디 멜로디 그림 (가로 16칸, 세로 음높이). head = 재생·녹음 중 위치(칸, 소수) */
function mkRoll(head = null) {
  const cv = $('#mk-roll');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 320;
  const h = 130;
  if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
  if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fffaf3';
  g.fillRect(0, 0, w, h);
  const notes = mk.mel[mk.bar] || [];
  // 세로: 이 마디 음들 둘레만 (없으면 건반 범위 가운데). 음이 크게 보이게
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
  if (lo === Infinity) (lo = 12 * (mk.oct + 1) + 5), (hi = lo + 12);
  lo -= 2;
  hi += 2;
  while (hi - lo < 12) (lo--, hi++);
  const rows = hi - lo + 1;
  const cw = w / STEPS_PER_BAR;
  const rh = h / rows;
  for (let m = lo; m <= hi; m++) {
    if ([1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12)) {
      g.fillStyle = 'rgba(59,42,74,0.06)';
      g.fillRect(0, h - (m - lo + 1) * rh, w, rh);
    }
  }
  for (let s = 0; s <= STEPS_PER_BAR; s++) {
    g.fillStyle = s % 4 === 0 ? 'rgba(59,42,74,0.35)' : 'rgba(59,42,74,0.1)';
    g.fillRect(Math.round(s * cw) - (s % 4 === 0 ? 1 : 0), 0, s % 4 === 0 ? 2 : 1, h);
  }
  if (head == null && mk.step) {
    g.fillStyle = 'rgba(255,95,162,0.22)';
    g.fillRect(mk.cur * cw, 0, Math.min(mk.len, STEPS_PER_BAR - mk.cur) * cw, h);
    g.fillStyle = '#ff2f7d';
    g.fillRect(mk.cur * cw, 0, 3, h);
  }
  g.font = '12px sans-serif';
  g.textBaseline = 'middle';
  for (const n of notes) {
    const y = h - (n.midi - lo + 1) * rh;
    g.fillStyle = '#ff8a4c';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 1.5;
    g.beginPath();
    if (g.roundRect) g.roundRect(n.step * cw + 1, y + 1, n.len * cw - 2, rh - 2, 4);
    else g.rect(n.step * cw + 1, y + 1, n.len * cw - 2, rh - 2);
    g.fill();
    g.stroke();
    if (n.len * cw > 22 && rh > 11) {
      g.fillStyle = '#3b2a4a';
      g.fillText(SOLFA[n.midi % 12], n.step * cw + 4, y + rh / 2);
    }
  }
  if (head != null) {
    g.fillStyle = '#2f8cff';
    g.fillRect(head * cw - 1, 0, 3, h);
  }
}
function mkGrid() {
  if (!$('#mk-drum-more').open) return;
  const rows = [
    ['C', '크래시'],
    ['K', '킥 (쿵)'],
    ['S', '스네어 (짝)'],
    ['H', '하이햇'],
  ];
  const bar = mk.drums[mk.bar];
  $('#mk-grid').innerHTML = rows
    .map(
      ([k, label]) =>
        `<div class="mk-grow"><span>${label}</span><div class="mk-cells">${[...bar]
          .map((ch, s) => `<button type="button" class="mk-cell${s % 4 === 0 ? ' beat' : ''}" data-step="${s}" data-inst="${k}" aria-pressed="${drumCell(ch)[k]}"></button>`)
          .join('')}</div></div>`
    )
    .join('');
}
const LANE_OF = { K: KICK, S: SNARE, H: HAT, C: CRASH };
function mkDrumTap(step, inst) {
  const bar = [...mk.drums[mk.bar]];
  bar[step] = toggleDrum(bar[step], inst);
  mk.drums[mk.bar] = bar.join('');
  mk.drumsAuto = null;
  if (drumCell(bar[step])[inst]) mkSound(() => audio.playLane(LANE_OF[inst], audio.ctx.currentTime + 0.01));
  mkSave();
  mkRender();
}
/** 소리 내기 (처음엔 소리 엔진을 깨움) */
function mkSound(fn) {
  audio.unlock();
  if (!audio.ctx) return;
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
}
/** bar 마디의 from 칸부터 len 칸을 비움 (걸쳐 있던 음은 잘라냄) */
function mkClearRange(bar, from, len) {
  const to = from + len;
  const out = [];
  for (const n of mk.mel[bar]) {
    const end = n.step + n.len;
    if (end <= from || n.step >= to) out.push(n);
    else if (n.step < from) out.push({ ...n, len: from - n.step });
    else if (end > to) out.push({ ...n, step: to, len: end - to });
  }
  mk.mel[bar] = out.sort((a, b) => a.step - b.step);
}
/** 전체 칸 번호 at 에 음 넣기 (마디를 넘으면 그 마디 끝에서 자름, 모자란 마디는 만듦) */
function mkPut(at, midi, len) {
  const bar = Math.floor(at / STEPS_PER_BAR);
  if (bar >= MAP_LIMITS.maxBars) return false;
  while (mk.mel.length <= bar) mk.mel.push([]);
  const step = at % STEPS_PER_BAR;
  len = Math.max(1, Math.min(len, STEPS_PER_BAR - step));
  mkClearRange(bar, step, len);
  mk.mel[bar].push({ step, midi, len });
  mk.mel[bar].sort((a, b) => a.step - b.step);
  return true;
}
function mkAdvance(len) {
  mk.cur += len;
  if (mk.cur >= STEPS_PER_BAR) {
    mk.cur = 0;
    if (mk.bar + 1 >= mk.mel.length) {
      if (mk.mel.length >= MAP_LIMITS.maxBars) {
        mk.cur = STEPS_PER_BAR - 1;
        toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
        return;
      }
      mk.mel.push([]);
    }
    mk.bar++;
  }
}
/** 건반 누름: 녹음 중이면 녹음, 한 칸씩 넣기면 빨간 줄 자리에, 아니면 소리만 */
function mkKeyDown(midi, el) {
  mkSound(() => audio.lead(audio.ctx.currentTime + 0.005, midi, 0.6, audio.musicBus));
  if (rec.on) return recDown(midi, el);
  if (!mk.step) return;
  const len = Math.min(mk.len, STEPS_PER_BAR - mk.cur);
  mkPut(mk.bar * STEPS_PER_BAR + mk.cur, midi, len);
  mkAdvance(len);
  mkFixBars();
  mkRender();
}
function mkRest() {
  const len = Math.min(mk.len, STEPS_PER_BAR - mk.cur);
  mkClearRange(mk.bar, mk.cur, len);
  mkAdvance(len);
  mkFixBars();
  mkRender();
}
/** 한 칸 지우기: 지금 칸 바로 앞 음을 지우고 그 자리로 */
function mkBack() {
  for (let tries = 0; tries < 2; tries++) {
    const notes = mk.mel[mk.bar];
    const prev = notes.filter((n) => n.step < mk.cur || (mk.cur === 0 && n.step === 0)).pop();
    if (prev) {
      notes.splice(notes.indexOf(prev), 1);
      mk.cur = prev.step;
      break;
    }
    if (mk.cur > 0) {
      mk.cur = 0;
      break;
    }
    if (mk.bar === 0) break;
    mk.bar--;
    mk.cur = STEPS_PER_BAR;
  }
  mk.cur = Math.min(mk.cur, STEPS_PER_BAR - 1);
  mkFixBars();
  mkRender();
}
function mkBarOp(op) {
  const b = mk.bar;
  mkSnap();
  if (op === 'add' || op === 'copy') {
    if (mk.mel.length >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    mk.mel.splice(b + 1, 0, op === 'copy' ? mk.mel[b].map((n) => ({ ...n })) : []);
    mk.drums.splice(b + 1, 0, op === 'copy' ? mk.drums[b] : 'K...S...K...S...');
    for (const k of ['prog', 'songDrums']) if (Array.isArray(mk[k]) && mk[k].length === mk.mel.length - 1) mk[k].splice(b + 1, 0, mk[k][b]);
    mk.bar = b + 1;
    mk.cur = 0;
    if (op === 'copy') toast('마디를 복사해서 뒤에 넣었어요', 1400);
  } else if (op === 'clear') {
    mk.mel[b] = [];
    mk.cur = 0;
  } else if (op === 'del') {
    if (mk.mel.length <= MAP_LIMITS.minBars) return toast(`${MAP_LIMITS.minBars}마디는 있어야 해요`, 1400);
    mk.mel.splice(b, 1);
    mk.drums.splice(b, 1);
    for (const k of ['prog', 'songDrums']) if (Array.isArray(mk[k]) && mk[k].length === mk.mel.length + 1) mk[k].splice(b, 1);
  }
  mkFixBars();
  mkRender();
}

// ----- ▶ 처음부터 듣기 (멜로디 + 화음 + 드럼, 조금씩 앞서 예약) -----
const mkp = { bus: null, raf: 0, t0: 0, sd: 0, next: 0, steps: 0, prog: null };
function mkStopPlay() {
  if (!mkp.bus) return;
  const b = mkp.bus;
  mkp.bus = null;
  cancelAnimationFrame(mkp.raf);
  try {
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.03);
    setTimeout(() => b.disconnect(), 400);
  } catch {}
  $('#mk-play-label').textContent = '처음부터 듣기';
  $('#mk-play [data-icon]').innerHTML = icon('play');
  $('#mk-play').classList.remove('playing');
  mkBarText();
  mkRoll();
  mkDroll();
}
/** from = 시작 마디 (0 = 처음부터, 유저 건의 11-22 '해당 마디부터 재생') */
function mkPlayToggle(from = 0) {
  if (mkp.bus) return mkStopPlay();
  from = Math.max(0, Math.min(mk.mel.length - 1, from | 0));
  if (rec.on) recStop();
  if (drec.on) drecStop();
  mkSound(() => {
    const ctx = audio.ctx;
    const bus = ctx.createGain();
    bus.connect(audio.musicBus);
    mkp.bus = bus;
    mkp.sd = 15 / mk.bpm;
    mkp.next = from * STEPS_PER_BAR;
    mkp.t0 = ctx.currentTime + 0.15 - mkp.next * mkp.sd;
    mkp.steps = mk.mel.length * STEPS_PER_BAR;
    mkp.prog = mkProg();
    $('#mk-play-label').textContent = '멈춤';
    $('#mk-play [data-icon]').innerHTML = icon('pause');
    $('#mk-play').classList.add('playing');
    $('#mk-play-bar').textContent = '■ 멈춤';
    const tick = () => {
      if (mkp.bus !== bus) return;
      const now = ctx.currentTime;
      // 0.3초 앞까지 예약
      while (mkp.next < mkp.steps && mkp.t0 + mkp.next * mkp.sd < now + 0.3) {
        mkPlayStep(mkp.next, mkp.t0 + mkp.next * mkp.sd, bus, mkp.prog, mkp.sd, true);
        mkp.next++;
      }
      const pos = (now - mkp.t0) / mkp.sd;
      if (pos >= mkp.steps + 4) return mkStopPlay();
      const bar = Math.max(0, Math.min(mk.mel.length - 1, Math.floor(pos / STEPS_PER_BAR)));
      if (bar !== mk.bar) {
        mk.bar = bar;
        mkBarText();
        mkGrid();
      }
      const head = pos < 0 ? 0 : Math.min(STEPS_PER_BAR, pos - bar * STEPS_PER_BAR);
      mkRoll(head);
      mkDroll(head);
      mkp.raf = requestAnimationFrame(tick);
    };
    tick();
  });
}
function mkPlayStep(i, t, bus, prog, sd, drums) {
  const b = Math.floor(i / STEPS_PER_BAR);
  const s = i % STEPS_PER_BAR;
  for (const n of mk.mel[b] || []) if (n.step === s) audio.lead(t, n.midi, n.len * sd * 0.92, bus);
  if (mkDrumOnly()) {
    // 🥁 드럼만: 반주 없이 드럼만 (녹음 중엔 똑딱 소리만)
    if (drums) for (const l of CHAR_LANES[(mk.drums[b] || '')[s]] || []) audio.playLane(l, t, bus);
    return;
  }
  const parts = (prog[b] || 'C').split(' ');
  const partLen = STEPS_PER_BAR / parts.length;
  if (s % partLen === 0) {
    const ch = parseChord(parts[s / partLen]);
    if (!mk.low) audio.bass(t, ch.root - 24, partLen * sd * 0.9, bus);
    if (s % 8 === 0 || partLen === 8) audio.pluck(t, ch.notes, partLen * sd * 0.8, bus, 0.5);
  }
  // 🎹 왼손(악보 아래 줄)
  if (mk.low) for (const n of mk.low[b] || []) if (n.step === s) {
    if (audio.piano) audio.pianoNote(t, n.midi, Math.max(0.2, n.len * sd * 0.95), 0.8, bus);
    else audio.bass(t, n.midi, n.len * sd * 0.9, bus);
  }
  if (drums) for (const l of CHAR_LANES[(mk.drums[b] || '')[s]] || []) audio.playLane(l, t, bus);
}

// ----- 🥁 드럼 직접 쳐서 만들기 (멜로디를 틀어 주고 패드를 치면 그 자리에 노트) -----
//   치는 동안 마디가 늘어남 (최대 64). 「겹쳐 치기」면 지금 드럼을 두고 더함
const drec = { on: false, bus: null, t0: 0, sd: 0, startBar: 0, next: 0, raf: 0, prog: null, q: 2, bar: -1, grow: true, from: '0', over: false };
const mkDrumOnly = () => !mk.mel.some((b) => b.length);
/** 녹음 중 bar 마디가 있게 (grow 면 늘림). 못 넣으면 false */
function drecHasBar(bar) {
  if (bar < mk.mel.length) return true;
  if (!drec.grow || bar >= MAP_LIMITS.maxBars) return false;
  while (mk.mel.length <= bar) {
    mk.mel.push([]);
    mk.drums.push('................');
  }
  return true;
}
function drecToggle() {
  if (drec.on) return drecStop();
  mkStopPlay();
  recStop();
  mkSound(() => {
    const ctx = audio.ctx;
    drec.from = $('#mk-drec-from').value;
    drec.over = $('#mk-drec-over').checked;
    drec.grow = true;
    if (drec.from === 'end') {
      // 드럼이 마지막으로 들어 있는 마디 뒤부터 (자동 드럼이면 맨 끝 뒤)
      const last = mk.drums.reduce((m, d, i) => (/[^.]/.test(d) ? i : m), -1);
      drec.startBar = mk.drumsAuto ? mk.mel.length : last + 1;
      if (drec.startBar >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    } else drec.startBar = drec.from === 'bar' ? mk.bar : 0;
    mkSnap();
    // 멜로디 없이 처음부터 새로 치면 마디 수도 친 만큼
    if (drec.from === '0' && !drec.over && mkDrumOnly()) {
      mk.mel = [[], []];
      mk.drums = ['................', '................'];
    }
    drec.q = Number($('#mk-drec-q').value) || 2;
    drec.bus = ctx.createGain();
    drec.bus.connect(audio.musicBus);
    drec.sd = 15 / mk.bpm;
    drec.prog = mkProg();
    // 똑딱 한 마디 뒤부터
    drec.t0 = ctx.currentTime + 0.2 + STEPS_PER_BAR * drec.sd;
    drec.next = -STEPS_PER_BAR;
    drec.bar = -1;
    drec.on = true;
    mk.dsel = null;
    mk.drumsAuto = null;
    mk.bar = drec.startBar;
    while (mk.mel.length <= mk.bar) mk.mel.push([]), mk.drums.push('................');
    mkRender();
    $('#mk-drec-btn').classList.add('on');
    $('#mk-drec-label').textContent = '멈춤';
    $('#mk-pads').scrollIntoView({ behavior: 'smooth', block: 'center' });
    const end = mk.mel.length * STEPS_PER_BAR;
    const tick = () => {
      if (!drec.on) return;
      const now = ctx.currentTime;
      while (drec.t0 + drec.next * drec.sd < now + 0.25) {
        const t = drec.t0 + drec.next * drec.sd;
        const at = drec.startBar * STEPS_PER_BAR + drec.next;
        if (drec.next % 4 === 0) audio.click(t, drec.next % STEPS_PER_BAR === 0, drec.bus);
        // 겹쳐 치기면 지금 드럼도 같이 (멜로디는 늘 같이)
        if (drec.next >= 0 && at < end) mkPlayStep(at, t, drec.bus, drec.prog, drec.sd, drec.over);
        drec.next++;
      }
      const pos = (now - drec.t0) / drec.sd;
      if (pos < 0) $('#mk-drec-msg').textContent = `준비… ${Math.ceil(-pos / 4)}`;
      else {
        const bar = drec.startBar + Math.floor(pos / STEPS_PER_BAR);
        if (!drecHasBar(bar)) return drecStop();
        if (bar > drec.bar) {
          // 지나가는 마디는 새로 침 (겹쳐 치기면 그대로 두고 더함)
          drec.bar = bar;
          if (!drec.over) mk.drums[bar] = '................';
        }
        if (bar !== mk.bar) {
          mk.bar = bar;
          mkBarText();
          mkGrid();
        }
        $('#mk-drec-msg').textContent = `● 드럼 녹음 중 · ${bar + 1}마디 (다 치면 「멈춤」)`;
        const head = pos - (bar - drec.startBar) * STEPS_PER_BAR;
        mkDroll(head);
      }
      drec.raf = requestAnimationFrame(tick);
    };
    tick();
  });
}
/** 패드 침: 소리는 바로, 녹음 중이면 가까운 칸에 노트 */
function padHit(inst) {
  mkSound(() => audio.playLane(LANE_OF[inst], audio.ctx.currentTime + 0.003));
  if (!drec.on) {
    // 아래 칸을 골라 뒀으면 그 칸에 노트
    if (mk.dsel == null || !mk.drums[mk.bar]) return;
    const cells = [...mk.drums[mk.bar]];
    if (drumCell(cells[mk.dsel])[inst]) return;
    cells[mk.dsel] = toggleDrum(cells[mk.dsel], inst);
    mk.drums[mk.bar] = cells.join('');
    mk.drumsAuto = null;
    mkSave();
    mkRender();
    return;
  }
  const pos = (audio.heardTime(performance.now()) - (state.settings.offsetMs || 0) / 1000 - drec.t0) / drec.sd;
  const q = Math.round(pos / drec.q) * drec.q;
  if (q < 0) return;
  const at = drec.startBar * STEPS_PER_BAR + q;
  const bar = Math.floor(at / STEPS_PER_BAR);
  if (!drecHasBar(bar)) return;
  // 다음 마디 첫 칸으로 반올림됐는데 그 마디가 아직 안 지워졌으면 지금 지움
  if (bar > drec.bar) {
    drec.bar = bar;
    if (!drec.over) mk.drums[bar] = '................';
  }
  const cells = [...mk.drums[bar]];
  const s = at % STEPS_PER_BAR;
  if (!drumCell(cells[s])[inst]) cells[s] = toggleDrum(cells[s], inst);
  mk.drums[bar] = cells.join('');
  if (bar === mk.bar) mkGrid();
  $('#mk-tab-drum').textContent = `노트 ${mkDrumNotes()}개`;
}
function drecStop() {
  if (!drec.on) return;
  drec.on = false;
  cancelAnimationFrame(drec.raf);
  try {
    const b = drec.bus;
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
    setTimeout(() => b.disconnect(), 300);
  } catch {}
  $('#mk-drec-btn').classList.remove('on');
  $('#mk-drec-label').textContent = '드럼 녹음';
  if (drec.grow) {
    // 늘린 마디 중 끝에 빈 마디(드럼·멜로디 다 없음)는 뺌
    while (mk.mel.length > MAP_LIMITS.minBars && !mk.mel[mk.mel.length - 1].length && !/[^.]/.test(mk.drums[mk.drums.length - 1])) {
      mk.mel.pop();
      mk.drums.pop();
    }
    // 멜로디 없이 처음부터 쳤으면 앞쪽 빈 마디(치기 전에 기다린 것)도 뺌
    while (drec.from === '0' && !drec.over && mkDrumOnly() && mk.drums.length > MAP_LIMITS.minBars && !/[^.]/.test(mk.drums[0])) {
      mk.mel.shift();
      mk.drums.shift();
    }
    mk.bar = Math.min(mk.bar, mk.mel.length - 1);
  }
  let n = 0;
  for (const b of mk.drums) for (const c of b) n += (CHAR_LANES[c] || []).length;
  $('#mk-drec-msg').textContent = n >= MAP_LIMITS.minNotes ? `드럼 노트 ${n}개! 「처음부터 듣기」로 들어 보고, 🎹 멜로디 탭에서 피아노를 얹어 보세요` : '노트가 너무 적어요. 똑딱 소리에 맞춰 패드를 더 쳐 주세요';
  mkSave();
  mkRender();
}

// ----- ● 건반 쳐서 녹음 (똑딱 소리에 맞춰 치면 8분음표에 맞춰 넣음) -----
const REC_Q = 2; // 8분음표 칸에 맞춤
const rec = { on: false, bus: null, t0: 0, sd: 0, startBar: 0, next: -STEPS_PER_BAR, raf: 0, down: new Map(), last: null, maxStep: 0 };
function recToggle() {
  if (rec.on) return recStop();
  mkStopPlay();
  drecStop();
  mkSound(() => {
    const ctx = audio.ctx;
    const from = $('#mk-rec-from').value;
    const lastBar = mk.mel.reduce((m, bar, i) => (bar.length ? i : m), -1);
    rec.startBar = from === 'bar' ? mk.bar : from === 'end' ? lastBar + 1 : 0;
    if (rec.startBar >= MAP_LIMITS.maxBars) return toast(`최대 ${MAP_LIMITS.maxBars}마디까지예요`, 1600);
    if (from === '0' && mk.mel.some((b) => b.length) && !confirm('처음부터 다시 녹음할까요? 지금 멜로디는 지워져요 (↩ 되돌리기 가능)')) return;
    mkSnap();
    if (from === '0') mk.mel = mk.mel.map(() => []);
    rec.drums = $('#mk-rec-drums').checked;
    rec.bus = ctx.createGain();
    rec.bus.connect(audio.musicBus);
    rec.sd = 15 / mk.bpm;
    // 똑딱 한 마디 뒤부터 녹음
    rec.t0 = ctx.currentTime + 0.2 + STEPS_PER_BAR * rec.sd;
    rec.next = -STEPS_PER_BAR;
    rec.down.clear();
    rec.last = null;
    rec.maxStep = 0;
    rec.on = true;
    mk.bar = rec.startBar;
    while (mk.mel.length <= mk.bar) mk.mel.push([]);
    mkFixBars();
    mkRender();
    $('#mk-rec').classList.add('on');
    $('#mk-rec-label').textContent = '멈춤';
    const tick = () => {
      if (!rec.on) return;
      const now = ctx.currentTime;
      while (rec.t0 + rec.next * rec.sd < now + 0.25) {
        const t = rec.t0 + rec.next * rec.sd;
        if (rec.next % 4 === 0) audio.click(t, rec.next % STEPS_PER_BAR === 0, rec.bus);
        // 🥁 만든 드럼 위에 피아노 얹기: 드럼 같이 틀기
        if (rec.drums && rec.next >= 0) {
          const at = rec.startBar * STEPS_PER_BAR + rec.next;
          const d = mk.drums[Math.floor(at / STEPS_PER_BAR)];
          if (d) for (const l of CHAR_LANES[d[at % STEPS_PER_BAR]] || []) audio.playLane(l, t, rec.bus);
        }
        rec.next++;
      }
      const pos = (now - rec.t0) / rec.sd;
      if (pos < 0) $('#mk-rec-msg').textContent = `준비… ${Math.ceil(-pos / 4)}`;
      else {
        const bar = rec.startBar + Math.floor(pos / STEPS_PER_BAR);
        if (bar >= MAP_LIMITS.maxBars) return recStop();
        $('#mk-rec-msg').textContent = `● 녹음 중 · ${bar + 1}마디 (다 치면 「멈춤」)`;
        if (bar !== mk.bar) {
          while (mk.mel.length <= bar) mk.mel.push([]);
          mk.bar = bar;
          // 녹음이 지나가는 마디의 예전 음은 비움 (덮어쓰기)
          if (from !== '0') mk.mel[bar] = [];
          mkBarText();
        }
        mkRoll(pos - (mk.bar - rec.startBar) * STEPS_PER_BAR);
      }
      rec.raf = requestAnimationFrame(tick);
    };
    if (from !== '0') mk.mel[rec.startBar] = [];
    tick();
  });
}
/** 녹음 기준 칸 위치 (소수). 박자 보정값만큼 당김 */
const recPos = () => (audio.heardTime(performance.now()) - (state.settings.offsetMs || 0) / 1000 - rec.t0) / rec.sd;
function recDown(midi, el) {
  const pos = recPos();
  if (pos < -REC_Q) return;
  const q = Math.max(0, Math.round(pos / REC_Q) * REC_Q);
  const at = rec.startBar * STEPS_PER_BAR + q;
  // 앞 음이 아직 눌려 있으면 여기서 끊김 (한 번에 한 음)
  if (rec.last && rec.last.at < at && rec.last.open) rec.last.len = Math.max(REC_Q, at - rec.last.at);
  const note = { at, midi, len: REC_Q * 2, open: true };
  rec.last = note;
  rec.down.set(el || midi, { note, pos });
  mkPut(at, midi, note.len);
  rec.maxStep = Math.max(rec.maxStep, at + REC_Q);
  mkRoll(pos - (mk.bar - rec.startBar) * STEPS_PER_BAR);
}
function recUp(key) {
  const d = rec.down.get(key);
  if (!d) return;
  rec.down.delete(key);
  const n = d.note;
  if (!n.open) return;
  n.open = false;
  const held = recPos() - d.pos;
  const len = Math.max(REC_Q, Math.round(held / REC_Q) * REC_Q);
  if (rec.last === n || len < n.len) {
    n.len = len;
    // 다시 넣기 (길이만 바뀜)
    const bar = Math.floor(n.at / STEPS_PER_BAR);
    const step = n.at % STEPS_PER_BAR;
    const same = (mk.mel[bar] || []).find((x) => x.step === step && x.midi === n.midi);
    if (same) {
      mk.mel[bar].splice(mk.mel[bar].indexOf(same), 1);
      mkPut(n.at, n.midi, len);
    }
  }
}
function recStop() {
  if (!rec.on) return;
  rec.on = false;
  cancelAnimationFrame(rec.raf);
  try {
    const b = rec.bus;
    b.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.02);
    setTimeout(() => b.disconnect(), 300);
  } catch {}
  $('#mk-rec').classList.remove('on');
  $('#mk-rec-label').textContent = '녹음';
  // 처음부터 녹음했으면 친 데까지만 남김
  const lastBar = mk.mel.reduce((m, bar, i) => (bar.length ? i : m), -1);
  // (내가 친 드럼이 더 길면 드럼 끝까지는 남김)
  const lastDrum = mk.drumsAuto ? -1 : mk.drums.reduce((m, d, i) => (/[^.]/.test(d) ? i : m), -1);
  if ($('#mk-rec-from').value === '0' && lastBar >= 0) mk.mel.length = Math.max(MAP_LIMITS.minBars, lastBar + 1, lastDrum + 1);
  const n = mk.mel.reduce((a, b) => a + b.length, 0);
  $('#mk-rec-msg').textContent = n ? `녹음했어요! 「처음부터 듣기」로 드럼이랑 같이 들어 보세요` : '음이 안 들어갔어요. 똑딱 소리에 맞춰 건반을 눌러 보세요';
  // 드럼을 아직 안 쳤으면(다 비었으면) 자동 드럼
  if (!mk.drumsAuto && !mkDrumNotes()) mk.drumsAuto = 'easy';
  mk.bar = Math.min(mk.bar, mk.mel.length - 1);
  mkFixBars();
  mkRender();
}

function mkMap(strict = true) {
  mk.name = $('#mk-name').value.trim();
  mkSave();
  const raw = { name: mk.name || (strict ? '' : '내 맵'), bpm: mk.bpm, bars: mk.drums, melody: mk.mel.map(barToMelody), prog: mkProg() };
  if (Array.isArray(mk.low) && mk.low.length === mk.mel.length) raw.low = mk.low.map(barToMelody);
  const map = cleanMap(raw);
  if (map) return map;
  if (!raw.name) toast('곡 이름을 적어 주세요', 1800);
  else toast('드럼 노트가 너무 적어요. ② 드럼에서 더 넣어 주세요', 2400);
  return null;
}
async function mkPlay(auto) {
  mkStopPlay();
  recStop();
  drecStop();
  const map = mkMap(false);
  if (!map) return;
  um.level = mapLevel(map, { id: UM_ID, by: state.me && state.me.player ? state.me.player.username : '' });
  um.from = 'make';
  um.wasAuto = auto && !state.auto;
  if (auto) state.auto = true;
  await startLevel(UM_ID);
}
async function mkUpload() {
  mkStopPlay();
  recStop();
  drecStop();
  const map = mkMap(true);
  if (!map) {
    if (!mk.name) $('#mk-name').focus();
    return;
  }
  if (!state.api.mapUpload) return toast('지금은 서버에 연결이 안 돼서 못 올려요', 2200);
  if (!confirm(`「${map.name}」 맵을 올릴까요? 올리면 누구나 칠 수 있어요`)) return;
  try {
    await state.api.mapUpload(map);
    toast('올렸어요! 유저 맵 「새 맵」에 떠요', 2400);
    um.sort = 'new';
    um.list = null;
    openMaps();
    loadMaps(true);
  } catch (e) {
    const err = e.data && e.data.error;
    toast(
      err === 'too_many_maps' ? '맵은 하루 10개까지 올릴 수 있어요' : e.status === 403 ? '팔로워 인증을 하면 올릴 수 있어요' : err === 'bad_map' ? '맵에 이상한 데가 있어요. 다시 확인해 주세요' : '못 올렸어요. 잠시 뒤 다시 해 보세요',
      2600
    );
  }
}
function mkNew() {
  if (!confirm('지금 만들던 맵을 지우고 새로 시작할까요?')) return;
  mkStopPlay();
  recStop();
  drecStop();
  mkSnap();
  mk = newDraft();
  $('#mk-name').value = '';
  $('#mk-step').checked = false;
  mkSave();
  mkRender();
}

// ----- 🎵 노래 파일에서 음 따기 -----
const mkf = { url: null, buf: null, mono: null, name: '', busy: false };
async function mkPickFile(file) {
  if (mkf.busy) return;
  if (mkf.url) URL.revokeObjectURL(mkf.url);
  mkf.url = URL.createObjectURL(file);
  mkf.name = file.name.replace(/\.[^.]+$/, '').slice(0, 30);
  mkf.buf = mkf.mono = null;
  $('#mk-file-opts').hidden = true;
  mkf.busy = true;
  audio.unlock();
  const buf = await openTrackFile(mkf.url, file, (t, mb) => ($('#mk-file-status').textContent = `노래 여는 중… ${t}초 (파일 ${fmtMb(mb)})`));
  mkf.busy = false;
  if (!buf) {
    $('#mk-file-status').innerHTML =
      '이 영상은 한 번 재생하면서 소리를 읽어야 해요 (<b>영상 길이만큼</b> 걸려요, 소리는 안 나요).' +
      '<button class="btn btn-hot my-cap" type="button" data-action="mk-capture">영상 소리 읽기</button>';
    return;
  }
  mkFileLoaded(buf);
}
async function mkCapture() {
  if (!mkf.url || mkf.busy) return;
  mkf.busy = true;
  audio.unlock();
  const buf = await captureMediaAudio(mkf.url, (t, d) => ($('#mk-file-status').textContent = capText(t, d)), 180, true);
  mkf.busy = false;
  mkFileLoaded(buf);
}
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
function mkFileLoaded(buf) {
  if (!buf || buf.duration < 6) {
    $('#mk-file-status').textContent = buf ? '노래가 너무 짧아요' : '소리를 못 읽었어요. 소리가 들어 있는 mp3·m4a·mp4 로 해 보세요';
    return;
  }
  mkf.buf = buf;
  mkf.mono = monoOf(buf);
  $('#mk-file-status').innerHTML =
    `<b>${escapeHtml(mkf.name)}</b> · ${mmss(buf.duration)}` +
    (buf.partial ? `<br>⚠️ 영상 ${mmss(buf.partial)} 중 ${mmss(buf.duration)}까지만 읽혔어요. 끝까지 따려면 다시 골라서 읽는 동안 화면을 켜 두세요` : '');
  $('#mk-file-opts').hidden = false;
}
async function mkTranscribe() {
  const buf = mkf.buf;
  if (!buf || mkf.busy) return;
  const sr = buf.sampleRate;
  const st = $('#mk-file-status');
  const s0 = soundStart(mkf.mono, sr);
  const pick = parseTime($('#mk-file-start').value);
  const from = Math.max(0, Math.min(buf.duration - 4, pick ?? s0));
  const lenSel = $('#mk-file-len').value;
  const want = lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16;
  // 박: 고른 데부터 노래 끝까지(최대 2분)를 다 보고 찾음 → 긴 곡도 뒤에서 박이 안 밀림
  const bStart = Math.max(0, Math.min(from + 2, buf.duration - 12));
  const r = detectBeat(mkf.mono, sr, { start: bStart, dur: Math.max(24, Math.min(120, buf.duration - bStart)) });
  if (!r) {
    st.textContent = '박자를 못 찾았어요. 박이 뚜렷한 노래로 해 보세요';
    return;
  }
  let bpm = r.bpm;
  while (bpm > MAP_LIMITS.maxBpm) bpm /= 2;
  while (bpm < MAP_LIMITS.minBpm) bpm *= 2;
  const beat = 60 / bpm;
  // 고른 시각 바로 뒤의 박부터 (첫 소리가 박보다 살짝 늦게 잡혀도 그 박부터)
  const k = Math.ceil((from - r.firstBeat) / beat - 0.3);
  const first = r.firstBeat + k * beat;
  const avail = Math.floor((buf.duration - first) / (beat * 4));
  if (avail < MAP_LIMITS.minBars) {
    st.textContent = `시작 뒤로 노래가 ${Math.max(0, Math.floor(buf.duration - first))}초밖에 없어요. 시작을 앞으로 당겨 주세요`;
    return;
  }
  const bars = Math.min(want, MAP_LIMITS.maxBars, avail);
  // 🎤 먼저 목소리만 골라냄 (vocalsep.js, 폰 안에서). 고른 구간 앞뒤 1초만. 안 되면(옛 폰 등) 원래 소리로만
  const a0 = Math.max(0, Math.floor((first - 1) * sr));
  const a1 = Math.min(buf.length, Math.ceil((first + bars * 4 * beat + 1) * sr));
  const Lc = (buf.numberOfChannels > 1 ? buf.getChannelData(0) : mkf.mono).subarray(a0, a1);
  const Rc = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : mkf.mono).subarray(a0, a1);
  const btn = $('#mk-transcribe');
  mkf.busy = true;
  btn.disabled = true;
  let t = null;
  try {
    let v = null;
    try {
      v = await separateVocals(Lc, Rc, sr, (stage, p) => {
        st.textContent = stage === 'model' ? `목소리 골라내는 준비… ${Math.round(p * 100)}% (처음 한 번만 받아요, 약 30MB)` : `목소리·반주 나누는 중… ${Math.round(p * 100)}%`;
      });
    } catch (e) {
      console.warn('vocalsep', e);
      toast('이 폰에선 목소리 골라내기가 안 돼서 그냥 따요', 2200);
    }
    // 🎹 반주 악기 음 (Basic Pitch, 228KB) — 목소리 없는 곳·연주곡의 멜로디
    let inst = null;
    try {
      const mono = new Float32Array(Lc.length);
      for (let i = 0; i < mono.length; i++) mono[i] = (Lc[i] + Rc[i]) * 0.5;
      inst = await instrumentNotes(mono, sr, (stage, p) => (st.textContent = stage === 'model' ? '악기 음 듣는 준비…' : `악기 음 듣는 중… ${Math.round(p * 100)}%`));
    } catch (e) {
      console.warn('instnotes', e);
    }
    st.textContent = '멜로디·코드·드럼 따는 중…';
    await new Promise((res) => setTimeout(res, 40));
    // 목소리를 골랐으면 같은 빠르기(44.1kHz)로 맞춰서
    const mix = v && v.sr !== sr ? [resample(Lc, sr), resample(Rc, sr)] : [Lc, Rc];
    t = transcribeSong({
      mix,
      voc: v ? [v.L, v.R] : null,
      sr: v ? v.sr : sr,
      firstBeat: first - a0 / sr,
      bpm,
      bars,
      grid: $('#mk-file-clean').value === 'fine' ? 1 : 2,
      inst,
    });
  } catch (e) {
    console.warn('transcribe', e);
  } finally {
    mkf.busy = false;
    btn.disabled = false;
  }
  if (!t || t.found < 4) {
    st.textContent = '음을 거의 못 땄어요. 멜로디가 또렷한 구간으로 해 보세요';
    return;
  }
  // confirm() 은 앱 안 브라우저에서 안 뜰 수 있어서 묻지 않음 (↩ 되돌리기 가능)
  mkSnap();
  mk.mel = t.bars;
  mk.low = null;
  mk.bpm = Math.round(bpm);
  // 코드·드럼도 노래에서 (곡의 진짜 코드 · 곡의 쿵짝 자리)
  mk.prog = Array.isArray(t.prog) && t.prog.length === bars ? t.prog : null;
  if (Array.isArray(t.drums) && t.drums.length === bars) {
    mk.songDrums = t.drums;
    mk.drumsAuto = 'song';
  } else {
    mk.songDrums = null;
    mk.drumsAuto = 'normal';
  }
  mk.bar = 0;
  mk.cur = 0;
  // 화면 녹화·사진첩 파일 이름(ScreenRecording_…, IMG_1234)은 곡 이름으로 안 씀
  if (!$('#mk-name').value.trim() && !/^(screen|rpreplay|img|vid|video|audio|record|녹음|화면|\d)/i.test(mkf.name) && !/\d{4}/.test(mkf.name)) $('#mk-name').value = mkf.name;
  mk.name = $('#mk-name').value.trim();
  mkFixBars();
  mkRender();
  const sec = Math.round((bars * 4 * 60) / bpm);
  st.innerHTML =
    `<b>${bars}마디</b>(약 ${mmss(sec)})에서 음 <b>${t.found}개</b>를 땄어요 · ${mk.bpm} BPM` +
    `<br>${t.vocalRatio < 0.12 ? '목소리가 거의 없는 곡이라 악기 멜로디를 땄어요' : t.leadShare > 0.05 ? '노래 부분은 목소리, 전주·간주는 악기 멜로디를 땄어요' : '목소리 멜로디를 땄어요'}` +
    ([mk.prog && '코드', mk.drumsAuto === 'song' && '드럼'].filter(Boolean).join('·') ? `<br>${[mk.prog && '코드', mk.drumsAuto === 'song' && '드럼'].filter(Boolean).join('·')}도 노래에서 땄어요` : '') +
    (lenSel !== 'all' && want > bars ? `<br>노래가 짧아서 ${bars}마디까지만 땄어요` : '') +
    '<br>「처음부터 듣기」로 들어 보고, 틀린 음은 손으로 고쳐 주세요';
}

// ----- 🎼 악보 파일(MIDI·MusicXML)로 만들기 (scorefile.js, 폰 안에서만 읽음 · 요청 없음) -----
const mks = { score: null, info: null, name: '' };
async function mkPickScore(file) {
  const st = $('#mk-score-status');
  $('#mk-score-opts').hidden = true;
  mks.score = mks.info = null;
  if (file.size > 8 * 1024 * 1024) {
    st.textContent = '파일이 너무 커요 (8MB 까지). 악보 파일(.mid·.musicxml·.mxl)이 맞는지 봐 주세요';
    return;
  }
  st.textContent = '악보 읽는 중…';
  let sc;
  try {
    sc = await readScoreFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (e) {
    console.warn('score', e);
    st.textContent = `악보를 못 읽었어요${e && /[가-힣]/.test(e.message) ? ` (${e.message})` : ''}. MIDI(.mid)·MusicXML(.musicxml·.mxl) 파일로 해 주세요`;
    return;
  }
  const info = scoreInfo(sc);
  if (!info.melodyTracks.length && !info.hasDrums) {
    st.textContent = '악보에 음이 없어요';
    return;
  }
  mks.score = sc;
  mks.info = info;
  mks.name = (sc.title || file.name.replace(/\.[^.]+$/, '')).slice(0, 30);
  const sel = $('#mk-score-mel');
  sel.innerHTML =
    info.melodyTracks
      .map((t) => {
        const label = `${t.name || `트랙 ${t.index + 1}`} · 음 ${t.count}개 · ${midiName(t.lo)}~${midiName(t.hi)}${t.index === info.guess ? ' (추천)' : ''}`;
        return `<option value="${t.index}"${t.index === info.guess ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('') + '<option value="-1">멜로디 없이 (드럼만)</option>';
  if (info.guess < 0) sel.value = '-1';
  $('#mk-score-len').value = 'all';
  mks.startTouched = false;
  mkScoreStartOpts();
  $('#mk-score-opts').hidden = false;
  const sec = Math.round((info.totalBars * 4 * 60) / info.bpm);
  st.innerHTML =
    `<b>${escapeHtml(mks.name)}</b> · ${info.totalBars}마디 · ${Math.round(info.bpm)} BPM (약 ${mmss(sec)})` +
    `<br>${info.hasDrums ? '🥁 드럼 트랙도 있어요 — 그대로 넣어요' : '드럼 트랙이 없어서 드럼은 자동으로 만들어요'}` +
    (Math.round(info.bpm) !== Math.round(sc.bpm) ? `<br>원래 ${Math.round(sc.bpm)} BPM 이라 ${Math.round(info.bpm)} BPM 으로 맞췄어요 (박자는 그대로)` : '') +
    (sc.tempoChanges ? '<br>중간에 빠르기가 바뀌는 곡이라 처음 빠르기로 해요' : '') +
    (sc.timeSig && (sc.timeSig[0] !== 4 || sc.timeSig[1] !== 4) && !(sc.timeSig[0] === 2 && sc.timeSig[1] === 4) ? `<br>${sc.timeSig[0]}/${sc.timeSig[1]}박자 곡이라 4박씩 묶어요` : '') +
    '';
}
/** 시작 마디 목록 + 추천 (멜로디 트랙이 바뀌면 추천도 바뀜, 손으로 고른 뒤엔 그대로) */
function mkScoreStartOpts() {
  const info = mks.info;
  if (!info) return;
  const melIdx = Number($('#mk-score-mel').value);
  const rec = recommendStart(info, melIdx);
  const ss = $('#mk-score-start');
  const keep = mks.startTouched ? Number(ss.value) : rec;
  const opts = [];
  for (let b = 0; b < Math.max(1, info.totalBars - 1); b++) opts.push(`<option value="${b}"${b === keep ? ' selected' : ''}>${b + 1}마디${b === rec ? ' (추천 · 멜로디 시작)' : ''}</option>`);
  ss.innerHTML = opts.join('');
  mkScoreRec();
}
function mkScoreRec() {
  const info = mks.info;
  if (!info) return;
  const melIdx = Number($('#mk-score-mel').value);
  const t = info.melodyTracks.find((m) => m.index === melIdx);
  const start = Number($('#mk-score-start').value) || 0;
  const lenSel = $('#mk-score-len').value;
  const bars = Math.min(lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16, info.totalBars - start);
  const rec = recommendStart(info, melIdx);
  $('#mk-score-rec').innerHTML =
    `👉 이렇게 만들어요: 멜로디 <b>${t ? escapeHtml(t.name || `트랙 ${t.index + 1}`) : '없이 (드럼만)'}</b> · <b>${start + 1}마디부터 ${bars}마디</b>` +
    (start === rec && rec > 0 ? ` (앞 ${rec}마디 전주는 건너뛰어요)` : '') +
    (start + bars < info.totalBars ? `<br>곡이 길어서 ${start + bars}마디까지만 들어가요` : '') +
    '<br>모르면 그대로 「악보로 맵 만들기」만 누르세요';
}
function mkScoreMake() {
  const sc = mks.score;
  if (!sc) return;
  const st = $('#mk-score-status');
  const lenSel = $('#mk-score-len').value;
  let r;
  try {
    r = scoreToMap(sc, {
      melody: Number($('#mk-score-mel').value),
      start: Number($('#mk-score-start').value) || 0,
      bars: lenSel === 'all' ? MAP_LIMITS.maxBars : Number(lenSel) || 16,
    });
  } catch (e) {
    console.warn('scoreToMap', e);
    st.textContent = '맵으로 바꾸다 문제가 생겼어요. 「직접 고르기」에서 멜로디 트랙이나 시작 마디를 바꿔 보세요';
    toast('악보를 맵으로 못 바꿨어요');
    return;
  }
  // 맵은 2마디부터 (1마디짜리 곡은 한 마디 쉼을 붙임)
  while (r.mel.length < MAP_LIMITS.minBars) {
    r.mel.push([]);
    if (r.drums) r.drums.push('................');
    if (r.prog) r.prog.push(r.prog[r.prog.length - 1]);
  }
  if (!r.found && !r.drums) {
    st.textContent = '그 구간엔 음이 없어요. 「직접 고르기」에서 시작 마디나 멜로디 트랙을 바꿔 보세요';
    toast('그 구간엔 음이 없어요');
    return;
  }
  // confirm() 은 인스타 앱 안 브라우저 등에서 안 뜨고 '아니오'로 돌아와서 아무 일도 안 일어났음 → 묻지 않고 바꾸고 ↩ 되돌리기로
  const hadDraft = mk.mel.some((b) => b.length) || mk.drumsAuto !== 'easy';
  mkSnap();
  mk.mel = r.mel;
  mk.low = r.low || null;
  mk.bpm = Math.max(MAP_LIMITS.minBpm, Math.min(MAP_LIMITS.maxBpm, r.bpm));
  mk.prog = r.prog;
  if (r.drums) {
    mk.songDrums = r.drums;
    mk.drumsAuto = 'song';
  } else {
    mk.songDrums = null;
    mk.drumsAuto = 'normal';
  }
  mk.bar = 0;
  mk.cur = 0;
  if (!$('#mk-name').value.trim()) $('#mk-name').value = mks.name;
  mk.name = $('#mk-name').value.trim();
  mkFixBars();
  mkRender();
  st.innerHTML =
    `<b>${r.mel.length}마디</b>(${r.start + 1}마디부터)로 만들었어요 · 멜로디 음 <b>${r.found}개</b> · ${mk.bpm} BPM` +
    `<br>${[r.prog ? '코드는 반주 트랙에서' : '코드는 멜로디로 짐작', r.low ? '🎹 왼손(아래 줄)도 악보 그대로' : '', r.drums ? '드럼은 악보 드럼 그대로' : '드럼은 자동'].filter(Boolean).join(' · ')}` +
    '<br>위 「처음부터 듣기」로 들어 보고, 고칠 곳은 「자세히 고치기」에서 손봐요' +
    (hadDraft ? '<br>전에 만들던 건 위 「↩ 되돌리기」로 되돌릴 수 있어요' : '');
  toast('🎼 악보로 맵을 만들었어요');
  $('#mk-play').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ---------------- 영상 찍기 ----------------
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return null;
}
const canRecordFile = () => !!pickMime() && !!HTMLCanvasElement.prototype.captureStream;

// 레벨업 챌린지(릴스처럼 Lv.1 → Lv.N 점점 빨라짐)를 고르면 문구도 거기에 맞게
const STUDIO_TEXT = {
  level: { top: '엄지 두 개로 따라 쳐봐!', bottom: '프로필 링크에서 바로 해보기' },
  challenge: (n) => ({ top: '엄지로 드럼 쳐보세요', bottom: `Lv.${n}까지 오면 드러머 재능 있음` }),
  beat: { top: '엄지 드럼 챌린지', bottom: '어디까지 따라오나 보자' },
  beatSteady: { top: '이 노래 엄지로 쳐봐', bottom: '프로필 링크에서 직접 쳐보기' },
  quiz: { top: '이 노래 제목 맞혀봐!', bottom: '정답은 영상 끝에 · 댓글로 먼저!' },
  fail: { top: '이 정도는 쉽지 ㅋㅋ', bottom: '이거 깰 수 있는 사람?' },
};
const isQuizFormat = () => state.studio.format === 'quiz';
/** 💀 실패 영상: 잘 치다가 일부러 MISS 를 줄줄이 → 하트가 다 떨어져 끝 → 도발 문구 */
const isFailFormat = () => state.studio.format === 'fail';
const FAIL_SECS = [8, 12, 18, 25];
/** 실패 영상 판: 탈락 시점(첫 콩부터 초)을 곡 길이 안으로 */
function failLevel(lv) {
  const total = (lv.bars.length * 4 * 60) / lv.bpm;
  return { ...lv, failReel: true, failAfter: Math.max(3, Math.min(state.studio.failSec || 12, total * 0.85)) };
}
/** 실제로 칠 판 id: 노래 맞히기면 'q2x8' 처럼 */
const studioPlayId = () => (isQuizFormat() && typeof state.studio.level === 'number' ? quizId(state.studio.level, state.studio.quizBars ?? 8) : state.studio.level);
const STUDIO_CHALLENGES = [4, 7];
function studioDefaults(id) {
  if (isQuizFormat()) return STUDIO_TEXT.quiz;
  if (isFailFormat()) return STUDIO_TEXT.fail;
  if (id === BEAT_ID) {
    const style = beatSaved().style;
    return style === 'steady' || style === 'song' ? STUDIO_TEXT.beatSteady : STUDIO_TEXT.beat;
  }
  return isChallengeId(id) ? STUDIO_TEXT.challenge(Number(String(id).slice(2))) : STUDIO_TEXT.level;
}
function pickStudioLevel(id) {
  const st = state.studio;
  const top = $('#studio-top');
  const bottom = $('#studio-bottom');
  // 기본 문구 그대로였으면 새 기본 문구로 바꿔 줌 (직접 쓴 문구는 그대로)
  const all = [STUDIO_TEXT.level, STUDIO_TEXT.beat, STUDIO_TEXT.beatSteady, { top: '드롭에서 엄지 터짐 주의', bottom: '빌드업 끝까지 따라와 봐' }, { top: '이 노래 엄지로 드럼 커버', bottom: '프로필 링크에서 직접 쳐보기' }, STUDIO_TEXT.quiz, STUDIO_TEXT.fail, ...STUDIO_CHALLENGES.map(STUDIO_TEXT.challenge)];
  const after = studioDefaults(id);
  if (!top.value.trim() || all.some((d) => d.top === top.value.trim())) top.value = after.top;
  if (!bottom.value.trim() || all.some((d) => d.bottom === bottom.value.trim())) bottom.value = after.bottom;
  // 썸네일 곡 배지: 자동으로 들어간 값이었으면 새 곡으로 (직접 고쳤으면 그대로)
  if (coverOn()) {
    const sub = $('#cover-sub');
    const prevAuto = coverSubOf(playable(st.level));
    if (!sub.value.trim() || sub.value.trim() === prevAuto) sub.value = coverSubOf(playable(id));
  }
  st.level = id;
  fillQuizBars();
  fillFailLen();
}

/** 실패 영상: 몇 초쯤에 탈락할지 + 문구 칸 이름 */
function fillFailLen() {
  const st = state.studio;
  const on = isFailFormat();
  $('#fail-len').hidden = !on;
  $('#studio-top-label').textContent = on ? '위 (치는 동안)' : '위 (훅)';
  $('#studio-bottom-label').textContent = on ? '끝 (도발 문구)' : '아래 (유도)';
  if (!on) return;
  if (!FAIL_SECS.includes(st.failSec)) st.failSec = 12;
  $('#fail-secs').innerHTML = FAIL_SECS.map((n) => `<option value="${n}">약 ${n}초에 탈락</option>`).join('');
  $('#fail-secs').value = String(st.failSec);
}

/** 노래 맞히기: 길이 고르기 (곡마다 초가 달라서 곡을 바꾸면 다시 채움) */
function fillQuizBars() {
  const st = state.studio;
  $('#quiz-len').hidden = !isQuizFormat();
  if (!isQuizFormat() || typeof st.level !== 'number') return;
  const lv = getLevel(st.level);
  const opts = QUIZ_BARS.filter((n) => n === 0 || n < lv.bars.length);
  if (!opts.includes(st.quizBars ?? 8)) st.quizBars = opts[0];
  $('#quiz-bars').innerHTML = opts
    .map((n) => `<option value="${n}">${n ? `앞 ${n}마디` : '끝까지'} · 약 ${quizSeconds(quizId(lv.id, n))}초</option>`)
    .join('');
  $('#quiz-bars').value = String(st.quizBars ?? 8);
}

/** 형식(그냥 치기 / 노래 맞히기)에 맞는 곡 버튼들 */
function renderStudioLevels() {
  const st = state.studio;
  $$('#studio-format button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.format === (st.format || 'play')));
  if (isQuizFormat() || isFailFormat()) {
    $('#studio-levels').innerHTML = LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${levelLabel(l)} · ${l.name}</button>`).join('');
  } else {
    $('#studio-levels').innerHTML =
      (coverOn() ? `<button class="chip-hot" data-studio-level="${BEAT_ID}" aria-pressed="${st.level === BEAT_ID}">${beatChipText()}</button>` : '') +
      STUDIO_CHALLENGES.map(
        (n) => `<button class="chip-hot" data-studio-level="ch${n}" aria-pressed="${st.level === 'ch' + n}">🔥 레벨업 챌린지 Lv.1→${n}</button>`
      ).join('') +
      STUDIO_LEVELS.map((l) => `<button class="chip-hot" data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">🎬 릴스용 · ${l.name} (느리게)</button>`).join('') +
      LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${l.id}. ${l.name}</button>`).join('');
  }
  fillQuizBars();
}
function pickStudioFormat(f) {
  const st = state.studio;
  st.format = f;
  // 노래 맞히기·실패 영상은 진짜 곡만 (레벨업 챌린지·박자 맞추기는 곡이 아님)
  const real = typeof st.level === 'number' && getLevel(st.level);
  pickStudioLevel(f === 'quiz' && !real ? 2 : f === 'fail' && !real ? (getLevel(9) ? 9 : 2) : st.level);
  renderStudioLevels();
}

/** 영상 화면에 그릴 문구 */
function studioOverlay(lv) {
  const st = state.studio;
  if (lv.quiz) return { top: st.top, bottom: st.bottom, quiz: true, answer: lv.name, composer: lv.composer, bottomEnd: '프로필 링크에서 직접 쳐보기' };
  if (isFailFormat() && typeof lv.id === 'number') return { top: st.top, bottom: st.bottom, fail: true, label: `${levelLabel(lv)} · ${lv.composer} ${lv.name}`, bottomEnd: '프로필 링크에서 도전' };
  return {
    top: st.top,
    bottom: st.bottom,
    challenge: !!lv.challenge,
    steady: !!lv.steady,
    countdown: lv.synced ? lv.syncCountdown || 0 : 0,
    endText: lv.steady ? '클리어!' : '',
    label: lv.beat ? `${lv.songName} · ${beatStyleName(lv.beatStyle, lv.beatDiff)}` : lv.challenge ? '레벨업 챌린지' : lv.studioOnly ? `${lv.composer} ${lv.name}` : `${levelLabel(lv)} · ${lv.composer} ${lv.name}`,
  };
}

function openStudio() {
  if (state.game) state.game.stop();
  const st = state.studio;
  st.active = false;
  $('#screen-game').classList.remove('studio-mode');
  if (isQuizFormat() && (typeof st.level !== 'number' || !getLevel(st.level))) st.level = 2;
  if (isFailFormat() && (typeof st.level !== 'number' || !getLevel(st.level))) st.level = getLevel(9) ? 9 : 2;
  renderStudioLevels();
  $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === st.mode));
  $('#studio-top').value = st.top;
  $('#studio-bottom').value = st.bottom;
  const ok = canRecordFile();
  $('#studio-file').disabled = !ok;
  $('#studio-file').checked = ok && st.file;
  $('#studio-file-hint').textContent = ok
    ? '켜면 이 화면이 그대로 소리까지 영상 파일로 저장돼요. 끄면 폰 화면 녹화로 찍으면 돼요.'
    : '이 브라우저는 바로 저장이 안 돼요. 폰 화면 녹화(제어센터)로 찍어주세요.';
  closeModal('modal-studio-done');
  fillCoverForm();
  fillBeatForm();
  show('screen-studio');
}

// ---------------- 🎵 유행곡 박자 맞추기 (운영자 전용, /?thumb=okay 기기에서만) ----------------
//   노래 BPM 에 맞춘 레벨업 챌린지(빠르기 고정). 노래는 게임에 안 넣고 인스타 편집기에서 입힘 (저작권)
const beatSaved = () => beatOpts(load('beatReel', null) || {});

// ---------------- 🎧 화면 녹화로 박자 자동 맞추기 (운영자 전용) ----------------
//   인스타에서 쓸 노래 구간을 고르고, 그 구간이 처음부터 재생되는 걸 화면 녹화 → 그 영상을 여기서 고름.
//   소리가 시작되는 순간 = 인스타 구간 시작 = 우리 영상 0초. 거기서 BPM·첫 박(쿵)을 찾아,
//   드럼 영상의 첫 쿵이 '영상 0초 + (구간 시작 → 첫 박) + 한 마디 단위'에 오게 녹화함.
//   노래는 영상에 안 넣음 (인스타에서 같은 구간을 넣으면 맞음). 파일은 이 폰 메모리에만 (어디에도 안 올림)
const sync = { url: null, name: '', firstBeat: null, t0: 0, bpm: null };
const syncCalib = () => Number(load('syncCalib', 0)) || 0;
/** 박자 맞추기 판: 녹화 중이면 첫 쿵이 노래 박에 오게 시작 시각을 정해 줌 */
/** 카운트다운(초): 영상 0초부터 노래가 나오고, 드럼은 이만큼 뒤의 첫 쿵부터 */
const syncCountdown = () => Math.max(0, Math.min(20, Number(load('syncCountdown', 5)) || 0));
/** 채보 첫 쿵의 녹화 속 시각: 노래 구간 시작 + 카운트다운 뒤의 첫 '쿵' 박 (쿵 박은 2박 간격) */
function syncChartStart() {
  if (sync.firstBeat == null) return null;
  const beat = 60 / (beatSaved().bpm || sync.bpm || 120);
  const k = Math.max(0, Math.ceil((sync.t0 + syncCountdown() - sync.firstBeat) / (beat * 2) - 1e-6));
  return sync.firstBeat + k * beat * 2;
}
function withSync(lv) {
  const st = state.studio;
  const start = syncChartStart();
  if (start == null) return lv;
  // 확인용: 화면 녹화의 노래를 같이 틂 (채보 첫 쿵 = 노래의 그 박). 영상에도 들어감
  if ($('#sync-play').checked && audio.trackBuffer(sync.url)) {
    lv.song = { ...lv.song, audio: { src: sync.url, offset: start, gain: 1 } };
    lv.withSong = true;
  }
  // 녹화는 '노래 구간 시작' 순간부터 (영상 0초 = 인스타 노래 0초). 카운트다운 동안 노래가 흐르고 드럼은 그 뒤 첫 쿵부터
  if (!st.active || !st.file) return lv;
  lv.synced = true;
  lv.syncLead = start - sync.t0; // 노래 구간 시작 → 첫 쿵
  lv.syncCountdown = syncCountdown();
  // 카운트다운을 쓰면 우리 숫자(5·4·3·2·1)로, 아니면 자동 연주 영상엔 3·2·1 안 보이게
  lv.hideCountIn = lv.syncCountdown > 0 || state.auto;
  // 녹화 시작이 판 시작보다 앞서야 하니, 카운트인 한 마디보다 길면 판을 그만큼 늦게 시작
  const countIn = (60 / lv.bpm) * 4 * COUNT_IN_BARS;
  lv.leadIn = Math.max(0, lv.syncLead - countIn) + 0.3;
  return lv;
}
/** 이 폰의 녹화 지연(ms, 찍은 영상을 재서 자동) */
const syncLag = () => Number(load('syncLag', 0)) || 0;
/** 노래 구간 시작 순간에 녹화 시작 (첫 쿵 - lead - 지연·보정) */
function scheduleSyncRec(g) {
  const st = state.studio;
  const lv = g.level;
  const c0 = g.startTime + g.tempo.barStart(COUNT_IN_BARS) - lv.syncLead - (syncLag() + syncCalib()) / 1000;
  const go = () => {
    if (state.game !== g || !st.active) return;
    // 마지막 몇 ms 는 소리 시계를 보며 기다림 (타이머 오차 줄이기)
    const end = performance.now() + 60;
    while (audio.ctx.currentTime < c0 && performance.now() < end) {}
    startRecorder();
  };
  setTimeout(go, Math.max(0, (c0 - audio.ctx.currentTime) * 1000 - 40));
}
/** '1:02.5' · '62.5' → 초 (비우면 null) */
function parseTime(v) {
  const t = String(v || '').trim().replace(/[^\d:.]/g, '');
  if (!t) return null;
  const parts = t.split(':').map(Number);
  const sec = parts.length > 1 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(sec) && sec >= 0 ? sec : null;
}
const fmtTime = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}`;
/** 녹화에서 소리가 처음 나는 시각 (10ms 단위, 가장 큰 소리의 5%를 넘는 첫 순간) */
function soundStart(mono, sr) {
  const hop = Math.round(sr * 0.01);
  const n = Math.floor(Math.min(mono.length, sr * 90) / hop);
  const rms = new Float32Array(n);
  let mx = 0;
  for (let f = 0; f < n; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += mono[i] * mono[i];
    rms[f] = Math.sqrt(e / hop);
    if (rms[f] > mx) mx = rms[f];
  }
  for (let f = 0; f < n; f++) if (rms[f] > mx * 0.05) return f * 0.01;
  return 0;
}
/**
 * 찍힌 영상에서 첫 쿵이 실제로 몇 초에 나왔나 재서, 폰마다 다른 녹화 지연을 「싱크 보정」에 자동 반영.
 *   (카운트인 똑딱을 껐으니 영상의 첫 소리 = 첫 쿵) 어긋났으면 한 번 더 찍으면 맞음
 */
async function syncSelfCheck(blob, computed, lead) {
  try {
    const ab = await blob.arrayBuffer();
    const buf = await new Promise((res, rej) => {
      const q = audio.ctx.decodeAudioData(ab, res, rej);
      if (q && q.then) q.then(res, rej);
    });
    const m = monoOf(buf);
    let mx = 0;
    for (let i = 0; i < m.length; i++) if (Math.abs(m[i]) > mx) mx = Math.abs(m[i]);
    let at = -1;
    for (let i = 0; i < m.length; i++)
      if (Math.abs(m[i]) > mx * 0.3) {
        at = i / buf.sampleRate;
        break;
      }
    if (at < 0) return;
    const d = at - computed; // 이 폰의 녹화 지연 (− 면 영상 소리가 계산보다 빠름)
    if (Math.abs(d) > 0.4) return;
    const lag = Math.round((-d * 1000) / 5) * 5;
    const off = Math.round((at - lead) * 1000); // 이번 영상: 첫 쿵이 노래 박보다 이만큼 늦음
    save('syncLag', lag);
    if (Math.abs(off - syncCalib()) > 15)
      $('#studio-done-msg').textContent += ` · 이번 영상은 드럼이 ${Math.abs(off)}ms ${off < 0 ? '빨라요' : '늦어요'}. 이 폰에 맞게 자동으로 맞췄으니 「다시 찍기」 한 번 하면 딱 맞아요.`;
  } catch {}
}
/** 🥁 노래 따라: 화면 녹화 소리로 채보 (같은 설정이면 다시 안 만듦) */
let songCache = null;
function songBars(o) {
  if (o.style !== 'song' || sync.firstBeat == null) return null;
  const buf = audio.trackBuffer(sync.url);
  if (!buf) return null;
  const first = syncChartStart();
  const key = [sync.url, first, o.bpm, o.rounds, o.diff].join('|');
  if (songCache && songCache.key === key) return songCache.bars;
  const r = songChart(monoOf(buf), buf.sampleRate, { firstBeat: first, bpm: o.bpm, bars: o.rounds * ROUND_BARS, diff: o.diff });
  songCache = { key, bars: r.bars, covered: r.covered };
  return r.bars;
}
/** 노래 따라 안내 한 줄 */
function songInfoText() {
  const o = beatSaved();
  if (o.style !== 'song') return '';
  if (sync.firstBeat == null) return '노래 따라는 위에서 화면 녹화 영상을 넣고 박자를 찾아야 만들어져요 (그 전엔 비트로 쳐요)';
  songBars(o);
  const c = songCache ? songCache.covered : 0;
  const all = o.rounds * ROUND_BARS;
  return c >= all ? `노래 따라: ${all}마디 전부 노래 소리대로 만들었어요` : `노래 따라: ${all}마디 중 ${c}마디만 녹화 소리가 있어서, 뒤는 기본 쿵짝이에요 (더 길게 화면 녹화하면 끝까지)`;
}
let syncPreview = null;
function stopSyncPreview() {
  if (syncPreview) {
    syncPreview.pause();
    syncPreview = null;
  }
}
/**
 * 노래·영상 파일 열기 (기다린 시간·파일 크기를 onTick 으로 알려 줌).
 *   아이폰의 영상 파일은 바로 못 여니 시도하지 않음 → null (영상 소리 읽기 버튼으로)
 *   그 밖에도 limit 초 안에 못 열면 null
 */
async function openTrackFile(url, file, onTick, limit = 12) {
  const isVideo = /^video\//.test(file.type) || /\.(mov|mp4|m4v|qt)$/i.test(file.name);
  const mb = file.size / 1048576;
  const t0 = performance.now();
  const tick = () => onTick(Math.floor((performance.now() - t0) / 1000), mb);
  tick();
  const timer = setInterval(tick, 500);
  const race = (p, sec) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), sec * 1000))]);
  let buf = null;
  // 아이폰 영상(.mov)은 decodeAudioData 로 바로 못 풂 → 영상 상자에서 소리(AAC)만 꺼내서 풂 (몇 초, 영상 길이 그대로)
  if (isVideo && phoneOs() === 'ios') buf = await race(videoAudio(url, file), limit * 2);
  else {
    buf = await race(audio.loadTrack(url), limit);
    if (!buf && isVideo) buf = await race(videoAudio(url, file), limit);
  }
  clearInterval(timer);
  return buf;
}
/** 영상 파일 → 소리만 꺼내서 AudioBuffer (못 하면 null). 꺼낸 소리는 trackBuffer(url) 로도 씀 */
async function videoAudio(url, file) {
  try {
    const aac = await videoToAac(file);
    if (!aac) return null;
    const ctx = audio.ensure();
    const buf = await new Promise((res, rej) => {
      const q = ctx.decodeAudioData(aac.buffer, res, rej);
      if (q && q.then) q.then(res, rej);
    });
    if (!buf || buf.duration < 1) return null;
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(url, buf);
    return buf;
  } catch (e) {
    console.warn('videoAudio', e);
    return null;
  }
}
const fmtMb = (mb) => (mb >= 10 ? Math.round(mb) : mb.toFixed(1)) + 'MB';
/** 영상 소리 읽기 진행: 지난 초/전체 초 + 남은 시간 */
const capText = (t, d) => `영상 소리 읽는 중… ${Math.floor(t)}/${Math.round(d)}초 · 약 ${Math.max(1, Math.round(d - t))}초 남음 (화면을 끄지 마세요)`;
async function syncPick(file) {
  stopSyncPreview();
  if (sync.url) URL.revokeObjectURL(sync.url);
  sync.url = URL.createObjectURL(file);
  sync.name = file.name;
  sync.firstBeat = null;
  $('#sync-panel').hidden = false;
  $('#sync-name').textContent = file.name;
  audio.unlock();
  const buf = await openTrackFile(sync.url, file, (t, mb) => ($('#sync-result').textContent = `여는 중… ${t}초 (파일 ${fmtMb(mb)}, 보통 몇 초면 돼요)`));
  if (!buf) {
    // 아이폰 사파리는 화면 녹화(.mov)를 바로 못 풀어서 → 영상을 소리 없이 한 번 재생하며 소리를 읽음 (버튼을 눌러야 재생됨)
    $('#sync-result').innerHTML = '<b>「박자 찾기」를 눌러 주세요.</b> 영상을 소리 없이 한 번 재생하면서 소리를 읽어요 (영상 길이만큼, 최대 1분 걸려요)';
    $('#sync-detect-btn').textContent = '박자 찾기';
    return;
  }
  syncDetect();
}
/**
 * 영상(.mov 등)을 소리 없이 재생하면서 소리를 그대로 받아 적음 → AudioBuffer (최대 30초)
 *   첫 소리·첫 박의 '간격'만 쓰므로 받아 적기 시작이 조금 늦어도 결과는 같음
 */
function captureMediaAudio(url, onProgress, maxSec = 60, stereo = false) {
  return new Promise((resolve) => {
    const ctx = audio.ensure();
    const v = document.createElement('video');
    v.src = url;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    let src;
    let sp;
    let mute;
    const chunks = [];
    let done = false;
    const MAX = maxSec;
    // 아이폰이 화면 밖 영상을 멈추지 않게 화면에 아주 작게 붙여 둠 + 화면 꺼짐 막기
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(v);
    let lock = null;
    try {
      navigator.wakeLock && navigator.wakeLock.request('screen').then((l) => (done ? l.release() : (lock = l))).catch(() => {});
    } catch {}
    // 중간에 멈추면(다른 앱·화면 꺼짐 등) 다시 재생
    const resume = () => {
      if (!done && v.paused && !v.ended) v.play().catch(() => {});
    };
    v.onpause = () => setTimeout(resume, 300);
    const onVis = () => document.visibilityState === 'visible' && resume();
    document.addEventListener('visibilitychange', onVis);
    const finish = (ok = true) => {
      if (done) return;
      done = true;
      const want = Math.min(MAX, v.duration || 0);
      try {
        v.onpause = null;
        v.pause();
        src && src.disconnect();
        sp && sp.disconnect();
        mute && mute.disconnect();
        v.remove();
        document.removeEventListener('visibilitychange', onVis);
        lock && lock.release();
      } catch {}
      const len = chunks.reduce((a, c) => a + c[0].length, 0);
      if (!ok || len < ctx.sampleRate * 3) return resolve(null);
      // 좌우 그대로 (유저 맵 음 따기가 가운데 소리=보컬을 골라 듣는 데 씀)
      const nch = chunks.some((c) => c[1] !== c[0]) ? 2 : 1;
      const buf = ctx.createBuffer(nch, len, ctx.sampleRate);
      for (let k = 0; k < nch; k++) {
        const ch = buf.getChannelData(k);
        let o = 0;
        for (const c of chunks) {
          ch.set(c[k], o);
          o += c[k].length;
        }
      }
      // 영상보다 한참 짧게 읽혔으면 표시 (부른 쪽이 안내)
      if (want > 0 && buf.duration < want - 2) buf.partial = want;
      resolve(buf);
    };
    try {
      src = ctx.createMediaElementSource(v);
      sp = ctx.createScriptProcessor(4096, 2, 1);
      mute = ctx.createGain();
      mute.gain.value = 0; // 스피커로는 안 나감
      src.connect(sp);
      sp.connect(mute);
      mute.connect(ctx.destination);
    } catch {
      return resolve(null);
    }
    sp.onaudioprocess = (e) => {
      if (done || v.paused) return;
      const ib = e.inputBuffer;
      const a = new Float32Array(ib.getChannelData(0));
      if (!stereo || ib.numberOfChannels < 2) {
        // 모노로 (긴 노래는 폰 메모리 아끼기)
        const b = ib.numberOfChannels > 1 ? ib.getChannelData(1) : a;
        for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[i]) * 0.5;
        chunks.push([a, a]);
      } else chunks.push([a, new Float32Array(ib.getChannelData(1))]);
    };
    v.ontimeupdate = () => {
      onProgress && onProgress(v.currentTime, Math.min(MAX, v.duration || MAX));
      if (v.currentTime >= MAX) finish();
    };
    v.onended = () => finish();
    v.onerror = () => finish(false);
    setTimeout(() => finish(), (MAX + 15) * 1000);
    const p = v.play();
    if (p && p.catch) p.catch(() => finish(false));
  });
}
function syncListen() {
  if (!sync.url) return;
  if (syncPreview) return stopSyncPreview();
  const a = new Audio(sync.url);
  a.currentTime = sync.firstBeat != null ? sync.firstBeat : parseTime($('#sync-start').value) ?? 0;
  a.play().catch(() => {});
  syncPreview = a;
  setTimeout(() => syncPreview === a && stopSyncPreview(), 8000);
}
let syncCapturing = false;
async function syncDetect() {
  if (!sync.url) return toast('화면 녹화 영상을 먼저 골라 주세요');
  let buf = audio.trackBuffer(sync.url);
  if (!buf) {
    if (syncCapturing) return;
    syncCapturing = true;
    await audio.unlock();
    $('#sync-result').textContent = '소리 읽는 중… (영상이 끝날 때까지 기다려 주세요)';
    buf = await captureMediaAudio(sync.url, (t, d) => ($('#sync-result').textContent = capText(t, d)));
    syncCapturing = false;
    if (!buf) {
      $('#sync-result').textContent = '영상 소리를 못 읽었어요. 화면 녹화할 때 소리가 들어갔는지 확인하고 다시 골라 주세요';
      return;
    }
    audio._trackBufs ??= new Map();
    audio._trackBufs.set(sync.url, buf); // 다시 찾기 때는 바로
    $('#sync-detect-btn').textContent = '박자 다시 찾기';
  }
  stopSyncPreview();
  const mono = monoOf(buf);
  // 구간 시작: 비우면 녹화에서 소리가 처음 나는 순간 (인스타 구간이 재생되기 시작한 때)
  const manual = parseTime($('#sync-start').value);
  const start = manual ?? soundStart(mono, buf.sampleRate);
  if (start >= buf.duration - 6) return toast('녹화가 너무 짧아요. 노래가 10초 넘게 나오게 녹화해 주세요');
  const free = detectBeat(mono, buf.sampleRate, { start });
  // 탭/직접 쓴 BPM 이 감지값(또는 그 두 배·절반)과 가까우면 그 근처에서 다시 정밀하게 → 사람이 세는 쪽(쿵짝 빠르기)을 따름
  const want = Number($('#beat-bpm').value) || 0;
  let r = free;
  if (free && want) {
    for (const m of [1, 2, 0.5]) {
      if (Math.abs(free.bpm * m - want) / want < 0.04) {
        r = detectBeat(mono, buf.sampleRate, { start, hintBpm: want }) || free;
        break;
      }
    }
  }
  if (!r) return toast('박자를 못 찾았어요. 다른 구간으로 해 보세요');
  sync.firstBeat = r.firstBeat;
  sync.t0 = start;
  sync.bpm = r.bpm;
  $('#beat-bpm').value = Math.round(r.bpm * 10) / 10;
  saveBeatForm();
  pickBeat();
  $('#sync-result').innerHTML =
    `<b>${Math.round(r.bpm * 10) / 10} BPM</b> · 노래 시작(${fmtTime(start)}) 뒤 ${(r.firstBeat - start).toFixed(2)}초에 첫 박` +
    `${r.confidence < 0.3 ? ' · <b>박이 잘 안 들려요</b>(소리 크게 다시 녹화)' : ''}<br>` +
    '이대로 녹화하면 드럼이 이 박에 맞춰 나와요. 드럼이 2배로 바쁘면 ÷2 누르고 다시 「박자 찾기」' +
    (songInfoText() ? `<br>${songInfoText()}` : '');
}
function beatChipText() {
  const o = beatSaved();
  return `🎵 박자 맞추기 · ${beatStyleName(o.style, o.diff)} · ${o.title || o.bpm + ' BPM'}`;
}
function fillBeatForm() {
  $('#beat-block').hidden = !coverOn();
  if (!coverOn()) return;
  const o = beatSaved();
  $('#beat-bpm').value = o.bpm;
  $('#beat-title').value = o.title;
  $('#beat-click').checked = o.click;
  $('#sync-calib').textContent = `${syncCalib() > 0 ? '+' : ''}${syncCalib()}ms`;
  $('#sync-cd').textContent = syncCountdown() ? `${syncCountdown()}초` : '없음';
  // 버튼은 한 번만 만듦 (BPM 칸을 고치다 바로 형식을 누르면, 다시 그리는 사이 누른 게 사라짐)
  if (!$('#beat-style').children.length)
    $('#beat-style').innerHTML = BEAT_STYLES.map((x) => `<button type="button" data-beat-style="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-style button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatStyle === o.style));
  if (!$('#beat-diff').children.length)
    $('#beat-diff').innerHTML = BEAT_DIFFS.map((x) => `<button type="button" data-beat-diff="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-diff button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatDiff === o.diff));
  $('#beat-diff').hidden = o.style === 'levelup';
  const sel = $('#beat-rounds');
  const key = `${o.bpm}|${o.style}`;
  if (!sel.options.length || sel.dataset.key !== key) {
    sel.innerHTML = Array.from({ length: BEAT_MAX_ROUNDS }, (_, i) => {
      const r = i + 1;
      const text = o.style === 'levelup' ? `Lv.1→${r}` : `${r * 4}마디`;
      return `<option value="${r}">${text} · 약 ${Math.round(beatSeconds({ bpm: o.bpm, rounds: r }))}초</option>`;
    }).join('');
    sel.dataset.key = key;
  }
  sel.value = String(o.rounds);
}
/** 폼 → 저장 (패턴 시드는 그대로 → 같은 채보로 다시 찍을 수 있음) */
function saveBeatForm({ reroll = false } = {}) {
  const prev = beatSaved();
  const o = beatOpts({
    bpm: $('#beat-bpm').value,
    rounds: $('#beat-rounds').value,
    title: $('#beat-title').value.trim(),
    click: $('#beat-click').checked,
    style: ($('#beat-style [aria-pressed="true"]') || {}).dataset?.beatStyle || prev.style,
    diff: ($('#beat-diff [aria-pressed="true"]') || {}).dataset?.beatDiff || prev.diff,
    seed: reroll ? undefined : prev.seed,
  });
  save('beatReel', o);
  fillBeatForm();
  const chip = $(`#studio-levels [data-studio-level="${BEAT_ID}"]`);
  if (chip) chip.textContent = beatChipText();
  return o;
}
function pickBeat() {
  saveBeatForm();
  state.studio.format = 'play'; // 박자 맞추기는 '그냥 치기' 형식 안에 있음
  pickStudioLevel(BEAT_ID);
  renderStudioLevels();
  toast(songInfoText() || `${beatChipText()} 골랐어요`, songInfoText() ? 3500 : 1600);
}
// 탭으로 BPM 재기: 마지막 12번 탭 간격의 중앙값 (2초 쉬면 새로 잼)
const beatTaps = [];
function beatTap(e) {
  e.preventDefault();
  const now = e.timeStamp || performance.now();
  if (beatTaps.length && now - beatTaps[beatTaps.length - 1] > 2000) beatTaps.length = 0;
  beatTaps.push(now);
  if (beatTaps.length > 13) beatTaps.shift();
  const gaps = beatTaps.slice(1).map((t, i) => t - beatTaps[i]).sort((a, b) => a - b);
  if (gaps.length < 3) {
    $('#beat-tap-bpm').textContent = '탭';
    $('#beat-tap-msg').textContent = `${beatTaps.length}번… 계속 톡톡`;
    return;
  }
  const bpm = Math.round((60000 / gaps[gaps.length >> 1]) * 2) / 2;
  $('#beat-tap-bpm').textContent = `${bpm} BPM`;
  $('#beat-tap-msg').textContent = beatTaps.length >= 8 ? '좋아요! 숫자가 안 바뀌면 그게 BPM (2초 쉬면 새로 재요)' : `${beatTaps.length}번… 8번 넘게 톡톡`;
  $('#beat-bpm').value = bpm;
  if (beatTaps.length >= 8) saveBeatForm();
}

// ---------------- 🖼 릴스 썸네일 (운영자 전용, /?thumb=okay) ----------------
const coverOn = () => load('thumbTool', false) === true;
const coverSubOf = (lv) => (!lv ? '' : isQuizFormat() ? '노래 맞히기 퀴즈' : lv.beat ? `${lv.songName} · ${beatStyleName(lv.beatStyle, lv.beatDiff)}` : lv.challenge ? `${lv.composer} ${lv.songName} · 레벨업 챌린지` : `${lv.composer} ${lv.name}`);
/** 썸네일 칸 채우기: 직접 쓴 문구는 기억, 곡 배지는 곡을 바꾸면 따라 바뀜(직접 고쳤으면 그대로) */
function fillCoverForm() {
  $('#cover-block').hidden = !coverOn();
  if (!coverOn()) return;
  const saved = load('coverText', null) || { l1: '엄지 두 개로', l2: '따라 쳐봐!', bottom: '프로필 링크에서 바로 해보기' };
  const lv = playable(state.studio.level);
  $('#cover-l1').value = saved.l1 ?? '';
  $('#cover-l2').value = saved.l2 ?? '';
  $('#cover-bottom').value = saved.bottom ?? '';
  $('#cover-sub').value = saved.subFixed ? saved.sub || '' : coverSubOf(lv);
}
function saveCoverForm() {
  const lv = playable(state.studio.level);
  const sub = $('#cover-sub').value.trim();
  save('coverText', { l1: $('#cover-l1').value.trim(), l2: $('#cover-l2').value.trim(), bottom: $('#cover-bottom').value.trim(), sub, subFixed: sub !== coverSubOf(lv) });
}
/** 🖼 릴스 썸네일: 고른 곡의 게임 화면 + 직접 쓴 문구로 1080×1920 표지 */
async function studioCover() {
  const st = state.studio;
  const lv = playable(st.level);
  if (!lv) return;
  saveCoverForm();
  const l1 = $('#cover-l1').value.trim();
  const l2 = $('#cover-l2').value.trim();
  const top = l1 && l2 ? `${l1}\n${l2}` : l1 || l2 || '엄지로 드럼 쳐봐!';
  const sub = $('#cover-sub').value.trim();
  const bottom = $('#cover-bottom').value.trim();
  toast('썸네일 만드는 중…', 1500);
  try {
    await fontsReady(top + sub + bottom);
    const canvas = await makeReelCover({ lv, title: top, sub, bottom });
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], `okaystra-cover-${lv.id}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    $('#share-title').textContent = '릴스 썸네일';
    $('#share-hint').textContent = '이미지를 길게 눌러 저장하고, 릴스 올릴 때 커버로 고르세요!';
    $('#share-img').src = canvas.toDataURL('image/png');
    openModal('modal-share');
  } catch (e) {
    console.error(e);
    toast('썸네일을 만들지 못했어요. 다시 해 주세요');
  }
}

async function studioStart() {
  const st = state.studio;
  st.top = $('#studio-top').value.trim();
  st.bottom = $('#studio-bottom').value.trim();
  st.file = $('#studio-file').checked;
  st.quizBars = Number($('#quiz-bars').value || st.quizBars || 8);
  st.failSec = Number($('#fail-secs').value || st.failSec || 12);
  save('studio', { level: st.level, mode: st.mode, top: st.top, bottom: st.bottom, file: st.file, format: st.format || 'play', quizBars: st.quizBars, failSec: st.failSec });
  const playId = studioPlayId();
  closeModal('modal-studio-done');
  await audio.unlock();
  st.active = true;
  state.auto = st.mode === 'auto';
  // 9:16 화면을 먼저 깔고 카운트다운
  show('screen-game');
  $('#screen-game').classList.add('studio-mode');
  const lv = playable(playId) || getLevel(1);
  renderer.studio = studioOverlay(lv);
  setKit(lv);
  await fontsReady(`${renderer.studio.top || ''}${renderer.studio.bottom || ''}${renderer.studio.label || ''}`);
  await new Promise((r) => requestAnimationFrame(r));
  await renderer.resize(Math.min(3, Math.max(2, 1080 / ($('#game-canvas').clientWidth || 390))));
  renderer.draw({ now: -1, notes: [], approach: 1.5, beatDur: 60 / lv.bpm, combo: 0, score: 0, playing: false }, performance.now() / 1000);
  const box = $('#studio-count');
  box.hidden = false;
  $('#studio-count-msg').textContent = st.file ? '녹화 준비 중… 화면 그대로 영상으로 저장돼요' : '폰 화면 녹화 켜셨나요? 곧 시작해요 (곡이 멈추면 화면을 톡)';
  for (const n of ['3', '2', '1']) {
    $('#studio-count-num').textContent = n;
    await new Promise((r) => setTimeout(r, 800));
    if (!st.active) {
      box.hidden = true;
      return;
    }
  }
  box.hidden = true;
  if (playId === BEAT_ID && sync.firstBeat != null && !st.file) toast('「영상 파일로 바로 저장」을 켜야 화면 녹화한 노래 박에 맞춰져요', 3000);
  // 박자 맞추기(화면 녹화로 맞춤)는 녹화를 '노래 구간 시작' 순간에 시작 → startLevel 뒤에
  if (st.file && !(playId === BEAT_ID && sync.firstBeat != null)) startRecorder();
  await startLevel(playId);
}

function startRecorder() {
  const st = state.studio;
  try {
    const mime = pickMime();
    const v = $('#game-canvas').captureStream(60);
    const a = audio.captureStream();
    const stream = new MediaStream([...v.getVideoTracks(), ...a.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    st.chunks = [];
    st.mime = mime;
    rec.ondataavailable = (e) => e.data && e.data.size && st.chunks.push(e.data);
    rec.start(250);
    st.recorder = rec;
    st.recCtx = audio.ctx.currentTime; // 영상 0초 = 이 소리 시각 (첫 쿵이 영상 몇 초인지 계산용)
  } catch (e) {
    st.recorder = null;
    toast('영상 저장을 시작하지 못했어요. 화면 녹화로 찍어주세요.');
  }
}

function stopRecorder() {
  const st = state.studio;
  const rec = st.recorder;
  st.recorder = null;
  if (!rec || rec.state === 'inactive') return Promise.resolve(null);
  return new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(st.chunks, { type: (st.mime || 'video/webm').split(';')[0] }));
    rec.stop();
  });
}

/** 💀 실패 영상: 하트가 다 떨어짐 → '띠로리' + 그대로 끝 (studioFinish 가 도발 문구 장면을 찍음) */
function studioFailDeath() {
  const g = state.game;
  if (!g || !state.studio.active) return;
  g.giveUp();
  try {
    audio.aww();
  } catch {}
}

async function studioFinish(res) {
  const st = state.studio;
  // 마지막 장면(환호하는 마스코트)을 잠깐 더 담기
  const g = state.game;
  const t0 = performance.now();
  const died = !!(res.failed && g && g.level.failReel);
  await new Promise((resolve) => {
    (function hold() {
      const rt = performance.now() / 1000;
      renderer.draw(
        {
          now: died ? g.diedAt : g.endTime,
          notes: died ? g.notes : [],
          dead: died,
          lives: died ? 0 : null,
          maxLives: MAX_LIVES,
          progress: res.progress,
          approach: g.approach,
          beatDur: g.beat,
          combo: g.combo,
          score: res.score,
          playing: false,
          finished: true,
          round: g.roundInfo || null,
          cleared: res.challenge ? res.roundsCleared : 0,
        },
        rt
      );
      // 노래 맞히기: 정답이 뜨는 장면을 넉넉히
      if (performance.now() - t0 < (renderer.studio && (renderer.studio.quiz || died) ? 3600 : res.challenge ? 2400 : 1500)) requestAnimationFrame(hold);
      else resolve();
    })();
  });
  // 박자 맞추기: 첫 쿵이 영상 몇 초에 나오나 (인스타에서 노래 첫 박을 여기에 맞춤)
  const firstHit = g && g.level.beat && st.recorder && st.recCtx != null ? g.startTime + g.tempo.barStart(COUNT_IN_BARS) - st.recCtx : null;
  const blob = await stopRecorder();
  st.active = false;
  state.auto = false;
  const video = $('#studio-video');
  if (st.blobUrl) URL.revokeObjectURL(st.blobUrl);
  st.blob = blob;
  if (blob && blob.size) {
    st.blobUrl = URL.createObjectURL(blob);
    video.src = st.blobUrl;
    video.onloadedmetadata = () => {
      try {
        video.currentTime = 0.1;
      } catch {}
    };
    video.hidden = false;
    $('#btn-studio-save').hidden = false;
    $('#studio-done-msg').textContent =
      g && g.level.withSong
        ? '노래를 같이 넣은 확인용 영상이에요. 박이 맞으면, 인스타에 올릴 건 「노래도 같이 틀기」를 끄고 다시 찍으세요 (노래는 인스타에서 넣기)'
        : g && g.level.synced
        ? (g.level.syncCountdown ? `영상 0초부터 노래가 나오고, ${g.level.syncCountdown}초 카운트다운 뒤 첫 박(영상 ${g.level.syncLead.toFixed(2)}초)부터 드럼이에요. ` : '') + '영상 0초 = 노래 구간 시작이에요. 인스타에서 같은 노래·같은 구간을 넣고 노래 클립을 맨 앞(0초)에 붙이면 맞아요. 드럼이 노래보다 빠르면 「싱크 보정」을 +, 늦으면 −로 바꿔 다시 찍기'
        : firstHit != null && firstHit > 0
        ? `영상이 만들어졌어요. 첫 쿵은 영상 약 ${firstHit.toFixed(1)}초예요. 인스타에서 영상 앞을 그만큼 잘라내고, 노래는 하이라이트 첫 박(첫 강세)부터 시작하게 고르면 박자가 맞아요.`
        : '영상이 만들어졌어요. 저장해서 릴스에 올려보세요!';
    // 보정 없이 첫 쿵이 와야 할 영상 시각과 비교 (보정값은 그 차이만큼)
    if (g && g.level.synced && !g.level.withSong && state.studio.mode === 'auto' && firstHit != null) syncSelfCheck(blob, firstHit, g.level.syncLead);
  } else {
    video.hidden = true;
    $('#btn-studio-save').hidden = true;
    $('#studio-done-msg').textContent = '화면 녹화를 멈추고 사진 앱에서 확인하세요. 위아래를 9:16으로 잘라 쓰면 딱 맞아요.';
  }
  if (!res.auto && !res.challenge && !res.failed && !isQuizId(res.levelId)) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `okaystra-${isQuizFormat() ? 'quiz-' + st.level : isFailFormat() ? 'fail-' + st.level : isChallengeId(st.level) ? 'challenge' : st.level + '단계'}.${ext}`, { type: st.blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = st.blobUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (ext === 'webm') toast('webm 파일이에요. 인스타에 안 올라가면 mp4로 변환해 주세요', 3500);
}

async function studioStop() {
  const st = state.studio;
  st.active = false;
  $('#studio-count').hidden = true;
  if (state.game) state.game.stop();
  await stopRecorder();
  state.auto = false;
  $('#screen-game').classList.remove('studio-mode');
  renderer.studio = null;
  openStudio();
}

// ---------------- 이벤트 연결 ----------------
// ---------------- 🏆 랭킹전 (실시간 매칭 → 안 잡히면 고스트) ----------------
//   실시간 상대를 RANKED_WAIT_MS 동안 찾고(5초마다 물어봄), 붙으면 서버가 바로 시작 시각을 정함.
//   안 잡히면 비슷한 점수인 사람의 예전 판(고스트)과 겨룸. 판이 끝나면 /api/ranked 로 결과 한 번 → 엘로 점수.
const RANKED_WAIT_MS = 20_000;
const roomUi = { round: 0, newMode: 'versus' };
const rk = { info: null, infoAt: 0, sub: null, game: null };
const TIER_UI = { bronze: ['🥉', '브론즈'], silver: ['🥈', '실버'], gold: ['🥇', '골드'], diamond: ['💎', '다이아'], master: ['👑', '마스터'] };
const TIER_MIN = { bronze: 0, silver: 1100, gold: 1300, diamond: 1500, master: 1700 };
const tierOfRating = (r) => Object.keys(TIER_MIN).reduce((t, k) => (r >= TIER_MIN[k] ? k : t), 'bronze');
const tierHtml = (key, rating) => `${TIER_UI[key] ? TIER_UI[key][0] + ' ' + TIER_UI[key][1] : ''}${rating != null ? ` <b>${fmt(rating)}</b>` : ''}`;
function roomOtherName() {
  const o = state.roomClient && state.roomClient.other;
  if (!o) return '상대';
  return o.rt != null ? `${TIER_UI[tierOfRating(o.rt)][0]}${o.name}` : o.name;
}
/** 서버 방 이름 규칙(글자·숫자·_ . 공백, 12자)에 맞춘 내 이름 */
function myRoomName() {
  const raw = (state.me && state.me.player && state.me.player.username) || load('roomName', '') || '';
  return raw.replace(/[^\p{L}\p{N}_. ]/gu, '').trim().slice(0, 12) || '드러머';
}
function roomErrText(e) {
  const k = (e && (e.data && e.data.error)) || (e && e.message) || '';
  return (
    {
      rate_limited: '잠시 뒤 다시 해 주세요',
      busy: '서버가 붐벼서 멀티는 잠시 쉬어요 · 혼자 치기는 그대로예요',
      no_server: '지금은 서버에 연결할 수 없어요',
      room_gone: '대결이 끝났어요',
      daily_limit: '오늘 랭킹전은 다 쳤어요! 내일 다시 만나요 (하루 30판)',
      confirm_required: '🏆 랭킹전은 팔로워 인증을 받아야 할 수 있어요',
      confirm_pending: '🏆 랭킹전은 팔로워 인증을 받아야 할 수 있어요',
    }[k] || '연결이 불안정해요. 잠시 뒤 다시 해 주세요'
  );
}
/** 대결 창에서 보일 칸: entry(처음) · wait(랭킹전 상대 찾는 중) · lobby(친구 방 대기실) */
function roomPanel(which) {
  $('#room-entry').hidden = which !== 'entry';
  $('#room-wait').hidden = which !== 'wait';
  $('#room-lobby').hidden = which !== 'lobby';
}
/** 랭킹전·건의하기 잠금: 팔로워 인증 안 했으면 true (개발용 ?gate=open 이면 풀림) */
function followGated() {
  return state.cfg.gateMode !== 'open' && !isConfirmed() && !freePass();
}
function openRoom(code) {
  if (followGated()) {
    openVerify(null, { label: '⚔️ 친구 대결은 팔로워만', then: () => openRoom(code) });
    return;
  }
  const c = state.roomClient;
  const friend = c.active && c.room && !c.room.pub;
  roomPanel(friend ? 'lobby' : c.active && c.waiting ? 'wait' : 'entry');
  if (friend) renderFriendRoom(c.room);
  else {
    $('#room-name').value = load('roomName', '') || myRoomName();
    if (code) $('#room-code').value = code;
    $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === roomUi.newMode)));
    showRushWaiting();
  }
  openModal('modal-room');
}
function renderRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  if (room.pub !== 'ranked') return renderFriendRoom(room);
  // 상대가 붙으면 서버가 정한 시각에 같이 시작
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    stopWaitTimer();
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      rk.game = { kind: 'live', levelId: room.level };
      startLevel(room.level, { room: { startAt, mode: 'versus', round: room.round, ranked: true } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
}
function stopWaitTimer() {
  clearInterval(roomUi.waitTimer);
  roomUi.waitTimer = null;
}
/** 🏆 랭킹전 시작: 실시간 상대 찾기 → RANKED_WAIT_MS 안에 안 잡히면 고스트 */
async function rankedGo() {
  if (followGated()) return openRoom();
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => openRoom() });
    return;
  }
  if (rk.info && rk.info.me && rk.info.me.left <= 0) return toast(roomErrText({ message: 'daily_limit' }), 3000);
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  const c = state.roomClient;
  try {
    if (c.active) await c.leave();
    const waiting = await c.quick(myRoomName(), 'ranked');
    if (!waiting) return; // 바로 붙음 → renderRoom 이 시작
  } catch (e) {
    toast(roomErrText(e), 3000);
    return;
  }
  openModal('modal-room');
  roomPanel('wait');
  const t0 = Date.now();
  const tick = async () => {
    if (!c.active || !c.waiting) return stopWaitTimer();
    const left = Math.max(0, Math.ceil((RANKED_WAIT_MS - (Date.now() - t0)) / 1000));
    $('#room-wait-title').textContent = `실시간 상대 찾는 중… ${left}초`;
    $('#room-wait-sub').textContent = '안 잡히면 비슷한 실력의 고스트와 겨뤄요';
    if (Date.now() - t0 < RANKED_WAIT_MS) return;
    stopWaitTimer();
    // 마지막으로 한 번 더 확인 (그 사이 누가 붙었으면 실시간으로)
    await c.poll();
    if (!c.active || !c.waiting) return;
    await c.leave();
    rankedGhost();
  };
  stopWaitTimer();
  tick();
  roomUi.waitTimer = setInterval(tick, 1000);
}
async function rankedGhost() {
  $('#room-wait-title').textContent = '👻 고스트 불러오는 중…';
  $('#room-wait-sub').textContent = '';
  let r;
  try {
    r = await state.api.ranked({ action: 'ghost' });
  } catch (e) {
    roomPanel('entry');
    toast(roomErrText(e), 3000);
    return;
  }
  closeModal('modal-room');
  const g = { ...r.ghost, name: `👻${r.ghost.name}`, rt: r.ghost.rating };
  rk.game = { kind: 'ghost', gid: r.gid, levelId: g.levelId };
  toast(`👻 ${r.ghost.name} 님의 기록과 대결! ${TIER_UI[tierOfRating(g.rating)][0]} ${fmt(g.rating)}`, 2600);
  startLevel(g.levelId, { room: { ghost: g, gid: r.gid, mode: 'versus' } });
}
/** 판 끝 → 결과 보내기 (실시간은 상대가 끝날 때까지 몇 번 다시) */
async function submitRanked(res) {
  const sub = rk.sub;
  if (!sub || sub.res !== res || sub.state !== 'idle') return;
  sub.state = 'sending';
  const c = state.roomClient;
  const body = { action: 'result', levelId: res.levelId, score: res.score, timeline: res.timeline, died: !!(res.failed || res.died) };
  if (res.room.ghost) Object.assign(body, { kind: 'ghost', gid: res.room.gid });
  else Object.assign(body, { kind: 'live', code: sub.code, slot: sub.slot, key: sub.key });
  try {
    const d = await state.api.ranked(body);
    if (d.wait) {
      sub.state = sub.tries++ < 30 ? 'idle' : 'error';
      if (sub.state === 'idle') setTimeout(() => submitRanked(res), 4000);
      return;
    }
    sub.state = 'done';
    sub.data = d;
    rk.infoAt = 0;
    if (d.tierUp && TIER_UI[d.tierUp] && d.delta > 0) setTimeout(() => toast(`🎉 ${TIER_UI[d.tierUp].join(' ')} 승급!`, 3200), 600);
    if (!res.room.ghost) c.leave();
  } catch (e) {
    sub.state = 'error';
    sub.err = e;
  }
  renderRoomResult();
}
/** 결과 화면: 랭킹전 / 친구 대결 결과 */
function renderRoomResult() {
  const res = state.lastResult;
  if (!res || !res.room) return;
  if (res.room.ranked || res.room.ghost) renderRankedResult();
  else if (res.room.rush) renderRushResult();
  else renderFriendResult();
}
/** 결과 화면: 랭킹전 결과 (승패 · 점수 변화) */
function renderRankedResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  if (!rk.sub || rk.sub.res !== res) rk.sub = { res, state: 'idle', tries: 0, code: c.code, slot: c.slot, key: c.key };
  const sub = rk.sub;
  const mine = res.score;
  const died = !!(res.failed || res.died);
  const word = { 1: '승리! 🎉', 0: '아쉽게 패배…', 0.5: '무승부!' };
  const cls = { 1: 'win', 0: 'lose', 0.5: 'draw' };
  let opName, theirs, result = null, why = '';
  if (res.room.ghost) {
    const g = res.room.ghost;
    opName = g.name;
    theirs = g.score;
    result = died ? 0 : mine === theirs ? 0.5 : mine > theirs ? 1 : 0;
    if (died) why = '목숨을 다 썼어요';
  } else {
    const o = c.active ? c.other : null;
    opName = o ? roomOtherName() : sub.opName || '상대';
    if (o) sub.opName = opName;
    theirs = o && o.final ? o.final.score : o && o.live ? o.live.score : null;
    if (theirs != null) sub.theirs = theirs;
    else theirs = sub.theirs ?? null;
    if (sub.data) result = sub.data.result;
    else if (o && o.final) result = !!o.final.died !== died ? (died ? 0 : 1) : mine === o.final.score ? 0.5 : mine > o.final.score ? 1 : 0;
    else if (o && o.left) result = 1;
    if (result === 1 && ((o && o.left && !o.final) || (sub.data && sub.data.opGone))) why = '상대가 나갔어요';
    else if (result === 1 && o && o.final && o.final.died) why = `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요`;
    else if (result === 0 && died) why = '내가 먼저 목숨을 다 썼어요';
  }
  if (sub.data && sub.data.void) result = null;
  let head;
  if (sub.data && sub.data.void) head = '<div class="room-word">상대가 시작 전에 나갔어요 · 점수 변화 없음</div>';
  else if (result == null) head = `<div class="room-word">${escapeHtml(opName)} 님 아직 치는 중…</div>`;
  else head = `<div class="room-word ${cls[result]}">${word[result]}</div>${why ? `<div class="room-why">${why}</div>` : ''}`;
  let rating = '';
  if (sub.state === 'done' && sub.data && !sub.data.void) {
    const d = sub.data;
    rating = `<div class="rk-delta ${d.delta >= 0 ? 'up' : 'down'}">${tierHtml(d.tier, d.rating)} <span>${d.delta >= 0 ? '+' : ''}${d.delta}</span></div>${d.placement ? `<div class="room-why">배치고사 ${d.placement}판 남음</div>` : ''}`;
  } else if (sub.state === 'error') rating = `<div class="room-why">${roomErrText(sub.err)} · 점수 반영이 안 됐어요</div>`;
  else rating = '<div class="room-why">점수 계산 중…</div>';
  box.innerHTML = `${head}${rating}
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${escapeHtml(opName)}<b>${theirs == null ? '-' : fmt(theirs)}</b></span></div>
    <div class="room-acts"><button class="btn btn-primary" data-action="room-next">🏆 한 판 더</button><button class="btn btn-ghost" data-action="room-leave">나가기</button></div>`;
  // 결과가 정해지면 서버로 (실시간은 서버가 상대 점수를 확인)
  if (sub.state === 'idle' && (res.room.ghost || result != null)) submitRanked(res);
}
/** 🎲 지금 기다리는 사람 수 (창 열 때 한 번만 물어봄 — 요청 아끼려고 폴링 안 함, 10초 안에 다시 열면 그대로) */
async function showRushWaiting() {
  const el = $('#rush-wait');
  if (Date.now() - (roomUi.cntAt || 0) < 10_000) return;
  roomUi.cntAt = Date.now();
  const n = await state.roomClient.waitingCounts();
  if (!n || n.rush == null) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.toggle('on', n.rush > 0);
  el.textContent = n.rush > 0 ? `지금 대기 ${n.rush >= 5 ? '5명+' : n.rush + '명'} · 바로 붙어요!` : '지금 대기 0명';
}
// ----- 🎲 랜덤 대결 (4~18단계 무작위 · 둘 다 깨면 다음 곡 · 먼저 쓰러지면 짐) -----
const RUSH_WAIT_MAX_MS = 3 * 60_000; // 이만큼 기다려도 안 잡히면 그만 (서버 요청 아끼기)
const rush = { over: null }; // 끝난 판 결과 (방을 나간 뒤에도 결과 화면에 그대로)
async function rushGo() {
  if (followGated()) {
    openVerify(null, { label: '🎲 랜덤 대결은 팔로워만', then: rushGo });
    return;
  }
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: rushGo });
    return;
  }
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  rush.over = null;
  const c = state.roomClient;
  try {
    if (c.active) await c.leave();
    const waiting = await c.quick(myRoomName(), 'rush');
    if (!waiting) return; // 바로 붙음 → renderRoom 이 시작
  } catch (e) {
    toast(roomErrText(e), 3000);
    return;
  }
  openModal('modal-room');
  roomPanel('wait');
  const t0 = Date.now();
  const tick = async () => {
    if (!c.active || !c.waiting) return stopWaitTimer();
    const sec = Math.floor((Date.now() - t0) / 1000);
    $('#room-wait-title').textContent = `🎲 상대 찾는 중… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#room-wait-sub').textContent = '누가 들어오면 바로 시작해요 · 친구에게 랜덤 대결 들어오라고 해 보세요!';
    if (Date.now() - t0 < RUSH_WAIT_MAX_MS) return;
    stopWaitTimer();
    await c.poll();
    if (!c.active || !c.waiting) return;
    await c.leave();
    roomPanel('entry');
    toast('지금은 상대가 없어요. 조금 뒤에 다시 해 보세요', 3200);
  };
  stopWaitTimer();
  tick();
  roomUi.waitTimer = setInterval(tick, 1000);
}
/** 결과 화면: 랜덤 대결 (둘 다 깼으면 다음 곡 기다림 / 누가 쓰러졌으면 승패) */
function renderRushResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  const acts = '<div class="room-acts"><button class="btn btn-hot" data-action="rush-next">🎲 새 상대 찾기</button><button class="btn btn-ghost" data-action="room-leave">나가기</button></div>';
  if (rush.over && rush.over.res === res) {
    box.innerHTML = rush.over.html + acts;
    return;
  }
  const round = res.room.round || 1;
  const o = c.active && c.room && c.room.round === round ? c.other : c.active && c.room && c.room.round > round ? { next: true } : null;
  const iDied = !!(res.failed || res.died);
  const mine = res.score;
  let r = null, why = '', theirs = null;
  if (o && o.next) {
    // 다음 곡이 벌써 정해짐 → 곧 시작 (renderFriendRoom 이 시작함)
    box.innerHTML = `<div class="room-word win">둘 다 깼어요! 🎉</div><div class="room-why">${round + 1}곡째 곧 시작해요…</div>`;
    return;
  }
  if (!c.active || !o || (o.left && !o.final)) {
    if (iDied) r = 'lose', why = '내가 먼저 목숨을 다 썼어요';
    else r = 'win', why = '상대가 나갔어요';
  } else if (iDied || (o.final && o.final.died)) {
    theirs = o.final ? o.final.score : o.live ? o.live.score : null;
    if (iDied && !(o.final && o.final.died)) r = 'lose', why = '내가 먼저 목숨을 다 썼어요';
    else if (!iDied) r = 'win', why = `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요`;
    else {
      r = roomOutcome('versus', mine, theirs).result;
      why = '둘 다 쓰러져서 점수로';
    }
  } else if (o.final) {
    box.innerHTML = `<div class="room-word win">둘 다 깼어요! 🎉</div><div class="room-why">다른 곡으로 ${round + 1}곡째 준비 중…</div>
      <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${escapeHtml(o.name)}<b>${fmt(o.final.score)}</b></span></div>`;
    return;
  } else {
    box.innerHTML = `<div class="room-word">${escapeHtml(o.name)} 님 아직 치는 중… ${o.live ? Math.round((o.live.progress || 0) * 100) + '%' : ''}</div><div class="room-why">상대도 깨면 다른 곡이 바로 이어져요</div>`;
    return;
  }
  const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' };
  const name = o && o.name ? escapeHtml(o.name) : '상대';
  const html = `<div class="room-word ${r}">${word[r]}</div><div class="room-why">${why} · ${round}곡째에서 끝 (${round - 1}곡 같이 깸)</div>
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>VS</span><span>${name}<b>${theirs == null ? '-' : fmt(theirs)}</b></span></div>`;
  rush.over = { res, html };
  box.innerHTML = html + acts;
  if (c.active) c.leave(); // 판이 끝났으니 방에서 나옴
}
async function rushNext() {
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  refreshTitle();
  openRoom();
  rushGo();
}
// ----- 👫 친구 대결 방 (코드로 만들고 들어가기) -----
function renderFriendRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  // 둘 다 준비 → 새 판 시작 (서버가 정한 시각에)
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      // 개인전 + 방장이 '무제한'을 켰으면 서바이벌 (곡이 끝나도 둘 다 살아 있으면 끝없이 빨라짐). 아니면 원래 곡으로 점수 승부
      rk.game = null;
      if (room.pub === 'rush') {
        stopWaitTimer();
        startLevel(room.level, { room: { startAt, mode: 'versus', round: room.round, rush: true } });
        return;
      }
      startLevel(room.mode === 'versus' && room.endless ? levelSurvivalId(room.level) : room.level, { room: { startAt, mode: room.mode, round: room.round } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
  // 🎲 랜덤 대결은 대기실 없음 (붙으면 바로 시작)
  if (room.pub === 'rush') {
    if (c.waiting && !$('#modal-room').hidden) roomPanel('wait');
    return;
  }
  // 빠른 대결: 아직 상대가 없으면 '찾는 중' 화면
  if (c.waiting) {
    roomUi.wasWaiting = true;
    roomPanel('wait');
    return;
  }
  if (roomUi.wasWaiting) {
    roomUi.wasWaiting = false;
    if (c.other) toast(`상대를 찾았어요! '준비!'를 누르면 시작해요`, 2800);
  }
  stopWaitTimer();
  roomPanel('lobby');
  const pub = !!room.pub;
  $('#room-code-show').textContent = room.code;
  // 빠른 대결 방은 코드·모드·곡 고르기 없음 (곡은 무작위)
  $('#room-code-box').hidden = pub;
  $('#room-mode').hidden = pub;
  $('#room-level').closest('.field').hidden = pub;
  const lk = $('#room-link');
  lk.hidden = !c.other;
  lk.classList.toggle('on', c.realtime);
  lk.textContent = c.realtime ? '⚡ 실시간 연결됨 — 점수가 바로바로 보여요' : '🔄 실시간 연결 중… (안 되면 조금 늦게 보여요)';
  const host = c.isHost;
  // 개인전 규칙: 점수 승부 / 💎 무제한(서바이벌) — 방장이 고름 (빠른 대결 방도)
  const versus = room.mode === 'versus';
  $('#room-rule').hidden = !versus;
  $('#room-rule-note').hidden = !versus;
  $$('#room-rule [data-rule]').forEach((b) => {
    const on = (b.dataset.rule === 'endless') === !!room.endless;
    b.setAttribute('aria-pressed', String(on));
    b.disabled = !host && !on;
  });
  $('#room-rule-note').textContent = room.endless
    ? `💎 무제한: 곡이 끝나도 둘 다 살아 있으면 끝없이 빨라져요. 먼저 쓰러지면 져요${host ? '' : ' (방장이 골라요)'}`
    : `🏆 점수 승부: 곡이 끝났을 때 점수가 높으면 이겨요. 먼저 쓰러지면 바로 져요${host ? '' : ' (방장이 골라요)'}`;
  $$('#room-mode [data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === room.mode));
    b.disabled = !host && b.dataset.mode !== room.mode;
  });
  const sel = $('#room-level');
  const opts = LEVELS.filter((lv) => !lv.long).map((lv) => {
    const ok = lv.id <= FREE_UPTO || isConfirmed() || freePass();
    return `<option value="${lv.id}"${ok ? '' : ' disabled'}>${levelLabel(lv)} · ${lv.name}${ok ? '' : ' (잠김)'}</option>`;
  }).join('');
  if (sel.dataset.sig !== opts) {
    sel.innerHTML = opts;
    sel.dataset.sig = opts;
  }
  if (document.activeElement !== sel) sel.value = String(room.level);
  sel.disabled = !host;
  $('#room-level-note').textContent = host ? '(방장이 골라요)' : '(방장이 고른 곡)';
  const me = c.me;
  const other = c.other;
  $('#room-players').innerHTML = ['a', 'b']
    .map((s) => {
      const p = room.players[s];
      if (!p) return `<div class="room-player empty"><b>빈 자리</b><small>친구를 기다려요…</small></div>`;
      const mine = s === c.slot;
      const lost = !mine && p.ago > 15000;
      const lastRes = p.final ? `<span class="last">지난 판 ${fmt(p.final.score)}점</span>` : '';
      return `<div class="room-player ${mine ? 'me' : ''}"><b>${escapeHtml(p.name)}${mine ? ' (나)' : ''}</b>
        <small>${s === room.host ? '👑 방장 · ' : ''}${p.part === 'piano' ? '🎹 피아노' : '🥁 드럼'}</small><br>
        <span class="rdy ${p.ready ? 'on' : ''}">${lost ? '연결 끊김?' : p.ready ? '준비 완료' : '준비 전'}</span>${lastRes}</div>`;
    })
    .join('');
  $('#room-ready').textContent = me && me.ready ? '준비 취소' : '준비!';
  $('#room-hint').textContent = !other
    ? `친구에게 코드 ${room.code} 를 알려 주세요. 들어오면 같이 '준비!'`
    : pub && !(me && me.ready) && !other.ready
      ? `${other.name} 님과 붙었어요! 둘 다 '준비!'를 누르면 시작 (곡은 무작위)`
    : me && me.ready && !other.ready
      ? `${other.name} 님이 준비하면 바로 시작해요`
      : !(me && me.ready) && other.ready
        ? `${other.name} 님은 준비 완료! '준비!'를 누르면 시작해요`
        : room.mode === 'team'
          ? '팀전: 둘의 점수를 합쳐요. 피아노 파트는 곧 나와요!'
          : room.endless
            ? '💎 무제한 서바이벌: 먼저 목숨을 다 쓰면 져요!'
            : '개인전: 같은 곡을 동시에 치고 점수로 승부!';
}
async function roomCreate() {
  const name = $('#room-name').value.trim();
  if (!name) return toast('이름을 적어 주세요');
  save('roomName', name);
  try {
    roomUi.round = 0;
    await state.roomClient.create(name, roomUi.newMode, 1);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
async function roomJoin() {
  const name = $('#room-name').value.trim();
  const code = $('#room-code').value.replace(/\D/g, '');
  if (!name) return toast('이름을 적어 주세요');
  if (code.length !== 4) return toast('코드 4자리를 적어 주세요');
  save('roomName', name);
  try {
    roomUi.round = 0;
    await state.roomClient.join(code, name);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
async function roomReady() {
  const c = state.roomClient;
  if (!c.active) return;
  const want = !(c.me && c.me.ready);
  if (want && needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => openRoom() });
    return;
  }
  // 소리는 사용자가 누를 때만 켤 수 있어서 '준비' 때 미리 켜 둠 (시작은 타이머로)
  if (want) await audio.unlock();
  c.send({ ready: want }, true);
}
async function roomShare() {
  const c = state.roomClient;
  if (!c.active) return;
  const url = `${location.origin}/?room=${c.code}`;
  const text = `오케이스트라 대결 방에 들어와! 코드 ${c.code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '오케이스트라 대결', text, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('링크를 복사했어요! 친구에게 보내 주세요');
  } catch {
    toast(`코드 ${c.code} 를 친구에게 알려 주세요`, 3000);
  }
}
function renderFriendResult() {
  const c = state.roomClient;
  const box = $('#res-room');
  const res = state.lastResult;
  if (!res || !res.room) return;
  box.hidden = false;
  const o = c.other;
  const mine = res.score;
  const theirs = o && o.final ? o.final.score : null;
  const team = res.room.mode === 'team';
  const surv = !!levelSurvivalBase(res.levelId);
  const word = { win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' };
  let head;
  if ((surv ? !res.died : res.stopped) && (!c.active || !o || !o.final)) head = `<div class="room-word win">${word.win} ${c.active && o ? '' : '상대가 나갔어요'}</div>`;
  else if (!c.active) head = '<div class="room-word">방이 닫혔어요</div>';
  else if (!o) head = '<div class="room-word">친구가 나갔어요</div>';
  else if (theirs == null) head = `<div class="room-word">${escapeHtml(o.name)} 님 ${surv ? '결과 기다리는 중…' : '아직 치는 중… ' + (o.live ? Math.round((o.live.progress || 0) * 100) + '%' : '')}</div>`;
  else if (team) head = `<div class="room-word win">🤝 팀 점수 ${fmt(roomOutcome('team', mine, theirs).team)}</div>`;
  else if (surv || res.failed || res.stopped || o.final.died) {
    // 누가 목숨을 다 써서 판이 끝났으면 쓰러진 쪽이 짐 (서바이벌은 둘 다 쓰러지면 더 오래 버틴 쪽)
    const r = surv
      ? survivalOutcome({ died: !!res.died, survived: res.survived, score: mine }, { died: !!o.final.died, survived: o.final.survived, score: theirs })
      : !!res.failed !== !!o.final.died
        ? res.failed ? 'lose' : 'win'
        : roomOutcome('versus', mine, theirs).result;
    const why = r === 'win' ? `${escapeHtml(o.name)} 님이 먼저 목숨을 다 썼어요` : r === 'lose' ? '내가 먼저 목숨을 다 썼어요' : '';
    head = `<div class="room-word ${r}">${word[r]}</div>${why ? `<div class="room-why">${why}</div>` : ''}`;
  } else {
    const r = roomOutcome('versus', mine, theirs).result;
    head = `<div class="room-word ${r}">${{ win: '승리! 🎉', lose: '아쉽게 패배…', draw: '무승부!' }[r]}</div>`;
  }
  const other = o ? `${escapeHtml(o.name)}<b>${theirs == null ? (o.live ? fmt(o.live.score) : '-') : fmt(theirs)}</b>` : '-';
  box.innerHTML = `${head}
    <div class="room-row"><span>나<b>${fmt(mine)}</b></span><span>${team ? '+' : 'VS'}</span><span>${other}</span></div>
    <div class="room-acts"><button class="btn btn-primary" data-action="room-again">${c.room && c.room.pub ? '이 상대와 한 판 더' : '한 판 더'}</button>${c.room && c.room.pub ? '<button class="btn btn-hot" data-action="room-next">새 상대 찾기</button>' : ''}<button class="btn btn-ghost" data-action="room-leave">방 나가기</button></div>`;
}
async function roomAgain() {
  const c = state.roomClient;
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  if (c.active) await c.again();
  openRoom();
}

/** 결과 화면: 랭킹전 한 판 더 */
async function roomNext() {
  if (state.roomClient.active) await state.roomClient.leave();
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  refreshTitle();
  rankedGo();
}
async function roomLeave() {
  stopWaitTimer();
  if (state.roomClient.active) await state.roomClient.leave();
  roomUi.round = 0;
  document.body.classList.remove('room-game');
  if ($('#screen-result').classList.contains('in-room')) {
    $('#screen-result').classList.remove('in-room');
    $('#res-room').hidden = true;
    refreshTitle();
    show('screen-title');
    openRoom();
    return;
  }
  roomPanel('entry');
}
async function roomAgain() {
  const c = state.roomClient;
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  if (c.active) await c.again();
  openRoom();
}

/** 랭킹전 판을 중간에 그만둠 → 진 판 (실시간은 방을 나가면 서버가 처리) */
function rankedQuit() {
  const g = rk.game;
  rk.game = null;
  if (!g) return;
  if (g.kind === 'live') state.roomClient.leave();
  else state.api.ranked({ action: 'result', kind: 'ghost', quit: true, gid: g.gid, levelId: g.levelId }).catch(() => {});
  rk.infoAt = 0;
  toast('랭킹전을 그만둬서 진 판이 됐어요', 2600);
}

// ---------------- 📲 홈 화면에 추가 (앱처럼) ----------------
// 안드로이드 크롬은 설치 창을 바로 띄울 수 있음 (beforeinstallprompt). 아이폰은 안내만
let installPrompt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const phoneOs = () => (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : '');
function initA2hs() {
  // 이미 홈 화면 아이콘으로 열었으면 버튼 숨김
  if (isStandalone()) {
    $('#btn-a2hs').hidden = true;
    $('#btn-a2hs').parentElement.classList.add('two');
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('#a2hs-install').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('#a2hs-install').hidden = true;
    closeModal('modal-a2hs');
    toast('홈 화면에 추가됐어요! 이제 아이콘으로 바로 들어와요');
  });
}
function openA2hs() {
  const os = phoneOs();
  $('#a2hs-tip-inapp').hidden = !isInApp();
  $('#a2hs-install').hidden = !installPrompt;
  // 내 폰 안내를 맨 위에 + 강조
  $$('#modal-a2hs .a2hs-os').forEach((el) => {
    el.classList.toggle('me', el.dataset.os === os);
    el.style.order = '';
  });
  const box = $('#modal-a2hs .sheet');
  const mine = os && $(`#modal-a2hs .a2hs-os[data-os="${os}"]`);
  if (mine) box.insertBefore(mine, box.querySelector('.a2hs-os'));
  openModal('modal-a2hs');
}
async function a2hsInstall() {
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null;
  $('#a2hs-install').hidden = true;
  try {
    await p.prompt();
  } catch {}
}

// ---------------- 업데이트 소식 · 건의하기 ----------------
function refreshNewsDot() {
  $('#news-dot').hidden = load('newsSeen', '') === LATEST_NEWS;
}
function openNews() {
  const seen = load('newsSeen', '');
  const seenIdx = NEWS.findIndex((n) => n.id === seen);
  $('#news-list').innerHTML = NEWS.map(
    (n, i) => `<article class="news-item ${seenIdx < 0 ? (i === 0 ? 'new' : '') : i < seenIdx ? 'new' : ''}">
      <h4>${n.title} <small>${n.date}</small>${(seenIdx < 0 ? i === 0 : i < seenIdx) ? '<em>NEW</em>' : ''}</h4>
      <ul>${n.items.map((t) => `<li>${t}</li>`).join('')}</ul></article>`
  ).join('');
  save('newsSeen', LATEST_NEWS);
  refreshNewsDot();
  openModal('modal-news');
}
const suggestState = { kind: 'song', sending: false };
function openSuggest() {
  if (followGated()) {
    openVerify(null, { label: '💬 건의하기는 팔로워만', then: openSuggest });
    return;
  }
  $('#suggest-text').value = load('suggestDraft', '');
  $('#suggest-contact').value = load('suggestContact', '');
  $('#suggest-count').textContent = `${[...$('#suggest-text').value].length} / 500`;
  // 자주 묻는 질문이 먼저 보이게 입력칸에 바로 포커스 주지 않음(폰 자판이 가림)
  openModal('modal-suggest');
}
async function sendSuggest() {
  const text = $('#suggest-text').value.trim();
  if ([...text].length < 2) {
    toast('내용을 조금만 더 적어 주세요');
    return;
  }
  if (suggestState.sending) return;
  suggestState.sending = true;
  $('#suggest-send').disabled = true;
  try {
    const contact = $('#suggest-contact').value.trim();
    await state.api.suggest(suggestState.kind, text, contact);
    if (contact) save('suggestContact', contact);
    save('suggestDraft', '');
    $('#suggest-text').value = '';
    closeModal('modal-suggest');
    toast('고마워요! 건의가 잘 전달됐어요 💌', 2600);
  } catch (e) {
    toast(e.status === 429 ? '조금 있다가 다시 보내 주세요 (1시간에 5개까지)' : '보내지 못했어요. 잠시 뒤 다시 해 주세요', 2800);
  } finally {
    suggestState.sending = false;
    $('#suggest-send').disabled = false;
  }
}

const ACTIONS = {
  'room-open': () => openRoom(),
  'room-close': () => closeModal('modal-room'),
  'ranked-go': rankedGo,
  'rush-go': rushGo,
  'rush-next': rushNext,
  'room-create': roomCreate,
  'room-join': roomJoin,
  'room-ready': roomReady,
  'room-share': roomShare,
  'room-again': roomAgain,
  'room-leave': roomLeave,
  'room-next': roomNext,
  'news-open': openNews,
  'shop-open': () => openShop(),
  'close-shop': () => closeShop(),
  'close-shopitem': () => closeShopPreview(),
  'a2hs-open': openA2hs,
  'close-a2hs': () => closeModal('modal-a2hs'),
  'a2hs-install': a2hsInstall,
  'close-news': () => closeModal('modal-news'),
  // 🚨 긴급 공지 (새 주소 이사)
  'move-open': openMove,
  'close-move': () => closeModal('modal-move'),
  'move-ok': () => {
    save('moveNoticeOk', true);
    closeModal('modal-move');
    refreshMoveBtn();
  },
  'move-restore': () => {
    closeModal('modal-move');
    openVerify(null, { restore: true });
  },
  // 📮 기록 되찾기 요청
  'req-open': () => {
    closeModal('modal-move');
    closeModal('modal-verify');
    openReq();
  },
  'close-req': () => closeModal('modal-req'),
  'req-send': () => sendReq(),
  'req-check': () => checkReq({ manual: true }),
  'move-copy': async () => {
    const url = 'https://play.kongkong-drum.workers.dev';
    try {
      await navigator.clipboard.writeText(url);
      toast('새 주소를 복사했어요', 1600);
    } catch {
      toast(url, 3000);
    }
  },
  'move-a2hs': () => {
    closeModal('modal-move');
    document.querySelector('[data-action="a2hs-open"]').click();
  },
  'suggest-open': openSuggest,
  'maps-open': () => openMaps(),
  'mm-start': (el) => startMapMode(el.dataset.mm),
  'mm-close': () => closeModal('modal-mapmode'),
  // 🚧 맵 만들기 잠시 막음 (11-22 운영자 요청). 풀 땐 MAPMAKE_OFF=false + index.html #maps-make 의 disabled·문구 되돌리기
  'mapmake-open': () => (MAPMAKE_OFF ? toast('맵 만들기는 잠시 쉬어요', 1600) : openMapMake()),
  'mk-bpm': (el) => {
    mk.bpm = Math.max(MAP_LIMITS.minBpm, Math.min(MAP_LIMITS.maxBpm, mk.bpm + Number(el.dataset.d)));
    mkSave();
    mkRender();
  },
  'mk-bar': (el) => {
    mk.bar = Math.max(0, Math.min(mk.mel.length - 1, mk.bar + Number(el.dataset.d)));
    mk.cur = 0;
    mkRender();
  },
  'mk-oct': (el) => {
    mk.oct = Math.max(2, Math.min(5, mk.oct + Number(el.dataset.d)));
    mkSave();
    mkRender();
  },
  'mk-baradd': () => mkBarOp('add'),
  'mk-barcopy': () => mkBarOp('copy'),
  'mk-barclear': () => mkBarOp('clear'),
  'mk-bardel': () => mkBarOp('del'),
  'mk-rest': () => mkRest(),
  'mk-back': () => mkBack(),
  'mk-play': () => mkPlayToggle(0),
  'mk-play-bar': () => mkPlayToggle(mk.bar),
  'mk-rec': () => recToggle(),
  'mk-drec': () => drecToggle(),
  'mk-undo': () => {
    if (!mkUndo) return;
    if (rec.on) recStop();
    if (drec.on) drecStop();
    mkStopPlay();
    Object.assign(mk, JSON.parse(mkUndo));
    mkUndo = null;
    $('#mk-undo').disabled = true;
    mkFixBars();
    mkRender();
    toast('되돌렸어요', 1200);
  },
  'mk-bardrumclear': () => {
    mkSnap();
    mk.drums[mk.bar] = '................';
    mk.drumsAuto = null;
    mkSave();
    mkRender();
  },
  'mk-try': () => mkPlay(false),
  'mk-upload': () => mkUpload(),
  'mk-new': () => mkNew(),
  'mk-capture': () => mkCapture(),
  'mk-transcribe': () => mkTranscribe(),
  'mk-score-make': () => mkScoreMake(),
  'mysong-open': () => openMysong(),
  'mysong-start': () => myStart(),
  'mysong-save': () => mySave(),
  'mysong-capture': () => myCapture(),
  'mysong-mul': (el) => myMul(Number(el.dataset.mul)),
  'close-suggest': () => closeModal('modal-suggest'),
  'suggest-send': sendSuggest,
  quickstart: () => tryStart(state.quickId ?? 1),
  'continue-ad': continueWithAd,
  'give-up': giveUp,
  levels: () => {
    if (state.game) state.game.stop();
    state.studio.active = false;
    $('#screen-game').classList.remove('studio-mode');
    renderer.studio = null;
    renderLevels();
    show('screen-levels');
  },
  home: () => {
    refreshTitle();
    show('screen-title');
  },
  today: () => tryStart(todayPick().id, { free: true }),
  'send-vs': sendChallenge,
  'close-vs': () => {
    state.vsIncoming = null;
    closeModal('modal-vs');
  },
  'accept-vs': () => {
    const ch = state.vsIncoming;
    closeModal('modal-vs');
    if (!ch) return;
    state.vs = ch;
    state.vsIncoming = null;
    tryStart(ch.levelId, { free: true });
  },
  'close-nick': () => closeModal('modal-nick'),
  'save-nick': () => {
    const nick = cleanName($('#nick-input').value);
    if (!nick) {
      toast('이름을 한 글자 이상 써 주세요');
      return;
    }
    save('nick', nick);
    closeModal('modal-nick');
    shareChallenge(nick);
  },
  'tune-sync': () => {
    const b = $('.res-tune');
    if (!b) return;
    state.settings.offsetMs = clampOffset(Number(b.dataset.offset));
    saveSettings(state.settings);
    save('calibrated', true);
    b.remove();
    toast(`박자 보정 ${state.settings.offsetMs > 0 ? '+' : ''}${state.settings.offsetMs}ms 저장! 다시 해 보세요`, 2800);
  },
  ranking: () => {
    openRank('hall-stage');
  },
  'hall-photo': (a) => {
    hallPick = { season: Number(a.dataset.season), board: a.dataset.board, rank: Number(a.dataset.rank) };
    const f = $('#hall-photo-file');
    f.value = '';
    f.click();
  },
  'hall-msg': (a) => {
    const season = Number(a.dataset.season);
    const board = a.dataset.board;
    const rank = Number(a.dataset.rank);
    const h = ((lastHallData && lastHallData.hall) || []).find((x) => x.season === season && x.board === board && x.rank === rank);
    editHallMsg(season, board, rank, h && h.msg);
  },
  'hall-photo-del': async (a) => {
    if (!confirm('프로필 사진을 지울까요?')) return;
    try {
      await state.api.hallPhoto({ season: Number(a.dataset.season), board: a.dataset.board, rank: Number(a.dataset.rank), image: null });
      loadRank();
    } catch {
      toast('사진을 지우지 못했어요. 잠시 뒤 다시 해 주세요');
    }
  },
  settings: openSettings,
  pause: togglePause,
  resume: resumeGame,
  retry: () => {
    closeModal('modal-pause');
    closeModal('modal-continue');
    startLevel(state.levelId, { practice: state.practice });
  },
  'practice-open': () => {
    if (!canPractice(playable(state.levelId))) {
      toast('이 판은 연습 모드가 없어요. 일반 단계에서 해 보세요', 2600);
      return;
    }
    openModal('modal-practice');
  },
  'practice-close': () => closeModal('modal-practice'),
  'practice-go': (el) => {
    const rate = Number(el.dataset.rate) || 0.7;
    closeModal('modal-practice');
    closeModal('modal-pause');
    closeModal('modal-continue');
    startLevel(state.levelId, { practice: rate });
  },
  quit: () => {
    closeModal('modal-pause');
    // 🏆 랭킹전 판을 중간에 그만두면 진 판 / 친구 대결은 지금 점수로 끝낸 걸로 알림
    if (document.body.classList.contains('room-game')) {
      if (rk.game) rankedQuit();
      else if (state.roomClient.active && state.roomClient.room && state.roomClient.room.pub === 'rush') {
        state.roomClient.leave(); // 🎲 랜덤 대결을 그만두면 진 판 (상대는 내가 나간 걸 보고 이김)
        toast('랜덤 대결을 그만뒀어요', 2200);
      } else if (state.roomClient.active && state.game)
        state.roomClient.send({ final: { score: state.game.score, stars: 0, grade: 'F', failed: true, died: true, maxCombo: state.game.maxCombo, accuracy: 0 } }, true);
    }
    document.body.classList.remove('room-game');
    if (state.game) {
      const n = awardRunCoins(state.game);
      if (n > 0) toast(`코인 +${fmt(n)}`, 1800);
      state.game.stop();
    }
    if (state.levelId === MY_ID) {
      stopRecorder();
      openMysong();
      return;
    }
    if (state.levelId === UM_ID) return umQuit();
    renderLevels();
    show('screen-levels');
  },
  next: () => (typeof state.levelId === 'number' && nextOpenId(state.levelId) ? tryStart(nextOpenId(state.levelId)) : tryStart(ENDLESS_ID)),
  'submit-rank': () => {
    const id = state.lastResult && state.lastResult.levelId;
    openRank(id === ENDLESS_ID || typeof id === 'number' ? id : 1);
  },
  'close-join': () => closeModal('modal-join'),
  'rank-join': () => {
    closeModal('modal-rank');
    closeModal('modal-settings');
    askNickname(true);
  },
  'verify-open': () => openVerify(null),
  'verify-join': () => {
    closeModal('modal-verify');
    askNickname(true);
  },
  'close-verify': () => {
    state.verifyFor = null;
    closeModal('modal-verify');
  },
  share: shareResult,
  'close-rank': () => closeModal('modal-rank'),
  'close-settings': () => closeModal('modal-settings'),
  'close-share': () => closeModal('modal-share'),
  'studio-cover': () => studioCover(),
  'transfer-make': () => transferMake(),
  'restore-open': () => {
    closeModal('modal-settings');
    openVerify(null, { restore: true });
  },
  'transfer-take': () => transferTake(),
  'beat-pick': () => pickBeat(),
  'sync-detect': () => syncDetect(),
  'sync-cd': (el) => {
    const v = Math.max(0, Math.min(20, syncCountdown() + Number(el.dataset.step)));
    save('syncCountdown', v);
    $('#sync-cd').textContent = v ? `${v}초` : '없음';
  },
  'sync-calib': (el) => {
    const v = Math.max(-500, Math.min(500, syncCalib() + Number(el.dataset.step)));
    save('syncCalib', v);
    $('#sync-calib').textContent = `${v > 0 ? '+' : ''}${v}ms`;
  },
  'sync-listen': () => syncListen(),
  'beat-reroll': () => {
    saveBeatForm({ reroll: true });
    toast('패턴을 새로 뽑았어요', 1200);
  },
  'close-calibrate': () => !calib.required && closeModal('modal-calibrate'),
  calibrate: () => openCalibration(),
  'calib-done': () => {
    const after = calib.after;
    Object.assign(calib, { required: false, after: null });
    closeModal('modal-calibrate');
    if (after) after();
  },
  'calib-skip': () => {
    state.calibSkipped = true;
    const after = calib.after;
    Object.assign(calib, { required: false, after: null });
    closeModal('modal-calibrate');
    if (after) after();
  },
  'calib-start': startCalibration,
  logout: async () => {
    try {
      await state.api.logout();
    } catch {}
    state.me = { verified: false };
    closeModal('modal-settings');
    renderLevels();
    refreshTitle();
    toast('닉네임을 지웠어요');
  },
  studio: openStudio,
  'studio-start': studioStart,
  'studio-stop': studioStop,
  'studio-again': studioStart,
  'studio-save': studioSave,
  'close-studio-done': () => {
    closeModal('modal-studio-done');
    $('#screen-game').classList.remove('studio-mode');
    renderer.studio = null;
    openStudio();
  },
  'dismiss-inapp': () => {
    $('#inapp-note').hidden = true;
    save('inappDismissed', true);
  },
};

function bindActions() {
  $('#verify-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitVerify();
  });
  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitJoin();
  });
  document.addEventListener('click', (e) => {
    const newMode = e.target.closest('#room-mode-new [data-mode]');
    if (newMode) {
      roomUi.newMode = newMode.dataset.mode;
      $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === newMode)));
      return;
    }
    const ruleBtn = e.target.closest('#room-rule [data-rule]');
    if (ruleBtn) {
      if (state.roomClient.isHost) state.roomClient.send({ endless: ruleBtn.dataset.rule === 'endless' }, true);
      return;
    }
    const roomMode = e.target.closest('#room-mode [data-mode]');
    if (roomMode) {
      if (state.roomClient.isHost) state.roomClient.send({ mode: roomMode.dataset.mode }, true);
      return;
    }
    const kindBtn = e.target.closest('#suggest-kind [data-kind]');
    if (kindBtn) {
      suggestState.kind = kindBtn.dataset.kind;
      $('#suggest-note').hidden = suggestState.kind !== 'song';
      document.querySelectorAll('#suggest-kind [data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b === kindBtn)));
      return;
    }
    const modeBtn = e.target.closest('#level-mode [data-mode]');
    if (modeBtn) {
      save('levelMode', modeBtn.dataset.mode);
      renderLevels();
      return;
    }
    const lvBtn = e.target.closest('[data-level]');
    if (lvBtn) {
      const v = lvBtn.dataset.level;
      tryStart(/^\d+$/.test(v) ? Number(v) : v);
      return;
    }
    const sl = e.target.closest('[data-studio-level]');
    if (sl) {
      const v = sl.dataset.studioLevel;
      pickStudioLevel(/^\d+$/.test(v) ? Number(v) : v);
      $$('#studio-levels button').forEach((b) => b.setAttribute('aria-pressed', b === sl));
      return;
    }
    const sf = e.target.closest('#studio-format [data-format]');
    if (sf) {
      pickStudioFormat(sf.dataset.format);
      return;
    }
    const sm = e.target.closest('#studio-mode [data-mode]');
    if (sm) {
      state.studio.mode = sm.dataset.mode;
      $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b === sm));
      return;
    }
    const rm = e.target.closest('[data-rank-mode]');
    if (rm) {
      const want = rm.dataset.rankMode;
      if (want !== rankModeOf(state.rankLevel)) {
        state.rankLevel = want === 'hall' ? 'hall-stage' : want === 'endless' ? ENDLESS_ID : 1;
        renderRankTabs();
        loadRank();
      }
      return;
    }
    const tab = e.target.closest('[data-rank]');
    if (tab) {
      state.rankLevel = /^\d+$/.test(tab.dataset.rank) ? Number(tab.dataset.rank) : tab.dataset.rank;
      $$('#rank-tabs button').forEach((b) => b.setAttribute('aria-selected', b === tab));
      loadRank();
      return;
    }
    const a = e.target.closest('[data-action]');
    if (a && ACTIONS[a.dataset.action]) {
      e.preventDefault();
      // 이어하기 창이 막 뜬 직후에는 버튼 입력 무시 (이미 누르고 있던 손가락이 버튼을 치는 것 방지)
      if (a.closest('#modal-continue') && performance.now() - contOpenedAt < CONT_GUARD_MS) return;
      ACTIONS[a.dataset.action](a);
    }
  });
  // 모달 바깥 탭 → 닫기 (일시정지 모달 제외)
  $$('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target !== m || m.id === 'modal-pause' || m.id === 'modal-continue' || m.id === 'modal-ad' || (m.id === 'modal-calibrate' && calib.required)) return;
      m.hidden = true;
    })
  );
  // 결과 연출 중 화면을 누르면 바로 끝까지
  $('#screen-result').addEventListener('pointerdown', () => resultAnim.finish && resultAnim.finish());
  $('#beat-tap').addEventListener('pointerdown', beatTap);
  $$('[data-beat-mul]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#beat-bpm').value = Number($('#beat-bpm').value || 120) * Number(b.dataset.beatMul);
      saveBeatForm();
    })
  );
  ['#beat-bpm', '#beat-rounds', '#beat-title', '#beat-click'].forEach((sel) => $(sel).addEventListener('change', () => saveBeatForm()));
  // 박자 맞추기 형식 (레벨업 / 비트) · 비트 난이도: 고르면 바로 그걸로 선택
  $('#beat-style').addEventListener('click', (e) => {
    const b = e.target.closest('[data-beat-style]');
    if (!b) return;
    $$('#beat-style button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pickBeat();
  });
  $('#beat-diff').addEventListener('click', (e) => {
    const b = e.target.closest('[data-beat-diff]');
    if (!b) return;
    $$('#beat-diff button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pickBeat();
  });
  $('#sync-file').addEventListener('change', (e) => e.target.files[0] && syncPick(e.target.files[0]));
  $('#my-file').addEventListener('change', (e) => e.target.files[0] && myPick(e.target.files[0]));
  // 🎹 유저 맵
  $('#maps-sort').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]');
    if (!b) return;
    um.sort = b.dataset.sort;
    $$('#maps-sort button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    loadMaps();
  });
  $('#maps-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-map-act]');
    const card = b && b.closest('.map-card');
    if (card) mapAct(card.dataset.id, b.dataset.mapAct, b);
  });
  $('#mk-file').addEventListener('change', (e) => e.target.files[0] && mkPickFile(e.target.files[0]));
  $('#mk-score-file').addEventListener('change', (e) => {
    if (e.target.files[0]) mkPickScore(e.target.files[0]);
    e.target.value = '';
  });
  $('#mk-score-mel').addEventListener('change', mkScoreStartOpts);
  $('#mk-score-start').addEventListener('change', () => {
    mks.startTouched = true;
    mkScoreRec();
  });
  $('#mk-score-len').addEventListener('change', mkScoreRec);
  $('#hall-photo-file').addEventListener('change', (e) => hallPhotoPicked(e.target.files[0]));
  $('#gift-ok').addEventListener('click', giftOk);
  $('#gift-photo-btn').addEventListener('click', () => {
    const h = giftMode && giftMode.gift && giftMode.gift.hall;
    if (!h) return;
    hallPick = { season: h.season, board: h.board, rank: h.rank };
    const f = $('#hall-photo-file');
    f.value = '';
    f.click();
  });
  $('#gift-later').addEventListener('click', giftLater);
  $('#mk-name').addEventListener('change', () => {
    mk.name = $('#mk-name').value.trim();
    mkSave();
  });
  $('#mk-way').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-way]');
    if (!b) return;
    mk.way = b.dataset.way;
    mkSave();
    mkRender();
  });
  $('#mk-step').addEventListener('change', () => {
    mk.step = $('#mk-step').checked;
    mkSave();
    mkRender();
  });
  $('#mk-drum-more').addEventListener('toggle', () => mkGrid());
  $('#mk-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b || b.dataset.tab === mk.tab) return;
    if (rec.on) recStop();
    if (drec.on) drecStop();
    mk.tab = b.dataset.tab;
    mkSave();
    mkRender();
  });
  $('#mk-pads').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.kpad');
    if (!b) return;
    e.preventDefault();
    b.classList.remove('on');
    void b.offsetWidth;
    b.classList.add('on');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('on'), 450);
    padHit(b.dataset.inst);
  });
  $('#mk-pads').addEventListener('contextmenu', (e) => e.preventDefault());
  $('#mk-len').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-len]');
    if (!b) return;
    mk.len = Number(b.dataset.len);
    mkSave();
    mkRender();
  });
  $('#mk-auto').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-diff]');
    if (!b) return;
    mkSnap();
    mk.drumsAuto = b.dataset.diff;
    mkFixBars();
    mkRender();
    toast(mk.drumsAuto === 'song' ? '넣은 노래의 드럼 자리로 다시 채웠어요 (↩ 되돌리기 가능)' : '드럼을 자동으로 새로 채웠어요 (↩ 되돌리기 가능)', 1800);
  });
  $('#mk-keys').addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.mk-key');
    if (!k) return;
    e.preventDefault();
    k.classList.add('on');
    mkKeyDown(Number(k.dataset.midi), k);
  });
  // 건반에서 손 뗌: 녹음 중이면 음 길이가 정해짐
  const keyUp = () => {
    $$('#mk-keys .mk-key.on').forEach((x) => x.classList.remove('on'));
    for (const key of [...rec.down.keys()]) recUp(key);
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#mk-keys').addEventListener(ev, keyUp);
  $('#mk-grid').addEventListener('click', (e) => {
    const c = e.target.closest('.mk-cell');
    if (c) mkDrumTap(Number(c.dataset.step), c.dataset.inst);
  });
  // 드럼 칸 그림: 점을 누르면 지움, 빈 곳을 누르면 그 칸을 고름 (패드를 치면 거기에 들어감)
  $('#mk-droll').addEventListener('pointerdown', (e) => {
    if (drec.on) return;
    const r = e.currentTarget.getBoundingClientRect();
    const lx = 44;
    const x = e.clientX - r.left;
    if (x < lx) return void ((mk.dsel = null), mkDroll());
    const st = Math.max(0, Math.min(STEPS_PER_BAR - 1, Math.floor(((x - lx) / (r.width - lx)) * STEPS_PER_BAR)));
    const row = Math.max(0, Math.min(DROLL_ROWS.length - 1, Math.floor(((e.clientY - r.top) / r.height) * DROLL_ROWS.length)));
    const inst = { [CRASH]: 'C', [HAT]: 'H', [SNARE]: 'S', [KICK]: 'K' }[DROLL_ROWS[row][0]];
    const cells = [...(mk.drums[mk.bar] || '')];
    if (cells.length && drumCell(cells[st])[inst]) {
      cells[st] = toggleDrum(cells[st], inst);
      mk.drums[mk.bar] = cells.join('');
      mk.drumsAuto = null;
      mk.dsel = st;
      mkSave();
      mkRender();
      return;
    }
    mk.dsel = mk.dsel === st ? null : st;
    mkDroll();
  });
  $('#mk-roll').addEventListener('pointerdown', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mk.cur = Math.max(0, Math.min(STEPS_PER_BAR - 1, Math.floor(((e.clientX - r.left) / r.width) * STEPS_PER_BAR)));
    mkRender();
  });
  $('#my-diff').addEventListener('click', (e) => {
    const b = e.target.closest('[data-diff]');
    if (!b) return;
    my.diff = b.dataset.diff;
    save('myDiff', my.diff);
    $$('#my-diff button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });
  $('#my-from').addEventListener('click', (e) => {
    const b = e.target.closest('[data-from]');
    if (!b) return;
    my.from = b.dataset.from;
    $$('#my-from button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('#my-start-wrap').hidden = my.from !== 'pick';
  });
  $('#my-rec').addEventListener('change', (e) => (my.rec = e.target.checked));
  $('#quiz-bars').addEventListener('change', (e) => (state.studio.quizBars = Number(e.target.value)));
  $('#fail-secs').addEventListener('change', (e) => (state.studio.failSec = Number(e.target.value)));
  $('#calib-pad').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!audio.ctx) return;
    audio.kick(undefined, 0.6);
    if (calib.active) calib.taps.push(audio.heardTime(e.timeStamp));
  });
  // 오디오는 첫 터치에서 깨움 (iOS / 인앱 브라우저)
  const wake = () => audio.unlock().then(() => audio.loadPiano()).then(() => audio.orchOn && audio.loadOrch());
  window.addEventListener('pointerdown', wake, { once: true, capture: true });
  window.addEventListener('keydown', wake, { once: true, capture: true });
  // 폰이 소리를 멈췄으면(아이폰: 다른 앱 소리·화면 녹화·제어 센터·전화·알림 등) 다음 터치에서 다시 켬.
  //   iOS 는 터치 이벤트 안에서만 소리를 켤 수 있고, 다른 앱이 소리를 가져갔다 돌려주면 옛 엔진은 resume() 해도
  //   안 켜지거나 'running' 인데 시계가 멈춘 채로 남음 (곡이 '1' 에서 멈추던 것) → 그럴 땐 엔진을 새로 만들고
  //   게임은 멈췄던 자리부터 이어 감 (game.reanchor). 한 번 누를 때 여러 이벤트가 오니 1초에 한 번만
  const revive = () => {
    const ctx = audio.ctx;
    if (!ctx || ctx.state === 'closed') return;
    const g = state.game;
    // 일시정지·목숨 끝(이어하기 창·광고)은 일부러 소리를 멈춰 둔 것 → 여기서 켜면 곡이 혼자 흘러감 (광고 보는 동안 곡이 이어져서
    //   이어하자마자 죽던 것). 다시 켜는 건 게임의 resume() 이 함
    if (g && (g.state === 'paused' || g.state === 'dead')) {
      audio._visCheck = null;
      return;
    }
    const live = g && g.state === 'playing';
    let stuck = ctx.state !== 'running' || (live && g.state === 'playing' && audio.frozen);
    // 다른 앱에 갔다 돌아온 뒤 첫 터치: 'running' 이라는데 돌아온 뒤로 시계가 한 번도 안 갔으면 멈춘 것
    const vc = audio._visCheck;
    if (vc && performance.now() - vc.t > 150) {
      audio._visCheck = null;
      if (!stuck && ctx.currentTime === vc.ct) {
        stuck = true;
        audio._resumeFailed = true;
      }
    }
    if (!stuck) return;
    if (performance.now() - (audio.rebuiltAt || 0) < 1000) return;
    // 판 진행 중이거나 iOS 가 '끊김(interrupted)' 으로 잡고 있으면 엔진을 새로. 그 밖엔 그냥 다시 켜 봄
    if ((g && g.state === 'playing') || ctx.state === 'interrupted' || audio._resumeFailed) {
      audio.rebuild();
      audio._resumeFailed = false;
      if (live) g.reanchor();
      return;
    }
    audio.resetClock();
    const p = ctx.resume();
    if (p && p.then) {
      const t = setTimeout(() => (audio._resumeFailed = ctx.state !== 'running'), 500);
      p.then(() => clearTimeout(t), () => (audio._resumeFailed = true));
    }
  };
  for (const ev of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'keydown']) window.addEventListener(ev, revive, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audio.ctx && audio.ctx.state === 'running') audio._visCheck = { ct: audio.ctx.currentTime, t: performance.now() };
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game) awardRunCoins(state.game, false); // 🪙 앱을 닫아 버려도 그때까지 번 코인은 남게
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        $('#pause-stuck').hidden = true;
    $('#pause-title').textContent = '잠깐 쉬어요';
        openModal('modal-pause');
      }
    } else {
    }
  });
  let rz;
  window.addEventListener('resize', () => {
    canvasRect = null;
    clearTimeout(rz);
    rz = setTimeout(() => {
      if ($('#screen-game').classList.contains('active')) renderer.resize();
    }, 120);
  });
}

// ---------------- 시작 ----------------
async function boot() {
  initA2hs(); // 설치 창(beforeinstallprompt)은 일찍 올 수 있어서 맨 먼저
  $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon, el.hasAttribute('data-e'))));
  // 화면 글의 이모지 → 직접 그린 아이콘 (토스트·업데이트 소식 등 나중에 붙는 글까지)
  watchEmoji();
  Object.assign(state.studio, load('studio', {}), { active: false });
  buildTitle();
  bindActions();
  bindGameInput();
  coinsInit({ changed: refreshCoins });
  bindSettings();
  applyLite();
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  audio.orchOn = state.settings.band !== 'piano';
  audio.prefetchPiano().then(() => audio.orchOn && audio.prefetchOrch());
  refreshToday();

  if (isInApp() && !load('inappDismissed', false)) $('#inapp-note').hidden = false;

  state.api = await createApi(CONFIG);
  state.roomClient = new RoomClient({
    api: state.api,
    onUpdate: renderRoom,
    onLink: () => renderRoom(state.roomClient.room),
    onError: (e) => toast(roomErrText(e), 3000),
    onGone: () => {
      roomUi.round = 0;
      toast('방이 닫혔어요', 2400);
      if (!$('#modal-room').hidden) openRoom();
      if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
    },
  });
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'instagramHandle', 'siteUrl', 'freePassUntil', 'shopOpen']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
    if (sc.freePassUntil !== undefined) save('freePassUntil', Number(sc.freePassUntil) || 0);
  } catch {}
  const g = devParam('gate');
  if (g === 'open' || g === 'soft') state.cfg.gateMode = g;
  try {
    refundLegacyLocal();
  } catch {}
  initAds(state.cfg);
  initTracker({ enabled: state.api.mode === 'server' });
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  refreshNewsDot();
  refreshMoveBtn();
  checkReq();
  // 서버가 늦게 깨서 서버 없는 모드로 시작했으면 몇 초 뒤 한 번 더 붙어 봄
  if (state.api.mode !== 'server') setTimeout(() => reconnectServer({ force: true }), 4000);
  // 옛 주소에서 넘어옴 (/?t=123456): 그쪽 기록·로그인을 자동으로 가져옴
  const bridgeCode = params.get('t');
  if (/^\d{6}$/.test(bridgeCode || '')) {
    try {
      const u = new URL(location.href);
      u.searchParams.delete('t');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    takeBridgeCode(bridgeCode);
  }
  $('#room-level').addEventListener('change', (e) => {
    if (state.roomClient.isHost) state.roomClient.send({ level: Number(e.target.value) }, true);
  });
  // 🖼 릴스 썸네일 만들기 (운영자 전용): /?thumb=okay 로 들어오면 이 기기에서 켜지고 영상 찍기 화면으로, ?thumb=off 면 끔
  const thumb = params.get('thumb');
  if (thumb === 'okay' || thumb === 'off') {
    save('thumbTool', thumb === 'okay');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('thumb');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (thumb === 'okay') setTimeout(() => {
      openStudio();
      toast('🖼 릴스 썸네일 칸이 켜졌어요 (영상 찍기 화면 맨 아래)', 3000);
    }, 300);
  }
  // 🛒 운영자 시험: /?shoptest=okay 면 이 기기에서만 상점 물건을 전부 써 봄 (산 것으로 안 침, 서버 안 감), ?shoptest=off 면 끔
  const shopTest = params.get('shoptest');
  if (shopTest === 'okay' || shopTest === 'off') {
    save('shopTest', shopTest === 'okay');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('shoptest');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    applyDeco();
    setTimeout(() => {
      if (shopTest === 'okay') {
        openShop();
        toast('🛒 이 기기에서 상점 물건을 전부 써 볼 수 있어요 · 설정 → 꾸미기에서 바꿔요', 3600);
      } else toast('🛒 상점 시험 모드를 껐어요', 2000);
    }, 300);
  }
  // 친구가 보낸 방 링크 (/?room=1234)
  if (/^\d{4}$/.test(params.get('room') || '')) {
    const code = params.get('room');
    try {
      const u = new URL(location.href);
      u.searchParams.delete('room');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    setTimeout(() => openRoom(code), 400);
  }
  $('#suggest-text').addEventListener('input', () => {
    const v = $('#suggest-text').value;
    $('#suggest-count').textContent = `${[...v].length} / 500`;
    save('suggestDraft', v);
  });
  renderLevels();
  // 운영자가 팔로우 확인이 안 돼서 랭킹에서 내린 사람: 들어오자마자 알림 (아이디를 다시 넣을 기회)
  if (state.me.hidden) setTimeout(() => askNickname(true), 600);
  // 앱으로 돌아올 때 인증 상태 다시 받기 (운영자가 '확인함'을 누르면 새로고침 없이 바로 열림)
  let meCheckedAt = Date.now();
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    if (state.api.mode !== 'server') return void reconnectServer();
    // 앱으로 자주 왔다 갔다 해도 10분에 한 번만, 이미 인증 끝난 사람은 안 물어봄 (요청 수 아끼기)
    if (state.me.confirmed && !state.me.hidden && !load('recoverReq', null)) return;
    if (Date.now() - meCheckedAt < 600 * 1000) return;
    meCheckedAt = Date.now();
    if (load('recoverReq', null)) return void checkReq();
    try {
      const me = await state.api.me();
      if (!me || (me.confirmed === state.me.confirmed && me.checked === state.me.checked && !!me.hidden === !!state.me.hidden)) return;
      const nowConfirmed = me.confirmed && !state.me.confirmed;
      state.me = me;
      refreshTitle();
      renderLevels();
      if (nowConfirmed) toast(`✅ 팔로워 인증 완료! ${CONFIRM_WHAT()}가 열렸어요`, 3400);
    } catch {}
  });
  if (params.get('screen') === 'levels') show('screen-levels');
  // DM 속 링크(/?k=암호)로 들어옴 → 인증 창에 암호를 미리 채워서 염 (주소에선 지움)
  if (params.get('k')) {
    const k = params.get('k').slice(0, 40);
    try {
      const u = new URL(location.href);
      u.searchParams.delete('k');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (!isConfirmed()) setTimeout(() => openVerify(null, { pass: k }), 300);
  }
  // 친구가 보낸 1:1 도전장 링크로 들어옴
  if (params.get('vs')) {
    const ch = decodeChallenge(params.get('vs'));
    try {
      const u = new URL(location.href);
      u.searchParams.delete('vs');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    if (ch) openIncomingVs(ch);
    else toast('도전장 링크가 깨졌어요. 다시 받아 주세요!', 3000);
  }
  document.documentElement.dataset.api = state.api.mode;
  if (devParam('debug') === '1') window.__kk = { state, audio, renderer, startLevel };
}

boot();
