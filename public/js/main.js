// 오케이스트라 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

import {
  LEVELS, getLevel, levelLanes, DIFFICULTY_WORDS, STAR_RULES,
  ENDLESS_ID, LAST_LEVEL_ID, MAIN_LEVELS, levelLabel, makeEndless, isUnlocked, unlockHint, nextChallenge, DIAMOND_RULES, roundInfo,
  ENDLESS_FROM, LEVEL_ENDLESS_STEP, makeLevelEndless, levelEndlessBase, levelEndlessId, needsVerify, FREE_UPTO, isClosed, prevOpenId, nextOpenId,
  STUDIO_LEVELS, getStudioLevel, levelSurvivalId, levelSurvivalBase, COUNT_IN_BARS,
  BEAT_ID, makeBeatReel, beatOpts, beatSeconds, BEAT_MAX_ROUNDS, BEAT_STYLES, BEAT_DIFFS, beatStyleName,
  QUIZ_BARS, quizId, isQuizId, makeQuizLevel, quizSeconds,
} from './charts.js';
import { AudioEngine, playMetronome } from './audio.js';
import { Renderer } from './render.js';
import { Game, MAX_LIVES, LIFE_REGEN_COMBO, REVIVE_LIVES } from './game.js';
import { initAds, showRewarded } from './ads.js';
import { createApi } from './api.js';
import { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay } from './track.js';
import { CONFIG } from './config.js';
import { mascotSVG, stickSVG, bassDrumSVG, snareSVG } from './mascot.js';
import { groupStarting } from './themes.js';
import { NEWS, LATEST_NEWS } from './news.js';
import { RoomClient, roomOutcome, survivalOutcome } from './room.js';
import { makeReelCover } from './cover.js';
import { detectBeat, monoOf } from './beatsync.js';
import { loadSettings, saveSettings, loadBests, saveBest, load, save, remove, migrateLevelOrder } from './storage.js';

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
function reconnectServer({ force = false } = {}) {
  if (state.api && state.api.mode === 'server') return Promise.resolve(true);
  if (CONFIG.apiMode === 'mock') return Promise.resolve(false);
  if (!force && Date.now() - reconnectTriedAt < 30 * 1000) return Promise.resolve(false);
  reconnectTriedAt = Date.now();
  reconnecting ??= (async () => {
    try {
      const api = await createApi({ ...CONFIG, apiMode: 'auto' });
      if (api.mode !== 'server') return false;
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
  return !!(state.api && state.api.mode === 'server' && isVerified() && state.me.confirmed);
}
const CONFIRM_WHAT = VERIFY_WHAT;
/** 인증 완료 전엔 잠긴 것 (4단계부터, 무제한 전부). 개발용 ?gate=open 에선 풀림 */
const closedLocked = (id) => state.cfg.gateMode !== 'open' && isClosed(id) && !isConfirmed();
/** 인스타 댓글에 쓸 키워드 (키티챗 자동 DM 키워드와 같아야 함) */
const VERIFY_KEYWORD = '쿵';
/** 🆓 암호 없이 임시 인증 기간 (인스타 DM 이 막혔을 때, 서버 설정 freePassUntil). 끝나면 팔로워 암호로 다시 인증 */
const freePass = () => !!(state.cfg.freePassUntil && Date.now() < state.cfg.freePassUntil);
const freePassDay = () => {
  const d = new Date(state.cfg.freePassUntil);
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
  $('#verify-mascots').innerHTML = mascotSVG('kong', 'cheer') + mascotSVG('jjak', done ? 'cheer' : 'idle');
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
  if (id === BEAT_ID) return withSync(makeBeatReel(load('beatReel', null) || {}));
  if (isQuizId(id)) return makeQuizLevel(id);
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
  const drummer = scene.querySelector('.kit-drummer');
  drummer.innerHTML = mascotSVG('kong', 'idle');
  scene.querySelector('.kit-stick').innerHTML = stickSVG();
  scene.querySelector('.kit-bass').innerHTML = bassDrumSVG();
  scene.querySelector('.kit-snare').innerHTML = snareSVG();
  scene.querySelector('.kit-crash').innerHTML =
    '<svg viewBox="0 0 120 120"><path d="M60 30 L60 120" stroke="#2B1D3A" stroke-width="7"/><path d="M60 30 L60 120" stroke="#D9D6E6" stroke-width="3"/><ellipse cx="60" cy="28" rx="56" ry="12" fill="#F4C84A" stroke="#2B1D3A" stroke-width="4" transform="rotate(-12 60 28)"/></svg>';
  let t;
  scene.querySelectorAll('[data-lane]').forEach((el) => {
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      await audio.unlock();
      const kick = el.dataset.lane === '0';
      if (kick) audio.kick();
      else audio.snare();
      const cls = kick ? 'hit-kick' : 'hit-snare';
      scene.classList.remove(cls);
      void scene.offsetWidth;
      scene.classList.add(cls);
      drummer.innerHTML = mascotSVG('kong', 'hit');
      clearTimeout(t);
      t = setTimeout(() => {
        drummer.innerHTML = mascotSVG('kong', 'idle');
        scene.classList.remove('hit-kick', 'hit-snare');
      }, 170);
    });
  });
  refreshQuick();
}

/** '바로 시작': 릴스 링크(?level=N)로 온 곡이 열려 있으면 그 곡, 아니면 아직 안 깬 첫 단계 */
function refreshQuick() {
  const q = getLevel(params.get('level'));
  const id = q && !progressLocked(q.id) && !closedLocked(q.id) ? q.id : nextChallenge(loadBests());
  state.quickId = id;
  $('[data-action="quickstart"]').innerHTML =
    id === ENDLESS_ID ? `${icon('play')} 바로 시작 <small>무제한 모드</small>` : `${icon('play')} 바로 시작 <small>${levelLabel(id)}</small>`;
}

function refreshToday() {
  const lv = todayLevel();
  const best = loadBests()[lv.id];
  $('#today-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#today-sub').textContent = best ? `내 최고 ${fmt(best.score)}점 · 친구에게 1:1 도전장 ⚔️` : `${levelLabel(lv)} · 점수 내고 친구에게 1:1 도전장 ⚔️`;
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
  return load('levelMode', 'normal') === 'endless' ? 'endless' : 'normal';
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
  $('#levels-foot').innerHTML = `${isConfirmed() ? '' : `🔒 💎 무제한 모드는 <b>${igWho()} 팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}12단계를 깨면 그리그 무제한이 열려요. 목숨이 다 떨어질 때까지 계속!<br>단계별 무제한은 그 단계를 깨면 열려요.<br>💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어`;
}

function renderLevels() {
  const bests = loadBests();
  const mode = levelMode();
  $$('#level-mode button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  if (mode === 'endless') {
    renderEndlessLevels(bests);
    return;
  }
  // 🎄 크리스마스 이벤트 곡은 맨 위에
  const list = [...LEVELS.filter((l) => l.xmas), ...LEVELS.filter((l) => !l.xmas)].map((lv) => {
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
    return `${groupHeadHTML(lv.id)}<button class="level-card ${locked ? 'locked' : ''} ${lv.boss ? 'boss' : ''} ${lv.xmas ? 'xmas' : ''}" data-level="${lv.id}">
      <div class="lv">${lv.xmas ? `<span class="ev">${icon('tree', true)}<small>이벤트</small></span>` : `<span>${lv.id}<small>단계</small></span>`}</div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
  });
  // 맨 아래: 그리그 무제한 모드 (12단계 깨면 열림)
  list.push(grieggCardHTML(bests));
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  $('#levels-foot').innerHTML = `${isConfirmed() ? '' : `🔒 1~${FREE_UPTO}단계는 맛보기! ${FREE_UPTO + 1}단계부터와 💎 무제한은 <b>팔로워 인증</b>을 받으면 열려요. <button class="link" data-action="verify-open">팔로워 인증</button><br>`}앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요.<br><b>같은 난이도를 하나 깨면 그 난이도는 전부 열려요</b> (예: 지옥 하나 깨면 지옥 전부)<br>별 3개: ${STAR_RULES[0].text}`;
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
const CANVAS_TEXT = '쿵짝챙츠둥왼쪽오른엄지킥스네어하이햇크래시탐연타황금콩다가온선에닿을때그줄을톡여기눌러도OK키클릭NEW노을피크닉네온시티콘서트홀블랙스테이지용암보스전오로라설원우주무대크리스마스마을GROOVECOMBO점';
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
function practiceLevel(lv, rate) {
  return { ...lv, bpm: Math.round(lv.bpm * rate * 10) / 10, practice: rate };
}
/** 연습으로 칠 수 있는 판인가 (일반 단계만. 무제한·멀티·영상 찍기 X) */
const canPractice = (lv) => !!lv && !lv.challenge && !lv.studioOnly && !state.studio.active && !document.body.classList.contains('room-game') && !state.auto;

async function startLevel(id, opts = {}) {
  const base = playable(id);
  if (!base) return;
  const practice = !opts.room && opts.practice && canPractice(base) ? opts.practice : 0;
  state.practice = practice;
  const lv = practice ? practiceLevel(base, practice) : base;
  // 친구 대결 방 판: { startAt(내 시계 ms), mode } — 같은 시각에 시작, 랭킹엔 안 올림
  const room = opts.room || null;
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
  $('#hud-lv').textContent = practice ? `🐢 연습 ${Math.round(practice * 100)}%` : lv.survival ? '⚔️ 서바이벌' : lv.challenge ? (lv.endless ? '무제한' : '챌린지') : lv.studioOnly ? '🎬 릴스용' : levelLabel(lv);
  $('#hud-name').textContent = lv.challenge ? `${lv.songName} · ${lv.composer}` : `${lv.name} · ${lv.composer}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  closeModal('modal-continue');
  const st = state.studio;
  renderLives(st.active || state.auto || practice ? null : MAX_LIVES);
  const vs = !room && !st.active && !practice && !lv.challenge && state.vs && state.vs.levelId === id ? state.vs : null;
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
  if (state.game) state.game.stop();
  state.runToken = null;
  // 영상 찍기는 팔로우 잠금 없이 (계정 주인이 촬영용으로 씀) → 서버 판 토큰도 안 받음
  // 인증 안 한 사람이 1~3단계를 칠 땐 랭킹에 못 올리니 판 토큰도 안 받음 (서버 요청 아끼기, 통계는 5분마다 따로 감)
  const canRank = isConfirmed() || state.cfg.gateMode === 'open' || isClosed(id);
  if ((!lv.challenge || lv.endless) && !st.active && !room && !practice && canRank) state.api
    .startRun(id)
    .then((r) => (state.runToken = r.runToken))
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
  const last = { score: -1, p: -1, op: -1, lives: MAX_LIVES, stars: -1 };
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
      const p = Math.round(h.progress * 200);
      if (p !== last.p) $('#hud-progress').style.width = p / 2 + '%';
      if (room) {
        // 내 점수는 다음 주고받기 때 같이 감 (2초마다), 상대 점수는 받은 값
        state.roomClient.send({ live: { score: h.score, combo: state.game ? state.game.combo : 0, progress: h.progress, lives: h.lives } });
        const o = state.roomClient.other;
        const op = o && o.final ? o.final.score : o && o.live ? o.live.score : 0;
        // ⚔️ 개인전: 상대가 목숨을 다 써서 끝났거나 방을 나갔으면 이 판도 바로 끝 → 내가 이김
        //   (무제한 서바이벌은 곡 끝이 없으니 상대 판이 끝났다는 건 쓰러졌다는 것)
        const opDown = !o || (o.final && (lv.survival || o.final.died));
        if (room.mode === 'versus' && opDown && state.game && state.game.state === 'playing') {
          state.game.endNow();
          return;
        }
        const rtNow = state.roomClient.realtime;
        if (rtNow !== last.rt) {
          $('#vs-name').textContent = (rtNow ? '⚡' : '') + roomOtherName();
          last.rt = rtNow;
        }
        if (op !== last.op || h.score !== last.score) {
          $('#vs-me').textContent = fmt(h.score);
          const ol = o && o.live && o.live.lives != null ? ` ♥${o.live.lives}` : '';
          $('#vs-op').textContent = room.mode === 'team' ? `${fmt(op)} · 팀 ${fmt(h.score + op)}` : fmt(op) + ol;
          const tot = h.score + op;
          $('#vs-fill').style.width = (tot ? (h.score / tot) * 100 : 50).toFixed(1) + '%';
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
      if (!state.studio.active && !res.auto && !res.practice) trackPlayEnd({ result: res.failed || res.died ? 'fail' : 'clear', score: res.score, stars: res.stars });
      if (room && state.roomClient.active) {
        res.room = { mode: room.mode, round: room.round };
        state.roomClient.send(
          { final: { score: res.score, stars: res.stars, grade: res.grade, failed: !!res.failed, maxCombo: res.maxCombo, accuracy: res.accuracy, died: !!(res.died || res.failed), survived: res.survived || 0, lv: res.roundReached || 0 } },
          true
        );
      }
      return state.studio.active ? studioFinish(res) : showResult(res);
    },
    // 영상 찍기 땐 목숨 없음 (녹화 중에 멈추면 안 되니까). 멀티는 광고 이어하기 없이 그 자리에서 끝
    // 🐢 연습은 목숨 없이 끝까지
    onDeath: st.active || practice ? null : room ? onRoomDeath : onDeath,
  });
  if (room) {
    // 친구와 같은 시각에 시작: 남은 시간 카운트다운 (Game.start 가 0.35초 뒤에 첫 박을 놓음)
    const box = $('#studio-count');
    box.hidden = false;
    $('#studio-count-msg').textContent = room.mode === 'team' ? '🤝 팀전! 둘이 같이 깨 봐요' : `⚔️ ${roomOtherName()} 님과 대결!`;
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
  sg.onStall = (stuckSec) => {
    // 4초 넘게 계속 멈춰 있으면(콩이 안 내려옴) 일시정지하고 해결 방법 안내
    if (stuckSec > 4 && state.game === sg && sg.state === 'playing') {
      sg.pause();
      $('#pause-stuck').hidden = false;
      $('#pause-title').textContent = '곡이 멈췄어요';
      openModal('modal-pause');
      return;
    }
    if (Date.now() - stallToastAt < 4000) return;
    stallToastAt = Date.now();
    toast('🔇 폰이 소리를 잠깐 멈췄어요. 화면을 한 번 톡 눌러 주세요 (화면 녹화는 시작 버튼 누르기 전에 켜 두세요)', 3600);
  };
  state.game.start();
  // 영상 찍기·자동 연주는 통계에 안 셈
  if (!st.active && !state.auto && !practice) trackPlayStart(lv.survival ? lv.baseId : id, vs || room ? 'vs' : 'normal');
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
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
function laneFromPoint(x, y) {
  const r = $('#game-canvas').getBoundingClientRect();
  return renderer.laneHit(x - r.left, y - r.top);
}

/** 화면 터치 → 게임 입력 (옆 줄 정보까지 넘겨서 경계 근처 터치를 봐줌) */
function tapAt(x, y, perfMs) {
  const { lane, near, u } = laneFromPoint(x, y);
  state.game.input(lane, perfMs, near, u);
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
      tapAt(e.clientX, e.clientY, e.timeStamp);
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      for (const t of e.changedTouches) tapAt(t.clientX, t.clientY, e.timeStamp);
    },
    { passive: false }
  );
  ['touchmove', 'gesturestart', 'dblclick', 'contextmenu'].forEach((ev) =>
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
function showResult(res) {
  if (state.suggestLite && !state.settings.lite) {
    state.suggestLite = false;
    setTimeout(() => toast('폰이 버거워해서 무대 효과를 줄였어요. 그래도 버벅이면 ⚙ 설정 → 저사양 모드', 4200), 2600);
  }
  res.runToken = state.runToken;
  state.lastResult = res;
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
  const badge = $('#res-badge');
  badge.hidden = !res.fullCombo;
  badge.textContent = res.counts.perfect === res.total && !res.counts.wrong ? 'ALL PERFECT' : 'FULL COMBO';
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.stars === 0 ? 'miss' : res.stars === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = mascotSVG('kong', face) + mascotSVG('jjak', face);
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
  $('#res-badge').hidden = true;
  for (const k of ['perfect', 'great', 'good', 'miss', 'wrong']) $('#res-' + k).textContent = res.counts[k] || 0;
  const face = res.diamonds === 0 ? 'miss' : res.diamonds === 1 ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = mascotSVG('kong', face) + mascotSVG('jjak', face);
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
  if (demoOnly() || state.api.mode !== 'server') return;
  // 랭킹은 팔로워 인증(암호)을 받은 사람만 → 안 받았으면 인증 창을 한 번 띄움
  if (!isConfirmed()) {
    askNickname();
    return;
  }
  if (!r.runToken) return;
  r.submitting = true;
  try {
    const out = await state.api.submitScore(
      endless
        ? { runToken: r.runToken, level: r.levelId, rounds: r.roundsCleared, score: r.score }
        : { runToken: r.runToken, level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts }
    );
    r.submitted = true;
    if (out.rank == null) toast('팔로우 확인이 안 돼서 지금은 랭킹에 안 보여요. 위 ⚠️ 버튼을 눌러 주세요', 3200);
    else if (endless) toast(out.improved ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · ${out.rank}위 🏆` : `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요 · ${out.rank}위`, 3200);
    else toast(out.improved ? `랭킹에 올라갔어요! 현재 ${out.rank}위 🏆` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요 · ${out.rank}위`, 3000);
  } catch (e) {
    if (e.status === 401 || (e.status === 403 && e.data && e.data.error === 'verify_required')) {
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

async function openRank(levelId) {
  state.rankLevel = levelId || state.rankLevel || 1;
  renderRankTabs();
  openModal('modal-rank');
  await loadRank();
}

/** 위: 🎵 단계 / 💎 무제한 전환. 아래: 그 안의 탭 (단계 = 총 등수 + 1~15단계, 무제한 = 그리그 + 단계별 무제한) */
function renderRankTabs() {
  const cur = state.rankLevel;
  const endless = isEndlessRank(cur);
  $$('#rank-mode button').forEach((b) => b.setAttribute('aria-selected', String((b.dataset.rankMode === 'endless') === endless)));
  const tab = (id, label) => `<button role="tab" data-rank="${id}" aria-selected="${id === cur}">${label}</button>`;
  $('#rank-tabs').innerHTML = endless
    ? tab(ENDLESS_ID, '♾️ 그리그') + MAIN_LEVELS.filter((l) => !closedLocked(levelEndlessId(l.id))).map((l) => tab(levelEndlessId(l.id), `${l.id}단계 ∞`)).join('')
    : tab('total', '🏆 총 등수') + LEVELS.map((l) => tab(l.id, l.xmas ? '🎄 이벤트' : `${l.id}단계`)).join('');
  const sel = $('#rank-tabs [aria-selected="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
}

async function loadRank() {
  const list = $('#rank-list');
  if (demoOnly()) {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  try {
    const data = await state.api.leaderboard(state.rankLevel);
    const total = state.rankLevel === 'total';
    const endless = isEndlessRank(state.rankLevel);
    if (!data.entries.length) list.innerHTML = '<div class="rank-empty">아직 아무도 없어요. 첫 1위의 주인공이 되어보세요!</div>';
    else if (total) list.innerHTML = totalRankHtml(data);
    else if (endless)
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g endless">Lv.${e.rounds}</span></div>`
        )
        .join('');
    else
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g" style="color:${gradeColor(e.grade)}">${e.grade || ''}</span></div>`
        )
        .join('');
    const foot = [];
    if (data.sample && isLocalDev()) foot.push('(개발 모드: 서버 없이 내 기록만 보여요)');
    if (total) foot.push('단계별 최고점을 모두 더한 점수예요. 더 많은 단계를 높은 점수로 칠수록 올라가요!');
    if (endless) {
      const eb = levelEndlessBase(state.rankLevel);
      foot.push(`${eb ? `${eb.id}단계 ${escapeHtml(eb.name)} 무제한` : '그리그 무제한 모드'} 랭킹이에요. 더 높은 단계(Lv.)까지 깬 사람이 위, 같으면 점수가 높은 사람이 위예요.`);
    }
    if (data.me) foot.push(`내 순위: ${data.me.rank}위.`);
    if (state.me.guest) foot.push(`<b>${escapeHtml(state.me.player?.username)}</b> 님으로 참여 중 · 끝까지 치면 점수가 알아서 올라가요.`);
    else foot.push('닉네임을 정하면 끝까지 친 점수가 알아서 랭킹에 올라가요. <button class="link" data-action="rank-join">닉네임 정하기</button>');
    $('#rank-foot').innerHTML = foot.join(' ');
  } catch {
    list.innerHTML = '<div class="rank-empty">랭킹을 불러오지 못했어요.</div>';
  }
}

/** 총 등수: 1·2·3등 시상대 + 4등부터 목록 */
function totalRankHtml(data) {
  const n = data.levels || LEVELS.length;
  const top = data.entries.slice(0, 3);
  // 시상대는 2등-1등-3등 순서로 늘어놓기
  const order = [1, 0, 2].filter((i) => top[i]);
  const podium = order
    .map((i) => {
      const e = top[i];
      return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal m${i + 1}">${icon('medal')}</span>
        <span class="pn">${escapeHtml(e.username)}</span><span class="ps">${fmt(e.score)}</span>
        <span class="pl">${e.levels}/${n}단계</span><span class="step">${i + 1}등</span></div>`;
    })
    .join('');
  const rest = data.entries
    .slice(3, 50)
    .map(
      (e) => `<div class="rank-row ${e.me ? 'me' : ''}"><span class="r">${e.rank}</span><span class="u">${escapeHtml(e.username)}</span>
        <span class="s">${fmt(e.score)}</span><span class="g small">${e.levels}/${n}</span></div>`
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
  const data = { bests: loadBests(), nick: load('nick', ''), lastNick: load('lastNick', ''), lastIg: load('lastIg', ''), settings };
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
};
const isQuizFormat = () => state.studio.format === 'quiz';
/** 실제로 칠 판 id: 노래 맞히기면 'q2x8' 처럼 */
const studioPlayId = () => (isQuizFormat() && typeof state.studio.level === 'number' ? quizId(state.studio.level, state.studio.quizBars ?? 8) : state.studio.level);
const STUDIO_CHALLENGES = [4, 7];
function studioDefaults(id) {
  if (isQuizFormat()) return STUDIO_TEXT.quiz;
  if (id === BEAT_ID) {
    const style = beatSaved().style;
    return style === 'steady' ? STUDIO_TEXT.beatSteady : STUDIO_TEXT.beat;
  }
  return isChallengeId(id) ? STUDIO_TEXT.challenge(Number(String(id).slice(2))) : STUDIO_TEXT.level;
}
function pickStudioLevel(id) {
  const st = state.studio;
  const top = $('#studio-top');
  const bottom = $('#studio-bottom');
  // 기본 문구 그대로였으면 새 기본 문구로 바꿔 줌 (직접 쓴 문구는 그대로)
  const all = [STUDIO_TEXT.level, STUDIO_TEXT.beat, STUDIO_TEXT.beatSteady, { top: '드롭에서 엄지 터짐 주의', bottom: '빌드업 끝까지 따라와 봐' }, { top: '이 노래 엄지로 드럼 커버', bottom: '프로필 링크에서 직접 쳐보기' }, STUDIO_TEXT.quiz, ...STUDIO_CHALLENGES.map(STUDIO_TEXT.challenge)];
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
  if (isQuizFormat()) {
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
  // 노래 맞히기는 진짜 곡만 (레벨업 챌린지·박자 맞추기는 곡이 아님)
  pickStudioLevel(f === 'quiz' && (typeof st.level !== 'number' || !getLevel(st.level)) ? 2 : st.level);
  renderStudioLevels();
}

/** 영상 화면에 그릴 문구 */
function studioOverlay(lv) {
  const st = state.studio;
  if (lv.quiz) return { top: st.top, bottom: st.bottom, quiz: true, answer: lv.name, composer: lv.composer, bottomEnd: '프로필 링크에서 직접 쳐보기' };
  return {
    top: st.top,
    bottom: st.bottom,
    challenge: !!lv.challenge,
    steady: !!lv.steady,
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
function withSync(lv) {
  const st = state.studio;
  if (sync.firstBeat == null || !st.active || !st.recorder || st.recCtx == null) return lv;
  lv.syncCalibMs = syncCalib();
  lv.syncAnchor = st.recCtx + (sync.firstBeat - sync.t0) + lv.syncCalibMs / 1000;
  lv.synced = true;
  return lv;
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
async function syncSelfCheck(blob, target, usedMs) {
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
    const err = at - target; // 이번 영상에서 드럼이 노래 박보다 이만큼 늦음 (− 면 빠름)
    if (Math.abs(err) > 0.4) return;
    // 실제 위치 = 목표 + 보정 + 이 폰의 녹화 지연 → 맞는 보정 = 이번 보정 − 어긋난 만큼
    const v = Math.max(-500, Math.min(500, Math.round((usedMs - err * 1000) / 5) * 5));
    if (Math.abs(v - usedMs) < 15) return; // 이번 영상은 이미 맞음
    save('syncCalib', v);
    $('#sync-calib').textContent = `${v > 0 ? '+' : ''}${v}ms`;
    $('#studio-done-msg').textContent += ` · 이번 영상은 드럼이 ${Math.abs(v - usedMs)}ms ${v > usedMs ? '빨라요' : '늦어요'}. 싱크 보정을 자동으로 맞췄으니 「다시 찍기」 한 번 하면 딱 맞아요.`;
  } catch {}
}
let syncPreview = null;
function stopSyncPreview() {
  if (syncPreview) {
    syncPreview.pause();
    syncPreview = null;
  }
}
async function syncPick(file) {
  stopSyncPreview();
  if (sync.url) URL.revokeObjectURL(sync.url);
  sync.url = URL.createObjectURL(file);
  sync.name = file.name;
  sync.firstBeat = null;
  $('#sync-panel').hidden = false;
  $('#sync-name').textContent = file.name;
  $('#sync-result').textContent = '여는 중…';
  await audio.unlock();
  const buf = await audio.loadTrack(sync.url);
  if (!buf) {
    // 아이폰 사파리는 화면 녹화(.mov)를 바로 못 풀어서 → 영상을 소리 없이 한 번 재생하며 소리를 읽음 (버튼을 눌러야 재생됨)
    $('#sync-result').innerHTML = '<b>「박자 찾기」를 눌러 주세요.</b> 영상을 소리 없이 한 번 재생하면서 소리를 읽어요 (영상 길이만큼, 최대 30초 걸려요)';
    $('#sync-detect-btn').textContent = '박자 찾기';
    return;
  }
  syncDetect();
}
/**
 * 영상(.mov 등)을 소리 없이 재생하면서 소리를 그대로 받아 적음 → AudioBuffer (최대 30초)
 *   첫 소리·첫 박의 '간격'만 쓰므로 받아 적기 시작이 조금 늦어도 결과는 같음
 */
function captureMediaAudio(url, onProgress) {
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
    const MAX = 30;
    const finish = (ok = true) => {
      if (done) return;
      done = true;
      try {
        v.pause();
        src && src.disconnect();
        sp && sp.disconnect();
        mute && mute.disconnect();
      } catch {}
      const len = chunks.reduce((a, c) => a + c.length, 0);
      if (!ok || len < ctx.sampleRate * 3) return resolve(null);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      let o = 0;
      for (const c of chunks) {
        ch.set(c, o);
        o += c.length;
      }
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
      const a = ib.getChannelData(0);
      const b = ib.numberOfChannels > 1 ? ib.getChannelData(1) : a;
      const m = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) * 0.5;
      chunks.push(m);
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
    buf = await captureMediaAudio(sync.url, (t, d) => ($('#sync-result').textContent = `소리 읽는 중… ${Math.floor(t)}/${Math.round(d)}초`));
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
    '이대로 녹화하면 드럼이 이 박에 맞춰 나와요. 드럼이 2배로 바쁘면 ÷2 누르고 다시 「박자 찾기」';
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
  // 버튼은 한 번만 만듦 (BPM 칸을 고치다 바로 형식을 누르면, 다시 그리는 사이 누른 게 사라짐)
  if (!$('#beat-style').children.length)
    $('#beat-style').innerHTML = BEAT_STYLES.map((x) => `<button type="button" data-beat-style="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-style button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatStyle === o.style));
  if (!$('#beat-diff').children.length)
    $('#beat-diff').innerHTML = BEAT_DIFFS.map((x) => `<button type="button" data-beat-diff="${x.id}"><b>${x.name}</b><small>${x.desc}</small></button>`).join('');
  $$('#beat-diff button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.beatDiff === o.diff));
  $('#beat-diff').hidden = o.style !== 'steady';
  const sel = $('#beat-rounds');
  const key = `${o.bpm}|${o.style}`;
  if (!sel.options.length || sel.dataset.key !== key) {
    sel.innerHTML = Array.from({ length: BEAT_MAX_ROUNDS }, (_, i) => {
      const r = i + 1;
      const text = o.style === 'steady' ? `${r * 4}마디` : `Lv.1→${r}`;
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
  toast(`${beatChipText()} 골랐어요`, 1600);
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
  save('studio', { level: st.level, mode: st.mode, top: st.top, bottom: st.bottom, file: st.file, format: st.format || 'play', quizBars: st.quizBars });
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
  if (st.file) startRecorder();
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

async function studioFinish(res) {
  const st = state.studio;
  // 마지막 장면(환호하는 마스코트)을 잠깐 더 담기
  const g = state.game;
  const t0 = performance.now();
  await new Promise((resolve) => {
    (function hold() {
      const rt = performance.now() / 1000;
      renderer.draw(
        {
          now: g.endTime,
          notes: [],
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
      if (performance.now() - t0 < (renderer.studio && renderer.studio.quiz ? 3600 : res.challenge ? 2400 : 1500)) requestAnimationFrame(hold);
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
      g && g.level.synced
        ? '화면 녹화한 그 노래 구간에 박자를 맞춘 영상이에요. 인스타에서 같은 노래·같은 구간(시작 위치 그대로)을 넣으면 맞아요. 드럼이 노래보다 빠르면 「싱크 보정」을 +, 늦으면 −로 바꿔 다시 찍기'
        : firstHit != null && firstHit > 0
        ? `영상이 만들어졌어요. 첫 쿵은 영상 약 ${firstHit.toFixed(1)}초예요. 인스타에서 영상 앞을 그만큼 잘라내고, 노래는 하이라이트 첫 박(첫 강세)부터 시작하게 고르면 박자가 맞아요.`
        : '영상이 만들어졌어요. 저장해서 릴스에 올려보세요!';
    // 보정 없이 첫 쿵이 와야 할 영상 시각과 비교 (보정값은 그 차이만큼)
    if (g && g.level.synced && firstHit != null) syncSelfCheck(blob, firstHit - g.level.syncCalibMs / 1000, g.level.syncCalibMs);
  } else {
    video.hidden = true;
    $('#btn-studio-save').hidden = true;
    $('#studio-done-msg').textContent = '화면 녹화를 멈추고 사진 앱에서 확인하세요. 위아래를 9:16으로 잘라 쓰면 딱 맞아요.';
  }
  if (!res.auto && !res.challenge && !isQuizId(res.levelId)) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `okaystra-${isQuizFormat() ? 'quiz-' + st.level : isChallengeId(st.level) ? 'challenge' : st.level + '단계'}.${ext}`, { type: st.blob.type });
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
// ---------------- 친구 대결 방 ----------------
const roomUi = { newMode: 'versus', round: 0 };
function roomOtherName() {
  const o = state.roomClient && state.roomClient.other;
  return o ? o.name : '친구';
}
function myRoomName() {
  return load('roomName', '') || (state.me && state.me.player && state.me.player.username) || '';
}
function roomErrText(e) {
  const k = (e && (e.data && e.data.error)) || (e && e.message) || '';
  return (
    {
      rate_limited: '잠시 뒤 다시 해 주세요',
      no_server: '지금은 서버에 연결할 수 없어요',
      room_gone: '그런 방이 없어요. 코드를 확인해 주세요',
      room_full: '방이 꽉 찼어요 (두 명까지)',
      room_busy: '지금 치는 중인 방이에요. 끝나면 들어와 주세요',
      bad_name: '이름은 1~12자, 글자·숫자만 써 주세요',
      bad_code: '코드 4자리를 적어 주세요',
      confirm_required: `이 곡은 팔로워 인증을 받아야 칠 수 있어요 (1~${FREE_UPTO}단계는 누구나)`,
      confirm_pending: `이 곡은 팔로워 인증을 받아야 칠 수 있어요 (1~${FREE_UPTO}단계는 누구나)`,
    }[k] || '연결이 불안정해요. 잠시 뒤 다시 해 주세요'
  );
}
/** 멀티 창에서 보일 칸: entry(처음) · wait(빠른 대결 상대 찾는 중) · lobby(대기실) */
function roomPanel(which) {
  $('#room-entry').hidden = which !== 'entry';
  $('#room-wait').hidden = which !== 'wait';
  $('#room-lobby').hidden = which !== 'lobby';
}
/** 멀티·건의하기 잠금: 팔로워 인증 안 했으면 true (개발용 ?gate=open 이면 풀림) */
function followGated() {
  return state.cfg.gateMode !== 'open' && !isConfirmed();
}
function openRoom(code) {
  if (followGated()) {
    openVerify(null, { label: '⚔️ 멀티 플레이 (빠른 대결 · 친구 방)는 팔로워만', then: () => openRoom(code) });
    return;
  }
  const c = state.roomClient;
  roomPanel(!c.active ? 'entry' : c.waiting ? 'wait' : 'lobby');
  if (!c.active) {
    $('#room-name').value = myRoomName();
    if (code) $('#room-code').value = code;
    $$('#room-mode-new [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === roomUi.newMode)));
    showQuickWaiting();
  } else renderRoom(c.room);
  openModal('modal-room');
}
/** 빠른 대결 버튼에 지금 기다리는 사람 수 (창 열 때 한 번만 물어봄 — 요청 아끼려고 폴링 안 함) */
async function showQuickWaiting() {
  const el = { easy: $('#q-wait-easy'), hard: $('#q-wait-hard') };
  const n = await state.roomClient.waitingCounts();
  if (!n) {
    el.easy.hidden = el.hard.hidden = true;
    $('#q-none').hidden = true;
    return;
  }
  for (const k of ['easy', 'hard']) {
    el[k].hidden = false;
    el[k].textContent = `대기 ${n[k] >= 5 ? '5명+' : n[k] + '명'}`;
  }
  $('#q-none').hidden = n.easy + n.hard > 0;
}
function renderRoom(room) {
  const c = state.roomClient;
  if (!room || !c.active) return;
  // 둘 다 준비 → 새 판 시작 (서버가 정한 시각에)
  if (room.status === 'playing' && room.startAt && room.round !== roomUi.round) {
    roomUi.round = room.round;
    const startAt = c.toLocal(room.startAt);
    if (startAt - Date.now() > -2000) {
      closeModal('modal-room');
      // 개인전 + 방장이 '무제한'을 켰으면 서바이벌 (곡이 끝나도 둘 다 살아 있으면 끝없이 빨라짐). 아니면 원래 곡으로 점수 승부
      startLevel(room.mode === 'versus' && room.endless ? levelSurvivalId(room.level) : room.level, { room: { startAt, mode: room.mode, round: room.round } });
      return;
    }
  }
  if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
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
  const opts = LEVELS.map((lv) => {
    const ok = lv.id <= FREE_UPTO || isConfirmed();
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
// ⚡ 빠른 대결: 같은 묶음 사람을 90초까지 기다림 (사람이 적을 수 있어서)
const QUICK_WAIT_MS = 90_000;
function stopWaitTimer() {
  clearInterval(roomUi.waitTimer);
  roomUi.waitTimer = null;
}
async function roomQuick(bracket) {
  const name = $('#room-name').value.trim() || myRoomName();
  if (!name) {
    roomPanel('entry');
    openModal('modal-room');
    return toast('이름을 적어 주세요');
  }
  if (followGated()) return openRoom();
  if (needsCalibration()) {
    closeModal('modal-room');
    openCalibration({ required: true, after: () => roomQuick(bracket) });
    return;
  }
  save('roomName', name);
  // 소리는 사용자가 누를 때만 켤 수 있어서 지금 켜 둠 (상대를 찾으면 타이머로 시작)
  await audio.unlock();
  roomUi.round = 0;
  roomUi.bracket = bracket;
  try {
    const waiting = await state.roomClient.quick(name, bracket);
    // 바로 붙었으면 대기실로 → 둘 다 '준비!'를 눌러야 시작
    if (!waiting) {
      openModal('modal-room');
      renderRoom(state.roomClient.room);
      toast(`상대를 찾았어요! '준비!'를 누르면 시작해요`, 2800);
      return;
    }
    openModal('modal-room');
    roomPanel('wait');
    const t0 = Date.now();
    const label = bracket === 'hard' ? '🔥 어려움·극악' : '🌱 쉬움·보통';
    const tick = () => {
      const c = state.roomClient;
      if (!c.active || !c.waiting) return stopWaitTimer();
      const sec = Math.floor((Date.now() - t0) / 1000);
      $('#room-wait-title').textContent = `${label} 상대 찾는 중… ${sec}초`;
      if (Date.now() - t0 > QUICK_WAIT_MS) {
        stopWaitTimer();
        c.leave();
        roomPanel('entry');
        toast('지금은 사람이 없어요', 3000);
      }
    };
    stopWaitTimer();
    tick();
    roomUi.waitTimer = setInterval(tick, 1000);
  } catch (e) {
    toast(roomErrText(e), 2800);
  }
}
/** 결과 화면: 빠른 대결 새 상대 찾기 */
async function roomNext() {
  const bracket = (state.roomClient.room && state.roomClient.room.pub) || roomUi.bracket || 'easy';
  await state.roomClient.leave();
  $('#screen-result').classList.remove('in-room');
  $('#res-room').hidden = true;
  document.body.classList.remove('room-game');
  show('screen-title');
  roomQuick(bracket);
}

async function roomLeave() {
  stopWaitTimer();
  await state.roomClient.leave();
  roomUi.round = 0;
  document.body.classList.remove('room-game');
  closeModal('modal-room');
  if ($('#screen-result').classList.contains('in-room')) {
    $('#screen-result').classList.remove('in-room');
    $('#res-room').hidden = true;
    refreshTitle();
    show('screen-title');
  }
  toast('방에서 나왔어요');
}
/** 결과 화면: 대결 방 결과 (상대가 끝날 때까지 2초마다 갱신) */
function renderRoomResult() {
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
  openModal('modal-suggest');
  setTimeout(() => $('#suggest-text').focus(), 50);
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
  'room-create': roomCreate,
  'room-join': roomJoin,
  'room-ready': roomReady,
  'room-share': roomShare,
  'room-leave': roomLeave,
  'room-quick': () => {},
  'room-next': roomNext,
  'room-again': roomAgain,
  'news-open': openNews,
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
  today: () => tryStart(todayLevel().id, { free: true }),
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
    openRank('total');
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
    // 대결 방 판을 중간에 나가면 지금 점수로 끝낸 걸로 알림
    if (document.body.classList.contains('room-game') && state.roomClient.active && state.game)
      state.roomClient.send({ final: { score: state.game.score, stars: 0, grade: 'F', failed: true, maxCombo: state.game.maxCombo, accuracy: 0 } }, true);
    document.body.classList.remove('room-game');
    if (state.game) state.game.stop();
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
    const qb = e.target.closest('[data-action="room-quick"]');
    if (qb) {
      roomQuick(qb.dataset.bracket);
      return;
    }
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
      const want = rm.dataset.rankMode === 'endless';
      if (want !== isEndlessRank(state.rankLevel)) {
        state.rankLevel = want ? ENDLESS_ID : 'total';
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
  $('#quiz-bars').addEventListener('change', (e) => (state.studio.quizBars = Number(e.target.value)));
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
      toast('방이 닫혔어요', 2400);
      roomUi.round = 0;
      if (!$('#modal-room').hidden) openRoom();
      if ($('#screen-result').classList.contains('in-room')) renderRoomResult();
    },
  });
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'instagramHandle', 'siteUrl', 'freePassUntil']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
  } catch {}
  const g = devParam('gate');
  if (g === 'open' || g === 'soft') state.cfg.gateMode = g;
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
  if (devParam('debug') === '1') window.__kk = { state, audio, renderer };
}

boot();
