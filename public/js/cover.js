// 🖼 릴스 썸네일(표지) 만들기: 실제 게임 화면(맵·3D 드럼·떨어지는 노트·PERFECT 효과)을 1080×1920 으로 그리고
//   위에 큰 훅 문구를 얹음. 인스타 프로필 격자는 가운데(3:4)만 보여서 중요한 건 가운데 쪽에.

import { Renderer, preloadShopBg } from './render.js';
import { levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } from './charts.js';
import { TileGame } from './tilegame.js';

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const INK = '#2B1D3A';
const W = 360; // CSS px (× 3 = 1080)
const H = 640;

/** 긴 문구를 두 줄로 (가운데에 가까운 띄어쓰기에서) */
export function splitTitle(text) {
  const t = String(text || '').trim();
  if (t.includes('\n')) return t.split('\n').slice(0, 2);
  if ([...t].length <= 8) return [t];
  const mid = t.length / 2;
  let best = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
}

function fit(ctx, text, maxW, size) {
  let fs = size;
  ctx.font = `${fs}px ${FONT}`;
  while (fs > 12 && ctx.measureText(text).width > maxW) ctx.font = `${(fs -= 1)}px ${FONT}`;
  return fs;
}

function pill(ctx, text, cx, cy, size, fill, color) {
  const fs = fit(ctx, text, W * 0.8, size);
  const w = ctx.measureText(text).width + fs * 1.4;
  const h = fs * 1.9;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + fs * 0.05);
}

/**
 * @param {{ lv, title, sub, bottom }} o  lv = 칠 판(단계), title = 큰 훅(두 줄까지), sub = 곡 이름 배지, bottom = 아래 유도 문구
 * @returns {Promise<HTMLCanvasElement>} 1080×1920
 */
export async function makeReelCover({ lv, title, sub, bottom, deco = null }) {
  // 그릴 글자가 든 글꼴 묶음을 미리 받음 (안 그러면 처음 보는 글자만 기본 글꼴로 나옴, 예: '캉캉')
  try {
    await Promise.race([document.fonts.load(`40px ${FONT.split(',')[0]}`, `${title}${sub || ''}${bottom || ''}0123456789`), new Promise((r) => setTimeout(r, 3000))]);
  } catch {}
  const cv = document.createElement('canvas');
  cv.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(cv);
  try {
    const r = new Renderer(cv);
    r.laneOrder = levelLanes(lv);
    r.newLane = -1;
    r.studio = { cover: true, top: '', bottom: '', label: '' };
    // 🎨 영상 찍기 「꾸미기」 켰으면 상점에서 장착한 무대·드럼·세트도 썸네일에 (2026-11-24 사용자). 콩 색은 부르는 쪽이 맞춤
    if (deco) Object.assign(r, { studioSkin: true, bgPick: deco.bgPick, kitPick: deco.kitPick, photoDim: deco.photoDim, bgPhoto: deco.bgPhoto, uiStyle: deco.uiStyle });
    r.setTheme(lv);
    if (r.theme.img) await preloadShopBg(r.theme.img); // 상점 무대 그림은 받은 뒤에 그림
    await r.resize(3);
    // 노트가 화면에 가장 많이 내려오는 순간 (첫·끝 마디는 빼고)
    const tempo = tempoOf(lv);
    const all = buildNotes(lv);
    const APPROACH = 2.3; // 썸네일만: 길을 더 길게 보여줘서 노트가 많이 보이게
    let now = tempo.barStart(COUNT_IN_BARS + 1);
    let most = -1;
    for (let b = 1; b < lv.bars.length - 2; b++)
      for (const q of [0, 0.5]) {
        const t = tempo.barStart(COUNT_IN_BARS + b) + q * tempo.barLen(COUNT_IN_BARS + b) + 0.05; // 막 친 순간 (선 위 노트는 사라짐)
        const n = all.filter((x) => x.time >= t && x.time < t + APPROACH * 0.9).length;
        if (n > most) {
          most = n;
          now = t;
        }
      }
    const notes = all.map((n) => ({ ...n, judged: n.time < now - 0.02, result: n.time < now - 0.02 ? 'perfect' : null }));
    const beat = 60 / tempo.bpm(0);
    const st = { now, notes, approach: APPROACH, beatDur: beat, tempo, combo: 0, score: 0, playing: true, heat: 1, hatAge: 0.05, crashAge: 0.1, rolls: [] };
    // 조명·입자가 자리 잡게 몇 프레임 돌리고, 마지막에 킥·스네어 PERFECT
    let rt = 100;
    for (let k = 0; k < 150; k++) r.draw(st, (rt += 1 / 60));
    const lanes = r.laneOrder;
    const hit = lanes.filter((l) => l === 0 || l === 1);
    for (const l of hit) {
      r.onTap(l, rt);
      r.onJudge(l, 'perfect', rt, false);
    }
    rt += 0.06;
    r.draw(st, rt);

    drawCoverText(cv, { title, sub, bottom });
    return cv;
  } finally {
    cv.remove();
  }
}

/** 표지 위 글씨 (큰 훅 두 줄 · 곡 배지 · 아래 유도) — 드럼·타일 같이 씀 */
function drawCoverText(cv, { title, sub, bottom }) {
  const ctx = cv.getContext('2d');
  ctx.setTransform(3, 0, 0, 3, 0, 0);
  // 위쪽을 살짝 어둡게 (글씨가 잘 보이게)
  const shade = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  shade.addColorStop(0, 'rgba(10,6,24,0.72)');
  shade.addColorStop(0.7, 'rgba(10,6,24,0.25)');
  shade.addColorStop(1, 'rgba(10,6,24,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H * 0.5);
  const lines = splitTitle(title);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  let y = lines.length > 1 ? 118 : 140;
  lines.forEach((line, i) => {
    const fs = fit(ctx, line, W * 0.9, 50);
    ctx.lineWidth = fs * 0.2;
    ctx.strokeStyle = INK;
    ctx.strokeText(line, W / 2, y);
    // 두 번째 줄(또는 한 줄이면 그 줄)은 노란색으로 강조
    ctx.fillStyle = i === lines.length - 1 ? '#FFD84A' : '#FFFFFF';
    ctx.fillText(line, W / 2, y);
    y += fs * 1.12;
  });
  if (sub) pill(ctx, sub, W / 2, y + 14, 15, '#FFFFFF', '#E2541F');
  if (bottom) pill(ctx, bottom, W / 2, H * 0.905, 16, '#FF8A4C', '#FFFFFF');
}

/**
 * 🎹 타일 썸네일 (2026-11-28 사용자 '타일 썸네일도 드럼처럼'): 진짜 타일 판을 자동 연주로 첫 바퀴 중간까지 돌려
 *   (별 하나 찬 때, 막 PERFECT 친 순간) 1080×1920 으로 찍고 같은 글씨를 얹음. 소리 없음, 화면 시계만 빨리 돌림
 * @param {{ audio, songId, skin, hue, title, sub, bottom }} o
 */
export async function makeTileCover({ audio, songId, skin, hue, title, sub, bottom }) {
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`40px ${FONT.split(',')[0]}`, `${title}${sub || ''}${bottom || ''}0123456789`), document.fonts.load('700 40px "Fredoka"', '0123456789PERFECT')]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {}
  const cv = document.createElement('canvas');
  cv.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(cv);
  const realNow = performance.now;
  let fake = realNow.call(performance);
  let g = null;
  try {
    g = new TileGame({ audio, canvas: cv, songId, skin, hue, auto: true, mute: true, maxLaps: 1, dpr: 3 });
    // 첫 바퀴 25~70% 중 화면에 타일이 가장 많은 순간 → 그 타일을 친 바로 뒤 (PERFECT 글자가 막 뜬 때, 별 하나 찬 쯤)
    const song = g.tiles.filter((x) => !x.coin && x.k === 0);
    let pick = song[Math.floor(song.length * 0.45)] || song[0];
    let most = -1;
    for (let i = Math.floor(song.length * 0.25); i < Math.floor(song.length * 0.7); i++) {
      const r0 = song[i].row;
      const n = song.filter((x) => x.row > r0 && x.row < r0 + 2.6).length - (song[i].hold ? 0.5 : 0);
      if (n > most) {
        most = n;
        pick = song[i];
      }
    }
    const target = (pick ? pick.t : 5) + 0.14;
    performance.now = () => fake;
    g.start();
    cancelAnimationFrame(g.raf);
    clearInterval(g.timer);
    for (let k = 0; k < 20000 && g.state !== 'ended' && g.state !== 'stopped'; k++) {
      fake += 1000 / 30;
      g._tick();
      if (g.state === 'playing' && g.t >= target) break;
    }
    g.stop();
    // 찍은 화면을 새 캔버스로 복사 (타일 판은 글꼴이 늦게 받아지면 첫 화면을 다시 그려서 덮어씀)
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height;
    out.getContext('2d').drawImage(cv, 0, 0);
    drawCoverText(out, { title, sub, bottom });
    return out;
  } finally {
    performance.now = realNow;
    cv.remove();
  }
}
