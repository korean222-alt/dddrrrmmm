// 사이트 기본 설정. 서버(/api/config)가 있으면 서버 값이 우선합니다.
export const CONFIG = {
  appName: '콩콩 드럼',
  // 인스타 계정 아이디 (@ 빼고). 서버의 INSTAGRAM_HANDLE 이 있으면 그걸 씁니다.
  instagramHandle: '',
  // 'soft'   : Lv.4 이상은 "인스타 팔로우하고 오세요" 안내 → 팔로우 버튼 누르고 오면 열림 (지금 기본값)
  //            (진짜 확인은 아님. 서버·Meta 앱 준비 전까지 쓰는 방식)
  // 'follow' : Lv.4 이상은 DM 코드로 진짜 팔로우 확인 후 열림 (서버 필요)
  // 'open'   : 잠금 없이 전부 열림
  // 주소 뒤에 ?gate=follow / ?gate=open 을 붙이면 테스트로 바꿔볼 수 있어요.
  gateMode: 'soft',
  // 몇 단계부터 팔로우가 필요한지. 1 로 바꾸면 처음부터 팔로우해야 플레이 가능.
  gateFromLevel: 4,
  // 'auto' : 서버(/api)가 있으면 서버, 없으면 브라우저 안 가짜(mock) API
  // 'server' | 'mock' 로 고정 가능
  apiMode: 'auto',
  // 공유 카드에 찍힐 주소. 비우면 현재 주소.
  siteUrl: '',
  codePrefix: '콩콩',
};
