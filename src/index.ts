/**
 * Antigravity WeChat Bridge — Main Entry Point
 */

import { DiscoveryService } from './discovery';
import { ClawbotGateway } from './clawbot-gateway';
import { ACPServer } from './acp-server';

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode='));
  const portArg = args.find(a => a.startsWith('--port='));

  const mode = modeArg ? modeArg.split('=')[1] : 'clawbot';
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3000;

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│          🚀 Antigravity WeChat & ClawBot Bridge            │
│       Bidirectional AI Agent Bridge for WeChat & IDE        │
└─────────────────────────────────────────────────────────────┘
  `);

  // Auto-discover Language Server
  console.log('🔍 正在检测正在运行的 Antigravity Language Server...');
  const server = await DiscoveryService.discover();

  if (!server) {
    console.warn('⚠️ 未检测到运行中的 Language Server。请确保 Antigravity IDE 已启动并打开工作区。');
  } else {
    console.log(`✅ 已连接 Language Server (PID: ${server.pid}, 端口: ${server.port})`);
  }

  if (mode === 'acp') {
    console.log('📡 正在以 ACP (stdio JSON-RPC) 模式启动，等待 cc-connect 管道输入...');
    const acp = new ACPServer();
    acp.start();
  } else {
    console.log(`🌐 正在启动 WeChat ClawBot 网关服务 (端口: ${port})...`);
    const gateway = new ClawbotGateway(port);
    await gateway.start();

    console.log(`
💡 微信 ClawBot 对接指引：
1. 打开手机微信，进入【我】->【设置】->【插件】-> 开启 ClawBot
2. 将消息路由配置为: http://127.0.0.1:${port}/webhook/clawbot/message
3. 或使用命令行测试: npm run test:cli
    `);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
