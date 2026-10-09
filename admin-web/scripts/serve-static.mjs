import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = resolve(process.cwd(), "dist");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function runtimeConfig() {
  const apiUrl = String(process.env.PETRISE_API_URL || process.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
  const organizacaoSlug = String(process.env.PETRISE_ORGANIZACAO_SLUG || process.env.VITE_ORGANIZACAO_SLUG || "").trim();
  return { apiUrl, organizacaoSlug };
}

function sendFile(res, file) {
  const ext = extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ success: true, service: process.env.RAILWAY_SERVICE_NAME || "PetRise Web" }));
  }

  if (url.pathname === "/runtime-config.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(`window.__PETRISE_CONFIG__ = ${JSON.stringify(runtimeConfig())};`);
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = "/"; }
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = join(ROOT, safePath === "/" ? "index.html" : safePath);

  if (existsSync(file) && statSync(file).isFile()) return sendFile(res, file);

  // SPA fallback (React Router)
  file = join(ROOT, "index.html");
  if (existsSync(file)) return sendFile(res, file);

  res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
  return res.end("Build do PetRise não encontrado. Execute npm run build.");
});

server.listen(PORT, HOST, () => {
  console.log(`[PetRise Web] online em ${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
