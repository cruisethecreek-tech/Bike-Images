// api/list.mjs — lists media for the dashboard's Media Library: repo images/ (GitHub),
// plus optional Supabase Storage and Cloudflare R2 objects. Admin-password gated.
//
// POST { password } -> { files: [{ name, path, size, provider, storage? }] }

import { r2cfg, r2ready, r2publicUrl, signedFetch } from "../lib/r2.mjs";

const GH = "https://api.github.com";

async function gh(path, token) {
  const res = await fetch(GH + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "diy-signage-admin",
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data && data.message ? data.message : "GitHub API " + res.status);
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const token   = process.env.GITHUB_TOKEN;
  const repo    = process.env.GITHUB_REPO;
  const branch  = process.env.GITHUB_BRANCH || "main";
  const adminPw = process.env.ADMIN_PASSWORD;

  if (!token || !repo) { res.status(500).json({ error: "Server not configured (GITHUB_TOKEN / GITHUB_REPO)." }); return; }

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }

  try {
    let items = [];
    try {
      items = await gh(`/repos/${repo}/contents/images?ref=${branch}`, token);
    } catch (e) {
      // images/ folder may not exist yet — that's fine, return empty
      if (/not found/i.test(e.message)) items = [];
      else throw e;
    }
    const mediaRe = /\.(jpe?g|png|webp|gif|mp4|webm|ogg|mov|m4v)$/i;
    const files = (Array.isArray(items) ? items : [])
      .filter(f => f.type === "file" && mediaRe.test(f.name))
      .map(f => ({ name: f.name, path: f.path, size: f.size, provider: "github" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Cloudflare R2 objects (primary large-media store), if configured.
    const r2 = r2cfg();
    if (r2ready(r2) && r2.publicUrl) {
      try {
        const r = await signedFetch(r2, "GET", "", { query: "list-type=2&max-keys=1000" });
        if (r.ok) {
          const xml = await r.text();
          const re = /<Key>([^<]+)<\/Key>/g; let m;
          while ((m = re.exec(xml))) {
            const k = m[1];
            if (mediaRe.test(k)) files.push({ name: k.split("/").pop(), path: r2publicUrl(r2, k), provider: "r2", storage: true });
          }
        }
      } catch (_) { /* optional */ }
    }

    // Legacy Supabase Storage objects (videos/ and imported/), if still configured.
    const sbUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, ""), sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (sbUrl && sbKey) {
      const bucket = process.env.SUPABASE_BUCKET || "media";
      for (const prefix of ["videos/", "imported/"]) {
        try {
          const r = await fetch(`${sbUrl}/storage/v1/object/list/${bucket}`, {
            method: "POST",
            headers: { apikey: sbKey, Authorization: "Bearer " + sbKey, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, limit: 200, sortBy: { column: "name", order: "asc" } }),
          });
          if (r.ok) {
            const objs = await r.json();
            (Array.isArray(objs) ? objs : [])
              .filter(o => o.name && o.metadata && mediaRe.test(o.name))
              .forEach(o => files.push({
                name: o.name,
                path: `${sbUrl}/storage/v1/object/public/${bucket}/${prefix}${o.name}`,
                size: (o.metadata && o.metadata.size) || 0,
                provider: "supabase",
                storage: true,
              }));
          }
        } catch (_) { /* storage optional — ignore listing errors */ }
      }
    }
    res.status(200).json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
