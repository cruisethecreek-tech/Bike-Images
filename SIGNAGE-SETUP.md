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

You need **one browser app** on each Fire Stick, pointed at your `signage.html` URL.
If the app you want is in the Fire TV Appstore, just install it (search for it on the
home screen) and skip to step 6. If it is **not** in your Stick's Appstore, sideload it
using the free **Downloader** app — that is Option B below.

### Option B — Sideload the kiosk browser (Downloader method)

You never move a file to a computer or use a cable. The Fire Stick downloads and installs
the app itself. Do this once per Stick.

1. **Install Downloader.** On the Fire Stick home screen, search for **"Downloader"**
   (by AFTVnews) and install it. This app is always in the Fire TV Appstore.

2. **Allow installs from Downloader.** Go to
   **Settings → My Fire TV → Developer options → Install unknown apps**, find
   **Downloader** in the list, and switch it **ON**.
   *(If you don't see "Developer options," open Settings → My Fire TV → About, and click
   the device name 7 times to unlock it.)*

3. **Open Downloader** and select the **Browser** / URL box.

4. **Enter the app's APK link** and download it. Good options:
   - **TV Bro** (free, open-source, built for Fire TV) — get the APK from its official
     GitHub releases page: `https://github.com/truefedex/tv-bro/releases`
     (open that page in Downloader's built-in browser and pick the latest `.apk`).
   - **Fully Kiosk Browser** — from the official site: `https://www.fully-kiosk.com`
     (its download page links the Fire OS / Android APK).
   > Only install APKs from the developer's official site or GitHub — never a random
   > "APK download" site.

5. **Install** when Downloader finishes the download (just click through the prompt).
   After it installs, Downloader offers to **delete the APK file** — say yes to save space.

6. **Point it at your page.** Open the browser app and set its **Start URL / home page** to
   your deployed page, e.g. `https://YOUR-SITE.vercel.app/signage.html`

7. **Make it run 24/7.** Enable the app's **Launch on Boot** (auto-start) and
   **keep-screen-awake / disable screensaver** options so the TV shows signage all day.
   In **TV Bro**: set your URL as the home page and enable kiosk/auto-start in its settings.
   In **Fully Kiosk**: use *Start URL*, *Launch on Boot*, and *Keep Screen On*.

8. **Repeat on all four Fire Sticks.** They can all point at the same URL, or you can make
   per-screen versions (see below).

That's it. From here on you never touch the Sticks again — change `content.json`, push,
and every screen updates itself within a minute.

### Troubleshooting the sideload

- **"App not installed" / blocked:** re-check step 2 — Downloader must be allowed to
  install unknown apps.
- **Can't find Developer options:** click the device name 7× under
  Settings → My Fire TV → About to reveal it.
- **Remote can't navigate the browser:** Fire TV remotes work best with apps built for TV
  (TV Bro). If a browser is hard to control, TV Bro is the more remote-friendly choice.
- **Screen goes to sleep:** also set the Fire Stick itself —
  Settings → Display & Sounds / Screensaver → set screensaver start time to the longest
  option (or "Never" if available).

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
