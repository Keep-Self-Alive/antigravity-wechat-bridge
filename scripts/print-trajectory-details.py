import urllib.request, json, ssl, sys
sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

csrf = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679'
cid = '6b367b07-3e04-4dc0-acd7-93a93edd2eaf'

req_traj = urllib.request.Request(
    'https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory',
    data=json.dumps({'cascadeId': cid}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'x-codeium-csrf-token': csrf}
)
with urllib.request.urlopen(req_traj, context=ctx) as r:
    data = json.loads(r.read().decode('utf-8'))
    steps = data.get('trajectory', {}).get('steps', [])
    for idx in range(190, len(steps)):
        s = steps[idx]
        st = s.get('type')
        print(f'=== Step {idx} ({st}) ===')
        if s.get('runCommand'):
            print('Command:', s['runCommand'].get('commandLine')[:80])
            print('Description:', s['runCommand'].get('description'))
        if s.get('plannerResponse'):
            pr = s['plannerResponse']
            if pr.get('toolCalls'):
                for tc in pr['toolCalls']:
                    print('ToolCall:', tc.get('toolName'), tc.get('description'), tc.get('toolSummary'), tc.get('toolAction'))
            if pr.get('thinking'):
                print('Thinking:', pr['thinking'][:100])
