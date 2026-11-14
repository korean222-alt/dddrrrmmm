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
  bg.addColorStop(0, '#8FD3FF');
  bg.addColorStop(0.5, '#D8F1FF');
  bg.addColorStop(0.75, '#FFF6E3');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 구름
  g.fillStyle = '#FFFFFF';
  [[180, 470, 1], [900, 560, 0.8], [860, 120, 0.7]].forEach(([x, y, s]) => {
    g.beginPath();
    g.ellipse(x, y, 130 * s, 55 * s, 0, 0, Math.PI * 2);
    g.ellipse(x - 70 * s, y + 10 * s, 70 * s, 45 * s, 0, 0, Math.PI * 2);
    g.ellipse(x + 75 * s, y + 10 * s, 65 * s, 42 * s, 0, 0, Math.PI * 2);
    g.ellipse(x - 10 * s, y - 35 * s, 70 * s, 55 * s, 0, 0, Math.PI * 2);
    g.fill();
  });
  // 잔디
  g.fillStyle = '#8ED46B';
  g.beginPath();
  g.moveTo(0, 1560);
  g.quadraticCurveTo(W / 2, 1500, W, 1560);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = `110px ${FONT}`;
  g.lineWidth = 22;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('콩콩 드럼', W / 2, 200);
  g.fillStyle = '#FFFFFF';
  g.fillText('콩콩 드럼', W / 2, 200);

  const pill = `${level.id}단계 · ${level.name}`;
  g.font = `56px ${FONT}`;
  const pw = g.measureText(pill).width + 90;
  g.fillStyle = '#5DBB4A';
  roundRect(g, (W - pw) / 2, 300, pw, 100, 50);
  g.fill();
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = '#FFFFFF';
  g.fillText(pill, W / 2, 352);

  // 등급
  g.font = `340px ${FONT}`;
  g.lineJoin = 'round';
  g.lineWidth = 34;
  g.strokeStyle = '#3B2A4A';
  g.strokeText(result.grade, W / 2, 640);
  g.fillStyle = gradeColor(result.grade);
  g.fillText(result.grade, W / 2, 640);

  g.font = `150px ${FONT}`;
  g.lineWidth = 20;
  g.strokeStyle = '#FFFFFF';
  g.strokeText(result.score.toLocaleString('ko-KR'), W / 2, 900);
  g.fillStyle = '#3B2A4A';
  g.fillText(result.score.toLocaleString('ko-KR'), W / 2, 900);
  g.font = `48px ${FONT}`;
  g.fillStyle = '#5B4D6E';
  const tags = [`정확도 ${(result.accuracy * 100).toFixed(1)}%`, `최대 콤보 ${result.maxCombo}`];
  g.fillText(tags.join('   ·   '), W / 2, 1010);
  if (result.fullCombo) {
    g.font = `60px ${FONT}`;
    g.fillStyle = '#25B865';
    g.fillText(result.counts.perfect === result.total ? 'ALL PERFECT!' : 'FULL COMBO!', W / 2, 1100);
  }

  // 마스코트 + 드럼
  try {
    const r = await buildRasters(300, 400);
    const face = result.grade === 'D' || result.grade === 'C' ? 'miss' : 'cheer';
    [['kong', -1], ['jjak', 1]].forEach(([k, side]) => {
      const dx = W / 2 + side * 165;
      const mx = W / 2 + side * 390;
      g.drawImage(r.drum[k], dx - 160, 1380, 320, 267);
      g.drawImage(r[k][face], mx - 150, 1330, 300, 300);
    });
  } catch {}

  g.font = `56px ${FONT}`;
  g.fillStyle = '#FFFFFF';
  g.lineWidth = 12;
  g.strokeStyle = '#3B2A4A';
  g.strokeText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.fillText('너도 엄지로 쳐 봐!', W / 2, 1770);
  g.font = `40px ${FONT}`;
  g.fillStyle = '#2E5E24';
  const foot = [handle ? '@' + handle : '', siteUrl.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
  g.fillText(foot, W / 2, 1840);

  return c;
}

export function gradeColor(grade) {
  return { SS: '#FF7A3D', S: '#FFB33D', A: '#25B865', B: '#3D8BFF', C: '#A889E8', D: '#9A94AE' }[grade] || '#3B2A4A';
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
