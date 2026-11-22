// 🛒 상점 미리보기 (2026-11-22, 사용자 요청 '누르면 미리보기'): 실제 게임 화면을 작은 캔버스에 돌려 보여 줌
//   고른 물건만 바꾸고 나머지는 지금 쓰는 꾸미기 그대로. 콩이 내려와 저절로 PERFECT 로 맞음. 서버 요청 없음
//   콩 색은 LANE 을 바꿔야 해서(applyNoteColors) 닫을 때 main 이 원래 색으로 돌려놓음

import { Renderer, applyNoteColors } from './render.js';
import { LEVELS, LAST_LEVEL_ID, levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } from './charts.js';

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
  cur = null;
}

/**
 * @param {HTMLCanvasElement} cv  화면에 붙어 있는 캔버스 (CSS 크기가 정해져 있어야 함)
 * @param {{ bg, kit, notes, photo }} o  bg·kit = 'auto' | 맵 키 | 'photo', notes = 콩 색 키, photo = 내 사진 Image (없으면 예시)
 */
export async function startShopPreview(cv, { bg, kit, notes, photo }) {
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
