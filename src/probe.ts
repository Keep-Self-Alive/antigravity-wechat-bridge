import http from 'http';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function tryEndpoint(proto: 'http' | 'https', port: number, method: string) {
  const mod = proto === 'https' ? https : http;
  const body = Buffer.from(JSON.stringify({}), 'utf-8');
  return new Promise((resolve) => {
    const req = mod.request({
      hostname: '127.0.0.1',
      port,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: 'POST',
      agent: proto === 'https' ? agent : undefined,
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': CSRF,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ proto, port, status: res.statusCode, headers: res.headers, body: data.slice(0, 300) });
      });
    });
    req.on('error', (err) => {
      resolve({ proto, port, error: err.message });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  const ports = [52074, 52075, 50406, 52062, 52067, 54815, 57823, 59491];
  for (const port of ports) {
    for (const proto of ['http', 'https'] as const) {
      const res: any = await tryEndpoint(proto, port, 'GetServerStatus');
      console.log(`Port ${port} (${proto}):`, res.status ? `Status ${res.status}, body: ${res.body}` : `Error: ${res.error}`);
    }
  }
}

main();
