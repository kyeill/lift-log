"""Draw the app icons into docs/: a white dumbbell on blue.

Run by hand when the mark changes (needs Pillow), then bump CACHE in docs/sw.js.
  icon-192.png, icon-512.png  full-bleed, purpose "any maskable": the mark stays
                              inside the 0.4-radius safe circle
  icon-180.png                iPhone home screen; iOS only rounds the corners,
                              so the mark is drawn 25% larger
  icon-mono-512.png           white on transparent, Android themed icons
"""
from PIL import Image, ImageDraw

BLUE, WHITE = (35, 80, 196, 255), (255, 255, 255, 255)


def dumbbell(draw, size, scale, color):
    c, u = size / 2, size * 0.034 * scale            # u = one unit of the mark
    def box(x0, y0, x1, y1, r):
        draw.rounded_rectangle([c + x0 * u, c + y0 * u, c + x1 * u, c + y1 * u], radius=r * u, fill=color)
    box(-6, -1.1, 6, 1.1, 0.5)                       # bar
    for s in (-1, 1):
        x_in, x_out = (3.4, 5.4) if s > 0 else (-5.4, -3.4)
        box(x_in, -4.6, x_out, 4.6, 0.9)             # inner plate
        x_in, x_out = (5.8, 7.4) if s > 0 else (-7.4, -5.8)
        box(x_in, -3.2, x_out, 3.2, 0.8)             # outer plate


def icon(size, scale, bg, fg, name):
    big = size * 4                                   # 4x supersampling for smooth edges
    img = Image.new("RGBA", (big, big), bg)
    dumbbell(ImageDraw.Draw(img), big, scale, fg)
    img.resize((size, size), Image.LANCZOS).save(f"docs/{name}")


icon(192, 1.0, BLUE, WHITE, "icon-192.png")
icon(512, 1.0, BLUE, WHITE, "icon-512.png")
icon(180, 1.25, BLUE, WHITE, "icon-180.png")
icon(512, 1.0, (0, 0, 0, 0), WHITE, "icon-mono-512.png")
