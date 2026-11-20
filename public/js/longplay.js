// 🎭 장거리: 드럼이 아니라 엄지 하나로 멜로디를 따라가는 곡 (2026-11-20)
//   - 멜로디 음이 높낮이별 칸(왼쪽 낮은 음 → 오른쪽 높은 음)에 긴 띠로 내려옴
//   - 띠가 시작하는 곳(동그라미)에서 톡 누르고, 손을 떼지 말고 띠를 따라 좌우로 밀기
//   - 누르는 순간 = 판정(퍼펙트·그레이트·굿), 누르고 있는 동안 0.1초마다 '유지' 점수
//   반주는 오케스트라 샘플(현악·호른·튜바·팀파니)로 직접 연주. 노래(목소리)·녹음 파일은 안 씀
//   기록은 이 폰에만 (서버 요청 없음)

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 판정 범위(초) — 드럼보다 살짝 넉넉하게 (누르면서 자리도 맞춰야 해서)
const WIN = { perfect: 0.07, great: 0.13, good: 0.2 };
const POINTS = { perfect: 1000, great: 700, good: 400 };
const WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };
const TICK = 0.1; // 유지 판정 간격(초)
const TICK_POINTS = 60;
const SLIDE = 0.14; // 이어지는 음으로 넘어갈 때 미끄러지는 시간(초)

/** 화음 이름 → 구성음 (0 = 근음, 반음 단위) */
const CHORD = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10] };
const ROOT = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function chordTones(name) {
  const m = /^([A-G]#?)(m|7)?$/.exec(name);
  const root = ROOT[m[1]];
  return { root, tones: (CHORD[m[2] || ''] || CHORD['']).map((i) => (root + i) % 12) };
}

export const LONG_SONGS = [
  {
    id: 'nessun',
    name: '네순 도르마',
    sub: '공주는 잠 못 이루고',
    composer: '푸치니 · 투란도트',
    tagline: '오페라 하이라이트 · 길게 누르고 밀기',
    difficulty: 3,
    // [시작(초), 길이(초), 미디 음, 새로 누르기(1) / 이어서 밀기(0)]
    //   원곡 하이라이트("Dilegua, o notte!" ~ 마지막 "Vincerò!")의 멜로디 윤곽을 따서 정리 (곡은 1924년 작, 퍼블릭 도메인)
    notes: [
      [2.42, 0.46, 64, 1], [2.88, 0.97, 67, 0], [3.85, 3.52, 69, 0], [7.37, 2.67, 67, 0],
      [10.4, 0.21, 64, 1], [10.61, 1.85, 66, 0], [12.46, 1.71, 57, 0],
      [14.52, 1.62, 57, 1], [16.14, 1.46, 64, 0], [17.6, 0.4, 61, 0], [18.0, 1.08, 61, 0], [19.08, 0.23, 62, 0], [19.31, 0.24, 61, 0],
      [21.15, 0.68, 71, 1], [21.83, 1.36, 69, 0], [23.19, 0.59, 67, 0],
      [25.21, 1.04, 62, 1], [26.25, 4.65, 71, 0], [30.9, 4.82, 69, 0],
    ],
    // [시작(초), 화음] — 원곡 반주에서 읽은 화음 흐름 (멜로디와 어울리게 다듬음)
    chords: [
      [0, 'A'], [2.88, 'A7'], [3.85, 'F#m'], [7.37, 'Em'], [10.4, 'D'], [14.52, 'A'], [16.14, 'A7'], [19.6, 'G'], [30.9, 'D'],
    ],
    end: 37.6,
    // 팀파니 굴림(크레센도) 구간과 '쾅' 치는 곳
    rolls: [[28.4, 30.9], [34.2, 35.72]],
    booms: [2.42, 25.21, 30.9, 35.72],
  },
];

export const getLongSong = (id) => LONG_SONGS.find((s) => s.id === id) || null;

/** 곡 데이터 → 판정에 쓰는 형태 (칸 번호·구절·유지 판정 시각) */
function prepare(song) {
  const pitches = [...new Set(song.notes.map((n) => n[2]))].sort((a, b) => a - b);
  const notes = song.notes.map(([t, d, m, tap], i) => ({ i, t, d, m, tap: !!tap, col: pitches.indexOf(m) }));
  // 구절 = 새로 누르는 음부터 다음 누르는 음 전까지
  const phrases = [];
  for (const n of notes) {
    if (n.tap || !phrases.length) phrases.push({ start: n, notes: [], judged: false, result: null });
    phrases[phrases.length - 1].notes.push(n);
  }
  for (const p of phrases) {
    const last = p.notes[p.notes.length - 1];
    p.t0 = p.start.t;
    p.t1 = last.t + last.d;
  }
  // 유지 판정 시각: 구절 안에서 0.1초마다 (누르는 순간 바로 뒤부터, 끝 0.1초 전까지)
  const ticks = [];
  for (const p of phrases) for (let t = p.t0 + TICK; t < p.t1 - 0.05; t += TICK) ticks.push({ t, p, hit: null });
  return { pitches, notes, phrases, ticks };
}

/** 구절 p 에서 시각 t 의 목표 칸 (이어지는 음으로 넘어갈 땐 SLIDE 동안 미끄러짐) */
function targetCol(p, t) {
  const ns = p.notes;
  let k = 0;
  while (k < ns.length - 1 && t >= ns[k + 1].t) k++;
  const n = ns[k];
  if (k > 0 && t < n.t + SLIDE) {
    const a = ns[k - 1].col;
    const f = (t - n.t) / SLIDE;
    return a + (n.col - a) * Math.max(0, f);
  }
  return n.col;
}

export class LongGame {
  /**
   * @param {object} o
   * @param {import('./audio.js').AudioEngine} o.audio
   * @param {HTMLCanvasElement} o.canvas
   */
  constructor({ audio, canvas, song, onHud, onEnd, offsetMs = 0 }) {
    this.audio = audio;
    this.canvas = canvas;
    this.song = song;
    this.onHud = onHud || (() => {});
    this.onEnd = onEnd || (() => {});
    this.offset = offsetMs / 1000;
    Object.assign(this, prepare(song));
    this.state = 'idle';
    this.score = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.tickHit = 0;
    this.tickDone = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.pointer = null; // { id, x }
    this.fx = []; // 판정 글자
    this._loop = this._loop.bind(this);
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._resize = this._resize.bind(this);
  }

  // ---------------- 시작·멈춤 ----------------
  start() {
    const ctx = this.audio.ensure();
    this.audio.resetClock();
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.audio.musicBus);
    this.startTime = ctx.currentTime + 0.4;
    this._schedule();
    const c = this.canvas;
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    window.addEventListener('resize', this._resize);
    this._resize();
    this.state = 'playing';
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    this.pointer = null;
    this.audio.ctx.suspend().catch(() => {});
  }

  async resume() {
    if (this.state !== 'paused') return;
    await Promise.race([this.audio.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
    this.audio.resetClock();
    this.state = 'playing';
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this.state === 'stopped') return;
    const wasPaused = this.state === 'paused';
    this.state = 'stopped';
    cancelAnimationFrame(this._raf);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    window.removeEventListener('resize', this._resize);
    const ctx = this.audio.ctx;
    if (this.bus && ctx) {
      const bus = this.bus;
      try {
        bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      } catch {}
      setTimeout(() => {
        try {
          bus.disconnect();
        } catch {}
      }, 600);
    }
    if (wasPaused && ctx) ctx.resume().catch(() => {});
  }

  /** 곡 시각(초) */
  now(perfMs) {
    return this.audio.heardTime(perfMs) - this.startTime - this.offset;
  }

  // ---------------- 반주 ----------------
  /** 샘플(약 3초)보다 긴 음은 겹쳐 이어 붙여서 길게 */
  _hold(set, t, midi, dur, vel, attack = 0.25) {
    const a = this.audio;
    const seg = 2.3;
    let s = 0;
    let first = true;
    while (s < dur - 0.05) {
      const len = Math.min(seg + 0.5, dur - s);
      a.orchNote(set, t + s, midi, len, vel, this.bus, first ? attack : 0.45, 0.35);
      first = false;
      s += seg;
    }
  }

  _schedule() {
    const a = this.audio;
    const T = this.startTime;
    const song = this.song;
    const orch = a.orchestra;
    // 화음 구간
    const ch = song.chords.map(([t, name], i) => ({ t, name, end: i + 1 < song.chords.length ? song.chords[i + 1][0] : song.end - 0.6 }));
    for (const c of ch) {
      const { root, tones } = chordTones(c.name);
      const dur = c.end - c.t;
      const climax = c.t >= 19.6;
      // 현악 화음 (첼로 근음 + 바이올린 화음, 가운데 음역)
      const low = 38 + ((root - 38 % 12 + 12) % 12); // D2~C#3 근처 근음
      const mids = tones.map((pc) => 60 + ((pc - 60 % 12 + 12) % 12)).sort((x, y) => x - y);
      if (orch) {
        this._hold('vc', T + c.t, low + 12, dur, climax ? 0.5 : 0.38, 0.3);
        this._hold('vc', T + c.t, low, dur, climax ? 0.42 : 0.3, 0.3);
        for (const m of mids) this._hold('vln', T + c.t, m, dur, climax ? 0.24 : 0.17, 0.4);
        if (climax) this._hold('tuba', T + c.t, low - 12 < 34 ? low : low - 12, dur, 0.38, 0.2);
      } else {
        a.pluck(T + c.t, mids, Math.min(dur, 2.5), this.bus, 0.7);
        a.bass(T + c.t, low, Math.min(dur, 2.5), this.bus);
      }
    }
    // 멜로디: 바이올린(한 옥타브 위) + 호른(제 음높이)
    for (const n of this.notes) {
      const climax = n.t >= 25;
      if (orch) {
        this._hold('vln', T + n.t, n.m + 12, n.d + 0.05, climax ? 0.75 : 0.6, n.tap ? 0.06 : 0.12);
        this._hold('br', T + n.t, n.m, n.d + 0.05, climax ? 0.5 : 0.32, n.tap ? 0.05 : 0.1);
      } else {
        a.lead(T + n.t, n.m + 12, n.d, this.bus);
      }
    }
    // 팀파니
    if (orch) {
      for (const [r0, r1] of song.rolls) {
        for (let t = r0; t < r1 - 0.02; t += 0.09) {
          const f = (t - r0) / (r1 - r0);
          a.orchNote('timp', T + t, 38, 0.3, 0.12 + 0.5 * f * f, this.bus, 0.003, 0.12);
        }
      }
      for (const t of song.booms) a.orchNote('timp', T + t, 38, 1.2, 0.85, this.bus, 0.003, 0.4);
    }
  }

  // ---------------- 화면 ----------------
  _resize() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    this.dpr = dpr;
    const n = this.pitches.length;
    const pad = Math.max(16, this.W * 0.06);
    this.pad = pad;
    this.colW = (this.W - pad * 2) / n;
    this.judgeY = this.H * 0.8;
    this.speed = this.H * 0.3; // 1초에 내려오는 거리(px)
  }

  colX(col) {
    return this.pad + this.colW * (col + 0.5);
  }

  /** 손가락 x → 칸 번호(소수) */
  xCol(x) {
    return (x - this.pad) / this.colW - 0.5;
  }

  get tol() {
    // 자리 허용 범위(칸): 칸이 좁으면 넉넉하게
    return Math.max(0.75, 34 / this.colW);
  }

  // ---------------- 입력 ----------------
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return e.clientX - r.left;
  }

  _down(e) {
    e.preventDefault();
    if (this.state !== 'playing') return;
    if (this.pointer && this.pointer.id !== e.pointerId) return; // 엄지 하나만
    const x = this._pos(e);
    this.pointer = { id: e.pointerId, x };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {}
    const t = this.now(e.timeStamp);
    // 가까운 '누르기' 구절 판정
    let best = null;
    for (const p of this.phrases) {
      if (p.judged) continue;
      const dt = t - p.t0;
      if (Math.abs(dt) <= WIN.good && (!best || Math.abs(dt) < Math.abs(t - best.t0))) best = p;
    }
    if (!best) return; // 구절 중간에 다시 누름 → 판정 없이 유지만 다시 셈
    const dt = t - best.t0;
    const ad = Math.abs(dt);
    let res = ad <= WIN.perfect ? 'perfect' : ad <= WIN.great ? 'great' : 'good';
    // 자리가 많이 어긋났으면 한 단계 낮춤
    if (Math.abs(this.xCol(x) - best.start.col) > this.tol) res = res === 'perfect' ? 'great' : 'good';
    best.judged = true;
    best.result = res;
    this.counts[res]++;
    this.score += POINTS[res];
    this._fx(res, best.start.col);
    try {
      if (navigator.vibrate) navigator.vibrate(res === 'perfect' ? 12 : 8);
    } catch {}
  }

  _move(e) {
    if (this.pointer && this.pointer.id === e.pointerId) this.pointer.x = this._pos(e);
  }

  _up(e) {
    if (this.pointer && this.pointer.id === e.pointerId) this.pointer = null;
  }

  _fx(res, col) {
    this.fx.push({ res, col, at: performance.now() / 1000 });
    if (this.fx.length > 8) this.fx.shift();
  }

  // ---------------- 진행 ----------------
  _loop() {
    if (this.state !== 'playing') return;
    const now = this.now();
    // 놓친 '누르기'
    for (const p of this.phrases) {
      if (!p.judged && now - p.t0 > WIN.good + 0.1) {
        p.judged = true;
        p.result = 'miss';
        this.counts.miss++;
        this._fx('miss', p.start.col);
      }
    }
    // 유지 판정
    const fingerCol = this.pointer ? this.xCol(this.pointer.x) : null;
    for (const k of this.ticks) {
      if (k.hit !== null || k.t > now) continue;
      const ok = fingerCol !== null && now - k.t < 0.25 && Math.abs(fingerCol - targetCol(k.p, k.t)) <= this.tol;
      k.hit = ok;
      this.tickDone++;
      if (ok) {
        this.tickHit++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.score += TICK_POINTS;
      } else this.streak = 0;
    }
    this._draw(now);
    this.onHud({
      score: this.score,
      progress: Math.max(0, Math.min(1, now / this.song.end)),
      keep: this.tickDone ? this.tickHit / this.tickDone : 1,
    });
    if (now >= this.song.end) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  result() {
    const taps = this.phrases.length;
    const tapW = this.phrases.reduce((s, p) => s + (WEIGHT[p.result] || 0), 0);
    const ticks = this.ticks.length;
    // 정확도: 누르기와 유지를 반반
    const acc = 0.5 * (tapW / taps) + 0.5 * (ticks ? this.tickHit / ticks : 1);
    const stars = acc >= 0.9 && this.counts.miss === 0 ? 3 : acc >= 0.75 ? 2 : acc >= 0.5 ? 1 : 0;
    return {
      songId: this.song.id,
      score: this.score,
      accuracy: acc,
      keep: ticks ? this.tickHit / ticks : 1,
      counts: { ...this.counts },
      stars,
    };
  }

  _finish() {
    this.state = 'finished';
    this.stop();
    this.state = 'finished';
    this.onEnd(this.result());
  }

  _draw(now) {
    const c = this.canvas;
    const g = c.getContext('2d');
    const { W, H, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 배경: 밤 무대 + 아래쪽 은은한 금빛
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0820');
    bg.addColorStop(0.65, '#1d1440');
    bg.addColorStop(1, '#3a2350');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // 별
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97.3) % 1) * W + ((i * 53) % W);
      const y = ((i * 37) % (H * 0.6));
      const tw = 0.5 + 0.5 * Math.sin(now * 1.3 + i);
      g.globalAlpha = 0.15 + 0.35 * tw;
      g.fillRect(x % W, y, 1.6, 1.6);
    }
    g.globalAlpha = 1;
    const jy = this.judgeY;
    const sp = this.speed;
    const yAt = (t) => jy - (t - now) * sp;
    // 칸 안내선 + 계이름
    const SOLFA = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
    g.font = `${Math.round(Math.min(15, this.colW * 0.36))}px Jua, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    this.pitches.forEach((m, i) => {
      const x = this.colX(i);
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, jy);
      g.stroke();
    });
    // 멜로디 띠
    const w = Math.max(16, this.colW * 0.62);
    const fingerCol = this.pointer ? this.xCol(this.pointer.x) : null;
    for (const p of this.phrases) {
      if (yAt(p.t0) < -40 || yAt(p.t1) > H + 40) continue;
      const done = p.t1 < now;
      const active = now >= p.t0 && now <= p.t1;
      const onTrack = active && fingerCol !== null && Math.abs(fingerCol - targetCol(p, now)) <= this.tol;
      // 띠 모양: 시간 따라 칸이 바뀌는 길 (0.05초 간격 점들을 이어 그림)
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const path = () => {
        g.beginPath();
        let first = true;
        for (let t = p.t0; t <= p.t1 + 1e-6; t += 0.04) {
          const y = yAt(Math.min(t, p.t1));
          if (y < -60) break;
          const x = this.colX(targetCol(p, Math.min(t, p.t1)));
          if (first) g.moveTo(x, y);
          else g.lineTo(x, y);
          first = false;
        }
      };
      path();
      g.strokeStyle = done ? 'rgba(255,255,255,0.12)' : 'rgba(255, 196, 92, 0.28)';
      g.lineWidth = w + 10;
      g.stroke();
      path();
      g.strokeStyle = done ? 'rgba(255,255,255,0.2)' : onTrack ? '#ffe9a8' : '#ffb347';
      g.lineWidth = w;
      g.stroke();
      // 누르기 동그라미
      if (!p.judged || now < p.t0 + 0.3) {
        const y = yAt(p.t0);
        const x = this.colX(p.start.col);
        g.fillStyle = p.result === 'miss' ? '#7a6b8f' : '#fff';
        g.strokeStyle = '#ff7a2f';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, w * 0.62, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#ff7a2f';
        g.font = `${Math.round(w * 0.5)}px Jua, sans-serif`;
        g.fillText('톡', x, y + 1);
      }
    }
    // 판정선 아래(지나간 부분)는 어둡게 + 계이름 (낮은 옥타브는 아래 점)
    g.fillStyle = 'rgba(11, 8, 32, 0.62)';
    g.fillRect(0, jy, W, H - jy);
    g.font = `${Math.round(Math.min(16, this.colW * 0.38))}px Jua, sans-serif`;
    this.pitches.forEach((m, i) => {
      const x = this.colX(i);
      const near = fingerCol !== null && Math.abs(fingerCol - i) < 0.5;
      g.fillStyle = near ? '#ffe9a8' : 'rgba(255,255,255,0.75)';
      g.fillText(SOLFA[m % 12], x, jy + 28);
      if (m < 60) {
        g.beginPath();
        g.arc(x, jy + 44, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    });
    // 판정선
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(this.pad * 0.5, jy);
    g.lineTo(W - this.pad * 0.5, jy);
    g.stroke();
    // 손가락 위치
    if (this.pointer) {
      const x = this.pointer.x;
      const glow = g.createRadialGradient(x, jy, 2, x, jy, 46);
      glow.addColorStop(0, 'rgba(255,240,180,0.95)');
      glow.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, jy, 46, 0, Math.PI * 2);
      g.fill();
    }
    // 판정 글자
    const rt = performance.now() / 1000;
    const LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
    const COLOR = { perfect: '#ffe14d', great: '#7dff9b', good: '#7fd3ff', miss: '#ff7b8a' };
    g.font = '24px Jua, sans-serif';
    this.fx = this.fx.filter((f) => rt - f.at < 0.7);
    for (const f of this.fx) {
      const k = (rt - f.at) / 0.7;
      g.globalAlpha = 1 - k;
      g.fillStyle = COLOR[f.res];
      g.fillText(LABEL[f.res], this.colX(f.col), jy - 60 - k * 30);
    }
    g.globalAlpha = 1;
    // 유지 연속
    if (this.streak >= 10) {
      g.fillStyle = 'rgba(255,233,168,0.95)';
      g.font = '20px Jua, sans-serif';
      g.fillText(`유지 ${this.streak}`, W / 2, H * 0.2);
    }
    // 시작 안내
    if (now < this.phrases[0].t0 - 0.2) {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = '20px Jua, sans-serif';
      g.fillText('동그라미가 선에 닿을 때 톡!', W / 2, H * 0.36);
      g.fillText('손을 떼지 말고 띠를 따라 밀어요', W / 2, H * 0.36 + 28);
    }
  }
}
