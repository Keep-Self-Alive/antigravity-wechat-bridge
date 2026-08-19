import { MediaBridge } from '../src/media-bridge';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

async function testPush() {
  const token = '8eb44d7de992@im.bot:0600000fb2b8c21deaaa991d8b6370e926bec1';
  const toUser = 'o9cq809QQHRoVwq1U9581Yz_a_ac@im.wechat';
  const localFile = 'C:\\Users\\15389\\Desktop\\Random_Test_Data.xlsx';

  const bridge = new MediaBridge(token);
  console.log('Uploading file to Tencent CDN...');
  const uploaded = await bridge.uploadOutboundMedia(localFile, toUser, 3); // 3 is FILE
  console.log('Upload result:', uploaded);

  const fileName = path.basename(localFile);
  const payload: any = {
    msg: {
      from_user_id: '',
      to_user_id: toUser,
      client_id: `file-${Date.now()}`,
      message_type: 2,
      message_state: 2,
      item_list: [
        {
          type: 4,
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
    },
    base_info: {
      channel_version: '2.4.6',
      bot_agent: 'OpenClaw',
    },
  };

  const url = new URL('/ilink/bot/sendmessage', 'https://ilinkai.weixin.qq.com');
  const jsonStr = JSON.stringify(payload);
  const randomUin = Buffer.from(String(crypto.randomInt(100000, 999999999)), 'utf-8').toString('base64');

  const res = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'AuthorizationType': 'ilink_bot_token',
          'Authorization': `Bearer ${token}`,
          'X-WECHAT-UIN': randomUin,
          'iLink-App-Id': 'bot',
          'iLink-App-ClientVersion': '132102',
          'Content-Length': Buffer.byteLength(jsonStr),
        },
      },
      (r) => {
        let data = '';
        r.on('data', (d) => (data += d));
        r.on('end', () => resolve(JSON.parse(data)));
      }
    );
    req.on('error', reject);
    req.write(jsonStr);
    req.end();
  });

  console.log('Send file result:', res);
}

testPush().catch(console.error);
