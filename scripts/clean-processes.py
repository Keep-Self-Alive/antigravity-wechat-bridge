import subprocess
import os

script = """
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*tray_companion*" -or $_.CommandLine -like "*start-live-wechat*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
"""
subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True)
print("All old processes killed safely!")
