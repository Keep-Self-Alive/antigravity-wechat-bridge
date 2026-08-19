import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function getModels() {
  const jsonBody = JSON.stringify({});
  const req = https.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: `/exa.language_server_pb.LanguageServerService/GetAvailableModels`,
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
      const parsed = JSON.parse(data);
      console.log('Available Models:', Object.keys(parsed.response?.models || {}));
      console.log('Sample model data:', JSON.stringify(Object.values(parsed.response?.models || {})[0], null, 2));
    });
  });
  req.write(jsonBody);
  req.end();
}

getModels();
