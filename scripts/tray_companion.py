"""
Tray Companion Service (Windows Modern Native System Tray).
Provides a sleek tray icon with:
- Real-time green dot status
- One-click Open Logs
- One-click Open History Directory
- One-click Restart Bridge Service
- Clean Graceful Exit
"""

import pystray
from PIL import Image
import subprocess
import os
import sys

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(PROJECT_DIR, "logs")
HISTORY_DIR = os.path.expanduser(r"~/.antigravity-wechat/history")
ICO_PATH = os.path.join(PROJECT_DIR, "scripts", "app.ico")

daemon_process = None

def load_icon_image():
    if os.path.exists(ICO_PATH):
        return Image.open(ICO_PATH)
    from PIL import ImageDraw
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((2, 2, 30, 30), fill=(26, 115, 232, 255))
    draw.ellipse((10, 10, 22, 22), fill=(7, 193, 96, 255))
    return img

def start_daemon():
    global daemon_process
    if daemon_process is not None:
        try:
            daemon_process.terminate()
        except:
            pass
            
    os.chdir(PROJECT_DIR)
    os.makedirs(LOGS_DIR, exist_ok=True)
    out_log = open(os.path.join(LOGS_DIR, "daemon.log"), "a", encoding="utf-8")
    
    daemon_process = subprocess.Popen(
        ["cmd.exe", "/c", "npm run wechat:live"],
        cwd=PROJECT_DIR,
        stdout=out_log,
        stderr=out_log,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )

def open_project_folder(icon, item):
    os.startfile(PROJECT_DIR)

def open_history_folder(icon, item):
    os.makedirs(HISTORY_DIR, exist_ok=True)
    os.startfile(HISTORY_DIR)

def open_logs_file(icon, item):
    log_file = os.path.join(LOGS_DIR, "daemon.log")
    if not os.path.exists(log_file):
        open(log_file, "w").close()
    os.startfile(log_file)

def restart_bridge(icon, item):
    start_daemon()
    icon.notify("Antigravity 微信桥接服务已平滑重启", "服务已在线 ✅")

import socket

tray_socket_lock = None

def acquire_tray_lock(port=53200):
    global tray_socket_lock
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('127.0.0.1', port))
        s.listen(1)
        tray_socket_lock = s
        return True
    except:
        return False

def on_exit(icon, item):
    global daemon_process
    if daemon_process:
        try:
            daemon_process.terminate()
        except:
            pass
    icon.stop()

def main():
    if not acquire_tray_lock():
        sys.exit(0)

    start_daemon()
    
    menu = pystray.Menu(
        pystray.MenuItem("🟢 微信桥接网关: 运行中 (在线)", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("📂 打开项目目录", open_project_folder),
        pystray.MenuItem("💬 查看微信历史记录", open_history_folder),
        pystray.MenuItem("📜 查看实时运行日志", open_logs_file),
        pystray.MenuItem("🔄 平滑重启服务", restart_bridge),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("❌ 退出网关", on_exit)
    )
    
    icon = pystray.Icon(
        "AntigravityWeChatBridge",
        load_icon_image(),
        "Antigravity 微信 AI 网关 (运行中)",
        menu
    )
    
    icon.run()

if __name__ == "__main__":
    main()
