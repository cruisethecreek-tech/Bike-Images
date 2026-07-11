// api/screens.mjs — returns each screen's last check-in for the dashboard's monitoring
// view. Reads the Supabase screen_status table. Gated by the admin password.
//
// POST { password } -> { configured: bool, screens: [{ screen_id, last_seen, playlist }] }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const adminPw = process.env.ADMIN_PASSWORD;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }

  if (!url || !key) { res.status(200).json({ configured: false, screens: [] }); return; }

  try {
    const r = await fetch(`${url}/rest/v1/screen_status?select=screen_id,last_seen,playlist&order=last_seen.desc`, {
      headers: { apikey: key, Authorization: "Bearer " + key },
    });
    if (!r.ok) { const t = await r.text(); throw new Error("Supabase " + r.status + ": " + t.slice(0, 200)); }
    const screens = await r.json();
    res.status(200).json({ configured: true, screens: Array.isArray(screens) ? screens : [] });
  } catch (err) {
    res.status(500).json({ configured: true, error: err.message, screens: [] });
  }
}
