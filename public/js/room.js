// 친구 대결 방 클라이언트: /api/rooms 를 주기적으로 불러 내 상태를 보내고 방(상대) 상태를 받음.
//   대기실 2.5초 · 치는 중·결과 기다릴 때 4초. 화면이 안 보이면(백그라운드) 쉼.
//   서버 시계와 내 시계 차이(offset)를 재서 '같은 시각에 시작'을 맞춤.

// Vercel 요청 수를 아끼려고 넉넉하게 (점수 막대는 조금 늦게 따라와도 됨)
export const ROOM_POLL_LOBBY_MS = 2500;
export const ROOM_POLL_PLAY_MS = 4000;

export class RoomClient {
  /**
   * @param {{ api, onUpdate(room), onError(err), onGone() }} o
   */
  constructor({ api, onUpdate, onError, onGone }) {
    this.api = api;
    this.onUpdate = onUpdate || (() => {});
    this.onError = onError || (() => {});
    this.onGone = onGone || (() => {});
    this.room = null;
    this.code = null;
    this.slot = null;
    this.key = null;
    this.offset = 0; // 서버 시각 - 내 시각 (ms)
    this.bestRtt = Infinity;
    this.pending = {};
    this._timer = null;
    this._busy = false;
    this._fails = 0;
  }

  get active() {
    return !!this.code;
  }
  get isHost() {
    return !!this.room && this.room.host === this.slot;
  }
  get me() {
    return this.room && this.room.players[this.slot];
  }
  get other() {
    if (!this.room) return null;
    const s = this.slot === 'a' ? 'b' : 'a';
    return this.room.players[s] || null;
  }
  /** 서버 시각(ms) → 내 Date.now() 기준 */
  toLocal(serverMs) {
    return serverMs - this.offset;
  }

  async _call(body) {
    const t0 = Date.now();
    const r = await this.api.room(body);
    const t1 = Date.now();
    if (r && r.now) {
      // 왕복이 가장 짧았던 응답으로 시계 차이를 잼 (더 정확)
      const rtt = t1 - t0;
      if (rtt <= this.bestRtt + 30) {
        this.bestRtt = Math.min(this.bestRtt, rtt);
        this.offset = r.now - (t0 + t1) / 2;
      }
    }
    return r;
  }

  _enter(r) {
    this.code = r.code;
    this.slot = r.slot;
    this.key = r.key;
    this.room = r.room;
    this.bestRtt = Infinity;
    this.onUpdate(this.room);
    this._schedule();
  }

  async create(name, mode, level) {
    this._enter(await this._call({ action: 'create', name, mode, level }));
  }

  async join(code, name) {
    this._enter(await this._call({ action: 'join', code, name }));
  }

  /** 다음 주고받기 때 같이 보낼 값 (ready, level, mode, live, final…) — 바로 보내려면 now=true */
  send(fields, now = false) {
    Object.assign(this.pending, fields);
    if (now) return this.poll();
    return null;
  }

  async poll() {
    if (!this.code || this._busy) return;
    this._busy = true;
    const body = { action: 'sync', code: this.code, slot: this.slot, key: this.key, ...this.pending };
    this.pending = {};
    try {
      const r = await this._call(body);
      this._fails = 0;
      this.room = r.room;
      this.onUpdate(this.room);
    } catch (e) {
      if (e.status === 404 || (e.status === 403 && e.message === 'not_in_room')) {
        this._stop();
        this.onGone(e);
      } else {
        // 준비 못 함(잠긴 곡) 같은 건 화면에 알림. 네트워크 오류는 다음 번에 다시
        if (e.status === 403) this.onError(e);
        else if (++this._fails >= 5) this.onError(e);
        // 못 보낸 live/final 은 다시 보냄 (ready 는 화면에서 다시 누르게)
        if (body.final && !this.pending.final) this.pending.final = body.final;
      }
    } finally {
      this._busy = false;
      this._schedule();
    }
  }

  _schedule() {
    clearTimeout(this._timer);
    if (!this.code) return;
    const ms = this.room && this.room.status === 'playing' ? ROOM_POLL_PLAY_MS : ROOM_POLL_LOBBY_MS;
    this._timer = setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden) this._schedule();
      else this.poll();
    }, ms);
  }

  async again() {
    if (!this.code) return;
    try {
      const r = await this._call({ action: 'again', code: this.code, slot: this.slot, key: this.key });
      this.room = r.room;
      this.onUpdate(this.room);
    } catch {}
  }

  _stop() {
    clearTimeout(this._timer);
    this.code = null;
    this.room = null;
  }

  async leave() {
    if (!this.code) return;
    const body = { action: 'leave', code: this.code, slot: this.slot, key: this.key };
    this._stop();
    try {
      await this.api.room(body);
    } catch {}
  }
}

/** 방 결과: 개인전은 승패, 팀전은 합계 */
export function roomOutcome(mode, mine, theirs) {
  if (mode === 'team') return { team: (mine || 0) + (theirs || 0) };
  if (mine === theirs) return { result: 'draw' };
  return { result: mine > theirs ? 'win' : 'lose' };
}
