#!/usr/bin/env python3
"""Stamp the website's stylesheet and script links with a content hash.

GitHub Pages lets browsers cache files for ten minutes, and a browser can
pair a fresh page with a stale script. Each link gets ?v=<hash of the
file>, so a changed file always has a new URL. Run after editing anything
in assets/css or assets/js; it is safe to run any time.
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ["assets/css/site.css", "assets/js/site.js", "assets/js/rsvp.js", "assets/js/puzzle.js"]

stamps = {a: hashlib.sha256((ROOT / a).read_bytes()).hexdigest()[:10] for a in ASSETS}

for page in sorted(ROOT.glob("*.html")):
    if page.name == "save-the-date.html":
        continue
    text = page.read_text()
    new = text
    for asset, stamp in stamps.items():
        new = re.sub(r'"%s(\?v=[0-9a-f]*)?"' % re.escape(asset), '"%s?v=%s"' % (asset, stamp), new)
    if new != text:
        page.write_text(new)
        print("stamped", page.name)
