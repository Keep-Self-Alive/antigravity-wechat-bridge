import urllib.request, json, ssl, time, random, base64

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

token = '8eb44d7de992@im.bot:0600000fb2b8c21deaaa991d8b6370e926bec1'
to_user = 'o9cq809QQHRoVwq1U9581Yz_a_ac@im.wechat'

def test_send(text_len):
    text = '这是测试内容abcdef1234567890\n' * (text_len // 30 + 1)
    text = text[:text_len]
    body = {
        'msg': {
            'from_user_id': '',
            'to_user_id': to_user,
            'client_id': f'test-len-{text_len}-{int(time.time()*1000)}',
            'message_type': 2,
            'message_state': 2,
            'item_list': [{'type': 1, 'text_item': {'text': text}}],
        },
        'base_info': {'channel_version': '2.4.6', 'bot_agent': 'OpenClaw'}
    }
    req = urllib.request.Request(
        'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'AuthorizationType': 'ilink_bot_token',
            'Authorization': f'Bearer {token}',
            'X-WECHAT-UIN': base64.b64encode(str(random.randint(100000, 99999999)).encode('utf-8')).decode('utf-8'),
            'iLink-App-Id': 'bot',
            'iLink-App-ClientVersion': '132102',
        }
    )
    with urllib.request.urlopen(req, context=ctx) as res:
        print(f'Length {text_len} -> {res.read().decode("utf-8")}')

for length in [100, 300, 500, 800, 1000, 1500, 2000]:
    test_send(length)
    time.sleep(0.5)
