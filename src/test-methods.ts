import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function testRpc(method: string, body: any = {}) {
  const jsonBody = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'x-codeium-csrf-token': CSRF,
        'Content-Length': Buffer.byteLength(jsonBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ method, status: res.statusCode, headers: res.headers, body: data.slice(0, 500) });
      });
    });
    req.on('error', (err) => {
      resolve({ method, error: err.message });
    });
    req.write(jsonBody);
    req.end();
  });
}

async function main() {
  const methods = [
    'GetServerStatus',
    'GetCommandModelConfigs',
    'GetClientModelConfigs',
    'GetWorkspaces',
    'GetAllCascadeTrajectories',
    'GetUnusedPort',
    'Heartbeat',
    'GetProcesses'
  ];

  for (const m of methods) {
    const res: any = await testRpc(m);
    console.log(`Method ${m}: status=${res.status}, body=${res.body}`);
  }
}

main();
