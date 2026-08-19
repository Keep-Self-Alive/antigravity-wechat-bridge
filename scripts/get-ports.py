import subprocess
import json

script = """
Get-NetTCPConnection -OwningProcess 11708 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort | ConvertTo-Json
"""
res = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True)
print("PORTS:", res.stdout)
