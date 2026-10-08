import axios from "axios";
import {
  clearStoredSession,
  getSelectedCompanyId,
  getStoredSession,
  updateStoredSession,
} from "./storage.js";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

const refreshClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  const session = getStoredSession();
  const companyId = getSelectedCompanyId();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  if (companyId) {
    config.headers["X-Empresa-Id"] = companyId;
  }

  return config;
});

async function renovarSessao() {
  const current = getStoredSession();
  if (!current?.refreshToken) throw new Error("Sem refresh token.");

  const { data } = await refreshClient.post("/auth/refresh", {
    refreshToken: current.refreshToken,
  });

  const next = {
    ...current,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    usuario: data.usuario || current.usuario,
    manterConectado: data.manterConectado ?? current.manterConectado,
  };

  updateStoredSession(next);
  window.dispatchEvent(new CustomEvent("bichone:session-refreshed", { detail: next }));
  return next;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");

    if (isUnauthorized && !isAuthEndpoint && original && !original.__bichoneRetried) {
      original.__bichoneRetried = true;

      try {
        if (!refreshPromise) {
          refreshPromise = renovarSessao().finally(() => {
            refreshPromise = null;
          });
        }

        const session = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      } catch {
        clearStoredSession();
        window.dispatchEvent(new Event("bichone:unauthorized"));
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error, fallback = "Não foi possível concluir a operação.") {
  return error.response?.data?.message || error.message || fallback;
}

export default api;
