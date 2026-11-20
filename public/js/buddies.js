// 🥁 쿵콩이·짝콩이 (3D 그림 + 목소리)
//   쿵콩이 = 주황 콩, 빨간 큰북(쿵·왼쪽) / 짝콩이 = 초록 콩, 파란 작은북(짝·오른쪽)
//   그림: public/assets/mascot/{kong|jjak}_{idle|hit|miss|cheer}.webp, drum_{kong|jjak}.webp
//   목소리: public/audio/voice.bin (scripts/pack-audio.js 로 묶음, 원본 public/audio/voice/*.mp3)
//   그림·목소리를 바꾸면 V 를 올릴 것 (정적 파일은 30일 캐시)

const V = '1';
export const BUDDY_POSES = ['idle', 'hit', 'miss', 'cheer'];
export const buddyUrl = (name) => `assets/mascot/${name}.webp?v=${V}`;

export const VOICE_LINES = {
  kong: { tap: ['kong_1', 'kong_1', 'kong_1', 'kong_2'], fun: ['kong_good', 'kong_more'], sad: ['kong_sad'], win: ['kong_win'] },
  jjak: { tap: ['jjak_1', 'jjak_1', 'jjak_1', 'jjak_2'], fun: ['jjak_good', 'jjak_more'], sad: ['jjak_sad'], win: ['jjak_win'] },
};
/** 말풍선 글자 (목소리 파일 이름 → 하는 말) */
export const VOICE_TEXT = {
  kong_1: '쿵!', kong_2: '쿵쿵!', kong_good: '좋아~!', kong_more: '더 더!', kong_sad: '으앙…', kong_win: '와아~ 최고야!',
  jjak_1: '짝!', jjak_2: '짝짝!', jjak_good: '신난다~!', jjak_more: '가자!', jjak_sad: '힝…', jjak_win: '야호~ 해냈다!',
};

let imgsP = null;
function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
/** 그림 전부 받아 둠. { kong:{idle,hit,miss,cheer}, jjak:{...}, drum:{kong,jjak} } — 하나라도 실패하면 null (예전 그림으로) */
export function loadBuddies() {
  if (imgsP) return imgsP;
  const names = [];
  for (const k of ['kong', 'jjak']) for (const p of BUDDY_POSES) names.push([k, p, `${k}_${p}`]);
  names.push(['drum', 'kong', 'drum_kong'], ['drum', 'jjak', 'drum_jjak']);
  imgsP = Promise.all(names.map(([, , n]) => loadImg(buddyUrl(n)))).then((ims) => {
    if (ims.some((x) => !x)) {
      imgsP = null;
      return null;
    }
    const out = { kong: {}, jjak: {}, drum: {} };
    names.forEach(([a, b], i) => (out[a][b] = ims[i]));
    return out;
  });
  return imgsP;
}

/** 목소리: 묶음 파일 하나 받아서 풀어 둠 */
export class Voices {
  constructor(audio) {
    this.audio = audio;
    this.bufs = null;
    this.loading = null;
    this.on = true;
    this.cur = {}; // 캐릭터별 지금 말하는 소리 (새로 말하면 끊음)
    this.lastAt = 0;
  }
  /** 파일만 미리 받아 둠 (소리 엔진 없이도 됨) */
  prefetch() {
    this.raw ??= fetch(`audio/voice.bin?v=${V}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .catch(() => {
        this.raw = null;
        return null;
      });
    return this.raw;
  }
  load() {
    if (this.loading) return this.loading;
    const ctx = this.audio.ensure();
    this.loading = (async () => {
      try {
        const all = await this.prefetch();
        if (!all) throw new Error('voice.bin');
        const hl = new DataView(all).getUint32(0);
        const index = JSON.parse(new TextDecoder().decode(new Uint8Array(all, 4, hl)));
        const base = 4 + hl;
        const bufs = {};
        await Promise.all(
          Object.entries(index).map(async ([file, [off, len]]) => {
            const ab = all.slice(base + off, base + off + len);
            try {
              bufs[file.replace(/\.mp3$/, '')] = await new Promise((res, rej) => {
                const q = ctx.decodeAudioData(ab, res, rej);
                if (q && q.then) q.then(res, rej);
              });
            } catch {}
          })
        );
        this.bufs = bufs;
        return true;
      } catch {
        this.loading = null;
        return false;
      }
    })();
    return this.loading;
  }
  /** who = 'kong'|'jjak', kind = 'tap'|'fun'|'sad'|'win' 또는 파일 이름. 말한 파일 이름 (못 하면 null) */
  say(who, kind, { vol = 1, delay = 0 } = {}) {
    if (!this.on) return null;
    const ctx = this.audio.ctx;
    if (!ctx) return null;
    const list = VOICE_LINES[who]?.[kind];
    const name = list ? list[Math.floor(Math.random() * list.length)] : kind;
    if (!this.bufs) {
      // 아직 안 풀었으면 풀고 바로 말함 (조금 늦으면 그냥 넘어감)
      const t = performance.now();
      this.load().then((ok) => ok && performance.now() - t < 600 && this.say(who, name, { vol, delay }));
      return name;
    }
    const buf = this.bufs[name];
    if (!buf) return null;
    try {
      const prev = this.cur[who];
      if (prev) prev.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.9 * vol;
      src.connect(g).connect(this.audio.sfxBus);
      src.start(ctx.currentTime + delay);
      this.cur[who] = { src, g };
      src.onended = () => {
        if (this.cur[who]?.src === src) this.cur[who] = null;
      };
    } catch {
      return null;
    }
    this.lastAt = performance.now();
    return name;
  }
}
