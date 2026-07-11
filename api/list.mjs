// api/list.mjs — lists media files in the repo's images/ folder for the dashboard's
// Media Library. Uses the server-side GitHub token, gated by the admin password.
//
// POST { password } -> { files: [{ name, path, size }] }

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
    const files = (Array.isArray(items) ? items : [])
      .filter(f => f.type === "file" && /\.(jpe?g|png|webp|gif|mp4|webm|ogg|mov|m4v)$/i.test(f.name))
      .map(f => ({ name: f.name, path: f.path, size: f.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
