# DIY Digital Signage — Setup Guide

Your own AbleSign/Yodeck replacement. Zero subscription, no watermark, full control.
It's just a webpage (`signage.html`) that loops through your photos/videos and shows a
scrolling ticker. Point any TV's kiosk browser at it and you're done.

## Your live URLs

| Page | URL |
|------|-----|
| **Signage display** (point the TVs here) | `https://bike-images.vercel.app/signage.html` |
| **Admin panel** (upload/manage content) | `https://bike-images.vercel.app/admin.html` |

> On default Vercel, pages keep their **`.html`** extension — use `/signage.html` and
> `/admin.html`, not `/signage` or `/admin`. The site root (`/`) serves `index.html`.

---

## How it works

- **`signage.html`** — the display page. It reads `content.json` and plays the slideshow.
- **`content.json`** — your content. Edit this to change what's on screen.
- **`images/`** — put your photos and videos here.
- **`admin.html`** — an optional drag-and-drop panel to manage all of the above from a
  web page, so you never touch GitHub or JSON by hand. See **"The admin panel"** below.

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
   your deployed page, e.g. `https://bike-images.vercel.app/signage.html`

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

## The admin panel (no GitHub, no JSON)

`admin.html` is a web page for managing the signage without editing files by hand.
Open `https://bike-images.vercel.app/admin.html` and you can:

- **Drag and drop** photos/videos to upload them,
- **Reorder** slides (↑ / ↓), set **captions** and **seconds** per slide,
- Edit the **ticker** text, label, and speed, toggle the **clock** and **image fit**,
- Hit **Save & publish** — it writes everything to the repo in one commit, Vercel
  redeploys, and every screen updates within a minute.

It works in two modes. **Secure mode is recommended.**

### Secure mode (recommended) — token stays on the server

The panel saves through a serverless function (`api/commit.mjs`) that keeps your GitHub
token as a Vercel secret, so it's never exposed in the browser.

**One-time setup in Vercel:**

1. **Create a GitHub token.** GitHub → Settings → Developer settings →
   **Fine-grained personal access tokens** → *Generate new token*.
   - Repository access: **Only select repositories** → this repo.
   - Permissions: **Contents → Read and write**.
   - Copy the token (starts with `github_pat_...`).
2. **Add environment variables in Vercel.** Your project → **Settings → Environment
   Variables** → add:
   | Name | Value |
   |------|-------|
   | `GITHUB_TOKEN` | the token from step 1 |
   | `GITHUB_REPO` | `cruisethecreek-tech/Bike-Images` |
   | `GITHUB_BRANCH` | `main` (or whichever branch Vercel deploys) |
   | `ADMIN_PASSWORD` | a password you choose for the panel |
3. **Redeploy** (Vercel does this automatically when you save env vars, or trigger it).
4. Open `/admin.html`, enter the **admin password**, and start uploading.

> Keep `/admin.html` to yourself — the password is what protects it. Anyone with the
> password can publish to your screens.

### Token mode (Option 1) — quick / no server

If you'd rather not set up the serverless function (e.g. testing locally, or a host
that isn't Vercel), open `admin.html`, expand **"Advanced: use a GitHub token directly,"**
tick the box, and paste your GitHub token + `owner/name` + branch. The token is held only
in that browser tab (cleared when you close it). Simpler, but the token lives in the
browser — fine for just you, not for a shared/kiosk machine.

---

## Phase 3: the white-label app (`signage-app/`)

For a fully-branded, standalone experience — your own app name and icon on the Fire TV
home screen, no third-party kiosk browser — there's a native Android app in
`signage-app/`. It's a fullscreen WebView kiosk that:

- Opens straight to your signage page (no browser bars, no address bar),
- **Auto-launches when the TV powers on**, keeps the screen awake, and ignores the Back
  button so it can't be exited by accident,
- Auto-reloads if the network hiccups,
- Wears **your branding** (app name, icon, Fire TV banner).

It shows the same `signage.html`, so everything you set up above still applies — the app
is just a branded wrapper instead of Fully Kiosk / TV Bro.

### Building the APK (no Android tools needed)

A GitHub Actions workflow (`.github/workflows/build-apk.yml`) compiles and signs the APK
in the cloud:

1. Go to the repo's **Actions** tab → **Build Signage APK** → **Run workflow**.
   (It also runs automatically whenever anything in `signage-app/` changes.)
2. When it finishes (~3–5 min), open the run and download the
   **`cruise-the-creek-signage-apk`** artifact — inside is `cruise-the-creek-signage.apk`.
3. **Sideload it** onto each Fire Stick with the **Downloader** app (same steps as the
   Option B sideload above) — but now you're installing *your own app*.

### Customizing it

- **Which page it shows:** edit `signage_url` in
  `signage-app/app/src/main/res/values/strings.xml` (set it to your deployed
  `…/signage.html`), then rebuild.
- **App name:** edit `app_name` in the same file.
- **Icon / banner:** replace `ic_foreground.xml` / `banner.xml` under
  `signage-app/app/src/main/res/` (or `colors.xml` to recolor).

### Signing note

To get a working APK with zero setup, the release build is signed with the auto-generated
debug key — perfectly fine for sideloaded kiosk devices. If you later want a proper
release keystore (e.g. for consistent app updates), generate one, add it as GitHub
secrets, and point a `signingConfig` at it in `signage-app/app/build.gradle`. Ask and it
can be wired up.

---

## Screen monitoring (optional — Supabase)

Turn on the online/offline health dot in the dashboard's **Screens** tab. Each TV checks
in every minute; the dashboard shows 🟢 online / 🔴 offline and when it was last seen.
This is the one feature that needs a tiny database. It's free and about a 5-minute setup.

**Until you set this up, everything else works as normal** — the Screens tab just shows a
hint instead of the status dot.

### 1. Create a Supabase project
1. Go to **supabase.com**, sign up (free), and **New project**. Pick any name/region and a
   database password (you won't need it again for this).

### 2. Create the table
In the Supabase dashboard → **SQL Editor** → **New query** → paste and **Run**:
```sql
create table screen_status (
  screen_id  text primary key,
  last_seen  timestamptz not null default now(),
  playlist   text,
  user_agent text
);
```

### 3. Get your keys
Supabase → **Project Settings → API**:
- **Project URL** (e.g. `https://abcd.supabase.co`)
- **service_role** key (under *Project API keys* — the secret one, **not** anon)

### 4. Add them to Vercel
Your project → **Settings → Environment Variables** → add:
| Name | Value |
|------|-------|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |

Then **redeploy**. That's it — within a minute of your screens loading, the Screens tab
lights up with live status.

> The service_role key stays server-side (in `api/heartbeat.mjs` and `api/screens.mjs`);
> it's never exposed in the browser. Screens check in through `/api/heartbeat`.

---

## Why this beats a paid tool for you

- **$0 forever** — no per-screen fees, no watermark, no account.
- **Same publish flow you already use** — GitHub → Vercel.
- **Total design control** — it's your HTML/CSS.
- **Self-updating screens** — push once, all TVs follow.
- **Your own upload panel** — `admin.html` gives you drag-and-drop management with none
  of the subscription.
- **Your own branded app** — `signage-app/` builds a white-label APK, no third-party
  kiosk software.
