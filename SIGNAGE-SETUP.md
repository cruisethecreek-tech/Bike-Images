# DIY Digital Signage — Setup Guide

Your own AbleSign/Yodeck replacement. Zero subscription, no watermark, full control.
It's just a webpage (`signage.html`) that loops through your photos/videos and shows a
scrolling ticker. Point any TV's kiosk browser at it and you're done.

---

## How it works

- **`signage.html`** — the display page. It reads `content.json` and plays the slideshow.
- **`content.json`** — your content. Edit this to change what's on screen.
- **`images/`** — put your photos and videos here.

Every 60 seconds each TV re-checks `content.json`, so when you push a change,
**all your screens update on their own within a minute** — no reboot, no re-pairing.

---

## Updating what's on screen

1. Add your photos/videos to the `images/` folder.
2. List them in `content.json`.
3. Commit + push to GitHub → Vercel auto-deploys → the TVs pick it up within a minute.

### `content.json` reference

```json
{
  "fit": "cover",                 // "cover" = fill the screen (may crop). "contain" = show whole image (letterbox)
  "showClock": true,              // show a clock in the top-right corner

  "tickerLabel": "CRUISE THE CREEK",   // the yellow badge on the left of the ticker
  "tickerText": "Your scrolling message here  •  Second item  •",
  "tickerSpeed": 30,              // seconds for one full scroll pass (higher = slower)

  "slides": [
    { "src": "images/photo1.jpg", "seconds": 8, "caption": "Optional text overlay" },
    { "src": "images/promo.mp4" },                        // videos play full length, then advance
    { "src": "images/photo2.jpg", "seconds": 10, "fit": "contain" }
  ]
}
```

**Per-slide options:** `src` (required), `seconds` (image duration, default 8),
`caption` (text overlay), `fit` (`cover` or `contain`, overrides the global setting).

**Shortcut:** a slide can just be a filename string — `"images/photo1.jpg"` — if you
don't need per-slide options.

**No ticker?** Delete the `tickerText` line. **No clock?** Set `showClock` to `false`.

---

## Putting it on the TVs (Fire Stick)

1. On each Fire Stick, install **Fully Kiosk Browser** (or **Fully Kiosk Browser Lite**,
   free) from the Amazon Appstore.
2. Open it and set the **Start URL** to your deployed page, e.g.
   `https://YOUR-SITE.vercel.app/signage.html`
3. Enable **Launch on Boot** and **Screensaver/Sleep off** so the TV shows signage 24/7.
4. Repeat on all four Fire Sticks — they can all point at the same URL, or you can make
   per-screen versions (see below).

That's it. Change `content.json`, push, and every screen updates itself.

---

## Optional: different content per screen

Make a copy of `content.json` for each screen and a matching page that loads it — or,
simplest, duplicate `signage.html` (e.g. `screen2.html`) and change the one line
`const CONFIG_URL = "content.json";` to `"content2.json"`. Point Fire Stick #2 at
`screen2.html`.

---

## Why this beats a paid tool for you

- **$0 forever** — no per-screen fees, no watermark, no account.
- **Same publish flow you already use** — GitHub → Vercel.
- **Total design control** — it's your HTML/CSS.
- **Self-updating screens** — push once, all TVs follow.
