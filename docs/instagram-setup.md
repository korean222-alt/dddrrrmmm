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
3. 앱 대시보드 → **Instagram → "Instagram 로그인을 통한 API 설정"**
   1. **액세스 토큰 생성**: "계정 추가" → @ok_aystra 로 로그인 → 토큰 복사 (장기 토큰, 60일)
   2. **웹훅 구성**
      - 콜백 URL: `https://kongkong-drum.vercel.app/webhook`
      - 확인 토큰: `okaystra-Apkm9hqeZCdQ` (`api/server.js` 의 `IG_VERIFY_TOKEN`)
      - **확인 및 저장** → 성공하면 필드 목록에서 **messages 구독**
      - (1번 Neon 연결이 먼저 돼 있어야 확인이 통과해요)
   3. 같은 페이지의 **Instagram 앱 시크릿** 복사

## 4. 비밀값 넣기 (Vercel)

kongkong-drum → **Settings → Environment Variables** → 추가 (Production, **Sensitive** 체크):

| 이름 | 값 |
|---|---|
| `IG_ACCESS_TOKEN` | 3-3-1 에서 복사한 토큰 |
| `IG_APP_SECRET` | 3-3-3 의 Instagram 앱 시크릿 |

저장 후 **Redeploy**. (`SESSION_SECRET` 은 안 넣어도 됨 — DB 에 자동 생성)

## 5. 테스트 (개발 모드)

1. Meta 앱 → **앱 역할 → 역할 → Instagram 테스터 추가** → 내 **다른 인스타 계정**(부계정) 추가
2. 부계정 인스타 앱 → 설정 → **앱 및 웹사이트 → 테스터 초대** 수락
3. 부계정으로 @ok_aystra **팔로우** → 폰에서 사이트 열기 → 4단계 누르기 → 코드(OK-XXXX) DM 보내기
4. 몇 초 안에 사이트가 열리고 DM 으로 "팔로우 확인 완료!" 답장이 오면 성공
5. 안 되면 Vercel → kongkong-drum → **Logs** 에서 `[webhook]` 줄 확인

| 로그 | 뜻 / 할 일 |
|---|---|
| 아무것도 안 찍힘 | 웹훅 구독(messages) 확인, 테스터 초대 수락 확인, 인스타 "연결된 도구 허용" 확인 |
| `서명 불일치` (401) | `IG_APP_SECRET` 이 틀림. 앱 설정 → 기본 설정 → 앱 시크릿 값으로도 시도 |
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

- 장기 토큰은 **60일**이면 만료돼요. 만료 전에 3-3-1 에서 다시 생성해서 `IG_ACCESS_TOKEN` 바꾸고 Redeploy.
- 코드가 없는 일반 DM 에는 서버가 답장하지 않아요.
- 랭킹 1위를 릴스에 쓰기 전엔 그 계정에 DM 으로 한 번 확인하세요.
- 로컬 Node 서버(`npm start`)로 테스트할 땐 `.env` 에 같은 이름으로 넣으면 돼요 (`.env.example` 참고).
