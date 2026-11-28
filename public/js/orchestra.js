// 🎻 진짜 오케스트라처럼 (2026-11-28 사용자 '노래들을 더 웅장하게 · 산왕의 궁전은 마지막에 완전 웅장하고 빠른데 표현이 안 돼')
//   예전 반주 = 곡 처음부터 끝까지 거의 같은 크기(악기 수가 2~3번만 바뀜) → 원곡의 '여리게 시작 → 몰아쳐서 끝' 이 없었음.
//   이제 곡마다 셈여림 흐름(arc)이 있고, 마디마다 0~4 단계로 편성이 바뀜:
//     0 여리게(pp)  : 낮은 현 피치카토(짧게 튕김)만 · 산왕은 첼로가 멜로디를 한 옥타브 아래서 몰래 따라감
//     1 조금 여리게 : 현악 패드 · 긴 음은 바이올린이 같이
//     2 보통        : 바이올린이 멜로디 전부 · 호른 · 팀파니 첫 박
//     3 세게(f)     : 금관 화음 · 호른이 멜로디 · 튜바 · 팀파니 1·3박 · 첼로 8분 몰아치기
//     4 아주 세게(ff, 투티): 바이올린 옥타브 위 · 금관이 멜로디 · 팀파니 매 박 · 현 8분 질주 · 심벌 2마디마다
//        + 마지막 마디들은 팀파니 8분 연타·박마다 심벌 · 프레이즈 끝 팀파니 롤 「두르르르 → 쾅」
//   ⚠ 소리만 바뀜: 박자·타일·채보·점수·서버 검사는 그대로 (진짜로 빨라지게 하면 타일 시각이 바뀌어 랭킹에 영향 → 안 함)
//   드럼 게임(audio.js SongPlayer)과 피아노 타일(tilegame.js)이 같이 씀. 쿵·짝·하이햇은 각자 (드럼 게임은 내가 침)

/** 곡마다 셈여림 흐름. 없으면 classic (드럼 곡 epic 은 epic) */
export const SONG_ARC = {
  1: 'gentle', // 작은 별
  2: 'build', // 환희의 송가 — 점점 합창처럼
  3: 'lively', // 징글벨
  4: 'build', // 캐논 — 한 줄씩 쌓여 감
  5: 'lively', // 성자들의 행진
  6: 'classic', // 아이네 클라이네
  7: 'lively', // 오 수재너
  8: 'epic', // 운명 — 처음부터 쾅
  9: 'mountain', // 산왕의 궁전 — 여린 피치카토 → 몰아치는 투티
  10: 'hot', // 캉캉
  11: 'gentle', // 엔터테이너
  12: 'build', // 코로부시카
  13: 'classic', // 터키 행진곡
  14: 'hot', // 왕벌의 비행
  15: 'hot', // 윌리엄 텔
  16: 'classic', // 교향곡 40번
  17: 'lively', // 라 쿠카라차
  18: 'gentle', // 엘리제를 위하여
  19: 'lively', // 데크 더 홀즈
  21: 'lively',
  22: 'lively',
  23: 'build', // 네순 도르마 — 빈체로!
  101: 'classic', // 사계 – 봄
};

export function arcOf(level) {
  if (!level) return 'classic';
  const song = level.song || {};
  return song.arc || SONG_ARC[level.id] || (song.epic ? 'epic' : 'classic');
}

/**
 * 마디 b (0 ~ n-1) 의 셈여림 0 ~ 4 (소수). lap = 몇 번째 바퀴(타일 다이아 바퀴는 한 단계씩 높게 시작)
 */
export function arcLevel(shape, b, n, lap = 0) {
  n = Math.max(1, n);
  const tailLen = Math.max(2, Math.round(n / 4));
  const tail = b >= n - tailLen;
  let v;
  switch (shape) {
    case 'mountain':
    case 'build':
      // 처음부터 끝까지 한 줄로 점점 세게: 16마디면 0·0·0·0 / 1·1·1 / 2·2·2 / 3·3·3 / 4·4·4
      v = (5 * b) / n;
      v += lap * 1.4;
      break;
    case 'epic':
      v = b < 2 && lap === 0 ? 3 : 4;
      break;
    case 'hot':
      v = b < 1 && lap === 0 ? 2 : tail ? 4 : 3;
      v += lap;
      break;
    default: {
      const half = n / 2;
      if (b < 2 && lap === 0) v = shape === 'lively' ? 1 : 0.6;
      else if (b < half) v = 1.4 + (1.2 * b) / half;
      else v = tail ? 4 : 3;
      v += lap;
      if (shape === 'gentle') v = Math.min(v, 3);
    }
  }
  return Math.max(0, Math.min(4, v));
}

const timpOf = (root) => {
  let m = root;
  while (m > 44) m -= 12;
  while (m < 33) m += 12;
  return m;
};
const vlnRange = (m) => {
  while (m > 91) m -= 12;
  while (m < 55) m += 12;
  return m;
};

/**
 * 한 마디 오케스트라 소리 목록
 *   ctx = { v: 셈여림(0~4 소수), shape, b, n(곡 마디 수), chordAt(s)→{root,notes}, parts(코드 바뀌는 수),
 *           mel: [{ s, len, midi }] (멜로디를 같이 칠 음, 내가 멜로디를 치는 곡이면 빈 배열),
 *           end: 곡이 이 마디로 끝남(타일 바퀴 끝·드럼 채보 끝) }
 *   돌려줌 = [{ s(칸 0~15), o: 'vln'|'vc'|'br'|'tuba'|'timp', m, len(칸), sec(초로 고정, 피치카토), v, at, rel } | { s, crash, v }]
 */
export function orchestraBar(ctx) {
  const { v, shape, b, n, chordAt, mel = [] } = ctx;
  const L = Math.floor(v + 1e-6);
  const dyn = 0.55 + 0.45 * (v / 4); // 전체 크기: 여리게 0.55 → 아주 세게 1
  const parts = Math.max(1, ctx.parts || 1);
  const partLen = 16 / parts;
  const last = ctx.end ?? b === n - 1;
  const lastTwo = b >= n - 2;
  const phraseEnd = (b + 1) % 4 === 0;
  const drive = (shape === 'mountain' || shape === 'hot' || shape === 'epic') && L >= 4 && b >= n - 3;
  const ev = [];
  const add = (e) => ev.push(e);

  // ---------- 현악 ----------
  if (L === 0) {
    // 피치카토: 낮은 현이 박마다 톡톡 (근음·5음)
    for (const s of [0, 4, 8, 12]) {
      const ch = chordAt(s);
      const m = (s === 4 || s === 12 ? ch.notes[2] : ch.root) - 12;
      add({ s, o: 'vc', m, sec: 0.11, v: (s === 0 ? 0.5 : 0.38) * dyn, at: 0.002, rel: 0.05 });
    }
    // 산왕: 첼로·바순처럼 멜로디를 한 옥타브 아래서 살금살금
    if (shape === 'mountain') for (const nt of mel) add({ s: nt.s, o: 'vc', m: nt.midi - 12, sec: 0.12, v: 0.42 * dyn, at: 0.002, rel: 0.05 });
  } else {
    // 현악 패드: 코드 바뀌는 자리마다
    for (let s = 0; s < 16; s += partLen) {
      const ch = chordAt(s);
      const pv = (0.14 + 0.05 * L) * dyn;
      for (const m of ch.notes.slice(0, 3)) add({ s, o: 'vln', m, len: partLen, v: pv, at: Math.min(0.12, 0.04 * partLen), rel: 0.25 });
      add({ s, o: 'vc', m: ch.root - 12, len: partLen, v: pv + 0.1, at: 0.05, rel: 0.25 });
    }
  }
  // 바이올린이 멜로디를 같이: 1 = 긴 음만 · 2↑ = 전부 · 4 = 옥타브 위도
  if (L >= 1) {
    for (const nt of mel) {
      const long = nt.len >= 4;
      if (L === 1 && !long) continue;
      if (long) add({ s: nt.s, o: 'vln', m: vlnRange(nt.midi), len: nt.len, v: (0.3 + 0.06 * L) * dyn, at: 0.03, rel: 0.15 });
      else add({ s: nt.s, o: 'vln', m: vlnRange(nt.midi), len: Math.max(1.4, nt.len), v: (0.2 + 0.05 * L) * dyn, at: 0.004, rel: 0.06 });
      if (L >= 4 && nt.midi + 12 <= 93) add({ s: nt.s, o: 'vln', m: nt.midi + 12, len: Math.max(1.4, nt.len), v: (long ? 0.3 : 0.2) * dyn, at: long ? 0.03 : 0.004, rel: long ? 0.15 : 0.06 });
    }
  }
  // 몰아치기: 세게(3) = 첼로 8분 근음 · 투티(4) = 바이올린도 8분으로 화음 음을 번갈아
  if (L >= 3) {
    for (let s = 0; s < 16; s += 2) {
      const ch = chordAt(s);
      add({ s, o: 'vc', m: ch.root - 12 + (s % 4 === 2 && L >= 4 ? 7 : 0), sec: 0.14, v: (s % 4 === 0 ? 0.34 : 0.24) * dyn, at: 0.003, rel: 0.05 });
      if (L >= 4) add({ s, o: 'vln', m: vlnRange(ch.notes[(s >> 1) % 3] + 12), sec: 0.12, v: (s % 4 === 0 ? 0.2 : 0.14) * dyn, at: 0.003, rel: 0.05 });
    }
  }

  // ---------- 금관 ----------
  if (L >= 2) {
    for (let s = 0; s < 16; s += partLen) {
      if (L === 2 && s !== 0) continue; // 보통: 마디 첫 자리만 호른 화음
      const ch = chordAt(s);
      const bv = (L === 2 ? 0.2 : L === 3 ? 0.3 : 0.38) * dyn;
      for (const m of [ch.root - 12, ch.notes[1] - 12, ch.notes[2] - 12]) add({ s, o: 'br', m, len: partLen * 0.95, v: bv, at: 0.04, rel: 0.2 });
    }
  }
  // 호른·트롬본이 멜로디를 한 옥타브 아래서: 3 = 긴 음 · 4 = 8분음표까지
  if (L >= 3) {
    for (const nt of mel) {
      if (nt.len < (L >= 4 ? 2 : 4) || nt.midi - 12 < 43) continue;
      add({ s: nt.s, o: 'br', m: nt.midi - 12, len: Math.max(1.5, nt.len), v: (L >= 4 ? 0.48 : 0.38) * dyn, at: 0.03, rel: 0.15 });
    }
  }
  // 튜바: 3 = 마디 첫 박 · 4 = 반 마디마다
  if (L >= 3) {
    for (const s of L >= 4 ? [0, 8] : [0]) add({ s, o: 'tuba', m: chordAt(s).root - 24, len: (L >= 4 ? 8 : 16) * 0.85, v: 0.55 * dyn, at: 0.02, rel: 0.2 });
  }

  // ---------- 팀파니 · 심벌 ----------
  const tp = (s) => timpOf(chordAt(s).root);
  if (drive) {
    // 🔥 마지막 몰아치기: 팀파니 8분 연타 (두두두두)
    for (let s = 0; s < 16; s += 2) add({ s, o: 'timp', m: tp(s), sec: 0.5, v: (s % 4 === 0 ? 0.8 : 0.5) * dyn, at: 0, rel: 0.25 });
  } else if (L >= 4) for (const s of [0, 4, 8, 12]) add({ s, o: 'timp', m: tp(s), sec: 1, v: (s === 0 ? 0.8 : 0.5) * dyn, at: 0, rel: 0.4 });
  else if (L === 3) for (const s of [0, 8]) add({ s, o: 'timp', m: tp(s), sec: 1.2, v: (s === 0 ? 0.7 : 0.45) * dyn, at: 0, rel: 0.45 });
  else if (L === 2) add({ s: 0, o: 'timp', m: tp(0), sec: 1.4, v: 0.45 * dyn, at: 0, rel: 0.5 });
  // epic(운명): 짧은 음마다 팀파니가 말발굽처럼
  if (shape === 'epic' && L >= 3 && !drive) for (const nt of mel) if (nt.len <= 2 && nt.s % 4 !== 0) add({ s: nt.s, o: 'timp', m: tp(nt.s), sec: 0.6, v: 0.34 * dyn, at: 0, rel: 0.3 });
  // 프레이즈 끝·곡 끝: 팀파니 롤 「두르르르 → (다음 마디) 쾅」
  if ((L >= 3 && phraseEnd) || (L >= 2 && last)) {
    const from = last ? 8 : 12;
    for (let s = from; s < 16; s++) if (!drive || s % 2) add({ s, o: 'timp', m: tp(s), sec: 0.4, v: (0.22 + ((s - from) / (16 - from)) * 0.5) * dyn, at: 0, rel: 0.12 });
  }
  // 심벌: 2 = 프레이즈 첫 마디 · 3 = 4마디마다 · 4 = 2마디마다 · 마지막 투티는 박마다
  if (drive && lastTwo) for (const s of last ? [0, 4, 8, 12] : [0, 8]) add({ s, crash: true, v: s === 0 ? 0.5 : 0.36 });
  else if ((L >= 4 && b % 2 === 0) || (L >= 2 && b % 4 === 0 && b > 0)) add({ s: 0, crash: true, v: L >= 4 ? 0.48 : 0.36 });
  // 투티는 금관·현이 피아노보다 앞으로 나오게
  const boost = L >= 4 ? 1.3 : L >= 3 ? 1.12 : 1;
  if (boost > 1) for (const e of ev) if (!e.crash) e.v *= boost;
  return ev;
}

/** 세게 칠수록 쿵·짝도 크게 (타일 드럼·멜로디 피아노에 곱함) */
export const dynOf = (v) => 0.55 + 0.45 * (v / 4);
