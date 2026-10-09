import axios from "axios";
import { API_URL } from "./runtime-config.js";
import { clearSession, loadSession, saveSession } from "./storage.js";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  const session = loadSession();
  if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes("/portal/auth/")) {
      return Promise.reject(error);
    }
    const session = loadSession();
    if (!session?.refreshToken) return Promise.reject(error);
    original._retry = true;
    try {
      refreshPromise ||= api.post("/portal/auth/refresh", { refreshToken: session.refreshToken }, { headers: { Authorization: undefined } });
      const { data } = await refreshPromise;
      refreshPromise = null;
      saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, conta: data.conta }, data.manterConectado);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      refreshPromise = null;
      clearSession();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    }
  }
);
