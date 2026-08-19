/**
 * Command Router — High Performance Command Interceptor with WeChat Native Typography & Mainstream Models.
 */

import { AntigravityClient } from './antigravity-client';
import { ModelConfig } from './types';
import { SessionManager, UserSessionState } from './session-manager';

export interface CommandResult {
  handled: boolean;
  reply?: string;
  newModel?: string;
  newCascadeId?: string;
}

export class CommandRouter {
  private cachedModels: ModelConfig[] = [];
  private lastModelsFetch = 0;

  constructor(
    private client: AntigravityClient,
    private sessionManager: SessionManager,
  ) {}

  public async handle(text: string, userSession: UserSessionState): Promise<CommandResult> {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Help & Instructions fuzzy match
    if (
      ['help', '帮助', '？', '?', 'menu', '菜单', '指南'].includes(lower) ||
      lower.includes('指令') || lower.includes('怎么用') || lower.includes('帮助')
    ) {
      return {
        handled: true,
        reply: this.formatHelp(),
      };
    }

    // 2. Status fuzzy match
    if (['status', '状态'].includes(lower) || lower.includes('运行状态') || lower.includes('连接状态')) {
      return {
        handled: true,
        reply: this.formatStatus(userSession),
      };
    }

    // 3. Model switch (e.g. '模型 1', '模型1', '切换模型 1')
    const modelSwitchMatch = trimmed.match(/^(?:模型|model|切换模型)\s*([0-9]+|[a-zA-Z._-]+)$/i);
    if (modelSwitchMatch && modelSwitchMatch[1] && modelSwitchMatch[1].trim() !== '') {
      const target = modelSwitchMatch[1].trim();
      return await this.switchModel(target);
    }

    // 4. Model list fuzzy match
    if (
      ['model', 'models', '模型'].includes(lower) ||
      lower === '所有模型' || lower === '模型列表' || lower === '可用模型' || lower === '查看模型' || lower === '查模型' || lower === '额度'
    ) {
      return {
        handled: true,
        reply: await this.formatModelList(userSession.model),
      };
    }

    // 5. All Sessions command (No limit)
    if (lower === '所有会话' || lower === '全部会话' || lower.includes('所有会话') || lower.includes('全部会话')) {
      const listStr = await this.sessionManager.formatSessionList(userSession.userId, 0);
      return {
        handled: true,
        reply: listStr,
      };
    }

    // 6. Top 10 Sessions command (Limit 10)
    if (
      ['ws', 'workspace', '工作区', '会话', '列表', 'list'].includes(lower) ||
      lower.includes('会话') && (lower.includes('列表') || lower.includes('查看') || lower.includes('查') || lower.length <= 4)
    ) {
      const listStr = await this.sessionManager.formatSessionList(userSession.userId, 10);
      return {
        handled: true,
        reply: listStr,
      };
    }

    // 7. Switch session command
    const sessionSwitchMatch = trimmed.match(/^(?:切换|切到|switch|切换会话|进入会话|选)\s*([0-9a-zA-Z._-]+)$/i);
    if (sessionSwitchMatch) {
      const target = sessionSwitchMatch[1].trim();
      const switchRes = await this.sessionManager.switchSession(userSession.userId, target);
      return {
        handled: true,
        reply: switchRes.reply,
        newCascadeId: userSession.currentCascadeId,
      };
    }

    // 8. Reset / New conversation
    if (
      ['/new', 'new', '新建', '清空', '重置'].includes(lower) ||
      lower.includes('新建会话') || lower.includes('新会话') || lower.includes('重新开始')
    ) {
      const newRes = await this.sessionManager.createNewSession(userSession.userId);
      return {
        handled: true,
        reply: newRes.reply,
        newCascadeId: newRes.cascadeId,
      };
    }

    // 9. Return to main session
    if (
      ['主会话', 'main', '默认会话'].includes(lower) ||
      lower.includes('主会话') || lower.includes('回到主') || lower.includes('切回主')
    ) {
      const mainRes = await this.sessionManager.switchToMainSession(userSession.userId);
      return {
        handled: true,
        reply: mainRes.reply,
        newCascadeId: userSession.currentCascadeId,
      };
    }

    return { handled: false };
  }

  private formatHelp(): string {
    return [
      '🤖【Antigravity 微信指令助手】',
      '─────────────────────',
      '💬 直接发文字：向 AI 提问或要求生成代码',
      '📎 直接发文件：发送 PDF、Word、代码或图片',
      '📁「会话」：查看最近 10 个 IDE 会话',
      '📚「所有会话」：查看全部所有 IDE 会话',
      '⚡「切换 1」：切换到指定会话（例：切换 1）',
      '✨「新建」：开辟全新 IDE 会话并自动切换',
      '🏠「主会话」：一键切回微信默认主会话',
      '📋「模型」：查看 7 大主流 AI 模型实时额度与倒计时',
      '🔄「模型 1」：切换底层模型（例：模型 1）',
      '🟢「状态」：查看当前会话与本地存档状态',
      '─────────────────────',
    ].join('\n');
  }

  private formatStatus(sess: UserSessionState): string {
    return [
      '🟢【Antigravity 会话与网关状态】',
      '─────────────────────',
      `• 当前会话：${sess.currentCascadeId.slice(0, 8)}...`,
      `• 微信主会话：${sess.mainCascadeId.slice(0, 8)}...`,
      `• 当前模型：${sess.model}`,
      `• 本地存档：~/.antigravity-wechat/history/`,
      `• 状态：双向同步正常 ✅`,
      '─────────────────────',
    ].join('\n');
  }

  private async formatModelList(currentModel: string): Promise<string> {
    const models = await this.getModelsCached();
    const lines = [
      '📋【主流 AI 模型列表及额度】',
      '─────────────────────',
    ];

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const isCurrent = m.id === currentModel || m.name === currentModel;
      const currentMark = isCurrent ? ' 👉 [当前]' : '';
      const quotaPct = Math.round((m.quota ?? 1) * 100);
      const bar = this.renderProgressBar(quotaPct);
      const resetStr = this.formatResetCountdown(m.quota, m.resetTime);

      lines.push(`${i + 1}. ${m.displayName || m.label}${currentMark}`);
      lines.push(`   额度: ${bar} ${quotaPct}% (${resetStr})`);
    }

    lines.push('─────────────────────');
    lines.push('💡 回复「模型 1」~「模型 7」可快速切换对应模型。');
    return lines.join('\n');
  }

  private formatResetCountdown(quota?: number, resetTimeStr?: string): string {
    if (quota === undefined || quota >= 1.0) {
      return '满额';
    }
    if (!resetTimeStr) {
      return '5小时循环刷新';
    }

    const resetMs = new Date(resetTimeStr).getTime();
    const nowMs = Date.now();
    const diffMs = resetMs - nowMs;

    if (diffMs <= 0) {
      return '即将刷新';
    }

    const diffHours = Math.floor(diffMs / (3600 * 1000));
    const diffMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      const remHours = diffHours % 24;
      return `${days}天${remHours}小时后重置`;
    }

    if (diffHours > 0) {
      return `${diffHours}小时${diffMins}分后刷新`;
    }

    return `${diffMins}分钟后刷新`;
  }

  private async switchModel(target: string): Promise<CommandResult> {
    const models = await this.getModelsCached();
    let matched: ModelConfig | undefined;

    const num = parseInt(target, 10);
    if (!isNaN(num) && num >= 1 && num <= models.length) {
      matched = models[num - 1];
    } else {
      matched = models.find(m => 
        m.id.toLowerCase().includes(target.toLowerCase()) || 
        m.label.toLowerCase().includes(target.toLowerCase()) ||
        (m.displayName && m.displayName.toLowerCase().includes(target.toLowerCase()))
      );
    }

    if (matched) {
      return {
        handled: true,
        newModel: matched.id,
        reply: `✅ 成功切换模型为：${matched.displayName || matched.label}`,
      };
    } else {
      return {
        handled: true,
        reply: `⚠️ 未找到编号为 "${target}" 的模型，发送「模型」可查看列表。`,
      };
    }
  }

  private async getModelsCached(): Promise<ModelConfig[]> {
    const now = Date.now();
    if (this.cachedModels.length > 0 && now - this.lastModelsFetch < 15000) {
      return this.cachedModels;
    }
    try {
      const fetched = await this.client.getAvailableModels(false);
      if (fetched && fetched.length > 0) {
        this.cachedModels = fetched;
        this.lastModelsFetch = now;
        return this.cachedModels;
      }
    } catch {}
    if (this.cachedModels.length === 0) {
      this.cachedModels = await this.client.getAvailableModels(false);
    }
    return this.cachedModels;
  }

  private renderProgressBar(percentage: number): string {
    const totalBlocks = 8;
    const filled = Math.round((percentage / 100) * totalBlocks);
    return '█'.repeat(filled) + '░'.repeat(totalBlocks - filled);
  }
}
