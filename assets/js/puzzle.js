/* ══════════════════════════════════════════════════════════════
   The Daily Puzzle: the Heart board of The Whole Year Puzzle, by
   Michelle Yap (https://yearpuzzle.michelleyap.ca/), set for today.

   The board, pieces and play are ported from the original's Play view;
   only the inks change, to the Gazette's black on newsprint. Pieces are
   solid ink, the two open date cells are inverted (ink, with the
   date in paper), and the piece in hand is outlined. Solutions live on the original site, so a solved or
   stuck reader is sent there.

   site.js runs this again each time the page is turned to, so all the
   state lives in one instance, and the few document-wide listeners are
   added once and talk to whichever instance is current.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.getElementById('puzzle');
  if (!root) return;

  var SITE = 'https://yearpuzzle.michelleyap.ca/';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* The Heart, from the original's data.js. Cells are [row, col]; the
     labels run Jan to Dec, then 1 to 31, in cell order. */
  var HEART = {
    width: 9, height: 7,
    cells: [[0,1],[0,2],[0,3],[1,1],[1,2],[1,3],[0,5],[0,6],[0,7],[1,5],[1,6],[1,7],
            [2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],
            [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],
            [4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7],[5,3],[5,4],[5,5],[6,3],[6,4],[6,5]],
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
             '1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16',
             '17','18','19','20','21','22','23','24','25','26','27','28','29','30','31'],
    pieces: [
      { name: 'F', shape: [[0,1],[0,2],[1,0],[1,1],[2,1]] },
      { name: 'N', shape: [[0,0],[0,1],[0,2],[1,2],[1,3]] },
      { name: 'P', shape: [[0,0],[0,1],[0,2],[1,0],[1,1]] },
      { name: 'Y', shape: [[0,1],[1,0],[1,1],[2,1],[3,1]] },
      { name: 'Z', shape: [[0,0],[0,1],[1,1],[2,1],[2,2]] },
      { name: 'l', shape: [[0,0],[0,1],[0,2],[1,0]] },
      { name: 'o', shape: [[0,0],[0,1],[1,0],[1,1]] },
      { name: 's', shape: [[0,0],[0,1],[1,1],[1,2]] },
      { name: 't', shape: [[0,0],[0,1],[0,2],[1,1]] }
    ],
    // How many ways each date can be solved, [month - 1][day - 1].
    counts: [
      [414,107,73,120,202,144,279,109,492,411,62,121,152,149,107,56,82,504,324,178,48,254,39,184,320,162,195,184,299,127,281],
      [147,10,190,39,173,44,174,46,221,178,38,61,55,109,96,98,48,292,238,238,16,200,71,113,260,89,116,91,205,70,237],
      [453,128,139,115,164,155,249,130,440,490,52,103,163,116,114,66,79,474,245,198,48,227,33,180,339,163,221,177,344,159,354],
      [168,70,33,19,86,60,93,42,110,143,12,50,124,46,96,38,34,202,169,86,27,119,17,64,141,57,64,53,179,54,149],
      [101,13,92,19,75,53,119,47,229,184,31,78,74,152,38,83,34,170,135,168,37,100,31,97,130,105,29,70,191,86,213],
      [195,25,24,101,103,47,92,58,138,185,36,55,67,71,87,49,46,239,130,116,29,148,24,82,167,54,118,57,190,66,173],
      [440,130,249,155,164,115,139,128,453,474,79,66,114,116,163,103,52,490,339,180,33,227,48,198,245,177,221,163,354,159,344],
      [221,46,174,44,173,39,190,10,147,292,48,98,96,109,55,61,38,178,260,113,71,200,16,238,238,91,116,89,237,70,205],
      [492,109,279,144,202,120,73,107,414,504,82,56,107,149,152,121,62,411,320,184,39,254,48,178,324,184,195,162,281,127,299],
      [138,58,92,47,103,101,24,25,195,239,46,49,87,71,67,55,36,185,167,82,24,148,29,116,130,57,118,54,173,66,190],
      [229,47,119,53,75,19,92,13,101,170,34,83,38,152,74,78,31,184,130,97,31,100,37,168,135,70,29,105,213,86,191],
      [110,42,93,60,86,19,33,70,168,202,34,38,96,46,124,50,12,143,141,64,17,119,27,86,169,53,64,57,149,54,179]
    ]
  };

  var GW = 16;   // a stride wider than the board, for indexing cells by row * GW + col
  var AT = {};
  HEART.cells.forEach(function (rc, i) { AT[rc[0] * GW + rc[1]] = i; });

  var today = new Date();
  var M = today.getMonth() + 1, D = today.getDate();
  var DATES = [M - 1, 11 + D];   // the two cells left open

  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var board = $('puzzle-board'), tray = $('puzzle-tray');

  var ink, paper, paperLow, inkSoft;
  function readInks() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    ink = g('--ink'); paper = g('--paper'); paperLow = g('--paper-low') || paper; inkSoft = g('--ink-soft') || ink;
  }

  /* ─────────────── piece geometry ─────────────── */

  function dims(cells) {
    return [Math.max.apply(null, cells.map(function (q) { return q[0]; })) + 1,
            Math.max.apply(null, cells.map(function (q) { return q[1]; })) + 1];
  }
  var TURN = {
    cw: function (cells) { var H = dims(cells)[0]; return cells.map(function (q) { return [q[1], H - 1 - q[0]]; }); },
    ccw: function (cells) { var W = dims(cells)[1]; return cells.map(function (q) { return [W - 1 - q[1], q[0]]; }); },
    flip: function (cells) { var W = dims(cells)[1]; return cells.map(function (q) { return [q[0], W - 1 - q[1]]; }); },
    flipv: function (cells) { var H = dims(cells)[0]; return cells.map(function (q) { return [H - 1 - q[0], q[1]]; }); }
  };
  function gapOf(cs) { return Math.max(1, Math.round(cs * 0.07)); }

  // Each piece keeps its orientation (cells from 0,0) and its board spot, or null in the tray.
  var P = {
    pieces: HEART.pieces.map(function (p) { return { cells: p.shape.map(function (q) { return q.slice(); }), at: null }; }),
    sel: null, drag: null, cs: 56, tcs: 28, pad: 0, won: false
  };
  function solved() { return P.pieces.every(function (q) { return q.at; }); }

  // The board cells piece p would cover at `at`, or null if any is off the board, a date or taken.
  function fits(p, cells, at) {
    var taken = {};
    P.pieces.forEach(function (q, j) {
      if (j !== p && q.at) q.cells.forEach(function (rc) { taken[AT[(q.at[0] + rc[0]) * GW + q.at[1] + rc[1]]] = true; });
    });
    var out = [];
    for (var k = 0; k < cells.length; k++) {
      var R = at[0] + cells[k][0], C = at[1] + cells[k][1];
      if (R < 0 || C < 0 || R >= HEART.height || C >= HEART.width) return null;
      var i = AT[R * GW + C];
      if (i === undefined || DATES.indexOf(i) !== -1 || taken[i]) return null;
      out.push(i);
    }
    return out;
  }
  function nearestFit(p, cells, base) {
    var best = null, bd = Infinity;
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
      var dd = dr * dr + dc * dc;
      if (dd < bd && fits(p, cells, [base[0] + dr, base[1] + dc])) { best = [base[0] + dr, base[1] + dc]; bd = dd; }
    }
    return best;
  }

  // One path per piece, its own cells joined across the gaps between them.
  function piecePath(cells, cs, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var g = gapOf(cs), has = {};
    cells.forEach(function (rc) { has[rc[0] * 8 + rc[1]] = true; });
    function rect(x, y, w, h) { return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'z'; }
    var d = '';
    cells.forEach(function (rc) {
      var r = rc[0], c = rc[1], x = ox + c * cs, y = oy + r * cs;
      var right = has[r * 8 + c + 1], below = has[(r + 1) * 8 + c];
      d += rect(x + g, y + g, cs - 2 * g, cs - 2 * g);
      if (right) d += rect(x + cs - g, y + g, 2 * g, cs - 2 * g);
      if (below) d += rect(x + g, y + cs - g, cs - 2 * g, 2 * g);
      if (right && below && has[(r + 1) * 8 + c + 1]) d += rect(x + cs - g, y + cs - g, 2 * g, 2 * g);
    });
    return d;
  }

  // Solid ink. The piece in hand gets a thin ink outline standing just off its edge.
  function pieceSvg(p, cs, ox, oy) {
    var d = piecePath(P.pieces[p].cells, cs, ox, oy);
    return '<path data-pp="' + p + '" d="' + d + '" fill="' + ink + '"' +
           (P.sel === p ? ' filter="url(#puzzle-held)"' : '') + '/>';
  }
  // The outline sits inside the gap between neighbouring pieces, so it never covers them.
  function heldDefs(cs) {
    var ring = Math.max(2, Math.min(4, gapOf(cs))), gap = ring / 2;
    return '<defs><filter id="puzzle-held" x="-30%" y="-30%" width="160%" height="160%">' +
           '<feMorphology in="SourceAlpha" operator="dilate" radius="' + ring + '" result="outer"/>' +
           '<feFlood flood-color="' + ink + '"/><feComposite in2="outer" operator="in" result="ring"/>' +
           '<feMorphology in="SourceAlpha" operator="dilate" radius="' + gap + '" result="inner"/>' +
           '<feFlood flood-color="' + paper + '"/><feComposite in2="inner" operator="in" result="gap"/>' +
           '<feMerge><feMergeNode in="ring"/><feMergeNode in="gap"/><feMergeNode in="SourceGraphic"/></feMerge>' +
           '</filter></defs>';
  }

  /* ─────────────── drawing ─────────────── */

  function render() {
    if (P.drag) cancelDrag(false);
    if (solved() && !P.won) P.sel = null;
    var col = root.clientWidth;
    P.cs = Math.max(24, Math.min(56, Math.floor((col - 8) / HEART.width)));
    P.tcs = Math.max(12, Math.min(28, Math.floor((col - 40) / 18)));
    drawBoard(); drawTray(); status();
  }

  function drawBoard() {
    var cs = P.cs, g = gapOf(cs), done = solved();
    var lw = Math.max(1.5, cs * 0.06), pad = P.pad = Math.ceil(lw) + 1;
    var W = HEART.width * cs + 2 * pad, H = HEART.height * cs + 2 * pad;
    board.setAttribute('width', W); board.setAttribute('height', H);
    board.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    function cellAt(r, c) { return (r < 0 || c < 0 || r >= HEART.height || c >= HEART.width) ? undefined : AT[r * GW + c]; }
    var edge = '', cells = '', labels = '', fs = Math.max(9, Math.round(cs * 0.36));
    HEART.cells.forEach(function (rc, i) {
      var r = rc[0], c = rc[1], x = c * cs, y = r * cs;
      if (cellAt(r - 1, c) === undefined) edge += 'M' + x + ' ' + y + 'h' + cs;
      if (cellAt(r + 1, c) === undefined) edge += 'M' + x + ' ' + (y + cs) + 'h' + cs;
      if (cellAt(r, c - 1) === undefined) edge += 'M' + x + ' ' + y + 'v' + cs;
      if (cellAt(r, c + 1) === undefined) edge += 'M' + (x + cs) + ' ' + y + 'v' + cs;
      var isDate = DATES.indexOf(i) !== -1;
      cells += '<rect x="' + (x + g) + '" y="' + (y + g) + '" width="' + (cs - 2 * g) + '" height="' + (cs - 2 * g) +
               '" fill="' + (isDate ? ink : paperLow) + '"/>';
      labels += '<text x="' + (x + cs / 2) + '" y="' + (y + cs / 2 + 0.5) + '" text-anchor="middle" dominant-baseline="central"' +
                ' font-size="' + (isDate ? fs * 1.15 : fs) + '" fill="' + (isDate ? paper : inkSoft) + '"' +
                (isDate ? ' font-weight="700"' : '') + '>' + HEART.labels[i] + '</text>';
    });
    var pieces = P.pieces.map(function (q, p) { return q.at ? pieceSvg(p, cs, q.at[1] * cs, q.at[0] * cs) : ''; }).join('');
    board.innerHTML = heldDefs(cs) +
      '<g transform="translate(' + pad + ',' + pad + ')">' +
      '<path d="' + edge + '" fill="none" stroke="' + ink + '" stroke-width="' + (done ? lw * 1.8 : lw) + '" stroke-linecap="square"/>' +
      cells + labels + pieces + '<g class="puzzle-ghost"></g></g>';
  }

  function drawTray() {
    var tcs = P.tcs;
    tray.hidden = solved();   // nothing left in it
    tray.style.setProperty('--slot', 4 * tcs + 8 + 'px');
    tray.innerHTML = P.pieces.map(function (q, p) {
      if (q.at) return '<div class="slot"></div>';
      var hw = dims(q.cells), H = hw[0], W = hw[1];
      return '<div class="slot"><svg width="' + W * tcs + '" height="' + H * tcs + '" viewBox="0 0 ' + W * tcs + ' ' + H * tcs +
             '" data-pp="' + p + '" role="img" aria-label="Piece ' + HEART.pieces[p].name + '">' +
             (P.sel === p ? heldDefs(P.cs) : '') + pieceSvg(p, tcs, 0, 0) + '</svg></div>';
    }).join('');
    var held = P.sel !== null;
    ['puzzle-ccw', 'puzzle-cw', 'puzzle-flip', 'puzzle-flipv'].forEach(function (id) { $(id).disabled = !held; });
    $('puzzle-clear').disabled = !P.pieces.some(function (q) { return q.at; });
  }

  function status() {
    var el = $('puzzle-status'), placed = P.pieces.filter(function (q) { return q.at; }).length;
    var n = HEART.counts[M - 1][D - 1];
    if (!solved()) {
      P.won = false;
      el.innerHTML = 'Cover every cell except <b>' + HEART.labels[DATES[0]] + '</b> and <b>' + HEART.labels[DATES[1]] +
                     '</b>. ' + placed + ' of ' + P.pieces.length + ' pieces placed.';
      return;
    }
    P.won = true;
    el.innerHTML = '<b>Solved!</b> Compare yours with all ' + n + ' solutions at ' +
                   '<a href="' + SITE + '#solutions/heart/' + M + '-' + D + '" target="_blank" rel="noopener">yearpuzzle.michelleyap.ca</a>.';
  }

  /* ─────────────── moving pieces ─────────────── */

  // Rotate or flip piece p. Mid-drag, the grabbed point stays under the pointer; on the board, the piece
  // turns about its middle and shifts to the nearest spot it fits, or goes back to the tray.
  function turn(p, how) {
    var q = P.pieces[p], hw = dims(q.cells), H = hw[0], W = hw[1];
    var next = TURN[how](q.cells), d = P.drag;
    if (d && d.moved && d.p === p) {
      var g = { cw: [d.gx, H - d.gy], ccw: [W - d.gx, d.gy], flip: [d.gy, W - d.gx], flipv: [H - d.gy, d.gx] }[how];
      d.gy = g[0]; d.gx = g[1];
      q.cells = next; drawFloat(); moveFloat();
      return;
    }
    q.cells = next;
    if (q.at) {
      var hw2 = dims(next);
      q.at = nearestFit(p, next, [Math.round(q.at[0] + (H - hw2[0]) / 2), Math.round(q.at[1] + (W - hw2[1]) / 2)]);
    }
    render();
  }

  function drawFloat() {
    var d = P.drag, q = P.pieces[d.p], hw = dims(q.cells), cs = P.cs;
    d.float.setAttribute('width', hw[1] * cs); d.float.setAttribute('height', hw[0] * cs);
    d.float.setAttribute('viewBox', '0 0 ' + hw[1] * cs + ' ' + hw[0] * cs);
    d.float.innerHTML = '<path d="' + piecePath(q.cells, cs) + '" fill="' + ink + '"/>';
  }
  // Move the floating piece with the pointer and show where it would land.
  function moveFloat() {
    var d = P.drag, q = P.pieces[d.p], cs = P.cs;
    var fx = d.cx - d.gx * cs, fy = d.cy - d.gy * cs;
    d.float.style.transform = 'translate(' + fx + 'px, ' + fy + 'px)';
    var r = board.getBoundingClientRect();
    d.over = d.cx >= r.left && d.cx <= r.right && d.cy >= r.top && d.cy <= r.bottom;
    var at = [Math.round((fy - r.top - P.pad) / cs), Math.round((fx - r.left - P.pad) / cs)];
    d.target = fits(d.p, q.cells, at) ? at : null;
    board.querySelector('.puzzle-ghost').innerHTML = d.target
      ? '<path d="' + piecePath(q.cells, cs, at[1] * cs, at[0] * cs) + '" fill="' + ink + '" opacity=".3"/>' : '';
  }
  function cancelDrag(redraw) {
    var d = P.drag; if (!d) return;
    if (d.float) d.float.remove();
    document.documentElement.classList.remove('puzzle-dragging');
    P.drag = null;
    if (redraw !== false) render();
  }
  function press(e, gy, gx) {
    var t = e.target.closest('[data-pp]');
    P.drag = { p: +t.dataset.pp, el: t, gy: gy, gx: gx, x0: e.clientX, y0: e.clientY,
               cx: e.clientX, cy: e.clientY, id: e.pointerId, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  board.addEventListener('pointerdown', function (e) {
    if (P.drag || e.button > 0) return;
    var t = e.target.closest('[data-pp]');
    if (!t) { if (P.sel !== null) { P.sel = null; render(); } return; }
    var q = P.pieces[+t.dataset.pp], r = board.getBoundingClientRect();
    press(e, (e.clientY - r.top - P.pad) / P.cs - q.at[0], (e.clientX - r.left - P.pad) / P.cs - q.at[1]);
  });
  tray.addEventListener('pointerdown', function (e) {
    if (P.drag || e.button > 0) return;
    var t = e.target.closest('[data-pp]'); if (!t) return;
    var r = t.getBoundingClientRect();
    press(e, (e.clientY - r.top) / P.tcs, (e.clientX - r.left) / P.tcs);
  });
  function onMove(e) {
    var d = P.drag; if (!d || e.pointerId !== d.id) return;
    d.cx = e.clientX; d.cy = e.clientY;
    if (!d.moved) {
      if (Math.hypot(d.cx - d.x0, d.cy - d.y0) < 5) return;
      d.moved = true;
      d.el.style.visibility = 'hidden';
      d.float = document.createElementNS(SVGNS, 'svg');
      d.float.setAttribute('class', 'puzzle-float');
      document.body.append(d.float);
      document.documentElement.classList.add('puzzle-dragging');
      drawFloat();
    }
    moveFloat();
  }
  function onUp(e) {
    var d = P.drag; if (!d || e.pointerId !== d.id) return;
    var q = P.pieces[d.p];
    if (!d.moved) {
      // A tap picks a piece up; tapping it again rotates it.
      P.drag = null;
      if (P.sel === d.p) turn(d.p, 'cw');
      else { P.sel = d.p; render(); }
      return;
    }
    P.sel = d.p;
    // Dropped where it fits: place it. On the board where it doesn't: back where it was, if it still
    // fits there. Off the board: back to the tray.
    if (d.target) q.at = d.target;
    else if (!(d.over && q.at && fits(d.p, q.cells, q.at))) q.at = null;
    cancelDrag();
  }
  [board, tray].forEach(function (el) {
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', function (e) { if (P.drag && e.pointerId === P.drag.id) cancelDrag(); });
  });

  $('puzzle-cw').onclick = function () { if (P.sel !== null) turn(P.sel, 'cw'); };
  $('puzzle-ccw').onclick = function () { if (P.sel !== null) turn(P.sel, 'ccw'); };
  $('puzzle-flip').onclick = function () { if (P.sel !== null) turn(P.sel, 'flip'); };
  $('puzzle-flipv').onclick = function () { if (P.sel !== null) turn(P.sel, 'flipv'); };
  $('puzzle-clear').onclick = function () { P.pieces.forEach(function (q) { q.at = null; }); P.sel = null; render(); };

  // WASD + Space, so one hand stays on the keyboard while the other drags.
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('select, input, textarea')) return;
    if (e.key === 'Escape') { if (P.drag) cancelDrag(); else if (P.sel !== null) { P.sel = null; render(); } return; }
    var p = P.drag && P.drag.moved ? P.drag.p : P.sel;
    if (p === null) return;
    var how = { a: 'ccw', d: 'cw', w: 'flipv', s: 'flip' }[e.key.toLowerCase()];
    if (how) turn(p, how);
    else if (e.key === ' ') { if (!P.drag && P.pieces[p].at) { P.pieces[p].at = null; render(); } }
    else return;
    e.preventDefault();
  }
  var resizeFrame = 0;
  function onResize() {
    if (P.drag) return;
    cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(render);
  }

  /* ─────────────── start ─────────────── */

  $('puzzle-date').textContent = WEEKDAYS[today.getDay()] + ', ' + MONTHS[M - 1] + ' ' + D;
  var n = HEART.counts[M - 1][D - 1];
  $('puzzle-count').textContent = n + (n === 1 ? ' solution' : ' solutions') + ' to find';
  $('puzzle-solutions').href = SITE + '#solutions/heart/' + M + '-' + D;

  window.gazettePuzzle = {
    key: function (e) { if (board.isConnected) onKey(e); },
    resize: function () { if (board.isConnected) onResize(); }
  };
  if (!window.gazettePuzzleBound) {
    window.gazettePuzzleBound = true;
    document.addEventListener('keydown', function (e) { window.gazettePuzzle.key(e); });
    window.addEventListener('resize', function () { window.gazettePuzzle.resize(); });
  }

  readInks();
  render();
  // The fonts may land after the first draw; the labels are measured in them.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (board.isConnected) render(); });
})();
