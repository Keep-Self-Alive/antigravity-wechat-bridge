import os
import sys
import winreg

py_full = sys.executable
pyw_full = os.path.join(os.path.dirname(py_full), 'pythonw.exe')
if not os.path.exists(pyw_full):
    pyw_full = py_full

script_path = r"E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\tray_companion.py"
command = f'"{pyw_full}" "{script_path}"'

key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
winreg.SetValueEx(key, "AntigravityWeChatBridgeTray", 0, winreg.REG_SZ, command)
winreg.CloseKey(key)

print(f"Registered absolute HKCU Run command: {command}")
