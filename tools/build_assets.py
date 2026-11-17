#!/usr/bin/env python3
"""Build the static site assets from the game's own art.

Local helper only. The output in assets/ is committed, so GitHub Pages serves
plain files with no build step.

Needs: Python 3 with Pillow (AVIF + WebP support) and ffmpeg on PATH.
Usage: python3 tools/build_assets.py [--game /path/to/game/repo] [--fonts dir]
"""
import argparse
import io
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
VID = ROOT / "assets" / "video"


def save_set(im, base, widths, quality=(58, 74, 80), alpha=False):
    """Write AVIF and WebP for each width, plus one JPEG/PNG fallback at the smallest width."""
    out = []
    for w in widths:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        avq, wq, jq = quality
        r.save(IMG / f"{base}-{w}.avif", quality=avq, speed=4)
        r.save(IMG / f"{base}-{w}.webp", quality=wq, method=6)
        if w != widths[0]:
            pass  # legacy fallback only at the smallest width
        elif alpha:
            r.save(IMG / f"{base}-{w}.png", optimize=True)
        else:
            r.convert("RGB").save(IMG / f"{base}-{w}.jpg", quality=jq, optimize=True, progressive=True)
        out.append((w, h))
    return out


def key_wordmark(src):
    """Turn the flat dark background of the boot wordmark into alpha."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    bg = px[0, 0]
    lo, hi = 10, 46  # colour distance ramp for the soft edge

    def dist(c):
        return max(abs(c[0] - bg[0]), abs(c[1] - bg[1]), abs(c[2] - bg[2]))

    # flood fill from the border so dark outlines inside the logo stay solid
    seen = bytearray(w * h)
    stack = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
    stack += [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    # enclosed holes (inside B and O) are seeded from exact background pixels
    stack += [(x, y) for y in range(h) for x in range(w) if dist(px[x, y]) <= 3]
    region = bytearray(w * h)
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if dist(px[x, y]) >= hi:
            continue
        region[i] = 1
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))

    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if region[y * w + x]:
                d = dist(c)
                a = 0.0 if d <= lo else min(1.0, (d - lo) / (hi - lo))
                if a <= 0:
                    op[x, y] = (0, 0, 0, 0)
                    continue
                # un-premultiply against the background colour
                rgb = tuple(max(0, min(255, round((c[k] - bg[k] * (1 - a)) / a))) for k in range(3))
                op[x, y] = rgb + (round(a * 255),)
            else:
                op[x, y] = c + (255,)
    return out.crop(out.getbbox())


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def compose_og(game, logo, fonts):
    """1200x630 share image from the forge key art, wordmark and two screenshots."""
    W, H = 1200, 630
    bg = Image.open(game / "Unity/Assets/InkboundForge/Resources/CodexArt/splash-key-art/splash_screen.png").convert("RGB")
    s = W / bg.width
    bg = bg.resize((W, round(bg.height * s)), Image.LANCZOS)
    top = round(bg.height * 0.36)
    canvas = bg.crop((0, top, W, top + H)).convert("RGBA")
    shade = Image.new("RGBA", (W, H))
    sd = ImageDraw.Draw(shade)
    for x in range(W):
        a = int(235 * max(0.0, 1 - x / 760) ** 1.2)
        sd.line([(x, 0), (x, H)], fill=(7, 10, 24, a))
    canvas = Image.alpha_composite(canvas, shade)
    vign = Image.new("RGBA", (W, H))
    vd = ImageDraw.Draw(vign)
    for y in range(140):
        vd.line([(0, H - 1 - y), (W, H - 1 - y)], fill=(7, 10, 24, int(200 * (1 - y / 140))))
    canvas = Image.alpha_composite(canvas, vign)

    shots = game / "fastlane/screenshots/en-US"
    for name, cx, ang, hgt in (("02_hordes.png", 985, 8, 520), ("05_strike_gold.png", 845, -6, 560)):
        sh = Image.open(shots / name).convert("RGB")
        sh = sh.resize((round(sh.width * hgt / sh.height), hgt), Image.LANCZOS)
        frame = Image.new("RGBA", (sh.width + 16, sh.height + 16), (0, 0, 0, 0))
        ImageDraw.Draw(frame).rounded_rectangle((0, 0, frame.width - 1, frame.height - 1), 34, fill=(14, 18, 34, 255))
        frame.alpha_composite(rounded(sh, 26), (8, 8))
        glow = Image.new("RGBA", (frame.width + 80, frame.height + 80), (0, 0, 0, 0))
        ImageDraw.Draw(glow).rounded_rectangle((40, 40, frame.width + 40, frame.height + 40), 34, fill=(0, 0, 0, 170))
        glow = glow.filter(ImageFilter.GaussianBlur(22))
        glow.alpha_composite(frame, (40, 40))
        rot = glow.rotate(ang, resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(rot, (cx - rot.width // 2, H // 2 - rot.height // 2 + 20))

    lw = 560
    lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    canvas.alpha_composite(lg, (56, 70))
    d = ImageDraw.Draw(canvas)
    f1 = ImageFont.truetype(str(fonts / "LilitaOne.ttf"), 50)
    f2 = ImageFont.truetype(str(fonts / "Nunito.ttf"), 30)
    try:
        f2.set_variation_by_axes([800])
    except Exception:
        pass
    y = 70 + lg.height + 26
    d.text((66, y), "Dig. Shoot. Go Boom.", font=f1, fill=(255, 206, 84), stroke_width=3, stroke_fill=(40, 18, 4))
    d.text((68, y + 70), "Mining survivor roguelike for iPhone", font=f2, fill=(244, 236, 220))
    canvas.convert("RGB").save(IMG / "og-image.jpg", quality=86, optimize=True, progressive=True)


def build_video(game):
    src = game / "Unity/Assets/StreamingAssets/OpeningClip/opening_clip.mp4"
    VID.mkdir(parents=True, exist_ok=True)
    vf = "scale=720:1280:flags=lanczos,format=yuv420p"
    run = lambda *a: subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)
    run("-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
        "-crf", "27", "-movflags", "+faststart", str(VID / "opening-720.mp4"))
    run("-i", str(src), "-an", "-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38",
        "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", str(VID / "opening-720.webm"))
    # poster: the logo frame at the end of the clip (what a still viewer should see)
    buf = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", "3.5", "-i", str(src), "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], check=True, capture_output=True).stdout
    poster = Image.open(io.BytesIO(buf)).convert("RGB").resize((720, 1280), Image.LANCZOS)
    poster.save(IMG / "hero-poster-720.jpg", quality=72, optimize=True, progressive=True)
    poster.save(IMG / "hero-poster-720.webp", quality=72, method=6)
    poster.resize((540, 960), Image.LANCZOS).save(IMG / "hero-poster-540.webp", quality=70, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="/Volumes/MinerFighterDev/ci/inkbound")
    ap.add_argument("--fonts", required=True, help="dir with LilitaOne.ttf and Nunito.ttf (OG image only)")
    a = ap.parse_args()
    game, fonts = Path(a.game), Path(a.fonts)
    IMG.mkdir(parents=True, exist_ok=True)
    art = game / "Unity/Assets/InkboundForge"

    logo = key_wordmark(art / "Resources/BootSplash/boot_splash_wordmark.png")
    save_set(logo, "logo", (480, 960), alpha=True)

    icon = Image.open(art / "MobileIcons/inkbound-forge-icon-ios-1024.png").convert("RGB")
    icon.resize((180, 180), Image.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)
    icon.resize((32, 32), Image.LANCZOS).save(ROOT / "favicon-32.png", optimize=True)
    small = icon.resize((96, 96), Image.LANCZOS)
    small.save(IMG / "icon-96.webp", quality=82, method=6)
    small.save(IMG / "icon-96.png", optimize=True)
    icon.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    save_set(rounded(icon, 230), "icon", (240, 480), alpha=True)

    for p in sorted((game / "fastlane/screenshots/en-US").glob("*.png")):
        save_set(Image.open(p).convert("RGB"), "shot-" + p.stem.split("_", 1)[1].replace("_", "-"), (360, 540, 720))

    keyart = art / "Resources/CodexArt/splash-key-art"
    for name in ("copper", "moss", "glass", "ember", "frost", "ink"):
        im = Image.open(keyart / f"loading_{name}.png").convert("RGB")
        top = round(im.height * 0.16)
        crop = im.crop((0, top, im.width, top + round(im.width * 4 / 3)))
        save_set(crop, f"cavern-{name}", (360, 540, 720), quality=(55, 72, 78))
    forge = Image.open(keyart / "splash_screen.png").convert("RGB")
    save_set(forge, "forge", (640, 1170), quality=(50, 68, 74))

    compose_og(game, logo, fonts)
    build_video(game)
    for f in sorted(list(IMG.iterdir()) + list(VID.iterdir())):
        print(f"{f.stat().st_size:>9}  {f.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
