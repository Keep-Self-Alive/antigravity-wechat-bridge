import os
import winreg

startup_dir = os.path.join(os.environ['APPDATA'], r'Microsoft\Windows\Start Menu\Programs\Startup')
target_vbs = r'E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\tray_companion.py'

# Create modern vbs runner in Startup that uses absolute pythonw
vbs_runner = os.path.join(startup_dir, 'Antigravity_Tray_Launcher.vbs')
vbs_content = f'''Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "E:\\001核心文件\\01项目\\antigravity-wechat-bridge"
WshShell.Run "pythonw.exe ""E:\\001核心文件\\01项目\\antigravity-wechat-bridge\\scripts\\tray_companion.py""", 0, False
Set WshShell = Nothing
'''

with open(vbs_runner, 'w', encoding='gbk') as f:
    f.write(vbs_content)

print(f"Installed double-insurance launcher at: {vbs_runner}")
