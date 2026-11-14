// 저장소: JSON 파일 하나 (codes, players). 트래픽이 커지면 같은 메서드로
// Postgres/Supabase 구현을 만들어 갈아끼우면 됩니다.
//
// codes:   { [code]: { code, purpose, sessionId, status, createdAt, expiresAt, igsid?, username?, verifiedAt? } }
//          status: pending | not_following | verified | expired
// players: { [igsid]: { igsid, username, followVerifiedAt, bests: { [level]: { score, grade, maxCombo, at } } } }

import fs from 'node:fs';
import path from 'node:path';

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { codes: {}, players: {}, usedRuns: {} };
    this._timer = null;
  }

  init() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = { codes: d.codes || {}, players: d.players || {}, usedRuns: d.usedRuns || {} };
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[store] 읽기 실패, 새로 시작:', e.message);
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

  // ----- codes -----
  createCode(rec) {
    this.data.codes[rec.code] = rec;
    this._save();
    return rec;
  }
  getCode(code) {
    return this.data.codes[code] || null;
  }
  updateCode(code, patch) {
    const rec = this.data.codes[code];
    if (!rec) return null;
    Object.assign(rec, patch);
    this._save();
    return rec;
  }
  /** 오래된 코드/사용한 판 토큰 정리 */
  prune(now = Date.now()) {
    let n = 0;
    for (const [k, r] of Object.entries(this.data.codes)) {
      if (r.expiresAt + 24 * 3600 * 1000 < now) {
        delete this.data.codes[k];
        n++;
      }
    }
    for (const [k, exp] of Object.entries(this.data.usedRuns)) if (exp < now) delete this.data.usedRuns[k];
    if (n) this._save();
    return n;
  }

  // ----- players -----
  getPlayer(igsid) {
    return this.data.players[igsid] || null;
  }
  upsertPlayer(igsid, patch) {
    const p = this.data.players[igsid] || { igsid, username: null, followVerifiedAt: null, bests: {} };
    Object.assign(p, patch);
    this.data.players[igsid] = p;
    this._save();
    return p;
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
      if (b && p.username) rows.push({ igsid: p.igsid, username: p.username, score: b.score, grade: b.grade, at: b.at });
    }
    rows.sort((a, b) => b.score - a.score || a.at - b.at);
    rows.forEach((r, i) => (r.rank = i + 1));
    return { rows: rows.slice(0, limit), all: rows };
  }

  // ----- 판 토큰 1회용 처리 -----
  useRun(nonce, expiresAt) {
    if (this.data.usedRuns[nonce]) return false;
    this.data.usedRuns[nonce] = expiresAt;
    this._save();
    return true;
  }
}
