// 콩콩 드럼 — 화면 전환, 잠금(팔로우 인증), 랭킹, 설정을 묶는 앱 본체

import { LEVELS, getLevel } from './charts.js';
import { AudioEngine, playMetronome } from './audio.js';
import { Renderer } from './render.js';
import { Game } from './game.js';
import { createApi } from './api.js';
import { CONFIG } from './config.js';
import { mascotSVG, drumSVG } from './mascot.js';
import { loadSettings, saveSettings, loadBests, saveBest, load, save, remove } from './storage.js';
import { makeShareCard, gradeColor } from './sharecard.js';

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
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const audio = new AudioEngine();
const renderer = new Renderer($('#game-canvas'));

const state = {
  api: null,
  cfg: { ...CONFIG },
  me: { verified: false },
  settings: loadSettings(),
  auto: params.get('auto') === '1',
  levelId: 1,
  game: null,
  lastResult: null,
  runToken: null,
  verify: null,
  rankLevel: 4,
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
const isInApp = () => /Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(navigator.userAgent);

function isLocked(level) {
  return !!level.gated && state.cfg.gateMode === 'follow' && !state.me.verified;
}

// ---------------- 타이틀 ----------------
function buildTitle() {
  $$('#title-stage .stage-drum').forEach((el) => {
    const kind = el.dataset.lane === '0' ? 'kong' : 'jjak';
    el.querySelector('.stage-mascot').innerHTML = mascotSVG(kind, 'idle');
    el.querySelector('.stage-drumimg').innerHTML = drumSVG(kind);
    el.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      await audio.unlock();
      if (el.dataset.lane === '0') audio.kick();
      else audio.snare();
      el.classList.remove('hit');
      void el.offsetWidth;
      el.classList.add('hit');
      const m = el.querySelector('.stage-mascot');
      m.innerHTML = mascotSVG(kind, 'hit');
      clearTimeout(el._t);
      el._t = setTimeout(() => (m.innerHTML = mascotSVG(kind, 'idle')), 220);
    });
  });
  const q = getLevel(params.get('level')) || getLevel(1);
  state.levelId = q.id;
  $('[data-action="quickstart"]').innerHTML = `${icon('play')} 바로 시작 <small>Lv.${q.id}${state.auto ? ' · AUTO' : ''}</small>`;
}

function refreshTitle() {
  const hot = getLevel(4);
  $('.lock-ico').hidden = !isLocked(hot);
  const foot = $('#title-foot');
  if (state.cfg.gateMode === 'follow' && !state.me.verified) {
    foot.innerHTML = `Lv.1~3은 바로 플레이! <b>${atHandle()}</b> 팔로우 인증하면 Lv.4~6과 랭킹이 열려요`;
  } else if (state.me.verified) {
    foot.innerHTML = `<b>@${state.me.player?.username || ''}</b> 님, 오늘도 쿵짝!`;
  } else {
    foot.innerHTML = handle() ? `만든 곳 <a href="https://instagram.com/${handle()}" target="_blank" rel="noopener">${atHandle()}</a> · 새 레벨 소식은 인스타에서!` : '릴스 보고 왔다면 Lv.4 쿵쿵 폭주부터!';
  }
}

// ---------------- 레벨 목록 ----------------
function renderLevels() {
  const bests = loadBests();
  $('#level-list').innerHTML = LEVELS.map((lv) => {
    const locked = isLocked(lv);
    const b = bests[lv.id];
    const meta = locked
      ? `<span class="lockline">${icon('lock')} 팔로우 인증</span>`
      : b
        ? `<span class="grade" style="color:${gradeColor(b.grade)}">${b.grade}</span><span>${fmt(b.score)}</span>`
        : `<span>NEW</span>`;
    return `<button class="level-card ${lv.hot ? 'hot' : ''} ${locked ? 'locked' : ''}" data-level="${lv.id}">
      <div class="lv"><span><small>Lv.</small>${lv.id}</span></div>
      <div><h4>${lv.name}</h4><p>${lv.tagline} · ${lv.bpm} BPM</p></div>
      <div class="meta">${meta}</div>
      ${lv.hot ? '<span class="tag">릴스 그 레벨</span>' : ''}
    </button>`;
  }).join('');
  $('#levels-foot').innerHTML =
    state.cfg.gateMode === 'follow' && !state.me.verified
      ? `Lv.1~3은 누구나 바로! Lv.4부터는 ${atHandle()} 팔로우 인증 한 번이면 열려요.`
      : '왼쪽 엄지는 <b style="color:var(--kick)">쿵</b>, 오른쪽 엄지는 <b style="color:var(--snare)">짝</b>. 노트가 드럼에 닿을 때 눌러요!';
}

// ---------------- 게임 ----------------
async function tryStart(id) {
  const lv = getLevel(id);
  if (!lv) return;
  if (isLocked(lv)) {
    openVerify('unlock', () => startLevel(id), lv);
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
  $('#hud-lv').textContent = `Lv.${lv.id}`;
  $('#hud-name').textContent = lv.name;
  $('#hud-score').textContent = '0';
  $('#hud-progress').style.width = '0%';
  $('#auto-badge').hidden = !state.auto;
  await fontsReady();
  await renderer.resize();
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
        openVerify('unlock', () => startLevel(id), lv);
      }
    });
  let last = { score: -1, p: -1 };
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
      last = { score: h.score, p };
    },
    onEnd: (res) => showResult(res),
  });
  state.game.start();
}

function laneFromX(x) {
  return x < window.innerWidth / 2 ? 0 : 1;
}

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
  const KICK = ['KeyF', 'KeyD', 'KeyA', 'ArrowLeft'];
  const SNARE = ['KeyJ', 'KeyK', 'KeyL', 'ArrowRight'];
  window.addEventListener('keydown', (e) => {
    if (!$('#screen-game').classList.contains('active') || !state.game) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      togglePause();
      return;
    }
    if (e.repeat) return;
    if (KICK.includes(e.code)) state.game.input(0, e.timeStamp);
    else if (SNARE.includes(e.code)) state.game.input(1, e.timeStamp);
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
  $('#res-level').textContent = `Lv.${lv.id} ${lv.name}`;
  const g = $('#res-grade');
  g.textContent = res.grade;
  g.style.color = gradeColor(res.grade);
  g.style.animation = 'none';
  void g.offsetWidth;
  g.style.animation = '';
  $('#res-new').hidden = !best.isNew;
  const badge = $('#res-badge');
  badge.hidden = !res.fullCombo;
  badge.textContent = res.counts.perfect === res.total ? 'ALL PERFECT' : 'FULL COMBO';
  $('#res-score').textContent = fmt(res.score);
  for (const k of ['perfect', 'great', 'good', 'miss']) $('#res-' + k).textContent = res.counts[k];
  const face = res.grade === 'D' ? 'miss' : res.grade === 'C' ? 'idle' : 'cheer';
  $('#res-mascots').innerHTML = mascotSVG('kong', face) + mascotSVG('jjak', face);
  const timing =
    Math.abs(res.avgOffsetMs) < 15 ? '타이밍 딱 좋아요' : res.avgOffsetMs < 0 ? `평균 ${-res.avgOffsetMs}ms 빨라요` : `평균 ${res.avgOffsetMs}ms 늦어요`;
  $('#res-meta').innerHTML = `정확도 ${(res.accuracy * 100).toFixed(1)}% · 최대 콤보 ${res.maxCombo} · ${timing}${state.auto ? '<br>(자동 연주 — 기록 저장 안 됨)' : ''}`;
  const next = getLevel(lv.id + 1);
  const nb = $('#btn-next');
  nb.hidden = !next;
  if (next) nb.innerHTML = `다음 Lv.${next.id} ${isLocked(next) ? icon('lock') : ''}`;
  $('#btn-rank').hidden = state.auto;
  show('screen-result');
  renderLevels();
}

async function submitRank() {
  const r = state.lastResult;
  if (!r || r.auto) return;
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
  const siteUrl = state.cfg.siteUrl || location.origin + location.pathname.replace(/index\.html$/, '');
  const canvas = await makeShareCard(r, { siteUrl, handle: handle() });
  const text = `콩콩 드럼 Lv.${r.levelId} ${r.grade} ${fmt(r.score)}점! 너도 엄지로 쳐 봐 👉 ${siteUrl}`;
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

// ---------------- 팔로우 인증 (DM 코드) ----------------
function setVerifyStatus(st, text) {
  const el = $('#verify-status');
  el.dataset.state = st;
  $('#verify-status-text').innerHTML = text;
}

async function openVerify(purpose, onDone, level, existing) {
  stopPolling();
  state.verify = { purpose, onDone, code: null };
  const lv = level || getLevel(4);
  $('#verify-title').textContent = purpose === 'ranking' ? '랭킹에 내 인스타 아이디 올리기' : `Lv.${lv.id}부터는 팔로워 전용!`;
  $('#verify-desc').textContent =
    purpose === 'ranking'
      ? '팔로우하고 아래 코드를 DM으로 보내면 인스타 아이디로 점수가 올라가요. 1위는 릴스에 소개될 수도!'
      : '팔로우하고 아래 코드를 DM으로 보내면 바로 열려요. 딱 한 번만 하면 돼요.';
  const f = $('#verify-follow');
  f.textContent = atHandle();
  f.href = handle() ? `https://instagram.com/${handle()}` : '#';
  $('#verify-mascots').innerHTML = mascotSVG('kong', 'idle') + mascotSVG('jjak', 'idle');
  $('#verify-dev').hidden = !state.cfg.devSimulate;
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
      toast(`팔로우 확인 완료! Lv.4~6이 열렸어요 🎉`, 3200);
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
    (l) => `<button role="tab" data-rank="${l.id}" aria-selected="${l.id === state.rankLevel}">Lv.${l.id}</button>`
  ).join('');
  openModal('modal-rank');
  await loadRank();
}

async function loadRank() {
  const list = $('#rank-list');
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
    if (data.sample) foot.push('지금은 예시 데이터예요 (서버 연결 전).');
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
    : `팔로우 인증 전이에요. Lv.4 도전이나 랭킹 등록 때 인증할 수 있어요.`;
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

// ---------------- 이벤트 연결 ----------------
const ACTIONS = {
  quickstart: () => tryStart(state.levelId),
  levels: () => {
    if (state.game) state.game.stop();
    renderLevels();
    show('screen-levels');
  },
  home: () => {
    refreshTitle();
    show('screen-title');
  },
  'play-hot': () => tryStart(4),
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
      m.hidden = true;
    })
  );
  $('#calib-pad').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!audio.ctx) return;
    audio.kick(undefined, 0.6);
    if (calib.active) calib.taps.push(audio.heardTime(e.timeStamp));
  });
  // 오디오는 첫 터치에서 깨움 (iOS / 인앱 브라우저)
  const wake = () => audio.unlock();
  window.addEventListener('pointerdown', wake, { once: true, capture: true });
  window.addEventListener('keydown', wake, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.game && state.game.state === 'playing') {
        state.game.pause();
        openModal('modal-pause');
      }
    } else if (state.verify && state.verify.code) pollVerify();
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
  buildTitle();
  bindActions();
  bindGameInput();
  bindSettings();
  audio.setVolumes({ music: state.settings.music, sfx: state.settings.sfx });

  if (isInApp() && !load('inappDismissed', false)) $('#inapp-note').hidden = false;

  state.api = await createApi(CONFIG);
  try {
    const sc = await state.api.config();
    for (const k of ['gateMode', 'instagramHandle', 'devSimulate', 'codePrefix', 'siteUrl']) {
      if (sc[k] !== undefined && sc[k] !== '' && sc[k] !== null) state.cfg[k] = sc[k];
    }
  } catch {}
  const g = params.get('gate');
  if (g === 'follow' || g === 'open') state.cfg.gateMode = g;
  try {
    state.me = await state.api.me();
  } catch {
    state.me = { verified: false };
  }
  refreshTitle();
  renderLevels();
  restorePending();
  if (params.get('screen') === 'levels') show('screen-levels');
  document.documentElement.dataset.api = state.api.mode;
  if (params.get('debug') === '1') window.__kk = { state, audio, renderer };
}

boot();
