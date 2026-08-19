/**
 * Media Bridge — Enterprise Node.js Stream-based Media Pipeline.
 * Zero-Memory-Spike AES-128-ECB Chunked Streaming Encryption & Decryption.
 * Constant ~20MB RAM footprint even for 500MB+ large files.
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';
import os from 'os';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

export interface UploadResult {
  filekey: string;
  downloadEncryptedQueryParam: string;
  aeskey: string;
  fileSize: number;
  fileSizeCiphertext: number;
}

export class MediaBridge {
  private tempDir: string;
  private baseUrl: string;

  constructor(
    private token: string,
    baseUrl = 'https://ilinkai.weixin.qq.com'
  ) {
    this.baseUrl = baseUrl;
    this.tempDir = path.join(os.homedir(), '.antigravity-wechat', 'media');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Decrypts Tencent CDN inbound encrypted media (AES-128-ECB) using streams.
   */
  public async downloadInboundMedia(media: any, targetFileName?: string): Promise<string> {
    const fullUrl = media.full_url || media.fullUrl;
    const aesKeyRaw = media.aeskey || media.aes_key || media.aesKey;
    const ext = path.extname(targetFileName || 'media.bin') || '.jpg';
    const localPath = path.join(this.tempDir, `in_${Date.now()}_${path.basename(targetFileName || 'file' + ext)}`);

    if (!fullUrl) {
      throw new Error('Media full_url missing in Tencent payload');
    }

    let keyBuffer: Buffer;
    if (Buffer.isBuffer(aesKeyRaw)) {
      keyBuffer = aesKeyRaw;
    } else if (typeof aesKeyRaw === 'string') {
      if (aesKeyRaw.length === 32 && /^[0-9a-fA-F]+$/.test(aesKeyRaw)) {
        keyBuffer = Buffer.from(aesKeyRaw, 'hex');
      } else {
        const b64Buf = Buffer.from(aesKeyRaw, 'base64');
        if (b64Buf.length === 32 && /^[0-9a-fA-F]+$/.test(b64Buf.toString('ascii'))) {
          keyBuffer = Buffer.from(b64Buf.toString('ascii'), 'hex');
        } else {
          keyBuffer = b64Buf;
        }
      }
    } else {
      throw new Error('Invalid AES Key format in inbound media');
    }

    const encryptedTempPath = `${localPath}.enc`;
    await this.downloadHttpFile(fullUrl, encryptedTempPath);

    // Stream-based Decryption
    const decipher = crypto.createDecipheriv('aes-128-ecb', keyBuffer, null);
    decipher.setAutoPadding(true);

    const readStream = fs.createReadStream(encryptedTempPath);
    const writeStream = fs.createWriteStream(localPath);

    await streamPipeline(readStream, decipher, writeStream);

    try { fs.unlinkSync(encryptedTempPath); } catch {}
    return localPath;
  }

  /**
   * Encrypts and Uploads Outbound Media to Tencent CDN using Chunked Streams.
   */
  public async uploadOutboundMedia(localFilePath: string, toUserId: string, mediaType = 3): Promise<UploadResult> {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found at path: ${localFilePath}`);
    }

    const stats = fs.statSync(localFilePath);
    const rawsize = stats.size;

    // 1. Calculate raw file MD5 streamingly
    const rawfilemd5 = await this.calculateFileMd5(localFilePath);

    // 2. Generate random 16-byte AES key
    const aesKeyBytes = crypto.randomBytes(16);
    const aeskeyHex = aesKeyBytes.toString('hex');
    const filekey = crypto.randomBytes(16).toString('hex');

    // 3. Calculate padded ciphertext size
    const padLen = 16 - (rawsize % 16);
    const paddedSize = rawsize + padLen;

    // 4. Request Pre-Signed Upload URL from Tencent
    const getUploadUrlBody = {
      filekey,
      media_type: mediaType,
      to_user_id: toUserId,
      rawsize,
      rawfilemd5,
      filesize: paddedSize,
      no_need_thumb: true,
      aeskey: aeskeyHex,
      base_info: {
        channel_version: '2.4.6',
        bot_agent: 'OpenClaw',
      },
    };

    const upRes = await this.postJson<any>('/ilink/bot/getuploadurl', getUploadUrlBody);
    if (!upRes || !upRes.upload_full_url) {
      throw new Error(`Failed to obtain Tencent upload URL: ${JSON.stringify(upRes)}`);
    }

    // 5. Encrypt file with AES-128-ECB streamingly to encrypted temp file
    const encryptedTempPath = path.join(this.tempDir, `out_enc_${Date.now()}_${filekey}.bin`);
    const cipher = crypto.createCipheriv('aes-128-ecb', aesKeyBytes, null);
    cipher.setAutoPadding(true);

    const readStream = fs.createReadStream(localFilePath);
    const writeStream = fs.createWriteStream(encryptedTempPath);
    await streamPipeline(readStream, cipher, writeStream);

    // 6. Stream upload encrypted payload to Tencent Nova CDN
    const uploadUrl = new URL(upRes.upload_full_url);
    const downloadEncParam = await this.streamUploadToCDN(uploadUrl, encryptedTempPath, paddedSize);

    try { fs.unlinkSync(encryptedTempPath); } catch {}

    return {
      filekey,
      downloadEncryptedQueryParam: downloadEncParam,
      aeskey: aeskeyHex,
      fileSize: rawsize,
      fileSizeCiphertext: paddedSize,
    };
  }

  private calculateFileMd5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (d) => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private streamUploadToCDN(uploadUrl: URL, encryptedFilePath: string, contentLength: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: uploadUrl.hostname,
          port: 443,
          path: uploadUrl.pathname + uploadUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': contentLength,
          },
        },
        (res) => {
          let encParam = (res.headers['x-encrypted-param'] as string) || '';
          if (Array.isArray(encParam)) encParam = encParam[0];

          res.on('data', () => {});
          res.on('end', () => {
            if (encParam) {
              resolve(encParam);
            } else {
              reject(new Error('Tencent CDN upload did not return x-encrypted-param header'));
            }
          });
        }
      );

      req.on('error', reject);
      const fileStream = fs.createReadStream(encryptedFilePath);
      fileStream.pipe(req);
    });
  }

  private async downloadHttpFile(urlStr: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const fileStream = fs.createWriteStream(destPath);
      https.get(parsed, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      }).on('error', reject);
    });
  }

  private async postJson<T>(endpoint: string, body: Record<string, any>): Promise<T> {
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
            'Authorization': `Bearer ${this.token}`,
            'X-WECHAT-UIN': randomUin,
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': '132102',
            'Content-Length': Buffer.byteLength(jsonStr),
          },
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
      req.on('error', reject);
      req.write(jsonStr);
      req.end();
    });
  }
}
