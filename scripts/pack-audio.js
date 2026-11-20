// 음원 샘플 mp3 여러 개를 파일 하나로 묶는다 (접속마다 요청 59개 → 2개).
// 형식: [4바이트 헤더길이][JSON {파일명:[시작,길이]}][mp3 데이터...]
// 샘플을 바꾸면 `node scripts/pack-audio.js` 다시 돌리고 커밋.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
for (const dir of ['piano', 'orch']) {
  const names = fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.mp3')).sort();
  const index = {};
  const bufs = [];
  let off = 0;
  for (const n of names) {
    const b = fs.readFileSync(path.join(root, dir, n));
    index[n] = [off, b.length];
    bufs.push(b);
    off += b.length;
  }
  const head = Buffer.from(JSON.stringify(index));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(head.length);
  fs.writeFileSync(path.join(root, `${dir}.bin`), Buffer.concat([len, head, ...bufs]));
  console.log(dir, names.length, 'files');
}
