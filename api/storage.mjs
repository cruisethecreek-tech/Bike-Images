// api/storage.mjs — large media (videos) live in Supabase Storage, not the git repo,
// so they bypass Vercel's ~4.5 MB request cap. The browser uploads the file DIRECTLY to
// Supabase using a signed URL minted here; the file is served from Supabase's CDN.
//
// POST { password, action, path }
//   action "sign":   -> { uploadUrl, publicUrl }   (browser PUTs the file to uploadUrl)
//   action "delete": -> { ok:true }                (removes the object)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, optional SUPABASE_BUCKET
// Requires a PUBLIC storage bucket (default name "media"). See SIGNAGE-SETUP.md.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "media";
  const adminPw = process.env.ADMIN_PASSWORD;

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }

  if (!url || !key) {
    res.status(200).json({ configured: false, error: "Supabase Storage isn't set up yet. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a public bucket." });
    return;
  }

  // Normalize the object path. Accept either "videos/x.mp4" or a full public URL.
  let path = String(body.path || "");
  const marker = "/object/public/" + bucket + "/";
  if (path.includes(marker)) path = path.split(marker)[1];
  path = path.replace(/^\/+/, "");
  if (!path || path.includes("..")) { res.status(400).json({ error: "Bad path." }); return; }

  const gh = (extra) => ({ apikey: key, Authorization: "Bearer " + key, ...(extra || {}) });

  try {
    if (body.action === "sign") {
      const r = await fetch(`${url}/storage/v1/object/upload/sign/${bucket}/${path}`, {
        method: "POST",
        headers: gh({ "x-upsert": "true" }),
      });
      const text = await r.text();
      let d; try { d = JSON.parse(text); } catch { d = {}; }
      if (!r.ok) throw new Error("Supabase " + r.status + ": " + text.slice(0, 200));
      const m = String(d.url || "").match(/token=([^&]+)/);
      const token = m ? m[1] : "";
      if (!token) throw new Error("No upload token returned by Supabase.");
      res.status(200).json({
        uploadUrl: `${url}/storage/v1/object/upload/sign/${bucket}/${path}?token=${token}`,
        publicUrl: `${url}/storage/v1/object/public/${bucket}/${path}`,
      });
      return;
    }
    if (body.action === "delete") {
      const r = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers: gh() });
      if (!r.ok && r.status !== 404) { const t = await r.text(); throw new Error("Supabase " + r.status + ": " + t.slice(0, 200)); }
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
