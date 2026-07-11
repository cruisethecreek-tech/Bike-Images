// api/r2.mjs — Cloudflare R2 media backend (large videos, free tier ~10 GB, no per-file
// cap like Supabase's). S3-compatible; the browser uploads directly to R2 via a presigned
// PUT URL minted here, so nothing large passes through Vercel. Admin-password gated.
//
// POST { password, action, path }
//   action "sign":   { path:"videos/x.mp4" }  -> { uploadUrl, publicUrl }
//   action "delete": { path: publicUrl | key } -> { ok:true }
//   action "list":                             -> { files:[{name,path,provider:"r2",storage:true}] }
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL,
//      ADMIN_PASSWORD

import { r2cfg, r2ready, r2publicUrl, presign, signedFetch } from "../lib/r2.mjs";

const MEDIA_RE = /\.(jpe?g|png|webp|gif|mp4|webm|ogg|mov|m4v)$/i;

function safeKey(p) {
  const k = String(p || "").replace(/^\/+/, "");
  if (!k || k.includes("..")) return null;
  if (!/^(videos|imported)\//.test(k)) return null;
  return k;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const c = r2cfg();
  const adminPw = process.env.ADMIN_PASSWORD;
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }
  if (!r2ready(c)) { res.status(200).json({ configured: false, error: "Cloudflare R2 isn't set up — add the R2 env vars (see SIGNAGE-SETUP.md)." }); return; }
  if (!c.publicUrl) { res.status(200).json({ configured: false, error: "R2_PUBLIC_URL isn't set — enable the bucket's public URL and add it in Vercel." }); return; }

  try {
    if (body.action === "sign") {
      const key = safeKey(body.path);
      if (!key) { res.status(400).json({ error: "Bad path." }); return; }
      res.status(200).json({ uploadUrl: presign(c, "PUT", key, 900), publicUrl: r2publicUrl(c, key) });
      return;
    }

    if (body.action === "delete") {
      let key = String(body.path || "");
      if (key.startsWith(c.publicUrl + "/")) key = key.slice((c.publicUrl + "/").length);
      try { key = decodeURIComponent(key); } catch {}
      key = safeKey(key);
      if (!key) { res.status(400).json({ error: "Bad path." }); return; }
      const r = await signedFetch(c, "DELETE", key);
      if (!r.ok && r.status !== 404) { const t = await r.text(); throw new Error("R2 " + r.status + ": " + t.slice(0, 150)); }
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === "test") {
      const r = await signedFetch(c, "GET", "", { query: "list-type=2&max-keys=1" });
      if (r.ok) { res.status(200).json({ ok: true, bucket: c.bucket }); return; }
      const t = await r.text();
      const code = (t.match(/<Code>([^<]+)<\/Code>/) || [])[1];
      const msg = (t.match(/<Message>([^<]+)<\/Message>/) || [])[1];
      res.status(200).json({ ok: false, status: r.status, error: (code ? code + ": " : "") + (msg || t.slice(0, 160)) });
      return;
    }

    if (body.action === "list") {
      const r = await signedFetch(c, "GET", "", { query: "list-type=2&max-keys=1000" });
      const xml = await r.text();
      if (!r.ok) throw new Error("R2 list " + r.status + ": " + xml.slice(0, 150));
      const files = [];
      const re = /<Key>([^<]+)<\/Key>/g;
      let m;
      while ((m = re.exec(xml))) {
        const key = m[1];
        if (!MEDIA_RE.test(key)) continue;
        files.push({ name: key.split("/").pop(), path: r2publicUrl(c, key), provider: "r2", storage: true });
      }
      res.status(200).json({ files });
      return;
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    res.status(200).json({ error: err.message || String(err) });
  }
}
