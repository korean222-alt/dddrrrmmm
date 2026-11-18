// 직접 그린 아이콘 (SVG). 화면에 이모지를 안 쓰고 전부 이걸로 보여 줌.
//   icon('heart') → <svg class="i"> 문자열 (innerHTML 에 넣어서 씀)
//   글 속에 이모지를 적어도 됨: watchEmoji() 가 화면에 붙는 글의 이모지를 같은 모양 아이콘으로 바꿔 줌
//   (EMOJI 표에 없는 이모지는 지움). 캔버스 글씨엔 이모지를 쓰지 말 것 (바꿀 수 없음).

const S = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';

export const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 13v4M8 20h8M9.5 17h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/>',
  retry: '<path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-5.7 2.3L4 8.5M4 4v4.5h4.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="3" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M16 10.5l5-3v9l-5-3z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>',
  swords: '<path d="M4 4l9.5 9.5M4 4v3.5M4 4h3.5M20 4l-9.5 9.5M20 4v3.5M20 4h-3.5M7 14l3 3M5.5 18.5l2-2M17 14l-3 3M18.5 18.5l-2-2" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.2a4.4 4.4 0 018 2.7c0 5.7-8 10.6-8 10.6z" fill="currentColor"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/>',

  // ---- 이모지 대신 쓰는 것들 ----
  gem: `<path d="M7 3.5h10l4.5 5.6L12 21 2.5 9.1z" ${F} fill-opacity=".22"/><path d="M7 3.5h10l4.5 5.6L12 21 2.5 9.1zM2.5 9.1h19M9.4 9.1L12 21l2.6-11.9M7 3.5l2.4 5.6L12 3.5l2.6 5.6L17 3.5" ${S} stroke-width="1.9"/>`,
  sparkle: `<path d="M10 2c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7zM18.5 14c.3 2.1 1.4 3.2 3.5 3.5-2.1.3-3.2 1.4-3.5 3.5-.3-2.1-1.4-3.2-3.5-3.5 2.1-.3 3.2-1.4 3.5-3.5z" ${F}/>`,
  bolt: `<path d="M13.5 2L4.5 13.5h6.5L10 22l9.5-12.5h-6.7z" ${F} stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  burst: `<path d="M12 2l2 5.2 5-2.6-1.9 5.3L22 12l-4.9 2.1 1.9 5.3-5-2.6L12 22l-2-5.2-5 2.6 1.9-5.3L2 12l4.9-2.1L5 4.6l5 2.6z" ${F}/>`,
  drum: `<ellipse cx="12" cy="10" rx="8" ry="3" ${S} stroke-width="2"/><path d="M4 10v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7M8 12.7v7M16 12.7v7M6 2.5l4.5 5M18 2.5l-4.5 5" ${S} stroke-width="2"/>`,
  chat: `<path d="M4 6a2.5 2.5 0 012.5-2.5h11A2.5 2.5 0 0120 6v7.5a2.5 2.5 0 01-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 014 13.5z" ${S} stroke-width="2"/><circle cx="8.3" cy="9.8" r="1.25" ${F}/><circle cx="12" cy="9.8" r="1.25" ${F}/><circle cx="15.7" cy="9.8" r="1.25" ${F}/>`,
  image: `<rect x="3" y="4.5" width="18" height="15" rx="2.5" ${S} stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.8" ${F}/><path d="M3.5 17.5l5-4.5 4 3.5 3-2.5 5 4" ${S} stroke-width="2"/>`,
  party: `<path d="M3.5 20.5L8 8.5l7.5 7.5z" ${F}/><path d="M12.5 4.5c1.5 1 1.6 2.6.6 3.6M17 9.5c1.3-1.4 3-1.4 4-.4M16 3v1.6M20.5 13.5H22M19 5.5l1.2-1.2M9.5 3.5l.6 1.4" ${S} stroke-width="1.9"/>`,
  note: `<path d="M9 18V5l11-2v13" ${S} stroke-width="2.2"/><circle cx="6.5" cy="18" r="2.6" ${F}/><circle cx="17.5" cy="16" r="2.6" ${F}/>`,
  fire: `<path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-4.3-3.3-6.6-4.5-10.8-1.6 1.3-2.7 3.4-2.6 5.6C11 8.3 9.7 6.8 9.3 5 6.6 7.6 4.5 11 4.5 14.8 4.5 19 7.6 22 12 22z" ${F}/><path d="M12 21c-1.9 0-3.2-1.3-3.2-3.1 0-1.9 1.5-3 2.3-4.7.9 1.2 1.4 1.6 2.4 1.8.3-.8.4-1.5.4-2.3 1.4 1.2 1.5 3 1.5 5.2 0 1.8-1.4 3.1-3.4 3.1z" fill="#fff" fill-opacity=".5"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="3"/>`,
  ok: `<circle cx="12" cy="12" r="10" ${F}/><path d="M7.2 12.4l3.2 3.2 6.4-6.6" stroke="#fff" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  team: `<circle cx="8.5" cy="8" r="3.3" ${S} stroke-width="2"/><circle cx="16.8" cy="9.2" r="2.7" ${S} stroke-width="2"/><path d="M2.5 20c0-3.4 2.7-6.2 6-6.2s6 2.8 6 6.2M14.6 14.3c.7-.4 1.4-.5 2.2-.5 2.7 0 4.7 2.3 4.7 5.2" ${S} stroke-width="2"/>`,
  clapper: `<rect x="3" y="9" width="18" height="11.5" rx="2" ${S} stroke-width="2"/><path d="M3.2 8.6L4 4.7 20.3 2.6l.8 3.9zM8.6 4.1l2.3 3.8M14.4 3.4l2.3 3.8" ${S} stroke-width="2"/>`,
  megaphone: `<path d="M3.5 10v4A1.5 1.5 0 005 15.5h2l9.5 4.5V4L7 8.5H5A1.5 1.5 0 003.5 10z" ${S} stroke-width="2"/><path d="M7.5 15.5l1.3 4.5M19.5 9.5a3.5 3.5 0 010 5" ${S} stroke-width="2"/>`,
  unlock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" ${F}/><path d="M8 10.5V8a4 4 0 017.7-1.6" ${S} stroke-width="2.4"/>`,
  sprout: `<path d="M12 21.5v-9.5" ${S} stroke-width="2.2"/><path d="M12 12.5C12 8 9 5.5 3.5 5.5c0 4.5 3 7 8.5 7zM12 10.5c0-4 2.8-6.5 8.5-6.5 0 4-2.8 6.5-8.5 6.5z" ${F}/>`,
  warn: `<path d="M12 3.2L2 20.5h20z" ${F} stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v5M12 17.5v.1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  key: `<circle cx="7.5" cy="15.5" r="4.5" ${S} stroke-width="2.2"/><path d="M10.7 12.3L20 3M15.5 7.5l3 3M13.3 9.7l2 2" ${S} stroke-width="2.2"/>`,
  sunset: `<path d="M5.5 17a6.5 6.5 0 0113 0z" ${F}/><path d="M2 17h20M6 20.5h12M12 3.5v3M4.2 8.7l2 2M19.8 8.7l-2 2" ${S} stroke-width="2"/>`,
  city: `<path d="M3 21V10h5v11M8 21V4h8v17M16 21v-8h5v8M2 21h20M11 7.5h2M11 11h2M11 14.5h2" ${S} stroke-width="2"/>`,
  hall: `<path d="M3 9.5L12 4l9 5.5zM5.5 11.5v6.5M9.8 11.5v6.5M14.2 11.5v6.5M18.5 11.5v6.5M3 21h18" ${S} stroke-width="2"/>`,
  spot: `<path d="M8.5 2.5h7L14 7.5h-4z" ${F}/><path d="M10 8.5L5.5 18.5M14 8.5l4.5 10" ${S} stroke-width="2"/><ellipse cx="12" cy="19" rx="7.5" ry="2.3" ${S} stroke-width="2"/>`,
  volcano: `<path d="M2 21.5l6-10h8l6 10z" ${F}/><path d="M9.5 8c.9-1.7 1.6-2.2 2.5-2.2s1.6.5 2.5 2.2M12 2v1.5M7.5 3.5l1 1.2M16.5 3.5l-1 1.2" ${S} stroke-width="2"/>`,
  planet: `<circle cx="12" cy="12" r="5.5" ${F}/><ellipse cx="12" cy="12" rx="10.5" ry="3.6" transform="rotate(-20 12 12)" ${S} stroke-width="1.8"/>`,
  tree: `<path d="M12 2.5l1.1 2.2 2.4.3-1.8 1.6.5 2.4L12 7.8 9.8 9l.5-2.4L8.5 5l2.4-.3z" ${F}/><path d="M12 9l-5 6h3l-4 5h12l-4-5h3z" ${F}/><path d="M11 20h2v2.5h-2z" ${F}/>`,
  moon: `<path d="M14 3a8.5 8.5 0 107 12.5A7 7 0 0114 3z" ${F}/><path d="M19 3.5v3M17.5 5h3" ${S} stroke-width="1.6"/>`,
  mute: `<path d="M3.5 9.5H7L12 5v14l-5-4.5H3.5z" ${F} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" ${S} stroke-width="2.2"/>`,
  camera: `<path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3A1.5 1.5 0 0121.5 9v9.5A1.5 1.5 0 0120 20H4a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 014 7.5z" ${S} stroke-width="2"/><circle cx="12" cy="13.5" r="3.6" ${S} stroke-width="2"/>`,
  piano: `<rect x="3" y="4" width="18" height="16" rx="2" ${S} stroke-width="2"/><path d="M9 20v-6M15 20v-6" ${S} stroke-width="2"/><path d="M7.5 4h3v10h-3zM13.5 4h3v10h-3z" ${F}/>`,
  bulb: `<path d="M9.5 18h5M10.5 21.5h3M8.5 15a6.5 6.5 0 117 0c-.8.6-1 1.5-1 3h-5c0-1.5-.2-2.4-1-3z" ${S} stroke-width="2"/>`,
  bug: `<ellipse cx="12" cy="14" rx="5" ry="6.5" ${S} stroke-width="2"/><path d="M12 8v12.5M9.5 7L8 4.5M14.5 7L16 4.5M7 12H3M17 12h4M7 16.5l-3.5 2M17 16.5l3.5 2" ${S} stroke-width="2"/>`,
  infinity: `<path d="M12 12c-2-2.7-3.7-4-5.5-4a4 4 0 000 8c1.8 0 3.5-1.3 5.5-4zm0 0c2 2.7 3.7 4 5.5 4a4 4 0 000-8c-1.8 0-3.5 1.3-5.5 4z" ${S} stroke-width="2.2"/>`,
  medal: `<path d="M7.5 2.5L10.5 9M16.5 2.5L13.5 9" ${S} stroke-width="2.4"/><circle cx="12" cy="15" r="6.5" ${F}/><circle cx="12" cy="15" r="3.6" fill="#fff" fill-opacity=".35"/>`,
  crown: `<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" ${F} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  mail: `<rect x="3" y="5.5" width="18" height="13" rx="2.5" ${S} stroke-width="2"/><path d="M3.5 7l8.5 6.5L20.5 7" ${S} stroke-width="2"/>`,
  heartbreak: `<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.2a4.4 4.4 0 018 2.7c0 5.7-8 10.6-8 10.6z" ${F}/><path d="M12.3 7.6l-2 4 3 2.2-1.6 4.2" stroke="#fff" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  home: `<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" ${S} stroke-width="2"/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" ${S} stroke-width="2"/><path d="M10.5 18.5h3" ${S} stroke-width="2"/>`,
};

/** 이모지 → 아이콘 이름 (같은 뜻은 같은 아이콘) */
export const EMOJI = {
  '💎': 'gem', '⚔': 'swords', '✨': 'sparkle', '⚡': 'bolt', '💥': 'burst', '🥁': 'drum', '💬': 'chat', '🖼': 'image',
  '🎉': 'party', '🔒': 'lock', '❤': 'heart', '🎵': 'note', '🔥': 'fire', '🏆': 'trophy', '✅': 'ok', '✓': 'check',
  '🤝': 'team', '👫': 'team', '🎬': 'clapper', '📢': 'megaphone', '🔓': 'unlock', '🌱': 'sprout', '⚠': 'warn', '🔑': 'key',
  '🌅': 'sunset', '🌃': 'city', '🎻': 'hall', '🖤': 'spot', '🌋': 'volcano', '🪐': 'planet', '🌌': 'moon', '🎄': 'tree', '🔇': 'mute',
  '📸': 'camera', '🎹': 'piano', '💡': 'bulb', '🐞': 'bug', '⚙': 'gear', '♾': 'infinity', '🥇': 'medal', '🥈': 'medal',
  '🥉': 'medal', '🔄': 'retry', '👑': 'crown', '💌': 'mail', '💔': 'heartbreak', '✕': 'close', '🏠': 'home', '📲': 'phone',
  '⬆': 'share', '▶': 'play',
};

/** svg 문자열. emo=true 면 이모지 자리용 색(하트 분홍·다이아 하늘색 등)을 입힘 */
export const icon = (n, emo = false) => `<svg class="i${emo ? ' e-' + n : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// 표에 있는 이모지 (+ 뒤에 붙는 변형 기호), 그리고 표에 없는 나머지 그림 이모지
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KNOWN = new RegExp(`(${Object.keys(EMOJI).map(esc).join('|')})\\uFE0F?`, 'gu');
const OTHER = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})[️‍\p{Extended_Pictographic}\p{Emoji_Modifier}]*\s?/gu;
const ANY = /[←-⯿\u{1F000}-\u{1FAFF}]/u;
// 글만 들어가는 곳: 이모지만 지움 / 손대지 않는 곳
const NO_SVG = new Set(['OPTION', 'TITLE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

/** 이모지만 지운 글 (svg 를 못 넣는 곳: 선택 목록·공유 글·캔버스) */
export const stripEmoji = (s) => String(s).replace(KNOWN, '').replace(OTHER, '').replace(/\s{2,}/g, ' ').trim();

const cache = new Map();
function svgNode(name) {
  if (!cache.has(name)) {
    const t = document.createElement('template');
    t.innerHTML = icon(name, true);
    cache.set(name, t.content.firstChild);
  }
  return cache.get(name).cloneNode(true);
}

function fixText(node) {
  const s = node.nodeValue;
  if (!s || !ANY.test(s)) return;
  const p = node.parentNode;
  if (!p || SKIP.has(p.nodeName)) return;
  if (NO_SVG.has(p.nodeName)) {
    const t = stripEmoji(s);
    if (t !== s) node.nodeValue = t;
    return;
  }
  const frag = document.createDocumentFragment();
  let last = 0;
  let changed = false;
  for (const m of s.matchAll(KNOWN)) {
    if (m.index > last) frag.append(s.slice(last, m.index).replace(OTHER, ''));
    frag.append(svgNode(EMOJI[m[1]]));
    last = m.index + m[0].length;
    changed = true;
  }
  const tail = s.slice(last);
  const tailClean = tail.replace(OTHER, '');
  if (!changed && tailClean === s) return;
  frag.append(tailClean);
  p.replaceChild(frag, node);
}

function walk(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || root.nodeName === 'svg' || SKIP.has(root.nodeName)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  while (tw.nextNode()) if (ANY.test(tw.currentNode.nodeValue) && !SKIP.has(tw.currentNode.parentNode.nodeName)) list.push(tw.currentNode);
  list.forEach(fixText);
}

/** 지금 화면 + 앞으로 붙는 글의 이모지를 아이콘으로 */
export function watchEmoji(root = document.body) {
  walk(root);
  new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'characterData') fixText(r.target);
      else r.addedNodes.forEach(walk);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
