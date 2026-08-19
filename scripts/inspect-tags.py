with open(r'C:\Users\15389\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe', 'rb') as f:
    data = f.read()

import re
pos = 0
while True:
    idx = data.find(b'name=trajectory_source', pos)
    if idx == -1:
        break
    start = max(0, idx - 150)
    end = min(len(data), idx + 250)
    chunk = data[start:end]
    print('--- MATCH AT', idx, '---')
    print(''.join(chr(b) if 32 <= b <= 126 else ' ' for b in chunk))
    pos = idx + 1
