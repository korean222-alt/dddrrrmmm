// 콩콩 드럼 마스코트 — 쿵콩이(킥) / 짝콩이(스네어)
// SVG 하나로 화면(DOM)과 게임(캔버스) 양쪽에 같은 그림을 씁니다.

export const OUTLINE = '#2B1D3A';

export const MASCOTS = {
  kong: { name: '쿵콩이', body: '#FFD3A1', hi: '#FFF3E2', shade: '#EFA567', leaf: '#7BD66A', leafDark: '#4FA845' },
  jjak: { name: '짝콩이', body: '#BDF0DE', hi: '#F2FFFA', shade: '#74CDB5', leaf: '#8EE07A', leafDark: '#52AE4A' },
};

export const DRUMS = {
  kong: { body: '#FF7B54', bodyDark: '#C94A2C', stripe: '#FFE3A8', lug: '#FFF4E4', rim: '#ECE8F7', rimDark: '#A8A2C4', height: 96 },
  jjak: { body: '#EAF6FF', bodyDark: '#A9C2D6', stripe: '#4FD6E0', lug: '#9FB2C9', rim: '#ECE8F7', rimDark: '#A8A2C4', height: 76 },
};

let uid = 0;

function sprout(kind, p) {
  const o = OUTLINE;
  if (kind === 'kong') {
    return `
    <path d="M100 46 C 98 34 100 26 104 17" stroke="${o}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M100 46 C 98 34 100 26 104 17" stroke="${p.leafDark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M104 20 C 114 4 138 4 146 13 C 137 27 116 31 104 20 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M110 19 C 120 14 130 12 138 13" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M101 24 C 91 10 69 10 61 19 C 69 32 89 35 101 24 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>`;
  }
  // 짝콩이: 큰 잎 하나 + 동그란 꽃봉오리
  return `
    <path d="M100 46 C 101 34 98 25 93 17" stroke="${o}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M100 46 C 101 34 98 25 93 17" stroke="${p.leafDark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M95 20 C 84 2 58 2 50 12 C 59 28 82 33 95 20 Z" fill="${p.leaf}" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M89 18 C 79 13 69 11 60 12" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="112" cy="22" r="10" fill="#FFB3C7" stroke="${o}" stroke-width="5"/>
    <circle cx="109" cy="19" r="3" fill="#fff" fill-opacity=".8"/>`;
}

function face(type) {
  const o = OUTLINE;
  const blush = `
    <ellipse cx="54" cy="139" rx="12" ry="7.5" fill="#FF8FA8" opacity=".6"/>
    <ellipse cx="146" cy="139" rx="12" ry="7.5" fill="#FF8FA8" opacity=".6"/>`;
  if (type === 'hit') {
    return `${blush}
    <path d="M63 122 Q74 106 85 122" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M115 122 Q126 106 137 122" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M86 132 Q100 130 114 132 Q112 156 100 156 Q88 156 86 132 Z" fill="#7A2840" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="149" rx="8" ry="4.5" fill="#FF7E95"/>`;
  }
  if (type === 'miss') {
    return `${blush}
    <path d="M64 109 L83 118 L64 127" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M136 109 L117 118 L136 127" stroke="${o}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M86 143 Q93 136 100 143 Q107 150 114 143" stroke="${o}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M160 70 C 152 84 152 94 160 97 C 168 94 168 84 160 70 Z" fill="#8FD3FF" stroke="${o}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (type === 'cheer') {
    // 반짝 별 눈
    const star = (cx, cy) =>
      `<path d="M${cx} ${cy - 13} L${cx + 4} ${cy - 4} L${cx + 13} ${cy} L${cx + 4} ${cy + 4} L${cx} ${cy + 13} L${cx - 4} ${cy + 4} L${cx - 13} ${cy} L${cx - 4} ${cy - 4} Z" fill="${o}"/>
       <circle cx="${cx + 2}" cy="${cy - 3}" r="2.5" fill="#fff"/>`;
    return `${blush}${star(74, 117)}${star(126, 117)}
    <path d="M86 132 Q100 130 114 132 Q112 156 100 156 Q88 156 86 132 Z" fill="#7A2840" stroke="${o}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="149" rx="8" ry="4.5" fill="#FF7E95"/>`;
  }
  // idle
  return `${blush}
    <ellipse cx="74" cy="118" rx="9.5" ry="12.5" fill="${o}"/>
    <ellipse cx="126" cy="118" rx="9.5" ry="12.5" fill="${o}"/>
    <circle cx="77.5" cy="112.5" r="4" fill="#fff"/>
    <circle cx="129.5" cy="112.5" r="4" fill="#fff"/>
    <circle cx="71" cy="123" r="1.8" fill="#fff" opacity=".8"/>
    <circle cx="123" cy="123" r="1.8" fill="#fff" opacity=".8"/>
    <path d="M90 136 Q95 143 100 136 Q105 143 110 136" stroke="${o}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** 마스코트 SVG 문자열. viewBox 200x200, 몸 바닥이 y≈188 */
export function mascotSVG(kind = 'kong', type = 'idle', size = 200) {
  const p = MASCOTS[kind];
  const id = `m${kind}${++uid}`;
  const o = OUTLINE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}" cx="36%" cy="30%" r="80%">
      <stop offset="0" stop-color="${p.hi}"/>
      <stop offset=".5" stop-color="${p.body}"/>
      <stop offset="1" stop-color="${p.shade}"/>
    </radialGradient>
  </defs>
  ${sprout(kind, p)}
  <path d="M100 40 C 152 40 183 84 183 130 C 183 170 148 189 100 189 C 52 189 17 170 17 130 C 17 84 48 40 100 40 Z" fill="url(#${id})" stroke="${o}" stroke-width="6"/>
  <ellipse cx="64" cy="74" rx="17" ry="9" fill="#fff" opacity=".6" transform="rotate(-32 64 74)"/>
  <circle cx="86" cy="62" r="4" fill="#fff" opacity=".6"/>
  ${face(type)}
  <ellipse cx="30" cy="172" rx="17" ry="12.5" fill="${p.body}" stroke="${o}" stroke-width="5.5"/>
  <ellipse cx="170" cy="172" rx="17" ry="12.5" fill="${p.body}" stroke="${o}" stroke-width="5.5"/>
</svg>`;
}

/** 드럼 SVG. viewBox 240x200, 헤드 중심 (120,56) rx110 ry40 */
export const DRUM_VIEW = { w: 240, h: 200, cx: 120, cy: 56, rx: 110, ry: 40 };

export function drumSVG(kind = 'kong', size = 240) {
  const d = DRUMS[kind];
  const { cx, cy, rx, ry } = DRUM_VIEW;
  const h = d.height;
  const id = `d${kind}${++uid}`;
  const L = cx - rx;
  const R = cx + rx;
  const yb = cy + h;
  const s1 = cy + h * 0.38;
  const s2 = cy + h * 0.62;
  const lugs = [-0.78, -0.4, 0, 0.4, 0.78]
    .map((f) => {
      const x = cx + rx * f;
      const front = ry * Math.sqrt(1 - f * f);
      const w = 11 * Math.sqrt(1 - f * f) + 3;
      const y1 = cy + front + h * 0.12;
      const y2 = cy + front + h * 0.82;
      return `<rect x="${(x - w / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${(y2 - y1).toFixed(1)}" rx="${(w / 2).toFixed(1)}" fill="${d.lug}" stroke="${OUTLINE}" stroke-width="3"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="${size}" height="${(size * 200) / 240}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" x2="1">
      <stop offset="0" stop-color="${d.bodyDark}"/>
      <stop offset=".22" stop-color="${d.body}"/>
      <stop offset=".6" stop-color="${d.body}"/>
      <stop offset="1" stop-color="${d.bodyDark}"/>
    </linearGradient>
    <radialGradient id="${id}h" cx="45%" cy="40%" r="70%">
      <stop offset="0" stop-color="#FFFDF8"/>
      <stop offset="1" stop-color="#F1E8DA"/>
    </radialGradient>
  </defs>
  <path d="M${L} ${cy} L${L} ${yb} A${rx} ${ry} 0 0 0 ${R} ${yb} L${R} ${cy} Z" fill="url(#${id}b)" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M${L} ${s1} A${rx} ${ry} 0 0 0 ${R} ${s1} L${R} ${s2} A${rx} ${ry} 0 0 1 ${L} ${s2} Z" fill="${d.stripe}" opacity=".95"/>
  ${lugs}
  <path d="M${L} ${yb - 7} A${rx} ${ry} 0 0 0 ${R} ${yb - 7} L${R} ${yb} A${rx} ${ry} 0 0 1 ${L} ${yb} Z" fill="${d.rimDark}" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id}h)" stroke="${OUTLINE}" stroke-width="5"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx - 5}" ry="${ry - 3}" fill="none" stroke="${d.rim}" stroke-width="8"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx - 5}" ry="${ry - 3}" fill="none" stroke="${d.rimDark}" stroke-width="2" opacity=".6"/>
  <ellipse cx="${cx - 30}" cy="${cy - 8}" rx="32" ry="8" fill="#fff" opacity=".55"/>
</svg>`;
}

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function rasterize(svg, w, h) {
  const img = await svgToImage(svg);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * 캔버스용 래스터 묶음. pxSize = 마스코트 한 변 픽셀(디바이스 픽셀).
 * { kong: {idle,hit,miss,cheer}, jjak: {...}, drum: {kong, jjak} }
 */
export async function buildRasters(mascotPx, drumPx) {
  const out = { kong: {}, jjak: {}, drum: {} };
  const jobs = [];
  for (const kind of ['kong', 'jjak']) {
    for (const type of ['idle', 'hit', 'miss', 'cheer']) {
      jobs.push(rasterize(mascotSVG(kind, type, mascotPx), mascotPx, mascotPx).then((c) => (out[kind][type] = c)));
    }
    jobs.push(rasterize(drumSVG(kind, drumPx), drumPx, (drumPx * 200) / 240).then((c) => (out.drum[kind] = c)));
  }
  await Promise.all(jobs);
  return out;
}
