// 저장소: JSON 파일 하나 (codes, players). 트래픽이 커지면 같은 메서드로
// Postgres/Supabase 구현을 만들어 갈아끼우면 됩니다.
//
// codes:   { [code]: { code, purpose, sessionId, status, createdAt, expiresAt, igsid?, username?, verifiedAt? } }
//          status: pending | not_following | verified | expired
// sessions: { [sid]: { sid, vid, startedAt, lastAt, activeSec, ref, device } }   ← 이용 통계 (접속 1회)
// plays:    { [id]: { id, sid, vid, level, mode, startedAt, endedAt, result, score, stars, sec } }  ← 곡 한 판
// players: { [igsid]: { igsid, username, ig(인스타 아이디), createdAt, checkedAt(운영자가 팔로우 확인한 시각), bests: { [level]: { score, grade, maxCombo, at } } } }
//          level 0 = 무제한 모드 (점수 = 깬 단계 × 1,000,000 + 점수, 서버가 풀어서 보여줌)

import fs from 'node:fs';
import path from 'node:path';
import { shiftOldLevelKey } from '../public/js/charts.js';

// 이용 통계는 1년 보관
export const STATS_KEEP_MS = 400 * 24 * 3600 * 1000;
/** 랭킹에서 내린 참여자를 이만큼 뒤에 지움 */
export const HIDE_KEEP_MS = 5 * 24 * 3600 * 1000;

/** 관리자 목록 정렬: 아직 확인 안 한 사람 먼저, 그 안에선 최근 가입 순 */
export const sortPlayers = (rows) => rows.sort((a, b) => !!a.hiddenAt - !!b.hiddenAt || !a.ig - !b.ig || !!a.checkedAt - !!b.checkedAt || (b.createdAt || 0) - (a.createdAt || 0));

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { players: {}, usedRuns: {}, sessions: {}, plays: {}, settings: {}, suggestions: [], rooms: {}, transfers: {} };
    this._timer = null;
  }

  init() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = { players: d.players || {}, usedRuns: d.usedRuns || {}, sessions: d.sessions || {}, plays: d.plays || {}, settings: d.settings || {}, suggestions: d.suggestions || [], rooms: d.rooms || {}, transfers: d.transfers || {} };
      // 인스타 아이디 등록 기능을 없앴으므로, 예전에 인증된 인스타 계정 기록과 인증 코드는 지움
      for (const [k, p] of Object.entries(this.data.players)) if (p.followVerifiedAt) delete this.data.players[k];
      // 무제한 기록(level <= 0): 예전 방식(깬 단계 × 100만 + 점수) → 새 방식(× 10억)
      for (const p of Object.values(this.data.players))
        for (const [lv, b] of Object.entries(p.bests || {})) if (Number(lv) <= 0 && b && b.score < 1e9) b.score = Math.floor(b.score / 1e6) * 1e9 + (b.score % 1e6);
      // 8단계에 새 곡이 끼면서 예전 8~14단계가 9~15단계로 밀림 → 기록 키를 한 번만 옮김
      if (!this.data.settings['migration:insert-level-8-v1']) {
        for (const p of Object.values(this.data.players)) {
          const bs = {};
          for (const [lv, b] of Object.entries(p.bests || {})) bs[shiftOldLevelKey(lv)] = b;
          p.bests = bs;
        }
        for (const pl of Object.values(this.data.plays)) if (pl && pl.level != null) pl.level = typeof pl.level === 'number' ? Number(shiftOldLevelKey(pl.level)) : shiftOldLevelKey(pl.level);
        this.data.settings['migration:insert-level-8-v1'] = String(Date.now());
      }
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[store] 읽기 실패, 새로 시작:', e.message);
      // 새로 시작하는 저장소는 처음부터 새 번호 → 나중에 파일이 생겨도 옮기지 않게 표시
      this.data.settings['migration:insert-level-8-v1'] ??= String(Date.now());
    }
    return this;
  }

  _save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 200);
  }

  flush() {
    clearTimeout(this._timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[store] 저장 실패:', e.message);
    }
  }

  /** 설정값 하나 (없으면 null) */
  getSetting(key) {
    return this.data.settings[key] ?? null;
  }
  setSetting(key, value) {
    this.data.settings[key] = String(value);
    this._save();
  }

  // ----- players -----
  getPlayer(igsid) {
    return this.data.players[igsid] || null;
  }
  upsertPlayer(igsid, patch) {
    const p = this.data.players[igsid] || { igsid, username: null, ig: null, createdAt: Date.now(), checkedAt: null, bests: {} };
    const { ig, ...rest } = patch;
    Object.assign(p, rest);
    // 인스타 아이디가 바뀌거나, 랭킹에서 내려진 사람이 아이디를 다시 넣으면 → 다시 랭킹에 + 운영자가 다시 확인
    if (ig && (ig !== p.ig || p.hiddenAt)) {
      p.ig = ig;
      p.checkedAt = null;
      p.hiddenAt = null;
    }
    this.data.players[igsid] = p;
    this._save();
    return p;
  }
  /** 관리자용 참여자 목록 (확인 안 한 사람 먼저, 최근 가입 순) */
  listPlayers() {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      if (!p.username) continue;
      const bs = Object.entries(p.bests || {}).filter(([lv]) => Number(lv) > 0);
      rows.push({
        igsid: p.igsid, username: p.username, ig: p.ig || null, createdAt: p.createdAt || null, checkedAt: p.checkedAt || null,
        hiddenAt: p.hiddenAt || null,
        total: bs.reduce((a, [, b]) => a + b.score, 0), levels: bs.length, endless: p.bests && p.bests[0] ? p.bests[0].score : null,
      });
    }
    return sortPlayers(rows);
  }
  deletePlayer(igsid) {
    const had = !!this.data.players[igsid];
    delete this.data.players[igsid];
    if (had) this._save();
    return had;
  }
  setHidden(igsid, on, now = Date.now()) {
    const p = this.data.players[igsid];
    if (!p) return false;
    p.hiddenAt = on ? now : null;
    p.checkedAt = null;
    this._save();
    return true;
  }
  purgeHidden(now = Date.now()) {
    let n = 0;
    for (const [k, p] of Object.entries(this.data.players)) {
      if (p.hiddenAt && p.hiddenAt < now - HIDE_KEEP_MS) {
        delete this.data.players[k];
        n++;
      }
    }
    if (n) this._save();
    return n;
  }
  setChecked(igsid, on) {
    const p = this.data.players[igsid];
    if (!p) return false;
    p.checkedAt = on ? Date.now() : null;
    if (on) p.hiddenAt = null;
    this._save();
    return true;
  }
  recordScore(igsid, level, entry) {
    const p = this.data.players[igsid];
    if (!p) return null;
    const prev = p.bests[level];
    const improved = !prev || entry.score > prev.score;
    if (improved) {
      p.bests[level] = { ...entry, at: Date.now() };
      this._save();
    }
    return { improved, best: improved ? entry.score : prev.score };
  }
  leaderboard(level, limit = 50) {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      const b = p.bests[level];
      if (b && p.username && !p.hiddenAt && p.checkedAt) rows.push({ igsid: p.igsid, username: p.username, score: b.score, grade: b.grade, at: b.at });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
  }

  /** 총 등수: 단계별 최고점의 합. 같으면 먼저 달성한 사람이 위 */
  totalLeaderboard(limit = 50) {
    const rows = [];
    for (const p of Object.values(this.data.players)) {
      const bs = Object.entries(p.bests || {}).filter(([lv]) => Number(lv) > 0).map(([, b]) => b); // 0 이하 = 무제한 (따로 랭킹)
      if (!bs.length || !p.username || p.hiddenAt || !p.checkedAt) continue;
      rows.push({
        igsid: p.igsid, username: p.username, score: bs.reduce((a, b) => a + b.score, 0),
        levels: bs.length, at: Math.max(...bs.map((b) => b.at || 0)),
      });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
  }
  totalRankOf(igsid) {
    const r = this.totalLeaderboard(0).all.find((x) => x.igsid === igsid);
    return r ? { rank: r.rank, score: r.score, levels: r.levels } : null;
  }

  /** 이 플레이어의 순위 { rank, score } (기록 없으면 null) */
  rankOf(level, igsid) {
    const r = this.leaderboard(level, 0).all.find((x) => x.igsid === igsid);
    return r ? { rank: r.rank, score: r.score } : null;
  }

  playersByIg(ig) {
    return Object.values(this.data.players)
      .filter((p) => p.ig === ig && p.username)
      .map((p) => ({ igsid: p.igsid, username: p.username, checkedAt: p.checkedAt || null, createdAt: p.createdAt || null, scores: Object.keys(p.bests || {}).length }))
      .sort((a, b) => b.scores - a.scores || (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))
      .slice(0, 20);
  }
  scoresOf(igsid) {
    const p = this.data.players[igsid];
    return Object.entries((p && p.bests) || {}).map(([lv, b]) => ({ level: Number(lv), score: b.score, grade: b.grade || null, maxCombo: b.maxCombo || 0 }));
  }

  /** 게스트 기록을 인증된 플레이어로 옮김 (단계별 더 높은 점수만 남김) */
  moveScores(from, to) {
    const a = this.data.players[from];
    const b = this.data.players[to];
    if (!a || !b || from === to) return;
    for (const [lv, e] of Object.entries(a.bests || {})) if (!b.bests[lv] || e.score > b.bests[lv].score) b.bests[lv] = e;
    a.bests = {};
    this._save();
  }

  // ----- 판 토큰 1회용 처리 -----
  useRun(nonce, expiresAt) {
    if (this.data.usedRuns[nonce]) return false;
    this.data.usedRuns[nonce] = expiresAt;
    this._save();
    return true;
  }

  // ----- 이용 통계 (익명) -----
  /** 접속 1회: 처음이면 만들고, 이후엔 마지막 시각·활동 시간(초)만 갱신 */
  trackSession({ sid, vid, now, activeSec, ref, device }) {
    const r = this.data.sessions[sid];
    if (!r) this.data.sessions[sid] = { sid, vid, startedAt: now, lastAt: now, activeSec, ref, device };
    else {
      r.lastAt = now;
      r.activeSec = Math.max(r.activeSec || 0, activeSec);
    }
    this._save();
  }
  /** 곡 한 판: 시작(startedAt) 또는 끝(endedAt, result, score…)을 같은 id 로 이어서 채움 */
  trackPlay(p) {
    const r = this.data.plays[p.id];
    if (!r) this.data.plays[p.id] = { result: null, endedAt: null, score: null, stars: null, sec: null, ...p };
    else for (const k of ['endedAt', 'result', 'score', 'stars', 'sec']) if (p[k] != null) r[k] = p[k];
    this._save();
  }
  /** [from, to) 에 시작한 접속·판 원본 + 이 기간에 처음 온 방문자 */
  statsRaw(from, to) {
    const inRange = (r) => r.startedAt >= from && r.startedAt < to;
    const sessions = Object.values(this.data.sessions);
    const first = new Map();
    for (const s of sessions) if (!first.has(s.vid) || s.startedAt < first.get(s.vid)) first.set(s.vid, s.startedAt);
    return {
      sessions: sessions.filter(inRange),
      plays: Object.values(this.data.plays).filter(inRange),
      newVids: [...first].filter(([, t]) => t >= from && t < to).map(([v]) => v),
    };
  }

  // ----- 건의함 -----
  addSuggestion({ at, kind, body, nick, vid }) {
    const id = (this.data.suggestions.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1;
    this.data.suggestions.push({ id, at, kind, body, nick: nick ?? null, vid: vid ?? null, doneAt: null });
    this._save();
    return id;
  }
  listSuggestions(from = 0, limit = 500) {
    return this.data.suggestions
      .filter((r) => r.at >= from)
      .sort((a, b) => b.at - a.at || b.id - a.id)
      .slice(0, limit)
      .map(({ vid, ...r }) => ({ ...r }));
  }
  setSuggestionDone(id, on, now = Date.now()) {
    const r = this.data.suggestions.find((x) => x.id === id);
    if (!r) return false;
    r.doneAt = on ? now : null;
    this._save();
    return true;
  }
  deleteSuggestion(id) {
    const n = this.data.suggestions.length;
    this.data.suggestions = this.data.suggestions.filter((x) => x.id !== id);
    this._save();
    return this.data.suggestions.length !== n;
  }
  countSuggestions(vid, since) {
    return this.data.suggestions.filter((r) => r.vid === vid && r.at >= since).length;
  }

  // ----- 친구 대결 방 -----
  createRoom(code, data, now, expiresAt) {
    for (const [k, r] of Object.entries(this.data.rooms)) if (r.expiresAt < now) delete this.data.rooms[k];
    if (this.data.rooms[code]) return false;
    this.data.rooms[code] = { data: structuredClone(data), updatedAt: now, expiresAt };
    this._save();
    return true;
  }
  getRoom(code, now = Date.now()) {
    const r = this.data.rooms[code];
    return r && r.expiresAt > now ? structuredClone(r.data) : null;
  }
  patchRoom(code, { top = {}, slot = null, player = null, cond = {} }, now, expiresAt) {
    const r = this.data.rooms[code];
    if (!r || r.expiresAt <= now) return null;
    const d = r.data;
    if (cond.status != null && d.status !== cond.status) return null;
    if (cond.round != null && (d.round || 0) !== cond.round) return null;
    if (cond.slotFree != null && d.players && d.players[cond.slotFree]) return null;
    Object.assign(d, structuredClone(top));
    if (slot) {
      d.players = d.players || {};
      d.players[slot] = { ...(d.players[slot] || {}), ...structuredClone(player || {}) };
    }
    r.updatedAt = now;
    r.expiresAt = expiresAt;
    this._save();
    return structuredClone(d);
  }
  findOpenRooms(bracket, freshAfter, now = Date.now()) {
    return Object.entries(this.data.rooms)
      .filter(([, r]) => r.expiresAt > now && r.updatedAt > freshAfter && r.data.pub === bracket && r.data.status === 'lobby' && r.data.players && r.data.players.a && !r.data.players.b)
      .sort((x, y) => x[1].updatedAt - y[1].updatedAt)
      .slice(0, 5)
      .map(([k]) => k);
  }
  deleteRoom(code) {
    delete this.data.rooms[code];
    this._save();
  }

  // ----- 기기 옮기기 -----
  putTransfer(code, data, now, expiresAt) {
    for (const [k, t] of Object.entries(this.data.transfers)) if (t.expiresAt < now) delete this.data.transfers[k];
    if (this.data.transfers[code]) return false;
    this.data.transfers[code] = { data: structuredClone(data), expiresAt };
    this._save();
    return true;
  }
  takeTransfer(code, now = Date.now()) {
    const t = this.data.transfers[code];
    if (!t) return null;
    delete this.data.transfers[code];
    this._save();
    return t.expiresAt > now ? t.data : null;
  }
}
