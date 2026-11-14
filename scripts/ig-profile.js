// 4단계 사전 점검: IGSID 로 프로필을 조회해서 is_user_follow_business 가 실제로 오는지 확인
//   npm run ig:profile -- <IGSID>
// IGSID 는 IG_DEBUG=true 로 서버를 켜고 DM 을 보내면 로그에 찍힙니다.
// ★ 테스터(앱 역할 있는 계정)가 아닌 일반 계정으로 DM 을 보내서 꼭 확인하세요.
import { loadConfig } from '../server/config.js';
import { createInstagram } from '../server/instagram.js';

const igsid = process.argv[2];
if (!igsid) {
  console.error('사용법: npm run ig:profile -- <IGSID>');
  process.exit(1);
}
const cfg = loadConfig();
const ig = createInstagram({ ...cfg, ig: { ...cfg.ig, debug: true } });
try {
  const p = await ig.fetchProfile(igsid);
  console.log('\n프로필 응답:', p);
  if (typeof p.is_user_follow_business === 'boolean') {
    console.log(`\n✅ is_user_follow_business = ${p.is_user_follow_business} → FOLLOW_CHECK_MODE=real 로 바꿔도 됩니다.`);
  } else {
    console.log('\n❌ is_user_follow_business 가 없습니다. 권한(Advanced Access/앱 심사) 상태를 확인하세요.');
  }
} catch (e) {
  console.error('\n❌ 조회 실패:', e.message, e.graph || '');
  process.exit(1);
}
