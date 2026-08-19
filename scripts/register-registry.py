import winreg
import os
import sys

# Auto-detect script path dynamically relative to current script directory
script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(script_dir)
tray_script = os.path.join(script_dir, "tray_companion.py")

py_full = sys.executable
pyw_full = os.path.join(os.path.dirname(py_full), "pythonw.exe")
if not os.path.exists(pyw_full):
    pyw_full = py_full

key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
app_name = "AntigravityWeChatBridgeTray"
command = f'"{pyw_full}" "{tray_script}"'

# Register in Current User Run (HKCU) - 100% native Windows standard
try:
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
    winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, command)
    winreg.CloseKey(key)
    print(f"Successfully registered dynamically in Windows HKCU Run Registry!\nCommand: {command}")
except Exception as e:
    print("Registry error:", e)
