import os
import shutil

src_dir = r"C:\Users\15389\.gemini\antigravity\scratch\antigravity-wechat-bridge"
dest_dir = r"E:\001核心文件\01项目\antigravity-wechat-bridge"

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir, exist_ok=True)

# Copy core directories & files
items_to_copy = ["src", "scripts", "package.json", "tsconfig.json", "README.md"]

for item in items_to_copy:
    s = os.path.join(src_dir, item)
    d = os.path.join(dest_dir, item)
    if os.path.exists(s):
        if os.path.isdir(s):
            if os.path.exists(d):
                shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
        print(f"Copied {item} -> {d}")

print("Migration completed successfully!")
