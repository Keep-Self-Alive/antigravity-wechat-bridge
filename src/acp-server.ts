/**
 * ACP (Agent Communication Protocol) Stdio Server Adapter.
 */

import readline from 'readline';
import { AntigravityClient } from './antigravity-client';
import { CommandRouter } from './command-router';
import { SessionManager } from './session-manager';
import { ACPJsonRpcRequest as JSONRPCRequest, ACPJsonRpcResponse as JSONRPCResponse } from './types';

export class ACPServer {
  private client: AntigravityClient;
  private sessionManager: SessionManager;
  private router: CommandRouter;

  constructor() {
    this.client = new AntigravityClient();
    this.sessionManager = new SessionManager(this.client);
    this.router = new CommandRouter(this.client, this.sessionManager);
  }

  public start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req: JSONRPCRequest = JSON.parse(trimmed);
        const resp = await this.handleRpcRequest(req);
        if (resp) {
          process.stdout.write(JSON.stringify(resp) + '\n');
        }
      } catch (err: any) {
        const errResp: JSONRPCResponse = {
          jsonrpc: '2.0',
          id: 0,
          error: {
            code: -32700,
            message: `Parse error: ${err.message}`,
          },
        };
        process.stdout.write(JSON.stringify(errResp) + '\n');
      }
    });
  }

  private async handleRpcRequest(req: JSONRPCRequest): Promise<JSONRPCResponse | null> {
    const { id, method, params } = req;

    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2026-03-22',
            capabilities: {
              chat: true,
              streaming: true,
              files: true,
              models: true,
            },
            serverInfo: {
              name: 'antigravity-wechat-bridge',
              version: '1.0.0',
            },
          },
        };
      }

      case 'models/list': {
        const models = await this.client.getAvailableModels();
        return {
          jsonrpc: '2.0',
          id,
          result: { models },
        };
      }

      case 'chat/message': {
        const sessionId = params.sessionId || 'default';
        const userPrompt = params.text || '';
        const userSession = await this.sessionManager.getOrCreateUserSession(sessionId);

        const cmdRes = await this.router.handle(userPrompt, userSession);
        if (cmdRes.handled) {
          if (cmdRes.newModel) userSession.model = cmdRes.newModel;
          if (cmdRes.newCascadeId) userSession.currentCascadeId = cmdRes.newCascadeId;

          return {
            jsonrpc: '2.0',
            id,
            result: {
              text: cmdRes.reply,
              model: userSession.model,
            },
          };
        }

        return new Promise((resolve) => {
          let fullText = '';
          const unsubscribe = this.client.streamAgentUpdates(userSession.currentCascadeId, {
            onToken: (tok) => { fullText += tok; },
            onDone: (final) => {
              unsubscribe();
              const reply = final || fullText || '（完成）';
              this.sessionManager.archiveMessagePair({
                userId: sessionId,
                cascadeId: userSession.currentCascadeId,
                userPrompt,
                botReply: reply,
                model: userSession.model,
              });
              resolve({
                jsonrpc: '2.0',
                id,
                result: {
                  text: reply,
                  model: userSession.model,
                },
              });
            },
            onError: (err) => {
              unsubscribe();
              resolve({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: err.message,
                },
              });
            },
          });

          this.client.sendUserMessage(userSession.currentCascadeId, userPrompt, userSession.model).catch((err) => {
            unsubscribe();
            resolve({
              jsonrpc: '2.0',
              id,
              error: { code: -32603, message: err.message },
            });
          });
        });
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  }
}
