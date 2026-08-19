import os
import shutil

startup_dir = os.path.join(os.environ['APPDATA'], r'Microsoft\Windows\Start Menu\Programs\Startup')
ag_lnk_source = os.path.join(os.environ['APPDATA'], r'Microsoft\Windows\Start Menu\Programs\Antigravity\Antigravity.lnk')
ag_lnk_target = os.path.join(startup_dir, 'Antigravity.lnk')

if os.path.exists(ag_lnk_source):
    shutil.copy2(ag_lnk_source, ag_lnk_target)
    print(f"Successfully copied Antigravity to Startup folder: {ag_lnk_target}")
else:
    print("Source Antigravity.lnk not found")
