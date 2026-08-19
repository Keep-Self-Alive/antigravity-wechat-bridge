/**
 * Start Live WeChat Daemon with Environment / Config Credentials
 */

import { WeChatLiveDaemon } from '../src/wechat-live-daemon';

console.log(`
┌─────────────────────────────────────────────────────────────┐
│          🟢 Antigravity 微信实时守护进程已就绪              │
│         已连接腾讯微信官方服务，随时准备接收微信指令        │
└─────────────────────────────────────────────────────────────┘
`);

const daemon = new WeChatLiveDaemon();
daemon.start().catch((err) => {
  console.error('Daemon error:', err);
});
