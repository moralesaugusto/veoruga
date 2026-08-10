#!/usr/bin/env python3
"""Generate Veoruga toolbar icons (16/32/48/128 px) with Pillow.

Design: a rounded purple tile with a white "region marquee" — four
corner brackets around a dashed rectangle — the universal snip/screenshot
motif, in the spirit of Firefox's screenshot tool.

Each icon is drawn at 4x and downscaled with LANCZOS for clean anti-aliasing.
"""
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
SS = 4  # supersample factor

# Firefox-ish purple/indigo gradient endpoints
TOP = (123, 47, 247)     # #7B2FF7
BOTTOM = (76, 110, 245)   # #4C6EF5
WHITE = (255, 255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make(size):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # vertical gradient background
    grad = Image.new("RGBA", (S, S))
    gd = grad.load()
    for y in range(S):
        c = lerp(TOP, BOTTOM, y / max(1, S - 1))
        for x in range(S):
            gd[x, y] = (c[0], c[1], c[2], 255)

    radius = int(S * 0.22)
    mask = rounded_mask(S, radius)
    img.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(img)

    # marquee geometry
    m = S * 0.26          # margin from tile edge
    x0, y0, x1, y1 = m, m, S - m, S - m
    stroke = max(2, int(S * 0.055))
    arm = (x1 - x0) * 0.30  # length of each corner bracket arm

    def bracket(cx, cy, dx, dy):
        # horizontal arm
        draw.line([(cx, cy), (cx + dx * arm, cy)], fill=WHITE, width=stroke)
        # vertical arm
        draw.line([(cx, cy), (cx, cy + dy * arm)], fill=WHITE, width=stroke)

    bracket(x0, y0, 1, 1)    # top-left
    bracket(x1, y0, -1, 1)   # top-right
    bracket(x0, y1, 1, -1)   # bottom-left
    bracket(x1, y1, -1, -1)  # bottom-right

    # dashed rectangle connecting the brackets (skip at tiniest size)
    if size >= 32:
        dash = (x1 - x0) * 0.09
        gap = dash * 0.75
        dstroke = max(2, int(S * 0.035))

        def dashed(a, b, horizontal):
            start = a
            end = b
            pos = start
            while pos < end:
                seg_end = min(pos + dash, end)
                if horizontal:
                    draw.line([(pos, hy), (seg_end, hy)], fill=WHITE, width=dstroke)
                else:
                    draw.line([(vx, pos), (vx, seg_end)], fill=WHITE, width=dstroke)
                pos = seg_end + gap

        hy = y0
        dashed(x0 + arm, x1 - arm, True)
        hy = y1
        dashed(x0 + arm, x1 - arm, True)
        vx = x0
        dashed(y0 + arm, y1 - arm, False)
        vx = x1
        dashed(y0 + arm, y1 - arm, False)

    # round corners of the bracket lines look better with rounded ends;
    # Pillow lines are butt-capped, so drop small circles at joints
    r = stroke / 2
    for (cx, cy) in [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


for s in SIZES:
    make(s).save(f"icons/icon{s}.png")
    print(f"icons/icon{s}.png")
