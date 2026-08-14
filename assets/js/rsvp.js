/* ══════════════════════════════════════════════════════════════
   RSVP flow.

   Three steps, one page: look a household up by name, show its
   guests so each can be marked attending or not, submit once.
   The API (worker/) is the only thing that can tell whether a
   household has already replied — this script just renders what
   it says.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ✏️ EDIT after deploying the worker, if you used a different
  // custom domain than the one in worker/wrangler.toml.
  var API_BASE = 'https://rsvp-api.michelleyap.lukasscarfe.com';

  var stepLookup = document.getElementById('step-lookup');
  var stepReply  = document.getElementById('step-reply');
  var stepDone   = document.getElementById('step-done');

  var lookupForm   = document.getElementById('lookup-form');
  var lookupStatus = document.getElementById('lookup-status');
  var lookupSubmit = document.getElementById('lookup-submit');

  var replyForm    = document.getElementById('reply-form');
  var replyIntro   = document.getElementById('reply-intro');
  var replyGuests  = document.getElementById('reply-guests');
  var replyStatus  = document.getElementById('reply-status');
  var replySubmit  = document.getElementById('reply-submit');

  var doneMessage  = document.getElementById('done-message');

  var invite = null; // { id, guests: [name, ...] }

  loadTurnstileIfConfigured();

  lookupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var firstName = document.getElementById('first-name').value;
    var lastName  = document.getElementById('last-name').value;

    setStatus(lookupStatus, '');
    setBusy(lookupSubmit, true, 'Searching…');

    apiPost('/lookup', {
      firstName: firstName,
      lastName: lastName,
      turnstileToken: readTurnstileToken(),
    }).then(function (data) {
      setBusy(lookupSubmit, false, 'Find My Invitation');

      if (!data.found) {
        setStatus(lookupStatus, data.message || "We couldn't find that invitation.", true);
        return;
      }
      invite = { id: data.id, guests: data.guests };

      if (data.alreadyResponded) {
        showDone("This invitation has already replied. If you need to change your response, reach out to Lukas or Michelle directly.");
        return;
      }

      showReplyForm();
    }).catch(function (err) {
      setBusy(lookupSubmit, false, 'Find My Invitation');
      setStatus(lookupStatus, err.message, true);
    });
  });

  replyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!invite) return;

    var guests = invite.guests.map(function (name, i) {
      var attendingInput = replyForm.querySelector('input[name="attending-' + i + '"]:checked');
      var dietaryInput = document.getElementById('dietary-' + i);
      return {
        attending: !!attendingInput && attendingInput.value === 'yes',
        dietary: dietaryInput ? dietaryInput.value : '',
      };
    });

    setStatus(replyStatus, '');
    setBusy(replySubmit, true, 'Sending…');

    apiPost('/rsvp', {
      id: invite.id,
      guests: guests,
      message: document.getElementById('message').value,
      turnstileToken: readTurnstileToken(),
    }).then(function () {
      showDone('Your RSVP has been received. We can’t wait to celebrate with you.');
    }).catch(function (err) {
      setBusy(replySubmit, false, 'Send RSVP');
      setStatus(replyStatus, err.message, true);
    });
  });

  function showReplyForm() {
    replyIntro.textContent = invite.guests.length === 1
      ? "We're delighted to invite " + invite.guests[0] + '.'
      : "We're delighted to invite " + invite.guests.join(', ') + '.';

    replyGuests.innerHTML = '';
    invite.guests.forEach(function (name, i) {
      var wrap = document.createElement('fieldset');
      wrap.className = 'field rsvp-guest';

      var legend = document.createElement('legend');
      legend.textContent = name;
      wrap.appendChild(legend);

      var choices = document.createElement('div');
      choices.className = 'rsvp-choices';
      choices.innerHTML =
        '<label class="rsvp-choice">' +
          '<input type="radio" name="attending-' + i + '" value="yes" required /> Joyfully accepts' +
        '</label>' +
        '<label class="rsvp-choice">' +
          '<input type="radio" name="attending-' + i + '" value="no" /> Regretfully declines' +
        '</label>';
      wrap.appendChild(choices);

      var dietaryLabel = document.createElement('label');
      dietaryLabel.setAttribute('for', 'dietary-' + i);
      dietaryLabel.className = 'rsvp-dietary-label';
      dietaryLabel.textContent = 'Dietary requirements (optional)';
      wrap.appendChild(dietaryLabel);

      var dietaryInput = document.createElement('input');
      dietaryInput.type = 'text';
      dietaryInput.id = 'dietary-' + i;
      dietaryInput.maxLength = 80;
      wrap.appendChild(dietaryInput);

      replyGuests.appendChild(wrap);
    });

    stepLookup.hidden = true;
    stepReply.hidden = false;
    stepReply.focus && stepReply.focus();
  }

  function showDone(message) {
    doneMessage.textContent = message;
    stepLookup.hidden = true;
    stepReply.hidden = true;
    stepDone.hidden = false;
  }

  /* ─────────────── helpers ─────────────── */

  function apiPost(path, payload) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Something went wrong.');
        return data;
      });
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('Could not reach the RSVP service. Please check your connection and try again.');
      throw err;
    });
  }

  function setStatus(el, message, isError) {
    el.textContent = message || '';
    el.classList.toggle('rsvp-status--error', !!isError);
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.textContent = label;
  }

  function loadTurnstileIfConfigured() {
    var widgets = document.querySelectorAll('.cf-turnstile');
    var configured = false;
    widgets.forEach(function (w) {
      if (w.getAttribute('data-sitekey') !== 'YOUR_TURNSTILE_SITE_KEY') configured = true;
      else w.remove(); // no site key set — don't render a broken widget
    });
    if (!configured) return;

    var script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  function readTurnstileToken() {
    if (typeof window.turnstile === 'undefined') return undefined;
    try { return window.turnstile.getResponse(); } catch (e) { return undefined; }
  }
})();
