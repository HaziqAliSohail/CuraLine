"""Generate EVERY brand icon from the one canonical mark (assets/logo.png).

One source → identical artwork everywhere. Run from the Mobile/ directory:
    python gen_icons.py

Mobile (Mobile/assets/):
  - icon.png            iOS/general: white mark on indigo, opaque (no alpha)
  - adaptive-icon.png   Android adaptive foreground, transparent (bg via app.json)
  - splash-icon.png     splash mark, transparent (bg via app.json)

Web (../Frontend/public/):
  - apple-touch-icon.png  180x180 brand tile (white mark on indigo)
  - favicon-32.png        32x32 brand tile
  - favicon-16.png        16x16 brand tile
  - favicon.ico           16/32/48 brand tile (multi-size)
"""
from PIL import Image

BRAND = (79, 70, 229)   # #4f46e5
SRC = "assets/logo.png"
WEB = "../Frontend/public"

src = Image.open(SRC).convert("RGBA")
W, H = src.size

# Mask of the mark: coloured (not near-white) and visible pixels. Works whether
# the source background is transparent or white.
mask_data = [
    a if (a > 16 and not (r > 238 and g > 238 and b > 238)) else 0
    for r, g, b, a in src.getdata()
]
mask = Image.new("L", (W, H), 0)
mask.putdata(mask_data)
mask = mask.crop(mask.getbbox())
mw, mh = mask.size

# White silhouette of the mark.
white_mark = Image.new("RGBA", (mw, mh), (255, 255, 255, 255))
white_mark.putalpha(mask)


def composed(size, width_frac, bg):
    canvas = Image.new("RGBA", (size, size), bg)
    tw = int(size * width_frac)
    th = int(mh * (tw / mw))
    m = white_mark.resize((tw, th), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - tw) // 2, (size - th) // 2))
    return canvas


# ── Mobile ──
composed(1024, 0.62, BRAND + (255,)).convert("RGB").save("assets/icon.png")
composed(1024, 0.50, (0, 0, 0, 0)).save("assets/adaptive-icon.png")
composed(1024, 0.55, (0, 0, 0, 0)).save("assets/splash-icon.png")

# ── Web favicons (same brand tile as the app icon, larger mark for legibility) ──
composed(180, 0.66, BRAND + (255,)).convert("RGB").save(f"{WEB}/apple-touch-icon.png")
composed(32, 0.78, BRAND + (255,)).convert("RGB").save(f"{WEB}/favicon-32.png")
composed(16, 0.82, BRAND + (255,)).convert("RGB").save(f"{WEB}/favicon-16.png")
# Multi-size .ico from a high-res tile.
composed(256, 0.70, BRAND + (255,)).convert("RGB").save(
    f"{WEB}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
)

print("done: mobile icon/adaptive/splash + web apple-touch/favicon-32/16/ico "
      f"(source {W}x{H})")
