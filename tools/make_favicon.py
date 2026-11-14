#!/usr/bin/env python3
"""The site icon: the Heart puzzle board as a pixelated heart, set for the wedding.

The heart is the union of the board's cells (puzzle.js): white inside a
thin ink outline, on a transparent background, with the two cells the
puzzle would leave open for the wedding date, Jun and 6, marked as ink
dots. Writes favicon.svg (crisp at any size), favicon.ico (16/32/48, each
drawn on whole pixels), and a 180px apple-touch-icon on newsprint, since
iOS doesn't do transparency.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INK, WHITE, PAPER = "#1b1a17", "#ffffff", "#E8E2D2"

CELLS = [(0,1),(0,2),(0,3),(1,1),(1,2),(1,3),(0,5),(0,6),(0,7),(1,5),(1,6),(1,7),
         (2,0),(2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8),
         (3,0),(3,1),(3,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,8),
         (4,1),(4,2),(4,3),(4,4),(4,5),(4,6),(4,7),(5,3),(5,4),(5,5),(6,3),(6,4),(6,5)]
W, H = 9, 7
LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] + [str(d) for d in range(1, 32)]
DATE = {CELLS[LABELS.index("Jun")], CELLS[LABELS.index("6")]}   # June 6, 2026
CELLSET = set(CELLS)

OUTLINE = 0.25   # cells
DOT = 1.0        # the dot's side, in cells, centred on its cell
MIN_DOT = 2      # pixels: never smaller than this, so the date shows even at 16px


def raster(n, margin):
    """An n x n grid of None (transparent), WHITE or INK, every pixel wholly one or the other."""
    unit = n * (1 - 2 * margin) / W
    x0, y0 = n * margin, (n - H * unit) / 2
    t = max(1, round(OUTLINE * unit))
    half = max(MIN_DOT, DOT * unit) / 2
    centres = [(y0 + (r + .5) * unit, x0 + (c + .5) * unit) for r, c in DATE]

    def cell(y, x):
        fy, fx = (y + .5) - y0, (x + .5) - x0
        if fy < 0 or fx < 0:
            return None, 0, 0
        rc = (int(fy // unit), int(fx // unit))
        return (rc if rc in CELLSET else None), fy % unit, fx % unit

    def inside(y, x):
        return 0 <= y < n and 0 <= x < n and cell(y, x)[0] is not None

    grid = [[None] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            rc, fy, fx = cell(y, x)
            if rc is None:
                continue
            edge = any(not inside(y + dy, x + dx) for dy in range(-t, t + 1) for dx in range(-t, t + 1))
            dot = any(abs((y + .5) - cy) < half and abs((x + .5) - cx) < half for cy, cx in centres)
            grid[y][x] = INK if edge or dot else WHITE
    return grid


def runs(grid, colour):
    """Horizontal runs of one colour, as an SVG path."""
    d = ""
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            if row[x] == colour:
                start = x
                while x < len(row) and row[x] == colour:
                    x += 1
                d += f"M{start} {y}h{x - start}v1h-{x - start}z"
            else:
                x += 1
    return d


# ── SVG on a fine grid, 20 units a cell, half a cell of margin.
U = 20
g = raster(W * U + U, (U / 2) / (W * U + U))
n = len(g)
(ROOT / "favicon.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">\n'
    f'<path fill="{WHITE}" d="{runs(g, WHITE)}"/>\n'
    f'<path fill="{INK}" d="{runs(g, INK)}"/>\n</svg>\n')


# ── PNGs, each size on its own pixel grid.
def rgba(hex_colour):
    return tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def png(n, margin=0.0, background=None):
    im = Image.new("RGBA", (n, n), rgba(background) if background else (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(raster(n, margin)):
        for x, colour in enumerate(row):
            if colour:
                px[x, y] = rgba(colour)
    return im


frames = [png(16), png(32), png(48, .02)]
frames[2].save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[:2])
png(180, .14, background=PAPER).save(ROOT / "assets" / "icons" / "apple-touch-icon.png")
print("wrote favicon.svg, favicon.ico, assets/icons/apple-touch-icon.png")
