const runtime = globalThis.window?.__PETRISE_CONFIG__ || {};

export const API_URL = String(
  runtime.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/$/, "");

function slugFromQuery() {
  if (!globalThis.window) return "";
  const value = new URLSearchParams(window.location.search).get("org")?.trim().toLowerCase() || "";
  if (value) localStorage.setItem("petrise:organizacao-slug", value);
  return value;
}

export function getOrganizacaoSlug() {
  const explicit = String(runtime.organizacaoSlug || import.meta.env.VITE_ORGANIZACAO_SLUG || "").trim().toLowerCase();
  if (explicit) return explicit;

  const query = slugFromQuery();
  if (query) return query;

  const stored = globalThis.window?.localStorage?.getItem("petrise:organizacao-slug")?.trim().toLowerCase();
  if (stored) return stored;

  return import.meta.env.DEV ? "pet-king" : "";
}
