// api/commit.js — Vercel serverless function for the signage admin panel.
//
// Commits one or more files (images/videos + content.json) to the GitHub repo
// in a single atomic commit using the Git Data API. Keeps your GitHub token on
// the server so it is never exposed in the browser (Option 2 / secure mode).
//
// Required Vercel environment variables:
//   GITHUB_TOKEN    - a GitHub personal access token with "Contents: read/write"
//   GITHUB_REPO     - "owner/name", e.g. "cruisethecreek-tech/Bike-Images"
//   ADMIN_PASSWORD  - a password you choose; the admin page must send it
// Optional:
//   GITHUB_BRANCH   - branch to commit to (default "main")

const GH = "https://api.github.com";

async function gh(path, token, opts = {}) {
  const res = await fetch(GH + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "diy-signage-admin",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data && data.message ? data.message : "GitHub API " + res.status);
  }
  return data;
}

export default async function handler(req, res) {
  // CORS / preflight (harmless; the page is same-origin on Vercel)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const token   = process.env.GITHUB_TOKEN;
  const repo    = process.env.GITHUB_REPO;
  const branch  = process.env.GITHUB_BRANCH || "main";
  const adminPw = process.env.ADMIN_PASSWORD;

  if (!token || !repo) {
    res.status(500).json({
      error: "Server not configured. Set GITHUB_TOKEN and GITHUB_REPO env vars in Vercel.",
    });
    return;
  }

  // Vercel parses JSON bodies automatically; guard in case it's a string.
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  if (adminPw && body.password !== adminPw) {
    res.status(401).json({ error: "Wrong admin password." });
    return;
  }

  const files = Array.isArray(body.files) ? body.files : [];
  const deletions = Array.isArray(body.deletions) ? body.deletions : [];
  const message = body.message || "Update signage content";
  if (!files.length && !deletions.length) { res.status(400).json({ error: "Nothing to commit." }); return; }

  // Basic path safety: only allow writing content.json and files under images/.
  for (const f of files) {
    if (typeof f.path !== "string" || f.path.includes("..") || f.path.startsWith("/")) {
      res.status(400).json({ error: "Illegal path: " + f.path }); return;
    }
    const ok = f.path === "content.json" || f.path.startsWith("images/");
    if (!ok) { res.status(400).json({ error: "Path not allowed: " + f.path }); return; }
  }
  // Deletions are limited to media under images/.
  for (const p of deletions) {
    if (typeof p !== "string" || p.includes("..") || p.startsWith("/") || !p.startsWith("images/")) {
      res.status(400).json({ error: "Illegal delete path: " + p }); return;
    }
  }

  try {
    // 1. Latest commit on the branch
    const ref = await gh(`/repos/${repo}/git/ref/heads/${branch}`, token);
    const latestSha = ref.object.sha;

    // 2. Its tree
    const commitObj = await gh(`/repos/${repo}/git/commits/${latestSha}`, token);
    const baseTree = commitObj.tree.sha;

    // 3. Create a blob per file
    const tree = [];
    for (const f of files) {
      const blob = await gh(`/repos/${repo}/git/blobs`, token, {
        method: "POST",
        body: JSON.stringify({ content: f.contentBase64, encoding: "base64" }),
      });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    // Deletions: a tree entry with sha:null removes the file.
    for (const p of deletions) {
      tree.push({ path: p, mode: "100644", type: "blob", sha: null });
    }

    // 4. New tree on top of the base
    const newTree = await gh(`/repos/${repo}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTree, tree }),
    });

    // 5. New commit
    const newCommit = await gh(`/repos/${repo}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [latestSha] }),
    });

    // 6. Move the branch pointer
    await gh(`/repos/${repo}/git/refs/heads/${branch}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    res.status(200).json({ ok: true, commit: newCommit.sha, branch });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
