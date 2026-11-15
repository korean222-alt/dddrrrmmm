// DM 으로 들어온 코드 처리: 코드 찾기 → checkFollow → 상태 저장 → DM 답장

import { extractCodes } from './codes.js';

/** 인스타 웹훅 본문에서 DM 꺼내기 */
export function messagesFromWebhook(body) {
  const out = [];
  if (!body || !Array.isArray(body.entry)) return out;
  for (const entry of body.entry) {
    for (const ev of entry.messaging || []) {
      const m = ev.message;
      if (!m || m.is_echo || m.is_deleted || m.is_unsupported) continue;
      const igsid = ev.sender && ev.sender.id;
      if (!igsid || igsid === entry.id) continue; // 내 계정이 보낸 것 제외
      if (typeof m.text !== 'string') continue;
      out.push({ igsid: String(igsid), text: m.text });
    }
  }
  return out;
}

/**
 * @param {{igsid: string, text: string}} dm
 * @param {{store, ig, cfg, now?: number, checkFollow?: Function}} deps
 */
export async function processDm(dm, deps) {
  const { store, ig, cfg } = deps;
  const now = deps.now || Date.now();
  const checkFollow = deps.checkFollow || ig.checkFollow;
  const handle = cfg.instagramHandle ? '@' + cfg.instagramHandle : '저희 계정';

  let rec = null;
  for (const c of extractCodes(dm.text, cfg.codePrefix)) {
    rec = await store.getCode(c);
    if (rec) break;
  }
  if (!rec) return { result: 'no_code' }; // 일반 대화는 무시 (답장 안 함)

  if (rec.status === 'verified') {
    return { result: 'already_verified', code: rec.code };
  }
  if (rec.status === 'expired' || now > rec.expiresAt) {
    await store.updateCode(rec.code, { status: 'expired' });
    await ig.sendDm(dm.igsid, '코드가 만료됐어요 🥲 사이트에서 새 코드를 받아 다시 보내주세요!');
    return { result: 'expired', code: rec.code };
  }

  let res;
  try {
    res = await checkFollow(dm.igsid);
  } catch (e) {
    console.error('[verify] checkFollow 실패:', e.message);
    await store.updateCode(rec.code, { lastError: e.message, lastErrorAt: now });
    await ig.sendDm(dm.igsid, '확인 중 문제가 생겼어요. 잠시 후 같은 코드를 다시 보내주세요!');
    return { result: 'error', code: rec.code, error: e.message };
  }

  if (res.following) {
    await store.updateCode(rec.code, { status: 'verified', igsid: dm.igsid, username: res.username, verifiedAt: now });
    await store.upsertPlayer(dm.igsid, { username: res.username, followVerifiedAt: now });
    const msg =
      rec.purpose === 'ranking'
        ? '확인 완료! 🥁 사이트로 돌아가면 랭킹에 점수가 올라가요.'
        : '팔로우 확인 완료! 🥁 사이트로 돌아가면 4단계부터 열려 있어요.';
    await ig.sendDm(dm.igsid, msg);
    return { result: 'verified', code: rec.code, username: res.username };
  }

  await store.updateCode(rec.code, { status: 'not_following', igsid: dm.igsid, username: res.username });
  await ig.sendDm(dm.igsid, `아직 팔로우가 안 되어 있어요! ${handle} 팔로우하고 같은 코드를 한 번 더 보내주세요 🙏`);
  return { result: 'not_following', code: rec.code };
}
