// api/lead.mjs — receives "Request a demo / Get started" submissions from the product
// landing page (product.html) and saves them to a Supabase table you can review.
//
// POST { name, email, business, screens, message, company_url(honeypot) }
//   -> { ok:true }
//
// Table (see SIGNAGE-SETUP.md):
//   create table leads (id bigint generated always as identity primary key,
//     created_at timestamptz not null default now(),
//     name text, email text, business text, screens text, message text, source text);
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

function clean(v, max) { return String(v == null ? "" : v).trim().slice(0, max || 300); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  // Honeypot: real people leave this hidden field empty; bots fill it. Pretend success.
  if (clean(body.company_url, 200)) { res.status(200).json({ ok: true }); return; }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const business = clean(body.business, 160);
  const screens = clean(body.screens, 40);
  const message = clean(body.message, 2000);

  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "Please enter your name and a valid email." });
    return;
  }

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // No database configured — don't lose the lead; tell them to email instead.
    res.status(200).json({ ok: false, error: "Couldn't submit right now. Please email us directly." });
    return;
  }

  try {
    const r = await fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, email, business, screens, message, source: "product.html" }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (/relation .*leads.* does not exist|Could not find the table/i.test(t)) {
        res.status(200).json({ ok: false, error: "Lead storage isn't set up yet (create the 'leads' table — see SIGNAGE-SETUP.md)." });
        return;
      }
      throw new Error("Supabase " + r.status + ": " + t.slice(0, 200));
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: "Couldn't submit right now. Please email us directly." });
  }
}
