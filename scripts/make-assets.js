// 아이콘/OG 이미지 생성 (마스코트 SVG → PNG). 필요할 때만 실행: npm run assets
// Playwright 가 설치되어 있어야 합니다 (npx playwright install chromium).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from '../server/config.js';
import { mascotSVG, drumSVG } from '../public/js/mascot.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(out, { recursive: true });

// 파비콘(SVG)
fs.writeFileSync(path.join(out, 'favicon.svg'), mascotSVG('kong', 'idle', 64));

const font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap">';
const base = `*{margin:0;box-sizing:border-box}body{font-family:Jua,sans-serif;background:radial-gradient(120% 90% at 50% 0%,#2a2160,#15122a 60%,#0c0a19);overflow:hidden}`;

function iconHtml(size) {
  return `${font}<style>${base}body{width:${size}px;height:${size}px;display:grid;place-items:center;background:#FFD84D}</style>
  <div style="width:${size * 0.86}px">${mascotSVG('kong', 'hit', size * 0.86)}</div>`;
}

const ogHtml = `${font}<style>${base}
body{width:1200px;height:630px;color:#fff8ec}
h1{position:absolute;left:70px;top:120px;font-size:150px;font-weight:400;-webkit-text-stroke:5px #2b1d3a;text-shadow:0 8px 0 #2b1d3a}
h1 span{color:#ffd84d}
p{position:absolute;left:76px;top:330px;font-size:44px;color:#d9d3f5}
.pill{position:absolute;left:76px;top:420px;background:#ffd84d;color:#2b1d3a;font-size:36px;padding:12px 28px;border-radius:99px}
.d{position:absolute;width:260px}
.m{position:absolute;width:170px}
</style>
<h1>콩콩 <span>드럼</span></h1>
<p>엄지 두 개로 쿵! 짝!</p>
<div class="pill">설치·가입 없이 바로 플레이</div>
<div class="d" style="left:640px;top:330px">${drumSVG('kong', 260)}</div>
<div class="m" style="left:685px;top:178px">${mascotSVG('kong', 'hit', 170)}</div>
<div class="d" style="left:910px;top:350px">${drumSVG('jjak', 260)}</div>
<div class="m" style="left:955px;top:205px">${mascotSVG('jjak', 'cheer', 170)}</div>`;

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
