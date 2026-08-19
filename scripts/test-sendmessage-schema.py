import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage'
token = '8eb44d7de992@im.bot:0600000fb2b8c21deaaa991d8b6370e926bec1'
bot_id = '8eb44d7de992@im.bot'
to_user = 'o9cq809QQHRoVwq3y303Uj8F0k_U'

tests = [
    # 1. Wrapped in msg
    {'name': 'Wrapped in msg', 'payload': {
        'msg': {
            'from_user_id': bot_id,
            'to_user_id': to_user,
            'message_type': 2,
            'message_state': 2,
            'client_id': f'test-1-{int(time.time())}',
            'item_list': [{'type': 1, 'text_item': {'text': '【测试1】Wrapped in msg'}}]
        }
    }},
    # 2. Top-level with from_user_id
    {'name': 'Top-level with from_user_id', 'payload': {
        'from_user_id': bot_id,
        'to_user_id': to_user,
        'message_type': 2,
        'message_state': 2,
        'client_id': f'test-2-{int(time.time())}',
        'item_list': [{'type': 1, 'text_item': {'text': '【测试2】Top-level with from_user_id'}}]
    }},
    # 3. Wrapped in message
    {'name': 'Wrapped in message', 'payload': {
        'message': {
            'from_user_id': bot_id,
            'to_user_id': to_user,
            'message_type': 2,
            'message_state': 2,
            'client_id': f'test-3-{int(time.time())}',
            'item_list': [{'type': 1, 'text_item': {'text': '【测试3】Wrapped in message'}}]
        }
    }},
    # 4. CamelCase fields
    {'name': 'CamelCase fields', 'payload': {
        'fromUserId': bot_id,
        'toUserId': to_user,
        'messageType': 2,
        'messageState': 2,
        'clientId': f'test-4-{int(time.time())}',
        'itemList': [{'type': 1, 'textItem': {'text': '【测试4】CamelCase'}}]
    }},
    # 5. Wrapped in msg with message_type=BOT
    {'name': 'msg with bot_id', 'payload': {
        'bot_id': bot_id,
        'msg': {
            'to_user_id': to_user,
            'message_type': 2,
            'message_state': 2,
            'client_id': f'test-5-{int(time.time())}',
            'item_list': [{'type': 1, 'text_item': {'text': '【测试5】msg with bot_id'}}]
        }
    }}
]

for t in tests:
    req = urllib.request.Request(
        url,
        data=json.dumps(t['payload']).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'AuthorizationType': 'ilink_bot_token',
            'Authorization': f'Bearer {token}',
            'X-WECHAT-UIN': '0',
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': '132102',
        }
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            res_body = res.read().decode('utf-8')
            print(f"{t['name']}: {res_body}")
    except Exception as e:
        print(f"{t['name']} HTTP Error: {e}")
