// 사이트 기본 설정. 서버(/api/config)가 있으면 서버 값이 우선합니다.
export const CONFIG = {
  appName: '콩콩 드럼',
  // 인스타 계정 아이디 (@ 빼고). 서버의 INSTAGRAM_HANDLE 이 있으면 그걸 씁니다.
  instagramHandle: '',
  // 'open'   : Lv.4 이상도 그냥 열림 (1단계: 게임 반응 먼저 보기)
  // 'follow' : Lv.4 이상은 DM 팔로우 인증 후 열림
  // 주소 뒤에 ?gate=follow 를 붙이면 테스트로 잠금 흐름을 볼 수 있어요.
  gateMode: 'open',
  // 'auto' : 서버(/api)가 있으면 서버, 없으면 브라우저 안 가짜(mock) API
  // 'server' | 'mock' 로 고정 가능
  apiMode: 'auto',
  // 공유 카드에 찍힐 주소. 비우면 현재 주소.
  siteUrl: '',
  codePrefix: '콩콩',
};
