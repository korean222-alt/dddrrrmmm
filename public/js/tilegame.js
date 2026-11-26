// 🎹 시즌 2 피아노 타일 게임
//   2026-11-26 밤 다시 (사용자: '노래를 그냥 틀고 타일 눌러도 노래 안 나오고 박자만 맞춰 타일이 나오게' · '사진 참고해서 다시 만들어줘' ·
//     '한 개 누르면 코인 한 개, 다 깨면 빨라지기 전에 코인 파티 한 번' · 아이폰 터치 빠짐(몇 초 안에 눌러야 되는 것 없게))
//   · 노래(멜로디 + 왼손 반주, 피아노)는 판 내내 흐름 → 타일은 그 박자에 맞춰 내려오고, 타일 아래 끝이 판정선(화면 3/4)에 닿는 때가 그 음
//     누르면 소리 없음(코인 타일만 '띵'). 다음 칠 타일이 보이면 언제 눌러도 됨 — 판정선 가까이 누를수록 PERFECT (글자만, 점수는 같음)
//   · 화면 = 줄 TILE_ROWS(4)개. 보통 타일 높이 = 화면 높이 / 4 로 모든 곡·유저 맵이 같음 (곡마다 바꾸지 말 것)
//   · 맨 아래 「시작」 타일을 누르면 노래가 시작 (대결은 서버가 정한 시각에 같이)
//   · 첫 바퀴: 별 3개가 진행 줄에서 1/3·2/3·끝에 차오름 → 🪙 코인 파티(누른 만큼 코인, 놓쳐도 괜찮음) → 빨라지며 빈 다이아 3개 → 계속 빨라짐
//   · 친 타일은 옅게, 놓친 타일·빈 칸 누름은 빨갛게 (하트 하나, 바퀴를 돌면 하나 회복, 0 이면 끝). 코인 파티 중엔 벌 없음
//   · 긴 타일(꾹): 누른 채로 있으면 판정선까지 하늘색으로 차오르고, 끝까지면 +줄 수
//   🧈 부드럽게: 화면 시계는 performance.now 로 흐르고 소리 시계(귀에 들리는 시각)로 조금씩만 당김, 배경·타일 그림은 크기가 바뀔 때 한 번만 그림
//   🖐 터치 (CLAUDE.md 터치 씹힘 1~4차): touchstart + pointerdown(같은 자리 80ms 안 한 번만), touchmove 로는 새 터치를 안 만듦,
//     방금 친 줄을 0.12초 안에 또 누른 튕김은 무시, 하트를 잃은 뒤 0.35초는 빈 칸 누름으로 또 깎지 않음
//   🎨 스킨(상점): skin.palette(콩 스킨 색) → 타일 색, skin.bg(무대 그림·하늘색) → 배경
//   ⚔️ 대결(vs): 상대 점수 막대, maxLaps 바퀴(기본 3)에서 끝, 코인 파티 없음

import { STEPS_PER_BAR, parseChord } from './charts.js';
import { tileLap, tileCourse, buildCourse, lapStars, MAX_LAPS, TILE_HEARTS, TILE_ROWS, tilePoints, HOLD_PTS } from './tiles.js';

const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const BOLD = "800 {px}px 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
const bold = (px) => BOLD.replace('{px}', Math.round(px));
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOUNCE_SEC = 0.12;
const GRACE_SEC = 0.35;
/** 판정선 자리 (화면 높이 비율): 타일 아래 끝이 여기 닿을 때가 그 음 */
const JUDGE_AT = 0.75;
/** 판정선을 이만큼(줄) 지나 화면 밖으로 나가면 놓침 */
const GONE_ROWS = (1 - JUDGE_AT) * TILE_ROWS + 0.08;
const HOLD_BLUE = '#2fb8ff';
/** 친 자리에서 코인 칸까지 날아가는 시간 */
const FLY_SEC = 0.55;
/** 노래 소리 미리 예약 (초) */
const LOOKAHEAD = 0.3;
/** 곡마다 배경 색 (곡 목록 표지와 같은 색) */
const SONG_HUES = { 1: 28, 2: 340, 3: 200, 4: 265, 5: 150, 6: 12, 11: 300, 12: 185, 7: 45, 17: 230, 9: 320, 8: 95, 16: 255, 10: 5, 13: 170, 18: 280, 14: 210, 15: 355 };

export class TileGame {
  /**
   * @param {{ audio, canvas, songId?:number, lap?:object, onEnd:(r)=>void, onLap?:(laps:number)=>void,
   *           maxLaps?:number, skin?:object, vs?:{ name:string, other:()=>({score,lives,done}|null), onLive?:(live)=>void } }} o
   *   lap 을 주면 그걸로 (유저 맵 타일), 아니면 songId 의 곡
   */
  constructor({ audio, canvas, songId = 0, lap = null, onEnd, onLap, maxLaps = MAX_LAPS, vs = null, skin = null, hue = null }) {
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.songId = songId;
    this.onEnd = onEnd;
    this.onLap = onLap;
    this.vs = vs;
    this.skin = skin || {};
    this.hue = hue ?? SONG_HUES[songId] ?? 220;
    this.hueRgb = hslRgb(this.hue, 60, 55).join(',');
    this.maxLaps = Math.max(1, Math.min(MAX_LAPS, maxLaps));
    this.lap = lap || tileLap(songId);
    // 혼자 치는 곡 = 서버 검사와 같은 코스 (코인 파티 포함). 대결은 파티 없이
    const solo = !lap && !vs && this.maxLaps === MAX_LAPS;
    this.course = solo ? tileCourse(songId) : buildCourse(this.lap, { laps: this.maxLaps, party: !vs });
    this.tempo = this.course.tempo;
    this.t0 = this.course.t0;
    this.u = this.lap.u;
    this.lapEnd = this.course.lapEnd;
    this.tiles = this.course.tiles.map((c) => ({ ...c }));
    this.partyRange = this.course.P ? this._partyRange() : null;
    this.music = this._musicEvents();
    this.row0 = this.tiles[0].row;
    this.hearts = TILE_HEARTS;
    this.score = 0;
    this.coins = 0;
    this.partyCoins = 0;
    this.shown = 0;
    this.coinShown = 0;
    this.hits = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missed = 0;
    this.wrong = 0;
    this.perfect = 0;
    this.lapsDone = 0;
    this.doneSong = 0;
    this.starsNow = 0;
    this.gemsNow = 0;
    this.head = 0;
    this.lastHit = [-9, -9, -9, -9];
    this.lastHurt = -9;
    this.hurtFx = null;
    this.press = new Float32Array(4);
    this.holds = [];
    this.fx = { bad: [], pop: [], lap: [], icon: [], judge: [], coin: [], ring: [], fly: [] };
    this.recent = [];
    this.state = 'ready';
    this.t = 0;
    this.taps = 0;
    this.drift = 0;
    this.mi = 0;
    this._onTouch = (e) => this._touch(e);
    this._onTouchEnd = (e) => this._touchEnd(e);
    this._onPointer = (e) => this._pointer(e);
    this._onPointerUp = (e) => this._release('p', e.pointerId);
    this._noop = (e) => {
      if (e.cancelable) e.preventDefault();
    };
  }

  _partyRange() {
    let a = -1;
    let b = -1;
    this.tiles.forEach((t, i) => {
      if (!t.coin) return;
      if (a < 0) a = i;
      b = i;
    });
    if (a < 0) return null;
    const sg = this.course.segs.find((s) => s.kind === 'party');
    const T = (abs) => this.tempo.stepTime(abs) - this.t0;
    return { a, b, t0: T(sg.bar0 * STEPS_PER_BAR), t1: T((sg.bar0 + sg.bars) * STEPS_PER_BAR) };
  }

  // ---------- 🎵 노래 (멜로디 + 왼손 반주) ----------
  /** 판 전체 소리 목록 (시각 순): 바퀴 = 곡 멜로디 + 쿵·짝 왼손, 코인 파티 = 반짝이는 펼친 화음 */
  _musicEvents() {
    const lap = this.lap;
    const T = (abs) => this.tempo.stepTime(abs) - this.t0;
    const ev = [];
    const chordsOf = (bar) =>
      String(lap.prog[bar % lap.bars] || 'C')
        .trim()
        .split(/\s+/)
        .map((p) => {
          try {
            return parseChord(p);
          } catch {
            return null;
          }
        });
    for (const sg of this.course.segs) {
      const a0 = sg.bar0 * STEPS_PER_BAR;
      const party = sg.kind === 'party';
      if (party) {
        // 🎉 코인 파티 (2026-11-27 '노래가 멈추고 축하 브금'): 곡과 다른 밝은 C 장조 — 쿵짝 + 반짝이 16분 + 환호
        const prog = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
        ev.push({ t: T(a0), sfx: 'cheer' });
        for (let b = 0; b < sg.bars; b++) {
          const ch = prog[b % prog.length];
          for (let e = 0; e < 16; e++) {
            const abs = a0 + b * STEPS_PER_BAR + e;
            const t = T(abs);
            const d = T(abs + 1) - t;
            if (e % 4 === 0) ev.push({ t, m: ch[0] - 24, d: d * 3.5, v: 0.6, bass: true });
            if (e % 8 === 4) for (const m of ch) ev.push({ t, m, d: d * 2, v: 0.32 });
            if (e % 2 === 0) ev.push({ t, hat: true, v: e % 4 === 0 ? 0.5 : 0.3 });
            ev.push({ t, glock: ch[[0, 1, 2, 1][e % 4]] + 12 + (e >= 8 ? 12 : 0), v: 0.8 });
          }
        }
        continue;
      }
      for (let b = 0; b < sg.bars; b++) {
        const chs = chordsOf(party ? b : b);
        const n = chs.length;
        const ab = a0 + b * STEPS_PER_BAR;
        for (let e = 0; e < 8; e++) {
          const beat = e >> 1;
          const ch = chs[Math.min(n - 1, Math.floor((beat * n) / 4))];
          if (!ch) continue;
          const abs = ab + e * 2;
          const t = T(abs);
          if (t < -0.02) continue;
          const d = T(abs + 2) - t;
          if (e % 2 === 0) {
            // 정박: 1·3박 = 낮은 음(뿌리·5도), 2·4박 = 화음
            if (beat % 2 === 0) ev.push({ t, m: ch.root - 24 + (beat === 2 && n === 1 ? 7 : 0), d: d * 3.6, v: 0.5, bass: true });
            else for (const m of ch.notes.slice(0, 3)) ev.push({ t, m: m - 12, d: d * 1.6, v: party ? 0.22 : 0.26 });
          }
        }
        if (!party)
          for (const nt of lap.notes) {
            if (nt.bar !== b) continue;
            const t = T(a0 + nt.at);
            if (t < -0.05) continue;
            ev.push({ t, m: nt.midi, d: Math.max(0.12, (T(a0 + nt.at + nt.len) - t) * 0.95), v: 0.9 });
          }
      }
    }
    ev.sort((x, y) => x.t - y.t);
    return ev;
  }

  _newBus() {
    const a = this.audio;
    if (!a.ctx) return null;
    try {
      if (this.bus) this.bus.disconnect();
    } catch {}
    this.bus = a.ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(a.musicBus);
    return this.bus;
  }
  /** 소리 끄기 (멈춤·끝): 예약해 둔 음까지 조용히 */
  _hush(fade = 0.12) {
    const b = this.bus;
    if (!b) return;
    this.bus = null;
    try {
      const now = this.audio.ctx.currentTime;
      b.gain.cancelScheduledValues(now);
      b.gain.setValueAtTime(b.gain.value, now);
      b.gain.linearRampToValueAtTime(0.0001, now + fade);
      setTimeout(() => {
        try {
          b.disconnect();
        } catch {}
      }, fade * 1000 + 120);
    } catch {}
  }
  /** 곡 시각 s 부터 소리 예약 다시 시작 */
  _musicFrom(s) {
    let lo = 0;
    let hi = this.music.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.music[m].t < s - 0.01) lo = m + 1;
      else hi = m;
    }
    this.mi = lo;
  }
  _schedule() {
    const a = this.audio;
    if (!this.bus || !a.ctx || this.aud0 == null) return;
    const now = a.ctx.currentTime;
    const ev = this.music;
    while (this.mi < ev.length && this.aud0 + ev[this.mi].t < now + LOOKAHEAD) {
      const e = ev[this.mi++];
      const at = this.aud0 + e.t;
      if (at < now - 0.03) continue;
      try {
        const tt = Math.max(at, now);
        if (e.sfx) a.sfxFile(e.sfx, 0.55);
        else if (e.hat) a.hat(tt, e.v, false, this.bus);
        else if (e.glock) a.glock(tt, e.glock, this.bus, e.v);
        else if (e.bass) a.pianoOr('bass', tt, e.m, e.d, this.bus, e.v);
        else a.pianoOr('lead', tt, e.m, e.d, this.bus, e.v);
      } catch {}
    }
  }

  // ---------- 시작·멈춤 ----------
  /** delay 가 있으면(대결) 그 초 뒤에 저절로 시작, 없으면 맨 아래 「시작」 타일을 누를 때 시작 */
  start(delay = 0) {
    this.audio.ensure();
    this.resize();
    const c = this.canvas;
    c.addEventListener('touchstart', this._onTouch, { passive: false });
    c.addEventListener('touchmove', this._noop, { passive: false });
    c.addEventListener('touchend', this._onTouchEnd, { passive: false });
    c.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    c.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    this.lastFrame = performance.now();
    if (this.vs && delay > 0) {
      this._begin(performance.now(), delay);
      this.state = 'playing';
    } else this.state = 'ready';
    this._loop();
    clearInterval(this.timer);
    this.timer = setInterval(() => this._schedule(), 50);
  }

  /** 곡 시각 from 이 지금(pn)에서 lead 초 뒤에 들리게 시계·소리 맞춤 */
  _begin(pn, lead = 0.04, from = 0) {
    const a = this.audio;
    const ctx = a.ctx;
    const heard = a.heardTime ? a.heardTime(pn) : ctx.currentTime;
    // 소리: 곡 시각 s 를 ctx 시각 aud0 + s 에 예약 → 귀에는 (출력 지연만큼) 뒤에 들림
    this.aud0 = ctx.currentTime + lead - from;
    const lag = Math.max(0, ctx.currentTime - heard);
    this.perf0 = pn + (lead + lag - from) * 1000;
    this.drift = 0;
    this._lastCtx = ctx.currentTime;
    this._lastCtxAt = pn;
    this._newBus();
    this._musicFrom(from);
    this._schedule();
  }

  _loop() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (this.state === 'stopped' || this.state === 'ended' || this.state === 'paused') return;
      this._tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'count') return false;
    if (this.state === 'playing') this.pausedT = this._time(performance.now());
    cancelAnimationFrame(this.raf);
    this.state = 'paused';
    this._hush(0.06);
    this.press.fill(0);
    this._endHolds();
    this._draw(this.pausedT, 0);
    return true;
  }

  /** 이어 하기: 화면은 멈춘 채 3·2·1 → 멈춘 자리부터 (노래도) */
  resume() {
    if (this.state !== 'paused') return;
    this.audio.ensure();
    this.state = 'count';
    this.countUntil = performance.now() + 1500;
    this.lastFrame = performance.now();
    this._loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    if (this.state !== 'ended') this.state = 'stopped';
    this._hush(0.2);
    const c = this.canvas;
    c.removeEventListener('touchstart', this._onTouch);
    c.removeEventListener('touchmove', this._noop);
    c.removeEventListener('touchend', this._onTouchEnd);
    c.removeEventListener('touchcancel', this._onTouchEnd);
    c.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * dpr);
    c.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layout();
    this._cache();
    if (this.state === 'paused' || this.state === 'ready') this._draw(this.state === 'paused' ? this.pausedT : 0, 0);
  }

  /** 스킨 그림(무대)이 늦게 받아졌을 때 다시 그려 둠 */
  refreshSkin() {
    if (!this.W) return;
    this._cache();
  }

  _layout() {
    const { W, H } = this;
    this.laneW = W / 4;
    this.rowH = H / TILE_ROWS; // ⚠ 모든 곡이 같은 타일 크기
    this.judgeY = H * JUDGE_AT;
    this.topNo = Math.max(44, H * 0.055); // 맨 위(일시정지 자리)는 터치 안 받음
    this.lookRows = (this.judgeY + 4) / this.rowH + 0.2;
    this.tapRows = (this.judgeY - this.topNo) / this.rowH;
  }

  /** 스킨: 콩 스킨 색이면 [main, light, dark] (줄마다), 아니면 null */
  _pal() {
    return null; // 2026-11-27 사용자 '색깔은 전부 검정' — 콩 스킨 색은 타일에 안 씀
  }
  get dark() {
    return !!(this.skin.img || this.skin.sky);
  }

  /** 크기가 바뀔 때 한 번만 그려 두는 그림 (배경·타일·코인 타일) */
  _cache() {
    const { W, H, dpr, laneW, rowH } = this;
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [c, g];
    };
    this.spr = {};
    const [bg, b] = mk(W, H);
    this._paintBg(b, W, H);
    // 줄 사이 가는 선
    b.fillStyle = this.dark ? 'rgba(255,255,255,0.4)' : 'rgba(60,50,100,0.12)';
    for (let i = 1; i < 4; i++) b.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 판정선: 옅은 띠 + 가는 선
    const jg = b.createLinearGradient(0, this.judgeY - 22, 0, this.judgeY + 22);
    const jc = this.dark ? '255,255,255' : `${this.hueRgb}`;
    jg.addColorStop(0, `rgba(${jc},0)`);
    jg.addColorStop(0.5, `rgba(${jc},${this.dark ? 0.28 : 0.16})`);
    jg.addColorStop(1, `rgba(${jc},0)`);
    b.fillStyle = jg;
    b.fillRect(0, this.judgeY - 22, W, 44);
    b.fillStyle = this.dark ? 'rgba(255,255,255,0.7)' : `rgba(${jc},0.45)`;
    b.fillRect(0, this.judgeY - 1, W, 2);
    this.spr.bg = bg;
    const tw = laneW - 1;
    const th = rowH;
    this.spr.tw = tw;
    this.spr.th = th;
    this.spr.tile = [0, 1, 2, 3].map((l) => {
      const [tc, t] = mk(tw, th);
      this._paintTile(t, tw, th, l);
      return tc;
    });
    // 긴 타일 윗부분 (줄 색 → 검정)
    this.spr.holdTop = [0, 1, 2, 3].map((l) => {
      const [hc, h] = mk(tw, th);
      const pal = this._pal(l);
      const gr = h.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, pal ? pal[1] : '#1e88e5');
      gr.addColorStop(0.55, pal ? pal[0] : '#0b4f8a');
      gr.addColorStop(1, pal ? pal[2] : '#000000');
      h.fillStyle = gr;
      h.fillRect(0, 0, tw, th);
      return hc;
    });
    // 🪙 코인 타일
    const [cc, c] = mk(tw, th);
    this._paintCoinTile(c, tw, th);
    this.spr.coin = cc;
    // 누른 줄 빛
    const [pc, p] = mk(laneW, H);
    const pg = p.createLinearGradient(0, 0, 0, H);
    pg.addColorStop(0, 'rgba(255,255,255,0)');
    pg.addColorStop(1, 'rgba(255,255,255,0.28)');
    p.fillStyle = pg;
    p.fillRect(0, 0, laneW, H);
    this.spr.press = pc;
  }

  /** 배경: 곡마다 다른 색 그라데이션 + 비스듬한 빛 조각 + 보케 / 스킨 무대 그림·하늘색이면 그걸 깔고 어둡게 */
  _paintBg(b, W, H) {
    const sk = this.skin;
    if (sk.img && sk.img.complete && sk.img.naturalWidth) {
      const iw = sk.img.naturalWidth;
      const ih = sk.img.naturalHeight;
      const s = Math.max(W / iw, H / ih);
      b.drawImage(sk.img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      b.fillStyle = `rgba(6,4,16,${sk.dim ?? 0.45})`;
      b.fillRect(0, 0, W, H);
      return;
    }
    if (sk.sky || sk.img) {
      const sky = sk.sky || ['#0A0814', '#14102A', '#221A40'];
      const gr = b.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, sky[0]);
      gr.addColorStop(0.55, sky[1]);
      gr.addColorStop(1, sky[2]);
      b.fillStyle = gr;
      b.fillRect(0, 0, W, H);
      b.fillStyle = 'rgba(6,4,16,0.25)';
      b.fillRect(0, 0, W, H);
      return;
    }
    // 2026-11-27 사용자 '배경 깔끔하게': 흰 바탕 + 곡 색이 아주 옅게 (무늬 없음)
    const h = this.hue;
    const gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.6, `hsl(${h},60%,97%)`);
    gr.addColorStop(1, `hsl(${h},70%,92%)`);
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);
  }

  /** 타일 한 장 (기본 = 검은 타일, 스킨 = 그 색) */
  _paintTile(t, tw, th) {
    // 전부 검정 (2026-11-27), 위쪽만 살짝 빛
    const g = t.createLinearGradient(0, 0, 0, th);
    g.addColorStop(0, '#2a2a33');
    g.addColorStop(0.16, '#08080b');
    g.addColorStop(1, '#000000');
    t.fillStyle = g;
    t.fillRect(0, 0, tw, th);
  }

  /** 🪙 코인 타일: 금빛 타일 + 가운데 흰 동그라미 속 우리 코인 */
  _paintCoinTile(t, tw, th) {
    const g = t.createLinearGradient(0, 0, tw, th);
    g.addColorStop(0, '#ffe066');
    g.addColorStop(0.5, '#ffc42e');
    g.addColorStop(1, '#ffab0f');
    t.fillStyle = g;
    t.fillRect(0, 0, tw, th);
    // 비스듬한 빛
    t.save();
    t.beginPath();
    t.moveTo(0, th * 0.75);
    t.lineTo(tw * 0.55, 0);
    t.lineTo(tw, 0);
    t.lineTo(tw, th * 0.1);
    t.lineTo(0, th);
    t.closePath();
    t.fillStyle = 'rgba(255,255,255,0.16)';
    t.fill();
    t.restore();
    const r = Math.min(tw, th) * 0.26;
    t.shadowColor = 'rgba(160,90,0,0.45)';
    t.shadowBlur = 8;
    t.shadowOffsetY = 3;
    t.fillStyle = '#fffaf0';
    t.beginPath();
    t.arc(tw / 2, th / 2, r, 0, Math.PI * 2);
    t.fill();
    t.shadowColor = 'transparent';
    coin(t, tw / 2, th / 2, r * 0.62);
  }

  /** 곡 시각 (performance.now 기준 + 소리 시계로 조금씩 당긴 값) */
  _time(pn) {
    return this.perf0 == null ? 0 : (pn - this.perf0) / 1000 + this.drift;
  }
  /** 곡 시각 → 지금 줄 위치 */
  _rowAt(t) {
    return (this.tempo.barAt(t + this.t0) * STEPS_PER_BAR) / this.u;
  }
  /** 소리 시계(귀에 들리는 곡 시각)로 화면 시계를 살짝 당김. 소리 시계가 멈춘 폰은 화면 시계로 그대로 */
  _syncClock(pn) {
    const a = this.audio;
    const ctx = a.ctx;
    if (!ctx || this.aud0 == null || ctx.state !== 'running') return;
    if (ctx.currentTime !== this._lastCtx) {
      this._lastCtx = ctx.currentTime;
      this._lastCtxAt = pn;
    } else if (pn - this._lastCtxAt > 300) return;
    const heard = (a.heardTime ? a.heardTime(pn) : ctx.currentTime) - this.aud0;
    const vis = (pn - this.perf0) / 1000;
    const want = heard - vis;
    if (Math.abs(want - this.drift) > 0.25) this.drift = want;
    else this.drift += (want - this.drift) * 0.05;
  }

  // ---------- 입력 ----------
  _touch(e) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) {
      try {
        this._press(t.clientX, t.clientY, e.timeStamp, 't', t.identifier);
      } catch {}
    }
  }
  _touchEnd(e) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) this._release('t', t.identifier);
  }
  _pointer(e) {
    if (e.cancelable) e.preventDefault();
    this._press(e.clientX, e.clientY, e.timeStamp, 'p', e.pointerId);
  }

  _press(cx, cy, ts, src, id) {
    if (this.state !== 'playing' && this.state !== 'ready') return;
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left) * (r.width ? this.W / r.width : 1);
    const y = (cy - r.top) * (r.height ? this.H / r.height : 1);
    const pn = performance.now();
    // touchstart 와 pointerdown 이 같은 손가락으로 둘 다 오면 한 번만
    if (this.recent.length > 8) this.recent = this.recent.filter((p) => pn - p.at < 120);
    for (const p of this.recent) if (pn - p.at < 80 && Math.abs(p.x - x) < 24 && Math.abs(p.y - y) < 24) return;
    this.recent.push({ x, y, at: pn });
    if (y < this.topNo) return;
    const lane = clamp(Math.floor(x / this.laneW), 0, 3);
    const tsOk = ts > 0 && Math.abs(pn - ts) < 300 ? ts : pn;
    // 「시작」 타일 → 노래 시작
    if (this.state === 'ready') {
      const first = this.tiles[0];
      if (lane !== first.lane) return;
      this.audio.ensure();
      this._begin(pn, 0.03);
      this.state = 'playing';
      this.lastFrame = pn;
      this._hit(first, 0, x, y, src, id);
      return;
    }
    const t = this._time(tsOk);
    if (t < 0) return; // 대결: 아직 시작 전
    const cur = this._rowAt(t);
    this.taps++;
    this.press[lane] = 1;
    // 🪙 코인 타일: 보이는 것 중 누른 자리에 있는 것 (차례 없음)
    const coinTile = this._coinAt(lane, y, cur);
    if (coinTile) return this._coin(coinTile, t, x, y);
    // 칠 타일: 아직 안 친 노래 타일 중 가장 아래 두 개 (두 번째는 첫 번째와 한 줄 안으로 붙어 있을 때만)
    let a = null;
    let b = null;
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (tl.hit || tl.miss || tl.coin) continue;
      if (!a) a = tl;
      else {
        b = tl;
        break;
      }
    }
    const visible = (tl) => tl && tl.row - cur < this.tapRows;
    if (a && a.lane === lane && visible(a)) return this._hit(a, t, x, y, src, id);
    if (b && b.lane === lane && visible(b) && b.row - a.row <= 1.01) return this._hit(b, t, x, y, src, id);
    // 코인 파티 중엔 빈 칸을 눌러도 벌 없음
    if (this._inParty(t)) return this.fx.bad.push({ lane, at: t, y, soft: true });
    // 방금 이 줄을 쳤음(튕김) · 꾹 누르는 중인 긴 타일 줄 · 그 자리에 아직 칠 차례가 아닌 타일이 있음 → 그냥 넘어감
    if (t - this.lastHit[lane] < BOUNCE_SEC) return;
    if (this.holds.some((h) => h.tile.lane === lane)) return;
    if (this._tileUnder(lane, y, cur)) return;
    this._wrong(lane, t, x, y);
  }

  _inParty(t) {
    const p = this.partyRange;
    return !!p && t >= p.t0 - 0.3 && t <= p.t1 + 0.2;
  }

  _coinAt(lane, y, cur) {
    const p = this.partyRange;
    if (!p) return null;
    for (let i = Math.max(this.head, p.a); i <= p.b; i++) {
      const tl = this.tiles[i];
      if (tl.lane !== lane || tl.hit || tl.miss) continue;
      const d = tl.row - cur;
      if (d > this.lookRows) break;
      const yb = this.judgeY - d * this.rowH;
      if (y <= yb + this.rowH * 0.3 && y >= yb - this.rowH * 1.3) return tl;
    }
    return null;
  }

  /** 그 자리에 보이는 (아직 안 친) 타일이 있나 — 차례가 아닌 타일을 누른 건 벌 안 줌 */
  _tileUnder(lane, y, cur) {
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.row - cur;
      if (d > this.lookRows) break;
      if (tl.lane !== lane || tl.hit || tl.miss) continue;
      const yb = this.judgeY - d * this.rowH;
      if (y <= yb + 4 && y >= yb - tl.rows * this.rowH - 4) return true;
    }
    return false;
  }

  _hit(tl, t, x, y, src, id) {
    tl.hit = true;
    tl.hitAt = t;
    // 판정 (2026-11-27 사용자 '선에서 맞게 치는데 왜 PERFECT 가 안 떠'): 시각이 아니라 자리로 —
    //   타일이 판정선에 걸쳐 있으면(아래 끝이 선 조금 위 ~ 위 끝이 선에 닿을 때) PERFECT
    const d = this._rowAt(t) - tl.row; // 0 = 아래 끝이 선, 1 = 한 줄 지나감
    const top = tl.hold ? 1 : tl.rows;
    const word = d >= -0.35 && d <= top + 0.15 ? 'perfect' : d >= -0.85 && d <= top + 0.45 ? 'great' : 'good';
    // 콤보는 PERFECT 만 쌓임 (2026-11-27 사용자)
    if (word === 'perfect') {
      this.combo++;
      this.perfect++;
    } else this.combo = 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += tilePoints(word, this.combo);
    this.coins += 1;
    this.hits++;
    this.lastHit[tl.lane] = t;
    this.press[tl.lane] = 1;
    this.comboAt = t;
    this.fx.judge.push({ at: t, word: word.toUpperCase(), n: this.combo });
    this.fx.ring.push({ at: t, lane: tl.lane, row: tl.row });
    // 🪙 드럼처럼 코인이 튀어 올라 오른쪽 위 코인 칸으로 쏙
    this.fx.fly.push({ at: t, x: (tl.lane + 0.5) * this.laneW, y: Math.min(this.judgeY, y) });
    if (tl.hold) {
      this.holds.push({ tile: tl, src, id, at: t });
      tl.fill = 0;
    }
  }

  _coin(tl, t, x, y) {
    tl.hit = true;
    tl.hitAt = t;
    this.coins += 1;
    this.partyCoins += 1;
    this.lastHit[tl.lane] = t;
    this.fx.coin.push({ at: t, x: (tl.lane + 0.5) * this.laneW, y });
    this.fx.fly.push({ at: t, x: (tl.lane + 0.5) * this.laneW, y });
    try {
      const a = this.audio;
      a.glock(a.ctx.currentTime, [84, 86, 88, 91, 93, 96][this.partyCoins % 6], a.sfxBus, 1.8);
    } catch {}
  }

  /** 손가락을 뗌 → 그 손가락이 누르던 긴 타일 끝 */
  _release(src, id) {
    for (const h of this.holds.slice()) if (h.src === src && h.id === id) this._holdDone(h, false);
  }
  _endHolds() {
    for (const h of this.holds.slice()) this._holdDone(h, false);
  }
  _holdDone(h, full) {
    const i = this.holds.indexOf(h);
    if (i < 0) return;
    this.holds.splice(i, 1);
    const tl = h.tile;
    const p = full ? 1 : tl.fill || 0;
    const bonus = full ? tl.rows - 1 : Math.max(0, Math.min(tl.rows - 1, Math.floor(p * tl.rows + 1e-6) - 1));
    tl.done = true;
    tl.fill = p;
    if (bonus > 0) {
      this.score += bonus * HOLD_PTS;
      this.coins += bonus;
      this.fx.pop.push({ at: this.t, lane: tl.lane, v: bonus * HOLD_PTS, tile: tl });
    }
  }

  _wrong(lane, t, x, y) {
    this.fx.bad.push({ lane, at: t, y });
    if (t - this.lastHurt < GRACE_SEC) return;
    this.wrong++;
    this.combo = 0;
    this._hurt(t, lane);
  }

  _miss(tl, t) {
    tl.miss = true;
    tl.missAt = t;
    this.missed++;
    this.combo = 0;
    this._hurt(t, tl.lane, tl);
  }

  _hurt(t, lane, tl = null) {
    this.hearts--;
    this.lastHurt = t;
    this.hurtFx = { at: t, heart: this.hearts };
    try {
      if (this.audio.piano) this.audio.pianoNote(this.audio.ctx.currentTime, 40, 0.25, 0.4, this.audio.sfxBus);
    } catch {}
    if (this.hearts <= 0) this._die(t, tl);
  }

  _die(t, tl) {
    this.state = 'dying';
    this.diedAt = t;
    this.diedPerf = performance.now();
    this.failTile = tl;
    this._endHolds();
    this._hush(0.35);
    try {
      this.audio.aww();
    } catch {}
  }

  result() {
    const frac = Math.max(0, Math.min(1, this.doneSong / Math.max(1, this.lapEnd[0])));
    const { stars, gems } = lapStars(this.lapsDone, frac);
    return {
      songId: this.songId,
      tiles: this.score,
      coins: this.coins,
      partyCoins: this.partyCoins,
      hits: this.hits,
      perfect: this.perfect,
      laps: this.lapsDone,
      stars,
      gems,
      maxCombo: this.maxCombo,
      missed: this.missed,
      wrong: this.wrong,
      per: this.lapEnd[0],
      complete: this.lapsDone >= this.maxLaps,
      died: this.hearts <= 0,
    };
  }

  /** 대결: 상대에게 보낼 지금 상태 */
  live() {
    return { score: this.score, combo: this.combo, progress: Math.min(1, this.doneSong / Math.max(1, this.lapEnd[this.lapEnd.length - 1])), lives: Math.max(0, this.hearts) };
  }

  // ---------- 매 화면 ----------
  _tick() {
    const pn = performance.now();
    const dt = Math.min(0.05, (pn - this.lastFrame) / 1000);
    this.lastFrame = pn;
    if (this.state === 'ready') return this._draw(0, dt);
    if (this.state === 'count') {
      if (pn >= this.countUntil) {
        // 멈춘 자리부터 노래도 같이 (3·2·1 동안 준비)
        this._begin(pn, 0.04, this.pausedT);
        this.state = 'playing';
      } else return this._draw(this.pausedT, dt);
    }
    if (this.state === 'dying') {
      this._draw(this.diedAt, dt, true);
      if (pn - this.diedPerf > 1300) this._finish();
      return;
    }
    this._syncClock(pn);
    this._schedule();
    const t = this._time(pn);
    this.t = t;
    const cur = this._rowAt(t);
    if (t > 0) {
      // 지나간 타일 = 놓침 (바로 전 화면 시각으로 — 폰이 버벅인 뒤 밀린 터치가 먼저 처리되게). 코인 타일은 그냥 사라짐
      const prev = this._curPrev ?? cur;
      this._curPrev = cur;
      for (let i = this.head; i < this.tiles.length && this.state === 'playing'; i++) {
        const tl = this.tiles[i];
        if (prev - tl.row <= GONE_ROWS) break;
        if (tl.hit || tl.miss) continue;
        if (tl.coin) tl.miss = true;
        else this._miss(tl, t);
      }
    }
    // 꾹 누르는 긴 타일: 판정선을 지난 만큼 차오름
    for (const h of this.holds.slice()) {
      const tl = h.tile;
      const p = clamp((cur - tl.row) / tl.rows, 0, 1);
      tl.fill = Math.max(tl.fill || 0, p);
      if (p >= 0.93) this._holdDone(h, true);
    }
    while (this.head < this.tiles.length && (this.tiles[this.head].hit || this.tiles[this.head].miss)) {
      if (!this.tiles[this.head].coin) this.doneSong++;
      this.head++;
    }
    // 별(첫 바퀴): 1/3 · 2/3 지날 때 하나씩
    if (this.state === 'playing' && this.lapsDone === 0) {
      const st = lapStars(0, this.doneSong / Math.max(1, this.lapEnd[0])).stars;
      while (this.starsNow < st) this.fx.icon.push({ at: t, i: this.starsNow++, gem: false });
    }
    // 바퀴 다 돎 → 셋째 별 / 다이아 하나 (빨라진 곡을 끝낼 때마다) · 하트 회복 · 다음 바퀴 더 빠르게
    while (this.state === 'playing' && this.lapsDone < this.maxLaps && this.doneSong >= this.lapEnd[this.lapsDone]) {
      this.lapsDone++;
      if (this.lapsDone === 1) while (this.starsNow < 3) this.fx.icon.push({ at: t, i: this.starsNow++, gem: false });
      const gems = lapStars(this.lapsDone).gems;
      while (this.gemsNow < gems) this.fx.icon.push({ at: t, i: this.gemsNow++, gem: true });
      if (this.hearts < TILE_HEARTS) {
        this.hearts++;
        this.hurtFx = { at: t, heal: true, heart: this.hearts - 1 };
      }
      this.fx.lap.push({ at: t, v: this.lapsDone });
      // 🪙 코인 파티 알림은 '별 3개' 글자가 사라진 뒤에 (겹치지 않게)
      if (this.lapsDone === 1 && this.partyRange) this.partyAt = Math.max(this.partyRange.t0 - 0.2, t + 1.4);
      try {
        this.audio.fanfare();
      } catch {}
      if (this.onLap) this.onLap(this.lapsDone);
      if (this.lapsDone >= this.maxLaps) {
        this.state = 'dying';
        this.diedAt = t;
        this.diedPerf = performance.now();
        this.complete = true;
        this._endHolds();
      }
    }
    if (this.vs && this.vs.onLive && pn - (this._liveAt || 0) > 250) {
      this._liveAt = pn;
      try {
        this.vs.onLive(this.live());
      } catch {}
    }
    this._draw(t, dt);
  }

  _finish() {
    this.stop();
    this.state = 'ended';
    if (this.onEnd) this.onEnd(this.result());
  }

  _draw(t, dt = 0, frozen = false) {
    this.cur = this._rowAt(t);
    this.shown += (this.score - this.shown) * Math.min(1, dt * 14);
    if (Math.abs(this.score - this.shown) < 0.5) this.shown = this.score;
    this.coinShown += (this.coins - this.coinShown) * Math.min(1, dt * 12);
    if (Math.abs(this.coins - this.coinShown) < 0.5) this.coinShown = this.coins;
    for (let i = 0; i < 4; i++) this.press[i] = Math.max(0, this.press[i] - dt * 6);
    this.realT = performance.now() / 1000;
    const g = this.g;
    g.save();
    const hf = this.hurtFx && !this.hurtFx.heal ? this.hurtFx : null;
    const hk = hf ? 1 - (t - hf.at) / 0.3 : 0;
    if (hk > 0 && !frozen) g.translate(Math.sin(t * 90) * 4 * hk, 0);
    this._drawTiles(g, t);
    this._drawEdge(g, t);
    this._drawHud(g, t);
    this._drawJudge(g, t);
    this._drawCount(g, t);
    this._drawLapFx(g, t);
    if (frozen) this._drawDying(g);
    g.restore();
    // 지난 효과 치우기 (가끔만)
    if (++this._gc > 30) {
      this._gc = 0;
      const old = t - 2.4;
      for (const k of Object.keys(this.fx)) if (this.fx[k].length) this.fx[k] = this.fx[k].filter((f) => f.at > old);
    }
  }

  _drawTiles(g, t) {
    const { W, H, laneW, rowH, judgeY } = this;
    const S = this.spr;
    g.drawImage(S.bg, 0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const a = this.press[i];
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.drawImage(S.press, i * laneW, 0, laneW, H);
    }
    g.globalAlpha = 1;
    // 빈 칸 누름 = 그 칸 빨갛게 (코인 파티 중엔 옅게)
    for (const b of this.fx.bad) {
      const a = 1 - ease((t - b.at) / 0.45);
      if (a <= 0) continue;
      g.fillStyle = b.soft ? `rgba(255,255,255,${0.3 * a})` : `rgba(255,60,80,${0.6 * a})`;
      g.fillRect(b.lane * laneW + 1, b.y - rowH / 2, laneW - 2, rowH);
    }
    const cur = this.cur;
    const tw = S.tw;
    const ready = this.state === 'ready';
    for (let i = Math.max(0, this.head - 12); i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      const d = tl.row - cur;
      if (d > this.lookRows) break;
      const yb = judgeY - d * rowH;
      const th = tl.rows * rowH;
      const y = yb - th;
      if (y > H + 4) continue;
      const x = tl.lane * laneW + 0.5;
      if (tl.miss) {
        if (tl.coin) continue;
        const fail = tl === this.failTile;
        const a = fail ? 0.6 + 0.4 * Math.sin(this.realT * 20) : 1 - ease((t - tl.missAt) / 0.8);
        if (a <= 0) continue;
        g.globalAlpha = a;
        g.fillStyle = '#ff3b52';
        g.fillRect(x, y, tw, th);
        g.globalAlpha = 1;
        continue;
      }
      if (tl.coin) {
        if (tl.hit) {
          const k = (t - tl.hitAt) / 0.25;
          if (k >= 1) continue;
          g.globalAlpha = 1 - k;
          const s = 1 + 0.15 * k;
          g.drawImage(S.coin, x + (tw * (1 - s)) / 2, y + (th * (1 - s)) / 2, tw * s, th * s);
          g.globalAlpha = 1;
          continue;
        }
        g.drawImage(S.coin, x, y, tw, S.th);
        continue;
      }
      if (tl.hold) {
        this._drawHold(g, tl, x, y, tw, th, yb);
        continue;
      }
      if (tl.hit) {
        // 친 타일: 옅게 남아 내려감
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x, y, tw, th);
        continue;
      }
      g.drawImage(S.tile[tl.lane], x, y, tw, S.th);
    }
    // 「시작」 (첫 타일이 긴 타일이어도)
    if (ready) {
      const f = this.tiles[0];
      const yb = judgeY - (f.row - cur) * rowH;
      const pulse = 1 + 0.06 * Math.sin(this.realT * 6);
      g.save();
      g.translate((f.lane + 0.5) * laneW, f.hold ? yb - f.rows * rowH * 0.55 : yb - rowH / 2);
      g.scale(pulse, pulse);
      g.font = font(Math.min(30, laneW * 0.28));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText('시작', 0, 0);
      g.restore();
    }
    // 친 자리 빛 고리
    for (const r of this.fx.ring) {
      const k = (t - r.at) / 0.35;
      if (k < 0 || k > 1) continue;
      const cx = (r.lane + 0.5) * laneW;
      const cy = judgeY - (r.row - cur) * rowH - rowH / 2;
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath();
      g.arc(cx, cy, laneW * (0.2 + 0.35 * ease(k)), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    // 🪙 코인 튀어 오름
    for (const c of this.fx.coin) {
      const k = (t - c.at) / 0.6;
      if (k < 0 || k > 1) continue;
      g.globalAlpha = 1 - k * k;
      coin(g, c.x, c.y - 70 * ease(k), 11 * (1 - 0.3 * k));
      g.font = bold(16);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#e08a00';
      g.fillText('+1', c.x + 22, c.y - 70 * ease(k) - 6);
      g.globalAlpha = 1;
    }
    // 긴 타일 끝까지 눌렀을 때 +N
    for (const p of this.fx.pop) {
      const k = (t - p.at) / 0.8;
      if (k < 0 || k > 1) continue;
      g.globalAlpha = 1 - ease(k);
      g.font = bold(Math.min(34, laneW * 0.32));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const yy = H * 0.72 - k * 40;
      g.fillStyle = HOLD_BLUE;
      g.shadowColor = 'rgba(0,40,80,0.35)';
      g.shadowBlur = 6;
      g.fillText(`+${p.v}`, (p.lane + 0.5) * laneW, yy);
      g.shadowColor = 'transparent';
      g.globalAlpha = 1;
    }
  }

  /** 긴 타일 (2026-11-27 '꾹 누르는 건 못생기고 못 알아보겠어'): 검정 몸통 + 가운데 흰 점선 + 아래 흰 고리 속 「꾹」,
   *   누르면 아래부터 판정선까지 하늘색으로 차오르고 고리가 빛남 */
  _drawHold(g, tl, x, y, w, h, yb) {
    const done = tl.done || (tl.hit && !this.holds.some((q) => q.tile === tl));
    const holding = tl.hit && !done;
    g.globalAlpha = done ? 0.3 : 1;
    g.fillStyle = '#000';
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(x, y, w, Math.max(3, this.rowH * 0.06));
    const cx = x + w / 2;
    const R = Math.min(w * 0.2, this.rowH * 0.2);
    const ry = yb - this.rowH * 0.42;
    // 차오른 만큼 (아래부터)
    const f = tl.fill || 0;
    if (tl.hit && f > 0) {
      const fh = Math.min(h, Math.max(0, h * f));
      const gg = g.createLinearGradient(0, yb - fh, 0, yb);
      gg.addColorStop(0, '#9be9ff');
      gg.addColorStop(1, '#2fb8ff');
      g.fillStyle = gg;
      g.fillRect(x, yb - fh, w, fh);
      if (holding) {
        g.fillStyle = '#ffffff';
        g.fillRect(x, yb - fh - 2, w, 4);
      }
    }
    // 가운데 점선 (위 끝까지)
    g.fillStyle = holding ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
    const dot = Math.max(5, this.rowH * 0.06);
    for (let yy = ry - R - dot * 1.6; yy > y + dot; yy -= dot * 2) g.fillRect(cx - 1.5, yy - dot, 3, dot);
    // 아래 고리 + 「꾹」
    g.lineWidth = Math.max(2.5, R * 0.16);
    g.strokeStyle = '#ffffff';
    if (holding) {
      g.shadowColor = '#7fe0ff';
      g.shadowBlur = 16;
    }
    g.beginPath();
    g.arc(cx, ry, R * (holding ? 1.12 + 0.06 * Math.sin(this.realT * 14) : 1), 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
    g.font = font(R * 0.95);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText('꾹', cx, ry + R * 0.05);
    g.globalAlpha = 1;
  }

  // ======== 위 정보 (진행 줄 · 별/다이아 · 점수 · 코인 · 하트) ========
  _drawHud(g, t) {
    const { W, H } = this;
    const dark = this.dark;
    const ink = dark ? '#ffffff' : '#2b2440';
    // 진행 줄: 첫 바퀴 = 별 3개(1/3·2/3·끝), 그 뒤 = 다이아 3개(빨라진 곡 하나 끝낼 때마다 하나), 코인 파티 = 금빛
    const by = Math.max(30, H * 0.062);
    const x0 = W * 0.2;
    const x1 = W * 0.8;
    const party = this.state === 'playing' && this._inParty(t) && this.lapsDone === 1;
    const gems = this.lapsDone >= 1;
    let p = 0;
    if (this.state !== 'ready') {
      if (party && this.partyRange) p = clamp((t - this.partyRange.t0) / (this.partyRange.t1 - this.partyRange.t0), 0, 1);
      else if (!gems) p = clamp(this.doneSong / Math.max(1, this.lapEnd[0]), 0, 1);
      else {
        const k = Math.min(this.lapsDone, this.lapEnd.length - 1);
        const lapP = clamp((this.doneSong - this.lapEnd[k - 1]) / Math.max(1, this.lapEnd[k] - this.lapEnd[k - 1]), 0, 1);
        p = clamp((this.lapsDone - 1 + (this.lapsDone >= this.maxLaps ? 0 : lapP)) / Math.max(1, Math.min(3, this.maxLaps - 1)), 0, 1);
      }
    }
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(60,50,100,0.15)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x0, by);
    g.lineTo(x1, by);
    g.stroke();
    const fg = g.createLinearGradient(x0, 0, x1, 0);
    fg.addColorStop(0, party ? '#ffe066' : gems ? '#8fe3ff' : '#ffe08a');
    fg.addColorStop(1, party ? '#ff9f0a' : gems ? '#2f9bff' : '#ffb320');
    g.strokeStyle = fg;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x0, by);
    g.lineTo(x0 + (x1 - x0) * p, by);
    g.stroke();
    g.fillStyle = dark ? '#fff' : '#ffb320';
    g.beginPath();
    g.arc(x0, by, 5, 0, Math.PI * 2);
    g.fill();
    for (let i = 1; i <= 3; i++) {
      const x = x0 + ((x1 - x0) * i) / 3;
      const on = i <= (gems ? this.gemsNow : this.starsNow);
      const ev = this.fx.icon.find((f) => f.gem === gems && f.i === i - 1);
      const kk = ev ? clamp((t - ev.at) / 0.4, 0, 1) : 1;
      const sc = on && kk < 1 ? 1 + 0.8 * Math.sin(kk * Math.PI) : 1;
      const r = Math.max(10, W * 0.034) * sc;
      if (party) coin(g, x, by, r * 0.8);
      else if (!gems) star(g, x, by, r, on ? '#ffd23f' : dark ? 'rgba(255,255,255,0.85)' : '#ffffff', on ? '#e89a00' : dark ? null : 'rgba(60,50,100,0.35)');
      else if (on) gem(g, x, by, r * 0.92);
      else gemOutline(g, x, by, r * 0.92, dark);
    }
    g.restore();
    // 점수 (가운데 위, 드럼처럼 큰 숫자)
    const sTxt = Math.round(this.shown).toLocaleString();
    const pop = this.comboAt != null ? 1 + 0.08 * (1 - ease((t - this.comboAt) / 0.15)) : 1;
    g.save();
    g.translate(W / 2, by + Math.max(16, H * 0.02));
    g.scale(pop, pop);
    g.font = bold(Math.min(48, W * 0.12));
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = dark ? 'rgba(10,8,30,0.7)' : '#ffffff';
    g.strokeText(sTxt, 0, 0);
    g.fillStyle = ink;
    g.fillText(sTxt, 0, 0);
    g.restore();
    // 🪙 코인 (오른쪽, 일시정지 버튼 밑) — 코인이 날아와 쌓이면 톡 커짐
    const cy = Math.max(78, H * 0.105);
    this.coinAt = { x: W - 30, y: cy };
    const cTxt = Math.round(this.coinShown).toLocaleString();
    g.save();
    g.font = bold(Math.min(20, W * 0.05));
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const tw = g.measureText(cTxt).width;
    const bx = W - 14 - tw - 30;
    g.fillStyle = dark ? 'rgba(20,10,50,0.45)' : 'rgba(43,36,64,0.85)';
    rr(g, bx - 6, cy - 15, tw + 44, 30, 15);
    g.fill();
    const lastLand = this.fx.fly.length ? this.fx.fly[this.fx.fly.length - 1].at + FLY_SEC : -9;
    const cb = t - lastLand >= 0 && t - lastLand < 0.15 ? 1.3 : 1;
    coin(g, bx + 12, cy, 10 * cb);
    g.fillStyle = '#fff';
    g.fillText(cTxt, W - 14, cy + 1);
    g.restore();
    this.coinAt = { x: bx + 12, y: cy };
    // 하트 (왼쪽)
    const hs = Math.min(20, W * 0.05);
    for (let i = 0; i < TILE_HEARTS; i++) {
      const on = i < this.hearts;
      const ev = this.hurtFx && this.hurtFx.heart === i ? this.hurtFx : null;
      let sz = 1;
      if (ev) {
        const k = (t - ev.at) / 0.45;
        if (k >= 0 && k < 1) sz = ev.heal ? 1 + 0.5 * (1 - ease(k)) : 1 + 0.35 * Math.sin(k * Math.PI);
      }
      heart(g, 18 + i * (hs + 6) + hs / 2, cy, hs * sz, on ? '#ff4d6d' : dark ? 'rgba(255,255,255,0.45)' : 'rgba(60,50,100,0.18)');
    }
    // 날아가는 코인 (치는 자리 → 오른쪽 위 코인 칸)
    for (const f of this.fx.fly) {
      const k = (t - f.at) / FLY_SEC;
      if (k < 0 || k > 1) continue;
      const e = ease(k);
      const tx = this.coinAt.x;
      const ty = this.coinAt.y;
      const x = f.x + (tx - f.x) * e;
      const y = f.y + (ty - f.y) * e - Math.sin(k * Math.PI) * 60;
      g.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
      coin(g, x, y, 9 - 3 * k);
      g.globalAlpha = 1;
    }
    if (this.vs) this._drawVs(g, cy + 24);
  }

  /** PERFECT × 연속 (점수 밑, 치는 순간 톡 튐) */
  _drawJudge(g, t) {
    const j = this.fx.judge[this.fx.judge.length - 1];
    if (!j) return;
    const k = (t - j.at) / 0.7;
    if (k < 0 || k > 1) return;
    const { W, H } = this;
    const y = Math.max(140, H * 0.215);
    const a = k > 0.7 ? (1 - k) / 0.3 : 1;
    const s = 0.75 + 0.35 * ease(k / 0.2) - 0.1 * ease((k - 0.2) / 0.8);
    g.save();
    g.globalAlpha = a;
    g.translate(W / 2, y);
    g.scale(s, s);
    const px = Math.min(40, W * 0.1);
    g.font = `italic ${bold(px)}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = g.measureText(j.word).width;
    const gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    if (j.word === 'PERFECT') {
      gr.addColorStop(0, '#d77bff');
      gr.addColorStop(0.5, '#ff7ab8');
      gr.addColorStop(1, '#ffab5e');
    } else if (j.word === 'GREAT') {
      gr.addColorStop(0, '#5ad1ff');
      gr.addColorStop(1, '#8a7dff');
    } else {
      gr.addColorStop(0, '#7be07b');
      gr.addColorStop(1, '#3fc5a0');
    }
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.strokeText(j.word, 0, 0);
    g.fillStyle = gr;
    g.fillText(j.word, 0, 0);
    if (j.n >= 2) {
      g.font = bold(px * 0.75);
      g.textAlign = 'left';
      g.lineWidth = 5;
      g.strokeStyle = this.dark ? 'rgba(80,40,120,0.35)' : '#ffffff';
      g.strokeText(`×${j.n}`, tw / 2 - px * 0.6, px * 0.75);
      g.fillStyle = this.dark ? '#ffffff' : '#6b3fd1';
      g.fillText(`×${j.n}`, tw / 2 - px * 0.6, px * 0.75);
    }
    g.restore();
  }

  /** ⚔️ 대결: 나 vs 상대 막대 */
  _drawVs(g, y) {
    const { W } = this;
    const o = (this.vs.other && this.vs.other()) || null;
    const mine = this.score;
    const theirs = o ? o.score || 0 : 0;
    const x0 = 18;
    const x1 = W - 18;
    const k = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
    g.fillStyle = '#ff7ab0';
    rr(g, x0, y, x1 - x0, 8, 4);
    g.fill();
    g.fillStyle = '#ffb84a';
    rr(g, x0, y, Math.max(8, (x1 - x0) * k), 8, 4);
    g.fill();
    g.font = font(13);
    g.textBaseline = 'top';
    g.fillStyle = this.dark ? '#fff' : '#2b2440';
    g.textAlign = 'left';
    g.fillText(`나 ${mine}`, x0, y + 11);
    g.textAlign = 'right';
    const nm = (this.vs.name || '상대').slice(0, 8);
    g.fillText(o && o.done ? `${nm} ${theirs} (끝)` : `${nm} ${theirs}${o && o.lives != null ? ' · ♥' + o.lives : ''}`, x1, y + 11);
  }

  /** 하트를 잃음: 화면 가장자리 빨갛게 */
  _drawEdge(g, t) {
    const hf = this.hurtFx && !this.hurtFx.heal ? this.hurtFx : null;
    if (!hf) return;
    const a = 1 - ease((t - hf.at) / 0.5);
    if (a <= 0) return;
    const { W, H } = this;
    const e = Math.min(W, H) * 0.05;
    g.fillStyle = `rgba(255,40,80,${0.35 * a})`;
    g.fillRect(0, 0, W, e);
    g.fillRect(0, H - e, W, e);
    g.fillRect(0, e, e, H - 2 * e);
    g.fillRect(W - e, e, e, H - 2 * e);
  }

  /** 바퀴를 돎: ★★★ / 다이아 3개 / 코인 파티 / 더 빨라져요 */
  _drawLapFx(g, t) {
    const { W, H } = this;
    const cy = H * 0.4;
    const shows = this.fx.lap.map((f) => ({ ...f }));
    // 코인 파티 시작 · 끝 알림
    if (this.partyRange && this.partyAt != null) {
      shows.push({ at: this.partyAt, party: 1 });
      shows.push({ at: Math.max(this.partyRange.t1 - 0.15, this.partyAt + 1.5), speed: 1 });
    }
    // 다이아 바퀴를 끝내면 1.5초 뒤 '더 빨라져요!' (마지막 바퀴 뒤엔 없음)
    for (const f of this.fx.lap) if (f.v >= 2 && f.v < this.maxLaps) shows.push({ at: f.at + 1.5, speed: 1 });
    for (const f of shows) {
      const k = (t - f.at) / 1.5;
      if (k < 0 || k > 1) continue;
      if ((f.party || f.speed) && (this.state === 'ready' || this.lapsDone < 1)) continue;
      if (f.speed && this.state !== 'playing') continue;
      const a = k < 0.12 ? k / 0.12 : k > 0.72 ? (1 - k) / 0.28 : 1;
      g.save();
      g.globalAlpha = a;
      // 반짝이 가루
      if (!f.speed) {
        let seed = Math.floor(f.at * 1000) || 3;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 16; i++) {
          const ang = rnd() * Math.PI * 2;
          const dist = (40 + rnd() * W * 0.45) * ease(k * 1.4);
          const x = W / 2 + Math.cos(ang) * dist;
          const y = cy + Math.sin(ang) * dist * 0.7 + 30 * k * k;
          g.fillStyle = this.dark ? 'rgba(255,255,255,0.9)' : i % 2 ? '#ffc23d' : '#8f6bff';
          g.fillRect(x - 3, y - 3, 6, 6);
        }
      }
      const s = 0.7 + 0.4 * ease(k / 0.25);
      g.translate(W / 2, cy);
      g.scale(s, s);
      const big = Math.min(46, W * 0.115);
      if (f.v === 1) for (let i = 0; i < 3; i++) star(g, (i - 1) * big * 1.3, -(i === 1 ? big * 0.3 : 0) - big * 0.5, big * 0.6, '#ffd23f', 'rgba(220,140,0,0.9)');
      else if (f.v >= 2) {
        const n = Math.min(3, f.v - 1);
        for (let i = 0; i < 3; i++) {
          const gx = (i - 1) * big * 1.3;
          const gy = -(i === 1 ? big * 0.3 : 0) - big * 0.5;
          if (i < n) gem(g, gx, gy, big * 0.55);
          else gemOutline(g, gx, gy, big * 0.55, this.dark);
        }
      }
      else if (f.party) for (let i = 0; i < 3; i++) coin(g, (i - 1) * big * 1.3, -(i === 1 ? big * 0.3 : 0) - big * 0.5, big * 0.5);
      const msg = f.party ? 'COIN PARTY!' : f.speed ? '더 빨라져요!' : f.v >= this.maxLaps ? 'COMPLETE!' : ['', 'EXCELLENT!', 'AMAZING!', 'FANTASTIC!'][f.v] || 'GREAT!';
      g.font = f.speed ? font(Math.min(34, W * 0.085)) : `italic ${bold(Math.min(40, W * 0.1))}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tw = g.measureText(msg).width;
      const gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      if (f.party) {
        gr.addColorStop(0, '#ffe066');
        gr.addColorStop(1, '#ff9f0a');
      } else {
        gr.addColorStop(0, '#b46bff');
        gr.addColorStop(1, '#2d8cff');
      }
      g.lineJoin = 'round';
      g.lineWidth = 7;
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.strokeText(msg, 0, big * 0.5);
      g.fillStyle = gr;
      g.fillText(msg, 0, big * 0.5);
      g.restore();
    }
  }

  _drawDying(g) {
    const { W, H } = this;
    const k = clamp((performance.now() - this.diedPerf) / 600, 0, 1);
    g.fillStyle = this.complete ? `rgba(255,250,240,${0.25 * k})` : `rgba(30,10,30,${0.3 * k})`;
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = k;
    g.font = font(Math.min(40, W * 0.1));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 7;
    const msg = this.complete ? '완주!' : '아쉬워요!';
    g.strokeStyle = 'rgba(10,8,20,0.85)';
    g.strokeText(msg, W / 2, H * 0.45);
    g.fillStyle = this.complete ? '#ffc23d' : '#ffffff';
    g.fillText(msg, W / 2, H * 0.45);
    g.restore();
  }

  /** 이어 하기 3·2·1 · 대결 시작 전 'VS 상대' */
  _drawCount(g, t) {
    const { W, H } = this;
    let left = null;
    if (this.state === 'count') left = (this.countUntil - performance.now()) / 1000;
    else if (this.vs && this.state === 'playing' && t < 0) {
      if (t < -3) {
        g.save();
        g.fillStyle = 'rgba(20,12,40,0.55)';
        g.fillRect(0, H * 0.3, W, H * 0.24);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font(Math.min(44, W * 0.11));
        g.fillStyle = '#ffd36b';
        g.fillText('VS', W / 2, H * 0.37);
        g.font = font(Math.min(26, W * 0.065));
        g.fillStyle = '#fff';
        g.fillText(this.vs.name || '상대', W / 2, H * 0.44);
        g.font = font(16);
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillText(`${Math.ceil(-t - 3)}초 뒤 같이 시작!`, W / 2, H * 0.5);
        g.restore();
        return;
      }
      left = -t * 0.5;
    }
    if (left == null || left <= 0) return;
    const total = 1.5;
    const k = Math.min(3, Math.ceil((left / total) * 3 - 0.001));
    const frac = (left / total) * 3 - (k - 1);
    const s = 0.85 + 0.25 * ease((1 - frac) * 3);
    const cx = W / 2;
    const cy = H * 0.42;
    const R = Math.min(W, H) * 0.13;
    g.save();
    g.globalAlpha = Math.min(1, frac * 2.5);
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = '#3b2a4a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#3b2a4a';
    g.font = font(R * 1.2 * s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(k), cx, cy + R * 0.06);
    g.restore();
  }
}
TileGame.prototype._gc = 0;

// ---------- 그리기 도우미 ----------
function hslRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function heart(g, cx, cy, s, color) {
  g.save();
  g.translate(cx, cy);
  g.scale(s / 24, s / 24);
  g.beginPath();
  g.moveTo(0, 8);
  g.bezierCurveTo(-14, -1, -10, -14, 0, -6);
  g.bezierCurveTo(10, -14, 14, -1, 0, 8);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}
/** 🪙 우리 코인 (금빛 동전 + 가운데 별) */
export function coin(g, cx, cy, r) {
  g.save();
  const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  gr.addColorStop(0, '#fff6c2');
  gr.addColorStop(0.45, '#ffd23f');
  gr.addColorStop(1, '#d99a00');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = Math.max(1.2, r * 0.16);
  g.strokeStyle = '#8a5a00';
  g.stroke();
  star(g, cx, cy + r * 0.03, r * 0.5, '#fff3b0', null);
  g.restore();
}
function star(g, cx, cy, r, color, edge) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = 1.5;
    g.stroke();
  }
}
/** 다이아 테두리 모양 */
function gemPath(g, cx, cy, r) {
  const top = cy - r * 0.62;
  const mid = cy - r * 0.12;
  const bot = cy + r * 0.9;
  const xw = r * 1.05;
  const xi = r * 0.45;
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx, bot);
  g.lineTo(cx - xw, mid);
  g.closePath();
}
/** ◇ 빈 다이아 (아직 못 받음): 테두리만 */
export function gemOutline(g, cx, cy, r, dark = false) {
  gemPath(g, cx, cy, r);
  g.fillStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(59,42,74,0.06)';
  g.fill();
  g.strokeStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(59,42,74,0.28)';
  g.lineWidth = Math.max(1, r * 0.14);
  g.lineJoin = 'round';
  g.stroke();
}
/** 💎 다이아몬드 (이모지 대신 직접 그림): 윗면·옆면 조각 + 반짝임 */
export function gem(g, cx, cy, r) {
  const top = cy - r * 0.62;
  const mid = cy - r * 0.12;
  const bot = cy + r * 0.9;
  const xw = r * 1.05;
  const xi = r * 0.45;
  g.beginPath();
  g.moveTo(cx - xw, mid);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx, bot);
  g.closePath();
  g.fillStyle = '#3aa8e8';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, mid);
  g.lineTo(cx + xi, mid);
  g.lineTo(cx, bot);
  g.closePath();
  g.fillStyle = '#7fd7ff';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx + xw, mid);
  g.lineTo(cx - xw, mid);
  g.closePath();
  g.fillStyle = '#a9e8ff';
  g.fill();
  g.beginPath();
  g.moveTo(cx - xi, top);
  g.lineTo(cx + xi, top);
  g.lineTo(cx, mid);
  g.closePath();
  g.fillStyle = '#e6f9ff';
  g.fill();
  gemPath(g, cx, cy, r);
  g.strokeStyle = '#1d6fa3';
  g.lineWidth = Math.max(1, r * 0.08);
  g.lineJoin = 'round';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx - r * 0.35, top + r * 0.2, r * 0.1, 0, Math.PI * 2);
  g.fill();
}
