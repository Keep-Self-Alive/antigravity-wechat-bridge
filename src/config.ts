import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AppConfig {
  botToken: string;
  botId: string;
  allowedUserId?: string;
  baseUrl: string;
  port: number;
  preventSleep: boolean;
  maxUploadBytes: number;
}

export class ConfigManager {
  private static config: AppConfig | null = null;
  private static envFile = path.join(process.cwd(), '.env');

  public static load(): AppConfig {
    if (this.config) return this.config;

    const envMap: Record<string, string> = {};

    // 1. Check local .env file
    if (fs.existsSync(this.envFile)) {
      const content = fs.readFileSync(this.envFile, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            envMap[key] = val;
          }
        }
      }
    }

    let fallbackToken = '';
    let fallbackBotId = '';
    let fallbackUser = '';

    this.config = {
      botToken: process.env.WECHAT_BOT_TOKEN || envMap['WECHAT_BOT_TOKEN'] || fallbackToken,
      botId: process.env.WECHAT_BOT_ID || envMap['WECHAT_BOT_ID'] || fallbackBotId,
      allowedUserId: process.env.WECHAT_ALLOWED_USER || envMap['WECHAT_ALLOWED_USER'] || fallbackUser,
      baseUrl: process.env.WECHAT_BASE_URL || envMap['WECHAT_BASE_URL'] || 'https://ilinkai.weixin.qq.com',
      port: parseInt(process.env.PORT || envMap['PORT'] || '53199', 10),
      preventSleep: (process.env.PREVENT_SLEEP || envMap['PREVENT_SLEEP']) !== 'false',
      maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || envMap['MAX_UPLOAD_BYTES'] || '104857600', 10), // 100MB
    };

    return this.config;
  }
}
