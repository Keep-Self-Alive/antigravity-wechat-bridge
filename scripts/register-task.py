import subprocess
import os

py_exe = r"pythonw.exe"
script_path = r"E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\tray_companion.py"
task_name = "AntigravityWeChatBridge"

# Create user-level task (no admin required)
cmd = f'schtasks /Create /TN "{task_name}" /TR "{py_exe} \\"{script_path}\\"" /SC ONLOGON /F'
res = subprocess.run(cmd, shell=True, capture_output=True, text=True)

print("User-Level Task Scheduler Result:")
print("OUT:", res.stdout)
print("ERR:", res.stderr)
