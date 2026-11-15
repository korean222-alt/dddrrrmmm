// 오케이스트라 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

import {
  LEVELS, getLevel, levelLanes, isGated, GATE_FROM_LEVEL, DIFFICULTY_WORDS, STAR_RULES,
  ENDLESS_ID, LAST_LEVEL_ID, makeEndless, isUnlocked, nextChallenge, DIAMOND_RULES, roundInfo,
} from './charts.js';
import { AudioEngine, playMetronome } from './audio.js';
import { Renderer } from './render.js';
import { Game, MAX_LIVES, LIFE_REGEN_COMBO } from './game.js';
import { initAds, showRewarded } from './ads.js';
import { createApi } from './api.js';
import { initTracker, trackPlayStart, trackPlayEnd, hasOpenPlay } from './track.js';
import { CONFIG } from './config.js';
import { mascotSVG, stickSVG, bassDrumSVG, snareSVG } from './mascot.js';
import { loadSettings, saveSettings, loadBests, saveBest, load, save, remove } from './storage.js';
import { makeShareCard, gradeColor } from './sharecard.js';
import { todayLevel, encodeChallenge, decodeChallenge, opponentScoreAt, versusOutcome, cleanName } from './versus.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);

const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 13v4M8 20h8M9.5 17h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  retry: '<path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-5.7 2.3L4 8.5M4 4v4.5h4.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="3" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 10.5l5-3v9l-5-3z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
  swords: '<path d="M4 4l9.5 9.5M4 4v3.5M4 4h3.5M20 4l-9.5 9.5M20 4v3.5M20 4h-3.5M7 14l3 3M5.5 18.5l2-2M17 14l-3 3M18.5 18.5l-2-2" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.2a4.4 4.4 0 018 2.7c0 5.7-8 10.6-8 10.6z" fill="currentColor"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/>',
};
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
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const audio = new AudioEngine();
const renderer = new Renderer($('#game-canvas'));

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
/** 테스트용 주소 옵션(?gate= ?level= …)은 내 컴퓨터(localhost)에서만. 실제 사이트에선 무시 */
const devParam = (k) => (isLocalDev() ? params.get(k) : null);
/** 서버 없이 배포된 상태(정적 호스팅): 랭킹은 아직 안 열림 */
const demoOnly = () => state.api && state.api.mode === 'mock' && !isLocalDev();
const SOON = () => `랭킹은 곧 열려요! ${atHandle()} 팔로우하고 기다려 주세요`;

const gateFrom = () => Number(state.cfg.gateFromLevel) || GATE_FROM_LEVEL;
/** 아직 팔로우 안 한 상태인지 (팔로우 버튼 눌렀는지. 진짜 확인은 아님) */
function needsFollow() {
  return state.cfg.gateMode === 'soft' && !load('softFollowed', false);
}
function isLocked(level) {
  return isGated(level, gateFrom()) && needsFollow();
}
/** 단계 id → 칠 판 (숫자 = 일반 단계, 'endless' = 무제한 모드, 'ch4' = 영상용 레벨업 챌린지 4단계까지) */
function playable(id) {
  if (id === ENDLESS_ID) return makeEndless();
  if (typeof id === 'string' && /^ch\d+$/.test(id)) return makeEndless({ rounds: Number(id.slice(2)) });
  return getLevel(id);
}
const isChallengeId = (id) => id === ENDLESS_ID || (typeof id === 'string' && /^ch\d+$/.test(id));
/** 앞 단계를 안 깨서 잠김 (팔로우 잠금과 별개) */
const progressLocked = (id) => !isUnlocked(id, loadBests());
function progressLockText(id) {
  if (id === ENDLESS_ID) return `${LAST_LEVEL_ID}단계 ${getLevel(LAST_LEVEL_ID).name}을 깨면 무제한 모드가 열려요 💎`;
  return `${id - 1}단계를 별 1개 이상으로 깨면 ${id}단계가 열려요`;
}
const LOCK_FROM_PREV = (id) => (id === ENDLESS_ID ? `${LAST_LEVEL_ID}단계 깨면 열림` : `${id - 1}단계 깨면 열림`);

/** 앞 단계를 아직 못 깼어도 인스타 연결(팔로우)은 미리 해둘 수 있음. 연결 후엔 진행 잠금 안내 */
function earlyFollow(level) {
  const lv = level || getLevel(gateFrom());
  const after = () => {
    renderLevels();
    if (progressLocked(lv.id)) setTimeout(() => toast(`인스타 연결 완료! ${progressLockText(lv.id)}`, 3200), 800);
    else startLevel(lv.id);
  };
  requireFollow(lv, after, { early: progressLocked(lv.id) });
}

/** 잠긴 단계를 누르면 팔로우 안내 */
function requireFollow(level, onDone, opts = {}) {
  openFollowGate(level, onDone, opts);
}

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
  const id = q && !progressLocked(q.id) ? q.id : nextChallenge(loadBests());
  state.quickId = id;
  $('[data-action="quickstart"]').innerHTML =
    id === ENDLESS_ID ? `${icon('play')} 바로 시작 <small>무제한 모드</small>` : `${icon('play')} 바로 시작 <small>${id}단계</small>`;
}

/** "1~3단계는 누구나" 같은 문구용 */
function freeRangeText() {
  const f = gateFrom();
  return f <= 1 ? '' : f === 2 ? '1단계는' : `1~${f - 1}단계는`;
}

function refreshToday() {
  const lv = todayLevel();
  const best = loadBests()[lv.id];
  $('#today-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#today-sub').textContent = best ? `내 최고 ${fmt(best.score)}점 · 친구에게 1:1 도전장 ⚔️` : `${lv.id}단계 · 점수 내고 친구에게 1:1 도전장 ⚔️`;
}

/** 시작 화면 '도전' 버튼 단계: 팔로우 잠금 안쪽에서 처음 나오는 어려움(★4) 곡 */
function hotLevel() {
  return LEVELS.find((l) => l.id >= gateFrom() && l.difficulty >= 4) || getLevel(gateFrom()) || LEVELS[LEVELS.length - 1];
}

function refreshTitle() {
  refreshToday();
  refreshQuick();
  const foot = $('#title-foot');
  const free = freeRangeText();
  if (state.me.guest) {
    foot.innerHTML = `<b>${escapeHtml(state.me.player?.username || '')}</b> 님, 오늘도 쿵짝!`;
  } else if (needsFollow()) {
    foot.innerHTML = `${free ? free + ' 바로! ' : ''}<b>${gateFrom()}단계부터는 ${igWho()} 팔로우</b>하면 열려요`;
  } else {
    foot.innerHTML = handle() ? `만든 곳 <a href="https://instagram.com/${handle()}" target="_blank" rel="noopener">${atHandle()}</a> · 새 곡 소식은 인스타에서!` : '모두 아는 명곡에 맞춰 드럼을 쳐 보세요!';
  }
}

// ---------------- 레벨 목록 ----------------
function renderLevels() {
  const bests = loadBests();
  let gateShown = false;
  const list = LEVELS.map((lv) => {
    const prevLock = !isUnlocked(lv.id, bests);
    const locked = prevLock || isLocked(lv);
    const b = bests[lv.id];
    const meta = prevLock
      ? `<span class="lockline">${icon('lock')} ${LOCK_FROM_PREV(lv.id)}</span>`
      : locked
      ? `<span class="lockline">${icon('lock')} 인스타 팔로우</span>`
      : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
    // 잠기는 첫 단계 위에 "여기부터 팔로우" 구분선
    let divider = '';
    if (!gateShown && state.cfg.gateMode !== 'open' && isGated(lv, gateFrom())) {
      gateShown = true;
      divider = needsFollow()
        ? `<button class="gate-divider" data-action="early-follow">${icon('insta')} ${lv.id}단계부터 인스타 팔로우 <b>지금 연결하기</b></button>`
        : `<div class="gate-divider">${icon('insta')} ${lv.id}단계부터는 ${igWho()} 팔로우 완료!</div>`;
    }
    return `${divider}<button class="level-card ${locked ? 'locked' : ''} ${lv.boss ? 'boss' : ''}" data-level="${lv.id}">
      <div class="lv"><span>${lv.id}<small>단계</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
  });
  // 맨 아래: 무제한 모드 (마지막 단계 깨면 열림)
  const eLock = !isUnlocked(ENDLESS_ID, bests);
  const eb = bests[ENDLESS_ID];
  list.push(`<button class="level-card endless-card ${eLock ? 'locked' : ''}" data-level="${ENDLESS_ID}">
      <div class="lv"><span>∞</span></div>
      <div class="info"><h4>무제한 모드 <small>그리그</small></h4><p>깰수록 BPM +10 · 속도 한도 없음</p><p class="gem-rule">💎 Lv.4 · 💎💎 Lv.7 · 💎💎💎 Lv.10 클리어</p></div>
      <div class="meta">${eLock ? `<span class="lockline">${icon('lock')} ${LOCK_FROM_PREV(ENDLESS_ID)}</span>` : `${gemsHTML(eb ? eb.diamonds || 0 : 0, 'sm')}<span>${eb ? `최고 Lv.${eb.roundsCleared || 0} 클리어` : 'NEW'}</span>`}</div>
    </button>`);
  $('#level-list').innerHTML = list.join('');
  refreshToday();
  const free = freeRangeText();
  $('#levels-foot').innerHTML = needsFollow()
    ? `${free ? free + ' 누구나 바로! ' : ''}${gateFrom()}단계부터는 ${igWho()} 팔로우하면 열려요.<br>앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요. 별 3개: ${STAR_RULES[0].text}`
    : `앞 단계를 별 1개 이상으로 깨면 다음 단계가 열려요. 마지막 단계까지 깨면 💎 무제한 모드!<br>별 3개: ${STAR_RULES[0].text}`;
}

// ---------------- 게임 ----------------
/** free: 오늘의 노래·친구 도전장은 앞 단계를 안 깼어도 칠 수 있음 (팔로우 잠금은 그대로) */
async function tryStart(id, { free = false } = {}) {
  if (!free && progressLocked(id)) {
    const glv = getLevel(id);
    // 팔로우 잠금 단계면 앞 단계를 안 깼어도 인스타 연결은 미리 할 수 있게
    if (glv && isLocked(glv)) {
      earlyFollow(glv);
      return;
    }
    toast(progressLockText(id), 2800);
    if ($('#screen-title').classList.contains('active')) {
      renderLevels();
      show('screen-levels');
    }
    return;
  }
  if (id === ENDLESS_ID) {
    startLevel(id);
    return;
  }
  const lv = getLevel(id);
  if (!lv) return;
  if (isLocked(lv)) {
    requireFollow(lv, () => startLevel(id));
    return;
  }
  startLevel(id);
}

async function fontsReady() {
  try {
    await Promise.race([document.fonts.load('40px "Jua"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {}
}

// 곡 시작은 비동기(악기 소리 불러오기 등)라서, 같은 단계를 빠르게 두 번 누르면 게임이 둘 생겨
// 먼저 만든 쪽이 카운트인 중에 이미 진행되던 버그가 있었음 → 마지막 호출만 살리고 앞선 호출은 중단
let startSeq = 0;
async function startLevel(id) {
  const lv = playable(id);
  if (!lv) return;
  // 처음 한 번은 박자 보정을 꼭 하고 시작 (영상 찍기·자동 연주는 제외)
  if (needsCalibration()) {
    openCalibration({ required: true, after: () => startLevel(id) });
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
  $('#hud-lv').textContent = lv.challenge ? (lv.endless ? '무제한' : '챌린지') : `${lv.id}단계`;
  $('#hud-name').textContent = lv.challenge ? `${lv.songName} · ${lv.composer}` : `${lv.name} · ${lv.composer}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  closeModal('modal-continue');
  const st = state.studio;
  renderLives(st.active || state.auto ? null : MAX_LIVES);
  const vs = !st.active && !lv.challenge && state.vs && state.vs.levelId === id ? state.vs : null;
  $('#hud-vs').hidden = !vs;
  if (vs) {
    $('#vs-name').textContent = vs.name;
    $('#vs-me').textContent = '0';
    $('#vs-op').textContent = '0';
    $('#vs-fill').style.width = '50%';
  }
  // 악기 샘플이 아직이면 잠깐 기다림 (최대 3초. 피아노가 안 되면 합성음, 오케스트라는 받는 대로 중간부터 합류)
  const orchLoad = audio.orchOn ? audio.loadOrch() : Promise.resolve();
  await Promise.race([Promise.all([audio.loadPiano(), orchLoad]), new Promise((r) => setTimeout(r, 3000))]);
  if (stale()) return;
  $('#screen-game').classList.toggle('studio-mode', st.active);
  renderer.studio = st.active ? studioOverlay(lv) : null;
  setKit(lv);
  await fontsReady();
  await new Promise((r) => requestAnimationFrame(r));
  const cw = $('#game-canvas').clientWidth || window.innerWidth;
  await renderer.resize(st.active ? Math.min(3, Math.max(2, 1080 / cw)) : 2);
  if (stale()) return;
  if (state.game) state.game.stop();
  state.runToken = null;
  // 영상 찍기는 팔로우 잠금 없이 (계정 주인이 촬영용으로 씀) → 서버 판 토큰도 안 받음
  if ((!lv.challenge || lv.endless) && !st.active) state.api
    .startRun(id)
    .then((r) => (state.runToken = r.runToken))
    .catch((e) => {
      if (e.status === 403 && state.game && state.game.level.id === id) {
        state.game.stop();
        state.me = { verified: false };
        show('screen-levels');
        renderLevels();
        requireFollow(lv, () => startLevel(id));
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
      if (vs) {
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
      if (!state.studio.active && !res.auto) trackPlayEnd({ result: res.failed || res.died ? 'fail' : 'clear', score: res.score, stars: res.stars });
      return state.studio.active ? studioFinish(res) : showResult(res);
    },
    // 영상 찍기 땐 목숨 없음 (녹화 중에 멈추면 안 되니까)
    onDeath: st.active ? null : onDeath,
  });
  state.game.start();
  // 영상 찍기·자동 연주는 통계에 안 셈
  if (!st.active && !state.auto) trackPlayStart(id, vs ? 'vs' : 'normal');
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
}

/** 누른 줄의 악기 (원근으로 비스듬한 줄 모양 그대로. 악기 그림을 정확히 안 눌러도 됨) */
function laneFromPoint(x, y) {
  const r = $('#game-canvas').getBoundingClientRect();
  return renderer.laneAt(x - r.left, y - r.top);
}

// 키보드: 레인 수에 따라 왼쪽부터 키 배정
const KEYMAP = {
  2: [['KeyF', 'KeyD', 'KeyA', 'ArrowLeft'], ['KeyJ', 'KeyK', 'KeyL', 'ArrowRight']],
  3: [['KeyF', 'KeyD', 'ArrowLeft'], ['KeyJ', 'ArrowDown'], ['KeyK', 'KeyL', 'ArrowRight']],
  4: [['KeyD', 'KeyS'], ['KeyF', 'ArrowLeft'], ['KeyJ', 'ArrowRight'], ['KeyK', 'KeyL']],
};

function bindGameInput() {
  const canvas = $('#game-canvas');
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      if (!state.game) return;
      state.game.input(laneFromPoint(e.clientX, e.clientY), e.timeStamp);
    },
    { passive: false }
  );
  ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu'].forEach((ev) =>
    canvas.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
  );
  window.addEventListener('keydown', (e) => {
    if (!$('#screen-game').classList.contains('active') || !state.game) return;
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

/** 목숨 0개: 게임이 멈춘 상태로 이어하기 창 */
function onDeath(info) {
  const g = state.game;
  const lv = g.level;
  state.death = info;
  $('#cont-score').textContent = `${fmt(info.score)}점`;
  if (lv.challenge) {
    const r = g.roundInfo || roundInfo(1);
    $('#cont-level').textContent = `무제한 모드 · Lv.${r.round} ${r.name}`;
    $('#cont-progress').style.width = `${Math.min(100, (r.round / 10) * 100)}%`;
    $('#cont-progress-text').textContent = `Lv.${r.round} · ${r.bpm} BPM 까지 왔어요`;
  } else {
    $('#cont-level').textContent = `${lv.id}단계 · ${lv.name}`;
    $('#cont-progress').style.width = `${Math.round(info.progress * 100)}%`;
    $('#cont-progress-text').textContent = `곡 ${Math.round(info.progress * 100)}% 까지 왔어요`;
  }
  $('#btn-continue').hidden = !info.canContinue;
  $('#cont-note').textContent = info.canContinue
    ? `광고를 끝까지 보면 목숨 ${MAX_LIVES}개로 바로 그 자리부터 이어서 쳐요 (한 판에 한 번)`
    : '이어하기는 한 판에 한 번이에요. 다시 도전해 보세요!';
  openModal('modal-continue');
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
    renderLives(MAX_LIVES, 0);
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
  res.runToken = state.runToken;
  state.lastResult = res;
  if (res.challenge) {
    showChallengeResult(res);
    return;
  }
  const lv = getLevel(res.levelId);
  const wasOpen = { next: !progressLocked(res.levelId + 1), endless: !progressLocked(ENDLESS_ID) };
  // 목숨 다 써서 끝난 판은 최고 기록에 안 들어감
  const best = state.auto || res.failed ? { isNew: false } : saveBest(res);
  // 이번 판으로 새로 열린 단계 알림
  if (!state.auto && !res.failed) {
    if (res.levelId === LAST_LEVEL_ID && !wasOpen.endless && !progressLocked(ENDLESS_ID)) setTimeout(() => toast('💎 무제한 모드가 열렸어요! 깰수록 빨라져요', 3200), 2600);
    else if (getLevel(res.levelId + 1) && !wasOpen.next && !progressLocked(res.levelId + 1)) setTimeout(() => toast(`🔓 ${res.levelId + 1}단계가 열렸어요!`, 2600), 2600);
  }
  $('#res-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
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
  $('#res-meta').innerHTML = `정확도 ${(res.accuracy * 100).toFixed(1)}% · 최대 콤보 ${res.maxCombo} · ${timing}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  const next = getLevel(lv.id + 1);
  const nb = $('#btn-next');
  nb.hidden = false;
  if (next) nb.innerHTML = `다음 ${next.id}단계 ${isLocked(next) || progressLocked(next.id) ? icon('lock') : ''}`;
  else nb.innerHTML = `💎 무제한 모드 ${progressLocked(ENDLESS_ID) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = state.auto || res.failed;
  // 끝까지 친 판은 알아서 랭킹에 올림 (점수 올라가는 연출이 끝날 즈음)
  if (!state.auto && !res.failed) setTimeout(() => submitRank(res), 1800);
  $('#btn-vs').hidden = state.auto || res.failed;
  // 박자가 계속 한쪽으로 밀리면 (블루투스 이어폰 등) 한 번에 맞추기
  const hits = (res.counts.perfect || 0) + (res.counts.great || 0) + (res.counts.good || 0);
  if (!state.auto && hits >= 8 && Math.abs(res.avgOffsetMs) >= 40) {
    const nextOffset = clampOffset(state.settings.offsetMs + res.avgOffsetMs);
    if (nextOffset !== state.settings.offsetMs)
      $('#res-meta').innerHTML += `<br><button class="btn btn-sm btn-ghost res-tune" data-action="tune-sync" data-offset="${nextOffset}">박자가 안 맞나요? 내 손에 맞게 자동 보정</button>`;
  }
  // 1:1 대결 결과
  const vs = !state.auto && state.vs && state.vs.levelId === res.levelId ? state.vs : null;
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
  const lv = getLevel(8);
  const best = state.auto ? { isNew: false } : saveBest(res);
  $('#res-level').textContent = `무제한 모드 · ${lv.composer} ${lv.name}`;
  $('#screen-result').classList.remove('failed');
  const g = $('#res-grade');
  g.textContent = `Lv.${res.roundReached}`;
  g.style.color = '#FFD84A';
  const next = DIAMOND_RULES.slice().reverse().find((r) => r.diamonds > res.diamonds);
  $('#res-star-hint').innerHTML =
    res.diamonds === 3
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
  $('#btn-rank').hidden = state.auto || !res.endless;
  $('#btn-vs').hidden = true;
  show('screen-result');
  renderLevels();
  animateResult({ ...res, stars: res.diamonds }, null, true);
  if (!state.auto && res.endless) setTimeout(() => submitRank(res), 1800);
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
  if (!r || r.auto) return;
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
  const text = `⚔️ ${nick}의 1:1 도전장! ${CONFIG.appName} ${lv.name}(${lv.composer}) ${fmt(r.score)}점. 이길 수 있어?`;
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
  $('#vs-in-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  $('#vs-in-score').textContent = `${fmt(ch.score)}점`;
  $('#vs-in-stars').innerHTML = starsHTML(ch.stars);
  openModal('modal-vs');
}

/** 랭킹에 내 점수 올리기. 끝까지 친 판은 결과가 뜨면 알아서 올라가요 (닉네임이 있을 때) */
async function submitRank(r = state.lastResult) {
  // 무제한 모드는 목숨이 다해 끝나도 올림 (최소 Lv.1 은 깨야). 영상용 챌린지(ch4 등)는 안 올림
  const endless = !!r && r.levelId === ENDLESS_ID;
  if (!r || r.auto || (r.challenge && !endless) || (r.failed && !endless) || r.submitted || r.submitting) return;
  if (endless && !(r.roundsCleared >= 1)) return;
  if (demoOnly() || state.api.mode !== 'server') return;
  // 닉네임·인스타 아이디가 없으면 한 번 물어봄 (예전에 아이디 없이 참여한 사람도)
  if (!state.me.guest || state.me.needsIg) {
    askNickname();
    return;
  }
  if (!r.runToken) return;
  r.submitting = true;
  try {
    const out = await state.api.submitScore(
      endless
        ? { runToken: r.runToken, level: ENDLESS_ID, rounds: r.roundsCleared, score: r.score }
        : { runToken: r.runToken, level: r.levelId, score: r.score, maxCombo: r.maxCombo, counts: r.counts }
    );
    r.submitted = true;
    if (endless) toast(out.improved ? `무제한 랭킹에 올라갔어요! Lv.${out.rounds} 클리어 · ${out.rank}위 🏆` : `내 최고 기록(Lv.${out.rounds} 클리어)이 그대로 유지돼요 · ${out.rank}위`, 3200);
    else toast(out.improved ? `랭킹에 올라갔어요! 현재 ${out.rank}위 🏆` : `내 최고 기록(${fmt(out.best)})이 그대로 유지돼요 · ${out.rank}위`, 3000);
  } catch (e) {
    if (e.status === 401) {
      state.me = { verified: false };
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
  openJoin();
}

// 랭킹 닉네임 정하기
function openJoin() {
  $('#join-err').hidden = true;
  $('#join-name').value = state.me.player?.username || load('lastNick', '');
  $('#join-ig').value = load('lastIg', '');
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
    toast(`${name} 님으로 랭킹에 참여해요! ${atHandle()} 팔로우 꼭 해주세요 🙏`, 3200);
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
    ? `${CONFIG.appName} 무제한 모드 Lv.${r.roundsCleared} 클리어 (${r.bpmReached} BPM) ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${url}`
    : `${CONFIG.appName} ${r.levelId}단계 ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${url}`;
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
    $('#share-img').src = canvas.toDataURL('image/png');
    openModal('modal-share');
    copyText(text);
  } catch {
    toast('이 브라우저에선 이미지 저장이 안 돼요. 스크린샷으로 남겨주세요!');
  }
}

// ---------------- 팔로우 안내 (soft: 팔로우 버튼 누르고 돌아오면 열림) ----------------
function openFollowGate(level, onDone, { early = false } = {}) {
  state.follow = { onDone, pending: false };
  const lv = level || getLevel(gateFrom());
  const f = gateFrom();
  $('#follow-title').textContent = f <= 1 ? '인스타 팔로우하고 시작해요!' : `${f}단계부터는 인스타 팔로우!`;
  $('#follow-desc').innerHTML = early
    ? `${f - 1}단계를 아직 안 깼어도 <b>${igWho()}</b> 연결은 지금 해둘 수 있어요. 미리 팔로우해 두면 앞 단계 깨는 순간 바로 이어서 칠 수 있어요!`
    : `<b>${igWho()}</b> 팔로우하면 ${f <= 1 ? '모든 단계가' : `${f}~${LEVELS.length}단계가`} 바로 열려요. 새 곡도 인스타에 제일 먼저 올라와요!`;
  $('#follow-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  $('#follow-mascots').innerHTML = mascotSVG('kong', 'idle') + mascotSVG('jjak', 'idle');
  $('#follow-done').hidden = true;
  openModal('modal-follow');
}

// 팔로우하러 가기를 누르고 이만큼(ms)은 지나야 '시작하기'가 열려요 (눌러보기만 하고 바로 돌아오는 걸 막음)
const FOLLOW_WAIT_MS = 5000;

function followGo() {
  const url = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  if (state.follow) {
    state.follow.pending = true;
    state.follow.at = Date.now();
  }
  save('softPending', { at: Date.now(), levelId: state.levelId });
  const w = window.open(url, '_blank');
  setTimeout(() => {
    if (!w) location.href = url;
  }, 50);
  setTimeout(() => ($('#follow-done').hidden = false), FOLLOW_WAIT_MS);
}

function completeFollow(silent) {
  save('softFollowed', true);
  remove('softPending');
  const done = state.follow && state.follow.onDone;
  state.follow = null;
  renderLevels();
  refreshTitle();
  if (!$('#modal-follow').hidden) {
    $('#follow-mascots').innerHTML = mascotSVG('kong', 'cheer') + mascotSVG('jjak', 'cheer');
    setTimeout(() => {
      closeModal('modal-follow');
      if (done) done();
    }, 700);
  }
  toast(silent ? `${gateFrom()}단계부터 열렸어요! 팔로우 고마워요 🎉` : `팔로우 고마워요! ${gateFrom()}단계부터 열렸어요 🎉`, 2600);
}

// ---------------- 랭킹 ----------------
async function openRank(levelId) {
  state.rankLevel = levelId || state.rankLevel || 1;
  $('#rank-tabs').innerHTML =
    `<button role="tab" data-rank="total" aria-selected="${state.rankLevel === 'total'}">🏆 총 등수</button>` +
    `<button role="tab" data-rank="endless" aria-selected="${state.rankLevel === ENDLESS_ID}">💎 무제한</button>` +
    LEVELS.map((l) => `<button role="tab" data-rank="${l.id}" aria-selected="${l.id === state.rankLevel}">${l.id}단계</button>`).join('');
  openModal('modal-rank');
  await loadRank();
}

async function loadRank() {
  const list = $('#rank-list');
  if (demoOnly()) {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>${hotLevel().id}단계 ${escapeHtml(hotLevel().name)} 점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  try {
    const data = await state.api.leaderboard(state.rankLevel);
    const total = state.rankLevel === 'total';
    const endless = state.rankLevel === ENDLESS_ID;
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
    if (endless) foot.push('무제한 모드 랭킹이에요. 더 높은 단계(Lv.)까지 깬 사람이 위, 같으면 점수가 높은 사람이 위예요.');
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
  const MEDAL = ['🥇', '🥈', '🥉'];
  const top = data.entries.slice(0, 3);
  // 시상대는 2등-1등-3등 순서로 늘어놓기
  const order = [1, 0, 2].filter((i) => top[i]);
  const podium = order
    .map((i) => {
      const e = top[i];
      return `<div class="pod pod${i + 1} ${e.me ? 'me' : ''}"><span class="medal">${MEDAL[i]}</span>
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
  $('#set-speed').value = s.noteSpeed;
  $('#set-offset').value = s.offsetMs;
  $('#set-vibrate').checked = !!s.vibrate;
  $$('#set-band button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.band === (s.band || 'orch')));
  updateSettingLabels();
  $('#settings-account').innerHTML = state.me.guest
    ? `랭킹 닉네임: <b>${escapeHtml(state.me.player?.username)}</b> · <button class="link" data-action="logout">닉네임 지우기</button>`
    : `랭킹 닉네임이 없어요. 끝까지 친 판이 끝나면 정할 수 있어요 · <button class="link" data-action="rank-join">지금 정하기</button>`;
  openModal('modal-settings');
}
function updateSettingLabels() {
  const s = state.settings;
  $('#set-speed-val').textContent = `x${Number(s.noteSpeed).toFixed(1)}`;
  $('#set-offset-val').textContent = s.offsetMs === 0 ? '0ms' : `${s.offsetMs > 0 ? '+' : ''}${s.offsetMs}ms`;
}
function bindSettings() {
  const upd = () => {
    const s = state.settings;
    s.music = Number($('#set-music').value);
    s.sfx = Number($('#set-sfx').value);
    s.noteSpeed = Number($('#set-speed').value);
    s.offsetMs = Number($('#set-offset').value);
    s.vibrate = $('#set-vibrate').checked;
    audio.setVolumes({ music: s.music, sfx: s.sfx });
    saveSettings(s);
    updateSettingLabels();
  };
  ['#set-music', '#set-sfx', '#set-speed', '#set-offset', '#set-vibrate'].forEach((id) => $(id).addEventListener('input', upd));
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
};
const STUDIO_CHALLENGES = [4, 7];
function studioDefaults(id) {
  return isChallengeId(id) ? STUDIO_TEXT.challenge(Number(String(id).slice(2))) : STUDIO_TEXT.level;
}
function pickStudioLevel(id) {
  const st = state.studio;
  const top = $('#studio-top');
  const bottom = $('#studio-bottom');
  // 기본 문구 그대로였으면 새 기본 문구로 바꿔 줌 (직접 쓴 문구는 그대로)
  const all = [STUDIO_TEXT.level, ...STUDIO_CHALLENGES.map(STUDIO_TEXT.challenge)];
  const after = studioDefaults(id);
  if (!top.value.trim() || all.some((d) => d.top === top.value.trim())) top.value = after.top;
  if (!bottom.value.trim() || all.some((d) => d.bottom === bottom.value.trim())) bottom.value = after.bottom;
  st.level = id;
}

/** 영상 화면에 그릴 문구 */
function studioOverlay(lv) {
  const st = state.studio;
  return {
    top: st.top,
    bottom: st.bottom,
    challenge: !!lv.challenge,
    label: lv.challenge ? '레벨업 챌린지' : `${lv.id}단계 · ${lv.composer} ${lv.name}`,
  };
}

function openStudio() {
  if (state.game) state.game.stop();
  const st = state.studio;
  st.active = false;
  $('#screen-game').classList.remove('studio-mode');
  $('#studio-levels').innerHTML =
    STUDIO_CHALLENGES.map(
      (n) => `<button class="chip-hot" data-studio-level="ch${n}" aria-pressed="${st.level === 'ch' + n}">🔥 레벨업 챌린지 Lv.1→${n}</button>`
    ).join('') +
    LEVELS.map((l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${l.id}. ${l.name}</button>`).join('');
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
  show('screen-studio');
}

async function studioStart() {
  const st = state.studio;
  st.top = $('#studio-top').value.trim();
  st.bottom = $('#studio-bottom').value.trim();
  st.file = $('#studio-file').checked;
  save('studio', { level: st.level, mode: st.mode, top: st.top, bottom: st.bottom, file: st.file });
  closeModal('modal-studio-done');
  await audio.unlock();
  st.active = true;
  state.auto = st.mode === 'auto';
  // 9:16 화면을 먼저 깔고 카운트다운
  show('screen-game');
  $('#screen-game').classList.add('studio-mode');
  const lv = playable(st.level) || getLevel(1);
  renderer.studio = studioOverlay(lv);
  setKit(lv);
  await fontsReady();
  await new Promise((r) => requestAnimationFrame(r));
  await renderer.resize(Math.min(3, Math.max(2, 1080 / ($('#game-canvas').clientWidth || 390))));
  renderer.draw({ now: -1, notes: [], approach: 1.5, beatDur: 60 / lv.bpm, combo: 0, score: 0, playing: false }, performance.now() / 1000);
  const box = $('#studio-count');
  box.hidden = false;
  $('#studio-count-msg').textContent = st.file ? '녹화 준비 중… 화면 그대로 영상으로 저장돼요' : '폰 화면 녹화 켜셨나요? 곧 시작해요';
  for (const n of ['3', '2', '1']) {
    $('#studio-count-num').textContent = n;
    await new Promise((r) => setTimeout(r, 800));
    if (!st.active) {
      box.hidden = true;
      return;
    }
  }
  box.hidden = true;
  if (st.file) startRecorder();
  await startLevel(st.level);
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
      if (performance.now() - t0 < (res.challenge ? 2400 : 1500)) requestAnimationFrame(hold);
      else resolve();
    })();
  });
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
    $('#studio-done-msg').textContent = '영상이 만들어졌어요. 저장해서 릴스에 올려보세요!';
  } else {
    video.hidden = true;
    $('#btn-studio-save').hidden = true;
    $('#studio-done-msg').textContent = '화면 녹화를 멈추고 사진 앱에서 확인하세요. 위아래를 9:16으로 잘라 쓰면 딱 맞아요.';
  }
  if (!res.auto && !res.challenge) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `okaystra-${isChallengeId(st.level) ? 'challenge' : st.level + '단계'}.${ext}`, { type: st.blob.type });
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
const ACTIONS = {
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
  'follow-go': followGo,
  'early-follow': () => earlyFollow(getLevel(gateFrom())),
  'follow-done': () => completeFollow(),
  'close-follow': () => {
    state.follow = null;
    closeModal('modal-follow');
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
    startLevel(state.levelId);
  },
  quit: () => {
    closeModal('modal-pause');
    if (state.game) state.game.stop();
    renderLevels();
    show('screen-levels');
  },
  next: () => (typeof state.levelId === 'number' && getLevel(state.levelId + 1) ? tryStart(state.levelId + 1) : tryStart(ENDLESS_ID)),
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
  share: shareResult,
  'close-rank': () => closeModal('modal-rank'),
  'close-settings': () => closeModal('modal-settings'),
  'close-share': () => closeModal('modal-share'),
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
  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitJoin();
  });
  document.addEventListener('click', (e) => {
    const lvBtn = e.target.closest('[data-level]');
    if (lvBtn) {
      const v = lvBtn.dataset.level;
      tryStart(v === ENDLESS_ID ? v : Number(v));
      return;
    }
    const sl = e.target.closest('[data-studio-level]');
    if (sl) {
      const v = sl.dataset.studioLevel;
      pickStudioLevel(/^\d+$/.test(v) ? Number(v) : v);
      $$('#studio-levels button').forEach((b) => b.setAttribute('aria-pressed', b === sl));
      return;
    }
    const sm = e.target.closest('#studio-mode [data-mode]');
    if (sm) {
      state.studio.mode = sm.dataset.mode;
      $$('#studio-mode button').forEach((b) => b.setAttribute('aria-pressed', b === sm));
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
      ACTIONS[a.dataset.action]();
    }
  });
  // 모달 바깥 탭 → 닫기 (일시정지 모달 제외)
  $$('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target !== m || m.id === 'modal-pause' || m.id === 'modal-continue' || m.id === 'modal-ad' || (m.id === 'modal-calibrate' && calib.required)) return;
      if (m.id === 'modal-follow') state.follow = null;
      m.hidden = true;
    })
  );
  // 결과 연출 중 화면을 누르면 바로 끝까지
  $('#screen-result').addEventListener('pointerdown', () => resultAnim.finish && resultAnim.finish());
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        openModal('modal-pause');
      }
    } else {
      // 인스타에서 팔로우하고 돌아옴
      // 5초가 안 지났으면 기다림 (시간이 되면 '시작하기' 버튼이 뜸)
      if (state.follow && state.follow.pending && Date.now() - state.follow.at >= FOLLOW_WAIT_MS) completeFollow();
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
  $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  Object.assign(state.studio, load('studio', {}), { active: false });
  buildTitle();
  bindActions();
  bindGameInput();
  bindSettings();
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  audio.orchOn = state.settings.band !== 'piano';
  audio.prefetchPiano().then(() => audio.orchOn && audio.prefetchOrch());
  refreshToday();

  if (isInApp() && !load('inappDismissed', false)) $('#inapp-note').hidden = false;

  state.api = await createApi(CONFIG);
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'gateFromLevel', 'instagramHandle', 'siteUrl']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
    // DM 코드 인증은 없앰: 예전 'follow' 설정은 팔로우 안내(soft)로
    if (state.cfg.gateMode === 'follow') state.cfg.gateMode = 'soft';
  } catch {}
  const g = devParam('gate');
  if (g === 'open' || g === 'soft') state.cfg.gateMode = g;
  if (devParam('gatefrom')) state.cfg.gateFromLevel = Number(devParam('gatefrom'));
  initAds(state.cfg);
  initTracker({ enabled: state.api.mode === 'server' });
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  renderLevels();
  // 팔로우하러 인스타로 갔다가 페이지가 새로 열린 경우
  const sp = load('softPending', null);
  if (sp && state.cfg.gateMode === 'soft') {
    if (Date.now() - sp.at < 30 * 60 * 1000) completeFollow(true);
    else remove('softPending');
  }
  if (params.get('screen') === 'levels') show('screen-levels');
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
