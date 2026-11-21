// 🎞 영상 파일(mp4·mov)에서 소리(AAC)만 꺼내기 (폰 안에서만)
//   아이폰 사파리는 사진첩에서 고른 영상(.mov)을 decodeAudioData 로 못 풀고, 영상을 재생하며 받아 적는 방법은
//   영상 길이만큼 걸리고 중간에 멈추기도 함(11-21 '1분 40초 영상이 10초만 읽힘').
//   → 파일의 상자(moov/trak/stbl)를 읽어 소리 조각 위치를 알아내고, 조각마다 ADTS 머리(7바이트)를 붙여 .aac 로 만듦.
//   파일 전체를 메모리에 올리지 않고 필요한 부분만 읽음 (화면 녹화는 수백 MB)

const td = (u8, at) => String.fromCharCode(u8[at], u8[at + 1], u8[at + 2], u8[at + 3]);
const u32 = (u8, at) => ((u8[at] << 24) | (u8[at + 1] << 16) | (u8[at + 2] << 8) | u8[at + 3]) >>> 0;
const u64 = (u8, at) => u32(u8, at) * 4294967296 + u32(u8, at + 4);

async function readAt(file, pos, len) {
  return new Uint8Array(await file.slice(pos, pos + len).arrayBuffer());
}

/** u8[start, end) 안의 상자들 → [{ type, at(내용 시작), end }] */
function boxes(u8, start = 0, end = u8.length) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(u8, p);
    const type = td(u8, p + 4);
    let head = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = u64(u8, p + 8);
      head = 16;
    } else if (size === 0) size = end - p;
    if (size < head || p + size > end) break;
    out.push({ type, at: p + head, end: p + size });
    p += size;
  }
  return out;
}
const child = (u8, box, type) => boxes(u8, box.at, box.end).find((b) => b.type === type) || null;
function path(u8, box, types) {
  let b = box;
  for (const t of types) if (!(b = b && child(u8, b, t))) return null;
  return b;
}

/** 파일 맨 위 상자들을 훑어 moov 를 찾아 통째로 읽음 */
async function readMoov(file) {
  let pos = 0;
  for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
    const h = await readAt(file, pos, 16);
    let size = u32(h, 0);
    const type = td(h, 4);
    if (size === 1) size = u64(h, 8);
    else if (size === 0) size = file.size - pos;
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > 64 * 1048576) return null;
      return readAt(file, pos, size);
    }
    pos += size;
  }
  return null;
}

/** ES 서술자 길이 (1~4바이트, 앞 비트가 '더 있음') */
function descLen(u8, p) {
  let len = 0;
  let n = 0;
  for (; n < 4; n++) {
    const b = u8[p + n];
    len = (len << 7) | (b & 0x7f);
    if (!(b & 0x80)) break;
  }
  return { len, size: n + 1 };
}

/** 샘플 설명(stsd) 안의 esds → { objType, sfi, ch } (AAC 가 아니면 null) */
function aacConfig(u8, stsd) {
  // stsd 안에서 'esds' 글자를 찾음 (QuickTime 은 mp4a → wave → esds 로 한 겹 더 들어감)
  for (let p = stsd.at; p + 8 < stsd.end; p++) {
    if (u8[p] !== 0x65 || td(u8, p) !== 'esds') continue;
    const end = Math.min(stsd.end, p - 4 + u32(u8, p - 4));
    let q = p + 4 + 4; // 'esds' + 버전·플래그
    if (u8[q] !== 0x03) return null;
    q += 1 + descLen(u8, q + 1).size;
    const flags = u8[q + 2];
    q += 3;
    if (flags & 0x80) q += 2;
    if (flags & 0x40) q += 1 + u8[q];
    if (flags & 0x20) q += 2;
    if (u8[q] !== 0x04) return null;
    q += 1 + descLen(u8, q + 1).size;
    const oti = u8[q];
    if (oti !== 0x40 && oti !== 0x66 && oti !== 0x67) return null; // MPEG-4 / MPEG-2 AAC
    q += 13;
    if (u8[q] !== 0x05 || q >= end) return null;
    q += 1 + descLen(u8, q + 1).size;
    const b0 = u8[q];
    const b1 = u8[q + 1];
    let objType = b0 >> 3;
    let sfi = ((b0 & 7) << 1) | (b1 >> 7);
    let ch = (b1 >> 3) & 15;
    if (objType === 31) return null;
    if (sfi === 15) return null;
    // HE-AAC(SBR·PS) 는 ADTS 에선 LC 로 (디코더가 알아서 SBR 을 붙임)
    if (objType === 5 || objType === 29) objType = 2;
    if (objType < 1 || objType > 4 || ch < 1 || ch > 7) return null;
    return { objType, sfi, ch };
  }
  return null;
}

/** 소리 트랙의 샘플(AAC 조각) 위치·크기 */
function audioTrack(u8, moov) {
  for (const trak of boxes(u8, moov.at, moov.end).filter((b) => b.type === 'trak')) {
    const hdlr = path(u8, trak, ['mdia', 'hdlr']);
    if (!hdlr || td(u8, hdlr.at + 8) !== 'soun') continue;
    const stbl = path(u8, trak, ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;
    const stsd = child(u8, stbl, 'stsd');
    const stsz = child(u8, stbl, 'stsz');
    const stsc = child(u8, stbl, 'stsc');
    const stco = child(u8, stbl, 'stco') || child(u8, stbl, 'co64');
    if (!stsd || !stsz || !stsc || !stco) continue;
    const cfg = aacConfig(u8, stsd);
    if (!cfg) continue;
    // 크기
    const fixed = u32(u8, stsz.at + 4);
    const count = u32(u8, stsz.at + 8);
    if (fixed !== 0 || !count) continue; // AAC 는 조각마다 크기가 다름
    const sizes = new Uint32Array(count);
    for (let i = 0; i < count; i++) sizes[i] = u32(u8, stsz.at + 12 + i * 4);
    // 조각 묶음(chunk) 위치
    const wide = td(u8, stco.at - 4) === 'co64';
    const nChunks = u32(u8, stco.at + 4);
    const offs = new Array(nChunks);
    for (let i = 0; i < nChunks; i++) offs[i] = wide ? u64(u8, stco.at + 8 + i * 8) : u32(u8, stco.at + 8 + i * 4);
    // 묶음마다 조각 수
    const nRuns = u32(u8, stsc.at + 4);
    const per = new Uint32Array(nChunks);
    for (let r = 0; r < nRuns; r++) {
      const first = u32(u8, stsc.at + 8 + r * 12) - 1;
      const spc = u32(u8, stsc.at + 12 + r * 12);
      const next = r + 1 < nRuns ? u32(u8, stsc.at + 8 + (r + 1) * 12) - 1 : nChunks;
      for (let c = first; c < next && c < nChunks; c++) per[c] = spc;
    }
    return { cfg, sizes, offs, per };
  }
  return null;
}

function adtsHeader(cfg, len) {
  const L = len + 7;
  const profile = cfg.objType - 1;
  return [0xff, 0xf1, (profile << 6) | (cfg.sfi << 2) | (cfg.ch >> 2), ((cfg.ch & 3) << 6) | (L >> 11), (L >> 3) & 0xff, ((L & 7) << 5) | 0x1f, 0xfc];
}

/**
 * 영상 파일 → ADTS(.aac) 바이트 (소리가 AAC 가 아니거나 못 읽으면 null)
 * @param {Blob} file
 * @param {(p: number) => void} [onProgress] 0~1
 * @returns {Promise<Uint8Array|null>}
 */
export async function videoToAac(file, onProgress = () => {}) {
  const moovBytes = await readMoov(file);
  if (!moovBytes) return null;
  const top = boxes(moovBytes).find((b) => b.type === 'moov');
  if (!top) return null;
  const tr = audioTrack(moovBytes, top);
  if (!tr) return null;
  const { cfg, sizes, offs, per } = tr;
  let total = 0;
  for (let i = 0; i < sizes.length; i++) total += sizes[i] + 7;
  if (total > 200 * 1048576) return null;
  const out = new Uint8Array(total);
  // 묶음마다 [파일 위치, 길이, 첫 조각 번호]. 가까이 붙은 묶음은 한 번에 읽음
  const jobs = [];
  let s = 0;
  for (let c = 0; c < offs.length && s < sizes.length; c++) {
    let len = 0;
    for (let k = 0; k < per[c] && s + k < sizes.length; k++) len += sizes[s + k];
    jobs.push({ pos: offs[c], len, s0: s, n: Math.min(per[c], sizes.length - s) });
    s += per[c];
  }
  const groups = [];
  for (const j of jobs) {
    const g = groups[groups.length - 1];
    if (g && j.pos >= g.pos && j.pos - (g.pos + g.len) < 65536 && j.pos + j.len - g.pos < 8 * 1048576) {
      g.len = j.pos + j.len - g.pos;
      g.jobs.push(j);
    } else groups.push({ pos: j.pos, len: j.len, jobs: [j] });
  }
  // 조각 번호 → out 안의 자리
  const at = new Float64Array(sizes.length + 1);
  for (let i = 0; i < sizes.length; i++) at[i + 1] = at[i] + sizes[i] + 7;
  let done = 0;
  const work = async (g) => {
    const buf = await readAt(file, g.pos, g.len);
    for (const j of g.jobs) {
      let p = j.pos - g.pos;
      for (let k = 0; k < j.n; k++) {
        const i = j.s0 + k;
        const sz = sizes[i];
        if (p + sz > buf.length) throw new Error('short');
        const o = at[i];
        out.set(adtsHeader(cfg, sz), o);
        out.set(buf.subarray(p, p + sz), o + 7);
        p += sz;
      }
    }
    done++;
    onProgress(done / groups.length);
  };
  // 여러 개를 같이 읽음
  let next = 0;
  const lanes = Array.from({ length: 6 }, async () => {
    while (next < groups.length) await work(groups[next++]);
  });
  await Promise.all(lanes);
  return out;
}
