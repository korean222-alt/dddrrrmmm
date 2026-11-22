// 친구 대결 방 (1:1 개인전 · 팀전)
//   실시간 연결(웹소켓) 없이: 두 사람이 2초마다 /api/rooms 에 내 점수를 보내고 상대 점수를 받음 (폴링).
//   방 하나 = DB 행 하나. 두 사람 다 '준비'를 누르면 서버가 몇 초 뒤 시작 시각(startAt)을 정해 같이 시작 (빠른 대결도 같음).
//   개인전은 점수 승부 (누가 목숨을 다 쓰면 그 판은 바로 끝, 쓰러진 쪽이 짐).
//   방장이 '무제한'(endless)을 켜면 서바이벌: 둘 다 살아 있으면 곡이 끝없이 빨라지고 먼저 쓰러지는 쪽이 짐 (판 끝은 폰끼리 판단).
//   방 판은 랭킹에 안 들어감 (랭킹은 혼자 친 판만).
//
// 방 data: { code, mode: 'versus'|'team', level, status: 'lobby'|'playing', round, cfgVer, startAt, host: 'a'|'b', createdAt,
//            players: { a: { name, part, key(비밀), ready('cfgVer.round' 문자열 | null), seenAt, live:{round,score,combo,progress,lives}, final:{round,...} }, b: … } }

import { newId } from './session.js';
import { LEVELS, getLevel, levelDuration, FREE_UPTO, LAST_LEVEL_ID } from '../public/js/charts.js';
import { RANKED_POOL, rankedPoolFor } from './ranked.js';

export const ROOM_TTL_MS = 2 * 3600 * 1000;
export const ROOM_START_DELAY_MS = 4500;
export const ROOM_PARTS = ['drum', 'piano'];
// 아직 없는 파트 (피아노는 곧 추가) → 고를 수 없음
export const ROOM_PARTS_READY = ['drum'];
const SLOTS = ['a', 'b'];

// ⚡ 빠른 대결 (모르는 사람과): 사람이 적을 수 있어서 난이도를 두 묶음으로만
//   easy = 쉬움·보통 (난이도 1~3 = 1~8단계) / hard = 어려움·극악 (난이도 4~5 = 9~18단계)
export const BRACKETS = {
  // 🎄 캐롤(18~20단계)은 빠른 대결엔 안 넣음 (친구 방에선 고를 수 있음)
  easy: LEVELS.filter((l) => !l.xmas && !l.long && l.difficulty <= 3).map((l) => l.id),
  hard: LEVELS.filter((l) => !l.xmas && !l.long && l.difficulty >= 4).map((l) => l.id),
  // 🏆 랭킹전 (server/ranked.js): 상대가 붙으면 준비 없이 바로 시작
  ranked: RANKED_POOL,
  // 🎲 랜덤 대결 (2026-11-21): 4~18단계 하나로 묶음 (초보·고수 나누니 안 잡혀서). 붙으면 바로 시작,
  //   둘 다 깨면 다른 곡이 바로 이어지고 누가 먼저 쓰러질 때까지
  rush: LEVELS.filter((l) => !l.xmas && !l.long && l.id > FREE_UPTO && l.id <= LAST_LEVEL_ID).map((l) => l.id),
};
/** 🎲 랜덤 대결: 붙고 나서 첫 곡 시작까지 (기다리던 쪽이 5초마다 물어봐서 알아채도록) */
export const RUSH_START_DELAY_MS = 10000;
/** 🎲 둘 다 깼을 때 다음 곡까지 (결과 화면에서 3초마다 물어봄) */
export const RUSH_NEXT_DELAY_MS = 8000;
/** 🎲 다음 곡: 방금 친 곡(들)은 빼고 무작위 */
export function pickRushLevel(recent = [], rand = Math.random) {
  const all = BRACKETS.rush;
  const pool = all.filter((id) => !recent.includes(id));
  const from = pool.length ? pool : all;
  return from[Math.floor(rand() * from.length)];
}
/** 랭킹전: 상대가 붙고 나서 시작까지 (기다리던 쪽이 5초마다 물어봐서 알아채도록 넉넉히) */
export const RANKED_START_DELAY_MS = 15000;
/** 기다리는 방은 이 시간 안에 주고받은 적이 있어야 '살아 있음' (창을 닫고 나간 방은 안 잡힘) */
export const QUICK_FRESH_MS = 15_000;
const SEEN_WRITE_MS = 8_000;
const pidOf = () => newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 10);

/** 빠른 대결 곡: 두 사람 다 칠 수 있는 곡 중에서 무작위 (인증 안 한 사람이 있으면 1~3단계만) */
export function pickQuickLevel(bracket, bothConfirmed, rand = Math.random) {
  let pool = BRACKETS[bracket] || BRACKETS.easy;
  if (!bothConfirmed) pool = pool.filter((id) => id <= FREE_UPTO);
  if (!pool.length) pool = [1];
  return pool[Math.floor(rand() * pool.length)];
}

const clean = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const int = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null);

export function cleanRoomName(v) {
  const s = clean(v, 12);
  return s && /^[\p{L}\p{N}_. ]+$/u.test(s) ? s : null;
}

/** 다른 사람에게 보여줄 방 (비밀 키 빼고, 준비는 지금 설정·판 기준으로) */
export function publicRoom(d, now) {
  const players = {};
  for (const s of SLOTS) {
    const p = d.players && d.players[s];
    if (!p) continue;
    players[s] = {
      pid: p.pid || null,
      sig: p.sig || null,
      name: p.name,
      rt: Number.isFinite(p.rt) ? p.rt : null,
      left: !!p.left,
      part: p.part || 'drum',
      ready: p.ready === readyTag(d),
      ago: Math.max(0, now - (p.seenAt || 0)),
      live: p.live && p.live.round === d.round ? p.live : null,
      final: p.final && p.final.round === d.round ? p.final : null,
    };
  }
  return { code: d.code, mode: d.mode, void: !!d.void, endless: !!d.endless, level: d.level, status: d.status, round: d.round || 0, startAt: d.startAt || null, host: d.host, pub: d.pub || null, players };
}

/** 🎲 랜덤 대결: 이번 곡을 둘 다 살아서 끝냈나 (그럼 다음 곡) */
export function rushBothCleared(d) {
  if (!d || d.pub !== 'rush' || d.status !== 'playing') return false;
  const ps = SLOTS.map((s) => d.players && d.players[s]);
  return ps.every((p) => p && !p.left && p.final && p.final.round === d.round && !p.final.died && !p.final.failed);
}

const readyTag = (d) => `${d.cfgVer || 0}.${d.round || 0}`;

/**
 * @param {{ store, getPlayer, canPlay(level, player) → string|null(에러 코드) }} deps
 */
export function createRoomHandler({ store, getPlayer, canPlay, isConfirmed = () => false, ranked = null }) {
  const exp = (now) => now + ROOM_TTL_MS;

  async function newCode(data, now) {
    for (let i = 0; i < 12; i++) {
      const code = String(Math.floor(Math.random() * 9000) + 1000);
      if (await store.createRoom(code, { ...data, code }, now, exp(now))) return code;
    }
    return null;
  }

  async function auth(body, now) {
    const code = String(body.code || '');
    if (!/^\d{4}$/.test(code)) throw Object.assign(new Error('bad_code'), { status: 400 });
    const d = await store.getRoom(code, now);
    if (!d) throw Object.assign(new Error('room_gone'), { status: 404 });
    const slot = body.slot;
    const p = SLOTS.includes(slot) && d.players && d.players[slot];
    if (!p || typeof body.key !== 'string' || p.key !== body.key) throw Object.assign(new Error('not_in_room'), { status: 403 });
    return { code, d, slot };
  }

  return async function handleRoom(request, body, now = Date.now()) {
    const action = body.action;

    if (action === 'create') {
      const name = cleanRoomName(body.name);
      if (!name) return [400, { error: 'bad_name' }];
      const mode = body.mode === 'team' ? 'team' : 'versus';
      const level = getLevel(body.level) ? getLevel(body.level).id : 1;
      const key = newId();
      const data = {
        mode, level, status: 'lobby', round: 0, cfgVer: 1, host: 'a', createdAt: now,
        players: { a: { name, pid: pidOf(), part: 'drum', key, ready: null, seenAt: now } },
      };
      const code = await newCode(data, now);
      if (!code) return [503, { error: 'busy' }];
      return [200, { code, slot: 'a', key, room: publicRoom({ ...data, code }, now), now }];
    }

    if (action === 'join') {
      const name = cleanRoomName(body.name);
      if (!name) return [400, { error: 'bad_name' }];
      const code = String(body.code || '');
      if (!/^\d{4}$/.test(code)) return [400, { error: 'bad_code' }];
      const d = await store.getRoom(code, now);
      if (!d) return [404, { error: 'room_gone' }];
      // 빈 자리 (또는 1분 넘게 연결이 끊긴 자리)
      let slot = SLOTS.find((s) => !d.players || !d.players[s]);
      let cond = { slotFree: slot };
      if (!slot) {
        slot = SLOTS.find((s) => s !== d.host && now - (d.players[s].seenAt || 0) > 60_000);
        cond = { round: d.round || 0 };
      }
      if (!slot) return [409, { error: 'room_full' }];
      if (d.status === 'playing') return [409, { error: 'room_busy' }];
      const key = newId();
      const out = await store.patchRoom(code, { slot, player: { name, pid: pidOf(), part: 'drum', key, ready: null, seenAt: now, live: null, final: null, sig: null }, cond }, now, exp(now));
      if (!out) return [409, { error: 'room_full' }];
      return [200, { code, slot, key, room: publicRoom(out, now), now }];
    }

    // 🎲 랜덤 대결 기다리는 사람 수 (멀티 창 열 때 한 번만 물어봄. 5명 넘으면 5)
    if (action === 'count') {
      const rush = await store.findOpenRooms('rush', now - QUICK_FRESH_MS, now);
      return [200, { waiting: { rush: rush.length } }];
    }

    // ⚡ 빠른 대결: 같은 묶음에서 기다리는 사람이 있으면 그 방(대기실)에 붙음, 없으면 내가 방을 열고 기다림
    if (action === 'quick') {
      const name = cleanRoomName(body.name);
      if (!name) return [400, { error: 'bad_name' }];
      const bracket = ['hard', 'ranked', 'rush'].includes(body.bracket) ? body.bracket : 'easy';
      const pl = await getPlayer(request);
      const ok = !!isConfirmed(pl);
      // 어려움·극악 묶음은 전부 4단계 이상 → 팔로워 인증한 사람만
      if ((bracket === 'hard' || bracket === 'rush') && canPlay) {
        const err = await canPlay(BRACKETS[bracket][0], pl);
        if (err) return [403, { error: err }];
      }
      let rt = null;
      if (bracket === 'ranked') {
        if (!ranked) return [404, { error: 'not_found' }];
        const err = await ranked.canStart(pl, now);
        if (err) return [err === 'daily_limit' ? 429 : 403, { error: err }];
        rt = await ranked.ratingOf(pl, now);
      }
      const key = newId();
      const me = { name, pid: pidOf(), part: 'drum', key, ready: null, seenAt: now, live: null, final: null, sig: null, ok };
      if (bracket === 'ranked') Object.assign(me, { uid: pl.igsid, rt });
      for (const code of await store.findOpenRooms(bracket, now - QUICK_FRESH_MS, now)) {
        const d = await store.getRoom(code, now);
        if (!d || !d.players || !d.players.a || d.players.b) continue;
        if (bracket === 'ranked' && d.players.a.uid === pl.igsid) continue; // 나 자신(다른 창)과는 안 붙음
        const top = {};
        if (bracket === 'ranked') {
          // 랭킹전은 대기실 없이 바로: 곡은 무작위, 몇 초 뒤 같이 시작
          const pool = rankedPoolFor(Math.min(rt ?? 1000, d.players.a.rt ?? 1000)); // 둘 중 낮은 점수에 맞춰
          const level = pool[Math.floor(Math.random() * pool.length)];
          const lv = getLevel(level);
          Object.assign(top, { level, status: 'playing', round: 1, startAt: now + RANKED_START_DELAY_MS, endBy: now + RANKED_START_DELAY_MS + levelDuration(lv) * 1000 + 120_000 });
        }
        if (bracket === 'rush') {
          // 🎲 랜덤 대결도 대기실 없이 바로 첫 곡
          const level = pickRushLevel();
          Object.assign(top, { level, recent: [level], status: 'playing', round: 1, startAt: now + RUSH_START_DELAY_MS });
        }
        const joined = await store.patchRoom(code, { top, slot: 'b', player: me, cond: { slotFree: 'b', status: 'lobby', round: d.round || 0 } }, now, exp(now));
        if (!joined) continue;
        // 빠른 대결은 바로 시작하지 않고 대기실로: 둘 다 '준비!'를 누르면 시작 (곡은 그때 무작위)
        return [200, { code, slot: 'b', key, room: publicRoom(joined, now), now }];
      }
      const data = { mode: 'versus', level: BRACKETS[bracket][0], status: 'lobby', round: 0, cfgVer: 1, host: 'a', createdAt: now, pub: bracket, players: { a: me } };
      const code = await newCode(data, now);
      if (!code) return [503, { error: 'busy' }];
      return [200, { code, slot: 'a', key, room: publicRoom({ ...data, code }, now), now, waiting: true }];
    }

    if (action === 'sync' || action === 'leave' || action === 'again') {
      const { code, d, slot } = await auth(body, now);

      if (action === 'leave') {
        // 🏆 랭킹전 치는 중에 나가면 자리는 남겨 둠 (상대 결과 계산에 내 점수가 필요) → 소식 끊김 = 나간 것
        const other = d.players[slot === 'a' ? 'b' : 'a'];
        if (d.pub === 'ranked' && d.status === 'playing' && other) {
          // 시작하기 전에 나가면 이 판은 없던 걸로 (점수 변화 없음)
          const before = now < (d.startAt || 0);
          if (ranked && !before) await ranked.forfeit(request, d, slot, now);
          await store.patchRoom(code, { top: before ? { void: true } : {}, slot, player: { seenAt: 0, left: true } }, now, exp(now));
          return [200, { ok: true }];
        }
        const players = { ...d.players };
        delete players[slot];
        const left = SLOTS.filter((s) => players[s]);
        if (!left.length) await store.deleteRoom(code);
        // 🎲 랜덤 대결은 한 명이 나가면 그 방은 끝 (남은 사람에게 모르는 사람이 또 붙지 않게)
        else await store.patchRoom(code, { top: { players, host: d.host === slot ? left[0] : d.host, status: d.pub === 'rush' ? 'over' : 'lobby' } }, now, exp(now));
        return [200, { ok: true }];
      }

      // 한 판 더: 대기실로 (준비는 판 번호가 바뀌어서 저절로 풀림)
      if (action === 'again') {
        if (d.pub === 'ranked' || d.pub === 'rush') return [400, { error: 'bad_action' }];
        const out = (await store.patchRoom(code, { top: { status: 'lobby' }, cond: { status: 'playing', round: d.round || 0 } }, now, exp(now))) || (await store.getRoom(code, now));
        return [200, { room: publicRoom(out, now), now }];
      }

      // sync: 내 상태 보내고 방 받기
      const me = { seenAt: now };
      // ⚡ 실시간 연결(폰끼리 직접, WebRTC) 준비 신호: 서로 주소(SDP)를 한 번씩 건네 줌
      const sg = body.sig;
      if (sg && typeof sg === 'object' && (sg.type === 'offer' || sg.type === 'answer') && typeof sg.sdp === 'string' && sg.sdp.length <= 12000)
        me.sig = { id: String(sg.id || '').slice(0, 40), to: String(sg.to || '').slice(0, 16), type: sg.type, sdp: sg.sdp };
      const top = {};
      const isHost = d.host === slot;
      if (d.status === 'lobby') {
        if (body.name !== undefined) {
          const n = cleanRoomName(body.name);
          if (n) me.name = n;
        }
        if (body.part !== undefined && ROOM_PARTS_READY.includes(body.part)) me.part = body.part;
        // 방장만: 곡·모드 바꾸기 (바꾸면 준비가 풀림)
        if (isHost && !d.pub && body.level !== undefined && getLevel(body.level) && getLevel(body.level).id !== d.level) {
          top.level = getLevel(body.level).id;
          top.cfgVer = (d.cfgVer || 0) + 1;
        }
        // 방장만: 개인전 무제한(서바이벌) 켜고 끄기 — 빠른 대결 방도 됨
        if (isHost && typeof body.endless === 'boolean' && body.endless !== !!d.endless) {
          top.endless = body.endless;
          top.cfgVer = (top.cfgVer || d.cfgVer || 0) + 1;
        }
        if (isHost && !d.pub && (body.mode === 'team' || body.mode === 'versus') && body.mode !== d.mode) {
          top.mode = body.mode;
          top.cfgVer = (top.cfgVer || d.cfgVer || 0) + 1;
        }
        if (body.ready === true) {
          const level = top.level ?? d.level;
          const err = canPlay && !d.pub ? await canPlay(level, await getPlayer(request)) : null; // 빠른 대결은 둘 다 칠 수 있는 곡만 고름
          if (err) return [403, { error: err, level }];
          me.ready = `${top.cfgVer ?? d.cfgVer ?? 0}.${d.round || 0}`;
        } else if (body.ready === false) me.ready = null;
      }
      if (d.status === 'playing') {
        const lv = body.live;
        if (lv && typeof lv === 'object')
          me.live = { round: d.round, score: int(lv.score, 0, 1e8) ?? 0, combo: int(lv.combo, 0, 1e5) ?? 0, progress: Math.max(0, Math.min(1, Number(lv.progress) || 0)), lives: int(lv.lives, 0, 9) };
        const f = body.final;
        if (f && typeof f === 'object')
          me.final = {
            round: d.round,
            score: int(f.score, 0, 1e8) ?? 0,
            stars: int(f.stars, 0, 3) ?? 0,
            grade: /^[A-FS]{1,3}$/.test(String(f.grade || '')) ? f.grade : '',
            failed: !!f.failed,
            maxCombo: int(f.maxCombo, 0, 1e5) ?? 0,
            accuracy: Math.max(0, Math.min(1, Number(f.accuracy) || 0)),
            // ⚔️ 서바이벌: 목숨을 다 썼나 · 버틴 시간(초) · 도달한 Lv
            died: !!f.died,
            survived: Math.max(0, Math.min(36000, Number(f.survived) || 0)),
            lv: int(f.lv, 0, 9999) ?? 0,
          };
      }
      // ✍ 바뀐 게 '방금 봤음(seenAt)' 뿐이고 8초 안에 이미 적었으면 안 씀 (D1 쓰기 = 폴링마다 1줄 → 1/3 쯤, 2026-11-22)
      //   상대는 15초 넘게 소식이 없어야 '끊김'으로 보고, 빠른 대결도 15초 안 방만 찾음 → 8초면 넉넉
      const prevSeen = d.players && d.players[slot] && d.players[slot].seenAt;
      const onlySeen = Object.keys(me).length === 1 && !Object.keys(top).length;
      let out = onlySeen && prevSeen && now - prevSeen < SEEN_WRITE_MS ? d : await store.patchRoom(code, { top, slot, player: me }, now, exp(now));
      if (!out) throw Object.assign(new Error('room_gone'), { status: 404 });
      // 두 사람 다 준비 → 시작 시각 정하기 (먼저 바꾼 쪽만 성공)
      const tag = readyTag(out);
      const ps = SLOTS.map((s) => out.players && out.players[s]).filter(Boolean);
      if (out.status === 'lobby' && ps.length === 2 && ps.every((p) => p.ready === tag)) {
        // 빠른 대결 방은 '한 판 더' 때마다 같은 묶음에서 새 곡
        const level = out.pub ? pickQuickLevel(out.pub, ps.every((p) => p.ok)) : out.level;
        const lv = getLevel(level);
        const started = await store.patchRoom(
          code,
          { top: { level, status: 'playing', round: (out.round || 0) + 1, startAt: now + ROOM_START_DELAY_MS, endBy: now + ROOM_START_DELAY_MS + (lv ? levelDuration(lv) * 1000 : 0) + 120_000 }, cond: { status: 'lobby', round: out.round || 0 } },
          now,
          exp(now)
        );
        if (started) out = started;
        else out = (await store.getRoom(code, now)) || out;
      }
      // 🎲 랜덤 대결: 둘 다 살아서 곡을 끝냄 → 다른 곡 바로 (먼저 바꾼 쪽만 성공)
      if (rushBothCleared(out)) {
        const recent = Array.isArray(out.recent) ? out.recent.slice(-4) : [out.level];
        const level = pickRushLevel(recent);
        const next = await store.patchRoom(
          code,
          { top: { level, recent: [...recent, level].slice(-5), round: (out.round || 0) + 1, startAt: now + RUSH_NEXT_DELAY_MS }, cond: { status: 'playing', round: out.round || 0 } },
          now,
          exp(now)
        );
        out = next || (await store.getRoom(code, now)) || out;
      }
      return [200, { room: publicRoom(out, now), now }];
    }

    return [400, { error: 'bad_action' }];
  };
}
