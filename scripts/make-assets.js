// 아이콘/OG 이미지 생성 (마스코트 SVG → PNG). 필요할 때만 실행: npm run assets
// Playwright 가 설치되어 있어야 합니다 (npx playwright install chromium).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from '../server/config.js';
import { mascotSVG, bassDrumSVG, snareSVG } from '../public/js/mascot.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(out, { recursive: true });

// 파비콘(SVG)
fs.writeFileSync(path.join(out, 'favicon.svg'), mascotSVG('kong', 'idle', 64));

const font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">';
const base = `*{margin:0;box-sizing:border-box}body{font-family:Jua,sans-serif;background:linear-gradient(200deg,rgba(255,95,162,.25),transparent 40%),linear-gradient(160deg,rgba(95,211,255,.22),transparent 40%),linear-gradient(180deg,#160f38,#33186a 60%,#5b2167);overflow:hidden;color:#3b2a4a}`;

function iconHtml(size) {
  return `${font}<style>${base}body{width:${size}px;height:${size}px;display:grid;place-items:center;background:linear-gradient(180deg,#33186a,#5b2167)}</style>
  <div style="width:${size * 0.86}px">${mascotSVG('kong', 'hit', size * 0.86)}</div>`;
}

const ogHtml = `${font}<style>${base}
body{width:1200px;height:630px;position:relative}
.floor{position:absolute;left:0;right:0;bottom:0;height:70px;background:linear-gradient(#8a5236,#3e2218)}
.cloud{position:absolute;background:#fff;border-radius:99px}
h1{position:absolute;left:70px;top:110px;font-size:118px;font-weight:400;color:#fff;-webkit-text-stroke:6px #3b2a4a;paint-order:stroke fill;text-shadow:0 8px 0 #3b2a4a}
h1 span{color:#f4c84a}
p{position:absolute;left:76px;top:300px;font-size:42px;background:#fff;border:4px solid #3b2a4a;border-radius:99px;padding:8px 26px}
.pill{position:absolute;left:76px;top:400px;background:#ff8a4c;color:#fff;font-size:36px;padding:10px 28px;border-radius:99px;border:4px solid #3b2a4a}
.a{position:absolute}
</style>
<div class="floor"></div>
<h1><span>OK</span>AYSTRA</h1>
<p>엄지 두 개로 치는 명곡 드럼 게임</p>
<div class="pill">설치·가입 없이 바로 플레이</div>
<div class="a" style="left:770px;top:190px;width:230px">${mascotSVG('kong', 'hit', 230)}</div>
<div class="a" style="left:640px;top:300px;width:270px">${bassDrumSVG(270)}</div>
<div class="a" style="left:900px;top:350px;width:270px">${snareSVG(270)}</div>`;

function beanSVG(c, l) {
  return `<svg viewBox="0 0 100 70" width="100%"><defs><linearGradient id="g${c.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
  <path d="M5 35 C5 0 95 0 95 35 C95 62 68 62 50 52 C32 62 5 62 5 35Z" fill="url(#g${c.slice(1)})" stroke="#3b2a4a" stroke-width="5"/>
  <ellipse cx="30" cy="22" rx="11" ry="6" fill="#fff" opacity=".85"/></svg>`;
}

const browser = await chromium.launch();
async function shot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.screenshot({ path: path.join(out, file) });
  await page.close();
  console.log('✓', file);
}
await shot(ogHtml, 1200, 630, 'og.png');
await shot(iconHtml(512), 512, 512, 'icon-512.png');
await shot(iconHtml(192), 192, 192, 'icon-192.png');
await shot(iconHtml(180), 180, 180, 'apple-touch-icon.png');
await browser.close();
