import os, glob

base_dir = r'C:\Users\15389\AppData\Local\Programs\Antigravity'
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.js'):
            full_p = os.path.join(root, f)
            try:
                with open(full_p, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                if 'sendUserCascadeMessage' in content or 'SendUserCascadeMessage' in content:
                    print('Found in JS:', full_p)
            except:
                pass
