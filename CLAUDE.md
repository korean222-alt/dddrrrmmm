# 작업 규칙

- 기능을 만들면 **바로 머지 + 배포까지** 한다 (사용자 요청).
  - 작업 브랜치에 커밋·푸시한 뒤, 기본 브랜치 `claude/eloquent-hamilton-5w1xwr` 로 fast-forward 푸시
    (`git push origin HEAD:claude/eloquent-hamilton-5w1xwr`). 이 브랜치가 Vercel production(kongkong-drum.vercel.app)이라 푸시하면 자동 배포됨.
  - 머지 전 `npm test` 통과 확인, 배포 후 Vercel 배포 상태(READY) 확인.
- 곡은 퍼블릭 도메인(작곡가 사후 70년) 클래식만. 최신곡 멜로디는 쓰지 않는다.
