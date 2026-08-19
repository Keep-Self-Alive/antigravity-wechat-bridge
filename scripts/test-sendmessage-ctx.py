import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = '8eb44d7de992@im.bot:0600000fb2b8c21deaaa991d8b6370e926bec1'
bot_id = '8eb44d7de992@im.bot'
to_user = 'o9cq809QQHRoVwq3y303Uj8F0k_U'

# 1. Fetch latest updates to get active context_token
req_get = urllib.request.Request(
    'https://ilinkai.weixin.qq.com/ilink/bot/getupdates',
    data=json.dumps({'sync_buf': '', 'get_updates_buf': ''}).encode('utf-8'),
    headers={
        'Content-Type': 'application/json',
        'AuthorizationType': 'ilink_bot_token',
        'Authorization': f'Bearer {token}',
        'X-WECHAT-UIN': '0',
        'iLink-App-Id': 'bot',
        'iLink-App-ClientVersion': '132102',
    }
)
with urllib.request.urlopen(req_get, context=ctx) as res:
    up_data = json.loads(res.read().decode('utf-8'))
    print('Get updates result:', up_data.keys())

# 2. Test sendmessage with context_token and msg payload
candidates = [
    {
        'name': 'msg with context_token & message_type 2',
        'payload': {
            'msg': {
                'from_user_id': bot_id,
                'to_user_id': to_user,
                'message_type': 2,
                'message_state': 2,
                'client_id': f'cli-{int(time.time()*1000)}',
                'context_token': up_data.get('msgs', [{}])[0].get('context_token', '') if up_data.get('msgs') else '',
                'item_list': [{'type': 1, 'text_item': {'text': '你好，这是一条测试回复！'}}]
            }
        }
    },
    {
        'name': 'top-level item_list + context_token',
        'payload': {
            'from_user_id': bot_id,
            'to_user_id': to_user,
            'message_type': 2,
            'message_state': 2,
            'client_id': f'cli-{int(time.time()*1000)}',
            'context_token': up_data.get('msgs', [{}])[0].get('context_token', '') if up_data.get('msgs') else '',
            'item_list': [{'type': 1, 'text_item': {'text': '你好，这是一条测试回复！'}}]
        }
    },
    {
        'name': 'msg with bot_token & to_user_id',
        'payload': {
            'msg': {
                'to_user_id': to_user,
                'message_type': 2,
                'message_state': 2,
                'client_id': f'cli-{int(time.time()*1000)}',
                'item_list': [{'type': 1, 'text_item': {'text': '你好，这是一条测试回复！'}}]
            },
            'context_token': up_data.get('msgs', [{}])[0].get('context_token', '') if up_data.get('msgs') else ''
        }
    }
]

for c in candidates:
    req_send = urllib.request.Request(
        'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage',
        data=json.dumps(c['payload']).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'AuthorizationType': 'ilink_bot_token',
            'Authorization': f'Bearer {token}',
            'X-WECHAT-UIN': '0',
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': '132102',
        }
    )
    with urllib.request.urlopen(req_send, context=ctx) as s_res:
        print(f"{c['name']}: {s_res.read().decode('utf-8')}")
