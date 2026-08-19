import subprocess

res = subprocess.run('wmic process get name,processid', capture_output=True, text=True, shell=True)
for line in res.stdout.splitlines():
    if any(k in line.lower() for k in ['antigravity', 'gemini', 'codeium', 'language', 'server', 'electron']):
        print(line)
