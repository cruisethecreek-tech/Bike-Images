// api/heartbeat.mjs — a screen checks in here every minute so the dashboard can show
// online/offline status. Writes to a Supabase table using the service-role key.
//
// Required Vercel env vars (optional — monitoring stays dark until they're set):
//   SUPABASE_URL                 e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    the service_role key (server-side only)
//
// Expected table (see SIGNAGE-SETUP.md for the SQL):
//   screen_status(screen_id text primary key, last_seen timestamptz, playlist text, user_agent text)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");  // tolerate trailing slash
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Not configured yet — reply 200 so screens don't log errors.
  if (!url || !key) { res.status(200).json({ ok: false, note: "monitoring not configured" }); return; }

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const screen_id = String(body.screen || "default").slice(0, 64);
  const playlist  = body.playlist ? String(body.playlist).slice(0, 64) : null;
  const ackCommand = body.ackCommand ? String(body.ackCommand).slice(0, 64) : null;

  try {
    // The TV reports it just ran a command: clear it so it won't run again (even after a
    // reload or a storage wipe). Filtered on command_id so we only clear that exact command.
    if (ackCommand) {
      await fetch(`${url}/rest/v1/screen_status?screen_id=eq.${encodeURIComponent(screen_id)}&command_id=eq.${encodeURIComponent(ackCommand)}`, {
        method: "PATCH",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ command: null, command_id: null }),
      }).catch(() => {});
    }

    const r = await fetch(`${url}/rest/v1/screen_status?on_conflict=screen_id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        // return=representation so we can hand any pending command back to the TV.
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        screen_id,
        last_seen: new Date().toISOString(),
        playlist,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 200),
      }),
    });
    if (!r.ok) { const t = await r.text(); throw new Error("Supabase " + r.status + ": " + t.slice(0, 200)); }
    const rows = await r.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : rows;
    // Don't echo back a command we just acked in this same call.
    const command = (row && row.command && row.command_id !== ackCommand) ? row.command : null;
    const command_id = command ? row.command_id : null;
    res.status(200).json({ ok: true, command, command_id });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });   // never break the display
  }
}
