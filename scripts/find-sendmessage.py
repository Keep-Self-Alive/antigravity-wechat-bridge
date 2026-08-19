import os, glob

base_dir = r'C:\Users\15389\AppData\Local\npm-cache\_npx\c2268fea7b47f542\node_modules\@tencent-weixin\openclaw-weixin-cli'
for root, _, files in os.walk(base_dir):
    for f in files:
        full_p = os.path.join(root, f)
        try:
            with open(full_p, 'r', encoding='utf-8', errors='ignore') as fp:
                content = fp.read()
            if 'sendmessage' in content or 'send_message' in content:
                print('Found in:', full_p)
                for line in content.split('\n'):
                    if 'sendmessage' in line or 'send_message' in line:
                        print('  Line:', line[:200])
        except:
            pass
