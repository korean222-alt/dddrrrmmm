// 인스타그램 연동: 팔로우 확인(checkFollow), DM 답장, 웹훅 서명 검증
//
// ★ 지금(1~3단계)은 FOLLOW_CHECK_MODE=fake → checkFollow 가 항상 "팔로우 중"을 돌려줍니다.
//   앱 심사/테스트가 끝나면 FOLLOW_CHECK_MODE=real 로 바꾸기만 하면 진짜 확인으로 교체됩니다.
//   게임/서버의 나머지 코드는 이 함수만 거치므로 수정할 필요가 없습니다.

import crypto from 'node:crypto';

export function createInstagram(cfg, fetchImpl = globalThis.fetch) {
  const { graphHost, apiVersion, accessToken } = cfg.ig;
  const base = `https://${graphHost}/${apiVersion}`;

  /** IGSID(DM 보낸 사람 ID)로 프로필 조회. DM 을 보낸 사람만 조회 가능 */
  async function fetchProfile(igsid) {
    if (!accessToken) throw new Error('IG_ACCESS_TOKEN 이 설정되지 않았습니다');
    const url = `${base}/${encodeURIComponent(igsid)}?fields=username,name,is_user_follow_business&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchImpl(url);
    const body = await res.json().catch(() => ({}));
    if (cfg.ig.debug) console.log('[ig] profile', igsid, res.status, JSON.stringify(body));
    if (!res.ok || body.error) {
      const e = new Error(body.error?.message || `Graph API ${res.status}`);
      e.graph = body.error;
      throw e;
    }
    return body;
  }

  /**
   * @returns {Promise<{following: boolean, username: string, source: 'fake'|'real'}>}
   */
  async function checkFollow(igsid) {
    if (cfg.followCheckMode !== 'real') {
      // 가짜: 항상 확인됨. 토큰이 있으면 아이디만 진짜로 가져와 랭킹에 씀.
      let username = null;
      if (accessToken) {
        try {
          username = (await fetchProfile(igsid)).username || null;
        } catch (e) {
          if (cfg.ig.debug) console.warn('[ig] fake 모드 프로필 조회 실패:', e.message);
        }
      }
      return { following: true, username: username || `player_${String(igsid).slice(-4)}`, source: 'fake' };
    }
    const p = await fetchProfile(igsid);
    if (typeof p.is_user_follow_business !== 'boolean') {
      // 권한 부족(Advanced Access 미승인 등)일 때 이 필드가 빠져서 옴
      const e = new Error('is_user_follow_business 값이 오지 않았습니다. 앱 권한(Advanced Access)을 확인하세요.');
      e.code = 'FOLLOW_FIELD_MISSING';
      throw e;
    }
    return { following: p.is_user_follow_business, username: p.username || `player_${String(igsid).slice(-4)}`, source: 'real' };
  }

  async function sendDm(igsid, text) {
    if (!cfg.ig.sendReplies || !accessToken) return { skipped: true };
    try {
      const res = await fetchImpl(`${base}/me/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
      });
      if (!res.ok) console.warn('[ig] DM 답장 실패', res.status, await res.text().catch(() => ''));
      return { ok: res.ok };
    } catch (e) {
      console.warn('[ig] DM 답장 오류', e.message);
      return { ok: false };
    }
  }

  return { checkFollow, sendDm, fetchProfile };
}

/** X-Hub-Signature-256 검증 */
export function verifySignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}
