/**
 * Generates the botanical artwork for the e-vite.
 *
 * Email clients don't support SVG, so the leaves have to ship as raster PNGs.
 * Rather than pull in a dependency, this draws them from scratch: leaf shapes
 * are defined as parametric half-width curves, sampled with 3x supersampling
 * for antialiasing, then written out through a minimal PNG encoder built on
 * node's built-in zlib.
 *
 * Colours are baked onto the destination background (no alpha channel), which
 * sidesteps PNG-transparency rendering quirks in older Outlook.
 *
 * Usage: node tools/make-botanicals.js
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ─────────────────────────── PNG encoding ─────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let i = 0; i < stride; i++) {
      raw[y * (stride + 1) + 1 + i] = rgb[y * stride + i];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ─────────────────────────── canvas ─────────────────────────── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function makeCanvas(w, h, bgHex) {
  const bg = hexToRgb(bgHex);
  const buf = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = bg[0];
    buf[i * 3 + 1] = bg[1];
    buf[i * 3 + 2] = bg[2];
  }
  return { w, h, buf };
}

function canvasToBytes(c) {
  const out = Buffer.alloc(c.w * c.h * 3);
  for (let i = 0; i < c.buf.length; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(c.buf[i])));
  }
  return out;
}

/* ─────────────────────────── leaf shapes ─────────────────────────── */
// All shapes live in local coords: base at (0,0), tip at (0,L), width ±W.

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Characteristic monstera: broad blade widest just below the middle, a cleft
// at the base where the two lobes meet, deep fenestration slots cut in from
// each edge, and a few oval holes hugging the midrib.
function monsteraHalfWidth(t, W) {
  if (t <= 0 || t >= 1) return 0;
  // widest just below mid-leaf, easing to a soft point at the tip
  const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.88)), 0.62);
  const tip = Math.min(1, (1 - t) / 0.1);
  return W * body * Math.pow(tip, 0.4);
}

const MONSTERA_NOTCHES = [0.26, 0.38, 0.5, 0.61, 0.72, 0.82, 0.9];

// Slots stop short of the centre so a solid midrib always survives.
const MIDRIB = 0.3;

function insideMonstera(x, y, L, W) {
  const t = y / L;
  if (t < 0 || t > 1) return false;
  if (Math.abs(x) > monsteraHalfWidth(t, W)) return false;

  // shallow cleft where the two basal lobes meet
  if (t < 0.13) {
    const cleft = W * 0.17 * Math.pow(1 - t / 0.13, 0.6);
    if (Math.abs(x) < cleft) return false;
  }

  // fenestration slots, offset between the two sides so they interleave
  for (const side of [-1, 1]) {
    const shift = side < 0 ? 0.06 : 0;
    for (const base of MONSTERA_NOTCHES) {
      const ti = base + shift;
      if (ti >= 0.96) continue;
      const ax = side * monsteraHalfWidth(ti, W) * 1.2, ay = ti * L;
      // angle gently back toward the base as it runs inward
      const bx = side * W * MIDRIB, by = (ti - 0.035) * L;
      if (distToSegment(x, y, ax, ay, bx, by) < W * 0.042) return false;
    }
  }

  // one small hole per side, set between midrib and the slot ends
  for (const side of [-1, 1]) {
    const ti = side < 0 ? 0.44 : 0.56;
    const hx = side * W * 0.17, hy = ti * L;
    const dx = (x - hx) / (W * 0.045), dy = (y - hy) / (L * 0.022);
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// Simple pointed oval — used for eucalyptus-ish sprigs and filler foliage.
function insideOval(x, y, L, W) {
  const t = y / L;
  if (t < 0 || t > 1) return false;
  const hw = W * Math.pow(Math.sin(Math.PI * t), 0.55);
  return Math.abs(x) <= hw;
}

const SHAPES = { monstera: insideMonstera, oval: insideOval };

/* ─────────────────────────── rasteriser ─────────────────────────── */

const SS = 3; // supersampling factor per axis

function drawLeaf(canvas, leaf, offX = 0, offY = 0) {
  const { type, cx, cy, L, W, ang, color, alpha } = leaf;
  const inside = SHAPES[type];
  const [cr, cg, cb] = hexToRgb(color);
  const cos = Math.cos(ang), sin = Math.sin(ang);

  const reach = Math.hypot(L, W) + 2;
  const x0 = Math.max(0, Math.floor(cx + offX - reach));
  const x1 = Math.min(canvas.w - 1, Math.ceil(cx + offX + reach));
  const y0 = Math.max(0, Math.floor(cy + offY - reach));
  const y1 = Math.min(canvas.h - 1, Math.ceil(cy + offY + reach));
  if (x1 < x0 || y1 < y0) return;

  const step = 1 / SS, sub = 1 / (SS * SS);

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const wx = px + (sx + 0.5) * step - (cx + offX);
          const wy = py + (sy + 0.5) * step - (cy + offY);
          // inverse-rotate into leaf-local space
          const lx = wx * cos + wy * sin;
          const ly = -wx * sin + wy * cos;
          if (inside(lx, ly, L, W)) cov += sub;
        }
      }
      if (cov <= 0) continue;
      const a = cov * alpha;
      const i = (py * canvas.w + px) * 3;
      canvas.buf[i] = canvas.buf[i] * (1 - a) + cr * a;
      canvas.buf[i + 1] = canvas.buf[i + 1] * (1 - a) + cg * a;
      canvas.buf[i + 2] = canvas.buf[i + 2] * (1 - a) + cb * a;
    }
  }
}

/* ─────────────────────────── palette ─────────────────────────── */

const CARD_BG = '#FCFAF6';
const PAGE_BG = '#EDE9E0';
const SAGE_MID = '#A8B7A2';
const SAGE_LIGHT = '#C3CFBC';
const SAGE_DEEP = '#8A9A87';
const BLUSH = '#D6BBB4';

// Deterministic PRNG so re-running produces identical art.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const DEG = Math.PI / 180;

/* ── stems ── */

// Quadratic bezier sampled to a polyline, stroked with a tapering width.
function drawStem(canvas, { x0, y0, cx, cy, x1, y1, width, color, alpha }) {
  const N = 48;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    pts.push([
      u * u * x0 + 2 * u * t * cx + t * t * x1,
      u * u * y0 + 2 * u * t * cy + t * t * y1,
    ]);
  }
  const [r, g, b] = hexToRgb(color);
  const pad = width + 2;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const bx1 = Math.min(canvas.w - 1, Math.ceil(Math.max(...xs) + pad));
  const by0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const by1 = Math.min(canvas.h - 1, Math.ceil(Math.max(...ys) + pad));

  const step = 1 / SS, sub = 1 / (SS * SS);
  for (let py = by0; py <= by1; py++) {
    for (let px = bx0; px <= bx1; px++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const wx = px + (sx + 0.5) * step, wy = py + (sy + 0.5) * step;
          for (let i = 0; i < pts.length - 1; i++) {
            // taper from full width at the base to a thread at the tip
            const w = width * (1 - 0.75 * (i / pts.length));
            const d = distToSegment(wx, wy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
            if (d < w / 2) { cov += sub; break; }
          }
        }
      }
      if (cov <= 0) continue;
      const a = cov * alpha;
      const i = (py * canvas.w + px) * 3;
      canvas.buf[i] = canvas.buf[i] * (1 - a) + r * a;
      canvas.buf[i + 1] = canvas.buf[i + 1] * (1 - a) + g * a;
      canvas.buf[i + 2] = canvas.buf[i + 2] * (1 - a) + b * a;
    }
  }
  return pts;
}

/* ── corner cluster: monstera hanging from the edge, sprigs reaching inward ── */
// `dir` is +1 for the left corner, -1 for the mirrored right corner.
// Angle 0 points straight down; positive angles lean toward -x.

function cornerCluster(canvas, rand, originX, dir, h) {
  // sprigs first, so the big leaves overlap them
  for (let s = 0; s < 2; s++) {
    const sx = originX + dir * (70 + s * 130);
    const sy = -6;
    const reach = h * (0.72 + rand() * 0.2);
    const sway = dir * (60 + rand() * 50);
    const stem = drawStem(canvas, {
      x0: sx, y0: sy,
      cx: sx + sway * 0.4, cy: sy + reach * 0.55,
      x1: sx + sway, y1: sy + reach,
      width: 3.2, color: SAGE_DEEP, alpha: 0.5,
    });

    const count = 9;
    for (let i = 1; i <= count; i++) {
      const idx = Math.floor((i / (count + 1)) * (stem.length - 2));
      const [px, py] = stem[idx];
      const [nx, ny] = stem[idx + 1];
      const tangent = Math.atan2(nx - px, ny - py); // 0 = down
      const scale = 1 - (i / count) * 0.45;
      for (const side of [-1, 1]) {
        canvasLeaf(canvas, {
          type: 'oval', cx: px, cy: py,
          L: h * 0.15 * scale, W: h * 0.038 * scale,
          ang: tangent + side * (52 + rand() * 18) * DEG,
          color: side > 0 ? SAGE_MID : SAGE_LIGHT,
          alpha: 0.7 + rand() * 0.2,
        });
      }
    }
  }

  // three monstera leaves, largest at the outer edge
  const monsteras = [
    { x: 12, L: 0.95, W: 0.30, a: -26, c: SAGE_MID, al: 0.9 },
    { x: 104, L: 0.76, W: 0.25, a: 12, c: SAGE_LIGHT, al: 0.95 },
    { x: 186, L: 0.58, W: 0.19, a: -48, c: SAGE_DEEP, al: 0.5 },
  ];
  for (const m of monsteras) {
    canvasLeaf(canvas, {
      type: 'monstera',
      cx: originX + dir * m.x, cy: -h * 0.12,
      L: h * m.L, W: h * m.W,
      ang: dir * m.a * DEG,
      color: m.c, alpha: m.al,
    });
  }

  // a few blush buds for warmth
  for (let i = 0; i < 4; i++) {
    canvasLeaf(canvas, {
      type: 'oval',
      cx: originX + dir * (55 + rand() * 210),
      cy: h * (0.12 + rand() * 0.5),
      L: h * 0.075, W: h * 0.032,
      ang: rand() * Math.PI,
      color: BLUSH, alpha: 0.45 + rand() * 0.25,
    });
  }
}

function canvasLeaf(canvas, leaf) { drawLeaf(canvas, leaf); }

function flipVertical(canvas) {
  const { w, h, buf } = canvas;
  const out = new Float32Array(buf.length);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 3;
    out.set(buf.subarray(src, src + w * 3), y * w * 3);
  }
  return { w, h, buf: out };
}

function buildSpray(file, w, h, seed, flip) {
  let canvas = makeCanvas(w, h, CARD_BG);
  const rand = lcg(seed);
  cornerCluster(canvas, rand, 0, 1, h);
  cornerCluster(canvas, rand, w, -1, h);
  // The bottom band is the same drawing mirrored, so leaves reach upward.
  if (flip) canvas = flipVertical(canvas);
  fs.writeFileSync(file, encodePNG(w, h, canvasToBytes(canvas)));
  return canvas;
}

/* ── seamless background tile: sparse, very faint foliage ── */
function buildTile(file, size) {
  const canvas = makeCanvas(size, size, PAGE_BG);
  const rand = lcg(915231);
  const leaves = [];
  // Jittered grid rather than pure random, so the tile reads evenly and
  // doesn't leave an obvious empty patch that repeats across the page.
  const CELLS = 3;
  for (let gy = 0; gy < CELLS; gy++) {
    for (let gx = 0; gx < CELLS; gx++) {
      const monstera = (gx + gy) % 2 === 0;
      leaves.push({
        type: monstera ? 'monstera' : 'oval',
        cx: ((gx + 0.5 + (rand() - 0.5) * 0.7) / CELLS) * size,
        cy: ((gy + 0.5 + (rand() - 0.5) * 0.7) / CELLS) * size,
        L: size * (monstera ? 0.17 + rand() * 0.06 : 0.19 + rand() * 0.05),
        W: size * (monstera ? 0.055 + rand() * 0.02 : 0.026 + rand() * 0.01),
        ang: rand() * Math.PI * 2,
        color: SAGE_DEEP,
        alpha: 0.07 + rand() * 0.035,
      });
    }
  }
  // draw each leaf in a 3x3 grid of offsets so the tile wraps seamlessly
  for (const leaf of leaves) {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) drawLeaf(canvas, leaf, dx, dy);
    }
  }
  fs.writeFileSync(file, encodePNG(size, size, canvasToBytes(canvas)));
}

/* ─────────────────────────── run ─────────────────────────── */

const assets = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assets)) fs.mkdirSync(assets, { recursive: true });

const targets = [
  ['leaf-band-top.png', () => buildSpray(path.join(assets, 'leaf-band-top.png'), 1160, 230, 20260606, false)],
  ['leaf-band-bottom.png', () => buildSpray(path.join(assets, 'leaf-band-bottom.png'), 1160, 200, 20270521, true)],
  ['bg-tile.png', () => buildTile(path.join(assets, 'bg-tile.png'), 460)],
];

for (const [name, fn] of targets) {
  fn();
  const kb = (fs.statSync(path.join(assets, name)).size / 1024).toFixed(1);
  console.log(`${name.padEnd(22)} ${kb} KB`);
}
