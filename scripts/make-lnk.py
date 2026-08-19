import os

startup_dir = os.path.join(os.environ['APPDATA'], r'Microsoft\Windows\Start Menu\Programs\Startup')
bat_path = os.path.join(startup_dir, 'Antigravity_WeChat_Bridge.bat')
vbs_path = r'E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\start_silent.vbs'
shortcut_vbs = os.path.join(startup_dir, 'create_shortcut.vbs')

vbs_code = f'''
Set WshShell = CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut("{startup_dir}\\Antigravity_WeChat_Bridge.lnk")
Shortcut.TargetPath = "wscript.exe"
Shortcut.Arguments = """{vbs_path}"""
Shortcut.WorkingDirectory = "E:\\001核心文件\\01项目\\antigravity-wechat-bridge"
Shortcut.WindowStyle = 0
Shortcut.Save
'''

with open(shortcut_vbs, 'w', encoding='gbk') as f:
    f.write(vbs_code)

os.system(f'cscript //nologo "{shortcut_vbs}"')
try: os.unlink(shortcut_vbs)
except: pass
try: os.unlink(bat_path)
except: pass
print('Native Windows .lnk shortcut created successfully!')
