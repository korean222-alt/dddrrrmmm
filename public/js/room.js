// 친구 대결 방 클라이언트
//   서버(/api/rooms): 방 만들기·들어가기·빠른 대결 짝짓기·준비·시작 시각·최종 점수. 대기실 3초마다 주고받음.
//   ⚡ 실시간: 두 폰을 직접 이어서(WebRTC 데이터 채널) 치는 동안 점수를 0.2초마다 바로 주고받음.
//     처음 이을 때만 서버로 서로 주소(SDP)를 한 번씩 건넴. 이어지면 치는 동안 서버 요청은 15초에 한 번(살아 있음 표시)만.
//     통신사 망에 따라 직접 연결이 안 되면 예전처럼 서버로 4초마다 (자동으로 바뀜).
//   서버 시계와 내 시계 차이(offset)를 재서 '같은 시각에 시작'을 맞춤.

// Vercel 요청 수를 아끼려고 넉넉하게
// 하루 10만 건(Cloudflare 무료) 아끼기: 실시간 연결이 안 됐을 때만 서버로 주고받으니 너무 촘촘하지 않게
export const ROOM_POLL_LOBBY_MS = 3000;
export const ROOM_POLL_PLAY_MS = 5000;
export const ROOM_POLL_RT_MS = 15000; // 실시간 연결됐을 때 치는 중
export const ROOM_POLL_WAIT_MS = 5000; // 빠른 대결 상대 기다리는 중
const LIVE_EVERY_MS = 200;
const LINK_GIVEUP_MS = 20000;
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

const rid = () => Math.random().toString(36).slice(2, 12);

function iceDone(pc, ms = 3000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

/** 상대 폰과 직접 연결 하나 (주소를 한 번에 다 모아서 건넴 — 서버를 한 번씩만 거치게) */
class PeerLink {
  constructor(id, peer) {
    this.id = id;
    this.peer = peer;
    this.t0 = Date.now();
    this.open = false;
    this.accepted = false;
    this.onMessage = null;
    this.onOpen = null;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }
  _wire(ch) {
    this.ch = ch;
    ch.onopen = () => {
      this.open = true;
      if (this.onOpen) this.onOpen();
    };
    ch.onclose = () => (this.open = false);
    ch.onmessage = (e) => {
      try {
        if (this.onMessage) this.onMessage(JSON.parse(e.data));
      } catch {}
    };
  }
  async offer() {
    this._wire(this.pc.createDataChannel('kk'));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await iceDone(this.pc);
    return this.pc.localDescription.sdp;
  }
  async answer(sdp) {
    this.pc.ondatachannel = (e) => this._wire(e.channel);
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await iceDone(this.pc);
    return this.pc.localDescription.sdp;
  }
  async accept(sdp) {
    if (this.accepted) return;
    this.accepted = true;
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }
  send(obj) {
    if (!this.open) return false;
    try {
      this.ch.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }
  close() {
    this.open = false;
    try {
      if (this.ch) this.ch.close();
    } catch {}
    try {
      this.pc.close();
    } catch {}
  }
}

export class RoomClient {
  /**
   * @param {{ api, onUpdate(room), onError(err), onGone(), onLink(open) }} o
   */
  constructor({ api, onUpdate, onError, onGone, onLink }) {
    this.api = api;
    this.onUpdate = onUpdate || (() => {});
    this.onError = onError || (() => {});
    this.onGone = onGone || (() => {});
    this.onLink = onLink || (() => {});
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
    this.link = null;
    this.peerLive = null;
    this.peerFinal = null;
    this._failedPeer = null;
    this._lastLive = 0;
  }

  get active() {
    return !!this.code;
  }
  get isHost() {
    return !!this.room && this.room.host === this.slot;
  }
  /** 폰끼리 직접 연결돼서 실시간으로 주고받는 중 */
  get realtime() {
    return !!(this.link && this.link.open);
  }
  get me() {
    return this.room && this.room.players[this.slot];
  }
  _otherRaw() {
    if (!this.room) return null;
    return this.room.players[this.slot === 'a' ? 'b' : 'a'] || null;
  }
  /** 상대 (실시간으로 받은 점수가 있으면 그게 더 최신) */
  get other() {
    const o = this._otherRaw();
    if (!o) return null;
    const r = this.room.round;
    const out = { ...o };
    if (this.peerLive && this.peerLive.round === r) out.live = this.peerLive;
    if (!out.final && this.peerFinal && this.peerFinal.round === r) out.final = this.peerFinal;
    return out;
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
    this._closeLink();
    this._failedPeer = null;
    this.code = r.code;
    this.slot = r.slot;
    this.key = r.key;
    this.room = r.room;
    this.bestRtt = Infinity;
    this._update();
    this._schedule();
  }

  _update() {
    this._syncLink();
    this.onUpdate(this.room);
  }

  async create(name, mode, level) {
    this._enter(await this._call({ action: 'create', name, mode, level }));
  }

  async join(code, name) {
    this._enter(await this._call({ action: 'join', code, name }));
  }

  /** 빠른 대결에서 지금 기다리는 사람 수 { easy, hard } (실패하면 null) */
  async waitingCounts() {
    try {
      const r = await this.api.room({ action: 'count' });
      return (r && r.waiting) || null;
    } catch {
      return null;
    }
  }

  /** ⚡ 빠른 대결: 같은 묶음에서 기다리는 사람이 있으면 바로 붙음. 없으면 기다림 (true) */
  async quick(name, bracket) {
    const r = await this._call({ action: 'quick', name, bracket });
    this._enter(r);
    return !!r.waiting;
  }

  /** 빠른 대결에서 아직 상대를 기다리는 중 */
  get waiting() {
    return !!(this.room && this.room.pub && this.room.status === 'lobby' && !this._otherRaw());
  }

  /** 다음 주고받기 때 같이 보낼 값 (ready, level, mode, live, final…) — 바로 보내려면 now=true */
  send(fields, now = false) {
    if (fields.live) {
      const { live, ...rest } = fields;
      if (this.realtime) {
        // 실시간: 상대 폰으로 바로 (0.2초마다), 서버엔 안 보냄
        if (Date.now() - this._lastLive >= LIVE_EVERY_MS) {
          this._lastLive = Date.now();
          this.link.send({ t: 'live', round: this.room && this.room.round, ...live });
        }
      } else this.pending.live = live;
      fields = rest;
    }
    if (fields.final && this.realtime) this.link.send({ t: 'final', round: this.room && this.room.round, ...fields.final });
    Object.assign(this.pending, fields);
    if (now) return this.poll();
    return null;
  }

  async poll() {
    if (!this.code) return;
    // 주고받는 중에 '바로 보내기'가 오면 끝나자마자 한 번 더 (다음 주기까지 안 기다리게)
    if (this._busy) {
      this._again = true;
      return;
    }
    this._busy = true;
    clearTimeout(this._timer); // 주기 타이머는 끝나고 다시 잡음 (겹쳐서 두 번 보내지 않게)
    const body = { action: 'sync', code: this.code, slot: this.slot, key: this.key, ...this.pending };
    this.pending = {};
    try {
      const r = await this._call(body);
      this._fails = 0;
      this.room = r.room;
      this._update();
    } catch (e) {
      if (e.status === 404 || (e.status === 403 && e.message === 'not_in_room')) {
        this._stop();
        this.onGone(e);
      } else {
        // 준비 못 함(잠긴 곡) 같은 건 화면에 알림. 네트워크 오류는 다음 번에 다시
        if (e.status === 403) this.onError(e);
        else if (++this._fails >= 5) this.onError(e);
        // 못 보낸 final·연결 신호는 다시 보냄 (ready 는 화면에서 다시 누르게)
        if (body.final && !this.pending.final) this.pending.final = body.final;
        if (body.sig && !this.pending.sig) this.pending.sig = body.sig;
      }
    } finally {
      this._busy = false;
      if (this._again && this.code) {
        this._again = false;
        this.poll();
      } else this._schedule();
    }
  }

  _schedule() {
    clearTimeout(this._timer);
    if (!this.code) return;
    const playing = this.room && this.room.status === 'playing';
    const linking = this.link && !this.link.open; // 연결 신호 주고받는 중엔 빨리
    const ms = playing ? (this.realtime ? ROOM_POLL_RT_MS : ROOM_POLL_PLAY_MS) : this.waiting ? ROOM_POLL_WAIT_MS : linking ? 1500 : ROOM_POLL_LOBBY_MS;
    this._timer = setTimeout(() => {
      if (typeof document !== 'undefined' && document.hidden) this._schedule();
      else this.poll();
    }, ms);
  }

  // ---------- ⚡ 폰끼리 직접 연결 ----------
  _newLink(id, peer) {
    const link = new PeerLink(id, peer);
    link.onMessage = (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'live') this.peerLive = { round: m.round, score: m.score | 0, combo: m.combo | 0, progress: +m.progress || 0, lives: m.lives };
      else if (m.t === 'final') {
        this.peerFinal = { round: m.round, score: m.score | 0, stars: m.stars | 0, grade: String(m.grade || ''), failed: !!m.failed, maxCombo: m.maxCombo | 0, accuracy: +m.accuracy || 0, died: !!m.died, survived: +m.survived || 0, lv: m.lv | 0 };
        this.onUpdate(this.room);
      }
    };
    link.onOpen = () => {
      this.onLink(true);
      this.onUpdate(this.room);
      this._schedule();
    };
    this.link = link;
    return link;
  }

  _closeLink() {
    if (this.link) {
      const was = this.link.open;
      this.link.close();
      this.link = null;
      if (was) this.onLink(false);
    }
    this.peerLive = null;
    this.peerFinal = null;
  }

  _fail(peer) {
    this._failedPeer = peer;
    this._closeLink();
  }

  /** 방 상태를 보고 연결을 만들거나(a 가 먼저 제안, b 가 답) 정리 */
  _syncLink() {
    const me = this.me;
    const o = this._otherRaw();
    if (typeof RTCPeerConnection === 'undefined' || !this.room || !me || !o || !o.pid || !me.pid) {
      this._closeLink();
      return;
    }
    if (this.link && this.link.peer !== o.pid) this._closeLink();
    // 한동안 안 이어지면 이 상대와는 서버로만 (통신사 망에 따라 직접 연결이 막히기도 함)
    if (this.link && !this.link.open && Date.now() - this.link.t0 > LINK_GIVEUP_MS) this._fail(o.pid);
    if (this._failedPeer === o.pid) return;
    if (this.link && this.link.open) return;
    if (this.slot === 'a') {
      if (!this.link) {
        const id = rid();
        const link = this._newLink(id, o.pid);
        link
          .offer()
          .then((sdp) => this.link === link && this.send({ sig: { id, to: o.pid, type: 'offer', sdp } }, true))
          .catch(() => this.link === link && this._fail(o.pid));
      } else if (o.sig && o.sig.type === 'answer' && o.sig.id === this.link.id && o.sig.to === me.pid) {
        const link = this.link;
        link.accept(o.sig.sdp).catch(() => this.link === link && this._fail(o.pid));
      }
    } else {
      const sg = o.sig;
      if (sg && sg.type === 'offer' && sg.to === me.pid && (!this.link || this.link.id !== sg.id)) {
        this._closeLink();
        const link = this._newLink(sg.id, o.pid);
        link
          .answer(sg.sdp)
          .then((sdp) => this.link === link && this.send({ sig: { id: sg.id, to: o.pid, type: 'answer', sdp } }, true))
          .catch(() => this.link === link && this._fail(o.pid));
      }
    }
  }

  async again() {
    if (!this.code) return;
    this.peerFinal = null;
    this.peerLive = null;
    try {
      const r = await this._call({ action: 'again', code: this.code, slot: this.slot, key: this.key });
      this.room = r.room;
      this._update();
    } catch {}
    // 치는 중엔 15초 간격이었으니 대기실 간격(3초)으로 다시 잡음 (상대 준비·규칙 바뀐 게 늦게 보이던 것)
    this._schedule();
  }

  _stop() {
    clearTimeout(this._timer);
    this._closeLink();
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

/**
 * ⚔️ 서바이벌 승패: 먼저 목숨을 다 쓴 사람이 짐. 둘 다 졌으면(거의 동시) 더 오래 버틴 쪽, 그것도 같으면 점수.
 * me/them = { died, survived(초), score }
 */
export function survivalOutcome(me, them) {
  if (!me.died && them.died) return 'win';
  if (me.died && !them.died) return 'lose';
  const d = (me.survived || 0) - (them.survived || 0);
  if (Math.abs(d) > 0.05) return d > 0 ? 'win' : 'lose';
  if (me.score === them.score) return 'draw';
  return me.score > them.score ? 'win' : 'lose';
}

/** 방 결과: 개인전은 승패, 팀전은 합계 */
export function roomOutcome(mode, mine, theirs) {
  if (mode === 'team') return { team: (mine || 0) + (theirs || 0) };
  if (mine === theirs) return { result: 'draw' };
  return { result: mine > theirs ? 'win' : 'lose' };
}
