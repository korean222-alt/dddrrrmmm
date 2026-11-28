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
//   🎨 스킨(상점, 2026-11-27 사용자 '스킨 껴도 배경은 안 바뀌게 · 스킨은 타일을 꾸며줘'): 배경은 늘 밝은 기본,
//     콩 스킨·세트(skin.key) → 타일 무늬 (paintTileSkin: 불꽃·크리스탈·하트·사이버·황금·은하수·시즌 1·라이브, 색 콩은 위쪽 색)
//   🎯 판정 (2026-11-27 사용자 '죄다 퍼펙트'): 타일 아래 끝이 판정선에 닿는 시각과 누른 시각의 차이 — PERFECT_SEC 안만 PERFECT
//   🪙 코인은 드럼처럼 판정선에서 튀어 올라 떨어짐 (코인 칸으로 날아가 쌓이던 것 없앰)
//   👆 긴 타일: 누른 손가락 자리까지 차오름 (판정선 기준 아님), 손가락이 내려가면 따라감
//   🎨 6차 (2026-11-27 사용자 '너무 중국 게임 같아 · 점수·PERFECT 글씨 사진 느낌으로'): 밝은 파스텔 그라데이션 배경 + 하얀 줄·판정선,
//     하얀 둥근 점수(Fredoka), PERFECT = 파스텔 그라데이션 글자 + 유리 조각 + 하얀 ×연속, 진행 줄 = 가는 하얀 선 + 노란 별
//   👆 타일 자리를 눌러야 침 (빈 칸 = 하트), PERFECT 한가운데 = 타일이 판정선에 걸칠 때 (PERFECT_ROWS)
//   ⚔️ 대결(vs): 상대 점수 막대, maxLaps 바퀴(기본 3)에서 끝, 코인 파티 없음

import { STEPS_PER_BAR, parseChord } from './charts.js';
import { arcOf, arcLevel, orchestraBar, dynOf } from './orchestra.js';
import { tileLap, tileCourse, buildCourse, lapStars, MAX_LAPS, TILE_HEARTS, TILE_ROWS, tilePoints, HOLD_PTS, tileLevel, PPLUS_SEC } from './tiles.js';

const FONT = "Jua, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";
const font = (px) => `${Math.round(px)}px ${FONT}`;
/** 점수·판정 글자 (2026-11-27 사용자 '점수·PERFECT 글씨 구려, 사진 느낌으로'): 둥근 굵은 영문 글꼴 (Google Fonts Fredoka, OFL) */
const DISP = "'Fredoka', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif";
const disp = (px, w = 700) => `${w} ${Math.round(px)}px ${DISP}`;
const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOUNCE_SEC = 0.12;
/** ⚔️ 상대가 먼저 쓰러지면 「승리!」를 이만큼 보여 준 뒤 결과 */
const WIN_MS = 3000;
const GRACE_SEC = 0.35;
/** 판정선 자리 (화면 높이 비율): 타일 아래 끝이 여기 닿을 때가 그 음 */
const JUDGE_AT = 0.75;
/** 판정선을 이만큼(줄) 지나 화면 밖으로 나가면 놓침 */
const GONE_ROWS = (1 - JUDGE_AT) * TILE_ROWS + 0.08;
const HOLD_BLUE = '#2fb8ff';
/** 🎯 판정 창 (초, 음수 = 빨리): 타일 아래 끝이 판정선에 닿는 순간 기준 — 2026-11-27 사용자 '선에 맞춰 쳤을 때만 PERFECT' */
const PERFECT_SEC = [-0.075, 0.085];
const GREAT_SEC = [-0.15, 0.17];
/** 🎯 PERFECT 자리 (줄): 타일 아래 끝이 판정선을 이만큼 지난 때가 한가운데 (2026-11-27 사용자 '선 중간에 맞춰 누르는데 PERFECT 가 안 떠, 좀만 내려')
 *   = 타일이 판정선에 걸쳐 있을 때. 소리(그 음)는 그대로 아래 끝이 선에 닿을 때 */
const PERFECT_ROWS = 0.3;
/** ✨ PERFECT+ 글자 색 (무지개 금빛) */
const PPLUS_COLORS = ['#fff3a0', '#ffc93c', '#ff8fd0', '#9fe4ff', '#c9a6ff'];

/**
 * 🎨 판정 글자 색 = 스킨 컨셉 (2026-11-27 사용자 '세트 스킨들은 PERFECT 도 컨셉에 맞게 색 바뀌게, 라이브 세트는 최대한 비슷하게')
 *   → { perfect·great·good: 그라데이션 색, stroke: 테두리, shadow, glass: 유리 조각 물(r,g,b), gloss, italic, fx, combo, comboFill }
 *   🎤 라이브 = 리듬게임 라이브 무대 느낌: 기울인 글씨 + 핑크→노랑→하늘→보라 파스텔, 하얀 빛 테두리, 빛줄기, 가운데 「COMBO」 숫자
 *   (특정 게임 이름·로고·그림은 안 베낌 — 장르에서 흔한 모양만)
 */
export function judgeTheme(key, palette) {
  const base = { perfect: ['#d98bff', '#ff8fcf', '#ffb07a'], great: ['#7fe6ff', '#6aa6ff', '#8f86ff'], good: ['#8ff0c8', '#5ccfb4', '#4fb7d8'], stroke: '#ffffff', shadow: 'rgba(170,70,200,0.45)', glass: '255,220,250', gloss: 0.45, italic: false, fx: 'glass', combo: 'x', comboFill: '#ffffff' };
  switch (key) {
    case 'live':
      return { ...base, perfect: ['#ff6fd8', '#ffb3e6', '#ffe86b', '#8ff6ff', '#b58cff'], great: ['#ff9fe3', '#ff6fc8', '#ff9fe3'], good: ['#9fe8ff', '#5cc8ff', '#9fe8ff'], shadow: 'rgba(255,150,240,0.95)', gloss: 0.55, italic: true, fx: 'streak', combo: 'live' };
    case 's1':
      return { ...base, perfect: ['#fff6c8', '#ffd54a', '#e09a12', '#ffe680'], great: ['#c9d4ff', '#8fa2ff', '#5c6fe0'], good: ['#b8c2e8', '#8a97c8', '#6a76a8'], stroke: '#1b2560', shadow: 'rgba(20,28,90,0.55)', glass: '255,214,90', gloss: 0.6, comboFill: '#ffe27a' };
    case 'gold':
      return { ...base, perfect: ['#ffe680', '#ffb300', '#e07a00', '#ffd04a'], great: ['#ffe39a', '#f2b23a', '#d98a10'], shadow: 'rgba(150,90,0,0.6)', glass: '255,210,90', gloss: 0.6, comboFill: '#fff3c4' };
    case 'flame':
    case 'fire':
      return { ...base, perfect: ['#ffe27a', '#ff9a1f', '#ff4a2e'], great: ['#ffd27a', '#ff8a3a', '#ff6a4a'], shadow: 'rgba(200,60,0,0.5)', glass: '255,150,60' };
    case 'ice':
      return { ...base, perfect: ['#bff3ff', '#3ec8ff', '#4f7bff'], great: ['#9fe6ff', '#5cb8ff', '#7f9cff'], shadow: 'rgba(30,90,200,0.55)', glass: '150,230,255', gloss: 0.6 };
    case 'heart':
      return { ...base, perfect: ['#ffb3d9', '#ff5fa2', '#e86bff'], great: ['#ffc2e0', '#ff8fc8', '#f2a0ff'], shadow: 'rgba(220,40,130,0.45)', glass: '255,140,200' };
    case 'cyber':
      return { ...base, perfect: ['#00f0ff', '#c6ff00', '#ff2bd6'], great: ['#00f0ff', '#8c5cff'], good: ['#00ff9c', '#00b0c0'], stroke: '#0b0f2a', shadow: 'rgba(0,240,255,0.7)', glass: '0,240,255', italic: true, comboFill: '#b8fcff' };
    case 'galaxy':
      return { ...base, perfect: ['#5cffc8', '#4fd8ff', '#b26bff', '#ff7ad9'], great: ['#9fb0ff', '#b26bff'], shadow: 'rgba(110,60,220,0.55)', glass: '180,120,255' };
    default:
      // 색 콩(사탕·네온·바다·불꽃): 그 스킨의 색 셋으로
      if (palette && key !== 'mono' && palette.length >= 3) return { ...base, perfect: [palette[0][0], palette[1][0], palette[2][0]] };
      return base;
  }
}
/** 👆 타일 아래 끝보다 이만큼(줄) 아래를 눌러도 그 타일 (손가락이 닿는 사이 타일이 내려옴) — 더 밑은 빈 칸 */
const TAP_BELOW = 0.3;
/** 🪙 떨어지는 코인 (드럼처럼) 수명 */
const DROP_SEC = 0.7;
/** 노래 소리 미리 예약 (초) */
const LOOKAHEAD = 0.3;
/** 곡마다 배경 색 (곡 목록 표지와 같은 색) */
const SONG_HUES = { 101: 120, 1: 28, 2: 340, 3: 200, 4: 265, 5: 150, 6: 12, 11: 300, 12: 185, 7: 45, 17: 230, 9: 320, 8: 95, 16: 255, 10: 5, 13: 170, 18: 280, 14: 210, 15: 355 };

export class TileGame {
  /**
   * @param {{ audio, canvas, songId?:number, lap?:object, onEnd:(r)=>void, onLap?:(laps:number)=>void,
   *           maxLaps?:number, skin?:object, vs?:{ name:string, other:()=>({score,lives,done}|null), onLive?:(live)=>void } }} o
   *   lap 을 주면 그걸로 (유저 맵 타일), 아니면 songId 의 곡
   */
  constructor({ audio, canvas, songId = 0, lap = null, onEnd, onLap, onDeath = null, invincible = false, maxLaps = MAX_LAPS, vs = null, skin = null, hue = null, auto = false, mute = false, reel = null, dpr = null }) {
    // 🎬 auto = 저절로 PERFECT 로 침 (영상 찍기 자동 연주·상점 미리보기), mute = 소리 없음(상점 미리보기), reel = 릴스 문구 { top, bottom, label }
    this.auto = auto;
    this.mute = mute;
    this.reel = reel;
    this.fixedDpr = dpr; // 🖼 썸네일: 1080 너비로 그리게 고정
    if (auto) invincible = true;
    this.onDeath = onDeath;
    this.invincible = invincible; // 🛡 유저 맵 무적: 틀려도 안 죽음
    this.continues = 0;
    this.audio = audio;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.songId = songId;
    this.onEnd = onEnd;
    this.onLap = onLap;
    this.vs = vs;
    this.skin = skin || {};
    this.hue = hue ?? SONG_HUES[songId] ?? 220;
    try {
      if (document.fonts) document.fonts.load(disp(40)).then(() => this.W && this.state !== 'playing' && this._draw(this.pausedT || 0, 0)).catch(() => {});
    } catch {}
    this.maxLaps = Math.max(1, Math.min(MAX_LAPS, maxLaps));
    this.lap = lap || tileLap(songId);
    // 혼자 치는 곡 = 서버 검사와 같은 코스 (코인 파티 포함). 대결은 파티 없이
    const solo = !lap && !vs && this.maxLaps === MAX_LAPS;
    // 🪙 코인 파티는 곡 판만 (유저 맵 = lap 을 받은 판은 코인 없이 쉬는 마디만, 2026-11-28 사용자)
    this.course = solo ? tileCourse(songId) : buildCourse(this.lap, { laps: this.maxLaps, party: !vs, coins: !lap });
    this.coinParty = this.course.tiles.some((c) => c.coin);
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
    this.pplus = 0;
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
    this.fx = { bad: [], pop: [], lap: [], icon: [], judge: [], ring: [], drop: [] };
    this.coinBump = -9;
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
    this._onTouchMove = (e) => this._touchMove(e);
    this._onPointerMove = (e) => this.holds.length && this._moveHold('p', e.pointerId, e.clientY);
  }

  _partyRange() {
    const sg = this.course.segs.find((s) => s.kind === 'party');
    if (!sg) return null;
    const T = (abs) => this.tempo.stepTime(abs) - this.t0;
    const t0 = T(sg.bar0 * STEPS_PER_BAR);
    const t1 = T((sg.bar0 + sg.bars) * STEPS_PER_BAR);
    let a = -1;
    let b = -1;
    this.tiles.forEach((tl, i) => {
      if (!tl.coin) return;
      if (a < 0) a = i;
      b = i;
    });
    // 유저 맵: 다이아 바퀴 앞 쉬는 마디 (코인 없음, 벌 없음)
    if (a < 0) return { a: this.tiles.length, b: -1, t0, t1, c0: t0, c1: t1 - 1.6 };
    // 🪙 곡 판: t0·t1 = 파티 구간(앞뒤 빈 마디 포함, 벌 없음), c0·c1 = 첫·마지막 코인 타일이 판정선에 닿는 때
    return { a, b, t0, t1, c0: this.tiles[a].t, c1: this.tiles[b].t };
  }

  // ---------- 🎵 노래 (멜로디 + 반주 + 드럼 + 현악) ----------
  /**
   * 판 전체 소리 목록 (시각 순)
   *   2026-11-27 저녁 사용자 '건반만 있으니 심심해, 드럼처럼 사운드 풍부하게':
   *   바퀴 = 멜로디(피아노 + 긴 음은 바이올린) · 베이스(피아노 + 첼로) · 화음 · 현악 패드 · 드럼(쿵·짝·하이햇·크래시)
   *     2026-11-28 사용자 '진짜 오케스트라처럼, 산왕은 마지막에 웅장하게' → 곡마다 셈여림 흐름(orchestra.js):
   *     여린 피치카토로 시작 → 현·호른 → 금관·튜바·팀파니 → 투티로 몰아쳐 끝, 다이아 바퀴는 더 센 데서 시작
   *   코인 파티 = 곡과 같은 조·코드로 신나는 쿵쿵 + 반짝이 (예전엔 곡과 상관없는 C 장조라 '관련없는 노래'처럼 들림)
   *   현악·금관은 오케스트라 소리를 받았을 때만 (_schedule 에서 확인), 못 받으면 피아노 + 드럼
   */
  _musicEvents() {
    const lap = this.lap;
    const T = (abs) => this.tempo.stepTime(abs) - this.t0;
    const ev = [];
    const lv = this.songId ? tileLevel(this.songId) : null;
    const hatPat = lv && lv.song && typeof lv.song.hat === 'string' && lv.song.hat.length === 16 ? lv.song.hat : 'x.x.x.x.x.x.x.x.';
    const chordsOf = (bar) =>
      String(lap.prog[((bar % lap.bars) + lap.bars) % lap.bars] || 'C')
        .trim()
        .split(/\s+/)
        .map((p) => {
          try {
            return parseChord(p);
          } catch {
            return null;
          }
        });
    const chordAtStep = (bar, e) => {
      const chs = chordsOf(bar);
      return chs[Math.min(chs.length - 1, Math.floor((e * chs.length) / 16))] || chs.find(Boolean);
    };
    // 유저 맵(곡 없음)은 classic
    const shape = lv ? arcOf(lv) : 'classic';
    let lapNo = 0;
    for (const sg of this.course.segs) {
      const a0 = sg.bar0 * STEPS_PER_BAR;
      if (sg.kind === 'party' && this.coinParty) {
        // 🎉 코인 파티: 곡의 코드를 그대로 돌며 쿵쿵(4박 내내)·짝·하이햇 8분 + 반짝이 + 환호
        ev.push({ t: T(a0), sfx: 'cheer' });
        ev.push({ t: T(a0), crash: true, v: 0.45 });
        for (let b = 0; b < sg.bars; b++) {
          for (let e = 0; e < 16; e++) {
            const abs = a0 + b * STEPS_PER_BAR + e;
            const t = T(abs);
            const d = T(abs + 1) - t;
            const ch = chordAtStep(b, e);
            if (!ch) continue;
            const tri = ch.notes.slice(0, 3);
            if (e % 4 === 0) ev.push({ t, kick: true, v: 0.75 });
            if (e === 4 || e === 12) ev.push({ t, snare: true, v: 0.5 });
            if (e % 2 === 0) ev.push({ t, hat: true, v: e % 4 === 2 ? 0.45 : 0.25, open: e % 4 === 2 });
            if (e % 4 === 0) ev.push({ t, m: ch.root - 24, d: d * 3.5, v: 0.6, bass: true });
            if (e === 0 || e === 8) {
              for (const m of tri) ev.push({ t, m, d: d * 6, v: 0.26 });
              for (const m of tri) ev.push({ t, orch: 'vln', m: m + 12, d: d * 7.5, v: 0.3, at: 0.02, rel: 0.2 });
            }
            ev.push({ t, glock: tri[[0, 1, 2, 1][e % 4]] + 12 + (e >= 8 ? 12 : 0), v: 0.7 });
          }
        }
        ev.push({ t: T(a0 + sg.bars * STEPS_PER_BAR), crash: true, v: 0.5 });
        continue;
      }
      if (sg.kind === 'party') {
        // 유저 맵 쉬는 마디: 하이햇·쿵만 가볍게 → 다이아 바퀴로
        for (let b = 0; b < sg.bars; b++) {
          for (let e = 0; e < 16; e += 2) {
            const t = T(a0 + b * STEPS_PER_BAR + e);
            if (e % 8 === 0) ev.push({ t, kick: true, v: 0.55 });
            ev.push({ t, hat: true, v: e % 4 === 0 ? 0.35 : 0.2 });
          }
        }
        ev.push({ t: T(a0 + sg.bars * STEPS_PER_BAR), crash: true, v: 0.5 });
        continue;
      }
      const k = lapNo++;
      // 🎻 셈여림: 곡마다 흐름(orchestra.js arcLevel) — 여리게 시작해서 끝으로 갈수록 몰아침, 다이아 바퀴는 더 세게 시작
      for (let b = 0; b < sg.bars; b++) {
        const vv = arcLevel(shape, b, sg.bars, k);
        const L = Math.floor(vv + 1e-6);
        const dyn = dynOf(vv);
        const ab = a0 + b * STEPS_PER_BAR;
        const chs = chordsOf(b);
        const parts = chs.length || 1;
        if (T(ab) < -0.02 && b > 0) continue;
        // 바퀴 시작(첫 바퀴 빼고) 크래시
        if (b === 0 && k > 0) ev.push({ t: T(ab), crash: true, v: 0.5 });
        const drive = (shape === 'mountain' || shape === 'hot' || shape === 'epic') && L >= 4 && b >= sg.bars - 3;
        for (let e = 0; e < 16; e++) {
          const abs = ab + e;
          const t = T(abs);
          if (t < -0.02) continue;
          const d = T(abs + 1) - t;
          const ch = chordAtStep(b, e);
          if (!ch) continue;
          // 🥁 드럼: 0 = 하이햇만 · 1 = 쿵·짝 작게 · 2 = 쿵(1·3)·짝(2·4) · 3 = 엇박 쿵 · 4 = 매 박 쿵 + 몰아치는 짝
          if (L >= 1) {
            const kick = e === 0 || e === 8 || (L >= 3 && (e === 10 || (e === 6 && b % 2 === 1))) || (L >= 4 && e % 4 === 0);
            if (kick) ev.push({ t, kick: true, v: (e === 0 ? 0.8 : 0.65) * (L === 1 ? 0.7 : 1) * dyn });
            if (e === 4 || e === 12) ev.push({ t, snare: true, v: (L === 1 ? 0.28 : 0.42) * dyn });
            // 4마디째 끝: 짝 연타로 다음 마디로 · 마지막 몰아치기는 마디 내내 8분 짝
            if (drive && e % 2 === 0 && e !== 4 && e !== 12) ev.push({ t, snare: true, v: 0.2 + (e / 16) * 0.25 });
            else if (b % 4 === 3 && e >= 13 && L >= 2) ev.push({ t, snare: true, v: 0.18 + (e - 13) * 0.07 });
          }
          const hc = hatPat[e];
          if ((hc === 'x' || hc === 'o') && !(shape === 'mountain' && L === 0)) ev.push({ t, hat: true, v: (e % 4 === 0 ? 0.5 : 0.3) * (L ? dyn : 0.6), open: hc === 'o' });
          // 베이스 + 화음 (정박 피아노)
          if (e % 4 === 0) {
            const beat = e >> 2;
            if (beat % 2 === 0) {
              const m = ch.root - 24 + (beat === 2 && parts === 1 ? 7 : 0);
              ev.push({ t, m, d: d * 7, v: 0.5 * dyn, bass: true });
            } else if (L >= 1) for (const m of ch.notes.slice(0, 3)) ev.push({ t, m: m - 12, d: d * 3.2, v: 0.24 * dyn });
          }
        }
        // 멜로디 피아노 (타일 = 멜로디라 늘 또렷하게, 세질수록 조금 더 크게)
        const mel = [];
        for (const nt of lap.notes) {
          if (nt.bar !== b) continue;
          const t = T(a0 + nt.at);
          if (t < -0.05) continue;
          const dur = Math.max(0.12, (T(a0 + nt.at + nt.len) - t) * 0.95);
          ev.push({ t, m: nt.midi, d: dur, v: 0.64 + 0.08 * L });
          mel.push({ s: nt.at - b * STEPS_PER_BAR, len: nt.len, midi: nt.midi });
        }
        // 🎻 오케스트라 (현·금관·튜바·팀파니·심벌)
        const orch = orchestraBar({ v: vv, shape, b, n: sg.bars, chordAt: (s) => chordAtStep(b, Math.max(0, Math.min(15, Math.floor(s)))), parts, mel });
        for (const o of orch) {
          const t = T(ab + o.s);
          if (t < -0.02) continue;
          if (o.crash) {
            if (!(b === 0 && k > 0)) ev.push({ t, crash: true, v: o.v });
            continue;
          }
          const d = o.sec ?? Math.max(0.06, T(ab + o.s + o.len) - t);
          ev.push({ t, orch: o.o, m: o.m, d, v: o.v, at: o.at, rel: o.rel });
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
        else if (e.orch) {
          if (a.orchestra) a.orchNote(e.orch, tt, e.m, e.d, e.v, this.bus, e.at, e.rel);
        } else if (e.kick) a.kick(tt, e.v, this.bus);
        else if (e.snare) a.snare(tt, e.v, this.bus);
        else if (e.crash) a.crash(tt, this.bus, e.v);
        else if (e.hat) a.hat(tt, e.v, !!e.open, this.bus);
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
    this.readyAt = performance.now();
    if (this.auto) {
      this.state = 'ready';
      this.lastFrame = performance.now();
      this._loop();
      clearInterval(this.timer);
      this.timer = setInterval(() => this._schedule(), 50);
      return;
    }
    c.addEventListener('touchstart', this._onTouch, { passive: false });
    c.addEventListener('touchmove', this._onTouchMove, { passive: false });
    c.addEventListener('touchend', this._onTouchEnd, { passive: false });
    c.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    c.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('pointermove', this._onPointerMove);
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
    if (this.mute || !this.audio.ctx) {
      // 🔇 소리 없음 (상점 미리보기): 화면 시계만
      this.aud0 = null;
      this.perf0 = pn + (lead - from) * 1000;
      this.drift = 0;
      this.floorT = from;
      return;
    }
    const a = this.audio;
    const ctx = a.ctx;
    const heard = a.heardTime ? a.heardTime(pn) : ctx.currentTime;
    // 소리: 곡 시각 s 를 ctx 시각 aud0 + s 에 예약 → 귀에는 (출력 지연만큼) 뒤에 들림
    this.aud0 = ctx.currentTime + lead - from;
    const lag = Math.max(0, ctx.currentTime - heard);
    this.perf0 = pn + (lead + lag - from) * 1000;
    this.drift = 0;
    // 🧷 2026-11-27 사용자 '시작 타일 누르면 위로 두 번 튐': 소리가 (lead + 출력 지연) 뒤에 들리게 맞추느라 곡 시각이 잠깐 음수 →
    //   멈춰 있던 화면(0초)이 뒤로 갔다가 내려옴. 그동안 화면은 시작 자리에 멈춰 둠 (대결의 카운트다운은 그대로)
    this.floorT = this.vs && from === 0 && lead > 0.5 ? null : from;
    this._resyncAt = pn;
    this._lastCtx = ctx.currentTime;
    this._lastCtxAt = pn;
    this._newBus();
    this._musicFrom(from);
    this._schedule();
  }

  _loop() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (this.state === 'stopped' || this.state === 'ended' || this.state === 'paused' || this.state === 'dead') return;
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

  /** 광고 보고 이어하기: 하트 1개로 틀린 자리에서 3·2·1 뒤 다시 (한 판에 한 번) */
  revive() {
    if (this.state !== 'dead' || this.continues >= 1) return false;
    this.continues++;
    this.hearts = 1;
    this.failTile = null;
    this._curPrev = null;
    this.lastHurt = this.diedAt;
    this.hurtFx = { at: this.diedAt, heal: true, heart: 0 };
    this.state = 'paused';
    this.resume();
    return true;
  }

  /** 이어하기 안 함 → 결과 */
  giveUp() {
    if (this.state === 'dead') this._finish();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    if (this.state !== 'ended') this.state = 'stopped';
    this._hush(0.2);
    const c = this.canvas;
    c.removeEventListener('touchstart', this._onTouch);
    c.removeEventListener('touchmove', this._onTouchMove);
    c.removeEventListener('touchend', this._onTouchEnd);
    c.removeEventListener('touchcancel', this._onTouchEnd);
    c.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('pointermove', this._onPointerMove);
  }

  resize() {
    const c = this.canvas;
    this.W = c.clientWidth || window.innerWidth;
    // 🎬 릴스는 1080 너비쯤으로 (영상이 흐리지 않게)
    const dpr = this.fixedDpr ? this.fixedDpr : this.reel ? clamp(1080 / Math.max(1, this.W), 2, 3) : Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
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
  }

  /** 긴 타일·친 자리 빛 색 (줄마다): 스킨 색 있으면 그 색, 없으면 하늘색 */
  _accent(l) {
    const p = this.skin.palette;
    if (this.skin.key === 's1') return ['#ffd54a', '#fff2b0'];
    if (this.skin.key === 'live') return [['#ff8ad8', '#7df2ff', '#b996ff', '#ffe27a'][l], '#ffffff'];
    if (!p || this.skin.key === 'mono') return [HOLD_BLUE, '#9be9ff'];
    if (this.skin.key === 'flame' || this.skin.key === 'fire') return ['#ff9a1f', '#ffe08a']; // 빨강은 놓친 타일 색이라 피함
    const c = p[l % p.length];
    return [c[0], c[1]];
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
    // 줄 사이 가는 하얀 선
    b.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 1; i < 4; i++) b.fillRect(Math.round(i * laneW) - 0.5, 0, 1, H);
    // 판정선: 하얀 빛 띠 + 가는 선 (어디서 치면 PERFECT 인지 보이게 — 타일이 이 선에 걸칠 때)
    const jy = this.judgeY;
    const jg = b.createLinearGradient(0, jy - 30, 0, jy + 30);
    jg.addColorStop(0, 'rgba(255,255,255,0)');
    jg.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    jg.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = jg;
    b.fillRect(0, jy - 30, W, 60);
    const lg = b.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.35)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    lg.addColorStop(1, 'rgba(255,255,255,0.35)');
    b.fillStyle = lg;
    b.fillRect(0, jy - 1, W, 2);
    this.spr.bg = bg;
    const tw = laneW - 1;
    const th = rowH;
    this.spr.tw = tw;
    this.spr.th = th;
    this.spr.tile = [0, 1, 2, 3].map((l) => {
      const [tc, t] = mk(tw, th);
      paintTileSkin(t, tw, th, this.skin.key || 'basic', this.skin.palette ? this.skin.palette[l % this.skin.palette.length] : null, l);
      return tc;
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

  /** 배경 (2026-11-27 사용자 '너무 중국 게임 같아 · 사진 느낌으로'): 곡 색 → 옆 색으로 흐르는 밝은 파스텔 그라데이션 +
   *   가운데 은은한 빛 + 옅은 네모 무늬 몇 개. 스킨과 상관없이 늘 같음 (타일은 어두워서 잘 보임) */
  _paintBg(b, W, H) {
    const h = this.hue;
    const [h1, h2] = bgHues(h);
    const gr = b.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, `hsl(${h1},80%,66%)`);
    gr.addColorStop(1, `hsl(${h2},76%,64%)`);
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);
    // 위아래 살짝 다른 결
    const vg = b.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(255,255,255,0.12)');
    vg.addColorStop(0.55, 'rgba(255,255,255,0)');
    vg.addColorStop(1, `hsla(${h2},70%,40%,0.14)`);
    b.fillStyle = vg;
    b.fillRect(0, 0, W, H);
    // 가운데 은은한 빛
    const rg = b.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, Math.max(W, H) * 0.5);
    rg.addColorStop(0, 'rgba(255,255,255,0.42)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = rg;
    b.fillRect(0, 0, W, H);
    // 옅은 네모 무늬 (기울어진 판 몇 장)
    let seed = 5 + Math.round(h);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 7; i++) {
      const s = Math.max(W, H) * (0.12 + rnd() * 0.22);
      b.save();
      b.translate(rnd() * W, rnd() * H);
      b.rotate(Math.PI / 4 + (rnd() - 0.5) * 0.5);
      if (i % 3 === 0) {
        b.strokeStyle = 'rgba(255,255,255,0.16)';
        b.lineWidth = Math.max(2, s * 0.04);
        b.strokeRect(-s / 2, -s / 2, s, s);
      } else {
        b.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.05})`;
        b.fillRect(-s / 2, -s / 2, s, s);
      }
      b.restore();
    }
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
    // 🧈 2026-11-27 사용자 '화면이 부드럽지 않고 렉 걸리는 느낌': 소리 시계는 폰마다 뚝뚝 끊겨 흘러서(블루투스는 더)
    //   매 화면 5%씩 따라가면 타일이 미세하게 빨라졌다 느려졌다 함 → 10ms 안 차이는 그냥 두고,
    //   당길 땐 시간에 맞춰 천천히(빠르기가 6% 넘게 안 바뀌게). 0.25초 넘게 어긋나면 그때만 한 번에
    const err = want - this.drift;
    const fdt = clamp((pn - (this._syncAt || pn)) / 1000, 0, 0.05);
    this._syncAt = pn;
    if (err < -0.25) {
      // 소리가 늦음(소리 엔진이 막 깨어남 등) → 화면을 뒤로 당기면 타일이 위로 튐(시작 때 두 번째 튐). 화면은 그대로 두고 소리를 화면 시각에 다시 맞춤
      if (pn - (this._resyncAt || 0) > 800) this._resyncAudio(pn);
      return;
    }
    if (err > 0.25) this.drift = want;
    else if (Math.abs(err) > 0.01) this.drift += clamp(err * Math.min(1, fdt * 3), -fdt * 0.06, fdt * 0.06);
  }

  /** 화면 시각은 그대로 두고, 지금 화면 시각의 소리가 지금 들리게 소리 예약만 다시 */
  _resyncAudio(pn) {
    const a = this.audio;
    const ctx = a.ctx;
    this._resyncAt = pn;
    const from = this._time(pn);
    const heard = a.heardTime ? a.heardTime(pn) : ctx.currentTime;
    const lag = Math.max(0, ctx.currentTime - heard);
    this.aud0 = ctx.currentTime - lag - from;
    this._hush(0.04);
    this._newBus();
    this._musicFrom(from + lag + 0.03);
    this._lastCtx = ctx.currentTime;
    this._lastCtxAt = pn;
    this._schedule();
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
  /** 손가락이 움직임: 꾹 누르는 긴 타일만 손가락 자리를 따라감 (새 터치는 안 만듦 — CLAUDE.md 터치 규칙) */
  _touchMove(e) {
    if (e.cancelable) e.preventDefault();
    if (!this.holds.length) return;
    for (const t of e.changedTouches) this._moveHold('t', t.identifier, t.clientY);
  }
  _moveHold(src, id, cy) {
    const h = this.holds.find((q) => q.src === src && q.id === id);
    if (!h) return;
    const r = this.canvas.getBoundingClientRect();
    const y = (cy - r.top) * (r.height ? this.H / r.height : 1);
    // 아래로는 따라가고, 위로 올리는 건 처음 누른 자리까지만 (손가락을 쓱 올려 한 번에 채우기 막기)
    h.fy = Math.max(h.y0, y);
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
    // touchstart 와 pointerdown 이 같은 손가락으로 둘 다 오면 한 번만.
    //   느린 폰은 앞 이벤트 처리(시작 타일 = 노래 예약, 빽빽한 곳 = 화면)가 길어 둘째가 80ms 넘게 늦게 처리됨 →
    //   처리 시각으로 재면 같은 터치가 두 번 쳐져 '안 눌렀는데 눌림'(2026-11-27 건의: 터키 행진곡·시작 타일 사라짐).
    //   폰이 붙인 이벤트 시각(같은 손가락이면 거의 같음)으로 잼, 못 믿을 값이면 처리 시각
    const ev = ts > 0 && Math.abs(pn - ts) < 1000 ? ts : pn;
    if (this.recent.length > 8) this.recent = this.recent.filter((p) => pn - p.at < 1200);
    for (const p of this.recent) {
      if (p.src === src || Math.abs(p.x - x) >= 24 || Math.abs(p.y - y) >= 24) continue;
      if (Math.abs(p.ev - ev) < 80 || pn - p.at < 80) return;
    }
    this.recent.push({ x, y, at: pn, ev, src });
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
      this._startHit(first);
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
    // 👆 타일 자리를 눌러야 침 (2026-11-27 사용자 '빈 곳을 눌렀는데 위에 아직 안 내려온 타일이 눌리며 살았어 — 빈 곳 누르면 목숨 깎이게'):
    //   같은 줄이어도 타일 밖(아래 빈 칸)을 누르면 빈 칸 누름. 손가락이 닿는 사이 타일이 내려오니 아래쪽만 조금 넉넉히
    const onTile = (tl) => {
      if (!tl || tl.lane !== lane) return false;
      const yb = this.judgeY - (tl.row - cur) * this.rowH;
      return y <= yb + this.rowH * TAP_BELOW && y >= yb - tl.rows * this.rowH - this.rowH * 0.12 && y >= this.topNo;
    };
    if (onTile(a)) return this._hit(a, t, x, y, src, id);
    if (onTile(b) && b.row - a.row <= 1.01) return this._hit(b, t, x, y, src, id);
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
    // 판정 (2026-11-27 사용자 '죄다 퍼펙트 — 선에 박자 맞춰 쳤을 때만 PERFECT, 선 넘거나 빨리 치면 GREAT·GOOD'):
    //   타일 아래 끝이 판정선에 닿는 시각(tl.t)과 누른 시각의 차이. 화면 시계 = 판정 시계라 보이는 그대로
    // PERFECT 한가운데 = 아래 끝이 판정선을 PERFECT_ROWS 줄 지난 때 (빠르기에 따라 초로)
    const rps = Math.max(0.5, (this._rowAt(tl.t + 0.05) - this._rowAt(tl.t - 0.05)) / 0.1);
    const dt = t - tl.t - clamp(PERFECT_ROWS / rps, 0.03, 0.11);
    let word = dt >= PERFECT_SEC[0] && dt <= PERFECT_SEC[1] ? 'perfect' : dt >= GREAT_SEC[0] && dt <= GREAT_SEC[1] ? 'great' : 'good';
    // ✨ PERFECT+ (pplus 곡만, 2026-11-28): PERFECT 중에서도 한가운데
    if (word === 'perfect' && this.lap.pplus && Math.abs(dt) <= PPLUS_SEC) word = 'pplus';
    const per = word === 'perfect' || word === 'pplus';
    // 콤보는 PERFECT(+) 만 쌓임 (2026-11-27 사용자)
    if (per) {
      this.combo++;
      this.perfect++;
      if (word === 'pplus') this.pplus++;
    } else this.combo = 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = tilePoints(word, this.combo);
    this.score += pts;
    this.coins += 1;
    this.hits++;
    this.lastHit[tl.lane] = t;
    this.press[tl.lane] = 1;
    this.comboAt = t;
    this.fx.judge.push({ at: t, word: word === 'pplus' ? 'PERFECT+' : word.toUpperCase(), n: this.combo, late: dt > 0 });
    this.fx.ring.push({ at: t, lane: tl.lane, row: tl.row, word: per ? 'perfect' : word, plus: word === 'pplus' });
    // 🪙 드럼처럼 판정선에서 코인이 튀어 올라 떨어짐
    this._dropCoins(tl.lane, per ? 2 : 1);
    if (tl.hold) {
      // 👆 누른 손가락 자리부터 (2026-11-27 사용자 '선에 맞춰 오르지 말고 내가 누른 위치에서')
      const yb = this.judgeY - (tl.row - this._rowAt(t)) * this.rowH;
      const a0 = clamp((yb - y) / this.rowH, 0, tl.rows);
      this.holds.push({ tile: tl, src, id, at: t, y0: y, fy: y, a0 });
      tl.fillRows = a0;
    }
  }

  /**
   * 「시작」 타일 (2026-11-27 사용자 '첫 타일 누르면 GREAT 뜨는데 아무것도 안 뜨게' · 건의 '시작 노트를 눌렀는데 없어져요'):
   *   판정 글자·고리 없이 PERFECT 점수만. 긴 타일(4·6번 곡)이어도 한 번 누르면 끝까지 친 것으로 (예전엔 톡 누르면 바로 옅어져 사라진 것처럼 보임)
   *   친 뒤엔 회색으로 남아 내려감. 대결은 「시작」을 누르지 않으니 0초에 저절로
   */
  _startHit(tl) {
    tl.hit = true;
    tl.hitAt = 0;
    tl.start = true;
    this.combo++;
    this.perfect++;
    if (this.lap.pplus) this.pplus++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += tilePoints(this.lap.pplus ? 'pplus' : 'perfect', this.combo);
    this.coins += 1;
    this.hits++;
    this.lastHit[tl.lane] = 0;
    if (tl.hold) {
      const bonus = tl.rows - 1;
      tl.done = true;
      tl.full = true;
      tl.fillRows = tl.rows;
      this.score += bonus * HOLD_PTS;
      this.coins += bonus;
    }
  }

  _dropCoins(lane, n, y = this.judgeY) {
    const rt = performance.now() / 1000;
    const u = this.laneW * 0.42;
    for (let i = 0; i < n; i++) {
      const side = n === 2 ? (i ? 1 : -1) : Math.random() < 0.5 ? -1 : 1;
      this.fx.drop.push({
        at: this.t,
        rt: rt + i * 0.04,
        x: (lane + 0.5) * this.laneW + side * u * 0.3,
        y,
        vx: side * u * (1.2 + Math.random() * 0.8),
        vy: -u * (2.4 + Math.random() * 0.8),
        spin: Math.random() * 6,
      });
    }
    this.coinBump = rt;
  }

  _coin(tl, t, x, y) {
    tl.hit = true;
    tl.hitAt = t;
    this.coins += 1;
    this.partyCoins += 1;
    this.lastHit[tl.lane] = t;
    this._dropCoins(tl.lane, 2, clamp(y, this.topNo, this.H - 20));
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
    const fr = full ? tl.rows : tl.fillRows || 0;
    // 덤 = 누른 자리부터 손가락까지 채운 줄 수 (아래쪽 첫 줄은 친 점수에 들어 있음). 타일 위쪽을 눌러 시작하면 그만큼 덜
    const bonus = full && h.a0 <= 1.5 ? tl.rows - 1 : clamp(Math.floor(fr - Math.max(1, h.a0) + 1e-6), 0, tl.rows - 1);
    tl.done = true;
    tl.fillRows = fr;
    tl.full = full;
    if (bonus > 0) {
      this.score += bonus * HOLD_PTS;
      this.coins += bonus;
      this.fx.pop.push({ at: this.t, lane: tl.lane, v: bonus * HOLD_PTS, y: h.fy });
      this._dropCoins(tl.lane, Math.min(4, bonus + 1), clamp(h.fy, this.topNo, this.judgeY));
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
    if (!this.invincible) this.hearts--;
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
      pplus: this.lap.pplus ? this.pplus : null,
      laps: this.lapsDone,
      stars,
      gems,
      maxCombo: this.maxCombo,
      missed: this.missed,
      wrong: this.wrong,
      per: this.lapEnd[0],
      complete: this.lapsDone >= this.maxLaps,
      died: this.hearts <= 0,
      won: this.won || null,
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
    if (this.state === 'ready') {
      // 🎬 자동 연주: 잠깐 보여 준 뒤 「시작」 타일을 저절로 누름
      if (this.auto && pn - this.readyAt > 700) {
        this._begin(pn, 0.03);
        this.state = 'playing';
        this._startHit(this.tiles[0]);
      } else return this._draw(0, dt);
    }
    if (this.state === 'count') {
      if (pn >= this.countUntil) {
        // 멈춘 자리부터 노래도 같이 (3·2·1 동안 준비)
        this._begin(pn, 0.04, this.pausedT);
        this.state = 'playing';
      } else return this._draw(this.pausedT, dt);
    }
    if (this.state === 'won') {
      // ⚔️ 상대가 먼저 쓰러짐 → 화면 멈추고 「승리!」 3초 뒤 결과 (2026-11-27 사용자 '갑자기 팍 꺼지면 좀 그래')
      this._draw(this.wonT, dt);
      this._drawWin(this.g);
      if (pn - this.wonPerf > WIN_MS) this._finish();
      return;
    }
    if (this.state === 'dying') {
      this._draw(this.diedAt, dt, true);
      if (pn - this.diedPerf > 1300) {
        // 틀리면 끝 — 광고 보고 한 번만 이어하기 (끝까지 돈 판·대결은 바로 끝)
        if (this.onDeath && !this.complete && this.hearts <= 0 && this.continues < 1) {
          this.state = 'dead';
          cancelAnimationFrame(this.raf);
          this.pausedT = this.diedAt;
          try {
            this.onDeath({ score: this.score, canContinue: true });
          } catch {
            this._finish();
          }
        } else this._finish();
      }
      return;
    }
    this._syncClock(pn);
    this._schedule();
    const t = this._time(pn);
    this.t = t;
    const cur = this._rowAt(t);
    // ⚔️ 대결은 「시작」을 누르지 않으니 첫 타일은 0초에 저절로 (예전엔 시작하자마자 첫 타일이 지나가 하트 1개라 둘 다 바로 죽었음)
    if (this.vs && t >= 0 && !this.tiles[0].hit && !this.tiles[0].miss) this._startHit(this.tiles[0]);
    if (this.auto && this.state === 'playing') this._autoPlay(t);
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
    // 꾹 누르는 긴 타일: 손가락 자리까지 차오름 (타일 위 끝이 손가락에 닿으면 끝)
    for (const h of this.holds.slice()) {
      const tl = h.tile;
      const yb = this.judgeY - (tl.row - cur) * this.rowH;
      const fr = clamp((yb - h.fy) / this.rowH, 0, tl.rows);
      tl.fillRows = Math.max(tl.fillRows || 0, fr);
      if (fr >= tl.rows - 0.06) this._holdDone(h, true);
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
        if (!this.mute) this.audio.fanfare();
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
    // ⚔️ 상대가 먼저 쓰러졌거나 나갔으면 이 판은 바로 끝 → 승리 (2026-11-27 사용자 '상대가 끝나면 바로 끝내야지')
    if (this.vs && this.vs.other && this.state === 'playing' && t > 0 && pn - (this._oppAt || 0) > 200) {
      this._oppAt = pn;
      let o = null;
      try {
        o = this.vs.other();
      } catch {}
      if (o && (o.died || o.left)) return this._win(t, o.left ? 'left' : 'died');
    }
    this._draw(this.floorT != null && t < this.floorT ? this.floorT : t, dt);
  }

  /** 🎬 자동 연주: PERFECT 한가운데 시각이 된 타일을 침, 긴 타일은 판정선에 손가락을 둔 채 끝까지 */
  _autoPlay(t) {
    for (let i = this.head; i < this.tiles.length; i++) {
      const tl = this.tiles[i];
      if (tl.t > t + 0.2) break;
      if (tl.hit || tl.miss || tl.coin) continue;
      const rps = Math.max(0.5, (this._rowAt(tl.t + 0.05) - this._rowAt(tl.t - 0.05)) / 0.1);
      const at = tl.t + clamp(PERFECT_ROWS / rps, 0.03, 0.11);
      if (t < at) break;
      this._hit(tl, at, (tl.lane + 0.5) * this.laneW, this.judgeY, 'auto', i);
    }
  }

  _win(t, why) {
    this.state = 'won';
    this.won = why;
    this.wonT = t;
    this.wonPerf = performance.now();
    this._endHolds();
    this.press.fill(0);
    this._hush(0.6);
    try {
      if (!this.mute) this.audio.fanfare();
    } catch {}
    this._draw(t, 0);
    this._drawWin(this.g);
  }

  /** 「승리!」 화면 (멈춘 판 위에) */
  _drawWin(g) {
    const { W, H } = this;
    const k = (performance.now() - this.wonPerf) / 1000;
    g.save();
    g.fillStyle = `rgba(28,16,64,${0.5 * Math.min(1, k / 0.25)})`;
    g.fillRect(0, 0, W, H);
    const cy = H * 0.42;
    // 뒤에서 천천히 도는 빛살
    g.save();
    g.translate(W / 2, cy);
    g.rotate(k * 0.5);
    g.globalAlpha = 0.16 * Math.min(1, k / 0.3);
    g.fillStyle = '#fff6c8';
    const R = Math.max(W, H) * 0.7;
    for (let i = 0; i < 12; i++) {
      g.rotate((Math.PI * 2) / 12);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-R * 0.09, -R);
      g.lineTo(R * 0.09, -R);
      g.closePath();
      g.fill();
    }
    g.restore();
    const rg = g.createRadialGradient(W / 2, cy, 0, W / 2, cy, W * 0.6);
    rg.addColorStop(0, `rgba(255,236,160,${0.4 * Math.min(1, k / 0.3)})`);
    rg.addColorStop(1, 'rgba(255,236,160,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    // 「승리!」 톡 튀어나옴
    const px = Math.min(88, W * 0.22);
    const s = k < 0.28 ? 0.4 + 0.8 * ease(k / 0.28) : 1.2 - 0.2 * ease(Math.min(1, (k - 0.28) / 0.25));
    g.save();
    g.translate(W / 2, cy);
    g.scale(s, s);
    g.font = font(px);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const gr = g.createLinearGradient(0, -px * 0.5, 0, px * 0.5);
    gr.addColorStop(0, '#fff6c8');
    gr.addColorStop(0.5, '#ffd23f');
    gr.addColorStop(1, '#ff9f1c');
    g.lineJoin = 'round';
    g.lineWidth = px * 0.16;
    g.strokeStyle = '#3b2a4a';
    g.strokeText('승리!', 0, 0);
    g.fillStyle = gr;
    g.fillText('승리!', 0, 0);
    g.restore();
    // 왜 이겼나
    g.globalAlpha = Math.min(1, Math.max(0, (k - 0.25) / 0.3));
    g.font = font(Math.min(20, W * 0.05));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    const nm = ((this.vs && this.vs.name) || '상대').slice(0, 10);
    g.fillText(this.won === 'left' ? '상대가 나갔어요' : `${nm} 님이 먼저 쓰러졌어요`, W / 2, cy + px * 0.85);
    g.restore();
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
    if (this.reel) this._drawReel(g);
    if (frozen) this._drawDying(g);
    g.restore();
    // 지난 효과 치우기 (가끔만)
    if (++this._gc > 30) {
      this._gc = 0;
      const old = t - 2.4;
      for (const k of Object.keys(this.fx)) if (this.fx[k].length) this.fx[k] = this.fx[k].filter((f) => f.at > old);
    }
  }

  /** 🎬 릴스 문구 (2026-11-28 사용자 '자막이 화면 가려, 드럼처럼'): 띠 없이 테두리 글씨만, 맨 위·맨 아래 가장자리에 작게.
   *  위 문구는 처음 5초만 보이다 사라짐(드럼 영상처럼) — 타일·점수·판정 글자 자리는 안 가림 */
  _drawReel(g) {
    const { W, H } = this;
    const r = this.reel;
    if (this._reelAt == null) this._reelAt = this.realT;
    const age = this.realT - this._reelAt;
    const line = (txt, y, px, color, alpha) => {
      if (!txt || alpha <= 0) return;
      g.save();
      g.globalAlpha = alpha;
      g.font = font(px);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const fp = px * Math.min(1, (W * 0.92) / Math.max(1, g.measureText(txt).width));
      g.font = font(fp);
      g.lineJoin = 'round';
      g.lineWidth = fp * 0.22;
      g.strokeStyle = 'rgba(20,14,48,0.85)';
      g.strokeText(txt, W / 2, y);
      g.fillStyle = color;
      g.fillText(txt, W / 2, y);
      g.restore();
    };
    const fade = clamp((5 - age) / 0.6, 0, 1);
    line(r.top, H * 0.026, Math.min(26, W * 0.058), '#fff', fade);
    if (r.label) line(r.label, H * 0.026 + Math.min(26, W * 0.058) * 1.05, Math.min(15, W * 0.034), '#FFD84A', fade);
    line(r.bottom, H * 0.972, Math.min(20, W * 0.045), '#fff', 0.9);
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
    // 판정 빛 (타일 밑에): 친 줄이 하얗게 은은히 (PERFECT 는 조금 더 길게)
    for (const r of this.fx.ring) {
      const k = (t - r.at) / 0.35;
      if (k < 0 || k > 1 || r.word === 'good') continue;
      const a = (r.word === 'perfect' ? 0.5 : 0.28) * (1 - ease(k));
      const ph = rowH * (r.word === 'perfect' ? 1.8 : 1.1);
      const pg = g.createLinearGradient(0, judgeY - ph, 0, judgeY);
      pg.addColorStop(0, 'rgba(255,255,255,0)');
      pg.addColorStop(1, `rgba(255,255,255,${a})`);
      g.fillStyle = pg;
      g.fillRect(r.lane * laneW, judgeY - ph, laneW, ph);
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
      if (tl.start && tl.hit) {
        g.fillStyle = 'rgba(22,18,44,0.3)';
        g.fillRect(x, y, tw, th);
        continue;
      }
      if (tl.hold) {
        this._drawHold(g, tl, x, y, tw, th, yb);
        continue;
      }
      if (tl.hit) {
        // 친 타일: 하얗게 번쩍 → 옅게 남아 내려감
        const k = (t - tl.hitAt) / 0.16;
        if (k < 1) {
          g.globalAlpha = 1 - k;
          g.drawImage(S.tile[tl.lane], x, y, tw, S.th);
          g.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
          g.fillRect(x, y, tw, th);
          g.globalAlpha = 1;
        }
        g.fillStyle = `rgba(255,255,255,${0.22 * Math.min(1, k)})`;
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
    // 판정선 위 하얀 고리 + 선 따라 번쩍 (판정마다 크기가 다름)
    for (const r of this.fx.ring) {
      const k = (t - r.at) / (r.word === 'perfect' ? 0.42 : 0.32);
      if (k < 0 || k > 1) continue;
      const cx = (r.lane + 0.5) * laneW;
      const big = r.word === 'perfect' ? 1 : r.word === 'great' ? 0.75 : 0.55;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#ffffff';
      g.lineWidth = (r.word === 'perfect' ? 4 : 2.5) * (1 - k) + 1;
      g.beginPath();
      g.ellipse(cx, judgeY, laneW * (0.22 + 0.36 * ease(k)) * big, laneW * (0.08 + 0.12 * ease(k)) * big, 0, 0, Math.PI * 2);
      g.stroke();
      if (r.word === 'perfect') {
        const fw = laneW * (0.5 + 0.7 * ease(k));
        const lg = g.createLinearGradient(cx - fw, 0, cx + fw, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, 'rgba(255,255,255,1)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(cx - fw, judgeY - 1.5, fw * 2, 3);
      }
      g.restore();
    }
    // 긴 타일 끝까지 눌렀을 때 +N (손가락 자리 옆에서 톡)
    for (const p of this.fx.pop) {
      const k = (t - p.at) / 0.9;
      if (k < 0 || k > 1) continue;
      const s = k < 0.15 ? 0.6 + 0.6 * ease(k / 0.15) : 1.2 - 0.2 * ease((k - 0.15) / 0.3);
      g.save();
      g.globalAlpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      g.translate(clamp((p.lane + 0.5) * laneW, laneW * 0.62, W - laneW * 0.62), clamp((p.y ?? H * 0.72) - rowH * 0.5, this.topNo + 40, H - 40) - k * 50);
      g.scale(s, s);
      const txt = `+${p.v.toLocaleString()}`;
      g.font = disp(Math.min(30, laneW * 0.3));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const [ac] = this._accent(p.lane);
      g.shadowColor = ac;
      g.shadowBlur = 10;
      g.fillStyle = '#ffffff';
      g.fillText(txt, 0, 0);
      g.restore();
    }
    // 🪙 떨어지는 코인 (드럼 화면과 같은 모양 — 빙글 돌며 튀었다 떨어짐)
    this._drawDrops(g);
  }

  _drawDrops(g) {
    const list = this.fx.drop;
    if (!list.length) return;
    const rt = this.realT;
    const u = this.laneW * 0.42;
    const grav = u * 14;
    const r = Math.max(5, u * 0.2);
    for (const c of list) {
      const t = rt - c.rt;
      if (t < 0 || t > DROP_SEC) continue;
      const x = c.x + c.vx * t;
      const y = c.y + c.vy * t + 0.5 * grav * t * t;
      const sx = Math.abs(Math.cos(c.spin + t * 14));
      g.save();
      g.globalAlpha = t < DROP_SEC * 0.6 ? 1 : 1 - (t - DROP_SEC * 0.6) / (DROP_SEC * 0.4);
      g.translate(x, y);
      g.scale(Math.max(0.15, sx), 1);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = '#B57A00';
      g.fill();
      g.beginPath();
      g.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      g.fillStyle = '#FFD23F';
      g.fill();
      g.beginPath();
      g.arc(-r * 0.25, -r * 0.3, r * 0.28, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,230,0.9)';
      g.fill();
      g.restore();
    }
  }

  /** 긴 타일 (2026-11-27 사용자 '사진처럼, 너무 따라 하진 말고'): 위쪽 스킨 색 → 검정 몸통 + 가운데 빛 줄 + 아래 빛 고리.
   *   누르면 타일 아래부터 손가락 자리까지 밝게 차오르고, 고리가 손가락 자리에서 빛남 */
  _drawHold(g, tl, x, y, w, h, yb) {
    const done = tl.done || (tl.hit && !this.holds.some((q) => q.tile === tl));
    const holding = tl.hit && !done;
    const [ac, al] = this._accent(tl.lane);
    const rowH = this.rowH;
    const cx = x + w / 2;
    g.save();
    if (done) {
      // 다 친 긴 타일: 친 타일처럼 옅게 (끝까지 눌렀으면 스킨 색으로 살짝)
      g.globalAlpha = tl.full ? 0.22 : 0.13;
      g.fillStyle = tl.full ? ac : '#000';
      g.fillRect(x, y, w, h);
      g.restore();
      return;
    }
    // 몸통: 위 스킨 색 → 아래 검정
    const bg = g.createLinearGradient(0, y, 0, yb);
    bg.addColorStop(0, ac);
    bg.addColorStop(Math.min(0.5, (rowH * 0.9) / h), '#0d1530');
    bg.addColorStop(1, '#000000');
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(x, y, w, 2);
    // 차오른 만큼 (아래부터 손가락 자리까지)
    const fr = tl.hit ? clamp(tl.fillRows || 0, 0, tl.rows) : 0;
    const topY = yb - fr * rowH;
    if (fr > 0) {
      const fg = g.createLinearGradient(0, topY, 0, yb);
      fg.addColorStop(0, al);
      fg.addColorStop(Math.min(0.35, 0.5 * rowH / Math.max(1, yb - topY)), ac);
      fg.addColorStop(1, ac);
      g.globalAlpha = done ? 0.3 : 0.92;
      g.fillStyle = fg;
      g.fillRect(x, topY, w, yb - topY);
      g.globalAlpha = done ? 0.35 : 1;
      if (holding) {
        // 차오르는 끝: 하얀 빛
        const eg = g.createLinearGradient(0, topY - 14, 0, topY + 6);
        eg.addColorStop(0, 'rgba(255,255,255,0)');
        eg.addColorStop(0.7, 'rgba(255,255,255,0.95)');
        eg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = eg;
        g.fillRect(x, topY - 14, w, 20);
      }
    }
    // 고리 자리: 안 눌렀으면 맨 아래 줄 가운데, 누르는 중이면 손가락 자리
    const R = Math.min(w * 0.17, rowH * 0.17);
    const ry = holding ? clamp(topY, y + R, yb - R * 0.2) : yb - rowH * 0.5;
    // 가운데 빛 줄 (고리 위 ~ 타일 위 끝)
    const lineTop = y + Math.max(4, rowH * 0.08);
    if (ry - R > lineTop) {
      const lg = g.createLinearGradient(0, lineTop, 0, ry - R);
      lg.addColorStop(0, 'rgba(255,255,255,0.15)');
      lg.addColorStop(1, holding ? 'rgba(255,255,255,0.9)' : `rgba(255,255,255,0.55)`);
      g.fillStyle = lg;
      g.fillRect(cx - 1, lineTop, 2, ry - R - lineTop);
    }
    if (!done) {
      const pulse = holding ? 1.1 + 0.08 * Math.sin(this.realT * 16) : 1;
      g.shadowColor = al;
      g.shadowBlur = holding ? 22 : 12;
      g.lineWidth = Math.max(3, R * 0.24);
      g.strokeStyle = holding ? '#ffffff' : al;
      g.beginPath();
      g.arc(cx, ry, R * pulse, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = holding ? '#ffffff' : 'rgba(0,0,0,0.55)';
      g.beginPath();
      g.arc(cx, ry, R * pulse * (holding ? 0.42 : 0.72), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // ======== 위 정보 (진행 줄 · 별/다이아 · 점수 · 코인 · 하트) — 2026-11-27 사용자 '점수·별 디자인이 하찮아' 다시 ========
  _drawHud(g, t) {
    const { W, H } = this;
    const rt = this.realT;
    // 진행 줄: 첫 바퀴 = 별 3개(1/3·2/3·끝), 그 뒤 = 다이아 3개(빨라진 곡 하나 끝낼 때마다 하나), 코인 파티 = 금빛
    const by = Math.max(30, H * 0.062);
    const x0 = W * 0.17;
    const x1 = W * 0.8;
    const party = this.coinParty && this.state === 'playing' && this._inParty(t) && this.lapsDone === 1;
    const gems = this.lapsDone >= 1;
    let p = 0;
    if (this.state !== 'ready') {
      if (party && this.partyRange) p = clamp((t - this.partyRange.t0) / (this.partyRange.t1 - this.partyRange.t0), 0, 1);
      else if (!gems) p = clamp(this.doneSong / Math.max(1, this.lapEnd[0]), 0, 1);
      else {
        const k = Math.min(this.lapsDone, this.lapEnd.length - 1);
        const lapP = clamp((this.doneSong - this.lapEnd[k - 1]) / Math.max(1, this.lapEnd[k] - this.lapEnd[k - 1]), 0, 1);
        // 줄은 다이아 칸 3개 기준 (2바퀴 영상이면 다이아 1개 자리까지만, 2026-11-28 사용자 '다이아 한 개만 차야 하는데 끝까지 감')
        p = clamp((this.lapsDone - 1 + (this.lapsDone >= this.maxLaps ? 0 : lapP)) / 3, 0, 1);
      }
    }
    // 진행 줄 (사진 느낌, 2026-11-27): 가는 하얀 선 + 빛나는 점, 지난 만큼 금빛으로 빛남
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x0, by);
    g.lineTo(x1, by);
    g.stroke();
    const fx = x0 + (x1 - x0) * p;
    const glow = party ? '#ffcf3a' : gems ? '#7fe3ff' : '#ffd84a';
    if (p > 0) {
      g.shadowColor = glow;
      g.shadowBlur = 10;
      g.strokeStyle = party ? '#fff3c2' : gems ? '#e6fbff' : '#fff6cf';
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(x0, by);
      g.lineTo(fx, by);
      g.stroke();
    }
    // 시작 점 · 지금 자리 점
    g.shadowColor = glow;
    g.shadowBlur = 12;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x0, by, 5.5, 0, Math.PI * 2);
    g.fill();
    if (p > 0.01) {
      g.beginPath();
      g.arc(fx, by, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // 별 · 다이아 · 코인 (받으면 톡 커지며 하얀 조각이 튐)
    for (let i = 1; i <= 3; i++) {
      const x = x0 + ((x1 - x0) * i) / 3;
      const on = i <= (gems ? this.gemsNow : this.starsNow);
      const ev = this.fx.icon.find((f) => f.gem === gems && f.i === i - 1);
      const kk = ev ? clamp((t - ev.at) / 0.6, 0, 1) : 1;
      hudIcon(g, x, by, Math.max(13, W * 0.04), party ? 'coin' : gems ? 'gem' : 'star', party || on, on && kk < 1 ? kk : 1);
    }
    // 점수 (가운데 위, 사진 느낌): 크고 둥근 하얀 숫자 + 은은한 그림자, 오르면 살짝 톡
    const sTxt = Math.round(this.shown).toLocaleString();
    const pop = this.comboAt != null ? 1 + 0.08 * (1 - ease((t - this.comboAt) / 0.16)) : 1;
    const px = Math.min(56, W * 0.135);
    const sy = by + Math.max(22, H * 0.03);
    g.save();
    g.translate(W / 2, sy + px * 0.5);
    g.font = disp(px);
    // 점수가 길어지면 하트·코인 칸과 안 겹치게 줄임
    const fit = Math.min(1, (W - 2 * (30 + TILE_HEARTS * (Math.min(24, W * 0.06) + 5))) / Math.max(1, g.measureText(sTxt).width));
    g.scale(pop * fit, pop * fit);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const sh = bgHues(this.hue)[1];
    g.shadowColor = `hsla(${sh},65%,28%,0.4)`;
    g.shadowBlur = 12;
    g.shadowOffsetY = 3;
    g.fillStyle = '#ffffff';
    g.fillText(sTxt, 0, 0);
    g.shadowColor = 'transparent';
    const sg = g.createLinearGradient(0, -px * 0.45, 0, px * 0.45);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(1, `hsla(${sh},80%,90%,0.5)`);
    g.fillStyle = sg;
    g.fillText(sTxt, 0, 0);
    g.restore();
    // 🪙 코인 (오른쪽, 일시정지 버튼 밑): 반투명 하얀 칩 — 코인이 생기면 톡 커짐
    const cy = Math.max(78, H * 0.105);
    const cTxt = Math.round(this.coinShown).toLocaleString();
    g.save();
    g.font = disp(Math.min(18, W * 0.046), 600);
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const tw = g.measureText(cTxt).width;
    const bx = W - 14 - tw - 32;
    g.fillStyle = 'rgba(255,255,255,0.26)';
    rr(g, bx - 8, cy - 15, tw + 48, 30, 15);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.lineWidth = 1.2;
    g.stroke();
    const ck = rt - this.coinBump;
    const cb = ck >= 0 && ck < 0.2 ? 1 + 0.35 * Math.sin((ck / 0.2) * Math.PI) : 1;
    coin(g, bx + 10, cy, 11 * cb);
    g.shadowColor = 'rgba(40,20,90,0.3)';
    g.shadowBlur = 4;
    g.fillStyle = '#fff';
    g.fillText(cTxt, W - 14, cy + 1);
    g.restore();
    // 하트 (왼쪽)
    const hs = Math.min(24, W * 0.06);
    for (let i = 0; i < TILE_HEARTS; i++) {
      const on = i < this.hearts;
      const ev = this.hurtFx && this.hurtFx.heart === i ? this.hurtFx : null;
      let sz = 1;
      if (ev) {
        const k = (t - ev.at) / 0.45;
        if (k >= 0 && k < 1) sz = ev.heal ? 1 + 0.5 * (1 - ease(k)) : 1 + 0.35 * Math.sin(k * Math.PI);
      }
      heart(g, 20 + i * (hs + 5) + hs / 2, cy, hs * sz, on);
    }
    if (this.vs) this._drawVs(g, cy + 24);
  }

  /** PERFECT ×연속 (점수 밑) — 2026-11-27 사용자 'PERFECT 글씨 구려, 사진 느낌으로':
   *   둥근 굵은 글자에 파스텔 그라데이션 + 하얀 테두리, 뒤에 반투명 유리 조각이 퍼짐, ×연속은 하얀 숫자. GREAT·GOOD 엔 빨라요/늦어요 */
  _drawJudge(g, t) {
    const j = this.fx.judge[this.fx.judge.length - 1];
    if (!j) return;
    const per = j.word === 'PERFECT' || j.word === 'PERFECT+';
    const plus = j.word === 'PERFECT+';
    const life = per ? 0.75 : 0.6;
    const k = (t - j.at) / life;
    if (k < 0 || k > 1) return;
    const { W, H } = this;
    const th = judgeTheme(this.skin.key, this.skin.palette);
    // 2026-11-27 사용자 'PERFECT 글씨 너무 커' → 예전(46·W×0.115)의 3/4쯤
    const px = Math.min(34, W * 0.084);
    const y = Math.max(76, H * 0.105) + Math.min(56, W * 0.135) + px * 1.1;
    const a = k > 0.7 ? (1 - k) / 0.3 : 1;
    const k1 = clamp(k / 0.16, 0, 1);
    const s = (per ? 1 : 0.85) * (k1 < 1 ? 0.6 + 0.5 * ease(k1) - 0.1 * Math.max(0, k1 - 0.6) / 0.4 : 1 + 0.02 * (k - 0.16));
    g.save();
    g.globalAlpha = a;
    g.translate(W / 2, y);
    g.scale(s, s);
    if (th.italic) g.transform(1, 0, -0.2, 1, 0, 0); // 기울인 글씨 (라이브 세트·사이버)
    g.font = disp(px);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = g.measureText(j.word).width;
    if (per && th.fx === 'streak') {
      // 🎤 라이브: 글자 뒤로 하얀 빛줄기가 가로로 스치고, 작은 마름모 반짝이
      const sk = ease(clamp(k / 0.35, 0, 1));
      const len = tw * (0.7 + 0.6 * sk);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, `rgba(255,255,255,${0.75 * (1 - k)})`);
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(-len, -px * 0.07, len * 2, px * 0.14);
      for (const [dx, dy, r] of [[-0.62, -0.62, 0.16], [0.58, 0.5, 0.12], [0.66, -0.7, 0.09]]) {
        const rr = px * r * (0.6 + 0.6 * Math.sin(Math.PI * clamp(k * 1.6, 0, 1)));
        g.save();
        g.translate(tw * dx, px * dy);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(0, -rr * 1.6);
        g.lineTo(rr * 0.5, 0);
        g.lineTo(0, rr * 1.6);
        g.lineTo(-rr * 0.5, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    } else if (per) {
      // 유리 조각 (판정마다 모양이 조금씩 다름): 글자 뒤에서 살짝 퍼짐 — 스킨 색으로 물듦
      let seed = Math.floor(j.at * 977) % 233280 || 7;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      const spread = ease(k / 0.5);
      const shards = [
        [-tw * 0.42, px * 0.05, px * 1.15, -0.35, -1],
        [tw * 0.32, -px * 0.62, px * 0.55, 0.9, 1],
        [tw * 0.18, px * 0.55, px * 0.5, 2.4, 1],
        [-tw * 0.05, -px * 0.75, px * 0.38, -1.6, -1],
      ];
      for (const [sx, sy, sz, rot, dir] of shards) {
        const r1 = 0.75 + rnd() * 0.5;
        g.save();
        g.translate(sx + dir * spread * px * 0.25, sy + Math.sign(sy || 1) * spread * px * 0.15);
        g.rotate(rot + dir * spread * 0.25);
        g.beginPath();
        g.moveTo(-sz, -sz * 0.18 * r1);
        g.lineTo(sz * 0.9, -sz * 0.42);
        g.lineTo(sz * 0.3 * r1, sz * 0.4);
        g.closePath();
        const sgr = g.createLinearGradient(-sz, -sz * 0.4, sz, sz * 0.4);
        sgr.addColorStop(0, 'rgba(255,255,255,0.42)');
        sgr.addColorStop(1, `rgba(${th.glass},0.14)`);
        g.fillStyle = sgr;
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.lineWidth = 1.4;
        g.lineJoin = 'round';
        g.stroke();
        g.restore();
      }
    }
    const gr = g.createLinearGradient(-tw / 2, -px * 0.3, tw / 2, px * 0.3);
    // ✨ PERFECT+ = 무지개 금빛 글자 + 금빛 빛 + 반짝이 (스킨과 상관없이 늘 같음 — 한눈에 PERFECT 와 구분)
    const cs = plus ? PPLUS_COLORS : per ? th.perfect : j.word === 'GREAT' ? th.great : th.good;
    cs.forEach((c, i) => gr.addColorStop(i / (cs.length - 1), c));
    g.lineJoin = 'round';
    g.shadowColor = plus ? 'rgba(255,190,40,0.95)' : per ? th.shadow : 'rgba(40,60,160,0.35)';
    g.shadowBlur = plus ? 18 : per && th.fx === 'streak' ? 14 : 10;
    g.shadowOffsetY = th.fx === 'streak' ? 0 : 2;
    g.lineWidth = px * 0.15;
    g.strokeStyle = th.stroke;
    g.strokeText(j.word, 0, 0);
    g.shadowColor = 'transparent';
    g.fillStyle = gr;
    g.fillText(j.word, 0, 0);
    // 윗면 광택
    const hg = g.createLinearGradient(0, -px * 0.45, 0, px * 0.1);
    hg.addColorStop(0, `rgba(255,255,255,${th.gloss})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillText(j.word, 0, 0);
    if (plus) {
      // 반짝이 네 개가 글자 둘레에서 톡톡
      for (const [dx, dy, r0, d] of [[-0.56, -0.5, 0.2, 0], [0.54, -0.55, 0.16, 0.08], [0.6, 0.45, 0.13, 0.04], [-0.5, 0.5, 0.11, 0.12]]) {
        const kk = clamp((k - d) / 0.5, 0, 1);
        const rr = px * r0 * Math.sin(Math.PI * kk);
        if (rr <= 0.2) continue;
        g.save();
        g.translate(tw * dx, px * dy);
        g.fillStyle = '#fffbe0';
        g.shadowColor = 'rgba(255,200,60,0.9)';
        g.shadowBlur = 8;
        g.beginPath();
        for (let q = 0; q < 8; q++) {
          const ang = (q * Math.PI) / 4;
          const rad = q % 2 ? rr * 0.32 : rr;
          g.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    if (!per) {
      // 빨라요 / 늦어요 (왜 PERFECT 가 아닌지)
      g.font = font(px * 0.44);
      g.shadowColor = 'rgba(30,20,80,0.4)';
      g.shadowBlur = 4;
      g.fillStyle = '#ffffff';
      g.fillText(j.late ? '늦어요' : '빨라요', 0, px * 0.88);
      g.shadowColor = 'transparent';
    }
    g.restore();
    if (j.n < 2) return;
    const ck = clamp(k / 0.14, 0, 1);
    const cs2 = 0.7 + 0.3 * ease(ck) + 0.12 * Math.sin(ck * Math.PI);
    g.save();
    g.globalAlpha = a;
    if (th.combo === 'live') {
      // 🎤 라이브: 판정 글자 밑에 「COMBO」 + 큰 기울인 숫자 (파스텔 그라데이션 · 하얀 빛)
      g.translate(W / 2, y + px * 1.35);
      g.scale(cs2, cs2);
      g.transform(1, 0, -0.2, 1, 0, 0);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = disp(px * 0.36, 600);
      g.shadowColor = 'rgba(255,255,255,0.9)';
      g.shadowBlur = 6;
      g.fillStyle = '#ffffff';
      g.fillText('C O M B O', 0, -px * 0.02);
      g.font = disp(px * 1.05);
      const nw = g.measureText(String(j.n)).width;
      const ng = g.createLinearGradient(-nw / 2, 0, nw / 2, 0);
      th.perfect.forEach((c, i) => ng.addColorStop(i / (th.perfect.length - 1), c));
      g.shadowColor = th.shadow;
      g.shadowBlur = 12;
      g.lineWidth = px * 0.13;
      g.strokeStyle = '#ffffff';
      g.lineJoin = 'round';
      g.strokeText(String(j.n), 0, px * 0.72);
      g.shadowColor = 'transparent';
      g.fillStyle = ng;
      g.fillText(String(j.n), 0, px * 0.72);
      g.restore();
      return;
    }
    // ×연속: 글자 오른쪽 아래에 숫자 (스킨 색 그림자)
    g.translate(W / 2 + (tw * s) * 0.22, y + px * 0.95);
    g.scale(cs2, cs2);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.shadowColor = th.shadow;
    g.shadowBlur = 8;
    g.shadowOffsetY = 2;
    g.fillStyle = th.comboFill;
    g.font = disp(px * 0.5, 600);
    g.fillText('×', 0, px * 0.04);
    const xw = g.measureText('×').width;
    g.font = disp(px * 0.82);
    g.fillText(String(j.n), xw + px * 0.06, 0);
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
    g.fillStyle = '#2b2440';
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
      if (this.coinParty) {
        shows.push({ at: this.partyAt, party: 1 });
        shows.push({ at: Math.max(this.partyRange.c1 + 0.35, this.partyAt + 1.5), speed: 1 });
      } else shows.push({ at: Math.max(this.partyRange.c1, this.partyAt + 0.2), speed: 1 });
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
          const q = 3 + rnd() * 6;
          g.save();
          g.translate(x, y);
          g.rotate(rnd() * 3 + k * 2);
          g.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.4})`;
          g.fillRect(-q / 2, -q / 2, q, q);
          g.restore();
        }
      }
      const s = 0.7 + 0.4 * ease(k / 0.25);
      g.translate(W / 2, cy);
      g.scale(s, s);
      const big = Math.min(46, W * 0.115);
      if (f.v === 1) {
        g.shadowColor = 'rgba(80,40,160,0.3)';
        g.shadowBlur = 10;
        for (let i = 0; i < 3; i++) star(g, (i - 1) * big * 1.15, -big * 0.75, big * 0.55, '#ffffff');
        g.shadowColor = 'transparent';
      }
      else if (f.v >= 2) {
        const n = Math.min(3, f.v - 1);
        for (let i = 0; i < 3; i++) {
          const gx = (i - 1) * big * 1.3;
          const gy = -(i === 1 ? big * 0.3 : 0) - big * 0.5;
          if (i < n) gem(g, gx, gy, big * 0.55);
          else gemOutline(g, gx, gy, big * 0.55);
        }
      }
      else if (f.party) for (let i = 0; i < 3; i++) coin(g, (i - 1) * big * 1.3, -(i === 1 ? big * 0.3 : 0) - big * 0.5, big * 0.5);
      const msg = f.party ? 'COIN PARTY!' : f.speed ? '더 빨라져요!' : f.v >= this.maxLaps ? 'COMPLETE!' : ['', 'EXCELLENT!', 'AMAZING!', 'FANTASTIC!'][f.v] || 'GREAT!';
      g.font = f.speed ? font(Math.min(34, W * 0.085)) : disp(Math.min(44, W * 0.11));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tw = g.measureText(msg).width;
      const gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
      if (f.party) {
        gr.addColorStop(0, '#ffc83a');
        gr.addColorStop(1, '#ff8a3d');
      } else if (f.speed) {
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, '#ffffff');
      } else {
        gr.addColorStop(0, '#a95cff');
        gr.addColorStop(1, '#2f8cff');
      }
      g.lineJoin = 'round';
      g.shadowColor = 'rgba(60,30,140,0.35)';
      g.shadowBlur = 10;
      g.shadowOffsetY = 2;
      g.lineWidth = f.speed ? 0 : 5;
      g.strokeStyle = '#ffffff';
      if (!f.speed) g.strokeText(msg, 0, big * 0.5);
      if (!f.speed) g.shadowColor = 'transparent';
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
/** 배경 두 색: 노랑·연두(밝아서 흰 글자가 안 보임)는 주황·분홍 쪽으로, 나머지는 옆 색으로 흐름 */
function bgHues(h) {
  h = ((h % 360) + 360) % 360;
  if (h >= 35 && h < 110) h = h < 70 ? 25 : 150;
  return h < 100 ? [h, h - 40] : [h, h + 48];
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
/** 하트: 켜짐 = 빨강 그라데이션 + 광택 + 테두리, 꺼짐 = 옅은 빈 하트 */
function heart(g, cx, cy, s, on) {
  g.save();
  g.translate(cx, cy);
  g.scale(s / 24, s / 24);
  g.beginPath();
  g.moveTo(0, 9);
  g.bezierCurveTo(-15, -1, -11, -15, 0, -6.5);
  g.bezierCurveTo(11, -15, 15, -1, 0, 9);
  g.closePath();
  if (on) {
    const gr = g.createLinearGradient(0, -12, 0, 9);
    gr.addColorStop(0, '#ff8aa5');
    gr.addColorStop(1, '#e8164a');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(-5.5, -6, 3, 2, -0.6, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = 'rgba(60,50,100,0.1)';
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(60,50,100,0.25)';
    g.stroke();
  }
  g.restore();
}
/** ✦ 네 갈래 반짝이 */
function sparkle(g, x, y, r, color) {
  if (r <= 0.5) return;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}
/**
 * 진행 줄 아이콘 (별·다이아·코인, 2026-11-27 사진 느낌): 받으면 노란 별 / 하늘색 다이아, 아직이면 반투명 하얀 모양.
 *   받은 순간(kk 0→1)엔 톡 커지며 작은 하얀 조각이 튐
 */
function hudIcon(g, x, y, r, kind, on, kk) {
  g.save();
  if (on && kk < 1) {
    g.save();
    g.globalAlpha = 1 - kk;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const d = r * (0.9 + 1.6 * ease(kk));
      const q = r * 0.16 * (1 - kk * 0.5);
      g.save();
      g.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      g.rotate(a + kk * 3);
      g.fillRect(-q, -q, q * 2, q * 2);
      g.restore();
    }
    g.restore();
  }
  const sc = on && kk < 1 ? 1 + 0.45 * Math.sin(Math.min(1, kk * 1.6) * Math.PI) : 1;
  g.translate(x, y);
  g.scale(sc, sc);
  if (kind === 'coin') {
    g.shadowColor = 'rgba(255,190,40,0.8)';
    g.shadowBlur = 10;
    coin(g, 0, 0, r * 0.8);
  } else if (kind === 'gem') {
    if (on) {
      g.shadowColor = 'rgba(80,200,255,0.85)';
      g.shadowBlur = 12;
      gem(g, 0, r * 0.02, r * 0.78);
    } else {
      gemPath(g, 0, r * 0.02, r * 0.78);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 1.8;
      g.lineJoin = 'round';
      g.stroke();
    }
  } else if (on) {
    g.shadowColor = 'rgba(255,170,0,0.75)';
    g.shadowBlur = 10;
    const sg = g.createLinearGradient(0, -r, 0, r);
    sg.addColorStop(0, '#fff3a0');
    sg.addColorStop(0.55, '#ffd23a');
    sg.addColorStop(1, '#ffae1f');
    star(g, 0, r * 0.06, r * 1.02, sg, 'rgba(230,140,0,0.55)');
  } else {
    g.shadowColor = 'rgba(60,40,140,0.2)';
    g.shadowBlur = 4;
    star(g, 0, r * 0.06, r * 0.95, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.9)');
  }
  g.restore();
}
/**
 * 🎨 타일 스킨 (2026-11-27 사용자 '스킨은 타일을 좀 꾸며줘'): 바탕은 어두운 색(잘 보이게) + 스킨마다 무늬.
 *   key = 콩 스킨(NOTE_PALETTES 키) · 'live'·'s1' 세트 · 'basic'. pal = [main, light, dark] (그 줄 색)
 */
function paintTileSkin(g, w, h, key, pal, lane) {
  // 2026-11-27 사용자 '스킨들 너무 대충 꾸민 감, 특히 시즌 1 「1」 이 너무 구려' → 다시 그림:
  //   바탕은 어둡게(배경 위에서 잘 보이게) + 유리 광택·안쪽 테두리를 모든 스킨에 같이, 무늬는 작고 또렷하게
  let seed = 11 + lane * 97;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const m = Math.min(w, h);
  const vgrad = (stops) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  };
  const radial = (x, y, r, c0, c1 = 'rgba(0,0,0,0)') => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c0);
    rg.addColorStop(1, c1);
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  };
  /** 모든 스킨 공통 마감: 위쪽 유리 광택 + 안쪽 가는 테두리 + 아래쪽 빛 띠(색) */
  const finish = (edge = 'rgba(255,255,255,0.1)', glow = null) => {
    const sg = g.createLinearGradient(0, 0, 0, h * 0.28);
    sg.addColorStop(0, 'rgba(255,255,255,0.2)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, w, h * 0.28);
    if (glow) {
      const bg = g.createLinearGradient(0, h * 0.82, 0, h);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(1, glow);
      g.fillStyle = bg;
      g.fillRect(0, h * 0.82, w, h * 0.18);
    }
    g.strokeStyle = edge;
    g.lineWidth = 1;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  };
  const glint = (x, y, r, c = '#ffffff') => {
    g.save();
    g.shadowColor = c;
    g.shadowBlur = r * 1.5;
    sparkle(g, x, y, r, c);
    g.restore();
  };
  switch (key) {
    case 'flame': {
      vgrad([[0, '#1c0804'], [0.55, '#070201'], [1, '#000']]);
      // 아래에서 넘실대는 불길: 빨강 → 주황 → 노랑 세 겹을 더해서 (lighter)
      g.save();
      g.globalCompositeOperation = 'lighter';
      const layer = (n, hk, c0, c1, wk) => {
        for (let i = 0; i < n; i++) {
          const cx = w * ((i + 0.5) / n) + (rnd() - 0.5) * w * 0.12;
          const fh = h * hk * (0.75 + rnd() * 0.5);
          const fw = w * wk * (0.8 + rnd() * 0.4);
          const fg = g.createLinearGradient(0, h - fh, 0, h);
          fg.addColorStop(0, c0);
          fg.addColorStop(1, c1);
          g.fillStyle = fg;
          const tip = cx + (rnd() - 0.5) * fw * 0.8;
          g.beginPath();
          g.moveTo(cx - fw, h);
          g.bezierCurveTo(cx - fw * 1.05, h - fh * 0.45, tip - fw * 0.35, h - fh * 0.7, tip, h - fh);
          g.bezierCurveTo(tip + fw * 0.35, h - fh * 0.65, cx + fw * 1.05, h - fh * 0.4, cx + fw, h);
          g.closePath();
          g.fill();
        }
      };
      layer(4, 0.42, 'rgba(200,30,10,0)', 'rgba(220,40,10,0.85)', 0.2);
      layer(3, 0.3, 'rgba(255,120,20,0)', 'rgba(255,130,30,0.85)', 0.2);
      layer(3, 0.17, 'rgba(255,230,120,0)', 'rgba(255,240,170,0.9)', 0.13);
      // 불티
      for (let i = 0; i < 9; i++) {
        const r = 0.8 + rnd() * 1.4;
        g.fillStyle = `rgba(255,${170 + rnd() * 70},70,${0.5 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(w * (0.1 + rnd() * 0.8), h * (0.3 + rnd() * 0.42), r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      finish('rgba(255,150,70,0.28)');
      break;
    }
    case 'ice': {
      vgrad([[0, '#174d73'], [0.4, '#0a2840'], [1, '#030b14']]);
      // 크리스탈: 아래에서 솟은 각진 결정 + 면마다 밝기 다르게
      const crystal = (cx, base, cw, ch, tilt) => {
        const tipX = cx + tilt;
        const tipY = base - ch;
        const pts = [[cx - cw, base], [cx - cw * 0.9, base - ch * 0.62], [tipX, tipY], [cx + cw * 0.9, base - ch * 0.62], [cx + cw, base]];
        const cg = g.createLinearGradient(cx - cw, tipY, cx + cw, base);
        cg.addColorStop(0, 'rgba(210,248,255,0.75)');
        cg.addColorStop(0.5, 'rgba(110,200,245,0.45)');
        cg.addColorStop(1, 'rgba(40,110,170,0.25)');
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fillStyle = cg;
        g.fill();
        g.strokeStyle = 'rgba(225,250,255,0.75)';
        g.lineWidth = 1;
        g.stroke();
        // 가운데 모서리 (면이 나뉘어 보이게)
        g.beginPath();
        g.moveTo(tipX, tipY);
        g.lineTo(cx + tilt * 0.3, base);
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath();
        g.moveTo(tipX, tipY);
        g.lineTo(cx - cw * 0.9, base - ch * 0.62);
        g.lineTo(cx - cw, base);
        g.lineTo(cx + tilt * 0.3, base);
        g.closePath();
        g.fill();
      };
      crystal(w * 0.3, h + 2, w * 0.14, h * 0.34, -w * 0.04);
      crystal(w * 0.72, h + 2, w * 0.12, h * 0.26, w * 0.05);
      crystal(w * 0.52, h + 2, w * 0.18, h * 0.46, 0);
      // 위쪽 서리
      const fg = g.createLinearGradient(0, 0, 0, h * 0.16);
      fg.addColorStop(0, 'rgba(235,252,255,0.7)');
      fg.addColorStop(1, 'rgba(235,252,255,0)');
      g.fillStyle = fg;
      g.fillRect(0, 0, w, h * 0.16);
      glint(w * 0.52, h * 0.55, m * 0.07);
      glint(w * 0.25, h * 0.3, m * 0.045);
      finish('rgba(190,240,255,0.35)');
      break;
    }
    case 'heart': {
      vgrad([[0, '#4c0f33'], [0.5, '#1d0513'], [1, '#050003']]);
      radial(w / 2, h * 0.6, m * 0.75, 'rgba(255,90,160,0.35)');
      const hp = (x, y, s) => {
        g.beginPath();
        g.moveTo(x, y + s * 0.38);
        g.bezierCurveTo(x - s * 0.62, y - s * 0.05, x - s * 0.46, y - s * 0.62, x, y - s * 0.27);
        g.bezierCurveTo(x + s * 0.46, y - s * 0.62, x + s * 0.62, y - s * 0.05, x, y + s * 0.38);
        g.closePath();
      };
      // 작은 하트 (테두리만, 옅게)
      g.strokeStyle = 'rgba(255,170,210,0.35)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        hp(w * (0.15 + rnd() * 0.7), h * (0.12 + rnd() * 0.32), m * (0.14 + rnd() * 0.08));
        g.stroke();
      }
      // 가운데 큰 하트: 광택 있는 젤리
      const S = m * 0.62;
      const cx = w / 2;
      const cy = h * 0.62;
      g.save();
      g.shadowColor = 'rgba(255,80,160,0.8)';
      g.shadowBlur = 14;
      hp(cx, cy, S);
      const hg = g.createLinearGradient(0, cy - S * 0.6, 0, cy + S * 0.4);
      hg.addColorStop(0, '#ffa6d2');
      hg.addColorStop(0.5, '#ff4f9a');
      hg.addColorStop(1, '#b8135f');
      g.fillStyle = hg;
      g.fill();
      g.restore();
      hp(cx, cy, S);
      g.strokeStyle = 'rgba(255,220,238,0.8)';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.ellipse(cx - S * 0.2, cy - S * 0.2, S * 0.11, S * 0.06, -0.7, 0, Math.PI * 2);
      g.fill();
      glint(cx + S * 0.32, cy - S * 0.38, m * 0.06);
      finish('rgba(255,170,210,0.4)');
      break;
    }
    case 'cyber': {
      vgrad([[0, '#061522'], [1, '#000206']]);
      g.strokeStyle = 'rgba(0,240,255,0.07)';
      g.lineWidth = 1;
      for (let x = 8; x < w; x += 10) {
        g.beginPath();
        g.moveTo(x + 0.5, 0);
        g.lineTo(x + 0.5, h);
        g.stroke();
      }
      for (let y = 8; y < h; y += 10) {
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(w, y + 0.5);
        g.stroke();
      }
      // 칩 + 칩에서 뻗는 회로 (꺾이는 선 + 끝 점)
      const chip = m * 0.34;
      const ccx = w / 2;
      const ccy = h * 0.56;
      const trace = (pts, c) => {
        g.save();
        g.shadowColor = c;
        g.shadowBlur = 6;
        g.strokeStyle = c;
        g.lineWidth = 1.5;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        const [ex, ey] = pts[pts.length - 1];
        g.fillStyle = c;
        g.beginPath();
        g.arc(ex, ey, 2.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      };
      const C = 'rgba(0,240,255,0.9)';
      const M = 'rgba(255,60,220,0.9)';
      trace([[ccx - chip * 0.25, ccy - chip / 2], [ccx - chip * 0.25, h * 0.3], [w * 0.2, h * 0.3 - w * 0.12], [w * 0.2, h * 0.12]], C);
      trace([[ccx + chip * 0.25, ccy - chip / 2], [ccx + chip * 0.25, h * 0.36], [w * 0.8, h * 0.36 - w * 0.1], [w * 0.8, h * 0.2]], M);
      trace([[ccx, ccy + chip / 2], [ccx, h * 0.78], [w * 0.3, h * 0.78 + w * 0.12], [w * 0.3, h * 0.92]], C);
      trace([[ccx + chip / 2, ccy], [w * 0.86, ccy], [w * 0.86, h * 0.72]], C);
      g.save();
      g.shadowColor = 'rgba(0,240,255,0.7)';
      g.shadowBlur = 10;
      g.fillStyle = '#0b2433';
      g.fillRect(ccx - chip / 2, ccy - chip / 2, chip, chip);
      g.restore();
      g.strokeStyle = 'rgba(120,250,255,0.95)';
      g.lineWidth = 1.5;
      g.strokeRect(ccx - chip / 2, ccy - chip / 2, chip, chip);
      g.fillStyle = 'rgba(0,240,255,0.25)';
      g.fillRect(ccx - chip * 0.22, ccy - chip * 0.22, chip * 0.44, chip * 0.44);
      // 양옆 네온 테두리
      g.save();
      g.shadowBlur = 8;
      g.shadowColor = '#00f0ff';
      g.fillStyle = '#00f0ff';
      g.fillRect(0, 0, 2, h);
      g.shadowColor = '#ff2bd6';
      g.fillStyle = '#ff2bd6';
      g.fillRect(w - 2, 0, 2, h);
      g.restore();
      finish('rgba(0,240,255,0)');
      break;
    }
    case 'gold': {
      vgrad([[0, '#2a1f08'], [0.45, '#0f0b03'], [1, '#000']]);
      const gold = (x0, y0, x1, y1) => {
        const fg = g.createLinearGradient(x0, y0, x1, y1);
        fg.addColorStop(0, '#fff3c0');
        fg.addColorStop(0.35, '#ffcf4a');
        fg.addColorStop(0.65, '#b98300');
        fg.addColorStop(1, '#ffe08a');
        return fg;
      };
      // 비스듬한 빛 한 줄기
      const sh = g.createLinearGradient(0, h * 0.2, w, h * 0.5);
      sh.addColorStop(0, 'rgba(255,215,90,0)');
      sh.addColorStop(0.5, 'rgba(255,215,90,0.14)');
      sh.addColorStop(1, 'rgba(255,215,90,0)');
      g.fillStyle = sh;
      g.fillRect(0, 0, w, h);
      // 두 줄 금테 + 모서리 장식
      g.strokeStyle = gold(0, 0, w, h);
      g.lineWidth = 2;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.lineWidth = 0.8;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = gold(0, 0, w, h);
      for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) {
        g.beginPath();
        g.moveTo(x, y - 4);
        g.lineTo(x + 4, y);
        g.lineTo(x, y + 4);
        g.lineTo(x - 4, y);
        g.closePath();
        g.fill();
      }
      // 가운데 왕관
      const cw = m * 0.3;
      const cx = w / 2;
      const cy = h * 0.6;
      g.save();
      g.shadowColor = 'rgba(255,200,60,0.7)';
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(cx - cw, cy + cw * 0.45);
      g.lineTo(cx - cw * 1.05, cy - cw * 0.45);
      g.lineTo(cx - cw * 0.5, cy);
      g.lineTo(cx, cy - cw * 0.7);
      g.lineTo(cx + cw * 0.5, cy);
      g.lineTo(cx + cw * 1.05, cy - cw * 0.45);
      g.lineTo(cx + cw, cy + cw * 0.45);
      g.closePath();
      g.fillStyle = gold(cx - cw, cy - cw, cx + cw, cy + cw);
      g.fill();
      g.restore();
      g.fillRect(cx - cw, cy + cw * 0.55, cw * 2, cw * 0.22);
      g.fillStyle = '#fff8dc';
      for (const [x, y] of [[cx - cw * 1.05, cy - cw * 0.45], [cx, cy - cw * 0.7], [cx + cw * 1.05, cy - cw * 0.45]]) {
        g.beginPath();
        g.arc(x, y, cw * 0.11, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ff5a7a';
      g.beginPath();
      g.arc(cx, cy + cw * 0.12, cw * 0.12, 0, Math.PI * 2);
      g.fill();
      glint(cx + cw * 0.7, cy - cw * 0.9, m * 0.05, '#fff6c8');
      finish('rgba(255,215,90,0)');
      break;
    }
    case 'galaxy': {
      vgrad([[0, '#0c0628'], [1, '#03010c']]);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const neb = (x, y, r, c) => radial(x, y, r, c);
      neb(w * 0.25, h * 0.3, h * 0.42, 'rgba(160,90,255,0.45)');
      neb(w * 0.8, h * 0.62, h * 0.4, 'rgba(60,190,255,0.35)');
      neb(w * 0.45, h * 0.12, h * 0.25, 'rgba(255,110,210,0.3)');
      neb(w * 0.5, h * 0.48, h * 0.18, 'rgba(255,255,255,0.12)');
      g.restore();
      for (let i = 0; i < 26; i++) {
        const r = rnd() < 0.18 ? 1.3 : 0.7;
        g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
        g.fill();
      }
      glint(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.3), m * 0.08);
      glint(w * (0.2 + rnd() * 0.6), h * (0.62 + rnd() * 0.2), m * 0.045);
      finish('rgba(200,170,255,0.3)', 'rgba(0,0,0,0.5)');
      break;
    }
    case 's1': {
      // 🥇 시즌 1: 남색 벨벳 + 가는 금테 + 월계수로 둘러싼 금메달 속 「1」 (예전 크고 뚱뚱한 「1」 은 없앰)
      vgrad([[0, '#22337d'], [0.5, '#101a4d'], [1, '#050a24']]);
      radial(w / 2, h * 0.55, m * 0.8, 'rgba(90,120,255,0.28)');
      const gold = (y0, y1) => {
        const fg = g.createLinearGradient(0, y0, 0, y1);
        fg.addColorStop(0, '#fff5c8');
        fg.addColorStop(0.45, '#ffd24a');
        fg.addColorStop(0.75, '#c08a00');
        fg.addColorStop(1, '#ffe48a');
        return fg;
      };
      g.strokeStyle = 'rgba(255,215,110,0.75)';
      g.lineWidth = 1;
      g.strokeRect(5, 5, w - 10, h - 10);
      // 작은 별 몇 개
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(255,236,170,${0.35 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(w * (0.12 + rnd() * 0.76), h * (0.1 + rnd() * 0.25), 0.6 + rnd() * 0.8, 0, Math.PI * 2);
        g.fill();
      }
      const cx = w / 2;
      const cy = h * 0.56;
      const R = m * 0.27;
      // 월계수 (양쪽으로 잎이 둥글게)
      g.fillStyle = gold(cy - R * 1.4, cy + R * 1.4);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 2 + side * (0.55 + i * 0.36);
          const lx = cx + Math.cos(a) * R * 1.32;
          const ly = cy + Math.sin(a) * R * 1.32;
          g.save();
          g.translate(lx, ly);
          g.rotate(a + side * 1.25);
          g.beginPath();
          g.ellipse(0, 0, R * 0.26, R * 0.1, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      // 메달
      g.save();
      g.shadowColor = 'rgba(255,200,60,0.6)';
      g.shadowBlur = 10;
      g.fillStyle = gold(cy - R, cy + R);
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const ig = g.createLinearGradient(0, cy - R, 0, cy + R);
      ig.addColorStop(0, '#2c3f96');
      ig.addColorStop(1, '#121c55');
      g.fillStyle = ig;
      g.beginPath();
      g.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,230,150,0.7)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(cx, cy, R * 0.7, 0, Math.PI * 2);
      g.stroke();
      g.font = `700 ${Math.round(R * 1.05)}px Georgia, 'Times New Roman', serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = gold(cy - R * 0.5, cy + R * 0.5);
      g.fillText('1', cx, cy + R * 0.06);
      // 아래 작은 글씨
      g.font = `600 ${Math.max(7, Math.round(m * 0.085))}px ${DISP}`;
      g.fillStyle = 'rgba(255,225,140,0.85)';
      g.fillText('SEASON', cx, cy + R * 1.75);
      glint(cx + R * 0.72, cy - R * 0.72, m * 0.05, '#fff6c8');
      finish('rgba(255,215,110,0)');
      break;
    }
    case 'live': {
      vgrad([[0, '#262a58'], [0.5, '#0e1026'], [1, '#04050c']]);
      // 위에서 내려오는 무대 조명 두 줄기
      g.save();
      g.globalCompositeOperation = 'lighter';
      const beam = (x0, x1, c) => {
        const bg = g.createLinearGradient(0, 0, 0, h * 0.85);
        bg.addColorStop(0, c);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(x0 - w * 0.05, 0);
        g.lineTo(x0 + w * 0.05, 0);
        g.lineTo(x1 + w * 0.22, h * 0.85);
        g.lineTo(x1 - w * 0.22, h * 0.85);
        g.closePath();
        g.fill();
      };
      beam(w * 0.2, w * 0.45, 'rgba(255,138,216,0.35)');
      beam(w * 0.8, w * 0.55, 'rgba(125,242,255,0.3)');
      g.restore();
      // 양옆 파스텔 빛 테두리
      const eg = g.createLinearGradient(0, 0, 0, h);
      eg.addColorStop(0, '#ff8ad8');
      eg.addColorStop(0.5, '#7df2ff');
      eg.addColorStop(1, '#b996ff');
      g.save();
      g.shadowColor = '#c9a8ff';
      g.shadowBlur = 8;
      g.fillStyle = eg;
      g.fillRect(0, 0, 2, h);
      g.fillRect(w - 2, 0, 2, h);
      g.restore();
      glint(w * 0.5, h * 0.7, m * 0.06);
      finish('rgba(255,255,255,0)', 'rgba(185,150,255,0.35)');
      break;
    }
    default: {
      if (pal && key !== 'basic') {
        // 색 콩 스킨: 위쪽이 그 색 → 아래로 어둡게 + 아래쪽 빛 띠
        vgrad([[0, pal[0]], [0.38, pal[2]], [0.78, '#07070b'], [1, '#000']]);
        g.fillStyle = pal[1];
        g.globalAlpha = 0.9;
        g.fillRect(0, 0, w, 2);
        g.globalAlpha = 1;
        finish('rgba(255,255,255,0.12)', hexA(pal[0], 0.45));
      } else {
        // 기본: 검정, 위쪽만 살짝 빛
        vgrad([[0, '#2a2a33'], [0.16, '#08080b'], [1, '#000']]);
      }
    }
  }
}
function hexA(hex, a) {
  const n = parseInt(String(hex).slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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
