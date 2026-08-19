import subprocess
import os
import signal

# Kill all existing bridge processes
script = """
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*start-live-wechat*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
"""

subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True)
print("Cleaned all stale bridge processes!")
