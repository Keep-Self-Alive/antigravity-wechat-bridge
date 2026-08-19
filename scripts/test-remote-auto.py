import json, urllib.request, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

csrf = '281ace5c-a9bc-4a9b-9ce6-9ba69200f679'

# 1. Start fresh cascade via RPC (source 1 = CLI / Remote Bridge)
req = urllib.request.Request(
    'https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/StartCascade',
    data=b'{"source": 1}',
    headers={
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'x-codeium-csrf-token': csrf,
    }
)
with urllib.request.urlopen(req, context=ctx) as res:
    data = json.loads(res.read().decode('utf-8'))
    cid = data['cascadeId']
    print('Auto-provisioned remote cascade ID:', cid)

# 2. Immediately send a message to it
msg_payload = {
    'cascadeId': cid,
    'step': {
        'type': 'CORTEX_STEP_TYPE_USER_INPUT',
        'userInput': {
            'items': [{'text': '你好，请说一句话'}],
            'userResponse': '你好，请说一句话'
        }
    },
    'generatorConfig': {
        'model': 'gemini-3.7-flash-medium'
    }
}
req2 = urllib.request.Request(
    'https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage',
    data=json.dumps(msg_payload).encode('utf-8'),
    headers={
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'x-codeium-csrf-token': csrf,
    }
)
with urllib.request.urlopen(req2, context=ctx) as res2:
    print('Send message HTTP status:', res2.status)
