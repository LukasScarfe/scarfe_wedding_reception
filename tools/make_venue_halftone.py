#!/usr/bin/env python3
"""Newspaper halftone of the Urban Field House for venue.html.

The same screen as the invite photo (invite/make_halftone.py): a true
1-bit, two-ink PNG with a clustered-dot screen at 45 degrees, so the
venue picture matches the couple's photo on the front page.
Run from anywhere; tune CROP, then re-run.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).parent
ROOT = HERE.parent
DPI = 600          # output pixels per inch
LPI = 70           # screen ruling; old newsprint ran 50-85, lower = coarser dots
ANGLE = 45         # degrees
INK = (27, 26, 23)
PAPER = (232, 226, 210)  # matches --paper on the website

# Source crop (x, y, width in source px) and the photo box size in inches.
# Height of the crop follows from the box. A 2:1 crop, wide like a
# newspaper picture, keeping the draped ceiling, the lit backdrop and
# the long tables.
CROP = (0, 140, 1500)
BOX = (4.44, 2.22)


def halftone(source, path, x, y, w, box_w, box_h, lpi=LPI, seed=6):
    h = round(w * box_h / box_w)
    size = (round(box_w * DPI), round(box_h * DPI))
    im = Image.open(source).convert("L").crop((x, y, x + w, y + h))
    im = im.resize(size, Image.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=(1, 1))
    im = im.filter(ImageFilter.UnsharpMask(radius=DPI // 100, percent=80, threshold=2))

    # Lift the tones to allow for dot gain, and keep highlights and shadows
    # from losing their dots, as a real plate would.
    tone = (np.asarray(im, dtype=np.float32) / 255) ** 0.78
    dark = 0.05 + (1 - tone) * 0.9

    # Spot function: a grid of round dots, rotated to the screen angle.
    yy, xx = np.indices(dark.shape, dtype=np.float32)
    a = np.radians(ANGLE)
    f = 2 * np.pi * lpi / DPI
    u = (xx * np.cos(a) + yy * np.sin(a)) * f
    v = (-xx * np.sin(a) + yy * np.cos(a)) * f
    spot = (np.cos(u) + np.cos(v)) / 4 + 0.5

    # Rank-map the spot so its values are uniform and tone stays linear.
    ranks = np.sort(spot[::7, ::7].ravel())
    thresh = np.interp(spot, ranks, np.linspace(0, 1, ranks.size))

    # A little jitter makes dot edges slightly rough, like ink on newsprint.
    noise = np.random.default_rng(seed).normal(0, 0.012, dark.shape)
    ink = dark > thresh + noise

    out = Image.fromarray((~ink).astype(np.uint8), "P")
    out.putpalette([*INK, *PAPER])
    # Paper is transparent so the page's paper texture shows through the photo.
    out.save(path, optimize=True, bits=1, dpi=(DPI, DPI), transparency=1)


halftone(HERE / "sources" / "urban-field-house.jpg", ROOT / "assets" / "halftone-venue.png", *CROP, *BOX)
