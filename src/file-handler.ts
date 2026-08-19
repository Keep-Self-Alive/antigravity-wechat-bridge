/**
 * File Handler — Manages bidirectional file transfers between WeChat and Antigravity.
 */

import fs from 'fs';
import path from 'path';
import { WeChatAttachment } from './types';

export class FileHandler {
  private stagingDir: string;
  private inboxDir: string;
  private outboxDir: string;

  constructor(baseDir?: string) {
    this.stagingDir = baseDir || path.resolve(process.cwd(), 'staging');
    this.inboxDir = path.join(this.stagingDir, 'inbox');
    this.outboxDir = path.join(this.stagingDir, 'outbox');

    this.ensureDirs();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.stagingDir)) fs.mkdirSync(this.stagingDir, { recursive: true });
    if (!fs.existsSync(this.inboxDir)) fs.mkdirSync(this.inboxDir, { recursive: true });
    if (!fs.existsSync(this.outboxDir)) fs.mkdirSync(this.outboxDir, { recursive: true });
  }

  /**
   * Save an attachment received from WeChat
   */
  public async saveAttachment(attachment: WeChatAttachment): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const targetDir = path.join(this.inboxDir, today);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Clean and sanitize filename
    let sanitizedName = (attachment.name || `file_${Date.now()}`).replace(/[\\/:*?"<>|]/g, '_');
    
    let rawBuffer: Buffer;
    if (attachment.buffer) {
      rawBuffer = attachment.buffer;
    } else if (attachment.url) {
      // Download URL if provided
      const res = await fetch(attachment.url);
      const arrayBuf = await res.arrayBuffer();
      rawBuffer = Buffer.from(arrayBuf);
    } else {
      throw new Error('Attachment contains neither buffer nor url');
    }

    // Decrypt if aesKey is provided or if buffer is encrypted WeChat CDN payload
    let finalBuffer = rawBuffer;
    if (attachment.aesKey) {
      finalBuffer = this.decryptCdnBuffer(rawBuffer, attachment.aesKey);
    }

    // Auto-detect extension from magic bytes if filename has no extension or is unknown
    const ext = this.detectExtension(finalBuffer);
    if (ext && !sanitizedName.includes('.')) {
      sanitizedName = `${sanitizedName}.${ext}`;
    }

    const targetPath = path.join(targetDir, `${Date.now()}_${sanitizedName}`);
    fs.writeFileSync(targetPath, finalBuffer);

    attachment.localPath = targetPath;
    return targetPath;
  }

  private decryptCdnBuffer(data: Buffer, keyInput: string): Buffer {
    try {
      let key: Buffer;
      if (/^[A-Za-z0-9+/=]+$/.test(keyInput) && (keyInput.length === 24 || keyInput.length === 22 || keyInput.length === 16)) {
        key = Buffer.from(keyInput, 'base64');
      } else if (/^[0-9a-fA-F]{32}$/.test(keyInput)) {
        key = Buffer.from(keyInput, 'hex');
      } else {
        key = Buffer.from(keyInput, 'utf-8');
      }

      if (key.length !== 16) {
        const padded = Buffer.alloc(16, 0);
        key.copy(padded, 0, 0, Math.min(key.length, 16));
        key = padded;
      }

      const decipher = require('crypto').createDecipheriv('aes-128-ecb', key, null);
      decipher.setAutoPadding(true);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch (err: any) {
      console.warn('⚠️ [FileHandler] AES decryption fallback:', err.message);
      return data;
    }
  }

  private detectExtension(buf: Buffer): string | null {
    if (buf.length < 8) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
    if (buf.slice(0, 4).toString('ascii') === '%PDF') return 'pdf';
    return null;
  }

  /**
   * Format prompt with file attachment context for Antigravity
   */
  public buildPromptWithAttachments(prompt: string, attachments?: WeChatAttachment[]): string {
    if (!attachments || attachments.length === 0) return prompt;

    const attachmentLines: string[] = [];
    attachmentLines.push('\n\n---');
    attachmentLines.push('📎 【微信端附加文件信息】:');

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const relPath = att.localPath ? path.relative(process.cwd(), att.localPath) : att.name;
      attachmentLines.push(`- 文件 ${i + 1}: ${att.name} (${att.type}, 路径: \`${att.localPath || relPath}\`)`);
    }

    attachmentLines.push('请根据用户要求分析或处理上述本地文件。');
    attachmentLines.push('---\n');

    return `${prompt}\n${attachmentLines.join('\n')}`;
  }

  /**
   * Look for generated files in text to prepare as WeChat attachments
   */
  public scanOutboundAttachments(text: string): WeChatAttachment[] {
    const results: WeChatAttachment[] = [];
    // Match Markdown file links or paths like [xxx](file:///...) or file paths
    const linkRegex = /\[([^\]]+)\]\((file:\/\/\/?[^\)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      const name = match[1];
      const rawUri = match[2].replace(/^file:\/\/\/?/, '');
      const filePath = decodeURIComponent(rawUri);

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        results.push({
          name,
          type: 'file',
          size: stat.size,
          localPath: filePath,
        });
      }
    }

    return results;
  }
}
