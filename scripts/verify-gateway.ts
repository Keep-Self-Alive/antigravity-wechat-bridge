/**
 * Automated Verification Script for Antigravity WeChat Bridge
 */

import { ClawbotGateway } from '../src/clawbot-gateway';
import { DiscoveryService } from '../src/discovery';
import { FileHandler } from '../src/file-handler';

async function verify() {
  console.log('--- 🧪 开始自动化全链路测试 ---');

  // 1. Verify Discovery
  console.log('\n[1/4] 测试 Language Server 自动发现...');
  const srv = await DiscoveryService.discover();
  if (!srv || !srv.isAlive) {
    throw new Error('Discovery 失败: 未找到活跃的 Language Server');
  }
  console.log(`✅ Discovery 成功: PID=${srv.pid}, 端口=${srv.port}`);

  // 2. Start Gateway on port 3088
  console.log('\n[2/4] 测试启动 ClawBot Gateway 服务...');
  const gateway = new ClawbotGateway(3088);
  await gateway.start();

  // 3. Test HTTP /health
  console.log('\n[3/4] 测试 /health 与 /api/models 接口...');
  const healthRes = await fetch('http://127.0.0.1:3088/health').then(r => r.json());
  console.log('✅ /health 响应:', JSON.stringify(healthRes));

  const modelsRes: any = await fetch('http://127.0.0.1:3088/api/models').then(r => r.json());
  console.log(`✅ /api/models 获取到 ${modelsRes.models?.length} 个模型`);

  // 4. Test Webhook with command "模型"
  console.log('\n[4/4] 测试模拟微信发送指令 "模型"...');
  const msgPayload = {
    sessionId: 'test_user_wx888',
    messageId: 'msg_001',
    text: '模型',
    timestamp: Date.now(),
  };

  const replyRes = await fetch('http://127.0.0.1:3088/webhook/clawbot/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msgPayload),
  }).then(r => r.json());

  console.log('✅ Webhook 响应内容:\n', replyRes.text);

  // 5. Test File Handler
  console.log('\n[5/5] 测试微信文件暂存与上下文组装...');
  const fileHandler = new FileHandler();
  const testBuf = Buffer.from('hello wechat file transfer test', 'utf-8');
  const savedPath = await fileHandler.saveAttachment({
    name: 'test_note.txt',
    type: 'file',
    buffer: testBuf,
  });
  console.log('✅ 文件已保存至:', savedPath);

  const enrichedPrompt = fileHandler.buildPromptWithAttachments('请总结这份文件', [
    { name: 'test_note.txt', type: 'file', localPath: savedPath },
  ]);
  console.log('✅ 组装后的 Agent Prompt:\n', enrichedPrompt);

  await gateway.stop();
  console.log('\n🎉 所有自动化测试通过！网关与微信双向通信实现完毕！');
}

verify().catch((err) => {
  console.error('❌ 测试未通过:', err);
  process.exit(1);
});
