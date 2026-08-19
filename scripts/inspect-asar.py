import os, re

asar_path = r'C:\Users\15389\AppData\Local\Programs\Antigravity\resources\app.asar'
with open(asar_path, 'rb') as f:
    data = f.read()

print('app.asar size:', len(data))

# Search for SendUserCascadeMessage
matches = [m.start() for m in re.finditer(rb'SendUserCascadeMessage', data)]
print('Matches count:', len(matches))

for pos in matches[:5]:
    chunk = data[max(0, pos-200):pos+400]
    print('--- CHUNK ---')
    try:
        print(chunk.decode('utf-8', errors='ignore'))
    except:
        pass
