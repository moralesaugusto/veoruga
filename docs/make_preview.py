#!/usr/bin/env python3
"""Render docs/preview.png — a README hero showing Veoruga's popup and a
snip-in-action mockup. Faithful to the extension's real colors/UI.

Drawn at 2x and downscaled with LANCZOS for crisp edges. Requires Pillow.
"""
from PIL import Image, ImageDraw, ImageFont

SS = 2  # supersample
W, H = 1200 * SS, 660 * SS

ACCENT = (76, 110, 245)
INK = (17, 24, 39)
MUTED = (107, 114, 128)
LINE = (229, 231, 235)
SURFACE2 = (249, 250, 251)

ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(bold, size):
    return ImageFont.truetype(ARIAL_B if bold else ARIAL, size * SS)


f_title = font(True, 26)
f_btn = font(False, 15)
f_small = font(False, 12)
f_tool = font(True, 11)
f_tag = font(True, 13)

img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
d = ImageDraw.Draw(img)

# soft vertical background gradient
top, bot = (244, 246, 251), (233, 237, 246)
for y in range(H):
    t = y / (H - 1)
    c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    d.line([(0, y), (W, y)], fill=c)


def rr(box, radius, fill=None, outline=None, width=1):
    d.rounded_rectangle(
        [v * SS for v in box], radius=radius * SS, fill=fill, outline=outline,
        width=width * SS,
    )


def shadow(box, radius, blur=(0, 12), alpha=55):
    ox, oy = blur
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    b = [(box[0] + ox) * SS, (box[1] + oy) * SS, (box[2] + ox) * SS, (box[3] + oy) * SS]
    sd.rounded_rectangle(b, radius=radius * SS, fill=(15, 23, 42, alpha))
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(9 * SS))
    img.alpha_composite(sh)


def center_text(cx, y, text, fnt, fill):
    w = d.textlength(text, font=fnt)
    d.text((cx * SS - w / 2, y * SS), text, font=fnt, fill=fill)


# ------------------------------------------------------------------ popup card
px0, py0, px1, py1 = 90, 150, 470, 430
shadow((px0, py0, px1, py1), 18)
rr((px0, py0, px1, py1), 18, fill=(255, 255, 255))

# header: icon + name
icon = Image.open("../icons/icon128.png").convert("RGBA").resize((44 * SS, 44 * SS), Image.LANCZOS)
img.alpha_composite(icon, (int((px0 + 28) * SS), int((py0 + 30) * SS)))
d.text(((px0 + 84) * SS, (py0 + 40) * SS), "Veoruga", font=f_title, fill=INK)

# two action buttons
bx0, bx1 = px0 + 28, px1 - 28
by = py0 + 104
bh, gap = 56, 16
for i, label in enumerate(["Snip a region", "Capture visible area"]):
    y0 = by + i * (bh + gap)
    rr((bx0, y0, bx1, y0 + bh), 10, fill=SURFACE2, outline=LINE, width=1)
    center_text((bx0 + bx1) / 2, y0 + bh / 2 - 11, label, f_btn, INK)

# ---------------------------------------------------- snip-in-action browser
wx0, wy0, wx1, wy1 = 560, 120, 1110, 540
shadow((wx0, wy0, wx1, wy1), 16)
rr((wx0, wy0, wx1, wy1), 16, fill=(255, 255, 255), outline=LINE, width=1)

# title bar
rr((wx0, wy0, wx1, wy0 + 40), 16, fill=(243, 244, 246))
d.rectangle([wx0 * SS, (wy0 + 28) * SS, wx1 * SS, (wy0 + 40) * SS], fill=(243, 244, 246))
for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
    cx = (wx0 + 22 + i * 20) * SS
    cy = (wy0 + 20) * SS
    d.ellipse([cx - 6 * SS, cy - 6 * SS, cx + 6 * SS, cy + 6 * SS], fill=col)
rr((wx0 + 84, wy0 + 11, wx1 - 20, wy0 + 30), 9, fill=(255, 255, 255), outline=LINE, width=1)

# page content: placeholder blocks
cy = wy0 + 62
blocks = [(0.62, 14), (0.86, 14), (0.72, 14), (0.0, 8),
          (0.9, 40), (0.0, 8), (0.5, 14), (0.8, 14)]
for frac, hgt in blocks:
    if frac == 0:
        cy += hgt
        continue
    rr((wx0 + 24, cy, wx0 + 24 + (wx1 - wx0 - 48) * frac, cy + hgt), hgt // 2 if hgt < 20 else 8,
       fill=(226, 229, 235))
    cy += hgt + 12

# selection region + dim everything outside it (Firefox-style)
sx0, sy0, sx1, sy1 = wx0 + 40, wy0 + 150, wx0 + 330, wy0 + 300
dim = Image.new("RGBA", img.size, (0, 0, 0, 0))
dd = ImageDraw.Draw(dim)
# dim inside the content area only
dd.rectangle([(wx0 + 1) * SS, (wy0 + 41) * SS, (wx1 - 1) * SS, (wy1 - 1) * SS], fill=(15, 23, 42, 90))
# clear the selection back out
dd.rectangle([sx0 * SS, sy0 * SS, sx1 * SS, sy1 * SS], fill=(0, 0, 0, 0))
img.alpha_composite(dim)
rr((sx0, sy0, sx1, sy1), 2, outline=ACCENT, width=2)
# corner ticks
for (cx, cy2, dx, dy) in [(sx0, sy0, 1, 1), (sx1, sy0, -1, 1), (sx0, sy1, 1, -1), (sx1, sy1, -1, -1)]:
    d.line([(cx * SS, cy2 * SS), ((cx + dx * 14) * SS, cy2 * SS)], fill=ACCENT, width=4 * SS)
    d.line([(cx * SS, cy2 * SS), (cx * SS, (cy2 + dy * 14) * SS)], fill=ACCENT, width=4 * SS)

# result toolbar under the selection
tb_w, tb_h = 236, 34
tbx = sx0
tby = sy1 + 12
rr((tbx, tby, tbx + tb_w, tby + tb_h), 9, fill=(255, 255, 255), outline=LINE, width=1)
# mini buttons
mbs = [("Download", ACCENT, (255, 255, 255)), ("Copy", SURFACE2, INK), ("Close", SURFACE2, INK)]
mx = tbx + 8
for label, bg, fg in mbs:
    w = d.textlength(label, font=f_tool) / SS + 18
    rr((mx, tby + 6, mx + w, tby + tb_h - 6), 6, fill=bg, outline=None if bg == ACCENT else LINE, width=1)
    d.text(((mx + 9) * SS, (tby + 11) * SS), label, font=f_tool, fill=fg)
    mx += w + 8

# ---------------------------------------------------------------- caption tag
tag = "Snip a region · Capture the visible page · Download or copy"
tw = d.textlength(tag, font=f_tag)
d.text((W / 2 - tw / 2, (H - 52) * SS), tag, font=f_tag, fill=MUTED)

out = img.convert("RGB").resize((W // SS, H // SS), Image.LANCZOS)
out.save("preview.png")
print("docs/preview.png", out.size)
