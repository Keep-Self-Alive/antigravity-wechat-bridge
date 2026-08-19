import subprocess
import re
import json

res = subprocess.run('wmic process get processid,commandline', capture_output=True, text=True, shell=True)
for line in res.stdout.splitlines():
    if "language_server" in line:
        print("Found line:", line[:200])
        p_match = re.search(r'--server_port\s+([0-9]+)', line)
        c_match = re.search(r'--csrf_token\s+([0-9a-fA-F-]+)', line)
        if p_match and c_match:
            print("Port:", p_match.group(1), "CSRF:", c_match.group(1))
