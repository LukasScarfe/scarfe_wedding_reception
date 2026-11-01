/* ══════════════════════════════════════════════════════════════
   Page turns.

   The six pages are read in order, A1 to A6, and each one is a whole
   sheet hinged at the left edge of the screen. Going forward, the page
   turns over to reveal the next one. Going back, the earlier page turns
   back down on top. A jump across several pages riffles through each one
   in between, speeding up as it goes.

   Progressive enhancement: every link is a normal link. If scripts
   fail, a fetch fails, or the guest prefers reduced motion, the browser
   simply loads the page as usual.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ORDER = ['index.html', 'schedule.html', 'venue.html', 'hotel.html', 'rsvp.html', 'faq.html'];
  var STRIPS = 8;           // more strips bend more smoothly, but cost more
  var TURN_MS = 950;        // a single page
  var OVERLAP = 4;
  var BEND_DEG = 50;        // curl at mid-turn; above ~55 the edge dips through the page beneath

  // A riffle starts here and speeds up on every page after it.
  var RIFFLE_START_MS = 500;
  var RIFFLE_SPEEDUP = .58;
  var RIFFLE_FASTEST_MS = 130;
  var RIFFLE_LANDING_MS = 240;   // the last page settles rather than slams

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !window.fetch || !window.history.pushState) return;

  var turning = false;
  var cache = {};

  function pageOf(url) {
    var name = new URL(url, location.href).pathname.split('/').pop() || 'index.html';
    return ORDER.indexOf(name) === -1 ? null : name;
  }

  function load(name) {
    if (!cache[name]) {
      cache[name] = fetch(name).then(function (res) {
        if (!res.ok) throw new Error('Could not load ' + name);
        return res.text();
      }).then(function (html) {
        return new DOMParser().parseFromString(html, 'text/html');
      });
      cache[name].catch(function () { delete cache[name]; });
    }
    return cache[name];
  }

  var EASE = {
    both: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    start: function (t) { return t * t; },
    steady: function (t) { return t; },
    land: function (t) { return 1 - (1 - t) * (1 - t); }
  };

  /* How long each page of a turn takes, and how it moves. Pages in the
     middle of a riffle run at a steady speed so it never pauses. */
  function timing(count) {
    if (count === 1) return [{ ms: TURN_MS, ease: EASE.both }];

    var turns = [];
    for (var i = 0; i < count; i++) {
      var last = i === count - 1;
      var ms = RIFFLE_START_MS * Math.pow(RIFFLE_SPEEDUP, i);
      turns.push({
        ms: last ? Math.max(ms, RIFFLE_LANDING_MS) : Math.max(ms, RIFFLE_FASTEST_MS),
        ease: last ? EASE.land : i === 0 ? EASE.start : EASE.steady
      });
    }
    return turns;
  }

  /* A window onto part of a page. Copies carry no ids, so they can't
     collide with the live page, and the stage is inert, so they take no
     tab stops. */
  function piece(sheet, x, width, height, scrollY, className) {
    var box = document.createElement('div');
    box.className = className;
    box.style.width = width + 'px';

    var page = document.createElement('div');
    page.className = 'leaf-page';
    page.style.left = -x + 'px';
    page.style.width = document.documentElement.clientWidth + 'px';
    page.style.height = height + 'px';

    var copy = sheet.cloneNode(true);
    copy.style.marginTop = -scrollY + 'px';
    copy.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    page.appendChild(copy);
    box.appendChild(page);
    return box;
  }

  function shadeOn(face) {
    var shade = document.createElement('div');
    shade.className = 'turn-shade';
    face.appendChild(shade);
    return shade;
  }

  /* The leaf is one whole page, built as a chain of strips hinged to one
     another and to the left edge of the screen. `under` lies beneath it. */
  function buildStage(leaf, leafScroll, under, underScroll) {
    var width = document.documentElement.clientWidth;
    var height = window.innerHeight;
    var stripWidth = Math.ceil(width / STRIPS);

    var stage = document.createElement('div');
    stage.className = 'turn-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.inert = true;
    stage.style.perspective = Math.max(2000, width * 2.4) + 'px';

    var below = piece(under, 0, width, height, underScroll, 'turn-under');
    var cast = document.createElement('div');
    cast.className = 'turn-cast';
    below.appendChild(cast);
    stage.appendChild(below);

    var strips = [];
    var parent = stage;

    for (var i = 0; i < STRIPS; i++) {
      var strip = document.createElement('div');
      strip.className = 'turn-strip';
      strip.style.width = stripWidth + 'px';
      strip.style.left = (i === 0 ? 0 : stripWidth) + 'px';

      // A few pixels of overlap hide hairline gaps between neighbouring strips
      var front = piece(leaf, i * stripWidth, stripWidth + OVERLAP, height, leafScroll, 'turn-face');
      var back = document.createElement('div');
      back.className = 'turn-face turn-face--back';
      back.style.width = (stripWidth + OVERLAP) + 'px';

      strip.appendChild(front);
      strip.appendChild(back);
      parent.appendChild(strip);
      strips.push({ el: strip, shades: [shadeOn(front), shadeOn(back)] });
      parent = strip;
    }

    document.body.appendChild(stage);
    return { el: stage, strips: strips, cast: cast };
  }

  function render(stage, progress) {
    var lift = Math.sin(Math.PI * progress);

    function darkness(i) { return lift * (.05 + .3 * i / STRIPS); }

    stage.strips.forEach(function (strip, i) {
      strip.el.style.transform = i === 0
        ? 'translateZ(1px) rotateY(' + (-180 * progress) + 'deg)'
        : 'rotateY(' + (BEND_DEG * lift) / (STRIPS - 1) + 'deg)';   // the free edge lags

      // Blend into the next strip so the shading never shows as bands.
      var near = 'rgba(0,0,0,' + darkness(i) + ')';
      var far = 'rgba(0,0,0,' + darkness(i + 1) + ')';
      strip.shades[0].style.background = 'linear-gradient(90deg,' + near + ',' + far + ')';
      strip.shades[1].style.background = 'linear-gradient(90deg,' + far + ',' + near + ')';
    });

    stage.cast.style.opacity = lift;
  }

  function animate(stage, ms, from, to, ease) {
    return new Promise(function (done) {
      var start = null;
      function frame(now) {
        if (start === null) start = now;
        var t = Math.min((now - start) / ms, 1);
        render(stage, from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(frame);
        else done();
      }
      render(stage, from);
      requestAnimationFrame(frame);
    });
  }

  /* Swap the live page. rsvp.js binds to the form's elements, so it has
     to run again each time the form is put back on the page. */
  function show(doc) {
    var sheet = document.querySelector('.sheet');
    sheet.replaceWith(document.importNode(doc.querySelector('.sheet'), true));
    document.title = doc.title;
    window.scrollTo(0, 0);
  }

  function startScripts(doc) {
    var tag = doc.querySelector('script[src$="rsvp.js"]');
    if (!tag) return;
    var script = document.createElement('script');
    script.src = tag.getAttribute('src');
    document.body.appendChild(script);
  }

  /* The stage covers the screen, so the live page can change underneath
     it straight away in either direction. */
  function turn(doc, how, forward) {
    var current = document.querySelector('.sheet');
    var next = doc.querySelector('.sheet');
    var scrollY = window.scrollY;

    var stage = forward
      ? buildStage(current, scrollY, next, 0)
      : buildStage(next, 0, current, scrollY);

    render(stage, forward ? 0 : 1);
    show(doc);

    return animate(stage, how.ms, forward ? 0 : 1, forward ? 1 : 0, how.ease).then(function () {
      stage.el.remove();
    });
  }

  function turnTo(name, push) {
    var from = pageOf(location.href);
    var to = ORDER.indexOf(name);
    var here = ORDER.indexOf(from);
    var step = to > here ? 1 : -1;
    var count = Math.abs(to - here);
    var turns = timing(count);

    var route = [];
    for (var i = 1; i <= count; i++) route.push(ORDER[here + step * i]);

    turning = true;
    return Promise.all(route.map(load)).then(function (docs) {
      if (push) history.pushState(null, '', name);
      return docs.reduce(function (previous, doc, i) {
        return previous.then(function () {
          return turn(doc, turns[i], step > 0);
        });
      }, Promise.resolve()).then(function () {
        var last = docs[docs.length - 1];
        turning = false;
        startScripts(last);
        var main = document.getElementById('main');
        if (main) main.focus({ preventScroll: true });
      });
    }).catch(function () {
      location.href = name;      // fall back to an ordinary page load
    });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var link = e.target.closest && e.target.closest('a[href]');
    if (!link || link.target || link.origin !== location.origin || link.hash) return;

    var name = pageOf(link.href);
    if (!name) return;

    e.preventDefault();
    if (!turning && name !== pageOf(location.href)) turnTo(name, true);
  });

  window.addEventListener('popstate', function () {
    var name = pageOf(location.href);
    if (!name) return;
    if (turning) { location.reload(); return; }

    // The URL has already moved, so work out where the page on screen is.
    var current = document.querySelector('.nav a[aria-current="page"]');
    var showing = current && pageOf(current.href);
    if (!showing) { location.reload(); return; }
    if (showing === name) return;

    history.replaceState(null, '', showing);
    turnTo(name, false).then(function () { history.replaceState(null, '', name); });
  });

  /* Have every page and the lead photograph ready before the first turn. */
  function prepare() {
    ORDER.forEach(load);
    new Image().src = 'assets/halftone-wide.png';
  }
  if (window.requestIdleCallback) window.requestIdleCallback(prepare);
  else window.setTimeout(prepare, 300);
})();
