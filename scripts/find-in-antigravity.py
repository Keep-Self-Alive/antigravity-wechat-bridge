import os, glob

base_dir = r'C:\Users\15389\AppData\Local\Programs\Antigravity'
for root, _, files in os.walk(base_dir):
    for f in files:
        if not f.endswith('.exe'):
            full_p = os.path.join(root, f)
            try:
                with open(full_p, 'rb') as fp:
                    data = fp.read()
                if b'SendUserCascadeMessage' in data:
                    print('Found in file:', full_p)
            except:
                pass
