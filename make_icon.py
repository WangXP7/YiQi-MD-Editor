# -*- coding: utf-8 -*-
"""图标后处理 v2：去水印 → 圆角透明轮廓 → 多尺寸 .ico"""
import os
import sys
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\xp772\.qwenworkcn\workspace\msnehwy77jd6sk3z\vibe_images\yiqi-md-editor-icon_1786378211.png"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_LOGO = os.path.join(HERE, "assets", "logo.png")
OUT_ICO = os.path.join(HERE, "assets", "icon.ico")

img = Image.open(SRC).convert("RGBA")
W, H = img.size  # 1024

# 1) 用水印区域正上方的内容垂直翻转覆盖水印（颜色连续无接缝）
wm_x, wm_y = int(W * 0.74), int(H * 0.88)
patch_h = H - wm_y
patch = img.crop((wm_x, wm_y - patch_h, W, wm_y)).transpose(Image.FLIP_TOP_BOTTOM)
img.paste(patch, (wm_x, wm_y))

# 2) 4x 超采样圆角矩形蒙版 → 平滑抗锯齿透明轮廓
scale = 4
radius = int(W * 0.225) * scale
mask = Image.new("L", (W * scale, H * scale), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([0, 0, W * scale - 1, H * scale - 1], radius=radius, fill=255)
mask = mask.resize((W, H), Image.LANCZOS)

# 3) 应用蒙版（圆角外全部透明）
img.putalpha(mask)

# 4) 输出
os.makedirs(os.path.dirname(OUT_LOGO), exist_ok=True)
img.save(OUT_LOGO, "PNG")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(OUT_ICO, format="ICO", sizes=sizes)
print("icon ok:", OUT_ICO, os.path.getsize(OUT_ICO), "bytes")
