import os

cache_dir = os.path.expanduser('~/AppData/Local/npm-cache')
for root, _, files in os.walk(cache_dir):
    for f in files:
        if f.endswith('.js') or f.endswith('.mjs') or f.endswith('.ts'):
            full_p = os.path.join(root, f)
            try:
                with open(full_p, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                if 'sendmessage' in content:
                    print('Found in:', full_p)
            except:
                pass
