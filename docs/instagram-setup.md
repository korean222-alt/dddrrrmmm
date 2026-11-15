# 인스타 팔로우 확인 연결하기 (4단계)

지금 서버는 `FOLLOW_CHECK_MODE=fake` 라서 `checkFollow()`가 항상 "팔로우 중"을 돌려줍니다.
아래 순서로 **진짜 값이 오는지 먼저 확인**한 다음 `real`로 바꾸세요.

> ⚠️ 앞서 정리한 제약은 그대로입니다.
> - 댓글만으로는 팔로우 여부 조회가 안 됩니다. **DM이 필수**예요(DM을 보낸 사람만 프로필 조회 가능).
> - 앱 역할이 없는 일반 유저에게 쓰려면 **Advanced Access(앱 심사)** 가 필요할 수 있습니다.
> - 그래서 **테스터가 아닌 계정으로 DM을 보내서 값이 오는지** 꼭 먼저 확인하세요.

## 1. 준비물

- 인스타 **프로페셔널 계정**(비즈니스/크리에이터)
- [Meta for Developers](https://developers.facebook.com/) 앱 (유형: 비즈니스)
- 제품 추가: **Instagram** → "Instagram 로그인을 통한 API 설정"
- 권한: `instagram_business_basic`, `instagram_business_manage_messages`
- 인스타 앱 설정 → 메시지 → **"연결된 도구 허용"** 켜기

## 2. 서버를 인터넷에 열기

웹훅은 `https://` 주소가 필요합니다. 배포한 서버를 쓰거나, 로컬이면 터널(ngrok, cloudflared 등)을 씁니다.

```
https://<내-도메인>/webhook
```

## 3. 웹훅 등록

`.env`:
```
IG_APP_SECRET=<앱 설정 > 기본 설정 > 앱 시크릿>
IG_VERIFY_TOKEN=<아무 문자열, 예: okaystra-verify-2026>
IG_ACCESS_TOKEN=<Instagram 로그인으로 발급한 장기 토큰>
IG_DEBUG=true
```

Meta 앱 대시보드 → Instagram → 웹훅 구성:
- 콜백 URL: `https://<내-도메인>/webhook`
- 확인 토큰: `IG_VERIFY_TOKEN`과 같은 값
- 구독 필드: **messages**

"확인 및 저장"이 성공하면 서버가 `hub.challenge`에 정상 응답한 것입니다.

## 4. 값이 오는지 확인 (가장 중요)

1. `IG_DEBUG=true`, `FOLLOW_CHECK_MODE=fake` 상태로 서버 실행
2. **앱 역할이 없는 다른 인스타 계정**으로 사이트에서 코드를 받아 DM 전송
3. 서버 로그에서 `[webhook]` 원문과 보낸 사람 ID(IGSID) 확인
4. 점검 스크립트 실행:
   ```bash
   npm run ig:profile -- <IGSID>
   ```
   - `✅ is_user_follow_business = true/false` → 5단계로
   - `❌ ... 없습니다` → 권한/앱 심사 문제. Advanced Access 신청 필요
   - 웹훅 자체가 안 옴 → 앱이 개발 모드라 테스터 DM만 들어오는 상태일 가능성. 앱 심사 필요

팔로우한 상태 / 언팔로우한 상태 둘 다 해보고 값이 바뀌는지 보세요.

## 5. 진짜로 교체

```
GATE_MODE=follow          # Lv.4+ 잠금 켜기
FOLLOW_CHECK_MODE=real    # 진짜 팔로우 확인
ALLOW_DEV_SIMULATE=false  # 테스트 버튼 끄기
IG_DEBUG=false
```

게임·사이트 코드는 수정할 필요 없습니다. `server/instagram.js`의 `checkFollow()` 하나만 동작이 바뀝니다.

## 자주 막히는 곳

| 증상 | 확인할 것 |
|---|---|
| 웹훅 등록 실패 | 주소가 https인지, `IG_VERIFY_TOKEN` 일치하는지 |
| 웹훅 401 | `IG_APP_SECRET`이 맞는지 (서명 검증 실패) |
| DM은 오는데 사이트가 안 열림 | 코드가 10분 지나 만료됐는지, 같은 폰·같은 브라우저인지 |
| 인스타 앱 브라우저 ↔ DM 이동 후 상태 사라짐 | 쿠키/저장소가 막힌 경우. 외부 브라우저로 열기 안내 |
| 토큰 만료 | 장기 토큰은 60일. 만료 전에 갱신 |

## 운영 팁

- 인증된 DM 보낸 사람에게는 서버가 "확인 완료!" 답장을 자동으로 보냅니다(`IG_SEND_REPLIES=true`). 코드가 없는 일반 DM에는 답하지 않아요.
- 랭킹 1위를 릴스에 쓰기 전에 그 계정에 DM으로 한 번 확인하면 위조 기록도 거를 수 있고 소통도 됩니다.
