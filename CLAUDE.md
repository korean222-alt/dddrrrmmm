# 작업 규칙

- 기능을 만들면 **바로 머지 + 배포까지** 한다 (사용자 요청).
  - 작업 브랜치에 커밋·푸시한 뒤, 기본 브랜치 `claude/eloquent-hamilton-5w1xwr` 로 fast-forward 푸시
    (`git push origin HEAD:claude/eloquent-hamilton-5w1xwr`). 푸시하면 GitHub Actions(`.github/workflows/deploy-cloudflare.yml`)가 Cloudflare 에 자동 배포 → **https://play.kongkong-drum.workers.dev**
  - **2026-11-18 Vercel 무료 한도 초과로 사이트가 멈춰서 Cloudflare 로 옮김.** 드럼 전용 Cloudflare 계정(Ekrb2309…, account `9a61013ac8fa9c59d599e97b4b0362ec`)만 쓴다. 다른 프로젝트가 쓰는 Cloudflare 계정·커넥터는 건드리지 않는다.
    - 정적 파일(public/)은 Workers 정적 파일(무료·요청 수 무제한), `/api/*` 만 Worker(`worker/index.js` → `server/handler.js`, 하루 10만 건 무료) + Neon Postgres. 설정 `wrangler.jsonc`, 헤더 `public/_headers`.
    - 서버 비밀값(DATABASE_URL·ADMIN_TOKEN·FOLLOW_PASSWORD·SUGGEST_BOT_TOKEN)은 Cloudflare 대시보드 → Workers → play → 설정 → 변수 및 비밀. 코드에 안 씀.
    - 이 작업 환경에선 프록시가 정적 파일 업로드 키를 덮어써서 `wrangler deploy` 가 안 됨 → 배포는 GitHub Actions 로만.
    - 옛 Vercel(`api/server.js`, `vercel.json`)은 **다리** 용도로만: Vercel 빌드에서 `public/bridge.html` 이 index.html 을 대신함 → 옛 주소로 온 폰의 기록·로그인을 '기록 옮기기'로 올리고 새 주소 `/?t=코드` 로 보냄(같은 Neon DB). Vercel 한도가 풀리면 기본 브랜치에 한 번 푸시해서 다리가 든 배포가 production 이 되게 할 것.
    - 예전 주소에서 인증했던 사람: 새 주소에서 같은 인스타 아이디 + 팔로워 암호로 인증하면 원래 계정으로 다시 붙음(중복 계정은 합침) + 랭킹 점수로 깬 단계 복원 (`bestsFromScores`). 설정 → '예전 기록 되찾기'. 아이디를 대충 적었던 사람은 닉네임 + 비슷한 아이디(`igSimilar`)로, 그래도 안 되면 첫 화면 긴급 공지 → '되찾기 요청'(닉네임·예전 아이디·지금 아이디·팔로워 암호) → admin '되찾기 요청' 탭에 후보 계정과 함께 뜸 → 운영자가 '이 계정으로 승인' → 그 폰이 다음에 들어올 때(`/api/recover-request/status`, 시작·앱 복귀 때만) 자동으로 그 계정. (DM 봇은 DM 을 못 읽어서 안 씀. admin '되찾기 코드'(24시간)도 남아 있음)
  - 머지 전 `npm test` 통과 확인(JSON 저장소 + Postgres 저장소 둘 다 돔), 배포 후 GitHub Actions 성공 + 새 주소에서 새 `app.js?v=` 가 뜨는지 확인.
  - 게임이 바뀌거나 기능이 추가되면 `public/js/news.js` 맨 위에 업데이트 소식도 추가한다 (시작 화면 📢 버튼). 잠금·팔로워 인증·운영 정책 변경은 쓰지 않는다.
  - 🖼 릴스 썸네일 만들기는 운영자 전용: `/?thumb=okay` 로 들어오면 그 기기에서만 영상 찍기 화면에 보임 (`?thumb=off` 로 숨김). 화면 어디에도 링크를 두지 않는다.
  - `public/js/*.js` 나 `public/css/style.css` 를 고치면 `npm run bundle` (JS 를 `app.js` 하나로 묶고 index.html 버전 갱신). 안 하면 `npm test` 가 실패함.
- **서버(API) 요청은 Cloudflare 무료 하루 10만 건** (정적 파일은 무제한). Vercel 은 2026-11-18 월 100만 건을 넘겨 멈췄음. API 요청을 늘리는 건 최대한 피한다: 새 폴링·주기적 API 호출·파일 쪼개기 금지, 꼭 필요하면 간격을 넉넉히. 정적 파일은 버전(?v=) 붙여 오래 캐시.
- 곡은 퍼블릭 도메인만: 작곡가 사후 70년 지난 곡(클래식·옛 민요·캐럴 등) 또는 작곡가 미상 전통 민요. 최신곡·저작권 남은 동요 멜로디는 쓰지 않는다.
- 잠금 (2026-11-17, 11-18 추가): 1~3단계만 누구나. 4단계부터·💎 무제한·랭킹·⚔️ 멀티(빠른 대결·친구 방)·💬 건의하기는 팔로워 암호(키티챗 DM, `FOLLOW_PASSWORD`/admin 에서 교체)로 인증 완료한 사람만. 인증·잠금 작업 전에 `tasks/인스타인증-키티챗.md` 를 먼저 읽는다.
