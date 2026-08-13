/* ══════════════════════════════════════════════════════════════
   Envelope reveal.

   Progressive enhancement: the markup renders the full invitation on
   its own. This script opts the page into the envelope by adding
   `.js-envelope` to <html>, so any failure here leaves guests with a
   perfectly readable page rather than a blank one.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var overlay = document.getElementById('envelope');
  var button  = document.getElementById('envelope-open');
  var main    = document.getElementById('main');
  if (!overlay || !button || !main) return;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Guests who've already opened it this session shouldn't sit through it
  // again on every navigation back to the page.
  var seen;
  try { seen = window.sessionStorage.getItem('envelope-opened') === '1'; }
  catch (e) { seen = false; }

  if (reduced || seen) {
    overlay.setAttribute('data-state', 'open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.remove();
    return;
  }

  document.documentElement.classList.add('js-envelope');

  var opened = false;

  function open() {
    if (opened) return;
    opened = true;

    try { window.sessionStorage.setItem('envelope-opened', '1'); } catch (e) {}

    overlay.setAttribute('data-state', 'opening');

    // let the flap and card finish, then fade the overlay out
    window.setTimeout(function () {
      overlay.setAttribute('data-state', 'open');
      overlay.setAttribute('aria-hidden', 'true');

      // Remove it entirely so it can never trap keyboard focus,
      // then hand focus to the content that just appeared.
      window.setTimeout(function () {
        if (overlay.parentNode) overlay.remove();
        main.focus({ preventScroll: true });
      }, 750);
    }, 950);
  }

  button.addEventListener('click', open);

  // Space/Enter already fire click on a <button>; this catches the case
  // where someone starts scrolling instead of clicking.
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') open();
  });
})();
