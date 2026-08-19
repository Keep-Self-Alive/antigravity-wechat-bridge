import os
import subprocess

startup_dir = os.path.join(os.environ["APPDATA"], r"Microsoft\Windows\Start Menu\Programs\Startup")
bat_path = os.path.join(startup_dir, "Antigravity_WeChat_Bridge.bat")

content = '@echo off\nchcp 65001 >nul\nwscript.exe "E:\\001核心文件\\01项目\\antigravity-wechat-bridge\\scripts\\start_silent.vbs"\n'

# Write with ANSI / GBK encoding for Windows cmd.exe default encoding
with open(bat_path, "w", encoding="gbk") as f:
    f.write('@echo off\nwscript.exe "E:\\001核心文件\\01项目\\antigravity-wechat-bridge\\scripts\\start_silent.vbs"\n')

print(f"Updated {bat_path} with GBK encoding!")
