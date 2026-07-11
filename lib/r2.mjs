// lib/r2.mjs — minimal AWS SigV4 signing for Cloudflare R2 (S3-compatible), with no
// external dependencies. Used by the api/* functions to presign browser uploads and to
// sign server-side list/delete requests. Not a route (lives outside /api).

import crypto from "node:crypto";

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const encodePath = (key) => key.split("/").map(enc).join("/");
const sha256hex = (data) => crypto.createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
const signingKey = (secret, dateStamp, region, service) =>
  hmac(hmac(hmac(hmac("AWS4" + secret, dateStamp), region, ), service), "aws4_request");

function amzDates(now) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function r2cfg() {
  return {
    account: process.env.R2_ACCOUNT_ID,
    accessKey: process.env.R2_ACCESS_KEY_ID,
    secretKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
    region: "auto",
  };
}
export const r2ready = (c) => !!(c.account && c.accessKey && c.secretKey && c.bucket);
export const r2host = (c) => `${c.account}.r2.cloudflarestorage.com`;
export const r2publicUrl = (c, key) => `${c.publicUrl}/${encodePath(key)}`;

// Presigned URL (query-string auth) for browser PUT/GET/DELETE, no body signing.
export function presign(c, method, key, expires = 900, now = new Date()) {
  const host = r2host(c);
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
  const params = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${c.accessKey}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalUri = `/${c.bucket}/${encodePath(key)}`;
  const canonicalQuery = params.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const sig = crypto.createHmac("sha256", signingKey(c.secretKey, dateStamp, c.region, "s3")).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

// Server-side signed request (header auth) for GET (list) / DELETE / PUT.
// key="" targets the bucket root (for ListObjectsV2 with query).
export async function signedFetch(c, method, key, { query = "", body = null, contentType = null } = {}, now = new Date()) {
  const host = r2host(c);
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
  const canonicalUri = key ? `/${c.bucket}/${encodePath(key)}` : `/${c.bucket}`;
  const payloadHash = body ? sha256hex(body) : sha256hex("");
  const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
  const cq = query
    ? query.split("&").map(p => { const i = p.indexOf("="); return i < 0 ? [p, ""] : [p.slice(0, i), p.slice(i + 1)]; })
        .sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&")
    : "";
  const canonicalRequest = [method, canonicalUri, cq, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const sig = crypto.createHmac("sha256", signingKey(c.secretKey, dateStamp, c.region, "s3")).update(stringToSign).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${c.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  const url = `https://${host}${canonicalUri}${cq ? `?${cq}` : ""}`;
  return fetch(url, { method, headers: { ...headers, Authorization: auth }, body });
}
