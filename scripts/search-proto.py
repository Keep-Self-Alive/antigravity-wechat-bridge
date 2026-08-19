with open(r'C:\Users\15389\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe', 'rb') as f:
    data = f.read()

import re
matches = re.findall(rb'protobuf:"[^"]*CortexTrajectorySource[^"]*"', data)
for m in set(matches):
    print(m.decode('utf-8', errors='ignore'))
