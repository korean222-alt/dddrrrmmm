// 보상형 광고 (이어하기용)
//
// 1순위: 구글 애드센스 'H5 게임 광고'(Ad Placement API)의 보상형 광고 adBreak({ type: 'reward' }).
//        config.js 의 ads.adsenseClient 에 'ca-pub-…' 를 넣으면 켜집니다. (애드센스 승인 + H5 게임 광고 신청 필요)
// 2순위: 광고가 없거나(승인 전, 광고 재고 없음, 광고 차단) 실패하면 → 홍보 화면(팔로우하고 집 한 채! · @goyangi.seom)을 몇 초 보여주고 이어하기.
//        이어하기가 막혀서 답답한 일은 없게 하고, 그 시간에 인스타 팔로우를 유도.
//
// showRewarded() → Promise<'rewarded' | 'dismissed'>
//   rewarded : 끝까지 봄 → 이어하기 줌
//   dismissed: 중간에 닫음 → 이어하기 없음

let adsense = null; // { ready: bool }

/** 앱 시작할 때 한 번: 애드센스 스크립트를 미리 불러와 광고를 준비시킴 */
export function initAds(cfg) {
  const a = (cfg && cfg.ads) || {};
  if (!/^ca-pub-\d{10,}$/.test(a.adsenseClient || '') || adsense) return;
  adsense = { ready: false };
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = function (o) {
    window.adsbygoogle.push(o);
  };
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${a.adsenseClient}`;
  if (a.test) s.dataset.adbreakTest = 'on';
  s.onerror = () => (adsense = { ready: false, failed: true });
  document.head.appendChild(s);
  window.adConfig({
    preloadAdBreaks: 'on',
    sound: 'on',
    onReady: () => adsense && (adsense.ready = true),
  });
}

/** 애드센스 보상형 광고 1회. 광고가 안 뜨면 'unavailable' */
function adsenseReward(hooks) {
  return new Promise((resolve) => {
    let state = 'waiting'; // waiting → showing → done
    const finish = (r) => {
      if (state === 'done') return;
      state = 'done';
      resolve(r);
    };
    // 광고가 준비 안 돼 있으면 beforeReward 가 안 불림 → 잠깐 기다렸다 대체 광고로
    const timer = setTimeout(() => state === 'waiting' && finish('unavailable'), 2500);
    try {
      window.adBreak({
        type: 'reward',
        name: 'continue',
        beforeAd: () => hooks.beforeAd && hooks.beforeAd(),
        afterAd: () => hooks.afterAd && hooks.afterAd(),
        // 사용자가 이미 "광고 보고 이어하기"를 눌렀으니 바로 보여줌
        beforeReward: (showAdFn) => {
          if (state !== 'waiting') return;
          state = 'showing';
          clearTimeout(timer);
          showAdFn();
        },
        adDismissed: () => finish('dismissed'),
        adViewed: () => finish('rewarded'),
        adBreakDone: () => {
          clearTimeout(timer);
          finish(state === 'showing' ? 'dismissed' : 'unavailable');
        },
      });
    } catch {
      clearTimeout(timer);
      finish('unavailable');
    }
  });
}

/**
 * 대체 광고: 우리 인스타 홍보 화면을 seconds 초 보여줌. 다 보면 '이어하기' 버튼이 켜짐.
 * 화면 요소는 index.html 의 #modal-ad.
 */
function houseAd({ seconds = 5, handle = '' } = {}) {
  return new Promise((resolve) => {
    const $ = (s) => document.querySelector(s);
    const modal = $('#modal-ad');
    const btn = $('#ad-continue');
    const close = $('#ad-close');
    const count = $('#ad-count');
    const link = $('#ad-insta');
    link.href = handle ? `https://www.instagram.com/${handle}/` : 'https://www.instagram.com/';
    $('#ad-handle').textContent = handle ? '@' + handle : '인스타그램';
    btn.disabled = true;
    modal.hidden = false;
    let left = seconds;
    const tick = () => {
      count.textContent = left > 0 ? `${left}초 뒤 이어하기` : '';
      btn.textContent = left > 0 ? `${left}` : '▶ 이어하기';
      if (left <= 0) {
        btn.disabled = false;
        clearInterval(timer);
      }
      left--;
    };
    const timer = setInterval(tick, 1000);
    tick();
    const done = (r) => {
      clearInterval(timer);
      btn.onclick = close.onclick = null;
      modal.hidden = true;
      resolve(r);
    };
    btn.onclick = () => !btn.disabled && done('rewarded');
    close.onclick = () => done('dismissed');
  });
}

/**
 * 보상형 광고 보여주기.
 * @param {{ ads?: object, instagramHandle?: string }} cfg
 * @param {{ beforeAd?: Function, afterAd?: Function }} hooks 광고 소리 나는 동안 게임 소리 끄기 등
 */
export async function showRewarded(cfg, hooks = {}) {
  const a = (cfg && cfg.ads) || {};
  if (adsense && !adsense.failed && typeof window.adBreak === 'function') {
    const r = await adsenseReward(hooks);
    if (r !== 'unavailable') return r;
  }
  return houseAd({ seconds: a.houseSeconds ?? 5, handle: a.houseHandle || cfg.instagramHandle });
}
