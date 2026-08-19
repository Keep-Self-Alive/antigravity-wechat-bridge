/**
 * WeChat Live Daemon — Enterprise Production Edition.
 * Direct bidirectional bridge connecting Tencent WeChat ilink AI Bot Protocol to Antigravity IDE.
 * Fully supports:
 * - Session Orchestrator (Debounce, Preemption & Inline Steer)
 * - Stream-based Media Pipeline (Constant low RAM)
 * - Self-Healing Language Server RPC Reconnection
 * - Mobile-First Typography with Smart Chunking
 */

import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AntigravityClient } from './antigravity-client';
import { CommandRouter } from './command-router';
import { SessionManager } from './session-manager';
import { WeChatFormatter } from './wechat-formatter';
import { MediaBridge } from './media-bridge';
import { SessionOrchestrator, SessionPhase } from './session-orchestrator';
import { ConfigManager } from './config';
import { RemoteProtocol } from './remote-protocol';
import net from 'net';

export class WeChatLiveDaemon {
  private client: AntigravityClient;
  private commandRouter: CommandRouter;
  private sessionManager: SessionManager;
  private mediaBridge: MediaBridge;
  private orchestrator: SessionOrchestrator;
  private lockServer?: net.Server;

  private isRunning = false;
  private syncBuf = '';
  private getUpdatesBuf = '';
  private botToken: string;
  private botId: string;
  private baseUrl: string;
  private typingTickets = new Map<string, string>();

  constructor() {
    const config = ConfigManager.load();
    this.botToken = config.botToken;
    this.botId = config.botId;
    this.baseUrl = config.baseUrl;

    this.client = new AntigravityClient();
    this.sessionManager = new SessionManager(this.client);
    this.commandRouter = new CommandRouter(this.client, this.sessionManager);
    this.mediaBridge = new MediaBridge(this.botToken, this.baseUrl);
    this.orchestrator = new SessionOrchestrator();
  }

  private async acquireSingletonLock(port = 53199): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => {
        resolve(false);
      });
      server.listen(port, '127.0.0.1', () => {
        this.lockServer = server;
        resolve(true);
      });
    });
  }

  public async start(): Promise<void> {
    const acquired = await this.acquireSingletonLock();
    if (!acquired) {
      console.warn('⚠️ [WeChat Live Daemon] 已检测到另一个守护实例正在运行中，当前进程自动退出，防止多网关抢占重复。');
      process.exit(0);
    }

    this.isRunning = true;
    console.log('🚀 [WeChat Live Daemon] 已启动！正在监听微信端用户消息...');
    console.log(`🤖 绑定 Bot ID: ${this.botId}`);

    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (err: any) {
        console.error('⚠️ [Poll Error]:', err.message);
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  public stop() {
    this.isRunning = false;
  }

  private async pollMessages(): Promise<void> {
    const payload = {
      sync_buf: this.syncBuf,
      get_updates_buf: this.getUpdatesBuf,
      base_info: {
        channel_version: '2.4.6',
        bot_agent: 'OpenClaw',
      },
    };

    const res = await this.postJson<any>('/ilink/bot/getupdates', payload, 35000);

    if (res) {
      if (res.sync_buf) this.syncBuf = res.sync_buf;
      if (res.get_updates_buf) this.getUpdatesBuf = res.get_updates_buf;

      const msgs = res.msgs || res.updates || [];
      for (const raw of msgs) {
        const msg = raw.message || raw;
        if (msg) {
          await this.handleSingleMessage(msg);
        }
      }
    }
  }

  private async fetchTypingTicket(fromUserId: string, contextToken?: string): Promise<string | undefined> {
    try {
      const res = await this.postJson<any>('/ilink/bot/getconfig', {
        ilink_user_id: fromUserId,
        context_token: contextToken || undefined,
        base_info: {
          channel_version: '2.4.6',
          bot_agent: 'OpenClaw',
        },
      });
      if (res?.typing_ticket) {
        this.typingTickets.set(fromUserId, res.typing_ticket);
        return res.typing_ticket;
      }
    } catch {}
    return this.typingTickets.get(fromUserId);
  }

  private async sendTypingIndicator(fromUserId: string, status: number = 1): Promise<void> {
    const ticket = this.typingTickets.get(fromUserId);
    if (!ticket) return;
    try {
      await this.postJson<any>('/ilink/bot/sendtyping', {
        ilink_user_id: fromUserId,
        typing_ticket: ticket,
        status,
        base_info: {
          channel_version: '2.4.6',
          bot_agent: 'OpenClaw',
        },
      });
    } catch {}
  }

  private async handleSingleMessage(msg: any): Promise<void> {
    const fromUserId = msg.from_user_id || msg.sender;
    const contextToken = msg.context_token || '';
    const itemList = msg.item_list || msg.itemList || [];
    const createTime = msg.create_time_ms || Date.now();
    const msgId = msg.msg_id || msg.client_id || `${fromUserId}_${createTime}`;

    if (!fromUserId) return;

    // Idempotency check: drop duplicated replays
    if (!this.orchestrator.checkAndMarkIdempotent(msgId, createTime)) {
      console.log(`🛡️ [幂等拦截] 丢弃重复微信消息 [${msgId}]`);
      return;
    }

    this.fetchTypingTicket(fromUserId, contextToken);

    for (const item of itemList) {
      if (item.type === 1 && item.text_item?.text) {
        const text = item.text_item.text;
        console.log(`📩 [收到微信文本] 来自: ${fromUserId.slice(0, 15)}... | 内容: "${text}"`);
        
        // Ingest into adaptive orchestrator
        this.orchestrator.ingestMessage(fromUserId, text, async (fusedText, shouldPreempt, shouldSteer) => {
          await this.processUserText(fromUserId, fusedText, contextToken, shouldSteer);
        });
      } else if (item.type === 3 && (item.voice_item?.text || item.voiceItem?.text)) {
        const text = item.voice_item?.text || item.voiceItem?.text;
        console.log(`🎙️ [收到微信语音转文字] 来自: ${fromUserId.slice(0, 15)}... | 内容: "${text}"`);
        this.orchestrator.ingestMessage(fromUserId, text, async (fusedText, shouldPreempt, shouldSteer) => {
          await this.processUserText(fromUserId, fusedText, contextToken, shouldSteer);
        });
      } else if (item.type === 2 && item.image_item) {
        console.log(`🖼️ [收到微信图片] 来自: ${fromUserId.slice(0, 15)}... 正在流式解密下载...`);
        await this.processUserImage(fromUserId, item.image_item, contextToken);
      } else if (item.type === 4 && item.file_item) {
        const fileName = item.file_item.file_name || 'attachment';
        console.log(`📎 [收到微信文件] 来自: ${fromUserId.slice(0, 15)}... | 文件名: ${fileName}`);
        await this.processUserFile(fromUserId, item.file_item, contextToken);
      }
    }
  }

  private async processUserImage(fromUserId: string, imgItem: any, contextToken?: string): Promise<void> {
    try {
      const media = imgItem.media || imgItem;
      const localPath = await this.mediaBridge.downloadInboundMedia(media, 'wechat_photo.jpg');
      console.log(`💾 [图片已保存至本地] ${localPath}`);
      const prompt = `用户通过微信发送了一张图片，已下载存放在本地：${localPath}\n请读取并分析此图片。`;
      await this.processUserText(fromUserId, prompt, contextToken, false);
    } catch (err: any) {
      console.error('❌ 图片下载解密失败:', err.message);
      await this.sendTextMessage(fromUserId, `⚠️ 图片接收失败: ${err.message}`, contextToken);
    }
  }

  private async processUserFile(fromUserId: string, fileItem: any, contextToken?: string): Promise<void> {
    try {
      const fileName = fileItem.file_name || 'attachment';
      const media = fileItem.media || fileItem;
      const localPath = await this.mediaBridge.downloadInboundMedia(media, fileName);
      console.log(`💾 [文件已保存至本地] ${localPath}`);
      const prompt = `用户通过微信发送了一个文件「${fileName}」，已下载存放在本地：${localPath}\n请分析此文件。`;
      await this.processUserText(fromUserId, prompt, contextToken, false);
    } catch (err: any) {
      console.error('❌ 文件下载解密失败:', err.message);
      await this.sendTextMessage(fromUserId, `⚠️ 文件接收失败: ${err.message}`, contextToken);
    }
  }

  private async processUserText(fromUserId: string, text: string, contextToken?: string, isSteer = false): Promise<void> {
    const userSession = await this.sessionManager.getOrCreateUserSession(fromUserId);
    const cmdRes = await this.commandRouter.handle(text, userSession);

    if (cmdRes.handled) {
      if (cmdRes.newModel) userSession.model = cmdRes.newModel;
      if (cmdRes.newCascadeId) userSession.currentCascadeId = cmdRes.newCascadeId;
      if (cmdRes.reply) await this.sendTextMessage(fromUserId, cmdRes.reply, contextToken);
      return;
    }

    const trimmedText = text.trim();
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const abortController = new AbortController();

    this.orchestrator.registerActiveExecution({
      turnId,
      userId: fromUserId,
      cascadeId: userSession.currentCascadeId,
      prompt: trimmedText,
      abortController,
      startedAt: Date.now(),
    });

    if (isSteer) {
      console.log(`🚀 [Steer Channel] 实时注入干预指令打破执行僵局: "${trimmedText.slice(0, 30)}..."`);
    } else {
      console.log(`🧠 [Antigravity 正在思考与执行] 会话: ${userSession.currentCascadeId.slice(0, 8)}... | 模型: ${userSession.model}`);
    }

    this.sendTypingIndicator(fromUserId, 1);
    const typingInterval = setInterval(() => {
      this.sendTypingIndicator(fromUserId, 1);
    }, 4000);

    const payloadPrompt = RemoteProtocol.buildTurnPayload(trimmedText);

    this.client.executeAndTrackTurn(
      userSession.currentCascadeId,
      payloadPrompt,
      userSession.model,
      {
        onHeartbeat: (hb) => {
          if (hb.action) {
            this.orchestrator.setPhase(fromUserId, SessionPhase.EXECUTING);
          }
          this.sendTypingIndicator(fromUserId, 1);
        },
        onDone: async (result) => {
          clearInterval(typingInterval);
          this.sendTypingIndicator(fromUserId, 2);
          this.orchestrator.clearActiveExecution(fromUserId);

          console.log(`📤 [回传微信] 发送完整回答 (${result.finalReply.length} 字)`);
          const formatted = WeChatFormatter.format(result.finalReply);
          const chunks = WeChatFormatter.splitIntoChunks(formatted, 1800);

          // Deliver chunks safely
          for (let i = 0; i < chunks.length; i++) {
            const tokenToUse = i === 0 ? contextToken : undefined;
            await this.sendTextMessage(fromUserId, chunks[i], tokenToUse);
          }

          // Push any generated files
          for (const filePath of result.generatedFiles) {
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              console.log(`📦 [自动检测到生成文件] 正在流式上传并推送至微信: ${filePath}`);
              try {
                if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                  await this.sendImageMessage(fromUserId, filePath, contextToken);
                } else {
                  await this.sendFileMessage(fromUserId, filePath, contextToken);
                }
              } catch (err: any) {
                console.error(`⚠️ [文件推送失败]: ${filePath} - ${err.message}`);
              }
            }
          }

          this.sessionManager.archiveMessagePair({
            userId: fromUserId,
            cascadeId: userSession.currentCascadeId,
            userPrompt: trimmedText,
            botReply: formatted,
            model: userSession.model,
          });
        },
        onError: async (err) => {
          clearInterval(typingInterval);
          this.sendTypingIndicator(fromUserId, 2);
          this.orchestrator.clearActiveExecution(fromUserId);

          console.error('❌ Agent 执行遇到提示:', err.message);
          const errReply = `⚠️ Agent 在 IDE 中执行遇到提示：\n\n${err.message}\n\n请在 IDE 中查看详情或发送「新建」重置会话。`;
          await this.sendTextMessage(fromUserId, errReply, contextToken);
        },
      },
      abortController.signal
    );
  }

  public async sendTextMessage(toUserId: string, text: string, contextToken?: string): Promise<void> {
    const payload: any = {
      msg: {
        from_user_id: '',
        to_user_id: toUserId,
        client_id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        message_type: 2,
        message_state: 2,
        item_list: [
          {
            type: 1,
            text_item: {
              text,
            },
          },
        ],
        context_token: contextToken || undefined,
      },
      base_info: {
        channel_version: '2.4.6',
        bot_agent: 'OpenClaw',
      },
    };

    const res = await this.postJson<any>('/ilink/bot/sendmessage', payload);
    if (res && res.ret !== undefined && res.ret !== 0) {
      console.warn(`⚠️ [sendmessage status]: ${res.ret} - ${res.errmsg || ''}`);
    } else {
      console.log(`✅ [微信已成功接收] message_id: ${res?.message_id || 'ok'}`);
    }
  }

  public async sendFileMessage(toUserId: string, localFilePath: string, contextToken?: string): Promise<void> {
    const fileName = path.basename(localFilePath);
    const uploaded = await this.mediaBridge.uploadOutboundMedia(localFilePath, toUserId, 3); // 3 is FILE

    const payload: any = {
      msg: {
        from_user_id: '',
        to_user_id: toUserId,
        client_id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        message_type: 2,
        message_state: 2,
        item_list: [
          {
            type: 4, // 4 is MessageItemType.FILE
            file_item: {
              media: {
                encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                aes_key: Buffer.from(uploaded.aeskey).toString('base64'),
                encrypt_type: 1,
              },
              file_name: fileName,
              len: String(uploaded.fileSize),
            },
          },
        ],
        context_token: contextToken || undefined,
      },
      base_info: {
        channel_version: '2.4.6',
        bot_agent: 'OpenClaw',
      },
    };

    const res = await this.postJson<any>('/ilink/bot/sendmessage', payload);
    console.log(`📎 [文件成功推送到微信]: ${fileName} (id: ${res?.message_id})`);
  }

  public async sendImageMessage(toUserId: string, localFilePath: string, contextToken?: string): Promise<void> {
    const uploaded = await this.mediaBridge.uploadOutboundMedia(localFilePath, toUserId, 1); // 1 is IMAGE

    const payload: any = {
      msg: {
        from_user_id: '',
        to_user_id: toUserId,
        client_id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        message_type: 2,
        message_state: 2,
        item_list: [
          {
            type: 2, // 2 is MessageItemType.IMAGE
            image_item: {
              media: {
                encrypt_query_param: uploaded.downloadEncryptedQueryParam,
                aes_key: Buffer.from(uploaded.aeskey).toString('base64'),
                encrypt_type: 1,
              },
              mid_size: uploaded.fileSizeCiphertext,
            },
          },
        ],
        context_token: contextToken || undefined,
      },
      base_info: {
        channel_version: '2.4.6',
        bot_agent: 'OpenClaw',
      },
    };

    const res = await this.postJson<any>('/ilink/bot/sendmessage', payload);
    console.log(`🖼️ [图片成功推送到微信]: (id: ${res?.message_id})`);
  }

  private async postJson<T>(endpoint: string, body: Record<string, any>, timeoutMs = 15000): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    const jsonStr = JSON.stringify(body);
    const randomUin = Buffer.from(String(crypto.randomInt(100000, 999999999)), 'utf-8').toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'AuthorizationType': 'ilink_bot_token',
            'Authorization': `Bearer ${this.botToken}`,
            'X-WECHAT-UIN': randomUin,
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': '132102',
            'Content-Length': Buffer.byteLength(jsonStr),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : ({} as T));
            } catch {
              resolve({} as T);
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ ret: 0, timeout: true } as any);
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(jsonStr);
      req.end();
    });
  }
}
