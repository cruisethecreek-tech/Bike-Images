// api/command.mjs — the dashboard pushes a remote-control command to a screen (Restart,
// Blank/Wake, Refresh, Takeover, Clear data). The command is parked on the screen's row in
// Supabase; the TV picks it up on its next check-in (see signage.html) and runs it once.
// Admin-password gated.
//
// POST { password, screen, command }
//   command: "restart" | "refresh" | "blank" | "wake" | "clear" |
//            "takeover:<message>" | "endtakeover" | "" (clear the pending command)
// -> { ok:true, command_id }
//
// Uses the existing screen_status table plus two columns (see SIGNAGE-SETUP.md):
//   alter table screen_status add column if not exists command text;
//   alter table screen_status add column if not exists command_id text;

const ALLOWED = new Set(["restart", "refresh", "blank", "wake", "clear", "endtakeover"]);

function validCommand(c) {
  if (c === "") return true;                         // clear the pending command
  if (ALLOWED.has(c)) return true;
  if (c.startsWith("takeover:")) return true;        // takeover:<message>
  return false;
}

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
  if (!url || !key) { res.status(200).json({ ok: false, error: "Remote control needs Supabase monitoring — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see SIGNAGE-SETUP.md)." }); return; }

  const screen_id = String(body.screen || "").slice(0, 64);
  let command = String(body.command == null ? "" : body.command);
  if (command.startsWith("takeover:")) command = "takeover:" + command.slice(9).slice(0, 240);
  if (!screen_id) { res.status(400).json({ error: "Which screen?" }); return; }
  if (!validCommand(command)) { res.status(400).json({ error: "Unknown command." }); return; }

  // A fresh id each time so the TV knows this is a new command to run once. (Serverless
  // runtime — Date.now()/random are fine here, unlike workflow scripts.)
  const command_id = command ? (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)) : null;

  try {
    // Upsert so a command can be queued even before the screen's first check-in.
    const r = await fetch(`${url}/rest/v1/screen_status?on_conflict=screen_id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ screen_id, command: command || null, command_id }),
    });
    if (!r.ok) {
      const t = await r.text();
      // The command/command_id columns haven't been added to the table yet.
      if (/command.* column|PGRST204|schema cache/i.test(t)) {
        res.status(200).json({ ok: false, needsSetup: true, error: "One-time setup needed: add the remote-control columns. In Supabase → SQL Editor, run:  alter table screen_status add column if not exists command text;  alter table screen_status add column if not exists command_id text;" });
        return;
      }
      throw new Error("Supabase " + r.status + ": " + t.slice(0, 200));
    }
    res.status(200).json({ ok: true, command_id });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
