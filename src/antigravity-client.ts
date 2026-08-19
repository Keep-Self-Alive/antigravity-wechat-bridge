/**
 * Antigravity Language Server RPC Client (Connect Protocol / HTTPS).
 * Multi-Turn Trajectory Tracker with Auto-Reconnection & Rediscovery.
 */

import https from 'https';
import http, { IncomingMessage, ClientRequest } from 'http';
import { DiscoveryService, DiscoveredServer } from './discovery';
import { ModelConfig, TrajectorySummary } from './types';
import { IDEScanner } from './ide-scanner';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export const MAINSTREAM_MODEL_KEYS = [
  'gemini-3.7-flash-medium',
  'gemini-3.6-flash-medium',
  'gemini-3.5-flash-medium',
  'gemini-3.1-pro-low',
  'claude-sonnet-4-6',
  'claude-opus-4-6-thinking',
  'gpt-oss-120b-medium',
];

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'gemini-3.7-flash-medium': 'Gemini 3.7 Flash Medium',
  'gemini-3.6-flash-medium': 'Gemini 3.6 Flash Medium',
  'gemini-3.5-flash-medium': 'Gemini 3.5 Flash Medium',
  'gemini-3.1-pro-low': 'Gemini 3.1 Pro Low',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (Thinking)',
  'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
  'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
};

export interface ExecutionTracker {
  onHeartbeat?: (status: {
    thinking?: string;
    action?: string;
    currentContentSnippet?: string;
    stepIndex?: number;
  }) => void;
  onDone?: (result: {
    finalReply: string;
    fullThinking: string;
    actions: string[];
    generatedFiles: string[];
  }) => void;
  onError?: (err: Error) => void;
}

export class AntigravityClient {
  private server: DiscoveredServer | null = null;
  private modelEnumMap = new Map<string, string>([
    ['gemini-3.7-flash-medium', 'MODEL_PLACEHOLDER_M299'],
    ['gemini-3.6-flash-medium', 'MODEL_PLACEHOLDER_M298'],
    ['gemini-3.5-flash-medium', 'MODEL_PLACEHOLDER_M297'],
    ['gemini-3.1-pro-low', 'MODEL_PLACEHOLDER_M296'],
    ['claude-sonnet-4-6', 'MODEL_PLACEHOLDER_M295'],
    ['claude-opus-4-6-thinking', 'MODEL_PLACEHOLDER_M294'],
    ['gpt-oss-120b-medium', 'MODEL_PLACEHOLDER_M293'],
  ]);

  public async ensureServer(forceRefresh = false): Promise<DiscoveredServer> {
    if (!forceRefresh && this.server && this.server.isAlive) {
      return this.server;
    }
    const srv = await DiscoveryService.discover(forceRefresh);
    if (!srv) {
      throw new Error('No running Antigravity Language Server discovered. Please ensure IDE is running.');
    }
    this.server = srv;
    return srv;
  }

  public async startCascade(): Promise<string> {
    const res = await this.postConnectJson<{ cascadeId: string }>(
      '/exa.language_server_pb.LanguageServerService/StartCascade',
      { source: 1 }
    );
    return res.cascadeId;
  }

  public async getTrajectories(): Promise<TrajectorySummary[]> {
    try {
      const all = await IDEScanner.scanAll();
      if (all.length > 0) return all;
    } catch {}

    const res = await this.postConnectJson<{ trajectorySummaries: Record<string, any> }>(
      '/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories',
      {}
    );

    const map = res?.trajectorySummaries || {};
    const summaries: TrajectorySummary[] = [];

    for (const [id, val] of Object.entries(map)) {
      const isPinned = Boolean(val.annotations?.pinned);
      const lastMod = val.lastModifiedTime || val.createdTime || '';

      summaries.push({
        cascadeId: id,
        summary: val.summary || '未命名会话',
        stepCount: val.stepCount || 0,
        isPinned,
        status: val.status || 'CASCADE_RUN_STATUS_IDLE',
        createdTime: val.createdTime,
        lastModifiedTime: lastMod,
        workspaces: (val.workspaces || []).map((w: any) => w.workspaceFolderAbsoluteUri || ''),
      });
    }

    summaries.sort((a, b) => {
      const timeA = a.lastModifiedTime ? new Date(a.lastModifiedTime).getTime() : 0;
      const timeB = b.lastModifiedTime ? new Date(b.lastModifiedTime).getTime() : 0;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return timeB - timeA;
    });

    return summaries;
  }

  public async getAvailableModels(allModels = false): Promise<ModelConfig[]> {
    const res = await this.postConnectJson<any>(
      '/exa.language_server_pb.LanguageServerService/GetAvailableModels',
      {}
    );

    const modelsMap = res?.response?.models || res?.models || {};
    const models: ModelConfig[] = [];

    for (const [id, val] of Object.entries(modelsMap) as [string, any][]) {
      if (val?.model) {
        this.modelEnumMap.set(id, val.model);
      }
    }

    if (!allModels) {
      if (Object.keys(modelsMap).length === 0) {
        return MAINSTREAM_MODEL_KEYS.map((id) => ({
          id,
          name: id,
          label: MODEL_DISPLAY_NAMES[id] || id,
          displayName: MODEL_DISPLAY_NAMES[id] || id,
          isRecommended: true,
          quota: 1.0,
        }));
      }

      for (const id of MAINSTREAM_MODEL_KEYS) {
        const val = modelsMap[id] || {};
        const displayName = MODEL_DISPLAY_NAMES[id] || val.displayName || id;
        const quotaFraction = val?.quotaInfo?.remainingFraction !== undefined ? val.quotaInfo.remainingFraction : 1.0;
        const resetTime = val?.quotaInfo?.resetTime;

        models.push({
          id,
          name: id,
          label: displayName,
          displayName,
          isRecommended: true,
          quota: quotaFraction,
          resetTime,
        });
      }
      return models;
    }

    for (const [id, val] of Object.entries(modelsMap) as [string, any][]) {
      const displayName = MODEL_DISPLAY_NAMES[id] || val?.displayName || val?.label || id;
      const quotaFraction = val?.quotaInfo?.remainingFraction !== undefined ? val.quotaInfo.remainingFraction : 1.0;
      const resetTime = val?.quotaInfo?.resetTime;

      models.push({
        id,
        name: id,
        label: displayName,
        displayName,
        isRecommended: MAINSTREAM_MODEL_KEYS.includes(id),
        quota: quotaFraction,
        resetTime,
      });
    }

    return models;
  }

  private async resolveModelEnum(modelName?: string): Promise<string> {
    if (!modelName) return 'MODEL_PLACEHOLDER_M299';
    if (this.modelEnumMap.has(modelName)) {
      return this.modelEnumMap.get(modelName)!;
    }
    await this.getAvailableModels(true).catch(() => {});
    return this.modelEnumMap.get(modelName) || 'MODEL_PLACEHOLDER_M299';
  }

  public async sendUserMessage(cascadeId: string, message: string, modelName?: string): Promise<void> {
    const modelEnum = await this.resolveModelEnum(modelName);

    const payload: any = {
      cascadeId,
      items: [
        { text: message }
      ],
      cascadeConfig: {
        plannerConfig: {
          planModel: modelEnum
        }
      }
    };

    await this.postConnectJson('/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage', payload);
  }

  public async getCascadeTrajectory(cascadeId: string): Promise<any> {
    const res = await this.postConnectJson<any>(
      '/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory',
      { cascadeId }
    );
    return res?.trajectory;
  }

  public async getTrajectorySummary(cascadeId: string): Promise<{ status: string; stepCount: number }> {
    const res = await this.postConnectJson<any>(
      '/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories',
      {}
    );
    const summaries = res?.trajectorySummaries || {};
    const item = summaries[cascadeId] || {};
    return {
      status: item.status || 'CASCADE_RUN_STATUS_IDLE',
      stepCount: item.stepCount || 0,
    };
  }

  public streamAgentUpdates(cascadeId: string, callbacks: any): () => void {
    return this.executeAndTrackTurn(
      cascadeId,
      '',
      undefined,
      {
        onHeartbeat: (hb) => {
          if (hb.thinking) callbacks.onThought?.(hb.thinking);
          if (hb.currentContentSnippet) callbacks.onToken?.(hb.currentContentSnippet);
        },
        onDone: (res) => {
          callbacks.onDone?.(res.finalReply, res.fullThinking, res.actions);
        },
        onError: (err) => callbacks.onError?.(err),
      }
    );
  }

  /**
   * Robust Turn Execution Poller with Preemption Abort Signal Support.
   */
  public executeAndTrackTurn(
    cascadeId: string,
    message: string,
    modelName: string | undefined,
    tracker: ExecutionTracker,
    abortSignal?: AbortSignal
  ): () => void {
    let isCancelled = false;
    let pollerTimer: NodeJS.Timeout | null = null;

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        isCancelled = true;
        if (pollerTimer) clearTimeout(pollerTimer);
      });
    }

    (async () => {
      try {
        const initialTraj = await this.getCascadeTrajectory(cascadeId).catch(() => null);
        const baselineIndex = initialTraj?.steps?.length || 0;

        if (message) {
          await this.sendUserMessage(cascadeId, message, modelName);
        }

        let pollCount = 0;
        let lastReportedThought = '';
        let lastReportedAction = '';
        const allCapturedThoughts: string[] = [];
        const allActions: string[] = [];

        const pollLoop = async () => {
          if (isCancelled || abortSignal?.aborted) return;
          pollCount++;

          try {
            const summary = await this.getTrajectorySummary(cascadeId);
            const traj = await this.getCascadeTrajectory(cascadeId);
            const steps = traj?.steps || [];

            const newSteps = steps.slice(baselineIndex);
            const responseSnippets: string[] = [];
            let isGenerating = false;

            for (const s of newSteps) {
              const st = s.type;

              if (st === 'CORTEX_STEP_TYPE_RUN_COMMAND' && s.runCommand?.commandLine) {
                const cmd = s.runCommand.commandLine;
                const act = `执行命令: ${cmd.slice(0, 80)}...`;
                if (!allActions.includes(act)) allActions.push(act);
                if (act !== lastReportedAction) {
                  lastReportedAction = act;
                  tracker.onHeartbeat?.({ action: act, stepIndex: steps.length });
                }
              }

              if (st === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && s.plannerResponse) {
                const pr = s.plannerResponse;
                if (pr.thinking && !allCapturedThoughts.includes(pr.thinking)) {
                  allCapturedThoughts.push(pr.thinking);
                  if (pr.thinking !== lastReportedThought) {
                    lastReportedThought = pr.thinking;
                    tracker.onHeartbeat?.({ thinking: pr.thinking, stepIndex: steps.length });
                  }
                }

                const content = (pr.response || pr.modifiedResponse || pr.content || '').trim();
                if (content && !responseSnippets.includes(content)) {
                  responseSnippets.push(content);
                }

                if (s.status === 'CORTEX_STEP_STATUS_GENERATING') {
                  isGenerating = true;
                }
              }

              if (st === 'CORTEX_STEP_TYPE_ERROR_MESSAGE') {
                const err = s.errorMessage?.error?.shortError || 'Agent 执行错误';
                tracker.onError?.(new Error(err));
                return;
              }
            }

            const isIdle = summary.status === 'CASCADE_RUN_STATUS_IDLE';
            const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
            const lastStepIsDone = lastStep && lastStep.status === 'CORTEX_STEP_STATUS_DONE';

            if (responseSnippets.length > 0 && (isIdle || (!isGenerating && lastStepIsDone && newSteps.length >= 2))) {
              const combinedReply = responseSnippets.join('\n\n');

              // 1. Extract explicit [FILE_OUTPUT: C:\path\to\file.ext] tags
              const explicitFiles: string[] = [];
              const fileTagRegex = /\[FILE_OUTPUT:\s*([^\]\r\n]+)\]/gi;
              let match: RegExpExecArray | null;
              while ((match = fileTagRegex.exec(combinedReply)) !== null) {
                const cleanP = match[1].trim().replace(/^['"]|['"]$/g, '');
                if (cleanP) explicitFiles.push(cleanP);
              }

              // 2. Extract standard absolute Windows file paths
              const pathRegex = /(?:[a-zA-Z]:\\[^\s\r\n"'>\*\?\|]+\.(?:xlsx|xls|csv|png|jpg|jpeg|gif|webp|pdf|docx|txt|json|zip|mp4|mov|avi|mkv))/gi;
              const autoMatches = combinedReply.match(pathRegex) || [];
              const allFiles = Array.from(new Set([...explicitFiles, ...autoMatches]));

              tracker.onDone?.({
                finalReply: combinedReply,
                fullThinking: allCapturedThoughts.join('\n\n'),
                actions: allActions,
                generatedFiles: allFiles,
              });
              return;
            }
          } catch (err: any) {
            console.error('⚠️ [Turn Tracker Poll Error]:', err.message);
          }

          if (!isCancelled && !abortSignal?.aborted) {
            pollerTimer = setTimeout(pollLoop, 2000);
          }
        };

        pollerTimer = setTimeout(pollLoop, 1500);
      } catch (err: any) {
        tracker.onError?.(err);
      }
    })();

    return () => {
      isCancelled = true;
      if (pollerTimer) clearTimeout(pollerTimer);
    };
  }

  private async postConnectJson<T>(endpoint: string, body: Record<string, any>, isRetry = false): Promise<T> {
    const srv = await this.ensureServer(isRetry);
    const jsonBody = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: '127.0.0.1',
        port: srv.port,
        path: endpoint,
        method: 'POST',
        agent: httpsAgent,
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': srv.csrfToken,
          'Content-Length': Buffer.byteLength(jsonBody),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : {} as T);
            } catch {
              resolve({} as T);
            }
          } else {
            reject(new Error(`RPC ${endpoint.split('/').pop()} failed [HTTP ${res.statusCode}]: ${data}`));
          }
        });
      });

      req.on('error', async (err) => {
        if (!isRetry) {
          console.warn('⚠️ RPC 连接异常，正在触发端口自愈重新探测...');
          DiscoveryService.invalidateCache();
          try {
            const retryRes = await this.postConnectJson<T>(endpoint, body, true);
            resolve(retryRes);
            return;
          } catch {}
        }
        reject(err);
      });

      req.write(jsonBody);
      req.end();
    });
  }
}
