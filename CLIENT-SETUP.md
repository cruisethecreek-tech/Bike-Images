# Setting up a new white-label client

This platform is **one copy per client** — each business you sell it to gets its own
deployment, its own storage, its own login, and its own branded TV app. Nothing is shared
between clients, so one client can never see or affect another. This guide is the
repeatable checklist to stand up a new client in about 20–30 minutes.

Everything a client's *identity* needs lives in one file: **`branding.json`**. You edit that
(and drop in a logo/icon), and the dashboard, the TV display, and the Android app all pick
it up.

---

## 1. Copy the project for the new client
1. On GitHub, **use this repo as a template** (or fork it) into a new repo, e.g.
   `acme-signage`. This gives the client an isolated content history.
2. Import that repo into **Vercel** as a new project. Vercel gives it a URL like
   `https://acme-signage.vercel.app` (or connect the client's own domain).

## 2. Give the client their own storage & settings (Vercel → Settings → Environment Variables)
Each client needs their **own** values so their media and screens are separate:

| Variable | What it is |
|----------|-----------|
| `GITHUB_TOKEN` | a fine-grained token with Contents read/write on **their** repo |
| `GITHUB_REPO` | `your-org/acme-signage` |
| `ADMIN_PASSWORD` | the password you give this client for their dashboard |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | their own Supabase project (screen monitoring + remote control) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | their own Cloudflare R2 bucket (large videos) |

(See `SIGNAGE-SETUP.md` for how to create each of those — it's the same process, just under
the client's own accounts, or under yours if you host it for them.)

Then in **their** Supabase → SQL Editor, run the table setup from `SIGNAGE-SETUP.md`
(including the `command` / `command_id` columns for remote control).

## 3. Brand it — edit `branding.json`
This one file controls the client's whole look and app identity:

```json
{
  "businessName": "Acme Rentals",
  "productName": "Signage",
  "appName": "Acme Signage",
  "signageUrl": "https://acme-signage.vercel.app/signage.html",
  "favicon": "🛶",
  "theme": {
    "accent": "#0a7d55",
    "tickerBg": "#0b0b0b",
    "tickerInk": "#ffffff",
    "tickerAccent": "#ffd21e"
  }
}
```

- **businessName / productName** — shown in the dashboard header and browser tab.
- **appName** — the name of the Android/Fire TV app on the home screen.
- **signageUrl** — the client's own `…/signage.html`. **Must match their Vercel URL.**
- **favicon** — an emoji used as the browser-tab icon.
- **theme** — `accent` colours the dashboard; the `ticker*` values colour the TV's news bar.
- **logoUrl** — (optional) a link to the client's logo image (PNG/SVG with a transparent
  background works best). It shows in the dashboard header and in a corner of every TV.
  Leave it `""` for no logo. Host the image anywhere public — e.g. drop it in the repo's
  `images/` folder and use `"images/their-logo.png"`, or paste a full URL.
- **logoPosition** — where the logo sits on the TV: `"bottom-right"` (default),
  `"bottom-left"`, `"top-right"`, or `"top-left"`. (Weather uses top-left and the clock uses
  top-right, so `bottom-right` avoids overlap.)

Commit the change. The dashboard and TVs apply it automatically.

## 4. (Optional) client logo/icon on the TV app
The app ships with a default icon. To give a client their own launcher icon/banner, replace
the images in `signage-app/app/src/main/res/` (`mipmap-*/ic_launcher*`, `drawable/banner.xml`)
before building. Skip this to keep the generic icon.

## 5. Build the client's APK
1. In the client's repo → **Actions → Build Signage APK → Run workflow**.
2. The build reads `branding.json`, so the app is named and pointed at the client's URL
   automatically.
3. When it finishes, the APK is published as a **Release**:
   `https://github.com/<org>/acme-signage/releases/latest/download/cruise-the-creek-signage.apk`
   Shorten that link and sideload it on the client's Fire TVs (see `SIGNAGE-SETUP.md`).

## 6. Hand off
- Give the client their dashboard URL (`…/admin.html`) and their `ADMIN_PASSWORD`.
- They upload media, build playlists, assign each TV to a screen, and schedule — all on
  their own, isolated from every other client.

---

### What each client gets
✅ Own branded dashboard + TV app · ✅ own media/screens/login · ✅ playlists, scheduling,
weather, ticker · ✅ screen monitoring + remote control (Restart/Blank/Takeover) ·
✅ cross-screen sync · ✅ auto-updating players · ✅ $0/month infrastructure per client.

### Handy: renaming the APK artifact per client
The release asset is currently named `cruise-the-creek-signage.apk`. If you want it named per
client, change the file name in `.github/workflows/build-apk.yml` (the "Stage APK" step) —
or leave it; the download still works regardless of the file's name.
