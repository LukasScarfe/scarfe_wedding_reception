# Michelle & Lukas — Save the Date

A garden/botanical e-vite email. Sage, blush and cream, script headline, mounted photograph.

```
save-the-date.html          the email
index.html                  the website (skeleton)
rsvp.html                   the RSVP page
assets/css/site.css         site styles + envelope reveal + RSVP form
assets/js/site.js           envelope open behaviour
assets/js/rsvp.js           RSVP lookup/reply flow
worker/                     Cloudflare Worker API backing the RSVP page
worker/DEPLOY.md            one-time setup for the RSVP system
tools/make-botanicals.js    regenerates the leaf artwork

assets/photo-email.jpg      880×1323, 135 KB — retina, displays at 420px
assets/photo-large.jpg      1600×2405, 403 KB — for the website later
assets/leaf-band-top.png    monstera + eucalyptus band, top of card
assets/leaf-band-bottom.png the same band mirrored, foot of card
assets/bg-tile.png          seamless faint foliage behind the card
```

### The botanical artwork

Email clients don't render SVG, so the leaves are generated as PNGs by
`tools/make-botanicals.js` — monstera and eucalyptus shapes drawn from
parametric curves, no dependencies. Colours are baked onto the background
rather than using alpha, which avoids PNG-transparency quirks in older Outlook.

Re-run `node tools/make-botanicals.js` after changing anything. Output is
deterministic, so the art is identical every run. Tunables live near the top:
`SAGE_MID` / `SAGE_LIGHT` / `SAGE_DEEP` / `BLUSH` for colour, `MONSTERA_NOTCHES`
and `MIDRIB` for the leaf silhouette.

---

## 1. Details

All filled in. Married **Saturday June 6, 2026**; reception **Friday May 21, 2027** at Urban Fieldhouse, 1203 Faith Drive, Lakeshore ON.

The venue line links to Google Maps, styled to look like plain text.

Still open — search `✏️ EDIT` in `save-the-date.html`:

- **Start time.** The card says "Dinner and Dancing" with no hour. Add one if you want.
- **Image URLs.** All four images are relative paths so the file previews locally. They must become `https://` URLs before you send — see below.

**The "Open your invitation" button is commented out**, since there's no site for it to open yet. Uncomment the marked `<tr>` block in `save-the-date.html` when Pages is live.

> May 21, 2027 is the Friday of the **Victoria Day long weekend** in Ontario (Victoria Day falls Monday May 24). Good news for anyone travelling in — worth mentioning on the website later.

## 2. Host the images

**Email clients will not display a local file, and Gmail strips base64-embedded images.** All four images — the photo, both leaf bands, and the background tile — must live at public `https://` URLs before you send.

GitHub Pages is already enabled on this repo with the custom domain
**`michelleyap.lukasscarfe.com`** (see the `CNAME` file — don't delete it).

### DNS — one record, still outstanding

`lukasscarfe.com` is on Cloudflare, and its apex already points at GitHub Pages.
The subdomain has no record yet. In Cloudflare → `lukasscarfe.com` → DNS → Records:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `michelleyap` |
| Target | `lukasscarfe.github.io` |
| Proxy status | **DNS only** (grey cloud) |
| TTL | Auto |

A `CNAME` because this is a subdomain — the `185.199.108–111.153` A records are
only for an apex. The target is the *user* domain, never the repo name; the repo
is selected by the `CNAME` file.

**Keep the cloud grey.** GitHub issues its certificate over an HTTP challenge,
and Cloudflare's proxy intercepts it, leaving you stuck on "Certificate not yet
created". If you later want it proxied, first set SSL/TLS → Overview →
**Full (strict)** — the default Flexible mode plus Pages' "Enforce HTTPS" is an
infinite redirect loop.

Once it resolves, wait for the cert, then tick **Enforce HTTPS** in Pages settings.

### Then rewrite the email's image paths

With a custom domain the site is served from the **domain root**, so asset URLs
are `https://michelleyap.lukasscarfe.com/assets/…` — *not* under
`/scarfe_wedding_reception/`.

```bash
sed -i "s#\([\"']\)assets/#\1https://michelleyap.lukasscarfe.com/assets/#g" save-the-date.html
```

That rewrites all five references — three `src=` attributes plus the `background`
attribute and `background-image` URL for the tile. Reload the file in a browser
afterwards to confirm everything still renders, and check the URLs return 200
before sending to anyone.

> **Privacy note.** The repo is public, so every file in it — including the
> full-resolution original JPG — is reachable by anyone with the URL. Nothing is
> indexed or listed, but nothing is private either. Keep guest lists, addresses
> and RSVP data out of this repo; `git rm` won't help after the fact, since it
> stays in history. Use a separate private repo for anything with other people's
> details in it.

## 2b. The website

`index.html` is a skeleton at the domain root, sharing the palette, type and
botanical artwork with the email. Sections: hero, schedule, travel, stay, FAQ,
RSVP. Search `TODO` for everything still to be filled in.

The envelope reveal is progressive enhancement — `assets/js/site.js` adds
`.js-envelope` to `<html>`, and only then does the overlay appear. If the script
fails, guests get the full invitation rather than a blank page. It's skipped for
`prefers-reduced-motion`, remembered per session, and the overlay is removed from
the DOM after opening so it can't trap keyboard focus.

Now that `index.html` exists, Pages serves the site rather than rendering
`README.md`. `.nojekyll` is still worth keeping — it skips Jekyll processing,
which is faster and avoids surprises with underscore-prefixed paths.

### RSVP

`rsvp.html` + `assets/js/rsvp.js` is the guest-facing side of the RSVP
system. Guests type their name, see their household, mark who's coming,
and submit — once. There's no login and no per-guest code to distribute;
matching is by name against a guest list you enter ahead of time.

The actual data — the guest list and every response — lives in a
**separate private GitHub repo**, never this one, so it's never publicly
readable. A small Cloudflare Worker (`worker/`) is the only thing that
can read or write it; the worker's own source code holds no guest data
and is safe to keep here. See `worker/DEPLOY.md` for the one-time setup
(create the private repo, scoped GitHub token, `wrangler deploy`).

The RSVP link on `index.html` is commented out until formal invitations
go out — see the `TODO` in the RSVP section.

## 3. Send it

**Best results — a real email tool.** Free tiers at [Brevo](https://brevo.com), [Mailchimp](https://mailchimp.com), or [Resend](https://resend.com) all take pasted HTML source. This is the only route that preserves the `<style>` block, so the mobile layout and web fonts survive.

**Quick and dirty — straight into Gmail.** Open `save-the-date.html` in Chrome, `Ctrl+A`, `Ctrl+C`, paste into a Gmail compose window. Inline styles and the table layout carry over fine.

Two caveats with this route:
- Gmail drops the `<style>` block, so the mobile media queries are lost — the card renders at a fixed 600px on phones and guests will pinch to zoom.
- BCC your guest list. Gmail caps you at 500 recipients/day.

## Rendering notes

Built table-based with inline CSS, so it survives Outlook's Word rendering engine.

- **Web fonts** (Cormorant Garamond, Pinyon Script) load in Apple Mail and most webmail. Outlook desktop and some Android clients ignore them and fall back to Georgia and a system script face — still elegant, just less distinctive.
- **Dark mode** is pinned to light via `color-scheme` meta tags. Gmail's Android app may still force-invert; the cream and sage hold up acceptably if it does.
- **Ornaments** (❀ ❦) are Unicode text, not images, so they render even with images blocked.
- The `alt` text on the photo is written to read gracefully when images are blocked.

Test before the real send — [Litmus](https://litmus.com) or [Email on Acid](https://emailonacid.com) both have free trials, or just mail it to yourself and check on your phone.

---

Photograph by Tamara Chang Photography.
