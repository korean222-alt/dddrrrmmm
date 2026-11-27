// 🙂 프로필 이미지 (2026-11-27 사용자 '프로필 이미지도 관련된 게 있으면 좋겠어')
//   쿵콩이·짝콩이 표정 8개(assets/avatar/*.webp, 128px — 마스코트 그림을 잘라 줄임) + 악기 그림 4개(직접 그린 SVG)
//   계정에 id 만 저장(players.av) → 랭킹 줄·설정·첫 가입 창에 보임. 서버는 AVATAR_IDS 로만 검사 (폰·서버 같이 씀)

const SVG = {
  piano: '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="#fff"/><path d="M7.5 5v14M12 5v14M16.5 5v14" stroke="#c9c3dd" stroke-width="1"/><rect x="6" y="5" width="3" height="8" rx="1" fill="#1d1a29"/><rect x="10.5" y="5" width="3" height="8" rx="1" fill="#1d1a29"/><rect x="15" y="5" width="3" height="8" rx="1" fill="#1d1a29"/>',
  drum: '<ellipse cx="12" cy="9" rx="8" ry="3.2" fill="#fff"/><path d="M4 9v6.5c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V9c0 1.8-3.6 3.2-8 3.2S4 10.8 4 9z" fill="#ff5a6e"/><path d="M6 11.6l2 6M10 12.2l1 6.3M14 12.2l-1 6.3M18 11.6l-2 6" stroke="#ffd86b" stroke-width="1.2"/><path d="M5 2.5l6 6M19 2.5l-6 6" stroke="#ffe0b0" stroke-width="1.8" stroke-linecap="round"/>',
  note: '<path d="M9 17.5a3 3 0 1 1-1.4-2.5V4.5l11-2.2v12.4a3 3 0 1 1-1.4-2.5V6.6L9 8.2z" fill="#fff"/>',
  crown: '<path d="M3.5 8l4.2 3.6L12 4.5l4.3 7.1L20.5 8l-1.8 10H5.3z" fill="#ffd54a" stroke="#fff3c0" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13.6" r="1.6" fill="#ff4f8f"/><rect x="5.3" y="18.2" width="13.4" height="2" rx="1" fill="#ffb800"/>',
};

/** 고를 수 있는 프로필 (순서 = 고르기 창 순서) */
export const AVATARS = [
  { id: 'kong', img: 'kong_idle', bg: ['#ffcf9a', '#ff8a3d'] },
  { id: 'jjak', img: 'jjak_idle', bg: ['#b8f0c8', '#3cc47a'] },
  { id: 'kong2', img: 'kong_cheer', bg: ['#ffe28a', '#ffad1f'] },
  { id: 'jjak2', img: 'jjak_cheer', bg: ['#a8e4ff', '#3a9bff'] },
  { id: 'kong3', img: 'kong_hit', bg: ['#ffb3d4', '#ff5f9a'] },
  { id: 'jjak3', img: 'jjak_hit', bg: ['#d6c2ff', '#8a5cff'] },
  { id: 'kong4', img: 'kong_miss', bg: ['#c6cdea', '#6a78b0'] },
  { id: 'jjak4', img: 'jjak_miss', bg: ['#b5f5ea', '#1fb6a0'] },
  { id: 'piano', svg: 'piano', bg: ['#4a3d9a', '#1a1340'] },
  { id: 'drum', svg: 'drum', bg: ['#ffb070', '#e8501f'] },
  { id: 'note', svg: 'note', bg: ['#ff9fd6', '#c34dff'] },
  { id: 'crown', svg: 'crown', bg: ['#3a4bb0', '#141a52'] },
];
export const AVATAR_IDS = AVATARS.map((a) => a.id);
/** 서버·폰 공통: 이상한 값은 null */
export const cleanAvatar = (v) => (typeof v === 'string' && AVATAR_IDS.includes(v) ? v : null);

/** 동그란 프로필 HTML (id 없으면 닉네임 첫 글자) */
export function avatarHtml(id, name = '', cls = '') {
  const a = AVATARS.find((x) => x.id === id);
  if (!a) return `<span class="av av-none ${cls}" aria-hidden="true">${String(name || '?').slice(0, 1).replace(/[<>&"]/g, '')}</span>`;
  const st = `style="background:radial-gradient(circle at 35% 28%, ${a.bg[0]}, ${a.bg[1]})"`;
  const inner = a.img ? `<img src="assets/avatar/${a.img}.webp" alt="" loading="lazy" width="128" height="128">` : `<svg viewBox="0 0 24 24">${SVG[a.svg]}</svg>`;
  return `<span class="av ${a.svg ? 'av-ico' : ''} ${cls}" ${st} aria-hidden="true">${inner}</span>`;
}
