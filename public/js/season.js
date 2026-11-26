// 🏛 시즌 · 명예의 전당 (브라우저와 서버가 같이 씀)
//   시즌마다 '단계 총합'(1~LAST_LEVEL_ID 단계 최고점 합)과 '무제한 총합'(무제한 판들의 점수 합) 두 랭킹.
//   시즌이 끝나면 두 랭킹의 1·2·3등이 명예의 전당(hall)에 영원히 남고, 그 사람은 프로필 사진을 올릴 수 있음.
//   시즌 1 = 처음 ~ 2026-11-26 23:59:59 (한국 시간, 인스타 DM 금지 마지막 날) / 시즌 2 = 11-27 부터 (끝나는 날은 아직 안 정함)
//   시즌 1 점수 = 지금까지의 최고 기록(scores), 시즌 2 부터는 그 시즌에 친 기록만(season_scores)

export const SEASONS = [
  { n: 1, end: Date.UTC(2026, 10, 26, 14, 59, 59, 999) },
  { n: 2, end: null },
];
export const HALL_BOARDS = ['stage', 'endless', 'tiles'];
export const BOARD_LABEL = { stage: '🎵 단계 총합', endless: '💎 무제한 총합', tiles: '🎹 타일 총합' };
/** 그 시즌의 명예의 전당 판: 시즌 1 = 드럼(단계·무제한), 시즌 2 부터 = 🎹 피아노 타일 총합 (드럼은 랭킹 없음, 2026-11-26 사용자) */
export const hallBoardsOf = (n) => (Number(n) === 1 ? ['stage', 'endless'] : ['tiles']);
/** 프로필 사진 (data URL) 최대 길이 — 160px 정사각 JPEG 면 보통 10~20KB */
export const HALL_IMAGE_MAX = 60000;

/** 그 시각의 시즌 { n, start, end } */
export function seasonAt(t = Date.now()) {
  let start = 0;
  for (const s of SEASONS) {
    if (s.end == null || t <= s.end) return { n: s.n, start, end: s.end };
    start = s.end + 1;
  }
  const last = SEASONS[SEASONS.length - 1];
  return { n: last.n, start, end: last.end };
}
/** 이미 끝난 시즌 번호들 */
export const endedSeasons = (t = Date.now()) => SEASONS.filter((s) => s.end != null && t > s.end).map((s) => s.n);

/** '3일 뒤 시즌 1이 끝나요' 같은 안내 (한국 날짜 기준) */
export function seasonLeftText(t = Date.now()) {
  const s = seasonAt(t);
  if (s.end == null) return `🏆 시즌 ${s.n} 진행 중`;
  const day = (ms) => Math.floor((ms + 9 * 3600e3) / 86400e3); // 한국 날짜 번호
  const d = day(s.end) - day(t);
  if (d <= 0) return `⏰ 오늘 밤 11시 59분에 시즌 ${s.n}이 끝나요!`;
  if (d === 1) return `⏰ 내일 밤 11시 59분에 시즌 ${s.n}이 끝나요!`;
  return `🏆 ${d}일 뒤 시즌 ${s.n}이 종료돼요`;
}

/** 사진 data URL 검사 */
export const cleanHallImage = (v) =>
  typeof v === 'string' && v.length <= HALL_IMAGE_MAX && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
