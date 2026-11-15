# 인스타 팔로우 확인 연결하기 (Vercel + Neon)

서버 코드는 이미 준비돼 있어요 (`api/server.js`): 4단계부터 잠금(`GATE_MODE=follow`), 인스타 API 로 진짜 확인(`FOLLOW_CHECK_MODE=real`).
남은 건 **① DB(Neon) 연결 ② Meta 앱으로 DM 이 서버에 들어오게 ③ 비밀값 2개 넣기**.

> ⚠️ 꼭 알아둘 제약
> - 댓글만으로는 팔로우 여부를 못 봐요. **DM 이 필수** (DM 을 보낸 사람만 프로필 조회 가능).
> - Meta 앱이 **개발 모드**일 땐 앱에 등록한 **테스터 계정의 DM 만** 들어와요. 모든 사람에게 열려면 **앱 심사 + 라이브 모드** 필요.
> - 그 전까지 일반 사용자는 4단계부터 못 열어요(지금 원하는 상태). 영상 찍기는 잠금 없이 됨.

내 주소 = `https://kongkong-drum.vercel.app`

## 1. Neon DB 연결 (5분)

1. Vercel 대시보드 → **kongkong-drum** 프로젝트 → **Storage** 탭 → **Create Database** → **Neon** (Serverless Postgres)
2. 지역(Region): **Singapore (AWS ap-southeast-1)** — 서버 함수가 싱가포르(`sin1`)라 같은 곳이어야 빨라요
3. 플랜 **Free** → 만들기 → **Connect Project**: kongkong-drum, 환경 전부(Production·Preview·Development) 체크
4. 그러면 `DATABASE_URL` 환경변수가 자동으로 생겨요
5. **Deployments → 맨 위 배포 → ⋯ → Redeploy** (환경변수는 다시 배포해야 적용)
6. `https://kongkong-drum.vercel.app/api/health` 가 `{"ok":true,"app":"okaystra"}` 면 성공 (아니면 `db_not_connected`)

테이블은 처음 요청 때 자동으로 만들어져요. 이미 Neon 계정이 있으면 Neon 에서 새 **프로젝트**(싱가포르)를 만들고 연결 문자열을 Vercel 환경변수 `DATABASE_URL` 로 넣어도 똑같아요.

## 2. 인스타 계정

- @ok_aystra 를 **프로페셔널 계정**(크리에이터/비즈니스)으로 전환
- 인스타 앱 → 설정 → **메시지 및 스토리 답장 → 메시지 컨트롤 → 연결된 도구 → "메시지 접근 허용"** 켜기

## 3. Meta 앱 만들기

1. https://developers.facebook.com → 내 앱 → **앱 만들기**
2. 사용 사례: **"Instagram에서 메시지 및 콘텐츠 관리"** → 앱 이름 아무거나(예: okaystra)
3. 앱 대시보드 → **Use cases → Customize → API setup with Unified login** (새 앱은 "Instagram 로그인" 방식이 아니라 이 메뉴만 나와요)
   - 위쪽 **Redirect URL** 칸은 쓰지 않으니 비워 둬도 돼요 (OAuth 로그인을 안 씀).
   1. **테스터 등록** (개발 모드 필수): **Add account** 를 누르면 "Add people to your app" 창이 떠요 → **Instagram Tester** 선택 → 인스타 아이디(`@` 빼고) 입력 → 목록에서 계정 클릭 → Add.
      - **@ok_aystra** 와 **테스트로 DM 보낼 다른 계정** 둘 다 추가해야 해요.
      - 각 계정으로 로그인해서 초대 **수락**: https://www.instagram.com/accounts/manage_access/ → **테스터 초대** 탭 (웹에만 있고 모바일 앱엔 안 보일 수 있어요. 다른 계정이 로그인돼 있으면 시크릿 창에서).
   2. **액세스 토큰 생성**: 수락 후 새로고침 → 목록의 **ok_aystra** 줄에서 **Generate token** → "I understand" 체크 → **Copy** (한 번만 보여줘요, Done 누르기 전에 Vercel 에 붙여넣기). 장기 토큰, 60일. 토큰은 `EAAS…` 로 시작해요.
   3. **웹훅 구성**
      - 콜백 URL: `https://kongkong-drum.vercel.app/webhook`
      - 확인 토큰: `okaystra-Apkm9hqeZCdQ` (`api/server.js` 의 `IG_VERIFY_TOKEN`)
      - **Verify and save** → 성공하면 필드 목록에서 **messages 구독** 토글 On
      - (1번 Neon 연결이 먼저 돼 있어야 확인이 통과해요)
      - 필드 목록의 **messages → Test → Send to server** 로 서버까지 오는지 먼저 확인할 수 있어요 (Vercel Logs 에 `POST /webhook`).
   4. ★ **계정별 웹훅 구독**: 2번 토큰 목록의 **ok_aystra 줄 "Webhook Subscription" 토글을 On**. 이게 꺼져 있으면 진짜 DM 이 서버로 아예 안 와요 (Test 는 와도).
   5. **앱 시크릿**: 앱 설정 → 기본 설정(**App settings → Basic**)의 **App secret → Show** 복사. (Instagram 설정 화면에 "Instagram app secret" 이 따로 보이면 그 값)

## 4. 비밀값 넣기 (Vercel)

kongkong-drum → **Settings → Environment Variables** → 추가 (Production, **Sensitive** 체크):

| 이름 | 값 |
|---|---|
| `IG_ACCESS_TOKEN` | 3-2 에서 복사한 토큰 |
| `IG_APP_SECRET` | 3-5 의 앱 시크릿 |

그리고 일반(Config) 변수 하나 더 — 토큰이 `EAAS…` 형식이라 Facebook 쪽 주소로 불러야 해요:

| 이름 | 값 |
|---|---|
| `IG_GRAPH_HOST` | `graph.facebook.com` |

(토큰이 `IGAA…` 로 시작하는 Instagram 로그인 방식 토큰이면 기본값 `graph.instagram.com` 그대로 두면 돼요.)

저장 후 **Redeploy** — 환경변수는 새 배포부터 적용돼요. 로그의 배포 ID(`dpl_…`)가 바뀌었는지 보면 확인할 수 있어요. (`SESSION_SECRET` 은 안 넣어도 됨 — DB 에 자동 생성)

## 5. 테스트 (개발 모드)

1. Meta 앱 → **앱 역할 → 역할 → Instagram 테스터 추가** → 내 **다른 인스타 계정**(부계정) 추가
2. 부계정 인스타 앱 → 설정 → **앱 및 웹사이트 → 테스터 초대** 수락
3. 부계정으로 @ok_aystra **팔로우** → 폰에서 사이트 열기 → 4단계 누르기 → 코드(OK-XXXX) DM 보내기
4. 몇 초 안에 사이트가 열리고 DM 으로 "팔로우 확인 완료!" 답장이 오면 성공
5. 안 되면 Vercel → kongkong-drum → **Logs** 에서 `[webhook]` 줄 확인

| 로그 | 뜻 / 할 일 |
|---|---|
| 아무것도 안 찍힘 | 웹훅 구독(messages) 확인, 테스터 초대 수락 확인, 인스타 "연결된 도구 허용" 확인 |
| `/webhook` 요청이 아예 없음 (Meta 의 Test 는 옴) | 3-4 계정별 Webhook Subscription 이 Off, 또는 보낸 계정이 테스터가 아님/초대 미수락 |
| `서명 불일치` (401) | `IG_APP_SECRET` 이 틀림. 앱 설정 → 기본 설정 → 앱 시크릿 값으로도 시도 |
| `Invalid OAuth access token - Cannot parse access token` (190) | 토큰 값이 틀리게 들어갔거나(공백·잘림·시크릿을 넣음), `EAAS…` 토큰인데 `IG_GRAPH_HOST=graph.facebook.com` 이 없음. 수정 후 Redeploy |
| `is_user_follow_business 값이 오지 않았습니다` | 권한 부족 → 6번(앱 심사)에서 Advanced Access 필요 |
| `IG_ACCESS_TOKEN 이 설정되지 않았습니다` | 4번 비밀값 + Redeploy 확인 |
| `DM verified` | 성공 🎉 |

언팔로우한 상태로도 한 번 보내서 "아직 팔로우가 안 되어 있어요" 답장이 오는지 확인하세요.

## 6. 모든 사람에게 열기 (앱 심사)

1. 앱 설정 → 기본 설정: **개인정보처리방침 URL** `https://kongkong-drum.vercel.app/privacy.html`, **데이터 삭제 안내 URL** `https://kongkong-drum.vercel.app/privacy.html#delete`, 앱 아이콘, 카테고리
2. **앱 검수 → 권한 및 기능**: `instagram_business_basic`, `instagram_business_manage_messages` **Advanced Access** 요청
   - 화면 녹화 제출: 사이트에서 코드 받기 → DM 보내기 → 확인 답장 → 4단계 열림
   - 설명 예: "사용자가 직접 보낸 인증 코드 DM 에만 자동 답장하고, 보낸 사람이 우리 계정을 팔로우했는지 확인해 게임 단계를 열어줍니다."
3. 승인되면 앱을 **라이브 모드**로 전환 → 이제 누구나 DM 인증 가능
4. 다 되면 `IG_DEBUG` 를 꺼요 (Claude 에게 말하면 바꿔줌, 또는 Vercel 환경변수 `IG_DEBUG=false`)

## 운영 팁

- 인증(`verified`)은 사이트가 **쿠키로 기억**해요. 이미 열린 기기에서는 나중에 언팔로우해도 계속 열려 있어요(인증 순간에만 확인). 언팔로우 상태를 테스트하려면 시크릿 창 등 새 세션으로.
- DM 은 보낸 사람이 DM 을 보내는 동안 사이트 탭을 닫아도 돼요. 코드는 10분 유효, 같은 브라우저 세션에서 열어야 인증이 이어져요(인스타 인앱 브라우저는 닫으면 세션이 바뀔 수 있으니 사파리/크롬 권장).
- 장기 토큰은 **60일**이면 만료돼요. 만료 전에 3-3-1 에서 다시 생성해서 `IG_ACCESS_TOKEN` 바꾸고 Redeploy.
- 코드가 없는 일반 DM 에는 서버가 답장하지 않아요.
- 랭킹 1위를 릴스에 쓰기 전엔 그 계정에 DM 으로 한 번 확인하세요.
- 로컬 Node 서버(`npm start`)로 테스트할 땐 `.env` 에 같은 이름으로 넣으면 돼요 (`.env.example` 참고).
