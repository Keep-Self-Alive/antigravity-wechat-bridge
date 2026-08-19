import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const PORT = 52074;
const CSRF = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679';

async function getSteps() {
  const jsonBody = JSON.stringify({ cascadeId: '139db9c7-af40-45d9-b0ef-75e3d991bc74' });
  const req = https.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: `/exa.language_server_pb.LanguageServerService/GetCascadeTrajectorySteps`,
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
      const userStep = parsed.steps?.find((s: any) => s.type === 'CORTEX_STEP_TYPE_USER_INPUT');
      console.log('Sample User Step:', JSON.stringify(userStep, null, 2));
    });
  });
  req.write(jsonBody);
  req.end();
}

getSteps();
