// JS 묶음(public/js/app.js)과 index.html 버전이 지금 소스와 같은지 (고치고 npm run bundle 을 안 하면 실패)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from '../scripts/bundle.js';

test('묶음 파일이 최신 (안 맞으면 npm run bundle)', () => {
  const { app, html, modules } = build();
  assert.ok(modules.includes('main') && modules.includes('charts') && modules.length >= 15);
  assert.equal(modules[modules.length - 1], 'main', 'main 이 맨 끝 (나머지가 먼저 준비됨)');
  assert.equal(fs.readFileSync('public/js/app.js', 'utf8'), app, 'public/js/app.js 가 소스와 다름 → npm run bundle');
  assert.equal(fs.readFileSync('public/index.html', 'utf8'), html, 'index.html 버전이 다름 → npm run bundle');
  assert.match(html, /<script src="js\/app\.js\?v=\w{10}" defer><\/script>/);
  assert.match(html, /href="css\/style\.css\?v=\w{10}"/);
  // 문법 오류 없이 읽히는지 (실행은 브라우저에서만)
  assert.doesNotThrow(() => new vm.Script(app));
});
