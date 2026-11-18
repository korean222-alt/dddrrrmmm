// 🖼 릴스 썸네일(표지) 만들기: 실제 게임 화면(맵·3D 드럼·떨어지는 노트·PERFECT 효과)을 1080×1920 으로 그리고
//   위에 큰 훅 문구를 얹음. 인스타 프로필 격자는 가운데(3:4)만 보여서 중요한 건 가운데 쪽에.

import { Renderer } from './render.js';
import { levelLanes, buildNotes, tempoOf, COUNT_IN_BARS } from './charts.js';

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
export async function makeReelCover({ lv, title, sub, bottom }) {
  const cv = document.createElement('canvas');
  cv.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(cv);
  try {
    const r = new Renderer(cv);
    r.laneOrder = levelLanes(lv);
    r.newLane = -1;
    r.setTheme(lv);
    r.studio = { cover: true, top: '', bottom: '', label: '' };
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

    // ---- 글씨 ----
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
    return cv;
  } finally {
    cv.remove();
  }
}
