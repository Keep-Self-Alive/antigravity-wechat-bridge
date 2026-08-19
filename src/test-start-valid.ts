import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function tryStart(payload: any) {
  const jsonBody = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/exa.language_server_pb.LanguageServerService/StartCascade`,
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
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(jsonBody);
    req.end();
  });
}

async function main() {
  const sources = [
    "CORTEX_TRAJECTORY_SOURCE_CLI",
    "CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT",
    "CORTEX_TRAJECTORY_SOURCE_AGENT_API",
    "CORTEX_TRAJECTORY_SOURCE_SDK",
    "CORTEX_TRAJECTORY_SOURCE_INTERACTIVE_CASCADE"
  ];

  for (const src of sources) {
    const res: any = await tryStart({
      trajectorySource: src,
      workspaceDirectory: "C:\\Users\\15389\\.gemini\\antigravity\\scratch"
    });
    console.log(`Source: ${src} -> status=${res.status}, body=${res.body}`);
  }
}

main();
