import { loadConfig } from './config.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const { server, store } = createApp(cfg);

server.listen(cfg.port, () => {
  console.log(`🥁 오케이스트라 http://localhost:${cfg.port}`);
  console.log(`   잠금: ${cfg.gateMode} · 팔로우 확인: ${cfg.followCheckMode} · 테스트 DM: ${cfg.devSimulate ? '켜짐' : '꺼짐'}`);
  if (!cfg.instagramHandle) console.log('   ⚠ INSTAGRAM_HANDLE 이 비어 있어요 (.env 확인)');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.flush();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
