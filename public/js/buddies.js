// 🥁 쿵콩이·짝콩이 (3D 그림)
//   쿵콩이 = 주황 콩, 빨간 큰북(쿵·왼쪽) / 짝콩이 = 초록 콩, 파란 작은북(짝·오른쪽)
//   그림: public/assets/mascot/{kong|jjak}_{idle|hit|miss|cheer}.webp, drum_{kong|jjak}.webp
//   그림을 바꾸면 V 를 올릴 것 (정적 파일은 30일 캐시)
//   소리(말·냥)는 넣었다가 거슬린다고 해서 뺌 (2026-11-20)

const V = '1';
export const BUDDY_POSES = ['idle', 'hit', 'miss', 'cheer'];
export const buddyUrl = (name) => `assets/mascot/${name}.webp?v=${V}`;

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
