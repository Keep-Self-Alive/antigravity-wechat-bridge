/**
 * Interactive Terminal CLI for testing WeChat Antigravity integration.
 */

import readline from 'readline';
import { AntigravityClient } from '../src/antigravity-client';
import { CommandRouter } from '../src/command-router';
import { SessionManager } from '../src/session-manager';
import { DiscoveryService } from '../src/discovery';

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              🤖 Antigravity 微信端本地测试模拟器 (CLI)                 ║
║      模拟微信手机端与本地 IDE Agent 进行双向对话、会话管理与文件传输       ║
╚══════════════════════════════════════════════════════════════════════╝
`);

  const client = new AntigravityClient();
  const sessionManager = new SessionManager(client);
  const router = new CommandRouter(client, sessionManager);

  console.log('🔍 正在探测本地 Antigravity Language Server...');
  const srv = await DiscoveryService.discover();
  if (!srv || !srv.isAlive) {
    console.error('❌ 未发现活跃的 Antigravity 实例，请确保 Antigravity IDE 处于打开状态。');
    process.exit(1);
  }

  const userId = 'cli_test_user';
  const userSession = await sessionManager.getOrCreateUserSession(userId);

  console.log(`✅ 已连接 Language Server (端口: ${srv.port}, PID: ${srv.pid})`);
  console.log(`📁 当前绑定会话: ${userSession.currentCascadeId.slice(0, 8)}... | 模型: ${userSession.model}`);
  console.log('💡 常用指令: "模型" (查看模型), "切换 1" (切换会话), "新建" (新会话), "帮助", "退出"\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question(`\x1b[32m[微信用户 (${userSession.model})]:\x1b[0m `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        promptUser();
        return;
      }

      if (trimmed === '退出' || trimmed === 'exit' || trimmed === 'quit') {
        console.log('👋 模拟器已退出。');
        rl.close();
        process.exit(0);
      }

      // Check command
      const cmdRes = await router.handle(trimmed, userSession);
      if (cmdRes.handled) {
        if (cmdRes.newModel) userSession.model = cmdRes.newModel;
        if (cmdRes.newCascadeId) userSession.currentCascadeId = cmdRes.newCascadeId;

        console.log(`\n\x1b[36m[ClawBot 系统回复]:\x1b[0m\n${cmdRes.reply}\n`);
        promptUser();
        return;
      }

      // Send to Agent
      console.log(`\x1b[33m⏳ [Antigravity Agent 正在思考与执行: ${userSession.currentCascadeId.slice(0, 8)}...]...\x1b[0m\n`);
      process.stdout.write('\x1b[35m[Agent]:\x1b[0m ');

      let fullReply = '';
      const unsubscribe = client.streamAgentUpdates(userSession.currentCascadeId, {
        onToken: (tok) => {
          process.stdout.write(tok);
          fullReply += tok;
        },
        onDone: (final) => {
          unsubscribe();
          const finalAns = final || fullReply || '（完成）';
          console.log('\n\n\x1b[32m✔ 回答完成并已本地存档。\x1b[0m\n');
          sessionManager.archiveMessagePair({
            userId,
            cascadeId: userSession.currentCascadeId,
            userPrompt: trimmed,
            botReply: finalAns,
            model: userSession.model,
          });
          promptUser();
        },
        onError: (err) => {
          unsubscribe();
          console.error(`\n❌ 执行出错: ${err.message}\n`);
          promptUser();
        },
      });

      try {
        await client.sendUserMessage(userSession.currentCascadeId, trimmed, userSession.model);
      } catch (err: any) {
        unsubscribe();
        console.error(`\n❌ 发送失败: ${err.message}\n`);
        promptUser();
      }
    });
  };

  promptUser();
}

main().catch(console.error);
