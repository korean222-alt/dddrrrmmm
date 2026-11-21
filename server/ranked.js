// 🏆 랭킹전 (2026-11-21): 실시간 매칭 먼저, 안 잡히면 고스트
//   - 랭킹전 버튼 → /api/rooms {action:'quick', bracket:'ranked'} 로 실시간 상대를 찾음 (기다리는 사람이 있으면 붙자마자 바로 시작)
//   - 일정 시간 안에 안 잡히면 /api/ranked {action:'ghost'} → 비슷한 점수인 사람이 예전에 친 같은 곡 기록(고스트)과 겨룸
//     고스트가 아직 없으면(처음) 내 점수에 맞춘 연습 상대(봇)
//   - 판이 끝나면 /api/ranked {action:'result'} 한 번 → 엘로 점수 계산·저장, 내 판은 다음 사람의 고스트로 저장
//   - 시즌 = 한국 시간 한 달. 새 시즌 첫 판에 지난 시즌 점수를 1000 쪽으로 반만큼 당겨서 시작, 지난 시즌 티어는 배지로 남김
//   요청: 실시간 = 기다리는 동안 5초마다 + 치는 동안 방 주고받기, 고스트 = 판마다 2번 (상대 받기·결과 보내기)

import { LEVELS, LAST_LEVEL_ID, getLevel, maxScore, CHAR_LANES } from '../public/js/charts.js';

export const RANKED_START = 1000;
export const RANKED_DAILY = 30;
export const PLACEMENT_GAMES = 10;
export const GHOST_TTL_MS = 20 * 60 * 1000;
/** 랭킹전 곡: 본편 1~17단계 (캐롤·장거리 빼고) */
export const RANKED_POOL = LEVELS.filter((l) => typeof l.id === 'number' && l.id >= 1 && l.id <= LAST_LEVEL_ID && !l.xmas && !l.long).map((l) => l.id);

/** 점수에 맞는 곡: 브론즈는 쉬움·보통(난이도 3까지), 실버는 4까지, 골드부터 전부 */
export function rankedPoolFor(rating) {
  const cap = rating < 1100 ? 3 : rating < 1300 ? 4 : 9;
  const pool = RANKED_POOL.filter((id) => getLevel(id).difficulty <= cap);
  return pool.length ? pool : RANKED_POOL;
}

export const TIERS = [
  { key: 'bronze', name: '브론즈', icon: '🥉', min: -Infinity },
  { key: 'silver', name: '실버', icon: '🥈', min: 1100 },
  { key: 'gold', name: '골드', icon: '🥇', min: 1300 },
  { key: 'diamond', name: '다이아', icon: '💎', min: 1500 },
  { key: 'master', name: '마스터', icon: '👑', min: 1700 },
];
export function tierOf(rating) {
  let t = TIERS[0];
  for (const x of TIERS) if (rating >= x.min) t = x;
  return t;
}

/** 시즌 키 'YYYY-MM' (한국 시간) */
export function seasonOf(now = Date.now()) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 7);
}
export function prevSeason(season) {
  let [y, m] = season.split('-').map(Number);
  m -= 1;
  if (!m) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}
const dayOf = (now) => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 엘로: 이번 판으로 바뀌는 점수 (result 1 = 이김, 0.5 = 비김, 0 = 짐). 배치(처음 10판)는 K 두 배 */
export function eloDelta(mine, theirs, result, games = PLACEMENT_GAMES) {
  const k = games < PLACEMENT_GAMES ? 64 : 32;
  const expect = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(k * (result - expect));
}

/** 승패: 목숨을 다 쓴(died) 쪽이 짐, 둘 다 같으면 점수 */
export function rankedOutcome(me, them) {
  if (!!me.died !== !!them.died) return me.died ? 0 : 1;
  return me.score === them.score ? 0.5 : me.score > them.score ? 1 : 0;
}

/** 마디별 누적 점수 기록이 맞는 모양인지 (곡 마디 수와 같고, 줄지 않고, 마지막 = 점수) */
export function cleanTimeline(level, timeline, score) {
  if (!Array.isArray(timeline) || timeline.length !== level.bars.length) return null;
  let prev = 0;
  for (const v of timeline) {
    if (!Number.isInteger(v) || v < prev || v > score) return null;
    prev = v;
  }
  return prev === score ? timeline : null;
}

/** 고스트가 없을 때 연습 상대(봇): 내 점수에 맞춰 만점의 몇 % 를 치는지 정함 (1000점 ≈ 62%, 1700점 ≈ 95%) */
export function botRun(levelId, rating, rand = Math.random) {
  const lv = getLevel(levelId);
  const max = maxScore(lv);
  const frac = Math.max(0.35, Math.min(0.97, 0.62 + (rating - 1000) * 0.00047 + (rand() - 0.5) * 0.08));
  const score = Math.round(max * frac);
  // 마디마다 노트 수만큼 점수가 오르게
  const per = lv.bars.map((b) => Math.max(1, [...String(b)].reduce((n, c) => n + (CHAR_LANES[c] || []).length, 0)));
  const tot = per.reduce((a, b) => a + b, 0);
  let acc = 0;
  const timeline = per.map((n, i) => (i === per.length - 1 ? score : Math.round((score * (acc += n)) / tot)));
  for (let i = 1; i < timeline.length; i++) if (timeline[i] < timeline[i - 1]) timeline[i] = timeline[i - 1];
  return { name: '쿵콩이 🤖', rating, levelId: lv.id, score, timeline, bot: true };
}

/**
 * /api/ranked 처리
 * @param {{ store, getPlayer, isConfirmed(pl) }} deps
 */
export function createRankedHandler({ store, getPlayer, isConfirmed }) {
  /** 이번 시즌 내 줄 (없으면 지난 시즌에서 이어 만듦, 저장은 안 함) */
  async function rowOf(pl, now) {
    const season = seasonOf(now);
    const r = await store.getRanked(pl.igsid, season);
    if (r) return r;
    const prev = await store.getRanked(pl.igsid, prevSeason(season));
    return {
      igsid: pl.igsid,
      season,
      nick: pl.username,
      rating: prev ? Math.round(RANKED_START + (prev.rating - RANKED_START) / 2) : RANKED_START,
      games: 0,
      wins: 0,
      losses: 0,
      day: '',
      dayGames: 0,
      prevTier: prev && prev.games ? tierOf(prev.rating).key : null,
      pending: null,
      at: now,
    };
  }
  const todayLeft = (row, now) => RANKED_DAILY - (row.day === dayOf(now) ? row.dayGames : 0);
  const pub = (row, now) => ({
    season: row.season,
    rating: row.rating,
    tier: tierOf(row.rating).key,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    placement: Math.max(0, PLACEMENT_GAMES - row.games),
    left: Math.max(0, todayLeft(row, now)),
    prevTier: row.prevTier || null,
  });

  /** 시작해도 되는지 (실시간 매칭 전에도 부름). 안 되면 에러 코드 */
  async function canStart(pl, now = Date.now()) {
    if (!pl || !isConfirmed(pl)) return 'confirm_required';
    const row = await rowOf(pl, now);
    return todayLeft(row, now) > 0 ? null : 'daily_limit';
  }

  async function finish(pl, row, { opRating, result, levelId, score, timeline, died }, now) {
    const delta = eloDelta(row.rating, opRating, result, row.games);
    const day = dayOf(now);
    const next = {
      ...row,
      nick: pl.username,
      rating: Math.max(0, row.rating + delta),
      games: row.games + 1,
      wins: row.wins + (result === 1 ? 1 : 0),
      losses: row.losses + (result === 0 ? 1 : 0),
      dayGames: (row.day === day ? row.dayGames : 0) + 1,
      day,
      pending: null,
      at: now,
    };
    await store.putRanked(next);
    // 끝까지 친 판만 다음 사람의 고스트로 (쓰러진 판은 안 씀)
    if (!died) await store.putRankedRun({ igsid: pl.igsid, level: levelId, nick: pl.username, rating: row.rating, score, timeline, at: now });
    return { delta, before: row.rating, ...pub(next, now), tierUp: tierOf(next.rating).key !== tierOf(row.rating).key ? tierOf(next.rating).key : null };
  }

  return {
    canStart,
    /** 랭킹전 치는 중에 방을 나감 → 진 판으로 (나가서 점수 지키기 막기) */
    async forfeit(request, d, slot, now = Date.now()) {
      const pl = await getPlayer(request);
      const me = d.players && d.players[slot];
      if (!pl || !me || me.uid !== pl.igsid || (me.final && me.final.round === d.round)) return;
      if (!(await store.useRun(`rk:${d.code}:${d.round}:${pl.igsid}`, now + 6 * 3600 * 1000))) return;
      const row = await rowOf(pl, now);
      const op = d.players[slot === 'a' ? 'b' : 'a'];
      const opRow = op && op.uid ? await store.getRanked(op.uid, row.season) : null;
      await finish(pl, row, { opRating: opRow ? opRow.rating : RANKED_START, result: 0, levelId: d.level, score: 0, timeline: null, died: true }, now);
    },
    ratingOf: async (pl, now = Date.now()) => (await rowOf(pl, now)).rating,
    async handle(request, body, now = Date.now()) {
      const pl = await getPlayer(request);
      const action = body.action;

      if (action === 'info') {
        const season = seasonOf(now);
        const top = await store.topRanked(season, 20);
        const out = { season, top: top.map((r, i) => ({ rank: i + 1, nick: r.nick, rating: r.rating, tier: tierOf(r.rating).key, games: r.games, me: !!pl && r.igsid === pl.igsid })), tiers: TIERS.map(({ key, name, icon, min }) => ({ key, name, icon, min: Number.isFinite(min) ? min : 0 })), daily: RANKED_DAILY };
        if (pl && isConfirmed(pl)) out.me = pub(await rowOf(pl, now), now);
        return [200, out];
      }

      if (!pl || !isConfirmed(pl)) return [403, { error: 'confirm_required' }];

      // 실시간 상대가 안 잡힘 → 고스트 받기
      if (action === 'ghost') {
        const row = await rowOf(pl, now);
        if (todayLeft(row, now) <= 0) return [429, { error: 'daily_limit' }];
        const pool = rankedPoolFor(row.rating);
        const runs = (await store.pickRankedRuns(pl.igsid, row.rating, pool, now - 45 * 24 * 3600 * 1000, 8)) || [];
        let g;
        if (runs.length) {
          const r = runs[Math.floor(Math.random() * Math.min(runs.length, 4))];
          g = { name: r.nick || '드러머', rating: r.rating, levelId: r.level, score: r.score, timeline: r.timeline, bot: false };
        } else g = botRun(pool[Math.floor(Math.random() * pool.length)], row.rating);
        const gid = Math.random().toString(36).slice(2, 12);
        await store.putRanked({ ...row, pending: { gid, level: g.levelId, rating: g.rating, score: g.score, at: now } });
        return [200, { gid, ghost: g, me: pub(row, now) }];
      }

      if (action === 'result') {
        const level = getLevel(body.levelId);
        if (!level || !RANKED_POOL.includes(level.id)) return [400, { error: 'bad_level' }];
        // 고스트 판을 중간에 그만둠 → 진 판 (그만둬서 점수 지키기 막기)
        if (body.kind === 'ghost' && body.quit) {
          const row = await rowOf(pl, now);
          const p = row.pending;
          if (!p || p.gid !== body.gid) return [409, { error: 'no_ghost' }];
          return [200, { result: 0, ...(await finish(pl, row, { opRating: p.rating, result: 0, levelId: level.id, score: 0, timeline: null, died: true }, now)) }];
        }
        const score = Math.floor(Number(body.score));
        if (!Number.isFinite(score) || score < 0 || score > maxScore(level)) return [400, { error: 'bad_score' }];
        const died = !!body.died;
        const timeline = cleanTimeline(level, body.timeline, score);
        if (!timeline) return [400, { error: 'bad_timeline' }];
        const row = await rowOf(pl, now);

        if (body.kind === 'ghost') {
          const p = row.pending;
          if (!p || p.gid !== body.gid || p.level !== level.id || now - p.at > GHOST_TTL_MS) return [409, { error: 'no_ghost' }];
          const result = rankedOutcome({ died, score }, { died: false, score: p.score });
          return [200, { result, ...(await finish(pl, row, { opRating: p.rating, result, levelId: level.id, score, timeline, died }, now)) }];
        }

        if (body.kind === 'live') {
          const code = String(body.code || '');
          const d = /^\d{4}$/.test(code) ? await store.getRoom(code, now) : null;
          const slot = body.slot;
          const me = d && (slot === 'a' || slot === 'b') && d.players && d.players[slot];
          if (!d || d.pub !== 'ranked' || !me || me.key !== body.key || me.uid !== pl.igsid) return [403, { error: 'not_in_room' }];
          if (d.level !== level.id) return [400, { error: 'bad_level' }];
          if (d.void) return [200, { void: true }];
          const op = d.players[slot === 'a' ? 'b' : 'a'];
          if (!op) return [409, { error: 'no_opponent' }];
          const opFinal = op.final && op.final.round === d.round ? op.final : null;
          // 상대가 아직 치는 중이면 조금 뒤에 다시 (상대가 20초 넘게 소식이 없으면 나간 걸로 → 내가 이김)
          const opGone = !opFinal && now - (op.seenAt || 0) > 20_000;
          if (!opFinal && !opGone) return [202, { wait: true }];
          if (!(await store.useRun(`rk:${code}:${d.round}:${pl.igsid}`, now + 6 * 3600 * 1000))) return [409, { error: 'already' }];
          // 상대 점수는 붙을 때 점수 (먼저 결과를 낸 쪽 점수가 바뀌어도 둘이 같은 기준)
          const opRow = Number.isFinite(op.rt) ? null : op.uid ? await store.getRanked(op.uid, row.season) : null;
          const opRating = Number.isFinite(op.rt) ? op.rt : opRow ? opRow.rating : RANKED_START;
          const result = opGone ? 1 : rankedOutcome({ died, score }, { died: !!opFinal.died, score: opFinal.score });
          return [200, { result, opGone, ...(await finish(pl, row, { opRating, result, levelId: level.id, score, timeline, died }, now)) }];
        }
        return [400, { error: 'bad_kind' }];
      }
      return [400, { error: 'bad_action' }];
    },
  };
}
