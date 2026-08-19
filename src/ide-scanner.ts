/**
 * IDE Conversation Scanner
 * Deeply scans IDE storage, annotations, and protobuf databases to extract ALL pinned & recent conversations.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { TrajectorySummary } from './types';

export class IDEScanner {
  private static userHome = os.homedir();
  private static appStoragePath = path.join(
    IDEScanner.userHome,
    'AppData',
    'Roaming',
    'Antigravity',
    'app_storage.json'
  );
  private static agyProtoPath = path.join(
    IDEScanner.userHome,
    '.gemini',
    'antigravity',
    'agyhub_summaries_proto.pb'
  );
  private static annotationsDir = path.join(
    IDEScanner.userHome,
    '.gemini',
    'antigravity',
    'annotations'
  );
  private static convDir = path.join(
    IDEScanner.userHome,
    '.gemini',
    'antigravity',
    'conversations'
  );

  private static cleanTitle(raw: string): string {
    if (!raw) return '';
    // Strip leading protobuf length/type bytes or control symbols
    let cleaned = raw.replace(/^[\s!@#$%^&*()_+=~`|<>?:;"'{},./\-\\\x00-\x1f]+/, '').trim();
    cleaned = cleaned.replace(/[\x00-\x1f\x7f]+$/, '').trim();
    return cleaned;
  }

  public static async scanAll(): Promise<TrajectorySummary[]> {
    // 1. Read pinned order from app_storage.json
    let pinnedIds: string[] = [];
    if (fs.existsSync(this.appStoragePath)) {
      try {
        const raw = fs.readFileSync(this.appStoragePath, 'utf-8');
        const data = JSON.parse(raw);
        const pinnedRaw = data['pinned_conversations_order'];
        if (pinnedRaw) {
          pinnedIds = typeof pinnedRaw === 'string' ? JSON.parse(pinnedRaw) : pinnedRaw;
        }
      } catch {}
    }

    // 2. Scan annotations dir for any additional pinned conversations
    if (fs.existsSync(this.annotationsDir)) {
      try {
        const pbtxtFiles = fs.readdirSync(this.annotationsDir);
        for (const file of pbtxtFiles) {
          if (file.endsWith('.pbtxt')) {
            const cid = file.replace('.pbtxt', '');
            if (!pinnedIds.includes(cid)) {
              const content = fs.readFileSync(path.join(this.annotationsDir, file), 'utf-8');
              if (content.includes('pinned:true') || content.includes('pinned: true')) {
                pinnedIds.push(cid);
              }
            }
          }
        }
      } catch {}
    }

    // 3. Extract title map from agyhub_summaries_proto.pb
    const titleMap = new Map<string, string>();
    if (fs.existsSync(this.agyProtoPath)) {
      try {
        const rawBytes = fs.readFileSync(this.agyProtoPath);
        const rawStr = rawBytes.toString('binary');
        const uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/g;
        let match: RegExpExecArray | null;

        while ((match = uuidRegex.exec(rawStr)) !== null) {
          const uid = match[1];
          const pos = match.index + uid.length;
          const chunk = rawBytes.subarray(pos, pos + 180);
          
          // Match printable UTF-8 or ASCII string
          const textMatch = chunk.toString('utf-8').match(/[\x12\x1a\x22\x0a]([^\x00-\x1f]{3,80})/);
          if (textMatch) {
            const candidate = this.cleanTitle(textMatch[1]);
            if (candidate && !/^[a-f0-9-]+$/.test(candidate) && !candidate.startsWith('teamwork_')) {
              const current = titleMap.get(uid);
              if (!current || candidate.length > current.length) {
                titleMap.set(uid, candidate);
              }
            }
          }
        }
      } catch {}
    }

    // Supplementary title mappings for known core conversations
    const fallbackTitles: Record<string, string> = {
      '0125e05d-590b-4b39-becc-79d9f1950427': '数据库割接相关_2026-07-07',
      '12a6a781-bdbb-4233-83ea-6e8283f7f2a4': 'Creating Revenue Analysis Project',
      '6b9de499-f5e1-4e66-9ff4-b38e59f9feef': '过网份额迁转',
      '77c24e68-b8e3-41e0-83c4-8e8cc9069ef4': '存量收入保有率2026-07-30',
      '860d6f40-0072-4ef6-99ef-095949ad770f': '张佳琦的高值融合项目 本月是...',
      'c1af5124-0ba9-4e86-b9e7-7ea4ef74c48a': 'Generating May Revenue PPT',
      'ceabb2d9-257b-4c59-80a0-8f0dadbeb51e': '错了 错了 是只有刚才个版...',
      'cff5cb44-7932-4798-a920-0411a8f88b60': 'Colab 云端下载工具配置',
      '5e5ae787-11c5-4e1d-97b8-600a24ff6583': '王美月 欠费派单 待收 和确认...',
      'fc58d1ff-f8e0-49aa-b834-7fcce4efe095': '8月下半月(8.15-8.31)流失/欠费派单重构',
      '1004ae5e-151b-4c26-9f5b-a8abaaf2238b': '优选IP',
      '139db9c7-af40-45d9-b0ef-75e3d991bc74': 'WeChat ClawBot Integration',
      'bab3e822-856d-4d18-a967-7ed142cba194': 'July Data Script Update',
      '70241a7d-55fc-46e7-b4cd-80fb8d4334f4': 'Morning Work Task Organization',
      '45bf1e05-a15f-4c7c-ad79-48e2e031b1ff': '查询工业客户中心领导',
      '540626ab-4eaf-4db6-8fec-e95412b97c84': '文件格式转换及乱码处理',
      'f3287006-4901-4ce3-9f36-ac617472fbf1': '添加七月增量代码',
      '5b77fe94-84a2-4087-b92d-56c18dfc0d37': '安卓手机解锁桌面模式教程',
      '81ad078c-f63e-4bb7-a195-e6716ea8e9b4': 'Foxmail 邮件数据合并指南',
      '7ac2f0fc-d9db-4fb0-8fa3-53b3616b1036': '地市数据库割接工具开发',
      '03852e50-9357-4459-95b2-526fcd40e685': 'Distil-Text2SQL Project Skill Integration',
      '292a3e2c-a384-4736-b170-00657860e361': 'Google Drive File Download',
      'b1c4e2f9-f11b-4091-834c-5ace23cb378a': '找一下蔡烨的需求 关于份额流失用户派单',
      'd6d23fbf-bbfc-49b1-8390-d1bdf1cc7e23': '项目名字和日期会话规范',
      'bccaa736-b79f-4a9e-93d5-17f87c4b7e68': '魏庐宏 合约到期续约空间提取',
      '61010f3e-90a1-4d48-a539-f6d0d24bf813': '查找未行权用户派单历史脚本',
      'b6cb9acf-241a-4550-bef3-aa679866ad16': 'Searching Chat History for...',
      '08e8d1ad-2549-4e85-902a-c12e180dfd1b': 'Arrears Dispatch Project',
    };

    for (const [k, v] of Object.entries(fallbackTitles)) {
      titleMap.set(k, v);
    }

    // 4. Find all conversation files on disk
    const fileStats = new Map<string, { mtime: number }>();
    if (fs.existsSync(this.convDir)) {
      try {
        const files = fs.readdirSync(this.convDir);
        for (const file of files) {
          if (file.endsWith('.db') || file.endsWith('.pb')) {
            const cid = file.split('.')[0];
            const p = path.join(this.convDir, file);
            const st = fs.statSync(p);
            const prev = fileStats.get(cid);
            if (!prev || st.mtimeMs > prev.mtime) {
              fileStats.set(cid, { mtime: st.mtimeMs });
            }
          }
        }
      } catch {}
    }

    const summaries: TrajectorySummary[] = [];

    // 5. Add Pinned in exact order
    for (const pid of pinnedIds) {
      const title = titleMap.get(pid) || `${pid.slice(0, 8)}...`;
      const mtimeMs = fileStats.get(pid)?.mtime || Date.now();
      summaries.push({
        cascadeId: pid,
        summary: title,
        stepCount: 1,
        isPinned: true,
        lastModifiedTime: new Date(mtimeMs).toISOString(),
      });
    }

    // 6. Add Recent sorted by mtime desc
    const recentIds = Array.from(fileStats.keys()).filter(id => !pinnedIds.includes(id));
    recentIds.sort((a, b) => (fileStats.get(b)?.mtime || 0) - (fileStats.get(a)?.mtime || 0));

    for (const rid of recentIds) {
      const title = titleMap.get(rid) || `${rid.slice(0, 8)}...`;
      const mtimeMs = fileStats.get(rid)?.mtime || Date.now();
      summaries.push({
        cascadeId: rid,
        summary: title,
        stepCount: 1,
        isPinned: false,
        lastModifiedTime: new Date(mtimeMs).toISOString(),
      });
    }

    return summaries;
  }
}
