// JS 모듈 17개를 파일 하나(public/js/app.js)로 묶고, index.html 에 내용 해시 버전(?v=)을 찍음.
//   왜: Vercel 무료 플랜은 요청 수(CDN Requests)에 한도가 있어서, 접속 한 번에 JS 요청 17개 → 1개.
//       버전이 붙은 파일은 1년 캐시(vercel.json) → 다시 오는 사람은 요청 0개.
//   외부 도구 없이: 모듈마다 함수 안에 넣고(이름 겹침 방지), import 는 앞 모듈 결과에서 꺼내 쓰게 바꿈.
//   (지원하는 문법: import { a, b as c } from './x.js' / export function·class·const·async function)
//
//   쓰는 법: JS 나 CSS 를 고친 뒤 `npm run bundle`. 안 하면 npm test 가 실패해서 알려 줌.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(ROOT, 'public', 'js');
const ENTRY = 'main.js';
const OUT = 'app.js';

const IMPORT_RE = /^import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([\w-]+)\.js';?[ \t]*$/gm;
const EXPORT_RE = /^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm;

const modVar = (name) => `__m_${name.replace(/[^\w]/g, '_')}`;

function load(name) {
  return fs.readFileSync(path.join(JS, name + '.js'), 'utf8');
}

/** 의존 순서대로 모듈 이름 (먼저 필요한 게 앞) */
function order(entry) {
  const out = [];
  const seen = new Set();
  const visiting = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    if (visiting.has(name)) throw new Error(`순환 import: ${name}`);
    visiting.add(name);
    for (const m of load(name).matchAll(IMPORT_RE)) visit(m[2]);
    visiting.delete(name);
    seen.add(name);
    out.push(name);
  };
  visit(entry);
  return out;
}

function transform(name) {
  let src = load(name);
  src = src.replace(IMPORT_RE, (_, names, from) => {
    const parts = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const m = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(s);
        if (!m) throw new Error(`${name}.js: 못 읽는 import "${s}"`);
        return m[2] ? `${m[1]}: ${m[2]}` : m[1];
      });
    return `const { ${parts.join(', ')} } = ${modVar(from)};`;
  });
  const exported = [];
  src = src.replace(EXPORT_RE, (_, kind, id) => {
    exported.push(id);
    return `${kind} ${id}`;
  });
  // 남은 import/export 가 있으면 지원 안 하는 문법
  const left = /^(import|export)\b.*$/m.exec(src);
  if (left) throw new Error(`${name}.js: 지원 안 하는 문법 → ${left[0].slice(0, 80)}`);
  return `// ---- ${name}.js ----\nconst ${modVar(name)} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

/** 묶은 결과 { app, html } (파일은 안 씀) */
export function build() {
  const mods = order(ENTRY.replace(/\.js$/, ''));
  const app = `// 자동 생성 파일 — scripts/bundle.js 가 public/js/*.js 를 묶음. 직접 고치지 마세요 (npm run bundle)\n'use strict';\n${mods.map(transform).join('\n')}`;
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');
  let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  html = html
    .replace(/<script type="module" src="js\/(?:main|app)\.js(?:\?v=\w+)?"><\/script>/, `<script src="js/${OUT}?v=${hash(app)}" defer></script>`)
    .replace(/<script src="js\/app\.js(?:\?v=\w+)?" defer><\/script>/, `<script src="js/${OUT}?v=${hash(app)}" defer></script>`)
    .replace(/href="css\/style\.css(?:\?v=\w+)?"/, `href="css/style.css?v=${hash(css)}"`);
  return { app, html, modules: mods };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app, html, modules } = build();
  fs.writeFileSync(path.join(JS, OUT), app);
  fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), html);
  console.log(`묶음: ${modules.length}개 모듈 → public/js/${OUT} (${(app.length / 1024).toFixed(0)}KB), index.html 버전 갱신`);
}
