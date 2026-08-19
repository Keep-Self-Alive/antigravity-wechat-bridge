import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function sendUserMsg(payload: any) {
  const jsonBody = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage`,
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
  const payloads = [
    { cascadeId: "139db9c7-af40-45d9-b0ef-75e3d991bc74", text: "hello" },
    { cascadeId: "139db9c7-af40-45d9-b0ef-75e3d991bc74", message: "hello" },
    { cascadeId: "139db9c7-af40-45d9-b0ef-75e3d991bc74", userInput: { text: "hello" } },
    { cascadeId: "139db9c7-af40-45d9-b0ef-75e3d991bc74", userInputStep: { text: "hello" } }
  ];

  for (let i = 0; i < payloads.length; i++) {
    const res: any = await sendUserMsg(payloads[i]);
    console.log(`Payload ${i} -> status=${res.status}, body=${res.body}`);
  }
}

main();
