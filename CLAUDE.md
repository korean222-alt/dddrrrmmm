# 작업 규칙

- 기능을 만들면 **바로 머지 + 배포까지** 한다 (사용자 요청).
  - 작업 브랜치에 커밋·푸시한 뒤, 기본 브랜치 `claude/eloquent-hamilton-5w1xwr` 로 fast-forward 푸시
    (`git push origin HEAD:claude/eloquent-hamilton-5w1xwr`). 이 브랜치가 Vercel production(kongkong-drum.vercel.app)이라 푸시하면 자동 배포됨.
  - 서버는 같은 Vercel 프로젝트의 함수(`api/server.js`) + Neon Postgres. **Cloudflare 는 쓰지 않는다** (다른 프로젝트가 계정 한도를 같이 씀).
  - 머지 전 `npm test` 통과 확인(JSON 저장소 + Postgres 저장소 둘 다 돔), 배포 후 Vercel 배포 상태(READY) 확인.
- 곡은 퍼블릭 도메인만: 작곡가 사후 70년 지난 곡(클래식·옛 민요·캐럴 등) 또는 작곡가 미상 전통 민요. 최신곡·저작권 남은 동요 멜로디는 쓰지 않는다.
