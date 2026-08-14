/* ══════════════════════════════════════════════════════════════════
   RSVP API — a thin, stateless proxy in front of a private GitHub repo.

   The repo (env.GITHUB_OWNER/GITHUB_REPO) is the entire datastore:
     guests.json          the invite list, entered ahead of time
     rsvps/<id>.json       one file per household, created on submit

   A household having already replied is simply "does rsvps/<id>.json
   exist" — no database, no KV, nothing else to keep in sync. Only this
   worker holds the token that can read or write that repo; the browser
   never sees it and the repo is never fetched client-side.
   ══════════════════════════════════════════════════════════════════ */

const GITHUB_API = 'https://api.github.com';
const MAX_MESSAGE_LEN = 600;
const MAX_NAME_LEN = 80;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      if (request.method === 'POST' && url.pathname === '/lookup') {
        return await handleLookup(request, env, origin);
      }
      if (request.method === 'POST' && url.pathname === '/rsvp') {
        return await handleRsvp(request, env, origin);
      }
    } catch (err) {
      return json({ error: 'Something went wrong. Please try again.' }, 500, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  },
};

/* ─────────────────────────── /lookup ─────────────────────────── */

async function handleLookup(request, env, origin) {
  const body = await safeJson(request);
  if (!body) return json({ error: 'Invalid request.' }, 400, origin);

  const turnstileError = await checkTurnstile(body.turnstileToken, request, env);
  if (turnstileError) return json({ error: turnstileError }, 400, origin);

  const first = normalize(body.firstName);
  const last = normalize(body.lastName);
  if (!first || !last) {
    return json({ error: 'Enter your first and last name.' }, 400, origin);
  }

  const guests = await readJsonFile(env, 'guests.json');
  if (!guests) {
    return json({ error: 'Guest list is not set up yet.' }, 500, origin);
  }

  const invite = guests.data.find((entry) =>
    entry.match.some((m) => normalize(m.first) === first && normalize(m.last) === last)
  );

  if (!invite) {
    return json({
      found: false,
      message: "We couldn't find an invitation under that name. Double-check the spelling, or reach out to Lukas or Michelle directly.",
    }, 200, origin);
  }

  const existing = await readJsonFile(env, `rsvps/${invite.id}.json`);

  return json({
    found: true,
    id: invite.id,
    guests: invite.guests,
    alreadyResponded: !!existing,
  }, 200, origin);
}

/* ─────────────────────────── /rsvp ─────────────────────────── */

async function handleRsvp(request, env, origin) {
  const body = await safeJson(request);
  if (!body) return json({ error: 'Invalid request.' }, 400, origin);

  const turnstileError = await checkTurnstile(body.turnstileToken, request, env);
  if (turnstileError) return json({ error: turnstileError }, 400, origin);

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    return json({ error: 'Invalid invitation reference.' }, 400, origin);
  }

  // Re-validate against the guest list rather than trusting the client —
  // the id and guest names must actually match an invite we issued.
  const guests = await readJsonFile(env, 'guests.json');
  const invite = guests && guests.data.find((entry) => entry.id === id);
  if (!invite) {
    return json({ error: 'Invitation not found.' }, 404, origin);
  }

  const already = await readJsonFile(env, `rsvps/${id}.json`);
  if (already) {
    return json({ error: 'This invitation has already replied. To change your response, contact Lukas or Michelle directly.' }, 409, origin);
  }

  const submittedGuests = Array.isArray(body.guests) ? body.guests : [];
  if (submittedGuests.length !== invite.guests.length) {
    return json({ error: 'Response does not match the invitation.' }, 400, origin);
  }

  const cleanGuests = invite.guests.map((name, i) => {
    const g = submittedGuests[i] || {};
    return {
      name,
      attending: g.attending === true,
      dietary: clampText(g.dietary, MAX_NAME_LEN),
    };
  });

  const record = {
    id,
    respondedAt: new Date().toISOString(),
    guests: cleanGuests,
    message: clampText(body.message, MAX_MESSAGE_LEN),
  };

  const created = await writeJsonFile(
    env,
    `rsvps/${id}.json`,
    record,
    `RSVP: ${invite.guests[0]}${invite.guests.length > 1 ? ' & family' : ''}`
  );

  if (!created) {
    return json({ error: 'Could not save your RSVP. Please try again in a moment.' }, 502, origin);
  }

  return json({ ok: true }, 200, origin);
}

/* ─────────────────────────── GitHub helpers ─────────────────────────── */

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'scarfe-rsvp-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readJsonFile(env, path) {
  const url = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const body = await res.json();
  const text = b64DecodeUtf8(body.content);
  return { data: JSON.parse(text), sha: body.sha };
}

async function writeJsonFile(env, path, data, message) {
  const url = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: b64EncodeUtf8(JSON.stringify(data, null, 2)),
      branch: env.GITHUB_BRANCH,
    }),
  });
  return res.ok;
}

/* ─────────────────────────── misc helpers ─────────────────────────── */

async function checkTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET) return null; // not configured — skip
  if (!token) return 'Please complete the verification check.';

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') || undefined,
    }),
  });
  const outcome = await res.json();
  return outcome.success ? null : 'Verification failed. Please try again.';
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Combining diacritical marks block (U+0300–U+036F), built from code
// points rather than literal characters to keep this file plain ASCII.
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function normalize(str) {
  return (typeof str === 'string' ? str : '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, ''); // strip accents (é → e, etc.)
}

function clampText(str, max) {
  return (typeof str === 'string' ? str : '').trim().slice(0, max);
}

function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function b64DecodeUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
