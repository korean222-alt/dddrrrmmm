// 🎼 악보 파일(MIDI · MusicXML · .mxl) → 유저 맵 (폰 안에서만 읽음, 서버엔 음표 JSON 만)
//   외부 라이브러리 없음: MIDI 는 직접 읽고, MusicXML 은 작은 XML 읽개, .mxl(zip)은 브라우저 DecompressionStream 으로 풂.
//
//   악보 → { ppq, bpm, timeSig, title, tracks: [{ name, isDrum, notes: [{ tick, dur, midi }] }] }
//   맵   → scoreToMap(score, { melody, start, bars }) = { bpm, mel(마디별 음표), prog, drums, found }
//     멜로디 = 고른 트랙의 16분 칸마다 가장 위 음 (셋잇단 같은 건 가까운 칸으로)
//     코드   = 나머지 트랙 음으로 반 마디마다 (mk.prog 형식 'C' / 'Am F')
//     드럼   = 드럼 트랙(MIDI 채널 10 · MusicXML 타악기) → 쿵·짝·하이햇·크래시 4줄

import { STEPS_PER_BAR } from './charts.js';
import { cellChar, drumCell, MAP_LIMITS } from './usermap.js';

const PPQ = 480; // MusicXML 을 바꿀 때 쓰는 4분음표 틱

// ---------------- MIDI ----------------
/** .mid 바이트 → 악보 */
export function parseMidi(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let p = 0;
  const str = (n) => String.fromCharCode(...u.subarray(p, p + n));
  const u32 = () => ((u[p++] << 24) | (u[p++] << 16) | (u[p++] << 8) | u[p++]) >>> 0;
  const u16 = () => (u[p++] << 8) | u[p++];
  const vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = u[p++];
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };
  // RIFF 로 싸인 .rmi 도 있음
  let start = 0;
  for (; start < Math.min(u.length - 4, 200); start++) if (u[start] === 0x4d && u[start + 1] === 0x54 && u[start + 2] === 0x68 && u[start + 3] === 0x64) break;
  p = start;
  if (str(4) !== 'MThd') throw new Error('MIDI 파일이 아니에요');
  p += 4;
  const hlen = u32();
  const hEnd = p + hlen;
  const format = u16();
  const ntr = u16();
  const div = u16();
  if (div & 0x8000) throw new Error('이 MIDI 형식(SMPTE)은 못 읽어요');
  p = hEnd;
  const ppq = div || 480;
  const groups = new Map(); // `${트랙}:${채널}` → 트랙
  const tempos = [];
  let timeSig = null;
  let title = '';
  for (let t = 0; t < ntr && p + 8 <= u.length; t++) {
    const id = str(4);
    p += 4;
    const len = u32();
    const end = Math.min(u.length, p + len);
    if (id !== 'MTrk') {
      p = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    let name = '';
    const on = new Map(); // `${ch}:${key}` → [{ tick }]
    const programs = {};
    const get = (ch) => {
      const k = format === 0 ? `0:${ch}` : `${t}:${ch}`;
      if (!groups.has(k)) groups.set(k, { track: t, channel: ch, name: '', program: null, isDrum: ch === 9, notes: [] });
      return groups.get(k);
    };
    const off = (ch, key) => {
      const st = on.get(`${ch}:${key}`);
      if (!st || !st.length) return;
      const s = st.shift();
      get(ch).notes.push({ tick: s.tick, dur: Math.max(1, tick - s.tick), midi: key, vel: s.vel });
    };
    while (p < end) {
      tick += vlq();
      let b = u[p];
      if (b & 0x80) {
        p++;
        if (b < 0xf0) status = b;
      } else b = status;
      if (b === 0xff) {
        const type = u[p++];
        const l = vlq();
        const d = u.subarray(p, p + l);
        p += l;
        if (type === 0x51 && l === 3) tempos.push({ tick, bpm: 60e6 / ((d[0] << 16) | (d[1] << 8) | d[2]) });
        else if (type === 0x58 && l >= 2 && !timeSig) timeSig = [d[0], 2 ** d[1]];
        else if (type === 0x03 && !name) name = decodeText(d);
        else if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        p += vlq();
        continue;
      }
      if (!(b & 0x80)) break; // 망가진 곳
      const ch = b & 0x0f;
      const hi = b & 0xf0;
      const d1 = u[p++];
      const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : u[p++];
      if (hi === 0x90 && d2 > 0) {
        const k = `${ch}:${d1}`;
        if (!on.has(k)) on.set(k, []);
        on.get(k).push({ tick, vel: d2 });
      } else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) off(ch, d1);
      else if (hi === 0xc0) programs[ch] = d1;
    }
    // 안 꺼진 음은 한 박으로
    for (const [k, st] of on) for (const s of st) get(Number(k.split(':')[0])).notes.push({ tick: s.tick, dur: ppq, midi: Number(k.split(':')[1]), vel: s.vel });
    for (const g of groups.values()) if (g.track === t || format === 0) {
      if (!g.name) g.name = name;
      if (g.program == null && programs[g.channel] != null) g.program = programs[g.channel];
    }
    if (t === 0 && name && format === 1) title = name;
    p = end;
  }
  tempos.sort((a, b) => a.tick - b.tick);
  const tracks = [...groups.values()].filter((g) => g.notes.length).map((g) => ({ ...g, notes: g.notes.sort((a, b) => a.tick - b.tick || b.midi - a.midi) }));
  // 트랙 0 이름이 곡 이름(악기 없는 트랙)일 때만 제목으로
  if (title && tracks.some((tr) => tr.track === 0)) title = '';
  return { ppq, bpm: tempos.length ? tempos[0].bpm : 120, tempoChanges: new Set(tempos.map((x) => Math.round(x.bpm))).size > 1, timeSig: timeSig || [4, 4], title, tracks };
}
function decodeText(d) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(d).trim();
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(d).trim();
    } catch {
      return String.fromCharCode(...d).trim();
    }
  }
}

// ---------------- 작은 XML 읽개 ----------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));
/** XML 글 → { name, attrs, kids, text } 나무 */
export function parseXml(src) {
  const root = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] != null) top.text += m[1];
    else if (m[2]) {
      for (let i = stack.length - 1; i > 0; i--)
        if (stack[i].name === m[2]) {
          stack.length = i;
          break;
        }
    } else if (m[3]) {
      const el = { name: m[3], attrs: {}, kids: [], text: '' };
      for (const a of (m[4] || '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) el.attrs[a[1]] = unent(a[2] ?? a[3]);
      top.kids.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] != null && stack.length > 1) top.text += unent(m[6]);
  }
  return root;
}
const kid = (el, name) => el && el.kids.find((k) => k.name === name);
const kidsOf = (el, name) => (el ? el.kids.filter((k) => k.name === name) : []);
const txt = (el, name) => {
  const k = kid(el, name);
  return k ? k.text.trim() : '';
};
const find = (el, name) => {
  if (!el) return null;
  for (const k of el.kids) {
    if (k.name === name) return k;
    const f = find(k, name);
    if (f) return f;
  }
  return null;
};
const findAll = (el, name, out = []) => {
  for (const k of el.kids) {
    if (k.name === name) out.push(k);
    findAll(k, name, out);
  }
  return out;
};

// ---------------- MusicXML ----------------
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 드럼 악보의 줄 위치(display-step) → GM 드럼 번호 (악기 정보가 없을 때) */
function drumFromDisplay(midi) {
  if (midi <= 65) return 36; // F4 이하 = 베이스드럼
  if (midi <= 74) return 38; // C5 근처 = 스네어
  if (midi <= 79) return 42; // G5 = 하이햇
  return 49; // A5 위 = 크래시
}
/** MusicXML 글 → 악보 (score-partwise) */
export function parseMusicXml(src) {
  const doc = parseXml(src);
  let score = find(doc, 'score-partwise');
  if (!score) {
    if (find(doc, 'score-timewise')) throw new Error('timewise MusicXML 은 못 읽어요 (partwise 로 저장해 주세요)');
    throw new Error('MusicXML 파일이 아니에요');
  }
  const title = txt(kid(score, 'work'), 'work-title') || txt(score, 'movement-title') || '';
  // 파트 정보 (이름, 타악기 번호)
  const info = {};
  for (const sp of findAll(kid(score, 'part-list') || score, 'score-part')) {
    const inst = {};
    let ch10 = false;
    for (const mi of kidsOf(sp, 'midi-instrument')) {
      const un = Number(txt(mi, 'midi-unpitched'));
      if (un) inst[mi.attrs.id] = un - 1;
      if (txt(mi, 'midi-channel') === '10') ch10 = true;
    }
    info[sp.attrs.id] = { name: txt(sp, 'part-name') || txt(sp, 'part-abbreviation'), inst, ch10 };
  }
  let bpm = null;
  let timeSig = null;
  const tempoSet = new Set();
  const tracks = [];
  let pad = null; // 못갖춘마디(앞 마디가 짧음) → 첫 마디가 제자리에 오게 앞에 쉼
  for (const part of kidsOf(score, 'part')) {
    const pi = info[part.attrs.id] || { name: '', inst: {}, ch10: false };
    const byStaff = new Map();
    const tr = (staff, drum) => {
      const k = `${staff}:${drum ? 1 : 0}`;
      if (!byStaff.has(k)) byStaff.set(k, { name: pi.name, staff, isDrum: drum, notes: [] });
      return byStaff.get(k);
    };
    let divisions = 1;
    let beats = 4;
    let beatType = 4;
    let mStart = 0;
    let first = true;
    const tiesOpen = new Map(); // `${staff}:${midi}` → 음 (이어붙임줄)
    for (const meas of kidsOf(part, 'measure')) {
      let pos = 0;
      let maxPos = 0;
      let lastStart = 0;
      for (const el of meas.kids) {
        if (el.name === 'attributes') {
          const d = Number(txt(el, 'divisions'));
          if (d > 0) divisions = d;
          const tm = kid(el, 'time');
          if (tm && txt(tm, 'beats')) {
            beats = Number(txt(tm, 'beats').split('+').reduce((a, b) => a + Number(b), 0)) || 4;
            beatType = Number(txt(tm, 'beat-type')) || 4;
            if (!timeSig) timeSig = [beats, beatType];
          }
        } else if (el.name === 'direction' || el.name === 'sound') {
          const snd = el.name === 'sound' ? el : find(el, 'sound');
          let t = snd && Number(snd.attrs.tempo);
          if (!t) {
            const mt = find(el, 'metronome');
            const pm = mt && Number(txt(mt, 'per-minute'));
            if (pm) {
              const unit = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 }[txt(mt, 'beat-unit')] || 1;
              t = pm * unit * (kid(mt, 'beat-unit-dot') ? 1.5 : 1);
            }
          }
          if (t > 0) {
            if (bpm == null) bpm = t;
            tempoSet.add(Math.round(t));
          }
        } else if (el.name === 'backup') pos -= (Number(txt(el, 'duration')) * PPQ) / divisions;
        else if (el.name === 'forward') {
          pos += (Number(txt(el, 'duration')) * PPQ) / divisions;
          maxPos = Math.max(maxPos, pos);
        }
        else if (el.name === 'note') {
          const dur = (Number(txt(el, 'duration')) * PPQ) / divisions || 0;
          const isChord = !!kid(el, 'chord');
          if (kid(el, 'grace') || kid(el, 'cue')) continue;
          const at = isChord ? lastStart : pos;
          if (!isChord) {
            lastStart = pos;
            pos += dur;
          }
          maxPos = Math.max(maxPos, pos);
          if (kid(el, 'rest')) continue;
          const staff = Number(txt(el, 'staff')) || 1;
          const ties = kidsOf(el, 'tie').map((t) => t.attrs.type);
          const pitch = kid(el, 'pitch');
          const unp = kid(el, 'unpitched');
          let midi;
          let drum = false;
          if (pitch) {
            midi = 12 * (Number(txt(pitch, 'octave')) + 1) + STEP_PC[txt(pitch, 'step')] + Math.round(Number(txt(pitch, 'alter')) || 0);
            if (pi.ch10 && !Object.keys(pi.inst).length) (drum = true), (midi = drumFromDisplay(midi));
          } else if (unp) {
            drum = true;
            const ins = kid(el, 'instrument');
            midi = ins && pi.inst[ins.attrs.id] != null ? pi.inst[ins.attrs.id] : drumFromDisplay(12 * (Number(txt(unp, 'display-octave')) + 1) + (STEP_PC[txt(unp, 'display-step')] ?? 0));
          } else continue;
          if (!Number.isFinite(midi)) continue;
          const key = `${staff}:${midi}`;
          if (!drum && ties.includes('stop') && tiesOpen.has(key)) {
            const n = tiesOpen.get(key);
            n.dur = mStart + at + dur - n.tick;
            if (!ties.includes('start')) tiesOpen.delete(key);
            continue;
          }
          const n = { tick: Math.round(mStart + at), dur: Math.max(1, Math.round(dur)), midi };
          tr(staff, drum).notes.push(n);
          if (!drum && ties.includes('start')) tiesOpen.set(key, n);
        }
      }
      const nominal = (beats * 4 * PPQ) / beatType;
      // 마디 길이는 박자표대로 (파트끼리 맞게). 못갖춘마디(implicit·첫 마디가 짧음)만 실제 길이
      const short = maxPos > 0 && maxPos < nominal - 1 && (meas.attrs.implicit === 'yes' || first);
      const len = short ? maxPos : Math.max(nominal, maxPos);
      if (first && pad == null) pad = len < nominal - 1 && len > 0 ? nominal - len : 0;
      first = false;
      mStart += len;
    }
    for (const t of byStaff.values()) if (t.notes.length) tracks.push(t);
  }
  // 한 파트에 줄(오른손·왼손)이 여럿이면 이름에 붙여 구분
  const multi = new Set(tracks.filter((t) => t.staff > 1).map((t) => t.name));
  for (const t of tracks) {
    if (multi.has(t.name) && !t.isDrum) t.name = `${t.name || '파트'} ${t.staff === 1 ? '(위 줄)' : `(${t.staff}번째 줄)`}`;
    for (const n of t.notes) n.tick += pad || 0;
    t.notes.sort((a, b) => a.tick - b.tick || b.midi - a.midi);
  }
  return { ppq: PPQ, bpm: bpm || 120, tempoChanges: tempoSet.size > 1, timeSig: timeSig || [4, 4], title, tracks };
}

// ---------------- .mxl (zip) ----------------
async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 .mxl 압축을 못 풀어요. .musicxml 로 저장해서 넣어 주세요');
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([data]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
/** zip 바이트 → { 이름: () => Promise<Uint8Array> } */
export function readZip(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) throw new Error('zip 파일이 아니에요');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    const lh = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = u.subarray(lh, lh + csize);
    files[name] = () => (method === 0 ? Promise.resolve(data) : method === 8 ? inflateRaw(data) : Promise.reject(new Error('못 푸는 압축 방식')));
  }
  return files;
}
function xmlText(u) {
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u);
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u);
  return new TextDecoder('utf-8').decode(u);
}

/** 파일 바이트 + 이름 → 악보 (MIDI · MusicXML · mxl 자동 구분) */
export async function readScoreFile(bytes, name = '') {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const head = String.fromCharCode(...u.subarray(0, 4));
  if (head === 'MThd' || head === 'RIFF' || /\.(mid|midi|kar|rmi)$/i.test(name)) return parseMidi(u);
  if (head.startsWith('PK')) {
    const files = readZip(u);
    let path = null;
    if (files['META-INF/container.xml']) {
      const c = parseXml(xmlText(await files['META-INF/container.xml']()));
      const rf = find(c, 'rootfile');
      if (rf && files[rf.attrs['full-path']]) path = rf.attrs['full-path'];
    }
    path = path || Object.keys(files).find((f) => !f.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(f));
    if (!path) throw new Error('.mxl 안에 악보가 없어요');
    return parseMusicXml(xmlText(await files[path]()));
  }
  return parseMusicXml(xmlText(u));
}

// ---------------- 악보 → 맵 ----------------
const isHint = (s, re) => re.test(String(s || ''));
const MEL_HINT = /melod|vocal|voice|vox|lead|sing|solo|soprano|tenor|flute|violin\s*i\b|treble|right|멜로디|보컬|노래|주선율|오른손/i;
const NOT_MEL = /bass|drum|perc|pad|chord|comp|accomp|string|left|베이스|드럼|반주|코드|왼손/i;

/** 4분음표가 맵에서 몇 박인지 (BPM 을 60~180 에 맞추려고 반·두 배) */
function tempoFit(bpm) {
  let f = 1;
  let b = bpm;
  while (b > MAP_LIMITS.maxBpm) (b /= 2), (f *= 2);
  while (b < MAP_LIMITS.minBpm) (b *= 2), (f /= 2);
  return { bpm: b, f };
}

/** 악보 요약: 트랙 목록(드럼 아닌 것) · 추천 멜로디 · 전체 마디 수 · 첫 음 마디 */
export function scoreInfo(score) {
  const { f, bpm } = tempoFit(score.bpm);
  const step = (score.ppq * f) / 4;
  const barTicks = step * STEPS_PER_BAR;
  const mel = [];
  score.tracks.forEach((t, i) => {
    if (t.isDrum || !t.notes.length) return;
    const ps = t.notes.map((n) => n.midi).sort((a, b) => a - b);
    const starts = new Set(t.notes.map((n) => Math.round(n.tick / step)));
    const first = Math.min(...t.notes.map((n) => n.tick));
    mel.push({ index: i, name: t.name, count: t.notes.length, lo: ps[0], hi: ps[ps.length - 1], median: ps[Math.floor(ps.length / 2)], mono: starts.size / t.notes.length, firstBar: Math.floor(first / barTicks + 0.01) });
  });
  const maxCount = Math.max(1, ...mel.map((m) => m.count));
  let guess = -1;
  let best = -Infinity;
  for (const m of mel) {
    if (m.count < Math.max(8, maxCount * 0.12)) continue;
    // 높은 음 + 한 음씩(화음 적음) + 이름이 멜로디스러우면
    const s = m.median + 12 * m.mono + (isHint(m.name, MEL_HINT) ? 14 : 0) - (isHint(m.name, NOT_MEL) ? 18 : 0) + Math.min(6, Math.log2(m.count));
    if (s > best) (best = s), (guess = m.index);
  }
  if (guess < 0 && mel.length) guess = mel.reduce((a, b) => (b.count > a.count ? b : a)).index;
  let last = 0;
  let firstTick = Infinity;
  for (const t of score.tracks)
    for (const n of t.notes) {
      last = Math.max(last, n.tick + n.dur);
      firstTick = Math.min(firstTick, n.tick);
    }
  return {
    melodyTracks: mel,
    guess,
    hasDrums: score.tracks.some((t) => t.isDrum && t.notes.length),
    totalBars: Math.max(1, Math.ceil(last / barTicks - 0.01)),
    firstBar: Number.isFinite(firstTick) ? Math.floor(firstTick / barTicks) : 0,
    bpm,
  };
}

const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_P = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_P = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
/** 반 마디마다 울리는 음(크로마·가장 낮은 음) → 코드 */
export function chordsFromNotes(halves) {
  const tot = new Array(12).fill(0);
  for (const h of halves) for (let i = 0; i < 12; i++) tot[i] += h.chroma[i];
  if (!tot.some((x) => x)) return null;
  let key = 0;
  let minor = false;
  let bk = -Infinity;
  for (let k = 0; k < 12; k++)
    for (const [prof, mn] of [
      [MAJOR_P, false],
      [MINOR_P, true],
    ]) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += tot[(i + k) % 12] * prof[i];
      if (s > bk) (bk = s), (key = k), (minor = mn);
    }
  const tonic = minor ? (key + 3) % 12 : key;
  const dia = new Set([0, 2, 4, 5, 7, 9, 11].map((d) => (tonic + d) % 12));
  const chords = [];
  for (let r = 0; r < 12; r++)
    for (const q of [0, 1]) {
      const tones = [r, (r + (q ? 3 : 4)) % 12, (r + 7) % 12];
      chords.push({ name: NOTE[r] + (q ? 'm' : ''), root: r, tones, prior: tones.every((t) => dia.has(t)) ? 0.08 : 0 });
    }
  let prev = null;
  const out = halves.map((h) => {
    const sum = h.chroma.reduce((a, b) => a + b, 0);
    if (!sum) return prev;
    let pick = null;
    let bs = -Infinity;
    for (const c of chords) {
      let inS = 0;
      for (const t of c.tones) inS += h.chroma[t];
      let s = inS / sum - (1 - inS / sum) * 0.6 + c.prior;
      if (h.bass === c.root) s += 0.18;
      else if (h.bass === c.tones[1] || h.bass === c.tones[2]) s += 0.04;
      if (prev && prev === c.name) s += 0.07;
      if (s > bs) (bs = s), (pick = c);
    }
    prev = pick.name;
    return pick.name;
  });
  // 앞쪽 소리 없는 곳은 첫 코드로
  const firstChord = out.find(Boolean);
  return out.map((c) => c || firstChord);
}

/** GM 드럼 번호 → 맵 악기 (K·S·H·C, 탐탐 등은 안 씀) */
export function gmDrum(n) {
  if (n === 35 || n === 36) return 'K';
  if (n === 37 || n === 38 || n === 39 || n === 40) return 'S';
  if (n === 42 || n === 44 || n === 46 || n === 51 || n === 53 || n === 59) return 'H';
  if (n === 49 || n === 52 || n === 55 || n === 57) return 'C';
  return null;
}

/**
 * 악보 → 맵 재료
 * @param {object} score readScoreFile 결과
 * @param {{ melody?: number, start?: number, bars?: number }} o melody = 트랙 번호(-1 = 멜로디 없음), start = 시작 마디(0부터), bars = 마디 수
 * @returns {{ bpm, mel, prog, drums, found, bars, start }}
 */
export function scoreToMap(score, { melody = null, start = null, bars = MAP_LIMITS.maxBars } = {}) {
  const info = scoreInfo(score);
  const { f } = tempoFit(score.bpm);
  const step = (score.ppq * f) / 4;
  const mIdx = melody == null ? info.guess : melody;
  const s0 = Math.max(0, Math.min(info.totalBars - 1, start == null ? info.firstBar : start));
  const n = Math.max(1, Math.min(MAP_LIMITS.maxBars, bars, info.totalBars - s0));
  const from = s0 * STEPS_PER_BAR;
  const to = from + n * STEPS_PER_BAR;
  const q = (tick) => Math.round(tick / step);
  // 🎹 멜로디: 16분 칸마다 시작하는 음 중 가장 위 → 다음 음 전까지
  const top = new Map(); // 칸 → { midi, end }
  const melTrack = score.tracks[mIdx];
  const used = new Set();
  if (melTrack && !melTrack.isDrum)
    for (const nn of melTrack.notes) {
      const s = q(nn.tick);
      if (s < from || s >= to) continue;
      const cur = top.get(s);
      if (!cur || nn.midi > cur.midi) {
        if (cur) used.delete(cur.ref);
        top.set(s, { midi: nn.midi, end: Math.max(s + 1, q(nn.tick + nn.dur)), ref: nn });
        used.add(nn);
      }
    }
  const steps = [...top.keys()].sort((a, b) => a - b);
  const mel = Array.from({ length: n }, () => []);
  let found = 0;
  steps.forEach((s, i) => {
    const t = top.get(s);
    const next = i + 1 < steps.length ? steps[i + 1] : to;
    const rel = s - from;
    const b = Math.floor(rel / STEPS_PER_BAR);
    const st = rel % STEPS_PER_BAR;
    let midi = t.midi;
    while (midi < 36) midi += 12;
    while (midi > 96) midi -= 12;
    const len = Math.max(1, Math.min(t.end, next, (b + 1) * STEPS_PER_BAR + from) - s);
    mel[b].push({ step: st, midi, len });
    found++;
  });
  // 🎸 코드: 나머지 트랙(드럼 빼고) + 멜로디 트랙의 아래 음. 멜로디는 살짝만
  const halves = Array.from({ length: n * 2 }, () => ({ chroma: new Array(12).fill(0), bass: -1, low: 999 }));
  let accN = 0;
  const addNote = (nn, w) => {
    const a = Math.max(from, nn.tick / step);
    const b = Math.min(to, (nn.tick + nn.dur) / step);
    for (let h = Math.max(0, Math.floor((a - from) / 8)); h < n * 2 && from + h * 8 < b; h++) {
      const ov = Math.min(b, from + h * 8 + 8) - Math.max(a, from + h * 8);
      if (ov <= 0) continue;
      halves[h].chroma[((nn.midi % 12) + 12) % 12] += ov * w;
      if (w >= 1 && nn.midi < halves[h].low) (halves[h].low = nn.midi), (halves[h].bass = ((nn.midi % 12) + 12) % 12);
    }
  };
  score.tracks.forEach((t, i) => {
    if (t.isDrum) return;
    for (const nn of t.notes) {
      if (i === mIdx && used.has(nn)) continue;
      addNote(nn, 1);
      accN++;
    }
  });
  let prog = null;
  if (accN >= 2) {
    if (melTrack && !melTrack.isDrum) for (const nn of used) addNote(nn, 0.25);
    const ch = chordsFromNotes(halves);
    if (ch) prog = Array.from({ length: n }, (_, b) => (ch[2 * b] === ch[2 * b + 1] ? ch[2 * b] : `${ch[2 * b]} ${ch[2 * b + 1]}`));
  }
  // 🥁 드럼 트랙 → 4줄
  let drums = null;
  const dTracks = score.tracks.filter((t) => t.isDrum);
  if (dTracks.length) {
    const cells = Array.from({ length: n * STEPS_PER_BAR }, () => '.');
    let hits = 0;
    for (const t of dTracks)
      for (const nn of t.notes) {
        const inst = gmDrum(nn.midi);
        const s = q(nn.tick) - from;
        if (!inst || s < 0 || s >= cells.length) continue;
        const c = drumCell(cells[s]);
        // 같은 엄지 겹침: 크래시 > 쿵, 짝 > 하이햇 (cellChar 규칙)
        c[inst] = true;
        cells[s] = cellChar(c);
        hits++;
      }
    if (hits >= 4) drums = Array.from({ length: n }, (_, b) => cells.slice(b * STEPS_PER_BAR, (b + 1) * STEPS_PER_BAR).join(''));
  }
  return { bpm: Math.round(info.bpm), mel, prog, drums, found, bars: n, start: s0, melodyIndex: mIdx };
}

/** 추천 시작 마디: 고른 멜로디가 처음 나오는 마디 (멜로디 없는 전주는 건너뜀) */
export function recommendStart(info, melody) {
  const t = info.melodyTracks.find((m) => m.index === melody);
  const b = t ? t.firstBar : info.firstBar;
  return Math.max(0, Math.min(b, info.totalBars - 1));
}
