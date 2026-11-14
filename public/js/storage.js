// localStorage 래퍼 (인앱 브라우저/사생활 모드에서 막혀도 게임은 돌아가게)

const PREFIX = 'kongkong:';

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
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load('settings', {}) };
}
export function saveSettings(s) {
  save('settings', s);
}

/** 레벨별 내 최고 기록 { [levelId]: {score, grade, stars, accuracy, maxCombo, fullCombo, at} }
 *  별은 점수와 따로, 지금까지 받은 최고 개수를 기억합니다. */
export function loadBests() {
  return load('bests', {});
}
export function saveBest(result) {
  const bests = loadBests();
  const prev = bests[result.levelId];
  const stars = Math.max(result.stars || 0, (prev && prev.stars) || 0);
  if (!prev || result.score > prev.score) {
    bests[result.levelId] = {
      score: result.score,
      grade: result.grade,
      stars,
      accuracy: result.accuracy,
      maxCombo: result.maxCombo,
      fullCombo: result.fullCombo,
      at: Date.now(),
    };
    save('bests', bests);
    return { isNew: true, prev };
  }
  if (stars !== (prev.stars || 0)) {
    prev.stars = stars;
    save('bests', bests);
  }
  return { isNew: false, prev };
}
