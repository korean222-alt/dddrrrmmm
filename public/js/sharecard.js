// 결과 공유 카드 (인스타 스토리 1080x1920)

import { buildRasters } from './mascot.js';
import { loadBuddies } from './buddies.js';
import { getLevel } from './charts.js';

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

export async function makeShareCard(result, { siteUrl, handle }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const level = getLevel(result.levelId);

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160F38');
  bg.addColorStop(0.6, '#33186A');
  bg.addColorStop(1, '#5B2167');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 조명
  g.save();
  g.globalCompositeOperation = 'lighter';
  [['255,95,162', 120, 0.5], ['255,210,74', 540, 0], ['95,211,255', 960, -0.5]].forEach(([c, x, ang]) => {
    const gr = g.createLinearGradient(x, 0, x - ang * 900, 1500);
    gr.addColorStop(0, `rgba(${c},0.35)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - 10, 0);
    g.lineTo(x - ang * 900 - 260, 1500);
    g.lineTo(x - ang * 900 + 260, 1500);
    g.lineTo(x + 10, 0);
    g.fill();
  });
  g.restore();
  // 무대 바닥
  const fl = g.createLinearGradient(0, 1620, 0, H);
  fl.addColorStop(0, '#8A5236');
  fl.addColorStop(1, '#3E2218');
  g.fillStyle = fl;
  g.fillRect(0, 1620, W, H - 1620);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `110px ${FONT}`;
  g.lineWidth = 22;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('OKAYSTRA', W / 2, 200);
  g.fillStyle = '#FFFFFF';
  g.fillText('OKAYSTRA', W / 2, 200);

  const pill = `${level.xmas ? '크리스마스 이벤트' : `${level.id}단계`} · ${level.composer} ${level.name}`;
  g.font = `56px ${FONT}`;
  const pw = g.measureText(pill).width + 90;
  g.fillStyle = '#FF8A4C';
  roundRect(g, (W - pw) / 2, 300, pw, 100, 50);
  g.fill();
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#FFFFFF';
  g.fillText(pill, W / 2, 352);

  // 별 3개
  const stars = result.stars || 0;
  [-1, 0, 1].forEach((d, i) => {
    const r = i === 1 ? 92 : 76;
    drawStar(g, W / 2 + d * 200, i === 1 ? 500 : 520, r, i < stars);
  });

  // 등급
  g.font = `220px ${FONT}`;
  g.lineJoin = 'round';
  g.lineWidth = 28;
  g.strokeStyle = '#3B2A4A';
  g.strokeText(result.grade, W / 2, 730);
  g.fillStyle = gradeColor(result.grade);
  g.fillText(result.grade, W / 2, 730);

  g.font = `140px ${FONT}`;
  g.lineWidth = 20;
  g.strokeStyle = '#2B1D3A';
  g.strokeText(result.score.toLocaleString('ko-KR'), W / 2, 920);
  g.fillStyle = '#FFFFFF';
  g.fillText(result.score.toLocaleString('ko-KR'), W / 2, 920);
  g.font = `48px ${FONT}`;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  const tags = [`정확도 ${(result.accuracy * 100).toFixed(1)}%`, `최대 콤보 ${result.maxCombo}`];
  g.fillText(tags.join('   ·   '), W / 2, 1030);
  if (result.fullCombo) {
    g.font = `60px ${FONT}`;
    g.fillStyle = '#25B865';
    g.fillText(result.counts.perfect === result.total ? 'ALL PERFECT!' : 'FULL COMBO!', W / 2, 1110);
  }

  // 마스코트 + 드럼
  try {
    const B = await loadBuddies();
    if (!B) throw new Error('no buddies');
    const face = (result.stars || 0) <= 1 ? 'miss' : 'cheer';
    const dw = 400;
    const bottom = 1720;
    for (const [who, x] of [['kong', W / 2 - dw - 10], ['jjak', W / 2 + 10]]) {
      const dh = (dw * B.drum[who].height) / B.drum[who].width;
      g.drawImage(B.drum[who], x, bottom - dh, dw, dh);
      const cw = dw * 0.92;
      g.drawImage(B[who][face], x + dw * 0.04, bottom - dw * 0.56 - cw, cw, cw);
    }
  } catch {
   try {
    const r = await buildRasters(340, 400);
    const face = (result.stars || 0) <= 1 ? 'miss' : 'cheer';
    g.drawImage(r.kong[face], W / 2 - 170, 1170, 340, 340);
    g.drawImage(r.bass, W / 2 - 400, 1300, 380, 399);
    g.drawImage(r.snare, W / 2 + 40, 1370, 360, 345);
   } catch {}
  }

  g.font = `56px ${FONT}`;
  g.fillStyle = '#FFFFFF';
  g.lineWidth = 12;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.fillText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.font = `40px ${FONT}`;
  g.fillStyle = 'rgba(255,240,220,0.85)';
  const foot = [handle ? '@' + handle : '', siteUrl.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
  g.fillText(foot, W / 2, 1840);

  return c;
}

export function gradeColor(grade) {
  return { SS: '#FF7A3D', S: '#FFB33D', A: '#25B865', B: '#3D8BFF', C: '#A889E8', D: '#9A94AE', F: '#FF6B8A' }[grade] || '#3B2A4A';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawStar(g, cx, cy, r, on) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = '#2B1D3A';
  g.stroke();
  g.fillStyle = on ? '#FFD24A' : 'rgba(255,255,255,0.22)';
  g.fill();
  g.restore();
}
