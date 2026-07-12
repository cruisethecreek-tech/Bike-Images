// api/check-offline.mjs — Yodeck-style offline alerts. Looks for screens that haven't
// checked in for a while and emails the owner/client once, then again only after the
// screen recovers and drops offline again. Meant to be pinged on a schedule (Vercel Cron,
// GitHub Actions, or cron-job.org — see SIGNAGE-SETUP.md).
//
// GET/POST (optionally ?key=CRON_SECRET) -> { ok, offline:[...], recovered:[...], emailed }
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (existing monitoring)
//   OFFLINE_MINUTES     how long since last check-in counts as offline (default 30)
//   RESEND_API_KEY      Resend key for sending the email (https://resend.com, free tier)
//   ALERT_FROM          sender, e.g. "Signage Alerts <alerts@yourdomain.com>"
//   ALERT_EMAIL         recipient(s), comma-separated
//   ALERT_BUSINESS      name shown in the email (falls back to branding/content, then generic)
//   SITE_URL            your deploy URL, used to map screen names + link the dashboard
//   CRON_SECRET         optional shared secret; if set, callers must pass ?key= or Bearer
//
// Needs one extra column (see SIGNAGE-SETUP.md):
//   alter table screen_status add column if not exists offline_alerted_at timestamptz;

function sb(url, key) {
  return {
    get: (q) => fetch(`${url}/rest/v1/screen_status?${q}`, { headers: { apikey: key, Authorization: "Bearer " + key } }),
    patch: (q, body) => fetch(`${url}/rest/v1/screen_status?${q}`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(body),
    }),
  };
}

function human(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h} hour${h > 1 ? "s" : ""} and ${r} minute${r > 1 ? "s" : ""}`;
  if (h) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${r} minute${r !== 1 ? "s" : ""}`;
}

async function screenNames(siteUrl) {
  const map = {};
  let business = "";
  if (!siteUrl) return { map, business };
  const base = siteUrl.replace(/\/+$/, "");
  try {
    const r = await fetch(base + "/content.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) { const c = await r.json(); (c.screens || []).forEach(s => { map[String(s.id)] = s.name || ("Screen " + s.id); }); }
  } catch (_) {}
  try {
    const r = await fetch(base + "/branding.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) { const b = await r.json(); business = ((b.businessName ? b.businessName + " " : "") + (b.productName || "")).trim(); }
  } catch (_) {}
  return { map, business };
}

async function sendEmail({ apiKey, from, to, subject, html, text }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map(s => s.trim()).filter(Boolean), subject, html, text }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error("Resend " + r.status + ": " + t.slice(0, 200)); }
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const key = (req.query && req.query.key) || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (key !== secret) { res.status(401).json({ error: "Unauthorized" }); return; }
  }

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { res.status(200).json({ ok: false, note: "monitoring not configured" }); return; }

  const thresholdMin = Number(process.env.OFFLINE_MINUTES) || 30;
  const now = Date.now();
  const db = sb(url, key);

  try {
    const r = await db.get("select=screen_id,last_seen,playlist,offline_alerted_at&order=last_seen.asc");
    const text0 = await r.text();
    if (!r.ok) {
      if (/offline_alerted_at/i.test(text0)) { res.status(200).json({ ok: false, needsSetup: true, error: "Add the alert column: alter table screen_status add column if not exists offline_alerted_at timestamptz;" }); return; }
      throw new Error("Supabase " + r.status + ": " + text0.slice(0, 200));
    }
    const rows = JSON.parse(text0 || "[]");

    const offline = [], recovered = [];
    for (const s of rows) {
      const ageMin = (now - new Date(s.last_seen).getTime()) / 60000;
      const isStale = ageMin > thresholdMin;
      if (isStale && !s.offline_alerted_at) offline.push({ ...s, ageMin });
      else if (!isStale && s.offline_alerted_at) recovered.push(s);
    }

    // Clear the alert flag on screens that came back, so a future outage alerts again.
    for (const s of recovered) {
      await db.patch("screen_id=eq." + encodeURIComponent(s.screen_id), { offline_alerted_at: null }).catch(() => {});
    }

    let emailed = false;
    if (offline.length) {
      const { map, business } = await screenNames(process.env.SITE_URL);
      const bizName = process.env.ALERT_BUSINESS || business || "Your signage";
      const from = process.env.ALERT_FROM;
      const to = process.env.ALERT_EMAIL;
      const apiKey = process.env.RESEND_API_KEY;

      if (apiKey && from && to) {
        const rowsHtml = offline.map(s => {
          const name = map[String(s.screen_id)] || ("Screen " + s.screen_id);
          const last = new Date(s.last_seen).toLocaleString("en-US");
          return `<tr><td style="padding:6px 14px 6px 0"><strong>${name}</strong></td>`
               + `<td style="padding:6px 14px 6px 0;color:#666">last online ${last}</td>`
               + `<td style="padding:6px 0;color:#c0392b">offline ${human(s.ageMin)}</td></tr>`;
        }).join("");
        const n = offline.length;
        const subject = `⚠️ ${n} screen${n > 1 ? "s" : ""} offline — ${bizName}`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
          <h2 style="color:#16202a">${n} of your screen${n > 1 ? "s have" : " has"} gone offline</h2>
          <p style="color:#444">${bizName} hasn't heard from ${n > 1 ? "these screens" : "this screen"} in over ${thresholdMin} minutes:</p>
          <table style="border-collapse:collapse;margin:14px 0">${rowsHtml}</table>
          <p style="color:#444">While a screen is offline it keeps playing what it last had, but new changes won't reach it until it's back online. Check the TV's power and Wi-Fi.</p>
          ${process.env.SITE_URL ? `<p><a href="${process.env.SITE_URL.replace(/\/+$/,"")}/admin.html" style="color:#1f6f8b">Open your dashboard →</a></p>` : ""}
        </div>`;
        const text = `${n} screen(s) offline for ${bizName}:\n` +
          offline.map(s => `- ${map[String(s.screen_id)] || ("Screen " + s.screen_id)}: offline ${human(s.ageMin)} (last online ${new Date(s.last_seen).toLocaleString("en-US")})`).join("\n");

        await sendEmail({ apiKey, from, to, subject, html, text });
        emailed = true;
      }

      // Mark as alerted whether or not email is wired, so we don't recount them next run.
      for (const s of offline) {
        await db.patch("screen_id=eq." + encodeURIComponent(s.screen_id), { offline_alerted_at: new Date(now).toISOString() }).catch(() => {});
      }
    }

    res.status(200).json({
      ok: true,
      thresholdMinutes: thresholdMin,
      offline: offline.map(s => ({ screen_id: s.screen_id, offlineFor: human(s.ageMin) })),
      recovered: recovered.map(s => s.screen_id),
      emailed,
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message || String(err) });
  }
}
