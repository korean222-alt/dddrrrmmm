import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { parseMidi, parseMusicXml, readScoreFile, scoreInfo, scoreToMap, readZip, gmDrum } from '../public/js/scorefile.js';
import { barToMelody, cleanMap, autoDrums, harmonize, mapLevel } from '../public/js/usermap.js';

// ---- 작은 MIDI 쓰개 (시험용) ----
const vlq = (n) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
function track(events) {
  // events: [{ tick, bytes }]
  const ev = [...events].sort((a, b) => a.tick - b.tick || (a.off ? -1 : 0) - (b.off ? -1 : 0));
  const body = [];
  let t = 0;
  for (const e of ev) {
    body.push(...vlq(e.tick - t), ...e.bytes);
    t = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  const n = body.length;
  return [0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...body];
}
const note = (ch, tick, dur, key) => [
  { tick, bytes: [0x90 | ch, key, 90] },
  { tick: tick + dur, bytes: [0x80 | ch, key, 0], off: true },
];
const name = (s) => ({ tick: 0, bytes: [0xff, 0x03, s.length, ...Buffer.from(s)] });
function midi(tracks, ppq = 96) {
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, ppq >> 8, ppq & 255, ...tracks.flat()]);
}

test('MIDI: 멜로디·코드·드럼·템포', () => {
  const Q = 96;
  const tempo = (bpm, tick = 0) => {
    const us = Math.round(60e6 / bpm);
    return { tick, bytes: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] };
  };
  // 도레미파 솔-- (4분음표) + 셋잇단(라시도) + 화음(위가 멜로디)
  const melEv = [name('Vocal'), ...[60, 62, 64, 65].flatMap((k, i) => note(0, i * Q, Q, k + 12)), ...note(0, 4 * Q, 2 * Q, 79)];
  melEv.push(...[81, 83, 84].flatMap((k, i) => note(0, 6 * Q + Math.round((i * Q) / 3), Math.round(Q / 3), k)));
  melEv.push(...note(0, 8 * Q, Q, 76), ...note(0, 8 * Q, Q, 72)); // 화음 → 위(76)
  for (let b = 3; b < 8; b++) melEv.push(...note(0, b * 4 * Q, Q, 72));
  // 반주: C 화음 2마디, F 화음, G 화음 ... (반 마디씩)
  const acc = [name('Piano'), tempo(150, Q * 8)];
  const chords = [[48, 52, 55], [48, 52, 55], [41, 45, 48], [43, 47, 50], [45, 48, 52], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
  chords.forEach((c, i) => c.forEach((k) => acc.push(...note(1, i * 4 * Q, 4 * Q, k))));
  // 드럼 (채널 10): 쿵·짝 + 하이햇 8분 + 첫 박 크래시
  const dr = [name('Drums')];
  for (let b = 0; b < 8; b++) {
    for (const s of [0, 2]) dr.push(...note(9, (b * 4 + s) * Q, 10, 36));
    for (const s of [1, 3]) dr.push(...note(9, (b * 4 + s) * Q, 10, 38));
    for (let e = 0; e < 8; e++) dr.push(...note(9, b * 4 * Q + (e * Q) / 2, 10, 42));
  }
  dr.push(...note(9, 0, 10, 49));
  const conductor = [tempo(100)];
  const bytes = midi([track(conductor), track(melEv), track(acc), track(dr)], Q);
  const sc = parseMidi(bytes);
  assert.equal(Math.round(sc.bpm), 100); // 처음 템포
  assert.ok(sc.tempoChanges);
  const info = scoreInfo(sc);
  assert.equal(info.totalBars, 8);
  assert.ok(info.hasDrums);
  assert.equal(sc.tracks[info.guess].name, 'Vocal');
  const m = scoreToMap(sc);
  assert.equal(m.bpm, 100);
  assert.equal(m.bars, 8);
  assert.equal(barToMelody(m.mel[0]), 'C5:4 D5:4 E5:4 F5:4');
  // 셋잇단 8분 = 16분 칸으로 가까이: 0, 1.33→1, 2.67→3
  assert.deepEqual(m.mel[1].map((n) => [n.step, n.midi]), [[0, 79], [8, 81], [9, 83], [11, 84]]);
  assert.equal(m.mel[2][0].midi, 76); // 화음이면 위 음
  assert.deepEqual(m.prog.slice(0, 5), ['C', 'C', 'F', 'G', 'Am']);
  assert.equal(m.drums[0], 'C.H.S.H.J.H.S.H.'); // 같은 엄지: 크래시>쿵, 짝>하이햇
  assert.equal(m.drums[1], 'J.H.S.H.J.H.S.H.');
  const map = cleanMap({ name: '시험', bpm: m.bpm, bars: m.drums, melody: m.mel.map(barToMelody), prog: m.prog });
  assert.ok(map);
  assert.equal(map.low, undefined);
  // 🎹 왼손(아래 줄) = 반주 트랙 가장 낮은 음, 다음 음까지
  assert.equal(barToMelody(m.low[0]), 'C3:16');
  assert.equal(barToMelody(m.low[2]), 'F2:16');
  const withLow = cleanMap({ name: '시험', bpm: m.bpm, bars: m.drums, melody: m.mel.map(barToMelody), prog: m.prog, low: m.low.map(barToMelody) });
  assert.equal(withLow.low[0], 'C3:16');
  const lv = mapLevel(withLow);
  assert.equal(lv.song.bass, '................'); // 왼손이 있으면 자동 베이스는 끔
  assert.equal(lv.song.low[2], 'F2:16');
  // 이상한 왼손은 빼고 맵은 살림
  assert.equal(cleanMap({ ...withLow, low: ['X9:16'] }).low, undefined);
  // 시작 마디·길이
  const m2 = scoreToMap(sc, { start: 6, bars: 16 });
  assert.equal(m2.bars, 2);
  assert.equal(m2.start, 6);
  // 멜로디 트랙 바꾸기 → 반주 트랙 위 음
  const m3 = scoreToMap(sc, { melody: sc.tracks.findIndex((t) => t.name === 'Piano') });
  assert.equal(m3.mel[0][0].midi, 55);
});

test('MIDI: 빠른 곡은 BPM 반으로 (칸도 맞춰서)', () => {
  const Q = 120;
  const us = Math.round(60e6 / 200);
  const ev = [{ tick: 0, bytes: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }];
  for (let i = 0; i < 16; i++) ev.push(...note(0, i * Q, Q, 72 + (i % 5)));
  const sc = parseMidi(midi([track(ev)], Q));
  const m = scoreToMap(sc);
  assert.equal(m.bpm, 100);
  assert.equal(m.bars, 2);
  assert.deepEqual(m.mel[0].map((n) => n.step), [0, 2, 4, 6, 8, 10, 12, 14]);
  assert.equal(m.drums, null);
  assert.equal(m.prog, null); // 반주 없음 → 멜로디로 짐작(harmonize)
  assert.equal(harmonize(m.mel).length, 2);
  assert.ok(cleanMap({ name: 'x', bpm: m.bpm, bars: autoDrums(m.mel), melody: m.mel.map(barToMelody), prog: harmonize(m.mel) }));
});

test('GM 드럼 → 4줄', () => {
  assert.equal(gmDrum(36), 'K');
  assert.equal(gmDrum(38), 'S');
  assert.equal(gmDrum(46), 'H');
  assert.equal(gmDrum(57), 'C');
  assert.equal(gmDrum(45), null);
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>시험 &amp; 곡</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
    <score-part id="P2"><part-name>Drumset</part-name>
      <score-instrument id="P2-I36"><instrument-name>Bass Drum</instrument-name></score-instrument>
      <midi-instrument id="P2-I36"><midi-channel>10</midi-channel><midi-unpitched>37</midi-unpitched></midi-instrument>
      <midi-instrument id="P2-I39"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="0" implicit="yes">
      <attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>
      <direction><sound tempo="90"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff></note>
    </measure>
    <measure number="1">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><staff>1</staff></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
      <note><pitch><step>E</step><alter>-1</alter><octave>5</octave></pitch><duration>1</duration><staff>1</staff></note>
      <note><grace/><pitch><step>D</step><octave>5</octave></pitch><staff>1</staff></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><staff>1</staff></note>
      <note><rest/><duration>2</duration><staff>1</staff></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><tie type="start"/><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><tie type="stop"/><staff>1</staff></note>
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>4</duration><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>F</step><octave>2</octave></pitch><duration>8</duration><staff>2</staff></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="0" implicit="yes">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><rest/><duration>1</duration></note>
    </measure>
    <measure number="1">
      <note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched><duration>1</duration><instrument id="P2-I36"/></note>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><instrument id="P2-I39"/></note>
      <note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched><duration>1</duration><instrument id="P2-I36"/></note>
      <note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;

test('MusicXML: 못갖춘마디·화음·이음줄·꾸밈음·두 줄·타악기', () => {
  const sc = parseMusicXml(XML);
  assert.equal(sc.title, '시험 & 곡');
  assert.equal(sc.bpm, 90);
  assert.deepEqual(sc.tracks.map((t) => [t.name, t.isDrum]), [['Piano (위 줄)', false], ['Piano (2번째 줄)', false], ['Drumset', true]]);
  const info = scoreInfo(sc);
  assert.equal(info.guess, 0);
  assert.equal(info.totalBars, 3);
  assert.equal(info.firstBar, 0);
  const m = scoreToMap(sc);
  // 못갖춘마디: G4 가 첫 마디 끝 박에
  assert.equal(barToMelody(m.mel[0]), '_:12 G4:4');
  assert.equal(barToMelody(m.mel[1]), 'C5:4 D#5:2 D5:2 _:4 G5:4');
  assert.equal(barToMelody(m.mel[2]), '_:8 A5:8'); // 이음줄 → 다시 안 침 (마디 끝에서 잘림)
  assert.equal(m.mel[1][3].len, 4);
  assert.equal(m.prog[1].split(' ')[0], 'C');
  assert.equal(m.prog[2].split(' ')[0], 'F');
  assert.equal(m.drums[1], 'K...S...K...H...');
});

function zipStored(files) {
  const parts = [];
  const cd = [];
  let off = 0;
  for (const [nm, data, method] of files) {
    const nb = Buffer.from(nm);
    const body = method === 8 ? zlib.deflateRawSync(data) : Buffer.from(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nb.length, 26);
    parts.push(lh, nb, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(method, 10);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nb.length, 28);
    c.writeUInt32LE(off, 42);
    cd.push(c, nb);
    off += 30 + nb.length + body.length;
  }
  const cdb = Buffer.concat(cd);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(files.length, 8);
  e.writeUInt16LE(files.length, 10);
  e.writeUInt32LE(cdb.length, 12);
  e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cdb, e]));
}

test('.mxl (zip): container.xml 따라 악보 찾기, 압축 풀기', async () => {
  const container = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score/song.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
  const z = zipStored([
    ['mimetype', Buffer.from('application/vnd.recordare.musicxml'), 0],
    ['META-INF/container.xml', Buffer.from(container), 0],
    ['score/song.xml', Buffer.from(XML), 8],
  ]);
  assert.deepEqual(Object.keys(readZip(z)).length, 3);
  const sc = await readScoreFile(z, 'song.mxl');
  assert.equal(sc.title, '시험 & 곡');
  assert.equal(scoreToMap(sc).found, 6);
  // 그냥 .musicxml 도
  const sc2 = await readScoreFile(new TextEncoder().encode(XML), 'a.musicxml');
  assert.equal(sc2.tracks.length, 3);
  await assert.rejects(() => readScoreFile(new TextEncoder().encode('hello'), 'x.txt'));
});
