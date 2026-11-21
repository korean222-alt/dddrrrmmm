// 사이트에서 랭킹·로그인이 되는지 확인 (D1 옮기기 전·후). GitHub Actions 'D1 옮기기' 가 돌림
//   node scripts/d1-site-check.mjs before <파일>        지금(Neon) 사이트의 단계별·총 랭킹·명예의 전당을 파일에 적음 + 로그인 확인
//   node scripts/d1-site-check.mjs after <파일> <d1|neon>  바꾼 뒤 /api/health 의 db 가 맞는지, 랭킹이 그대로(또는 점수만 오름)인지 + 로그인 확인
//   로그인 확인 = DB 의 secret:session 으로 인증된 참여자 한 명의 쿠키를 만들어 /api/me 가 그 사람으로 알아보는지 (값은 안 찍음)
//   요청 수: 단계 수 + 3 정도 (한 번만)

import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { LAST_LEVEL_ID } from '../public/js/charts.js';
import { d1Rest, neonDb } from './d1-sync.mjs';

const SITE = process.env.SITE || 'https://play.kongkong-drum.workers.dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, cookie) {
  for (let i = 0; ; i++) {
    const res = await fetch(SITE + path, { headers: { 'Cache-Control': 'no-cache', ...(cookie ? { Cookie: cookie } : {}) } });
    const body = await res.json().catch(() => null);
    if (res.ok && body) return body;
    if (i >= 3) throw new Error(`${path} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    await sleep(3000);
  }
}

async function boards() {
  const out = {};
  for (let lv = 1; lv <= LAST_LEVEL_ID; lv++) out[lv] = (await get(`/api/leaderboard?level=${lv}`)).entries.map((e) => [e.username, e.score]);
  out.total = (await get('/api/leaderboard?level=total')).entries.map((e) => [e.username, e.score]);
  const hall = await get('/api/hall');
  out.hall = hall.entries.map((e) => [e.username, e.score]);
  out.hallPast = hall.hall.map((h) => [h.season, h.board, h.rank, h.username, !!h.image]);
  return out;
}

/** DB 에서 인증된 참여자 한 명 + 쿠키 키 → 쿠키 만들어 /api/me */
async function loginCheck(db) {
  const secret = ((await db.q(`SELECT value FROM settings WHERE key = 'secret:session'`))[0] || {}).value;
  if (!secret) throw new Error('secret:session 없음');
  const p = (await db.q(
    `SELECT p.igsid, p.username FROM players p JOIN scores s ON s.igsid = p.igsid
     WHERE p.username IS NOT NULL AND p.checked_at IS NOT NULL AND p.hidden_at IS NULL ORDER BY s.score DESC LIMIT 1`
  ))[0];
  if (!p) return console.log('로그인 확인: 인증된 참여자가 없어 건너뜀');
  const body = Buffer.from(JSON.stringify({ igsid: p.igsid, v: Date.now() })).toString('base64url');
  const token = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  const me = await get('/api/me', `kk_player=${encodeURIComponent(token)}`);
  if (!me.player || me.player.username !== p.username) throw new Error(`로그인 확인 실패: /api/me 가 그 참여자를 못 알아봄 (${JSON.stringify(me).slice(0, 120)})`);
  console.log(`로그인 확인 ✅ (예전 쿠키 키로 만든 쿠키를 사이트가 '${p.username}' 로 알아봄, 인증 ${me.confirmed || me.checked ? '됨' : '안 됨'})`);
}

async function main() {
  const [cmd, file, want] = process.argv.slice(2);
  const env = process.env;
  const d1 = d1Rest({ token: env.CLOUDFLARE_API_TOKEN, account: env.CLOUDFLARE_ACCOUNT_ID, name: env.D1_NAME || 'okaystra' });
  const neon = env.NEON_DATABASE_URL ? await neonDb(env.NEON_DATABASE_URL) : null;
  if (cmd === 'before') {
    const h = await get('/api/health');
    console.log(`지금 사이트 DB: ${h.db || 'neon'}`);
    const b = await boards();
    fs.writeFileSync(file, JSON.stringify(b));
    console.log(`랭킹 적어 둠: ${Object.keys(b).length}개 판, 총 랭킹 ${b.total.length}명, 명예의 전당 ${b.hall.length}명`);
    await loginCheck(h.db === 'd1' ? d1 : neon);
    return;
  }
  if (cmd === 'after') {
    // 비밀값을 바꾼 뒤 새 설정이 퍼질 때까지 기다림
    let h;
    for (let i = 0; i < 30; i++) {
      h = await fetch(SITE + '/api/health', { headers: { 'Cache-Control': 'no-cache' } }).then((r) => r.json()).catch(() => ({}));
      if (h.ok && (h.db || 'neon') === want) break;
      await sleep(4000);
    }
    if (!h.ok || (h.db || 'neon') !== want) throw new Error(`사이트 DB 가 ${want} 로 안 바뀜: ${JSON.stringify(h)}`);
    console.log(`사이트 DB: ${h.db} ✅`);
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    const after = await boards();
    let bad = 0;
    for (const k of Object.keys(before)) {
      if (k === 'hallPast') {
        if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) (bad++, console.log(`❌ 지난 시즌 명예의 전당이 다름`));
        continue;
      }
      const a = new Map(after[k].map(([u, s]) => [u, s]));
      const min = after[k].length >= 50 ? Math.min(...after[k].map(([, s]) => s)) : -Infinity;
      for (const [u, s] of before[k]) {
        if (a.has(u) ? a.get(u) >= s : s <= min) continue;
        bad++;
        console.log(`❌ ${k} 랭킹: '${u}' ${s}점이 ${a.has(u) ? a.get(u) + '점으로' : '없어짐'}`);
      }
    }
    console.log(`랭킹 비교: ${Object.keys(before).length}개 판 ${bad ? `❌ ${bad}곳 다름` : '전부 그대로 ✅'} (총 랭킹 ${after.total.length}명, 명예의 전당 ${after.hall.length}명)`);
    await loginCheck(want === 'd1' ? d1 : neon);
    if (bad) process.exit(1);
    return;
  }
  console.error('명령: before <파일> | after <파일> <d1|neon>');
  process.exit(2);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
