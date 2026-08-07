"""
去除 ImageGen 水印并生成 Windows 应用图标
- 输入: 1024x1024 PNG（含右下角 AI 水印）
- 处理: 采样宣纸色覆盖右下角水印区域
- 输出: 多尺寸 ICO (16/24/32/48/64/128/256) + 干净 256/512 PNG
"""
from PIL import Image
import sys
from pathlib import Path

SRC = Path(r'D:\68.AIGC\xWorkBuddy\2026-08-05-21-33-55\md-editor\resources\Chinese_ink_wash_painting__shu_2026-08-07T15-42-43.png')
OUT_DIR = Path(r'D:\68.AIGC\xWorkBuddy\2026-08-05-21-33-55\md-editor\resources')
ICO_PATH = OUT_DIR / 'icon.ico'
PNG_512 = OUT_DIR / 'icon-512.png'
PNG_256 = OUT_DIR / 'icon-256.png'

img = Image.open(SRC).convert('RGB')
W, H = img.size
print(f'src: {W}x{H}')

# 1) 采样宣纸色：从左上角安全区取 (避开墨字辐射范围)
# 取多个背景点取中位数，更稳健
samples = [(20, 20), (40, 20), (60, 20), (20, 40), (20, 60), (W-20, 20), (40, H-20)]
rs, gs, bs = [], [], []
for (x, y) in samples:
    # 注意右下水印区点要排除
    if x > W*0.7 and y > H*0.85:
        continue
    if x < W*0.4 and y > H*0.7:  # 排除底部山水墨迹
        continue
    if x < W*0.5 and y < H*0.5 and (W*0.15 < x < W*0.85) and (H*0.15 < y < H*0.7):
        continue  # 排除墨字
    r, g, b = img.getpixel((x, y))
    rs.append(r); gs.append(g); bs.append(b)
paper = (sorted(rs)[len(rs)//2], sorted(gs)[len(gs)//2], sorted(bs)[len(bs)//2])
print(f'paper color sampled: {paper}')

# 2) 覆盖右下角水印区域：x:70-100%, y:85-100%（不碰印章 y<84%）
x0 = int(W * 0.70); x1 = W
y0 = int(H * 0.85); y1 = H
covered = Image.new('RGB', (x1-x0, y1-y0), paper)
img.paste(covered, (x0, y0))

# 轻微给覆盖区加一些宣纸纹理噪点（与周围融合）
import random
draw_pixels = img.load()
for y in range(y0, y1):
    for x in range(x0, x1):
        # 轻微抖动 ±4
        r0, g0, b0 = paper
        j = 5
        r = max(0, min(255, r0 + random.randint(-j, j)))
        g = max(0, min(255, g0 + random.randint(-j, j)))
        b = max(0, min(255, b0 + random.randint(-j, j)))
        draw_pixels[x, y] = (r, g, b)

# 3) 输出干净 512 / 256 PNG
img.resize((512, 512), Image.LANCZOS).save(PNG_512, 'PNG', optimize=True)
img.resize((256, 256), Image.LANCZOS).save(PNG_256, 'PNG', optimize=True)
print(f'saved: {PNG_512} {PNG_256}')

# 4) 生成多尺寸 ICO
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
base = img.convert('RGBA')
# ICO 需要 RGBA
base_rgba = Image.new('RGBA', base.size, (paper[0], paper[1], paper[2], 255))
base_rgba.paste(base, mask=base.split()[3] if base.mode == 'RGBA' else None)
base_rgba.save(ICO_PATH, format='ICO', sizes=sizes)
print(f'saved: {ICO_PATH} sizes={sizes}')

# 5) 校验 ICO
ico = Image.open(ICO_PATH)
ico_sizes = []
for i in range(ico.n_frames):
    ico.seek(i)
    ico_sizes.append(ico.size)
print(f'ico contains: {ico_sizes}')