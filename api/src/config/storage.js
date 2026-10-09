import crypto from "node:crypto";

function env(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`STORAGE_CONFIG_AUSENTE:${name}`);
  return value;
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKey(key) {
  return key.split("/").map((part) => rfc3986(part)).join("/");
}

function storageConfig() {
  const endpoint = new URL(env("STORAGE_ENDPOINT"));
  return {
    endpoint,
    bucket: env("STORAGE_BUCKET"),
    region: process.env.STORAGE_REGION || "auto",
    accessKeyId: env("STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: env("STORAGE_SECRET_ACCESS_KEY"),
    virtualHost: String(process.env.STORAGE_URL_STYLE || "virtual-host") !== "path",
    ttl: Math.min(Math.max(Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS) || 300, 30), 604800),
  };
}

export function storageConfigured() {
  return ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"].every((name) => String(process.env[name] || "").trim());
}

export function presignObject({ key, method = "GET", expiresIn }) {
  const cfg = storageConfig();
  const now = new Date();
  const stamp = amzDate(now);
  const shortDate = stamp.slice(0, 8);
  const service = "s3";
  const scope = `${shortDate}/${cfg.region}/${service}/aws4_request`;

  const hostname = cfg.virtualHost ? `${cfg.bucket}.${cfg.endpoint.host}` : cfg.endpoint.host;
  const basePath = cfg.virtualHost ? "" : `/${rfc3986(cfg.bucket)}`;
  const canonicalUri = `${basePath}/${encodeKey(key)}`.replace(/\/+/g, "/");
  const ttl = Math.min(Math.max(Number(expiresIn) || cfg.ttl, 1), 604800);

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(ttl),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
    .join("&");
  const canonicalHeaders = `host:${hostname}\n`;
  const canonicalRequest = [method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, shortDate);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");

  return `${cfg.endpoint.protocol}//${hostname}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function putObject({ key, body, contentType = "application/octet-stream" }) {
  const url = presignObject({ key, method: "PUT", expiresIn: 300 });
  const response = await fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType } });
  if (!response.ok) throw new Error(`STORAGE_UPLOAD_FALHOU:${response.status}`);
  return true;
}

export async function deleteObject(key) {
  const url = presignObject({ key, method: "DELETE", expiresIn: 300 });
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`STORAGE_DELETE_FALHOU:${response.status}`);
  return true;
}
