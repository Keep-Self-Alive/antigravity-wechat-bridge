import os
from PIL import Image, ImageDraw

ico_path = r"E:\001核心文件\01项目\antigravity-wechat-bridge\scripts\app.ico"
img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Blue outer circle + green inner dot
draw.ellipse((2, 2, 30, 30), fill=(26, 115, 232, 255))
draw.ellipse((10, 10, 22, 22), fill=(7, 193, 96, 255))
img.save(ico_path, format="ICO")
print("Saved .ico:", ico_path)
