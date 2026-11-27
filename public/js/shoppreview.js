// 🛒 상점 미리보기 (2026-11-22, 사용자 요청 '누르면 미리보기'): 실제 게임 화면을 작은 캔버스에 돌려 보여 줌
//   고른 물건만 바꾸고 나머지는 지금 쓰는 꾸미기 그대로. 콩이 내려와 저절로 PERFECT 로 맞음. 서버 요청 없음
//   콩 색은 LANE 을 바꿔야 해서(applyNoteColors) 닫을 때 main 이 원래 색으로 돌려놓음

import { Renderer, applyNoteColors, LANE } from './render.js';
import { buildKit } from './kit3d.js';
import { THEMES, SHOP_KITS } from './themes.js';
import { LEVELS, LAST_LEVEL_ID, levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } from './charts.js';
import { TileGame } from './tilegame.js';
import { TILE_SONGS } from './tiles.js';

let cur = null; // { r, raf, cv }

/** 4줄(쿵·짝·하이햇·크래시)이 다 나오는 단계 하나 */
function sampleLevel() {
  const ok = LEVELS.filter((l) => l.id >= 5 && l.id <= LAST_LEVEL_ID && !l.long && !l.xmas && levelLanes(l).length >= 4);
  return ok[0] || LEVELS.find((l) => l.id === 4) || LEVELS[0];
}

/** 사진 배경 미리보기용 예시 그림 (내 사진이 아직 없을 때) */
function samplePhoto() {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 640;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 360, 640);
  gr.addColorStop(0, '#ffb3c7');
  gr.addColorStop(0.5, '#ffd6a5');
  gr.addColorStop(1, '#9bd3ff');
  g.fillStyle = gr;
  g.fillRect(0, 0, 360, 640);
  g.font = '120px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('📷', 180, 250);
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillStyle = '#fff';
  g.fillText('내 사진', 180, 360);
  return c;
}

export function stopShopPreview() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf);
  if (cur.tg) cur.tg.stop();
  cur = null;
}

/** 🎹 타일로 미리보기 (2026-11-27): 진짜 타일 판을 소리 없이 저절로 침, 한 바퀴 끝나면 처음부터 다시 */
export function startTileShopPreview(cv, { skin, audio }) {
  stopShopPreview();
  const me = {};
  cur = me;
  const run = () => {
    if (cur !== me) return;
    const g = new TileGame({ audio, canvas: cv, songId: TILE_SONGS[0].id, skin, auto: true, mute: true, maxLaps: 1, onEnd: () => setTimeout(run, 400) });
    me.tg = g;
    g.start();
  };
  run();
}

/**
 * @param {HTMLCanvasElement} cv  화면에 붙어 있는 캔버스 (CSS 크기가 정해져 있어야 함)
 * @param {{ bg, kit, notes, ui, photo }} o  bg·kit = 'auto' | 맵 키 | 'photo', notes = 콩 색 키, ui = 'live'(세트) | 'basic', photo = 내 사진 Image (없으면 예시)
 */
export async function startShopPreview(cv, { bg, kit, notes, ui, photo }) {
  stopShopPreview();
  const me = {};
  cur = me;
  const lv = sampleLevel();
  const r = new Renderer(cv);
  r.laneOrder = levelLanes(lv);
  r.newLane = -1;
  r.quality = 2;
  r.bgPick = bg && bg !== 'auto' ? bg : null;
  r.kitPick = kit && kit !== 'auto' ? kit : null;
  r.uiStyle = ui === 'live' || ui === 's1' ? ui : null;
  if (bg === 'photo') {
    r.bgPhoto = photo || samplePhoto();
    r.photoDim = 0.35;
  }
  applyNoteColors(notes || 'basic');
  r.setTheme(lv);
  await r.resize(2);
  if (cur !== me) return;
  const tempo = tempoOf(lv);
  const all = buildNotes(lv);
  const from = tempo.barStart(COUNT_IN_BARS + 2);
  const to = tempo.barStart(COUNT_IN_BARS + 6);
  const beat = 60 / tempo.bpm(0);
  let notesNow = [];
  let next = 0;
  const reset = () => {
    notesNow = all.filter((n) => n.time >= from - 0.5 && n.time < to + 3).map((n) => ({ ...n, judged: n.time < from, result: n.time < from ? 'perfect' : null }));
    next = notesNow.findIndex((n) => !n.judged);
    if (next < 0) next = notesNow.length;
  };
  reset();
  let combo = 0;
  let score = 0;
  const t0 = performance.now() / 1000;
  let loopAt = t0;
  const tick = () => {
    if (cur !== me) return;
    const rt = performance.now() / 1000;
    let now = from + (rt - loopAt);
    if (now >= to) {
      loopAt = rt;
      now = from;
      combo = 0;
      reset();
    }
    // 판정선에 닿은 콩은 저절로 PERFECT
    while (next < notesNow.length && notesNow[next].time <= now) {
      const n = notesNow[next++];
      n.judged = true;
      n.result = 'perfect';
      combo++;
      score += 100;
      try {
        r.onTap(n.lane, rt);
        r.onJudge(n.lane, 'perfect', rt, false);
      } catch {}
    }
    const st = { now, notes: notesNow, approach: 1.6, beatDur: beat, tempo, combo, score, playing: true, heat: 0.6, hatAge: 0.05, crashAge: 0.1, rolls: [] };
    try {
      r.draw(st, rt);
    } catch {}
    me.raf = requestAnimationFrame(tick);
  };
  me.raf = requestAnimationFrame(tick);
}

/** 🥁 드럼 세트 크게 보기 (게임 화면에선 드럼이 작아서 차이가 잘 안 보임) */
export function drawKitCloseup(cv, kitKey) {
  const theme = SHOP_KITS[kitKey] ? { kit: SHOP_KITS[kitKey].kit } : THEMES[kitKey];
  if (!theme) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth || 240;
  const H = cv.clientHeight || 120;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2A1B4A');
  bg.addColorStop(1, '#0E0820');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const R = H * 0.3;
  const kit = buildKit(theme, { instR: R, padR: R * 0.8, barW: R * 2, barH: R * 0.3, cymR: R * 1.1, dpr, standTo: H * 0.35 }, LANE);
  const put = (sp, x, y, k = 1) => g.drawImage(sp.img, x - sp.ax * k, y - sp.ay * k, sp.w * k, sp.h * k);
  put(kit.cym, W * 0.2, H * 0.3, 0.9);
  put(kit.cym, W * 0.82, H * 0.24, 1);
  put(kit.snare, W * 0.73, H * 0.55, 0.9);
  put(kit.kick, W * 0.42, H * 0.5, 1);
}
