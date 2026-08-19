import subprocess

script = """
Get-CimInstance Win32_Process -Filter "ProcessId = 1480" | Select-Object ProcessId, CommandLine | ConvertTo-Json
"""

res = subprocess.run(["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
