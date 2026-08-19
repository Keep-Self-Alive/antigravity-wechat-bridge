import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const PORT = 52075;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function testCall(method: string, body: any = {}) {
  const data = Buffer.from(JSON.stringify(body), 'utf-8');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': CSRF,
        'Content-Length': data.length,
      },
    }, (res) => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, raw: chunks });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Testing GetServerStatus...');
  try {
    const status = await testCall('GetServerStatus');
    console.log('GetServerStatus response:', JSON.stringify(status, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }

  console.log('Testing GetClientModelConfigs...');
  try {
    const models = await testCall('GetClientModelConfigs');
    console.log('GetClientModelConfigs response:', JSON.stringify(models, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
