import subprocess
import re

script = """
Get-CimInstance Win32_Process -Filter "Name like '%language_server%'" | Select-Object ProcessId, CommandLine | ConvertTo-Json
"""
res = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True)
print("OUT:", res.stdout)
