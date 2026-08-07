"""
去除深色版图标的 AI 水印并输出深色主题图标资源
- 输入: 1024x1024 深色水墨 PNG（含右下角水印）
- 处理: 采样背景色覆盖右下角水印区域（避开印章）
- 输出: icon-dark.ico (16-256) + icon-dark-256/512.png
"""
from PIL import Image
from pathlib import Path
import random

SRC = Path(r'D:\68.AIGC\xWorkBuddy\2026-08-05-21-33-55\md-editor\resources\Chinese_ink_wash_painting__shu_2026-08-07T17-15-17.png')
OUT = Path(r'D:\68.AIGC\xWorkBuddy\2026-08-05-21-33-55\md-editor\resources')

img = Image.open(SRC).convert('RGB')
W, H = img.size
print(f'src: {W}x{H}')

# 采样深色背景（左下/左上边缘区，避开墨字/印章/山水）
samples = [(30, 30), (W-30, 30), (30, H-120), (60, 30), (30, 60), (W-60, 30)]
rs, gs, bs = [], [], []
for (x, y) in samples:
    r, g, b = img.getpixel((x, y))
    rs.append(r); gs.append(g); bs.append(b)
bg = (sorted(rs)[len(rs)//2], sorted(gs)[len(gs)//2], sorted(bs)[len(bs)//2])
print(f'bg color: {bg}')

# 覆盖右下角水印：x:70-100%, y:87-100%（印章约 y<87%）
x0, x1 = int(W*0.70), W
y0, y1 = int(H*0.87), H
img.paste(Image.new('RGB', (x1-x0, y1-y0), bg), (x0, y0))

# 背景噪点融合
px = img.load()
for y in range(y0, y1):
    for x in range(x0, x1):
        j = 4
        px[x, y] = tuple(max(0, min(255, c + random.randint(-j, j))) for c in bg)

# 输出
img.resize((512, 512), Image.LANCZOS).save(OUT/'icon-dark-512.png', 'PNG', optimize=True)
img.resize((256, 256), Image.LANCZOS).save(OUT/'icon-dark-256.png', 'PNG', optimize=True)
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
img.save(OUT/'icon-dark.ico', format='ICO', sizes=sizes)
print('saved icon-dark.ico / icon-dark-256.png / icon-dark-512.png')