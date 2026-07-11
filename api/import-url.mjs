// api/import-url.mjs — import a photo/video from a public link (Google Drive share
// link, Dropbox, a website, …) without downloading it first. The server fetches the
// file (no browser CORS limits) and stores it in Supabase Storage under imported/,
// then returns its public CDN URL. Admin-password gated.
//
// POST { password, url } -> { publicUrl, name, isVideo }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, optional SUPABASE_BUCKET

const MAX_BYTES = 100 * 1024 * 1024;  // function-memory safety cap; Supabase enforces the real file-size limit

function sanitize(n){ return (n || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file"; }

const UA = { "User-Agent": "Mozilla/5.0 (compatible; diy-signage-import/1.0)" };
function isHtml(r){ return (r.headers.get("content-type") || "").toLowerCase().includes("text/html"); }

// Extract a Google Drive file id from any of its share-link forms.
function driveId(u){
  if (!/drive\.google\.com|docs\.google\.com/.test(u)) return null;
  const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Google Drive fights direct downloads: the plain uc link often returns an HTML
// interstitial. Try the current download host with a confirm token, follow the
// interstitial's token, then fall back to Drive's image renderer for photos.
async function fetchDrive(id){
  let r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { redirect: "follow", headers: UA });
  if (r.ok && !isHtml(r)) return r;
  if (r.ok && isHtml(r)) {
    const html = await r.text();
    const conf = html.match(/[?&;]confirm=([0-9A-Za-z_-]+)/) || html.match(/name="confirm"\s+value="([^"]+)"/);
    const uuid = html.match(/name="uuid"\s+value="([^"]+)"/);
    if (conf) {
      let u = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=${conf[1]}`;
      if (uuid) u += `&uuid=${uuid[1]}`;
      const r2 = await fetch(u, { redirect: "follow", headers: UA });
      if (r2.ok && !isHtml(r2)) return r2;
    }
  }
  // Photo fallback: the thumbnail renderer returns real image bytes for public files.
  const t = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w1920`, { redirect: "follow", headers: UA });
  if (t.ok && (t.headers.get("content-type") || "").toLowerCase().startsWith("image/")) return t;
  return null;
}

async function fetchMedia(raw){
  const id = driveId(raw);
  if (id) {
    const r = await fetchDrive(id);
    if (!r) throw new Error("Google Drive wouldn't release the file. Make sure it's shared “Anyone with the link”, and it's a photo/video within your Storage size limit.");
    return r;
  }
  const r = await fetch(raw, { redirect: "follow", headers: UA });
  if (!r.ok) throw new Error("Couldn't fetch the link (" + r.status + ").");
  if (isHtml(r)) throw new Error("That link returned a web page, not a file. Use a direct link to the image/video itself.");
  return r;
}

const EXT = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv",
  "video/quicktime": ".mov",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const supaUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "media";
  const adminPw = process.env.ADMIN_PASSWORD;

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (adminPw && body.password !== adminPw) { res.status(401).json({ error: "Wrong admin password." }); return; }
  if (!supaUrl || !key) { res.status(200).json({ error: "Importing needs Supabase Storage — set it up first (see SIGNAGE-SETUP.md)." }); return; }

  const raw = String(body.url || "").trim();
  if (!/^https?:\/\//i.test(raw)) { res.status(400).json({ error: "Enter a valid http(s) link." }); return; }

  try {
    const r = await fetchMedia(raw);
    let ctype = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const isImage = ctype.startsWith("image/");
    const isVideo = ctype.startsWith("video/");
    if (!isImage && !isVideo) throw new Error("Link isn't an image or video (got " + (ctype || "unknown") + ").");

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("File is " + Math.round(buf.length / 1048576) + " MB — over your Supabase Storage file-size limit (free plan max is 50 MB). Compress it or raise the limit in Supabase → Storage settings.");
    if (!buf.length) throw new Error("The link returned no data.");

    // Work out a filename.
    let name = "";
    const cd = r.headers.get("content-disposition") || "";
    const mn = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
    if (mn) name = decodeURIComponent(mn[1]);
    if (!name && !driveId(raw)) { try { name = decodeURIComponent(new URL(raw).pathname.split("/").pop() || ""); } catch {} }
    name = sanitize(name);
    const ext = EXT[ctype] || (name.match(/\.[a-z0-9]+$/i) ? "" : ".bin");
    if (ext && !name.toLowerCase().endsWith(ext)) name = name.replace(/\.[a-z0-9]+$/i, "") + ext;
    if (!name || name === "file" + ext) name = "import-" + Date.now() + ext;

    const objectPath = "imported/" + name;
    const up = await fetch(`${supaUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": ctype, "x-upsert": "true" },
      body: buf,
    });
    if (!up.ok) {
      const t = await up.text();
      if (/bucket not found/i.test(t)) throw new Error(`Storage bucket "${bucket}" not found — create a public bucket named "${bucket}".`);
      if (up.status === 413 || /maximum allowed size|exceeded|too large|payload/i.test(t)) throw new Error("Supabase rejected the file for size — it's over your Storage file-size limit (free plan max is 50 MB). Raise it in Supabase → Storage settings, or use a smaller file.");
      throw new Error("Storage upload failed: " + up.status + " " + t.slice(0, 150));
    }

    res.status(200).json({
      publicUrl: `${supaUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
      name,
      isVideo,
    });
  } catch (err) {
    res.status(200).json({ error: err.message || String(err) });
  }
}
