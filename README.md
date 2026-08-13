# Michelle & Lukas — Save the Date

A garden/botanical e-vite email. Sage, blush and cream, script headline, mounted photograph.

```
save-the-date.html          the email
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

Since you're building the site later anyway, GitHub Pages is the natural home:

```bash
git init
git add . && git commit -m "Save the date"
gh repo create scarfe_wedding_reception --public --source=. --push
```

Then in the repo: **Settings → Pages → Source: `main` / root**. After a minute your assets are live at `https://lukasscarfe.github.io/scarfe_wedding_reception/assets/…`, and this one-liner rewrites every reference in the email:

```bash
sed -i "s#\([\"']\)assets/#\1https://lukasscarfe.github.io/scarfe_wedding_reception/assets/#g" save-the-date.html
```

That rewrites all five references — three `src=` attributes plus the `background` attribute and `background-image` URL for the tile. Reload the file in a browser afterwards to confirm everything still renders.

> **Two privacy notes on the public-repo route.**
>
> The photo becomes reachable by anyone with the URL. It won't be indexed or listed, but it isn't private. If that matters, host it somewhere access-controlled instead.
>
> The `.nojekyll` file in this repo stops GitHub Pages from publishing *this README* as your homepage — which it does by default when there's no `index.html`. Don't delete it until you have a real `index.html` to replace it.

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
