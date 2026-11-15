// localStorage 래퍼 (인앱 브라우저/사생활 모드에서 막혀도 게임은 돌아가게)

// 이름을 바꾸면서 접두사도 바꿈 → 출시 전 테스트하며 쌓인 기록·설정은 전부 초기화
const PREFIX = 'okaystra:';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

export const DEFAULT_SETTINGS = {
  music: 0.8,
  sfx: 1,
  noteSpeed: 1,
  offsetMs: 0,
  vibrate: true,
  // 반주: 'orch' = 오케스트라(현악·금관·팀파니 + 피아노) / 'piano' = 피아노만
  band: 'orch',
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}
export function saveSettings(s) {
  save('settings', s);
}

/** 레벨별 내 최고 기록 { [levelId]: {score, grade, stars, accuracy, maxCombo, fullCombo, at} }
 *  별은 점수와 따로, 지금까지 받은 최고 개수를 기억합니다.
 *  무제한 모드('endless')는 별 대신 diamonds(다이아)와 roundsCleared(깬 단계 수)도 최고값으로 기억. */
export function loadBests() {
  return load('bests', {});
}
export function saveBest(result) {
  const bests = loadBests();
  const prev = bests[result.levelId];
  const stars = Math.max(result.stars || 0, (prev && prev.stars) || 0);
  const diamonds = Math.max(result.diamonds || 0, (prev && prev.diamonds) || 0);
  const roundsCleared = Math.max(result.roundsCleared || 0, (prev && prev.roundsCleared) || 0);
  const extra = result.challenge ? { diamonds, roundsCleared } : {};
  if (!prev || result.score > prev.score) {
    bests[result.levelId] = {
      score: result.score,
      grade: result.grade,
      stars,
      accuracy: result.accuracy,
      maxCombo: result.maxCombo,
      fullCombo: result.fullCombo,
      ...extra,
      at: Date.now(),
    };
    save('bests', bests);
    return { isNew: true, prev };
  }
  if (stars !== (prev.stars || 0) || (result.challenge && (diamonds !== (prev.diamonds || 0) || roundsCleared !== (prev.roundsCleared || 0)))) {
    Object.assign(prev, { stars }, extra);
    save('bests', bests);
  }
  return { isNew: false, prev };
}
