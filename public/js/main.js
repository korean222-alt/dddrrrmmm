// 콩콩 드럼 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

import { LEVELS, getLevel, levelLanes, isGated, GATE_FROM_LEVEL, DIFFICULTY_WORDS, STAR_RULES } from './charts.js';
import { AudioEngine, playMetronome } from './audio.js';
import { Renderer } from './render.js';
import { Game } from './game.js';
import { createApi } from './api.js';
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
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/>',
};
const STAR_PATH = 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.22 6.5L12 17.3l-5.82 3.15 1.22-6.5-4.8-4.55 6.55-.85z';
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
  studio: { level: 4, mode: 'auto', top: '엄지 두 개로 따라 쳐봐!', bottom: '프로필 링크에서 바로 해보기', file: false, active: false },
  levelId: 1,
  game: null,
  lastResult: null,
  runToken: null,
  verify: null,
  rankLevel: 4,
  vs: null, // 받은 도전장 { name, levelId, score, stars, grade, accuracy, timeline }
};

// ---------------- 유틸 ----------------
function show(screenId) {
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

const isLocalDev = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || params.get('dev') === '1';
/** 서버 없이 배포된 상태(정적 호스팅): 랭킹은 아직 안 열림 */
const demoOnly = () => state.api && state.api.mode === 'mock' && !isLocalDev();
const SOON = () => `랭킹은 곧 열려요! ${atHandle()} 팔로우하고 기다려 주세요`;

const gateFrom = () => Number(state.cfg.gateFromLevel) || GATE_FROM_LEVEL;
/** 아직 팔로우 안 한 상태인지 (soft: 팔로우 버튼 눌렀는지 / follow: DM 인증했는지) */
function needsFollow() {
  const m = state.cfg.gateMode;
  if (state.me.verified) return false;
  if (m === 'follow') return true;
  if (m === 'soft') return !load('softFollowed', false);
  return false;
}
function isLocked(level) {
  return isGated(level, gateFrom()) && needsFollow();
}
/** 잠긴 단계를 누르면: soft 는 팔로우 안내, follow 는 DM 인증 */
function requireFollow(level, onDone) {
  if (state.cfg.gateMode === 'follow') openVerify('unlock', onDone, level);
  else openFollowGate(level, onDone);
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
  const q = getLevel(params.get('level')) || getLevel(1);
  state.levelId = q.id;
  $('[data-action="quickstart"]').innerHTML = `${icon('play')} 바로 시작 <small>${q.id}단계</small>`;
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

function refreshTitle() {
  refreshToday();
  const hot = getLevel(Math.max(4, gateFrom())) || getLevel(4);
  const gated = state.cfg.gateMode !== 'open' && isGated(hot, gateFrom());
  $('#hot-name').textContent = `${hot.id}단계 도전 · ${hot.name}`;
  $('.lock-ico').hidden = !isLocked(hot);
  const tag = $('.hot-tag');
  tag.hidden = !gated;
  tag.textContent = `${gateFrom()}단계부터 인스타 팔로우`;
  const foot = $('#title-foot');
  const free = freeRangeText();
  if (state.me.verified) {
    foot.innerHTML = `<b>@${escapeHtml(state.me.player?.username || '')}</b> 님, 오늘도 쿵짝!`;
  } else if (needsFollow()) {
    foot.innerHTML = `${free ? free + ' 바로! ' : ''}<b>${gateFrom()}단계부터는 ${igWho()} 팔로우</b>하면 열려요`;
  } else {
    foot.innerHTML = handle() ? `만든 곳 <a href="https://instagram.com/${handle()}" target="_blank" rel="noopener">${atHandle()}</a> · 새 곡 소식은 인스타에서!` : '모두 아는 클래식 명곡에 맞춰 드럼을 쳐 보세요!';
  }
}

// ---------------- 레벨 목록 ----------------
function renderLevels() {
  const bests = loadBests();
  let gateShown = false;
  $('#level-list').innerHTML = LEVELS.map((lv) => {
    const locked = isLocked(lv);
    const b = bests[lv.id];
    const meta = locked
      ? `<span class="lockline">${icon('lock')} 인스타 팔로우</span>`
      : b
        ? `${starsHTML(b.stars || 0, 'sm')}<span>${fmt(b.score)}</span>`
        : `${starsHTML(0, 'sm')}<span>NEW</span>`;
    // 잠기는 첫 단계 위에 "여기부터 팔로우" 구분선
    let divider = '';
    if (!gateShown && state.cfg.gateMode !== 'open' && isGated(lv, gateFrom())) {
      gateShown = true;
      divider = `<div class="gate-divider">${icon('insta')} ${lv.id}단계부터는 ${igWho()} 팔로우하면 열려요</div>`;
    }
    return `${divider}<button class="level-card ${locked ? 'locked' : ''}" data-level="${lv.id}">
      <div class="lv"><span>${lv.id}<small>단계</small></span></div>
      <div class="info"><h4>${lv.name} <small>${lv.composer}</small></h4><p>${lv.tagline}</p>${diffHTML(lv.difficulty)}</div>
      <div class="meta">${meta}</div>
    </button>`;
  }).join('');
  const free = freeRangeText();
  $('#levels-foot').innerHTML = needsFollow()
    ? `${free ? free + ' 누구나 바로! ' : ''}${gateFrom()}단계부터는 ${igWho()} 팔로우하면 열려요.<br>별 3개: ${STAR_RULES[0].text}`
    : `왼쪽 엄지는 <b style="color:#D0581F">킥(쿵)</b>, 오른쪽 엄지는 <b style="color:#2F86CF">스네어(짝)</b>. 별 3개: ${STAR_RULES[0].text}`;
}

// ---------------- 게임 ----------------
async function tryStart(id) {
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

async function startLevel(id) {
  const lv = getLevel(id);
  state.levelId = id;
  await audio.unlock();
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });
  if (state.game) state.game.stop();
  closeModal('modal-pause');
  show('screen-game');
  $('#hud-lv').textContent = `${lv.id}단계`;
  $('#hud-name').textContent = `${lv.name} · ${lv.composer}`;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  const st = state.studio;
  const vs = !st.active && state.vs && state.vs.levelId === id ? state.vs : null;
  $('#hud-vs').hidden = !vs;
  if (vs) {
    $('#vs-name').textContent = vs.name;
    $('#vs-me').textContent = '0';
    $('#vs-op').textContent = '0';
    $('#vs-fill').style.width = '50%';
  }
  // 피아노 샘플이 아직이면 잠깐 기다림 (최대 2.5초, 안 되면 합성음으로)
  await Promise.race([audio.loadPiano(), new Promise((r) => setTimeout(r, 2500))]);
  $('#screen-game').classList.toggle('studio-mode', st.active);
  renderer.studio = st.active ? { top: st.top, bottom: st.bottom, label: `${lv.id}단계 · ${lv.composer} ${lv.name}` } : null;
  setKit(lv);
  await fontsReady();
  await new Promise((r) => requestAnimationFrame(r));
  const cw = $('#game-canvas').clientWidth || window.innerWidth;
  await renderer.resize(st.active ? Math.min(3, Math.max(2, 1080 / cw)) : 2);
  state.runToken = null;
  state.api
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
  const last = { score: -1, p: -1, op: -1 };
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
      last.score = h.score;
      last.p = p;
    },
    onEnd: (res) => (state.studio.active ? studioFinish(res) : showResult(res)),
  });
  state.game.start();
}

/** 단계에 맞게 화면 레인(악기) 세팅 */
function setKit(lv) {
  renderer.laneOrder = levelLanes(lv);
  renderer.newLane = lv.newInstrument ?? -1;
}

/** 피아노 타일처럼 세로 줄: 누른 줄의 악기 (악기 그림을 정확히 안 눌러도 됨) */
function laneFromX(x) {
  const r = $('#game-canvas').getBoundingClientRect();
  return renderer.laneAt(x - r.left);
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
      state.game.input(laneFromX(e.clientX), e.timeStamp);
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
  // 3초 카운트다운 후 재개 (손가락 올릴 시간)
  for (const n of ['3', '2', '1']) {
    toast(n, 450);
    await new Promise((r) => setTimeout(r, 450));
  }
  await audio.unlock();
  g.resume();
}

// ---------------- 결과 ----------------
function showResult(res) {
  res.runToken = state.runToken;
  state.lastResult = res;
  const lv = getLevel(res.levelId);
  const best = state.auto ? { isNew: false } : saveBest(res);
  $('#res-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  const g = $('#res-grade');
  g.textContent = res.grade;
  g.style.color = gradeColor(res.grade);
  const nextRule = STAR_RULES.slice().reverse().find((r) => r.stars > res.stars);
  $('#res-star-hint').innerHTML =
    res.stars === 3
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
  nb.hidden = !next;
  if (next) nb.innerHTML = `다음 ${next.id}단계 ${isLocked(next) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = state.auto;
  $('#btn-vs').hidden = state.auto;
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

const clampOffset = (ms) => Math.max(-200, Math.min(200, Math.round(ms / 5) * 5));

/**
 * 결과 연출: 점수가 0부터 '따라라라' 올라감 → '딴!' → 별이 하나씩 '띵! 띵! 띵!' → 등급 도장 (+ 1:1 승패)
 * 화면을 누르면 바로 끝까지 건너뜀.
 */
const resultAnim = { id: 0, finish: null };
function animateResult(res, outcome) {
  const id = ++resultAnim.id;
  const alive = () => resultAnim.id === id;
  const scoreEl = $('#res-score');
  const grade = $('#res-grade');
  const vsBox = $('#res-vs');
  const hint = $('#res-star-hint');
  $('#res-stars').innerHTML = starsHTML(0, 'big seq');
  const starEls = $$('#res-stars svg');
  grade.classList.add('pending');
  hint.classList.add('pending');
  vsBox.hidden = true;
  scoreEl.classList.remove('land');
  scoreEl.textContent = '0';
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => alive() && fn(), ms));

  const ratio = Math.min(1, res.score / (res.maxScore || 1));
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
  const text = `⚔️ ${nick}의 1:1 도전장! 콩콩 드럼 ${lv.name}(${lv.composer}) ${fmt(r.score)}점. 이길 수 있어?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: '콩콩 드럼 1:1 도전장', text, url });
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

async function submitRank() {
  const r = state.lastResult;
  if (!r || r.auto) return;
  if (demoOnly()) {
    toast(SOON(), 3000);
    return;
  }
  if (!state.me.verified) {
    openVerify('ranking', submitRank);
    return;
  }
  if (!r.runToken) {
    toast('기록 확인용 정보가 없어요. 한 판 더 해서 등록해 주세요!');
    return;
  }
  try {
    const out = await state.api.submitScore({
      runToken: r.runToken,
      level: r.levelId,
      score: r.score,
      maxCombo: r.maxCombo,
      counts: r.counts,
    });
    r.submitted = true;
    toast(out.improved ? `등록 완료! 현재 ${out.rank}위` : `최고 기록(${fmt(out.best)})보다 낮아서 유지돼요 · ${out.rank}위`);
    openRank(r.levelId);
  } catch (e) {
    if (e.status === 401) {
      state.me = { verified: false };
      openVerify('ranking', submitRank);
    } else if (e.message === 'run_used') toast('이미 등록한 판이에요.');
    else toast('이 기록은 등록할 수 없어요. 다시 플레이해 주세요.');
  }
}

async function shareResult() {
  const r = state.lastResult;
  if (!r) return;
  toast('결과 카드 만드는 중…', 1200);
  const url = siteUrl();
  const canvas = await makeShareCard(r, { siteUrl: url, handle: handle() });
  const text = `콩콩 드럼 ${r.levelId}단계 ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${url}`;
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], `kongkong-lv${r.levelId}.png`, { type: 'image/png' });
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
function openFollowGate(level, onDone) {
  state.follow = { onDone, pending: false };
  const lv = level || getLevel(gateFrom());
  const f = gateFrom();
  $('#follow-title').textContent = f <= 1 ? '인스타 팔로우하고 시작해요!' : `${f}단계부터는 인스타 팔로우!`;
  $('#follow-desc').innerHTML = `<b>${igWho()}</b> 팔로우하면 ${f <= 1 ? '모든 단계가' : `${f}~${LEVELS.length}단계가`} 바로 열려요. 새 곡도 인스타에 제일 먼저 올라와요!`;
  $('#follow-level').textContent = `${lv.id}단계 · ${lv.composer} ${lv.name}`;
  $('#follow-mascots').innerHTML = mascotSVG('kong', 'idle') + mascotSVG('jjak', 'idle');
  $('#follow-done').hidden = true;
  openModal('modal-follow');
}

function followGo() {
  const url = handle() ? `https://www.instagram.com/${handle()}/` : 'https://www.instagram.com/';
  if (state.follow) state.follow.pending = true;
  save('softPending', { at: Date.now(), levelId: state.levelId });
  const w = window.open(url, '_blank');
  setTimeout(() => {
    if (!w) location.href = url;
  }, 50);
  setTimeout(() => ($('#follow-done').hidden = false), 1200);
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

// ---------------- 팔로우 인증 (DM 코드) ----------------
function setVerifyStatus(st, text) {
  const el = $('#verify-status');
  el.dataset.state = st;
  $('#verify-status-text').innerHTML = text;
}

async function openVerify(purpose, onDone, level, existing) {
  stopPolling();
  state.verify = { purpose, onDone, code: null };
  const lv = level || getLevel(gateFrom()) || getLevel(4);
  $('#verify-title').textContent = purpose === 'ranking' ? '랭킹에 내 인스타 아이디 올리기' : `${gateFrom()}단계부터는 인스타 팔로우!`;
  $('#verify-desc').textContent =
    purpose === 'ranking'
      ? '팔로우하고 아래 코드를 DM으로 보내면 인스타 아이디로 점수가 올라가요. 1위는 릴스에 소개될 수도!'
      : '팔로우하고 아래 코드를 DM으로 보내면 바로 열려요. 딱 한 번이면 돼요.';
  const f = $('#verify-follow');
  f.textContent = atHandle();
  f.href = handle() ? `https://instagram.com/${handle()}` : '#';
  $('#verify-mascots').innerHTML = mascotSVG('kong', 'idle') + mascotSVG('jjak', 'idle');
  $('#verify-dev').hidden = !state.cfg.devSimulate || (demoOnly() && !params.has('gate'));
  openModal('modal-verify');
  if (existing) {
    state.verify.code = existing.code;
    $('#verify-code').textContent = existing.display;
    setVerifyStatus('pending', 'DM 기다리는 중…');
    startPolling();
    return;
  }
  $('#verify-code').textContent = '······';
  setVerifyStatus('pending', '코드 만드는 중…');
  try {
    const rec = await state.api.createCode(purpose);
    state.verify.code = rec.code;
    $('#verify-code').textContent = rec.display;
    save('pendingCode', { code: rec.code, display: rec.display, purpose, levelId: lv.id, expiresAt: rec.expiresAt });
    setVerifyStatus('pending', 'DM 기다리는 중… 보내면 몇 초 안에 열려요');
    startPolling();
  } catch (e) {
    setVerifyStatus('error', e.status === 429 ? '잠시 후 다시 시도해 주세요.' : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

function stopPolling() {
  if (state.verify && state.verify.timer) clearInterval(state.verify.timer);
  if (state.verify) state.verify.timer = null;
}
function startPolling() {
  stopPolling();
  state.verify.timer = setInterval(pollVerify, 2000);
  pollVerify();
}

async function pollVerify() {
  const v = state.verify;
  if (!v || !v.code || v.busy) return;
  v.busy = true;
  try {
    const r = await state.api.pollCode(v.code);
    handleVerifyStatus(r);
  } catch {
    /* 네트워크 일시 오류는 다음 폴링에서 재시도 */
  } finally {
    v.busy = false;
  }
}

function handleVerifyStatus(r) {
  const v = state.verify;
  if (!v) return;
  if (r.status === 'verified') {
    stopPolling();
    remove('pendingCode');
    state.me = { verified: true, player: r.player };
    setVerifyStatus('verified', `팔로우 확인 완료! <b>@${r.player?.username || ''}</b> 님 환영해요`);
    $('#verify-mascots').innerHTML = mascotSVG('kong', 'cheer') + mascotSVG('jjak', 'cheer');
    renderLevels();
    refreshTitle();
    const done = v.onDone;
    state.verify = null;
    setTimeout(() => {
      closeModal('modal-verify');
      if (done) done();
    }, 1300);
  } else if (r.status === 'not_following') {
    setVerifyStatus('not_following', `아직 팔로우가 확인되지 않았어요.<br><b>${atHandle()}</b> 팔로우하고 같은 코드를 한 번 더 보내주세요!`);
    $('#verify-mascots').innerHTML = mascotSVG('kong', 'miss') + mascotSVG('jjak', 'miss');
  } else if (r.status === 'expired') {
    stopPolling();
    remove('pendingCode');
    setVerifyStatus('expired', '코드가 만료됐어요. <button class="link" data-action="new-code">새 코드 받기</button>');
  } else {
    setVerifyStatus('pending', 'DM 기다리는 중… 보내면 몇 초 안에 열려요');
  }
}

async function openDm() {
  const code = $('#verify-code').textContent;
  const ok = await copyText(code);
  toast(ok ? `${code} 복사했어요! DM 창에 붙여넣기 하세요` : `DM에 ${code} 를 보내주세요`);
  const url = handle() ? `https://ig.me/m/${handle()}` : 'https://www.instagram.com/direct/inbox/';
  setTimeout(() => {
    const w = window.open(url, '_blank');
    if (!w) location.href = url;
  }, 350);
}

async function restorePending() {
  const p = load('pendingCode', null);
  if (!p) return;
  if (p.expiresAt && p.expiresAt < Date.now()) {
    remove('pendingCode');
    return;
  }
  try {
    const r = await state.api.pollCode(p.code);
    if (r.status === 'verified') {
      remove('pendingCode');
      state.me = { verified: true, player: r.player };
      toast(`팔로우 확인 완료! 4~6단계가 열렸어요 🎉`, 3200);
      renderLevels();
      refreshTitle();
    } else if (r.status === 'pending' || r.status === 'not_following') {
      const lv = getLevel(p.levelId) || getLevel(4);
      const after = p.purpose === 'ranking' ? submitRank : () => startLevel(lv.id);
      await openVerify(p.purpose, after, lv, p);
      handleVerifyStatus(r);
    } else remove('pendingCode');
  } catch {}
}

// ---------------- 랭킹 ----------------
async function openRank(levelId) {
  state.rankLevel = levelId || state.rankLevel || 4;
  $('#rank-tabs').innerHTML = LEVELS.map(
    (l) => `<button role="tab" data-rank="${l.id}" aria-selected="${l.id === state.rankLevel}">${l.id}단계</button>`
  ).join('');
  openModal('modal-rank');
  await loadRank();
}

async function loadRank() {
  const list = $('#rank-list');
  if (demoOnly()) {
    list.innerHTML = `<div class="rank-empty">${SOON()}<br><br>4단계 더블 킥 점수를 미리 올려두세요 🥁</div>`;
    $('#rank-foot').textContent = '';
    return;
  }
  list.innerHTML = '<div class="rank-empty"><span class="spinner" style="display:inline-block"></span></div>';
  try {
    const data = await state.api.leaderboard(state.rankLevel);
    if (!data.entries.length) list.innerHTML = '<div class="rank-empty">아직 아무도 없어요. 첫 1위의 주인공이 되어보세요!</div>';
    else
      list.innerHTML = data.entries
        .slice(0, 50)
        .map(
          (e) => `<div class="rank-row ${e.rank <= 3 ? 'top' + e.rank : ''} ${e.me ? 'me' : ''}">
          <span class="r">${e.rank}</span><span class="u">@${escapeHtml(e.username)}</span>
          <span class="s">${fmt(e.score)}</span><span class="g" style="color:${gradeColor(e.grade)}">${e.grade || ''}</span></div>`
        )
        .join('');
    const foot = [];
    if (data.sample) foot.push('서버 없이 내 기록만 보여주는 테스트 모드예요.');
    if (!state.me.verified) foot.push('내 아이디를 올리려면 결과 화면에서 "랭킹 등록"을 누르세요.');
    else if (data.me) foot.push(`내 순위: ${data.me.rank}위`);
    $('#rank-foot').textContent = foot.join(' ');
  } catch {
    list.innerHTML = '<div class="rank-empty">랭킹을 불러오지 못했어요.</div>';
  }
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
  updateSettingLabels();
  $('#settings-account').innerHTML = state.me.verified
    ? `@${escapeHtml(state.me.player?.username)} 로 인증됨 · <button class="link" data-action="logout">인증 해제</button>`
    : state.cfg.gateMode === 'soft' && load('softFollowed', false)
      ? `팔로우 고마워요! 랭킹 등록 때 DM 인증을 한 번 더 해요.`
      : `팔로우 인증 전이에요. ${gateFrom()}단계 도전이나 랭킹 등록 때 인증할 수 있어요.`;
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
  $('#set-sfx').addEventListener('change', async () => {
    await audio.unlock();
    audio.snare();
  });
}

const calib = { taps: [], clicks: [], active: false };
async function startCalibration() {
  await audio.unlock();
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
    $('#calib-result').textContent = '탭이 너무 적어요. 다시 해볼까요?';
    return;
  }
  diffs.sort((a, b) => a - b);
  const med = diffs[Math.floor(diffs.length / 2)];
  const ms = Math.max(-200, Math.min(200, Math.round((med * 1000) / 5) * 5));
  state.settings.offsetMs = ms;
  saveSettings(state.settings);
  $('#set-offset').value = ms;
  updateSettingLabels();
  $('#calib-result').textContent = `보정값 ${ms > 0 ? '+' : ''}${ms}ms 저장했어요`;
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

function openStudio() {
  if (state.game) state.game.stop();
  const st = state.studio;
  st.active = false;
  $('#screen-game').classList.remove('studio-mode');
  $('#studio-levels').innerHTML = LEVELS.map(
    (l) => `<button data-studio-level="${l.id}" aria-pressed="${l.id === st.level}">${l.id}. ${l.name}</button>`
  ).join('');
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
  const lvCheck = getLevel(st.level);
  if (isLocked(lvCheck)) {
    requireFollow(lvCheck, studioStart);
    return;
  }
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
  const lv = getLevel(st.level);
  renderer.studio = { top: st.top, bottom: st.bottom, label: `${lv.id}단계 · ${lv.composer} ${lv.name}` };
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
      renderer.draw({ now: g.endTime, notes: [], approach: g.approach, beatDur: g.beat, combo: g.combo, score: res.score, playing: false, finished: true }, rt);
      if (performance.now() - t0 < 1500) requestAnimationFrame(hold);
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
  if (!res.auto) saveBest(res);
  openModal('modal-studio-done');
}

async function studioSave() {
  const st = state.studio;
  if (!st.blob) return;
  const ext = st.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([st.blob], `kongkong-${st.level}단계.${ext}`, { type: st.blob.type });
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
  quickstart: () => tryStart(state.levelId),
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
  today: () => tryStart(todayLevel().id),
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
    tryStart(ch.levelId);
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
    b.remove();
    toast(`박자 보정 ${state.settings.offsetMs > 0 ? '+' : ''}${state.settings.offsetMs}ms 저장! 다시 해 보세요`, 2800);
  },
  'play-hot': () => tryStart(Math.max(4, gateFrom())),
  'follow-go': followGo,
  'follow-done': () => completeFollow(),
  'close-follow': () => {
    state.follow = null;
    closeModal('modal-follow');
  },
  ranking: () => openRank(state.lastResult ? state.lastResult.levelId : 4),
  settings: openSettings,
  pause: togglePause,
  resume: resumeGame,
  retry: () => {
    closeModal('modal-pause');
    startLevel(state.levelId);
  },
  quit: () => {
    closeModal('modal-pause');
    if (state.game) state.game.stop();
    renderLevels();
    show('screen-levels');
  },
  next: () => tryStart(state.levelId + 1),
  'submit-rank': submitRank,
  share: shareResult,
  'close-verify': () => {
    stopPolling();
    closeModal('modal-verify');
  },
  'close-rank': () => closeModal('modal-rank'),
  'close-settings': () => closeModal('modal-settings'),
  'close-share': () => closeModal('modal-share'),
  'close-calibrate': () => closeModal('modal-calibrate'),
  'copy-code': async () => {
    const ok = await copyText($('#verify-code').textContent);
    toast(ok ? '복사했어요!' : '코드를 길게 눌러 복사해 주세요');
  },
  'open-dm': openDm,
  'new-code': () => state.verify && openVerify(state.verify.purpose, state.verify.onDone),
  'sim-follow': async () => {
    if (!state.verify?.code) return;
    try {
      await state.api.simulateDm(state.verify.code);
    } catch (e) {
      toast('테스트 처리 실패: ' + e.message);
    }
    pollVerify();
  },
  'sim-nofollow': async () => {
    if (!state.verify?.code) return;
    try {
      await state.api.simulateDm(state.verify.code, { notFollowing: true });
    } catch (e) {
      toast('테스트 처리 실패: ' + e.message);
    }
    pollVerify();
  },
  calibrate: () => {
    $('#calib-count').textContent = '준비';
    $('#calib-result').textContent = '';
    openModal('modal-calibrate');
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
    toast('인증을 해제했어요');
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
  document.addEventListener('click', (e) => {
    const lvBtn = e.target.closest('[data-level]');
    if (lvBtn) {
      tryStart(Number(lvBtn.dataset.level));
      return;
    }
    const sl = e.target.closest('[data-studio-level]');
    if (sl) {
      state.studio.level = Number(sl.dataset.studioLevel);
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
      state.rankLevel = Number(tab.dataset.rank);
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
      if (e.target !== m || m.id === 'modal-pause') return;
      if (m.id === 'modal-verify') stopPolling();
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
  const wake = () => audio.unlock().then(() => audio.loadPiano());
  window.addEventListener('pointerdown', wake, { once: true, capture: true });
  window.addEventListener('keydown', wake, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        openModal('modal-pause');
      }
    } else {
      if (state.verify && state.verify.code) pollVerify();
      // 인스타에서 팔로우하고 돌아옴
      if (state.follow && state.follow.pending) completeFollow();
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
  audio.prefetchPiano();
  refreshToday();

  if (isInApp() && !load('inappDismissed', false)) $('#inapp-note').hidden = false;

  state.api = await createApi(CONFIG);
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'gateFromLevel', 'instagramHandle', 'devSimulate', 'codePrefix', 'siteUrl']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
  } catch {}
  const g = params.get('gate');
  if (g === 'follow' || g === 'open' || g === 'soft') state.cfg.gateMode = g;
  if (params.get('gatefrom')) state.cfg.gateFromLevel = Number(params.get('gatefrom'));
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  renderLevels();
  restorePending();
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
  if (params.get('debug') === '1') window.__kk = { state, audio, renderer };
}

boot();
