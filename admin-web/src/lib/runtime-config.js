const runtime = globalThis.window?.__PETRISE_CONFIG__ || {};

export const API_URL = String(
  runtime.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/$/, "");
