import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function testStartCascade() {
  const jsonBody = JSON.stringify({
    source: "CORTEX_TRAJECTORY_SOURCE_USER",
    workspaceDirectory: "C:\\Users\\15389\\.gemini\\antigravity\\scratch",
    trajectoryType: "CORTEX_TRAJECTORY_TYPE_CASCADE"
  });
  
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
      console.log('StartCascade result: status=', res.statusCode, 'body=', data);
    });
  });
  req.write(jsonBody);
  req.end();
}

testStartCascade();
