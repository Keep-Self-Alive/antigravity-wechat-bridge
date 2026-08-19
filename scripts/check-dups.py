import subprocess
import os
import signal

# Find all node processes running start-live-wechat.ts
script = """
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*start-live-wechat*" } | Select-Object ProcessId, CommandLine | ConvertTo-Json
"""

res = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True)
print("Running bridge processes:", res.stdout)
