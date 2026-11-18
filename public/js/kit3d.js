// 3D 느낌 드럼 세트 그림 (Canvas 2D 로 원통 음영·금속 반사·광택을 직접 그려 스프라이트로 만들어 둠)
//   킥 = 베이스드럼 정면(위에서 살짝 내려다봐서 통 윗면이 보임), 스네어 = 위에서 비스듬히 본 원통 + 스탠드,
//   심벌 = 선반 자국(lathe) + 비스듬한 금속 반사. 노트도 같은 재질로 입체(막대·작은 드럼·작은 심벌).
// 스프라이트: { img, w, h, ax, ay } (CSS px). 그릴 때 drawImage(img, x - ax, y - ay, w, h)

const TAU = Math.PI * 2;
const OUT = 'rgba(12,8,20,0.85)';

const METAL = {
  chrome: ['#4E5462', '#C9CED8', '#FFFFFF', '#8E95A3', '#E6E9EF', '#5E6472'],
  gold: ['#5E3E0C', '#D9A93C', '#FFF2C0', '#A87A22', '#F2CF6A', '#6E4A12'],
  black: ['#060608', '#34363E', '#8A8E99', '#1A1B20', '#3E414A', '#08080A'],
};
const CYM = {
  gold: { dark: '#6E4A12', mid: '#C8932F', light: '#FFE7A6', groove: '120,80,20' },
  silver: { dark: '#4C5160', mid: '#AEB5C3', light: '#FFFFFF', groove: '60,66,80' },
  dark: { dark: '#1E1812', mid: '#5A4834', light: '#B89A6C', groove: '20,14,8' },
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function sprite(w, h, ax, ay, dpr, fn) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(ax, ay);
  fn(g);
  return { img: c, w, h, ax, ay };
}

function metalGrad(g, x0, x1, tone = 'chrome', y = 0) {
  const m = METAL[tone] || METAL.chrome;
  const gr = g.createLinearGradient(x0, y, x1, y);
  [0, 0.16, 0.3, 0.52, 0.76, 1].forEach((p, i) => gr.addColorStop(p, m[i]));
  return gr;
}

/** 원통 음영: 가장자리 어둡게 + 왼쪽 위 반사 줄 (재질 위에 덮어 씀) */
function cylShade(g, x0, x1, y0, y1, strength = 1) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, `rgba(0,0,0,${0.55 * strength})`);
  gr.addColorStop(0.14, `rgba(0,0,0,${0.12 * strength})`);
  gr.addColorStop(0.24, 'rgba(255,255,255,0)');
  gr.addColorStop(0.3, `rgba(255,255,255,${0.55 * strength})`);
  gr.addColorStop(0.335, `rgba(255,255,255,${0.12 * strength})`);
  gr.addColorStop(0.62, 'rgba(0,0,0,0)');
  gr.addColorStop(0.86, `rgba(0,0,0,${0.3 * strength})`);
  gr.addColorStop(1, `rgba(0,0,0,${0.62 * strength})`);
  g.fillStyle = gr;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** 통 재질 칠하기 (이미 clip 된 상태). colors = [밝은, 기본, 어두운] */
function paintFinish(g, finish, colors, x0, x1, y0, y1, opt = {}) {
  const [li, base, dk] = colors;
  const w = x1 - x0;
  const h = y1 - y0;
  if (finish === 'fade') {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, li);
    gr.addColorStop(0.45, base);
    gr.addColorStop(1, dk);
    g.fillStyle = gr;
  } else if (finish === 'metal') {
    g.fillStyle = metalGradFrom(g, x0, x1, colors);
  } else {
    g.fillStyle = base;
  }
  g.fillRect(x0, y0, w, h);
  if (finish === 'wood') {
    const r = rng(7);
    g.lineWidth = Math.max(0.6, w * 0.004);
    for (let i = 0; i < 46; i++) {
      const x = x0 + r() * w;
      g.strokeStyle = r() < 0.5 ? `rgba(70,30,8,${0.12 + r() * 0.18})` : `rgba(255,220,170,${0.08 + r() * 0.12})`;
      g.beginPath();
      g.moveTo(x, y0);
      const amp = w * 0.01 * (0.5 + r());
      for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(k * 1.3 + i) * amp, y0 + (h * k) / 8);
      g.stroke();
    }
  }
  if (finish === 'sparkle' || opt.sparkle) {
    const r = rng(11);
    const n = Math.round((w * h) / 30);
    const col = opt.sparkle || li;
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.15 + r() * 0.55;
      const s = Math.max(0.6, w * 0.006 * (0.4 + r()));
      g.fillRect(x0 + r() * w, y0 + r() * h, s, s);
    }
    g.globalAlpha = 1;
  }
}

function metalGradFrom(g, x0, x1, [li, base, dk]) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, dk);
  gr.addColorStop(0.18, base);
  gr.addColorStop(0.3, li);
  gr.addColorStop(0.5, base);
  gr.addColorStop(0.76, li);
  gr.addColorStop(1, dk);
  return gr;
}

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
}

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  w = Math.max(0.1, w);
  h = Math.max(0.1, h);
  if (g.roundRect) g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  else g.rect(x, y, w, h);
}

function floorShadow(g, x, y, rx, ry, a = 0.55) {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(0,0,0,${a})`);
  gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.45})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

/** 금속 막대 (스탠드·다리) */
function rod(g, x1, y1, x2, y2, w, tone) {
  g.lineCap = 'round';
  g.strokeStyle = OUT;
  g.lineWidth = w + 2;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  const m = METAL[tone] || METAL.chrome;
  g.strokeStyle = m[1];
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = m[2];
  g.globalAlpha = 0.7;
  g.lineWidth = w * 0.35;
  g.beginPath();
  g.moveTo(x1 - w * 0.2, y1);
  g.lineTo(x2 - w * 0.2, y2);
  g.stroke();
  g.globalAlpha = 1;
}

/** 브랜드 새싹 엠블럼 */
function sprout(g, s, leaf = '#7BD66A', dark = '#3F8F38') {
  g.lineCap = 'round';
  g.strokeStyle = dark;
  g.lineWidth = s * 0.09;
  g.beginPath();
  g.moveTo(0, s * 0.35);
  g.quadraticCurveTo(-s * 0.03, 0, s * 0.06, -s * 0.18);
  g.stroke();
  g.fillStyle = leaf;
  g.strokeStyle = dark;
  g.lineWidth = s * 0.05;
  for (const sg of [1, -1]) {
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.12);
    g.bezierCurveTo(sg * s * 0.25, -s * 0.5, sg * s * 0.62, -s * 0.38, sg * s * 0.6, -s * 0.22);
    g.bezierCurveTo(sg * s * 0.5, -s * 0.02, sg * s * 0.2, 0, s * 0.04, -s * 0.12);
    g.fill();
    g.stroke();
  }
}

// ---------------------------------------------------------------- 킥
/** 베이스드럼 정면. R = 앞 헤드(테 포함) 반지름. 기준점 = 헤드 가운데 */
function drawKick(g, R, kit) {
  const d = R * 0.36; // 통 깊이가 위로 보이는 만큼
  const Rb = R * 0.965;
  floorShadow(g, 0, R * 1.0, R * 1.25, R * 0.22, 0.65);
  // 다리(스퍼)
  for (const s of [-1, 1]) rod(g, s * R * 0.72, R * 0.2, s * R * 1.12, R * 1.0, R * 0.07, kit.hw);
  for (const s of [-1, 1]) {
    ellipse(g, s * R * 1.12, R * 1.0, R * 0.09, R * 0.045);
    g.fillStyle = '#16131C';
    g.fill();
  }
  // 통(뒤 테 → 앞 테까지)
  g.save();
  g.beginPath();
  g.arc(0, -d, Rb, Math.PI, 0);
  g.lineTo(R, 0);
  g.arc(0, 0, R, 0, Math.PI);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.clip();
  paintFinish(g, kit.finish, kit.shell, -R, R, -d - R, R, { sparkle: kit.sparkle });
  cylShade(g, -R, R, -d - R, R, 0.9);
  // 위에서 빛: 통 윗부분 밝게
  const top = g.createLinearGradient(0, -d - Rb, 0, -d + R * 0.2);
  top.addColorStop(0, 'rgba(255,255,255,0.35)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = top;
  g.fillRect(-R, -d - Rb, R * 2, R);
  g.restore();
  // 통 윗면 반사 줄
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = R * 0.035;
  g.beginPath();
  g.arc(0, -d * 0.55, R * 0.985, Math.PI * 1.18, Math.PI * 1.5);
  g.stroke();
  g.restore();
  // 뒤 테 (위쪽만 보임)
  g.lineWidth = R * 0.09;
  g.strokeStyle = OUT;
  g.beginPath();
  g.arc(0, -d, Rb, Math.PI * 1.02, Math.PI * 1.98);
  g.stroke();
  g.lineWidth = R * 0.06;
  g.strokeStyle = kit.hoop[1];
  g.stroke();
  g.lineWidth = R * 0.018;
  g.strokeStyle = kit.inlay;
  g.stroke();
  // 러그 (통 위쪽 띠에 박힌 금속)
  for (const deg of [-162, -126, -90, -54, -18]) {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * R * 0.99;
    const y = -d * 0.5 + Math.sin(a) * R * 0.99;
    const w = R * 0.1 * (0.45 + 0.55 * Math.abs(Math.sin(a)));
    rrect(g, x - w / 2, y - R * 0.13, w, R * 0.26, w / 2);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, x - w / 2 + 1, y - R * 0.13 + 1, w - 2, R * 0.26 - 2, w / 2);
    g.fillStyle = metalGrad(g, x - w / 2, x + w / 2, kit.hw);
    g.fill();
  }
  // 앞 테 (색 테 + 가운데 상감 줄)
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.arc(0, 0, R * 0.855, 0, TAU, true);
  const hg = g.createLinearGradient(0, -R, 0, R);
  hg.addColorStop(0, kit.hoop[0]);
  hg.addColorStop(0.5, kit.hoop[1]);
  hg.addColorStop(1, kit.hoop[2]);
  g.fillStyle = hg;
  g.fill();
  g.lineWidth = R * 0.03;
  g.strokeStyle = OUT;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, R * 0.93, 0, TAU);
  g.lineWidth = R * 0.038;
  g.strokeStyle = kit.inlay;
  g.stroke();
  // 테 위쪽 반사
  g.beginPath();
  g.arc(0, 0, R * 0.965, Math.PI * 1.1, Math.PI * 1.55);
  g.lineWidth = R * 0.025;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.stroke();
  // 클로(테 잡는 쇠)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    g.save();
    g.rotate(a);
    rrect(g, R * 0.84, -R * 0.045, R * 0.19, R * 0.09, R * 0.03);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, R * 0.85, -R * 0.032, R * 0.17, R * 0.064, R * 0.025);
    const m = METAL[kit.hw] || METAL.chrome;
    g.fillStyle = m[1];
    g.fill();
    g.fillStyle = m[2];
    g.globalAlpha = 0.7;
    g.fillRect(R * 0.87, -R * 0.03, R * 0.12, R * 0.018);
    g.globalAlpha = 1;
    g.restore();
  }
  // 앞 헤드
  const H = R * 0.855;
  const head = g.createRadialGradient(-H * 0.3, -H * 0.35, H * 0.1, 0, 0, H);
  head.addColorStop(0, lighten(kit.head, 0.25));
  head.addColorStop(0.75, kit.head);
  head.addColorStop(1, darken(kit.head, 0.22));
  g.beginPath();
  g.arc(0, 0, H, 0, TAU);
  g.fillStyle = head;
  g.fill();
  // 엠블럼
  g.beginPath();
  g.arc(0, -H * 0.04, H * 0.56, 0, TAU);
  g.lineWidth = H * 0.07;
  g.strokeStyle = kit.emblem;
  g.stroke();
  g.lineWidth = H * 0.018;
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.arc(0, -H * 0.04, H * 0.49, 0, TAU);
  g.stroke();
  g.save();
  g.translate(0, -H * 0.12);
  sprout(g, H * 0.62);
  g.restore();
  g.fillStyle = kit.emblemText;
  let fs = Math.max(4, H * 0.15);
  g.font = `900 ${fs}px system-ui, sans-serif`;
  while (fs > 4 && g.measureText('OKAYSTRA').width > H * 0.8) g.font = `900 ${(fs -= 0.5)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('OKAYSTRA', 0, H * 0.28);
  // 공기 구멍(포트)
  g.beginPath();
  g.arc(H * 0.56, H * 0.56, H * 0.13, 0, TAU);
  g.fillStyle = '#0B0910';
  g.fill();
  g.lineWidth = H * 0.04;
  g.strokeStyle = (METAL[kit.hw] || METAL.chrome)[1];
  g.stroke();
  // 헤드 테두리 그늘 + 광택
  const ao = g.createRadialGradient(0, 0, H * 0.82, 0, 0, H);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = ao;
  g.beginPath();
  g.arc(0, 0, H, 0, TAU);
  g.fill();
  g.save();
  g.translate(-H * 0.38, -H * 0.5);
  g.rotate(-0.55);
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, H * 0.42);
  gl.addColorStop(0, 'rgba(255,255,255,0.75)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.scale(1, 0.32);
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, H * 0.42, 0, TAU);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- 스네어
/** 스네어 (위에서 비스듬히). Rx = 테 가로 반지름. 기준점 = 헤드 가운데 */
export const SNARE_RY = 0.36;
function drawSnare(g, Rx, kit, standTo) {
  const ry = Rx * SNARE_RY;
  const H = Rx * 0.48;
  floorShadow(g, 0, standTo, Rx * 0.85, Rx * 0.13, 0.6);
  // 스탠드
  rod(g, 0, H + ry, 0, standTo - Rx * 0.32, Rx * 0.07, kit.hw);
  rod(g, 0, standTo - Rx * 0.34, -Rx * 0.68, standTo - Rx * 0.02, Rx * 0.06, kit.hw);
  rod(g, 0, standTo - Rx * 0.34, Rx * 0.68, standTo - Rx * 0.02, Rx * 0.06, kit.hw);
  rod(g, 0, standTo - Rx * 0.34, 0, standTo + Rx * 0.04, Rx * 0.06, kit.hw);
  for (const s of [-1, 1]) rod(g, 0, H + ry * 1.1, s * Rx * 0.62, H + ry * 0.55, Rx * 0.05, kit.hw);
  // 통
  g.save();
  g.beginPath();
  g.moveTo(-Rx, 0);
  g.lineTo(-Rx, H);
  g.ellipse(0, H, Rx, ry, 0, Math.PI, 0, true);
  g.lineTo(Rx, 0);
  g.ellipse(0, 0, Rx, ry, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.clip();
  paintFinish(g, kit.snareFinish || 'gloss', kit.snare, -Rx, Rx, -ry, H + ry, { sparkle: kit.snareSparkle });
  cylShade(g, -Rx, Rx, -ry, H + ry, kit.snareFinish === 'metal' ? 0.6 : 1);
  g.restore();
  // 아래 테
  const t = Rx * 0.075;
  g.beginPath();
  g.moveTo(-Rx, H - t);
  g.ellipse(0, H - t, Rx, ry, 0, Math.PI, 0, true);
  g.lineTo(Rx, H);
  g.ellipse(0, H, Rx, ry, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = metalGrad(g, -Rx, Rx, kit.hw);
  g.fill();
  g.lineWidth = Rx * 0.015;
  g.strokeStyle = OUT;
  g.stroke();
  // 튜브 러그 + 텐션 볼트
  for (const f of [-0.86, -0.5, 0, 0.5, 0.86]) {
    const x = f * Rx;
    const k = Math.sqrt(1 - f * f);
    const y0 = ry * k + Rx * 0.06;
    const y1 = H + ry * k - Rx * 0.08;
    const w = Rx * (0.035 + 0.06 * k);
    rrect(g, x - w / 2, y0, w, y1 - y0, w / 2);
    g.fillStyle = OUT;
    g.fill();
    rrect(g, x - w / 2 + 0.8, y0 + 0.8, w - 1.6, y1 - y0 - 1.6, w / 2);
    g.fillStyle = metalGrad(g, x - w / 2, x + w / 2, kit.hw);
    g.fill();
  }
  // 위 테 옆면
  const tt = Rx * 0.07;
  g.beginPath();
  g.moveTo(Rx, 0);
  g.ellipse(0, 0, Rx, ry, 0, 0, Math.PI, false);
  g.lineTo(-Rx, tt);
  g.ellipse(0, tt, Rx, ry, 0, Math.PI, 0, true);
  g.closePath();
  g.fillStyle = metalGrad(g, -Rx, Rx, kit.hw);
  g.fill();
  g.lineWidth = Rx * 0.015;
  g.strokeStyle = OUT;
  g.stroke();
  // 위 테 윗면 (고리)
  g.beginPath();
  g.ellipse(0, 0, Rx, ry, 0, 0, TAU);
  g.ellipse(0, 0, Rx * 0.92, ry * 0.86, 0, 0, TAU, true);
  const m = METAL[kit.hw] || METAL.chrome;
  const rg = g.createLinearGradient(-Rx, -ry, Rx, ry);
  rg.addColorStop(0, m[2]);
  rg.addColorStop(0.35, m[1]);
  rg.addColorStop(0.6, m[3]);
  rg.addColorStop(1, m[4]);
  g.fillStyle = rg;
  g.fill();
  // 헤드 (코팅된 흰 가죽)
  const hx = Rx * 0.92;
  const hy = ry * 0.86;
  g.save();
  ellipse(g, 0, 0, hx, hy);
  g.clip();
  const hg = g.createRadialGradient(-hx * 0.25, -hy * 0.4, hx * 0.05, 0, 0, hx);
  hg.addColorStop(0, '#FFFFFF');
  hg.addColorStop(0.7, '#F6F1E6');
  hg.addColorStop(1, '#D9D1C2');
  g.fillStyle = hg;
  g.fillRect(-hx, -hy, hx * 2, hy * 2);
  // 테두리 안쪽 그늘 (칼라)
  g.lineWidth = Rx * 0.06;
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  ellipse(g, 0, 0, hx, hy);
  g.stroke();
  // 많이 친 자국 (가운데 살짝 회색)
  ellipse(g, Rx * 0.04, ry * 0.05, Rx * 0.22, ry * 0.22);
  g.fillStyle = 'rgba(120,110,100,0.12)';
  g.fill();
  g.restore();
  g.lineWidth = Rx * 0.018;
  g.strokeStyle = OUT;
  ellipse(g, 0, 0, Rx, ry);
  g.stroke();
  // 테 반사
  g.beginPath();
  g.ellipse(0, 0, Rx * 0.96, ry * 0.93, 0, Math.PI * 1.1, Math.PI * 1.45);
  g.lineWidth = Rx * 0.022;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.stroke();
}

// ---------------------------------------------------------------- 심벌
function drawCymbal(g, r, tone, tint) {
  const c = tint || CYM[tone] || CYM.gold;
  const ry = r * 0.28;
  // 아랫면 두께
  ellipse(g, 0, r * 0.05, r, ry);
  g.fillStyle = c.dark;
  g.fill();
  g.save();
  ellipse(g, 0, 0, r, ry);
  g.clip();
  // 비스듬한 금속 반사 (원뿔 그라데이션)
  let gr;
  if (g.createConicGradient) {
    gr = g.createConicGradient(-0.4, 0, 0);
    const st = [c.mid, c.light, c.mid, c.dark, c.mid, c.light, c.mid, c.dark, c.mid];
    st.forEach((col, i) => gr.addColorStop(i / (st.length - 1), col));
  } else {
    gr = g.createLinearGradient(-r, 0, r, 0);
    gr.addColorStop(0, c.dark);
    gr.addColorStop(0.4, c.light);
    gr.addColorStop(1, c.mid);
  }
  g.fillStyle = gr;
  g.fillRect(-r, -ry, r * 2, ry * 2);
  // 선반 자국
  g.lineWidth = Math.max(0.5, r * 0.012);
  for (let i = 0; i < 16; i++) {
    const f = 0.2 + (0.8 * i) / 15;
    g.strokeStyle = i % 2 ? `rgba(${c.groove},0.22)` : 'rgba(255,255,255,0.14)';
    ellipse(g, 0, -ry * 0.05 * (1 - f), r * f, ry * f);
    g.stroke();
  }
  // 위에서 빛
  const sh = g.createLinearGradient(0, -ry, 0, ry);
  sh.addColorStop(0, 'rgba(255,255,255,0.25)');
  sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh;
  g.fillRect(-r, -ry, r * 2, ry * 2);
  g.restore();
  // 벨 (가운데 볼록)
  ellipse(g, 0, -ry * 0.12, r * 0.24, ry * 0.36);
  const bg = g.createRadialGradient(-r * 0.06, -ry * 0.3, 0, 0, -ry * 0.1, r * 0.24);
  bg.addColorStop(0, c.light);
  bg.addColorStop(1, c.mid);
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = Math.max(0.6, r * 0.015);
  g.strokeStyle = `rgba(${c.groove},0.6)`;
  g.stroke();
  ellipse(g, 0, -ry * 0.2, r * 0.045, ry * 0.08);
  g.fillStyle = '#121014';
  g.fill();
  // 테두리
  g.lineWidth = Math.max(1, r * 0.03);
  g.strokeStyle = OUT;
  ellipse(g, 0, 0, r, ry);
  g.stroke();
}

// ---------------------------------------------------------------- 노트
function drawKickNote(g, w, h, C, grey) {
  const dep = h * 0.55;
  const main = grey ? '#8C86A0' : C.main;
  const light = grey ? '#D6D2E0' : C.light;
  const dark = grey ? '#4E4860' : C.dark;
  if (!grey) {
    g.save();
    g.shadowColor = `rgba(${C.rgb},0.9)`;
    g.shadowBlur = h * 0.9;
    rrect(g, -w / 2, -h / 2, w, h + dep, h / 2);
    g.fillStyle = `rgba(${C.rgb},0.6)`;
    g.fill();
    g.restore();
  }
  // 옆면(두께)
  rrect(g, -w / 2, -h / 2, w, h + dep, h / 2);
  g.fillStyle = OUT;
  g.fill();
  rrect(g, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h + dep - 3, h / 2);
  const sg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  sg.addColorStop(0, darken(dark, 0.35));
  sg.addColorStop(0.3, dark);
  sg.addColorStop(0.7, dark);
  sg.addColorStop(1, darken(dark, 0.35));
  g.fillStyle = sg;
  g.fill();
  // 윗면
  rrect(g, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 1, h / 2);
  const tg = g.createLinearGradient(0, -h / 2, 0, h / 2);
  tg.addColorStop(0, light);
  tg.addColorStop(0.55, main);
  tg.addColorStop(1, main);
  g.fillStyle = tg;
  g.fill();
  // 금속 끝마개
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - h * 0.62);
    ellipse(g, x, 0, h * 0.26, h * 0.26);
    g.fillStyle = metalGrad(g, x - h * 0.26, x + h * 0.26, 'chrome');
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = OUT;
    g.stroke();
  }
  // 광택
  rrect(g, -w / 2 + h * 1.05, -h * 0.34, w * 0.5, h * 0.2, h * 0.1);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fill();
}

function drawSnareNote(g, r, C, grey) {
  const ry = r * 0.62;
  const dep = r * 0.36;
  if (!grey) {
    g.save();
    g.shadowColor = `rgba(${C.rgb},0.9)`;
    g.shadowBlur = r * 0.6;
    ellipse(g, 0, dep * 0.5, r, ry);
    g.fillStyle = `rgba(${C.rgb},0.6)`;
    g.fill();
    g.restore();
  }
  // 옆면
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(-r, dep);
  g.ellipse(0, dep, r, ry, 0, Math.PI, 0, true);
  g.lineTo(r, 0);
  g.closePath();
  g.fillStyle = OUT;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = grey ? '#6E6880' : C.dark;
  g.fillRect(-r, 0, r * 2, dep + ry);
  cylShade(g, -r, r, 0, dep + ry, 0.9);
  g.restore();
  // 테(색) + 헤드
  ellipse(g, 0, 0, r, ry);
  g.fillStyle = OUT;
  g.fill();
  ellipse(g, 0, 0, r - 1.5, ry - 1.5);
  const hg = g.createLinearGradient(-r, -ry, r, ry);
  hg.addColorStop(0, grey ? '#D6D2E0' : C.light);
  hg.addColorStop(0.6, grey ? '#9A94AE' : C.main);
  hg.addColorStop(1, grey ? '#6E6880' : C.dark);
  g.fillStyle = hg;
  g.fill();
  const hr = g.createRadialGradient(-r * 0.25, -ry * 0.35, 0, 0, 0, r * 0.78);
  hr.addColorStop(0, '#FFFFFF');
  hr.addColorStop(1, grey ? '#C9C4D6' : '#EEF6FF');
  ellipse(g, 0, 0, r * 0.76, ry * 0.74);
  g.fillStyle = hr;
  g.fill();
  ellipse(g, 0, ry * 0.02, r * 0.16, ry * 0.16);
  g.fillStyle = grey ? '#8C86A0' : C.dark;
  g.fill();
  // 테 반사
  g.beginPath();
  g.ellipse(0, 0, r * 0.9, ry * 0.88, 0, Math.PI * 1.08, Math.PI * 1.5);
  g.lineWidth = r * 0.07;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
}

// ---------------------------------------------------------------- 색 유틸
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
export function lighten(h, k) {
  return rgbHex(hexRgb(h).map((v) => v + (255 - v) * k));
}
export function darken(h, k) {
  return rgbHex(hexRgb(h).map((v) => v * (1 - k)));
}

/**
 * 테마 하나의 드럼 세트 + 노트 스프라이트.
 * sz = { instR, padR, barW, barH, cymR(lane), dpr, standTo }  lanes = LANE 색 정보
 */
export function buildKit(theme, sz, lanes) {
  const kit = theme.kit;
  const dpr = sz.dpr;
  const out = {};
  // 킥: 헤드 반지름 = instR
  const R = sz.instR;
  out.kick = sprite(R * 2.6, R * 2.75, R * 1.3, R * 1.48, dpr, (g) => drawKick(g, R, kit));
  out.kickR = R;
  // 스네어: 테 가로 반지름
  const Rx = sz.instR * 1.22;
  const standTo = Math.max(Rx * 1.2, sz.standTo);
  out.snare = sprite(Rx * 2.3, standTo + Rx * 0.55 + Rx * 0.2, Rx * 1.15, Rx * 0.55, dpr, (g) => drawSnare(g, Rx, kit, standTo));
  out.snareRx = Rx;
  // 심벌 (하이햇·크래시 공용, 그릴 때 크기·기울기 조절)
  const cr = sz.cymR * 1.05;
  out.cym = sprite(cr * 2.2, cr * 0.9, cr * 1.1, cr * 0.4, dpr, (g) => drawCymbal(g, cr, kit.cym));
  out.cymR = cr;
  // 노트 (s=1 크기 기준, 가까이 오면 커지니 해상도 넉넉히)
  const nd = dpr * 1.6;
  const pad = 14;
  const C = lanes;
  out.notes = {};
  for (const grey of [false, true]) {
    const k = grey ? 'grey' : 'live';
    const n = (out.notes[k] = {});
    const w = sz.barW;
    const h = sz.barH;
    n[0] = sprite(w + pad * 2, h * 2 + pad * 2, w / 2 + pad, h / 2 + pad, nd, (g) => drawKickNote(g, w, h, C[0], grey));
    const r = sz.padR;
    n[1] = sprite(r * 2 + pad * 2, r * 1.9 + pad * 2, r + pad, r * 0.62 + pad, nd, (g) => drawSnareNote(g, r, C[1], grey));
    for (const lane of [2, 3]) {
      const cr2 = sz.cymR * (lane === 3 ? 1 : 0.86);
      const L = C[lane];
      const tint = grey
        ? { dark: '#4E4860', mid: '#8C86A0', light: '#D6D2E0', groove: '40,36,50' }
        : { dark: L.dark, mid: L.main, light: L.light, groove: '60,40,20' };
      n[lane] = sprite(cr2 * 2.2 + pad * 2, cr2 * 0.9 + pad * 2, cr2 * 1.1 + pad, cr2 * 0.4 + pad, nd, (g) => {
        if (!grey) {
          g.save();
          g.shadowColor = `rgba(${L.rgb},0.9)`;
          g.shadowBlur = cr2 * 0.35;
          ellipse(g, 0, 0, cr2, cr2 * 0.28);
          g.fillStyle = `rgba(${L.rgb},0.6)`;
          g.fill();
          g.restore();
        }
        drawCymbal(g, cr2, 'gold', tint);
        if (lane === 3 && !grey) {
          g.fillStyle = '#FFFFFF';
          for (const sx of [-0.6, 0.6]) {
            ellipse(g, cr2 * sx, -cr2 * 0.02, cr2 * 0.07, cr2 * 0.07);
            g.fill();
          }
        }
      });
    }
  }
  return out;
}
