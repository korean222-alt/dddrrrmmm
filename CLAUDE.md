# 작업 규칙

- 기능을 만들면 **바로 머지 + 배포까지** 한다 (사용자 요청).
  - 작업 브랜치에 커밋·푸시한 뒤, 기본 브랜치 `claude/eloquent-hamilton-5w1xwr` 로 fast-forward 푸시
    (`git push origin HEAD:claude/eloquent-hamilton-5w1xwr`). 푸시하면 GitHub Actions(`.github/workflows/deploy-cloudflare.yml`)가 Cloudflare 에 자동 배포 → **https://play.kongkong-drum.workers.dev**
  - **2026-11-18 Vercel 무료 한도 초과로 사이트가 멈춰서 Cloudflare 로 옮김.** 드럼 전용 Cloudflare 계정(Ekrb2309…, account `9a61013ac8fa9c59d599e97b4b0362ec`)만 쓴다. 다른 프로젝트가 쓰는 Cloudflare 계정·커넥터는 건드리지 않는다.
    - 정적 파일(public/)은 Workers 정적 파일(무료·요청 수 무제한), `/api/*` 만 Worker(`worker/index.js` → `server/handler.js`, 하루 10만 건 무료) + Neon Postgres. 설정 `wrangler.jsonc`, 헤더 `public/_headers`.
    - 서버 비밀값(DATABASE_URL·ADMIN_TOKEN·FOLLOW_PASSWORD·SUGGEST_BOT_TOKEN)은 Cloudflare 대시보드 → Workers → play → 설정 → 변수 및 비밀. 코드에 안 씀.
    - 이 작업 환경에선 프록시가 정적 파일 업로드 키를 덮어써서 `wrangler deploy` 가 안 됨 → 배포는 GitHub Actions 로만.
    - 옛 Vercel(`api/server.js`, `vercel.json`)은 한도가 풀리면 새 주소로 넘기는 용도로만.
  - 머지 전 `npm test` 통과 확인(JSON 저장소 + Postgres 저장소 둘 다 돔), 배포 후 GitHub Actions 성공 + 새 주소에서 새 `app.js?v=` 가 뜨는지 확인.
  - 게임이 바뀌거나 기능이 추가되면 `public/js/news.js` 맨 위에 업데이트 소식도 추가한다 (시작 화면 📢 버튼). 잠금·팔로워 인증·운영 정책 변경은 쓰지 않는다.
  - 🖼 릴스 썸네일 만들기는 운영자 전용: `/?thumb=okay` 로 들어오면 그 기기에서만 영상 찍기 화면에 보임 (`?thumb=off` 로 숨김). 화면 어디에도 링크를 두지 않는다.
  - `public/js/*.js` 나 `public/css/style.css` 를 고치면 `npm run bundle` (JS 를 `app.js` 하나로 묶고 index.html 버전 갱신). 안 하면 `npm test` 가 실패함.
- **서버(API) 요청은 Cloudflare 무료 하루 10만 건** (정적 파일은 무제한). Vercel 은 2026-11-18 월 100만 건을 넘겨 멈췄음. API 요청을 늘리는 건 최대한 피한다: 새 폴링·주기적 API 호출·파일 쪼개기 금지, 꼭 필요하면 간격을 넉넉히. 정적 파일은 버전(?v=) 붙여 오래 캐시.
- 곡은 퍼블릭 도메인만: 작곡가 사후 70년 지난 곡(클래식·옛 민요·캐럴 등) 또는 작곡가 미상 전통 민요. 최신곡·저작권 남은 동요 멜로디는 쓰지 않는다.
- 잠금 (2026-11-17, 11-18 추가): 1~3단계만 누구나. 4단계부터·💎 무제한·랭킹·⚔️ 멀티(빠른 대결·친구 방)·💬 건의하기는 팔로워 암호(키티챗 DM, `FOLLOW_PASSWORD`/admin 에서 교체)로 인증 완료한 사람만. 인증·잠금 작업 전에 `tasks/인스타인증-키티챗.md` 를 먼저 읽는다.
