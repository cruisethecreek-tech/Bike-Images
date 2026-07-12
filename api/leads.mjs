// api/leads.mjs — returns demo-request submissions for the dashboard's Leads view.
// Reads the Supabase `leads` table. Gated by the admin password.
//
// POST { password } -> { configured: bool, leads: [{ id, created_at, name, email, business, screens, message }] }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const adminPw = process.env.ADMIN_PASSWORD;
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }

  if (!url || !key) { res.status(200).json({ configured: false, leads: [] }); return; }

  try {
    const r = await fetch(`${url}/rest/v1/leads?select=id,created_at,name,email,business,screens,message&order=created_at.desc&limit=500`, {
      headers: { apikey: key, Authorization: "Bearer " + key },
    });
    const t = await r.text();
    if (!r.ok) {
      if (/relation .*leads.* does not exist|Could not find the table/i.test(t)) {
        res.status(200).json({ configured: false, needsTable: true, leads: [] });
        return;
      }
      throw new Error("Supabase " + r.status + ": " + t.slice(0, 200));
    }
    const leads = JSON.parse(t || "[]");
    res.status(200).json({ configured: true, leads: Array.isArray(leads) ? leads : [] });
  } catch (err) {
    res.status(500).json({ configured: true, error: err.message, leads: [] });
  }
}
