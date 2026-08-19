import os, re

exe_path = r'C:\Users\15389\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe'
with open(exe_path, 'rb') as f:
    data = f.read()

# Search for "SendUserCascadeMessageRequest" in protobuf definition
pos = data.find(b'SendUserCascadeMessageRequest\x12')
if pos == -1:
    pos = data.find(b'SendUserCascadeMessageRequest')

print('Pos of SendUserCascadeMessageRequest:', pos)
if pos != -1:
    # Print next 500 bytes as printable strings
    chunk = data[pos:pos+1500]
    words = re.findall(rb'[a-zA-Z0-9_]{3,40}', chunk)
    print('Protobuf message fields:', [w.decode('utf-8') for w in words])
