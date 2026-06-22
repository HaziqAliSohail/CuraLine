"""Generate the branded social-share image (Open Graph / Twitter card).

Run from the repo root:  python Frontend/scripts/gen_og.py
Output: Frontend/public/og-image.png (1200x630, brand indigo + white mark).
"""
from PIL import Image, ImageDraw, ImageFont

BRAND = (79, 70, 229)        # #4f46e5
SUB = (199, 210, 254)        # indigo-200 #c7d2fe
ACCENT = (99, 102, 241)      # indigo-500 #6366f1
LOGO = "Frontend/public/logo.png"
OUT = "Frontend/public/og-image.png"
F_BOLD = "Mobile/node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf"
F_MED = "Mobile/node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"

W, H = 1200, 630
canvas = Image.new("RGB", (W, H), BRAND)
draw = ImageDraw.Draw(canvas)

# White silhouette of the mark from logo.png.
src = Image.open(LOGO).convert("RGBA")
sw, sh = src.size
mask_data = [a if (a > 16 and not (r > 238 and g > 238 and b > 238)) else 0
             for r, g, b, a in src.getdata()]
mask = Image.new("L", (sw, sh), 0)
mask.putdata(mask_data)
mask = mask.crop(mask.getbbox())
mw, mh = mask.size
white_mark = Image.new("RGBA", (mw, mh), (255, 255, 255, 255))
white_mark.putalpha(mask)

# Mark + wordmark, top-left.
mark_h = 88
mark_w = int(mw * (mark_h / mh))
canvas.paste(white_mark.resize((mark_w, mark_h), Image.LANCZOS), (80, 72), white_mark.resize((mark_w, mark_h), Image.LANCZOS))
draw.text((80 + mark_w + 24, 78), "CuraLine", font=ImageFont.truetype(F_BOLD, 56), fill=(255, 255, 255))

# Headline.
hl = ImageFont.truetype(F_BOLD, 92)
draw.text((80, 250), "Care, in order", font=hl, fill=(255, 255, 255))
draw.text((80, 350), "of urgency.", font=hl, fill=(255, 255, 255))

# Subline.
sub = ImageFont.truetype(F_MED, 36)
draw.text((82, 478), "AI severity triage · the right doctor in ~30 seconds.", font=sub, fill=SUB)

# Subtle heartbeat flourish along the bottom (brand motif).
y = 596
pts = [(0, y), (820, y), (845, y), (865, y - 34), (885, y + 40), (905, y), (1200, y)]
draw.line(pts, fill=ACCENT, width=4, joint="curve")

canvas.save(OUT)
print(f"wrote {OUT} ({W}x{H})")
