import os
import sys

startup_dir = os.path.join(os.environ["APPDATA"], r"Microsoft\Windows\Start Menu\Programs\Startup")
vbs_path = r"E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\start_silent.vbs"
bat_path = os.path.join(startup_dir, "Antigravity_WeChat_Bridge.bat")

# Write lightweight startup runner batch into Startup folder
with open(bat_path, "w", encoding="utf-8") as f:
    f.write('@echo off\n')
    f.write(f'wscript.exe "{vbs_path}"\n')

print(f"Startup launcher successfully installed at: {bat_path}")
