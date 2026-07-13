# Launching CruiseCast — go-live checklist

Everything for the CruiseCast signage product is already built and merged. This is the
step-by-step to take it from "sitting in the repo" to "live and selling," when you're ready.
Nothing here is live until you do these steps, so there's no rush.

Two brands to keep straight:
- **CruiseCast** = the product you sell (the marketing page `product.html`).
- **Cruise the Creek** = your own bike shop's signage instance (its dashboard + TVs).
They share one deployment today; that's fine to start.

---

## Phase 1 — Get a home on the web

- [ ] **Buy a domain** (~$10–15/yr) — e.g. `cruisecast.com` (or `.app`, `.io`, `.tv`).
      Registrars: Namecheap, Cloudflare, or Porkbun.
- [ ] **Point it at Vercel:**
  1. Vercel → your project → **Settings → Domains → Add** → type your domain.
  2. Vercel shows two DNS records (an `A` record and a `CNAME`). Add them at your
     registrar's DNS settings.
  3. Wait for it to verify (minutes to an hour). Vercel adds HTTPS automatically.
- [ ] Your marketing page is then live at **`https://cruisecast.com/product.html`**
      (later you can make it the site root — see "Nice-to-haves").

## Phase 2 — Turn on lead capture (so demo requests are saved)

- [ ] In Supabase → **SQL Editor**, create the leads table:
      ```sql
      create table leads (
        id bigint generated always as identity primary key,
        created_at timestamptz not null default now(),
        name text, email text, business text, screens text, message text, source text
      );
      ```
- [ ] Submit a test request on `/product.html` → confirm it appears in your dashboard's
      **📨 Leads** tab.

## Phase 3 — Turn on offline email alerts (optional but pro)

- [ ] Supabase → SQL Editor:
      `alter table screen_status add column if not exists offline_alerted_at timestamptz;`
- [ ] Create a free **Resend** account (resend.com), verify your domain, get an API key.
- [ ] Vercel env vars: `RESEND_API_KEY`, `ALERT_FROM`, `ALERT_EMAIL`, `SITE_URL`,
      `CRON_SECRET` (+ optional `OFFLINE_MINUTES`, `ALERT_BUSINESS`).
- [ ] GitHub → Settings → Secrets → Actions: add `SITE_URL` + `CRON_SECRET`. The
      **Offline screen alerts** workflow then checks every 15 min.
- [ ] (Full details in `SIGNAGE-SETUP.md`.)

## Phase 4 — Finish the storefront

- [ ] Fill in real **pricing** in `product.html` (the three tiers are placeholders).
- [ ] Add a couple of **screenshots/mockups** of the dashboard + a TV in the hero area.
- [ ] Double-check the copy in `product.html` reads how you want.
- [ ] (Optional) Register CruiseCast socials / a support email on your domain.

## Phase 5 — Onboard your first client

Follow **`CLIENT-SETUP.md`**. In short, per client (~20–30 min):
- [ ] Copy the repo → new client repo → new Vercel project.
- [ ] Give them their **own** env vars (their storage, their `ADMIN_PASSWORD`, their Supabase).
- [ ] Edit that client's **`branding.json`** (their name, colors, app name, `signageUrl`).
- [ ] Run the **Build Signage APK** action → hand them the download link.
- [ ] Give them their dashboard URL + password.

---

## Nice-to-haves (later)

- **Make the marketing page the site root.** Right now the root `/` is the old "Travel
  Inquiry" page. To serve CruiseCast at `/`, either rename `product.html` → `index.html`
  in a dedicated marketing repo, or add a Vercel redirect from `/` to `/product.html`.
  (Best done when CruiseCast gets its **own** repo/deploy, separate from the bike shop.)
- **Separate the marketing site from client instances.** Eventually give CruiseCast its own
  repo/deploy (just the landing page + lead form), and keep each client on their own copy.
- **Custom alert domain.** Send offline alerts from `alerts@cruisecast.com` (Resend domain).
- **The big one — self-serve SaaS:** customer accounts, a database, multi-tenant isolation,
  and Stripe billing so clients sign up and pay themselves. This is weeks of work and no
  longer $0/month — only worth it once demand is proven. Until then, manual onboarding
  (Phase 5) is the right call.

---

## What's already done (no action needed)
✅ Product named CruiseCast · ✅ marketing page + demo form · ✅ Leads inbox in dashboard ·
✅ offline-alert system (built) · ✅ per-client branding via `branding.json` ·
✅ white-label TV app that auto-builds from branding · ✅ screen sync, remote control,
scheduling, weather, monitoring · ✅ auto-updating players.
