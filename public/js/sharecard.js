// 결과 공유 카드 (인스타 스토리 1080x1920)

import { buildRasters } from './mascot.js';
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
  bg.addColorStop(0, '#2A2160');
  bg.addColorStop(0.6, '#151034');
  bg.addColorStop(1, '#0B0918');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 700, 0, W / 2, 700, 700);
  glow.addColorStop(0, 'rgba(255,216,77,0.28)');
  glow.addColorStop(1, 'rgba(255,216,77,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#FFF8EC';
  g.font = `92px ${FONT}`;
  g.fillText('콩콩 드럼', W / 2, 200);

  // 레벨 필
  const pill = `Lv.${level.id}  ${level.name}`;
  g.font = `56px ${FONT}`;
  const pw = g.measureText(pill).width + 90;
  g.fillStyle = '#FFD84D';
  roundRect(g, (W - pw) / 2, 290, pw, 100, 50);
  g.fill();
  g.fillStyle = '#2B1D3A';
  g.fillText(pill, W / 2, 342);

  // 등급
  g.font = `340px ${FONT}`;
  g.lineJoin = 'round';
  g.lineWidth = 34;
  g.strokeStyle = '#2B1D3A';
  g.strokeText(result.grade, W / 2, 640);
  g.fillStyle = gradeColor(result.grade);
  g.fillText(result.grade, W / 2, 640);

  g.font = `150px ${FONT}`;
  g.fillStyle = '#FFFFFF';
  g.fillText(result.score.toLocaleString('ko-KR'), W / 2, 900);
  g.font = `48px ${FONT}`;
  g.fillStyle = 'rgba(255,248,236,0.7)';
  const tags = [`정확도 ${(result.accuracy * 100).toFixed(1)}%`, `최대 콤보 ${result.maxCombo}`];
  g.fillText(tags.join('   ·   '), W / 2, 1010);
  if (result.fullCombo) {
    g.font = `60px ${FONT}`;
    g.fillStyle = '#7CF5B4';
    g.fillText(result.counts.perfect === result.total ? 'ALL PERFECT!' : 'FULL COMBO!', W / 2, 1100);
  }

  // 마스코트 + 드럼
  try {
    const r = await buildRasters(300, 400);
    const face = result.grade === 'D' || result.grade === 'C' ? 'miss' : 'cheer';
    [['kong', W / 2 - 230], ['jjak', W / 2 + 230]].forEach(([k, x]) => {
      g.drawImage(r.drum[k], x - 200, 1360, 400, 333);
      g.drawImage(r[k][face], x - 150, 1190, 300, 300);
    });
  } catch {}

  g.font = `52px ${FONT}`;
  g.fillStyle = '#FFF8EC';
  g.fillText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.font = `38px ${FONT}`;
  g.fillStyle = 'rgba(255,248,236,0.65)';
  const foot = [handle ? '@' + handle : '', siteUrl.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
  g.fillText(foot, W / 2, 1840);

  return c;
}

export function gradeColor(grade) {
  return { SS: '#FFE45C', S: '#FFD84D', A: '#7CF5B4', B: '#4FD6E0', C: '#C9B6FF', D: '#FF8FA8' }[grade] || '#fff';
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
