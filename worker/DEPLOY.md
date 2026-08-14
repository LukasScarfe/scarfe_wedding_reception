# Deploying the RSVP API

This worker is the only thing that can read or write your private RSVP
repo. Its own source code (this folder) holds no guest data and is safe
to keep in the public site repo — the only secret is a GitHub token,
which you set via `wrangler secret put` and which is never written to
any file here.

## 1. Create the private data repo

On GitHub, create a **new private repository** named `scarfe_wedding_rsvps`
(or edit `GITHUB_REPO` in `wrangler.toml` if you name it differently).

Add one file to it, `guests.json`, based on `worker/guests.example.json`
in this repo. One entry per household/invite:

```json
[
  {
    "id": "smith-family",
    "match": [
      { "first": "John", "last": "Smith" },
      { "first": "Jane", "last": "Smith" }
    ],
    "guests": ["John Smith", "Jane Smith", "Tommy Smith"]
  }
]
```

- `id` — unique slug, lowercase letters/numbers/hyphens only.
- `match` — every name that should successfully "find" this invitation
  when typed into the RSVP page (so either spouse can look it up).
- `guests` — the actual people on the invite; each gets their own
  attending/not-attending toggle on the RSVP form.

Commit it to the repo's default branch (`main`).

Responses will show up automatically in this repo too, one file per
household at `rsvps/<id>.json`, created the moment someone submits —
that's your guest list *and* your RSVP tracker, both private, both
version-controlled.

## 2. Create a scoped GitHub token

GitHub → Settings → Developer settings → **Fine-grained personal access
tokens** → Generate new token.

- **Repository access:** Only select repositories → `scarfe_wedding_rsvps`
  (not the public site repo — the worker never needs to touch that one)
- **Permissions:** Repository → Contents → **Read and write**
- Everything else: no access
- Expiration: whatever you're comfortable with (you can rotate it later
  with `wrangler secret put` again)

Copy the token — you won't see it again.

## 3. Install wrangler and log in

```bash
cd worker
npm install
npx wrangler login          # opens a browser to authorize your Cloudflare account
```

## 4. Set the secret(s)

```bash
npx wrangler secret put GITHUB_TOKEN
# paste the token from step 2 when prompted
```

Turnstile (bot protection on the RSVP form) is optional but recommended
and free — see step 6. If you set it up, also run:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

If you skip Turnstile, the worker just doesn't check it — nothing else
needs to change.

## 5. Deploy

```bash
npx wrangler deploy
```

This publishes the worker under a `workers.dev` URL first. To serve it
at `rsvp-api.michelleyap.lukasscarfe.com` (what `assets/js/rsvp.js`
expects), go to the Cloudflare dashboard → Workers & Pages → this
worker → **Settings → Domains & Routes → Add → Custom Domain**, and
enter `rsvp-api.michelleyap.lukasscarfe.com`. Since `lukasscarfe.com`
is already on Cloudflare, it creates the DNS record for you — no manual
CNAME needed, and no interaction with the site's own DNS/CNAME setup.

If you'd rather use a different hostname, update `API_BASE` at the top
of `assets/js/rsvp.js` to match.

## 6. (Recommended) Turnstile bot protection

Cloudflare dashboard → Turnstile → Add site.

- Domain: `michelleyap.lukasscarfe.com`
- Widget mode: **Managed** (invisible for real visitors most of the time)

You'll get a **Site Key** and a **Secret Key**.

- Site key → paste into `rsvp.html`, replacing `YOUR_TURNSTILE_SITE_KEY`
  (both places it appears — the class stays `cf-turnstile`)
- Secret key → `npx wrangler secret put TURNSTILE_SECRET` (step 4)

Without this, the RSVP endpoints are still safe (name lookups only
return the invite's first names + whether it's replied, and everything
still checks the guest list server-side) — Turnstile just keeps
automated scripts from hammering the lookup endpoint to enumerate names.

## 7. Test it

The worker only accepts requests from `https://michelleyap.lukasscarfe.com`
(see `ALLOWED_ORIGIN` in `wrangler.toml`), so test against the live site
rather than opening `rsvp.html` as a local `file://` — push this branch,
let Pages deploy, then visit `rsvp.html` there. Look up a name from your
`guests.json` and confirm:

- A real name finds the invite and shows the reply form
- A made-up name shows "we couldn't find an invitation"
- Submitting creates `rsvps/<id>.json` in the private repo
- Submitting a second time (or looking the same name up again) reports
  it's already replied

## Updating the guest list later

Just edit `guests.json` in the private repo directly on GitHub (or
clone it locally) — no redeploy needed, the worker reads it fresh on
every lookup.
