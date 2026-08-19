import os, re

exe_path = r'C:\Users\15389\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe'
with open(exe_path, 'rb') as f:
    data = f.read()

print('language_server.exe read size:', len(data))

# Search for SendUserCascadeMessage protobuf descriptors
pos = data.find(b'SendUserCascadeMessageRequest')
if pos != -1:
    chunk = data[pos-100:pos+800]
    strings = re.findall(rb'[\x20-\x7e]{3,50}', chunk)
    print('SendUserCascadeMessageRequest fields:', strings)

# Search for getResolvedModel or augmentConversationalConfig
pos2 = data.find(b'neither PlanModel nor RequestedModel')
if pos2 != -1:
    chunk2 = data[pos2-300:pos2+300]
    strings2 = re.findall(rb'[\x20-\x7e]{3,50}', chunk2)
    print('getResolvedModel context:', strings2)
