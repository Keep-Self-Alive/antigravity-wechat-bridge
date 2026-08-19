/**
 * Session Manager — Manages Antigravity IDE Sessions & Local Persistence for WeChat
 * Supports 100% autonomous remote execution & auto-pinning in IDE.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { AntigravityClient } from './antigravity-client';
import { TrajectorySummary } from './types';
import { IDEScanner } from './ide-scanner';
import { RemoteProtocol } from './remote-protocol';

export interface MessageRecord {
  timestamp: string;
  sender: 'user' | 'bot';
  content: string;
  model?: string;
  cascadeId: string;
  attachments?: string[];
}

export interface UserSessionState {
  userId: string;
  currentCascadeId: string;
  mainCascadeId: string;
  model: string;
  lastActive: number;
}

export class SessionManager {
  private baseDir: string;
  private historyDir: string;
  private sessionsFile: string;
  private userSessions = new Map<string, UserSessionState>();
  public cachedTrajectories: TrajectorySummary[] = [];

  constructor(private client: AntigravityClient) {
    this.baseDir = path.join(os.homedir(), '.antigravity-wechat');
    this.historyDir = path.join(this.baseDir, 'history');
    this.sessionsFile = path.join(this.baseDir, 'sessions.json');
    this.initDirs();
    this.loadSessions();
  }

  private initDirs() {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
  }

  private loadSessions() {
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, 'utf-8');
        const data = JSON.parse(raw) as Record<string, UserSessionState>;
        for (const [uid, sess] of Object.entries(data)) {
          this.userSessions.set(uid, sess);
        }
      } catch (err) {
        console.error('Failed to load sessions.json:', err);
      }
    }
  }

  private saveSessions() {
    try {
      const obj: Record<string, UserSessionState> = {};
      for (const [uid, sess] of this.userSessions) {
        obj[uid] = sess;
      }
      fs.writeFileSync(this.sessionsFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save sessions.json:', err);
    }
  }

  /**
   * Auto-pin a conversation into IDE sidebar annotations & app_storage.json
   */
  private autoPinInIDE(cascadeId: string, title = 'WeChat 主会话') {
    try {
      const annotationsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'annotations');
      if (!fs.existsSync(annotationsDir)) {
        fs.mkdirSync(annotationsDir, { recursive: true });
      }
      const pbtxtPath = path.join(annotationsDir, `${cascadeId}.pbtxt`);
      fs.writeFileSync(pbtxtPath, `title:"${title}" pinned:true\n`, 'utf-8');

      const appStoragePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'app_storage.json');
      if (fs.existsSync(appStoragePath)) {
        const raw = fs.readFileSync(appStoragePath, 'utf-8');
        const data = JSON.parse(raw);
        let pinned = data['pinned_conversations_order'] || [];
        if (typeof pinned === 'string') pinned = JSON.parse(pinned);
        if (!pinned.includes(cascadeId)) {
          pinned.unshift(cascadeId);
          data['pinned_conversations_order'] = pinned;
          fs.writeFileSync(appStoragePath, JSON.stringify(data, null, 2), 'utf-8');
        }
      }
    } catch (err) {
      console.warn('Auto pin warning:', err);
    }
  }

  public async ensureRemotePrimarySession(): Promise<string> {
    const existing = this.userSessions.values().next().value;
    if (existing && existing.mainCascadeId && !existing.mainCascadeId.startsWith('139db9c7')) {
      return existing.mainCascadeId;
    }

    const newId = await this.client.startCascade();
    this.autoPinInIDE(newId, 'WeChat 主会话');
    
    // Seed initial session instruction
    await this.client.sendUserMessage(
      newId,
      RemoteProtocol.getSystemPreamble() + '\n\n【会话初始化】请确认你已加载微信远程通信规范，随时准备接收手机微信用户的指令。',
      'gemini-3.7-flash-medium'
    ).catch(() => {});

    return newId;
  }

  public async getOrCreateUserSession(userId: string): Promise<UserSessionState> {
    let sess = this.userSessions.get(userId);

    if (!sess || !sess.currentCascadeId || sess.currentCascadeId.startsWith('139db9c7')) {
      const primaryId = await this.ensureRemotePrimarySession();

      sess = {
        userId,
        currentCascadeId: primaryId,
        mainCascadeId: primaryId,
        model: 'gemini-3.7-flash-medium',
        lastActive: Date.now(),
      };
      this.userSessions.set(userId, sess);
      this.saveSessions();
    }

    return sess;
  }

  public async createNewSession(userId: string): Promise<{ cascadeId: string; reply: string }> {
    const newId = await this.client.startCascade();
    const sess = await this.getOrCreateUserSession(userId);

    sess.currentCascadeId = newId;
    sess.lastActive = Date.now();
    this.saveSessions();

    return {
      cascadeId: newId,
      reply: `✨【已开辟新会话】\n\n会话ID: ${newId.slice(0, 8)}...\n您后续发送的指令将独立记录在此新会话中。`,
    };
  }

  public async switchSession(userId: string, target: string): Promise<{ success: boolean; reply: string }> {
    const sess = await this.getOrCreateUserSession(userId);
    const trajectories = this.cachedTrajectories.length > 0 ? this.cachedTrajectories : await this.client.getTrajectories().catch(() => []);

    let matched: TrajectorySummary | undefined;
    const num = parseInt(target, 10);

    if (!isNaN(num) && num >= 1 && num <= trajectories.length) {
      matched = trajectories[num - 1];
    } else {
      matched = trajectories.find(t => 
        t.cascadeId.toLowerCase().includes(target.toLowerCase()) || 
        t.summary.toLowerCase().includes(target.toLowerCase())
      );
    }

    if (matched) {
      sess.currentCascadeId = matched.cascadeId;
      sess.lastActive = Date.now();
      this.saveSessions();

      return {
        success: true,
        reply: `✅【成功切换会话】\n\n📁 会话名称：${matched.summary}\n⏱️ 时间：${this.formatRelativeTime(matched.lastModifiedTime)}\n📊 步数：${matched.stepCount} 步\n\n现在发送文字或文件，将继续在此会话中交互。`,
      };
    }

    return {
      success: false,
      reply: `⚠️ 未找到编号为 "${target}" 的会话，发送「会话」可查看完整列表。`,
    };
  }

  public async switchToMainSession(userId: string): Promise<{ reply: string }> {
    const sess = await this.getOrCreateUserSession(userId);
    sess.currentCascadeId = sess.mainCascadeId;
    sess.lastActive = Date.now();
    this.saveSessions();

    const all = await this.client.getTrajectories().catch(() => []);
    const mainSummary = all.find(t => t.cascadeId === sess.mainCascadeId)?.summary || 'WeChat 主会话';

    return {
      reply: `🏠【已切回微信默认置顶主会话】\n\n📁 会话：${mainSummary}\n🆔 ID: ${sess.mainCascadeId.slice(0, 8)}...`,
    };
  }

  /**
   * Format structured list of IDE conversations.
   */
  public async formatSessionList(userId: string, limit = 0): Promise<string> {
    const sess = await this.getOrCreateUserSession(userId);
    const trajectories = await this.client.getTrajectories().catch(() => []);
    this.cachedTrajectories = trajectories;

    if (trajectories.length === 0) {
      return '📁 当前 IDE 暂无可用的历史会话，发送「新建」可直接开辟新会话。';
    }

    const pinnedList = trajectories.filter(t => t.isPinned);
    const recentList = trajectories.filter(t => !t.isPinned);

    const isLimited = limit > 0 && limit < trajectories.length;
    const title = isLimited
      ? `📱【最近 ${limit} 个 IDE 会话】`
      : `📱【全部 ${trajectories.length} 个 IDE 会话】`;

    const lines: string[] = [
      title,
      '─────────────────────',
    ];

    let globalIndex = 1;
    let displayedCount = 0;

    // 1. Pinned Section
    if (pinnedList.length > 0) {
      lines.push('📌【置顶会话】:');
      for (const t of pinnedList) {
        if (limit > 0 && displayedCount >= limit) break;
        const isCurrent = t.cascadeId === sess.currentCascadeId;
        const isMain = t.cascadeId === sess.mainCascadeId;
        const mark = isCurrent ? ' 👉 [当前]' : (isMain ? ' 🏠 [默认]' : '');
        const timeStr = this.formatRelativeTime(t.lastModifiedTime);
        lines.push(`${globalIndex}. ${t.summary || '未命名'} (${timeStr})${mark}`);
        globalIndex++;
        displayedCount++;
      }
      lines.push('');
    }

    // 2. Recent Section
    if (recentList.length > 0 && (limit === 0 || displayedCount < limit)) {
      lines.push('🕒【最近会话】:');
      for (const t of recentList) {
        if (limit > 0 && displayedCount >= limit) break;
        const isCurrent = t.cascadeId === sess.currentCascadeId;
        const mark = isCurrent ? ' 👉 [当前]' : '';
        const timeStr = this.formatRelativeTime(t.lastModifiedTime);
        lines.push(`${globalIndex}. ${t.summary || '未命名'} (${timeStr})${mark}`);
        globalIndex++;
        displayedCount++;
      }
      lines.push('');
    }

    lines.push('─────────────────────');
    lines.push('💡 回复「切换 1」切换到对应会话');
    if (isLimited) {
      lines.push('💡 发送「所有会话」可查看全部会话');
    }
    lines.push('💡 回复「新建」新开会话，回复「主会话」返回');

    return lines.join('\n');
  }

  private formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return '刚刚';
    const now = Date.now();
    const target = new Date(dateStr).getTime();
    const diffMs = Math.max(0, now - target);

    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 2) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}天前`;

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}个月前`;
  }

  public archiveMessagePair(params: {
    userId: string;
    cascadeId: string;
    userPrompt: string;
    botReply: string;
    model: string;
    attachments?: string[];
  }) {
    const { userId, cascadeId, userPrompt, botReply, model, attachments } = params;
    const now = new Date();
    const timeStr = now.toISOString();

    const jsonlPath = path.join(this.historyDir, `${cascadeId}.jsonl`);
    const records: MessageRecord[] = [
      { timestamp: timeStr, sender: 'user', content: userPrompt, model, cascadeId, attachments },
      { timestamp: new Date().toISOString(), sender: 'bot', content: botReply, model, cascadeId },
    ];

    fs.appendFileSync(jsonlPath, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');

    const mdPath = path.join(this.historyDir, `${cascadeId}.md`);
    const mdContent = [
      `### 💬 [${now.toLocaleString('zh-CN')}] 用户 (${userId.slice(0, 10)}...)`,
      `**Prompt:** ${userPrompt}`,
      attachments && attachments.length > 0 ? `**附件:** ${attachments.join(', ')}` : '',
      `\n**🤖 AI 回复 (${model}):**\n${botReply}\n`,
      '---\n',
    ].filter(Boolean).join('\n');

    fs.appendFileSync(mdPath, mdContent, 'utf-8');
  }
}
