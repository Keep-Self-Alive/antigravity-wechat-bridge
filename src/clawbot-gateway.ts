/**
 * ClawBot Gateway Server — Webhook & WebSocket Bridge for WeChat
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AntigravityClient } from './antigravity-client';
import { CommandRouter } from './command-router';
import { FileHandler } from './file-handler';
import { SessionManager } from './session-manager';
import { DiscoveryService } from './discovery';

export class ClawbotGateway {
  private server: http.Server;
  private wss: WebSocketServer;
  private client: AntigravityClient;
  private sessionManager: SessionManager;
  private router: CommandRouter;
  private fileHandler: FileHandler;

  constructor(private port = 3000) {
    this.client = new AntigravityClient();
    this.sessionManager = new SessionManager(this.client);
    this.router = new CommandRouter(this.client, this.sessionManager);
    this.fileHandler = new FileHandler();

    this.server = http.createServer(this.handleHttp.bind(this));
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocket();
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🌐 [ClawBot Gateway] 服务已启动: http://127.0.0.1:${this.port}`);
        console.log(`📡 [ClawBot Gateway] Webhook 接入地址: http://127.0.0.1:${this.port}/webhook/clawbot/message`);
        console.log(`⚡ [ClawBot Gateway] WebSocket 接入地址: ws://127.0.0.1:${this.port}/ws`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => resolve());
    });
  }

  private async handleHttp(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);

    // 1. Health check endpoint
    if (req.method === 'GET' && url.pathname === '/health') {
      const srv = await DiscoveryService.discover().catch(() => null);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        languageServer: srv ? { pid: srv.pid, port: srv.port, isAlive: srv.isAlive } : null,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // 2. Model catalog endpoint
    if (req.method === 'GET' && url.pathname === '/api/models') {
      try {
        const models = await this.client.getAvailableModels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', models }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 3. Webhook endpoint
    if (req.method === 'POST' && url.pathname === '/webhook/clawbot/message') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const reply = await this.processInboundMessage(payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(reply));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private setupWebSocket() {
    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '/', `http://127.0.0.1:${this.port}`);
      if (url.pathname === '/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          const reply = await this.processInboundMessage(payload);
          ws.send(JSON.stringify(reply));
        } catch (err: any) {
          ws.send(JSON.stringify({ error: err.message }));
        }
      });
    });
  }

  private async processInboundMessage(payload: any): Promise<any> {
    const sessionId = payload.sessionId || payload.fromUserName || 'default_user';
    const text = (payload.text || payload.content || '').trim();

    const userSession = await this.sessionManager.getOrCreateUserSession(sessionId);

    // Check command interceptor
    const cmdRes = await this.router.handle(text, userSession);
    if (cmdRes.handled) {
      if (cmdRes.newModel) userSession.model = cmdRes.newModel;
      if (cmdRes.newCascadeId) userSession.currentCascadeId = cmdRes.newCascadeId;

      return {
        sessionId,
        type: 'text',
        text: cmdRes.reply,
        model: userSession.model,
        timestamp: Date.now(),
      };
    }

    // Process attachments
    const attachments = payload.attachments || [];
    const localAttachments: string[] = [];

    for (const att of attachments) {
      if (att.base64Content) {
        const buf = Buffer.from(att.base64Content, 'base64');
        const p = await this.fileHandler.saveAttachment({
          name: att.name || 'file',
          type: att.type || 'file',
          buffer: buf,
        });
        localAttachments.push(p);
      }
    }

    const fullPrompt = this.fileHandler.buildPromptWithAttachments(
      text,
      localAttachments.map(p => ({ name: p.split(/[\\/]/).pop() || 'file', type: 'file', localPath: p }))
    );

    return new Promise((resolve) => {
      let collected = '';
      const unsubscribe = this.client.streamAgentUpdates(userSession.currentCascadeId, {
        onToken: (tok) => { collected += tok; },
        onDone: (final) => {
          unsubscribe();
          const finalReply = final || collected || '（已完成）';
          this.sessionManager.archiveMessagePair({
            userId: sessionId,
            cascadeId: userSession.currentCascadeId,
            userPrompt: fullPrompt,
            botReply: finalReply,
            model: userSession.model,
            attachments: localAttachments,
          });
          resolve({
            sessionId,
            type: 'text',
            text: finalReply,
            model: userSession.model,
            timestamp: Date.now(),
          });
        },
        onError: (err) => {
          unsubscribe();
          resolve({
            sessionId,
            type: 'text',
            text: `❌ 执行出错: ${err.message}`,
            error: err.message,
            timestamp: Date.now(),
          });
        },
      });

      this.client.sendUserMessage(userSession.currentCascadeId, fullPrompt, userSession.model).catch((err) => {
        unsubscribe();
        resolve({
          sessionId,
          type: 'text',
          text: `❌ 发送失败: ${err.message}`,
          error: err.message,
          timestamp: Date.now(),
        });
      });
    });
  }
}
