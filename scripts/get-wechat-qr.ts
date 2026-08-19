/**
 * Standalone WeChat ClawBot QR Code Generator & Login Poller
 * Directly connects to Tencent WeChat ilink AI Service
 */

import https from 'https';

const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';
const BOT_TYPE = '3';

async function fetchQRCode(): Promise<{ qrcode: string; qrcode_img_content: string }> {
  const url = `${ILINK_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`;
  const body = JSON.stringify({ local_token_list: [] });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenClaw/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse QR response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function pollStatus(qrcode: string, baseUrl: string = ILINK_BASE_URL): Promise<any> {
  const url = `${baseUrl}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenClaw/1.0',
      },
      timeout: 35000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse status: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'wait' });
    });
    req.end();
  });
}

async function main() {
  console.log('🔄 正在向微信官方服务器请求 ClawBot 绑定二维码...');
  try {
    const qrData = await fetchQRCode();
    console.log('\n✅ 成功获取二维码信息！');
    console.log('🔗 二维码图片/扫码链接:', qrData.qrcode_img_content || qrData.qrcode);
    console.log(`\n📱 请在微信内打开链接或扫描二维码（有效时间约 5 分钟）：\nhttps://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.qrcode_img_content || qrData.qrcode)}\n`);
    console.log('⏳ 正在等待微信扫码确认...');

    let currentBase = ILINK_BASE_URL;
    while (true) {
      const statusRes = await pollStatus(qrData.qrcode, currentBase);
      const st = statusRes.status;

      if (st === 'scaned') {
        console.log('📲 检测到已扫码，请在手机微信上点击【确认绑定】...');
      } else if (st === 'confirmed') {
        console.log('\n🎉 微信绑定成功！');
        console.log('🔑 Bot Token:', statusRes.bot_token);
        console.log('🆔 Bot ID:', statusRes.ilink_bot_id);
        console.log('👤 用户 ID:', statusRes.ilink_user_id);
        break;
      } else if (st === 'expired') {
        console.log('⚠️ 二维码已过期，请重新运行生成。');
        break;
      } else if (st === 'scaned_but_redirect' && statusRes.redirect_host) {
        currentBase = `https://${statusRes.redirect_host}`;
      }

      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err: any) {
    console.error('❌ 获取失败:', err.message);
  }
}

main();
