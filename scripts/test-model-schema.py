import json, urllib.request, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

csrf = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679'
cid = '6b367b07-3e04-4dc0-acd7-93a93edd2eaf'

tests = [
    {'name': 'Top level requestedModel object', 'payload': {'cascadeId': cid, 'step': {'type': 'CORTEX_STEP_TYPE_USER_INPUT', 'userInput': {'items': [{'text': '春眠不觉晓'}], 'userResponse': '春眠不觉晓'}}, 'requestedModel': {'model': 'MODEL_PLACEHOLDER_M299'}}},
    {'name': 'Top level planModel obj', 'payload': {'cascadeId': cid, 'step': {'type': 'CORTEX_STEP_TYPE_USER_INPUT', 'userInput': {'items': [{'text': '春眠不觉晓'}], 'userResponse': '春眠不觉晓'}}, 'planModel': {'model': 'MODEL_PLACEHOLDER_M299'}}},
    {'name': 'Top level requestedModel string', 'payload': {'cascadeId': cid, 'step': {'type': 'CORTEX_STEP_TYPE_USER_INPUT', 'userInput': {'items': [{'text': '春眠不觉晓'}], 'userResponse': '春眠不觉晓'}}, 'requestedModel': 'MODEL_PLACEHOLDER_M299'}},
    {'name': 'Both planModel & requestedModel', 'payload': {'cascadeId': cid, 'step': {'type': 'CORTEX_STEP_TYPE_USER_INPUT', 'userInput': {'items': [{'text': '春眠不觉晓'}], 'userResponse': '春眠不觉晓'}}, 'planModel': {'model': 'MODEL_PLACEHOLDER_M299'}, 'requestedModel': {'model': 'MODEL_PLACEHOLDER_M299'}}},
]

for t in tests:
    print(f"Testing {t['name']}...")
    req = urllib.request.Request(
        'https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage',
        data=json.dumps(t['payload']).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'x-codeium-csrf-token': csrf}
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            print(f"  Send HTTP status: {res.status}")
    except Exception as e:
        print(f"  Send Error: {e}")
    time.sleep(3)
    
    # Check trajectory
    req_traj = urllib.request.Request(
        'https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory',
        data=json.dumps({'cascadeId': cid}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'x-codeium-csrf-token': csrf}
    )
    with urllib.request.urlopen(req_traj, context=ctx) as r:
        data = json.loads(r.read().decode('utf-8'))
        steps = data.get('trajectory', {}).get('steps', [])
        last_s = steps[-1]
        print(f"  Last step type: {last_s.get('type')}")
        if last_s.get('plannerResponse', {}).get('content'):
            print(f"  SUCCESS! Planner Content: {last_s['plannerResponse']['content'][:100]}")
            break
        elif last_s.get('errorMessage'):
            print(f"  Error: {last_s['errorMessage'].get('error', {}).get('shortError')}")
