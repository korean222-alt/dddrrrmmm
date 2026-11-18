// 맵 배경(정적) + 노래에 맞춰 움직이는 무대 효과(동적)
//   paintScenery: 하늘·땅·장식 (테마 바뀔 때·화면 크기 바뀔 때 한 번)
//   SceneFx.draw: 조명·입자·비트 반응 (매 프레임, heat 0~1 = 곡이 얼마나 달아올랐나)

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function radial(g, x, y, r, rgb, a, mid = 0.4) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(mid, `rgba(${rgb},${a * 0.4})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 노을 피크닉 전구 줄 위치 (정적 그림·동적 반짝임 공용) */
function garland(L) {
  const pts = [];
  const y0 = L.topY * 0.42;
  const sag = L.topY * 0.22;
  const n = Math.max(9, Math.round(L.W / 34));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: t * L.W, y: y0 + Math.sin(t * Math.PI) * sag * 0.25 + Math.abs(Math.sin(t * Math.PI * 2)) * sag });
  }
  return pts;
}

/** 블랙 스테이지 천장 조명 위치 */
function rigLamps(L) {
  const n = 5;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: L.GX + L.GW * (0.1 + (0.8 * i) / (n - 1)), y: L.H * 0.04 });
  return out;
}

// ------------------------------------------------------------------ 정적
export function paintScenery(g, L, T) {
  const { W, H, cx, topY, GW } = L;
  // 하늘
  const sky = g.createLinearGradient(0, 0, 0, topY);
  sky.addColorStop(0, T.sky[0]);
  sky.addColorStop(0.55, T.sky[1]);
  sky.addColorStop(1, T.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, topY + 1);
  // 땅
  const gd = g.createLinearGradient(0, topY, 0, H);
  gd.addColorStop(0, T.ground[0]);
  gd.addColorStop(1, T.ground[1]);
  g.fillStyle = gd;
  g.fillRect(0, topY, W, H - topY);
  const paint = PAINT[T.key];
  if (paint) paint(g, L, T, sky);
  // 지평선 빛
  g.save();
  g.globalCompositeOperation = 'lighter';
  radial(g, cx, topY, GW * 0.85, T.glow, T.key === 'void' ? 0.08 : 0.3);
  g.restore();
}

const PAINT = {
  sunset(g, L, T, sky) {
    const { W, cx, topY, GW } = L;
    const r = rng(3);
    // 구름
    g.fillStyle = 'rgba(255,190,210,0.28)';
    for (let i = 0; i < 6; i++) {
      const x = r() * W;
      const y = topY * (0.12 + r() * 0.35);
      const s = GW * (0.06 + r() * 0.06);
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(x + (k - 1.5) * s * 0.9, y + Math.abs(k - 1.5) * s * 0.2, s, s * 0.55, 0, 0, TAU);
        g.fill();
      }
    }
    // 레트로 해 (아래쪽 줄무늬)
    const sr = GW * 0.26;
    const sy = topY - sr * 0.12;
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx, sy, sr * 2.2, '255,170,120', 0.35);
    g.restore();
    const sg = g.createLinearGradient(0, sy - sr, 0, sy + sr * 0.3);
    sg.addColorStop(0, '#FFF1B0');
    sg.addColorStop(0.5, '#FFB86B');
    sg.addColorStop(1, '#FF5F8A');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(cx, sy, sr, Math.PI, 0);
    g.lineTo(cx + sr, topY);
    g.lineTo(cx - sr, topY);
    g.fill();
    g.fillStyle = sky;
    for (let i = 0; i < 5; i++) {
      const y = sy - sr * 0.5 + i * sr * 0.17;
      g.fillRect(cx - sr, y, sr * 2, sr * (0.02 + i * 0.022));
    }
    // 언덕 두 겹
    const hills = [
      ['#7A2F72', 0.07, 1.3, 11],
      ['#4A1C55', 0.04, 2.1, 17],
    ];
    for (const [col, amp, fr, seed] of hills) {
      const rr2 = rng(seed);
      const ph = rr2() * 6;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, topY + 1);
      for (let x = 0; x <= W; x += 6) {
        const y = topY - GW * amp * (0.6 + 0.4 * Math.sin((x / W) * Math.PI * fr * 2 + ph)) * (0.55 + Math.abs(x - cx) / W);
        g.lineTo(x, y);
      }
      g.lineTo(W, topY + 1);
      g.fill();
    }
    // 잔디 쪽 땅 무늬
    g.strokeStyle = 'rgba(255,170,190,0.07)';
    g.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const y = topY + (L.H - topY) * Math.pow(i / 12, 1.8);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // 전구 줄
    const pts = garland(L);
    g.strokeStyle = 'rgba(30,10,30,0.8)';
    g.lineWidth = 1.5;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    const cols = ['#FFE07A', '#FF9AB8', '#9AE6FF', '#C8FF9A'];
    pts.forEach((p, i) => {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.arc(p.x, p.y + 4, 3.2, 0, TAU);
      g.fill();
    });
  },

  city(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(5);
    // 별 몇 개
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) g.fillRect(r() * W, r() * topY * 0.6, 1.2, 1.2);
    // 빌딩 (먼 줄 → 가까운 줄)
    const rows = [
      { col: '#2A1452', hMin: 0.06, hMax: 0.16, wMin: 0.05, wMax: 0.1, win: 0.18 },
      { col: '#13082A', hMin: 0.08, hMax: 0.3, wMin: 0.07, wMax: 0.14, win: 0.3 },
    ];
    rows.forEach((row, ri) => {
      let x = -10;
      while (x < W + 10) {
        const w = GW * (row.wMin + r() * (row.wMax - row.wMin));
        // 가운데(길 끝)는 낮게, 옆으로 갈수록 높게
        const side = Math.min(1, Math.abs(x + w / 2 - cx) / (GW * 0.5));
        const h = GW * (row.hMin + r() * (row.hMax - row.hMin)) * (0.45 + side * 0.9);
        const y = topY - h;
        g.fillStyle = row.col;
        g.fillRect(x, y, w, h + 1);
        if (r() < 0.25 && ri === 1) {
          g.fillRect(x + w * 0.45, y - h * 0.18, Math.max(1.5, w * 0.06), h * 0.18);
          g.fillStyle = '#FF3355';
          g.beginPath();
          g.arc(x + w * 0.48, y - h * 0.18, 2, 0, TAU);
          g.fill();
        }
        // 창문
        const ws = Math.max(2, GW * 0.009);
        for (let wy = y + ws * 2; wy < topY - ws; wy += ws * 2.4)
          for (let wx = x + ws; wx < x + w - ws; wx += ws * 2)
            if (r() < row.win) {
              g.fillStyle = r() < 0.7 ? `rgba(255,214,120,${0.35 + r() * 0.5})` : `rgba(120,240,255,${0.35 + r() * 0.5})`;
              g.fillRect(wx, wy, ws, ws * 1.2);
            }
        x += w + GW * 0.004;
      }
    });
    // 네온 간판
    g.save();
    g.lineWidth = 2.5;
    [
      [0.05, 0.62, '#FF4FD8'],
      [0.82, 0.55, '#39E6FF'],
    ].forEach(([fx, fy, col]) => {
      const x = fx * W;
      const y = topY * fy;
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.strokeStyle = col;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, GW * 0.12, GW * 0.05, 6);
      else g.rect(x, y, GW * 0.12, GW * 0.05);
      g.stroke();
    });
    g.restore();
    // 바닥 네온 격자 (원근)
    g.save();
    g.beginPath();
    g.rect(0, topY, W, H - topY);
    g.clip();
    g.strokeStyle = 'rgba(255,79,216,0.28)';
    g.lineWidth = 1.2;
    for (let i = -14; i <= 14; i++) {
      g.beginPath();
      g.moveTo(cx + i * GW * 0.05, topY);
      g.lineTo(cx + i * GW * 0.05 * ((H - L.horizonY) / (topY - L.horizonY)), H);
      g.stroke();
    }
    for (let i = 1; i < 14; i++) {
      const y = topY + (H - topY) * Math.pow(i / 14, 2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.restore();
  },

  hall(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    // 파이프 오르간 (길 끝 뒤)
    const n = 23;
    const ow = GW * 0.95;
    const pw = ow / n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = cx - ow / 2 + i * pw;
      const h = topY * (0.32 + 0.38 * Math.pow(Math.sin(t * Math.PI), 1.4)) * (i % 2 ? 0.86 : 1);
      const pg = g.createLinearGradient(x, 0, x + pw, 0);
      pg.addColorStop(0, '#6E4A12');
      pg.addColorStop(0.35, '#FFE29A');
      pg.addColorStop(0.6, '#D9A93C');
      pg.addColorStop(1, '#5E3E0C');
      g.fillStyle = pg;
      g.fillRect(x + pw * 0.1, topY - h, pw * 0.8, h);
      g.fillStyle = 'rgba(20,6,4,0.8)';
      g.beginPath();
      g.ellipse(x + pw / 2, topY - h * 0.22, pw * 0.25, pw * 0.12, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,240,200,0.6)';
      g.beginPath();
      g.ellipse(x + pw / 2, topY - h, pw * 0.4, pw * 0.12, 0, 0, TAU);
      g.fill();
    }
    // 나무 바닥 (원근 널빤지)
    g.save();
    g.beginPath();
    g.rect(0, topY, W, H - topY);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      g.beginPath();
      g.moveTo(cx + i * GW * 0.035, topY);
      g.lineTo(cx + i * GW * 0.035 * ((H - L.horizonY) / (topY - L.horizonY)), H);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,210,150,0.06)';
    for (let i = 1; i < 16; i++) {
      const y = topY + (H - topY) * Math.pow(i / 16, 2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.restore();
    // 커튼 (양옆)
    const cw = Math.max(W * 0.12, (W - GW) / 2 + GW * 0.1);
    for (const side of [-1, 1]) {
      g.save();
      const x0 = side < 0 ? 0 : W;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 - side * cw, 0);
      g.quadraticCurveTo(x0 - side * cw * 0.55, H * 0.45, x0 - side * cw * 0.35, H * 0.72);
      g.lineTo(x0, H * 0.78);
      g.closePath();
      g.clip();
      const cg = g.createLinearGradient(x0, 0, x0 - side * cw, 0);
      for (let k = 0; k <= 10; k++) cg.addColorStop(k / 10, k % 2 ? '#3A050C' : '#8C1426');
      g.fillStyle = cg;
      g.fillRect(Math.min(x0, x0 - side * cw), 0, cw, H);
      const sh = g.createLinearGradient(0, 0, 0, H * 0.8);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)');
      sh.addColorStop(0.4, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = sh;
      g.fillRect(Math.min(x0, x0 - side * cw), 0, cw, H);
      g.restore();
      // 금색 끈
      g.fillStyle = '#E8B84A';
      g.beginPath();
      g.ellipse(x0 - side * cw * 0.42, H * 0.5, cw * 0.18, 4, side * 0.3, 0, TAU);
      g.fill();
    }
    // 위쪽 장식 휘장
    const vh = H * 0.045;
    g.fillStyle = '#6E0E1C';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, 0);
    g.lineTo(W, vh);
    const sc = Math.max(5, Math.round(W / 60));
    for (let i = sc; i >= 0; i--) {
      const x = (i / sc) * W;
      g.quadraticCurveTo(x + W / sc / 2, vh * 1.7, x, vh);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#E8B84A';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, vh * 0.55);
    g.lineTo(W, vh * 0.55);
    g.stroke();
  },

  void(g, L, T) {
    const { W, H, topY, GW } = L;
    // 천장 트러스
    const ty = H * 0.028;
    g.fillStyle = '#1A1B20';
    g.fillRect(0, ty - 4, W, 8);
    g.strokeStyle = '#2A2C33';
    g.lineWidth = 1.5;
    for (let x = 0; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, ty - 4);
      g.lineTo(x + 7, ty + 4);
      g.lineTo(x + 14, ty - 4);
      g.stroke();
    }
    // 조명 깡통 + 은은한 빛 기둥
    for (const p of rigLamps(L)) {
      const cone = g.createLinearGradient(0, p.y, 0, topY + (H - topY) * 0.3);
      cone.addColorStop(0, 'rgba(255,255,255,0.07)');
      cone.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(p.x - 5, p.y + 8);
      g.lineTo(p.x - GW * 0.12, topY + (H - topY) * 0.3);
      g.lineTo(p.x + GW * 0.12, topY + (H - topY) * 0.3);
      g.lineTo(p.x + 5, p.y + 8);
      g.fill();
      g.fillStyle = '#24252C';
      g.beginPath();
      if (g.roundRect) g.roundRect(p.x - 7, p.y, 14, 12, 3);
      else g.rect(p.x - 7, p.y, 14, 12);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(p.x - 5, p.y + 10, 10, 2);
    }
    // 반짝이는 검은 바닥 (지평선 쪽 살짝 반사)
    const sh = g.createLinearGradient(0, topY, 0, topY + (H - topY) * 0.25);
    sh.addColorStop(0, 'rgba(255,255,255,0.06)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, topY, W, (H - topY) * 0.25);
  },

  lava(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    // 연기 띠
    for (let i = 0; i < 4; i++) {
      const y = topY * (0.15 + i * 0.18);
      const sg = g.createLinearGradient(0, y - 12, 0, y + 12);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0.25)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.fillRect(0, y - 12, W, 24);
    }
    // 붉은 달
    const mx = cx + GW * 0.3;
    const my = topY * 0.42;
    const mr = GW * 0.09;
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, mx, my, mr * 3, '255,80,30', 0.35);
    g.restore();
    const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    mg.addColorStop(0, '#FFB070');
    mg.addColorStop(0.6, '#E8461A');
    mg.addColorStop(1, '#7A1406');
    g.fillStyle = mg;
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
    // 화산 (가운데 큰 것 + 옆 산)
    const mount = (x, w, h, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w, topY + 1);
      g.lineTo(x - w * 0.14, topY - h);
      g.lineTo(x + w * 0.14, topY - h);
      g.lineTo(x + w, topY + 1);
      g.fill();
    };
    mount(cx - GW * 0.45, GW * 0.35, topY * 0.28, '#2A0608');
    mount(cx + GW * 0.5, GW * 0.4, topY * 0.34, '#2A0608');
    const vh = topY * 0.42;
    mount(cx, GW * 0.42, vh, '#1A0304');
    // 분화구 빛 + 용암 줄기
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx, topY - vh, GW * 0.18, '255,110,30', 0.7);
    g.restore();
    g.strokeStyle = '#FF6A1A';
    g.lineCap = 'round';
    const r = rng(9);
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 1.5 + r() * 2;
      g.beginPath();
      let x = cx + (r() - 0.5) * GW * 0.1;
      let y = topY - vh;
      g.moveTo(x, y);
      while (y < topY) {
        y += vh * 0.12;
        x += (r() - 0.5) * GW * 0.04 + (x - cx) * 0.12;
        g.lineTo(x, Math.min(y, topY));
      }
      g.stroke();
    }
    // 땅 갈라진 틈
    g.save();
    g.shadowColor = '#FF5A1A';
    g.shadowBlur = 8;
    g.strokeStyle = 'rgba(255,110,40,0.8)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      let x = cx + side * (GW * 0.25 + r() * W * 0.5);
      let y = topY + (H - topY) * (0.05 + r() * 0.9);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * GW * 0.12;
        y += (r() - 0.3) * GW * 0.05;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  },

  aurora(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(31);
    // 별
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      g.fillRect(r() * W, r() * topY * 0.8, 1.3, 1.3);
    }
    // 오로라 띠 (정적 바탕. 움직이는 빛은 FX)
    g.save();
    g.globalCompositeOperation = 'lighter';
    auroraBands(g, L, 0, 0.55);
    g.restore();
    // 눈 덮인 산
    const peaks = [
      [cx - GW * 0.55, GW * 0.42, topY * 0.42],
      [cx - GW * 0.15, GW * 0.3, topY * 0.3],
      [cx + GW * 0.25, GW * 0.38, topY * 0.48],
      [cx + GW * 0.62, GW * 0.4, topY * 0.36],
    ];
    for (const [x, w, h] of peaks) {
      const mg = g.createLinearGradient(0, topY - h, 0, topY);
      mg.addColorStop(0, '#FFFFFF');
      mg.addColorStop(0.28, '#BFD6E6');
      mg.addColorStop(1, '#2A4A64');
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(x - w, topY + 1);
      g.lineTo(x - w * 0.1, topY - h);
      g.lineTo(x + w * 0.08, topY - h * 0.92);
      g.lineTo(x + w, topY + 1);
      g.fill();
      g.fillStyle = 'rgba(20,40,60,0.35)';
      g.beginPath();
      g.moveTo(x + w * 0.08, topY - h * 0.92);
      g.lineTo(x + w, topY + 1);
      g.lineTo(x + w * 0.2, topY + 1);
      g.fill();
    }
    // 눈밭 반짝이
    for (let i = 0; i < 120; i++) {
      const y = topY + (H - topY) * Math.pow(r(), 1.5);
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
      g.fillRect(r() * W, y, 1.5, 1.5);
    }
  },

  space(g, L, T) {
    const { W, H, cx, topY, GW } = L;
    const r = rng(21);
    // 성운
    g.save();
    g.globalCompositeOperation = 'lighter';
    radial(g, cx - GW * 0.35, topY * 0.35, GW * 0.5, '150,60,220', 0.22, 0.5);
    radial(g, cx + GW * 0.35, topY * 0.6, GW * 0.45, '40,160,230', 0.18, 0.5);
    radial(g, cx, topY * 0.9, GW * 0.6, '255,90,200', 0.12, 0.5);
    g.restore();
    // 별
    for (let i = 0; i < 180; i++) {
      const y = r() * H;
      const s = r() < 0.1 ? 2.2 : r() < 0.4 ? 1.4 : 0.9;
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
      g.fillRect(r() * W, y, s, s);
    }
    // 고리 행성
    const px = cx - GW * 0.3;
    const py = topY * 0.45;
    const pr = GW * 0.085;
    const ring = () => {
      g.beginPath();
      g.ellipse(px, py, pr * 1.9, pr * 0.42, -0.3, 0, TAU);
    };
    g.lineWidth = pr * 0.16;
    g.strokeStyle = 'rgba(255,214,140,0.55)';
    ring();
    g.stroke();
    const pg = g.createRadialGradient(px - pr * 0.35, py - pr * 0.4, 0, px, py, pr);
    pg.addColorStop(0, '#FFE2B0');
    pg.addColorStop(0.6, '#E58A5A');
    pg.addColorStop(1, '#5A2A5A');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    // 고리 앞쪽 반
    g.save();
    g.beginPath();
    g.rect(px - pr * 2, py - pr * 0.05, pr * 4, pr);
    g.clip();
    g.strokeStyle = 'rgba(255,224,170,0.75)';
    ring();
    g.stroke();
    g.restore();
    // 작은 달
    g.fillStyle = '#CFD6FF';
    g.beginPath();
    g.arc(cx + GW * 0.36, topY * 0.25, GW * 0.025, 0, TAU);
    g.fill();
    // 지평선 빛줄기
    const hl = g.createLinearGradient(0, topY - 2, 0, topY + 6);
    hl.addColorStop(0, 'rgba(120,200,255,0)');
    hl.addColorStop(0.5, 'rgba(120,200,255,0.5)');
    hl.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = hl;
    g.fillRect(0, topY - 2, W, 8);
  },
};

/** 오로라 띠 (t = 시간으로 일렁임, a = 밝기) */
function auroraBands(g, L, t, a) {
  const { W, topY } = L;
  const bands = [
    ['120,255,200', 0.18, 0.12],
    ['140,180,255', 0.3, 0.1],
    ['200,140,255', 0.42, 0.08],
  ];
  bands.forEach(([col, fy, th], k) => {
    const y0 = topY * fy;
    const h = topY * th;
    g.beginPath();
    g.moveTo(0, y0);
    for (let x = 0; x <= W; x += 12) g.lineTo(x, y0 + Math.sin(x / W * 6.3 + t * (0.5 + k * 0.2) + k) * h * 0.7);
    for (let x = W; x >= 0; x -= 12) g.lineTo(x, y0 + h * 2.2 + Math.sin(x / W * 5.1 + t * 0.4 + k * 2) * h * 0.5);
    g.closePath();
    const gr = g.createLinearGradient(0, y0 - h, 0, y0 + h * 2.6);
    gr.addColorStop(0, `rgba(${col},0)`);
    gr.addColorStop(0.35, `rgba(${col},${a * 0.6})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fill();
  });
}

// ------------------------------------------------------------------ 동적
// 매 프레임 그라데이션을 새로 만들면 느린 폰에서 버벅여서, 빛·기둥·햇살·오로라는 미리 그려 둔 그림(스프라이트)을
// 크기·투명도만 바꿔 찍음. quality: 2 = 전부 / 1 = 입자·테마 장식 빼고 조명만 / 0 = 동적 효과 없음
const BEAMS = { sunset: 'swing', city: 'swing', hall: 'down', void: 'down', lava: 'swing', space: 'swing', aurora: 'none' };

const glowCache = new Map();
/** 가운데가 밝은 동그란 빛 (색마다 한 번만 그림, 128px) */
function glowSprite(rgb) {
  let c = glowCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.4, `rgba(${rgb},0.4)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(rgb, c);
  return c;
}
/** 반지름 r 짜리 빛을 a 세기로 (ctx 는 이미 lighter 상태) */
function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0.004 || r <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

const beamCache = new Map();
/** 위에서 아래로 퍼지는 조명 기둥 (꼭대기 0,0 · 길이 1 · 끝 너비 1 기준으로 늘려 씀) */
function beamSprite(rgb) {
  let c = beamCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(30, 0);
  g.lineTo(0, 256);
  g.lineTo(64, 256);
  g.lineTo(34, 0);
  g.fill();
  beamCache.set(rgb, c);
  return c;
}
/** (x,y) 에서 ang 방향(0 = 아래)으로 len 길이, 끝 너비 w 인 기둥 */
function beam(ctx, x, y, ang, len, w, rgb, a) {
  if (a <= 0.004) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(beamSprite(rgb), -w / 2, 0, w, len);
  ctx.restore();
}

export class SceneFx {
  constructor() {
    this.parts = [];
    this.last = 0;
    this.spawnAcc = 0;
    this._key = '';
  }

  reset() {
    this.parts = [];
  }

  /** 화면 크기·맵이 바뀌면 미리 그려 둘 것들 (햇살 바퀴·오로라 띠·아래 열기 그라데이션) */
  _prepare(ctx, L, T) {
    const key = `${T.key}:${L.W}x${L.H}`;
    if (this._key === key) return;
    this._key = key;
    this.rays = null;
    this.aurora = null;
    this.heatGrad = null;
    this.strobe = null;
    if (T.key === 'sunset') {
      const sr = L.GW * 0.26;
      const R = sr * 2.6;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.translate(128, 128);
      g.fillStyle = 'rgba(255,210,150,1)';
      for (let i = 0; i < 12; i++) {
        g.rotate((Math.PI * 2) / 12);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-128 * (0.12 / 2.6), -128);
        g.lineTo(128 * (0.12 / 2.6), -128);
        g.fill();
      }
      this.rays = { c, R };
    }
    if (T.key === 'aurora') {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(L.W / 2));
      c.height = Math.max(1, Math.round(L.topY / 2));
      const g = c.getContext('2d');
      g.scale(0.5, 0.5);
      auroraBands(g, L, 0, 1);
      this.aurora = c;
    }
    if (T.key === 'lava') {
      const gr = ctx.createLinearGradient(0, L.H, 0, L.H * 0.6);
      gr.addColorStop(0, 'rgba(255,70,10,1)');
      gr.addColorStop(1, 'rgba(255,70,10,0)');
      this.heatGrad = gr;
    }
    if (T.key === 'void') {
      const gr = ctx.createLinearGradient(0, 0, 0, L.strikeY);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      this.strobe = gr;
    }
  }

  /**
   * s = { rt, heat 0~1, beat(박 첫머리 1 → 0), barBeat(마디 첫 박이면 같은 값, 아니면 0),
   *       pe(킥 펀치), fever, playing, lite, quality(2·1·0) }
   */
  draw(ctx, L, T, s) {
    const dt = Math.min(0.05, Math.max(0, s.rt - (this.last || s.rt)));
    this.last = s.rt;
    const q = s.lite ? 0 : s.quality ?? 2;
    if (q <= 0) return;
    this._prepare(ctx, L, T);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this._beams(ctx, L, T, s, q);
    if (q >= 2) {
      const fx = FX[T.key];
      if (fx) fx.call(this, ctx, L, T, s);
    }
    // 곡이 달아오르면 지평선이 비트에 맞춰 크게 빛남
    const hk = s.heat * (0.55 + 0.45 * s.beat);
    glow(ctx, L.cx, L.topY, L.GW * (0.55 + 0.25 * s.beat), T.hot, 0.28 * hk);
    // 곡이 한 단계 달아오른 순간: 지평선에서 빛이 퍼짐 + 입자 한 번에
    if (s.surge > 0.01) {
      glow(ctx, L.cx, L.topY, L.GW * (0.5 + (1 - s.surge) * 0.9), T.hot, 0.45 * s.surge);
      if (!this._surging && q >= 2) for (let i = 0; i < 24 && this.parts.length < 110; i++) this.parts.push(spawn(T.particle, L, s));
      this._surging = true;
    } else this._surging = false;
    ctx.restore();
    if (q >= 2) this._particles(ctx, L, T, s, dt);
    else this.parts.length = 0;
  }

  _beams(ctx, L, T, s, q) {
    const mode = BEAMS[T.key];
    if (mode === 'none') return;
    const a0 = 0.05 + s.heat * 0.07 + s.beat * (0.03 + s.heat * 0.05) + s.pe * 0.1 + (s.fever ? 0.04 : 0);
    if (mode === 'down') {
      const lamps = T.key === 'void' ? rigLamps(L) : [0.12, 0.5, 0.88].map((f) => ({ x: L.GX + L.GW * f, y: 0 }));
      const yb = L.strikeY + (L.H - L.strikeY) * 0.2;
      const spread = L.GW * (0.32 + 0.1 * s.heat);
      lamps.forEach((p, k) => {
        if (q < 2 && k % 2) return;
        // 블랙 스테이지: 마디 첫 박에 조명이 하나씩 번갈아 '팍' (곡 절정일수록)
        const on = T.key === 'void' ? a0 * 0.6 + s.barBeat * s.heat * (k % 2 === (s.barIdx & 1) ? 0.22 : 0.05) : a0 * 0.8;
        beam(ctx, p.x, p.y + 6, 0, yb - p.y, spread, T.spots[k % T.spots.length], on * 1.6);
      });
      return;
    }
    const speed = (s.fever ? 1.6 : 0.6) * (0.7 + s.heat * 0.8);
    [0.08, 0.34, 0.66, 0.92].forEach((fx, k) => {
      if (q < 2 && (k === 1 || k === 2)) return;
      const x = L.GX + L.GW * fx;
      const ang = Math.sin(s.rt * speed + k * 1.7) * (0.3 + s.heat * 0.15) + (fx - 0.5) * -0.5;
      const col = T.spots[k];
      beam(ctx, x, L.H * 0.02, ang, L.H * 0.95, L.GW * 0.32, col, a0 * 2);
      glow(ctx, x, L.H * 0.022, L.GW * 0.03, col, 0.9);
    });
  }

  _particles(ctx, L, T, s, dt) {
    const kind = T.particle;
    // 곡이 달아오를수록 많이
    const rate = (PART_RATE[kind] || 6) * (0.35 + s.heat * 1.1) * (s.playing ? 1 : 0.4);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1 && this.parts.length < 60) {
      this.spawnAcc -= 1;
      this.parts.push(spawn(kind, L, s));
    }
    if (this.spawnAcc > 1) this.spawnAcc = 0;
    const keep = [];
    for (const p of this.parts) {
      const age = s.rt - p.t0;
      if (age > p.life || age < 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      keep.push(p);
      const fade = Math.min(1, age / 0.3, (p.life - age) / 0.5);
      drawPart(ctx, p, fade, s);
    }
    this.parts = keep;
  }
}

const PART_RATE = { petal: 7, neon: 9, gold: 12, haze: 2.5, ember: 22, star: 14, snow: 18 };

function spawn(kind, L, s) {
  const r = Math.random;
  const p = { kind, t0: s.rt, rot: r() * TAU, vr: (r() - 0.5) * 3, size: 1, x: 0, y: 0, vx: 0, vy: 0, life: 4 };
  const W = L.W;
  const H = L.H;
  switch (kind) {
    case 'petal':
      Object.assign(p, { x: r() * W, y: -10, vx: 15 + r() * 30, vy: 30 + r() * 40, size: 3 + r() * 3, life: 9, col: r() < 0.6 ? '255,170,200' : '255,230,180' });
      break;
    case 'neon':
      Object.assign(p, { x: r() * W, y: H + 10, vx: 0, vy: -(40 + r() * 70), size: 1.5 + r() * 2.5, life: 9, col: r() < 0.5 ? '255,79,216' : '57,230,255' });
      break;
    case 'gold':
      // 절정이면 위에서 금빛 종이가루, 아니면 떠다니는 먼지
      if (s.heat > 0.7 && r() < 0.6)
        Object.assign(p, { x: r() * W, y: -10, vx: (r() - 0.5) * 30, vy: 60 + r() * 60, size: 3 + r() * 3, life: 9, col: r() < 0.5 ? '255,215,110' : '255,240,200', conf: true, vr: (r() - 0.5) * 8 });
      else Object.assign(p, { x: L.GX + r() * L.GW, y: r() * L.strikeY, vx: (r() - 0.5) * 8, vy: -4 - r() * 8, size: 1 + r() * 1.6, life: 4 + r() * 3, col: '255,220,150' });
      break;
    case 'snow':
      Object.assign(p, { x: r() * W, y: -6, vx: (r() - 0.3) * 20, vy: 25 + r() * 45, size: 1 + r() * 2.2, life: 14, col: '255,255,255' });
      break;
    case 'haze':
      Object.assign(p, { x: r() * W, y: L.topY + r() * (H - L.topY) * 0.6, vx: (r() < 0.5 ? -1 : 1) * (6 + r() * 10), vy: -2, size: L.GW * (0.2 + r() * 0.25), life: 8, col: '255,255,255' });
      break;
    case 'ember':
      Object.assign(p, { x: r() * W, y: H + 6, vx: (r() - 0.5) * 30, vy: -(60 + r() * 120), size: 1.2 + r() * 2.2, life: 6, col: r() < 0.6 ? '255,120,40' : '255,200,80' });
      break;
    case 'star': {
      // 소실점에서 바깥으로 튀어나오는 별 (워프)
      const a = r() * TAU;
      const sp = 60 + r() * 120 + s.heat * 260;
      Object.assign(p, { x: L.cx + Math.cos(a) * 6, y: L.topY + Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, size: 1 + r() * 1.4, life: 3, col: r() < 0.7 ? '255,255,255' : '160,200,255', warp: true });
      break;
    }
  }
  return p;
}

function drawPart(ctx, p, fade, s) {
  switch (p.kind) {
    case 'petal':
      ctx.save();
      ctx.globalAlpha = 0.7 * fade;
      ctx.translate(p.x + Math.sin(p.rot) * 6, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgb(${p.col})`;
      ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      ctx.restore();
      break;
    case 'gold':
      if (p.conf) {
        ctx.save();
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = `rgb(${p.col})`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7 * Math.abs(Math.cos(p.rot * 2)));
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, p.x, p.y, p.size * 2.5, p.col, (0.5 + 0.4 * s.beat) * fade);
        ctx.globalCompositeOperation = 'source-over';
      }
      break;
    case 'haze':
      glow(ctx, p.x, p.y, p.size, '255,255,255', fade * 0.05);
      break;
    case 'snow':
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(p.x + Math.sin(p.rot) * 5 - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
      break;
    case 'star': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.9;
      const k = 0.03 + s.heat * 0.06;
      ctx.strokeStyle = `rgb(${p.col})`;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      ctx.stroke();
      ctx.restore();
      break;
    }
    default: {
      // neon · ember: 빛나는 점
      ctx.globalCompositeOperation = 'lighter';
      const x = p.x + (p.kind === 'ember' ? Math.sin(p.rot * 2) * 4 : 0);
      glow(ctx, x, p.y, p.size * 3, p.col, fade * (p.kind === 'ember' ? 0.9 : 0.6));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** 테마별 장식 (this = SceneFx, ctx 는 lighter 상태) */
const FX = {
  sunset(ctx, L, T, s) {
    // 해 뒤로 도는 햇살 (미리 그린 바퀴를 돌림)
    const sr = L.GW * 0.26;
    const sy = L.topY - sr * 0.12;
    if (this.rays) {
      ctx.save();
      ctx.translate(L.cx, sy);
      ctx.rotate(s.rt * 0.08);
      ctx.globalAlpha = Math.min(1, 0.04 + s.heat * 0.08 + s.beat * 0.04);
      const R = this.rays.R;
      ctx.drawImage(this.rays.c, -R, -R, R * 2, R * 2);
      ctx.restore();
    }
    // 전구가 박자마다 번갈아 반짝
    const pts = garland(L);
    const cols = ['255,224,122', '255,154,184', '154,230,255', '200,255,154'];
    const b = Math.floor(s.beatNo || 0);
    pts.forEach((p, i) => {
      const on = (i + b) % 2 === 0 ? s.beat : 0;
      glow(ctx, p.x, p.y + 4, 12 + 8 * on, cols[i % cols.length], 0.25 + 0.25 * s.heat + on * (0.4 + 0.4 * s.heat));
    });
  },
  city(ctx, L, T, s) {
    // 지평선 위 이퀄라이저 (박자·곡 세기에 맞춰)
    const n = 18;
    const w = L.GW / n;
    const b = Math.floor(s.beatNo || 0);
    ctx.globalAlpha = 0.25 + 0.3 * s.heat;
    for (let i = 0; i < n; i++) {
      const seed = Math.sin(i * 12.9898 + b * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed);
      const h = L.topY * 0.06 * (0.3 + rnd * (0.4 + s.heat)) * (0.5 + s.beat * 0.8);
      ctx.fillStyle = i % 2 ? 'rgb(57,230,255)' : 'rgb(255,79,216)';
      ctx.fillRect(L.GX + i * w + w * 0.15, L.topY - h, w * 0.7, h);
    }
    ctx.globalAlpha = 1;
  },
  hall(ctx, L, T, s) {
    // 금빛 오르간이 박자에 맞춰 은은하게
    glow(ctx, L.cx, L.topY - L.topY * 0.35, L.GW * 0.6, '255,210,120', 0.06 + 0.1 * s.heat * s.beat);
  },
  void(ctx, L, T, s) {
    // 절정: 마디 첫 박에 화면 위쪽이 하얗게 번쩍 (눈부시지 않게 약하게)
    if (this.strobe && s.heat > 0.6 && s.barBeat > 0) {
      ctx.globalAlpha = 0.14 * s.barBeat * s.heat;
      ctx.fillStyle = this.strobe;
      ctx.fillRect(0, 0, L.W, L.strikeY);
      ctx.globalAlpha = 1;
    }
  },
  lava(ctx, L, T, s) {
    // 분화구가 박자마다 끓어오름 + 화면 아래 열기
    const vh = L.topY * 0.42;
    glow(ctx, L.cx, L.topY - vh, L.GW * (0.2 + 0.1 * s.beat + 0.1 * s.heat), '255,100,20', 0.25 + 0.35 * s.beat * (0.4 + s.heat));
    if (this.heatGrad) {
      ctx.globalAlpha = 0.08 + 0.14 * s.heat;
      ctx.fillStyle = this.heatGrad;
      ctx.fillRect(0, L.H * 0.6, L.W, L.H * 0.4);
      ctx.globalAlpha = 1;
    }
  },
  aurora(ctx, L, T, s) {
    // 오로라가 박자·곡 세기에 맞춰 일렁이며 밝아짐 (미리 그린 띠를 좌우로 흔들며 겹쳐 찍음)
    if (!this.aurora) return;
    const a = Math.min(1, 0.12 + 0.25 * s.heat + 0.15 * s.beat);
    const dx = Math.sin(s.rt * 0.35) * L.W * 0.04;
    ctx.globalAlpha = a;
    ctx.drawImage(this.aurora, dx, 0, L.W, L.topY);
    ctx.globalAlpha = a * 0.5;
    ctx.drawImage(this.aurora, -dx * 1.6, L.topY * 0.03, L.W, L.topY);
    ctx.globalAlpha = 1;
  },
  space(ctx, L, T, s) {
    glow(ctx, L.cx, L.topY, L.GW * 0.35, '160,140,255', 0.1 + 0.2 * s.beat * (0.3 + s.heat));
  },
};
