// 사이트 기본 설정. 서버(/api/config)가 있으면 서버 값이 우선합니다.
export const CONFIG = {
  appName: '오케이스트라',
  // 인스타 계정 아이디 (@ 빼고). 서버의 INSTAGRAM_HANDLE 이 있으면 그걸 씁니다.
  instagramHandle: 'ok_aystra',
  // 'soft' : 12단계·무제한 모드는 팔로워 인증(운영자가 인스타 팔로우 확인)을 받은 사람만. 나머지는 누구나 (지금 기본값)
  // 'open' : 잠금 없이 전부 열림
  // (개발할 때만: localhost 에서 주소 뒤에 ?gate=soft / ?gate=open 을 붙이면 바꿔볼 수 있어요)
  gateMode: 'soft',
  // 'auto' : 서버(/api)가 있으면 서버, 없으면 브라우저 안에서만 도는 모드(랭킹은 '곧 오픈')
  // 'server' | 'mock' 로 고정 가능
  apiMode: 'auto',
  // 공유 카드에 찍힐 주소. 비우면 현재 주소.
  siteUrl: '',
  // 목숨 다 떨어졌을 때 '광고 보고 이어하기' (한 판에 한 번)
  ads: {
    // 구글 애드센스 H5 게임 광고(보상형). 승인 받으면 'ca-pub-1234567890123456' 처럼 넣기.
    // 비어 있으면 광고 대신 우리 인스타 홍보 화면(houseSeconds 초)을 보고 이어하기.
    adsenseClient: '',
    // true: 애드센스 테스트 광고 (승인 전 화면 확인용, 수익 없음)
    test: false,
    houseSeconds: 5,
    // 광고 대신 나오는 홍보 화면에서 팔로우하러 보낼 인스타 아이디 (@ 빼고). 비우면 instagramHandle.
    houseHandle: 'ok_aystra',
  },
};
