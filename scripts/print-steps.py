import json, urllib.request, ssl

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
    for i, s in enumerate(steps[-6:], start=len(steps)-6):
        st = s.get('type')
        status = s.get('status')
        print(f'Step {i}: type={st} status={status}')
        if s.get('plannerResponse'):
            pr = s['plannerResponse']
            if pr.get('content'):
                print(f'   Output Content:\n{pr.get("content")}')
